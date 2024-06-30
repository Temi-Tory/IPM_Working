import Cairo, Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays,BenchmarkTools

function identify_fork_and_join_nodes(graph::Dict{Int64, Vector{Int64}})::Tuple{Set{Int64}, Set{Int64}}
    fork_nodes = Set{Int64}()
    join_nodes = Set{Int64}()
    incoming_edges = Dict{Int64, Set{Int64}}()

    # Single pass: Identify fork nodes and build incoming edges
    for (node, children) in graph
        if length(children) > 1
            push!(fork_nodes, node)
        end
        for child in children
            push!(get!(()->Set{Int64}(), incoming_edges, child), node)
        end
    end

    # Identify join nodes
    for (node, parents) in incoming_edges
        if length(parents) > 1
            push!(join_nodes, node)
        end
    end

    return fork_nodes, join_nodes
end

function find_iteration_sets(graph::Dict{Int64, Vector{Int64}})::Tuple{Vector{Set{Int64}}, Dict{Int64, Set{Int64}}}
    n = maximum(maximum(vcat(k, v)) for (k, v) in pairs(graph))
    in_degree = zeros(Int, n)
    ancestors = Dict(node => Set{Int64}([node]) for node in keys(graph))
    
    # Calculate initial in-degrees
    for (_, neighbors) in graph
        for neighbor in neighbors
            in_degree[neighbor] += 1
        end
    end
    
    queue = Queue{Int64}()
    for node in keys(graph)
        if in_degree[node] == 0
            enqueue!(queue, node)
        end
    end
    
    iteration_sets = Vector{Set{Int64}}()
    
    while !isempty(queue)
        current_set = Set{Int64}()
        
        # Process all nodes in the current level
        level_size = length(queue)
        for _ in 1:level_size
            node = dequeue!(queue)
            push!(current_set, node)
            
            # Process outgoing edges
            for target in get(graph, node, Int64[])
                # Update ancestors efficiently
                if !issubset(ancestors[node], ancestors[target])
                    union!(ancestors[target], ancestors[node])
                end
                
                in_degree[target] -= 1
                if in_degree[target] == 0
                    enqueue!(queue, target)
                end
            end
        end
        
        push!(iteration_sets, current_set)
    end
    
    return (iteration_sets, ancestors)
end

# Helper function to find source nodes
function find_source_nodes(graph_dict::Dict{Int64, Vector{Int64}})::Vector{Int64}
    nodes_with_incoming = Set{Int64}()
    for neighbors in values(graph_dict)
        union!(nodes_with_incoming, neighbors)
    end
    return sort([node for node in keys(graph_dict) if !(node in nodes_with_incoming)])
end

function read_graph_to_dict(filename::String)::Dict{Int64, Vector{Int64}}
    graph = Dict{Int64, Vector{Int64}}()
    open(filename, "r") do file
        for (i, line) in enumerate(eachline(file))
            neighbors = findall(x -> x != 0, parse.(Int, split(line, ',')))
            graph[i] = neighbors  # This will create an entry even if neighbors is empty
        end
    end
    return graph
end

# Usage


function runAlgo()
    graph = read_graph_to_dict("csvfiles/KarlNetwork.csv")
    fork_nodes, join_nodes = identify_fork_and_join_nodes(graph)
    iterationsets, ancestors = find_iteration_sets(graph)

    graph = read_graph_to_dict("csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv")
    fork_nodes, join_nodes = identify_fork_and_join_nodes(graph)
    iterationsets, ancestors = find_iteration_sets(graph)

    graph = read_graph_to_dict("csvfiles/16 NodeNetwork Adjacency matrix.csv")
    fork_nodes, join_nodes = identify_fork_and_join_nodes(graph)
    iterationsets, ancestors = find_iteration_sets(graph)

    graph = read_graph_to_dict("csvfiles/Shelby county gas.csv")
    fork_nodes, join_nodes = identify_fork_and_join_nodes(graph)
    iterationsets, ancestors = find_iteration_sets(graph)
end

 runAlgo() samples=10000000