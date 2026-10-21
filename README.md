# NetResilience Studio: AI-Based Network Resilience Planning and Optimization

A student-friendly, full-featured Computer Networks simulation platform designed to demonstrate interactive network topology modeling, IPv4 subnetting & CIDR calculations, next-hop routing tables, ICMP Ping & Traceroute, L2 Ethernet / L3 IP packet framing, Spanning Tree Protocol (STP 802.1D) loop prevention, single-point-of-failure bridge detection, failover simulation, and Random Forest link failure risk estimation.

---

## 1. Project Overview & Problem Statement

Modern communication networks require high resilience and fault tolerance to prevent catastrophic partitioning during hardware failures, cable cuts, or congestion. In enterprise topologies, understanding single points of failure (bridges), VLAN segmentation, loop prevention, and packet framing is fundamental for computer networking students and engineers.

This platform delivers an interactive simulation and diagnostic environment where users can:
1. **Design and configure network topologies** with Routers, Switches, PCs, and Servers.
2. **Calculate IPv4 Subnets & CIDR Prefixes** with network addresses, usable host ranges, and broadcast bounds.
3. **Inspect Router Routing Tables** with connected interfaces, static routes, and Dijkstra-OSPF paths.
4. **Simulate ICMP Echo (Ping)** with Round-Trip Times (RTT), TTL, and packet loss diagnostics.
5. **Simulate Traceroute** to track hop-by-hop traversal and intermediate router response times.
6. **Walk through L2/L3 Packet Framing** inspecting Ethernet MAC addresses (and router MAC rewrites), IPv4 headers, and TCP/UDP handshakes.
7. **Simulate Spanning Tree Protocol (STP 802.1D)** with Root Bridge elections and Alternate/Blocking port states to prevent broadcast storms.
8. **Detect critical bridge connections** whose removal disconnects network segments.
9. **Simulate link outages** in real time, calculating isolated devices and alternate paths.
10. **Receive algorithmic backup recommendations** that intelligently restore connectivity.
11. **Compare quantitative resilience metrics** before and after applying backup links.
12. **Predict link failure probability** using a Random Forest machine learning model trained on network telemetry.
13. **Explore the CN Learning Mode** with direct viva questions, formulas, and failure case explanations.

---

## 2. Computer Networks Concepts Demonstrated

- **Graph Representation of Networks:** Devices modeled as graph vertices \(V\) and links modeled as weighted edges \(E\).
- **Subnetting & CIDR (RFC 4632):** Prefix masking, host allocation ($2^{32-\text{prefix}} - 2$), and subnet membership tests.
- **Dijkstra's Shortest Path Algorithm:** Optimal routing determined by accumulated link metric costs ($O(E + V \log V)$).
- **Routing Tables & Next-Hop Forwarding:** Connected routes, next-hop IP mapping, and outgoing interface lookup.
- **ICMP Echo & Traceroute (RFC 792):** Ping probes, round-trip time (RTT), TTL decrementing, and Time Exceeded responses.
- **Layer 2 / Layer 3 Encapsulation:** Ethernet framing, ARP address resolution, and router MAC address rewriting.
- **Spanning Tree Protocol (IEEE 802.1D):** Bridge Priority + MAC comparison, Root Bridge election, and blocking redundant links to prevent switching loops.
- **Bridge Detection:** Identification of critical edges that increase the number of connected components when severed ($C(G - e) > C(G)$).
- **Fault Tolerance & Alternate Path Routing:** Dynamic recalculation of paths avoiding failed transmission links.

---

## 3. Technology Stack

- **Frontend:**
  - React 19 with Vite
  - Tailwind CSS v4
  - React Flow (`@xyflow/react`) for topology visualization and drag-and-drop editing
  - Lucide React for network device iconography
  - Axios for asynchronous REST API communication
- **Backend:**
  - Python 3.10+ / 3.14
  - FastAPI
  - NetworkX for graph theory algorithms
  - scikit-learn for Random Forest classification
  - pandas and NumPy for telemetry modeling
  - Pydantic v2 for data validation and schemas
- **Storage:**
  - JSON-based persistent topology storage in `backend/saved_topologies/`.

---

## 4. Application Pages & Features

### Page 1: Dashboard
- Summary cards: Total devices, active links, critical bridges, and graph connectivity status.
- Real-time list of identified network weaknesses and configuration issues.
- One-click shortcuts to Create New Network, Load Sample Network, and Launch Topology Editor.

