module ServerCommon

using HTTP
using JSON
using Dates
using UUIDs
using SHA

const UPLOAD_DIR = "temp_uploads"
const PORT = 8080

# Local-only by design (Front-End chapter: "client and server happen to share a
# machine, no traffic leaves the machine"). The server binds loopback and only
# accepts cross-origin requests from the local front end. Change this if the
# rebuilt FE is served from a different origin.
const CORS_ALLOW_ORIGIN = get(ENV, "INFOPROP_CORS_ORIGIN", "http://localhost:4200")

function cors_headers_json(; methods::String="GET, POST, PUT, DELETE, OPTIONS")
    return [
        "Access-Control-Allow-Origin" => CORS_ALLOW_ORIGIN,
        "Access-Control-Allow-Methods" => methods,
        "Access-Control-Allow-Headers" => "Content-Type, Authorization, X-Request-ID, X-Client-Request-ID",
        "Access-Control-Expose-Headers" => "X-Request-ID",
        "Content-Type" => "application/json",
    ]
end

"""
    sanitize_for_json(x)

Recursively replaces non-finite Float64 values (Inf, -Inf, NaN) with their string tokens
("Inf", "-Inf", "NaN"), matching the INPUT-side convention already used for unbounded capacities
(InputProcessingModule.jl accepts "Inf" as a capacity value). JSON has no representation for
Inf/NaN; JSON.json throws ArgumentError on them by default (correctly -- `allownan=true` would
produce non-standard JSON that a browser's JSON.parse cannot read, which would just move this
failure to the front end). Any analysis result that legitimately produces an unbounded or
undefined number (e.g. sensitivity/marginal-value output for an edge with unbounded capacity,
first exercised by an unbounded reservoir edge in the Net3 case study, 2026-08-30) needs this
applied before serialization, not a per-field fix at each call site.
"""
function sanitize_for_json(x::AbstractDict)
    return Dict(k => sanitize_for_json(v) for (k, v) in x)
end
function sanitize_for_json(x::AbstractVector)
    return [sanitize_for_json(v) for v in x]
end
function sanitize_for_json(x::AbstractFloat)
    isnan(x) && return "NaN"
    isinf(x) && return x > 0 ? "Inf" : "-Inf"
    return x
end
sanitize_for_json(x) = x

function json_response(status::Int, body)
    return HTTP.Response(status, cors_headers_json(), JSON.json(sanitize_for_json(body)))
end

function request_id(req::HTTP.Request)
    client_request_id = something(HTTP.header(req, "X-Client-Request-ID"), "")
    request_header_id = something(HTTP.header(req, "X-Request-ID"), "")
    selected_id = !isempty(client_request_id) ? client_request_id : request_header_id
    return isempty(selected_id) ? string(uuid4()) : String(selected_id)
end

function with_request_id_header(headers, request_id::AbstractString)
    response_headers = copy(headers)
    push!(response_headers, "X-Request-ID" => String(request_id))
    return response_headers
end

function exception_message(err)
    return sprint(io -> showerror(io, err))
end

function stacktrace_frames(bt; max_frames::Int=25)
    frames = stacktrace(bt)
    if isempty(frames)
        return Any[]
    end

    limit = min(length(frames), max_frames)
    return [
        Dict(
            "file" => String(frame.file),
            "line" => Int(frame.line),
            "func" => string(frame.func),
            "inlined" => Bool(frame.inlined),
            "from_c" => Bool(frame.from_c),
        )
        for frame in frames[1:limit]
    ]
end

function error_payload(req::HTTP.Request, err, message::AbstractString; status::Int=500, request_id::AbstractString=request_id(req), bt=catch_backtrace())
    return Dict(
        "success" => false,
        "message" => String(message),
        "error" => exception_message(err),
        "request_id" => String(request_id),
        "debug" => Dict(
            "request_id" => String(request_id),
            "timestamp" => string(Dates.now()),
            "status" => status,
            "method" => String(req.method),
            "target" => String(req.target),
            "exception_type" => string(typeof(err)),
            "exception_message" => exception_message(err),
            "stacktrace" => stacktrace_frames(bt),
        ),
    )
end

function error_response(req::HTTP.Request, err, message::AbstractString; status::Int=500, headers=cors_headers_json(), bt=catch_backtrace())
    req_id = request_id(req)
    println(stderr, "[$(req_id)] $(req.method) $(req.target) -> $(status) $(message)")
    showerror(stderr, err, bt)
    println(stderr)

    body = error_payload(req, err, message; status=status, request_id=req_id, bt=bt)
    return HTTP.Response(status, with_request_id_header(headers, req_id), JSON.json(body))
end

function normalize_path_separators(path::AbstractString)
    isempty(path) && return String(path)
    normalized = replace(path, "\\" => "/")
    normalized = replace(normalized, r"/+" => "/")
    if startswith(normalized, "/") && !startswith(normalized, "//")
        normalized = normalized[2:end]
    end
    return String(normalized)
end

