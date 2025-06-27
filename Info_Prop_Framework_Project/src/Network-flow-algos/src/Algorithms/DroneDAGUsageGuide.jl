"""
DroneDAGUsageGuide.jl

Practical guide for applying the sophisticated DAG conversion to actual drone networks.
This file shows how to integrate the DroneNetworkDagModule with your existing drone data
without directly reading CSV files.

Usage Pattern:
1. Load your drone network data using existing methods
2. Create node type classifications
3. Apply DAG conversion with different operational modes
4. Use resulting DAGs with other IPA Framework modules
"""

using Pkg
Pkg.activate(".")

# Add modules to path
push!(LOAD_PATH, "../../src/Algorithms/")

# Include and import the module
include("../../src/Algorithms/DroneNetworkDagModule.jl")
using .DroneNetworkDagModule

# Import specific types and functions
import .DroneNetworkDagModule: NodeType, OperationalMode
import .DroneNetworkDagModule: HOSPITAL, AIRPORT, REGIONAL_HUB, LOCAL_HUB, GENERIC
import .DroneNetworkDagModule: SUPPLY_DISTRIBUTION, EMERGENCY_RESPONSE, RESILIENCE_ANALYSIS
import .DroneNetworkDagModule: DroneNetworkDAGConverter, convert_drone_network_to_dag

using Graphs, LinearAlgebra, Statistics

"""
Template function for classifying nodes based on your drone network data.
Adapt this based on your actual node classification system.
"""
function classify_drone_network_nodes(node_data::Dict)
    """
    Based on your drone network analysis, you have:
    - 244 total nodes
    - 215 hospitals
    - 21 airports  
    - 99 potential hubs
    - 193 receivers
    - 36 generic locations
    
    This function shows how to map your data to NodeType classifications.
    """
    
    n_nodes = node_data["total_nodes"]  # 244 in your case
    node_types = Vector{NodeType}(undef, n_nodes)
    
    # Example classification logic (adapt to your data structure)
    for i in 1:n_nodes
        node_info = node_data["nodes"][i]  # Your node data structure
        
        if haskey(node_info, "type")
            node_type_str = node_info["type"]
            
            if occursin("hospital", lowercase(node_type_str))
                node_types[i] = HOSPITAL
            elseif occursin("airport", lowercase(node_type_str))
                node_types[i] = AIRPORT
            elseif occursin("regional", lowercase(node_type_str)) || 
                   occursin("major", lowercase(node_type_str))
                node_types[i] = REGIONAL_HUB
            elseif occursin("hub", lowercase(node_type_str)) ||
                   occursin("potential", lowercase(node_type_str))
                node_types[i] = LOCAL_HUB
            else
                node_types[i] = GENERIC
            end
        else
            # Fallback classification based on connectivity or other criteria
            # You could use degree centrality, geographic location, etc.
            node_types[i] = GENERIC
        end
    end
    
    return node_types
end

"""
Extract coordinates from your node data
"""
function extract_node_coordinates(node_data::Dict)
    """
    Your drone network has both lat/lon and east/north coordinates.
    This function shows how to extract them for the DAG converter.
    """
    
    n_nodes = node_data["total_nodes"]
    coordinates = zeros(Float64, n_nodes, 2)
    
    for i in 1:n_nodes
        node_info = node_data["nodes"][i]
        
        # Use lat/lon if available, otherwise east/north
        if haskey(node_info, "lat") && haskey(node_info, "lon")
            coordinates[i, 1] = node_info["lat"]
            coordinates[i, 2] = node_info["lon"]
        elseif haskey(node_info, "east") && haskey(node_info, "north")
            coordinates[i, 1] = node_info["east"]
            coordinates[i, 2] = node_info["north"]
        else
            # Default coordinates if none available
            coordinates[i, 1] = 0.0
            coordinates[i, 2] = 0.0
        end
    end
    
    return coordinates
end

