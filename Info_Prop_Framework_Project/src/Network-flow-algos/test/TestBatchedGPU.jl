"""
Test Batched GPU Implementation
Verifies correctness and measures overhead reduction from batching
"""

# Check if this is the first run
if !@isdefined(batched_gpu_test_initialized)
    println("First run - initializing...")

    using CUDA

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Import functions
    import .IPAFramework.ReachabilityModule: inclusion_exclusion_cpu

    # Include GPU kernel directly
    include("../src/Algorithms/GPUKernels/InclusionExclusionKernel.jl")
    using .InclusionExclusionKernel

    global batched_gpu_test_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# Test Batched GPU Correctness
# ============================================================================

function test_batched_correctness()
    println("\n" * "="^80)
    println("BATCHED GPU CORRECTNESS TEST")
    println("="^80 * "\n")

    println("GPU Status: ", CUDA.functional() ? "Available ✓" : "Not available ✗")
    if !CUDA.functional()
        println("⚠️  GPU not available, skipping tests")
        return false
    end

    # Create GPU state
    gpu_state = BatchedGPUState(20, 1000)
    println("Created GPU state: max_n=20, max_batch_size=1000\n")

    # Test case 1: Single problem
    println("Test 1: Single problem (n=15)")
    beliefs1 = [rand() * 0.5 + 0.3 for _ in 1:15]
    cpu_result1 = inclusion_exclusion_cpu(beliefs1)
    gpu_results1 = inclusion_exclusion_gpu_batched([beliefs1], gpu_state)
    error1 = abs(cpu_result1 - gpu_results1[1]) / max(abs(cpu_result1), 1e-10)
    passed1 = error1 < 1e-9
    println("  CPU: $cpu_result1")
    println("  GPU: $(gpu_results1[1])")
    println("  $(passed1 ? "✓ PASS" : "✗ FAIL") (error: $error1)\n")

    # Test case 2: Multiple problems, same size
    println("Test 2: Batch of 10 problems (all n=13)")
    beliefs_batch = [rand(13) .* 0.5 .+ 0.3 for _ in 1:10]
    cpu_results = [inclusion_exclusion_cpu(b) for b in beliefs_batch]
    gpu_results = inclusion_exclusion_gpu_batched(beliefs_batch, gpu_state)

    all_pass = true
    for i in 1:10
        error = abs(cpu_results[i] - gpu_results[i]) / max(abs(cpu_results[i]), 1e-10)
        if error >= 1e-9
            println("  Problem $i: ✗ FAIL (error: $error)")
            all_pass = false
        end
    end
    if all_pass
        println("  ✓ PASS: All 10 problems match CPU results\n")
    end

    # Test case 3: Mixed sizes
    println("Test 3: Batch with mixed sizes (n=10,12,13,14,15)")
    mixed_batch = [
        rand(10) .* 0.5 .+ 0.3,
        rand(12) .* 0.5 .+ 0.3,
        rand(13) .* 0.5 .+ 0.3,
        rand(14) .* 0.5 .+ 0.3,
        rand(15) .* 0.5 .+ 0.3,
    ]
    cpu_mixed = [inclusion_exclusion_cpu(b) for b in mixed_batch]
    gpu_mixed = inclusion_exclusion_gpu_batched(mixed_batch, gpu_state)

    mixed_pass = true
    for i in 1:5
        error = abs(cpu_mixed[i] - gpu_mixed[i]) / max(abs(cpu_mixed[i]), 1e-10)
        if error >= 1e-9
            println("  Problem $i (n=$(length(mixed_batch[i]))): ✗ FAIL (error: $error)")
            mixed_pass = false
        end
    end
    if mixed_pass
        println("  ✓ PASS: All mixed-size problems match CPU results\n")
    end

    # Test case 4: Large batch (100 problems)
    println("Test 4: Large batch (100 problems, n=13)")
    large_batch = [rand(13) .* 0.5 .+ 0.3 for _ in 1:100]
    cpu_large = [inclusion_exclusion_cpu(b) for b in large_batch]
    gpu_large = inclusion_exclusion_gpu_batched(large_batch, gpu_state)

    large_pass = true
    max_error = 0.0
    for i in 1:100
        error = abs(cpu_large[i] - gpu_large[i]) / max(abs(cpu_large[i]), 1e-10)
        max_error = max(max_error, error)
        if error >= 1e-9
            large_pass = false
        end
    end
    println("  $(large_pass ? "✓ PASS" : "✗ FAIL"): Max error across 100 problems: $max_error\n")

    println("="^80)
    overall_pass = passed1 && all_pass && mixed_pass && large_pass
    if overall_pass
        println("✓ ALL CORRECTNESS TESTS PASSED!")
    else
        println("✗ SOME TESTS FAILED")
    end
    println("="^80 * "\n")

    return overall_pass
