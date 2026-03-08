# API Documentation: Backend Capacity Analysis Service

Complete reference for integrating with the Julia backend server.

---

## Table of Contents
1. [Service Overview](#service-overview)
2. [API Endpoint](#api-endpoint)
3. [Request Structure](#request-structure)
4. [Response Structure](#response-structure)
5. [Data Types Reference](#data-types-reference)
6. [Error Handling](#error-handling)
7. [Example Calls](#example-calls)
8. [Integration Guide](#integration-guide)

---

## Service Overview

**Service Name**: Capacity Analysis Backend  
**Language**: Julia  
**Location**: `src/Network-flow-algos/backend_server.jl`  
**Purpose**: Computes max flow with node/edge capacity constraints, generates bottleneck analysis, upgrade priorities, and critical path reports

**Key Capabilities**:
- ✅ Max flow computation with node processing constraints
- ✅ Bottleneck identification and classification
- ✅ Upgrade impact analysis with marginal values
- ✅ Critical path and single point of failure detection
- ✅ Realistic vs classical flow comparison
- ✅ Interval-based uncertainty analysis
- ✅ Flow validation and constraint checking

---

## API Endpoint

### Base URL
```
http://localhost:PORT/
```

**Default Port**: `8000` (configure in `backend_server.jl`)

### Capacity Analysis Endpoint

**Endpoint**: `/capacity-analysis`  
**Method**: `POST`  
**Content-Type**: `application/json`  
**Response Type**: `application/json`

---

## Request Structure

### Complete Request Schema

```json
{
  "network": {
    "nodes": [1, 2, 3, ..., 32],
    "edges": [
      [1, 9],
      [1, 11],
      [2, 10],
      ...
    ],
    "sources": [1, 2],
    "sinks": [25, 26, 27, 28, 29, 30, 31, 32]
  },
  
  "capacities": {
    "nodes": {
      "1": 50.0,
      "2": 55.0,
      "11": 20.96,
      "19": 32.0,
      ...
    },
    "edges": {
      "[1,9]": 30.0,
      "[1,11]": 25.0,
      "[11,19]": 14.28,
      "[11,21]": 13.48,
      ...
    }
  },
  
  "source_rates": {
    "1": 42.0,
    "2": 42.0
  },
  
  "options": {
    "data_type": "Float64",
    "use_network_flow": true,
    "include_upgrade_analysis": true,
    "include_critical_paths": true,
    "include_comparative_analysis": true,
    "include_validation": true,
    "detailed_bottleneck_info": true
  }
}
```

### Field Descriptions

#### `network` Object
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `nodes` | array | List of all node IDs in network | ✅ Yes |
| `edges` | array of tuples | List of directed edges [from, to] | ✅ Yes |
| `sources` | array | Source node IDs (supply nodes) | ✅ Yes |
| `sinks` | array | Sink node IDs (demand nodes) | ✅ Yes |

#### `capacities` Object
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `nodes` | dict | Node ID → capacity (float) mapping | ✅ Yes |
| `edges` | dict | Edge "[from,to]" → capacity (float) mapping | ✅ Yes |

**Note**: Key format for edges must be `"[from,to]"` as string, or will accept dict with tuple keys in Julia

#### `source_rates` Object
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| Per source ID | float | Flow rate available at each source | ✅ Yes |

Example: `{"1": 42.0, "2": 42.0}`

#### `options` Object
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `data_type` | string | "Float64" | "Float64" or "Interval" for uncertainty analysis |
| `use_network_flow` | bool | true | Enable max flow computation |
| `include_upgrade_analysis` | bool | true | Generate upgrade priorities |
| `include_critical_paths` | bool | true | Identify critical paths & SPOFs |
| `include_comparative_analysis` | bool | true | Compare realistic vs classical |
| `include_validation` | bool | true | Validate solution quality |
| `detailed_bottleneck_info` | bool | true | Include utilization by component |

#### Data Type: Float64 (Deterministic)
All capacities are exact single values. Standard max flow computation.

#### Data Type: Interval (Uncertainty)
All capacities are ranges `[lower, upper]`. Backend computes:
- Guaranteed minimum flow (worst case)
- Possible maximum flow (best case)  
- Robust bottlenecks (critical in all scenarios)
- Uncertainty bounds

**Example with intervals**:
```json
{
  "capacities": {
    "nodes": {
      "1": [45, 55],
      "11": [18, 28]
    },
    "edges": {
      "[1,9]": [25, 35],
      "[11,19]": [12, 16]
    }
  },
  "options": {
    "data_type": "Interval"
  }
}
```

---

## Response Structure

### Complete Response Schema (Float64 Mode)

```json
{
  "total_max_flow": 52.45,
  "network_utilization": 0.0545,
  "edge_flows": {
    "1": {
      "9": 8.44,
      "11": 33.56
    },
    "11": {
      "19": 14.28,
      "21": 11.28,
      "22": 8.0
    },
    ...
  },
  
  "node_flows": {
    "1": 42.0,
    "2": 42.0,
    "9": 8.44,
    "10": 5.33,
    "11": 33.56,
    ...
  },
  
  "bottlenecks": {
    "bottleneck_type": "node_processing",
    "saturated_nodes": [11],
    "saturated_edges": [],
    "near_saturated_nodes": [19],
    "near_saturated_edges": [],
    "min_cut_nodes": [11, 19],
    "min_cut_edges": [],
    "utilization_by_component": {
      "1": 0.84,
      "2": 0.76,
      "11": 1.0,
      "19": 0.92,
      "[1,9]": 0.28,
      "[11,19]": 1.0,
      ...
    }
  },
  
  "upgrade_analysis": {
    "node_priorities": [
      {
        "node": 11,
        "current_capacity": 20.96,
        "current_utilization": 1.0,
        "current_flow": 20.96,
        "recommended_capacity": 25.0,
        "expected_flow_increase": 4.2,
        "marginal_value": 3.21,
        "priority_score": 0.98,
        "rationale": "Critical saturated node acting as primary bottleneck. Limits all paths through hub 11."
      },
      {
        "node": 19,
        "current_capacity": 32.0,
        "current_utilization": 0.92,
        "current_flow": 29.44,
        "recommended_capacity": 36.0,
        "expected_flow_increase": 1.45,
        "marginal_value": 1.45,
        "priority_score": 0.72,
        "rationale": "Secondary bottleneck. Near-saturated at 92% utilization."
      }
    ],
    
    "edge_priorities": [
      {
        "edge": [11, 19],
        "current_capacity": 14.28,
        "current_utilization": 1.0,
        "current_flow": 14.28,
        "recommended_capacity": 18.5,
        "expected_flow_increase": 2.1,
        "marginal_value": 0.16,
        "priority_score": 0.92,
        "rationale": "Saturated transmission link between hubs 11-19."
      }
    ]
  },
  
  "critical_paths": {
    "paths": [
      {
        "flow": 14.28,
        "path": [1, 11, 19, 27, 25]
      },
      {
        "flow": 11.88,
        "path": [1, 11, 19, 29, 32]
      }
    ],
    
    "single_points_of_failure": [11],
    
    "path_redundancy": {
      "1_25": 1,
      "1_27": 5,
      "1_28": 2,
      "2_29": 3,
      ...
    }
  },
  
  "comparative_analysis": {
    "realistic_max_flow": 52.45,
    "classical_max_flow": 90.0,
    "efficiency_loss": 0.417,
    "efficiency_loss_percent": 41.7,
    "primary_limitation": "node_processing",
    "strategic_recommendation": "Network is primarily limited by processing at hub nodes. Consider upgrading Node 11 capacity from 20.96 to 25+ units, or distributing processing across parallel paths."
  },
  
  "validation": {
    "flow_balance_satisfied": true,
    "capacity_constraints_satisfied": true,
    "optimality_verified": true,
    "flow_conservation_satisfied": true,
    "conservation_violations": [],
    "errors": [],
    "warnings": [
      "Conservation error: 1.76e-15 (numerical precision acceptable)"
    ],
    "checks_passed": 11,
    "total_checks": 14
  },
  
  "metadata": {
    "algorithm_used": "Maximum flow with node constraints",
    "computation_time_ms": 16.0,
    "timestamp": "2025-03-08T14:32:15.123Z",
    "deterministic": true,
    "network_size": {
      "nodes": 32,
      "edges": 66,
      "sources": 2,
      "sinks": 8
    }
  }
}
```

### Response Field Descriptions

#### `total_max_flow` (float)
Maximum throughput the network can achieve given all constraints.

#### `network_utilization` (float, 0.0-1.0)
Average utilization across all components. Calculated as:
```
total_flow / total_capacity
```

#### `edge_flows` (dict)
Nested dictionary of flow on each edge.
```
{
  "from_node": {
    "to_node": flow_value
  }
}
```

Example: `{"1": {"9": 8.44, "11": 33.56}, "11": {"19": 14.28}}`

#### `node_flows` (dict)
Dictionary of total flow through each node (inflow = outflow for intermediate nodes).

#### `bottlenecks.bottleneck_type` (enum)
One of:
- `"transmission"` - Edge capacity is limiting
- `"node_processing"` - Node capacity is limiting
- `"mixed"` - Both edges and nodes are tight
- `"source_limited"` - Insufficient source supply

#### `bottlenecks.saturated_nodes` (array)
List of node IDs operating at 100% capacity (utilization >= 0.95 in interval mode).

#### `bottlenecks.near_saturated_nodes` (array)
List of node IDs at 90-95% capacity (0.90 <= utilization < 0.95).

#### `bottlenecks.min_cut_nodes` (array)
Minimum set of nodes whose removal would disconnect all flow. These are critical dependency nodes.

#### `bottlenecks.utilization_by_component` (dict)
Dictionary mapping each component (node or edge) to its utilization percentage.

Keys format:
- Node: `"11"` (string of node ID)
- Edge: `"[11,19]"` (string representation)

Values: float (0.0 = 0%, 1.0 = 100%)

#### `upgrade_analysis.node_priorities` (array of objects)
Sorted list (highest priority first) of recommended node upgrades.

**Each object contains**:
| Field | Type | Description |
|-------|------|-------------|
| `node` | int | Node ID |
| `current_capacity` | float | Present capacity |
| `current_utilization` | float | 0-1.0 utilization |
| `current_flow` | float | Throughput now |
| `recommended_capacity` | float | Suggested upgrade to |
| `expected_flow_increase` | float | Additional throughput if upgraded |
| `marginal_value` | float | Flow gain per unit capacity increase |
| `priority_score` | float | 0-1.0 urgency (1.0 = critical) |
| `rationale` | string | Explanation text |

#### `upgrade_analysis.edge_priorities` (array of objects)
Sorted list of recommended edge upgrades. Same structure as node_priorities but with:
- `edge`: array `[from, to]` instead of `node`

#### `critical_paths.paths` (array of objects)
Top critical paths carrying significant flow.

Each object:
```json
{
  "flow": 14.28,
  "path": [1, 11, 19, 27, 25]
}
```

#### `critical_paths.single_points_of_failure` (array)
List of node IDs that are SPOFs (all flow must pass through them).

#### `critical_paths.path_redundancy` (dict)
Matrix of alternative paths between each source-sink pair.

Key format: `"source_sink"` (string)  
Value: integer (number of alternative paths available)

Example: `{"1_25": 1, "1_27": 5, "2_29": 3}`

#### `comparative_analysis.efficiency_loss` (float)
Decimal: (classical - realistic) / classical

#### `comparative_analysis.efficiency_loss_percent` (float)
Percentage form: efficiency_loss * 100

#### `comparative_analysis.primary_limitation` (string)
Which type of constraint is dominant: `"transmission"`, `"processing"`, `"mixed"`, or `"source"`

#### `validation.checks_passed` (int)
Number of validation checks that passed (see `total_checks`).

---

## Response Structure (Interval Mode)

When `data_type: "Interval"`, response differs:

```json
{
  "guaranteed_min_flow": 19.4,
  "possible_max_flow": 22.6,
  "expected_flow": 21.0,
  "uncertainty_range": 3.2,
  
  "robust_bottlenecks": [
    {
      "component": "node",
      "id": 11,
      "critical_in_percent": 1.0,
      "rationale": "Bottleneck in 100% of uncertainty scenarios"
    },
    {
      "component": "edge",
      "id": [11, 19],
      "critical_in_percent": 0.85,
      "rationale": "Bottleneck in 85% of uncertainty scenarios"
    }
  ],
  
  "worst_case_scenario": {
    "assumptions": "All source rates and capacities at minimum bounds",
    "max_flow": 19.4,
    "bottleneck_components": [11, 19]
  },
  
  "best_case_scenario": {
    "assumptions": "All source rates and capacities at maximum bounds",
    "max_flow": 22.6,
    "bottleneck_components": [11]
  },
  
  "computation_time_ms": 33.0,
  "timestamp": "2025-03-08T14:32:15.123Z"
}
```

### Interval Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `guaranteed_min_flow` | float | Worst-case throughput (all params at min) |
| `possible_max_flow` | float | Best-case throughput (all params at max) |
| `expected_flow` | float | Average/expected throughput |
| `uncertainty_range` | float | Max - Min (range of uncertainty) |
| `robust_bottlenecks` | array | Components critical in ALL scenarios |
| `worst_case_scenario` | object | Description of worst-case conditions |
| `best_case_scenario` | object | Description of best-case conditions |

---

## Data Types Reference

### Numeric Types
All flows and capacities are **float** (floating point):
- Example: `14.28`, `52.45`, `3.21`
- Range: Typically 0 to 10,000
- Precision: 2 decimal places sufficient for display

### Node/Edge Identifiers
- **Node IDs**: Integers (1-32 in water network)
- **Edge notation**: Array `[from_id, to_id]` or string `"[from_id,to_id]"`
- Example: `[1, 11]` or `"[1,11]"`

### Metric Types
- **Utilization**: Float 0.0 to 1.0 (display as percentage × 100)
- **Priority Score**: Float 0.0 to 1.0 (1.0 = highest priority)
- **Marginal Value**: Float (flow increase per unit capacity)
- **Percent**: Float 0.0 to 1.0 or 0.0 to 100.0 (check context)

### Enum Types

**bottleneck_type**:
```
"transmission" | "node_processing" | "mixed" | "source_limited"
```

**data_type** (request):
```
"Float64" | "Interval"
```

**component type** (robust bottlenecks):
```
"node" | "edge"
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Cause |
|------|---------|-------|
| 200 | Success | Analysis completed successfully |
| 400 | Bad Request | Malformed JSON or invalid input |
| 422 | Unprocessable Entity | Valid JSON but network is invalid |
| 500 | Server Error | Backend computation failed |

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_NETWORK",
    "message": "Network contains no edges between sources and sinks",
    "details": {
      "sources": [1, 2],
      "sinks": [25, 26],
      "reachable_sinks": []
    }
  }
}
```

### Common Error Scenarios

**1. Invalid Network Topology**
```json
{
  "error": {
    "code": "DISCONNECTED_NETWORK",
    "message": "Some sink nodes are unreachable from sources",
    "details": {
      "unreachable_sinks": [30, 31]
    }
  }
}
```

**2. Capacity Mismatch**
```json
{
  "error": {
    "code": "CAPACITY_MISMATCH",
    "message": "Edge [1,9] in capacities but not in network edges",
    "details": {
      "extra_edges": [[1, 9]],
      "missing_capacities": [[2, 10]]
    }
  }
}
```

**3. Interval Data Error**
```json
{
  "error": {
    "code": "INVALID_INTERVAL",
    "message": "Interval lower bound > upper bound for node 11",
    "details": {
      "node": 11,
      "lower": 25,
      "upper": 20
    }
  }
}
```

---

## Example Calls

### Example 1: Basic Deterministic Request

**Request**:
```bash
curl -X POST http://localhost:8000/capacity-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "network": {
      "nodes": [1, 2, 9, 10, 11, 19, 25, 26, 27],
      "edges": [
        [1, 9], [1, 11], [2, 10], [2, 11],
        [9, 19], [10, 19], [11, 19], [11, 21],
        [19, 25], [19, 26], [19, 27]
      ],
      "sources": [1, 2],
      "sinks": [25, 26, 27]
    },
    "capacities": {
      "nodes": {
        "1": 100, "2": 100, "9": 40, "10": 40, "11": 20.96,
        "19": 32, "25": 200, "26": 200, "27": 200
      },
      "edges": {
        "[1,9]": 30, "[1,11]": 25, "[2,10]": 30, "[2,11]": 25,
        "[9,19]": 15, "[10,19]": 15, "[11,19]": 14.28,
        "[19,25]": 12, "[19,26]": 12, "[19,27]": 12
      }
    },
    "source_rates": {
      "1": 42,
      "2": 42
    },
    "options": {
      "data_type": "Float64"
    }
  }'
```

**Response (excerpt)**:
```json
{
  "total_max_flow": 52.45,
  "network_utilization": 0.0545,
  "bottlenecks": {
    "bottleneck_type": "node_processing",
    "saturated_nodes": [11],
    "saturated_edges": []
  },
  "metadata": {
    "computation_time_ms": 16.0
  }
}
```

### Example 2: Interval-Based Uncertainty

**Request**:
```bash
curl -X POST http://localhost:8000/capacity-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "network": {
      "nodes": [1, 2, 9, 10, 11, 19, 25, 26, 27],
      "edges": [[1, 9], [1, 11], [2, 10], [2, 11], 
                [9, 19], [10, 19], [11, 19], [19, 25], 
                [19, 26], [19, 27]],
      "sources": [1, 2],
      "sinks": [25, 26, 27]
    },
    "capacities": {
      "nodes": {
        "1": [90, 110], "2": [90, 110], "11": [18, 28],
        "19": [28, 36], "25": [200, 200]
      },
      "edges": {
        "[1,11]": [23, 27], "[2,11]": [23, 27],
        "[11,19]": [12, 16], "[19,25]": [10, 14]
      }
    },
    "source_rates": {
      "1": [7, 10.5],
      "2": [7, 10.5]
    },
    "options": {
      "data_type": "Interval"
    }
  }'
```

**Response (excerpt)**:
```json
{
  "guaranteed_min_flow": 19.4,
  "possible_max_flow": 22.6,
  "expected_flow": 21.0,
  "robust_bottlenecks": [
    {
      "component": "node",
      "id": 11,
      "critical_in_percent": 1.0
    }
  ],
  "computation_time_ms": 33.0
}
```

### Example 3: Python Integration

```python
import requests
import json

# Prepare request
url = "http://localhost:8000/capacity-analysis"
payload = {
    "network": {
        "nodes": list(range(1, 33)),
        "edges": [[1, 9], [1, 11], ...],
        "sources": [1, 2],
        "sinks": [25, 26, 27, 28, 29, 30, 31, 32]
    },
    "capacities": {
        "nodes": {"1": 100, "11": 20.96, ...},
        "edges": {"[1,9]": 30, "[11,19]": 14.28, ...}
    },
    "source_rates": {"1": 42, "2": 42},
    "options": {"data_type": "Float64"}
}

# Make request
response = requests.post(url, json=payload, timeout=30)

# Check response
if response.status_code == 200:
    result = response.json()
    max_flow = result["total_max_flow"]
    bottleneck = result["bottlenecks"]["bottleneck_type"]
    print(f"Max Flow: {max_flow} units")
    print(f"Bottleneck Type: {bottleneck}")
else:
    print(f"Error: {response.status_code}")
    print(response.json())
```

### Example 4: JavaScript/React Integration

```javascript
async function analyzeCapacity(networkConfig) {
  const payload = {
    network: {
      nodes: [...],
      edges: [...],
      sources: [1, 2],
      sinks: [25, 26, 27, 28, 29, 30, 31, 32]
    },
    capacities: {
      nodes: {...},
      edges: {...}
    },
    source_rates: {1: 42, 2: 42},
    options: {
      data_type: "Float64",
      include_upgrade_analysis: true,
      include_critical_paths: true
    }
  };

  try {
    const response = await fetch('http://localhost:8000/capacity-analysis', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        data: result,
        maxFlow: result.total_max_flow,
        bottleneckType: result.bottlenecks.bottleneck_type
      };
    } else {
      return {
        success: false,
        error: await response.json()
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Usage
const result = await analyzeCapacity(networkConfig);
if (result.success) {
  console.log(`Max Flow: ${result.maxFlow} units`);
  console.log(`Bottleneck: ${result.bottleneckType}`);
} else {
  console.error(result.error);
}
```

---

## Integration Guide

### Step 1: Get Network Configuration

Network definition (nodes, edges, sources, sinks) can come from:
- JSON file (e.g., `water-capacities.json`)
- Database query
- API call to separate service
- User interface input

**Example**: Load from JSON file
```python
with open('dag_ntwrk_files/water/Edge\ Bottleneck\ Demo/water-capacities.json') as f:
    network_config = json.load(f)
    
network_data = {
    "nodes": network_config["nodes"],
    "edges": network_config["edges"],
    "sources": network_config["sources"],
    "sinks": network_config["sinks"]
}
```

### Step 2: Prepare Capacity Data

Capacities can be:
- Hardcoded in scenario files
- Calculated based on system specs
- Retrieved from database

**Example**: Extract from scenario JSON
```python
capacities_data = {
    "nodes": network_config["node_capacities"],
    "edges": network_config["edge_capacities"]
}

source_rates = {
    str(node_id): rate 
    for node_id, rate in network_config["source_rates"].items()
}
```

### Step 3: Build Request

```python
request_payload = {
    "network": network_data,
    "capacities": capacities_data,
    "source_rates": source_rates,
    "options": {
        "data_type": "Float64",  # or "Interval"
        "include_upgrade_analysis": True,
        "include_critical_paths": True,
        "include_comparative_analysis": True,
        "include_validation": True
    }
}
```

### Step 4: Send Request

```python
import requests

response = requests.post(
    "http://localhost:8000/capacity-analysis",
    json=request_payload,
    timeout=60  # Interval mode may take 30-40ms
)

if response.status_code == 200:
    result = response.json()
else:
    error = response.json()
    # Handle error
```

### Step 5: Parse Response

```python
# Extract key metrics
max_flow = result["total_max_flow"]
utilization = result["network_utilization"]
bottleneck_type = result["bottlenecks"]["bottleneck_type"]

# Get bottleneck components
saturated_nodes = result["bottlenecks"]["saturated_nodes"]
near_sat_nodes = result["bottlenecks"]["near_saturated_nodes"]

# Get recommendations
node_upgrades = result["upgrade_analysis"]["node_priorities"]
edge_upgrades = result["upgrade_analysis"]["edge_priorities"]

# Get critical analysis
critical_paths = result["critical_paths"]["paths"]
spofs = result["critical_paths"]["single_points_of_failure"]
```

### Step 6: Display Results

Use the [UI_IMPLEMENTATION_GUIDE.md](UI_IMPLEMENTATION_GUIDE.md) to map these fields to UI components:

```python
def display_results(result):
    """Display capacity analysis results"""
    
    # Show main metric (use FlowOverviewCard component)
    print(f"🔹 Max Flow: {result['total_max_flow']} units")
    
    # Show bottleneck (use BottleneckIndicator component)
    print(f"🔹 Bottleneck: {result['bottlenecks']['bottleneck_type']}")
    
    # Show saturated components (use SaturatedComponentsList)
    if result['bottlenecks']['saturated_nodes']:
        for node in result['bottlenecks']['saturated_nodes']:
            print(f"  🔴 Node {node} at 100% capacity")
    
    # Show upgrades (use UpgradePrioritiesTable)
    for upgrade in result['upgrade_analysis']['node_priorities'][:3]:
        print(f"  💡 Upgrade {upgrade['node']}: +{upgrade['expected_flow_increase']} units")
    
    # Show SPOFs (use SPOFAlert)
    if result['critical_paths']['single_points_of_failure']:
        print(f"  ⚠️ Critical SPOF: {result['critical_paths']['single_points_of_failure']}")
```

---

## Performance Notes

### Computation Times

| Scenario | Data Type | Time (ms) | Notes |
|----------|-----------|-----------|-------|
| Small (10 nodes) | Float64 | 5-10 | Instant |
| Medium (20 nodes) | Float64 | 10-20 | Fast |
| Large (32-node water) | Float64 | 12-16 | Normal |
| Same network | Interval | 30-40 | 2-3x slower due to interval arithmetic |

### Scaling

- Deterministic (Float64): O(n² log n) where n = nodes
- Interval: O(2 × Float64) with worst/best case computation

### Optimization Tips

1. **Cache responses**: Same scenario input → same output
2. **Parallel requests**: Process multiple scenarios concurrently
3. **Lazy load**: Don't request all components on first call
4. **Batch analysis**: If analyzing 100+ scenarios, consider background job

---

## Deployment Checklist

- [ ] Backend server running (`julia backend_server.jl`)
- [ ] Port 8000 (or configured port) accessible from frontend
- [ ] Network configuration files in correct location
- [ ] Capacity data loaded into memory
- [ ] CORS configured (if frontend is different origin)
- [ ] Logging enabled for debugging
- [ ] Error handling for network timeouts
- [ ] Request validation on frontend
- [ ] Response caching implemented
- [ ] Load testing completed (max concurrent requests)

---

## Troubleshooting

### Connection Refused
**Problem**: `Connection refused: localhost:8000`  
**Solution**: 
- Check backend server is running
- Verify port 8000 is opened/forwarded
- Check for port conflicts: `netstat -an | grep 8000`

### Timeout (30+ seconds)
**Problem**: Request hangs or returns after 30s  
**Solution**:
- Increase timeout (default may be 30s)
- Check backend logs for computation bottleneck
- Try with smaller network first

### Malformed Response
**Problem**: Response is not valid JSON  
**Solution**:
- Check backend server logs
- Verify request JSON is valid
- Try simple test request (Example 1)

### NaN or Inf in Response
**Problem**: Results contain `NaN` or `Infinity`  
**Solution**:
- Check network topology (any isolated nodes?)
- Verify capacity values (no zeros?)
- Ensure all path flows conserved (validation should catch)

---

## Summary

This API documentation provides:
- ✅ Complete request/response schema
- ✅ Field descriptions and types
- ✅ Error handling guidance
- ✅ Real code examples (Python, JavaScript)
- ✅ Integration step-by-step guide
- ✅ Performance characteristics
- ✅ Troubleshooting reference

Use alongside **UI_IMPLEMENTATION_GUIDE.md** to integrate backend with frontend UI components.

