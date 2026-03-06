# Algorithms/MinCut.jl
# Min-cut identification for bottleneck analysis
# Identifies edges and nodes that form minimum capacity cut

"""
Identify minimum cut edges and nodes from flow solution

# Arguments
- `edge_flows`: Flow through each edge from max-flow solution
- `node_flows`: Flow through each node from max-flow solution
- `edge_capacities`: Capacity of each edge
- `node_capacities`: Processing capacity of each node
- `target_nodes`: Set of sink/target nodes
- `tolerance`: Tolerance for considering edge/node saturated

# Returns
- `min_cut_edges`: Set of edges in the minimum cut
- `min_cut_nodes`: Set of nodes in the minimum cut
- `min_cut_capacity`: Total capacity of the minimum cut
- `bottleneck_type`: Symbol indicating constraint type
"""
function identify_min_cut(
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    target_nodes::Set{Int64};
    tolerance::Float64 = 1e-10
)
    min_cut_edges = Set{Tuple{Int64,Int64}}()
    min_cut_nodes = Set{Int64}()
    
    # Identify saturated edges (flow ≈ capacity)
    saturated_edges = Set{Tuple{Int64,Int64}}()
    for (edge, flow) in edge_flows
        capacity = get(edge_capacities, edge, Inf)
        if !isinf(capacity) && abs(flow - capacity) < tolerance
            push!(saturated_edges, edge)
        end
    end
    
    # Identify saturated nodes (flow ≈ capacity, excluding targets)
    saturated_nodes = Set{Int64}()
    for (node, flow) in node_flows
        if !(node in target_nodes)  # Exclude targets
            capacity = get(node_capacities, node, Inf)
            if !isinf(capacity) && abs(flow - capacity) < tolerance
                push!(saturated_nodes, node)
            end
        end
    end
    
    # Calculate total actual flow for comparison
    total_flow = sum(get(node_flows, target, 0.0) for target in target_nodes)
    
    # Min-cut identification: ALL saturated components collectively form the bottleneck
    # In DAGs, the min-cut is the complete set of saturated edges/nodes that limit flow.
    # By Max-Flow Min-Cut theorem, the SUM of their capacities equals max flow.
    min_cut_edges = saturated_edges
    min_cut_nodes = saturated_nodes
    
    # Calculate min-cut capacity from identified components
    edge_cut_capacity = isempty(min_cut_edges) ? Inf : sum(
        get(edge_capacities, edge, 0.0) for edge in min_cut_edges
    )
    node_cut_capacity = isempty(min_cut_nodes) ? Inf : sum(
        get(node_capacities, node, 0.0) for node in min_cut_nodes
    )
    
    # Total min-cut capacity is the minimum of edge and node cuts
    min_cut_capacity = min(edge_cut_capacity, node_cut_capacity)
    
    # Determine bottleneck type based on which is the bottleneck
    bottleneck_type = if total_flow < tolerance
        # No significant flow
        :source_limited
    elseif isinf(min_cut_capacity)
        # No saturated components (shouldn't happen if there's flow)
        :source_limited
    elseif isempty(min_cut_nodes) && !isempty(min_cut_edges)
        # Only edges in min-cut: edge-limited
        :edge_capacity
    elseif !isempty(min_cut_nodes) && isempty(min_cut_edges)
        # Only nodes in min-cut: node-limited
        :node_processing
    elseif !isempty(min_cut_edges) && !isempty(min_cut_nodes)
        # Both edges and nodes in min-cut
        if abs(edge_cut_capacity - node_cut_capacity) < tolerance
            :mixed
        elseif edge_cut_capacity < node_cut_capacity
            :edge_capacity
        else
            :node_processing
        end
    else
        :source_limited
    end
    
    return min_cut_edges, min_cut_nodes, min_cut_capacity, bottleneck_type
end

