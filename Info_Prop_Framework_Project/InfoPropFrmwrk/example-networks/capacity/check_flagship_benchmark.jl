project_root = dirname(dirname(dirname(@__FILE__)))

include(joinpath(project_root, "src", "Algorithms", "Shared", "InputProcessingModule.jl"))
using .InputProcessingModule

include(joinpath(project_root, "src", "Algorithms", "FlowCapacity", "CapacityAnalysisKit.jl"))
using .CapacityAnalysisKit

network_dir = joinpath(project_root, "example-networks", "capacity")

edgelist, outgoing_index, incoming_index, source_nodes_set =
    read_graph_to_dict(joinpath(network_dir, "network_flagship.edges"))

source_nodes = sort!(collect(source_nodes_set))
all_nodes = sort!(collect(union(Set(first.(edgelist)), Set(last.(edgelist)))))
sink_nodes = sort!([n for n in all_nodes if !haskey(outgoing_index, n) || isempty(outgoing_index[n])])

capacities = read_edge_capacities_from_json(joinpath(network_dir, "edge_capacities_flagship.json"))
node_capacities = read_node_capacities_from_json(joinpath(network_dir, "node_capacities_flagship.json"))

result = analyze_all(
    edgelist, outgoing_index, incoming_index,
    capacities, source_nodes, sink_nodes;
    node_capacities=node_capacities,
    k_failure=2,
    cut_limit=1000,
    path_limit=20000,
    combination_limit=5000,
    algorithm=:dinic,
    tol=1e-10,
)

println("nodes=", length(all_nodes))
println("edges=", length(edgelist))
println("sources=", source_nodes)
println("sinks=", sink_nodes)
println("baseline_max_flow=", result.baseline_max_flow)
println("mincut_capacity=", result.flow.mincut_capacity)
println("paths=", length(result.structure.paths))
println("decomp_components=", length(result.flow_decomposition.components))
println("spof_edges_count=", length(result.structure.spof_edges))
println("spof_nodes=", result.structure.spof_nodes)
println("mincuts_total=", result.min_cut_analysis.enumeration.total_cuts)
println("mincuts_complete=", result.min_cut_analysis.enumeration.is_complete)
println("free_zone_size=", result.min_cut_analysis.enumeration.free_zone_size)
println("edges_in_every_cut_count=", length(result.min_cut_analysis.edges_in_every_cut))
println("edges_in_some_cut_count=", length(result.min_cut_analysis.edges_in_some_cut))
println("node_cap_max_flow=", result.node_capacitated.flow_result.max_flow)
println("saturated_nodes=", result.node_capacitated.flow_result.saturated_nodes)
println("top_single_edge_drop=", isempty(result.failure_impact.single_edge_failures) ? 0.0 : first(result.failure_impact.single_edge_failures).drop)
println("top_k2_drop=", isempty(result.failure_impact.k_edge_failures) ? 0.0 : first(result.failure_impact.k_edge_failures).drop)
println("lambda=", result.global_connectivity.edge_connectivity.lambda)
println("kappa=", result.global_connectivity.node_connectivity.kappa)


#= ## Yes — these results are now **rich enough for a strong thesis case study** ✅

Especially because you now have, with evidence:

- **nontrivial scale**: `43` nodes, `106` edges
- **true multi-source / multi-sink DAG**
- **max-flow/min-cut agreement**: `34 = 34`
- **many structural paths**: `6132`
- **flow decomposition**: `20` active components
- **multiple minimum cuts**: `4`
- **free zone**: `2`
- **node-capacitated reduction**: `34 → 30`
- **strong failure interaction**:
  - single-edge drop `17`
  - `k=2` drop `34`

That is already a **substantial and demonstrative** story for a toolkit chapter.

---

# What to include in the thesis besides the network itself

## 1. **One clear topology figure**
A layered DAG picture showing:

- source layer
- hub / processing layers
- sink layer
- highlighted bottlenecks / critical regions

> This is the main “case-study network” figure.

---

## 2. **A summary table of benchmark characteristics**
Include a compact table like:

| Property | Value |
|---|---:|
| Nodes | `43` |
| Edges | `106` |
| Sources | `5` |
| Sinks | `7` |
| Baseline max flow | `34.0` |
| Node-capacitated max flow | `30.0` |
| Structural paths | `6132` |
| Flow-decomposition components | `20` |
| Minimum cuts enumerated | `4` |
| Free-zone size | `2` |

This is very thesis-friendly.

---

## 3. **Baseline flow / cut results table**
Show:

- `max_flow`
- `mincut_capacity`
- top saturated edges
- representative cut size
- `edges_in_every_cut` vs `edges_in_some_cut`

This demonstrates the core theorem outputs.

---

## 4. **Flow decomposition figure or table**
This is important because your toolkit explicitly supports it.

Show either:

- a table of the top `5–10` flow-carrying paths and their flow values, or
- a colored network plot where edge thickness reflects decomposed flow

This makes the benchmark feel much richer and less abstract.

---

## 5. **Failure-impact ranking table**
A really useful one.

### Include:
- top single-edge failures
- top `k=2` failure combinations
- corresponding flow drops

| Failure scenario | Residual flow | Drop |
|---|---:|---:|
| edge `e1` removed | ... | ... |
| edge `e2` removed | ... | ... |
| edges `e3,e4` removed | ... | ... |

This strongly demonstrates resilience analysis.

---

## 6. **Node-capacitated comparison table**
Show the effect of adding node capacities:

| Model | Max flow |
|---|---:|
| Edge-capacitated only | `34.0` |
| Node-capacitated | `30.0` |

and list the **saturated nodes**.

This is one of the most convincing tables in the chapter.

---

## 7. **Minimum-cut lattice / cut-family figure**
Since you now have `4` minimum cuts and a free zone of `2`, this is worth visualizing.

You could include:

- a small diagram of the cut lattice, or
- a table listing the four minimum cuts and how they differ

This is especially good if the chapter is mathematically focused.

---

## 8. **Sensitivity / upgrade / threshold table**
A compact table with:

- Birnbaum importance
- marginal capacity value
- degradation threshold
- upgrade threshold

for the top few critical edges.

| Edge | Birnbaum | Marginal value | Degradation margin | Required upgrade |
|---|---:|---:|---:|---:|

This shows the toolkit is not just descriptive, but also planning-oriented.

---

## 9. **Short note on `lambda=0`, `kappa=0`**
Do not hide it — explain it.

A tiny interpretive paragraph is enough:

> Because the benchmark is a DAG, global directed connectivity is zero for some ordered node pairs. This is expected and does not contradict the positive terminal throughput.

That turns a possible examiner question into a strength.

 =#