"""
ProcessInputEndpoint.jl

Endpoint for processing CSV input and returning network structure data.
Maps to the required 'processinput' endpoint.
"""
module ProcessInputEndpoint

using HTTP, JSON
include(joinpath(@__DIR__, "..", "services", "ValidationService.jl"))
include(joinpath(@__DIR__, "..", "services", "NetworkService.jl"))
include(joinpath(@__DIR__, "..", "services", "ResponseFormatter.jl"))

using .ValidationService
using .NetworkService
using .ResponseFormatter

export handle_process_input

"""
    handle_process_input(req::HTTP.Request) -> HTTP.Response

Handle POST /api/processinput endpoint.
Takes CSV file content and returns complete network structure data:
- edgelist, outgoing_index, incoming_index, source_nodes
- node_priors, edge_probabilities, fork_nodes, join_nodes
- iteration_sets, ancestors, descendants
"""
function handle_process_input(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing input request...")
        
        # Parse request data
        request_data = JSON.parse(String(req.body))
        
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
        
        # Extract CSV content
        csv_content = request_data["csvContent"]
        
        # Perform network analysis (structure only, no complex processing)
        network_result = perform_network_analysis(csv_content, false)  # false = no diamond processing
        
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

end # module ProcessInputEndpoint