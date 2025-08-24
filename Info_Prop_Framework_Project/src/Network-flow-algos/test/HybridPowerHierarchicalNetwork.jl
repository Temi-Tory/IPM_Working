"""
Hybrid Power-Hierarchical Network
Combines scaled-power-5x linear backbone with hierarchical drone clusters
Creates multi-level complexity: linear backbone + dense local clusters + cross-topology diamonds
"""

using CSV, DataFrames, JSON, Random
using StatsBase: sample

function load_drone_network_data()
    """Load drone network data"""
    nodes_df = CSV.read("dag_ntwrk_files/drone_info/nodes.csv", DataFrame)
    vtol_matrix = Matrix(CSV.read("dag_ntwrk_files/drone_info/drone1.csv", DataFrame))
    fixed_matrix = Matrix(CSV.read("dag_ntwrk_files/drone_info/drone2.csv", DataFrame))
    return (nodes_df, vtol_matrix, fixed_matrix)
end

function load_power_topology()
    """Load the scaled-power-5x topology structure"""
    power_edges_df = CSV.read("dag_ntwrk_files/scaled-power-network-5x/scaled-power-network-5x.EDGES", DataFrame)
    power_edges = [(row.source, row.destination) for row in eachrow(power_edges_df)]
    power_nodes = sort(unique(vcat([e[1] for e in power_edges], [e[2] for e in power_edges])))
    return power_edges, power_nodes
end

function load_hierarchical_topology()
    """Load the hierarchical drone topology structure"""
    hier_edges_df = CSV.read("dag_ntwrk_files/hierarchical_drone_medical/hierarchical_drone_medical.EDGES", DataFrame)
    hier_edges = [(row.source, row.destination) for row in eachrow(hier_edges_df)]
    hier_nodes = sort(unique(vcat([e[1] for e in hier_edges], [e[2] for e in hier_edges])))
    return hier_edges, hier_nodes
end

function create_hybrid_power_hierarchical_network()
    """Create hybrid network combining power backbone with hierarchical clusters"""
    println("\n🔌🚁 CREATING HYBRID POWER-HIERARCHICAL NETWORK")
    println("="^70)
    
    # Load all data
    drone_nodes_df, vtol_matrix, fixed_matrix = load_drone_network_data()
    power_edges, power_nodes = load_power_topology()
    hier_edges, hier_nodes = load_hierarchical_topology()
    
    println("📊 Source Networks:")
    println("   Power backbone: $(length(power_nodes)) nodes, $(length(power_edges)) edges")
    println("   Hierarchical clusters: $(length(hier_nodes)) nodes, $(length(hier_edges)) edges")
    
    # Create hybrid topology structure
    hybrid_edgelist, hybrid_node_mapping, total_nodes = create_hybrid_topology(
        power_edges, power_nodes, hier_edges, hier_nodes
    )
    
    # Map all nodes to drone facilities
    node_to_facility_mapping = map_hybrid_nodes_to_facilities(
        total_nodes, drone_nodes_df, hybrid_node_mapping
    )
    
    # Calculate drone-based probabilities
    node_priors, edge_probabilities = calculate_hybrid_probabilities(
        hybrid_edgelist, node_to_facility_mapping, drone_nodes_df, vtol_matrix, total_nodes
    )
    
    # Export the network
    network_name = export_hybrid_network(
        hybrid_edgelist, node_priors, edge_probabilities, "hybrid_power_hierarchical",
        node_to_facility_mapping, drone_nodes_df, hybrid_node_mapping, 
        length(power_nodes), length(hier_nodes)
    )
    
    println("✅ Created Hybrid Power-Hierarchical Network!")
    println("   📊 Network Statistics:")
    println("      • Total nodes: $(length(node_priors))")
    println("      • Total edges: $(length(hybrid_edgelist))")
    println("      • Power backbone contribution: $(length(power_nodes)) nodes")
    println("      • Hierarchical clusters: $(length(hier_nodes)) nodes per cluster")
    println("   🎯 Expected complexity: Combines linear backbone + dense clusters + cross-topology diamonds")
    
    return network_name
end

