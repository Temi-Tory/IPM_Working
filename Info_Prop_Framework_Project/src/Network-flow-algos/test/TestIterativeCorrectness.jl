"""
Test Iterative BP Correctness

Compares iterative work-queue BP against recursive optimized BP.
Must produce identical results to pass.

Baseline: HB01_local with recursive optimized BP (~20 seconds)
Target: Beat 20 seconds while maintaining correctness
"""

# Check if this is the first run of the script
if !@isdefined(script_initialized_iterative_test)
    println("First run - initializing...")

    println("Loading IPAFrameworkOptimized...")
    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    global script_initialized_iterative_test = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# Test Function: Compare Recursive vs Iterative
# ============================================================================

function test_bp_correctness(network_name, data_type="float"; tolerance=1e-10)
    println("\n" * "="^80)
    println("TESTING BP CORRECTNESS: $network_name")
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
    println("   • Nodes: $(length(node_priors))")
    println("   • Edges: $(length(edgelist))")
    println("   • Sources: $(length(source_nodes))")

    # ========================================================================
    # STEP 2: Build Network Structure
    # ========================================================================
    println("\n🔧 Building network structure...")
    t_structure = @elapsed begin
        fork_nodes, join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = IPAFrameworkOptimized.find_iteration_sets(edgelist, outgoing_index, incoming_index)
    end

    println("   ✓ Built in $(round(t_structure, digits=3))s")
    println("   • Fork nodes: $(length(fork_nodes))")
    println("   • Join nodes: $(length(join_nodes))")

    # ========================================================================
    # STEP 3: Identify Diamonds
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
    println("   • Root diamonds: $(length(root_diamonds))")

    # ========================================================================
    # STEP 4: Build Unique Diamond Storage
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
    println("   • Unique diamonds: $(length(unique_diamonds))")

    # Analyze dependency structure
    max_depth = maximum(d.depth_level for d in values(unique_diamonds))
    max_conditioning = maximum(d.num_conditioning_nodes for d in values(unique_diamonds))
    println("   • Max nesting depth: $max_depth")
    println("   • Max conditioning nodes: $max_conditioning (2^$max_conditioning = $(2^max_conditioning) states)")

    # ========================================================================
    # STEP 5: Run RECURSIVE BP (baseline)
    # ========================================================================
    println("\n🧮 Running RECURSIVE BP (baseline)...")
    println("   Threads: $(Threads.nthreads())")

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
    # STEP 6: Run ITERATIVE BP (work-queue)
    # ========================================================================
    println("\n🔄 Running ITERATIVE BP (work-queue)...")
    println("   Threads: $(Threads.nthreads())")

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
    # STEP 7: Compare Results
    # ========================================================================
    println("\n📋 Comparing results...")

    all_nodes = sort(collect(keys(beliefs_recursive)))
    max_diff = 0.0
    max_diff_node = 0
    mismatches = 0

    for node in all_nodes
        recursive_val = beliefs_recursive[node]
        iterative_val = beliefs_iterative[node]
        diff = abs(recursive_val - iterative_val)

        if diff > max_diff
            max_diff = diff
            max_diff_node = node
        end

        if diff > tolerance
            mismatches += 1
            if mismatches <= 5  # Show first 5 mismatches
                println("   ❌ Mismatch at node $node:")
                println("      Recursive:  $recursive_val")
                println("      Iterative:  $iterative_val")
                println("      Difference: $diff")
            end
        end
    end

    # ========================================================================
    # STEP 8: Results Summary
    # ========================================================================
    println("\n" * "="^80)
    println("RESULTS SUMMARY")
    println("="^80)

    println("\nTiming:")
    println("  • Total setup time: $(round(t_load + t_structure + t_diamonds + t_storage, digits=3))s")
    println("    - Load: $(round(t_load, digits=3))s")
    println("    - Structure: $(round(t_structure, digits=3))s")
    println("    - Diamonds: $(round(t_diamonds, digits=3))s")
    println("    - Storage: $(round(t_storage, digits=3))s")
    println("  • Recursive BP: $(round(t_bp_recursive, digits=3))s")
    println("  • Iterative BP: $(round(t_bp_iterative, digits=3))s")

    speedup = t_bp_recursive / t_bp_iterative
    if speedup > 1.0
        println("  • Speedup: $(round(speedup, digits=2))x FASTER ✅")
    elseif speedup < 1.0
        println("  • Speedup: $(round(1/speedup, digits=2))x SLOWER ⚠️")
    else
        println("  • Speedup: Same speed")
    end

    println("\nCorrectness:")
    println("  • Nodes compared: $(length(all_nodes))")
    println("  • Max difference: $max_diff (at node $max_diff_node)")
    println("  • Tolerance: $tolerance")

    if mismatches == 0
        println("  • Result: ✅ PASS - All nodes match within tolerance!")
    else
        println("  • Result: ❌ FAIL - $mismatches nodes exceed tolerance")
        if mismatches > 5
            println("    (Showing first 5 mismatches above)")
        end
    end

    println("="^80 * "\n")

    return (
        recursive_time = t_bp_recursive,
        iterative_time = t_bp_iterative,
        max_diff = max_diff,
        mismatches = mismatches,
        passed = mismatches == 0
    )
end

# ============================================================================
# Test on HB01_local (the 20-second baseline)
# ============================================================================

println("\n" * "🎯" ^ 40)
println("CRITICAL TEST: HB01_local")
println("Baseline: ~20 seconds with recursive BP")
println("Goal: Match correctness, beat performance")
println("🎯" ^ 40 * "\n")

try
    results = test_bp_correctness("HB0_local_1")

    if results.passed
        println("\n✅ ✅ ✅ CORRECTNESS TEST PASSED! ✅ ✅ ✅")
        println("Iterative BP produces identical results to recursive BP")

        if results.iterative_time <= results.recursive_time
            println("🚀 🚀 🚀 PERFORMANCE IMPROVEMENT! 🚀 🚀 🚀")
            speedup = results.recursive_time / results.iterative_time
            println("Iterative is $(round(speedup, digits=2))x faster!")
        else
            println("⚠️ Performance regression")
            slowdown = results.iterative_time / results.recursive_time
            println("Iterative is $(round(slowdown, digits=2))x slower")
            println("(But correctness is maintained - optimization needed)")
        end
    else
        println("\n❌ ❌ ❌ CORRECTNESS TEST FAILED! ❌ ❌ ❌")
        println("Iterative BP does not match recursive BP")
        println("Max difference: $(results.max_diff)")
        println("Mismatched nodes: $(results.mismatches)")
        println("\n⚠️ DO NOT USE ITERATIVE VERSION UNTIL FIXED ⚠️")
    end

catch e
    println("\n💥 💥 💥 TEST CRASHED! 💥 💥 💥")
    println("Error: $e")
    println("\nStacktrace:")
    for (exc, bt) in Base.catch_stack()
        showerror(stdout, exc, bt)
        println()
    end
end
