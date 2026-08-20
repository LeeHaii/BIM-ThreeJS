from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class OrganizationRecord(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="active")


class SiteRecord(Base):
    __tablename__ = "sites"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    timezone: Mapped[str] = mapped_column(String(80))
    locale: Mapped[str] = mapped_column(String(20))


class BuildingRecord(Base):
    __tablename__ = "buildings"
    __table_args__ = (UniqueConstraint("site_id", "code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"), index=True)
    code: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="active")
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class ModelRecord(Base):
    __tablename__ = "models"
    __table_args__ = (UniqueConstraint("building_id", "code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    building_id: Mapped[str] = mapped_column(ForeignKey("buildings.id"), index=True)
    code: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(200))
    purpose: Mapped[str] = mapped_column(String(60))


class ModelVersionRecord(Base):
    __tablename__ = "model_versions"
    __table_args__ = (
        UniqueConstraint("model_id", "version_label"),
        CheckConstraint("status in ('draft','verified','active','retired')"),
        Index(
            "ix_one_active_version_per_model",
            "model_id",
            unique=True,
            sqlite_where=text("status = 'active'"),
            postgresql_where=text("status = 'active'"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id"), index=True)
    version_label: Mapped[str] = mapped_column(String(100))
    source_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20))
    schema_version: Mapped[str] = mapped_column(String(20), default="1.0")
    converter_version: Mapped[str] = mapped_column(String(40))
    manifest: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UnitRecord(Base):
    __tablename__ = "units"
    __table_args__ = (
        UniqueConstraint("building_id", "code"),
        UniqueConstraint("id", "building_id"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    building_id: Mapped[str] = mapped_column(ForeignKey("buildings.id"), index=True)
    code: Mapped[str] = mapped_column(String(60))
    display_name: Mapped[str] = mapped_column(String(200))
    unit_type: Mapped[str] = mapped_column(String(80))
    storey_code: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(20), default="active")


class UserRecord(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    subject: Mapped[str] = mapped_column(String(200), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="active")


class UserBuildingAccessRecord(Base):
    __tablename__ = "user_building_access"
    __table_args__ = (UniqueConstraint("user_id", "building_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    building_id: Mapped[str] = mapped_column(ForeignKey("buildings.id"), index=True)
    role: Mapped[str] = mapped_column(String(40))


class PersonRecord(Base):
    __tablename__ = "people"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    display_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(60), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")


class OccupancyRecord(Base):
    __tablename__ = "occupancies"
    __table_args__ = (
        CheckConstraint("ends_at is null or ends_at > starts_at"),
        ForeignKeyConstraint(
            ["unit_id", "building_id"],
            ["units.id", "units.building_id"],
            name="fk_occupancy_unit_building",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    building_id: Mapped[str] = mapped_column(ForeignKey("buildings.id"), index=True)
    unit_id: Mapped[str] = mapped_column(String(36), index=True)
    person_id: Mapped[str] = mapped_column(ForeignKey("people.id"), index=True)
    relationship_type: Mapped[str] = mapped_column(String(80))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
