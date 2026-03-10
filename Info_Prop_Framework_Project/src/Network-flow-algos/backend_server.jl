# Flexible Multi-Scenario Backend Server for Network Analysis
# Supports user-specified input paths for each analysis scenario
# Based on expected raw results structure and Julia algorithm requirements

using HTTP, JSON
using Dates, UUIDs
using ProbabilityBoundsAnalysis
using IntervalArithmetic

# Include the IPAFrameworkOptimized module (includes CapacityAnalysisModule via re-export)
include("src/IPAFrameworkOptimized.jl")
using .IPAFrameworkOptimized

# Import types for type checking
const pbox = ProbabilityBoundsAnalysis.pbox
const Interval = IPAFrameworkOptimized.Interval

const UPLOAD_DIR = "temp_uploads"
const PORT = 8080

function normalize_path_separators(path::String)
    """Normalize path separators to forward slashes and remove duplicate separators"""
    try
        if isempty(path)
            return path
        end
        
        # Replace all backslashes with forward slashes
        normalized = replace(path, "\\" => "/")
        
        # Remove duplicate forward slashes (but preserve leading // for UNC paths if needed)
        normalized = replace(normalized, r"/+" => "/")
        
        # Remove leading slash if it exists (for relative paths)
        if startswith(normalized, "/") && !startswith(normalized, "//")
            normalized = normalized[2:end]
        end
        
        return normalized
    catch e
        println("ERROR in normalize_path_separators:")
        println("  path: '$path'")
        println("  error: $e")
        rethrow(e)
    end
end

function safe_joinpath(base_path::String, relative_path::String)
    """Safely join paths with proper separator normalization"""
    try
        normalized_base = normalize_path_separators(base_path)
        normalized_relative = normalize_path_separators(relative_path)
        
        # Use Julia's joinpath with normalized paths
        result = joinpath(normalized_base, normalized_relative)
        
        # Ensure consistent forward slashes in the result
        return replace(result, "\\" => "/")
    catch e
        println("ERROR in safe_joinpath:")
        println("  base_path: '$base_path'")
        println("  relative_path: '$relative_path'")
        println("  error: $e")
        rethrow(e)
    end
end

function safe_joinpath_with_dedup(base_path::String, relative_path::String)
    """Safely join paths with duplicate segment detection - ONLY for reachability analysis"""
    normalized_base = normalize_path_separators(base_path)
    normalized_relative = normalize_path_separators(relative_path)
    
    # Check for duplicate path segments
    # If base ends with a segment that relative starts with, remove the duplicate
    if !isempty(normalized_base) && !isempty(normalized_relative)
        base_parts = split(normalized_base, "/")
        relative_parts = split(normalized_relative, "/")
        
        # Check if the last part of base matches the first part of relative
        if !isempty(base_parts) && !isempty(relative_parts) &&
           base_parts[end] == relative_parts[1]
            # Remove the duplicate segment from relative path
            normalized_relative = join(relative_parts[2:end], "/")
        end
    end
    
    # Use Julia's joinpath with normalized paths
    result = joinpath(normalized_base, normalized_relative)
    
    # Ensure consistent forward slashes in the result
    return replace(result, "\\" => "/")
end

function pbox_to_dict(pbox::ProbabilityBoundsAnalysis.pbox)
    """Convert a Pbox object to a JSON-serializable dictionary with reduced discretization"""
    # Only include summary statistics, not full discretization arrays
    return Dict(
        "type" => "pbox",
        "mean_lower" => pbox.ml,
        "mean_upper" => pbox.mh,
        "var_lower" => pbox.vl,
        "var_upper" => pbox.vh,
        "shape" => string(pbox.shape),
        "name" => pbox.name,
        "bounded" => pbox.bounded,
        "discretization_size" => pbox.n,
        # Only include first, last, and quartile points instead of full arrays
        "bounds_summary" => Dict(
            "left_min" => length(pbox.u) > 0 ? pbox.u[1] : 0.0,
            "left_max" => length(pbox.u) > 0 ? pbox.u[end] : 0.0,
            "right_min" => length(pbox.d) > 0 ? pbox.d[1] : 0.0,
            "right_max" => length(pbox.d) > 0 ? pbox.d[end] : 0.0
        )
    )
end

function convert_pbox_values(obj)
    """Recursively convert any Pbox/Interval objects in a data structure to dictionaries"""
    if isa(obj, ProbabilityBoundsAnalysis.pbox)
        return pbox_to_dict(obj)
    elseif isa(obj, Interval)
        return Dict("lower" => obj.lower, "upper" => obj.upper, "type" => "interval")
    elseif isa(obj, Dict)
        return Dict(k => convert_pbox_values(v) for (k, v) in obj)
    elseif isa(obj, Array)
        return [convert_pbox_values(item) for item in obj]
    else
        return obj
    end
end

"""Parse a JSON value as Float64 or Interval based on data_type"""
function parse_typed_value(v, ::Type{Float64})
    return Float64(v)
end
function parse_typed_value(v, ::Type{Interval})
    if isa(v, Dict)
        lower = Float64(v["lower"])
        upper = Float64(v["upper"])
        # Validate: ensure lower <= upper
        if lower > upper
            @warn "Malformed interval: lower=$lower > upper=$upper. Swapping."
            lower, upper = upper, lower
        end
        return Interval(lower, upper)
    else
        val = Float64(v)
        return Interval(val, val)
    end
end

function setup_server()
    # Create upload directory if it doesn't exist
    if !isdir(UPLOAD_DIR)
        mkdir(UPLOAD_DIR)
    end
    println("Flexible Multi-Scenario Backend Server starting on port $PORT...")
    println("Upload directory: $UPLOAD_DIR")
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
        println("Failed to parse session metadata for $upload_id: $e")
        return nothing
    end
end

function write_session_metadata(upload_id::AbstractString, metadata::Dict)
    meta_path = session_file_path(upload_id)
    open(meta_path, "w") do io
        write(io, JSON.json(metadata))
    end
end

function handle_sessions_list(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]

    try
        if !isdir(UPLOAD_DIR)
            return HTTP.Response(200, cors_headers, JSON.json(Dict(
                "success" => true,
                "sessions" => Any[]
            )))
        end

        sessions = Any[]
        for entry in readdir(UPLOAD_DIR)
            folder_path = joinpath(UPLOAD_DIR, entry)
            if !isdir(folder_path)
                continue
            end

            session_meta = read_session_metadata(entry)
            if session_meta === nothing
                continue
            end

            push!(sessions, Dict(
                "session_id" => get(session_meta, "session_id", entry),
                "upload_id" => get(session_meta, "upload_id", entry),
                "network_name" => get(session_meta, "network_name", "Network Upload"),
                "network_path" => get(session_meta, "network_path", ""),
                "timestamp" => get(session_meta, "updated_at", get(session_meta, "created_at", string(Dates.now()))),
                "has_analysis_results" => get(session_meta, "analysis_results", nothing) !== nothing
            ))
        end

        sort!(sessions, by = s -> get(s, "timestamp", ""), rev = true)

        return HTTP.Response(200, cors_headers, JSON.json(Dict(
            "success" => true,
            "sessions" => sessions
        )))
    catch e
        println("Session list error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Failed to list sessions"
        )))
    end
end

function handle_session_item(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]

    try
        uri = HTTP.URI(req.target)
        parts = split(uri.path, "/")
        if length(parts) < 3 || isempty(parts[3])
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Missing session id"
            )))
        end

        session_id = parts[3]
        folder_path = joinpath(UPLOAD_DIR, session_id)

        if req.method == "GET"
            session_meta = read_session_metadata(session_id)
            if session_meta === nothing
                return HTTP.Response(404, cors_headers, JSON.json(Dict(
                    "success" => false,
                    "message" => "Session not found"
                )))
            end

            println("📤 GET /sessions/$session_id - Returning file_manager_state: $(session_meta["file_manager_state"] !== nothing ? "YES" : "NULL")")
            if session_meta["file_manager_state"] !== nothing && isa(session_meta["file_manager_state"], Dict)
                fms = session_meta["file_manager_state"]
                println("   📁 Analysis groups: reachability=$(length(get(fms, "analysisGroups", Dict())["reachability"])), capacity=$(length(get(fms, "analysisGroups", Dict())["capacity"])), cpm=$(length(get(fms, "analysisGroups", Dict())["cpm"]))")
            end

            return HTTP.Response(200, cors_headers, JSON.json(Dict(
                "success" => true,
                "session" => session_meta
            )))
        elseif req.method == "PUT"
            session_meta = read_session_metadata(session_id)
            if session_meta === nothing
                return HTTP.Response(404, cors_headers, JSON.json(Dict(
                    "success" => false,
                    "message" => "Session not found"
                )))
            end

            payload = JSON.parse(String(req.body))
            println("📥 PUT /sessions/$session_id - Received payload keys: $(keys(payload))")
            if haskey(payload, "file_manager_state")
                println("📁 file_manager_state received: $(payload["file_manager_state"] !== nothing ? "YES" : "NULL")")
            else
                println("⚠️ file_manager_state NOT in payload")
            end
            
            for key in [
                "network_path", "network_name", "network_data", "analysis_results",
                "analysis_history", "parsed_data", "file_manager_state"
            ]
                if haskey(payload, key)
                    session_meta[key] = payload[key]
                end
            end
            session_meta["updated_at"] = string(Dates.now())

            write_session_metadata(session_id, session_meta)
            println("✅ Session $session_id saved with file_manager_state: $(session_meta["file_manager_state"] !== nothing ? "YES" : "NULL")")

            return HTTP.Response(200, cors_headers, JSON.json(Dict(
                "success" => true,
                "session" => session_meta
            )))
        elseif req.method == "DELETE"
            if isdir(folder_path)
                rm(folder_path; force=true, recursive=true)
            end

            return HTTP.Response(200, cors_headers, JSON.json(Dict(
                "success" => true,
                "message" => "Session deleted"
            )))
        end

        return HTTP.Response(405, cors_headers, JSON.json(Dict(
            "success" => false,
            "message" => "Method not allowed"
        )))
    catch e
        println("Session item error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Session operation failed"
        )))
    end
