"""
    IntervalValidator

Validates interval belief propagation results by checking that Float64 results
at sampled points within input intervals are always contained in the output intervals.

Two validation methods:
1. Exact: Run the exact Float64 algorithm at sampled input corners/points
2. MC: Run Monte Carlo simulation at sampled input points

For correctness, every Float64 result must fall within the interval result.
The function f(inputs) → beliefs is multilinear in the inputs, so checking
corners of the input hypercube is sufficient for a rigorous guarantee.
However, checking all 2^(nodes+edges) corners is infeasible, so we sample.
"""

# ============================================================================
# Check if this is the first run
# ============================================================================
if !@isdefined(script_initialized_interval_validator)
    println("First run - initializing IntervalValidator...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates, Random

    println("Loading IPAFrameworkOptimized...")
    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    include("../src/Algorithms/MC_Optimized.jl")

    global script_initialized_interval_validator = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# Helper: Sample Float64 values from interval inputs
# ============================================================================

"""
    sample_float64_from_intervals(node_priors_interval, edge_probs_interval, mode)

Extract Float64 dictionaries from interval inputs.
Modes: :lower, :upper, :midpoint, :random
"""
function sample_float64_from_intervals(
    node_priors_interval::Dict{Int64, IPAFrameworkOptimized.Interval},
    edge_probs_interval::Dict{Tuple{Int64,Int64}, IPAFrameworkOptimized.Interval};
    mode::Symbol = :midpoint
)
    node_priors_f64 = Dict{Int64, Float64}()
    edge_probs_f64 = Dict{Tuple{Int64,Int64}, Float64}()

    for (node, iv) in node_priors_interval
        node_priors_f64[node] = _sample_point(iv, mode)
    end

    for (edge, iv) in edge_probs_interval
        edge_probs_f64[edge] = _sample_point(iv, mode)
    end

    return node_priors_f64, edge_probs_f64
end

function _sample_point(iv::IPAFrameworkOptimized.Interval, mode::Symbol)
    if mode == :lower
        return iv.lower
    elseif mode == :upper
        return iv.upper
    elseif mode == :midpoint
        return (iv.lower + iv.upper) / 2.0
    elseif mode == :random
        return iv.lower + rand() * (iv.upper - iv.lower)
    else
        error("Unknown sampling mode: $mode")
    end
end

# ============================================================================
# Core: Run exact Float64 algorithm at a sampled point
# ============================================================================

"""
    run_exact_at_point(network_name, node_priors_f64, edge_probs_f64)

Runs the full exact belief propagation pipeline with Float64 inputs.
Returns Dict{Int64, Float64} of beliefs.
"""
function run_exact_at_point(
    edgelist, outgoing_index, incoming_index, source_nodes,
    node_priors_f64::Dict{Int64, Float64},
    edge_probs_f64::Dict{Tuple{Int64,Int64}, Float64}
)
    fork_nodes, join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = IPAFrameworkOptimized.find_iteration_sets(edgelist, outgoing_index, incoming_index)

    root_diamonds = IPAFrameworkOptimized.identify_and_group_diamonds(
        join_nodes, incoming_index, ancestors, descendants,
        source_nodes, fork_nodes, edgelist, node_priors_f64, iteration_sets
    )

    unique_diamonds = IPAFrameworkOptimized.build_unique_diamond_storage_depth_first_parallel(
        root_diamonds, node_priors_f64, ancestors, descendants, iteration_sets
    )

    beliefs = IPAFrameworkOptimized.update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors_f64, edge_probs_f64,
        descendants, ancestors, root_diamonds, join_nodes, fork_nodes,
        unique_diamonds
    )

    return beliefs
end

# ============================================================================
# Validation: Check containment
# ============================================================================

"""
    check_containment(interval_beliefs, float_beliefs; tolerance=1e-10)

Checks that every Float64 belief falls within its corresponding interval.
Returns a DataFrame with results and a pass/fail summary.
"""
function check_containment(
    interval_beliefs::Dict{Int64, IPAFrameworkOptimized.Interval},
    float_beliefs::Dict{Int64, Float64};
    tolerance::Float64 = 1e-10
)
    nodes = sort(collect(keys(interval_beliefs)))
    results = []

    for node in nodes
        iv = interval_beliefs[node]
        fv = float_beliefs[node]
        contained = (fv >= iv.lower - tolerance) && (fv <= iv.upper + tolerance)

        push!(results, (
            Node = node,
            Float64_Value = fv,
            Interval_Lower = iv.lower,
            Interval_Upper = iv.upper,
            Interval_Width = iv.upper - iv.lower,
            Contained = contained,
            Margin_Lower = fv - iv.lower,
            Margin_Upper = iv.upper - fv
        ))
    end

    df = DataFrame(results)
    return df
end

# ============================================================================
# Main Validation Runner
# ============================================================================

