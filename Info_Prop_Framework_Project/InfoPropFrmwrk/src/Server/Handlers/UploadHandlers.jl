module UploadHandlers

using HTTP
using JSON
using Dates
using UUIDs
using ..ServerCommon

function handle_upload(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, POST, OPTIONS")

    try
        upload_id = string(uuid4())
        upload_path_raw = joinpath(ServerCommon.UPLOAD_DIR, upload_id)
        upload_path = ServerCommon.normalize_path_separators(upload_path_raw)
        mkpath(upload_path_raw)

        content_type = something(HTTP.header(req, "Content-Type"), "")
        if isempty(content_type)
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Missing Content-Type header")))
        end

        if !startswith(lowercase(content_type), "multipart/form-data")
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Expected multipart/form-data")))
        end

        boundary_match = match(r"boundary=\"?([^\";]+)\"?", content_type)
        if boundary_match === nothing
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Missing boundary in multipart data")))
        end

        boundary = strip(String(boundary_match.captures[1]))
        body_str = try
            String(req.body)
        catch
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Upload payload encoding is invalid")))
        end

        uploaded_files = ServerCommon.parse_multipart_data(body_str, boundary, upload_path)

        if isempty(uploaded_files)
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "No files uploaded")))
        end

        edges_files = filter(f -> endswith(lowercase(f), ".edges"), uploaded_files)

        network_path = upload_path
        if !isempty(edges_files)
            full_edges_path = ServerCommon.safe_joinpath(upload_path, edges_files[1])
            network_path = dirname(full_edges_path)
        end

        network_name = ServerCommon.derive_network_name(uploaded_files, edges_files, network_path)
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
            "file_manager_state" => nothing,
        )
        ServerCommon.write_session_metadata(upload_id, session_metadata)

        response_data = Dict(
            "success" => true,
            "message" => "Files uploaded successfully",
            "network_path" => network_path,
            "network_name" => network_name,
            "upload_id" => upload_id,
            "files_count" => length(uploaded_files),
            "uploaded_files" => uploaded_files,
            "edges_files" => edges_files,
        )

        return HTTP.Response(200, headers, JSON.json(response_data))
    catch e
        return ServerCommon.error_response(req, e, "Upload failed due to server error"; headers=headers)
    end
end

function handle_sessions_list(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, PUT, DELETE, OPTIONS")

    try
        if !isdir(ServerCommon.UPLOAD_DIR)
            return HTTP.Response(200, headers, JSON.json(Dict("success" => true, "sessions" => Any[])))
        end

        sessions = Any[]
        for entry in readdir(ServerCommon.UPLOAD_DIR)
            folder_path = joinpath(ServerCommon.UPLOAD_DIR, entry)
            !isdir(folder_path) && continue

            session_meta = ServerCommon.read_session_metadata(entry)
            session_meta === nothing && continue

            push!(sessions, Dict(
                "session_id" => get(session_meta, "session_id", entry),
                "upload_id" => get(session_meta, "upload_id", entry),
                "network_name" => get(session_meta, "network_name", "Network Upload"),
                "network_path" => get(session_meta, "network_path", ""),
                "timestamp" => get(session_meta, "updated_at", get(session_meta, "created_at", string(Dates.now()))),
                "has_analysis_results" => get(session_meta, "analysis_results", nothing) !== nothing,
            ))
        end

        sort!(sessions, by = s -> get(s, "timestamp", ""), rev = true)
        return HTTP.Response(200, headers, JSON.json(Dict("success" => true, "sessions" => sessions)))
    catch e
        return ServerCommon.error_response(req, e, "Failed to list sessions"; headers=headers)
    end
end

function handle_session_item(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, PUT, DELETE, OPTIONS")

    try
        uri = HTTP.URI(req.target)
        parts = split(uri.path, "/")
        if length(parts) < 3 || isempty(parts[3])
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Missing session id")))
        end

        session_id = parts[3]
        folder_path = joinpath(ServerCommon.UPLOAD_DIR, session_id)

        if req.method == "GET"
            session_meta = ServerCommon.read_session_metadata(session_id)
            if session_meta === nothing
                return HTTP.Response(404, headers, JSON.json(Dict("success" => false, "message" => "Session not found")))
            end
            return HTTP.Response(200, headers, JSON.json(Dict("success" => true, "session" => session_meta)))
        elseif req.method == "PUT"
            session_meta = ServerCommon.read_session_metadata(session_id)
            if session_meta === nothing
                return HTTP.Response(404, headers, JSON.json(Dict("success" => false, "message" => "Session not found")))
            end

            payload = JSON.parse(String(req.body))
            if haskey(payload, "fileManagerState") && !haskey(payload, "file_manager_state")
                payload["file_manager_state"] = payload["fileManagerState"]
            end

            for key in ["network_path", "network_name", "network_data", "analysis_results", "analysis_history", "parsed_data", "file_manager_state"]
                if haskey(payload, key)
                    if key == "file_manager_state" && payload[key] === nothing && get(session_meta, "file_manager_state", nothing) !== nothing
                        continue
                    end
                    session_meta[key] = payload[key]
                end
            end

            session_meta["updated_at"] = string(Dates.now())
            ServerCommon.write_session_metadata(session_id, session_meta)
            return HTTP.Response(200, headers, JSON.json(Dict("success" => true, "session" => session_meta)))
        elseif req.method == "DELETE"
            if isdir(folder_path)
                rm(folder_path; force=true, recursive=true)
            end
            return HTTP.Response(200, headers, JSON.json(Dict("success" => true, "message" => "Session deleted")))
        end

        return HTTP.Response(405, headers, JSON.json(Dict("success" => false, "message" => "Method not allowed")))
    catch e
        return ServerCommon.error_response(req, e, "Session operation failed"; headers=headers)
    end
end

function handle_file_request(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, OPTIONS")

    try
        uri = HTTP.URI(req.target)
        path_parts = split(uri.path, "/")

        if length(path_parts) < 4 || path_parts[2] != "files"
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Invalid file path format. Expected: /files/network_path/relative_file_path")))
        end

        network_path = path_parts[3]
        file_path = join(path_parts[4:end], "/")
        full_file_path = ServerCommon.safe_joinpath(network_path, file_path)

        if !isfile(full_file_path)
            return HTTP.Response(404, headers, JSON.json(Dict("success" => false, "message" => "File not found: $(full_file_path)")))
        end

        file_content = JSON.parsefile(full_file_path)
        return HTTP.Response(200, headers, JSON.json(file_content))
    catch e
        return ServerCommon.error_response(req, e, "Failed to serve file"; headers=headers)
    end
end

function register!(router::HTTP.Router)
    HTTP.register!(router, "POST", "/upload", handle_upload)
    HTTP.register!(router, "GET", "/sessions", handle_sessions_list)
    HTTP.register!(router, "GET", "/sessions/*", handle_session_item)
    HTTP.register!(router, "PUT", "/sessions/*", handle_session_item)
    HTTP.register!(router, "DELETE", "/sessions/*", handle_session_item)
    HTTP.register!(router, "GET", "/files/*", handle_file_request)
end

end # module UploadHandlers
