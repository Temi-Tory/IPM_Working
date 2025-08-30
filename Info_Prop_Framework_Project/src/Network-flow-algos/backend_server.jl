# Flexible Multi-Scenario Backend Server for Network Analysis
# Supports user-specified input paths for each analysis scenario
# Based on expected raw results structure and Julia algorithm requirements

using HTTP, JSON
using Dates, UUIDs
using ProbabilityBoundsAnalysis

# Include the IPAFramework module
include("src/IPAFramework.jl")
using .IPAFramework

# Import types for type checking
const pbox = ProbabilityBoundsAnalysis.pbox
const Interval = IPAFramework.Interval

const UPLOAD_DIR = "temp_uploads"
const PORT = 8080

function pbox_to_dict(pbox::ProbabilityBoundsAnalysis.pbox)
    """Convert a Pbox object to a JSON-serializable dictionary with reduced discretization"""
    # Only include summary statistics, not full discretization arrays
    return Dict(
        "type" => "pbox",
        "mean_lower" => pbox.ml,
        "mean_upper" => pbox.mh,
        "var_lower" => pbox.vl,
        "var_upper" => pbox.vh,
        "shape" => string(pbox.shape),
        "name" => pbox.name,
        "bounded" => pbox.bounded,
        "discretization_size" => pbox.n,
        # Only include first, last, and quartile points instead of full arrays
        "bounds_summary" => Dict(
            "left_min" => length(pbox.u) > 0 ? pbox.u[1] : 0.0,
            "left_max" => length(pbox.u) > 0 ? pbox.u[end] : 0.0,
            "right_min" => length(pbox.d) > 0 ? pbox.d[1] : 0.0,
            "right_max" => length(pbox.d) > 0 ? pbox.d[end] : 0.0
        )
    )
end

function convert_pbox_values(obj)
    """Recursively convert any Pbox objects in a data structure to dictionaries"""
    if isa(obj, ProbabilityBoundsAnalysis.pbox)
        return pbox_to_dict(obj)
    elseif isa(obj, Dict)
        return Dict(k => convert_pbox_values(v) for (k, v) in obj)
    elseif isa(obj, Array)
        return [convert_pbox_values(item) for item in obj]
    else
        return obj
    end
end

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

function serialize_root_diamonds_for_json(root_diamonds_dict)
    """Helper function to serialize root diamond structures (DiamondsAtNode) for JSON response"""
    serialized = Dict()
    for (join_node, diamonds_at_node) in root_diamonds_dict
        # diamonds_at_node is of type DiamondsAtNode
        serialized[string(join_node)] = Dict(
            "join_node" => diamonds_at_node.join_node,
            "diamond" => Dict(
                "conditioning_nodes" => collect(diamonds_at_node.diamond.conditioning_nodes),
                "relevant_nodes" => collect(diamonds_at_node.diamond.relevant_nodes),
                "edgelist" => collect(diamonds_at_node.diamond.edgelist),
                "edge_count" => length(diamonds_at_node.diamond.edgelist),
                "node_count" => length(diamonds_at_node.diamond.relevant_nodes)
            ),
            "non_diamond_parents" => collect(diamonds_at_node.non_diamond_parents)
        )
    end
    return serialized
end

