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
    
    return Dict{String, Any}(
        "nodes" => collect(all_nodes),
        "edges" => [(edge[1], edge[2]) for edge in edgelist],
        "edgelist" => [(edge[1], edge[2]) for edge in edgelist],  # Add this for Angular compatibility
        "sourceNodes" => collect(source_nodes),
        "sinkNodes" => sink_nodes,
        "forkNodes" => collect(fork_nodes),
        "joinNodes" => collect(join_nodes),
        "iterationSets" => [collect(set) for set in iteration_sets],
        "ancestors" => ancestors_serializable,
        "descendants" => descendants_serializable,
        "nodeCount" => length(all_nodes),
        "edgeCount" => length(edgelist),
        "maxIterationDepth" => length(iteration_sets),
        "graphDensity" => calculate_graph_density(all_nodes, edgelist),
        "nodePriors" => node_priors,
        "edgeProbabilities" => edge_probs_serializable
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
        serializable_structures[string(join_node)] = Dict{String, Any}(
            "joinNode" => join_node,
            "nonDiamondParents" => collect(structure.non_diamond_parents),
            "diamonds" => [
                Dict{String, Any}(
                    "relevantNodes" => collect(diamond.relevant_nodes),
                    "highestNodes" => collect(diamond.highest_nodes),
                    "edgeList" => diamond.edgelist
                ) for diamond in structure.diamond
            ]
        )
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
    
    results = Vector{Dict{String, Any}}()
    
    for (node, algo_prob) in algorithm_results
        mc_prob = get(monte_carlo_results, node, 0.0)
        push!(results, Dict{String, Any}(
            "node" => node,
            "algorithmValue" => algo_prob,
            "monteCarloValue" => mc_prob,
            "difference" => abs(algo_prob - mc_prob),
            "relativeError" => algo_prob > 0 ? abs(algo_prob - mc_prob) / algo_prob : 0.0
        ))
    end
    
    # Sort by difference (largest discrepancies first)
    sort!(results, by = x -> x["difference"], rev = true)
    
    return results
end

"""
    format_parameter_modifications(nodes_modified, edges_modified, use_individual_overrides) -> ParameterModifications

Format parameter modification summary with camelCase keys.
"""
function format_parameter_modifications(
    nodes_individually_modified::Int,
    edges_individually_modified::Int,
    nodes_globally_modified::Int,
    edges_globally_modified::Int,
    use_individual_overrides::Bool
)::ParameterModifications
    
    return Dict{String, Any}(
        "nodesIndividuallyModified" => nodes_individually_modified,
        "edgesIndividuallyModified" => edges_individually_modified,
        "nodesGloballyModified" => nodes_globally_modified,
        "edgesGloballyModified" => edges_globally_modified,
        "totalNodesModified" => nodes_individually_modified + nodes_globally_modified,
        "totalEdgesModified" => edges_individually_modified + edges_globally_modified,
        "useIndividualOverrides" => use_individual_overrides
    )
end

"""
    calculate_graph_density(nodes, edges) -> Float64

Calculate graph density for network statistics.
"""
function calculate_graph_density(nodes::Union{Set, Vector}, edges::Vector)::Float64
    n_nodes = length(nodes)
    n_edges = length(edges)
    max_possible_edges = n_nodes * (n_nodes - 1)
    
    return max_possible_edges > 0 ? n_edges / max_possible_edges : 0.0
end

end # module ResponseFormatter