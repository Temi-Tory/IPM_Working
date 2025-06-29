# src/IPAFramework.jl
module IPAFramework
    include("Algorithms/InputProcessingModule.jl")
    include("Algorithms/NetworkDecompositionModule.jl")
     include("Algorithms/DiamondCutsetModule.jl")
    include("Algorithms/ReachabilityModule.jl")
#=     include("Active_Work_Algos/StateReliabilityModule.jl")  # NEW: Exact MTTF/MTTR module =#
    include("Algorithms/ComparisonModules.jl")
   

    # Import from modules
    using .InputProcessingModule: ProbabilitySlices, Interval, read_graph_to_dict, 
                                 identify_fork_and_join_nodes, find_iteration_sets

    using .NetworkDecompositionModule: DiamondsAtNode, Diamond, identify_and_group_diamonds

    using .DiamondCutsetModule: find_diamond_breaking_cutset, verify_cutset_breaks_diamonds

    using .ReachabilityModule: validate_network_data, update_beliefs_iterative, updateDiamondJoin,
                              calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion

  
    export 
        # Core types
        DiamondsAtNode, Diamond,
        Interval, ProbabilitySlices,
        TimeUnit, NonNegativeTime,  # Time types

        # Input processing
        read_graph_to_dict, identify_fork_and_join_nodes, find_iteration_sets,

        # Network decomposition  
        identify_and_group_diamonds, find_highest_iteration_nodes,

        find_diamond_breaking_cutset, verify_cutset_breaks_diamonds,

        # Standard reachability analysis
        validate_network_data, update_beliefs_iterative, updateDiamondJoin,
        calculate_diamond_groups_belief, calculate_regular_belief, inclusion_exclusion

       
end