"""
Dual Mission Drone Network
Creates a realistic medical supply network using all 244 Scottish facilities
Two overlapping missions with Scale 5x complexity each, connected via shared hubs
"""

using CSV, DataFrames, JSON, Random
using StatsBase: sample

function load_full_drone_network()
    """Load the complete 244-node Scottish drone network"""
    nodes_df = CSV.read("dag_ntwrk_files/drone_info/nodes.csv", DataFrame)
    vtol_matrix = Matrix(CSV.read("dag_ntwrk_files/drone_info/drone1.csv", DataFrame))
    fixed_matrix = Matrix(CSV.read("dag_ntwrk_files/drone_info/drone2.csv", DataFrame))
    
    return (nodes_df, vtol_matrix, fixed_matrix)
end

function create_dual_mission_drone_network()
    """Create a dual-mission network using all 244 nodes with controlled overlap"""
    println("\n🚁🚁 CREATING DUAL MISSION DRONE NETWORK")
    println("="^70)
    
    # Load data
    nodes_df, vtol_matrix, fixed_matrix = load_full_drone_network()
    
    # Categorize facilities by type and region for mission assignment
    categorized_nodes = categorize_for_dual_missions(nodes_df)
    
    # Create dual mission structure
    edgelist, node_priors, edge_probabilities, original_to_dag, mission_assignments = 
        create_dual_mission_structure(nodes_df, vtol_matrix, categorized_nodes)
    
    # Export the network
    network_name = export_dual_mission_network(
        edgelist, node_priors, edge_probabilities, "dual_mission_drone_medical",
        original_to_dag, nodes_df, mission_assignments
    )
    
    println("✅ Created Dual Mission Drone Network!")
    println("   📊 Network Statistics:")
    println("      • Total nodes: $(length(node_priors))")
    println("      • Total edges: $(length(edgelist))")
    println("      • Mission A nodes: $(length(mission_assignments[:mission_a]))")
    println("      • Mission B nodes: $(length(mission_assignments[:mission_b]))")  
    println("      • Shared hubs: $(length(mission_assignments[:shared]))")
    println("   🎯 Expected performance: ~25-35 seconds (vs Scale 5x: 10s)")
    
    return network_name
end

function categorize_for_dual_missions(nodes_df::DataFrame)
    """Categorize 244 nodes for dual mission assignment based on geography and type"""
    
    # Get geographic distribution - split Scotland roughly North/South
    # Use latitude as rough divider (around 56.0 degrees)
    north_threshold = 56.0
    
    # Mission A: Northern Scotland (Highland Emergency Supply → Aberdeen)
    mission_a_candidates = nodes_df[nodes_df.lat .>= north_threshold, :]
    
    # Mission B: Southern Scotland (Central Belt Supply → Edinburgh/Glasgow)  
    mission_b_candidates = nodes_df[nodes_df.lat .< north_threshold, :]
    
    # Shared hubs: Major airports and strategic hospitals (serve both missions)
    shared_candidates = nodes_df[
        (nodes_df.city_type .== "A") .& 
        (occursin.("International", nodes_df.info) .| occursin.("Airport", nodes_df.info)),
    :]
    
    # Select key shared facilities (2-3 major airports)
    shared_nodes = shared_candidates.numberID[1:min(3, nrow(shared_candidates))]
    
    # Remove shared nodes from individual missions to avoid double-assignment
    mission_a_nodes = setdiff(mission_a_candidates.numberID, shared_nodes)
    mission_b_nodes = setdiff(mission_b_candidates.numberID, shared_nodes)
    
    println("📍 Geographic Mission Assignment:")
    println("   Mission A (Northern): $(length(mission_a_nodes)) nodes")
    println("   Mission B (Southern): $(length(mission_b_nodes)) nodes")
    println("   Shared Hubs: $(length(shared_nodes)) nodes")
    
    return (
        mission_a = mission_a_nodes,
        mission_b = mission_b_nodes,
        shared = shared_nodes,
        all_nodes = vcat(mission_a_nodes, mission_b_nodes, shared_nodes)
    )
end

