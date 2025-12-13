module ReachabilityModuleOptimized

    # using Combinatorics  # REMOVED - using bit-masking instead
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
    # Simplified for Float64 only
    struct DiamondCacheEntry
        edgelist::Vector{Tuple{Int64,Int64}}
        current_priors::Dict{Int64,Float64}
        state_beliefs::Dict{Int64,Float64}
    end

    # Simplified cache key - just hash of edgelist + conditioning state
    struct CacheKey
        diamond_hash::UInt64          # Hash of edgelist
        priors_hash::UInt64      # Hash of ALL current_priors, not just conditioning_state
    end

    Base.hash(k::CacheKey, h::UInt) = hash((k.diamond_hash, k.priors_hash), h)
    Base.:(==)(a::CacheKey, b::CacheKey) = a.diamond_hash == b.diamond_hash && a.priors_hash == b.priors_hash

    # OPTIMIZED: Stream hashing without intermediate arrays
    function make_cache_key(edgelist, current_priors::Dict{Int64, Float64})
        diamond_hash = hash(sort(edgelist))

        # Stream hashing - no intermediate array!
        priors_hash = UInt64(0)
        sorted_nodes = sort(collect(keys(current_priors)))

        for node in sorted_nodes
            value = current_priors[node]
            priors_hash = hash((node, value), priors_hash)
        end

        return CacheKey(diamond_hash, priors_hash)
    end

    # Thread-safe lock for diamond cache access in parallel execution
    # NOTE: Using single lock like original - lock striping caused UndefRefError during dict rehashing
    const diamond_cache_lock = ReentrantLock()



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

    # OPTIMIZED: Single function with exact same signature as original (13 params + optional cache)
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
        diamond_structures::Dict{Int64, DiamondsAtNode},
        join_nodes::Set{Int64},
        fork_nodes::Set{Int64},
        computation_lookup::Dict{UInt64, DiamondComputationData{Float64}},
        cache::Dict{CacheKey, DiamondCacheEntry} = Dict{CacheKey, DiamondCacheEntry}()  # Default empty cache
    )
        validate_network_data(iteration_sets, outgoing_index, incoming_index, source_nodes, node_priors, link_probability)

        # OPTIMIZED: Create belief_dict (thread-local buffer optimization happens internally in recursive calls)
        belief_dict = Dict{Int64, Float64}()

        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    belief_dict[node] = node_priors[node]
                    continue
                end

                # Collect all sources of belief for this node
                all_beliefs = Float64[]
                
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
                            push!(all_beliefs, sum(non_diamond_beliefs))
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
                        push!(all_beliefs, sum(probability_from_parents))
                    end
                end

                # Final combination of all belief sources
                if length(all_beliefs) == 1
                    _preprior = all_beliefs[1]
                    belief_dict[node] = node_priors[node] * _preprior
                else
                    _preprior = inclusion_exclusion(all_beliefs)
                    belief_dict[node] = node_priors[node] * _preprior
                end
            end
        end

        return belief_dict
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

    # OPTIMIZED: Bit-masking instead of Combinatorics.combinations
    function inclusion_exclusion(belief_values::Vector{Float64})
        combined_belief = 0.0
        n = length(belief_values)

        # Iterate through all 2^n - 1 non-empty subsets using bit masks
        for mask in 1:(2^n - 1)
            subset_size = count_ones(mask)

            # Calculate product for this subset
            intersection_prob = 1.0
            for i in 1:n
                if (mask & (1 << (i-1))) != 0
                    intersection_prob *= belief_values[i]
                end
            end

            # Inclusion-exclusion
            if isodd(subset_size)
                combined_belief += intersection_prob
            else
                combined_belief -= intersection_prob
            end
        end

        return combined_belief
    end

   
    function updateDiamondJoin(
        conditioning_nodes::Set{Int64},
        join_node::Int64,
        diamond::Diamond,
        link_probability::Dict{Tuple{Int64,Int64},Float64},
        node_priors::Dict{Int64,Float64},
        belief_dict::Dict{Int64,Float64},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        iteration_sets::Vector{Set{Int64}},
        computation_lookup::Dict{UInt64, DiamondComputationData{Float64}},
        diamond_cache::Dict{CacheKey, DiamondCacheEntry}
        )

        

        
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
        sub_link_probability = Dict{Tuple{Int64, Int64}, Float64}()
        for edge in diamond.edgelist
            sub_link_probability[edge] = link_probability[edge]
        end

        # Create sub_node_priors for the diamond nodes - only need to properly set node priors for the non-conditioning source nodes
        sub_node_priors = Dict{Int64, Float64}()
        for node in diamond.relevant_nodes
            if node ∉ fresh_sources
                sub_node_priors[node] = node_priors[node]
                if node == join_node
                    # If the node is the join node, set its prior to 1.0
                    sub_node_priors[node] = 1.0
                end
            elseif node ∉ conditioning_nodes
                sub_node_priors[node] = belief_dict[node]
            elseif node ∈ conditioning_nodes
                sub_node_priors[node] = 1.0    ## Set conditioning nodes to 1.0 so that diamonds identification works
            end
        end

        # NEW: Use multi-conditioning approach
        conditioning_nodes_list = collect(unique(conditioning_nodes))


        # Generate all possible states of conditioning nodes (0 or 1)
        final_belief = 0.0

        # PARALLEL VERSION: Use Threads.@spawn for each conditioning state
        # Each state is mathematically independent - parallelization maintains exactness
        num_states = 2^length(conditioning_nodes_list)

        # Only parallelize if we have threads available (even n=1 -> 2 states can benefit from parallelism)
        # The real benefit comes from recursive parallelism where small diamonds contain larger nested diamonds
        use_parallel = num_states >= 2 && Threads.nthreads() > 1

        if use_parallel
            # Parallel execution using tasks
            tasks = Vector{Task}(undef, num_states)

            for state_idx in 0:(num_states - 1)
                tasks[state_idx + 1] = Threads.@spawn begin
                    # Calculate state probability
                    state_probability = 1.0
                    conditioning_state = Dict{Int64, Float64}()

                    for (i, node) in enumerate(conditioning_nodes_list)
                        # Store original belief for this node
                        original_belief = belief_dict[node]

                        # Check if the i-th bit is set
                        if (state_idx & (1 << (i-1))) != 0
                            conditioning_state[node] = 1.0
                            state_probability *= original_belief
                        else
                            conditioning_state[node] = 0.0
                            state_probability *= (1.0 - original_belief)
                        end
                    end

                    # THREAD-SAFE FIX: Create thread-local copy instead of mutating shared dictionary
                    local_sub_node_priors = copy(sub_node_priors)

                    # Apply conditioning state to the local copy
                    for (node, value) in conditioning_state
                        local_sub_node_priors[node] = value
                    end

                    # Generate cache key using local copy
                    cache_key = make_cache_key(diamond.edgelist, local_sub_node_priors)

                    # Check cache first (need lock for thread safety)
                    local state_beliefs
                    lock(diamond_cache_lock) do
                        if haskey(diamond_cache, cache_key)
                            # Use cached result
                            cached_entry = diamond_cache[cache_key]
                            state_beliefs = cached_entry.state_beliefs
                        else
                            state_beliefs = nothing
                        end
                    end

                    # Compute if not cached (this is the expensive part - do outside lock)
                    if state_beliefs === nothing
                        state_beliefs = update_beliefs_iterative(
                            diamond.edgelist,
                            sub_iteration_sets,
                            sub_outgoing_index,
                            sub_incoming_index,
                            fresh_sources,
                            local_sub_node_priors,  # Use local copy instead of shared
                            sub_link_probability,
                            sub_descendants,
                            sub_ancestors,
                            sub_diamond_structures,
                            sub_join_nodes,
                            sub_fork_nodes,
                            computation_lookup,
                            diamond_cache  # Pass the cache parameter
                        )

                        # Store in cache (need lock)
                        lock(diamond_cache_lock) do
                            # Check again in case another thread computed it
                            if !haskey(diamond_cache, cache_key)
                                diamond_cache[cache_key] = DiamondCacheEntry(diamond.edgelist, local_sub_node_priors, state_beliefs)
                            end
                        end
                    end

                    # No restoration needed - we used a local copy

                    # Return the weighted contribution from this state
                    join_belief = state_beliefs[join_node]
                    join_belief * state_probability
                end
            end

            # Collect results from all parallel tasks and sum (reduction)
            for task in tasks
                partial_result = fetch(task)
                final_belief += partial_result
            end
        else
            # Sequential execution - also optimized
            for state_idx in 0:(num_states - 1)
                # Calculate state probability
                state_probability = 1.0
                conditioning_state = Dict{Int64, Float64}()

                for (i, node) in enumerate(conditioning_nodes_list)
                    # Store original belief for this node
                    original_belief = belief_dict[node]

                    # Check if the i-th bit is set
                    if (state_idx & (1 << (i-1))) != 0
                        conditioning_state[node] = 1.0
                        state_probability *= original_belief
                    else
                        conditioning_state[node] = 0.0
                        state_probability *= (1.0 - original_belief)
                    end
                end

                # THREAD-SAFE FIX: Create local copy instead of mutating shared dictionary
                local_sub_node_priors = copy(sub_node_priors)

                # Apply conditioning state to the local copy
                for (node, value) in conditioning_state
                    local_sub_node_priors[node] = value
                end

                # Generate cache key using local copy
                cache_key = make_cache_key(diamond.edgelist, local_sub_node_priors)

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
                        local_sub_node_priors,  # Use local copy
                        sub_link_probability,
                        sub_descendants,
                        sub_ancestors,
                        sub_diamond_structures,
                        sub_join_nodes,
                        sub_fork_nodes,
                        computation_lookup,
                        diamond_cache
                    )
                    diamond_cache[cache_key] = DiamondCacheEntry(diamond.edgelist, local_sub_node_priors, state_beliefs)
                end

                # No restoration needed - we used a local copy

                # Weight the result by the probability of this state
                join_belief = state_beliefs[join_node]
                final_belief += join_belief * state_probability
            end
        end
        
        
        return final_belief
    end

    function calculate_diamond_groups_belief(
        diamond::DiamondsAtNode,
        belief_dict::Dict{Int64,Float64},
        link_probability::Dict{Tuple{Int64,Int64},Float64},
        node_priors::Dict{Int64,Float64},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        iteration_sets::Vector{Set{Int64}},
        computation_lookup::Dict{UInt64, DiamondComputationData{Float64}},
        cache::Dict{CacheKey, DiamondCacheEntry}
    )
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