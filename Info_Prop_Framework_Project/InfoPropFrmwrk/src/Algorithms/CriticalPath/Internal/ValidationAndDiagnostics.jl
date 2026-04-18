"""
Validation function for time parameters - simplified since type system enforces non-negative
"""
function validate_time_parameters(
    task_durations::Dict{Int64, TimeUnit},
    dependency_delays::Dict{Tuple{Int64,Int64}, TimeUnit},
    edgelist::Vector{Tuple{Int64,Int64}}
)
    # No need to check for negative durations/delays - type system prevents them!

    # Check that all edges have delay values
    missing_delays = missing_values_for_edgelist(edgelist, dependency_delays)
    if !isempty(missing_delays)
        @warn "Missing delay values for edges: $missing_delays. Defaulting to 0.0 hours."
    end

    return true
end

"""
Validate that results match expected critical path properties
"""
function validate_critical_path(
    result::CriticalPathResult{T},
    incoming_index::Dict{Int64,Set{Int64}},
    params::CriticalPathParameters{T}
)::Bool where T

    # Check that all node values are consistent with their inputs
    for (node, value) in result.node_values
        if !isempty(get(incoming_index, node, Set{Int64}()))
            parent_values = T[]

            for parent in incoming_index[node]
                parent_result = result.node_values[parent]
                edge_value = get(params.edge_values, (parent, node), zero(T))
                propagated = params.propagation_function(parent_result, edge_value)
                push!(parent_values, propagated)
            end

            expected_input = params.combination_function(parent_values)
            expected_output = params.node_function(expected_input, get(params.node_values, node, zero(T)))

            # Exact comparison without tolerance
            if expected_output != value
                @warn "Inconsistent value at node $node: expected $expected_output, got $value"
                return false
            end
        end
    end

    return true
end
