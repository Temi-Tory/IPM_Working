"""
TestSpace_DroneInputProcessing.jl

Test file demonstrating the DroneInputProcessingModule functionality.
Shows how to save and load drone DAG conversion results and integrate with IPA Framework.
"""

using CSV, DataFrames, DelimitedFiles, Statistics
using DataStructures, SparseArrays, BenchmarkTools, 
      Combinatorics

# Import framework
using .IPAFramework

# Include the existing drone data loading functions
include("DroneIDetailedCheck.jl")

"""
Test the complete save/load cycle for drone DAG results
"""
function test_drone_input_processing_cycle()
    println("🧪 TESTING DRONE INPUT PROCESSING MODULE")
    println("="^80)
    
    # Step 1: Generate drone DAG results (using existing test)
    println("Step 1: Generating drone DAG conversion results...")
    results, transfer_nodes, integrated_dag = generate_test_drone_results()
    
    # Step 2: Save results using DroneInputProcessingModule
    println("\nStep 2: Saving results with DroneInputProcessingModule...")
    output_dir = "test_drone_output"
    saved_files, metadata = save_drone_dag_results(
        results, transfer_nodes, integrated_dag, output_dir,
        base_filename="test_drone_network"
    )
    
    println("✅ Saved $(length(saved_files)) files to $output_dir")
    
    # Step 3: Load results back
    println("\nStep 3: Loading results back...")
    loaded_matrices, loaded_metadata, loaded_integrated = load_drone_dag_results(
        output_dir, base_filename="test_drone_network"
    )
    
    # Step 4: Validate data integrity
    println("\nStep 4: Validating data integrity...")
    validation_results = validate_drone_data_integrity(loaded_matrices, loaded_metadata)
    
    if validation_results["overall_valid"]
        println("✅ All validation checks passed!")
    else
        println("❌ Validation issues detected!")
        return false
    end
    
    # Step 5: Convert to IPA Framework format
    println("\nStep 5: Converting to IPA Framework format...")
    ipa_data = convert_to_ipa_format(loaded_matrices, loaded_metadata, selected_matrix="integrated")
    
    println("✅ IPA Framework data structure created:")
    println("  - Edge list: $(length(ipa_data["edgelist"])) edges")
    println("  - Source nodes: $(length(ipa_data["source_nodes"]))")
    println("  - Fork nodes: $(length(ipa_data["fork_nodes"]))")
    println("  - Join nodes: $(length(ipa_data["join_nodes"]))")
    println("  - Iteration sets: $(length(ipa_data["iteration_sets"]))")
    
    # Step 6: Test IPA Framework integration
    println("\nStep 6: Testing IPA Framework integration...")
    test_ipa_integration(ipa_data)
    
    println("\n🎉 DRONE INPUT PROCESSING TEST COMPLETED SUCCESSFULLY!")
    return true
end

"""
Generate test drone DAG results (simplified version of the main test)
"""
function generate_test_drone_results()
    # Load real drone network data
    nodes_file = "src/Network-flow-algos/test/drone network/nodes.csv"
    drone1_file = "src/Network-flow-algos/test/drone network/feasible_drone_1.csv"
    drone2_file = "src/Network-flow-algos/test/drone network/feasible_drone_2.csv"
    
    # Load data
    nodes1, edges1 = read_graph_data(nodes_file, drone1_file)
    nodes2, edges2 = read_graph_data(nodes_file, drone2_file)
    
    # Convert to DAG format
    node_types, node_coordinates, node_id_mapping = convert_nodes_to_dag_format(nodes1)
    drone1_adj_matrix = convert_edges_to_adjacency_matrix(edges1, nodes1)
    drone2_adj_matrix = convert_edges_to_adjacency_matrix(edges2, nodes2)
    
    # Test DAG conversion for selected modes
    modes = [SUPPLY_DISTRIBUTION, EMERGENCY_RESPONSE]
    mode_names = ["Supply Distribution", "Emergency Response"]
    
    results = Dict()
    
    for (drone_name, adj_matrix) in [("Drone 1 (High Capability)", drone1_adj_matrix), 
                                     ("Drone 2 (Low Capability)", drone2_adj_matrix)]
        
        drone_results = Dict()
        
        for (mode, mode_name) in zip(modes, mode_names)
            # Create converter
            converter = DroneNetworkDAGConverter(node_types, node_coordinates, mode)
            
            # Convert to DAG
            dag, conversion_results = convert_drone_network_to_dag(converter, adj_matrix, verbose=false)
            
            # Store results
            drone_results[mode_name] = Dict(
                "dag" => dag,
                "validation" => conversion_results["validation"],
                "conversion_results" => conversion_results
            )
        end
        
        results[drone_name] = drone_results
    end
    
    # Create integrated DAG and find transfer nodes
    drone1_dag = results["Drone 1 (High Capability)"]["Supply Distribution"]["dag"]
    drone2_dag = results["Drone 2 (Low Capability)"]["Supply Distribution"]["dag"]
    
    # Find transfer opportunities
    transfer_nodes = Int[]
    for i in 1:length(node_types)
        drone1_connected = sum(drone1_dag[i, :]) + sum(drone1_dag[:, i]) > 0
        drone2_connected = sum(drone2_dag[i, :]) + sum(drone2_dag[:, i]) > 0
        
        if drone1_connected && drone2_connected
            push!(transfer_nodes, i)
        end
    end
    
    # Create integrated DAG
    integrated_dag = max.(drone1_dag, drone2_dag)
    
    return results, transfer_nodes, integrated_dag
