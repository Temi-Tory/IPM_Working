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


edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);
# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);


node_priors = Dict(k => IPAFramework.Interval(0.9) for (k, v) in node_priors);
edge_probabilities = Dict(k => IPAFramework.Interval(0.9) for (k, v) in edge_probabilities);



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
#sorted_algo = OrderedDict(sort(collect(output)));

#= output for Pacific Gas and Electric node priors and edge probabilities = 0.9        
Dict{Int64, Main.IPAFramework.InputProcessingModule.Interval} with 23 entries:
  5  => Interval(0.583288, 0.583288)
  16 => Interval(0.729, 0.729)
  20 => Interval(0.484539, 0.484539)
  12 => Interval(0.59049, 0.59049)
  8  => Interval(0.729, 0.729)
  17 => Interval(0.59049, 0.59049)
  1  => Interval(0.9, 0.9)
  ⋮  => ⋮

#output[23] Pbox:    Main.IPAFramework.InputProcessingModule.Interval(0.5723938497157594, 0.5723938497157594) =#
