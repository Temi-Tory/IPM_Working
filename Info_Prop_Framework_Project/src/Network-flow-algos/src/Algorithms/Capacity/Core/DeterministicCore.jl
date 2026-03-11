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
if !isdefined(@__MODULE__, :enumerate_critical_paths)
    include("../Algorithms/Paths.jl")
end
if !isdefined(@__MODULE__, :analyze_bottlenecks)
    include("../Analysis/Bottlenecks.jl")
end
if !isdefined(@__MODULE__, :compute_sensitivity_analysis)
    include("../Analysis/Sensitivity.jl")
end
if !isdefined(@__MODULE__, :generate_upgrade_recommendations)
    include("../Analysis/Recommendations.jl")
end
if !isdefined(@__MODULE__, :perform_comparative_analysis)
    include("../Analysis/Comparative.jl")
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
    
    # Step 1: Compute maximum flow (+ exact min-cut for primary algorithm)
    min_cut_edges = Set{Tuple{Int64,Int64}}()
    min_cut_nodes = Set{Int64}()
    min_cut_capacity = 0.0

    if options.algorithm == :ford_fulkerson_dag
        node_flows, edge_flows, total_max_flow,
        min_cut_edges, min_cut_nodes, min_cut_capacity, _ = compute_max_flow_and_min_cut_dag(
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

        # Fallback min-cut extraction for non-primary algorithms
        min_cut_edges, min_cut_nodes, min_cut_capacity, _ = identify_min_cut(
            edge_flows, node_flows, edge_capacities, node_capacities, target_nodes,
            tolerance = options.tolerance
        )
    end
    
    # Step 2: Calculate target flows
    target_flows = Dict{Int64, Float64}(
        target => get(node_flows, target, 0.0) for target in target_nodes
    )
    
    # Step 3: Enhanced bottleneck analysis (Phase 3)
    bottlenecks = analyze_bottlenecks(
        edge_flows, node_flows,
        edge_capacities, node_capacities,
        source_rates, target_nodes,
        min_cut_edges, min_cut_nodes, min_cut_capacity,
        tolerance = options.tolerance
    )
    
    # Step 4: Calculate network utilization
    total_edge_capacity = sum(c for (e, c) in edge_capacities if !isinf(c))
    total_node_capacity = sum(c for (n, c) in node_capacities if !isinf(c))
    total_capacity = total_edge_capacity + total_node_capacity
    
    network_utilization = if total_capacity > 0.0
        total_used = sum(values(edge_flows)) + sum(values(node_flows))
        min(1.0, total_used / total_capacity)
    else
        0.0
    end
    
    # Step 5: Optional analyses (Phase 3)
    upgrade_priorities = nothing
    critical_paths = nothing
    comparative_analysis = nothing
    
    if options.compute_upgrade_priorities
        # Phase 3: Use enhanced sensitivity-based recommendations
        edge_marginal_values, node_marginal_values, investment_efficiency = 
            compute_sensitivity_analysis(
                topology, edge_flows, node_flows,
                edge_capacities, node_capacities,
                source_rates, target_nodes,
                min_cut_edges, min_cut_nodes,
                total_max_flow,
                tolerance = options.tolerance
            )
        
        upgrade_priorities = generate_upgrade_recommendations(
            edge_flows, node_flows,
            edge_capacities, node_capacities,
            edge_marginal_values, node_marginal_values,
            investment_efficiency,
            min_cut_edges, min_cut_nodes,
            bottlenecks
        )
    end
    
    if options.enumerate_critical_paths
        # Phase 3: Enumerate critical paths for DAG
        critical_paths = enumerate_critical_paths(
            topology, edge_flows, node_flows,
            edge_capacities, node_capacities,
            topology.source_nodes, target_nodes,
            max_paths = options.max_paths_to_return,
            tolerance = options.tolerance
        )
    end
    
    if options.include_classical_comparison
        # Phase 3: Enhanced comparative analysis
        comparative_analysis = perform_comparative_analysis(
            topology, edge_capacities, node_capacities,
            source_rates, target_nodes,
            total_max_flow, bottlenecks,
            compute_classical_flow_function = compute_classical_max_flow,
            tolerance = options.tolerance
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

# Export main function
export analyze_capacity_deterministic
