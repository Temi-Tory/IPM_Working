# src/IPAFrameworkOptimized.jl
# OPTIMIZED VERSION - Uses ReachabilityModuleRecurseOptimized instead of ReachabilityModuleRecurse
module IPAFrameworkOptimized
    include("Algorithms/InputProcessingModule.jl")
    include("Algorithms/DiamondProcessingModule.jl")
    include("Algorithms/ReachabilityModuleRecurseOptimized.jl")  # OPTIMIZED MODULE
    include("Algorithms/ComparisonModules.jl")
    include("Algorithms/VisualizeGraphsModule.jl")
    include("Algorithms/UndirectedToDagModule.jl")
    include("Algorithms/DiamondClassificationModule.jl")
    include("Algorithms/Capacity/CapacityAnalysisModule.jl")
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

    using .DiamondProcessingModule: DiamondsAtNode, Diamond,  DiamondComputationData, identify_and_group_diamonds, build_unique_diamond_storage, build_unique_diamond_storage_depth_first_parallel, create_diamond_hash_key

    # OPTIMIZED: Import from ReachabilityModuleOptimized instead
    using .ReachabilityModuleOptimized: validate_network_data, update_beliefs_iterative, updateDiamondJoin,
                              calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion,
                              convert_to_pbox_data

   
    using .ComparisonModules: MC_result, has_path, path_enumeration_result

    using .VisualizeGraphsModule: generate_graph_dot_string, visualize_graph

    using .UndirectedToDagModule: improved_undirected_to_dag, process_graph_from_csv,
                                 analyze_generated_dag, validate_dag


    # UPDATED: Import from refactored CapacityAnalysisModule (Phase 1: Deterministic Core)
    using .CapacityAnalysisModule: 
           # Core types
           NetworkTopology, BasicCapacityProblem, CapacityAnalysisOptions,
           CapacityAnalysisResult, BottleneckReport, ValidationReport,
           EdgeUpgradeRecommendation, NodeUpgradeRecommendation, UpgradeAnalysis,
           FlowPath, PathAnalysis, ComparativeAnalysis,
           # Main API functions
           analyze_capacity, analyze_capacity_validated, quick_capacity_check,
           # Validation
           validate_capacity_result

    # Updated DiamondClassification imports
    using .DiamondClassificationModule: DiamondClassification, classify_diamond_exhaustive,
                                 ForkStructure, InternalStructure, PathTopology, JoinStructure,
                                 ExternalConnectivity, DegenerateCases

    using .GeneralizedCriticalPathModule: CriticalPathParameters, CriticalPathResult,
                                        ExtendedCriticalPathResult,
                                        critical_path_analysis, backward_pass_analysis,
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
        identify_and_group_diamonds, build_unique_diamond_storage, build_unique_diamond_storage_depth_first_parallel, create_diamond_hash_key,

        # OPTIMIZED: Standard reachability analysis (using optimized implementation)
        validate_network_data, update_beliefs_iterative, updateDiamondJoin,
        calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion,
        convert_to_pbox_data,


        # Comparison and verification
        MC_result, has_path, path_enumeration_result,

        # Visualization
        generate_graph_dot_string, visualize_graph,

        # Undirected to DAG conversion
        improved_undirected_to_dag, process_graph_from_csv,
        analyze_generated_dag, validate_dag,

        # Diamond Classification
        DiamondClassification, classify_diamond_exhaustive,
        ForkStructure, InternalStructure, PathTopology, JoinStructure,
        ExternalConnectivity, DegenerateCases,

        # Capacity Analysis - Phase 1: Deterministic Core (Refactored)
        NetworkTopology, BasicCapacityProblem, CapacityAnalysisOptions,
        CapacityAnalysisResult, BottleneckReport, ValidationReport,
        EdgeUpgradeRecommendation, NodeUpgradeRecommendation, UpgradeAnalysis,
        FlowPath, PathAnalysis, ComparativeAnalysis,
        analyze_capacity, analyze_capacity_validated, quick_capacity_check,
        validate_capacity_result,

        # Critical Path Analysis
        CriticalPathParameters, CriticalPathResult, ExtendedCriticalPathResult,
        critical_path_analysis, backward_pass_analysis,
        max_combination, min_combination, sum_combination,
        additive_propagation, multiplicative_propagation,
        TimeFlowParameters, time_critical_path, project_duration,
        critical_path_nodes, to_hours, from_hours, format_time_results

end
