module AnalysisCommon

using ..ServerCommon
using ..InfoPropFramework

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

function resolve_edges_path_or_error(network_path::String, edges_file_path::String)
    resolved_edges_path = ServerCommon.resolve_edges_file_path(network_path, edges_file_path)
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

function find_or_build_diamond(network_path::String, edges_file_path::String, nodepriors_path::String)
    resolved_edges_path, is_valid, message = resolve_edges_path_or_error(network_path, edges_file_path)
    is_valid || throw(ArgumentError("Invalid network file: $(message)"))

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

    return (
        resolved_edges_path=resolved_edges_path,
        unique_diamonds=unique_diamonds,
    )
end

end # module AnalysisCommon
