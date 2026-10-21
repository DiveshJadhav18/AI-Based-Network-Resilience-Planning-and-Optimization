import ipaddress
import hashlib
import networkx as nx
from typing import List, Dict, Optional, Tuple, Set
from models import (
    Topology, Device, Link,
    SubnetCalcRequest, SubnetCalcResponse,
    RouteEntry, RouterRoutingTable,
    PingRequest, PingResponse, PingProbe,
    TracerouteRequest, TracerouteResponse, TracerouteHop,
    STPResponse, STPSwitchInfo, STPBridgePort,
    PacketSimulationRequest, PacketSimulationResponse, PacketStep
)
from network_analysis import build_networkx_graph, calculate_shortest_path

def generate_mac(dev_id: str) -> str:
    """Generates a stable, realistic MAC address for a given device ID."""
    h = hashlib.md5(dev_id.encode()).hexdigest()
    return f"{h[0:2]}:{h[2:4]}:{h[4:6]}:{h[6:8]}:{h[8:10]}:{h[10:12]}".upper()

def calculate_subnet(req: SubnetCalcRequest) -> SubnetCalcResponse:
    """
    Subnet and CIDR Calculator using Python's ipaddress module.
    Calculates network address, broadcast, usable host ranges, and tests if two IPs are on the same subnet.
    """
    try:
        network = ipaddress.IPv4Network(f"{req.ip.strip()}/{req.cidr}", strict=False)
    except ValueError as e:
        raise ValueError(f"Invalid IP address or CIDR: {e}")

    # Determine class
    first_octet = int(network.network_address.exploded.split('.')[0])
    if 1 <= first_octet <= 126:
        ip_class = 'Class A'
    elif 128 <= first_octet <= 191:
        ip_class = 'Class B'
    elif 192 <= first_octet <= 223:
        ip_class = 'Class C'
    elif 224 <= first_octet <= 239:
        ip_class = 'Class D (Multicast)'
    else:
        ip_class = 'Class E (Experimental)'

    # Usable host ranges
    hosts = list(network.hosts())
    if hosts:
        first_usable = str(hosts[0])
        last_usable = str(hosts[-1])
        usable_count = len(hosts)
    else:
        first_usable = str(network.network_address)
        last_usable = str(network.broadcast_address)
        usable_count = 0

    # Tests
    same_subnet_test = None
    if req.device_a_ip and req.device_b_ip:
        try:
            ip_a = ipaddress.IPv4Address(req.device_a_ip.strip())
            ip_b = ipaddress.IPv4Address(req.device_b_ip.strip())
            same_subnet_test = (ip_a in network) and (ip_b in network)
        except ValueError:
            same_subnet_test = False

    gateway_valid_test = None
    if req.gateway_ip:
        try:
            gw = ipaddress.IPv4Address(req.gateway_ip.strip())
            gateway_valid_test = (gw in network) and (gw != network.network_address) and (gw != network.broadcast_address)
        except ValueError:
            gateway_valid_test = False

    explanation = (
        f"A /{req.cidr} prefix masks {req.cidr} bits for the Network ID and leaves "
        f"{32 - req.cidr} bits for Host IDs. This yields {network.num_addresses} total IPv4 addresses "
        f"with {usable_count} assignable host addresses (excluding network {network.network_address} "
        f"and broadcast {network.broadcast_address})."
    )

    return SubnetCalcResponse(
        ip=req.ip,
        cidr=req.cidr,
        network_address=str(network.network_address),
        netmask=str(network.netmask),
        broadcast_address=str(network.broadcast_address),
        first_usable_ip=first_usable,
        last_usable_ip=last_usable,
        total_hosts=network.num_addresses,
        usable_hosts=usable_count,
        ip_class=ip_class,
        is_private=network.is_private,
        same_subnet_test=same_subnet_test,
        gateway_valid_test=gateway_valid_test,
        explanation=explanation
    )

