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


filepathcsv = "csvfiles/16 NodeNetwork Adjacency matrix.csv";


edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities =  read_graph_to_dict(filepathcsv);

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
);
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

output =  (update_beliefs_iterative(
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
 )) 


using OrderedCollections
mc_results = (MC_result(
    edgelist,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    1000000
))


# Sort outputs
sorted_algo = OrderedDict(sort(collect(output)))
sorted_mc = OrderedDict(sort(collect(mc_results)))
#= 
# Create base DataFrame
df = DataFrame(
  Node = collect(keys(sorted_algo)),
  AlgoLower = map(x -> x.lower, values(sorted_algo)),
  AlgoUpper = map(x -> x.upper, values(sorted_algo)), 
  MCLower = map(x -> x.lower, values(sorted_mc)),
  MCUpper = map(x -> x.upper, values(sorted_mc))
)

# Add difference columns
df.LowerDiff = abs.(df.AlgoLower .- df.MCLower)
df.UpperDiff = abs.(df.AlgoUpper .- df.MCUpper) 
df.MaxDiff = max.(df.LowerDiff, df.UpperDiff)

# Display sorted result
show(sort(df, :MaxDiff, rev=true), allrows=true) =#

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
#=  =#