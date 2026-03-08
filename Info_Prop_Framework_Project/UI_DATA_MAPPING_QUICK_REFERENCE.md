# UI Data Mapping Quick Reference

Rapid lookup for backend fields → UI components.

---

## Core Metrics (Dashboard Header)

| Backend Field | What It Shows | UI Component | Display Format |
|---|---|---|---|
| `total_max_flow` | Network throughput | Flow Card | Large number + "units/time" |
| `network_utilization` | Average usage | Utilization Meter | Progress bar (0-100%) |
| `bottleneck_type` | Constraint type | Badge | Icon + Label (transmission/node/mixed/source) |
| `computation_time_ms` | Performance | Metadata | "⏱️ Analysis: 12.00 ms" |
| `edge_flows` dict | Per-edge flow | Optional: Table | Rarely shown, use heatmap instead |
| `node_flows` dict | Per-node flow | Optional: Table | Rarely shown, use heatmap instead |

---

## Bottleneck Analysis

| Backend Field | What It Shows | UI Component | Display Format |
|---|---|---|---|
| `bottlenecks.saturated_nodes[]` | 100% capacity nodes | Red List | 🔴 Node 11 [████] 100% |
| `bottlenecks.near_saturated_nodes[]` | 90-99% nodes | Orange List | 🟠 Node 19 [███░] 92% |
| `bottlenecks.saturated_edges[]` | 100% capacity edges | Red List | 🔴 (11,19): 14.28/14.28 |
| `bottlenecks.near_saturated_edges[]` | 90-99% edges | Orange List | 🟠 (11,21): 11.2/12.0 |
| `bottlenecks.utilization_by_component` | Each node/edge % | Heatmap | Color grid (🟢🟡🟠🔴) |
| `bottlenecks.min_cut_edges` | Critical edges | Highlight on Graph | Bold border + glow |
| `bottlenecks.min_cut_nodes` | Critical nodes | Highlight on Graph | Bold border + glow |

---

## Upgrades & Strategy

| Backend Field | What It Shows | UI Component | Display Format |
|---|---|---|---|
| `upgrade_analysis.edge_priorities[]` | Top edge upgrades | Sorted Table | Rank, Edge, Priority %, Impact |
| `upgrade_analysis.node_priorities[]` | Top node upgrades | Sorted Table | Rank, Node, Priority %, Impact |
| `.marginal_value` | Flow gain per unit | Metric in Row | "0.21 units/increased capacity" |
| `.priority_score` (0-1.0) | Urgency | Visual Bar | [████░░░░░░░░░░░░░░░░░░] 92% |
| `.expected_flow_increase` | Network gain | Metric in Row | "+2.1 units throughput" |
| `.rationale` | Why to upgrade | Tooltip/Expand | Text explanation |

---

## Critical Paths & Redundancy

| Backend Field | What It Shows | UI Component | Display Format |
|---|---|---|---|
| `critical_paths.paths[]` | Top data routes | Path List | Path [1→11→19→27], Flow: 14.28 |
| `.flow` (per path) | Throughput per path | Metric | "14.28 units (27.2% of total)" |
| `.path[]` | Node sequence | Diagram | Nodes connected: 1→11→19→27→25 |
| `critical_paths.single_points_of_failure[]` | Unredundant nodes | Alert List | 🔴 CRITICAL: Node 11, Impact: 100% |
| `critical_paths.path_redundancy[i][j]` | Alternatives for src i→sink j | Matrix | 0-8 (0=CRITICAL, 8=Excellent) |

---

## Comparative Analysis

| Backend Field | What It Shows | UI Component | Display Format |
|---|---|---|---|
| `comparative_analysis.realistic_max_flow` | Actual throughput | Side-by-side Bar | 52.5 units [████░░░░] |
| `comparative_analysis.classical_max_flow` | Edge-only max | Side-by-side Bar | 90.0 units [█████████░] |
| `comparative_analysis.efficiency_loss` | % reduction from nodes | Metric | "41.7% loss due to node constraints" |
| `comparative_analysis.primary_limitation` | Which type limits | Badge | "Processing" / "Transmission" / "Mixed" |
| `comparative_analysis.strategic_recommendation` | High-level guidance | Text Box | "Upgrade Node 11 to 25+ units..." |

---

## Validation

| Backend Field | What It Shows | UI Component | Display Format |
|---|---|---|---|
| `validation.flow_balance_satisfied` | Flow conservation | Checklist | ✅ or ❌ |
| `validation.capacity_constraints_satisfied` | No overload | Checklist | ✅ or ❌ |
| `validation.optimality_verified` | Solution is best | Checklist | ✅ or ❌ |
| `validation.errors[]` | Problems found | Alert Box | ❌ Error: "..." |
| `validation.warnings[]` | Minor issues | Warning Box | ⚠️ Warning: "..." |
| `validation.checks_passed` | Count | Status | "11/14 passed" |

