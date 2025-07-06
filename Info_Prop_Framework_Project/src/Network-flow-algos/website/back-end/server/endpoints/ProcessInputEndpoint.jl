"""
ProcessInputEndpoint.jl

Endpoint for processing input and returning network structure data.
Enhanced to support both edge list format and CSV adjacency matrix file uploads.
Maps to the required 'processinput' endpoint with backward compatibility.
"""
module ProcessInputEndpoint

using HTTP, JSON
include(joinpath(@__DIR__, "..", "services", "ValidationService.jl"))
include(joinpath(@__DIR__, "..", "services", "NetworkService.jl"))
include(joinpath(@__DIR__, "..", "services", "ResponseFormatter.jl"))
include(joinpath(@__DIR__, "..", "services", "InputProcessingIntegration.jl"))

using .ValidationService
using .NetworkService
using .ResponseFormatter
using .InputProcessingIntegration

export handle_process_input, handle_process_csv_content

"""
    handle_process_input(req::HTTP.Request) -> HTTP.Response

Handle POST /api/processinput endpoint.
Takes edge list and JSON probability data and returns complete network structure data:
- edges: Array of {source, destination} objects
- nodePriors: JSON object with node prior probabilities
- edgeProbabilities: JSON object with edge probabilities
Returns: edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities, fork_nodes, join_nodes, iteration_sets, ancestors, descendants
"""
function handle_process_input(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing input request...")
        
        # Debug: Log raw request body
        raw_body = String(req.body)
        println("📥 RAW REQUEST BODY (first 200 chars): $(raw_body[1:min(200, length(raw_body))])")
        println("📏 RAW REQUEST BODY LENGTH: $(length(raw_body))")
        
        # Parse request data
        request_data = JSON.parse(raw_body)
        
        # Validate request data
        validation_result = validate_request_data(request_data, "processinput")
        if !validation_result.is_valid
            error_response = Dict{String, Any}(
                "success" => false,
                "error" => "Validation failed",
                "validationErrors" => format_validation_errors(validation_result)
            )
            return HTTP.Response(400, 
                ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
                JSON.json(error_response)
            )
        end
        
        # Display warnings if any
        if !isempty(validation_result.warnings)
            for warning in validation_result.warnings
                println("⚠️ Warning: $warning")
            end
        end
        
        # Extract edge list and JSON data from Angular app format
        edges_raw = request_data["edges"]
        node_priors_wrapper = request_data["nodePriors"]
        edge_probs_wrapper = request_data["edgeProbabilities"]
        
        # Ensure edges is properly typed as Vector{Dict{String, Any}}
        edges = Vector{Dict{String, Any}}(edges_raw)
        
        # Pass the full wrapper objects that the NetworkService expects
        node_priors_json = Dict{String, Any}(node_priors_wrapper)
        edge_probs_json = Dict{String, Any}(edge_probs_wrapper)
        
        println("🔍 ANGULAR APP DATA FORMAT RECEIVED:")
        println("  - Edges: $(length(edges)) edge objects")
        println("  - Node priors wrapper: $(keys(node_priors_wrapper))")
        println("  - Edge probs wrapper: $(keys(edge_probs_wrapper))")
        println("  - Sample edge: $(edges[1])")
        println("  - Node priors inner dict: $(length(node_priors_json)) nodes")
        println("  - Edge probs inner dict: $(length(edge_probs_json)) edges")
        
        # Perform network analysis using new JSON-direct processing
        network_result = NetworkService.perform_network_analysis(edges, node_priors_json, edge_probs_json, false)  # false = no diamond processing
        
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
        
        # High degree nodes analysis
        high_indegree_nodes = []
        high_outdegree_nodes = []
        for node in all_nodes
            indegree = haskey(network_result.incoming_index, node) ? length(network_result.incoming_index[node]) : 0
            outdegree = haskey(network_result.outgoing_index, node) ? length(network_result.outgoing_index[node]) : 0
            
            if indegree >= 3
                push!(high_indegree_nodes, Dict("node" => node, "degree" => indegree))
            end
            if outdegree >= 3
                push!(high_outdegree_nodes, Dict("node" => node, "degree" => outdegree))
            end
        end
        
        sort!(high_indegree_nodes, by = x -> x["degree"], rev = true)
        sort!(high_outdegree_nodes, by = x -> x["degree"], rev = true)
        
        # Node type distribution
        node_type_counts = Dict(
            "source" => length(network_result.source_nodes),
            "sink" => length(sink_nodes),
            "fork" => length(network_result.fork_nodes),
            "join" => length(network_result.join_nodes),
            "isolated" => length(isolated_nodes),
            "regular" => length(all_nodes) - length(network_result.source_nodes) - length(sink_nodes) - 
                        length(network_result.fork_nodes) - length(network_result.join_nodes) - length(isolated_nodes)
        )
        
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
                "nodeTypes" => node_type_counts,
                "structural" => Dict{String, Any}(
                    "isolatedNodes" => length(isolated_nodes),
                    "highDegreeNodes" => length(high_indegree_nodes) + length(high_outdegree_nodes),
                    "iterationSets" => length(network_result.iteration_sets)
                ),
                "connectivity" => Dict{String, Any}(
                    "stronglyConnectedComponents" => 1,  # Simplified for DAGs
                    "avgPathLength" => network_data["maxIterationDepth"] > 0 ? network_data["maxIterationDepth"] / 2.0 : 0.0,
                    "hasIsolatedNodes" => length(isolated_nodes) > 0
                )
            ),
            "highDegreeNodes" => Dict{String, Any}(
                "highIndegree" => high_indegree_nodes,
                "highOutdegree" => high_outdegree_nodes
            ),
            "summary" => Dict{String, Any}(
                "analysisType" => "Network Structure Processing",
                "nodes" => length(all_nodes),
                "edges" => length(network_result.edgelist),
                "sources" => length(network_result.source_nodes),
                "sinks" => length(sink_nodes),
                "forks" => length(network_result.fork_nodes),
                "joins" => length(network_result.join_nodes),
                "density" => round(network_data["graphDensity"], digits=4),
                "maxDepth" => network_data["maxIterationDepth"],
                "processingTime" => "< 1s"  # Placeholder for actual timing
            )
        )
        
        # Format final response
        response_json = format_success_response(response_data, "processinput")
        
        println("✅ Process input complete: $(length(all_nodes)) nodes, $(length(network_result.edgelist)) edges processed")
        
        return HTTP.Response(200, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            response_json
        )
        
    catch e
        println("❌ Process input error: $e")
        error_response = format_error_response("Process input failed: $(string(e))", 500)
        return HTTP.Response(500, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            error_response
        )
    end
