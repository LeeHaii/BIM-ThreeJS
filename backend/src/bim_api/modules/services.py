from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from bim_api.infrastructure.models import (
    BuildingRecord,
    ModelRecord,
    ModelVersionRecord,
    OccupancyRecord,
    OrganizationRecord,
    PersonRecord,
    SceneVersionRecord,
    SiteRecord,
    UnitBindingSetRecord,
    UnitModelBindingRecord,
    UnitRecord,
    UserBuildingAccessRecord,
)

from .authorization import Actor, AuthorizationService
from .common import ApiError
from .schemas import (
    AdminOccupancyView,
    BuildingDetail,
    BuildingSummary,
    CreateBuildingRequest,
    CreateOccupancyRequest,
    CreateUnitRequest,
    HouseholdIndexView,
    HouseholdStoreyView,
    HouseholdUnitView,
    OccupancyView,
    Page,
    SetupModelsRequest,
    UnitBindingImportView,
    UnitBindingIndexInput,
    UnitSummary,
    UpdateOccupancyRequest,
    UpdateUnitRequest,
)


def iso_utc(value: datetime) -> str:
    aware = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return aware.isoformat().replace("+00:00", "Z")


def parse_datetime(value: str | None) -> datetime:
    if value is None:
        return datetime.now(UTC)
    clean = value.replace("Z", "+00:00")
    return datetime.fromisoformat(clean)


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
        role = self.authorization.require_building_access(session, actor, building_id)
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
            permissions={
                "manageUnits": role == "facility_admin",
                "manageOccupancies": role == "facility_admin",
            },
        )

    def create(
        self, session: Session, actor: Actor, payload: CreateBuildingRequest
    ) -> BuildingDetail:
        code_normalized = payload.code.strip().upper()
        existing = session.scalar(
            select(BuildingRecord).where(BuildingRecord.code == code_normalized)
        )
        if existing is not None:
            raise ApiError(
                409, "duplicate_building_code", f"Building code '{code_normalized}' already exists"
            )

        site = session.scalar(select(SiteRecord).order_by(SiteRecord.name))
        if site is None:
            org = session.scalar(select(OrganizationRecord).order_by(OrganizationRecord.name))
            if org is None:
                org = OrganizationRecord(
                    id=str(uuid4()), name="Default Organization", status="active"
                )
                session.add(org)
                session.flush()
            site = SiteRecord(
                id=str(uuid4()),
                organization_id=org.id,
                name="Default Site",
                timezone=payload.timezone,
                locale=payload.locale,
            )
            session.add(site)
            session.flush()

        building_id = str(uuid4())
        building = BuildingRecord(
            id=building_id,
            site_id=site.id,
            code=code_normalized,
            name=payload.name.strip(),
            status="active",
            configuration={"features": {"bim": True, "households": True}},
        )
        session.add(building)
        access = UserBuildingAccessRecord(
            id=str(uuid4()),
            user_id=actor.id,
            building_id=building_id,
            role="facility_admin",
        )
        session.add(access)
        session.commit()

        return BuildingDetail(
            id=building.id,
            code=building.code,
            name=building.name,
            timezone=site.timezone,
            locale=site.locale,
            features={"bim": True, "households": True},
            active_model_version_id=None,
        )

    def delete(self, session: Session, actor: Actor, building_id: str) -> None:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(403, "forbidden", "Only facility administrators can delete buildings")

        # Delete related records
        session.query(OccupancyRecord).filter(OccupancyRecord.building_id == building_id).delete()
        model_version_ids = session.scalars(
            select(ModelVersionRecord.id)
            .join(ModelRecord, ModelRecord.id == ModelVersionRecord.model_id)
            .where(ModelRecord.building_id == building_id)
        ).all()
        binding_set_ids = session.scalars(
            select(UnitBindingSetRecord.id).where(
                UnitBindingSetRecord.model_version_id.in_(model_version_ids)
            )
        ).all()
        session.query(UnitModelBindingRecord).filter(
            UnitModelBindingRecord.binding_set_id.in_(binding_set_ids)
        ).delete(synchronize_session=False)
        session.query(UnitBindingSetRecord).filter(
            UnitBindingSetRecord.id.in_(binding_set_ids)
        ).delete(synchronize_session=False)
        session.query(UnitRecord).filter(UnitRecord.building_id == building_id).delete()
        session.query(SceneVersionRecord).filter(
            SceneVersionRecord.building_id == building_id
        ).delete()

        models = session.scalars(
            select(ModelRecord).where(ModelRecord.building_id == building_id)
        ).all()
        for model in models:
            session.query(ModelVersionRecord).filter(
                ModelVersionRecord.model_id == model.id
            ).delete()
        session.query(ModelRecord).filter(ModelRecord.building_id == building_id).delete()

        session.query(UserBuildingAccessRecord).filter(
            UserBuildingAccessRecord.building_id == building_id
        ).delete()
        session.query(BuildingRecord).filter(BuildingRecord.id == building_id).delete()
        session.commit()


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

    def get_active_scene_manifest(
        self, session: Session, actor: Actor, building_id: str
    ) -> dict[str, object]:
        self.authorization.require_building_access(session, actor, building_id)
        version = session.scalar(
            select(SceneVersionRecord).where(
                SceneVersionRecord.building_id == building_id,
                SceneVersionRecord.status == "active",
            )
        )
        if version is None:
            raise ApiError(404, "active_scene_not_found", "No active scene is available")
        return version.manifest

    def setup_models(
        self, session: Session, actor: Actor, building_id: str, payload: SetupModelsRequest
    ) -> dict[str, Any]:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(403, "forbidden", "Only facility administrators can configure models")

        building = session.get(BuildingRecord, building_id)
        if building is None:
            raise ApiError(404, "building_not_found", "Building was not found")

        model = session.scalar(select(ModelRecord).where(ModelRecord.building_id == building_id))
        if model is None:
            model = ModelRecord(
                id=str(uuid4()),
                building_id=building_id,
                code="architectural",
                name=payload.model_name,
                purpose="operations",
            )
            session.add(model)
            session.flush()
        else:
            model.name = payload.model_name

        # Retire existing active versions
        existing_model_versions = session.scalars(
            select(ModelVersionRecord).where(ModelVersionRecord.model_id == model.id)
        ).all()
        for mv in existing_model_versions:
            mv.status = "retired"
            binding_sets = session.scalars(
                select(UnitBindingSetRecord).where(
                    UnitBindingSetRecord.model_version_id == mv.id
                )
            ).all()
            for binding_set in binding_sets:
                binding_set.status = "retired"

        existing_scene_versions = session.scalars(
            select(SceneVersionRecord).where(SceneVersionRecord.building_id == building_id)
        ).all()
        for sv in existing_scene_versions:
            sv.status = "retired"

        model_version_id = str(uuid4())
        scene_version_id = str(uuid4())
        now = datetime.now(UTC)

        model_manifest = {
            "schemaVersion": "1.0",
            "buildingId": building_id,
            "modelId": model.id,
            "modelVersionId": model_version_id,
            "label": f"{payload.model_name} v1",
            "sourceHash": payload.ifc_content_hash,
            "defaultCamera": {
                "position": [28, 20, 28],
                "target": [0, 4, 0],
                "fov": 45,
            },
            "namedViews": [
                {
                    "id": "overview",
                    "label": "Overview",
                    "camera": {"position": [28, 20, 28], "target": [0, 4, 0], "fov": 45},
                }
            ],
            "fragmentLayers": [
                {
                    "id": "layer-ifc-fragments",
                    "name": payload.model_name,
                    "purpose": "architecture",
                    "asset": {
                        "assetId": model_version_id,
                        "url": payload.ifc_asset_url,
                        "contentHash": payload.ifc_content_hash,
                        "byteSize": payload.ifc_byte_size,
                    },
                    "transform": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                    "defaultVisible": True,
                }
            ],
            "capabilities": ["bim", "properties"],
            "compatibility": {
                "components": "3.4.8",
                "fragments": "3.4.7",
                "webIfc": "0.0.77",
            },
        }

        model_version = ModelVersionRecord(
            id=model_version_id,
            model_id=model.id,
            version_label=f"v-{now.strftime('%Y%m%d%H%M%S')}",
            source_hash=payload.ifc_content_hash,
            status="active",
            schema_version="1.0",
            converter_version="@thatopen/fragments@3.4.7",
            manifest=model_manifest,
            created_at=now,
            activated_at=now,
        )
        session.add(model_version)

        binding_set_id: str | None = None
        binding_index = payload.unit_binding_index
        if binding_index is not None and binding_index.bindings:
            units = session.scalars(
                select(UnitRecord).where(UnitRecord.building_id == building_id)
            ).all()
            units_by_code = {unit.code.strip().upper(): unit for unit in units}
            matched_unit_ids: set[str] = set()
            binding_records: list[UnitModelBindingRecord] = []
            candidate_binding_set_id = str(uuid4())
            for seed in binding_index.bindings:
                unit = units_by_code.get(seed.apartment_code.strip().upper())
                if unit is None:
                    continue
                matched_unit_ids.add(unit.id)
                if unit.area is None and seed.area is not None:
                    unit.area = seed.area
                binding_records.append(
                    UnitModelBindingRecord(
                        id=str(uuid4()),
                        binding_set_id=candidate_binding_set_id,
                        unit_id=unit.id,
                        layer_id="layer-ifc-fragments",
                        model_local_id=seed.express_id,
                        global_id=seed.global_id,
                        category=seed.category,
                    )
                )

            if binding_records:
                binding_set_id = candidate_binding_set_id
                coverage = len(matched_unit_ids) / len(units) if units else 0.0
                session.add(
                    UnitBindingSetRecord(
                        id=binding_set_id,
                        model_version_id=model_version_id,
                        source_hash=binding_index.source_hash,
                        status="active",
                        coverage=coverage,
                        created_at=now,
                    )
                )
                session.add_all(binding_records)
                model_manifest["capabilities"] = [
                    "bim",
                    "properties",
                    "unitBindings",
                ]

        scene_manifest: dict[str, Any] = {
            "schemaVersion": "2.0",
            "buildingId": building_id,
            "sceneVersionId": scene_version_id,
            "label": f"{building.name} 3D Scene",
            "runtimeCompatibility": {
                "components": "3.4.8",
                "componentsFront": "3.4.4",
                "fragments": "3.4.7",
                "three": "0.184.0",
                "webIfc": "0.0.77",
                "workerUrl": "/workers/fragments-worker.mjs",
                "wasmUrl": "/wasm/web-ifc.wasm",
            },
            "settings": {
                "background": {"color": "#eef2f5"},
                "lighting": {
                    "ambientColor": "#ffffff",
                    "ambientIntensity": 1.6,
                    "directionalColor": "#fff4df",
                    "directionalIntensity": 2.4,
                    "directionalPosition": [18, 32, 12],
                },
                "origin": {"policy": "coordinate-to-origin"},
                "defaultCamera": {
                    "position": [28, 20, 28],
                    "target": [0, 4, 0],
                    "fov": 45,
                },
                "namedViews": [
                    {
                        "id": "overview",
                        "label": "Overview",
                        "camera": {"position": [28, 20, 28], "target": [0, 4, 0], "fov": 45},
                    }
                ],
                "navigation": {
                    "minimumDistance": 1,
                    "maximumDistance": 500,
                    "verticalMinimum": -100,
                    "verticalMaximum": 200,
                },
            },
            "layers": [
                {
                    "id": "layer-ifc-fragments",
                    "assetVersionId": model_version_id,
                    "type": "fragments",
                    "purpose": "architecture",
                    "name": payload.model_name,
                    "assetUrl": payload.ifc_asset_url,
                    "contentHash": payload.ifc_content_hash,
                    "byteSize": payload.ifc_byte_size,
                    "transform": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                    "defaultVisible": True,
                    "selectable": True,
                    "castShadow": True,
                    "receiveShadow": True,
                    "bim": {
                        "modelId": model.id,
                        "modelVersionId": model_version_id,
                        "propertyProfileId": "standard-profile",
                    },
                },
                {
                    "id": "layer-gltf-context",
                    "assetVersionId": str(uuid4()),
                    "type": "gltf",
                    "purpose": "context",
                    "name": payload.env_name,
                    "assetUrl": payload.env_asset_url,
                    "contentHash": payload.env_content_hash,
                    "byteSize": payload.env_byte_size,
                    "transform": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                    "defaultVisible": True,
                    "selectable": False,
                    "castShadow": False,
                    "receiveShadow": True,
                },
            ],
            "bimProfiles": [
                {
                    "id": "standard-profile",
                    "ignoredKeys": ["GlobalId", "Tag", "OwnerHistory"],
                    "aliases": {
                        "Name": "Element Name",
                        "ObjectType": "Classification",
                        "PredefinedType": "Type",
                    },
                    "groups": ["Identity", "Geometry", "Quantities"],
                }
            ],
            "viewerUi": {
                "layout": "left-upper-viewport",
                "enabledModes": ["overview", "bim", "units"],
                "defaultMode": "overview",
                "collapsedLeftWidth": 44,
                "upperPanelHeight": 48,
                "modePanels": [
                    {
                        "mode": "bim",
                        "width": 420,
                        "buttonLabel": {"en": "BIM structure"},
                        "panelKind": "bim-properties",
                    },
                    {
                        "mode": "units",
                        "width": 720,
                        "buttonLabel": {"en": "Households"},
                        "panelKind": "households",
                    },
                ],
                "upperToolbar": [
                    {"id": "reset", "label": {"en": "Reset view"}},
                    {"id": "bim", "label": {"en": "BIM structure"}},
                    {"id": "households", "label": {"en": "Households"}},
                ],
                "touchNavigation": {"enabled": True, "defaultMode": "orbit"},
                "labels": {"collapse": {"en": "Collapse panel"}},
            },
        }

        if binding_set_id is not None:
            scene_manifest["unitBindingSetId"] = binding_set_id

        scene_version = SceneVersionRecord(
            id=scene_version_id,
            building_id=building_id,
            version_label=f"scene-{now.strftime('%Y%m%d%H%M%S')}",
            status="active",
            manifest=scene_manifest,
            release_notes="Configured via Admin Console",
            created_at=now,
            activated_at=now,
        )
        session.add(scene_version)
        session.commit()

        return scene_manifest

    def import_unit_bindings(
        self,
        session: Session,
        actor: Actor,
        building_id: str,
        payload: UnitBindingIndexInput,
    ) -> UnitBindingImportView:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(
                403,
                "forbidden",
                "Only facility administrators can import unit bindings",
            )

        model_version = session.scalar(
            select(ModelVersionRecord)
            .join(ModelRecord, ModelRecord.id == ModelVersionRecord.model_id)
            .where(
                ModelRecord.building_id == building_id,
                ModelVersionRecord.status == "active",
            )
        )
        if model_version is None:
            raise ApiError(404, "active_model_not_found", "No active model is available")

        units = session.scalars(
            select(UnitRecord).where(UnitRecord.building_id == building_id)
        ).all()
        units_by_code = {unit.code.strip().upper(): unit for unit in units}
        binding_set_id = str(uuid4())
        matched_unit_ids: set[str] = set()
        unmatched_codes: set[str] = set()
        bindings: list[UnitModelBindingRecord] = []

        for seed in payload.bindings:
            unit = units_by_code.get(seed.apartment_code.strip().upper())
            if unit is None:
                unmatched_codes.add(seed.apartment_code)
                continue
            matched_unit_ids.add(unit.id)
            if unit.area is None and seed.area is not None:
                unit.area = seed.area
            bindings.append(
                UnitModelBindingRecord(
                    id=str(uuid4()),
                    binding_set_id=binding_set_id,
                    unit_id=unit.id,
                    layer_id="layer-ifc-fragments",
                    model_local_id=seed.express_id,
                    global_id=seed.global_id,
                    category=seed.category,
                )
            )

        if not bindings:
            raise ApiError(
                422,
                "unit_bindings_unmatched",
                "The binding index did not match any apartment codes in this building",
            )

        active_sets = session.scalars(
            select(UnitBindingSetRecord).where(
                UnitBindingSetRecord.model_version_id == model_version.id,
                UnitBindingSetRecord.status == "active",
            )
        ).all()
        for active_set in active_sets:
            active_set.status = "retired"
        session.flush()

        coverage = len(matched_unit_ids) / len(units) if units else 0.0
        session.add(
            UnitBindingSetRecord(
                id=binding_set_id,
                model_version_id=model_version.id,
                source_hash=payload.source_hash,
                status="active",
                coverage=coverage,
                created_at=datetime.now(UTC),
            )
        )
        session.add_all(bindings)

        model_manifest = dict(model_version.manifest)
        capabilities = list(model_manifest.get("capabilities", []))
        if "unitBindings" not in capabilities:
            capabilities.append("unitBindings")
        model_manifest["capabilities"] = capabilities
        model_version.manifest = model_manifest

        scene_version = session.scalar(
            select(SceneVersionRecord).where(
                SceneVersionRecord.building_id == building_id,
                SceneVersionRecord.status == "active",
            )
        )
        if scene_version is not None:
            scene_manifest = dict(scene_version.manifest)
            scene_manifest["unitBindingSetId"] = binding_set_id
            scene_version.manifest = scene_manifest

        session.commit()
        return UnitBindingImportView(
            binding_set_id=binding_set_id,
            matched_unit_count=len(matched_unit_ids),
            binding_count=len(bindings),
            total_unit_count=len(units),
            coverage=coverage,
            unmatched_apartment_codes=sorted(unmatched_codes),
        )


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
                address=record.address,
                area=record.area,
                owner=record.owner,
                certificate_number=record.certificate_number,
                ownership_term=record.ownership_term,
            ).model_dump(by_alias=True, exclude_none=True)
            for record in records
        ]
        return Page(items=items, page=page, page_size=page_size, total=total)

    def household_index(
        self, session: Session, actor: Actor, building_id: str
    ) -> HouseholdIndexView:
        self.authorization.require_building_access(session, actor, building_id)
        model_version_id = session.scalar(
            select(ModelVersionRecord.id)
            .join(ModelRecord, ModelRecord.id == ModelVersionRecord.model_id)
            .where(
                ModelRecord.building_id == building_id,
                ModelVersionRecord.status == "active",
            )
        )
        binding_set = None
        if model_version_id is not None:
            binding_set = session.scalar(
                select(UnitBindingSetRecord).where(
                    UnitBindingSetRecord.model_version_id == model_version_id,
                    UnitBindingSetRecord.status == "active",
                )
            )

        bindings_by_unit: dict[str, list[UnitModelBindingRecord]] = {}
        if binding_set is not None:
            binding_records = session.scalars(
                select(UnitModelBindingRecord)
                .where(UnitModelBindingRecord.binding_set_id == binding_set.id)
                .order_by(UnitModelBindingRecord.model_local_id)
            ).all()
            for binding in binding_records:
                bindings_by_unit.setdefault(binding.unit_id, []).append(binding)

        units = session.scalars(
            select(UnitRecord)
            .where(UnitRecord.building_id == building_id, UnitRecord.status == "active")
            .order_by(UnitRecord.storey_code, UnitRecord.code)
        ).all()
        units_by_storey: dict[str, list[HouseholdUnitView]] = {}
        for unit in units:
            bindings = bindings_by_unit.get(unit.id, [])
            layer_id = bindings[0].layer_id if bindings else None
            units_by_storey.setdefault(unit.storey_code, []).append(
                HouseholdUnitView(
                    id=unit.id,
                    building_id=unit.building_id,
                    code=unit.code,
                    display_name=unit.display_name,
                    unit_type=unit.unit_type,
                    storey_code=unit.storey_code,
                    status=unit.status,
                    address=unit.address,
                    area=unit.area,
                    owner=unit.owner,
                    certificate_number=unit.certificate_number,
                    ownership_term=unit.ownership_term,
                    layer_id=layer_id,
                    model_local_ids=[binding.model_local_id for binding in bindings],
                    global_ids=[
                        binding.global_id
                        for binding in bindings
                        if binding.global_id is not None
                    ],
                )
            )

        def storey_sort_key(code: str) -> tuple[int, int | str]:
            digits = "".join(character for character in code if character.isdigit())
            if digits:
                basement = code.strip().upper().startswith("B")
                number = int(digits)
                return (0, -number if basement else number)
            return (1, code.casefold())

        storeys = []
        for code in sorted(units_by_storey, key=storey_sort_key):
            storey_units = units_by_storey[code]
            storeys.append(
                HouseholdStoreyView(
                    code=code,
                    label=f"Floor {code.removeprefix('L')}",
                    unit_count=len(storey_units),
                    bound_unit_count=sum(
                        1 for unit in storey_units if unit.model_local_ids
                    ),
                    units=storey_units,
                )
            )
        return HouseholdIndexView(
            building_id=building_id,
            model_version_id=model_version_id,
            binding_set_id=binding_set.id if binding_set is not None else None,
            coverage=binding_set.coverage if binding_set is not None else 0.0,
            storeys=storeys,
        )

    def create(
        self, session: Session, actor: Actor, building_id: str, payload: CreateUnitRequest
    ) -> UnitSummary:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(403, "forbidden", "Only facility administrators can manage units")

        code_clean = payload.code.strip().upper()
        existing = session.scalar(
            select(UnitRecord).where(
                UnitRecord.building_id == building_id, UnitRecord.code == code_clean
            )
        )
        if existing is not None:
            raise ApiError(
                409,
                "duplicate_unit_code",
                f"Unit code '{code_clean}' already exists in this building",
            )

        unit = UnitRecord(
            id=str(uuid4()),
            building_id=building_id,
            code=code_clean,
            display_name=payload.display_name.strip(),
            unit_type=payload.unit_type,
            storey_code=payload.storey_code.strip().upper(),
            status=payload.status,
            address=payload.address.strip() if payload.address else None,
            area=payload.area,
            owner=payload.owner.strip() if payload.owner else None,
            certificate_number=payload.certificate_number.strip()
            if payload.certificate_number
            else None,
            ownership_term=payload.ownership_term.strip() if payload.ownership_term else None,
        )
        session.add(unit)
        session.commit()

        return UnitSummary(
            id=unit.id,
            building_id=unit.building_id,
            code=unit.code,
            display_name=unit.display_name,
            unit_type=unit.unit_type,
            storey_code=unit.storey_code,
            status=unit.status,
            address=unit.address,
            area=unit.area,
            owner=unit.owner,
            certificate_number=unit.certificate_number,
            ownership_term=unit.ownership_term,
        )

    def update(
        self,
        session: Session,
        actor: Actor,
        building_id: str,
        unit_id: str,
        payload: UpdateUnitRequest,
    ) -> UnitSummary:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(403, "forbidden", "Only facility administrators can manage units")

        unit = session.scalar(
            select(UnitRecord).where(
                UnitRecord.id == unit_id, UnitRecord.building_id == building_id
            )
        )
        if unit is None:
            raise ApiError(404, "unit_not_found", "Unit was not found")

        if payload.code is not None:
            code_clean = payload.code.strip().upper()
            if code_clean != unit.code:
                existing = session.scalar(
                    select(UnitRecord).where(
                        UnitRecord.building_id == building_id,
                        UnitRecord.code == code_clean,
                        UnitRecord.id != unit_id,
                    )
                )
                if existing is not None:
                    raise ApiError(
                        409, "duplicate_unit_code", f"Unit code '{code_clean}' already exists"
                    )
                unit.code = code_clean

        if payload.display_name is not None:
            unit.display_name = payload.display_name.strip()
        if payload.unit_type is not None:
            unit.unit_type = payload.unit_type
        if payload.storey_code is not None:
            unit.storey_code = payload.storey_code.strip().upper()
        if payload.status is not None:
            unit.status = payload.status
        if "address" in payload.model_fields_set:
            unit.address = payload.address.strip() if payload.address else None
        if "area" in payload.model_fields_set:
            unit.area = payload.area
        if "owner" in payload.model_fields_set:
            unit.owner = payload.owner.strip() if payload.owner else None
        if "certificate_number" in payload.model_fields_set:
            unit.certificate_number = (
                payload.certificate_number.strip() if payload.certificate_number else None
            )
        if "ownership_term" in payload.model_fields_set:
            unit.ownership_term = payload.ownership_term.strip() if payload.ownership_term else None

        session.commit()
        return UnitSummary(
            id=unit.id,
            building_id=unit.building_id,
            code=unit.code,
            display_name=unit.display_name,
            unit_type=unit.unit_type,
            storey_code=unit.storey_code,
            status=unit.status,
            address=unit.address,
            area=unit.area,
            owner=unit.owner,
            certificate_number=unit.certificate_number,
            ownership_term=unit.ownership_term,
        )

    def delete(self, session: Session, actor: Actor, building_id: str, unit_id: str) -> None:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(403, "forbidden", "Only facility administrators can manage units")

        unit = session.scalar(
            select(UnitRecord).where(
                UnitRecord.id == unit_id, UnitRecord.building_id == building_id
            )
        )
        if unit is None:
            raise ApiError(404, "unit_not_found", "Unit was not found")

        session.query(OccupancyRecord).filter(
            OccupancyRecord.building_id == building_id, OccupancyRecord.unit_id == unit_id
        ).delete()
        session.query(UnitModelBindingRecord).filter(
            UnitModelBindingRecord.unit_id == unit_id
        ).delete()
        session.delete(unit)
        session.commit()

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
                citizen_id=person.citizen_id if "citizen_id" in fields else None,
                date_of_birth=person.date_of_birth if "date_of_birth" in fields else None,
                gender=person.gender if "gender" in fields else None,
                residence_type=occupancy.residence_type,
                status=occupancy.status,
                starts_at=iso_utc(occupancy.starts_at),
                ends_at=iso_utc(occupancy.ends_at) if occupancy.ends_at is not None else None,
            )
            for occupancy, person in rows
        ]

    def list_admin_occupancies(
        self, session: Session, actor: Actor, building_id: str, unit_id: str
    ) -> list[AdminOccupancyView]:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(
                403, "forbidden", "Only facility administrators can manage resident records"
            )

        rows = session.execute(
            select(OccupancyRecord, PersonRecord)
            .join(PersonRecord, PersonRecord.id == OccupancyRecord.person_id)
            .where(
                OccupancyRecord.building_id == building_id,
                OccupancyRecord.unit_id == unit_id,
            )
            .order_by(OccupancyRecord.starts_at.desc())
        ).all()
        return [
            AdminOccupancyView(
                id=occupancy.id,
                unit_id=occupancy.unit_id,
                person_id=person.id,
                relationship_type=occupancy.relationship_type,
                display_name=person.display_name,
                email=person.email,
                phone=person.phone,
                citizen_id=person.citizen_id,
                date_of_birth=person.date_of_birth,
                gender=person.gender,
                residence_type=occupancy.residence_type,
                status=occupancy.status,
                starts_at=iso_utc(occupancy.starts_at),
                ends_at=iso_utc(occupancy.ends_at) if occupancy.ends_at is not None else None,
            )
            for occupancy, person in rows
        ]

    def create_occupancy(
        self,
        session: Session,
        actor: Actor,
        building_id: str,
        unit_id: str,
        payload: CreateOccupancyRequest,
    ) -> AdminOccupancyView:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(
                403, "forbidden", "Only facility administrators can manage resident records"
            )

        unit = session.scalar(
            select(UnitRecord).where(
                UnitRecord.id == unit_id, UnitRecord.building_id == building_id
            )
        )
        if unit is None:
            raise ApiError(404, "unit_not_found", "Unit was not found")

        building = session.get(BuildingRecord, building_id)
        site = session.get(SiteRecord, building.site_id) if building else None
        org_id = site.organization_id if site else str(uuid4())

        person = PersonRecord(
            id=str(uuid4()),
            organization_id=org_id,
            display_name=payload.display_name.strip(),
            email=payload.email.strip() if payload.email else None,
            phone=payload.phone.strip() if payload.phone else None,
            citizen_id=payload.citizen_id.strip() if payload.citizen_id else None,
            date_of_birth=payload.date_of_birth.strip() if payload.date_of_birth else None,
            gender=payload.gender.strip() if payload.gender else None,
            status=payload.status,
        )
        session.add(person)
        session.flush()

        starts_at = parse_datetime(payload.starts_at)
        ends_at = parse_datetime(payload.ends_at) if payload.ends_at else None

        occupancy = OccupancyRecord(
            id=str(uuid4()),
            building_id=building_id,
            unit_id=unit_id,
            person_id=person.id,
            relationship_type=payload.relationship_type,
            residence_type=payload.residence_type,
            starts_at=starts_at,
            ends_at=ends_at,
            status=payload.status,
        )
        session.add(occupancy)
        session.commit()

        return AdminOccupancyView(
            id=occupancy.id,
            unit_id=occupancy.unit_id,
            person_id=person.id,
            relationship_type=occupancy.relationship_type,
            display_name=person.display_name,
            email=person.email,
            phone=person.phone,
            citizen_id=person.citizen_id,
            date_of_birth=person.date_of_birth,
            gender=person.gender,
            residence_type=occupancy.residence_type,
            status=occupancy.status,
            starts_at=iso_utc(occupancy.starts_at),
            ends_at=iso_utc(occupancy.ends_at) if occupancy.ends_at is not None else None,
        )

    def update_occupancy(
        self,
        session: Session,
        actor: Actor,
        building_id: str,
        occupancy_id: str,
        payload: UpdateOccupancyRequest,
    ) -> AdminOccupancyView:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(
                403, "forbidden", "Only facility administrators can manage resident records"
            )

        occupancy = session.scalar(
            select(OccupancyRecord).where(
                OccupancyRecord.id == occupancy_id, OccupancyRecord.building_id == building_id
            )
        )
        if occupancy is None:
            raise ApiError(404, "occupancy_not_found", "Occupancy record was not found")

        person = session.get(PersonRecord, occupancy.person_id)
        if person is not None:
            if payload.display_name is not None:
                person.display_name = payload.display_name.strip()
            if "email" in payload.model_fields_set:
                person.email = payload.email.strip() if payload.email else None
            if "phone" in payload.model_fields_set:
                person.phone = payload.phone.strip() if payload.phone else None
            if "citizen_id" in payload.model_fields_set:
                person.citizen_id = payload.citizen_id.strip() if payload.citizen_id else None
            if "date_of_birth" in payload.model_fields_set:
                person.date_of_birth = (
                    payload.date_of_birth.strip() if payload.date_of_birth else None
                )
            if "gender" in payload.model_fields_set:
                person.gender = payload.gender.strip() if payload.gender else None

        if payload.relationship_type is not None:
            occupancy.relationship_type = payload.relationship_type
        if "residence_type" in payload.model_fields_set:
            occupancy.residence_type = (
                payload.residence_type.strip() if payload.residence_type else None
            )
        if payload.status is not None:
            occupancy.status = payload.status
        if payload.starts_at is not None:
            occupancy.starts_at = parse_datetime(payload.starts_at)
        if "ends_at" in payload.model_fields_set:
            occupancy.ends_at = parse_datetime(payload.ends_at) if payload.ends_at else None

        session.commit()
        return AdminOccupancyView(
            id=occupancy.id,
            unit_id=occupancy.unit_id,
            person_id=person.id if person else "",
            relationship_type=occupancy.relationship_type,
            display_name=person.display_name if person else None,
            email=person.email if person else None,
            phone=person.phone if person else None,
            citizen_id=person.citizen_id if person else None,
            date_of_birth=person.date_of_birth if person else None,
            gender=person.gender if person else None,
            residence_type=occupancy.residence_type,
            status=occupancy.status,
            starts_at=iso_utc(occupancy.starts_at),
            ends_at=iso_utc(occupancy.ends_at) if occupancy.ends_at is not None else None,
        )

    def delete_occupancy(
        self, session: Session, actor: Actor, building_id: str, occupancy_id: str
    ) -> None:
        role = self.authorization.require_building_access(session, actor, building_id)
        if role != "facility_admin":
            raise ApiError(
                403, "forbidden", "Only facility administrators can manage resident records"
            )

        occupancy = session.scalar(
            select(OccupancyRecord).where(
                OccupancyRecord.id == occupancy_id, OccupancyRecord.building_id == building_id
            )
        )
        if occupancy is None:
            raise ApiError(404, "occupancy_not_found", "Occupancy record was not found")

        person_id = occupancy.person_id
        session.delete(occupancy)

        # Clean up person if no other occupancies
        remaining = session.scalar(
            select(func.count())
            .select_from(OccupancyRecord)
            .where(OccupancyRecord.person_id == person_id)
        )
        if remaining == 0:
            person = session.get(PersonRecord, person_id)
            if person:
                session.delete(person)

        session.commit()
