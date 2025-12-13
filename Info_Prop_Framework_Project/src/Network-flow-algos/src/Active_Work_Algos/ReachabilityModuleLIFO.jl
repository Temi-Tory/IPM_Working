module ReachabilityModuleLIFO
    """
    LIFO Work-Stealing version - eliminates recursive task spawning overhead

    Key differences from optimized version:
    1. Single worker pool (no repeated task spawn/destroy)
    2. LIFO stack per worker (depth-first for cache locality)
    3. Work stealing for load balancing
    4. Captured context in work items

    Expected: Reduce 95% thread overhead to <10%, achieve ~8-10s runtime
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

    # Work-stealing data structures

    """
    Work item representing a diamond conditioning state to process.
    Contains all context needed to process independently.
    """
    mutable struct WorkItem
        diamond::Diamond
        join_node::Int64
        conditioning_state::Dict{Int64, Float64}
        state_probability::Float64
        sub_node_priors::Dict{Int64, Float64}  # Captured context
        sub_link_probability::Dict{Tuple{Int64, Int64}, Float64}
        computation_data::DiamondComputationData{Float64}
        result_accumulator::Vector{Float64}  # Shared result vector, accumulate to [1]
    end

    """
    Per-worker LIFO stack for depth-first processing
    """
    mutable struct WorkerQueue
        stack::Vector{WorkItem}
        lock::ReentrantLock

        WorkerQueue() = new(Vector{WorkItem}(), ReentrantLock())
    end

    """
    Push work item to worker's stack (LIFO)
    """
    function push_work!(queue::WorkerQueue, item::WorkItem)
        lock(queue.lock) do
            push!(queue.stack, item)
        end
    end

    """
    Pop work item from worker's stack (LIFO, depth-first)
    Returns nothing if empty
    """
    function pop_work!(queue::WorkerQueue)
        lock(queue.lock) do
            isempty(queue.stack) ? nothing : pop!(queue.stack)
        end
    end

    """
    Steal work from bottom of another worker's stack
    Returns nothing if empty
    """
    function steal_work!(queue::WorkerQueue)
        lock(queue.lock) do
            isempty(queue.stack) ? nothing : popfirst!(queue.stack)
        end
    end

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
    LIFO WORK-STEALING version of updateDiamondJoin

    Instead of recursively spawning tasks, pushes work items to LIFO queue.
    Workers process depth-first for cache locality.
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
        worker_queues::Union{Vector{WorkerQueue}, Nothing} = nothing,
        is_top_level::Bool = true
        )

        diamond_hash_key = DiamondProcessingModule.create_diamond_hash_key(diamond)

        if !haskey(computation_lookup, diamond_hash_key)
            error("Diamond not found in computation_lookup")
        end

        computation_data = computation_lookup[diamond_hash_key]

        sub_link_probability = Dict{Tuple{Int64, Int64}, Float64}()
        for edge in diamond.edgelist
            sub_link_probability[edge] = link_probability[edge]
        end

        sub_node_priors = Dict{Int64, Float64}()
        for node in diamond.relevant_nodes
            if node ∉ computation_data.sub_sources
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

        # If top-level and parallel, use work-stealing
        if is_top_level && num_states >= 2 && !isnothing(worker_queues) && Threads.nthreads() > 1
            # Create shared result accumulator
            result_acc = [0.0]
            result_lock = ReentrantLock()

            # Push all states as work items to first worker's queue
            my_queue = worker_queues[1]

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

                local_sub_node_priors = merge(sub_node_priors, conditioning_state)

                work_item = WorkItem(
                    diamond,
                    join_node,
                    conditioning_state,
                    state_probability,
                    local_sub_node_priors,
                    sub_link_probability,
                    computation_data,
                    result_acc
                )

                push_work!(my_queue, work_item)
            end

            # Start worker threads
            num_workers = Threads.nthreads()
            tasks = Vector{Task}(undef, num_workers)

            for worker_id in 1:num_workers
                tasks[worker_id] = Threads.@spawn process_worker(
                    worker_id,
                    worker_queues,
                    computation_lookup,
                    diamond_cache,
                    result_lock
                )
            end

            # Wait for all workers to complete
            for task in tasks
                wait(task)
            end

            return result_acc[1]
        else
            # Sequential fallback (for nested diamonds or single-threaded)
            final_belief = 0.0

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

                local_sub_node_priors = merge(sub_node_priors, conditioning_state)
                cache_key = make_cache_key(diamond.edgelist, local_sub_node_priors)

                local state_beliefs
                # Thread-safe cache access (sequential path can be called from workers)
                lock(diamond_cache_lock) do
                    if haskey(diamond_cache, cache_key)
                        cached_entry = diamond_cache[cache_key]
                        state_beliefs = cached_entry.state_beliefs
                    else
                        state_beliefs = nothing
                    end
                end

                if state_beliefs === nothing
                    state_beliefs = update_beliefs_iterative_sequential(
                        diamond.edgelist,
                        computation_data.sub_iteration_sets,
                        computation_data.sub_outgoing_index,
                        computation_data.sub_incoming_index,
                        computation_data.sub_sources,
                        local_sub_node_priors,
                        sub_link_probability,
                        computation_data.sub_descendants,
                        computation_data.sub_ancestors,
                        computation_data.sub_diamond_structures,
                        computation_data.sub_join_nodes,
                        computation_data.sub_fork_nodes,
                        computation_lookup,
                        diamond_cache
                    )

                    lock(diamond_cache_lock) do
                        if !haskey(diamond_cache, cache_key)
                            diamond_cache[cache_key] = DiamondCacheEntry(diamond.edgelist, local_sub_node_priors, state_beliefs)
                        end
                    end
                end

                join_belief = state_beliefs[join_node]
                final_belief += join_belief * state_probability
            end

            return final_belief
        end
    end

    """
    Worker thread processing loop - pops from own stack, steals if empty
    """
    function process_worker(
        worker_id::Int,
        worker_queues::Vector{WorkerQueue},
        computation_lookup::Dict{UInt64, DiamondComputationData{Float64}},
        diamond_cache::Dict{CacheKey, DiamondCacheEntry},
        result_lock::ReentrantLock
    )
        my_queue = worker_queues[worker_id]
        num_workers = length(worker_queues)

        while true
            # Try to get work from own queue (LIFO, depth-first)
            work = pop_work!(my_queue)

            # If no work, try stealing from random other worker
            if isnothing(work)
                attempts = 0
                while attempts < num_workers && isnothing(work)
                    victim_id = rand(1:num_workers)
                    if victim_id != worker_id
                        work = steal_work!(worker_queues[victim_id])
                    end
                    attempts += 1
                end

                # If still no work after checking all, we're done
                if isnothing(work)
                    break
                end
            end

            # Process work item
            process_work_item(work, my_queue, computation_lookup, diamond_cache, result_lock)
        end
    end

    """
    Process a single work item - check cache, compute if needed, push nested work
    """
    function process_work_item(
        item::WorkItem,
        my_queue::WorkerQueue,
        computation_lookup::Dict{UInt64, DiamondComputationData{Float64}},
        diamond_cache::Dict{CacheKey, DiamondCacheEntry},
        result_lock::ReentrantLock
    )
        cache_key = make_cache_key(item.diamond.edgelist, item.sub_node_priors)

        # Check cache (thread-safe)
        local state_beliefs
        lock(diamond_cache_lock) do
            if haskey(diamond_cache, cache_key)
                cached_entry = diamond_cache[cache_key]
                state_beliefs = cached_entry.state_beliefs
            else
                state_beliefs = nothing
            end
        end

        # Compute if not cached
        if state_beliefs === nothing
            state_beliefs = update_beliefs_iterative_sequential(
                item.diamond.edgelist,
                item.computation_data.sub_iteration_sets,
                item.computation_data.sub_outgoing_index,
                item.computation_data.sub_incoming_index,
                item.computation_data.sub_sources,
                item.sub_node_priors,
                item.sub_link_probability,
                item.computation_data.sub_descendants,
                item.computation_data.sub_ancestors,
                item.computation_data.sub_diamond_structures,
                item.computation_data.sub_join_nodes,
                item.computation_data.sub_fork_nodes,
                computation_lookup,
                diamond_cache
            )

            # Store in cache (thread-safe)
            lock(diamond_cache_lock) do
                if !haskey(diamond_cache, cache_key)
                    diamond_cache[cache_key] = DiamondCacheEntry(item.diamond.edgelist, item.sub_node_priors, state_beliefs)
                end
            end
        end

        # Accumulate result (thread-safe)
        join_belief = state_beliefs[item.join_node]
        contribution = join_belief * item.state_probability

        lock(result_lock) do
            item.result_accumulator[1] += contribution
        end
    end

    """
    Sequential belief propagation for nested diamonds (no work-stealing)
    """
    function update_beliefs_iterative_sequential(
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
        cache::Dict{CacheKey, DiamondCacheEntry}
    )
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
                        nothing,  # No worker queues for nested calls
                        false     # Not top-level
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

    """
    Main entry point - top-level belief propagation with work-stealing for diamonds
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
        cache::Dict{CacheKey, DiamondCacheEntry} = Dict{CacheKey, DiamondCacheEntry}()
    )
        validate_network_data(iteration_sets, outgoing_index, incoming_index, source_nodes, node_priors, link_probability)

        # Initialize worker queues if parallel
        worker_queues = if Threads.nthreads() > 1
            [WorkerQueue() for _ in 1:Threads.nthreads()]
        else
            nothing
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
                        worker_queues,
                        true  # Top-level call
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
        # This is called from sequential path, no work-stealing
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
                nothing,  # No worker queues
                false     # Not top-level
            )
        return diamond_beliefs
    end

end
