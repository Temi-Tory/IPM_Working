import Cairo, Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays

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

# New function for memory-efficient processing of large graphs
function memory_efficient_process(graph::Dict{Int64, Vector{Int64}})
    n = maximum(keys(graph))
    ancestors = [sparsevec([i], [true], n) for i in 1:n]
    
    # Topological sort
    in_degree = zeros(Int, n)
    for neighbors in values(graph)
        for neighbor in neighbors
            in_degree[neighbor] += 1
        end
    end
    
    queue = Queue{Int}()
    for node in keys(graph)
        if in_degree[node] == 0
            enqueue!(queue, node)
        end
    end
    
    while !isempty(queue)
        node = dequeue!(queue)
        for neighbor in get(graph, node, Int64[])
            ancestors[neighbor] .|= ancestors[node]
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0
                enqueue!(queue, neighbor)
            end
        end
    end
    
    return Dict(i => Set(findall(ancestors[i])) for i in 1:n)
end

# New function for parallel processing of very large graphs
function parallel_process_graph(graph::Dict{Int64, Vector{Int64}}, num_workers::Int=4)
    if nworkers() < num_workers
        addprocs(num_workers - nworkers())
    end
    
    @everywhere function process_node(node::Int64, graph::Dict{Int64, Vector{Int64}}, ancestors::Dict{Int64, Set{Int64}})
        node_ancestors = Set{Int64}([node])
        for neighbor in get(graph, node, Int64[])
            union!(node_ancestors, ancestors[neighbor])
        end
        return Dict(node => node_ancestors)
    end
    
    # Topological sort
    in_degree = Dict(node => 0 for node in keys(graph))
    for (_, neighbors) in graph
        for neighbor in neighbors
            in_degree[neighbor] = get(in_degree, neighbor, 0) + 1
        end
    end
    
    queue = Queue{Int64}()
    for (node, degree) in in_degree
        if degree == 0
            enqueue!(queue, node)
        end
    end
    
    sorted_nodes = Int64[]
    while !isempty(queue)
        node = dequeue!(queue)
        push!(sorted_nodes, node)
        for neighbor in get(graph, node, Int64[])
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0
                enqueue!(queue, neighbor)
            end
        end
    end
    
    # Initialize ancestors
    ancestors = Dict(node => Set([node]) for node in keys(graph))
    
    # Propagate ancestors
    for node in reverse(sorted_nodes)
        new_ancestors = Set{Int64}([node])
        for child in get(graph, node, Int64[])
            union!(new_ancestors, ancestors[child])
        end
        ancestors[node] = new_ancestors
    end
    
    # Parallel final pass to ensure consistency
    graph_keys = collect(keys(graph))  # Convert keys to a vector
    final_ancestors = @distributed (merge) for node in graph_keys
        process_node(node, graph, ancestors)
    end
    
    return final_ancestors
end

# Adaptive processing function
function adaptive_process_graph(graph::Dict{Int64, Vector{Int64}})
    if length(graph) > 1_000_000  # Very large graphs
        println("Using parallel processing for very large graph")
        return parallel_process_graph(graph)
    elseif length(graph) > 5_000  # Large graphs
        println("Using memory-efficient processing for large graph")
        return memory_efficient_process(graph)
    else  # Small to medium graphs
        println("Using standard processing for small to medium graph")
        return process_graph_topological_order(graph)
    end
end

# Main execution function
function run_graph_analysis(filename::String)
    println("Reading graph...")
    @time begin
        system_graph = read_graph_to_dict(filename)
    end
    println("Graph read. Nodes: ", length(system_graph))

    println("Finding source nodes...")
    @time begin
        source_nodes = find_source_nodes(system_graph)
    end
    println("Source nodes found: ", length(source_nodes))

    println("Processing graph...")
    @time begin
        ancestors = adaptive_process_graph(system_graph)
    end
    println("Graph processed. Ancestor sets: ", length(ancestors))

    return ancestors, source_nodes, system_graph
end

ancestors, source_nodes, system_graph = run_graph_analysis("csvfiles/16 NodeNetwork Adjacency matrix.csv");

#= println("Ancestors: ", ancestors)
println("source_nodes: ", source_nodes)
println("system_graph: ", system_graph) =#
ancestors