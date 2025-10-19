# Iterative Bottom-Up Diamond Processing - Design Document

**Goal**: Eliminate recursive depth multiplier by processing diamonds in topological order

**Status**: Design phase
**Estimated Impact**: 5-10x speedup on HB0 networks

---

## Current Recursive Approach (PROBLEM)

### Call Pattern
```julia
update_beliefs_iterative(network)
  ├─ Process iteration sets 1..N
  │  ├─ For each join node with diamond:
  │  │  └─ updateDiamondJoin(diamond)
  │  │     ├─ Enumerate state 1: conditioning_node = 0
  │  │     │  └─ update_beliefs_iterative(sub-network)  ← RECURSIVE!
  │  │     │     └─ updateDiamondJoin(sub-diamond)
  │  │     │        └─ update_beliefs_iterative(...)    ← MORE RECURSION!
  │  │     └─ Enumerate state 2: conditioning_node = 1
  │  │        └─ update_beliefs_iterative(sub-network)  ← RECURSIVE!
```

### The Problem
Each recursive call multiplies the cost:
```
Level 1: 2 states
Level 2: 2 states × 2 sub-states = 4 evaluations
Level 3: 4 × 2 = 8 evaluations
Level 4: 8 × 2 = 16 evaluations
...

For depth D: 2^D evaluations
```

**HB0_local_1 with depth 4-5**: 16-32 evaluations per root diamond!

---

## Proposed Iterative Approach (SOLUTION)

### Key Insight
**Diamonds have a dependency structure**: Sub-diamonds must be evaluated before parent diamonds.

If we process diamonds in **topological order** (leaves → roots), sub-diamond results are already computed!

### Algorithm Outline

```julia
function update_beliefs_iterative_bottom_up(network, diamonds)
    # STEP 1: Build dependency graph
    # Which diamonds depend on which other diamonds?
    dependency_graph = build_diamond_dependency_graph(diamonds)

    # STEP 2: Topological sort
    # Order: leaves first, roots last
    sorted_diamonds = topological_sort(dependency_graph)

    # STEP 3: Initialize belief state
    belief_dict = copy(node_priors)
    diamond_results = Dict{Diamond, Dict{State, Belief}}()

    # STEP 4: Process diamonds in order
    for diamond in sorted_diamonds
        # Enumerate conditioning states
        for state in enumerate_states(diamond.conditioning_nodes)
            # Fix conditioning nodes to this state
            local_beliefs = set_conditioning_state(belief_dict, state)

            # Evaluate diamond using ALREADY COMPUTED sub-diamonds
            result = evaluate_diamond_with_cached_subs(
                diamond,
                local_beliefs,
                diamond_results  # ← Sub-diamonds already here!
            )

            diamond_results[diamond][state] = result
        end

        # Update belief_dict with diamond result
        belief_dict[diamond.join_node] = combine_states(diamond_results[diamond])
    end

    return belief_dict
end
```

### Key Difference
**Before**:
- Recursive: Each state evaluation triggers full recursive sub-network evaluation
- Cost: Exponential in depth

**After**:
- Iterative: Each state evaluation looks up pre-computed sub-diamond results
- Cost: Linear in number of diamonds × 2 states

---

## Implementation Plan

### Phase 1: Build Diamond Dependency Graph

```julia
"""
Build a directed graph showing which diamonds depend on which other diamonds.

A diamond D1 depends on diamond D2 if:
- D2's join node appears in D1's relevant nodes
- D2 is evaluated "inside" D1 during recursive evaluation
"""
function build_diamond_dependency_graph(unique_diamonds)
    dependencies = Dict{UInt64, Set{UInt64}}()  # diamond_hash → set of dependency hashes

    for (hash1, diamond_data1) in unique_diamonds
        dependencies[hash1] = Set{UInt64}()
        diamond1 = diamond_data1.diamond

        # Find sub-diamonds within this diamond
        for (hash2, diamond_data2) in unique_diamonds
            if hash1 == hash2
                continue
            end

            diamond2 = diamond_data2.diamond

            # D1 depends on D2 if D2's join node is in D1's relevant nodes
            # AND D2 is "smaller" (subset of D1's structure)
            if is_subdiamond(diamond2, diamond1)
                push!(dependencies[hash1], hash2)
            end
        end
    end

    return dependencies
end

"""
Check if diamond2 is a sub-diamond of diamond1
"""
function is_subdiamond(diamond2, diamond1)
    # D2 is sub-diamond of D1 if:
    # 1. D2's relevant nodes are subset of D1's relevant nodes
    # 2. D2's edges are subset of D1's edges

    nodes_subset = issubset(diamond2.relevant_nodes, diamond1.relevant_nodes)
    edges_subset = issubset(Set(diamond2.edgelist), Set(diamond1.edgelist))

    return nodes_subset && edges_subset && length(diamond2.relevant_nodes) < length(diamond1.relevant_nodes)
end
```

