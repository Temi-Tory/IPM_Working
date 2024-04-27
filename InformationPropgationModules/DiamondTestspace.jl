import Cairo, Fontconfig
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions

function find_diamond_paths_iterative(sources::Vector{Int64}, join::Int64, adj_matrix::Matrix{Int64}, ancestors::Set{Int64})::Tuple{Vector{Vector{Tuple{Int64, Int64}}}, Set{Tuple{Int64, Int64}}}
    # Validate inputs
    if join < 1 || join > size(adj_matrix, 1) || any(source -> source < 1 || source > size(adj_matrix, 1), sources)
        error("Sources or join node out of bounds.")
    end

    # Initialize data structures to hold the paths and edges
    all_edge_paths = Vector{Vector{Tuple{Int, Int}}}()
    all_unique_edges = Set{Tuple{Int, Int}}()
    
    # Helper function to recursively find all diamond paths
    function recurse_find_diamonds(current::Int64, path::Vector{Tuple{Int, Int}})
        if current == join
            push!(all_edge_paths, path)
            return
        end
        next_nodes = findall(adj_matrix[current, :] .== 1)
        for next_node in next_nodes
            edge = (current, next_node)
            if edge ∉ path
                new_path = [path; edge]
                push!(all_unique_edges, edge)
                recurse_find_diamonds(next_node, new_path)
            end
        end
    end
    
    # Start the recursive search from each source
    for source in sources
        recurse_find_diamonds(source, [])
    end

    # Return the full set of paths and edges
    return (all_edge_paths, all_unique_edges)
end

# Example usage
sources = [1, 7, 18]  # Starting nodes for diamond path search
system_data = readdlm("csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv", ',', header= false, Int)
original_system_matrix = Matrix(DataFrame(system_data, :auto))
ancestors_of23 = Set([5, 16, 20, 12, 8, 17, 1, 19, 22, 6, 11, 9, 14, 3, 7, 13, 4, 21, 2, 10, 15, 18])  # Ancestors of the join node

diamond_paths, combined_edges = find_diamond_paths_iterative(sources, 23, original_system_matrix, ancestors_of23)
println("Diamond Paths: ", diamond_paths)
println("Combined Edges: ", combined_edges)
