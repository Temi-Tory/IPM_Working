module ProbabilityHandlers

using HTTP
using JSON
using Dates
using ..ServerCommon
using ..InfoPropFramework
using ..AnalysisCommon

function probability_payload(request_data::Dict{String, Any})
    network_path = get(request_data, "networkPath", "")
    edges_file_path = get(request_data, "edgesFilePath", "")
    nodepriors_path = get(request_data, "nodepriorsPath", "")
    linkprobs_path = get(request_data, "linkprobsPath", "")
    include_exact_inference = Bool(get(request_data, "includeExactInference", true))
    include_diamond_analysis = Bool(get(request_data, "includeDiamondAnalysis", false))

    isempty(network_path) && throw(ArgumentError("Network path required"))
    isempty(nodepriors_path) && throw(ArgumentError("nodepriorsPath required"))
    isempty(linkprobs_path) && throw(ArgumentError("linkprobsPath required"))

    resolved_edges_path, is_valid, message = resolve_edges_path_or_error(network_path, edges_file_path)
    is_valid || throw(ArgumentError("Invalid network file: $(message)"))

    full_nodepriors_path = ServerCommon.safe_joinpath(network_path, nodepriors_path)
    full_linkprobs_path = ServerCommon.safe_joinpath(network_path, linkprobs_path)
    isfile(full_nodepriors_path) || throw(ArgumentError("nodepriors file not found: $(full_nodepriors_path)"))
    isfile(full_linkprobs_path) || throw(ArgumentError("linkprobs file not found: $(full_linkprobs_path)"))

    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(resolved_edges_path)
    all_nodes = sort!(collect(union(Set(first.(edgelist)), Set(last.(edgelist)))))
    sink_nodes = sort!([n for n in all_nodes if !haskey(outgoing_index, n) || isempty(outgoing_index[n])])
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

    node_priors = read_node_priors_from_json(full_nodepriors_path)
    link_probabilities = read_edge_probabilities_from_json(full_linkprobs_path)

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

    result_data = Dict{String, Any}()

    if include_diamond_analysis
        result_data["diamond_analysis"] = Dict(
            "root_diamonds_count" => length(root_diamonds),
            "unique_diamonds_count" => length(unique_diamonds),
            "join_nodes_with_diamonds" => sort!(collect(keys(root_diamonds))),
            "raw_root_diamonds" => serialize_root_diamonds(root_diamonds),
            "raw_unique_diamonds" => serialize_unique_diamonds(unique_diamonds),
        )
    end

    if include_exact_inference
        prior_type = typeof(first(values(node_priors)))
        cache = Dict{CacheKey, DiamondCacheEntry{prior_type}}()

        started = time()
        beliefs = update_beliefs_iterative(
            edgelist,
            iteration_sets,
            outgoing_index,
            incoming_index,
            source_nodes,
            node_priors,
            link_probabilities,
            descendants,
            ancestors,
            root_diamonds,
            join_nodes,
            fork_nodes,
            unique_diamonds,
            cache,
        )
        elapsed = time() - started

        numeric_beliefs = Float64[]
        for value in values(beliefs)
            if isa(value, Float64)
                push!(numeric_beliefs, value)
            elseif isa(value, Interval)
                push!(numeric_beliefs, (value.lower + value.upper) / 2.0)
            elseif isa(value, pbox)
                push!(numeric_beliefs, (value.ml + value.mh) / 2.0)
            elseif isa(value, Real)
                push!(numeric_beliefs, Float64(value))
            end
        end

        result_data["exact_inference"] = Dict(
            "beliefs" => convert_values(Dict(string(k) => v for (k, v) in beliefs)),
            "node_priors" => convert_values(Dict(string(k) => v for (k, v) in node_priors)),
            "computation_time" => elapsed,
            "total_nodes_processed" => length(beliefs),
            "belief_statistics" => Dict(
                "mean" => isempty(numeric_beliefs) ? 0.0 : sum(numeric_beliefs) / length(numeric_beliefs),
                "min" => isempty(numeric_beliefs) ? 0.0 : minimum(numeric_beliefs),
                "max" => isempty(numeric_beliefs) ? 0.0 : maximum(numeric_beliefs),
                "numeric_count" => length(numeric_beliefs),
                "total_count" => length(beliefs),
            ),
            "cache" => cache_payload(cache),
        )
    end

    return Dict(
        "network_path" => network_path,
        "edges_file_path" => resolved_edges_path,
        "nodepriors_path" => nodepriors_path,
        "linkprobs_path" => linkprobs_path,
        "source_nodes" => sort!(collect(source_nodes)),
        "sink_nodes" => sink_nodes,
        "result" => convert_values(result_data),
    )
end

function handle_probability_like(req::HTTP.Request; endpoint_name::String)
    headers = ServerCommon.cors_headers_json(; methods="GET, POST, OPTIONS")

    try
        request_data = JSON.parse(String(req.body))
        payload = probability_payload(request_data)

        return HTTP.Response(200, headers, JSON.json(Dict(
            "success" => true,
            "message" => "Probability propagation analysis completed",
            "endpoint" => endpoint_name,
            "timestamp" => Dates.now(),
            "network_path" => payload["network_path"],
            "edges_file_path" => payload["edges_file_path"],
            "nodepriors_path" => payload["nodepriors_path"],
            "linkprobs_path" => payload["linkprobs_path"],
            "source_nodes" => payload["source_nodes"],
            "sink_nodes" => payload["sink_nodes"],
            "probability_result" => payload["result"],
        )))
    catch e
        return HTTP.Response(500, headers, JSON.json(Dict("success" => false, "error" => string(e), "message" => "Probability propagation analysis failed")))
    end
end

function handle_probability_propagation(req::HTTP.Request)
    return handle_probability_like(req; endpoint_name="probability-propagation")
end

function handle_reachability_analysis(req::HTTP.Request)
    return handle_probability_like(req; endpoint_name="reachability-analysis")
end

function register!(router::HTTP.Router)
    HTTP.register!(router, "POST", "/probability-propagation", handle_probability_propagation)
    HTTP.register!(router, "POST", "/reachability-analysis", handle_reachability_analysis)
end

end # module ProbabilityHandlers
