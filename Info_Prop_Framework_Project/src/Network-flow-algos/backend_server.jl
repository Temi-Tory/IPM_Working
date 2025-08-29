# Flexible Multi-Scenario Backend Server for Network Analysis
# Supports user-specified input paths for each analysis scenario
# Based on expected raw results structure and Julia algorithm requirements

using HTTP, JSON
using Dates, UUIDs

# Include the IPAFramework module
include("src/IPAFramework.jl")
using .IPAFramework

const UPLOAD_DIR = "temp_uploads"
const PORT = 8080

function setup_server()
    # Create upload directory if it doesn't exist
    if !isdir(UPLOAD_DIR)
        mkdir(UPLOAD_DIR)
    end
    println("Flexible Multi-Scenario Backend Server starting on port $PORT...")
    println("Upload directory: $UPLOAD_DIR")
end

function validate_network_structure(network_dir::String)
    # Check for required .EDGES file
    network_name = basename(network_dir)
    edges_file = joinpath(network_dir, network_name * ".EDGES")
    if !isfile(edges_file)
        return false, "Missing .EDGES file: $edges_file"
    end
    return true, "Valid structure"
end

function create_default_node_priors(allnodes::Vector{Int64})
    """Create default node priors (all 1.0) for diamond-only analysis"""
    return Dict{Int64, Float64}(node => 1.0 for node in allnodes)
end

