import ipaddress
import networkx as nx
from typing import List, Dict, Set, Tuple, Optional
from models import (
    Topology, Device, Link, ValidationResult, ValidationIssue,
    CriticalLinksResponse, CriticalLinkInfo, PathResponse, FailureSimResponse
)

def validate_ipv4(ip_str: Optional[str]) -> bool:
    """Validates IPv4 string."""
    if not ip_str or not ip_str.strip():
        return True  # Blank is allowed for non-addressed nodes like basic L2 switches
    try:
        ipaddress.IPv4Address(ip_str.strip())
        return True
    except ValueError:
        return False

def validate_topology(topology: Topology) -> ValidationResult:
    """
    Validates network topology against configuration rules:
    - Duplicate device IDs
    - Duplicate links
    - Self-connections
    - Invalid IPv4 addresses
    - Duplicate non-empty IPv4 addresses
    - Links referencing non-existent devices
    - Isolated devices (no links)
    """
    issues: List[ValidationIssue] = []
    
    # 1. Device IDs and IP addresses
    device_id_map: Dict[str, Device] = {}
    ip_map: Dict[str, str] = {}
    
    for dev in topology.devices:
        # Check duplicate ID
        if dev.id in device_id_map:
            issues.append(ValidationIssue(
                type="error",
                code="DUPLICATE_DEVICE_ID",
                message=f"Duplicate device ID found: '{dev.id}'",
                target_id=dev.id
            ))
        else:
            device_id_map[dev.id] = dev
        
        # Check IPv4 validity
        if dev.ip and dev.ip.strip():
            cleaned_ip = dev.ip.strip()
            if not validate_ipv4(cleaned_ip):
                issues.append(ValidationIssue(
                    type="error",
                    code="INVALID_IP_FORMAT",
                    message=f"Invalid IPv4 format '{cleaned_ip}' on device '{dev.name}' ({dev.id})",
                    target_id=dev.id
                ))
            else:
                if cleaned_ip in ip_map:
                    issues.append(ValidationIssue(
                        type="warning",
                        code="DUPLICATE_IP_ADDRESS",
                        message=f"IP address '{cleaned_ip}' is assigned to both '{ip_map[cleaned_ip]}' and '{dev.name}'",
                        target_id=dev.id
                    ))
                else:
                    ip_map[cleaned_ip] = dev.name

    # 2. Link checks
    existing_edges: Set[Tuple[str, str]] = set()
    connected_device_ids: Set[str] = set()
    link_ids: Set[str] = set()

    for link in topology.links:
        # Duplicate link ID
        if link.id in link_ids:
            issues.append(ValidationIssue(
                type="error",
                code="DUPLICATE_LINK_ID",
                message=f"Duplicate link ID: '{link.id}'",
                target_id=link.id
            ))
        link_ids.add(link.id)

        # Self-connection
        if link.source == link.target:
            issues.append(ValidationIssue(
                type="error",
                code="SELF_CONNECTION",
                message=f"Link '{link.id}' is a self-connection on device '{link.source}'",
                target_id=link.id
            ))

        # Missing endpoint devices
        src_exists = link.source in device_id_map
        tgt_exists = link.target in device_id_map
        if not src_exists or not tgt_exists:
            missing = []
            if not src_exists: missing.append(f"source '{link.source}'")
            if not tgt_exists: missing.append(f"target '{link.target}'")
            issues.append(ValidationIssue(
                type="error",
                code="MISSING_DEVICE_REFERENCE",
                message=f"Link '{link.id}' references non-existent device: {', '.join(missing)}",
                target_id=link.id
            ))
        else:
            # Undirected pair check for duplicate links
            edge_pair = tuple(sorted([link.source, link.target]))
            if edge_pair in existing_edges:
                issues.append(ValidationIssue(
                    type="warning",
                    code="DUPLICATE_LINK",
                    message=f"Multiple links exist between '{device_id_map[link.source].name}' and '{device_id_map[link.target].name}'",
                    target_id=link.id
                ))
            existing_edges.add(edge_pair)
            connected_device_ids.add(link.source)
            connected_device_ids.add(link.target)

    # 3. Isolated devices check
    if len(topology.devices) > 1:
        for dev in topology.devices:
            if dev.id not in connected_device_ids:
                issues.append(ValidationIssue(
                    type="warning",
                    code="ISOLATED_DEVICE",
                    message=f"Device '{dev.name}' ({dev.id}) has no connected links",
                    target_id=dev.id
                ))

    has_errors = any(issue.type == "error" for issue in issues)
    return ValidationResult(is_valid=not has_errors, issues=issues)


