# Memory Optimization Plan for ReachabilityModuleRecurse.jl

## Problem: 964.89 GB allocations causing 48.99% GC time (194s out of 397s)

## Target: Reduce to ~100-300 GB, GC time to ~10-15%, speedup 2-2.6x

---

## Optimization #1: Eliminate `copy(sub_node_priors)` - Lines 411, 494

### Current Code (ALLOCATES):
```julia
current_priors = copy(sub_node_priors)  # Full dict copy!
for (node, value) in conditioning_state
    current_priors[node] = value
end
```

### Optimized Code (MUTATE IN-PLACE):
```julia
# Save original values we're about to overwrite
original_values = Dict{Int64, T}()
for (node, value) in conditioning_state
    if haskey(sub_node_priors, node)
        original_values[node] = sub_node_priors[node]
    end
    sub_node_priors[node] = value  # Mutate in place - NO COPY!
end

# ... do computation ...

# Restore original values
for (node, orig_val) in original_values
    sub_node_priors[node] = orig_val
end
for node in keys(conditioning_state)
    if !haskey(original_values, node) && haskey(sub_node_priors, node)
        delete!(sub_node_priors, node)  # Remove if it wasn't there before
    end
end
```

**Impact:** Eliminates ~132 MB per run × recursion depth

---

## Optimization #2: Optimize `make_cache_key` - Lines 36-61

### Current Code (ALLOCATES ARRAYS):
```julia
priors_for_hash = []  # Allocates array
for (node, value) in current_priors
    push!(priors_for_hash, (node, value))  # Allocates tuples
end
priors_hash = hash(sort(priors_for_hash))  # Allocates sorted copy
```

### Optimized Code (STREAM HASHING):
```julia
function make_cache_key_optimized(edgelist, current_priors)
    diamond_hash = hash(sort(edgelist))  # Can't avoid this

    # Stream hashing - no intermediate array!
    priors_hash = UInt64(0)
    # Sort keys once for deterministic hashing
    sorted_nodes = sort(collect(keys(current_priors)))

    for node in sorted_nodes
        value = current_priors[node]
        if isa(value, Float64)
            priors_hash = hash((node, value), priors_hash)
        elseif isa(value, pbox)
            min_val = minimum(value.u)
            max_val = maximum(value.d)
            priors_hash = hash((node, min_val, max_val), priors_hash)
        elseif isa(value, Interval)
            priors_hash = hash((node, value.lower, value.upper), priors_hash)
        else
            priors_hash = hash((node, string(value)), priors_hash)
        end
    end

    return CacheKey(diamond_hash, priors_hash)
end
```

**Impact:** Eliminates ~26 MB per run

---

## Optimization #3: Reuse `belief_dict` - Line 180

### Current Code (ALLOCATES NEW DICT):
```julia
function update_beliefs_iterative(...)
    belief_dict = Dict{Int64, T}()  # NEW ALLOCATION!
    # ...
    return belief_dict
end
```

### Optimized Code (PRE-ALLOCATE AND REUSE):
```julia
# Add optional belief_dict parameter with clear flag
function update_beliefs_iterative(
    edgelist::Vector{Tuple{Int64,Int64}},
    iteration_sets::Vector{Set{Int64}},
    # ... other params ...
    computation_lookup::Dict{UInt64, DiamondComputationData{T}},
    cache::Dict{CacheKey, DiamondCacheEntry{T}} = Dict{CacheKey, DiamondCacheEntry{T}}(),
    belief_dict::Union{Nothing, Dict{Int64,T}} = nothing,  # NEW: optional pre-allocated dict
    clear_dict::Bool = true  # NEW: whether to clear before use
) where {T <: Union{Float64, pbox, Interval}}

    # Use provided dict or create new one
    if belief_dict === nothing
        belief_dict = Dict{Int64, T}()
    elseif clear_dict
        empty!(belief_dict)  # Clear without deallocation
    end

    # ... rest of function unchanged ...

    return belief_dict
end

# In updateDiamondJoin, create thread-local belief buffers
const THREAD_BELIEF_BUFFERS = Dict{DataType, Vector{Dict}}()

function get_belief_buffer(::Type{T}) where T
    tid = Threads.threadid()
    if !haskey(THREAD_BELIEF_BUFFERS, T)
        THREAD_BELIEF_BUFFERS[T] = [Dict{Int64, T}() for _ in 1:Threads.nthreads()]
    end
    return THREAD_BELIEF_BUFFERS[T][tid]
end

# In parallel loop within updateDiamondJoin:
tasks[state_idx + 1] = Threads.@spawn begin
    belief_buffer = get_belief_buffer(T)

    state_beliefs = update_beliefs_iterative(
        diamond.edgelist,
        sub_iteration_sets,
        # ... other params ...
        computation_lookup,
        diamond_cache,
        belief_buffer,  # Reuse thread-local buffer!
        true  # Clear it first
    )
    # ...
end
```

