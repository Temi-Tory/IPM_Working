function dot_to_adj(dot_string::String; edge_weight=0.9)
    # Extract edges from the DOT format
    edges = []
    
    # Determine if the graph is directed
    is_directed = occursin("digraph", dot_string)
    edge_symbol = is_directed ? "->" : "--"
    
    # Extract all edges using regex
    edge_pattern = r"(\d+)\s*" * edge_symbol * r"\s*(\d+)"
    edge_matches = eachmatch(edge_pattern, dot_string)
    
    for match in edge_matches
        src = parse(Int, match[1])
        dst = parse(Int, match[2])
        push!(edges, (src=src, dst=dst))
    end
    
    # Find all unique nodes
    nodes = Set{Int}()
    for edge in edges
        push!(nodes, edge.src)
        push!(nodes, edge.dst)
    end
    
    # Create a mapping from node IDs to matrix indices
    sorted_nodes = sort(collect(nodes))
    node_to_index = Dict(node => i for (i, node) in enumerate(sorted_nodes))
    index_to_node = Dict(i => node for (node, i) in node_to_index)
    
    # Create the adjacency matrix with special format:
    # - First column all 1s (node priors)
    # - Edge connections use edge_weight (default 0.9) instead of 1
    n = length(nodes)
    adj_matrix = zeros(Float64, n, n+1)  # +1 for the prior column
    
    # Set first column to all 1s (node priors)
    adj_matrix[:, 1] .= 1
    
    # Fill the adjacency matrix with edge weights
    for edge in edges
        src_idx = node_to_index[edge.src]
        dst_idx = node_to_index[edge.dst]
        adj_matrix[src_idx, dst_idx+1] = edge_weight  # +1 because the first column is for priors
    end
    
    # For undirected graphs, make sure the matrix is symmetric
    if !is_directed
        for i in 1:n
            for j in 2:n+1  # Start from column 2 (skip priors column)
                if adj_matrix[i, j] == edge_weight
                    adj_matrix[j-1, i+1] = edge_weight
                end
            end
        end
    end
    
    # Validate that it's a DAG if directed
    if is_directed
        # Create a temp matrix without the priors column for DAG checking
        temp_matrix = zeros(Int, n, n)
        for i in 1:n
            for j in 1:n
                temp_matrix[i, j] = adj_matrix[i, j+1] > 0 ? 1 : 0
            end
        end
        
        if !is_dag(temp_matrix)
            @warn "The graph contains cycles and may not be a proper DAG."
        end
    end
    
    return adj_matrix, index_to_node
end

# Helper function to check if a directed graph is a DAG
function is_dag(adj_matrix::Matrix{Int})
    n = size(adj_matrix, 1)
    visited = zeros(Int, n)  # 0: not visited, 1: in current path, 2: fully processed
    
    function has_cycle(node)
        if visited[node] == 1
            return true  # Back edge found, cycle detected
        end
        if visited[node] == 2
            return false  # Already processed, no cycle
        end
        
        visited[node] = 1  # Mark as in current path
        
        for neighbor in 1:n
            if adj_matrix[node, neighbor] == 1
                if has_cycle(neighbor)
                    return true
                end
            end
        end
        
        visited[node] = 2  # Mark as fully processed
        return false
    end
    
    for i in 1:n
        if visited[i] == 0
            if has_cycle(i)
                return false
            end
        end
    end
    
    return true
end
#= 
Example usage: =#
dot_string = """
digraph G {
  2 [style=filled, fillcolor=grey];
  30 [style=filled, fillcolor=pink];
  2 -> 3;
  2 -> 12;
  3 -> 4;
  3 -> 23;
  4 -> 15;
  9 -> 29;
  12 -> 16;
  15 -> 25;
  16 -> 9;
  16 -> 17;
  16 -> 18;
   17 -> 25;
  18 -> 17;
   23 -> 18;
  25 -> 30;
  29 -> 30;
}
"""
adj_matrix, node_map = dot_to_adj(dot_string)


# Output the adjacency matrix in a CSV format
function print_adj_matrix_csv(adj_matrix)
    n, m = size(adj_matrix)
    for i in 1:n
        println(join([adj_matrix[i,j] for j in 1:m], ","))
    end
end

print_adj_matrix_csv(adj_matrix)