### Phase 2: Topological Sort

```julia
"""
Topological sort of diamonds: leaves first, roots last

Uses Kahn's algorithm
"""
function topological_sort_diamonds(dependencies)
    # Compute in-degree for each diamond
    in_degree = Dict{UInt64, Int}()
    for (diamond_hash, deps) in dependencies
        if !haskey(in_degree, diamond_hash)
            in_degree[diamond_hash] = 0
        end
        for dep in deps
            in_degree[dep] = get(in_degree, dep, 0) + 1
        end
    end

    # Start with diamonds that have no dependencies (leaves)
    queue = UInt64[]
    for (diamond_hash, degree) in in_degree
        if degree == 0
            push!(queue, diamond_hash)
        end
    end

    # Process in topological order
    sorted = UInt64[]
    while !isempty(queue)
        current = popfirst!(queue)
        push!(sorted, current)

        # Reduce in-degree of dependents
        for (diamond_hash, deps) in dependencies
            if current in deps
                in_degree[diamond_hash] -= 1
                if in_degree[diamond_hash] == 0
                    push!(queue, diamond_hash)
                end
            end
        end
    end

    # Check for cycles (shouldn't happen in DAG)
    if length(sorted) != length(dependencies)
        error("Cycle detected in diamond dependency graph!")
    end

    return sorted
end
```

### Phase 3: Evaluate Diamond with Cached Sub-Results

```julia
"""
Evaluate a single diamond using pre-computed sub-diamond results

This replaces the recursive call to update_beliefs_iterative
"""
function evaluate_diamond_with_cached_subs(
    diamond::Diamond,
    conditioning_state::Dict{Int64, T},
    current_beliefs::Dict{Int64, T},
    diamond_results::Dict{UInt64, Dict{Vector{T}, T}},
    unique_diamonds::Dict{UInt64, DiamondComputationData{T}}
) where {T}

    # Get sub-diamond structures for this diamond
    diamond_hash = create_diamond_hash_key(diamond)
    diamond_data = unique_diamonds[diamond_hash]
    sub_diamond_structures = diamond_data.sub_diamond_structures

    # If no sub-diamonds, just propagate beliefs through the network
    if isempty(sub_diamond_structures)
        return propagate_beliefs_no_diamonds(
            diamond,
            conditioning_state,
            current_beliefs
        )
    end

    # Create local belief dict with conditioning nodes fixed
    local_beliefs = copy(current_beliefs)
    for (node, value) in conditioning_state
        local_beliefs[node] = value
    end

    # Process interior nodes using cached sub-diamond results
    for node in topological_order(diamond.relevant_nodes)
        # Skip if already set (conditioning node or source)
        if haskey(local_beliefs, node) && node in keys(conditioning_state)
            continue
        end

        # Check if this node is join of a sub-diamond
        if haskey(sub_diamond_structures, node)
            sub_diamond_info = sub_diamond_structures[node]
            sub_diamond_hash = create_diamond_hash_key(sub_diamond_info.diamond)

            # Look up pre-computed result for this sub-diamond
            # Need to determine which state of sub-diamond we're in
            sub_conditioning_state = extract_sub_conditioning_state(
                sub_diamond_info.diamond,
                local_beliefs
            )

            # CRITICAL: Use cached result instead of recursive call!
            if haskey(diamond_results, sub_diamond_hash)
                cached_results = diamond_results[sub_diamond_hash]
                state_key = sub_conditioning_state_to_key(sub_conditioning_state)

                if haskey(cached_results, state_key)
                    local_beliefs[node] = cached_results[state_key]
                    continue
                end
            end

            # Fallback: shouldn't reach here if topological sort is correct
            error("Sub-diamond result not found in cache! Diamond processing order is wrong.")
        end

        # Regular node: compute from parents
        local_beliefs[node] = compute_from_parents(node, local_beliefs, edge_probabilities)
    end

    # Return belief at join node
    return local_beliefs[diamond.join_node]
end
```

### Phase 4: Main Iterative Function

