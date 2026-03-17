# Master Methodology Reference for Capacity-Based Reliability Analysis

This document is the fully self-contained master reference for methodology drafting, supervisory review, and chapter assembly.

It contains:
- the full technical reference;
- the short citation snippets;
- the in-text citation phrase list.

## Part 1 — Problem Class

### 1.1 Flow network formal definition

Let a capacitated directed network be
\[
G=(V,E,c,S,T),
\]
with finite node set $V$, directed edge set $E\subseteq V\times V$, capacity function $c:E\to\mathbb{R}_{\ge 0}\cup\{\infty\}$, source set $S\subseteq V$, and sink set $T\subseteq V$.

In this codebase, $S$ and $T$ are passed as `source_nodes` and `sink_nodes` from prior input preprocessing; in the DAG workflow they correspond to nodes with no incoming and no outgoing edges respectively.
The DAG property is treated here as an upstream invariant supplied by `InputProcessingModule`, so this layer relies on it rather than re-validating acyclicity at each call.

A feasible flow is a function $f:E\to\mathbb{R}_{\ge 0}$ satisfying:
\[
0\le f(u,v)\le c(u,v)\quad\forall (u,v)\in E,
\]
and conservation at each internal node:
\[
\sum_{u:(u,v)\in E} f(u,v)=\sum_{w:(v,w)\in E} f(v,w),\quad \forall v\in V\setminus(S\cup T).
\]

Flow value is
\[
|f|=\sum_{s\in S}\sum_{w:(s,w)\in E}f(s,w).
\]

Physical interpretation is model-dependent (material throughput, signal rate, data rate, commodity transfer), while mathematical constraints are invariant.

Default modelling assumption in this framework is edge-capacitated flow with nodes as junctions; node capacities are handled by exact node splitting in `NodeCapacitatedFlowModule`.

### 1.2 Scope of capacity analysis in this thesis

This framework computes deterministic structural quantities on fixed-capacity DAGs.

“Exact” means each returned value is the exact optimizer or exact derived value for the stated deterministic optimization problem, subject only to IEEE-754 arithmetic and tolerance-based equality checks.

Out-of-scope problem classes:

1. Probabilistic reliability $P(\text{performance}\ge T)$ under random failures.
2. Stochastic or interval-capacity optimization as a single uncertainty-propagating solve.
3. Dynamic / time-varying / adaptive flow.

Deterministic structural analysis is non-redundant because probabilistic models require a correct structural map of bottlenecks, failure modes, and capacity margins before uncertainty is propagated.

### 1.3 Engineering questions and module mapping

#### Throughput
- Maximum deliverable rate: $\max_f |f|$ via `FlowModule` (`max_flow`).
- Per-sink delivery: `FlowSolveResult.sink_flow[t]` via `FlowModule`.

#### Bottlenecks
- Binding cross-section: solved minimum cut `mincut_S`, `mincut_T` via `FlowModule`.
- Saturated edges: `saturated_edges = \{e: f(e)\approx c(e)\}` via `FlowModule`.
- Bottleneck ordering on solved representative cut: `StructuralModule.bottleneck_ranking`.

#### Failure modes
- Representative minimum cut edges: `FailureImpactModule.extract_min_cut_sets`.
- All minimum cuts (bounded enumeration): `MinCutUtilitiesModule.enumerate_min_cuts`.
- Single-edge zeroing impact: `FailureImpactModule.analyze_single_edge_failures`.
- $k$-edge simultaneous zeroing impact (bounded combinations): `FailureImpactModule.analyze_k_edge_failures`.

#### Resilience
- Degradation threshold for edge $e$ to maintain target flow $T$: `ParametricThresholdModule.find_degradation_threshold`.
- Upgrade threshold for edge $e$ to reach target flow $T$: `ParametricThresholdModule.find_upgrade_threshold`.
- Multi-edge degradation scenarios: `FailureImpactModule.analyze_capacity_degradation`.

#### Redundancy
- Edge connectivity $\lambda$: `GlobalConnectivityModule.edge_connectivity`.
- Node connectivity $\kappa$: `GlobalConnectivityModule.node_connectivity`.
- Edge redundancy scores under unit capacities with edge removal: `StructuralModule.edge_redundancy_scores`.

