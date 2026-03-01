# Getting Started

## Prerequisites

Before using the IPA Framework, ensure you have:

1. **Julia 1.10+** installed (for the backend server)
2. **Node.js 18+** and **npm** (for the frontend)
3. A modern browser (Chrome, Firefox, Edge)

---

## Starting the Backend

Navigate to the backend directory and start the server with multithreading enabled:

```bash
cd src/Network-flow-algos
julia --threads=auto backend_server.jl
```

You should see a confirmation message once the server starts. The `--threads=auto` flag enables parallel diamond computation.

> **Tip**: To verify the server is running, navigate to the `/health` endpoint in your browser. You should see `{"status": "healthy"}`.

---

## Starting the Frontend

In a separate terminal, navigate to the frontend workspace and start the development server:

```bash
cd src/Network-flow-algos/front-end/inf-prop-ui
npx nx serve info-prop-ui
```

The frontend development server will start and display the URL to access the application.

---

## Quick Walkthrough

### Step 1: Upload Network Files

1. Click **Upload Network** in the sidebar
2. Click the upload area or drag-and-drop a folder containing your network files
3. The system automatically categorises your files:
   - `.EDGES` files -- network topology
   - `*-nodepriors.json` -- node prior probabilities
   - `*-linkprobabilities.json` -- edge transmission probabilities
   - `*-capacities.json` -- node and edge capacities
   - `*-cpm-inputs.json` -- task durations, delays, and costs

### Step 2: Explore Network Structure

After uploading, the sidebar enables the analysis tabs based on what files were detected:

- **Network Visualization** -- Always available after upload. Shows an interactive D3 force-directed graph.
- **Network Structure** -- Shows topology details: node types (source, sink, fork, join), edge counts, topological layers.
- **Diamond Analysis** -- Available when probability data is detected.
- **Exact Inference** -- Available when both node priors and link probabilities are present.
- **Capacity Analysis** -- Available when capacity data is detected.
- **Time / Cost Analysis** -- Available when CPM input data is detected.

### Step 3: Run Analysis

Each analysis view automatically detects available scenarios (subfolders in your upload). For example, if you uploaded:

```
grid-graph/
  grid-graph.EDGES
  Degraded/
    grid-graph-nodepriors.json
    grid-graph-linkprobabilities.json
  Major Degraded/
    grid-graph-nodepriors.json
    grid-graph-linkprobabilities.json
  float/
    grid-graph-nodepriors.json
    grid-graph-linkprobabilities.json
```

The Exact Inference view would show three scenario tabs: "Degraded", "Major Degraded", and "float". Each scenario runs independently and results can be compared.

### Step 4: Interpret Results

Each analysis view provides:
- **Metrics panel** at the top with key summary statistics
- **Results table** with sortable columns, search, and pagination
- **Export** to CSV or JSON
- **Copy on click** for individual values

---

## Example Network Structure

A minimal network for testing:

**grid-graph.EDGES** (edge list format):
```
1,3
1,4
2,4
2,5
3,6
4,6
4,7
5,7
6,8
7,8
```

This creates a 8-node grid with two sources (1, 2) and one sink (8).

**Corresponding node priors** (`grid-graph-nodepriors.json`):
```json
{
  "data_type": "Float64",
  "nodes": {
    "1": 0.9,
    "2": 0.85,
    "3": 0.95,
    "4": 0.9,
    "5": 0.88,
    "6": 0.92,
    "7": 0.91,
    "8": 0.93
  }
}
```

**Corresponding edge probabilities** (`grid-graph-linkprobabilities.json`):
```json
{
  "data_type": "Float64",
  "links": {
    "(1,3)": 0.8,
    "(1,4)": 0.75,
    "(2,4)": 0.82,
    "(2,5)": 0.79,
    "(3,6)": 0.85,
    "(4,6)": 0.77,
    "(4,7)": 0.81,
    "(5,7)": 0.83,
    "(6,8)": 0.88,
    "(7,8)": 0.86
  }
}
```

---

## Folder Organisation for Multi-Scenario Analysis

To run multiple scenarios, organise your files like this:

```
my-network/
  my-network.EDGES                    # Shared topology (one .EDGES file)
  scenario-A/
    my-network-nodepriors.json        # Scenario A probabilities
    my-network-linkprobabilities.json
  scenario-B/
    my-network-nodepriors.json        # Scenario B probabilities
    my-network-linkprobabilities.json
  capacity-scenario/
    my-network-capacities.json        # Capacity data
  cpm/
    my-network-cpm-inputs.json        # CPM scheduling data
```

The framework detects scenario folders automatically and creates separate tabs for each.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend won't start | Ensure Julia packages are installed: `using Pkg; Pkg.add(["HTTP", "JSON", "UUIDs"])` |
| Frontend can't connect to backend | Check the backend is running on port 8080. Check CORS is not blocked by browser extensions. |
| No analysis tabs enabled after upload | Ensure your files follow the naming conventions (`.EDGES`, `*-nodepriors.json`, etc.) |
| "No .EDGES file found" error | The `.EDGES` file must be in the root of the uploaded folder, not in a subdirectory |
| Slow diamond computation | Start Julia with more threads: `julia --threads=8 backend_server.jl` |
