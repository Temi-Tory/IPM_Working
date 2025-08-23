using InformationPropagationAnalysis
using DelimitedFiles, JSON

function generate_test_baseline(network_name::String="power-network", data_type::String="float")
    # Test data paths
    base_path = joinpath(@__DIR__, "data", network_name)
    
    # Read network files
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json") 
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")
    
    println("Reading network from: $base_path")
    
    # Read the graph and priors (using your InputProcessing functions)
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
    node_priors = read_node_priors_from_json(filepath_node_json)
    edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
    
    println("Network loaded:")
    println("  Nodes: $(length(incoming_index))")
    println("  Edges: $(length(edgelist))")
    println("  Sources: $(length(source_nodes))")
    
    # Run your full algorithm pipeline
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
    
    println("Identifying diamonds...")
    root_diamonds = identify_and_group_diamonds(
        join_nodes, incoming_index, ancestors, descendants,
        source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
    )
    
    println("Building diamond storage...")
    unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
        root_diamonds, node_priors, ancestors, descendants, iteration_sets
    )
    
    println("Running reachability analysis...")
    results = update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, edge_probabilities, descendants,
        ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
    )
    
    # Save results for testing
    output_file = joinpath(base_path, "expected_results_$(data_type).json")
    open(output_file, "w") do f
        JSON.print(f, results, 4)
    end
    
    println("Expected results saved to: $output_file")
    println("Sample results:")
    for (node, value) in collect(results)[1:min(5, length(results))]
        println("  Node $node: $value")
    end
    
    return results
end

# Generate baseline for power network
println("Generating test baseline...")
results = generate_test_baseline()