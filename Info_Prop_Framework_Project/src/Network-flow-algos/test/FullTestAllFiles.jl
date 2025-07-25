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
    
    # Return sorted results and computation time
    return SortedDict(output), computation_time
end

# Function to compare our algorithm results with CSV benchmark results
function compareWithBenchmark(sorted_algo_results::SortedDict, csv_filename::String, results_directory::String="results")
    # Construct full path to CSV file
    csv_filepath = joinpath(results_directory, csv_filename)
    
    # Check if file exists
    if !isfile(csv_filepath)
        error("CSV file not found: $csv_filepath")
    end
    
    # Read the CSV file
    benchmark_df = DataFrame(CSV.File(csv_filepath))
    
    # Create comparison DataFrame
    comparison_data = []
    
    # Iterate through our algorithm results
    for (node, our_value) in sorted_algo_results
        # Find matching node in benchmark data
        benchmark_row = filter(row -> row.Node == node, benchmark_df)
        
        if !isempty(benchmark_row)
            benchmark_value = benchmark_row[1, :ComparisonValue]
            difference = our_value - benchmark_value
            abs_difference = abs(difference)
            
            # Calculate percentage error if benchmark value is not zero
            perc_error = benchmark_value != 0 ? (abs_difference / abs(benchmark_value)) * 100 : 0.0
            
            push!(comparison_data, (
                Node = node,
                OurAlgoValue = our_value,
                BenchmarkAlgoValue = benchmark_value,
                AbsDifference = abs_difference,
                Difference = difference,
                PercError = perc_error
            ))
        else
            # Node not found in benchmark
            push!(comparison_data, (
                Node = node,
                OurAlgoValue = our_value,
                BenchmarkAlgoValue = missing,
                AbsDifference = missing,
                Difference = missing,
                PercError = missing
            ))
        end
    end
    
    # Convert to DataFrame
    comparison_df = DataFrame(comparison_data)
    
    # Sort by absolute difference descending (highest first)
    sort!(comparison_df, :AbsDifference, rev=true)
    
  
    
    # Display the full comparison DataFrame
    println("\nFULL COMPARISON RESULTS:")
    show(comparison_df#= , allrows=true =#)
    
    return comparison_df
end

# Comprehensive function that runs full pipeline with network aliases
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
    println("RUNNING FULL COMPARISON FOR: $network_alias")
    println("="^70)
    println("Network name: $network_name")
    println("Data type: $data_type")
    println("="^70)
    
    # Step 1: Run the reachability algorithm
    try
        sorted_results, computation_time = calculateRechability(network_name, data_type)
        println("⏱️  Computation time: $(round(computation_time, digits=4)) seconds")
        
        # Step 2: Compare with benchmark if available
        if benchmark_csv !== nothing
            try
                comparison_df = compareWithBenchmark(sorted_results, benchmark_csv)
                return comparison_df, computation_time
            catch e
                println("❌ Error during comparison: $e")
                println("Returning algorithm results only.")
                return sorted_results, computation_time, nothing
            end
        else
            println("\n⚠️  STEP 2: No benchmark file available for this network.")
            println("Showing algorithm results only:")
            println("\nAlgorithm Results (first 10 nodes):")
            count = 0
            for (node, value) in sorted_results
                if count >= 10
                    println("... (showing first 10 of $(length(sorted_results)) nodes)")
                    break
                end
                println("Node $node: $(round(value, digits=8))")
                count += 1
            end
            return
        end
        
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


#= open("diamondiscovery_grid.txt", "w") do file
    redirect_stdout(file) do
        comparison_df, computation_time = runFullComparison("grid");           # Karl network + KarlNetwork_0.9x0.9_1milruns.csv  
    end 
end
 =#

# Super simple - just use aliases!
#comparison_df, computation_time = runFullComparison("grid");          # Grid network + GRID_0.9x0.9_ExactComp.csv
#comparison_df, computation_time = runFullComparison("karl");           # Karl network + KarlNetwork_0.9x0.9_1milruns.csv  
#comparison_df, computation_time = runFullComparison("power");          # Power network + Power0.9x0.9_ExactComp.csv
#comparison_df, computation_time = runFullComparison("metro");          # Metro network + metro0.9x0.9_ExactComp.csv
#comparison_df, computation_time = runFullComparison("munin");          # Munin network + sorted_mumin_result.csv

#calculateRechability("real_drone_network")# the generated DAG HAS236 MAXIMAL diamodn which os usually not a problem 
#except that it crashes my computer even on 8 thread during build_unique_diamond_storage_depth_first_parallel
#.. its even worse with build_unique_diamond_storage i think may be bcz i combined both or created an unreaslistic DAG 

#calculateRechability("ergo-proxy-dag-network")
#calculateRechability("ergo-proxy-dag-network")
#comparison_df, computation_time = calculateRechability("emergency_supply_test")
#comparison_df, computation_time = calculateRechability("multi_stage_supply_chain")

#comparison_df, computation_time = calculateRechability("continental_medical_network")
 
#comparison_df, computation_time = calculateRechability("military_multi_domain_network")

#= 
filename = "central_belt_distribution"

filename = "highlands_emergency_network"

filename = "national_emergency_medical_network" =#

#filename = "central_belt_transfers_fixed" 

#filename = "highland_emergency_fixed" 

#filename = "comprehensive_islands_supply_network"

#filename = "highland_to_lowland_full_network"


#filename = "glasgow_to_shetland_extreme"


#filename = "multi_hospital_supply_hub"



 
open(filename * "_result.txt", "w") do file
    redirect_stdout(file) do
        comparison_df, computation_time = calculateRechability(filename);
        show(comparison_df) 
         show(computation_time) 
    end 
end

#comparison_df, computation_time = calculateRechability("realistic_failure_scenario")
# With different data types
# With different data types
#runFullComparison("karl", "interval")
#runFullComparison("power", "pbox")

# List available networks
#listAvailableNetworks()

