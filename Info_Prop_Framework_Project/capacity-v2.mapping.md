# Capacity v2 Field-to-Widget Mapping Checklist

Purpose: enforce exact backend-to-UI binding with no hidden reinterpretation.

---

## A) Deterministic Mapping

- [ ] `result.total_max_flow` -> `SUMMARY > Throughput KPI`
- [ ] `result.network_utilization` -> `SUMMARY > Utilization KPI`
- [ ] `result.metadata.computation_time_ms` -> `SUMMARY > Computation Time KPI`
- [ ] `validation.all_checks_passed` -> `SUMMARY > Validation status chip`

### Bottlenecks
- [ ] `result.bottlenecks.min_cut_capacity` -> `BOTTLENECK ANALYSIS > Min-cut card`
- [ ] `result.bottlenecks.bottleneck_type` -> `BOTTLENECK ANALYSIS > Type badge`
- [ ] `result.bottlenecks.saturated_edges` -> `BOTTLENECK ANALYSIS > Saturated edge list`
- [ ] `result.bottlenecks.saturated_nodes` -> `BOTTLENECK ANALYSIS > Saturated node list`
- [ ] `result.bottlenecks.near_saturated_edges` -> `BOTTLENECK ANALYSIS > Near-saturated list`
- [ ] `result.bottlenecks.near_saturated_nodes` -> `BOTTLENECK ANALYSIS > Near-saturated list`
- [ ] `result.bottlenecks.total_spare_edge_capacity` -> `BOTTLENECK ANALYSIS > Spare metrics`
- [ ] `result.bottlenecks.total_spare_node_capacity` -> `BOTTLENECK ANALYSIS > Spare metrics`

### Upgrades
- [ ] `result.upgrade_priorities.edge_priorities` -> `UPGRADE PRIORITIES > Edge table`
- [ ] `result.upgrade_priorities.node_priorities` -> `UPGRADE PRIORITIES > Node table`
- [ ] `result.upgrade_priorities.primary_bottleneck` -> `UPGRADE PRIORITIES > Strategic summary`
- [ ] `result.upgrade_priorities.recommended_action` -> `UPGRADE PRIORITIES > Strategic summary`

### Critical Paths
- [ ] `result.critical_paths.critical_paths` -> `CRITICAL PATHS > Path list`
- [ ] `result.critical_paths.path_redundancy` -> `CRITICAL PATHS > Redundancy`
- [ ] `result.critical_paths.single_points_of_failure` -> `CRITICAL PATHS > SPOF list`

### Comparative
- [ ] `result.comparative_analysis.realistic_max_flow` -> `COMPARATIVE ANALYSIS > Realistic card`
- [ ] `result.comparative_analysis.classical_max_flow` -> `COMPARATIVE ANALYSIS > Classical card`
- [ ] `result.comparative_analysis.efficiency_loss` -> `COMPARATIVE ANALYSIS > Efficiency Loss`
- [ ] `result.comparative_analysis.primary_limitation` -> `COMPARATIVE ANALYSIS > Limitation badge`
- [ ] `result.comparative_analysis.strategic_recommendation` -> `COMPARATIVE ANALYSIS > Recommendation`

### Flow Distribution
- [ ] `result.node_flows` -> `FLOW DISTRIBUTION > Node table + bars`
- [ ] `result.edge_flows` -> `FLOW DISTRIBUTION > Edge table + bars`

### Validation
- [ ] `validation.flow_conservation_satisfied` -> `VALIDATION > Checklist`
- [ ] `validation.max_conservation_error` -> `VALIDATION > Checklist detail`
- [ ] `validation.capacity_constraints_satisfied` -> `VALIDATION > Checklist`
- [ ] `validation.optimality_verified` -> `VALIDATION > Checklist`
- [ ] `validation.warnings` -> `VALIDATION > Warnings block`
- [ ] `validation.errors` -> `VALIDATION > Errors block`

---

## B) Interval Mapping

### Summary (Range-first)
- [ ] `result.guaranteed_min_flow` -> `SUMMARY > Throughput range (lower)`
- [ ] `result.possible_max_flow` -> `SUMMARY > Throughput range (upper)`
- [ ] `result.expected_flow` -> `SUMMARY > Expected flow card`
- [ ] `result.uncertainty_range` -> `SUMMARY > Uncertainty card`

### Detail Source Selection
- [ ] default details source: `result.worst_case_scenario`
- [ ] optional toggle source: `result.best_case_scenario`
- [ ] tabs B-G read from selected detail source only

### Uncertainty Focus
- [ ] `result.components_most_uncertain` -> `COMPARATIVE/Uncertainty subsection`

### Validation
- [ ] `validation.*` -> `VALIDATION tab + SUMMARY status chip`

---

## C) Visualization Mapping

- [ ] Node size input includes capacity metric
- [ ] Node color input includes utilization metric
- [ ] Edge thickness input includes flow metric
- [ ] Edge color input includes utilization metric
- [ ] Bottleneck highlights from `result.bottlenecks.*`
- [ ] Critical path highlights from `result.critical_paths.*`

---

## D) Export Mapping

- [ ] JSON export includes full normalized entities + metadata + validation
- [ ] CSV export includes flows + recommendations tables
- [ ] PDF export sections follow tab order
- [ ] Clipboard summary contains throughput/utilization/bottleneck/validation

---

## E) Guardrail Checklist

- [ ] No component reads raw backend JSON directly
- [ ] Adapter normalizes interval variants (`{min,max}` and `{lower,upper}`)
- [ ] No pbox branches in v2 code path
- [ ] No midpoint-first substitution for domain values
- [ ] `/capacity-analysis` route preserved at cutover
