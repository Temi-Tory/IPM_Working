using CSV, DataFrames, DelimitedFiles, Statistics


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


"""
Convert adjacency list format for analysis
"""
function convert_adjacency_format(adj_list::Dict{Int, Vector{Tuple{Int, Float64}}})::Dict{Int, Dict{Int, Float64}}
    converted = Dict{Int, Dict{Int, Float64}}()
    
    for (node_id, connections) in adj_list
        converted[node_id] = Dict{Int, Float64}()
        for (neighbor_id, weight) in connections
            converted[node_id][neighbor_id] = weight
        end
    end
    
    return converted
end

"""
Create nodes dictionary from Node vector
"""
function create_nodes_dict(nodes::Vector{Node})::Dict{Int, Node}
    return Dict(node.id => node for node in nodes)
end

"""
Enhanced node analysis with role classification
"""
function analyze_node_roles(nodes_dict::Dict{Int, Node})
    role_analysis = Dict(
        "hospitals" => Int[],
        "potential_hubs" => Int[],
        "airports" => Int[],
        "generic_locations" => Int[],
        "receivers" => Int[],
        "sources" => Int[]
    )
    
    for (id, node) in nodes_dict
        # Classify by type
        if node.source_receiver_type == "RECEIVER"
            push!(role_analysis["receivers"], id)
        elseif node.source_receiver_type == "SOURCE"
            push!(role_analysis["sources"], id)
        elseif node.source_receiver_type == "GENERIC"
            push!(role_analysis["generic_locations"], id)
        end
        
        # Classify hospitals
        if node.city_type == "H"  # Hospital
            push!(role_analysis["hospitals"], id)
        end
        
        # Classify by infrastructure potential
        if occursin("Airport", node.info) || occursin("airport", node.info)
            push!(role_analysis["airports"], id)
        elseif node.city_type == "new"
            push!(role_analysis["generic_locations"], id)
        end
        
        # Potential hubs (high group numbers, airports, or central locations)
        if node.group_1 >= 10 || occursin("Airport", node.info) || node.source_receiver_type == "SOURCE"
            push!(role_analysis["potential_hubs"], id)
        end
    end
    
    return role_analysis
end

"""
Analyze connectivity patterns for a single drone type
"""
function analyze_drone_connectivity(adj_list::Dict{Int, Dict{Int, Float64}}, nodes_dict::Dict{Int, Node}, drone_name::String)
    println("=== $drone_name CONNECTIVITY ANALYSIS ===")
    
    # Basic stats
    n_nodes = length(adj_list)
    total_edges = sum(length(neighbors) for neighbors in values(adj_list))
    
    # Node connectivity distribution
    degrees = [length(neighbors) for neighbors in values(adj_list)]
    isolated_nodes = [id for (id, neighbors) in adj_list if length(neighbors) == 0]
    
    if !isempty(degrees)
        highly_connected = [id for (id, neighbors) in adj_list if length(neighbors) > quantile(degrees, 0.9)]
    else
        highly_connected = Int[]
    end
    
    max_possible_edges = n_nodes * (n_nodes - 1)
    density = max_possible_edges > 0 ? total_edges / max_possible_edges : 0.0
    
    println("  Nodes: $n_nodes")
    println("  edges: $total_edges")
    println("  Density: $(round(density, digits=4))")
    println("  Isolated nodes: $(length(isolated_nodes))")
    println("  Highly connected nodes (>90th percentile): $(length(highly_connected))")
    
    # Weight analysis
    all_weights = Float64[]
    for neighbors in values(adj_list)
        for weight in values(neighbors)
            push!(all_weights, weight)
        end
    end
    
    if !isempty(all_weights)
        println("  Average weight: $(round(mean(all_weights), digits=2))")
        println("  Weight range: $(round(minimum(all_weights), digits=2)) - $(round(maximum(all_weights), digits=2))")
        println("  Weight std dev: $(round(std(all_weights), digits=2))")
    end
    
    # Hospital connectivity analysis
    hospital_connectivity = Dict()
    valid_adj_keys = Set(keys(adj_list))
    
    for (id, node) in nodes_dict
        if node.city_type == "H" && id in valid_adj_keys  # Hospital AND exists in adj_list
            connections = length(adj_list[id])
            hospital_connectivity[id] = connections
        end
    end
    
    connected_hospitals = sum(conn > 0 for conn in values(hospital_connectivity))
    total_hospitals = length(hospital_connectivity)
    
    println("  Hospital Analysis:")
    println("    Total hospitals: $total_hospitals")
    println("    Connected hospitals: $connected_hospitals")
    if total_hospitals > 0
        println("    Hospital coverage: $(round(connected_hospitals/total_hospitals*100, digits=1))%")
    end
    
    if !isempty(isolated_nodes)
        isolated_hospitals = [id for id in isolated_nodes if haskey(nodes_dict, id) && nodes_dict[id].city_type == "H"]
        println("    Isolated hospitals: $(length(isolated_hospitals))")
    end
    
    return Dict(
        "total_edges" => total_edges,
        "isolated_nodes" => isolated_nodes,
        "highly_connected" => highly_connected,
        "hospital_connectivity" => hospital_connectivity,
        "weights" => all_weights
    )
