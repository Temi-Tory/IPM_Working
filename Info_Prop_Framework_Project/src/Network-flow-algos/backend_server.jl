# Backend Server for Network Analysis
# Simple HTTP server that accepts file uploads and returns raw analysis results

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

function process_network_analysis_with_config(network_path::String, network_name::String, analysis_config::Dict)
    try
        # Run the conditional analysis
        analysis_results = run_conditional_network_analysis(network_name, network_path, analysis_config)
        
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

function run_conditional_network_analysis(network_name::String, base_path::String, analysis_config::Dict)
    results = Dict()
    
    # Construct file paths
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    
    # Check if edges file exists
    if !isfile(filepath_graph)
        throw("Required .EDGES file not found at: $filepath_graph")
    end
    
    data_type = get(analysis_config, "inferenceDataType", "float")
    json_network_name = replace(network_name, "_" => "-")
    filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")
    filepath_capacity_json = joinpath(base_path, "capacity", json_network_name * "-capacities.json")
    filepath_cpm_json = joinpath(base_path, "cpm", json_network_name * "-cpm-inputs.json")
    
    try
        println("Loading network structure for: ", network_name)
        
        # STEP 1: Always read graph structure (required for all analyses)
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        
        # Network structure analysis (always performed)
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Store network structure info (always included)
        results["network_structure"] = Dict(
            "total_nodes" => length(allnodes),
            "total_edges" => length(edgelist),
            "source_nodes" => collect(source_nodes),
            "sink_nodes" => collect(sink_nodes),
            "fork_nodes" => collect(fork_nodes),
            "join_nodes" => collect(join_nodes),
            "iteration_sets_count" => length(iteration_sets)
        )
        
        # STEP 2: Conditional Exact Inference Analysis
        if get(analysis_config, "exactInference", false)
            if isfile(filepath_node_json) && isfile(filepath_edge_json)
                println("Running exact inference analysis...")
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
                
                results["exact_inference"] = Dict(
                    "node_beliefs" => reachability_dict,
                    "execution_time" => execution_time,
                    "diamonds_found" => length(unique_diamonds),
                    "data_type" => data_type
                )
            else
                results["exact_inference"] = Dict(
                    "error" => "Required inference files not found",
                    "required_files" => [filepath_node_json, filepath_edge_json]
                )
            end
        end
        
        # STEP 3: Conditional Flow Analysis
        if get(analysis_config, "flowAnalysis", false)
            if isfile(filepath_capacity_json)
                println("Running flow analysis...")
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
                
                results["flow_analysis"] = Dict(
                    "network_utilization" => capacity_result.network_utilization,
                    "target_flows" => target_flows,
                    "total_source_input" => sum(values(source_rates)),
                    "total_target_output" => sum(capacity_result.node_max_flows[t] for t in targets),
                    "active_sources" => collect(keys(source_rates)),
                    "execution_time" => execution_time
                )
            else
                results["flow_analysis"] = Dict(
                    "error" => "Required capacity file not found",
                    "required_file" => filepath_capacity_json
                )
            end
        end
        
        # STEP 4: Conditional Critical Path Analysis
        if get(analysis_config, "criticalPathAnalysis", false)
            if isfile(filepath_cpm_json)
                println("Running critical path analysis...")
                start_time = time()
                
                # Load CPM data
                cpm_data = JSON.parsefile(filepath_cpm_json)
                time_analysis = cpm_data["time_analysis"]
                cost_analysis = cpm_data["cost_analysis"]
                
                cpm_options = get(analysis_config, "criticalPathOptions", Dict("enableTime" => true, "enableCost" => true))
                cpm_results = Dict()
                
                # Time analysis if enabled
                if get(cpm_options, "enableTime", true)
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
                    
                    cpm_results["time_analysis"] = Dict(
                        "critical_duration" => time_result.critical_value,
                        "critical_nodes" => time_result.critical_nodes,
                        "node_values" => Dict(string(k) => v for (k, v) in time_result.node_values)
                    )
                end
                
                # Cost analysis if enabled
                if get(cpm_options, "enableCost", true)
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
                    
                    cmp_results["cost_analysis"] = Dict(
                        "total_cost" => cost_result.critical_value,
                        "critical_nodes" => cost_result.critical_nodes,
                        "node_values" => Dict(string(k) => v for (k, v) in cost_result.node_values)
                    )
                end
                
                execution_time = time() - start_time
                cpm_results["execution_time"] = execution_time
                
                results["critical_path"] = cpm_results
            else
                results["critical_path"] = Dict(
                    "error" => "Required CPM file not found",
                    "required_file" => filepath_cpm_json
                )
            end
        end
        
    catch e
        results["error"] = string(e)
        results["success"] = false
        println("Error in conditional analysis: ", e)
    end
    
    return results
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
function parse_multipart_data(body, content_type)
    try
        # Extract boundary from Content-Type header
        boundary_match = match(r"boundary=([^\s;]+)", content_type)
        if boundary_match === nothing
            throw(ArgumentError("No boundary found in Content-Type header"))
        end
        boundary = "--" * boundary_match.captures[1]
        
        # Convert body to string if needed
        body_string = isa(body, Vector{UInt8}) ? String(body) : string(body)
        
        # Split body by boundary
        parts = split(body_string, boundary)
        
        files = Dict{String, Any}()
        
        for part in parts[2:end-1]  # Skip first empty part and last closing part
            part_str = strip(part)
            if isempty(part_str)
                continue
            end
            
            # Split headers from data
            header_end = findfirst("\r\n\r\n", part_str)
            if header_end === nothing
                continue
            end
            
            headers_section = part_str[1:header_end[1]-1]
            data_section = part_str[header_end[end]+1:end]
            
            # Parse Content-Disposition header
            name_match = match(r"name=\"([^\"]+)\"", headers_section)
            filename_match = match(r"filename=\"([^\"]+)\"", headers_section)
            
            if name_match !== nothing
                field_name = name_match.captures[1]
                
                if filename_match !== nothing
                    # This is a file field
                    filename = filename_match.captures[1]
                    # Remove trailing \r\n if present
                    file_data = endswith(data_section, "\r\n") ? data_section[1:end-2] : data_section
                    files[field_name] = (filename = filename, data = Vector{UInt8}(file_data))
                else
                    # This is a regular form field (like analysisConfig)
                    field_data = endswith(data_section, "\r\n") ? data_section[1:end-2] : data_section
                    files[field_name] = (filename = "", data = Vector{UInt8}(field_data))
                end
            end
        end
        
        return files
        
    catch e
        println("Multipart parsing error: ", e)
        rethrow()
    end
