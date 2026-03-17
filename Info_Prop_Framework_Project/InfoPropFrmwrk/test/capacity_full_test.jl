project_root = dirname(dirname(@__FILE__))
network_dir = joinpath(project_root, "example-networks", "capacity")

title(msg) = println("\n=== $(msg) ===")
section(msg) = println("\n  --- $(msg) ---")

include(joinpath(project_root, "src", "Algorithms", "Shared", "InputProcessingModule.jl"))
using .InputProcessingModule

include(joinpath(project_root, "src", "Algorithms", "FlowCapacity", "CapacityAnalysisKit.jl"))
using .CapacityAnalysisKit

title("SECTION A: Setup and loading")

edgelist, outgoing_index, incoming_index, source_nodes_set =
    read_graph_to_dict(joinpath(network_dir, "network.edges"))

source_nodes = sort!(collect(source_nodes_set))
all_nodes = sort!(collect(union(Set(first.(edgelist)), Set(last.(edgelist)))))
sink_nodes = sort!([n for n in all_nodes
    if !haskey(outgoing_index, n) || isempty(outgoing_index[n])])

capacities = read_edge_capacities_from_json(
    joinpath(network_dir, "edge_capacities.json")
)

node_capacities = read_node_capacities_from_json(
    joinpath(network_dir, "node_capacities.json")
)

println("=== NETWORK LOADED ===")
println("  Nodes: $(length(all_nodes))")
println("  Edges: $(length(edgelist))")
println("  Sources: $source_nodes")
println("  Sinks: $sink_nodes")
println("  Node capacity constraints: $(length(node_capacities))")

title("SECTION B: Individual algorithm comparison")
println("=== ALGORITHM COMPARISON ===")

r_dinic = solve_max_flow_dinic(
    edgelist, outgoing_index, incoming_index,
    capacities, source_nodes, sink_nodes;
    tol=1e-10, validate=true
)

r_ek = solve_max_flow_edmonds_karp(
    edgelist, outgoing_index, incoming_index,
    capacities, source_nodes, sink_nodes;
    tol=1e-10, validate=true
)

r_pr = solve_max_flow_push_relabel(
    edgelist, outgoing_index, incoming_index,
    capacities, source_nodes, sink_nodes;
    tol=1e-10, validate=true
)

for (name, r) in (("dinic", r_dinic), ("edmonds_karp", r_ek), ("push_relabel", r_pr))
    println("  $name:")
    println("    max_flow=$(r.max_flow)")
    println("    mincut_capacity=$(r.mincut_capacity)")
    println("    is_unbounded=$(r.is_unbounded)")
    println("    saturated_edges=$(length(r.saturated_edges))")
end

tol_alg = 1e-8
abs(r_dinic.max_flow - r_ek.max_flow) <= tol_alg || error("Algorithm mismatch in max_flow (dinic vs edmonds_karp)")
abs(r_dinic.max_flow - r_pr.max_flow) <= tol_alg || error("Algorithm mismatch in max_flow (dinic vs push_relabel)")
abs(r_dinic.mincut_capacity - r_ek.mincut_capacity) <= tol_alg || error("Algorithm mismatch in mincut_capacity (dinic vs edmonds_karp)")
abs(r_dinic.mincut_capacity - r_pr.mincut_capacity) <= tol_alg || error("Algorithm mismatch in mincut_capacity (dinic vs push_relabel)")
println("  ✓ All algorithms agree on max_flow")

title("SECTION C: Full pipeline — analyze_all")
println("=== FULL PIPELINE (analyze_all) ===")

kit = analyze_all(
    edgelist, outgoing_index, incoming_index,
    capacities, source_nodes, sink_nodes;
    node_capacities=node_capacities,
    k_failure=2,
    cut_limit=100,
    path_limit=1000,
    algorithm=:dinic,
    tol=1e-10
)

section("Baseline Flow")
println("  max_flow: $(kit.baseline_max_flow)")
println("  min_cut_capacity: $(kit.flow.mincut_capacity)")
println("  saturated edges: $(kit.flow.saturated_edges)")
println("  sink flows: $(kit.flow.sink_flow)")

section("Sensitivity")
critical_top = first(sort!(copy(kit.sensitivity.critical_edges); by=x -> (-x.drop, x.edge)), min(3, length(kit.sensitivity.critical_edges)))
println("  top critical edges (drop):")
for e in critical_top
    println("    $(e.edge): drop=$(e.drop), baseline=$(e.baseline_flow), perturbed=$(e.perturbed_flow)")
end

