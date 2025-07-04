"""
MonteCarloEndpoint.jl

Endpoint for Monte Carlo validation analysis.
Maps to the required 'montecarlo' endpoint.
"""
module MonteCarloEndpoint

using HTTP, JSON
include(joinpath(@__DIR__, "..", "services", "ValidationService.jl"))
include(joinpath(@__DIR__, "..", "services", "NetworkService.jl"))
include(joinpath(@__DIR__, "..", "services", "ParameterService.jl"))
include(joinpath(@__DIR__, "..", "services", "ResponseFormatter.jl"))

using .ValidationService
using .NetworkService
using .ParameterService
using .ResponseFormatter

export handle_monte_carlo_analysis

"""
    handle_monte_carlo_analysis(req::HTTP.Request) -> HTTP.Response

Handle POST /api/montecarlo endpoint.
Takes CSV file content, parameter overrides, and Monte Carlo settings, returns validation results.
"""
function handle_monte_carlo_analysis(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing Monte Carlo analysis request...")
        
        # Parse request data
        request_data = JSON.parse(String(req.body))
        
        # Validate request data
        validation_result = validate_request_data(request_data, "montecarlo")
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
        
        # Extract parameters
        csv_content = request_data["csvContent"]
        iterations = get(request_data, "iterations", 1_000_000)
        include_algorithm_comparison = get(request_data, "includeAlgorithmComparison", true)
        
        println("🎲 Monte Carlo settings: $iterations iterations, algorithm comparison: $include_algorithm_comparison")
        
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
        
        # Get algorithm results for comparison (if requested)
        algorithm_results = Dict{Int64, Float64}()
        if include_algorithm_comparison
            println("🔄 Running algorithm analysis for comparison...")
            reachability_result = perform_reachability_analysis(network_result)
            algorithm_results = reachability_result.node_probabilities
        end
        
        # Perform Monte Carlo analysis
        monte_carlo_result = perform_monte_carlo_analysis(
            network_result, algorithm_results, iterations
        )
        
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
        
        # Format Monte Carlo results
        monte_carlo_data = format_monte_carlo_results(
            algorithm_results,
            monte_carlo_result.monte_carlo_probabilities,
            monte_carlo_result.iterations
        )
        
        # Calculate detailed Monte Carlo statistics
        mc_statistics = calculate_monte_carlo_statistics(
            monte_carlo_result, algorithm_results, network_result
        )
        
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
            "monteCarloResults" => monte_carlo_data,
            "monteCarloStatistics" => mc_statistics,
            "networkData" => network_data,
            "originalParameters" => Dict{String, Any}(
                "nodePriors" => original_node_priors,
                "edgeProbabilities" => Dict{String, Float64}(
                    "($src,$dst)" => prob for ((src, dst), prob) in original_edge_probabilities
                )
            ),
            "parameterModifications" => parameter_modifications,
            "analysisSettings" => Dict{String, Any}(
                "iterations" => iterations,
                "includeAlgorithmComparison" => include_algorithm_comparison,
                "randomSeed" => nothing  # Could be added for reproducibility
            ),
            "summary" => Dict{String, Any}(
                "analysisType" => "Monte Carlo Validation",
                "nodes" => network_data["nodeCount"],
                "edges" => network_data["edgeCount"],
                "iterations" => iterations,
                "comparisonsGenerated" => length(monte_carlo_data),
                "parametersModified" => parameter_result.total_nodes_modified + parameter_result.total_edges_modified > 0,
                "algorithmIncluded" => include_algorithm_comparison,
                "processingTime" => "< 10s"  # Placeholder for actual timing
            )
        )
        
        # Format final response
        response_json = format_success_response(response_data, "montecarlo")
        
        println("✅ Monte Carlo analysis complete: $iterations iterations, $(length(monte_carlo_data)) comparisons")
        
        return HTTP.Response(200, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            response_json
        )
        
    catch e
        println("❌ Monte Carlo analysis error: $e")
        error_response = format_error_response("Monte Carlo analysis failed: $(string(e))", 500)
        return HTTP.Response(500, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            error_response
        )
    end
end

