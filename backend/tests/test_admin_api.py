from pathlib import Path

from fastapi.testclient import TestClient

from bim_api.bootstrap.config import Settings
from bim_api.bootstrap.create_server import create_server

ROOT = Path(__file__).resolve().parents[2]
ADMIN = "90000000-0000-4000-8000-000000000001"
OPERATOR = "90000000-0000-4000-8000-000000000002"
ALPHA = "11111111-1111-4111-8111-111111111111"
TEST_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def client() -> TestClient:
    app = create_server(
        Settings(
            database_url="sqlite:///:memory:",
            allow_dev_auth=True,
            seed_path=ROOT / "database" / "seeds" / "synthetic" / "platform.json",
        )
    )
    return TestClient(app)


def test_building_detail_exposes_household_management_capabilities() -> None:
    with client() as api:
        admin = api.get(
            f"/api/v1/buildings/{ALPHA}",
            headers={"X-Actor-Id": ADMIN},
        )
        operator = api.get(
            f"/api/v1/buildings/{ALPHA}",
            headers={"X-Actor-Id": OPERATOR},
        )

        assert admin.status_code == 200
        assert admin.json()["permissions"] == {
            "manageUnits": True,
            "manageOccupancies": True,
        }
        assert operator.status_code == 200
        assert operator.json()["permissions"] == {
            "manageUnits": False,
            "manageOccupancies": False,
        }
        forbidden = api.get(
            f"/api/v1/admin/buildings/{ALPHA}/units/"
            "a1111111-1111-4111-8111-111111111101/occupancies",
            headers={"X-Actor-Id": OPERATOR},
        )
        assert forbidden.status_code == 403


def test_admin_can_create_and_delete_building() -> None:
    with client() as api:
        # Create building
        response = api.post(
            "/api/v1/admin/buildings",
            json={
                "code": "GAMMA",
                "name": "Residential Tower Gamma",
                "timezone": "UTC",
                "locale": "en",
            },
            headers={"X-Actor-Id": ADMIN},
        )
        assert response.status_code == 200
        data = response.json()
        building_id = data["id"]
        assert data["code"] == "GAMMA"
        assert data["name"] == "Residential Tower Gamma"

        # List buildings to verify it appears
        buildings = api.get("/api/v1/buildings", headers={"X-Actor-Id": ADMIN}).json()
        assert any(b["id"] == building_id for b in buildings["items"])

        # Delete building
        del_resp = api.delete(
            f"/api/v1/admin/buildings/{building_id}",
            headers={"X-Actor-Id": ADMIN},
        )
        assert del_resp.status_code == 200
        assert del_resp.json()["success"] is True

        # Verify not found anymore
        check_resp = api.get(f"/api/v1/buildings/{building_id}", headers={"X-Actor-Id": ADMIN})
        assert check_resp.status_code == 404


def test_admin_can_setup_models() -> None:
    with client() as api:
        response = api.post(
            f"/api/v1/admin/buildings/{ALPHA}/models/setup",
            json={
                "model_name": "Test Architectural",
                "ifc_asset_url": "/model-assets/test.frag",
                "ifc_byte_size": 12345,
                "ifc_content_hash": TEST_HASH,
                "env_name": "Test Environment",
                "env_asset_url": "/model-assets/test-env.glb",
                "env_byte_size": 67890,
                "env_content_hash": TEST_HASH,
            },
            headers={"X-Actor-Id": ADMIN},
        )
        assert response.status_code == 200
        manifest = response.json()
        assert manifest["schemaVersion"] == "2.0"
        assert len(manifest["layers"]) == 2
        assert manifest["layers"][0]["type"] == "fragments"
        assert manifest["layers"][1]["type"] == "gltf"


def test_admin_can_persist_the_active_scene_default_camera() -> None:
    pose = {
        "position": [12.5, 8.25, -4.75],
        "target": [1.0, 2.0, 3.0],
        "fov": 57.0,
    }
    with client() as api:
        response = api.put(
            f"/api/v1/admin/buildings/{ALPHA}/scenes/active/default-camera",
            json=pose,
            headers={"X-Actor-Id": ADMIN},
        )

        assert response.status_code == 200
        assert response.json()["settings"]["defaultCamera"] == pose

        scene = api.get(
            f"/api/v1/buildings/{ALPHA}/scenes/active/manifest",
            headers={"X-Actor-Id": ADMIN},
        )
        model = api.get(
            f"/api/v1/buildings/{ALPHA}/models/active/manifest",
            headers={"X-Actor-Id": ADMIN},
        )
        assert scene.json()["settings"]["defaultCamera"] == pose
        assert model.json()["defaultCamera"] == pose

        forbidden = api.put(
            f"/api/v1/admin/buildings/{ALPHA}/scenes/active/default-camera",
            json=pose,
            headers={"X-Actor-Id": OPERATOR},
        )
        assert forbidden.status_code == 403


