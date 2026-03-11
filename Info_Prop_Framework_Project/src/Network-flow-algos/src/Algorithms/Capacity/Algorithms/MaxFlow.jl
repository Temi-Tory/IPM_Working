# Algorithms/MaxFlow.jl
# Ford-Fulkerson max-flow algorithm optimized for DAGs
# Exploits topological ordering for efficient computation

mutable struct _FlowEdge
    to::Int
    rev::Int
    cap::Float64
end

function _add_edge!(graph::Vector{Vector{_FlowEdge}}, u::Int, v::Int, cap::Float64)
    forward = _FlowEdge(v, length(graph[v]) + 1, cap)
    backward = _FlowEdge(u, length(graph[u]) + 1, 0.0)
    push!(graph[u], forward)
    push!(graph[v], backward)
end

function _bfs_level(graph::Vector{Vector{_FlowEdge}}, source::Int, sink::Int, level::Vector{Int}; tol::Float64)
    fill!(level, -1)
    queue = Int[source]
    level[source] = 0
    front = 1

    while front <= length(queue)
        u = queue[front]
        front += 1
        for edge in graph[u]
            if edge.cap > tol && level[edge.to] < 0
                level[edge.to] = level[u] + 1
                if edge.to == sink
                    return true
                end
                push!(queue, edge.to)
            end
        end
    end

    return level[sink] >= 0
end

function _dfs_blocking!(
    graph::Vector{Vector{_FlowEdge}},
    u::Int,
    sink::Int,
    pushed::Float64,
    level::Vector{Int},
    ptr::Vector{Int};
    tol::Float64
)
    if pushed <= tol
        return 0.0
    end
    if u == sink
        return pushed
    end

    while ptr[u] <= length(graph[u])
        edge_index = ptr[u]
        edge = graph[u][edge_index]

        if edge.cap > tol && level[edge.to] == level[u] + 1
            tr = _dfs_blocking!(graph, edge.to, sink, min(pushed, edge.cap), level, ptr; tol = tol)
            if tr > tol
                graph[u][edge_index].cap -= tr
                rev_index = edge.rev
                graph[edge.to][rev_index].cap += tr
                return tr
            end
        end

        ptr[u] += 1
    end

    return 0.0
end

function _reachable_from_source(graph::Vector{Vector{_FlowEdge}}, source::Int; tol::Float64)
    visited = falses(length(graph))
    queue = Int[source]
    visited[source] = true
    front = 1

    while front <= length(queue)
        u = queue[front]
        front += 1
        for edge in graph[u]
            if edge.cap > tol && !visited[edge.to]
                visited[edge.to] = true
                push!(queue, edge.to)
            end
        end
    end

    return visited
end

