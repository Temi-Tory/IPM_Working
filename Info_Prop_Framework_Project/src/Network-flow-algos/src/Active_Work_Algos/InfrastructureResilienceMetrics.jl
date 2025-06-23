module InfrastructureResilienceMetrics
    using ..NetworkDecompositionModule
    using ..InputProcessingModule
    using Combinatorics

    export ResilienceProfile, AvailabilityFlow, ResilienceFlow, VulnerabilityFlow,
           CascadeThresholdFlow, MinMaxFlow, RiskFlow,
           calculate_availability, calculate_resilience, calculate_vulnerability,
           calculate_cascade_threshold, calculate_min_max_flow, calculate_risk_profile,
           generate_resilience_profile

    # 
    # NEW FLOW TYPES FOR RESILIENCE ANALYSIS
    # 
    
    abstract type ResilienceFlowType <: FlowType end
    
    struct AvailabilityFlow <: ResilienceFlowType end        # Operational availability over time
    struct ResilienceFlow <: ResilienceFlowType end         # Recovery capability after failure
    struct VulnerabilityFlow <: ResilienceFlowType end      # Susceptibility to single points of failure
    struct CascadeThresholdFlow <: ResilienceFlowType end   # Failure propagation limits
    struct MinMaxFlow <: ResilienceFlowType end             # Network flow capacity bounds
    struct RiskFlow <: ResilienceFlowType end               # Composite risk assessment

    # 
    # MATHEMATICAL PARAMETERS FOR RESILIENCE
    # 
    
    struct ResilienceParameters
        # Availability parameters
        mttr::Dict{Int64, Float64}                    # Mean Time To Repair (hours)
        mtbf::Dict{Int64, Float64}                    # Mean Time Between Failures (hours)
        operational_dependencies::Dict{Int64, Set{Int64}}  # Nodes required for operation
        
        # Resilience parameters  
        recovery_rates::Dict{Int64, Float64}          # Recovery speed (capacity/hour)
        backup_capacities::Dict{Int64, Float64}      # Emergency backup capacity
        restoration_priorities::Dict{Int64, Int64}   # Priority order (1=highest)
        
        # Vulnerability parameters
        criticality_weights::Dict{Int64, Float64}    # Node importance (0-1)
        redundancy_factors::Dict{Int64, Float64}     # Local redundancy level
        isolation_potential::Dict{Int64, Float64}    # Ability to isolate failures
        
        # Cascade parameters
        failure_thresholds::Dict{Int64, Float64}     # Load threshold before failure
        propagation_delays::Dict{Tuple{Int64,Int64}, Float64}  # Failure spread time
        cascade_probabilities::Dict{Tuple{Int64,Int64}, Float64}  # P(failure spreads)
        
        # Flow parameters
        node_capacities::Dict{Int64, Float64}
        edge_capacities::Dict{Tuple{Int64,Int64}, Float64}
        demand_nodes::Dict{Int64, Float64}           # Required flow demand
        
        # Risk parameters
        threat_probabilities::Dict{Int64, Float64}   # External threat likelihood
        impact_severities::Dict{Int64, Float64}      # Consequence magnitude
        mitigation_effectiveness::Dict{Int64, Float64}  # Risk reduction factors
    end

    # 
    # 1. AVAILABILITY ANALYSIS
    # Mathematical Foundation: Markov Chain Steady-State Analysis
    # 
    
    """
    Availability = MTBF / (MTBF + MTTR)
    
    For networks: A_system = ∏(A_critical_path) using inclusion-exclusion on diamond structures
    """
    function calculate_availability(
        network_structure,  # Your existing network decomposition
        params::ResilienceParameters,
        analysis_time::Float64 = 8760.0  # hours (1 year)
    )::Dict{Int64, Float64}
        
        availability_results = Dict{Int64, Float64}()
        
        # Step 1: Calculate individual node availability
        node_availability = Dict{Int64, Float64}()
        for node in keys(params.mtbf)
            mtbf = params.mtbf[node]
            mttr = get(params.mttr, node, 0.0)
            
            # Basic availability formula
            node_availability[node] = mtbf / (mtbf + mttr)
            
            # Adjust for operational dependencies
            if haskey(params.operational_dependencies, node)
                deps = params.operational_dependencies[node]
                dep_availability = 1.0
                for dep in deps
                    dep_availability *= get(node_availability, dep, 1.0)
                end
                node_availability[node] *= dep_availability
            end
        end
        
        # Step 2: System-level availability using your diamond structures
        edgelist, iteration_sets, outgoing_index, incoming_index, 
        source_nodes, descendants, ancestors, diamond_structures, 
        join_nodes, fork_nodes = network_structure
        
        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    availability_results[node] = get(node_availability, node, 1.0)
                else
                    # Use your existing diamond handling logic
                    path_availabilities = Float64[]
                    
                    if haskey(diamond_structures, node)
                        structure = diamond_structures[node]
                        
                        # Handle each diamond group
                        for group in structure.diamond
                            diamond_availability = handle_availability_diamond(
                                group, availability_results, node_availability
                            )
                            push!(path_availabilities, diamond_availability)
                        end
                        
                        # Handle non-diamond parents
                        if !isempty(structure.non_diamond_parents)
                            non_diamond_avail = calculate_series_availability(
                                structure.non_diamond_parents, availability_results, node_availability
                            )
                            push!(path_availabilities, non_diamond_avail)
                        end
                    else
                        # Regular node - series combination of all paths
                        parents = incoming_index[node]
                        parent_availabilities = [availability_results[p] for p in parents]
                        push!(path_availabilities, prod(parent_availabilities))
                    end
                    
                    # Combine using parallel system formula (inclusion-exclusion)
                    if length(path_availabilities) == 1
                        availability_results[node] = path_availabilities[1] * node_availability[node]
                    else
                        combined_path_availability = inclusion_exclusion_availability(path_availabilities)
                        availability_results[node] = combined_path_availability * node_availability[node]
                    end
                end
            end
        end
        
        return availability_results
    end

    function handle_availability_diamond(group, availability_results, node_availability)
        # Extract all paths through diamond
        paths = extract_diamond_paths(group)
        path_availabilities = Float64[]
        
        for path in paths
            path_availability = 1.0
            for node in path
                path_availability *= get(availability_results, node, get(node_availability, node, 1.0))
            end
            push!(path_availabilities, path_availability)
        end
        
        # Parallel combination of paths
        return inclusion_exclusion_availability(path_availabilities)
    end

    function inclusion_exclusion_availability(availabilities::Vector{Float64})
        # P(at least one path works) = 1 - P(all paths fail)
        failure_prob = 1.0
        for avail in availabilities
            failure_prob *= (1.0 - avail)
        end
        return 1.0 - failure_prob
    end

    # 
    # 2. RESILIENCE ANALYSIS  
    # Mathematical Foundation: Recovery Rate Differential Equations
    # 
    
    """
    Resilience = ∫[0,T] (Recovery_Rate × Remaining_Capacity) dt / (Total_Capacity × T)
    
    Models system's ability to maintain function and recover from disruptions
    """
    function calculate_resilience(
        network_structure,
        params::ResilienceParameters,
        disruption_scenarios::Vector{Set{Int64}},  # Which nodes fail in each scenario
        recovery_time::Float64 = 168.0  # hours (1 week)
    )::Dict{String, Float64}
        
        resilience_results = Dict{String, Float64}()
        
        for (scenario_idx, failed_nodes) in enumerate(disruption_scenarios)
            scenario_name = "scenario_$scenario_idx"
            
            # Calculate time-dependent recovery
            total_performance = 0.0
            dt = 1.0  # 1 hour time steps
            
            for t in 0:dt:recovery_time
                # Current system performance at time t
                current_performance = calculate_performance_at_time(
                    network_structure, params, failed_nodes, t
                )
                total_performance += current_performance * dt
            end
            
            # Resilience metric: integrated performance over recovery period
            max_performance = calculate_performance_at_time(
                network_structure, params, Set{Int64}(), recovery_time  # No failures, full recovery
            )
            
            resilience_results[scenario_name] = total_performance / (max_performance * recovery_time)
        end
        
        return resilience_results
    end

    function calculate_performance_at_time(network_structure, params, failed_nodes, t)
        # Calculate system performance considering:
        # 1. Which nodes are currently failed
        # 2. Which nodes are recovering (based on recovery rates)
        # 3. Available backup capacity
        
        edgelist, iteration_sets, outgoing_index, incoming_index, 
        source_nodes, descendants, ancestors, diamond_structures, 
        join_nodes, fork_nodes = network_structure
        
        total_performance = 0.0
        
        for node in keys(params.recovery_rates)
            if node in failed_nodes
                # Node is recovering based on recovery rate
                recovery_rate = params.recovery_rates[node]
                backup_capacity = get(params.backup_capacities, node, 0.0)
                
                # Recovery function: exponential approach to full capacity
                recovered_fraction = 1.0 - exp(-recovery_rate * t)
                current_capacity = backup_capacity + (1.0 - backup_capacity) * recovered_fraction
            else
                # Node is fully operational
                current_capacity = 1.0
            end
            
            # Weight by criticality
            criticality = get(params.criticality_weights, node, 1.0)
            total_performance += current_capacity * criticality
        end
        
        return total_performance
    end

    # 
    # 3. VULNERABILITY ANALYSIS
    # Mathematical Foundation: Structural Importance Measures
    # 
    
    """
    Vulnerability = Σ(Criticality_i × (1 - Redundancy_i) × Connectivity_i)
    
    Identifies single points of failure and system weak points
    """
    function calculate_vulnerability(
        network_structure,
        params::ResilienceParameters
    )::Dict{Int64, Float64}
        
        vulnerability_scores = Dict{Int64, Float64}()
        
        edgelist, iteration_sets, outgoing_index, incoming_index, 
        source_nodes, descendants, ancestors, diamond_structures, 
        join_nodes, fork_nodes = network_structure
        
        # Calculate structural vulnerability metrics
        for node in keys(params.criticality_weights)
            # Component 1: Intrinsic criticality
            criticality = params.criticality_weights[node]
            
            # Component 2: Redundancy factor (lower redundancy = higher vulnerability)
            redundancy = get(params.redundancy_factors, node, 0.0)
            redundancy_vulnerability = 1.0 - redundancy
            
            # Component 3: Topological importance using your graph structures
            topological_importance = calculate_topological_importance(
                node, network_structure
            )
            
            # Component 4: Cascade potential
            cascade_potential = calculate_cascade_potential(
                node, params, outgoing_index, incoming_index
            )
            
            # Component 5: Isolation difficulty
            isolation_factor = 1.0 - get(params.isolation_potential, node, 0.0)
            
            # Composite vulnerability score
            vulnerability_scores[node] = (
                criticality * 
                redundancy_vulnerability * 
                topological_importance * 
                cascade_potential * 
                isolation_factor
            )
        end
        
        return vulnerability_scores
    end

    function calculate_topological_importance(node, network_structure)
        edgelist, iteration_sets, outgoing_index, incoming_index, 
        source_nodes, descendants, ancestors, diamond_structures, 
        join_nodes, fork_nodes = network_structure
        
        # Betweenness-like measure: how many paths go through this node
        total_paths = 0
        paths_through_node = 0
        
        # Use your existing source/sink identification
        all_nodes = union(keys(outgoing_index), keys(incoming_index))
        sinks = setdiff(all_nodes, keys(outgoing_index))
        
        for source in source_nodes
            for sink in sinks
                # Check if there's a path from source to sink
                if haskey(descendants, source) && sink in descendants[source]
                    total_paths += 1
                    # Check if path goes through our node
                    if node != source && node != sink
                        if haskey(descendants, source) && haskey(ancestors, sink)
                            if node in descendants[source] && node in ancestors[sink]
                                paths_through_node += 1
                            end
                        end
                    end
                end
            end
        end
        
        return total_paths > 0 ? paths_through_node / total_paths : 0.0
    end

    function calculate_cascade_potential(node, params, outgoing_index, incoming_index)
        # How many nodes could be affected if this node fails
        potential_victims = 0
        
        # Direct downstream effects
        if haskey(outgoing_index, node)
            for target in outgoing_index[node]
                cascade_prob = get(params.cascade_probabilities, (node, target), 0.0)
                potential_victims += cascade_prob
            end
        end
        
        # Upstream dependencies (nodes that depend on this one)
        if haskey(incoming_index, node)
            for source in incoming_index[node]
                cascade_prob = get(params.cascade_probabilities, (source, node), 0.0)
                potential_victims += cascade_prob * 0.5  # Reduced weight for upstream
            end
        end
        
        return potential_victims
    end

    # 
    # 4. CASCADE THRESHOLD ANALYSIS
    # Mathematical Foundation: Percolation Theory + Load Distribution
    # 
    
    """
    Cascade_Threshold = min{load_i : P(system_failure | load_i) > threshold}
    
    Determines maximum load/stress before system-wide failure
    """
    function calculate_cascade_threshold(
        network_structure,
        params::ResilienceParameters,
        load_increments::Vector{Float64} = collect(0.1:0.1:2.0)
    )::Dict{String, Float64}
        
        threshold_results = Dict{String, Float64}()
        
        # Test different load levels
        for load_factor in load_increments
            cascade_probability = simulate_cascade_probability(
                network_structure, params, load_factor
            )
            
            # Find threshold where cascade probability exceeds 50%
            if cascade_probability > 0.5
                threshold_results["critical_load"] = load_factor
                threshold_results["cascade_probability"] = cascade_probability
                break
            end
        end
        
        # Calculate safety margin
        if haskey(threshold_results, "critical_load")
            threshold_results["safety_margin"] = threshold_results["critical_load"] - 1.0
        else
            threshold_results["safety_margin"] = Inf  # No threshold found
        end
        
        return threshold_results
    end

    function simulate_cascade_probability(network_structure, params, load_factor)
        edgelist, iteration_sets, outgoing_index, incoming_index, 
        source_nodes, descendants, ancestors, diamond_structures, 
        join_nodes, fork_nodes = network_structure
        
        # Determine which nodes fail under this load
        failed_nodes = Set{Int64}()
        
        for node in keys(params.failure_thresholds)
            threshold = params.failure_thresholds[node]
            if load_factor > threshold
                push!(failed_nodes, node)
            end
        end
        
        # Simulate cascade propagation
        cascade_size = propagate_failures(
            failed_nodes, params, outgoing_index, incoming_index
        )
        
        total_nodes = length(union(keys(outgoing_index), keys(incoming_index)))
        return cascade_size / total_nodes
    end

    function propagate_failures(initial_failures, params, outgoing_index, incoming_index)
        failed_nodes = copy(initial_failures)
        newly_failed = copy(initial_failures)
        
        # Propagate failures until no new failures occur
        while !isempty(newly_failed)
            next_round_failures = Set{Int64}()
            
            for failed_node in newly_failed
                # Check downstream propagation
                if haskey(outgoing_index, failed_node)
                    for target in outgoing_index[failed_node]
                        if target ∉ failed_nodes
                            cascade_prob = get(params.cascade_probabilities, (failed_node, target), 0.0)
                            if rand() < cascade_prob
                                push!(next_round_failures, target)
                            end
                        end
                    end
                end
            end
            
            union!(failed_nodes, next_round_failures)
            newly_failed = next_round_failures
        end
        
        return length(failed_nodes)
    end

    # 
    # 5. MIN/MAX FLOW ANALYSIS
    # Mathematical Foundation: Network Flow Theory (Ford-Fulkerson)
    # 
    
    """
    Max_Flow = max{f : Σf_in = Σf_out, f_ij ≤ c_ij ∀edges}
    Min_Cut = min{C : removing C disconnects source from sink}
    """
    function calculate_min_max_flow(
        network_structure,
        params::ResilienceParameters,
        source_set::Set{Int64},
        sink_set::Set{Int64}
    )::Dict{String, Float64}
        
        flow_results = Dict{String, Float64}()
        
        # Add virtual supersource and supersink
        edgelist, iteration_sets, outgoing_index, incoming_index, 
        source_nodes, descendants, ancestors, diamond_structures, 
        join_nodes, fork_nodes = network_structure
        
        # Build capacity matrix
        all_nodes = union(keys(outgoing_index), keys(incoming_index))
        n = length(all_nodes)
        node_map = Dict(node => i for (i, node) in enumerate(sort(collect(all_nodes))))
        
        capacity_matrix = zeros(Float64, n, n)
        
        for (source, target) in edgelist
            i = node_map[source]
            j = node_map[target]
            capacity = get(params.edge_capacities, (source, target), 1.0)
            capacity_matrix[i, j] = capacity
        end
        
        # Calculate maximum flow using Ford-Fulkerson algorithm
        max_flow = ford_fulkerson_max_flow(
            capacity_matrix, source_set, sink_set, node_map
        )
        
        # Calculate minimum cut
        min_cut = calculate_min_cut(
            capacity_matrix, source_set, sink_set, node_map
        )
        
        flow_results["max_flow"] = max_flow
        flow_results["min_cut_capacity"] = min_cut
        flow_results["flow_efficiency"] = max_flow / sum(params.node_capacities[s] for s in source_set)
        
        return flow_results
    end

    function ford_fulkerson_max_flow(capacity_matrix, source_set, sink_set, node_map)
        # Simplified Ford-Fulkerson implementation
        # (You'd want a more efficient implementation for large networks)
        
        n = size(capacity_matrix, 1)
        flow_matrix = zeros(Float64, n, n)
        max_flow_value = 0.0
        
        # Create virtual source and sink
        virtual_source = n + 1
        virtual_sink = n + 2
        
        # Extend capacity matrix
        extended_capacity = zeros(Float64, n + 2, n + 2)
        extended_capacity[1:n, 1:n] = capacity_matrix
        
        # Connect virtual source to all sources
        for source in source_set
            i = node_map[source]
            extended_capacity[virtual_source, i] = Inf
        end
        
        # Connect all sinks to virtual sink
        for sink in sink_set
            i = node_map[sink]
            extended_capacity[i, virtual_sink] = Inf
        end
        
        # Find augmenting paths until none exist
        while true
            path, bottleneck = find_augmenting_path(extended_capacity, flow_matrix, virtual_source, virtual_sink)
            if isempty(path)
                break
            end
            
            # Update flow along path
            for i in 1:(length(path)-1)
                u, v = path[i], path[i+1]
                flow_matrix[u, v] += bottleneck
                flow_matrix[v, u] -= bottleneck
            end
            
            max_flow_value += bottleneck
        end
        
        return max_flow_value
    end

    function find_augmenting_path(capacity_matrix, flow_matrix, source, sink)
        n = size(capacity_matrix, 1)
        visited = falses(n)
        parent = fill(-1, n)
        queue = [source]
        visited[source] = true
        
        while !isempty(queue)
            u = popfirst!(queue)
            
            for v in 1:n
                residual_capacity = capacity_matrix[u, v] - flow_matrix[u, v]
                if !visited[v] && residual_capacity > 0
                    visited[v] = true
                    parent[v] = u
                    push!(queue, v)
                    
                    if v == sink
                        # Reconstruct path and find bottleneck
                        path = Int[]
                        current = sink
                        bottleneck = Inf
                        
                        while current != -1
                            pushfirst!(path, current)
                            if parent[current] != -1
                                bottleneck = min(bottleneck, capacity_matrix[parent[current], current] - flow_matrix[parent[current], current])
                            end
                            current = parent[current]
                        end
                        
                        return path, bottleneck
                    end
                end
            end
        end
        
        return Int[], 0.0
    end

    function calculate_min_cut(capacity_matrix, source_set, sink_set, node_map)
        # Min-cut capacity (equal to max flow by max-flow min-cut theorem)
        # This is a simplified calculation
        min_cut_capacity = Inf
        
        # Check all possible cuts
        n = size(capacity_matrix, 1)
        for cut_mask in 1:(2^n - 2)  # All non-trivial cuts
            source_side = Set{Int}()
            sink_side = Set{Int}()
            
            for i in 1:n
                if (cut_mask & (1 << (i-1))) != 0
                    push!(source_side, i)
                else
                    push!(sink_side, i)
                end
            end
            
            # Check if cut separates sources from sinks
            source_nodes_in_source_side = any(node_map[s] in source_side for s in source_set)
            sink_nodes_in_sink_side = any(node_map[s] in sink_side for s in sink_set)
            
            if source_nodes_in_source_side && sink_nodes_in_sink_side
                # Calculate cut capacity
                cut_capacity = 0.0
                for i in source_side, j in sink_side
                    cut_capacity += capacity_matrix[i, j]
                end
                min_cut_capacity = min(min_cut_capacity, cut_capacity)
            end
        end
        
        return min_cut_capacity
    end

    # 
    # 6. COMPREHENSIVE RISK ANALYSIS
    # Mathematical Foundation: Risk = Probability × Impact × Vulnerability
    # 
    
    """
    Risk_i = P(threat_i) × Impact_i × Vulnerability_i × (1 - Mitigation_i)
    
    Total_Risk = f(Individual_Risks, Correlations, Cascades)
    """
    function calculate_risk_profile(
        network_structure,
        params::ResilienceParameters,
        correlation_matrix::Matrix{Float64} = Matrix{Float64}(I, 0, 0)
    )::Dict{String, Float64}
        
        risk_results = Dict{String, Float64}()
        
        # Calculate individual node risks
        node_risks = Dict{Int64, Float64}()
        for node in keys(params.threat_probabilities)
            threat_prob = params.threat_probabilities[node]
            impact = get(params.impact_severities, node, 1.0)
            vulnerability = calculate_single_node_vulnerability(node, network_structure, params)
            mitigation = get(params.mitigation_effectiveness, node, 0.0)
            
            node_risks[node] = threat_prob * impact * vulnerability * (1.0 - mitigation)
        end
        
        # Calculate system-level risk considering correlations
        total_individual_risk = sum(values(node_risks))
        
        # Correlation adjustment (simplified)
        if !isempty(correlation_matrix)
            correlation_factor = calculate_correlation_factor(correlation_matrix)
            total_correlated_risk = total_individual_risk * correlation_factor
        else
            total_correlated_risk = total_individual_risk
        end
        
        # Cascade risk multiplication
        cascade_multiplier = calculate_cascade_risk_multiplier(network_structure, params)
        total_system_risk = total_correlated_risk * cascade_multiplier
        
        risk_results["individual_risk_sum"] = total_individual_risk
        risk_results["correlated_risk"] = total_correlated_risk
        risk_results["system_risk"] = total_system_risk
        risk_results["cascade_multiplier"] = cascade_multiplier
        
        return risk_results
    end

    function calculate_single_node_vulnerability(node, network_structure, params)
        # Simplified vulnerability calculation for single node
        criticality = get(params.criticality_weights, node, 1.0)
        redundancy = get(params.redundancy_factors, node, 0.0)
        return criticality * (1.0 - redundancy)
    end

    function calculate_correlation_factor(correlation_matrix)
        # Simplified correlation impact on total risk
        n = size(correlation_matrix, 1)
        if n == 0 return 1.0 end
        
        avg_correlation = (sum(correlation_matrix) - n) / (n * (n - 1))
        return 1.0 + avg_correlation * 0.5  # Correlation increases total risk
    end

    function calculate_cascade_risk_multiplier(network_structure, params)
        # Risk multiplication due to potential cascades
        edgelist, iteration_sets, outgoing_index, incoming_index, 
        source_nodes, descendants, ancestors, diamond_structures, 
        join_nodes, fork_nodes = network_structure
        
        total_cascade_potential = 0.0
        for (edge, prob) in params.cascade_probabilities
            total_cascade_potential += prob
        end
        
        num_edges = length(edgelist)
        avg_cascade_prob = num_edges > 0 ? total_cascade_potential / num_edges : 0.0
        
        return 1.0 + avg_cascade_prob * 2.0  # Cascades can double risk
    end

    # 
    # 7. COMPREHENSIVE RESILIENCE PROFILE
    # 
    
    struct ResilienceProfile
        availability::Dict{Int64, Float64}
        resilience::Dict{String, Float64}
        vulnerability::Dict{Int64, Float64}
        cascade_threshold::Dict{String, Float64}
        flow_capacity::Dict{String, Float64}
        risk_assessment::Dict{String, Float64}
        
        # Summary metrics
        overall_score::Float64
        critical_nodes::Vector{Int64}
        recommended_improvements::Vector{String}
    end

    function generate_resilience_profile(
        network_structure,
        params::ResilienceParameters;
        disruption_scenarios::Vector{Set{Int64}} = [Set{Int64}()],
        source_set::Set{Int64} = Set{Int64}(),
        sink_set::Set{Int64} = Set{Int64}()
    )::ResilienceProfile
        
        # Calculate all metrics
        availability = calculate_availability(network_structure, params)
        resilience = calculate_resilience(network_structure, params, disruption_scenarios)
        vulnerability = calculate_vulnerability(network_structure, params)
        cascade_threshold = calculate_cascade_threshold(network_structure, params)
        flow_capacity = if !isempty(source_set) && !isempty(sink_set)
            calculate_min_max_flow(network_structure, params, source_set, sink_set)
        else
            Dict{String, Float64}()
        end
        risk_assessment = calculate_risk_profile(network_structure, params)
        
        # Calculate overall score (weighted combination)
        avg_availability = mean(values(availability))
        avg_resilience = mean(values(resilience))
        avg_vulnerability = 1.0 - mean(values(vulnerability))  # Invert for score
        threshold_score = get(cascade_threshold, "safety_margin", 0.0)
        risk_score = 1.0 / (1.0 + get(risk_assessment, "system_risk", 1.0))
        
        overall_score = (
            0.25 * avg_availability +
            0.25 * avg_resilience +
            0.20 * avg_vulnerability +
            0.15 * min(threshold_score, 1.0) +
            0.15 * risk_score
        )
        
        # Identify critical nodes (top 10% vulnerability)
        sorted_vuln = sort(collect(vulnerability), by=x->x[2], rev=true)
        num_critical = max(1, length(sorted_vuln) ÷ 10)
        critical_nodes = [node for (node, _) in sorted_vuln[1:num_critical]]
        
        # Generate recommendations
        recommendations = generate_improvement_recommendations(
            availability, vulnerability, cascade_threshold, risk_assessment
        )
        
        return ResilienceProfile(
            availability, resilience, vulnerability, cascade_threshold,
            flow_capacity, risk_assessment, overall_score, critical_nodes, recommendations
        )
    end

    function generate_improvement_recommendations(availability, vulnerability, cascade_threshold, risk_assessment)
        recommendations = String[]
        
        # Low availability recommendations
        low_avail_nodes = [node for (node, avail) in availability if avail < 0.9]
        if !isempty(low_avail_nodes)
            push!(recommendations, "Improve maintenance for nodes: $(low_avail_nodes)")
        end
        
        # High vulnerability recommendations  
        high_vuln_nodes = [node for (node, vuln) in vulnerability if vuln > 0.7]
        if !isempty(high_vuln_nodes)
            push!(recommendations, "Add redundancy for critical nodes: $(high_vuln_nodes)")
        end
        
        # Cascade threshold recommendations
        safety_margin = get(cascade_threshold, "safety_margin", Inf)
        if safety_margin < 0.5
            push!(recommendations, "Increase load capacity to prevent cascading failures")
        end
        
        # Risk recommendations
        system_risk = get(risk_assessment, "system_risk", 0.0)
        if system_risk > 0.5
            push!(recommendations, "Implement additional risk mitigation measures")
        end
        
        return recommendations
    end

    # 
    # UTILITY FUNCTIONS
    # 
    
    function extract_diamond_paths(group)
        # Extract all possible paths through a diamond structure
        # This leverages your existing diamond decomposition
        paths = Vector{Vector{Int64}}()
        
        # Use the subgraph information from your diamond structures
        sources = group.subgraph.sources
        relevant_nodes = group.subgraph.relevant_nodes
        outgoing = group.subgraph.outgoing
        
        # Find paths from each source to nodes that lead to join
        for source in sources
            dfs_paths = find_all_paths_dfs(source, relevant_nodes, outgoing)
            append!(paths, dfs_paths)
        end
        
        return paths
    end

    function find_all_paths_dfs(start, relevant_nodes, outgoing)
        paths = Vector{Vector{Int64}}()
        
        function dfs(current_path, visited)
            current = current_path[end]
            
            if haskey(outgoing, current)
                for next_node in outgoing[current]
                    if next_node in relevant_nodes && next_node ∉ visited
                        new_path = copy(current_path)
                        push!(new_path, next_node)
                        new_visited = copy(visited)
                        push!(new_visited, next_node)
                        
                        push!(paths, new_path)
                        dfs(new_path, new_visited)
                    end
                end
            end
        end
        
        dfs([start], Set([start]))
        return paths
    end

    function calculate_series_availability(nodes, availability_results, node_availability)
        # Series system: all nodes must work
        total_availability = 1.0
        for node in nodes
            avail = get(availability_results, node, get(node_availability, node, 1.0))
            total_availability *= avail
        end
        return total_availability
    end

end