---

## Interval/Uncertainty Mode (Scenarios 5-7)

| Backend Field | What It Shows | UI Component | Display Format |
|---|---|---|---|
| `guaranteed_min_flow` | Worst-case throughput | Range Indicator | 19.4 units (guaranteed) |
| `possible_max_flow` | Best-case throughput | Range Indicator | 22.6 units (optimistic) |
| `expected_flow` | Average expected | Range Indicator | 21.0 units (expected) |
| Derived: uncertainty range | Upper - Lower | Metric | "±1.6 units uncertainty" |
| `robust_bottlenecks` | Critical in ALL scenarios | Alert List | 🔴 Node 11 (100% of scenarios) |
| `worst_case_scenario` | What causes minimum | Explanation | "All params at min bounds" |
| `best_case_scenario` | What causes maximum | Explanation | "All params at max bounds" |

---

## Metadata

| Backend Field | What It Shows | UI Component | Display Format |
|---|---|---|---|
| `computation_time_ms` | Analysis duration | Footer | "⏱️ 12ms" or "⏱️ 33ms" |
| `metadata.algorithm_used` | Method details | Tooltip | "Max flow with node constraints" |
| `metadata.timestamp` | When computed | Footer | "2025-03-08 14:32:15 UTC" |
| `metadata.deterministic` | True/False for interval | Badge | "🎲 Uncertainty Mode" or "🔒 Exact" |

---

## Color Coding Reference

### Utilization Colors
```
0-70%   🟢 GREEN   "Healthy, ample capacity"
70-85%  🟡 YELLOW  "Moderate, watch it"
85-95%  🟠 ORANGE  "High, approaching limit"
95-100% 🔴 RED     "Critical / Saturated"
```

### Status Icons
```
✅ Green check    = PASS / OK / Good
⚠️  Orange warning = WARNING / Near limit
❌ Red X          = FAIL / Error / Blocked
🔴 Red circle     = CRITICAL / Dangerous
🟠 Orange dot     = WARNING / Alert
🟡 Yellow dot     = INFO / Moderate
🟢 Green dot      = OK / Safe
```

### Component Types (Icons)
```
📡 Transmission = Edge/Link
⚙️  Processing  = Node/Hub
⚔️  Mixed      = Both
📤 Source      = Input
🎯 Target      = Output
```

---

## Graph Visualization Guide

### Node Styling
| Condition | Color | Size | Border | Icon |
|---|---|---|---|---|
| Saturated (100%) | RED | LARGE | Bold | 🔴 |
| Near-sat (90-95%) | ORANGE | MEDIUM | Normal | 🟠 |
| Healthy (70-90%) | YELLOW | SMALL | Normal | 🟡 |
| Good (<70%) | GREEN | SMALL | Normal | 🟢 |
| SPOF | RED | LARGE | Bold+Glow | ⚠️ |

### Edge Styling
| Condition | Color | Thickness | Animation | Label |
|---|---|---|---|---|
| Saturated (100%) | BRIGHT RED | 3px | Flow dots | "14.28/14.28 [100%]" |
| Near-sat (90-95%) | ORANGE | 2px | Pulse | "11.2/12.0 [93%]" |
| Healthy (<90%) | GREEN | 1px | None | "6.5/15.0 [43%]" |
| Critical path | RED | 3px | Flow dots | Highlight path |

---

## Component Placement (Layout Guide)

```
┌─────────────────────────────────────────────────────┐
│                    DASHBOARD                        │
├─────────────────────────────────────────────────────┤

[HEADER ROW]
  [Flow Card]      [Utilization]    [Bottleneck Badge]
  52.45 units      [════░░] 5.4%   ⚙️ NODE BOTTLENECK

├─────────────────────────────────────────────────────┤

[MAIN CONTENT AREA - Choose Layout]

OPTION A - Tabbed Interface:
  ├─ Overview (current)
  ├─ Bottlenecks
  ├─ Upgrades
  ├─ Critical Paths
  ├─ Validation
  └─ Interval (if applicable)

OPTION B - Vertical Scroll:
  ├─ [Bottleneck Analysis]
  ├─ [Saturated Components]
  ├─ [Upgrade Priorities]
  ├─ [Critical Paths]
  ├─ [Network Graph]
  ├─ [Comparative Analysis]
  └─ [SPOF & Alerts]

├─────────────────────────────────────────────────────┤

[NETWORK VISUALIZATION (Full Width)]
  Graph showing nodes/edges with colors/animations

├─────────────────────────────────────────────────────┤

[FOOTER]
  Metadata: Computed in 16ms | Algorithm: Max Flow | Status: ✅ Valid

└─────────────────────────────────────────────────────┘
```

---

