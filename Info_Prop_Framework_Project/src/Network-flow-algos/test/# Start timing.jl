# Start timing
    
        println("Starting Layer 2  Find Maximals  ");
    @benchmark (identify_and_group_diamonds(
        join_nodes,
        incoming_index,
        ancestors,
        descendants,
        source_nodes,
        fork_nodes,
        edgelist,
        node_priors,
        iteration_sets
    );)
     
        println("Starting Layer 2  Heirecarchy Builder  ");
     @benchmark(build_unique_diamond_storage_depth_first_parallel(
        root_diamonds,
        node_priors,
        ancestors,
        descendants,
        iteration_sets
    );)

        println("Starting Reachability Layer ");
    # Run the main reachability algorithm
     @benchmark (IPAFramework.update_beliefs_iterative(
        edgelist,
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities,
        descendants,
        ancestors,
        root_diamonds,
        join_nodes,
        fork_nodes,
        unique_diamonds
    );)    

        println("Starting Exact Path Enumeration");
  
    

exactb_mark = @benchmark ( path_enumeration_result(
            outgoing_index,
            incoming_index,
            source_nodes,
            node_priors,
            edge_probabilities
        );)


