# Capacity Methodology — PhD Chapter Structure Guide

**Purpose:** Paragraph-by-paragraph outline of what to write in the thesis chapter and where to draw the material from.
Two documents sit alongside this guide:
- `capacity_methodology_master_document.md` — source material (all math, theorems, implementation notes, citation snippets)
- This file — writing structure only; no content, only *what goes where and why*

Estimated chapter length: ~4,500–6,000 words (methodology chapter, not survey chapter).

---

## Section 1 — Introduction to Capacity-Based Reliability (≈ 3 paragraphs)

### §1.1 — Motivating paragraph
**One paragraph.**
Open with the engineering problem: infrastructure systems carry flows (water, power, data, freight) whose throughput and degradation under stress are not captured by binary failure models.
Argue that capacity is the more natural quantity for system-level reliability.
End with a sentence on why a deterministic, graph-theoretic treatment precedes probabilistic analysis.

> Draw from: [Master doc Part 1.2] — "Scope of capacity analysis"; [Master doc Part 6.1] — "Binary reliability vs capacity reliability".

---

### §1.2 — Engineering questions paragraph
**One paragraph.**
List the specific engineering questions the capacity layer is designed to answer: throughput, bottleneck identification, failure mode enumeration, resilience margin, redundancy, edge/node importance, and single points of failure.
This paragraph tells the reader the chapter is answer-driven, not technique-driven.

> Draw from: [Master doc Part 1.3] — "Engineering questions and module mapping" (all seven question blocks).

---

### §1.3 — Chapter roadmap paragraph
**One paragraph.**
One sentence per section of the chapter: "Section 2 formalises the flow network model. Section 3 covers the algorithms... Section 6 positions the analysis within reliability engineering."
Keep it tight.

> Write fresh — no direct source material, but check headings against Part 1–10 to stay consistent.

---

## Section 2 — Mathematical Model (≈ 4 paragraphs + theorem block)

### §2.1 — Flow network definition paragraph
**One paragraph.**
Introduce the formal network model: directed graph $G = (V, E)$, capacity function $c : E \to \mathbb{R}_{\geq 0}$, sources $S$, sinks $T$, and the feasibility constraints.
State clearly that the framework operates on DAGs (property guaranteed by preprocessing; see InputProcessingModule).

> Draw from: [Master doc Part 1.1] — full formal definition boxes (Def 1.1–1.3).

---

### §2.2 — Flow conservation and max-flow problem paragraph
**One paragraph.**
State flow conservation formally (Kirchhoff-style), define the max-flow problem as an optimisation statement, and note integrality: if capacities are integer, an integer-valued optimal flow exists.

> Draw from: [Master doc §2.1, §2.2, §2.4] — Theorems 1, 2, 4.

---

### §2.3 — Max-flow min-cut theorem paragraph + theorem display
**One–two paragraphs.**
Introduce the max-flow min-cut duality; explain why the minimum cut is the binding constraint on throughput.
Display Theorem 3 (Ford & Fulkerson, 1956) as a numbered theorem block — this is the single most important theoretical result in the chapter.
Follow with a brief interpretive sentence connecting it to the engineering concept of a critical barrier set.

> Draw from: [Master doc §2.3] — Theorem 3 statement and proof sketch; [Master doc §6.3] — "Minimum cuts as failure modes".

---

### §2.4 — Auxiliary theorems paragraph
**One paragraph.**
Briefly survey the remaining foundational results used later:
- Menger's theorem (edge and node versions) → connects min-cut magnitude to edge/node connectivity → used in SPOF and redundancy analyses
- Min-cut lattice structure → used to enumerate all minimum cuts efficiently
- Node-splitting bijection → justifies the node-capacitated transformation (Section 5.6)
- Flow decomposition on DAGs → foundation for the path-based interpretation in Section 4.4

Reference each as Theorem [n] and cite sources given in Part 10.

