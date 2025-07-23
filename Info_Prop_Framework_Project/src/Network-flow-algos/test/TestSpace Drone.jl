
using XLSX, DataFrames, JSON, Random
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics, Dates, CSV
using StatsBase: sample

# Ensure we're running from the project root directory
# Navigate to project root if we're in a subdirectory
current_dir = pwd()
# Force compact output
#Base.IOContext(stdout, :compact => true, :limit => true)
# Include the IPAFramework module
include("../src/IPAFramework.jl")
using .IPAFramework

function load_drone_data_simplified(excel_file::String)
    """Load drone data but create smaller test cases first"""
    
    # Read Excel data
    workbook = XLSX.readxlsx(excel_file)
    
    # Get nodes data  
    nodes_table = XLSX.gettable(workbook["nodes"])
    nodes_df = DataFrame(nodes_table)
    
    # Get matrix data properly
    vtol_table = XLSX.gettable(workbook["feasible_drone_1"], first_row=2)
    vtol_df = DataFrame(vtol_table)
    fixed_table = XLSX.gettable(workbook["feasible_drone_2"], first_row=2) 
    fixed_df = DataFrame(fixed_table)
    
    # Convert to matrices
    vtol_matrix = Matrix(vtol_df)
    fixed_matrix = Matrix(fixed_df)
    
    # Categorize nodes
    hospitals = nodes_df[nodes_df.city_type .== "H", :numberID]
    airports = nodes_df[nodes_df.city_type .== "A", :numberID]  
    hubs = nodes_df[nodes_df.city_type .== "new", :numberID]
    
    return (nodes_df, vtol_matrix, fixed_matrix, hospitals, airports, hubs)
end

function create_simple_mission_dag(nodes_df, vtol_matrix, hospitals, airports, 
                                  source_hospital_idx::Int, dest_hospital_idx::Int)
    """Create a simple mission DAG with 2-3 intermediate airports only"""
    
    # Select just the first 3 airports to limit complexity
    selected_airports = airports[1:min(3, length(airports))]
    
    edgelist = Vector{Tuple{Int64, Int64}}()
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    # Node mapping: 1=source, 2-4=airports, 5=destination
    source_node = 1
    dest_node = 2 + length(selected_airports)
    
    # Set priors
    node_priors[source_node] = 1.0
    node_priors[dest_node] = 1.0
    for i in 1:length(selected_airports)
        node_priors[1 + i] = 1.0
    end
    
    # Add edges with realistic probabilities
    for (i, airport_idx) in enumerate(selected_airports)
        airport_node = 1 + i
        
        # Source → Airport
        vtol_dist = vtol_matrix[source_hospital_idx, airport_idx]
        if !ismissing(vtol_dist) && vtol_dist != "Inf" && isa(vtol_dist, Number) && isfinite(vtol_dist)
            prob = exp(-0.0001 * Float64(vtol_dist))  # Distance-based reliability
            push!(edgelist, (source_node, airport_node))
            edge_probabilities[(source_node, airport_node)] = prob
        end
        
        # Airport → Destination  
        vtol_dist = vtol_matrix[airport_idx, dest_hospital_idx]
        if !ismissing(vtol_dist) && vtol_dist != "Inf" && isa(vtol_dist, Number) && isfinite(vtol_dist)
            prob = exp(-0.0001 * Float64(vtol_dist))
            push!(edgelist, (airport_node, dest_node))
            edge_probabilities[(airport_node, dest_node)] = prob
        end
    end
    
    # Direct route if feasible
    direct_dist = vtol_matrix[source_hospital_idx, dest_hospital_idx]
    if !ismissing(direct_dist) && direct_dist != "Inf" && isa(direct_dist, Number) && isfinite(direct_dist)
        prob = exp(-0.0001 * Float64(direct_dist))
        push!(edgelist, (source_node, dest_node))
        edge_probabilities[(source_node, dest_node)] = prob
    end
    
    return (edgelist, node_priors, edge_probabilities)
end

