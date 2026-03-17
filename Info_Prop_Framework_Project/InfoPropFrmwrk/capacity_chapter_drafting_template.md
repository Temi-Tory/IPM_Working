# Capacity Methodology Chapter — Drafting Template (Offline)

Use this file as your writing canvas.
For each paragraph:
- Fill the `Draft text` block.
- Keep the `Required claim` and `Required qualifier` intact in meaning.
- Add citations listed in `Cite`.

Primary support files:
- `capacity_chapter_structure.md`
- `capacity_claim_evidence_matrix.md`
- `capacity_methodology_master_document.md`
- `capacity_examiner_risk_checklist.md`

---

## Section 1 — Introduction to Capacity-Based Reliability

### 1.1 Motivation paragraph

**Required claim:** Capacity reliability captures degradation beyond binary connected/disconnected framing.
**Required qualifier:** This chapter is deterministic and structural.
**Cite:** reliability framing sources + your internal scope statement.

**Draft text:**


### 1.2 Engineering questions paragraph

**Required claim:** Chapter is organized around throughput, bottlenecks, failure modes, resilience, redundancy, importance, SPOF.
**Required qualifier:** Question-driven analysis pipeline.
**Cite:** internal module mapping (no external citation required unless preferred).

**Draft text:**


### 1.3 Roadmap paragraph

**Required claim:** One-sentence roadmap for Sections 2–9.
**Required qualifier:** None.
**Cite:** none.

**Draft text:**


---

## Section 2 — Mathematical Model

### 2.1 Flow network definition paragraph

**Required claim:** Directed capacitated graph model with conservation constraints and DAG upstream invariant.
**Required qualifier:** DAG assumed from preprocessing layer.
**Cite:** Ahuja et al. (or equivalent foundational flow text).

**Draft text:**


### 2.2 Max-flow problem paragraph

**Required claim:** Throughput computed as deterministic max-flow optimization.
**Required qualifier:** Multi-source/multi-sink reduced exactly via super-nodes.
**Cite:** Ford-Fulkerson framework.

**Draft text:**


### 2.3 Max-flow/min-cut theorem paragraph + theorem block

**Required claim:** Max-flow equals min-cut capacity; this is central chapter theorem.
**Required qualifier:** theorem-to-validation link stated.
**Cite:** Ford & Fulkerson (1956).

**Draft text (lead-in):**


**Theorem block (insert final notation style):**


**Draft text (interpretation):**


### 2.4 Auxiliary theorems paragraph

**Required claim:** Menger edge/node, min-cut family structure, node-splitting, and flow decomposition support downstream analyses.
**Required qualifier:** Keep each theorem tied to one downstream analysis use.
**Cite:** Menger; Whitney (if used); Picard–Queyranne; decomposition source.

**Draft text:**


---

## Section 3 — Algorithms

### 3.1 Residual framework paragraph

**Required claim:** Residual graph + augmenting logic underpins solver family.
**Required qualifier:** Shared framework, different update strategies.
**Cite:** standard max-flow algorithm references.

**Draft text:**


### 3.2 Implemented algorithms paragraph

**Required claim:** Edmonds–Karp, Dinic (default), push-relabel are implemented.
**Required qualifier:** Default ≠ universal runtime superiority claim.
**Cite:** Edmonds-Karp; Dinic; Goldberg-Tarjan.

**Draft text:**


### 3.3 Multi-source/multi-sink reduction paragraph

**Required claim:** Exact super-source/super-sink augmentation.
**Required qualifier:** include implementation guard note briefly if desired.
**Cite:** flow reduction convention / implementation reference.

**Draft text:**


### 3.4 Directed global min-cut paragraph

**Required claim:** Directed global min-cut solved by repeated exact pairwise solves.
**Required qualifier:** exact but repeated-solve cost acknowledged.
**Cite:** Hao & Orlin (1994).

**Draft text:**


---

## Section 4 — Derived Analyses

### 4.1 Sensitivity paragraph

**Required claim:** Sensitivity metrics quantify throughput response to capacity perturbations.
**Required qualifier (MANDATORY):** exact on evaluated candidates; candidate pruning limits global exhaustiveness.
**Cite:** internal method definition + parametric-flow context where relevant.

**Draft text:**


### 4.2 Failure impact paragraph

