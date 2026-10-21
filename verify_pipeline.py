import httpx
import json

BASE_URL = "http://127.0.0.1:8000"

def test_full_pipeline():
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)
    
    # 1. Health
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("[PASS] 1. /api/health")

    # 2. Sample Topology
    r = client.get("/api/topology/sample")
    assert r.status_code == 200, f"Sample load failed: {r.text}"
    sample = r.json()
    assert len(sample["devices"]) == 11
    assert len(sample["links"]) == 11
    print(f"[PASS] 2. /api/topology/sample (Loaded {len(sample['devices'])} devices, {len(sample['links'])} links)")

    # 3. Validate
    r = client.post("/api/topology/validate", json=sample)
    assert r.status_code == 200
    val_data = r.json()
    assert val_data["is_valid"] is True
    print(f"[PASS] 3. /api/topology/validate (Valid: {val_data['is_valid']})")

    # 4. Critical Links
    r = client.post("/api/analysis/critical-links", json=sample)
    assert r.status_code == 200
    crit_data = r.json()
    assert crit_data["critical_link_count"] > 0
    print(f"[PASS] 4. /api/analysis/critical-links (Found {crit_data['critical_link_count']} bridge links)")

    # 5. Shortest Path (Dijkstra)
    r = client.post("/api/analysis/path", json={
        "topology": sample,
        "source_id": "pc_hr",
        "target_id": "srv_web"
    })
    assert r.status_code == 200
    path_data = r.json()
    assert path_data["exists"] is True
    print(f"[PASS] 5. /api/analysis/path (Path: {' -> '.join(path_data['path_node_names'])}, cost: {path_data['total_cost']})")

    # 6. Failure Simulation
    r = client.post("/api/analysis/failure", json={
        "topology": sample,
        "failed_link_id": "l_r1_sw1",
        "source_id": "pc_hr",
        "target_id": "srv_web"
    })
    assert r.status_code == 200
    fail_data = r.json()
    assert fail_data["is_critical"] is True
    print(f"[PASS] 6. /api/analysis/failure (Bridge failure detected: affected {len(fail_data['affected_devices'])} devices)")

    # 7. Backup Link Recommendation
    r = client.post("/api/recommendations/backup-link?failed_link_id=l_r1_sw1", json=sample)
    assert r.status_code == 200
    rec_data = r.json()
    assert rec_data["recommendation_available"] is True
    rec = rec_data["recommended_link"]
    print(f"[PASS] 7. /api/recommendations/backup-link (Recommended link: {rec['source_name']} <-> {rec['target_name']})")

    # 8. Compare connectivity before vs after backup link
    sample_after = json.loads(json.dumps(sample))
    sample_after["links"].append({
        "id": "backup-rec-test",
        "source": rec["source_id"],
        "target": rec["target_id"],
        "cost": rec["cost"],
        "latency": rec["latency"],
        "bandwidth": rec["bandwidth"],
        "status": "active"
    })
    r = client.post("/api/recommendations/compare", json={
        "before": sample,
        "after": sample_after
    })
    assert r.status_code == 200
    comp_data = r.json()
    assert comp_data["after"]["critical_links_count"] <= comp_data["before"]["critical_links_count"]
    print(f"[PASS] 8. /api/recommendations/compare (Before bridges: {comp_data['before']['critical_links_count']}, After: {comp_data['after']['critical_links_count']})")

    # 9. ML Metrics
    r = client.get("/api/ml/metrics")
    assert r.status_code == 200
    ml_metrics = r.json()
    assert ml_metrics["accuracy"] > 0.70
    print(f"[PASS] 9. /api/ml/metrics (Model accuracy: {ml_metrics['accuracy'] * 100:.1f}%)")

    # 10. ML Predictions
    r = client.post("/api/ml/predict", json=sample)
    assert r.status_code == 200
    predictions = r.json()
    assert len(predictions) == len(sample["links"])
    print(f"[PASS] 10. /api/ml/predict (Generated risk scores for all {len(predictions)} links)")

    print("\nALL 10 API PIPELINE VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_pipeline()
