# Enhanced Backend Server for Network Analysis
# Handles multipart file uploads and conditional analysis execution

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
    println("Enhanced server starting on port $PORT...")
    println("Upload directory: $UPLOAD_DIR")
end

# Parse multipart form data to extract files and analysis configuration
function parse_multipart_request(body::Vector{UInt8}, content_type::String)
    # Extract boundary from content-type header
    boundary_match = match(r"boundary=([^;\s]+)", content_type)
    if boundary_match === nothing
        throw("No boundary found in content-type header")
    end
    
    boundary = String(boundary_match.captures[1])
    full_boundary = "--" * boundary
    
    # Split body by boundary
    body_str = String(body)
    parts = split(body_str, full_boundary)[2:end-1]  # Remove first empty and last closing parts
    
    files = Dict{String, Tuple{String, Vector{UInt8}}}()  # name => (filename, data)
    form_data = Dict{String, String}()
    
    for part in parts
        if isempty(strip(part))
            continue
        end
        
        # Split headers and content
        header_end = findfirst("\r\n\r\n", part)
        if header_end === nothing
            continue
        end
        
        headers = part[1:header_end[1]-1]
        content = part[header_end[end]+1:end]
        
        # Parse Content-Disposition header
        disp_match = match(r'Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?', headers)
        if disp_match === nothing
            continue
        end
        
        field_name = disp_match.captures[1]
        filename = disp_match.captures[2]
        
        if filename !== nothing
            # It's a file
            files[field_name] = (filename, Vector{UInt8}(content))
        else
            # It's form data
            form_data[field_name] = String(content)
        end
    end
    
    return files, form_data
end

# Create temporary network directory structure from uploaded files
function create_temp_network_structure(network_name::String, files::Dict, analysis_config::Dict)
    session_id = string(uuid4())[1:8]
    temp_dir = joinpath(UPLOAD_DIR, "$(network_name)_$(session_id)")
    
    # Create main directory
    mkpath(temp_dir)
    
    # Create required subdirectories
    data_type_dirs = ["float", "interval", "pbox"]
    for data_type in data_type_dirs
        mkpath(joinpath(temp_dir, data_type))
    end
    mkpath(joinpath(temp_dir, "capacity"))
    mkpath(joinpath(temp_dir, "cpm"))
    
    # Write files to appropriate locations
    file_paths = Dict{String, String}()
    
    # Main EDGES file
    if haskey(files, "edges")
        filename, data = files["edges"]
        edges_path = joinpath(temp_dir, "$(network_name).EDGES")
        open(edges_path, "w") do f
            write(f, data)
        end
        file_paths["edges"] = edges_path
    end
    
    # Node mapping (optional)
    if haskey(files, "nodeMapping")
        filename, data = files["nodeMapping"]
        mapping_path = joinpath(temp_dir, "$(network_name)-node-mapping.txt")
        open(mapping_path, "w") do f
            write(f, data)
        end
        file_paths["nodeMapping"] = mapping_path
    end
    
    # Inference files (if exact inference is enabled)
    if get(analysis_config, "exactInference", false) && haskey(analysis_config, "inferenceDataType")
        data_type = analysis_config["inferenceDataType"]
        data_type_dir = joinpath(temp_dir, data_type)
        
        network_name_hyphen = replace(network_name, "_" => "-")
        
        if haskey(files, "nodepriors")
            filename, data = files["nodepriors"]
            nodepriors_path = joinpath(data_type_dir, "$(network_name_hyphen)-nodepriors.json")
            open(nodepriors_path, "w") do f
                write(f, data)
            end
            file_paths["nodepriors"] = nodepriors_path
        end
        
        if haskey(files, "linkprobabilities")
            filename, data = files["linkprobabilities"]
            linkprob_path = joinpath(data_type_dir, "$(network_name_hyphen)-linkprobabilities.json")
            open(linkprob_path, "w") do f
                write(f, data)
            end
            file_paths["linkprobabilities"] = linkprob_path
        end
    end
    
    # Capacity files
    if get(analysis_config, "flowAnalysis", false) && haskey(files, "capacities")
        filename, data = files["capacities"]
        network_name_hyphen = replace(network_name, "_" => "-")
        capacity_path = joinpath(temp_dir, "capacity", "$(network_name_hyphen)-capacities.json")
        open(capacity_path, "w") do f
            write(f, data)
        end
        file_paths["capacities"] = capacity_path
    end
    
    # CPM files
    if get(analysis_config, "criticalPathAnalysis", false) && haskey(files, "cpmInputs")
        filename, data = files["cpmInputs"]
        network_name_hyphen = replace(network_name, "_" => "-")
        cpm_path = joinpath(temp_dir, "cpm", "$(network_name_hyphen)-cpm-inputs.json")
        open(cmp_path, "w") do f
            write(f, data)
        end
        file_paths["cpmInputs"] = cpm_path
    end
    
    return temp_dir, file_paths
