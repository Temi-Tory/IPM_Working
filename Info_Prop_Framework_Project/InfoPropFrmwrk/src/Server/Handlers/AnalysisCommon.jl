module AnalysisCommon

using ..ServerCommon
using ..InfoPropFramework
using Serialization
using SHA

export convert_values,
       serialize_root_diamonds,
       serialize_unique_diamonds,
       resolve_edges_path_or_error,
       default_node_priors,
       cache_payload,
       parse_time_value,
       parse_edge_key,
       parse_node_values,
       parse_edge_values,
       find_or_build_diamond

const DIAMOND_ANALYSIS_CACHE = Dict{String, Any}()
const DIAMOND_ANALYSIS_CACHE_LOCK = ReentrantLock()

function pbox_to_dict(pb::pbox)
    return Dict(
        "type" => "pbox",
        "mean_lower" => pb.ml,
        "mean_upper" => pb.mh,
        "var_lower" => pb.vl,
        "var_upper" => pb.vh,
        "shape" => string(pb.shape),
        "name" => pb.name,
        "bounded" => pb.bounded,
        "discretization_size" => pb.n,
        "bounds_summary" => Dict(
            "left_min" => length(pb.u) > 0 ? pb.u[1] : 0.0,
            "left_max" => length(pb.u) > 0 ? pb.u[end] : 0.0,
            "right_min" => length(pb.d) > 0 ? pb.d[1] : 0.0,
            "right_max" => length(pb.d) > 0 ? pb.d[end] : 0.0,
        ),
    )
end

function convert_values(obj)
    if isa(obj, pbox)
        return pbox_to_dict(obj)
    elseif isa(obj, Interval)
        return Dict("type" => "interval", "lower" => obj.lower, "upper" => obj.upper)
    elseif isa(obj, AbstractDict)
        return Dict(string(k) => convert_values(v) for (k, v) in obj)
    elseif isa(obj, AbstractVector)
        return [convert_values(item) for item in obj]
    end
    return obj
end

function serialize_root_diamonds(root_diamonds::Dict{Int64, DiamondsAtNode})
    out = Dict{String, Any}()
    for (join_node, data) in root_diamonds
        out[string(join_node)] = Dict(
            "join_node" => data.join_node,
            "diamond" => Dict(
                "conditioning_nodes" => sort!(collect(data.diamond.conditioning_nodes)),
                "relevant_nodes" => sort!(collect(data.diamond.relevant_nodes)),
                "edgelist" => [[e[1], e[2]] for e in sort!(collect(data.diamond.edgelist))],
                "edge_count" => length(data.diamond.edgelist),
                "node_count" => length(data.diamond.relevant_nodes),
            ),
            "non_diamond_parents" => sort!(collect(data.non_diamond_parents)),
        )
    end
    return out
end

function serialize_unique_diamonds(unique_diamonds)
    out = Dict{String, Any}()
    for (diamond_hash, data) in unique_diamonds
        sub_diamonds = Dict{String, Any}()
        for (join_node, sub_data) in data.sub_diamond_structures
            sub_diamonds[string(join_node)] = Dict(
                "join_node" => sub_data.join_node,
                "diamond" => Dict(
                    "conditioning_nodes" => sort!(collect(sub_data.diamond.conditioning_nodes)),
                    "relevant_nodes" => sort!(collect(sub_data.diamond.relevant_nodes)),
                    "edgelist" => [[e[1], e[2]] for e in sort!(collect(sub_data.diamond.edgelist))],
                    "edge_count" => length(sub_data.diamond.edgelist),
                    "node_count" => length(sub_data.diamond.relevant_nodes),
                ),
                "non_diamond_parents" => sort!(collect(sub_data.non_diamond_parents)),
            )
        end

        out[string(diamond_hash)] = Dict(
            "diamond_hash" => string(diamond_hash),
            "is_root_diamond" => data.is_rootDiamond,
            "sub_sources" => sort!(collect(data.sub_sources)),
            "sub_fork_nodes" => sort!(collect(data.sub_fork_nodes)),
            "sub_join_nodes" => sort!(collect(data.sub_join_nodes)),
            "sub_iteration_sets_count" => length(data.sub_iteration_sets),
            "sub_diamond_structures" => sub_diamonds,
            "diamond" => Dict(
                "conditioning_nodes" => sort!(collect(data.diamond.conditioning_nodes)),
                "relevant_nodes" => sort!(collect(data.diamond.relevant_nodes)),
                "edgelist" => [[e[1], e[2]] for e in sort!(collect(data.diamond.edgelist))],
                "edge_count" => length(data.diamond.edgelist),
                "node_count" => length(data.diamond.relevant_nodes),
            ),
        )
    end
    return out