# AbstractString, not String: split(...) returns SubString — a real path
# segment pulled from a request target (e.g. path_parts[3] in
# handle_file_request) is a SubString{String}, not a String, and the old
# strict ::String signature threw a MethodError on every such call.
function safe_joinpath(base_path::AbstractString, relative_path::AbstractString)
    normalized_base = normalize_path_separators(base_path)
    normalized_relative = normalize_path_separators(relative_path)
    return replace(joinpath(normalized_base, normalized_relative), "\\" => "/")
end

function _is_absolute_path(path::String)
    normalized = normalize_path_separators(path)
    isempty(normalized) && return false
    return occursin(r"^[A-Za-z]:/", normalized) || startswith(normalized, "//")
end

function _session_root_for_network_path(network_path::String)
    normalized = normalize_path_separators(network_path)
    segments = filter(!isempty, split(normalized, '/'))

    for idx in 1:(length(segments) - 1)
        if lowercase(segments[idx]) == lowercase(UPLOAD_DIR)
            return join(segments[1:idx+1], "/")
        end
    end

    return ""
end

function resolve_network_file_path(network_path::String, file_path::String)
    normalized_input = normalize_path_separators(file_path)
    isempty(normalized_input) && return ""

    if _is_absolute_path(normalized_input) || startswith(lowercase(normalized_input), lowercase(UPLOAD_DIR) * "/")
        return normalized_input
    end

    direct_candidate = safe_joinpath(network_path, normalized_input)
    if isfile(direct_candidate) || isdir(direct_candidate)
        return direct_candidate
    end

    session_root = _session_root_for_network_path(network_path)
    if !isempty(session_root)
        session_candidate = safe_joinpath(session_root, normalized_input)
        if isfile(session_candidate) || isdir(session_candidate)
            return session_candidate
        end
    end

    return direct_candidate
end

function setup_server()
    if !isdir(UPLOAD_DIR)
        mkdir(UPLOAD_DIR)
    end
    println("InfoProp modular server starting on port $(PORT)...")
    println("Upload directory: $(UPLOAD_DIR)")
end

function session_file_path(upload_id::AbstractString)
    return joinpath(UPLOAD_DIR, String(upload_id), "session.json")
end

function derive_network_name(uploaded_files::Vector{String}, edges_files::Vector{String}, network_path::String)
    if !isempty(edges_files)
        edges_name = basename(edges_files[1])
        return replace(edges_name, r"(?i)\.edges$" => "", count=1)
    end

    if !isempty(uploaded_files)
        first_name = basename(uploaded_files[1])
        stem = splitext(first_name)[1]
        return isempty(stem) ? first_name : stem
    end

    fallback = basename(network_path)
    return isempty(fallback) ? "Network Upload" : fallback
end

function read_session_metadata(upload_id::AbstractString)
    meta_path = session_file_path(upload_id)
    if !isfile(meta_path)
        return nothing
    end

    try
        return JSON.parsefile(meta_path)
    catch e
        println("Failed to parse session metadata for $(upload_id): $(e)")
        return nothing
    end
end

function write_session_metadata(upload_id::AbstractString, metadata::AbstractDict)
    meta_path = session_file_path(upload_id)
    open(meta_path, "w") do io
        write(io, JSON.json(metadata))
    end
end

function validate_network_file(edges_file_path::String)
    if !isfile(edges_file_path)
        return false, "Missing .EDGES file: $(edges_file_path)"
    end
    return true, "Valid .EDGES file"
end

function parse_multipart_data(body_str::AbstractString, boundary::AbstractString, upload_path::AbstractString)
    uploaded_files = String[]
    boundary_str = String(boundary)
    parts = split(String(body_str), "--" * boundary_str)

    for part in parts
        part = strip(part)
        if isempty(part) || part == "--"
            continue
        end

        header_end = findfirst("\r\n\r\n", part)
        if header_end === nothing
            header_end = findfirst("\n\n", part)
            header_end === nothing && continue
        end

        headers = part[1:header_end[1]-1]
        content = part[header_end[end]+1:end]

        filename_match = match(r"filename=\"([^\"]+)\"", headers)
        filename_match === nothing && continue

        filename = String(filename_match.captures[1])
        filename = normalize_path_separators(filename)
        filename = replace(filename, r"^[A-Za-z]:/+" => "")
        filename = replace(filename, r"^/+" => "")
        filename = replace(filename, ".." => "")
        isempty(strip(filename)) && continue

        isempty(strip(content)) && continue
        content = rstrip(content, ['\r', '\n', '-'])

        upload_path_str = String(upload_path)
        file_path = safe_joinpath(upload_path_str, filename)
        file_dir = dirname(file_path)
        if file_dir != upload_path_str
            mkpath(file_dir)
        end

        open(file_path, "w") do io
            write(io, content)
        end

        push!(uploaded_files, filename)
    end

    return uploaded_files
end

function resolve_edges_file_path(network_path::String, edges_file_path::String)
    return resolve_edges_file_path(network_path, edges_file_path; capacities_path="", linkprobs_path="", cpm_path="")
end

