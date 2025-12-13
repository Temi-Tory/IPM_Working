# Iterative BP Implementation Plan

## Goal
Replace recursive `updateDiamondJoin` with iterative work-stack approach to:
1. **Fix stack overflow** on deep diamond nesting (drone-network-balanced-k3)
2. **Improve thread utilization** via work-stealing instead of spawning per state
3. **Maintain exact correctness** - same results as current optimized version
4. **Beat 20-second benchmark** on HB01_local

## What We've Built

### ✅ Phase 1: Dependency Metadata (COMPLETE)
- Enhanced `DiamondComputationData` with 3 new fields:
  - `depth_level::Int64` - nesting depth (0 = leaf)
  - `child_diamond_hashes::Set{UInt64}` - immediate children
  - `num_conditioning_nodes::Int64` - enumeration cost (2^n)
- Computed **during** `build_unique_diamond_storage_depth_first_parallel`
- No extra pass needed - metadata built as we go

### ✅ Phase 2: Test Infrastructure (COMPLETE)
- `TestDiamondDependencyGraph.jl` validates dependency metadata
- Shows depth distribution, parallelization potential, complexity
- Tested on drone-network-balanced-k3:
  - 620 unique diamonds
  - Max depth: 2 (shallow nesting)
  - 127 network-level roots → 97 dependency-graph roots (deduplication!)

## Key Insights

### Context Dependency is Critical
Even identical diamond structures produce **different results** in different contexts because:
1. **Non-conditioning source beliefs** come from runtime `belief_dict`
2. **Conditioning states** differ during parent enumeration

**The cache handles this correctly:**
```julia
cache_key = make_cache_key(diamond.edgelist, sub_node_priors)
```
Cache key = (structure, context) - only reuses when **both** match.

### Iterative Approach Must Still Enumerate States
We **cannot** skip conditioning state enumeration. The iterative approach:
- Still loops through 2^n conditioning states
- Still maintains cache with (structure, context) keys
- **BUT** uses work queue instead of recursion for state processing

## Testing Strategy

### 1. Correctness Test (HB01_local)
- Current optimized BP: ~20 seconds
- **Ground truth** for correctness
- New iterative version must produce identical results

### 2. Stack Overflow Fix (drone-network-balanced-k3)
- Currently fails with deep recursion
- Iterative approach should handle without limits

### 3. Performance Target
- Beat 20 seconds on HB01_local
- Better thread utilization via work-stealing

## Implementation Plan

### ReachabilityModuleIterative.jl

Key changes from recursive version:

#### 1. State Enumeration Work Item
```julia
struct DiamondStateWorkItem
    diamond_hash::UInt64
    state_idx::Int64                    # Which conditioning state (0 to 2^n-1)
    conditioning_state::Dict{Int64, Float64}
    state_probability::Float64
    result_accumulator::Ref{Float64}    # Where to add weighted result
end
```

#### 2. Iterative `updateDiamondJoin`
```julia
function updateDiamondJoin_iterative(...)
    work_queue = DiamondStateWorkItem[]

    # Phase 1: Enqueue all conditioning states
    for state_idx in 0:(2^n - 1)
        state_prob, state_dict = compute_state(state_idx, conditioning_nodes, belief_dict)
        push!(work_queue, DiamondStateWorkItem(...))
    end

    # Phase 2: Process work queue (can be parallelized with work-stealing)
    final_belief = Ref(0.0)

    Threads.@threads for work_item in work_queue
        # Compute this state (may recursively process nested diamonds)
        state_result = process_diamond_state(work_item, computation_lookup, cache)

        # Accumulate result atomically
        lock(result_lock) do
            final_belief[] += state_result * work_item.state_probability
        end
    end

    return final_belief[]
end
```

#### 3. Nested Diamond Processing
For nested diamonds, we have two options:

**Option A: Recursive for nested, iterative for states**
- Each state spawns recursive call for nested diamonds
- Still fixes stack overflow (bounded by max_depth, not state enumeration)

**Option B: Fully iterative with nested state expansion**
- Expand nested diamond states into parent work queue
- More complex but fully iterative

Start with **Option A** for simplicity.

## Files to Create/Modify

### New Files
1. `src/Algorithms/ReachabilityModuleIterative.jl` - iterative BP implementation
2. `test/TestIterativeCorrectness.jl` - compare iterative vs optimized results

### Modified Files (minimal)
1. `src/IPAFrameworkOptimized.jl` - export iterative version alongside recursive
2. `test/CompareOptimized.jl` - add iterative version to comparison

## Success Criteria

✅ **Correctness**: Identical results to ReachabilityModuleRecurseOptimized on HB01_local
✅ **Stack Overflow**: Handles drone-network-balanced-k3 without recursion limit
✅ **Performance**: ≤ 20 seconds on HB01_local (ideally faster)
✅ **Thread Efficiency**: Better CPU utilization metrics

## Current Status
- ✅ Dependency metadata infrastructure complete
- ✅ Test infrastructure ready
- 🔄 Next: Implement ReachabilityModuleIterative.jl
- ⏳ Then: Correctness testing
- ⏳ Then: Performance optimization
