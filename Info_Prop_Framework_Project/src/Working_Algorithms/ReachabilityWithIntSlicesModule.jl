module ReachabilityWithIntSlicesModule
   
    export  validate_network_data_slices,
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

    using Combinatorics
    using ..NetworkDecompositionModule
    using ..InputProcessingModule  


    function validate_network_data_slices(
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, ProbabilitySlices},
        link_probability::Dict{Tuple{Int64, Int64}, ProbabilitySlices},
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

        #6. For priors:
        invalid_priors = []
        for (node, prior) in node_priors
            if !all(0 .<= prior.values .<= 1)
                push!(invalid_priors, (node, prior))
            end
        end

        #7. For link probabilities:
        invalid_probabilities = []
        for (edge, prob) in link_probability
            if !all(0 .<= prob.values .<= 1)
                push!(invalid_probabilities, (edge, prob))
            end
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

    function update_beliefs_iterative_slices(
        edgelist::Vector{Tuple{Int64,Int64}},  
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, ProbabilitySlices},
        link_probability::Dict{Tuple{Int64, Int64}, ProbabilitySlices},
        descendants::Dict{Int64, Set{Int64}}, 
        ancestors::Dict{Int64, Set{Int64}},
        diamond_structures::Dict{Int64, GroupedDiamondStructure},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64}
    )
        validate_network_data(iteration_sets, outgoing_index, incoming_index, source_nodes, node_priors, link_probability)
        belief_dict = Dict{Int64, ProbabilitySlices}()

        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    belief_dict[node] = node_priors[node]
                    continue
                end

                if haskey(diamond_structures, node)
                    structure = diamond_structures[node]
                    all_beliefs = Vector{ProbabilitySlices}()

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
                        # non_diamond_belief is already a ProbabilitySlices, don't need to convert
                        append!(all_beliefs, [non_diamond_belief])
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

    function updateDiamondJoin_slices(
        fork_node::Int64,
        join_node::Int64, 
        ancestor_group::AncestorGroup,
        node_priors::Dict{Int64, ProbabilitySlices},
        link_probability::Dict{Tuple{Int64, Int64}, ProbabilitySlices},
        belief_dict::Dict{Int64,ProbabilitySlices}
    )
        # Get the precomputed subgraph
        subgraph = ancestor_group.subgraph
        
        # Create sub_link_probability just for the subgraph edges
        sub_link_probability = Dict{Tuple{Int64, Int64}, ProbabilitySlices}()
        for edge in subgraph.edgelist
            sub_link_probability[edge] = link_probability[edge]
        end
    
        # Create sub_node_priors for the subgraph nodes
        sub_node_priors = Dict{Int64, ProbabilitySlices}()
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
        sub_node_priors[fork_node] = ProbabilitySlices([1.0], [1.0])  # Success case
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
        sub_node_priors[fork_node] = ProbabilitySlices([0.0], [1.0])  # Failure case
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
        updated_belief_dict[join_node] = combine_conditional_slices(
            success_belief,
            failure_belief,
            original_fork_belief
        )
        return updated_belief_dict
    end

    function combine_conditional_slices(
        success::ProbabilitySlices,
        failure::ProbabilitySlices,
        condition::ProbabilitySlices
    )
        combined_slices = Vector{Tuple{Float64,Float64}}()
        
        # P(A|B)P(B)
        for (sv, sw) in zip(success.values, success.weights)
            for (cv, cw) in zip(condition.values, condition.weights)
                push!(combined_slices, (sv * cv, sw * cw))
            end
        end
        
        # P(A|not B)P(not B)
        for (fv, fw) in zip(failure.values, failure.weights)
            for (cv, cw) in zip(condition.values, condition.weights)
                push!(combined_slices, (fv * (1-cv), fw * cw))
            end
        end
        
        return consolidate_slices(combined_slices)
    end

    function calculate_diamond_groups_belief_slices(
        diamond_structure::GroupedDiamondStructure,
        belief_dict::Dict{Int64,ProbabilitySlices},
        node_priors::Dict{Int64, ProbabilitySlices},
        link_probability::Dict{Tuple{Int64, Int64}, ProbabilitySlices},
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
        group_combined_beliefs = Vector{ProbabilitySlices}()


        for group in diamond_structure.diamond
            fork_node = first(group.highest_nodes)
            updated_belief_dict = updateDiamondJoin(
                fork_node,
                join_node,
                group,
                node_priors,
                link_probability,
                belief_dict
            )
            push!(group_combined_beliefs, updated_belief_dict[join_node])
        end

        return group_combined_beliefs
    end

    function calculate_regular_belief_slices(
        parents::Set{Int64},
        node::Int64,
        belief_dict::Dict{Int64, ProbabilitySlices},
        link_probability::Dict{Tuple{Int64, Int64}, ProbabilitySlices},
    )
        combined_slices = Vector{Tuple{Float64,Float64}}()  # (value, weight) pairs
        
        for parent in parents
            parent_belief = belief_dict[parent]
            link_rel = link_probability[(parent, node)]
            
            # Combine this parent's slices with link probability
            for (pv, pw) in zip(parent_belief.values, parent_belief.weights)
                for (lv, lw) in zip(link_rel.values, link_rel.weights)
                    # Series combination: multiply probabilities and weights
                    push!(combined_slices, (pv * lv, pw * lw))
                end
            end
        end
        
        # Consolidate slices that have similar values
        return consolidate_slices(combined_slices)
    end
    
    function inclusion_exclusion_slices(slice_values::Vector{ProbabilitySlices}, tolerance::Float64=1e-6)
        combined_slices = Vector{Tuple{Float64,Float64}}()
        
        # Handle empty input
        if isempty(slice_values)
            return ProbabilitySlices([0.0], [1.0])
        end
        
        # Handle single input
        if length(slice_values) == 1
            return slice_values[1]
        end
        
        for i in 1:length(slice_values)
            for combination in combinations(1:length(slice_values), i)
                # For each slice combination from each input
                value_combs = Iterators.product([s.values for s in slice_values[combination]]...)
                weight_combs = Iterators.product([s.weights for s in slice_values[combination]]...)
                
                for (values, weights) in zip(value_combs, weight_combs)
                    prob = prod(values)
                    weight = prod(weights)
                    
                    # Only add significant probabilities
                    if prob > tolerance
                        if isodd(i)
                            push!(combined_slices, (prob, weight))
                        else
                            push!(combined_slices, (prob, -weight))
                        end
                    end
                end
            end
        end
        
        # Sort and combine similar values with uncertainty
        return combine_slices_with_uncertainty(combined_slices, tolerance)
    end
    
    function combine_slices_with_uncertainty(combined_slices::Vector{Tuple{Float64,Float64}}, tolerance::Float64=1e-6)
        # Handle empty or single input
        if isempty(combined_slices)
            return ProbabilitySlices([0.0], [1.0])
        elseif length(combined_slices) == 1
            return ProbabilitySlices([combined_slices[1][1]], [1.0])
        end
        
        # Sort by value for better consolidation
        sort!(combined_slices, by=first)
        
        # Group similar values
        groups = Vector{Vector{Tuple{Float64,Float64}}}()
        current_group = [combined_slices[1]]
        
        for i in 2:length(combined_slices)
            if abs(combined_slices[i][1] - current_group[1][1]) < tolerance
                push!(current_group, combined_slices[i])
            else
                if !isempty(current_group)
                    push!(groups, current_group)
                end
                current_group = [combined_slices[i]]
            end
        end
        if !isempty(current_group)
            push!(groups, current_group)
        end
        
        # Calculate values and weights for each group
        values = Float64[]
        weights = Float64[]
        
        for group in groups
            group_values = [x[1] for x in group]
            group_weights = [x[2] for x in group]
            total_weight = sum(group_weights)
            
            if abs(total_weight) > tolerance
                # Weighted mean for the group
                mean_val = sum(group_values .* group_weights) / total_weight
                
                # Store group results
                push!(values, mean_val)
                push!(weights, total_weight)
            end
        end
        
        # Handle case where all weights cancel out
        if isempty(weights) || all(≈(0, w, atol=tolerance) for w in weights)
            return ProbabilitySlices([0.0], [1.0])
        end
        
        # Normalize weights
        total = sum(abs.(weights))
        normalized_weights = abs.(weights) ./ total
        
        # Return result
        return ProbabilitySlices(values, normalized_weights)
    end

    function MC_result_slices(
        edgelist::Vector{Tuple{Int64,Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, ProbabilitySlices},
        link_probability::Dict{Tuple{Int64, Int64}, ProbabilitySlices},
        N::Int=100000
    )
        # Get all nodes
        all_nodes = reduce(union, values(incoming_index), init=keys(incoming_index))
        
        # Track sampled probabilities for each node
        node_samples = Dict{Int64, Vector{Float64}}()
        for node in all_nodes
            node_samples[node] = Float64[]
        end

        for _ in 1:N
            # Track probabilities for this iteration
            node_probs = Dict{Int64, Float64}()
            
            # Sample node states and store their probabilities
            node_active = Dict{Int64, Bool}()
            for node in all_nodes
                prob = sample_from_slices(node_priors[node])
                node_probs[node] = prob
                node_active[node] = prob > rand()
            end

            # Sample edge states and store their probabilities
            edge_probs = Dict{Tuple{Int64,Int64}, Float64}()
            active_edges = Dict{Tuple{Int64,Int64}, Bool}()
            
            for edge in edgelist
                src, dst = edge
                if node_active[src] && node_active[dst]
                    prob = sample_from_slices(link_probability[edge])
                    edge_probs[edge] = prob
                    active_edges[edge] = prob > rand()
                else
                    edge_probs[edge] = 0.0
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

            # Process each node
            for node in all_nodes
                if node in source_nodes
                    if node_active[node]
                        # Store the actual sampled probability for source nodes
                        push!(node_samples[node], node_probs[node])
                    else
                        push!(node_samples[node], 0.0)
                    end
                else
                    # For non-source nodes, check reachability
                    reachable = false
                    path_prob = 0.0
                    
                    for source in source_nodes
                        if has_path(sub_outgoing, source, node)
                            reachable = true
                            # Calculate path probability
                            path_prob = calculate_path_probability(
                                source, 
                                node, 
                                sub_outgoing,
                                node_probs,
                                edge_probs
                            )
                            break
                        end
                    end
                    
                    if reachable
                        # Store the combined probability of node and path
                        push!(node_samples[node], node_probs[node] * path_prob)
                    else
                        push!(node_samples[node], 0.0)
                    end
                end
            end
        end

        # Convert samples to ProbabilitySlices
        result = Dict{Int64, ProbabilitySlices}()
        for (node, samples) in node_samples
            # Remove zeros if you want to only consider successful cases
            active_samples = filter(x -> x > 0, samples)
            
            if !isempty(active_samples)
                # Create histogram-like distribution
                sorted_samples = sort(active_samples)
                n_bins = min(length(active_samples) ÷ 100 + 1, 10)  # Adjust bin number as needed
                
                edges = range(minimum(sorted_samples), maximum(sorted_samples), length=n_bins+1)
                weights = zeros(n_bins)
                values = zeros(n_bins)
                
                for i in 1:n_bins
                    bin_samples = filter(x -> edges[i] <= x < edges[i+1], sorted_samples)
                    weights[i] = length(bin_samples) / length(samples)
                    values[i] = (edges[i] + edges[i+1]) / 2
                end
                
                result[node] = ProbabilitySlices(values, weights)
            else
                # If no successful samples, return zero probability
                result[node] = ProbabilitySlices([0.0], [1.0])
            end
        end

        return result
    end

    # Helper function to calculate probability along a path
    function calculate_path_probability(
        source::Int64,
        target::Int64,
        sub_outgoing::Dict{Int64, Set{Int64}},
        node_probs::Dict{Int64, Float64},
        edge_probs::Dict{Tuple{Int64,Int64}, Float64}
    )
        # Use BFS to find shortest path
        visited = Set{Int64}()
        queue = [(source, 1.0)]  # (node, probability so far)
        push!(visited, source)
        
        while !isempty(queue)
            (current, prob_so_far) = popfirst!(queue)
            
            if current == target
                return prob_so_far
            end
            
            if haskey(sub_outgoing, current)
                for next in sub_outgoing[current]
                    if next ∉ visited
                        push!(visited, next)
                        new_prob = prob_so_far * node_probs[next] * edge_probs[(current, next)]
                        push!(queue, (next, new_prob))
                    end
                end
            end
        end
        
        return 0.0  # No path found
    end
    
    function sample_from_slices(slices::ProbabilitySlices)
        rand_val = rand()
        cumsum_weights = cumsum(slices.weights)
        for (i, cum_weight) in enumerate(cumsum_weights)
            if rand_val <= cum_weight
                return slices.values[i]
            end
        end
        return slices.values[end]
    end


    # Helper function to check if there's a path between two nodes
    function has_path_slices(graph::Dict{Int64, Set{Int64}}, start::Int64, target::Int64)
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

    function consolidate_slices(slices::Vector{Tuple{Float64,Float64}}, tolerance::Float64=1e-6)
        consolidated = Dict{Float64,Float64}()  # value => total_weight
        
        for (value, weight) in slices
            # Find closest existing value within tolerance
            found = false
            for (existing_value, existing_weight) in consolidated
                if abs(value - existing_value) < tolerance
                    consolidated[existing_value] += weight
                    found = true
                    break
                end
            end
            if !found
                consolidated[value] = weight
            end
        end
        
        values = collect(keys(consolidated))
        weights = collect(values(consolidated))
        
        return ProbabilitySlices(values, weights ./ sum(weights))
    end
end
