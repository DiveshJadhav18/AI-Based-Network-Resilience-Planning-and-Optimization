# AI-Based Network Resilience Planning and Optimization

A student-friendly Computer Networks web application designed to demonstrate fundamental network topology modeling, graph-based routing algorithms, single-point-of-failure (bridge) analysis, link failure simulation, resilience optimization, and machine learning telemetry risk estimation.

---

## 1. Project Overview & Problem Statement

Modern communication networks require high resilience to prevent catastrophic partitioning during hardware failures, cable cuts, or congestion. In enterprise topologies, understanding single points of failure (bridges) and dynamically evaluating alternate routes is essential for reliability.

This project delivers an interactive web environment where users can:
1. **Design and configure network topologies** with Routers, Switches, PCs, and Servers.
2. **Execute shortest-path routing** using Dijkstra's algorithm.
3. **Detect critical bridge connections** whose removal fragments the network into disconnected segments.
4. **Simulate link outages** in real time, calculating isolated devices and alternate paths.
5. **Receive algorithmic backup recommendations** that intelligently restore connectivity.
6. **Compare quantitative resilience metrics** before and after applying backup links.
7. **Predict link failure probability** using a Random Forest machine learning model trained on network telemetry (bandwidth utilization, latency, packet drop rate, previous outage count, and cable age).

---

## 2. Computer Networks Concepts Demonstrated

- **Graph Representation of Networks:** Devices modeled as graph vertices \(V\) and links modeled as weighted edges \(E\).
- **Dijkstra's Shortest Path Algorithm:** Optimal routing determined by accumulated link metric costs.
- **Bridge Detection:** Identification of critical edges that increase the number of connected components when severed.
- **Network Partitioning & Connected Components:** Quantifying reachability loss and isolated subnetworks.
- **Link Telemetry Analysis:** Evaluation of bandwidth utilization, latency in milliseconds, and packet drop percentages.
- **Failover & Alternate Path Routing:** Dynamic recalculation of paths avoiding failed transmission links.
- **Network Redundancy Planning:** Proactive insertion of candidate backup edges to eliminate critical single points of failure.

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
- Inspect and edit device names, types, and IPv4 addresses.
- Configure link cost, latency (ms), bandwidth (Mbps), and operational status.
- Built-in Dijkstra routing calculator: Select source and destination to compute and visually animate the shortest path.
- Save and load topologies from local storage.

### Page 3: Failure Analysis & Resilience
- Select any link and click **Simulate Failure**.
- Highlights severed connections in dashed red.
- Detects whether the network was partitioned, lists all affected isolated devices, and checks server reachability.
- Determines whether a secondary alternate path exists and displays new hop counts and latency.
- Generates algorithmic backup link recommendations with improvement scores.
- One-click **Apply Recommendation** button that directly adds the backup link to the topology.
- Quantitative Before vs. After comparison table.

### Page 4: Link Risk Prediction (ML)
- Evaluates telemetry factors (utilization, latency, packet loss, failure history, age).
- Random Forest model evaluation metrics: Accuracy, Precision, Recall, and F1-Score.
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
cd "c:\Users\Divesh Jadhav\Downloads\CN_Project\backend"
python -m pip install -r requirements.txt
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
Run the automated pytest test suite covering all 12 validation and graph scenarios:

```powershell
cd "c:\Users\Divesh Jadhav\Downloads\CN_Project\backend"
python -m pytest tests -v
```

### End-to-End API Pipeline Verification
Run the verification script against the running FastAPI server:

```powershell
cd "c:\Users\Divesh Jadhav\Downloads\CN_Project"
python verify_pipeline.py
```

### Frontend Production Build
To verify production bundling without compilation or lint errors:

```powershell
cd "c:\Users\Divesh Jadhav\Downloads\CN_Project\frontend"
npm run build
```

---

## 7. Educational Limitations & Assumptions

1. **Graph Model vs. Real Hardware:** The system models network connections as graph edges with weights. It is intended for educational topology simulation and does not claim to run real router firmware (Cisco IOS) or dynamic routing protocols (OSPF, BGP, RIP).
2. **Layer 2 / Layer 3 Abstraction:** Switches and routers are treated as nodes in an undirected graph; broadcast domains and VLAN tags are not simulated.
3. **ML Telemetry Data:** The failure risk prediction model is trained on reproducible synthetic network telemetry metrics for educational demonstration.
