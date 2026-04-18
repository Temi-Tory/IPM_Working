module ServerCommon

using HTTP
using JSON
using Dates
using UUIDs

const UPLOAD_DIR = "temp_uploads"
const PORT = 8080

function cors_headers_json(; methods::String="GET, POST, PUT, DELETE, OPTIONS")
    return [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => methods,
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json",
    ]
end

function json_response(status::Int, body)
    return HTTP.Response(status, cors_headers_json(), JSON.json(body))
end

function normalize_path_separators(path::String)
    isempty(path) && return path
    normalized = replace(path, "\\" => "/")
    normalized = replace(normalized, r"/+" => "/")
    if startswith(normalized, "/") && !startswith(normalized, "//")
        normalized = normalized[2:end]
    end
    return normalized
end

function safe_joinpath(base_path::String, relative_path::String)
    normalized_base = normalize_path_separators(base_path)
    normalized_relative = normalize_path_separators(relative_path)
    return replace(joinpath(normalized_base, normalized_relative), "\\" => "/")
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
        return replace(edges_name, r"\.EDGES$" => "", count=1)
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

function write_session_metadata(upload_id::AbstractString, metadata::Dict)
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

function parse_multipart_data(body_str::String, boundary::String, upload_path::String)
    uploaded_files = String[]
    parts = split(body_str, "--" * boundary)

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

        filename = filename_match.captures[1]
        isempty(strip(content)) && continue
        content = rstrip(content, ['\r', '\n', '-'])

        file_path = safe_joinpath(upload_path, filename)
        file_dir = dirname(file_path)
        if file_dir != upload_path
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
    if isempty(edges_file_path)
        if isdir(network_path)
            edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
            if !isempty(edges_files)
                return safe_joinpath(network_path, edges_files[1])
            end
        end
        return ""
    end

    return safe_joinpath(network_path, edges_file_path)
end

end # module ServerCommon
