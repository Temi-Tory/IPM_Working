module CapacityHandlers

using HTTP
using JSON
using Dates
using ..ServerCommon
using ..InfoPropFramework

function _parse_capacity_value(raw)
    if isa(raw, Real)
        v = Float64(raw)
        isnan(v) && throw(ArgumentError("Capacity cannot be NaN"))
        v < 0.0 && throw(ArgumentError("Capacity must be non-negative"))
        return v
    end

    if isa(raw, String)
        token = lowercase(strip(raw))
        if token in ("inf", "+inf", "infinity", "+infinity", "∞")
            return Inf
        end
        v = parse(Float64, token)
        isnan(v) && throw(ArgumentError("Capacity cannot be NaN"))
        v < 0.0 && throw(ArgumentError("Capacity must be non-negative"))
        return v
    end

    throw(ArgumentError("Unsupported capacity value type: $(typeof(raw))"))
end

function _parse_edge_key(edge_key::String)
    m = match(r"\(\s*(\d+)\s*,\s*(\d+)\s*\)", edge_key)
    m === nothing && throw(ArgumentError("Invalid edge key format: $(edge_key). Expected '(u,v)'."))
    return (parse(Int64, m.captures[1]), parse(Int64, m.captures[2]))
end

function _parse_legacy_capacity_json(data::AbstractDict)
    haskey(data, "capacities") || throw(ArgumentError("Legacy capacity schema requires top-level 'capacities' key"))
    caps = data["capacities"]

    haskey(caps, "edges") || throw(ArgumentError("Legacy capacity schema requires capacities.edges"))
    edge_caps_raw = caps["edges"]
    isa(edge_caps_raw, AbstractDict) || throw(ArgumentError("capacities.edges must be an object"))

    edge_capacities = Dict{Tuple{Int64,Int64},Float64}()
    for (k, v) in edge_caps_raw
        edge_capacities[_parse_edge_key(String(k))] = _parse_capacity_value(v)
    end

    node_capacities = Dict{Int64,Float64}()
    if haskey(caps, "nodes") && isa(caps["nodes"], AbstractDict)
        for (k, v) in caps["nodes"]
            node_capacities[parse(Int64, String(k))] = _parse_capacity_value(v)
        end
    end

    source_rates = Dict{Int64,Float64}()
    if haskey(caps, "source_rates") && isa(caps["source_rates"], AbstractDict)
        for (k, v) in caps["source_rates"]
            source_rates[parse(Int64, String(k))] = Float64(v)
        end
    end

    target_nodes = Int64[]
    if haskey(data, "target_nodes") && isa(data["target_nodes"], AbstractVector)
        target_nodes = Int64[Int64(x) for x in data["target_nodes"]]
    end

    return (
        edge_capacities=edge_capacities,
        node_capacities=node_capacities,
        source_rates=source_rates,
        target_nodes=target_nodes,
        schema="legacy-capacities-object",
    )
end

function _parse_toolkit_capacity_json(data::AbstractDict)
    haskey(data, "edges") || throw(ArgumentError("Toolkit capacity schema requires top-level 'edges' key"))
    isa(data["edges"], AbstractVector) || throw(ArgumentError("Toolkit 'edges' must be an array"))

    edge_capacities = Dict{Tuple{Int64,Int64},Float64}()
    for (i, edge_data) in enumerate(data["edges"])
        isa(edge_data, AbstractDict) || throw(ArgumentError("Invalid edge entry at index $(i): expected object"))
        haskey(edge_data, "source") || throw(ArgumentError("Missing 'source' in edges[$(i)]"))
        haskey(edge_data, "destination") || throw(ArgumentError("Missing 'destination' in edges[$(i)]"))
        haskey(edge_data, "capacity") || throw(ArgumentError("Missing 'capacity' in edges[$(i)]"))
        source = Int64(edge_data["source"])
        target = Int64(edge_data["destination"])
        edge_capacities[(source, target)] = _parse_capacity_value(edge_data["capacity"])
    end

    node_capacities = Dict{Int64,Float64}()
    if haskey(data, "nodes")
        isa(data["nodes"], AbstractVector) || throw(ArgumentError("Toolkit 'nodes' must be an array"))
        for (i, node_entry) in enumerate(data["nodes"])
            isa(node_entry, AbstractDict) || throw(ArgumentError("Invalid node entry at index $(i): expected object"))
            haskey(node_entry, "node") || throw(ArgumentError("Missing 'node' in nodes[$(i)]"))
            haskey(node_entry, "capacity") || throw(ArgumentError("Missing 'capacity' in nodes[$(i)]"))
            node_capacities[Int64(node_entry["node"])] = _parse_capacity_value(node_entry["capacity"])
        end
    end

    target_nodes = Int64[]
    if haskey(data, "target_nodes") && isa(data["target_nodes"], AbstractVector)
        target_nodes = Int64[Int64(x) for x in data["target_nodes"]]
    end

    return (
        edge_capacities=edge_capacities,
        node_capacities=node_capacities,
        source_rates=Dict{Int64,Float64}(),
        target_nodes=target_nodes,
        schema="toolkit-edges-array",
    )
