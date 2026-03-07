# PROJECT: Information Propagation Framework - Capacity Analysis Module

## PHASE: 5 (Frontend Implementation)
## STATUS: Phase 1-4 Complete ✅, Phase 5 Execution Plan Locked 🚀
## DATE: March 7, 2026

---

## 1) Purpose

This document is the **implementation-grade execution plan** for replacing the legacy capacity frontend with a clean `capacity-v2` vertical slice while preserving the current app journey.

This plan is grounded in the current codebase baseline:

- Legacy route and view: `src/Network-flow-algos/front-end/inf-prop-ui/apps/info-prop-ui/src/app/app.routes.ts` and `analysis/capacity-analysis/*`
- Upload/session lifecycle: `shared/services/analysis-state.service.ts`
- Existing graph engine to reuse (via adapter): `analysis/network-visualization/network-visualization.component.ts`
- Legacy capacity API service/model surface: `shared/services/capacity-analysis.service.ts`, `shared/models/network-analysis.models.ts`

---

## 2) Current Reality Baseline (What Old View Actually Does)

### 2.1 Legacy Capacity View Characteristics

Current `capacity-analysis` is a large mixed-purpose component that combines:

- Scenario orchestration + per-scenario tab state
- Comparison mode that can replace normal scenario-tab flow
- Mixed value type handling (`number`, `{lower,upper}`, `{mean_lower,mean_upper}`)
- Midpoint conversion (`cleanValue`) as a default numeric fallback
- Capacity + bottleneck + partial advanced details rendered from mixed raw payloads
- Export limited to scenario table snapshots (CSV/JSON), not full Phase 5 report contract

### 2.2 Upload/Session Lifecycle That Must Be Preserved

Current lifecycle in `analysis-state.service.ts`:

1. Upload files
2. Parsed/network data written to session/state
3. Visualization step enables downstream analysis tabs
4. Analysis pages bootstrap from session first, then file-manager fallback

Important behavior to preserve in v2 shell:

- `loadParsedDataFromSession()` first
- If no network in state: `loadNetworkDataFromFileManager()`
- Respect tab-enable sequencing expectations (visualization precedes full analysis enablement)
- Do **not** introduce disconnected bootstrap path that bypasses `AnalysisStateService`

### 2.3 Route Baseline

- Current route path is `/capacity-analysis`
- Current route target is legacy component
- User continuity requires route path to stay unchanged on cutover

---

## 3) Non-Negotiable v2 Design Rules

1. **Strict backend schema only** (Phase 4+ `POST /capacity-analysis` contract).
2. **No p-box branches in v2 UI path**.
3. Scenario means **named case** only.
4. Deterministic vs interval is **analysis type of selected case**, not scenario identity.
5. No component parses raw backend JSON directly.
6. Service adapter normalizes once; store exposes typed entities.
7. UI displays backend values faithfully (formatting only, no hidden reinterpretation).
8. Keep old `capacity-analysis` intact until cutover PR.

---

## 4) Keep / Drop / Add / Improve

## Keep

- Route location `/capacity-analysis`
- Upload/session bootstrap behavior from `AnalysisStateService`
- Multi-scenario capability (secondary to core analysis UX)
- Existing Material/token visual language

## Drop

- Legacy mixed payload assumptions (`mean_*`, pbox leakage)
- Comparison-first toolbar as primary flow
- Midpoint-first narrative for interval outputs
- Dependency on legacy capacity component internals

## Add

- New vertical slice: `analysis/capacity-v2/*` standalone components only
- `capacity-v2.models.ts` strict domain models
- `capacity-v2.service.ts` adapter (accept `number`, `{min,max}`, `{lower,upper}` at boundary)
- `capacity-v2.store.ts` signal store (`inputs`, `runState`, `scenarioEntities`, `activeScenarioId`, `comparisonSelection`, `uiPrefs`)
- Fixed tab contract:
  - `SUMMARY`
  - `BOTTLENECK ANALYSIS`
  - `UPGRADE PRIORITIES`
  - `CRITICAL PATHS`
  - `COMPARATIVE ANALYSIS`
  - `FLOW DISTRIBUTION`
  - `VALIDATION`
- Export suite: JSON / CSV / PDF / clipboard summary

## Improve

- Domain-expert wording around engineering decisions
- Explicit interval uncertainty communication (range + worst/best case labels)
- Visualization signal-to-noise (highlight modes, bottleneck/critical-path emphasis)
- Validation UX prominence and diagnostics

---

## 5) Target Architecture (Clean-Slate v2)

```text
analysis/capacity-v2/
├── capacity-v2-shell/
├── capacity-v2-input/
├── capacity-v2-summary/
├── capacity-v2-tabs/
├── capacity-v2-viz/
├── capacity-v2-export/
├── capacity-v2.service.ts
├── capacity-v2.store.ts
└── capacity-v2.models.ts
```

