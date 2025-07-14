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
#network_name = "munin-dag"
network_name = "KarlNetwork"
#network_name = "real_drone_network_integrated_adjacency"
#network_name = "grid-graph"  # 4 by 4 grid
#network_name = "power-network"
#network_name = "metro_directed_dag_for_ipm"
#network_name = "ergo-proxy-dag-network"
#network_name = "real_drone_network" #6166 Edges, 244 Nodes


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


#map!(x -> 1.0, values(node_priors));

#Diamond structure analysis (if you have this function)
diamond_structures = identify_and_group_diamonds(
    join_nodes,
    incoming_index,
    ancestors,
    descendants,
    source_nodes,
    fork_nodes,
    edgelist,
    node_priors,
   # iteration_sets
);
#diamond_joins = Set([11]);
#diamond_joins = Set(collect(keys(diamond_structures)));

#diamond_structures[22].diamond[1].edgelist
#show(diamond_structures)
#= 
 diamond_structures2 = identify_and_group_diamonds_old(
        join_nodes,
        ancestors,
        incoming_index,
        source_nodes,
        fork_nodes,
        iteration_sets,
        edgelist,
        descendants,        
        node_priors 
    )
        show(diamond_structures2)
=#
#Run belief propagation

# Use the original version for now (cutset conditioning has infinite recursion bug)
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
);
#show(output)
#output[25] # expected output for KarlNetwork with float data type output[25] = 0.7859147610807606
#= 
exact_results = ( path_enumeration_result(
            outgoing_index,
            incoming_index,
            source_nodes,
            node_priors,
            edge_probabilities
        ));

    sorted_exact = OrderedDict(sort(collect(exact_results)));

    # Create base DataFrame using the float values directly
   df = DataFrame(
    Node = collect(keys(sorted_algo)),
    AlgoValue = collect(values(sorted_algo)),
    ExactValue = collect(values(sorted_exact))
)

# Add absolute difference
df.AbsDiff = abs.(df.AlgoValue .- df.ExactValue)

# Add percentage error: (|algo - exact| / exact) * 100
df.PercError = (df.AbsDiff ./ abs.(df.ExactValue)) .* 100

    # Display sorted result (if you want to sort by the difference)
    #show(sort(df, :AbsDiff, rev=true), allrows=true) 





    using CSV 

# Sort the DataFrame by the Diff column in descending order
sorted_df = sort(df, :AbsDiff, rev=true)

# Save the sorted DataFrame as a CSV file
CSV.write("munin-dag_0.9x0.9_ExactComp.csv", sorted_df)
   

=#



#=

mc_results = (MC_result(
    edgelist,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    1_000_000,
));


# Sort outputs
sorted_algo = OrderedDict(sort(collect(output)));
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


using CSV 

# Sort the DataFrame by the Diff column in descending order
sorted_df = sort(df, :Diff, rev=true)

# Save the sorted DataFrame as a CSV file
CSV.write("munin-dag_0.9x0.9_1milruns.csv", sorted_df)
 =#



