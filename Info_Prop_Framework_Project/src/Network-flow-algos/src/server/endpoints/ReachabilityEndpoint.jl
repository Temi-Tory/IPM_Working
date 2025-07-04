"""
ReachabilityEndpoint.jl

Endpoint for reachability analysis using belief propagation.
Maps to the required 'reachabilitymodule' endpoint.
"""
module ReachabilityEndpoint

using HTTP, JSON
include(joinpath(@__DIR__, "..", "services", "ValidationService.jl"))
include(joinpath(@__DIR__, "..", "services", "NetworkService.jl"))
include(joinpath(@__DIR__, "..", "services", "ParameterService.jl"))
include(joinpath(@__DIR__, "..", "services", "ResponseFormatter.jl"))

using .ValidationService
using .NetworkService
using .ParameterService
using .ResponseFormatter

export handle_reachability_analysis

"""
    handle_reachability_analysis(req::HTTP.Request) -> HTTP.Response

Handle POST /api/reachabilitymodule endpoint.
Takes CSV file content and optional parameter overrides, returns reachability analysis results.
"""
function handle_reachability_analysis(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing reachability analysis request...")
        
        # Parse request data
        request_data = JSON.parse(String(req.body))
        
        # Validate request data
        validation_result = validate_request_data(request_data, "reachabilitymodule")
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
        
        # Store original parameters for comparison
        original_node_priors = copy(network_result.node_priors)
        original_edge_probabilities = copy(network_result.edge_probabilities)
        
        # Apply parameter overrides if specified
        parameter_result = apply_parameter_overrides!(
            network_result.node_priors,
            network_result.edge_probabilities,
            request_data
        )
        
        # Perform reachability analysis with (potentially modified) parameters
        reachability_result = perform_reachability_analysis(network_result)
        
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
        
        # Format results for response
        sorted_results = sort(collect(reachability_result.node_probabilities))
        results = [Dict("node" => r[1], "probability" => r[2]) for r in sorted_results]
        
        # Calculate result statistics
        result_stats = calculate_reachability_statistics(reachability_result.node_probabilities, network_result)
        
        # Format parameter modifications
        parameter_modifications = format_parameter_modifications(
            parameter_result.nodes_individually_modified,
            parameter_result.edges_individually_modified,
            parameter_result.nodes_globally_modified,
            parameter_result.edges_globally_modified,
            parameter_result.use_individual_overrides
        )
        
        # Create comprehensive response data
        response_data = Dict{String, Any}(
            "results" => results,
            "networkData" => network_data,
            "originalParameters" => Dict{String, Any}(
                "nodePriors" => original_node_priors,
                "edgeProbabilities" => Dict{String, Float64}(
                    "($src,$dst)" => prob for ((src, dst), prob) in original_edge_probabilities
                )
            ),
            "parameterModifications" => parameter_modifications,
            "resultStatistics" => result_stats,
            "analysisMetadata" => reachability_result.analysis_metadata,
            "summary" => Dict{String, Any}(
                "analysisType" => "Reachability Analysis",
                "nodes" => network_data["nodeCount"],
                "edges" => network_data["edgeCount"],
                "diamonds" => length(network_result.diamond_structures),
                "resultsGenerated" => length(results),
                "parametersModified" => parameter_result.total_nodes_modified + parameter_result.total_edges_modified > 0,
                "maxIterationDepth" => network_data["maxIterationDepth"],
                "processingTime" => "< 2s"  # Placeholder for actual timing
            )
        )
        
        # Format final response
        response_json = format_success_response(response_data, "reachabilitymodule")
        
        println("✅ Reachability analysis complete: $(length(results)) node probabilities calculated")
        
        return HTTP.Response(200, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            response_json
        )
        
    catch e
        println("❌ Reachability analysis error: $e")
        error_response = format_error_response("Reachability analysis failed: $(string(e))", 500)
        return HTTP.Response(500, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            error_response
        )
    end
end

"""
    calculate_reachability_statistics(node_probabilities, network_result) -> Dict

Calculate detailed statistics about reachability results.
"""
function calculate_reachability_statistics(
    node_probabilities::Dict{Int64, Float64},
    network_result::NetworkAnalysisResult
)::Dict{String, Any}
    
    if isempty(node_probabilities)
        return Dict{String, Any}(
            "totalNodes" => 0,
            "probabilityDistribution" => Dict{String, Int}(),
            "nodeTypeAnalysis" => Dict{String, Any}(),
            "reachabilityMetrics" => Dict{String, Any}()
        )
    end
    
    # Probability distribution analysis
    prob_ranges = Dict{String, Int}(
        "0.0-0.1" => 0,
        "0.1-0.3" => 0,
        "0.3-0.5" => 0,
        "0.5-0.7" => 0,
        "0.7-0.9" => 0,
        "0.9-1.0" => 0
    )
    
    probabilities = collect(values(node_probabilities))
    
    for prob in probabilities
        if prob <= 0.1
            prob_ranges["0.0-0.1"] += 1
        elseif prob <= 0.3
            prob_ranges["0.1-0.3"] += 1
        elseif prob <= 0.5
            prob_ranges["0.3-0.5"] += 1
        elseif prob <= 0.7
            prob_ranges["0.5-0.7"] += 1
        elseif prob <= 0.9
            prob_ranges["0.7-0.9"] += 1
        else
            prob_ranges["0.9-1.0"] += 1
        end
    end
    
    # Node type analysis
    source_probs = [node_probabilities[node] for node in network_result.source_nodes if haskey(node_probabilities, node)]
    fork_probs = [node_probabilities[node] for node in network_result.fork_nodes if haskey(node_probabilities, node)]
    join_probs = [node_probabilities[node] for node in network_result.join_nodes if haskey(node_probabilities, node)]
    
    node_type_analysis = Dict{String, Any}(
        "sourceNodes" => Dict{String, Any}(
            "count" => length(source_probs),
            "avgProbability" => isempty(source_probs) ? 0.0 : sum(source_probs) / length(source_probs),
            "minProbability" => isempty(source_probs) ? 0.0 : minimum(source_probs),
            "maxProbability" => isempty(source_probs) ? 0.0 : maximum(source_probs)
        ),
        "forkNodes" => Dict{String, Any}(
            "count" => length(fork_probs),
            "avgProbability" => isempty(fork_probs) ? 0.0 : sum(fork_probs) / length(fork_probs),
            "minProbability" => isempty(fork_probs) ? 0.0 : minimum(fork_probs),
            "maxProbability" => isempty(fork_probs) ? 0.0 : maximum(fork_probs)
        ),
        "joinNodes" => Dict{String, Any}(
            "count" => length(join_probs),
            "avgProbability" => isempty(join_probs) ? 0.0 : sum(join_probs) / length(join_probs),
            "minProbability" => isempty(join_probs) ? 0.0 : minimum(join_probs),
            "maxProbability" => isempty(join_probs) ? 0.0 : maximum(join_probs)
        )
    )
    
    # Overall reachability metrics
    reachability_metrics = Dict{String, Any}(
        "overallMean" => sum(probabilities) / length(probabilities),
        "overallMin" => minimum(probabilities),
        "overallMax" => maximum(probabilities),
        "standardDeviation" => calculate_std_dev(probabilities),
        "highReachabilityNodes" => count(p -> p > 0.8, probabilities),
        "lowReachabilityNodes" => count(p -> p < 0.2, probabilities),
        "perfectReachabilityNodes" => count(p -> p == 1.0, probabilities),
        "unreachableNodes" => count(p -> p == 0.0, probabilities)
    )
    
    return Dict{String, Any}(
        "totalNodes" => length(node_probabilities),
        "probabilityDistribution" => prob_ranges,
        "nodeTypeAnalysis" => node_type_analysis,
        "reachabilityMetrics" => reachability_metrics,
        "insights" => generate_reachability_insights(reachability_metrics, node_type_analysis)
    )
end

"""
    calculate_std_dev(values) -> Float64

Calculate standard deviation of a vector of values.
"""
function calculate_std_dev(values::Vector{Float64})::Float64
    if length(values) <= 1
        return 0.0
    end
    
    mean_val = sum(values) / length(values)
    variance = sum((x - mean_val)^2 for x in values) / (length(values) - 1)
    return sqrt(variance)
end

"""
    generate_reachability_insights(metrics, node_analysis) -> Vector

Generate actionable insights based on reachability analysis.
"""
function generate_reachability_insights(
    metrics::Dict{String, Any},
    node_analysis::Dict{String, Any}
)::Vector{String}
    
    insights = Vector{String}()
    
    # Overall reachability insights
    overall_mean = get(metrics, "overallMean", 0.0)
    if overall_mean > 0.8
        push!(insights, "Network shows excellent overall reachability ($(round(overall_mean, digits=3)))")
    elseif overall_mean < 0.3
        push!(insights, "Network has poor overall reachability ($(round(overall_mean, digits=3))) - consider improving connectivity")
    end
    
    # Unreachable nodes insight
    unreachable = get(metrics, "unreachableNodes", 0)
    if unreachable > 0
        push!(insights, "$unreachable nodes are completely unreachable - check network connectivity")
    end
    
    # High variance insight
    std_dev = get(metrics, "standardDeviation", 0.0)
    if std_dev > 0.3
        push!(insights, "High variability in reachability (σ=$(round(std_dev, digits=3))) suggests uneven network structure")
    end
    
    # Node type specific insights
    source_analysis = get(node_analysis, "sourceNodes", Dict{String, Any}())
    source_avg = get(source_analysis, "avgProbability", 0.0)
    if source_avg < 0.9
        push!(insights, "Source nodes have lower than expected reachability ($(round(source_avg, digits=3))) - check source node parameters")
    end
    
    join_analysis = get(node_analysis, "joinNodes", Dict{String, Any}())
    join_avg = get(join_analysis, "avgProbability", 0.0)
    fork_analysis = get(node_analysis, "forkNodes", Dict{String, Any}())
    fork_avg = get(fork_analysis, "avgProbability", 0.0)
    
    if join_avg > fork_avg + 0.2
        push!(insights, "Join nodes significantly more reachable than fork nodes - indicates good convergence")
    elseif fork_avg > join_avg + 0.2
        push!(insights, "Fork nodes more reachable than join nodes - may indicate bottlenecks at joins")
    end
    
    if isempty(insights)
        push!(insights, "Reachability analysis shows balanced network performance")
    end
    
    return insights
end

end # module ReachabilityEndpoint