> Draw from: [Master doc §2.5, §2.6, §2.7, §2.8, §2.9] — Theorems 5–9.

---

## Section 3 — Algorithms (≈ 3–4 paragraphs)

### §3.1 — Residual graph and augmenting-path framework paragraph
**One paragraph.**
Explain the residual graph construction and the augmenting-path paradigm that underlies Ford-Fulkerson, Edmonds-Karp, and Dinic.
This paragraph motivates why multiple algorithms appear; they share a framework but differ in path-selection strategy.

> Draw from: [Master doc §3.1] — residual-graph framework.

---

### §3.2 — Algorithm descriptions paragraph
**One paragraph (or a compact table + one interpretive paragraph).**
Describe the three implemented algorithms — Edmonds-Karp ($O(VE^2)$), Dinic ($O(V^2 E)$ with DAG tightening $O(E\sqrt{V})$), and push-relabel ($O(V^2\sqrt{E}}$ general) — and note that Dinic is the implementation default.
Do **not** claim superior practical performance without benchmarks; frame the default as an implementation choice, not an empirical ranking.

> Draw from: [Master doc §3.2–3.5]; [Master doc Appendix A8] for defensible algorithm-choice wording.

---

### §3.3 — Multi-source/multi-sink reduction paragraph
**One paragraph.**
Explain the super-source/super-sink augmentation that reduces multi-commodity-style problems to a single-pair max-flow.
Note the Int64 node-ID arithmetic guard added to the implementation (cite FlowModule.jl directly).

> Draw from: [Master doc §3.6]; [Master doc §9.1].

---

### §3.4 — Global min-cut routine paragraph
**One paragraph.**
Describe the global minimum cut procedure (enumerate all source-sink pairs; take the minimum across all pairs).
State the complexity overhead: $O(|V|)$ max-flow solves.
Note this is distinct from a specific-pair min-cut.

> Draw from: [Master doc §3.7].

---

## Section 4 — Derived Analyses (≈ 5–6 paragraphs)

### §4.1 — Sensitivity analysis paragraph
**One paragraph.**
Define edge sensitivity as the change in max-flow per unit change in edge capacity.
State the candidate-set restriction (only edges in some minimum cut are evaluated) and explain why this is exact within scope: a non-cut edge cannot affect max-flow value.
Report the metric computed: $\Delta f^* / \Delta c_e \in [0, 1]$.

> Draw from: [Master doc §4.1] full subsection; [Master doc §5.3]; [Master doc Appendix A12, A16].

---

### §4.2 — Failure impact analysis paragraph
**One paragraph.**
Define failure impact as the flow value after edge removal divided by baseline flow.
Distinguish from sensitivity: sensitivity is marginal (infinitesimal perturbation); failure impact is discrete (full removal).
State the candidate-set logic: only saturated edges in a min-cut can reduce flow under removal.

> Draw from: [Master doc §4.2]; [Master doc Appendix A11].

---

### §4.3 — Structural SPOF analysis paragraph
**One paragraph.**
Define a single point of failure (SPOF) as an edge whose removal sets max-flow to zero.
Note that structural SPOFs are a subset of min-cut edges — specifically edges that are the sole member of some minimum cut.
Describe the efficient detection procedure.

> Draw from: [Master doc §4.3].

---

### §4.4 — Path-based analysis paragraph
**One paragraph.**
Explain the flow decomposition (Theorem 9): any feasible DAG flow can be decomposed into a finite set of source-to-sink path flows.
State when path enumeration is used (structural analysis, route diversity) vs when it is redundant (direct max-flow suffices).

> Draw from: [Master doc §4.4]; [Master doc §2.9] Theorem 9.

---

### §4.5 — Parametric threshold and node-capacitated flow paragraph
**One paragraph.**
Describe parametric analysis: finding the capacity threshold at which max-flow crosses a specified demand level (Theorem 10 monotonicity result).
Briefly note the node-capacitated extension: any network with node throughput limits is reduced to a standard edge-capacitated network via the node-splitting bijection (§2.8).

