module ReachabilityModuleDepthLimited
    """
    DEPTH-LIMITED PARALLELISM VERSION

    Key insight: Profile shows 95% thread overhead, 5% compute.
    With 1-2 conditioning nodes but deep nesting (50+ levels):
    - Current: Spawns tasks at EVERY level → 2^50 task spawns → 95% overhead
    - This version: Only parallelize top 3 levels → 2^3 = 8 tasks → minimal overhead

    Expected: Reduce 45s to ~8-10s by eliminating 90% of thread overhead
    """

    using ..DiamondProcessingModule
    using ..InputProcessingModule

    import ..InputProcessingModule: Interval, pbox, PBA,
           zero_value, one_value, non_fixed_value,
           is_valid_probability, add_values, multiply_values,
           complement_value, subtract_values, sum_values, prod_values

    export update_beliefs_iterative, validate_network_data,
           calculate_regular_belief, inclusion_exclusion,
           updateDiamondJoin, calculate_diamond_groups_belief,
           DiamondCacheEntry, CacheKey, make_cache_key

    # Cache structures (same as optimized)
    struct DiamondCacheEntry
        edgelist::Vector{Tuple{Int64,Int64}}
        current_priors::Dict{Int64,Float64}
        state_beliefs::Dict{Int64,Float64}
    end

    struct CacheKey
        diamond_hash::UInt64
        priors_hash::UInt64
    end

    Base.hash(k::CacheKey, h::UInt) = hash((k.diamond_hash, k.priors_hash), h)
    Base.:(==)(a::CacheKey, b::CacheKey) = a.diamond_hash == b.diamond_hash && a.priors_hash == b.priors_hash

    function make_cache_key(edgelist, current_priors::Dict{Int64, Float64})
        diamond_hash = hash(sort(edgelist))
        priors_hash = UInt64(0)
        sorted_nodes = sort(collect(keys(current_priors)))
        for node in sorted_nodes
            value = current_priors[node]
            priors_hash = hash((node, value), priors_hash)
        end
        return CacheKey(diamond_hash, priors_hash)
    end

    const diamond_cache_lock = ReentrantLock()

    # MAX_PARALLEL_DEPTH: Only parallelize top N levels of diamond nesting
    # With depth=3 and 2 cond nodes per level: 2^3 = 8 parallel tasks (perfect for 8 threads)
    # Deeper levels run sequentially within each task
    const MAX_PARALLEL_DEPTH = 3

    # Validation and helper functions (same as optimized)
    function validate_network_data(
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, Float64},
        link_probability::Dict{Tuple{Int64, Int64}, Float64},
    )
        all_nodes = reduce(union, iteration_sets, init = Set{Int64}())

        nodes_without_priors = setdiff(all_nodes, keys(node_priors))
        if !isempty(nodes_without_priors)
            throw(ErrorException("The following nodes are missing priors: $nodes_without_priors"))
        end

        non_source_nodes = setdiff(all_nodes, source_nodes)
        for node in non_source_nodes
            if !haskey(incoming_index, node) || isempty(incoming_index[node])
                throw(ErrorException("Non-source node $node has no incoming edges"))
            end
        end

        for source in source_nodes
            if haskey(incoming_index, source) && !isempty(incoming_index[source])
                throw(ErrorException("Source node $source has incoming edges: $(incoming_index[source])"))
            end
        end

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

        invalid_priors = [(node, prior) for (node, prior) in node_priors if !is_valid_probability(prior)]
        if !isempty(invalid_priors)
            throw(ErrorException("The following nodes have invalid prior probabilities (must be between 0 and 1): $invalid_priors"))
        end

        invalid_probabilities = [(edge, rel) for (edge, rel) in link_probability if !is_valid_probability(rel)]
        if !isempty(invalid_probabilities)
            throw(ErrorException("The following edges have invalid probability values (must be between 0 and 1): $invalid_probabilities"))
        end

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
        n = length(belief_values)

        for mask in 1:(2^n - 1)
            subset_size = count_ones(mask)

            intersection_prob = 1.0
            for i in 1:n
                if (mask & (1 << (i-1))) != 0
                    intersection_prob *= belief_values[i]
                end
            end

            if isodd(subset_size)
                combined_belief += intersection_prob
            else
                combined_belief -= intersection_prob
            end
        end

        return combined_belief
    end

    """
    DEPTH-LIMITED version of updateDiamondJoin

    Uses diamond depth_level to decide: parallelize shallow diamonds, sequential for deep ones
    """
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
        diamond_cache::Dict{CacheKey, DiamondCacheEntry},
        current_depth::Int = 0  # Track current nesting depth
        )

        diamond_hash_key = DiamondProcessingModule.create_diamond_hash_key(diamond)

        if !haskey(computation_lookup, diamond_hash_key)
            error("Diamond not found in computation_lookup")
        end

        computation_data = computation_lookup[diamond_hash_key]

        sub_outgoing_index = computation_data.sub_outgoing_index
        sub_incoming_index = computation_data.sub_incoming_index
        fresh_sources = computation_data.sub_sources
        sub_fork_nodes = computation_data.sub_fork_nodes
        sub_join_nodes = computation_data.sub_join_nodes
        sub_ancestors = computation_data.sub_ancestors
        sub_descendants = computation_data.sub_descendants
        sub_iteration_sets = computation_data.sub_iteration_sets
        sub_diamond_structures = computation_data.sub_diamond_structures

        sub_link_probability = Dict{Tuple{Int64, Int64}, Float64}()
        for edge in diamond.edgelist
            sub_link_probability[edge] = link_probability[edge]
        end

        sub_node_priors = Dict{Int64, Float64}()
        for node in diamond.relevant_nodes
            if node ∉ fresh_sources
                sub_node_priors[node] = node_priors[node]
                if node == join_node
                    sub_node_priors[node] = 1.0
                end
            elseif node ∉ conditioning_nodes
                sub_node_priors[node] = belief_dict[node]
            elseif node ∈ conditioning_nodes
                sub_node_priors[node] = 1.0
            end
        end

        conditioning_nodes_list = collect(unique(conditioning_nodes))
        num_states = 2^length(conditioning_nodes_list)

        final_belief = 0.0

        # DEPTH-LIMITED PARALLELISM DECISION:
        # Only parallelize if:
        # 1. num_states >= 2 (have work to parallelize)
        # 2. Threads available
        # 3. current_depth < MAX_PARALLEL_DEPTH (key change!)
        use_parallel = num_states >= 2 && Threads.nthreads() > 1 && current_depth < MAX_PARALLEL_DEPTH

        if use_parallel
            # Parallel execution at shallow depths
            tasks = Vector{Task}(undef, num_states)

            for state_idx in 0:(num_states - 1)
                tasks[state_idx + 1] = Threads.@spawn begin
                    state_probability = 1.0
                    conditioning_state = Dict{Int64, Float64}()

                    for (i, node) in enumerate(conditioning_nodes_list)
                        original_belief = belief_dict[node]

                        if (state_idx & (1 << (i-1))) != 0
                            conditioning_state[node] = 1.0
                            state_probability *= original_belief
                        else
                            conditioning_state[node] = 0.0
                            state_probability *= (1.0 - original_belief)
                        end
                    end

                    local_sub_node_priors = copy(sub_node_priors)
                    for (node, value) in conditioning_state
                        local_sub_node_priors[node] = value
                    end

                    cache_key = make_cache_key(diamond.edgelist, local_sub_node_priors)

                    local state_beliefs
                    lock(diamond_cache_lock) do
                        if haskey(diamond_cache, cache_key)
                            cached_entry = diamond_cache[cache_key]
                            state_beliefs = cached_entry.state_beliefs
                        else
                            state_beliefs = nothing
                        end
                    end

                    if state_beliefs === nothing
                        # Recursive call with incremented depth
                        state_beliefs = update_beliefs_iterative(
                            diamond.edgelist,
                            sub_iteration_sets,
                            sub_outgoing_index,
                            sub_incoming_index,
                            fresh_sources,
                            local_sub_node_priors,
                            sub_link_probability,
                            sub_descendants,
                            sub_ancestors,
                            sub_diamond_structures,
                            sub_join_nodes,
                            sub_fork_nodes,
                            computation_lookup,
                            diamond_cache,
                            current_depth + 1  # INCREMENT DEPTH
                        )

                        lock(diamond_cache_lock) do
                            if !haskey(diamond_cache, cache_key)
                                diamond_cache[cache_key] = DiamondCacheEntry(diamond.edgelist, local_sub_node_priors, state_beliefs)
                            end
                        end
                    end

                    join_belief = state_beliefs[join_node]
                    join_belief * state_probability
                end
            end

            for task in tasks
                partial_result = fetch(task)
                final_belief += partial_result
            end
        else
            # Sequential execution at deep depths (or single-threaded)
            for state_idx in 0:(num_states - 1)
                state_probability = 1.0
                conditioning_state = Dict{Int64, Float64}()

                for (i, node) in enumerate(conditioning_nodes_list)
                    original_belief = belief_dict[node]

                    if (state_idx & (1 << (i-1))) != 0
                        conditioning_state[node] = 1.0
                        state_probability *= original_belief
                    else
                        conditioning_state[node] = 0.0
                        state_probability *= (1.0 - original_belief)
                    end
                end

                local_sub_node_priors = copy(sub_node_priors)
                for (node, value) in conditioning_state
                    local_sub_node_priors[node] = value
                end

                cache_key = make_cache_key(diamond.edgelist, local_sub_node_priors)

                local state_beliefs
                if haskey(diamond_cache, cache_key)
                    cached_entry = diamond_cache[cache_key]
                    state_beliefs = cached_entry.state_beliefs
                else
                    # Recursive call with incremented depth (still sequential)
                    state_beliefs = update_beliefs_iterative(
                        diamond.edgelist,
                        sub_iteration_sets,
                        sub_outgoing_index,
                        sub_incoming_index,
                        fresh_sources,
                        local_sub_node_priors,
                        sub_link_probability,
                        sub_descendants,
                        sub_ancestors,
                        sub_diamond_structures,
                        sub_join_nodes,
                        sub_fork_nodes,
                        computation_lookup,
                        diamond_cache,
                        current_depth + 1  # INCREMENT DEPTH
                    )
                    diamond_cache[cache_key] = DiamondCacheEntry(diamond.edgelist, local_sub_node_priors, state_beliefs)
                end

                join_belief = state_beliefs[join_node]
                final_belief += join_belief * state_probability
            end
        end

        return final_belief
    end

    """
    Modified update_beliefs_iterative to pass depth parameter
    """
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
        cache::Dict{CacheKey, DiamondCacheEntry} = Dict{CacheKey, DiamondCacheEntry}(),
        current_depth::Int = 0  # Track current depth
    )
        if current_depth == 0
            validate_network_data(iteration_sets, outgoing_index, incoming_index, source_nodes, node_priors, link_probability)
        end

        belief_dict = Dict{Int64, Float64}()

        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    belief_dict[node] = node_priors[node]
                    continue
                end

                all_beliefs = Float64[]

                if haskey(diamond_structures, node)
                    structure = diamond_structures[node]

                    diamond_beliefs = updateDiamondJoin(
                        structure.diamond.conditioning_nodes,
                        structure.join_node,
                        structure.diamond,
                        link_probability,
                        node_priors,
                        belief_dict,
                        ancestors,
                        descendants,
                        iteration_sets,
                        computation_lookup,
                        cache,
                        current_depth  # Pass depth
                    )

                    push!(all_beliefs, diamond_beliefs)

                    if !isempty(structure.non_diamond_parents)
                        non_diamond_beliefs = calculate_regular_belief(
                            structure.non_diamond_parents,
                            node,
                            belief_dict,
                            link_probability
                        )

                        if !(node in join_nodes) || length(intersect(ancestors[node], source_nodes)) <= 1
                            push!(all_beliefs, sum(non_diamond_beliefs))
                        else
                            append!(all_beliefs, non_diamond_beliefs)
                        end
                    end
                else
                    parents = incoming_index[node]
                    probability_from_parents = calculate_regular_belief(
                        parents,
                        node,
                        belief_dict,
                        link_probability
                    )

                    if node in join_nodes || length(intersect(ancestors[node], source_nodes)) > 1
                        append!(all_beliefs, probability_from_parents)
                    else
                        push!(all_beliefs, sum(probability_from_parents))
                    end
                end

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
                cache,
                0  # Start at depth 0
            )
        return diamond_beliefs
    end

end
