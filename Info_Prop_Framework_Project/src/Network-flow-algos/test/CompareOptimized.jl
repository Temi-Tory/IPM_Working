"""
Optimized Implementation Test
Tests ONLY the optimized version
Run CleanTest.jl separately to test the original
"""

# Check if this is the first run of the script for this julia repl session
if !@isdefined(script_initialized_optimized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    # Include ONLY the optimized module
    println("Loading optimized IPAFrameworkOptimized...")
    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    # Mark as initialized
    global script_initialized_optimized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end


# ============================================================================
# Network Selection
# ============================================================================

#= dag_ntwrk_files\drone-network-balanced-k3 ## works 1.034s, 
dag_ntwrk_files\drone-network-cost-optimal  # works: 0.757s
dag_ntwrk_files\drone-network-geographic-knn  # very slow nver completes
dag_ntwrk_files\drone-network-resilience-optimal-k5  # very slow never completes 
dag_ntwrk_files\drone-network-time-optimal-k2 =# #works 0.019s
    #network_name = "drone-network-resilience-optimal-k5"         # Complex: 17 nodes, 135 edges, 132 unique diamonds

    #network_name = "drone-network-time-optimal-k2"         # Complex: 17 nodes, 135 edges, 132 unique diamonds


    #network_name ="pareto-point-1-high-resilience-fw" # still running after 10 min 
    # network_name ="pareto-point-2-high-resilience-vtol" #work: 0.31s
    # network_name ="pareto-point-3-medium-resilience-sparse" #281.607s (4 min 41 sec) 
    # network_name ="pareto-point-4-low-resilience-minimal" #works: 0.0191438s
    # network_name ="pareto-point-5-medium-resilience-fw" #256 seconds (4 min 16 sec)
    # network_name ="pareto-point-6-balanced" #works:0.0191438s


    #network_name = "drone-network-cost-optimal"      # Simple: 23 nodes, 27 edges 
    #network_name = "drone-network-balanced-k3"         # Complex: 17 nodes, 135 edges,14 rooy diamonds, 132 unique diamonds
    #network_name = "drone-network-balanced-k3"   
    #network_name = "central_scotland_1"
    #network_name = "glasgow_area"
    #network_name = "drone-network-full"
    # ============================================================================
    # Test Function (Parameterized for both versions)
# ============================================================================
network_name = "water"  
data_type="Emergency Response"
function run_test(network_name, module_name, run_bp_func, data_type="float")
    println("\n" * "="^80)
    println("Testing: $module_name")
    println("Network: $network_name")
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
    t_load = @elapsed begin
        edgelist, outgoing_index, incoming_index, source_nodes = IPAFrameworkOptimized.read_graph_to_dict(filepath_graph)
        node_priors = IPAFrameworkOptimized.read_node_priors_from_json(filepath_node_json)
        edge_probabilities = IPAFrameworkOptimized.read_edge_probabilities_from_json(filepath_edge_json)
    end

    println("   ✓ Loaded in $(round(t_load, digits=3))s")

    # ========================================================================
    # STEP 2: Build Network Structure
    # ========================================================================
    println("🔧 Building network structure...")
    t_structure = @elapsed begin
        fork_nodes, join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = IPAFrameworkOptimized.find_iteration_sets(edgelist, outgoing_index, incoming_index)
    end

    println("   ✓ Built in $(round(t_structure, digits=3))s")

    # ========================================================================
    # STEP 3: Identify Diamond Structures
    # ========================================================================
    println("💎 Identifying diamonds...")
    t_diamonds = @elapsed begin
        root_diamonds = IPAFrameworkOptimized.identify_and_group_diamonds(
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

    # ========================================================================
    # STEP 4: Build Unique Diamond Storage
    # ========================================================================
    println("🔨 Building unique diamond storage...")
    t_storage = @elapsed begin
        unique_diamonds = IPAFrameworkOptimized.build_unique_diamond_storage_depth_first_parallel(
            root_diamonds,
            node_priors,
            ancestors,
            descendants,
            iteration_sets
        );
    end

    println("   ✓ Built in $(round(t_storage, digits=3))s")

    # ========================================================================
    # STEP 5: Run Belief Propagation (with detailed timing)
    # ========================================================================
    println("\n🧮 Running belief propagation...")
    println("   Threads: $(Threads.nthreads())")

    # Force garbage collection before timing
    GC.gc()

    # Track allocations
    alloc_before = Base.gc_num()
    t_bp = @elapsed begin
        # Call function - let default cache parameter handle it
        # Both functions have cache as an optional parameter with default value
        final_beliefs = run_bp_func(
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
            # Note: NOT passing cache parameter - using default
        )
    end
    alloc_after = Base.gc_num()

    # Calculate allocation statistics
    alloc_diff = alloc_after.allocd - alloc_before.allocd
    alloc_gb = alloc_diff / 1024^3
    gc_time = (alloc_after.total_time - alloc_before.total_time) / 1e9
    gc_percent = (gc_time / t_bp) * 100

    println("   ✓ BP completed in $(round(t_bp, digits=3))s")
    println("   Allocations: $(round(alloc_gb, digits=2)) GB")
    println("   GC time: $(round(gc_time, digits=2))s ($(round(gc_percent, digits=2))%)")

    # ========================================================================
    # Results Summary
    # ========================================================================
    println("\n" * "="^80)
    println("TIMING SUMMARY - $module_name")
    println("="^80)
    println("   Belief propagation: $(round(t_bp, digits=3))s")
    println("   Allocations:       $(round(alloc_gb, digits=2)) GB")
    println("   GC time:           $(round(gc_time, digits=2))s ($(round(gc_percent, digits=2))%)")
    println("="^80 * "\n")

    return (
        beliefs = final_beliefs,
        time = t_bp,
        allocations = alloc_gb,
        gc_time = gc_time,
        gc_percent = gc_percent
    )
end

# ============================================================================
    # Run Test
# ============================================================================

    data_type = "float"

    println("\n" * "🔬 TESTING OPTIMIZED IMPLEMENTATION" * "\n")
    println("Network: $network_name")
    println("Threads: $(Threads.nthreads())")
    println("\n")

    # Run optimized version
    println("▶️  Testing OPTIMIZED implementation...")
result = run_test(
    network_name,
    "Optimized IPAFrameworkOptimized",
    IPAFrameworkOptimized.update_beliefs_iterative,
    data_type
);

#println("\n✅ Test complete! Run CleanTest.jl separately to compare with original.")

# Store result
global test_result = result.beliefs
#result.beliefs[253]
#= for (k, d) in root_diamonds
    if isempty(d.diamond.conditioning_nodes)
        println("key = ", k)
    end
end =#

#= 
mc_results = MC_result_optimized(
        edgelist,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities,
        10_000_000
    )

    
    
# Sort outputs
sorted_algo = OrderedDict(sort(collect(result.beliefs)));
sorted_mc = OrderedDict(sort(collect(mc_results)));

# Create base DataFrame using the float values directly
df = DataFrame(
  Node = collect(keys(sorted_algo)),
  AlgoValue = collect(values(sorted_algo)),
  MCValue = collect(values(sorted_mc))
)

# Add a difference column (if needed)
df.Diff = abs.(df.AlgoValue .- df.MCValue)
# Display sorted result (if you want to sort by the difference)
show(sort(df, :Diff, rev=true), allrows=true)


using Printf

# Compare with full precision
println("\n" * "="^80)
println("FULL PRECISION COMPARISON")
println("="^80)

for node in sort(collect(keys(result.beliefs)))
    opt_val = result.beliefs[node]
    orig_val = mc_results[node]  # or whatever the original result dict is called
    diff = abs(opt_val - orig_val)
    
    @printf("Node %3d: Optimized = %.15f, Original = %.15f, Diff = %.2e\n", 
            node, opt_val, orig_val, diff)
end

 =#