"""
    validate_interval_results(network_name, data_type; num_random_samples=10, mc_samples=100_000)

Full validation pipeline:
1. Run interval algorithm to get interval beliefs
2. Run exact Float64 algorithm at lower, upper, midpoint, and random corners
3. Run MC at midpoint
4. Check all Float64/MC results are contained in interval beliefs
"""
function validate_interval_results(
    network_name::String,
    data_type::String;
    num_random_samples::Int = 10,
    mc_samples::Int = 100_000
)
    println("\n" * "="^80)
    println("INTERVAL VALIDATION: $network_name / $data_type")
    println("="^80)

    # ========================================================================
    # Load network structure (shared across all runs)
    # ========================================================================
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

    edgelist, outgoing_index, incoming_index, source_nodes = IPAFrameworkOptimized.read_graph_to_dict(filepath_graph)

    # ========================================================================
    # Step 1: Run interval algorithm
    # ========================================================================
    println("\n[1/4] Running interval algorithm...")
    node_priors_iv = IPAFrameworkOptimized.read_node_priors_from_json(filepath_node_json)
    edge_probs_iv = IPAFrameworkOptimized.read_edge_probabilities_from_json(filepath_edge_json)

    fork_nodes, join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = IPAFrameworkOptimized.find_iteration_sets(edgelist, outgoing_index, incoming_index)

    root_diamonds = IPAFrameworkOptimized.identify_and_group_diamonds(
        join_nodes, incoming_index, ancestors, descendants,
        source_nodes, fork_nodes, edgelist, node_priors_iv, iteration_sets
    )

    unique_diamonds = IPAFrameworkOptimized.build_unique_diamond_storage_depth_first_parallel(
        root_diamonds, node_priors_iv, ancestors, descendants, iteration_sets
    )

    interval_beliefs = IPAFrameworkOptimized.update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors_iv, edge_probs_iv,
        descendants, ancestors, root_diamonds, join_nodes, fork_nodes,
        unique_diamonds
    )
    println("   Done. $(length(interval_beliefs)) nodes computed.")

    # ========================================================================
    # Step 2: Exact Float64 at deterministic sample points
    # ========================================================================
    println("\n[2/4] Running exact Float64 at corner/midpoints...")
    all_violations = 0
    total_checks = 0

    for (label, mode) in [("LOWER", :lower), ("UPPER", :upper), ("MIDPOINT", :midpoint)]
        np_f64, ep_f64 = sample_float64_from_intervals(node_priors_iv, edge_probs_iv; mode=mode)
        f64_beliefs = run_exact_at_point(
            edgelist, outgoing_index, incoming_index, source_nodes,
            np_f64, ep_f64
        )

        df = check_containment(interval_beliefs, f64_beliefs)
        violations = count(.!df.Contained)
        total_checks += nrow(df)
        all_violations += violations

        status = violations == 0 ? "PASS" : "FAIL ($violations violations)"
        println("   $label: $status")

        if violations > 0
            failed = filter(row -> !row.Contained, df)
            for row in eachrow(failed)
                println("      Node $(row.Node): f64=$(round(row.Float64_Value, digits=6)) not in [$(round(row.Interval_Lower, digits=6)), $(round(row.Interval_Upper, digits=6))]")
            end
        end
    end

    # ========================================================================
    # Step 3: Exact Float64 at random sample points
    # ========================================================================
    println("\n[3/4] Running exact Float64 at $num_random_samples random points...")
    for i in 1:num_random_samples
        np_f64, ep_f64 = sample_float64_from_intervals(node_priors_iv, edge_probs_iv; mode=:random)
        f64_beliefs = run_exact_at_point(
            edgelist, outgoing_index, incoming_index, source_nodes,
            np_f64, ep_f64
        )

        df = check_containment(interval_beliefs, f64_beliefs)
        violations = count(.!df.Contained)
        total_checks += nrow(df)
        all_violations += violations

        status = violations == 0 ? "PASS" : "FAIL ($violations violations)"
        println("   Random sample $i/$num_random_samples: $status")

        if violations > 0
            failed = filter(row -> !row.Contained, df)
            for row in eachrow(failed)
                println("      Node $(row.Node): f64=$(round(row.Float64_Value, digits=6)) not in [$(round(row.Interval_Lower, digits=6)), $(round(row.Interval_Upper, digits=6))]")
            end
        end
    end

    # ========================================================================
    # Step 4: MC validation at midpoint
    # ========================================================================
    println("\n[4/4] Running MC ($mc_samples samples) at midpoint...")
    np_f64, ep_f64 = sample_float64_from_intervals(node_priors_iv, edge_probs_iv; mode=:midpoint)
    mc_results = MC_result_optimized(
        edgelist, outgoing_index, incoming_index, source_nodes,
        np_f64, ep_f64, mc_samples
    )

    # MC has statistical noise, so use wider tolerance
    mc_tolerance = 3.0 / sqrt(mc_samples)  # ~3 standard deviations for binomial
    df_mc = check_containment(interval_beliefs, mc_results; tolerance=mc_tolerance)
    mc_violations = count(.!df_mc.Contained)

    status = mc_violations == 0 ? "PASS" : "FAIL ($mc_violations violations)"
    println("   MC at midpoint (tolerance=$( round(mc_tolerance, digits=4))): $status")

    if mc_violations > 0
        failed = filter(row -> !row.Contained, df_mc)
        for row in eachrow(failed)
            println("      Node $(row.Node): MC=$(round(row.Float64_Value, digits=6)) not in [$(round(row.Interval_Lower, digits=6)), $(round(row.Interval_Upper, digits=6))] (with tolerance)")
        end
    end

    # ========================================================================
    # Summary
    # ========================================================================
    println("\n" * "="^80)
    println("VALIDATION SUMMARY")
    println("="^80)
    println("   Exact checks: $total_checks total, $all_violations violations")
    println("   MC checks:    $(nrow(df_mc)) total, $mc_violations violations (tolerance=$(round(mc_tolerance, digits=4)))")

    if all_violations == 0 && mc_violations == 0
        println("\n   RESULT: ALL CHECKS PASSED")
    else
        println("\n   RESULT: FAILURES DETECTED")
    end
    println("="^80)

    return (
        interval_beliefs = interval_beliefs,
        exact_violations = all_violations,
        mc_violations = mc_violations,
        total_exact_checks = total_checks,
        mc_df = df_mc
    )
end

# ============================================================================
# Run validation
# ============================================================================
network_name = "water"
data_type = "Winter Operations"

result = validate_interval_results(network_name, data_type;
    num_random_samples = 10,
    mc_samples = 1_000_000
)