end

function parse_capacity_input_file(filename::String)
    isfile(filename) || throw(SystemError("File not found: $(filename)"))
    data = JSON.parsefile(filename)

    declared_type = String(get(data, "data_type", "Float64"))
    if lowercase(declared_type) != "float64"
        throw(ArgumentError(
            "CapacityAnalysisKit currently supports Float64 capacities only. " *
            "Received data_type=$(declared_type)."
        ))
    end

    if haskey(data, "capacities")
        return _parse_legacy_capacity_json(data)
    elseif haskey(data, "edges")
        return _parse_toolkit_capacity_json(data)
    else
        throw(ArgumentError("Unsupported capacity JSON schema. Expected either legacy 'capacities' object or toolkit 'edges' array."))
    end
end

function _sorted_pairs(d::Dict{Int64,Float64})
    return sort!(collect(d); by=x -> x[1])
end

function _sorted_edge_pairs(d::Dict{Tuple{Int64,Int64},Float64})
    return sort!(collect(d); by=x -> x[1])
end

function _serialize_cut(cut)
    return Dict(
        "S" => sort!(collect(cut.S)),
        "T" => sort!(collect(cut.T)),
        "crossing_edges" => [[e[1], e[2]] for e in sort!(collect(cut.crossing_edges))],
        "capacity" => cut.capacity,
    )
end

