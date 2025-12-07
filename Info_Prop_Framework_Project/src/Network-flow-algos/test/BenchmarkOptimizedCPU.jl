"""
Benchmark Optimized CPU on HB0_local_1
Tests the hybrid CPU optimization (binary enumeration for n≤10, Combinatorics for n>10)
"""

# Check if this is the first run
if !@isdefined(optimized_cpu_benchmark_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Import cache types and n-counter from ReachabilityModule
    import .IPAFramework.ReachabilityModule: CacheKey, DiamondCacheEntry, INCLUSION_EXCLUSION_N_COUNTS

    global optimized_cpu_benchmark_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# Network Selection
# ============================================================================

network_name = "HB0_local_1"         # Complex: 17 nodes, 135 edges, nested diamonds

# ============================================================================
# Benchmark Function
# ============================================================================

function benchmark_optimized_cpu(network_name, data_type="float")
    println("\n" * "="^80)
    println("BENCHMARKING OPTIMIZED CPU: $network_name")
    println("Data Type: $data_type")
    println("="^80 * "\n")

    # Construct file paths
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

    # Load network
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

    # Build network structure
    println("\n🔧 Building network structure...")
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

    println("   Forks: $(length(fork_nodes))")
    println("   Joins: $(length(join_nodes))")
    println("   Iteration layers: $(length(iteration_sets))")

    # Identify diamonds
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

    # Build unique diamond storage
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
    # BENCHMARK OPTIMIZED CPU
    # ========================================================================
    println("\n" * "="^80)
    println("🖥️  OPTIMIZED CPU BENCHMARK (hybrid binary enumeration)")
    println("="^80 * "\n")

    diamond_cache = Dict{CacheKey, DiamondCacheEntry{typeof(first(values(node_priors)))}}()
    empty!(INCLUSION_EXCLUSION_N_COUNTS)

    println("Warm-up run...")
    update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, edge_probabilities, descendants,
        ancestors, root_diamonds, join_nodes, fork_nodes,
        unique_diamonds, diamond_cache
    )

    println("Benchmarking optimized CPU (3 runs)...")
    cpu_times = Float64[]
    for i in 1:3
        empty!(diamond_cache)
        t = @elapsed begin
            final_beliefs = update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities, descendants,
                ancestors, root_diamonds, join_nodes, fork_nodes,
                unique_diamonds, diamond_cache
            )
        end
        push!(cpu_times, t)
        println("  Run $i: $(round(t, digits=3))s")
    end

    cpu_time = minimum(cpu_times)
    println("\n✓ Best optimized CPU time: $(round(cpu_time, digits=3))s")

    n_counts = copy(INCLUSION_EXCLUSION_N_COUNTS)

    # ========================================================================
    # ANALYSIS
    # ========================================================================
    println("\n" * "="^80)
    println("📈 N-VALUE DISTRIBUTION")
    println("="^80 * "\n")

    total_calls = sum(values(n_counts))
    println("Total inclusion_exclusion calls: $total_calls\n")

    # Breakdown by optimization strategy
    binary_enum_calls = sum(count for (n, count) in n_counts if n <= 10)
    combinatorics_calls = sum(count for (n, count) in n_counts if n > 10)

    println("Binary enumeration (n≤10): $binary_enum_calls ($(round(100*binary_enum_calls/total_calls, digits=1))%)")
    println("  Expected speedup: 1.3-7x per call (higher for smaller n)")
    println("\nCombinatorics.jl (n>10): $combinatorics_calls ($(round(100*combinatorics_calls/total_calls, digits=1))%)")
    println("  No change from baseline")

    # Detailed breakdown
    println("\nDetailed n-value breakdown:")
    for n in sort(collect(keys(n_counts)))
        count = n_counts[n]
        percent = 100 * count / total_calls
        strategy = n <= 10 ? "binary enum" : "Combinatorics"
        println("  n=$n: $count calls ($(round(percent, digits=1))%) [$strategy]")
    end

    println("\n" * "="^80)

    # Expected improvement calculation
    # Profile showed n=2 dominates calls (48.7%) but not time
    # Most time is in n=10-15 range
    # Binary enum helps n≤10 (83.6% of calls based on profile data)
    # Weighted average speedup: 7x*48.7% + 1.3x*35% + 1x*16% = 3.4 + 0.46 + 0.16 = 4x on calls
    # But execution time is different - need to weight by 2^n complexity

    println("\n✓ Benchmark complete!")
    println("   Optimized CPU time: $(round(cpu_time, digits=3))s")
    println("\n💡 Comparison with baseline (~81-95s CPU-only):")
    println("   Baseline range: 81-95s")
    println("   Current: $(round(cpu_time, digits=3))s")
    if cpu_time < 81
        speedup = 81 / cpu_time
        println("   🎯 Speedup: $(round(speedup, digits=2))x ($(round(81-cpu_time, digits=1))s saved)")
    else
        println("   ⚠️  No significant improvement")
    end

    println("="^80 * "\n")

    return (cpu_time=cpu_time, n_counts=n_counts)
end

# ============================================================================
# Run Benchmark
# ============================================================================

println("\n" * "="^80)
println("OPTIMIZED CPU BENCHMARK")
println("Hybrid approach: Binary enumeration for n≤10, Combinatorics for n>10")
println("="^80)

data_type = "float"
results = benchmark_optimized_cpu(network_name, data_type)

println("\n✓ Benchmark complete!")
println("   Optimized CPU time: $(round(results.cpu_time, digits=3))s")