function serialize_unique_diamonds_for_json(unique_diamonds_dict)
    """Helper function to serialize unique diamond structures (DiamondComputationData) for JSON response"""
    serialized = Dict()
    
    for (diamond_hash, diamond_data) in unique_diamonds_dict
        # diamond_data is of type DiamondComputationData{T}
        # Use the is_rootDiamond field from the struct directly!
        
        serialized[string(diamond_hash)] = Dict(
            "diamond_hash" => string(diamond_hash),
            "is_root_diamond" => diamond_data.is_rootDiamond,  # <-- USE STRUCT FIELD
            "sub_outgoing_index" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_outgoing_index),
            "sub_incoming_index" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_incoming_index),
            "sub_sources" => collect(diamond_data.sub_sources),
            "sub_fork_nodes" => collect(diamond_data.sub_fork_nodes),
            "sub_join_nodes" => collect(diamond_data.sub_join_nodes),
            "sub_ancestors" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_ancestors),
            "sub_descendants" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_descendants),
            "sub_iteration_sets" => [collect(s) for s in diamond_data.sub_iteration_sets],
            "sub_iteration_sets_count" => length(diamond_data.sub_iteration_sets),
            "sub_node_priors" => Dict(string(k) => v for (k, v) in diamond_data.sub_node_priors),
            "node_count" => length(diamond_data.sub_node_priors)
        )
    end
    return serialized
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
                    "diamond_efficiency" => length(unique_diamonds) / max(1, length(root_diamonds)),
                    # **NEW: Raw diamond structures for UI**
                    "raw_root_diamonds" => serialize_root_diamonds_for_json(root_diamonds),
                    "raw_unique_diamonds" => serialize_unique_diamonds_for_json(unique_diamonds)
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
                    beliefs_dict[string(node)] = belief  # Don't force convert - let convert_pbox_values handle it
                end
                
                # Calculate statistics only for Float64 values (skip pbox and interval objects)
                numeric_beliefs = []
                for belief in values(output)
                    if isa(belief, Float64)
                        push!(numeric_beliefs, belief)
                    elseif isa(belief, Real) && !isa(belief, pbox) && !isa(belief, Interval)
                        # Convert other real numbers (Int, etc.) but not pbox or Interval
                        push!(numeric_beliefs, Float64(belief))
                    end
                end
                
                scenario_results["exact_inference"] = Dict(
                    "beliefs" => beliefs_dict,
                    "computation_time" => inference_computation_time,
                    "total_nodes_processed" => length(output),
                    "belief_statistics" => Dict(
                        "mean" => length(numeric_beliefs) > 0 ? sum(numeric_beliefs) / length(numeric_beliefs) : 0.0,
                        "min" => length(numeric_beliefs) > 0 ? minimum(numeric_beliefs) : 0.0,
                        "max" => length(numeric_beliefs) > 0 ? maximum(numeric_beliefs) : 0.0,
                        "numeric_count" => length(numeric_beliefs),
                        "total_count" => length(output)
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
            "note" => "Used default node priors (all 1.0) for standalone diamond analysis",
            # **NEW: Raw diamond structures for UI**
            "raw_root_diamonds" => serialize_root_diamonds_for_json(root_diamonds),
            "raw_unique_diamonds" => serialize_unique_diamonds_for_json(unique_diamonds)
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
                "input_files" => Dict("capacities_path" => capacities_path),
                # **NEW: Complete raw capacity results**
                "raw_capacity_result" => Dict(
                    "node_max_flows" => Dict(string(k) => v for (k, v) in capacity_result.node_max_flows),
                    "bottlenecks" => Dict(string(k) => v for (k, v) in capacity_result.bottlenecks),
                    "critical_paths" => Dict(string(k) => v for (k, v) in capacity_result.critical_paths),
                    "network_utilization" => capacity_result.network_utilization,
                    "analysis_type" => string(capacity_result.analysis_type),
                    "computation_time" => capacity_result.computation_time,
                    "convergence_info" => capacity_result.convergence_info
                )
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
            cpm_data = JSON.parsefile(full_cpm_path)
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
            println("    CPM scenario $scenario_name complete: $(round(cpm_computation_time, digits=4)) seconds")
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
        "cpm_scenarios_count" => length(get(results, "cpm_scenarios", Dict())),
        "timestamp" => Dates.now()
    )
    
    println("Multi-scenario analysis complete! Total time: $(round(total_time, digits=4)) seconds")
    
    return results
end

function process_network_analysis_with_config(network_path::String, network_name::String, analysis_config::Dict)
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
end

function parse_multipart_data(body_str::String, boundary::String, upload_path::String)
    """Parse multipart/form-data and save files to upload directory"""
    uploaded_files = String[]
    
    # Split by boundary
    parts = split(body_str, "--" * boundary)
    
    for part in parts
        part = strip(part)
        if isempty(part) || part == "--" continue end
        
        # Split headers from content
        header_end = findfirst("\r\n\r\n", part)
        if header_end === nothing
            header_end = findfirst("\n\n", part)
            if header_end === nothing continue end
        end
        
        headers = part[1:header_end[1]-1]
        content = part[header_end[end]+1:end]
        
        # Extract filename from Content-Disposition header
        filename_pattern = r"filename=\"([^\"]+)\""
        filename_match = match(filename_pattern, headers)
        if filename_match === nothing continue end
        
        filename = filename_match.captures[1]
        
        # Skip empty files
        if isempty(strip(content)) continue end
        
        # Clean up content (remove trailing boundary markers)
        content = rstrip(content, ['\r', '\n', '-'])
        
        # Save file to upload directory
        file_path = joinpath(upload_path, filename)
        
        # Create subdirectories if needed
        file_dir = dirname(file_path)
        if file_dir != upload_path
            mkpath(file_dir)
        end
        
        # Write file
        open(file_path, "w") do io
            write(io, content)
        end
        
        push!(uploaded_files, filename)
        println("Saved uploaded file: $filename ($(length(content)) bytes)")
    end
    
    return uploaded_files
end

function organize_uploaded_files(upload_path::String, uploaded_files::Vector{String})
    """Organize uploaded files and detect network structure"""
    
    # Find .EDGES files (these define networks)
    edges_files = filter(f -> endswith(f, ".EDGES"), uploaded_files)
    
    if isempty(edges_files)
        return nothing
    end
    
    # Use the first .EDGES file to determine network name
    edges_file = edges_files[1]
    # Extract just the filename without directory path and extension
    network_name = basename(replace(edges_file, ".EDGES" => ""))
    
    # Create network directory structure
    network_path = joinpath(upload_path, network_name)
    mkpath(network_path)
    
    # Move and organize files
    organized_files = String[]
    
    for filename in uploaded_files
        original_path = joinpath(upload_path, filename)
        
        # Determine target location based on file type and structure
        target_path = determine_file_location(network_path, filename, network_name)
        
        # Create target directory if needed
        target_dir = dirname(target_path)
        if target_dir != network_path
            mkpath(target_dir)
        end
        
        # Move file to organized location (only if paths are different)
        if original_path != target_path && isfile(original_path) && !isfile(target_path)
            mv(original_path, target_path, force=true)
        elseif original_path == target_path
            # File is already in the correct location - no move needed
            println("File already correctly positioned: $filename")
        end
        
        push!(organized_files, target_path)
    end
    
    # Validate network structure
    is_valid, message = validate_network_structure(network_path)
    
    return Dict(
        "network_name" => network_name,
        "network_path" => network_path,
        "organized_files" => organized_files,
        "validation" => Dict(
            "is_valid" => is_valid,
            "message" => message
        )
    )
end

function determine_file_location(network_path::String, filename::String, network_name::String)
    """Determine where to place an uploaded file based on its name and type"""
    
    # Main network file goes to root
    if endswith(filename, ".EDGES") && contains(filename, network_name)
        return joinpath(network_path, basename(filename))
    end
    
    # Scenario files go to appropriate subdirectories
    if contains(filename, "nodepriors") || contains(filename, "linkprob")
        if contains(filename, "float")
            return joinpath(network_path, "float", basename(filename))
        elseif contains(filename, "pbox")
            return joinpath(network_path, "pbox", basename(filename))
        elseif contains(filename, "interval")
            return joinpath(network_path, "interval", basename(filename))
        else
            return joinpath(network_path, "float", basename(filename))  # Default to float
        end
    elseif contains(filename, "capacities")
        return joinpath(network_path, "capacity", basename(filename))
    elseif contains(filename, "cpm")
        return joinpath(network_path, "cpm", basename(filename))
    else
        # Unknown files go to root
        return joinpath(network_path, filename)
    end
end

function load_uploaded_data_files(network_path::String)
    """Load all available uploaded data files from the network directory"""
    uploaded_data = Dict()
    
    # Define data type directories and their corresponding file patterns
    data_types = [
        ("float", ["nodepriors", "linkprobabilities"]),
        ("interval", ["nodepriors", "linkprobabilities"]),
        ("pbox", ["nodepriors", "linkprobabilities"]),
        ("capacity", ["capacities"]),
        ("cpm", ["cpm-inputs"])
    ]
    
    for (data_type, file_patterns) in data_types
        type_dir = joinpath(network_path, data_type)
        if isdir(type_dir)
            uploaded_data[data_type] = Dict()
            
            for pattern in file_patterns
                # Find files matching the pattern
                matching_files = filter(readdir(type_dir)) do filename
                    contains(filename, pattern) && endswith(filename, ".json")
                end
                
                if !isempty(matching_files)
                    file_path = joinpath(type_dir, matching_files[1])  # Use first match
                    try
                        if pattern == "nodepriors"
                            data = read_node_priors_from_json(file_path)
                            uploaded_data[data_type]["node_priors"] = Dict(string(k) => v for (k, v) in data)
                        elseif pattern == "linkprobabilities"
                            data = read_edge_probabilities_from_json(file_path)
                            uploaded_data[data_type]["edge_probabilities"] = Dict("$(k[1])->$(k[2])" => v for (k, v) in data)
                        elseif pattern == "capacities"
                            raw_data = JSON.parsefile(file_path)
                            capacities = raw_data["capacities"]
                            uploaded_data[data_type]["capacities"] = Dict(
                                "nodes" => capacities["nodes"],
                                "edges" => capacities["edges"],
                                "source_rates" => capacities["source_rates"]
                            )
                        elseif pattern == "cpm-inputs"
                            raw_data = JSON.parsefile(file_path)
                            uploaded_data[data_type]["cpm_data"] = raw_data
                        end
                    catch e
                        println("Warning: Failed to load $pattern from $file_path: $e")
                        # Continue loading other files even if one fails
                    end
                end
            end
            
            # Remove empty data type entries
            if isempty(uploaded_data[data_type])
                delete!(uploaded_data, data_type)
            end
        end
    end
    
    return uploaded_data
end

function serialize_uploaded_data_for_json(uploaded_data::Dict)
    """Convert uploaded data to JSON-serializable format, handling special types"""
    serialized = Dict()
    
    for (data_type, type_data) in uploaded_data
        serialized[data_type] = Dict()
        
        for (data_category, data_values) in type_data
            if data_category in ["node_priors", "edge_probabilities"]
                # Handle different value types (Float64, pbox, Interval)
                serialized[data_type][data_category] = Dict()
                for (key, value) in data_values
                    serialized[data_type][data_category][key] = convert_pbox_values(value)
                end
            else
                # For capacities and cpm_data, serialize as-is
                serialized[data_type][data_category] = convert_pbox_values(data_values)
            end
        end
    end
    
    return serialized
end

# Individual Analysis Endpoint Handlers

function handle_network_structure(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        
        if isempty(network_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path required"
            )))
        end
        
        # Validate network structure
        is_valid, message = validate_network_structure(network_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network structure: $message"
            )))
        end
        
        network_name = basename(network_path)
        filepath_graph = joinpath(network_path, network_name * ".EDGES")
        
        # Network Structure Analysis Only
        start_time = time()
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        
        # Identify network structure
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        computation_time = time() - start_time
        
        # Load uploaded data files
        uploaded_data_start_time = time()
        uploaded_data = load_uploaded_data_files(network_path)
        uploaded_data_time = time() - uploaded_data_start_time
        
        # Serialize uploaded data for JSON response
        serialized_uploaded_data = serialize_uploaded_data_for_json(uploaded_data)
        
        network_structure = Dict(
            "computation_time" => computation_time,
            "uploaded_data_time" => uploaded_data_time,
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
            "incoming_index" => Dict(string(k) => collect(v) for (k, v) in incoming_index),
            # NEW: Include uploaded data
            "uploaded_data" => serialized_uploaded_data,
            "uploaded_data_summary" => Dict(
                "available_data_types" => collect(keys(serialized_uploaded_data)),
                "data_types_count" => length(serialized_uploaded_data),
                "has_node_priors" => any(haskey(get(type_data, "node_priors", Dict()), "1") for type_data in values(serialized_uploaded_data) if haskey(type_data, "node_priors")),
                "has_edge_probabilities" => any(haskey(get(type_data, "edge_probabilities", Dict()), "1->2") for type_data in values(serialized_uploaded_data) if haskey(type_data, "edge_probabilities")),
                "has_capacities" => any(haskey(type_data, "capacities") for type_data in values(serialized_uploaded_data)),
                "has_cpm_data" => any(haskey(type_data, "cpm_data") for type_data in values(serialized_uploaded_data))
            )
        )
        
        result = Dict(
            "success" => true,
            "message" => "Network structure analysis completed",
            "network_name" => network_name,
            "timestamp" => Dates.now(),
            "network_structure" => network_structure
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Network structure analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Network structure analysis failed"
        )))
    end
