# Backend Server for Network Analysis
# Simple HTTP server that accepts file uploads and returns raw analysis results

using HTTP, JSON
using Dates, UUIDs, Statistics

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
                
                # Diamond identification and classification
                root_diamonds = identify_and_group_diamonds(
                    join_nodes, incoming_index, ancestors, descendants,
                    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
                )
                
                unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                    root_diamonds, node_priors, ancestors, descendants, iteration_sets
                )
                
                # Classify diamonds for detailed analysis
                diamond_classifications = Dict()
                for (join_node, diamonds_at_node) in root_diamonds
                    diamond = diamonds_at_node.diamond
                    classification = classify_diamond_exhaustive(
                        diamond, join_node, edgelist, outgoing_index, incoming_index, 
                        source_nodes, fork_nodes, join_nodes, iteration_sets, ancestors, descendants
                    )
                    # Find the highest nodes (fork nodes) for this diamond by analyzing the diamond structure
                    diamond_source_nodes = Set{Int64}()
                    for node in diamond.relevant_nodes
                        if node in source_nodes
                            push!(diamond_source_nodes, node)
                        end
                    end
                    
                    # Get fork nodes within the diamond
                    diamond_fork_nodes = intersect(diamond.relevant_nodes, fork_nodes)
                    
                    diamond_classifications[string(join_node)] = Dict(
                        "fork_structure" => string(classification.fork_structure),
                        "internal_structure" => string(classification.internal_structure),
                        "path_topology" => string(classification.path_topology),
                        "join_structure" => string(classification.join_structure),
                        "external_connectivity" => string(classification.external_connectivity),
                        "degeneracy" => string(classification.degeneracy),
                        "fork_count" => classification.fork_count,
                        "subgraph_size" => classification.subgraph_size,
                        "internal_forks" => classification.internal_forks,
                        "internal_joins" => classification.internal_joins,
                        "path_count" => classification.path_count,
                        "complexity_score" => classification.complexity_score,
                        "optimization_potential" => classification.optimization_potential,
                        "bottleneck_risk" => classification.bottleneck_risk,
                        "relevant_nodes" => collect(diamond.relevant_nodes),
                        "conditioning_nodes" => collect(diamond.conditioning_nodes),
                        "fork_nodes" => collect(diamond_fork_nodes),
                        "source_nodes" => collect(diamond_source_nodes),
                        "edge_count" => length(diamond.edgelist),
                        "is_maximal" => false  # Will be determined later
                    )
                end
                
                # Run exact inference (belief propagation)
                reachability_output = update_beliefs_iterative(
                    edgelist, iteration_sets, outgoing_index, incoming_index,
                    source_nodes, node_priors, edge_probabilities, descendants,
                    ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
                )
                
                execution_time = time() - start_time
                
                # Convert to serializable format
                inference_dict = Dict()
                for (k, v) in reachability_output
                    key = string(k)
                    if data_type == "pbox"
                        # Convert Pbox to serializable format using actual pbox fields
                        inference_dict[key] = Dict(
                            "type" => "pbox",
                            "mean_lower" => v.ml,
                            "mean_upper" => v.mh,
                            "var_lower" => v.vl,
                            "var_upper" => v.vh,
                            "shape" => v.shape,
                            "n" => v.n,
                            "name" => v.name
                        )
                    else
                        inference_dict[key] = v
                    end
                end
                
                results["exact_inference"] = Dict(
                    "node_beliefs" => inference_dict,
                    "execution_time" => execution_time,
                    "data_type" => data_type,
                    "algorithm_type" => "belief_propagation"
                )
                
                # Classify unique diamonds as well
                unique_diamond_classifications = Dict()
                unique_diamond_hashes = Set()
                
                for (hash_key, diamond_data) in unique_diamonds
                    # Get the actual diamond from the computation data
                    if haskey(diamond_data.sub_diamond_structures, hash_key)
                        for (join_node, diamonds_at_node) in diamond_data.sub_diamond_structures
                            if diamonds_at_node.diamond ∉ unique_diamond_hashes
                                push!(unique_diamond_hashes, diamonds_at_node.diamond)
                                
                                classification = classify_diamond_exhaustive(
                                    diamonds_at_node.diamond, join_node, edgelist, outgoing_index, incoming_index,
                                    source_nodes, fork_nodes, join_nodes, iteration_sets, ancestors, descendants
                                )
                                
                                diamond = diamonds_at_node.diamond
                                diamond_source_nodes = intersect(diamond.relevant_nodes, source_nodes)
                                diamond_fork_nodes = intersect(diamond.relevant_nodes, fork_nodes)
                                
                                unique_key = "unique_$(hash_key)_$(join_node)"
                                unique_diamond_classifications[unique_key] = Dict(
                                    "type" => "unique",
                                    "hash_key" => string(hash_key),
                                    "join_node" => join_node,
                                    "fork_structure" => string(classification.fork_structure),
                                    "internal_structure" => string(classification.internal_structure),
                                    "path_topology" => string(classification.path_topology),
                                    "join_structure" => string(classification.join_structure),
                                    "external_connectivity" => string(classification.external_connectivity),
                                    "degeneracy" => string(classification.degeneracy),
                                    "fork_count" => classification.fork_count,
                                    "subgraph_size" => classification.subgraph_size,
                                    "internal_forks" => classification.internal_forks,
                                    "internal_joins" => classification.internal_joins,
                                    "path_count" => classification.path_count,
                                    "complexity_score" => classification.complexity_score,
                                    "optimization_potential" => classification.optimization_potential,
                                    "bottleneck_risk" => classification.bottleneck_risk,
                                    "relevant_nodes" => collect(diamond.relevant_nodes),
                                    "conditioning_nodes" => collect(diamond.conditioning_nodes),
                                    "fork_nodes" => collect(diamond_fork_nodes),
                                    "source_nodes" => collect(diamond_source_nodes),
                                    "edge_count" => length(diamond.edgelist)
                                )
                            end
                        end
                    end
                end
                
                # Add detailed diamond analysis
                results["diamond_analysis"] = Dict(
                    "root_diamonds_count" => length(root_diamonds),
                    "unique_diamonds_count" => length(unique_diamonds),
                    "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
                    "root_classifications" => diamond_classifications,
                    "unique_classifications" => unique_diamond_classifications,
                    "diamond_efficiency" => length(unique_diamonds) / max(1, length(root_diamonds)),
                    "has_complex_diamonds" => any(c["complexity_score"] > 10.0 for c in values(diamond_classifications)),
                    "total_classifications" => length(diamond_classifications) + length(unique_diamond_classifications)
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
                    
                    cpm_results["cost_analysis"] = Dict(
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
        
        # STEP 2: Exact Inference Analysis
        if isfile(filepath_node_json) && isfile(filepath_edge_json)
            println("Running exact inference analysis...")
            start_time = time()
            
            # Load inference inputs
            node_priors = read_node_priors_from_json(filepath_node_json)
            edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
            
            # Diamond identification and classification
            root_diamonds = identify_and_group_diamonds(
                join_nodes, incoming_index, ancestors, descendants,
                source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
            )
            
            unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                root_diamonds, node_priors, ancestors, descendants, iteration_sets
            )
            
            # Classify diamonds for detailed analysis
            diamond_classifications = Dict()
            for (join_node, diamonds_at_node) in root_diamonds
                diamond = diamonds_at_node.diamond
                classification = classify_diamond_exhaustive(
                    diamond, join_node, edgelist, outgoing_index, incoming_index, 
                    source_nodes, fork_nodes, join_nodes, iteration_sets, ancestors, descendants
                )
                diamond_classifications[string(join_node)] = Dict(
                    "fork_structure" => string(classification.fork_structure),
                    "internal_structure" => string(classification.internal_structure),
                    "path_topology" => string(classification.path_topology),
                    "join_structure" => string(classification.join_structure),
                    "external_connectivity" => string(classification.external_connectivity),
                    "degeneracy" => string(classification.degeneracy),
                    "fork_count" => classification.fork_count,
                    "subgraph_size" => classification.subgraph_size,
                    "internal_forks" => classification.internal_forks,
                    "internal_joins" => classification.internal_joins,
                    "path_count" => classification.path_count,
                    "complexity_score" => classification.complexity_score,
                    "optimization_potential" => classification.optimization_potential,
                    "bottleneck_risk" => classification.bottleneck_risk,
                    "relevant_nodes" => collect(diamond.relevant_nodes),
                    "conditioning_nodes" => collect(diamond.conditioning_nodes),
                    "edge_count" => length(diamond.edgelist)
                )
            end
            
            # Run exact inference (belief propagation)
            reachability_output = update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities, descendants,
                ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
            )
            
            execution_time = time() - start_time
            
            # Convert to serializable format
            inference_dict = Dict(string(k) => v for (k, v) in reachability_output)
            
            # Sort by belief value for top results
            sorted_beliefs = sort(collect(inference_dict), by=x->x[2], rev=true)
            top_beliefs = Dict()
            for (i, (node, belief)) in enumerate(sorted_beliefs[1:min(10, length(sorted_beliefs))])
                top_beliefs[node] = belief
            end
            
            results["exact_inference"] = Dict(
                "node_beliefs" => inference_dict,
                "top_beliefs" => top_beliefs,
                "execution_time" => execution_time,
                "data_type" => data_type,
                "algorithm_type" => "belief_propagation"
            )
            
            # Add detailed diamond analysis
            results["diamond_analysis"] = Dict(
                "root_diamonds_count" => length(root_diamonds),
                "unique_diamonds_count" => length(unique_diamonds),
                "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
                "classifications" => diamond_classifications,
                "diamond_efficiency" => length(unique_diamonds) / max(1, length(root_diamonds)),
                "has_complex_diamonds" => any(c["complexity_score"] > 10.0 for c in values(diamond_classifications))
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
            
            results["flow_analysis"] = Dict(
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

function process_comprehensive_network_structure_analysis(network_path::String, network_name::String, analysis_config::Dict)
    try
        # Construct file paths
        filepath_graph = joinpath(network_path, network_name * ".EDGES")
        
        # Check if edges file exists
        if !isfile(filepath_graph)
            throw("Required .EDGES file not found at: $filepath_graph")
        end
        
        data_type = get(analysis_config, "inferenceDataType", "float")
        json_network_name = replace(network_name, "_" => "-")
        filepath_node_json = joinpath(network_path, data_type, json_network_name * "-nodepriors.json")
        filepath_edge_json = joinpath(network_path, data_type, json_network_name * "-linkprobabilities.json")
        filepath_capacity_json = joinpath(network_path, "capacity", json_network_name * "-capacities.json")
        filepath_cpm_json = joinpath(network_path, "cpm", json_network_name * "-cpm-inputs.json")
        
        println("Starting comprehensive network structure analysis for: ", network_name)
        
        # STEP 1: Read graph structure (required for all analyses)
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        all_nodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), all_nodes)
        
        # Network structure analysis (always performed)
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Build comprehensive response
        results = Dict(
            "success" => true,
            "network_name" => network_name,
            "timestamp" => Dates.now(),
            
            # Core network structure
            "total_nodes" => length(all_nodes),
            "total_edges" => length(edgelist),
            "source_nodes" => collect(source_nodes),
            "sink_nodes" => collect(sink_nodes),
            "fork_nodes" => collect(fork_nodes),
            "join_nodes" => collect(join_nodes),
            "all_nodes" => all_nodes,
            
            # Graph structure details
            "edgelist" => [(e[1], e[2]) for e in edgelist],
            "outgoing_index" => Dict(string(k) => collect(v) for (k, v) in outgoing_index),
            "incoming_index" => Dict(string(k) => collect(v) for (k, v) in incoming_index),
            
            # Topological analysis
            "iteration_sets" => [collect(s) for s in iteration_sets],
            "iteration_sets_count" => length(iteration_sets),
            "ancestors" => Dict(string(k) => collect(v) for (k, v) in ancestors),
            "descendants" => Dict(string(k) => collect(v) for (k, v) in descendants),
            
            # Analysis metadata
            "data_type" => data_type,
            "analysis_timestamp" => Dates.now()
        )
        
        # STEP 2: Load node priors if available
        node_priors = nothing
        if isfile(filepath_node_json)
            try
                node_priors = read_node_priors_from_json(filepath_node_json)
                results["node_priors"] = Dict(string(k) => v for (k, v) in node_priors)
                results["has_node_priors"] = true
                println("Successfully loaded node priors")
            catch e
                println("Warning: Could not load node priors - ", e)
                results["has_node_priors"] = false
                results["node_priors_error"] = string(e)
            end
        else
            results["has_node_priors"] = false
        end
        
        # STEP 3: Load edge probabilities if available
        edge_probabilities = nothing
        if isfile(filepath_edge_json)
            try
                edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
                results["edge_probabilities"] = Dict(string(k) => v for (k, v) in edge_probabilities)
                results["has_edge_probabilities"] = true
                println("Successfully loaded edge probabilities")
            catch e
                println("Warning: Could not load edge probabilities - ", e)
                results["has_edge_probabilities"] = false
                results["edge_probabilities_error"] = string(e)
            end
        else
            results["has_edge_probabilities"] = false
        end
        
        # STEP 4: Load capacity data if available
        if isfile(filepath_capacity_json)
            try
                capacity_data = JSON.parsefile(filepath_capacity_json)
                results["capacity_data"] = capacity_data
                results["has_capacity_data"] = true
                println("Successfully loaded capacity data")
            catch e
                println("Warning: Could not load capacity data - ", e)
                results["has_capacity_data"] = false
                results["capacity_data_error"] = string(e)
            end
        else
            results["has_capacity_data"] = false
        end
        
        # STEP 5: Load CPM data if available
        if isfile(filepath_cpm_json)
            try
                cpm_data = JSON.parsefile(filepath_cpm_json)
                results["cpm_data"] = cpm_data
                results["has_cpm_data"] = true
                println("Successfully loaded CPM data")
            catch e
                println("Warning: Could not load CPM data - ", e)
                results["has_cpm_data"] = false
                results["cpm_data_error"] = string(e)
            end
        else
            results["has_cpm_data"] = false
        end
        
        # STEP 6: Calculate additional network metrics
        results["network_metrics"] = Dict(
            "max_out_degree" => isempty(outgoing_index) ? 0 : maximum(length(children) for children in values(outgoing_index)),
            "max_in_degree" => isempty(incoming_index) ? 0 : maximum(length(parents) for parents in values(incoming_index)),
            "avg_out_degree" => isempty(outgoing_index) ? 0.0 : mean(length(children) for children in values(outgoing_index)),
            "avg_in_degree" => isempty(incoming_index) ? 0.0 : mean(length(parents) for parents in values(incoming_index)),
            "network_depth" => length(iteration_sets),
            "fork_ratio" => length(fork_nodes) / max(1, length(all_nodes)),
            "join_ratio" => length(join_nodes) / max(1, length(all_nodes)),
            "source_ratio" => length(source_nodes) / max(1, length(all_nodes)),
            "sink_ratio" => length(sink_nodes) / max(1, length(all_nodes))
        )
        
        # STEP 7: File availability summary
        results["file_availability"] = Dict(
            "edges_file" => isfile(filepath_graph),
            "node_priors_file" => isfile(filepath_node_json),
            "edge_probabilities_file" => isfile(filepath_edge_json),
            "capacity_file" => isfile(filepath_capacity_json),
            "cpm_file" => isfile(filepath_cpm_json),
            "data_type" => data_type
        )
        
        return results
        
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
        else
            # Parse individual form fields for analysis configuration
            for key in ["basicStructure", "diamondAnalysis", "exactInference", "flowAnalysis", "criticalPathAnalysis", "nodeVisualization", "networkName", "inference_data_type"]
                if haskey(files, key)
                    field_value = String(files[key].data)
                    if field_value == "true"
                        analysis_config[key] = true
                    elseif field_value == "false"
                        analysis_config[key] = false
                    else
                        analysis_config[key] = field_value
                    end
                end
            end
            # Handle inference data type specifically
            if haskey(analysis_config, "inference_data_type")
                analysis_config["inferenceDataType"] = analysis_config["inference_data_type"]
            end
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

