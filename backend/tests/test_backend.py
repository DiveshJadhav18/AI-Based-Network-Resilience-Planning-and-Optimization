import pytest
from fastapi.testclient import TestClient
from main import app
from sample_data import get_sample_topology
from models import Topology, Device, Link
from ml_model import ml_service

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_load_sample_topology():
    response = client.get("/api/topology/sample")
    assert response.status_code == 200
    data = response.json()
    assert len(data["devices"]) == 11
    assert len(data["links"]) == 11
    assert any(d["name"] == "Core Router R1" for d in data["devices"])

def test_create_custom_topology_and_validate():
    custom_top = Topology(
        id="test-custom",
        name="Test Net",
        devices=[
            Device(id="d1", name="Router 1", type="router", ip="10.0.0.1"),
            Device(id="d2", name="PC 1", type="pc", ip="10.0.0.2"),
        ],
        links=[
            Link(id="l1", source="d1", target="d2", cost=1.0, latency=2.0, bandwidth=100.0)
        ]
    )
    response = client.post("/api/topology/validate", json=custom_top.model_dump())
    assert response.status_code == 200
    res = response.json()
    assert res["is_valid"] is True
    assert len(res["issues"]) == 0

def test_validate_duplicate_ip_and_isolated_devices():
    bad_top = Topology(
        id="bad-top",
        devices=[
            Device(id="d1", name="Router 1", type="router", ip="192.168.1.1"),
            Device(id="d2", name="Router 2", type="router", ip="192.168.1.1"),  # Duplicate IP
            Device(id="d3", name="Isolated PC", type="pc", ip="192.168.1.5"),   # Isolated
        ],
        links=[
            Link(id="l1", source="d1", target="d2", cost=1.0)
        ]
    )
    response = client.post("/api/topology/validate", json=bad_top.model_dump())
    assert response.status_code == 200
    res = response.json()
    issues = res["issues"]
    assert any(i["code"] == "DUPLICATE_IP_ADDRESS" for i in issues)
    assert any(i["code"] == "ISOLATED_DEVICE" for i in issues)

def test_detect_critical_links():
    sample = get_sample_topology()
    response = client.post("/api/analysis/critical-links", json=sample.model_dump())
    assert response.status_code == 200
    data = response.json()
    assert data["critical_link_count"] > 0
    # In sample network, links to terminal PCs or SW1 must be bridges
    critical_link_ids = [cl["link_id"] for cl in data["critical_links"]]
    assert "l_r1_sw1" in critical_link_ids or "l_sw1_hr" in critical_link_ids

def test_find_shortest_path():
    sample = get_sample_topology()
    req = {
        "topology": sample.model_dump(),
        "source_id": "pc_hr",
        "target_id": "srv_web"
    }
    response = client.post("/api/analysis/path", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["exists"] is True
    assert data["source_id"] == "pc_hr"
    assert data["target_id"] == "srv_web"
    assert data["hop_count"] >= 3
    assert data["total_cost"] > 0
    assert data["total_latency"] > 0

def test_unreachable_destination():
    sample = get_sample_topology()
    # Add an unconnected isolated node
    sample.devices.append(Device(id="isolated_pc", name="Island PC", type="pc", ip="10.99.99.1"))
    req = {
        "topology": sample.model_dump(),
        "source_id": "pc_hr",
        "target_id": "isolated_pc"
    }
    response = client.post("/api/analysis/path", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["exists"] is False
    assert "No route exists" in data["message"]

def test_simulate_critical_link_failure():
    sample = get_sample_topology()
    # Fail l_r1_sw1 which partitions HR switch SW1 from core router
    req = {
        "topology": sample.model_dump(),
        "failed_link_id": "l_r1_sw1",
        "source_id": "pc_hr",
        "target_id": "srv_web"
    }
    response = client.post("/api/analysis/failure", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["is_critical"] is True
    assert len(data["affected_devices"]) > 0
    assert data["alternate_path_exists"] is False

def test_simulate_redundant_link_failure_alternate_route():
    sample = get_sample_topology()
    # l_r1_sw2 connects R1 to SW2, but R2 also connects to SW2 (l_r2_sw2) and R1 is connected to R2 (l_r1_r2)
    req = {
        "topology": sample.model_dump(),
        "failed_link_id": "l_r1_sw2",
        "source_id": "pc_it",
        "target_id": "r1"
    }
    response = client.post("/api/analysis/failure", json=req)
    assert response.status_code == 200
    data = response.json()
    # There should be an alternate route via r2
    assert data["alternate_path_exists"] is True

def test_recommend_and_apply_backup_link():
    sample = get_sample_topology()
    # Simulate SW1 partition by marking l_r1_sw1 failed
    for l in sample.links:
        if l.id == "l_r1_sw1":
            l.status = "failed"
            
    # Request recommendation
    response = client.post("/api/recommendations/backup-link?failed_link_id=l_r1_sw1", json=sample.model_dump())
    assert response.status_code == 200
    rec = response.json()
    assert rec["recommendation_available"] is True
    recommended = rec["recommended_link"]
    assert recommended is not None
    
    # Apply recommendation to topology
    new_link = Link(
        id=f"backup_{recommended['source_id']}_{recommended['target_id']}",
        source=recommended["source_id"],
        target=recommended["target_id"],
        cost=recommended["cost"],
        latency=recommended["latency"],
        bandwidth=recommended["bandwidth"],
        status="active"
    )
    sample_after = sample.model_copy(deep=True)
    sample_after.links.append(new_link)

    # Compare connectivity before and after
    comp_req = {
        "before": sample.model_dump(),
        "after": sample_after.model_dump()
    }
    comp_resp = client.post("/api/recommendations/compare", json=comp_req)
    assert comp_resp.status_code == 200
    comparison = comp_resp.json()
    assert comparison["after"]["connected_components"] <= comparison["before"]["connected_components"]

def test_save_and_load_topology():
    sample = get_sample_topology()
    sample.id = "pytest-sample-save"
    save_resp = client.post("/api/topology/save", json=sample.model_dump())
    assert save_resp.status_code == 200
    
    load_resp = client.get(f"/api/topology/{sample.id}")
    assert load_resp.status_code == 200
    loaded = load_resp.json()
    assert loaded["id"] == "pytest-sample-save"
    assert len(loaded["devices"]) == len(sample.devices)

def test_ml_risk_prediction_and_metrics():
    # Test metrics endpoint
    metrics_resp = client.get("/api/ml/metrics")
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()
    assert metrics["accuracy"] > 0.70
    assert "disclaimer" in metrics

    # Test predict endpoint with sample
    sample = get_sample_topology()
    pred_resp = client.post("/api/ml/predict", json=sample.model_dump())
    assert pred_resp.status_code == 200
    predictions = pred_resp.json()
    assert len(predictions) == len(sample.links)
    for p in predictions:
        assert p["risk_level"] in ["Low", "Medium", "High"]
        assert 0.0 <= p["failure_probability"] <= 1.0
