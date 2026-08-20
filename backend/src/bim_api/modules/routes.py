from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from sqlalchemy.orm import Session

from .authorization import Actor, AuthorizationService
from .schemas import BuildingDetail, OccupancyView, Page
from .services import BuildingService, ModelService, UnitService

router = APIRouter(prefix="/api/v1")


def session_dependency(request: Request) -> Iterator[Session]:
    session = request.app.state.session_factory()
    try:
        yield session
    finally:
        session.close()


SessionDependency = Annotated[Session, Depends(session_dependency)]


def actor_dependency(
    request: Request,
    session: SessionDependency,
    x_actor_id: Annotated[str | None, Header()] = None,
) -> Actor:
    if not request.app.state.settings.allow_dev_auth:
        x_actor_id = None
    return request.app.state.authorization.resolve_actor(session, x_actor_id)


ActorDependency = Annotated[Actor, Depends(actor_dependency)]


@router.get("/buildings", response_model=Page)
def list_buildings(
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 25,
) -> Page:
    return request.app.state.buildings.list_accessible(session, actor, page, page_size)


@router.get(
    "/buildings/{building_id}",
    response_model=BuildingDetail,
    response_model_exclude_none=True,
)
def get_building(
    building_id: str, request: Request, session: SessionDependency, actor: ActorDependency
) -> BuildingDetail:
    return request.app.state.buildings.get(session, actor, building_id)


@router.get("/buildings/{building_id}/models/active/manifest")
def get_active_manifest(
    building_id: str, request: Request, session: SessionDependency, actor: ActorDependency
) -> dict[str, object]:
    return request.app.state.models.get_active_manifest(session, actor, building_id)


@router.get("/buildings/{building_id}/scenes/active/manifest")
def get_active_scene_manifest(
    building_id: str, request: Request, session: SessionDependency, actor: ActorDependency
) -> dict[str, object]:
    return request.app.state.models.get_active_scene_manifest(session, actor, building_id)


@router.get("/buildings/{building_id}/units", response_model=Page)
def search_units(
    building_id: str,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
    q: str = "",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 25,
) -> Page:
    return request.app.state.units.search(session, actor, building_id, q, page, page_size)


@router.get(
    "/buildings/{building_id}/units/{unit_id}/occupancies",
    response_model=list[OccupancyView],
    response_model_exclude_none=True,
)
def current_occupancies(
    building_id: str,
    unit_id: str,
    response: Response,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> list[OccupancyView]:
    response.headers["Cache-Control"] = "private, no-store"
    return request.app.state.units.current_occupancies(session, actor, building_id, unit_id)


def configure_services(app: object, authorization: AuthorizationService) -> None:
    app.state.authorization = authorization
    app.state.buildings = BuildingService(authorization)
    app.state.models = ModelService(authorization)
    app.state.units = UnitService(authorization)