end

"""
    handle_process_csv_content(req::HTTP.Request) -> HTTP.Response

Handle CSV content processing without session complexity.
Simple CSV adjacency matrix processing for direct content input.

Expected request body:
{
    "csvContent": "0,1,0\n1,0,1\n0,1,0"
}
"""
function handle_process_csv_content(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing CSV content...")
        
        # Parse request data
        request_data = JSON.parse(String(req.body))
        
        # Validate required csvContent field
        if !haskey(request_data, "csvContent")
            return format_error_response("Missing required field: csvContent", 400, "process_csv")
        end
        
        csv_content = request_data["csvContent"]
        if !isa(csv_content, String) || isempty(strip(csv_content))
            return format_error_response("csvContent must be a non-empty string", 400, "process_csv")
        end
        
        println("📥 Processing CSV content ($(length(csv_content)) characters)")
        
        # Validate CSV content
        csv_validation = validate_csv_adjacency_matrix(csv_content)
        if !csv_validation.is_valid
            error_response = Dict{String, Any}(
                "success" => false,
                "error" => "CSV validation failed",
                "validationErrors" => [Dict("field" => error.field, "message" => error.message, "code" => error.error_code) for error in csv_validation.errors],
                "warnings" => csv_validation.warnings
            )
            return format_error_response(JSON.json(error_response), 400, "process_csv")
        end
        
        # Perform simple CSV-based network analysis
        network_result = perform_file_based_analysis(csv_content, nothing, nothing, "float64")
        
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
        
        # Create response
        response_data = Dict{String, Any}(
            "networkStructure" => network_data,
            "statistics" => Dict{String, Any}(
                "totalNodes" => length(all_nodes),
                "totalEdges" => length(network_result.edgelist),
                "sourceNodes" => length(network_result.source_nodes),
                "forkNodes" => length(network_result.fork_nodes),
                "joinNodes" => length(network_result.join_nodes)
            )
        )
        
        println("✅ CSV processing complete: $(length(all_nodes)) nodes, $(length(network_result.edgelist)) edges")
        
        return format_success_response(response_data, "process_csv")
        
    catch e
        println("❌ Error in CSV processing: $e")
        return format_error_response("CSV processing failed: $(string(e))", 500, "process_csv")
    end
end

end # module ProcessInputEndpoint