birnbaum_sorted = sort!(collect(kit.sensitivity.birnbaum); by=x -> (-x[2], x[1]))
println("  top birnbaum:")
for (edge, val) in birnbaum_sorted[1:min(3, length(birnbaum_sorted))]
    println("    $edge: $val")
end

marginal_sorted = sort!(collect(kit.sensitivity.marginal_capacity); by=x -> (-x[2], x[1]))
println("  top marginal capacity values:")
for (edge, val) in marginal_sorted[1:min(3, length(marginal_sorted))]
    println("    $edge: $val")
end

section("Failure Impact")
single_top = first(sort!(copy(kit.failure_impact.single_edge_failures); by=x -> (-x.drop, x.edge)), min(3, length(kit.failure_impact.single_edge_failures)))
println("  top single-edge failures:")
for r in single_top
    println("    $(r.edge): drop=$(r.drop), critical=$(r.is_critical), unbounded=$(r.is_unbounded)")
end

k_top = first(sort!(copy(kit.failure_impact.k_edge_failures); by=x -> (-x.drop, x.edges)), min(3, length(kit.failure_impact.k_edge_failures)))
println("  top k=2 failures:")
for r in k_top
    println("    $(r.edges): drop=$(r.drop), unbounded=$(r.is_unbounded)")
end
println("  min cut sets: $(kit.failure_impact.min_cut_edges)")

section("Structural")
println("  SPOF edges: $(kit.structure.spof_edges)")
println("  SPOF nodes: $(kit.structure.spof_nodes)")
println("  paths enumerated: $(length(kit.structure.paths))")
println("  bottleneck ranking:")
for b in kit.structure.bottleneck_ranking
    println("    rank=$(b.rank), edge=$(b.edge), cap=$(b.capacity), flow=$(b.flow), residual=$(b.residual_capacity)")
end

on_cut = Int64[]
upstream = Int64[]
downstream = Int64[]
for (n, pos) in kit.structure.node_positions
    if pos == :on_cut
        push!(on_cut, n)
    elseif pos == :upstream
        push!(upstream, n)
    elseif pos == :downstream
        push!(downstream, n)
    end
end
sort!(on_cut); sort!(upstream); sort!(downstream)
println("  node positions:")
println("    :on_cut      => $on_cut")
println("    :upstream    => $upstream")
println("    :downstream  => $downstream")
println("  edge redundancy scores: $(kit.structure.edge_redundancy)")

section("Flow Decomposition")
for c in kit.flow_decomposition.components
    println("  path $(c.path) → $(c.flow_value)")
end
println("  total decomposed: $(kit.flow_decomposition.total_flow)")

section("Parametric Thresholds")
for t in sort!(copy(kit.parametric_thresholds.degradation_thresholds); by=x -> (x.degradation_margin, x.target_edge))
    println("  edge $(t.target_edge): margin=$(t.degradation_margin)")
    println("    threshold_capacity=$(t.threshold_capacity)")
    println("    target_achievable=$(t.target_achievable)")
end

section("Node-Capacitated Flow")
println("  max_flow with node constraints: $(kit.node_capacitated.flow_result.max_flow)")
println("  saturated nodes: $(kit.node_capacitated.flow_result.saturated_nodes)")
println("  SPOF nodes: $(kit.node_capacitated.spof_nodes)")

section("Min-Cut Analysis")
println("  cuts enumerated: $(kit.min_cut_analysis.enumeration.total_cuts)")
println("  is_complete: $(kit.min_cut_analysis.enumeration.is_complete)")
println("  edges in every cut: $(kit.min_cut_analysis.edges_in_every_cut)")
println("  edges in some cut: $(kit.min_cut_analysis.edges_in_some_cut)")

section("Global Connectivity")
println("  lambda (edge connectivity): $(kit.global_connectivity.edge_connectivity.lambda)")
println("  kappa (node connectivity): $(kit.global_connectivity.node_connectivity.kappa)")
println("  global min-cut capacity: $(kit.global_connectivity.global_min_cut.min_cut_capacity)")
println("  global min-cut edges: $(kit.global_connectivity.global_min_cut.min_cut_edges)")

title("SECTION D: Mathematical invariant checks")
println("=== INVARIANT CHECKS ===")

tol = 1e-8
pass_count = 0
total_count = 0

function run_check(pred::Function, desc::String)
    global pass_count, total_count
    total_count += 1
    try
        if pred()
            println("  ✓ $desc")
            pass_count += 1
        else
            println("  ✗ FAILED: $desc — predicate returned false")
        end
    catch e
        println("  ✗ FAILED: $desc — $(e)")
    end
end

