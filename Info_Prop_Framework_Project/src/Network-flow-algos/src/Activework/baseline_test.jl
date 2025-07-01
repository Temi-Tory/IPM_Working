#!/usr/bin/env julia

"""
Baseline Test Script for Network Flow Algorithms

This script runs the clean ReachabilityModule (without logging) on all three networks
and stores their results for validation. The results will be used to validate that
the cache implementation maintains identical results while improving performance.

Networks tested:
- 16-node grid network
- Power distribution network  
- Metro network

Parameters:
- Node priors: 1.0 for all nodes
- Link probabilities: 0.9 for all edges
"""

using JSON
using Printf
using Dates

# Include the framework
include("IPAFramework.jl")
using .IPAFramework

"""
Process a single network file and return results
"""
function process_network(csv_file::String, network_name::String)
    println("=" ^ 60)
    println("Processing: $network_name")
    println("File: $csv_file")
    println("=" ^ 60)
    
    try
        # Start timing
        start_time = time()
        
        # Step 1: Load and process the CSV file
        println("📁 Loading network from CSV...")
        if !isfile(csv_file)
            error("File not found: $csv_file")
        end
        
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors_orig, edge_probabilities_orig = 
            read_graph_to_dict(csv_file)
        
        # Step 2: Override with specified parameters
        println("⚙️  Setting up parameters...")
        
        # Set all node priors to 1.0
        node_priors = Dict{Int64, Float64}()
        all_nodes = Set{Int64}()
        for (source, target) in edgelist
            push!(all_nodes, source, target)
        end
        for node in source_nodes
            push!(all_nodes, node)
        end
        
        for node in all_nodes
            node_priors[node] = 1.0
        end
        
        # Set all link probabilities to 0.9
        link_probability = Dict{Tuple{Int64,Int64}, Float64}()
        for edge in edgelist
            link_probability[edge] = 0.9
        end
        
        # Step 3: Find iteration sets and network structure
        println("🔍 Analyzing network structure...")
        iteration_sets, ancestors, descendants = find_iteration_sets(
            edgelist, outgoing_index, incoming_index
        )
        
        fork_nodes, join_nodes = identify_fork_and_join_nodes(
            outgoing_index, incoming_index
        )
        
        # Step 4: Identify diamond structures
        println("💎 Identifying diamond structures...")
        diamond_structures = identify_and_group_diamonds(
            join_nodes,
            ancestors,
            incoming_index,
            source_nodes,
            fork_nodes,
            iteration_sets,
            edgelist,
            descendants,
            node_priors
        )
        
        # Step 5: Run belief propagation
        println("🧠 Running belief propagation...")
        belief_results = update_beliefs_iterative(
            edgelist,
            iteration_sets,
            outgoing_index,
            incoming_index,
            source_nodes,
            node_priors,
            link_probability,
            descendants,
            ancestors,
            diamond_structures,
            join_nodes,
            fork_nodes
        )
        
        # Calculate execution time
        execution_time = time() - start_time
        
        # Step 6: Validate results
        println("✅ Validating results...")
        expected_nodes = length(all_nodes)
        actual_nodes = length(belief_results)
        
        if actual_nodes != expected_nodes
            error("Result validation failed: Expected $expected_nodes nodes, got $actual_nodes")
        end
        
        # Check for any missing or invalid belief values
        for node in all_nodes
            if !haskey(belief_results, node)
                error("Missing belief value for node $node")
            end
            belief = belief_results[node]
            if isnan(belief) || isinf(belief) || belief < 0 || belief > 1
                error("Invalid belief value for node $node: $belief")
            end
        end
        
        # Step 7: Compile network statistics
        num_edges = length(edgelist)
        num_diamonds = sum(length(ds.diamond) for ds in values(diamond_structures))
        num_source_nodes = length(source_nodes)
        num_fork_nodes = length(fork_nodes)
        num_join_nodes = length(join_nodes)
        
        println("📊 Network Statistics:")
        println("   Nodes: $expected_nodes")
        println("   Edges: $num_edges")
        println("   Source nodes: $num_source_nodes")
        println("   Fork nodes: $num_fork_nodes")
        println("   Join nodes: $num_join_nodes")
        println("   Diamond structures: $num_diamonds")
        println("   Execution time: $(round(execution_time, digits=4)) seconds")
        
        # Step 8: Return structured results
        return Dict(
            "network_name" => network_name,
            "file_path" => csv_file,
            "execution_time" => execution_time,
            "statistics" => Dict(
                "nodes" => expected_nodes,
                "edges" => num_edges,
                "source_nodes" => num_source_nodes,
                "fork_nodes" => num_fork_nodes,
                "join_nodes" => num_join_nodes,
                "diamonds" => num_diamonds
            ),
            "parameters" => Dict(
                "node_prior" => 1.0,
                "link_probability" => 0.9
            ),
            "belief_results" => belief_results,
            "processing_successful" => true,
            "timestamp" => string(now())
        )
        
    catch e
        println("❌ Error processing $network_name:")
        println("   $(typeof(e)): $e")
        
        return Dict(
            "network_name" => network_name,
            "file_path" => csv_file,
            "processing_successful" => false,
            "error" => string(e),
            "error_type" => string(typeof(e)),
            "timestamp" => string(now())
        )
    end
