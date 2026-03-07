# Capacity v2 Frontend Migration Plan (Phase 5 Execution)

**Project**: Information Propagation Framework  
**Scope**: Capacity Analysis Frontend (`capacity-v2`)  
**Date**: March 7, 2026  
**Status**: Planning baseline approved for implementation

---

## 1) Purpose

Define an implementation-ready migration plan from the existing capacity analysis UI to a clean `capacity-v2` vertical slice that:

1. Preserves the real upload/session workflow already used by the app.
2. Uses **only** Phase 4+ backend contract (`POST /capacity-analysis`).
3. Presents Phase 1-4 outputs exactly (deterministic + interval + advanced analysis) in a domain-expert-first UI.
4. Keeps old `capacity-analysis` untouched until cutover, then switches route in one PR.

---

## 2) Current Baseline (What Exists Today)

### 2.1 Legacy Capacity View Characteristics

Current `capacity-analysis` view is large and mixed-purpose:

- Strong scenario-toolbar and comparison-mode workflow.
- Legacy mixed value handling (`lower/upper`, `mean_lower/mean_upper`, midpoint rendering).
- Multi-state tab model with summary + per-scenario tabs.
- Export JSON/CSV present, but tied to legacy display structures.

### 2.2 App Upload/Session Flow (Must Preserve)

The app flow is:

1. Upload network/files
2. Parse data and persist in session
3. Visualization step enables analysis tabs
4. Analysis views load from session and/or file manager fallback

`capacity-v2` must plug into this lifecycle (no custom disconnected bootstrap).

---

## 3) Core Design Rules (Non-Negotiable)

1. **Strict backend schema only** (Phase 4 contract).
2. **No p-box branches** in v2 path.
3. Scenario means **named case** only.
4. Deterministic vs interval is **analysis type of the selected case**.
5. Components never parse raw backend JSON directly.
6. Adapter/service normalizes payload once, store exposes typed entities.
7. UI must display real backend values (formatting only, no hidden reinterpretation).

---

## 4) Keep / Drop / Add / Improve

## Keep

- Route location and user navigation expectation at `/capacity-analysis`.
- Session + analysis-state bootstrap behavior.
- Multi-scenario support (secondary feature).
- Existing theme token system and Angular Material style language.

## Drop

- Legacy payload assumptions and mixed old formats beyond adapter boundary.
- Scenario/comparison-first UX that replaces core capacity analysis workflow.
- Midpoint-first interpretation as default for interval output.
- Legacy component internals as dependencies for v2.

## Add

- Dedicated `capacity-v2.models.ts` strict domain models.
- `capacity-v2` adapter that accepts:
  - deterministic number values
  - interval `{min,max}` and normalized `{lower,upper}`
- Fixed Phase 5 tab structure and naming:
  - `SUMMARY`
  - `BOTTLENECK ANALYSIS`
  - `UPGRADE PRIORITIES`
  - `CRITICAL PATHS`
  - `COMPARATIVE ANALYSIS`
  - `FLOW DISTRIBUTION`
  - `VALIDATION`
- Export contract: JSON / CSV / PDF / clipboard summary.

## Improve

- Domain wording around expert questions.
- Validation visibility and error UX.
- Visualization signal-to-noise (highlight modes, bottleneck and critical path emphasis).
- Deterministic and interval parity in all result tabs.

---

## 5) Target `capacity-v2` Architecture

```text
analysis/capacity-v2/
├── capacity-v2-shell
├── capacity-v2-input
├── capacity-v2-summary
├── capacity-v2-tabs
├── capacity-v2-viz
├── capacity-v2-export
├── capacity-v2.service         (API + normalization)
├── capacity-v2.store           (signal state, entities, run state)
└── capacity-v2.models          (strict typed contract)
```

### 5.1 State and Data Flow

`Input Form -> Validate -> Service Call -> Normalize -> Store Entities -> Render Tabs/Viz/Export`

No tab/component should deserialize backend objects.

### 5.2 Route Strategy

- Build v2 while legacy stays intact.
- Cutover PR:
  - switch `/capacity-analysis` to `capacity-v2-shell`
  - keep temporary fallback route to legacy (short-lived)
  - remove fallback after acceptance

---

## 6) Upload/Session Integration Plan

`capacity-v2-shell` startup sequence:

1. `analysisState.loadParsedDataFromSession()`
2. if no network data: `analysisState.loadNetworkDataFromFileManager()`
3. initialize v2 store with available network + defaults
4. hydrate inputs from selected case

This preserves existing app behavior from upload through analysis pages.

---

## 7) Exact UI Contract for Phase 5

## Left Sidebar: Input Panel

- Network file dropdown
- Analysis type toggle (deterministic / interval)
- Editable capacity tables:
  - node capacities
  - edge capacities
  - source rates
- Target node multiselect
- Options checkboxes:
  - compute all min-cuts
  - enumerate critical paths
  - compute upgrade priorities
  - include classical comparison