"""
Convert your adjacency data to matrix format
"""
function prepare_adjacency_matrix(edge_data::Dict, n_nodes::Int)
    """
    Convert your edge data (from feasible_drone_1.csv, feasible_drone_2.csv)
    to adjacency matrix format for DAG conversion.
    """
    
    adj_matrix = zeros(Int, n_nodes, n_nodes)
    
    # Example: if your edge data is in list format
    if haskey(edge_data, "edges")
        for edge in edge_data["edges"]
            i, j = edge["from"], edge["to"]
            if 1 <= i <= n_nodes && 1 <= j <= n_nodes
                adj_matrix[i, j] = 1
                adj_matrix[j, i] = 1  # Undirected
            end
        end
    end
    
    # Example: if your edge data is in matrix format already
    if haskey(edge_data, "matrix")
        adj_matrix = edge_data["matrix"]
    end
    
    return adj_matrix
end

"""
Apply DAG conversion to your drone networks
"""
function convert_drone_networks_to_dags(drone1_adj::Matrix{Int}, 
                                       drone2_adj::Matrix{Int},
                                       node_types::Vector{NodeType},
                                       node_coordinates::Matrix{Float64})
    """
    Apply sophisticated DAG conversion to both drone networks
    with different operational modes.
    """
    
    println("=== Converting Drone Networks to DAGs ===")
    
    results = Dict()
    
    # Convert Drone 1 (High Capability - 12,054 routes)
    println("\nConverting Drone 1 Network (High Capability)...")
    
    # Supply Distribution Mode (primary use case)
    converter_d1_supply = DroneNetworkDAGConverter(
        node_types, 
        node_coordinates, 
        SUPPLY_DISTRIBUTION
    )
    
    drone1_supply_dag, drone1_supply_results = convert_drone_network_to_dag(
        converter_d1_supply, 
        drone1_adj, 
        verbose=true
    )
    
    results["drone1_supply"] = Dict(
        "dag" => drone1_supply_dag,
        "results" => drone1_supply_results,
        "converter" => converter_d1_supply
    )
    
    # Emergency Response Mode
    converter_d1_emergency = DroneNetworkDAGConverter(
        node_types, 
        node_coordinates, 
        EMERGENCY_RESPONSE
    )
    
    drone1_emergency_dag, drone1_emergency_results = convert_drone_network_to_dag(
        converter_d1_emergency, 
        drone1_adj, 
        verbose=false
    )
    
    results["drone1_emergency"] = Dict(
        "dag" => drone1_emergency_dag,
        "results" => drone1_emergency_results,
        "converter" => converter_d1_emergency
    )
    
    # Convert Drone 2 (Low Capability - 300 routes)
    println("\nConverting Drone 2 Network (Low Capability)...")
    
    # Resilience Analysis Mode (good for sparse networks)
    converter_d2_resilience = DroneNetworkDAGConverter(
        node_types, 
        node_coordinates, 
        RESILIENCE_ANALYSIS
    )
    
    drone2_resilience_dag, drone2_resilience_results = convert_drone_network_to_dag(
        converter_d2_resilience, 
        drone2_adj, 
        verbose=true
    )
    
    results["drone2_resilience"] = Dict(
        "dag" => drone2_resilience_dag,
        "results" => drone2_resilience_results,
        "converter" => converter_d2_resilience
    )
    
    return results
end