def generate_router_routing_tables(topology: Topology) -> List[RouterRoutingTable]:
    """
    Constructs routing tables for every router in the topology.
    Includes:
    - Directly Connected subnets (interfaces)
    - Dijkstra-computed routes to other subnets via active links
    """
    routers = [d for d in topology.devices if d.type == 'router']
    G = build_networkx_graph(topology, active_only=True)
    dev_map = {d.id: d for d in topology.devices}

    tables: List[RouterRoutingTable] = []

    for router in routers:
        routes: List[RouteEntry] = []
        
        # 1. Directly connected links (interfaces)
        connected_neighbors = []
        for link in topology.links:
            if link.status != 'active':
                continue
            if link.source == router.id or link.target == router.id:
                neighbor_id = link.target if link.source == router.id else link.source
                neighbor = dev_map.get(neighbor_id)
                if neighbor and neighbor.ip:
                    try:
                        net = ipaddress.IPv4Network(f"{neighbor.ip}/24", strict=False)
                        routes.append(RouteEntry(
                            destination_network=str(net.network_address),
                            netmask=str(net.netmask),
                            next_hop="Directly Connected",
                            interface=f"eth_{link.id}",
                            metric=float(link.cost),
                            route_type="Connected",
                            status="Active"
                        ))
                    except ValueError:
                        pass
                connected_neighbors.append(neighbor_id)

        # 2. Remote subnets via other routers
        for other_dev in topology.devices:
            if other_dev.id == router.id or not other_dev.ip:
                continue
            try:
                dest_net = ipaddress.IPv4Network(f"{other_dev.ip}/24", strict=False)
                dest_net_str = str(dest_net.network_address)
            except ValueError:
                continue

            # Check if this network is already listed
            if any(r.destination_network == dest_net_str for r in routes):
                continue

            # Calculate path from router to other_dev
            if router.id in G and other_dev.id in G and nx.has_path(G, router.id, other_dev.id):
                path = nx.shortest_path(G, source=router.id, target=other_dev.id, weight='cost')
                if len(path) > 1:
                    next_hop_node = dev_map.get(path[1])
                    next_hop_ip = next_hop_node.ip if (next_hop_node and next_hop_node.ip) else next_hop_node.name
                    
                    # Accumulate metric
                    cost = 0.0
                    for i in range(len(path) - 1):
                        cost += G.get_edge_data(path[i], path[i+1]).get('cost', 1.0)

                    routes.append(RouteEntry(
                        destination_network=dest_net_str,
                        netmask=str(dest_net.netmask),
                        next_hop=f"{next_hop_ip} ({next_hop_node.name})",
                        interface=f"eth_{path[0]}_{path[1]}",
                        metric=round(cost, 1),
                        route_type="Dijkstra-OSPF",
                        status="Active"
                    ))
            else:
                routes.append(RouteEntry(
                    destination_network=dest_net_str,
                    netmask=str(dest_net.netmask),
                    next_hop="Unreachable",
                    interface="None",
                    metric=999.0,
                    route_type="Static",
                    status="Down"
                ))

        tables.append(RouterRoutingTable(
            router_id=router.id,
            router_name=router.name,
            routes=routes
        ))

    return tables