### Page 2: Network Topology Editor
- Interactive React Flow canvas: Drag devices, connect handles to establish links, and zoom/pan.
- Add and configure routers, switches, workstation PCs, and servers.
- Inspect and edit device names, types, IPv4 addresses, subnet masks, gateways, and VLAN IDs.
- Configure link cost, latency (ms), bandwidth (Mbps), and operational status.
- Built-in Dijkstra routing calculator: Select source and destination to compute and visually animate the shortest path.
- Save and load topologies from local storage.

### Page 3: Protocol Simulator (NEW)
- **Subnet & CIDR Calculator:** Computes network ID, broadcast, and usable host bounds; tests whether two devices reside in the same subnet.
- **Routing Tables:** Live table view of connected and computed routes for every router in the topology.
- **ICMP Ping Console:** Transmits live probes, measures RTT, and displays realistic console output.
- **Traceroute:** Tracks hop-by-hop traversal and detects unreachable nodes.
- **Packet Flow (L2/L3):** Step-by-step frame inspection showing MAC rewrites at routers, unchanged end-to-end IPs, and TCP 3-way handshakes (SYN, SYN-ACK, ACK).
- **Spanning Tree Protocol (STP):** Elects the Root Bridge by lowest Bridge ID and transitions redundant loop ports to Blocking/Discarding.
- **CN Learning Mode:** Built-in modal explaining OSI layers, protocol purpose, formulas, and viva questions.

### Page 4: Failure Analysis & Resilience
- Select any link and click **Simulate Failure**.
- Highlights severed connections in dashed red.
- Detects whether the network was partitioned, lists all affected isolated devices, and checks server reachability.
- Determines whether a secondary alternate path exists and displays new hop counts and latency.
- Generates algorithmic backup link recommendations with improvement scores.
- One-click **Apply Recommendation** button that directly adds the backup link to the topology.
- Quantitative Before vs. After comparison table.

### Page 5: Link Risk Prediction (ML)
- Evaluates telemetry factors (utilization, latency, packet loss, failure history, age).
- Random Forest model evaluation metrics: Accuracy (95.3%), Precision, Recall, and F1-Score.
- Interactive table showing failure probability and Low/Medium/High risk classifications.
- Detail inspector breaking down telemetry metrics and reasoning for each connection.

---

## 5. Local Setup & Windows Run Commands

### Prerequisites
- Python 3.10+ installed
- Node.js (v18+) and npm installed

### Step 1: Start the Backend (FastAPI)

Open PowerShell and navigate to the project root:

```powershell
cd "c:\Users\Divesh Jadhav\Downloads\CN_Project"
$env:PYTHONPATH="backend"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend will be active at: `http://127.0.0.1:8000`  
API Swagger Documentation: `http://127.0.0.1:8000/docs`

### Step 2: Start the Frontend (React + Vite)

Open a second PowerShell window:

```powershell
cd "c:\Users\Divesh Jadhav\Downloads\CN_Project\frontend"
npm install
npm run dev
```

Frontend will be active at: `http://localhost:5173`

---

## 6. Running Automated Tests

### Backend Unit & Integration Tests (pytest)
Run the automated pytest test suite covering all 19 validation, graph, and protocol scenarios:

```powershell
cd "c:\Users\Divesh Jadhav\Downloads\CN_Project"
$env:PYTHONPATH="backend"
python -m pytest backend/tests -v
```

**Test Results:**
- 19 passed in 6.33s (including Subnetting, Routing Tables, Ping, Traceroute, STP, and TCP Packet Framing).

### Frontend Production Build
To verify production bundling without compilation or lint errors:

```powershell
cd "c:\Users\Divesh Jadhav\Downloads\CN_Project\frontend"
npm run build
```

---

## 7. Educational Limitations & Assumptions

1. **Graph Model vs. Physical Hardware:** The system models network connections as graph edges with metric weights; this project is an educational model and does not claim to run real router operating systems (Cisco IOS) or dynamic protocols like BGP in kernel space.
2. **Layer 2 / Layer 3 Abstraction:** Devices are vertices in a graph; broadcast domains and VLAN tagging are simulated logically for college-level clarity.
3. **ML Synthetic Telemetry:** The Random Forest model is trained on synthetic telemetry data to demonstrate how predictive machine learning can complement traditional graph algorithms.