end

function handle_diamond_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        use_default_priors = get(request_data, "useDefaultPriors", true)
        
        if isempty(network_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path required"
            )))
        end
        
        # Get network structure first
        network_name = basename(network_path)
        filepath_graph = joinpath(network_path, network_name * ".EDGES")
        
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        allnodes = collect(keys(incoming_index))
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Diamond Analysis
        start_time = time()
        
        # Create default node priors or use provided ones
        node_priors = if use_default_priors
            create_default_node_priors(allnodes)
        else
            # TODO: Load from provided file path
            create_default_node_priors(allnodes)
        end
        
        # Root diamonds
        root_diamonds = identify_and_group_diamonds(
            join_nodes, incoming_index, ancestors, descendants,
            source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
        )
        root_computation_time = time() - start_time
        
        # Unique diamonds
        unique_start_time = time()
        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds, node_priors, ancestors, descendants, iteration_sets
        )
        unique_computation_time = time() - unique_start_time
        
        diamond_analysis = Dict(
            "root_diamonds_count" => length(root_diamonds),
            "unique_diamonds_count" => length(unique_diamonds),
            "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
            "root_computation_time" => root_computation_time,
            "unique_computation_time" => unique_computation_time,
            "total_computation_time" => root_computation_time + unique_computation_time,
            "diamond_efficiency" => length(unique_diamonds) / max(1, length(root_diamonds)),
            "raw_root_diamonds" => serialize_root_diamonds_for_json(root_diamonds),
            "raw_unique_diamonds" => serialize_unique_diamonds_for_json(unique_diamonds)
        )
        
        result = Dict(
            "success" => true,
            "message" => "Diamond analysis completed",
            "network_name" => network_name,
            "timestamp" => Dates.now(),
            "diamond_analysis" => diamond_analysis
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Diamond analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Diamond analysis failed"
        )))
    end