function serialize_capacity_result(result::CapacityAnalysisKitResult)
    flow = result.flow
    sensitivity = result.sensitivity
    failure = result.failure_impact
    structure = result.structure
    decomp = result.flow_decomposition
    thresholds = result.parametric_thresholds
    mincuts = result.min_cut_analysis
    connectivity = result.global_connectivity

    response = Dict{String,Any}(
        "metadata" => Dict(
            "algorithm" => String(result.algorithm),
            "tol" => result.tol,
            "baseline_max_flow" => result.baseline_max_flow,
        ),
        "flow" => Dict(
            "max_flow" => flow.max_flow,
            "is_unbounded" => flow.is_unbounded,
            "mincut_capacity" => flow.mincut_capacity,
            "sink_flow" => [[k, v] for (k, v) in _sorted_pairs(flow.sink_flow)],
            "saturated_edges" => [[e[1], e[2]] for e in sort!(collect(flow.saturated_edges))],
            "mincut_S" => sort!(collect(flow.mincut_S)),
            "mincut_T" => sort!(collect(flow.mincut_T)),
        ),
        "sensitivity" => Dict(
            "critical_edges" => [Dict("edge" => [r.edge[1], r.edge[2]], "drop" => r.drop, "baseline_flow" => r.baseline_flow, "perturbed_flow" => r.perturbed_flow) for r in sensitivity.critical_edges],
            "marginal_capacity" => [Dict("edge" => [e[1], e[2]], "value" => v) for (e, v) in _sorted_edge_pairs(sensitivity.marginal_capacity)],
            "birnbaum" => [Dict("edge" => [e[1], e[2]], "value" => v) for (e, v) in _sorted_edge_pairs(sensitivity.birnbaum)],
        ),
        "failure_impact" => Dict(
            "min_cut_edges" => [[e[1], e[2]] for e in sort!(collect(failure.min_cut_edges))],
            "single_edge_failures" => [Dict("edge" => [r.edge[1], r.edge[2]], "drop" => r.drop, "perturbed_flow" => r.perturbed_flow, "is_critical" => r.is_critical, "is_unbounded" => r.is_unbounded) for r in failure.single_edge_failures],
            "k_edge_failures" => [Dict("edges" => [[e[1], e[2]] for e in r.edges], "drop" => r.drop, "perturbed_flow" => r.perturbed_flow, "is_unbounded" => r.is_unbounded) for r in failure.k_edge_failures],
            "degradation_results" => [Dict("scenario_id" => r.scenario_id, "max_flow" => r.max_flow, "drop_from_baseline" => r.drop_from_baseline, "sink_flow" => [[k, v] for (k, v) in _sorted_pairs(r.sink_flow)], "is_unbounded" => r.is_unbounded) for r in failure.degradation_results],
        ),
        "structure" => Dict(
            "spof_edges" => [[e[1], e[2]] for e in sort!(collect(structure.spof_edges))],
            "spof_nodes" => sort!(collect(structure.spof_nodes)),
            "paths_count" => length(structure.paths),
            "paths" => structure.paths,
            "edge_redundancy" => [Dict("edge" => [e[1], e[2]], "score" => score) for (e, score) in sort!(collect(structure.edge_redundancy); by=x -> x[1])],
            "bottleneck_ranking" => [Dict("edge" => [r.edge[1], r.edge[2]], "rank" => r.rank, "flow" => r.flow, "capacity" => r.capacity, "residual_capacity" => r.residual_capacity) for r in structure.bottleneck_ranking],
            "node_positions" => Dict(string(node) => String(pos) for (node, pos) in structure.node_positions),
        ),
        "flow_decomposition" => Dict(
            "total_flow" => decomp.total_flow,
            "is_unique" => decomp.is_unique,
            "components" => [Dict("path" => c.path, "flow_value" => c.flow_value, "bottleneck_edge" => [c.bottleneck_edge[1], c.bottleneck_edge[2]]) for c in decomp.components],
        ),
        "parametric_thresholds" => Dict(
            "baseline_flow" => thresholds.baseline_flow,
            "target_flow" => thresholds.target_flow,
            "degradation_thresholds" => [Dict("target_edge" => [d.target_edge[1], d.target_edge[2]], "original_capacity" => d.original_capacity, "threshold_capacity" => d.threshold_capacity, "degradation_margin" => d.degradation_margin, "target_achievable" => d.target_achievable, "target_reachable_at_zero" => d.target_reachable_at_zero, "solver_calls" => d.solver_calls) for d in thresholds.degradation_thresholds],
        ),
        "min_cut_analysis" => Dict(
            "max_flow" => mincuts.max_flow,
            "min_cut_capacity" => mincuts.min_cut_capacity,
            "representative_cut" => _serialize_cut(mincuts.representative_cut),
            "edges_in_some_cut" => [[e[1], e[2]] for e in sort!(collect(mincuts.edges_in_some_cut))],
            "edges_in_every_cut" => [[e[1], e[2]] for e in sort!(collect(mincuts.edges_in_every_cut))],
            "enumeration" => Dict(
                "total_cuts" => mincuts.enumeration.total_cuts,
                "is_complete" => mincuts.enumeration.is_complete,
                "free_zone_size" => mincuts.enumeration.free_zone_size,
                "cuts" => [_serialize_cut(cut) for cut in mincuts.enumeration.cuts],
            ),
        ),
        "global_connectivity" => Dict(
            "edge_connectivity" => Dict(
                "lambda" => connectivity.edge_connectivity.lambda,
                "achieving_source" => connectivity.edge_connectivity.achieving_source,
                "achieving_sink" => connectivity.edge_connectivity.achieving_sink,
                "min_cut_edges" => [[e[1], e[2]] for e in sort!(collect(connectivity.edge_connectivity.min_cut_edges))],
                "solver_calls" => connectivity.edge_connectivity.solver_calls,
            ),
            "node_connectivity" => Dict(
                "kappa" => connectivity.node_connectivity.kappa,
                "achieving_source" => connectivity.node_connectivity.achieving_source,
                "achieving_sink" => connectivity.node_connectivity.achieving_sink,
                "min_cut_nodes" => sort!(collect(connectivity.node_connectivity.min_cut_nodes)),
                "solver_calls" => connectivity.node_connectivity.solver_calls,
            ),
            "global_min_cut" => Dict(
                "min_cut_capacity" => connectivity.global_min_cut.min_cut_capacity,
                "achieving_source" => connectivity.global_min_cut.achieving_source,
                "achieving_sink" => connectivity.global_min_cut.achieving_sink,
                "min_cut_edges" => [[e[1], e[2]] for e in sort!(collect(connectivity.global_min_cut.min_cut_edges))],
                "cut_S" => sort!(collect(connectivity.global_min_cut.cut_S)),
                "cut_T" => sort!(collect(connectivity.global_min_cut.cut_T)),
                "solver_calls" => connectivity.global_min_cut.solver_calls,
            ),
        ),
    )

    if result.node_capacitated === nothing
        response["node_capacitated"] = nothing
    else
        nc = result.node_capacitated
        response["node_capacitated"] = Dict(
            "max_flow" => nc.flow_result.max_flow,
            "sink_flow" => [[k, v] for (k, v) in _sorted_pairs(nc.flow_result.sink_flow)],
            "saturated_nodes" => sort!(collect(nc.flow_result.saturated_nodes)),
            "spof_nodes" => sort!(collect(nc.spof_nodes)),
        )
    end

    return response
end

