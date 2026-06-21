# Flow/Capacity Workbench Rebuild Blueprint

This document defines a ground-up replacement for the current capacity view.

## Why This Rebuild

Current behavior mixes three concerns in one layer:
- path and file selection
- mutable input editing
- domain interpretation of backend output

This creates semantic drift (UI fields no longer match true flow-engine outputs) and makes the experience feel clunky.

## Backend Domain Reality (must stay explicit)

The `/flow-analysis` endpoint already provides a complete engineering-grade payload:
- baseline flow and min-cut: throughput, sink allocations, saturated edges, `S/T` partition
- sensitivity: critical edge drop, marginal capacity, Birnbaum-style scores
- failure impact: single/k-edge failures, degradation scenarios
- structure: SPOF edges/nodes, path set, redundancy, bottleneck ranking
- decomposition: path contributions and bottleneck edges
- parametric thresholds: exact degradation threshold by edge
- cut lattice: representative cut, edges in some/every cut, free-zone enumeration summary
- optional node-capacitated summary

Intentional UI scope boundary for DAG-first product behavior:
- exclude global connectivity views (`lambda`, `kappa`, global min-cut) from primary UI
- reason: these strong-connectivity-style metrics are often not decision-driving for directional DAG flow studies
- backend may still compute/store them, but v3 presentation does not surface them by default

The new UI must present this payload directly, not reinterpret into generic placeholders.

## Proposed Information Architecture

Top level: one workbench with 3 mode lanes.

1. Configure
- scenario source: existing capacities file, or derived ad-hoc draft
- run options: solver, tolerance, `kFailure`, `cutLimit`, `pathLimit`, `maxDepth`, `targetFlow`
- resource metadata (optional but recommended): `resourceType`, `resourceUnit`

2. Explore Results
- Throughput and allocation
- Bottleneck and cut-space
- Failure and sensitivity
- Structure and decomposition
- Threshold and upgrade planning diagnostics

3. Scenario Studio
- apply ad-hoc edits on table and graph:
  - set selected nodes/edges
  - scale selected nodes/edges
- run once without persistence
- optionally "Save as new scenario" to session

## UX Principles

- Single source of truth: strict domain model matching backend keys.
- Progressive disclosure: summary first, diagnostics on demand.
- Always show assumptions: algorithm, tol, target flow, run timestamp.
- Zero fake metrics: do not show placeholders when backend did not provide a measure.
- Compare by question, not by page: each question row compares scenarios across same metric family.
- Keep chapter claim coverage visible in labels/tooltips (throughput, bottleneck structure, perturbation impact, threshold margin, redundancy/SPOF context).

## New Frontend Module Layout

Create isolated module folder:

- `capacity-v3/flow-domain.models.ts`
- `capacity-v3/flow-domain.adapter.ts`
- `capacity-v3/flow-workbench.store.ts`
- `capacity-v3/flow-workbench.service.ts`
- `capacity-v3/components/`
  - `run-config-panel`
  - `scenario-studio-panel`
  - `result-kpi-strip`
  - `cut-lattice-panel`
  - `sensitivity-panel`
  - `failure-impact-panel`
  - `flow-decomposition-panel`
  - `connectivity-panel`
  - `network-edit-graph-panel`

Then mount in one presentation shell route and keep current `capacity-v2` as legacy fallback until parity is reached.

## Interaction Model for Ad-hoc Editing

Editing sources:
- table edits for precise values
- graph-selection edits for quick what-if updates

Patch semantics:
- `set`: overwrite selected node/edge capacities
- `scale`: multiply selected capacities by scalar

Execution semantics:
- draft run: no server file write
- saved run: persist draft as additional scenario in session metadata and optional generated capacity JSON

## Suggested API Additions (minimal)

The existing endpoint is sufficient for draft runs because it accepts `networkPath`, `edgesFilePath`, `capacitiesPath`.
To fully support in-memory ad-hoc edits without writing files, add either:

Option A:
- `/flow-analysis` accepts optional overrides payload:
  - `edgeCapacityOverrides`
  - `nodeCapacityOverrides`
  - `sourceRateOverrides`

Option B:
- new endpoint `/flow-analysis/draft` that accepts full effective capacities map in body.

Either option avoids temporary-file coupling and enables true interactive editing.

## Rollout Plan

Phase 1 (foundation)
- add domain-first models and adapter
- run current endpoint and display only verified core cards

Phase 2 (scenario studio)
- add patch operations and ad-hoc run pipeline
- add save-as-scenario workflow to session

Phase 3 (deep diagnostics)
- add cut-lattice, sensitivity, thresholds, decomposition panels
- add multi-scenario compare by metric families

Phase 4 (retirement)
- migrate route from `capacity-v2` to `capacity-v3`
- keep `capacity-v2` behind `capacity-analysis-legacy`

## Acceptance Criteria

- every rendered metric maps to a specific backend field
- no inferred placeholder values for flow/utilization unless explicitly computed and labeled
- users can run: baseline, ad-hoc modified, and saved scenario variants
- users can compare scenario deltas for throughput, bottlenecks, and failure impact
- route-level replacement does not break existing upload/session workflow
- global connectivity metrics are intentionally absent from default DAG UI panels
