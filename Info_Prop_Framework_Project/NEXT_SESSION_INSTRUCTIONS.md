# Instructions for Next Session: Memory Optimization Implementation

## Context Summary

We've completed comprehensive profiling of the Julia belief propagation algorithm for HB0_local_1 network and identified a **memory allocation crisis** causing severe performance degradation.

## Problem Identified

**Current Performance (HB0_local_1 network):**
- Execution time: **397 seconds**
- Memory allocated: **964.89 GB** (!)
- GC time: **48.99%** (194 seconds out of 397)
- Lock conflicts: 9,139
- States processed: 264 (132 diamonds × 2 states each)
- **Per-state cost: 1.5 seconds, 3.65 GB allocated**

**Root Cause:** Not computational complexity, but **catastrophic memory allocation and garbage collection pressure**.

## Key Findings

From profiling analysis:

1. **18.15 billion allocations** creating 898.7 GiB
2. **48.99% of execution time spent in GC** (not computation!)
3. Main culprits identified in `ReachabilityModuleRecurse.jl`:
   - `copy(sub_node_priors)` - Full dictionary copy per state (lines 411, 494)
   - `make_cache_key()` - Creates intermediate arrays (lines 36-61)
   - Recursive `update_beliefs_iterative` - New dict every call (line 180)
   - `inclusion_exclusion()` - Uses Combinatorics.combinations (line 293)
   - Single global lock - 9K lock conflicts (line 64)

## Solution: 5 Memory Optimizations

All optimizations are documented in detail in:
- **`OPTIMIZATION_PLAN.md`** - High-level strategy and expected impact
- **`APPLY_OPTIMIZATIONS.md`** - Specific code changes to make

**Expected Results:**
- Allocations: 964 GB → 100-300 GB (70-90% reduction)
- GC time: 48.99% → 10-15%
- Total time: 397s → **150-200s** (**2-2.6x speedup**)

## Files Created/Modified

**Analysis Files:**
- `src/Network-flow-algos/test/SimpleProfile.jl` - Simple @time profiler (ran successfully)
- `src/Network-flow-algos/test/ProfileAllocations.jl` - Detailed allocation profiler (partial run)
- `src/Network-flow-algos/test/AnalyzeDiamondStructures.jl` - Gray code analysis (concluded: not beneficial)

**Implementation Files:**
- `src/Network-flow-algos/src/Algorithms/ReachabilityModuleRecurseOptimized.jl` - **READY FOR EDITING** (copy of original)
- Original file preserved as backup

**Documentation:**
- `OPTIMIZATION_PLAN.md` - High-level optimization strategy
- `APPLY_OPTIMIZATIONS.md` - **10 specific code changes to apply**
- `NEXT_SESSION_INSTRUCTIONS.md` - This file

## What to Do Next

### Step 1: Read the Context Files

Start your new session by reading these files IN ORDER:

1. **`OPTIMIZATION_PLAN.md`** - Understand the 5 optimizations
2. **`APPLY_OPTIMIZATIONS.md`** - See the exact code changes

### Step 2: Apply the Optimizations

Edit `src/Network-flow-algos/src/Algorithms/ReachabilityModuleRecurseOptimized.jl` with the **10 changes** listed in `APPLY_OPTIMIZATIONS.md`:

**Quick checklist:**
- [ ] Change 1: Module name to `ReachabilityModuleOptimized`
- [ ] Change 2: Remove `using Combinatorics`
- [ ] Change 3: Simplify all type constraints to Float64 only
- [ ] Change 4: Optimize `make_cache_key()` - stream hashing
- [ ] Change 5: Add lock striping (64 locks instead of 1)
- [ ] Change 6: Optimize `inclusion_exclusion()` - bit-masking
- [ ] Change 7: Add `belief_dict` parameter to `update_beliefs_iterative`
- [ ] Change 8: Add thread-local buffer management
- [ ] Change 9: Eliminate `copy()` in `updateDiamondJoin` (both parallel and sequential paths)
- [ ] Change 10: Use thread-local buffer in parallel loop

### Step 3: Test the Optimized Version

Create a test script based on `SimpleProfile.jl` but importing the optimized module:

```julia
include("../src/IPAFrameworkOptimized.jl")  # You'll need to create this wrapper
using .IPAFrameworkOptimized

# Run same profiling as before
# Compare: allocations, GC time, total time
```

### Step 4: Benchmark and Compare

Expected results to verify:
- ✅ Allocations reduced by 70-90%
- ✅ GC time reduced from ~49% to ~10-15%
- ✅ Total time reduced by 2-2.6x (397s → 150-200s)
- ✅ Lock conflicts reduced to near-zero

## Important Notes

**Scope:** We're targeting **Float64 only** for simplicity. All `where {T <: Union{Float64, pbox, Interval}}` constraints should be removed or simplified to just Float64.

**Safety:** The original `ReachabilityModuleRecurse.jl` is preserved. We're working on a copy (`ReachabilityModuleRecurseOptimized.jl`), so you can always compare or revert.

**Testing:** Make sure to test with `HB0_local_1` network (same as profiling) to ensure correctness and measure performance improvement.

## Key Insight

The problem is NOT:
- ❌ Computational complexity
- ❌ Lack of parallelism
- ❌ Algorithm inefficiency

The problem IS:
- ✅ **Memory allocation** (964 GB for 264 states!)
- ✅ **Garbage collection** (48.99% of time)
- ✅ **Lock contention** (9K conflicts)

All optimizations focus on **eliminating allocations**, not changing the algorithm.

## Questions to Ask If Stuck

1. "Show me OPTIMIZATION_PLAN.md" - for high-level strategy
2. "Show me APPLY_OPTIMIZATIONS.md" - for specific code changes
3. "Show me the diff between original and optimized" - to see what changed
4. "Run SimpleProfile.jl with optimized module" - to test results

## Success Criteria

You'll know it worked when:
1. Code compiles without errors
2. Results match original (correctness preserved)
3. Allocations drop dramatically (< 300 GB vs 964 GB)
4. GC time drops to < 20%
5. Total time drops by at least 2x (< 200s vs 397s)

---

**Ready to implement!** All analysis is complete, all optimizations are designed, and the file is ready for editing. Just apply the 10 changes from `APPLY_OPTIMIZATIONS.md` and test.

