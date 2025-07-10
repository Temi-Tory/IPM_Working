import Fontconfig 
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics

# Ensure we're running from the project root directory
# Navigate to project root if we're in a subdirectory
current_dir = pwd()

# Include the IPAFramework module
include("../src/IPAFramework.jl")
using .IPAFramework

# User input from UI for example networks
# Choose your network - uncomment one:

#network_name = "layereddiamond_3"
#network_name = "KarlNetwork"
#network_name = "real_drone_network_integrated_adjacency"
network_name = "grid_graph"  # 4 by 4 grid
#network_name = "Power Distribution Network"
#network_name = "metro_directed_dag_for_ipm"
#network_name = "ergo_proxy_dag_network"

# Choose data type - uncomment one:
data_type = "float"
#data_type = "interval"
#data_type = "pbox"

# Construct file paths using new folder structure
base_path = joinpath("dag_ntwrk_files", network_name)

# Option 1: Use edge file (recommended)
filepath_graph = joinpath(base_path, network_name * ".EDGES")

# Option 2: Use original CSV adjacency matrix (if edge file doesn't exist)
# filepath_graph = joinpath("csvfiles", network_name * ".csv")

# JSON file paths in organized subfolders
# Handle naming inconsistency: grid_graph vs grid-graph in JSON files
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

node_priors = read_node_priors_from_json(filepath_node_json)

edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

# Option 2: Convenience function (alternative approach)
# edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities =
#     read_complete_network(filepath_graph, filepath_node_json, filepath_edge_json)

# Identify network structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)


#Diamond structure analysis (if you have this function)
diamond_structures = identify_and_group_diamonds(
    join_nodes,
    incoming_index,
    ancestors,
    descendants,
    source_nodes,
    fork_nodes,
    edgelist,
    node_priors
)

#Run belief propagation

output = IPAFramework.update_beliefs_iterative(
    edgelist,
    iteration_sets,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    descendants,
    ancestors,
    diamond_structures, 
    join_nodes,
    fork_nodes
)