end

function handle_reachability_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        nodepriors_path = get(request_data, "nodepriorsPath", "")
        linkprobs_path = get(request_data, "linkprobsPath", "")
        include_exact_inference = get(request_data, "includeExactInference", true)
        include_diamond_analysis = get(request_data, "includeDiamondAnalysis", false)
        
        if isempty(network_path) || isempty(nodepriors_path) || isempty(linkprobs_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path, nodepriors path, and linkprobs path required"
            )))
        end
        
        # Get network structure
        network_name = basename(network_path)
        filepath_graph = joinpath(network_path, network_name * ".EDGES")
        
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Load scenario data
        full_nodepriors_path = joinpath(network_path, nodepriors_path)
        full_linkprobs_path = joinpath(network_path, linkprobs_path)
        
        if !isfile(full_nodepriors_path) || !isfile(full_linkprobs_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Input files not found"
            )))
        end
        
        node_priors = read_node_priors_from_json(full_nodepriors_path)
        edge_probabilities = read_edge_probabilities_from_json(full_linkprobs_path)
        
        scenario_start_time = time()
        result_data = Dict()
        
        # Diamond Analysis (if requested)
        if include_diamond_analysis
            diamond_start_time = time()
            root_diamonds = identify_and_group_diamonds(
                join_nodes, incoming_index, ancestors, descendants,
                source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
            )
            
            unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                root_diamonds, node_priors, ancestors, descendants, iteration_sets
            )
            diamond_computation_time = time() - diamond_start_time
            
            result_data["diamond_analysis"] = Dict(
                "root_diamonds_count" => length(root_diamonds),
                "unique_diamonds_count" => length(unique_diamonds),
                "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
                "computation_time" => diamond_computation_time,
                "raw_root_diamonds" => serialize_root_diamonds_for_json(root_diamonds),
                "raw_unique_diamonds" => serialize_unique_diamonds_for_json(unique_diamonds)
            )
        end
        
        # Exact Inference (if requested)
        if include_exact_inference
            inference_start_time = time()
            
            # Get diamonds if not already computed
            if !haskey(result_data, "diamond_analysis")
                root_diamonds = identify_and_group_diamonds(
                    join_nodes, incoming_index, ancestors, descendants,
                    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
                )
                unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                    root_diamonds, node_priors, ancestors, descendants, iteration_sets
                )
            else
                # TODO: Extract from previous computation
                root_diamonds = Dict()  # Would need to deserialize
                unique_diamonds = Dict()  # Would need to deserialize
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
                beliefs_dict[string(node)] = belief
            end
            
            # Calculate statistics for numeric beliefs only
            numeric_beliefs = []
            for belief in values(output)
                if isa(belief, Float64)
                    push!(numeric_beliefs, belief)
                elseif isa(belief, Real) && !isa(belief, pbox) && !isa(belief, Interval)
                    push!(numeric_beliefs, Float64(belief))
                end
            end
            
            result_data["exact_inference"] = Dict(
                "beliefs" => beliefs_dict,
                "computation_time" => inference_computation_time,
                "total_nodes_processed" => length(output),
                "belief_statistics" => Dict(
                    "mean" => length(numeric_beliefs) > 0 ? sum(numeric_beliefs) / length(numeric_beliefs) : 0.0,
                    "min" => length(numeric_beliefs) > 0 ? minimum(numeric_beliefs) : 0.0,
                    "max" => length(numeric_beliefs) > 0 ? maximum(numeric_beliefs) : 0.0,
                    "numeric_count" => length(numeric_beliefs),
                    "total_count" => length(output)
                )
            )
        end
        
        total_time = time() - scenario_start_time
        result_data["scenario_computation_time"] = total_time
        result_data["input_files"] = Dict(
            "nodepriors_path" => nodepriors_path,
            "linkprobs_path" => linkprobs_path
        )
        
        # Convert Pbox values
        converted_result = convert_pbox_values(result_data)
        
        result = Dict(
            "success" => true,
            "message" => "Reachability analysis completed",
            "network_name" => network_name,
            "timestamp" => Dates.now(),
            "reachability_result" => converted_result
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Reachability analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Reachability analysis failed"
        )))
    end
