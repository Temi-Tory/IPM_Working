module FlowModule

export FlowSolveResult,
	   solve_max_flow_edmonds_karp,
	   solve_max_flow_dinic,
	   sink_flows,
	   node_inflow,
	   node_outflow,
	   validate_capacity_constraints,
	   validate_flow_conservation,
	   validate_maxflow_mincut,
	   validate_exactness

struct FlowSolveResult
	max_flow::Float64
	flow::Dict{Tuple{Int64,Int64},Float64}
	augmented_flow::Dict{Tuple{Int64,Int64},Float64}
	augmented_outgoing::Dict{Int64,Set{Int64}}
	augmented_incoming::Dict{Int64,Set{Int64}}
	augmented_capacities::Dict{Tuple{Int64,Int64},Float64}
	residual_capacity::Dict{Tuple{Int64,Int64},Float64}
	node_flow::Dict{Int64,Float64}
	sources::Vector{Int64}
	sinks::Vector{Int64}
	super_source::Int64
	super_sink::Int64
	mincut_S::Set{Int64}
	mincut_T::Set{Int64}
	mincut_capacity::Float64
	saturated_edges::Vector{Tuple{Int64,Int64}}
	sink_flow::Dict{Int64,Float64}
	is_unbounded::Bool
end

function _has_infinite_augmenting_path(
	source::Int64,
	target::Int64,
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	flow::Dict{Tuple{Int64,Int64},Float64},
	tol::Float64
)::Bool
	visited = Set{Int64}([source])
	queue = Int64[source]
	head = 1

	while head <= length(queue)
		u = queue[head]
		head += 1

		for v in get(outgoing_index, u, Set{Int64}())
			residual = capacities[(u, v)] - get(flow, (u, v), 0.0)
			if isinf(residual) && residual > tol && !(v in visited)
				v == target && return true
				push!(visited, v)
				push!(queue, v)
			end
		end

		for p in get(incoming_index, u, Set{Int64}())
			residual = get(flow, (p, u), 0.0)
			if isinf(residual) && residual > tol && !(p in visited)
				p == target && return true
				push!(visited, p)
				push!(queue, p)
			end
		end
	end

	return false
end

