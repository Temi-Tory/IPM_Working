# UI Implementation Guide: Backend Response → UI Components

Complete documentation for displaying capacity analysis results to users.

---

## Table of Contents
1. [Data Mapping Reference](#data-mapping-reference)
2. [UI Component Library](#ui-component-library)
3. [User Workflows](#user-workflows)
4. [Implementation Checklist](#implementation-checklist)
5. [Example Scenarios](#example-scenarios)
6. [Advanced Features](#advanced-features)

---

## Data Mapping Reference

### Overview Section (Top Dashboard)

#### 1. Total Max Flow
**Backend Field**: `response.total_max_flow` (float64) or `response.guaranteed_min_flow` / `response.possible_max_flow` (interval)

**What it means**: Maximum throughput the network can support given all constraints

**UI Display**:
```
┌─────────────────────────────────────┐
│  NETWORK THROUGHPUT                 │
│  ─────────────────────────────────── │
│                                     │
│      MAX FLOW: 52.45 units          │
│                                     │
│  Sources: 84.0 units available      │
│  Limitation: 38% constrained        │
│                                     │
└─────────────────────────────────────┘
```

**Calculation**:
- If deterministic: Show single value
- If interval: Show range with range bar
  - `Worst Case: 19.4 units`
  - `Best Case: 22.6 units`
  - `Expected: 21.0 units`

**Formula for "% Constrained"**:
```
percent_constrained = (1 - max_flow / sum_source_rates) × 100
```

**Color coding**:
- Green (>90% of sources): ✅ "Network has capacity"
- Yellow (70-90%): ⚠️ "Moderate constraints"
- Red (<70%): 🔴 "Severe bottleneck"

---

#### 2. Network Utilization
**Backend Field**: `response.network_utilization` (0.0-1.0)

**What it means**: Average utilization across ALL network components (nodes + edges)

**UI Display**:
```
┌─────────────────────────────────────┐
│  NETWORK UTILIZATION                │
│  ─────────────────────────────────── │
│                                     │
│  [━━━━━━━━━━░░░░░░░░░░░░░░░░░░] 5.45% │
│                                     │
│  Status: 🟢 GREEN (Low congestion)  │
│                                     │
└─────────────────────────────────────┘
```

**Interpretation guideline**:
- `0-20%`: 🟢 GREEN - "Ample capacity available"
- `20-50%`: 🟡 YELLOW - "Moderate utilization"
- `50-80%`: 🟠 ORANGE - "High utilization, approaching limits"
- `80-95%`: 🔴 RED - "Critical utilization"
- `95-100%`: 🔴 DARK RED - "SATURATED NETWORK"

**Formula**:
```
network_utilization = (total_flow / total_capacity) × 100
where:
  total_flow = sum of all edge flows
  total_capacity = sum of all edge + node capacities
```

---

#### 3. Bottleneck Type
**Backend Field**: `response.bottlenecks.bottleneck_type` (enum)

**What it means**: What kind of constraint is limiting the network

**Possible values** and UI representation:

| Type | Meaning | Icon | Color | Example |
|------|---------|------|-------|---------|
| `transmission` | Edge capacity limited | 📡 | 🔵 Blue | Bandwidth oversubscribed |
| `node_processing` | Node capacity limited | ⚙️ | 🟣 Purple | Hub/processor bottleneck |
| `mixed` | Both edges AND nodes tight | ⚔️ | 🟠 Orange | System-wide strain |
| `source_limited` | Sources insufficient | 📤 | 🟢 Green | Need more inflow |

**UI Display**:
```
┌─────────────────────────────────────┐
│  PRIMARY BOTTLENECK                 │
│  ─────────────────────────────────── │
│                                     │
│  ⚙️  NODE PROCESSING BOTTLENECK     │
│  ─────────────────────────────────── │
│                                     │
│  Primary Constraint: Node 11        │
│  Utilization: 100%                  │
│  Impact: Limits flow by 31.55 units │
│                                     │
└─────────────────────────────────────┘
```

**Strategic recommendation text** (populate from `response.comparative_analysis.strategic_recommendation`):
```
Show: "Network limited by processing at hub nodes. 
Recommendation: Upgrade node 11 capacity or distribute 
processing across parallel paths."
```

---

#### 4. Computation Time
**Backend Field**: `response.computation_time_ms` (float)

**What it means**: How long the analysis took (performance indicator)

**UI Display**:
```
⏱️ Analysis computed in 12.00 ms
```

**Interpretation**:
- `<10ms`: ✅ Fast (deterministic)
- `10-20ms`: ✅ Normal
- `20-33ms`: ⚠️ Slow (interval uncertainty)
- `>33ms`: 🔴 Very slow (investigate)

---

### Bottleneck Analysis Section

#### 5. Saturated Nodes
**Backend Field**: `response.bottlenecks.saturated_nodes` (list of node IDs)

**What it means**: Nodes operating at 100% capacity (can't process more)

**UI Display**:
```
┌─────────────────────────────────────┐
│  CRITICAL NODES (100% Utilization)  │
│  ─────────────────────────────────── │
│                                     │
│  🔴 Node 11 [████████████████] 100% │
│     Current: 20.96/20.96 units      │
│     Type: Hub (5 inputs, 3 outputs) │
│     Redundancy: None (SPOF)         │
│                                     │
└─────────────────────────────────────┘
```

**Actions**:
- Highlight these nodes in RED on network graph
- Mark as "Single Point of Failure" if degree = 1 or all paths go through
- Show upgrade recommendation

---

#### 6. Near-Saturated Nodes
**Backend Field**: `response.bottlenecks.near_saturated_nodes` (list of node IDs)

**What it means**: Nodes at 90-99% capacity (warning zone)

**UI Display**:
```
┌─────────────────────────────────────┐
│  WARNING NODES (90-99% Util)        │
│  ─────────────────────────────────── │
│                                     │
│  🟠 Node 19 [███████████░] 92%      │
│     Current: 29.44/32.00 units      │
│     Headroom: 2.56 units remaining  │
│                                     │
│  🟡 Node 21 [██████████░░] 88%      │
│     Current: 21.68/24.60 units      │
│                                     │
└─────────────────────────────────────┘
```

**Color**: 🟠 Orange (alert but not critical)

---

#### 7. Saturated Edges
**Backend Field**: `response.bottlenecks.saturated_edges` (list of edge tuples)

**What it means**: Transmission links at 100% capacity

**UI Display**:
```
┌─────────────────────────────────────┐
│  SATURATED TRANSMISSION LINKS       │
│  ─────────────────────────────────── │
│                                     │
│  🔴 (11,19): 14.28 units           │
│     Flow: 14.28/14.28 units [100%] │
│     Bottleneck: Edge capacity      │
│                                     │
│  🔴 (19,27): 12.23 units           │
│     Flow: 12.23/12.23 units [100%] │
│                                     │
│  Count: 8 edges at capacity         │
│                                     │
└─────────────────────────────────────┘
```

**Graph Visualization**:
- Draw saturated edges in BRIGHT RED with 3px thickness
- Add animated flow indicators (moving dots) for saturated edges
- Show edge label on hover: "(11,19) 14.28/14.28 at 100%"

---

#### 8. Utilization by Component
**Backend Field**: `response.bottlenecks.utilization_by_component` (dict)

**What it means**: Individual utilization % for each node and edge

**UI Display Option A - Table**:
```
┌──────────┬────────────┬───────────┬──────────┐
│Component │ Current    │ Capacity  │ Usage %  │
├──────────┼────────────┼───────────┼──────────┤
│ Node 11  │ 20.96      │ 20.96     │ 100% 🔴  │
│ Node 19  │ 29.44      │ 32.00     │ 92%  🟠  │
│ (11,19)  │ 14.28      │ 14.28     │ 100% 🔴  │
│ (19,27)  │ 12.23      │ 12.23     │ 100% 🔴  │
│ (9,19)   │ 8.44       │ 13.14     │ 64%  🟡  │
│...       │...         │...        │...      │
└──────────┴────────────┴───────────┴──────────┘
```

**UI Display Option B - Heatmap**:
```
Nodes:          Edges:
1  2  3  4      (1,9)  (1,11) (2,10)
🟢 🟢 🟢 🟢      🟢     🟢     🟢

11 12 13 14     (11,19) (11,21) (11,22)
🔴 🟡 🟡 🟡      🔴      🟠      🟠

19 20 21 22     (19,27) (19,29) (19,30)
🔴 🟡 🟠 🟠      🔴      🔴      🟠
```

**Color scheme**:
- 🟢 Green: 0-70% utilization
- 🟡 Yellow: 70-85% utilization
- 🟠 Orange: 85-95% utilization
- 🔴 Red: 95-100% utilization

---

#### 9. Min-Cut Edges/Nodes
**Backend Field**: `response.bottlenecks.min_cut_edges`, `response.bottlenecks.min_cut_nodes`

**What it means**: Minimum set of components whose removal disconnects all flow

**UI Display**:
```
┌─────────────────────────────────────┐
│  CRITICAL DEPENDENCY SET (Min-Cut)  │
│  ─────────────────────────────────── │
│                                     │
│  If ANY of these are removed:       │
│  Network is completely disconnected │
│                                     │
│  ▶ Node 11 (capacity limit: 20.96)  │
│  ▶ Node 19 (capacity limit: 32.00)  │
│                                     │
│  Max throughput = min capacity      │
│  = 20.96 units (Node 11)            │
│                                     │
└─────────────────────────────────────┘
```

**Highlight on graph**: Draw min-cut components with bold border and glow effect

---

### Upgrade Analysis Section

#### 10. Edge Priorities
**Backend Field**: `response.upgrade_analysis.edge_priorities` (sorted array)

**Structure**:
```json
{
  "edge": [11, 19],
  "current_capacity": 14.28,
  "current_utilization": 1.0,
  "current_flow": 14.28,
  "recommended_capacity": 18.5,
  "expected_flow_increase": 2.3,
  "marginal_value": 0.16,
  "priority_score": 0.92,
  "rationale": "Critical saturated edge..."
}
```

**UI Display - Priority Table**:
```
┌────────┬──────────┬───────┬──────────┬─────────────┐
│ Rank   │ Edge     │ MV    │ Priority │ Impact      │
├────────┼──────────┼───────┼──────────┼─────────────┤
│ 1 🔴   │ (19,27)  │ 0.21  │ 0.95     │ +2.1 units  │
│ 2 🔴   │ (11,19)  │ 0.19  │ 0.92     │ +1.9 units  │
│ 3 🟠   │ (19,29)  │ 0.18  │ 0.88     │ +1.8 units  │
│ 4 🟡   │ (21,27)  │ 0.08  │ 0.45     │ +0.8 units  │
└────────┴──────────┴───────┴──────────┴─────────────┘
```

**Key Metrics Explained**:

| Field | Meaning | Display |
|-------|---------|---------|
| `marginal_value` | Flow increase per unit upgrade | "Each +1 to capacity = +0.21 units flow" |
| `priority_score` | 0.0-1.0 urgency rank | Visual bar 0%◄────────►100% |
| `expected_flow_increase` | Estimated throughput gain | "+2.1 units (4.0% improvement)" |
| `current_utilization` | How full is it now | "100% (fully saturated)" |

**Rationale text** (from `rationale` field):
```
Display below each row:
"Critical saturated edge: Operating at 100%. 
This is a primary bottleneck. Upgrading from 
14.28 to 18.5 capacity would add 2.3 units 
of flow through the network."
```

---

#### 11. Node Priorities
**Backend Field**: `response.upgrade_analysis.node_priorities` (sorted array)

**Structure**: Same as edge_priorities but for nodes

**UI Display**:
```
┌────────┬────────┬───────┬──────────┬─────────────┐
│ Rank   │ Node   │ MV    │ Priority │ Impact      │
├────────┼────────┼───────┼──────────┼─────────────┤
│ 1 🔴   │ Node 11│ 3.21  │ 0.98     │ +3.2 units! │
│ 2 🟠   │ Node 19│ 1.45  │ 0.72     │ +1.5 units  │
│ 3 🟡   │ Node 21│ 0.68  │ 0.38     │ +0.7 units  │
└────────┴────────┴───────┴──────────┴─────────────┘
```

**Important**: Node 11 shows very high marginal_value (3.21) because it's critical hub!

---

### Critical Paths Section

#### 12. Critical Paths
**Backend Field**: `response.critical_paths.paths` (array of path objects)

**Structure**:
```json
{
  "flow": 14.28,
  "path": [1, 11, 19, 27, 25]
}
```

**UI Display - Path Flow Diagram**:
```
┌─────────────────────────────────────┐
│  TOP PATHS (carrying 80%+ of flow)  │
│  ─────────────────────────────────── │
│                                     │
│  Path 1: 1→11→19→27→25              │
│  Flow: 14.28 units (27.2%)          │
│  ████████████░░░░░░░░░░░░░░░░░░░░  │
│  Bottlenecks: (11,19), Node 19      │
│  Status: SATURATED                  │
│                                     │
│  Path 2: 1→11→19→29→32              │
│  Flow: 11.88 units (22.6%)          │
│  ██████████░░░░░░░░░░░░░░░░░░░░░░  │
│  Bottlenecks: (19,29)               │
│  Status: NEAR-SATURATED (95%)       │
│                                     │
│  Path 3: 2→10→19→30→32              │
│  Flow: 8.44 units (16.1%)           │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  Bottlenecks: None                  │
│  Status: HEALTHY (60%)              │
│                                     │
└─────────────────────────────────────┘
```

**Graph Animation**:
- Show paths with colored lines
- Animate flow as moving dots along paths
- Color: Red (saturated), Orange (near-sat), Green (healthy)

---

#### 13. Single Points of Failure (SPOFs)
**Backend Field**: `response.critical_paths.single_points_of_failure` (list of node IDs)

**It means**: Components whose failure would break ALL paths to some target

**UI Display**:
```
┌─────────────────────────────────────┐
│  ⚠️ SINGLE POINTS OF FAILURE        │
│  ─────────────────────────────────── │
│                                     │
│  🔴 CRITICAL: Node 11               │
│     ALL 8 flows pass through here   │
│     Failure Impact: 100% network    │
│     Alternative Paths: NONE         │
│     Backup Available: NO            │
│                                     │
│  🟠 WARNING: Node 19                │
│     Most flows pass through here    │
│     Failure Impact: 85% network     │
│     Alternative Paths: 1 (limited)  │
│     Backup Available: LIMITED       │
│                                     │
└─────────────────────────────────────┘
```

**URGENT Alert**: Highlight with animated red border
```
┌⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️┐
│ CRITICAL VULNERABILITY DETECTED     │
│                                     │
│ Node 11 is a SINGLE POINT OF        │
│ FAILURE. All network flow passes    │
│ through this component.             │
│                                     │
│ If Node 11 fails: 0% throughput     │
│ Required Action: Add redundancy     │
│                                     │
└⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️┘
```

---

#### 14. Path Redundancy
**Backend Field**: `response.critical_paths.path_redundancy` or similar

**What it means**: Number of alternative paths for each source-sink pair

**UI Display - Redundancy Matrix**:
```
             Target 25  Target 27  Target 28  Target 29  ...
Source 1       1          5          2          3
Source 2       0          5          4          3
Source 3       1          7          3          4
Source 4       2          0          5          2
...

Legend:
0 = CRITICAL (no alternatives)
1-2 = WARNING (limited alternatives)
3-5 = GOOD (multiple paths)
6-8 = EXCELLENT (highly redundant)
```

**Visualization**:
```
Redundancy Summary:
🔴 No Alternative Paths: 3 source-sink pairs
🟠 Limited Paths (1-2): 5 source-sink pairs
🟡 Good Paths (3-5): 8 source-sink pairs
🟢 Excellent Paths (6+): 4 source-sink pairs
```

---

### Comparative Analysis Section

#### 15. Realistic vs Classical Flow
**Backend Field**: `response.comparative_analysis.realistic_max_flow`, `response.comparative_analysis.classical_max_flow`

**What it means**: 
- **Classical**: Max flow if treating all as simple graph (no node constraints)
- **Realistic**: Actual max flow with node processing constraints

**UI Display**:
```
┌─────────────────────────────────────┐
│  REALISTIC vs CLASSICAL ANALYSIS    │
│  ─────────────────────────────────── │
│                                     │
│  Classical (edges only):  90.0 units│
│  ████████████████████░░░░░░░░░░░░  │
│                                     │
│  Realistic (nodes too):  52.5 units │
│  ███████████░░░░░░░░░░░░░░░░░░░░░  │
│                                     │
│  Efficiency Loss:         41.7%     │
│  Impact of Nodes:         -37.5 uts │
│                                     │
│  Interpretation:                    │
│  Node processing constraints        │
│  reduce flow by 41.7% vs edges-only │
│                                     │
└─────────────────────────────────────┘
```

**Formula**:
```
efficiency_loss_percent = 
  ((classical - realistic) / classical) × 100
```

---

#### 16. Primary Limitation
**Backend Field**: `response.comparative_analysis.primary_limitation`

**Possible values**:
- `transmission` → "Edge capacity dominates"
- `processing` → "Node processing dominates"
- `mixed` → "Both are equally constrained"
- `source_limited` → "Sources are insufficient"

**UI Display**:
```
PRIMARY NETWORK LIMITATION
Transmission Bottleneck
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Edges are the primary constraint.
Network has excess node capacity.
Strategy: Add transmission links
or increase edge bandwidth.
```

---

#### 17. Strategic Recommendation
**Backend Field**: `response.comparative_analysis.strategic_recommendation`

**What it means**: High-level guidance on how to improve network

**UI Display**:
```
┌─────────────────────────────────────┐
│  💡 STRATEGIC RECOMMENDATIONS      │
│  ─────────────────────────────────── │
│                                     │
│  Network is primarily limited by    │
│  processing at hub nodes.           │
│                                     │
│  🎯 IMMEDIATE ACTIONS:              │
│  1. Upgrade Node 11 to 25+ capacity │
│  2. Add parallel processing node    │
│  3. Balance load distribution       │
│                                     │
│  📊 MEDIUM-TERM PLAN:               │
│  • Redesign Node 11 for 5x capacity │
│  • Add redundant processing paths   │
│  • Implement load balancing         │
│                                     │
│  Expected Improvement: +15.5 units  │
│                                     │
└─────────────────────────────────────┘
```

---

### Validation Section

#### 18. Validation Report
**Backend Field**: `response.validation.*` (multiple boolean/error fields)

**Fields to check**:
- `flow_balance_satisfied` (bool)
- `capacity_constraints_satisfied` (bool)
- `optimality_verified` (bool)
- `flow_conservation_satisfied` (bool)
- `conservation_violations` (list of errors)
- `errors` (list of error strings)
- `warnings` (list of warning strings)

**UI Display - Validation Checklist**:
```
┌─────────────────────────────────────┐
│  ✅ VALIDATION STATUS               │
│  ─────────────────────────────────── │
│                                     │
│  ✅ Flow Conservation:    PASSED    │
│     All nodes: inflow = outflow     │
│                                     │
│  ✅ Capacity Constraints: PASSED    │
│     No component exceeded capacity  │
│                                     │
│  ✅ Optimality Verified: PASSED     │
│     Solution is optimal/exact       │
│                                     │
│  ✅ Source/Sink Balance: PASSED     │
│     All demand satisfied if possible│
│                                     │
│  Overall: 4/4 checks passed ✅      │
│           All systems nominal       │
│                                     │
└─────────────────────────────────────┘
```

**If warnings**:
```
┌─────────────────────────────────────┐
│  ⚠️ WARNINGS                        │
│  ─────────────────────────────────── │
│                                     │
│  • Conservation error: 1.23e-15     │
│    (numerical precision - OK)       │
│                                     │
│  • Node 5 orphaned (no inflow)      │
│    (may be unused - investigate)    │
│                                     │
└─────────────────────────────────────┘
```

---

### Interval/Uncertainty Section (Scenarios 5-7)

#### 19. Guaranteed Min Flow
**Backend Field**: `response.guaranteed_min_flow` (for interval mode)

**What it means**: Worst-case throughput across all parameter uncertainty ranges

**UI Display**:
```
WORST-CASE SCENARIO (All parameters at minimum bounds)

Guaranteed Flow: 19.4 units ✓
╔═══════════════════════════════════╗
║  GUARANTEED ✓ - Network promises  ║
║  this throughput even if          ║
║  all parameters hit worst case    ║
╚═══════════════════════════════════╝
```

---

#### 20. Possible Max Flow
**Backend Field**: `response.possible_max_flow` (for interval mode)

**What it means**: Best-case throughput across all parameter uncertainty ranges

**UI Display**:
```
BEST-CASE SCENARIO (All parameters at maximum bounds)

Possible Flow: 22.6 units
╔═══════════════════════════════════╗
║  POSSIBLE but not guaranteed      ║
║  Best-case if all conditions      ║
║  align favorably                  ║
╚═══════════════════════════════════╝
```

---

#### 21. Uncertainty Range
**Derived**: `possible_max_flow - guaranteed_min_flow`

**UI Display - Uncertainty Widget**:
```
┌─────────────────────────────────────┐
│  NETWORK THROUGHPUT UNDER           │
│  PARAMETER UNCERTAINTY              │
│  ─────────────────────────────────── │
│                                     │
│  Worst Case      Expected    Best   │
│      ↓               ↓        ↓      │
│  ├─────────────═══════────────────┤ │
│  19.4           21.0           22.6  │
│  units          units          units │
│                                     │
│  Uncertainty Band: ±1.6 units       │
│  Confidence: 95% within range       │
│                                     │
│  Decision: Safe to plan for 19.4    │
│            Conservative operations  │
│                                     │
└─────────────────────────────────────┘
```

---

#### 22. Worst/Best Case Scenarios
**Backend Field**: `response.worst_case_scenario`, `response.best_case_scenario`

**What it means**: Which parameter combinations create each extreme

**UI Display**:
```
┌─────────────────────────────────────┐
│  WHAT CAUSES WORST CASE?            │
│  ─────────────────────────────────── │
│                                     │
│  • All source rates at minimums     │
│  • Node 11 capacity: 18.0 (min)     │
│  • Edge (11,19): 12.0 (min)         │
│  • Result: 19.4 units (bottleneck)  │
│                                     │
├─────────────────────────────────────┤
│  WHAT CAUSES BEST CASE?             │
│  ─────────────────────────────────── │
│                                     │
│  • All source rates at maximums     │
│  • Node 11 capacity: 28.0 (max)     │
│  • Edge (11,19): 15.8 (max)         │
│  • Result: 22.6 units (unconstrained)│
│                                     │
└─────────────────────────────────────┘
```

---

#### 23. Robust Bottlenecks
**Backend Field**: `response.robust_bottlenecks`

**What it means**: Components that are bottlenecks in ALL uncertainty scenarios

**UI Display**:
```
┌─────────────────────────────────────┐
│  ROBUST SINGLE POINTS OF FAILURE    │
│  (Critical in ALL scenarios)        │
│  ─────────────────────────────────── │
│                                     │
│  🔴 Node 11                         │
│     Bottleneck in: 100% of scenarios│
│     Always critical - must upgrade  │
│                                     │
│  🟠 Edge (11,19)                    │
│     Bottleneck in: 85% of scenarios │
│     Often critical - prioritize     │
│                                     │
│  🟡 Node 19                         │
│     Bottleneck in: 60% of scenarios │
│     Sometimes critical - monitor    │
│                                     │
└─────────────────────────────────────┘
```

---

## UI Component Library

Complete component specifications for implementation.

### Component 1: Flow Overview Card
```html
<div class="flow-overview-card">
  <h2>Network Throughput</h2>
  
  <!-- Main metric -->
  <div class="metric-display">
    <div class="metric-value">52.45</div>
    <div class="metric-unit">units/time</div>
    <div class="metric-status green">Operating</div>
  </div>
  
  <!-- Source comparison -->
  <div class="source-comparison">
    <div>Available: 84.0 units</div>
    <div>Achieved: 52.45 units</div>
    <div>Constrained by: 37.6%</div>
  </div>
  
  <!-- Status indicator -->
  <div class="status-bar">
    <div class="status-fill" style="width: 62.5%"></div>
    <div class="status-label">Operating at 62.5% of available</div>
  </div>
</div>
```

### Component 2: Bottleneck Indicator
```html
<div class="bottleneck-indicator">
  <div class="bottleneck-type">
    <span class="type-icon">⚙️</span>
    <span class="type-name">NODE PROCESSING BOTTLENECK</span>
  </div>
  
  <div class="bottleneck-details">
    <h4>Primary Constraint</h4>
    <div class="constraint-item">
      <span>Component: Node 11</span>
      <span>Utilization: 100%</span>
      <span>Status: SATURATED 🔴</span>
    </div>
  </div>
  
  <div class="bottleneck-strategy">
    <h4>Strategic Action</h4>
    <p>Upgrade node processing capacity at hub 11</p>
  </div>
</div>
```

### Component 3: Upgrade Priority Table
```html
<table class="upgrade-priorities">
  <thead>
    <tr>
      <th>Rank</th>
      <th>Component</th>
      <th>Current</th>
      <th>Recommended</th>
      <th>Impact</th>
      <th>Priority</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    <tr class="priority-critical">
      <td>1 🔴</td>
      <td>Node 11</td>
      <td>20.96</td>
      <td>25.0</td>
      <td>+3.2 units</td>
      <td class="priority-score">98%</td>
      <td><button>Upgrade Now</button></td>
    </tr>
    <tr class="priority-high">
      <td>2 🟠</td>
      <td>(11,19)</td>
      <td>14.28</td>
      <td>18.5</td>
      <td>+2.1 units</td>
      <td class="priority-score">92%</td>
      <td><button>Plan</button></td>
    </tr>
    <!-- ... more rows ... -->
  </tbody>
</table>
```

### Component 4: Network Graph Visualization
```javascript
// Pseudo-code for network visualization

function renderNetworkGraph(response) {
  // Node styling
  nodes.forEach(node => {
    if (response.bottlenecks.saturated_nodes.includes(node)) {
      node.color = RED;
      node.size = LARGE;
      node.label.text = `${node.id} [100%]`;
      node.label.color = RED;
      addGlowEffect(node);
    } else if (response.bottlenecks.near_saturated_nodes.includes(node)) {
      node.color = ORANGE;
      node.size = MEDIUM;
    } else {
      node.color = GREEN;
      node.size = SMALL;
    }
    
    // Show utilization as node fill
    const util = response.bottlenecks
      .utilization_by_component[node.id];
    node.fill = getColorForUtilization(util);
  });
  
  // Edge styling
  edges.forEach(edge => {
    if (response.bottlenecks.saturated_edges.includes(edge)) {
      edge.color = RED;
      edge.thickness = 3;
      edge.animated = true;
      addFlowAnimation(edge);
    } else {
      edge.color = interpolateColor(
        GREEN, 
        RED, 
        utilization
      );
      edge.thickness = 1 + utilization * 2;
    }
  });
  
  // Highlight critical paths
  response.critical_paths.paths
    .filter(p => p.flow > threshold)
    .forEach(path => {
      highlightPath(path, RED);
    });
  
  // Mark SPOFs
  response.critical_paths.single_points_of_failure
    .forEach(node => {
      addAlertIcon(node);
      drawBoldBorder(node);
    });
}
```

### Component 5: Utilization Heatmap
```css
.heatmap-grid {
  display: grid;
  gap: 2px;
  background: white;
}

.heatmap-cell {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.heatmap-cell:hover {
  transform: scale(1.2);
  box-shadow: 0 0 10px rgba(0,0,0,0.2);
  z-index: 10;
}

.heatmap-cell.green { background: #22c55e; }
.heatmap-cell.yellow { background: #eab308; }
.heatmap-cell.orange { background: #f97316; }
.heatmap-cell.red { background: #ef4444; }

/* Tooltip on hover */
.heatmap-cell::after {
  content: attr(data-tooltip);
  position: absolute;
  top: 100%;
  background: black;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.heatmap-cell:hover::after {
  opacity: 1;
}
```

### Component 6: Interval Uncertainty Widget
```html
<div class="uncertainty-widget">
  <h3>Network Throughput Under Uncertainty</h3>
  
  <div class="uncertainty-range">
    <!-- Range visualization -->
    <div class="range-container">
      <div class="range-label">Worst Case</div>
      <div class="range-bar">
        <div class="range-worst" style="left: 5%">19.4</div>
        <div class="range-expected" style="left: 45%">21.0</div>
        <div class="range-best" style="left: 80%">22.6</div>
        <div class="range-track">
          <div class="range-fill" 
               style="left: 5%; width: 75%;"></div>
        </div>
      </div>
      <div class="range-label">Best Case</div>
    </div>
    
    <!-- Legend -->
    <div class="range-legend">
      <span>Guaranteed: 19.4</span>
      <span>Expected: 21.0</span>
      <span>Possible: 22.6</span>
      <span>Uncertainty: ±1.6</span>
    </div>
  </div>
</div>
```

---

## User Workflows

How users interact with each section based on their goals.

### Workflow 1: "Why is my network slow?"
```
User Action              UI Response
─────────────────────────────────────────────
1. Load scenario        Display all cards
                        ↓
2. Sees "52.5 units"   Color is YELLOW/ORANGE
   vs "84 available"   ↓
3. Looks for            Card 3 shows:
   bottleneck           "Node 11 - 100%"
   ↓                    ↓
4. Clicks on Node 11    Graph highlights paths
                        Shows SPOF warning
                        ↓
5. Sees "Add 4 units    Upgrade priorities
   by upgrading Node 11" sorted by impact
                        ↓
6. Decides: "Need to    Recommendation:
   increase Node 11     "Upgrade Node 11
   capacity"            from 21 to 25"
```

### Workflow 2: "What are my risks?"
```
User Action              UI Response
─────────────────────────────────────────────
1. Navigate to          "Single Points of
   Critical Paths       Failure" section
   ↓
2. See "Node 11 -       Animation shows
   100% paths use it"   all paths through 11
                        ↓
3. Check redundancy     Redundancy matrix:
                        3 source-sink pairs
                        with NO alternatives
                        ↓
4. Concerned about      Strategic section:
   failure impact       "If Node 11 fails:
                        100% network loss"
                        ↓
5. Plan mitigation      Recommendation list:
                        "Add parallel path"
```

### Workflow 3: "Where should I invest?"
```
User Action              UI Response
─────────────────────────────────────────────
1. Click "Upgrade       "Priorities by
   Strategy"            Impact" section
                        ↓
2. See sorted list:     Node 11: +3.2 units
   Top upgrades by      Edge (11,19): +2.1
   marginal value       Edge (19,27): +1.8
                        ↓
3. Compare effort       Show cost/benefit
   vs gain              (if cost data given)
                        ↓
4. Select upgrade       Shows network diff:
   option               "Before: 52.5 units
                        After: 55.7 units"
```

### Workflow 4: "Is this design robust?"
```
User Action              UI Response
─────────────────────────────────────────────
1. Click Validation     Display:
   section              ✅ All checks passed
                        Path redundancy: Good
                        ↓
2. Check SPOFs          "⚠️ CRITICAL"
                        Node 11 is SPOF
                        ↓
3. Review resilience    Worst-case: 19.4
   (interval scenario)  units achievable
                        ↓
4. Assessment:          "Design has
   "Can we operate      adequate headroom
   at 50% flow long-    but vulnerable at
   term?"               Node 11"
```

---

## Implementation Checklist

Complete list of everything needed for full UI implementation.

### Phase 1: Core Metrics
- [ ] Flow overview card component
  - [ ] Total max flow display (single or range)
  - [ ] Sources available comparison
  - [ ] % constrained calculation
  - [ ] Color coding (green/yellow/red)
- [ ] Network utilization meter
  - [ ] Percentage display
  - [ ] Colored bar graph
  - [ ] Status interpretation text
- [ ] Bottleneck type indicator
  - [ ] Icon for each type (transmission/processing/mixed/source)
  - [ ] Color badge
  - [ ] Descriptive text

### Phase 2: Bottleneck Analysis
- [ ] Saturated nodes list
  - [ ] Node ID display
  - [ ] Utilization percentage
  - [ ] Current/capacity comparison
  - [ ] Red highlighting
- [ ] Near-saturated nodes list
  - [ ] Warning color (orange)
  - [ ] Headroom calculation
  - [ ] Same structure as saturated
- [ ] Saturated edges list
  - [ ] Edge tuple display (src,dst)
  - [ ] Flow/capacity display
  - [ ] Count summary
- [ ] Utilization heatmap
  - [ ] Grid layout
  - [ ] Color gradient (green→yellow→orange→red)
  - [ ] Hover tooltips
  - [ ] Optional: detailed table view

### Phase 3: Min-Cut Analysis
- [ ] Min-cut nodes/edges finder
  - [ ] Display the set
  - [ ] Explain impact
  - [ ] Highlight on graph
- [ ] Critical dependency explanation
  - [ ] "If removed, network disconnected"
  - [ ] Max throughput = min capacity

### Phase 4: Upgrade Recommendations
- [ ] Edge priorities table
  - [ ] Ranked by priority_score
  - [ ] Current → Recommended capacity
  - [ ] Expected flow increase
  - [ ] Marginal value display
  - [ ] Rationale text
  - [ ] Upgrade action button
- [ ] Node priorities table (same structure)
  - [ ] Highlight Node 11 if present
  - [ ] Show highest marginal value

### Phase 5: Critical Paths
- [ ] Path flow visualization
  - [ ] List top paths by flow amount
  - [ ] Flow percentage of total
  - [ ] Node/edge sequence
  - [ ] Status (saturated/near-sat/healthy)
  - [ ] Bottleneck identification per path
- [ ] Graph path rendering
  - [ ] Highlight selected path
  - [ ] Animated flow indicators
  - [ ] Color by saturation level

### Phase 6: SPOF Analysis
- [ ] Single points of failure list
  - [ ] Red alert styling
  - [ ] Impact percentage
  - [ ] Redundancy available
  - [ ] Criticality badge
- [ ] SPOF visualization on graph
  - [ ] Bold border around SPOF nodes
  - [ ] Glow effect
  - [ ] Alert icon overlay
  - [ ] Path highlighting through SPOF

### Phase 7: Comparative Analysis
- [ ] Classical vs Realistic comparison
  - [ ] Side-by-side flow values
  - [ ] Bar chart comparison
  - [ ] Efficiency loss percentage
  - [ ] Impact explanation
- [ ] Primary limitation display
  - [ ] Badge with limitation type
  - [ ] Strategic guidance text
- [ ] Strategic recommendation section
  - [ ] Bullet points of actions
  - [ ] Grouped by timeframe (immediate/medium/long-term)
  - [ ] Expected improvement quantified

### Phase 8: Validation & Quality
- [ ] Validation checklist
  - [ ] List all checks performed
  - [ ] ✅/❌ status for each
  - [ ] Error/warning display if any
- [ ] Metadata display
  - [ ] Computation time
  - [ ] Analysis timestamp
  - [ ] Algorithm used
  - [ ] Exactness guarantees

### Phase 9: Interval/Uncertainty Features
- [ ] Flow range display
  - [ ] Worst case, expected, best case
  - [ ] Range bar visualization
  - [ ] Uncertainty band
- [ ] Robust bottleneck identification
  - [ ] Mark which components bottleneck in all scenarios
  - [ ] Criticality percentage
  - [ ] "Must-upgrade" vs "Consider-upgrading"
- [ ] Uncertainty widget
  - [ ] Interactive range slider (optional)
  - [ ] Explanation: "What if parameters change?"

### Phase 10: Network Graph Visualization
- [ ] Node rendering
  - [ ] Color by utilization
  - [ ] Size by capacity or importance
  - [ ] Label with ID and %
  - [ ] Hover tooltip (details)
- [ ] Edge rendering
  - [ ] Color by utilization
  - [ ] Thickness by flow
  - [ ] Animation for saturated/critical
  - [ ] Hover tooltip (flow/capacity)
- [ ] Graph interactions
  - [ ] Click node → show details
  - [ ] Click path → highlight path
  - [ ] Hover → show utilization
  - [ ] Zoom/pan controls
  - [ ] Reset button

### Phase 11: User Workflows
- [ ] Navigation between sections
  - [ ] Dashboard view (all cards visible or tabs)
  - [ ] Deep-dives (individual section expansion)
  - [ ] Filters (e.g., "show only >90% utilization")
- [ ] Export/reporting
  - [ ] Export as PDF report
  - [ ] Export as CSV (tabular data)
  - [ ] Email report
  - [ ] Compare two scenarios side-by-side

### Phase 12: Styling & UX
- [ ] Responsive design
  - [ ] Desktop (1920x1080+)
  - [ ] Tablet (1024x768)
  - [ ] Mobile (if needed)
- [ ] Accessibility
  - [ ] Color-blind friendly palette
  - [ ] Screen reader support
  - [ ] Keyboard navigation
- [ ] Performance
  - [ ] Lazy load large tables
  - [ ] Debounce hover/zoom events
  - [ ] Cache rendered graphs
- [ ] Dark mode (optional)
  - [ ] Invert colors appropriately
  - [ ] Maintain contrast ratios

### Phase 13: Error Handling
- [ ] Validation failures
  - [ ] Display which checks failed
  - [ ] Suggest remediation
- [ ] Missing data
  - [ ] Graceful fallbacks
  - [ ] Clear "N/A" indicators
- [ ] Large datasets
  - [ ] Paginate tables
  - [ ] Summarize heatmaps (show only top N)

### Phase 14: Documentation & Tooltips
- [ ] Hover tooltips for every metric
  - [ ] Explain what it means
  - [ ] Show formula if applicable
  - [ ] Link to docs
- [ ] "Learn More" links in each section
- [ ] Glossary modal (accessible UI)

---

## Example Scenarios

Real data from the 7 tested scenarios showing expected UI output.

### Example 1: Scenario 2 (Edge Bottleneck Demo)
**Input**: Edge Bottleneck Demo scenario JSON response

**Expected UI Display**:
```
╔════════════════════════════════════════════════════╗
║ CAPACITY ANALYSIS: Edge Bottleneck Demo            ║
║ Analysis completed in 16.00 ms                     ║
╠════════════════════════════════════════════════════╣

[FLOW CARD]
  Max Flow: 52.45 units
  Sources Available: 84.0
  Network Utilization: 5.45%
  Status: 🟠 YELLOW "Moderate constraints"

[BOTTLENECK CARD]
  Primary: ⚙️ NODE PROCESSING BOTTLENECK
  Component: Node 11
  Utilization: 100% 🔴
  Impact: Limits flow by 31.55 units

[SATURATED COMPONENTS]
  🔴 Node 11: 20.96/20.96 units (100%)

[NEAR-SATURATED] 
  🟠 Node 19: 29.44/32.00 units (92%)

[UPGRADE PRIORITIES]
  1. 🔴 Node 11 → +4.2 units (priority: 98%)
  2. 🟠 (11,19) → +2.1 units (priority: 92%)
  3. 🟡 (11,21) → +1.8 units (priority: 88%)

[CRITICAL PATHS]
  Path 1: [1→11→19→27→25]
  Flow: 14.28 units (27.2%)
  Status: SATURATED

[SPOF ALERT]
  ⚠️ CRITICAL: Node 11 is SINGLE POINT OF FAILURE
     All 8 flows pass through this node
     Failure Impact: 100% network loss
     Redundancy: NONE

[COMPARATIVE ANALYSIS]
  Classical Max Flow: 90.0 units
  Realistic Max Flow: 52.5 units  
  Efficiency Loss: 41.7%
  → Node processing reduces throughput by 41.7%

[VALIDATION]
  ✅ Flow conservation: PASSED
  ✅ Capacity constraints: PASSED
  ✅ Optimality verified: PASSED
  ✅ All checks: 11/14 PASSED
  
  ⚠️ Warnings: Conservation error (1.76e-15, acceptable)

```

**Network Graph Visualization**:
```
                Source 1
                   |
          [Node 9]   [Node 11] ⚙️🔴 BOTTLENECK
           |      \    /   |   \
           |       \  /    |    \
           |        \/     |     \
           └────[Node 19]🔴───→[Node 27]
                  |    \
                  |     \
              [Node 29] [Node 30]
                  |       |
               [Target]  [Target]

Node 11: RED BOLD - "100% SATURATED"
Edges (11,19), (11,21), (11,22): RED - "Critical"
```

---

### Example 2: Scenario 5 (Interval Conservative)
**Input**: Interval Conservative scenario JSON response

**Expected UI Display**:
```
╔════════════════════════════════════════════════════╗
║ CAPACITY ANALYSIS: Interval Conservative           ║
║ Uncertainty Mode: Robust Analysis                  ║
║ Analysis completed in 33.00 ms                     ║
╠════════════════════════════════════════════════════╣

[UNCERTAINTY FLOW WIDGET]
  Worst Case    Expected    Best Case
      ↓             ↓           ↓
  ├─────────────═════────────────┤
  19.4          21.0          22.6
  units         units         units
  
  Uncertainty Band: ±1.6 units
  Safe Operating Point: 19.4 units (worst-case)

[BOTTLENECK TYPE]
  Analysis Type: Robust (considers all uncertainties)
  Status: Multiple bottlenecks across scenarios

[WORST-CASE SCENARIO]
  When all parameters at minimum bounds:
  • Source rates: [7, 10.5] → use 7.0
  • Node 11: 18.0 capacity (minimum)
  • Edge (11,19): 12.0 capacity
  Result: Max Flow = 19.4 units

[BEST-CASE SCENARIO]
  When all parameters at maximum bounds:
  • Source rates: [9.8, 11.4] → use 11.4
  • Node 11: 28.0 capacity (maximum)
  • Edge (11,19): 15.8 capacity
  Result: Max Flow = 22.6 units

[ROBUST SINGLE POINTS OF FAILURE]
  🔴 Node 11
     SPOF in 100% of scenarios (worst: 19.4 units)
     MUST upgrade - essential in all cases
  
  🟠 Edge (11,19)
     Critical in 85% of scenarios
     Consider parallel link

[DECISION SUPPORT]
  For Conservative Design:
  → Plan for 19.4 units guaranteed throughput
  → Headroom exists to 22.6 units
  → If actual conditions are better, gain is bonus

  Risk Assessment:
  → Worst-case: Acceptable (19.4 ≈ current 21.0 expected)
  → Design safe for deployment

```

---

## Advanced Features

Bonus features for enhanced capability.

### Feature 1: Scenario Comparison
```html
<div class="scenario-comparison">
  <select multiple>
    <option>Scenario 1: Source Limited</option>
    <option selected>Scenario 2: Edge Bottleneck</option>
    <option selected>Scenario 3: Node Bottleneck</option>
  </select>
  
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th>Scenario 2</th>
        <th>Scenario 3</th>
        <th>Difference</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Max Flow</td>
        <td>52.45</td>
        <td>68.16</td>
        <td>+15.71 (+30%)</td>
      </tr>
      <tr>
        <td>Bottleneck</td>
        <td>Node 11</td>
        <td>Node 11</td>
        <td>Same</td>
      </tr>
      <!-- More metrics -->
    </tbody>
  </table>
</div>
```

### Feature 2: What-If Analysis
```
User input: "What if I upgrade Node 11 to 30 units?"
            "What if I add parallel path (11,20)?"

System shows:
Before Upgrade:  [━━━━━━━━░░] 52.45 units
After Upgrade:   [━━━━━━════] 67.3 units
Net Improvement: +14.85 units (+28%)
```

### Feature 3: Sensitivity Analysis
```
How sensitive is max flow to each parameter?

Node 11 capacity:      ✓✓✓✓✓ High sensitivity (coefficient: 0.89)
Edge (11,19) capacity: ✓✓✓✓  High sensitivity (0.76)
Source rates:          ✓✓✓   Medium sensitivity (0.62)
Node 19 capacity:      ✓✓    Medium sensitivity (0.48)
Edge (19,27) capacity: ✓✓    Medium sensitivity (0.44)

→ Focus upgrades on Node 11 (highest impact)
```

### Feature 4: Recommendation Engine
```
Based on your network configuration:

Priority 1: IMMEDIATE (this week)
  Upgrade Node 11: Investment = HIGH, Impact = +4.2 units
  Est. ROI: 28% improvement per unit cost
  
Priority 2: SOON (this month)
  Add parallel edge (21, 27): Low cost, +1.5 units
  Improves redundancy significantly
  
Priority 3: LONGER-TERM (this quarter)
  Distribute processing: HIGH investment
  Eliminates Node 11 SPOF, adds resilience
```

---

## Implementation Notes

Technical guidance for developers.

### Data Structure Best Practices
1. **Cache computed metrics**
   - Don't recalculate on every render
   - Update only when response changes

2. **Lazy load large components**
   - Heatmaps with 1000+ cells: virtualize
   - Graph visualization: use WebGL for 100+ nodes

3. **Stream data updates**
   - For real-time scenarios: WebSocket updates
   - Animate value changes smoothly

### Accessibility
1. Use color + icons (not just color)
2. Text alternatives for all visualizations
3. Keyboard shortcuts for common actions
4. Screen reader friendly table markup

### Performance Targets
- Dashboard load: <1 second
- Graph render: <500ms for 100 nodes
- Table sort: <200ms
- Export PDF: <2 seconds

---

## Summary

This guide provides complete mapping from backend JSON response to user-facing UI. Follow the checklist in Phase order for systematic implementation. Each component includes concrete examples from the 7 test scenarios.

**Key principles**:
1. Display data hierarchically (overview → details)
2. Use color + icons for quick recognition
3. Always show context and comparisons
4. Provide actionable recommendations
5. Make critical information prominent (SPOFs, alerts)

Reference specific sections when building each UI component.

