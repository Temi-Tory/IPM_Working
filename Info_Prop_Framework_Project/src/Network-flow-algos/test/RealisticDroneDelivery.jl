using CSV, DataFrames, JSON, Random
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics, Dates
using StatsBase: sample

"""
    REALISTIC DRONE DELIVERY SCENARIOS
    Using the actual 244-node Scottish drone network infrastructure

    This creates practical drone delivery scenarios based on:
    - Real hospital locations (69 hospitals)
    - Actual airport positions (19 airports) 
    - Strategic hub placements (15 hubs)
    - Geographic constraints and distances
"""

function load_real_drone_network()
    """Load the complete 244-node real drone network from CSV files"""
    
    # Load nodes data
    nodes_df = CSV.read("dag_ntwrk_files/drone_info/nodes.csv", DataFrame)
    
    # Load distance matrices 
    vtol_df = CSV.read("dag_ntwrk_files/drone_info/drone1.csv", DataFrame)
    fixed_df = CSV.read("dag_ntwrk_files/drone_info/drone2.csv", DataFrame)
    
    
    # Convert to matrices - keep ALL columns 
    vtol_matrix = Matrix(vtol_df)
    fixed_matrix = Matrix(fixed_df)
    
    # Categorize nodes by type
    hospitals = nodes_df[nodes_df.city_type .== "H", :numberID]
    airports = nodes_df[nodes_df.city_type .== "A", :numberID]  
    hubs = nodes_df[nodes_df.city_type .== "new", :numberID]
    
    # CRITICAL UNDERSTANDING: 
    # - nodes.csv has 244 rows with numberIDs: 1, 2, 6, 10, 15, 16, 18, 20, 21, 22...
    # - distance matrix has 244 rows × 244 columns 
    # - Matrix[i,j] = distance from node at position i to node at position j
    # - Positions are 1-244 (sequential), not numberID values!
    numberid_to_row = Dict(nodes_df.numberID[i] => i for i in 1:nrow(nodes_df))
    
    println("✅ Loaded Real Drone Network:")
    println("   📊 Total nodes: $(nrow(nodes_df))")
    println("   🏥 Hospitals: $(length(hospitals))")
    println("   ✈️  Airports: $(length(airports))")
    println("   🏭 Hubs: $(length(hubs))")
    println("   📐 Matrix dimensions: $(size(vtol_matrix))")
    println("   🔗 NumberID range: $(minimum(nodes_df.numberID)) to $(maximum(nodes_df.numberID))")
    
    return (nodes_df, vtol_matrix, fixed_matrix, hospitals, airports, hubs, numberid_to_row)
end

