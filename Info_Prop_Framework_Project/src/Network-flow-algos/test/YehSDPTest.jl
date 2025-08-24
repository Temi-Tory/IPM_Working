"""
YehSDPTest.jl - Test Yeh's Proper SDP Implementation

Quick test file to validate Yeh's SDP algorithm implementation
Tests on small networks to verify the mathematical correctness
"""

using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics, Dates, CSV, Printf

# Include the IPAFramework module and Yeh SDP module
include("../src/IPAFramework.jl")
using .IPAFramework

include("../src/Algorithms/YehSDPModule.jl")
include("../src/Algorithms/YehExactSDPModule.jl")
using .YehSDPModule, .YehExactSDPModule

"""
Quick test function for Yeh SDP vs Exact algorithm
"""
function test_yeh_sdp(network_name::String, data_type::String="float")
    # Map network aliases to full names
    network_mappings = Dict(
        "karl" => "KarlNetwork",
        "grid" => "grid-graph",
        "metro" => "metro_directed_dag_for_ipm",
        "munin" => "munin-dag"
    )
    
    network_key = lowercase(network_name)
    if !haskey(network_mappings, network_key)
        error("Unknown network: $network_name. Available: $(keys(network_mappings))")
    end
    
    full_network_name = network_mappings[network_key]
    
    println("="^70)
    println("TESTING YEH SDP: $network_name ($full_network_name)")
    println("="^70)
    
    try
        # Load network data
        println("Loading network data...")
        base_path = joinpath("dag_ntwrk_files", full_network_name)
        filepath_graph = joinpath(base_path, full_network_name * ".EDGES")
        json_network_name = replace(full_network_name, "_" => "-")
        filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
        filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")
        
        # Load basic network structure
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        node_priors = read_node_priors_from_json(filepath_node_json)
        edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
        
        println("Network loaded: $(length(node_priors)) nodes, $(length(edgelist)) edges, $(length(source_nodes)) sources")
        
        # Run Yeh SDP algorithm
        println("\nRunning Yeh SDP algorithm...")
        yeh_time = @elapsed begin
            yeh_results = YehSDPModule.process_network_yeh_sdp(
                edgelist, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities
            )
        end
        
        println("\nYeh SDP Results:")
        println("  Computation time: $(round(yeh_time, digits=4))s")
        println("  Results computed for $(length(yeh_results)) nodes")
        
        # Show first few results
        sorted_results = sort(collect(yeh_results), by=x->x[1])
        println("\nFirst 10 node results:")
        for (i, (node, prob)) in enumerate(sorted_results[1:min(10, end)])
            source_indicator = node in source_nodes ? " (source)" : ""
            println("  Node $node: $(round(prob, digits=6))$source_indicator")
        end
        
        return yeh_results
        
    catch e
        println("ERROR testing Yeh SDP on $network_name: $e")
        println("Stack trace:")
        for (exc, bt) in Base.catch_stack()
            showerror(stdout, exc, bt)
            println()
        end
        rethrow(e)
    end
end