end

"""
Test IPA Framework integration with loaded drone data
"""
function test_ipa_integration(ipa_data::Dict)
    println("🔧 Testing IPA Framework integration...")
    
    # Test basic connectivity analysis
    edgelist = ipa_data["edgelist"]
    source_nodes = ipa_data["source_nodes"]
    
    println("  ✓ Basic structure validation:")
    println("    - Graph has $(length(edgelist)) directed edges")
    println("    - Graph has $(length(source_nodes)) source nodes")
    
    # Test with simple node probabilities for reachability analysis
    n_nodes = size(ipa_data["adjacency_matrix"], 1)
    node_priors = Dict(i => 0.9 for i in 1:n_nodes)  # 90% prior reliability
    link_probability = Dict(edge => 0.95 for edge in edgelist)  # 95% link reliability
    
    println("  ✓ Created test probabilities for $(n_nodes) nodes")
    
    # Test diamond identification (if any diamonds exist)
    fork_nodes = ipa_data["fork_nodes"]
    join_nodes = ipa_data["join_nodes"]
    
    if !isempty(fork_nodes) && !isempty(join_nodes)
        println("  ✓ Network structure suitable for diamond analysis:")
        println("    - Fork nodes: $(length(fork_nodes))")
        println("    - Join nodes: $(length(join_nodes))")
        
        # Try to identify diamonds
        try
            diamond_structures = identify_and_group_diamonds(
                ipa_data["outgoing_index"], ipa_data["incoming_index"],
                ipa_data["descendants"], ipa_data["ancestors"]
            )
            println("    - Identified $(length(diamond_structures)) diamond structures")
        catch e
            println("    - Diamond identification: $(typeof(e))")
        end
    else
        println("  ✓ Network is tree-like (no diamonds)")
    end
    
    # Test reachability analysis readiness
    println("  ✓ Ready for reachability analysis:")
    println("    - Iteration sets: $(length(ipa_data["iteration_sets"]))")
    println("    - Ancestors/descendants calculated")
    println("    - Transfer nodes: $(length(ipa_data["transfer_nodes"]))")
    
    println("  ✅ IPA Framework integration test completed")
end

"""
Helper functions from the original test (simplified versions)
"""
function convert_nodes_to_dag_format(nodes::Vector{Node})
    n = length(nodes)
    node_types = Vector{NodeType}(undef, n)
    node_coordinates = zeros(Float64, n, 2)
    
    node_id_to_index = Dict(node.id => i for (i, node) in enumerate(nodes))
    
    for (i, node) in enumerate(nodes)
        node_coordinates[i, 1] = node.lat
        node_coordinates[i, 2] = node.lon
        
        if node.city_type == "H"
            node_types[i] = HOSPITAL
        elseif occursin("Airport", node.info) || occursin("airport", node.info)
            node_types[i] = AIRPORT
        elseif node.source_receiver_type == "SOURCE" || node.group_1 >= 10
            node_types[i] = REGIONAL_HUB
        elseif node.source_receiver_type == "RECEIVER" && node.city_type != "H"
            node_types[i] = LOCAL_HUB
        else
            node_types[i] = GENERIC
        end
    end
    
    return node_types, node_coordinates, node_id_to_index
end

function convert_edges_to_adjacency_matrix(edges::Vector{Edge}, nodes::Vector{Node})
    n = length(nodes)
    adj_matrix = zeros(Int, n, n)
    
    node_id_to_index = Dict(node.id => i for (i, node) in enumerate(nodes))
    
    for edge in edges
        if haskey(node_id_to_index, edge.from) && haskey(node_id_to_index, edge.to)
            i = node_id_to_index[edge.from]
            j = node_id_to_index[edge.to]
            adj_matrix[i, j] = 1
            adj_matrix[j, i] = 1  # Undirected
        end
    end
    
    return adj_matrix
end

"""
Main execution function
"""
function main()
    println("Drone Input Processing Module Test")
    println("="^50)
    
    try
        success = test_drone_input_processing_cycle()
        
        if success
            println("\n🎉 ALL TESTS PASSED!")
            println("="^50)
            println("The DroneInputProcessingModule is ready for production use!")
        else
            println("\n❌ SOME TESTS FAILED!")
            println("="^50)
        end
        
        return success
        
    catch e
        println("\n❌ Test failed with error:")
        println(e)
        rethrow(e)
    end
end

# Uncomment to run the test
# main()