function run_conditional_network_analysis(request_data::Dict, temp_dir::String)
    """
    Flexible multi-scenario network analysis.
    Users specify exact input paths for each analysis scenario they want to run.
    
    Expected request_data structure:
    {
        "networkPath": "/path/to/network",
        "reachabilityScenarios": [
            {
                "name": "float_scenario_1",
                "nodepriors_path": "float/power-network-nodepriors.json",
                "linkprobs_path": "float/power-network-linkprobabilities.json"
            },
            {
                "name": "pbox_scenario_1", 
                "nodepriors_path": "pbox/power-network-nodepriors.json",
                "linkprobs_path": "pbox/power-network-linkprobabilities.json"
            }
        ],
        "capacityScenarios": [
            {
                "name": "capacity_scenario_1",
                "capacities_path": "capacity/power-network-capacities.json"
            }
        ],
        "cpmScenarios": [
            {
                "name": "cpm_scenario_1",
                "cpm_path": "cpm/power-network-cpm-inputs.json"
            }
        ],
        "analysisConfig": {
            "exactInference": true,
            "diamondAnalysis": true,
            "flowAnalysis": true,
            "criticalPath": true
        }
    }
    """
    results = Dict()
    
    # Extract network path from request
    network_path = get(request_data, "networkPath", "")
    if isempty(network_path)
        throw("Network path not provided in request")
    end
    
    # Validate network structure
    is_valid, message = validate_network_structure(network_path)
    if !is_valid
        throw("Invalid network structure: $message")
    end
    
    network_name = basename(network_path)
    analysis_config = get(request_data, "analysisConfig", Dict())
    
    # Construct graph file path
    filepath_graph = joinpath(network_path, network_name * ".EDGES")
    
    println("Processing network: $network_name")
    println("Graph file: $filepath_graph")
    
    # STEP 1: Network Structure Analysis (always performed)
    println("STEP 1: Network Structure Analysis")
    start_time = time()
    
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
    allnodes = collect(keys(incoming_index))
    sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
    
    # Identify network structure
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
    
    network_structure_time = time() - start_time
    
    results["network_structure"] = Dict(
        "computation_time" => network_structure_time,
        "total_nodes" => length(allnodes),
        "total_edges" => length(edgelist),
        "nodes" => allnodes,
        "edges" => [(e[1], e[2]) for e in edgelist],
        "source_nodes" => collect(source_nodes),
        "sink_nodes" => collect(sink_nodes),
        "fork_nodes" => collect(fork_nodes),
        "join_nodes" => collect(join_nodes),
        "iteration_sets" => [collect(s) for s in iteration_sets],
        "iteration_sets_count" => length(iteration_sets),
        "ancestors" => Dict(string(k) => collect(v) for (k, v) in ancestors),
        "descendants" => Dict(string(k) => collect(v) for (k, v) in descendants),
        "outgoing_index" => Dict(string(k) => collect(v) for (k, v) in outgoing_index),
        "incoming_index" => Dict(string(k) => collect(v) for (k, v) in incoming_index)
    )
    
    println("  Network structure complete: $(round(network_structure_time, digits=4)) seconds")
    
    # STEP 2: Process Reachability Scenarios (with Diamond Analysis per scenario)
    reachability_scenarios = get(request_data, "reachabilityScenarios", [])
    if !isempty(reachability_scenarios) && (get(analysis_config, "exactInference", false) || get(analysis_config, "diamondAnalysis", false))
        println("STEP 2: Processing Reachability Scenarios")
        
        results["reachability_scenarios"] = Dict()
        
        for scenario in reachability_scenarios
            scenario_name = get(scenario, "name", "unnamed_scenario")
            nodepriors_path = get(scenario, "nodepriors_path", "")
            linkprobs_path = get(scenario, "linkprobs_path", "")
            
            if isempty(nodepriors_path) || isempty(linkprobs_path)
                println("  Skipping scenario $scenario_name: missing input paths")
                continue
            end
            
            # Construct full file paths
            full_nodepriors_path = joinpath(network_path, nodepriors_path)
            full_linkprobs_path = joinpath(network_path, linkprobs_path)
            
            if !isfile(full_nodepriors_path) || !isfile(full_linkprobs_path)
                println("  Skipping scenario $scenario_name: input files not found")
                continue
            end
            
            println("  Processing scenario: $scenario_name")
            scenario_start_time = time()
            
            # Load reachability inputs for this scenario
            node_priors = read_node_priors_from_json(full_nodepriors_path)
            edge_probabilities = read_edge_probabilities_from_json(full_linkprobs_path)
            
            scenario_results = Dict()
            
            # Diamond Analysis for this scenario (if requested)
            if get(analysis_config, "diamondAnalysis", false)
                diamond_start_time = time()
                
                # Root diamonds
                root_diamonds = identify_and_group_diamonds(
                    join_nodes, incoming_index, ancestors, descendants,
                    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
                )
                root_computation_time = time() - diamond_start_time
                
                # Unique diamonds
                unique_start_time = time()
                unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                    root_diamonds, node_priors, ancestors, descendants, iteration_sets
                )
                unique_computation_time = time() - unique_start_time
                
                scenario_results["diamond_analysis"] = Dict(
                    "root_diamonds_count" => length(root_diamonds),
                    "unique_diamonds_count" => length(unique_diamonds),
                    "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
                    "root_computation_time" => root_computation_time,
                    "unique_computation_time" => unique_computation_time,
                    "total_computation_time" => root_computation_time + unique_computation_time,
                    "diamond_efficiency" => length(unique_diamonds) / max(1, length(root_diamonds))
                )
                
                # Store for exact inference
                scenario_results["_internal_root_diamonds"] = root_diamonds
                scenario_results["_internal_unique_diamonds"] = unique_diamonds
            end
            
            # Exact Inference for this scenario (if requested)
            if get(analysis_config, "exactInference", false)
                inference_start_time = time()
                
                # Get diamonds (compute if not already done)
                if !haskey(scenario_results, "_internal_root_diamonds")
                    root_diamonds = identify_and_group_diamonds(
                        join_nodes, incoming_index, ancestors, descendants,
                        source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
                    )
                    unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                        root_diamonds, node_priors, ancestors, descendants, iteration_sets
                    )
                else
                    root_diamonds = scenario_results["_internal_root_diamonds"]
                    unique_diamonds = scenario_results["_internal_unique_diamonds"]
                end
                
                output = IPAFramework.update_beliefs_iterative(
                    edgelist, iteration_sets, outgoing_index, incoming_index,
                    source_nodes, node_priors, edge_probabilities,
                    descendants, ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
                )
                
                inference_computation_time = time() - inference_start_time
                
                # Convert beliefs to serializable format
                beliefs_dict = Dict()
                for (node, belief) in output
                    beliefs_dict[string(node)] = Float64(belief)
                end
                
                scenario_results["exact_inference"] = Dict(
                    "beliefs" => beliefs_dict,
                    "computation_time" => inference_computation_time,
                    "total_nodes_processed" => length(output),
                    "belief_statistics" => Dict(
                        "mean" => length(output) > 0 ? sum(values(output)) / length(output) : 0.0,
                        "min" => length(output) > 0 ? minimum(values(output)) : 0.0,
                        "max" => length(output) > 0 ? maximum(values(output)) : 0.0
                    )
                )
            end
            
            # Clean up internal data
            delete!(scenario_results, "_internal_root_diamonds")
            delete!(scenario_results, "_internal_unique_diamonds")
            
            scenario_total_time = time() - scenario_start_time
            scenario_results["scenario_computation_time"] = scenario_total_time
            scenario_results["input_files"] = Dict(
                "nodepriors_path" => nodepriors_path,
                "linkprobs_path" => linkprobs_path
            )
            
            results["reachability_scenarios"][scenario_name] = scenario_results
            println("    Scenario $scenario_name complete: $(round(scenario_total_time, digits=4)) seconds")
        end
    end
    
    # STEP 3: Diamond Analysis (standalone, if no reachability scenarios but diamond analysis requested)
    if get(analysis_config, "diamondAnalysis", false) && isempty(reachability_scenarios)
        println("STEP 3: Standalone Diamond Analysis (using default node priors)")
        diamond_start_time = time()
        
        # Create default node priors (all 1.0) for diamond analysis
        default_node_priors = create_default_node_priors(allnodes)
        
        # Root diamonds
        root_diamonds = identify_and_group_diamonds(
            join_nodes, incoming_index, ancestors, descendants,
            source_nodes, fork_nodes, edgelist, default_node_priors, iteration_sets
        )
        root_computation_time = time() - diamond_start_time
        
        # Unique diamonds
        unique_start_time = time()
        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds, default_node_priors, ancestors, descendants, iteration_sets
        )
        unique_computation_time = time() - unique_start_time
        
        results["diamond_analysis"] = Dict(
            "root_diamonds_count" => length(root_diamonds),
            "unique_diamonds_count" => length(unique_diamonds),
            "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
            "root_computation_time" => root_computation_time,
            "unique_computation_time" => unique_computation_time,
            "total_computation_time" => root_computation_time + unique_computation_time,
            "diamond_efficiency" => length(unique_diamonds) / max(1, length(root_diamonds)),
            "note" => "Used default node priors (all 1.0) for standalone diamond analysis"
        )
        
        println("  Standalone diamond analysis complete: $(round(root_computation_time + unique_computation_time, digits=4)) seconds")
    end
    
    # STEP 4: Process Capacity Scenarios
    capacity_scenarios = get(request_data, "capacityScenarios", [])
    if !isempty(capacity_scenarios) && get(analysis_config, "flowAnalysis", false)
        println("STEP 4: Processing Capacity Scenarios")
        
        results["capacity_scenarios"] = Dict()
        
        for scenario in capacity_scenarios
            scenario_name = get(scenario, "name", "unnamed_capacity_scenario")
            capacities_path = get(scenario, "capacities_path", "")
            
            if isempty(capacities_path)
                println("  Skipping capacity scenario $scenario_name: missing capacities_path")
                continue
            end
            
            # Construct full file path
            full_capacities_path = joinpath(network_path, capacities_path)
            
            if !isfile(full_capacities_path)
                println("  Skipping capacity scenario $scenario_name: capacities file not found")
                continue
            end
            
            println("  Processing capacity scenario: $scenario_name")
            capacity_start_time = time()
            
            # Load capacity data
            capacity_data = JSON.parsefile(full_capacities_path)
            node_caps_raw = capacity_data["capacities"]["nodes"]
            edge_caps_raw = capacity_data["capacities"]["edges"]
            source_rates_raw = capacity_data["capacities"]["source_rates"]
            
            # Convert to proper types
            node_capacities = Dict{Int64,Float64}()
            for (k, v) in node_caps_raw
                node_capacities[parse(Int64, k)] = Float64(v)
            end
            
            edge_capacities = Dict{Tuple{Int64,Int64},Float64}()
            for (k, v) in edge_caps_raw
                cleaned_key = replace(k, "(" => "", ")" => "")
                parts = split(cleaned_key, ",")
                edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                edge_capacities[edge_key] = Float64(v)
            end
            
            source_rates = Dict{Int64,Float64}()
            for (k, v) in source_rates_raw
                rate = Float64(v)
                if rate > 0.0  # Only include active sources
                    source_rates[parse(Int64, k)] = rate
                end
            end
            
            # Target nodes are sink nodes
            targets = Set{Int64}(sink_nodes)
            
            # Run capacity analysis
            capacity_params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)
            capacity_result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, capacity_params)
            
            capacity_computation_time = time() - capacity_start_time
            
            # Extract flow results
            target_flows = Dict()
            for target in targets
                if haskey(capacity_result.node_max_flows, target)
                    target_flows[string(target)] = capacity_result.node_max_flows[target]
                end
            end
            
            scenario_results = Dict(
                "computation_time" => capacity_computation_time,
                "network_utilization" => capacity_result.network_utilization,
                "total_source_input" => sum(values(source_rates)),
                "total_target_output" => sum(values(target_flows)),
                "target_flows" => target_flows,
                "active_sources" => collect(keys(source_rates)),
                "target_nodes" => collect(targets),
                "node_capacities_count" => length(node_capacities),
                "edge_capacities_count" => length(edge_capacities),
                "input_files" => Dict("capacities_path" => capacities_path)
            )
            
            results["capacity_scenarios"][scenario_name] = scenario_results
            println("    Capacity scenario $scenario_name complete: $(round(capacity_computation_time, digits=4)) seconds")
        end
    end
    
    # STEP 5: Process CPM Scenarios
    cpm_scenarios = get(request_data, "cpmScenarios", [])
    if !isempty(cpm_scenarios) && get(analysis_config, "criticalPath", false)
        println("STEP 5: Processing CPM Scenarios")
        
        results["cpm_scenarios"] = Dict()
        
        for scenario in cpm_scenarios
            scenario_name = get(scenario, "name", "unnamed_cpm_scenario")
            cpm_path = get(scenario, "cpm_path", "")
            
            if isempty(cpm_path)
                println("  Skipping CPM scenario $scenario_name: missing cpm_path")
                continue
            end
            
            # Construct full file path
            full_cpm_path = joinpath(network_path, cpm_path)
            
            if !isfile(full_cpm_path)
                println("  Skipping CPM scenario $scenario_name: CPM file not found")
                continue
            end
            
            println("  Processing CPM scenario: $scenario_name")
            cpm_start_time = time()
            
            # Load CPM data
            cmp_data = JSON.parsefile(full_cpm_path)
            time_analysis = cpm_data["time_analysis"]
            cost_analysis = cpm_data["cost_analysis"]
            
            # Convert time analysis data
            node_durations_raw = time_analysis["node_durations"]
            edge_delays_raw = time_analysis["edge_delays"]
            
            node_durations = Dict{Int64,Float64}()
            for (k, v) in node_durations_raw
                node_durations[parse(Int64, k)] = Float64(v)
            end
            
            edge_delays = Dict{Tuple{Int64,Int64},Float64}()
            for (k, v) in edge_delays_raw
                cleaned_key = replace(k, "(" => "", ")" => "")
                parts = split(cleaned_key, ",")
                edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                edge_delays[edge_key] = Float64(v)
            end
            
            # Convert cost analysis data
            node_costs_raw = cost_analysis["node_costs"]
            edge_costs_raw = cost_analysis["edge_costs"]
            
            node_costs = Dict{Int64,Float64}()
            for (k, v) in node_costs_raw
                node_costs[parse(Int64, k)] = Float64(v)
            end
            
            edge_costs = Dict{Tuple{Int64,Int64},Float64}()
            for (k, v) in edge_costs_raw
                cleaned_key = replace(k, "(" => "", ")" => "")
                parts = split(cleaned_key, ",")
                edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                edge_costs[edge_key] = Float64(v)
            end
            
            # Run time-based critical path analysis
            time_params = CriticalPathParameters(
                node_durations, edge_delays, 0.0,
                max_combination, additive_propagation, additive_propagation
            )
            time_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, time_params)
            
            # Run cost-based critical path analysis
            cost_params = CriticalPathParameters(
                node_costs, edge_costs, 0.0,
                max_combination, additive_propagation, additive_propagation
            )
            cost_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, cost_params)
            
            cpm_computation_time = time() - cpm_start_time
            
            scenario_results = Dict(
                "computation_time" => cpm_computation_time,
                "time_result" => Dict(
                    "critical_value" => time_result.critical_value,
                    "critical_nodes" => collect(time_result.critical_nodes),
                    "node_values" => Dict(string(k) => v for (k, v) in time_result.node_values)
                ),
                "cost_result" => Dict(
                    "critical_value" => cost_result.critical_value,
                    "critical_nodes" => collect(cost_result.critical_nodes),
                    "node_values" => Dict(string(k) => v for (k, v) in cost_result.node_values)
                ),
                "node_durations_count" => length(node_durations),
                "edge_delays_count" => length(edge_delays),
                "node_costs_count" => length(node_costs),
                "edge_costs_count" => length(edge_costs),
                "input_files" => Dict("cpm_path" => cpm_path)
            )
            
            results["cpm_scenarios"][scenario_name] = scenario_results
            println("    CPM scenario $scenario_name complete: $(round(cmp_computation_time, digits=4)) seconds")
        end
    end
    
    # Add summary
    total_time = sum([
        get(get(results, "network_structure", Dict()), "computation_time", 0.0),
        sum([get(scenario, "scenario_computation_time", 0.0) for scenario in values(get(results, "reachability_scenarios", Dict()))]),
        get(get(results, "diamond_analysis", Dict()), "total_computation_time", 0.0),
        sum([get(scenario, "computation_time", 0.0) for scenario in values(get(results, "capacity_scenarios", Dict()))]),
        sum([get(scenario, "computation_time", 0.0) for scenario in values(get(results, "cpm_scenarios", Dict()))])
    ])
    
    results["analysis_summary"] = Dict(
        "network_name" => network_name,
        "total_computation_time" => total_time,
        "reachability_scenarios_count" => length(get(results, "reachability_scenarios", Dict())),
        "capacity_scenarios_count" => length(get(results, "capacity_scenarios", Dict())),
        "cpm_scenarios_count" => length(get(results, "cmp_scenarios", Dict())),
        "timestamp" => Dates.now()
    )
    
    println("Multi-scenario analysis complete! Total time: $(round(total_time, digits=4)) seconds")
    
    return results