end

# Enhanced network analysis with conditional execution (based on ComprehensiveNetworkAnalysisTest.jl)
function run_conditional_network_analysis(network_name::String, temp_dir::String, analysis_config::Dict)
    println("="^70)
    println("CONDITIONAL NETWORK ANALYSIS: $network_name")
    println("Selected analyses: $(filter(p -> p.second == true, analysis_config))")
    println("="^70)
    
    results = Dict{String, Any}()
    performance = Dict{String, Float64}()
    total_start_time = time()
    
    # STEP 1: Always load basic network structure (required for everything)
    println("🏗️  STEP 1: Loading network structure...")
    structure_start_time = time()
    
    # Graph structure file
    filepath_graph = joinpath(temp_dir, network_name * ".EDGES")
    
    # Load basic structure
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
    allnodes = collect(keys(incoming_index))
    sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
    
    # Network structure analysis
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
    
    # Basic structure results
    results["basic_structure"] = Dict(
        "total_nodes" => length(allnodes),
        "total_edges" => length(edgelist),
        "source_nodes" => collect(source_nodes),
        "sink_nodes" => collect(sink_nodes),
        "fork_nodes" => collect(fork_nodes),
        "join_nodes" => collect(join_nodes),
        "iteration_sets" => length(iteration_sets)
    )
    
    performance["basic_structure"] = time() - structure_start_time
    println("  ✅ Network structure loaded: $(length(allnodes)) nodes, $(length(edgelist)) edges")
    println("  ⏱️  Time: $(round(performance["basic_structure"], digits=3))s")
    println()
    
    # STEP 2: Diamond Analysis (if enabled - usually runs with basic structure)
    if get(analysis_config, "diamondAnalysis", false)
        println("💎 STEP 2: Diamond Analysis...")
        diamond_start_time = time()
        
        # Diamond identification (from ComprehensiveNetworkAnalysisTest.jl)
        root_diamonds = identify_and_group_diamonds(
            join_nodes,
            incoming_index,
            ancestors,
            descendants,
            source_nodes,
            fork_nodes,
            edgelist,
            Dict(),  # Empty node priors for structure analysis
            iteration_sets
        )
        
        # Build unique diamond storage if we have diamonds
        unique_diamonds = if !isempty(root_diamonds)
            build_unique_diamond_storage_depth_first_parallel(
                root_diamonds,
                Dict(),  # Empty node priors
                ancestors,
                descendants,
                iteration_sets
            )
        else
            []
        end
        
        results["diamond_analysis"] = Dict(
            "root_diamonds_count" => length(root_diamonds),
            "unique_diamonds_count" => length(unique_diamonds),
            "has_diamond_structures" => !isempty(root_diamonds)
        )
        
        performance["diamond_analysis"] = time() - diamond_start_time
        println("  ✅ Found $(length(root_diamonds)) root diamonds, $(length(unique_diamonds)) unique patterns")
        println("  ⏱️  Time: $(round(performance["diamond_analysis"], digits=3))s")
        println()
    end
    
    # STEP 3: Exact Inference (if enabled and files available)
    if get(analysis_config, "exactInference", false)
        println("🧠 STEP 3: Exact Inference Analysis...")
        inference_start_time = time()
        
        data_type = get(analysis_config, "inferenceDataType", "float")
        json_network_name = replace(network_name, "_" => "-")
        
        filepath_node_json = joinpath(temp_dir, data_type, json_network_name * "-nodepriors.json")
        filepath_edge_json = joinpath(temp_dir, data_type, json_network_name * "-linkprobabilities.json")
        
        if isfile(filepath_node_json) && isfile(filepath_edge_json)
            try
                # Load inference data
                node_priors = read_node_priors_from_json(filepath_node_json)
                edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
                
                # Run inference (based on ComprehensiveNetworkAnalysisTest.jl)
                reachability_output = IPAFramework.update_beliefs_iterative(
                    edgelist,
                    iteration_sets,
                    outgoing_index,
                    incoming_index,
                    source_nodes,
                    node_priors,
                    edge_probabilities,
                    descendants,
                    ancestors,
                    get(results, "root_diamonds", []),
                    join_nodes,
                    fork_nodes,
                    get(results, "unique_diamonds", [])
                )
                
                # Convert results to serializable format
                serializable_reachability = Dict(string(k) => v for (k, v) in reachability_output)
                
                # Get top results
                sorted_reachability = sort(collect(reachability_output), by=x->x[2], rev=true)
                top_reachable = [Dict("node" => string(node), "belief" => belief) 
                               for (node, belief) in sorted_reachability[1:min(10, length(sorted_reachability))]]
                
                results["exact_inference"] = Dict(
                    "data_type" => data_type,
                    "reachability_results" => serializable_reachability,
                    "top_reachable_nodes" => top_reachable,
                    "total_nodes_analyzed" => length(reachability_output)
                )
                
                println("  ✅ Exact inference completed for $(length(reachability_output)) nodes")
            catch e
                println("  ⚠️  Exact inference failed: $e")
                results["exact_inference"] = Dict("error" => string(e))
            end
        else
            results["exact_inference"] = Dict("error" => "Required inference files not found")
        end
        
        performance["exact_inference"] = time() - inference_start_time
        println("  ⏱️  Time: $(round(performance["exact_inference"], digits=3))s")
        println()
    end
    
    # STEP 4: Flow Analysis (if enabled and capacity file available)
    if get(analysis_config, "flowAnalysis", false)
        println("🌊 STEP 4: Flow Analysis...")
        flow_start_time = time()
        
        json_network_name = replace(network_name, "_" => "-")
        filepath_capacity_json = joinpath(temp_dir, "capacity", json_network_name * "-capacities.json")
        
        if isfile(filepath_capacity_json)
            try
                # Load and process capacity data (from ComprehensiveNetworkAnalysisTest.jl)
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
                
                # Convert results
                target_flows = Dict(string(k) => v for (k, v) in capacity_result.node_max_flows if k in targets)
                total_source_input = sum(values(source_rates))
                total_target_output = sum(capacity_result.node_max_flows[t] for t in targets)
                
                results["flow_analysis"] = Dict(
                    "network_utilization" => capacity_result.network_utilization,
                    "target_flows" => target_flows,
                    "total_source_input" => total_source_input,
                    "total_target_output" => total_target_output,
                    "network_efficiency" => total_target_output / total_source_input * 100,
                    "active_sources" => collect(keys(source_rates)),
                    "target_nodes" => collect(targets)
                )
                
                println("  ✅ Flow analysis completed - Network efficiency: $(round(total_target_output/total_source_input * 100, digits=2))%")
            catch e
                println("  ⚠️  Flow analysis failed: $e")
                results["flow_analysis"] = Dict("error" => string(e))
            end
        else
            results["flow_analysis"] = Dict("error" => "Capacity file not found")
        end
        
        performance["flow_analysis"] = time() - flow_start_time
        println("  ⏱️  Time: $(round(performance["flow_analysis"], digits=3))s")
        println()
    end
    
    # STEP 5: Critical Path Analysis (if enabled and CPM file available)
    if get(analysis_config, "criticalPathAnalysis", false)
        println("⏱️  STEP 5: Critical Path Analysis...")
        cpm_start_time = time()
        
        json_network_name = replace(network_name, "_" => "-")
        filepath_cpm_json = joinpath(temp_dir, "cpm", json_network_name * "-cmp-inputs.json")
        
        if isfile(filepath_cpm_json)
            try
                # Load CPM data (from ComprehensiveNetworkAnalysisTest.jl)
                cpm_data = JSON.parsefile(filepath_cmp_json)
                time_analysis = cmp_data["time_analysis"]
                cost_analysis = cmp_data["cost_analysis"]
                
                cmp_results = Dict()
                
                # Time analysis (if enabled)
                if get(get(analysis_config, "criticalPathOptions", Dict()), "enableTime", true)
                    node_durations_raw = time_analysis["node_durations"]
                    edge_delays_raw = time_analysis["edge_delays"]
                    
                    node_durations = Dict{Int64, Float64}()
                    for (k, v) in node_durations_raw
                        node_durations[parse(Int64, k)] = Float64(v)
                    end
                    
                    edge_delays = Dict{Tuple{Int64,Int64}, Float64}()
                    for (k, v) in edge_delays_raw
                        cleaned_key = replace(k, "(" => "", ")" => "")
                        parts = split(cleaned_key, ",")
                        edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                        edge_delays[edge_key] = Float64(v)
                    end
                    
                    # Run time-based critical path analysis
                    time_params = CriticalPathParameters(
                        node_durations,
                        edge_delays,
                        0.0,
                        max_combination,
                        additive_propagation,
                        additive_propagation
                    )
                    
                    time_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, time_params)
                    
                    cmp_results["time_analysis"] = Dict(
                        "critical_path_duration" => time_result.critical_value,
                        "critical_nodes" => time_result.critical_nodes,
                        "node_values" => Dict(string(k) => v for (k, v) in time_result.node_values)
                    )
                end
                
                # Cost analysis (if enabled)
                if get(get(analysis_config, "criticalPathOptions", Dict()), "enableCost", true)
                    node_costs_raw = cost_analysis["node_costs"]
                    edge_costs_raw = cost_analysis["edge_costs"]
                    
                    node_costs = Dict{Int64, Float64}()
                    for (k, v) in node_costs_raw
                        node_costs[parse(Int64, k)] = Float64(v)
                    end
                    
                    edge_costs = Dict{Tuple{Int64,Int64}, Float64}()
                    for (k, v) in edge_costs_raw
                        cleaned_key = replace(k, "(" => "", ")" => "")
                        parts = split(cleaned_key, ",")
                        edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                        edge_costs[edge_key] = Float64(v)
                    end
                    
                    # Run cost-based critical path analysis
                    cost_params = CriticalPathParameters(
                        node_costs,
                        edge_costs,
                        0.0,
                        max_combination,
                        additive_propagation,
                        additive_propagation
                    )
                    
                    cost_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, cost_params)
                    
                    cmp_results["cost_analysis"] = Dict(
                        "critical_path_cost" => cost_result.critical_value,
                        "critical_nodes" => cost_result.critical_nodes,
                        "node_values" => Dict(string(k) => v for (k, v) in cost_result.node_values)
                    )
                end
                
                results["critical_path_analysis"] = cmp_results
                
                println("  ✅ Critical path analysis completed")
                if haskey(cmp_results, "time_analysis")
                    println("    🕐 Critical path duration: $(round(cmp_results["time_analysis"]["critical_path_duration"], digits=2)) hours")
                end
                if haskey(cmp_results, "cost_analysis")
                    println("    💰 Critical path cost: £$(round(cmp_results["cost_analysis"]["critical_path_cost"], digits=2))")
                end
            catch e
                println("  ⚠️  Critical path analysis failed: $e")
                results["critical_path_analysis"] = Dict("error" => string(e))
            end
        else
            results["critical_path_analysis"] = Dict("error" => "CPM file not found")
        end
        
        performance["critical_path_analysis"] = time() - cmp_start_time
        println("  ⏱️  Time: $(round(performance["critical_path_analysis"], digits=3))s")
        println()
    end
    
    # Calculate total performance
    total_time = time() - total_start_time
    performance["total"] = total_time
    
    # Prepare final response
    response = Dict(
        "success" => true,
        "network_name" => network_name,
        "timestamp" => Dates.now(),
        "analyses_run" => [k for (k, v) in analysis_config if v == true],
        "results" => results,
        "performance" => performance
    )
    
    println("🎉 ANALYSIS COMPLETE!")
    println("Total execution time: $(round(total_time, digits=3))s")
    println("="^70)
    
    return response
