import io
from pathlib import Path
from uuid import uuid4

import httpx

ADMIN_ACTOR = "90000000-0000-4000-8000-000000000001"
BASE_URL = "http://127.0.0.1:8000/api/v1"


def run_e2e_admin_test() -> None:
    client = httpx.Client(base_url=BASE_URL, headers={"X-Actor-Id": ADMIN_ACTOR}, timeout=10.0)

    print("=== 1. Testing Project Creation ===")
    proj_code = f"T{uuid4().hex[:6].upper()}"
    proj_name = f"Residential Tower {proj_code}"
    create_resp = client.post(
        "/admin/buildings",
        json={
            "name": proj_name,
            "code": proj_code,
            "timezone": "UTC",
            "locale": "en",
        },
    )
    assert create_resp.status_code == 200, f"Project creation failed: {create_resp.text}"
    project = create_resp.json()
    building_id = project["id"]
    print(f"[PASS] Created project {proj_code} with ID: {building_id}")

    print("\n=== 2. Testing 1 Real IFC Model + 1 GLTF Model Setup & Conversion ===")
    root_dir = Path(__file__).resolve().parents[2]
    ifc_path = root_dir / "model-pipeline" / "tests" / "fixtures" / "small.ifc"
    ifc_bytes = ifc_path.read_bytes()
    dummy_gltf = b"GLTF-BINARY-SYNTHETIC-ENVIRONMENT-DATA"

    files = {
        "ifc_file": ("small.ifc", io.BytesIO(ifc_bytes), "application/octet-stream"),
        "gltf_file": ("omega-environment.glb", io.BytesIO(dummy_gltf), "model/gltf-binary"),
    }
    data = {
        "model_name": "Tower Omega Architectural Model",
        "env_name": "Surrounding Urban Context",
    }
    upload_resp = client.post(
        f"/admin/buildings/{building_id}/models/upload",
        files=files,
        data=data,
        timeout=30.0,
    )
    assert upload_resp.status_code == 200, f"Model upload failed: {upload_resp.text}"
    manifest = upload_resp.json()
    assert manifest["schemaVersion"] == "2.0"
    assert len(manifest["layers"]) == 2
    assert manifest["layers"][0]["type"] == "fragments"
    assert manifest["layers"][1]["type"] == "gltf"
    print(f"[PASS] 3D Scene Manifest created & activated with {len(manifest['layers'])} layers")

    print("\n=== 3. Testing Active Scene Manifest Fetch ===")
    scene_resp = client.get(f"/buildings/{building_id}/scenes/active/manifest")
    assert scene_resp.status_code == 200
    assert scene_resp.json()["buildingId"] == building_id
    print("[PASS] Active scene manifest verified in public/operator API")

    print("\n=== 4. Testing Household / Space CRUD ===")
    # CREATE Unit
    unit_payload = {
        "code": "1001",
        "display_name": "Sky Penthouse 1001",
        "unit_type": "penthouse",
        "storey_code": "L10",
        "status": "active",
        "area": 320.5,
        "owner": "Marcus Vance",
        "certificate_number": "CERT-OMEGA-1001",
        "ownership_term": "Freehold",
    }
    create_unit_resp = client.post(f"/admin/buildings/{building_id}/units", json=unit_payload)
    assert create_unit_resp.status_code == 200
    unit = create_unit_resp.json()
    unit_id = unit["id"]
    print(f"[PASS] Created Space: {unit['displayName']} (Code: {unit['code']}, ID: {unit_id})")

    # READ Unit in search
    search_resp = client.get(f"/buildings/{building_id}/units?q=1001")
    assert search_resp.status_code == 200
    assert len(search_resp.json()["items"]) == 1
    print("[PASS] Space appears in search API")

    # UPDATE Unit
    update_payload = {
        "display_name": "Executive Sky Penthouse 1001",
        "area": 340.0,
    }
    update_unit_resp = client.put(
        f"/admin/buildings/{building_id}/units/{unit_id}",
        json=update_payload,
    )
    assert update_unit_resp.status_code == 200
    assert update_unit_resp.json()["displayName"] == "Executive Sky Penthouse 1001"
    assert update_unit_resp.json()["area"] == 340.0
    print("[PASS] Updated Space display name and area")

    print("\n=== 5. Testing Resident / Occupancy CRUD ===")
    # CREATE Occupancy / Resident
    occ_payload = {
        "display_name": "Marcus Vance",
        "email": "marcus.vance@example.com",
        "phone": "+1 555-0100",
        "citizen_id": "PASSPORT-US-987654",
        "date_of_birth": "1985-06-15",
        "gender": "male",
        "relationship_type": "owner",
        "residence_type": "permanent",
        "status": "active",
    }
    create_occ_resp = client.post(
        f"/admin/buildings/{building_id}/units/{unit_id}/occupancies",
        json=occ_payload,
    )
    assert create_occ_resp.status_code == 200
    occ = create_occ_resp.json()
    occ_id = occ["id"]
    print(f"[PASS] Registered Resident: {occ['displayName']} (ID: {occ_id})")

    # READ Admin Occupancies
    list_occ_resp = client.get(f"/admin/buildings/{building_id}/units/{unit_id}/occupancies")
    assert list_occ_resp.status_code == 200
    assert len(list_occ_resp.json()) == 1
    assert list_occ_resp.json()[0]["citizenId"] == "PASSPORT-US-987654"
    print("[PASS] Listed full resident details in Admin Occupancies endpoint")

    # UPDATE Occupancy
    up_occ_resp = client.put(
        f"/admin/buildings/{building_id}/occupancies/{occ_id}",
        json={"phone": "+1 555-0999", "email": "marcus.new@example.com"},
    )
    assert up_occ_resp.status_code == 200
    assert up_occ_resp.json()["phone"] == "+1 555-0999"
    assert up_occ_resp.json()["email"] == "marcus.new@example.com"
    print("[PASS] Updated resident contact details")

    # DELETE Occupancy
    del_occ_resp = client.delete(f"/admin/buildings/{building_id}/occupancies/{occ_id}")
    assert del_occ_resp.status_code == 200
    assert del_occ_resp.json()["success"] is True
    print("[PASS] Deleted resident occupancy")

    # DELETE Unit
    del_unit_resp = client.delete(f"/admin/buildings/{building_id}/units/{unit_id}")
    assert del_unit_resp.status_code == 200
    assert del_unit_resp.json()["success"] is True
    print("[PASS] Deleted Space / Apartment")

    # CLEANUP Delete Project
    del_proj_resp = client.delete(f"/admin/buildings/{building_id}")
    assert del_proj_resp.status_code == 200
    assert del_proj_resp.json()["success"] is True
    print("[PASS] Deleted Project cleanly")

    print("\n========================================================")
    print("SUCCESS: ALL END-TO-END ADMIN WORKFLOW TESTS PASSED 100%!")
    print("========================================================")


if __name__ == "__main__":
    run_e2e_admin_test()
