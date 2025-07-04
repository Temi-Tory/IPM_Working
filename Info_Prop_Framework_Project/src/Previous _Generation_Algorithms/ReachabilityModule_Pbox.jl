#P-box is computationally expensive due to the discretization and convolution operations
#so can get very slow for large networks.

module ReachabilityModule_Pbox

    using Combinatorics
    # Import with explicit aliases to avoid name conflicts
    import ProbabilityBoundsAnalysis
    import IntervalArithmetic
    using ..DiamondProcessingModule
    using ..InputProcessingModule

    # Create aliases to avoid ambiguity
    const PBA = ProbabilityBoundsAnalysis

    # Type aliases for convenience
    const PBAInterval = ProbabilityBoundsAnalysis.Interval
    const pbox = ProbabilityBoundsAnalysis.pbox



    function pbox_validate_network_data(
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, pbox},
        link_probability::Dict{Tuple{Int64, Int64}, pbox},
    )
        # Collect all nodes from iteration sets
        all_nodes = reduce(union, iteration_sets, init = Set{Int64}())

        # 1. Validate all nodes have priors
        nodes_without_priors = setdiff(all_nodes, keys(node_priors))
        if !isempty(nodes_without_priors)
            throw(ErrorException("The following nodes are missing priors: $nodes_without_priors"))
        end

        # 2. Validate all non-source nodes have incoming edges
        non_source_nodes = setdiff(all_nodes, source_nodes)
        for node in non_source_nodes
            if !haskey(incoming_index, node) || isempty(incoming_index[node])
                throw(ErrorException("Non-source node $node has no incoming edges"))
            end
        end

        # 3. Validate source nodes have no incoming edges
        for source in source_nodes
            if haskey(incoming_index, source) && !isempty(incoming_index[source])
                throw(ErrorException("Source node $source has incoming edges: $(incoming_index[source])"))
            end
        end

        # 4. Validate all edges have probability values
        edges = Set{Tuple{Int64, Int64}}()
        for (node, targets) in outgoing_index
            for target in targets
                push!(edges, (node, target))
            end
        end
        edges_without_probability = setdiff(edges, keys(link_probability))
        if !isempty(edges_without_probability)
            throw(ErrorException("The following edges are missing probability values: $edges_without_probability"))
        end

        # 5. Validate consistency between incoming and outgoing indices
        for (node, targets) in outgoing_index
            for target in targets
                if !haskey(incoming_index, target) || !(node in incoming_index[target])
                    throw(ErrorException("Inconsistency found: edge ($node, $target) exists in outgoing_index but not in incoming_index"))
                end
            end
        end
        for (node, sources) in incoming_index
            for source in sources
                if !haskey(outgoing_index, source) || !(node in outgoing_index[source])
                    throw(ErrorException("Inconsistency found: edge ($source, $node) exists in incoming_index but not in outgoing_index"))
                end
            end
        end

        # 6. Validate all prior probabilities are between 0 and 1
        invalid_priors = []
        for (node, prior) in node_priors
            min_value = minimum(prior)
            max_value = maximum(prior)
            
            # Check if the possible values are outside [0,1]
            # Convert intervals to floats for comparison
            if isa(min_value, Interval)
                min_bound = min_value.lo
            else
                min_bound = min_value
            end
            
            if isa(max_value, Interval)
                max_bound = max_value.hi
            else
                max_bound = max_value
            end
            
            if min_bound < 0 || max_bound > 1
                push!(invalid_priors, (node, prior))
            end
        end
        
        if !isempty(invalid_priors)
            throw(ErrorException("The following nodes have invalid prior p-boxes (must be between 0 and 1): $invalid_priors"))
        end

        # 7. Validate all probability values are between 0 and 1
        invalid_probabilities = []
        for (edge, rel) in link_probability
            min_value = minimum(rel)
            max_value = maximum(rel)
            
            # Check if the possible values are outside [0,1]
            if isa(min_value, Interval)
                min_bound = min_value.lo
            else
                min_bound = min_value
            end
            
            if isa(max_value, Interval)
                max_bound = max_value.hi
            else
                max_bound = max_value
            end
            
            if min_bound < 0 || max_bound > 1
                push!(invalid_probabilities, (edge, rel))
            end
        end
        if !isempty(invalid_probabilities)
            throw(ErrorException("The following edges have invalid probability p-boxes (must be between 0 and 1): $invalid_probabilities"))
        end

        # 8. Validate iteration sets contain all nodes exactly once
        nodes_seen = Set{Int64}()
        for set in iteration_sets
            intersection = intersect(nodes_seen, set)
            if !isempty(intersection)
                throw(ErrorException("Nodes $intersection appear in multiple iteration sets"))
            end
            union!(nodes_seen, set)
        end
        if nodes_seen != all_nodes
            missing_nodes = setdiff(all_nodes, nodes_seen)
            extra_nodes = setdiff(nodes_seen, all_nodes)
            error_msg = ""
            if !isempty(missing_nodes)
                error_msg *= "Nodes missing from iteration sets: $missing_nodes. "
            end
            if !isempty(extra_nodes)
                error_msg *= "Extra nodes in iteration sets: $extra_nodes."
            end
            throw(ErrorException(error_msg))
        end
    end

    function pbox_update_beliefs_iterative(
        edgelist::Vector{Tuple{Int64,Int64}},  
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64,pbox},
        link_probability::Dict{Tuple{Int64,Int64},pbox},
        descendants::Dict{Int64, Set{Int64}}, 
        ancestors::Dict{Int64, Set{Int64}},
        diamond_structures::Dict{Int64, DiamondsAtNode},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64}
    )
        #TODO: NEED TO FIX VALIDATION FUNTION TO WORK BETTER WITH P-BOXES
        #pbox_validate_network_data_minimal(iteration_sets, outgoing_index, incoming_index, source_nodes, node_priors, link_probability)
        belief_dict = Dict{Int64, pbox}()

        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    belief_dict[node] = node_priors[node]
                    continue
                end

                # Collect all sources of belief for this node
                all_beliefs = pbox[]
                
                # Process diamond structures if they exist
                if haskey(diamond_structures, node)
                    structure = diamond_structures[node]
                    
                    # Calculate beliefs from diamond groups
                    group_beliefs = pbox_calculate_diamond_groups_belief(
                        structure,
                        belief_dict,
                        link_probability,
                        node_priors
                    )
                    
                    # Use inclusion-exclusion for diamond groups
                    if !isempty(group_beliefs)
                        diamond_belief = pbox_inclusion_exclusion(group_beliefs)
                        push!(all_beliefs, diamond_belief)
                    end
                    
                    # Handle non-diamond parents within the structure
                    if !isempty(structure.non_diamond_parents)
                        non_diamond_beliefs = pbox_calculate_regular_belief(
                            structure.non_diamond_parents,
                            node,
                            belief_dict,
                            link_probability
                        )
                        
                        # For simple tree paths, just take the sum
                        if !(node in join_nodes) || length(intersect(ancestors[node], source_nodes)) <= 1
                            push!(all_beliefs, pbox_combine_pboxes(non_diamond_beliefs, :+))
                        else
                            # For join nodes with multiple paths, use inclusion-exclusion
                            append!(all_beliefs, non_diamond_beliefs)
                        end
                    end
                else
                    # No diamond structures - handle regular parents
                    parents = incoming_index[node]
                    probability_from_parents = pbox_calculate_regular_belief(
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
                        push!(all_beliefs, pbox_combine_pboxes(probability_from_parents, :+))
                    end
                end
                
                # Final combination of all belief sources
                if length(all_beliefs) == 1
                    _preprior = all_beliefs[1]
                    belief_dict[node] = PBA.convIndep(node_priors[node], _preprior, op = *)
                else
                    _preprior = pbox_inclusion_exclusion(all_beliefs)
                    belief_dict[node] = PBA.convIndep(node_priors[node], _preprior, op = *)
                end
            end
        end

        return belief_dict
    end

    function pbox_calculate_regular_belief(
        parents::Set{Int64},
        node::Int64,
        belief_dict::Dict{Int64, pbox},
        link_probability::Dict{Tuple{Int64, Int64}, pbox},
    )
        combined_probability_from_parents = pbox[]
        for parent in parents
            if !haskey(belief_dict, parent)
                throw(ErrorException("Parent node $parent of node $node has no belief value. This indicates a processing order error."))
            end
            parent_belief = belief_dict[parent]

            if !haskey(link_probability, (parent, node))
                throw(ErrorException("No probability defined for edge ($parent, $node)"))
            end
            link_rel = link_probability[(parent, node)]

            # p-box multiplication using independence assumption
            push!(combined_probability_from_parents, PBA.convIndep(parent_belief, link_rel, op = *))
        end

        return combined_probability_from_parents
    end

    function pbox_inclusion_exclusion(belief_values::Vector{pbox})
        if isempty(belief_values)
            return PBA.makepbox(PBA.interval(0, 0))
        elseif length(belief_values) == 1
            return belief_values[1]
        end
        
        # Start with zero p-box
        combined_belief = PBA.makepbox(PBA.interval(0, 0))
        num_beliefs = length(belief_values)
        
        for i in 1:num_beliefs
            # Iterate through all possible combinations of belief values
            for combination in combinations(belief_values, i)
                # Calculate the intersection probability of the current combination
                # For independent events, intersection is product
                intersection_probability = pbox_combine_pboxes(collect(combination), :*)
                
                # Add or subtract based on inclusion-exclusion principle
                if isodd(i)
                    # Add terms with odd number of elements
                    combined_belief = PBA.convIndep(combined_belief, intersection_probability, op = +)
                else
                    # Subtract terms with even number of elements
                    combined_belief = PBA.convIndep(combined_belief, intersection_probability, op = -)
                end
            end
        end
        
        return combined_belief
    end

    function pbox_updateDiamondJoin(
        fork_nodes::Set{Int64},
        join_node::Int64, 
        diamond::Diamond,  #  Change from ancestor_group::AncestorGroup
        link_probability::Dict{Tuple{Int64,Int64},pbox},
        node_priors::Dict{Int64,pbox},
        belief_dict::Dict{Int64,pbox}
        )
        # Create sub_link_probability just for the diamond edges
        sub_link_probability = Dict{Tuple{Int64, Int64}, pbox}()
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
        sub_node_priors = Dict{Int64, pbox}()
        for node in diamond.relevant_nodes  #  Use diamond.relevant_nodes
            if node ∉ fresh_sources  #  Use fresh_sources
                sub_node_priors[node] = node_priors[node]
                if node == join_node
                    # If the node is the join node, set its prior to 1.0
                    sub_node_priors[node] = PBA.makepbox(PBA.interval(1.0, 1.0))                
                end
            elseif node ∉ conditioning_nodes 
                sub_node_priors[node] = belief_dict[node]
            elseif node ∈ conditioning_nodes 
                sub_node_priors[node] = PBA.makepbox(PBA.interval(1.0, 1.0))
            end
        end

        
       
        sub_diamond_structures = DiamondProcessingModule.identify_and_group_diamonds(
            sub_join_nodes,
            sub_incoming_index,
            sub_ancestors,
            sub_descendants,
            fresh_sources,
            sub_fork_nodes,
            diamond.edgelist,
            sub_node_priors
        )


        # NEW: Use multi-conditioning approach with p-box arithmetic
        conditioning_nodes_list = collect(conditioning_nodes)
        
        # Generate all possible states of conditioning nodes (0 or 1)
        final_belief = PBA.makepbox(PBA.interval(0.0, 0.0))
        
        # Use binary representation for efficiency
        for state_idx in 0:(2^length(conditioning_nodes_list) - 1)
            # Calculate state probability using p-box arithmetic
            state_probability = PBA.makepbox(PBA.interval(1.0, 1.0))
            conditioning_state = Dict{Int64, pbox}()
            
            for (i, node) in enumerate(conditioning_nodes_list)
                # Store original belief for this node
                original_belief = belief_dict[node]
                
                # Check if the i-th bit is set
                if (state_idx & (1 << (i-1))) != 0
                    conditioning_state[node] = PBA.makepbox(PBA.interval(1.0, 1.0))
                    state_probability = PBA.convIndep(state_probability, original_belief, op = *)
                else
                    conditioning_state[node] = PBA.makepbox(PBA.interval(0.0, 0.0))
                    # Calculate (1 - original_belief)
                    one_pbox = PBA.makepbox(PBA.interval(1.0, 1.0))
                    complement_belief = PBA.convIndep(one_pbox, original_belief, op = -)
                    state_probability = PBA.convIndep(state_probability, complement_belief, op = *)
                end
            end
            
            # Make a copy of sub_node_priors for this iteration
            current_priors = copy(sub_node_priors)
            
            # Set conditioning nodes to their current state
            for (node, value) in conditioning_state
                current_priors[node] = value
            end
            
            # Run belief propagation with these nodes fixed
            state_beliefs = pbox_update_beliefs_iterative(
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
            weighted_contribution = PBA.convIndep(join_belief, state_probability, op = *)
            final_belief = PBA.convIndep(final_belief, weighted_contribution, op = +)
        end
        
        # Update belief dictionary with combined result
        updated_belief_dict = copy(belief_dict)
        updated_belief_dict[join_node] = final_belief
        
        return updated_belief_dict
    end

    function pbox_calculate_diamond_groups_belief(
        diamond_structure::DiamondsAtNode,
        belief_dict::Dict{Int64,pbox},
        link_probability::Dict{Tuple{Int64,Int64},pbox},
        node_priors::Dict{Int64,pbox}
    )
         join_node = diamond_structure.join_node
        group_combined_beliefs = pbox[]
        for diamond  in diamond_structure.diamond
            updated_belief_dict = pbox_updateDiamondJoin(
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
    
    function pbox_combine_pboxes(pboxes::Vector{pbox}, operation::Symbol)
        if isempty(pboxes)
            if operation == :+
                return PBA.makepbox(PBA.interval(0, 0)) # Empty sum is 0
            elseif operation == :*
                return PBA.makepbox(PBA.interval(1, 1)) # Empty product is 1
            end
        end
        
        result = pboxes[1]
        for i in 2:length(pboxes)
            # Convert symbol to actual function
            op_func = if operation == :+
                +
            elseif operation == :*
                *
            elseif operation == :-
                -
            elseif operation == :/
                /
            else
                throw(ArgumentError("Unsupported operation: $operation"))
            end
            
            # Always use independence assumption
            result = PBA.convIndep(result, pboxes[i], op = op_func)
        end
        
        return result
    end
    # Helper function to convert from original Float64 data to p-box data 
    function convert_to_pbox_data(
        node_priors::Dict{Int64, Float64},
        link_probability::Dict{Tuple{Int64, Int64}, Float64};
        uncertainty_type::Symbol = :none,  # Options: :none, :interval, :normal
        uncertainty_value::Float64 = 0.0
    )
        # Convert node priors
        pbox_node_priors = Dict{Int64, pbox}()
        for (node, value) in node_priors
            if uncertainty_type == :interval && uncertainty_value > 0.0
                # Create interval p-box with fixed width uncertainty
                min_val = max(0.0, value - uncertainty_value)
                max_val = min(1.0, value + uncertainty_value)
                pbox_node_priors[node] = PBA.makepbox(PBA.interval(min_val, max_val))
            elseif uncertainty_type == :normal && uncertainty_value > 0.0
                # Create normal distribution with mean value and std of uncertainty_value
                # Truncate at 0 and 1 since these are probabilities
                pbox_node_priors[node] = PBA.normal(value, uncertainty_value)
                # Truncate to valid probability range if needed
                if PBA.minimum(pbox_node_priors[node]) < 0 || PBA.maximum(pbox_node_priors[node]) > 1
                    left_bound = max(0.0, PBA.minimum(pbox_node_priors[node]))
                    right_bound = min(1.0, PBA.maximum(pbox_node_priors[node]))
                    pbox_node_priors[node] = PBA.makepbox(PBA.interval(left_bound, right_bound))
                end
            else
                # Create precise p-box (default)
                pbox_node_priors[node] = PBA.makepbox(PBA.interval(value, value))
            end
        end
        
        # Convert link probabilities
        pbox_link_probability = Dict{Tuple{Int64, Int64}, pbox}()
        for (edge, value) in link_probability
            if uncertainty_type == :interval && uncertainty_value > 0.0
                # Create interval with uncertainty
                min_val = max(0.0, value - uncertainty_value)
                max_val = min(1.0, value + uncertainty_value)
                pbox_link_probability[edge] = PBA.makepbox(PBA.interval(min_val, max_val))
            elseif uncertainty_type == :normal && uncertainty_value > 0.0
                # Create normal distribution with mean value and std of uncertainty_value
                pbox_link_probability[edge] = PBA.normal(value, uncertainty_value)
                # Truncate to valid probability range if needed
                if PBA.minimum(pbox_link_probability[edge]) < 0 || PBA.maximum(pbox_link_probability[edge]) > 1
                    left_bound = max(0.0, PBA.minimum(pbox_link_probability[edge]))
                    right_bound = min(1.0, PBA.maximum(pbox_link_probability[edge]))
                    pbox_link_probability[edge] = PBA.makepbox(PBA.interval(left_bound, right_bound))
                end
            else
                # Create precise p-box
                pbox_link_probability[edge] = PBA.makepbox(PBA.interval(value, value))
            end
        end
        
        return pbox_node_priors, pbox_link_probability
    end

end # module