import Fontconfig
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics


using Pkg
Pkg.activate("C:/Users/ohian/OneDrive - University of Strathclyde/Documents/Programmming Files/Julia Files/InformationPropagation/Info_Prop_Framework_Project")

# Import framework - corrected path
include("IPAFramework.jl")
using .IPAFramework

filepathcsv = "csvfiles/16 NodeNetwork Adjacency matrix.csv";
edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);



# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);


#DIAMOND VISAULIZTAION WITHD IFFGERNET DIRLL DOWNS



diamond_structures= identify_and_group_diamonds(
    join_nodes,
    incoming_index,
    ancestors,
    descendants,
    source_nodes,
    fork_nodes,
    edgelist,
    node_priors
);

for key in keys(diamond_structures)
    println("---------------------------------------------------")
        println("--------------------diamond_structures-------------------------------")
    println("---------------------------------------------------")
    j_node = diamond_structures[key].join_node
    println("Join node = $j_node")

    non_diamond_parents = diamond_structures[key].non_diamond_parents
    println("non_diamond_parents = $non_diamond_parents")

    
    diamond_edglist = diamond_structures[key].diamond.edgelist
    println("diamond_edglist = $diamond_edglist")

    diamond_relevant_nodes = diamond_structures[key].diamond.relevant_nodes
    println("diamond_relevant_nodes = $diamond_relevant_nodes")

    diamond_highest_nodes = diamond_structures[key].diamond.highest_nodes
    println("diamond_highest_nodes = $diamond_highest_nodes")

    println("---------------------------------------------------")
end

# RECURSIVE DIAMOND SIMULATION
include("simulate_recursive_diamonds.jl")

# Run the recursive simulation on all maximal diamonds
recursive_results = add_recursive_simulation_to_diamond_test(
    diamond_structures,
    edge_probabilities,
    node_priors
)

println("\n" * "="^100)
println("SUMMARY OF RECURSIVE DIAMOND ANALYSIS")
println("="^100)

for (maximal_join_node, results) in recursive_results
    println("\nMAXIMAL DIAMOND AT JOIN NODE $maximal_join_node:")
    for result in results
        level = result["level"]
        level_name = result["level_name"]
        inner_count = length(result["inner_diamonds"])
        println("  Level $level ($level_name): Found $inner_count inner diamond(s)")
        
        if inner_count > 0
            for inner in result["inner_diamonds"]
                println("    └─ Inner diamond at join $(inner["inner_join_node"]) with highest nodes $(inner["inner_diamond_highest_nodes"])")
            end
        end
    end
end
