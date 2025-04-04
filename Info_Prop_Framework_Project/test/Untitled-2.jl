using Fontconfig: Fontconfig
using DataFrames, DelimitedFiles, Distributions,
	DataStructures, SparseArrays, BenchmarkTools,
	Combinatorics, IntervalArithmetic, ProbabilityBoundsAnalysis

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


"""
    convert_node_priors_to_pbox(node_priors::Dict{Int64, Float64}, 
                              uncertainty_margin::Float64 = 0.0)

    Converts a dictionary of node priors from Float64 values to pbox objects.
    If uncertainty_margin is 0, creates precise Bernoulli distributions.
    If uncertainty_margin > 0, creates interval bounds around each probability.

    Returns a new dictionary with the same keys but pbox values.
"""
function convert_node_priors_to_pbox(node_priors::Dict{Int64, Float64}, 
                                  uncertainty_margin::Float64 = 0.0)
    pbox_priors = Dict{Int64, pbox}()
    
    for (node, prob) in node_priors
        if uncertainty_margin == 0.0
            # Create precise Bernoulli as a p-box
            pbox_priors[node] = makepbox(interval(prob, prob))
        else
            # Create interval Bernoulli with uncertainty margin
            lower = max(0.0, prob - uncertainty_margin)
            upper = min(1.0, prob + uncertainty_margin)
            pbox_priors[node] = makepbox(interval(lower, upper))
        end
    end
    
    return pbox_priors
end

"""
    convert_edge_probabilities_to_pbox(edge_probabilities::Dict{Tuple{Int64, Int64}, Float64}, 
                                     uncertainty_margin::Float64 = 0.0)

    Converts a dictionary of edge probabilities from Float64 values to pbox objects.
    If uncertainty_margin is 0, creates precise Bernoulli distributions.
    If uncertainty_margin > 0, creates interval bounds around each probability.

    Returns a new dictionary with the same keys but pbox values.
"""
function convert_edge_probabilities_to_pbox(edge_probabilities::Dict{Tuple{Int64, Int64}, Float64}, 
                                         uncertainty_margin::Float64 = 0.0)
    pbox_probabilities = Dict{Tuple{Int64, Int64}, pbox}()
    
    for (edge, prob) in edge_probabilities
        if uncertainty_margin == 0.0
            # Create precise Bernoulli as a p-box
            pbox_probabilities[edge] = makepbox(interval(prob, prob))
        else
            # Create interval Bernoulli with uncertainty margin
            lower = max(0.0, prob - uncertainty_margin)
            upper = min(1.0, prob + uncertainty_margin)
            pbox_probabilities[edge] = makepbox(interval(lower, upper))
        end
    end
    
    return pbox_probabilities
end

"""
    convert_to_parametric_distributions(node_priors::Dict{Int64, Float64}, 
                                      mean_uncertainty::Float64 = 0.0,
                                      variance::Float64 = 0.01)

    Converts a dictionary of node priors from Float64 values to pbox objects using
    parametric distributions (Beta distribution is particularly suitable for probabilities).

    Parameters:
    - node_priors: Dictionary of node priors
    - mean_uncertainty: If > 0, creates interval means for the distributions
    - variance: Standard deviation for the distributions

    Returns a new dictionary with the same keys but pbox values.
"""
function convert_to_parametric_distributions(node_priors::Dict{Int64, Float64}, 
                                          mean_uncertainty::Float64 = 0.0,
                                          variance::Float64 = 0.01)
    pbox_priors = Dict{Int64, pbox}()
    
    for (node, prob) in node_priors
        if mean_uncertainty == 0.0
            # Create Beta distribution (suitable for probabilities)
            # Note: Need to determine appropriate parameters based on mean and variance
            # For Beta(α,β): mean = α/(α+β), variance = αβ/((α+β)²(α+β+1))
            # For simplicity, we'll use normal with truncation at 0 and 1
            pbox_priors[node] = normal(prob, variance)
        else
            # Create Beta with interval mean
            lower = max(0.0, prob - mean_uncertainty)
            upper = min(1.0, prob + mean_uncertainty)
            pbox_priors[node] = beta(interval(lower, upper), interval(variance, variance))
        end
    end
    
    return pbox_priors
end

