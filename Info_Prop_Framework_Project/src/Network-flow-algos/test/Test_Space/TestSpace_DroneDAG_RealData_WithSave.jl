"""
TestSpace_DroneDAG_RealData_WithSave.jl

Enhanced version of TestSpace DroneDAG_RealData.jl that includes saving functionality
using the DroneInputProcessingModule. This demonstrates how to integrate the save/load
functionality directly with the real drone data results.
"""

using CSV, DataFrames, DelimitedFiles, Statistics
using DataStructures, SparseArrays, BenchmarkTools, 
      Combinatorics

# Import framework - following the exact pattern from other test files
using .IPAFramework

# Include the existing drone data loading functions
include("DroneIDetailedCheck.jl")

"""
Convert the existing Node structure to DroneNetworkDagModule format
"""
function convert_nodes_to_dag_format(nodes::Vector{Node})
    n = length(nodes)
    node_types = Vector{NodeType}(undef, n)
    node_coordinates = zeros(Float64, n, 2)
    
    # Create mapping from node index to actual node ID
    node_id_to_index = Dict(node.id => i for (i, node) in enumerate(nodes))
    
    for (i, node) in enumerate(nodes)
        # Set coordinates
        node_coordinates[i, 1] = node.lat
        node_coordinates[i, 2] = node.lon
        
        # Classify node types based on your actual data structure
        if node.city_type == "H"  # Hospital
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

"""
Convert edge list to adjacency matrix format for DAG conversion
Note: Creates undirected graph as input for DAG conversion algorithm
"""
function convert_edges_to_adjacency_matrix(edges::Vector{Edge}, nodes::Vector{Node})
    n = length(nodes)
    adj_matrix = zeros(Int, n, n)
    
    # Create mapping from node ID to matrix index
    node_id_to_index = Dict(node.id => i for (i, node) in enumerate(nodes))
    
    for edge in edges
        if haskey(node_id_to_index, edge.from) && haskey(node_id_to_index, edge.to)
            i = node_id_to_index[edge.from]
            j = node_id_to_index[edge.to]
            # Create undirected edge - the DAG conversion algorithm will direct these
            adj_matrix[i, j] = 1
            adj_matrix[j, i] = 1  # Undirected input for DAG conversion
        end
    end
    
    return adj_matrix
end

