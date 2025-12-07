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

network_name = "HB0_local_2"         # Complex: 17 nodes, 135 edges, 132 unique diamonds

# ============================================================================
# Test Function (Parameterized for both versions)
# ============================================================================

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
)

println("\n✅ Test complete! Run CleanTest.jl separately to compare with original.")

# Store result
global test_result = result
result.beliefs