function create_emergency_medical_delivery(nodes_df, vtol_matrix, hospitals, airports, hubs, numberid_to_row)
    """
    SCENARIO 1: National Emergency Medical Distribution Network
    
    Real-world case: COVID-19 vaccine distribution across ALL of Scotland
    - Sources: 5 Major hospitals with cold storage capabilities
    - Hubs: ALL 18 airports for comprehensive distribution
    - Destinations: 50+ hospitals across Scotland (urban, rural, islands)
    - Creates massive diamond structures with multiple redundant paths
    """
    
    # Major supply hospitals (cold storage capabilities)
    source_hospitals = [22, 20, 61, 148, 1]  # Aberdeen Royal, QEUH, Edinburgh Royal, Glasgow Royal, Crosshouse
    
    # ALL airports for maximum distribution coverage
    distribution_airports = airports[1:min(18, length(airports))]  # Use all available airports
    
    # Large selection of destination hospitals (urban + rural + islands)
    target_hospitals = [
        # Islands and remote
        68, 63, 79, 28, 195, 199, 289, 207, 208, 209, 214, 216,
        # Highland hospitals  
        201, 202, 203, 204, 205, 206, 210, 211, 212, 215,
        # Central belt hospitals
        85, 59, 18, 76, 135, 136, 137, 138, 139, 141,
        # Border hospitals
        101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
        # Southwest hospitals
        111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127
    ]
    
    edgelist = Vector{Tuple{Int64, Int64}}()
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    # COMPLEX NODE MAPPING: 5 sources + 18 airports + 57 destinations = 80 nodes total
    dag_nodes = Dict()
    dag_nodes[:sources] = collect(1:length(source_hospitals))
    dag_nodes[:airports] = collect((length(source_hospitals)+1):(length(source_hospitals)+length(distribution_airports)))
    dag_nodes[:destinations] = collect((length(source_hospitals)+length(distribution_airports)+1):(length(source_hospitals)+length(distribution_airports)+length(target_hospitals)))
    
    total_nodes = length(source_hospitals) + length(distribution_airports) + length(target_hospitals)
    println("   📊 Creating large-scale network: $total_nodes nodes")
    
    # Set node priors with supply chain uncertainties
    for i in dag_nodes[:sources]
        node_priors[i] = 0.75 + 0.15 * rand()  # 75-90% supply reliability
    end
    for i in dag_nodes[:airports]
        node_priors[i] = 1.0  # Airports are infrastructure
    end
    for i in dag_nodes[:destinations]
        node_priors[i] = 1.0  # Destination hospitals
    end
    
    # TIER 1: All sources → All airports (creates massive diamond structure)
    for (i, source_id) in enumerate(source_hospitals)
        for (j, airport_id) in enumerate(distribution_airports)
            if source_id in keys(numberid_to_row) && airport_id in keys(numberid_to_row)
                dag_source = dag_nodes[:sources][i]
                dag_airport = dag_nodes[:airports][j]
                
                src_idx = numberid_to_row[source_id]
                dst_idx = numberid_to_row[airport_id]
                
                if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                    # Distance-based reliability with weather uncertainty
                    distance = vtol_matrix[src_idx, dst_idx]
                    base_reliability = max(0.6, 0.95 - distance/10000)  # Further = less reliable
                    weather_factor = 0.85 + 0.15 * rand()  # Weather variability
                    reliability = min(0.95, base_reliability * weather_factor)
                    
                    push!(edgelist, (dag_source, dag_airport))
                    edge_probabilities[(dag_source, dag_airport)] = reliability
                end
            end
        end
    end
    
    # TIER 2: All airports → All reachable destinations (creates second diamond level)
    for (i, airport_id) in enumerate(distribution_airports)
        for (j, hospital_id) in enumerate(target_hospitals)
            if airport_id in keys(numberid_to_row) && hospital_id in keys(numberid_to_row)
                dag_airport = dag_nodes[:airports][i]
                dag_hospital = dag_nodes[:destinations][j]
                
                src_idx = numberid_to_row[airport_id]
                dst_idx = numberid_to_row[hospital_id]
                
                if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                    # Final delivery with terrain and weather challenges
                    distance = vtol_matrix[src_idx, dst_idx]
                    base_reliability = max(0.5, 0.9 - distance/8000)  # Challenging final delivery
                    terrain_factor = 0.8 + 0.2 * rand()  # Terrain variability
                    reliability = min(0.95, base_reliability * terrain_factor)
                    
                    push!(edgelist, (dag_airport, dag_hospital))
                    edge_probabilities[(dag_airport, dag_hospital)] = reliability
                end
            end
        end
    end
    
    return (edgelist, node_priors, edge_probabilities, "national_emergency_medical_network")
end

