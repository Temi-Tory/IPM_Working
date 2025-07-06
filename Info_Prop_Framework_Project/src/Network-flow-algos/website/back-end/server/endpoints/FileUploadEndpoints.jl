"""
FileUploadEndpoints.jl

Individual file upload endpoints for the three-file network format.
Each endpoint handles a single file upload via HTTP multipart/form-data.
"""
module FileUploadEndpoints

using HTTP, JSON, Dates
# SessionManager and ResponseFormatter are now included at the router level
# Access them through the parent module
using ..SessionManager
using ..ResponseFormatter

export handle_upload_network_structure, handle_upload_node_priors, handle_upload_link_probabilities,
       handle_session_status, handle_process_complete_network, parse_multipart_form_data

"""
    parse_multipart_form_data(req::HTTP.Request) -> Dict{String, Any}

Parse multipart/form-data from HTTP request.
Returns dict with "file_content", "filename", "session_id" fields.
"""
function parse_multipart_form_data(req::HTTP.Request)::Dict{String, Any}
    # Get content type header
    content_type = ""
    for (name, value) in req.headers
        if lowercase(name) == "content-type"
            content_type = value
            break
        end
    end
    
    if !startswith(content_type, "multipart/form-data")
        throw(ArgumentError("Request must be multipart/form-data, got: $content_type"))
    end
    
    # Extract boundary
    boundary_match = match(r"boundary=([^;]+)", content_type)
    if boundary_match === nothing
        throw(ArgumentError("No boundary found in content-type header"))
    end
    boundary = boundary_match.captures[1]
    
    # Parse multipart data
    body = String(req.body)
    parts = split(body, "--$boundary")
    
    result = Dict{String, Any}()
    
    for part in parts
        part = strip(part)
        if isempty(part) || part == "--"
            continue
        end
        
        # Split headers and content
        if occursin("\r\n\r\n", part)
            header_content = split(part, "\r\n\r\n", limit=2)
        elseif occursin("\n\n", part)
            header_content = split(part, "\n\n", limit=2)
        else
            continue
        end
        
        if length(header_content) < 2
            continue
        end
        
        headers = header_content[1]
        content = header_content[2]
        
        # Parse Content-Disposition header
        if occursin("Content-Disposition:", headers)
            # Extract field name
            name_match = match(r"name=\"([^\"]+)\"", headers)
            if name_match !== nothing
                field_name = name_match.captures[1]
                
                if field_name == "file"
                    # Extract filename if present
                    filename_match = match(r"filename=\"([^\"]+)\"", headers)
                    if filename_match !== nothing
                        result["filename"] = filename_match.captures[1]
                    end
                    result["file_content"] = content
                elseif field_name == "filename"
                    result["filename"] = strip(content)
                elseif field_name == "file_content"
                    result["file_content"] = content
                elseif field_name == "session_id"
                    result["session_id"] = strip(content)
                end
            end
        end
    end
    
    return result
end