end

"""
Main execution function
"""
function run_baseline_tests()
    println("🚀 Starting Baseline Test Suite")
    println("Time: $(now())")
    println()
    
    # Define the three networks to test
    networks = [
        ("csvfiles/16 NodeNetwork Adjacency matrix.csv", "16-Node Grid Network"),
        ("csvfiles/Power Distribution Network.csv", "Power Distribution Network"),
        ("csvfiles/metro_directed_dag_for_ipm.csv", "Metro Network")
    ]
    
    # Initialize results storage
    all_results = Dict{String, Any}()
    successful_runs = 0
    total_execution_time = 0.0
    
    # Process each network
    for (csv_file, network_name) in networks
        result = process_network(csv_file, network_name)
        all_results[network_name] = result
        
        if result["processing_successful"]
            successful_runs += 1
            total_execution_time += result["execution_time"]
        end
        
        println()
    end
    
    # Compile summary
    summary = Dict(
        "test_suite" => "Baseline Network Flow Tests",
        "timestamp" => string(now()),
        "total_networks" => length(networks),
        "successful_runs" => successful_runs,
        "failed_runs" => length(networks) - successful_runs,
        "total_execution_time" => total_execution_time,
        "parameters" => Dict(
            "node_prior" => 1.0,
            "link_probability" => 0.9
        )
    )
    
    # Create final results structure
    final_results = Dict(
        "summary" => summary,
        "networks" => all_results
    )
    
    # Save results to JSON file
    println("💾 Saving results to baseline_results.json...")
    try
        open("baseline_results.json", "w") do f
            JSON.print(f, final_results, 2)
        end
        println("✅ Results saved successfully!")
    catch e
        println("❌ Error saving results: $e")
    end
    
    # Print final summary
    println()
    println("=" ^ 60)
    println("BASELINE TEST SUMMARY")
    println("=" ^ 60)
    println("Total networks tested: $(summary["total_networks"])")
    println("Successful runs: $(summary["successful_runs"])")
    println("Failed runs: $(summary["failed_runs"])")
    println("Total execution time: $(round(total_execution_time, digits=4)) seconds")
    
    if successful_runs > 0
        avg_time = total_execution_time / successful_runs
        println("Average execution time: $(round(avg_time, digits=4)) seconds")
    end
    
    println()
    println("Results saved to: baseline_results.json")
    println("=" ^ 60)
    
    return final_results
end

# Execute the baseline tests if this script is run directly
if abspath(PROGRAM_FILE) == @__FILE__
    try
        results = run_baseline_tests()
        println("🎉 Baseline testing completed!")
    catch e
        println("💥 Fatal error during baseline testing:")
        println("   $(typeof(e)): $e")
        exit(1)
    end
end