**Required claim:** Single-edge and k-edge perturb-and-resolve impacts are computed exactly per tested scenario.
**Required qualifier (MANDATORY):** candidate and combination limits define scope.
**Cite:** internal methodology + solver exactness statement.

**Draft text:**


### 4.3 SPOF paragraph

**Required claim:** SPOFs derived from structural cut/reachability logic.
**Required qualifier:** distinguish edge and node SPOF definitions.
**Cite:** cut structure references + internal module mapping.

**Draft text:**


### 4.4 Path-based analysis paragraph

**Required claim:** Distinguish structural path enumeration from additive flow decomposition.
**Required qualifier:** only decomposition is additive reconstruction of solved flow.
**Cite:** decomposition theorem/source.

**Draft text:**


### 4.5 Threshold + node-capacitated paragraph

**Required claim:** Thresholds obtained from monotone piecewise max-flow behavior; node capacities handled via splitting.
**Required qualifier:** threshold interpretation tied to target-throughput event.
**Cite:** Gallo et al. (1989) + node-splitting reference.

**Draft text:**


### 4.6 Min-cut enumeration + global connectivity paragraph

**Required claim:** Min-cut family and connectivity metrics provide structural redundancy and vulnerability views.
**Required qualifier:** enumeration completeness bounded by explicit limits when applicable.
**Cite:** Picard–Queyranne + connectivity theorem context.

**Draft text:**


---

## Section 5 — Exactness and Validation

### 5.1 Exactness definition paragraph

**Required claim:** Exactness means deterministic solved-instance optimality.
**Required qualifier:** tolerance is for floating-point equality checks only.
**Cite:** internal exactness definition.

**Draft text:**


### 5.2 Scope qualifiers paragraph

**Required claim:** Explicitly delimit non-exhaustive candidate-pruned analyses and out-of-scope uncertainty/dynamics.
**Required qualifier (MANDATORY):** not probabilistic, not dynamic, no uncertainty propagation in this layer.
**Cite:** internal scope definition.

**Draft text:**


---

## Section 6 — Reliability Engineering Context

### 6.1 Structural vs probabilistic paragraph

**Required claim:** This chapter provides structural pre-probabilistic groundwork.
**Required qualifier:** probabilistic propagation deferred to next chapter(s).
**Cite:** reliability methodology references.

**Draft text:**


### 6.2 Birnbaum analogy paragraph

**Required claim:** Throughput sensitivity is analogous to Birnbaum-style component importance.
**Required qualifier:** analogy, not probabilistic equivalence.
**Cite:** Birnbaum (1969) chapter reference.

**Draft text:**


### 6.3 Failure-mode and margin paragraph

**Required claim:** Min-cuts map to structural failure modes; thresholds define deterministic degradation margins.
**Required qualifier:** distinguish zero-flow events vs threshold events.
**Cite:** max-flow/min-cut + threshold analysis references.

**Draft text:**


---

## Section 7 — Computational Complexity

### 7.1 Complexity paragraph

**Required claim:** total workload = per-solve complexity × number of required solves.
**Required qualifier:** repeated-solve analyses dominate cost.
**Cite:** algorithm complexity references + internal complexity table.

**Draft text:**


### 7.2 Complexity table placeholder

**Insert your finalized complexity table here.**


---

## Section 8 — Implementation and Software Notes

### 8.1 Julia implementation paragraph

**Required claim:** implementation uses typed, integration-oriented data structures aligned with pipeline needs.
**Required qualifier:** architecture rationale is integration and traceability.
**Cite:** internal implementation notes.

**Draft text:**


### 8.2 Package comparison paragraph

**Required claim:** contribution is end-to-end reliability analysis integration beyond standalone max-flow calls.
**Required qualifier (MANDATORY):** no unbenchmarked blanket performance superiority claim.
**Cite:** package comparison section in master doc.

**Draft text:**


---

## Section 9 — Summary

### 9.1 Summary paragraph

**Required claim:** chapter establishes deterministic structural capacity methodology and prepares probabilistic follow-on chapter.
**Required qualifier:** summary introduces no new technical claims.
**Cite:** usually none; optional recap citation.

**Draft text:**


---

## Final pass checklist (run before freeze)

- [ ] Every paragraph maps to `capacity_claim_evidence_matrix.md`.
- [ ] All mandatory qualifiers included where flagged.
- [ ] Citation placeholders removed.
- [ ] `capacity_examiner_risk_checklist.md` all PASS.
