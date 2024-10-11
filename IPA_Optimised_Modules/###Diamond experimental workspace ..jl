###Diamond experimental workspace .. not fully ready te .. active work in profgress 

import Cairo, Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

using Main.InputProcessingModule

edgelist, outgoing_index, incoming_index, source_nodes = InputProcessingModule.read_graph_to_dict("csvfiles/KarlNetwork.csv")
#edgelist, outgoing_index, incoming_index, source_nodes = InputProcessingModule.read_graph_to_dict("csvfiles/Shelby county gas.csv")

#edgelist, outgoing_index, incoming_index, source_nodes = InputProcessingModule.read_graph_to_dict("csvfiles/16 NodeNetwork Adjacency matrix.csv")
#edgelist, outgoing_index, incoming_index, source_nodes = InputProcessingModule.read_graph_to_dict("csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv")

fork_nodes, join_nodes = InputProcessingModule.identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants, common_ancestors_dict = InputProcessingModule.find_iteration_sets(edgelist, outgoing_index, incoming_index, fork_nodes, join_nodes, source_nodes);
common_ancestors_dict   