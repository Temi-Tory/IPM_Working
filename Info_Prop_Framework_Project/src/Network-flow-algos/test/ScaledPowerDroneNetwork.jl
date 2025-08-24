"""
Scaled Power Network with Drone Infrastructure
Takes the exact edge topology from scaled-power-network-5x but maps nodes to real Scottish drone facilities
Uses actual drone transport capabilities and facility types for realistic probabilities
"""

using CSV, DataFrames, JSON, Random
using StatsBase: sample

function load_power_network_topology()
    """Load the scaled-power-network-5x edge structure"""
    edges_df = CSV.read("dag_ntwrk_files/scaled-power-network-5x/scaled-power-network-5x.EDGES", DataFrame)
    
    # Get unique nodes from edge list
    all_nodes = sort(unique(vcat(edges_df.source, edges_df.destination)))
    
    # Convert to tuple format
    edgelist = [(row.source, row.destination) for row in eachrow(edges_df)]
    
    return edgelist, all_nodes
end

function load_drone_network_data()
    """Load drone network data for facility mapping"""
    nodes_df = CSV.read("dag_ntwrk_files/drone_info/nodes.csv", DataFrame)
    vtol_matrix = Matrix(CSV.read("dag_ntwrk_files/drone_info/drone1.csv", DataFrame))
    fixed_matrix = Matrix(CSV.read("dag_ntwrk_files/drone_info/drone2.csv", DataFrame))
    
    return nodes_df, vtol_matrix, fixed_matrix
end

function create_scaled_power_drone_network()
    """Create drone network using scaled-power-network topology"""
    println("\n🚁⚡ CREATING SCALED POWER DRONE NETWORK")
    println("="^70)
    
    # Load power network topology
    power_edges, power_nodes = load_power_network_topology()
    println("📊 Loaded power network topology: $(length(power_nodes)) nodes, $(length(power_edges)) edges")
    
    # Load drone data
    drone_nodes_df, vtol_matrix, fixed_matrix = load_drone_network_data()
    println("🚁 Loaded drone network data: $(nrow(drone_nodes_df)) facilities")
    
    # Map power nodes to drone facilities
    drone_mapping = map_power_to_drone_facilities(power_nodes, drone_nodes_df)
    
    # Calculate realistic drone probabilities
    node_priors, edge_probabilities = calculate_drone_probabilities(
        power_edges, drone_mapping, drone_nodes_df, vtol_matrix
    )
    
    # Export the network
    network_name = export_scaled_power_drone_network(
        power_edges, node_priors, edge_probabilities, 
        drone_mapping, drone_nodes_df, "scaled_power_drone_network"
    )
    
    println("✅ Created Scaled Power Drone Network!")
    println("   📊 Network Statistics:")
    println("      • Nodes: $(length(power_nodes)) (mapped from power grid)")
    println("      • Edges: $(length(power_edges)) (same topology)")
    println("      • Drone facilities used: $(length(unique(values(drone_mapping))))")
    println("   🎯 Performance: Same as power network but with realistic drone probabilities")
    
    return network_name
end