function create_offshore_supply_mission(nodes_df, vtol_matrix, hospitals, airports, hubs, numberid_to_row)
    """
    SCENARIO 2: Complete Scottish Islands Supply Network
    
    Real-world case: Comprehensive supply delivery to ALL Scottish islands
    - Sources: 10 major mainland hospitals across Scotland
    - Hubs: All available island airports and mainland coastal airports  
    - Transfer: All strategic hubs for island distribution
    - Destinations: Every island hospital, clinic, and healthcare facility
    - Creates complex multi-tier diamond structures
    """
    
    # Major mainland supply hospitals (geographic distribution)
    mainland_hospitals = [
        1, 20, 61, 148, 22,      # Major: Crosshouse, QEUH, Edinburgh, Glasgow Royal, Aberdeen
        85, 59, 18, 76, 28,      # Regional: Paisley, Monklands, Forth Valley, Ninewells, Raigmore
        135, 10, 15, 268, 233    # Strategic: Queen Margaret, Dumfries, Victoria, Perth, Wishaw
    ]
    
    # ALL island and coastal airports
    island_airports = [31, 32, 33, 81, 82, 80, 64, 69, 30, 16, 29, 23, 21, 62, 2, 87]
    
    # Strategic hubs (including new distribution points)
    strategic_hubs = hubs  # Use all available hubs
    
    # ALL island and remote hospitals/clinics  
    island_destinations = [
        # Islands
        195, 199, 289, 79, 68, 63, 214, 216, 288,
        # Remote coastal
        207, 208, 209, 193, 194, 196, 197, 198,
        # Highland remote
        176, 177, 182, 183, 184, 186, 187, 188, 189, 200, 201, 202, 203, 204, 205, 206, 210, 211, 212, 215,
        # Southwest coastal
        90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 111, 114, 118, 121, 124
    ]
    
    
    edgelist = Vector{Tuple{Int64, Int64}}()
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    # COMPLEX 4-TIER NODE MAPPING
    dag_nodes = Dict()
    dag_nodes[:sources] = collect(1:length(mainland_hospitals))
    dag_nodes[:airports] = collect((length(mainland_hospitals)+1):(length(mainland_hospitals)+length(island_airports)))
    dag_nodes[:hubs] = collect((length(mainland_hospitals)+length(island_airports)+1):(length(mainland_hospitals)+length(island_airports)+length(strategic_hubs)))
    dag_nodes[:destinations] = collect((length(mainland_hospitals)+length(island_airports)+length(strategic_hubs)+1):(length(mainland_hospitals)+length(island_airports)+length(strategic_hubs)+length(island_destinations)))
    
    total_nodes = length(mainland_hospitals) + length(island_airports) + length(strategic_hubs) + length(island_destinations)
    println("   📊 Creating comprehensive islands network: $total_nodes nodes across 4 tiers")
    
    # Set complex node priors
    for i in dag_nodes[:sources]
        node_priors[i] = 0.80 + 0.15 * rand()  # 80-95% mainland supply reliability
    end
    for i in dag_nodes[:airports]
        node_priors[i] = 1.0  # Airports are infrastructure
    end 
    for i in dag_nodes[:hubs]
        node_priors[i] = 1.0  # Hubs are infrastructure
    end
    for i in dag_nodes[:destinations]
        node_priors[i] = 1.0  # Island destinations
    end
    
    # TIER 1: Mainland hospitals → Island/coastal airports (creates first diamond layer)
    for (i, hospital_id) in enumerate(mainland_hospitals)
        for (j, airport_id) in enumerate(island_airports)
            if hospital_id in keys(numberid_to_row) && airport_id in keys(numberid_to_row)
                dag_source = dag_nodes[:sources][i]
                dag_airport = dag_nodes[:airports][j]
                
                src_idx = numberid_to_row[hospital_id]
                dst_idx = numberid_to_row[airport_id]
                
                if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                    # Sea crossing weather challenges
                    distance = vtol_matrix[src_idx, dst_idx]
                    base_reliability = max(0.5, 0.85 - distance/15000)  # Long sea crossings are challenging
                    weather_factor = 0.75 + 0.25 * rand()  # Severe weather variability over water
                    reliability = min(0.92, base_reliability * weather_factor)
                    
                    push!(edgelist, (dag_source, dag_airport))
                    edge_probabilities[(dag_source, dag_airport)] = reliability
                end
            end
        end
    end
    
    # TIER 2: Airports → Strategic hubs (creates second diamond layer) 
    for (i, airport_id) in enumerate(island_airports)
        for (j, hub_id) in enumerate(strategic_hubs)
            if airport_id in keys(numberid_to_row) && hub_id in keys(numberid_to_row)
                dag_airport = dag_nodes[:airports][i]
                dag_hub = dag_nodes[:hubs][j]
                
                src_idx = numberid_to_row[airport_id]
                dst_idx = numberid_to_row[hub_id]
                
                if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                    # Inter-island distribution
                    distance = vtol_matrix[src_idx, dst_idx]
                    base_reliability = max(0.65, 0.9 - distance/12000)
                    terrain_factor = 0.85 + 0.15 * rand()  # Island terrain challenges
                    reliability = min(0.95, base_reliability * terrain_factor)
                    
                    push!(edgelist, (dag_airport, dag_hub))
                    edge_probabilities[(dag_airport, dag_hub)] = reliability
                end
            end
        end
    end
    
    # TIER 3: Hubs → Island destinations (creates third diamond layer)
    for (i, hub_id) in enumerate(strategic_hubs)
        for (j, destination_id) in enumerate(island_destinations)
            if hub_id in keys(numberid_to_row) && destination_id in keys(numberid_to_row)
                dag_hub = dag_nodes[:hubs][i]
                dag_destination = dag_nodes[:destinations][j]
                
                src_idx = numberid_to_row[hub_id]
                dst_idx = numberid_to_row[destination_id]
                
                if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                    # Final delivery to remote locations
                    distance = vtol_matrix[src_idx, dst_idx]
                    base_reliability = max(0.7, 0.95 - distance/8000)  # Short final hops
                    local_factor = 0.88 + 0.12 * rand()  # Local conditions
                    reliability = min(0.98, base_reliability * local_factor)
                    
                    push!(edgelist, (dag_hub, dag_destination))
                    edge_probabilities[(dag_hub, dag_destination)] = reliability
                end
            end
        end
    end
    
    # BONUS TIER: Direct airport → destination connections (bypassing hubs)
    for (i, airport_id) in enumerate(island_airports)
        for (j, destination_id) in enumerate(island_destinations)
            if airport_id in keys(numberid_to_row) && destination_id in keys(numberid_to_row)
                dag_airport = dag_nodes[:airports][i]
                dag_destination = dag_nodes[:destinations][j]
                
                src_idx = numberid_to_row[airport_id]
                dst_idx = numberid_to_row[destination_id]
                
                if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                    distance = vtol_matrix[src_idx, dst_idx]
                    # Direct routes are faster but less reliable
                    if distance < 5000  # Only for nearby destinations
                        base_reliability = max(0.6, 0.85 - distance/6000)
                        direct_factor = 0.75 + 0.15 * rand()  # Direct delivery uncertainty
                        reliability = min(0.90, base_reliability * direct_factor)
                        
                        push!(edgelist, (dag_airport, dag_destination))
                        edge_probabilities[(dag_airport, dag_destination)] = reliability
                    end
                end
            end
        end
    end
    
    return (edgelist, node_priors, edge_probabilities, "comprehensive_islands_supply_network")
