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
    assert len(data["links"]) >= 11
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
    critical_link_ids = [cl["link_id"] for cl in data["critical_links"]]
    assert any(cid in critical_link_ids for cid in ["l_r2_sw3", "l_sw3_db", "l_sw1_hr"])

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
    req = {
        "topology": sample.model_dump(),
        "failed_link_id": "l_sw3_db",
        "source_id": "pc_hr",
        "target_id": "srv_db"
    }
    response = client.post("/api/analysis/failure", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["is_critical"] is True
    assert len(data["affected_devices"]) > 0

def test_simulate_redundant_link_failure_alternate_route():
    sample = get_sample_topology()
    req = {
        "topology": sample.model_dump(),
        "failed_link_id": "l_r1_sw2",
        "source_id": "pc_it",
        "target_id": "r1"
    }
    response = client.post("/api/analysis/failure", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["alternate_path_exists"] is True

def test_recommend_and_apply_backup_link():
    sample = get_sample_topology()
    for l in sample.links:
        if l.id == "l_sw3_db":
            l.status = "failed"
            
    response = client.post("/api/recommendations/backup-link?failed_link_id=l_sw3_db", json=sample.model_dump())
    assert response.status_code == 200
    rec = response.json()
    assert rec["recommendation_available"] is True
    recommended = rec["recommended_link"]
    assert recommended is not None

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
    metrics_resp = client.get("/api/ml/metrics")
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()
    assert metrics["accuracy"] > 0.70
    assert "disclaimer" in metrics

    sample = get_sample_topology()
    pred_resp = client.post("/api/ml/predict", json=sample.model_dump())
    assert pred_resp.status_code == 200
    predictions = pred_resp.json()
    assert len(predictions) == len(sample.links)
    for p in predictions:
        assert p["risk_level"] in ["Low", "Medium", "High"]
        assert 0.0 <= p["failure_probability"] <= 1.0

# ==================== NEW CN PROTOCOL TESTS ====================

def test_subnet_calculator_success():
    req = {
        "ip": "192.168.10.15",
        "cidr": 24,
        "device_a_ip": "192.168.10.20",
        "device_b_ip": "192.168.10.99",
        "gateway_ip": "192.168.10.1"
    }
    resp = client.post("/api/cn/subnet-calc", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["network_address"] == "192.168.10.0"
    assert data["netmask"] == "255.255.255.0"
    assert data["broadcast_address"] == "192.168.10.255"
    assert data["usable_hosts"] == 254
    assert data["same_subnet_test"] is True
    assert data["gateway_valid_test"] is True

def test_subnet_calculator_different_subnets():
    req = {
        "ip": "192.168.10.1",
        "cidr": 24,
        "device_a_ip": "192.168.10.11",
        "device_b_ip": "192.168.20.15"  # Different subnet!
    }
    resp = client.post("/api/cn/subnet-calc", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["same_subnet_test"] is False

def test_routing_tables_generation():
    sample = get_sample_topology()
    resp = client.post("/api/cn/routing-tables", json=sample.model_dump())
    assert resp.status_code == 200
    tables = resp.json()
    assert len(tables) == 2  # 2 routers (r1 and r2)
    r1_table = next(t for t in tables if t["router_id"] == "r1")
    assert len(r1_table["routes"]) > 0
    assert any(r["route_type"] in ["Connected", "Dijkstra-OSPF"] for r in r1_table["routes"])

def test_ping_simulation_successful():
    sample = get_sample_topology()
    req = {
        "topology": sample.model_dump(),
        "source_id": "pc_hr",
        "target_id": "srv_web",
        "packet_count": 4
    }
    resp = client.post("/api/cn/ping", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["reachable"] is True
    assert data["packet_loss_percent"] == 0.0
    assert len(data["probes"]) == 4
    assert data["avg_rtt_ms"] > 0

def test_traceroute_simulation():
    sample = get_sample_topology()
    req = {
        "topology": sample.model_dump(),
        "source_id": "pc_hr",
        "target_id": "srv_web"
    }
    resp = client.post("/api/cn/traceroute", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["completed"] is True
    assert data["total_hops"] >= 3
    assert len(data["hops"]) == data["total_hops"]

def test_stp_simulation():
    sample = get_sample_topology()
    resp = client.post("/api/cn/stp-status", json=sample.model_dump())
    assert resp.status_code == 200
    data = resp.json()
    assert data["root_bridge_id"] != ""
    assert len(data["switches"]) == 3
    # SW2 has lowest priority 28672 so it should be the Root Bridge
    assert data["root_bridge_id"] == "sw2"

def test_packet_simulation_tcp():
    sample = get_sample_topology()
    req = {
        "topology": sample.model_dump(),
        "source_id": "pc_hr",
        "target_id": "srv_web",
        "protocol": "TCP",
        "dest_port": 80
    }
    resp = client.post("/api/cn/packet-simulation", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["steps"]) >= 4
    assert data["three_way_handshake"] is not None
    assert len(data["three_way_handshake"]) == 3
