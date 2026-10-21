from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Device(BaseModel):
    id: str = Field(..., description="Unique device ID")
    name: str = Field(..., description="Device label/name")
    type: str = Field(..., description="Device type: router, switch, pc, server")
    ip: Optional[str] = Field(None, description="IPv4 address if applicable")
    x: Optional[float] = Field(None, description="X coordinate on canvas")
    y: Optional[float] = Field(None, description="Y coordinate on canvas")
    
    # Extended Computer Networks properties
    subnet_mask: Optional[str] = Field("255.255.255.0", description="IPv4 subnet mask")
    gateway: Optional[str] = Field(None, description="Default gateway IPv4 address")
    mac_address: Optional[str] = Field(None, description="Device MAC address")
    vlan_id: Optional[int] = Field(1, description="Assigned VLAN ID (1-4094)")
    bridge_priority: Optional[int] = Field(32768, description="STP Bridge Priority for switches")

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

    # Extended L2/STP properties
    port_mode: Optional[str] = Field("access", description="'access' or 'trunk'")
    allowed_vlans: Optional[List[int]] = Field(default_factory=lambda: [1], description="Allowed VLANs on trunk")
    stp_role: Optional[str] = Field("designated", description="'root', 'designated', or 'alternate'")
    stp_state: Optional[str] = Field("forwarding", description="'forwarding' or 'blocking'")

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

# ==================== NEW CN PROTOCOL SCHEMAS ====================

class SubnetCalcRequest(BaseModel):
    ip: str
    cidr: int = Field(24, ge=1, le=32)
    device_a_ip: Optional[str] = None
    device_b_ip: Optional[str] = None
    gateway_ip: Optional[str] = None

class SubnetCalcResponse(BaseModel):
    ip: str
    cidr: int
    network_address: str
    netmask: str
    broadcast_address: str
    first_usable_ip: str
    last_usable_ip: str
    total_hosts: int
    usable_hosts: int
    ip_class: str
    is_private: bool
    same_subnet_test: Optional[bool] = None
    gateway_valid_test: Optional[bool] = None
    explanation: str

class RouteEntry(BaseModel):
    destination_network: str
    netmask: str
    next_hop: str
    interface: str
    metric: float
    route_type: str  # 'Connected', 'Static', 'Dijkstra-OSPF'
    status: str      # 'Active', 'Down'

class RouterRoutingTable(BaseModel):
    router_id: str
    router_name: str
    routes: List[RouteEntry]

class PingRequest(BaseModel):
    topology: Topology
    source_id: str
    target_id: Optional[str] = None
    target_ip: Optional[str] = None
    packet_count: int = Field(4, ge=1, le=10)

class PingProbe(BaseModel):
    seq: int
    success: bool
    rtt_ms: float
    ttl: int
    reply_from: str
    message: str

class PingResponse(BaseModel):
    source_id: str
    source_name: str
    source_ip: str
    target_ip: str
    target_name: Optional[str]
    packets_sent: int
    packets_received: int
    packet_loss_percent: float
    min_rtt_ms: float
    avg_rtt_ms: float
    max_rtt_ms: float
    reachable: bool
    probes: List[PingProbe]
    failure_reason: Optional[str] = None
    path_taken: List[str] = []

class TracerouteHop(BaseModel):
    hop_number: int
    device_id: str
    device_name: str
    ip: str
    rtt_ms: float
    status: str  # 'Success', 'Timeout', 'Host Unreachable'

class TracerouteRequest(BaseModel):
    topology: Topology
    source_id: str
    target_id: str

class TracerouteResponse(BaseModel):
    source_name: str
    target_name: str
    target_ip: str
    completed: bool
    total_hops: int
    hops: List[TracerouteHop]
    summary: str

class STPBridgePort(BaseModel):
    link_id: str
    connected_device_id: str
    connected_device_name: str
    role: str   # 'Root Port', 'Designated Port', 'Alternate (Blocked)'
    state: str  # 'Forwarding', 'Blocking'
    cost: float

class STPSwitchInfo(BaseModel):
    switch_id: str
    switch_name: str
    bridge_priority: int
    mac_address: str
    bridge_id: str
    is_root_bridge: bool
    root_path_cost: float
    ports: List[STPBridgePort]

class STPResponse(BaseModel):
    root_bridge_id: str
    root_bridge_name: str
    switches: List[STPSwitchInfo]
    blocked_link_ids: List[str]
    forwarding_link_ids: List[str]
    explanation: str

class PacketStep(BaseModel):
    step_number: int
    current_device_id: str
    current_device_name: str
    device_type: str
    action: str  # 'Originating', 'Layer 2 Switching', 'Layer 3 Routing', 'ARP Resolution', 'Destination Received', 'Dropped'
    layer: str   # 'Layer 2 (Data Link)', 'Layer 3 (Network)', 'Layer 4 (Transport)'
    src_mac: str
    dst_mac: str
    src_ip: str
    dst_ip: str
    protocol: str
    info: str
    status: str  # 'ok', 'dropped'

class PacketSimulationRequest(BaseModel):
    topology: Topology
    source_id: str
    target_id: str
    protocol: str = Field("ICMP", description="ICMP, TCP, or UDP")
    dest_port: Optional[int] = 80

class PacketSimulationResponse(BaseModel):
    protocol: str
    success: bool
    steps: List[PacketStep]
    failure_reason: Optional[str] = None
    three_way_handshake: Optional[List[Dict[str, str]]] = None
    educational_summary: str