> Draw from: [Master doc §4.5, §4.6]; [Master doc §2.10, §2.8].

---

### §4.6 — Min-cut enumeration and global connectivity paragraph
**One paragraph.**
State that all minimum cuts can be enumerated using the Picard–Queyranne lattice structure (Theorem 7, Theorem 8).
Describe the global connectivity metric from the global min-cut routine.
Note complexity: exponential worst case in cut count but polynomial per cut.

> Draw from: [Master doc §4.7, §4.8]; [Master doc §2.7].

---

## Section 5 — Exactness and Validation (≈ 2 paragraphs)

### §5.1 — Exactness definition and post-solve checks paragraph
**One paragraph.**
State the exactness claim cleanly: max-flow solvers are exact in the sense that the returned value is the global optimum, verified post-solve by checking max-flow/min-cut equality.
Enumerate the three post-solve checks (flow conservation, capacity feasibility, max-flow/min-cut equality).

> Draw from: [Master doc §5.1, §5.2]; [Master doc Appendix A2, A15].

---

### §5.2 — Scope qualifiers paragraph
**One paragraph.**
Be transparent about the three scope qualifiers that do not void exactness but limit generalisation:
1. Candidate-set pruning in sensitivity and failure-impact analyses — exact on evaluated candidates, not globally exhaustive
2. No probabilistic uncertainty propagation
3. No dynamic/temporal capacity variation

Frame these as design decisions, not deficiencies.

> Draw from: [Master doc §5.3, §5.4]; [Master doc Appendix A16].

---

## Section 6 — Reliability Engineering Context (≈ 2–3 paragraphs)

### §6.1 — Structural vs probabilistic reliability paragraph
**One paragraph.**
Position the capacity layer as a structural pre-probabilistic analysis: it produces the deterministic backbone (min-cut sets, SPOFs, importance rankings) that a probabilistic model subsequently acts on.
Cite the canonical reliability engineering framing where structural analysis identifies failure modes before failure probability is assigned.

> Draw from: [Master doc §6.1, §6.5]; [Master doc Appendix A17].

---