end

function process_network_analysis_with_config(network_path::String, network_name::String, analysis_config::Dict)
    try
        # Create request data format expected by run_conditional_network_analysis
        request_data = merge(analysis_config, Dict("networkPath" => network_path))
        
        # Run the flexible multi-scenario analysis
        analysis_results = run_conditional_network_analysis(request_data, "")
        
        return Dict(
            "success" => true,
            "network_name" => network_name,
            "timestamp" => Dates.now(),
            "analysis_config" => analysis_config,
            "results" => analysis_results
        )
        
    catch e
        return Dict(
            "success" => false,
            "error" => string(e),
            "timestamp" => Dates.now(),
            "network_name" => network_name
        )
    end
end

# HTTP request handlers
function handle_upload(req::HTTP.Request)
    try
        # Handle file upload logic here
        # This is a placeholder - implement based on your upload requirements
        return HTTP.Response(200, JSON.json(Dict("message" => "Upload endpoint ready")))
    catch e
        return HTTP.Response(500, JSON.json(Dict("error" => string(e))))
    end
end

function handle_analysis(req::HTTP.Request)
    try
        # Parse request body
        request_data = JSON.parse(String(req.body))
        
        # Extract network path and analysis config
        network_path = get(request_data, "networkPath", "")
        network_name = basename(network_path)
        
        # Process the analysis
        result = process_network_analysis_with_config(network_path, network_name, request_data)
        
        return HTTP.Response(200, JSON.json(result))
    catch e
        error_response = Dict(
            "success" => false,
            "error" => string(e),
            "timestamp" => Dates.now()
        )
        return HTTP.Response(500, JSON.json(error_response))
    end
end

function handle_cors(req::HTTP.Request)
    headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization"
    ]
    
    if req.method == "OPTIONS"
        return HTTP.Response(200, headers)
    end
    
    return nothing
end

# Main server function
function start_server()
    setup_server()
    
    # Define routes
    router = HTTP.Router()
    
    # Add CORS middleware
    HTTP.register!(router, "OPTIONS", "/*", handle_cors)
    
    # API routes
    HTTP.register!(router, "POST", "/upload", handle_upload)
    HTTP.register!(router, "POST", "/analyze", handle_analysis)
    
    # Health check
    HTTP.register!(router, "GET", "/health", req -> HTTP.Response(200, JSON.json(Dict("status" => "healthy"))))
    
    # Start server
    println("Starting flexible multi-scenario backend server...")
    HTTP.serve(router, "0.0.0.0", PORT)
end

# Export main functions
export start_server, run_conditional_network_analysis, process_network_analysis_with_config

# Start server if run directly
if abspath(PROGRAM_FILE) == @__FILE__
    start_server()
end