end

# Enhanced HTTP request handler
function handle_network_analysis_request(request::HTTP.Request)
    try
        println("📥 Received network analysis request")
        
        # Parse multipart form data
        content_type = HTTP.header(request, "Content-Type", "")
        if !startswith(content_type, "multipart/form-data")
            return HTTP.Response(400, JSON.json(Dict("error" => "Expected multipart/form-data")))
        end
        
        files, form_data = parse_multipart_request(request.body, content_type)
        
        # Extract network name and analysis configuration
        network_name = get(form_data, "networkName", "unknown_network")
        analysis_config_json = get(form_data, "analysisConfig", "{}")
        analysis_config = JSON.parse(analysis_config_json)
        
        println("Network: $network_name")
        println("Files received: $(keys(files))")
        println("Analysis config: $analysis_config")
        
        # Create temporary network structure
        temp_dir, file_paths = create_temp_network_structure(network_name, files, analysis_config)
        
        # Run conditional analysis
        result = run_conditional_network_analysis(network_name, temp_dir, analysis_config)
        
        # Clean up temporary directory
        # rm(temp_dir, recursive=true)
        # println("🧹 Cleaned up temporary directory: $temp_dir")
        
        return HTTP.Response(200, 
                           [("Content-Type", "application/json"), 
                            ("Access-Control-Allow-Origin", "*")], 
                           JSON.json(result))
                           
    catch e
        println("❌ Error processing request: $e")
        error_response = Dict(
            "success" => false,
            "error" => string(e),
            "timestamp" => Dates.now()
        )
        return HTTP.Response(500, JSON.json(error_response))
    end
end

# CORS preflight handler
function handle_cors_preflight(request::HTTP.Request)
    return HTTP.Response(200, [
        ("Access-Control-Allow-Origin", "*"),
        ("Access-Control-Allow-Methods", "POST, OPTIONS"),
        ("Access-Control-Allow-Headers", "Content-Type"),
        ("Access-Control-Max-Age", "86400")
    ])
end

# Main server function
function start_server()
    setup_server()
    
    # Define routes
    router = HTTP.Router()
    
    # CORS preflight
    HTTP.register!(router, "OPTIONS", "/analyze", handle_cors_preflight)
    
    # Main analysis endpoint
    HTTP.register!(router, "POST", "/analyze", handle_network_analysis_request)
    
    # Start server
    HTTP.serve(router, "0.0.0.0", PORT)
end

# Auto-start server when script is run
if abspath(PROGRAM_FILE) == @__FILE__
    start_server()
end