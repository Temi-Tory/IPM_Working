"""
Analyze the distribution of n values passed to inclusion_exclusion in HB0_local_1
This tells us what speedup to expect from GPU acceleration
"""

# Check if this is the first run
if !@isdefined(size_analysis_initialized)
    println("First run - initializing...")

    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, Combinatorics

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Import the original inclusion_exclusion function
    import .IPAFramework.ReachabilityModule: inclusion_exclusion

    global size_analysis_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# Instrumented Version to Track n Values
# ============================================================================

# Global counter for n values
const n_value_counts = Dict{Int, Int}()

"""
Instrumented inclusion_exclusion that tracks n values
"""
function inclusion_exclusion_instrumented(belief_values::Vector{T}) where {T}
    n = length(belief_values)

    # Track this n value
    if haskey(n_value_counts, n)
        n_value_counts[n] += 1
    else
        n_value_counts[n] = 1
    end

    # Call original function
    return inclusion_exclusion(belief_values)
end

# ============================================================================
# Run Belief Propagation with Instrumentation
# ============================================================================

function analyze_n_distribution(network_name, data_type="float")
    println("\n" * "="^80)
    println("ANALYZING INCLUSION-EXCLUSION N-VALUE DISTRIBUTION: $network_name")
    println("="^80 * "\n")

    # Construct file paths
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

    # Load network
    println("📊 Loading network...")
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
    node_priors = read_node_priors_from_json(filepath_node_json)
    edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

    allnodes = collect(keys(incoming_index))
    sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)

    # Build network structure
    println("🔧 Building network structure...")
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

    # Identify diamonds
    println("💎 Identifying diamonds...")
    root_diamonds = identify_and_group_diamonds(
        join_nodes,
        incoming_index,
        ancestors,
        descendants,
        source_nodes,
        fork_nodes,
        edgelist,
        node_priors,
        iteration_sets
    )

    # Build unique diamond storage
    println("🔨 Building unique diamond storage...")
    unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
        root_diamonds,
        node_priors,
        ancestors,
        descendants,
        iteration_sets
    )

    # Clear counter
    empty!(n_value_counts)

    # Temporarily replace inclusion_exclusion with instrumented version
    println("\n🔍 Running belief propagation with instrumentation...")

    # Import ReachabilityModule to patch it
    import .IPAFramework.ReachabilityModule as RM

    # Save original function
    original_inclusion_exclusion = RM.inclusion_exclusion

    # Patch with instrumented version
    RM.eval(:(inclusion_exclusion(belief_values::Vector{T}) where {T} =
        Main.inclusion_exclusion_instrumented(belief_values)))

    # Run belief propagation
    cache = Dict{RM.CacheKey, RM.DiamondCacheEntry{typeof(first(values(node_priors)))}}()

    final_beliefs = RM.update_beliefs_iterative(
        edgelist,
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities,
        descendants,
        ancestors,
        root_diamonds,
        join_nodes,
        fork_nodes,
        unique_diamonds,
        cache
    )

    # Restore original function
    RM.eval(:(inclusion_exclusion = $original_inclusion_exclusion))

    println("✓ Analysis complete!\n")

    # ========================================================================
    # Analyze Results
    # ========================================================================

    println("="^80)
    println("N-VALUE DISTRIBUTION ANALYSIS")
    println("="^80 * "\n")

    # Sort by n value
    sorted_counts = sort(collect(n_value_counts), by=x->x[1])

    total_calls = sum(values(n_value_counts))

    println("Total inclusion_exclusion calls: $total_calls\n")

    println("| n | Count | % of Total | Combinations | GPU Speedup (est) |")
    println("|---|-------|------------|--------------|-------------------|")

    for (n, count) in sorted_counts
        percentage = round(100 * count / total_calls, digits=1)
        combinations = 2^n - 1

        # Estimate speedup based on benchmark results
        speedup_est = if n < 10
            "0.1-0.3x (CPU faster)"
        elseif n < 15
            "0.3-2x (break-even)"
        elseif n < 18
            "2-10x"
        else
            "10-50x"
        end

        println("| $n | $count | $percentage% | $combinations | $speedup_est |")
    end

    println()

    # Calculate weighted average performance improvement
    println("="^80)
    println("EXPECTED GPU PERFORMANCE IMPACT")
    println("="^80 * "\n")

    gpu_favorable = sum(count for (n, count) in sorted_counts if n >= 15)
    breakeven = sum(count for (n, count) in sorted_counts if 10 <= n < 15)
    cpu_favorable = sum(count for (n, count) in sorted_counts if n < 10)

    println("GPU-favorable calls (n≥15): $gpu_favorable ($(round(100*gpu_favorable/total_calls, digits=1))%)")
    println("Break-even calls (10≤n<15): $breakeven ($(round(100*breakeven/total_calls, digits=1))%)")
    println("CPU-favorable calls (n<10): $cpu_favorable ($(round(100*cpu_favorable/total_calls, digits=1))%)")

    println("\n" * "="^80)

    if gpu_favorable > 0.5 * total_calls
        println("✓ RECOMMENDATION: GPU acceleration highly beneficial!")
        println("  More than 50% of calls have n≥15 where GPU provides massive speedup.")
    elseif gpu_favorable > 0.2 * total_calls
        println("✓ RECOMMENDATION: GPU acceleration beneficial with hybrid dispatch.")
        println("  Significant portion of calls have n≥15, use threshold-based dispatch.")
    else
        println("⚠ RECOMMENDATION: GPU acceleration may need careful tuning.")
        println("  Most calls have small n. Hybrid dispatch with higher threshold recommended.")
    end

    println("="^80 * "\n")

    return sorted_counts, total_calls
end

# ============================================================================
# Run Analysis
# ============================================================================

network_name = "HB0_local_1"
data_type = "float"

results, total = analyze_n_distribution(network_name, data_type)

println("\n✓ Analysis complete! Distribution saved to results.")
