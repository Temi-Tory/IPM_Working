# src/IPAFramework.jl
module IPAFramework
    include("Algorithms/InputProcessingModule.jl")
    include("Algorithms/DiamondProcessingModule.jl")
    include("Algorithms/ReachabilityModuleRecurse.jl")
    include("Algorithms/SDPBeliefPropagationModule.jl")  # NEW: SDP-based diamond processing
    #=     include("Active_Work_Algos/StateReliabilityModule.jl")  # NEW: Exact MTTF/MTTR module =#
    include("Algorithms/ComparisonModules.jl")
    include("Algorithms/VisualizeGraphsModule.jl")
    include("Algorithms/GenerateGraphModule.jl")
    include("Algorithms/UndirectedToDagModule.jl")
    include("Algorithms/DroneNetworkDagModule.jl")
    include("Algorithms/DroneInputProcessingModule.jl")
    include("Algorithms/DiamondClassificationModule.jl")
    #include("Active_Work_Algos/TemporalReachabilityModule.jl")
    include("Algorithms/CapacityAnalysisModule.jl")
    include("Algorithms/GeneralizedCriticalPathModule.jl")

    # UPDATED: Import from enhanced InputProcessingModule
    using .InputProcessingModule: Interval, 
                                 # Core graph structure functions
                                 read_graph_to_dict,
                                 identify_fork_and_join_nodes, 
                                 find_iteration_sets,
                                 # NEW: Separate probability reading functions
                                 read_node_priors_from_json,
                                 read_edge_probabilities_from_json,
                                 read_complete_network

    using .DiamondProcessingModule: DiamondsAtNode, Diamond,  DiamondComputationData, identify_and_group_diamonds, build_unique_diamond_storage, build_unique_diamond_storage_depth_first_parallel,create_diamond_hash_key

    using .ReachabilityModule: validate_network_data, update_beliefs_iterative, updateDiamondJoin,
                              calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion,
                              convert_to_pbox_data

    # NEW: Import SDP-based diamond processing functions
    using .SDPBeliefPropagationModule: updateDiamondJoinSDP, updateDiamondJoinSDPReplacement,
                                      DiamondSDP, BeliefPath, BeliefTerm,
                                      build_diamond_sdp, compute_diamond_belief_sdp
#= 
    # NEW: Import exact state reliability functions
    using .StateReliabilityModule: StateReliabilityConfig, StateReliabilityResults,
                                  update_state_reliability_iterative, validate_reliability_network_data,
                                  markov_transition_probabilities, calculate_timestep_recommendation,
                                  WORKING, FAILED, UNDER_REPAIR, calculate_load_factor
 =#
    using .ComparisonModules: MC_result, has_path, path_enumeration_result

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
        DiamondsAtNode, Diamond,  DiamondComputationData,
        Interval,  # Removed ProbabilitySlices as it's not exported from new InputProcessingModule
        TimeUnit, NonNegativeTime,  # Time types

        # UPDATED: Enhanced input processing functions
        read_graph_to_dict,                    # NEW: Returns only graph structure
        identify_fork_and_join_nodes, 
        find_iteration_sets,
        read_node_priors_from_json,           # NEW: Read node priors separately
        read_edge_probabilities_from_json,    # NEW: Read edge probabilities separately  
        read_complete_network,                # NEW: Convenience function for complete network

        # Network decomposition  
        identify_and_group_diamonds,build_unique_diamond_storage, build_unique_diamond_storage_depth_first_parallel,create_diamond_hash_key,

        # Standard reachability analysis
        validate_network_data, update_beliefs_iterative, updateDiamondJoin,
        calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion,
        convert_to_pbox_data,

        # NEW: Exact state reliability analysis
        StateReliabilityConfig, StateReliabilityResults,
        update_state_reliability_iterative, validate_reliability_network_data,
        markov_transition_probabilities, calculate_timestep_recommendation,
        WORKING, FAILED, UNDER_REPAIR, calculate_load_factor,

        # Comparison methods
        MC_result, has_path, path_enumeration_result,

        # Critical path analysis
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

        # Capacity analysis
        CapacityParameters, CapacityResult,
        maximum_flow_capacity, bottleneck_capacity_analysis,
        widest_path_analysis, network_throughput_analysis,
        classical_maximum_flow, comparative_capacity_analysis,
        AnalysisConfig, MultiCommodityParameters, UncertaintyParameters,
        validate_capacity_parameters, validate_capacity_results

    """
    # IPAFramework - Enhanced Network Reliability Analysis

    ## NEW: Separated Input Processing Workflow

    ### 1. Read Graph Structure Only (No Probabilities)
    ```julia
    # Read raw adjacency matrix (0/1 integers only)
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict("adjacency.csv")
    ```

    ### 2. Read Probabilities Separately  
    ```julia
    # Read node priors from JSON (supports Float64, Interval, all pbox types)
    node_priors = read_node_priors_from_json("nodepriors.json")
    
    # Read edge probabilities from JSON (supports Float64, Interval, all pbox types)
    edge_probabilities = read_edge_probabilities_from_json("linkprobs.json")
    ```

    ### 3. Or Read Everything at Once
    ```julia
    # Convenience function with validation
    edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = 
        read_complete_network("adjacency.csv", "nodepriors.json", "linkprobs.json")
    ```

    ## Supported Probability Types in JSON

    ### Float64
    ```json
    {"nodes": {"1": 0.9, "2": 0.8}}
    ```

    ### Interval  
    ```json
    {"nodes": {"1": {"type": "interval", "lower": 0.8, "upper": 0.9}}}
    ```

    ### pbox - All Construction Types
    ```json
    {
      "nodes": {
        "1": {"type": "pbox", "construction_type": "scalar", "value": 0.9},
        "2": {"type": "pbox", "construction_type": "parametric", "shape": "normal", "params": [0, 1]},
        "3": {"type": "pbox", "construction_type": "distribution_free", "method": "meanVar", "params": [0.1, 0.9, 0, 0.25]}
      }
    }
    ```

    ## Available Analysis Methods

    ### 1. Static Binary Reachability
    ```julia
    results = update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, edge_probabilities,
        descendants, ancestors, diamond_structures, join_nodes, fork_nodes
    )
    ```

    ### 2. Multi-State Reliability (MTTF/MTTR)
    ```julia
    config = StateReliabilityConfig(
        enable_parallel_processing=true,
        validate_transition_probabilities=true
    )

    results = update_state_reliability_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        initial_states, failure_rates, repair_rates, 
        cascade_multipliers, redundancy_groups,
        descendants, ancestors, diamond_structures, join_nodes, fork_nodes,
        time_horizon, dt, config
    )
    ```

    """

end