end

"""
Compare connectivity between two drone types
"""
function compare_drone_networks(drone1_adj::Dict{Int, Dict{Int, Float64}}, 
                               drone2_adj::Dict{Int, Dict{Int, Float64}}, 
                               nodes_dict::Dict{Int, Node})
    println("\n" * "="^60)
    println("🚁 COMPARATIVE DRONE NETWORK ANALYSIS 🚁")
    println("="^60)
    
    # Analyze each drone type
    drone1_stats = analyze_drone_connectivity(drone1_adj, nodes_dict, "DRONE 1 (High Capability)")
    println()
    drone2_stats = analyze_drone_connectivity(drone2_adj, nodes_dict, "DRONE 2 (Low Capability)")
    
    println("\n=== COMPARATIVE INSIGHTS ===")
    
    # Edge count comparison
    d1_edges = drone1_stats["total_edges"]
    d2_edges = drone2_stats["total_edges"]
    
    if d2_edges > 0
        println("  Edge ratio (Drone1:Drone2): $(round(d1_edges/d2_edges, digits=2)):1")
    else
        println("  Drone 1 has $d1_edges edges, Drone 2 has no edges")
    end
    
    # Hospital coverage comparison
    d1_hospital_conn = drone1_stats["hospital_connectivity"]
    d2_hospital_conn = drone2_stats["hospital_connectivity"]
    
    vtol_connected_hospitals = sum(conn > 0 for conn in values(d1_hospital_conn))
    fixed_connected_hospitals = sum(conn > 0 for conn in values(d2_hospital_conn))
    
    println("  Hospital coverage:")
    println("    Drone 1 can reach: $vtol_connected_hospitals hospitals")
    println("    Drone 2 can reach: $fixed_connected_hospitals hospitals")
    
    # Find complementary coverage (only for hospitals that exist in both)
    common_hospitals = intersect(keys(d1_hospital_conn), keys(d2_hospital_conn))
    drone1_only = [id for id in common_hospitals if d1_hospital_conn[id] > 0 && d2_hospital_conn[id] == 0]
    drone2_only = [id for id in common_hospitals if d2_hospital_conn[id] > 0 && d1_hospital_conn[id] == 0]
    both_can_reach = [id for id in common_hospitals if d1_hospital_conn[id] > 0 && d2_hospital_conn[id] > 0]
    
    println("    Drone 1 only accessible: $(length(drone1_only)) hospitals")
    println("    Drone 2 only accessible: $(length(drone2_only)) hospitals")
    println("    Both can reach: $(length(both_can_reach)) hospitals")
    
    # Weight comparison
    if !isempty(drone1_stats["weights"]) && !isempty(drone2_stats["weights"])
        println("  Average flight costs:")
        println("    Drone 1: $(round(mean(drone1_stats["weights"]), digits=2))")
        println("    Drone 2: $(round(mean(drone2_stats["weights"]), digits=2))")
    end
    
    return Dict(
        "drone1_stats" => drone1_stats,
        "drone2_stats" => drone2_stats,
        "drone1_only_hospitals" => drone1_only,
        "drone2_only_hospitals" => drone2_only,
        "both_accessible" => both_can_reach
    )
end

"""
Identify potential transfer nodes for multi-modal routing
"""
function identify_transfer_opportunities(drone1_adj::Dict{Int, Dict{Int, Float64}}, 
                                       drone2_adj::Dict{Int, Dict{Int, Float64}}, 
                                       nodes_dict::Dict{Int, Node})
    println("\n=== TRANSFER NODE ANALYSIS ===")
    
    potential_transfers = Int[]
    transfer_analysis = Dict()
    
    # Only consider nodes that exist in both adjacency lists
    common_nodes = intersect(keys(drone1_adj), keys(drone2_adj))
    
    for node_id in common_nodes
        if !haskey(nodes_dict, node_id)
            continue  # Skip if node info not available
        end
        
        node = nodes_dict[node_id]
        
        # Can this node serve both drone types?
        drone1_connections = length(drone1_adj[node_id])
        drone2_connections = length(drone2_adj[node_id])
        
        if drone1_connections > 0 && drone2_connections > 0
            push!(potential_transfers, node_id)
            
            # Calculate transfer value (how many unique destinations it enables)
            drone1_destinations = Set(keys(drone1_adj[node_id]))
            drone2_destinations = Set(keys(drone2_adj[node_id]))
            
            transfer_analysis[node_id] = Dict(
                "drone1_connections" => drone1_connections,
                "drone2_connections" => drone2_connections,
                "transfer_value" => length(drone1_destinations) + length(drone2_destinations),
                "is_airport" => occursin("Airport", node.info),
                "node_info" => node
            )
        end
    end
    
    # Sort by transfer value
    sorted_transfers = sort(collect(transfer_analysis), by=x->x[2]["transfer_value"], rev=true)
    
    println("  Potential transfer nodes: $(length(potential_transfers))")
    println("  Top 10 transfer candidates:")
    
    for (i, (node_id, analysis)) in enumerate(sorted_transfers[1:min(10, length(sorted_transfers))])
        node = analysis["node_info"]
        airport_flag = analysis["is_airport"] ? " ✈️" : ""
        println("    $i. Node $node_id: $(node.info)$airport_flag")
        println("       Drone1 connections: $(analysis["drone1_connections"]), Drone2: $(analysis["drone2_connections"])")
    end
    
    return transfer_analysis, potential_transfers
