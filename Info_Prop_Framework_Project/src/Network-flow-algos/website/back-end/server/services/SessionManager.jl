"""
SessionManager.jl

Session management service for tracking individual file uploads in the three-file network format.
Handles temporary file storage and session state management for HTTP file uploads.
"""
module SessionManager

using JSON, UUIDs, Dates

export create_session, get_session, update_session, delete_session, cleanup_expired_sessions,
       SessionData, FileUploadStatus, get_session_status, is_session_complete,
       detect_probability_type

# Session data structure
mutable struct SessionData
    session_id::String
    created_at::DateTime
    last_updated::DateTime
    network_structure_file::Union{String, Nothing}
    node_priors_file::Union{String, Nothing}
    link_probabilities_file::Union{String, Nothing}
    network_structure_content::Union{String, Nothing}
    node_priors_content::Union{String, Nothing}
    link_probabilities_content::Union{String, Nothing}
    probability_type::Union{String, Nothing}
    temp_dir::String
end

# File upload status
struct FileUploadStatus
    network_structure::Bool
    node_priors::Bool
    link_probabilities::Bool
    complete::Bool
end

# Global session storage
const SESSIONS = Dict{String, SessionData}()
const SESSION_TIMEOUT_HOURS = 2

"""
    create_session() -> String

Create a new upload session and return the session ID.
"""
function create_session()::String
    session_id = string(uuid4())
    temp_dir = mktempdir(prefix="network_session_")
    
    session_data = SessionData(
        session_id,
        now(),
        now(),
        nothing, nothing, nothing,  # file paths
        nothing, nothing, nothing,  # file contents
        nothing,  # probability type
        temp_dir
    )
    
    SESSIONS[session_id] = session_data
    
    println("📝 Created new session: $session_id")
    println("   Temp directory: $temp_dir")
    
    return session_id
end

"""
    get_session(session_id::String) -> Union{SessionData, Nothing}

Retrieve session data by ID.
"""
function get_session(session_id::String)::Union{SessionData, Nothing}
    return get(SESSIONS, session_id, nothing)
end

"""
    update_session(session_id::String, file_type::String, filename::String, content::String) -> Bool

Update session with uploaded file data.
"""
function update_session(session_id::String, file_type::String, filename::String, content::String)::Bool
    session = get_session(session_id)
    if session === nothing
        println("❌ Session not found: $session_id")
        return false
    end
    
    # Save file to temporary directory
    file_path = joinpath(session.temp_dir, filename)
    
    try
        write(file_path, content)
        
        # Update session data based on file type
        if file_type == "network-structure"
            session.network_structure_file = file_path
            session.network_structure_content = content
        elseif file_type == "node-priors"
            session.node_priors_file = file_path
            session.node_priors_content = content
            # Try to detect probability type from JSON content
            try
                json_data = JSON.parse(content)
                session.probability_type = detect_probability_type(json_data)
            catch e
                println("⚠️ Could not detect probability type: $e")
            end
        elseif file_type == "link-probabilities"
            session.link_probabilities_file = file_path
            session.link_probabilities_content = content
        else
            println("❌ Unknown file type: $file_type")
            return false
        end
        
        session.last_updated = now()
        
        println("✅ Updated session $session_id with $file_type file: $filename")
        return true
        
    catch e
        println("❌ Error saving file for session $session_id: $e")
        return false
    end
end

"""
    get_session_status(session_id::String) -> Union{FileUploadStatus, Nothing}

Get the upload status for a session.
"""
function get_session_status(session_id::String)::Union{FileUploadStatus, Nothing}
    session = get_session(session_id)
    if session === nothing
        return nothing
    end
    
    network_structure = session.network_structure_file !== nothing
    node_priors = session.node_priors_file !== nothing
    link_probabilities = session.link_probabilities_file !== nothing
    complete = network_structure && node_priors && link_probabilities
    
    return FileUploadStatus(network_structure, node_priors, link_probabilities, complete)
end

"""
    is_session_complete(session_id::String) -> Bool

Check if all three files have been uploaded for a session.
"""
function is_session_complete(session_id::String)::Bool
    status = get_session_status(session_id)
    return status !== nothing && status.complete
end

"""
    delete_session(session_id::String) -> Bool

Delete a session and clean up its temporary files.
"""
function delete_session(session_id::String)::Bool
    session = get_session(session_id)
    if session === nothing
        return false
    end
    
    try
        # Clean up temporary directory with Windows-compatible approach
        if isdir(session.temp_dir)
            # First, try to remove individual files
            try
                for file in readdir(session.temp_dir)
                    file_path = joinpath(session.temp_dir, file)
                    if isfile(file_path)
                        rm(file_path, force=true)
                    end
                end
                # Then remove the directory
                rm(session.temp_dir, recursive=true, force=true)
            catch dir_error
                # If directory removal fails, try alternative approach
                println("⚠️ Standard cleanup failed, trying alternative approach: $dir_error")
                try
                    # Use system command as fallback for Windows
                    if Sys.iswindows()
                        run(`cmd /c rmdir /s /q $(session.temp_dir)`)
                    else
                        run(`rm -rf $(session.temp_dir)`)
                    end
                catch sys_error
                    println("⚠️ System cleanup also failed: $sys_error")
                    # Continue anyway - session will be removed from memory
                end
            end
        end
        
        # Remove from sessions (always do this even if file cleanup fails)
        delete!(SESSIONS, session_id)
        
        println("🗑️ Deleted session: $session_id")
        return true
        
    catch e
        println("❌ Error deleting session $session_id: $e")
        # Still remove from memory even if file cleanup failed
        delete!(SESSIONS, session_id)
        return false
    end
end

"""
    cleanup_expired_sessions()

Clean up sessions that have expired.
"""
function cleanup_expired_sessions()
    current_time = now()
    expired_sessions = String[]
    
    for (session_id, session) in SESSIONS
        if current_time - session.last_updated > Hour(SESSION_TIMEOUT_HOURS)
            push!(expired_sessions, session_id)
        end
    end
    
    for session_id in expired_sessions
        delete_session(session_id)
    end
    
    if !isempty(expired_sessions)
        println("🧹 Cleaned up $(length(expired_sessions)) expired sessions")
    end
end

"""
    detect_probability_type(json_data::Dict) -> String

Detect the probability type from JSON data structure.
"""
function detect_probability_type(json_data::Dict)::String
    # Sample a few values to determine type
    sample_values = collect(values(json_data))[1:min(3, length(json_data))]
    
    for value in sample_values
        if isa(value, Dict)
            if haskey(value, "type")
                if value["type"] == "pbox"
                    return "pbox"
                elseif value["type"] == "interval"
                    return "interval"
                end
            elseif haskey(value, "lower") && haskey(value, "upper")
                return "interval"
            end
        elseif isa(value, Number)
            return "float"
        end
    end
    
    return "float"  # Default fallback
end

end # module SessionManager