function create_hybrid_topology(power_edges, power_nodes, hier_edges, hier_nodes)
    """Create the hybrid topology by embedding hierarchical clusters in power backbone"""
    
    hybrid_edgelist = Vector{Tuple{Int64, Int64}}()
    hybrid_node_mapping = Dict{String, Vector{Int64}}()  # Track node sources
    
    # Phase 1: Create power backbone structure (offset to avoid conflicts)
    println("🔗 Phase 1: Creating power backbone structure...")
    power_node_offset = 0
    power_remapped_nodes = Dict{Int64, Int64}()
    
    # Remap power nodes starting from 1
    for (i, power_node) in enumerate(power_nodes)
        new_node_id = i
        power_remapped_nodes[power_node] = new_node_id
    end
    
    # Add power backbone edges with remapped node IDs
    backbone_edges = 0
    for (src, dst) in power_edges
        new_src = power_remapped_nodes[src]
        new_dst = power_remapped_nodes[dst]
        push!(hybrid_edgelist, (new_src, new_dst))
        backbone_edges += 1
    end
    
    hybrid_node_mapping["power_backbone"] = collect(values(power_remapped_nodes))
    println("   Added $backbone_edges power backbone edges")
    
    # Phase 2: Create hierarchical clusters at strategic power nodes
    println("🔗 Phase 2: Embedding hierarchical clusters...")
    
    # Select strategic power nodes to become cluster centers (every 5th node)
    cluster_centers = []
    power_nodes_sorted = sort(collect(values(power_remapped_nodes)))
    for i in 1:5:length(power_nodes_sorted)  # Every 5th power node becomes cluster center
        push!(cluster_centers, power_nodes_sorted[i])
    end
    
    println("   Selected $(length(cluster_centers)) cluster centers: $cluster_centers")
    
    # For each cluster center, embed a scaled hierarchical structure
    next_available_node = maximum(power_nodes_sorted) + 1
    cluster_node_mapping = Dict{Int64, Vector{Int64}}()
    
    for (cluster_idx, center_node) in enumerate(cluster_centers)
        println("   Creating cluster $cluster_idx at power node $center_node...")
        
        # Create a subset of hierarchical structure (scale it down to avoid explosion)
        cluster_size = min(30, length(hier_nodes))  # Limit cluster size
        selected_hier_nodes = hier_nodes[1:cluster_size]
        
        # Remap hierarchical nodes for this cluster
        cluster_nodes = []
        hier_node_remapping = Dict{Int64, Int64}()
        
        # Connect center power node to top of hierarchical cluster
        hier_sources = Set{Int64}()
        for (src, dst) in hier_edges
            if src in selected_hier_nodes && dst in selected_hier_nodes
                push!(hier_sources, src)
            end
        end
        for (src, dst) in hier_edges
            if src in selected_hier_nodes && dst in selected_hier_nodes
                setdiff!(hier_sources, [dst])
            end
        end
        
        # Map hierarchical nodes starting from next available ID
        for hier_node in selected_hier_nodes
            if hier_node == minimum(selected_hier_nodes)  # First node connects to power center
                hier_node_remapping[hier_node] = center_node
            else
                hier_node_remapping[hier_node] = next_available_node
                push!(cluster_nodes, next_available_node)
                next_available_node += 1
            end
        end
        
        # Add hierarchical edges within this cluster
        cluster_edges = 0
        for (src, dst) in hier_edges
            if src in selected_hier_nodes && dst in selected_hier_nodes
                new_src = hier_node_remapping[src]
                new_dst = hier_node_remapping[dst]
                
                # Avoid duplicate edges (especially self-loops to center_node)
                if new_src != new_dst && (new_src, new_dst) ∉ hybrid_edgelist
                    push!(hybrid_edgelist, (new_src, new_dst))
                    cluster_edges += 1
                end
            end
        end
        
        cluster_node_mapping[center_node] = cluster_nodes
        println("      Added $cluster_edges cluster edges, $(length(cluster_nodes)) new nodes")
    end
    
    # Phase 3: Add cross-cluster connections (create cross-topology diamonds)
    println("🔗 Phase 3: Adding cross-cluster connections...")
    cross_connections = 0
    
    # Connect clusters to each other through their center nodes (creates diamonds!)
    for i in 1:length(cluster_centers)-1
        center_a = cluster_centers[i]
        center_b = cluster_centers[i+1]
        
        # Get some nodes from each cluster
        cluster_a_nodes = get(cluster_node_mapping, center_a, [])
        cluster_b_nodes = get(cluster_node_mapping, center_b, [])
        
        # Create cross-connections between clusters (limited to avoid explosion)
        max_cross_connections = min(3, length(cluster_a_nodes), length(cluster_b_nodes))
        
        for j in 1:max_cross_connections
            if j <= length(cluster_a_nodes) && j <= length(cluster_b_nodes)
                node_a = cluster_a_nodes[j]
                node_b = cluster_b_nodes[j]
                
                # Add unidirectional cross-cluster edges (maintain DAG property)
                # Only connect from lower-indexed cluster to higher-indexed cluster
                if center_a < center_b && (node_a, node_b) ∉ hybrid_edgelist
                    push!(hybrid_edgelist, (node_a, node_b))
                    cross_connections += 1
                end
            end
        end
    end
    
    println("   Added $cross_connections cross-cluster connections")
    
    # Calculate total nodes
    all_nodes = Set{Int64}()
    for (src, dst) in hybrid_edgelist
        push!(all_nodes, src)
        push!(all_nodes, dst)
    end
    total_nodes = length(all_nodes)
    
    hybrid_node_mapping["cluster_centers"] = cluster_centers
    # Flatten all cluster nodes into a single vector
    all_cluster_nodes = Int64[]
    for cluster_nodes in values(cluster_node_mapping)
        append!(all_cluster_nodes, cluster_nodes)
    end
    hybrid_node_mapping["all_cluster_nodes"] = all_cluster_nodes
    
    println("✅ Hybrid topology created:")
    println("   • Total nodes: $total_nodes")
    println("   • Total edges: $(length(hybrid_edgelist))")
    println("   • Power backbone: $(length(power_nodes)) nodes")
    println("   • Clusters: $(length(cluster_centers)) clusters")
    
    return hybrid_edgelist, hybrid_node_mapping, total_nodes
