import Fontconfig
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics, Dates, CSV

# Ensure we're running from the project root directory
# Navigate to project root if we're in a subdirectory
current_dir = pwd()
# Force compact output
#Base.IOContext(stdout, :compact => true, :limit => true)
# Include the IPAFramework module
include("../src/IPAFramework.jl")
using .IPAFramework

# Create method that takes file name and data type and calls full reachability algorithm
function calculateRechability(network_name::String, data_type::String="float")

    
    # Construct file paths using new folder structure
    base_path = joinpath("dag_ntwrk_files", network_name)

    # Option 1: Use edge file (recommended)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")

    # Option 2: Use original CSV adjacency matrix (if edge file doesn't exist)
    # filepath_graph = joinpath("csvfiles", network_name * ".csv")

    # JSON file paths in organized subfolders
    # Handle naming inconsistency: grid_graph vs grid-graph in JSON files
    json_network_name = replace(network_name, "_" => "-")  # Convert underscores to hyphens for JSON files
    filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")

    # Validate file existence
    if !isfile(filepath_graph)
        error("Graph file not found: $filepath_graph")
    end
    if !isfile(filepath_node_json)
        error("Node priors file not found: $filepath_node_json")
    end
    if !isfile(filepath_edge_json)
        error("Edge probabilities file not found: $filepath_edge_json")
    end

    # Read the graph and node priors
    # Option 1: Separate calls (gives you more control)
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)

    node_priors = read_node_priors_from_json(filepath_node_json)

    edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

    # Option 2: Convenience function (alternative approach)
    # edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities =
    #     read_complete_network(filepath_graph, filepath_node_json, filepath_edge_json)

    # Identify network structure
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

    # Start timing
    start_time = time()
    # Diamond structure analysis (if you have this function)
    root_diamonds = identify_and_group_diamonds(
        join_nodes,
        incoming_index,
        ancestors,
        descendants,
        source_nodes,
        fork_nodes,
        edgelist,
        node_priors,
        iteration_sets
    );
    l_root_diamonds = length(root_diamonds)
    println("Found $l_root_diamonds root_diamonds");
    println("Starting build unique diamond storage");
    unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
        root_diamonds,
        node_priors,
        ancestors,
        descendants,
        iteration_sets
    );
    l_unique_diamonds = length(unique_diamonds)
    println("Found $l_unique_diamonds unique_diamonds");
    # Run the main reachability algorithm
    output = IPAFramework.update_beliefs_iterative(
        edgelist,
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities,
        descendants,
        ancestors,
        root_diamonds,
        join_nodes,
        fork_nodes,
        unique_diamonds
    );
    
    # Calculate computation time
    computation_time = time() - start_time

        println("Starting Exact Path Enumeration");
    exact_start_time = time()
    exact_results = ( path_enumeration_result(
            outgoing_index,
            incoming_index,
            source_nodes,
            node_priors,
            edge_probabilities
        ));

    exact_computation_time = time() - exact_start_time
    
    # Print comparison results in a cleaner format
    println("\n" * "="^60)
    println("COMPARISON RESULTS: $network_name")
    println("="^60)
    println("Network Stats:")
    println("  Nodes: $(length(incoming_index))")
    println("  Edges: $(length(edgelist))")
    println("  Sources: $(length(source_nodes))")
    println("  Root Diamonds: $l_root_diamonds")
    println("  Unique Diamonds: $l_unique_diamonds")
    println()
    println("Performance:")
    println("  Algorithm Time: $(round(computation_time, digits=4))s")
    println("  Exact Time: $(round(exact_computation_time, digits=4))s")
    println("  Speedup: $(round(exact_computation_time/computation_time, digits=2))x")
    println()
    println("Accuracy:")
    max_algo = maximum(values(output))
    max_exact = maximum(values(exact_results))
    println("  Max Reachability (Algo): $(round(max_algo, digits=6))")
    println("  Max Reachability (Exact): $(round(max_exact, digits=6))")
    println("  Difference: $(round(abs(max_algo - max_exact), digits=8))")
    println("="^60)
    
    # Return sorted results and computation time
    return SortedDict(output), computation_time, OrderedDict(sort(collect(exact_results))), exact_computation_time
end

function runFullComparison(network_alias::String, data_type::String="float")
    # Define network mappings: alias -> (network_name, benchmark_csv_file)
    network_mappings = Dict(
        "grid" => ("grid-graph", "GRID_0.9x0.9_ExactComp.csv"),
        "grid-graph" => ("grid-graph", "GRID_0.9x0.9_ExactComp.csv"),
        "karl" => ("KarlNetwork", "KarlNetwork_0.9x0.9_1milruns.csv"),
        "karlnetwork" => ("KarlNetwork", "KarlNetwork_0.9x0.9_1milruns.csv"),
        "metro" => ("metro_directed_dag_for_ipm", "metro0.9x0.9_ExactComp.csv"),
        "metro_directed_dag_for_ipm" => ("metro_directed_dag_for_ipm", "metro0.9x0.9_ExactComp.csv"),
        "power" => ("power-network", "Power0.9x0.9_ExactComp.csv"),
        "power-network" => ("power-network", "Power0.9x0.9_ExactComp.csv"),
        "munin" => ("munin-dag", "sorted_mumin_result.csv"),
        "munin-dag" => ("munin-dag", "sorted_mumin_result.csv"),
        "munin-sub1" => ("munin-sub1", nothing),  # New munin-sub1 network
        "water" => ("water", nothing),  # New water network
        "layered" => ("layereddiamond-3", nothing),  # No benchmark file available
        "layereddiamond-3" => ("layereddiamond-3", nothing),
        "join" => ("join-260", nothing),  # No benchmark file available
        "join-260" => ("join-260", nothing),
        "grid5x5" => ("grid-graph-5x5",  nothing),  # No benchmark file available
        "ergo" => ("ergo-proxy-dag-network", nothing),  # No benchmark file available
        "medical" => ("continental_medical_network", nothing),
        "drone" => ("hierarchical_drone_medical", nothing)  # No benchmark file available
    )
    
    # Convert alias to lowercase for case-insensitive matching
    network_key = lowercase(network_alias)
    
    # Check if network alias exists
    if !haskey(network_mappings, network_key)
        available_networks = join(sort(collect(keys(network_mappings))), ", ")
        error("Unknown network alias: '$network_alias'. Available networks: $available_networks")
    end
    
    network_name, _ = network_mappings[network_key]
    
    println("="^70)
    println("RUNNING FULL COMPARISON FOR: $network_alias")
    println("="^70)
    println("Network name: $network_name")
    println("Data type: $data_type")
    println("="^70)
    
    return  calculateRechability(network_name, data_type)
end

algo_Result_dict, algotime, eaxct_result_dict, exact_Time = runFullComparison("medical");
println("Algorithm computation time: $(round(algotime, digits=4)) seconds")
println("Exact computation time: $(round(exact_Time, digits=4)) seconds")
df = DataFrame(
  Node = collect(keys(algo_Result_dict)),
  AlgoValue = collect(values(algo_Result_dict)),
  PathEnumValue = collect(values(eaxct_result_dict))
)
println("Comparison DataFrame: Ordered by absolute difference")
# Add a difference column (if needed)
df.Diff = abs.(df.AlgoValue .- df.PathEnumValue)
# Display sorted result (if you want to sort by the difference)
show(sort(df, :Diff, rev=true), allrows=true)

 