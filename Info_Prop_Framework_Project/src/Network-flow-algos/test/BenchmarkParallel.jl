"""
Parallel Belief Propagation Benchmark
Tests the parallel version of updateDiamondJoin with automatic parallelization
"""

# Check if this is the first run of the script for this julia repl session
if !@isdefined(parallel_benchmark_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Mark as initialized
    global parallel_benchmark_initialized = true
    println("Initialization complete!")
    println("Julia threads available: $(Threads.nthreads())")
else
    println("Subsequent run - skipping initialization")
    println("Julia threads available: $(Threads.nthreads())")
end


# ============================================================================
# Network Selection
# ============================================================================

network_name = "HB0_local_1"         # Complex: 17 nodes, 135 edges, nested diamonds

# ============================================================================
# Main Benchmark Function
# ============================================================================

function run_parallel_benchmark(network_name, data_type="float")
    println("\n" * "="^80)
    println("PARALLEL BELIEF PROPAGATION BENCHMARK")
    println("Testing Network: $network_name")
    println("Data Type: $data_type")
    println("Threads: $(Threads.nthreads())")
    println("="^80 * "\n")

    # Construct file paths
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

    # Validate files exist
    if !isfile(filepath_graph)
        error("Graph file not found: $filepath_graph")
    end
    if !isfile(filepath_node_json)
        error("Node priors file not found: $filepath_node_json")
    end
    if !isfile(filepath_edge_json)
        error("Edge probabilities file not found: $filepath_edge_json")
    end

    # ========================================================================
    # STEP 1: Load Network Data
    # ========================================================================
    println("📊 STEP 1: Loading network data...")
    t_load = @elapsed begin
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        node_priors = read_node_priors_from_json(filepath_node_json)
        edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
    end

    # Find sink nodes
    allnodes = collect(keys(incoming_index))
    sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)

    println("   ✓ Loaded in $(round(t_load, digits=3))s")
    println("   Nodes: $(length(node_priors))")
    println("   Edges: $(length(edgelist))")
    println("   Sources: $(length(source_nodes))")
    println("   Sinks: $(length(sink_nodes))")

    # ========================================================================
    # STEP 2: Build Network Structure
    # ========================================================================
    println("\n🔧 STEP 2: Building network structure...")
    t_structure = @elapsed begin
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
    end

    println("   ✓ Built in $(round(t_structure, digits=3))s")
    println("   Forks: $(length(fork_nodes))")
    println("   Joins: $(length(join_nodes))")
    println("   Iteration layers: $(length(iteration_sets))")

    # ========================================================================
    # STEP 3: Identify Diamond Structures
    # ========================================================================
    println("\n💎 STEP 3: Identifying diamonds...")
    t_diamonds = @elapsed begin
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
    end

    println("   ✓ Identified in $(round(t_diamonds, digits=3))s")
    println("   Root diamonds: $(length(root_diamonds))")

    # ========================================================================
    # STEP 4: Build Unique Diamond Storage
    # ========================================================================
    println("\n🔨 STEP 4: Building unique diamond storage...")
    t_storage = @elapsed begin
        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds,
            node_priors,
            ancestors,
            descendants,
            iteration_sets
        );
    end

    println("   ✓ Built in $(round(t_storage, digits=3))s")
    println("   Unique diamonds: $(length(unique_diamonds))")

    # ========================================================================
    # STEP 5: Run Belief Propagation (PARALLEL - 3 runs)
    # ========================================================================
    println("\n" * "="^80)
    println("🧮 STEP 5: Running PARALLEL belief propagation...")
    println("="^80 * "\n")

    println("Note: Parallelization automatically activates for:")
    println("  - num_states >= 2 (n>=1 conditioning nodes)")
    println("  - Threads.nthreads() > 1")
    println("  - Recursive parallelism: nested diamonds also parallelize!")
    println()

    parallel_times = Float64[]
    final_beliefs = nothing

    for run in 1:3
        println("Run $run...")
        t_bp = @elapsed begin
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
                unique_diamonds
            );
        end
        push!(parallel_times, t_bp)
        println("   ✓ BP completed in $(round(t_bp, digits=3))s")
    end

    best_parallel = minimum(parallel_times)
    avg_parallel = sum(parallel_times) / length(parallel_times)

    # ========================================================================
    # Results Summary
    # ========================================================================
    println("\n" * "="^80)
    println("RESULTS SUMMARY")
    println("="^80)

    println("\n📊 Sink Node Beliefs:")
    for sink in sort(collect(sink_nodes))
        if haskey(final_beliefs, sink)
            println("   Node $sink: $(round(final_beliefs[sink], digits=10))")
        end
    end

    println("\n⏱️  TIMING BREAKDOWN:")
    println("   Load network:      $(round(t_load, digits=3))s")
    println("   Build structure:   $(round(t_structure, digits=3))s")
    println("   Identify diamonds: $(round(t_diamonds, digits=3))s")
    println("   Build storage:     $(round(t_storage, digits=3))s")
    println("   " * "-"^50)

    println("\n🚀 PARALLEL BELIEF PROPAGATION (3 runs):")
    for (i, t) in enumerate(parallel_times)
        println("   Run $i: $(round(t, digits=3))s")
    end
    println("   Best:    $(round(best_parallel, digits=3))s")
    println("   Average: $(round(avg_parallel, digits=3))s")

    println("\n   " * "-"^50)
    total_time = t_load + t_structure + t_diamonds + t_storage + best_parallel
    println("   TOTAL TIME:        $(round(total_time, digits=3))s")

    println("\n📈 PERFORMANCE COMPARISON:")
    baseline_sequential = 600.0  # Original sequential baseline (~10 minutes)
    println("   Baseline (sequential):  ~600s (10 minutes)")
    println("   Current (parallel):     $(round(best_parallel, digits=3))s")

    if best_parallel < baseline_sequential
        speedup = baseline_sequential / best_parallel
        saved = baseline_sequential - best_parallel
        println("   🎯 Speedup: $(round(speedup, digits=2))x ($(round(saved, digits=1))s faster)")
    else
        slowdown = best_parallel / baseline_sequential
        println("   ⚠️  No improvement: $(round(slowdown, digits=2))x ($(round(best_parallel - baseline_sequential, digits=1))s slower)")
    end

    println("\n" * "="^80)

    return (best_time=best_parallel, avg_time=avg_parallel, final_beliefs=final_beliefs)
end

# ============================================================================
# Run the benchmark
# ============================================================================

println("\n" * "="^80)
println("STARTING PARALLEL BENCHMARK")
println("Threads available: $(Threads.nthreads())")
println("="^80)

if Threads.nthreads() == 1
    println("\n⚠️  WARNING: Running with only 1 thread!")
    println("To get parallel speedup, restart Julia with multiple threads:")
    println("  julia --threads=auto")
    println("  or")
    println("  julia --threads=8")
    println()
end

data_type = "float"
result = run_parallel_benchmark(network_name, data_type)

println("\n✓ Benchmark complete!")
println("   Best parallel time: $(round(result.best_time, digits=3))s")
println("   Average time: $(round(result.avg_time, digits=3))s")