end

function map_hybrid_nodes_to_facilities(total_nodes, drone_nodes_df, hybrid_node_mapping)
    """Map all hybrid network nodes to drone facilities"""
    
    println("🗺️ Mapping $(total_nodes) nodes to drone facilities...")
    
    # Get all available facilities
    hospitals = drone_nodes_df[drone_nodes_df.city_type .== "H", :].numberID
    airports = drone_nodes_df[drone_nodes_df.city_type .== "A", :].numberID
    new_facilities = drone_nodes_df[drone_nodes_df.city_type .== "new", :].numberID
    all_facilities = vcat(hospitals, airports, new_facilities)
    
    # Strategic mapping
    node_to_facility = Dict{Int64, Int64}()
    
    # Map power backbone nodes to major facilities
    power_backbone = get(hybrid_node_mapping, "power_backbone", [])
    major_facilities = vcat(airports[1:min(10, length(airports))], 
                           hospitals[1:min(20, length(hospitals))])
    
    for (i, power_node) in enumerate(sort(power_backbone))
        if i <= length(major_facilities)
            node_to_facility[power_node] = major_facilities[i]
        else
            # Use random facility if we run out of major ones
            node_to_facility[power_node] = rand(all_facilities)
        end
    end
    
    # Map cluster nodes to remaining facilities
    remaining_facilities = setdiff(all_facilities, values(node_to_facility))
    cluster_centers = get(hybrid_node_mapping, "cluster_centers", [])
    
    all_nodes = 1:total_nodes
    remaining_nodes = setdiff(all_nodes, keys(node_to_facility))
    
    # Fill remaining nodes
    for node in remaining_nodes
        if length(remaining_facilities) > 0
            facility = pop!(remaining_facilities)
            node_to_facility[node] = facility
        else
            # Reuse facilities if we run out
            node_to_facility[node] = rand(all_facilities)
        end
    end
    
    println("   Mapped all nodes to drone facilities")
    return node_to_facility
end

function calculate_hybrid_probabilities(hybrid_edgelist, node_to_facility_mapping, 
                                       drone_nodes_df, vtol_matrix, total_nodes)
    """Calculate probabilities based on drone transport capabilities"""
    
    println("🎯 Calculating hybrid network probabilities...")
    
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    # Helper function
    function get_matrix_index(drone_facility_id::Int)
        return findfirst(row -> row.numberID == drone_facility_id, eachrow(drone_nodes_df))
    end
    
    # Set node priors based on facility type
    for node in 1:total_nodes
        facility_id = node_to_facility_mapping[node]
        facility_row = drone_nodes_df[drone_nodes_df.numberID .== facility_id, :][1, :]
        
        if facility_row.city_type == "H"  # Hospital
            if occursin("Royal", facility_row.info) || occursin("University", facility_row.info)
                node_priors[node] = 0.85 + 0.10 * rand()  # Major hospitals: 85-95%
            else
                node_priors[node] = 0.80 + 0.15 * rand()  # Regular hospitals: 80-95%
            end
        elseif facility_row.city_type == "A"  # Airport
            if occursin("International", facility_row.info)
                node_priors[node] = 0.90 + 0.05 * rand()  # Major airports: 90-95%
            else
                node_priors[node] = 0.85 + 0.10 * rand()  # Regional airports: 85-95%
            end
        else  # New facilities
            node_priors[node] = 0.75 + 0.20 * rand()  # New facilities: 75-95%
        end
    end
    
    # Calculate edge probabilities based on drone distances
    for (src_node, dst_node) in hybrid_edgelist
        src_facility = node_to_facility_mapping[src_node]
        dst_facility = node_to_facility_mapping[dst_node]
        
        src_idx = get_matrix_index(src_facility)
        dst_idx = get_matrix_index(dst_facility)
        
        if src_idx === nothing || dst_idx === nothing
            edge_probabilities[(src_node, dst_node)] = 0.75 + 0.15 * rand()
        else
            distance = vtol_matrix[src_idx, dst_idx]
            
            if ismissing(distance) || distance == Inf || !isa(distance, Number) || !isfinite(distance)
                edge_probabilities[(src_node, dst_node)] = 0.70 + 0.20 * rand()
            else
                # Convert distance to probability
                prob = exp(-0.0001 * Float64(distance))
                edge_probabilities[(src_node, dst_node)] = max(0.65, min(0.95, prob))
            end
        end
    end
    
    println("   Calculated probabilities for all nodes and edges")
    return node_priors, edge_probabilities
