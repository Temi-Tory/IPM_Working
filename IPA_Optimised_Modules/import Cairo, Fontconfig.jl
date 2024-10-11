import Cairo, Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

using Main.InputProcessingModule
using Main.D_SeparatednesModule

filepath = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv"

edgelist, outgoing_index, incoming_index, source_nodes, all_nodes = InputProcessingModule.read_graph_to_dict(filepath)

fork_nodes, join_nodes = InputProcessingModule.identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants, common_ancestors_dict = InputProcessingModule.find_iteration_sets(edgelist, outgoing_index, incoming_index, fork_nodes, join_nodes, source_nodes)

function find_minimal_conditioning_set(
    node::Int64, 
    incoming_index::Dict{Int64,Set{Int64}}, 
    outgoing_index::Dict{Int64,Set{Int64}},
    ancestors::Dict{Int64, Set{Int64}}, 
    all_nodes::Set{Int64}
    )
    parents = get(incoming_index, node, Set{Int64}())
    ancestor_set = get(ancestors, node, Set{Int64}())
    
    minimal_set = copy(parents)
    for ancestor in setdiff(ancestor_set, parents, Set([node]))
        if !D_SeparatednesModule.is_d_separator(
            all_nodes,
            outgoing_index,
            incoming_index,
            ancestors,
            Set([ancestor]),
            Set([node]),
            minimal_set
        )
            push!(minimal_set, ancestor)
        end
    end
    
    return minimal_set
end

# Compute minimal conditioning sets for all nodes
minimal_conditioning_sets = Dict{Int64, Set{Int64}}()
for node in all_nodes
    minimal_conditioning_sets[node] = find_minimal_conditioning_set(
        node, 
        incoming_index, 
        outgoing_index,
        ancestors, 
        all_nodes
    )
end

# Print the factorized joint distribution
for node in sort(collect(all_nodes))
    conditioning_set = setdiff(minimal_conditioning_sets[node], Set([node]))
    println("P(X$node | $conditioning_set)")
end