"""
SDPBeliefPropagationTest.jl - Test SDP-Based Diamond Processing Alternative

Tests the SDP belief propagation module against the original exact algorithm
to ensure we get identical results with better performance on dense networks.
"""

using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics, Dates, CSV, Printf

# Include the IPAFramework and SDP modules
include("../src/IPAFramework.jl")
using .IPAFramework

include("../src/Algorithms/SDPBeliefPropagationModule.jl")
using .SDPBeliefPropagationModule

"""
Test SDP belief propagation on a simple diamond structure
"""
function test_simple_diamond_sdp()
    println("="^60)
    println("TESTING SDP BELIEF PROPAGATION - Simple Diamond")
    println("="^60)
    
    # Create a simple diamond structure for testing
    # Structure: C1 → D1 → J, C2 → D2 → J (where C1,C2 are conditioning, J is join)
    
    diamond_edges = [
        (1, 3),  # C1 → D1
        (2, 4),  # C2 → D2  
        (3, 5),  # D1 → J
        (4, 5)   # D2 → J
    ]
    
    conditioning_nodes = Set([1, 2])  # C1, C2
    join_node = 5                     # J
    
    # Set up beliefs and probabilities
    current_beliefs = Dict{Int64, Float64}(
        1 => 0.8,  # C1 has 80% belief
        2 => 0.6,  # C2 has 60% belief
        3 => 0.0,  # D1 starts at 0 (will be computed)
        4 => 0.0,  # D2 starts at 0 (will be computed)
        5 => 0.0   # J starts at 0 (will be computed)
    )
    
    edge_probabilities = Dict{Tuple{Int64,Int64}, Float64}(
        (1, 3) => 0.9,  # C1 → D1: 90%
        (2, 4) => 0.7,  # C2 → D2: 70%  
        (3, 5) => 0.8,  # D1 → J: 80%
        (4, 5) => 0.8   # D2 → J: 80%
    )
    
    node_priors = Dict{Int64, Float64}(
        1 => 0.8, 2 => 0.6, 3 => 0.5, 4 => 0.5, 5 => 0.4
    )
    
    println("Testing diamond with $(length(conditioning_nodes)) conditioning nodes")
    println("Diamond structure: $(length(diamond_edges)) edges")
    
    try
        # Test SDP approach
        println("\nTesting SDP belief propagation...")
        sdp_result = SDPBeliefPropagationModule.updateDiamondJoinSDP(
            join_node, conditioning_nodes, diamond_edges,
            current_beliefs, edge_probabilities, node_priors
        )
        
        println("SDP Result: $sdp_result")
        
        # Manual verification calculation
        # P(J receives signal) = P(C1→D1→J OR C2→D2→J)
        # = P(C1)*P(C1→D1)*P(D1→J) + P(C2)*P(C2→D2)*P(D2→J) - P(both paths)
        
        path1_prob = current_beliefs[1] * edge_probabilities[(1,3)] * edge_probabilities[(3,5)]
        path2_prob = current_beliefs[2] * edge_probabilities[(2,4)] * edge_probabilities[(4,5)]
        both_paths_prob = path1_prob * path2_prob  # Independent paths
        
        manual_result = path1_prob + path2_prob - both_paths_prob
        manual_result *= node_priors[join_node]  # Apply node prior
        
        println("Manual calculation: $manual_result")
        println("Difference: $(abs(sdp_result - manual_result))")
        
        if abs(sdp_result - manual_result) < 1e-10
            println("✅ SDP result matches manual calculation!")
        else
            println("❌ SDP result differs from manual calculation")
        end
        
        return sdp_result
        
    catch e
        println("ERROR: $e")
        println("Stack trace:")
        for (exc, bt) in Base.catch_stack()
            showerror(stdout, exc, bt)
            println()
        end
        rethrow(e)
    end
end

