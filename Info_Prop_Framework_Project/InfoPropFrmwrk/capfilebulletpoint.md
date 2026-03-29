# Flow Capacity Chapter — Full Bullet Scaffold

Write each paragraph in your own voice using these bullets as a checklist.
Phrases in "quotes" are suggested phrasings — adapt, don't copy.

---

## IMPORTANT: Reachability context (DO NOT get this wrong)

Your reachability toolkit is NOT "just binary connectivity":
- It computes **exact survival probabilities** P(node receives >= 1 signal)
- Uses inclusion-exclusion for independent paths, conditional expectation for diamond structures
- Supports Float64, Interval, p-box uncertainty types
- It IS probabilistic, it IS exact, it IS sophisticated

So the contrast with the capacity toolkit is NOT:
- ~~reachability = binary, capacity = continuous~~ (wrong — reachability outputs probabilities)
- ~~reachability = probabilistic, capacity = deterministic~~ (misleading — implies this is a fundamental split)

The REAL contrast is:
- Reachability asks: "what is the probability that signal can reach a node?" (qualitative: does it arrive?)
- Capacity asks: "how much throughput can the network deliver?" (quantitative: how much gets through?)
- Both operate on DAGs, but they answer fundamentally different engineering questions
- A network can have high reachability (signal probably arrives) but low capacity (not enough volume)

---

# Section 1: Introduction

## Paragraph 1 — What reachability measures and where it falls short

- Reachability toolkit computes the probability that at least one source-to-sink path is active
- This answers "does signal/resource arrive?" — a qualitative survivability question
- But in flow-carrying systems, knowing signal *can* arrive doesn't tell you *how much* gets through
- Don't say "binary connectivity" — reachability already computes probabilities. Say it measures a qualitative event (path existence) rather than a quantitative performance variable (throughput)
- Tone: respectful of what reachability does, clear about what it doesn't address

## Paragraph 2 — The capacity gap, with example

- In systems that carry flow, operational value depends on volume, not just path existence
- Example: a resource distribution network where all paths satisfy the reachability threshold, yet degraded edge capacities mean demand can't be met
- The point: path-existence probability alone cannot distinguish between "barely enough" and "plenty of spare capacity"
- Keep example to 1-2 sentences — don't over-elaborate
- Key phrase: "how much" vs "whether"

## Paragraph 3 — What this toolkit does (scoping)

- The toolkit works on fixed-capacity instances — state as fact
- It computes exact optimisation outputs and structural indicators (bottlenecks, SPOFs, thresholds, cuts)
- Frame as **layering**: "this chapter builds the per-instance analysis machinery"
- These per-instance outputs are what a probabilistic layer would query across sampled capacity scenarios
- Don't over-justify the scoping — it's not a limitation, it's the nature of max-flow algorithms (they take fixed capacities)
- Don't say "intentionally scoped as deterministic structural layer" — sounds defensive
- Don't say "sound structural baseline before uncertainty can be interpreted" — too grand
- Don't imply capacity analysis is inherently non-probabilistic — it's just not probabilistic *in this chapter*
- Better: "All analyses operate on a single fixed-capacity instance. Extensions to stochastic capacity models are discussed in [Chapter X]"

## Paragraph 4 — The six aims

- State input assumption: capacitated DAG
- List six queries:
    - (i) maximum throughput under current capacities
    - (ii) which cut structures are binding bottlenecks
    - (iii) which component failures or perturbations most affect throughput
    - (iv) degradation or upgrade thresholds for target demand
    - (v) edge or node redundancy in path-disjoint terms
    - (vi) which components are single points of failure
- Close: the contribution is integration — one coherent toolkit, not isolated algorithms
- Don't oversell as "novel" — individual algorithms are classical. Integration + exact validation is the value
- Keep closing sentence short and factual

## Paragraph 5 — Chapter roadmap

- Brief: "Section 2 does X, Section 3 does Y..."
- Don't over-describe — just orient the reader
- This is fine as a simple list, doesn't need to be a paragraph

---

# Section 2: Mathematical Model

## Subsection 2.1 — Capacitated network definition

**The definition block (G, V, E, c, S, T):**
- Finite node set V, directed edge set E ⊆ V × V
- Edge-capacity function c: E → R≥0 ∪ {∞}
- Source set S, sink set T
- Feasible flow: 0 ≤ f(u,v) ≤ c(u,v) for all edges
- Conservation at internal nodes: inflow = outflow for v ∈ V \ (S ∪ T)
- This is standard — state it cleanly, cite Ahuja/Magnanti/Orlin if needed