function map_power_to_drone_facilities(power_nodes, drone_nodes_df)
    """Map power network nodes to drone facilities strategically"""
    mapping = Dict{Int64, Int64}()
    
    # Categorize drone facilities
    hospitals = drone_nodes_df[drone_nodes_df.city_type .== "H", :].numberID
    airports = drone_nodes_df[drone_nodes_df.city_type .== "A", :].numberID  
    new_facilities = drone_nodes_df[drone_nodes_df.city_type .== "new", :].numberID
    
    # Shuffle for randomization but ensure we have enough facilities
    all_facilities = vcat(hospitals, airports, new_facilities)
    
    if length(all_facilities) < length(power_nodes)
        # If we don't have enough unique facilities, allow reuse
        println("⚠️  Only $(length(all_facilities)) unique facilities for $(length(power_nodes)) nodes")
        println("   📋 Will reuse facilities strategically")
        
        # Use stratified sampling with replacement
        selected_facilities = []
        
        # Ensure key facility types are represented
        major_hospitals = sample(hospitals, min(30, length(hospitals)), replace=false)
        major_airports = sample(airports, min(15, length(airports)), replace=false) 
        other_facilities = sample(new_facilities, min(10, length(new_facilities)), replace=false)
        
        base_facilities = vcat(major_hospitals, major_airports, other_facilities)
        
        # Fill remaining slots with random sampling (allowing reuse)
        remaining_needed = length(power_nodes) - length(base_facilities)
        if remaining_needed > 0
            additional = sample(all_facilities, remaining_needed, replace=true)
            selected_facilities = vcat(base_facilities, additional)
        else
            selected_facilities = base_facilities[1:length(power_nodes)]
        end
    else
        # We have enough facilities - sample without replacement
        selected_facilities = sample(all_facilities, length(power_nodes), replace=false)
    end
    
    # Create mapping
    for (i, power_node) in enumerate(power_nodes)
        mapping[power_node] = selected_facilities[i]
    end
    
    # Report facility distribution
    mapped_hospitals = sum(f in hospitals for f in values(mapping))
    mapped_airports = sum(f in airports for f in values(mapping))  
    mapped_new = sum(f in new_facilities for f in values(mapping))
    
    println("🗺️  Power → Drone Facility Mapping:")
    println("   • Hospitals: $mapped_hospitals nodes")
    println("   • Airports: $mapped_airports nodes") 
    println("   • New facilities: $mapped_new nodes")
    println("   • Total unique facilities used: $(length(unique(values(mapping))))")
    
    return mapping
end

function calculate_drone_probabilities(power_edges, drone_mapping, drone_nodes_df, vtol_matrix)
    """Calculate realistic probabilities based on drone transport capabilities"""
    
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    # Helper function to get matrix index
    function get_matrix_index(drone_facility_id::Int)
        return findfirst(row -> row.numberID == drone_facility_id, eachrow(drone_nodes_df))
    end
    
    # Calculate node priors based on facility type
    println("🎯 Calculating node reliability based on facility types...")
    for (power_node, drone_facility_id) in drone_mapping
        facility_row = drone_nodes_df[drone_nodes_df.numberID .== drone_facility_id, :][1, :]
        
        if facility_row.city_type == "H"  # Hospital
            if occursin("Royal", facility_row.info) || occursin("University", facility_row.info)
                node_priors[power_node] = 0.88 + 0.07 * rand()  # Major hospitals: 88-95%
            else
                node_priors[power_node] = 0.82 + 0.13 * rand()  # Regular hospitals: 82-95%
            end
        elseif facility_row.city_type == "A"  # Airport
            if occursin("International", facility_row.info)
                node_priors[power_node] = 0.92 + 0.03 * rand()  # Major airports: 92-95%
            else
                node_priors[power_node] = 0.87 + 0.08 * rand()  # Regional airports: 87-95%
            end
        else  # New facilities
            node_priors[power_node] = 0.78 + 0.17 * rand()  # New facilities: 78-95%
        end
    end
    
    # Calculate edge probabilities based on drone transport distance
    println("🔗 Calculating edge reliability based on drone transport distances...")
    for (src_power, dst_power) in power_edges
        src_drone = drone_mapping[src_power]
        dst_drone = drone_mapping[dst_power]
        
        src_idx = get_matrix_index(src_drone)
        dst_idx = get_matrix_index(dst_drone)
        
        if src_idx === nothing || dst_idx === nothing
            # Fallback if facility not found
            edge_probabilities[(src_power, dst_power)] = 0.80 + 0.15 * rand()
        else
            distance = vtol_matrix[src_idx, dst_idx]
            
            if ismissing(distance) || distance == Inf || !isa(distance, Number) || !isfinite(distance)
                # No feasible route or invalid distance
                edge_probabilities[(src_power, dst_power)] = 0.75 + 0.15 * rand()
            else
                # Convert distance to probability (shorter = more reliable)
                # Use exponential decay with adjustment for drone capabilities
                prob = exp(-0.0001 * Float64(distance))  # Slower decay than power lines
                
                # Clamp to reasonable range for drone transport
                edge_probabilities[(src_power, dst_power)] = max(0.70, min(0.95, prob))
            end
        end
    end
    
    return node_priors, edge_probabilities
