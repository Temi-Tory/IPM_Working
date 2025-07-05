#= import Fontconfig
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics


using Pkg
Pkg.activate("C:/Users/ohian/OneDrive - University of Strathclyde/Documents/Programmming Files/Julia Files/InformationPropagation/Info_Prop_Framework_Project")

# Import framework - corrected path
include("IPAFramework.jl")
using .IPAFramework




fork_nodes = 
    Set([5, 13, 7, 11, 10, 8, 3, 1]);

join_nodes = 
    Set([4, 16, 6, 11, 7, 15, 9, 12, 2, 14]);

edgelist = 
    [(1, 2), (1, 5), (2, 6), (3, 2), (3, 4), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 4), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), 
    (13, 9), (13, 14), (14, 15), (15, 16)];

outgoing_index = 
    Dict{Int64, Set{Int64}}(5 => Set([6, 9]), 12 => Set([16]), 8 => Set([4, 12]), 1 => Set([5, 2]), 6 => Set([7]), 11 => Set([15, 12]), 9 => Set([10]), 14 => Set([15]), 3 => Set([4, 7, 2]), 7 => Set([11, 8]), 13 => Set([9, 14]), 15 => Set([16]), 2 => Set([6]), 10 => Set([6, 11, 14]));

incoming_index = 
    Dict{Int64, Set{Int64}}(5 => Set([1]), 16 => Set([15, 12]), 12 => Set([11, 8]), 8 => Set([7]), 1 => Set(), 6 => Set([5, 2, 10]), 11 => Set([7, 10]), 9 => Set([5, 13]), 14 => Set([13, 10]), 3 => Set(), 7 => Set([6, 3]), 4 => Set([8, 3]), 15 => Set([11, 14]), 13 => Set(), 2 => Set([3, 1]), 10 => Set([9]));

source_nodes =
     Set([1, 3, 13]);

iteration_sets = 
    Set{Int64}[Set([13, 3, 1]), Set([5, 2]), Set([9]), Set([10]), Set([6, 14]), Set([7]), Set([11, 8]), Set([4, 15, 12]), Set([16])];

