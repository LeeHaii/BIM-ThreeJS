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


class UnitSummary(ApiModel):
    id: str
    building_id: str
    code: str
    display_name: str
    unit_type: str
    storey_code: str
    status: str


class OccupancyView(ApiModel):
    relationship_type: str
    display_name: str | None = None
    email: str | None = None
    phone: str | None = None
    starts_at: str
    ends_at: str | None = None


class Page(ApiModel):
    items: list[Any]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)


class ErrorEnvelope(ApiModel):
    code: str
    message: str
    correlation_id: str
