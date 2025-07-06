"""
CompleteNetworkEndpoint.jl

Endpoint for processing complete three-file networks after all files have been uploaded.
Uses InputProcessingModule's read_complete_network function.
"""
module CompleteNetworkEndpoint

using HTTP, JSON, Dates
include(joinpath(@__DIR__, "..", "services", "SessionManager.jl"))
include(joinpath(@__DIR__, "..", "services", "InputProcessingIntegration.jl"))
include(joinpath(@__DIR__, "..", "services", "ResponseFormatter.jl"))
include(joinpath(@__DIR__, "..", "services", "NetworkService.jl"))

using .SessionManager
using .InputProcessingIntegration
using .ResponseFormatter
using .NetworkService

export handle_process_complete_network, handle_create_session

"""
    handle_create_session(req::HTTP.Request) -> HTTP.Response

Handle POST /api/upload/create-session endpoint.
Creates a new upload session and returns the session ID.
"""
function handle_create_session(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Creating new upload session...")
        
        # Clean up expired sessions first
        cleanup_expired_sessions()
        
        # Create new session
        session_id = create_session()
        
        response_data = Dict{String, Any}(
            "message" => "Upload session created successfully",
            "session_id" => session_id,
            "session_status" => Dict(
                "network_structure" => false,
                "node_priors" => false,
                "link_probabilities" => false,
                "complete" => false
            )
        )
        
        println("✅ Created session: $session_id")
        
        return format_success_response(response_data, "create_session")
        
    catch e
        println("❌ Error creating session: $e")
        return ResponseFormatter.format_error_response("Session creation failed: $(string(e))", 500)
    end
end

"""
    handle_process_complete_network(req::HTTP.Request) -> HTTP.Response

Handle POST /api/process-complete-network endpoint.
Processes all three uploaded files together using InputProcessingModule.
"""
function handle_process_complete_network(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing complete three-file network...")
        
        # Parse request data
        request_data = JSON.parse(String(req.body))
        
        # Validate required session_id
        if !haskey(request_data, "session_id")
            return ResponseFormatter.format_error_response("Missing session_id", 400)
        end
        
        session_id = String(request_data["session_id"])
        
        # Validate session exists and is complete
        if !is_session_complete(session_id)
            status = SessionManager.get_session_status(session_id)
            if status === nothing
                return ResponseFormatter.format_error_response("Session not found", 404)
            else
                return ResponseFormatter.format_error_response("Session incomplete. Missing files: " *
                    join([
                        !status.network_structure ? "network_structure" : nothing,
                        !status.node_priors ? "node_priors" : nothing,
                        !status.link_probabilities ? "link_probabilities" : nothing
                    ] |> filter(x -> x !== nothing), ", "), 400)
            end
        end
        
        # Get session data
        session = SessionManager.get_session(session_id)
        
        println("📁 Processing files:")
        println("   - Network structure: $(session.network_structure_file)")
        println("   - Node priors: $(session.node_priors_file)")
        println("   - Link probabilities: $(session.link_probabilities_file)")
        println("   - Probability type: $(session.probability_type)")
        
        # Process the complete network using InputProcessingIntegration
        network_result = perform_complete_network_analysis(
            session.network_structure_file,
            session.node_priors_file,
            session.link_probabilities_file,
            session.probability_type
        )
        
        if !network_result.success
            return ResponseFormatter.format_error_response("Network processing failed: $(network_result.error_message)", 500)
        end
        
        # Format network data for response
        network_data = format_network_data(
            network_result.edgelist,
            network_result.outgoing_index,
            network_result.incoming_index,
            network_result.source_nodes,
            network_result.node_priors,
            network_result.edge_probabilities,
            network_result.fork_nodes,
            network_result.join_nodes,
            network_result.iteration_sets,
            network_result.ancestors,
            network_result.descendants
        )
        
        # Calculate network statistics
        all_nodes = union(keys(network_result.outgoing_index), keys(network_result.incoming_index))
        sink_nodes = [node for node in all_nodes if !haskey(network_result.outgoing_index, node) || isempty(network_result.outgoing_index[node])]
        isolated_nodes = [node for node in all_nodes if 
            (!haskey(network_result.outgoing_index, node) || isempty(network_result.outgoing_index[node])) &&
            (!haskey(network_result.incoming_index, node) || isempty(network_result.incoming_index[node]))]
        
        # Create comprehensive response data
        response_data = Dict{String, Any}(
            "networkData" => network_data,
            "statistics" => Dict{String, Any}(
                "basic" => Dict{String, Any}(
                    "nodes" => length(all_nodes),
                    "edges" => length(network_result.edgelist),
                    "density" => round(network_data["graphDensity"], digits=4),
                    "maxDepth" => network_data["maxIterationDepth"]
                ),
                "nodeTypes" => Dict{String, Any}(
                    "source" => length(network_result.source_nodes),
                    "sink" => length(sink_nodes),
                    "fork" => length(network_result.fork_nodes),
                    "join" => length(network_result.join_nodes),
                    "isolated" => length(isolated_nodes),
                    "regular" => length(all_nodes) - length(network_result.source_nodes) - length(sink_nodes) - 
                                length(network_result.fork_nodes) - length(network_result.join_nodes) - length(isolated_nodes)
                ),
                "structural" => Dict{String, Any}(
                    "isolatedNodes" => length(isolated_nodes),
                    "iterationSets" => length(network_result.iteration_sets)
                )
            ),
            "processingInfo" => Dict{String, Any}(
                "session_id" => session_id,
                "probability_type" => session.probability_type,
                "files_processed" => Dict{String, Any}(
                    "network_structure" => basename(session.network_structure_file),
                    "node_priors" => basename(session.node_priors_file),
                    "link_probabilities" => basename(session.link_probabilities_file)
                )
            ),
            "summary" => Dict{String, Any}(
                "analysisType" => "Complete Three-File Network Processing",
                "nodes" => length(all_nodes),
                "edges" => length(network_result.edgelist),
                "sources" => length(network_result.source_nodes),
                "sinks" => length(sink_nodes),
                "forks" => length(network_result.fork_nodes),
                "joins" => length(network_result.join_nodes),
                "density" => round(network_data["graphDensity"], digits=4),
                "maxDepth" => network_data["maxIterationDepth"],
                "probabilityType" => session.probability_type
            )
        )
        
        println("✅ Complete network processing successful:")
        println("   - Nodes: $(length(all_nodes))")
        println("   - Edges: $(length(network_result.edgelist))")
        println("   - Probability type: $(session.probability_type)")
        
        # Clean up session after successful processing
        delete_session(session_id)
        
        return format_success_response(response_data, "process_complete_network")
        
    catch e
        println("❌ Error in complete network processing: $e")
        return ResponseFormatter.format_error_response("Complete network processing failed: $(string(e))", 500)
    end
end

end # module CompleteNetworkEndpoint