end

function build_network_directory(upload_path::String, network_name::String, files::Dict, analysis_config::Dict)
    # Create main network directory
    network_dir = joinpath(upload_path, network_name)
    mkpath(network_dir)
    
    # Create subdirectories
    for subdir in ["float", "capacity", "cpm"]
        mkpath(joinpath(network_dir, subdir))
    end
    
    # Save EDGES file
    if haskey(files, "edges")
        edges_path = joinpath(network_dir, network_name * ".EDGES")
        open(edges_path, "w") do f
            write(f, files["edges"].data)
        end
    end
    
    # Save node mapping if present
    if haskey(files, "nodeMapping")
        mapping_path = joinpath(network_dir, network_name * ".MAPPING")
        open(mapping_path, "w") do f
            write(f, files["nodeMapping"].data)
        end
    end
    
    # Save inference files if enabled
    if get(analysis_config, "exactInference", false) && haskey(files, "nodepriors")
        data_type = get(analysis_config, "inferenceDataType", "float")
        json_network_name = replace(network_name, "_" => "-")
        
        # Ensure the data type directory exists
        data_type_dir = joinpath(network_dir, data_type)
        mkpath(data_type_dir)
        
        # Node priors
        nodepriors_path = joinpath(data_type_dir, json_network_name * "-nodepriors.json")
        open(nodepriors_path, "w") do f
            write(f, files["nodepriors"].data)
        end
        
        # Link probabilities
        if haskey(files, "linkprobabilities")
            linkprobs_path = joinpath(data_type_dir, json_network_name * "-linkprobabilities.json")
            open(linkprobs_path, "w") do f
                write(f, files["linkprobabilities"].data)
            end
        end
    end
    
    # Save capacity files if enabled
    if get(analysis_config, "flowAnalysis", false) && haskey(files, "capacities")
        json_network_name = replace(network_name, "_" => "-")
        capacities_path = joinpath(network_dir, "capacity", json_network_name * "-capacities.json")
        open(capacities_path, "w") do f
            write(f, files["capacities"].data)
        end
    end
    
    # Save CPM files if enabled
    if get(analysis_config, "criticalPathAnalysis", false) && haskey(files, "cpmInputs")
        json_network_name = replace(network_name, "_" => "-")
        cpm_path = joinpath(network_dir, "cpm", json_network_name * "-cpm-inputs.json")
        open(cpm_path, "w") do f
            write(f, files["cpmInputs"].data)
        end
    end
    
    return network_dir
