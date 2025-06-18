using CSV, DataFrames

function read_edges_csv(filename::String)
    df = CSV.read(filename, DataFrame)
    edges = [(row.from, row.to) for row in eachrow(df)]
    return edges
end

function create_adjacency_matrix(edges::Vector{Tuple{Int, Int}})
    # Get all unique nodes
    all_nodes = Set{Int}()
    for (u, v) in edges
        push!(all_nodes, u)
        push!(all_nodes, v)
    end
    
    # Create mapping from original node IDs to matrix indices
    sorted_nodes = sort(collect(all_nodes))
    node_to_index = Dict(node => i for (i, node) in enumerate(sorted_nodes))
    n_nodes = length(sorted_nodes)
    
    # Create adjacency matrix
    adj_matrix = zeros(Int, n_nodes, n_nodes)
    
    for (u, v) in edges
        i = node_to_index[u]
        j = node_to_index[v]
        adj_matrix[i, j] = 1
    end
    
    return adj_matrix, sorted_nodes
end

function save_matrix_csv(adj_matrix::Matrix{Int}, filename::String)
    # Convert to DataFrame without headers
    df = DataFrame(adj_matrix, :auto)
    
    # Save without column names or row names
    CSV.write(filename, df, header=false)
end

using Graphs

function remove_self_loops!(adj_matrix::Matrix{Int})
    n = size(adj_matrix, 1)
    removed_count = 0
    
    for i in 1:n
        if adj_matrix[i, i] == 1
            adj_matrix[i, i] = 0
            removed_count += 1
        end
    end
    
    println("Removed $removed_count self-loops")
    return adj_matrix
end

function make_dag_with_topsort(adj_matrix::Matrix{Int})
    # Remove self-loops first
    adj_matrix = remove_self_loops!(copy(adj_matrix))
    
    # Create graph for topological sorting
    graph = SimpleDiGraph(adj_matrix)
    
    # Try topological sort - if it fails, we need to remove some edges
    if is_cyclic(graph)
        println("Graph has cycles, finding edges to reorient...")
        
        # Strategy: Remove minimum edges to break cycles, do topsort, then reorient
        dag_matrix = break_cycles_and_reorient(adj_matrix)
        return dag_matrix
    else
        println("Graph is already a DAG!")
        return adj_matrix
    end
end

function break_cycles_and_reorient(adj_matrix::Matrix{Int})
    n = size(adj_matrix, 1)
    
    # Use Kahn's algorithm approach: repeatedly remove nodes with no incoming edges
    # to build a topological ordering
    working_matrix = copy(adj_matrix)
    topo_order = Int[]
    remaining_nodes = Set(1:n)
    
    while !isempty(remaining_nodes)
        # Find nodes with no incoming edges from remaining nodes
        no_incoming = Int[]
        for node in remaining_nodes
            has_incoming = false
            for source in remaining_nodes
                if working_matrix[source, node] == 1
                    has_incoming = true
                    break
                end
            end
            if !has_incoming
                push!(no_incoming, node)
            end
        end
        
        if isempty(no_incoming)
            # All remaining nodes are in cycles
            # Pick the node with minimum in-degree and remove one incoming edge
            min_in_degree = typemax(Int)
            min_node = nothing
            
            for node in remaining_nodes
                in_degree = sum(working_matrix[source, node] for source in remaining_nodes)
                if in_degree < min_in_degree
                    min_in_degree = in_degree
                    min_node = node
                end
            end
            
            # Remove one incoming edge to break cycle
            for source in remaining_nodes
                if working_matrix[source, min_node] == 1
                    working_matrix[source, min_node] = 0
                    println("Removed edge $source -> $min_node to break cycle")
                    break
                end
            end
        else
            # Add all no-incoming nodes to the ordering
            append!(topo_order, no_incoming)
            setdiff!(remaining_nodes, no_incoming)
        end
    end
    
    # Now we have a topological ordering
    # Create position mapping
    position = Dict(node => i for (i, node) in enumerate(topo_order))
    
    # Reorient edges to respect topological order
    dag_matrix = zeros(Int, n, n)
    reoriented_count = 0
    
    for i in 1:n
        for j in 1:n
            if adj_matrix[i, j] == 1  # Original edge exists
                if position[i] < position[j]
                    # Forward edge - keep as is
                    dag_matrix[i, j] = 1
                else
                    # Backward edge - reorient
                    dag_matrix[j, i] = 1
                    reoriented_count += 1
                end
            end
        end
    end
    
    println("Reoriented $reoriented_count edges to make DAG")
    
    # Verify it's actually a DAG now
    test_graph = SimpleDiGraph(dag_matrix)
    if is_cyclic(test_graph)
        println("Warning: Still has cycles after reorientation!")
    else
        println("✅ Successfully created DAG!")
    end
    
    return dag_matrix
end

function edges_to_dag_matrix(input_file::String, output_file::String)
    edges = read_edges(input_file)
    adj_matrix, nodes = create_adjacency_matrix(edges)
    
    println("Original: $(length(edges)) edges, $(size(adj_matrix, 1)) nodes")
    
    # Convert to DAG
    dag_matrix = make_dag_with_topsort(adj_matrix)
    
    # Count final edges
    final_edges = sum(dag_matrix)
    original_edges = sum(adj_matrix)
    
    println("Final DAG: $final_edges edges (was $original_edges)")
    println("Edge retention: $(round(final_edges/original_edges*100, digits=1))%")
    
    save_matrix_csv(dag_matrix, output_file)
    println("Saved DAG matrix to: $output_file")
    
    return dag_matrix
end

function edges_to_matrix(input_file::String, output_file::String)
    edges = read_edges(input_file)
    adj_matrix, nodes = create_adjacency_matrix(edges)
    save_matrix_csv(adj_matrix, output_file)
    
    println("Converted $(length(edges)) edges to $(size(adj_matrix, 1))x$(size(adj_matrix, 2)) matrix")
    println("Saved to: $output_file")
    
    return adj_matrix
end

using Graphs



df = CSV.read("csvfiles/munin/munin_edges_1indexed.csv", DataFrame)
edges = [(row.from, row.to) for row in eachrow(df)];
matrix, nodes = create_adjacency_matrix(edges) ; 

save_matrix_csv(matrix, "csvfiles/munin/munin_dag.csv");

SimpleDiGraph(matrix) |> is_cyclic
