"""
PathEnumEndpoint.jl

Endpoint for path enumeration analysis between nodes.
Maps to the required 'pathenum' endpoint.
"""
module PathEnumEndpoint

using HTTP, JSON
include(joinpath(@__DIR__, "..", "services", "ValidationService.jl"))
include(joinpath(@__DIR__, "..", "services", "NetworkService.jl"))
include(joinpath(@__DIR__, "..", "services", "ResponseFormatter.jl"))

using .ValidationService
using .NetworkService
using .ResponseFormatter

export handle_path_enumeration

"""
    handle_path_enumeration(req::HTTP.Request) -> HTTP.Response

Handle POST /api/pathenum endpoint.
Takes CSV file content and optional source/target nodes, returns path enumeration results.
"""
function handle_path_enumeration(req::HTTP.Request)::HTTP.Response
    try
        println("🔄 Processing path enumeration request...")
        
        # Parse request data
        request_data = JSON.parse(String(req.body))
        
        # Validate request data
        validation_result = validate_request_data(request_data, "pathenum")
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
        source_node = get(request_data, "sourceNode", nothing)
        target_node = get(request_data, "targetNode", nothing)
        max_paths = get(request_data, "maxPaths", 1000)  # Limit to prevent explosion
        max_depth = get(request_data, "maxDepth", 10)    # Limit path length
        
        # Convert node IDs to integers if provided
        if source_node !== nothing
            source_node = Int64(source_node)
        end
        if target_node !== nothing
            target_node = Int64(target_node)
        end
        
        println("🔍 Path enumeration: source=$source_node, target=$target_node, maxPaths=$max_paths, maxDepth=$max_depth")
        
        # Perform network analysis
        network_result = perform_network_analysis(csv_content, false)  # false = no diamond processing for speed
        
        # Perform path enumeration
        path_result = perform_path_enumeration_with_limits(
            network_result, source_node, target_node, max_paths, max_depth
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
        
        # Calculate path statistics
        path_stats = calculate_path_statistics(path_result, network_result)
        
        # Format paths for response
        formatted_paths = format_paths_for_response(path_result, max_paths)
        
        # Create comprehensive response data
        response_data = Dict{String, Any}(
            "paths" => formatted_paths,
            "pathStatistics" => path_stats,
            "networkData" => network_data,
            "searchParameters" => Dict{String, Any}(
                "sourceNode" => source_node,
                "targetNode" => target_node,
                "maxPaths" => max_paths,
                "maxDepth" => max_depth,
                "searchType" => determine_search_type(source_node, target_node)
            ),
            "summary" => Dict{String, Any}(
                "analysisType" => "Path Enumeration Analysis",
                "nodes" => network_data["nodeCount"],
                "edges" => network_data["edgeCount"],
                "pathsFound" => min(path_result.total_paths, max_paths),
                "totalPathsAvailable" => path_result.total_paths,
                "pathsLimited" => path_result.total_paths > max_paths,
                "searchScope" => determine_search_type(source_node, target_node),
                "processingTime" => "< 1s"  # Placeholder for actual timing
            )
        )
        
        # Format final response
        response_json = format_success_response(response_data, "pathenum")
        
        println("✅ Path enumeration complete: $(min(path_result.total_paths, max_paths)) paths returned")
        
        return HTTP.Response(200, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            response_json
        )
        
    catch e
        println("❌ Path enumeration error: $e")
        error_response = format_error_response("Path enumeration failed: $(string(e))", 500)
        return HTTP.Response(500, 
            ["Content-Type" => "application/json; charset=utf-8", "Access-Control-Allow-Origin" => "*"],
            error_response
        )
    end
end

"""
    perform_path_enumeration_with_limits(network_result, source_node, target_node, max_paths, max_depth) -> PathEnumerationResult

Perform path enumeration with specified limits to prevent memory explosion.
"""
function perform_path_enumeration_with_limits(
    network_result::NetworkAnalysisResult,
    source_node::Union{Int64, Nothing},
    target_node::Union{Int64, Nothing},
    max_paths::Int,
    max_depth::Int
)::PathEnumerationResult
    
    if source_node !== nothing && target_node !== nothing
        # Specific source to target enumeration
        paths = enumerate_paths_between_nodes_limited(
            network_result.outgoing_index, source_node, target_node, max_depth, max_paths
        )
    elseif source_node !== nothing
        # From specific source to all reachable nodes
        paths = enumerate_paths_from_source_limited(
            network_result.outgoing_index, source_node, max_depth, max_paths
        )
    else
        # From all sources to all reachable nodes (most comprehensive)
        paths = enumerate_all_paths_limited(
            network_result.outgoing_index, network_result.source_nodes, max_depth, max_paths
        )
    end
    
    # Calculate path probabilities
    path_probabilities = [
        calculate_path_probability(path, network_result.node_priors, network_result.edge_probabilities)
        for path in paths
    ]
    
    return PathEnumerationResult(paths, path_probabilities, length(paths))
end

"""
    enumerate_paths_between_nodes_limited(outgoing_index, source, target, max_depth, max_paths) -> Vector{Vector{Int64}}

Enumerate paths between specific nodes with limits.
"""
function enumerate_paths_between_nodes_limited(
    outgoing_index::Dict{Int64,Set{Int64}}, 
    source::Int64, 
    target::Int64, 
    max_depth::Int,
    max_paths::Int
)::Vector{Vector{Int64}}
    
    paths = Vector{Vector{Int64}}()
    
    function dfs(current_path::Vector{Int64}, visited::Set{Int64}, depth::Int)
        if length(paths) >= max_paths || depth >= max_depth
            return
        end
        
        current_node = current_path[end]
        if current_node == target
            push!(paths, copy(current_path))
            return
        end
        
        if haskey(outgoing_index, current_node)
            for neighbor in outgoing_index[current_node]
                if neighbor ∉ visited
                    new_path = vcat(current_path, [neighbor])
                    new_visited = copy(visited)
                    push!(new_visited, neighbor)
                    dfs(new_path, new_visited, depth + 1)
                end
            end
        end
    end
    
    dfs([source], Set([source]), 0)
    return paths
end

"""
    enumerate_paths_from_source_limited(outgoing_index, source, max_depth, max_paths) -> Vector{Vector{Int64}}

Enumerate paths from specific source with limits.
"""
function enumerate_paths_from_source_limited(
    outgoing_index::Dict{Int64,Set{Int64}}, 
    source::Int64, 
    max_depth::Int,
    max_paths::Int
)::Vector{Vector{Int64}}
    
    paths = Vector{Vector{Int64}}()
    
    function dfs(current_path::Vector{Int64}, visited::Set{Int64}, depth::Int)
        if length(paths) >= max_paths || depth >= max_depth
            return
        end
        
        current_node = current_path[end]
        
        # Add current path if it's longer than just the source
        if length(current_path) > 1
            push!(paths, copy(current_path))
        end
        
        if haskey(outgoing_index, current_node)
            for neighbor in outgoing_index[current_node]
                if neighbor ∉ visited
                    new_path = vcat(current_path, [neighbor])
                    new_visited = copy(visited)
                    push!(new_visited, neighbor)
                    dfs(new_path, new_visited, depth + 1)
                end
            end
        end
    end
    
    dfs([source], Set([source]), 0)
    return paths
end

"""
    enumerate_all_paths_limited(outgoing_index, source_nodes, max_depth, max_paths) -> Vector{Vector{Int64}}

Enumerate paths from all sources with limits.
"""
function enumerate_all_paths_limited(
    outgoing_index::Dict{Int64,Set{Int64}}, 
    source_nodes::Set{Int64}, 
    max_depth::Int,
    max_paths::Int
)::Vector{Vector{Int64}}
    
    all_paths = Vector{Vector{Int64}}()
    paths_per_source = max(1, div(max_paths, length(source_nodes)))
    
    for source in source_nodes
        if length(all_paths) >= max_paths
            break
        end
        
        remaining_paths = max_paths - length(all_paths)
        source_paths = enumerate_paths_from_source_limited(
            outgoing_index, source, max_depth, min(paths_per_source, remaining_paths)
        )
        append!(all_paths, source_paths)
    end
    
    return all_paths
end

"""
    calculate_path_statistics(path_result, network_result) -> Dict

Calculate detailed statistics about enumerated paths.
"""
function calculate_path_statistics(
    path_result::PathEnumerationResult,
    network_result::NetworkAnalysisResult
)::Dict{String, Any}
    
    if isempty(path_result.paths)
        return Dict{String, Any}(
            "totalPaths" => 0,
            "pathLengthDistribution" => Dict{String, Int}(),
            "probabilityStatistics" => Dict{String, Any}(),
            "nodeFrequency" => Dict{String, Int}(),
            "insights" => ["No paths found in the network"]
        )
    end
    
    # Path length distribution
    path_lengths = [length(path) for path in path_result.paths]
    length_distribution = Dict{String, Int}()
    
    for length in path_lengths
        length_key = string(length)
        length_distribution[length_key] = get(length_distribution, length_key, 0) + 1
    end
    
    # Probability statistics
    prob_stats = Dict{String, Any}(
        "mean" => sum(path_result.path_probabilities) / length(path_result.path_probabilities),
        "min" => minimum(path_result.path_probabilities),
        "max" => maximum(path_result.path_probabilities),
        "standardDeviation" => calculate_std_dev(path_result.path_probabilities)
    )
    
    # Node frequency analysis
    node_frequency = Dict{Int64, Int}()
    for path in path_result.paths
        for node in path
            node_frequency[node] = get(node_frequency, node, 0) + 1
        end
    end
    
    # Convert to string keys for JSON serialization
    node_freq_serializable = Dict{String, Int}(string(k) => v for (k, v) in node_frequency)
    
    # Most/least frequent nodes
    sorted_freq = sort(collect(node_frequency), by = x -> x[2], rev = true)
    most_frequent = length(sorted_freq) > 0 ? sorted_freq[1:min(5, length(sorted_freq))] : []
    least_frequent = length(sorted_freq) > 5 ? sorted_freq[end-4:end] : []
    
    return Dict{String, Any}(
        "totalPaths" => path_result.total_paths,
        "pathLengthDistribution" => length_distribution,
        "pathLengthStatistics" => Dict{String, Any}(
            "mean" => sum(path_lengths) / length(path_lengths),
            "min" => minimum(path_lengths),
            "max" => maximum(path_lengths),
            "mode" => calculate_mode(path_lengths)
        ),
        "probabilityStatistics" => prob_stats,
        "nodeFrequency" => node_freq_serializable,
        "criticalNodes" => Dict{String, Any}(
            "mostFrequent" => [Dict("node" => node, "frequency" => freq) for (node, freq) in most_frequent],
            "leastFrequent" => [Dict("node" => node, "frequency" => freq) for (node, freq) in least_frequent]
        ),
        "insights" => generate_path_insights(path_result, prob_stats, length_distribution, most_frequent)
    )
end

"""
    format_paths_for_response(path_result, max_paths) -> Vector

Format paths for JSON response with probability information.
"""
function format_paths_for_response(path_result::PathEnumerationResult, max_paths::Int)::Vector{Dict{String, Any}}
    
    formatted_paths = Vector{Dict{String, Any}}()
    
    # Sort paths by probability (highest first) and take top max_paths
    path_prob_pairs = collect(zip(path_result.paths, path_result.path_probabilities))
    sort!(path_prob_pairs, by = x -> x[2], rev = true)
    
    for (i, (path, probability)) in enumerate(path_prob_pairs[1:min(max_paths, length(path_prob_pairs))])
        push!(formatted_paths, Dict{String, Any}(
            "pathId" => i,
            "nodes" => path,
            "length" => length(path),
            "probability" => probability,
            "source" => path[1],
            "target" => path[end],
            "intermediateNodes" => length(path) > 2 ? path[2:end-1] : []
        ))
    end
    
    return formatted_paths
end

"""
    determine_search_type(source_node, target_node) -> String

Determine the type of path search being performed.
"""
function determine_search_type(source_node::Union{Int64, Nothing}, target_node::Union{Int64, Nothing})::String
    if source_node !== nothing && target_node !== nothing
        return "specific-to-specific"
    elseif source_node !== nothing
        return "specific-to-all"
    else
        return "all-to-all"
    end
end

"""
    calculate_mode(values) -> Int

Calculate the mode (most frequent value) of a vector.
"""
function calculate_mode(values::Vector{Int})::Int
    if isempty(values)
        return 0
    end
    
    frequency = Dict{Int, Int}()
    for value in values
        frequency[value] = get(frequency, value, 0) + 1
    end
    
    return argmax(frequency)
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
    generate_path_insights(path_result, prob_stats, length_dist, most_frequent) -> Vector

Generate actionable insights based on path enumeration results.
"""
function generate_path_insights(
    path_result::PathEnumerationResult,
    prob_stats::Dict{String, Any},
    length_dist::Dict{String, Int},
    most_frequent::Vector
)::Vector{String}
    
    insights = Vector{String}()
    
    # Path count insights
    if path_result.total_paths == 0
        push!(insights, "No paths found - network may be disconnected or have no valid routes")
        return insights
    elseif path_result.total_paths == 1
        push!(insights, "Single path found - network has unique routing")
    elseif path_result.total_paths > 1000
        push!(insights, "High path redundancy ($(path_result.total_paths) paths) - network is well-connected")
    end
    
    # Probability insights
    mean_prob = get(prob_stats, "mean", 0.0)
    if mean_prob > 0.8
        push!(insights, "High average path probability ($(round(mean_prob, digits=3))) - reliable routing")
    elseif mean_prob < 0.1
        push!(insights, "Low average path probability ($(round(mean_prob, digits=3))) - consider improving edge reliability")
    end
    
    # Length distribution insights
    if haskey(length_dist, "2") && get(length_dist, "2", 0) > length(path_result.paths) * 0.5
        push!(insights, "Many direct connections - efficient network topology")
    end
    
    long_paths = sum(get(length_dist, string(i), 0) for i in 6:20)
    if long_paths > length(path_result.paths) * 0.3
        push!(insights, "Many long paths detected - consider adding shortcuts to improve efficiency")
    end
    
    # Critical node insights
    if !isempty(most_frequent)
        critical_node, frequency = most_frequent[1]
        if frequency > length(path_result.paths) * 0.7
            push!(insights, "Node $critical_node appears in $(frequency) paths - critical bottleneck point")
        end
    end
    
    if isempty(insights)
        push!(insights, "Path enumeration shows balanced network connectivity")
    end
    
    return insights
end

end # module PathEnumEndpoint