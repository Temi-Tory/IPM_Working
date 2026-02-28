"""
Debug Test - Identify Diamonds and Build Unique Storage (Steps 1-4)
Tests diamond identification and unique diamond building with dependency analysis
"""

# Check if this is the first run of the script for this julia repl session
if !@isdefined(script_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Mark as initialized
    global script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

 all_networks = [
        "pareto-point-1-high-resilience-fw",
        "pareto-point-2-high-resilience-vtol",
        "pareto-point-3-medium-resilience-sparse",
        "pareto-point-4-low-resilience-minimal",
        "pareto-point-5-medium-resilience-fw",
        "pareto-point-6-balanced",
        "drone-network-balanced-k3",
        "drone-network-cost-optimal",
        "drone-network-time-optimal-k2"
    ]

    
function run_debug_full_diamond_processing(network_name, data_type="float")
    println("\n" * "="^80)
    println("DEBUG TEST: Full Diamond Processing with Dependency Analysis")
    println("Testing Network: $network_name")
    println("Data Type: $data_type")
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

    # Check root_diamonds for empty conditioning nodes
    println("\n🔍 Checking root_diamonds (Step 3 output) for empty conditioning...")
    empty_root_count = 0
    for (join_node, diamond_at_node) in root_diamonds
        if isempty(diamond_at_node.diamond.conditioning_nodes)
            empty_root_count += 1
            println("  ❌ EMPTY CONDITIONING in root_diamonds!")
            println("     Join Node: ", join_node)
            println("     Relevant Nodes: ", sort(collect(diamond_at_node.diamond.relevant_nodes)))
        end
    end
    if empty_root_count == 0
        println("   ✅ All root_diamonds have non-empty conditioning nodes")
    else
        println("   ❌ Found $empty_root_count root_diamonds with empty conditioning!")
    end

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
        )
    end

    println("   ✓ Built in $(round(t_storage, digits=3))s")
    println("   Unique diamonds: $(length(unique_diamonds))")

    # ========================================================================
    # Results Summary
    # ========================================================================
    println("\n" * "="^80)
    println("RESULTS SUMMARY")
    println("="^80)
    println("\n⏱️  TIMING BREAKDOWN:")
    println("   Load network:       $(round(t_load, digits=3))s")
    println("   Build structure:    $(round(t_structure, digits=3))s")
    println("   Identify diamonds:  $(round(t_diamonds, digits=3))s")
    println("   Build storage:      $(round(t_storage, digits=3))s")
    println("   " * "-"^50)
    total_time = t_load + t_structure + t_diamonds + t_storage
    println("   TOTAL TIME:         $(round(total_time, digits=3))s")

    println("\n📋 Root Diamonds Summary:")
    for join_node in sort(collect(keys(root_diamonds)))
        diamond_at_node = root_diamonds[join_node]
        println("  Join Node $join_node:")
        println("    Conditioning Nodes: ", sort(collect(diamond_at_node.diamond.conditioning_nodes)))
        println("    Relevant Nodes: ", sort(collect(diamond_at_node.diamond.relevant_nodes)))
        println("    Edges: ", length(diamond_at_node.diamond.edgelist))
        println("    Non-Diamond Parents: ", sort(collect(diamond_at_node.non_diamond_parents)))
    end

    # ========================================================================
    # STEP 5: Dependency Analysis
    # ========================================================================
    println("\n" * "="^80)
    println("DEPENDENCY ANALYSIS")
    println("="^80)

    # Build dependency graph from unique diamonds
    println("\n🔍 Building dependency graph...")

    dep_graph = Dict{UInt64, Set{UInt64}}()  # hash -> set of sub-diamond hashes
    hash_to_diamond = Dict{UInt64, Any}()  # hash -> diamond computation data

    for (diamond_hash, diamond_comp_data) in unique_diamonds
        hash_to_diamond[diamond_hash] = diamond_comp_data

        # Get sub-diamond hashes
        sub_hashes = Set{UInt64}()
        for (sub_join_node, sub_diamond_at_node) in diamond_comp_data.sub_diamond_structures
            # Create hash for each sub-diamond
            sub_hash = create_diamond_hash_key(sub_diamond_at_node.diamond)
            push!(sub_hashes, sub_hash)
        end
        dep_graph[diamond_hash] = sub_hashes
    end

    println("   Dependency graph nodes: ", length(dep_graph))
    println("   Total edges: ", sum(length(v) for v in values(dep_graph)))

    # Check for self-referencing diamonds
    println("\n🔍 Checking for self-referencing diamonds...")
    self_ref_count = 0
    for (hash, sub_hashes) in dep_graph
        if hash in sub_hashes
            self_ref_count += 1
            diamond_comp_data = hash_to_diamond[hash]
            println("  ❌ SELF-REFERENCE FOUND!")
            println("     Diamond Hash: ", hash)
            println("     Is Root: ", diamond_comp_data.is_rootDiamond)
            println("     Conditioning Nodes: ", sort(collect(diamond_comp_data.diamond.conditioning_nodes)))
            println("     Relevant Nodes: ", sort(collect(diamond_comp_data.diamond.relevant_nodes)))
        end
    end

    if self_ref_count == 0
        println("   ✅ No self-referencing diamonds found")
    else
        println("   ❌ Found $self_ref_count self-referencing diamonds!")
    end

    # Check for circular dependencies (cycles)
    println("\n🔍 Checking for circular dependencies...")

    function has_cycle_dfs(node, graph, visited, rec_stack)
        visited[node] = true
        rec_stack[node] = true

        if haskey(graph, node)
            for neighbor in graph[node]
                if !get(visited, neighbor, false)
                    if has_cycle_dfs(neighbor, graph, visited, rec_stack)
                        return true
                    end
                elseif get(rec_stack, neighbor, false)
                    return true
                end
            end
        end

        rec_stack[node] = false
        return false
    end

    visited = Dict{UInt64, Bool}()
    cycles_found = false

    for node in keys(dep_graph)
        if !get(visited, node, false)
            rec_stack = Dict{UInt64, Bool}()
            if has_cycle_dfs(node, dep_graph, visited, rec_stack)
                cycles_found = true
                break
            end
        end
    end

    if cycles_found
        println("   ❌ CIRCULAR DEPENDENCIES DETECTED!")
    else
        println("   ✅ No circular dependencies found (DAG structure maintained)")
    end

    # Check for empty conditioning nodes in unique diamonds
    println("\n🔍 Checking unique diamonds for empty conditioning nodes...")
    empty_cond_count = 0
    for (diamond_hash, diamond_comp_data) in unique_diamonds
        if isempty(diamond_comp_data.diamond.conditioning_nodes)
            empty_cond_count += 1
            println("  ❌ EMPTY CONDITIONING!")
            println("     Diamond Hash: ", diamond_hash)
            println("     Is Root: ", diamond_comp_data.is_rootDiamond)
            println("     Relevant Nodes: ", sort(collect(diamond_comp_data.diamond.relevant_nodes)))
        end
    end

    if empty_cond_count == 0
        println("   ✅ All unique diamonds have non-empty conditioning nodes")
    else
        println("   ❌ Found $empty_cond_count unique diamonds with empty conditioning!")
    end

    println("\n" * "="^80)

    return root_diamonds, unique_diamonds
end

#log to single file for all test networks
log_filepath = "debug_test_diamond_processing_log.txt"
open(log_filepath, "w") do log_file
    for network_name in all_networks
        println(log_file, "\n" * "="^80)
        println(log_file, "DEBUG TEST LOG: Full Diamond Processing with Dependency Analysis")
        println(log_file, "Testing Network: $network_name")
        println(log_file, "="^80 * "\n")

        # Redirect stdout to log file temporarily
        redirect_stdout(log_file) do
            try
                run_debug_full_diamond_processing(network_name, "float")
            catch e
                println("   ❌ ERROR during processing: ", e)
            end
        end
    end
end
