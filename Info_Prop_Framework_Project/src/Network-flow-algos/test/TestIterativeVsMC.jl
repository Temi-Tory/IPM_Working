"""
Test Iterative BP vs Recursive BP vs Monte Carlo Ground Truth

Compares:
1. Recursive BP (@spawn based) - baseline optimized version
2. Iterative BP (@threads based) - new work-queue version
3. Monte Carlo simulation - ground truth

Goal: Determine which BP version is more accurate!
"""

if !@isdefined(script_initialized_mc_test)
    println("First run - initializing...")

    println("Loading IPAFrameworkOptimized...")
    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    println("Loading MC_Optimized...")
    include("../src/Algorithms/MC_Optimized.jl")

    using DataFrames, Printf

    global script_initialized_mc_test = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

function test_bp_vs_mc(network_name, data_type="float"; mc_samples=1_000_000)
    
    println("TESTING: $network_name")
    println("Comparing Recursive BP vs Iterative BP vs Monte Carlo")
    println("="^80 * "\n")

    # Construct file paths
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

    # ========================================================================
    # Load Network Data
    # ========================================================================
    println("📊 Loading network data...")
    t_load = @elapsed begin
        edgelist, outgoing_index, incoming_index, source_nodes = IPAFrameworkOptimized.read_graph_to_dict(filepath_graph)
        node_priors = IPAFrameworkOptimized.read_node_priors_from_json(filepath_node_json)
        edge_probabilities = IPAFrameworkOptimized.read_edge_probabilities_from_json(filepath_edge_json)
    end

    println("   ✓ Loaded in $(round(t_load, digits=3))s")
    println("   • Nodes: $(length(node_priors))")
    println("   • Edges: $(length(edgelist))")
    println("   • Sources: $(length(source_nodes))")

    # ========================================================================
    # Build Network Structure
    # ========================================================================
    println("\n🔧 Building network structure...")
    t_structure = @elapsed begin
        fork_nodes, join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = IPAFrameworkOptimized.find_iteration_sets(edgelist, outgoing_index, incoming_index)
    end

    println("   ✓ Built in $(round(t_structure, digits=3))s")

    # ========================================================================
    # Identify Diamonds
    # ========================================================================
    println("\n💎 Identifying diamonds...")
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
    # Build Unique Diamond Storage
    # ========================================================================
    println("\n🔨 Building unique diamond storage...")
    t_storage = @elapsed begin
        unique_diamonds = IPAFrameworkOptimized.build_unique_diamond_storage_depth_first_parallel(
            root_diamonds,
            node_priors,
            ancestors,
            descendants,
            iteration_sets
        )
    end

    println("   ✓ Built in $(round(t_storage, digits=3))s")

    # ========================================================================
    # Run Monte Carlo (Ground Truth)
    # ========================================================================
    println("\n🎲 Running Monte Carlo ($mc_samples samples)...")

    GC.gc()

    t_mc = @elapsed begin
        mc_results = MC_result_optimized(
            edgelist,
            outgoing_index,
            incoming_index,
            source_nodes,
            node_priors,
            edge_probabilities,
            mc_samples
        )
    end

    println("   ✓ Completed in $(round(t_mc, digits=3))s")

    # ========================================================================
    # Run Recursive BP
    # ========================================================================
    println("\n🧮 Running RECURSIVE BP (@spawn based)...")

    GC.gc()

    t_bp_recursive = @elapsed begin
        beliefs_recursive = IPAFrameworkOptimized.update_beliefs_iterative(
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
        )
    end

    println("   ✓ Completed in $(round(t_bp_recursive, digits=3))s")

    # ========================================================================
    # Run Iterative BP
    # ========================================================================
    println("\n🔄 Running ITERATIVE BP (@threads based)...")

    GC.gc()

    t_bp_iterative = @elapsed begin
        beliefs_iterative = IPAFrameworkOptimized.update_beliefs_iterative_stack(
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
        )
    end

    println("   ✓ Completed in $(round(t_bp_iterative, digits=3))s")

    # ========================================================================
    # Compare All Three Methods
    # ========================================================================
    println("\n📊 Comparing results...")

    all_nodes = sort(collect(keys(mc_results)))

    # Create DataFrame for comparison
    df = DataFrame(
        Node = Int64[],
        MC_Truth = Float64[],
        Recursive = Float64[],
        Iterative = Float64[],
        Recursive_Error = Float64[],
        Iterative_Error = Float64[]
    )

    for node in all_nodes
        mc_val = mc_results[node]
        recursive_val = beliefs_recursive[node]
        iterative_val = beliefs_iterative[node]

        recursive_error = abs(recursive_val - mc_val)
        iterative_error = abs(iterative_val - mc_val)

        push!(df, (node, mc_val, recursive_val, iterative_val, recursive_error, iterative_error))
    end

    # Sort by iterative error to see worst cases
    df_sorted = sort(df, :Iterative_Error, rev=true)

    # ========================================================================
    # Results Summary
    # ========================================================================
    
    println("RESULTS SUMMARY")
    

    println("\nTiming:")
    println("  • Monte Carlo: $(round(t_mc, digits=3))s")
    println("  • Recursive BP: $(round(t_bp_recursive, digits=3))s")
    println("  • Iterative BP: $(round(t_bp_iterative, digits=3))s")

    println("\nAccuracy vs Monte Carlo (Ground Truth):")
    recursive_max_error = maximum(df.Recursive_Error)
    iterative_max_error = maximum(df.Iterative_Error)
    recursive_mean_error = sum(df.Recursive_Error) / length(df.Recursive_Error)
    iterative_mean_error = sum(df.Iterative_Error) / length(df.Iterative_Error)

    @printf("  • Recursive BP:  Max Error = %.6e, Mean Error = %.6e\n", recursive_max_error, recursive_mean_error)
    @printf("  • Iterative BP:  Max Error = %.6e, Mean Error = %.6e\n", iterative_max_error, iterative_mean_error)

    println("\nTop 10 Nodes by Iterative Error:")
    show(first(df_sorted, 10), allrows=true, allcols=true)
    println()

    
    println("FULL PRECISION COMPARISON (All Nodes)")
    

    for row in eachrow(df)
        @printf("Node %3d: MC = %.15f, Recursive = %.15f (Err: %.2e), Iterative = %.15f (Err: %.2e)\n",
                row.Node, row.MC_Truth, row.Recursive, row.Recursive_Error, row.Iterative, row.Iterative_Error)
    end

    # Winner determination
    
    if iterative_mean_error < recursive_mean_error
        improvement = (recursive_mean_error - iterative_mean_error) / recursive_mean_error * 100
        println("🏆 WINNER: ITERATIVE BP is $(round(improvement, digits=2))% more accurate!")
    elseif recursive_mean_error < iterative_mean_error
        worse = (iterative_mean_error - recursive_mean_error) / recursive_mean_error * 100
        println("⚠️ Recursive BP is $(round(worse, digits=2))% more accurate")
    else
        println("🤝 TIE: Both methods have equal accuracy")
    end
    println("="^80 * "\n")

    return (
        mc_time = t_mc,
        recursive_time = t_bp_recursive,
        iterative_time = t_bp_iterative,
        recursive_max_error = recursive_max_error,
        iterative_max_error = iterative_max_error,
        recursive_mean_error = recursive_mean_error,
        iterative_mean_error = iterative_mean_error
    )
end

# ============================================================================
# Run Test
# ============================================================================

println("\n" * "🎯" ^ 40)
println("CRITICAL TEST: HB01_local")
println("Comparing BP methods against Monte Carlo ground truth")
println("🎯" ^ 40 * "\n")

try
    results = test_bp_vs_mc("HB0_local_1")

    println("\n✅ Test completed successfully!")
    println("Check results above to see which BP method is more accurate.")

catch e
    println("\n💥 💥 💥 TEST CRASHED! 💥 💥 💥")
    println("Error: $e")
    println("\nStacktrace:")
    for (exc, bt) in Base.catch_stack()
        showerror(stdout, exc, bt)
        println()
    end
end
