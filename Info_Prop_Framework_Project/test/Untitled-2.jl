using Fontconfig: Fontconfig
using DataFrames, DelimitedFiles, Distributions,
	DataStructures, SparseArrays, BenchmarkTools,
	Combinatorics


# Import framework
using .IPAFramework
#filepathcsv = "csvfiles/16 NodeNetwork Adjacency matrix.csv";
#filepathcsv = "csvfiles/join_260.csv";
filepathcsv = "csvfiles/metro_directed_dag_for_ipm.csv";

edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);
# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);


#node_priors[1]= 0.6561
#node_priors[4]= 0.729
# Analyze diamond structures
diamond_structures = identify_and_group_diamonds(
	join_nodes,
	ancestors,
	incoming_index,
	source_nodes,
	fork_nodes,
	iteration_sets,
	edgelist,
	descendants,
);

#diamond_structures[248]
#=
print_graph_details(
    edgelist, 
    outgoing_index, 
    incoming_index, 
    source_nodes, 
    fork_nodes, 
    join_nodes, 
    iteration_sets, 
    ancestors, 
    descendants, 
    diamond_structures
) =#

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

#output[261]


#= 

mc_results = (MC_result(
    edgelist,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    1000000
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
CSV.write("sorted_result.csv", sorted_df)

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