end

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
        
        # Get content type
        content_type = ""
        for (name, value) in request.headers
            if lowercase(name) == "content-type"
                content_type = value
                break
            end
        end
        
        if !startswith(content_type, "multipart/form-data")
            return HTTP.Response(400, headers, JSON.json(Dict("error" => "Expected multipart/form-data")))
        end
        
        # Parse multipart data
        files = parse_multipart_data(request.body, content_type)
        
        # Extract analysis configuration from the request
        analysis_config = Dict()
        if haskey(files, "analysisConfig")
            config_json = String(files["analysisConfig"].data)
            analysis_config = JSON.parse(config_json)
        end
        
        # Extract network name
        network_name = get(analysis_config, "networkName", "uploaded_network_" * string(UUIDs.uuid4())[1:8])
        
        # Create unique upload directory
        upload_id = string(UUIDs.uuid4())
        upload_path = joinpath(UPLOAD_DIR, upload_id)
        mkpath(upload_path)
        
        println("Processing multipart upload for network: ", network_name)
        println("Files received: ", collect(keys(files)))
        
        # Build network directory structure
        network_dir = build_network_directory(upload_path, network_name, files, analysis_config)
        
        # Run analysis immediately
        results = process_network_analysis_with_config(network_dir, network_name, analysis_config)
        
        println("Analysis complete for: ", network_name)
        
        return HTTP.Response(200, headers, JSON.json(results))
        
    catch e
        println("Upload error: ", e)
        headers = [
            "Content-Type" => "application/json",
            "Access-Control-Allow-Origin" => "*"
        ]
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, headers, JSON.json(error_response))
    end
end

function handle_health(request::HTTP.Request)
    try
        headers = [
            "Content-Type" => "application/json",
            "Access-Control-Allow-Origin" => "*",
            "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" => "Content-Type"
        ]
        response = Dict(
            "status" => "healthy", 
            "timestamp" => Dates.now(),
            "server" => "Information Propagation Framework Backend",
            "version" => "1.0.0"
        )
        return HTTP.Response(200, headers, JSON.json(response))
    catch e
        headers = ["Content-Type" => "application/json"]
        error_response = Dict("status" => "error", "error" => string(e))
        return HTTP.Response(500, headers, JSON.json(error_response))
    end
end

function start_server()
    setup_server()
    
    # Define routes
    router = HTTP.Router()
    HTTP.register!(router, "POST", "/upload", handle_upload)
    HTTP.register!(router, "GET", "/health", handle_health)
    HTTP.register!(router, "OPTIONS", "/upload", handle_upload)
    
    # Handle preflight OPTIONS requests for all endpoints
    HTTP.register!(router, "OPTIONS", "/*", request -> begin
        headers = [
            "Access-Control-Allow-Origin" => "*",
            "Access-Control-Allow-Methods" => "GET, POST, OPTIONS, PUT, DELETE",
            "Access-Control-Allow-Headers" => "Content-Type, Authorization",
            "Access-Control-Max-Age" => "86400"
        ]
        HTTP.Response(200, headers, "")
    end)
    
    println("Server routes registered:")
    println("- POST /upload - Upload and analyze network files")
    println("- GET  /health - Health check endpoint")
    println("- OPTIONS /* - CORS preflight handling")
    
    # Start server
    println("Starting server...")
    HTTP.serve(router, "0.0.0.0", PORT)
end

# Auto-start server when script is run directly
if abspath(PROGRAM_FILE) == @__FILE__
    start_server()
end