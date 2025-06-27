"""
DroneNetworkDagModule.jl

Sophisticated DAG conversion module specifically designed for drone networks.
Converts undirected feasibility graphs to DAGs while preserving operational meaning
and network properties for drone delivery systems.

Key Features:
- Multi-modal operational architecture (Supply Distribution, Emergency Response, Resilience Analysis)
- Four-tier node classification (Airports → Regional Hubs → Local Hubs → Hospitals)
- Domain-aware cycle breaking strategies
- Hierarchical scoring algorithm
- Operational context preservation
"""
module DroneNetworkDagModule
    using Graphs, LinearAlgebra, Statistics, DataStructures

    export DroneNetworkDAGConverter, convert_drone_network_to_dag, 
           establish_node_hierarchy, apply_directional_heuristics,
           resolve_cycles_intelligently, validate_dag_operational_viability

    # Node type classifications for drone networks
    @enum NodeType begin
        HOSPITAL = 1
        AIRPORT = 2
        REGIONAL_HUB = 3
        LOCAL_HUB = 4
        GENERIC = 5
    end

    # Operational modes for DAG conversion
    @enum OperationalMode begin
        SUPPLY_DISTRIBUTION = 1
        EMERGENCY_RESPONSE = 2
        RESILIENCE_ANALYSIS = 3
    end

    """
    Main converter struct for drone network DAG conversion
    """
    struct DroneNetworkDAGConverter
        node_types::Vector{NodeType}
        node_coordinates::Matrix{Float64}  # [lat, lon] or [east, north]
        operational_mode::OperationalMode
        drone_capabilities::Dict{String, Any}
        
        function DroneNetworkDAGConverter(node_types::Vector{NodeType},
                                        node_coordinates::Matrix{Float64},
                                        operational_mode::OperationalMode = SUPPLY_DISTRIBUTION,
                                        drone_capabilities::Dict = Dict{String, Any}())
            # Convert any Dict type to Dict{String, Any}
            capabilities_dict = Dict{String, Any}()
            for (k, v) in drone_capabilities
                capabilities_dict[string(k)] = v
            end
            new(node_types, node_coordinates, operational_mode, capabilities_dict)
        end
    end

    """
    Calculate hierarchical node importance based on operational context
    """
    function calculate_hierarchical_importance(converter::DroneNetworkDAGConverter, 
                                             adj_matrix::Matrix{Int})
        n = size(adj_matrix, 1)
        importance_scores = zeros(Float64, n)
        
        # Base importance by node type (operational hierarchy)
        type_importance = Dict(
            AIRPORT => 1.0,        # Highest - multi-modal hubs
            REGIONAL_HUB => 0.8,   # High - major distribution centers
            LOCAL_HUB => 0.6,      # Medium - local distribution
            HOSPITAL => 0.4,       # Lower - end destinations
            GENERIC => 0.2         # Lowest - flexible locations
        )
        
        # Calculate network metrics
        degrees = vec(sum(adj_matrix, dims=2))
        max_degree = maximum(degrees)
        
        # Geographic centrality (simplified - could use actual geographic center)
        if size(converter.node_coordinates, 2) >= 2
            center_lat = mean(converter.node_coordinates[:, 1])
            center_lon = mean(converter.node_coordinates[:, 2])
            geographic_centrality = zeros(Float64, n)
            
            for i in 1:n
                # Distance from geographic center (inverted for centrality)
                dist = sqrt((converter.node_coordinates[i, 1] - center_lat)^2 + 
                           (converter.node_coordinates[i, 2] - center_lon)^2)
                geographic_centrality[i] = 1.0 / (1.0 + dist)
            end
            geographic_centrality = geographic_centrality / maximum(geographic_centrality)
        else
            geographic_centrality = ones(Float64, n)
        end
        
        # Connectivity importance
        connectivity_importance = degrees / max_degree
        
        # Infrastructure capability (based on node type and connectivity)
        infrastructure_capability = zeros(Float64, n)
        for i in 1:n
            base_capability = type_importance[converter.node_types[i]]
            # Boost capability for highly connected nodes
            connectivity_boost = min(0.3, degrees[i] / max_degree * 0.3)
            infrastructure_capability[i] = base_capability + connectivity_boost
        end
        
        # Combine metrics based on operational mode
        for i in 1:n
            if converter.operational_mode == SUPPLY_DISTRIBUTION
                # Hub-centric: prioritize hubs and airports
                importance_scores[i] = (
                    0.4 * type_importance[converter.node_types[i]] +
                    0.3 * geographic_centrality[i] +
                    0.2 * connectivity_importance[i] +
                    0.1 * infrastructure_capability[i]
                )
            elseif converter.operational_mode == EMERGENCY_RESPONSE
                # Speed-centric: prioritize airports and high connectivity
                importance_scores[i] = (
                    0.3 * type_importance[converter.node_types[i]] +
                    0.2 * geographic_centrality[i] +
                    0.4 * connectivity_importance[i] +
                    0.1 * infrastructure_capability[i]
                )
            else # RESILIENCE_ANALYSIS
                # Robustness-centric: balanced approach with infrastructure focus
                importance_scores[i] = (
                    0.3 * type_importance[converter.node_types[i]] +
                    0.25 * geographic_centrality[i] +
                    0.25 * connectivity_importance[i] +
                    0.2 * infrastructure_capability[i]
                )
            end
        end
        
        return importance_scores, Dict(
            "degrees" => degrees,
            "geographic_centrality" => geographic_centrality,
            "connectivity_importance" => connectivity_importance,
            "infrastructure_capability" => infrastructure_capability,
            "type_importance" => [type_importance[t] for t in converter.node_types]
        )
    end

    """
    Establish node hierarchy for DAG conversion
    """
    function establish_node_hierarchy(converter::DroneNetworkDAGConverter, 
                                    adj_matrix::Matrix{Int})
        importance_scores, metrics = calculate_hierarchical_importance(converter, adj_matrix)
        
        # Create hierarchy levels
        n = length(importance_scores)
        hierarchy_levels = zeros(Int, n)
        sorted_indices = sortperm(importance_scores, rev=true)
        
        # Assign hierarchy levels (higher importance = lower level number)
        level = 1
        prev_importance = Inf
        level_threshold = 0.1  # Minimum difference to create new level
        
        for idx in sorted_indices
            if prev_importance - importance_scores[idx] > level_threshold
                level += 1
            end
            hierarchy_levels[idx] = level
            prev_importance = importance_scores[idx]
        end
        
        return hierarchy_levels, importance_scores, metrics
    end

    """
    Apply directional heuristics based on operational context
    """
    function apply_directional_heuristics(converter::DroneNetworkDAGConverter,
                                        adj_matrix::Matrix{Int},
                                        hierarchy_levels::Vector{Int},
                                        importance_scores::Vector{Float64})
        n = size(adj_matrix, 1)
        dag = zeros(Int, n, n)
        
        # Apply edges based on hierarchy and operational mode
        for i in 1:n
            for j in i+1:n
                if adj_matrix[i,j] == 1 || adj_matrix[j,i] == 1
                    # Determine edge direction based on multiple criteria
                    direction_score_i_to_j = 0.0
                    direction_score_j_to_i = 0.0
                    
                    # Hierarchy-based direction (higher hierarchy flows to lower)
                    if hierarchy_levels[i] < hierarchy_levels[j]
                        direction_score_i_to_j += 0.4
                    elseif hierarchy_levels[j] < hierarchy_levels[i]
                        direction_score_j_to_i += 0.4
                    end
                    
                    # Importance-based direction
                    if importance_scores[i] > importance_scores[j]
                        direction_score_i_to_j += 0.3
                    else
                        direction_score_j_to_i += 0.3
                    end
                    
                    # Node type specific rules
                    type_i = converter.node_types[i]
                    type_j = converter.node_types[j]
                    
                    # Operational flow patterns
                    if converter.operational_mode == SUPPLY_DISTRIBUTION
                        # Airports/Hubs → Hospitals
                        if (type_i in [AIRPORT, REGIONAL_HUB, LOCAL_HUB]) && type_j == HOSPITAL
                            direction_score_i_to_j += 0.3
                        elseif type_i == HOSPITAL && (type_j in [AIRPORT, REGIONAL_HUB, LOCAL_HUB])
                            direction_score_j_to_i += 0.3
                        end
                        # Airports → Hubs
                        if type_i == AIRPORT && type_j in [REGIONAL_HUB, LOCAL_HUB]
                            direction_score_i_to_j += 0.2
                        elseif type_j == AIRPORT && type_i in [REGIONAL_HUB, LOCAL_HUB]
                            direction_score_j_to_i += 0.2
                        end
                    elseif converter.operational_mode == EMERGENCY_RESPONSE
                        # Bidirectional preference for emergency routes, slight preference for airport origins
                        if type_i == AIRPORT
                            direction_score_i_to_j += 0.1
                        elseif type_j == AIRPORT
                            direction_score_j_to_i += 0.1
                        end
                    end
                    
                    # Make decision
                    if direction_score_i_to_j > direction_score_j_to_i
                        dag[i,j] = 1
                    else
                        dag[j,i] = 1
                    end
                end
            end
        end
        
        return dag
    end

    """
    Intelligent cycle resolution that preserves operational meaning
    """
    function resolve_cycles_intelligently(converter::DroneNetworkDAGConverter,
                                        dag::Matrix{Int},
                                        hierarchy_levels::Vector{Int},
                                        importance_scores::Vector{Float64})
        n = size(dag, 1)
        cycles_removed = 0
        max_iterations = n * sum(dag)  # Prevent infinite loops
        
        function detect_cycle_dfs(adj_matrix::Matrix{Int})
            visited = falses(n)
            rec_stack = falses(n)
            cycle_path = Int[]
            
            function dfs(v::Int, path::Vector{Int})
                visited[v] = true
                rec_stack[v] = true
                push!(path, v)
                
                for u in 1:n
                    if adj_matrix[v, u] == 1
                        if !visited[u]
                            if dfs(u, path)
                                return true
                            end
                        elseif rec_stack[u]
                            # Found cycle - extract cycle path
                            cycle_start_idx = findfirst(x -> x == u, path)
                            cycle_path = path[cycle_start_idx:end]
                            return true
                        end
                    end
                end
                
                rec_stack[v] = false
                pop!(path)
                return false
            end
            
            for v in 1:n
                if !visited[v]
                    if dfs(v, Int[])
                        return true, cycle_path
                    end
                end
            end
            
            return false, Int[]
        end
        
        function resolve_cycle!(cycle_nodes::Vector{Int})
            if length(cycle_nodes) < 2
                return
            end
            
            # Find the best edge to reverse based on multiple criteria
            best_edge = (0, 0)
            best_score = -Inf
            
            for i in 1:length(cycle_nodes)
                u = cycle_nodes[i]
                v = cycle_nodes[i % length(cycle_nodes) + 1]
                
                if dag[u, v] == 1
                    # Calculate reversal score (higher = better to reverse)
                    score = 0.0
                    
                    # Hierarchy violation penalty (reversing hierarchy-violating edges is better)
                    if hierarchy_levels[u] > hierarchy_levels[v]  # Wrong direction
                        score += 0.4
                    else
                        score -= 0.4  # Correct direction, penalize reversal
                    end
                    
                    # Importance-based penalty
                    if importance_scores[u] < importance_scores[v]  # Wrong direction
                        score += 0.3
                    else
                        score -= 0.3
                    end
                    
                    # Node type considerations
                    type_u = converter.node_types[u]
                    type_v = converter.node_types[v]
                    
                    # Penalize reversing operationally important flows
                    if converter.operational_mode == SUPPLY_DISTRIBUTION
                        if type_u == HOSPITAL && type_v in [AIRPORT, REGIONAL_HUB, LOCAL_HUB]
                            score += 0.3  # Good to reverse (hospitals shouldn't supply hubs)
                        elseif type_u in [AIRPORT, REGIONAL_HUB, LOCAL_HUB] && type_v == HOSPITAL
                            score -= 0.3  # Bad to reverse (hubs should supply hospitals)
                        end
                    end
                    
                    if score > best_score
                        best_score = score
                        best_edge = (u, v)
                    end
                end
            end
            
            # Reverse the selected edge
            if best_edge != (0, 0)
                u, v = best_edge
                dag[u, v] = 0
                dag[v, u] = 1
                cycles_removed += 1
            end
        end
        
        # Iteratively resolve cycles
        iteration = 0
        while iteration < max_iterations
            has_cycle, cycle_nodes = detect_cycle_dfs(dag)
            if !has_cycle
                break
            end
            
            resolve_cycle!(cycle_nodes)
            iteration += 1
        end
        
        if iteration == max_iterations
            @warn "Maximum cycle resolution iterations reached. Graph may still contain cycles."
        end
        
        return dag, cycles_removed
    end

    """
    Validate DAG operational viability
    """
    function validate_dag_operational_viability(converter::DroneNetworkDAGConverter,
                                               dag::Matrix{Int},
                                               original_adj::Matrix{Int})
        n = size(dag, 1)
        validation_results = Dict{String, Any}()
        
        # 1. Structural validation
        validation_results["is_acyclic"] = true
        validation_results["has_self_loops"] = false
        
        # Check for cycles using DFS
        visited = falses(n)
        rec_stack = falses(n)
        
        function has_cycle_dfs(v::Int)
            visited[v] = true
            rec_stack[v] = true
            
            for u in 1:n
                if dag[v, u] == 1
                    if !visited[u]
                        if has_cycle_dfs(u)
                            return true
                        end
                    elseif rec_stack[u]
                        return true
                    end
                end
            end
            
            rec_stack[v] = false
            return false
        end
        
        for v in 1:n
            if !visited[v] && has_cycle_dfs(v)
                validation_results["is_acyclic"] = false
                break
            end
        end
        
        # Check for self-loops
        for i in 1:n
            if dag[i, i] == 1
                validation_results["has_self_loops"] = true
                break
            end
        end
        
        # 2. Connectivity preservation
        original_edges = sum(original_adj[i,j] for i in 1:n for j in i+1:n 
                           if original_adj[i,j] == 1 || original_adj[j,i] == 1)
        dag_edges = sum(dag)
        validation_results["edge_retention_rate"] = dag_edges / original_edges
        validation_results["original_edges"] = original_edges
        validation_results["dag_edges"] = dag_edges
        
        # 3. Operational validation
        sources = [i for i in 1:n if sum(dag[:, i]) == 0]  # No incoming edges
        sinks = [i for i in 1:n if sum(dag[i, :]) == 0]    # No outgoing edges
        
        validation_results["sources"] = sources
        validation_results["sinks"] = sinks
        validation_results["num_sources"] = length(sources)
        validation_results["num_sinks"] = length(sinks)
        
        # Check if hospitals are reachable (for supply distribution)
        if converter.operational_mode == SUPPLY_DISTRIBUTION
            hospital_indices = [i for i in 1:n if converter.node_types[i] == HOSPITAL]
            reachable_hospitals = 0
            
            for hospital in hospital_indices
                # Check if hospital is reachable from any source
                for source in sources
                    if has_path_dfs(dag, source, hospital)
                        reachable_hospitals += 1
                        break
                    end
                end
            end
            
            validation_results["hospital_reachability"] = reachable_hospitals / length(hospital_indices)
            validation_results["total_hospitals"] = length(hospital_indices)
            validation_results["reachable_hospitals"] = reachable_hospitals
        end
        
        # 4. Multi-modal integration check
        airport_indices = [i for i in 1:n if converter.node_types[i] == AIRPORT]
        validation_results["airports_as_sources"] = sum(i in sources for i in airport_indices)
        validation_results["airports_as_intermediate"] = sum(sum(dag[:, i]) > 0 && sum(dag[i, :]) > 0 for i in airport_indices)
        
        return validation_results
    end

    """
    Helper function to check if path exists between two nodes using DFS
    """
    function has_path_dfs(adj_matrix::Matrix{Int}, start::Int, target::Int)
        n = size(adj_matrix, 1)
        visited = falses(n)
        
        function dfs(v::Int)
            if v == target
                return true
            end
            visited[v] = true
            
            for u in 1:n
                if adj_matrix[v, u] == 1 && !visited[u]
                    if dfs(u)
                        return true
                    end
                end
            end
            return false
        end
        
        return dfs(start)
    end

    """
    Main conversion function that orchestrates the entire process
    """
    function convert_drone_network_to_dag(converter::DroneNetworkDAGConverter,
                                        adj_matrix::Matrix{Int};
                                        verbose::Bool = true)
        if verbose
            println("=== Drone Network DAG Conversion ===")
            println("Operational Mode: $(converter.operational_mode)")
            println("Network Size: $(size(adj_matrix, 1)) nodes")
            println("Original Edges: $(sum(adj_matrix[i,j] for i in 1:size(adj_matrix,1) for j in i+1:size(adj_matrix,1) if adj_matrix[i,j] == 1 || adj_matrix[j,i] == 1))")
        end
        
        # Step 1: Establish node hierarchy
        if verbose println("Step 1: Establishing node hierarchy...") end
        hierarchy_levels, importance_scores, metrics = establish_node_hierarchy(converter, adj_matrix)
        
        # Step 2: Apply directional heuristics
        if verbose println("Step 2: Applying directional heuristics...") end
        dag = apply_directional_heuristics(converter, adj_matrix, hierarchy_levels, importance_scores)
        
        # Step 3: Resolve cycles intelligently
        if verbose println("Step 3: Resolving cycles intelligently...") end
        dag, cycles_removed = resolve_cycles_intelligently(converter, dag, hierarchy_levels, importance_scores)
        
        # Step 4: Validate operational viability
        if verbose println("Step 4: Validating operational viability...") end
        validation_results = validate_dag_operational_viability(converter, dag, adj_matrix)
        
        if verbose
            println("\n=== Conversion Results ===")
            println("Cycles Removed: $cycles_removed")
            println("Edge Retention: $(round(validation_results["edge_retention_rate"] * 100, digits=2))%")
            println("Is Acyclic: $(validation_results["is_acyclic"])")
            println("Sources: $(validation_results["num_sources"])")
            println("Sinks: $(validation_results["num_sinks"])")
            if haskey(validation_results, "hospital_reachability")
                println("Hospital Reachability: $(round(validation_results["hospital_reachability"] * 100, digits=2))%")
            end
        end
        
        return dag, Dict(
            "hierarchy_levels" => hierarchy_levels,
            "importance_scores" => importance_scores,
            "metrics" => metrics,
            "cycles_removed" => cycles_removed,
            "validation" => validation_results
        )
    end

end