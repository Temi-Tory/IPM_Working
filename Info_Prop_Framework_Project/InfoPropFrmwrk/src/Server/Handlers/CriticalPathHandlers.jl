module CriticalPathHandlers

using HTTP
using JSON
using Dates
using ..ServerCommon
using ..InfoPropFramework
using ..AnalysisCommon

# Schedule / Critical Path toolkit — wired to CriticalPathV2Module (mode-based, oracle-validated).
# V1 (CriticalPathModule) is retired from this path: its interval and sum-slack outputs are
# flagged buggy in validation/CPM_STATE_OF_UNION.md and must not be exposed.
#
# Modes: LongestPath (max/+, classical CPM), ShortestPath (min/+), MaxScaling (max/x),
# Accumulation (sum/+, adjoint backward). Value types: Float64 and Interval only.
# The mode for each of the time and cost passes is taken from the CPM input file's own
# declared combination_function / propagation_function, or overridden by request `mode`
# (time) / `costMode` (cost).

function _empty_map(section, key)
    v = get(section, key, nothing)
    (v === nothing || !isa(v, AbstractDict)) ? Dict{String,Any}() : v
end

function handle_critical_path_analysis(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, POST, OPTIONS")

    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        cpm_path = get(request_data, "cpmPath", "")
        requested_mode = get(request_data, "mode", nothing)
        requested_cost_mode = get(request_data, "costMode", requested_mode)

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
        time_analysis = get(cpm_data, "time_analysis", nothing)
        cost_analysis = get(cpm_data, "cost_analysis", nothing)
        cpm_data_type = lowercase(String(get(cpm_data, "data_type", "Float64")))
        value_type = cpm_data_type == "interval" ? :interval : :float64

        if time_analysis === nothing
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "CPM file has no time_analysis section")))
        end

        started = time()

        time_mode = resolve_cpm_mode(time_analysis, requested_mode)
        time_result = run_cpm_v2(
            iteration_sets, outgoing_index, incoming_index, source_nodes,
            time_analysis["node_durations"], _empty_map(time_analysis, "edge_delays");
            value_type=value_type, mode=time_mode,
            initial=get(time_analysis, "initial_time", 0.0),
        )

        cost_mode = nothing
        cost_result = nothing
        if cost_analysis !== nothing
            cost_mode = resolve_cpm_mode(cost_analysis, requested_cost_mode)
            cost_result = run_cpm_v2(
                iteration_sets, outgoing_index, incoming_index, source_nodes,
                cost_analysis["node_costs"], _empty_map(cost_analysis, "edge_costs");
                value_type=value_type, mode=cost_mode,
                initial=get(cost_analysis, "initial_cost", 0.0),
            )
        end

        elapsed = time() - started

        payload = Dict{String,Any}(
            "module_version" => "CriticalPathV2",
            "value_type" => value_type == :interval ? "Interval" : "Float64",
            "time_mode" => cpm_v2_mode_name(time_mode),
            "cost_mode" => cost_mode === nothing ? nothing : cpm_v2_mode_name(cost_mode),
            "computation_time" => elapsed,
            "time_result" => time_result,
            "cost_result" => cost_result,
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
