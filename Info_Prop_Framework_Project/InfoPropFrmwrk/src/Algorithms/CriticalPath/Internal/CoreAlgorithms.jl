#
# MAIN CRITICAL PATH ALGORITHM
#

"""
Generalized critical path analysis using our existing topological framework
"""
function critical_path_analysis(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    params::CriticalPathParameters{T}
)::CriticalPathResult{T} where T

    node_results = Dict{Int64, T}()

    for node_set in iteration_sets
        for node in node_set
            if node in source_nodes
                node_results[node] = params.node_function(
                    params.initial_value,
                    get(params.node_values, node, zero(T))
                )
            else
                parent_values = T[]

                for parent in incoming_index[node]
                    if !haskey(node_results, parent)
                        throw(ErrorException("Parent node $parent of node $node not processed. Check topological order."))
                    end

                    parent_result = node_results[parent]
                    edge_value = get(params.edge_values, (parent, node), zero(T))
                    propagated_value = params.propagation_function(parent_result, edge_value)
                    push!(parent_values, propagated_value)
                end

                combined_input = params.combination_function(parent_values)

                node_results[node] = params.node_function(
                    combined_input,
                    get(params.node_values, node, zero(T))
                )
            end
        end
    end

    return CriticalPathResult(node_results)
end

"""
Backward pass analysis for additive CPM systems.
"""
function backward_pass_analysis(
    forward_result::CriticalPathResult{T},
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    params::CriticalPathParameters{T}
)::ExtendedCriticalPathResult{T} where T

    critical_value = forward_result.critical_value
    ef = forward_result.node_values

    all_nodes = keys(ef)
    sink_nodes = Set{Int64}()
    for node in all_nodes
        successors = get(outgoing_index, node, Set{Int64}())
        if isempty(successors)
            push!(sink_nodes, node)
        end
    end

    lf = Dict{Int64, T}()

    for i in length(iteration_sets):-1:1
        for node in iteration_sets[i]
            if !haskey(ef, node)
                continue
            end

            if node in sink_nodes
                lf[node] = critical_value
            else
                successors = get(outgoing_index, node, Set{Int64}())
                min_val = critical_value

                for successor in successors
                    if !haskey(lf, successor)
                        continue
                    end

                    successor_duration = get(params.node_values, successor, zero(T))
                    ls_successor = lf[successor] - successor_duration
                    edge_value = get(params.edge_values, (node, successor), zero(T))
                    candidate = ls_successor - edge_value

                    if candidate < min_val
                        min_val = candidate
                    end
                end

                lf[node] = min_val
            end
        end
    end

    es = Dict{Int64, T}()
    ls = Dict{Int64, T}()
    total_slack = Dict{Int64, T}()

    for node in all_nodes
        node_duration = get(params.node_values, node, zero(T))
        es[node] = ef[node] - node_duration

        if haskey(lf, node)
            ls[node] = lf[node] - node_duration
            total_slack[node] = ls[node] - es[node]
        end
    end

    return ExtendedCriticalPathResult{T}(
        ef,
        es,
        lf,
        ls,
        total_slack,
        critical_value,
        forward_result.critical_nodes
    )
end
