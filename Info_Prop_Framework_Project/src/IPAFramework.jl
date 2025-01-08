# src/IPAFramework.jl
module IPAFramework
    include("Working_Algorithms/InputProcessingModule.jl")
    include("Working_Algorithms/NetworkDecompositionModule.jl")
    include("Working_Algorithms/ReachabilityModule.jl")
    include("Working_Algorithms/VisualizeGraphsModule.jl")
    include("Working_Algorithms/GenerateGraphModule.jl")
    include("Working_Algorithms/UndirectedToDagModule.jl")
    include("Working_Algorithms/ReachabilityWithIntSlicesModule.jl")
  

    export AncestorGroup, GroupedDiamondStructure, DiamondSubgraph


    using .ReachabilityWithIntSlicesModule: validate_network_data_slices,       
                                          update_beliefs_iterative_slices,    
                                          updateDiamondJoin_slices,          
                                          calculate_diamond_groups_belief_slices,
                                          calculate_regular_belief_slices,    
                                          inclusion_exclusion_slices,        
                                          MC_result_slices,                  
                                          calculate_path_probability,
                                          sample_from_slices,
                                          has_path_slices,                   
                                          consolidate_slices,
                                          combine_slices_with_uncertainty
                                    
    using .InputProcessingModule:   ProbabilitySlices,
                                    read_graph_to_dict, 
                                   identify_fork_and_join_nodes,
                                   find_iteration_sets

    using .NetworkDecompositionModule:  AncestorGroup,
                                       GroupedDiamondStructure,
                                       DiamondSubgraph,
                                       identify_and_group_diamonds,
                                       find_highest_iteration_nodes

    using .ReachabilityModule: validate_network_data,
                              update_beliefs_iterative,
                              updateDiamondJoin,
                              calculate_diamond_groups_belief,
                              calculate_regular_belief,
                              inclusion_exclusion,
                              MC_result,
                              has_path

    using .VisualizeGraphsModule:  generate_graph_dot_string,
                                    visualize_graph

    using .GenerateGraphModule: InfraProperties,
                                    generate_infra_dag,
                                    analyze_ranked_dag,
                                    generate_dag_probabilities

    using .UndirectedToDagModule: improved_undirected_to_dag,
                                    process_graph_from_csv,
                                    analyze_generated_dag,
                                    validate_dag
       
    export  read_graph_to_dict,
            identify_fork_and_join_nodes, 
            find_iteration_sets,
            # Network decomposition exports
            identify_and_group_diamonds,
            find_highest_iteration_nodes,
            # Reachability exports
            validate_network_data,
            update_beliefs_iterative,
            updateDiamondJoin,
            calculate_diamond_groups_belief,
            calculate_regular_belief,
            inclusion_exclusion,
            MC_result,
            has_path,
            # VisualizeGraphsModule exports
            generate_graph_dot_string,
            visualize_graph,
            # Graph Generation exports
            InfraProperties,
            generate_infra_dag,
            analyze_ranked_dag,
            generate_dag_probabilities,
            # UndirectedToDAG exports
            improved_undirected_to_dag,
            process_graph_from_csv,
            analyze_generated_dag,
            validate_dag,
            # ReachabilityWithIntSlicesModule exports
            ProbabilitySlices,
            validate_network_data_slices,
            update_beliefs_iterative_slices,
            updateDiamondJoin_slices,
            calculate_diamond_groups_belief_slices,
            calculate_regular_belief_slices,
            inclusion_exclusion_slices,
            MC_result_slices,
            calculate_path_probability,
            sample_from_slices,
            has_path_slices,
            consolidate_slices,
            combine_slices_with_uncertainty
end