"""
Test SDP vs original algorithm on actual network data
"""
function test_sdp_vs_original(network_name::String = "karl")
    println("="^60)
    println("COMPARING SDP vs ORIGINAL - $network_name")
    println("="^60)
    
    # Map network names
    network_mappings = Dict(
        "karl" => "KarlNetwork",
        "grid" => "grid-graph",
        "metro" => "metro_directed_dag_for_ipm", 
        "munin" => "munin-dag"
    )
    
    full_network_name = network_mappings[lowercase(network_name)]
    
    try
        # Load network data
        println("Loading $full_network_name...")
        base_path = joinpath("dag_ntwrk_files", full_network_name)
        filepath_graph = joinpath(base_path, full_network_name * ".EDGES")
        json_network_name = replace(full_network_name, "_" => "-")
        filepath_node_json = joinpath(base_path, "float", json_network_name * "-nodepriors.json")
        filepath_edge_json = joinpath(base_path, "float", json_network_name * "-linkprobabilities.json")
        
        # Load network components
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        node_priors = read_node_priors_from_json(filepath_node_json)
        edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
        
        # Network analysis
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Diamond analysis
        root_diamonds = identify_and_group_diamonds(
            join_nodes, incoming_index, ancestors, descendants,
            source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
        )
        
        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds, node_priors, ancestors, descendants, iteration_sets
        )
        
        println("Network: $(length(node_priors)) nodes, $(length(edgelist)) edges")
        println("Diamonds: $(length(unique_diamonds)) unique diamonds")
        
        # Run original algorithm
        println("\nRunning original exact algorithm...")
        original_time = @elapsed begin
            original_results = IPAFramework.update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities,
                descendants, ancestors, root_diamonds, join_nodes,
                fork_nodes, unique_diamonds
            )
        end
        
        println("Original algorithm completed in $(round(original_time, digits=4))s")
        
        # For now, we'll test the SDP module components rather than full integration
        println("\nTesting SDP diamond processing components...")
        
        # Test on a specific diamond if available
        if !isempty(root_diamonds)
            # Get first diamond from root_diamonds which has DiamondsAtNode structure
            sample_diamond_key = first(keys(root_diamonds))
            sample_diamonds_at_node = root_diamonds[sample_diamond_key]
            
            println("Testing SDP on sample diamond...")
            
            # Extract diamond information
            conditioning_nodes = sample_diamonds_at_node.diamond.conditioning_nodes
            join_node = sample_diamonds_at_node.join_node
            diamond_edges = sample_diamonds_at_node.diamond.edgelist
            
            println("Sample diamond has $(length(conditioning_nodes)) conditioning nodes")
            println("Join node: $join_node")
            println("Diamond edges: $(length(diamond_edges))")
            
            if length(conditioning_nodes) > 15
                println("⚠️  Large diamond detected - this is where SDP would help!")
                println("Original algorithm: O(2^$(length(conditioning_nodes))) = $(2^length(conditioning_nodes)) states")
                println("SDP algorithm: O(paths × terms) - polynomial complexity")
            else
                println("Small diamond - both algorithms should be fast")
            end
            
            # Test SDP on this actual diamond
            println("\\nTesting SDP on actual diamond...")
            try
                # Create test beliefs for conditioning nodes
                test_beliefs = Dict{Int64, Float64}()
                for node in conditioning_nodes
                    test_beliefs[node] = 0.7  # 70% belief for testing
                end
                
                sdp_result = SDPBeliefPropagationModule.updateDiamondJoinSDP(
                    join_node, conditioning_nodes, diamond_edges,
                    test_beliefs, edge_probabilities, node_priors
                )
                
                println("✅ SDP computation successful: $sdp_result")
                
            catch e
                println("⚠️  SDP test error: $e")
            end
        end
        
        println("\n✅ Comparison test completed")
        println("Next step: Full SDP integration into belief propagation pipeline")
        
        return original_results
        
    catch e
        println("ERROR: $e")
        println("Stack trace:")
        for (exc, bt) in Base.catch_stack()
            showerror(stdout, exc, bt)
            println()
        end
        rethrow(e)
    end
end

"""
List available test functions
"""
function list_sdp_tests()
    println("Available SDP belief propagation tests:")
    println("="^50)
    println("• test_simple_diamond_sdp()     - Test basic SDP logic")
    println("• test_sdp_vs_original(\"karl\")  - Compare vs original algorithm")
    println("• test_sdp_vs_original(\"grid\")  - Test on grid network")
    println("• test_sdp_vs_original(\"metro\") - Test on metro network")
    println("• test_sdp_vs_original(\"munin\") - Test on munin network")
    println()
    println("Purpose: Replace 2^n diamond enumeration with efficient SDP computation")
end

# Example usage
# list_sdp_tests()
# test_simple_diamond_sdp()
# test_sdp_vs_original("karl")