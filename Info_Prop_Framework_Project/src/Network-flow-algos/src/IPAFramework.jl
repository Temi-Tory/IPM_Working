# src/IPAFramework.jl
module IPAFramework
    include("Algorithms/InputProcessingModule.jl")
    include("Algorithms/DiamondProcessingModule.jl")
    include("Algorithms/ReachabilityModuleRecurse.jl")
    include("Algorithms/ComparisonModules.jl")
    include("Algorithms/VisualizeGraphsModule.jl")
    include("Algorithms/UndirectedToDagModule.jl")
    include("Algorithms/DiamondClassificationModule.jl")
    #include("Active_Work_Algos/TemporalReachabilityModule.jl")
    include("Algorithms/CapacityAnalysisModule.jl")
    include("Algorithms/GeneralizedCriticalPathModule.jl")

    # UPDATED: Import from enhanced InputProcessingModule
    using .InputProcessingModule: Interval, pbox, PBA,
                                 # Uncertainty operations
                                 zero_value, one_value, non_fixed_value, is_valid_probability,
                                 add_values, multiply_values, min_values, max_values, sum_values,
                                 complement_value, subtract_values, prod_values, divide_values,
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

    using .ComparisonModules: MC_result, has_path, path_enumeration_result

    using .VisualizeGraphsModule: generate_graph_dot_string, visualize_graph

    using .UndirectedToDagModule: improved_undirected_to_dag, process_graph_from_csv,
                                 analyze_generated_dag, validate_dag

  
    using .CapacityAnalysisModule: CapacityParameters, CapacityResult,
           maximum_flow_capacity, maximum_flow_capacity_uncertain,
           bottleneck_capacity_analysis, widest_path_analysis, 
           network_throughput_analysis, classical_maximum_flow, 
           comparative_capacity_analysis, AnalysisConfig, 
           MultiCommodityParameters, UncertaintyParameters,
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
        Interval, pbox, PBA,  # Uncertainty types
        TimeUnit, NonNegativeTime,  # Time types
        
        # Uncertainty operations
        zero_value, one_value, non_fixed_value, is_valid_probability,
        add_values, multiply_values, min_values, max_values, sum_values,
        complement_value, subtract_values, prod_values, divide_values,

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

        # StateReliabilityModule exports (commented out - module missing)
        # StateReliabilityConfig, StateReliabilityResults,
        # update_state_reliability_iterative, validate_reliability_network_data,
        # markov_transition_probabilities, calculate_timestep_recommendation,
        # WORKING, FAILED, UNDER_REPAIR, calculate_load_factor,

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

        # Undirected to DAG conversion
        improved_undirected_to_dag, process_graph_from_csv, analyze_generated_dag, validate_dag,
        
      
        # Exhaustive Diamond Classification
        DiamondClassification, classify_diamond_exhaustive,
        ForkStructure, InternalStructure, PathTopology, JoinStructure,
        ExternalConnectivity, DegenerateCases,

        # Capacity analysis
        CapacityParameters, CapacityResult,
        maximum_flow_capacity, maximum_flow_capacity_uncertain,
        bottleneck_capacity_analysis, widest_path_analysis, 
        network_throughput_analysis, classical_maximum_flow, 
        comparative_capacity_analysis, AnalysisConfig, 
        MultiCommodityParameters, UncertaintyParameters,
        validate_capacity_parameters, validate_capacity_results

end