### 5.1 Data Flow

`Input Form -> Validate -> API Service -> Normalize Adapter -> Store Entities -> Render Summary/Tabs/Viz/Export`

### 5.2 Separation Rules

- Components consume `store` selectors/signals only
- Adapter owns backend decoding and normalization
- Formatting helpers allowed in components; business transforms are not

---

## 6) Upload/Session Integration Contract (Exact)

`capacity-v2-shell` initialization sequence:

1. `analysisState.loadParsedDataFromSession()`
2. if no network data available: `analysisState.loadNetworkDataFromFileManager()`
3. initialize v2 store defaults from available network + parsed capacity groups
4. hydrate selected scenario/case
5. keep compatibility with visualization-first lifecycle assumptions

Guardrails:

- v2 must not bypass `AnalysisStateService`
- v2 must tolerate direct navigation to `/capacity-analysis` with session already present
- v2 must handle empty state with clear upload guidance

---

## 7) Strict Data Contract + Adapter Normalization

## Request Types

### Deterministic request

- `node_capacities: Record<string, number>`
- `edge_capacities: Record<string, number>`
- `source_rates: Record<string, number>`

### Interval request

- `node_capacities: Record<string, {min,max} | {lower,upper}>`
- `edge_capacities: Record<string, {min,max} | {lower,upper}>`
- `source_rates: Record<string, {min,max} | {lower,upper}>`

## Normalization Rules

- Normalize all interval-like values to one internal shape in adapter: `{ min: number; max: number }`
- Never pass raw `{lower,upper}` or `{mean_lower,mean_upper}` beyond adapter
- No midpoint conversion for domain values; midpoint may be shown only as a secondary derived display field

## Response Handling

- Deterministic path uses `result.*` deterministic fields
- Interval path uses top-level interval metrics and scenario detail entities (`worst_case_scenario`, `best_case_scenario`)
- Validation is first-class entity and surfaced in header + validation tab

---

## 8) Field-to-Widget Mapping (Hard Contract)

## Deterministic

- `result.total_max_flow` -> SUMMARY throughput KPI
- `result.network_utilization` -> SUMMARY utilization KPI
- `result.metadata.computation_time_ms` -> SUMMARY computation KPI
- `result.bottlenecks.*` -> BOTTLENECK ANALYSIS + viz highlight sets
- `result.upgrade_priorities.*` -> UPGRADE PRIORITIES tables + summary
- `result.critical_paths.*` -> CRITICAL PATHS tab
- `result.comparative_analysis.*` -> COMPARATIVE ANALYSIS tab
- `result.node_flows`, `result.edge_flows` -> FLOW DISTRIBUTION tab
- `validation.*` -> VALIDATION tab + header status chip

## Interval

- `result.guaranteed_min_flow`, `result.possible_max_flow` -> SUMMARY throughput range
- `result.expected_flow`, `result.uncertainty_range` -> SUMMARY uncertainty card
- `result.worst_case_scenario` -> default detailed source for tabs B-G
- optional detail toggle: `worst_case_scenario` / `best_case_scenario`
- `result.components_most_uncertain` -> COMPARATIVE/uncertainty subsection
- `validation.*` -> VALIDATION tab + status chip

---

## 9) Exact UI Contract (Phase 5)

## Left Sidebar: Input Panel

- Network file dropdown
- Analysis type toggle (Deterministic / Interval)
- Editable tables:
  - node capacities
  - edge capacities
  - source rates
- Target node multiselect
- Options checkboxes:
  - compute all min-cuts
  - enumerate critical paths
  - compute upgrade priorities
  - include classical comparison
- Verbosity selector
- Run button + spinner + inline validation feedback

## Main Panel: Tab Order (Fixed)

1. `SUMMARY`
2. `BOTTLENECK ANALYSIS`
3. `UPGRADE PRIORITIES`
4. `CRITICAL PATHS`
5. `COMPARATIVE ANALYSIS`
6. `FLOW DISTRIBUTION`
7. `VALIDATION`

Each tab binds to normalized entities only.

## Right Panel: Visualization

- Node size by capacity
- Node color by utilization
- Edge thickness by flow
- Edge color by utilization
- Bottlenecks highlighted red
- Critical paths highlighted blue
- Hover details
- Click node -> connected-edge emphasis
- Highlight mode selector: Bottlenecks / Saturated / Critical Paths / All / None
- Zoom/pan controls

---

## 10) Visualization Reuse Strategy

Reuse existing graph engine patterns from `network-visualization.component.ts` via adapter inputs.

Do not fork graph logic into ad-hoc capacity-only renderer unless required.

Adapter-to-viz input model:

- nodes: id, capacity, utilization, highlight flags
- edges: from, to, flow, capacity, utilization, highlight flags
- interaction state: selectedNodeId, highlightMode
- styling references: token-driven CSS variables (no hardcoded palette extensions)