def simulate_ping(req: PingRequest) -> PingResponse:
    """
    Simulates ICMP Echo Request / Echo Reply between source and target.
    Verifies:
    - Active links along the path
    - Subnet / gateway reachability
    - VLAN separation (if on different VLANs without a router gateway)
    """
    dev_map = {d.id: d for d in req.topology.devices}
    src_dev = dev_map.get(req.source_id)
    if not src_dev:
        raise ValueError(f"Source device '{req.source_id}' not found.")

    # Target resolution by target_id or target_ip
    target_dev = None
    if req.target_id:
        target_dev = dev_map.get(req.target_id)
    elif req.target_ip:
        for d in req.topology.devices:
            if d.ip and d.ip.strip() == req.target_ip.strip():
                target_dev = d
                break

    target_ip = target_dev.ip if target_dev and target_dev.ip else (req.target_ip or "0.0.0.0")
    target_name = target_dev.name if target_dev else f"Host ({target_ip})"
    src_ip = src_dev.ip or "0.0.0.0"

    # Base path check using NetworkX
    G = build_networkx_graph(req.topology, active_only=True)
    
    if not target_dev or target_dev.id not in G or src_dev.id not in G:
        return PingResponse(
            source_id=src_dev.id,
            source_name=src_dev.name,
            source_ip=src_ip,
            target_ip=target_ip,
            target_name=target_name,
            packets_sent=req.packet_count,
            packets_received=0,
            packet_loss_percent=100.0,
            min_rtt_ms=0.0,
            avg_rtt_ms=0.0,
            max_rtt_ms=0.0,
            reachable=False,
            probes=[PingProbe(seq=i+1, success=False, rtt_ms=0.0, ttl=0, reply_from=src_ip, message="Destination host unreachable") for i in range(req.packet_count)],
            failure_reason="Destination device does not exist or has no active link connected to it.",
            path_taken=[]
        )

    # Check VLAN compatibility: if both devices have different vlan_id > 1 and no router is in the topology
    routers_in_top = [d for d in req.topology.devices if d.type == 'router']
    vlan_mismatch = (
        src_dev.vlan_id and target_dev.vlan_id and
        src_dev.vlan_id != target_dev.vlan_id and
        len(routers_in_top) == 0
    )
    if vlan_mismatch:
        return PingResponse(
            source_id=src_dev.id,
            source_name=src_dev.name,
            source_ip=src_ip,
            target_ip=target_ip,
            target_name=target_name,
            packets_sent=req.packet_count,
            packets_received=0,
            packet_loss_percent=100.0,
            min_rtt_ms=0.0,
            avg_rtt_ms=0.0,
            max_rtt_ms=0.0,
            reachable=False,
            probes=[PingProbe(seq=i+1, success=False, rtt_ms=0.0, ttl=0, reply_from=src_ip, message=f"VLAN Isolation: VLAN {src_dev.vlan_id} cannot reach VLAN {target_dev.vlan_id} without Layer 3 Router") for i in range(req.packet_count)],
            failure_reason=f"Inter-VLAN communication blocked: Source is in VLAN {src_dev.vlan_id} and Target is in VLAN {target_dev.vlan_id}. An Inter-VLAN Router is required.",
            path_taken=[]
        )

    try:
        path = nx.shortest_path(G, source=src_dev.id, target=target_dev.id, weight='cost')
        
        # Calculate real RTT from edge latencies
        one_way_latency = 0.0
        for i in range(len(path) - 1):
            edge = G.get_edge_data(path[i], path[i+1])
            one_way_latency += edge.get('latency', 5.0)

        base_rtt = round(one_way_latency * 2.0, 2)  # Round trip
        ttl_val = 64 - len([n for n in path if dev_map[n].type == 'router'])

        probes = []
        for i in range(req.packet_count):
            jitter = ((i % 3) - 1) * 0.4
            rtt = max(0.5, round(base_rtt + jitter, 2))
            probes.append(PingProbe(
                seq=i + 1,
                success=True,
                rtt_ms=rtt,
                ttl=ttl_val,
                reply_from=target_ip,
                message=f"Reply from {target_ip}: bytes=32 time={rtt}ms TTL={ttl_val}"
            ))

        rtts = [p.rtt_ms for p in probes]
        path_names = [dev_map[n].name for n in path]

        return PingResponse(
            source_id=src_dev.id,
            source_name=src_dev.name,
            source_ip=src_ip,
            target_ip=target_ip,
            target_name=target_name,
            packets_sent=req.packet_count,
            packets_received=req.packet_count,
            packet_loss_percent=0.0,
            min_rtt_ms=min(rtts),
            avg_rtt_ms=round(sum(rtts) / len(rtts), 2),
            max_rtt_ms=max(rtts),
            reachable=True,
            probes=probes,
            failure_reason=None,
            path_taken=path_names
        )
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return PingResponse(
            source_id=src_dev.id,
            source_name=src_dev.name,
            source_ip=src_ip,
            target_ip=target_ip,
            target_name=target_name,
            packets_sent=req.packet_count,
            packets_received=0,
            packet_loss_percent=100.0,
            min_rtt_ms=0.0,
            avg_rtt_ms=0.0,
            max_rtt_ms=0.0,
            reachable=False,
            probes=[PingProbe(seq=i+1, success=False, rtt_ms=0.0, ttl=0, reply_from=src_ip, message="Request timed out") for i in range(req.packet_count)],
            failure_reason="No physical or logical path exists between source and target (links severed or partitioned).",
            path_taken=[]
        )

