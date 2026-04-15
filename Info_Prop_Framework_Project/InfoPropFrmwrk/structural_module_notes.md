# StructuralModule — clear working notes

## What this module is

`StructuralModule` is the toolkit layer that turns the solved flow result into **structural diagnostics** about the network.

It is **not** one single optimisation routine. Most of it is graph traversal and exact post-processing of the baseline `flow_result`. One part, `edge_redundancy_scores`, does perform additional exact max-flow reruns in a controlled way.

In simple terms:

- `FlowModule` tells us the achieved throughput.
- `MinCutUtilitiesModule` clarifies the minimum-cut family.
- `StructuralModule` tells us **where the weak structure is**, **which components are unavoidable**, **how paths are arranged**, and **how much redundancy exists**.

---

## Why engineers need this module

Engineers are usually not satisfied with only the scalar value of maximum flow. A throughput number tells us the level of service the network can deliver, but not how fragile or well-supported that service is from a structural point of view.

For design, reinforcement, and resilience studies, we usually need further questions answered:

- Which edges or nodes are true single points of failure?
- How many viable source-to-sink paths actually exist in the current topology?
- Which cut edges are the tightest bottlenecks?
- Is the network relying on a narrow corridor or on several parallel alternatives?
- If one edge is removed, how much edge-disjoint routing capability remains?

This is the role of `StructuralModule`. It turns the solved flow and the DAG topology into interpretable structural evidence.

---

## Network model and notation

Let the network be a directed acyclic graph

```text
G = (V, E)
```

with source set `S ⊆ V`, sink set `T ⊆ V`, capacity function

```text
c : E -> R_{>=0},
```

and solved optimal flow `f*` from the baseline max-flow stage.

The module uses both the graph topology and the solved min-cut partition `(S*, T*)` from `flow_result`.

Because the framework is aimed at DAG-style infrastructure models, exact path enumeration is well-defined and terminates without cycle-handling complications.

---

## What this module takes in

The main aggregate entry point is:

```julia
analyze_structure(
    edgelist,
    outgoing_index,
    incoming_index,
    capacities,
    source_nodes,
    sink_nodes,
    flow_result;
    algorithm=:dinic,
    tol=1e-10,
    path_limit=10_000,
    redundancy_candidates=nothing,
    combination_limit=10_000,
)
```

### Core inputs

- `edgelist`: the original directed edge set
- `outgoing_index`, `incoming_index`: graph adjacency maps
- `capacities`: edge capacities
- `source_nodes`, `sink_nodes`: terminal sets
- `flow_result`: the exact solved result from `FlowModule`

### Optional controls

- `path_limit`: bound for exact path enumeration
- `redundancy_candidates`: restrict which edges get redundancy reruns
- `algorithm`: max-flow algorithm used in the redundancy stage
- `tol`: comparison tolerance

### Implementation note

`combination_limit` is accepted by `analyze_structure(...)` for API consistency, but in the current code it is reserved for future use and is not actively used inside the structural routines.

---

## What it returns

The main output type is `StructuralResult`, containing:

- `spof_edges`: edges that are structural single points of failure
- `spof_nodes`: nodes that are structural single points of failure
- `paths`: all enumerated source-to-sink paths
- `path_flow_contributions`: path-level flow contribution summaries
- `bottleneck_ranking`: cut-crossing bottleneck edges ranked by tightness
- `node_positions`: classification of nodes as `:upstream`, `:downstream`, or `:on_cut`
- `edge_redundancy`: per-edge redundancy scores

So this module does not just return one metric. It returns a structural profile of the solved network.

---

## What analyses it performs

`StructuralModule` contains six main analyses.

### 1. SPOF edge detection

`identify_spof_edges(...)` finds edges that appear in **every** minimum cut. These are edges whose criticality is unavoidable under the current solved capacity state.

### 2. SPOF node detection

`identify_spof_nodes(...)` finds nodes whose removal destroys all source-to-sink connectivity.

### 3. Exact path enumeration

`enumerate_paths(...)` lists all simple source-to-sink paths in the DAG, up to `path_limit`.

### 4. Path flow contribution analysis

`path_flow_contributions(...)` assigns each enumerated path a flow contribution based on the solved edge flows.

### 5. Bottleneck ranking

`bottleneck_ranking(...)` ranks the cut-crossing edges in the solved min-cut by capacity and tie-broken edge order.

### 6. Edge redundancy scoring

`edge_redundancy_scores(...)` quantifies how much edge-disjoint routing capability remains if a given edge is removed.

---

## Mathematical basis

### 1. SPOF edges

An edge is treated as a structural SPOF if it lies in **every** minimum cut. This is derived from the exact min-cut lattice characterisation already used by `MinCutUtilitiesModule`.

In the current code, an edge `(u,v)` is selected when it is saturated and satisfies the appropriate cut-side reachability condition relative to `S*` and `T**`.

### 2. SPOF nodes

A node `x ∈ V \ (S ∪ T)` is a structural SPOF if every source-to-sink path passes through `x`.