### §6.2 — Importance measures and the Birnbaum analogy paragraph
**One paragraph.**
Draw the parallel between Birnbaum importance in classic reliability theory (marginal reliability increase from a component's perfect performance) and the capacity sensitivity measure (marginal flow increase from unit capacity increase).
Note this is a structural analogy, not a probabilistic equivalence.

> Draw from: [Master doc §6.2]; [Master doc Appendix A18].

---

### §6.3 — Minimum cuts as failure modes and degradation margin paragraph
**One paragraph.**
State that each minimum cut set maps directly to a failure mode: a set of edges or nodes whose simultaneous failure would reduce throughput to zero or below a threshold.
Introduce the degradation margin $\Delta_{\min}$ as the capacity slack between nominal flow and the threshold — a deterministic safety margin.

> Draw from: [Master doc §6.3, §6.4].

---

## Section 7 — Computational Complexity (≈ 1 paragraph + complexity table)

### §7.1 — Complexity summary paragraph + table
**One paragraph introducing a table.**
State that the framework applies polynomial algorithms throughout.
Point the reader to the complexity table.
Note that global min-cut incurs an $O(|V|)$ multiplier on max-flow cost, and that sensitivity/failure-impact analyses are not free re-solves: each perturbed-network solve is a full max-flow call.

Display the complexity table from Part 7 directly.

> Draw from: [Master doc Part 7] — full table; [Master doc Appendix A19].

---

## Section 8 — Implementation and Software Notes (≈ 2 paragraphs)

### §8.1 — Julia implementation paragraph
**One paragraph.**
Describe the language choice (Julia), the data structures (adjacency representations, typed structs for flow results), and the DAG invariant guaranteed by InputProcessingModule.
Note the Int64 underflow guard on super-node ID construction.

> Draw from: [Master doc §9.1, §9.2]; [Master doc §3.6] (guard note).

---

### §8.2 — Package comparison paragraph
**One paragraph.**
Acknowledge that Graphs.jl / GraphsFlows.jl provides raw max-flow solvers.
State clearly what this framework adds: end-to-end reliability analyses (sensitivity, failure impact, SPOF, parametric, global connectivity, node-capacitated) with post-solve validation and typed output structures.
Use the defensible wording from Appendix A20 — no unsupported superiority claims.

> Draw from: [Master doc §8.1–8.4]; [Master doc Appendix A20, A21, A22, A23].

---

## Section 9 — Summary (≈ 1 paragraph)

### §9.1 — Chapter summary paragraph
**One paragraph.**
Recap what the chapter has established:
- The formal flow network model and its relevance to infrastructure reliability
- The max-flow/min-cut theorem as the central theoretical result
- The suite of derived analyses and their exactness qualifications
- The pre-probabilistic role of this layer in the broader thesis framework

End with a forward-pointer: the next chapter introduces probabilistic propagation / Monte Carlo / etc. (adjust to match the actual next chapter).

> Write fresh. Pull phrasing from Appendix A1 ("deterministic structural scope") for the summary sentence.

---

## Cross-Reference Quick Sheet

| Thesis paragraph | Master doc source |
|---|---|
| Flow network definition | Part 1.1 |
| DAG invariant note | Parts 1.2, 9.2 |
| Engineering questions | Part 1.3 |
| Flow conservation | Part 2.1 |
| Max-flow problem | Part 2.2 |
| Max-flow/min-cut theorem | Part 2.3 |
| Integrality | Part 2.4 |
| Menger theorems | Parts 2.5, 2.6 |
| Min-cut lattice | Part 2.7 |
| Node-splitting bijection | Part 2.8 |
| Flow decomposition | Part 2.9 |
| Parametric max-flow monotonicity | Part 2.10 |
| Residual graph | Part 3.1 |
| Ford-Fulkerson / Edmonds-Karp / Dinic / push-relabel | Parts 3.2–3.5 |
| Multi-source/multi-sink reduction | Part 3.6 |
| Global min-cut | Part 3.7 |
| Sensitivity analysis | Part 4.1 |
| Failure impact | Part 4.2 |
| SPOF | Part 4.3 |
| Path enumeration | Part 4.4 |
| Parametric threshold | Part 4.5 |
| Node-capacitated flow | Part 4.6 |
| Min-cut enumeration | Part 4.7 |
| Global connectivity | Part 4.8 |
| Exactness definition | Part 5.1 |
| Post-solve checks | Part 5.2 |
| Candidate-set scope qualifier | Parts 5.3, 5.4 |
| Binary vs capacity reliability | Part 6.1 |
| Birnbaum analogy | Part 6.2 |
| Cuts as failure modes | Part 6.3 |
| Degradation margin | Part 6.4 |
| Probabilistic interface | Part 6.5 |
| Complexity table | Part 7 |
| Package comparison | Parts 8.1–8.4 |
| Julia implementation / guard | Parts 9.1, 9.2 |
| Thesis citation snippets | Appendix A (A1–A23) |
| In-text citation phrases | Appendix B |

---

## Writing Tips

- **Start with §2.3 (max-flow min-cut theorem).** This is the theoretical anchor. Once it is written well, all other sections hang off it.
- **Pull citation snippets verbatim** from Appendix A as a first draft of key sentences; then adjust tense and surrounding prose.
- **Do not over-explain algorithms.** One paragraph (§3.2) with a table or complexity row is sufficient for a methodology chapter. The algorithms are tools, not the contribution.
- **The candidate-set qualifier (§5.2)** must appear explicitly. Examiners will notice if sensitivity claims appear exact without this caveat.
- **Keep §8.2 honest.** State what the framework adds; do not claim it is faster or better than Graphs.jl without benchmark numbers.
