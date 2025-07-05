import Fontconfig 
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics

# Include the IPAFramework module
include("../src/IPAFramework.jl")
using .IPAFramework

# User input from UI for example networks
# Choose your network - uncomment one:

#network_name = "layereddiamond_3"
#network_name = "KarlNetwork"
#network_name = "real_drone_network_integrated_adjacency"
network_name = "16 NodeNetwork Adjacency matrix"  # 4 by 4 grid
#network_name = "Power Distribution Network"
#network_name = "metro_directed_dag_for_ipm"
#network_name = "ergo_proxy_dag_network"

# Choose data type - uncomment one:
data_type = "float"
#data_type = "interval"
#data_type = "pbox"

# Construct file paths using new folder structure
base_path = joinpath("jsonfiles", network_name)

# Option 1: Use edge file (recommended)
filepath_graph = joinpath(base_path, network_name * ".edge")

# Option 2: Use original CSV adjacency matrix (if edge file doesn't exist)
# filepath_graph = joinpath("csvfiles", network_name * ".csv")

# JSON file paths in organized subfolders
filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

println("Using files:")
println("Graph: $filepath_graph")
println("Node priors: $filepath_node_json") 
println("Edge probabilities: $filepath_edge_json")

# Verify files exist
if !isfile(filepath_graph)
    error("Graph file not found: $filepath_graph")
end
if !isfile(filepath_node_json)
    error("Node priors file not found: $filepath_node_json")
end
if !isfile(filepath_edge_json)
    error("Edge probabilities file not found: $filepath_edge_json")
end

# Read the network data
println("\nReading network data...")

# Option 1: Separate calls (gives you more control)
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

println("Network loaded:")
println("- Nodes: $(length(union(Set(first.(edgelist)), Set(last.(edgelist)))))")
println("- Edges: $(length(edgelist))")
println("- Source nodes: $(length(source_nodes))")
println("- Data type: $(typeof(first(values(node_priors))))")

# Option 2: Convenience function (alternative approach)
# edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities =
#     read_complete_network(filepath_graph, filepath_node_json, filepath_edge_json)

# Identify network structure
println("\nAnalyzing network structure...")
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

println("- Fork nodes: $(length(fork_nodes))")
println("- Join nodes: $(length(join_nodes))")
println("- Iteration sets: $(length(iteration_sets))")

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
println("\nRunning belief propagation...")

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

println("Setup complete! Network ready for analysis.")

# Example: Print some basic network info
println("\nNetwork Summary:")
println("Edgelist (first 10):")
for (i, edge) in enumerate(edgelist[1:min(10, length(edgelist))])
    println("  $edge")
end

println("\nSource nodes: $source_nodes")
println("Fork nodes: $fork_nodes") 
println("Join nodes: $join_nodes")

# Example: Print some probability values
println("\nSample probabilities:")
sample_nodes = collect(keys(node_priors))[1:min(5, length(node_priors))]
for node in sample_nodes
    println("  Node $node: $(node_priors[node])")
end