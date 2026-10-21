from models import Topology, Device, Link

def get_sample_topology() -> Topology:
    """
    Standard predefined company network with 11 devices:
    - 2 Routers (Core Router R1, Gateway Router R2)
    - 3 Switches (Engineering SW1, Operations SW2, Server Farm SW3)
    - 4 PCs (HR PC, Finance PC, IT PC, Engineering PC)
    - 2 Servers (Web Server, Database Server)
    
    Includes:
    - Redundant path between R1 <-> R2
    - Critical single-point-of-failure bridge (SW3 <-> DB-Server or R1 <-> SW1)
    - Configured Subnets, Gateways, and VLAN IDs for Inter-VLAN routing demonstrations
    """
    devices = [
        # Routers
        Device(id="r1", name="Core Router R1", type="router", ip="192.168.1.1", subnet_mask="255.255.255.0", gateway="192.168.1.1", vlan_id=1, mac_address="00:1A:2B:3C:4D:01", x=350, y=100),
        Device(id="r2", name="Gateway Router R2", type="router", ip="192.168.2.1", subnet_mask="255.255.255.0", gateway="192.168.2.1", vlan_id=1, mac_address="00:1A:2B:3C:4D:02", x=650, y=100),
        
        # Switches (with bridge priorities for STP simulation)
        Device(id="sw1", name="Switch SW-HR", type="switch", ip=None, vlan_id=10, bridge_priority=32768, mac_address="00:AA:BB:CC:DD:01", x=200, y=260),
        Device(id="sw2", name="Switch SW-Ops", type="switch", ip=None, vlan_id=20, bridge_priority=28672, mac_address="00:AA:BB:CC:DD:02", x=500, y=260),  # Lowest Priority = Root Bridge Candidate!
        Device(id="sw3", name="Switch SW-DataCenter", type="switch", ip=None, vlan_id=30, bridge_priority=32768, mac_address="00:AA:BB:CC:DD:03", x=800, y=260),
        
        # PCs with configured subnets and gateways
        Device(id="pc_hr", name="HR PC", type="pc", ip="192.168.10.11", subnet_mask="255.255.255.0", gateway="192.168.10.1", vlan_id=10, mac_address="00:E0:4C:11:22:01", x=120, y=420),
        Device(id="pc_fin", name="Finance PC", type="pc", ip="192.168.10.12", subnet_mask="255.255.255.0", gateway="192.168.10.1", vlan_id=10, mac_address="00:E0:4C:11:22:02", x=260, y=420),
        Device(id="pc_it", name="IT PC", type="pc", ip="192.168.20.15", subnet_mask="255.255.255.0", gateway="192.168.20.1", vlan_id=20, mac_address="00:E0:4C:22:33:01", x=420, y=420),
        Device(id="pc_eng", name="Eng PC", type="pc", ip="192.168.20.16", subnet_mask="255.255.255.0", gateway="192.168.20.1", vlan_id=20, mac_address="00:E0:4C:22:33:02", x=560, y=420),
        
        # Servers
        Device(id="srv_web", name="Web Server", type="server", ip="10.0.0.10", subnet_mask="255.255.255.0", gateway="10.0.0.1", vlan_id=30, mac_address="00:50:56:AA:BB:01", x=740, y=420),
        Device(id="srv_db", name="Database Server", type="server", ip="10.0.0.20", subnet_mask="255.255.255.0", gateway="10.0.0.1", vlan_id=30, mac_address="00:50:56:AA:BB:02", x=880, y=420),
    ]

    links = [
        # Inter-Router Link (Redundancy backbone)
        Link(id="l_r1_r2", source="r1", target="r2", cost=1.0, latency=4.0, bandwidth=1000.0, status="active", utilization=35.0, packet_loss=0.1, failure_history=0, age_months=6),
        
        # Router to Switches
        Link(id="l_r1_sw1", source="r1", target="sw1", cost=2.0, latency=5.0, bandwidth=100.0, status="active", port_mode="trunk", allowed_vlans=[10, 20, 30], utilization=55.0, packet_loss=0.4, failure_history=1, age_months=14),
        Link(id="l_r1_sw2", source="r1", target="sw2", cost=2.0, latency=6.0, bandwidth=100.0, status="active", port_mode="trunk", allowed_vlans=[10, 20, 30], utilization=40.0, packet_loss=0.2, failure_history=0, age_months=10),
        Link(id="l_r2_sw2", source="r2", target="sw2", cost=2.0, latency=5.0, bandwidth=100.0, status="active", port_mode="trunk", allowed_vlans=[10, 20, 30], utilization=45.0, packet_loss=0.3, failure_history=0, age_months=8),
        Link(id="l_r2_sw3", source="r2", target="sw3", cost=1.5, latency=3.0, bandwidth=1000.0, status="active", port_mode="trunk", allowed_vlans=[10, 20, 30], utilization=78.0, packet_loss=1.8, failure_history=2, age_months=24),
        
        # Inter-Switch Redundant Link (For STP loop demonstration!)
        Link(id="l_sw1_sw2", source="sw1", target="sw2", cost=4.0, latency=3.0, bandwidth=100.0, status="active", port_mode="trunk", allowed_vlans=[10, 20, 30], utilization=20.0, packet_loss=0.0, failure_history=0, age_months=5),

        # SW1 Connections (VLAN 10 Access)
        Link(id="l_sw1_hr", source="sw1", target="pc_hr", cost=1.0, latency=2.0, bandwidth=100.0, status="active", port_mode="access", allowed_vlans=[10], utilization=25.0, packet_loss=0.0, failure_history=0, age_months=12),
        Link(id="l_sw1_fin", source="sw1", target="pc_fin", cost=1.0, latency=2.0, bandwidth=100.0, status="active", port_mode="access", allowed_vlans=[10], utilization=30.0, packet_loss=0.1, failure_history=0, age_months=12),
        
        # SW2 Connections (VLAN 20 Access)
        Link(id="l_sw2_it", source="sw2", target="pc_it", cost=1.0, latency=2.0, bandwidth=100.0, status="active", port_mode="access", allowed_vlans=[20], utilization=60.0, packet_loss=0.8, failure_history=1, age_months=18),
        Link(id="l_sw2_eng", source="sw2", target="pc_eng", cost=1.0, latency=2.0, bandwidth=100.0, status="active", port_mode="access", allowed_vlans=[20], utilization=50.0, packet_loss=0.5, failure_history=0, age_months=18),
        
        # SW3 Connections (Data center - VLAN 30 Access)
        Link(id="l_sw3_web", source="sw3", target="srv_web", cost=1.0, latency=1.5, bandwidth=1000.0, status="active", port_mode="access", allowed_vlans=[30], utilization=65.0, packet_loss=0.6, failure_history=0, age_months=12),
        Link(id="l_sw3_db", source="sw3", target="srv_db", cost=1.0, latency=1.0, bandwidth=1000.0, status="active", port_mode="access", allowed_vlans=[30], utilization=85.0, packet_loss=2.5, failure_history=3, age_months=36),
    ]

    return Topology(
        id="sample-corp-net",
        name="Enterprise Campus Network (Sample)",
        devices=devices,
        links=links
    )
