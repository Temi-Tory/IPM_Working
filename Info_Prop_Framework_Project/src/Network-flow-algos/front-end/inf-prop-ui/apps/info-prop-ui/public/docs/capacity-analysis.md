# Capacity & Flow Analysis

## Purpose

Capacity Analysis computes the **maximum flow** through a network given node processing capacities, edge transmission capacities, and source input rates. It identifies bottlenecks, quantifies edge utilisation, and provides upgrade prioritisation through comparative analysis.

---

## Required Inputs

A capacities JSON file containing:

| Section | Description |
|---------|------------|
| **Node capacities** | Maximum throughput each node can process |
| **Edge capacities** | Maximum flow each connection can carry |
| **Source rates** | Input rate at each source node (> 0 for active sources) |

---

## Reading the Results

### Network-Level Metrics

| Metric | Description |
|--------|------------|
| **Network Utilisation** | `total_sink_output / total_source_input`. Indicates what fraction of input reaches the outputs. |
| **Total Source Input** | Sum of all source rates |
| **Total Target Output** | Sum of flow arriving at all sink nodes |
| **Bottleneck Count** | Number of elements operating at full capacity |

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

The backend supports several capacity analysis modes:

| Mode | Description |
|------|------------|
| **Maximum Flow** | Standard forward-pass analysis (default) |
| **Bottleneck Analysis** | Identifies the single limiting factor per path |
| **Widest Path** | Finds the path with the highest minimum capacity |
| **Multi-Commodity** | Analyses multiple flow types through shared infrastructure |
| **Uncertainty-Aware** | Monte Carlo with uncertain capacity parameters |

---

## Multi-Scenario Comparison

Upload multiple capacity scenarios (e.g. "Normal Load", "High Load", "Peak Demand") to compare:

- How utilisation shifts under different loads
- Which bottlenecks appear only under stress
- How much headroom exists in each scenario
- Which upgrades address the widest range of scenarios
