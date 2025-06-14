# src/IPAFramework.jl
module IPAFramework
    include("Working_Algorithms/InputProcessingModule.jl")
    include("Working_Algorithms/NetworkDecompositionModule.jl")
    include("Working_Algorithms/ReachabilityModule.jl")
    include("Working_Algorithms/ComparisonModules.jl")
    include("Working_Algorithms/VisualizeGraphsModule.jl")
    include("Working_Algorithms/GenerateGraphModule.jl")
    include("Working_Algorithms/UndirectedToDagModule.jl")
    include("Working_Algorithms/ReachabilityModule_Pbox.jl")
    include("Working_Algorithms/ReachabilityModule_Interval.jl")
    include("Working_Algorithms/TimeAnalysisModule.jl")
    include("Working_Algorithms/DiamondClassificationModule.jl")

    # Import from modules
    using .InputProcessingModule: ProbabilitySlices, Interval, read_graph_to_dict, 
                                 identify_fork_and_join_nodes, find_iteration_sets

    using .NetworkDecompositionModule: DiamondsAtNode, Diamond, identify_and_group_diamonds

    using .ReachabilityModule: validate_network_data, update_beliefs_iterative, updateDiamondJoin,
                              calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion

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

    using .TimeAnalysisModule: TimeUnit, NonNegativeTime, TimeFlowParameters,
                              time_update_beliefs_iterative, get_project_duration,
                              get_critical_path_nodes, format_results,
                              to_hours, from_hours, validate_time_parameters
                              
    # Updated DiamondClassification imports
    using .DiamondClassificationModule: DiamondClassification, classify_diamond_exhaustive,
                                 ForkStructure, InternalStructure, PathTopology, JoinStructure, 
                                 ExternalConnectivity, DegenerateCases
    
    # EXPORTS - Organized by module
    export 
        # Core types
        DiamondsAtNode, Diamond,
        Interval, ProbabilitySlices,
        TimeUnit, NonNegativeTime,  #  Time types

        # Input processing
        read_graph_to_dict, identify_fork_and_join_nodes, find_iteration_sets,

        # Network decomposition  
        identify_and_group_diamonds, find_highest_iteration_nodes,

        # Standard reachability analysis
        validate_network_data, update_beliefs_iterative, updateDiamondJoin,
        calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion,

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

        #  TIME ANALYSIS EXPORTS - Complete set
        TimeFlowParameters, time_update_beliefs_iterative,
        get_project_duration, get_critical_path_nodes, format_results,
        to_hours, from_hours, validate_time_parameters,

        # Visualization
        generate_graph_dot_string, visualize_graph,

        # Graph generation
        InfraProperties, generate_infra_dag, analyze_ranked_dag, generate_dag_probabilities,

        # Undirected to DAG conversion
        improved_undirected_to_dag, process_graph_from_csv, analyze_generated_dag, validate_dag,
        
        # Exhaustive Diamond Classification
        DiamondClassification, classify_diamond_exhaustive,
        ForkStructure, InternalStructure, PathTopology, JoinStructure, 
        ExternalConnectivity, DegenerateCases
end