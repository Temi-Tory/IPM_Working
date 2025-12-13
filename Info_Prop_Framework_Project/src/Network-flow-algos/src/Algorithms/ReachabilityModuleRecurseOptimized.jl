"""
    ReachabilityModuleOptimized

Exact belief propagation algorithm for DAG networks with diamond structures.

# Mathematical Foundation (see ReachabilityModuleRecurse_Maths.md for details)

This module computes exact beliefs using:
    P(N) = Prior(N) × P(N receives ≥1 signal from sources)

For nodes with multiple incoming paths, uses inclusion-exclusion principle:
    P(A ∪ B ∪ C) = Σᵢ P(Aᵢ) - Σᵢ<ⱼ P(Aᵢ ∩ Aⱼ) + Σᵢ<ⱼ<ₖ P(Aᵢ ∩ Aⱼ ∩ Aₖ) - ...

For diamonds (convergent path structures with conditioning nodes), uses conditional expectation:
    Result = Σ_{states} P(state) × P(Join | state)
where P(state) = ∏ᵢ [Belief(cᵢ)]^{bit_i} × [1-Belief(cᵢ)]^{1-bit_i}

For nested diamonds, implements nested conditional expectation:
    E[E[...E[Belief(Outer_Join) | Inner_Layer] ... | Outer_Layer]]

# Key Implementation Features

1. **Thread-Safe Parallelism**: Uses Threads.@spawn for parallel state enumeration
   - Each diamond state is mathematically independent
   - Thread-local copies prevent race conditions (copy() at lines 410, 495)

2. **Contextual Belief Mechanism**: Critical for nested diamonds
   - Non-conditioning source nodes in diamond subgraphs receive contextual beliefs
     from outer computation (line 364: sub_node_priors[node] = belief_dict[node])
   - This makes each diamond computation dependent on outer context
   - Results in low cache hit rate but maintains exactness

3. **Recursive Processing**: Line 434/511 - recursive call to update_beliefs_iterative
   - Each diamond spawns complete belief propagation on its subgraph
   - Nested diamonds create call stack 50+ levels deep for complex networks
   - This is the source of thread overhead (95% overhead, 5% compute)

4. **Optimizations**:
   - Pre-computed diamond structures (computation_lookup) - O(1) retrieval
   - Bit-masking for state enumeration (no Combinatorics library)
   - Stream hashing for cache keys (no intermediate arrays)
   - Diamond result caching (though low hit rate due to contextual beliefs)

# Performance Characteristics

Current baseline (HB0_local_1 network): ~45 seconds
- Profile shows: 95% thread spawn/destroy overhead, ~5% actual computation (~2.3s)
- Bottleneck: Recursive task spawning (2^n states × 50 nesting levels = massive overhead)
- Cache hit rate: Low (~10-20%) because contextual beliefs vary by outer state

# Correctness Requirements

1. **Topological Order**: iteration_sets defines processing order (dependencies satisfied)
2. **Determinism**: All parallel operations use independent data (thread-local copies)
3. **Exactness**: No approximation - enumerates ALL 2^n conditioning states
4. **Contextual Beliefs**: sub_node_priors must include belief_dict values for non-conditioning sources
"""
module ReachabilityModuleOptimized

    # using Combinatorics  # REMOVED - using bit-masking instead for performance
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

    """
        DiamondCacheEntry

    Stores the result of a diamond computation for potential reuse.

    # Why Cache Hit Rate Is Low

    The cache key includes BOTH the diamond structure (edgelist) AND the contextual beliefs
    (current_priors). This is necessary because:

    1. The same diamond structure can produce different results depending on contextual beliefs
    2. Contextual beliefs come from the outer computation's belief_dict
    3. Different outer diamond states → different belief_dict values → different context
    4. Therefore, same diamond + different context = different result = different cache entry

    Example:
        Diamond D₁ nested in Diamond D₂
        D₂ has 2 conditioning nodes (4 states)
        Each of the 4 states produces different belief_dict values
        Therefore D₁ must be computed 4 times with 4 different contexts
        Result: 4 different cache entries for the same diamond structure

    # Fields
    - `edgelist`: The diamond's edge structure (what defines the diamond)
    - `current_priors`: The contextual beliefs used for this computation (the context)
    - `state_beliefs`: The computed results (belief for each node in diamond)
    """
    struct DiamondCacheEntry
        edgelist::Vector{Tuple{Int64,Int64}}
        current_priors::Dict{Int64,Float64}
        state_beliefs::Dict{Int64,Float64}
    end

    """
        CacheKey

    Compact hash-based key for diamond cache lookups.

    Uses hashes instead of full data structures for fast equality checks and Dict indexing.

    # Fields
    - `diamond_hash`: Hash of the sorted edgelist (identifies diamond structure)
    - `priors_hash`: Hash of ALL current_priors including contextual beliefs (identifies context)

    # Why Both Hashes Are Needed

    diamond_hash alone is insufficient because the same diamond structure can produce
    different results with different contextual beliefs. Must hash BOTH structure AND context.
    """
    struct CacheKey
        diamond_hash::UInt64          # Hash of edgelist
        priors_hash::UInt64      # Hash of ALL current_priors, not just conditioning_state
    end

    Base.hash(k::CacheKey, h::UInt) = hash((k.diamond_hash, k.priors_hash), h)
    Base.:(==)(a::CacheKey, b::CacheKey) = a.diamond_hash == b.diamond_hash && a.priors_hash == b.priors_hash

    """
        make_cache_key(edgelist, current_priors) -> CacheKey

    Creates cache key using stream hashing for performance.

    # Optimization: Stream Hashing

    Instead of creating intermediate arrays and hashing them:
        priors_array = [(node, value) for (node, value) in current_priors]
        priors_hash = hash(sort(priors_array))

    We stream hash directly:
        priors_hash = 0
        for node in sorted_nodes
            priors_hash = hash((node, value), priors_hash)
        end

    This avoids allocation of intermediate arrays, reducing memory pressure and GC overhead.
    """
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

    """
        update_beliefs_iterative(edgelist, iteration_sets, outgoing_index, incoming_index,
                                  source_nodes, node_priors, link_probability, descendants,
                                  ancestors, diamond_structures, join_nodes, fork_nodes,
                                  computation_lookup, [cache]) -> Dict{Int64, Float64}

    Main belief propagation function. Computes exact beliefs for all nodes in the network.

    # Mathematical Operation

    For each node N, computes:
        Belief(N) = Prior(N) × P(N receives ≥1 signal from sources)

    Where P(N receives ≥1 signal) is computed using:
    - **Regular paths**: Inclusion-exclusion over parent paths
    - **Diamond paths**: Conditional expectation over conditioning node states

    # Processing Flow

    1. **Topological Order** (Lines 243-319):
       - Process nodes in iteration_sets order (guarantees dependencies satisfied)
       - For each node, all parent beliefs must be computed first

    2. **Source Nodes** (Lines 246-248):
       - Belief = Prior (no incoming information)

    3. **Regular Nodes** (Lines 292-307):
       - Collect beliefs from all parent paths
       - Apply inclusion-exclusion if multiple paths exist
       - Multiply by prior: Belief = Prior × P(signal received)

    4. **Diamond Join Nodes** (Lines 254-289):
       - Call updateDiamondJoin for each diamond group
       - Enumerates all 2^n conditioning states
       - For each state, RECURSIVELY computes beliefs on diamond subgraph
       - Weighted sum: Σ P(state) × P(Join | state)

    # Recursive Nature - THE KEY POINT

    This function is RECURSIVE. When processing a diamond join node:
    1. Line 258 calls updateDiamondJoin
    2. updateDiamondJoin enumerates conditioning states
    3. For each state, Line 502/579 calls update_beliefs_iterative AGAIN on the diamond subgraph
    4. If that subgraph contains nested diamonds, the recursion continues

    For HB0_local_1 network:
    - 50+ levels of diamond nesting
    - ~2 conditioning nodes per level (4 states per diamond)
    - Creates deep call stack (50+ levels)
    - Spawns thousands of parallel tasks
    - Result: 95% thread overhead, 5% actual computation

    # Thread Safety

    Parallel execution (Threads.@spawn) maintains correctness through:
    - **Independent data**: Each task uses thread-local copy (copy() at Lines 478/563)
    - **Locked cache**: diamond_cache_lock protects shared cache Dict
    - **No shared mutation**: Each task writes to its own local variables

    # Parameters

    - `edgelist`: All edges in the (sub)graph being processed
    - `iteration_sets`: Topological order of nodes (dependencies satisfied)
    - `outgoing_index`: Map node → children
    - `incoming_index`: Map node → parents
    - `source_nodes`: Nodes with no incoming edges (fresh sources in this subgraph)
    - `node_priors`: Prior probabilities for all nodes
    - `link_probability`: Edge transmission probabilities
    - `descendants`: Map node → all downstream nodes
    - `ancestors`: Map node → all upstream nodes
    - `diamond_structures`: Pre-identified diamond groups at each join node
    - `join_nodes`: Nodes with multiple incoming paths
    - `fork_nodes`: Nodes with multiple outgoing paths
    - `computation_lookup`: Pre-computed diamond subgraph data (O(1) retrieval)
    - `cache`: Optional cache for diamond computations (shared across recursive calls)

    # Returns

    Dict{Int64, Float64} mapping each node to its computed belief value

    # See Also

    - ReachabilityModuleRecurse_Maths.md for detailed mathematical derivations
    - updateDiamondJoin for diamond-specific processing
    - DiamondProcessingModule for pre-computed diamond structures
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

    """
        calculate_regular_belief(parents, node, belief_dict, link_probability) -> Vector{Float64}

    Computes belief contributions from regular (non-diamond) parent nodes.

    # Mathematical Operation

    For each parent p of node n:
        Contribution = Belief(p) × P(edge p→n transmits signal)

    Returns vector of contributions (one per parent).

    # Why Return a Vector?

    Different parents may represent different independent paths to the node.
    The caller decides how to combine these contributions:

    1. **Simple tree paths**: Just sum the contributions
       ```julia
       total = sum(contributions)
       ```

    2. **Multiple paths from sources** (convergent structure): Use inclusion-exclusion
       ```julia
       total = inclusion_exclusion(contributions)
       ```

    This separation allows correct handling of path independence vs. convergence.

    # Example

    Node 10 has parents [7, 8, 9]
    - Belief(7) = 0.8, P(7→10) = 0.9 → Contribution = 0.72
    - Belief(8) = 0.6, P(8→10) = 0.7 → Contribution = 0.42
    - Belief(9) = 0.9, P(9→10) = 0.8 → Contribution = 0.72

    Returns: [0.72, 0.42, 0.72]

    If these are independent tree paths: sum = 1.86 (will be clamped to ≤1.0)
    If convergent paths: use inclusion_exclusion for proper P(signal from any path)

    # Parameters

    - `parents`: Set of parent node IDs
    - `node`: The node receiving signals
    - `belief_dict`: Current beliefs (must contain all parents)
    - `link_probability`: Edge transmission probabilities

    # Returns

    Vector{Float64}: One contribution value per parent

    # Errors

    Throws ErrorException if:
    - A parent's belief is not in belief_dict (processing order violation)
    - An edge probability is missing (data validation failure)
    """
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

    """
        inclusion_exclusion(belief_values) -> Float64

    Computes P(A₁ ∪ A₂ ∪ ... ∪ Aₙ) using the inclusion-exclusion principle.

    # Mathematical Formula

    P(A₁ ∪ A₂ ∪ ... ∪ Aₙ) = Σᵢ P(Aᵢ) - Σᵢ<ⱼ P(Aᵢ ∩ Aⱼ) + Σᵢ<ⱼ<ₖ P(Aᵢ ∩ Aⱼ ∩ Aₖ) - ... + (-1)^{n+1} P(A₁ ∩ ... ∩ Aₙ)

    For independent events: P(Aᵢ ∩ Aⱼ) = P(Aᵢ) × P(Aⱼ)

    # Implementation: Bit-Masking for Efficiency

    Instead of using Combinatorics.combinations which allocates arrays:
    ```julia
    for k in 1:n
        for subset in combinations(1:n, k)
            # Process subset
        end
    end
    ```

    We use bit masks to enumerate all 2^n - 1 non-empty subsets:
    ```julia
    for mask in 1:(2^n - 1)
        subset_size = count_ones(mask)
        # Bit i set → include belief_values[i]
    end
    ```

    This avoids allocation overhead and is faster for small n (typical: n ≤ 10).

    # Example

    belief_values = [0.8, 0.6, 0.7]  # Three independent paths

    Computes:
      P(signal) = P(A₁) + P(A₂) + P(A₃)
                - P(A₁∩A₂) - P(A₁∩A₃) - P(A₂∩A₃)
                + P(A₁∩A₂∩A₃)
                = 0.8 + 0.6 + 0.7
                - (0.8×0.6) - (0.8×0.7) - (0.6×0.7)
                + (0.8×0.6×0.7)
                = 0.976

    # Bit Mask Enumeration

    For n=3:
    - mask=1 (001): Include A₁ only → add 0.8
    - mask=2 (010): Include A₂ only → add 0.6
    - mask=3 (011): Include A₁,A₂ → subtract 0.48
    - mask=4 (100): Include A₃ only → add 0.7
    - mask=5 (101): Include A₁,A₃ → subtract 0.56
    - mask=6 (110): Include A₂,A₃ → subtract 0.42
    - mask=7 (111): Include A₁,A₂,A₃ → add 0.336

    # Complexity

    Time: O(2^n × n) where n = length(belief_values)
    Space: O(1) - no allocations

    For typical use (n ≤ 5): negligible overhead
    For large n (n > 15): becomes expensive (exponential growth)

    # See Also

    - ReachabilityModuleRecurse_Maths.md for derivation
    - Used in update_beliefs_iterative for join nodes with multiple parent paths
    """
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

    """
        updateDiamondJoin(conditioning_nodes, join_node, diamond, link_probability,
                          node_priors, belief_dict, ancestors, descendants, iteration_sets,
                          computation_lookup, diamond_cache) -> Float64

    Computes belief for a diamond join node using conditional expectation over conditioning states.

    # Mathematical Operation

    Implements: Result = Σ_{s=0}^{2ⁿ-1} P(state_s) × Belief(Join | state_s)

    Where:
    - n = number of conditioning nodes
    - P(state_s) = ∏ᵢ [Belief(cᵢ)]^{bit_i} × [1-Belief(cᵢ)]^{1-bit_i}
    - Belief(Join | state_s) computed by recursive call to update_beliefs_iterative

    # The Contextual Belief Mechanism - CRITICAL FOR CORRECTNESS

    ## Why We Need Contextual Beliefs

    Consider this nested diamond structure:
        Sources S₁, S₂
        ↓
        Conditioning nodes C₁, C₂ (outer diamond)
        ↓
        Inner diamond with sources I₁, I₂ and conditioning nodes IC₁, IC₂
        ↓
        Join node J

    When computing J's belief:
    1. Outer diamond enumerates C₁, C₂ states (4 combinations)
    2. For each state, must compute inner diamond
    3. Inner diamond's sources I₁, I₂ depend on C₁, C₂ states
    4. Therefore: I₁'s belief varies based on which outer state we're in

    ## Implementation (Lines 422-436)

    ```julia
    # Build sub_node_priors with contextual beliefs
    for node in diamond.relevant_nodes
        if node ∉ fresh_sources
            sub_node_priors[node] = node_priors[node]  # Original prior
        elseif node ∉ conditioning_nodes
            sub_node_priors[node] = belief_dict[node]  # ← CONTEXTUAL BELIEF!
        elseif node ∈ conditioning_nodes
            sub_node_priors[node] = 1.0  # Will be set to 0 or 1 based on state
        end
    end
    ```

    The line `sub_node_priors[node] = belief_dict[node]` is CRITICAL:
    - `node` is a fresh source in the diamond subgraph
    - But `node` is NOT a conditioning node
    - Therefore `node` has already been computed in the outer belief propagation
    - Its belief depends on the current state of outer conditioning nodes
    - We pass this contextual belief into the recursive computation

    ## Why This Causes Low Cache Hit Rate

    Example:
        Outer diamond: 2 conditioning nodes → 4 states
        Each state produces different belief_dict values for inner sources
        Therefore: Same inner diamond structure, 4 different contexts
        Result: Inner diamond computed 4 times, creating 4 different cache entries

    The cache key includes BOTH:
    - diamond.edgelist (structure)
    - current_priors (context including contextual beliefs)

    This is necessary because: same structure + different context = different result

    # Parallel Execution

    Each of the 2^n conditioning states is mathematically independent:
    - Different state → different sub_node_priors
    - Each state computation uses thread-local copy (Lines 478/563)
    - No shared mutation except locked cache access
    - Results summed via reduction (Lines 538-541)

    # Recursion Point - WHERE THE OVERHEAD COMES FROM

    Lines 502/579: `state_beliefs = update_beliefs_iterative(...)`

    This is THE recursion point. For each conditioning state:
    1. Create local_sub_node_priors with contextual beliefs
    2. Call update_beliefs_iterative RECURSIVELY on diamond subgraph
    3. If subgraph has nested diamonds, recursion continues deeper
    4. Creates call stack 50+ levels deep for HB0_local_1
    5. With parallel execution, spawns thousands of tasks

    Threading overhead breakdown:
    - Task creation/scheduling
    - Context switching
    - Thread-local allocation (copy())
    - Lock contention (cache access)
    - Result: 95% overhead, 5% actual math

    # Parameters

    - `conditioning_nodes`: Nodes whose states we enumerate
    - `join_node`: The diamond's convergence point
    - `diamond`: Diamond structure with edgelist, relevant_nodes, etc.
    - `link_probability`: Edge probabilities
    - `node_priors`: Original priors for all nodes
    - `belief_dict`: Current beliefs from outer computation (source of contextual beliefs)
    - `ancestors`, `descendants`: Graph structure
    - `iteration_sets`: Topological order
    - `computation_lookup`: Pre-computed diamond data (O(1) retrieval)
    - `diamond_cache`: Shared cache across all recursive calls

    # Returns

    Float64: The weighted sum Σ P(state) × Belief(Join | state)

    # See Also

    - ReachabilityModuleRecurse_Maths.md Case 3 (single diamond) and Case 4 (nested)
    - Lines 422-436: Contextual belief assignment
    - Lines 502/579: Recursive call (the bottleneck)
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
        # This isolates the diamond subgraph's probability structure
        sub_link_probability = Dict{Tuple{Int64, Int64}, Float64}()
        for edge in diamond.edgelist
            sub_link_probability[edge] = link_probability[edge]
        end

        # ============================================================================
        # CRITICAL SECTION: Building sub_node_priors with Contextual Beliefs
        # ============================================================================
        # This is WHERE and WHY contextual beliefs are assigned
        # Understanding this is ESSENTIAL to understanding the entire algorithm

        # Create sub_node_priors for the diamond nodes
        sub_node_priors = Dict{Int64, Float64}()

        for node in diamond.relevant_nodes
            # Case 1: Non-source nodes within the diamond
            # These nodes are "internal" to the diamond - not entry points
            if node ∉ fresh_sources
                # Use original prior - no external belief information yet
                sub_node_priors[node] = node_priors[node]

                if node == join_node
                    # Special case: Join node prior set to 1.0
                    # This is because we're computing P(Join receives signal | context)
                    # The prior is factored out in the final multiplication
                    sub_node_priors[node] = 1.0
                end

            # Case 2: Fresh sources that are NOT conditioning nodes
            # *** THIS IS THE CONTEXTUAL BELIEF MECHANISM ***
            elseif node ∉ conditioning_nodes
                # This node is:
                # - A fresh source in the diamond subgraph (entry point)
                # - NOT a conditioning node (not being enumerated)
                # - Therefore: already computed in outer belief propagation
                #
                # CRITICAL LINE: Use contextual belief from outer computation
                sub_node_priors[node] = belief_dict[node]
                #
                # WHY THIS MATTERS:
                # - belief_dict[node] was computed in the outer context
                # - Its value depends on outer conditioning nodes' states
                # - Different outer states → different belief_dict[node] values
                # - Therefore: Same diamond, different contexts → different results
                # - This is why cache hit rate is low (context varies)
                #
                # EXAMPLE:
                #   Outer diamond has C₁, C₂ in state (1,0)
                #   → belief_dict computes this node has belief 0.7
                #   Inner diamond uses 0.7 as "prior" for this entry point
                #
                #   If outer state changes to (0,1)
                #   → belief_dict recomputes this node as belief 0.3
                #   Inner diamond must recompute with 0.3
                #
                # This maintains EXACTNESS of nested conditional expectation:
                # E[E[Belief | Inner] | Outer] requires conditioning on Outer state

            # Case 3: Conditioning nodes
            # These are the nodes we're enumerating states for
            elseif node ∈ conditioning_nodes
                # Set to 1.0 temporarily
                # Will be overwritten to 0.0 or 1.0 in state enumeration loop
                # (Lines 465-476 or 543-554)
                sub_node_priors[node] = 1.0
            end
        end

        # After this loop:
        # - Internal nodes have original priors
        # - Non-conditioning sources have contextual beliefs from outer computation
        # - Conditioning nodes set to 1.0 (will be fixed to 0/1 per state)
        # ============================================================================

        # NEW: Use multi-conditioning approach
        conditioning_nodes_list = collect(unique(conditioning_nodes))


        # ============================================================================
        # STATE ENUMERATION: Compute Σ_{states} P(state) × P(Join | state)
        # ============================================================================

        # Generate all possible states of conditioning nodes (0 or 1)
        final_belief = 0.0

        # MATHEMATICAL INDEPENDENCE OF STATES:
        # Each conditioning state is mathematically independent - different states cannot
        # interfere with each other's computation. This allows safe parallelization.
        #
        # Formula: Result = Σ P(state) × P(Join | state)
        # Each term in the sum is independent - can compute in parallel and sum results
        num_states = 2^length(conditioning_nodes_list)

        # Parallelization decision:
        # - Even small diamonds (n=1 → 2 states) can benefit from parallelism
        # - Real benefit comes from RECURSIVE parallelism in nested diamonds
        # - Outer diamond spawns tasks, each task's inner diamonds spawn more tasks
        # - This creates exponential task spawning (the source of 95% overhead)
        use_parallel = num_states >= 2 && Threads.nthreads() > 1

        if use_parallel
            # ========================================================================
            # PARALLEL EXECUTION PATH
            # ========================================================================
            # Each task computes ONE conditioning state independently
            # Tasks spawned via Threads.@spawn for automatic load balancing

            tasks = Vector{Task}(undef, num_states)

            for state_idx in 0:(num_states - 1)
                # Spawn parallel task for this state
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

                    # ================================================================
                    # THREAD SAFETY: Copy to avoid race conditions
                    # ================================================================
                    # CRITICAL: Create thread-local copy of sub_node_priors
                    # Without this copy, parallel tasks would mutate shared dictionary
                    # causing non-deterministic race conditions
                    local_sub_node_priors = copy(sub_node_priors)

                    # Apply this specific conditioning state to the local copy
                    # This fixes conditioning nodes to 0.0 or 1.0 based on state_idx
                    for (node, value) in conditioning_state
                        local_sub_node_priors[node] = value
                    end

                    # Generate cache key using local copy
                    # Key includes BOTH structure (edgelist) AND context (local_sub_node_priors)
                    cache_key = make_cache_key(diamond.edgelist, local_sub_node_priors)

                    # ================================================================
                    # CACHE LOOKUP: Check if we've computed this exact context before
                    # ================================================================
                    # Thread-safe cache access (need lock for shared Dict)
                    local state_beliefs
                    lock(diamond_cache_lock) do
                        if haskey(diamond_cache, cache_key)
                            # Use cached result - avoids expensive recomputation
                            cached_entry = diamond_cache[cache_key]
                            state_beliefs = cached_entry.state_beliefs
                        else
                            state_beliefs = nothing  # Cache miss
                        end
                    end

                    # ================================================================
                    # RECURSIVE CALL - THE BOTTLENECK AND SOURCE OF OVERHEAD
                    # ================================================================
                    # Compute if not cached (this is the expensive part - do outside lock)
                    if state_beliefs === nothing
                        # *** THIS IS THE RECURSION POINT ***
                        # This line is WHERE the algorithm becomes recursive
                        #
                        # What happens here:
                        # 1. We call update_beliefs_iterative on the diamond SUBGRAPH
                        # 2. That function processes nodes in sub_iteration_sets order
                        # 3. If the subgraph contains nested diamonds, it calls updateDiamondJoin
                        # 4. Which calls update_beliefs_iterative AGAIN (deeper recursion)
                        # 5. Process repeats for 50+ nesting levels in HB0_local_1
                        #
                        # Threading overhead:
                        # - Each state spawns a new task (Threads.@spawn at line 780)
                        # - With 2 conditioning nodes: 4 tasks per diamond
                        # - With 50 levels: 4^50 potential tasks (pruned by cache, but still massive)
                        # - Task creation/scheduling dominates runtime (95% overhead)
                        # - Actual mathematical computation: only ~5% (~2.3s out of 45s)
                        #
                        # Contextual beliefs:
                        # - local_sub_node_priors contains belief_dict values (Line 706)
                        # - These vary based on outer conditioning states
                        # - Same diamond structure + different context = different result
                        # - Must recompute for each unique context (low cache hit rate)

                        state_beliefs = update_beliefs_iterative(
                            diamond.edgelist,              # Subgraph structure
                            sub_iteration_sets,            # Topological order within subgraph
                            sub_outgoing_index,            # Subgraph connectivity
                            sub_incoming_index,
                            fresh_sources,                 # Sources within subgraph
                            local_sub_node_priors,         # ← Contains contextual beliefs!
                            sub_link_probability,          # Subgraph edge probabilities
                            sub_descendants,               # Subgraph reachability
                            sub_ancestors,
                            sub_diamond_structures,        # Nested diamonds (recursion continues)
                            sub_join_nodes,
                            sub_fork_nodes,
                            computation_lookup,            # Shared pre-computed data
                            diamond_cache                  # Shared cache (all recursion levels)
                        )
                        # ← When this returns, we've computed beliefs for entire subgraph
                        #   including all nested diamonds recursively

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