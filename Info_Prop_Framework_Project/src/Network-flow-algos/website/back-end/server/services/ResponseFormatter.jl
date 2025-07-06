"""
ResponseFormatter.jl

Standardized JSON response formatting for TypeScript/HTTP interface compatibility.
Ensures consistent camelCase naming and strict typing for all API responses.
"""
module ResponseFormatter

using JSON, Dates

export format_success_response, format_error_response, format_network_data, 
       format_diamond_data, format_monte_carlo_results, format_parameter_modifications

# Type definitions for strict typing and TypeScript interface compatibility
const NetworkData = Dict{String, Any}
const DiamondData = Dict{String, Any}
const MonteCarloResults = Vector{Dict{String, Any}}
const ParameterModifications = Dict{String, Any}

"""
    format_success_response(data::Dict{String, Any}, endpoint_type::String) -> String

Format a successful API response with consistent structure for TypeScript consumption.
All keys are camelCase for JavaScript/TypeScript compatibility.
"""
function format_success_response(data::Dict{String, Any}, endpoint_type::String)::String
    response = Dict{String, Any}(
        "success" => true,
        "timestamp" => string(now()),
        "endpointType" => endpoint_type,
        "data" => data
    )
    
    return JSON.json(response)
end

"""
    format_error_response(error_message::String, error_code::Int = 500) -> String

Format an error response with consistent structure.
"""
function format_error_response(error_message::String, error_code::Int = 500)::String
    response = Dict{String, Any}(
        "success" => false,
        "timestamp" => string(now()),
        "error" => Dict{String, Any}(
            "message" => error_message,
            "code" => error_code
        )
    )
    
    return JSON.json(response)
end