function create_dual_mission_structure(nodes_df, vtol_matrix, categorized_nodes)
    """Create dual mission network with Scale 5x-like complexity for each mission"""
    
    edgelist = Vector{Tuple{Int64, Int64}}()
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    original_to_dag = Dict{Int64, Int64}()
    
    # Create node mapping for all 244 nodes
    dag_node_counter = 1
    all_node_groups = [categorized_nodes.mission_a, categorized_nodes.mission_b, categorized_nodes.shared]
    
    for node_group in all_node_groups
        for orig_id in node_group
            original_to_dag[orig_id] = dag_node_counter
            dag_node_counter += 1
        end
    end
    
    # Set node priors based on facility type
    set_realistic_node_priors!(node_priors, original_to_dag, nodes_df, categorized_nodes)
    
    # Helper functions for connectivity
    function get_matrix_index(node_id::Int)
        return findfirst(row -> row.numberID == node_id, eachrow(nodes_df))
    end
    
    function get_connection_probability(from_id::Int, to_id::Int)
        from_idx = get_matrix_index(from_id)
        to_idx = get_matrix_index(to_id)
        
        if from_idx === nothing || to_idx === nothing
            return 0.75 + 0.15 * rand()
        end
        
        distance = vtol_matrix[from_idx, to_idx]
        
        if ismissing(distance) || distance == Inf || !isa(distance, Number) || !isfinite(distance)
            return 0.65 + 0.20 * rand()
        end
        
        # Convert distance to probability (shorter = more reliable)
        prob = exp(-0.0002 * Float64(distance))  # Adjusted decay for realism
        return max(0.60, min(0.95, prob))
    end
    
    # Create Mission A network (Scale 5x-like structure)
    println("🔗 Creating Mission A (Northern Scotland)...")
    mission_a_edges = create_mission_subnetwork(
        categorized_nodes.mission_a, categorized_nodes.shared, 
        "Aberdeen", original_to_dag, get_connection_probability, nodes_df, "A"
    )
    append!(edgelist, mission_a_edges)
    
    # Create Mission B network (Scale 5x-like structure)  
    println("🔗 Creating Mission B (Central Belt)...")
    mission_b_edges = create_mission_subnetwork(
        categorized_nodes.mission_b, categorized_nodes.shared,
        "Edinburgh", original_to_dag, get_connection_probability, nodes_df, "B"
    )
    append!(edgelist, mission_b_edges)
    
    # Create shared hub connections (controlled overlap)
    println("🔗 Creating shared hub interconnections...")
    shared_edges = create_shared_hub_connections(
        categorized_nodes.shared, categorized_nodes.mission_a, categorized_nodes.mission_b,
        original_to_dag, get_connection_probability
    )
    append!(edgelist, shared_edges)
    
    # Calculate edge probabilities for all edges
    # Create reverse lookup: DAG ID -> Original ID
    dag_to_orig = Dict{Int64, Int64}()
    for (orig_id, dag_id) in original_to_dag
        dag_to_orig[dag_id] = orig_id
    end
    
    for (src, dst) in edgelist
        # Find original IDs from DAG IDs using reverse lookup
        src_orig = dag_to_orig[src]
        dst_orig = dag_to_orig[dst]
        edge_probabilities[(src, dst)] = get_connection_probability(src_orig, dst_orig)
    end
    
    mission_assignments = (
        mission_a = [original_to_dag[id] for id in categorized_nodes.mission_a],
        mission_b = [original_to_dag[id] for id in categorized_nodes.mission_b],
        shared = [original_to_dag[id] for id in categorized_nodes.shared]
    )
    
    return edgelist, node_priors, edge_probabilities, original_to_dag, mission_assignments
end