**DAG invariant paragraph:**
- Acyclicity is validated by DFS cycle detection during graph ingestion (InputProcessingModule)
- Treated as a contract: checked once upstream, assumed downstream
- Say *how* it's enforced (DFS cycle detection), not just that it's "guaranteed by preprocessing"
- Mention *why* DAG matters: required for flow decomposition (greedy path extraction doesn't terminate on cycles), and simplifies path enumeration (finite paths guaranteed)
- Don't over-explain the software design rationale — one sentence is enough

**Multi-source flow value:**
- |f| = aggregate source outflow = aggregate sink inflow (by conservation)
- State the equation, note the equality

## Subsection 2.2 — Max-flow optimization problem

**The optimisation statement:**
- max |f| subject to capacity + conservation
- "Maximum deliverable steady-state transfer rate under current capacities"
- All downstream analyses are rooted in this solved baseline — say this once

**Super-node augmentation:**
- Super-source s* connected to all sources, all sinks connected to super-sink t*
- Augmentation edges get sufficiently large (or infinite) capacity — never the binding constraint
- Transformation is exact: preserves feasible-flow correspondence and objective value
- Implementation detail: s* = min(V)-1, t* = min(V)-2 with overflow guard — keep brief

**MISSING — add this: Unbounded flow detection**
- Your code explicitly checks for infinite-capacity augmenting paths (source to sink using only ∞-capacity edges)
- If found: problem is unbounded, max_flow = ∞, is_unbounded flag set
- This is a real edge case your code handles — worth one sentence
- "If an augmenting path exists using only infinite-capacity edges, the problem is unbounded and the implementation reports this explicitly"

## Subsection 2.3 — Max-flow/min-cut theorem

**Theorem statement:**
- max |f| = min cap(S,T) — standard, cite Ford & Fulkerson 1956
- State the cap(S,T) formula

**Interpretation paragraph:**
- Throughput and bottleneck are dual views of the same solved instance
- Maximising flow = finding the least-capacity separating barrier
- In reliability terms: minimum cuts identify structural vulnerability surfaces
- Don't say "central methodological anchor" — just state what it means

**Verification link:**
- Implementation checks flow value = cut capacity under numerical tolerance
- This dual consistency is what downstream analyses rely on
- Keep to one sentence

**MISSING — add this: Min-cut extraction procedure**
- After optimality (no augmenting path in residual graph), the min-cut is extracted as:
  S = {nodes reachable from source in residual graph}, T = V \ S
- This is how the theorem becomes *computable* — it's not just an existence result
- Your code does this in every solver via `_reachable_residual`
- One sentence is enough

## Subsection 2.4 — Auxiliary theorems

For each theorem: state it, say what module uses it, say what reliability question it answers.

**Integrality theorem (Ford & Fulkerson 1962):**
- Integer capacities → integer optimal flow exists
- Used by: connectivity analyses (unit-capacity constructions)
- Reliability role: integer max-flow = count of disjoint paths

**Menger edge theorem (Menger 1927):**
- Max edge-disjoint s→t paths = min edge cut cardinality
- Used by: GlobalConnectivityModule edge_connectivity()
- Reliability role: edge redundancy as path-disjoint route count
- MISSING: mention super-sink aggregation trick — your code computes λ by solving one max-flow per source to a super-sink (connected to all non-source nodes with unit capacity), not O(V²) pairwise solves. This is a computational consequence of Menger + integrality. State it here or in Section 3.

**Menger node theorem (Menger 1927):**
- Max internally node-disjoint paths = min internal node-cut
- Whitney ordering: κ ≤ λ ≤ δ
- Used by: GlobalConnectivityModule node_connectivity()
- Reliability role: node redundancy

**Min-cut lattice (Picard & Queyranne 1982):**
- S* = source-reachable in residual, S** = complement of sink-backward-reachable
- Every min-cut S satisfies S* ⊆ S ⊆ S**
- Free zone F = S** \ S* — nodes that can be on either side
- 2^|F| minimum cuts in worst case
- Used by: MinCutUtilitiesModule, StructuralModule (SPOF detection)
- Edges in every min-cut = saturated, u ∈ S*, v ∉ S** (SPOF edges)
- Edges in some min-cut = saturated, u ∈ S**, v ∉ S*
- MISSING — add consequence: "Edges not in any minimum cut have zero marginal capacity value and zero Birnbaum importance, since they cannot participate in any binding constraint." This justifies the pruning in SensitivityModule.

**Node-splitting bijection:**
- v → (v_in, v_out) with internal edge of capacity c(v)
- Incoming edges → v_in, outgoing edges from v_out
- Exact bijection between feasible flows, objective preserved
- Used by: NodeCapacitatedFlowModule
- Keep implementation detail (2v, 2v+1 convention, overflow guards) for Section 3

**Flow decomposition on DAGs:**
- f = Σ f_i · 1_{P_i}, f_i > 0
- Per-edge accounting: f(e) = Σ_{i: e∈P_i} f_i
- Total: Σ f_i = |f|
- Used by: FlowDecompositionModule
- IMPORTANT: state that DAG property is what makes this work — on cyclic graphs you'd also need cycle-flow components. "Acyclicity eliminates cycle-flow components, so the decomposition consists exclusively of source-to-sink paths"
- Note: decomposition is not unique (multiple valid decompositions exist), but each is exact

**MISSING — add new theorem: Parametric flow structure (Gallo, Grigoriadis, Tarjan 1989)**
- F(c_e) as function of single edge capacity (all others fixed) is monotone non-decreasing, concave, piecewise-linear
- Slope changes occur exactly when the min-cut partition changes
- This is the mathematical basis for ParametricThresholdModule
- On each fixed-partition segment: closed-form linear threshold computation
- Between segments: recursive binary search locates partition boundaries
- Currently this only appears in Section 4.5 — it should be stated as a theorem here since it's a foundational result used by a whole module

**Closing paragraph:**
- These aren't isolated theory — each links to a module and a reliability interpretation
- Primary reference: Ahuja, Magnanti, Orlin (1993) + specific sources above
- Keep brief

---

# Section 3: Algorithms and Computational Strategy

## Subsection 3.1 — Residual-graph framework

- Forward residual: c(u,v) - f(u,v) = remaining capacity
- Backward residual: f(u,v) = cancellable flow
- No-augmenting-path condition = optimality in augmenting-path formulations
- Shared framework means solvers are swappable with same downstream interface
- Keep short — this is standard material

## Subsection 3.2 — Implemented solver family

For each solver, state: algorithm idea, complexity, citation. Don't over-describe.

**Edmonds-Karp (1972):**
- BFS shortest-path augmenting paths
- O(VE²)
- BFS bounds augmentation phases via monotone distance growth

**Dinic (1970):**
- Level-graph + DFS blocking flow
- O(V²E) general case
- Default solver — frame as implementation choice, not performance claim
- Don't claim superiority over external packages

**Push-relabel (Goldberg & Tarjan 1988):**
- Preflow-based, push + relabel operations
- Source height initialised to |V|
- Don't claim specific asymptotic bound beyond correctness — bound depends on queue discipline

**Common interface:**
- Symbolic dispatch (:edmonds_karp, :dinic, :push_relabel)
- Same result type (FlowSolveResult) from all three
- Solver substitution doesn't change downstream analysis calls

## Subsection 3.3 — Multi-source/sink reduction

- Super-source s*, super-sink t* with ∞ capacity augmentation edges
- Exact: never binding constraint, preserves objective
- Implementation: s* = min(V)-1, t* = min(V)-2 with underflow guard
- Keep brief — math is in Section 2

## Subsection 3.4 — Directed global min-cut

- Two-pass: fix source sweep sinks, fix sink sweep sources
- 2(|V|-1) total solves
- Exact for directed global min-cut
- Acknowledge O(V) multiplier on per-solve cost
- Mention Hao-Orlin (1994) exists as faster alternative — you chose transparency + downstream compatibility over asymptotic optimality
- Be honest: this is a simplicity choice, not an oversight

---

# Section 4: Derived Reliability Analyses

## Subsection 4.1 — Sensitivity analysis

**Three metrics — state formula, what it measures, how computed:**

1. Zeroing-impact: Δ(e) = F(c) - F(c_e ← 0)
   - "How much throughput do we lose if this edge is completely removed?"
   - One re-solve per tested edge

2. Marginal gain: m_δ(e) = [F(c_e + δ) - F(c)] / δ
   - "How much throughput do we gain per unit capacity added?"
   - Finite-difference, default δ = 1.0
   - One re-solve per tested edge

3. Birnbaum importance: I_B(e) = F(c_e ← ∞) - F(c_e ← 0)
   - "What is the full range of throughput impact this edge can have?"
   - Two re-solves per tested edge (one at ∞, one at 0)
   - Structural analogue of Birnbaum's reliability importance — NOT probabilistic equivalence

**Candidate-set pruning (apply to all three):**
- Only saturated edges in at least one min-cut are evaluated
- Edges not in any min-cut get zero — this is theorem-grounded (lattice characterisation), not heuristic
- Say why: such edges are strictly interior to source or sink partition in every cut, so perturbing them can't affect max-flow

**Scope qualifier:**
- Results are exact for evaluated candidates
- Not globally exhaustive unless full-space evaluation is performed
- Must state this — methodological honesty

## Subsection 4.2 — Failure impact analysis

**Three types of analysis:**

1. Single-edge failures:
   - Each candidate edge: set capacity to 0, exact re-solve
   - Candidates: edges in some min-cut (same pruning rationale as sensitivity)
   - Results ranked by throughput drop (descending)

2. K-edge simultaneous failures:
   - All C(n,k) combinations from candidate set
   - Bounded by combination_limit (default 10,000) — throws error if exceeded
   - Each combination: zero all k edges, exact re-solve
   - Ranked by throughput drop

3. Capacity degradation scenarios:
   - User-specified: either per-edge overrides or uniform scale factors
   - Each scenario: full re-solve, no candidate pruning (it's a complete re-specification)

**Distinguish from sensitivity:**
- Sensitivity = marginal local response
- Failure impact = discrete removal experiments
- They're related but answer different questions — sensitivity is about influence, failure impact is about consequences

## Subsection 4.3 — SPOF analysis

**Edge SPOFs:**
- Definition: edge appears in *every* minimum cut
- Characterisation: saturated AND u ∈ S* AND v ∉ S** (from lattice)
- No additional solver calls — uses residual state from baseline solve
- Computationally negligible after baseline

**Node SPOFs:**
- Two types in code:
  1. Structural: removing node disconnects all source-to-sink paths (reachability test)
  2. Capacity-based (NodeCapacitatedFlowModule): setting node capacity to 0 collapses flow to zero (re-solve)
- Structural SPOFs need no solver calls
- Capacity-based SPOFs need one re-solve per candidate node

**Reliability value:**
- SPOFs = no-redundancy choke points
- Minor disruption → total service failure
- High priority for infrastructure design

## Subsection 4.4 — Path-based analysis: enumeration vs decomposition

**Two distinct concepts — don't conflate them:**

1. Structural path enumeration:
   - All simple source-to-sink paths in the DAG topology
   - Independent of solved flow values
   - Bounded by path_limit (default 10,000), throws if exceeded
   - DFS traversal, guaranteed to terminate (DAG)
   - Gives route-diversity information

2. Flow decomposition:
   - Decomposes *solved* edge flows into path-flow components
   - f(e) = Σ_{i: e∈P_i} f_i exactly
   - Greedy path extraction: follow positive flow, subtract, repeat
   - Not unique — but each valid decomposition is exact
   - Gives throughput-allocation information

**Why the distinction matters:**
- A network can have many structural paths while actual throughput concentrates on few bottlenecked corridors
- Summing path bottleneck values from structural enumeration does NOT approximate throughput
- Flow decomposition IS additive and validated against solved edge flows
- Conflating them → incorrect reliability interpretations

## Subsection 4.5 — Parametric threshold + node-capacitated flow

**Threshold analysis:**
- Input: target throughput T, target edge e
- Question: how much can c(e) degrade before F < T? How much must c(e) increase to achieve F ≥ T?
- Mathematical basis: F(c_e) is monotone non-decreasing, concave, piecewise-linear (Gallo et al. 1989)

**Degradation threshold:**
- Recursive binary search on capacity interval
- Tracks min-cut partition changes (partition change = slope change)
- On fixed-partition segments: closed-form linear interpolation c* = c_lo + (T - F(c_lo)) / slope
- Bounded by max_depth (default 64), throws if exceeded

**Upgrade threshold:**
- Doubling search to bracket upper bound
- Then same recursive binary search
- Upgrade-ineffective flag: if max-flow plateaus under doubling, the bottleneck is elsewhere — returns ∞ sentinel

**Reliability margin:**
- M_e = c(e) - c*_degrade
- Large positive = robust slack
- Small or negative = proximity to demand failure

**Node-capacitated flow:**
- Uses node-splitting bijection (Section 2)
- v → (v_in = 2v, v_out = 2v+1) with internal edge capacity c(v)
- Overflow/collision guards on ID arithmetic
- All edge-capacitated analyses reusable on split graph
- Results mapped back to original node IDs

## Subsection 4.6 — Min-cut family and global connectivity

**Min-cut enumeration:**
- Free zone F = S** \ S*
- All min-cuts: S = S* ∪ R for R ⊆ F → 2^|F| cuts
- |F| ≤ 62: exact count via bit-shift
- |F| > 62: truncated to cut_limit, is_complete=false flag
- Each enumerated cut validated: capacity = solved max-flow within tolerance

**Why enumerate?**
- Different physical component sets can be equally critical bottleneck barriers
- Enumerating identifies all minimal failure-mode candidates for zero-throughput event
- No per-cut re-solves needed after baseline

**Global connectivity:**
- Edge connectivity λ: unit-capacity graph, super-sink aggregation, one solve per source
- Node connectivity κ: node-split + unit node caps, one solve per source
- Both verified as integer-valued (integrality theorem)
- λ = edge-disjoint path count, κ = node-disjoint path count (Menger)

---

# Section 5: Exactness, Validation, and Scope

## Subsection 5.1 — What "exact" means here

- Exact = deterministic optimal for the formulated instance
- Not a statistical estimate, not a heuristic approximation
- IEEE-754 floating-point arithmetic
- Numerical tolerance used ONLY for post-solve equality checks (saturation, conservation) — not as optimisation convergence criterion
- Exactness ≠ global combinatorial exhaustiveness: where candidate pruning is applied, exactness is scoped to evaluated candidates

## Subsection 5.2 — Post-solve validation

Three checks on every validated solve:
1. Capacity feasibility: 0 ≤ f(u,v) ≤ c(u,v)
2. Flow conservation: inflow = outflow at internal nodes
3. Max-flow/min-cut consistency: flow value = cut capacity within tolerance

Plus: flow decomposition consistency (path flows reconstruct edge flows exactly)

- These are theorem-backed: check 3 follows from Ford-Fulkerson. Failure = code or input error, not acceptable approximation gap

## Subsection 5.3 — Scope qualifiers

Three boundaries — state them clearly, don't be defensive:

1. **Candidate-pruned scope**: sensitivity and failure-impact results are exact on evaluated candidates. Global exhaustiveness requires full-space evaluation.

2. **No probabilistic propagation**: this chapter does not compute P(performance ≥ T). Uncertainty models could consume these if toolkit extended to stochastic capacities, but that is outside the current scope.  

3. **No dynamic flow**: capacities and topology are static per solve. Time-varying degradation, adaptive rerouting are out of scope.

- Don't call these "not deficiencies" — that sounds defensive. Just state the scope matter-of-factly.
- Don't say "deterministic structural layer is non-redundant because..." — the work speaks for itself

## Subsection 6.2 — Birnbaum importance analogy

- Classical Birnbaum: I_B(i) = ∂h(p)/∂p_i — marginal reliability sensitivity
- Flow analogue: I_B(e) = F(c_e←∞) - F(c_e←0) — throughput range
- Both map component parameters to system response, support component ranking
- BUT: the analogy is conceptual, not formal probabilistic equivalence
- Flow importance = deterministic throughput sensitivity, not probability sensitivity
- State the analogy, state the limitation — don't oversell or undersell

## Subsection 6.3 — Min-cuts as failure modes

**For zero-throughput top event:**
- Min-cuts = minimal structural separating sets
- Each min-cut: simultaneous removal reduces max-flow to zero
- No proper subset has this property → they ARE the minimal failure modes
- Maps to physical barrier configurations

**For nonzero service targets:**
- Failure = F(c) < T, which is NOT the same as zero flow
- Not necessarily caused by a min-cut
- Relevant boundary: threshold margins M_e = c(e) - c*_degrade
- System at risk when any critical edge's margin → 0
- Practically important: regulatory/contractual thresholds define real reliability boundary, not complete disconnection

---

# Section 7: Computational Complexity

- Present as: per-solve cost × number of solves per analysis
- Table format is good — keep it

| Task | Solves | Driver |
|------|--------|--------|
| Baseline max-flow/min-cut | 1 | solver choice |
| Min-cut lattice extraction | 0 extra | residual BFS |
| SPOF edge detection | 0 extra | lattice reachability |
| Flow decomposition | 0 extra | iterative path extraction |
| Single-edge failure | up to m | candidate edges |
| k-edge failure | up to C(m,k) | combinations (bounded) |
| Degradation scenarios | 1 per scenario | scenario count |
| Threshold per edge | recursion solves | recursion depth |
| Edge connectivity λ | n solves | source count |
| Node connectivity κ | n solves | source count (split graph) |
| Global min-cut | 2(n-1) solves | terminal pairs |
| Path enumeration | 0 solves | DFS traversal (bounded) |

- Don't over-promise symbolic complexity — match operational behaviour

---

# Section 8: Julia Implementation 

## Subsection 8.1 — Implementation rationale

- Julia, sparse edge-key dicts, adjacency index dicts
- Typed result structures (FlowSolveResult etc.) carry residual state, flow map, cut partition, saturation set
- DAG invariant: enforced by InputProcessingModule via DFS cycle detection, treated as contract downstream
- Super-node ID convention: min(V)-1 and min(V)-2 with Int64 overflow guard
- Keep brief — this is supporting detail, not the contribution

## Subsection 8.2 — Positioning vs external packages

- GraphsFlows.jl exists, solves equivalent single-source max-flow
- No runtime superiority claim without benchmarking
- Your contribution: integration of multi-terminal handling + downstream reliability pipeline over shared data model
- Specific additions: multi-source API, rich result types, flow decomposition, parametric thresholds, node-capacitated flow, min-cut lattice, global connectivity, failure/sensitivity workflows, post-solve validation
- The value is pipeline integration + methodological breadth, not raw single-solve speed
- Don't be defensive — just state what you added and why

---

# Section 9: Chapter Summary

- Recap what was established — don't repeat everything, hit the key points:
  - Capacitated DAG model with conservation + DAG invariant
  - Max-flow/min-cut as central result
  - Three solver families under common interface
  - Six derived analyses mapped to engineering questions
  - Exactness defined precisely, with scope qualifiers
- Link forward: structural outputs feed into probabilistic chapters
- Don't say "pre-probabilistic scaffold" — just say what the outputs are and where they go next
- Keep it short — the chapter already said everything

---

# Code-to-claim mapping (reference while writing)

| Aim | Module | Key functions |
|-----|--------|---------------|
| (i) Max throughput | FlowModule | `solve_max_flow_dinic`, `solve_max_flow_edmonds_karp`, `solve_max_flow_push_relabel` |
| (ii) Bottleneck cuts | MinCutUtilitiesModule + StructuralModule | `enumerate_min_cuts`, `edges_in_every_mincut`, `bottleneck_ranking` |
| (iii) Failure/perturbation impact | FailureImpactModule + SensitivityModule | `analyze_single_edge_failures`, `analyze_k_edge_failures`, `critical_edge_ranking`, `birnbaum_importance`, `marginal_capacity_values` |
| (iv) Thresholds | ParametricThresholdModule | `find_degradation_threshold`, `find_upgrade_threshold` |
| (v) Redundancy | GlobalConnectivityModule | `edge_connectivity`, `node_connectivity` |
| (vi) SPOFs | StructuralModule + NodeCapacitatedFlowModule | `identify_spof_edges`, `identify_spof_nodes`, `node_capacitated_spof_nodes` |

---

# Things the current .tex gets WRONG or should fix

1. **"binary connectivity" / "Boolean state labels" for reachability** — Your reachability toolkit computes exact probabilities, not binary yes/no. Reframe as "qualitative event probability" vs "quantitative throughput"

2. **Seven aims instead of six** — (iii) and (vi) overlap. Merge into one about failure/perturbation impact.

3. **"intentionally scoped as a deterministic structural layer"** — Sounds defensive. Just state that analyses operate on fixed-capacity instances.

4. **"sound structural baseline before uncertainty can be interpreted"** — Too grand. Just say the outputs are what a probabilistic layer would query across sampled capacity scenarios.

5. **Missing: unbounded flow detection** — Your code handles this. One sentence or paragraph in Section 2.2.

6. **Missing: min-cut extraction procedure** — How S,T are computed from residual graph. One sentence  or paragraph in Section 2.3.

7. **Missing: parametric piecewise-linear theorem** — Should be in Section 2.4 as an auxiliary theorem, not buried in Section 4.5.

8. **Missing: super-sink aggregation justification** — Why one solve per source gives connectivity. Section 2.4 or 3.

9. **Missing: DAG required for decomposition** — State that acyclicity eliminates cycle-flow components. Section 2.4.

10. **Missing: zero marginal value justification** — Edges not in any min-cut have zero sensitivity. Follows from lattice. Section 2.4.

11. **"This chapter therefore occupies a necessary and non-redundant position"** — Don't argue for your own relevance. Let the work speak.
