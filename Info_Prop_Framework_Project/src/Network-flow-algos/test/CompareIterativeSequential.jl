"""
Compare All Versions: Optimized, Sequential Iterative, and Parallel Iterative

Tests three implementations:
1. Recursive Optimized (baseline - 42s)
2. Sequential Iterative (Phase 1 - correctness validated)
3. Parallel Iterative (Phase 2 - parallelized diamond enumeration)

Priority Order:
1. ✅ Correctness - all versions match (< 1e-10 error)
2. ✅ Stack Safety - iterative versions avoid stack overflow
3. 🎯 Performance - parallel version targets matching optimized speed

Expected Performance:
- Optimized Baseline: ~42s
- Iterative Sequential: ~646s (15× slower - no parallelism)
- Iterative Parallel: Target <100s (4-6× faster than sequential)

Test Networks:
1. HB0_local_1: Correctness validation (should match 0.879711 for node 149)
2. K3 (optional): Stack safety validation (50+ nesting - should NOT overflow)
"""

if !@isdefined(script_initialized_iterative_seq)
    println("Initializing...")

    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates, Printf, Statistics

    # Load BOTH versions for comparison
    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    include("../src/IPAFrameworkIterative.jl")
    using .IPAFrameworkIterative

    global script_initialized_iterative_seq = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# Test 1: HB0_local_1 - Correctness Validation
# ============================================================================

network_name = "HB0_local_1"
data_type = "float"

println("\n" * "="^80)
println("TEST 1: CORRECTNESS VALIDATION - $network_name")
println("="^80)

# Load network
base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

println("\nLoading network...")
edgelist, outgoing_index, incoming_index, source_nodes = IPAFrameworkOptimized.read_graph_to_dict(filepath_graph)
node_priors = IPAFrameworkOptimized.read_node_priors_from_json(filepath_node_json)
edge_probabilities = IPAFrameworkOptimized.read_edge_probabilities_from_json(filepath_edge_json)

fork_nodes, join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = IPAFrameworkOptimized.find_iteration_sets(edgelist, outgoing_index, incoming_index)

root_diamonds = IPAFrameworkOptimized.identify_and_group_diamonds(
    join_nodes, incoming_index, ancestors, descendants,
    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
)

unique_diamonds = IPAFrameworkOptimized.build_unique_diamond_storage_depth_first_parallel(
    root_diamonds, node_priors, ancestors, descendants, iteration_sets
)

println("✓ Network loaded")
println("  Nodes: $(length(union(Set(e[1] for e in edgelist), Set(e[2] for e in edgelist))))")
println("  Edges: $(length(edgelist))")
println("  Root Diamonds: $(length(root_diamonds))")

# Run optimized version (baseline)
println("\n" * "-"^80)
println("RUNNING OPTIMIZED VERSION (Baseline)")
println("-"^80)

GC.gc()
t_opt_start = time()
beliefs_optimized = IPAFrameworkOptimized.update_beliefs_iterative(
    edgelist, iteration_sets, outgoing_index, incoming_index,
    source_nodes, node_priors, edge_probabilities,
    descendants, ancestors, root_diamonds,
    join_nodes, fork_nodes, unique_diamonds
)
t_opt = time() - t_opt_start

println("Time: $(round(t_opt, digits=2))s")
println("Node 149 (test node): $(beliefs_optimized[149])")

# Run iterative sequential version (COMMENTED OUT - use parallel instead)
# println("\n" * "-"^80)
# println("RUNNING ITERATIVE SEQUENTIAL VERSION")
# println("-"^80)
#
# GC.gc()
# t_iter_start = time()
# beliefs_iterative = Base.invokelatest(
#     IPAFrameworkIterative.update_beliefs_iterative_sequential,
#     edgelist, iteration_sets, outgoing_index, incoming_index,
#     source_nodes, node_priors, edge_probabilities,
#     descendants, ancestors, root_diamonds,
#     join_nodes, fork_nodes, unique_diamonds
# )
# t_iter = time() - t_iter_start
#
# println("Time: $(round(t_iter, digits=2))s")
# println("Node 149 (test node): $(beliefs_iterative[149])")
#
# # Print performance profile
# IPAFrameworkIterative.print_profile()