end

function validate_network_file(edges_file_path::String)
    # Simple validation - just check if .EDGES file exists
    if !isfile(edges_file_path)
        return false, "Missing .EDGES file: $edges_file_path"
    end
    return true, "Valid .EDGES file"
end

function create_default_node_priors(allnodes::Vector{Int64})
    """Create default node priors (all 1.0) for diamond-only analysis"""
    return Dict{Int64, Float64}(node => 1.0 for node in allnodes)
end

function serialize_root_diamonds_for_json(root_diamonds_dict)
    """Helper function to serialize root diamond structures (DiamondsAtNode) for JSON response"""
    serialized = Dict()
    for (join_node, diamonds_at_node) in root_diamonds_dict
        # diamonds_at_node is of type DiamondsAtNode
        serialized[string(join_node)] = Dict(
            "join_node" => diamonds_at_node.join_node,
            "diamond" => Dict(
                "conditioning_nodes" => collect(diamonds_at_node.diamond.conditioning_nodes),
                "relevant_nodes" => collect(diamonds_at_node.diamond.relevant_nodes),
                "edgelist" => collect(diamonds_at_node.diamond.edgelist),
                "edge_count" => length(diamonds_at_node.diamond.edgelist),
                "node_count" => length(diamonds_at_node.diamond.relevant_nodes)
            ),
            "non_diamond_parents" => collect(diamonds_at_node.non_diamond_parents)
        )
    end
    return serialized
end

function serialize_unique_diamonds_for_json(unique_diamonds_dict, root_diamonds=nothing)
    """Helper function to serialize unique diamond structures (DiamondComputationData) for JSON response.
    Now accepts root_diamonds to resolve join_node for root-level diamonds."""
    serialized = Dict()

    # Build hash → root join node lookup from root_diamonds
    hash_to_root_join_node = Dict{UInt64, Int64}()
    if root_diamonds !== nothing
        for (root_join_node, diamonds_at_node) in root_diamonds
            root_hash = IPAFrameworkOptimized.create_diamond_hash_key(diamonds_at_node.diamond)
            hash_to_root_join_node[root_hash] = root_join_node
        end
    end

    # Also build hash → parent join node lookup from sub_diamond_structures
    hash_to_parent_join_node = Dict{UInt64, Int64}()
    for (_, diamond_data) in unique_diamonds_dict
        for (join_node, diamonds_at_node) in diamond_data.sub_diamond_structures
            sub_hash = IPAFrameworkOptimized.create_diamond_hash_key(diamonds_at_node.diamond)
            hash_to_parent_join_node[sub_hash] = join_node
        end
    end

    for (diamond_hash, diamond_data) in unique_diamonds_dict
        # Serialize sub_diamond_structures (Dict{Int64, DiamondsAtNode})
        sub_diamond_structures_serialized = Dict()
        for (join_node, diamonds_at_node) in diamond_data.sub_diamond_structures
            sub_diamond_hash = IPAFrameworkOptimized.create_diamond_hash_key(diamonds_at_node.diamond)

            sub_diamond_structures_serialized[string(join_node)] = Dict(
                "join_node" => diamonds_at_node.join_node,
                "sub_diamond_hash" => string(sub_diamond_hash),
                "diamond" => Dict(
                    "conditioning_nodes" => collect(diamonds_at_node.diamond.conditioning_nodes),
                    "relevant_nodes" => collect(diamonds_at_node.diamond.relevant_nodes),
                    "edgelist" => collect(diamonds_at_node.diamond.edgelist),
                    "edge_count" => length(diamonds_at_node.diamond.edgelist),
                    "node_count" => length(diamonds_at_node.diamond.relevant_nodes)
                ),
                "non_diamond_parents" => collect(diamonds_at_node.non_diamond_parents)
            )
        end

        # Determine join_node: root join node if root diamond, otherwise parent join node
        resolved_join_node = get(hash_to_root_join_node, diamond_hash,
                              get(hash_to_parent_join_node, diamond_hash, nothing))

        entry = Dict(
            "diamond_hash" => string(diamond_hash),
            "is_root_diamond" => diamond_data.is_rootDiamond,
            "sub_outgoing_index" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_outgoing_index),
            "sub_incoming_index" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_incoming_index),
            "sub_sources" => collect(diamond_data.sub_sources),
            "sub_fork_nodes" => collect(diamond_data.sub_fork_nodes),
            "sub_join_nodes" => collect(diamond_data.sub_join_nodes),
            "sub_ancestors" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_ancestors),
            "sub_descendants" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_descendants),
            "sub_iteration_sets" => [collect(s) for s in diamond_data.sub_iteration_sets],
            "sub_iteration_sets_count" => length(diamond_data.sub_iteration_sets),
            "sub_node_priors" => Dict(string(k) => convert_pbox_values(v) for (k, v) in diamond_data.sub_node_priors),
            "node_count" => length(diamond_data.sub_node_priors),
            "sub_diamond_structures" => sub_diamond_structures_serialized,
            "diamond" => Dict(
                "conditioning_nodes" => collect(diamond_data.diamond.conditioning_nodes),
                "relevant_nodes" => collect(diamond_data.diamond.relevant_nodes),
                "edgelist" => collect(diamond_data.diamond.edgelist),
                "edge_count" => length(diamond_data.diamond.edgelist),
                "node_count" => length(diamond_data.diamond.relevant_nodes)
            )
        )

        if resolved_join_node !== nothing
            entry["join_node"] = resolved_join_node
        end

        serialized[string(diamond_hash)] = entry
    end

    return serialized
end


function parse_multipart_data(body_str::String, boundary::String, upload_path::String)
    """Parse multipart/form-data and save files to upload directory"""
    uploaded_files = String[]
    
    # Split by boundary
    parts = split(body_str, "--" * boundary)
    
    for part in parts
        part = strip(part)
        if isempty(part) || part == "--" continue end
        
        # Split headers from content
        header_end = findfirst("\r\n\r\n", part)
        if header_end === nothing
            header_end = findfirst("\n\n", part)
            if header_end === nothing continue end
        end
        
        headers = part[1:header_end[1]-1]
        content = part[header_end[end]+1:end]
        
        # Extract filename from Content-Disposition header
        filename_pattern = r"filename=\"([^\"]+)\""
        filename_match = match(filename_pattern, headers)
        if filename_match === nothing continue end
        
        filename = filename_match.captures[1]
        
        # Skip empty files
        if isempty(strip(content)) continue end
        
        # Clean up content (remove trailing boundary markers)
        content = rstrip(content, ['\r', '\n', '-'])
        
        # Save file to upload directory - use Julia's built-in joinpath with normalization
        # Normalize both paths to use forward slashes before joining
        normalized_upload_path = replace(upload_path, "\\" => "/")
        normalized_filename = replace(filename, "\\" => "/")
        file_path = joinpath(normalized_upload_path, normalized_filename)
        # Ensure result uses forward slashes
        file_path = replace(file_path, "\\" => "/")
        
        # Create subdirectories if needed
        file_dir = dirname(file_path)
        if file_dir != upload_path
            mkpath(file_dir)
        end
        
        # Write file
        open(file_path, "w") do io
            write(io, content)
        end
        
        push!(uploaded_files, filename)
        println("Saved uploaded file: $filename ($(length(content)) bytes)")
    end
    
    return uploaded_files
end

# Removed organize_uploaded_files, determine_file_location, and scan_available_data_files
# Backend now saves files with original paths without organization

# File serving endpoint for frontend to fetch JSON files directly
function handle_file_request(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        # Extract file path from URL
        uri = HTTP.URI(req.target)
        path_parts = split(uri.path, "/")
        
        if length(path_parts) < 4 || path_parts[2] != "files"
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid file path format. Expected: /files/network_path/relative_file_path"
            )))
        end
        
        # Reconstruct network path and file path
        network_path = path_parts[3]
        file_path = join(path_parts[4:end], "/")
        
        # Construct full file path - use Julia's built-in joinpath with normalization
        normalized_network_path = replace(network_path, "\\" => "/")
        normalized_file_path = replace(file_path, "\\" => "/")
        full_file_path = joinpath(normalized_network_path, normalized_file_path)
        full_file_path = replace(full_file_path, "\\" => "/")
        
        if !isfile(full_file_path)
            return HTTP.Response(404, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "File not found: $full_file_path"
            )))
        end
        
        # Read and return file content
        file_content = JSON.parsefile(full_file_path)
        return HTTP.Response(200, cors_headers, JSON.json(file_content))
        
    catch e
        println("File request error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Failed to serve file"
        )))
    end