#### Importance
- Capacity-drop ranking under edge removal: `SensitivityModule.critical_edge_ranking`.
- Finite-difference marginal value: `SensitivityModule.marginal_capacity_values`.
- Flow-analogue Birnbaum score: `SensitivityModule.birnbaum_importance`.

#### Single points of failure
- Edge SPOFs from all-min-cut intersection characterization: `StructuralModule.identify_spof_edges`, `MinCutUtilitiesModule.edges_in_every_mincut`.
- Node SPOFs (reachability and node-capacitated variants): `StructuralModule.identify_spof_nodes`, `NodeCapacitatedFlowModule.node_capacitated_spof_nodes`.

#### Routing structure
- Additive path decomposition of solved flow: `FlowDecompositionModule.decompose_flow`.

## Part 2 — Core Mathematical Foundations

### 2.1 Flow conservation

For feasible flow $f$:
\[
\sum_{u:(u,v)\in E}f(u,v)=\sum_{w:(v,w)\in E}f(v,w),\quad \forall v\in V\setminus(S\cup T).
\]

Computational role: `FlowModule.validate_flow_conservation` verifies this identity at non-terminal nodes with tolerance `tol`.

Engineering role: conservation encodes no creation/destruction at internal junctions.

Primary citation: Ahuja, Magnanti, Orlin (1993).

### 2.2 Max-flow problem statement

\[
\max_f \; |f| = \sum_{s\in S}\sum_{w:(s,w)\in E}f(s,w)
\]
subject to capacity and conservation constraints.

For multi-source / multi-sink networks, super-source and super-sink reduction is exact and used internally in `FlowModule`.

### 2.3 Max-flow min-cut theorem

For single source $s$ and sink $t$:
\[
\max |f| = \min_{(S,T)} \operatorname{cap}(S,T),
\]
with
\[
\operatorname{cap}(S,T)=\sum_{(u,v)\in E: u\in S, v\in T} c(u,v).
\]

Proof sketch: weak duality gives $|f|\le \operatorname{cap}(S,T)$ for any feasible flow and cut; optimality follows when residual graph has no augmenting path and reachable set from $s$ defines equality cut.

Computational role: `FlowModule.validate_maxflow_mincut` checks consistency of solved `max_flow` and `mincut_capacity`.

Citation: Ford and Fulkerson (1956).

### 2.4 Integrality theorem

If all capacities are integers, there exists an optimal flow with integer values on all edges.

Proof sketch: augmenting-path pushes on integer residual capacities preserve integrality inductively.

Computational role: `GlobalConnectivityModule` validates integer-valued $\lambda$ and $\kappa$ outputs via `_validate_integral_value` in unit-capacity constructions.

Citation: Ford and Fulkerson (1962).

### 2.5 Menger theorem (edge version)

Maximum number of edge-disjoint directed $s\to t$ paths equals minimum cardinality of an $s$-$t$ edge cut.

Flow connection: under unit capacities, integer max-flow equals edge-disjoint path count.

Computational role: used by `StructuralModule.edge_redundancy_scores` and `GlobalConnectivityModule.edge_connectivity`.

Citation: Menger (1927).

### 2.6 Menger theorem (node version)

Maximum number of internally node-disjoint directed $s\to t$ paths equals minimum internal node-cut size.

Node-splitting reduction transforms node cuts to edge cuts with unit node capacities and infinite edge capacities.

Computational role: implemented through `solve_node_capacitated_flow` within `GlobalConnectivityModule.node_connectivity`.

Citation: Menger (1927); Whitney (1932) for $\kappa\le\lambda\le\delta$.

### 2.7 Min-cut lattice structure

Let $S^*$ be source-reachable nodes in residual graph after an optimal solve, and let $S^{**}$ be complement of nodes backward-reachable from sink (restricted to original nodes in implementation interfaces).

Lattice condition for minimum cuts:
\[
S^*\subseteq S\subseteq S^{**}.
\]

Edge characterizations used by code:

- In some minimum cut if saturated and $u\in S^{**}$ and $v\notin S^*$.
- In every minimum cut if saturated and $u\in S^*$ and $v\in T^{**}$, where $T^{**}$ is complement of backward sink-reachable set on original nodes.

