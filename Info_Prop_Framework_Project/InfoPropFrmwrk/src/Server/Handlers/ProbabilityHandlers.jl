module ProbabilityHandlers

using HTTP
using JSON
using Dates
using ..ServerCommon
using ..InfoPropFramework
using ..AnalysisCommon

function probability_payload(request_data::AbstractDict)
    network_path = get(request_data, "networkPath", "")
    edges_file_path = get(request_data, "edgesFilePath", "")
    nodepriors_path = get(request_data, "nodepriorsPath", "")
    linkprobs_path = get(request_data, "linkprobsPath", "")
    include_exact_inference = Bool(get(request_data, "includeExactInference", true))
    include_diamond_analysis = Bool(get(request_data, "includeDiamondAnalysis", false))

    isempty(network_path) && throw(ArgumentError("Network path required"))
    isempty(nodepriors_path) && throw(ArgumentError("nodepriorsPath required"))
    isempty(linkprobs_path) && throw(ArgumentError("linkprobsPath required"))

    diamond_payload = find_or_build_diamond(
        network_path,
        edges_file_path,
        nodepriors_path;
        linkprobs_path=linkprobs_path,
    )
    resolved_edges_path = diamond_payload.resolved_edges_path

    full_linkprobs_path = ServerCommon.resolve_network_file_path(network_path, linkprobs_path)
    isfile(full_linkprobs_path) || throw(ArgumentError("linkprobs file not found: $(full_linkprobs_path)"))

    edgelist = diamond_payload.edgelist
    outgoing_index = diamond_payload.outgoing_index
    incoming_index = diamond_payload.incoming_index
    source_nodes = diamond_payload.source_nodes
    sink_nodes = diamond_payload.sink_nodes
    fork_nodes = diamond_payload.fork_nodes
    join_nodes = diamond_payload.join_nodes
    iteration_sets = diamond_payload.iteration_sets
    ancestors = diamond_payload.ancestors
    descendants = diamond_payload.descendants
    node_priors = diamond_payload.node_priors
    link_probabilities = read_edge_probabilities_from_json(full_linkprobs_path)
    root_diamonds = diamond_payload.root_diamonds
    unique_diamonds = diamond_payload.unique_diamonds

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
        "diamond_cache_hit" => diamond_payload.cache_hit,
        "diamond_cache_status" => diamond_payload.cache_hit ? "used" : "created",
        "diamond_cache_source" => String(diamond_payload.cache_source),
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
            "diamond_cache_hit" => payload["diamond_cache_hit"],
            "diamond_cache_status" => payload["diamond_cache_status"],
            "diamond_cache_source" => payload["diamond_cache_source"],
            "probability_result" => payload["result"],
        )))
    catch e
        return ServerCommon.error_response(req, e, "Probability propagation analysis failed"; headers=headers)
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
