from typing import Annotated, Any

from pydantic import Field, FiniteFloat

from .common import ApiModel


class BuildingSummary(ApiModel):
    id: str
    code: str
    name: str
    timezone: str
    locale: str


class BuildingDetail(BuildingSummary):
    features: dict[str, bool]
    active_model_version_id: str | None = None
    permissions: dict[str, bool] = Field(default_factory=dict)


class CreateBuildingRequest(ApiModel):
    code: str
    name: str
    timezone: str = "UTC"
    locale: str = "en"


class UnitSummary(ApiModel):
    id: str
    building_id: str
    code: str
    display_name: str
    unit_type: str
    storey_code: str
    status: str
    address: str | None = None
    area: float | None = None
    owner: str | None = None
    certificate_number: str | None = None
    ownership_term: str | None = None


class HouseholdUnitView(UnitSummary):
    layer_id: str | None = None
    model_local_ids: list[int] = Field(default_factory=list)
    global_ids: list[str] = Field(default_factory=list)


class HouseholdStoreyView(ApiModel):
    code: str
    label: str
    unit_count: int
    bound_unit_count: int
    units: list[HouseholdUnitView]


class HouseholdIndexView(ApiModel):
    building_id: str
    model_version_id: str | None = None
    binding_set_id: str | None = None
    coverage: float = 0.0
    storeys: list[HouseholdStoreyView]


class CreateUnitRequest(ApiModel):
    code: str
    display_name: str
    unit_type: str = "apartment"
    storey_code: str = "L01"
    status: str = "active"
    address: str | None = None
    area: float | None = None
    owner: str | None = None
    certificate_number: str | None = None
    ownership_term: str | None = None


class UpdateUnitRequest(ApiModel):
    code: str | None = None
    display_name: str | None = None
    unit_type: str | None = None
    storey_code: str | None = None
    status: str | None = None
    address: str | None = None
    area: float | None = None
    owner: str | None = None
    certificate_number: str | None = None
    ownership_term: str | None = None


class OccupancyView(ApiModel):
    relationship_type: str
    display_name: str | None = None
    email: str | None = None
    phone: str | None = None
    citizen_id: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    residence_type: str | None = None
    status: str | None = None
    starts_at: str
    ends_at: str | None = None


class AdminOccupancyView(ApiModel):
    id: str
    unit_id: str
    person_id: str
    relationship_type: str
    display_name: str | None = None
    email: str | None = None
    phone: str | None = None
    citizen_id: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    residence_type: str | None = None
    status: str = "active"
    starts_at: str
    ends_at: str | None = None


class CreateOccupancyRequest(ApiModel):
    display_name: str
    email: str | None = None
    phone: str | None = None
    citizen_id: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    relationship_type: str = "owner"
    residence_type: str = "permanent"
    status: str = "active"
    starts_at: str | None = None
    ends_at: str | None = None


class UpdateOccupancyRequest(ApiModel):
    display_name: str | None = None
    email: str | None = None
    phone: str | None = None
    citizen_id: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    relationship_type: str | None = None
    residence_type: str | None = None
    status: str | None = None
    starts_at: str | None = None
    ends_at: str | None = None


class UnitBindingSeedInput(ApiModel):
    apartment_code: str
    storey_code: str
    express_id: int
    global_id: str | None = None
    category: str | None = None
    area: float | None = None


class UnitBindingIndexInput(ApiModel):
    schema_version: str
    source_hash: str
    scanned_element_count: int = 0
    bindings: list[UnitBindingSeedInput]
    storeys: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class UnitBindingImportView(ApiModel):
    binding_set_id: str
    matched_unit_count: int
    binding_count: int
    total_unit_count: int
    coverage: float
    unmatched_apartment_codes: list[str] = Field(default_factory=list)


class SetupModelsRequest(ApiModel):
    model_name: str = "Architectural Model"
    ifc_asset_url: str
    ifc_byte_size: int
    ifc_content_hash: str
    env_name: str = "Surrounding Context"
    env_asset_url: str
    env_byte_size: int
    env_content_hash: str
    unit_binding_index: UnitBindingIndexInput | None = None


class CameraPoseInput(ApiModel):
    position: tuple[FiniteFloat, FiniteFloat, FiniteFloat]
    target: tuple[FiniteFloat, FiniteFloat, FiniteFloat]
    up: tuple[FiniteFloat, FiniteFloat, FiniteFloat] | None = None
    fov: Annotated[FiniteFloat, Field(gt=0, le=180)] | None = None


class ActionResponse(ApiModel):
    success: bool
    message: str = ""


class BimIndexStatusView(ApiModel):
    status: str
    schema_version: str | None = None
    extractor_version: str | None = None
    source_hash: str | None = None
    element_count: int = 0
    generated_at: str | None = None
    error: str | None = None


class BimElementRefView(ApiModel):
    model_version_id: str
    model_local_id: int
    global_id: str | None = None


class AABBView(ApiModel):
    min: tuple[float, float, float]
    max: tuple[float, float, float]


class BimCatalogElementView(ApiModel):
    layer_id: str
    ref: BimElementRefView
    title: str
    category: str
    box: AABBView | None = None


class BimCatalogView(ApiModel):
    schema_version: str
    model_version_id: str
    source_hash: str
    elements: list[BimCatalogElementView]


class BimElementMetadataView(ApiModel):
    element: BimCatalogElementView
    raw_data: dict[str, Any]


class Page(ApiModel):
    items: list[Any]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)


class ErrorEnvelope(ApiModel):
    code: str
    message: str
    correlation_id: str