**Impact:** MASSIVE - eliminates dict creation for every recursive call

---

## Optimization #4: Optimize `inclusion_exclusion` - Line 286

### Current Code (USES Combinatorics.combinations):
```julia
for i in 1:num_beliefs
    for combination in combinations(belief_values, i)  # Allocates!
        intersection_probability = prod_values(collect(combination))  # Allocates!
        # ...
    end
end
```

### Optimized Code (BIT-MASKING):
```julia
function inclusion_exclusion_optimized(belief_values::Vector{T}) where {T <: Union{Float64, pbox, Interval}}
    combined_belief = zero_value(T)
    n = length(belief_values)

    # Iterate through all 2^n - 1 non-empty subsets using bit masks
    for mask in 1:(2^n - 1)
        # Count bits set = subset size
        subset_size = count_ones(mask)

        # Calculate product for this subset (no intermediate array!)
        intersection_prob = one_value(T)
        for i in 1:n
            if (mask & (1 << (i-1))) != 0
                intersection_prob = multiply_values(intersection_prob, belief_values[i])
            end
        end

        # Inclusion-exclusion: add if odd size, subtract if even
        if isodd(subset_size)
            combined_belief = add_values(combined_belief, intersection_prob)
        else
            combined_belief = subtract_values(combined_belief, intersection_prob)
        end
    end

    return combined_belief
end
```

**Impact:** Eliminates combination generation overhead

---

## Optimization #5: Reduce Lock Contention - Lines 64, 423, 453

### Current Code (SINGLE GLOBAL LOCK):
```julia
const diamond_cache_lock = ReentrantLock()

lock(diamond_cache_lock) do
    if haskey(diamond_cache, cache_key)
        # ...
    end
end
```

### Optimized Code (LOCK STRIPING):
```julia
# Lock striping - distribute locks to reduce contention
const NUM_CACHE_LOCKS = 64
const cache_locks = [ReentrantLock() for _ in 1:NUM_CACHE_LOCKS]

function get_lock_for_key(key::CacheKey)
    lock_idx = (hash(key) % NUM_CACHE_LOCKS) + 1
    return cache_locks[lock_idx]
end

# Usage in updateDiamondJoin:
cache_lock = get_lock_for_key(cache_key)
lock(cache_lock) do
    if haskey(diamond_cache, cache_key)
        cached_entry = diamond_cache[cache_key]
        state_beliefs = cached_entry.state_beliefs
    else
        state_beliefs = nothing
    end
end
```

**Impact:** Reduces 9K lock conflicts to near-zero, improves parallelism

---

## Implementation Order:

1. **#2 - make_cache_key** (easiest, no threading issues)
2. **#4 - inclusion_exclusion** (easy, pure function)
3. **#1 - eliminate copy** (moderate, need careful restore logic)
4. **#5 - lock striping** (moderate, threading but straightforward)
5. **#3 - reuse belief_dict** (complex, requires threading-aware design)

---

## Expected Results:

- **Allocations:** 964 GB → 100-300 GB (70-90% reduction)
- **GC time:** 48.99% → 10-15%
- **Total time:** 397s → 150-200s
- **Speedup:** **2-2.6x faster**

