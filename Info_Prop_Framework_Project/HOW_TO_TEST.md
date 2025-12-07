# How to Test the Optimizations

## Quick Start

```bash
cd src/Network-flow-algos/test
julia --threads=auto CompareOptimized.jl
```

This will:
1. Load both original and optimized modules
2. Run HB0_local_1 network through both versions
3. Compare performance metrics
4. Verify results match

## What to Expect

### Expected Output

```
🔬 COMPARISON TEST: ORIGINAL vs OPTIMIZED

Network: HB0_local_1
Threads: 8

▶️  Testing ORIGINAL implementation...
================================================================================
Testing: Original IPAFramework
Network: HB0_local_1
================================================================================

📊 Loading network data...
   ✓ Loaded in 0.XXXs
🔧 Building network structure...
   ✓ Built in 0.XXXs
💎 Identifying diamonds...
   ✓ Identified in 0.XXXs
🔨 Building unique diamond storage...
   ✓ Built in 0.XXXs

🧮 Running belief propagation...
   Threads: 8
   ✓ BP completed in ~200-300s
   Allocations: ~900-1000 GB
   GC time: ~100s (~40-50%)

▶️  Testing OPTIMIZED implementation...
[similar output but with better numbers]

================================================================================
📊 PERFORMANCE COMPARISON
================================================================================

Time:
  Original:  XXX.XXs
  Optimized: XXX.XXs
  Speedup:   2.X-2.6x ⚡

Allocations:
  Original:  XXX.XX GB
  Optimized: XXX.XX GB
  Reduction: X.Xx (XX.X% less)

GC Time:
  Original:  XXX.XXs (XX.X%)
  Optimized: XX.XXs (XX.X%)
  Reduction: X.Xx

🔍 CORRECTNESS CHECK
================================================================================
✅ Results match! Maximum difference: X.XXe-XX (node XXX)
```

### Success Criteria

✅ **Speedup:** 2-2.6x faster (or better!)
✅ **Allocations:** 70-90% reduction
✅ **GC Time:** Reduced from ~49% to ~10-15%
✅ **Correctness:** Max difference < 1e-10

## Troubleshooting

### Problem: Module loading errors
**Solution:** Make sure you're in the `test/` directory and the relative paths are correct

### Problem: No speedup observed
**Possible causes:**
- Not running with multiple threads (use `julia --threads=auto`)
- Network too small (try HB0_local_1 which has 132 unique diamonds)
- Some optimizations not working

### Problem: Results don't match
**This indicates a bug!** Check:
1. Are all type conversions correct (Float64 operations)?
2. Is the restore logic in `copy()` elimination working?
3. Are thread-local buffers being cleared properly?

### Problem: Segfault or hang
**Possible causes:**
- Thread-safety issue in parallel code
- Lock deadlock (shouldn't happen with striped locks)
- Memory corruption from in-place mutation

## Detailed Profiling (Optional)

For more detailed analysis, you can use Julia's profiler:

```julia
using Profile

# Run with profiling
@profile result = IPAFrameworkOptimized.update_beliefs_iterative(...)

# View profile
Profile.print()

# Or visualize with ProfileView.jl
using ProfileView
ProfileView.view()
```

## Comparing Specific Optimizations

To test individual optimizations, you can:
1. Comment out specific optimizations in the code
2. Re-run the comparison
3. See which optimization contributes most to the speedup

## Memory Analysis

To see detailed allocation breakdown:

```julia
using Profile

Profile.Allocs.clear()
Profile.Allocs.@profile sample_rate=1.0 begin
    result = update_beliefs_iterative(...)
end

# View allocation profile
Profile.Allocs.print()
```

## Next Steps After Testing

### If optimizations work well:
1. Consider making this the default implementation
2. Document any behavioral changes
3. Update user-facing documentation

### If optimizations don't work:
1. Use `git diff` to compare original and optimized versions
2. Binary search through optimizations to find issues
3. Check individual optimization assumptions

### Future improvements:
1. Add back support for pbox/Interval types (with similar optimizations)
2. Profile even larger networks
3. Consider GPU acceleration for very large networks

## Reference

- **Original implementation:** [ReachabilityModuleRecurse.jl](../src/Algorithms/ReachabilityModuleRecurse.jl)
- **Optimized implementation:** [ReachabilityModuleRecurseOptimized.jl](../src/Algorithms/ReachabilityModuleRecurseOptimized.jl)
- **Full documentation:** [OPTIMIZATION_COMPLETE.md](../../OPTIMIZATION_COMPLETE.md)
