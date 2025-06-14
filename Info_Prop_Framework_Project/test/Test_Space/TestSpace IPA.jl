import Fontconfig 
using DataFrames, DelimitedFiles, Distributions, 
      DataStructures, SparseArrays, BenchmarkTools, 
      Combinatorics


# Import framework
using .IPAFramework



#filepathcsv = "csvfiles/layereddiamond_3.csv";
filepathcsv = "csvfiles/16 NodeNetwork Adjacency matrix.csv";
#filepathcsv = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv";
#filepathcsv = "csvfiles/metro_directed_dag_for_ipm.csv";
#filepathcsv = "csvfiles/munin/munin_dag.csv";

#fork_nodes, join_nodes , edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets, ancestors, descendant
edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);
# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);

map!(x -> 1.0, values(node_priors));
map!(x -> 0.9, values(edge_probabilities));


diamond_structures= identify_and_group_diamonds(
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

#= # Exhaustive classification for each diamond
for (join_node, diamonds_at_node) in diamond_structures
    for (i, diamond) in enumerate(diamonds_at_node.diamond)
        classification = classify_diamond_exhaustive(
            diamond, join_node,
            edgelist, outgoing_index, incoming_index, source_nodes,
            fork_nodes, join_nodes, iteration_sets, ancestors, descendants
        )
        
        println("Join Node $join_node, Diamond $i:")
        println("  Fork Structure: $(classification.fork_structure)")
        println("  Internal Structure: $(classification.internal_structure)")
        println("  Path Topology: $(classification.path_topology)")
        println("  Join Structure: $(classification.join_structure)")
        println("  External Connectivity: $(classification.external_connectivity)")
        println("  Forks: $(classification.fork_count), Size: $(classification.subgraph_size)")
        println("  Optimization: $(classification.optimization_potential)")
        println()
    end
end =#

(
output =  update_beliefs_iterative(
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
           
Dict{Int64, Float64} with 23 entries:
  5  => 0.583288
  16 => 0.729
  20 => 0.484539
  12 => 0.59049
  8  => 0.729
  17 => 0.59049
  1  => 0.9
  ⋮  => ⋮

#output[23] #0.5723938497157594 =#