end

function create_central_belt_distribution(nodes_df, vtol_matrix, hospitals, airports, hubs, numberid_to_row)
    """
    SCENARIO 3: Central Belt High-Volume Distribution
    
    Real-world case: Routine medical supply distribution in populous Central Belt
    - Uses real hospital network in Glasgow/Edinburgh corridor
    - Multiple redundant paths
    - High reliability requirements
    """
    
    # Central Belt major hospitals and airports
    supply_depots = [20, 61, 148]  # QEUH, Edinburgh Royal, Glasgow Royal
    transfer_airports = [21, 62]   # Glasgow International, Edinburgh Airport
    distribution_hubs = [41, 44, 53]  # Strategic new hubs
    target_hospitals = [85, 59, 18, 76, 135]  # Regional hospitals
    
    edgelist = Vector{Tuple{Int64, Int64}}()
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    # Complex multi-tier network
    dag_nodes = Dict()
    dag_nodes[:depots] = collect(1:3)
    dag_nodes[:airports] = collect(4:5)
    dag_nodes[:hubs] = collect(6:8)
    dag_nodes[:hospitals] = collect(9:13)
    
    # High reliability urban network
    for i in dag_nodes[:depots]
        node_priors[i] = 0.90 + 0.05 * rand()  # 90-95% depot reliability
    end
    for i in dag_nodes[:airports]
        node_priors[i] = 1.0
    end
    for i in dag_nodes[:hubs]
        node_priors[i] = 1.0
    end
    for i in dag_nodes[:hospitals]
        node_priors[i] = 1.0
    end
    
    # Create multi-tier diamond structures
    # Tier 1: Depots → Airports
    for (i, depot_id) in enumerate(supply_depots)
        for (j, airport_id) in enumerate(transfer_airports)
            dag_depot = dag_nodes[:depots][i]
            dag_airport = dag_nodes[:airports][j]
            
            src_idx = numberid_to_row[depot_id]
            dst_idx = numberid_to_row[airport_id]
            
            if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                # Urban logistics - high reliability
                reliability = 0.88 + 0.07 * rand()  # 88-95%
                push!(edgelist, (dag_depot, dag_airport))
                edge_probabilities[(dag_depot, dag_airport)] = reliability
            end
        end
    end
    
    # Tier 2: Airports → Hubs
    for (i, airport_id) in enumerate(transfer_airports)
        for (j, hub_id) in enumerate(distribution_hubs)
            dag_airport = dag_nodes[:airports][i]
            dag_hub = dag_nodes[:hubs][j]
            
            src_idx = numberid_to_row[airport_id]
            dst_idx = numberid_to_row[hub_id]
            
            if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                reliability = 0.85 + 0.10 * rand()  # 85-95%
                push!(edgelist, (dag_airport, dag_hub))
                edge_probabilities[(dag_airport, dag_hub)] = reliability
            end
        end
    end
    
    # Tier 3: Hubs → Hospitals
    for (i, hub_id) in enumerate(distribution_hubs)
        for (j, hospital_id) in enumerate(target_hospitals)
            dag_hub = dag_nodes[:hubs][i]
            dag_hospital = dag_nodes[:hospitals][j]
            
            src_idx = numberid_to_row[hub_id]
            dst_idx = numberid_to_row[hospital_id]
            
            if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                reliability = 0.90 + 0.05 * rand()  # 90-95% final delivery
                push!(edgelist, (dag_hub, dag_hospital))
                edge_probabilities[(dag_hub, dag_hospital)] = reliability
            end
        end
    end
    
    return (edgelist, node_priors, edge_probabilities, "central_belt_distribution")
