from typing import Any

from pydantic import Field

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


class SetupModelsRequest(ApiModel):
    model_name: str = "Architectural Model"
    ifc_asset_url: str
    ifc_byte_size: int
    ifc_content_hash: str
    env_name: str = "Surrounding Context"
    env_asset_url: str
    env_byte_size: int
    env_content_hash: str


class ActionResponse(ApiModel):
    success: bool
    message: str = ""


class Page(ApiModel):
    items: list[Any]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)


class ErrorEnvelope(ApiModel):
    code: str
    message: str
    correlation_id: str