Equivalently, if `x` is removed from the graph and no path remains from any source in `S` to any sink in `T`, then `x` is a single point of failure.

### 3. Path flow contribution

For an enumerated path

```text
P = (v1, v2, ..., vk),
```

the path contribution reported by the code is

```text
phi(P) = min { f*(vi, vi+1) : i = 1, ..., k-1 }.
```

So each path is summarised by the smallest solved edge flow along that path, together with the path bottleneck edge.

### 4. Edge redundancy

This part uses Menger-style reasoning. With unit capacities, the solved max-flow value counts the maximum number of edge-disjoint source-to-sink paths.

For a candidate edge `e`, the module temporarily removes `e`, sets all capacities to unit values, and reruns exact max flow. The resulting integer value is the redundancy score associated with that edge under the current topology.

---

## How the algorithms work

### A. `identify_spof_edges(...)`

1. Start from the solved `flow_result`.
2. Build the relevant residual reachability information.
3. Scan the original edges.
4. Keep only edges that are saturated and belong to the exact “every minimum cut” family.
5. Return them in sorted deterministic order.

This part requires **no new solver call**.

### B. `identify_spof_nodes(...)`

1. Find nodes that lie on at least one source-to-sink path.
2. Exclude source and sink terminals.
3. For each remaining candidate node, remove it virtually.
4. Run a reachability test from the source set.
5. If no sink remains reachable, mark that node as a SPOF.

Again, this is traversal-based, not optimisation-based.

### C. `enumerate_paths(...)`

1. Start a depth-first search from each source.
2. Follow outgoing edges in sorted order.
3. Record each source-to-sink path found.
4. Stop with an error if `path_limit` is exceeded.
5. Sort all paths lexicographically for reproducibility.

This is exact because the intended network class is a DAG.

### D. `path_flow_contributions(...)`

1. Take the enumerated path list.
2. Read the solved flow on each edge of each path.
3. Compute the minimum solved edge flow along the path.
4. Record that as the path’s bottleneck contribution.
5. Sort paths by descending contribution.

### E. `bottleneck_ranking(...)`

1. Scan all edges crossing from `flow_result.mincut_S` to `flow_result.mincut_T`.
2. Record each edge’s capacity, solved flow, and residual capacity.
3. Sort by ascending capacity, then by edge tuple.
4. Assign a deterministic rank index.

### F. `edge_redundancy_scores(...)`

1. Choose the candidate edge set.
2. Replace all capacities with unit capacities.
3. Remove one candidate edge at a time by setting its capacity to zero.
4. Rerun exact max flow on the modified network.
5. Interpret the resulting integer max-flow value as the edge redundancy score.

This is the only part of the module that deliberately performs repeated exact solver reruns.

---

## Implementation and optimisation decisions

### 1. Keep most analyses solver-free

The module is designed so that SPOF detection, node classification, path enumeration, and bottleneck ranking are all derived directly from topology and the existing solved flow result. This keeps the structural stage fast and interpretable.

### 2. Use exact reruns only where theory requires them

The redundancy score cannot be recovered from one local scan alone, so the code uses rerun-based exact max-flow solves only for that part.

### 3. Exploit the DAG assumption

Exact path enumeration is practical only because the intended graph class is acyclic. In a general directed cyclic graph, path enumeration would be much harder to interpret and control.

### 4. Bound path explosion

Even in a DAG, the number of source-to-sink paths can still be large. That is why the implementation exposes `path_limit` and throws a clear error when the requested enumeration becomes too large.

### 5. Deterministic ordering

Edges, paths, and ranking outputs are explicitly sorted so that repeated runs produce the same order. This matters for debugging, reproducible case studies, and thesis tables.

### 6. Defensive correctness checks

The redundancy stage checks that the resulting unit-capacity max-flow value is integer-valued within tolerance. This is a direct implementation guard around the Menger / integrality interpretation.

---

## What insights this module brings

This module maps most strongly to the chapter objectives around:

- structural single points of failure,
- bottleneck localisation,
- path redundancy,
- and diagnosis of whether the network is corridor-dominated or genuinely well-supported.

The value of this module is that it converts the baseline throughput result into a structural explanation. It tells the analyst not just **how much** the network can deliver, but **why that level of service is fragile or resilient in topological terms**.

---

## Relationship to the other modules

`StructuralModule` sits downstream of the baseline flow solve and adjacent to the min-cut analysis.

- It uses the baseline `flow_result` heavily.
- It overlaps with `MinCutUtilitiesModule` on bottleneck interpretation.
- It complements `FailureImpactModule` by identifying which components are structurally worth perturbing.
- It supports later engineering interpretation of reinforcement priorities and network redesign.

So this module is best viewed as the toolkit’s **structural diagnostics layer**.

---

## One-sentence summary

`StructuralModule` takes the solved flow and the DAG topology and turns them into exact structural diagnostics: SPOFs, path structure, bottleneck rankings, node positions, and edge redundancy scores that explain how the network’s throughput is supported or constrained.