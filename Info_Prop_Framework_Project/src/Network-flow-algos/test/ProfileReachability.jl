"""
Profiling Script for Reachability Module
Identifies bottlenecks and GPU parallelization opportunities
"""

# Check if this is the first run of the script for this julia repl session
if !@isdefined(script_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates, Profile, ProfileView

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Import cache types and n-counter from ReachabilityModule
    import .IPAFramework.ReachabilityModule: CacheKey, DiamondCacheEntry, INCLUSION_EXCLUSION_N_COUNTS

    # Mark as initialized
    global script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end


# ============================================================================
# Network Selection
# ============================================================================

network_name = "HB0_local_1"         # Complex: 17 nodes, 135 edges, nested diamonds
# network_name = "power-network"      # Simple: 23 nodes, 27 edges

# ============================================================================
# Profiling Function
# ============================================================================

function profile_reachability(network_name, data_type="float")
    println("\n" * "="^80)
    println("PROFILING REACHABILITY: $network_name")
    println("Data Type: $data_type")
    println("="^80 * "\n")

    # Construct file paths
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

    # ========================================================================
    # STEP 1: Load Network Data
    # ========================================================================
    println("📊 Loading network data...")
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
    node_priors = read_node_priors_from_json(filepath_node_json)
    edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

    allnodes = collect(keys(incoming_index))
    sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)

    println("   Nodes: $(length(node_priors))")
    println("   Edges: $(length(edgelist))")
    println("   Sources: $(length(source_nodes))")
    println("   Sinks: $(length(sink_nodes))")

    # ========================================================================
    # STEP 2: Build Network Structure
    # ========================================================================
    println("\n🔧 Building network structure...")
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

    println("   Forks: $(length(fork_nodes))")
    println("   Joins: $(length(join_nodes))")
    println("   Iteration layers: $(length(iteration_sets))")

    # ========================================================================
    # STEP 3: Identify Diamond Structures
    # ========================================================================
    println("\n💎 Identifying diamonds...")
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

    println("   Root diamonds: $(length(root_diamonds))")

    # ========================================================================
    # STEP 4: Build Unique Diamond Storage
    # ========================================================================
    println("\n🔨 Building unique diamond storage...")
    unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
        root_diamonds,
        node_priors,
        ancestors,
        descendants,
        iteration_sets
    )

    println("   Unique diamonds: $(length(unique_diamonds))")

    # ========================================================================
    # STEP 5: PROFILE BELIEF PROPAGATION
    # ========================================================================
    println("\n" * "="^80)
    println("🔍 PROFILING BELIEF PROPAGATION")
    println("="^80 * "\n")

    # Clear any previous profiling data
    Profile.clear()

    # Empty cache for cold run
    diamond_cache = Dict{CacheKey, DiamondCacheEntry{typeof(first(values(node_priors)))}}()

    println("Starting profiled belief propagation...")

    # Profile the belief propagation
    final_beliefs = nothing
    @profile begin
        for _ in 1:3  # Run 3 times for better profile data
            final_beliefs = update_beliefs_iterative(
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
                diamond_cache
            )
        end
    end

    println("\n✓ Profiling complete!")
    println("   Cache entries after 3 runs: $(length(diamond_cache))")

    # ========================================================================
    # STEP 6: ANALYZE PROFILE DATA
    # ========================================================================
    println("\n" * "="^80)
    println("📈 PROFILE ANALYSIS")
    println("="^80 * "\n")

    # Print profile data
    Profile.print(format=:flat, sortedby=:count, mincount=20)

    println("\n" * "="^80)
    println("To view interactive flamegraph, run: ProfileView.view()")
    println("="^80 * "\n")

    # ========================================================================
    # STEP 7: ANALYZE N-VALUE DISTRIBUTION
    # ========================================================================
    println("\n" * "="^80)
    println("📊 INCLUSION-EXCLUSION N-VALUE DISTRIBUTION")
    println("="^80 * "\n")

    # Get the n-value counts (already imported at top)
    n_counts = INCLUSION_EXCLUSION_N_COUNTS

    if !isempty(n_counts)
        total_calls = sum(values(n_counts))
        sorted_counts = sort(collect(n_counts), by=x->x[1])

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

        println("\n" * "="^80)
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
    else
        println("No n-value data collected (counter may be disabled)")
    end

    return final_beliefs
end

# ============================================================================
# Run profiling
# ============================================================================

data_type = "float"
profile_reachability(network_name, data_type)

println("\n✓ Profiling complete! Run ProfileView.view() to see flamegraph")