run_check("max_flow == mincut_capacity") do
    abs(kit.flow.max_flow - kit.flow.mincut_capacity) <= tol
end

run_check("Flow decomposition total == max_flow") do
    abs(kit.flow_decomposition.total_flow - kit.flow.max_flow) <= tol
end

run_check("edges_in_every_cut ⊆ edges_in_some_cut") do
    issubset(Set(kit.min_cut_analysis.edges_in_every_cut),
             Set(kit.min_cut_analysis.edges_in_some_cut))
end

run_check("All three algorithms agree") do
    max(abs(r_dinic.max_flow - r_ek.max_flow),
        abs(r_dinic.max_flow - r_pr.max_flow)) <= tol
end

run_check("node_capacitated max_flow ≤ baseline max_flow") do
    kit.node_capacitated.flow_result.max_flow <= kit.flow.max_flow + tol
end

run_check("global min-cut capacity ≤ max_flow") do
    kit.global_connectivity.global_min_cut.min_cut_capacity <= kit.flow.max_flow + tol
end

run_check("lambda is nonnegative") do
    kit.global_connectivity.edge_connectivity.lambda >= 0
end

run_check("All degradation margins ≥ 0") do
    all(t.degradation_margin >= -tol for t in kit.parametric_thresholds.degradation_thresholds)
end

run_check("All birnbaum importances ≥ 0") do
    all(v >= -tol for v in values(kit.sensitivity.birnbaum))
end

run_check("SPOF edges ⊆ edges_in_every_cut") do
    issubset(Set(kit.structure.spof_edges),
             Set(kit.min_cut_analysis.edges_in_every_cut))
end

run_check("Flow decomposition components all have flow_value > 0") do
    all(c.flow_value > tol for c in kit.flow_decomposition.components)
end

run_check("Type identity checks (canonical types)") do
    typeof(kit.sensitivity.critical_edges[1]) == CapacityAnalysisKit.CapacityTypes.CriticalEdgeRecord &&
    typeof(kit.structure.bottleneck_ranking[1]) == CapacityAnalysisKit.CapacityTypes.BottleneckRecord &&
    typeof(kit.failure_impact.single_edge_failures[1]) == CapacityAnalysisKit.CapacityTypes.SingleEdgeFailureRecord
end

println("  Results: $pass_count / $total_count passed")

title("SECTION E: Standalone module calls")
println("=== STANDALONE MODULE CALLS ===")

standalone_pass = 0

function try_call(f::Function, name::String)
    global standalone_pass
    try
        f()
        println("  ✓ $name")
        standalone_pass += 1
    catch e
        println("  ✗ $name: $(e)")
    end
end

flow = nothing
sens = nothing
fail = nothing
struc = nothing
decomp = nothing
thresh = nothing
upgr = nothing
nc = nothing
mc = nothing
gc = nothing

try_call("FlowModule") do
    global flow
    flow = solve_max_flow_dinic(
        edgelist, outgoing_index, incoming_index,
        capacities, source_nodes, sink_nodes
    )
end

try_call("SensitivityModule") do
    global sens
    sens = analyze_sensitivity(
        edgelist, outgoing_index, incoming_index,
        capacities, source_nodes, sink_nodes, flow
    )
end

try_call("FailureImpactModule") do
    global fail
    fail = analyze_failure_impact(
        edgelist, outgoing_index, incoming_index,
        capacities, source_nodes, sink_nodes, flow; k=1
    )
end

try_call("StructuralModule") do
    global struc
    struc = analyze_structure(
        edgelist, outgoing_index, incoming_index,
        capacities, source_nodes, sink_nodes, flow;
        path_limit=500
    )
end

try_call("FlowDecompositionModule") do
    global decomp
    decomp = decompose_flow(
        edgelist, source_nodes, sink_nodes, flow
    )
end

spof_set = Set(kit.structure.spof_edges)
test_edge = first(e for e in edgelist if isfinite(capacities[e]) && !(e in spof_set))
target_lo = 0.8 * flow.max_flow
target_hi = 1.2 * flow.max_flow

try_call("ParametricThresholdModule.find_degradation_threshold") do
    global thresh
    thresh = find_degradation_threshold(
        edgelist, outgoing_index, incoming_index,
        capacities, source_nodes, sink_nodes,
        test_edge, target_lo
    )
end

try_call("ParametricThresholdModule.find_upgrade_threshold") do
    global upgr
    upgr = find_upgrade_threshold(
        edgelist, outgoing_index, incoming_index,
        capacities, source_nodes, sink_nodes,
        test_edge, target_hi
    )
end

