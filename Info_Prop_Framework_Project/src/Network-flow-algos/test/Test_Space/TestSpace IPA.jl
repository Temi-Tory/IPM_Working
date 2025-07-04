import Fontconfig
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics

# Include the IPAFramework module
include("../../src/IPAFramework.jl")
using .IPAFramework



#user input from ui for eg 

#filepathcsv = "csvfiles/layereddiamond_3.csv";
#filepathcsv = "csvfiles/KarlNetwork.csv";
#filepathcsv = "csvfiles/real_drone_network_integrated_adjacency.csv";
filepathcsv = joinpath("Info_Prop_Framework_Project/csvfiles/16 NodeNetwork Adjacency matrix.csv"); # 4 by 4 grid
#filepathcsv = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv";
#filepathcsv = "csvfiles/metro_directed_dag_for_ipm.csv";
#filepathcsv = "csvfiles/ergo_proxy_dag_network.csv";



#THIS FILE IS GLOBAL TO THE ENTIRE USER SESSION UNLESS THEY UPLAD ANOTHER FILE 
# THE STRUCTURAL DETAIL TAB SHOWS THE STRUCTURE OF THE GRAPH
#THE vISUALIZATION tAB  SHOWS RAPH IN DOT FORMAT INTERCTIVE 
#fork_nodes, join_nodes , edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets, ancestors, descendant
edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);

#CAN USE USER PORVIDE OR TWEAK MASS  OR TWEAK INDICUDLA AFTER EITHER OF THE THE WORK 
map!(x -> 0.9, values(node_priors));
map!(x -> 0.9, values(edge_probabilities));

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