end

function resolve_edges_path_or_error(
    network_path::String,
    edges_file_path::String;
    capacities_path::String="",
    linkprobs_path::String="",
    cpm_path::String="",
)
    resolved_edges_path = ServerCommon.resolve_edges_file_path(
        network_path,
        edges_file_path;
        capacities_path=capacities_path,
        linkprobs_path=linkprobs_path,
        cpm_path=cpm_path,
    )
    is_valid, message = ServerCommon.validate_network_file(resolved_edges_path)
    return resolved_edges_path, is_valid, message
end

function default_node_priors(all_nodes::Vector{Int64})
    return Dict{Int64, Float64}(node => 1.0 for node in all_nodes)
end

function cache_payload(cache)
    entries = Any[]
    for (k, v) in cache
        push!(entries, Dict(
            "cache_key" => Dict(
                "diamond_hash" => string(k.diamond_hash),
                "priors_hash" => string(k.priors_hash),
            ),
            "edgelist" => [[e[1], e[2]] for e in v.edgelist],
            "current_priors" => convert_values(v.current_priors),
            "state_beliefs" => convert_values(v.state_beliefs),
        ))
    end

    return Dict(
        "entry_count" => length(entries),
        "entries" => entries,
    )
end

function parse_time_value(raw, ::Type{Float64})
    return Float64(raw)
end

function parse_time_value(raw, ::Type{Interval})
    if isa(raw, AbstractDict)
        lower = Float64(raw["lower"])
        upper = Float64(raw["upper"])
        if lower <= upper
            return Interval(lower, upper)
        end
        return Interval(upper, lower)
    end

    value = Float64(raw)
    return Interval(value, value)
end