def simulate_traceroute(req: TracerouteRequest) -> TracerouteResponse:
    """
    Simulates traceroute using TTL decrement and hop analysis.
    """
    dev_map = {d.id: d for d in req.topology.devices}
    src_dev = dev_map.get(req.source_id)
    target_dev = dev_map.get(req.target_id)

    if not src_dev or not target_dev:
        raise ValueError("Invalid source or target device ID.")

    G = build_networkx_graph(req.topology, active_only=True)
    target_ip = target_dev.ip or "10.0.0.1"

    if src_dev.id not in G or target_dev.id not in G or not nx.has_path(G, src_dev.id, target_dev.id):
        return TracerouteResponse(
            source_name=src_dev.name,
            target_name=target_dev.name,
            target_ip=target_ip,
            completed=False,
            total_hops=1,
            hops=[TracerouteHop(
                hop_number=1,
                device_id=src_dev.id,
                device_name=src_dev.name,
                ip=src_dev.ip or "*",
                rtt_ms=0.0,
                status="Host Unreachable"
            )],
            summary=f"Traceroute failed: Destination '{target_dev.name}' is unreachable from '{src_dev.name}'."
        )

    path = nx.shortest_path(G, source=src_dev.id, target=target_dev.id, weight='cost')
    hops: List[TracerouteHop] = []
    accumulated_latency = 0.0

    for i in range(1, len(path)):
        node_id = path[i]
        node = dev_map[node_id]
        edge = G.get_edge_data(path[i-1], path[i])
        accumulated_latency += edge.get('latency', 5.0) * 2.0  # RTT
        
        hops.append(TracerouteHop(
            hop_number=i,
            device_id=node.id,
            device_name=node.name,
            ip=node.ip or f"L2-Port-{node.id}",
            rtt_ms=round(accumulated_latency, 2),
            status="Success"
        ))

    return TracerouteResponse(
        source_name=src_dev.name,
        target_name=target_dev.name,
        target_ip=target_ip,
        completed=True,
        total_hops=len(hops),
        hops=hops,
        summary=f"Traceroute complete: Reached '{target_dev.name}' ({target_ip}) across {len(hops)} hop(s) in {round(accumulated_latency, 2)}ms RTT."
    )

