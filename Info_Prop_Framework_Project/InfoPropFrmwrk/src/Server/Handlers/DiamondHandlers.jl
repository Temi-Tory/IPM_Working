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

        diamond_payload = find_or_build_diamond(network_path, edges_file_path, nodepriors_path)
        resolved_edges_path = diamond_payload.resolved_edges_path
        root_diamonds = diamond_payload.root_diamonds
        unique_diamonds = diamond_payload.unique_diamonds
        elapsed = diamond_payload.computation_time

        result = Dict(
            "success" => true,
            "message" => "Diamond analysis completed",
            "edges_file_path" => resolved_edges_path,
            "nodepriors_path" => nodepriors_path,
            "timestamp" => Dates.now(),
            "diamond_analysis" => Dict(
                "computation_time" => elapsed,
                "cache_hit" => diamond_payload.cache_hit,
                "root_diamonds_count" => length(root_diamonds),
                "unique_diamonds_count" => length(unique_diamonds),
                "join_nodes_with_diamonds" => sort!(collect(keys(root_diamonds))),
                "raw_root_diamonds" => serialize_root_diamonds(root_diamonds),
                "raw_unique_diamonds" => serialize_unique_diamonds(unique_diamonds),
            ),
        )

        return HTTP.Response(200, headers, JSON.json(result))
    catch e
        return ServerCommon.error_response(req, e, "Diamond analysis failed"; headers=headers)
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
        payload = find_or_build_diamond(
            network_path,
            edges_file_path,
            nodepriors_path;
            linkprobs_path=linkprobs_path,
            capacities_path=capacities_path,
            cpm_path=cpm_path,
        )
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
            full_linkprobs_path = ServerCommon.resolve_network_file_path(network_path, linkprobs_path)
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

                # Re-identify diamonds SCOPED TO THIS SUBGRAPH. `diamond_data.sub_diamond_structures`
                # and the global `unique_diamonds` carry nested diamonds whose `relevant_nodes` were
                # computed against the full graph — they can reference nodes upstream of this
                # subgraph's sources (not in `node_priors`), which makes `update_beliefs_iterative`
                # throw a KeyError when it recurses. Running `new_identify` on the isolated edge list
                # gives a self-consistent structure + lookup for the subgraph.
                sub_structures, sub_lookup = new_identify(
                    diamond_data.diamond.edgelist,
                    node_priors,
                    edge_probabilities,
                    diamond_data.sub_sources,
                    diamond_data.sub_fork_nodes,
                    diamond_data.sub_join_nodes,
                    diamond_data.sub_ancestors,
                    diamond_data.sub_descendants,
                    diamond_data.sub_iteration_sets,
                )

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
                    sub_structures,
                    diamond_data.sub_join_nodes,
                    diamond_data.sub_fork_nodes,
                    sub_lookup,
                    cache,
                )

                result_data["reachability_result"] = Dict(
                    "beliefs" => convert_values(Dict(string(k) => v for (k, v) in beliefs)),
                    "cache" => cache_payload(cache),
                )
            end
        end

        if ("flow" in analyses || "capacity" in analyses) && !isempty(capacities_path)
            full_capacities_path = ServerCommon.resolve_network_file_path(network_path, capacities_path)
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
            full_cpm_path = ServerCommon.resolve_network_file_path(network_path, cpm_path)
            if isfile(full_cpm_path)
                cpm_data = JSON.parsefile(full_cpm_path)
                time_analysis = cpm_data["time_analysis"]
                cost_analysis = get(cpm_data, "cost_analysis", nothing)
                value_type = lowercase(String(get(cpm_data, "data_type", "Float64"))) == "interval" ? :interval : :float64

                # Restrict the CPM inputs to this diamond's subgraph. The V2 engine then runs
                # on the diamond's own sub_* structure exactly as update_beliefs_iterative does.
                sub_edges = Set(diamond_data.diamond.edgelist)
                sub_nodes = Set{Int64}()
                for (u, v) in sub_edges
                    push!(sub_nodes, u, v)
                end

                cpm_mode_req = get(request_data, "cpmMode", nothing)
                time_mode = resolve_cpm_mode(time_analysis, cpm_mode_req)

                time_result = run_cpm_v2(
                    diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index,
                    diamond_data.sub_incoming_index, diamond_data.sub_sources,
                    time_analysis["node_durations"], get(time_analysis, "edge_delays", Dict{String,Any}());
                    value_type=value_type, mode=time_mode,
                    initial=get(time_analysis, "initial_time", 0.0),
                    restrict_nodes=sub_nodes, restrict_edges=sub_edges,
                )

                cost_mode = nothing
                cost_result = nothing
                if cost_analysis !== nothing
                    cost_mode = resolve_cpm_mode(cost_analysis, get(request_data, "cpmCostMode", cpm_mode_req))
                    cost_result = run_cpm_v2(
                        diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index,
                        diamond_data.sub_incoming_index, diamond_data.sub_sources,
                        cost_analysis["node_costs"], get(cost_analysis, "edge_costs", Dict{String,Any}());
                        value_type=value_type, mode=cost_mode,
                        initial=get(cost_analysis, "initial_cost", 0.0),
                        restrict_nodes=sub_nodes, restrict_edges=sub_edges,
                    )
                end

                result_data["cpm_result"] = Dict{String,Any}(
                    "module_version" => "CriticalPathV2",
                    "value_type" => value_type == :interval ? "Interval" : "Float64",
                    "time_mode" => cpm_v2_mode_name(time_mode),
                    "cost_mode" => cost_mode === nothing ? nothing : cpm_v2_mode_name(cost_mode),
                    "time_result" => time_result,
                    "cost_result" => cost_result,
                )
            end
        end

        return HTTP.Response(200, headers, JSON.json(result_data))
    catch e
        return ServerCommon.error_response(req, e, "Diamond subgraph analysis failed"; headers=headers)
    end
end

function register!(router::HTTP.Router)
    HTTP.register!(router, "POST", "/diamond-analysis", handle_diamond_analysis)
    HTTP.register!(router, "POST", "/diamond-subgraph-analysis", handle_diamond_subgraph_analysis)
end

end # module DiamondHandlers