function _compute_original_residual_capacity(
	edgelist::Vector{Tuple{Int64,Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	flow::Dict{Tuple{Int64,Int64},Float64}
)::Dict{Tuple{Int64,Int64},Float64}
	return Dict{Tuple{Int64,Int64},Float64}(e => capacities[e] - get(flow, e, 0.0) for e in edgelist)
end

function _compute_node_flow(
	graph_nodes::Set{Int64},
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	flow::Dict{Tuple{Int64,Int64},Float64},
	source_nodes::Vector{Int64},
	sink_nodes::Vector{Int64},
	tol::Float64
)::Dict{Int64,Float64}
	sources = Set(source_nodes)
	sinks = Set(sink_nodes)
	node_flow = Dict{Int64,Float64}()

	for node in graph_nodes
		inflow = node_inflow(node, incoming_index, flow)
		outflow = node_outflow(node, outgoing_index, flow)
		if node in sources
			node_flow[node] = outflow
		elseif node in sinks
			node_flow[node] = inflow
		elseif abs(inflow - outflow) <= tol
			node_flow[node] = inflow
		else
			throw(ArgumentError("Flow conservation violated while computing node_flow at node $node: inflow=$inflow, outflow=$outflow."))
		end
	end

	return node_flow
end

function _compute_cut_capacity(
	augmented_capacities::Dict{Tuple{Int64,Int64},Float64},
	mincut_S::Set{Int64},
	mincut_T::Set{Int64},
	super_source::Int64,
	super_sink::Int64
)::Float64
	cut_capacity = 0.0
	for ((u, v), cap) in augmented_capacities
		if (u in mincut_S) && (v in mincut_T) && u != super_source && v != super_sink
			cut_capacity += cap
		end
	end
	return cut_capacity
end

function _bfs_augmenting_path(
	source::Int64,
	target::Int64,
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	flow::Dict{Tuple{Int64,Int64},Float64},
	tol::Float64
)
	parent = Dict{Int64,Tuple{Int64,Symbol,Tuple{Int64,Int64}}}()
	visited = Set{Int64}([source])
	queue = Int64[source]
	head = 1

	while head <= length(queue)
		u = queue[head]
		head += 1

		for v in get(outgoing_index, u, Set{Int64}())
			edge = (u, v)
			residual = capacities[edge] - get(flow, edge, 0.0)
			if residual > tol && !(v in visited)
				parent[v] = (u, :forward, edge)
				v == target && return true, parent
				push!(visited, v)
				push!(queue, v)
			end
		end

		for p in get(incoming_index, u, Set{Int64}())
			edge = (p, u)
			residual = get(flow, edge, 0.0)
			if residual > tol && !(p in visited)
				# Backward residual step: we traverse from u -> p in the residual graph
				# using original edge (p,u). Parent map stores BFS predecessor in residual traversal,
				# so parent[p] = (u, :backward, (p,u)) is intentional.
				parent[p] = (u, :backward, edge)
				p == target && return true, parent
				push!(visited, p)
				push!(queue, p)
			end
		end
	end

	return false, parent
end

function _reachable_residual(
	source::Int64,
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	flow::Dict{Tuple{Int64,Int64},Float64},
	tol::Float64
)::Set{Int64}
	reachable = Set{Int64}([source])
	queue = Int64[source]
	head = 1

	while head <= length(queue)
		u = queue[head]
		head += 1

		for v in get(outgoing_index, u, Set{Int64}())
			residual = capacities[(u, v)] - get(flow, (u, v), 0.0)
			if residual > tol && !(v in reachable)
				push!(reachable, v)
				push!(queue, v)
			end
		end

		for p in get(incoming_index, u, Set{Int64}())
			residual = get(flow, (p, u), 0.0)
			if residual > tol && !(p in reachable)
				push!(reachable, p)
				push!(queue, p)
			end
		end
	end

	return reachable
end

function _build_augmented_network(
	edgelist::Vector{Tuple{Int64,Int64}},
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	source_nodes::Vector{Int64},
	sink_nodes::Vector{Int64}
)
	all_nodes = union(Set(first.(edgelist)), Set(last.(edgelist)))
	min_node = isempty(all_nodes) ? Int64(0) : minimum(all_nodes)
	super_source = min_node - 1
	super_sink = min_node - 2

	aug_out = Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in outgoing_index)
	aug_in = Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in incoming_index)
	aug_caps = Dict{Tuple{Int64,Int64},Float64}(capacities)
	aug_edges = copy(edgelist)

	for s in source_nodes
		edge = (super_source, s)
		aug_caps[edge] = Inf
		push!(aug_edges, edge)
		if !haskey(aug_out, super_source)
			aug_out[super_source] = Set{Int64}()
		end
		push!(aug_out[super_source], s)
		if !haskey(aug_in, s)
			aug_in[s] = Set{Int64}()
		end
		push!(aug_in[s], super_source)
	end

	for t in sink_nodes
		edge = (t, super_sink)
		aug_caps[edge] = Inf
		push!(aug_edges, edge)
		if !haskey(aug_out, t)
			aug_out[t] = Set{Int64}()
		end
		push!(aug_out[t], super_sink)
		if !haskey(aug_in, super_sink)
			aug_in[super_sink] = Set{Int64}()
		end
		push!(aug_in[super_sink], t)
	end

	return aug_edges, aug_out, aug_in, aug_caps, super_source, super_sink
end

