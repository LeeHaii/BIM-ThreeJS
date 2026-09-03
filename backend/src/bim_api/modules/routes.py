import hashlib
import json
import os
import subprocess
from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session

from .authorization import Actor, AuthorizationService
from .common import ApiError
from .schemas import (
    ActionResponse,
    AdminOccupancyView,
    BuildingDetail,
    CameraPoseInput,
    CreateBuildingRequest,
    CreateOccupancyRequest,
    CreateUnitRequest,
    HouseholdIndexView,
    OccupancyView,
    Page,
    SetupModelsRequest,
    UnitBindingImportView,
    UnitBindingIndexInput,
    UnitSummary,
    UpdateOccupancyRequest,
    UpdateUnitRequest,
)
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


# Public / Operator Routes
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
    "/buildings/{building_id}/households",
    response_model=HouseholdIndexView,
    response_model_exclude_none=True,
)
def household_index(
    building_id: str,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> HouseholdIndexView:
    return request.app.state.units.household_index(session, actor, building_id)


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


# Admin Endpoints
@router.post(
    "/admin/buildings",
    response_model=BuildingDetail,
    response_model_exclude_none=True,
)
def create_building(
    payload: CreateBuildingRequest,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> BuildingDetail:
    return request.app.state.buildings.create(session, actor, payload)


@router.delete("/admin/buildings/{building_id}", response_model=ActionResponse)
def delete_building(
    building_id: str,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> ActionResponse:
    request.app.state.buildings.delete(session, actor, building_id)
    return ActionResponse(success=True, message="Building deleted successfully")


@router.post("/admin/buildings/{building_id}/models/setup")
def setup_models(
    building_id: str,
    payload: SetupModelsRequest,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> dict[str, object]:
    return request.app.state.models.setup_models(session, actor, building_id, payload)


@router.put("/admin/buildings/{building_id}/scenes/active/default-camera")
def update_default_camera(
    building_id: str,
    payload: CameraPoseInput,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> dict[str, object]:
    return request.app.state.models.update_default_camera(
        session,
        actor,
        building_id,
        payload,
    )


@router.post(
    "/admin/buildings/{building_id}/models/active/unit-bindings",
    response_model=UnitBindingImportView,
)
def import_unit_bindings(
    building_id: str,
    payload: UnitBindingIndexInput,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> UnitBindingImportView:
    return request.app.state.models.import_unit_bindings(
        session,
        actor,
        building_id,
        payload,
    )


@router.post("/admin/buildings/{building_id}/models/upload")
async def upload_models(
    building_id: str,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
    ifc_file: Annotated[UploadFile, File()],
    gltf_file: Annotated[UploadFile, File()],
    model_name: Annotated[str, Form()] = "Architectural Model",
    env_name: Annotated[str, Form()] = "Surrounding Context",
) -> dict[str, object]:
    # Determine public asset path
    root = Path(__file__).resolve().parents[4]
    asset_dir = root / "frontend" / "public" / "model-assets"
    asset_dir.mkdir(parents=True, exist_ok=True)

    ifc_bytes = await ifc_file.read()
    gltf_bytes = await gltf_file.read()

    if len(ifc_bytes) == 0:
        raise ApiError(400, "empty_file", "IFC model file cannot be empty")
    if len(gltf_bytes) == 0:
        raise ApiError(400, "empty_file", "GLTF environment file cannot be empty")

    gltf_hash = hashlib.sha256(gltf_bytes).hexdigest()
    gltf_filename = gltf_file.filename or "environment.glb"
    target_gltf_name = f"{building_id}-{gltf_filename}"
    target_gltf_path = asset_dir / target_gltf_name
    target_gltf_path.write_bytes(gltf_bytes)

    ifc_filename = ifc_file.filename or "model.frag"
    unit_binding_index: dict[str, object] | None = None
    if ifc_filename.lower().endswith(".ifc"):
        # Save raw IFC source file
        source_ifc_name = f"{building_id}-source.ifc"
        source_ifc_path = asset_dir / source_ifc_name
        source_ifc_path.write_bytes(ifc_bytes)

        # Convert to .frag
        target_ifc_name = f"{building_id}-model.frag"
        target_ifc_path = asset_dir / target_ifc_name

        cmd = [
            "pnpm",
            "--filter",
            "@bim/model-pipeline",
            "convert:ifc",
            str(source_ifc_path),
            str(target_ifc_path),
        ]
        env = os.environ.copy()
        env["NODE_OPTIONS"] = "--max-old-space-size=8192"

        try:
            result = subprocess.run(
                cmd,
                cwd=str(root),
                capture_output=True,
                text=True,
                shell=True,
                env=env,
                timeout=300,
            )
        except subprocess.TimeoutExpired as exc:
            raise ApiError(
                422,
                "ifc_conversion_timeout",
                "IFC conversion timed out after 300 seconds",
            ) from exc

        if result.returncode != 0:
            err_msg = result.stderr.strip() or result.stdout.strip() or "Unknown error"
            raise ApiError(
                422,
                "ifc_conversion_failed",
                f"Failed to convert IFC to Fragments: {err_msg}",
            )

        if not target_ifc_path.exists():
            raise ApiError(
                422,
                "ifc_conversion_failed",
                "Conversion succeeded but output .frag was not found",
            )

        frag_bytes = target_ifc_path.read_bytes()
        ifc_byte_size = len(frag_bytes)
        ifc_hash = hashlib.sha256(frag_bytes).hexdigest()
        binding_index_path = Path(f"{target_ifc_path}.unit-bindings.json")
        if binding_index_path.exists():
            unit_binding_index = json.loads(binding_index_path.read_text(encoding="utf-8"))
    else:
        # Direct .frag upload
        target_ifc_name = f"{building_id}-{ifc_filename}"
        target_ifc_path = asset_dir / target_ifc_name
        target_ifc_path.write_bytes(ifc_bytes)
        ifc_byte_size = len(ifc_bytes)
        ifc_hash = hashlib.sha256(ifc_bytes).hexdigest()

    setup_request = SetupModelsRequest(
        model_name=model_name,
        ifc_asset_url=f"/model-assets/{target_ifc_name}",
        ifc_byte_size=ifc_byte_size,
        ifc_content_hash=ifc_hash,
        env_name=env_name,
        env_asset_url=f"/model-assets/{target_gltf_name}",
        env_byte_size=len(gltf_bytes),
        env_content_hash=gltf_hash,
        unit_binding_index=unit_binding_index,
    )

    return request.app.state.models.setup_models(session, actor, building_id, setup_request)


# Admin Unit CRUD
@router.post("/admin/buildings/{building_id}/units", response_model=UnitSummary)
def create_unit(
    building_id: str,
    payload: CreateUnitRequest,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> UnitSummary:
    return request.app.state.units.create(session, actor, building_id, payload)


@router.put("/admin/buildings/{building_id}/units/{unit_id}", response_model=UnitSummary)
def update_unit(
    building_id: str,
    unit_id: str,
    payload: UpdateUnitRequest,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> UnitSummary:
    return request.app.state.units.update(session, actor, building_id, unit_id, payload)


@router.delete("/admin/buildings/{building_id}/units/{unit_id}", response_model=ActionResponse)
def delete_unit(
    building_id: str,
    unit_id: str,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> ActionResponse:
    request.app.state.units.delete(session, actor, building_id, unit_id)
    return ActionResponse(success=True, message="Unit deleted successfully")


# Admin Occupancy / Resident CRUD
@router.get(
    "/admin/buildings/{building_id}/units/{unit_id}/occupancies",
    response_model=list[AdminOccupancyView],
)
def list_admin_occupancies(
    building_id: str,
    unit_id: str,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> list[AdminOccupancyView]:
    return request.app.state.units.list_admin_occupancies(session, actor, building_id, unit_id)


@router.post(
    "/admin/buildings/{building_id}/units/{unit_id}/occupancies",
    response_model=AdminOccupancyView,
)
def create_occupancy(
    building_id: str,
    unit_id: str,
    payload: CreateOccupancyRequest,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> AdminOccupancyView:
    return request.app.state.units.create_occupancy(session, actor, building_id, unit_id, payload)


@router.put(
    "/admin/buildings/{building_id}/occupancies/{occupancy_id}",
    response_model=AdminOccupancyView,
)
def update_occupancy(
    building_id: str,
    occupancy_id: str,
    payload: UpdateOccupancyRequest,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> AdminOccupancyView:
    return request.app.state.units.update_occupancy(
        session, actor, building_id, occupancy_id, payload
    )


@router.delete(
    "/admin/buildings/{building_id}/occupancies/{occupancy_id}",
    response_model=ActionResponse,
)
def delete_occupancy(
    building_id: str,
    occupancy_id: str,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> ActionResponse:
    request.app.state.units.delete_occupancy(session, actor, building_id, occupancy_id)
    return ActionResponse(success=True, message="Occupancy record deleted successfully")


def configure_services(app: object, authorization: AuthorizationService) -> None:
    app.state.authorization = authorization
    app.state.buildings = BuildingService(authorization)
    app.state.models = ModelService(authorization)
    app.state.units = UnitService(authorization)
