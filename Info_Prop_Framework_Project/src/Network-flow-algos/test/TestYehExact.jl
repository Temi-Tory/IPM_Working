"""
TestYehExact.jl - Quick test of Yeh's exact algorithm implementation
"""

include("../src/IPAFramework.jl")
using .IPAFramework

include("../src/Algorithms/YehExactSDPModule.jl")
using .YehExactSDPModule

function quick_test_yeh_exact(network_name::String="grid")
    # Map network aliases
    network_mappings = Dict(
        "karl" => "KarlNetwork",
        "grid" => "grid-graph", 
        "metro" => "metro_directed_dag_for_ipm",
        "munin" => "munin-dag"
    )
    
    full_network_name = network_mappings[lowercase(network_name)]
    
    println("Testing Yeh Exact SDP on: $full_network_name")
    
    # Load network data
    base_path = joinpath("dag_ntwrk_files", full_network_name)
    filepath_graph = joinpath(base_path, full_network_name * ".EDGES")
    json_network_name = replace(full_network_name, "_" => "-")
    filepath_node_json = joinpath(base_path, "float", json_network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, "float", json_network_name * "-linkprobabilities.json")
    
    # Load basic network structure
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
    node_priors = read_node_priors_from_json(filepath_node_json)
    edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
    
    println("Network loaded: $(length(node_priors)) nodes, $(length(edgelist)) edges")
    
    try
        # Test Yeh exact algorithm
        println("\nTesting Yeh Exact SDP...")
        yeh_exact_results = YehExactSDPModule.process_network_yeh_exact_sdp(
            edgelist, outgoing_index, incoming_index,
            source_nodes, node_priors, edge_probabilities
        )
        
        println("\nYeh Exact Results:")
        println("Computed results for $(length(yeh_exact_results)) nodes")
        
        # Show first few results
        sorted_results = sort(collect(yeh_exact_results), by=x->x[1])
        println("\nFirst 5 results:")
        for (node, prob) in sorted_results[1:min(5, end)]
            println("  Node $node: $(round(prob, digits=6))")
        end
        
        return yeh_exact_results
        
    catch e
        println("ERROR: $e")
        println("Stack trace:")
        for (exc, bt) in Base.catch_stack()
            showerror(stdout, exc, bt)
            println()
        end
        rethrow()
    end
end

# Run test
quick_test_yeh_exact("grid")