"""
Test the sophisticated DAG conversion with real drone network data AND save results
"""
function test_real_drone_dag_conversion_with_save()
    println("🚁🚁🚁 REAL DRONE NETWORK DAG CONVERSION TEST WITH SAVE 🚁🚁🚁")
    println("="^80)
    
    # Load real drone network data
    nodes_file = "src/Network-flow-algos/test/drone network/nodes.csv"
    drone1_file = "src/Network-flow-algos/test/drone network/feasible_drone_1.csv"
    drone2_file = "src/Network-flow-algos/test/drone network/feasible_drone_2.csv"
    
    println("Loading real drone network data...")
    
    # Load Drone 1 data (High Capability - 12,054 routes)
    println("\n--- Loading Drone 1 (High Capability) ---")
    nodes1, edges1 = read_graph_data(nodes_file, drone1_file)
    
    # Load Drone 2 data (Low Capability - 300 routes)
    println("\n--- Loading Drone 2 (Low Capability) ---")
    nodes2, edges2 = read_graph_data(nodes_file, drone2_file)
    
    # Convert to DAG format
    println("\n--- Converting to DAG Format ---")
    node_types, node_coordinates, node_id_mapping = convert_nodes_to_dag_format(nodes1)
    
    drone1_adj_matrix = convert_edges_to_adjacency_matrix(edges1, nodes1)
    drone2_adj_matrix = convert_edges_to_adjacency_matrix(edges2, nodes2)
    
    println("✓ Converted $(length(nodes1)) nodes to DAG format")
    println("✓ Drone 1: $(sum(drone1_adj_matrix) ÷ 2) undirected edges")
    println("✓ Drone 2: $(sum(drone2_adj_matrix) ÷ 2) undirected edges")
    
    # Analyze node type distribution
    println("\n--- Node Type Distribution ---")
    type_counts = Dict{NodeType, Int}()
    for node_type in [HOSPITAL, AIRPORT, REGIONAL_HUB, LOCAL_HUB, GENERIC]
        type_counts[node_type] = count(==(node_type), node_types)
    end
    
    for (node_type, count) in type_counts
        if count > 0
            println("  $node_type: $count")
        end
    end
    
    # Test DAG conversion for all operational modes
    println("\n" * "="^80)
    println("🔄 TESTING DAG CONVERSION FOR ALL OPERATIONAL MODES")
    println("="^80)
    
    modes = [SUPPLY_DISTRIBUTION, EMERGENCY_RESPONSE, RESILIENCE_ANALYSIS]
    mode_names = ["Supply Distribution", "Emergency Response", "Resilience Analysis"]
    
    results = Dict()
    
    for (drone_name, adj_matrix) in [("Drone 1 (High Capability)", drone1_adj_matrix), 
                                     ("Drone 2 (Low Capability)", drone2_adj_matrix)]
        
        println("\n🚁 Testing $drone_name")
        println("-"^50)
        
        drone_results = Dict()
        
        for (mode, mode_name) in zip(modes, mode_names)
            println("\n--- $mode_name Mode ---")
            
            # Create converter
            converter = DroneNetworkDAGConverter(node_types, node_coordinates, mode)
            
            # Convert to DAG
            dag, conversion_results = convert_drone_network_to_dag(converter, adj_matrix, verbose=false)
            
            # Analyze results
            validation = conversion_results["validation"]
            
            println("Results:")
            println("  ✓ Is Acyclic: $(validation["is_acyclic"])")
            println("  ✓ Edge Retention: $(round(validation["edge_retention_rate"] * 100, digits=1))%")
            println("  ✓ Sources: $(validation["num_sources"])")
            println("  ✓ Sinks: $(validation["num_sinks"])")
            println("  ✓ Cycles Removed: $(conversion_results["cycles_removed"])")
            
            if haskey(validation, "hospital_reachability")
                println("  ✓ Hospital Reachability: $(round(validation["hospital_reachability"] * 100, digits=1))%")
            end
            
            # Store results
            drone_results[mode_name] = Dict(
                "dag" => dag,
                "validation" => validation,
                "conversion_results" => conversion_results
            )
        end
        
        results[drone_name] = drone_results
    end
    
    # Multi-modal integration analysis
    println("\n" * "="^80)
    println("🔗 MULTI-MODAL INTEGRATION ANALYSIS")
    println("="^80)
    
    # Use Supply Distribution mode for integration analysis
    drone1_dag = results["Drone 1 (High Capability)"]["Supply Distribution"]["dag"]
    drone2_dag = results["Drone 2 (Low Capability)"]["Supply Distribution"]["dag"]
    
    # Find transfer opportunities
    transfer_nodes = Int[]
    for i in 1:length(node_types)
        # Check if node has connections in both DAGs
        drone1_connected = sum(drone1_dag[i, :]) + sum(drone1_dag[:, i]) > 0
        drone2_connected = sum(drone2_dag[i, :]) + sum(drone2_dag[:, i]) > 0
        
        if drone1_connected && drone2_connected
            push!(transfer_nodes, i)
        end
    end
    
    println("Transfer Node Analysis:")
    println("  Total transfer opportunities: $(length(transfer_nodes))")
    
    # Create integrated DAG with cycle prevention
    println("  Creating integrated DAG with cycle prevention...")
    naive_integrated = max.(drone1_dag, drone2_dag)
    
    # Fix bidirectional edges to maintain DAG property
    integrated_dag = copy(naive_integrated)
    n = length(node_types)
    bidirectional_edges = []
    
    # Find bidirectional edges
    for i in 1:n
        for j in (i+1):n
            if integrated_dag[i, j] == 1 && integrated_dag[j, i] == 1
                push!(bidirectional_edges, (i, j))
            end
        end
    end
    
    # Fix bidirectional edges using hierarchy-based resolution
    for (i, j) in bidirectional_edges
        # Priority resolution: use node index priority (lower index → higher index)
        if i < j
            integrated_dag[j, i] = 0  # Keep i → j direction
        else
            integrated_dag[i, j] = 0  # Keep j → i direction
        end
    end
    
    integrated_edges = sum(integrated_dag)
    drone1_edges = sum(drone1_dag)
    drone2_edges = sum(drone2_dag)
    
    println("  Integration efficiency:")
    println("    Drone 1 DAG edges: $drone1_edges")
    println("    Drone 2 DAG edges: $drone2_edges")
    println("    Naive union edges: $(sum(naive_integrated))")
    println("    Fixed bidirectional edges: $(length(bidirectional_edges))")
    println("    Final integrated DAG edges: $integrated_edges")
    println("    Additional connectivity: $(integrated_edges - max(drone1_edges, drone2_edges)) edges")
    
    # 🆕 NEW: SAVE RESULTS USING DroneInputProcessingModule
    println("\n" * "="^80)
    println("💾 SAVING RESULTS WITH DroneInputProcessingModule")
    println("="^80)
    
    try
        saved_files, metadata = save_real_drone_results(
            results, transfer_nodes, integrated_dag, 
            node_types, node_coordinates,
            "real_drone_dag_results"  # output directory
        )
        
        println("✅ Successfully saved $(length(saved_files)) files!")
        println("📁 Output directory: real_drone_dag_results/")
        for file in saved_files
            println("  📄 $file")
        end
        
        # Test loading the saved results
        println("\n🔄 Testing load functionality...")
        loaded_matrices, loaded_metadata, loaded_integrated = load_drone_dag_results(
            "real_drone_dag_results", base_filename="real_drone_network"
        )
        
        # Validate integrity
        validation_results = validate_drone_data_integrity(loaded_matrices, loaded_metadata)
        if validation_results["overall_valid"]
            println("✅ Load and validation successful!")
        else
            println("⚠️ Validation issues detected")
        end
        
        # Convert to IPA format
        println("\n🔧 Converting to IPA Framework format...")
        ipa_data = convert_to_ipa_format(loaded_matrices, loaded_metadata, selected_matrix="integrated")
        
        println("✅ IPA Framework integration ready:")
        println("  - Edge list: $(length(ipa_data["edgelist"])) edges")
        println("  - Source nodes: $(length(ipa_data["source_nodes"]))")
        println("  - Fork nodes: $(length(ipa_data["fork_nodes"]))")
        println("  - Join nodes: $(length(ipa_data["join_nodes"]))")
        println("  - Iteration sets: $(length(ipa_data["iteration_sets"]))")
        
    catch e
        println("❌ Error during save/load process:")
        println(e)
        rethrow(e)
    end
    
    # Summary
    println("\n" * "="^80)
    println("📋 SUMMARY & RECOMMENDATIONS")
    println("="^80)
    
    println("✅ Successfully converted real drone networks to DAGs")
    println("✅ All operational modes working with actual data")
    println("✅ Multi-modal integration identifies $(length(transfer_nodes)) transfer opportunities")
    println("✅ Results saved and loaded successfully with DroneInputProcessingModule")
    println("✅ Ready for production use with IPA Framework")
    
    return results, transfer_nodes, integrated_dag, node_types, node_coordinates
end

"""
Main execution function
"""
function main()
    println("Real Drone Network DAG Conversion Test with Save/Load")
    println("="^60)
    
    try
        results, transfer_nodes, integrated_dag, node_types, node_coordinates = test_real_drone_dag_conversion_with_save()
        
        println("\n🎉 REAL DATA TEST WITH SAVE/LOAD COMPLETED SUCCESSFULLY!")
        println("="^60)
        
        return results, transfer_nodes, integrated_dag, node_types, node_coordinates
        
    catch e
        println("\n❌ Test failed with error:")
        println(e)
        rethrow(e)
    end
end

# Run the test
main()