end

# Documentation serving endpoint - serves markdown files from docs/ directory
function handle_docs_request(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "text/markdown; charset=utf-8"
    ]

    try
        uri = HTTP.URI(req.target)
        path_parts = split(uri.path, "/")

        # Expected format: /docs/filename.md
        if length(path_parts) < 3 || path_parts[2] != "docs"
            return HTTP.Response(400, cors_headers, "Invalid docs path format. Expected: /docs/filename.md")
        end

        filename = join(path_parts[3:end], "/")

        # Resolve docs directory relative to this script
        docs_dir = joinpath(@__DIR__, "docs")
        full_path = joinpath(docs_dir, filename)
        full_path = normpath(full_path)

        # Security: ensure resolved path is within docs directory
        if !startswith(full_path, normpath(docs_dir))
            return HTTP.Response(403, cors_headers, "Access denied: path traversal not allowed")
        end

        if !isfile(full_path)
            return HTTP.Response(404, cors_headers, "Documentation file not found: $filename")
        end

        content = read(full_path, String)
        return HTTP.Response(200, cors_headers, content)

    catch e
        println("Docs request error: ", e)
        return HTTP.Response(500, cors_headers, "Failed to serve documentation: $(string(e))")
    end
end

# List available documentation files
function handle_docs_list(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]

    try
        docs_dir = joinpath(@__DIR__, "docs")
        if !isdir(docs_dir)
            return HTTP.Response(200, cors_headers, JSON.json(Dict("files" => [])))
        end

        md_files = filter(f -> endswith(f, ".md"), readdir(docs_dir))
        return HTTP.Response(200, cors_headers, JSON.json(Dict("files" => md_files)))

    catch e
        println("Docs list error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e)
        )))
    end
end

# Individual Analysis Endpoint Handlers

function handle_network_structure(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        
        if isempty(network_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path required"
            )))
        end
        
        # If edges file path not provided, try to find it
        if isempty(edges_file_path)
            # Look for .EDGES files in the network path
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    # Use Julia's built-in joinpath with normalization
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        # Network Structure Analysis Only
        start_time = time()
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        
        # Identify network structure
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        computation_time = time() - start_time
        
        network_structure = Dict(
            "computation_time" => computation_time,
            "total_nodes" => length(allnodes),
            "total_edges" => length(edgelist),
            "nodes" => allnodes,
            "edges" => [(e[1], e[2]) for e in edgelist],
            "source_nodes" => collect(source_nodes),
            "sink_nodes" => collect(sink_nodes),
            "fork_nodes" => collect(fork_nodes),
            "join_nodes" => collect(join_nodes),
            "iteration_sets" => [collect(s) for s in iteration_sets],
            "iteration_sets_count" => length(iteration_sets),
            "ancestors" => Dict(string(k) => collect(v) for (k, v) in ancestors),
            "descendants" => Dict(string(k) => collect(v) for (k, v) in descendants),
            "outgoing_index" => Dict(string(k) => collect(v) for (k, v) in outgoing_index),
            "incoming_index" => Dict(string(k) => collect(v) for (k, v) in incoming_index)
        )
        
        result = Dict(
            "success" => true,
            "message" => "Network structure analysis completed",
            "edges_file_path" => edges_file_path,
            "timestamp" => Dates.now(),
            "network_structure" => network_structure
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Network structure analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Network structure analysis failed"
        )))
    end
end

function handle_diamond_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        nodepriors_path = get(request_data, "nodepriorsPath", "")  # Optional
        
        if isempty(network_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path required"
            )))
        end
        
        # Determine edges file path
        if isempty(edges_file_path)
            # Look for .EDGES files in the network path
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    # Use Julia's built-in joinpath with normalization
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        # Load network structure
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Diamond Analysis
        start_time = time()
        
        # Load node priors if specified, otherwise use defaults
        node_priors = if !isempty(nodepriors_path)
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_nodepriors_path = replace(nodepriors_path, "\\" => "/")
            full_path = joinpath(normalized_network_path, normalized_nodepriors_path)
            full_path = replace(full_path, "\\" => "/")
            
            if isfile(full_path)
                try
                    println("🔍 Loading node priors from: $full_path")
                    priors = read_node_priors_from_json(full_path)
                    println("🔍 Node priors type: $(typeof(priors))")
                    if !isempty(priors)
                        first_val = first(values(priors))
                        println("🔍 First node prior type: $(typeof(first_val))")
                        if isa(first_val, pbox)
                            println("🔍 Pbox properties: ml=$(first_val.ml), mh=$(first_val.mh)")
                        end
                    end
                    priors
                catch e
                    println("❌ Error loading node priors: $e")
                    println("🔄 Falling back to default node priors")
                    create_default_node_priors(allnodes)
                end
            else
                create_default_node_priors(allnodes)
            end
        else
            create_default_node_priors(allnodes)
        end
        
        # Root diamonds with comprehensive error handling
        root_diamonds = try
            println("🔍 Starting identify_and_group_diamonds with:")
            println("  - Join nodes: $(length(join_nodes))")
            println("  - Source nodes: $(length(source_nodes))")
            println("  - Fork nodes: $(length(fork_nodes))")
            println("  - Node priors type: $(typeof(node_priors))")
            if !isempty(node_priors)
                first_key = first(keys(node_priors))
                first_val = node_priors[first_key]
                println("  - First node prior ($first_key): $(typeof(first_val))")
                if isa(first_val, pbox)
                    println("    - Pbox ml: $(first_val.ml), mh: $(first_val.mh)")
                end
            end
            
            result = identify_and_group_diamonds(
                join_nodes, incoming_index, ancestors, descendants,
                source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
            )
            
            println("✅ identify_and_group_diamonds completed successfully")
            result
        catch e
            println("❌ Error in identify_and_group_diamonds: $e")
            println("❌ Error type: $(typeof(e))")
            if isa(e, MethodError)
                println("❌ MethodError details:")
                println("  - Function: $(e.f)")
                println("  - Arguments types: $(typeof.(e.args))")
                println("  - Arguments values: $(e.args)")
            end
            
            # Print stack trace for debugging
            println("❌ Stack trace:")
            for (i, frame) in enumerate(stacktrace(catch_backtrace()))
                println("  $i: $frame")
                if i > 15  # Show more stack trace for debugging
                    break
                end
            end
            
            rethrow(e)
        end
        root_computation_time = time() - start_time
        
        # Unique diamonds with comprehensive error handling
        unique_start_time = time()
        unique_diamonds = try
            println("🔍 Starting build_unique_diamond_storage_depth_first_parallel with:")
            println("  - Root diamonds count: $(length(root_diamonds))")
            println("  - Node priors type: $(typeof(node_priors))")
            
            result = build_unique_diamond_storage_depth_first_parallel(
                root_diamonds, node_priors, ancestors, descendants, iteration_sets
            )
            
            println("✅ build_unique_diamond_storage_depth_first_parallel completed successfully")
            result
        catch e
            println("❌ Error in build_unique_diamond_storage_depth_first_parallel: $e")
            println("❌ Error type: $(typeof(e))")
            if isa(e, MethodError)
                println("❌ MethodError details:")
                println("  - Function: $(e.f)")
                println("  - Arguments types: $(typeof.(e.args))")
                println("  - Arguments values: $(e.args)")
            end
            
            # Print stack trace for debugging
            println("❌ Stack trace:")
            for (i, frame) in enumerate(stacktrace(catch_backtrace()))
                println("  $i: $frame")
                if i > 15  # Show more stack trace for debugging
                    break
                end
            end
            
            rethrow(e)
        end
        unique_computation_time = time() - unique_start_time
        
        diamond_analysis = Dict(
            "root_diamonds_count" => length(root_diamonds),
            "unique_diamonds_count" => length(unique_diamonds),
            "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
            "root_computation_time" => root_computation_time,
            "unique_computation_time" => unique_computation_time,
            "total_computation_time" => root_computation_time + unique_computation_time,
            "diamond_efficiency" => length(unique_diamonds) / max(1, length(root_diamonds)),
            "raw_root_diamonds" => serialize_root_diamonds_for_json(root_diamonds),
            "raw_unique_diamonds" => serialize_unique_diamonds_for_json(unique_diamonds, root_diamonds)
        )

        result = Dict(
            "success" => true,
            "message" => "Diamond analysis completed",
            "edges_file_path" => edges_file_path,
            "nodepriors_path" => nodepriors_path,
            "timestamp" => Dates.now(),
            "diamond_analysis" => diamond_analysis
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Diamond analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Diamond analysis failed"
        )))
    end
end

