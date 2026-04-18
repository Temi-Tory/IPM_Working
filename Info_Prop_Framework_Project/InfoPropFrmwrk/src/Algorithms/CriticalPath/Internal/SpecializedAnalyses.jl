#
# SPECIALIZED ANALYSIS FUNCTIONS
#

"""
Enhanced time-based critical path analysis using NonNegativeTime for mathematical exactness.
"""
function time_critical_path(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    task_durations::Union{Dict{Int64, Float64}, Dict{Int64, TimeUnit}},
    edge_delays::Union{Dict{Tuple{Int64,Int64}, Float64}, Dict{Tuple{Int64,Int64}, TimeUnit}} = Dict{Tuple{Int64,Int64}, TimeUnit}(),
    start_time::Union{Float64, TimeUnit} = NonNegativeTime(0.0)
)
    time_durations = if isa(task_durations, Dict{Int64, Float64})
        Dict(node => NonNegativeTime(dur) for (node, dur) in task_durations)
    else
        task_durations
    end

    time_delays = if isa(edge_delays, Dict{Tuple{Int64,Int64}, Float64})
        Dict(edge => NonNegativeTime(delay) for (edge, delay) in edge_delays)
    else
        edge_delays
    end

    time_start = isa(start_time, Float64) ? NonNegativeTime(start_time) : start_time

    time_params = TimeFlowParameters(time_durations, time_delays, time_start)

    completion_times = time_update_beliefs_iterative(
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        time_params
    )

    return completion_times
end

"""
Enhanced time flow analysis function with exact NonNegativeTime calculations
"""
function time_update_beliefs_iterative(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    time_params::TimeFlowParameters
)
    completion_times = Dict{Int64, TimeUnit}()

    for node_set in iteration_sets
        for node in node_set
            if node in source_nodes
                completion_times[node] = time_params.project_start_time +
                                       get(time_params.task_durations, node, NonNegativeTime(0.0))
            else
                latest_prerequisite = time_params.project_start_time

                for parent in incoming_index[node]
                    if !haskey(completion_times, parent)
                        throw(ErrorException("Parent node $parent of node $node has no completion time. Processing order error."))
                    end

                    parent_completion = completion_times[parent]
                    edge_delay = get(time_params.dependency_delays, (parent, node), NonNegativeTime(0.0))
                    latest_prerequisite = max(latest_prerequisite, parent_completion + edge_delay)
                end

                completion_times[node] = latest_prerequisite + get(time_params.task_durations, node, NonNegativeTime(0.0))
            end
        end
    end

    return completion_times
end

"""
Cost analysis (sum all costs along paths)
"""
function cost_critical_path(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_costs::Dict{Int64, Float64},
    edge_costs::Dict{Tuple{Int64,Int64}, Float64} = Dict{Tuple{Int64,Int64}, Float64}(),
    start_cost::Float64 = 0.0
)
    params = CriticalPathParameters(
        node_costs,
        edge_costs,
        start_cost,
        max_combination,
        additive_propagation,
        additive_propagation
    )

    return critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, params)
end

"""
Severity accumulation analysis
"""
function severity_analysis(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_severitys::Dict{Int64, Float64},
    edge_severitys::Dict{Tuple{Int64,Int64}, Float64} = Dict{Tuple{Int64,Int64}, Float64}(),
    base_severity::Float64 = 0.0
)
    function severity_combination(severitys::Vector{Float64})::Float64
        if isempty(severitys)
            return 0.0
        end
        return maximum(severitys)
    end

    params = CriticalPathParameters(
        node_severitys,
        edge_severitys,
        base_severity,
        severity_combination,
        additive_propagation,
        additive_propagation
    )

    return critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, params)
end
