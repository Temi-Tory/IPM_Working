# Flow Module Solver Variants and Julia Implementation Notes

This note describes what the core flow solver actually does, how the three solver variants differ, why the current Julia data structures were chosen, and what the returned `FlowSolveResult` contains.

---

## 1. Standard input contract from the InputProcessing stage

The flow code does **not** reconstruct graph structure internally from a general graph object. It expects the preprocessed metadata contract already produced upstream:

| Input | Type | Role in the solver |
|---|---|---|
| `edgelist` | `Vector{Tuple{Int64,Int64}}` | Canonical list of original directed edges; used for iteration order and for mapping final results back to original graph coordinates. |
| `outgoing_index` | `Dict{Int64,Set{Int64}}` | Forward adjacency map `u => {v_1,v_2,...}` used for BFS/DFS expansion and residual forward moves. |
| `incoming_index` | `Dict{Int64,Set{Int64}}` | Reverse adjacency map `v => {u_1,u_2,...}` used for backward residual moves and inflow queries. |
| `capacities` | `Dict{Tuple{Int64,Int64},Float64}` | Edge-capacity lookup table used in every residual-capacity update. |
| `source_nodes` | `Vector{Int64}` | Explicit source set. No source auto-detection is performed. |
| `sink_nodes` | `Vector{Int64}` | Explicit sink set. No sink auto-detection is performed. |

This contract is a good fit for the current toolkit because the downstream modules also need exact edge-keyed and node-keyed lookups. The flow solver therefore works directly on the same metadata representation instead of converting repeatedly between object types.

---

## 2. Shared solver logic used by all three variants

All three solvers compute the same mathematical object: an exact maximum flow subject to edge-capacity bounds and flow conservation. The difference is only **how** the residual network is traversed and updated.

Common runtime steps:

1. Validate the graph and capacity inputs.
2. Build an augmented internal graph by adding a super-source and super-sink when multiple sources or sinks are supplied.
3. Initialize flow to zero on all augmented edges.
4. Detect immediately whether an infinite augmenting path exists.
5. Run one of the exact update schemes (`Edmonds-Karp`, `Dinic`, or `Push-Relabel`).
6. After termination, compute:
   - original-edge flow,
   - residual capacities,
   - node through-flow summary,
   - one residual-reachability min-cut partition,
   - per-sink delivered flow,
   - saturated edges.
7. Validate capacity feasibility, conservation, and max-flow/min-cut consistency (unless the solve is unbounded).

Important point: the public result is always reported on **original graph coordinates**, even though the internal solve may use super-terminal augmentation.

---

## 3. Solver variants: how they differ

### 3.1 Comparison table

| Solver | Core idea | Main temporary structures | Best fit DAG pattern | Less ideal when | Notes on this implementation |
|---|---|---|---|---|---|
| `:edmonds_karp` | Repeated BFS shortest augmenting paths in the residual graph | `parent` map, BFS queue, explicit path reconstruction | Small DAGs, sanity checks, debugging, cases where path-by-path traceability matters | Large graphs with many augmentations | Simple and transparent. Good reference implementation, but usually the slowest of the three on larger instances. |
| `:dinic` | Alternates between level-graph construction and blocking-flow DFS | `level` map, level-respecting adjacency, per-node pointer `ptr` | Most sparse-to-moderate DAGs, layered networks, typical infrastructure reliability graphs | Some very dense graphs may reduce its advantage | Best default choice for this toolkit. It matches the layered structure of many DAG models and avoids one-path-at-a-time behavior. |
| `:push_relabel` | Maintains a preflow and moves excess locally using push/relabel operations | `height`, `excess`, merged neighbor lists, active-node set | Dense DAGs, high-fan-out graphs, cases with lots of local redistribution | Small graphs where setup overhead dominates; cases where path-trace interpretability is desired | Exact and robust. In this codebase it is a straightforward preflow-push implementation, not an aggressively tuned highest-label/gap-relabel variant. |

### 3.2 Practical recommendation

- Use **`Dinic`** as the default for most runs.
- Use **`Edmonds-Karp`** when you want the clearest augmenting-path logic or a baseline cross-check.
- Use **`Push-Relabel`** when the network is denser or has many parallel redistribution routes.

