# Algorithms/Paths.jl
# Critical path enumeration and redundancy analysis for DAGs
# Phase 3: Advanced Analysis

# Conditional includes for standalone use
if !isdefined(@__MODULE__, :FlowPath)
    include("../Core/Types.jl")
end

"""
Enumerate critical paths through the network

For DAGs, we can efficiently enumerate paths using topological ordering
A critical path is one where flow equals capacity (saturated)

# Arguments
- `topology`: Network topology with iteration sets (topological order)
- `edge_flows`: Current flow through each edge
- `edge_capacities`: Capacity of each edge
- `source_nodes`: Set of source nodes
- `target_nodes`: Set of target nodes
- `max_paths`: Maximum number of paths to enumerate (prevent explosion)

# Returns
- PathAnalysis struct with critical paths and redundancy metrics
"""
function enumerate_critical_paths(
    topology::NetworkTopology,
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    source_nodes::Set{Int64},
    target_nodes::Set{Int64};
    max_paths::Int = 100,
    tolerance::Float64 = 1e-10
)
    # Find paths from each source to each target
    all_paths = FlowPath{Float64}[]
    
    for source in source_nodes
        for target in target_nodes
            paths = find_paths_dag(
                source, target,
                topology,
                edge_flows, node_flows,
                edge_capacities, node_capacities,
                max_paths = max_paths,
                tolerance = tolerance
            )
            append!(all_paths, paths)
        end
    end
    
    # Identify critical (saturated) paths
    critical_paths = filter(p -> p.is_saturated, all_paths)
    
    # Calculate path redundancy
    path_redundancy = calculate_path_redundancy(
        source_nodes, target_nodes, all_paths
    )
    
    # Identify single points of failure
    single_points_of_failure = identify_single_points_of_failure(
        topology, source_nodes, target_nodes
    )
    
    # Calculate flow distribution across paths
    path_flow_distribution = [
        (path.path, path.flow) for path in all_paths
    ]
    
    return PathAnalysis{Float64}(
        critical_paths,
        path_redundancy,
        single_points_of_failure,
        path_flow_distribution
    )
end

"""
Find all paths from source to target in DAG

Uses DFS with topological awareness to avoid cycles
"""
function find_paths_dag(
    source::Int64,
    target::Int64,
    topology::NetworkTopology,
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64};
    max_paths::Int = 100,
    tolerance::Float64 = 1e-10
)
    paths = FlowPath{Float64}[]
    
    # DFS to find all paths
    function dfs(current::Int64, path::Vector{Int64}, visited::Set{Int64})
        if length(paths) >= max_paths
            return  # Limit reached
        end
        
        if current == target
            # Found a complete path - analyze it
            flow_path = analyze_path(
                path, edge_flows, node_flows,
                edge_capacities, node_capacities,
                tolerance
            )
            push!(paths, flow_path)
            return
        end
        
        # Visit neighbors
        neighbors = get(topology.outgoing_index, current, Set{Int64}())
        for next_node in neighbors
            if !(next_node in visited)
                new_visited = copy(visited)
                push!(new_visited, next_node)
                dfs(next_node, [path; next_node], new_visited)
            end
        end
    end
    
    # Start DFS
    dfs(source, [source], Set([source]))
    
    return paths
end

"""
Analyze a single path to create FlowPath struct

Determines:
- Path capacity (minimum along path)
- Actual flow through path
- Whether path is saturated
- Bottleneck location within path
"""
function analyze_path(
    path::Vector{Int64},
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    tolerance::Float64
)
    if length(path) < 2
        # Invalid path
        return FlowPath{Float64}(
            path, 0.0, 0.0, false, 0.0, 0,
            length(path) > 0 ? path[1] : 0
        )
    end
    
    # Find bottleneck capacity along path
    min_capacity = Inf
    bottleneck_location = path[1]  # Default to first node
    
    # Check node capacities
    for node in path
        node_cap = get(node_capacities, node, Inf)
        if node_cap < min_capacity
            min_capacity = node_cap
            bottleneck_location = node
        end
    end
    
    # Check edge capacities
    for i in 1:(length(path)-1)
        edge = (path[i], path[i+1])
        edge_cap = get(edge_capacities, edge, Inf)
        if edge_cap < min_capacity
            min_capacity = edge_cap
            bottleneck_location = edge
        end
    end
    
    # Estimate flow through this path
    # Use minimum of node flows along path (flow is limited by most-constrained node)
    # This is more accurate than minimum edge flow for shared-edge scenarios
    path_flow = Inf
    for node in path
        node_flow = get(node_flows, node, Inf)
        path_flow = min(path_flow, node_flow)
    end
    
    # Also check edge capacities and flows to verify
    for i in 1:(length(path)-1)
        edge = (path[i], path[i+1])
        flow = get(edge_flows, edge, 0.0)
        path_flow = min(path_flow, flow)
    end
    path_flow = isinf(path_flow) ? 0.0 : path_flow
    
    # Check if saturated
    is_saturated = !isinf(min_capacity) && 
                   abs(path_flow - min_capacity) < tolerance
    
    spare_capacity = isinf(min_capacity) ? Inf : max(0.0, min_capacity - path_flow)
    
    return FlowPath{Float64}(
        path,
        min_capacity,
        path_flow,
        is_saturated,
        spare_capacity,
        length(path) - 1,  # Number of hops
        bottleneck_location
    )
