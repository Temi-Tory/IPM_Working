# Phase 1: GPU-Accelerate `inclusion_exclusion` Function

## Current Implementation (CPU Sequential)

```julia
function inclusion_exclusion(belief_values::Vector{T}) where {T}
    combined_belief = zero_value(T)
    num_beliefs = length(belief_values)

    for i in 1:num_beliefs
        for combination in combinations(belief_values, i)
            intersection_probability = prod_values(collect(combination))
            if isodd(i)
                combined_belief = add_values(combined_belief, intersection_probability)
            else
                combined_belief = subtract_values(combined_belief, intersection_probability)
            end
        end
    end
    return combined_belief
end
```

**Problem:**
- For `n` belief values, iterates through `2^n - 1` combinations
- Profile shows 63,324+ samples spent here
- Sequential iteration through `Combinatorics.combinations`

---

## GPU Strategy

### Key Insight: Represent Combinations as Binary Numbers

Instead of using `Combinatorics.combinations`, map each combination to a binary number:
- For `n=4` beliefs: [A, B, C, D]
- Combination `{A, C}` = binary `1010` = integer `10`
- Total combinations: `2^n - 1` (excluding empty set)

**GPU Parallelization:**
- Launch `2^n - 1` GPU threads
- Thread `i` computes combination corresponding to binary representation of `i`
- Each thread independently computes its intersection probability
- GPU reduction to sum/subtract results

---

## Implementation Steps

### Step 1: Create GPU Kernel for Combination Computation

**File:** `src/Algorithms/GPUKernels/InclusionExclusionKernel.jl`

```julia
using CUDA

"""
GPU kernel: Each thread computes one combination's contribution
"""
function inclusion_exclusion_kernel!(
    results::CuDeviceVector{Float64},
    belief_values::CuDeviceVector{Float64},
    n::Int32
)
    # Thread index = combination represented as binary
    tid = (blockIdx().x - 1) * blockDim().x + threadIdx().x

    if tid <= 2^n - 1
        # Decode binary to combination
        product = 1.0
        popcount = 0

        for bit in 0:(n-1)
            if (tid & (1 << bit)) != 0
                product *= belief_values[bit + 1]
                popcount += 1
            end
        end

        # Apply inclusion-exclusion sign
        sign = isodd(popcount) ? 1.0 : -1.0
        results[tid] = sign * product
    end

    return nothing
end
```

### Step 2: GPU Reduction to Sum Results

Use CUDA's optimized reduction:

```julia
function inclusion_exclusion_gpu(belief_values::Vector{Float64})
    n = length(belief_values)
    num_combinations = 2^n - 1

    # Transfer to GPU
    d_beliefs = CuArray(belief_values)
    d_results = CUDA.zeros(Float64, num_combinations)

    # Launch kernel
    threads = 256
    blocks = ceil(Int, num_combinations / threads)
    @cuda threads=threads blocks=blocks inclusion_exclusion_kernel!(
        d_results, d_beliefs, Int32(n)
    )

    # Reduce on GPU
    result = CUDA.sum(d_results)

    # Transfer back to CPU
    return Array(result)[1]
end
```

### Step 3: Hybrid CPU/GPU Dispatch

**File:** `src/Algorithms/ReachabilityModuleRecurse.jl`

```julia
function inclusion_exclusion(
    belief_values::Vector{T};
    use_gpu::Bool = true,
    gpu_threshold::Int = 10  # Use GPU if n >= 10
) where {T <: Union{Float64, pbox, Interval}}

    n = length(belief_values)

    # Use GPU for large problems (Float64 only for now)
    if use_gpu && n >= gpu_threshold && T == Float64 && CUDA.functional()
        return inclusion_exclusion_gpu(belief_values)
    end

    # Fall back to CPU
    return inclusion_exclusion_cpu(belief_values)
end

# Rename current implementation
function inclusion_exclusion_cpu(belief_values::Vector{T}) where {T}
    # ... existing implementation ...
end
```

---

## Performance Analysis

### Problem Size Scaling

| n (beliefs) | Combinations | CPU Time* | GPU Time* | Speedup |
|-------------|--------------|-----------|-----------|---------|
| 5           | 31           | 0.1 ms    | 0.5 ms    | 0.2x    |
| 10          | 1,023        | 5 ms      | 0.6 ms    | 8x      |
| 15          | 32,767       | 200 ms    | 1 ms      | 200x    |
| 20          | 1,048,575    | 8 s       | 10 ms     | 800x    |

*Estimated based on profile data and GPU specs

### Breakeven Point

- **CPU faster:** n < 10 (overhead of GPU transfer dominates)
- **GPU faster:** n >= 10 (parallelism wins)
- **Massive GPU win:** n >= 15 (exponential growth favors parallel)

---

## Implementation Phases

### Phase 1a: Basic GPU Kernel (Float64 only)
**Goal:** Prove GPU speedup for Float64 arithmetic
**Tasks:**
1. Create `GPUKernels/InclusionExclusionKernel.jl`
2. Implement `inclusion_exclusion_kernel!` for Float64
3. Implement `inclusion_exclusion_gpu` wrapper
4. Write benchmark comparing CPU vs GPU

