# Iterative BP Exploration Session Summary

## Original Idea
"What if we solved diamonds iteratively using a LIFO stack and learned from the stack structure to enable better dynamic threading in the BP algorithm?"

## Key Challenge Identified
**Bottom-up won't work naively** because inner diamonds depend on **contextual node priors**, especially from non-conditioning source nodes. The same diamond structure produces different results in different contexts!

## Solution Approach

### Phase 1: Build Dependency Graph During Diamond Storage
**Insight:** We can compute dependency metadata **as we build** unique diamond storage, no second pass needed!

**Implementation:**
- Enhanced `DiamondComputationData` with 3 new fields:
  - `depth_level` - how deep the nesting is (0 = leaf)
  - `child_diamond_hashes` - which diamonds are nested inside
  - `num_conditioning_nodes` - how expensive (2^n states)
- Computed in `build_unique_diamond_storage_depth_first_parallel`
- Lines 1410-1448 (sequential) and 1726-1764 (parallel)

### Phase 2: Analyze Dependency Structure
**Tool:** `test/TestDiamondDependencyGraph.jl`

**Findings (drone-network-balanced-k3):**
- 620 unique diamonds total
- Max depth: 2 (shallow nesting - good!)
- 143 leaf diamonds (23%) can be solved independently
- 469 diamonds at depth 1 (76%) - massive parallelization potential
- Only 8 root diamonds (1%)
- 72% have just 1 conditioning node (cheap: 2 states)
- 6.5% have 3 conditioning nodes (expensive: 8 states)

**Key Discovery:** 127 network-level roots → 97 dependency-graph roots
- Same diamond can be sub-diamond of multiple network-level diamonds
- Deduplication working correctly!

### Phase 3: Understand Context Dependency
**Critical Insight:** Context matters even for identical structures!

**Why bottom-up alone won't work:**
```julia
# Same diamond, different contexts:
Diamond A in Parent X (state 0b01):
  sub_node_priors[10] = 0.7  # From belief_dict
  conditioning[5] = 0         # From parent state

Diamond A in Parent Y (state 0b11):
  sub_node_priors[10] = 0.7  # Same belief
  conditioning[5] = 1         # DIFFERENT parent state!
```

Result: Different belief values despite identical structure!

**The cache already handles this:**
```julia
cache_key = make_cache_key(diamond.edgelist, sub_node_priors)
```
Only reuses when (structure, context) both match.

### Phase 4: Iterative Implementation
**File:** `src/Algorithms/ReachabilityModuleIterative.jl`

**Strategy:**
- **Iterative for state enumeration** (fixes 2^n stack overflow)
- **Still recursive for nested diamonds** (bounded by depth ~2-3)
- **Maintains exact cache behavior** (structure + context)
- **Better threading via @threads** (vs spawning per state)

**Key Functions:**
```julia
updateDiamondJoin_iterative()
  ├─ Builds work queue of all 2^n states
  └─ Processes in parallel via @threads

process_single_conditioning_state()
  ├─ Computes state probability
  ├─ Sets conditioning values
  ├─ Checks cache (thread-safe)
  └─ Recursively solves nested diamonds
```

## What We Learned

### 1. The Real Bottleneck
- **Stack overflow from 2^n state enumeration**, not diamond nesting
- Max depth is typically 2-3 (manageable)
- State count can be huge (2^10 = 1024 states)

### 2. Context is King
- Cannot precompute all diamonds bottom-up
- Must enumerate conditioning states for each context
- Cache reuse happens when same (structure, context) appears

### 3. Parallelization Opportunities
- **Within depth levels:** Hundreds of diamonds can run in parallel
- **Within state enumeration:** 2^n states are independent
- Current threading could be improved with work-stealing

### 4. Network-Level vs Dependency-Graph Roots
- Network-level roots: Diamonds found at network join nodes (127)
- Dependency-graph roots: Diamonds not nested in others (97)
- Difference shows deduplication is working (30 diamonds reused!)

## Testing Strategy

### Correctness Test (HB01_local)
- Current optimized: ~20 seconds
- Must produce **identical results** (< 1e-10 difference)
- This is the ground truth

### Stack Overflow Fix (drone-network-balanced-k3)
- Currently fails with deep recursion
- Iterative should handle without limits

### Performance Target
- Beat 20 seconds on HB01_local
- Better thread utilization
- Handle k3 without crashes

## Files Created/Modified

### Modified
1. `src/Algorithms/DiamondProcessingModule.jl`
   - Added dependency metadata to `DiamondComputationData`
   - Computed during storage build (lines 1410-1448, 1726-1764)

### Created
1. `test/TestDiamondDependencyGraph.jl`
   - Analyzes dependency graph structure
   - Visualizes depth, complexity, parallelization potential

2. `src/Algorithms/ReachabilityModuleIterative.jl`
   - Iterative BP implementation
   - Work queue for state enumeration
   - Thread-safe caching

3. `src/Algorithms/DiamondDependencyGraph.jl`
   - Post-processing dependency extraction (alternative approach)
   - Not needed since we build metadata during construction

4. Documentation:
   - `ITERATIVE_BP_PLAN.md` - Implementation plan
   - `SUMMARY_ITERATIVE_BP.md` - Technical summary
   - `SESSION_SUMMARY.md` - This document

## Next Steps

1. **Integrate** `ReachabilityModuleIterative` into `IPAFrameworkOptimized`
2. **Test correctness** on HB01_local (must match exactly!)
3. **Benchmark performance** (goal: ≤ 20 seconds)
4. **Fix stack overflow** on k3
5. **Optimize if needed** (work-stealing, cache-aware ordering, etc.)

## Success Metrics

✅ **Infrastructure Complete:**
- ✅ Dependency metadata computed during build
- ✅ Analysis tools created and tested
- ✅ Iterative BP implementation complete

⏳ **Testing Pending:**
- ⏳ Correctness validation on HB01_local
- ⏳ Stack overflow fix verification on k3
- ⏳ Performance benchmarking (≤ 20s goal)

## Key Takeaways

1. **Dependency graph is useful** for understanding structure and parallelization, but **context still matters** at runtime

2. **Iterative approach fixes the right problem**: State enumeration stack overflow, not diamond nesting

3. **Metadata comes for free**: Computing during build is essentially zero overhead

4. **Shallow nesting is common**: Most networks have depth 2-3, making recursive nesting acceptable

5. **Cache is context-aware**: Already handles the complexity correctly with (structure, context) keys

## Ready for Testing!

All infrastructure is in place. Next session can focus on:
1. Integration into main framework
2. Correctness testing against HB01_local
3. Performance benchmarking
4. Iterative improvements if needed