## Display Priority (What to Show First)

1. **ALWAYS Show** (top priority):
   - Max flow value
   - Bottleneck type + primary component
   - Network graph (if space)

2. **Show if space permits**:
   - Saturated components
   - Top upgrade recommendations
   - SPOFs alert

3. **Show on detail expand**:
   - Full utilization tables
   - All upgrade options
   - Critical paths
   - Validation details

4. **Show on scroll/tab**:
   - Comparative analysis
   - Interval scenarios
   - Sensitivity analysis

---

## Real Data Examples

### Scenario 1 (Source Limited)
```
MAX FLOW:        24.0 units
BOTTLENECK:      📤 Source Limited
SATURATED:       None
NEAR-SAT:        None
STATUS:          🟢 GREEN - No constraints detected
```

### Scenario 2 (Edge Bottleneck Design)
```
MAX FLOW:        52.45 units
BOTTLENECK:      ⚙️ Node Processing
SATURATED:       🔴 Node 11 (100%)
NEAR-SAT:        🟠 Node 19 (92%), 2 edges (98%)
PRIMARY UPGRADE: Node 11 → +4.2 units (priority: 98%)
SPOF:            🔴 Node 11 - Critical
```

### Scenario 3 (Node Bottleneck)
```
MAX FLOW:        68.16 units
BOTTLENECK:      ⚙️ Node Processing  
SATURATED:       🔴 Node 11 (100%)
NEAR-SAT:        🟠 Node 19 (85%)
PRIMARY UPGRADE: Node 11 → +6.8 units (priority: 99%)
SPOF:            🔴 Node 11 - Critical
```

### Scenario 5 (Interval Conservative)
```
GUARANTEED:      19.4 units (worst-case)
EXPECTED:        21.0 units (average)
POSSIBLE:        22.6 units (best-case)
UNCERTAINTY:     ±1.6 units
ROBUST BOTTLENECK: 🔴 Node 11 (100% critical)
STRATEGY:        Plan for 19.4, upside to 22.6
```

---

## Common User Questions → UI Responses

| User Asks | Show This Section | Highlight |
|---|---|---|
| "Why is flow low?" | Bottleneck Analysis | Saturated components |
| "What should I upgrade?" | Upgrade Priorities | Top recommendation |
| "What are my risks?" | Critical Paths + SPOFs | SPOF nodes with alert |
| "Is this design resilient?" | Path Redundancy + Validation | Checklist + Matrix |
| "How much will improvement help?" | Comparative Analysis | "+X units" after upgrade |
| "What if conditions change?" | Interval Scenarios | Worst/best case ranges |

---

## Implementation Checklist (Quick)

### Must Have (MVP)
- [ ] Flow card (total_max_flow)
- [ ] Bottleneck indicator (bottleneck_type)
- [ ] Saturated nodes list
- [ ] Network graph (color by utilization)
- [ ] Error checklist if any

### Should Have
- [ ] Upgrade recommendations table
- [ ] Critical paths display
- [ ] SPOF alert
- [ ] Validation checklist
- [ ] Heatmap of utilization

### Nice to Have
- [ ] Scenario comparison
- [ ] Sensitivity analysis
- [ ] What-if calculator
- [ ] Export PDF
- [ ] Interval visualization

---

## Export/Report Template

When user exports results:

```
════════════════════════════════════════════════════
           CAPACITY ANALYSIS REPORT
════════════════════════════════════════════════════

Network: [Name]
Analysis Date: [Timestamp]
Algorithm: [Method]

EXECUTIVE SUMMARY
─────────────────────────────────────────────────

Maximum Flow: 52.45 units
Primary Bottleneck: Node 11 (Node Processing)
Status: 🔴 CRITICAL - Node bottleneck at 100%

KEY FINDINGS
─────────────────────────────────────────────────

1. Single Point of Failure: Node 11
   Impact: All 8 flows pass through
   
2. Top Upgrade: Node 11 capacity
   Expected gain: +4.2 units (8% improvement)
   
3. Network Efficiency: 58.3% vs classical 100%
   Loss due to node constraints: 41.7%

RECOMMENDATIONS
─────────────────────────────────────────────────

IMMEDIATE: Upgrade Node 11 to 25+ units capacity
MEDIUM-TERM: Add parallel processing node
LONG-TERM: Redesign network topology

DETAILED ANALYSIS
─────────────────────────────────────────────────

[Followed by tables/graphs from sections above]

════════════════════════════════════════════════════
```

---

## Notes

- All colors chosen to be colorblind-friendly (red-blue contrast)
- Always pair color with text/icon for accessibility
- Mobile view: Stack cards vertically, graph below text
- Laptop view: Cards side-by-side, graph on right
- Performance: Heatmap virtualized if >500 cells, graph uses WebGL if >200 nodes