- Verbosity dropdown
- Run Analysis button + loading spinner

## Main Panel: Results Tabs

### Tab A: SUMMARY
- Max Flow (or interval range)
- Network Utilization
- Computation Time
- Validation status (all checks passed / issues)

### Tab B: BOTTLENECK ANALYSIS
- Min-cut capacity
- Bottleneck type badge
- Saturated edges/nodes list
- Near-saturated list
- Spare capacity metrics

### Tab C: UPGRADE PRIORITIES
- Edge recommendations table
- Node recommendations table
- Strategic summary text

### Tab D: CRITICAL PATHS
- Path list (nodes, capacity, flow)
- Redundancy counts
- Single points of failure

### Tab E: COMPARATIVE ANALYSIS
- Realistic vs Classical max flow
- Efficiency loss %
- Primary limitation
- Strategic recommendation

### Tab F: FLOW DISTRIBUTION
- Node flows table + utilization bars
- Edge flows table + utilization bars

### Tab G: VALIDATION
- Flow conservation + max error
- Capacity constraints
- Optimality check
- Interval bounds consistency
- warnings/errors block

## Right Panel: Visualization

- Node size by capacity
- Node color by utilization
- Edge thickness by flow
- Edge color by utilization
- Bottlenecks highlighted red
- Critical paths highlighted blue
- Hover details
- Click node -> connected-edge emphasis
- Highlight mode selector
- Zoom/pan controls

---

## 8) Field-to-Widget Mapping Rules

## Deterministic

- `result.total_max_flow` -> Summary throughput
- `result.network_utilization` -> Summary utilization
- `result.metadata.computation_time_ms` -> Summary computation time
- `result.bottlenecks.*` -> Bottleneck tab + viz highlights
- `result.upgrade_priorities.*` -> Upgrade tab
- `result.critical_paths.*` -> Critical paths tab
- `result.comparative_analysis.*` -> Comparative tab
- `result.node_flows`, `result.edge_flows` -> Flow distribution tab
- `validation.*` -> Validation tab and status chip

## Interval

- `result.guaranteed_min_flow`, `result.possible_max_flow` -> Summary throughput range
- `result.expected_flow`, `result.uncertainty_range` -> Summary detail card
- `result.worst_case_scenario` as default detail source for tabs B-G
- optional toggle to inspect `best_case_scenario` in detail tabs
- `result.components_most_uncertain` -> Comparative/uncertainty subsection
- `validation.*` -> Validation tab/status

---

## 9) Implementation Phases (Execution Order)

### Phase A — Foundation
1. Scaffold v2 components and route wiring (no cutover).
2. Add strict models and service normalization.
3. Implement signal store and run-state lifecycle.

### Phase B — Input + Run
4. Build full input panel and validation.
5. Wire run workflow to backend.
6. Handle deterministic + interval request generation.

### Phase C — Results + Viz
7. Implement seven tabs with direct field mapping.
8. Integrate visualization and highlight modes.
9. Add loading/error/empty states.

### Phase D — Export + Cutover
10. Implement JSON, CSV, PDF, clipboard export.
11. Route cutover to `/capacity-analysis`.
12. Keep temporary legacy fallback route.

### Phase E — Verification
13. Build check (`nx build info-prop-ui`).
14. Smoke test deterministic and interval water scenarios.
15. Validate displayed values against backend payload examples.

---

## 10) Test Plan

## Unit
- service normalization (deterministic + interval formats)
- store transitions (idle/running/success/error)
- input validation rules
- tab rendering guards when sections are absent

## Integration
- run request payload conformance to API contract
- response normalization and store entity population
- export generation content checks

## E2E
- upload/network session handoff to capacity-v2
- deterministic run -> all tabs data present
- interval run -> range + worst/best detail behavior
- visualization highlight modes + interaction sanity

---

## 11) Risks and Mitigations

1. **Risk**: Session bootstrap mismatch with existing app flow.  
   **Mitigation**: preserve analysis-state bootstrap sequence in shell.

2. **Risk**: Hidden legacy assumptions leak into v2.  
   **Mitigation**: adapter-only normalization and strict model typing.

3. **Risk**: Interval UX confusion.  
   **Mitigation**: explicit range KPIs + worst/best case labeling.

4. **Risk**: Cutover regression.  
   **Mitigation**: one cutover PR with temporary fallback route.

---

## 12) Definition of Done

- No dependency on legacy capacity internals.
- No pbox branches in v2 path.
- End-to-end working deterministic + interval for water scenarios.
- All required Phase 5 controls/tabs/viz/export features present.
- Displayed results match backend payload values.
- Responsive and token-driven (dark/light consistent).
- Ready for ESREL 2026 demo.

---

## 13) Immediate Next Actions

1. Implement a field-mapping checklist in v2 code comments/tests.
2. Complete tab structure and labels exactly as in Section 7.
3. Re-run build and scenario smoke tests.
4. Prepare cutover PR with acceptance evidence screenshots.
