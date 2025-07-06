"""
DiamondClassificationEndpoint.jl

Endpoint for diamond structure classification and detailed analysis.
Maps to the required 'diamondclassification' endpoint.
"""
module DiamondClassificationEndpoint

using HTTP, JSON
include(joinpath(@__DIR__, "..", "services", "ValidationService.jl"))
include(joinpath(@__DIR__, "..", "services", "NetworkService.jl"))
include(joinpath(@__DIR__, "..", "services", "ResponseFormatter.jl"))

using .ValidationService
using .NetworkService
using .ResponseFormatter

export handle_diamond_classification

"""
    handle_diamond_classification(req::HTTP.Request) -> HTTP.Response

Handle POST /api/diamondclassification endpoint.
Takes CSV file content and returns detailed diamond classification data.
"""
function handle_diamond_classification(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing diamond classification request...")
        
        # Parse request data
        request_data = JSON.parse(String(req.body))
        
        # Validate request data
        validation_result = validate_request_data(request_data, "diamondclassification")
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
        
        # Perform flexible network analysis (supports both csvContent and edges formats)
        network_result = perform_flexible_network_analysis(request_data)
        
        # Perform diamond analysis WITH classification
        diamond_result = perform_diamond_analysis(network_result, true)  # true = include classification
        
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
        
        # Format diamond data with classifications
        diamond_data = format_diamond_data(diamond_result.diamond_structures, diamond_result.diamond_classifications)
        
        # Calculate detailed classification statistics
        classification_stats = calculate_classification_statistics(diamond_result.diamond_classifications)
        
        # Create comprehensive response data
        response_data = Dict{String, Any}(
            "networkData" => network_data,
            "diamondData" => diamond_data,
            "classificationStatistics" => classification_stats,
            "summary" => Dict{String, Any}(
                "analysisType" => "Diamond Classification Analysis",
                "nodes" => network_data["nodeCount"],
                "edges" => network_data["edgeCount"],
                "diamonds" => diamond_data["diamondCount"],
                "classifiedDiamonds" => diamond_result.diamond_classifications !== nothing ? length(diamond_result.diamond_classifications) : 0,
                "joinNodes" => length(network_result.join_nodes),
                "forkNodes" => length(network_result.fork_nodes),
                "hasDiamonds" => diamond_data["diamondCount"] > 0,
                "hasClassifications" => diamond_result.diamond_classifications !== nothing,
                "maxIterationDepth" => network_data["maxIterationDepth"],
                "processingTime" => "< 2s"  # Placeholder for actual timing
            )
        )
        
        # Format final response
        response_json = format_success_response(response_data, "diamondclassification")
        
        classified_count = diamond_result.diamond_classifications !== nothing ? length(diamond_result.diamond_classifications) : 0
        println("✅ Diamond classification complete: $classified_count diamonds classified")
        
        return HTTP.Response(200, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            response_json
        )
        
    catch e
        println("❌ Diamond classification error: $e")
        error_response = format_error_response("Diamond classification failed: $(string(e))", 500)
        return HTTP.Response(500, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            error_response
        )
    end
end

"""
    calculate_classification_statistics(diamond_classifications) -> Dict

Calculate detailed statistics about diamond classifications.
"""
function calculate_classification_statistics(diamond_classifications::Union{Vector, Nothing})::Dict{String, Any}
    if diamond_classifications === nothing || isempty(diamond_classifications)
        return Dict{String, Any}(
            "totalClassified" => 0,
            "structureTypes" => Dict{String, Int}(),
            "topologyTypes" => Dict{String, Int}(),
            "complexityDistribution" => Dict{String, Int}(),
            "riskAssessment" => Dict{String, Any}(
                "highRisk" => 0,
                "mediumRisk" => 0,
                "lowRisk" => 0
            ),
            "optimizationPotential" => Dict{String, Any}(
                "high" => 0,
                "medium" => 0,
                "low" => 0
            )
        )
    end
    
    # Initialize counters
    structure_types = Dict{String, Int}()
    topology_types = Dict{String, Int}()
    complexity_distribution = Dict{String, Int}()
    risk_assessment = Dict{String, Int}("high" => 0, "medium" => 0, "low" => 0)
    optimization_potential = Dict{String, Int}("high" => 0, "medium" => 0, "low" => 0)
    
    complexity_scores = Vector{Float64}()
    bottleneck_risks = Vector{Float64}()
    optimization_potentials = Vector{Float64}()
    
    for classification in diamond_classifications
        # Count structure types
        internal_structure = get(classification, "internalStructure", "Unknown")
        structure_types[internal_structure] = get(structure_types, internal_structure, 0) + 1
        
        # Count topology types
        path_topology = get(classification, "pathTopology", "Unknown")
        topology_types[path_topology] = get(topology_types, path_topology, 0) + 1
        
        # Complexity distribution
        complexity_score_raw = get(classification, "complexityScore", 0.0)
        complexity_score = try
            Float64(complexity_score_raw)
        catch
            0.0  # Default if conversion fails
        end
        push!(complexity_scores, complexity_score)
        
        complexity_level = if complexity_score < 0.3
            "Low"
        elseif complexity_score < 0.7
            "Medium"
        else
            "High"
        end
        complexity_distribution[complexity_level] = get(complexity_distribution, complexity_level, 0) + 1
        
        # Risk assessment
        bottleneck_risk_raw = get(classification, "bottleneckRisk", 0.0)
        bottleneck_risk = try
            Float64(bottleneck_risk_raw)
        catch
            0.0  # Default if conversion fails
        end
        push!(bottleneck_risks, bottleneck_risk)
        
        risk_level = if bottleneck_risk < 0.3
            "low"
        elseif bottleneck_risk < 0.7
            "medium"
        else
            "high"
        end
        risk_assessment[risk_level] += 1
        
        # Optimization potential
        opt_potential_raw = get(classification, "optimizationPotential", 0.0)
        opt_potential = try
            Float64(opt_potential_raw)
        catch
            0.0  # Default if conversion fails
        end
        push!(optimization_potentials, opt_potential)
        
        opt_level = if opt_potential < 0.3
            "low"
        elseif opt_potential < 0.7
            "medium"
        else
            "high"
        end
        optimization_potential[opt_level] += 1
    end
    
    return Dict{String, Any}(
        "totalClassified" => length(diamond_classifications),
        "structureTypes" => structure_types,
        "topologyTypes" => topology_types,
        "complexityDistribution" => complexity_distribution,
        "riskAssessment" => risk_assessment,
        "optimizationPotential" => optimization_potential,
        "statisticalSummary" => Dict{String, Any}(
            "complexity" => Dict{String, Any}(
                "mean" => isempty(complexity_scores) ? 0.0 : sum(complexity_scores) / length(complexity_scores),
                "min" => isempty(complexity_scores) ? 0.0 : minimum(complexity_scores),
                "max" => isempty(complexity_scores) ? 0.0 : maximum(complexity_scores)
            ),
            "bottleneckRisk" => Dict{String, Any}(
                "mean" => isempty(bottleneck_risks) ? 0.0 : sum(bottleneck_risks) / length(bottleneck_risks),
                "min" => isempty(bottleneck_risks) ? 0.0 : minimum(bottleneck_risks),
                "max" => isempty(bottleneck_risks) ? 0.0 : maximum(bottleneck_risks)
            ),
            "optimizationPotential" => Dict{String, Any}(
                "mean" => isempty(optimization_potentials) ? 0.0 : sum(optimization_potentials) / length(optimization_potentials),
                "min" => isempty(optimization_potentials) ? 0.0 : minimum(optimization_potentials),
                "max" => isempty(optimization_potentials) ? 0.0 : maximum(optimization_potentials)
            )
        ),
        "recommendations" => generate_classification_recommendations(
            structure_types, complexity_distribution, risk_assessment, optimization_potential
        )
    )
end

"""
    generate_classification_recommendations(structure_types, complexity_dist, risk_assessment, opt_potential) -> Vector

Generate actionable recommendations based on classification results.
"""
function generate_classification_recommendations(
    structure_types::Dict{String, Int},
    complexity_dist::Dict{String, Int},
    risk_assessment::Dict{String, Int},
    opt_potential::Dict{String, Int}
)::Vector{String}
    
    recommendations = Vector{String}()
    
    # High complexity recommendations
    high_complexity = get(complexity_dist, "High", 0)
    if high_complexity > 0
        push!(recommendations, "Consider simplifying $high_complexity high-complexity diamond structures to improve maintainability")
    end
    
    # High risk recommendations
    high_risk = get(risk_assessment, "high", 0)
    if high_risk > 0
        push!(recommendations, "Monitor $high_risk high-risk diamond structures for potential bottlenecks")
    end
    
    # Optimization recommendations
    high_opt = get(opt_potential, "high", 0)
    if high_opt > 0
        push!(recommendations, "Focus optimization efforts on $high_opt diamonds with high optimization potential")
    end
    
    # Structure-specific recommendations
    for (structure_type, count) in structure_types
        if count > 3  # Arbitrary threshold
            push!(recommendations, "Network contains $count '$structure_type' diamond structures - consider standardizing patterns")
        end
    end
    
    if isempty(recommendations)
        push!(recommendations, "Diamond structures appear well-balanced with no immediate optimization needs")
    end
    
    return recommendations
end

end # module DiamondClassificationEndpoint