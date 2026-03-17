# Capacity Chapter Claim-to-Evidence Matrix

Purpose: prevent online lookups during writing by linking every chapter claim to local evidence.

How to use:
1. Draft each paragraph using the Claim text.
2. Confirm you cite the Evidence Source Type shown.
3. If a claim has scope qualifiers, include them in the same paragraph.

---

| Chapter Section | Claim (write this) | Evidence Source Type | Local Evidence Anchor | Citation Anchor |
|---|---|---|---|---|
| 1.1 Motivation | Capacity-based reliability quantifies performance degradation, not only binary success/failure. | Methodology synthesis | `capacity_methodology_master_document.md` Part 6.1 | Reliability-engineering framing |
| 1.2 Engineering questions | The framework is question-driven (throughput, bottlenecks, failure modes, resilience, redundancy, importance, SPOF). | Code + methodology map | `capacity_methodology_master_document.md` Part 1.3 | N/A (internal architecture mapping) |
| 2.1 Model definition | Network is modeled as a capacitated directed graph with conservation constraints and DAG as upstream invariant. | Formal model + implementation scope | `capacity_methodology_master_document.md` Part 1.1 | Ahuja et al. 1993 |
| 2.2 Max-flow statement | Throughput is computed as deterministic max-flow subject to capacity and conservation constraints. | Formal optimization statement | `capacity_methodology_master_document.md` Part 2.2 | Ford & Fulkerson |
| 2.3 Core theorem | Maximum flow equals minimum cut capacity for the solved source-sink instance. | Theorem + post-solve validation logic | `capacity_methodology_master_document.md` Part 2.3, 5.2 | Ford & Fulkerson 1956 |
| 2.4 Integrality | Integer capacities admit integer optimal flows; this supports integral connectivity interpretations under unit capacities. | Theorem + implementation check | `capacity_methodology_master_document.md` Part 2.4 | Ford & Fulkerson 1962 |
| 2.5 Menger edge form | Edge-disjoint path count equals min edge-cut cardinality under unit-capacity interpretation. | Graph-theoretic theorem | `capacity_methodology_master_document.md` Part 2.5 | Menger 1927 |
| 2.6 Menger node form | Internally node-disjoint path count equals minimum node-cut cardinality. | Graph-theoretic theorem | `capacity_methodology_master_document.md` Part 2.6 | Menger 1927 |
| 2.7 Min-cut family structure | Residual reachability induces min-cut family structure used for in-some vs in-every min-cut characterizations. | Theory + module behavior | `capacity_methodology_master_document.md` Part 2.7 | Picard & Queyranne 1982 |
| 2.8 Node capacities | Node-capacitated flow is solved exactly via node splitting to an edge-capacitated instance. | Transform equivalence + module behavior | `capacity_methodology_master_document.md` Part 2.8 | Standard node-splitting construction |
| 2.9 Decomposition | Solved DAG flow can be represented as additive path components summing to total flow. | Theorem + decomposition module | `capacity_methodology_master_document.md` Part 2.9 | Flow decomposition result |
| 3.1 Algorithmic framework | Implemented methods share residual-graph logic and differ in augmentation/discharge strategy. | Algorithm implementation notes | `capacity_methodology_master_document.md` Part 3.1–3.5 | Edmonds-Karp / Dinic / Goldberg-Tarjan |
| 3.2 Default solver wording | Dinic is the implementation default; this is an implementation choice, not a universal performance claim. | Implementation qualifier | `capacity_methodology_master_document.md` Part 3.4, A8 | Dinic 1970 |
| 3.3 Multi-source/sink reduction | Multi-terminal analyses are reduced exactly using super-source/super-sink augmentation. | Construction + implementation note | `capacity_methodology_master_document.md` Part 3.6 | Standard flow reduction |
| 3.4 Directed global min-cut | Directed global min-cut is computed by repeated exact pairwise solves via two-pass terminal strategy. | Procedure definition | `capacity_methodology_master_document.md` Part 3.7 | Hao & Orlin 1994 |
| 4.1 Sensitivity scope | Reported sensitivity values are exact for evaluated candidates; candidate pruning limits global exhaustiveness. | Scope qualifier + module behavior | `capacity_methodology_master_document.md` Part 4.1, 5.3, A16 | Explicitly state scoped exactness |
| 4.2 Failure impact scope | Single/k-edge failure impacts are exact per tested perturbation, with candidate/combination bounds controlling coverage. | Scope qualifier + module behavior | `capacity_methodology_master_document.md` Part 4.2, 5.3 | Explicitly state scoped exactness |
| 4.3 SPOF | SPOF identification is structural and linked to min-cut membership/reachability logic. | Structural analysis logic | `capacity_methodology_master_document.md` Part 4.3 | Min-cut structural interpretation |
| 4.5 Thresholds | Threshold analysis exploits monotone piecewise behavior of max-flow under edge-capacity variation. | Parametric-flow structure | `capacity_methodology_master_document.md` Part 2.10, 4.5 | Gallo et al. 1989 |
| 5.1 Exactness statement | “Exact” means exact deterministic optimum for the formulated instance, with tolerance only for floating-point equality checks. | Definition | `capacity_methodology_master_document.md` Part 5.1, A2 | N/A |
| 5.2 Validation | Post-solve checks enforce capacity feasibility, conservation, and max-flow/min-cut consistency. | Validation pipeline | `capacity_methodology_master_document.md` Part 5.2, A15 | N/A |
| 6.2 Birnbaum analogy | Birnbaum-style analogy is structural sensitivity analogy, not probabilistic identity. | Conceptual qualifier | `capacity_methodology_master_document.md` Part 6.2, A18 | Birnbaum 1969 |
| 6.3 Failure modes | Minimum cuts provide structural failure-mode sets for zero-throughput top event definitions. | Cut interpretation | `capacity_methodology_master_document.md` Part 6.3 | Max-flow/min-cut literature |
| 7 Complexity | Overall workload equals per-solve complexity times number of required solves per derived analysis. | Complexity synthesis | `capacity_methodology_master_document.md` Part 7, A19 | Algorithmic complexity references |
| 8 Package positioning | Contribution is end-to-end reliability analysis integration, not blanket superiority over standalone max-flow packages. | Positioning qualifier | `capacity_methodology_master_document.md` Part 8.2–8.4, A20–A21 | N/A |

---

## Mandatory qualifier lines to keep in final chapter

- “Exactness is interpreted on solved deterministic instances; perturbation analyses with candidate pruning are exact on the evaluated candidate set.”
- “Algorithm default selection reflects implementation design, not a universal runtime dominance claim.”
- “This chapter provides a structural pre-probabilistic layer; uncertainty propagation is handled in subsequent chapters.”