def simulate_stp(topology: Topology) -> STPResponse:
    """
    Simulates 802.1D Spanning Tree Protocol (STP) across switch connections.
    1. Compares switch Bridge IDs = (Priority, MAC).
    2. Elects Root Bridge (lowest Bridge ID).
    3. Calculates Root Path Cost for every other switch.
    4. Selects Root Ports and Designated Ports.
    5. Identifies redundant loops and sets blocking/discarding state to eliminate broadcast storms.
    """
    switches = [d for d in topology.devices if d.type == 'switch']
    dev_map = {d.id: d for d in topology.devices}

    if not switches:
        return STPResponse(
            root_bridge_id="",
            root_bridge_name="No switches in network",
            switches=[],
            blocked_link_ids=[],
            forwarding_link_ids=[l.id for l in topology.links],
            explanation="No switches exist in this topology. Spanning Tree Protocol operates at Layer 2 between switches."
        )

    # 1. Generate Bridge IDs: priority + MAC
    switch_macs = {s.id: s.mac_address or generate_mac(s.id) for s in switches}
    switch_priorities = {s.id: s.bridge_priority or 32768 for s in switches}
    
    # Bridge ID tuple: (priority, mac, switch_id)
    sorted_switches = sorted(
        switches,
        key=lambda s: (switch_priorities[s.id], switch_macs[s.id])
    )
    root_switch = sorted_switches[0]

    # 2. Build subgraph of switch-to-switch active links
    G_switches = nx.Graph()
    for s in switches:
        G_switches.add_node(s.id)

    switch_links = []
    link_lookup = {}
    for l in topology.links:
        if l.status == 'active':
            u_is_sw = l.source in switch_macs
            v_is_sw = l.target in switch_macs
            if u_is_sw and v_is_sw:
                G_switches.add_edge(l.source, l.target, id=l.id, cost=float(l.cost))
                switch_links.append(l)
                link_lookup[tuple(sorted([l.source, l.target]))] = l

    # If no interconnected switch loops, all links forward
    if G_switches.number_of_edges() == 0:
        return STPResponse(
            root_bridge_id=root_switch.id,
            root_bridge_name=root_switch.name,
            switches=[STPSwitchInfo(
                switch_id=s.id,
                switch_name=s.name,
                bridge_priority=switch_priorities[s.id],
                mac_address=switch_macs[s.id],
                bridge_id=f"{switch_priorities[s.id]}/{switch_macs[s.id]}",
                is_root_bridge=(s.id == root_switch.id),
                root_path_cost=0.0,
                ports=[]
            ) for s in switches],
            blocked_link_ids=[],
            forwarding_link_ids=[l.id for l in topology.links],
            explanation="Switches are not interconnected in a loop. All ports remain in Forwarding state."
        )

    # 3. Minimum Spanning Tree from Root Switch
    # Using Kruskal's / Prim's algorithm on the switch subgraph to form the active tree
    mst_edges = set()
    for component in nx.connected_components(G_switches):
        subgraph = G_switches.subgraph(component)
        tree = nx.minimum_spanning_tree(subgraph, weight='cost')
        for u, v in tree.edges():
            mst_edges.add(tuple(sorted([u, v])))

    blocked_links = []
    forwarding_links = []

    for l in topology.links:
        pair = tuple(sorted([l.source, l.target]))
        if pair in link_lookup:
            # It's an inter-switch link
            if pair in mst_edges:
                forwarding_links.append(l.id)
            else:
                blocked_links.append(l.id)
        else:
            # Endpoint links to PCs/servers/routers are designated forwarding
            forwarding_links.append(l.id)

    # Calculate root path costs for each switch
    switch_infos = []
    for s in switches:
        is_root = (s.id == root_switch.id)
        try:
            root_cost = nx.shortest_path_length(G_switches, source=s.id, target=root_switch.id, weight='cost')
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            root_cost = 999.0

        ports = []
        for l in switch_links:
            if l.source == s.id or l.target == s.id:
                other_id = l.target if l.source == s.id else l.source
                pair = tuple(sorted([l.source, l.target]))
                is_in_mst = pair in mst_edges

                if is_root:
                    role = "Designated Port"
                    state = "Forwarding"
                elif is_in_mst:
                    # If this edge leads towards root
                    role = "Root Port" if nx.has_path(G_switches, other_id, root_switch.id) else "Designated Port"
                    state = "Forwarding"
                else:
                    role = "Alternate (Blocked)"
                    state = "Blocking"

                ports.append(STPBridgePort(
                    link_id=l.id,
                    connected_device_id=other_id,
                    connected_device_name=dev_map[other_id].name,
                    role=role,
                    state=state,
                    cost=float(l.cost)
                ))

        switch_infos.append(STPSwitchInfo(
            switch_id=s.id,
            switch_name=s.name,
            bridge_priority=switch_priorities[s.id],
            mac_address=switch_macs[s.id],
            bridge_id=f"{switch_priorities[s.id]}/{switch_macs[s.id]}",
            is_root_bridge=is_root,
            root_path_cost=round(float(root_cost), 1),
            ports=ports
        ))

    explanation = (
        f"Switch '{root_switch.name}' won the Root Bridge election with lowest Bridge ID "
        f"({switch_priorities[root_switch.id]}/{switch_macs[root_switch.id]}). "
        f"To prevent Layer 2 switching broadcast storms, {len(blocked_links)} redundant link(s) "
        f"were transitioned into the Blocking/Discarding state, maintaining loop-free physical redundancy."
    )

    return STPResponse(
        root_bridge_id=root_switch.id,
        root_bridge_name=root_switch.name,
        switches=switch_infos,
        blocked_link_ids=blocked_links,
        forwarding_link_ids=forwarding_links,
        explanation=explanation
    )

