from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from bim_api.infrastructure.database import (
    create_database_engine,
    create_session_factory,
    transaction,
)
from bim_api.infrastructure.models import Base
from bim_api.infrastructure.seed import seed_from_file
from bim_api.modules.authorization import AuthorizationService
from bim_api.modules.common import ApiError
from bim_api.modules.routes import configure_services, router

from .config import Settings


def create_server(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings()
    engine = create_database_engine(resolved_settings.database_url)
    session_factory = create_session_factory(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        Base.metadata.create_all(engine)
        if resolved_settings.seed_synthetic_data:
            with transaction(session_factory) as session:
                seed_from_file(session, resolved_settings.seed_path)
        yield
        engine.dispose()

    app = FastAPI(title="BIM Operations API", version="0.1.0", lifespan=lifespan)
    app.state.settings = resolved_settings
    app.state.session_factory = session_factory
    configure_services(app, AuthorizationService())
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Authorization", "Content-Type", "X-Actor-Id", "X-Correlation-Id"],
    )

    @app.middleware("http")
    async def correlation_id(request: Request, call_next):  # type: ignore[no-untyped-def]
        correlation = request.headers.get("X-Correlation-Id", str(uuid4()))
        request.state.correlation_id = correlation
        response = await call_next(request)
        response.headers["X-Correlation-Id"] = correlation
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, error: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={
                "code": error.code,
                "message": error.message,
                "correlationId": request.state.correlation_id,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, _: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "code": "invalid_request",
                "message": "Request validation failed",
                "correlationId": request.state.correlation_id,
            },
        )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(router)
    return app
