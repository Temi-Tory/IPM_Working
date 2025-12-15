"""
Network Topology and Diamond Structure Logger
==============================================
This script logs complete network topology and diamond structure details to a file.
Run up to STEP 4 (Build Unique Diamond Storage) and dump all data for ground truth reference.
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

# ============================================================================
# Network Selection
# ============================================================================

network_name = "drone-network-balanced-k3"
data_type = "float"

# Output log file
output_log_file = joinpath("logs", "$(network_name)_$(data_type)_topology_and_diamonds_$(Dates.format(now(), "yyyymmdd_HHMMSS")).log")

# ============================================================================
# Logging Helper Functions
# ============================================================================

function log_section_header(io::IO, title::String, level::Int=1)
    separator = "="^80
    if level == 1
        println(io, "\n" * separator)
        println(io, title)
        println(io, separator * "\n")
    elseif level == 2
        println(io, "\n" * "-"^80)
        println(io, title)
        println(io, "-"^80 * "\n")
    else
        println(io, "\n### $title ###\n")
    end
end

function log_dict_sorted(io::IO, dict::Dict, prefix::String="")
    sorted_keys = sort(collect(keys(dict)))
    for key in sorted_keys
        println(io, "$(prefix)$key => $(dict[key])")
    end
end

function log_set_sorted(io::IO, set::Set, prefix::String="")
    sorted_items = sort(collect(set))
    println(io, "$(prefix)[$(join(sorted_items, ", "))]")
end

function log_edgelist(io::IO, edgelist::Vector{Tuple{Int64, Int64}}, prefix::String="")
    sorted_edges = sort(edgelist)
    for (source, target) in sorted_edges
        println(io, "$(prefix)($source, $target)")
    end
end

function log_diamond_structure(io::IO, diamond, indent::String="  ")
    println(io, "$(indent)Relevant Nodes: $(sort(collect(diamond.relevant_nodes)))")
    println(io, "$(indent)Conditioning Nodes: $(sort(collect(diamond.conditioning_nodes)))")
    println(io, "$(indent)Edge List ($(length(diamond.edgelist)) edges):")
    for (src, tgt) in sort(diamond.edgelist)
        println(io, "$(indent)  ($src, $tgt)")
    end
end

function log_diamonds_at_node(io::IO, join_node::Int64, dan)
    println(io, "  Join Node: $join_node")
    println(io, "  Non-Diamond Parents: $(sort(collect(dan.non_diamond_parents)))")
    println(io, "  Diamond Structure:")
    log_diamond_structure(io, dan.diamond, "    ")
    println(io, "")
end

function value_to_string(val)
    if isa(val, Float64)
        return string(val)
    elseif isa(val, InputProcessingModule.Interval)
        return "Interval($(val.lower), $(val.upper))"
    elseif isa(val, ProbabilityBoundsAnalysis.pbox)
        return "pbox(ml=$(val.ml), mh=$(val.mh))"
    else
        return string(val)
    end
end

# ============================================================================
# Main Logging Function
# ============================================================================

function log_network_and_diamonds(network_name::String, data_type::String, output_file::String)
    # Create logs directory if it doesn't exist
    mkpath(dirname(output_file))

    # Open log file
    open(output_file, "w") do io
        println(io, "Network Topology and Diamond Structure Log")
        println(io, "Generated: $(Dates.format(now(), "yyyy-mm-dd HH:MM:SS"))")
        println(io, "Network: $network_name")
        println(io, "Data Type: $data_type")
        println(io, "="^80)

        # ========================================================================
        # STEP 1: Load Network Data
        # ========================================================================
        log_section_header(io, "STEP 1: LOAD NETWORK DATA", 1)

        base_path = joinpath("dag_ntwrk_files", network_name)
        filepath_graph = joinpath(base_path, network_name * ".EDGES")
        filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
        filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

        println(io, "Files:")
        println(io, "  Graph: $filepath_graph")
        println(io, "  Node Priors: $filepath_node_json")
        println(io, "  Edge Probabilities: $filepath_edge_json")
        println(io, "")

        t_load = @elapsed begin
            edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
            node_priors = read_node_priors_from_json(filepath_node_json)
            edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
        end

        # Find sink nodes
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)

        println(io, "Load Time: $(round(t_load, digits=3))s")
        println(io, "Total Nodes: $(length(node_priors))")
        println(io, "Total Edges: $(length(edgelist))")
        println(io, "Source Nodes: $(length(source_nodes))")
        println(io, "Sink Nodes: $(length(sink_nodes))")

        # Log detailed network structure
        log_section_header(io, "1.1 Edge List (Complete)", 2)
        log_edgelist(io, edgelist, "  ")

        log_section_header(io, "1.2 Node Priors", 2)
        sorted_node_ids = sort(collect(keys(node_priors)))
        for node_id in sorted_node_ids
            println(io, "  Node $node_id: $(value_to_string(node_priors[node_id]))")
        end

        log_section_header(io, "1.3 Edge Probabilities", 2)
        sorted_edges = sort(collect(keys(edge_probabilities)))
        for (src, tgt) in sorted_edges
            println(io, "  Edge ($src, $tgt): $(value_to_string(edge_probabilities[(src, tgt)]))")
        end

        log_section_header(io, "1.4 Outgoing Index (Adjacency List)", 2)
        sorted_nodes = sort(collect(keys(outgoing_index)))
        for node in sorted_nodes
            targets = sort(collect(outgoing_index[node]))
            println(io, "  Node $node -> [$(join(targets, ", "))]")
        end

        log_section_header(io, "1.5 Incoming Index (Reverse Adjacency List)", 2)
        sorted_nodes = sort(collect(keys(incoming_index)))
        for node in sorted_nodes
            sources = sort(collect(incoming_index[node]))
            println(io, "  Node $node <- [$(join(sources, ", "))]")
        end

        log_section_header(io, "1.6 Source Nodes", 2)
        log_set_sorted(io, source_nodes, "  ")

        log_section_header(io, "1.7 Sink Nodes", 2)
        println(io, "  [$(join(sort(sink_nodes), ", "))]")

        # ========================================================================
        # STEP 2: Build Network Structure
        # ========================================================================
        log_section_header(io, "STEP 2: BUILD NETWORK STRUCTURE", 1)

        t_structure = @elapsed begin
            fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
            iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        end

        println(io, "Build Time: $(round(t_structure, digits=3))s")
        println(io, "Fork Nodes: $(length(fork_nodes))")
        println(io, "Join Nodes: $(length(join_nodes))")
        println(io, "Iteration Layers: $(length(iteration_sets))")

        log_section_header(io, "2.1 Fork Nodes (Nodes with multiple children)", 2)
        log_set_sorted(io, fork_nodes, "  ")

        log_section_header(io, "2.2 Join Nodes (Nodes with multiple parents)", 2)
        log_set_sorted(io, join_nodes, "  ")

        log_section_header(io, "2.3 Iteration Sets (Topological Layers)", 2)
        for (i, iter_set) in enumerate(iteration_sets)
            println(io, "  Layer $i: [$(join(sort(collect(iter_set)), ", "))]")
        end

        log_section_header(io, "2.4 Ancestors for Each Node", 2)
        sorted_nodes = sort(collect(keys(ancestors)))
        for node in sorted_nodes
            anc = sort(collect(ancestors[node]))
            println(io, "  Node $node: [$(join(anc, ", "))]")
        end

        log_section_header(io, "2.5 Descendants for Each Node", 2)
        sorted_nodes = sort(collect(keys(descendants)))
        for node in sorted_nodes
            desc = sort(collect(descendants[node]))
            println(io, "  Node $node: [$(join(desc, ", "))]")
        end

        # ========================================================================
        # STEP 3: Identify Diamond Structures
        # ========================================================================
        log_section_header(io, "STEP 3: IDENTIFY DIAMOND STRUCTURES", 1)

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

        println(io, "Identification Time: $(round(t_diamonds, digits=3))s")
        println(io, "Root Diamonds Found: $(length(root_diamonds))")

        log_section_header(io, "3.1 Root Diamonds (Detailed)", 2)
        sorted_join_nodes = sort(collect(keys(root_diamonds)))
        for join_node in sorted_join_nodes
            println(io, "")
            log_diamonds_at_node(io, join_node, root_diamonds[join_node])
        end

        # ========================================================================
        # STEP 4: Build Unique Diamond Storage
        # ========================================================================
        log_section_header(io, "STEP 4: BUILD UNIQUE DIAMOND STORAGE", 1)

        t_storage = @elapsed begin
            unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                root_diamonds,
                node_priors,
                ancestors,
                descendants,
                iteration_sets
            );
        end

        println(io, "Storage Build Time: $(round(t_storage, digits=3))s")
        println(io, "Unique Diamonds: $(length(unique_diamonds))")

        log_section_header(io, "4.1 Unique Diamond Storage (All Diamonds)", 2)

        # Sort by hash for consistent ordering
        sorted_hashes = sort(collect(keys(unique_diamonds)))

        for (idx, diamond_hash) in enumerate(sorted_hashes)
            comp_data = unique_diamonds[diamond_hash]

            println(io, "")
            println(io, "Diamond #$idx (Hash: $diamond_hash)")
            println(io, "  Is Root Diamond: $(comp_data.is_rootDiamond)")
            println(io, "")

            println(io, "  Main Diamond Structure:")
            log_diamond_structure(io, comp_data.diamond, "    ")

            println(io, "")
            println(io, "  Subgraph Properties:")
            println(io, "    Sub-Sources: $(sort(collect(comp_data.sub_sources)))")
            println(io, "    Sub-Fork Nodes: $(sort(collect(comp_data.sub_fork_nodes)))")
            println(io, "    Sub-Join Nodes: $(sort(collect(comp_data.sub_join_nodes)))")

            println(io, "")
            println(io, "    Sub-Outgoing Index:")
            for node in sort(collect(keys(comp_data.sub_outgoing_index)))
                targets = sort(collect(comp_data.sub_outgoing_index[node]))
                println(io, "      Node $node -> [$(join(targets, ", "))]")
            end

            println(io, "")
            println(io, "    Sub-Incoming Index:")
            for node in sort(collect(keys(comp_data.sub_incoming_index)))
                sources = sort(collect(comp_data.sub_incoming_index[node]))
                println(io, "      Node $node <- [$(join(sources, ", "))]")
            end

            println(io, "")
            println(io, "    Sub-Ancestors:")
            for node in sort(collect(keys(comp_data.sub_ancestors)))
                anc = sort(collect(comp_data.sub_ancestors[node]))
                println(io, "      Node $node: [$(join(anc, ", "))]")
            end

            println(io, "")
            println(io, "    Sub-Descendants:")
            for node in sort(collect(keys(comp_data.sub_descendants)))
                desc = sort(collect(comp_data.sub_descendants[node]))
                println(io, "      Node $node: [$(join(desc, ", "))]")
            end

            println(io, "")
            println(io, "    Sub-Iteration Sets:")
            for (i, iter_set) in enumerate(comp_data.sub_iteration_sets)
                println(io, "      Layer $i: [$(join(sort(collect(iter_set)), ", "))]")
            end

            println(io, "")
            println(io, "    Sub-Node Priors:")
            for node in sort(collect(keys(comp_data.sub_node_priors)))
                println(io, "      Node $node: $(value_to_string(comp_data.sub_node_priors[node]))")
            end

            println(io, "")
            println(io, "    Sub-Diamond Structures (Inner Diamonds):")
            if isempty(comp_data.sub_diamond_structures)
                println(io, "      (None)")
            else
                for sub_join in sort(collect(keys(comp_data.sub_diamond_structures)))
                    println(io, "")
                    println(io, "      Sub-Diamond at Join Node $sub_join:")
                    sub_dan = comp_data.sub_diamond_structures[sub_join]
                    println(io, "        Non-Diamond Parents: $(sort(collect(sub_dan.non_diamond_parents)))")
                    log_diamond_structure(io, sub_dan.diamond, "        ")
                end
            end

            println(io, "")
            println(io, "  " * "="^78)
        end

        # ========================================================================
        # Summary Statistics
        # ========================================================================
        log_section_header(io, "SUMMARY STATISTICS", 1)

        println(io, "Network Properties:")
        println(io, "  Total Nodes: $(length(allnodes))")
        println(io, "  Total Edges: $(length(edgelist))")
        println(io, "  Source Nodes: $(length(source_nodes))")
        println(io, "  Sink Nodes: $(length(sink_nodes))")
        println(io, "  Fork Nodes: $(length(fork_nodes))")
        println(io, "  Join Nodes: $(length(join_nodes))")
        println(io, "  Iteration Layers: $(length(iteration_sets))")
        println(io, "")
        println(io, "Diamond Statistics:")
        println(io, "  Root Diamonds: $(length(root_diamonds))")
        println(io, "  Total Unique Diamonds: $(length(unique_diamonds))")

        # Count root vs sub diamonds
        root_count = count(d -> d.is_rootDiamond, values(unique_diamonds))
        sub_count = length(unique_diamonds) - root_count
        println(io, "  Root Diamond Structures: $root_count")
        println(io, "  Sub-Diamond Structures: $sub_count")

        println(io, "")
        println(io, "Timing:")
        println(io, "  Load Network: $(round(t_load, digits=3))s")
        println(io, "  Build Structure: $(round(t_structure, digits=3))s")
        println(io, "  Identify Diamonds: $(round(t_diamonds, digits=3))s")
        println(io, "  Build Storage: $(round(t_storage, digits=3))s")
        println(io, "  Total Time: $(round(t_load + t_structure + t_diamonds + t_storage, digits=3))s")

        println(io, "")
        println(io, "="^80)
        println(io, "END OF LOG")
        println(io, "="^80)
    end

    println("✅ Log file created: $output_file")
    println("   File size: $(filesize(output_file)) bytes")
end

# ============================================================================
# Run the logging
# ============================================================================

println("\n" * "="^80)
println("NETWORK TOPOLOGY AND DIAMOND STRUCTURE LOGGER")
println("="^80)
println("Network: $network_name")
println("Data Type: $data_type")
println("Output: $output_log_file")
println("="^80 * "\n")

log_network_and_diamonds(network_name, data_type, output_log_file)

println("\n✅ Logging complete!")
println("   Review the log file for complete network topology and diamond details.")