end

# ============================================================================
# Benchmark Batched vs Individual GPU Calls
# ============================================================================

function benchmark_batching_overhead()
    println("\n" * "="^80)
    println("BATCHING OVERHEAD REDUCTION BENCHMARK")
    println("="^80 * "\n")

    # Create test problems
    n = 13
    num_problems = 500
    test_problems = [rand(n) .* 0.5 .+ 0.3 for _ in 1:num_problems]

    println("Test configuration:")
    println("  Problem size: n=$n")
    println("  Number of problems: $num_problems")
    println()

    # Benchmark individual GPU calls
    println("Benchmarking individual GPU calls...")
    individual_times = Float64[]
    for _ in 1:3
        t = @elapsed begin
            for problem in test_problems
                _ = inclusion_exclusion_gpu(problem)
            end
        end
        push!(individual_times, t)
        println("  Run: $(round(t, digits=3))s")
    end
    individual_time = minimum(individual_times)
    println("Best individual time: $(round(individual_time, digits=3))s\n")

    # Benchmark batched GPU calls
    println("Benchmarking batched GPU calls...")
    gpu_state = BatchedGPUState(20, 1000)
    batched_times = Float64[]
    for _ in 1:3
        t = @elapsed begin
            _ = inclusion_exclusion_gpu_batched(test_problems, gpu_state)
        end
        push!(batched_times, t)
        println("  Run: $(round(t, digits=3))s")
    end
    batched_time = minimum(batched_times)
    println("Best batched time: $(round(batched_time, digits=3))s\n")

    # Results
    println("="^80)
    println("RESULTS")
    println("="^80 * "\n")

    speedup = individual_time / batched_time
    println("Individual GPU calls: $(round(individual_time, digits=3))s")
    println("Batched GPU calls:    $(round(batched_time, digits=3))s")
    println("\n🎯 Batching speedup: $(round(speedup, digits=2))x")
    println("⏱️  Overhead eliminated: $(round(individual_time - batched_time, digits=3))s ($(round(100*(individual_time - batched_time)/individual_time, digits=1))%)")

    println("\n" * "="^80)

    if speedup >= 10
        println("✅ EXCELLENT: Batching provides $(round(speedup, digits=2))x speedup!")
        println("   Overhead is successfully amortized.")
    elseif speedup >= 5
        println("✅ GOOD: Batching provides $(round(speedup, digits=2))x speedup.")
        println("   Significant overhead reduction achieved.")
    elseif speedup >= 2
        println("✓ MODERATE: Batching provides $(round(speedup, digits=2))x speedup.")
        println("   Some overhead reduced but room for improvement.")
    else
        println("⚠️  WARNING: Batching only provides $(round(speedup, digits=2))x speedup.")
        println("   May need larger batch sizes or further optimization.")
    end

    println("="^80 * "\n")

    return (individual_time=individual_time, batched_time=batched_time, speedup=speedup)
end

# ============================================================================
# Run Tests
# ============================================================================

println("\n" * "="^80)
println("BATCHED GPU IMPLEMENTATION TEST")
println("GPU: ", CUDA.name(CUDA.device()))
println("VRAM: ", round(CUDA.total_memory() / 1e9, digits=2), " GB")
println("="^80)

# Run correctness tests
correctness_passed = test_batched_correctness()

if correctness_passed
    # Run overhead benchmark
    results = benchmark_batching_overhead()

    println("\n✓ Testing complete!")
    println("   Batching speedup: $(round(results.speedup, digits=2))x")
else
    println("\n✗ Correctness tests failed - skipping benchmarks")
end
