#
# CONFIGURABLE PARAMETERS
#

"""
Parameters for generalized critical path analysis
T: Type of values being propagated (Float64, TimeUnit, Cost, etc.)
"""
struct CriticalPathParameters{T}
    node_values::Dict{Int64, T}
    edge_values::Dict{Tuple{Int64,Int64}, T}
    initial_value::T
    combination_function::Function
    propagation_function::Function
    node_function::Function

    function CriticalPathParameters(
        node_values::Dict{Int64, T},
        edge_values::Dict{Tuple{Int64,Int64}, T},
        initial_value::T,
        combination_function::Function = max_combination,
        propagation_function::Function = additive_propagation,
        node_function::Function = additive_propagation
    ) where T
        new{T}(node_values, edge_values, initial_value,
               combination_function, propagation_function, node_function)
    end
end

"""
Results from critical path analysis
"""
struct CriticalPathResult{T}
    node_values::Dict{Int64, T}
    critical_value::T
    critical_nodes::Vector{Int64}

    function CriticalPathResult(node_values::Dict{Int64, T}) where T
        values_collection = collect(values(node_values))
        critical_val = Base.maximum(values_collection)
        critical_nodes = [node for (node, val) in node_values if val == critical_val]
        new{T}(node_values, critical_val, critical_nodes)
    end
end

"""
Extended results from critical path analysis including backward pass data.
Contains Early Start/Finish, Late Start/Finish, and Total Slack per node.
"""
struct ExtendedCriticalPathResult{T}
    node_values::Dict{Int64, T}
    early_start::Dict{Int64, T}
    late_finish::Dict{Int64, T}
    late_start::Dict{Int64, T}
    total_slack::Dict{Int64, T}
    critical_value::T
    critical_nodes::Vector{Int64}
end
