import networkx as nx
from typing import List, Tuple, Optional, Set
from models import (
    Topology, Device, Link, BackupRecommendation, RecommendationResponse,
    ComparisonMetrics, ComparisonResponse
)
from network_analysis import build_networkx_graph, find_critical_links

def generate_backup_recommendation(
    topology: Topology,
    failed_link_id: Optional[str] = None
) -> RecommendationResponse:
    """
    Backup-link algorithm:
    1. Identify current connectivity state (components, bridges).
    2. Identify candidate links between existing devices (excluding existing links & self-loops).
    3. Test each candidate connection on the active graph (with failed link excluded if applicable).
    4. Measure improvements:
       - Reduction in connected components (re-connecting partitioned networks)
       - Reduction in critical bridge count (adding redundancy)
       - Increase in pairs of reachable nodes
    5. Rank candidates by (component_reduction * 100 + reachable_pairs_increase * 10 - bridge_count)
    6. Return best valid candidate with rationale.
    """
    dev_map = {d.id: d.name for d in topology.devices}
    dev_types = {d.id: d.type for d in topology.devices}
    
    # Active links, excluding failed_link_id if provided
    exclude_ids = {failed_link_id} if failed_link_id else set()
    current_links = [l for l in topology.links if l.status == "active" and l.id not in exclude_ids]
    
    # Set of existing pairs
    existing_pairs: Set[Tuple[str, str]] = set()
    for l in topology.links:
        existing_pairs.add(tuple(sorted([l.source, l.target])))

    # Base graph
    G_base = build_networkx_graph(topology, exclude_link_ids=exclude_ids, active_only=True)
    base_components = list(nx.connected_components(G_base))
    base_comp_count = len(base_components)
    base_bridges_count = len(list(nx.bridges(G_base)))
    
    # Calculate base reachable pairs
    base_reachable_pairs = sum(len(c) * (len(c) - 1) // 2 for c in base_components)

    candidates = []
    device_ids = [d.id for d in topology.devices]

    # Evaluate all valid pairs
    for i in range(len(device_ids)):
        for j in range(i + 1, len(device_ids)):
            u, v = device_ids[i], device_ids[j]
            pair = tuple(sorted([u, v]))
            
            if pair in existing_pairs:
                continue

            # Don't recommend connecting two PCs directly if routers/switches exist
            u_type = dev_types.get(u, "")
            v_type = dev_types.get(v, "")
            if u_type == "pc" and v_type == "pc":
                continue

            # Test adding edge (u, v)
            G_test = G_base.copy()
            G_test.add_edge(u, v, cost=1.0, latency=5.0)

            test_components = list(nx.connected_components(G_test))
            test_comp_count = len(test_components)
            test_bridges_count = len(list(nx.bridges(G_test)))
            test_reachable_pairs = sum(len(c) * (len(c) - 1) // 2 for c in test_components)

            comp_reduction = base_comp_count - test_comp_count
            reach_increase = test_reachable_pairs - base_reachable_pairs
            bridge_reduction = base_bridges_count - test_bridges_count

            # Prefer links between switches or routers, or linking server to redundant switch
            infra_bonus = 0
            if u_type in ["router", "switch"] and v_type in ["router", "switch"]:
                infra_bonus = 5
            elif (u_type == "server" and v_type in ["switch", "router"]) or (v_type == "server" and u_type in ["switch", "router"]):
                infra_bonus = 4

            score = (comp_reduction * 100) + (reach_increase * 5) + (bridge_reduction * 8) + infra_bonus

            # Only consider if there is genuine improvement
            if comp_reduction > 0 or bridge_reduction > 0 or reach_increase > 0:
                candidates.append({
                    "source": u,
                    "target": v,
                    "score": score,
                    "comp_reduction": comp_reduction,
                    "bridge_reduction": bridge_reduction,
                    "reach_increase": reach_increase,
                    "new_bridges": test_bridges_count
                })

    if not candidates:
        return RecommendationResponse(
            recommendation_available=False,
            recommended_link=None,
            all_candidates_tested=0,
            message="No backup links required. The network currently has full connectivity and optimal redundancy."
        )

    # Sort descending by score
    candidates.sort(key=lambda x: x["score"], reverse=True)
    best = candidates[0]

    src_name = dev_map.get(best["source"], best["source"])
    tgt_name = dev_map.get(best["target"], best["target"])

    rationale_parts = []
    if best["comp_reduction"] > 0:
        rationale_parts.append(f"Restores connectivity between isolated network partitions")
    if best["reach_increase"] > 0:
        rationale_parts.append(f"Enables communication between {best['reach_increase']} previously disconnected device pairs")
    if best["bridge_reduction"] > 0:
        rationale_parts.append(f"Eliminates {best['bridge_reduction']} single-point-of-failure bridge(s) by establishing redundant routing paths")

    rationale = f"Add backup connection between '{src_name}' and '{tgt_name}'. " + ". ".join(rationale_parts) + "."

    recommended_link = BackupRecommendation(
        source_id=best["source"],
        target_id=best["target"],
        source_name=src_name,
        target_name=tgt_name,
        cost=1.0,
        latency=5.0,
        bandwidth=100.0,
        improvement_score=round(best["score"], 2),
        rationale=rationale
    )

    return RecommendationResponse(
        recommendation_available=True,
        recommended_link=recommended_link,
        all_candidates_tested=len(candidates),
        message=f"Optimal backup link identified between '{src_name}' and '{tgt_name}'."
    )


def compare_connectivity(before_topology: Topology, after_topology: Topology) -> ComparisonResponse:
    """
    Computes honest before-and-after connectivity metrics.
    """
    def compute_metrics(top: Topology) -> ComparisonMetrics:
        G = build_networkx_graph(top, active_only=True)
        components = list(nx.connected_components(G))
        comp_count = len(components)
        bridges = list(nx.bridges(G))
        
        # Max reachable component size
        max_reachable = max([len(c) for c in components]) if components else 0
        
        # Server reachability check
        server_ids = [d.id for d in top.devices if d.type == "server"]
        pc_ids = [d.id for d in top.devices if d.type == "pc"]
        server_reachable = True
        if server_ids and pc_ids:
            # Check if at least one PC can reach a server
            can_reach_any = False
            for pc in pc_ids:
                for s in server_ids:
                    if pc in G and s in G and nx.has_path(G, pc, s):
                        can_reach_any = True
                        break
                if can_reach_any:
                    break
            server_reachable = can_reach_any

        return ComparisonMetrics(
            reachable_devices=max_reachable,
            critical_links_count=len(bridges),
            connected_components=comp_count,
            is_connected=(comp_count <= 1 and len(G.nodes) > 0),
            server_reachable=server_reachable
        )

    before_metrics = compute_metrics(before_topology)
    after_metrics = compute_metrics(after_topology)

    notes: List[str] = []
    if after_metrics.connected_components < before_metrics.connected_components:
        notes.append(f"Network partitions reduced from {before_metrics.connected_components} to {after_metrics.connected_components}.")
    if after_metrics.critical_links_count < before_metrics.critical_links_count:
        notes.append(f"Critical single-point-of-failure links reduced from {before_metrics.critical_links_count} to {after_metrics.critical_links_count}.")
    if after_metrics.reachable_devices > before_metrics.reachable_devices:
        notes.append(f"Maximum reachable devices increased from {before_metrics.reachable_devices} to {after_metrics.reachable_devices}.")
    if not before_metrics.server_reachable and after_metrics.server_reachable:
        notes.append("Restored path between workstation PCs and core servers.")
    if not notes:
        notes.append("Topology preserved full connectivity with updated network layout.")

    return ComparisonResponse(
        before=before_metrics,
        after=after_metrics,
        improvement_notes=notes
    )