Computational role: `MinCutUtilitiesModule` and `StructuralModule.identify_spof_edges`.

Citation: Picard and Queyranne (1982).

### 2.8 Node-splitting bijection

For constrained node $v$ with capacity $c(v)$, replace by $(v_{in},v_{out})$ and internal edge $(v_{in},v_{out})$ of capacity $c(v)$; remap incoming edges to $v_{in}$ and outgoing edges from $v_{out}$.

Bijection: feasible flows on split graph correspond exactly to original flows satisfying node-capacity constraints; objective value is preserved.

Implementation note: `NodeCapacitatedFlowModule` uses ID convention $v_{in}=2v$, $v_{out}=2v+1$ with overflow and collision guards.

### 2.9 Flow decomposition theorem on DAGs

For feasible DAG flow $f$:
\[
f=\sum_i f_i\mathbf{1}_{P_i},\quad f_i>0,
\]
with exact per-edge accounting
\[
f(e)=\sum_{i:e\in P_i} f_i,
\]
and
\[
\sum_i f_i=|f|.
\]

Proof sketch: repeatedly extract positive-flow source-to-sink path, subtract bottleneck amount, and terminate because each iteration zeros at least one positive-flow edge.

Implementation: `FlowDecompositionModule.decompose_flow` returns one deterministic canonical decomposition and validates additive consistency with `validate_decomposition`.

### 2.10 Parametric max-flow structure (single edge)

For fixed capacities except edge $e$, define $F(c_e)=\max\text{-flow}$.

Properties: monotone non-decreasing, concave, piecewise linear with finitely many breakpoints.

Threshold on linear segment:
\[
t^*=c_{lo}+\frac{T-F(c_{lo})}{a},\quad a=\frac{F(c_{hi})-F(c_{lo})}{c_{hi}-c_{lo}}.
\]

Implementation: `ParametricThresholdModule` uses partition-change recursion and closed-form interpolation when boundary partitions match.

Citation: Gallo, Grigoriadis, Tarjan (1989).

## Part 3 — Algorithms

### 3.1 Residual-graph framework

Residual network includes forward residual $(u,v)$ with $c(u,v)-f(u,v)>0$ and backward residual $(v,u)$ with $f(u,v)>0$.

Augmentation along residual $s\to t$ path by path bottleneck increases flow value.

Termination criterion: no residual augmenting path implies optimality.

Implementation note: parent maps store direction (`:forward` / `:backward`) and original edge tuple.

### 3.2 Ford-Fulkerson method

Conceptual meta-method: repeatedly choose augmenting path and augment.

In this codebase it is not exposed as a standalone arbitrary-path solver; implemented concrete variants are Edmonds-Karp, Dinic, and push-relabel.

### 3.3 Edmonds-Karp (`:edmonds_karp`)

Uses BFS shortest augmenting paths in edge count.

Complexity: $O(VE^2)$.

Correctness certificate: monotonic non-decrease of BFS distance of saturated critical edges bounds augmentations.

Implemented in `FlowModule.solve_max_flow_edmonds_karp` with `_bfs_augmenting_path`.

### 3.4 Dinic (`:dinic`)

Uses repeated level-graph BFS and blocking-flow DFS with pointer-advance optimization.

Complexity: $O(V^2E)$ for general directed graphs; stronger bounds for specific classes (e.g., unit capacities) are theory-level and may depend on implementation specifics.

Implemented by `_build_level_graph_dinic`, `_build_dinic_adjacency`, `_dinic_dfs_blocking`.

Default across public APIs is `algorithm=:dinic`; this is an implementation choice, not a benchmark claim of universal practical superiority.

### 3.5 Push-relabel (`:push_relabel`)

Maintains preflow and node labels; alternates admissible pushes with relabel operations.

Code initializes source height to $|V|$, pre-dispatches source excess, tracks active nodes, and selects `minimum(active)` at each discharge step.

Theoretical bounds in literature depend on queue discipline (FIFO, highest-label, etc.); this implementation’s `minimum(active)` selection is correct but should not be claimed to satisfy a specific strongest asymptotic bound without separate proof.

### 3.6 Multi-source / multi-sink exact reduction

Adds super-source $s^*$ with edges to each source and super-sink $t^*$ with edges from each sink, both with infinite capacity.

