import Cairo, Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics


using .InputProcessingModule
function post_process_diamond(
    join_node::Int64,
    common_ancestors::Set{Int64},
    decomposed_edgelist::Vector{Tuple{Int64,Int64}},
    original_ancestors::Dict{Int64, Set{Int64}},
    original_descendants::Dict{Int64, Set{Int64}}
    )
    # Create subgraph structures
    subgraph_nodes = Set(union(first.(decomposed_edgelist), last.(decomposed_edgelist)))
    subgraph_outgoing = Dict(n => Int64[] for n in subgraph_nodes)
    subgraph_incoming = Dict(n => Int64[] for n in subgraph_nodes)
    
    for (src, dst) in decomposed_edgelist
        push!(subgraph_outgoing[src], dst)
        push!(subgraph_incoming[dst], src)
    end
    
    subgraph_forks, subgraph_joins = InputProcessingModule.identify_fork_and_join_nodes(subgraph_outgoing, subgraph_incoming)
    
    diamond_hierarchy = Dict{Int, Set{Tuple{Set{Int64}, Set{Int64}}}}()
    
    queue = [(join_node, 1)]
    processed_joins = Set{Int64}()
    
    while !isempty(queue)
        current_join, current_level = popfirst!(queue)
        
        current_join in processed_joins && continue
        push!(processed_joins, current_join)
        
        parents = subgraph_incoming[current_join]
        if length(parents) > 1
            potential_common_ancestors = intersect([intersect(subgraph_forks, original_ancestors[p]) for p in parents]...)
            
            # Use path-based detection for all cases
            diamonds = path_based_diamond_detection(potential_common_ancestors, current_join, subgraph_outgoing, original_descendants)
            
            if !haskey(diamond_hierarchy, current_level)
                diamond_hierarchy[current_level] = Set{Tuple{Set{Int64}, Set{Int64}}}()
            end
            union!(diamond_hierarchy[current_level], diamonds)
            
            for (diamond_nodes, _) in diamonds
                for nested_join in intersect(subgraph_joins, diamond_nodes)
                    if nested_join != current_join && !(nested_join in processed_joins)
                        push!(queue, (nested_join, current_level + 1))
                    end
                end
            end
        end
    end
    
    prioritized_diamonds = [(d, ca) for level in sort(collect(keys(diamond_hierarchy)), rev=true) for (d, ca) in diamond_hierarchy[level]]
    
    return prioritized_diamonds, diamond_hierarchy
end

function path_based_diamond_detection(potential_common_ancestors::Set{Int64}, current_join::Int64, subgraph_outgoing::Dict{Int64, Vector{Int64}}, original_descendants::Dict{Int64, Set{Int64}})
    diamonds = Set{Tuple{Set{Int64}, Set{Int64}}}()
    for fork in potential_common_ancestors
        paths = find_all_paths(fork, current_join, subgraph_outgoing, original_descendants)
        if length(paths) > 1
            diamond_nodes = union([Set(path) for path in paths]...)
            push!(diamonds, (diamond_nodes, Set([fork])))
        end
    end
    return diamonds
end

function find_all_paths(start::Int64, goal::Int64, subgraph_outgoing::Dict{Int64, Vector{Int64}}, original_descendants::Dict{Int64, Set{Int64}})
    if goal ∉ original_descendants[start]
        return Vector{Vector{Int64}}()
    end

    paths = Vector{Vector{Int64}}()
    stack = [(start, Set{Int64}([start]))]
    
    while !isempty(stack)
        (node, path_set) = pop!(stack)
        
        for next in subgraph_outgoing[node]
            if next == goal
                push!(paths, collect(union(path_set, [next])))
            elseif next ∉ path_set && goal in original_descendants[next]
                push!(stack, (next, union(path_set, [next])))
            end
        end
    end
    
    return paths
end

function decompose_edgelist(
    join_node::Int64,
    common_ancestors::Set{Int64},
    edgelist::Vector{Tuple{Int64,Int64}},
    ancestors::Dict{Int64,Set{Int64}},
    descendants::Dict{Int64,Set{Int64}}
    )::Vector{Tuple{Int64,Int64}}
    fork_descendants = union([descendants[fork] for fork in common_ancestors]...)
    join_ancestors = ancestors[join_node]
    valid_destinations = union(Set{Int64}([join_node]), intersect(fork_descendants, join_ancestors))
    return filter(edge -> last(edge) in valid_destinations, edgelist)
end


#edgelist, outgoing_index, incoming_index, source_nodes = InputProcessingModule.read_graph_to_dict("csvfiles/KarlNetwork.csv")
edgelist, outgoing_index, incoming_index, source_nodes = InputProcessingModule.read_graph_to_dict("csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv")

fork_nodes, join_nodes = InputProcessingModule.identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants, common_ancestors_dict = InputProcessingModule.find_iteration_sets(edgelist, outgoing_index, incoming_index, fork_nodes, join_nodes, source_nodes)

println("Decomposed graph versions for each join node with common ancestors:")
all_prioritized_diamonds = Dict{Int64, Vector{Tuple{Set{Int64}, Set{Int64}}}}()
all_diamond_hierarchies = Dict{Int64, Dict{Int, Set{Tuple{Set{Int64}, Set{Int64}}}}}()

for (join_node, common_ancestors) in common_ancestors_dict
    println("\nJoin Node: ", join_node)
    decomposed_edges = decompose_edgelist(join_node, common_ancestors, edgelist, ancestors, descendants)
    println("Decomposed Edgelist:")
    for edge in decomposed_edges
        println("  ", edge)
    end
    
    prioritized_diamonds, diamond_hierarchy = post_process_diamond(
        join_node,
        common_ancestors,
        decomposed_edges,
        ancestors,
        descendants
    )
    
    all_prioritized_diamonds[join_node] = prioritized_diamonds
    all_diamond_hierarchies[join_node] = diamond_hierarchy
    
    println("Nested Diamonds:")
    for (level, diamonds) in diamond_hierarchy
        println("  Level $level:")
        for (diamond, diamond_common_ancestors) in diamonds
            println("    Diamond: ", diamond)
            println("    Common Ancestors: ", diamond_common_ancestors)
        end
    end
end

if isempty(common_ancestors_dict)
    println("No join nodes with common ancestors found.")
else
    println("\nSummary of all processed diamonds:")
    for (join_node, prioritized_diamonds) in all_prioritized_diamonds
        println("Join Node $join_node:")
        println("  Total nested diamonds: ", length(prioritized_diamonds))
        println("  Deepest nesting level: ", length(all_diamond_hierarchies[join_node]))
    end
end