function _validate_algorithm(raw)
    allowed = Set(["dinic", "edmonds_karp", "push_relabel"])
    algo = lowercase(String(raw))
    algo in allowed || throw(ArgumentError("Unsupported algorithm: $(raw). Allowed: dinic, edmonds_karp, push_relabel"))
    return Symbol(algo)
end

function handle_capacity_analysis(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, POST, OPTIONS")

    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        capacities_path = get(request_data, "capacitiesPath", "")
        analysis_options = get(request_data, "analysisOptions", Dict{String,Any}())

        if isempty(network_path) || isempty(capacities_path)
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "networkPath and capacitiesPath are required")))
        end

        resolved_edges_path = ServerCommon.resolve_edges_file_path(network_path, edges_file_path)
        is_valid, message = ServerCommon.validate_network_file(resolved_edges_path)
        if !is_valid
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Invalid network file: $(message)")))
        end

        full_capacities_path = ServerCommon.safe_joinpath(network_path, capacities_path)
        parsed_capacity = parse_capacity_input_file(full_capacities_path)

        edgelist, outgoing_index, incoming_index, source_nodes_set = read_graph_to_dict(resolved_edges_path)
        source_nodes = sort!(collect(source_nodes_set))
        all_nodes = sort!(collect(union(Set(first.(edgelist)), Set(last.(edgelist)))))
        default_sink_nodes = sort!([node for node in all_nodes if !haskey(outgoing_index, node) || isempty(outgoing_index[node])])

        sink_nodes = if !isempty(parsed_capacity.target_nodes)
            sort!(collect(parsed_capacity.target_nodes))
        else
            default_sink_nodes
        end

        if isempty(sink_nodes)
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "No sink nodes available. Provide target_nodes or use a DAG with terminal nodes.")))
        end

        algorithm = _validate_algorithm(get(analysis_options, "algorithm", "dinic"))
        tol = Float64(get(analysis_options, "tol", 1e-10))
        k_failure = Int(get(analysis_options, "kFailure", 2))
        cut_limit = Int(get(analysis_options, "cutLimit", 1000))
        path_limit = Int(get(analysis_options, "pathLimit", 10_000))
        combination_limit = Int(get(analysis_options, "combinationLimit", 10_000))
        max_depth = Int(get(analysis_options, "maxDepth", 64))
        target_flow_raw = get(analysis_options, "targetFlow", nothing)
        target_flow = target_flow_raw === nothing ? nothing : Float64(target_flow_raw)

        degradation_scenarios_raw = get(analysis_options, "degradationScenarios", nothing)
        degradation_scenarios = if degradation_scenarios_raw === nothing
            nothing
        else
            [Float64(x) for x in degradation_scenarios_raw]
        end

        include_node_caps = Bool(get(analysis_options, "includeNodeCapacities", true))
        node_caps = include_node_caps && !isempty(parsed_capacity.node_capacities) ? parsed_capacity.node_capacities : nothing

        started = time()
        analysis_result = analyze_all(
            edgelist,
            outgoing_index,
            incoming_index,
            parsed_capacity.edge_capacities,
            source_nodes,
            sink_nodes;
            node_capacities=node_caps,
            target_flow=target_flow,
            k_failure=k_failure,
            degradation_scenarios=degradation_scenarios,
            cut_limit=cut_limit,
            path_limit=path_limit,
            combination_limit=combination_limit,
            algorithm=algorithm,
            tol=tol,
            max_depth=max_depth,
        )
        elapsed = time() - started

        response = Dict(
            "success" => true,
            "message" => "Flow analysis completed with CapacityAnalysisKit",
            "endpoint" => "flow-analysis",
            "timestamp" => Dates.now(),
            "input" => Dict(
                "edges_file_path" => resolved_edges_path,
                "capacities_path" => full_capacities_path,
                "capacity_schema" => parsed_capacity.schema,
                "source_nodes" => source_nodes,
                "sink_nodes" => sink_nodes,
                "target_nodes_from_file" => parsed_capacity.target_nodes,
                "source_rates_from_file" => [[k, v] for (k, v) in sort!(collect(parsed_capacity.source_rates); by=x -> x[1])],
            ),
            "computation_time" => elapsed,
            "capacity_result" => serialize_capacity_result(analysis_result),
        )

        return HTTP.Response(200, headers, JSON.json(response))
    catch e
        return ServerCommon.error_response(req, e, "Capacity analysis failed"; headers=headers)
    end
end

function register!(router::HTTP.Router)
    HTTP.register!(router, "POST", "/flow-analysis", handle_capacity_analysis)
    HTTP.register!(router, "POST", "/capacity-analysis", handle_capacity_analysis)
end

end # module CapacityHandlers
