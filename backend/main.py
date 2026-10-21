import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from models import (
    Topology, ValidationResult, CriticalLinksResponse,
    PathRequest, PathResponse, FailureSimRequest, FailureSimResponse,
    RecommendationResponse, ComparisonResponse, LinkRiskPrediction, MLMetricsResponse,
    SubnetCalcRequest, SubnetCalcResponse, RouterRoutingTable,
    PingRequest, PingResponse, TracerouteRequest, TracerouteResponse,
    STPResponse, PacketSimulationRequest, PacketSimulationResponse
)
from network_analysis import validate_topology, find_critical_links, calculate_shortest_path, simulate_link_failure
from recommendations import generate_backup_recommendation, compare_connectivity
from ml_model import ml_service
from sample_data import get_sample_topology
from cn_protocols import (
    calculate_subnet, generate_router_routing_tables, simulate_ping,
    simulate_traceroute, simulate_stp, simulate_packet_walkthrough
)

app = FastAPI(
    title="AI-Based Network Resilience Planning and Optimization API",
    description="Backend services for topology management, graph connectivity, bridge analysis, CN protocol simulations, and ML risk prediction.",
    version="2.0.0"
)

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STORAGE_DIR = Path(__file__).resolve().parent / "saved_topologies"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "network-resilience-api", "version": "2.0.0"}

@app.get("/api/topology/sample", response_model=Topology)
def get_sample():
    """Returns the predefined 11-device campus topology."""
    return get_sample_topology()

@app.post("/api/topology/validate", response_model=ValidationResult)
def validate(topology: Topology):
    """Validates device IDs, IP addresses, isolated devices, and links."""
    return validate_topology(topology)

@app.post("/api/topology/save")
def save_topology(topology: Topology):
    """Saves topology configuration to JSON storage."""
    top_id = topology.id or "network-topology"
    filename = f"{top_id}.json"
    file_path = STORAGE_DIR / filename
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(topology.model_dump(), f, indent=2)
        return {"status": "success", "id": top_id, "message": f"Topology saved as '{filename}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save topology: {str(e)}")

@app.get("/api/topology/list")
def list_saved_topologies():
    """Lists saved topologies."""
    saved = []
    for file in STORAGE_DIR.glob("*.json"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                saved.append({
                    "id": data.get("id", file.stem),
                    "name": data.get("name", file.stem),
                    "device_count": len(data.get("devices", [])),
                    "link_count": len(data.get("links", []))
                })
        except Exception:
            continue
    return saved

@app.get("/api/topology/{top_id}", response_model=Topology)
def get_topology(top_id: str):
    """Retrieves saved topology by ID."""
    file_path = STORAGE_DIR / f"{top_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Topology not found")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return Topology(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading topology: {str(e)}")

@app.post("/api/analysis/critical-links", response_model=CriticalLinksResponse)
def analyze_critical_links(topology: Topology):
    """Calculates network bridges and affected nodes."""
    return find_critical_links(topology)

@app.post("/api/analysis/path", response_model=PathResponse)
def get_path(req: PathRequest):
    """Calculates lowest-cost path using Dijkstra's algorithm."""
    return calculate_shortest_path(req.topology, req.source_id, req.target_id)

@app.post("/api/analysis/failure", response_model=FailureSimResponse)
def simulate_failure(req: FailureSimRequest):
    """Simulates link failure and evaluates partition and alternate routes."""
    try:
        return simulate_link_failure(
            req.topology,
            req.failed_link_id,
            req.source_id,
            req.target_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/recommendations/backup-link", response_model=RecommendationResponse)
def recommend_backup_link(topology: Topology, failed_link_id: Optional[str] = None):
    """Identifies and ranks optimal backup links to improve resilience."""
    return generate_backup_recommendation(topology, failed_link_id)

class CompareRequest(BaseModel):
    before: Topology
    after: Topology

@app.post("/api/recommendations/compare", response_model=ComparisonResponse)
def compare_topologies(req: CompareRequest):
    """Compares connectivity metrics before and after backup link addition."""
    return compare_connectivity(req.before, req.after)

@app.post("/api/ml/predict", response_model=List[LinkRiskPrediction])
def predict_link_risks(topology: Topology):
    """Generates failure risk estimates for links in the topology."""
    dev_map = {d.id: d.name for d in topology.devices}
    predictions = []
    for link in topology.links:
        pred = ml_service.predict_link_risk(
            link,
            source_name=dev_map.get(link.source, link.source),
            target_name=dev_map.get(link.target, link.target)
        )
        predictions.append(pred)
    return predictions

@app.get("/api/ml/metrics", response_model=MLMetricsResponse)
def get_ml_metrics():
    """Returns model evaluation metrics (accuracy, precision, recall, F1)."""
    return ml_service.get_metrics()

# ==================== NEW CN PROTOCOL ENDPOINTS ====================

@app.post("/api/cn/subnet-calc", response_model=SubnetCalcResponse)
def subnet_calculator(req: SubnetCalcRequest):
    """Calculates CIDR subnets, host ranges, and tests subnet membership."""
    try:
        return calculate_subnet(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/cn/routing-tables", response_model=List[RouterRoutingTable])
def get_routing_tables(topology: Topology):
    """Generates routing tables for all routers in the topology."""
    return generate_router_routing_tables(topology)

@app.post("/api/cn/ping", response_model=PingResponse)
def ping_simulation(req: PingRequest):
    """Simulates ICMP ping between source and destination."""
    try:
        return simulate_ping(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/cn/traceroute", response_model=TracerouteResponse)
def traceroute_simulation(req: TracerouteRequest):
    """Simulates traceroute hop analysis between source and destination."""
    try:
        return simulate_traceroute(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/cn/stp-status", response_model=STPResponse)
def stp_simulation(topology: Topology):
    """Runs Spanning Tree Protocol (STP) root election and port state assignment."""
    return simulate_stp(topology)

@app.post("/api/cn/packet-simulation", response_model=PacketSimulationResponse)
def packet_simulation(req: PacketSimulationRequest):
    """Simulates step-by-step packet walkthrough with L2 MAC rewrite, L3 IP, and TCP/UDP states."""
    try:
        return simulate_packet_walkthrough(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