"""
Compare Yeh SDP vs Exact algorithm
"""
function compare_yeh_vs_exact(network_name::String, data_type::String="float")
    # Map network aliases to full names
    network_mappings = Dict(
        "karl" => "KarlNetwork",
        "grid" => "grid-graph",
        "metro" => "metro_directed_dag_for_ipm",
        "munin" => "munin-dag"
    )
    
    network_key = lowercase(network_name)
    full_network_name = network_mappings[network_key]
    
    println("="^70)
    println("COMPARING YEH SDP vs EXACT: $network_name")
    println("="^70)
    
    try
        # Load network data with diamond analysis for exact algorithm
        println("Loading network data...")
        base_path = joinpath("dag_ntwrk_files", full_network_name)
        filepath_graph = joinpath(base_path, full_network_name * ".EDGES")
        json_network_name = replace(full_network_name, "_" => "-")
        filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
        filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")
        
        # Load network data
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        node_priors = read_node_priors_from_json(filepath_node_json)
        edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
        
        # Network analysis for exact algorithm
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Diamond analysis (for exact algorithm only)
        root_diamonds = identify_and_group_diamonds(
            join_nodes, incoming_index, ancestors, descendants,
            source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
        )
        
        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds, node_priors, ancestors, descendants, iteration_sets
        )
        
        println("Network: $(length(node_priors)) nodes, $(length(edgelist)) edges, $(length(unique_diamonds)) diamonds")
        
        # Run exact algorithm
        println("\nRunning exact algorithm...")
        exact_time = @elapsed begin
            exact_results = IPAFramework.update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities,
                descendants, ancestors, root_diamonds, join_nodes, 
                fork_nodes, unique_diamonds
            )
        end
        
        # Run Yeh SDP algorithm
        println("Running Yeh SDP algorithm...")
        yeh_time = @elapsed begin
            yeh_results = YehSDPModule.process_network_yeh_sdp(
                edgelist, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities
            )
        end
        
        # Run Yeh Exact SDP algorithm
        println("Running Yeh Exact SDP algorithm...")
        yeh_exact_time = @elapsed begin
            yeh_exact_results = YehExactSDPModule.process_network_yeh_exact_sdp(
                edgelist, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities
            )
        end
        
        # Calculate accuracy metrics
        common_nodes = intersect(keys(exact_results), keys(yeh_results))
        
        if !isempty(common_nodes)
            absolute_errors = Float64[]
            relative_errors = Float64[]
            
            for node in common_nodes
                exact_val = exact_results[node]
                yeh_val = yeh_results[node]
                
                abs_error = abs(exact_val - yeh_val)
                push!(absolute_errors, abs_error)
                
                if abs(exact_val) > 1e-12
                    rel_error = abs_error / abs(exact_val)
                    push!(relative_errors, rel_error)
                end
            end
            
            max_abs_error = maximum(absolute_errors)
            mean_abs_error = mean(absolute_errors)
            max_rel_error = isempty(relative_errors) ? 0.0 : maximum(relative_errors)
            
            # Calculate speedup
            speedup_factor = exact_time / yeh_time
            
            # Print comparison summary
            println("\n" * "="^50)
            println("COMPARISON RESULTS")
            println("="^50)
            println("Network: $full_network_name")
            println("Nodes: $(length(node_priors)), Edges: $(length(edgelist)), Diamonds: $(length(unique_diamonds))")
            println()
            println("TIMING:")
            println("  Exact algorithm: $(round(exact_time, digits=4))s")
            println("  Yeh SDP algorithm: $(round(yeh_time, digits=4))s")
            println("  Speedup factor: $(round(speedup_factor, digits=2))x")
            println()
            println("ACCURACY:")
            println("  Max absolute error: $(round(max_abs_error, digits=8))")
            println("  Mean absolute error: $(round(mean_abs_error, digits=8))")
            println("  Max relative error: $(round(max_rel_error * 100, digits=6))%")
            println()
            
            if max_abs_error < 1e-6
                println("✅ Results match within tolerance")
            elseif max_abs_error < 1e-3
                println("⚠️  Results close but with some error")
            else
                println("❌ Results differ significantly")
            end
            
            # Show detailed comparison for worst error nodes
            println("\nDETAILED COMPARISON (10 worst error nodes):")
            println("Node\tExact\t\tYeh SDP\t\tAbs Error")
            println("-"^50)
            
            # Sort nodes by absolute error (worst first)
            node_errors = [(node, abs(exact_results[node] - yeh_results[node])) for node in common_nodes]
            sort!(node_errors, by = x -> x[2], rev = true)  # Sort by error, worst first
            
            for (i, (node, error)) in enumerate(node_errors[1:min(10, end)])
                exact_val = exact_results[node]
                yeh_val = yeh_results[node]
                @printf("%d\t%.6f\t\t%.6f\t\t%.2e\n", node, exact_val, yeh_val, error)
            end
            
        else
            println("❌ No common nodes found between algorithms")
        end
        
        return (exact_results, yeh_results)
        
    catch e
        println("ERROR in comparison: $e")
        println("Stack trace:")
        for (exc, bt) in Base.catch_stack()
            showerror(stdout, exc, bt)
            println()
        end
        rethrow(e)
    end
end

"""
List available networks for testing
"""
function list_yeh_test_networks()
    println("Available networks for Yeh SDP testing:")
    println("="^50)
    println("• karl     - KarlNetwork (small test network)")
    println("• grid     - grid-graph (4x4 structured)")  
    println("• metro    - metro_directed_dag_for_ipm (medium linear)")
    println("• munin    - munin-dag (large sparse)")
    println()
    println("Usage:")
    println("test_yeh_sdp(\"karl\")              # Test Yeh SDP only")
    println("compare_yeh_vs_exact(\"karl\")      # Compare Yeh vs Exact")
end

# Example usage
# list_yeh_test_networks()
# test_yeh_sdp("karl")
# compare_yeh_vs_exact("karl")