import Fontconfig
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics


using Pkg
Pkg.activate("C:/Users/ohian/OneDrive - University of Strathclyde/Documents/Programmming Files/Julia Files/InformationPropagation/Info_Prop_Framework_Project")

# Import framework - corrected path
include("IPAFramework.jl")
using .IPAFramework

filepathcsv = "csvfiles/Power Distribution Network.csv"; 
edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);



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
    node_priors
);

for key in keys(diamond_structures)
    println("---------------------------------------------------")
        println("--------------------diamond_structures-------------------------------")
    println("---------------------------------------------------")
    j_node = diamond_structures[key].join_node
    println("Join node = $j_node")

    non_diamond_parents = diamond_structures[key].non_diamond_parents
    println("non_diamond_parents = $non_diamond_parents")

    
    diamond_edglist = diamond_structures[key].diamond.edgelist
    println("diamond_edglist = $diamond_edglist")

    diamond_relevant_nodes = diamond_structures[key].diamond.relevant_nodes
    println("diamond_relevant_nodes = $diamond_relevant_nodes")

    diamond_highest_nodes = diamond_structures[key].diamond.highest_nodes
    println("diamond_highest_nodes = $diamond_highest_nodes")

    println("---------------------------------------------------")
end 
