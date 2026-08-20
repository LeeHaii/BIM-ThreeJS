from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from bim_api.infrastructure.models import (
    BuildingRecord,
    ModelRecord,
    ModelVersionRecord,
    OccupancyRecord,
    PersonRecord,
    SiteRecord,
    UnitRecord,
    UserBuildingAccessRecord,
)

from .authorization import Actor, AuthorizationService
from .common import ApiError
from .schemas import BuildingDetail, BuildingSummary, OccupancyView, Page, UnitSummary


def iso_utc(value: datetime) -> str:
    aware = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return aware.isoformat().replace("+00:00", "Z")


class BuildingService:
    def __init__(self, authorization: AuthorizationService):
        self.authorization = authorization

    def list_accessible(self, session: Session, actor: Actor, page: int, page_size: int) -> Page:
        query = (
            select(BuildingRecord, SiteRecord)
            .join(SiteRecord, SiteRecord.id == BuildingRecord.site_id)
            .join(
                UserBuildingAccessRecord, UserBuildingAccessRecord.building_id == BuildingRecord.id
            )
            .where(UserBuildingAccessRecord.user_id == actor.id, BuildingRecord.status == "active")
            .order_by(BuildingRecord.name)
        )
        rows = session.execute(query.offset((page - 1) * page_size).limit(page_size)).all()
        total = (
            session.scalar(
                select(func.count())
                .select_from(UserBuildingAccessRecord)
                .where(UserBuildingAccessRecord.user_id == actor.id)
            )
            or 0
        )
        items = [
            BuildingSummary(
                id=building.id,
                code=building.code,
                name=building.name,
                timezone=site.timezone,
                locale=site.locale,
            ).model_dump(by_alias=True)
            for building, site in rows
        ]
        return Page(items=items, page=page, page_size=page_size, total=total)

    def get(self, session: Session, actor: Actor, building_id: str) -> BuildingDetail:
        self.authorization.require_building_access(session, actor, building_id)
        row = session.execute(
            select(BuildingRecord, SiteRecord)
            .join(SiteRecord, SiteRecord.id == BuildingRecord.site_id)
            .where(BuildingRecord.id == building_id)
        ).one_or_none()
        if row is None:
            raise ApiError(404, "building_not_found", "Building was not found")
        building, site = row
        active_version_id = session.scalar(
            select(ModelVersionRecord.id)
            .join(ModelRecord, ModelRecord.id == ModelVersionRecord.model_id)
            .where(ModelRecord.building_id == building_id, ModelVersionRecord.status == "active")
        )
        return BuildingDetail(
            id=building.id,
            code=building.code,
            name=building.name,
            timezone=site.timezone,
            locale=site.locale,
            features=building.configuration.get("features", {}),
            active_model_version_id=active_version_id,
        )


class ModelService:
    def __init__(self, authorization: AuthorizationService):
        self.authorization = authorization

    def get_active_manifest(
        self, session: Session, actor: Actor, building_id: str
    ) -> dict[str, object]:
        self.authorization.require_building_access(session, actor, building_id)
        version = session.scalar(
            select(ModelVersionRecord)
            .join(ModelRecord, ModelRecord.id == ModelVersionRecord.model_id)
            .where(ModelRecord.building_id == building_id, ModelVersionRecord.status == "active")
        )
        if version is None:
            raise ApiError(404, "active_model_not_found", "No active model is available")
        return version.manifest


class UnitService:
    def __init__(self, authorization: AuthorizationService):
        self.authorization = authorization

    def search(
        self,
        session: Session,
        actor: Actor,
        building_id: str,
        query: str,
        page: int,
        page_size: int,
    ) -> Page:
        self.authorization.require_building_access(session, actor, building_id)
        filters = [UnitRecord.building_id == building_id]
        if query:
            pattern = f"%{query.strip()}%"
            filters.append(
                or_(UnitRecord.code.ilike(pattern), UnitRecord.display_name.ilike(pattern))
            )
        total = session.scalar(select(func.count()).select_from(UnitRecord).where(*filters)) or 0
        records = session.scalars(
            select(UnitRecord)
            .where(*filters)
            .order_by(UnitRecord.storey_code, UnitRecord.code)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        items = [
            UnitSummary(
                id=record.id,
                building_id=record.building_id,
                code=record.code,
                display_name=record.display_name,
                unit_type=record.unit_type,
                storey_code=record.storey_code,
                status=record.status,
            ).model_dump(by_alias=True)
            for record in records
        ]
        return Page(items=items, page=page, page_size=page_size, total=total)

    def current_occupancies(
        self, session: Session, actor: Actor, building_id: str, unit_id: str
    ) -> list[OccupancyView]:
        role = self.authorization.require_building_access(session, actor, building_id)
        unit = session.scalar(
            select(UnitRecord).where(
                UnitRecord.id == unit_id, UnitRecord.building_id == building_id
            )
        )
        if unit is None:
            raise ApiError(404, "unit_not_found", "Unit was not found")
        now = datetime.now(UTC)
        rows = session.execute(
            select(OccupancyRecord, PersonRecord)
            .join(PersonRecord, PersonRecord.id == OccupancyRecord.person_id)
            .where(
                OccupancyRecord.building_id == building_id,
                OccupancyRecord.unit_id == unit_id,
                OccupancyRecord.starts_at <= now,
                or_(OccupancyRecord.ends_at.is_(None), OccupancyRecord.ends_at > now),
                OccupancyRecord.status == "active",
            )
        ).all()
        fields = self.authorization.permitted_person_fields(role)
        return [
            OccupancyView(
                relationship_type=occupancy.relationship_type,
                display_name=person.display_name if "display_name" in fields else None,
                email=person.email if "email" in fields else None,
                phone=person.phone if "phone" in fields else None,
                starts_at=iso_utc(occupancy.starts_at),
                ends_at=iso_utc(occupancy.ends_at) if occupancy.ends_at is not None else None,
            )
            for occupancy, person in rows
        ]
