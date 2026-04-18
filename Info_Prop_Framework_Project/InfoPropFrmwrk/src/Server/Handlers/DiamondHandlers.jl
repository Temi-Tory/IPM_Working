module DiamondHandlers

using HTTP
using JSON
using Dates
using ..ServerCommon
using ..InfoPropFramework
using ..CapacityHandlers
using ..AnalysisCommon

function handle_diamond_analysis(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, POST, OPTIONS")

    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        nodepriors_path = get(request_data, "nodepriorsPath", "")

        if isempty(network_path)
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Network path required")))
        end

        resolved_edges_path, is_valid, message = resolve_edges_path_or_error(network_path, edges_file_path)
        if !is_valid
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Invalid network file: $(message)")))
        end

        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(resolved_edges_path)
        all_nodes = sort!(collect(union(Set(first.(edgelist)), Set(last.(edgelist)))))
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

        node_priors = if isempty(nodepriors_path)
            default_node_priors(all_nodes)
        else
            full_nodepriors_path = ServerCommon.safe_joinpath(network_path, nodepriors_path)
            isfile(full_nodepriors_path) ? read_node_priors_from_json(full_nodepriors_path) : default_node_priors(all_nodes)
        end

        started = time()
        root_diamonds = identify_and_group_diamonds(
            join_nodes,
            incoming_index,
            ancestors,
            descendants,
            source_nodes,
            fork_nodes,
            edgelist,
            node_priors,
            iteration_sets,
        )

        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds,
            node_priors,
            ancestors,
            descendants,
            iteration_sets,
        )
        elapsed = time() - started

        result = Dict(
            "success" => true,
            "message" => "Diamond analysis completed",
            "edges_file_path" => resolved_edges_path,
            "nodepriors_path" => nodepriors_path,
            "timestamp" => Dates.now(),
            "diamond_analysis" => Dict(
                "computation_time" => elapsed,
                "root_diamonds_count" => length(root_diamonds),
                "unique_diamonds_count" => length(unique_diamonds),
                "join_nodes_with_diamonds" => sort!(collect(keys(root_diamonds))),
                "raw_root_diamonds" => serialize_root_diamonds(root_diamonds),
                "raw_unique_diamonds" => serialize_unique_diamonds(unique_diamonds),
            ),
        )

        return HTTP.Response(200, headers, JSON.json(result))
    catch e
        return HTTP.Response(500, headers, JSON.json(Dict("success" => false, "error" => string(e), "message" => "Diamond analysis failed")))
    end
end

