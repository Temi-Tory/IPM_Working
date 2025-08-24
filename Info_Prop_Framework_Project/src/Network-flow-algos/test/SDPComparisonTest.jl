"""
SDPComparisonTest.jl - Direct Performance Comparison: SDP vs Exact Algorithm

Tests the new SDP modules against the existing exact algorithm on multiple networks.
Measures both accuracy and performance to validate the SDP approach.

Test Networks:
- karl (KarlNetwork) - Small test network
- grid (grid-graph) - 4x4 structured network  
- metro (metro_directed_dag_for_ipm) - Medium linear network
- munin (munin-dag) - Large sparse network

Each test compares:
1. Computation time (SDP should be faster on dense networks)
2. Result accuracy (SDP should match exact results within tolerance)
3. Memory usage patterns
"""

using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics, Dates, CSV, Printf

# Include the IPAFramework module and SDP modules
include("../src/IPAFramework.jl")
using .IPAFramework

include("../src/Algorithms/SDPProcessingModule.jl")
include("../src/Algorithms/SDPReachabilityModule.jl")
include("../src/Algorithms/YehSDPModule.jl")
using .SDPProcessingModule, .SDPReachabilityModule, .YehSDPModule

struct ComparisonResult{T}
    network_name::String
    
    # Timing results
    exact_time::Float64
    old_sdp_time::Float64
    yeh_sdp_time::Float64
    old_speedup_factor::Float64
    yeh_speedup_factor::Float64
    
    # Accuracy results
    exact_results::Dict{Int64, T}
    old_sdp_results::Dict{Int64, T}
    yeh_sdp_results::Dict{Int64, T}
    old_max_absolute_error::Float64
    old_mean_absolute_error::Float64
    old_max_relative_error::Float64
    yeh_max_absolute_error::Float64
    yeh_mean_absolute_error::Float64
    yeh_max_relative_error::Float64
    
    # Network characteristics
    num_nodes::Int64
    num_edges::Int64
    num_sources::Int64
    num_diamonds::Int64  # From exact algorithm
    
    # Success flags
    exact_success::Bool
    old_sdp_success::Bool
    yeh_sdp_success::Bool
end

"""
Load network data and prepare for both algorithms
"""
function load_network_for_comparison(network_name::String, data_type::String="float")
    println("Loading network: $network_name")
    
    # Construct file paths
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    json_network_name = replace(network_name, "_" => "-")
    filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")
    
    # Validate files exist
    for filepath in [filepath_graph, filepath_node_json, filepath_edge_json]
        if !isfile(filepath)
            error("Required file not found: $filepath")
        end
    end
    
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
    
    println("  Network loaded: $(length(node_priors)) nodes, $(length(edgelist)) edges")
    println("  Sources: $(length(source_nodes)), Diamonds: $(length(unique_diamonds))")
    
    return (
        edgelist, outgoing_index, incoming_index, source_nodes,
        node_priors, edge_probabilities, fork_nodes, join_nodes,
        iteration_sets, ancestors, descendants, root_diamonds, unique_diamonds
    )
end

"""
Run exact algorithm with timing
"""
function run_exact_algorithm(
    edgelist, iteration_sets, outgoing_index, incoming_index,
    source_nodes, node_priors, edge_probabilities, descendants,
    ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
)
    println("  Running exact algorithm...")
    
    exact_success = true
    exact_results = Dict{Int64, Float64}()
    exact_time = 0.0
    
    try
        # Time the exact algorithm
        exact_time = @elapsed begin
            exact_results = IPAFramework.update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities,
                descendants, ancestors, root_diamonds, join_nodes, 
                fork_nodes, unique_diamonds
            )
        end
        
        println("    Exact algorithm completed in $(round(exact_time, digits=3))s")
        
    catch e
        println("    Exact algorithm failed: $e")
        exact_success = false
        exact_time = Inf
    end
    
    return exact_results, exact_time, exact_success
end

"""
Run old SDP algorithm with timing
"""
function run_old_sdp_algorithm(
    edgelist, iteration_sets, outgoing_index, incoming_index,
    source_nodes, node_priors, edge_probabilities, descendants,
    ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
)
    println("  Running old SDP algorithm...")
    
    old_sdp_success = true
    old_sdp_results = Dict{Int64, Float64}()
    old_sdp_time = 0.0
    
    try
        # Time the old SDP algorithm
        old_sdp_time = @elapsed begin
            old_sdp_results = SDPReachabilityModule.update_beliefs_iterative_sdp(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities,
                descendants, ancestors, root_diamonds, join_nodes,
                fork_nodes, unique_diamonds
            )
        end
        
        println("    Old SDP algorithm completed in $(round(old_sdp_time, digits=3))s")
        
    catch e
        println("    Old SDP algorithm failed: $e")
        old_sdp_success = false
        old_sdp_time = Inf
    end
    
    return old_sdp_results, old_sdp_time, old_sdp_success
