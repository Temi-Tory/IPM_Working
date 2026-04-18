#
# UTILITY FUNCTIONS
#

"""
Find all nodes on critical paths (ADDITIVE NODE FUNCTIONS ONLY)
"""
function find_critical_path_nodes_additive(
    result::CriticalPathResult{T},
    incoming_index::Dict{Int64,Set{Int64}},
    params::CriticalPathParameters{T}
)::Vector{Vector{Int64}} where T

    critical_paths = Vector{Vector{Int64}}()

    for end_node in result.critical_nodes
        path = [end_node]
        current = end_node

        while !isempty(get(incoming_index, current, Set{Int64}()))
            found_critical_parent = false

            for parent in incoming_index[current]
                parent_result = result.node_values[parent]
                edge_value = get(params.edge_values, (parent, current), zero(T))
                propagated = params.propagation_function(parent_result, edge_value)
                node_value = get(params.node_values, current, zero(T))
                expected_input = result.node_values[current] - node_value

                if propagated == expected_input
                    pushfirst!(path, parent)
                    current = parent
                    found_critical_parent = true
                    break
                end
            end

            if !found_critical_parent
                break
            end
        end

        push!(critical_paths, path)
    end

    return critical_paths
end

"""
General critical path finding with custom inverse function
"""
function find_critical_path_nodes_general(
    result::CriticalPathResult{T},
    incoming_index::Dict{Int64,Set{Int64}},
    params::CriticalPathParameters{T},
    inverse_node_function::Function
)::Vector{Vector{Int64}} where T

    critical_paths = Vector{Vector{Int64}}()

    for end_node in result.critical_nodes
        path = [end_node]
        current = end_node

        while !isempty(get(incoming_index, current, Set{Int64}()))
            found_critical_parent = false

            for parent in incoming_index[current]
                parent_result = result.node_values[parent]
                edge_value = get(params.edge_values, (parent, current), zero(T))
                propagated = params.propagation_function(parent_result, edge_value)
                node_value = get(params.node_values, current, zero(T))
                expected_input = inverse_node_function(result.node_values[current], node_value)

                if propagated == expected_input
                    pushfirst!(path, parent)
                    current = parent
                    found_critical_parent = true
                    break
                end
            end

            if !found_critical_parent
                break
            end
        end

        push!(critical_paths, path)
    end

    return critical_paths
end

"""
Calculate exact slack/float for additive systems
"""
function calculate_slack_additive(
    result::CriticalPathResult{T}
)::Dict{Int64, T} where T

    slack = Dict{Int64, T}()

    for (node, value) in result.node_values
        slack[node] = result.critical_value - value
    end

    return slack
end

"""
Calculate exact slack/float for multiplicative systems
"""
function calculate_slack_multiplicative(
    result::CriticalPathResult{T}
)::Dict{Int64, Float64} where T

    slack = Dict{Int64, Float64}()

    for (node, value) in result.node_values
        if value == zero(T)
            throw(DivideError())
        end
        slack[node] = Float64(result.critical_value) / Float64(value)
    end

    return slack
end

"""
General slack calculation with custom slack function
"""
function calculate_slack_general(
    result::CriticalPathResult{T},
    slack_function::Function
)::Dict{Int64, Any} where T

    slack = Dict{Int64, Any}()

    for (node, value) in result.node_values
        slack[node] = slack_function(result.critical_value, value)
    end

    return slack
end

#
# TIME ANALYSIS UTILITY FUNCTIONS
#

"""
Get total project duration from completion times
"""
function project_duration(completion_times::Dict{Int64, TimeUnit})
    time_values = collect(values(completion_times))
    return Base.maximum(t.hours for t in time_values) |> NonNegativeTime
end

"""
Find nodes on critical path (nodes that complete at project end time)
"""
function critical_path_nodes(completion_times::Dict{Int64, TimeUnit})
    time_values = collect(values(completion_times))
    max_time = NonNegativeTime(Base.maximum(t.hours for t in time_values))
    return [node for (node, time) in completion_times if time ≈ max_time]
end

"""
Format results in different time units
"""
function format_time_results(completion_times::Dict{Int64, TimeUnit}, output_unit::Symbol = :hours)
    return Dict(
        node => from_hours(time, output_unit)
        for (node, time) in completion_times
    )
end
