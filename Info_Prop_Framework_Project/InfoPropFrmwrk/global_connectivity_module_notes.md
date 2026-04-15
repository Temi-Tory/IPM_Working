# GlobalConnectivityModule — clear working notes

## What this module is

`GlobalConnectivityModule` computes exact graph-theoretic connectivity diagnostics for the directed network:

- directed **edge connectivity** `lambda`
- directed **node connectivity** `kappa`
- directed **global minimum cut**

Unlike the flow, min-cut, and failure modules, this module is not primarily about source-to-sink throughput adequacy. It is a broader graph-theoretic diagnostic layer.

---

## Important caveat for this thesis context

This module should be discussed with care in a DAG-based infrastructure chapter.

For the source-to-sink delivery networks studied here, the graph is intentionally **directed and acyclic**. That means it is typically **not strongly connected**. As a result, global directed connectivity metrics such as `lambda` and `kappa` can legitimately be `0`, even when the network is still meaningful and useful as a delivery system.

So these outputs are mathematically correct, but they are often **not the primary resilience indicators** in this particular modelling context. The more central engineering measures remain:

- maximum flow,
- minimum-cut structure,
- failure impact,
- threshold margins,
- and path/bottleneck diagnostics.

This is why `GlobalConnectivityModule` is best treated as a supporting diagnostic rather than a core chapter centrepiece.

---

## Why it may still be worth including

Even with that caveat, the module is still worth documenting because it gives an exact graph-theoretic summary of how strongly connected the directed network is under edge or node removals, and it computes a directed global minimum cut with original capacities.

So it remains useful for completeness, comparison, and for readers who want the broader connectivity picture beyond the source-to-sink service interpretation.

---

## Network model and notation

Let the directed graph be

```text
G = (V, E).
```

For distinct nodes `s, t ∈ V`:

- the directed **edge connectivity** between `s` and `t` is the minimum number of edges whose removal destroys all directed `s -> t` paths,
- the directed **node connectivity** is the minimum number of internal nodes whose removal destroys all directed `s -> t` paths,
- the directed **global minimum cut** is the minimum cut capacity over the scanned directed source-sink pairs.

The module reports these in the forms `lambda`, `kappa`, and `global_min_cut`.

---

## What this module takes in

The main aggregate entry point is:

```julia
analyze_global_connectivity(
    edgelist,
    outgoing_index,
    incoming_index,
    capacities,
    source_nodes,
    sink_nodes;
    algorithm=:dinic,
    tol=1e-10,
)
```

### Inputs

- `edgelist`: original directed edges
- `outgoing_index`, `incoming_index`: adjacency maps
- `capacities`: edge capacities
- `source_nodes`, `sink_nodes`: terminal lists (validated for membership)
- `algorithm`: exact flow solver used internally
- `tol`: numerical tolerance

---

## What it returns

The aggregate type is `GlobalConnectivityResult`, containing:

- `edge_connectivity::EdgeConnectivityResult`
- `node_connectivity::NodeConnectivityResult`
- `global_min_cut::GlobalMinCutResult`

These sub-results report values such as:

- `lambda`
- `kappa`
- an achieving `(source, sink)` pair
- cut edges or cut nodes
- cut partitions for the weighted global minimum cut
- solver call counts

---

## What analyses it performs

### 1. Directed edge connectivity

`edge_connectivity(...)` computes the exact directed edge-connectivity value `lambda` using unit capacities and repeated max-flow solves.

### 2. Directed node connectivity

`node_connectivity(...)` computes the exact directed node-connectivity value `kappa` using node splitting and unit node capacities.

### 3. Directed global minimum cut

`global_min_cut(...)` computes the minimum directed cut capacity over a scanned set of source-sink orientations using the original capacities.

### 4. Aggregate connectivity analysis

`analyze_global_connectivity(...)` bundles all three into one result.

---

## Mathematical basis

### 1. Menger-style interpretation

The edge and node connectivity quantities are based on the standard Menger / max-flow-min-cut correspondence:

- with unit edge capacities, max flow counts edge-disjoint directed paths,
- with node splitting and unit node capacities, max flow counts internally node-disjoint directed paths.

