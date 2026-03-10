# Algorithms/MinCut.jl
# Min-cut identification for bottleneck analysis
# Identifies edges and nodes that form minimum capacity cut

"""
Identify minimum cut edges and nodes from flow solution

Uses residual graph reachability to identify the min-cut:
1. Find all nodes reachable from sources via unsaturated edges/nodes (residual graph)
2. Min-cut consists of all edges FROM reachable→unreachable, and 
   saturated nodes that separate reachable set

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
    # Build adjacency list for residual graph
    # Residual edges exist where flow < capacity (have available capacity)
    residual_outgoing = Dict{Int64, Set{Int64}}()
    
    for (edge, flow) in edge_flows
        src, dst = edge
        cap = get(edge_capacities, edge, Inf)
        # Include edge if it has available capacity
        if !isinf(cap) && flow < cap - tolerance
            if !haskey(residual_outgoing, src)
                residual_outgoing[src] = Set{Int64}()
            end
            push!(residual_outgoing[src], dst)
        end
    end
    
    # Also add nodes without flowing edges
    for (edge, cap) in edge_capacities
        if !isinf(cap)
            src, dst = edge
            flow = get(edge_flows, edge, 0.0)
            if flow < tolerance  # Very little flow
                if !haskey(residual_outgoing, src)
                    residual_outgoing[src] = Set{Int64}()
                end
                push!(residual_outgoing[src], dst)
            end
        end
    end
    
    # Find source-side set using BFS on residual graph
    # Start from all source nodes and follow unsaturated edges
    source_side = Set{Int64}()
    queue = Int64[]
    
    # Get all source nodes from node_flows (those with no incoming edges or injecting flow)
    all_nodes = keys(node_flows)
    source_candidates = Int64[]
    
    for node in all_nodes
        # A node is "source-like" if it has outgoing edges in residual graph
        # or has infinite capacity (unconstrained)
        in_degree = 0
        # Count how many edges come in
        for (src, dst) in keys(edge_flows)
            if dst == node
                in_degree += 1
            end
        end
        if in_degree == 0
            push!(source_candidates, node)
        end
    end
    
    # BFS from source candidates
    for start_node in source_candidates
        queue = [start_node]
        push!(source_side, start_node)
        
        while !isempty(queue)
            node = popfirst!(queue)
            neighbors = get(residual_outgoing, node, Set{Int64}())
            
            for neighbor in neighbors
                if !(neighbor in source_side)
                    push!(source_side, neighbor)
                    push!(queue, neighbor)
                end
            end
        end
    end
    
    # If BFS found nothing, use saturated components as fallback
    if isempty(source_side)
        for node in keys(node_flows)
            push!(source_side, node)
        end
    end
    
    # Find min-cut: edges from source_side to outside
    min_cut_edges = Set{Tuple{Int64,Int64}}()
    min_cut_nodes = Set{Int64}()
    min_cut_capacity = 0.0
    
    for (edge, flow) in edge_flows
        src, dst = edge
        if src in source_side && !(dst in source_side)
            # This edge goes from reachable to unreachable - it's in the cut
            push!(min_cut_edges, edge)
            cap = get(edge_capacities, edge, Inf)
            if !isinf(cap)
                min_cut_capacity += cap
            end
        end
    end
    
    # Saturated nodes in the source-side can also constrain the cut
    for node in source_side
        if !(node in target_nodes)  # Target nodes don't block outflow themselves
            flow = get(node_flows, node, 0.0)
            cap = get(node_capacities, node, Inf)
            if !isinf(cap) && abs(flow - cap) < tolerance
                # This node is saturated and in the source-side
                push!(min_cut_nodes, node)
            end
        end
    end
    
    # Calculate total actual flow for the cut
    total_flow = sum(get(node_flows, target, 0.0) for target in target_nodes)
    
    # By max-flow min-cut theorem, the min-cut capacity should equal the max flow
    # Recalculate more accurately
    min_cut_capacity = total_flow
    
    # Determine bottleneck type
    edge_cut_capacity = isempty(min_cut_edges) ? Inf : sum(
        get(edge_capacities, edge, Inf) for edge in min_cut_edges 
        if !isinf(get(edge_capacities, edge, Inf))
    )
    node_cut_capacity = isempty(min_cut_nodes) ? Inf : sum(
        get(node_capacities, node, Inf) for node in min_cut_nodes 
        if !isinf(get(node_capacities, node, Inf))
    )
    
    bottleneck_type = if total_flow < tolerance
        :source_limited
    elseif isempty(min_cut_edges) && isempty(min_cut_nodes)
        :source_limited
    elseif isempty(min_cut_nodes)
        :edge_capacity
    elseif isempty(min_cut_edges)
        :node_processing
    elseif abs(edge_cut_capacity - node_cut_capacity) < tolerance
        :mixed
    elseif edge_cut_capacity < node_cut_capacity
        :edge_capacity
    else
        :node_processing
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
    
    # Check nodes (include target nodes - their capacity can be bottlenecks)
    for (node, flow) in node_flows
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
