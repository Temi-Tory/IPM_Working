using CSV, DataFrames, DelimitedFiles

# Define the Node structure
struct Node
    id::Int
    lat::Float64
    lon::Float64
    east::Float64
    north::Float64
    uprn::Int
    info::String
    city_type::String
    source_receiver_type::String
    cs_type::Int
    dp_type::Int
    group_1::Int
    group_2::Int
end

# Define the Edge structure
struct Edge
    from::Int
    to::Int
    weight::Float64
end

# Function to read nodes from CSV file
function read_nodes(filepath::String)::Vector{Node}
    # Read the CSV file - comma delimited with proper column names
    df = CSV.read(filepath, DataFrame, delim=',')
    
    println("Loaded $(nrow(df)) rows with columns: $(names(df))")
    
    nodes = Node[]
    
    for row in eachrow(df)
        # Handle missing values and convert appropriately
        node = Node(
            Int(row.numberID),
            Float64(row.lat),
            Float64(row.lon),
            Float64(row.east),
            Float64(row.nort),  # Note: your CSV has 'nort' not 'north'
            Int(row.uprn),
            String(row.info),
            String(row.city_type),
            String(row.source_receiver_type),
            Int(row.CS_type),
            Int(row.DP_type),
            Int(row.group_1),
            Int(row.group_2)
        )
        push!(nodes, node)
    end
    
    return nodes
end

# Function to read the weight matrix and convert to edges
function read_weight_matrix(filepath::String)::Vector{Edge}
    # Read the matrix file - comma delimited with generic column names
    matrix_data = readdlm(filepath, ',', String)
    
    # Get dimensions (excluding header row)
    n_rows, n_cols = size(matrix_data)
    matrix_size = n_rows - 1  # Subtract 1 for header
    
    println("Matrix file dimensions: $(n_rows) × $(n_cols) (including header)")
    println("Data matrix size: $(matrix_size) × $(n_cols)")
    
    edges = Edge[]
    
    # Iterate through the matrix (skip first row which is header)
    for i in 2:n_rows
        for j in 1:n_cols  # No column headers in matrix, just data
            # Get the weight value
            weight_val = matrix_data[i, j]
            
            # Better Inf checking and validation
            if !ismissing(weight_val) &&
               weight_val != "Inf" &&
               weight_val != "inf" &&
               !occursin("Inf", string(weight_val))
                
                try
                    weight_float = parse(Float64, string(weight_val))
                    if !isinf(weight_float) && !isnan(weight_float) && weight_float > 0
                        # Matrix indices: i-1 (skip header row), j (no header column)
                        push!(edges, Edge(i-1, j, weight_float))
                    end
                catch e
                    # Skip invalid values
                    continue
                end
            end
        end
    end
    
    return edges
end

# Function to map matrix indices to actual node IDs
function map_edges_to_node_ids(edges::Vector{Edge}, nodes::Vector{Node})::Vector{Edge}
    # Create a mapping from matrix index (1-based) to actual node ID
    # Matrix is 244x244, nodes are 244 total, but IDs range from 1-289 with gaps
    node_ids = [node.id for node in nodes]
    
    mapped_edges = Edge[]
    
    for edge in edges
        # Matrix indices are 1-244, map to actual node IDs
        if edge.from <= length(node_ids) && edge.to <= length(node_ids) && 
           edge.from > 0 && edge.to > 0
            actual_from_id = node_ids[edge.from]
            actual_to_id = node_ids[edge.to]
            push!(mapped_edges, Edge(actual_from_id, actual_to_id, edge.weight))
        end
    end
    
    return mapped_edges
end

# Function to verify data consistency
function verify_data_consistency(nodes::Vector{Node}, matrix_file::String)
    println("\n=== Data Consistency Check ===")
    
    # Count matrix dimensions
    matrix_data = readdlm(matrix_file, ',', String)
    matrix_rows, matrix_cols = size(matrix_data)
    actual_matrix_size = matrix_rows - 1  # Subtract header row
    
    println("Number of nodes: $(length(nodes))")
    println("Matrix dimensions: $(actual_matrix_size) × $(matrix_cols)")
    
    # Get node ID statistics without assuming range
    node_ids = [n.id for n in nodes]
    println("Node IDs: min=$(minimum(node_ids)), max=$(maximum(node_ids))")
    println("Unique node IDs: $(length(unique(node_ids)))")
    
    # Check for duplicate node IDs
    if length(node_ids) != length(unique(node_ids))
        println("⚠️  Duplicate node IDs found!")
        duplicates = [id for id in unique(node_ids) if count(==(id), node_ids) > 1]
        println("Duplicate IDs: $duplicates")
    else
        println("✓ All node IDs are unique")
    end
    
    # Verify matrix size matches node count
    if actual_matrix_size == length(nodes) && matrix_cols == length(nodes)
        println("✓ Matrix size ($(actual_matrix_size) × $(matrix_cols)) matches node count ($(length(nodes)))")
    else
        println("⚠️  Matrix size ($(actual_matrix_size) × $(matrix_cols)) ≠ node count ($(length(nodes)))")
        return false
    end
    
    return true
end

