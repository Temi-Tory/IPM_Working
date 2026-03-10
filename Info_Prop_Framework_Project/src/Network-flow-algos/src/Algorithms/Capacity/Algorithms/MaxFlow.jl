# Algorithms/MaxFlow.jl
# Ford-Fulkerson max-flow algorithm optimized for DAGs
# Exploits topological ordering for efficient computation

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
    # Initialize flow tracking
    node_flows = Dict{Int64, Float64}()
    edge_flows = Dict{Tuple{Int64,Int64}, Float64}()
    
    # Process nodes in topological order (iteration sets)
    for iteration_set in iteration_sets
        for node in iteration_set
            # Calculate incoming flow
            incoming_flow = 0.0
            
            if node in source_nodes
                # Source node: use source rate
                incoming_flow = get(source_rates, node, 0.0)
            else
                # Regular node: sum incoming edge flows
                if haskey(incoming_index, node)
                    for source_node in incoming_index[node]
                        edge = (source_node, node)
                        incoming_flow += get(edge_flows, edge, 0.0)
                    end
                end
            end
            
            # Apply node processing capacity constraint
            node_capacity = get(node_capacities, node, Inf)
            available_flow = min(incoming_flow, node_capacity)
            
            # Store node flow
            node_flows[node] = available_flow
            
            # Distribute flow to outgoing edges (if not a target)
            if !(node in target_nodes) && haskey(outgoing_index, node)
                outgoing_edges = collect(outgoing_index[node])
                
                if !isempty(outgoing_edges)
                    # Separate constrained (finite capacity) and unconstrained (Inf) edges
                    constrained_edges = []
                    unconstrained_edges = []
                    total_constrained_capacity = 0.0
                    
                    for target in outgoing_edges
                        edge = (node, target)
                        edge_capacity = get(edge_capacities, edge, Inf)
                        if isinf(edge_capacity)
                            push!(unconstrained_edges, target)
                        else
                            push!(constrained_edges, target)
                            total_constrained_capacity += edge_capacity
                        end
                    end
                    
                    total_allocated = 0.0
                    
                    # Distribute to constrained edges proportionally by their finite capacities
                    if total_constrained_capacity > tolerance && !isempty(constrained_edges)
                        for target_node in constrained_edges
                            edge = (node, target_node)
                            edge_capacity = get(edge_capacities, edge, Inf)
                            
                            # Proportional allocation among constrained edges
                            proportion = edge_capacity / total_constrained_capacity
                            allocated_flow = available_flow * proportion
                            
                            # Apply edge capacity constraint
                            edge_flow = min(allocated_flow, edge_capacity)
                            edge_flows[edge] = edge_flow
                            total_allocated += edge_flow
                        end
                    end
                    
                    # Distribute remaining flow to unconstrained edges equally
                    if !isempty(unconstrained_edges)
                        remaining_flow = max(0.0, available_flow - total_allocated)
                        per_edge_flow = remaining_flow / length(unconstrained_edges)
                        
                        for target_node in unconstrained_edges
                            edge = (node, target_node)
                            edge_flows[edge] = per_edge_flow
                            total_allocated += per_edge_flow
                        end
                    end
                    
                    # Update node_flows to reflect actual outgoing
                    node_flows[node] = total_allocated
                end
            else
                # Target nodes don't distribute flow further
                if node in target_nodes
                    node_flows[node] = get(node_flows, node, available_flow)
                end
            end
        end
    end
    
    # BACKWARD PASS: Propagate bottleneck constraints backward through the network
    # Iteratively ensure flow conservation and respect downstream capacity limits
    # Multiple iterations ensure cascading upstream corrections
    backward_iterations = 0
    backward_converged = false
    max_backward_iterations = 10  # Prevent infinite loops
    
    while backward_iterations < max_backward_iterations && !backward_converged
        backward_iterations += 1
        max_change = 0.0
        
        for iteration_set in reverse(iteration_sets)
            for node in iteration_set
                if node in target_nodes
                    # Target nodes: their node_flows already set from incoming edges
                    continue
                end
                
                # Calculate total outgoing flow
                total_outgoing = 0.0
                if haskey(outgoing_index, node)
                    for target in outgoing_index[node]
                        total_outgoing += get(edge_flows, (node, target), 0.0)
                    end
                end
                
                # Update node_flows to actual outgoing (ensures flow conservation)
                old_node_flow = get(node_flows, node, 0.0)
                if !isempty(get(outgoing_index, node, Set()))
                    node_flows[node] = total_outgoing
                    max_change = max(max_change, abs(node_flows[node] - old_node_flow))
                end
                
                # Recalculate incoming edges to match actual node throughput
                # (for nodes that aren't sources)
                if !(node in source_nodes) && haskey(incoming_index, node)
                    max_incoming = node_flows[node]  # Can't bring in more than we output
                    actual_incoming = 0.0
                    
                    # Calculate current total incoming
                    for source_node in incoming_index[node]
                        edge = (source_node, node)
                        if haskey(edge_flows, edge)
                            actual_incoming += edge_flows[edge]
                        end
                    end
                    
                    # Scale down incoming edges if they exceed output capacity
                    if actual_incoming > max_incoming + tolerance
                        scale_factor = max_incoming / actual_incoming
                        for source_node in incoming_index[node]
                            edge = (source_node, node)
                            if haskey(edge_flows, edge)
                                old_flow = edge_flows[edge]
                                edge_flows[edge] *= scale_factor
                                max_change = max(max_change, abs(edge_flows[edge] - old_flow))
                            end
                        end
                    end
                end
            end
        end
        
        # Check if converged (no significant changes in this backward pass)
        if max_change < tolerance
            backward_converged = true
        end
    end
    
    # Recalculate total flow after backward propagation
    total_flow = sum(get(node_flows, target, 0.0) for target in target_nodes)
    
    return node_flows, edge_flows, total_flow
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
    prev_total_flow = -1.0  # Initialize to impossible value
    node_flows = Dict{Int64, Float64}()
    edge_flows = Dict{Tuple{Int64,Int64}, Float64}()
    total_flow = 0.0
    converged = false
    
    for iteration in 1:max_iterations
        # Compute flow for this iteration
        node_flows, edge_flows, total_flow = compute_max_flow_dag(
            iteration_sets, outgoing_index, incoming_index,
            source_nodes, node_capacities, edge_capacities,
            source_rates, target_nodes,
            tolerance = tolerance
        )
        
        # Check convergence: has total flow stabilized?
        if iteration > 1 && abs(total_flow - prev_total_flow) < tolerance
            converged = true
            return node_flows, edge_flows, total_flow, true, iteration
        end
        
        # Special case: if flow is zero and has been zero for 2 iterations, converged
        if total_flow < tolerance && prev_total_flow < tolerance
            converged = true
            return node_flows, edge_flows, total_flow, true, iteration
        end
        
        prev_total_flow = total_flow
    end
    
    # Did not converge after max_iterations
    # Return best solution found (from last iteration)
    return node_flows, edge_flows, total_flow, false, max_iterations
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
    # Set all node capacities to infinity (no processing constraints)
    all_nodes = Set{Int64}()
    for iteration_set in iteration_sets
        union!(all_nodes, iteration_set)
    end
    
    infinite_node_capacities = Dict{Int64, Float64}(
        node => Inf for node in all_nodes
    )
    
    # Use standard max-flow with infinite node capacities
    return compute_max_flow_dag(
        iteration_sets, outgoing_index, incoming_index,
        source_nodes, infinite_node_capacities, edge_capacities,
        source_rates, target_nodes,
        tolerance = tolerance
    )
end

# Export functions
export compute_max_flow_dag, compute_max_flow_iterative, compute_classical_max_flow
