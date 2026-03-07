# Capacity Analysis Module - Available Inputs

## Input Structure to Backend

The backend (`backend_server.jl`) reads scenario JSON files and expects:

```json
{
  "capacities": {
    "nodes": {
      "1": 20.0,
      "2": 28.0,
      ...
    },
    "edges": {
      "(1,9)": 18.0,
      "(1,11)": 16.0,
      ...
    },
    "source_rates": {
      "0": 10.0,
      "1": 10.0,
      "2": 0,
      ...
    }
  }
}
```

---

## Capacity Module APIs (Julia)

### **Main API (Deterministic Flow - Float64)**

```julia
result = analyze_capacity(
    topology;
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64},
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)
```

**Returns**: `CapacityAnalysisResult` containing:
- `node_max_flows` - maximum sustainable flow to each sink/target node
- `bottlenecks` - edges/nodes limiting flow
- `critical_paths` - actual paths selected by algorithm
- `total_max_flow` - aggregate network throughput
- `network_utilization` - as percentage/fraction

---

### **For Uncertainty (Interval Types)**

```julia
result = analyze_capacity_uncertain(
    topology;
    node_capacities::Dict{Int64, Interval{Float64}},
    edge_capacities::Dict{Tuple{Int64,Int64}, Interval{Float64}},
    source_rates::Dict{Int64, Interval{Float64}},
    target_nodes::Set{Int64},
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)
```

**Returns**: `IntervalCapacityResult` containing:
- **Worst-case scenario** - minimum guaranteed flow (lower interval bounds)
- **Best-case scenario** - maximum possible flow (upper interval bounds)
- Both scenarios analyzed separately

---

## Key Input Components

### 1. **Node Capacities** (`Dict{Int64, Float64}`)
- Processing throughput at each node (units/time)
- 32 total nodes in water network (nodes 0-31, indexed 1-32)
- Varies by node type: source (18-22), hub (26-32), process (20-24), discharge (18-21), sink (23-27)
- Base values used; can be overridden per scenario

### 2. **Edge Capacities** (`Dict{Tuple{Int64,Int64}, Float64}`)
- Transmission capacity on each directed edge (units/time)
- 66 total edges in water network
- Format: `(source_node, destination_node) => capacity`
- Example: `(1, 9) => 18.0`

### 3. **Source Rates** (`Dict{Int64, Float64}`)
- Input supply rate from each source node (units/time)
- Only nodes 0 and 1 provide non-zero supply in water network
- Must be positive; zero rates excluded by backend
- Sum of both sources determines total demand entered into network

### 4. **Target Nodes** (`Set{Int64}`)
- Sink nodes where flow is measured
- In water network: nodes 25-32 (8 sink nodes)
- Backend automatically identifies these from network topology

---

## Scenario Generation Strategy

To **eliminate 0.0 utilization values**, adjust these knobs:

### Strategy 1: Equal Source Loading
```
sourceRateBase: { 0: 10.0, 1: 10.0 }  // Both sources contribute equally
→ Effect: Parallel paths from both sources forced active
```

### Strategy 2: Hub Capacity Constraint (Bottleneck)
```
nodeCapBase: { ... }
hubNodeCapOverride: { 11: 12, 13: 12, 16: 12 }  // Reduce from base 26
→ Effect: Reroute through alternative hubs; unused edges in normal routing now active
```

### Strategy 3: Unequal Sink Demand
```
sinkCapOverride: { 25: 12, 26: 12, ..., 29: 20, 30: 20, ... }
→ Effect: Different edges prioritized for different sink destinations
```

### Strategy 4: Interval-Based Worst Case
```
sourceRateBase: { 0: [7, 11], 1: [7, 11] }  // Both sources with uncertainty
→ Effect: Worst-case scenario (both at minimum) forces ALL paths active;
           Best-case scenario (both maximum) allows selective routing
```

---

## Current Scenario Design

### Normal Operations (Float64)
- Source rates: 11.53 + 14.65 = 26.18 total
- But routed through **minimal optimal subset** of 66 edges
- Result: Many edges show 0.0 utilization

### New Scenarios (v2, designed for NO 0.0s)
- **Elevated Summer Demand**: Equal 10+10 loading → multi-path
- **Hub Resilience Test**: Bottleneck primary hubs → alt routing
- **Asymmetric Load**: 80/20 sink split → diverse paths
- **Dual-Source Balancing**: Interval [7,11]×[7,11] → worst case all paths
- **Partial Degradation**: Hub constraint + full demand → forced rerouting

---

## Implementation Notes

1. **JSON vs Julia**: JavaScript generates scenario JSON files; backend parses and feeds to Julia module
2. **Validation**: Backend validates flow conservation, capacity constraints, max-flow=min-cut
3. **Backend Processing**: 
   - Reads scenario JSON (capacity data)
   - Constructs CapacityParameters dict structure
   - Calls `analyze_capacity()` or `analyze_capacity_uncertain()`
   - Converts results back to JSON for frontend
4. **No 0.0 Problem**: Mathematically sound optimal routing; operationally unrealistic
   - Scenarios force diverse routing through demand design, not algorithm changes