"""
    handle_upload_network_structure(req::HTTP.Request) -> HTTP.Response

Handle POST /api/upload/network-structure endpoint.
Accepts .EDGE/.edge file upload via multipart/form-data.
"""
function handle_upload_network_structure(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing network structure file upload...")
        
        # Parse multipart form data
        form_data = parse_multipart_form_data(req)
        
        
        # Validate required fields
        if !haskey(form_data, "file_content")
            return ResponseFormatter.format_error_response("No file uploaded", 400)
        end
        
        if !haskey(form_data, "session_id")
            return ResponseFormatter.format_error_response("Missing session_id", 400)
        end
        
        session_id = String(form_data["session_id"])  # Convert to String to handle SubString
        file_content = String(form_data["file_content"])  # Convert to String to handle SubString
        filename = String(get(form_data, "filename", "network_structure.edge"))  # Convert to String
        
        
        # Validate file extension
        if !endswith(lowercase(filename), ".edge") && !endswith(lowercase(filename), ".EDGE")
            return ResponseFormatter.format_error_response("File must have .edge or .EDGE extension", 400)
        end
        
        # Validate session exists
        session_data = SessionManager.get_session(session_id)
        if session_data === nothing
            println("❌ DEBUG: Session validation failed for '$session_id'")
            return ResponseFormatter.format_error_response("Invalid session_id", 400)
        else
            println("✅ DEBUG: Session found for '$session_id'")
        end
        
        # Update session with file
        success = SessionManager.update_session(session_id, "network-structure", filename, file_content)
        
        if !success
            return ResponseFormatter.format_error_response("Failed to save network structure file", 500)
        end
        
        # Get updated session status
        status = SessionManager.get_session_status(session_id)
        
        response_data = Dict{String, Any}(
            "message" => "Network structure file uploaded successfully",
            "filename" => filename,
            "session_id" => session_id,
            "session_status" => Dict(
                "network_structure" => status.network_structure,
                "node_priors" => status.node_priors,
                "link_probabilities" => status.link_probabilities,
                "complete" => status.complete
            )
        )
        
        println("✅ Network structure file uploaded: $filename")
        
        return format_success_response(response_data, "upload_network_structure")
        
    catch e
        println("❌ Error in network structure upload: $e")
        return ResponseFormatter.format_error_response("Network structure upload failed: $(string(e))", 500)
    end
end

"""
    handle_upload_node_priors(req::HTTP.Request) -> HTTP.Response

Handle POST /api/upload/node-priors endpoint.
Accepts nodepriors.json file upload via multipart/form-data.
"""
function handle_upload_node_priors(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing node priors file upload...")
        
        # Parse multipart form data
        form_data = parse_multipart_form_data(req)
        
        
        # Validate required fields
        if !haskey(form_data, "file_content")
            return ResponseFormatter.format_error_response("No file uploaded", 400)
        end
        
        if !haskey(form_data, "session_id")
            return ResponseFormatter.format_error_response("Missing session_id", 400)
        end
        
        session_id = String(form_data["session_id"])
        file_content = String(form_data["file_content"])  # Convert to String to handle SubString
        filename = String(get(form_data, "filename", "nodepriors.json"))  # Convert to String
        
        
        # Validate file extension
        if !endswith(lowercase(filename), ".json")
            return ResponseFormatter.format_error_response("File must have .json extension", 400)
        end
        
        # Validate JSON content
        try
            JSON.parse(file_content)
        catch e
            return ResponseFormatter.format_error_response("Invalid JSON content: $(string(e))", 400)
        end
        
        # Validate session exists
        session_data = SessionManager.get_session(session_id)
        if session_data === nothing
            return ResponseFormatter.format_error_response("Invalid session_id", 400)
        end
        
        # Update session with file
        success = SessionManager.update_session(session_id, "node-priors", filename, file_content)
        
        if !success
            return ResponseFormatter.format_error_response("Failed to save node priors file", 500)
        end
        
        # Get updated session status
        status = SessionManager.get_session_status(session_id)
        session = SessionManager.get_session(session_id)
        
        response_data = Dict{String, Any}(
            "message" => "Node priors file uploaded successfully",
            "filename" => filename,
            "session_id" => session_id,
            "probability_type" => session.probability_type,
            "session_status" => Dict(
                "network_structure" => status.network_structure,
                "node_priors" => status.node_priors,
                "link_probabilities" => status.link_probabilities,
                "complete" => status.complete
            )
        )
        
        println("✅ Node priors file uploaded: $filename (type: $(session.probability_type))")
        
        return format_success_response(response_data, "upload_node_priors")
        
    catch e
        println("❌ Error in node priors upload: $e")
        return ResponseFormatter.format_error_response("Node priors upload failed: $(string(e))", 500)
    end
end

"""
    handle_upload_link_probabilities(req::HTTP.Request) -> HTTP.Response

Handle POST /api/upload/link-probabilities endpoint.
Accepts linkprobabilities.json file upload via multipart/form-data.
"""
function handle_upload_link_probabilities(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing link probabilities file upload...")
        
        # Parse multipart form data
        form_data = parse_multipart_form_data(req)
        
        # Validate required fields
        if !haskey(form_data, "file_content")
            return ResponseFormatter.format_error_response("No file uploaded", 400)
        end
        
        if !haskey(form_data, "session_id")
            return ResponseFormatter.format_error_response("Missing session_id", 400)
        end
        
        session_id = String(form_data["session_id"])
        file_content = String(form_data["file_content"])  # Convert to String to handle SubString
        filename = String(get(form_data, "filename", "linkprobabilities.json"))  # Convert to String
        
        # Validate file extension
        if !endswith(lowercase(filename), ".json")
            return ResponseFormatter.format_error_response("File must have .json extension", 400)
        end
        
        # Validate JSON content
        try
            JSON.parse(file_content)
        catch e
            return ResponseFormatter.format_error_response("Invalid JSON content: $(string(e))", 400)
        end
        
        # Validate session exists
        if SessionManager.get_session(session_id) === nothing
            return ResponseFormatter.format_error_response("Invalid session_id", 400)
        end
        
        # Update session with file
        success = SessionManager.update_session(session_id, "link-probabilities", filename, file_content)
        
        if !success
            return ResponseFormatter.format_error_response("Failed to save link probabilities file", 500)
        end
        
        # Get updated session status
        status = SessionManager.get_session_status(session_id)
        
        response_data = Dict{String, Any}(
            "message" => "Link probabilities file uploaded successfully",
            "filename" => filename,
            "session_id" => session_id,
            "session_status" => Dict(
                "network_structure" => status.network_structure,
                "node_priors" => status.node_priors,
                "link_probabilities" => status.link_probabilities,
                "complete" => status.complete
            )
        )
        
        println("✅ Link probabilities file uploaded: $filename")
        
        return format_success_response(response_data, "upload_link_probabilities")
        
    catch e
        println("❌ Error in link probabilities upload: $e")
        return ResponseFormatter.format_error_response("Link probabilities upload failed: $(string(e))", 500)
    end
end

"""
    handle_session_status(req::HTTP.Request) -> HTTP.Response

Handle GET /api/upload/session-status endpoint.
Returns the current upload status for a session.
"""
function handle_session_status(req::HTTP.Request)::HTTP.Response
    try
        # Parse query parameters
        uri = HTTP.URI(req.target)
        query_params = HTTP.queryparams(uri)
        
        if !haskey(query_params, "session_id")
            return ResponseFormatter.format_error_response("Missing session_id parameter", 400)
        end
        
        session_id = String(query_params["session_id"])
        
        # Get session status
        status = SessionManager.get_session_status(session_id)
        if status === nothing
            return ResponseFormatter.format_error_response("Session not found", 404)
        end
        
        session = SessionManager.get_session(session_id)
        
        response_data = Dict{String, Any}(
            "session_id" => session_id,
            "probability_type" => session.probability_type,
            "session_status" => Dict(
                "network_structure" => status.network_structure,
                "node_priors" => status.node_priors,
                "link_probabilities" => status.link_probabilities,
                "complete" => status.complete
            ),
            "created_at" => string(session.created_at),
            "last_updated" => string(session.last_updated)
        )
        
        return format_success_response(response_data, "session_status")
        
    catch e
        println("❌ Error in session status: $e")
        return ResponseFormatter.format_error_response("Session status failed: $(string(e))", 500)
    end
end

end # module FileUploadEndpoints