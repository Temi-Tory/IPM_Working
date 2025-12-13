"""
Compare LIFO Work-Stealing vs Optimized (current 45s baseline)

LIFO approach:
- Single worker pool (no repeated task spawn/destroy)
- LIFO stack per worker (depth-first for cache locality)
- Work stealing for load balancing
- Captured context in work items

Expected: Reduce 95% thread overhead to <10%, target ~8-10s runtime
"""

if !@isdefined(script_initialized_lifo)
    println("Initializing...")

    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates, Printf, Statistics

    # Load LIFO version
    include("../src/IPAFrameworkLIFO.jl")
    using .IPAFrameworkLIFO

    global script_initialized_lifo = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

network_name = "HB0_local_1"
data_type = "float"

println("\n" * "="^80)
println("COMPARING LIFO WORK-STEALING vs OPTIMIZED: $network_name")
println("Threads: $(Threads.nthreads())")
println("="^80)

# Load network
base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

println("\nLoading network...")
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

root_diamonds = identify_and_group_diamonds(
    join_nodes, incoming_index, ancestors, descendants,
    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
)

unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
    root_diamonds, node_priors, ancestors, descendants, iteration_sets
)

println("✓ Network loaded")

# Run LIFO version 3 times
println("\n" * "="^80)
println("TESTING LIFO WORK-STEALING VERSION (3 runs)")
println("="^80)

lifo_results = []
lifo_times = []

for i in 1:3
    println("\nRun $i:")
    GC.gc()  # Clean garbage before timing

    t_start = time()
    beliefs = update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, edge_probabilities,
        descendants, ancestors, root_diamonds,
        join_nodes, fork_nodes, unique_diamonds
    )
    t_elapsed = time() - t_start

    push!(lifo_results, beliefs)
    push!(lifo_times, t_elapsed)

    println("  Time: $(round(t_elapsed, digits=2))s")
    println("  Node 149: $(beliefs[149])")
end

println("\n" * "="^80)
println("RESULTS SUMMARY")
println("="^80)

println("\nLIFO Work-Stealing Version:")
println("  Run 1: $(round(lifo_times[1], digits=2))s")
println("  Run 2: $(round(lifo_times[2], digits=2))s")
println("  Run 3: $(round(lifo_times[3], digits=2))s")
println("  Average: $(round(mean(lifo_times), digits=2))s")

println("\nDeterminism Check (Node 149):")
println("  Run 1: $(lifo_results[1][149])")
println("  Run 2: $(lifo_results[2][149])")
println("  Run 3: $(lifo_results[3][149])")

if lifo_results[1][149] == lifo_results[2][149] == lifo_results[3][149]
    println("  ✅ DETERMINISTIC")
else
    println("  ❌ NON-DETERMINISTIC - PROBLEM!")
end

println("\nExpected vs Actual:")
println("  Expected (Optimized): 0.879711")
println("  LIFO Result: $(lifo_results[1][149])")
println("  Match: $(abs(lifo_results[1][149] - 0.879711) < 1e-5 ? "✅" : "❌")")

println("\n" * "="^80)
println("COMPARISON TO OPTIMIZED (45s baseline)")
println("="^80)

avg_lifo = mean(lifo_times)
speedup = 45.0 / avg_lifo

println("Baseline (Optimized with copy): 45s")
println("LIFO (this run): $(round(avg_lifo, digits=2))s")
println("Speedup: $(round(speedup, digits=2))×")

if avg_lifo < 45
    println("✅ FASTER than baseline")
    if avg_lifo < 10
        println("🎯 TARGET ACHIEVED: Sub-10s runtime!")
    end
else
    println("❌ SLOWER than baseline")
end

println("\n" * "="^80)
println("ANALYSIS")
println("="^80)
println("""
Key differences from optimized version:
- Optimized: Spawns one task per state recursively (thousands of tasks)
- LIFO: Single worker pool with LIFO queues (persistent threads)

Expected benefits:
- Eliminate 95% thread spawn/destroy overhead
- Depth-first LIFO improves cache locality
- Work stealing provides load balancing

Profile showed optimized version: 95% thread overhead, 5% actual work
If LIFO eliminates overhead: 5% of 45s = 2.25s pure compute time
Target: ~8-10s (2-3s compute + minimal overhead)
""")

println("\n" * "="^80)
println("✅ Test Complete!")
println("="^80)

# Store for interactive use
global lifo_test_results = (
    beliefs = lifo_results[1],
    times = lifo_times,
    avg_time = avg_lifo
)