"""
    convert_edge_to_parametric_distributions(edge_probabilities::Dict{Tuple{Int64, Int64}, Float64}, 
                                           mean_uncertainty::Float64 = 0.0,
                                           variance::Float64 = 0.01)

    Converts a dictionary of edge probabilities from Float64 values to pbox objects using
    parametric distributions (Beta distribution is particularly suitable for probabilities).

    Parameters:
    - edge_probabilities: Dictionary of edge probabilities
    - mean_uncertainty: If > 0, creates interval means for the distributions
    - variance: Standard deviation for the distributions

    Returns a new dictionary with the same keys but pbox values.
"""
function convert_edge_to_parametric_distributions(edge_probabilities::Dict{Tuple{Int64, Int64}, Float64}, 
                                               mean_uncertainty::Float64 = 0.0,
                                               variance::Float64 = 0.01)
    pbox_probabilities = Dict{Tuple{Int64, Int64}, pbox}()
    
    for (edge, prob) in edge_probabilities
        if mean_uncertainty == 0.0
            # Create Beta distribution
            pbox_probabilities[edge] = normal(prob, variance)
        else
            # Create Beta with interval mean
            lower = max(0.0, prob - mean_uncertainty)
            upper = min(1.0, prob + mean_uncertainty)
            pbox_probabilities[edge] = beta(interval(lower, upper), interval(variance, variance))
        end
    end
    
    return pbox_probabilities
end



# Example usage:


# Example usage:
# node_priors = Dict{Int64, Float64}(1 => 0.8, 2 => 0.7, 3 => 0.9)
# edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}((1,2) => 0.7, (2,3) => 0.8)
# 
# # Convert to precise p-boxes (no uncertainty)
# pbox_priors = convert_node_priors_to_pbox(node_priors);
# pbox_edges = convert_edge_probabilities_to_pbox(edge_probabilities);
# 
# # Convert with 5% uncertainty margin
# uncertain_priors = convert_node_priors_to_pbox(node_priors, 0.05)
# uncertain_edges = convert_edge_probabilities_to_pbox(edge_probabilities, 0.05)
# 
# # Convert to Beta distributions
# beta_priors = convert_to_parametric_distributions(node_priors)
# beta_edges = convert_edge_to_parametric_distributions(edge_probabilities)



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

#= 
pbox_priors = convert_node_priors_to_pbox(node_priors);
pbox_edges = convert_edge_probabilities_to_pbox(edge_probabilities);
 
output_pbox =  pbox_update_beliefs_iterative(
    edgelist,
    iteration_sets, 
    outgoing_index,
    incoming_index,
    source_nodes,
    pbox_priors,
    pbox_edges,
    descendants,
    ancestors, 
    diamond_structures,
    join_nodes,
    fork_nodes
);



 #show(output_pbox[261])


# Load required packages
using CSV, DataFrames

# Read the MC values from the CSV file
df_mc = CSV.read("sorted_result.csv", DataFrame)

# Create a dictionary from the CSV data
node_mcvalue_dict = Dict{Int64, Float64}(
    row.Node => row.MCValue for row in eachrow(df_mc)
)

# Create a DataFrame to compare pbox means with MC values
comparison_df = DataFrame(
    Node = Int64[],
    PboxMean = Float64[],
    MCValue = Float64[],
    Diff = Float64[]
)

# Populate the comparison DataFrame
for (node, val) in output_pbox
    node_int = parse(Int64, string(node))  # Convert node to Int64
    
    # Extract the mean from the pbox
    if typeof(val) <: AbstractPbox
        # If pbox has interval mean, take the midpoint
        if val.ml != val.mh
            pbox_mean = (val.ml + val.mh) / 2
        else
            pbox_mean = val.ml
        end
    else
        # If it's a numerical value, use that directly
        pbox_mean = val
    end
    
    # Get the corresponding MC value
    mc_value = get(node_mcvalue_dict, node_int, NaN)
    
    # Calculate the difference
    diff = abs(pbox_mean - mc_value)
    
    push!(comparison_df, (node_int, pbox_mean, mc_value, diff))
end

# Sort by difference in descending order
sorted_comparison = sort(comparison_df, :Diff, rev=true)

# Show the sorted results
show(sorted_comparison, allrows=true)

# Save to CSV
CSV.write("pbox_mc_comparison.csv", sorted_comparison)

 =#
 #sample = rand(output_pbox[261])
 
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


#show(output[261])


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


