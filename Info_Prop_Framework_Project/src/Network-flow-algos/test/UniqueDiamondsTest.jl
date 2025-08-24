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
function calculateUniqueDiamonds(network_name::String, data_type::String="float")
    # Start timing
    start_time = time()
    
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

    # Diamond structure analysis (if you have this function)
    diamond_structures = identify_and_group_diamonds(
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

    println("Starting build unique diamond storage");
    unique_diamonds = build_unique_diamond_storage(
        diamond_structures,
        node_priors,
        ancestors,
        descendants,
        iteration_sets
    );
    
    
    # Calculate computation time
    computation_time = time() - start_time
    
    # Return sorted results and computation time
    return unique_diamonds, computation_time
end



# Comprehensive function that runs full pipeline with network aliases
function runFullDiscovery(network_alias::String, data_type::String="float")
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
        "layered" => ("layereddiamond-3", nothing),  # No benchmark file available
        "layereddiamond-3" => ("layereddiamond-3", nothing),
        "join" => ("join-260", nothing),  # No benchmark file available
        "join-260" => ("join-260", nothing),
        "ergo" => ("ergo-proxy-dag-network", nothing),  # No benchmark file available
        "ergo-proxy-dag-network" => ("ergo-proxy-dag-network", nothing),
        "drone" => ("real_drone_network", nothing)  # No benchmark file available
    )
    
    # Convert alias to lowercase for case-insensitive matching
    network_key = lowercase(network_alias)
    
    # Check if network alias exists
    if !haskey(network_mappings, network_key)
        available_networks = join(sort(collect(keys(network_mappings))), ", ")
        error("Unknown network alias: '$network_alias'. Available networks: $available_networks")
    end
    
    network_name, benchmark_csv = network_mappings[network_key]
    
    println("="^70)
    println("RUNNING FULL DISCOVERY FOR: $network_alias")
    println("="^70)
    println("Network name: $network_name")
    println("Data type: $data_type")
    println("="^70)
    
    # Step 1: Run the reachability algorithm
    try
        result, computation_time = calculateUniqueDiamonds(network_name, data_type)
        println("⏱️  Computation time: $(round(computation_time, digits=4)) seconds");
        
       return result, computation_time
    catch e
        println("❌ Error running algorithm: $e")
        rethrow(e)
    end
end

# Convenience function to list available networks
function listAvailableNetworks()
    networks = [
        ("grid", "Grid Graph (4x4)", "GRID_0.9x0.9_ExactComp.csv"),
        ("karl", "Karl Network", "KarlNetwork_0.9x0.9_1milruns.csv"),
        ("metro", "Metro Directed DAG", "metro0.9x0.9_ExactComp.csv"),
        ("power", "Power Network", "Power0.9x0.9_ExactComp.csv"),
        ("munin", "Munin DAG", "sorted_mumin_result.csv"),
        ("layered", "Layered Diamond-3", "No benchmark"),
        ("join", "Join-260", "No benchmark"),
        ("ergo", "Ergo Proxy DAG Network", "No benchmark"),
        ("drone", "Real Drone Network", "No benchmark")
    ]
    
    println("Available Networks:")
    println("="^60)
    for (alias, description, benchmark) in networks
        println("• $alias - $description")
        println("  Benchmark: $benchmark")
        println()
    end
    
    println("Usage examples:")
    println("runFullComparison(\"grid\")  # Uses float data type")
    println("runFullComparison(\"karl\", \"interval\")  # Uses interval data type")
    println("runFullComparison(\"power\", \"pbox\")  # Uses pbox data type")
end


# Super simple - just use aliases!
#comparison_df, computation_time = runFullDiscovery("grid");          # Grid network + GRID_0.9x0.9_ExactComp.csv
comparison_df, computation_time = runFullDiscovery("karl");           # Karl network + KarlNetwork_0.9x0.9_1milruns.csv  
#comparison_df, computation_time = runFullDiscovery("power");          # Power network + Power0.9x0.9_ExactComp.csv
#comparison_df, computation_time = runFullDiscovery("metro");          # Metro network + metro0.9x0.9_ExactComp.csv
#comparison_df, computation_time = runFullDiscovery("munin");          # Munin network + sorted_mumin_result.csv

#runFullDiscovery("real_drone_network")
#x = runFullDiscovery("ergo-proxy-dag-network")

# With different data types
#runFullDiscovery("karl", "interval")
#runFullDiscovery("power", "pbox")

# List available networks
#listAvailableNetworks()

