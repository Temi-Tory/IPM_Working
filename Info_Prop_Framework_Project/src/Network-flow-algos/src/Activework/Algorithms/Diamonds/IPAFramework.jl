# src/IPAFramework.jl
module IPAFramework
    include("InputProcessingModule.jl")
    include("NetworkDecompositionModule.jl")
   

    # Import from modules
    using .InputProcessingModule: ProbabilitySlices, Interval, read_graph_to_dict, 
                                 identify_fork_and_join_nodes, find_iteration_sets

    using .NetworkDecompositionModule: DiamondsAtNode, Diamond, identify_and_group_diamonds

   
    export 
        # Core types
        DiamondsAtNode, Diamond,
        Interval, ProbabilitySlices,
        TimeUnit, NonNegativeTime,  # Time types

        # Input processing
        read_graph_to_dict, identify_fork_and_join_nodes, find_iteration_sets,

        # Network decomposition  
        identify_and_group_diamonds, find_highest_iteration_nodes

      

       
end