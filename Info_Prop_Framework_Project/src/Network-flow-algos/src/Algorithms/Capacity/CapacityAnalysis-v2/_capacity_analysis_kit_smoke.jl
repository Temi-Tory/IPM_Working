include("CapacityAnalysisKit.jl")
using .CapacityAnalysisKit

# ─────────────────────────────────────────────────────────────────────────────
# Shared test graph (2 nodes, known max flow = 1)
#
#   1 ──1──► 2
#
# Max flow (1 → 2) = 1.
# ─────────────────────────────────────────────────────────────────────────────

function _make_test_graph()
    edgelist = Tuple{Int64,Int64}[
        (1, 2)
    ]
    caps = Dict{Tuple{Int64,Int64},Float64}(
        (1, 2) => 1.0,
    )
    outgoing = Dict{Int64,Set{Int64}}(
        1 => Set([2]),
        2 => Set{Int64}(),
    )
    incoming = Dict{Int64,Set{Int64}}(
        1 => Set{Int64}(),
        2 => Set([1]),
    )
    sources = Int64[1]
    sinks   = Int64[2]
    return edgelist, outgoing, incoming, caps, sources, sinks
end

function _make_node_capacity_graph()
    edgelist = Tuple{Int64,Int64}[(1, 2), (2, 3)]
    caps = Dict{Tuple{Int64,Int64},Float64}((1, 2) => 1.0, (2, 3) => 1.0)
    outgoing = Dict{Int64,Set{Int64}}(1 => Set([2]), 2 => Set([3]), 3 => Set{Int64}())
    incoming = Dict{Int64,Set{Int64}}(1 => Set{Int64}(), 2 => Set([1]), 3 => Set([2]))
    return edgelist, outgoing, incoming, caps, Int64[1], Int64[3]
end

function _make_unbounded_graph()
    edgelist = Tuple{Int64,Int64}[(1, 2), (2, 3)]
    caps = Dict{Tuple{Int64,Int64},Float64}((1, 2) => Inf, (2, 3) => Inf)
    outgoing = Dict{Int64,Set{Int64}}(1 => Set([2]), 2 => Set([3]), 3 => Set{Int64}())
    incoming = Dict{Int64,Set{Int64}}(1 => Set{Int64}(), 2 => Set([1]), 3 => Set([2]))
    return edgelist, outgoing, incoming, caps, Int64[1], Int64[3]
end

errors = String[]

function check(cond::Bool, msg::String)
    if !cond
        push!(errors, msg)
        println("  FAIL: $msg")
    end
end

# ─────────────────────────────────────────────────────────────────────────────
# Check 1 — module exports CapacityAnalysisKitResult and analyze_all
# ─────────────────────────────────────────────────────────────────────────────
println("Check 1: module-level exports...")
exported = Set(string.(names(CapacityAnalysisKit)))
check("CapacityAnalysisKitResult" in exported, "CapacityAnalysisKitResult not exported")
check("analyze_all"              in exported, "analyze_all not exported")