---

## 11) Export Contract

1. **Export JSON**: full normalized payload + metadata + validation
2. **Export CSV**: tabular slices (node/edge flows, upgrade recommendations)
3. **Generate PDF Report**: sectioned to match tabs
4. **Copy Summary**: concise KPI + key bottleneck + recommendation + validation outcome

---

## 12) Theme, Material, Accessibility Rules

- Use existing app tokens from `app.scss` (`var(--surface-*)`, `var(--on-*)`, `var(--primary)`, etc.)
- No hardcoded new palette families
- Prefer Angular Material primitives (`mat-card`, `mat-tab-group`, `mat-table`, `mat-chip`, `mat-progress-bar`, etc.)
- Ensure dark/light consistency without per-component hacks
- Keep responsive desktop/tablet behavior

---

## 13) Execution Plan (Stage-by-Stage)

### Stage 0 — Contract Lock (No UI edits)

- Create `capacity-v2.models.ts` (strict types)
- Create `capacity-v2.mapping.md` (field -> widget matrix from Section 8)
- Define rule: no component reads raw backend objects

### Stage 1 — Shell + Route Scaffolding

- Scaffold `capacity-v2` standalone component tree
- Add temporary route for v2 (without replacing existing `/capacity-analysis` yet)
- Build shell layout (left input / main tabs / right viz + export area)

### Stage 2 — Service + Store Foundation

- Implement `capacity-v2.service.ts` with strict adapter normalization
- Implement `capacity-v2.store.ts` signal state and run lifecycle (`idle/running/success/error`)
- Wire deterministic + interval request builders

### Stage 3 — Input + Run Workflow

- Implement input controls and validations
- Hydrate defaults from session-derived parsed data
- Run analysis action wired to store/service with loading and error states

### Stage 4 — Results Tabs

- Implement all seven tabs in fixed order
- Bind each widget to normalized entity selectors
- Add guards for absent optional sections

### Stage 5 — Visualization + Export

- Connect normalized graph data to visualization adapter
- Implement highlight modes and node/edge interactions
- Implement JSON/CSV/PDF/clipboard export contract

### Stage 6 — Cutover

- Switch `/capacity-analysis` route target to `capacity-v2-shell`
- Keep temporary legacy fallback route for short acceptance window
- Remove fallback after sign-off

### Stage 7 — Verification

- Build: `nx build info-prop-ui`
- Smoke tests: deterministic + interval water scenarios
- Verify value parity against known backend responses:
  - deterministic max flow `26.18`
  - interval range `15.078 - 21.420`

---

## 14) Testing Plan

## Unit

- adapter normalization (`number`, `{min,max}`, `{lower,upper}`)
- request generation deterministic vs interval
- store transitions (`idle -> running -> success/error`)
- tab guards with missing optional fields

## Integration

- API payload conformance to `/capacity-analysis`
- normalized entity population for deterministic + interval responses
- export content validity (JSON/CSV/PDF)

## E2E

- upload -> visualization -> capacity-v2 bootstrap
- deterministic run -> all tabs populated
- interval run -> range + worst/best detail mode works
- viz highlight modes + interaction sanity

---

## 15) Hard Acceptance Gates (Definition of Done)

- All required controls visible and functional
- All seven tabs populated from real backend data
- No pbox branch in v2 code path
- Deterministic + interval work end-to-end on water scenarios
- Export outputs valid JSON/CSV/PDF and clipboard summary
- Dark/light token-consistent, no hardcoded palette hacks
- `/capacity-analysis` cutover preserves upload -> visualization -> analysis journey
- Displayed values match backend response values exactly

---

## 16) Risks and Mitigations

1. **Risk**: lifecycle mismatch breaks tab availability
   - **Mitigation**: shell starts with `loadParsedDataFromSession()` then fallback `loadNetworkDataFromFileManager()` and respects visualization gate assumptions

2. **Risk**: legacy assumptions leak into v2 entities
   - **Mitigation**: strict adapter boundary + dedicated v2 models, no legacy model extension

3. **Risk**: interval interpretation confusion
   - **Mitigation**: explicit range-first KPIs + worst/best case labels + uncertainty subsection

4. **Risk**: cutover regression
   - **Mitigation**: single cutover PR with temporary fallback route + smoke evidence

---

## 17) Immediate Next Actions (Execution Start)

1. Scaffold `analysis/capacity-v2` standalone components and route stub.
2. Implement `capacity-v2.models.ts` + `capacity-v2.service.ts` adapter + `capacity-v2.store.ts`.
3. Add `capacity-v2.mapping.md` as field-level acceptance checklist.
4. Implement tabs and labels exactly as Section 9.
5. Run build + smoke tests and capture acceptance screenshots for cutover PR.
