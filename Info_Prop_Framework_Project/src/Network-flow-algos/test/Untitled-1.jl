# Check if this is the first run of the script for this julia repl session
# This is useful to avoid re-initializing the environment multiple times
if !@isdefined(script_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    # Ensure we're running from the project root directory
    current_dir = pwd()
    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Mark as initialized
    global script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

network_name = "drone-medical-delivery-network"







 data_type = "float"
# data_type = "interval"
#data_type = "pbox"



# Construct file paths using new folder structure
base_path = joinpath("dag_ntwrk_files", network_name)

# Option 1: Use edge file (recommended)
filepath_graph = joinpath(base_path, network_name * ".EDGES");
json_network_name = replace(network_name, "_" => "-")  # Convert underscores to hyphens for JSON files
filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")



if !isfile(filepath_graph)
    error("Graph file not found: $filepath_graph")
end
if !isfile(filepath_node_json)
    error("Node priors file not found: $filepath_node_json")
end
if !isfile(filepath_edge_json)
    error("Edge probabilities file not found: $filepath_edge_json")
end

# Read the graph and node priors

# Option 1: Separate calls (gives you more control)
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)

allnodes = # Get all nodes from the outgoing index
    collect(keys(incoming_index));
sink_nodes = #nodes with no keys in outgoing_index or with empty outgoing_index
    filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes);

node_priors = read_node_priors_from_json(filepath_node_json)

edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)


# Identify network structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

# Print current network structure analysis
println("\n=== CURRENT NETWORK STRUCTURE ANALYSIS ===")
println("Total nodes: ", length(allnodes))
println("Total Source nodes: ", length(source_nodes))
println("Total Sink nodes: ", length(sink_nodes))

println("Fork nodes: ", length(fork_nodes))
println("Total Join nodes: ", length(join_nodes))

println("Sink nodes: ", length(sink_nodes), " -> ", sink_nodes[1:min(10, end)], length(sink_nodes) > 10 ? "..." : "")
println("Fork nodes: ", length(fork_nodes), " -> ", collect(fork_nodes)[1:min(10, end)], length(fork_nodes) > 10 ? "..." : "")
println("Join nodes: ", length(join_nodes), " -> ", collect(join_nodes)[1:min(10, end)], length(join_nodes) > 10 ? "..." : "")
println("Number of iteration sets: ", length(iteration_sets))
for (i, set) in enumerate(iteration_sets[1:min(5, end)])
    println("  Iteration set $i: length=", length(set), " nodes=", collect(set)[1:min(5, end)], length(set) > 5 ? "..." : "")
end
if length(iteration_sets) > 5
    println("  ... and $(length(iteration_sets) - 5) more iteration sets")
end
println("Total edges: ", length(edgelist))