# ─────────────────────────────────────────────────────────────────────────────
# Check 2 — all 10 module symbols present in the kit namespace
# ─────────────────────────────────────────────────────────────────────────────
println("Check 2: all sub-module symbols re-exported...")
required_exports = [
    # FlowModule
    "FlowSolveResult", "solve_max_flow_dinic", "solve_max_flow_edmonds_karp",
    "solve_max_flow_push_relabel", "sink_flows", "node_inflow", "node_outflow",
    "validate_capacity_constraints", "validate_flow_conservation",
    "validate_maxflow_mincut", "validate_exactness",
    # SensitivityModule
    "SensitivityResult", "critical_edge_ranking", "marginal_capacity_values",
    "birnbaum_importance", "analyze_sensitivity",
    # FailureImpactModule
    "FailureImpactResult", "extract_min_cut_sets", "analyze_single_edge_failures",
    "analyze_k_edge_failures", "analyze_capacity_degradation", "analyze_failure_impact",
    # StructuralModule
    "StructuralResult", "identify_spof_edges", "identify_spof_nodes",
    "enumerate_paths", "path_flow_contributions", "bottleneck_ranking",
    "node_topological_positions", "edge_redundancy_scores", "analyze_structure",
    # FlowDecompositionModule
    "FlowPathComponent", "FlowDecomposition", "decompose_flow", "validate_decomposition",
    # ParametricThresholdModule
    "DegradationThreshold", "UpgradeThreshold", "ParametricThresholdResult",
    "find_degradation_threshold", "find_upgrade_threshold",
    "find_all_degradation_thresholds", "analyze_parametric_thresholds",
    # NodeCapacitatedFlowModule
    "NodeSplitGraph", "NodeCapacitatedFlowResult", "NodeCapacitatedAnalysisResult",
    "build_node_split_graph", "solve_node_capacitated_flow",
    "node_capacitated_spof_nodes", "analyze_node_capacitated_flow",
    # MinCutUtilitiesModule
    "MinCut", "MinCutEnumeration", "MinCutAnalysis", "minimum_st_cut_edges",
    "minimum_st_cut_capacity", "edges_in_some_mincut", "edges_in_every_mincut",
    "mincut_partition", "enumerate_min_cuts", "analyze_min_cuts",
    # GlobalConnectivityModule
    "EdgeConnectivityResult", "NodeConnectivityResult", "GlobalMinCutResult",
    "GlobalConnectivityResult", "edge_connectivity", "node_connectivity",
    "global_min_cut", "analyze_global_connectivity",
]
for sym in required_exports
    check(sym in exported, "Missing export: $sym")
end

# ─────────────────────────────────────────────────────────────────────────────
# Check 3 — baseline run with defaults; result is correctly typed
# ─────────────────────────────────────────────────────────────────────────────
println("Check 3: analyze_all returns CapacityAnalysisKitResult...")
edgelist, outgoing, incoming, caps, sources, sinks = _make_test_graph()
result = analyze_all(edgelist, outgoing, incoming, caps, sources, sinks)
check(result isa CapacityAnalysisKitResult, "result is not CapacityAnalysisKitResult")

# ─────────────────────────────────────────────────────────────────────────────
# Check 4 — baseline_max_flow == flow.max_flow and correct value
# ─────────────────────────────────────────────────────────────────────────────
println("Check 4: baseline_max_flow correct...")
check(result.baseline_max_flow == result.flow.max_flow,
    "baseline_max_flow != flow.max_flow")
check(abs(result.baseline_max_flow - 1.0) < 1e-9,
    "Expected max_flow=1.0, got $(result.baseline_max_flow)")

# ─────────────────────────────────────────────────────────────────────────────
# Check 5 — node_capacities=nothing path (default)
# ─────────────────────────────────────────────────────────────────────────────
println("Check 5: node_capacitated === nothing when node_capacities not provided...")
check(result.node_capacitated === nothing,
    "node_capacitated should be nothing when node_capacities not given")

# ─────────────────────────────────────────────────────────────────────────────
# Check 6 — node_capacities provided path
# ─────────────────────────────────────────────────────────────────────────────
println("Check 6: node_capacitated isa NodeCapacitatedAnalysisResult when provided...")
edgelist_nc, outgoing_nc, incoming_nc, caps_nc, sources_nc, sinks_nc = _make_node_capacity_graph()
result_nc = analyze_all(
    edgelist_nc, outgoing_nc, incoming_nc, caps_nc, sources_nc, sinks_nc;
    node_capacities=Dict{Int64,Float64}(2 => 1.0)
)
check(result_nc.node_capacitated isa NodeCapacitatedAnalysisResult,
    "node_capacitated should be NodeCapacitatedAnalysisResult when node_capacities provided")

# ─────────────────────────────────────────────────────────────────────────────
# Check 7 — unbounded flow guard fires before any downstream step
# ─────────────────────────────────────────────────────────────────────────────
println("Check 7: unbounded baseline throws ArgumentError...")
ubel, ubout, ubin, ubcaps, ubsrc, ubsnk = _make_unbounded_graph()
unbounded_thrown = Ref(false)
unbounded_msg_ok = Ref(false)
try
    analyze_all(ubel, ubout, ubin, ubcaps, ubsrc, ubsnk)
