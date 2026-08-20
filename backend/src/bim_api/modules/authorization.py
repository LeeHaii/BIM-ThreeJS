from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from bim_api.infrastructure.models import UserBuildingAccessRecord, UserRecord

from .common import ApiError


@dataclass(frozen=True)
class Actor:
    id: str


class AuthorizationService:
    _person_fields = {
        "viewer": frozenset(),
        "operator": frozenset({"display_name"}),
        "facility_admin": frozenset(
            {"display_name", "email", "phone", "citizen_id", "date_of_birth", "gender"}
        ),
    }

    def resolve_actor(self, session: Session, actor_id: str | None) -> Actor:
        if actor_id is None:
            raise ApiError(401, "authentication_required", "Authentication is required")
        user = session.get(UserRecord, actor_id)
        if user is None or user.status != "active":
            raise ApiError(401, "invalid_actor", "The authenticated actor is not active")
        return Actor(user.id)

    def require_building_access(self, session: Session, actor: Actor, building_id: str) -> str:
        access = session.scalar(
            select(UserBuildingAccessRecord).where(
                UserBuildingAccessRecord.user_id == actor.id,
                UserBuildingAccessRecord.building_id == building_id,
            )
        )
        if access is None:
            raise ApiError(404, "building_not_found", "Building was not found")
        return access.role

    def permitted_person_fields(self, role: str) -> frozenset[str]:
        return self._person_fields.get(role, frozenset())
