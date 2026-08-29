module AnalysisCommon

using ..ServerCommon
using ..InfoPropFramework
using Serialization
using SHA

# CriticalPathV2 members are reached through the submodule (not re-exported by
# InfoPropFramework — see its export list note).
const CPV2 = InfoPropFramework.CriticalPathV2Module

export convert_values,
       serialize_root_diamonds,
       serialize_unique_diamonds,
       serialize_diamonds_at_node,
       resolve_edges_path_or_error,
       default_node_priors,
       cache_payload,
       parse_time_value,
       parse_edge_key,
       parse_node_values,
       parse_edge_values,
       find_or_build_diamond,
       resolve_cpm_mode,
       run_cpm_v2,
       cpm_v2_mode_name

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

"""
    serialize_diamonds_at_node(data::DiamondsAtNode) -> Dict

Serialise one conditioning group at a join. `new_identify` can emit SEVERAL of these per
join (one per independent parent group), so callers wrap the results in an array keyed by
join node — see `serialize_root_diamonds` / `serialize_unique_diamonds`.
"""
function serialize_diamonds_at_node(data::DiamondsAtNode)
    return Dict(
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

# root_diamonds is Dict{Int64, Vector{DiamondsAtNode}} (array-per-join). Each join maps to a
# JSON array of conditioning-group objects; a plain (non-factorised) join is a 1-element array.
function serialize_root_diamonds(root_diamonds::Dict{Int64, Vector{DiamondsAtNode}})
    out = Dict{String, Any}()
    for (join_node, groups) in root_diamonds
        out[string(join_node)] = Any[serialize_diamonds_at_node(g) for g in groups]
    end
    return out
end

function serialize_unique_diamonds(unique_diamonds)
    out = Dict{String, Any}()
    for (diamond_hash, data) in unique_diamonds
        # sub_diamond_structures is Dict{Int64, Vector{DiamondsAtNode}} (array-per-inner-join)
        sub_diamonds = Dict{String, Any}()
        for (join_node, groups) in data.sub_diamond_structures
            sub_diamonds[string(join_node)] = Any[serialize_diamonds_at_node(g) for g in groups]
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

# ============================================================================
# CriticalPathV2 wiring (mode-based rebuild — the validated schedule/cost toolkit)
#
# V2 is mode-based: LongestPath (max/+), ShortestPath (min/+), MaxScaling (max/x),
# Accumulation (sum/+). Value types are Float64 and Interval only (NO probability-box
# for schedule). Interval is a computation SCHEME, not an operator overload:
#   - forward quantities: exact corner-pair bounds
#   - margins/criticality: exact via domination split / corner enumeration where
#     tractable (method :exact_domination_split / :exact_corners_exhaustive), else a
#     sound conservative enclosure (method :conservative_enclosure).
# The classical schedule quantities (early_start / late_finish / late_start) are
# populated for additive Float64 modes only; the interval scheme does not compute them.
# ============================================================================

cpm_v2_mode_name(m::CPV2.AnalysisMode) = String(m.name)
cpm_v2_mode_name(m::Symbol) = String(m)

"""
    resolve_cpm_mode(cpm_section, explicit_mode) -> AnalysisMode | :accumulation

Pick the V2 analysis mode. An explicit request-body `mode` wins; otherwise the mode is
derived from the CPM input file's own declared `combination_function` /
`propagation_function` (contract-carried), defaulting to LongestPath (classical CPM).
"""
function resolve_cpm_mode(cpm_section::AbstractDict, explicit_mode)
    if explicit_mode !== nothing && !isempty(strip(String(explicit_mode)))
        key = lowercase(strip(String(explicit_mode)))
        key in ("longest_path", "longest", "cpm", "longest_path_time") && return CPV2.LONGEST_PATH
        key in ("shortest_path", "shortest") && return CPV2.SHORTEST_PATH
        key in ("max_scaling", "scaling") && return CPV2.MAX_SCALING
        key in ("accumulation", "sum", "load", "total_project_cost") && return :accumulation
        throw(ArgumentError("unknown CPM mode: $(explicit_mode)"))
    end
    comb = lowercase(String(get(cpm_section, "combination_function", "max_combination")))
    prop = lowercase(String(get(cpm_section, "propagation_function", "additive_propagation")))
    comb == "min_combination" && return CPV2.SHORTEST_PATH
    comb == "sum_combination" && return :accumulation
    (comb == "max_combination" && occursin("multiplicative", prop)) && return CPV2.MAX_SCALING
    return CPV2.LONGEST_PATH
end

_v2_to_interval(v::AbstractDict) = begin
    lo = Float64(v["lower"]); hi = Float64(v["upper"])
    CPV2.ValueInterval(min(lo, hi), max(lo, hi))
end
_v2_to_interval(v) = (x = Float64(v); CPV2.ValueInterval(x, x))

function _v2_node_values(raw::AbstractDict, value_type::Symbol, restrict)
    if value_type == :interval
        d = Dict{Int64, CPV2.ValueInterval}()
        for (k, v) in raw
            n = parse(Int64, String(k))
            (restrict === nothing || n in restrict) || continue
            d[n] = _v2_to_interval(v)
        end
        return d
    end
    d = Dict{Int64, Float64}()
    for (k, v) in raw
        n = parse(Int64, String(k))
        (restrict === nothing || n in restrict) || continue
        d[n] = Float64(v)
    end
    return d
end

function _v2_edge_values(raw::AbstractDict, value_type::Symbol, restrict)
    if value_type == :interval
        d = Dict{Tuple{Int64,Int64}, CPV2.ValueInterval}()
        for (k, v) in raw
            e = parse_edge_key(String(k))
            (restrict === nothing || e in restrict) || continue
            d[e] = _v2_to_interval(v)
        end
        return d
    end
    d = Dict{Tuple{Int64,Int64}, Float64}()
    for (k, v) in raw
        e = parse_edge_key(String(k))
        (restrict === nothing || e in restrict) || continue
        d[e] = Float64(v)
    end
    return d
end

_v2_iv(x::CPV2.ValueInterval) = Dict("type" => "interval", "lower" => x.lo, "upper" => x.hi)

function _serialize_pathresult_v2(r::CPV2.PathResult)
    critical_set = Set(r.critical)
    d = Dict{String, Any}(
        "kind" => "path",
        "mode" => String(r.mode),
        "method" => String(r.method),
        "margin_name" => String(r.margin_name),
        "value_type" => "Float64",
        "project_value" => r.project_value,
        "forward" => Dict(string(k) => v for (k, v) in r.forward),
        "reverse_completion" => Dict(string(k) => v for (k, v) in r.reverse_completion),
        "through" => Dict(string(k) => v for (k, v) in r.through),
        "margin" => Dict(string(k) => v for (k, v) in r.margin),
        "critical" => r.critical,
        "schedule_available" => !isempty(r.early_start),
    )
    if !isempty(r.early_start)
        d["early_start"] = Dict(string(k) => v for (k, v) in r.early_start)
        d["late_finish"] = Dict(string(k) => v for (k, v) in r.late_finish)
        d["late_start"] = Dict(string(k) => v for (k, v) in r.late_start)
        thr = r.project_value * 0.1
        d["near_critical_nodes"] = sort!([k for (k, v) in r.margin
                                          if !(k in critical_set) && v > 0 && v < thr])
    end
    return d
end

function _serialize_interval_pathresult_v2(r::CPV2.IntervalPathResult, method_note::String)
    return Dict{String, Any}(
        "kind" => "path",
        "mode" => String(r.mode),
        "method" => String(r.method),
        "method_note" => method_note,
        "margin_name" => String(r.margin_name),
        "value_type" => "Interval",
        "project_value" => _v2_iv(r.project_value),
        "forward" => Dict(string(k) => _v2_iv(v) for (k, v) in r.forward),
        "through" => Dict(string(k) => _v2_iv(v) for (k, v) in r.through),
        "margin" => Dict(string(k) => _v2_iv(v) for (k, v) in r.margin),
        "necessarily_critical" => r.necessarily_critical,
        "possibly_critical" => r.possibly_critical,
        "corner_count" => r.corner_count,
        "schedule_available" => false,
    )
end

function _serialize_accumulation_v2(r::CPV2.AccumulationResult)
    d = Dict{String, Any}(
        "kind" => "accumulation",
        "mode" => String(r.mode),
        "method" => String(r.method),
        "margin_name" => "allowance",
        "value_type" => "Float64",
        "forward" => Dict(string(k) => v for (k, v) in r.forward),
        "target" => r.target,
        "total" => r.total,
        "multiplicity" => Dict(string(k) => v for (k, v) in r.multiplicity),
        "sensitivity" => Dict(string(k) => v for (k, v) in r.sensitivity),
        "contribution" => Dict(string(k) => v for (k, v) in r.contribution),
        "ranking" => r.ranking,
    )
    isempty(r.allowance) || (d["allowance"] = Dict(string(k) => v for (k, v) in r.allowance))
    return d
end

# Pick the tightest interval scheme that is affordable, always with tier-1 as the floor.
# kvar (count of non-degenerate inputs) gates the exact drivers: interval_analyze_exact's
# internal 2^k corner cap overflows Int64 for kvar >= 64, so the exhaustive route is gated
# here rather than trusted to self-refuse.
function _interval_path_result(iteration_sets, outgoing_index, incoming_index, source_nodes,
                               nv, ev, mode; atol::Float64)
    kvar = count(!CPV2.is_degenerate, values(nv)) + count(!CPV2.is_degenerate, values(ev))

    # exact via the domination split (LONGEST_PATH, crisp edges only). It auto-falls back
    # to the shared exhaustive sweep when that is cheaper and throws when both blow up.
    if mode === CPV2.LONGEST_PATH && kvar <= 60
        try
            return CPV2.interval_analyze_split(iteration_sets, outgoing_index, incoming_index,
                                               source_nodes, nv, ev; mode=mode, atol=atol,
                                               max_runs=2_000_000), ""
        catch e
            e isa ArgumentError || rethrow()
        end
    end

    # exact via full corner enumeration — only when the corner count is genuinely small.
    if 0 < kvar <= 18
        try
            return CPV2.interval_analyze_exact(iteration_sets, outgoing_index, incoming_index,
                                               source_nodes, nv, ev; mode=mode, atol=atol,
                                               max_corners=(1 << 20)), ""
        catch e
            e isa ArgumentError || rethrow()
        end
    end

    note = kvar == 0 ? "" :
        "exact interval floats are intractable for this instance ($(kvar) interval inputs with reconvergence — NP-hard in general); returning a sound conservative enclosure"
    return CPV2.interval_analyze(iteration_sets, outgoing_index, incoming_index, source_nodes,
                                 nv, ev; mode=mode, atol=atol), note
end

"""
    run_cpm_v2(iteration_sets, outgoing_index, incoming_index, source_nodes,
               raw_node_values, raw_edge_values; value_type, mode, initial,
               restrict_nodes, restrict_edges, atol) -> Dict

Run one CriticalPathV2 pass and return a JSON-ready result Dict. `value_type` is
`:float64` or `:interval`; `mode` is an `AnalysisMode` or `:accumulation`. `raw_*` are the
CPM input file's own `node_durations`/`edge_delays` (or cost) maps, string-keyed. The
`restrict_*` sets, when given, keep only entries inside a diamond subgraph.
"""
function run_cpm_v2(iteration_sets, outgoing_index, incoming_index, source_nodes,
                    raw_node_values::AbstractDict, raw_edge_values::AbstractDict;
                    value_type::Symbol, mode, initial=0.0,
                    restrict_nodes=nothing, restrict_edges=nothing,
                    atol::Float64=1e-6)
    nv = _v2_node_values(raw_node_values, value_type, restrict_nodes)
    ev = _v2_edge_values(raw_edge_values, value_type, restrict_edges)

    if value_type == :float64
        if mode === :accumulation
            res = CPV2.accumulation_analysis(iteration_sets, outgoing_index, incoming_index,
                                        source_nodes, nv, ev; initial=Float64(initial))
            return _serialize_accumulation_v2(res)
        end
        res = CPV2.analyze(iteration_sets, outgoing_index, incoming_index,
                                           source_nodes, nv, ev;
                                           mode=mode, initial=Float64(initial), atol=atol)
        return _serialize_pathresult_v2(res)
    elseif value_type == :interval
        mode === :accumulation &&
            throw(ArgumentError("CriticalPathV2 has no interval Accumulation scheme; use Float64 for accumulation or a path mode for interval"))
        res, note = _interval_path_result(iteration_sets, outgoing_index, incoming_index,
                                          source_nodes, nv, ev, mode; atol=atol)
        return _serialize_interval_pathresult_v2(res, note)
    else
        throw(ArgumentError("unsupported CPM value_type: $(value_type) (expected :float64 or :interval)"))
    end
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
    # new_identify is the module's current correct-by-construction producer. It emits BOTH
    # objects update_beliefs_iterative consumes, in the array-per-join factorised shape:
    #   root_diamonds   :: Dict{Int64, Vector{DiamondsAtNode}}
    #   unique_diamonds :: Dict{UInt64, DiamondComputationData{T}}
    # (replaces the retired identify_and_group_diamonds +
    #  build_unique_diamond_storage_depth_first_parallel from the unloaded Pipeline*.jl files).
    # link_probs is accepted for signature symmetry only and is unused by identification.
    empty_link_probs = Dict{Tuple{Int64,Int64}, valtype(node_priors)}()
    root_diamonds, unique_diamonds = new_identify(
        edgelist,
        node_priors,
        empty_link_probs,
        source_nodes,
        fork_nodes,
        join_nodes,
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
