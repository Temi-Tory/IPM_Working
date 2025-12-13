"""
Compare Depth-Limited Parallelism vs Optimized (45s baseline)

DEPTH-LIMITED APPROACH:
- Only parallelize top 3 levels of diamond nesting
- Deeper levels run sequentially within each parallel branch
- With 2 cond nodes/level: 2^3 = 8 parallel tasks (perfect for 8 threads)

Expected: Reduce task spawns from ~2^50 to ~2^3 = 8
Profile shows 95% thread overhead → eliminate 90% of overhead
Target: ~8-10s (2-3s compute + minimal overhead)
"""

if !@isdefined(script_initialized_depth_limited)
    println("Initializing...")

    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates, Printf, Statistics

    # Load depth-limited version
    include("../src/IPAFrameworkDepthLimited.jl")
    using .IPAFrameworkDepthLimited

    global script_initialized_depth_limited = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

network_name = "HB0_local_1"
data_type = "float"

println("\n" * "="^80)
println("COMPARING DEPTH-LIMITED vs OPTIMIZED: $network_name")
println("Threads: $(Threads.nthreads())")
println("MAX_PARALLEL_DEPTH: 3 (parallelize top 3 levels only)")
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

# Run depth-limited version 3 times
println("\n" * "="^80)
println("TESTING DEPTH-LIMITED VERSION (3 runs)")
println("="^80)

depth_limited_results = []
depth_limited_times = []

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

    push!(depth_limited_results, beliefs)
    push!(depth_limited_times, t_elapsed)

    println("  Time: $(round(t_elapsed, digits=2))s")
    println("  Node 149: $(beliefs[149])")
end

println("\n" * "="^80)
println("RESULTS SUMMARY")
println("="^80)

println("\nDepth-Limited Version:")
println("  Run 1: $(round(depth_limited_times[1], digits=2))s")
println("  Run 2: $(round(depth_limited_times[2], digits=2))s")
println("  Run 3: $(round(depth_limited_times[3], digits=2))s")
println("  Average: $(round(mean(depth_limited_times), digits=2))s")

println("\nDeterminism Check (Node 149):")
println("  Run 1: $(depth_limited_results[1][149])")
println("  Run 2: $(depth_limited_results[2][149])")
println("  Run 3: $(depth_limited_results[3][149])")

if depth_limited_results[1][149] == depth_limited_results[2][149] == depth_limited_results[3][149]
    println("  ✅ DETERMINISTIC")
else
    println("  ❌ NON-DETERMINISTIC - PROBLEM!")
end

println("\nExpected vs Actual:")
println("  Expected (Optimized): 0.879711")
println("  Depth-Limited Result: $(depth_limited_results[1][149])")
println("  Match: $(abs(depth_limited_results[1][149] - 0.879711) < 1e-5 ? "✅" : "❌")")

println("\n" * "="^80)
println("COMPARISON TO OPTIMIZED (45s baseline)")
println("="^80)

avg_depth_limited = mean(depth_limited_times)
speedup = 45.0 / avg_depth_limited

println("Baseline (Optimized with copy): 45s")
println("Depth-Limited (this run): $(round(avg_depth_limited, digits=2))s")
println("Speedup: $(round(speedup, digits=2))×")

if avg_depth_limited < 45
    println("✅ FASTER than baseline")
    if avg_depth_limited < 10
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
- Optimized: Spawns tasks at EVERY diamond level recursively
  → With 50 levels of 2 cond nodes each: ~2^50 task spawns
  → Profile shows 95% thread overhead, 5% compute (~2.3s work, ~42.7s overhead)

- Depth-Limited: Only parallelize top 3 levels
  → Levels 0-2: Parallel (2^3 = 8 tasks for 8 threads)
  → Levels 3+: Sequential within each task
  → Reduces task spawns from ~2^50 to 8 total

Expected result:
- Maintain full parallelism (8 threads utilized)
- Eliminate 99.9% of task spawn overhead
- Target: ~8-10s (2-3s compute + minimal overhead)

If this works: Major breakthrough! Proves thread overhead was the bottleneck.
If this doesn't work: Fundamental algorithm limit, need approximation.
""")

println("\n" * "="^80)
println("✅ Test Complete!")
println("="^80)

# Store for interactive use
global depth_limited_test_results = (
    beliefs = depth_limited_results[1],
    times = depth_limited_times,
    avg_time = avg_depth_limited
)
