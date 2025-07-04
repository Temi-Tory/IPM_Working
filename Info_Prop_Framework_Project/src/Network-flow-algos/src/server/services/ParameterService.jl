"""
ParameterService.jl

Centralized parameter override logic for node priors and edge probabilities.
Handles both individual and global parameter overrides with strict typing.
"""
module ParameterService

export apply_parameter_overrides!, ParameterOverrideResult, validate_parameter_data

# Strict type definition for parameter override results
struct ParameterOverrideResult
    nodes_individually_modified::Int
    edges_individually_modified::Int
    nodes_globally_modified::Int
    edges_globally_modified::Int
    total_nodes_modified::Int
    total_edges_modified::Int
    use_individual_overrides::Bool
end

"""
    apply_parameter_overrides!(node_priors, edge_probabilities, request_data) -> ParameterOverrideResult

Apply parameter overrides to node priors and edge probabilities based on request data.
Handles both individual and global overrides with proper precedence.

# Arguments
- `node_priors::Dict{Int64, Float64}`: Mutable dictionary of node priors
- `edge_probabilities::Dict{Tuple{Int64,Int64}, Float64}`: Mutable dictionary of edge probabilities  
- `request_data::Dict`: HTTP request data containing override parameters

# Returns
- `ParameterOverrideResult`: Summary of modifications made
"""
function apply_parameter_overrides!(
    node_priors::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    request_data::Dict
)::ParameterOverrideResult
    
    # Extract override flags and values from request
    use_individual_overrides = get(request_data, "useIndividualOverrides", false)
    override_node_prior = get(request_data, "overrideNodePrior", false)
    override_edge_prob = get(request_data, "overrideEdgeProb", false)
    global_node_prior = get(request_data, "nodePrior", 1.0)
    global_edge_prob = get(request_data, "edgeProb", 0.9)
    
    # Initialize counters
    nodes_individually_modified = 0
    edges_individually_modified = 0
    nodes_globally_modified = 0
    edges_globally_modified = 0
    
    # Step 1: Apply individual parameter overrides FIRST (higher precedence)
    if use_individual_overrides
        println("🎛️ Applying individual parameter overrides...")
        nodes_individually_modified, edges_individually_modified = apply_individual_overrides!(
            node_priors, edge_probabilities, request_data
        )
    end
    
    # Step 2: Apply global overrides AFTER individual overrides (lower precedence)
    if override_node_prior
        println("🔄 Applying global node prior override: $global_node_prior")
        nodes_globally_modified = apply_global_node_override!(node_priors, Float64(global_node_prior))
    end
    
    if override_edge_prob
        println("🔄 Applying global edge probability override: $global_edge_prob")
        edges_globally_modified = apply_global_edge_override!(edge_probabilities, Float64(global_edge_prob))
    end
    
    # Calculate totals
    total_nodes_modified = nodes_individually_modified + nodes_globally_modified
    total_edges_modified = edges_individually_modified + edges_globally_modified
    
    if total_nodes_modified > 0 || total_edges_modified > 0
        println("📊 Parameter override summary: $total_nodes_modified nodes, $total_edges_modified edges modified")
    end
    
    return ParameterOverrideResult(
        nodes_individually_modified,
        edges_individually_modified,
        nodes_globally_modified,
        edges_globally_modified,
        total_nodes_modified,
        total_edges_modified,
        use_individual_overrides
    )
end

"""
    apply_individual_overrides!(node_priors, edge_probabilities, request_data) -> Tuple{Int, Int}

Apply individual parameter overrides from request data.
Returns tuple of (nodes_modified, edges_modified).
"""
function apply_individual_overrides!(
    node_priors::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    request_data::Dict
)::Tuple{Int, Int}
    
    if !haskey(request_data, "useIndividualOverrides") || !request_data["useIndividualOverrides"]
        return 0, 0
    end
    
    nodes_modified = 0
    edges_modified = 0
    
    # Apply individual node prior overrides
    if haskey(request_data, "individualNodePriors")
        nodes_modified = apply_individual_node_overrides!(
            node_priors, request_data["individualNodePriors"]
        )
    end
    
    # Apply individual edge probability overrides
    if haskey(request_data, "individualEdgeProbabilities")
        edges_modified = apply_individual_edge_overrides!(
            edge_probabilities, request_data["individualEdgeProbabilities"]
        )
    end
    
    return nodes_modified, edges_modified
end

"""
    apply_individual_node_overrides!(node_priors, individual_node_priors) -> Int

Apply individual node prior overrides. Returns number of nodes modified.
"""
function apply_individual_node_overrides!(
    node_priors::Dict{Int64, Float64},
    individual_node_priors::Dict
)::Int
    
    nodes_modified = 0
    
    for (node_key, new_value) in individual_node_priors
        try
            node_id = parse(Int64, string(node_key))
            if haskey(node_priors, node_id)
                old_value = node_priors[node_id]
                node_priors[node_id] = Float64(new_value)
                nodes_modified += 1
                println("🎛️ Override node $node_id prior: $old_value → $new_value")
            else
                println("⚠️ Warning: Node $node_id not found in original priors")
            end
        catch e
            println("⚠️ Warning: Failed to parse node ID '$node_key': $e")
        end
    end
    
    return nodes_modified