`FlowModule._build_augmented_network` performs this internally.

Implementation note: IDs are constructed as `minimum(node_ids)-1` and `-2`; collision is avoided, and underflow is guarded explicitly for pathological `Int64` minima.

### 3.7 Global minimum cut routine

`GlobalConnectivityModule.global_min_cut` runs two directional passes:

1. fixed source, varying sink;
2. fixed sink, varying source.

Total solves: $2(V-1)$.

This is exact for directed global min-cut but not the asymptotically fastest known method.

## Part 4 — Derived Analyses

### 4.1 Sensitivity analysis

#### Critical edge ranking

Definition:
\[
\Delta(e)=F(c)-F(c_e\leftarrow 0).
\]

Implementation scope: `critical_edge_ranking` evaluates only `flow_result.saturated_edges`.

Scope note: saturated-edge restriction is a computational candidate-set reduction in the present implementation; globally exhaustive ranking requires candidate set = all edges.

#### Marginal capacity values

Definition used by code:
\[
m_\delta(e)=\frac{F(c_e+\delta)-F(c)}{\delta},\quad \delta>0.
\]

Implementation evaluates only saturated edges and assigns zero to all others.

Interpretation is finite-difference increment, not an exact derivative unless additional regularity and limiting analysis are imposed.

#### Birnbaum-style flow importance

Definition:
\[
I_B(e)=F(c_e\leftarrow \infty)-F(c_e\leftarrow 0).
\]

Implementation computes this for baseline `edges_in_some_mincut` candidates and assigns zero to others.

Scope note: this restriction is exact on the evaluated candidate set, but it is not a proof of global exhaustiveness for every edge under arbitrary finite perturbation range.

### 4.2 Failure impact analysis

#### Single-edge failure

`analyze_single_edge_failures` evaluates only baseline `edges_in_some_mincut`.

Exactness statement: each evaluated perturbation solve is exact; candidate filtering determines the scope of the reported analysis.

#### $k$-edge failures

Definition:
\[
\Delta(E')=F(c)-F(c_e\leftarrow 0\;\forall e\in E'),\quad |E'|=k.
\]

Implementation enumerates combinations only from baseline `edges_in_some_mincut`; if $\binom{n}{k}>\texttt{combination_limit}$, function throws `ArgumentError`.

Scope note: the result is exact over the enumerated candidate family, but it is not guaranteed to be exhaustive over all $k$-edge subsets of $E$.

#### Capacity degradation scenarios

Each scenario is either explicit per-edge override dictionary or nonnegative scalar factor on finite capacities.

One exact solve per scenario; no candidate pruning.

### 4.3 Structural SPOF analysis

#### SPOF edges

`identify_spof_edges` applies lattice-based “every min-cut” condition using residual reachability and saturation checks; no extra solver calls beyond baseline.

#### SPOF nodes

`identify_spof_nodes` uses source-to-sink reachability under node removal with candidate prefiltering to nodes on at least one source-to-sink path.

No flow solver calls are required.

### 4.4 Path enumeration vs flow decomposition

`StructuralModule.enumerate_paths` lists all structural source-to-sink paths (bounded by `path_limit`), independent of solved flow values.

`StructuralModule.path_flow_contributions` computes path bottleneck values and is non-additive by design.

`FlowDecompositionModule.decompose_flow` returns additive components that exactly reconstruct solved edge flows and total throughput.

### 4.5 Parametric thresholds

`find_degradation_threshold` and `find_upgrade_threshold` use boundary solves plus recursive partition checks and closed-form interpolation.

For degradation:

- returns immediate case when $F(0)\ge T$;
- returns unreachable flag when baseline $F(c_e)<T$;
- otherwise resolves threshold by recursive partition localization.

For upgrade, doubling search brackets feasible upper bound; if flow plateau persists under doubling, function returns `upgrade_ineffective=true` with `required_capacity=Inf` sentinel.

### 4.6 Node-capacitated flow

`solve_node_capacitated_flow` is exact by split-graph equivalence.

`node_capacitated_spof_nodes` combines:

- re-solves for finite-capacity constrained nodes with node capacity set to zero;
- reachability-only checks for unconstrained (implicitly infinite-capacity) nodes.