"""
	solve_max_flow_edmonds_karp(edgelist, outgoing_index, incoming_index, capacities, source_nodes, sink_nodes; tol=1e-10, validate=true)

Exact max-flow solution with Edmonds-Karp on precomputed graph metadata from InputProcessing.
This API requires source/sink sets explicitly and does not perform auto-detection.

Mathematical constraints enforced:
- 0 ≤ f(u,v) ≤ c(u,v)
- Flow conservation at each non-source, non-sink node
- Max-flow = Min-cut capacity (unless unbounded flow exists)
"""
function solve_max_flow_edmonds_karp(
	edgelist::Vector{Tuple{Int64,Int64}},
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	source_nodes::Vector{Int64},
	sink_nodes::Vector{Int64};
	tol::Float64=1e-10,
	validate::Bool=true
)::FlowSolveResult
	isempty(edgelist) && throw(ArgumentError("edgelist is empty."))
	isempty(source_nodes) && throw(ArgumentError("source_nodes cannot be empty."))
	isempty(sink_nodes) && throw(ArgumentError("sink_nodes cannot be empty."))
	!isempty(intersect(Set(source_nodes), Set(sink_nodes))) &&
		throw(ArgumentError("A node cannot be both source and sink."))

	graph_nodes = union(Set(first.(edgelist)), Set(last.(edgelist)))
	for s in source_nodes
		s in graph_nodes || throw(ArgumentError("source node $s is not present in graph nodes."))
	end
	for t in sink_nodes
		t in graph_nodes || throw(ArgumentError("sink node $t is not present in graph nodes."))
	end

	for e in edgelist
		haskey(capacities, e) || throw(ArgumentError("Missing capacity for edge $e"))
		c = capacities[e]
		(isnan(c) || c < 0.0) && throw(ArgumentError("Invalid capacity for edge $e: $c"))
	end

	aug_edges, aug_out, aug_in, aug_caps, super_source, super_sink =
		_build_augmented_network(edgelist, outgoing_index, incoming_index, capacities, source_nodes, sink_nodes)

	flow = Dict{Tuple{Int64,Int64},Float64}(e => 0.0 for e in aug_edges)
	max_flow = 0.0
	is_unbounded = false
	_has_infinite_augmenting_path(super_source, super_sink, aug_out, aug_in, aug_caps, flow, tol) &&
		return FlowSolveResult(
			Inf,
			Dict{Tuple{Int64,Int64},Float64}(e => 0.0 for e in edgelist),
			Dict{Tuple{Int64,Int64},Float64}(e => 0.0 for e in aug_edges),
			Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in aug_out),
			Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in aug_in),
			Dict{Tuple{Int64,Int64},Float64}(aug_caps),
			Dict{Tuple{Int64,Int64},Float64}(e => capacities[e] for e in edgelist),
			# For an immediate unbounded detection, no finite flow has been pushed on original edges.
			# Using an empty original-flow dictionary yields zero inflow/outflow at all original nodes,
			# which is conservation-consistent for this sentinel return object.
			_compute_node_flow(graph_nodes, outgoing_index, incoming_index, Dict{Tuple{Int64,Int64},Float64}(), source_nodes, sink_nodes, tol),
			source_nodes,
			sink_nodes,
			super_source,
			super_sink,
			setdiff(graph_nodes, Set([super_source, super_sink])),
			Set{Int64}(),
			Inf,
			Tuple{Int64,Int64}[],
			Dict{Int64,Float64}(t => Inf for t in sink_nodes),
			true
		)

	while true
		found, parent = _bfs_augmenting_path(super_source, super_sink, aug_out, aug_in, aug_caps, flow, tol)
		!found && break

		path_edges = Tuple{Int64,Int64,Symbol,Tuple{Int64,Int64}}[]
		v = super_sink
		bottleneck = Inf

		while v != super_source
			haskey(parent, v) || throw(ArgumentError("Internal error: incomplete parent map during path reconstruction."))
			u, mode, edge = parent[v]
			residual = mode === :forward ? (aug_caps[edge] - get(flow, edge, 0.0)) : get(flow, edge, 0.0)
			bottleneck = min(bottleneck, residual)
			push!(path_edges, (u, v, mode, edge))
			v = u
		end

		if isinf(bottleneck)
			is_unbounded = true
			max_flow = Inf
			break
		end

		for (_, _, mode, edge) in path_edges
			if mode === :forward
				flow[edge] = get(flow, edge, 0.0) + bottleneck
			else
				flow[edge] = get(flow, edge, 0.0) - bottleneck
				if flow[edge] < tol
					flow[edge] = 0.0
				end
			end
		end

		max_flow += bottleneck
	end

	reachable = _reachable_residual(super_source, aug_out, aug_in, aug_caps, flow, tol)
	all_aug_nodes = union(
		Set(keys(aug_out)),
		Set(keys(aug_in)),
		graph_nodes,
		Set(source_nodes),
		Set(sink_nodes),
		Set([super_source, super_sink])
	)
	mincut_S = setdiff(reachable, Set([super_source, super_sink]))
	mincut_T = setdiff(all_aug_nodes, reachable, Set([super_source, super_sink]))
	cut_capacity = _compute_cut_capacity(aug_caps, union(mincut_S, Set([super_source])), union(mincut_T, Set([super_sink])), super_source, super_sink)

	original_flow = Dict{Tuple{Int64,Int64},Float64}(e => get(flow, e, 0.0) for e in edgelist)
	augmented_flow = Dict{Tuple{Int64,Int64},Float64}(flow)
	residual_capacity = _compute_original_residual_capacity(edgelist, capacities, original_flow)
	node_flow = _compute_node_flow(graph_nodes, outgoing_index, incoming_index, original_flow, source_nodes, sink_nodes, tol)
	saturated = [e for e in edgelist if isfinite(capacities[e]) && abs(get(original_flow, e, 0.0) - capacities[e]) <= tol]
	sink_flow = Dict{Int64,Float64}(t => get(flow, (t, super_sink), 0.0) for t in sink_nodes)

	result = FlowSolveResult(
		max_flow,
		original_flow,
		augmented_flow,
		Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in aug_out),
		Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in aug_in),
		Dict{Tuple{Int64,Int64},Float64}(aug_caps),
		residual_capacity,
		node_flow,
		source_nodes,
		sink_nodes,
		super_source,
		super_sink,
		mincut_S,
		mincut_T,
		cut_capacity,
		saturated,
		sink_flow,
		is_unbounded
	)

	if validate && !is_unbounded
		validate_exactness(result, edgelist, outgoing_index, incoming_index, capacities; tol=tol)
		validate_maxflow_mincut(result; tol=tol)
	end

	return result
