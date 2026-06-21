module CriticalPathHandlers

using HTTP
using JSON
using Dates
using ..ServerCommon
using ..InfoPropFramework
using ..AnalysisCommon

function handle_critical_path_analysis(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, POST, OPTIONS")

    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        cpm_path = get(request_data, "cpmPath", "")

        if isempty(network_path) || isempty(cpm_path)
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "networkPath and cpmPath are required")))
        end

        resolved_edges_path, is_valid, message = resolve_edges_path_or_error(
            network_path,
            edges_file_path;
            cpm_path=cpm_path,
        )
        if !is_valid
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Invalid network file: $(message)")))
        end

        full_cpm_path = ServerCommon.resolve_network_file_path(network_path, cpm_path)
        if !isfile(full_cpm_path)
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "CPM file not found")))
        end

        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(resolved_edges_path)
        iteration_sets, _, _ = find_iteration_sets(edgelist, outgoing_index, incoming_index)

        cpm_data = JSON.parsefile(full_cpm_path)
        time_analysis = cpm_data["time_analysis"]
        cost_analysis = cpm_data["cost_analysis"]
        cpm_data_type = String(get(cpm_data, "data_type", "Float64"))

        T = lowercase(cpm_data_type) == "interval" ? Interval : Float64
        initial = T == Interval ? Interval(0.0, 0.0) : 0.0

        node_durations = parse_node_values(time_analysis["node_durations"], T)
        edge_delays = parse_edge_values(time_analysis["edge_delays"], T)
        node_costs = parse_node_values(cost_analysis["node_costs"], T)
        edge_costs = parse_edge_values(cost_analysis["edge_costs"], T)

        started = time()

        time_params = CriticalPathParameters(
            node_durations,
            edge_delays,
            initial,
            CriticalPathModule.max_combination,
            CriticalPathModule.additive_propagation,
            CriticalPathModule.additive_propagation,
        )
        time_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, time_params)
        time_extended = backward_pass_analysis(time_result, iteration_sets, outgoing_index, time_params)

        cost_params = CriticalPathParameters(
            node_costs,
            edge_costs,
            initial,
            CriticalPathModule.max_combination,
            CriticalPathModule.additive_propagation,
            CriticalPathModule.additive_propagation,
        )
        cost_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, cost_params)
        cost_extended = backward_pass_analysis(cost_result, iteration_sets, outgoing_index, cost_params)

        elapsed = time() - started

        near_critical_nodes = if T == Float64
            threshold = time_result.critical_value * 0.1
            sort!([k for (k, v) in time_extended.total_slack if v > 0 && v < threshold])
        else
            Int64[]
        end

        payload = Dict(
            "computation_time" => elapsed,
            "time_result" => Dict(
                "critical_value" => convert_values(time_result.critical_value),
                "critical_nodes" => sort!(collect(time_result.critical_nodes)),
                "near_critical_nodes" => near_critical_nodes,
                "near_critical_count" => length(near_critical_nodes),
                "node_values" => convert_values(Dict(string(k) => v for (k, v) in time_result.node_values)),
                "early_start" => convert_values(Dict(string(k) => v for (k, v) in time_extended.early_start)),
                "late_finish" => convert_values(Dict(string(k) => v for (k, v) in time_extended.late_finish)),
                "late_start" => convert_values(Dict(string(k) => v for (k, v) in time_extended.late_start)),
                "total_slack" => convert_values(Dict(string(k) => v for (k, v) in time_extended.total_slack)),
            ),
            "cost_result" => Dict(
                "critical_value" => convert_values(cost_result.critical_value),
                "critical_nodes" => sort!(collect(cost_result.critical_nodes)),
                "node_values" => convert_values(Dict(string(k) => v for (k, v) in cost_result.node_values)),
                "early_start" => convert_values(Dict(string(k) => v for (k, v) in cost_extended.early_start)),
                "late_finish" => convert_values(Dict(string(k) => v for (k, v) in cost_extended.late_finish)),
                "late_start" => convert_values(Dict(string(k) => v for (k, v) in cost_extended.late_start)),
                "total_slack" => convert_values(Dict(string(k) => v for (k, v) in cost_extended.total_slack)),
            ),
            "input_files" => Dict("cpm_path" => cpm_path),
        )

        return HTTP.Response(200, headers, JSON.json(Dict(
            "success" => true,
            "message" => "Critical path analysis completed",
            "endpoint" => "critical-path-analysis",
            "edges_file_path" => resolved_edges_path,
            "cpm_path" => cpm_path,
            "timestamp" => Dates.now(),
            "critical_path_result" => payload,
        )))
    catch e
        return ServerCommon.error_response(req, e, "Critical path analysis failed"; headers=headers)
    end
end

function handle_cpm_analysis(req::HTTP.Request)
    response = handle_critical_path_analysis(req)
    if response.status == 200
        body = JSON.parse(String(response.body))
        body["endpoint"] = "cpm-analysis"
        body["message"] = "CPM analysis completed"
        return HTTP.Response(200, response.headers, JSON.json(body))
    end
    return response
end

function register!(router::HTTP.Router)
    HTTP.register!(router, "POST", "/critical-path-analysis", handle_critical_path_analysis)
    HTTP.register!(router, "POST", "/cpm-analysis", handle_cpm_analysis)
end

end # module CriticalPathHandlers