function handle_diamond_subgraph_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]

    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        nodepriors_path = get(request_data, "nodepriorsPath", "")
        linkprobs_path = get(request_data, "linkprobsPath", "")
        capacities_path = get(request_data, "capacitiesPath", "")
        cpm_path = get(request_data, "cpmPath", "")
        diamond_hash_str = get(request_data, "diamondHash", "")
        analyses = get(request_data, "analyses", String[])
        source_overrides = get(request_data, "sourceOverrides", nothing)

        if isempty(network_path) || isempty(diamond_hash_str)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path and diamond hash required"
            )))
        end

        # Determine edges file path
        if isempty(edges_file_path)
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end

        # Validate edges file
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end

        # Load network structure
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

        # Load node priors for diamond identification
        node_priors = if !isempty(nodepriors_path)
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_nodepriors_path = replace(nodepriors_path, "\\" => "/")
            full_path = joinpath(normalized_network_path, normalized_nodepriors_path)
            full_path = replace(full_path, "\\" => "/")
            if isfile(full_path)
                try
                    read_node_priors_from_json(full_path)
                catch e
                    create_default_node_priors(allnodes)
                end
            else
                create_default_node_priors(allnodes)
            end
        else
            create_default_node_priors(allnodes)
        end

        # Identify diamonds to find the requested one
        root_diamonds = identify_and_group_diamonds(
            join_nodes, incoming_index, ancestors, descendants,
            source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
        )
        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds, node_priors, ancestors, descendants, iteration_sets
        )

        # Parse diamond hash
        diamond_hash = parse(UInt64, diamond_hash_str)

        if !haskey(unique_diamonds, diamond_hash)
            return HTTP.Response(404, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Diamond with hash $diamond_hash_str not found"
            )))
        end

        diamond_data = unique_diamonds[diamond_hash]

        # Build response with diamond info
        result_data = Dict{String, Any}(
            "success" => true,
            "diamond_hash" => diamond_hash_str,
            "diamond_info" => Dict(
                "join_nodes" => collect(diamond_data.sub_join_nodes),
                "conditioning_nodes" => collect(diamond_data.diamond.conditioning_nodes),
                "node_count" => length(diamond_data.sub_node_priors),
                "edge_count" => length(diamond_data.diamond.edgelist),
                "source_nodes" => collect(diamond_data.sub_sources),
                "fork_nodes" => collect(diamond_data.sub_fork_nodes),
                "is_root_diamond" => diamond_data.is_rootDiamond,
                "source_priors" => Dict(string(src) => convert_pbox_values(get(diamond_data.sub_node_priors, src, 1.0)) for src in diamond_data.sub_sources)
            )
        )

        # Run requested analyses on diamond subgraph
        for analysis in analyses
            if analysis == "reachability" && !isempty(linkprobs_path)
                try
                    # Load edge probabilities
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_linkprobs_path = replace(linkprobs_path, "\\" => "/")
                    full_linkprobs_path = joinpath(normalized_network_path, normalized_linkprobs_path)
                    full_linkprobs_path = replace(full_linkprobs_path, "\\" => "/")

                    if isfile(full_linkprobs_path)
                        edge_probabilities = read_edge_probabilities_from_json(full_linkprobs_path)

                        # Apply reachability source prior overrides if provided
                        effective_node_priors = copy(diamond_data.sub_node_priors)
                        if source_overrides !== nothing && haskey(source_overrides, "reachability")
                            for (node_str, value) in source_overrides["reachability"]
                                node_id = parse(Int64, node_str)
                                if haskey(effective_node_priors, node_id)
                                    effective_node_priors[node_id] = Float64(value)
                                end
                            end
                        end

                        # Run reachability on diamond subgraph
                        reachability_start = time()
                        sub_output = IPAFrameworkOptimized.update_beliefs_iterative(
                            diamond_data.diamond.edgelist,
                            diamond_data.sub_iteration_sets,
                            diamond_data.sub_outgoing_index,
                            diamond_data.sub_incoming_index,
                            diamond_data.sub_sources,
                            effective_node_priors,
                            edge_probabilities,
                            diamond_data.sub_descendants,
                            diamond_data.sub_ancestors,
                            diamond_data.sub_diamond_structures,
                            diamond_data.sub_join_nodes,
                            diamond_data.sub_fork_nodes,
                            unique_diamonds
                        )
                        reachability_time = time() - reachability_start

                        beliefs_dict = Dict(string(k) => convert_pbox_values(v) for (k, v) in sub_output)

                        result_data["reachability_result"] = Dict(
                            "beliefs" => beliefs_dict,
                            "computation_time" => reachability_time,
                            "total_nodes_processed" => length(sub_output)
                        )
                    end
                catch e
                    println("Diamond subgraph reachability error: ", e)
                    result_data["reachability_result"] = Dict("error" => string(e))
                end

            elseif analysis == "capacity" && !isempty(capacities_path)
                try
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_capacities_path = replace(capacities_path, "\\" => "/")
                    full_capacities_path = joinpath(normalized_network_path, normalized_capacities_path)
                    full_capacities_path = replace(full_capacities_path, "\\" => "/")

                    if isfile(full_capacities_path)
                        capacity_data = JSON.parsefile(full_capacities_path)
                        node_caps_raw = capacity_data["capacities"]["nodes"]
                        edge_caps_raw = capacity_data["capacities"]["edges"]
                        source_rates_raw = capacity_data["capacities"]["source_rates"]

                        node_capacities = Dict{Int64,Float64}(parse(Int64, k) => Float64(v) for (k, v) in node_caps_raw)
                        edge_capacities = Dict{Tuple{Int64,Int64},Float64}()
                        for (k, v) in edge_caps_raw
                            cleaned_key = replace(k, "(" => "", ")" => "")
                            parts = split(cleaned_key, ",")
                            edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                            edge_capacities[edge_key] = Float64(v)
                        end
                        source_rates = Dict{Int64,Float64}()
                        for (k, v) in source_rates_raw
                            rate = Float64(v)
                            if rate > 0.0
                                source_rates[parse(Int64, k)] = rate
                            end
                        end

                        # Ensure diamond subgraph source nodes have source rates
                        # (they may not be full-network sources — use node capacity as default)
                        for src in diamond_data.sub_sources
                            if !haskey(source_rates, src)
                                source_rates[src] = get(node_capacities, src, 1.0)
                            end
                        end

                        # Apply capacity source rate overrides if provided
                        if source_overrides !== nothing && haskey(source_overrides, "capacity")
                            for (node_str, value) in source_overrides["capacity"]
                                node_id = parse(Int64, node_str)
                                source_rates[node_id] = Float64(value)
                            end
                        end

                        # Determine sub-graph sink nodes
                        sub_allnodes = collect(keys(diamond_data.sub_incoming_index))
                        sub_sink_nodes = filter(node -> !haskey(diamond_data.sub_outgoing_index, node) || isempty(diamond_data.sub_outgoing_index[node]), sub_allnodes)
                        targets = Set{Int64}(sub_sink_nodes)

                        capacity_start = time()
                        capacity_params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)
                        capacity_result = maximum_flow_capacity(
                            diamond_data.sub_iteration_sets,
                            diamond_data.sub_outgoing_index,
                            diamond_data.sub_incoming_index,
                            diamond_data.sub_sources,
                            capacity_params
                        )
                        capacity_time = time() - capacity_start

                        result_data["capacity_result"] = Dict(
                            "node_max_flows" => Dict(string(k) => convert_pbox_values(v) for (k, v) in capacity_result.node_max_flows),
                            "bottlenecks" => Dict(string(k) => convert_pbox_values(v) for (k, v) in capacity_result.bottlenecks),
                            "network_utilization" => convert_pbox_values(capacity_result.network_utilization),
                            "computation_time" => capacity_time,
                            "node_capacities" => Dict(string(k) => convert_pbox_values(v) for (k, v) in node_capacities if haskey(diamond_data.sub_node_priors, k)),
                            "source_rates_used" => Dict(string(src) => source_rates[src] for src in diamond_data.sub_sources if haskey(source_rates, src))
                        )
                    end
                catch e
                    println("Diamond subgraph capacity error: ", e)
                    result_data["capacity_result"] = Dict("error" => string(e))
                end

            elseif analysis == "cpm" && !isempty(cpm_path)
                try
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_cpm_path = replace(cpm_path, "\\" => "/")
                    full_cpm_path = joinpath(normalized_network_path, normalized_cpm_path)
                    full_cpm_path = replace(full_cpm_path, "\\" => "/")

                    if isfile(full_cpm_path)
                        cpm_data = JSON.parsefile(full_cpm_path)
                        time_analysis = cpm_data["time_analysis"]
                        cost_analysis = cpm_data["cost_analysis"]

                        node_durations = Dict{Int64,Float64}(parse(Int64, k) => Float64(v) for (k, v) in time_analysis["node_durations"])
                        edge_delays = Dict{Tuple{Int64,Int64},Float64}()
                        for (k, v) in time_analysis["edge_delays"]
                            cleaned_key = replace(k, "(" => "", ")" => "")
                            parts = split(cleaned_key, ",")
                            edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                            edge_delays[edge_key] = Float64(v)
                        end

                        node_costs = Dict{Int64,Float64}(parse(Int64, k) => Float64(v) for (k, v) in cost_analysis["node_costs"])
                        edge_costs = Dict{Tuple{Int64,Int64},Float64}()
                        for (k, v) in cost_analysis["edge_costs"]
                            cleaned_key = replace(k, "(" => "", ")" => "")
                            parts = split(cleaned_key, ",")
                            edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
                            edge_costs[edge_key] = Float64(v)
                        end

                        # Apply CPM source value overrides (separate time/cost)
                        if source_overrides !== nothing
                            if haskey(source_overrides, "cpm_time")
                                for (node_str, value) in source_overrides["cpm_time"]
                                    node_id = parse(Int64, node_str)
                                    if haskey(node_durations, node_id)
                                        node_durations[node_id] = Float64(value)
                                    end
                                end
                            end
                            if haskey(source_overrides, "cpm_cost")
                                for (node_str, value) in source_overrides["cpm_cost"]
                                    node_id = parse(Int64, node_str)
                                    if haskey(node_costs, node_id)
                                        node_costs[node_id] = Float64(value)
                                    end
                                end
                            end
                        end

                        cpm_start = time()

                        # Time analysis on subgraph
                        time_params = CriticalPathParameters(node_durations, edge_delays, 0.0, max_combination, additive_propagation, additive_propagation)
                        time_result = critical_path_analysis(diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index, diamond_data.sub_incoming_index, diamond_data.sub_sources, time_params)
                        time_extended = backward_pass_analysis(time_result, diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index, time_params)

                        # Cost analysis on subgraph
                        cost_params = CriticalPathParameters(node_costs, edge_costs, 0.0, max_combination, additive_propagation, additive_propagation)
                        cost_result = critical_path_analysis(diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index, diamond_data.sub_incoming_index, diamond_data.sub_sources, cost_params)
                        cost_extended = backward_pass_analysis(cost_result, diamond_data.sub_iteration_sets, diamond_data.sub_outgoing_index, cost_params)

                        cpm_time = time() - cpm_start

                        result_data["cpm_result"] = Dict(
                            "computation_time" => cpm_time,
                            "time_result" => Dict(
                                "critical_value" => time_result.critical_value,
                                "critical_nodes" => collect(time_result.critical_nodes),
                                "node_values" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_result.node_values),
                                "early_start" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_extended.early_start),
                                "late_finish" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_extended.late_finish),
                                "total_slack" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_extended.total_slack),
                                "node_durations" => Dict(string(k) => convert_pbox_values(v) for (k, v) in node_durations if haskey(diamond_data.sub_node_priors, k))
                            ),
                            "cost_result" => Dict(
                                "critical_value" => cost_result.critical_value,
                                "critical_nodes" => collect(cost_result.critical_nodes),
                                "node_values" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_result.node_values),
                                "early_start" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_extended.early_start),
                                "late_finish" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_extended.late_finish),
                                "total_slack" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_extended.total_slack),
                                "node_costs" => Dict(string(k) => convert_pbox_values(v) for (k, v) in node_costs if haskey(diamond_data.sub_node_priors, k))
                            )
                        )
                    end
                catch e
                    println("Diamond subgraph CPM error: ", e)
                    result_data["cpm_result"] = Dict("error" => string(e))
                end
            end
        end

        return HTTP.Response(200, cors_headers, JSON.json(result_data))

    catch e
        println("Diamond subgraph analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Diamond subgraph analysis failed"
        )))
    end
