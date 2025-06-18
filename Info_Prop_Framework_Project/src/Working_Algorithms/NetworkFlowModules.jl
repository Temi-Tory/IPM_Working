module NetworkFlowModule
    using ..NetworkDecompositionModule
    using ..InputProcessingModule

    # =================================
    # FLOW TYPE SYSTEM - Polymorphic dispatch for different network analyses
    # =================================
    abstract type FlowType end
    
    struct ReliabilityFlow <: FlowType end      # Original: P(success) 
    struct TimeFlow <: FlowType end             # Critical path analysis
    struct CapacityFlow <: FlowType end         # Throughput/bottleneck analysis
    struct CostFlow <: FlowType end             # Resource cost optimization
    struct ResourceFlow <: FlowType end         # Multi-resource constraints
    struct ThroughputFlow <: FlowType end       # Rate analysis over time
    struct RiskAdjustedFlow <: FlowType end     # Reliability × Capacity
    struct MultiObjectiveFlow <: FlowType end   # Combined optimization

    # =================================
    # ENHANCED INPUT STRUCTURES
    # =================================
    
    # Basic flow parameters
    struct FlowParameters
        # Core parameters (existing)
        node_priors::Dict{Int64, Float64}
        edge_probabilities::Dict{Tuple{Int64,Int64}, Float64}
        
        # Time analysis
        task_durations::Dict{Int64, Float64}
        dependency_delays::Dict{Tuple{Int64,Int64}, Float64}
        setup_times::Dict{Int64, Float64}
        teardown_times::Dict{Int64, Float64}
        
        # Capacity analysis  
        node_capacities::Dict{Int64, Float64}
        edge_capacities::Dict{Tuple{Int64,Int64}, Float64}
        processing_rates::Dict{Int64, Float64}
        storage_limits::Dict{Int64, Float64}
        
        # Resource constraints
        resource_requirements::Dict{Int64, Vector{String}}
        resource_availability::Dict{String, Float64}
        resource_costs::Dict{String, Float64}
        skill_matrices::Dict{Tuple{String,Int64}, Float64}
        
        # Cost parameters
        node_costs::Dict{Int64, Float64}
        edge_costs::Dict{Tuple{Int64,Int64}, Float64}
        penalty_costs::Dict{Int64, Float64}
        maintenance_costs::Dict{Int64, Float64}
        
        # Dynamic/time-varying parameters
        capacity_schedules::Dict{Int64, Vector{Tuple{Float64,Float64}}}  # (time, capacity)
        availability_windows::Dict{Int64, Vector{Tuple{Float64,Float64}}} # (start, end)
        priority_weights::Dict{Int64, Float64}
        
        # Quality/performance constraints
        error_rates::Dict{Int64, Float64}
        rework_probabilities::Dict{Int64, Float64}
        quality_thresholds::Dict{Int64, Float64}
        inspection_delays::Dict{Int64, Float64}
    end

    # =================================
    # FLOW COMBINATION RULES - Polymorphic dispatch by flow type
    # =================================
    
    function combine_flows(flows::Vector{Float64}, ::ReliabilityFlow)
        # Inclusion-exclusion for dependent probabilities (existing)
        return inclusion_exclusion(flows)
    end

    function combine_flows(flows::Vector{Float64}, ::TimeFlow) 
        # Critical path: maximum completion time
        return maximum(flows)
    end

    function combine_flows(flows::Vector{Float64}, ::CapacityFlow)
        # Bottleneck: minimum capacity constraint
        return minimum(flows)
    end

    function combine_flows(flows::Vector{Float64}, ::CostFlow)
        # Total cost: sum of all path costs
        return sum(flows)
    end

    function combine_flows(flows::Vector{Float64}, ::ResourceFlow)
        # Resource utilization: max resource requirement
        return maximum(flows)
    end

    function combine_flows(flows::Vector{Float64}, ::ThroughputFlow)
        # Throughput: parallel processing (1/sum of reciprocals)
        return length(flows) / sum(1.0 ./ flows)
    end

    function combine_flows(flows::Vector{Float64}, ::RiskAdjustedFlow)
        # Risk-adjusted capacity: reliability × capacity
        reliability = inclusion_exclusion(flows[1:div(length(flows),2)])
        capacity = minimum(flows[div(length(flows),2)+1:end])
        return reliability * capacity
    end

    function combine_flows(flows::Vector{Float64}, ::MultiObjectiveFlow)
        # Multi-objective: weighted combination (requires weights in params)
        # Return tuple for Pareto analysis
        time_cost = maximum(flows[1:3])  # time component
        resource_cost = sum(flows[4:6])  # cost component  
        reliability = inclusion_exclusion(flows[7:end])  # reliability
        return (time_cost, resource_cost, reliability)
    end

    # =================================
    # DIAMOND HANDLING BY FLOW TYPE
    # =================================
    
    function handle_diamond(group::AncestorGroup, flow_type::TimeFlow, 
                           results::Dict, params::FlowParameters)
        # Time analysis: Find critical path through diamond (no conditioning needed)
        paths = extract_all_diamond_paths(group)
        path_durations = Float64[]
        
        for path in paths
            path_time = 0.0
            for i in 1:(length(path)-1)
                current_node = path[i]
                next_node = path[i+1]
                
                # Add processing time at current node
                path_time += get(params.task_durations, current_node, 0.0)
                # Add dependency delay on edge
                path_time += get(params.dependency_delays, (current_node, next_node), 0.0)
                # Add setup time if this is start of new resource
                if i == 1
                    path_time += get(params.setup_times, current_node, 0.0)
                end
            end
            # Add final node processing time
            path_time += get(params.task_durations, path[end], 0.0)
            push!(path_durations, path_time)
        end
        
        return maximum(path_durations)  # Critical (longest) path
    end

    function handle_diamond(group::AncestorGroup, flow_type::CapacityFlow,
                           results::Dict, params::FlowParameters)
        # Capacity analysis: Find bottleneck constraints
        paths = extract_all_diamond_paths(group)
        path_capacities = Float64[]
        
        for path in paths
            path_capacity = Inf
            for i in 1:(length(path)-1)
                current_node = path[i]
                next_node = path[i+1]
                
                # Bottleneck at nodes
                node_cap = get(params.node_capacities, current_node, Inf)
                path_capacity = min(path_capacity, node_cap)
                
                # Bottleneck at edges  
                edge_cap = get(params.edge_capacities, (current_node, next_node), Inf)
                path_capacity = min(path_capacity, edge_cap)
            end
            # Final node capacity
            final_cap = get(params.node_capacities, path[end], Inf)
            path_capacity = min(path_capacity, final_cap)
            
            push!(path_capacities, path_capacity)
        end
        
        return minimum(path_capacities)  # System bottleneck
    end

    function handle_diamond(group::AncestorGroup, flow_type::ResourceFlow,
                           results::Dict, params::FlowParameters)
        # Resource analysis: Check resource constraints across paths
        paths = extract_all_diamond_paths(group)
        resource_usage = Dict{String, Float64}()
        
        for path in paths
            path_resources = Dict{String, Float64}()
            
            for node in path
                required_resources = get(params.resource_requirements, node, String[])
                for resource in required_resources
                    skill_factor = get(params.skill_matrices, (resource, node), 1.0)
                    base_requirement = get(params.task_durations, node, 1.0)
                    actual_requirement = base_requirement / skill_factor
                    
                    path_resources[resource] = get(path_resources, resource, 0.0) + actual_requirement
                end
            end
            
            # Check if this path is feasible given resource constraints
            feasible = true
            for (resource, needed) in path_resources
                available = get(params.resource_availability, resource, 0.0)
                if needed > available
                    feasible = false
                    break
                end
            end
            
            if feasible
                # Update global resource usage for parallel paths
                for (resource, needed) in path_resources
                    resource_usage[resource] = max(get(resource_usage, resource, 0.0), needed)
                end
            end
        end
        
        # Return resource utilization ratio (0-1)
        max_utilization = 0.0
        for (resource, used) in resource_usage
            available = get(params.resource_availability, resource, 1.0)
            utilization = used / available
            max_utilization = max(max_utilization, utilization)
        end
        
        return max_utilization
    end

    function handle_diamond(group::AncestorGroup, flow_type::ReliabilityFlow,
                           results::Dict, params::FlowParameters) 
        # Reliability analysis: Use existing diamond conditioning algorithm
        return updateDiamondJoin(group.highest_nodes, group, params...)
    end

    function handle_diamond(group::AncestorGroup, flow_type::ThroughputFlow,
                           results::Dict, params::FlowParameters)
        # Throughput analysis: Rate = min(capacity) / max(time)
        capacity_result = handle_diamond(group, CapacityFlow(), results, params)
        time_result = handle_diamond(group, TimeFlow(), results, params)
        
        return capacity_result / time_result  # Units per time
    end

    function handle_diamond(group::AncestorGroup, flow_type::RiskAdjustedFlow,
                           results::Dict, params::FlowParameters)
        # Risk-adjusted flow: Reliability × Capacity
        reliability = handle_diamond(group, ReliabilityFlow(), results, params)
        capacity = handle_diamond(group, CapacityFlow(), results, params)
        
        return reliability * capacity  # Expected effective capacity
    end

    # =================================
    # UNIFIED NETWORK ANALYSIS FUNCTION
    # =================================
    
    function analyze_network_flow(
        # Standard network structure (from existing modules)
        edgelist::Vector{Tuple{Int64,Int64}},
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        descendants::Dict{Int64, Set{Int64}}, 
        ancestors::Dict{Int64, Set{Int64}},
        diamond_structures::Dict{Int64, GroupedDiamondStructure},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64},
        
        # Flow-specific parameters
        flow_params::FlowParameters,
        flow_type::FlowType
    )
        results = Dict{Int64, Any}()
        
        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    results[node] = get_source_value(node, flow_params, flow_type)
                    continue
                end
                
                # Collect flows from all sources
                all_flows = Float64[]
                
                # Handle diamonds using flow-specific logic
                if haskey(diamond_structures, node)
                    structure = diamond_structures[node]
                    
                    # Process each diamond group
                    for group in structure.diamond
                        diamond_result = handle_diamond(group, flow_type, results, flow_params)
                        push!(all_flows, diamond_result)
                    end
                    
                    # Handle non-diamond parents
                    if !isempty(structure.non_diamond_parents)
                        non_diamond_flows = calculate_regular_flows(
                            structure.non_diamond_parents, node, results, flow_params, flow_type
                        )
                        append!(all_flows, non_diamond_flows)
                    end
                else
                    # Regular node processing
                    parents = incoming_index[node]
                    parent_flows = calculate_regular_flows(parents, node, results, flow_params, flow_type)
                    append!(all_flows, parent_flows)
                end
                
                # Combine flows using flow-type-specific rules
                if !isempty(all_flows)
                    combined_flow = combine_flows(all_flows, flow_type)
                    results[node] = apply_node_constraints(combined_flow, node, flow_params, flow_type)
                else
                    results[node] = get_default_value(flow_type)
                end
            end
        end
        
        return results
    end

    # =================================
    # HELPER FUNCTIONS
    # =================================
    
    function get_source_value(node::Int64, params::FlowParameters, flow_type::FlowType)
        if isa(flow_type, ReliabilityFlow)
            return get(params.node_priors, node, 1.0)
        elseif isa(flow_type, TimeFlow)
            return get(params.task_durations, node, 0.0)
        elseif isa(flow_type, CapacityFlow)
            return get(params.node_capacities, node, Inf)
        elseif isa(flow_type, CostFlow)
            return get(params.node_costs, node, 0.0)
        elseif isa(flow_type, ResourceFlow)
            return 0.0  # Source nodes don't consume resources
        else
            return 1.0  # Default
        end
    end

    function apply_node_constraints(flow_value::Any, node::Int64, params::FlowParameters, flow_type::FlowType)
        # Apply node-specific constraints based on flow type
        if isa(flow_type, CapacityFlow)
            node_limit = get(params.node_capacities, node, Inf)
            return min(flow_value, node_limit)
        elseif isa(flow_type, TimeFlow)
            processing_time = get(params.task_durations, node, 0.0)
            return flow_value + processing_time
        elseif isa(flow_type, CostFlow)
            node_cost = get(params.node_costs, node, 0.0)
            return flow_value + node_cost
        else
            return flow_value
        end
    end

    function calculate_regular_flows(parents::Set{Int64}, node::Int64, results::Dict, 
                                   params::FlowParameters, flow_type::FlowType)
        flows = Float64[]
        for parent in parents
            parent_result = results[parent]
            edge_contribution = get_edge_contribution((parent, node), params, flow_type)
            
            if isa(flow_type, TimeFlow)
                push!(flows, parent_result + edge_contribution)
            elseif isa(flow_type, CapacityFlow)
                push!(flows, min(parent_result, edge_contribution))
            else
                push!(flows, parent_result * edge_contribution)  # Multiplicative for reliability
            end
        end
        return flows
    end

    function get_edge_contribution(edge::Tuple{Int64,Int64}, params::FlowParameters, flow_type::FlowType)
        if isa(flow_type, ReliabilityFlow)
            return get(params.edge_probabilities, edge, 1.0)
        elseif isa(flow_type, TimeFlow)
            return get(params.dependency_delays, edge, 0.0)
        elseif isa(flow_type, CapacityFlow)
            return get(params.edge_capacities, edge, Inf)
        elseif isa(flow_type, CostFlow)
            return get(params.edge_costs, edge, 0.0)
        else
            return 1.0
        end
    end

    function extract_all_diamond_paths(group::AncestorGroup)
        # Extract all paths through diamond subgraph
        subgraph = group.subgraph
        paths = Vector{Vector{Int64}}()
        
        # Start from each source in the subgraph
        for source in subgraph.sources
            # Find all paths from this source to nodes that have outgoing edges to join
            target_nodes = Set{Int64}()
            for edge in subgraph.edgelist
                if edge[2] ∉ subgraph.relevant_nodes  # Edge goes outside subgraph
                    push!(target_nodes, edge[1])
                end
            end
            
            # Use DFS to find all paths
            for target in target_nodes
                found_paths = find_paths_dfs(source, target, subgraph.outgoing)
                append!(paths, found_paths)
            end
        end
        
        return paths
    end

    function find_paths_dfs(start::Int64, target::Int64, outgoing::Dict{Int64,Set{Int64}})
        paths = Vector{Vector{Int64}}()
        current_path = [start]
        visited = Set{Int64}([start])
        
        function dfs(current::Int64)
            if current == target
                push!(paths, copy(current_path))
                return
            end
            
            if haskey(outgoing, current)
                for neighbor in outgoing[current]
                    if neighbor ∉ visited
                        push!(current_path, neighbor)
                        push!(visited, neighbor)
                        dfs(neighbor)
                        pop!(current_path)
                        delete!(visited, neighbor)
                    end
                end
            end
        end
        
        dfs(start)
        return paths
    end

    # =================================
    # SPECIALIZED ANALYSIS FUNCTIONS
    # =================================
    
    function critical_path_analysis(network_data, task_durations, dependency_delays)
        params = FlowParameters(
            Dict{Int64,Float64}(), Dict{Tuple{Int64,Int64},Float64}(),  # unused reliability params
            task_durations, dependency_delays,
            Dict{Int64,Float64}(), Dict{Int64,Float64}(),  # setup/teardown times
            # ... other unused parameters as defaults
        )
        return analyze_network_flow(network_data..., params, TimeFlow())
    end

    function capacity_bottleneck_analysis(network_data, node_capacities, edge_capacities)
        params = FlowParameters(
            Dict{Int64,Float64}(), Dict{Tuple{Int64,Int64},Float64}(),  # unused reliability params
            Dict{Int64,Float64}(), Dict{Tuple{Int64,Int64},Float64}(),  # unused time params
            Dict{Int64,Float64}(), Dict{Int64,Float64}(),  # unused setup/teardown
            node_capacities, edge_capacities,
            # ... other unused parameters
        )
        return analyze_network_flow(network_data..., params, CapacityFlow())
    end

    function multi_resource_optimization(network_data, resource_requirements, resource_availability)
        params = FlowParameters(
            # ... set up all required parameters
        )
        return analyze_network_flow(network_data..., params, ResourceFlow())
    end

    function throughput_over_time_analysis(network_data, time_params, capacity_params)
        params = FlowParameters(
            # ... combine time and capacity parameters
        )
        return analyze_network_flow(network_data..., params, ThroughputFlow())
    end

end