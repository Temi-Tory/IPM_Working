# Data Formats

## Network Topology (.EDGES File)

The `.EDGES` file defines the directed graph structure. Two formats are supported:

### Edge List (Recommended)

A CSV file where each row is a directed edge:

```csv
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

- No header row required
- Comma-separated: `source,destination`
- Node IDs are integers (1-indexed)
- Each line defines one directed edge

### Adjacency Matrix

A square matrix where `matrix[i][j] = 1` means there is an edge from node `i` to node `j`:

```csv
0,1,1,0,0,0,0,0
0,0,0,1,1,0,0,0
0,0,0,0,0,1,0,0
0,0,0,0,0,1,1,0
0,0,0,0,0,0,1,0
0,0,0,0,0,0,0,1
0,0,0,0,0,0,0,1
0,0,0,0,0,0,0,0
```

The framework auto-detects which format is used based on the file structure.

---

## Node Priors JSON

Node priors define the intrinsic activation probability of each node.

### Float64 Format

```json
{
  "data_type": "Float64",
  "nodes": {
    "1": 0.9,
    "2": 0.85,
    "3": 0.95,
    "4": 0.9,
    "5": 0.88
  }
}
```

### Interval Format

```json
{
  "data_type": "Interval",
  "nodes": {
    "1": { "type": "interval", "lower": 0.85, "upper": 0.95 },
    "2": { "type": "interval", "lower": 0.80, "upper": 0.90 },
    "3": { "type": "interval", "lower": 0.90, "upper": 1.00 }
  }
}
```

### P-Box Format

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
      "construction_type": "interval",
      "lower": 0.80,
      "upper": 0.95
    }
  }
}
```

P-box construction types:

| Type | Parameters | Description |
|------|-----------|------------|
| `parametric` | `shape`, `params` | Distribution with uncertain parameters |
| `interval` | `lower`, `upper` | Bounds on the CDF |
| `kernel` | `data` | Empirical data |

Supported parametric shapes: `normal`, `uniform`, `triangular`, `beta`

---

## Edge Probabilities JSON (Link Probabilities)

Edge probabilities define the transmission probability of each edge.

### Float64 Format

```json
{
  "data_type": "Float64",
  "links": {
    "(1,3)": 0.8,
    "(1,4)": 0.75,
    "(2,4)": 0.82,
    "(2,5)": 0.79
  }
}
```

### Interval Format

```json
{
  "data_type": "Interval",
  "links": {
    "(1,3)": { "type": "interval", "lower": 0.75, "upper": 0.85 },
    "(1,4)": { "type": "interval", "lower": 0.70, "upper": 0.80 }
  }
}
```

### P-Box Format

```json
{
  "data_type": "pbox",
  "links": {
    "(1,3)": {
      "type": "pbox",
      "construction_type": "parametric",
      "shape": "normal",
      "params": [0.8, 0.03]
    }
  }
}
```

> **Important**: Edge keys use the format `"(source,destination)"` with parentheses and a comma. Example: `"(1,3)"` means edge from node 1 to node 3.

---

## Capacities JSON

Capacity data defines throughput limits for nodes and edges.

Supported capacity uncertainty types:

- `Float64` (deterministic)
- `Interval` (exact bounds)

`pbox` is **not** currently supported for capacity analysis.

```json
{
  "data_type": "Float64",
  "capacities": {
    "nodes": {
      "1": 100.0,
      "2": 150.0,
      "3": 80.0,
      "4": 120.0,
      "5": 90.0,
      "6": 110.0,
      "7": 95.0,
      "8": 200.0
    },
    "edges": {
      "(1,3)": 50.0,
      "(1,4)": 75.0,
      "(2,4)": 60.0,
      "(2,5)": 55.0,
      "(3,6)": 45.0,
      "(4,6)": 70.0,
      "(4,7)": 65.0,
      "(5,7)": 50.0,
      "(6,8)": 80.0,
      "(7,8)": 75.0
    },
    "source_rates": {
      "1": 80.0,
      "2": 120.0
    }
  }
}
```

### Interval Capacity Example

```json
{
  "data_type": "Interval",
  "capacities": {
    "nodes": {
      "1": { "type": "interval", "lower": 90.0, "upper": 110.0 },
      "2": { "type": "interval", "lower": 140.0, "upper": 160.0 }
    },
    "edges": {
      "(1,3)": { "type": "interval", "lower": 45.0, "upper": 55.0 },
      "(2,4)": { "type": "interval", "lower": 58.0, "upper": 66.0 }
    },
    "source_rates": {
      "1": { "type": "interval", "lower": 70.0, "upper": 85.0 },
      "2": { "type": "interval", "lower": 110.0, "upper": 125.0 }
    }
  }
}
```

