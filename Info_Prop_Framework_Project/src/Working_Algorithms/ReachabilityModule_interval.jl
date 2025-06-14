module ReachabilityModule_Interval

    using Combinatorics
    using ..NetworkDecompositionModule
    using ..InputProcessingModule
    import ..InputProcessingModule: Interval

    export interval_update_beliefs_iterative, 
           interval_updateDiamondJoin, interval_calculate_diamond_groups_belief,
           interval_calculate_regular_belief, interval_inclusion_exclusion


    function multiply_intervals(a::Interval, b::Interval)
        products = [a.lower * b.lower, a.lower * b.upper, a.upper * b.lower, a.upper * b.upper]
        return Interval(minimum(products), maximum(products))
    end

    function add_intervals(a::Interval, b::Interval)
        return Interval(a.lower + b.lower, a.upper + b.upper)
    end

    function subtract_intervals(a::Interval, b::Interval)
        return Interval(a.lower - b.upper, a.upper - b.lower)
    end

    function sum_intervals(intervals::Vector{Interval})
        if isempty(intervals)
            return Interval(0.0, 0.0)
        end
        result = intervals[1]
        for i in 2:length(intervals)
            result = add_intervals(result, intervals[i])
        end
        return result
    end

    function prod_intervals(intervals::Vector{Interval})
        if isempty(intervals)
            return Interval(1.0, 1.0)
        end
        
        result = intervals[1]
        for i in 2:length(intervals)
            result = multiply_intervals(result, intervals[i])
        end
        return result
    end

    function complement_interval(a::Interval)
        # (1 - a) reverses the bounds
        return Interval(1.0 - a.upper, 1.0 - a.lower)
    end

    function interval_update_beliefs_iterative(
        edgelist::Vector{Tuple{Int64,Int64}},  
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64,Interval},
        link_probability::Dict{Tuple{Int64,Int64},Interval},
        descendants::Dict{Int64, Set{Int64}}, 
        ancestors::Dict{Int64, Set{Int64}},
        diamond_structures::Dict{Int64, DiamondsAtNode},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64}
    )
        belief_dict = Dict{Int64, Interval}()

        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    belief_dict[node] = node_priors[node]
                    continue
                end

                # Collect all sources of belief for this node
                all_beliefs = Interval[]
                
                # Process diamond structures if they exist
                if haskey(diamond_structures, node)
                    structure = diamond_structures[node]
                    
                    # Calculate beliefs from diamond groups
                    group_beliefs = interval_calculate_diamond_groups_belief(
                        structure,
                        belief_dict,
                        link_probability,
                        node_priors
                    )
                    
                    # Use inclusion-exclusion for diamond groups
                    if !isempty(group_beliefs)
                        diamond_belief = interval_inclusion_exclusion(group_beliefs)
                        push!(all_beliefs, diamond_belief)
                    end
                    
                    # Handle non-diamond parents within the structure
                    if !isempty(structure.non_diamond_parents)
                        non_diamond_beliefs = interval_calculate_regular_belief(
                            structure.non_diamond_parents,
                            node,
                            belief_dict,
                            link_probability
                        )
                        
                        # For simple tree paths, just take the sum
                        if !(node in join_nodes) || length(intersect(ancestors[node], source_nodes)) <= 1
                            push!(all_beliefs, sum_intervals(non_diamond_beliefs))
                        else
                            # For join nodes with multiple paths, use inclusion-exclusion
                            append!(all_beliefs, non_diamond_beliefs)
                        end
                    end
                else
                    # No diamond structures - handle regular parents
                    parents = incoming_index[node]
                    probability_from_parents = interval_calculate_regular_belief(
                        parents,
                        node,
                        belief_dict,
                        link_probability
                    )
                    
                    # Check if this is a join node with multiple paths from sources
                    if node in join_nodes || length(intersect(ancestors[node], source_nodes)) > 1
                        # Use inclusion-exclusion for multiple paths
                        append!(all_beliefs, probability_from_parents)
                    else
                        # For simple tree paths, just take the sum
                        push!(all_beliefs, sum_intervals(probability_from_parents))
                    end
                end
                
                # Final combination of all belief sources
                if length(all_beliefs) == 1
                    _preprior = all_beliefs[1]
                    belief_dict[node] = multiply_intervals(node_priors[node], _preprior)
                else
                    _preprior = interval_inclusion_exclusion(all_beliefs)
                    belief_dict[node] = multiply_intervals(node_priors[node], _preprior)
                end
            end
        end

        return belief_dict
    end

    function interval_calculate_regular_belief(
        parents::Set{Int64},
        node::Int64,
        belief_dict::Dict{Int64, Interval},
        link_probability::Dict{Tuple{Int64, Int64}, Interval}
    )
        combined_probability_from_parents = Interval[]
        
        for parent in parents
            if !haskey(belief_dict, parent)
                throw(ErrorException("Parent node $parent of node $node has no belief value. This indicates a processing order error."))
            end
            parent_belief = belief_dict[parent]

            if !haskey(link_probability, (parent, node))
                throw(ErrorException("No probability defined for edge ($parent, $node)"))
            end
            link_rel = link_probability[(parent, node)]

            push!(combined_probability_from_parents, multiply_intervals(parent_belief, link_rel))
        end

        return combined_probability_from_parents
    end

    function interval_inclusion_exclusion(belief_intervals::Vector{Interval})
        combined_belief = Interval(0.0, 0.0)
        num_beliefs = length(belief_intervals)
        
        for i in 1:num_beliefs
            # Iterate through all possible combinations of belief intervals
            for combination in combinations(belief_intervals, i)
                # Calculate the intersection probability of the current combination
                intersection_probability = prod_intervals(combination)
                
                # Add or subtract the intersection probability based on the number of beliefs in the combination
                if isodd(i)
                    combined_belief = add_intervals(combined_belief, intersection_probability)
                else
                    combined_belief = subtract_intervals(combined_belief, intersection_probability)
                end
            end
        end
        return combined_belief
    end

    function interval_calculate_diamond_groups_belief(
        diamond_structure::DiamondsAtNode,
        belief_dict::Dict{Int64,Interval},
        link_probability::Dict{Tuple{Int64,Int64},Interval},
        node_priors::Dict{Int64,Interval}
    )
          join_node = diamond_structure.join_node
        group_combined_beliefs = Interval[]
        for diamond  in diamond_structure.diamond
            updated_belief_dict = interval_updateDiamondJoin(
                diamond.highest_nodes, 
                join_node,
                diamond,
                link_probability,
                node_priors,
                belief_dict
            )
            push!(group_combined_beliefs, updated_belief_dict[join_node])
        end
        return group_combined_beliefs
    end

    function interval_updateDiamondJoin(
        fork_nodes::Set{Int64},
        join_node::Int64, 
        diamond::Diamond,  
        link_probability::Dict{Tuple{Int64,Int64},Interval},
        node_priors::Dict{Int64,Interval},
        belief_dict::Dict{Int64,Interval}
    )
        # Create sub_link_probability just for the diamond edges
        sub_link_probability = Dict{Tuple{Int64, Int64}, Interval}()
        for edge in diamond.edgelist  #  Use diamond.edgelist
            sub_link_probability[edge] = link_probability[edge]
        end

        # Create fresh outgoing and incoming indices for the diamond
        sub_outgoing_index = Dict{Int64, Set{Int64}}()
        sub_incoming_index = Dict{Int64, Set{Int64}}()

        for (i, j) in diamond.edgelist  #  Use diamond.edgelist
            push!(get!(sub_outgoing_index, i, Set{Int64}()), j)
            push!(get!(sub_incoming_index, j, Set{Int64}()), i)
        end

        fresh_sources = Set{Int64}()
        for node in keys(sub_outgoing_index)
            if !haskey(sub_incoming_index, node) || isempty(sub_incoming_index[node])
                push!(fresh_sources, node)
            end
        end
        
        # Calculate fresh iteration sets, ancestors, and descendants
        sub_iteration_sets, sub_ancestors, sub_descendants = InputProcessingModule.find_iteration_sets(
            diamond.edgelist,  #  Use diamond.edgelist
            sub_outgoing_index, 
            sub_incoming_index
        )

        # Identify fork and join nodes using the fresh indices
        sub_fork_nodes, sub_join_nodes = InputProcessingModule.identify_fork_and_join_nodes(
            sub_outgoing_index, 
            sub_incoming_index
        )

        # Start with all fork nodes as conditioning nodes
        conditioning_nodes = copy(fork_nodes)

        # Add sources that are also fork nodes in one step
        for source in fresh_sources
            if source in sub_fork_nodes && source ∉ fork_nodes
                push!(conditioning_nodes, source)
            end
        end
        
        # Create sub_node_priors for the diamond nodes
        sub_node_priors = Dict{Int64, Interval}()
        for node in diamond.relevant_nodes  #  Use diamond.relevant_nodes
            if node ∉ fresh_sources
                sub_node_priors[node] = node_priors[node]
                if node == join_node
                    # If the node is the join node, set its prior to 1.0
                    sub_node_priors[node] = Interval(1.0, 1.0)  #  Fix constructor               
                end
            elseif node ∉ conditioning_nodes 
                sub_node_priors[node] = belief_dict[node]
            elseif node ∈ conditioning_nodes 
                sub_node_priors[node] = Interval(1.0, 1.0)  #  Fix constructor
            end
        end

        sub_diamond_structures = NetworkDecompositionModule.identify_and_group_diamonds(
            sub_join_nodes,
            sub_ancestors,
            sub_incoming_index,
            fresh_sources,  #  Use fresh_sources instead of subgraph.sources
            sub_fork_nodes,
            sub_iteration_sets,
            diamond.edgelist,  #  Use diamond.edgelist
            sub_descendants,
            sub_node_priors
        )


        # Generate all possible states of conditioning nodes (0 or 1)
        conditioning_nodes_list = collect(conditioning_nodes)
        final_belief = Interval(0.0)
        
        # Use binary representation for efficiency
        for state_idx in 0:(2^length(conditioning_nodes_list) - 1)
            # Calculate state probability
            state_probability = Interval(1.0)
            conditioning_state = Dict{Int64, Float64}()
            
            for (i, node) in enumerate(conditioning_nodes_list)
                # Store original belief for this node
                original_belief = belief_dict[node]
                
                # Check if the i-th bit is set
                if (state_idx & (1 << (i-1))) != 0
                    conditioning_state[node] = 1.0
                    state_probability = multiply_intervals(state_probability, original_belief)
                else
                    conditioning_state[node] = 0.0
                    state_probability = multiply_intervals(state_probability, complement_interval(original_belief))
                end
            end
            
            # Make a copy of sub_node_priors for this iteration
            current_priors = copy(sub_node_priors)
            
            # Set conditioning nodes to their current state
            for (node, value) in conditioning_state
                current_priors[node] = Interval(value)
            end
            
            # Run belief propagation with these nodes fixed
            state_beliefs = interval_update_beliefs_iterative(
                diamond.edgelist,
                sub_iteration_sets,
                sub_outgoing_index,
                sub_incoming_index,
                fresh_sources,
                current_priors,
                sub_link_probability,
                sub_descendants,
                sub_ancestors,
                sub_diamond_structures,
                sub_join_nodes,
                sub_fork_nodes
            )
            
            # Weight the result by the probability of this state
            join_belief = state_beliefs[join_node]
            final_belief = add_intervals(final_belief, multiply_intervals(join_belief, state_probability))
        end
        
        # Update belief dictionary with combined result
        updated_belief_dict = copy(belief_dict)
        updated_belief_dict[join_node] = final_belief
        
        return updated_belief_dict
    end

end