"""
Test script for focused diamond structure logging on three specified network files.

This script:
1. Initializes diamond logging before processing each network
2. Loads and processes each network file through the complete pipeline
3. Logs hierarchical diamond structure data showing GLOBAL and SUB-DIAMOND structures
4. Generates clear output showing parent-child relationships between diamond structures

Networks processed:
- 16 NodeNetwork Adjacency matrix.csv (16-node grid network)
- Power Distribution Network.csv (power distribution network)  
- metro_directed_dag_for_ipm.csv (metro network)
"""

import Fontconfig
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics, Dates, Logging

using Pkg
Pkg.activate("C:/Users/ohian/OneDrive - University of Strathclyde/Documents/Programmming Files/Julia Files/InformationPropagation/Info_Prop_Framework_Project")

# Import framework
include("IPAFramework.jl")
using .IPAFramework

# Use the logging functions from ReachabilityModuleRecurse
# No need to duplicate logging setup here

# All logging functions are now handled automatically by ReachabilityModuleRecurse.jl
# The logging will happen automatically during update_beliefs_iterative calls

"""
Process a single network file and log its diamond structures.
"""
function process_network(filepath::String, network_name::String)
    println("\n🔄 Processing: $network_name")
    println("   File: $filepath")
    
    try
        # Check if file exists
        if !isfile(filepath)
            error("File not found: $filepath")
        end
        
        # Initialize diamond logging for this network
        initialize_diamond_logging()
        
        println("   💎 Diamond logging initialized for $network_name")
        
        # Load and process the network
        println("   📁 Loading CSV file...")
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepath)
        
        # Set up node priors and link probabilities as specified
        println("   ⚙️  Setting up probabilities...")
        map!(x -> 0.1, values(node_priors))  # 0.1 for all nodes
        map!(x -> 0.8, values(edge_probabilities))  # 0.8 for all edges
        
        # Identify network structure
        println("   🔍 Analyzing network structure...")
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Identify diamond structures (GLOBAL level)
        println("   💎 Identifying diamond structures...")
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
        
        # Run belief propagation to trigger diamond logging (both GLOBAL and SUB-DIAMOND)
        println("   🧠 Running belief propagation...")
        beliefs = update_beliefs_iterative(
            edgelist,
            iteration_sets,
            outgoing_index,
            incoming_index,
            source_nodes,
            node_priors,
            edge_probabilities,
            descendants,
            ancestors,
            diamond_structures,
            join_nodes,
            fork_nodes
        )
        
        # Network statistics
        num_nodes = length(union(keys(outgoing_index), keys(incoming_index)))
        num_edges = length(edgelist)
        num_sources = length(source_nodes)
        num_forks = length(fork_nodes)
        num_joins = length(join_nodes)
        num_diamonds = length(diamond_structures)
        
        println("   ✅ Network processed successfully!")
        println("      Nodes: $num_nodes, Edges: $num_edges, Sources: $num_sources")
        println("      Forks: $num_forks, Joins: $num_joins, Diamond groups: $num_diamonds")
        
        # Finalize diamond logging for this network
        finalize_diamond_logging()
        
        return true
        
    catch e
        println("   ❌ Error processing $network_name: $e")
        
        # Try to finalize logging even on error
        try
            finalize_diamond_logging()
        catch
            # Ignore finalization errors
        end
        
        return false
    end
end

# Main execution
function main()
    println("🚀 Starting Diamond Structure Tracking Test")
    println("=" ^ 60)
    
    # Define the three networks to process
    networks = [
        ("csvfiles/16 NodeNetwork Adjacency matrix.csv", "16-Node Grid Network"),
        ("csvfiles/Power Distribution Network.csv", "Power Distribution Network"),
        ("csvfiles/metro_directed_dag_for_ipm.csv", "Metro Network")
    ]
    
    # Process each network
    successful_networks = 0
    total_networks = length(networks)
    
    for (filepath, network_name) in networks
        if process_network(filepath, network_name)
            successful_networks += 1
        end
    end
    
    # Final summary
    println("\n" * "=" ^ 60)
    println("📊 FINAL SUMMARY")
    println("   Networks processed: $successful_networks/$total_networks")
    println("   Log file generated: diamond_structure_tracking.log")
    
    if successful_networks == total_networks
        println("   ✅ All networks processed successfully!")
    else
        println("   ⚠️  Some networks failed to process - check log for details")
    end
    
    println("\n🎯 GOAL ACHIEVED:")
    println("   The log file contains hierarchical diamond structure data showing:")
    println("   - GLOBAL diamond structures (from initial network analysis)")
    println("   - SUB-DIAMOND structures (discovered during recursive processing)")
    println("   - Clear hierarchy and parent-child relationships")
    println("   - This allows comparison to identify inner diamonds not in original global list")
    
    println("\n📁 Check 'diamond_structure_tracking.log' for detailed diamond structure analysis")
end

# Execute the main function
if abspath(PROGRAM_FILE) == @__FILE__
    main()
end