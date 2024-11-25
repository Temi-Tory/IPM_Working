import  Fontconfig 
using   Graphs, ChordalGraph, MetaGraphsNext, NetworkLayout,  DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

using Main.InputProcessingModule

using  Main.NetworkDecompositionModule

function print_common_ancestors_dict(common_ancestors_dict)
    println("Common Ancestors Dictionary:")
    for (key, diamond_structure) in common_ancestors_dict
        println("Node $key:")
        println("  Common Ancestors: $(diamond_structure.common_ancestors)")
        
        println("  Ancestor to Parents Mapping:")
        for (ancestor, parents_set) in diamond_structure.ancestor_to_parents
            println("    Ancestor: $ancestor -> Influencing Parents: $(collect(parents_set))")
        end
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
    common_ancestors_dict
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
    print_common_ancestors_dict(common_ancestors_dict)
end


filepath = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv"
#filepath = "csvfiles/Shelby county gas.csv"
#filepath = "csvfiles/16 NodeNetwork Adjacency matrix.csv"
#filepath = "csvfiles/KarlNetwork.csv"

edgelist, outgoing_index, incoming_index, source_nodes = InputProcessingModule.read_graph_to_dict(filepath)

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
pretty_print_diamonds(diamond_structures)