end

"""
    apply_individual_edge_overrides!(edge_probabilities, individual_edge_probs) -> Int

Apply individual edge probability overrides. Returns number of edges modified.
"""
function apply_individual_edge_overrides!(
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    individual_edge_probs::Dict
)::Int
    
    edges_modified = 0
    
    for (edge_key, new_value) in individual_edge_probs
        try
            edge_tuple = parse_edge_key(string(edge_key))
            if edge_tuple !== nothing && haskey(edge_probabilities, edge_tuple)
                old_value = edge_probabilities[edge_tuple]
                edge_probabilities[edge_tuple] = Float64(new_value)
                edges_modified += 1
                println("🎛️ Override edge $edge_tuple probability: $old_value → $new_value")
            else
                println("⚠️ Warning: Edge $edge_key not found in original probabilities")
            end
        catch e
            println("⚠️ Warning: Failed to parse edge key '$edge_key': $e")
        end
    end
    
    return edges_modified
end

"""
    apply_global_node_override!(node_priors, global_value) -> Int

Apply global node prior override to all nodes. Returns number of nodes modified.
"""
function apply_global_node_override!(
    node_priors::Dict{Int64, Float64},
    global_value::Float64
)::Int
    
    nodes_modified = 0
    
    for (node_id, current_value) in node_priors
        if current_value != global_value
            nodes_modified += 1
        end
        node_priors[node_id] = global_value
    end
    
    return nodes_modified
end

"""
    apply_global_edge_override!(edge_probabilities, global_value) -> Int

Apply global edge probability override to all edges. Returns number of edges modified.
"""
function apply_global_edge_override!(
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    global_value::Float64
)::Int
    
    edges_modified = 0
    
    for (edge_key, current_value) in edge_probabilities
        if current_value != global_value
            edges_modified += 1
        end
        edge_probabilities[edge_key] = global_value
    end
    
    return edges_modified
end

"""
    parse_edge_key(edge_key_str) -> Union{Tuple{Int64,Int64}, Nothing}

Parse edge key string in format "(src,dst)" to tuple (src, dst).
Returns nothing if parsing fails.
"""
function parse_edge_key(edge_key_str::String)::Union{Tuple{Int64,Int64}, Nothing}
    try
        if startswith(edge_key_str, "(") && endswith(edge_key_str, ")")
            inner = edge_key_str[2:end-1]
            parts = split(inner, ",")
            if length(parts) == 2
                from_node = parse(Int64, strip(parts[1]))
                to_node = parse(Int64, strip(parts[2]))
                return (from_node, to_node)
            end
        end
    catch e
        # Parsing failed, return nothing
    end
    return nothing
end

"""
    validate_parameter_data(request_data) -> Bool

Validate parameter override data from HTTP request.
Returns true if valid, false otherwise.
"""
function validate_parameter_data(request_data::Dict)::Bool
    try
        # Check for required fields when individual overrides are used
        if get(request_data, "useIndividualOverrides", false)
            if haskey(request_data, "individualNodePriors")
                node_priors = request_data["individualNodePriors"]
                if !isa(node_priors, Dict)
                    println("⚠️ Invalid individualNodePriors: must be a dictionary")
                    return false
                end
                
                # Validate node prior values
                for (key, value) in node_priors
                    if !isa(value, Number) || value < 0 || value > 1
                        println("⚠️ Invalid node prior value for $key: $value (must be 0-1)")
                        return false
                    end
                end
            end
            
            if haskey(request_data, "individualEdgeProbabilities")
                edge_probs = request_data["individualEdgeProbabilities"]
                if !isa(edge_probs, Dict)
                    println("⚠️ Invalid individualEdgeProbabilities: must be a dictionary")
                    return false
                end
                
                # Validate edge probability values
                for (key, value) in edge_probs
                    if !isa(value, Number) || value < 0 || value > 1
                        println("⚠️ Invalid edge probability value for $key: $value (must be 0-1)")
                        return false
                    end
                end
            end
        end
        
        # Validate global override values
        if haskey(request_data, "nodePrior")
            node_prior = request_data["nodePrior"]
            if !isa(node_prior, Number) || node_prior < 0 || node_prior > 1
                println("⚠️ Invalid global node prior: $node_prior (must be 0-1)")
                return false
            end
        end
        
        if haskey(request_data, "edgeProb")
            edge_prob = request_data["edgeProb"]
            if !isa(edge_prob, Number) || edge_prob < 0 || edge_prob > 1
                println("⚠️ Invalid global edge probability: $edge_prob (must be 0-1)")
                return false
            end
        end
        
        return true
        
    catch e
        println("⚠️ Parameter validation error: $e")
        return false
    end
end

end # module ParameterService