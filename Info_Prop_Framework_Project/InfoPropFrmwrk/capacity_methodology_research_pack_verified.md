# Capacity Methodology Research Pack (Verified + Code-Aligned)

Purpose: chapter-writing pack aligned to `capacity_chapter_structure.md`, grounded in actual implementation behavior and externally verifiable references.

---

## 1) What is now verified

- Core max-flow literature metadata has been verified via Crossref/DOI records.
- Previously ambiguous citation resolved: Hao–Orlin directed min-cut is DOI `10.1006/jagm.1994.1043`.
- Picard–Queyranne entry corrected to DOI `10.1002/net.3230120206`.
- Master reference file updated accordingly.

---

## 2) Implementation-grounded claims you can state safely

### 2.1 Exactness scope

Safe claim:
- The framework computes exact deterministic max-flow/min-cut quantities for each solved instance (subject to floating-point tolerance checks), and validates capacity feasibility, flow conservation, and max-flow/min-cut equality post-solve.

Code-grounding:
- `FlowModule.jl` validation pipeline (`validate_capacity_constraints`, `validate_flow_conservation`, `validate_maxflow_mincut`).

### 2.2 Multi-source / multi-sink reduction

Safe claim:
- Multi-source and multi-sink analyses are reduced exactly to a single-source/single-sink max-flow instance via super-source/super-sink augmentation.

Code-grounding:
- `FlowModule.jl` augmented network construction and solve path.

### 2.3 Node-capacitated extension

Safe claim:
- Node-capacitated flow is handled by exact node splitting, preserving objective value and feasibility correspondence.

Code-grounding:
- `NodeCapacitatedFlowModule.jl` split mapping and reconstruction checks (with overflow/collision guards).

### 2.4 Sensitivity / failure analyses (important qualifier)

Safe claim:
- Perturbation results are exact for each evaluated scenario, but candidate-set pruning means some analyses are exact over evaluated candidates rather than globally exhaustive over all edges/subsets.

Code-grounding:
- `SensitivityModule.jl` candidate construction from min-cut-related sets.
- `FailureImpactModule.jl` bounded combination enumeration and candidate filtering behavior.

### 2.5 Min-cut family handling

Safe claim:
- Minimum-cut family reasoning uses residual reachability/lattice-style characterizations; enumeration is exact up to explicit cut-limit truncation controls.

Code-grounding:
- `MinCutUtilitiesModule.jl` free-zone logic, large-zone truncation metadata.

### 2.6 Global connectivity

Safe claim:
- Global connectivity outputs are computed from repeated exact flow solves with integral-value checks under unit-capacity constructions.

Code-grounding:
- `GlobalConnectivityModule.jl` integer checks and super-node guard handling.

---

## 3) Section-by-section writing anchors (mapped to chapter structure)

### Section 1 (Introduction)

Use:
- Capacity reliability complements binary reliability by quantifying performance degradation, not only success/failure state.
- Deterministic structural analysis is positioned as pre-probabilistic scaffolding for later uncertainty propagation.

### Section 2 (Mathematical model)

Use:
- Formal directed capacitated network model, conservation constraints, and max-flow optimization problem.
- Max-flow/min-cut theorem as central theorem statement.
- Integrality, Menger edge/node forms, node-splitting equivalence, and flow decomposition theorem as supporting theory.

### Section 3 (Algorithms)

Use:
- Residual-graph framework + augmenting-path logic.
- Implemented algorithm family: Edmonds–Karp, Dinic (default), push-relabel.
- Keep wording neutral: default choice is an implementation decision, not a universal runtime superiority claim.

### Section 4 (Derived analyses)

Use:
- Sensitivity, failure impact, SPOF, decomposition, parametric thresholds, min-cut enumeration, global connectivity.
- Explicitly include candidate-set scope qualifier in sensitivity/failure sections.

### Section 5 (Exactness and validation)

Use:
- Exactness claim + explicit post-solve checks.
- Scope boundaries (pruning, no probabilistic propagation, no dynamic capacities).

### Section 6 (Reliability context)

Use:
- Structural-preprobabilistic role.
- Birnbaum analogy as a structural sensitivity analogue (not probabilistic equivalence).
- Minimum cuts as structural failure-mode carriers.

### Section 7 (Complexity)

Use:
- Complexity as per-solve complexity multiplied by number of repeated solves for derived analyses.
- Global min-cut and combinatorial perturbation analyses highlighted as repeated-solve dominant.

### Section 8 (Implementation notes)

Use:
- Julia data-model and typed results as integration rationale.
- Comparison wording: value is pipeline integration and reliability-focused downstream analyses.

### Section 9 (Summary)

Use:
- Deterministic structural layer established; probabilistic chapter consumes these outputs next.

---

## 4) Verified citation bank (chapter-critical)

1. Ford, L.R., Fulkerson, D.R. (1956). *Canadian Journal of Mathematics* 8:399–404. DOI: `10.4153/CJM-1956-045-5`.
2. Edmonds, J., Karp, R.M. (1972). *Journal of the ACM* 19(2):248–264. DOI: `10.1145/321694.321699`.
3. Goldberg, A.V., Tarjan, R.E. (1988). *Journal of the ACM* 35(4):921–940. DOI: `10.1145/48014.61051`.
4. Gallo, G., Grigoriadis, M.D., Tarjan, R.E. (1989). *SIAM Journal on Computing* 18(1):30–55. DOI: `10.1137/0218003`.
5. Menger, K. (1927). *Fundamenta Mathematicae* 10:96–115. DOI: `10.4064/fm-10-1-96-115`.
6. Whitney, H. (1932). *American Journal of Mathematics* 54(1):150–168. DOI: `10.2307/2371086`.
7. Hao, J.X., Orlin, J.B. (1994). *Journal of Algorithms* 17(3):424–446. DOI: `10.1006/jagm.1994.1043`.
8. Picard, J.-C., Queyranne, M. (1982). *Networks* 12(2):141–159. DOI: `10.1002/net.3230120206`.

---

## 5) Items to handle with care in prose

- Dinic citation details can vary by translation venue/year formatting; use your established thesis style consistently and avoid over-specific bibliographic claims unless your library source is fixed.
- Birnbaum original text is commonly cited as the 1969 chapter; DOI-grade metadata is often unavailable in standard index feeds. Keep the citation as chapter/book format in thesis style.
- For sensitivity/failure sections, avoid the word “exhaustive” unless you run full candidate-space evaluation.

---

## 6) Ready-to-use examiner-safe sentence templates

- “All reported flow values are exact deterministic optima for the solved network instances, with post-solve primal-feasibility and max-flow/min-cut consistency checks.”
- “Where candidate pruning is used for tractability, exactness is interpreted on the evaluated candidate set rather than as global combinatorial exhaustiveness.”
- “The deterministic capacity layer is used as a structural precursor to probabilistic reliability analysis, supplying bottleneck sets, SPOF candidates, and threshold margins.”
- “The package contribution is methodological integration and analysis breadth over a shared domain model, rather than a blanket claim of superior single-solve max-flow performance.”
