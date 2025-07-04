import Fontconfig
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics

# Include the IPAFramework module
include("../src/IPAFramework.jl")
using .IPAFramework


#user input from ui for eg 

#filepathcsv = "csvfiles/layereddiamond_3.csv";
#filepathcsv = "csvfiles/KarlNetwork.csv";
#filepathcsv = "csvfiles/real_drone_network_integrated_adjacency.csv";
filepathcsv = joinpath("csvfiles/16 NodeNetwork Adjacency matrix.csv"); # 4 by 4 grid
#filepathcsv = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv";
#filepathcsv = "csvfiles/metro_directed_dag_for_ipm.csv";
#filepathcsv = "csvfiles/ergo_proxy_dag_network.csv";

filepath_node_json = joinpath("jsonfiles/16 NodeNetwork Adjacency matrix_float-nodepriors.json");
filepath_edge_json = joinpath("jsonfiles/16 NodeNetwork Adjacency matrix_float-linkprobabilities.json");

#= filepath_node_json = joinpath("jsonfiles/16 NodeNetwork Adjacency matrix_interval-nodepriors.json");
filepath_edge_json = joinpath("jsonfiles/16 NodeNetwork Adjacency matrix_interval-linkprobabilities.json");
 =#
#= filepath_node_json = joinpath("jsonfiles/16 NodeNetwork Adjacency matrix_pbox-nodepriors.json");
filepath_edge_json = joinpath("jsonfiles/16 NodeNetwork Adjacency matrix_pbox-linkprobabilities.json");
 =#

# Option 1: Separate calls
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepathcsv)
node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

# Option 2: Convenience function  
edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = 
    read_complete_network(filepathcsv, filepath_node_json, filepath_edge_json)


# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);


#DIAMOND VISAULIZTAION WITHD IFFGERNET DIRLL DOWNS

diamond_structures= identify_and_group_diamonds(
    join_nodes,
    incoming_index,
    ancestors,
    descendants,
    source_nodes,
    fork_nodes,
    edgelist,
    #iteration_sets,
    node_priors
);


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

output[16]