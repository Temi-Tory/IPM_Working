# Analysis/Recommendations.jl
# Upgrade recommendations using sensitivity analysis
# Phase 3: Advanced Analysis

# Conditional includes for standalone use
if !isdefined(@__MODULE__, :EdgeUpgradeRecommendation)
    include("../Core/Types.jl")
end

"""
Generate upgrade recommendations using sensitivity analysis

This is an enhanced version that uses actual marginal values from sensitivity analysis
"""
function generate_upgrade_recommendations(
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    edge_marginal_values::Dict{Tuple{Int64,Int64}, Float64},
    node_marginal_values::Dict{Int64, Float64},
    investment_efficiency::Dict{Union{Int64, Tuple{Int64,Int64}}, Float64},
    min_cut_edges::Set{Tuple{Int64,Int64}},
    min_cut_nodes::Set{Int64},
    bottlenecks::BottleneckReport{Float64}
)
    edge_priorities = EdgeUpgradeRecommendation{Float64}[]
    node_priorities = NodeUpgradeRecommendation{Float64}[]
    
    # Generate edge recommendations
    for (edge, capacity) in edge_capacities
        if isinf(capacity) || capacity == 0.0
            continue
        end
        
        flow = get(edge_flows, edge, 0.0)
        utilization = flow / capacity
        marginal_value = get(edge_marginal_values, edge, 0.0)
        efficiency = get(investment_efficiency, edge, 0.0)
        
        # Calculate priority score
        # Priority = weighted combination of:
        # - Marginal value (50%): will it help?
        # - Utilization (30%): is it needed?
        # - Min-cut membership (20%): is it critical?
        priority_score = (
            0.5 * marginal_value +
            0.3 * utilization +
            0.2 * (edge in min_cut_edges ? 1.0 : 0.0)
        )
        
        # Recommended capacity increase
        recommended_capacity = if utilization > 0.95
            capacity * 1.2  # +20% for saturated
        elseif utilization > 0.8
            capacity * 1.1  # +10% for heavily used
        else
            capacity  # No change needed
        end
        
        expected_increase = (recommended_capacity - capacity) * marginal_value
        
        # Generate rationale
        rationale = generate_edge_rationale(
            edge, capacity, flow, utilization,
            marginal_value, min_cut_edges
        )
        
        rec = EdgeUpgradeRecommendation{Float64}(
            edge, capacity, flow, utilization,
            marginal_value, recommended_capacity, expected_increase,
            priority_score, rationale
        )
        push!(edge_priorities, rec)
    end
    
    # Generate node recommendations
    for (node, capacity) in node_capacities
        if isinf(capacity) || capacity == 0.0
            continue
        end
        
        flow = get(node_flows, node, 0.0)
        utilization = flow / capacity
        marginal_value = get(node_marginal_values, node, 0.0)
        efficiency = get(investment_efficiency, node, 0.0)
        
        # Calculate priority score (same formula as edges)
        priority_score = (
            0.5 * marginal_value +
            0.3 * utilization +
            0.2 * (node in min_cut_nodes ? 1.0 : 0.0)
        )
        
        recommended_capacity = if utilization > 0.95
            capacity * 1.2
        elseif utilization > 0.8
            capacity * 1.1
        else
            capacity
        end
        
        expected_increase = (recommended_capacity - capacity) * marginal_value
        
        rationale = generate_node_rationale(
            node, capacity, flow, utilization,
            marginal_value, min_cut_nodes
        )
        
        rec = NodeUpgradeRecommendation{Float64}(
            node, capacity, flow, utilization,
            marginal_value, recommended_capacity, expected_increase,
            priority_score, rationale
        )
        push!(node_priorities, rec)
    end
    
    # Sort by priority
    sort!(edge_priorities, by = r -> r.priority_score, rev = true)
    sort!(node_priorities, by = r -> r.priority_score, rev = true)
    
    # Generate strategic summary
    primary_bottleneck = generate_primary_bottleneck_description(
        min_cut_edges, min_cut_nodes, bottlenecks.bottleneck_type
    )
    
    recommended_action = generate_recommended_action(
        edge_priorities, node_priorities, primary_bottleneck
    )
    
    return UpgradeAnalysis{Float64}(
        edge_priorities,
        node_priorities,
        primary_bottleneck,
        recommended_action,
        investment_efficiency
    )
end

