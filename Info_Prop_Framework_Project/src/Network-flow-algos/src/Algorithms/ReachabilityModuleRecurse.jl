module ReachabilityModule

    using Combinatorics
    using ..DiamondProcessingModule
    using ..InputProcessingModule
    
    # Import all uncertainty operations from InputProcessingModule
    import ..InputProcessingModule: Interval, pbox, PBA,
           zero_value, one_value, non_fixed_value,
           is_valid_probability, add_values, multiply_values,
           complement_value, subtract_values, sum_values, prod_values

    # Export main functions
    export update_beliefs_iterative, validate_network_data,
           calculate_regular_belief, inclusion_exclusion,
           updateDiamondJoin, calculate_diamond_groups_belief,
           DiamondCacheEntry, CacheKey, make_cache_key

    # Cache entry - stores the three components you specified
    struct DiamondCacheEntry{T}
        edgelist::Vector{Tuple{Int64,Int64}}
        current_priors::Dict{Int64,T}
        state_beliefs::Dict{Int64,T}
    end

    # Simplified cache key - just hash of edgelist + conditioning state
    struct CacheKey
        diamond_hash::UInt64          # Hash of edgelist
        priors_hash::UInt64      # Hash of ALL current_priors, not just conditioning_state
    end

    Base.hash(k::CacheKey, h::UInt) = hash((k.diamond_hash, k.priors_hash), h)
    Base.:(==)(a::CacheKey, b::CacheKey) = a.diamond_hash == b.diamond_hash && a.priors_hash == b.priors_hash

    # Simplified key generation with type-aware hashing
    function make_cache_key(edgelist, current_priors)
        diamond_hash = hash(sort(edgelist))
        
        # Create a hashable representation of priors based on type
        priors_for_hash = []
        for (node, value) in current_priors
            if isa(value, Float64)
                push!(priors_for_hash, (node, value))
            elseif isa(value, pbox)
                # For pbox, use numeric bounds for hashing
                # Access the actual bounds from the pbox structure
                min_val = minimum(value.u)  # minimum of left bounds
                max_val = maximum(value.d)  # maximum of right bounds
                push!(priors_for_hash, (node, (min_val, max_val)))
            elseif isa(value, Interval)
                # For Interval, use bounds for hashing
                push!(priors_for_hash, (node, (value.lower, value.upper)))
            else
                # Fallback: convert to string
                push!(priors_for_hash, (node, string(value)))
            end
        end
        
        priors_hash = hash(sort(priors_for_hash))
        return CacheKey(diamond_hash, priors_hash)
    end

   

    function validate_network_data(
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, T},
        link_probability::Dict{Tuple{Int64, Int64}, T},
    ) where {T <: Union{Float64, pbox, Interval}}
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
        invalid_priors = [(node, prior) for (node, prior) in node_priors if !is_valid_probability(prior)]
        if !isempty(invalid_priors)
            throw(ErrorException("The following nodes have invalid prior probabilities (must be between 0 and 1): $invalid_priors"))
        end

        # 7. Validate all probability values are between 0 and 1
        invalid_probabilities = [(edge, rel) for (edge, rel) in link_probability if !is_valid_probability(rel)]
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
        node_priors::Dict{Int64,T},
        link_probability::Dict{Tuple{Int64,Int64},T},
        descendants::Dict{Int64, Set{Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        diamond_structures::Dict{Int64, DiamondsAtNode},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64},
        computation_lookup::Dict{UInt64, DiamondComputationData{T}},
        cache::Dict{CacheKey, DiamondCacheEntry{T}} = Dict{CacheKey, DiamondCacheEntry{T}}()  # Default empty cache
    ) where {T <: Union{Float64, pbox, Interval}}
        validate_network_data(iteration_sets, outgoing_index, incoming_index, source_nodes, node_priors, link_probability)
        belief_dict = Dict{Int64, T}()

        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    belief_dict[node] = node_priors[node]
                    continue
                end

                # Collect all sources of belief for this node
                all_beliefs = T[]
                
                # Process diamond structures if they exist
                if haskey(diamond_structures, node)
                    structure = diamond_structures[node]
                    
                    # Calculate beliefs from diamond groups (now returns array of beliefs)
                    diamond_beliefs = calculate_diamond_groups_belief(
                        structure,
                        belief_dict,
                        link_probability,
                        node_priors,
                        ancestors,
                        descendants,
                        iteration_sets,
                        computation_lookup,
                        cache
                    )
                    
                    push!(all_beliefs, diamond_beliefs)
                    
                    # Handle non-diamond parents within the structure
                    if !isempty(structure.non_diamond_parents)
                        non_diamond_beliefs = calculate_regular_belief(
                            structure.non_diamond_parents,
                            node,
                            belief_dict,
                            link_probability
                        )
                        
                        # For simple tree paths, just take the sum
                        if !(node in join_nodes) || length(intersect(ancestors[node], source_nodes)) <= 1
                            push!(all_beliefs, sum_values(non_diamond_beliefs))
                        else
                            # For join nodes with multiple paths, use inclusion-exclusion
                            append!(all_beliefs, non_diamond_beliefs)
                        end
                    end
                else
                    # No diamond structures - handle regular parents
                    parents = incoming_index[node]
                    probability_from_parents = calculate_regular_belief(
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
                        push!(all_beliefs, sum_values(probability_from_parents))
                    end
                end
                
                # Final combination of all belief sources
                if length(all_beliefs) == 1
                    _preprior = all_beliefs[1]
                    belief_dict[node] = multiply_values(node_priors[node], _preprior)
                else
                    _preprior = inclusion_exclusion(all_beliefs)
                    belief_dict[node] = multiply_values(node_priors[node], _preprior)
                end
            end
        end

        return belief_dict
    end

    function calculate_regular_belief(
        parents::Set{Int64},
        node::Int64,
        belief_dict::Dict{Int64, T},
        link_probability::Dict{Tuple{Int64, Int64}, T},
    ) where {T <: Union{Float64, pbox, Interval}}
        combined_probability_from_parents = T[]
        for parent in parents
            if !haskey(belief_dict, parent)
                throw(ErrorException("Parent node $parent of node $node has no belief value. This indicates a processing order error."))
            end
            parent_belief = belief_dict[parent]

            if !haskey(link_probability, (parent, node))
                throw(ErrorException("No probability defined for edge ($parent, $node)"))
            end
            link_rel = link_probability[(parent, node)]

            push!(combined_probability_from_parents, multiply_values(parent_belief, link_rel))
        end

        return combined_probability_from_parents
    end

    function inclusion_exclusion(belief_values::Vector{T}) where {T <: Union{Float64, pbox, Interval}}
        combined_belief = zero_value(T)
        num_beliefs = length(belief_values)
        

        for i in 1:num_beliefs
            # Iterate through all possible combinations of belief values
            for combination in combinations(belief_values, i)
                # Calculate the intersection probability of the current combination
                intersection_probability = prod_values(collect(combination))

                # Add or subtract the intersection probability based on the number of beliefs in the combination
                if isodd(i)
                    combined_belief = add_values(combined_belief, intersection_probability)
                else
                    combined_belief = subtract_values(combined_belief, intersection_probability)
                end
            end
        end
        return combined_belief
    end

   
    function updateDiamondJoin(
        conditioning_nodes::Set{Int64},
        join_node::Int64,
        diamond::Diamond,
        link_probability::Dict{Tuple{Int64,Int64},T},
        node_priors::Dict{Int64,T},
        belief_dict::Dict{Int64,T},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        iteration_sets::Vector{Set{Int64}},
        computation_lookup::Dict{UInt64, DiamondComputationData{T}},
        diamond_cache::Dict{CacheKey, DiamondCacheEntry{T}}
        ) where {T <: Union{Float64, pbox, Interval}}

        

        
        # O(1) lookup with hash key - SUPER FAST even for large diamonds!
        diamond_hash_key = DiamondProcessingModule.create_diamond_hash_key(diamond)
        
        # Debug: Check if diamond exists in lookup
        if !haskey(computation_lookup, diamond_hash_key)
            error("Diamond not found in computation_lookup")
        end
        
        computation_data = computation_lookup[diamond_hash_key]
        
        # Skip ALL expensive graph building - everything is ready!
        sub_outgoing_index = computation_data.sub_outgoing_index
        sub_incoming_index = computation_data.sub_incoming_index
        fresh_sources = computation_data.sub_sources
        sub_fork_nodes = computation_data.sub_fork_nodes
        sub_join_nodes = computation_data.sub_join_nodes
        sub_ancestors = computation_data.sub_ancestors
        sub_descendants = computation_data.sub_descendants
        sub_iteration_sets = computation_data.sub_iteration_sets
        sub_diamond_structures = computation_data.sub_diamond_structures
        
       
        
        # Create sub_link_probability just for the diamond edges
        sub_link_probability = Dict{Tuple{Int64, Int64}, T}()
        for edge in diamond.edgelist
            sub_link_probability[edge] = link_probability[edge]
        end

        # Create sub_node_priors for the diamond nodes - only need to properly set node priors for the non-conditioning source nodes
        sub_node_priors = Dict{Int64, T}()
        for node in diamond.relevant_nodes
            if node ∉ fresh_sources
                sub_node_priors[node] = node_priors[node]
                if node == join_node
                    # If the node is the join node, set its prior to 1.0
                    sub_node_priors[node] = one_value(T)
                end
            elseif node ∉ conditioning_nodes
                sub_node_priors[node] = belief_dict[node]
            elseif node ∈ conditioning_nodes
                sub_node_priors[node] = one_value(T)    ## Set conditioning nodes to 1.0 so that diamonds identification works
            end
        end

        # NEW: Use multi-conditioning approach
        conditioning_nodes_list = collect(unique(conditioning_nodes))
        
        
        # Generate all possible states of conditioning nodes (0 or 1)
        final_belief = zero_value(T)
        
        # Use binary representation for efficiency
        for state_idx in 0:(2^length(conditioning_nodes_list) - 1)
            # Calculate state probability
            state_probability = one_value(T)
            conditioning_state = Dict{Int64, T}()
            
            for (i, node) in enumerate(conditioning_nodes_list)
                # Store original belief for this node
                original_belief = belief_dict[node]
                
                # Check if the i-th bit is set
                if (state_idx & (1 << (i-1))) != 0
                    conditioning_state[node] = one_value(T)
                    state_probability = multiply_values(state_probability, original_belief)
                else
                    conditioning_state[node] = zero_value(T)
                    state_probability = multiply_values(state_probability, complement_value(original_belief))
                end
            end
            
            # Make a copy of sub_node_priors for this iteration
            current_priors = copy(sub_node_priors)
            
            # Set conditioning nodes to their current state
            for (node, value) in conditioning_state
                current_priors[node] = value
            end
            
            #store diamond diamond.edgelist, current_priors, state_beliefs
            # Generate cache key
            cache_key = make_cache_key(diamond.edgelist, current_priors)
            
           
            # Check cache first
            if haskey(diamond_cache, cache_key)
                # Use cached result
                cached_entry = diamond_cache[cache_key]
                state_beliefs = cached_entry.state_beliefs
            else
                                
                state_beliefs = update_beliefs_iterative(
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
                    sub_fork_nodes,
                    computation_lookup,
                    diamond_cache
                )
               diamond_cache[cache_key] = DiamondCacheEntry(diamond.edgelist, current_priors, state_beliefs)
            end

            # Weight the result by the probability of this state
            join_belief = state_beliefs[join_node]
            final_belief = add_values(final_belief, multiply_values(join_belief, state_probability))
        end
        
        
        return final_belief
    end

    function calculate_diamond_groups_belief(
        diamond::DiamondsAtNode,
        belief_dict::Dict{Int64,T},
        link_probability::Dict{Tuple{Int64,Int64},T},
        node_priors::Dict{Int64,T},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        iteration_sets::Vector{Set{Int64}},
        computation_lookup::Dict{UInt64, DiamondComputationData{T}},
        cache::Dict{CacheKey, DiamondCacheEntry{T}}
    ) where {T <: Union{Float64, pbox, Interval}}
        diamond_beliefs = updateDiamondJoin(
                diamond.diamond.conditioning_nodes,
                diamond.join_node,
                diamond.diamond,
                link_probability,
                node_priors,
                belief_dict,
                ancestors,
                descendants,
                iteration_sets,
                computation_lookup,
                cache
            )
        return diamond_beliefs
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
end