function export_simple_drone_dag(edgelist, node_priors, edge_probabilities, 
                                network_name::String)
    """Export to your IPAFramework format"""
    
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
    
    # Node priors JSON - match grid-graph format exactly
    node_json = Dict(
        "nodes" => Dict(string(k) => v for (k,v) in node_priors),
        "data_type" => "Float64",
        "serialization" => "compact",
        "description" => "Node prior probabilities for network analysis"
    )
    
    # Edge probabilities JSON - match grid-graph format exactly
    edge_json = Dict(
        "links" => Dict("($src,$dst)" => prob for ((src,dst), prob) in edge_probabilities),
        "data_type" => "Float64",
        "serialization" => "compact", 
        "description" => "Link/edge probabilities for network analysis"
    )
    
    # Convert network_name: underscores to hyphens for JSON files to match framework expectation
    json_network_name = replace(network_name, "_" => "-")
    open("$output_dir/float/$json_network_name-nodepriors.json", "w") do f
        JSON.print(f, node_json, 2)
    end
    open("$output_dir/float/$json_network_name-linkprobabilities.json", "w") do f
        JSON.print(f, edge_json, 2)
    end
    
    println("✅ Exported simple drone DAG: $network_name")
    println("   🔗 $(length(edgelist)) edges")
    println("   🏥 $(length(node_priors)) nodes")
    
    return network_name
end

# Example usage to test your framework:
function test_drone_framework_integration()
    println("🚀 TESTING DRONE NETWORK WITH YOUR FRAMEWORK")
    println("="^50)
    
    # Load drone data
    nodes_df, vtol_matrix, fixed_matrix, hospitals, airports, hubs = 
        load_drone_data_simplified("dag_ntwrk_files/drone_info.xlsx")
    
    # Create simple test case: First hospital → Second hospital
    edgelist, node_priors, edge_probabilities = create_simple_mission_dag(
        nodes_df, vtol_matrix, hospitals, airports, 1, 2
    )
    
    # Export to your framework format
    network_name = export_simple_drone_dag(
        edgelist, node_priors, edge_probabilities, "simple_drone_mission"
    )
    
    println("\n🎯 Now run your framework:")
    println("julia> result = calculateRechability(\"$network_name\")")
    println("julia> mission_success_prob = result[$(maximum(keys(node_priors)))]")
    println("julia> println(\"Mission success probability: \$mission_success_prob\")")
    
    # Create larger emergency supply test
    println("\n📦 Creating emergency supply test (more complex diamonds)...")
    
    # Multi-hospital emergency supply: depot → multiple hospitals via airports
    emergency_edgelist = Vector{Tuple{Int64, Int64}}()
    emergency_priors = Dict{Int64, Float64}()
    emergency_edge_probs = Dict{Tuple{Int64, Int64}, Float64}()
    
    # Nodes: 1=depot, 2-4=airports, 5-7=hospitals
    depot_node = 1
    airport_nodes = [2, 3, 4]
    hospital_nodes = [5, 6, 7]
    
    # Set priors with realistic uncertainties to trigger diamond detection
    emergency_priors[depot_node] = 0.85  # Depot might be damaged/busy - TRIGGERS DIAMONDS!
    for airport in airport_nodes
        emergency_priors[airport] = 1.0   # Airports are reliable
    end
    for hospital in hospital_nodes
        emergency_priors[hospital] = 1.0  # Hospitals are reliable destinations
    end
    
    # Connect depot to airports
    for airport in airport_nodes
        push!(emergency_edgelist, (depot_node, airport))
        emergency_edge_probs[(depot_node, airport)] = 0.9  # High reliability depot→airport
    end
    
    # Connect airports to hospitals (creates diamond structures!)
    for airport in airport_nodes
        for hospital in hospital_nodes
            push!(emergency_edgelist, (airport, hospital))
            emergency_edge_probs[(airport, hospital)] = 0.85  # Good reliability airport→hospital
        end
    end
    
    # Export emergency supply DAG
    emergency_name = export_simple_drone_dag(
        emergency_edgelist, emergency_priors, emergency_edge_probs, "emergency_supply_test"
    )
    
    println("✅ Created emergency supply test with MULTIPLE DIAMONDS!")
    println("   📊 This will test your diamond detection on:")
    println("      • 3 airports (conditioning nodes)")
    println("      • 3 hospitals (multiple join nodes)")  
    println("      • 12 total edges creating complex diamond patterns")
    
    println("\n🧪 Test with your framework:")
    println("julia> result = calculateRechability(\"$emergency_name\")")
    println("julia> # Check probabilities for all hospital nodes")
    println("julia> for hospital_node in [5,6,7]")
    println("julia>     println(\"Hospital \$hospital_node: \$(result[hospital_node])\")")
    println("julia> end")
    
    return (network_name, emergency_name)
