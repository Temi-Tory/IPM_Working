
using Graphs, LinearAlgebra
"""
    to_dot(edges; directed=false, graph_name="G")

    Converts a list of Graphs.SimpleGraphs.SimpleEdge{Int64} objects to a GraphViz DOT format string.
    When directed=true, source nodes are colored grey and terminal nodes pink.

    # Arguments
    - `edges`: Array of SimpleEdge objects
    - `directed`: Boolean indicating if the graph should be directed (default: false)
    - `graph_name`: Name of the graph (default: "G")

    # Returns
    - String in DOT format

    # Example
    ```julia
    using Graphs
    g = path_graph(5)
    edges = collect(edges(g))
    dot_string = to_dot(edges, directed=true)
    write("graph.dot", dot_string)
    ```
"""
function to_dot(edges; directed=false, graph_name="G")
    # Determine if we're creating a directed or undirected graph
    graph_type = directed ? "digraph" : "graph"
    edge_symbol = directed ? " -> " : " -- "
    
    # Start the DOT format string
    dot_string = "$graph_type $graph_name {\n"
    
    # If directed, we'll identify source and terminal nodes for coloring
    if directed
        # Find all nodes
        all_nodes = Set{Int}()
        for edge in edges
            push!(all_nodes, edge.src)
            push!(all_nodes, edge.dst)
        end
        
        # Find source nodes (nodes that have outgoing edges but no incoming edges)
        outgoing = Set{Int}([edge.src for edge in edges])
        incoming = Set{Int}([edge.dst for edge in edges])
        
        source_nodes = setdiff(outgoing, incoming)
        terminal_nodes = setdiff(incoming, outgoing)
        
        # Add node styling
        for node in source_nodes
            dot_string *= "  $node [style=filled, fillcolor=grey];\n"
        end
        
        for node in terminal_nodes
            dot_string *= "  $node [style=filled, fillcolor=pink];\n"
        end
    end
    
    # Add each edge to the string
    for edge in edges
        src = edge.src
        dst = edge.dst
        dot_string *= "  $src$edge_symbol$dst;\n"
    end
    
    # Close the graph
    dot_string *= "}"
    
    return dot_string
end

"""
    save_dot(edges, filename; directed=false, graph_name="G")

    Converts a list of Graphs.SimpleGraphs.SimpleEdge{Int64} objects to a GraphViz DOT format 
    and saves it to a file. When directed=true, source nodes are colored grey and terminal nodes pink.

    # Arguments
    - `edges`: Array of SimpleEdge objects
    - `filename`: Path to save the DOT file
    - `directed`: Boolean indicating if the graph should be directed (default: false)
    - `graph_name`: Name of the graph (default: "G")

    # Example
    ```julia
    using Graphs
    g = path_graph(5)
    edges = collect(edges(g))
    save_dot(edges, "graph.dot", directed=true)
```
"""
function save_dot(edges, filename; directed=false, graph_name="G")
    dot_string = to_dot(edges, directed=directed, graph_name=graph_name)
    open(filename, "w") do io
        write(io, dot_string)
    end
    println("DOT file saved to: $filename")
end

using Graphs, CSV, DataFrames, DelimitedFiles
# For example, if you have a graph
system_data = readdlm("csvfiles/layereddiamond_3.csv",  ',', header= false, Int);
original_system_matrix = Matrix(DataFrame(system_data, :auto));
original_system_graph = DiGraph(original_system_matrix);
#filepathcsv = "csvfiles/layereddiamond.csv";
#get edges
edges_ =(collect(edges(original_system_graph)));


# Generate DOT string
dot_string = to_dot(edges_, directed=true);
println(dot_string)

# Or save directly to a file
#save_dot(edges_, "my_graph.dot")

#save_dot(edges_, "directed_graph.dot", directed=true)

#simpleversion dag to undericted converted metro
function simple_undirected_to_dag(adj_matrix)
    n = size(adj_matrix, 1)
    dag = zeros(Int, n, n)
    
    for i in 1:n
        for j in i+1:n  # Only consider upper triangle
            if adj_matrix[i,j] == 1
                dag[i,j] = 1  # Always direct from lower to higher index
            end
        end
    end
    
    return dag
end

#degree based
function degree_based_dag(adj_matrix)
    n = size(adj_matrix, 1)
    degrees = sum(adj_matrix, dims=2)[:]  # Calculate node degrees
    sorted_nodes = sortperm(degrees, rev=true)  # Sort by degree (descending)
    
    dag_matrix = zeros(Int, n, n)
    node_order = Dict(node => idx for (idx, node) in enumerate(sorted_nodes))
    
    for i in 1:n, j in 1:n
        if adj_matrix[i,j] != 0
            if node_order[i] < node_order[j]
                dag_matrix[i,j] = 1
            elseif node_order[j] < node_order[i]
                dag_matrix[j,i] = 1
            end
        end
    end
    
    return dag_matrix
end

#centralitybased
function centrality_based_dag(adj_matrix)
    n = size(adj_matrix, 1)
    g = Graph(adj_matrix)
    
    # Compute betweenness centrality
    bc = betweenness_centrality(g)
    
    # Order nodes by centrality (higher centrality gets lower order index)
    sorted_nodes = sortperm(bc, rev=true)
    node_order = Dict(node => idx for (idx, node) in enumerate(sorted_nodes))
    
    # Build DAG based on centrality ordering
    dag_matrix = zeros(Int, n, n)
    for i in 1:n, j in 1:n
        if adj_matrix[i,j] != 0
            if node_order[i] < node_order[j]
                dag_matrix[i,j] = 1
            elseif node_order[j] < node_order[i]
                dag_matrix[j,i] = 1
            end
        end
    end
    
    return dag_matrix
end

#hybrid-based 
function improved_undirected_to_dag(adj_matrix)
    n = size(adj_matrix, 1)
    
    # Calculate multiple node metrics
    degrees = vec(sum(adj_matrix, dims=2))
    
    # Approximate eigenvector centrality
    centrality = ones(n)
    for _ in 1:10  # Number of iterations
        centrality = adj_matrix * centrality
        centrality = centrality / norm(centrality)
    end
    
    # Clustering coefficients
    clustering = zeros(n)
    for i in 1:n
        neighbors = findall(x -> x == 1, adj_matrix[i, :])
        if length(neighbors) > 1
            possible_connections = binomial(length(neighbors), 2)
            actual_connections = 0
            for j in neighbors, k in neighbors
                if j < k && adj_matrix[j, k] == 1
                    actual_connections += 1
                end
            end
            clustering[i] = actual_connections / possible_connections
        end
    end
    
    # Combine metrics into importance score
    importance = zeros(n)
    for i in 1:n
        importance[i] = 0.5 * degrees[i] / maximum(degrees) +
                      0.3 * centrality[i] / maximum(centrality) +
                      0.2 * clustering[i]
    end
    
    # Initial edge assignment based on importance
    dag = zeros(Int, n, n)
    for i in 1:n, j in i+1:n
        if adj_matrix[i,j] == 1
            if importance[i] > importance[j]
                dag[i,j] = 1
            else
                dag[j,i] = 1
            end
        end
    end
    
    # Cycle detection and removal would be implemented here
    
    return dag
end

dag_matrix = improved_undirected_to_dag(original_system_matrix);
dag = DiGraph(dag_matrix) # Convert to Graph object
edges_ =(collect(edges(dag)));


# Generate DOT string
dot_string = to_dot(edges_, directed=true);
println(dot_string)





