import Cairo, Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures

function process_graph_topological_order(graph::Dict{T, Vector{T}}) where T
    # 1. Initialize data structures
    reduced_graph = deepcopy(graph)
    update_graph = Dict(node => T[] for node in keys(graph))
    ancestors = Dict(node => Set{T}() for node in keys(graph))
    
    # 2. Find initial source nodes using the find_source_nodes function
    source_nodes = Set(find_source_nodes(graph))

    # 3. Main processing loop
    while !isempty(source_nodes)
        new_source_nodes = Set{T}()

        for node in source_nodes
            # Add node to its own ancestor list
            push!(ancestors[node], node)

            # Process outgoing edges
            for neighbor in get(graph, node, T[])
                push!(update_graph[node], neighbor)
                filter!(x -> x != neighbor, reduced_graph[neighbor])
                if isempty(reduced_graph[neighbor])
                    push!(new_source_nodes, neighbor)
                end
            end

            # Remove node from reduced graph
            delete!(reduced_graph, node)
        end

        # Update ancestor lists for new source nodes
        for new_node in new_source_nodes
            for parent in keys(update_graph)
                if new_node in update_graph[parent]
                    union!(ancestors[new_node], ancestors[parent], Set([parent]))
                end
            end
        end

        # Replace current source nodes with new ones
        source_nodes = new_source_nodes
    end

    # 4. Verification and cleanup
    @assert isempty(reduced_graph) "Reduced graph should be empty"
    @assert all(graph[node] == update_graph[node] for node in keys(graph)) "Update graph should match original graph"
    @assert all(haskey(ancestors, node) for node in keys(graph)) "All nodes should have ancestors"

    return ancestors
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

function find_source_nodes(graph_dict::Dict{Int64, Vector{Int64}})::Vector{Int64}
    nodes_with_incoming = Set{Int64}()
    for neighbors in values(graph_dict)
        union!(nodes_with_incoming, neighbors)
    end
    return sort([node for node in keys(graph_dict) if !(node in nodes_with_incoming)])
end

# Main execution
println("Reading graph...")
@time begin
    system_graph = read_graph_to_dict("csvfiles/16 NodeNetwork Adjacency matrix.csv")
end
println("Graph read. Nodes: ", length(system_graph))

println("Finding source nodes...")
@time begin
    source_nodes = find_source_nodes(system_graph)
end
println("Source nodes found: ", length(source_nodes))

println("Processing graph...")
@time begin
    ancestors = process_graph_topological_order(system_graph)
end
ancestors