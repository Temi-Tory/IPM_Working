# Analysis/Sensitivity.jl
# Sensitivity analysis - compute marginal values for capacity changes
# Phase 3: Advanced Analysis

# Conditional includes for standalone use
if !isdefined(@__MODULE__, :NetworkTopology)
    include("../Core/Types.jl")
end

"""
Compute sensitivity analysis for all edges and nodes

Calculates marginal values: ∂(max_flow)/∂(capacity)
This tells us how much increasing capacity at each component would improve max flow

# Arguments
- All standard topology/flow/capacity arguments
- `delta_capacity`: Step size for finite-difference approximation (default: 1.0)
  - If > 0, uses numerical finite-difference (expensive but accurate)
  - If 0 or negative, uses fast heuristic (default)

# Returns
- edge_marginal_values: Dict mapping edges to marginal value (0.0 to 1.0)
- node_marginal_values: Dict mapping nodes to marginal value
- investment_efficiency: Combined dict with marginal_value * utilization for each component
"""
function compute_sensitivity_analysis(
    topology::NetworkTopology,
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64},
    min_cut_edges::Set{Tuple{Int64,Int64}},
    min_cut_nodes::Set{Int64},
    current_max_flow::Float64;
    tolerance::Float64 = 1e-10,
    delta_capacity::Float64 = 1.0,
    use_numerical_marginals::Bool = false,
    compute_max_flow_function = nothing
)
    edge_marginal_values = Dict{Tuple{Int64,Int64}, Float64}()
    node_marginal_values = Dict{Int64, Float64}()
    
    if use_numerical_marginals && compute_max_flow_function !== nothing && delta_capacity > 0.0
        # Use accurate numerical finite-difference method
        
        # Edge sensitivity
        for (edge, capacity) in edge_capacities
            if isinf(capacity)
                edge_marginal_values[edge] = 0.0
                continue
            end
            
            marginal_value = compute_numerical_marginal_value(
                edge,
                topology,
                edge_capacities,
                node_capacities,
                source_rates,
                target_nodes,
                current_max_flow,
                compute_max_flow_function = compute_max_flow_function,
                delta = delta_capacity,
                tolerance = tolerance
            )
            edge_marginal_values[edge] = marginal_value
        end
        
        # Node sensitivity
        for (node, capacity) in node_capacities
            if isinf(capacity)
                node_marginal_values[node] = 0.0
                continue
            end
            
            marginal_value = compute_numerical_marginal_value(
                node,
                topology,
                edge_capacities,
                node_capacities,
                source_rates,
                target_nodes,
                current_max_flow,
                compute_max_flow_function = compute_max_flow_function,
                delta = delta_capacity,
                tolerance = tolerance
            )
            node_marginal_values[node] = marginal_value
        end
    else
        # Use fast heuristic approximation
        
        # Edge sensitivity
        for (edge, capacity) in edge_capacities
            if isinf(capacity)
                edge_marginal_values[edge] = 0.0
                continue
            end
            
            flow = get(edge_flows, edge, 0.0)
            utilization = capacity > 0.0 ? flow / capacity : 0.0
            
            # Marginal value approximation
            if edge in min_cut_edges
                # Critical edge - increasing capacity directly helps
                marginal_value = 1.0
            elseif utilization > 0.95
                # Near-saturated - likely to help if min-cut shifts
                marginal_value = 0.5
            else
                # Has spare capacity - won't help immediately
                marginal_value = 0.0
            end
            
            edge_marginal_values[edge] = marginal_value
        end
        
        # Node sensitivity
        for (node, capacity) in node_capacities
            if isinf(capacity)
                node_marginal_values[node] = 0.0
                continue
            end
            
            flow = get(node_flows, node, 0.0)
            utilization = capacity > 0.0 ? flow / capacity : 0.0
            
            # Marginal value approximation
            if node in min_cut_nodes
                # Critical node - increasing capacity directly helps
                marginal_value = 1.0
            elseif utilization > 0.95
                # Near-saturated
                marginal_value = 0.5
            else
                # Has spare capacity
                marginal_value = 0.0
            end
            
            node_marginal_values[node] = marginal_value
        end
    end
    
    # Combined investment efficiency map
    investment_efficiency = compute_investment_efficiency(
        edge_flows, node_flows, edge_capacities, node_capacities,
        edge_marginal_values, node_marginal_values
    )
    
    return edge_marginal_values, node_marginal_values, investment_efficiency
end

"""
Compute numerical marginal value by finite difference

More accurate but expensive: actually run flow computation with increased capacity

# Arguments
- `increase_component`: Component to increase (edge tuple or node ID)
- Rest: standard problem inputs

# Returns
- Approximate ∂(max_flow)/∂(capacity) using finite difference
"""
function compute_numerical_marginal_value(
    increase_component::Union{Int64, Tuple{Int64,Int64}},
    topology::NetworkTopology,
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64},
    current_max_flow::Float64;
    compute_max_flow_function,  # Function to call for max-flow
    delta::Float64 = 1.0,
    tolerance::Float64 = 1e-10
)
    # Create modified capacities
    modified_edge_capacities = copy(edge_capacities)
    modified_node_capacities = copy(node_capacities)
    
    if increase_component isa Tuple  # Edge
        current_cap = get(edge_capacities, increase_component, Inf)
        if isinf(current_cap)
            return 0.0
        end
        modified_edge_capacities[increase_component] = current_cap + delta
    else  # Node
        current_cap = get(node_capacities, increase_component, Inf)
        if isinf(current_cap)
            return 0.0
        end
        modified_node_capacities[increase_component] = current_cap + delta
    end
    
    # Recompute max flow with increased capacity
    _, _, new_max_flow = compute_max_flow_function(
        topology.iteration_sets,
        topology.outgoing_index,
        topology.incoming_index,
        topology.source_nodes,
        modified_node_capacities,
        modified_edge_capacities,
        source_rates,
        target_nodes,
        tolerance = tolerance
    )
    
    # Compute marginal value
    marginal_value = (new_max_flow - current_max_flow) / delta
    
    return max(0.0, marginal_value)  # Can't be negative
end

"""
Compute investment efficiency: bang for buck

Takes into account both marginal value and current utilization
Components with high utilization and high marginal value are best investments
"""
function compute_investment_efficiency(
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    edge_marginal_values::Dict{Tuple{Int64,Int64}, Float64},
    node_marginal_values::Dict{Int64, Float64}
)
    efficiency = Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}()
    
    # Edge efficiency
    for (edge, marginal_value) in edge_marginal_values
        capacity = get(edge_capacities, edge, Inf)
        flow = get(edge_flows, edge, 0.0)
        
        if isinf(capacity) || capacity == 0.0
            efficiency[edge] = 0.0
        else
            utilization = flow / capacity
            # Efficiency = marginal_value * utilization
            # High when both saturated AND critical
            efficiency[edge] = marginal_value * utilization
        end
    end
    
    # Node efficiency
    for (node, marginal_value) in node_marginal_values
        capacity = get(node_capacities, node, Inf)
        flow = get(node_flows, node, 0.0)
        
        if isinf(capacity) || capacity == 0.0
            efficiency[node] = 0.0
        else
            utilization = flow / capacity
            efficiency[node] = marginal_value * utilization
        end
    end
    
    return efficiency
end

# Export functions
export compute_sensitivity_analysis, compute_numerical_marginal_value, 
       compute_investment_efficiency