### 4.7 Min-cut enumeration

Using free zone $F=S^{**}\setminus S^*$, all cuts are generated as $S=S^*\cup R$, $R\subseteq F$.

If $|F|\le 62$, exact count uses bit-shift; if $|F|>62$, count overflow is avoided by truncating to `cut_limit` and returning `is_complete=false`.

Each enumerated cut is validated by capacity equality to solved `max_flow` within tolerance.

### 4.8 Global connectivity

`edge_connectivity`: unit-capacity graph + super-sink aggregation, one solve per source, integer check enforced.

`node_connectivity`: node-capacitated transform with unit node capacities and super-sink aggregation, one solve per source, integer check enforced.

`global_min_cut`: weighted minimum cross-section over all ordered source/sink directions via two-pass method.

## Part 5 — Exactness and Validation

### 5.1 Exactness definition used in implementation

For bounded deterministic solves, returned optimum is exact for the formulated optimization problem solved by selected algorithm.

`tol` is used for floating-point equality predicates (saturation, conservation checks, reconstruction checks), not as optimization convergence tolerance.

### 5.2 Post-solve checks

For public solver calls with `validate=true`, `FlowModule` applies:

1. `validate_capacity_constraints`.
2. `validate_flow_conservation`.
3. `validate_maxflow_mincut`.

`FlowDecompositionModule` additionally enforces decomposition consistency with `validate_decomposition`.

### 5.3 Theorem-guided checks vs implementation pruning

The code contains both theorem-backed checks (lattice edge characterization, integrality checks, cut-capacity consistency checks) and candidate-pruning choices in sensitivity/failure modules.

Theorem-backed portions are exact by construction.

Candidate-pruned perturbation analyses are exact on evaluated candidate sets, but they should not be described as globally exhaustive unless candidate sets are expanded to all edges or proved equivalent for a narrower network class.

### 5.4 Explicit non-capabilities

- No probabilistic reliability computation.
- No built-in uncertainty propagation for interval/random capacities.
- No dynamic time-expanded flow model.
- No min-cost flow objective.

## Part 6 — Relationship to Reliability Engineering

### 6.1 Binary reliability vs capacity reliability

Binary reliability maps component states to Boolean system success/failure.

Capacity analysis maps component capacities to continuous performance $F(c)=\text{max-flow}$.

Binary connectivity can remain true while throughput degrades; capacity analysis quantifies this degradation dimension.

### 6.2 Birnbaum analogy

Classical Birnbaum:
\[
I_B(i)=\partial h(p)/\partial p_i.
\]

Flow analogue used here:
\[
I_B(e)=F(c_e\leftarrow\infty)-F(c_e\leftarrow 0),
\]
with finite-difference sensitivity interpretation over full edge-capacity range.

### 6.3 Minimum cuts as failure modes

For top event “zero source-to-sink throughput”, minimum cuts correspond to minimal structural failure sets.

For nonzero performance threshold events ($F<T$), relevant failure sets are threshold-dependent and are not identical to zero-flow minimum cuts.

### 6.4 Degradation margin as structural safety margin

For target $T$, degradation threshold $t^*(e,T)$ yields margin
\[
M_e=c(e)-t^*(e,T).
\]

This is a deterministic topology-aware margin under fixed capacities.

### 6.5 Interfaces to probabilistic models

Directly usable structural outputs include baseline throughput, minimum-cut family, SPOF sets, and edge-level threshold margins.

These outputs define candidate events and component-level state thresholds for later probabilistic modelling layers.

## Part 7 — Computational Complexity Summary

Let $V=|\text{nodes}|$, $E=|\text{edges}|$, and $E'$ for transformed split-graph edge count.

- Baseline max-flow with Dinic: $O(V^2E)$ worst-case per solve.
- Baseline max-flow with Edmonds-Karp: $O(VE^2)$ per solve.
- Push-relabel: correctness guaranteed; empirical complexity depends on active-node policy used (`minimum(active)` in current code).
- Min-cut lattice extraction after baseline: residual BFS-level operations, no new solve.
- Single-edge/k-edge/scenario perturbations: one exact solve per tested perturbation.
- Path enumeration: exponential in number of source-to-sink paths, bounded by `path_limit`.
- Flow decomposition: iterative path extraction with bounded iterations by number of positive-flow edge eliminations; exact cost depends on graph/path structure.
- Parametric threshold per edge: boundary solves + recursion up to `max_depth`.
- Edge connectivity: $V$ unit-capacity solves.
- Node connectivity: $V$ node-capacitated solves on transformed graph.
- Directed global min-cut: $2(V-1)$ solves.

