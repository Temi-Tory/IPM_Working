# src/IPAFramework.jl
module IPAFramework
    include("Algorithms/InputProcessingModule.jl")
    include("Algorithms/NetworkDecompositionModule.jl")
    include("Algorithms/ReachabilityModule.jl")
#=     include("Active_Work_Algos/StateReliabilityModule.jl")  # NEW: Exact MTTF/MTTR module =#
    include("Algorithms/ComparisonModules.jl")
    include("Algorithms/VisualizeGraphsModule.jl")
    include("Algorithms/GenerateGraphModule.jl")
    include("Algorithms/UndirectedToDagModule.jl")
    include("Algorithms/DroneNetworkDagModule.jl")
    include("Algorithms/DroneInputProcessingModule.jl")
    include("Algorithms/ReachabilityModule_Pbox.jl")
    include("Algorithms/ReachabilityModule_Interval.jl")
    include("Algorithms/DiamondClassificationModule.jl")
    include("Active_Work_Algos/TemporalReachabilityModule.jl")
    include("Algorithms/CapacityAnalysisModule.jl")
    include("Algorithms/GeneralizedCriticalPathModule.jl")

    # Import from modules
    using .InputProcessingModule: ProbabilitySlices, Interval, read_graph_to_dict, 
                                 identify_fork_and_join_nodes, find_iteration_sets

    using .NetworkDecompositionModule: DiamondsAtNode, Diamond, identify_and_group_diamonds

    using .ReachabilityModule: validate_network_data, update_beliefs_iterative, updateDiamondJoin,
                              calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion

    # NEW: Import exact state reliability functions
    using .StateReliabilityModule: StateReliabilityConfig, StateReliabilityResults,
                                  update_state_reliability_iterative, validate_reliability_network_data,
                                  markov_transition_probabilities, calculate_timestep_recommendation,
                                  WORKING, FAILED, UNDER_REPAIR, calculate_load_factor

    using .ComparisonModules: MC_result, has_path, path_enumeration_result

    using .ReachabilityModule_Pbox: pbox_validate_network_data, pbox_update_beliefs_iterative,
                                   pbox_updateDiamondJoin, pbox_calculate_diamond_groups_belief,
                                   pbox_calculate_regular_belief, pbox_inclusion_exclusion, convert_to_pbox_data

    using .ReachabilityModule_Interval: interval_update_beliefs_iterative, interval_updateDiamondJoin,
                                       interval_calculate_diamond_groups_belief, interval_calculate_regular_belief,
                                       interval_inclusion_exclusion

    using .VisualizeGraphsModule: generate_graph_dot_string, visualize_graph

    using .GenerateGraphModule: InfraProperties, generate_infra_dag, analyze_ranked_dag, generate_dag_probabilities

    using .UndirectedToDagModule: improved_undirected_to_dag, process_graph_from_csv,
                                 analyze_generated_dag, validate_dag

    using .DroneNetworkDagModule: NodeType, OperationalMode, DroneNetworkDAGConverter,
                                 convert_drone_network_to_dag, establish_node_hierarchy,
                                 apply_directional_heuristics, resolve_cycles_intelligently,
                                 validate_dag_operational_viability,
                                 HOSPITAL, AIRPORT, REGIONAL_HUB, LOCAL_HUB, GENERIC,
                                 SUPPLY_DISTRIBUTION, EMERGENCY_RESPONSE, RESILIENCE_ANALYSIS

    using .DroneInputProcessingModule: DroneNetworkData, save_drone_dag_results, load_drone_dag_results,
                                      convert_to_ipa_format, validate_drone_data_integrity,
                                      create_drone_metadata, extract_dag_matrices, save_real_drone_results

    using .CapacityAnalysisModule: CapacityParameters, CapacityResult,
           maximum_flow_capacity, bottleneck_capacity_analysis,
           widest_path_analysis, network_throughput_analysis,
           classical_maximum_flow, comparative_capacity_analysis,
           AnalysisConfig, MultiCommodityParameters, UncertaintyParameters,
           validate_capacity_parameters, validate_capacity_results
                              
    # Updated DiamondClassification imports
    using .DiamondClassificationModule: DiamondClassification, classify_diamond_exhaustive,
                                 ForkStructure, InternalStructure, PathTopology, JoinStructure, 
                                 ExternalConnectivity, DegenerateCases

 
    using .GeneralizedCriticalPathModule: CriticalPathParameters, CriticalPathResult,
                                        critical_path_analysis,
                                        # Standard combination functions
                                        max_combination, min_combination, sum_combination,
                                        # Standard propagation functions
                                        additive_propagation, multiplicative_propagation,
                                        # Time analysis exports
                                        NonNegativeTime, TimeUnit, TimeFlowParameters,
                                        time_critical_path, project_duration, critical_path_nodes,
                                        to_hours, from_hours, format_time_results
     
    # EXPORTS - Organized by module
    export 
        # Core types
        DiamondsAtNode, Diamond,
        Interval, ProbabilitySlices,
        TimeUnit, NonNegativeTime,  # Time types

        # Input processing
        read_graph_to_dict, identify_fork_and_join_nodes, find_iteration_sets,

        # Network decomposition  
        identify_and_group_diamonds, find_highest_iteration_nodes,

        # Standard reachability analysis
        validate_network_data, update_beliefs_iterative, updateDiamondJoin,
        calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion,

        # NEW: Exact state reliability analysis
        StateReliabilityConfig, StateReliabilityResults,
        update_state_reliability_iterative, validate_reliability_network_data,
        markov_transition_probabilities, calculate_timestep_recommendation,
        WORKING, FAILED, UNDER_REPAIR, calculate_load_factor,

        # Comparison methods
        MC_result, has_path, path_enumeration_result,

        # P-box reachability analysis
        pbox_validate_network_data, pbox_update_beliefs_iterative, pbox_updateDiamondJoin,
        pbox_calculate_diamond_groups_belief, pbox_calculate_regular_belief, 
        pbox_inclusion_exclusion, convert_to_pbox_data,

        # Interval reachability analysis  
        interval_update_beliefs_iterative, interval_updateDiamondJoin,
        interval_calculate_diamond_groups_belief, interval_calculate_regular_belief,
        interval_inclusion_exclusion,

        # TIME ANALYSIS EXPORTS - Complete set
        TimeFlowParameters, time_update_beliefs_iterative,
        get_project_duration, get_critical_path_nodes, format_results,
        to_hours, from_hours, validate_time_parameters,

        CriticalPathParameters, CriticalPathResult,
        critical_path_analysis,
        # Standard combination functions
        max_combination, min_combination, sum_combination,
        # Standard propagation functions
        additive_propagation, multiplicative_propagation,
        # Time analysis exports
        NonNegativeTime, TimeUnit, TimeFlowParameters,
        time_critical_path, project_duration, critical_path_nodes,
        to_hours, from_hours, format_time_results,

        # Visualization
        generate_graph_dot_string, visualize_graph,

        # Graph generation
        InfraProperties, generate_infra_dag, analyze_ranked_dag, generate_dag_probabilities,

        # Undirected to DAG conversion
        improved_undirected_to_dag, process_graph_from_csv, analyze_generated_dag, validate_dag,
        
        # Drone Network DAG conversion
        NodeType, OperationalMode, DroneNetworkDAGConverter,
        convert_drone_network_to_dag, establish_node_hierarchy,
        apply_directional_heuristics, resolve_cycles_intelligently,
        validate_dag_operational_viability,
        HOSPITAL, AIRPORT, REGIONAL_HUB, LOCAL_HUB, GENERIC,
        SUPPLY_DISTRIBUTION, EMERGENCY_RESPONSE, RESILIENCE_ANALYSIS,
        
        # Drone Input Processing
        DroneNetworkData, save_drone_dag_results, load_drone_dag_results,
        convert_to_ipa_format, validate_drone_data_integrity,
        create_drone_metadata, extract_dag_matrices, save_real_drone_results,
        
        # Exhaustive Diamond Classification
        DiamondClassification, classify_diamond_exhaustive,
        ForkStructure, InternalStructure, PathTopology, JoinStructure,
        ExternalConnectivity, DegenerateCases,

        CapacityParameters, CapacityResult,
           maximum_flow_capacity, bottleneck_capacity_analysis,
           widest_path_analysis, network_throughput_analysis,
           classical_maximum_flow, comparative_capacity_analysis,
           AnalysisConfig, MultiCommodityParameters, UncertaintyParameters,
           validate_capacity_parameters, validate_capacity_results

  #=   """
    # IPAFramework - Comprehensive Network Reliability Analysis

    ## Available Analysis Methods

    ### 1. Static Binary Reachability (Original)
    ```julia
    results = update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, link_probability,
        descendants, ancestors, diamond_structures, join_nodes, fork_nodes
    )
    ```

    ### 2. Exact Multi-State Reliability (MTTF/MTTR)**
    ```julia
    config = StateReliabilityConfig(
        enable_parallel_processing=true,
        validate_transition_probabilities=true,
        strict_probability_conservation=true
    )

    results = update_state_reliability_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        initial_states,           # Dict{Int64, Int64} - 1=Working, 2=Failed, 3=Repair
        node_failure_rates,       # Dict{Int64, Float64} - λ = 1/MTTF
        node_repair_rates,        # Dict{Int64, Float64} - μ = 1/MTTR  
        cascade_multipliers,      # Dict{Tuple{Int64,Int64}, Float64}
        redundancy_groups,        # Dict{Int64, Set{Int64}}
        descendants, ancestors, diamond_structures, join_nodes, fork_nodes,
        time_horizon, dt, config
    )
    ```

    ### 3. Interval and P-box Analysis
    ```julia
    # Interval arithmetic
    interval_results = interval_update_beliefs_iterative(...)
    
    # Probability boxes
    pbox_results = pbox_update_beliefs_iterative(...)
    ```

    ### 4. Temporal Event-Based Analysis
    ```julia
    temporal_results = temporal_reachability_analysis(...)
    ```

    ## Key Algorithmic Innovations

    ### Exact Diamond Conditioning
    - **Binary states**: 2^n conditioning states
    - **Multi-state**: 3^n conditioning states  
    - **Parallel ready**: Independent state computations

    ### Inclusion-Exclusion Principle
    - Handles overlapping failure modes exactly
    - No approximations or clamping
    - Maintains mathematical rigor

    ### Iteration Set Parallelization
    - Nodes in same iteration set → independent computation
    - Perfect for `@threads for` parallelization
    - 85-95% parallel efficiency

   

    ## Usage Examples

    ### Basic Multi-State Reliability
    ```julia
    using IPAFramework

    # Define network (using existing preprocessing)
    edgelist, iteration_sets, outgoing_index, incoming_index, 
    descendants, ancestors, diamond_structures, join_nodes, fork_nodes = 
        preprocess_network(your_network_data)

    # Define reliability parameters
    initial_states = Dict(1 => WORKING, 2 => WORKING, 3 => FAILED)
    failure_rates = Dict(1 => 0.001, 2 => 0.002, 3 => 0.0015)  # 1/MTTF
    repair_rates = Dict(1 => 0.1, 2 => 0.05, 3 => 0.08)        # 1/MTTR
    cascade_multipliers = Dict((1,2) => 2.0, (2,3) => 1.5)
    redundancy_groups = Dict(1 => Set([1,2]), 2 => Set([1,2]))

    # Run exact analysis
    results = update_state_reliability_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        initial_states, failure_rates, repair_rates, 
        cascade_multipliers, redundancy_groups,
        descendants, ancestors, diamond_structures, join_nodes, fork_nodes,
        100.0, 0.1  # 100 hours, 0.1 hour timesteps
    )

    # Access results
    working_probs = results.state_probabilities[node_id][:, WORKING]
    failed_probs = results.state_probabilities[node_id][:, FAILED]
    repair_probs = results.state_probabilities[node_id][:, UNDER_REPAIR]
    ```

    ### Performance Optimization
    ```julia
    # High-performance configuration
    config = StateReliabilityConfig(
        enable_parallel_processing=true,
        validate_transition_probabilities=false,  # Disable for speed
        max_conditioning_nodes=6,  # Limit diamond complexity
        memory_limit_gb=32.0
    )

    # Recommended timestep for stability
    recommended_dt, max_dt, warnings = calculate_timestep_recommendation(
        failure_rates, repair_rates
    )
    println("Use dt ≤ $recommended_dt for optimal stability")
    ```

    """ =#

end