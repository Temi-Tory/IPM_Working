# src/IPAFrameworkIterative.jl
# ITERATIVE VERSION - Uses ReachabilityModuleIterative with sequential completion tokens
# Phase 1: Correctness first, no threading
module IPAFrameworkIterative
    include("Algorithms/InputProcessingModule.jl")
    include("Algorithms/DiamondProcessingModule.jl")
    include("Algorithms/ReachabilityModuleIterative.jl")  # ITERATIVE MODULE
    include("Algorithms/ComparisonModules.jl")
    include("Algorithms/VisualizeGraphsModule.jl")
    include("Algorithms/UndirectedToDagModule.jl")
    include("Algorithms/DiamondClassificationModule.jl")
    include("Algorithms/CapacityAnalysisModule.jl")
    include("Algorithms/GeneralizedCriticalPathModule.jl")

    # Import from InputProcessingModule
    using .InputProcessingModule: Interval, pbox, PBA,
                                 # Uncertainty operations
                                 zero_value, one_value, non_fixed_value, is_valid_probability,
                                 add_values, multiply_values, min_values, max_values, sum_values,
                                 complement_value, subtract_values, prod_values, divide_values,
                                 # Core graph structure functions
                                 read_graph_to_dict,
                                 identify_fork_and_join_nodes,
                                 find_iteration_sets,
                                 # Probability reading functions
                                 read_node_priors_from_json,
                                 read_edge_probabilities_from_json,
                                 read_complete_network

    using .DiamondProcessingModule: DiamondsAtNode, Diamond, DiamondComputationData,
                                   identify_and_group_diamonds, build_unique_diamond_storage,
                                   build_unique_diamond_storage_depth_first_parallel,compute_diamond_depths,
                                   create_diamond_hash_key

    # ITERATIVE: Import from ReachabilityModuleIterative
    using .ReachabilityModuleIterative: update_beliefs_iterative,
                                        set_log_file!, disable_logging!

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
        DiamondsAtNode, Diamond, DiamondComputationData,
        Interval, pbox, PBA,  # Uncertainty types
        TimeUnit, NonNegativeTime,  # Time types

        # Uncertainty operations
        zero_value, one_value, non_fixed_value, is_valid_probability,
        add_values, multiply_values, min_values, max_values, sum_values,
        complement_value, subtract_values, prod_values, divide_values,

        # Input processing functions
        read_graph_to_dict,
        identify_fork_and_join_nodes,
        find_iteration_sets,
        read_node_priors_from_json,
        read_edge_probabilities_from_json,
        read_complete_network,

        # Network decomposition
        identify_and_group_diamonds, build_unique_diamond_storage,
        build_unique_diamond_storage_depth_first_parallel,compute_diamond_depths, create_diamond_hash_key,

        # ITERATIVE: Belief propagation (automatically parallel when threads available)
        update_beliefs_iterative,
        set_log_file!, disable_logging!,

        # Comparison and verification
        MC_result, has_path, path_enumeration_result,

        # Visualization
        generate_graph_dot_string, visualize_graph,

        # Graph conversion
        improved_undirected_to_dag, process_graph_from_csv,
        analyze_generated_dag, validate_dag,

        # Diamond classification
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
        validate_capacity_parameters, validate_capacity_results,

        # Critical path analysis
        CriticalPathParameters, CriticalPathResult,
        critical_path_analysis,
        max_combination, min_combination, sum_combination,
        additive_propagation, multiplicative_propagation,
        time_critical_path, project_duration, critical_path_nodes,
        to_hours, from_hours, format_time_results

end # module IPAFrameworkIterative