## Part 8 — Comparison with Julia packages

### 8.1 Baseline capabilities in Graphs.jl / GraphsFlows.jl

`GraphsFlows.jl` provides standard max-flow and min-cut routines for single-source single-sink formulations over graph/matrix inputs.

Algorithms overlap at the theory level (e.g., Edmonds-Karp, Dinic family depending on package version).

### 8.2 Capabilities added by this framework

- Native multi-source multi-sink API on `InputProcessingModule` graph representation.
- Rich typed `FlowSolveResult` carrying augmented network state and residual artifacts for downstream analyses.
- Integrated modules for decomposition, thresholds, node-capacitated analysis, min-cut lattice utilities, global connectivity, and failure/sensitivity workflows.
- No repeated data-model conversion cost within InfoProp pipeline.

### 8.3 Where GraphsFlows may be equivalent or better

- Single one-off max-flow/min-cut solves: conceptually equivalent optimization problem and mature package ecosystem.
- Potential memory/runtime benefits for very large sparse-matrix-centric workflows depending on representation and benchmarked workload.
- Different algorithm options may exist in external package versions not implemented here.

No unconditional performance superiority claim is supported without controlled benchmarking.

### 8.4 Architecture rationale for this codebase

The primary rationale is methodological integration and state-rich downstream analysis, not replacement of generic flow packages as standalone solvers.

## Part 9 — Julia implementation notes

### 9.1 Data structures and implications

- Capacities and flows: `Dict{Tuple{Int64,Int64},Float64}` for sparse edge-key lookup.
- Adjacency: `Dict{Int64,Set{Int64}}` consistent with input processing and BFS/DFS traversal.
- Typed structs centralize module outputs and improve downstream type stability.

### 9.2 Dispatch and extensibility

`_solve_with_algorithm(algorithm::Symbol, ...)` centralizes runtime algorithm selection among `:edmonds_karp`, `:dinic`, and `:push_relabel`.

Extension to additional algorithms requires adding a new dispatch branch and preserving result contract.

### 9.3 Bottlenecks and candidate future work

- Connectivity routines scale by repeated solves over source set.
- Perturbation analyses currently restart from scratch each perturbation instead of warm-starting.
- Combinatorial explosion in $k$-edge studies requires tighter exact branch-and-bound formulations if global exhaustive results are required at larger scales.
- Full parametric max-flow algorithms could reduce repeated midpoint solves in threshold analysis.

## Part 10 — Key references and chapter use

Ford, L.R., Fulkerson, D.R. (1956), *Canadian Journal of Mathematics* 8:399–404.
- Use for max-flow min-cut theorem and augmenting-path framework.

Ford, L.R., Fulkerson, D.R. (1962), *Flows in Networks*, Princeton.
- Use for integrality and foundational flow theory.

Menger, K. (1927), *Fundamenta Mathematicae* 10:96–115.
- Use for edge/node disjoint path-cut equalities.

Whitney, H. (1932), *American Journal of Mathematics* 54(1):150–168.
- Use for $\kappa\le\lambda\le\delta$ inequality context.

Edmonds, J., Karp, R.M. (1972), *JACM* 19(2):248–264.
- Use for BFS shortest augmenting-path complexity improvement.

Dinic, E.A. (1970), *Soviet Mathematics Doklady* 11:1277–1280.
- Use for level-graph and blocking-flow method.

Goldberg, A.V., Tarjan, R.E. (1988), *JACM* 35(4):921–940.
- Use for preflow-push framework.

Gallo, G., Grigoriadis, M.D., Tarjan, R.E. (1989), *SIAM Journal on Computing* 18(1):30–55.
- Use for parametric max-flow structural properties and algorithmic direction.

Hao, J.X., Orlin, J.B. (1994), *Journal of Algorithms* 17(3):424–446. DOI: 10.1006/jagm.1994.1043.
- Use for directed global min-cut algorithmic context and optimization benchmark.

