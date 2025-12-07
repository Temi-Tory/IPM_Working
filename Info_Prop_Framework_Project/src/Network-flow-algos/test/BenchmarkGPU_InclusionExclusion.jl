"""
Benchmark GPU vs CPU for Inclusion-Exclusion Computation
Tests correctness and performance of GPU-accelerated combination enumeration
"""

# Check if this is the first run
if !@isdefined(gpu_benchmark_initialized)
    println("First run - initializing...")

    using CUDA
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, Combinatorics

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Include GPU kernel
    include("../src/Algorithms/GPUKernels/InclusionExclusionKernel.jl")
    using .InclusionExclusionKernel

    # Import the CPU version from ReachabilityModule
    import .IPAFramework.ReachabilityModule: inclusion_exclusion

    global gpu_benchmark_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# CPU Implementation (for reference)
# ============================================================================

"""
CPU version of inclusion-exclusion (current implementation)
"""
function inclusion_exclusion_cpu(belief_values::Vector{Float64})
    return inclusion_exclusion(belief_values)
end

# ============================================================================
# Correctness Tests
# ============================================================================

function test_correctness()
    println("\n" * "="^80)
    println("CORRECTNESS TESTS")
    println("="^80 * "\n")

    test_cases = [
        ("Single value", [0.5]),
        ("Two values", [0.7, 0.6]),
        ("Three values", [0.7, 0.6, 0.8]),
        ("Four values", [0.7, 0.6, 0.8, 0.9]),
        ("Five values", [0.5, 0.6, 0.7, 0.8, 0.9]),
        ("All ones", [1.0, 1.0, 1.0]),
        ("All same", [0.5, 0.5, 0.5, 0.5]),
    ]

    all_passed = true

    for (name, values) in test_cases
        cpu_result = inclusion_exclusion_cpu(values)
        gpu_result = inclusion_exclusion_gpu(values)

        relative_error = abs(cpu_result - gpu_result) / max(abs(cpu_result), 1e-10)
        passed = relative_error < 1e-9

        if passed
            println("✓ $name: PASS")
            println("  CPU: $cpu_result, GPU: $gpu_result, Error: $(relative_error)")
        else
            println("✗ $name: FAIL")
            println("  CPU: $cpu_result, GPU: $gpu_result, Error: $(relative_error)")
            all_passed = false
        end
    end

    println()
    if all_passed
        println("✓ All correctness tests PASSED!")
    else
        println("✗ Some tests FAILED!")
    end

    return all_passed
end

# ============================================================================
# Performance Benchmarks
# ============================================================================

function benchmark_inclusion_exclusion()
    println("\n" * "="^80)
    println("PERFORMANCE BENCHMARKS")
    println("="^80 * "\n")

    # Test different problem sizes
    test_sizes = [5, 8, 10, 12, 15, 18, 20]

    println("Testing problem sizes: $test_sizes")
    println()

    results = []

    for n in test_sizes
        # Generate random belief values
        beliefs = rand(n) .* 0.5 .+ 0.3  # Values between 0.3 and 0.8

        # Skip CPU benchmark for large n (would take too long)
        if n <= 18
            println("n=$n ($(2^n - 1) combinations):")

            # Benchmark CPU (run 5 times and take minimum)
            print("  CPU: ")
            cpu_times = Float64[]
            for _ in 1:5
                t = @elapsed inclusion_exclusion_cpu(beliefs)
                push!(cpu_times, t)
            end
            cpu_time = minimum(cpu_times)
            println("$(cpu_time*1000) ms")

            # Benchmark GPU (run 5 times and take minimum)
            print("  GPU: ")
            gpu_times = Float64[]
            for _ in 1:5
                t = @elapsed inclusion_exclusion_gpu(beliefs)
                push!(gpu_times, t)
            end
            gpu_time = minimum(gpu_times)
            println("$(gpu_time*1000) ms")

            speedup = cpu_time / gpu_time
            println("  Speedup: $(round(speedup, digits=2))x")
            println()

            push!(results, (n, 2^n - 1, cpu_time * 1000, gpu_time * 1000, speedup))
        else
            println("n=$n ($(2^n - 1) combinations):")
            println("  CPU: SKIPPED (too slow)")

            # Benchmark GPU only (run 5 times and take minimum)
            print("  GPU: ")
            gpu_times = Float64[]
            for _ in 1:5
                t = @elapsed inclusion_exclusion_gpu(beliefs)
                push!(gpu_times, t)
            end
            gpu_time = minimum(gpu_times)
            println("$(gpu_time*1000) ms")
            println()

            push!(results, (n, 2^n - 1, NaN, gpu_time * 1000, NaN))
        end
    end

    # Print summary table
    println("\n" * "="^80)
    println("SUMMARY TABLE")
    println("="^80 * "\n")

    println("| n | Combinations | CPU Time (ms) | GPU Time (ms) | Speedup |")
    println("|---|--------------|---------------|---------------|---------|")

    for (n, combos, cpu_ms, gpu_ms, speedup) in results
        if isnan(speedup)
            println("| $n | $combos | SKIPPED | $(round(gpu_ms, digits=3)) | - |")
        else
            println("| $n | $combos | $(round(cpu_ms, digits=3)) | $(round(gpu_ms, digits=3)) | $(round(speedup, digits=2))x |")
        end
    end

    println()
end

# ============================================================================
# Run Tests and Benchmarks
# ============================================================================

println("\n" * "="^80)
println("GPU INCLUSION-EXCLUSION BENCHMARK")
println("GPU: ", CUDA.name(CUDA.device()))
println("VRAM: ", CUDA.total_memory() / 1e9, " GB")
println("="^80)

# Run correctness tests first
correctness_passed = test_correctness()

if correctness_passed
    # Only run performance benchmarks if correctness tests pass
    benchmark_inclusion_exclusion()

    println("\n" * "="^80)
    println("✓ BENCHMARK COMPLETE!")
    println("="^80 * "\n")
else
    println("\n" * "="^80)
    println("✗ CORRECTNESS TESTS FAILED - Skipping performance benchmarks")
    println("="^80 * "\n")
end
