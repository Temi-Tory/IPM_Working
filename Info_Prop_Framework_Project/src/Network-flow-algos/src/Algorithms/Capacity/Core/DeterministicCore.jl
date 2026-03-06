# Core/DeterministicCore.jl
# Main deterministic capacity analysis engine
# Combines max-flow computation with bottleneck identification

using Dates

# Allow standalone use of this file while avoiding duplicate includes
# when loaded via CapacityAnalysisModule.jl.
if !isdefined(@__MODULE__, :NetworkTopology)
    include("Types.jl")
end
if !isdefined(@__MODULE__, :compute_max_flow_dag)
    include("../Algorithms/MaxFlow.jl")
end
if !isdefined(@__MODULE__, :identify_min_cut)
    include("../Algorithms/MinCut.jl")
end

"""
Perform complete deterministic capacity analysis

# Arguments
- `problem`: BasicCapacityProblem with all required inputs
- `options`: CapacityAnalysisOptions (optional configuration)

# Returns
- CapacityAnalysisResult with complete analysis
"""
function analyze_capacity_deterministic(
    problem::BasicCapacityProblem,
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)
    start_time = time()
    
    # Extract problem data
    topology = problem.topology
    node_capacities = problem.node_capacities
    edge_capacities = problem.edge_capacities
    source_rates = problem.source_rates
    target_nodes = problem.target_nodes
    
    # Step 1: Compute maximum flow
    if options.algorithm == :ford_fulkerson_dag
        node_flows, edge_flows, total_max_flow, converged, iterations = compute_max_flow_iterative(
            topology.iteration_sets,
            topology.outgoing_index,
            topology.incoming_index,
            topology.source_nodes,
            node_capacities,
            edge_capacities,
            source_rates,
            target_nodes,
            tolerance = options.tolerance,
            max_iterations = options.max_iterations
        )
    else
        # Default to single-pass
        node_flows, edge_flows, total_max_flow = compute_max_flow_dag(
            topology.iteration_sets,
            topology.outgoing_index,
            topology.incoming_index,
            topology.source_nodes,
            node_capacities,
            edge_capacities,
            source_rates,
            target_nodes,
            tolerance = options.tolerance
        )
        converged = true
        iterations = 1
    end
    
    # Step 2: Calculate target flows
    target_flows = Dict{Int64, Float64}(
        target => get(node_flows, target, 0.0) for target in target_nodes
    )
    
    # Step 3: Identify min-cut and bottlenecks
    min_cut_edges, min_cut_nodes, min_cut_capacity, bottleneck_type = identify_min_cut(
        edge_flows, node_flows, edge_capacities, node_capacities, target_nodes,
        tolerance = options.tolerance
    )
    
    # Step 4: Identify saturated components
    saturated_edges, saturated_nodes, near_saturated_edges, near_saturated_nodes = 
        identify_saturated_components(
            edge_flows, node_flows, edge_capacities, node_capacities, target_nodes,
            tolerance = options.tolerance
        )
    
    # Step 5: Calculate utilization
    utilization_by_component = calculate_component_utilization(
        edge_flows, node_flows, edge_capacities, node_capacities,
        tolerance = options.tolerance
    )
    
    # Step 6: Calculate spare capacity
    total_spare_edge, total_spare_node = calculate_spare_capacity(
        edge_flows, node_flows, edge_capacities, node_capacities
    )
    
    # Step 7: Calculate network utilization
    total_edge_capacity = sum(c for (e, c) in edge_capacities if !isinf(c))
    total_node_capacity = sum(c for (n, c) in node_capacities if !isinf(c))
    total_capacity = total_edge_capacity + total_node_capacity
    
    network_utilization = if total_capacity > 0.0
        total_used = sum(values(edge_flows)) + sum(values(node_flows))
        min(1.0, total_used / total_capacity)
    else
        0.0
    end
    
    # Step 8: Build bottleneck report
    capacity_gap = if bottleneck_type == :source_limited
        # Need more source flow
        total_source = sum(values(source_rates))
        max(0.0, min_cut_capacity - total_source)
    else
        # Bottleneck is in network
        0.0
    end
    
    bottlenecks = BottleneckReport{Float64}(
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
    
    # Step 9: Optional analyses
    upgrade_priorities = nothing
    critical_paths = nothing
    comparative_analysis = nothing
    
    if options.compute_upgrade_priorities
        upgrade_priorities = compute_upgrade_priorities(
            edge_flows, node_flows,
            edge_capacities, node_capacities,
            min_cut_edges, min_cut_nodes,
            bottlenecks
        )
    end
    
    if options.include_classical_comparison
        comparative_analysis = compute_comparative_analysis(
            topology, edge_capacities, source_rates, target_nodes,
            total_max_flow, bottlenecks, options
        )
    end
    
    # Calculate computation time
    computation_time_ms = (time() - start_time) * 1000.0
    
    # Build result
    result = CapacityAnalysisResult{Float64}(
        total_max_flow,
        target_flows,
        network_utilization,
        node_flows,
        edge_flows,
        bottlenecks,
        upgrade_priorities,
        critical_paths,
        comparative_analysis,
        now(),
        computation_time_ms,
        options.algorithm,
        converged,
        true  # Exactness guaranteed for deterministic
    )
    
    return result
end

"""
Compute upgrade priorities based on sensitivity analysis
"""
function compute_upgrade_priorities(
    edge_flows::Dict{Tuple{Int64,Int64}, Float64},
    node_flows::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    min_cut_edges::Set{Tuple{Int64,Int64}},
    min_cut_nodes::Set{Int64},
    bottlenecks::BottleneckReport{Float64}
)
    edge_priorities = EdgeUpgradeRecommendation{Float64}[]
    node_priorities = NodeUpgradeRecommendation{Float64}[]
    
    # Edge recommendations
    for (edge, flow) in edge_flows
        capacity = get(edge_capacities, edge, Inf)
        if !isinf(capacity) && capacity > 0.0
            utilization = flow / capacity
            
            # Marginal value: 1.0 if in min-cut, else 0.0 (simplified)
            marginal_value = edge in min_cut_edges ? 1.0 : 0.0
            
            # Priority score based on utilization and criticality
            priority_score = if edge in min_cut_edges
                1.0
            elseif utilization > 0.9
                0.5 + 0.5 * utilization
            else
                utilization * 0.5
            end
            
            # Recommended capacity: add 20% if saturated
            recommended_capacity = if utilization > 0.95
                capacity * 1.2
            else
                capacity
            end
            
            expected_increase = (recommended_capacity - capacity) * marginal_value
            
            rationale = if edge in min_cut_edges
                "Critical bottleneck: Part of minimum cut constraining max flow"
            elseif utilization > 0.95
                "Near capacity: Operating at $(round(utilization*100, digits=1))% utilization"
            else
                "Adequate capacity: Currently at $(round(utilization*100, digits=1))% utilization"
            end
            
            rec = EdgeUpgradeRecommendation{Float64}(
                edge, capacity, flow, utilization,
                marginal_value, recommended_capacity, expected_increase,
                priority_score, rationale
            )
            push!(edge_priorities, rec)
        end
    end
    
    # Node recommendations (similar logic)
    for (node, flow) in node_flows
        capacity = get(node_capacities, node, Inf)
        if !isinf(capacity) && capacity > 0.0
            utilization = flow / capacity
            marginal_value = node in min_cut_nodes ? 1.0 : 0.0
            
            priority_score = if node in min_cut_nodes
                1.0
            elseif utilization > 0.9
                0.5 + 0.5 * utilization
            else
                utilization * 0.5
            end
            
            recommended_capacity = utilization > 0.95 ? capacity * 1.2 : capacity
            expected_increase = (recommended_capacity - capacity) * marginal_value
            
            rationale = if node in min_cut_nodes
                "Critical bottleneck: Processing capacity constrains max flow"
            elseif utilization > 0.95
                "Near capacity: Processing at $(round(utilization*100, digits=1))%"
            else
                "Adequate capacity: Processing at $(round(utilization*100, digits=1))%"
            end
            
            rec = NodeUpgradeRecommendation{Float64}(
                node, capacity, flow, utilization,
                marginal_value, recommended_capacity, expected_increase,
                priority_score, rationale
            )
            push!(node_priorities, rec)
        end
    end
    
    # Sort by priority
    sort!(edge_priorities, by = r -> r.priority_score, rev = true)
    sort!(node_priorities, by = r -> r.priority_score, rev = true)
    
    # Generate strategic summary
    primary_bottleneck = if !isempty(min_cut_edges)
        edge = first(min_cut_edges)
        "Edge $(edge[1]) → $(edge[2])"
    elseif !isempty(min_cut_nodes)
        "Node $(first(min_cut_nodes))"
    else
        "Source limited"
    end
    
    recommended_action = if !isempty(edge_priorities) && edge_priorities[1].priority_score > 0.9
        rec = edge_priorities[1]
        "Upgrade $(primary_bottleneck) from $(rec.current_capacity) to $(rec.recommended_capacity)"
    elseif !isempty(node_priorities) && node_priorities[1].priority_score > 0.9
        rec = node_priorities[1]
        "Upgrade node $(rec.node) from $(rec.current_capacity) to $(rec.recommended_capacity)"
    else
        "Network has adequate capacity"
    end
    
    investment_efficiency = Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}()
    for rec in edge_priorities
        investment_efficiency[rec.edge] = rec.marginal_value
    end
    for rec in node_priorities
        investment_efficiency[rec.node] = rec.marginal_value
    end
    
    return UpgradeAnalysis{Float64}(
        edge_priorities,
        node_priorities,
        primary_bottleneck,
        recommended_action,
        investment_efficiency
    )