end

function handle_reachability_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        
        # 🐛 DEBUG: Log the complete request structure
        println("🔍 REACHABILITY REQUEST DEBUG:")
        println("📋 Complete request keys: ", keys(request_data))
        println("📋 Request data: ", request_data)
        
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        nodepriors_path = get(request_data, "nodepriorsPath", "")
        linkprobs_path = get(request_data, "linkprobsPath", "")
        include_exact_inference = get(request_data, "includeExactInference", true)
        include_diamond_analysis = get(request_data, "includeDiamondAnalysis", false)
        
        # 🐛 DEBUG: Log what we extracted
        println("🔍 EXTRACTED VALUES:")
        println("  networkPath: '$network_path'")
        println("  edgesFilePath: '$edges_file_path'")
        println("  nodepriorsPath: '$nodepriors_path'")
        println("  linkprobsPath: '$linkprobs_path'")
        println("  includeExactInference: $include_exact_inference")
        println("  includeDiamondAnalysis: $include_diamond_analysis")
        
        if isempty(network_path) || isempty(nodepriors_path) || isempty(linkprobs_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path, nodepriors path, and linkprobs path required"
            )))
        end
        
        # Determine edges file path
        if isempty(edges_file_path)
            # Look for .EDGES files in the network path
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    # Use Julia's built-in joinpath with normalization
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        # Load network structure
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Load scenario data - use Julia's built-in joinpath with normalization
        normalized_network_path = replace(network_path, "\\" => "/")
        normalized_nodepriors_path = replace(nodepriors_path, "\\" => "/")
        normalized_linkprobs_path = replace(linkprobs_path, "\\" => "/")
        
        full_nodepriors_path = joinpath(normalized_network_path, normalized_nodepriors_path)
        full_nodepriors_path = replace(full_nodepriors_path, "\\" => "/")
        
        full_linkprobs_path = joinpath(normalized_network_path, normalized_linkprobs_path)
        full_linkprobs_path = replace(full_linkprobs_path, "\\" => "/")
        
        if !isfile(full_nodepriors_path) || !isfile(full_linkprobs_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Required input files not found"
            )))
        end
        
        node_priors = read_node_priors_from_json(full_nodepriors_path)
        edge_probabilities = read_edge_probabilities_from_json(full_linkprobs_path)
        
        scenario_start_time = time()
        result_data = Dict()
        
        # Diamond Analysis (if requested)
        if include_diamond_analysis
            diamond_start_time = time()
            root_diamonds = identify_and_group_diamonds(
                join_nodes, incoming_index, ancestors, descendants,
                source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
            )
            
            unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                root_diamonds, node_priors, ancestors, descendants, iteration_sets
            )
            diamond_computation_time = time() - diamond_start_time
            
            result_data["diamond_analysis"] = Dict(
                "root_diamonds_count" => length(root_diamonds),
                "unique_diamonds_count" => length(unique_diamonds),
                "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
                "computation_time" => diamond_computation_time,
                "raw_root_diamonds" => serialize_root_diamonds_for_json(root_diamonds),
                "raw_unique_diamonds" => serialize_unique_diamonds_for_json(unique_diamonds, root_diamonds)
            )
        end
        
        # Exact Inference (if requested)
        if include_exact_inference
            inference_start_time = time()
            
            # Get diamonds if not already computed
            if !haskey(result_data, "diamond_analysis")
                root_diamonds = identify_and_group_diamonds(
                    join_nodes, incoming_index, ancestors, descendants,
                    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
                )
                unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                    root_diamonds, node_priors, ancestors, descendants, iteration_sets
                )
            else
                # TODO: Extract from previous computation
                root_diamonds = Dict()  # Would need to deserialize
                unique_diamonds = Dict()  # Would need to deserialize
            end
            
            output = IPAFrameworkOptimized.update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities,
                descendants, ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
            )
            
            inference_computation_time = time() - inference_start_time
            
            # Convert beliefs to serializable format
            beliefs_dict = Dict()
            for (node, belief) in output
                beliefs_dict[string(node)] = belief
            end
            
            # Calculate statistics — extract representative numeric value from all types
            numeric_beliefs = []
            for belief in values(output)
                if isa(belief, Float64)
                    push!(numeric_beliefs, belief)
                elseif isa(belief, Interval)
                    # Midpoint of interval as representative value
                    push!(numeric_beliefs, (belief.lower + belief.upper) / 2.0)
                elseif isa(belief, pbox)
                    # Midpoint of mean bounds as representative value
                    push!(numeric_beliefs, (belief.ml + belief.mh) / 2.0)
                elseif isa(belief, Real)
                    push!(numeric_beliefs, Float64(belief))
                end
            end
            
            # Include the actual node priors used for this scenario
            node_priors_dict = Dict(string(k) => convert_pbox_values(v) for (k, v) in node_priors)

            result_data["exact_inference"] = Dict(
                "beliefs" => beliefs_dict,
                "node_priors" => node_priors_dict,
                "computation_time" => inference_computation_time,
                "total_nodes_processed" => length(output),
                "belief_statistics" => Dict(
                    "mean" => length(numeric_beliefs) > 0 ? sum(numeric_beliefs) / length(numeric_beliefs) : 0.0,
                    "min" => length(numeric_beliefs) > 0 ? minimum(numeric_beliefs) : 0.0,
                    "max" => length(numeric_beliefs) > 0 ? maximum(numeric_beliefs) : 0.0,
                    "numeric_count" => length(numeric_beliefs),
                    "total_count" => length(output)
                )
            )
        end
        
        total_time = time() - scenario_start_time
        result_data["scenario_computation_time"] = total_time
        result_data["input_files"] = Dict(
            "nodepriors_path" => nodepriors_path,
            "linkprobs_path" => linkprobs_path
        )
        
        # Convert Pbox values
        converted_result = convert_pbox_values(result_data)
        
        result = Dict(
            "success" => true,
            "message" => "Reachability analysis completed",
            "edges_file_path" => edges_file_path,
            "nodepriors_path" => nodepriors_path,
            "linkprobs_path" => linkprobs_path,
            "timestamp" => Dates.now(),
            "reachability_result" => converted_result
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Reachability analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Reachability analysis failed"
        )))
    end
end

# ============================================
# CAPACITY ANALYSIS HELPERS (Phase 4)
# ============================================

