from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from bim_api.bootstrap.config import Settings
from bim_api.bootstrap.create_server import create_server
from bim_api.infrastructure.models import OccupancyRecord

ROOT = Path(__file__).resolve().parents[2]
ADMIN = "90000000-0000-4000-8000-000000000001"
OPERATOR = "90000000-0000-4000-8000-000000000002"
ALPHA = "11111111-1111-4111-8111-111111111111"
BETA = "12222222-2222-4222-8222-222222222222"
ALPHA_UNIT = "a1111111-1111-4111-8111-111111111101"


def client() -> TestClient:
    app = create_server(
        Settings(
            database_url="sqlite:///:memory:",
            allow_dev_auth=True,
            seed_path=ROOT / "database" / "seeds" / "synthetic" / "platform.json",
        )
    )
    return TestClient(app)


def test_catalog_is_scoped_to_actor_access() -> None:
    with client() as api:
        response = api.get("/api/v1/buildings", headers={"X-Actor-Id": OPERATOR})
        assert response.status_code == 200
        assert [item["id"] for item in response.json()["items"]] == [ALPHA]


def test_guessed_building_id_does_not_bypass_access() -> None:
    with client() as api:
        response = api.get(f"/api/v1/buildings/{BETA}", headers={"X-Actor-Id": OPERATOR})
        assert response.status_code == 404
        assert response.json()["code"] == "building_not_found"


def test_active_manifests_are_data_driven() -> None:
    with client() as api:
        alpha = api.get(
            f"/api/v1/buildings/{ALPHA}/models/active/manifest", headers={"X-Actor-Id": ADMIN}
        ).json()
        beta = api.get(
            f"/api/v1/buildings/{BETA}/models/active/manifest", headers={"X-Actor-Id": ADMIN}
        ).json()
        assert alpha["buildingId"] == ALPHA
        assert beta["buildingId"] == BETA
        assert len(alpha["fragmentLayers"]) != len(beta["fragmentLayers"])


def test_occupancy_fields_follow_role_policy_and_are_not_cached() -> None:
    with client() as api:
        operator = api.get(
            f"/api/v1/buildings/{ALPHA}/units/{ALPHA_UNIT}/occupancies",
            headers={"X-Actor-Id": OPERATOR},
        )
        admin = api.get(
            f"/api/v1/buildings/{ALPHA}/units/{ALPHA_UNIT}/occupancies",
            headers={"X-Actor-Id": ADMIN},
        )
        assert operator.headers["cache-control"] == "private, no-store"
        assert operator.json()[0]["displayName"] == "Synthetic Resident A"
        assert "email" not in operator.json()[0]
        assert admin.json()[0]["email"] == "resident.a@example.invalid"
        assert operator.json()[0]["startsAt"].endswith("Z")


def test_database_rejects_cross_building_occupancy() -> None:
    with client() as api:
        session = api.app.state.session_factory()
        try:
            session.add(
                OccupancyRecord(
                    id="70000000-0000-4000-8000-000000000099",
                    building_id=BETA,
                    unit_id=ALPHA_UNIT,
                    person_id="80000000-0000-4000-8000-000000000001",
                    relationship_type="invalid-cross-building",
                    starts_at=datetime.now(UTC),
                    status="active",
                )
            )
            with pytest.raises(IntegrityError):
                session.flush()
        finally:
            session.rollback()
            session.close()