---

## 4. Julia implementation notes and design choices

### 4.1 Why the code uses `Dict` + `Set` instead of a graph object wrapper

The solver spends most of its time doing four things:
- look up capacity on a specific edge,
- look up current flow on a specific edge,
- iterate outgoing neighbors of a node,
- iterate incoming neighbors of a node.

The current metadata contract supports all four operations directly:

- `Dict{Tuple{Int64,Int64},Float64}` gives direct edge-key lookup for capacities and flows.
- `Dict{Int64,Set{Int64}}` gives direct neighbor access for both forward and backward residual traversal.
- `Vector{Tuple{Int64,Int64}}` preserves the original edge set and makes result remapping straightforward.

This is a sensible design for a toolkit where **exact edge identities matter** in downstream cut, sensitivity, and failure analysis.

### 4.2 Super-terminal reduction is handled internally

The solver does not expose a separate public “multi-source” result type. Instead it:
- adds `super_source = min_node - 1`,
- adds `super_sink = min_node - 2`,
- connects them to the actual source/sink sets with `Inf` capacities,
- solves once on the augmented graph,
- then remaps the public outputs back to the original graph.

That choice keeps the external API simple while still supporting multi-source/multi-sink cases exactly.

### 4.3 Residual-graph handling is explicit and exact

The implementation keeps forward and backward residual moves explicit:
- forward residual on `(u,v)` is `capacity(u,v) - flow(u,v)`,
- backward residual on `(u,v)` is `flow(u,v)`.

This is used consistently across BFS, Dinic DFS, and Push-Relabel updates.

### 4.4 Important implementation-specific optimizations

| Choice | Why it matters |
|---|---|
| Precomputed `outgoing_index` and `incoming_index` | Avoids rebuilding adjacency on every solver call. |
| `_has_infinite_augmenting_path(...)` pre-check | Detects truly unbounded cases immediately before expensive iteration begins. |
| Dinic level graph + `ptr` cursor | Prevents repeated rescanning of exhausted edges during blocking-flow DFS. |
| Push-Relabel merged neighbor lists | Gives a unified local neighborhood view for both forward and backward residual pushes. |
| Push-Relabel source dispatch bound | Prevents pathological initialization when super-terminal connectors have `Inf` capacity. |
| Post-solve validation hooks | Catches violations of capacity bounds, conservation, and max-flow/min-cut consistency early. |
| Original vs augmented result separation | Preserves exact solver internals for advanced analysis while keeping public outputs easy to interpret. |

### 4.5 What is intentionally **not** in the current implementation

The current code is exact, but it is not trying to be a highly tuned low-level max-flow benchmark library. In particular:
- it does not use a compact CSR-style graph storage layout,
- it does not use specialized gap relabel/global relabel heuristics in the push-relabel path,
- it does not auto-detect terminals,
- it does not hide edge identities behind a more abstract graph type.

That is a reasonable tradeoff for a reliability-analysis toolkit where interpretability and exact remapping matter as much as raw solver speed.

---

## 5. `FlowSolveResult`: full output structure

`FlowSolveResult` is the baseline result object returned by all three max-flow solvers.