end

"""
Comprehensive drone network analysis
"""
function comprehensive_drone_analysis(nodes_file::String, drone1_file::String, drone2_file::String)
    println("🚁🚁🚁 COMPREHENSIVE DRONE NETWORK ANALYSIS 🚁🚁🚁")
    println("="^80)
    
    # Load data using your existing functions
    println("Loading drone 1 data...")
    nodes1, edges1 = read_graph_data(nodes_file, drone1_file)
    adj_list1 = create_adjacency_list(nodes1, edges1)
    drone1_adj = convert_adjacency_format(adj_list1)
    
    println("\nLoading drone 2 data...")
    nodes2, edges2 = read_graph_data(nodes_file, drone2_file)
    adj_list2 = create_adjacency_list(nodes2, edges2)
    drone2_adj = convert_adjacency_format(adj_list2)
    
    # Create nodes dictionary (use nodes1 since they should be the same)
    nodes_dict = create_nodes_dict(nodes1)
    
    println("\n" * "="^80)
    
    # 1. Node role analysis
    println("📍 NODE ROLE CLASSIFICATION")
    println("="^30)
    role_analysis = analyze_node_roles(nodes_dict)
    for (role, node_ids) in role_analysis
        println("  $(uppercase(role)): $(length(node_ids))")
    end
    
    # 2. Comparative drone analysis
    comparison = compare_drone_networks(drone1_adj, drone2_adj, nodes_dict)
    
    # 3. Transfer node analysis
    transfer_analysis, transfer_nodes = identify_transfer_opportunities(drone1_adj, drone2_adj, nodes_dict)
    
    # 4. Summary and recommendations
    println("\n" * "="^80)
    println("📋 SUMMARY & RECOMMENDATIONS")
    println("="^80)
    
    total_hospitals = length(role_analysis["hospitals"])
    drone1_reachable = sum(conn > 0 for conn in values(comparison["drone1_stats"]["hospital_connectivity"]))
    drone2_reachable = sum(conn > 0 for conn in values(comparison["drone2_stats"]["hospital_connectivity"]))
    
    println("  Overall Network Performance:")
    println("    Total hospitals: $total_hospitals")
    println("    Drone 1 reachable: $drone1_reachable ($(round(drone1_reachable/total_hospitals*100, digits=1))%)")
    println("    Drone 2 reachable: $drone2_reachable ($(round(drone2_reachable/total_hospitals*100, digits=1))%)")
    
    println("\n  Network Design Recommendations:")
    println("    1. Use Drone 1 for comprehensive coverage ($(comparison["drone1_stats"]["total_edges"]) connections)")
    println("    2. Use Drone 2 for specialized missions ($(comparison["drone2_stats"]["total_edges"]) connections)")
    println("    3. Implement $(length(transfer_nodes)) transfer nodes for mode switching")
    println("    4. Focus on $(length(role_analysis["potential_hubs"])) hub candidates for logistics")
    
    # Show some specific hospital examples
    if !isempty(comparison["drone1_only_hospitals"])
        println("    5. Drone 1 critical for $(length(comparison["drone1_only_hospitals"])) exclusive hospital connections")
        
        # Show a few examples
        exclusive_examples = comparison["drone1_only_hospitals"][1:min(3, length(comparison["drone1_only_hospitals"]))]
        for hospital_id in exclusive_examples
            if haskey(nodes_dict, hospital_id)
                println("       - $(nodes_dict[hospital_id].info)")
            end
        end
    end
    
    return Dict(
        "nodes_dict" => nodes_dict,
        "drone1_adj" => drone1_adj,
        "drone2_adj" => drone2_adj,
        "role_analysis" => role_analysis,
        "comparison" => comparison,
        "transfer_analysis" => transfer_analysis,
        "transfer_nodes" => transfer_nodes
    )
end

# Example usage - run the comprehensive analysis
function run_analysis()
    nodes_file = "src/Network-flow-algos/test/drone network/nodes.csv"
    drone1_file = "src/Network-flow-algos/test/drone network/feasible_drone_1.csv"
    drone2_file = "src/Network-flow-algos/test/drone network/feasible_drone_2.csv"
    
    try
        println("🚀 Starting comprehensive analysis...")
        analysis_results = comprehensive_drone_analysis(nodes_file, drone1_file, drone2_file)
        println("\n✅ Analysis completed successfully!")
        return analysis_results
    catch e
        println("\n❌ Analysis failed with error: $e")
        rethrow(e)
    end
end

# Run the analysis
run_analysis()