end

function create_multi_stage_supply_chain()
    """Create complex multi-stage supply chain with nested diamonds"""
    println("\n🏭 CREATING MULTI-STAGE SUPPLY CHAIN (NESTED DIAMONDS)")
    println("="^60)
    
    # Network structure: 2 Suppliers → 4 Warehouses → 6 Distribution Centers → 10 Hospitals
    edgelist = Vector{Tuple{Int64, Int64}}()
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    # Node allocation
    suppliers = [1, 2]           # 2 suppliers (uncertain reliability)
    warehouses = [3, 4, 5, 6]    # 4 warehouses (intermediate)  
    dist_centers = [7, 8, 9, 10, 11, 12]  # 6 distribution centers
    hospitals = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22]  # 10 hospitals
    
    # Set node priors with realistic uncertainties
    for supplier in suppliers
        node_priors[supplier] = 0.80 + 0.1 * rand()  # 80-90% supplier reliability
    end
    for warehouse in warehouses
        node_priors[warehouse] = 1.0  # Warehouses are destinations, not uncertain
    end
    for dc in dist_centers
        node_priors[dc] = 1.0  # Distribution centers are reliable
    end
    for hospital in hospitals
        node_priors[hospital] = 1.0  # Hospitals are final destinations
    end
    
    # Stage 1: Suppliers → Warehouses (creates first level diamonds)
    for supplier in suppliers
        for warehouse in warehouses
            push!(edgelist, (supplier, warehouse))
            edge_probabilities[(supplier, warehouse)] = 0.88 + 0.07 * rand()  # 88-95% delivery
        end
    end
    
    # Stage 2: Warehouses → Distribution Centers (creates second level diamonds)
    for warehouse in warehouses
        # Each warehouse connects to 3-4 distribution centers
        connected_dcs = sample(dist_centers, 4, replace=false)
        for dc in connected_dcs
            push!(edgelist, (warehouse, dc))
            edge_probabilities[(warehouse, dc)] = 0.85 + 0.1 * rand()  # 85-95% transport
        end
    end
    
    # Stage 3: Distribution Centers → Hospitals (creates third level diamonds)  
    for dc in dist_centers
        # Each DC serves 3-4 hospitals
        connected_hospitals = sample(hospitals, 4, replace=false)
        for hospital in connected_hospitals
            push!(edgelist, (dc, hospital))
            edge_probabilities[(dc, hospital)] = 0.90 + 0.05 * rand()  # 90-95% final delivery
        end
    end
    
    # Export complex supply chain
    network_name = export_simple_drone_dag(
        edgelist, node_priors, edge_probabilities, "multi_stage_supply_chain"
    )
    
    println("✅ Created multi-stage supply chain with NESTED DIAMONDS!")
    println("   📊 Network structure:")
    println("      • 2 suppliers (uncertain reliability: 80-90%)")
    println("      • 4 warehouses → 6 distribution centers → 10 hospitals")
    println("      • $(length(edgelist)) total connections")
    println("      • Expected: 20+ diamonds across 3 stages")
    
    return network_name
end

