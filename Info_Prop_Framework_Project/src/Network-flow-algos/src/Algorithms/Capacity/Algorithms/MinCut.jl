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
    # Build node universe
    all_nodes = Set{Int64}()
    for (u, v) in keys(edge_capacities)
        push!(all_nodes, u)
        push!(all_nodes, v)
    end
    for n in keys(node_flows)
        push!(all_nodes, n)
    end
    for n in keys(node_capacities)
        push!(all_nodes, n)
    end

    # Infer source candidates from edge-capacity in-degree (fallback to positive-flow nodes)
    in_degree = Dict{Int64, Int}(n => 0 for n in all_nodes)
    for (u, v) in keys(edge_capacities)
        in_degree[v] = get(in_degree, v, 0) + 1
        in_degree[u] = get(in_degree, u, 0)
    end
    source_candidates = Set{Int64}(n for n in all_nodes if get(in_degree, n, 0) == 0)
    if isempty(source_candidates)
        for (n, f) in node_flows
            if f > tolerance
                push!(source_candidates, n)
            end
        end
    end
    if isempty(source_candidates) && !isempty(all_nodes)
        push!(source_candidates, first(all_nodes))
    end

    # Residual adjacency on original graph with reverse arcs
    residual_outgoing = Dict{Int64, Set{Int64}}(n => Set{Int64}() for n in all_nodes)
    for ((u, v), cap) in edge_capacities
        f = get(edge_flows, (u, v), 0.0)
        cap_eff = isinf(cap) ? Inf : max(0.0, cap)

        # Forward residual
        if isinf(cap_eff) || (cap_eff - f > tolerance)
            push!(residual_outgoing[u], v)
        end

        # Reverse residual
        if f > tolerance
            push!(residual_outgoing[v], u)
        end
    end

    # BFS to compute source-side reachable set in residual graph
    source_side = Set{Int64}()
    queue = Int64[]
    for s in source_candidates
        push!(source_side, s)
        push!(queue, s)
    end

    front = 1
    while front <= length(queue)
        node = queue[front]
        front += 1
        for nbr in get(residual_outgoing, node, Set{Int64}())
            if !(nbr in source_side)
                push!(source_side, nbr)
                push!(queue, nbr)
            end
        end
    end

    # Extract cut sets and capacity from source-side boundary
    min_cut_edges = Set{Tuple{Int64,Int64}}()
    min_cut_nodes = Set{Int64}()
    min_cut_capacity = 0.0

    for ((u, v), cap) in edge_capacities
        if u in source_side && !(v in source_side)
            push!(min_cut_edges, (u, v))
            if !isinf(cap)
                min_cut_capacity += max(0.0, cap)
            end
        end
    end

    for n in source_side
        if n in target_nodes
            continue
        end
        cap_n = get(node_capacities, n, Inf)
        if isinf(cap_n)
            continue
        end
        f_n = get(node_flows, n, 0.0)
        if f_n >= cap_n - tolerance
            push!(min_cut_nodes, n)
            min_cut_capacity += max(0.0, cap_n)
        end
    end
    
    # Determine bottleneck type
    edge_cut_capacity = isempty(min_cut_edges) ? Inf : sum(
        get(edge_capacities, edge, Inf) for edge in min_cut_edges 
        if !isinf(get(edge_capacities, edge, Inf))
    )
    node_cut_capacity = isempty(min_cut_nodes) ? Inf : sum(
        get(node_capacities, node, Inf) for node in min_cut_nodes 
        if !isinf(get(node_capacities, node, Inf))
    )
    
    total_flow = sum(get(node_flows, target, 0.0) for target in target_nodes)

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