def simulate_packet_walkthrough(req: PacketSimulationRequest) -> PacketSimulationResponse:
    """
    Step-by-step packet traversal walkthrough displaying L2 Ethernet Frame, L3 IP Packet,
    ARP address resolution, next-hop routing decisions, and TCP/UDP header states.
    """
    dev_map = {d.id: d for d in req.topology.devices}
    src_dev = dev_map.get(req.source_id)
    target_dev = dev_map.get(req.target_id)

    if not src_dev or not target_dev:
        raise ValueError("Source or target device not found.")

    src_mac = src_dev.mac_address or generate_mac(src_dev.id)
    target_mac = target_dev.mac_address or generate_mac(target_dev.id)
    src_ip = src_dev.ip or "192.168.1.100"
    target_ip = target_dev.ip or "10.0.0.100"

    G = build_networkx_graph(req.topology, active_only=True)

    if src_dev.id not in G or target_dev.id not in G or not nx.has_path(G, src_dev.id, target_dev.id):
        return PacketSimulationResponse(
            protocol=req.protocol,
            success=False,
            steps=[
                PacketStep(
                    step_number=1,
                    current_device_id=src_dev.id,
                    current_device_name=src_dev.name,
                    device_type=src_dev.type,
                    action="Dropped",
                    layer="Layer 3 (Network)",
                    src_mac=src_mac,
                    dst_mac="FF:FF:FF:FF:FF:FF",
                    src_ip=src_ip,
                    dst_ip=target_ip,
                    protocol=req.protocol,
                    info="No physical or logical path exists. Packet dropped at source.",
                    status="dropped"
                )
            ],
            failure_reason=f"Routing failure: Device '{src_dev.name}' has no active route to reach '{target_dev.name}'.",
            three_way_handshake=None,
            educational_summary="Packet dropped immediately because the destination is partitioned or the link is down."
        )

    path = nx.shortest_path(G, source=src_dev.id, target=target_dev.id, weight='cost')
    steps: List[PacketStep] = []
    step_num = 1

    current_src_mac = src_mac

    # Step 1: Originating Host
    first_hop_id = path[1] if len(path) > 1 else src_dev.id
    first_hop_dev = dev_map[first_hop_id]
    first_hop_mac = first_hop_dev.mac_address or generate_mac(first_hop_dev.id)

    # ARP resolution step if first hop is router/switch
    steps.append(PacketStep(
        step_number=step_num,
        current_device_id=src_dev.id,
        current_device_name=src_dev.name,
        device_type=src_dev.type,
        action="ARP Resolution & Framing",
        layer="Layer 2 (Data Link)",
        src_mac=src_mac,
        dst_mac="FF:FF:FF:FF:FF:FF (Broadcast)" if first_hop_dev.type == 'switch' else first_hop_mac,
        src_ip=src_ip,
        dst_ip=target_ip,
        protocol="ARP / " + req.protocol,
        info=f"Host '{src_dev.name}' consults local ARP cache. Encapsulates Layer 3 IP Packet into Layer 2 Ethernet Frame.",
        status="ok"
    ))
    step_num += 1

    # Intermediary hops
    for i in range(1, len(path) - 1):
        curr_id = path[i]
        curr_dev = dev_map[curr_id]
        next_id = path[i+1]
        next_dev = dev_map[next_id]
        
        curr_mac = curr_dev.mac_address or generate_mac(curr_dev.id)
        next_mac = next_dev.mac_address or generate_mac(next_dev.id)

        if curr_dev.type == 'router':
            # Layer 3 Router rewrites L2 MAC addresses! L3 IP addresses remain constant
            action = "Layer 3 Routing & L2 Header Rewrite"
            layer = "Layer 3 (Network)"
            info = (
                f"Router '{curr_dev.name}' decrements TTL, looks up destination {target_ip} in routing table, "
                f"and rewrites Layer 2 MACs: Src MAC -> {curr_mac}, Next-Hop Dst MAC -> {next_mac}."
            )
            out_src_mac = curr_mac
            out_dst_mac = next_mac
        elif curr_dev.type == 'switch':
            # Layer 2 Switch forwards frame without changing MACs or IP
            action = "Layer 2 Switching (CAM Table Lookup)"
            layer = "Layer 2 (Data Link)"
            info = f"Switch '{curr_dev.name}' reads Destination MAC and forwards transparently out egress port towards '{next_dev.name}'."
            out_src_mac = current_src_mac
            out_dst_mac = next_mac
        else:
            action = "Forwarding"
            layer = "Layer 2 / 3"
            info = f"Forwarding via node '{curr_dev.name}'."
            out_src_mac = current_src_mac
            out_dst_mac = next_mac

        steps.append(PacketStep(
            step_number=step_num,
            current_device_id=curr_dev.id,
            current_device_name=curr_dev.name,
            device_type=curr_dev.type,
            action=action,
            layer=layer,
            src_mac=out_src_mac,
            dst_mac=out_dst_mac,
            src_ip=src_ip,
            dst_ip=target_ip,
            protocol=req.protocol,
            info=info,
            status="ok"
        ))
        current_src_mac = out_src_mac
        step_num += 1

    # Final destination arrival
    steps.append(PacketStep(
        step_number=step_num,
        current_device_id=target_dev.id,
        current_device_name=target_dev.name,
        device_type=target_dev.type,
        action="Destination Received & Decapsulation",
        layer="Layer 4 (Transport)" if req.protocol in ['TCP', 'UDP'] else "Layer 3 (Network)",
        src_mac=current_src_mac,
        dst_mac=target_mac,
        src_ip=src_ip,
        dst_ip=target_ip,
        protocol=f"{req.protocol} (Port {req.dest_port})" if req.protocol in ['TCP', 'UDP'] else req.protocol,
        info=f"Destination '{target_dev.name}' stripped Layer 2 Frame, verified Destination IP ({target_ip}), and processed payload.",
        status="ok"
    ))

    # TCP Handshake sequence simulation
    handshake = None
    if req.protocol == 'TCP':
        handshake = [
            {"step": "1. SYN", "from": src_dev.name, "to": target_dev.name, "flag": "SYN (Seq=100)", "desc": "Client initiates connection request."},
            {"step": "2. SYN-ACK", "from": target_dev.name, "to": src_dev.name, "flag": "SYN-ACK (Seq=300, Ack=101)", "desc": "Server acknowledges and synchronizes sequence."},
            {"step": "3. ACK", "from": src_dev.name, "to": target_dev.name, "flag": "ACK (Seq=101, Ack=301)", "desc": "Client acknowledges server. Three-Way Handshake Established!"}
        ]
    elif req.protocol == 'UDP':
        handshake = [
            {"step": "1. Datagram", "from": src_dev.name, "to": target_dev.name, "flag": "UDP Payload", "desc": "Connectionless transmission without handshake or guaranteed delivery."}
        ]

    summary = (
        f"Simulated {req.protocol} delivery between '{src_dev.name}' ({src_ip}) and '{target_dev.name}' ({target_ip}) "
        f"completed successfully in {len(steps)} steps across {len(path)-1} physical link(s)."
    )

    return PacketSimulationResponse(
        protocol=req.protocol,
        success=True,
        steps=steps,
        failure_reason=None,
        three_way_handshake=handshake,
        educational_summary=summary
    )