end

function _build_level_graph_dinic(
	source::Int64,
	target::Int64,
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	flow::Dict{Tuple{Int64,Int64},Float64},
	tol::Float64
)
	level = Dict{Int64,Int}()
	level[source] = 0
	queue = Int64[source]
	head = 1

	while head <= length(queue)
		u = queue[head]
		head += 1
		lu = level[u]

		for v in get(outgoing_index, u, Set{Int64}())
			residual = capacities[(u, v)] - get(flow, (u, v), 0.0)
			if residual > tol && !haskey(level, v)
				level[v] = lu + 1
				push!(queue, v)
			end
		end

		for p in get(incoming_index, u, Set{Int64}())
			residual = get(flow, (p, u), 0.0)
			if residual > tol && !haskey(level, p)
				level[p] = lu + 1
				push!(queue, p)
			end
		end
	end

	return level, haskey(level, target)
end

function _build_dinic_adjacency(
	level::Dict{Int64,Int},
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	flow::Dict{Tuple{Int64,Int64},Float64},
	tol::Float64
)
	adj = Dict{Int64,Vector{Tuple{Int64,Symbol,Tuple{Int64,Int64}}}}()
	for (u, lu) in level
		moves = Tuple{Int64,Symbol,Tuple{Int64,Int64}}[]

		for v in get(outgoing_index, u, Set{Int64}())
			if get(level, v, -1) == lu + 1
				residual = capacities[(u, v)] - get(flow, (u, v), 0.0)
				residual > tol && push!(moves, (v, :forward, (u, v)))
			end
		end

		for p in get(incoming_index, u, Set{Int64}())
			if get(level, p, -1) == lu + 1
				residual = get(flow, (p, u), 0.0)
				residual > tol && push!(moves, (p, :backward, (p, u)))
			end
		end

		adj[u] = moves
	end
	return adj