"""
    format_network_data(edgelist, outgoing_index, incoming_index, source_nodes, 
                       node_priors, edge_probabilities, fork_nodes, join_nodes, 
                       iteration_sets, ancestors, descendants) -> NetworkData

Format network structure data with camelCase keys for TypeScript compatibility.
"""
function format_network_data(
    edgelist::Vector{Tuple{Int64,Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    fork_nodes::Set{Int64},
    join_nodes::Set{Int64},
    iteration_sets::Vector{Set{Int64}},
    ancestors::Dict{Int64, Set{Int64}},
    descendants::Dict{Int64, Set{Int64}}
)::NetworkData
    
    all_nodes = union(keys(outgoing_index), keys(incoming_index))
    sink_nodes = [node for node in all_nodes if !haskey(outgoing_index, node) || isempty(outgoing_index[node])]
    
    # Convert edge probabilities to serializable format
    edge_probs_serializable = Dict{String, Float64}()
    for ((src, dst), prob) in edge_probabilities
        edge_probs_serializable["($src,$dst)"] = prob
    end
    
    # Convert ancestors and descendants to serializable format
    ancestors_serializable = Dict{String, Vector{Int64}}()
    for (node, ancestor_set) in ancestors
        ancestors_serializable[string(node)] = collect(ancestor_set)
    end
    
    descendants_serializable = Dict{String, Vector{Int64}}()
    for (node, descendant_set) in descendants
        descendants_serializable[string(node)] = collect(descendant_set)
    end
    
    # Calculate graph density
    num_nodes = length(all_nodes)
    num_edges = length(edgelist)
    max_possible_edges = num_nodes * (num_nodes - 1)  # For directed graph
    graph_density = max_possible_edges > 0 ? num_edges / max_possible_edges : 0.0
    
    return Dict{String, Any}(
        "nodes" => collect(all_nodes),
        "edges" => [(edge[1], edge[2]) for edge in edgelist],
        "edgelist" => [(edge[1], edge[2]) for edge in edgelist],  # Add this for Angular compatibility
        "sourceNodes" => collect(source_nodes),
        "sinkNodes" => sink_nodes,
        "forkNodes" => collect(fork_nodes),
        "joinNodes" => collect(join_nodes),
        "nodePriors" => node_priors,
        "edgeProbabilities" => edge_probs_serializable,
        "iterationSets" => [collect(iter_set) for iter_set in iteration_sets],
        "ancestors" => ancestors_serializable,
        "descendants" => descendants_serializable,
        "nodeCount" => length(all_nodes),
        "edgeCount" => length(edgelist),
        "maxIterationDepth" => length(iteration_sets),
        "graphDensity" => graph_density
    )
end

"""
    format_diamond_data(diamond_structures, diamond_classifications = nothing) -> DiamondData

Format diamond analysis data with camelCase keys.
"""
function format_diamond_data(
    diamond_structures::Dict,
    diamond_classifications::Union{Vector, Nothing} = nothing
)::DiamondData
    
    # Convert diamond structures to serializable format
    serializable_structures = Dict{String, Any}()
    for (join_node, structure) in diamond_structures
        # Handle different diamond structure formats
        if hasfield(typeof(structure), :diamond) && hasfield(typeof(structure), :non_diamond_parents)
            # Handle both single Diamond objects and collections
            diamonds_array = []
            
            try
                # Try to iterate - if it works, it's a collection
                for diamond in structure.diamond
                    push!(diamonds_array, Dict{String, Any}(
                        "relevantNodes" => collect(diamond.relevant_nodes),
                        "highestNodes" => collect(diamond.highest_nodes),
                        "edgeList" => diamond.edgelist
                    ))
                end
            catch
                # If iteration fails, treat as a single Diamond object
                try
                    diamond = structure.diamond
                    push!(diamonds_array, Dict{String, Any}(
                        "relevantNodes" => collect(diamond.relevant_nodes),
                        "highestNodes" => collect(diamond.highest_nodes),
                        "edgeList" => diamond.edgelist
                    ))
                catch
                    println("⚠️ Warning: Could not process diamond structure")
                    push!(diamonds_array, Dict{String, Any}("error" => "Processing failed"))
                end
            end
            
            serializable_structures[string(join_node)] = Dict{String, Any}(
                "joinNode" => join_node,
                "nonDiamondParents" => collect(structure.non_diamond_parents),
                "diamonds" => diamonds_array
            )
        else
            # Handle direct Diamond objects or other formats
            try
                if hasfield(typeof(structure), :relevant_nodes)
                    # Single Diamond object
                    serializable_structures[string(join_node)] = Dict{String, Any}(
                        "joinNode" => join_node,
                        "nonDiamondParents" => [],
                        "diamonds" => [
                            Dict{String, Any}(
                                "relevantNodes" => collect(structure.relevant_nodes),
                                "highestNodes" => collect(structure.highest_nodes),
                                "edgeList" => structure.edgelist
                            )
                        ]
                    )
                else
                    # Fallback: convert to string representation
                    serializable_structures[string(join_node)] = Dict{String, Any}(
                        "joinNode" => join_node,
                        "nonDiamondParents" => [],
                        "diamonds" => [Dict{String, Any}("structure" => string(structure))]
                    )
                end
            catch e
                println("⚠️ Warning: Could not serialize diamond structure for join node $join_node: $e")
                serializable_structures[string(join_node)] = Dict{String, Any}(
                    "joinNode" => join_node,
                    "nonDiamondParents" => [],
                    "diamonds" => [Dict{String, Any}("error" => "Serialization failed")]
                )
            end
        end
    end
    
    result = Dict{String, Any}(
        "diamondStructures" => serializable_structures,
        "diamondCount" => length(diamond_structures)
    )
    
    if diamond_classifications !== nothing
        result["diamondClassifications"] = diamond_classifications
    end
    
    return result
end

"""
    format_monte_carlo_results(algorithm_results, monte_carlo_results, iterations) -> MonteCarloResults

Format Monte Carlo comparison results with camelCase keys.
"""
function format_monte_carlo_results(
    algorithm_results::Dict{Int64, Float64},
    monte_carlo_results::Dict{Int64, Float64},
    iterations::Int
)::MonteCarloResults
    
    comparison_results = Vector{Dict{String, Any}}()
    
    for node in keys(algorithm_results)
        algorithm_prob = get(algorithm_results, node, 0.0)
        monte_carlo_prob = get(monte_carlo_results, node, 0.0)
        
        difference = abs(algorithm_prob - monte_carlo_prob)
        relative_error = algorithm_prob > 0 ? difference / algorithm_prob : 0.0
        
        push!(comparison_results, Dict{String, Any}(
            "nodeId" => node,
            "algorithmProbability" => algorithm_prob,
            "monteCarloProbability" => monte_carlo_prob,
            "absoluteDifference" => difference,
            "relativeError" => relative_error,
            "withinTolerance" => relative_error < 0.05  # 5% tolerance
        ))
    end
    
    return comparison_results
end

"""
    format_parameter_modifications(nodes_individual, edges_individual, nodes_global, edges_global, use_individual) -> ParameterModifications

Format parameter modification data with camelCase keys.
"""
function format_parameter_modifications(
    nodes_individual::Int,
    edges_individual::Int,
    nodes_global::Int,
    edges_global::Int,
    use_individual::Bool
)::ParameterModifications
    return Dict{String, Any}(
        "nodeModifications" => Dict{String, Any}(
            "individual" => nodes_individual,
            "global" => nodes_global,
            "total" => nodes_individual + nodes_global
        ),
        "edgeModifications" => Dict{String, Any}(
            "individual" => edges_individual,
            "global" => edges_global,
            "total" => edges_individual + edges_global
        ),
        "totalModifications" => nodes_individual + edges_individual + nodes_global + edges_global,
        "useIndividualOverrides" => use_individual
    )
end

end # module ResponseFormatter