"""
Identify ALL saturated components (edges and nodes at full capacity)

# Arguments
- `edge_flows`: Flow through each edge
- `node_flows`: Flow through each node  
- `edge_capacities`: Capacity of each edge
- `node_capacities`: Capacity of each node
- `target_nodes`: Set of target nodes (exclude from saturation check)
- `saturation_threshold`: Threshold for considering saturated (default: 1.0 = 100%)
- `tolerance`: Numerical tolerance

# Returns
- `saturated_edges`: Edges at 100% capacity
- `saturated_nodes`: Nodes at 100% capacity
- `near_saturated_edges`: Edges close to capacity with utilization %
- `near_saturated_nodes`: Nodes close to capacity with utilization %
"""
function identify_saturated_components(
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    target_nodes::Set{Int64};
    saturation_threshold::Float64 = 1.0,
    near_threshold::Float64 = 0.90,
    tolerance::Float64 = 1e-10
)
    saturated_edges = Tuple{Int64,Int64}[]
    saturated_nodes = Int64[]
    near_saturated_edges = Tuple{Tuple{Int64,Int64}, Float64}[]
    near_saturated_nodes = Tuple{Int64, Float64}[]
    
    # Check edges
    for (edge, flow) in edge_flows
        capacity = get(edge_capacities, edge, Inf)
        if !isinf(capacity) && capacity > tolerance
            utilization = flow / capacity
            
            if abs(utilization - saturation_threshold) < tolerance
                push!(saturated_edges, edge)
            elseif utilization >= near_threshold && utilization < saturation_threshold
                push!(near_saturated_edges, (edge, utilization))
            end
        end
    end
    
    # Check nodes
    for (node, flow) in node_flows
        if !(node in target_nodes)
            capacity = get(node_capacities, node, Inf)
            if !isinf(capacity) && capacity > tolerance
                utilization = flow / capacity
                
                if abs(utilization - saturation_threshold) < tolerance
                    push!(saturated_nodes, node)
                elseif utilization >= near_threshold && utilization < saturation_threshold
                    push!(near_saturated_nodes, (node, utilization))
                end
            end
        end
    end
    
    # Sort near-saturated by utilization (highest first)
    sort!(near_saturated_edges, by = x -> x[2], rev = true)
    sort!(near_saturated_nodes, by = x -> x[2], rev = true)
    
    return saturated_edges, saturated_nodes, near_saturated_edges, near_saturated_nodes
end

"""
Calculate utilization for all network components

# Arguments
- `edge_flows`: Flow through each edge
- `node_flows`: Flow through each node
- `edge_capacities`: Capacity of each edge
- `node_capacities`: Capacity of each node
- `tolerance`: Tolerance for division

# Returns
- Dictionary mapping components to utilization (0.0 to 1.0)
"""
function calculate_component_utilization(
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64};
    tolerance::Float64 = 1e-10
)
    utilization = Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}()
    
    # Edge utilization
    for (edge, flow) in edge_flows
        capacity = get(edge_capacities, edge, Inf)
        if !isinf(capacity) && capacity > tolerance
            utilization[edge] = flow / capacity
        else
            utilization[edge] = 0.0
        end
    end
    
    # Node utilization
    for (node, flow) in node_flows
        capacity = get(node_capacities, node, Inf)
        if !isinf(capacity) && capacity > tolerance
            utilization[node] = flow / capacity
        else
            utilization[node] = 0.0
        end
    end
    
    return utilization
end

"""
Calculate spare capacity in the network

# Arguments
- `edge_flows`: Current flow through edges
- `node_flows`: Current flow through nodes
- `edge_capacities`: Edge capacities
- `node_capacities`: Node capacities

# Returns
- `total_spare_edge_capacity`: Sum of unused edge capacity
- `total_spare_node_capacity`: Sum of unused node capacity
"""
function calculate_spare_capacity(
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64}
)
    # Edge spare capacity
    total_spare_edge = 0.0
    for (edge, capacity) in edge_capacities
        if !isinf(capacity)
            flow = get(edge_flows, edge, 0.0)
            total_spare_edge += max(0.0, capacity - flow)
        end
    end
    
    # Node spare capacity
    total_spare_node = 0.0
    for (node, capacity) in node_capacities
        if !isinf(capacity)
            flow = get(node_flows, node, 0.0)
            total_spare_node += max(0.0, capacity - flow)
        end
    end
    
    return total_spare_edge, total_spare_node
end

# Export functions
export identify_min_cut, identify_saturated_components,
       calculate_component_utilization, calculate_spare_capacity