end

function _dinic_dfs_blocking(
	u::Int64,
	target::Int64,
	pushed::Float64,
	adj::Dict{Int64,Vector{Tuple{Int64,Symbol,Tuple{Int64,Int64}}}},
	ptr::Dict{Int64,Int},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	flow::Dict{Tuple{Int64,Int64},Float64},
	tol::Float64
)::Float64
	u == target && return pushed
	moves = get(adj, u, Tuple{Int64,Symbol,Tuple{Int64,Int64}}[])
	start_i = get(ptr, u, 1)

	for i in start_i:length(moves)
		ptr[u] = i
		v, mode, edge = moves[i]
		residual = mode === :forward ? (capacities[edge] - get(flow, edge, 0.0)) : get(flow, edge, 0.0)
		residual <= tol && continue

		candidate = min(pushed, residual)
		candidate <= tol && continue
		tr = _dinic_dfs_blocking(v, target, candidate, adj, ptr, capacities, flow, tol)

		if tr > tol
			if mode === :forward
				flow[edge] = get(flow, edge, 0.0) + tr
			else
				flow[edge] = get(flow, edge, 0.0) - tr
				if flow[edge] < tol
					flow[edge] = 0.0
				end
			end
			return tr
		end
	end

	ptr[u] = length(moves) + 1
	return 0.0
end