# Run iterative version (automatically parallel when threads available)
println("\n" * "-"^80)
println("RUNNING ITERATIVE VERSION")
println("-"^80)
println("Threads available: $(Threads.nthreads())")

GC.gc()
t_iter_start = time()
beliefs_iterative = Base.invokelatest(
    IPAFrameworkIterative.update_beliefs_iterative,
    edgelist, iteration_sets, outgoing_index, incoming_index,
    source_nodes, node_priors, edge_probabilities,
    descendants, ancestors, root_diamonds,
    join_nodes, fork_nodes, unique_diamonds
)
t_iter = time() - t_iter_start

println("Time: $(round(t_iter, digits=2))s")
println("Node 149 (test node): $(beliefs_iterative[149])")

# Compare iterative vs optimized
println("\n" * "="^80)
println("CORRECTNESS ANALYSIS - Iterative vs Optimized")
println("="^80)

max_error = 0.0
error_nodes = []

for node in keys(beliefs_optimized)
    opt_val = beliefs_optimized[node]
    iter_val = get(beliefs_iterative, node, -1.0)

    if iter_val == -1.0
        println("❌ ERROR: Node $node missing in iterative results!")
        push!(error_nodes, node)
    else
        error = abs(opt_val - iter_val)
        if error > max_error
            max_error = error
        end
        if error > 1e-10
            push!(error_nodes, (node, error, opt_val, iter_val))
        end
    end
end

println("\nNode Count:")
println("  Optimized: $(length(beliefs_optimized)) nodes")
println("  Iterative: $(length(beliefs_iterative)) nodes")
println("  Match: $(length(beliefs_optimized) == length(beliefs_iterative) ? "✅" : "❌")")

println("\nMaximum Error: $(max_error)")

if isempty(error_nodes)
    println("✅ EXACT MATCH - All nodes within 1e-10 tolerance!")
else
    println("❌ ERRORS FOUND - $(length(error_nodes)) nodes differ:")
    for (i, err_data) in enumerate(error_nodes[1:min(10, length(error_nodes))])
        if err_data isa Tuple
            node, error, opt_val, iter_val = err_data
            println("  Node $node: error=$(error), opt=$(opt_val), iter=$(iter_val)")
        else
            println("  Missing node: $err_data")
        end
    end
    if length(error_nodes) > 10
        println("  ... and $(length(error_nodes) - 10) more")
    end
end

println("\nNode 149 Comparison:")
println("  Optimized: $(beliefs_optimized[149])")
println("  Iterative: $(beliefs_iterative[149])")
println("  Error:     $(abs(beliefs_optimized[149] - beliefs_iterative[149]))")
println("  Match:     $(abs(beliefs_optimized[149] - beliefs_iterative[149]) < 1e-10 ? "✅" : "❌")")

# Performance comparison
println("\n" * "="^80)
println("PERFORMANCE COMPARISON")
println("="^80)

println("\nTiming:")
println("  Optimized: $(round(t_opt, digits=2))s")
println("  Iterative: $(round(t_iter, digits=2))s ($(round(t_iter / t_opt, digits=2))× vs optimized)")

if t_iter < t_opt
    println("  ✅ Iterative is FASTER: $(round(t_opt / t_iter, digits=2))× speedup!")
elseif t_iter < 100
    println("  ✅ Within acceptable range (< 100s)")
else
    println("  ⚠️  Slower than target, but functional")
end

# ============================================================================
# Test 2: K3 Network - Stack Safety Validation
# ============================================================================

#= println("\n" * "="^80)
println("TEST 2: STACK SAFETY VALIDATION - K3 Network")
println("="^80)

# Check if K3 network exists
k3_base_path = joinpath("dag_ntwrk_files", "drone-network-balanced-k3")
k3_graph_path = joinpath(k3_base_path, "drone-network-balanced-k3.EDGES")

