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


edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);
# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);

#show(edgelist)
#node_priors[1]= 0.6561
#node_priors[4]= 0.729
# Analyze diamond structures
diamond_structures = #= @run  =# identify_and_group_diamonds(
	join_nodes,
	ancestors,
	incoming_index,
	source_nodes,
	fork_nodes,
	iteration_sets,
	edgelist,
	descendants,
);
#show(descendants[1])Set([5, 16, 20, 12, 30, 28, 8, 17, 24, 23, 19, 22, 32, 6, 11, 9, 31, 14, 3, 29, 33, 7, 25, 4, 15, 21, 2, 10, 27, 18, 13, 26])
#show(diamond_structures)
#show(diamond_structures[15])
#show(diamond_structures[29].diamond[1].subgraph.sources)
#show(diamond_structures[260])
#show(diamond_structures[261])
#show(diamond_structures[202].diamond[1].subgraph.edgelist)
#pretty_print_diamonds(diamond_structures)

#= @run update_beliefs_iterative(
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
); =#

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
);

@btime exact_results = path_enumeration_result(
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities
    );

sorted_mc = OrderedDict(sort(collect(exact_results)));
#output[260]
#output[13] #mc = 0.921...
#= 

mc_results = (MC_result(
    edgelist,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    5_00_000,
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
CSV.write("sorted_mumin_result.csv", sorted_df)

 =#

#= 
1-( (1-0.9^2) * (1-0.9^2)  )

(0.99639  * 0.9 * 0.86751) + (0.9 * 0.1 * 0.86751) + (0.9639  * 0.9 * (1-0.86751)) 
=#
using CSV
using DataFrames

# Read the CSV file
df = CSV.read("sorted_result.csv", DataFrame)

# Convert to dictionary with Node as key and MCValue as is
node_mcvalue_dict = Dict{Int64, Float64}(
    row.Node => row.MCValue for row in eachrow(df)
)

sorted_algo = OrderedDict(sort(collect(output)));
sorted_mc = OrderedDict(sort(collect(node_mcvalue_dict)));

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
CSV.write("sorted_result.csv", sorted_df)


