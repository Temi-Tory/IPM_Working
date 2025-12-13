# src/IPAFrameworkDepthLimited.jl
# DEPTH-LIMITED PARALLELISM VERSION
module IPAFrameworkDepthLimited
    include("Algorithms/InputProcessingModule.jl")
    include("Algorithms/DiamondProcessingModule.jl")
    include("Algorithms/ReachabilityModuleDepthLimited.jl")
    include("Algorithms/ComparisonModules.jl")
    include("Algorithms/VisualizeGraphsModule.jl")
    include("Algorithms/UndirectedToDagModule.jl")
    include("Algorithms/DiamondClassificationModule.jl")
    include("Algorithms/CapacityAnalysisModule.jl")
    include("Algorithms/GeneralizedCriticalPathModule.jl")

    using .InputProcessingModule: Interval, pbox, PBA,
                                 zero_value, one_value, non_fixed_value, is_valid_probability,
                                 add_values, multiply_values, min_values, max_values, sum_values,
                                 complement_value, subtract_values, prod_values, divide_values,
                                 read_graph_to_dict,
                                 identify_fork_and_join_nodes,
                                 find_iteration_sets,
                                 read_node_priors_from_json,
                                 read_edge_probabilities_from_json,
                                 read_complete_network

    using .DiamondProcessingModule: DiamondsAtNode, Diamond,  DiamondComputationData,
                                    identify_and_group_diamonds, build_unique_diamond_storage,
                                    build_unique_diamond_storage_depth_first_parallel, create_diamond_hash_key

    using .ReachabilityModuleDepthLimited: validate_network_data, update_beliefs_iterative, updateDiamondJoin,
                              calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion

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

    using .DiamondClassificationModule: DiamondClassification, classify_diamond_exhaustive,
                                 ForkStructure, InternalStructure, PathTopology, JoinStructure,
                                 ExternalConnectivity, DegenerateCases

    using .GeneralizedCriticalPathModule: CriticalPathParameters, CriticalPathResult,
                                        critical_path_analysis,
                                        max_combination, min_combination, sum_combination,
                                        additive_propagation, multiplicative_propagation,
                                        NonNegativeTime, TimeUnit, TimeFlowParameters,
                                        time_critical_path, project_duration, critical_path_nodes,
                                        to_hours, from_hours, format_time_results

    export
        DiamondsAtNode, Diamond,  DiamondComputationData,
        Interval, pbox, PBA,
        TimeUnit, NonNegativeTime,
        zero_value, one_value, non_fixed_value, is_valid_probability,
        add_values, multiply_values, min_values, max_values, sum_values,
        complement_value, subtract_values, prod_values, divide_values,
        read_graph_to_dict,
        identify_fork_and_join_nodes,
        find_iteration_sets,
        read_node_priors_from_json,
        read_edge_probabilities_from_json,
        read_complete_network,
        identify_and_group_diamonds, build_unique_diamond_storage,
        build_unique_diamond_storage_depth_first_parallel, create_diamond_hash_key,
        validate_network_data, update_beliefs_iterative, updateDiamondJoin,
        calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion,
        MC_result, has_path, path_enumeration_result,
        generate_graph_dot_string, visualize_graph,
        improved_undirected_to_dag, process_graph_from_csv,
        analyze_generated_dag, validate_dag,
        DiamondClassification, classify_diamond_exhaustive,
        ForkStructure, InternalStructure, PathTopology, JoinStructure,
        ExternalConnectivity, DegenerateCases,
        CapacityParameters, CapacityResult,
        maximum_flow_capacity, maximum_flow_capacity_uncertain,
        bottleneck_capacity_analysis, widest_path_analysis,
        network_throughput_analysis, classical_maximum_flow,
        comparative_capacity_analysis, AnalysisConfig,
        MultiCommodityParameters, UncertaintyParameters,
        validate_capacity_parameters, validate_capacity_results,
        CriticalPathParameters, CriticalPathResult,
        critical_path_analysis,
        max_combination, min_combination, sum_combination,
        additive_propagation, multiplicative_propagation,
        TimeFlowParameters, time_critical_path, project_duration,
        critical_path_nodes, to_hours, from_hours, format_time_results

end