"""
Generate plain-language rationale for edge upgrade
"""
function generate_edge_rationale(
    edge::Tuple{Int64,Int64},
    capacity::Float64,
    flow::Float64,
    utilization::Float64,
    marginal_value::Float64,
    min_cut_edges::Set{Tuple{Int64,Int64}}
)::String
    if edge in min_cut_edges && utilization > 0.95
        return "Critical bottleneck: Part of minimum cut and operating at $(round(utilization*100, digits=1))% capacity. Upgrading will directly increase maximum flow."
    elseif edge in min_cut_edges
        return "Part of minimum cut constraining network flow. Currently at $(round(utilization*100, digits=1))% utilization."
    elseif marginal_value > 0.5 && utilization > 0.9
        return "High priority: Near capacity at $(round(utilization*100, digits=1))% and likely to become bottleneck. Marginal value: $(round(marginal_value, digits=2))."
    elseif utilization > 0.95
        return "Near capacity: Operating at $(round(utilization*100, digits=1))%. Consider upgrading to prevent future congestion."
    elseif utilization > 0.7
        return "Moderate utilization: Currently at $(round(utilization*100, digits=1))%. Has some spare capacity."
    else
        return "Adequate capacity: Operating at $(round(utilization*100, digits=1))%. No immediate upgrade needed."
    end
end

"""
Generate plain-language rationale for node upgrade
"""
function generate_node_rationale(
    node::Int64,
    capacity::Float64,
    flow::Float64,
    utilization::Float64,
    marginal_value::Float64,
    min_cut_nodes::Set{Int64}
)::String
    if node in min_cut_nodes && utilization > 0.95
        return "Critical processing bottleneck: Node capacity constrains max flow at $(round(utilization*100, digits=1))%. Upgrading will directly increase maximum flow."
    elseif node in min_cut_nodes
        return "Processing capacity is part of minimum cut. Currently at $(round(utilization*100, digits=1))% utilization."
    elseif marginal_value > 0.5 && utilization > 0.9
        return "High priority: Processing at $(round(utilization*100, digits=1))% and likely to become bottleneck. Marginal value: $(round(marginal_value, digits=2))."
    elseif utilization > 0.95
        return "Near processing capacity: Operating at $(round(utilization*100, digits=1))%. Consider upgrading."
    elseif utilization > 0.7
        return "Moderate processing load: Currently at $(round(utilization*100, digits=1))%. Has some spare capacity."
    else
        return "Adequate processing capacity: Operating at $(round(utilization*100, digits=1))%. No immediate upgrade needed."
    end
end

"""
Generate primary bottleneck description
"""
function generate_primary_bottleneck_description(
    min_cut_edges::Set{Tuple{Int64,Int64}},
    min_cut_nodes::Set{Int64},
    bottleneck_type::Symbol
)::String
    if bottleneck_type == :source_limited
        return "Network is source-limited: insufficient input flow"
    elseif !isempty(min_cut_edges)
        edge = first(min_cut_edges)
        if length(min_cut_edges) == 1
            return "Edge ($(edge[1]) → $(edge[2])) is the primary bottleneck"
        else
            return "Multiple edges form bottleneck: $(length(min_cut_edges)) edges in minimum cut"
        end
    elseif !isempty(min_cut_nodes)
        if length(min_cut_nodes) == 1
            node = first(min_cut_nodes)
            return "Node $node processing capacity is the primary bottleneck"
        else
            return "Multiple nodes form bottleneck: $(length(min_cut_nodes)) nodes in minimum cut"
        end
    else
        return "No clear bottleneck identified"
    end
end

"""
Generate recommended action description
"""
function generate_recommended_action(
    edge_priorities::Vector{EdgeUpgradeRecommendation{Float64}},
    node_priorities::Vector{NodeUpgradeRecommendation{Float64}},
    primary_bottleneck::String
)::String
    # Find highest priority component
    best_edge_score = isempty(edge_priorities) ? 0.0 : edge_priorities[1].priority_score
    best_node_score = isempty(node_priorities) ? 0.0 : node_priorities[1].priority_score
    
    if best_edge_score > 0.8 && best_edge_score >= best_node_score
        rec = edge_priorities[1]
        increase_pct = round((rec.recommended_capacity - rec.current_capacity) / rec.current_capacity * 100, digits=0)
        return "Priority action: Upgrade edge ($(rec.edge[1]) → $(rec.edge[2])) from $(round(rec.current_capacity, digits=1)) to $(round(rec.recommended_capacity, digits=1)) (+$(increase_pct)%) to increase max flow by approximately $(round(rec.expected_flow_increase, digits=1))"
    elseif best_node_score > 0.8
        rec = node_priorities[1]
        increase_pct = round((rec.recommended_capacity - rec.current_capacity) / rec.current_capacity * 100, digits=0)
        return "Priority action: Upgrade node $(rec.node) processing capacity from $(round(rec.current_capacity, digits=1)) to $(round(rec.recommended_capacity, digits=1)) (+$(increase_pct)%) to increase max flow by approximately $(round(rec.expected_flow_increase, digits=1))"
    else
        return "Network has adequate capacity. No urgent upgrades needed. Focus on maintenance and monitoring."
    end
end

# Export functions
export generate_upgrade_recommendations, generate_edge_rationale, generate_node_rationale,
       generate_primary_bottleneck_description, generate_recommended_action