Ahuja, R.K., Magnanti, T.L., Orlin, J.B. (1993), *Network Flows*, Prentice Hall.
- Use as general graduate-level theorem and algorithm reference.

Birnbaum, Z.W. (1969), “On the Importance of Different Components in a Multicomponent System”, in *Multivariate Analysis II*, Academic Press.
- Use for original importance-measure definition and analogy framing.

Gomory, R.E., Hu, T.C. (1961), *SIAM Journal of Applied Mathematics* 9(4):551–570.
- Use for all-pairs cut context (undirected setting) to position design choices.

Picard, J.-C., Queyranne, M. (1982), “A network flow solution to some nonlinear 0–1 programming problems, with applications to graph theory”, *Networks* 12(2):141–159. DOI: 10.1002/net.3230120206.
- Use for minimum-cut lattice structure and $S^*/S^{**}$ style characterization.

## Appendix A — Methodology Citation Snippets

### A1 Deterministic structural scope
This study treats the infrastructure network as a deterministic capacitated DAG and computes exact structural flow quantities under fixed capacities. The optimization layer is max-flow/min-cut on a directed network representation, with multi-source and multi-sink handling via exact super-source/super-sink reduction. The DAG condition is assumed as an upstream input invariant from preprocessing rather than re-checked in each downstream analysis call. Probabilistic reliability, capacity uncertainty propagation, and dynamic flow adaptation are outside this solve layer and are treated as downstream modelling stages built on the structural outputs generated here.

### A2 Exactness statement
“Exact” in this chapter denotes exact optimality for the deterministic optimization problem, not statistical estimation and not heuristic approximation. Numerical tolerance is used only for floating-point equality predicates (e.g., saturation and conservation checks), while objective values are produced by exact combinatorial flow algorithms under IEEE-754 arithmetic.

### A3 Max-flow min-cut theorem
The correctness certificate for each bounded solve is the max-flow min-cut identity, i.e., equality between computed throughput and minimum cut capacity in the solved network. This dual certificate connects the engineering quantity “maximum deliverable throughput” with the structural bottleneck cross-section and allows one solve to provide both performance and bottleneck information (Ford and Fulkerson, 1956).

### A4 Integrality and connectivity counts
When capacities are integral (in particular unit capacities), integrality guarantees integer-valued optimal flows. This property underpins integer interpretation of connectivity metrics derived from unit-capacity constructions and provides a direct consistency check for edge/node-disjoint path counts (Ford and Fulkerson, 1962).

### A5 Menger link to redundancy
Redundancy metrics are anchored in Menger’s path-cut equalities: unit-capacity max-flow equals the maximum number of edge-disjoint (or internally node-disjoint) source-to-sink paths, hence equals the corresponding minimum cut cardinality. This yields an exact flow-based route-independence interpretation for redundancy indicators used in the framework (Menger, 1927).

### A6 Min-cut lattice interpretation
Minimum cuts are not unique in general; they form a lattice characterized by residual reachability bounds. This structure enables exact identification of edges present in at least one minimum cut versus every minimum cut, and supports bounded enumeration of alternative minimum-cut failure modes from a single baseline solve (Picard and Queyranne, 1982).

### A7 Node-capacity transformation
Node-capacitated constraints are handled by exact node splitting, converting node limits into internal edge limits while preserving throughput and feasible-flow correspondence. This permits reuse of edge-capacitated solvers without changing optimization objective semantics.

### A8 Solver family
The implementation supports Edmonds-Karp, Dinic, and push-relabel variants under a common input/output contract. Dinic is used as the default algorithm in the implementation, while algorithm interchangeability is retained for sensitivity checks and reproducibility.

### A9 Multi-source/multi-sink reduction
The methodology uses exact super-node augmentation to convert multi-terminal throughput computation into a single-source single-sink flow instance. This avoids decomposition approximations and preserves equivalence of feasible and optimal flow values between original and augmented problems.

### A10 Directed global min-cut procedure
Global directed min-cut is computed via a two-pass fixed-terminal strategy requiring repeated exact max-flow solves. This is exact for the directed global cut objective and is retained for implementation simplicity, while acknowledging that faster specialized algorithms exist for large-scale settings (Hao and Orlin, 1994).