# Function to check for missing nodes in matrix mapping
function check_matrix_node_mapping(nodes::Vector{Node}, edges::Vector{Edge})
    println("\n=== Matrix-Node Mapping Check ===")
    
    # Get all node IDs
    node_ids = Set([n.id for n in nodes])
    
    # Get all node IDs referenced in edges (after mapping)
    edge_from_ids = Set([e.from for e in edges])
    edge_to_ids = Set([e.to for e in edges])
    edge_node_ids = union(edge_from_ids, edge_to_ids)
    
    println("Nodes in node list: $(length(node_ids))")
    println("Unique node IDs referenced in edges: $(length(edge_node_ids))")
    
    # Check if any edge references non-existent nodes
    missing_nodes = setdiff(edge_node_ids, node_ids)
    if !isempty(missing_nodes)
        println("⚠️  Edges reference nodes not in node list: $missing_nodes")
    else
        println("✓ All edge nodes exist in node list")
    end
    
    # Check if any nodes are never referenced in edges
    unreferenced_nodes = setdiff(node_ids, edge_node_ids)
    if !isempty(unreferenced_nodes)
        println("⚠️  Nodes never referenced in edges ($(length(unreferenced_nodes)) nodes):")
        if length(unreferenced_nodes) <= 10
            println("   Unreferenced node IDs: $unreferenced_nodes")
        else
            println("   First 10 unreferenced node IDs: $(collect(unreferenced_nodes)[1:10])")
        end
    else
        println("✓ All nodes are referenced in edges")
    end
    
    # Show mapping info
    sorted_node_ids = sort([n.id for n in nodes])
    println("\nMatrix index → Node ID mapping (first 10):")
    for i in 1:min(10, length(sorted_node_ids))
        println("   Matrix index $i → Node ID $(sorted_node_ids[i])")
    end
    
    if length(sorted_node_ids) > 10
        println("   ...")
        for i in max(1, length(sorted_node_ids)-2):length(sorted_node_ids)
            println("   Matrix index $i → Node ID $(sorted_node_ids[i])")
        end
    end
end

# Main function to read both files and create the graph data
function read_graph_data(nodes_file::String, matrix_file::String)
    println("Reading nodes from: $nodes_file")
    nodes = read_nodes(nodes_file)
    println("Loaded $(length(nodes)) nodes")
    
    # Verify data consistency
    if !verify_data_consistency(nodes, matrix_file)
        error("Data consistency check failed!")
    end
    
    println("\nReading weight matrix from: $matrix_file")
    edges = read_weight_matrix(matrix_file)
    println("Found $(length(edges)) valid edges")
    
    # Map matrix indices to actual node IDs
    mapped_edges = map_edges_to_node_ids(edges, nodes)
    println("Mapped $(length(mapped_edges)) edges to node IDs")
    
    # Check matrix-node mapping
    check_matrix_node_mapping(nodes, mapped_edges)
    
    return nodes, mapped_edges
end

# Utility function to create adjacency lists
function create_adjacency_list(nodes::Vector{Node}, edges::Vector{Edge})::Dict{Int, Vector{Tuple{Int, Float64}}}
    adj_list = Dict{Int, Vector{Tuple{Int, Float64}}}()
    
    # Initialize adjacency list for all nodes
    for node in nodes
        adj_list[node.id] = Tuple{Int, Float64}[]
    end
    
    # Add edges to adjacency list
    for edge in edges
        if haskey(adj_list, edge.from)
            push!(adj_list[edge.from], (edge.to, edge.weight))
        end
    end
    
    return adj_list
end

# Utility function to get node by ID
function get_node_by_id(nodes::Vector{Node}, id::Int)::Union{Node, Nothing}
    for node in nodes
        if node.id == id
            return node
        end
    end
    return nothing
end

# Function to print summary statistics
function print_graph_summary(nodes::Vector{Node}, edges::Vector{Edge})
    println("\n=== Graph Summary ===")
    println("Nodes: $(length(nodes))")
    println("Edges: $(length(edges))")
    
    if !isempty(edges)
        weights = [edge.weight for edge in edges]
        println("Weight range: $(minimum(weights)) - $(maximum(weights))")
        println("Average weight: $(round(sum(weights)/length(weights), digits=2))")
    end
    
    # Count nodes by type
    city_types = Dict{String, Int}()
    source_receiver_types = Dict{String, Int}()
    
    for node in nodes
        city_types[node.city_type] = get(city_types, node.city_type, 0) + 1
        source_receiver_types[node.source_receiver_type] = get(source_receiver_types, node.source_receiver_type, 0) + 1
    end
    
    println("\nCity types:")
    for (type, count) in city_types
        println("  $type: $count")
    end
    
    println("\nSource/Receiver types:")
    for (type, count) in source_receiver_types
        println("  $type: $count")
    end
end

# Example usage:
# nodes, edges = read_graph_data("paste-2.txt", "paste.txt")
# print_graph_summary(nodes, edges)
# adj_list = create_adjacency_list(nodes, edges)

# Example usage:
drone_type =1;
nodes_file = "src/Network-flow-algos/test/drone network/nodes.csv";
feasible_file = "src/Network-flow-algos/test/drone network/feasible_drone_$drone_type.csv";
nodes, edgelist = read_graph_data(nodes_file, feasible_file)
print_graph_summary(nodes, edgelist)
adj_list = create_adjacency_list(nodes, edgelist)
