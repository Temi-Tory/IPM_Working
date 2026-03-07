# Scenario Redesign: From Optimal-Path Minimization to Diverse Routing

## Problem Identified
**Why so many 0.0 values?**
- Current scenarios have low source demand (11.5-14.6 units) relative to network capacity
- Ford-Fulkerson algorithm finds minimal optimal flow using only necessary edges
- Unused edges show 0.0 because mathematically correct optimal solution doesn't need them
- This is mathematically sound but operationally unrealistic for water networks

## Design Strategy for New Scenarios
**Goal:** Create scenarios where diverse routing is operationally required, not just mathematically possible

### Key Insights:
1. **Demand-Capacity Ratio**: When demand approaches or exceeds single-path capacity → parallel paths activate
2. **Source Distribution**: Equal demand from multiple sources forces use of different network paths
3. **Capacity Constraints**: Reducing capacity on "preferred" nodes forces alternative routing
4. **Multi-Sink Loading**: Spreading demand across multiple sinks activates distributed paths

## New Scenario Archetypes

### Scenario 1: **Elevated Summer Demand** (Float64)
- **Purpose**: Moderate-high demand forcing multi-path use
- **Source Rates**: ~18-22 total (vs 26 in Normal Ops, but both sources contributing equally)
- **Key Feature**: Both sources loaded equally → paths from both source 0 and 1 activate
- **Result**: More edges active than Normal Operations (which may favor single source path)

### Scenario 2: **Hub Resilience Test** (Float64)  
- **Purpose**: Simulate maintenance/partial outage of intermediate hub
- **Design**: Reduce capacity on selected intermediate nodes (e.g., nodes 11, 13, 16)
- **Key Feature**: Forced rerouting through normally under-utilized paths
- **Result**: Edges connected to alternative hubs show high utilization; normally zero-flow edges activated

### Scenario 3: **Asymmetric Load Distribution** (Float64)
- **Purpose**: Unequal demand at sink nodes (realistic operational pattern)
- **Design**: High demand at sinks 29-32, lower at 25-28
- **Key Feature**: Flows concentrate on paths leading to high-demand sinks, but all sinks still receive flow
- **Result**: Differentiated utilization; more edges active than uniform demand scenario

### Scenario 4: **Dual-Source Balancing** (Interval)
- **Purpose**: Both sources must deliver within uncertainty bounds
- **Design**: Source rates are intervals with equal lower/upper bounds from both sources
- **Key Feature**: Worst case = both sources reduce simultaneously; best case = both contribute fully
- **Result**: Worst-case scenario forces ALL paths; best-case allows selective routing
- **Uncertainty**: Sensor/supply uncertainty creates interval bounds

### Scenario 5: **Partial Degradation with Full Load** (Interval)
- **Purpose**: Some nodes degraded, but full demand must still be met
- **Design**: Selected node capacities reduced (e.g., process nodes 19-24 reduced 20-30%)
- **Key Feature**: Bottleneck forcing rerouting; demand unchanged
- **Result**: Flow pushed through alternative paths; many normally-zero edges activated

---

## Implementation Notes
- Maintain 66-edge structure (network topology unchanged)
- All scenarios assume 8 source variables (nodes 1-8) with only nodes 0,1 providing demand
- Intervals should reflect operational uncertainty, not just degradation bounds
- Capacity values should remain in physically realistic range (based on Normal Ops baseline)