end

function handle_capacity_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        capacities_path = get(request_data, "capacitiesPath", "")
        
        if isempty(network_path) || isempty(capacities_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path and capacities path required"
            )))
        end
        
        # Get network structure
        network_name = basename(network_path)
        filepath_graph = joinpath(network_path, network_name * ".EDGES")
        
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Load capacity data
        full_capacities_path = joinpath(network_path, capacities_path)
        if !isfile(full_capacities_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Capacities file not found"
            )))
        end
        
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
            if rate > 0.0
                source_rates[parse(Int64, k)] = rate
            end
        end
        
        # Target nodes are sink nodes
        targets = Set{Int64}(sink_nodes)
        
        # Run capacity analysis
        capacity_start_time = time()
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
        
        result_data = Dict(
            "computation_time" => capacity_computation_time,
            "network_utilization" => capacity_result.network_utilization,
            "total_source_input" => sum(values(source_rates)),
            "total_target_output" => sum(values(target_flows)),
            "target_flows" => target_flows,
            "active_sources" => collect(keys(source_rates)),
            "target_nodes" => collect(targets),
            "node_capacities_count" => length(node_capacities),
            "edge_capacities_count" => length(edge_capacities),
            "input_files" => Dict("capacities_path" => capacities_path),
            "raw_capacity_result" => Dict(
                "node_max_flows" => Dict(string(k) => v for (k, v) in capacity_result.node_max_flows),
                "bottlenecks" => Dict(string(k) => v for (k, v) in capacity_result.bottlenecks),
                "critical_paths" => Dict(string(k) => v for (k, v) in capacity_result.critical_paths),
                "network_utilization" => capacity_result.network_utilization,
                "analysis_type" => string(capacity_result.analysis_type),
                "computation_time" => capacity_result.computation_time,
                "convergence_info" => capacity_result.convergence_info
            )
        )
        
        result = Dict(
            "success" => true,
            "message" => "Capacity analysis completed",
            "network_name" => network_name,
            "timestamp" => Dates.now(),
            "capacity_result" => result_data
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Capacity analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Capacity analysis failed"
        )))
    end
