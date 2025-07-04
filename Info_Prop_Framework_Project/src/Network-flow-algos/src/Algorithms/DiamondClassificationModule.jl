module DiamondClassificationModule
    using ..DiamondProcessingModule: Diamond, DiamondsAtNode
    
    export DiamondClassification, classify_diamond_exhaustive,
           ForkStructure, InternalStructure, PathTopology, JoinStructure, ExternalConnectivity, DegenerateCases

    """
    # Exhaustive Diamond Categories

    ## By Fork Structure:
    1. **SINGLE_FORK**: `len(diamond.highest_nodes) == 1`
    2. **MULTI_FORK**: `len(diamond.highest_nodes) > 1` 
    3. **CHAINED_FORK**: Some internal nodes are both fork AND join (sequential diamonds)
    4. **SELF_INFLUENCE_FORK**: Fork node is also direct parent of join node

    ## By Internal Structure:
    1. **SIMPLE**: No internal forks/joins within diamond
    2. **NESTED**: Internal fork/join nodes create sub-diamonds
    3. **SEQUENTIAL**: Chain of fork→join→fork→join
    4. **INTERCONNECTED**: Complex internal cross-connections between paths

    ## By Path Topology:
    1. **PARALLEL_PATHS**: Independent paths from fork to join
    2. **CONVERGING_PATHS**: Paths merge at intermediate nodes before join
    3. **BRANCHING_PATHS**: Single path splits into multiple after fork
    4. **CROSS_CONNECTED**: Paths connect to each other (not just fork→join)

    ## By Join Structure:
    1. **SINGLE_JOIN**: All paths converge to one join node
    2. **HIERARCHICAL_JOIN**: Multiple levels of convergence
    3. **PARTIAL_JOIN**: Not all paths reach the main join

    ## By External Connectivity:
    1. **ISOLATED**: Diamond nodes only connect within diamond
    2. **BRIDGE**: Diamond connects different graph components  
    3. **EMBEDDED**: Diamond nodes have many external connections

    ## Degenerate Cases:
    1. **TRIVIAL**: Too small (≤3 nodes) or only 1 path
    2. **MALFORMED**: Violates diamond definition
    3. **REDUNDANT**: Subsumed by larger diamond
    """
    
    @enum ForkStructure begin
        SINGLE_FORK
        MULTI_FORK  
        CHAINED_FORK
        SELF_INFLUENCE_FORK
    end
    
    @enum InternalStructure begin
        SIMPLE
        NESTED
        SEQUENTIAL  
        INTERCONNECTED
    end
    
    @enum PathTopology begin
        PARALLEL_PATHS
        CONVERGING_PATHS
        BRANCHING_PATHS
        CROSS_CONNECTED
    end
    
    @enum JoinStructure begin
        SINGLE_JOIN
        HIERARCHICAL_JOIN
        PARTIAL_JOIN
    end
    
    @enum ExternalConnectivity begin
        ISOLATED
        BRIDGE
        EMBEDDED
    end
    
    @enum DegenerateCases begin
        TRIVIAL
        MALFORMED
        REDUNDANT
        VALID
    end
    
    struct DiamondClassification
        # Multi-dimensional classification
        fork_structure::ForkStructure
        internal_structure::InternalStructure
        path_topology::PathTopology
        join_structure::JoinStructure
        external_connectivity::ExternalConnectivity
        degeneracy::DegenerateCases
        
        # Metrics
        fork_count::Int64
        subgraph_size::Int64
        internal_forks::Int64
        internal_joins::Int64
        path_count::Int64
        complexity_score::Float64
        
        # Optimization insights
        optimization_potential::String
        bottleneck_risk::String
    end
    
    """
        classify_diamond_exhaustive(diamond, join_node, graph_context...)
        
    Performs exhaustive diamond classification using exact set operations on graph structure.
    """
    function classify_diamond_exhaustive(
        diamond::Diamond,
        join_node::Int64,
        # Full graph context
        edgelist::Vector{Tuple{Int64,Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        fork_nodes::Set{Int64},
        join_nodes::Set{Int64},
        iteration_sets::Vector{Set{Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}}
    )::DiamondClassification
        
        # === EXACT SET OPERATIONS ===
        
        # Basic metrics
        fork_count = length(diamond.highest_nodes)
        subgraph_size = length(diamond.relevant_nodes)
        
        # Internal nodes (excluding main forks and join)
        internal_nodes = setdiff(diamond.relevant_nodes, diamond.highest_nodes, Set([join_node]))
        
        # FORK STRUCTURE ANALYSIS
        fork_structure = analyze_fork_structure(diamond, join_node, fork_nodes, join_nodes, incoming_index)
        
        # INTERNAL STRUCTURE ANALYSIS  
        internal_forks = intersect(internal_nodes, fork_nodes)
        internal_joins = intersect(internal_nodes, join_nodes)
        internal_structure = analyze_internal_structure(internal_forks, internal_joins, fork_nodes, join_nodes, diamond)
        
        # ENHANCED PATH TOPOLOGY ANALYSIS
        path_topology = analyze_path_topology_detailed(diamond, join_node, outgoing_index, incoming_index, ancestors, descendants)
        
        # JOIN STRUCTURE ANALYSIS
        join_structure = analyze_join_structure(diamond, join_node, internal_joins)
        
        # EXTERNAL CONNECTIVITY ANALYSIS
        external_connectivity = analyze_external_connectivity(diamond, edgelist, outgoing_index, incoming_index)
        
        # DEGENERACY CHECK
        degeneracy = check_degeneracy(diamond, fork_count, subgraph_size)
        
        # COMPLEXITY SCORING
        complexity_score = calculate_complexity_exact(diamond, internal_forks, internal_joins, fork_count)
        
        # OPTIMIZATION INSIGHTS
        optimization_potential, bottleneck_risk = derive_optimization_insights(
            fork_structure, internal_structure, path_topology, degeneracy
        )
        
        return DiamondClassification(
            fork_structure, internal_structure, path_topology, join_structure, external_connectivity, degeneracy,
            fork_count, subgraph_size, length(internal_forks), length(internal_joins), 
            estimate_path_count_exact(diamond, outgoing_index), complexity_score,
            optimization_potential, bottleneck_risk
        )
    end
    
    # === DETECTION FUNCTIONS USING SET OPERATIONS ===
    
    function analyze_fork_structure(diamond::Diamond, join_node::Int64, fork_nodes::Set{Int64},  join_nodes::Set{Int64}, incoming_index::Dict{Int64,Set{Int64}})::ForkStructure
        fork_count = length(diamond.highest_nodes)
        
        # Check for self-influence: any fork directly connects to join
        is_self_influence = !isempty(intersect(diamond.highest_nodes, get(incoming_index, join_node, Set{Int64}())))
        
        # Check for chained: any internal node is both fork AND join
        internal_nodes = setdiff(diamond.relevant_nodes, diamond.highest_nodes, Set([join_node]))
        fork_join_nodes = intersect(internal_nodes, fork_nodes) ∩ join_nodes
        is_chained = !isempty(fork_join_nodes)
        
        if is_self_influence
            return SELF_INFLUENCE_FORK
        elseif is_chained
            return CHAINED_FORK
        elseif fork_count == 1
            return SINGLE_FORK
        else
            return MULTI_FORK
        end
    end
    
    function analyze_internal_structure(internal_forks::Set{Int64}, internal_joins::Set{Int64}, 
                                       all_fork_nodes::Set{Int64}, all_join_nodes::Set{Int64}, diamond::Diamond)::InternalStructure
        has_internal_forks = !isempty(internal_forks)
        has_internal_joins = !isempty(internal_joins)
        
        # Sequential: nodes that are both fork AND join
        sequential_nodes = intersect(diamond.relevant_nodes, all_fork_nodes, all_join_nodes)
        is_sequential = !isempty(sequential_nodes)
        
        if is_sequential
            return SEQUENTIAL
        elseif has_internal_forks && has_internal_joins
            return NESTED
        elseif has_internal_forks || has_internal_joins
            return INTERCONNECTED
        else
            return SIMPLE
        end
    end
    
    # === ENHANCED PATH TOPOLOGY ANALYSIS ===
    
    function analyze_path_topology_detailed(
        diamond::Diamond, 
        join_node::Int64,
        outgoing_index::Dict{Int64,Set{Int64}}, 
        incoming_index::Dict{Int64,Set{Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}}
    )::PathTopology
        
        # === EXACT PATH ANALYSIS ===
        
        # 1. CONVERGING_PATHS Detection
        converging_nodes = find_convergence_points(diamond, join_node, incoming_index, ancestors)
        has_convergence = !isempty(converging_nodes)
        
        # 2. BRANCHING_PATHS Detection  
        branching_nodes = find_branching_points(diamond, outgoing_index)
        has_branching = !isempty(branching_nodes)
        
        # 3. CROSS_CONNECTED Detection
        cross_connections = find_cross_connections(diamond, outgoing_index, incoming_index, ancestors, descendants)
        has_cross_connections = !isempty(cross_connections)
        
        # === CLASSIFICATION LOGIC ===
        if has_cross_connections
            return CROSS_CONNECTED
        elseif has_convergence
            return CONVERGING_PATHS
        elseif has_branching
            return BRANCHING_PATHS
        else
            return PARALLEL_PATHS  # Simple parallel paths
        end
    end

    function find_convergence_points(
        diamond::Diamond, 
        join_node::Int64,
        incoming_index::Dict{Int64,Set{Int64}},
        ancestors::Dict{Int64, Set{Int64}}
    )::Set{Int64}
        convergence_points = Set{Int64}()
        
        # Internal nodes (excluding main forks and join)
        internal_nodes = setdiff(diamond.relevant_nodes, diamond.highest_nodes, Set([join_node]))
        
        for node in internal_nodes
            # Get incoming edges within diamond
            internal_parents = intersect(get(incoming_index, node, Set{Int64}()), diamond.relevant_nodes)
            
            # Convergence: node has multiple parents that trace to different forks
            if length(internal_parents) > 1
                # Check if parents trace back to different forks
                parent_fork_ancestry = Set{Int64}()
                for parent in internal_parents
                    # Find which fork(s) this parent descends from
                    parent_forks = intersect(get(ancestors, parent, Set{Int64}()), diamond.highest_nodes)
                    union!(parent_fork_ancestry, parent_forks)
                end
                
                # Convergence if multiple forks feed into this node
                if length(parent_fork_ancestry) > 1
                    push!(convergence_points, node)
                end
            end
        end
        
        return convergence_points
    end

    function find_branching_points(
        diamond::Diamond,
        outgoing_index::Dict{Int64,Set{Int64}}
    )::Set{Int64}
        branching_points = Set{Int64}()
        
        # Look for internal nodes (not main forks) with multiple outgoing edges
        internal_nodes = setdiff(diamond.relevant_nodes, diamond.highest_nodes)
        
        for node in internal_nodes
            # Get outgoing edges within diamond
            internal_targets = intersect(get(outgoing_index, node, Set{Int64}()), diamond.relevant_nodes)
            
            # Branching: internal node has multiple children within diamond
            if length(internal_targets) > 1
                push!(branching_points, node)
            end
        end
        
        return branching_points
    end

    function find_cross_connections(
        diamond::Diamond,
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}}
    )::Set{Tuple{Int64,Int64}}
        cross_connections = Set{Tuple{Int64,Int64}}()
        
        # Analyze each edge within the diamond
        for edge in diamond.edgelist
            src, dst = edge
            
            # Skip edges from main forks (these are expected)
            src in diamond.highest_nodes && continue
            
            # Check if this edge connects different "paths"
            if is_cross_path_connection(src, dst, diamond, ancestors, descendants)
                push!(cross_connections, edge)
            end
        end
        
        return cross_connections
    end

    function is_cross_path_connection(
        src::Int64, 
        dst::Int64, 
        diamond::Diamond,
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}}
    )::Bool
        # Find which forks each node traces back to
        src_forks = intersect(get(ancestors, src, Set{Int64}()), diamond.highest_nodes)
        dst_forks = intersect(get(ancestors, dst, Set{Int64}()), diamond.highest_nodes)
        
        # Cross-connection: nodes trace to different forks AND this isn't a convergence
        if !isempty(src_forks) && !isempty(dst_forks)
            # Cross-connection if they trace to different fork sets
            return src_forks != dst_forks
        end
        
        return false
    end
    
    function analyze_join_structure(diamond::Diamond, main_join::Int64, internal_joins::Set{Int64})::JoinStructure
        if isempty(internal_joins)
            return SINGLE_JOIN
        else
            return HIERARCHICAL_JOIN  # Has internal convergence points
        end
    end
    
    function analyze_external_connectivity(diamond::Diamond, edgelist::Vector{Tuple{Int64,Int64}}, 
                                         outgoing_index::Dict{Int64,Set{Int64}}, incoming_index::Dict{Int64,Set{Int64}})::ExternalConnectivity
        # Count edges crossing diamond boundary
        diamond_edges = Set(diamond.edgelist)
        
        external_edge_count = 0
        for node in diamond.relevant_nodes
            # Outgoing edges to external nodes
            external_targets = setdiff(get(outgoing_index, node, Set{Int64}()), diamond.relevant_nodes)
            external_edge_count += length(external_targets)
            
            # Incoming edges from external nodes  
            external_sources = setdiff(get(incoming_index, node, Set{Int64}()), diamond.relevant_nodes)
            external_edge_count += length(external_sources)
        end
        
        if external_edge_count == 0
            return ISOLATED
        elseif external_edge_count > length(diamond.relevant_nodes)
            return EMBEDDED
        else
            return BRIDGE
        end
    end
    
    function check_degeneracy(diamond::Diamond, fork_count::Int64, subgraph_size::Int64)::DegenerateCases
        if subgraph_size <= 3 || fork_count == 0
            return TRIVIAL
        else
            return VALID
        end
    end
    
    function calculate_complexity_exact(diamond::Diamond, internal_forks::Set{Int64}, internal_joins::Set{Int64}, fork_count::Int64)::Float64
        base_complexity = length(diamond.relevant_nodes) * fork_count
        internal_complexity = length(internal_forks) + length(internal_joins)
        edge_complexity = length(diamond.edgelist) / length(diamond.relevant_nodes)
        
        return base_complexity + internal_complexity * 2.0 + edge_complexity
    end
    
    function estimate_path_count_exact(diamond::Diamond, outgoing_index::Dict{Int64,Set{Int64}})::Int64
        # Simple path counting from each fork
        total_paths = 0
        for fork in diamond.highest_nodes
            fork_paths = length(intersect(get(outgoing_index, fork, Set{Int64}()), diamond.relevant_nodes))
            total_paths += max(fork_paths, 1)
        end
        return max(total_paths, 2)  # Minimum 2 for diamond
    end
    
    function derive_optimization_insights(fork_structure::ForkStructure, internal_structure::InternalStructure, 
                                        path_topology::PathTopology, degeneracy::DegenerateCases)::Tuple{String, String}
        if degeneracy == TRIVIAL
            return ("Questionable_Pattern", "Low")
        elseif fork_structure == SINGLE_FORK && internal_structure == SIMPLE
            return ("High_Parallelization", "Low")
        elseif fork_structure == MULTI_FORK
            return ("Complex_Coordination", "Medium")
        elseif internal_structure == NESTED
            return ("Hierarchical_Optimization", "High")
        elseif path_topology == CROSS_CONNECTED
            return ("Complex_Network_Effects", "Very_High")
        elseif path_topology == CONVERGING_PATHS
            return ("Merge_Point_Optimization", "Medium")
        elseif path_topology == BRANCHING_PATHS
            return ("Load_Distribution_Optimization", "Medium")
        else
            return ("Complex_Analysis_Required", "Very_High")
        end
    end
end



#= Data Patterns and Optimization Insights from  Networks in data
Pacific Gas & Electric (Power Grid)

PARALLEL_PATHS + CROSS_CONNECTED mix
Pattern: Redundant power routing with backup interconnections
Optimization: Grid stability through alternative routing

Berlin Metro (Transportation)

Heavy BRANCHING_PATHS dominance
Pattern: Major stations as traffic distribution hubs
Optimization: Passenger flow distribution and schedule coordination

Munin Bayesian Network (Probabilistic)

Massive CROSS_CONNECTED presence
Pattern: Complex conditional dependencies between probability paths
Optimization: Conditional dependency structure optimization =#