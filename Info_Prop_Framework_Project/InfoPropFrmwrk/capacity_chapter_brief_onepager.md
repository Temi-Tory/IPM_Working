# Capacity Methodology Chapter Brief (One Page)

Objective: write a complete, defensible methodology chapter offline, with no additional online lookup.

Primary input files:
- `capacity_chapter_structure.md`
- `capacity_methodology_master_document.md`
- `capacity_methodology_research_pack_verified.md`
- `capacity_claim_evidence_matrix.md`
- `capacity_examiner_risk_checklist.md`

---

## 1) Chapter mission (what this chapter must establish)

- Define the deterministic capacitated network model used in this thesis.
- Establish max-flow/min-cut as the core theoretical and computational backbone.
- Present derived analyses (sensitivity, failure impact, SPOF, thresholds, connectivity) with precise scope qualifiers.
- Position this chapter as a structural pre-probabilistic layer for later uncertainty modelling.

## 2) Non-negotiable theorem/core blocks

- Max-flow/min-cut theorem (central theorem block).
- Integrality (for integer/unit-capacity interpretations).
- Menger edge/node results (redundancy/connectivity interpretation).
- Node-splitting equivalence (node capacities).
- Parametric-flow monotone piecewise behavior (threshold analyses).

## 3) Required implementation qualifiers

- “Exact” = exact deterministic optimum for solved instance (with floating-point tolerance checks).
- Sensitivity/failure perturbation analyses may be candidate-pruned; exactness is on evaluated candidates unless full-space evaluation is done.
- Dinic default is an implementation choice, not universal performance superiority.
- Package comparison claims integration breadth, not benchmark-free runtime dominance.

## 4) Target structure and writing budget

- Section 1 Intro: 3 paragraphs.
- Section 2 Mathematical model/theorems: 4 paragraphs + theorem block.
- Section 3 Algorithms: 3–4 paragraphs.
- Section 4 Derived analyses: 5–6 paragraphs.
- Section 5 Exactness/validation: 2 paragraphs.
- Section 6 Reliability context: 2–3 paragraphs.
- Section 7 Complexity: 1 paragraph + table.
- Section 8 Implementation notes: 2 paragraphs.
- Section 9 Summary: 1 paragraph.

(Use your existing chapter structure file as the exact sequencing authority.)

## 5) Recommended write order (to avoid stalls)

1. Write Section 2.3 (max-flow/min-cut theorem framing) first.
2. Write Section 5 (exactness + qualifiers) second.
3. Draft Section 4 analyses with qualifiers embedded while writing.
4. Draft Section 6 reliability-positioning paragraphs.
5. Fill Section 3 algorithms and Section 8 implementation notes.
6. Write Section 1 intro and Section 9 summary last.

## 6) Done criteria (chapter is “offline-complete”)

- Every substantive claim maps to an entry in `capacity_claim_evidence_matrix.md`.
- Every checklist item in `capacity_examiner_risk_checklist.md` passes.
- No unresolved citation placeholders remain.
- Summary introduces no new technical claims not already evidenced in body text.

---

## One-sentence chapter thesis (use/adapt)

This chapter establishes an exact deterministic flow-capacity methodology for infrastructure reliability assessment, where throughput, bottlenecks, and structural failure sensitivities are computed via validated max-flow/min-cut analyses and passed forward as the structural basis for subsequent probabilistic modelling.