"""
	solve_max_flow_dinic(edgelist, outgoing_index, incoming_index, capacities, source_nodes, sink_nodes; tol=1e-10, validate=true)

Exact max-flow solution with Dinic's algorithm on precomputed graph metadata from
InputProcessing. This API requires source/sink sets explicitly.

Mathematical constraints enforced:
- 0 ≤ f(u,v) ≤ c(u,v)
- Flow conservation at each non-source, non-sink node
- Max-flow = Min-cut capacity (unless unbounded flow exists)
"""
function solve_max_flow_dinic(
	edgelist::Vector{Tuple{Int64,Int64}},
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64},
	source_nodes::Vector{Int64},
	sink_nodes::Vector{Int64};
	tol::Float64=1e-10,
	validate::Bool=true
)::FlowSolveResult
	isempty(edgelist) && throw(ArgumentError("edgelist is empty."))
	isempty(source_nodes) && throw(ArgumentError("source_nodes cannot be empty."))
	isempty(sink_nodes) && throw(ArgumentError("sink_nodes cannot be empty."))
	!isempty(intersect(Set(source_nodes), Set(sink_nodes))) &&
		throw(ArgumentError("A node cannot be both source and sink."))

	graph_nodes = union(Set(first.(edgelist)), Set(last.(edgelist)))
	for s in source_nodes
		s in graph_nodes || throw(ArgumentError("source node $s is not present in graph nodes."))
	end
	for t in sink_nodes
		t in graph_nodes || throw(ArgumentError("sink node $t is not present in graph nodes."))
	end

	for e in edgelist
		haskey(capacities, e) || throw(ArgumentError("Missing capacity for edge $e"))
		c = capacities[e]
		(isnan(c) || c < 0.0) && throw(ArgumentError("Invalid capacity for edge $e: $c"))
	end

	aug_edges, aug_out, aug_in, aug_caps, super_source, super_sink =
		_build_augmented_network(edgelist, outgoing_index, incoming_index, capacities, source_nodes, sink_nodes)

	flow = Dict{Tuple{Int64,Int64},Float64}(e => 0.0 for e in aug_edges)
	max_flow = 0.0
	is_unbounded = false
	_has_infinite_augmenting_path(super_source, super_sink, aug_out, aug_in, aug_caps, flow, tol) &&
		return FlowSolveResult(
			Inf,
			Dict{Tuple{Int64,Int64},Float64}(e => 0.0 for e in edgelist),
			Dict{Tuple{Int64,Int64},Float64}(e => 0.0 for e in aug_edges),
			Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in aug_out),
			Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in aug_in),
			Dict{Tuple{Int64,Int64},Float64}(aug_caps),
			Dict{Tuple{Int64,Int64},Float64}(e => capacities[e] for e in edgelist),
			_compute_node_flow(graph_nodes, outgoing_index, incoming_index, Dict{Tuple{Int64,Int64},Float64}(), source_nodes, sink_nodes, tol),
			source_nodes,
			sink_nodes,
			super_source,
			super_sink,
			setdiff(graph_nodes, Set([super_source, super_sink])),
			Set{Int64}(),
			Inf,
			Tuple{Int64,Int64}[],
			Dict{Int64,Float64}(t => Inf for t in sink_nodes),
			true
		)

	while true
		level, reachable_sink = _build_level_graph_dinic(super_source, super_sink, aug_out, aug_in, aug_caps, flow, tol)
		reachable_sink || break

		adj = _build_dinic_adjacency(level, aug_out, aug_in, aug_caps, flow, tol)
		ptr = Dict{Int64,Int}(u => 1 for u in keys(level))

		while true
			pushed = _dinic_dfs_blocking(super_source, super_sink, Inf, adj, ptr, aug_caps, flow, tol)
			pushed <= tol && break

			if isinf(pushed)
				is_unbounded = true
				max_flow = Inf
				break
			end

			max_flow += pushed
		end

		is_unbounded && break
	end

	reachable = _reachable_residual(super_source, aug_out, aug_in, aug_caps, flow, tol)
	all_aug_nodes = union(
		Set(keys(aug_out)),
		Set(keys(aug_in)),
		graph_nodes,
		Set(source_nodes),
		Set(sink_nodes),
		Set([super_source, super_sink])
	)
	mincut_S = setdiff(reachable, Set([super_source, super_sink]))
	mincut_T = setdiff(all_aug_nodes, reachable, Set([super_source, super_sink]))
	cut_capacity = _compute_cut_capacity(aug_caps, union(mincut_S, Set([super_source])), union(mincut_T, Set([super_sink])), super_source, super_sink)

	original_flow = Dict{Tuple{Int64,Int64},Float64}(e => get(flow, e, 0.0) for e in edgelist)
	augmented_flow = Dict{Tuple{Int64,Int64},Float64}(flow)
	residual_capacity = _compute_original_residual_capacity(edgelist, capacities, original_flow)
	node_flow = _compute_node_flow(graph_nodes, outgoing_index, incoming_index, original_flow, source_nodes, sink_nodes, tol)
	saturated = [e for e in edgelist if isfinite(capacities[e]) && abs(get(original_flow, e, 0.0) - capacities[e]) <= tol]
	sink_flow = Dict{Int64,Float64}(t => get(flow, (t, super_sink), 0.0) for t in sink_nodes)

	result = FlowSolveResult(
		max_flow,
		original_flow,
		augmented_flow,
		Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in aug_out),
		Dict{Int64,Set{Int64}}(k => copy(v) for (k, v) in aug_in),
		Dict{Tuple{Int64,Int64},Float64}(aug_caps),
		residual_capacity,
		node_flow,
		source_nodes,
		sink_nodes,
		super_source,
		super_sink,
		mincut_S,
		mincut_T,
		cut_capacity,
		saturated,
		sink_flow,
		is_unbounded
	)

	if validate && !is_unbounded
		validate_exactness(result, edgelist, outgoing_index, incoming_index, capacities; tol=tol)
		validate_maxflow_mincut(result; tol=tol)
	end

	return result
