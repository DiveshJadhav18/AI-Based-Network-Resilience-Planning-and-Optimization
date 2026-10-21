# Implementation Plan: Enhancing NetResilience Studio into Interactive CN Learning & Simulation Platform

## Overview
We will extend the existing NetResilience Studio codebase in **4 clean, non-breaking phases** as requested, preserving all current features (React Flow editor, bridge analysis, Dijkstra routing, failure simulation, backup recommendations, ML predictions).

---

## Phase 1: Essential CN Foundations
1. **Extend Models (`backend/models.py`)**:
   - `Device`: add optional `subnet_mask` (default `255.255.255.0` or `/24`), `gateway`, `vlan_id`, `mac_address`.
   - `Link`: add optional `vlan_tagged`, `stp_state` (forwarding, blocking, root, designated).
   - New schemas: `SubnetCalcRequest`, `SubnetCalcResponse`, `RouteEntry`, `RoutingTableResponse`, `PingRequest`, `PingResponse`, `TracerouteRequest`, `TracerouteResponse`.
2. **Subnetting & Diagnostics Engine (`backend/cn_protocols.py`)**:
   - Subnet/CIDR calculations using Python `ipaddress`. Usable host range, broadcast address, valid default gateway checks.
   - Routing table generator: connected subnets, static routes, next-hop device/IP, metric, interface.
   - Ping simulator: ICMP Echo Request/Reply with TTL, packet loss, RTT calculation based on link latency, failure reasons (network unreachable, host unreachable, VLAN isolation).
   - Traceroute simulator: Hop-by-hop traversal respecting link status, next hops, response times.
3. **API Endpoints (`backend/main.py`)**:
   - `POST /api/cn/subnet-calc`
   - `POST /api/cn/routing-tables`
   - `POST /api/cn/ping`
   - `POST /api/cn/traceroute`
4. **Backend Tests**:
   - Extend pytest suite to test subnet calculations, routing tables, ping, and traceroute.

---

## Phase 2: Layer 2 & Layer 3 (VLANs, Inter-VLAN Routing & STP)
1. **VLANs & STP Models & Logic (`backend/cn_protocols.py`)**:
   - VLAN configuration on switches and routers (Access vs Trunk ports, allowed VLANs, 802.1Q tagging concept).
   - Inter-VLAN routing check (requires router gateway on the subnet).
   - Spanning Tree Protocol (STP) simulation:
     - Bridge priority & Bridge ID comparison ($Priority + MAC$).
     - Root Bridge election (lowest Bridge ID).
     - Root Port & Designated Port election using link path costs.
     - Blocking/discarding state on redundant loops to prevent broadcast storms.
     - Recalculates dynamically when link failure occurs.
2. **API Endpoints (`backend/main.py`)**:
   - `POST /api/cn/stp-status`
   - `POST /api/cn/vlan-validate`

---

## Phase 3: Packet Simulation & Protocol Walkthrough
1. **Packet Simulation Engine (`backend/cn_protocols.py`)**:
   - Packet flow step generator:
     - Supports ICMP, TCP (SYN -> SYN-ACK -> ACK), UDP datagram.
     - Generates detailed hop steps: Current device, Layer 2 Ethernet frame (Src MAC, Dst MAC), Layer 3 IP packet (Src IP, Dst IP), VLAN tag, ARP resolution step, Forwarding/Dropping decision.
2. **API Endpoints**:
   - `POST /api/cn/packet-simulation`
3. **Frontend UI Components**:
   - Visual step-by-step playback panel with Play/Pause/Next/Reset, inspecting OSI headers at each device.

---

## Phase 4: Learning Panel & Frontend Navigation Integration
1. **Frontend Pages & Components**:
   - Add **Diagnostics & Tools** page / tabs:
     - Subnet & CIDR Calculator.
     - Ping & Traceroute console with real-time feedback.
     - Routing Table inspector.
     - STP Switch Loop Prevention inspector.
     - Packet Flow Animator.
   - Interactive **CN Learning Mode ("Learn This Concept")** modal/drawer accessible throughout the app:
     - Concept name, OSI/TCP-IP layer, Purpose, Configuration inputs, Process & Formula, Current Topology Result, Failure case analysis, and Viva questions.
2. **Verification & Regression Testing**:
   - Run backend pytest (all existing tests + new tests).
   - Run frontend `npm run build`.
   - Update `README.md` with complete documentation.