"""Parse CapacityAnalysisOptions from JSON request"""
function parse_capacity_analysis_options(options_dict::Dict)
    return IPAFrameworkOptimized.CapacityAnalysisOptions(
        algorithm = Symbol(get(options_dict, "algorithm", "ford_fulkerson_dag")),
        compute_all_min_cuts = get(options_dict, "computeAllMinCuts", false),
        enumerate_critical_paths = get(options_dict, "enumerateCriticalPaths", true),
        max_paths_to_return = get(options_dict, "maxPathsToReturn", 10),
        compute_upgrade_priorities = get(options_dict, "computeUpgradePriorities", true),
        include_classical_comparison = get(options_dict, "includeClassicalComparison", true),
        target_demands = nothing,  # Not yet supported
        edge_costs = nothing,      # Not yet supported
        target_values = nothing,   # Not yet supported
        tolerance = get(options_dict, "tolerance", 1e-10),
        max_iterations = get(options_dict, "maxIterations", 100000),
        verbosity = Symbol(get(options_dict, "verbosity", "standard"))
    )
end

"""Parse node capacities from JSON (with proper interval support)"""
function parse_node_capacities_deterministic(node_caps_raw::Dict)
    node_capacities = Dict{Int64, Float64}()
    for (k, v) in node_caps_raw
        node_capacities[parse(Int64, k)] = parse_typed_value(v, Float64)
    end
    return node_capacities
end

function parse_node_capacities_interval(node_caps_raw::Dict)
    node_capacities = Dict{Int64, IntervalArithmetic.Interval{Float64}}()
    for (k, v) in node_caps_raw
        interval = parse_typed_value(v, Interval)
        node_capacities[parse(Int64, k)] = IntervalArithmetic.Interval(interval.lower, interval.upper)
    end
    return node_capacities
end

"""Parse edge capacities from JSON"""
function parse_edge_capacities_deterministic(edge_caps_raw::Dict)
    edge_capacities = Dict{Tuple{Int64,Int64}, Float64}()
    for (k, v) in edge_caps_raw
        cleaned_key = replace(k, "(" => "", ")" => "")
        parts = split(cleaned_key, ",")
        edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
        edge_capacities[edge_key] = parse_typed_value(v, Float64)
    end
    return edge_capacities
end

function parse_edge_capacities_interval(edge_caps_raw::Dict)
    edge_capacities = Dict{Tuple{Int64,Int64}, IntervalArithmetic.Interval{Float64}}()
    for (k, v) in edge_caps_raw
        cleaned_key = replace(k, "(" => "", ")" => "")
        parts = split(cleaned_key, ",")
        edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
        interval = parse_typed_value(v, Interval)
        edge_capacities[edge_key] = IntervalArithmetic.Interval(interval.lower, interval.upper)
    end
    return edge_capacities
end

"""Parse source rates from JSON"""
function parse_source_rates_deterministic(source_rates_raw::Dict)
    source_rates = Dict{Int64, Float64}()
    for (k, v) in source_rates_raw
        rate = parse_typed_value(v, Float64)
        if rate > 0.0
            source_rates[parse(Int64, k)] = rate
        end
    end
    return source_rates
end

function parse_source_rates_interval(source_rates_raw::Dict)
    source_rates = Dict{Int64, IntervalArithmetic.Interval{Float64}}()
    for (k, v) in source_rates_raw
        interval = parse_typed_value(v, Interval)
        if interval.upper > 0.0
            source_rates[parse(Int64, k)] = IntervalArithmetic.Interval(interval.lower, interval.upper)
        end
    end
    return source_rates
end

"""Implementation: Deterministic capacity analysis with new refactored module"""
function handle_deterministic_capacity_analysis_impl(
    topology::IPAFrameworkOptimized.NetworkTopology,
    node_caps_raw::Dict,
    edge_caps_raw::Dict,
    source_rates_raw::Dict,
    targets::Set{Int64},
    options::IPAFrameworkOptimized.CapacityAnalysisOptions
)
    # Parse inputs
    node_capacities = parse_node_capacities_deterministic(node_caps_raw)
    edge_capacities = parse_edge_capacities_deterministic(edge_caps_raw)
    source_rates = parse_source_rates_deterministic(source_rates_raw)
    
    # Run analysis with new API
    result, validation = analyze_capacity_validated(
        topology,
        node_capacities = node_capacities,
        edge_capacities = edge_capacities,
        source_rates = source_rates,
        target_nodes = targets,
        options = options
    )
    
    return result, validation
end

"""Implementation: Interval capacity analysis with new refactored module"""
function handle_interval_capacity_analysis_impl(
    topology::IPAFrameworkOptimized.NetworkTopology,
    node_caps_raw::Dict,
    edge_caps_raw::Dict,
    source_rates_raw::Dict,
    targets::Set{Int64},
    options::IPAFrameworkOptimized.CapacityAnalysisOptions
)
    println("DEBUG: Starting interval capacity analysis")
    println("DEBUG: Parsing node capacities...")
    # Parse interval inputs
    node_capacities = parse_node_capacities_interval(node_caps_raw)
    println("DEBUG: Parsed $(length(node_capacities)) node capacities")
    
    println("DEBUG: Parsing edge capacities...")
    edge_capacities = parse_edge_capacities_interval(edge_caps_raw)
    println("DEBUG: Parsed $(length(edge_capacities)) edge capacities")
    
    println("DEBUG: Parsing source rates...")
    source_rates = parse_source_rates_interval(source_rates_raw)
    println("DEBUG: Parsed $(length(source_rates)) source rates")
    
    println("DEBUG: Calling analyze_capacity_uncertain_validated...")
    # Run interval analysis with new API
    result, validation = analyze_capacity_uncertain_validated(
        topology,
        node_capacities = node_capacities,
        edge_capacities = edge_capacities,
        source_rates = source_rates,
        target_nodes = targets,
        options = options
    )
    println("DEBUG: Analysis complete")
    
    return result, validation
end

"""Serialize deterministic capacity result for JSON response"""
function serialize_deterministic_capacity_result(result::CapacityAnalysisResult{Float64}, validation::ValidationReport)
    # Target flows
    target_flows = Dict(string(k) => v for (k, v) in result.target_flows)
    
    # Edge utilization
    edge_utilization = Dict{String, Any}()
    for ((src, dst), flow) in result.edge_flows
        cap = result.bottlenecks.utilization_by_component[(src, dst)] > 0 ? 
              flow / result.bottlenecks.utilization_by_component[(src, dst)] : flow
        edge_utilization["($src,$dst)"] = Dict(
            "capacity" => cap,
            "flow" => flow,
            "utilization" => get(result.bottlenecks.utilization_by_component, (src, dst), 0.0),
            "spare" => cap - flow
        )
    end
    
    return Dict(
        "total_max_flow" => result.total_max_flow,
        "target_flows" => target_flows,
        "network_utilization" => result.network_utilization,
        "node_flows" => Dict(string(k) => v for (k, v) in result.node_flows),
        "edge_flows" => Dict("($src,$dst)" => v for ((src, dst), v) in result.edge_flows),
        "edge_utilization" => edge_utilization,
        "bottlenecks" => serialize_bottleneck_report(result.bottlenecks),
        "upgrade_priorities" => serialize_upgrade_analysis(result.upgrade_priorities),
        "critical_paths" => serialize_path_analysis(result.critical_paths),
        "comparative_analysis" => serialize_comparative_analysis(result.comparative_analysis),
        "metadata" => Dict(
            "timestamp" => result.analysis_timestamp,
            "computation_time_ms" => result.computation_time_ms,
            "algorithm_used" => string(result.algorithm_used),
            "convergence_achieved" => result.convergence_achieved,
            "exactness_guaranteed" => result.exactness_guaranteed
        ),
        "validation" => serialize_validation_report(validation)
    )
end

"""Serialize interval capacity result for JSON response"""
function serialize_interval_capacity_result(result::IntervalCapacityResult, validation::NamedTuple)
    return Dict(
        "guaranteed_min_flow" => result.guaranteed_min_flow,
        "possible_max_flow" => result.possible_max_flow,
        "expected_flow" => result.expected_flow,
        "uncertainty_range" => result.uncertainty_range,
        "robust_bottlenecks" => collect(result.robust_bottlenecks),
        "potential_bottlenecks" => collect(result.potential_bottlenecks),
        "worst_case_scenario" => serialize_deterministic_capacity_result(
            result.worst_case_scenario, validation.worst
        ),
        "best_case_scenario" => serialize_deterministic_capacity_result(
            result.best_case_scenario, validation.best
        ),
        "components_most_uncertain" => [
            Dict("component" => string(c), "impact" => imp) 
            for (c, imp) in result.components_most_uncertain
        ]
    )
end

"""Serialize bottleneck report"""
function serialize_bottleneck_report(bottlenecks::BottleneckReport)
    return Dict(
        "min_cut_capacity" => bottlenecks.min_cut_capacity,
        "min_cut_edges" => [collect(e) for e in bottlenecks.min_cut_edges],
        "min_cut_nodes" => collect(bottlenecks.min_cut_nodes),
        "bottleneck_type" => string(bottlenecks.bottleneck_type),
        "capacity_gap" => bottlenecks.capacity_gap,
        "saturated_edges" => [collect(e) for e in bottlenecks.saturated_edges],
        "saturated_nodes" => collect(bottlenecks.saturated_nodes),
        "near_saturated_edges" => [
            Dict("edge" => collect(e), "utilization" => u) 
            for (e, u) in bottlenecks.near_saturated_edges
        ],
        "near_saturated_nodes" => [
            Dict("node" => n, "utilization" => u) 
            for (n, u) in bottlenecks.near_saturated_nodes
        ],
        "total_spare_edge_capacity" => bottlenecks.total_spare_edge_capacity,
        "total_spare_node_capacity" => bottlenecks.total_spare_node_capacity,
        "utilization_by_component" => Dict(
            string(k) => v for (k, v) in bottlenecks.utilization_by_component
        )
    )
