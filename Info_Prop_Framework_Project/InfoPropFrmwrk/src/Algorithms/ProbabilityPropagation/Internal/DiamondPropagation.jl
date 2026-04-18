"""
    updateDiamondJoin(...) -> T

Computes belief for a diamond join node using conditional expectation
over conditioning states. Uses bit-masking for state enumeration.

Implements: Result = sum_{s=0}^{2^n-1} P(state_s) * Belief(Join | state_s)
"""
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

    # O(1) lookup with hash key
    diamond_hash_key = DiamondDecompositionModule.create_diamond_hash_key(diamond)

    if !haskey(computation_lookup, diamond_hash_key)
        error("Diamond not found in computation_lookup")
    end

    computation_data = computation_lookup[diamond_hash_key]

    # Pre-computed diamond structures - skip expensive graph building
    sub_outgoing_index = computation_data.sub_outgoing_index
    sub_incoming_index = computation_data.sub_incoming_index
    fresh_sources = computation_data.sub_sources
    sub_fork_nodes = computation_data.sub_fork_nodes
    sub_join_nodes = computation_data.sub_join_nodes
    sub_ancestors = computation_data.sub_ancestors
    sub_descendants = computation_data.sub_descendants
    sub_iteration_sets = computation_data.sub_iteration_sets
    sub_diamond_structures = computation_data.sub_diamond_structures

    # Create sub_link_probability for diamond edges only
    sub_link_probability = Dict{Tuple{Int64, Int64}, T}()
    for edge in diamond.edgelist
        sub_link_probability[edge] = link_probability[edge]
    end

    # Build sub_node_priors with contextual beliefs
    sub_node_priors = Dict{Int64, T}()

    for node in diamond.relevant_nodes
        # Case 1: Non-source nodes - use original prior
        if node ∉ fresh_sources
            sub_node_priors[node] = node_priors[node]
            if node == join_node
                sub_node_priors[node] = one_value(T)
            end

        # Case 2: Fresh sources that are NOT conditioning nodes
        # Use contextual belief from outer computation
        elseif node ∉ conditioning_nodes
            sub_node_priors[node] = belief_dict[node]

        # Case 3: Conditioning nodes - will be set to 0 or 1 per state
        elseif node ∈ conditioning_nodes
            sub_node_priors[node] = one_value(T)
        end
    end

    conditioning_nodes_list = collect(unique(conditioning_nodes))

    # Phase 1: Compute R(s) = join belief for each conditioning state
    num_states = 2^length(conditioning_nodes_list)
    join_results = Vector{T}(undef, num_states)

    use_parallel = num_states >= 2 && Threads.nthreads() > 1

    if use_parallel
        tasks = Vector{Task}(undef, num_states)

        for state_idx in 0:(num_states - 1)
            tasks[state_idx + 1] = Threads.@spawn begin
                # Thread-local copy to avoid race conditions
                local_sub_node_priors = copy(sub_node_priors)

                for (i, node) in enumerate(conditioning_nodes_list)
                    if (state_idx & (1 << (i-1))) != 0
                        local_sub_node_priors[node] = one_value(T)
                    else
                        local_sub_node_priors[node] = zero_value(T)
                    end
                end

                cache_key = make_cache_key(diamond.edgelist, local_sub_node_priors)

                # Cache lookup (thread-safe)
                local state_beliefs
                lock(diamond_cache_lock) do
                    if haskey(diamond_cache, cache_key)
                        cached_entry = diamond_cache[cache_key]
                        state_beliefs = cached_entry.state_beliefs
                    else
                        state_beliefs = nothing
                    end
                end

                # Recursive computation if not cached
                if state_beliefs === nothing
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
                        diamond_cache
                    )

                    lock(diamond_cache_lock) do
                        if !haskey(diamond_cache, cache_key)
                            diamond_cache[cache_key] = DiamondCacheEntry(diamond.edgelist, local_sub_node_priors, state_beliefs)
                        end
                    end
                end

                state_beliefs[join_node]
            end
        end

        # Collect results from all parallel tasks
        for idx in 1:num_states
            join_results[idx] = fetch(tasks[idx])
        end
    else
        for state_idx in 0:(num_states - 1)
            local_sub_node_priors = copy(sub_node_priors)

            for (i, node) in enumerate(conditioning_nodes_list)
                if (state_idx & (1 << (i-1))) != 0
                    local_sub_node_priors[node] = one_value(T)
                else
                    local_sub_node_priors[node] = zero_value(T)
                end
            end

            cache_key = make_cache_key(diamond.edgelist, local_sub_node_priors)

            if haskey(diamond_cache, cache_key)
                cached_entry = diamond_cache[cache_key]
                state_beliefs = cached_entry.state_beliefs
            else
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
                    diamond_cache
                )
                diamond_cache[cache_key] = DiamondCacheEntry(diamond.edgelist, local_sub_node_priors, state_beliefs)
            end

            join_results[state_idx + 1] = state_beliefs[join_node]
        end
    end

    # Phase 2: Combine R(s) with conditioning state probabilities.
    if T <: Interval
        m = length(conditioning_nodes_list)
        num_corners = 2^m
        min_lo = Inf
        max_hi = -Inf

        for corner_idx in 0:(num_corners - 1)
            # Fix each conditioning belief to its lower or upper bound
            corner_values = Vector{Float64}(undef, m)
            for (i, node) in enumerate(conditioning_nodes_list)
                bel = belief_dict[node]::Interval
                corner_values[i] = (corner_idx & (1 << (i-1))) != 0 ? bel.upper : bel.lower
            end

            # Compute weighted sum with scalar weights (sum to 1.0 exactly)
            lo_sum = 0.0
            hi_sum = 0.0
            for state_idx in 0:(num_states - 1)
                weight = 1.0
                for i in 1:m
                    if (state_idx & (1 << (i-1))) != 0
                        weight *= corner_values[i]
                    else
                        weight *= (1.0 - corner_values[i])
                    end
                end
                R = join_results[state_idx + 1]::Interval
                lo_sum += weight * R.lower
                hi_sum += weight * R.upper
            end

            min_lo = min(min_lo, lo_sum)
            max_hi = max(max_hi, hi_sum)
        end

        return Interval(min_lo, max_hi)
    else
        # Float64/pbox: weighted sum
        final_belief = zero_value(T)
        for state_idx in 0:(num_states - 1)
            state_probability = one_value(T)
            for (i, node) in enumerate(conditioning_nodes_list)
                original_belief = belief_dict[node]
                if (state_idx & (1 << (i-1))) != 0
                    state_probability = multiply_values(state_probability, original_belief)
                else
                    state_probability = multiply_values(state_probability, complement_value(original_belief))
                end
            end
            final_belief = add_values(final_belief, multiply_values(join_results[state_idx + 1], state_probability))
        end
        return final_belief
    end
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