end

"""
Run Yeh SDP algorithm with timing
"""
function run_yeh_sdp_algorithm(
    edgelist, iteration_sets, outgoing_index, incoming_index,
    source_nodes, node_priors, edge_probabilities, descendants,
    ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
)
    println("  Running Yeh SDP algorithm...")
    
    yeh_sdp_success = true
    yeh_sdp_results = Dict{Int64, Float64}()
    yeh_sdp_time = 0.0
    
    try
        # Time the Yeh SDP algorithm
        yeh_sdp_time = @elapsed begin
            yeh_sdp_results = YehSDPModule.process_network_yeh_sdp(
                edgelist, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities
            )
        end
        
        println("    Yeh SDP algorithm completed in $(round(yeh_sdp_time, digits=3))s")
        
    catch e
        println("    Yeh SDP algorithm failed: $e")
        yeh_sdp_success = false
        yeh_sdp_time = Inf
    end
    
    return yeh_sdp_results, yeh_sdp_time, yeh_sdp_success
end

"""
Calculate accuracy metrics between exact and SDP results
"""
function calculate_accuracy_metrics(
    exact_results::Dict{Int64, Float64},
    sdp_results::Dict{Int64, Float64}
)
    if isempty(exact_results) || isempty(sdp_results)
        return 0.0, 0.0, 0.0  # max_abs_error, mean_abs_error, max_rel_error
    end
    
    # Find common nodes
    common_nodes = intersect(keys(exact_results), keys(sdp_results))
    
    if isempty(common_nodes)
        return Inf, Inf, Inf
    end
    
    absolute_errors = Float64[]
    relative_errors = Float64[]
    
    for node in common_nodes
        exact_val = exact_results[node]
        sdp_val = sdp_results[node]
        
        abs_error = abs(exact_val - sdp_val)
        push!(absolute_errors, abs_error)
        
        # Relative error (avoid division by zero)
        if abs(exact_val) > 1e-12
            rel_error = abs_error / abs(exact_val)
            push!(relative_errors, rel_error)
        end
    end
    
    max_abs_error = isempty(absolute_errors) ? 0.0 : maximum(absolute_errors)
    mean_abs_error = isempty(absolute_errors) ? 0.0 : mean(absolute_errors)
    max_rel_error = isempty(relative_errors) ? 0.0 : maximum(relative_errors)
    
    return max_abs_error, mean_abs_error, max_rel_error
end

"""
Run comparison test on a single network
"""
function test_single_network(network_alias::String, data_type::String="float")
    # Map network aliases to full names
    network_mappings = Dict(
        "karl" => "KarlNetwork",
        "karlnetwork" => "KarlNetwork", 
        "grid" => "grid-graph",
        "grid-graph" => "grid-graph",
        "metro" => "metro_directed_dag_for_ipm",
        "metro_directed_dag_for_ipm" => "metro_directed_dag_for_ipm",
        "munin" => "munin-dag",
        "munin-dag" => "munin-dag"
    )
    
    network_key = lowercase(network_alias)
    if !haskey(network_mappings, network_key)
        error("Unknown network: $network_alias. Available: $(keys(network_mappings))")
    end
    
    network_name = network_mappings[network_key]
    
    println("="^70)
    println("TESTING NETWORK: $network_alias ($network_name)")
    println("="^70)
    
    try
        # Load network data
        (edgelist, outgoing_index, incoming_index, source_nodes,
         node_priors, edge_probabilities, fork_nodes, join_nodes,
         iteration_sets, ancestors, descendants, root_diamonds, unique_diamonds) = 
            load_network_for_comparison(network_name, data_type)
        
        # Run exact algorithm
        exact_results, exact_time, exact_success = run_exact_algorithm(
            edgelist, iteration_sets, outgoing_index, incoming_index,
            source_nodes, node_priors, edge_probabilities, descendants,
            ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
        )
        
        # Run SDP algorithm  
        sdp_results, sdp_time, sdp_success = run_sdp_algorithm(
            edgelist, iteration_sets, outgoing_index, incoming_index,
            source_nodes, node_priors, edge_probabilities, descendants,
            ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
        )
        
        # Calculate accuracy metrics
        max_abs_error, mean_abs_error, max_rel_error = calculate_accuracy_metrics(
            exact_results, sdp_results
        )
        
        # Calculate speedup
        speedup_factor = exact_success && sdp_success ? exact_time / sdp_time : 0.0
        
        # Create comparison result
        result = ComparisonResult(
            network_name,
            exact_time, sdp_time, speedup_factor,
            exact_results, sdp_results,
            max_abs_error, mean_abs_error, max_rel_error,
            length(node_priors), length(edgelist), length(source_nodes), length(unique_diamonds),
            exact_success, sdp_success
        )
        
        # Print summary
        print_comparison_summary(result)
        
        return result
        
    catch e
        println("ERROR testing $network_alias: $e")
        rethrow(e)
    end