end

"""Serialize upgrade analysis"""
function serialize_upgrade_analysis(upgrade_analysis::UpgradeAnalysis)
    return Dict(
        "edge_priorities" => [
            Dict(
                "edge" => collect(rec.edge),
                "current_capacity" => rec.current_capacity,
                "current_flow" => rec.current_flow,
                "current_utilization" => rec.current_utilization,
                "marginal_value" => rec.marginal_value,
                "recommended_capacity" => rec.recommended_capacity,
                "expected_flow_increase" => rec.expected_flow_increase,
                "priority_score" => rec.priority_score,
                "rationale" => rec.rationale
            )
            for rec in upgrade_analysis.edge_priorities
        ],
        "node_priorities" => [
            Dict(
                "node" => rec.node,
                "current_capacity" => rec.current_capacity,
                "current_flow" => rec.current_flow,
                "current_utilization" => rec.current_utilization,
                "marginal_value" => rec.marginal_value,
                "recommended_capacity" => rec.recommended_capacity,
                "expected_flow_increase" => rec.expected_flow_increase,
                "priority_score" => rec.priority_score,
                "rationale" => rec.rationale
            )
            for rec in upgrade_analysis.node_priorities
        ],
        "primary_bottleneck" => upgrade_analysis.primary_bottleneck,
        "recommended_action" => upgrade_analysis.recommended_action,
        "investment_efficiency" => Dict(
            string(k) => v for (k, v) in upgrade_analysis.investment_efficiency
        )
    )
end

"""Serialize path analysis"""
function serialize_path_analysis(path_analysis::PathAnalysis)
    return Dict(
        "critical_paths" => [
            Dict(
                "path" => path.path,
                "capacity" => path.capacity,
                "flow" => path.flow,
                "is_saturated" => path.is_saturated,
                "spare_capacity" => path.spare_capacity,
                "length" => path.length,
                "bottleneck_location" => string(path.bottleneck_location)
            )
            for path in path_analysis.critical_paths
        ],
        "path_redundancy" => Dict(string(k) => v for (k, v) in path_analysis.path_redundancy),
        "single_points_of_failure" => [string(spof) for spof in path_analysis.single_points_of_failure],
        "path_flow_distribution" => [
            Dict("path" => p, "flow" => f) 
            for (p, f) in path_analysis.path_flow_distribution
        ]
    )
end

"""Serialize comparative analysis"""
function serialize_comparative_analysis(comparative_analysis::ComparativeAnalysis)
    return Dict(
        "realistic_max_flow" => comparative_analysis.realistic_max_flow,
        "realistic_bottleneck_type" => string(comparative_analysis.realistic_bottleneck_type),
        "classical_max_flow" => comparative_analysis.classical_max_flow,
        "classical_min_cut" => [collect(e) for e in comparative_analysis.classical_min_cut],
        "efficiency_loss" => comparative_analysis.efficiency_loss,
        "capacity_gap" => comparative_analysis.capacity_gap,
        "primary_limitation" => string(comparative_analysis.primary_limitation),
        "strategic_recommendation" => comparative_analysis.strategic_recommendation,
        "transmission_bottlenecks" => [collect(e) for e in comparative_analysis.transmission_bottlenecks],
        "processing_bottlenecks" => collect(comparative_analysis.processing_bottlenecks),
        "capacity_gaps_by_component" => Dict(
            string(k) => v for (k, v) in comparative_analysis.capacity_gaps_by_component
        )
    )
end

"""Serialize validation report"""
function serialize_validation_report(validation::ValidationReport)
    return Dict(
        "all_checks_passed" => validation.all_checks_passed,
        "flow_conservation_satisfied" => validation.flow_conservation_satisfied,
        "conservation_violations" => [
            Dict("node" => n, "violation" => v) 
            for (n, v) in validation.conservation_violations
        ],
        "max_conservation_error" => validation.max_conservation_error,
        "capacity_constraints_satisfied" => validation.capacity_constraints_satisfied,
        "capacity_violations" => [
            Dict("component" => string(c), "violation" => v) 
            for (c, v) in validation.capacity_violations
        ],
        "total_source_rate" => validation.total_source_rate,
        "total_target_flow" => validation.total_target_flow,
        "flow_balance_satisfied" => validation.flow_balance_satisfied,
        "optimality_verified" => validation.optimality_verified,
        "min_cut_capacity" => validation.min_cut_capacity,
        "max_flow_value" => validation.max_flow_value,
        "warnings" => validation.warnings,
        "errors" => validation.errors
    )
end

"""
POST /api/capacity-analysis
Comprehensive capacity analysis using refactored CapacityAnalysisModule (Phase 1-3)
Supports deterministic (Float64) and interval uncertainty modes
"""
function handle_capacity_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        capacities_path = get(request_data, "capacitiesPath", "")
        uncertainty_mode = get(request_data, "uncertaintyMode", "deterministic")  # "deterministic" or "interval"
        
        if isempty(network_path) || isempty(capacities_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path and capacities path required"
            )))
        end
        
        # Determine edges file path
        if isempty(edges_file_path)
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        # Load network topology
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Build topology structure for new API
        topology = IPAFrameworkOptimized.NetworkTopology(iteration_sets, outgoing_index, incoming_index, Set(source_nodes))
        
        # Load capacity data
        normalized_network_path = replace(network_path, "\\" => "/")
        normalized_capacities_path = replace(capacities_path, "\\" => "/")
        full_capacities_path = joinpath(normalized_network_path, normalized_capacities_path)
        full_capacities_path = replace(full_capacities_path, "\\" => "/")
        if !isfile(full_capacities_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Capacities file not found"
            )))
        end
        
        capacity_data = JSON.parsefile(full_capacities_path)
        data_type_in_file = get(capacity_data, "data_type", "Float64")
        node_caps_raw = capacity_data["capacities"]["nodes"]
        edge_caps_raw = capacity_data["capacities"]["edges"]
        source_rates_raw = capacity_data["capacities"]["source_rates"]
        
        # Target nodes are sink nodes
        targets = Set{Int64}(sink_nodes)
        
        # Parse options from request (optional)
        options_raw = get(request_data, "options", Dict())
        options = parse_capacity_analysis_options(options_raw)
        
        capacity_start_time = time()
        
        # Dispatch based on uncertainty mode
        if uncertainty_mode == "interval" || data_type_in_file == "Interval"
            # INTERVAL MODE  
            result, validation = handle_interval_capacity_analysis_impl(
                topology, node_caps_raw, edge_caps_raw, source_rates_raw, targets, options
            )
            response = serialize_interval_capacity_result(result, (worst=validation.worst_case_validation, best=validation.best_case_validation))
        else
            # DETERMINISTIC MODE (default)
            result, validation = handle_deterministic_capacity_analysis_impl(
                topology, node_caps_raw, edge_caps_raw, source_rates_raw, targets, options
            )
            response = serialize_deterministic_capacity_result(result, validation)
        end
        
        capacity_computation_time = time() - capacity_start_time
        
        # Add metadata
        response["success"] = true
        response["message"] = "Capacity analysis completed"
        response["edges_file_path"] = edges_file_path
        response["capacities_path"] = capacities_path
        response["uncertainty_mode"] = uncertainty_mode
        response["timestamp"] = Dates.now()
        response["computation_time_ms"] = capacity_computation_time * 1000
        
        return HTTP.Response(200, cors_headers, JSON.json(response))
        
    catch e
        println("Capacity analysis error: ", e)
        println(stacktrace(catch_backtrace()))
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Capacity analysis failed"
        )))
    end
end