function handle_diamond_subgraph_analysis(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, POST, OPTIONS")

    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        nodepriors_path = get(request_data, "nodepriorsPath", "")
        linkprobs_path = get(request_data, "linkprobsPath", "")
        capacities_path = get(request_data, "capacitiesPath", "")
        cpm_path = get(request_data, "cpmPath", "")
        analyses = Set{String}(String.(get(request_data, "analyses", String[])))
        source_overrides = get(request_data, "sourceOverrides", nothing)
        diamond_hash_str = get(request_data, "diamondHash", "")

        if isempty(network_path) || isempty(diamond_hash_str)
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "networkPath and diamondHash are required")))
        end

        diamond_hash = parse(UInt64, diamond_hash_str)
        payload = find_or_build_diamond(network_path, edges_file_path, nodepriors_path)
        unique_diamonds = payload.unique_diamonds

        if !haskey(unique_diamonds, diamond_hash)
            return HTTP.Response(404, headers, JSON.json(Dict("success" => false, "message" => "Diamond with hash $(diamond_hash_str) not found")))
        end

        diamond_data = unique_diamonds[diamond_hash]
        result_data = Dict{String, Any}(
            "success" => true,
            "diamond_hash" => diamond_hash_str,
            "diamond_info" => Dict(
                "join_nodes" => sort!(collect(diamond_data.sub_join_nodes)),
                "conditioning_nodes" => sort!(collect(diamond_data.diamond.conditioning_nodes)),
                "node_count" => length(diamond_data.sub_node_priors),
                "edge_count" => length(diamond_data.diamond.edgelist),
                "source_nodes" => sort!(collect(diamond_data.sub_sources)),
                "fork_nodes" => sort!(collect(diamond_data.sub_fork_nodes)),
                "is_root_diamond" => diamond_data.is_rootDiamond,
            ),
        )

        if "reachability" in analyses && !isempty(linkprobs_path)
            full_linkprobs_path = ServerCommon.safe_joinpath(network_path, linkprobs_path)
            if isfile(full_linkprobs_path)
                edge_probabilities_all = read_edge_probabilities_from_json(full_linkprobs_path)
                node_priors = copy(diamond_data.sub_node_priors)

                if source_overrides !== nothing && haskey(source_overrides, "reachability")
                    for (node_str, value) in source_overrides["reachability"]
                        node_id = parse(Int64, String(node_str))
                        if haskey(node_priors, node_id) && isa(node_priors[node_id], Float64)
                            node_priors[node_id] = Float64(value)
                        end
                    end
                end

                edge_set = Set(diamond_data.diamond.edgelist)
                edge_probabilities = Dict{Tuple{Int64,Int64}, typeof(first(values(node_priors)))}()
                for (edge, value) in edge_probabilities_all
                    if edge in edge_set
                        edge_probabilities[edge] = value
                    end
                end

                prior_type = typeof(first(values(node_priors)))
                cache = Dict{CacheKey, DiamondCacheEntry{prior_type}}()
                beliefs = update_beliefs_iterative(
                    diamond_data.diamond.edgelist,
                    diamond_data.sub_iteration_sets,
                    diamond_data.sub_outgoing_index,
                    diamond_data.sub_incoming_index,
                    diamond_data.sub_sources,
                    node_priors,
                    edge_probabilities,
                    diamond_data.sub_descendants,
                    diamond_data.sub_ancestors,
                    diamond_data.sub_diamond_structures,
                    diamond_data.sub_join_nodes,
                    diamond_data.sub_fork_nodes,
                    unique_diamonds,
                    cache,
                )

                result_data["reachability_result"] = Dict(
                    "beliefs" => convert_values(Dict(string(k) => v for (k, v) in beliefs)),
                    "cache" => cache_payload(cache),
                )
            end
        end

        if ("flow" in analyses || "capacity" in analyses) && !isempty(capacities_path)
            full_capacities_path = ServerCommon.safe_joinpath(network_path, capacities_path)
            if isfile(full_capacities_path)
                parsed_capacity = CapacityHandlers.parse_capacity_input_file(full_capacities_path)
                sub_edge_set = Set(diamond_data.diamond.edgelist)

                sub_edge_capacities = Dict{Tuple{Int64,Int64}, Float64}()
                for (edge, cap) in parsed_capacity.edge_capacities
                    if edge in sub_edge_set
                        sub_edge_capacities[edge] = cap
                    end
                end

                sub_nodes = Set{Int64}()
                for edge in sub_edge_set
                    push!(sub_nodes, edge[1], edge[2])
                end
                sub_sink_nodes = sort!([n for n in collect(sub_nodes) if !haskey(diamond_data.sub_outgoing_index, n) || isempty(diamond_data.sub_outgoing_index[n])])
                sub_node_capacities = isempty(parsed_capacity.node_capacities) ? nothing : Dict(k => v for (k, v) in parsed_capacity.node_capacities if k in sub_nodes)

                flow_result = analyze_all(
                    diamond_data.diamond.edgelist,
                    diamond_data.sub_outgoing_index,
                    diamond_data.sub_incoming_index,
                    sub_edge_capacities,
                    sort!(collect(diamond_data.sub_sources)),
                    sub_sink_nodes;
                    node_capacities=sub_node_capacities,
                )

                result_data["flow_result"] = CapacityHandlers.serialize_capacity_result(flow_result)
            end
        end

        if "cpm" in analyses && !isempty(cpm_path)
            full_cpm_path = ServerCommon.safe_joinpath(network_path, cpm_path)
            if isfile(full_cpm_path)
                cpm_data = JSON.parsefile(full_cpm_path)
                time_analysis = cpm_data["time_analysis"]
                cost_analysis = cpm_data["cost_analysis"]
                cpm_data_type = String(get(cpm_data, "data_type", "Float64"))

                T = lowercase(cpm_data_type) == "interval" ? Interval : Float64
                initial = T == Interval ? Interval(0.0, 0.0) : 0.0

                node_durations_all = parse_node_values(time_analysis["node_durations"], T)
                edge_delays_all = parse_edge_values(time_analysis["edge_delays"], T)
                node_costs_all = parse_node_values(cost_analysis["node_costs"], T)
                edge_costs_all = parse_edge_values(cost_analysis["edge_costs"], T)

                sub_nodes = Set(keys(diamond_data.sub_incoming_index))
                sub_edges = Set(diamond_data.diamond.edgelist)
                node_durations = Dict(k => v for (k, v) in node_durations_all if k in sub_nodes)
                edge_delays = Dict(k => v for (k, v) in edge_delays_all if k in sub_edges)
                node_costs = Dict(k => v for (k, v) in node_costs_all if k in sub_nodes)
                edge_costs = Dict(k => v for (k, v) in edge_costs_all if k in sub_edges)

                time_params = CriticalPathParameters(node_durations, edge_delays, initial, max_combination, additive_propagation, additive_propagation)
                time_result = critical_path_analysis(diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index, diamond_data.sub_incoming_index, diamond_data.sub_sources, time_params)
                time_extended = backward_pass_analysis(time_result, diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index, time_params)

                cost_params = CriticalPathParameters(node_costs, edge_costs, initial, max_combination, additive_propagation, additive_propagation)
                cost_result = critical_path_analysis(diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index, diamond_data.sub_incoming_index, diamond_data.sub_sources, cost_params)
                cost_extended = backward_pass_analysis(cost_result, diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index, cost_params)

                result_data["cpm_result"] = Dict(
                    "time_result" => Dict(
                        "critical_value" => convert_values(time_result.critical_value),
                        "critical_nodes" => sort!(collect(time_result.critical_nodes)),
                        "node_values" => convert_values(Dict(string(k) => v for (k, v) in time_result.node_values)),
                        "early_start" => convert_values(Dict(string(k) => v for (k, v) in time_extended.early_start)),
                        "late_finish" => convert_values(Dict(string(k) => v for (k, v) in time_extended.late_finish)),
                        "total_slack" => convert_values(Dict(string(k) => v for (k, v) in time_extended.total_slack)),
                    ),
                    "cost_result" => Dict(
                        "critical_value" => convert_values(cost_result.critical_value),
                        "critical_nodes" => sort!(collect(cost_result.critical_nodes)),
                        "node_values" => convert_values(Dict(string(k) => v for (k, v) in cost_result.node_values)),
                        "early_start" => convert_values(Dict(string(k) => v for (k, v) in cost_extended.early_start)),
                        "late_finish" => convert_values(Dict(string(k) => v for (k, v) in cost_extended.late_finish)),
                        "total_slack" => convert_values(Dict(string(k) => v for (k, v) in cost_extended.total_slack)),
                    ),
                )
            end
        end

        return HTTP.Response(200, headers, JSON.json(result_data))
    catch e
        return HTTP.Response(500, headers, JSON.json(Dict("success" => false, "error" => string(e), "message" => "Diamond subgraph analysis failed")))
    end
end

function register!(router::HTTP.Router)
    HTTP.register!(router, "POST", "/diamond-analysis", handle_diamond_analysis)
    HTTP.register!(router, "POST", "/diamond-subgraph-analysis", handle_diamond_subgraph_analysis)
end

end # module DiamondHandlers