| Section | Key Format | Value | Description |
|---------|-----------|-------|------------|
| `nodes` | `"node_id"` | Float or Interval object | Maximum throughput of the node |
| `edges` | `"(src,dst)"` | Float or Interval object | Maximum flow the edge can carry |
| `source_rates` | `"node_id"` | Float or Interval object (> 0 active) | Input rate at each source node |

> Only source nodes with rate `> 0` are treated as active sources. Zero/negative source rates are ignored by the backend.

---

## CPM Inputs JSON

CPM data supports both time and cost analysis in a single file.

```json
{
  "time_analysis": {
    "node_durations": {
      "1": 2.5,
      "2": 3.0,
      "3": 1.5,
      "4": 4.0,
      "5": 2.0,
      "6": 3.5,
      "7": 2.8,
      "8": 1.0
    },
    "edge_delays": {
      "(1,3)": 0.5,
      "(1,4)": 1.0,
      "(2,4)": 0.0,
      "(2,5)": 0.3,
      "(3,6)": 0.2,
      "(4,6)": 0.8,
      "(4,7)": 0.5,
      "(5,7)": 0.4,
      "(6,8)": 0.6,
      "(7,8)": 0.3
    }
  },
  "cost_analysis": {
    "node_costs": {
      "1": 500,
      "2": 750,
      "3": 300,
      "4": 1200,
      "5": 400,
      "6": 800,
      "7": 650,
      "8": 200
    },
    "edge_costs": {
      "(1,3)": 50,
      "(1,4)": 100,
      "(2,4)": 75,
      "(2,5)": 40,
      "(3,6)": 30,
      "(4,6)": 90,
      "(4,7)": 60,
      "(5,7)": 45,
      "(6,8)": 70,
      "(7,8)": 55
    }
  }
}
```

### Time Analysis Section

| Field | Key Format | Value | Description |
|-------|-----------|-------|------------|
| `node_durations` | `"node_id"` | Float | How long the task takes (hours) |
| `edge_delays` | `"(src,dst)"` | Float | Transit/handoff time between tasks |

### Cost Analysis Section

| Field | Key Format | Value | Description |
|-------|-----------|-------|------------|
| `node_costs` | `"node_id"` | Float | Cost of performing the task |
| `edge_costs` | `"(src,dst)"` | Float | Transfer/communication cost |

> Both sections are optional. If only `time_analysis` is provided, only time analysis runs. If only `cost_analysis`, only cost analysis runs. If both, both run.

---

## File Naming Conventions

The frontend automatically categorises files based on their names:

| Pattern | Category | Analysis |
|---------|----------|----------|
| `*.EDGES` | Network topology | All analyses |
| `*-nodepriors.json` or `*nodepriors*` | Node priors | Reachability, Diamond |
| `*-linkprobabilities.json` or `*linkprob*` | Edge probabilities | Reachability |
| `*-capacities.json` or `*capacit*` | Capacity data | Capacity |
| `*-cpm-inputs.json` or `*cpm*` | CPM data | Time, Cost |

---

## Multi-Scenario Organisation

Group scenario files in subdirectories:

```
my-network/
  my-network.EDGES              # Shared across all scenarios
  scenario-a/
    my-network-nodepriors.json
    my-network-linkprobabilities.json
  scenario-b/
    my-network-nodepriors.json
    my-network-linkprobabilities.json
  high-load/
    my-network-capacities.json
  normal-load/
    my-network-capacities.json
  cpm/
    my-network-cpm-inputs.json
  cpm-delayed/
    my-network-cpm-inputs.json
```

Each subdirectory becomes a separate scenario tab in the UI.

---

## Validation Rules

| Rule | Scope | Description |
|------|-------|------------|
| All probabilities in [0, 1] | Node priors, edge probs | Values outside this range are rejected |
| All nodes have priors | Belief propagation | Missing nodes default to 1.0 |
| All edges have probabilities | Belief propagation | Missing edges cause errors |
| Capacity `data_type` | Capacity analysis | Must be `Float64` or `Interval` |
| Capacity interval bounds | Capacity analysis | `lower <= upper` (malformed intervals are corrected) |
| Source rates > 0 | Capacity analysis | Only positive rates create active sources |
| Durations >= 0 | CPM | Negative durations are invalid |
| DAG structure | All | Cycles are detected and reported as errors |