ancestors = 
    Dict{Int64, Set{Int64}}(5 => Set([5, 1]), 16 => Set([5, 16, 12, 8, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), 7 => Set([5, 13, 6, 7, 2, 10, 9, 3, 1]), 12 => Set([5, 7, 12, 8, 1, 13, 6, 11, 10, 2, 9, 3]), 8 => Set([5, 13, 6, 7, 2, 10, 9, 8, 3, 1]), 1 => Set([1]), 4 => Set([5, 7, 8, 1, 4, 13, 6, 2, 10, 9, 3]), 6 => Set([5, 13, 6, 2, 10, 9, 3, 1]), 15 => Set([5, 
        7, 1, 13, 15, 6, 11, 10, 2, 9, 14, 3]), 11 => Set([5, 7, 1, 13, 6, 11, 10, 2, 9, 3]), 13 => Set([13]), 2 => Set([2, 3, 1]), 9 => Set([5, 13, 9, 1]), 10 => Set([5, 13, 10, 9, 1]), 14 => 
        Set([5, 13, 10, 9, 14, 1]), 3 => Set([3]));

descendants = 
    Dict{Int64, Set{Int64}}(5 => Set([16, 12, 8, 6, 11, 9, 14, 7, 4, 15, 10]), 16 => Set(), 7 => Set([4, 15, 16, 11, 12, 8]), 12 => Set([16]), 8 => Set([4, 16, 12]), 1 => Set([5, 16, 12, 8, 6, 11, 9, 14, 7, 4, 15, 2, 10]), 4 => Set(), 6 => Set([4, 15, 7, 11, 16, 12, 8]), 15 => Set([16]), 11 => Set([15, 16, 12]), 13 => Set([16, 12, 8, 6, 11, 9, 14, 7, 4, 15, 10]), 2 => Set([4, 6, 7, 11, 15, 16, 12, 8]), 9 => Set([4, 6, 7, 11, 10, 15, 16, 12, 14, 8]), 10 => Set([4, 6, 7, 11, 15, 16, 12, 14, 8]), 14 => Set([15, 16]), 3 => Set([4, 6, 7, 2, 11, 
         15, 16, 12, 8]));

edge_probabilities = 
    Dict((1, 2) => 0.9, (8, 12) => 0.9, (3, 7) => 0.9, (8, 4) => 0.9, (9, 10) => 0.9, (10, 11) => 0.9, (5, 9) => 0.9, (11, 12) => 0.9, (2, 6) => 0.9, (10, 6) => 0.9, (11, 15) => 0.9, (3, 2) => 0.9, (7, 8) => 0.9, (12, 16) => 0.9, (14, 15) => 0.9, (3, 4) => 0.9, (5, 6) => 0.9, (1, 5) => 0.9, (13, 14) => 0.9, (10, 14) => 0.9, (7, 11) => 0.9, (6, 7) => 0.9, (13, 9) => 0.9, (15, 16) => 0.9);

node_priors = 
    Dict(5 => 0.9, 16 => 0.9, 12 => 0.9, 8 => 0.9, 1 => 0.9, 6 => 0.9, 11 => 0.9, 9 => 0.9, 14 => 0.9, 3 => 0.9, 7 => 0.9, 4 => 0.9, 13 => 0.9, 15 => 0.9, 2 => 0.9, 10 => 0.9) ;


    diamond_structures= identify_and_group_diamonds(
    join_nodes,
    incoming_index,
    ancestors,
    descendants,
    source_nodes,
    fork_nodes,
    edgelist,
    #iteration_sets,
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
#= 
---------------------------------------------------
--------------------diamond_structures-------------------------------
---------------------------------------------------
Join node = 4
non_diamond_parents = Set{Int64}()
diamond_edglist = [(1, 2), (2, 6), (3, 2), (3, 4), (3, 7), (5, 6), (6, 7), (7, 8), (8, 4), (10, 6), (1, 5), (5, 9), (9, 10), (13, 9)]
diamond_relevant_nodes = Set([5, 7, 8, 1, 4, 6, 13, 2, 10, 9, 3])
diamond_highest_nodes = Set([3, 1])
---------------------------------------------------
---------------------------------------------------
--------------------diamond_structures-------------------------------
---------------------------------------------------
Join node = 6
non_diamond_parents = Set{Int64}()
diamond_edglist = [(1, 2), (1, 5), (2, 6), (3, 2), (5, 6), (5, 9), (9, 10), (10, 6), (13, 9)]
diamond_relevant_nodes = Set([5, 13, 6, 2, 10, 9, 3, 1])
diamond_highest_nodes = Set([1])
---------------------------------------------------
---------------------------------------------------
--------------------diamond_structures-------------------------------
---------------------------------------------------
Join node = 7
non_diamond_parents = Set{Int64}()
diamond_edglist = [(1, 2), (2, 6), (3, 2), (3, 7), (5, 6), (6, 7), (10, 6), (1, 5), (5, 9), (9, 10), (13, 9)]
diamond_relevant_nodes = Set([5, 7, 1, 13, 6, 2, 10, 9, 3])
diamond_highest_nodes = Set([3, 1])
---------------------------------------------------
---------------------------------------------------
--------------------diamond_structures-------------------------------
---------------------------------------------------
Join node = 11
non_diamond_parents = Set{Int64}()
diamond_edglist = [(1, 2), (1, 5), (2, 6), (3, 2), (3, 7), (5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (13, 9)]
diamond_relevant_nodes = Set([5, 7, 1, 13, 6, 11, 10, 2, 9, 3])
diamond_highest_nodes = Set([1])
---------------------------------------------------
---------------------------------------------------
--------------------diamond_structures-------------------------------
---------------------------------------------------
Join node = 16
non_diamond_parents = Set{Int64}()
diamond_edglist = [(2, 6), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (13, 
9), (13, 14), (14, 15), (15, 16), (3, 2), (1, 2), (1, 5)]
diamond_relevant_nodes = Set([5, 16, 12, 8, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10])
diamond_highest_nodes = Set([13, 3, 1])
---------------------------------------------------
---------------------------------------------------
--------------------diamond_structures-------------------------------
---------------------------------------------------
Join node = 15
non_diamond_parents = Set{Int64}()
diamond_edglist = [(2, 6), (3, 7), (5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (13, 9), (13, 14), (14, 15), (3, 2), (1, 2), (1, 5)]
diamond_relevant_nodes = Set([5, 7, 1, 13, 15, 6, 11, 10, 2, 9, 14, 3])
diamond_highest_nodes = Set([13, 3, 1])
---------------------------------------------------
---------------------------------------------------
--------------------diamond_structures-------------------------------
---------------------------------------------------
Join node = 12
non_diamond_parents = Set{Int64}()
diamond_edglist = [(2, 6), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9), (3, 2), (1, 2), (1, 5)]   
diamond_relevant_nodes = Set([5, 7, 12, 8, 1, 13, 6, 11, 10, 2, 9, 3])
diamond_highest_nodes = Set([13, 3, 1])
---------------------------------------------------
---------------------------------------------------
--------------------diamond_structures-------------------------------
---------------------------------------------------
Join node = 14
non_diamond_parents = Set{Int64}()
diamond_edglist = [(5, 9), (9, 10), (10, 14), (13, 9), (13, 14)]
diamond_relevant_nodes = Set([5, 13, 10, 9, 14])
diamond_highest_nodes = Set([13])
---------------------------------------------------
 =# =#