end

"""
Print comparison summary for a single network
"""
function print_comparison_summary(result::ComparisonResult)
    println("\nRESULTS SUMMARY:")
    println("  Network: $(result.network_name)")
    println("  Nodes: $(result.num_nodes), Edges: $(result.num_edges), Sources: $(result.num_sources)")
    println("  Diamonds: $(result.num_diamonds)")
    println()
    
    if result.exact_success && result.sdp_success
        println("  TIMING:")
        println("    Exact algorithm: $(round(result.exact_time, digits=3))s")
        println("    SDP algorithm:   $(round(result.sdp_time, digits=3))s")
        println("    Speedup factor:  $(round(result.speedup_factor, digits=2))x")
        println()
        
        println("  ACCURACY:")
        println("    Max absolute error:  $(round(result.max_absolute_error, digits=8))")
        println("    Mean absolute error: $(round(result.mean_absolute_error, digits=8))")
        println("    Max relative error:  $(round(result.max_relative_error * 100, digits=6))%")
        
        # Determine if results are acceptable
        if result.max_absolute_error < 1e-6
            println("    ✅ Results match within tolerance")
        elseif result.max_absolute_error < 1e-3
            println("    ⚠️  Results close but with some error")
        else
            println("    ❌ Results differ significantly")
        end
        
    else
        println("  STATUS:")
        println("    Exact algorithm: $(result.exact_success ? "✅ Success" : "❌ Failed")")
        println("    SDP algorithm:   $(result.sdp_success ? "✅ Success" : "❌ Failed")")
    end
end

"""
Run comparison test on multiple networks
"""
function run_comprehensive_comparison()
    test_networks = ["karl", "grid", "metro", "munin"]
    results = Vector{ComparisonResult}()
    
    println("="^70)
    println("SDP vs EXACT ALGORITHM COMPREHENSIVE COMPARISON")
    println("="^70)
    
    for network in test_networks
        try
            result = test_single_network(network)
            push!(results, result)
        catch e
            println("Failed to test $network: $e")
            continue
        end
        
        println()  # Spacing between networks
    end
    
    # Print overall summary
    print_overall_summary(results)
    
    return results
end

"""
Print overall comparison summary
"""
function print_overall_summary(results::Vector{ComparisonResult})
    if isempty(results)
        println("No successful tests to summarize")
        return
    end
    
    println("="^70)
    println("OVERALL COMPARISON SUMMARY")
    println("="^70)
    
    successful_results = filter(r -> r.exact_success && r.sdp_success, results)
    
    if !isempty(successful_results)
        println("\nSUCCESSFUL TESTS:")
        @printf("%-20s %10s %10s %8s %12s\n", "Network", "Exact(s)", "SDP(s)", "Speedup", "Max Error")
        println("-"^70)
        
        for result in successful_results
            @printf("%-20s %10.3f %10.3f %8.2fx %12.2e\n",
                result.network_name,
                result.exact_time,
                result.sdp_time, 
                result.speedup_factor,
                result.max_absolute_error
            )
        end
        
        # Calculate averages
        avg_speedup = mean([r.speedup_factor for r in successful_results])
        max_error_overall = maximum([r.max_absolute_error for r in successful_results])
        
        println("-"^70)
        println("Average speedup: $(round(avg_speedup, digits=2))x")
        println("Maximum error across all tests: $(round(max_error_overall, digits=8))")
    end
    
    # Report failed tests
    failed_results = filter(r -> !r.exact_success || !r.sdp_success, results)
    if !isempty(failed_results)
        println("\nFAILED TESTS:")
        for result in failed_results
            exact_status = result.exact_success ? "OK" : "FAILED"
            sdp_status = result.sdp_success ? "OK" : "FAILED"
            println("  $(result.network_name): Exact=$exact_status, SDP=$sdp_status")
        end
    end
end

# Helper function for formatted printing (no longer needed)
# function sprintf1(fmt::String, args...)
#     return Printf.@sprintf(fmt, args...)
# end

"""
Quick test function for individual networks
"""
function quick_test(network_alias::String)
    println("Quick SDP comparison test for: $network_alias")
    return test_single_network(network_alias)
end

"""
List available test networks
"""
function list_test_networks()
    println("Available networks for SDP comparison testing:")
    println("="^50)
    println("• karl     - KarlNetwork (small test network)")
    println("• grid     - grid-graph (4x4 structured)")  
    println("• metro    - metro_directed_dag_for_ipm (medium linear)")
    println("• munin    - munin-dag (large sparse)")
    println()
    println("Usage:")
    println("quick_test(\"karl\")              # Test single network")
    println("run_comprehensive_comparison()   # Test all networks")
end

# Example usage
# list_test_networks()
# quick_test("karl")
# results = run_comprehensive_comparison()