# Backend Server for Network Analysis
# Simple HTTP server that accepts file uploads and returns raw analysis results

using HTTP, JSON, ZipFile
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
    println("Server starting on port $PORT...")
    println("Upload directory: $UPLOAD_DIR")
end

function validate_network_structure(network_dir::String)
    # Check for required files
    required_files = [".EDGES"]
    required_dirs = ["float", "capacity", "cpm"]
    
    # Get network name from directory
    network_name = basename(network_dir)
    
    # Check for EDGES file
    edges_file = joinpath(network_dir, network_name * ".EDGES")
    if !isfile(edges_file)
        return false, "Missing .EDGES file"
    end
    
    # Check for required directories
    for dir in required_dirs
        dir_path = joinpath(network_dir, dir)
        if !isdir(dir_path)
            return false, "Missing $dir directory"
        end
    end
    
    return true, "Valid structure"
end

function process_network_analysis(network_path::String, data_type::String="float")
    try
        network_name = basename(network_path)
        
        # Validate structure
        is_valid, message = validate_network_structure(network_path)
        if !is_valid
            return Dict("error" => message, "success" => false)
        end
        
        # Run the comprehensive analysis
        analysis_results = run_network_analysis(network_name, network_path, data_type)
        
        return Dict(
            "success" => true,
            "network_name" => network_name,
            "data_type" => data_type,
            "timestamp" => Dates.now(),
            "results" => analysis_results
        )
        
    catch e
        return Dict(
            "success" => false,
            "error" => string(e),
            "timestamp" => Dates.now()
        )
    end
end

function run_network_analysis(network_name::String, base_path::String, data_type::String="float")
    # Modified version of your run_comprehensive_analysis that returns data
    results = Dict()
    
    # Construct file paths
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    
    json_network_name = replace(network_name, "_" => "-")
    filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")
    filepath_capacity_json = joinpath(base_path, "capacity", json_network_name * "-capacities.json")
    filepath_cpm_json = joinpath(base_path, "cpm", json_network_name * "-cpm-inputs.json")
    
    try
        println("Loading network structure...")
        
        # STEP 1: Read graph structure
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        
        # Network structure analysis
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Store network structure info
        results["network_structure"] = Dict(
            "total_nodes" => length(allnodes),
            "total_edges" => length(edgelist),
            "source_nodes" => collect(source_nodes),
            "sink_nodes" => collect(sink_nodes),
            "fork_nodes" => collect(fork_nodes),
            "join_nodes" => collect(join_nodes),
            "iteration_sets_count" => length(iteration_sets)
        )
        
        # STEP 2: Reachability Analysis
        if isfile(filepath_node_json) && isfile(filepath_edge_json)
            println("Running reachability analysis...")
            start_time = time()
            
            # Load reachability inputs
            node_priors = read_node_priors_from_json(filepath_node_json)
            edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
            
            # Diamond identification
            root_diamonds = identify_and_group_diamonds(
                join_nodes, incoming_index, ancestors, descendants,
                source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
            )
            
            unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                root_diamonds, node_priors, ancestors, descendants, iteration_sets
            )
            
            # Run reachability analysis
            reachability_output = update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities, descendants,
                ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
            )
            
            execution_time = time() - start_time
            
            # Convert to serializable format
            reachability_dict = Dict(string(k) => v for (k, v) in reachability_output)
            
            results["reachability"] = Dict(
                "node_beliefs" => reachability_dict,
                "execution_time" => execution_time,
                "diamonds_found" => length(unique_diamonds),
                "data_type" => data_type
            )
        end
        
        # STEP 3: Capacity Analysis
        if isfile(filepath_capacity_json)
            println("Running capacity analysis...")
            start_time = time()
            
            # Load capacity data
            capacity_data = JSON.parsefile(filepath_capacity_json)
            node_caps_raw = capacity_data["capacities"]["nodes"]
            edge_caps_raw = capacity_data["capacities"]["edges"]
            source_rates_raw = capacity_data["capacities"]["source_rates"]
            
            # Convert to proper types
            node_capacities = Dict{Int64, Float64}()
            for (k, v) in node_caps_raw
                node_capacities[parse(Int64, k)] = Float64(v)
            end
            
            edge_capacities = Dict{Tuple{Int64,Int64}, Float64}()
            for (k, v) in edge_caps_raw
                cleaned_key = replace(k, "(" => "", ")" => "")
                parts = split(cleaned_key, ",")
                edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                edge_capacities[edge_key] = Float64(v)
            end
            
            source_rates = Dict{Int64, Float64}()
            for (k, v) in source_rates_raw
                rate = Float64(v)
                if rate > 0.0
                    source_rates[parse(Int64, k)] = rate
                end
            end
            
            targets = Set{Int64}(sink_nodes)
            
            # Run capacity analysis
            capacity_params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)
            capacity_result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, capacity_params)
            
            execution_time = time() - start_time
            
            # Convert to serializable format
            target_flows = Dict(string(k) => v for (k, v) in capacity_result.node_max_flows if k in targets)
            
            results["capacity"] = Dict(
                "network_utilization" => capacity_result.network_utilization,
                "target_flows" => target_flows,
                "total_source_input" => sum(values(source_rates)),
                "total_target_output" => sum(capacity_result.node_max_flows[t] for t in targets),
                "active_sources" => collect(keys(source_rates)),
                "execution_time" => execution_time
            )
        end
        
        # STEP 4: Critical Path Analysis
        if isfile(filepath_cpm_json)
            println("Running critical path analysis...")
            start_time = time()
            
            # Load CPM data
            cpm_data = JSON.parsefile(filepath_cpm_json)
            time_analysis = cpm_data["time_analysis"]
            cost_analysis = cpm_data["cost_analysis"]
            
            # Convert time analysis data
            node_durations = Dict{Int64, Float64}()
            for (k, v) in time_analysis["node_durations"]
                node_durations[parse(Int64, k)] = Float64(v)
            end
            
            edge_delays = Dict{Tuple{Int64,Int64}, Float64}()
            for (k, v) in time_analysis["edge_delays"]
                cleaned_key = replace(k, "(" => "", ")" => "")
                parts = split(cleaned_key, ",")
                edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                edge_delays[edge_key] = Float64(v)
            end
            
            # Run time-based critical path analysis
            time_params = CriticalPathParameters(
                node_durations, edge_delays, 0.0,
                max_combination, additive_propagation, additive_propagation
            )
            time_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, time_params)
            
            # Convert cost analysis data
            node_costs = Dict{Int64, Float64}()
            for (k, v) in cost_analysis["node_costs"]
                node_costs[parse(Int64, k)] = Float64(v)
            end
            
            edge_costs = Dict{Tuple{Int64,Int64}, Float64}()
            for (k, v) in cost_analysis["edge_costs"]
                cleaned_key = replace(k, "(" => "", ")" => "")
                parts = split(cleaned_key, ",")
                edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                edge_costs[edge_key] = Float64(v)
            end
            
            # Run cost-based critical path analysis
            cost_params = CriticalPathParameters(
                node_costs, edge_costs, 0.0,
                max_combination, additive_propagation, additive_propagation
            )
            cost_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, cost_params)
            
            execution_time = time() - start_time
            
            results["critical_path"] = Dict(
                "time_analysis" => Dict(
                    "critical_duration" => time_result.critical_value,
                    "critical_nodes" => time_result.critical_nodes,
                    "node_values" => Dict(string(k) => v for (k, v) in time_result.node_values)
                ),
                "cost_analysis" => Dict(
                    "total_cost" => cost_result.critical_value,
                    "critical_nodes" => cost_result.critical_nodes,
                    "node_values" => Dict(string(k) => v for (k, v) in cost_result.node_values)
                ),
                "execution_time" => execution_time
            )
        end
        
    catch e
        results["error"] = string(e)
        results["success"] = false
        println("Error in analysis: ", e)
    end
    
    return results
