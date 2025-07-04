"""
DiamondProcessingEndpoint.jl

Endpoint for diamond structure processing and identification.
Maps to the required 'diamondprocessing' endpoint.
"""
module DiamondProcessingEndpoint

using HTTP, JSON
include(joinpath(@__DIR__, "..", "services", "ValidationService.jl"))
include(joinpath(@__DIR__, "..", "services", "NetworkService.jl"))
include(joinpath(@__DIR__, "..", "services", "ResponseFormatter.jl"))

using .ValidationService
using .NetworkService
using .ResponseFormatter

export handle_diamond_processing

"""
    handle_diamond_processing(req::HTTP.Request) -> HTTP.Response

Handle POST /api/diamondprocessing endpoint.
Takes CSV file content and returns diamond structure data without classification.
"""
function handle_diamond_processing(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing diamond structures request...")
        
        # Parse request data
        request_data = JSON.parse(String(req.body))
        
        # Validate request data
        validation_result = validate_request_data(request_data, "diamondprocessing")
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
        
        # Perform network analysis with diamond processing
        network_result = perform_network_analysis(csv_content, true)  # true = include diamond processing
        
        # Perform diamond analysis (without classification to keep it fast)
        diamond_result = perform_diamond_analysis(network_result, false)  # false = no classification
        
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
        
        # Format diamond data for response
        diamond_data = format_diamond_data(diamond_result.diamond_structures)
        
        # Calculate diamond statistics
        diamond_stats = calculate_diamond_statistics(diamond_result.diamond_structures)
        
        # Create comprehensive response data
        response_data = Dict{String, Any}(
            "networkData" => network_data,
            "diamondData" => diamond_data,
            "diamondStatistics" => diamond_stats,
            "summary" => Dict{String, Any}(
                "analysisType" => "Diamond Structure Processing",
                "nodes" => network_data["nodeCount"],
                "edges" => network_data["edgeCount"],
                "diamonds" => diamond_data["diamondCount"],
                "joinNodes" => length(network_result.join_nodes),
                "forkNodes" => length(network_result.fork_nodes),
                "hasDiamonds" => diamond_data["diamondCount"] > 0,
                "maxIterationDepth" => network_data["maxIterationDepth"],
                "processingTime" => "< 1s"  # Placeholder for actual timing
            )
        )
        
        # Format final response
        response_json = format_success_response(response_data, "diamondprocessing")
        
        println("✅ Diamond processing complete: $(diamond_data["diamondCount"]) diamond structures found")
        
        return HTTP.Response(200, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            response_json
        )
        
    catch e
        println("❌ Diamond processing error: $e")
        error_response = format_error_response("Diamond processing failed: $(string(e))", 500)
        return HTTP.Response(500, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            error_response
        )
    end
end

"""
    calculate_diamond_statistics(diamond_structures) -> Dict

Calculate detailed statistics about diamond structures.
"""
function calculate_diamond_statistics(diamond_structures::Dict)::Dict{String, Any}
    if isempty(diamond_structures)
        return Dict{String, Any}(
            "totalDiamonds" => 0,
            "joinNodesWithDiamonds" => 0,
            "averageDiamondsPerJoin" => 0.0,
            "diamondSizeDistribution" => Dict{String, Int}(),
            "complexityMetrics" => Dict{String, Any}(
                "simpleDiamonds" => 0,
                "complexDiamonds" => 0,
                "nestedDiamonds" => 0
            )
        )
    end
    
    total_diamonds = 0
    diamond_sizes = Vector{Int}()
    simple_diamonds = 0
    complex_diamonds = 0
    nested_diamonds = 0
    
    for (join_node, structure) in diamond_structures
        num_diamonds_at_join = length(structure.diamond)
        total_diamonds += num_diamonds_at_join
        
        for diamond in structure.diamond
            diamond_size = length(diamond.relevant_nodes)
            push!(diamond_sizes, diamond_size)
            
            # Classify diamond complexity
            if diamond_size <= 4
                simple_diamonds += 1
            else
                complex_diamonds += 1
            end
            
            # Check for nested structure (simplified heuristic)
            if length(diamond.highest_nodes) > 2
                nested_diamonds += 1
            end
        end
    end
    
    # Size distribution
    size_distribution = Dict{String, Int}()
    for size in diamond_sizes
        size_key = string(size)
        size_distribution[size_key] = get(size_distribution, size_key, 0) + 1
    end
    
    return Dict{String, Any}(
        "totalDiamonds" => total_diamonds,
        "joinNodesWithDiamonds" => length(diamond_structures),
        "averageDiamondsPerJoin" => total_diamonds > 0 ? total_diamonds / length(diamond_structures) : 0.0,
        "diamondSizeDistribution" => size_distribution,
        "complexityMetrics" => Dict{String, Any}(
            "simpleDiamonds" => simple_diamonds,
            "complexDiamonds" => complex_diamonds,
            "nestedDiamonds" => nested_diamonds
        ),
        "sizeStatistics" => Dict{String, Any}(
            "minSize" => isempty(diamond_sizes) ? 0 : minimum(diamond_sizes),
            "maxSize" => isempty(diamond_sizes) ? 0 : maximum(diamond_sizes),
            "avgSize" => isempty(diamond_sizes) ? 0.0 : sum(diamond_sizes) / length(diamond_sizes)
        )
    )
end

end # module DiamondProcessingEndpoint