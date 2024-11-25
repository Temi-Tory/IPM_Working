# src/IPAFramework.jl
module IPAFramework
    include("Working_Algorithms/InputProcessingModule.jl")
    include("Working_Algorithms/NetworkDecompositionModule.jl")
    include("Working_Algorithms/ReachabilityModule.jl")

    export AncestorGroup, GroupedDiamondStructure, DiamondSubgraph

    using .InputProcessingModule:   read_graph_to_dict, 
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

    # Export everything with proper commas
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
            has_path
    
end