function handle_network_structure_analysis(request::HTTP.Request)
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
        
        # Extract analysis configuration
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
        
        println("Processing network structure analysis for: ", network_name)
        println("Files received: ", collect(keys(files)))
        
        # Build network directory structure
        network_dir = build_network_directory(upload_path, network_name, files, analysis_config)
        
        # Run comprehensive network structure analysis
        results = process_comprehensive_network_structure_analysis(network_dir, network_name, analysis_config)
        
        println("Network structure analysis complete for: ", network_name)
        
        return HTTP.Response(200, headers, JSON.json(results))
        
    catch e
        println("Network structure analysis error: ", e)
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

function process_comprehensive_network_structure_analysis(network_path::String, network_name::String)
    try
        println("Computing comprehensive network structure for: ", network_name)
        
        # Construct file paths
        edges_file = joinpath(network_path, network_name * ".EDGES")
        node_priors_file = joinpath(network_path, "float", network_name * "-nodepriors.json")
        edge_probs_file = joinpath(network_path, "float", network_name * "-linkprobabilities.json")
        cpm_file = joinpath(network_path, "cpm", network_name * "-cpm-inputs.json")
        capacity_file = joinpath(network_path, "capacity", network_name * "-capacities.json")
        
        # Use InputProcessingModule to load and analyze the network
        using .IPAFramework.InputProcessingModule
        
        # Read graph structure
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file)
        
        # Get all nodes from incoming_index keys (this contains ALL nodes)
        all_nodes = sort([parse(Int, k) for k in keys(incoming_index)])
        
        # Identify structural roles
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        
        # Find sink nodes (nodes not in outgoing_index or with empty outgoing)
        sink_nodes = [node for node in all_nodes if !haskey(outgoing_index, node) || isempty(outgoing_index[node])]
        
        # Get iteration sets and relationships
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Try to load optional data
        node_priors = nothing
        edge_probabilities = nothing
        cmp_data = nothing
        capacity_data = nothing
        
        if isfile(node_priors_file)
            try
                node_priors = read_node_priors_from_json(node_priors_file)
            catch e
                println("Warning: Could not load node priors: ", e)
            end
        end
        
        if isfile(edge_probs_file)
            try
                edge_probabilities = read_edge_probabilities_from_json(edge_probs_file)
            catch e
                println("Warning: Could not load edge probabilities: ", e)
            end
        end
        
        if isfile(cmp_file)
            try
                cmp_data = JSON.parsefile(cmp_file)
            catch e
                println("Warning: Could not load CPM data: ", e)
            end
        end
        
        if isfile(capacity_file)
            try
                capacity_data = JSON.parsefile(capacity_file)
            catch e
                println("Warning: Could not load capacity data: ", e)
            end
        end
        
        # Convert Julia types to JSON-serializable types
        outgoing_dict = Dict{String, Vector{Int}}()
        for (k, v) in outgoing_index
            outgoing_dict[string(k)] = collect(v)
        end
        
        incoming_dict = Dict{String, Vector{Int}}()
        for (k, v) in incoming_index
            incoming_dict[string(k)] = collect(v)
        end
        
        ancestors_dict = Dict{String, Vector{Int}}()
        for (k, v) in ancestors
            ancestors_dict[string(k)] = collect(v)
        end
        
        descendants_dict = Dict{String, Vector{Int}}()  
        for (k, v) in descendants
            descendants_dict[string(k)] = collect(v)
        end
        
        # Build comprehensive response
        comprehensive_response = Dict(
            "success" => true,
            "network_name" => network_name,
            "timestamp" => Dates.now(),
            "total_nodes" => length(all_nodes),
            "total_edges" => length(edgelist),
            "source_nodes" => collect(source_nodes),
            "sink_nodes" => sink_nodes,
            "fork_nodes" => collect(fork_nodes),
            "join_nodes" => collect(join_nodes),
            "all_nodes" => all_nodes,
            "edgelist" => edgelist,
            "outgoing_index" => outgoing_dict,
            "incoming_index" => incoming_dict,
            "iteration_sets" => [collect(s) for s in iteration_sets],
            "iteration_sets_count" => length(iteration_sets),
            "ancestors" => ancestors_dict,
            "descendants" => descendants_dict,
            "node_priors" => node_priors,
            "edge_probabilities" => edge_probabilities,
            "cmp_data" => cmp_data,
            "capacity_data" => capacity_data
        )
        
        println("Comprehensive structure computed successfully for: ", network_name)
        return comprehensive_response
        
    catch e
        println("Error in comprehensive structure analysis: ", e)
        throw(e)
    end
