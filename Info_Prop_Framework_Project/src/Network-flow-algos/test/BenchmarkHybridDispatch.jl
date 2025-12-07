"""
Benchmark End-to-End Speedup with Hybrid CPU/GPU Dispatch
Compares CPU-only vs GPU-accelerated belief propagation on HB0_local_1
"""

# Check if this is the first run
if !@isdefined(hybrid_benchmark_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates, CUDA

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Import cache types and n-counter from ReachabilityModule
    import .IPAFramework.ReachabilityModule: CacheKey, DiamondCacheEntry, INCLUSION_EXCLUSION_N_COUNTS

    global hybrid_benchmark_initialized = true
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

function benchmark_hybrid_dispatch(network_name, data_type="float")
    println("\n" * "="^80)
    println("BENCHMARKING HYBRID CPU/GPU DISPATCH: $network_name")
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
    # STEP 5: BENCHMARK CPU-ONLY (use_gpu=false)
    # ========================================================================
    println("\n" * "="^80)
    println("🖥️  CPU-ONLY BENCHMARK (use_gpu=false)")
    println("="^80 * "\n")

    # Clear cache and counter
    diamond_cache_cpu = Dict{CacheKey, DiamondCacheEntry{typeof(first(values(node_priors)))}}()
    empty!(INCLUSION_EXCLUSION_N_COUNTS)

    # Warm-up run
    println("Warm-up run...")
    update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, edge_probabilities, descendants,
        ancestors, root_diamonds, join_nodes, fork_nodes,
        unique_diamonds, diamond_cache_cpu
    )

    # Benchmark run (3 iterations)
    println("Benchmarking CPU-only (3 runs)...")
    cpu_times = Float64[]
    for i in 1:3
        empty!(diamond_cache_cpu)
        t = @elapsed begin
            final_beliefs_cpu = update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities, descendants,
                ancestors, root_diamonds, join_nodes, fork_nodes,
                unique_diamonds, diamond_cache_cpu
            )
        end
        push!(cpu_times, t)
        println("  Run $i: $(round(t, digits=3))s")
    end

    cpu_time = minimum(cpu_times)
    println("\n✓ Best CPU time: $(round(cpu_time, digits=3))s")

    # Save n-value distribution from CPU run
    cpu_n_counts = copy(INCLUSION_EXCLUSION_N_COUNTS)

    # ========================================================================
    # STEP 6: BENCHMARK HYBRID CPU/GPU (use_gpu=true)
    # ========================================================================
    println("\n" * "="^80)
    println("🚀 HYBRID CPU/GPU BENCHMARK (use_gpu=true, threshold=13)")
    println("="^80 * "\n")

    # Clear cache and counter
    diamond_cache_gpu = Dict{CacheKey, DiamondCacheEntry{typeof(first(values(node_priors)))}}()
    empty!(INCLUSION_EXCLUSION_N_COUNTS)

    # Warm-up run
    println("Warm-up run...")
    update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, edge_probabilities, descendants,
        ancestors, root_diamonds, join_nodes, fork_nodes,
        unique_diamonds, diamond_cache_gpu
    )

    # Benchmark run (3 iterations)
    println("Benchmarking hybrid CPU/GPU (3 runs)...")
    gpu_times = Float64[]
    for i in 1:3
        empty!(diamond_cache_gpu)
        t = @elapsed begin
            final_beliefs_gpu = update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities, descendants,
                ancestors, root_diamonds, join_nodes, fork_nodes,
                unique_diamonds, diamond_cache_gpu
            )
        end
        push!(gpu_times, t)
        println("  Run $i: $(round(t, digits=3))s")
    end

    gpu_time = minimum(gpu_times)
    println("\n✓ Best GPU time: $(round(gpu_time, digits=3))s")

    # ========================================================================
    # STEP 7: RESULTS COMPARISON
    # ========================================================================
    println("\n" * "="^80)
    println("📊 RESULTS")
    println("="^80 * "\n")

    speedup = cpu_time / gpu_time

    println("CPU-only time:      $(round(cpu_time, digits=3))s")
    println("Hybrid CPU/GPU time: $(round(gpu_time, digits=3))s")
    println("\n🎯 Speedup: $(round(speedup, digits=2))x")

    time_saved = cpu_time - gpu_time
    percent_improvement = 100 * time_saved / cpu_time
    println("⏱️  Time saved: $(round(time_saved, digits=3))s ($(round(percent_improvement, digits=1))% faster)")

    # Analyze where the speedup came from
    println("\n" * "="^80)
    println("📈 SPEEDUP ANALYSIS")
    println("="^80 * "\n")

    total_calls = sum(values(cpu_n_counts))
    gpu_dispatched = sum(count for (n, count) in cpu_n_counts if n >= 13)
    cpu_dispatched = total_calls - gpu_dispatched

    println("Total inclusion_exclusion calls: $total_calls")
    println("  CPU dispatch (n<13):  $cpu_dispatched ($(round(100*cpu_dispatched/total_calls, digits=1))%)")
    println("  GPU dispatch (n≥13):  $gpu_dispatched ($(round(100*gpu_dispatched/total_calls, digits=1))%)")

    # Show distribution
    println("\nN-value distribution:")
    sorted_counts = sort(collect(cpu_n_counts), by=x->x[1])
    for (n, count) in sorted_counts
        percentage = round(100 * count / total_calls, digits=1)
        dispatch = n >= 13 ? "GPU" : "CPU"
        println("  n=$n: $count calls ($percentage%) → $dispatch")
    end

    println("\n" * "="^80)

    if speedup >= 1.5
        println("✅ EXCELLENT: $(round(speedup, digits=2))x speedup achieved!")
        println("   GPU acceleration is highly effective for this network.")
    elseif speedup >= 1.2
        println("✅ GOOD: $(round(speedup, digits=2))x speedup achieved.")
        println("   GPU acceleration provides solid improvement.")
    elseif speedup >= 1.0
        println("✓ MODERATE: $(round(speedup, digits=2))x speedup.")
        println("   GPU provides some benefit but with overhead costs.")
    else
        println("⚠️  WARNING: GPU slower than CPU ($(round(speedup, digits=2))x).")
        println("   Consider adjusting threshold or disabling GPU for this workload.")
    end

    println("="^80 * "\n")

    return (cpu_time=cpu_time, gpu_time=gpu_time, speedup=speedup)
end

# ============================================================================
# Run Benchmark
# ============================================================================

println("\n" * "="^80)
println("GPU HYBRID DISPATCH BENCHMARK")
println("GPU: ", CUDA.name(CUDA.device()))
println("VRAM: ", round(CUDA.total_memory() / 1e9, digits=2), " GB")
println("="^80)

data_type = "float"
results = benchmark_hybrid_dispatch(network_name, data_type)

println("\n✓ Benchmark complete!")
println("   CPU time: $(round(results.cpu_time, digits=3))s")
println("   GPU time: $(round(results.gpu_time, digits=3))s")
println("   Speedup: $(round(results.speedup, digits=2))x")