function handle_cpm_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        cpm_path = get(request_data, "cpmPath", "")
        
        if isempty(network_path) || isempty(cpm_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path and CPM path required"
            )))
        end
        
        # Determine edges file path
        if isempty(edges_file_path)
            # Look for .EDGES files in the network path
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    # Use Julia's built-in joinpath with normalization
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Load CPM data - use Julia's built-in joinpath with normalization
        normalized_network_path = replace(network_path, "\\" => "/")
        normalized_cpm_path = replace(cpm_path, "\\" => "/")
        full_cpm_path = joinpath(normalized_network_path, normalized_cpm_path)
        full_cpm_path = replace(full_cpm_path, "\\" => "/")
        if !isfile(full_cpm_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "CPM file not found"
            )))
        end
        
        cpm_data = JSON.parsefile(full_cpm_path)
        time_analysis = cpm_data["time_analysis"]
        cost_analysis = cpm_data["cost_analysis"]

        # Detect data type from JSON
        cpm_data_type = get(cpm_data, "data_type", "Float64")
        T = cpm_data_type == "Interval" ? Interval : Float64
        initial = zero(T)

        # Convert time analysis data
        node_durations_raw = time_analysis["node_durations"]
        edge_delays_raw = time_analysis["edge_delays"]

        node_durations = Dict{Int64,T}()
        for (k, v) in node_durations_raw
            node_durations[parse(Int64, k)] = parse_typed_value(v, T)
        end

        edge_delays = Dict{Tuple{Int64,Int64},T}()
        for (k, v) in edge_delays_raw
            cleaned_key = replace(k, "(" => "", ")" => "")
            parts = split(cleaned_key, ",")
            edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
            edge_delays[edge_key] = parse_typed_value(v, T)
        end

        # Convert cost analysis data
        node_costs_raw = cost_analysis["node_costs"]
        edge_costs_raw = cost_analysis["edge_costs"]

        node_costs = Dict{Int64,T}()
        for (k, v) in node_costs_raw
            node_costs[parse(Int64, k)] = parse_typed_value(v, T)
        end

        edge_costs = Dict{Tuple{Int64,Int64},T}()
        for (k, v) in edge_costs_raw
            cleaned_key = replace(k, "(" => "", ")" => "")
            parts = split(cleaned_key, ",")
            edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
            edge_costs[edge_key] = parse_typed_value(v, T)
        end

        # Run CPM analysis
        cpm_start_time = time()

        # Time-based critical path analysis (forward pass)
        time_params = CriticalPathParameters(
            node_durations, edge_delays, initial,
            max_combination, additive_propagation, additive_propagation
        )
        time_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, time_params)

        # Time backward pass
        time_extended = backward_pass_analysis(time_result, iteration_sets, outgoing_index, time_params)

        # Cost-based critical path analysis (forward pass)
        cost_params = CriticalPathParameters(
            node_costs, edge_costs, initial,
            max_combination, additive_propagation, additive_propagation
        )
        cost_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, cost_params)

        # Cost backward pass
        cost_extended = backward_pass_analysis(cost_result, iteration_sets, outgoing_index, cost_params)

        cpm_computation_time = time() - cpm_start_time

        # Compute near-critical nodes (slack > 0 but < 10% of critical path duration)
        time_near_critical_threshold = T == Float64 ? time_result.critical_value * 0.1 : 0.0
        time_near_critical = if T == Float64
            [k for (k, v) in time_extended.total_slack if v > 0 && v < time_near_critical_threshold]
        else
            Int64[]
        end

        result_data = Dict(
            "computation_time" => cpm_computation_time,
            "time_result" => Dict(
                "critical_value" => convert_pbox_values(time_result.critical_value),
                "critical_nodes" => collect(time_result.critical_nodes),
                "near_critical_nodes" => time_near_critical,
                "near_critical_count" => length(time_near_critical),
                "node_values" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_result.node_values),
                "early_start" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_extended.early_start),
                "late_finish" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_extended.late_finish),
                "late_start" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_extended.late_start),
                "total_slack" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_extended.total_slack)
            ),
            "cost_result" => Dict(
                "critical_value" => convert_pbox_values(cost_result.critical_value),
                "critical_nodes" => collect(cost_result.critical_nodes),
                "node_values" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_result.node_values),
                "early_start" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_extended.early_start),
                "late_finish" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_extended.late_finish),
                "late_start" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_extended.late_start),
                "total_slack" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_extended.total_slack)
            ),
            "input_data" => Dict(
                "node_durations" => Dict(string(k) => convert_pbox_values(v) for (k, v) in node_durations),
                "edge_delays" => Dict(string(k) => convert_pbox_values(v) for (k, v) in edge_delays),
                "node_costs" => Dict(string(k) => convert_pbox_values(v) for (k, v) in node_costs),
                "edge_costs" => Dict(string(k) => convert_pbox_values(v) for (k, v) in edge_costs)
            ),
            "node_durations_count" => length(node_durations),
            "edge_delays_count" => length(edge_delays),
            "node_costs_count" => length(node_costs),
            "edge_costs_count" => length(edge_costs),
            "input_files" => Dict("cpm_path" => cpm_path)
        )
        
        result = Dict(
            "success" => true,
            "message" => "CPM analysis completed",
            "edges_file_path" => edges_file_path,
            "cpm_path" => cpm_path,
            "timestamp" => Dates.now(),
            "cpm_result" => result_data
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("CPM analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "CPM analysis failed"
        )))
    end
end

# HTTP request handlers
function handle_upload(req::HTTP.Request)
    # Define CORS headers outside try block for catch access
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        # Generate unique upload session ID
        upload_id = string(uuid4())
        upload_path_raw = joinpath(UPLOAD_DIR, upload_id)
        # Normalize path separators to prevent mixed separator issues
        upload_path = normalize_path_separators(upload_path_raw)
        
        # Create upload directory using the raw path (mkpath expects OS-native separators)
        mkpath(upload_path_raw)
        
        # Parse multipart form data
        content_type = HTTP.header(req, "Content-Type")
        if !startswith(content_type, "multipart/form-data")
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Expected multipart/form-data"
            )))
        end
        
        # Extract boundary from content-type
        boundary_match = match(r"boundary=([^;]+)", content_type)
        if boundary_match === nothing
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Missing boundary in multipart data"
            )))
        end
        
        boundary = String(boundary_match.captures[1])
        body_str = String(req.body)
        
        # Parse multipart data
        uploaded_files = parse_multipart_data(body_str, boundary, upload_path)
        
        if isempty(uploaded_files)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "No files uploaded"
            )))
        end
        
        # Find .EDGES files to identify networks
        edges_files = filter(f -> endswith(f, ".EDGES"), uploaded_files)
        
        println("Upload successful: $(length(uploaded_files)) files uploaded to $upload_path")
        println("Found $(length(edges_files)) .EDGES files")
        
        headers = [
            "Access-Control-Allow-Origin" => "*",
            "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" => "Content-Type, Authorization",
            "Content-Type" => "application/json"
        ]
        
        # Find the network directory (where the .EDGES file is located)
        network_path = upload_path
        if !isempty(edges_files)
            # Get the directory containing the first edges file - use Julia's built-in joinpath with normalization
            edges_file_path = edges_files[1]
            normalized_upload_path = replace(upload_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            full_edges_path = joinpath(normalized_upload_path, normalized_edges_file_path)
            full_edges_path = replace(full_edges_path, "\\" => "/")
            network_path = dirname(full_edges_path)
        end
        
        network_name = derive_network_name(uploaded_files, edges_files, network_path)

        session_metadata = Dict(
            "session_id" => upload_id,
            "upload_id" => upload_id,
            "network_name" => network_name,
            "network_path" => network_path,
            "uploaded_files" => uploaded_files,
            "edges_files" => edges_files,
            "created_at" => string(Dates.now()),
            "updated_at" => string(Dates.now()),
            "network_data" => nothing,
            "analysis_results" => nothing,
            "analysis_history" => Any[],
            "parsed_data" => nothing,
            "file_manager_state" => nothing
        )
        write_session_metadata(upload_id, session_metadata)

        response_data = Dict(
            "success" => true,
            "message" => "Files uploaded successfully",
            "network_path" => network_path,
            "network_name" => network_name,
            "upload_id" => upload_id,
            "files_count" => length(uploaded_files),
            "uploaded_files" => uploaded_files,
            "edges_files" => edges_files
        )
        
        println("Returning upload response: ", JSON.json(response_data))
        
        return HTTP.Response(200, headers, JSON.json(response_data))
        
    catch e
        println("Upload error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Upload failed due to server error"
        )))
    end
end


function handle_cors(req::HTTP.Request)
    headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization"
    ]
    
    if req.method == "OPTIONS"
        return HTTP.Response(200, headers)
    end
    
    return nothing
end

# Main server function
function start_server()
    setup_server()
    
    # Define routes
    router = HTTP.Router()
    
    # Add CORS middleware
    HTTP.register!(router, "OPTIONS", "/*", handle_cors)
    
    # API routes
    HTTP.register!(router, "POST", "/upload", handle_upload)
    HTTP.register!(router, "GET", "/sessions", handle_sessions_list)
    HTTP.register!(router, "GET", "/sessions/*", handle_session_item)
    HTTP.register!(router, "PUT", "/sessions/*", handle_session_item)
    HTTP.register!(router, "DELETE", "/sessions/*", handle_session_item)
    # File serving endpoint for frontend data parsing
    HTTP.register!(router, "GET", "/files/*", handle_file_request)
    # Documentation serving endpoints
    HTTP.register!(router, "GET", "/docs-list", handle_docs_list)
    HTTP.register!(router, "GET", "/docs/*", handle_docs_request)
    # Individual Analysis Endpoints
    HTTP.register!(router, "POST", "/network-structure", handle_network_structure)
    HTTP.register!(router, "POST", "/diamond-analysis", handle_diamond_analysis)
    HTTP.register!(router, "POST", "/diamond-subgraph-analysis", handle_diamond_subgraph_analysis)
    HTTP.register!(router, "POST", "/reachability-analysis", handle_reachability_analysis)
    HTTP.register!(router, "POST", "/capacity-analysis", handle_capacity_analysis)
    HTTP.register!(router, "POST", "/cpm-analysis", handle_cpm_analysis)
    
    # Health check
    HTTP.register!(router, "GET", "/health", req -> HTTP.Response(200, [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ], JSON.json(Dict("status" => "healthy"))))
    
    # Start server
    println("Starting flexible multi-scenario backend server...")
    HTTP.serve(router, "0.0.0.0", PORT)
end

# Export main functions
export start_server

# Start server if run directly
 start_server()
 
 