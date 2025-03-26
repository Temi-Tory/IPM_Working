module ReachabilityModule

    using Combinatorics
    using ..NetworkDecompositionModule
    using ..InputProcessingModule  

    using ..InputProcessingModule: Interval

    function validate_network_data(
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, Float64},
        link_probability::Dict{Tuple{Int64, Int64}, Float64},
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
        invalid_priors = [(node, prior) for (node, prior) in node_priors if prior < 0 || prior > 1]
        if !isempty(invalid_priors)
            throw(ErrorException("The following nodes have invalid prior probabilities (must be between 0 and 1): $invalid_priors"))
        end

        # 7. Validate all probability values are between 0 and 1
        invalid_probabilities = [(edge, rel) for (edge, rel) in link_probability if rel < 0 || rel > 1]
        if !isempty(invalid_probabilities)
            throw(ErrorException("The following edges have invalid probability values (must be between 0 and 1): $invalid_probabilities"))
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

    function update_beliefs_iterative(
        edgelist::Vector{Tuple{Int64,Int64}},  
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64,Float64},
        link_probability::Dict{Tuple{Int64,Int64},Float64},
        descendants::Dict{Int64, Set{Int64}}, 
        ancestors::Dict{Int64, Set{Int64}},
        diamond_structures::Dict{Int64, GroupedDiamondStructure},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64}
    )
        validate_network_data(iteration_sets, outgoing_index, incoming_index, source_nodes, node_priors, link_probability)
        belief_dict = Dict{Int64, Float64}()

        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    belief_dict[node] = node_priors[node]
                    continue
                end

                if haskey(diamond_structures, node)
                    structure = diamond_structures[node]
                    all_beliefs = Float64[]

                    group_beliefs = calculate_diamond_groups_belief(
                        structure,
                        belief_dict,
                        link_probability,
                        node_priors,
                        descendants,
                        ancestors,
                        incoming_index,
                        outgoing_index,
                        iteration_sets,
                        edgelist,
                        join_nodes,
                        fork_nodes
                    )
                
                    combined_diamonds = inclusion_exclusion(group_beliefs)
                    append!(all_beliefs, combined_diamonds)
                    if !isempty(structure.non_diamond_parents)
                        non_diamond_belief = calculate_regular_belief(
                            structure.non_diamond_parents,
                            node,
                            belief_dict,
                            link_probability
                        )
                        push!(all_beliefs, non_diamond_belief...)
                    end
                    
                    if node == 10                           
                        belief_dict[node] = inclusion_exclusion(all_beliefs)
                    end
                    belief_dict[node] = inclusion_exclusion(all_beliefs)
                else
                    parents = incoming_index[node]
                    probability_from_parents = calculate_regular_belief(
                        parents,
                        node,
                        belief_dict,
                        link_probability
                    )
                    belief_dict[node] = inclusion_exclusion(probability_from_parents)
                end
            end
        end

        return belief_dict
    end

    function update_beliefs_iterative(
        edgelist::Vector{Tuple{Int64,Int64}},  
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64,Interval},
        link_probability::Dict{Tuple{Int64,Int64},Interval},
        descendants::Dict{Int64,Set{Int64}}, 
        ancestors::Dict{Int64,Set{Int64}},
        diamond_structures::Dict{Int64,GroupedDiamondStructure},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64}
    )
        # First validate the network data with interval support
        validate_network_data(iteration_sets, outgoing_index, incoming_index, source_nodes, node_priors, link_probability)
        
        # Initialize belief dictionary with intervals instead of Float64
        belief_dict = Dict{Int64, Interval}()
    
        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    # For source nodes, use the prior interval directly
                    belief_dict[node] = node_priors[node]
                    continue
                end
    
                if haskey(diamond_structures, node)
                    structure = diamond_structures[node]
                    all_beliefs = Vector{Interval}()  # Changed to Vector{Interval}
    
                    # Calculate diamond group beliefs (already updated for intervals)
                    group_beliefs = calculate_diamond_groups_belief(
                        structure,
                        belief_dict,
                        link_probability,
                        node_priors,
                        descendants,
                        ancestors,
                        incoming_index,
                        outgoing_index,
                        iteration_sets,
                        edgelist,
                        join_nodes,
                        fork_nodes
                    )
                
                    # Apply inclusion-exclusion principle to diamond groups
                    combined_diamonds = inclusion_exclusion(group_beliefs)
                    push!(all_beliefs, combined_diamonds)
    
                    # Handle non-diamond parents if they exist
                    if !isempty(structure.non_diamond_parents)
                        non_diamond_belief = calculate_regular_belief(
                            structure.non_diamond_parents,
                            node,
                            belief_dict,
                            link_probability
                        )
                        append!(all_beliefs, non_diamond_belief)
                    end
                    
                    # Calculate final belief using inclusion-exclusion
                    belief_dict[node] = inclusion_exclusion(all_beliefs)
                else
                    # Handle regular nodes (non-diamond case)
                    parents = incoming_index[node]
                    probability_from_parents = calculate_regular_belief(
                        parents,
                        node,
                        belief_dict,
                        link_probability
                    )
                    belief_dict[node] = inclusion_exclusion(probability_from_parents)
                end
            end
        end
    
        return belief_dict
    end
    
    # Updated validation function to handle intervals
    function validate_network_data(
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64,Interval},
        link_probability::Dict{Tuple{Int64,Int64},Interval}
    )
        # Collect all nodes from iteration sets
        all_nodes = reduce(union, iteration_sets, init=Set{Int64}())
    
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
    
        # 4. Validate all edges have probability intervals
        edges = Set{Tuple{Int64,Int64}}()
        for (node, targets) in outgoing_index
            for target in targets
                push!(edges, (node, target))
            end
        end
        edges_without_probability = setdiff(edges, keys(link_probability))
        if !isempty(edges_without_probability)
            throw(ErrorException("The following edges are missing probability intervals: $edges_without_probability"))
        end
    
        # 5. Validate consistency between incoming and outgoing indices
        for (node, targets) in outgoing_index
            for target in targets
                if !haskey(incoming_index, target) || !(node in incoming_index[target])
                    throw(ErrorException("Inconsistency found: edge ($node, $target) exists in outgoing_index but not in incoming_index"))
                end
            end
        end
    
        # 6. Validate all interval bounds are valid
        for (_, interval) in node_priors
            if interval.lower < 0 || interval.upper > 1 || interval.lower > interval.upper
                throw(ErrorException("Invalid probability interval found in node_priors: [$interval]"))
            end
        end
    
        for (_, interval) in link_probability
            if interval.lower < 0 || interval.upper > 1 || interval.lower > interval.upper
                throw(ErrorException("Invalid probability interval found in link_probability: [$interval]"))
            end
        end
    
        # 7. Validate iteration sets contain all nodes exactly once
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

    function updateDiamondJoin(
        fork_node::Int64,
        join_node::Int64, 
        ancestor_group::AncestorGroup,
        link_probability::Dict{Tuple{Int64,Int64},Float64},
        node_priors::Dict{Int64,Float64},
        belief_dict::Dict{Int64,Float64}
    )

    if join_node == 193
        
    

        println("========== Processing Diamond ==========")
        println("Join node: $join_node, Fork node: $fork_node")
        println("Ancestor group ancestors: $(ancestor_group.ancestors)")
        println("Influenced parents: $(ancestor_group.influenced_parents)")
        println("Highest nodes: $(ancestor_group.highest_nodes)")
        
        # Get the precomputed subgraph
        subgraph = ancestor_group.subgraph
        println("Subgraph relevant nodes: $(subgraph.relevant_nodes)")
        println("Subgraph sources: $(subgraph.sources)")
        println("Subgraph edges: $(subgraph.edgelist)")

   end

        # Get the precomputed subgraph
        subgraph = ancestor_group.subgraph
        
        # Create sub_link_probability just for the subgraph edges
        sub_link_probability = Dict{Tuple{Int64, Int64}, Float64}()
        for edge in subgraph.edgelist
            sub_link_probability[edge] = link_probability[edge]
        end
    
        # Create sub_node_priors for the subgraph nodes
        sub_node_priors = Dict{Int64, Float64}()
        for node in subgraph.relevant_nodes
            if node ∉ subgraph.sources
                sub_node_priors[node] = node_priors[node]
            elseif node != fork_node
                sub_node_priors[node] = belief_dict[node]
            end
        end
    
        # Store original fork belief for final calculation
        original_fork_belief = belief_dict[fork_node]
    
        # Create the subgraph's diamond structures
        sub_fork_nodes, sub_join_nodes = InputProcessingModule.identify_fork_and_join_nodes(
            subgraph.outgoing, 
            subgraph.incoming
        )
        
        sub_diamond_structures = NetworkDecompositionModule.identify_and_group_diamonds(
            sub_join_nodes,
            subgraph.ancestors,
            subgraph.incoming,
            subgraph.sources,
            sub_fork_nodes,
            subgraph.iteration_sets,
            subgraph.edgelist,
            subgraph.descendants
        )
        if join_node == 193
        println("sub_diamond_structures",sub_diamond_structures )
        end
        # Success case (fork = 1)
        sub_node_priors[fork_node] = 1.0
        success_belief = update_beliefs_iterative(
            subgraph.edgelist,          
            subgraph.iteration_sets,
            subgraph.outgoing,
            subgraph.incoming,
            subgraph.sources,
            sub_node_priors,
            sub_link_probability,
            subgraph.descendants,
            subgraph.ancestors,
            sub_diamond_structures,
            sub_join_nodes,     
            sub_fork_nodes      
        )[join_node]
    
        # Failure case (fork = 0)
        sub_node_priors[fork_node] = 0.0
        failure_belief = update_beliefs_iterative(
            subgraph.edgelist,          
            subgraph.iteration_sets,
            subgraph.outgoing,
            subgraph.incoming,
            subgraph.sources,
            sub_node_priors,
            sub_link_probability,
            subgraph.descendants,
            subgraph.ancestors,
            sub_diamond_structures,
            sub_join_nodes,     
            sub_fork_nodes      
        )[join_node]
    
        updated_belief_dict = copy(belief_dict)
        updated_belief_dict[fork_node] = original_fork_belief
        updated_belief_dict[join_node] = (success_belief * original_fork_belief) + 
                                        (failure_belief * (1 - original_fork_belief))
        return updated_belief_dict
    end

    function calculate_diamond_groups_belief(
        diamond_structure::GroupedDiamondStructure,
        belief_dict::Dict{Int64,Float64},
        link_probability::Dict{Tuple{Int64,Int64},Float64},
        node_priors::Dict{Int64,Float64},
        descendants::Dict{Int64,Set{Int64}}, 
        ancestors::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        iteration_sets::Vector{Set{Int64}},
        edgelist::Vector{Tuple{Int64,Int64}},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64}
    )
        join_node = diamond_structure.join_node
        group_combined_beliefs = Float64[]

        if join_node == 193
            
        println("\n===== Diamond Structure for Node $join_node =====")
            println("Diamond groups: $(length(diamond_structure.diamond))")
            println("Non-diamond parents: $(diamond_structure.non_diamond_parents)")
            
            for (i, group) in enumerate(diamond_structure.diamond)
                println("Group $i:")
                println("  Ancestors: $(group.ancestors)")
                println("  Influenced parents: $(group.influenced_parents)")
                println("  Highest nodes: $(group.highest_nodes)")
            end
        end

        for group in diamond_structure.diamond
            fork_node = first(group.highest_nodes)
            updated_belief_dict = updateDiamondJoin(
                fork_node,
                join_node,
                group,
                link_probability,
                node_priors,
                belief_dict
            )
            push!(group_combined_beliefs, updated_belief_dict[join_node])
        end

        return group_combined_beliefs
    end

    function calculate_regular_belief(
        parents::Set{Int64},
        node::Int64,
        belief_dict::Dict{Int64, Float64},
        link_probability::Dict{Tuple{Int64, Int64}, Float64},
    )
        combined_probability_from_parents = Float64[]
        for parent in parents
            if !haskey(belief_dict, parent)
                throw(ErrorException("Parent node $parent of node $node has no belief value. This indicates a processing order error."))
            end
            parent_belief = belief_dict[parent]

            if !haskey(link_probability, (parent, node))
                throw(ErrorException("No probability defined for edge ($parent, $node)"))
            end
            link_rel = link_probability[(parent, node)]

            push!(combined_probability_from_parents, parent_belief * link_rel)
        end

        return combined_probability_from_parents
    end
    function inclusion_exclusion(belief_values::Vector{Float64})
        combined_belief = 0.0
        num_beliefs = length(belief_values)
        

        for i in 1:num_beliefs
            # Iterate through all possible combinations of belief values
            for combination in combinations(belief_values, i)
                # Calculate the intersection probability of the current combination
                intersection_probability = prod(combination)

                # Add or subtract the intersection probability based on the number of beliefs in the combination
                if isodd(i)
                    combined_belief += intersection_probability
                else
                    combined_belief -= intersection_probability
                end
            end
        end
        return combined_belief
    end

    
    function calculate_regular_belief(
        parents::Set{Int64},
        node::Int64,
        belief_dict::Dict{Int64, Interval},
        link_probability::Dict{Tuple{Int64, Int64}, Interval}
    )
        # If no parents, return zero probability
        if isempty(parents)
            return [Interval(0.0, 0.0)]
        end
    
        # Calculate probability for each parent path
        combined_probability_from_parents = Vector{Interval}()
        for parent in parents
            if !haskey(belief_dict, parent)
                throw(ErrorException("Parent node $parent of node $node has no belief value. This indicates a processing order error."))
            end
            parent_belief = belief_dict[parent]
    
            if !haskey(link_probability, (parent, node))
                throw(ErrorException("No probability defined for edge ($parent, $node)"))
            end
            link_rel = link_probability[(parent, node)]
    
            # Interval multiplication for this path
            lower_bound = parent_belief.lower * link_rel.lower
            upper_bound = parent_belief.upper * link_rel.upper
            push!(combined_probability_from_parents, Interval(lower_bound, upper_bound))
        end
    
        return combined_probability_from_parents
    end
    
    function inclusion_exclusion(belief_values::Vector{Interval})
        if isempty(belief_values)
            return Interval(0.0, 0.0)
        end
    
        # For a single path, return it directly
        if length(belief_values) == 1
            return belief_values[1]
        end
    
        # Initialize with probability of failure for all paths
        lower_failure = 1.0
        upper_failure = 1.0
    
        # Calculate probability of all paths failing (1 - p1)(1 - p2)...(1 - pn)
        for interval in belief_values
            lower_failure *= (1.0 - interval.upper)  # Best case for failure (using upper bounds)
            upper_failure *= (1.0 - interval.lower)  # Worst case for failure (using lower bounds)
        end
    
        # Success probability is 1 - failure probability
        # Swap bounds because we're subtracting from 1
        lower_success = 1.0 - upper_failure
        upper_success = 1.0 - lower_failure
    
        # Ensure bounds stay within [0,1]
        lower_success = max(0.0, min(1.0, lower_success))
        upper_success = max(0.0, min(1.0, upper_success))
    
        return Interval(lower_success, upper_success)
    end
    
    
    
    # Interval arithmetic operations
    function multiply_intervals(a::Interval, b::Interval)
        products = [
            a.lower * b.lower,
            a.lower * b.upper,
            a.upper * b.lower,
            a.upper * b.upper
        ]
        return Interval(minimum(products), maximum(products))
    end
    
    function add_intervals(a::Interval, b::Interval)
        return Interval(a.lower + b.lower, a.upper + b.upper)
    end
    
    function subtract_intervals(a::Interval)
        # Returns 1 - interval
        return Interval(1.0 - a.upper, 1.0 - a.lower)
    end
    
    function updateDiamondJoin(
            fork_node::Int64,
            join_node::Int64, 
            ancestor_group::AncestorGroup,
            link_probability::Dict{Tuple{Int64,Int64}, Interval},
            node_priors::Dict{Int64, Interval},
            belief_dict::Dict{Int64, Interval}
        )
            # Get the precomputed subgraph
            subgraph = ancestor_group.subgraph
            
            # Create sub_link_probability just for the subgraph edges
            sub_link_probability = Dict{Tuple{Int64, Int64}, Interval}()
            for edge in subgraph.edgelist
                sub_link_probability[edge] = link_probability[edge]
            end
        
            # Create sub_node_priors for the subgraph nodes
            sub_node_priors = Dict{Int64, Interval}()
            for node in subgraph.relevant_nodes
                if node ∉ subgraph.sources
                    sub_node_priors[node] = node_priors[node]
                elseif node != fork_node
                    sub_node_priors[node] = belief_dict[node]
                end
            end
        
            # Store original fork belief for final calculation
            original_fork_belief = belief_dict[fork_node]
        
            # Create the subgraph's diamond structures
            sub_fork_nodes, sub_join_nodes = InputProcessingModule.identify_fork_and_join_nodes(
                subgraph.outgoing, 
                subgraph.incoming
            )
            
            sub_diamond_structures = NetworkDecompositionModule.identify_and_group_diamonds(
                sub_join_nodes,
                subgraph.ancestors,
                subgraph.incoming,
                subgraph.sources,
                sub_fork_nodes,
                subgraph.iteration_sets,
                subgraph.edgelist,
                subgraph.descendants
            )
        
            # Success case (fork = 1)
            sub_node_priors[fork_node] = Interval(1.0, 1.0)
            success_belief = update_beliefs_iterative(
                subgraph.edgelist,          
                subgraph.iteration_sets,
                subgraph.outgoing,
                subgraph.incoming,
                subgraph.sources,
                sub_node_priors,
                sub_link_probability,
                subgraph.descendants,
                subgraph.ancestors,
                sub_diamond_structures,
                sub_join_nodes,     
                sub_fork_nodes      
            )[join_node]
        
            # Failure case (fork = 0)
            sub_node_priors[fork_node] = Interval(0.0, 0.0)
            failure_belief = update_beliefs_iterative(
                subgraph.edgelist,          
                subgraph.iteration_sets,
                subgraph.outgoing,
                subgraph.incoming,
                subgraph.sources,
                sub_node_priors,
                sub_link_probability,
                subgraph.descendants,
                subgraph.ancestors,
                sub_diamond_structures,
                sub_join_nodes,     
                sub_fork_nodes      
            )[join_node]
        
            updated_belief_dict = copy(belief_dict)
            updated_belief_dict[fork_node] = original_fork_belief
    
            # Calculate P(join|evidence) using interval arithmetic
            # Calculate bounds by evaluating at endpoints of fork belief interval
            p_lower = original_fork_belief.lower
            p_upper = original_fork_belief.upper

            # Evaluate at p_lower
            result_at_lower = success_belief.lower * p_lower + failure_belief.lower * (1 - p_lower)
            result_at_lower_2 = success_belief.upper * p_lower + failure_belief.upper * (1 - p_lower)

            # Evaluate at p_upper
            result_at_upper = success_belief.lower * p_upper + failure_belief.lower * (1 - p_upper)
            result_at_upper_2 = success_belief.upper * p_upper + failure_belief.upper * (1 - p_upper)

            # Take min/max for tightest bounds
            final_lower = min(result_at_lower, result_at_lower_2, result_at_upper, result_at_upper_2)
            final_upper = max(result_at_lower, result_at_lower_2, result_at_upper, result_at_upper_2)

            updated_belief_dict[join_node] = Interval(final_lower, final_upper)
    
            return updated_belief_dict
    end
    
    function calculate_diamond_groups_belief(
        diamond_structure::GroupedDiamondStructure,
        belief_dict::Dict{Int64,Interval},
        link_probability::Dict{Tuple{Int64,Int64},Interval},
        node_priors::Dict{Int64,Interval},
        descendants::Dict{Int64,Set{Int64}}, 
        ancestors::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        iteration_sets::Vector{Set{Int64}},
        edgelist::Vector{Tuple{Int64,Int64}},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64}
    )
        join_node = diamond_structure.join_node
        group_combined_beliefs = Vector{Interval}()
    
        for group in diamond_structure.diamond
            fork_node = first(group.highest_nodes)
            updated_belief_dict = updateDiamondJoin(
                fork_node,
                join_node,
                group,
                link_probability,
                node_priors,
                belief_dict
            )
            push!(group_combined_beliefs, updated_belief_dict[join_node])
        end
    
        return group_combined_beliefs
    end
 

    # Update Monte Carlo simulation to work with intervals
    function MC_result_interval(
        edgelist::Vector{Tuple{Int64,Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, Interval},
        edge_probabilities::Dict{Tuple{Int64,Int64}, Interval},
        N::Int=100000
    )
        # Run Monte Carlo for lower and upper bounds
        lower_bounds = MC_result(edgelist, outgoing_index, incoming_index, source_nodes,
                               Dict(k => v.lower for (k,v) in node_priors),
                               Dict(k => v.lower for (k,v) in edge_probabilities), N)
        
        upper_bounds = MC_result(edgelist, outgoing_index, incoming_index, source_nodes,
                               Dict(k => v.upper for (k,v) in node_priors),
                               Dict(k => v.upper for (k,v) in edge_probabilities), N)
        
        return Dict(node => Interval(lower_bounds[node], upper_bounds[node])
                   for node in keys(lower_bounds))
    end

    function MC_result(
        edgelist::Vector{Tuple{Int64,Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, Float64},
        edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
        N::Int=100000
    )
        # Get all nodes
        all_nodes = reduce(union, values(incoming_index), init=keys(incoming_index))
        active_count = Dict{Int64, Float64}()
        for node in all_nodes
            active_count[node] = 0.0
        end
    
        for _ in 1:N
            # Sample node states
            node_active = Dict(
                node => rand() < node_priors[node]
                for node in all_nodes
            )
    
            # Sample edge states
            active_edges = Dict{Tuple{Int64,Int64}, Bool}()
            for edge in edgelist
                src, dst = edge
                if node_active[src] && node_active[dst]
                    active_edges[edge] = rand() < edge_probabilities[edge]
                else
                    active_edges[edge] = false
                end
            end
    
            # Create subgraph with only active edges
            sub_outgoing = Dict{Int64, Set{Int64}}()
            for (src, dst) in edgelist
                if active_edges[(src, dst)]
                    if !haskey(sub_outgoing, src)
                        sub_outgoing[src] = Set{Int64}()
                    end
                    push!(sub_outgoing[src], dst)
                end
            end
    
            # Check reachability for each node
            for node in all_nodes
                if node in source_nodes
                    if node_active[node]
                        active_count[node] += 1
                    end
                else
                    # Check if node is reachable from any source
                    reachable = false
                    for source in source_nodes
                        if has_path(sub_outgoing, source, node)
                            reachable = true
                            break
                        end
                    end
                    if reachable
                        active_count[node] += 1
                    end
                end
            end
        end
    
        # Convert counts to probabilities
        for node in keys(active_count)
            active_count[node] /= N
        end
    
        return active_count
    end
    
    # Helper function to check if there's a path between two nodes
    function has_path(graph::Dict{Int64, Set{Int64}}, start::Int64, target::Int64)
        visited = Set{Int64}()
        queue = [start]
        
        while !isempty(queue)
            node = popfirst!(queue)
            if node == target
                return true
            end
            
            if haskey(graph, node)
                for neighbor in graph[node]
                    if neighbor ∉ visited
                        push!(visited, neighbor)
                        push!(queue, neighbor)
                    end
                end
            end
        end
        
        return false
    end
end