**Success Criteria:** 10x+ speedup for n=15

### Phase 1b: Hybrid Dispatch
**Goal:** Automatically use GPU when beneficial
**Tasks:**
1. Add `use_gpu` flag to `inclusion_exclusion`
2. Implement `gpu_threshold` heuristic
3. Fall back to CPU for small n or non-Float64 types
4. Integrate with existing `update_beliefs_iterative`

**Success Criteria:** No performance regression for small problems

### Phase 1c: Support Interval & pbox Types
**Goal:** Extend GPU to uncertainty types
**Tasks:**
1. Implement GPU arithmetic for `Interval` struct
2. Implement GPU arithmetic for `pbox` struct
3. Update kernel to handle generic types
4. Benchmark uncertainty type performance

**Success Criteria:** 5x+ speedup for n=12 with Interval/pbox

### Phase 1d: Optimize Memory Transfers
**Goal:** Minimize CPU↔GPU transfer overhead
**Tasks:**
1. Pre-allocate GPU memory pools
2. Batch multiple `inclusion_exclusion` calls
3. Keep intermediate results on GPU
4. Profile memory transfer bottlenecks

**Success Criteria:** <10% time spent on transfers

---

## Testing Strategy

### Unit Tests
```julia
@testset "GPU Inclusion-Exclusion" begin
    # Test correctness
    beliefs = [0.7, 0.6, 0.8, 0.9]
    cpu_result = inclusion_exclusion_cpu(beliefs)
    gpu_result = inclusion_exclusion_gpu(beliefs)
    @test isapprox(cpu_result, gpu_result, rtol=1e-10)

    # Test edge cases
    @test inclusion_exclusion_gpu([0.5]) ≈ 0.5
    @test inclusion_exclusion_gpu([1.0, 1.0]) ≈ 1.0

    # Test large n
    large_beliefs = rand(20)
    @test inclusion_exclusion_gpu(large_beliefs) isa Float64
end
```

### Benchmark Tests
```julia
using BenchmarkTools

function benchmark_inclusion_exclusion()
    for n in [5, 10, 15, 20]
        beliefs = rand(n)

        cpu_time = @belapsed inclusion_exclusion_cpu($beliefs)
        gpu_time = @belapsed inclusion_exclusion_gpu($beliefs)

        println("n=$n: CPU=$(cpu_time*1000)ms, GPU=$(gpu_time*1000)ms, Speedup=$(cpu_time/gpu_time)x")
    end
end
```

### Integration Tests
```julia
@testset "GPU Integration with BP" begin
    # Test on power-network
    result_cpu = run_network("power-network", use_gpu=false)
    result_gpu = run_network("power-network", use_gpu=true)

    @test all(isapprox.(result_cpu, result_gpu, rtol=1e-8))

    # Benchmark HB0_local_1
    time_cpu = @elapsed run_network("HB0_local_1", use_gpu=false)
    time_gpu = @elapsed run_network("HB0_local_1", use_gpu=true)

    @test time_gpu < time_cpu  # GPU should be faster
end
```

---

## Dependencies

### Required Packages
```julia
# Add to Project.toml
CUDA = "052768ef-5323-5732-b1bb-66c8b64840ba"  # GPU computation
KernelAbstractions = "63c18a36-062a-441e-b654-da1e3ab1ce7c"  # Backend-agnostic kernels (optional)
```

### Installation
```bash
julia> using Pkg
julia> Pkg.add("CUDA")
julia> using CUDA
julia> CUDA.functional()  # Should return true if GPU available
```

---

## Risks & Mitigation

### Risk 1: GPU Not Available
**Mitigation:** Always provide CPU fallback, check `CUDA.functional()`

### Risk 2: Numeric Precision Differences
**Mitigation:** Use tolerance-based tests, accept small floating-point errors

### Risk 3: Memory Transfer Overhead
**Mitigation:** Only use GPU for n >= threshold, batch operations

### Risk 4: pbox/Interval GPU Complexity
**Mitigation:** Start with Float64, extend to uncertainty types later

---

## Success Metrics

### Phase 1a Success:
- ✅ GPU kernel compiles and runs
- ✅ Correctness matches CPU for n=5,10,15,20
- ✅ 10x+ speedup for n=15

### Phase 1b Success:
- ✅ Hybrid dispatch works correctly
- ✅ No regression for small problems
- ✅ HB0_local_1 runs 2-5x faster

### Phase 1c Success:
- ✅ Interval/pbox GPU kernels work
- ✅ 5x+ speedup for n=12 with uncertainty

### Phase 1d Success:
- ✅ Memory transfers <10% of total time
- ✅ Batched operations show improvement

---

## Next Steps After Phase 1

Once inclusion-exclusion is GPU-accelerated:
1. Profile again to identify new bottleneck
2. Move to Phase 2 (vectorize probability arithmetic)
3. Measure end-to-end speedup on large networks
4. Consider Phase 3 (parallelize independent diamonds)