end

function export_hybrid_network(hybrid_edgelist, node_priors, edge_probabilities, network_name::String,
                               node_to_facility_mapping, drone_nodes_df, hybrid_node_mapping,
                               power_backbone_size, cluster_size)
    """Export the hybrid network"""
    
    output_dir = "dag_ntwrk_files/$network_name"
    mkpath(output_dir)
    mkpath("$output_dir/float")
    
    # EDGES file
    open("$output_dir/$network_name.EDGES", "w") do f
        println(f, "source,destination")
        for (src, dst) in hybrid_edgelist
            println(f, "$src,$dst")
        end
    end
    
    # Node mapping file
    open("$output_dir/$network_name-node-mapping.txt", "w") do f
        println(f, "Hybrid_Node_ID,Drone_Facility_ID,Facility_Name,Node_Type,Latitude,Longitude,Network_Role")
        
        power_backbone = get(hybrid_node_mapping, "power_backbone", [])
        cluster_centers = get(hybrid_node_mapping, "cluster_centers", [])
        
        for (hybrid_node, facility_id) in node_to_facility_mapping
            facility_row = drone_nodes_df[drone_nodes_df.numberID .== facility_id, :][1, :]
            
            network_role = "CLUSTER_NODE"
            if hybrid_node in power_backbone
                network_role = "POWER_BACKBONE"
            end
            if hybrid_node in cluster_centers
                network_role = "CLUSTER_CENTER"
            end
            
            println(f, "$hybrid_node,$facility_id,\"$(facility_row.info)\",$(facility_row.city_type),$(facility_row.lat),$(facility_row.lon),$network_role")
        end
    end
    
    # Network description
    open("$output_dir/$network_name-description.txt", "w") do f
        println(f, "HYBRID POWER-HIERARCHICAL DRONE NETWORK")
        println(f, "========================================")
        println(f, "")
        println(f, "This network combines two proven topologies:")
        println(f, "  • Power backbone: Linear structure from scaled-power-5x")
        println(f, "  • Hierarchical clusters: Dense hub-spoke structures embedded at strategic points")
        println(f, "  • Cross-topology connections: Bridge edges creating new diamond opportunities")
        println(f, "")
        println(f, "Network Architecture:")
        println(f, "  • Total nodes: $(length(node_priors))")
        println(f, "  • Total edges: $(length(hybrid_edgelist))")
        println(f, "  • Power backbone nodes: $power_backbone_size")
        println(f, "  • Cluster centers: $(length(get(hybrid_node_mapping, "cluster_centers", [])))")
        println(f, "  • Hierarchical nodes per cluster: ~$cluster_size")
        println(f, "")
        println(f, "Expected Complexity:")
        println(f, "  • Linear backbone diamonds from power topology")
        println(f, "  • Dense local diamonds from hierarchical clusters") 
        println(f, "  • Cross-topology diamonds from backbone-cluster interactions")
        println(f, "  • Target processing time: 10-60 seconds")
        println(f, "")
        println(f, "This hybrid approach maximizes diamond formation while maintaining")
        println(f, "realistic Scottish drone infrastructure constraints.")
    end
    
    # JSON exports
    node_json = Dict(
        "nodes" => Dict(string(k) => v for (k,v) in node_priors),
        "data_type" => "Float64",
        "serialization" => "compact",
        "description" => "Node probabilities for hybrid power-hierarchical drone network"
    )
    
    edge_json = Dict(
        "links" => Dict("($src,$dst)" => prob for ((src,dst), prob) in edge_probabilities),
        "data_type" => "Float64",
        "serialization" => "compact",
        "description" => "Edge probabilities based on hybrid topology and drone transport capabilities"
    )
    
    json_network_name = replace(network_name, "_" => "-")
    open("$output_dir/float/$json_network_name-nodepriors.json", "w") do f
        JSON.print(f, node_json, 2)
    end
    open("$output_dir/float/$json_network_name-linkprobabilities.json", "w") do f
        JSON.print(f, edge_json, 2)
    end
    
    return network_name
end

# Main execution
create_hybrid_power_hierarchical_network()