catch e
    if e isa ArgumentError
        unbounded_thrown[] = true
        unbounded_msg_ok[] = occursin("unbounded", e.msg)
    end
end
check(unbounded_thrown[], "unbounded baseline did not throw ArgumentError")
check(unbounded_msg_ok[], "unbounded ArgumentError message missing 'unbounded'")

# ─────────────────────────────────────────────────────────────────────────────
# Check 8 — algorithm=:edmonds_karp propagates without error
# ─────────────────────────────────────────────────────────────────────────────
println("Check 8: algorithm=:edmonds_karp runs cleanly...")
result_ek = analyze_all(
    edgelist, outgoing, incoming, caps, sources, sinks;
    algorithm=:edmonds_karp
)
check(result_ek isa CapacityAnalysisKitResult, "edmonds_karp run did not return CapacityAnalysisKitResult")
check(result_ek.algorithm === :edmonds_karp,    "result.algorithm not :edmonds_karp")

# ─────────────────────────────────────────────────────────────────────────────
# Check 9 — all 9 result fields are populated (not uninitialized / wrong type)
# ─────────────────────────────────────────────────────────────────────────────
println("Check 9: all result fields populated...")
check(result.flow              isa FlowSolveResult,          "flow field wrong type")
check(result.sensitivity       isa SensitivityResult,        "sensitivity field wrong type")
check(result.failure_impact    isa FailureImpactResult,       "failure_impact field wrong type")
check(result.structure         isa StructuralResult,          "structure field wrong type")
check(result.flow_decomposition isa FlowDecomposition,        "flow_decomposition field wrong type")
check(result.parametric_thresholds isa ParametricThresholdResult,
    "parametric_thresholds field wrong type")
check(result.node_capacitated === nothing,                    "node_capacitated should be nothing here")
check(result.min_cut_analysis  isa MinCutAnalysis,           "min_cut_analysis field wrong type")
check(result.global_connectivity isa GlobalConnectivityResult, "global_connectivity field wrong type")
check(result.algorithm === :dinic, "algorithm metadata wrong")
check(result.tol       == 1e-10,   "tol metadata wrong")

# ─────────────────────────────────────────────────────────────────────────────
# Check 10 — spot-check re-export completeness via namespace access
# ─────────────────────────────────────────────────────────────────────────────
println("Check 10: namespace spot-checks...")
check(CapacityAnalysisKit.FlowSolveResult           === FlowSolveResult,          "FlowSolveResult namespace mismatch")
check(CapacityAnalysisKit.SensitivityResult         === SensitivityResult,        "SensitivityResult namespace mismatch")
check(CapacityAnalysisKit.FailureImpactResult       === FailureImpactResult,      "FailureImpactResult namespace mismatch")
check(CapacityAnalysisKit.StructuralResult          === StructuralResult,         "StructuralResult namespace mismatch")
check(CapacityAnalysisKit.FlowDecomposition         === FlowDecomposition,        "FlowDecomposition namespace mismatch")
check(CapacityAnalysisKit.DegradationThreshold      === DegradationThreshold,     "DegradationThreshold namespace mismatch")
check(CapacityAnalysisKit.NodeCapacitatedFlowResult === NodeCapacitatedFlowResult,"NodeCapacitatedFlowResult namespace mismatch")
check(CapacityAnalysisKit.MinCutAnalysis            === MinCutAnalysis,           "MinCutAnalysis namespace mismatch")
check(CapacityAnalysisKit.GlobalConnectivityResult  === GlobalConnectivityResult, "GlobalConnectivityResult namespace mismatch")

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
if isempty(errors)
    println("CapacityAnalysisKit smoke passed")
else
    println("\n$(length(errors)) check(s) failed:")
    for e in errors
        println("  - $e")
    end
    exit(1)
end
