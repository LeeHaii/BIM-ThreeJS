import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    BuildingRecord,
    ModelRecord,
    ModelVersionRecord,
    OccupancyRecord,
    OrganizationRecord,
    PersonRecord,
    SiteRecord,
    UnitRecord,
    UserBuildingAccessRecord,
    UserRecord,
)


def seed_from_file(session: Session, path: Path) -> None:
    if session.scalar(select(OrganizationRecord.id).limit(1)) is not None:
        return
    data: dict[str, list[dict[str, Any]]] = json.loads(path.read_text(encoding="utf-8"))
    record_types = (
        ("organizations", OrganizationRecord),
        ("sites", SiteRecord),
        ("buildings", BuildingRecord),
        ("models", ModelRecord),
        ("modelVersions", ModelVersionRecord),
        ("units", UnitRecord),
        ("users", UserRecord),
        ("access", UserBuildingAccessRecord),
        ("people", PersonRecord),
        ("occupancies", OccupancyRecord),
    )
    for key, record_type in record_types:
        records = []
        for raw_item in data.get(key, []):
            item = raw_item.copy()
            for field, value in item.items():
                if field.endswith("_at") and isinstance(value, str):
                    item[field] = datetime.fromisoformat(value.replace("Z", "+00:00"))
            records.append(record_type(**item))
        session.add_all(records)
        session.flush()