function _parse_edge_tuple_key(raw::AbstractString)
    edge_match = match(r"\(\s*(\d+)\s*,\s*(\d+)\s*\)", String(raw))
    edge_match === nothing && return nothing
    return (parse(Int64, edge_match.captures[1]), parse(Int64, edge_match.captures[2]))
end

function _collect_edges_from_capacity_payload(data::AbstractDict)
    edges = Set{Tuple{Int64,Int64}}()

    if haskey(data, "edges") && isa(data["edges"], AbstractVector)
        for edge_data in data["edges"]
            isa(edge_data, AbstractDict) || continue
            haskey(edge_data, "source") || continue
            haskey(edge_data, "destination") || continue
            push!(edges, (Int64(edge_data["source"]), Int64(edge_data["destination"])))
        end
    end

    capacities = get(data, "capacities", nothing)
    if capacities !== nothing && isa(capacities, AbstractDict)
        edge_caps = get(capacities, "edges", nothing)
        if edge_caps !== nothing && isa(edge_caps, AbstractDict)
            for edge_key in keys(edge_caps)
                parsed = _parse_edge_tuple_key(String(edge_key))
                parsed === nothing || push!(edges, parsed)
            end
        end
    end

    return edges
end

function _collect_edges_from_probability_payload(data::AbstractDict)
    edges = Set{Tuple{Int64,Int64}}()
    links = get(data, "links", nothing)
    if links === nothing || !isa(links, AbstractDict)
        return edges
    end

    for edge_key in keys(links)
        parsed = _parse_edge_tuple_key(String(edge_key))
        parsed === nothing || push!(edges, parsed)
    end

    return edges
end

function _collect_edges_from_cpm_payload(data::AbstractDict)
    edges = Set{Tuple{Int64,Int64}}()

    for section_name in ("time_analysis", "cost_analysis")
        section = get(data, section_name, nothing)
        section === nothing && continue
        isa(section, AbstractDict) || continue

        for edge_field in ("edge_delays", "edge_costs")
            edge_map = get(section, edge_field, nothing)
            edge_map === nothing && continue
            isa(edge_map, AbstractDict) || continue
            for edge_key in keys(edge_map)
                parsed = _parse_edge_tuple_key(String(edge_key))
                parsed === nothing || push!(edges, parsed)
            end
        end
    end

    return edges
end

function _write_inferred_edges_file(network_path::String, source_path::String, edges::Set{Tuple{Int64,Int64}})
    isempty(edges) && return ""

    inferred_dir = safe_joinpath(network_path, ".inferred")
    mkpath(inferred_dir)

    fingerprint = bytes2hex(sha1(source_path))[1:12]
    source_name = splitext(basename(source_path))[1]
    filename = "inferred-$(source_name)-$(fingerprint).EDGES"
    output_path = safe_joinpath(inferred_dir, filename)

    open(output_path, "w") do io
        write(io, "source,destination\n")
        for (u, v) in sort!(collect(edges))
            write(io, "$(u),$(v)\n")
        end
    end

    return output_path
end

function _infer_edges_file_path(network_path::String; capacities_path::String="", linkprobs_path::String="", cpm_path::String="")
    candidates = [
        ("capacity", capacities_path),
        ("probability", linkprobs_path),
        ("cpm", cpm_path),
    ]

    for (kind, input_path) in candidates
        isempty(input_path) && continue
        full_path = resolve_network_file_path(network_path, input_path)
        isfile(full_path) || continue

        data = JSON.parsefile(full_path)
        edges = if kind == "capacity"
            _collect_edges_from_capacity_payload(data)
        elseif kind == "probability"
            _collect_edges_from_probability_payload(data)
        else
            _collect_edges_from_cpm_payload(data)
        end

        inferred_path = _write_inferred_edges_file(network_path, full_path, edges)
        !isempty(inferred_path) && return inferred_path
    end

    return ""
end

function resolve_edges_file_path(
    network_path::String,
    edges_file_path::String;
    capacities_path::String="",
    linkprobs_path::String="",
    cpm_path::String="",
)
    if !isempty(edges_file_path)
        resolved_direct_path = resolve_network_file_path(network_path, edges_file_path)
        isfile(resolved_direct_path) && return resolved_direct_path

        parent_candidates = String[]
        for analysis_input_path in (capacities_path, linkprobs_path, cpm_path)
            isempty(analysis_input_path) && continue
            resolved_analysis_path = resolve_network_file_path(network_path, analysis_input_path)
            isfile(resolved_analysis_path) || continue
            push!(parent_candidates, dirname(resolved_analysis_path))
        end

        for parent_dir in parent_candidates
            parent_candidate = resolve_network_file_path(parent_dir, edges_file_path)
            isfile(parent_candidate) && return parent_candidate
        end

        return resolved_direct_path
    end

    if isdir(network_path)
        edges_files = filter(f -> endswith(lowercase(f), ".edges"), readdir(network_path))
        if !isempty(edges_files)
            return safe_joinpath(network_path, sort(edges_files)[1])
        end
    end

    return _infer_edges_file_path(network_path; capacities_path=capacities_path, linkprobs_path=linkprobs_path, cpm_path=cpm_path)
end

end # module ServerCommon