end

function create_highlands_emergency_network(nodes_df, vtol_matrix, hospitals, airports, hubs, numberid_to_row)
    """
    SCENARIO 4: Highlands Emergency Response Network
    
    Real-world case: Emergency medical response in Scottish Highlands
    - Challenging terrain and weather
    - Critical time constraints
    - Multiple redundant paths essential
    """
    
    # Highland locations
    emergency_bases = [28, 204]  # Raigmore Hospital, RNI Community Hospital
    highland_airports = [29, 30]  # Inverness, Wick
    remote_hospitals = [201, 202, 203, 205, 207, 208]  # Remote Highland hospitals
    
    edgelist = Vector{Tuple{Int64, Int64}}()
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    dag_nodes = Dict()
    dag_nodes[:bases] = collect(1:2)
    dag_nodes[:airports] = collect(3:4)  
    dag_nodes[:remote] = collect(5:10)
    
    # Emergency response uncertainties
    for i in dag_nodes[:bases]
        node_priors[i] = 0.75 + 0.15 * rand()  # 75-90% base readiness
    end
    for i in dag_nodes[:airports]
        node_priors[i] = 1.0
    end
    for i in dag_nodes[:remote]
        node_priors[i] = 1.0
    end
    
    # Emergency base to airports
    for (i, base_id) in enumerate(emergency_bases)
        for (j, airport_id) in enumerate(highland_airports)
            dag_base = dag_nodes[:bases][i]
            dag_airport = dag_nodes[:airports][j]
            
            src_idx = numberid_to_row[base_id]
            dst_idx = numberid_to_row[airport_id]
            
            if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                # Highland weather challenges
                reliability = 0.65 + 0.20 * rand()  # 65-85% (weather dependent)
                push!(edgelist, (dag_base, dag_airport))
                edge_probabilities[(dag_base, dag_airport)] = reliability
            end
        end
    end
    
    # Airports to remote locations
    for (i, airport_id) in enumerate(highland_airports)
        for (j, hospital_id) in enumerate(remote_hospitals)
            dag_airport = dag_nodes[:airports][i]
            dag_remote = dag_nodes[:remote][j]
            
            if hospital_id in keys(numberid_to_row)
                src_idx = numberid_to_row[airport_id]
                dst_idx = numberid_to_row[hospital_id]
                
                if vtol_matrix[src_idx, dst_idx] != Inf && !ismissing(vtol_matrix[src_idx, dst_idx])
                    # Remote delivery challenges
                    reliability = 0.70 + 0.20 * rand()  # 70-90% (terrain/weather)
                    push!(edgelist, (dag_airport, dag_remote))
                    edge_probabilities[(dag_airport, dag_remote)] = reliability
                end
            end
        end
    end
    
    return (edgelist, node_priors, edge_probabilities, "highlands_emergency_network")
end