try_call("NodeCapacitatedFlowModule") do
    global nc
    nc = analyze_node_capacitated_flow(
        edgelist, outgoing_index, incoming_index,
        capacities, source_nodes, sink_nodes,
        node_capacities
    )
end

try_call("MinCutUtilitiesModule") do
    global mc
    mc = analyze_min_cuts(
        edgelist, outgoing_index, incoming_index,
        capacities, source_nodes, sink_nodes, flow;
        cut_limit=50
    )
end

try_call("GlobalConnectivityModule") do
    global gc
    gc = analyze_global_connectivity(
        edgelist, outgoing_index, incoming_index,
        capacities, source_nodes, sink_nodes
    )
end

println("  $(standalone_pass)/10 standalone calls succeeded")

base_ok = (pass_count == total_count) && (standalone_pass == 10)

title("SECTION F: Complex network scenario")

complex_edges_file = joinpath(network_dir, "network_complex.edges")
complex_caps_file = joinpath(network_dir, "edge_capacities_complex.json")
complex_node_caps_file = joinpath(network_dir, "node_capacities_complex.json")

complex_edgelist, complex_outgoing, complex_incoming, complex_sources_set =
    read_graph_to_dict(complex_edges_file)
complex_source_nodes = sort!(collect(complex_sources_set))
complex_all_nodes = sort!(collect(union(Set(first.(complex_edgelist)), Set(last.(complex_edgelist)))))
complex_sink_nodes = sort!([n for n in complex_all_nodes
    if !haskey(complex_outgoing, n) || isempty(complex_outgoing[n])])

complex_capacities = read_edge_capacities_from_json(complex_caps_file)
complex_node_capacities = read_node_capacities_from_json(complex_node_caps_file)

println("=== COMPLEX NETWORK LOADED ===")
println("  Nodes: $(length(complex_all_nodes))")
println("  Edges: $(length(complex_edgelist))")
println("  Sources: $complex_source_nodes")
println("  Sinks: $complex_sink_nodes")
println("  Node constraints: $(length(complex_node_capacities))")

complex_kit = analyze_all(
    complex_edgelist,
    complex_outgoing,
    complex_incoming,
    complex_capacities,
    complex_source_nodes,
    complex_sink_nodes;
    node_capacities=complex_node_capacities,
    k_failure=2,
    cut_limit=200,
    path_limit=5000,
    algorithm=:dinic,
    tol=1e-10
)

println("=== COMPLEX NETWORK SUMMARY ===")
println("  baseline max_flow: $(complex_kit.baseline_max_flow)")
println("  node-cap max_flow: $(complex_kit.node_capacitated.flow_result.max_flow)")
println("  nonzero birnbaum edges: $(count(v -> v > 1e-8, values(complex_kit.sensitivity.birnbaum)))")
println("  k=2 failures: $(length(complex_kit.failure_impact.k_edge_failures))")
println("  min-cut total_cuts: $(complex_kit.min_cut_analysis.enumeration.total_cuts)")
println("  decomposition paths: $(length(complex_kit.flow_decomposition.components))")

complex_targets_pass = 0
complex_targets_total = 0

function run_complex_target(pred::Function, desc::String)
    global complex_targets_pass, complex_targets_total
    complex_targets_total += 1
    try
        if pred()
            println("  ✓ $desc")
            complex_targets_pass += 1
        else
            println("  ✗ FAILED: $desc — predicate returned false")
        end
    catch e
        println("  ✗ FAILED: $desc — $(e)")
    end
end

println("=== COMPLEX ACCEPTANCE TARGETS ===")
run_complex_target("birnbaum nonzero on >= 4 edges") do
    count(v -> v > 1e-8, values(complex_kit.sensitivity.birnbaum)) >= 4
end

run_complex_target("k=2 failures non-empty with positive drop") do
    !isempty(complex_kit.failure_impact.k_edge_failures) &&
    any(r -> r.drop > 1e-8, complex_kit.failure_impact.k_edge_failures)
end

complex_lattice_stretch = complex_kit.min_cut_analysis.enumeration.total_cuts >= 4
if complex_lattice_stretch
    println("  ✓ stretch: min-cut enumeration has at least 4 cuts")
else
    println("  ⚠ stretch not met: min-cut enumeration has at least 4 cuts (got $(complex_kit.min_cut_analysis.enumeration.total_cuts))")
end

run_complex_target("all enumerated cuts have capacity ~= max-flow") do
    enum = complex_kit.min_cut_analysis.enumeration
    maxf = complex_kit.flow.max_flow
    tol = 1e-8
    all(c -> abs(c.capacity - maxf) <= tol, enum.cuts)
end