end

function handle_cpm_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        cpm_path = get(request_data, "cpmPath", "")
        
        if isempty(network_path) || isempty(cpm_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path and CPM path required"
            )))
        end
        
        # Get network structure
        network_name = basename(network_path)
        filepath_graph = joinpath(network_path, network_name * ".EDGES")
        
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        allnodes = collect(keys(incoming_index))
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Load CPM data
        full_cpm_path = joinpath(network_path, cpm_path)
        if !isfile(full_cpm_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "CPM file not found"
            )))
        end
        
        cpm_data = JSON.parsefile(full_cpm_path)
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
        
        # Run CPM analysis
        cpm_start_time = time()
        
        # Time-based critical path analysis
        time_params = CriticalPathParameters(
            node_durations, edge_delays, 0.0,
            max_combination, additive_propagation, additive_propagation
        )
        time_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, time_params)
        
        # Cost-based critical path analysis
        cost_params = CriticalPathParameters(
            node_costs, edge_costs, 0.0,
            max_combination, additive_propagation, additive_propagation
        )
        cost_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, cost_params)
        
        cpm_computation_time = time() - cpm_start_time
        
        result_data = Dict(
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
        
        result = Dict(
            "success" => true,
            "message" => "CPM analysis completed",
            "network_name" => network_name,
            "timestamp" => Dates.now(),
            "cpm_result" => result_data
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("CPM analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "CPM analysis failed"
        )))
    end
