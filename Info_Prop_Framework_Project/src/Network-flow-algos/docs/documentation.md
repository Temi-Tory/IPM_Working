# IPA Framework -- Documentation {#ipa-framework}

**Information Propagation Analysis Framework**

A Julia + Angular web application for analyzing Directed Acyclic Graph (DAG) networks using belief propagation, capacity analysis, and critical path methods under precise, interval, and p-box uncertainty.

---

## Table of Contents {#table-of-contents}

1. [Getting Started](#getting-started)
   - 1.1 [System Requirements](#system-requirements)
   - 1.2 [Installation & Setup](#installation)
   - 1.3 [Quick Start Tutorial](#quick-start)
2. [Architecture Overview](#architecture)
   - 2.1 [System Architecture](#system-architecture)
   - 2.2 [Supported Data Types](#data-types)
   - 2.3 [Multi-Scenario Architecture](#multi-scenario)
3. [Uploading & Managing Networks](#uploading)
   - 3.1 [Supported File Formats](#file-formats)
   - 3.2 [Uploading a Network](#uploading-network)
   - 3.3 [File Manager & Scenarios](#file-manager)
4. [Network Structure Analysis](#network-structure)
   - 4.1 [What It Shows](#structure-overview)
   - 4.2 [Node Types](#node-types)
   - 4.3 [Iteration Sets](#iteration-sets)
   - 4.4 [Ancestors & Descendants](#ancestors-descendants)
5. [Diamond Analysis](#diamond-analysis)
   - 5.1 [What Are Diamonds?](#what-are-diamonds)
   - 5.2 [Diamond Structure](#diamond-structure)
   - 5.3 [Diamond Identification Algorithm](#diamond-algorithm)
   - 5.4 [Diamond Nesting & Pre-computation](#diamond-nesting)
   - 5.5 [Diamond Classification](#diamond-classification)
   - 5.6 [Subgraph Analysis](#subgraph-analysis)
6. [Exact Inference](#exact-inference)
   - 6.1 [Mathematical Foundation](#inference-math)
   - 6.2 [Algorithm Walkthrough](#inference-algorithm)
   - 6.3 [Multi-Scenario Analysis](#inference-scenarios)
   - 6.4 [Interpreting Results](#inference-results)
7. [Capacity Analysis](#capacity-analysis)
   - 7.1 [Network Flow Model](#capacity-model)
   - 7.2 [Analysis Types](#capacity-types)
   - 7.3 [Bottleneck Identification](#bottleneck-identification)
   - 7.4 [Edge Utilization](#edge-utilization)
8. [Critical Path Method (CPM)](#cpm-analysis)
   - 8.1 [Overview](#cpm-overview)
   - 8.2 [Time Analysis](#time-analysis)
   - 8.3 [Cost Analysis](#cost-analysis)
   - 8.4 [Gantt Chart View](#gantt-chart)
   - 8.5 [Path Comparison](#path-comparison)
9. [API Reference](#api-reference)
   - 9.1 [Health Check](#api-health)
   - 9.2 [Upload Files](#api-upload)
   - 9.3 [Network Structure](#api-structure)
   - 9.4 [Diamond Analysis](#api-diamonds)
   - 9.5 [Reachability / Exact Inference](#api-reachability)
   - 9.6 [Capacity Analysis](#api-capacity)
   - 9.7 [CPM Analysis](#api-cpm)
   - 9.8 [Diamond Subgraph Analysis](#api-subgraph)
10. [Glossary](#glossary)

---

## 1. Getting Started {#getting-started}

This section covers everything you need to install, configure, and run the IPA Framework for the first time.

---

### 1.1 System Requirements {#system-requirements}

**Runtime Dependencies**

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| Julia | 1.9+ | Must be launched with `--threads=auto` for parallel diamond processing |
| Node.js | 18+ | Required for Angular CLI and the Nx workspace |
| Angular | 17+ | Standalone components, signals-based reactivity |
| Browser | Chrome, Firefox, or Edge (latest) | WebSocket and modern CSS support required |

**Julia Packages**

The backend depends on the following Julia packages. These are resolved automatically by the project's `Project.toml`, but for reference:

| Package | Purpose |
|---------|---------|
| `HTTP.jl` | HTTP server and request routing |
| `JSON.jl` | JSON serialization and deserialization for API payloads |
| `ProbabilityBoundsAnalysis.jl` | P-box arithmetic, interval operations, and uncertainty propagation |
| `Base.Threads` | Multi-threaded diamond pre-computation and parallel iteration-set processing |

**Hardware Recommendations**

- **RAM**: 4 GB minimum; 8 GB+ recommended for large networks (500+ nodes) with p-box arithmetic
- **CPU**: Multi-core recommended; the backend spawns threads proportional to Julia's `Threads.nthreads()`
- **Disk**: Minimal; temporary upload files are stored under `temp_uploads/` and can be periodically cleaned

---

### 1.2 Installation & Setup {#installation}

#### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd Info_Prop_Framework_Project
```

#### Step 2: Install Julia Dependencies

Open a Julia REPL in the project root and activate the environment:

```julia
using Pkg
Pkg.activate(".")
Pkg.instantiate()
```

This will resolve and download all required Julia packages.

#### Step 3: Start the Backend Server

Launch the Julia HTTP backend with thread support enabled:

```bash
julia --threads=auto src/Network-flow-algos/backend_server.jl
```

The server starts on **port 8080** by default. You should see output indicating the server is listening:

```
[ Info: Server listening on 0.0.0.0:8080
```

**Verify the backend is running** with a health check:

```bash
curl http://localhost:8080/health
```

Expected response:

```json
{ "status": "healthy" }
```

#### Step 4: Install Frontend Dependencies

Navigate to the Angular frontend directory and install Node.js dependencies:

```bash
cd src/Network-flow-algos/front-end/inf-prop-ui
npm install
```

#### Step 5: Start the Frontend Development Server

```bash
npx nx serve info-prop-ui
```

The Angular application starts on **port 4200**. Open your browser and navigate to:

```
http://localhost:4200
```

#### Summary of Running Services

| Service | Command | Port | URL |
|---------|---------|------|-----|
| Backend (Julia) | `julia --threads=auto backend_server.jl` | 8080 | `http://localhost:8080` |
| Frontend (Angular) | `npx nx serve info-prop-ui` | 4200 | `http://localhost:4200` |

---

### 1.3 Quick Start Tutorial {#quick-start}

This walkthrough takes you from zero to your first analysis in five steps.

**Step 1: Prepare Your Network Files**

You need at minimum three files:

1. An `.EDGES` file defining the DAG structure
2. A node priors JSON file with prior probabilities for each node
3. A link probabilities JSON file with transmission probabilities for each edge

See [Supported File Formats](#file-formats) for the exact format specifications.

**Step 2: Upload the Network**

1. Open the application at `http://localhost:4200`
2. Navigate to the **Upload** page from the sidebar
3. Select all your network files (EDGES, node priors, link probabilities, and optionally capacity or CPM files)
4. Click **Upload**. Files are sent to the backend and stored under `temp_uploads/<uuid>/`

**Step 3: View Network Structure**

1. Navigate to **Network Structure** in the sidebar
2. The framework automatically parses the EDGES file and displays:
   - Node and edge counts
   - Source, sink, fork, and join node classifications
   - Topological ordering (iteration sets)
   - Per-node ancestor and descendant information

**Step 4: Run Exact Inference**

1. Navigate to **Exact Inference** in the sidebar
2. The File Manager will display available scenarios (one per node-priors + link-probabilities pair)
3. Select a scenario tab and click **Run** (or analysis runs automatically on page load)
4. View the resulting belief values for every node in the network

**Step 5: Explore Results**

- **Belief Table**: Sortable table with heatmap bars showing belief magnitudes
- **Histogram**: Distribution of belief values across all nodes
- **Sensitivity Analysis**: Identifies nodes most affected by network connectivity
- **Comparison Mode**: Compare beliefs across different scenarios side-by-side
- **Per-Node Tracing**: Track how a single node's belief varies across all scenarios

---

## 2. Architecture Overview {#architecture}

---

### 2.1 System Architecture {#system-architecture}

The IPA Framework follows a client-server architecture with a clear separation between the Angular frontend (visualization and user interaction) and the Julia backend (computation and algorithm execution).

```
+-------------------------------------------------------+
|                    Browser (Port 4200)                 |
|                                                       |
|  +------------------+  +------------------+           |
|  |  Upload Page     |  |  Structure View  |           |
|  +------------------+  +------------------+           |
|  +------------------+  +------------------+           |
|  |  Exact Inference |  |  Diamond View    |           |
|  +------------------+  +------------------+           |
|  +------------------+  +------------------+           |
|  |  Capacity View   |  |  CPM View        |           |
|  +------------------+  +------------------+           |
|                                                       |
|  FileManagerService  |  ScenarioTabService             |
+-------------------------------------------------------+
              |  HTTP REST (JSON)  |
              v                    v
+-------------------------------------------------------+
|              Julia Backend (Port 8080)                 |
|                                                       |
|  HTTP.jl Router                                       |
|    /health, /upload, /network-structure,              |
|    /diamond-analysis, /reachability-analysis,         |
|    /capacity-analysis, /cpm-analysis,                 |
|    /diamond-subgraph-analysis                         |
|                                                       |
|  IPAFrameworkOptimized Module                         |
|    +-- NetworkParser      (EDGES + JSON parsing)      |
|    +-- StructureAnalyzer  (topology, iteration sets)  |
|    +-- DiamondDetector    (diamond identification)    |
|    +-- BeliefPropagation  (exact inference engine)    |
|    +-- CapacityAnalyzer   (max flow, bottlenecks)     |
|    +-- CPMAnalyzer        (time/cost critical path)   |
|    +-- UncertaintyOps     (Float64/Interval/P-box)    |
|    +-- DiamondPrecompute  (parallel pre-computation)  |
+-------------------------------------------------------+
```

**Data Flow**

The typical data flow for an analysis request follows this sequence:

1. **Upload**: User selects files in the browser. The frontend sends them via `POST /upload` as multipart form data. The backend stores them in `temp_uploads/<uuid>/` and returns the upload ID and file paths.

2. **Parse**: When the user navigates to an analysis page, the frontend sends a request (e.g., `POST /network-structure`) with the file paths. The backend reads the EDGES file, parses the JSON priors and link probabilities, and constructs in-memory data structures.

3. **Compute**: The backend runs the requested algorithm (structure analysis, diamond detection, belief propagation, capacity analysis, or CPM) on the parsed network data.

4. **Return**: Results are serialized to JSON and returned to the frontend in the HTTP response body.

5. **Render**: The Angular frontend deserializes the JSON, updates component state via signals, and renders tables, charts, and visualizations.

**Key Design Decisions**

- **Stateless backend**: The Julia server does not maintain session state between requests. Each request includes all necessary file paths and parameters. This simplifies deployment and eliminates state synchronization issues.
- **No result caching on backend**: Every request re-parses and re-computes from scratch. Caching is handled entirely on the frontend side (in-memory result storage per scenario tab).
- **Standalone Angular components**: The frontend uses Angular 17's standalone component architecture (no NgModules), with signals for reactive state management.

---

### 2.2 Supported Data Types {#data-types}

The framework supports three uncertainty representations, each providing a different level of expressiveness for modeling real-world uncertainty. All three types flow through the same algorithm pipelines via Julia's multiple dispatch system.

#### Float64 (Precise Probabilities)

Standard IEEE 754 double-precision floating-point numbers. Each probability is a single scalar value between 0.0 and 1.0.

- **Use when**: You have well-characterized, precise probability estimates
- **Arithmetic**: Standard floating-point multiplication, addition, complement
- **Performance**: Fastest computation; no overhead from uncertainty propagation
- **Example**: A link probability of exactly 0.85

#### Interval (Bounded Ranges)

An interval `[lower, upper]` represents epistemic uncertainty -- you know the true probability lies somewhere within the bounds, but not exactly where.

- **Use when**: You have imprecise data, expert elicitation with ranges, or want to bound worst/best cases
- **Arithmetic**: Interval arithmetic with proper endpoint propagation
  - Multiplication: `[a,b] * [c,d] = [min(ac,ad,bc,bd), max(ac,ad,bc,bd)]`
  - Addition: `[a,b] + [c,d] = [a+c, b+d]`
  - Complement: `1 - [a,b] = [1-b, 1-a]`
- **Result interpretation**: The output belief is itself an interval `[lower, upper]`
- **Example**: A node prior of `[0.8, 0.95]` meaning "between 80% and 95% reliable"

#### P-box (Probability Boxes)

A p-box bounds an entire cumulative distribution function (CDF) between an upper and lower envelope. This is the most general uncertainty representation, subsuming both intervals and precise distributions.

- **Use when**: You have deep uncertainty about the distribution shape, or want to combine aleatory and epistemic uncertainty
- **Construction types**:
  - **Parametric**: Specify a distribution family and parameters (e.g., `normal(0.9, 0.05)`, `uniform(0.7, 1.0)`, `beta(5, 2)`)
  - **Envelope**: Provide explicit upper and lower CDF bounds
  - **Distribution-free**: Only mean and/or variance known; Chebyshev-based bounds
- **Arithmetic**: Uses the `ProbabilityBoundsAnalysis.jl` library for rigorous p-box operations
- **Result interpretation**: The output belief is a p-box; its left/right bounds give the tightest provable interval
- **Example**: A link probability modeled as `normal(mean=0.9, std=0.05)` when you trust the distribution family but want to propagate distributional uncertainty

**Polymorphic Dispatch**

All core operations (multiply, add, complement, min, max, comparison) are defined for each type combination. When a Float64 value interacts with an Interval, the Float64 is automatically promoted to an Interval `[x, x]`. Similarly, Float64 and Interval values are promoted to degenerate p-boxes when combined with p-box operands. This ensures that mixed-type networks are handled correctly without user intervention.

---

### 2.3 Multi-Scenario Architecture {#multi-scenario}

The framework is designed around the concept of **scenarios** -- distinct analysis configurations that can be compared side by side.

**What Defines a Scenario**

A scenario is determined by the combination of input files assigned to a particular analysis type:

| Analysis Type | Scenario Defined By |
|---------------|-------------------|
| Exact Inference (Reachability) | Node priors file + Link probabilities file |
| Capacity Analysis | Capacities file |
| CPM Analysis | CPM input file (time + cost data) |

When you upload multiple sets of node priors and link probabilities (e.g., representing different operational conditions, degraded states, or design alternatives), each pair becomes a separate reachability scenario.

**File Manager Service**

The `FileManagerService` is a singleton Angular service that:

1. Receives the list of uploaded files from the upload response
2. Categorizes each file by type (EDGES, node priors, link probabilities, capacities, CPM)
3. Groups compatible files into named scenarios
4. Exposes the scenario list to all analysis components

**Tabbed Interface**

Each analysis view presents scenarios as tabs:

- **Idle**: Scenario is loaded but analysis has not been triggered
- **Computing**: Analysis request is in flight; a spinner is displayed
- **Computed**: Results are available and rendered in tables/charts
- **Error**: The backend returned an error; the error message is displayed in the tab

**In-Memory Result Caching**

When you navigate away from an analysis page and return, previously computed results are restored from in-memory caches maintained by the scenario tab service. This avoids redundant re-computation when switching between views.

**Cross-Scenario Comparison**

The Exact Inference view supports:

- **Delta comparison**: Select two scenarios and view a side-by-side table showing the belief difference for each node
- **Per-node tracing**: Select a single node and view its belief value across all computed scenarios, useful for sensitivity studies

---

## 3. Uploading & Managing Networks {#uploading}

---

### 3.1 Supported File Formats {#file-formats}

The framework accepts five types of input files. Each type has a specific format that must be followed exactly.

#### EDGES File (.EDGES) {#edges-file}

Defines the directed graph structure. This is the only mandatory file -- without it, no analysis is possible.

**Format**: CSV with two columns (`source`, `destination`). An optional header row is detected automatically. Node identifiers can be integers or strings.

**Constraints**:
- The graph must be a DAG (Directed Acyclic Graph). The parser will reject files that produce cycles.
- Self-loops are not permitted.
- Duplicate edges are silently deduplicated.

**Example**:

```
source,destination
1,2
1,3
2,4
3,4
4,5
```

This defines a 5-node DAG where node 1 is a source (fork), nodes 2 and 3 are internal, node 4 is a join, and node 5 is a sink.

---

#### Node Priors JSON {#node-priors-format}

Assigns intrinsic prior probabilities to each node. The prior represents the node's inherent reliability or probability of being active, independent of network connectivity.

**Required field**: `"data_type"` -- must be one of `"Float64"`, `"Interval"`, or `"pbox"`.

**Float64 Example**:

```json
{
  "data_type": "Float64",
  "nodes": {
    "1": 0.9,
    "2": 0.85,
    "3": 0.95,
    "4": 1.0,
    "5": 0.88
  }
}
```

All values must be in the range [0.0, 1.0]. A prior of 1.0 means the node is perfectly reliable; its belief depends entirely on incoming signals.

**Interval Example**:

```json
{
  "data_type": "Interval",
  "nodes": {
    "1": { "type": "interval", "lower": 0.8, "upper": 0.95 },
    "2": { "type": "interval", "lower": 0.7, "upper": 0.9 },
    "3": { "type": "interval", "lower": 0.85, "upper": 1.0 },
    "4": { "type": "interval", "lower": 0.9, "upper": 1.0 },
    "5": { "type": "interval", "lower": 0.75, "upper": 0.92 }
  }
}
```

The `lower` value must be less than or equal to the `upper` value. Both must be in [0.0, 1.0].

**P-box Example**:

```json
{
  "data_type": "pbox",
  "nodes": {
    "1": {
      "type": "pbox",
      "construction_type": "parametric",
      "shape": "normal",
      "params": [0.9, 0.05]
    },
    "2": {
      "type": "pbox",
      "construction_type": "parametric",
      "shape": "beta",
      "params": [5, 2]
    },
    "3": {
      "type": "pbox",
      "construction_type": "parametric",
      "shape": "uniform",
      "params": [0.8, 1.0]
    }
  }
}
```

Supported parametric shapes include: `normal`, `uniform`, `beta`, `lognormal`, `truncated_normal`. The `params` array contains shape-specific parameters (e.g., `[mean, std]` for normal, `[alpha, beta]` for beta).

---

#### Link Probabilities JSON {#link-probs-format}

Assigns transmission probabilities to each directed edge. The link probability represents the chance that information (or a signal) successfully traverses the edge from source to target.

**Format**: Same `"data_type"` structure as node priors, but uses a `"links"` key instead of `"nodes"`. Edge keys are formatted as `"(source,target)"` with parentheses and a comma, no spaces.

**Float64 Example**:

```json
{
  "data_type": "Float64",
  "links": {
    "(1,2)": 0.85,
    "(1,3)": 0.90,
    "(2,4)": 0.88,
    "(3,4)": 0.92,
    "(4,5)": 0.95
  }
}
```

**Interval Example**:

```json
{
  "data_type": "Interval",
  "links": {
    "(1,2)": { "type": "interval", "lower": 0.75, "upper": 0.90 },
    "(1,3)": { "type": "interval", "lower": 0.80, "upper": 0.95 },
    "(2,4)": { "type": "interval", "lower": 0.82, "upper": 0.93 },
    "(3,4)": { "type": "interval", "lower": 0.85, "upper": 0.97 },
    "(4,5)": { "type": "interval", "lower": 0.88, "upper": 0.99 }
  }
}
```

**P-box Example**:

```json
{
  "data_type": "pbox",
  "links": {
    "(1,2)": {
      "type": "pbox",
      "construction_type": "parametric",
      "shape": "normal",
      "params": [0.85, 0.03]
    },
    "(1,3)": {
      "type": "pbox",
      "construction_type": "parametric",
      "shape": "normal",
      "params": [0.90, 0.02]
    }
  }
}
```

**Important**: Every edge in the EDGES file must have a corresponding entry in the link probabilities file. Missing entries will cause a validation error.

---

#### Capacities JSON {#capacities-format}

Defines throughput capacities for the network flow analysis.

```json
{
  "capacities": {
    "nodes": {
      "1": 100.0,
      "2": 50.0,
      "3": 75.0,
      "4": 60.0,
      "5": 80.0
    },
    "edges": {
      "(1,2)": 80.0,
      "(1,3)": 90.0,
      "(2,4)": 55.0,
      "(3,4)": 70.0,
      "(4,5)": 65.0
    },
    "source_rates": {
      "1": 100.0
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `nodes` | Maximum throughput capacity for each node |
| `edges` | Maximum flow capacity for each directed edge |
| `source_rates` | Rate at which flow enters the network at each source node |

All capacity values must be non-negative. Nodes or edges not listed default to unlimited capacity.

---

#### CPM Input JSON {#cpm-format}

Provides time durations and costs for Critical Path Method analysis.

```json
{
  "time_analysis": {
    "node_durations": {
      "1": 5.0,
      "2": 3.0,
      "3": 7.0,
      "4": 2.0,
      "5": 4.0
    },
    "edge_delays": {
      "(1,2)": 0.5,
      "(1,3)": 1.0,
      "(2,4)": 0.3,
      "(3,4)": 0.8,
      "(4,5)": 0.2
    }
  },
  "cost_analysis": {
    "node_costs": {
      "1": 1000,
      "2": 500,
      "3": 1200,
      "4": 300,
      "5": 800
    },
    "edge_costs": {
      "(1,2)": 100,
      "(1,3)": 150,
      "(2,4)": 80,
      "(3,4)": 120,
      "(4,5)": 90
    }
  }
}
```

| Section | Field | Description |
|---------|-------|-------------|
| `time_analysis` | `node_durations` | Processing time at each node |
| `time_analysis` | `edge_delays` | Transmission delay along each edge |
| `cost_analysis` | `node_costs` | Cost incurred at each node |
| `cost_analysis` | `edge_costs` | Cost incurred along each edge |

Both `time_analysis` and `cost_analysis` sections are required. All values must be non-negative.

---

### 3.2 Uploading a Network {#uploading-network}

The upload process transfers your network files to the backend server for analysis.

**Procedure**:

1. **Navigate** to the Upload page from the application sidebar.
2. **Select files**: Click the file picker and select all relevant files for your analysis. You can select multiple files at once:
   - One `.EDGES` file (required)
   - One or more node priors JSON files
   - One or more link probabilities JSON files
   - Optionally, one or more capacities JSON files
   - Optionally, one or more CPM input JSON files
3. **Upload**: Click the Upload button. The files are sent as multipart form data to `POST /upload`.
4. **Server-side storage**: The backend creates a unique directory `temp_uploads/<uuid>/` and stores all uploaded files there, preserving any subdirectory structure.
5. **Confirmation**: The UI displays a success message with the upload ID and a summary of detected files.

**Directory Structure on Server**:

After upload, the server-side directory might look like:

```
temp_uploads/
  a1b2c3d4-e5f6-7890-abcd-ef1234567890/
    my-network.EDGES
    float/
      my-network-nodepriors.json
      my-network-linkprobabilities.json
    capacity/
      my-network-capacities.json
    cpm/
      my-network-cpm.json
```

The framework detects file types based on filename patterns and JSON content, not directory structure, so you are free to organize files however you prefer.

---

### 3.3 File Manager & Scenarios {#file-manager}

The File Manager is the central service that organizes uploaded files into analysis-ready scenarios.

**File Categorization**

Upon receiving the upload response, the File Manager categorizes each file:

| Category | Detection Rule |
|----------|---------------|
| EDGES file | File extension `.EDGES` |
| Node priors | JSON file containing `"nodes"` key with `"data_type"` |
| Link probabilities | JSON file containing `"links"` key with `"data_type"` |
| Capacities | JSON file containing `"capacities"` key |
| CPM input | JSON file containing `"time_analysis"` and/or `"cost_analysis"` keys |

**Scenario Formation**

Files are grouped into scenarios based on their type and naming conventions:

- **Reachability scenarios**: Each unique (node priors + link probabilities) pair where the `data_type` fields match
- **Capacity scenarios**: Each capacities file
- **CPM scenarios**: Each CPM input file

**Scenario Properties**

Each scenario has:

| Property | Description |
|----------|-------------|
| Name | Auto-generated from filenames, or user-customizable |
| Data type | `Float64`, `Interval`, or `pbox` (from the input files) |
| File paths | Absolute paths to the associated input files on the server |
| Status | `idle`, `computing`, `computed`, or `error` |

**Cross-View Sharing**

The `FileManagerService` is a singleton shared across all analysis views. When you upload files, the scenarios become immediately available in the Network Structure, Diamond Analysis, Exact Inference, Capacity Analysis, and CPM Analysis pages -- no re-upload needed.

---

## 4. Network Structure Analysis {#network-structure}

---

### 4.1 What It Shows {#structure-overview}

The Network Structure view provides a comprehensive topological analysis of your DAG before running any probabilistic or flow computations. This is the first view you should consult after uploading a network to verify it was parsed correctly and understand its shape.

**Summary Metrics**:

| Metric | Description |
|--------|-------------|
| Total nodes | Number of unique nodes in the DAG |
| Total edges | Number of directed edges |
| Source nodes | Count of nodes with no incoming edges |
| Sink nodes | Count of nodes with no outgoing edges |
| Fork nodes | Count of nodes with >1 outgoing edge |
| Join nodes | Count of nodes with >1 incoming edge |
| Internal nodes | Count of nodes with exactly 1 incoming and 1 outgoing edge |
| Network density | Ratio of actual edges to maximum possible edges: `|E| / (|V| * (|V|-1) / 2)` |
| Average degree | Mean of (in-degree + out-degree) across all nodes |
| Parallelism index | Maximum width of the iteration sets (largest number of nodes at any single level) |
| Topology shape | Descriptive classification: "wide-shallow", "narrow-deep", "balanced", etc. |

**Per-Node Information**:

For each node, the structure analysis provides:
- Node type (source, sink, fork, join, internal)
- In-degree and out-degree
- Ancestor set (all upstream nodes)
- Descendant set (all downstream nodes)
- Iteration set membership (topological level)

**Per-Edge Information**:

For each edge, the analysis provides:
- Source and target nodes
- Edge type classification (e.g., fork-to-join, source-to-internal)

---

### 4.2 Node Types {#node-types}

Every node in the DAG is classified into exactly one primary type based on its connectivity:

| Type | In-Degree | Out-Degree | Definition | Role in Analysis |
|------|-----------|------------|------------|-----------------|
| **Source** | 0 | >= 1 | No incoming edges | Entry points; beliefs equal their priors. Flow injection points in capacity analysis. |
| **Sink** | >= 1 | 0 | No outgoing edges | Terminal nodes; final destinations of propagated information. |
| **Fork** | >= 1 | > 1 | Multiple outgoing edges | Information diverges; may create diamond dependencies if descendants reconverge. |
| **Join** | > 1 | >= 0 | Multiple incoming edges | Information converges; requires inclusion-exclusion or diamond enumeration. |
| **Internal** | 1 | 1 | Exactly one in, one out | Simple relay; belief is a straightforward product of parent belief, link probability, and own prior. |

**Nodes with multiple roles**: A node can simultaneously be a fork and a join (e.g., 3 incoming edges and 2 outgoing edges). In such cases, the node's type reflects its most significant role for analysis purposes, though all properties are tracked independently.

---

### 4.3 Iteration Sets {#iteration-sets}

Iteration sets partition the DAG into topological levels, ensuring that every node in level `k` has all its parents in levels `< k`. This ordering is fundamental to all forward-pass algorithms in the framework.

**Algorithm**: BFS-based Kahn's algorithm

1. Initialize level 0 with all source nodes (in-degree 0)
2. Remove source nodes from the graph, reducing in-degrees of their successors
3. Any node whose in-degree becomes 0 is added to the next level
4. Repeat until all nodes are assigned to a level

**Properties**:

- **Correctness**: Every node is processed only after all its parents, guaranteeing valid belief/flow computation
- **Parallelism**: Nodes within the same iteration set are independent and can be processed in parallel
- **Uniqueness**: The partition into levels is unique for a given DAG (though the ordering within levels is arbitrary)

**Example**: For the network `1->2, 1->3, 2->4, 3->4, 4->5`:

| Level | Nodes |
|-------|-------|
| 0 | {1} |
| 1 | {2, 3} |
| 2 | {4} |
| 3 | {5} |

Level 1 has parallelism index 2, meaning nodes 2 and 3 can be processed simultaneously.

---

### 4.4 Ancestors & Descendants {#ancestors-descendants}

**Ancestor Set** of node N: The set of all nodes from which N is reachable by following directed edges forward. Formally, node A is an ancestor of N if there exists a directed path from A to N.

**Descendant Set** of node N: The set of all nodes reachable from N by following directed edges forward. Formally, node D is a descendant of N if there exists a directed path from N to D.

**Computation**: Both sets are computed via transitive closure of the DAG's adjacency structure during the structure analysis phase.

**Uses in the Framework**:

- **Diamond Detection**: Shared ancestors of a join node's parents identify potential diamond conditioning nodes
- **Influence Analysis**: A node's ancestor set defines its "cone of influence" -- all nodes that can affect its belief
- **Subgraph Extraction**: When analyzing a diamond, the ancestor/descendant sets define the relevant subgraph boundary

---

## 5. Diamond Analysis {#diamond-analysis}

Diamond analysis is the most technically sophisticated component of the IPA Framework. It identifies and characterizes subgraph structures where multiple paths from shared ancestors converge, creating statistical dependencies that must be handled specially during exact inference.

---

### 5.1 What Are Diamonds? {#what-are-diamonds}

In a DAG, a **diamond** (also called a "convergent diamond" or "common-cause structure") occurs when:

1. A join node J has two or more parents P1, P2, ...
2. Those parents share one or more common **fork** ancestors F1, F2, ...
3. Multiple directed paths lead from the shared fork ancestors through different intermediate routes to the join node

**Why Diamonds Matter**:

Naive belief propagation assumes that incoming signals at a join node are statistically independent. This assumption holds when each parent's ancestors are disjoint. However, when parents share common fork ancestors, their signals are **correlated** -- they both depend on the state of the shared ancestor.

Consider a simple example:

```
    F
   / \
  A   B
   \ /
    J
```

Node F is a fork, and node J is a join. Paths F->A->J and F->B->J share ancestor F. If F fails (becomes inactive), BOTH A and B lose their signal from F. Treating A's and B's contributions to J as independent would overcount the probability of J receiving a signal.

**Correct Approach**: Enumerate the states of conditioning node F:
- If F is active (probability = Belief(F)): compute J's belief with F contributing to both A and B
- If F is inactive (probability = 1 - Belief(F)): compute J's belief with F's contribution removed from both paths
- Final Belief(J) = weighted sum over both cases

This conditional enumeration is the mathematical basis for the framework's exact inference on diamonds.

---

### 5.2 Diamond Structure {#diamond-structure}

Each identified diamond is characterized by the following components:

| Component | Description |
|-----------|-------------|
| **Join node** | The convergence point where multiple dependent paths meet |
| **Conditioning nodes** | The shared fork ancestor(s) whose states must be enumerated. These are the root cause of statistical dependency. |
| **Relevant nodes** | All nodes on paths from conditioning nodes to the join node, forming the diamond's induced subgraph |
| **Edge list** | All directed edges within the diamond subgraph |
| **Sub-sources** | Nodes within the diamond that have no incoming edges from other diamond nodes (may include conditioning nodes) |
| **Sub-joins** | Join nodes within the diamond (may include the main join and internal convergence points) |
| **Sub-forks** | Fork nodes within the diamond |

**Stored Data per Diamond**:

Each diamond is stored with a unique hash (computed from its node and edge sets) and includes pre-computed data for efficient analysis:

- Subgraph adjacency lists (both outgoing and incoming)
- Subgraph iteration sets (topological levels within the diamond)
- Subgraph source nodes and their original priors
- Node count and edge count

---

### 5.3 Diamond Identification Algorithm {#diamond-algorithm}

The diamond identification algorithm systematically discovers all diamond structures in the network. It operates on each join node independently.

**Algorithm for a single join node J**:

```
IDENTIFY_DIAMOND(J, network):
  1. Let parents = incoming_neighbors(J)
  2. For each parent P in parents:
       ancestor_sets[P] = ancestors(P)  // from pre-computed structure
  3. shared_forks = intersection of all ancestor_sets[P]
     filtered to only FORK nodes (out-degree > 1)
  4. If shared_forks is empty: J is NOT a diamond join (independent parents)
  5. Otherwise:
     a. Extract induced subgraph S:
        - Start from shared_forks
        - Include all nodes on any path from a shared fork to J
        - Include all edges between these nodes
     b. ENSURE COMPLETENESS of S:
        For each node N in S (other than sub-sources):
          For each incoming edge (M -> N) in the full network:
            If M is an ancestor of J and M is a descendant of any shared fork:
              Add M and edge (M -> N) to S
     c. SUBSOURCE ANALYSIS:
        Let sub_sources = nodes in S with no incoming edges within S
        For each sub_source that is NOT a shared fork:
          Check if sub_sources share their own fork ancestors
          If yes: expand diamond upward to include those forks
     d. Repeat steps b-c until convergence (no new nodes added)
        Maximum 1000 iterations to prevent infinite loops
  6. Return Diamond(J, conditioning_nodes=shared_forks, subgraph=S)
```

**Convergence**: The algorithm is guaranteed to terminate because:
- The network is finite and acyclic
- Each iteration only adds nodes that are ancestors of J
- The ancestor set of J is finite
- The iteration cap of 1000 provides a safety bound

---

### 5.4 Diamond Nesting & Pre-computation {#diamond-nesting}

**Nested Diamonds**

Diamonds can contain other diamonds within them. This occurs when a diamond's internal join nodes are themselves the convergence points of sub-diamonds. For example:

```
      F1
     / \
    A   B
   / \ / \
  C   D   E
   \ / \ /
    J1   J2
      \ /
       J3
```

Here, J3 is a diamond join with conditioning nodes. But J1 and J2 are also diamond joins with their own conditioning nodes. The diamonds at J1 and J2 are **nested** within the diamond at J3.

**Pre-computation Strategy**

The function `build_unique_diamond_storage_depth_first_parallel()` processes the entire diamond hierarchy efficiently:

1. **Discover root diamonds**: Find all join nodes that are diamond joins at the top level of the network
2. **Build diamond tree**: For each root diamond, recursively identify nested sub-diamonds
3. **Process depth-first**: Use an iterative LIFO (Last In, First Out) stack to process diamonds bottom-up, ensuring inner diamonds are pre-computed before their enclosing outer diamonds
4. **Parallel processing**: At each topological level, independent root diamonds are processed in parallel across Julia threads using `Threads.@threads`
5. **Deduplication**: Each diamond is hashed based on its node and edge sets. If two different outer diamonds contain identical inner sub-diamonds, the inner diamond is computed once and its results are shared via hash-based lookup

**DiamondComputationData**

For each unique diamond, the pre-computation phase stores a `DiamondComputationData` struct containing:

- Subgraph adjacency (outgoing and incoming edge lists)
- Subgraph source nodes and their original priors
- Subgraph fork, join, and internal node classifications
- Subgraph iteration sets (for correct processing order within the diamond)
- References to nested sub-diamond hashes (for recursive enumeration)

This pre-computation is a one-time cost that dramatically speeds up the actual belief propagation phase, especially for networks with many diamonds or deep nesting.

---

### 5.5 Diamond Classification {#diamond-classification}

Each diamond is classified along six independent dimensions to help researchers understand the structural properties of their networks. The classification is displayed in the diamond details view.

**1. Fork Structure**

| Class | Description |
|-------|-------------|
| Single | One conditioning node (single shared fork ancestor) |
| Multi | Multiple independent conditioning nodes |
| Chained | Conditioning nodes form a chain (one is an ancestor of another) |
| Self-Influence | A conditioning node is also influenced by another conditioning node |

**2. Internal Structure**

| Class | Description |
|-------|-------------|
| Simple | No nested diamonds; all internal nodes are tree-structured |
| Nested | Contains one or more sub-diamonds |
| Sequential | Contains diamonds arranged in sequence (output of one feeds input of next) |
| Interconnected | Sub-diamonds share nodes or edges |

**3. Path Topology**

| Class | Description |
|-------|-------------|
| Parallel | All paths from forks to join are node-disjoint |
| Converging | Paths merge at intermediate join nodes before the final join |
| Branching | Paths include intermediate forks that create sub-branches |
| Cross-Connected | Nodes on different paths are connected by cross-edges |

**4. Join Structure**

| Class | Description |
|-------|-------------|
| Single | The diamond has exactly one join node |
| Hierarchical | The diamond contains multiple join levels (intermediate joins before the final join) |

**5. External Connectivity**

| Class | Description |
|-------|-------------|
| Isolated | Diamond nodes have no edges to/from nodes outside the diamond (except at sources/join) |
| Bridge | Diamond is on the only path between two parts of the network |
| Embedded | Diamond nodes have significant connections to the broader network |

**6. Degeneracy**

| Class | Description |
|-------|-------------|
| Valid | Well-formed diamond with meaningful statistical dependencies |
| Trivial | Diamond with only 2 conditioning states (single binary fork) |
| Malformed | Diamond that fails structural validation checks |
| Redundant | Diamond that is a subset of a larger diamond and adds no new information |

---

### 5.6 Subgraph Analysis {#subgraph-analysis}

From the Diamond Analysis view, you can open a detailed dialog for any diamond and run analysis on it as a standalone subnetwork. This is useful for understanding the behavior of a specific convergent structure in isolation.

**Available Subgraph Analyses**:

| Analysis | Description |
|----------|-------------|
| **Exact Inference** | Compute beliefs for all nodes within the diamond subgraph |
| **Capacity** | Run max flow analysis through the diamond's internal paths |
| **CPM Time** | Find the critical time path within the diamond |
| **CPM Cost** | Find the critical cost path within the diamond |

**Source Value Overrides**

Each subgraph analysis provides a collapsible panel where you can override the values at the diamond's sub-source nodes. This lets you explore "what if" scenarios:

- **Reachability overrides**: Set specific belief values for the diamond's entry points (e.g., "what if this source has 80% reliability?")
- **Capacity overrides**: Set specific flow rates entering the diamond
- **CPM time overrides**: Set specific durations at source nodes
- **CPM cost overrides**: Set specific costs at source nodes

The overrides only affect the subgraph analysis; they do not modify the full-network analysis results.

**Scenario Selection**

Each subgraph analysis has its own scenario dropdown, allowing you to select which uploaded data files provide the base values for the analysis. The source overrides are then applied on top of the selected scenario's data.

---

## 6. Exact Inference {#exact-inference}

Exact inference is the core analytical capability of the IPA Framework. It computes the **belief** (reachability probability) for every node in the network, accounting for all structural dependencies including diamond convergences.

---

### 6.1 Mathematical Foundation {#inference-math}

The belief of a node N represents the probability that N is "active" or "reachable" -- that is, the probability that at least one signal from any source node successfully propagates through the network to reach N.

**General Formula**:

```
Belief(N) = Prior(N) * P(N receives at least one signal from its parents)
```

The computation of `P(N receives at least one signal)` depends on N's structural position in the network.

---

**Case 1: Source Nodes**

Source nodes have no parents. Their belief equals their prior:

```
Belief(Source) = Prior(Source)
```

---

**Case 2: Single-Parent Nodes (Tree Nodes)**

When a node has exactly one parent, the computation is a simple product:

```
Belief(N) = Prior(N) * Belief(Parent) * LinkProb(Parent -> N)
```

This represents the chain: the parent must be active, the link must transmit, and the node itself must be functional.

---

**Case 3: Multi-Parent Nodes with Independent Parents (No Diamond)**

When a join node has multiple parents but those parents share NO common fork ancestors, the incoming signals are statistically independent. The probability of receiving at least one signal uses the **inclusion-exclusion principle**.

Let `S_i = Belief(Parent_i) * LinkProb(Parent_i -> N)` be the probability of receiving a signal from parent i.

For k parents:

```
P(at least one signal) = Sum_i(S_i)
                       - Sum_{i<j}(S_i * S_j)
                       + Sum_{i<j<k}(S_i * S_j * S_k)
                       - ...
                       + (-1)^(k+1) * Product_all(S_i)
```

This is the standard inclusion-exclusion formula over all 2^k - 1 non-empty subsets of parent signals.

Then:

```
Belief(N) = Prior(N) * P(at least one signal)
```

---

**Case 4: Diamond Join Nodes (Shared Ancestors Create Dependency)**

When a join node's parents share common fork ancestors, the signals are NOT independent. The framework uses **conditional enumeration** over the states of the conditioning nodes.

Let `C = {C_1, C_2, ..., C_n}` be the set of conditioning nodes for this diamond.

Each conditioning node can be in one of two states: **active** or **inactive**. There are 2^n possible state combinations.

For each state combination `s`:

1. **Compute the state probability**:
   ```
   P(state_s) = Product over all conditioning nodes C_i:
     Belief(C_i)     if C_i is active in state s
     1 - Belief(C_i) if C_i is inactive in state s
   ```

2. **Compute conditional beliefs within the diamond**:
   - For active conditioning nodes: their prior is set to their pre-diamond belief value (they contribute normally)
   - For inactive conditioning nodes: their prior is set to 0.0 (they are "off" and contribute nothing)
   - Run belief propagation on the diamond subgraph with these fixed priors
   - The result is `Belief(Join | state_s)`

3. **Combine by the law of total probability**:
   ```
   Belief(Join) = Sum over all states s:  P(state_s) * Belief(Join | state_s)
   ```

---

**Case 5: Nested Diamonds**

When diamonds are nested (a diamond contains inner diamonds), the computation uses **nested conditional expectation**:

1. Process the innermost diamonds first (bottom-up)
2. Each inner diamond's join node gets a computed belief via conditional enumeration
3. Use that belief as a fixed value when processing the enclosing outer diamond
4. Continue outward until all diamond layers are resolved

---

**Complexity Analysis**

The worst-case time complexity of exact inference is:

```
O(2^(sum of n_i))
```

where `n_i` is the number of conditioning nodes in diamond layer i. For networks with many large diamonds, this can be exponential. However, in practice:

- Most real-world diamonds have 1-3 conditioning nodes (2-8 states each)
- Nested diamonds are processed independently, not multiplicatively
- Diamond deduplication avoids redundant computation
- Parallel processing across independent diamonds reduces wall-clock time

---

### 6.2 Algorithm Walkthrough {#inference-algorithm}

The following describes the step-by-step execution of the exact inference algorithm.

**Phase 1: Validation**

Before computation begins, the algorithm validates:

1. All nodes referenced in the EDGES file have corresponding entries in the node priors file
2. All edges have corresponding entries in the link probabilities file
3. All priors and link probabilities are valid (within [0,1] for Float64; valid interval/p-box constructions)
4. The data types are consistent (all Float64, or all Interval, or all p-box)

If validation fails, a descriptive error message is returned identifying the specific problem.

**Phase 2: Diamond Pre-computation**

If the network contains any join nodes:

1. Run diamond identification for all join nodes
2. Build the diamond hierarchy (nesting relationships)
3. Pre-compute `DiamondComputationData` for each unique diamond
4. Store in hash-indexed lookup table

**Phase 3: Forward Pass (Belief Propagation)**

Process nodes in topological order using iteration sets:

```
FOR each iteration_set level L = 0, 1, 2, ...:
  FOR each node N in level L (parallelizable):
    IF N is a source node:
      beliefs[N] = priors[N]

    ELSE IF N has a diamond structure:
      // Get the diamond for this join node
      diamond = lookup_diamond(N)
      conditioning_nodes = diamond.conditioning_nodes

      // Enumerate all 2^n states
      belief_sum = 0
      FOR each state s in {0,1}^|conditioning_nodes|:
        // Probability of this state
        state_prob = product of:
          beliefs[C_i]     if s[i] = 1 (active)
          1 - beliefs[C_i] if s[i] = 0 (inactive)

        // Set up conditional priors in diamond subgraph
        FOR each conditioning node C_i:
          IF s[i] = 1: conditional_prior[C_i] = beliefs[C_i]
          IF s[i] = 0: conditional_prior[C_i] = 0.0

        // Run belief propagation on diamond subgraph
        conditional_belief = propagate_subgraph(diamond, conditional_prior)

        // Accumulate weighted contribution
        belief_sum += state_prob * conditional_belief[N]

      beliefs[N] = belief_sum

    ELSE IF N is a join node (independent parents):
      // Inclusion-exclusion over parent signals
      signals = [beliefs[P] * link_probs[(P,N)] for P in parents(N)]
      p_at_least_one = inclusion_exclusion(signals)
      beliefs[N] = priors[N] * p_at_least_one

    ELSE:  // single parent (tree node)
      P = single_parent(N)
      beliefs[N] = priors[N] * beliefs[P] * link_probs[(P,N)]

RETURN beliefs
```

**Phase 4: Result Assembly**

After the forward pass completes:

1. Collect beliefs for all nodes
2. Compute summary statistics (mean, min, max belief)
3. Compute sensitivity scores: `|beliefs[N] - priors[N]|` for each node
4. Record computation time
5. Package into JSON response

---

### 6.3 Multi-Scenario Analysis {#inference-scenarios}

The Exact Inference view supports running and comparing multiple scenarios simultaneously.

**Automatic Execution**

When you navigate to the Exact Inference page:

1. The File Manager provides all available reachability scenarios
2. Each scenario appears as a tab in the interface
3. By default, all scenarios begin computation automatically (configurable)
4. Each tab independently shows its computation status: idle, computing, computed, or error

**Per-Scenario Display**

Each computed scenario tab shows:

- **Belief Table**: A sortable table with columns for Node ID, Prior, Belief, and Sensitivity Score. Each row includes a heatmap color bar proportional to the belief value.
- **Belief Histogram**: A bar chart showing the distribution of belief values across all nodes. Useful for identifying whether the network produces clustered or spread-out beliefs.
- **Sensitivity Analysis**: Ranks nodes by `|Belief - Prior|`. Nodes with high sensitivity are heavily influenced by network connectivity; nodes with low sensitivity are dominated by their own priors.

**Comparison Mode**

Select two scenario tabs to activate comparison mode:

- **Delta Table**: Shows each node's belief in Scenario A, belief in Scenario B, and the absolute and relative differences
- **Highlighted Differences**: Nodes where beliefs differ by more than a threshold are highlighted
- **Summary Statistics**: Mean, max, and distribution of belief differences

**Per-Node Tracing**

Select a single node to see its belief traced across all computed scenarios:

- A horizontal bar chart or table showing the node's belief in each scenario
- Useful for understanding how a specific node responds to different network conditions or degraded inputs

---

### 6.4 Interpreting Results {#inference-results}

**Belief Value**

The belief of a node represents the probability that information successfully propagates from at least one source node to that node, considering:

- The intrinsic reliability of every node along the path (priors)
- The transmission probability of every edge along the path (link probabilities)
- The correct handling of statistical dependencies at diamond convergences

**Interpretation Guide**:

| Belief Range | Interpretation |
|-------------|----------------|
| 0.9 - 1.0 | Highly reachable; strong redundant paths or high-reliability components |
| 0.7 - 0.9 | Moderately reachable; some vulnerability to component failures |
| 0.5 - 0.7 | Uncertain reachability; significant risk of information loss |
| 0.0 - 0.5 | Low reachability; critical reliability concerns |

**Sensitivity Score**

```
Sensitivity(N) = |Belief(N) - Prior(N)|
```

- **High sensitivity** (close to 1.0): The node's state is almost entirely determined by the network structure and incoming signals, not its own prior. This node is highly dependent on upstream reliability.
- **Low sensitivity** (close to 0.0): The node's belief is close to its prior. Either it is a source node, or the network contributes very little additional certainty/uncertainty.

**Sink Node Beliefs**

Sink nodes (no outgoing edges) represent the terminal destinations of information flow. Their beliefs are often the most important outputs of the analysis, as they indicate the overall end-to-end reliability of the information propagation network.

**Uncertainty Width (Interval and P-box)**

When using interval or p-box data types, each belief is itself an interval or p-box:

- **Narrow width**: The belief is well-determined despite input uncertainty. The network structure constrains the output.
- **Wide width**: High epistemic uncertainty in the result. Consider whether the input uncertainties can be reduced through better data collection.

---

## 7. Capacity Analysis {#capacity-analysis}

Capacity analysis treats the DAG as a flow network and computes maximum throughput, bottleneck identification, and utilization metrics.

---

### 7.1 Network Flow Model {#capacity-model}

The capacity analysis models the DAG as a constrained flow network:

- **Source nodes** inject flow at configured source rates
- **Edges** have transmission capacities limiting the flow they can carry
- **Nodes** have processing capacities limiting their total throughput
- **Flow conservation**: The flow into a node equals the flow out (up to the node's capacity)

**Flow Propagation Rule**:

Flow is computed topologically (using iteration sets) from sources to sinks:

```
For each node N processed in topological order:
  incoming_flow(N) = Sum over parents P of:
    min(flow_from_P, edge_capacity(P -> N))

  flow(N) = min(incoming_flow(N), node_capacity(N))

  For source nodes:
    flow(Source) = min(source_rate(Source), node_capacity(Source))
```

The flow at each node is the minimum of what arrives and what the node can handle. This naturally identifies bottlenecks: any node or edge where the minimum is binding.

---

### 7.2 Analysis Types {#capacity-types}

The capacity analysis view offers three complementary analysis modes:

**Maximum Flow Analysis**

Standard topological max-flow sweep from sources to sinks:

- Computes the maximum achievable flow at every node
- Identifies which nodes are capacity-constrained
- Reports total network throughput (sum of flows reaching sink nodes)

**Bottleneck Analysis**

Finds the widest minimum-capacity path from sources to each target node:

- For each sink node, identifies the path where the minimum edge/node capacity is maximized
- The bottleneck of each path is the element (node or edge) with the smallest capacity on that widest path
- Reports the bottleneck capacity and location for each sink

**Comparative Analysis**

Runs all analysis types and presents a unified comparison:

- Side-by-side flow values from maximum flow and bottleneck analyses
- Identifies upgrade priorities: which single node or edge capacity increase would most improve overall throughput
- Ranks all elements by their impact on network-wide flow

---

### 7.3 Bottleneck Identification {#bottleneck-identification}

A node or edge is classified as a **bottleneck** when it constrains the overall network throughput.

**Identification Criteria**:

A node is flagged as a bottleneck if:

1. It appears in the bottleneck list from the bottleneck analysis (it is the minimum-capacity element on the widest path to some sink), OR
2. Its **utilization** exceeds 95%

**Utilization Formula**:

```
Utilization(N) = actual_flow(N) / capacity(N)
```

| Utilization | Status |
|-------------|--------|
| < 50% | Under-utilized; significant spare capacity |
| 50% - 80% | Moderate utilization; healthy operating range |
| 80% - 95% | High utilization; approaching capacity limits |
| > 95% | Near-bottleneck or active bottleneck; upgrade candidate |

**Bottleneck Report**:

The bottleneck analysis produces a ranked list of bottleneck elements showing:

- Element type (node or edge)
- Element identifier
- Current flow and capacity
- Utilization percentage
- Impact score: estimated throughput improvement if this element's capacity were doubled

---

### 7.4 Edge Utilization {#edge-utilization}

In addition to node-level analysis, the capacity view provides edge-level flow and utilization metrics.

**Per-Edge Metrics**:

| Metric | Formula | Description |
|--------|---------|-------------|
| Edge flow | `min(upstream_flow, edge_capacity)` | Actual flow traversing the edge |
| Edge capacity | From input file | Maximum flow the edge can carry |
| Edge utilization | `edge_flow / edge_capacity` | How fully used the edge is |

**View Modes**:

The capacity results can be displayed in two modes:

- **Node-centric**: Table showing each node's flow, capacity, utilization, and bottleneck status
- **Edge-centric**: Table showing each edge's flow, capacity, utilization, and upstream/downstream node information

Toggle between modes using the view selector in the results panel.

---

## 8. Critical Path Method (CPM) {#cpm-analysis}

The Critical Path Method analysis identifies the longest path through the network, determining the minimum project duration (time analysis) and maximum accumulated cost (cost analysis).

---

### 8.1 Overview {#cpm-overview}

CPM is a project scheduling technique adapted here for DAG analysis. It answers two key questions:

1. **Time**: What is the minimum time to traverse the network from source to sink, and which nodes are on the critical (longest) path?
2. **Cost**: What is the maximum accumulated cost path through the network, and which nodes drive the total cost?

Nodes on the critical path have **zero slack** -- any delay or cost increase at these nodes directly impacts the overall network duration or cost. Non-critical nodes have positive slack, meaning they can tolerate some delay without affecting the total.

---

### 8.2 Time Analysis {#time-analysis}

The time analysis performs a forward pass and backward pass to compute scheduling parameters for every node.

**Forward Pass** (computes Early Start and Early Finish):

```
For each node N in topological order:
  IF N is a source node:
    ES(N) = 0
    EF(N) = duration(N)
  ELSE:
    ES(N) = max over all parents P of:
      EF(P) + edge_delay(P -> N)
    EF(N) = ES(N) + duration(N)
```

| Parameter | Definition |
|-----------|-----------|
| ES(N) | **Early Start**: The earliest time node N can begin processing |
| EF(N) | **Early Finish**: The earliest time node N completes: `ES(N) + duration(N)` |
| duration(N) | The processing time at node N (from CPM input file) |
| edge_delay(P->N) | The transmission delay along edge P->N (from CPM input file) |

**Backward Pass** (computes Late Start, Late Finish, and Slack):

```
Critical Duration = max over all sink nodes S of EF(S)

For each node N in REVERSE topological order:
  IF N is a sink node:
    LF(N) = Critical Duration
    LS(N) = LF(N) - duration(N)
  ELSE:
    LF(N) = min over all successors C of:
      LS(C) - edge_delay(N -> C)
    LS(N) = LF(N) - duration(N)

  Slack(N) = LS(N) - ES(N)
```

| Parameter | Definition |
|-----------|-----------|
| LF(N) | **Late Finish**: The latest time node N can finish without delaying the project |
| LS(N) | **Late Start**: The latest time node N can start: `LF(N) - duration(N)` |
| Slack(N) | **Total Slack**: The amount of time N can be delayed without affecting the critical path: `LS(N) - ES(N)` |

**Critical Path Identification**:

The critical path consists of all nodes where `Slack(N) = 0`. These nodes form a continuous path (or paths) from a source to a sink, and any delay at these nodes directly increases the total network duration.

**Result Table**:

| Node | Duration | ES | EF | LS | LF | Slack | Critical? |
|------|----------|----|----|----|----|-------|-----------|
| 1 | 5.0 | 0.0 | 5.0 | 0.0 | 5.0 | 0.0 | Yes |
| 2 | 3.0 | 5.5 | 8.5 | 7.5 | 10.5 | 2.0 | No |
| 3 | 7.0 | 6.0 | 13.0 | 6.0 | 13.0 | 0.0 | Yes |
| ... | ... | ... | ... | ... | ... | ... | ... |

---

### 8.3 Cost Analysis {#cost-analysis}

The cost analysis uses the same forward/backward pass structure as time analysis, but substitutes costs for durations and cost accumulation for time accumulation.

**Forward Pass**:

```
For each node N in topological order:
  IF N is a source node:
    Accumulated_Cost(N) = node_cost(N)
  ELSE:
    Accumulated_Cost(N) = max over all parents P of:
      Accumulated_Cost(P) + edge_cost(P -> N)
    Accumulated_Cost(N) += node_cost(N)
```

**Backward Pass**:

```
Critical_Cost = max over all sink nodes S of Accumulated_Cost(S)

For each node N in REVERSE topological order:
  IF N is a sink node:
    Late_Cost(N) = Critical_Cost
  ELSE:
    Late_Cost(N) = min over all successors C of:
      Late_Cost(C) - edge_cost(N -> C)

  Cost_Slack(N) = Late_Cost(N) - Accumulated_Cost(N)
```

**Budget Share**:

```
Budget_Share(N) = Accumulated_Cost(N) / Critical_Cost * 100%
```

This metric shows what fraction of the total critical cost is consumed by or attributed to each node's path.

**Important Note**: The critical cost path may differ from the critical time path. A node can be time-critical but not cost-critical, and vice versa. The CPM view highlights these differences explicitly.

---

### 8.4 Gantt Chart View {#gantt-chart}

The Gantt chart provides a visual timeline representation of the time analysis results.

**Chart Elements**:

- **Bars**: Each node is represented by a horizontal bar spanning from its Early Start (ES) to its Early Finish (EF)
- **Critical path highlighting**: Nodes on the critical path are rendered in a distinct color (typically red or orange) to visually distinguish them from non-critical nodes
- **Slack visualization**: Non-critical nodes display an extended dashed bar from EF to EF + Slack, showing the available scheduling flexibility
- **Y-axis**: Nodes, ordered by topological level and then by ES within each level
- **X-axis**: Time units

**Interactivity**:

- Hover over a bar to see the node's full scheduling details (ES, EF, LS, LF, Slack, Duration)
- Click a node to highlight its predecessors and successors in the chart
- Zoom and pan to explore large networks

---

### 8.5 Path Comparison {#path-comparison}

The CPM view includes a path comparison panel that juxtaposes the time and cost critical paths.

**Comparison Table**:

| Node | On Time Critical Path | On Cost Critical Path | Category |
|------|----------------------|----------------------|----------|
| 1 | Yes | Yes | Shared |
| 2 | No | Yes | Cost-only |
| 3 | Yes | No | Time-only |
| 4 | Yes | Yes | Shared |
| 5 | No | No | Non-critical |

**Categories**:

| Category | Meaning |
|----------|---------|
| **Shared Critical** | Node is on both time and cost critical paths -- highest priority for optimization |
| **Time-only Critical** | Node delays the schedule but does not dominate cost -- optimize for speed |
| **Cost-only Critical** | Node drives cost but has time slack -- optimize for cost reduction |
| **Non-critical** | Node has slack in both time and cost -- lowest priority |

This comparison helps researchers and engineers prioritize which nodes to optimize based on whether their goal is to minimize duration, minimize cost, or both.

---

## 9. API Reference {#api-reference}

All API endpoints accept and return JSON (except for the upload endpoint which uses multipart form data). The backend runs on `http://localhost:8080` by default.

**Common Error Response Format**:

```json
{
  "success": false,
  "error": "Descriptive error message explaining what went wrong"
}
```

All successful responses include `"success": true` at the top level.

---

### 9.1 Health Check {#api-health}

Verifies the backend server is running and responsive.

**Request**:

```
GET /health
```

**Response**:

```json
{
  "status": "healthy"
}
```

**Usage**: Call this endpoint to verify the backend is accessible before attempting analysis requests. The Angular frontend calls this on startup.

---

### 9.2 Upload Files {#api-upload}

Uploads one or more network files to the server for subsequent analysis.

**Request**:

```
POST /upload
Content-Type: multipart/form-data
Body: one or more files, maintaining their relative directory structure
```

**Response**:

```json
{
  "success": true,
  "network_path": "/absolute/path/to/temp_uploads/<uuid>/",
  "upload_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "files_count": 5,
  "uploaded_files": [
    "my-network.EDGES",
    "float/my-network-nodepriors.json",
    "float/my-network-linkprobabilities.json",
    "capacity/my-network-capacities.json",
    "cpm/my-network-cpm.json"
  ],
  "edges_files": [
    "my-network.EDGES"
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `network_path` | string | Absolute path to the upload directory on the server |
| `upload_id` | string | UUID identifying this upload session |
| `files_count` | integer | Number of files successfully uploaded |
| `uploaded_files` | string[] | Relative paths of all uploaded files within the upload directory |
| `edges_files` | string[] | Relative paths of detected `.EDGES` files |

---

### 9.3 Network Structure {#api-structure}

Parses the EDGES file and returns comprehensive topological analysis of the DAG.

**Request**:

```
POST /network-structure
Content-Type: application/json

{
  "networkPath": "/absolute/path/to/upload/directory/",
  "edgesFilePath": "my-network.EDGES"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `networkPath` | string | Yes | Absolute path to the upload directory |
| `edgesFilePath` | string | No | Relative path to the `.EDGES` file within `networkPath`. If omitted, the first detected `.EDGES` file is used. |

**Response**:

```json
{
  "success": true,
  "network_structure": {
    "total_nodes": 5,
    "total_edges": 5,
    "nodes": ["1", "2", "3", "4", "5"],
    "edges": [["1","2"], ["1","3"], ["2","4"], ["3","4"], ["4","5"]],
    "source_nodes": ["1"],
    "sink_nodes": ["5"],
    "fork_nodes": ["1"],
    "join_nodes": ["4"],
    "iteration_sets": [["1"], ["2","3"], ["4"], ["5"]],
    "ancestors": {
      "1": [],
      "2": ["1"],
      "3": ["1"],
      "4": ["1","2","3"],
      "5": ["1","2","3","4"]
    },
    "descendants": {
      "1": ["2","3","4","5"],
      "2": ["4","5"],
      "3": ["4","5"],
      "4": ["5"],
      "5": []
    },
    "outgoing_index": {
      "1": ["2","3"],
      "2": ["4"],
      "3": ["4"],
      "4": ["5"],
      "5": []
    },
    "incoming_index": {
      "1": [],
      "2": ["1"],
      "3": ["1"],
      "4": ["2","3"],
      "5": ["4"]
    }
  }
}
```

---

### 9.4 Diamond Analysis {#api-diamonds}

Identifies all diamond structures in the network, including nested diamonds.

**Request**:

```
POST /diamond-analysis
Content-Type: application/json

{
  "networkPath": "/absolute/path/to/upload/directory/",
  "nodepriorsPath": "float/my-network-nodepriors.json"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `networkPath` | string | Yes | Absolute path to the upload directory |
| `nodepriorsPath` | string | No | Relative path to node priors file. If omitted, all node priors default to 1.0. |

**Response**:

```json
{
  "success": true,
  "diamond_analysis": {
    "root_diamonds_count": 1,
    "unique_diamonds_count": 1,
    "raw_root_diamonds": {
      "12345678": {
        "join_node": "4",
        "diamond": {
          "conditioning_nodes": ["1"],
          "relevant_nodes": ["1", "2", "3", "4"],
          "edgelist": [["1","2"], ["1","3"], ["2","4"], ["3","4"]],
          "sub_sources": ["1"],
          "sub_join_nodes": ["4"],
          "sub_fork_nodes": ["1"]
        },
        "classification": {
          "fork_structure": "Single",
          "internal_structure": "Simple",
          "path_topology": "Parallel",
          "join_structure": "Single",
          "external_connectivity": "Embedded",
          "degeneracy": "Valid"
        }
      }
    },
    "raw_unique_diamonds": {
      "12345678": {
        "node_count": 4,
        "edge_count": 4,
        "sub_sources": ["1"],
        "sub_join_nodes": ["4"],
        "sub_fork_nodes": ["1"],
        "conditioning_nodes": ["1"],
        "iteration_sets": [["1"], ["2","3"], ["4"]]
      }
    }
  }
}
```

---

### 9.5 Reachability / Exact Inference {#api-reachability}

Runs exact inference to compute belief values for all nodes.

**Request**:

```
POST /reachability-analysis
Content-Type: application/json

{
  "networkPath": "/absolute/path/to/upload/directory/",
  "nodepriorsPath": "float/my-network-nodepriors.json",
  "linkprobsPath": "float/my-network-linkprobabilities.json",
  "includeExactInference": true,
  "includeDiamondAnalysis": false
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `networkPath` | string | Yes | Absolute path to the upload directory |
| `nodepriorsPath` | string | Yes | Relative path to node priors JSON |
| `linkprobsPath` | string | Yes | Relative path to link probabilities JSON |
| `includeExactInference` | boolean | No | Whether to run exact inference (default: true) |
| `includeDiamondAnalysis` | boolean | No | Whether to include diamond analysis results in the response (default: false) |

**Response**:

```json
{
  "success": true,
  "reachability_result": {
    "exact_inference": {
      "beliefs": {
        "1": 0.9,
        "2": 0.6885,
        "3": 0.7695,
        "4": 0.8372,
        "5": 0.6997
      },
      "node_priors": {
        "1": 0.9,
        "2": 0.85,
        "3": 0.95,
        "4": 1.0,
        "5": 0.88
      },
      "computation_time": 0.0523,
      "belief_statistics": {
        "mean": 0.7390,
        "min": 0.6885,
        "max": 0.9
      }
    }
  }
}
```

**Notes**:
- `computation_time` is in seconds
- `belief_statistics` summarizes the belief distribution across all nodes
- When `includeDiamondAnalysis` is true, the response also includes a `"diamond_analysis"` field with the same structure as the [Diamond Analysis](#api-diamonds) response

---

### 9.6 Capacity Analysis {#api-capacity}

Runs network flow capacity analysis.

**Request**:

```
POST /capacity-analysis
Content-Type: application/json

{
  "networkPath": "/absolute/path/to/upload/directory/",
  "capacitiesPath": "capacity/my-network-capacities.json"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `networkPath` | string | Yes | Absolute path to the upload directory |
| `capacitiesPath` | string | Yes | Relative path to capacities JSON file |

**Response**:

```json
{
  "success": true,
  "capacity_result": {
    "node_max_flows": {
      "1": 100.0,
      "2": 50.0,
      "3": 75.0,
      "4": 60.0,
      "5": 60.0
    },
    "bottlenecks": {
      "primary": {
        "element": "4",
        "type": "node",
        "capacity": 60.0,
        "utilization": 1.0
      },
      "secondary": []
    },
    "critical_paths": {
      "to_5": {
        "path": ["1", "3", "4", "5"],
        "bottleneck_capacity": 60.0,
        "bottleneck_element": "4"
      }
    },
    "network_utilization": 0.85,
    "edge_utilization": {
      "(1,2)": {
        "flow": 50.0,
        "capacity": 80.0,
        "utilization": 0.625
      },
      "(1,3)": {
        "flow": 75.0,
        "capacity": 90.0,
        "utilization": 0.833
      },
      "(2,4)": {
        "flow": 50.0,
        "capacity": 55.0,
        "utilization": 0.909
      },
      "(3,4)": {
        "flow": 60.0,
        "capacity": 70.0,
        "utilization": 0.857
      },
      "(4,5)": {
        "flow": 60.0,
        "capacity": 65.0,
        "utilization": 0.923
      }
    },
    "comparative_analysis": {
      "upgrade_priorities": [
        {
          "element": "4",
          "type": "node",
          "current_capacity": 60.0,
          "estimated_improvement": 15.0
        }
      ]
    }
  }
}
```

---

### 9.7 CPM Analysis {#api-cpm}

Runs Critical Path Method analysis for both time and cost.

**Request**:

```
POST /cpm-analysis
Content-Type: application/json

{
  "networkPath": "/absolute/path/to/upload/directory/",
  "cpmPath": "cpm/my-network-cpm.json"
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `networkPath` | string | Yes | Absolute path to the upload directory |
| `cpmPath` | string | Yes | Relative path to CPM input JSON file |

**Response**:

```json
{
  "success": true,
  "time_result": {
    "critical_value": 26.0,
    "critical_nodes": ["1", "3", "4", "5"],
    "node_values": {
      "1": 5.0,
      "2": 3.0,
      "3": 7.0,
      "4": 2.0,
      "5": 4.0
    },
    "early_start": {
      "1": 0.0,
      "2": 5.5,
      "3": 6.0,
      "4": 13.8,
      "5": 16.0
    },
    "early_finish": {
      "1": 5.0,
      "2": 8.5,
      "3": 13.0,
      "4": 15.8,
      "5": 20.0
    },
    "late_start": {
      "1": 0.0,
      "2": 7.5,
      "3": 6.0,
      "4": 13.8,
      "5": 16.0
    },
    "late_finish": {
      "1": 5.0,
      "2": 10.5,
      "3": 13.0,
      "4": 15.8,
      "5": 20.0
    },
    "total_slack": {
      "1": 0.0,
      "2": 2.0,
      "3": 0.0,
      "4": 0.0,
      "5": 0.0
    }
  },
  "cost_result": {
    "critical_value": 2370,
    "critical_nodes": ["1", "3", "4", "5"],
    "node_values": {
      "1": 1000,
      "2": 500,
      "3": 1200,
      "4": 300,
      "5": 800
    },
    "early_start": { "...": "..." },
    "early_finish": { "...": "..." },
    "late_start": { "...": "..." },
    "late_finish": { "...": "..." },
    "total_slack": { "...": "..." }
  },
  "input_data": {
    "time_analysis": {
      "node_durations": { "1": 5.0, "2": 3.0, "3": 7.0, "4": 2.0, "5": 4.0 },
      "edge_delays": { "(1,2)": 0.5, "(1,3)": 1.0, "(2,4)": 0.3, "(3,4)": 0.8, "(4,5)": 0.2 }
    },
    "cost_analysis": {
      "node_costs": { "1": 1000, "2": 500, "3": 1200, "4": 300, "5": 800 },
      "edge_costs": { "(1,2)": 100, "(1,3)": 150, "(2,4)": 80, "(3,4)": 120, "(4,5)": 90 }
    }
  }
}
```

---

### 9.8 Diamond Subgraph Analysis {#api-subgraph}

Runs one or more analysis types on a specific diamond subgraph, with optional source value overrides.

**Request**:

```
POST /diamond-subgraph-analysis
Content-Type: application/json

{
  "networkPath": "/absolute/path/to/upload/directory/",
  "nodepriorsPath": "float/my-network-nodepriors.json",
  "linkprobsPath": "float/my-network-linkprobabilities.json",
  "capacitiesPath": "capacity/my-network-capacities.json",
  "cpmPath": "cpm/my-network-cpm.json",
  "diamondHash": "12345678",
  "analyses": ["reachability", "capacity", "cpm"],
  "sourceOverrides": {
    "reachability": { "1": 0.8 },
    "capacity": { "1": 50.0 },
    "cpm_time": { "1": 3.0 },
    "cpm_cost": { "1": 200 }
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `networkPath` | string | Yes | Absolute path to the upload directory |
| `nodepriorsPath` | string | Conditional | Required if `"reachability"` is in `analyses` |
| `linkprobsPath` | string | Conditional | Required if `"reachability"` is in `analyses` |
| `capacitiesPath` | string | Conditional | Required if `"capacity"` is in `analyses` |
| `cpmPath` | string | Conditional | Required if `"cpm"` is in `analyses` |
| `diamondHash` | string | Yes | Hash identifier of the target diamond (from diamond analysis results) |
| `analyses` | string[] | Yes | Array of analysis types to run: `"reachability"`, `"capacity"`, `"cpm"` |
| `sourceOverrides` | object | No | Override values for the diamond's sub-source nodes, keyed by analysis type |

**Response**:

```json
{
  "success": true,
  "diamond_hash": "12345678",
  "diamond_info": {
    "join_node": "4",
    "conditioning_nodes": ["1"],
    "node_count": 4,
    "edge_count": 4,
    "source_priors": {
      "1": 0.9
    }
  },
  "reachability_result": {
    "beliefs": {
      "1": 0.8,
      "2": 0.612,
      "3": 0.684,
      "4": 0.741
    },
    "computation_time": 0.012
  },
  "capacity_result": {
    "node_max_flows": {
      "1": 50.0,
      "2": 50.0,
      "3": 50.0,
      "4": 50.0
    },
    "computation_time": 0.005
  },
  "cpm_result": {
    "time_result": {
      "critical_value": 14.8,
      "critical_nodes": ["1", "3", "4"],
      "node_values": { "1": 3.0, "2": 3.0, "3": 7.0, "4": 2.0 },
      "early_start": { "...": "..." },
      "late_finish": { "...": "..." },
      "total_slack": { "...": "..." }
    },
    "cost_result": {
      "critical_value": 1670,
      "critical_nodes": ["1", "3", "4"],
      "node_values": { "1": 200, "2": 500, "3": 1200, "4": 300 }
    },
    "computation_time": 0.008
  }
}
```

**Notes**:
- Only the analysis types listed in `analyses` are computed and returned
- `sourceOverrides` allows you to experiment with different entry conditions without re-uploading files
- The `diamond_info.source_priors` field shows the original (non-overridden) priors for reference

---

## 10. Glossary {#glossary}

| Term | Definition |
|------|-----------|
| **DAG** | Directed Acyclic Graph -- a network with directed edges and no cycles. The fundamental data structure for all analyses in this framework. |
| **Belief** | The computed probability that a node is reachable or active, accounting for all upstream paths, priors, link probabilities, and diamond dependencies. |
| **Prior** | The intrinsic probability assigned to a node before considering network connectivity effects. Represents the node's inherent reliability or availability. |
| **Link Probability** | The transmission probability on a directed edge, representing the chance that information successfully traverses from source to target node. |
| **Diamond** | A convergent subgraph where multiple paths from shared fork ancestors meet at a common join node, creating statistical dependency between those paths. |
| **Conditioning Node** | A shared fork ancestor node in a diamond structure. During exact inference, the algorithm enumerates all possible active/inactive states of conditioning nodes to correctly handle dependency. |
| **Iteration Set** | A topological level in the DAG: the set of all nodes at the same BFS depth from source nodes. Nodes within a level can be processed in parallel. |
| **Inclusion-Exclusion** | The combinatorial formula `P(A1 U A2 U ... U An) = sum(P(Ai)) - sum(P(Ai intersect Aj)) + ...` used to compute the probability of receiving at least one signal from independent parents at a join node. |
| **P-box** | Probability box -- an upper and lower bound on a cumulative distribution function (CDF), representing deep uncertainty where the exact distribution is unknown. More general than intervals and precise probabilities. |
| **Interval** | A bounded range [lower, upper] representing epistemic uncertainty about a probability value. The true value is known to lie within the bounds but its exact position is unknown. |
| **Critical Path** | The longest path through the network in terms of time or cost, determining the minimum project duration or maximum accumulated cost. All nodes on the critical path have zero slack. |
| **Slack** | The amount by which a node's start time (or cost accumulation) can be delayed without affecting the overall critical path duration or cost. Zero slack indicates the node is on the critical path. |
| **Bottleneck** | A node or edge whose capacity constrains the overall network throughput. Identified when utilization exceeds 95% or when it is the minimum-capacity element on the widest path to a sink. |
| **Source Rate** | The rate at which flow enters the network at a source node in capacity analysis. Represents the external supply of information, material, or resources. |
| **Utilization** | The ratio of actual flow to capacity (`flow / capacity`) for a node or edge. Values near 1.0 indicate the element is operating at or near its maximum capacity. |
| **Fork Node** | A node with more than one outgoing edge, where information or flow diverges into multiple downstream paths. |
| **Join Node** | A node with more than one incoming edge, where information or flow from multiple upstream paths converges. |
| **Source Node** | A node with no incoming edges, serving as an entry point for information or flow into the network. |
| **Sink Node** | A node with no outgoing edges, serving as a terminal point where propagated information or flow arrives. |
| **Sensitivity Score** | The absolute difference between a node's belief and its prior: `|Belief - Prior|`. High sensitivity means the node's state is heavily influenced by network connectivity rather than its own prior. |
| **Network Density** | The ratio of actual edges to the maximum possible edges in the DAG: `|E| / (|V| * (|V|-1) / 2)`. Higher density indicates a more interconnected network. |
| **Parallelism Index** | The maximum number of nodes in any single iteration set (topological level). Indicates the maximum degree of parallel processing possible in the network. |
| **Topological Order** | An ordering of DAG nodes such that for every directed edge (u, v), node u appears before node v. All forward-pass algorithms rely on processing nodes in topological order. |
| **Conditional Enumeration** | The technique of exhaustively enumerating all possible states of conditioning nodes in a diamond to compute exact beliefs, avoiding the independence assumption that would yield incorrect results. |
| **Epistemic Uncertainty** | Uncertainty due to lack of knowledge, represented by intervals or p-boxes. Can be reduced with more data or better models. Distinct from aleatory (random) uncertainty. |
| **Aleatory Uncertainty** | Inherent randomness that cannot be reduced by gathering more data. Typically modeled as precise probability distributions. |

---

*This documentation covers the IPA Framework version as of March 2026. For implementation details, refer to the source code in the `src/` directory and the test files in `test/`.*