run_complex_target("node-capacitated flow reduces max-flow and saturates nodes") do
    (complex_kit.node_capacitated.flow_result.max_flow < complex_kit.flow.max_flow - 1e-8) &&
    !isempty(complex_kit.node_capacitated.flow_result.saturated_nodes)
end

run_complex_target("parametric thresholds contain only finite-capacity edges") do
    all(isfinite(complex_capacities[t.target_edge]) for t in complex_kit.parametric_thresholds.degradation_thresholds)
end

println("  Complex targets: $(complex_targets_pass) / $(complex_targets_total)")
println("  Note: multiple minimum cuts are demonstrated in the dedicated lattice example, not required here.")

complex_ok = complex_targets_pass == complex_targets_total

lattice_edges_file = joinpath(network_dir, "network_lattice.edges")
lattice_caps_file = joinpath(network_dir, "edge_capacities_lattice.json")

title("SECTION G: Dedicated lattice enumeration demo")

lattice_edgelist, lattice_outgoing, lattice_incoming, lattice_sources_set =
    read_graph_to_dict(lattice_edges_file)
lattice_source_nodes = sort!(collect(lattice_sources_set))
lattice_all_nodes = sort!(collect(union(Set(first.(lattice_edgelist)), Set(last.(lattice_edgelist)))))
lattice_sink_nodes = sort!([n for n in lattice_all_nodes
    if !haskey(lattice_outgoing, n) || isempty(lattice_outgoing[n])])

lattice_capacities = read_edge_capacities_from_json(lattice_caps_file)
lattice_flow = solve_max_flow_dinic(
    lattice_edgelist,
    lattice_outgoing,
    lattice_incoming,
    lattice_capacities,
    lattice_source_nodes,
    lattice_sink_nodes;
    tol=1e-10,
    validate=true
)
lattice_enum = enumerate_min_cuts(
    lattice_edgelist,
    lattice_outgoing,
    lattice_incoming,
    lattice_capacities,
    lattice_flow;
    cut_limit=20,
    tol=1e-10
)

println("=== LATTICE NETWORK SUMMARY ===")
println("  Nodes: $(length(lattice_all_nodes))")
println("  Edges: $(length(lattice_edgelist))")
println("  max_flow: $(lattice_flow.max_flow)")
println("  total_cuts: $(lattice_enum.total_cuts)")
println("  is_complete: $(lattice_enum.is_complete)")

lattice_pass = 0
lattice_total = 0

function run_lattice_check(pred::Function, desc::String)
    global lattice_pass, lattice_total
    lattice_total += 1
    try
        if pred()
            println("  ✓ $desc")
            lattice_pass += 1
        else
            println("  ✗ FAILED: $desc — predicate returned false")
        end
    catch e
        println("  ✗ FAILED: $desc — $(e)")
    end
end

println("=== LATTICE ENUMERATION CHECKS ===")
run_lattice_check("lattice max_flow == 10") do
    abs(lattice_flow.max_flow - 10.0) <= 1e-8
end

run_lattice_check("enumeration is complete") do
    lattice_enum.is_complete
end

run_lattice_check("lattice has exactly 4 minimum cuts") do
    lattice_enum.total_cuts == 4 && length(lattice_enum.cuts) == 4
end

run_lattice_check("all lattice cuts have capacity ~= max-flow") do
    all(c -> abs(c.capacity - lattice_flow.max_flow) <= 1e-8, lattice_enum.cuts)
end

run_lattice_check("enumerated source-side partitions are distinct") do
    length(Set([Tuple(sort!(collect(c.S))) for c in lattice_enum.cuts])) == 4
end

println("  Lattice checks: $(lattice_pass) / $(lattice_total)")

lattice_ok = lattice_pass == lattice_total

title("SECTION H: Final summary")
println("=== TEST SUMMARY ===")
println("  Simple network baseline max_flow: $(kit.baseline_max_flow)")
println("  Simple invariants: $pass_count / $total_count")
println("  Standalone calls: $(standalone_pass) / 10")
println("  Complex baseline max_flow: $(complex_kit.baseline_max_flow)")
println("  Complex acceptance targets: $(complex_targets_pass) / $(complex_targets_total)")
println("  Complex stretch (cuts >= 4): $(complex_lattice_stretch)")
println("  Lattice min-cut total_cuts: $(lattice_enum.total_cuts)")
println("  Lattice checks: $(lattice_pass) / $(lattice_total)")

if base_ok && complex_ok && lattice_ok
    println("  STATUS: ALL TESTS PASSED")
else
    println("  STATUS: FAILURES DETECTED — see above")
end