function export_realistic_drone_dag(edgelist, node_priors, edge_probabilities, network_name::String)
    """Export realistic drone network to IPAFramework format"""
    
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
    
    # Node priors JSON
    node_json = Dict(
        "nodes" => Dict(string(k) => v for (k,v) in node_priors),
        "data_type" => "Float64",
        "serialization" => "compact",
        "description" => "Realistic drone network node priors"
    )
    
    # Edge probabilities JSON
    edge_json = Dict(
        "links" => Dict("($src,$dst)" => prob for ((src,dst), prob) in edge_probabilities),
        "data_type" => "Float64",
        "serialization" => "compact", 
        "description" => "Realistic drone network link probabilities"
    )
    
    json_network_name = replace(network_name, "_" => "-")
    open("$output_dir/float/$json_network_name-nodepriors.json", "w") do f
        JSON.print(f, node_json, 2)
    end
    open("$output_dir/float/$json_network_name-linkprobabilities.json", "w") do f
        JSON.print(f, edge_json, 2)
    end
    
    println("✅ Exported realistic drone network: $network_name")
    println("   🔗 $(length(edgelist)) edges")
    println("   📍 $(length(node_priors)) nodes")
    println("   🔄 Complex diamond structures using real geography")
    
    return network_name
end

function create_all_realistic_scenarios()
    """Create all realistic drone delivery scenarios using actual Scottish infrastructure"""
    
    println("🏴󠁧󠁢󠁳󠁣󠁴󠁿 CREATING REALISTIC SCOTTISH DRONE DELIVERY SCENARIOS")
    println("="^80)
    
    # Load real network
    nodes_df, vtol_matrix, fixed_matrix, hospitals, airports, hubs, numberid_to_row = load_real_drone_network()
    
    scenarios = []
    
    # Scenario 1: National Emergency Medical Network
    println("\n🚑 SCENARIO 1: National Emergency Medical Distribution Network")
    edgelist1, priors1, probs1, name1 = create_emergency_medical_delivery(
        nodes_df, vtol_matrix, hospitals, airports, hubs, numberid_to_row)
    network1 = export_realistic_drone_dag(edgelist1, priors1, probs1, name1)
    push!(scenarios, (network1, "National emergency medical distribution across Scotland"))
    
    # Scenario 2: Comprehensive Islands Supply Network  
    println("\n🏝️ SCENARIO 2: Comprehensive Scottish Islands Supply Network")
    edgelist2, priors2, probs2, name2 = create_offshore_supply_mission(
        nodes_df, vtol_matrix, hospitals, airports, hubs, numberid_to_row)
    network2 = export_realistic_drone_dag(edgelist2, priors2, probs2, name2)
    push!(scenarios, (network2, "Comprehensive supply delivery to all Scottish islands"))
    
    # Scenario 3: Central Belt Distribution
    println("\n🏙️ SCENARIO 3: Central Belt High-Volume Distribution")
    edgelist3, priors3, probs3, name3 = create_central_belt_distribution(
        nodes_df, vtol_matrix, hospitals, airports, hubs, numberid_to_row)
    network3 = export_realistic_drone_dag(edgelist3, priors3, probs3, name3)
    push!(scenarios, (network3, "High-volume distribution in urban Central Belt"))
    
    # Scenario 4: Highlands Emergency Network
    println("\n⛰️ SCENARIO 4: Highlands Emergency Response Network")
    edgelist4, priors4, probs4, name4 = create_highlands_emergency_network(
        nodes_df, vtol_matrix, hospitals, airports, hubs, numberid_to_row)
    network4 = export_realistic_drone_dag(edgelist4, priors4, probs4, name4)
    push!(scenarios, (network4, "Emergency response in challenging Highland terrain"))
    
    println("\n" * "="^80)
    println("🎯 REALISTIC SCOTTISH DRONE SCENARIOS READY!")
    println("="^80)
    println("📊 All scenarios use:")
    println("   • Real hospital locations and capabilities")
    println("   • Actual airport infrastructure")
    println("   • Geographic distance constraints")
    println("   • Weather and terrain uncertainties")
    println("   • Complex diamond structures from real-world connectivity")
    println()
    println("🔬 Test with your framework:")
    
    for (network_name, description) in scenarios
        println("julia> result = calculateRechability(\"$network_name\")")
        println("       # $description")
    end
    
    println()
    println("🌟 Key advantages over artificial networks:")
    println("   • Uses actual Scottish healthcare infrastructure")
    println("   • Reflects real operational constraints")
    println("   • Models genuine supply chain challenges")
    println("   • Creates realistic diamond patterns from geography")
    println("   • Demonstrates practical drone delivery optimization")
    
    return scenarios
end

# Execute the realistic scenario creation
realistic_scenarios = create_all_realistic_scenarios()