def build_networkx_graph(topology: Topology, exclude_link_ids: Optional[Set[str]] = None, active_only: bool = True) -> nx.Graph:
    """
    Builds an undirected NetworkX graph from devices and active links.
    """
    G = nx.Graph()
    dev_names = {d.id: d.name for d in topology.devices}
    dev_types = {d.id: d.type for d in topology.devices}
    
    for dev in topology.devices:
        G.add_node(dev.id, name=dev.name, type=dev.type, ip=dev.ip)
        
    for link in topology.links:
        if active_only and link.status != "active":
            continue
        if exclude_link_ids and link.id in exclude_link_ids:
            continue
        
        # Only add if both endpoints exist in graph
        if link.source in G and link.target in G:
            G.add_edge(
                link.source,
                link.target,
                id=link.id,
                cost=float(link.cost),
                latency=float(link.latency),
                bandwidth=float(link.bandwidth)
            )
            
    return G


def find_critical_links(topology: Topology) -> CriticalLinksResponse:
    """
    Identifies bridge connections using NetworkX bridge detection.
    Also calculates which devices become disconnected when each critical bridge fails.
    """
    G = build_networkx_graph(topology, active_only=True)
    dev_map = {d.id: d.name for d in topology.devices}
    
    # Map edge pairs (u, v) -> Link
    link_lookup: Dict[Tuple[str, str], Link] = {}
    for link in topology.links:
        if link.status == "active":
            pair = tuple(sorted([link.source, link.target]))
            link_lookup[pair] = link

    if len(G.nodes) == 0:
        return CriticalLinksResponse(
            critical_links=[],
            total_links=0,
            critical_link_count=0,
            connected_components_count=0,
            is_fully_connected=True
        )

    connected_components = list(nx.connected_components(G))
    is_fully_connected = len(connected_components) <= 1
    
    bridges = list(nx.bridges(G))
    critical_link_infos: List[CriticalLinkInfo] = []

    for u, v in bridges:
        pair = tuple(sorted([u, v]))
        link = link_lookup.get(pair)
        if not link:
            continue

        # Simulate removing this single edge to find affected disconnected components
        G_temp = G.copy()
        G_temp.remove_edge(u, v)
        new_components = list(nx.connected_components(G_temp))
        
        # The smaller component represents the isolated portion
        affected_nodes: List[str] = []
        if len(new_components) > 1:
            # Find the component containing fewer nodes, or identify split
            sorted_comps = sorted(new_components, key=lambda c: len(c))
            affected_nodes = list(sorted_comps[0])  # Disconnected isolated segment
            
        u_name = dev_map.get(u, u)
        v_name = dev_map.get(v, v)
        affected_names = [dev_map.get(nid, nid) for nid in affected_nodes]
        
        explanation = (
            f"Link between '{u_name}' and '{v_name}' is a bridge. "
            f"If it fails, {len(affected_nodes)} device(s) ({', '.join(affected_names[:3])}"
            f"{'...' if len(affected_names) > 3 else ''}) will lose connectivity to the rest of the network."
        )

        critical_link_infos.append(CriticalLinkInfo(
            link_id=link.id,
            source=link.source,
            target=link.target,
            source_name=u_name,
            target_name=v_name,
            affected_device_count=len(affected_nodes),
            affected_devices=affected_nodes,
            explanation=explanation
        ))

    return CriticalLinksResponse(
        critical_links=critical_link_infos,
        total_links=len(topology.links),
        critical_link_count=len(critical_link_infos),
        connected_components_count=len(connected_components),
        is_fully_connected=is_fully_connected
    )


def calculate_shortest_path(topology: Topology, source_id: str, target_id: str) -> PathResponse:
    """
    Computes shortest path based on link cost using Dijkstra's algorithm.
    Accumulates link cost and latency along the path.
    """
    dev_map = {d.id: d.name for d in topology.devices}
    src_name = dev_map.get(source_id, source_id)
    tgt_name = dev_map.get(target_id, target_id)

    if source_id == target_id:
        return PathResponse(
            exists=True,
            source_id=source_id,
            target_id=target_id,
            source_name=src_name,
            target_name=tgt_name,
            path_nodes=[source_id],
            path_node_names=[src_name],
            path_link_ids=[],
            hop_count=0,
            total_cost=0.0,
            total_latency=0.0,
            message="Source and target are the same device."
        )

    G = build_networkx_graph(topology, active_only=True)

    if source_id not in G or target_id not in G:
        return PathResponse(
            exists=False,
            source_id=source_id,
            target_id=target_id,
            source_name=src_name,
            target_name=tgt_name,
            path_nodes=[],
            path_node_names=[],
            path_link_ids=[],
            hop_count=0,
            total_cost=0.0,
            total_latency=0.0,
            message="One or both devices do not exist or are disconnected."
        )

    try:
        path = nx.shortest_path(G, source=source_id, target=target_id, weight="cost")
        path_link_ids: List[str] = []
        total_cost = 0.0
        total_latency = 0.0

        for i in range(len(path) - 1):
            u, v = path[i], path[i+1]
            edge_data = G.get_edge_data(u, v)
            path_link_ids.append(edge_data.get("id", ""))
            total_cost += edge_data.get("cost", 1.0)
            total_latency += edge_data.get("latency", 0.0)

        path_names = [dev_map.get(node_id, node_id) for node_id in path]

        return PathResponse(
            exists=True,
            source_id=source_id,
            target_id=target_id,
            source_name=src_name,
            target_name=tgt_name,
            path_nodes=path,
            path_node_names=path_names,
            path_link_ids=path_link_ids,
            hop_count=len(path) - 1,
            total_cost=round(total_cost, 2),
            total_latency=round(total_latency, 2),
            message=f"Optimal route found ({len(path) - 1} hops, total cost {round(total_cost, 2)})."
        )
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return PathResponse(
            exists=False,
            source_id=source_id,
            target_id=target_id,
            source_name=src_name,
            target_name=tgt_name,
            path_nodes=[],
            path_node_names=[],
            path_link_ids=[],
            hop_count=0,
            total_cost=0.0,
            total_latency=0.0,
            message=f"No route exists between '{src_name}' and '{tgt_name}'."
        )


