import copy

from fastapi.testclient import TestClient

import crud
import models
import schemas
from main import app, _build_expected_certs_map, _zip_member_is_safe


client = TestClient(app)


def test_update_master_data_persists_ai_fields(db, monkeypatch):
    saved_json = {}
    monkeypatch.setattr(crud, "load_json_file", lambda _filename: {"static_field": "preserved"})
    monkeypatch.setattr(crud, "save_json_file", lambda _filename, data: saved_json.update(data) or True)

    updated = crud.update_master_data(
        db,
        schemas.MasterData(
            company_certs=["ISO 9001"],
            prof_certs=["AWS Architect"],
            requirement_labels=["REQ"],
            economic_formulas=[],
            rti_partners=["Partner A"],
            ai_enabled=True,
            ai_provider="groq",
            ai_models={"groq": "llama-3.1-70b-versatile"},
        ),
    )

    assert updated.ai_enabled is True
    assert updated.ai_provider == "groq"
    assert updated.ai_models == {"groq": "llama-3.1-70b-versatile"}
    assert saved_json["static_field"] == "preserved"
    assert saved_json["ai_enabled"] is True
    assert saved_json["ai_provider"] == "groq"
    assert saved_json["ai_models"] == {"groq": "llama-3.1-70b-versatile"}


def test_update_lot_state_filters_unknown_keys_and_invalid_statuses():
    config = client.get("/api/config").json()
    lot_key = "Lotto 1"
    lot = config[lot_key]
    valid_cert = lot["company_certs"][0]["label"]
    valid_req = lot["reqs"][0]["id"]

    response = client.post(
        "/api/config/state",
        params={"lot_key": lot_key},
        json={
            "my_discount": 12.0,
            "competitor_discount": 30.0,
            "competitor_tech_score": 60.0,
            "competitor_econ_discount": 25.0,
            "company_certs": {
                valid_cert: "all",
                "undefined": "none",
                "cert non lotto": "partial",
                valid_cert + " invalid": "invalid",
            },
            "tech_inputs": {
                valid_req: {"r_val": 1, "c_val": 1},
                "REQ_NON_ESISTENTE": {"r_val": 99, "c_val": 99},
            },
        },
    )

    assert response.status_code == 200, response.text
    state = client.get("/api/config").json()[lot_key]["state"]
    assert state["company_certs"] == {valid_cert: "all"}
    assert state["tech_inputs"] == {valid_req: {"r_val": 1, "c_val": 1}}


def test_expected_certs_map_uses_lot_reqs_selected_prof_certs():
    lot = models.LotConfigModel(
        name="Lotto Test",
        base_amount=1000,
        reqs=[
            {"id": "REQ_1", "selected_prof_certs": ["Cert A", "Cert B"]},
            {"id": "REQ_2", "selected_prof_certs": []},
            {"id": "REQ_3"},
        ],
    )

    assert _build_expected_certs_map(lot) == {"REQ_1": ["Cert A", "Cert B"]}


def test_zip_member_safety_rejects_sibling_prefix_escape(tmp_path):
    extract_dir = tmp_path / "extract"
    extract_dir.mkdir()

    assert _zip_member_is_safe(str(extract_dir), "folder/cert.pdf") is True
    assert _zip_member_is_safe(str(extract_dir), "../extract_evil/cert.pdf") is False


def test_config_validate_endpoint_reports_blocking_domain_errors():
    config = client.get("/api/config").json()
    lot = config["Lotto 1"]
    lot["reqs"][0]["prof_R"] = 1
    lot["reqs"][0]["prof_C"] = 2

    response = client.post("/api/config/validate", json={"Lotto 1": lot})

    assert response.status_code == 200, response.text
    body = response.json()["Lotto 1"]
    assert body["valid"] is False
    assert any(issue["code"] == "REQ_C_GT_R" for issue in body["issues"])


def test_update_config_rejects_blocking_domain_errors():
    config = client.get("/api/config").json()
    lot = config["Lotto 1"]
    lot["reqs"][0]["prof_R"] = 1
    lot["reqs"][0]["prof_C"] = 2

    response = client.post("/api/config", json={"Lotto 1": lot})

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["lot"] == "Lotto 1"
    assert any(issue["code"] == "REQ_C_GT_R" for issue in detail["issues"])


def test_update_config_rejects_invalid_batch_atomically():
    config = client.get("/api/config").json()
    valid_lot_key = "Lotto 1"
    invalid_lot_key = "Lotto 2"
    original_base_amount = config[valid_lot_key]["base_amount"]

    valid_lot = copy.deepcopy(config[valid_lot_key])
    valid_lot["base_amount"] = original_base_amount + 12345

    invalid_lot = copy.deepcopy(config[invalid_lot_key])
    invalid_lot["reqs"][0]["prof_R"] = 1
    invalid_lot["reqs"][0]["prof_C"] = 2

    response = client.post(
        "/api/config",
        json={
            valid_lot_key: valid_lot,
            invalid_lot_key: invalid_lot,
        },
    )

    assert response.status_code == 422
    persisted = client.get("/api/config").json()
    assert persisted[valid_lot_key]["base_amount"] == original_base_amount


def test_update_config_strips_stale_rti_quota_entries():
    config = client.get("/api/config").json()
    master_data = client.get("/api/master-data").json()
    partner = master_data["rti_partners"][0]

    original_lot = copy.deepcopy(config["Lotto 1"])
    lot = copy.deepcopy(original_lot)
    lot["rti_enabled"] = True
    lot["rti_companies"] = [partner]
    lot["rti_quotas"] = {
        "Lutech": 70.0,
        partner: 30.0,
        "GHOST SPA": 500.0,
    }

    try:
        response = client.post("/api/config", json={"Lotto 1": lot})

        assert response.status_code == 200, response.text
        saved = response.json()["Lotto 1"]
        assert saved["rti_quotas"] == {"Lutech": 70.0, partner: 30.0}
    finally:
        client.post("/api/config", json={"Lotto 1": original_lot})


def test_get_business_plan_returns_null_for_valid_lot_without_plan():
    response = client.get("/api/business-plan/Lotto%201")

    assert response.status_code == 200, response.text
    assert response.json() is None