end

# HTTP request handlers
function handle_upload(req::HTTP.Request)
    # Define CORS headers outside try block for catch access
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        # Generate unique upload session ID
        upload_id = string(uuid4())
        upload_path = joinpath(UPLOAD_DIR, upload_id)
        
        # Create upload directory
        mkpath(upload_path)
        
        # Parse multipart form data
        content_type = HTTP.header(req, "Content-Type")
        if !startswith(content_type, "multipart/form-data")
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Expected multipart/form-data"
            )))
        end
        
        # Extract boundary from content-type
        boundary_match = match(r"boundary=([^;]+)", content_type)
        if boundary_match === nothing
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Missing boundary in multipart data"
            )))
        end
        
        boundary = String(boundary_match.captures[1])
        body_str = String(req.body)
        
        # Parse multipart data
        uploaded_files = parse_multipart_data(body_str, boundary, upload_path)
        
        if isempty(uploaded_files)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "No files uploaded"
            )))
        end
        
        # Detect network structure and organize files
        network_info = organize_uploaded_files(upload_path, uploaded_files)
        
        if network_info === nothing
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "No valid network structure found. Please upload .EDGES files and associated scenario files."
            )))
        end
        
        println("Upload successful: $(length(uploaded_files)) files uploaded to $upload_path")
        println("Network detected: $(network_info["network_name"])")
        println("Network path: $(network_info["network_path"])")
        
        headers = [
            "Access-Control-Allow-Origin" => "*",
            "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" => "Content-Type, Authorization",
            "Content-Type" => "application/json"
        ]
        
        response_data = Dict(
            "success" => true,
            "message" => "Files uploaded successfully",
            "network_path" => network_info["network_path"],
            "upload_id" => upload_id,
            "files_count" => length(uploaded_files),
            "network_name" => network_info["network_name"],
            "validation_results" => network_info["validation"]
        )
        
        println("Returning upload response: ", JSON.json(response_data))
        
        return HTTP.Response(200, headers, JSON.json(response_data))
        
    catch e
        println("Upload error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Upload failed due to server error"
        )))
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
    # Individual Analysis Endpoints
    HTTP.register!(router, "POST", "/network-structure", handle_network_structure)
    HTTP.register!(router, "POST", "/diamond-analysis", handle_diamond_analysis)
    HTTP.register!(router, "POST", "/reachability-analysis", handle_reachability_analysis)
    HTTP.register!(router, "POST", "/capacity-analysis", handle_capacity_analysis)
    HTTP.register!(router, "POST", "/cpm-analysis", handle_cpm_analysis)
    
    # Health check
    HTTP.register!(router, "GET", "/health", req -> HTTP.Response(200, [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ], JSON.json(Dict("status" => "healthy"))))
    
    # Start server
    println("Starting flexible multi-scenario backend server...")
    HTTP.serve(router, "0.0.0.0", PORT)
end

# Export main functions
export start_server, run_conditional_network_analysis, process_network_analysis_with_config

# Start server if run directly
 start_server()
 