end

function export_scaled_power_drone_network(edgelist, node_priors, edge_probabilities, 
                                         drone_mapping, drone_nodes_df, network_name::String)
    """Export the scaled power drone network"""
    
    output_dir = "dag_ntwrk_files/$network_name"
    mkpath(output_dir)
    mkpath("$output_dir/float")
    
    # EDGES file (same as power network)
    open("$output_dir/$network_name.EDGES", "w") do f
        println(f, "source,destination")
        for (src, dst) in edgelist
            println(f, "$src,$dst")
        end
    end
    
    # Node mapping file
    open("$output_dir/$network_name-node-mapping.txt", "w") do f
        println(f, "Power_Node_ID,Drone_Facility_ID,Facility_Name,Node_Type,Latitude,Longitude")
        for (power_id, drone_id) in sort(collect(drone_mapping), by=x->x[1])
            facility_row = drone_nodes_df[drone_nodes_df.numberID .== drone_id, :][1, :]
            println(f, "$power_id,$drone_id,\"$(facility_row.info)\",$(facility_row.city_type),$(facility_row.lat),$(facility_row.lon)")
        end
    end
    
    # Network description
    open("$output_dir/$network_name-description.txt", "w") do f
        println(f, "SCALED POWER NETWORK WITH DRONE INFRASTRUCTURE")
        println(f, "==============================================")
        println(f, "")
        println(f, "This network uses the exact edge topology from scaled-power-network-5x")
        println(f, "but maps each abstract power node to real Scottish drone facilities.")
        println(f, "")
        println(f, "Network Properties:")
        println(f, "  • Topology: Same as scaled-power-network-5x (proven DAG structure)")
        println(f, "  • Nodes: $(length(node_priors)) power nodes → real drone facilities")
        println(f, "  • Edges: $(length(edgelist)) connections based on power grid topology")
        println(f, "  • Probabilities: Based on actual drone transport capabilities")
        println(f, "")
        println(f, "Facility Distribution:")
        hospitals = sum(row.city_type == "H" for row in eachrow(drone_nodes_df) if row.numberID in values(drone_mapping))
        airports = sum(row.city_type == "A" for row in eachrow(drone_nodes_df) if row.numberID in values(drone_mapping))
        new_facilities = sum(row.city_type == "new" for row in eachrow(drone_nodes_df) if row.numberID in values(drone_mapping))
        println(f, "  • Hospitals (H): $hospitals nodes")
        println(f, "  • Airports (A): $airports nodes")
        println(f, "  • New facilities: $new_facilities nodes")
        println(f, "")
        println(f, "This hybrid approach combines:")
        println(f, "  ✓ Proven tractable topology from power network")
        println(f, "  ✓ Realistic probabilities from drone transport analysis")
        println(f, "  ✓ Real Scottish medical infrastructure")
    end
    
    # JSON exports
    node_json = Dict(
        "nodes" => Dict(string(k) => v for (k,v) in node_priors),
        "data_type" => "Float64", 
        "serialization" => "compact",
        "description" => "Node reliability based on Scottish drone facility capabilities"
    )
    
    edge_json = Dict(
        "links" => Dict("($src,$dst)" => prob for ((src,dst), prob) in edge_probabilities),
        "data_type" => "Float64",
        "serialization" => "compact",
        "description" => "Edge reliability based on drone transport distance analysis"
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
create_scaled_power_drone_network()