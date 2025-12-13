"""
Clean Test - Iterative BP (with Monte Carlo comparison)
Tests the iterative belief propagation (@threads for state enumeration)
Compares against Monte Carlo ground truth
"""

if !@isdefined(script_initialized_iterative)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates, Printf, OrderedCollections

    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    include("../src/Algorithms/MC_Optimized.jl")

    global script_initialized_iterative = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# Network Selection
# ============================================================================

network_name = "HB0_local_1"  # Good test: ~20s, depth=1, accuracy test
# network_name = "drone-network-balanced-k3"  # Stack overflow test: depth=2

# ============================================================================
# Main Test Function
# ============================================================================

function run_iterative_test(network_name, data_type="float"; run_mc=true, mc_samples=1_000_000)
    println("\n" * "="^80)
    println("ITERATIVE BP TEST: $network_name")
    println("Data Type: $data_type")
    if run_mc
        println("Monte Carlo: $mc_samples samples")
    end
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
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        node_priors = read_node_priors_from_json(filepath_node_json)
        edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
    end

    allnodes = collect(keys(incoming_index))
    sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)

    println("   ✓ Loaded in $(round(t_load, digits=3))s")
    println("   • Nodes: $(length(node_priors))")
    println("   • Edges: $(length(edgelist))")
    println("   • Sources: $(length(source_nodes))")
    println("   • Sinks: $(length(sink_nodes))")

    # ========================================================================
    # STEP 2: Build Network Structure
    # ========================================================================
    println("\n🔧 Building network structure...")
    t_structure = @elapsed begin
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
    end

    println("   ✓ Built in $(round(t_structure, digits=3))s")
    println("   • Forks: $(length(fork_nodes))")
    println("   • Joins: $(length(join_nodes))")
    println("   • Iteration layers: $(length(iteration_sets))")

    # ========================================================================
    # STEP 3: Identify Diamond Structures
    # ========================================================================
    println("\n💎 Identifying diamonds...")
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
    println("   • Root diamonds: $(length(root_diamonds))")

    # ========================================================================
    # STEP 4: Build Unique Diamond Storage
    # ========================================================================
    println("\n🔨 Building unique diamond storage...")
    t_storage = @elapsed begin
        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds,
            node_priors,
            ancestors,
            descendants,
            iteration_sets
        )
    end

    println("   ✓ Built in $(round(t_storage, digits=3))s")
    println("   • Unique diamonds: $(length(unique_diamonds))")

    # Analyze diamond complexity
    if !isempty(unique_diamonds)
        max_depth = maximum(d.depth_level for d in values(unique_diamonds))
        max_conditioning = maximum(d.num_conditioning_nodes for d in values(unique_diamonds))
        println("   • Max nesting depth: $max_depth")
        println("   • Max conditioning nodes: $max_conditioning (2^$max_conditioning = $(2^max_conditioning) states)")
    end

    # ========================================================================
    # STEP 5: Run Monte Carlo (if requested)
    # ========================================================================
    mc_results = nothing
    t_mc = 0.0

    if run_mc
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
    end

    # ========================================================================
    # STEP 6: Run ITERATIVE BP
    # ========================================================================
    println("\n🔄 Running ITERATIVE BP (@threads for state enumeration)...")
    println("   • Threads: $(Threads.nthreads())")
    println("   • Strategy: Iterative states, recursive diamonds")

    GC.gc()

    t_bp = @elapsed begin
        iterative_beliefs = update_beliefs_iterative_stack(
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

    println("   ✓ Completed in $(round(t_bp, digits=3))s")

    # ========================================================================
    # STEP 7: Compare with Monte Carlo (if available)
    # ========================================================================
    if run_mc && mc_results !== nothing
        println("\n📊 Comparing Iterative BP vs Monte Carlo...")

        all_nodes = sort(collect(keys(iterative_beliefs)))
        max_error = 0.0
        max_error_node = 0
        total_error = 0.0

        for node in all_nodes
            mc_val = mc_results[node]
            iter_val = iterative_beliefs[node]
            error = abs(iter_val - mc_val)

            total_error += error

            if error > max_error
                max_error = error
                max_error_node = node
            end
        end

        mean_error = total_error / length(all_nodes)

        println("   • Max error: $(round(max_error, sigdigits=6)) (at node $max_error_node)")
        println("   • Mean error: $(round(mean_error, sigdigits=6))")

        # Show top 10 errors
        errors = [(node, abs(iterative_beliefs[node] - mc_results[node])) for node in all_nodes]
        sort!(errors, by=x->x[2], rev=true)

        println("\n   Top 10 nodes by error:")
        for (i, (node, err)) in enumerate(errors[1:min(10, length(errors))])
            @printf("      %2d. Node %3d: MC = %.6f, Iterative = %.6f, Error = %.6e\n",
                    i, node, mc_results[node], iterative_beliefs[node], err)
        end

        # Create DataFrame for detailed comparison
        df = DataFrame(
            Node = all_nodes,
            MC_Truth = [mc_results[n] for n in all_nodes],
            Iterative = [iterative_beliefs[n] for n in all_nodes],
            Error = [abs(iterative_beliefs[n] - mc_results[n]) for n in all_nodes]
        )

        println("\n📋 Full precision comparison:")
        println("="^80)
        for node in all_nodes
            mc_val = mc_results[node]
            iter_val = iterative_beliefs[node]
            error = abs(iter_val - mc_val)

            @printf("Node %3d: MC = %.15f, Iterative = %.15f, Error = %.2e\n",
                    node, mc_val, iter_val, error)
        end
    end

    # ========================================================================
    # Results Summary
    # ========================================================================
    println("\n" * "="^80)
    println("RESULTS SUMMARY")
    println("="^80)

    println("\n⏱️  TIMING BREAKDOWN:")
    println("   Load network:        $(round(t_load, digits=3))s")
    println("   Build structure:     $(round(t_structure, digits=3))s")
    println("   Identify diamonds:   $(round(t_diamonds, digits=3))s")
    println("   Build storage:       $(round(t_storage, digits=3))s")
    if run_mc
        println("   Monte Carlo:         $(round(t_mc, digits=3))s")
    end
    println("   Iterative BP:        $(round(t_bp, digits=3))s")
    println("   " * "-"^50)
    total_time = t_load + t_structure + t_diamonds + t_storage + t_mc + t_bp
    println("   TOTAL TIME:          $(round(total_time, digits=3))s")

    println("\n✅ ITERATIVE BP COMPLETED SUCCESSFULLY!")
    println("="^80 * "\n")

    return (
        beliefs = iterative_beliefs,
        mc_results = mc_results,
        timing = (
            load = t_load,
            structure = t_structure,
            diamonds = t_diamonds,
            storage = t_storage,
            mc = t_mc,
            bp = t_bp,
            total = total_time
        )
    )
end

# ============================================================================
# Run the test
# ============================================================================

data_type = "float"

# Run with Monte Carlo comparison
result = run_iterative_test(network_name, data_type; run_mc=true, mc_samples=1_000_000)

# To run without MC (faster):
# result = run_iterative_test(network_name, data_type; run_mc=false)