function create_mission_subnetwork(mission_nodes, shared_nodes, region_name, original_to_dag, get_prob_func, nodes_df, mission_id)
    """Create a Scale 5x-like subnetwork for one mission - ACYCLIC"""
    edges = Vector{Tuple{Int64, Int64}}()
    
    # Divide mission nodes into tiers (simplified hierarchy)
    hospitals = []
    airports = []
    others = []
    
    for orig_id in mission_nodes
        node_row = nodes_df[nodes_df.numberID .== orig_id, :][1, :]
        if node_row.city_type == "H"
            push!(hospitals, orig_id)
        elseif node_row.city_type == "A"
            push!(airports, orig_id)
        else
            push!(others, orig_id)
        end
    end
    
    # Create STRICT 4-TIER HIERARCHY (handle empty collections gracefully)
    tier1_sources = length(hospitals) > 0 ? hospitals[1:min(3, length(hospitals))] : []
    tier2_regional = length(airports) > 0 ? airports[1:min(8, length(airports))] : []
    tier3_local = length(others) > 0 ? others[1:min(15, length(others))] : []
    
    # If any tier is empty, redistribute nodes
    all_available = vcat(hospitals, airports, others)
    used_nodes = vcat(tier1_sources, tier2_regional, tier3_local)
    tier4_destinations = setdiff(mission_nodes, used_nodes)
    
    # Ensure we have sources - if no hospitals, use any available nodes
    if length(tier1_sources) == 0 && length(all_available) > 0
        tier1_sources = all_available[1:min(3, length(all_available))]
        tier4_destinations = setdiff(tier4_destinations, tier1_sources)
    end
    
    # Ensure we have some intermediate nodes
    if length(tier2_regional) == 0 && length(tier4_destinations) > 0
        tier2_regional = tier4_destinations[1:min(5, length(tier4_destinations))]
        tier4_destinations = setdiff(tier4_destinations, tier2_regional)
    end
    
    if length(tier3_local) == 0 && length(tier4_destinations) > 0
        tier3_local = tier4_destinations[1:min(10, length(tier4_destinations))]
        tier4_destinations = setdiff(tier4_destinations, tier3_local)
    end
    
    # STAGE 1: Tier 1 → Tier 2 ONLY (no backward edges)
    if length(tier1_sources) > 0 && length(tier2_regional) > 0
        for src_orig in tier1_sources
            src_dag = original_to_dag[src_orig]
            
            # Each source connects to 2-4 regional nodes (or all available)
            max_connections = min(rand(2:4), length(tier2_regional))
            connected_regional = shuffle(tier2_regional)[1:max_connections]
            for reg_orig in connected_regional
                reg_dag = original_to_dag[reg_orig]
                push!(edges, (src_dag, reg_dag))  # Only src → reg, never reg → src
            end
        end
    end
    
    # STAGE 2: Tier 2 → Tier 3 ONLY
    if length(tier2_regional) > 0 && length(tier3_local) > 0
        for reg_orig in tier2_regional
            reg_dag = original_to_dag[reg_orig]
            
            # Each regional connects to 2-4 local nodes (or all available)
            max_connections = min(rand(2:4), length(tier3_local))
            connected_local = shuffle(tier3_local)[1:max_connections]
            for local_orig in connected_local
                local_dag = original_to_dag[local_orig]
                push!(edges, (reg_dag, local_dag))  # Only reg → local
            end
        end
    end
    
    # STAGE 3: Tier 3 → Tier 4 ONLY  
    if length(tier3_local) > 0 && length(tier4_destinations) > 0
        for local_orig in tier3_local
            local_dag = original_to_dag[local_orig]
            
            # Each local connects to 3-6 final destinations (or all available)
            max_connections = min(rand(3:6), length(tier4_destinations))
            connected_destinations = shuffle(tier4_destinations)[1:max_connections]
            for dest_orig in connected_destinations
                dest_dag = original_to_dag[dest_orig]
                push!(edges, (local_dag, dest_dag))  # Only local → dest
            end
        end
    end
    
    # Ensure all tier 4 destinations are reachable
    for dest_orig in tier4_destinations
        dest_dag = original_to_dag[dest_orig]
        if !any(edge[2] == dest_dag for edge in edges)
            # Connect from a random tier 3 node
            local_orig = rand(tier3_local)
            local_dag = original_to_dag[local_orig]
            push!(edges, (local_dag, dest_dag))
        end
    end
    
    # ACYCLIC SHARED HUB CONNECTIONS: Only Tier 3 → Shared (never backward)
    if mission_id == "A"  # Only Mission A connects TO shared hubs
        for shared_orig in shared_nodes[1:min(2, length(shared_nodes))]
            shared_dag = original_to_dag[shared_orig]
            
            # Select 2-3 tier3 nodes to connect TO shared hub
            selected_tier3 = shuffle(tier3_local)[1:min(3, length(tier3_local))]
            for tier3_orig in selected_tier3
                tier3_dag = original_to_dag[tier3_orig]
                push!(edges, (tier3_dag, shared_dag))  # Mission A → Shared
            end
        end
    end
    
    println("   $(region_name) mission: $(length(tier1_sources)) sources → $(length(tier2_regional)) regional → $(length(tier3_local)) local → $(length(tier4_destinations)) destinations")
    return edges
end

function create_shared_hub_connections(shared_nodes, mission_a_nodes, mission_b_nodes, original_to_dag, get_prob_func)
    """Create ACYCLIC shared hub connections - Shared → Mission B only"""
    edges = Vector{Tuple{Int64, Int64}}()
    
    # ACYCLIC DESIGN: Shared hubs connect TO Mission B destinations only
    # Flow: Mission A → Shared → Mission B (no cycles possible)
    
    for shared_orig in shared_nodes
        shared_dag = original_to_dag[shared_orig]
        
        # Shared hubs connect to Mission B destinations only (never sources)
        # This ensures: Mission A sources → ... → Shared → Mission B destinations
        selected_b_destinations = shuffle(mission_b_nodes)[1:min(5, length(mission_b_nodes))]
        
        for node_orig in selected_b_destinations
            node_dag = original_to_dag[node_orig]
            push!(edges, (shared_dag, node_dag))  # Shared → Mission B
        end
    end
    
    println("   Shared hubs: $(length(shared_nodes)) hubs → Mission B destinations (acyclic flow)")
    return edges