"""
    calculate_monte_carlo_statistics(mc_result, algorithm_results, network_result) -> Dict

Calculate detailed statistics about Monte Carlo validation results.
"""
function calculate_monte_carlo_statistics(
    mc_result::MonteCarloResult,
    algorithm_results::Dict{Int64, Float64},
    network_result::NetworkAnalysisResult
)::Dict{String, Any}
    
    if isempty(mc_result.comparison_results)
        return Dict{String, Any}(
            "totalComparisons" => 0,
            "validationMetrics" => Dict{String, Any}(),
            "errorAnalysis" => Dict{String, Any}(),
            "nodeTypeAnalysis" => Dict{String, Any}(),
            "insights" => ["No comparison data available"]
        )
    end
    
    # Extract error data
    differences = [comp["difference"] for comp in mc_result.comparison_results]
    relative_errors = [comp["relativeError"] for comp in mc_result.comparison_results]
    
    # Validation metrics
    validation_metrics = Dict{String, Any}(
        "meanAbsoluteError" => sum(differences) / length(differences),
        "maxAbsoluteError" => maximum(differences),
        "meanRelativeError" => sum(relative_errors) / length(relative_errors),
        "maxRelativeError" => maximum(relative_errors),
        "rmse" => sqrt(sum(d^2 for d in differences) / length(differences)),
        "correlationCoefficient" => calculate_correlation(
            [comp["algorithmValue"] for comp in mc_result.comparison_results],
            [comp["monteCarloValue"] for comp in mc_result.comparison_results]
        )
    )
    
    # Error distribution analysis
    error_ranges = Dict{String, Int}(
        "0.0-0.01" => 0,
        "0.01-0.05" => 0,
        "0.05-0.1" => 0,
        "0.1-0.2" => 0,
        "0.2+" => 0
    )
    
    for diff in differences
        if diff <= 0.01
            error_ranges["0.0-0.01"] += 1
        elseif diff <= 0.05
            error_ranges["0.01-0.05"] += 1
        elseif diff <= 0.1
            error_ranges["0.05-0.1"] += 1
        elseif diff <= 0.2
            error_ranges["0.1-0.2"] += 1
        else
            error_ranges["0.2+"] += 1
        end
    end
    
    # Node type error analysis
    node_type_analysis = analyze_errors_by_node_type(
        mc_result.comparison_results, network_result
    )
    
    # Identify problematic nodes
    high_error_nodes = filter(
        comp -> comp["difference"] > 0.1, 
        mc_result.comparison_results
    )
    
    return Dict{String, Any}(
        "totalComparisons" => length(mc_result.comparison_results),
        "iterations" => mc_result.iterations,
        "validationMetrics" => validation_metrics,
        "errorDistribution" => error_ranges,
        "nodeTypeAnalysis" => node_type_analysis,
        "problematicNodes" => Dict{String, Any}(
            "highErrorCount" => length(high_error_nodes),
            "highErrorNodes" => [
                Dict{String, Any}(
                    "node" => comp["node"],
                    "algorithmValue" => comp["algorithmValue"],
                    "monteCarloValue" => comp["monteCarloValue"],
                    "difference" => comp["difference"]
                ) for comp in high_error_nodes[1:min(10, length(high_error_nodes))]
            ]
        ),
        "qualityAssessment" => assess_validation_quality(validation_metrics),
        "insights" => generate_monte_carlo_insights(validation_metrics, error_ranges, high_error_nodes)
    )
end

"""
    calculate_correlation(x_values, y_values) -> Float64

Calculate Pearson correlation coefficient between two vectors.
"""
function calculate_correlation(x_values::Vector{Float64}, y_values::Vector{Float64})::Float64
    if length(x_values) != length(y_values) || length(x_values) < 2
        return 0.0
    end
    
    n = length(x_values)
    mean_x = sum(x_values) / n
    mean_y = sum(y_values) / n
    
    numerator = sum((x_values[i] - mean_x) * (y_values[i] - mean_y) for i in 1:n)
    denominator_x = sqrt(sum((x_values[i] - mean_x)^2 for i in 1:n))
    denominator_y = sqrt(sum((y_values[i] - mean_y)^2 for i in 1:n))
    
    if denominator_x == 0.0 || denominator_y == 0.0
        return 0.0
    end
    
    return numerator / (denominator_x * denominator_y)
end

"""
    analyze_errors_by_node_type(comparison_results, network_result) -> Dict

Analyze validation errors by node type (source, fork, join, etc.).
"""
function analyze_errors_by_node_type(
    comparison_results::Vector{Dict{String, Any}},
    network_result::NetworkAnalysisResult
)::Dict{String, Any}
    
    # Categorize nodes by type
    node_types = Dict{Int64, String}()
    
    for comp in comparison_results
        node = comp["node"]
        if node in network_result.source_nodes
            node_types[node] = "source"
        elseif node in network_result.fork_nodes
            node_types[node] = "fork"
        elseif node in network_result.join_nodes
            node_types[node] = "join"
        else
            # Check if it's a sink node
            all_nodes = union(keys(network_result.outgoing_index), keys(network_result.incoming_index))
            if node in all_nodes && (!haskey(network_result.outgoing_index, node) || isempty(network_result.outgoing_index[node]))
                node_types[node] = "sink"
            else
                node_types[node] = "regular"
            end
        end
    end
    
    # Calculate errors by type
    type_errors = Dict{String, Vector{Float64}}()
    for comp in comparison_results
        node = comp["node"]
        node_type = get(node_types, node, "unknown")
        
        if !haskey(type_errors, node_type)
            type_errors[node_type] = Vector{Float64}()
        end
        push!(type_errors[node_type], comp["difference"])
    end
    
    # Calculate statistics for each type
    type_statistics = Dict{String, Any}()
    for (node_type, errors) in type_errors
        if !isempty(errors)
            type_statistics[node_type] = Dict{String, Any}(
                "count" => length(errors),
                "meanError" => sum(errors) / length(errors),
                "maxError" => maximum(errors),
                "minError" => minimum(errors)
            )
        end
    end
    
    return type_statistics
