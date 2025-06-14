using Fontconfig: Fontconfig
using DataFrames, DelimitedFiles, Distributions,
    DataStructures, SparseArrays, BenchmarkTools,
    Combinatorics, IntervalArithmetic, ProbabilityBoundsAnalysis

# Import framework
using .IPAFramework



#filepathcsv = "csvfiles/layereddiamond_3.csv";
#filepathcsv = "csvfiles/16 NodeNetwork Adjacency matrix.csv";
filepathcsv = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv";
#filepathcsv = "csvfiles/metro_directed_dag_for_ipm.csv";
#filepathcsv = "csvfiles/munin/munin_dag.csv";

edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);
# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);

map!(x -> 0.9, values(node_priors));
map!(x -> 0.9, values(edge_probabilities));

node_priors, edge_probabilities = convert_to_pbox_data(node_priors, edge_probabilities);

diamond_structures= #= @run  =# identify_and_group_diamonds(
    join_nodes,
    ancestors,
    incoming_index,
    source_nodes,
    fork_nodes,
    iteration_sets,
    edgelist,
    descendants,
    node_priors
);



(
output =  pbox_update_beliefs_iterative(
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
));

#sorted_algo = OrderedDict(sort(collect(output)));

#= output for Pacific Gas and Electric node priors and edge probabilities = 0.9
     Dict{Int64, pbox} with 23 entries:
  5  => Pbox:     ~  ( range=0.58329, mean=0.58329, var=0.0)
  16 => Pbox:     ~  ( range=0.729, mean=0.729, var=0.0)
  20 => Pbox:     ~  ( range=0.48454, mean=0.48454, var=0.0)
  12 => Pbox:     ~  ( range=0.59049, mean=0.59049, var=0.0)
  8  => Pbox:     ~  ( range=0.729, mean=0.729, var=0.0)
  17 => Pbox:     ~  ( range=0.59049, mean=0.59049, var=0.0)
  1  => Pbox:     ~  ( range=0.9, mean=0.9, var=0.0)
  ⋮  => ⋮

#output[23] Pbox:     ~  ( range=0.57239, mean=0.57239, var=0.0) =#