function parse_edge_key(raw::String)
    token = replace(replace(raw, "(" => ""), ")" => "")
    parts = split(token, ",")
    length(parts) == 2 || throw(ArgumentError("Invalid edge key format: $(raw)"))
    return (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
end

function parse_node_values(raw_dict::AbstractDict, ::Type{T}) where {T}
    parsed = Dict{Int64, T}()
    for (k, v) in raw_dict
        parsed[parse(Int64, String(k))] = parse_time_value(v, T)
    end
    return parsed
end

function parse_edge_values(raw_dict::AbstractDict, ::Type{T}) where {T}
    parsed = Dict{Tuple{Int64,Int64}, T}()
    for (k, v) in raw_dict
        parsed[parse_edge_key(String(k))] = parse_time_value(v, T)
    end
    return parsed
end

function _mtime_token(path::String)
    if isempty(path)
        return "none"
    end
    if isfile(path)
        return string(stat(path).mtime)
    end
    return "missing"
end

function _diamond_cache_key(resolved_edges_path::String, nodepriors_full_path::String)
    return join([
        "edges=$(ServerCommon.normalize_path_separators(resolved_edges_path))",
        "edges_mtime=$(_mtime_token(resolved_edges_path))",
        "nodepriors=$(ServerCommon.normalize_path_separators(nodepriors_full_path))",
        "nodepriors_mtime=$(_mtime_token(nodepriors_full_path))",
    ], "|")
end

function _session_upload_id_from_network_path(network_path::String)
    normalized = ServerCommon.normalize_path_separators(network_path)
    segments = filter(!isempty, split(normalized, '/'))

    for idx in 1:(length(segments) - 1)
        if lowercase(segments[idx]) == lowercase(ServerCommon.UPLOAD_DIR)
            return segments[idx + 1]
        end
    end

    return nothing
end

function _diamond_persist_path(network_path::String, cache_key::String)
    upload_id = _session_upload_id_from_network_path(network_path)
    upload_id === nothing && return nothing

    session_dir = joinpath(ServerCommon.UPLOAD_DIR, String(upload_id))
    isdir(session_dir) || return nothing

    persist_dir = joinpath(session_dir, "diamond_cache")
    mkpath(persist_dir)
    key_hash = bytes2hex(sha1(cache_key))
    return joinpath(persist_dir, "$(key_hash).bin")
end

function _persist_diamond_payload(path::String, payload)
    try
        open(path, "w") do io
            serialize(io, payload)
        end
    catch e
        println(stderr, "[diamond-cache] failed to persist payload at $(path): $(e)")
    end
end

function _load_persisted_diamond_payload(path::String)
    isfile(path) || return nothing

    try
        return open(path, "r") do io
            deserialize(io)
        end
    catch e
        println(stderr, "[diamond-cache] failed to load payload from $(path): $(e)")
        return nothing
    end
end

function find_or_build_diamond(
    network_path::String,
    edges_file_path::String,
    nodepriors_path::String;
    linkprobs_path::String="",
    capacities_path::String="",
    cpm_path::String="",
)
    resolved_edges_path, is_valid, message = resolve_edges_path_or_error(
        network_path,
        edges_file_path;
        linkprobs_path=linkprobs_path,
        capacities_path=capacities_path,
        cpm_path=cpm_path,
    )
    is_valid || throw(ArgumentError("Invalid network file: $(message)"))

    full_nodepriors_path = isempty(nodepriors_path) ? "" : ServerCommon.resolve_network_file_path(network_path, nodepriors_path)
    cache_key = _diamond_cache_key(resolved_edges_path, full_nodepriors_path)
    persist_path = _diamond_persist_path(network_path, cache_key)

    lock(DIAMOND_ANALYSIS_CACHE_LOCK) do
        if haskey(DIAMOND_ANALYSIS_CACHE, cache_key)
            cached = DIAMOND_ANALYSIS_CACHE[cache_key]
            return merge(cached, (cache_hit=true, cache_source="memory"))
        end
    end

    if persist_path !== nothing
        persisted_payload = _load_persisted_diamond_payload(persist_path)
        if persisted_payload !== nothing
            normalized_payload = merge(persisted_payload, (cache_hit=false, cache_source="session_persisted"))
            lock(DIAMOND_ANALYSIS_CACHE_LOCK) do
                DIAMOND_ANALYSIS_CACHE[cache_key] = normalized_payload
            end
            return merge(normalized_payload, (cache_hit=true, cache_source="session_persisted"))
        end
    end

    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(resolved_edges_path)
    all_nodes = sort!(collect(union(Set(first.(edgelist)), Set(last.(edgelist)))))
    sink_nodes = sort!([n for n in all_nodes if !haskey(outgoing_index, n) || isempty(outgoing_index[n])])
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

    node_priors = if isempty(nodepriors_path)
        default_node_priors(all_nodes)
    else
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

    payload = (
        resolved_edges_path=resolved_edges_path,
        edgelist=edgelist,
        outgoing_index=outgoing_index,
        incoming_index=incoming_index,
        source_nodes=source_nodes,
        sink_nodes=sink_nodes,
        all_nodes=all_nodes,
        fork_nodes=fork_nodes,
        join_nodes=join_nodes,
        iteration_sets=iteration_sets,
        ancestors=ancestors,
        descendants=descendants,
        node_priors=node_priors,
        root_diamonds=root_diamonds,
        unique_diamonds=unique_diamonds,
        computation_time=time() - started,
        cache_key=cache_key,
        cache_hit=false,
        cache_source="computed",
    )

    lock(DIAMOND_ANALYSIS_CACHE_LOCK) do
        DIAMOND_ANALYSIS_CACHE[cache_key] = payload
    end

    if persist_path !== nothing
        _persist_diamond_payload(persist_path, payload)
    end

    return payload
end

end # module AnalysisCommon