"""
Integrate DAGs with other IPA Framework modules
"""
function integrate_with_ipa_framework(dag_results::Dict)
    """
    Show how to use the converted DAGs with other IPA Framework modules:
    - DiamondClassificationModule
    - ReachabilityModule  
    - GeneralizedCriticalPathModule
    - CapacityAnalysisModule
    """
    
    println("\n=== Integrating with IPA Framework Modules ===")
    
    # Example: Use with ReachabilityModule
    println("\n1. Reachability Analysis:")
    for (dag_name, dag_data) in dag_results
        dag = dag_data["dag"]
        validation = dag_data["results"]["validation"]
        
        println("  $dag_name:")
        println("    Sources: $(length(validation["sources"]))")
        println("    Sinks: $(length(validation["sinks"]))")
        
        if haskey(validation, "hospital_reachability")
            println("    Hospital Reachability: $(round(validation["hospital_reachability"] * 100, digits=1))%")
        end
        
        # You can now use this DAG with ReachabilityModule.jl
        # reachability_results = analyze_reachability(dag, source_nodes, target_nodes)
    end
    
    # Example: Use with DiamondClassificationModule
    println("\n2. Diamond Structure Analysis:")
    println("   DAGs are ready for diamond pattern detection")
    println("   Use: diamond_results = classify_diamonds(dag)")
    
    # Example: Use with GeneralizedCriticalPathModule
    println("\n3. Critical Path Analysis:")
    println("   DAGs enable critical path computation")
    println("   Use: critical_paths = find_critical_paths(dag, weights)")
    
    # Example: Use with CapacityAnalysisModule
    println("\n4. Capacity Analysis:")
    println("   DAGs support flow capacity analysis")
    println("   Use: capacity_results = analyze_capacity(dag, capacities)")
    
    return true
end

"""
Export DAGs for further analysis
"""
function export_dag_results(dag_results::Dict, output_dir::String="drone_dag_results")
    """
    Export the converted DAGs and analysis results for further use.
    """
    
    if !isdir(output_dir)
        mkdir(output_dir)
    end
    
    println("\n=== Exporting DAG Results ===")
    
    for (dag_name, dag_data) in dag_results
        dag = dag_data["dag"]
        results = dag_data["results"]
        
        # Export DAG as CSV
        dag_filename = joinpath(output_dir, "$(dag_name)_dag.csv")
        writedlm(dag_filename, dag, ',')
        println("Exported DAG: $dag_filename")
        
        # Export analysis results
        results_filename = joinpath(output_dir, "$(dag_name)_analysis.txt")
        open(results_filename, "w") do io
            println(io, "DAG Analysis Results for $dag_name")
            println(io, "="^50)
            
            validation = results["validation"]
            println(io, "Structural Properties:")
            println(io, "  Is Acyclic: $(validation["is_acyclic"])")
            println(io, "  Has Self Loops: $(validation["has_self_loops"])")
            println(io, "  Original Edges: $(validation["original_edges"])")
            println(io, "  DAG Edges: $(validation["dag_edges"])")
            println(io, "  Edge Retention: $(round(validation["edge_retention_rate"] * 100, digits=2))%")
            
            println(io, "\nTopological Properties:")
            println(io, "  Sources: $(length(validation["sources"]))")
            println(io, "  Sinks: $(length(validation["sinks"]))")
            println(io, "  Cycles Removed: $(results["cycles_removed"])")
            
            if haskey(validation, "hospital_reachability")
                println(io, "\nOperational Properties:")
                println(io, "  Hospital Reachability: $(round(validation["hospital_reachability"] * 100, digits=1))%")
                println(io, "  Total Hospitals: $(validation["total_hospitals"])")
                println(io, "  Reachable Hospitals: $(validation["reachable_hospitals"])")
            end
            
            println(io, "\nNode Importance (Top 10):")
            importance_scores = results["importance_scores"]
            sorted_indices = sortperm(importance_scores, rev=true)
            for i in 1:min(10, length(sorted_indices))
                idx = sorted_indices[i]
                println(io, "  Node $idx: $(round(importance_scores[idx], digits=3))")
            end
        end
        println("Exported analysis: $results_filename")
    end
    
    println("All results exported to: $output_dir")
    return output_dir
end