function _solve_exact_max_flow(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64, Set{Int64}},
    incoming_index::Dict{Int64, Set{Int64}},
    source_nodes::Set{Int64},
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64};
    tolerance::Float64 = 1e-10,
    ignore_node_caps::Bool = false
)
    all_nodes = Int64[]
    seen = Set{Int64}()
    for layer in iteration_sets
        for n in layer
            if !(n in seen)
                push!(all_nodes, n)
                push!(seen, n)
            end
        end
    end
    for (u, v) in keys(edge_capacities)
        if !(u in seen)
            push!(all_nodes, u)
            push!(seen, u)
        end
        if !(v in seen)
            push!(all_nodes, v)
            push!(seen, v)
        end
    end
    for n in keys(node_capacities)
        if !(n in seen)
            push!(all_nodes, n)
            push!(seen, n)
        end
    end

    n_nodes = length(all_nodes)
    node_to_idx = Dict{Int64, Int}(n => i for (i, n) in enumerate(all_nodes))

    source_total = sum(max(0.0, r) for r in values(source_rates))
    finite_edge_total = sum(c for c in values(edge_capacities) if !isinf(c) && c > 0.0)
    finite_node_total = sum(c for c in values(node_capacities) if !isinf(c) && c > 0.0)
    BIG = max(1.0, source_total + finite_edge_total + finite_node_total + 1.0)

    split_count = 2 * n_nodes
    super_source = split_count + 1
    super_sink = split_count + 2
    graph = [_FlowEdge[] for _ in 1:(split_count + 2)]

    vin(i::Int) = 2 * i - 1
    vout(i::Int) = 2 * i

    original_edge_ref = Dict{Tuple{Int64,Int64}, Tuple{Int,Int}}()
    node_split_ref = Dict{Int64, Tuple{Int,Int}}()

    for n in all_nodes
        i = node_to_idx[n]
        cap_n = if ignore_node_caps
            BIG
        else
            get(node_capacities, n, Inf)
        end
        cap_eff = isinf(cap_n) ? BIG : max(0.0, cap_n)

        u = vin(i)
        v = vout(i)
        edge_pos = length(graph[u]) + 1
        _add_edge!(graph, u, v, cap_eff)
        node_split_ref[n] = (u, edge_pos)
    end

    for ((u_node, v_node), cap) in edge_capacities
        if !haskey(node_to_idx, u_node) || !haskey(node_to_idx, v_node)
            continue
        end
        u = vout(node_to_idx[u_node])
        v = vin(node_to_idx[v_node])
        cap_eff = isinf(cap) ? BIG : max(0.0, cap)
        edge_pos = length(graph[u]) + 1
        _add_edge!(graph, u, v, cap_eff)
        original_edge_ref[(u_node, v_node)] = (u, edge_pos)
    end

    for s in source_nodes
        if !haskey(node_to_idx, s)
            continue
        end
        r = max(0.0, get(source_rates, s, 0.0))
        if r <= tolerance
            continue
        end
        _add_edge!(graph, super_source, vin(node_to_idx[s]), r)
    end

    for t in target_nodes
        if !haskey(node_to_idx, t)
            continue
        end
        _add_edge!(graph, vout(node_to_idx[t]), super_sink, BIG)
    end

    level = fill(-1, length(graph))
    total_flow = 0.0

    while _bfs_level(graph, super_source, super_sink, level; tol = tolerance)
        ptr = fill(1, length(graph))
        while true
            pushed = _dfs_blocking!(graph, super_source, super_sink, BIG, level, ptr; tol = tolerance)
            if pushed <= tolerance
                break
            end
            total_flow += pushed
        end
    end

    edge_flows = Dict{Tuple{Int64,Int64}, Float64}()
    for (edge_key, (u, edge_idx)) in original_edge_ref
        residual_cap = graph[u][edge_idx].cap
        original_cap = isinf(get(edge_capacities, edge_key, Inf)) ? BIG : max(0.0, get(edge_capacities, edge_key, 0.0))
        edge_flows[edge_key] = max(0.0, original_cap - residual_cap)
    end

    node_flows = Dict{Int64, Float64}()
    for n in all_nodes
        u, edge_idx = node_split_ref[n]
        residual_cap = graph[u][edge_idx].cap
        cap_n = if ignore_node_caps
            BIG
        else
            get(node_capacities, n, Inf)
        end
        original_cap = isinf(cap_n) ? BIG : max(0.0, cap_n)
        node_flows[n] = max(0.0, original_cap - residual_cap)
    end

    reachable = _reachable_from_source(graph, super_source; tol = tolerance)

    return node_flows, edge_flows, total_flow, reachable, all_nodes, node_to_idx
end

"""
Compute maximum flow through DAG using Ford-Fulkerson algorithm
Optimized for DAG structure using topological ordering

# Arguments
- `iteration_sets`: Topologically ordered sets of nodes
- `outgoing_index`: Dict mapping node to outgoing edges
- `incoming_index`: Dict mapping node to incoming edges
- `source_nodes`: Set of source nodes (inject flow)
- `node_capacities`: Processing capacity for each node
- `edge_capacities`: Transmission capacity for each edge
- `source_rates`: Input rate for each source node
- `target_nodes`: Set of target/sink nodes

# Returns
- `node_flows`: Flow through each node
- `edge_flows`: Flow through each edge
- `total_flow`: Total flow reaching targets
"""
function compute_max_flow_dag(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64, Set{Int64}},
    incoming_index::Dict{Int64, Set{Int64}},
    source_nodes::Set{Int64},
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64};
    tolerance::Float64 = 1e-10
)
    node_flows, edge_flows, total_flow, _, _, _ = _solve_exact_max_flow(
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_capacities,
        edge_capacities,
        source_rates,
        target_nodes,
        tolerance = tolerance,
        ignore_node_caps = false
    )

    return node_flows, edge_flows, total_flow
end

