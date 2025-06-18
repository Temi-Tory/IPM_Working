module  UndirectedToDagModule
using DataStructures

"""
    parse_adj_matrix(content::String)
    
    Parse the adjacency matrix and nodes from the input string.
    Returns the adjacency matrix A.
"""
function parse_adj_matrix(content::String)
    # Split the content by newlines to separate A matrix from nodes
    lines = split(content, '\n', keepempty=false)
    
    # Get matrix definition (everything except last line)
    matrix_str = join(lines[1:end-1], '\n')
    
    # Evaluate just the A matrix definition
    eval(Meta.parse(matrix_str))
    return A  # Returns the matrix that was defined
end


"""
    find_best_root(adj_matrix::Matrix{Float64})

    Find a good root node for the DAG conversion based on various metrics:
    1. Degree centrality (number of connections)
    2. Closeness to graph center (minimize maximum distance)
"""
function find_best_root(adj_matrix::Matrix{Float64})
    n = size(adj_matrix, 1)
    
    # Calculate degree for each node
    degrees = vec(sum(adj_matrix, dims=2))
    
    # Calculate eccentricity (maximum distance) for each node using BFS
    eccentricities = fill(Inf, n)
    
    for start in 1:n
        distances = fill(Inf, n)
        queue = Queue{Int}()
        
        # Start BFS from current node
        enqueue!(queue, start)
        distances[start] = 0
        
        while !isempty(queue)
            v = dequeue!(queue)
            for u in 1:n
                if adj_matrix[v, u] ≈ 1.0 && isinf(distances[u])
                    distances[u] = distances[v] + 1
                    enqueue!(queue, u)
                end
            end
        end
        
        # Update eccentricity (maximum finite distance)
        finite_distances = filter(isfinite, distances)
        if !isempty(finite_distances)
            eccentricities[start] = maximum(finite_distances)
        end
    end
    
    # Combine metrics to score each node
    scores = zeros(n)
    max_degree = maximum(degrees)
    max_ecc = maximum(filter(isfinite, eccentricities))
    
    for i in 1:n
        # Normalize and combine scores (higher is better)
        degree_score = degrees[i] / max_degree
        ecc_score = 1 - (eccentricities[i] / max_ecc)  # Lower eccentricity is better
        scores[i] = degree_score + ecc_score
    end
    
    # Return the node with highest score
    best_root = argmax(scores)
    
    println("Selected root node $best_root:")
    println("- Degree: $(Int(degrees[best_root]))")
    println("- Eccentricity: $(eccentricities[best_root])")
    println("- Overall score: $(round(scores[best_root], digits=3))")
    
    return best_root
end

"""
    undirected_to_dag(adj_matrix::Matrix{Float64}, root::Union{Int,Nothing}=nothing)

    Convert an undirected graph to a DAG.
    If no root is provided, automatically selects a good root node.

    Parameters:
    - adj_matrix: Symmetric adjacency matrix representing undirected graph
    - root: Optional root node. If not provided, will be automatically selected

    Returns:
    - Tuple of (dag_matrix, root_used)
"""
function undirected_to_dag(adj_matrix::Matrix{Float64}, root::Union{Int,Nothing}=nothing)
    n = size(adj_matrix, 1)
    
    # If no root provided, find the best one
    if isnothing(root)
        root = find_best_root(adj_matrix)
        println("\nUsing automatically selected root: $root")
    end
    
    # Initialize result matrix for DAG
    dag = zeros(Float64, n, n)
    
    # Get spanning tree using BFS
    parent = fill(-1, n)
    level = fill(-1, n)
    queue = Queue{Int}()
    
    # Initialize BFS from root
    enqueue!(queue, root)
    parent[root] = 0
    level[root] = 0
    
    # Build spanning tree and record levels
    while !isempty(queue)
        v = dequeue!(queue)
        for u in 1:n
            if adj_matrix[v, u] ≈ 1.0 && level[u] == -1
                enqueue!(queue, u)
                parent[u] = v
                level[u] = level[v] + 1
            end
        end
    end
    
    # Add spanning tree edges to DAG (oriented away from root)
    for v in 1:n
        if parent[v] > 0
            dag[parent[v], v] = 1.0
        end
    end
    
    # Try to add additional edges while maintaining DAG property
    for v in 1:n
        for u in 1:n
            # If edge exists in original graph
            if adj_matrix[v, u] ≈ 1.0
                # If not already in DAG and wouldn't create cycle
                if dag[v, u] ≈ 0.0 && dag[u, v] ≈ 0.0 && level[v] < level[u]
                    dag[v, u] = 1.0
                end
            end
        end
    end
    
    return dag, root
end

"""
    count_edges(matrix::Matrix{Float64}; directed::Bool=true)
    
    Count the number of edges in the graph.
"""
function count_edges(matrix::Matrix{Float64}; directed::Bool=true)
    if directed
        return sum(matrix .≈ 1.0)
    else
        return sum(matrix .≈ 1.0) ÷ 2
    end
end

"""
    is_dag(adj_matrix::Matrix{Float64})
    
    Check if the graph is a valid DAG.
"""
function is_dag(adj_matrix::Matrix{Float64})
    n = size(adj_matrix, 1)
    visited = falses(n)
    rec_stack = falses(n)
    
    function has_cycle(v)
        visited[v] = true
        rec_stack[v] = true
        
        for u in 1:n
            if adj_matrix[v, u] ≈ 1.0
                if !visited[u]
                    if has_cycle(u)
                        return true
                    end
                elseif rec_stack[u]
                    return true
                end
            end
        end
        
        rec_stack[v] = false
        return false
    end
    
    for v in 1:n
        if !visited[v]
            if has_cycle(v)
                return false
            end
        end
    end
    
    return true
end

end

#=
Example usage of UndirectedToDagModule:

using .UndirectedToDagModule

# Main execution
# Read and parse the content
println("Reading adjacency matrix...")
content = read("csvfiles\\metro.adjlist.jl", String)
A = parse_adj_matrix(content)

println("Size of adjacency matrix: ", size(A))

# Convert to DAG
println("\nConverting to DAG...")
# Let function decide root:
dag, selected_root = undirected_to_dag(A)  
# Or specify root node 1:
# dag, root = undirected_to_dag(A, 1)  

# Print statistics
original_edges = count_edges(A, directed=false)
dag_edges = count_edges(dag)  # now just passing the dag matrix
preservation_rate = (dag_edges / original_edges) * 100

println("\nStatistics:")
println("Converted it to a DAG while preserving most edges:\n")
println("Original graph had $(original_edges) undirected edges")
println("Resulting DAG has $(dag_edges) directed edges")
println("Preservation rate ($(round(preservation_rate, digits=1))% of edges)")
println("\nIs valid DAG: ", is_dag(dag))

# Save the DAG matrix
#println("\nSaving DAG matrix...")
#using DelimitedFiles
#writedlm("csvfiles\\metro_dag.csv", dag, ',')
#println("DAG matrix saved to metro_dag.csv")




=#