| Field | Type | What it represents | How it is derived |
|---|---|---|---|
| `max_flow` | `Float64` | Total delivered throughput from source set to sink set | Accumulated from bottleneck pushes (`Edmonds-Karp`, `Dinic`) or recomputed as `sum(values(sink_flow))` (`Push-Relabel`) |
| `flow` | `Dict{Tuple{Int64,Int64},Float64}` | Final flow on **original** edges only | Extracted from the final augmented flow by restricting to `edgelist` |
| `augmented_flow` | `Dict{Tuple{Int64,Int64},Float64}` | Final flow on the augmented graph, including super-terminal edges | Stored directly from the internal solve state |
| `augmented_outgoing` | `Dict{Int64,Set{Int64}}` | Outgoing adjacency of the augmented graph | Built in `_build_augmented_network(...)` |
| `augmented_incoming` | `Dict{Int64,Set{Int64}}` | Incoming adjacency of the augmented graph | Built in `_build_augmented_network(...)` |
| `augmented_capacities` | `Dict{Tuple{Int64,Int64},Float64}` | Capacities on the augmented graph | Original capacities plus super-terminal connector capacities |
| `residual_capacity` | `Dict{Tuple{Int64,Int64},Float64}` | Residual capacity on each original edge after the solve | Computed as `capacities[e] - flow[e]` |
| `node_flow` | `Dict{Int64,Float64}` | Through-flow summary by original node | For sources: outflow; for sinks: inflow; for transit nodes: conserved through-flow |
| `sources` | `Vector{Int64}` | Original source-node IDs used for the solve | Copied through into the result |
| `sinks` | `Vector{Int64}` | Original sink-node IDs used for the solve | Copied through into the result |
| `super_source` | `Int64` | Internal super-source ID used in the augmented network | Assigned as `minimum(node_ids) - 1` |
| `super_sink` | `Int64` | Internal super-sink ID used in the augmented network | Assigned as `minimum(node_ids) - 2` |
| `mincut_S` | `Set{Int64}` | One source-side minimum-cut node set | Computed from residual reachability from the super-source after termination |
| `mincut_T` | `Set{Int64}` | One sink-side minimum-cut node set | Complement of the reachable set in the augmented node set |
| `mincut_capacity` | `Float64` | Capacity of the reported minimum cut | Sum of augmented cut-crossing capacities excluding connector edges |
| `saturated_edges` | `Vector{Tuple{Int64,Int64}}` | Original finite-capacity edges that are fully used within tolerance | Selected by checking `abs(flow[e] - capacities[e]) <= tol` |
| `sink_flow` | `Dict{Int64,Float64}` | Delivered flow to each original sink | Read from the flow on the connector edges `(t, super_sink)` |
| `is_unbounded` | `Bool` | Whether the solve detected unbounded maximum flow | Set when an infinite augmenting path or infinite bottleneck is found |

### 5.1 Which fields are mainly for downstream analysis?

- **Throughput-facing fields:** `max_flow`, `sink_flow`, `node_flow`
- **Edge-level diagnostics:** `flow`, `residual_capacity`, `saturated_edges`
- **Cut/bottleneck diagnostics:** `mincut_S`, `mincut_T`, `mincut_capacity`
- **Internal transformation support:** `augmented_flow`, `augmented_outgoing`, `augmented_incoming`, `augmented_capacities`, `super_source`, `super_sink`

This split is deliberate: the public object is useful both for direct reporting and for more advanced modules that need the residual or augmented solve state.

---

## 6. Which introduction objectives the core flow result already answers

The baseline `FlowSolveResult` already answers some of the introduction questions directly, but not all of them.

| Introduction objective | Answered directly by `FlowSolveResult`? | Relevant fields |
|---|---|---|
| What maximum throughput can the network deliver under current capacities? | **Yes** | `max_flow` |
| Which cut sets form the binding bottlenecks on that throughput? | **Yes, at baseline level** | `mincut_S`, `mincut_T`, `mincut_capacity`, `saturated_edges` |
| Which component failures or capacity perturbations most reduce deliverable flow? | **No** | Requires `FailureImpactModule` / `SensitivityModule` |
| What degradation or upgrade threshold is required to maintain a target demand level? | **No** | Requires `ParametricThresholdModule` |
| How much edge and node redundancy exists in path-disjoint terms? | **Not directly** | Requires `StructuralModule` / `GlobalConnectivityModule` |
| Which components are structural single points of failure? | **Not directly** | Requires `StructuralModule` or node-capacitated analysis |

So the baseline flow solve is the **core exact primitive** for the toolkit, but it is not the whole toolkit. It answers the throughput and baseline bottleneck questions itself; the other modules consume this result to answer the higher-order resilience and planning questions.

---

## 7. Bottom line

- The three solver variants solve the **same** max-flow problem.
- The important implementation difference is the residual-update strategy, not the mathematical model.
- `Dinic` is the best default for most DAG-style capacity-analysis workloads.
- The current Julia design is intentionally built around explicit edge/node metadata because downstream analysis depends on exact edge identities and exact remapping to the original graph.
- `FlowSolveResult` is the shared baseline object that the rest of the toolkit builds on.
