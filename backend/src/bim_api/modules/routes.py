import asyncio
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
    BimCatalogView,
    BimElementMetadataView,
    BimIndexStatusView,
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

BIM_INDEX_EXTRACTOR_VERSION = "@bim/model-pipeline@0.1.0+fragments-3.4.7"


async def save_upload(upload: UploadFile, target: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    byte_size = 0
    with target.open("wb") as output:
        while chunk := await upload.read(1024 * 1024):
            output.write(chunk)
            digest.update(chunk)
            byte_size += len(chunk)
    return byte_size, digest.hexdigest()


def file_size_and_hash(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    byte_size = 0
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
            byte_size += len(chunk)
    return byte_size, digest.hexdigest()


def safe_upload_filename(filename: str | None, fallback: str) -> str:
    candidate = (filename or fallback).replace("\\", "/").rsplit("/", 1)[-1]
    return candidate or fallback


def run_pipeline(root: Path, arguments: list[str], timeout: int = 300) -> None:
    env = os.environ.copy()
    env["NODE_OPTIONS"] = "--max-old-space-size=8192"
    try:
        result = subprocess.run(
            ["pnpm", "--filter", "@bim/model-pipeline", *arguments],
            cwd=str(root),
            capture_output=True,
            text=True,
            shell=True,
            env=env,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise ApiError(422, "model_pipeline_timeout", "Model processing timed out") from exc
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or "Unknown error"
        raise ApiError(422, "model_pipeline_failed", f"Model processing failed: {message}")


def resolve_model_asset(root: Path, asset_url: str) -> Path:
    prefix = "/model-assets/"
    if not asset_url.startswith(prefix):
        raise ApiError(422, "unsupported_model_asset", "Active model is not a local asset")
    asset_root = (root / "frontend" / "public" / "model-assets").resolve()
    candidate = (asset_root / asset_url.removeprefix(prefix)).resolve()
    try:
        candidate.relative_to(asset_root)
    except ValueError as exc:
        raise ApiError(422, "invalid_model_asset", "Active model asset path is invalid") from exc
    if not candidate.is_file():
        raise ApiError(404, "model_asset_not_found", "Active model asset was not found")
    return candidate


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


@router.get(
    "/buildings/{building_id}/models/{model_version_id}/bim-index/catalog",
    response_model=BimCatalogView,
    response_model_exclude_none=True,
)
def get_bim_catalog(
    building_id: str,
    model_version_id: str,
    response: Response,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> Response | BimCatalogView:
    result = request.app.state.models.get_bim_catalog(session, actor, building_id, model_version_id)
    etag = f'"{result.source_hash}-catalog-v{result.schema_version}"'
    response.headers["Cache-Control"] = "private, max-age=31536000, immutable"
    response.headers["ETag"] = etag
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=dict(response.headers))
    return result


@router.get(
    "/buildings/{building_id}/models/{model_version_id}/bim-index/elements/{model_local_id}",
    response_model=BimElementMetadataView,
    response_model_exclude_none=True,
)
def get_bim_element(
    building_id: str,
    model_version_id: str,
    model_local_id: int,
    response: Response,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> Response | BimElementMetadataView:
    result = request.app.state.models.get_bim_element(
        session, actor, building_id, model_version_id, model_local_id
    )
    etag = f'"{model_version_id}-{model_local_id}-metadata-v1"'
    response.headers["Cache-Control"] = "private, max-age=31536000, immutable"
    response.headers["ETag"] = etag
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=dict(response.headers))
    return result


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


@router.get(
    "/admin/buildings/{building_id}/models/active/bim-index/status",
    response_model=BimIndexStatusView,
    response_model_exclude_none=True,
)
def get_bim_index_status(
    building_id: str,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> BimIndexStatusView:
    return request.app.state.models.get_bim_index_status(session, actor, building_id)


@router.post(
    "/admin/buildings/{building_id}/models/active/bim-index/build",
    response_model=BimIndexStatusView,
    response_model_exclude_none=True,
)
def build_bim_index(
    building_id: str,
    request: Request,
    session: SessionDependency,
    actor: ActorDependency,
) -> BimIndexStatusView:
    root = Path(__file__).resolve().parents[4]
    manifest = request.app.state.models.get_active_manifest(session, actor, building_id)
    layers = manifest.get("fragmentLayers", [])
    fragment_layer = next((layer for layer in layers if isinstance(layer, dict)), None)
    if fragment_layer is None:
        raise ApiError(404, "fragment_layer_not_found", "Active BIM fragment layer was not found")
    asset = fragment_layer.get("asset")
    if not isinstance(asset, dict) or not isinstance(asset.get("url"), str):
        raise ApiError(422, "invalid_model_manifest", "Active model asset is invalid")
    fragment_path = resolve_model_asset(root, asset["url"])
    output_path = Path(f"{fragment_path}.bim-index.ndjson")
    if not output_path.exists() or output_path.stat().st_size == 0:
        run_pipeline(root, ["extract:bim-index", str(fragment_path), str(output_path)])
    _, source_hash = file_size_and_hash(fragment_path)
    return request.app.state.models.import_bim_index_file(
        session,
        actor,
        building_id,
        output_path,
        source_hash,
        BIM_INDEX_EXTRACTOR_VERSION,
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
    root = Path(__file__).resolve().parents[4]
    asset_dir = root / "frontend" / "public" / "model-assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    gltf_filename = safe_upload_filename(gltf_file.filename, "environment.glb")
    target_gltf_name = f"{building_id}-{gltf_filename}"
    target_gltf_path = asset_dir / target_gltf_name
    gltf_byte_size, gltf_hash = await save_upload(gltf_file, target_gltf_path)
    if gltf_byte_size == 0:
        target_gltf_path.unlink(missing_ok=True)
        raise ApiError(400, "empty_file", "GLTF environment file cannot be empty")

    ifc_filename = safe_upload_filename(ifc_file.filename, "model.frag")
    unit_binding_index: dict[str, object] | None = None
    if ifc_filename.lower().endswith(".ifc"):
        source_ifc_name = f"{building_id}-source.ifc"
        source_ifc_path = asset_dir / source_ifc_name
        source_byte_size, _ = await save_upload(ifc_file, source_ifc_path)
        if source_byte_size == 0:
            source_ifc_path.unlink(missing_ok=True)
            raise ApiError(400, "empty_file", "IFC model file cannot be empty")
        target_ifc_name = f"{building_id}-model.frag"
        target_ifc_path = asset_dir / target_ifc_name
        await asyncio.to_thread(
            run_pipeline,
            root,
            ["convert:ifc", str(source_ifc_path), str(target_ifc_path)],
        )
        if not target_ifc_path.exists():
            raise ApiError(
                422,
                "ifc_conversion_failed",
                "Conversion succeeded but output .frag was not found",
            )
        ifc_byte_size, ifc_hash = await asyncio.to_thread(file_size_and_hash, target_ifc_path)
        binding_index_path = Path(f"{target_ifc_path}.unit-bindings.json")
        if binding_index_path.exists():
            unit_binding_index = json.loads(binding_index_path.read_text(encoding="utf-8"))
    else:
        target_ifc_name = f"{building_id}-{ifc_filename}"
        target_ifc_path = asset_dir / target_ifc_name
        ifc_byte_size, ifc_hash = await save_upload(ifc_file, target_ifc_path)
        if ifc_byte_size == 0:
            target_ifc_path.unlink(missing_ok=True)
            raise ApiError(400, "empty_file", "IFC model file cannot be empty")

    bim_index_path = Path(f"{target_ifc_path}.bim-index.ndjson")
    if not bim_index_path.exists() or not ifc_filename.lower().endswith(".ifc"):
        bim_index_path.unlink(missing_ok=True)
        await asyncio.to_thread(
            run_pipeline,
            root,
            ["extract:bim-index", str(target_ifc_path), str(bim_index_path)],
        )

    setup_request = SetupModelsRequest(
        model_name=model_name,
        ifc_asset_url=f"/model-assets/{target_ifc_name}",
        ifc_byte_size=ifc_byte_size,
        ifc_content_hash=ifc_hash,
        env_name=env_name,
        env_asset_url=f"/model-assets/{target_gltf_name}",
        env_byte_size=gltf_byte_size,
        env_content_hash=gltf_hash,
        unit_binding_index=unit_binding_index,
    )

    request.app.state.models.setup_models(
        session, actor, building_id, setup_request
    )
    request.app.state.models.import_bim_index_file(
        session,
        actor,
        building_id,
        bim_index_path,
        ifc_hash,
        BIM_INDEX_EXTRACTOR_VERSION,
    )
    return request.app.state.models.get_active_scene_manifest(session, actor, building_id)


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