end

# HTTP request handlers
function handle_upload(request::HTTP.Request)
    try
        # Set CORS headers
        headers = [
            "Access-Control-Allow-Origin" => "*",
            "Access-Control-Allow-Methods" => "POST, OPTIONS",
            "Access-Control-Allow-Headers" => "Content-Type",
            "Content-Type" => "application/json"
        ]
        
        if request.method == "OPTIONS"
            return HTTP.Response(200, headers)
        end
        
        if request.method != "POST"
            return HTTP.Response(405, headers, JSON.json(Dict("error" => "Method not allowed")))
        end
        
        # TODO: Implement proper multipart file upload handling
        # For now, return a placeholder response
        response_data = Dict(
            "success" => true,
            "message" => "File upload endpoint - implementation needed",
            "timestamp" => Dates.now()
        )
        
        return HTTP.Response(200, headers, JSON.json(response_data))
        
    catch e
        headers = ["Content-Type" => "application/json"]
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, headers, JSON.json(error_response))
    end
end

function handle_analyze(request::HTTP.Request)
    try
        headers = [
            "Access-Control-Allow-Origin" => "*",
            "Content-Type" => "application/json"
        ]
        
        # Parse query parameters for network path and data type
        uri = HTTP.URI(request.target)
        query_params = HTTP.queryparams(uri)
        
        network_path = get(query_params, "path", "")
        data_type = get(query_params, "data_type", "float")
        
        if isempty(network_path)
            error_response = Dict("success" => false, "error" => "Network path required")
            return HTTP.Response(400, headers, JSON.json(error_response))
        end
        
        # Run analysis
        results = process_network_analysis(network_path, data_type)
        
        return HTTP.Response(200, headers, JSON.json(results))
        
    catch e
        headers = ["Content-Type" => "application/json"]
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, headers, JSON.json(error_response))
    end
end

function start_server()
    setup_server()
    
    # Define routes
    router = HTTP.Router()
    HTTP.register!(router, "POST", "/upload", handle_upload)
    HTTP.register!(router, "GET", "/analyze", handle_analyze)
    HTTP.register!(router, "OPTIONS", "/upload", handle_upload)
    
    # Add a simple health check endpoint
    HTTP.register!(router, "GET", "/health", request -> begin
        headers = ["Content-Type" => "application/json"]
        response = Dict("status" => "healthy", "timestamp" => Dates.now())
        HTTP.Response(200, headers, JSON.json(response))
    end)
    
    # Start server
    HTTP.serve(router, "0.0.0.0", PORT)
end

# Run server if this file is executed directly
if abspath(PROGRAM_FILE) == @__FILE__
    start_server()
end