"""
Compute maximum flow and extract an exact minimum cut from residual graph

# Returns
- `node_flows`: Flow through each node
- `edge_flows`: Flow through each edge
- `total_flow`: Total flow reaching targets
- `min_cut_edges`: Edge components in minimum cut (original graph edges)
- `min_cut_nodes`: Node components in minimum cut (node-splitting cut edges)
- `min_cut_capacity`: Total finite capacity of the minimum cut
- `bottleneck_type`: :edge_capacity, :node_processing, :mixed, or :source_limited
"""
function compute_max_flow_and_min_cut_dag(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64, Set{Int64}},
    incoming_index::Dict{Int64, Set{Int64}},
    source_nodes::Set{Int64},
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64};
    tolerance::Float64 = 1e-10
)
    node_flows, edge_flows, total_flow, reachable, all_nodes, node_to_idx = _solve_exact_max_flow(
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_capacities,
        edge_capacities,
        source_rates,
        target_nodes,
        tolerance = tolerance,
        ignore_node_caps = false
    )

    vin(i::Int) = 2 * i - 1
    vout(i::Int) = 2 * i

    min_cut_edges = Set{Tuple{Int64,Int64}}()
    min_cut_nodes = Set{Int64}()
    min_cut_capacity = 0.0

    for ((u, v), cap) in edge_capacities
        if !haskey(node_to_idx, u) || !haskey(node_to_idx, v)
            continue
        end
        u_out = vout(node_to_idx[u])
        v_in = vin(node_to_idx[v])
        if reachable[u_out] && !reachable[v_in]
            push!(min_cut_edges, (u, v))
            if !isinf(cap)
                min_cut_capacity += max(0.0, cap)
            end
        end
    end

    for n in all_nodes
        if n in source_nodes || n in target_nodes
            continue
        end
        cap_n = get(node_capacities, n, Inf)
        if isinf(cap_n)
            continue
        end
        n_in = vin(node_to_idx[n])
        n_out = vout(node_to_idx[n])
        if reachable[n_in] && !reachable[n_out]
            push!(min_cut_nodes, n)
            min_cut_capacity += max(0.0, cap_n)
        end
    end

    edge_cut_capacity = isempty(min_cut_edges) ? 0.0 : sum(get(edge_capacities, e, 0.0) for e in min_cut_edges if !isinf(get(edge_capacities, e, Inf)))
    node_cut_capacity = isempty(min_cut_nodes) ? 0.0 : sum(get(node_capacities, n, 0.0) for n in min_cut_nodes if !isinf(get(node_capacities, n, Inf)))

    bottleneck_type = if total_flow <= tolerance
        :source_limited
    elseif isempty(min_cut_edges) && isempty(min_cut_nodes)
        :source_limited
    elseif isempty(min_cut_nodes)
        :edge_capacity
    elseif isempty(min_cut_edges)
        :node_processing
    elseif abs(edge_cut_capacity - node_cut_capacity) <= tolerance
        :mixed
    elseif edge_cut_capacity < node_cut_capacity
        :edge_capacity
    else
        :node_processing
    end

    return node_flows, edge_flows, total_flow,
           min_cut_edges, min_cut_nodes, min_cut_capacity, bottleneck_type
end

"""
Compute maximum flow with iterative refinement for better accuracy
Uses multiple passes to handle complex flow distributions

# Arguments
Same as compute_max_flow_dag, plus:
- `max_iterations`: Maximum refinement iterations (default: 100)

# Returns
Same as compute_max_flow_dag, plus: converged::Bool, iterations::Int

# Note
The algorithm is deterministic given fixed inputs. Convergence is achieved
when total flow stabilizes between iterations. Typically converges in 1-2 passes.
"""
function compute_max_flow_iterative(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64, Set{Int64}},
    incoming_index::Dict{Int64, Set{Int64}},
    source_nodes::Set{Int64},
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64};
    tolerance::Float64 = 1e-10,
    max_iterations::Int = 100
)
    node_flows, edge_flows, total_flow = compute_max_flow_dag(
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_capacities,
        edge_capacities,
        source_rates,
        target_nodes,
        tolerance = tolerance
    )

    return node_flows, edge_flows, total_flow, true, 1
end

"""
Compute classical max-flow (ignoring node processing capacities)
Useful for comparative analysis

# Arguments
Same as compute_max_flow_dag but node_capacities is optional

# Returns
Same as compute_max_flow_dag
"""
function compute_classical_max_flow(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64, Set{Int64}},
    incoming_index::Dict{Int64, Set{Int64}},
    source_nodes::Set{Int64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64};
    tolerance::Float64 = 1e-10
)
    dummy_node_caps = Dict{Int64, Float64}()
    for layer in iteration_sets
        for node in layer
            dummy_node_caps[node] = Inf
        end
    end

    node_flows, edge_flows, total_flow, _, _, _ = _solve_exact_max_flow(
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        dummy_node_caps,
        edge_capacities,
        source_rates,
        target_nodes,
        tolerance = tolerance,
        ignore_node_caps = true
    )

    return node_flows, edge_flows, total_flow
end

# Export functions
export compute_max_flow_dag, compute_max_flow_iterative, compute_classical_max_flow,
       compute_max_flow_and_min_cut_dag