end

"""
Calculate path redundancy for each source-target pair

Returns: Dict mapping (source, target) to number of independent paths
"""
function calculate_path_redundancy(
    source_nodes::Set{Int64},
    target_nodes::Set{Int64},
    all_paths::Vector{FlowPath{Float64}}
)
    redundancy = Dict{Tuple{Int64,Int64}, Int}()
    
    for source in source_nodes
        for target in target_nodes
            # Count paths from this source to this target
            count = 0
            for path in all_paths
                if !isempty(path.path) && 
                   path.path[1] == source && 
                   path.path[end] == target
                    count += 1
                end
            end
            redundancy[(source, target)] = count
        end
    end
    
    return redundancy
end

"""
Identify single points of failure (SPOFs)

A component is a SPOF if its removal disconnects sources from targets
For DAGs, we can use reachability analysis

WARNING: If source_nodes or target_nodes is empty, returns empty list (no SPOFs possible)
"""
function identify_single_points_of_failure(
    topology::NetworkTopology,
    source_nodes::Set{Int64},
    target_nodes::Set{Int64}
)
    # Guard against degenerate cases
    if isempty(source_nodes) || isempty(target_nodes)
        return Union{Int64, Tuple{Int64,Int64}}[]
    end
    
    spofs = Union{Int64, Tuple{Int64,Int64}}[]
    
    # Get all nodes and edges
    all_nodes = Set{Int64}()
    all_edges = Set{Tuple{Int64,Int64}}()
    
    for (node, neighbors) in topology.outgoing_index
        push!(all_nodes, node)
        for neighbor in neighbors
            push!(all_edges, (node, neighbor))
            push!(all_nodes, neighbor)
        end
    end
    
    # Check each node
    for node in all_nodes
        if node in source_nodes || node in target_nodes
            continue  # Don't consider source/target as SPOFs
        end
        
        if is_spof_node(node, topology, source_nodes, target_nodes)
            push!(spofs, node)
        end
    end
    
    # Check each edge
    for edge in all_edges
        if is_spof_edge(edge, topology, source_nodes, target_nodes)
            push!(spofs, edge)
        end
    end
    
    return spofs
end

"""
Check if removing a node disconnects ANY source-target pair

A node is a SPOF if there exists at least one source-target pair that becomes unreachable
"""
function is_spof_node(
    node::Int64,
    topology::NetworkTopology,
    source_nodes::Set{Int64},
    target_nodes::Set{Int64}
)
    # Build modified topology without this node
    modified_outgoing = Dict{Int64, Set{Int64}}()
    for (n, neighbors) in topology.outgoing_index
        if n != node
            # Remove edges involving this node
            filtered_neighbors = Set(nb for nb in neighbors if nb != node)
            if !isempty(filtered_neighbors)
                modified_outgoing[n] = filtered_neighbors
            end
        end
    end
    
    # Check if ALL source-target pairs are still connected
    all_pairs_connected = true
    for source in source_nodes
        if source == node
            continue
        end
        for target in target_nodes
            if target == node
                continue
            end
            # If ANY pair becomes unreachable, this node is a SPOF
            if !is_reachable(source, target, modified_outgoing)
                return true  # Found disconnected pair - this IS a SPOF
            end
        end
    end
    
    return false  # All pairs still connected, not a SPOF
end

"""
Check if removing an edge disconnects ANY source-target pair

An edge is a SPOF if there exists at least one source-target pair that becomes unreachable
"""
function is_spof_edge(
    edge::Tuple{Int64,Int64},
    topology::NetworkTopology,
    source_nodes::Set{Int64},
    target_nodes::Set{Int64}
)
    # Build modified topology without this edge
    modified_outgoing = Dict{Int64, Set{Int64}}()
    for (n, neighbors) in topology.outgoing_index
        if n == edge[1]
            # Remove this specific edge
            filtered_neighbors = Set(nb for nb in neighbors if nb != edge[2])
            if !isempty(filtered_neighbors)
                modified_outgoing[n] = filtered_neighbors
            end
        else
            modified_outgoing[n] = neighbors
        end
    end
    
    # Check if ANY source-target pair becomes unreachable
    for source in source_nodes
        for target in target_nodes
            if !is_reachable(source, target, modified_outgoing)
                return true  # Found disconnected pair - this IS a SPOF
            end
        end
    end
    
    return false  # All pairs still connected, not a SPOF
end

"""
Check if target is reachable from source using BFS
"""
function is_reachable(
    source::Int64,
    target::Int64,
    outgoing_index::Dict{Int64, Set{Int64}}
)
    if source == target
        return true
    end
    
    visited = Set{Int64}([source])
    queue = [source]
    
    while !isempty(queue)
        current = popfirst!(queue)
        neighbors = get(outgoing_index, current, Set{Int64}())
        
        for neighbor in neighbors
            if neighbor == target
                return true
            end
            if !(neighbor in visited)
                push!(visited, neighbor)
                push!(queue, neighbor)
            end
        end
    end
    
    return false
end

# Export functions
export enumerate_critical_paths, find_paths_dag, analyze_path,
       calculate_path_redundancy, identify_single_points_of_failure
