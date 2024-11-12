module MinimalCutSetsModule
    using Distributed
    using DataStructures: LRU
    using Combinatorics

    export find_minimal_cut_sets, ReachabilityCache

    """
    Thread-safe ReachabilityCache with immutable keys and statistics tracking
    """
    mutable struct ReachabilityCache
        cache::LRU{Tuple{Int64,Int64,Tuple{Vararg{Int64}}}, Bool}
        hits::Int64
        misses::Int64
        
        ReachabilityCache(maxsize::Int=10000) = new(
            LRU{Tuple{Int64,Int64,Tuple{Vararg{Int64}}}, Bool}(maxsize),
            0,
            0
        )
    end

    """
    Creates immutable cache key from source, target, and cut set
    """
    function make_cache_key(
        source::Int64, 
        target::Int64, 
        cut_set::Set{Int64}
    )::Tuple{Int64,Int64,Tuple{Vararg{Int64}}}
        cut_set_vec = sort!(collect(cut_set))
        return (source, target, Tuple(cut_set_vec))
    end

    """
    Worker function to process a batch of combinations
    """
    function process_combinations_batch(
        combinations_batch::Vector{Vector{Int64}},
        mandatory_nodes::Set{Int64},
        source_nodes::Set{Int64},
        target::Int64,
        outgoing_index::Dict{Int64,Set{Int64}},
        cache_size::Int
    )::Vector{Set{Int64}}
        local_cache = ReachabilityCache(cache_size)
        valid_cuts = Set{Int64}[]
        
        for comb in combinations_batch
            cut_set = union(Set(comb), mandatory_nodes)
            if is_valid_cut_set(cut_set, source_nodes, target, outgoing_index, local_cache)
                push!(valid_cuts, cut_set)
            end
        end
        
        return valid_cuts
    end

    """
    Main function to find minimal cut sets with optimized parallel processing
    """
    function find_minimal_cut_sets(
        target::Int64,
        source_nodes::Set{Int64},
        ancestors::Dict{Int64,Set{Int64}},
        descendants::Dict{Int64,Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}};
        cache_size::Int=10000,
        batch_size::Int=100
    )::Set{Set{Int64}}
        # Initial critical nodes identification
        critical_nodes = identify_critical_nodes(target, source_nodes, ancestors, descendants)
        critical_nodes_vec = collect(critical_nodes)

        # Find mandatory nodes using single worker
        local_cache = ReachabilityCache(cache_size)
        mandatory_nodes = find_mandatory_nodes(critical_nodes, source_nodes, target, outgoing_index, local_cache)
        
        if !isempty(mandatory_nodes)
            critical_nodes = setdiff(critical_nodes, mandatory_nodes)
            critical_nodes_vec = collect(critical_nodes)
            if is_valid_cut_set(mandatory_nodes, source_nodes, target, outgoing_index, local_cache)
                return Set([mandatory_nodes])
            end
        end

        minimal_cut_sets = Set{Set{Int64}}()
        min_cut_size = isempty(mandatory_nodes) ? 1 : 0
        max_cut_size = length(critical_nodes)

        # Progressive size search with chunked parallel processing
        while min_cut_size <= max_cut_size
            all_combinations = collect(combinations(critical_nodes_vec, min_cut_size))
            num_batches = max(1, ceil(Int, length(all_combinations) / batch_size))
            batches = [all_combinations[i:min(i+batch_size-1, end)] 
                      for i in 1:batch_size:length(all_combinations)]

            results = pmap(batch -> process_combinations_batch(
                batch, mandatory_nodes, source_nodes, target, 
                outgoing_index, cache_size ÷ nworkers()
            ), batches)

            batch_cut_sets = reduce(vcat, results, init=Set{Int64}[])
            
            if !isempty(batch_cut_sets)
                union!(minimal_cut_sets, batch_cut_sets)
                break
            end
            
            min_cut_size += 1
        end

        return minimal_cut_sets
    end

    """
    Identifies critical nodes that lie on paths from source nodes to the target
    """
    function identify_critical_nodes(
        target::Int64,
        source_nodes::Set{Int64},
        ancestors::Dict{Int64,Set{Int64}},
        descendants::Dict{Int64,Set{Int64}}
    )::Set{Int64}
        critical_nodes = Set{Int64}()
        target_ancestors = get(ancestors, target, Set{Int64}())
        
        for source in source_nodes
            source_descendants = get(descendants, source, Set{Int64}())
            if target ∈ source_descendants
                union!(critical_nodes, intersect(source_descendants, target_ancestors))
            end
        end
        
        return setdiff(critical_nodes, source_nodes, Set([target]))
    end

    """
    Finds nodes that must be in any cut set
    """
    function find_mandatory_nodes(
        critical_nodes::Set{Int64},
        source_nodes::Set{Int64},
        target::Int64,
        outgoing_index::Dict{Int64,Set{Int64}},
        cache::ReachabilityCache
    )::Set{Int64}
        mandatory_nodes = Set{Int64}()
        
        for node in critical_nodes
            all_paths_through_node = true
            node_set = Set([node])
            
            for source in source_nodes
                if cached_is_reachable(source, target, node_set, outgoing_index, cache)
                    all_paths_through_node = false
                    break
                end
            end
            
            if all_paths_through_node
                push!(mandatory_nodes, node)
            end
        end
        
        return mandatory_nodes
    end

    """
    Checks if a set of nodes forms a valid cut set
    """
    function is_valid_cut_set(
        cut_set::Set{Int64},
        source_nodes::Set{Int64},
        target::Int64,
        outgoing_index::Dict{Int64,Set{Int64}},
        cache::ReachabilityCache
    )::Bool
        # Early termination checks
        if !isempty(intersect(source_nodes, cut_set)) || target ∈ cut_set
            return true
        end
        
        for source in source_nodes
            if cached_is_reachable(source, target, cut_set, outgoing_index, cache)
                return false
            end
        end
        
        return true
    end

    """
    Cached reachability check with statistics tracking
    """
    function cached_is_reachable(
        source::Int64,
        target::Int64,
        cut_set::Set{Int64},
        outgoing_index::Dict{Int64,Set{Int64}},
        cache::ReachabilityCache
    )::Bool
        key = make_cache_key(source, target, cut_set)
        
        # Try to get from cache first
        cached_result = get(cache.cache, key, nothing)
        if cached_result !== nothing
            cache.hits += 1
            return cached_result
        end
        
        # Compute if not in cache
        cache.misses += 1
        result = is_reachable(source, target, cut_set, outgoing_index)
        cache.cache[key] = result
        return result
    end

    """
    Optimized reachability check using Vector as queue
    """
    function is_reachable(
        source::Int64,
        target::Int64,
        cut_set::Set{Int64},
        outgoing_index::Dict{Int64,Set{Int64}}
    )::Bool
        # Early termination checks
        source ∈ cut_set && return false
        source == target && return true
        
        # Pre-allocate visited set with expected size
        visited = Set{Int64}()
        sizehint!(visited, length(outgoing_index))
        
        # Use Vector as queue for better performance
        queue = Int64[]
        sizehint!(queue, length(outgoing_index))
        push!(queue, source)
        
        while !isempty(queue)
            node = popfirst!(queue)
            node == target && return true
            
            if node ∉ visited && node ∉ cut_set
                push!(visited, node)
                for neighbor in get(outgoing_index, node, Set{Int64}())
                    if neighbor ∉ visited && neighbor ∉ cut_set
                        push!(queue, neighbor)
                    end
                end
            end
        end
        
        return false
    end
end