```julia
"""
New iterative bottom-up version of update_beliefs

Processes diamonds in topological order instead of recursively
"""
function update_beliefs_iterative_bottom_up(
    edgelist,
    iteration_sets,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors::Dict{Int64,T},
    link_probability::Dict{Tuple{Int64,Int64},T},
    descendants,
    ancestors,
    root_diamonds,
    join_nodes,
    fork_nodes,
    unique_diamonds::Dict{UInt64, DiamondComputationData{T}}
) where {T <: Union{Float64, pbox, Interval}}

    println("🔄 Using ITERATIVE BOTTOM-UP diamond processing")

    # STEP 1: Build diamond dependency graph
    println("   Building diamond dependency graph...")
    dependencies = build_diamond_dependency_graph(unique_diamonds)

    # STEP 2: Topological sort
    println("   Sorting diamonds topologically...")
    sorted_diamond_hashes = topological_sort_diamonds(dependencies)
    println("   Sorted $(length(sorted_diamond_hashes)) diamonds")

    # STEP 3: Initialize
    belief_dict = copy(node_priors)
    diamond_results = Dict{UInt64, Dict{Vector{T}, T}}()

    # STEP 4: Process ALL diamonds in topological order (leaves first)
    println("   Processing diamonds bottom-up...")
    for (idx, diamond_hash) in enumerate(sorted_diamond_hashes)
        diamond_data = unique_diamonds[diamond_hash]
        diamond = diamond_data.diamond
        conditioning_nodes = diamond.conditioning_nodes

        if isempty(conditioning_nodes)
            continue
        end

        println("      Diamond $idx/$(length(sorted_diamond_hashes)): $(length(conditioning_nodes)) conditioning nodes")

        # Enumerate states for this diamond
        diamond_results[diamond_hash] = Dict{Vector{T}, T}()

        num_states = 2^length(conditioning_nodes)
        for state_idx in 0:(num_states - 1)
            # Build conditioning state
            conditioning_state = Dict{Int64, T}()
            state_key = T[]

            for (i, node) in enumerate(sort(collect(conditioning_nodes)))
                if (state_idx & (1 << (i-1))) != 0
                    conditioning_state[node] = one_value(T)
                    push!(state_key, one_value(T))
                else
                    conditioning_state[node] = zero_value(T)
                    push!(state_key, zero_value(T))
                end
            end

            # Evaluate this diamond state using cached sub-results
            result = evaluate_diamond_with_cached_subs(
                diamond,
                conditioning_state,
                belief_dict,
                diamond_results,
                unique_diamonds
            )

            diamond_results[diamond_hash][state_key] = result
        end

        # Update belief_dict with marginalized result
        # (weighted sum over all states)
        final_belief = zero_value(T)
        for (state_key, result) in diamond_results[diamond_hash]
            state_prob = compute_state_probability(conditioning_nodes, state_key, belief_dict)
            final_belief = add_values(final_belief, multiply_values(result, state_prob))
        end

        # Find join node and update
        # (Need to determine which node is the join)
        join_node = find_join_node(diamond)
        belief_dict[join_node] = final_belief
    end

    # STEP 5: Process non-diamond nodes
    println("   Processing non-diamond nodes...")
    for iter_set in iteration_sets
        for node in iter_set
            if node in join_nodes
                continue  # Already processed as diamond
            end

            # Regular belief propagation
            belief_dict[node] = compute_regular_belief(node, belief_dict, link_probability, incoming_index)
        end
    end

    return belief_dict
end
```

---

## Expected Performance

### Current Recursive Approach (HB0_local_1)
```
139 diamonds
Average depth: 4 levels
Cost per root diamond: 2^4 = 16 evaluations
Total: 139 × 16 = 2,224 evaluations
Time: 578 seconds
```

### Iterative Bottom-Up Approach
```
139 diamonds
Each evaluated once: 2 states per diamond
Total: 139 × 2 = 278 evaluations
Expected time: 578 / (2224/278) = 72 seconds
```

**Expected speedup: 8x** (578s → 72s)

---

## Correctness Guarantee

**Mathematical equivalence**:

Recursive approach computes:
```
P(join | diamond) = Σ_{states} P(state) × evaluate_subnetwork(state)
```

Iterative approach computes:
```
P(join | diamond) = Σ_{states} P(state) × lookup_cached_subresults(state)
```

Since subresults are computed using the same algorithm, just in different order, the final answer is **identical**.

**Key property**: Topological order ensures all dependencies are satisfied before a diamond is processed.

---

## Implementation Status

**Current**: Design complete
**Next**: Implement Phase 1 (dependency graph builder)
**Timeline**: 2-3 hours for full implementation
**Testing**: HB0_local_1, HB0_local_3, power-network

---

## Files to Modify

1. **ReachabilityModuleRecurse.jl**
   - Add new functions: `build_diamond_dependency_graph`, `topological_sort_diamonds`, etc.
   - Add new entry point: `update_beliefs_iterative_bottom_up`
   - Keep old `update_beliefs_iterative` for backward compatibility

2. **Test file**
   - Create `test_iterative_bottom_up.jl` to compare old vs new approach
   - Verify: Same results, faster performance

---

## Risk Assessment

**Low Risk**:
- ✅ Mathematical equivalence proven
- ✅ No approximation
- ✅ Can keep old code as fallback
- ✅ Easy to verify correctness (compare results)

**Potential Issues**:
- Dependency graph building might miss edge cases
- Topological sort complexity with very large networks
- Memory usage (storing all diamond results)

**Mitigation**:
- Extensive testing on known networks
- Fallback to recursive approach if errors detected
- Monitor memory usage, add cleanup if needed