def test_model_setup_imports_precomputed_unit_bindings() -> None:
    with client() as api:
        response = api.post(
            f"/api/v1/admin/buildings/{ALPHA}/models/setup",
            json={
                "model_name": "Bound Architectural Model",
                "ifc_asset_url": "/model-assets/bound.frag",
                "ifc_byte_size": 12345,
                "ifc_content_hash": TEST_HASH,
                "env_name": "Test Environment",
                "env_asset_url": "/model-assets/test-env.glb",
                "env_byte_size": 67890,
                "env_content_hash": TEST_HASH,
                "unit_binding_index": {
                    "schema_version": "1.0",
                    "source_hash": TEST_HASH,
                    "scanned_element_count": 1,
                    "bindings": [
                        {
                            "apartment_code": "A-0101",
                            "storey_code": "L01",
                            "express_id": 4201,
                            "global_id": "unit-a-0101",
                            "category": "IfcSlab",
                        }
                    ],
                },
            },
            headers={"X-Actor-Id": ADMIN},
        )
        assert response.status_code == 200
        assert response.json()["unitBindingSetId"]

        households = api.get(
            f"/api/v1/buildings/{ALPHA}/households",
            headers={"X-Actor-Id": ADMIN},
        )
        assert households.status_code == 200
        payload = households.json()
        assert payload["bindingSetId"] == response.json()["unitBindingSetId"]
        assert payload["coverage"] > 0
        floor = next(item for item in payload["storeys"] if item["code"] == "L01")
        unit = next(item for item in floor["units"] if item["code"] == "A-0101")
        assert unit["layerId"] == "layer-ifc-fragments"
        assert unit["modelLocalIds"] == [4201]


def test_admin_unit_and_occupancy_crud() -> None:
    with client() as api:
        # Create unit
        unit_resp = api.post(
            f"/api/v1/admin/buildings/{ALPHA}/units",
            json={
                "code": "A999",
                "display_name": "Penthouse 999",
                "unit_type": "apartment",
                "storey_code": "L09",
                "status": "active",
                "area": 250.0,
                "owner": "John Doe",
            },
            headers={"X-Actor-Id": ADMIN},
        )
        assert unit_resp.status_code == 200
        unit = unit_resp.json()
        unit_id = unit["id"]
        assert unit["code"] == "A999"
        assert unit["owner"] == "John Doe"

        # Update unit
        update_resp = api.put(
            f"/api/v1/admin/buildings/{ALPHA}/units/{unit_id}",
            json={
                "display_name": "Luxury Penthouse 999",
                "area": 280.0,
                "owner": None,
            },
            headers={"X-Actor-Id": ADMIN},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["displayName"] == "Luxury Penthouse 999"
        assert update_resp.json()["area"] == 280.0
        assert update_resp.json()["owner"] is None

        # Create occupancy
        occ_resp = api.post(
            f"/api/v1/admin/buildings/{ALPHA}/units/{unit_id}/occupancies",
            json={
                "display_name": "Alice Resident",
                "email": "alice@example.com",
                "phone": "+1234567890",
                "citizen_id": "ID987654321",
                "relationship_type": "owner",
                "residence_type": "permanent",
                "status": "active",
            },
            headers={"X-Actor-Id": ADMIN},
        )
        assert occ_resp.status_code == 200
        occ = occ_resp.json()
        occ_id = occ["id"]
        assert occ["displayName"] == "Alice Resident"
        assert occ["email"] == "alice@example.com"

        # List admin occupancies
        list_occ = api.get(
            f"/api/v1/admin/buildings/{ALPHA}/units/{unit_id}/occupancies",
            headers={"X-Actor-Id": ADMIN},
        ).json()
        assert len(list_occ) >= 1
        assert any(o["id"] == occ_id for o in list_occ)

        # Update occupancy
        up_occ = api.put(
            f"/api/v1/admin/buildings/{ALPHA}/occupancies/{occ_id}",
            json={"phone": "+9876543210", "email": None, "status": "active"},
            headers={"X-Actor-Id": ADMIN},
        )
        assert up_occ.status_code == 200
        assert up_occ.json()["phone"] == "+9876543210"
        assert up_occ.json()["email"] is None

        # Delete occupancy
        del_occ = api.delete(
            f"/api/v1/admin/buildings/{ALPHA}/occupancies/{occ_id}",
            headers={"X-Actor-Id": ADMIN},
        )
        assert del_occ.status_code == 200
        assert del_occ.json()["success"] is True

        # Delete unit
        del_unit = api.delete(
            f"/api/v1/admin/buildings/{ALPHA}/units/{unit_id}",
            headers={"X-Actor-Id": ADMIN},
        )
        assert del_unit.status_code == 200
        assert del_unit.json()["success"] is True