function create_realistic_failure_scenario()
    """Create realistic mission with weather and equipment failure uncertainties"""
    println("\n⛈️  CREATING REALISTIC FAILURE SCENARIO")
    println("="^50)
    
    # Scenario: Emergency medical supply during storm season
    edgelist = Vector{Tuple{Int64, Int64}}()
    node_priors = Dict{Int64, Float64}()
    edge_probabilities = Dict{Tuple{Int64, Int64}, Float64}()
    
    # Network: 3 Emergency Depots → 5 Forward Bases → 8 Medical Posts
    emergency_depots = [1, 2, 3]      # Weather-affected reliability
    forward_bases = [4, 5, 6, 7, 8]   # Equipment failure risk
    medical_posts = [9, 10, 11, 12, 13, 14, 15, 16]  # Critical destinations
    
    # Weather-affected depot reliability (storm season)
    weather_impact = [0.65, 0.75, 0.70]  # Different weather zones
    for (i, depot) in enumerate(emergency_depots)
        node_priors[depot] = weather_impact[i]
    end
    
    # Equipment failure risks at forward bases
    equipment_reliability = [0.82, 0.78, 0.85, 0.80, 0.77]
    for (i, base) in enumerate(forward_bases)
        node_priors[base] = 1.0  # Bases themselves are reliable (destinations)
    end
    
    for post in medical_posts
        node_priors[post] = 1.0  # Medical posts are critical destinations
    end
    
    # Stage 1: Emergency Depots → Forward Bases
    # Higher failure rates due to weather conditions
    for depot in emergency_depots
        for base in forward_bases
            push!(edgelist, (depot, base))
            # Weather reduces transport reliability
            base_reliability = 0.60 + 0.25 * rand()  # 60-85% in storm conditions
            edge_probabilities[(depot, base)] = base_reliability
        end
    end
    
    # Stage 2: Forward Bases → Medical Posts
    # Equipment failure affects delivery capability
    for (i, base) in enumerate(forward_bases)
        # Each base serves 3-4 medical posts
        connected_posts = sample(medical_posts, 4, replace=false)
        for post in connected_posts
            push!(edgelist, (base, post))
            # Equipment reliability affects final delivery
            delivery_reliability = equipment_reliability[i] * (0.85 + 0.10 * rand())
            edge_probabilities[(base, post)] = min(0.95, delivery_reliability)
        end
    end
    
    # Export realistic failure scenario
    network_name = export_simple_drone_dag(
        edgelist, node_priors, edge_probabilities, "realistic_failure_scenario"
    )
    
    println("✅ Created realistic failure scenario with WEATHER & EQUIPMENT FAILURES!")
    println("   🌧️  Weather impact on depots: 65-75% reliability")
    println("   ⚙️  Equipment failure risks: 77-85% reliability") 
    println("   🏥 $(length(medical_posts)) critical medical posts")
    println("   🔗 $(length(edgelist)) total supply routes")
    println("   📊 Expected: Multiple complex diamonds with uncertain conditioning")
    
    return network_name
end

function test_diamond_rich_scenarios()
    """Test all diamond-rich scenarios and compare performance"""
    println("\n🔬 TESTING DIAMOND-RICH SCENARIOS")
    println("="^70)
    
    scenarios = []
    
    # Test modified emergency supply (uncertain depot)
    println("\n1️⃣  TESTING MODIFIED EMERGENCY SUPPLY (Uncertain Depot)")
    push!(scenarios, ("emergency_supply_test", "Modified emergency supply"))
    
    # Test multi-stage supply chain
    println("\n2️⃣  TESTING MULTI-STAGE SUPPLY CHAIN")
    supply_chain_name = create_multi_stage_supply_chain()
    push!(scenarios, (supply_chain_name, "Multi-stage supply chain"))
    
    # Test realistic failure scenario
    println("\n3️⃣  TESTING REALISTIC FAILURE SCENARIO")
    failure_scenario_name = create_realistic_failure_scenario()
    push!(scenarios, (failure_scenario_name, "Realistic failure scenario"))
    
    println("\n" * "="^70)
    println("🎯 ALL SCENARIOS CREATED - READY FOR FRAMEWORK TESTING!")
    println("📊 Run these commands to test diamond detection:")
    
    for (network_name, description) in scenarios
        println("julia> result = calculateRechability(\"$network_name\")")
        println("       # $description")
    end
    
    return scenarios
end

# Run the basic test first
test_names = test_drone_framework_integration()

# Now create and test diamond-rich scenarios
println("\n" * "="^70)
println("🔷 CREATING DIAMOND-RICH SCENARIOS FOR ADVANCED TESTING")  
println("="^70)

diamond_scenarios = test_diamond_rich_scenarios()

println("\n" * "="^70)
println("🎉 ALL SCENARIOS READY FOR TESTING!")
println("="^70)
println("🔹 Basic scenarios (might have 0 diamonds due to 1.0 priors):")
println("   julia> calculateRechability(\"$(test_names[1])\")")
println("   julia> calculateRechability(\"$(test_names[2])\")")
println("")
println("🔷 DIAMOND-RICH scenarios (should detect diamonds!):")
for (network_name, description) in diamond_scenarios
    println("   julia> calculateRechability(\"$network_name\")  # $description")
end
println("")
println("🎯 Expected results:")
println("   • Modified emergency supply: Should find ~3 diamonds (depot = 0.85)")
println("   • Multi-stage supply chain: Should find 20+ diamonds (suppliers = 0.8-0.9)")
println("   • Realistic failure scenario: Should find 10+ diamonds (weather/equipment failures)")
println("="^70)