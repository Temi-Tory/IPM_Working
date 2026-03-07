# Capacity & Flow Analysis

## Purpose

Capacity Analysis computes the **maximum flow** through a network given node processing capacities, edge transmission capacities, and source input rates. It identifies bottlenecks, quantifies edge utilisation, provides upgrade prioritisation, and includes built-in mathematical validation.

---

## Required Inputs

A capacities JSON file containing:

| Section | Description |
|---------|------------|
| **Node capacities** | Maximum throughput each node can process |
| **Edge capacities** | Maximum flow each connection can carry |
| **Source rates** | Input rate at each source node (> 0 for active sources) |

Optional request fields:

| Field | Description |
|------|-------------|
| `uncertaintyMode` | `"deterministic"` (default) or `"interval"` |
| `options` | Advanced backend options (algorithm, critical path enumeration, upgrade priorities, validation tolerance, etc.) |

`uncertaintyMode` can also be inferred from the capacities file (`data_type: "Interval"`).

---

## Reading the Results

### Network-Level Metrics

| Metric | Description |
|--------|------------|
| **Total Max Flow** | Maximum feasible throughput to sink nodes |
| **Target Flows** | Throughput reaching each sink node |
| **Network Utilisation** | Aggregate utilisation metric over finite node/edge capacities |
| **Algorithm Used** | Capacity solver selected in options |
| **Validation** | Flow conservation, capacity constraints, flow balance, and max-flow/min-cut consistency |

### Node Results

| Column | Description |
|--------|------------|
| **Capacity** | Maximum throughput (input data) |
| **Max Flow** | Actual computed flow through this node |
| **Utilisation** | Flow / Capacity (0 to 1) |
| **Spare Capacity** | Capacity - Flow |
| **Is Bottleneck** | True if utilisation >= ~1.0 |

### Edge Results

| Column | Description |
|--------|------------|
| **Capacity** | Maximum flow the edge can carry |
| **Flow** | Computed flow through this edge |
| **Utilisation** | Flow / Capacity |
| **Spare** | Remaining unused capacity |

### Utilisation Colour Coding

| Range | Status | Interpretation |
|-------|--------|---------------|
| < 40% | Low (green) | Significant spare capacity |
| 40-70% | Moderate (yellow) | Normal operating range |
| 70-90% | High (orange) | Approaching capacity limit |
| > 90% | Critical (red) | At or near bottleneck |

---

## Comparative Analysis

The comparative analysis provides strategic insights beyond raw flow numbers:

### Capacity Gaps

Per-node difference between incoming flow demand and processing capacity. Negative gaps indicate bottlenecks.

### Infrastructure vs Processing Bottlenecks

- **Infrastructure bottleneck**: An edge at capacity (the physical link is the constraint)
- **Processing bottleneck**: A node at capacity (the node's processing ability is the constraint)

### Upgrade Priorities

A ranked list of elements whose capacity upgrade would produce the largest improvement in total network throughput:

| Priority | Element | Estimated Impact |
|----------|---------|-----------------|
| 1 | Edge (3,6) | +25 units throughput |
| 2 | Node 6 | +18 units throughput |

### Efficiency Metrics

- **Overall efficiency**: Ratio of actual to theoretical maximum throughput
- **Gap ratio**: 1 - efficiency (proportion lost to bottlenecks)

---

## Analysis Variants

The backend currently supports:

| Mode | Description |
|------|------------|
| **Deterministic (exact)** | Float64 capacities and source rates with exact max-flow + bottleneck/comparative analyses |
| **Interval (exact bounds)** | Interval capacities and source rates, returning guaranteed min flow and possible max flow |

In interval mode, outputs include:

- `guaranteed_min_flow`
- `possible_max_flow`
- `expected_flow`
- `uncertainty_range`
- `robust_bottlenecks` and `potential_bottlenecks`
- `worst_case_scenario` and `best_case_scenario` (each with validation)

---

## Multi-Scenario Comparison

Upload multiple capacity scenarios (e.g. "Normal Load", "High Load", "Peak Demand") to compare:

- How utilisation shifts under different loads
- Which bottlenecks appear only under stress
- How much headroom exists in each scenario
- Which upgrades address the widest range of scenarios
