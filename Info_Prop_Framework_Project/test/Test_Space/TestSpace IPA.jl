import Fontconfig 
using DataFrames, DelimitedFiles, Distributions, 
      DataStructures, SparseArrays, BenchmarkTools, 
      Combinatorics


# Import framework
using .IPAFramework



"""
    pretty_print_diamonds(diamond_structures::Dict{Int64, IPAFramework.GroupedDiamondStructure})
    Prints diamond structures in a readable format.
"""
function pretty_print_diamonds(diamond_structures::Dict{Int64, GroupedDiamondStructure})
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
function pretty_print_diamond(structure::GroupedDiamondStructure)
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
#filepath = "csvfiles/metro_undirected_ImprovedDAG_HighProb.csv"
filepathcsv = "Info_Prop_Framework_Project/test/GeneratedDatasets/Datasets/Generated_DAG_Vert52xEdge123.csv"
filepathjson = "Info_Prop_Framework_Project/test/GeneratedDatasets/Datasets/Generated_DAG_Vert52xEdge123_high_prob.json"


# Read and process the graph
edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = 
    read_graph_to_dict(filepathcsv, filepathjson)

# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

# Analyze diamond structures
diamond_structures = identify_and_group_diamonds(
    join_nodes,
    ancestors,
    incoming_index,
    source_nodes,
    fork_nodes,
    iteration_sets,
    edgelist,
    descendants
)
#pretty_print_diamonds(diamond_structures)
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
using OrderedCollections
# Sort by key
sorted_output = OrderedDict(sort(collect(output)))

mc_results = MC_result(
    edgelist,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    600000
)

sorted_mc = OrderedDict(sort(collect(mc_results)))

# To display it more nicely:
using DataFrames

df = DataFrame(
    Node = collect(keys(sorted_output)),
    AlgoResults = collect(values(sorted_output)),
    McResults = collect(values(sorted_mc))
)

# Add difference calculations
df.AbsDiff = abs.(df.AlgoResults .- df.McResults)
df.PercentageDiff = (df.AbsDiff ./ df.McResults) .* 100

# Format numbers for better display
formatted_df = select(df,
    :Node,
    :AlgoResults,
    :McResults,
    :AbsDiff,
    :PercentageDiff
)
show(sort(formatted_df, :PercentageDiff, by=abs, rev=true), allrows=true) 
using CSV
CSV.write("formatted_df_metro.csv", sort(formatted_df, :PercentageDiff, by=abs, rev=true))
#incoming_index[170]
#diamond_structures[170]

#sorted_output[170]
#= 
using  CSV
# Read existing CSV
df = CSV.read("formatted_df_metro.csv", DataFrame)

# Update only AlgoResults column
df.AlgoResults = [sorted_output[node] for node in df.Node]

# Recalculate differences (keeping original McResults)
df.AbsDiff = abs.(df.AlgoResults .- df.McResults)
df.PercentageDiff = (df.AbsDiff ./ df.McResults) .* 100

# Format numbers for updated columns only
formatted_df = select(df,
    :Node,
    :AlgoResults => ByRow(x -> round(x, digits=4)) => :AlgoResults,
    :McResults => ByRow(x -> round(x, digits=4)) => :McResults,
    :AbsDiff => ByRow(x -> round(x, digits=6)) => :AbsDiff,
    :PercentageDiff => ByRow(x -> round(x, digits=2)) => :PercentageDiff
)

# Sort and write back
CSV.write("formatted_df_metro.csv", sort(formatted_df, :PercentageDiff, by=abs, rev=true)) =#