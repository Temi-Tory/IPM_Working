using Fontconfig: Fontconfig
using DataFrames, DelimitedFiles, Distributions,
	DataStructures, SparseArrays, BenchmarkTools,
	Combinatorics, IntervalArithmetic, ProbabilityBoundsAnalysis

# Import framework
using .IPAFramework

#filepathcsv = "csvfiles/layereddiamond_3.csv";
filepathcsv = "csvfiles/16 NodeNetwork Adjacency matrix.csv";
#filepathcsv = "csvfiles/KarlNetwork.csv";
#filepathcsv = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv";
#filepathcsv = "csvfiles/metro_directed_dag_for_ipm.csv";

#show(edgelist)
edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);
# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);

#map!(x -> 0.9999, values(node_priors));
map!(x -> 0.9, values(node_priors));
map!(x -> 0.9, values(edge_probabilities));
#map!(x -> 0.9999, values(edge_probabilities));

# Analyze diamond structures
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


#pushfirst!(diamond_structures[7].diamond[1].subgraph.iteration_sets, Set([13]));
#show(diamond_structures)
#show(diamond_structures[7].diamond[1].subgraph.iteration_sets)
#show(diamond_structures[7].non_diamond_parents diamond[1].subgraph.edgelist)
#push!(diamond_structures[7].diamond[1].subgraph.edgelist, (13, 9))
#@run
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

sorted_algo = OrderedDict(sort(collect(output)));

#show(sorted_algo)
#output[12]

exact_results =  path_enumeration_result(
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities
    );

sorted_exact = OrderedDict(sort(collect(exact_results)));

# Create base DataFrame using the float values directly
df = DataFrame(
  Node = collect(keys(sorted_algo)),
  AlgoValue = collect(values(sorted_algo)),
  ExactValue = collect(values(sorted_exact))
)

# Add a difference column (if needed)
df.Diff = abs.(df.AlgoValue .- df.ExactValue)
# Display sorted result (if you want to sort by the difference)
show(sort(df, :Diff, rev=true), allrows=true)