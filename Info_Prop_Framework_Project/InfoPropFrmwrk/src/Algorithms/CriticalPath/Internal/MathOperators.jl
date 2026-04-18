#
# STANDARD INVERSE FUNCTIONS
#

"""Inverse of additive node function: input = output - node_value"""
function additive_inverse(output::T, node_value::T) where T
    return output - node_value
end

"""Inverse of multiplicative node function: input = output / node_value"""
function multiplicative_inverse(output::T, node_value::T) where T
    if node_value == zero(T)
        throw(DivideError())
    end
    return output / node_value
end

"""
Inverse of max node function: mathematically exact handling
"""
function max_inverse(output::T, node_value::T) where T
    if output > node_value
        return output
    elseif output == node_value
        throw(ArgumentError("max_inverse is indeterminate: output ($output) equals node_value ($node_value). Multiple solutions exist."))
    else
        throw(ArgumentError("max_inverse has no solution: output ($output) < node_value ($node_value). This violates max function properties."))
    end
end

#
# STANDARD COMBINATION FUNCTIONS
#

"""Maximum combination (standard critical path)"""
function max_combination(values::Vector{T}) where T
    isempty(values) ? zero(T) : maximum(values)
end

"""Minimum combination (bottleneck analysis)"""
function min_combination(values::Vector{T}) where T
    isempty(values) ? typemax(T) : minimum(values)
end

"""Sum combination (additive effects)"""
function sum_combination(values::Vector{T}) where T
    isempty(values) ? zero(T) : sum(values)
end

"""Average combination"""
function avg_combination(values::Vector{T}) where T
    if isempty(values)
        return zero(T)
    end
    return sum(values) / length(values)
end

"""Weighted combination"""
function weighted_combination(weights::Vector{Float64})
    return function(values::Vector{T}) where T
        if isempty(values)
            return zero(T)
        end
        if length(weights) != length(values)
            throw(ArgumentError("Weights and values must have same length"))
        end
        return sum(w * v for (w, v) in zip(weights, values))
    end
end

#
# STANDARD PROPAGATION FUNCTIONS
#

"""Additive propagation (parent + edge)"""
function additive_propagation(parent_value::T, edge_value::T) where T
    return parent_value + edge_value
end

"""Multiplicative propagation (parent * edge)"""
function multiplicative_propagation(parent_value::T, edge_value::T) where T
    return parent_value * edge_value
end

"""Maximum propagation (max(parent, edge))"""
function max_propagation(parent_value::T, edge_value::T) where T
    return max(parent_value, edge_value)
end

"""Minimum propagation (min(parent, edge))"""
function min_propagation(parent_value::T, edge_value::T) where T
    return min(parent_value, edge_value)
end

"""Custom power propagation"""
function power_propagation(exponent::Float64)
    return function(parent_value::T, edge_value::T) where T
        if edge_value == zero(T) && exponent < 0
            throw(DomainError(edge_value, "Cannot raise zero to negative power"))
        end
        if edge_value < zero(T) && !isinteger(exponent)
            throw(DomainError(edge_value, "Cannot raise negative number to non-integer power"))
        end
        return parent_value + edge_value^exponent
    end
end