end

"""
    assess_validation_quality(validation_metrics) -> Dict

Assess the overall quality of the Monte Carlo validation.
"""
function assess_validation_quality(validation_metrics::Dict{String, Any})::Dict{String, Any}
    
    mae = get(validation_metrics, "meanAbsoluteError", 1.0)
    correlation = get(validation_metrics, "correlationCoefficient", 0.0)
    max_error = get(validation_metrics, "maxAbsoluteError", 1.0)
    
    # Quality scoring
    quality_score = 0.0
    quality_factors = Vector{String}()
    
    # MAE assessment
    if mae < 0.01
        quality_score += 30
        push!(quality_factors, "Excellent mean absolute error")
    elseif mae < 0.05
        quality_score += 20
        push!(quality_factors, "Good mean absolute error")
    elseif mae < 0.1
        quality_score += 10
        push!(quality_factors, "Acceptable mean absolute error")
    else
        push!(quality_factors, "High mean absolute error")
    end
    
    # Correlation assessment
    if correlation > 0.95
        quality_score += 30
        push!(quality_factors, "Excellent correlation")
    elseif correlation > 0.9
        quality_score += 20
        push!(quality_factors, "Good correlation")
    elseif correlation > 0.8
        quality_score += 10
        push!(quality_factors, "Acceptable correlation")
    else
        push!(quality_factors, "Poor correlation")
    end
    
    # Max error assessment
    if max_error < 0.05
        quality_score += 20
        push!(quality_factors, "Low maximum error")
    elseif max_error < 0.1
        quality_score += 15
        push!(quality_factors, "Moderate maximum error")
    elseif max_error < 0.2
        quality_score += 10
        push!(quality_factors, "Acceptable maximum error")
    else
        push!(quality_factors, "High maximum error")
    end
    
    # Overall assessment
    overall_quality = if quality_score >= 70
        "Excellent"
    elseif quality_score >= 50
        "Good"
    elseif quality_score >= 30
        "Acceptable"
    else
        "Poor"
    end
    
    return Dict{String, Any}(
        "overallQuality" => overall_quality,
        "qualityScore" => quality_score,
        "qualityFactors" => quality_factors,
        "recommendation" => generate_quality_recommendation(overall_quality, mae, correlation)
    )
end

"""
    generate_quality_recommendation(quality, mae, correlation) -> String

Generate recommendation based on validation quality.
"""
function generate_quality_recommendation(quality::String, mae::Float64, correlation::Float64)::String
    if quality == "Excellent"
        return "Algorithm validation is excellent. Results are highly reliable."
    elseif quality == "Good"
        return "Algorithm validation is good. Results are reliable for most applications."
    elseif quality == "Acceptable"
        if mae > 0.1
            return "Consider increasing Monte Carlo iterations or checking parameter settings."
        elseif correlation < 0.9
            return "Algorithm shows systematic differences from Monte Carlo. Review implementation."
        else
            return "Validation is acceptable but could be improved."
        end
    else
        return "Poor validation quality. Review algorithm implementation and network parameters."
    end
end

"""
    generate_monte_carlo_insights(validation_metrics, error_ranges, high_error_nodes) -> Vector

Generate actionable insights based on Monte Carlo validation results.
"""
function generate_monte_carlo_insights(
    validation_metrics::Dict{String, Any},
    error_ranges::Dict{String, Int},
    high_error_nodes::Vector
)::Vector{String}
    
    insights = Vector{String}()
    
    # Correlation insights
    correlation = get(validation_metrics, "correlationCoefficient", 0.0)
    if correlation > 0.95
        push!(insights, "Excellent correlation ($(round(correlation, digits=3))) indicates algorithm accuracy")
    elseif correlation < 0.8
        push!(insights, "Low correlation ($(round(correlation, digits=3))) suggests systematic algorithm differences")
    end
    
    # Error distribution insights
    high_accuracy = get(error_ranges, "0.0-0.01", 0)
    total_comparisons = sum(values(error_ranges))
    if high_accuracy > total_comparisons * 0.8
        push!(insights, "$(round(100 * high_accuracy / total_comparisons, digits=1))% of nodes have very low error (<0.01)")
    end
    
    high_error = get(error_ranges, "0.2+", 0)
    if high_error > 0
        push!(insights, "$high_error nodes have high validation errors (>0.2) - investigate these nodes")
    end
    
    # Mean error insights
    mae = get(validation_metrics, "meanAbsoluteError", 0.0)
    if mae < 0.01
        push!(insights, "Very low mean absolute error ($(round(mae, digits=4))) - excellent algorithm performance")
    elseif mae > 0.1
        push!(insights, "High mean absolute error ($(round(mae, digits=3))) - consider algorithm refinement")
    end
    
    # Problematic nodes insights
    if length(high_error_nodes) > 0
        push!(insights, "$(length(high_error_nodes)) nodes show significant discrepancies - focus optimization here")
    end
    
    if isempty(insights)
        push!(insights, "Monte Carlo validation shows balanced algorithm performance")
    end
    
    return insights
end

end # module MonteCarloEndpoint