Information Propagation Analysis Framework — Full Summary
1. What the Framework Does
This is a research framework for computing exact probabilistic reachability on DAG networks under uncertainty. Given a directed acyclic graph where each node has a prior probability (of being "active") and each edge has a transmission probability (of passing a signal), the framework computes the exact belief that each node receives at least one signal from the source nodes.

The core formula is:


Belief(N) = Prior(N) × P(N receives ≥1 signal from sources)
The research contribution is making this computation exact (not approximate) on arbitrary DAGs — not just trees — by correctly handling diamond structures (reconvergent paths) via conditional expectation and inclusion-exclusion. The framework then extends this to three additional analysis types (capacity, time, cost), all generalized to work under three levels of uncertainty: crisp values, intervals, and probability boxes.

2. The 4 Analysis Types
Analysis	Question It Answers	Algorithm	Key Output
Exact Inference (Reachability)	"What is the probability each node receives a signal from the sources?"	Iterative belief propagation with diamond-aware inclusion-exclusion	Per-node belief values, sensitivity scores, diamond efficiency
Capacity Analysis	"What is the maximum sustainable flow through this network?"	Topological-order max-flow with node+edge capacity constraints	Per-node max flow, bottleneck identification, network utilization, upgrade priorities
Time Analysis (CPM)	"How long does the longest path through this network take?"	Forward pass (ES/EF) + backward pass (LS/LF) critical path method	Critical path duration, per-node slack, critical vs near-critical nodes
Cost Analysis (CPM)	"What is the total accumulated cost along the critical path?"	Same CPM engine with cost parameters and additive propagation	Critical path cost, per-node budget share, cost-critical vs time-critical path comparison
The CPM module is fully pluggable — combination functions (max, min, sum), propagation functions (additive, multiplicative), and node functions are all configurable, making it a generalized DAG propagation engine.

3. The 3 Data Types
Type	Representation	What It Models	Example
Float64	Single number (e.g., 0.85)	Deterministic/crisp knowledge — you know the exact probability	A well-characterized link with measured reliability
Interval	Bounded range [lower, upper] (e.g., [0.7, 0.9])	Epistemic uncertainty — you know the probability lies within bounds but not where	A sensor with known calibration tolerance
P-box	Probability box with distributional bounds (mean bounds, variance bounds, shape)	Imprecise probability — you have partial distributional knowledge	Equipment degradation where you know the failure distribution family but parameters are uncertain
The progression Float64 → Interval → P-box represents increasing honesty about uncertainty. Float64 pretends you know everything precisely. Intervals admit bounded ignorance. P-boxes capture partial distributional knowledge without forcing false precision.

All arithmetic in InputProcessingModule.jl is polymorphic across these three types — every operation (add, multiply, complement, min, max) dispatches correctly based on the type, with interval arithmetic using all 4 endpoint products and p-box arithmetic using PBA.convIndep() under independence assumptions.

4. How Diamonds Work (and Why They're Hard)
A diamond is a reconvergent subgraph: a fork node sends information along multiple paths that later converge at a join node.


    Fork
   /    \
  A      B       ← Two paths from the same fork
   \    /
    Join
Why they're hard: Naive belief propagation assumes incoming signals at a join node are independent. But in a diamond, the signals through A and B both originated from the same fork — they share a common ancestor, so they are not independent. Treating them as independent gives incorrect (typically overestimated) reachability.

How the framework solves it: Via conditional expectation over the conditioning nodes (the shared fork ancestors):


P(Join) = Σ over all states s  P(state s) × P(Join | state s)
Where each "state" is a binary assignment to the k conditioning nodes (active/inactive). For each state, the conditioning nodes are clamped to 0 or 1, making the remaining paths independent, so standard inclusion-exclusion works. This gives an exact result at the cost of 2^k state evaluations per diamond.

The DiamondProcessingModule.jl handles detection through a 9-step algorithm: find shared fork ancestors of each join node's parents → extract the induced subgraph → identify conditioning nodes → recursively expand for completeness → handle nested sub-diamonds. The module supports parallel processing of diamond subtrees across threads and includes extensive caching/memoization via hash keys.

5. Frontend Architecture — Data Flow

Upload ──→ AnalysisStateService (singleton hub) ──→ Analysis Views ──→ System Profile
Step-by-step:

Upload (upload-network.component.ts): User selects a folder containing a .EDGES file + scenario subfolders. Files are uploaded to the Julia backend and auto-categorized by FileManagerService using regex patterns on filenames/paths into ReachabilityFileGroup[], CapacityFileGroup[], CpmFileGroup[].

State initialization: AnalysisStateService calls /network-structure on the backend, stores the parsed NetworkStructure, and enables analysis tabs based on which data types are present (reachability data → diamonds + exact inference tabs; capacity data → capacity tab; CPM data → time + cost tabs).

Analysis views (exact-inference, capacity, time, cost, diamonds): Each view uses a tabbed scenario pattern — one tab per scenario, each with independent idle → computing → computed status. Users explicitly trigger runScenario() or runAllScenarios(). Results are cached in view state so navigation doesn't re-trigger backend calls. After computation, each view pushes results to the centralized state via pushToCentralizedState().

System Profile (system-profile.service.ts): A read-only aggregation dashboard that makes zero backend calls. It reads cached multi-scenario outputs from AnalysisStateService, extracts numeric values (midpoint for intervals, mean midpoint for p-boxes), generates hotspot alerts, and presents a 3-tab decision workflow:

- Decision Workspace: scenario status matrix, cross-scenario heatmap, and network lens.
- Insights & Recommendations: collapsible cross-scenario insight groups plus optimization recommendations.
- Scenario Cards: per-scenario compact cards and alert context.

Network Lens graph options are data-driven per selected scenario (capacity bottlenecks/upgrades/critical paths, CPM critical nodes, low-belief reachability nodes, diamond structure nodes). Only options with backing API result data are shown.

Heatmap double-click drilldown navigates to the relevant analysis page with scenario/metric context in query params.