end

"""
	sink_flows(result)

Return sink-wise throughput values.
"""
sink_flows(result::FlowSolveResult) = result.sink_flow

"""
	node_inflow(node, incoming_index, flow)

Compute total inflow at a node from directed edge flows.
"""
function node_inflow(
	node::Int64,
	incoming_index::Dict{Int64,Set{Int64}},
	flow::Dict{Tuple{Int64,Int64},Float64}
)::Float64
	total = 0.0
	for u in get(incoming_index, node, Set{Int64}())
		total += get(flow, (u, node), 0.0)
	end
	return total
end

"""
	node_outflow(node, outgoing_index, flow)

Compute total outflow at a node from directed edge flows.
"""
function node_outflow(
	node::Int64,
	outgoing_index::Dict{Int64,Set{Int64}},
	flow::Dict{Tuple{Int64,Int64},Float64}
)::Float64
	total = 0.0
	for v in get(outgoing_index, node, Set{Int64}())
		total += get(flow, (node, v), 0.0)
	end
	return total
end

"""
	validate_capacity_constraints(result, edgelist, capacities; tol=1e-10)

Verify 0 ≤ f(u,v) ≤ c(u,v) for every original edge.
"""
function validate_capacity_constraints(
	result::FlowSolveResult,
	edgelist::Vector{Tuple{Int64,Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64};
	tol::Float64=1e-10
)::Nothing
	for e in edgelist
		f = get(result.flow, e, 0.0)
		c = capacities[e]
		if f < -tol
			throw(ArgumentError("Capacity constraint violated: flow on edge $e is negative ($f)."))
		end
		if isfinite(c) && f - c > tol
			throw(ArgumentError("Capacity constraint violated: flow($e)=$f exceeds capacity=$c."))
		end
	end
	nothing
end

"""
	validate_flow_conservation(result, outgoing_index, incoming_index; tol=1e-10)

Verify inflow equals outflow for each non-source and non-sink original node.
"""
function validate_flow_conservation(
	result::FlowSolveResult,
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}};
	tol::Float64=1e-10
)::Nothing
	all_nodes = union(Set(keys(outgoing_index)), Set(keys(incoming_index)))
	terminals = union(Set(result.sources), Set(result.sinks))

	for node in all_nodes
		node in terminals && continue
		inflow = node_inflow(node, incoming_index, result.flow)
		outflow = node_outflow(node, outgoing_index, result.flow)
		if abs(inflow - outflow) > tol
			throw(ArgumentError("Flow conservation violated at node $node: inflow=$inflow, outflow=$outflow."))
		end
	end
	nothing
end

"""
	validate_maxflow_mincut(result; tol=1e-10)

Verify max-flow min-cut theorem numerically using stored min-cut capacity in the result.
"""
function validate_maxflow_mincut(
	result::FlowSolveResult;
	tol::Float64=1e-10
)::Nothing
	if !(isinf(result.max_flow) && isinf(result.mincut_capacity)) &&
		abs(result.max_flow - result.mincut_capacity) > tol
		throw(ArgumentError("Max-flow/min-cut mismatch: max_flow=$(result.max_flow), cut_capacity=$(result.mincut_capacity)."))
	end
	nothing
end

"""
	validate_exactness(result, edgelist, outgoing_index, incoming_index, capacities; tol=1e-10)

Run exactness checks (capacity constraints + flow conservation).
"""
function validate_exactness(
	result::FlowSolveResult,
	edgelist::Vector{Tuple{Int64,Int64}},
	outgoing_index::Dict{Int64,Set{Int64}},
	incoming_index::Dict{Int64,Set{Int64}},
	capacities::Dict{Tuple{Int64,Int64},Float64};
	tol::Float64=1e-10
)::Nothing
	validate_capacity_constraints(result, edgelist, capacities; tol=tol)
	validate_flow_conservation(result, outgoing_index, incoming_index; tol=tol)
	nothing
end

end