### A11 Failure impact metrics
Single-edge and multi-edge failure impacts are computed by explicit perturb-and-resolve experiments under exact re-optimization. Reported drops are therefore exact for tested perturbations, with computational tractability controlled by candidate-set design and user-specified combination bounds.

### A12 Sensitivity and importance
Edge importance is quantified using flow-drop ranking, finite-difference marginal capacity gain, and a flow-analogue Birnbaum range score between zero-capacity and infinite-capacity scenarios. These indicators are structural sensitivity measures on throughput, not probability-based reliability importances.

### A13 Threshold margins
Component resilience is represented by degradation and upgrade thresholds for target throughput constraints. Thresholds are obtained through piecewise-linear parametric behavior of max-flow and partition-aware recursion, providing topology-aware capacity margins for each analysed component (Gallo et al., 1989).

### A14 Path-based interpretation
Two path views are separated methodologically: structural path enumeration (all feasible source-to-sink routes) and additive flow decomposition (routes carrying positive solved flow whose components exactly reconstruct total throughput). This distinction avoids conflating route existence with route utilization.

### A15 Post-solve consistency checks
Each bounded solve is validated by capacity-feasibility, node-conservation, and max-flow/min-cut equality checks. Together these enforce primal feasibility and dual optimality consistency before downstream structural analyses are interpreted.

### A16 Candidate-pruning caveat
Where perturbation analyses use restricted candidate sets for computational control, results are exact on the evaluated set and should be reported with that scope qualifier. Global exhaustiveness claims should be reserved for analyses run on complete edge sets or complete combination spaces.

### A17 Structural-preprobabilistic role
The deterministic flow layer is used as a structural precursor to probabilistic reliability modelling. It supplies bottleneck sets, SPOFs, threshold margins, and failure-mode candidates that define the event structure and influential components for subsequent uncertainty propagation.

### A18 Birnbaum analogy wording
Classical Birnbaum importance is sensitivity of a reliability function to component reliability; the flow analogue used here is sensitivity/range of throughput with respect to component capacity. The measures are formally analogous as component-to-system sensitivity maps but operate on different system response variables.

### A19 Complexity reporting sentence
“Complexity is reported as baseline per-solve solver complexity multiplied by the number of required perturbation or terminal-pair solves for each derived analysis; consequently, throughput and bottleneck extraction are single-solve tasks, while connectivity and combinatorial failure studies are repeated-solve tasks with scaling dominated by call count.”

### A20 Honest package-comparison sentence
“For a single source-sink max-flow solve, external Julia graph-flow packages solve an equivalent optimization problem with comparable theoretical complexity classes; the distinct contribution of this framework is integration of multi-terminal handling and a downstream reliability-oriented analysis pipeline over a shared domain-specific data model.”

### A21 Performance caution sentence
“No blanket runtime superiority claim is made without controlled benchmarking across matched graph classes and hardware conditions.”

### A22 Data-model sentence
“Sparse edge-key dictionaries and adjacency index dictionaries are used to align directly with upstream input processing and to retain edge-level semantic identity through all perturbation and structural analyses.”

### A23 Extensibility sentence
“Algorithm selection is centralized via symbolic dispatch, preserving a stable public result contract while allowing solver substitution without changing analysis-call signatures.”

## Appendix B — In-text Citation Phrases

- Max-flow/min-cut optimality: “(Ford and Fulkerson, 1956)”.
- Integrality for integer/unit capacities: “(Ford and Fulkerson, 1962)”.
- Path-cut disjointness equivalence: “(Menger, 1927)”.
- Connectivity ordering relation: “(Whitney, 1932)”.
- Edmonds-Karp complexity basis: “(Edmonds and Karp, 1972)”.
- Dinic blocking-flow method: “(Dinic, 1970)”.
- Push-relabel framework: “(Goldberg and Tarjan, 1988)”.
- Parametric max-flow structure: “(Gallo et al., 1989)”.
- Directed global min-cut algorithmic benchmark: “(Hao and Orlin, 1994)”.
- Min-cut lattice characterization: “(Picard and Queyranne, 1982)”.
- Reliability importance origin: “(Birnbaum, 1969)”.