def simulate_link_failure(
    topology: Topology,
    failed_link_id: str,
    source_id: Optional[str] = None,
    target_id: Optional[str] = None
) -> FailureSimResponse:
    """
    Simulates failure of a specific link:
    - Excludes the link from connectivity graph
    - Recomputes connected components
    - Detects affected devices
    - Checks servers reachability
    - Checks whether an alternate route exists between source and target
    """
    dev_map = {d.id: d.name for d in topology.devices}
    dev_types = {d.id: d.type for d in topology.devices}
    
    # Locate target link
    failed_link: Optional[Link] = None
    for link in topology.links:
        if link.id == failed_link_id:
            failed_link = link
            break

    if not failed_link:
        raise ValueError(f"Link with ID '{failed_link_id}' not found.")

    src_name = dev_map.get(failed_link.source, failed_link.source)
    tgt_name = dev_map.get(failed_link.target, failed_link.target)

    # Graph with failed link excluded
    G_failed = build_networkx_graph(topology, exclude_link_ids={failed_link_id}, active_only=True)
    
    # Baseline graph before failure
    G_baseline = build_networkx_graph(topology, active_only=True)
    
    # Check if edge was a bridge in baseline
    edge_tuple = (failed_link.source, failed_link.target)
    is_critical = nx.has_path(G_baseline, failed_link.source, failed_link.target) and not nx.has_path(G_failed, failed_link.source, failed_link.target)
    
    components = list(nx.connected_components(G_failed))
    is_fully_connected = len(components) <= 1

    # Find affected devices: devices that were connected in G_baseline but now partitioned
    affected_nodes: List[str] = []
    if is_critical and len(components) > 1:
        # The smaller component or component detached from main cluster
        sorted_comps = sorted(components, key=lambda c: len(c))
        affected_nodes = list(sorted_comps[0])
    affected_names = [dev_map.get(nid, nid) for nid in affected_nodes]

    # Server reachability check
    server_ids = [d.id for d in topology.devices if d.type == "server"]
    lost_reachability_servers: List[str] = []
    
    if source_id and server_ids:
        for s_id in server_ids:
            had_path = nx.has_path(G_baseline, source_id, s_id) if source_id in G_baseline and s_id in G_baseline else False
            has_path_now = nx.has_path(G_failed, source_id, s_id) if source_id in G_failed and s_id in G_failed else False
            if had_path and not has_path_now:
                lost_reachability_servers.append(dev_map.get(s_id, s_id))

    # Alternate path between requested source & target (or between the link's endpoints)
    eval_src = source_id if source_id else failed_link.source
    eval_tgt = target_id if target_id else failed_link.target
    
    alt_path_response: Optional[PathResponse] = None
    alternate_path_exists = False
    
    if eval_src in G_failed and eval_tgt in G_failed:
        if nx.has_path(G_failed, eval_src, eval_tgt):
            alternate_path_exists = True
            # Compute path using topology where link is inactive
            temp_topology = topology.model_copy(deep=True)
            for l in temp_topology.links:
                if l.id == failed_link_id:
                    l.status = "failed"
            alt_path_response = calculate_shortest_path(temp_topology, eval_src, eval_tgt)

    # Human-readable summary
    if is_critical:
        if alternate_path_exists and eval_src and eval_tgt:
            summary = f"Link '{src_name}' <-> '{tgt_name}' failed. It is critical; however an alternate route exists between '{dev_map.get(eval_src, eval_src)}' and '{dev_map.get(eval_tgt, eval_tgt)}'."
        else:
            summary = f"Connection between '{src_name}' and '{tgt_name}' has failed. It was a critical link! {len(affected_nodes)} devices are now isolated."
    else:
        summary = f"Connection between '{src_name}' and '{tgt_name}' failed. The network has redundant paths and remains fully connected."

    return FailureSimResponse(
        failed_link_id=failed_link_id,
        failed_link_source=failed_link.source,
        failed_link_target=failed_link.target,
        is_critical=is_critical,
        is_fully_connected=is_fully_connected,
        connected_components_count=len(components),
        affected_devices=affected_nodes,
        affected_device_names=affected_names,
        server_reachability_loss=lost_reachability_servers,
        alternate_path_exists=alternate_path_exists,
        alternate_path=alt_path_response,
        summary_message=summary
    )
