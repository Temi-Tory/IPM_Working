"""
Scaled Power Network Generator
Creates a larger power network by replicating and connecting the original power network pattern
Maintains the same sparse, mostly-linear structure for tractable exact path enumeration
"""

using JSON, Random

function create_scaled_power_network(scale_factor::Int=3)
    """Create a scaled power network by replicating the original pattern"""
    println("\n⚡ CREATING SCALED POWER NETWORK")
    println("="^70)
    println("Scale factor: $(scale_factor)x")
    
    # Original power network pattern (23 nodes, 28 edges)
    original_edges = [
        (1,2), (2,3), (2,6), (2,10), (3,4), (4,5), (5,13), (6,5),
        (7,8), (8,9), (8,12), (9,10), (10,11), (11,19), (12,11),
        (13,14), (14,21), (15,13), (16,15), (16,17), (17,14), (18,16),
        (19,20), (19,22), (20,21), (21,22), (22,23)
    ]
    
    original_max_node = 23
    
    # Create scaled network
    scaled_edges = Vector{Tuple{Int64, Int64}}()
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    # Replicate the original pattern multiple times
    for replica in 0:(scale_factor-1)
        offset = replica * original_max_node
        
        # Add edges for this replica
        for (src, dst) in original_edges
            scaled_src = src + offset
            scaled_dst = dst + offset
            push!(scaled_edges, (scaled_src, scaled_dst))
            
            # Assign realistic power grid probabilities
            edge_probabilities[(scaled_src, scaled_dst)] = 0.85 + 0.10 * rand()  # 85-95%
        end
        
        # Add node priors for this replica
        for node in 1:original_max_node
            scaled_node = node + offset
            # Power plants/generators have lower reliability, transmission lines higher
            if node <= 8  # Assume first 8 are generation nodes
                node_priors[scaled_node] = 0.75 + 0.15 * rand()  # 75-90%
            else  # Transmission/distribution nodes
                node_priors[scaled_node] = 0.90 + 0.05 * rand()  # 90-95%
            end
        end
    end
    
    # Connect replicas with bridging connections (maintaining sparsity)
    # Each replica connects to the next via 2-3 bridging edges
    for replica in 0:(scale_factor-2)
        current_offset = replica * original_max_node
        next_offset = (replica + 1) * original_max_node
        
        # Bridge connections: select 2-3 nodes from end of current replica to start of next
        # Connect final nodes from current replica to initial nodes of next replica
        bridge_connections = [
            (22 + current_offset, 1 + next_offset),   # Bridge from node 22 to node 1
            (23 + current_offset, 7 + next_offset),   # Bridge from node 23 to node 7
        ]
        
        # Optional third bridge for redundancy
        if rand() > 0.3  # 70% chance of third bridge
            push!(bridge_connections, (21 + current_offset, 15 + next_offset))
        end
        
        for (src, dst) in bridge_connections
            push!(scaled_edges, (src, dst))
            edge_probabilities[(src, dst)] = 0.80 + 0.10 * rand()  # 80-90% (inter-replica slightly less reliable)
        end
        
        println("   Added $(length(bridge_connections)) bridge connections between replica $(replica+1) and $(replica+2)")
    end
    
    total_nodes = scale_factor * original_max_node
    total_edges = length(scaled_edges)
    
    println("✅ Scaled Power Network Created!")
    println("   📊 Network Statistics:")
    println("      • Total nodes: $(total_nodes)")
    println("      • Total edges: $(total_edges)")
    println("      • Nodes:Edges ratio: $(round(total_nodes/total_edges, digits=2)):1")
    println("      • Structure: $(scale_factor) interconnected power grid replicas")
    println("      • Maintains original sparse, mostly-linear topology")
    
    # Export the network
    network_name = export_scaled_power_network(
        scaled_edges, node_priors, edge_probabilities, "scaled-power-network-$(scale_factor)x"
    )
    
    return network_name, total_nodes, total_edges
end

function export_scaled_power_network(edgelist, node_priors, edge_probabilities, network_name::String)
    """Export scaled power network files"""
    
    output_dir = "dag_ntwrk_files/$network_name"
    mkpath(output_dir)
    mkpath("$output_dir/float")
    
    # EDGES file
    open("$output_dir/$network_name.EDGES", "w") do f
        println(f, "source,destination")
        for (src, dst) in edgelist
            println(f, "$src,$dst")
        end
    end
    
    # Network description
    open("$output_dir/$network_name-description.txt", "w") do f
        println(f, "SCALED POWER NETWORK")
        println(f, "===================")
        println(f, "")
        println(f, "This network scales up the original power network pattern while maintaining:")
        println(f, "• Sparse connectivity (similar nodes:edges ratio)")
        println(f, "• Mostly linear topology with minimal diamonds")
        println(f, "• Realistic power grid reliability parameters")
        println(f, "• Tractable for exact path enumeration")
        println(f, "")
        println(f, "Structure: Multiple interconnected replicas of the original 23-node power network")
        println(f, "Node Types:")
        println(f, "  • Generation nodes (1-8 in each replica): 75-90% reliability")
        println(f, "  • Transmission nodes (9-23 in each replica): 90-95% reliability")
        println(f, "Edge Types:")
        println(f, "  • Intra-replica connections: 85-95% reliability")
        println(f, "  • Inter-replica bridges: 80-90% reliability")
    end
    
    # Standard JSON exports
    node_json = Dict(
        "nodes" => Dict(string(k) => v for (k,v) in node_priors),
        "data_type" => "Float64",
        "serialization" => "compact",
        "description" => "Node prior probabilities for scaled power network"
    )
    
    edge_json = Dict(
        "links" => Dict("($src,$dst)" => prob for ((src,dst), prob) in edge_probabilities),
        "data_type" => "Float64",
        "serialization" => "compact", 
        "description" => "Link probabilities for scaled power network connections"
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

# Test different scales
function test_scaled_power_networks()
    """Create multiple scaled versions for testing"""
    scales = [2, 3, 4]  # 2x, 3x, 4x scaling
    
    for scale in scales
        network_name, nodes, edges = create_scaled_power_network(scale)
        println("Created $(network_name): $(nodes) nodes, $(edges) edges")
        println()
    end
end

# Create multiple scales for testing exact algorithm performance
function create_test_scales()
    """Create multiple scaled versions to find the 30min-1hr sweet spot"""
    scales = [5, 8, 12, 15]  # More aggressive scaling
    
    for scale in scales
        network_name, nodes, edges = create_scaled_power_network(scale)
        println("Scale $(scale)x: $(nodes) nodes, $(edges) edges")
        println("Expected exact time: $(scale^2 * 0.4) - $(scale^3 * 0.4) seconds")
        println()
    end
end

# Test different scales to find 30min-1hr target
# create_test_scales()

# Individual scale creation functions
function create_medium_power() 
    create_scaled_power_network(7)  # ~184 nodes - might be 30min range
end

function create_large_power()
    create_scaled_power_network(12) # ~276 nodes - might be 1hr range  
end
