# Analysis/Bottlenecks.jl
# Enhanced bottleneck identification and classification
# Phase 3: Advanced Analysis

# Conditional includes for standalone use
if !isdefined(@__MODULE__, :BottleneckReport)
    include("../Core/Types.jl")
end
if !isdefined(@__MODULE__, :identify_saturated_components)
    include("../Algorithms/MinCut.jl")
end

"""
Enhanced bottleneck classification with detailed metrics

Uses existing helper functions from MinCut.jl but adds enhanced interpretation
"""
function analyze_bottlenecks(
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64},
    min_cut_edges::Set{Tuple{Int64,Int64}},
    min_cut_nodes::Set{Int64},
    min_cut_capacity::Float64;
    tolerance::Float64 = 1e-10
)
    # Use existing helper functions from MinCut.jl
    saturated_edges, saturated_nodes, near_saturated_edges, near_saturated_nodes = 
        identify_saturated_components(
            edge_flows, node_flows, edge_capacities, node_capacities, target_nodes,
            tolerance = tolerance
        )
    
    utilization_by_component = calculate_component_utilization(
        edge_flows, node_flows, edge_capacities, node_capacities,
        tolerance = tolerance
    )
    
    total_spare_edge, total_spare_node = calculate_spare_capacity(
        edge_flows, node_flows, edge_capacities, node_capacities
    )
    
    # Enhanced bottleneck type classification
    bottleneck_type = classify_bottleneck_type(
        saturated_edges, saturated_nodes,
        min_cut_edges, min_cut_nodes,
        source_rates, min_cut_capacity
    )
    
    # Calculate capacity gap
    capacity_gap = calculate_capacity_gap(
        bottleneck_type, source_rates, min_cut_capacity
    )
    
    return BottleneckReport{Float64}(
        min_cut_capacity,
        min_cut_edges,
        min_cut_nodes,
        bottleneck_type,
        capacity_gap,
        saturated_edges,
        saturated_nodes,
        near_saturated_edges,
        near_saturated_nodes,
        total_spare_edge,
        total_spare_node,
        utilization_by_component
    )
end

"""
Enhanced bottleneck type classification

Returns: :edge_capacity, :node_processing, :source_limited, or :mixed
"""
function classify_bottleneck_type(
    saturated_edges::Vector{Tuple{Int64,Int64}},
    saturated_nodes::Vector{Int64},
    min_cut_edges::Set{Tuple{Int64,Int64}},
    min_cut_nodes::Set{Int64},
    source_rates::Dict{Int64, Float64},
    min_cut_capacity::Float64
)
    # Count saturated components
    n_sat_edges = length(saturated_edges)
    n_sat_nodes = length(saturated_nodes)
    
    # Check if source limited
    # Source-limited means: source provides LESS than network can handle
    # If min_cut_capacity > total_source (network can handle more), then source-limited
    # But we need actual flow, not just source rate, to determine this properly
    total_source_rate = sum(values(source_rates))
    source_limited = total_source_rate < min_cut_capacity * 0.99  # Source provides less than network can handle
    
    # Classify based on saturated components (more reliable than source check)
    if n_sat_edges > 0 && n_sat_nodes > 0
        # Both types saturated
        return :mixed
    elseif n_sat_nodes > 0 || !isempty(min_cut_nodes)
        # Node processing is constraint
        return :node_processing
    elseif n_sat_edges > 0 || !isempty(min_cut_edges)
        # Edge capacity is constraint
        return :edge_capacity
    elseif source_limited
        # No saturated components but source is insufficient
        return :source_limited
    else
        # Default to mixed
        return :mixed
    end
end

"""
Calculate capacity gap for bottleneck

Returns additional capacity needed to increase flow
"""
function calculate_capacity_gap(
    bottleneck_type::Symbol,
    source_rates::Dict{Int64, Float64},
    min_cut_capacity::Float64
)
    if bottleneck_type == :source_limited
        # Need more source flow
        total_source = sum(values(source_rates))
        return max(0.0, min_cut_capacity - total_source)
    else
        # Bottleneck is in network - no simple capacity gap
        return 0.0
    end
end

# Export functions
export analyze_bottlenecks, classify_bottleneck_type, calculate_capacity_gap