This is why the returned `lambda` and `kappa` values are integer-valued and why the code checks integrality within tolerance.

### 2. Edge connectivity

For a source `s`, the module builds a graph-level super sink and solves a unit-capacity max-flow problem. The resulting flow value gives the number of edge-disjoint directed paths to the aggregated sink side for that orientation. The minimum over the scanned orientations gives `lambda`.

### 3. Node connectivity

For node connectivity, the module applies node splitting and assigns unit node capacities to internal nodes, then resolves the corresponding node-capacitated flow problem. The resulting integer value gives `kappa`.

### 4. Global minimum cut

The weighted global cut uses the original capacities, not unit capacities, and returns the minimum directed cut capacity encountered over the scanned source-sink orientations.

---

## How the algorithms work

### A. `edge_connectivity(...)`

1. Validate the graph and terminal inputs.
2. Replace all edge capacities by `1.0`.
3. For each source orientation, build a super-sink graph.
4. Solve exact max flow from the chosen source to the super sink.
5. Interpret the integer result as the directed edge-connectivity value for that orientation.
6. Keep the best (smallest) value and its achieving pair.

### B. `node_connectivity(...)`

1. Validate the graph and capacities.
2. For each source orientation, build the super-sink graph.
3. Remap node IDs into an internal reserved-ID space.
4. Apply node splitting with unit node capacities.
5. Solve the node-capacitated max-flow problem exactly.
6. Interpret the integer result as the directed node-connectivity value.
7. Map the cut nodes back to the original node IDs.

### C. `global_min_cut(...)`

1. Keep the original capacities.
2. Run directional max-flow scans over source-sink orientations.
3. Record the minimum cut capacity encountered.
4. Return the corresponding cut edges and cut partition.

---

## Implementation and optimisation decisions

### 1. Use max-flow reductions rather than separate bespoke connectivity solvers

The module deliberately reuses the existing exact flow machinery rather than implementing a separate connectivity-only solver family.

### 2. Use graph-level super-sink aggregation

For edge and node connectivity, the code uses a super-sink construction so that one solve per source orientation captures the relevant directed cut information efficiently.

### 3. Use node splitting for `kappa`

The node-connectivity computation is built on the same node-splitting idea already introduced in the mathematical model section.

### 4. Enforce integrality checks

Since unit-capacity constructions should yield integer connectivity values, the code explicitly validates this within tolerance.

### 5. Defensive remapping and reserved IDs

The node-connectivity routine reserves internal IDs and checks for collisions to avoid corrupting the split-graph construction.

---

## How to interpret the results in a DAG setting

This is the most important point for your chapter.

If the network is a directed acyclic source-to-sink system, then many ordered node pairs are simply not mutually reachable. Therefore:

- `lambda = 0` can be mathematically correct,
- `kappa = 0` can also be mathematically correct,
- and this does **not** mean the toolkit or the model is broken.

It only means that global directed strong-connectivity style metrics are not especially informative for a one-way acyclic service network.

So in this thesis context, the module should be presented as a **secondary graph-theoretic completeness check**, not as the primary resilience measure.

---

## What insights this module brings

When interpreted carefully, the module can still provide:

- a formal graph-theoretic view of directed edge/node connectivity,
- an exact weighted global cut diagnostic,
- and a useful contrast with the more operational source-to-sink flow measures.

Its greatest value here is completeness and mathematical coverage rather than central engineering decision support.

---

## Relationship to the other modules

`GlobalConnectivityModule` is more graph-theoretic than the preceding modules.

- `FlowModule`, `MinCutUtilitiesModule`, `FailureImpactModule`, and `ParametricThresholdModule` are directly tied to source-to-sink service performance.
- `GlobalConnectivityModule` broadens the view to whole-graph directed connectivity notions.

So it is best positioned near the end of the methodology discussion, after the more operational capacity-analysis modules have already been established.

---

## One-sentence summary

`GlobalConnectivityModule` computes exact directed edge connectivity, node connectivity, and global minimum-cut diagnostics using max-flow-based reductions, but in DAG-based service networks these results must be interpreted cautiously because global directed connectivity can legitimately be zero.