from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Device(BaseModel):
    id: str = Field(..., description="Unique device ID")
    name: str = Field(..., description="Device label/name")
    type: str = Field(..., description="Device type: router, switch, pc, server")
    ip: Optional[str] = Field(None, description="IPv4 address if applicable")
    x: Optional[float] = Field(None, description="X coordinate on canvas")
    y: Optional[float] = Field(None, description="Y coordinate on canvas")

class Link(BaseModel):
    id: str = Field(..., description="Unique link ID")
    source: str = Field(..., description="Source device ID")
    target: str = Field(..., description="Target/Destination device ID")
    cost: float = Field(1.0, ge=0.1, description="Routing cost / weight")
    latency: float = Field(5.0, ge=0.1, description="Link latency in milliseconds")
    bandwidth: float = Field(100.0, ge=1.0, description="Bandwidth in Mbps")
    status: str = Field("active", description="Status: 'active' or 'failed'")
    
    # Optional performance metrics for ML failure risk
    utilization: Optional[float] = Field(45.0, description="Link utilization percentage (0-100)")
    packet_loss: Optional[float] = Field(0.5, description="Packet loss percentage (0-100)")
    failure_history: Optional[int] = Field(0, description="Past failure count")
    age_months: Optional[int] = Field(12, description="Age of link hardware/cable in months")

class Topology(BaseModel):
    id: Optional[str] = "default-topology"
    name: Optional[str] = "Network Topology"
    devices: List[Device] = []
    links: List[Link] = []

class ValidationIssue(BaseModel):
    type: str  # 'error' or 'warning'
    code: str
    message: str
    target_id: Optional[str] = None

class ValidationResult(BaseModel):
    is_valid: bool
    issues: List[ValidationIssue] = []

class CriticalLinkInfo(BaseModel):
    link_id: str
    source: str
    target: str
    source_name: str
    target_name: str
    affected_device_count: int
    affected_devices: List[str]
    explanation: str

class CriticalLinksResponse(BaseModel):
    critical_links: List[CriticalLinkInfo]
    total_links: int
    critical_link_count: int
    connected_components_count: int
    is_fully_connected: bool

class PathRequest(BaseModel):
    topology: Topology
    source_id: str
    target_id: str

class PathResponse(BaseModel):
    exists: bool
    source_id: str
    target_id: str
    source_name: str
    target_name: str
    path_nodes: List[str]
    path_node_names: List[str]
    path_link_ids: List[str]
    hop_count: int
    total_cost: float
    total_latency: float
    message: Optional[str] = None

class FailureSimRequest(BaseModel):
    topology: Topology
    failed_link_id: str
    source_id: Optional[str] = None
    target_id: Optional[str] = None

class FailureSimResponse(BaseModel):
    failed_link_id: str
    failed_link_source: str
    failed_link_target: str
    is_critical: bool
    is_fully_connected: bool
    connected_components_count: int
    affected_devices: List[str]
    affected_device_names: List[str]
    server_reachability_loss: List[str]
    alternate_path_exists: bool
    alternate_path: Optional[PathResponse] = None
    summary_message: str

class BackupRecommendation(BaseModel):
    source_id: str
    target_id: str
    source_name: str
    target_name: str
    cost: float
    latency: float
    bandwidth: float
    improvement_score: float
    rationale: str

class RecommendationResponse(BaseModel):
    recommendation_available: bool
    recommended_link: Optional[BackupRecommendation] = None
    all_candidates_tested: int
    message: str

class ComparisonMetrics(BaseModel):
    reachable_devices: int
    critical_links_count: int
    connected_components: int
    is_connected: bool
    server_reachable: bool

class ComparisonResponse(BaseModel):
    before: ComparisonMetrics
    after: ComparisonMetrics
    improvement_notes: List[str]

class LinkRiskPrediction(BaseModel):
    link_id: str
    source: str
    target: str
    source_name: str
    target_name: str
    utilization: float
    latency: float
    packet_loss: float
    failure_history: int
    age_months: float
    failure_probability: float
    risk_level: str  # 'Low', 'Medium', 'High'
    explanation: str

class MLMetricsResponse(BaseModel):
    model_name: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    training_samples: int
    disclaimer: str
