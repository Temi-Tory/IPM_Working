import  Fontconfig 
using   Graphs, ChordalGraph, MetaGraphsNext, NetworkLayout,  DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

using Main.InputProcessingModule
using  Main.ReachabilityModule
using  Main.NetworkDecompositionModule


"""
    pretty_print_diamonds(diamond_structures::Dict{Int64, GroupedDiamondStructure})
    Prints diamond structures in a readable format.
"""
function pretty_print_diamonds(diamond_structures::Dict{Int64, NetworkDecompositionModule.GroupedDiamondStructure})
    println("\nDiamond Patterns Analysis")
    println("=" ^ 50)
    
    for (join_node, structure) in diamond_structures
        println("\nJoin Node: $join_node")
        println("-" ^ 30)
        
        # Print diamond patterns
        for group in structure.diamond
            ancestors_str = join(collect(group.ancestors), ", ")
            parents_str = join(collect(group.influenced_parents), ", ")
            highest_str = join(collect(group.highest_nodes), ", ")
            
            println("  Common Ancestors: [$ancestors_str]")
            println("  ├─ Highest Nodes: [$highest_str]")
            println("  └─ Influences Parents: [$parents_str]")
            println()
        end

        # Print non-diamond parents if any exist
        if !isempty(structure.non_diamond_parents)
            non_diamond_str = join(collect(structure.non_diamond_parents), ", ")
            println("  Non-Diamond Parents: [$non_diamond_str]")
            println()
        end
    end
end

"""
    pretty_print_diamond(structure::GroupedDiamondStructure)
    Prints a single diamond structure in a readable format.
"""
function pretty_print_diamond(structure::NetworkDecompositionModule.GroupedDiamondStructure)
    println("\nDiamond Pattern at Join Node: $(structure.join_node)")
    println("-" ^ 40)
    
    # Print diamond patterns
    for group in structure.diamond
        ancestors_str = join(collect(group.ancestors), ", ")
        parents_str = join(collect(group.influenced_parents), ", ")
        highest_str = join(collect(group.highest_nodes), ", ")
        
        println("  Common Ancestors: [$ancestors_str]")
        println("  ├─ Highest Nodes: [$highest_str]")
        println("  └─ Influences Parents: [$parents_str]")
        println()
    end

    # Print non-diamond parents if any exist
    if !isempty(structure.non_diamond_parents)
        non_diamond_str = join(collect(structure.non_diamond_parents), ", ")
        println("  Non-Diamond Parents: [$non_diamond_str]")
        println()
    end
end

function print_graph_details(
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
 )
    println("Graph Details:")
    
    # Print edge list
    println("Edgelist:")
    for edge in edgelist
        println("  $edge")
    end
    
    # Print outgoing and incoming index
    println("\nOutgoing Index:")
    for (node, neighbors) in outgoing_index
        println("  Node $node -> Outgoing Neighbors: $(collect(neighbors))")
    end
    
    println("\nIncoming Index:")
    for (node, neighbors) in incoming_index
        println("  Node $node -> Incoming Neighbors: $(collect(neighbors))")
    end

    # Print source, fork, and join nodes
    println("\nSource Nodes: $(collect(source_nodes))")
    println("Fork Nodes: $(collect(fork_nodes))")
    println("Join Nodes: $(collect(join_nodes))")
    
    # Print iteration sets
    println("\nIteration Sets:")
    for (i, iteration_set) in enumerate(iteration_sets)
        println("  Iteration $i: $(collect(iteration_set))")
    end
    
    # Print ancestors and descendants
    println("\nAncestors:")
    for (node, ancestor_set) in ancestors
        println("  Node $node -> Ancestors: $(collect(ancestor_set))")
    end
    
    println("\nDescendants:")
    for (node, descendant_set) in descendants
        println("  Node $node -> Descendants: $(collect(descendant_set))")
    end
    
    # Print common ancestors dictionary with DiamondStructure details
    pretty_print_diamonds(diamond_structures)
end


#filepath = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv"
#filepath = "csvfiles/Shelby county gas.csv"
#filepath = "csvfiles/16 NodeNetwork Adjacency matrix.csv"
#filepath = "csvfiles/KarlNetwork.csv"
filepath = "csvfiles/metro_dag_with_probs.csv"


edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = InputProcessingModule.read_graph_to_dict(filepath)

fork_nodes, join_nodes = InputProcessingModule.identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = InputProcessingModule.find_iteration_sets(edgelist, outgoing_index, incoming_index);

diamond_structures = NetworkDecompositionModule.identify_and_group_diamonds(
    join_nodes,
    ancestors,
    incoming_index,
    source_nodes,
    fork_nodes,
    iteration_sets
)

#= print_graph_details(
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


output = ReachabilityModule.update_beliefs_iterative(
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
using OrderedCollections

sorted_output = OrderedDict(sort(output))
show(sorted_output)








function findSources(adj_matrix::Matrix{Int64})
    num_nodes = size(adj_matrix, 1)
    sources = Vector{Int64}()

    # Iterate over each node in the graph
    for i in 1:num_nodes
        incoming_edges = 0
        # Check if there are any incoming edges to node i
        for j in 1:num_nodes
            incoming_edges += adj_matrix[j, i]
        end

        # If there are no incoming edges to node i, add it to sources
        if incoming_edges == 0
            push!(sources, i)
        end
    end

    return sources
end #findSources function end

using  .InformationPropagation

link_probability = Dict{Tuple{Main.InformationPropagation.EdgePair, Distribution}, Float64}()


system_data = readdlm("csvfiles/metro_dag.csv", ',', header= false, Int)
original_system_matrix = Matrix(DataFrame(system_data, :auto))
original_system_graph = DiGraph(original_system_matrix)


# Create a dictionary to hold the probability values
link_probability = Dict{InformationPropagation.EdgePair, Distribution}()
Node_Priors = Dict{Int, Distribution}() #Assign an empty vector to Node_Priors

# Read system data and create the graph

system_data = readdlm("csvfiles/16_node_old.csv", ',', header= false, Int)



# Iterate through each edge in the graph and set probability
for e in edges(original_system_graph)
    link_probability[InformationPropagation.EdgePair(src(e), dst(e))] = Bernoulli(0.9)
    probability = link_probability[InformationPropagation.EdgePair(src(e), dst(e))]
end

for node in vertices(original_system_graph)
    Node_Priors[node] = Bernoulli(1.0)
end


mc = InformationPropagation.MC_result(original_system_graph,link_probability,Node_Priors,findSources(original_system_matrix),1000000)
md= Dict()
for i in eachindex(mc)
    md[i] = mc[i]
end
md
using OrderedCollections

mc_results = OrderedDict(sort(md))

# Create DataFrame
df = DataFrame(
    Node = collect(keys(mc_results)),
    AlgoResults = collect(values(sorted_output)),
    McResults = collect(values(mc_results))
)

# Calculate absolute and percentage differences
df.AbsDiff = abs.(df.AlgoResults .- df.McResults)
df.PercentageDiff = (df.AbsDiff ./ df.McResults) .* 100

# Sort by percentage difference (highest to lowest)
sort!(df, :PercentageDiff, rev=true)

# Format for better display
formatted_df = select(df,
    :Node,
    :AlgoResults => ByRow(x -> round(x, digits=4)) => :AlgoResults,
    :McResults => ByRow(x -> round(x, digits=4)) => :McResults,
    :AbsDiff => ByRow(x -> round(x, digits=6)) => :AbsDiff,
    :PercentageDiff => ByRow(x -> round(x, digits=2)) => :PercentageDiff
)


# Summary statistics
println("\nSummary Statistics:")
println("==================")
println("Mean absolute difference: ", round(mean(df.AbsDiff), digits=6))
println("Maximum absolute difference: ", round(maximum(df.AbsDiff), digits=6))
println("Mean percentage difference: ", round(mean(df.PercentageDiff), digits=2), "%")
println("Maximum percentage difference: ", round(maximum(df.PercentageDiff), digits=2), "%")

# Count entries with difference > 0.5%
high_diff = count(x -> x > 0.5, df.PercentageDiff)
println("\nNumber of entries with >0.5% difference: ", high_diff)
println("Percentage of total: ", round(high_diff/nrow(df) * 100, digits=2), "%")
# Display results
println("\nResults comparison (sorted by highest percentage difference):")
println("============")
show(formatted_df, allrows=true)