end

function set_realistic_node_priors!(node_priors, original_to_dag, nodes_df, categorized_nodes)
    """Set realistic reliability based on facility types"""
    
    # Set priors based on facility type and role
    for (orig_id, dag_id) in original_to_dag
        node_row = nodes_df[nodes_df.numberID .== orig_id, :][1, :]
        
        if node_row.city_type == "H"  # Hospitals
            if occursin("Royal", node_row.info) || occursin("University", node_row.info)
                node_priors[dag_id] = 0.85 + 0.10 * rand()  # Major hospitals: 85-95%
            else
                node_priors[dag_id] = 0.80 + 0.15 * rand()  # Regular hospitals: 80-95%
            end
        elseif node_row.city_type == "A"  # Airports
            if occursin("International", node_row.info)
                node_priors[dag_id] = 0.90 + 0.05 * rand()  # Major airports: 90-95%
            else
                node_priors[dag_id] = 0.85 + 0.10 * rand()  # Regional airports: 85-95%
            end
        else  # Other facilities
            node_priors[dag_id] = 0.75 + 0.20 * rand()  # Variable: 75-95%
        end
    end
end

function export_dual_mission_network(edgelist, node_priors, edge_probabilities, 
                                   network_name::String, original_to_dag::Dict, nodes_df::DataFrame,
                                   mission_assignments)
    """Export dual mission network with detailed mission documentation"""
    
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
    
    # Enhanced node mapping with mission assignments
    open("$output_dir/$network_name-node-mapping.txt", "w") do f
        println(f, "DAG_Node_ID,Original_Node_ID,Facility_Name,Node_Type,Latitude,Longitude,Mission_Assignment")
        for (orig_id, dag_id) in original_to_dag
            node_row = nodes_df[nodes_df.numberID .== orig_id, :][1, :]
            
            mission_role = "NETWORK"
            if dag_id in mission_assignments.mission_a
                mission_role = "MISSION_A"
            elseif dag_id in mission_assignments.mission_b
                mission_role = "MISSION_B"
            elseif dag_id in mission_assignments.shared
                mission_role = "SHARED_HUB"
            end
            
            println(f, "$dag_id,$orig_id,\"$(node_row.info)\",$(node_row.city_type),$(node_row.lat),$(node_row.lon),$mission_role")
        end
    end
    
    # Mission specification file
    open("$output_dir/$network_name-mission-spec.txt", "w") do f
        println(f, "DUAL MISSION SCOTTISH MEDICAL SUPPLY NETWORK")
        println(f, "==========================================")
        println(f, "")
        println(f, "Mission A: Northern Scotland Emergency Supply")
        println(f, "  Target: Highland and Aberdeen region medical facilities")
        println(f, "  Nodes: $(length(mission_assignments.mission_a)) facilities")
        println(f, "")
        println(f, "Mission B: Central Belt Medical Supply")  
        println(f, "  Target: Glasgow-Edinburgh corridor facilities")
        println(f, "  Nodes: $(length(mission_assignments.mission_b)) facilities")
        println(f, "")
        println(f, "Shared Resources: Strategic Airports & Major Hospitals")
        println(f, "  Nodes: $(length(mission_assignments.shared)) shared hubs")
        println(f, "  Function: Enable cross-mission resource allocation")
        println(f, "")
        println(f, "Network Complexity:")
        println(f, "  • Total nodes: $(length(node_priors))")
        println(f, "  • Total edges: $(length(edgelist))")
        println(f, "  • Expected exact algorithm performance: Intractable")
        println(f, "  • Expected your algorithm performance: ~25-35 seconds")
        println(f, "")
        println(f, "This network demonstrates scalability to full Scottish medical infrastructure")
        println(f, "while maintaining controlled complexity through dual mission architecture.")
    end
    
    # Standard JSON exports
    node_json = Dict(
        "nodes" => Dict(string(k) => v for (k,v) in node_priors),
        "data_type" => "Float64",
        "serialization" => "compact",
        "description" => "Node prior probabilities for dual mission Scottish medical network"
    )
    
    edge_json = Dict(
        "links" => Dict("($src,$dst)" => prob for ((src,dst), prob) in edge_probabilities),
        "data_type" => "Float64",
        "serialization" => "compact", 
        "description" => "Link probabilities based on real drone transport capabilities"
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
create_dual_mission_drone_network()