end

function handle_comprehensive_network_structure(request::HTTP.Request)
    try
        # Set CORS headers
        headers = [
            "Access-Control-Allow-Origin" => "*",
            "Access-Control-Allow-Methods" => "GET, OPTIONS", 
            "Access-Control-Allow-Headers" => "Content-Type",
            "Content-Type" => "application/json"
        ]
        
        if request.method == "OPTIONS"
            return HTTP.Response(200, headers)
        end
        
        if request.method != "GET"
            return HTTP.Response(405, headers, JSON.json(Dict("error" => "Method not allowed")))
        end
        
        # Parse query parameters
        query_params = HTTP.queryparams(request.target)
        network_name = get(query_params, "network_name", "")
        
        if isempty(network_name)
            return HTTP.Response(400, headers, JSON.json(Dict(
                "error" => "Missing network_name parameter",
                "success" => false
            )))
        end
        
        # Find the most recent network data in temp_uploads
        comprehensive_data = nothing
        
        # Look for network data in temp_uploads directories
        if isdir(UPLOAD_DIR)
            for upload_dir in readdir(UPLOAD_DIR)
                upload_path = joinpath(UPLOAD_DIR, upload_dir)
                if isdir(upload_path)
                    # Look for network directory with matching name
                    network_path = joinpath(upload_path, network_name)
                    if isdir(network_path)
                        try
                            comprehensive_data = process_comprehensive_network_structure_analysis(network_path, network_name)
                            break
                        catch e
                            println("Error processing comprehensive structure for $network_name: $e")
                            continue
                        end
                    end
                end
            end
        end
        
        if comprehensive_data !== nothing
            return HTTP.Response(200, headers, JSON.json(comprehensive_data))
        else
            # Return empty structure if no data found
            empty_response = Dict(
                "success" => true,
                "network_name" => network_name,
                "timestamp" => Dates.now(),
                "total_nodes" => 0,
                "total_edges" => 0,
                "source_nodes" => Int64[],
                "sink_nodes" => Int64[],
                "fork_nodes" => Int64[],
                "join_nodes" => Int64[],
                "all_nodes" => Int64[],
                "edgelist" => Tuple{Int64, Int64}[],
                "outgoing_index" => Dict{Int64, Vector{Int64}}(),
                "incoming_index" => Dict{Int64, Vector{Int64}}(),
                "iteration_sets" => Vector{Int64}[],
                "iteration_sets_count" => 0,
                "ancestors" => Dict{Int64, Vector{Int64}}(),
                "descendants" => Dict{Int64, Vector{Int64}}(),
                "node_priors" => nothing,
                "edge_probabilities" => nothing,
                "cpm_data" => nothing,
                "capacity_data" => nothing,
                "message" => "No network data found for $network_name"
            )
            # This should be an error - if they're requesting comprehensive structure, it should exist
            return HTTP.Response(404, headers, JSON.json(Dict(
                "error" => "Network data not found for '$network_name'. Please upload and analyze the network first.",
                "success" => false,
                "network_name" => network_name,
                "timestamp" => Dates.now()
            )))
        end
        
    catch e
        println("Comprehensive network structure error: ", e)
        headers = [
            "Content-Type" => "application/json",
            "Access-Control-Allow-Origin" => "*"
        ]
        error_response = Dict(
            "error" => string(e),
            "success" => false,
            "timestamp" => Dates.now()
        )
        return HTTP.Response(500, headers, JSON.json(error_response))
    end
end

function start_server()
    setup_server()
    
    # Define routes
    router = HTTP.Router()
    HTTP.register!(router, "POST", "/upload", handle_upload)
    HTTP.register!(router, "POST", "/network-structure", handle_network_structure_analysis)
    HTTP.register!(router, "GET", "/api/network/structure", handle_comprehensive_network_structure)
    HTTP.register!(router, "OPTIONS", "/api/network/structure", handle_comprehensive_network_structure)
    HTTP.register!(router, "GET", "/health", handle_health)
    HTTP.register!(router, "OPTIONS", "/upload", handle_upload)
    HTTP.register!(router, "OPTIONS", "/network-structure", handle_network_structure_analysis)
    
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
    println("- POST /network-structure - Comprehensive network structure analysis")
    println("- GET  /health - Health check endpoint")
    println("- OPTIONS /* - CORS preflight handling")
    
    # Start server
    println("Starting server...")
    HTTP.serve(router, "0.0.0.0", PORT)
end

#= # Auto-start server when script is run directly
if abspath(PROGRAM_FILE) == @__FILE__
    start_server()
end =#

    start_server()