"""
Main workflow function - adapt this to your data loading process
"""
function main_workflow()
    """
    Complete workflow for converting your drone networks to DAGs.
    Adapt the data loading section to your actual data sources.
    """
    
    println("Drone Network DAG Conversion Workflow")
    println("="^50)
    
    # STEP 1: Load your data (adapt this section)
    println("\nStep 1: Loading drone network data...")
    
    # This is where you would load your actual data
    # Instead of reading CSV files directly, you could:
    # 1. Use existing Julia functions that read the data
    # 2. Load data through your existing analysis scripts
    # 3. Use pre-processed data structures
    
    # Example data structure (replace with your actual data loading)
    node_data = Dict(
        "total_nodes" => 244,
        "nodes" => [Dict("type" => "hospital", "lat" => 55.0 + i*0.01, "lon" => -4.0 + i*0.01) for i in 1:244]
    )
    
    drone1_edge_data = Dict("edges" => [])  # Your Drone 1 feasibility data
    drone2_edge_data = Dict("edges" => [])  # Your Drone 2 feasibility data
    
    # STEP 2: Prepare data for DAG conversion
    println("Step 2: Preparing data for DAG conversion...")
    
    node_types = classify_drone_network_nodes(node_data)
    node_coordinates = extract_node_coordinates(node_data)
    
    drone1_adj = prepare_adjacency_matrix(drone1_edge_data, node_data["total_nodes"])
    drone2_adj = prepare_adjacency_matrix(drone2_edge_data, node_data["total_nodes"])
    
    # STEP 3: Convert to DAGs
    println("Step 3: Converting networks to DAGs...")
    
    dag_results = convert_drone_networks_to_dags(
        drone1_adj, 
        drone2_adj, 
        node_types, 
        node_coordinates
    )
    
    # STEP 4: Integrate with IPA Framework
    println("Step 4: Integrating with IPA Framework...")
    
    integrate_with_ipa_framework(dag_results)
    
    # STEP 5: Export results
    println("Step 5: Exporting results...")
    
    output_dir = export_dag_results(dag_results)
    
    println("\n" * "="^50)
    println("WORKFLOW COMPLETED SUCCESSFULLY")
    println("="^50)
    
    println("\nNext Steps:")
    println("1. Use exported DAGs with DiamondClassificationModule.jl")
    println("2. Apply ReachabilityModule.jl for connectivity analysis")
    println("3. Use GeneralizedCriticalPathModule.jl for route optimization")
    println("4. Apply CapacityAnalysisModule.jl for throughput analysis")
    
    return dag_results, output_dir
end

"""
Quick start function for immediate testing
"""
function quick_start_example()
    """
    Quick example that you can run immediately to see the DAG conversion in action.
    """
    
    println("Quick Start Example - Drone DAG Conversion")
    println("="^50)
    
    # Create minimal example (10 nodes)
    n = 10
    node_types = [AIRPORT, REGIONAL_HUB, HOSPITAL, HOSPITAL, HOSPITAL, 
                  LOCAL_HUB, HOSPITAL, HOSPITAL, AIRPORT, GENERIC]
    
    node_coordinates = rand(Float64, n, 2) * 10  # Random coordinates
    
    # Create simple adjacency matrix
    adj_matrix = zeros(Int, n, n)
    # Connect some nodes
    connections = [(1,2), (1,3), (2,4), (2,5), (3,6), (4,7), (5,8), (6,9), (7,10), (8,9)]
    for (i,j) in connections
        adj_matrix[i,j] = 1
        adj_matrix[j,i] = 1
    end
    
    # Convert to DAG
    converter = DroneNetworkDAGConverter(node_types, node_coordinates, SUPPLY_DISTRIBUTION)
    dag, results = convert_drone_network_to_dag(converter, adj_matrix, verbose=true)
    
    println("\nQuick Start Results:")
    println("Original edges: $(sum(adj_matrix) ÷ 2)")
    println("DAG edges: $(sum(dag))")
    println("Cycles removed: $(results["cycles_removed"])")
    println("Sources: $(length(results["validation"]["sources"]))")
    println("Sinks: $(length(results["validation"]["sinks"]))")
    
    return dag, results
end

# Uncomment to run quick start example
# quick_start_example()

println("DroneDAGUsageGuide.jl loaded successfully!")
println("Run quick_start_example() for immediate testing")
println("Run main_workflow() for full conversion process")