if isfile(k3_graph_path)
    println("\nLoading drone-network-balanced-k3 network (50+ nesting levels)...")

    k3_edgelist, k3_outgoing, k3_incoming, k3_sources = IPAFrameworkOptimized.read_graph_to_dict(k3_graph_path)
    k3_node_json = joinpath(k3_base_path, "float", "drone-network-balanced-k3-nodepriors.json")
    k3_edge_json = joinpath(k3_base_path, "float", "drone-network-balanced-k3-linkprobabilities.json")

    k3_node_priors = IPAFrameworkOptimized.read_node_priors_from_json(k3_node_json)
    k3_edge_probabilities = IPAFrameworkOptimized.read_edge_probabilities_from_json(k3_edge_json)

    k3_fork_nodes, k3_join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(k3_outgoing, k3_incoming)
    k3_iteration_sets, k3_ancestors, k3_descendants = IPAFrameworkOptimized.find_iteration_sets(k3_edgelist, k3_outgoing, k3_incoming)

    k3_root_diamonds = IPAFrameworkOptimized.identify_and_group_diamonds(
        k3_join_nodes, k3_incoming, k3_ancestors, k3_descendants,
        k3_sources, k3_fork_nodes, k3_edgelist, k3_node_priors, k3_iteration_sets
    )

    k3_unique_diamonds = IPAFrameworkOptimized.build_unique_diamond_storage_depth_first_parallel(
        k3_root_diamonds, k3_node_priors, k3_ancestors, k3_descendants, k3_iteration_sets
    )

    println("✓ K3 network loaded")
    println("  Nodes: $(length(union(Set(e[1] for e in k3_edgelist), Set(e[2] for e in k3_edgelist))))")
    println("  Nesting Depth: 50+ levels (causes stack overflow in recursive version)")

    println("\n" * "-"^80)
    println("TESTING ITERATIVE VERSION ON K3")
    println("-"^80)
    println("This is the critical test - recursive version FAILS here with StackOverflowError")

    try
        GC.gc()
        t_k3_start = time()
        k3_beliefs = Base.invokelatest(
            IPAFrameworkIterative.update_beliefs_iterative_sequential,
            k3_edgelist, k3_iteration_sets, k3_outgoing, k3_incoming,
            k3_sources, k3_node_priors, k3_edge_probabilities,
            k3_descendants, k3_ancestors, k3_root_diamonds,
            k3_join_nodes, k3_fork_nodes, k3_unique_diamonds
        )
        t_k3 = time() - t_k3_start

        println("\n✅ SUCCESS - No stack overflow!")
        println("Time: $(round(t_k3, digits=2))s")
        println("Computed beliefs for $(length(k3_beliefs)) nodes")
        println("\n🎯 STACK SAFETY ACHIEVED - Iterative version handles deep nesting!")

    catch e
        println("\n❌ FAILED with error:")
        println(e)
        if isa(e, StackOverflowError)
            println("⚠️  Stack overflow still occurring - algorithm needs revision")
        end
    end
else
    println("\n⚠️  K3 network not found at: $k3_graph_path")
    println("Skipping stack safety test")
end
 =##= 
# ============================================================================
# Summary
# ============================================================================

println("\n" * "="^80)
println("FINAL SUMMARY - PHASE 1 VALIDATION")
println("="^80)

println("\n1. Correctness (HB0_local_1):")
if max_error < 1e-10
    println("   ✅ PASSED - Exact match with optimized version")
else
    println("   ❌ FAILED - Errors found (max: $max_error)")
end
#= 
println("\n2. Stack Safety (K3):")
if isfile(k3_graph_path)
    println("   ✅ TESTED - See results above")
else
    println("   ⚠️  SKIPPED - K3 network not available")
end =#

println("\n3. Performance:")
println("   Phase 1 Goal: Correctness first, speed later")
println("   Iterative: $(round(t_iter, digits=2))s")
println("   $(t_iter < 120 ? "✅" : "⚠️")  $(t_iter < 120 ? "Within" : "Exceeds") Phase 1 target (120s)")

println("\nNext Steps:")
if max_error < 1e-10
    println("  ✅ Phase 1 complete - correctness validated")
    println("  → Phase 2: Add parallelism and optimize performance")
else
    println("  ⚠️  Fix correctness issues before Phase 2")
    println("  → Debug and revise iterative implementation")
end

println("\n" * "="^80)
println("✅ Test Complete!")
println("="^80)
 =#
#= # Store results for interactive use
global iterative_test_results = (
    optimized_beliefs = beliefs_optimized,
    iterative_beliefs = beliefs_iterative,
    optimized_time = t_opt,
    iterative_time = t_iter,
    max_error = max_error,
    error_nodes = error_nodes
)
 =#

#IPAFrameworkIterative.ReachabilityModuleIterative.print_profile()