end

"""
Compute comparative analysis (realistic vs classical max-flow)
"""
function compute_comparative_analysis(
    topology::NetworkTopology,
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64},
    realistic_max_flow::Float64,
    bottlenecks::BottleneckReport{Float64},
    options::CapacityAnalysisOptions
)
    # Compute classical max-flow (no node constraints)
    _, _, classical_max_flow = compute_classical_max_flow(
        topology.iteration_sets,
        topology.outgoing_index,
        topology.incoming_index,
        topology.source_nodes,
        edge_capacities,
        source_rates,
        target_nodes,
        tolerance = options.tolerance
    )
    
    # Classical min-cut (only edges)
    classical_min_cut = bottlenecks.min_cut_edges
    
    # Gap analysis
    capacity_gap = classical_max_flow - realistic_max_flow
    efficiency_loss = if classical_max_flow > 0.0
        capacity_gap / classical_max_flow
    else
        0.0
    end
    
    # Determine primary limitation
    primary_limitation = if efficiency_loss < 0.05
        :transmission  # Edges are the constraint
    else
        :processing  # Nodes are the constraint
    end
    
    # Strategic recommendation
    strategic_recommendation = if primary_limitation == :processing
        "Network is primarily limited by node processing capacity. Focus investments on upgrading processing nodes."
    else
        "Network is primarily limited by transmission capacity. Focus investments on upgrading edge capacities."
    end
    
    return ComparativeAnalysis(
        realistic_max_flow,
        bottlenecks.bottleneck_type,
        classical_max_flow,
        classical_min_cut,
        efficiency_loss,
        capacity_gap,
        primary_limitation,
        strategic_recommendation,
        collect(bottlenecks.min_cut_edges),
        collect(bottlenecks.min_cut_nodes),
        Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}()
    )
end

# Export main function
export analyze_capacity_deterministic
