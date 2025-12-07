"""
Test Hybrid CPU/GPU Dispatch for Inclusion-Exclusion
Verifies that the dispatch logic works and GPU/CPU produce identical results
"""

# Check if this is the first run
if !@isdefined(hybrid_test_initialized)
    println("First run - initializing...")

    using CUDA
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Import both CPU and hybrid versions
    import .IPAFramework.ReachabilityModule: inclusion_exclusion, inclusion_exclusion_cpu

    global hybrid_test_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# Test Hybrid Dispatch Logic
# ============================================================================

function test_hybrid_dispatch()
    println("\n" * "="^80)
    println("HYBRID CPU/GPU DISPATCH TEST")
    println("="^80 * "\n")

    println("GPU Status: ", CUDA.functional() ? "Available ✓" : "Not available ✗")
    if CUDA.functional()
        println("GPU Device: ", CUDA.name(CUDA.device()))
    end
    println()

    # Test cases with different n values
    test_cases = [
        ("Small n=2 (should use CPU)", 2, rand(2) .* 0.5 .+ 0.3),
        ("Medium n=10 (should use CPU)", 10, rand(10) .* 0.5 .+ 0.3),
        ("Threshold n=13 (should use GPU)", 13, rand(13) .* 0.5 .+ 0.3),
        ("Large n=15 (should use GPU)", 15, rand(15) .* 0.5 .+ 0.3),
        ("Very large n=18 (should use GPU)", 18, rand(18) .* 0.5 .+ 0.3),
    ]

    all_passed = true

    for (name, n, values) in test_cases
        println("Test: $name")

        # Get CPU result
        cpu_result = inclusion_exclusion_cpu(values)
        println("  CPU result: $cpu_result")

        # Get hybrid result (will dispatch to GPU if conditions met)
        hybrid_result = inclusion_exclusion(values, use_gpu=true, gpu_threshold=13)
        println("  Hybrid result: $hybrid_result")

        # Check if they match
        relative_error = abs(cpu_result - hybrid_result) / max(abs(cpu_result), 1e-10)
        passed = relative_error < 1e-9

        if passed
            println("  ✓ PASS (error: $relative_error)")
        else
            println("  ✗ FAIL (error: $relative_error)")
            all_passed = false
        end
        println()
    end

    # Test with GPU disabled
    println("Test: GPU disabled (use_gpu=false)")
    test_values = rand(15) .* 0.5 .+ 0.3
    cpu_result = inclusion_exclusion_cpu(test_values)
    hybrid_result = inclusion_exclusion(test_values, use_gpu=false)
    relative_error = abs(cpu_result - hybrid_result) / max(abs(cpu_result), 1e-10)
    passed = relative_error < 1e-9

    if passed
        println("  ✓ PASS (correctly fell back to CPU)")
    else
        println("  ✗ FAIL")
        all_passed = false
    end
    println()

    println("="^80)
    if all_passed
        println("✓ ALL TESTS PASSED!")
    else
        println("✗ SOME TESTS FAILED")
    end
    println("="^80 * "\n")

    return all_passed
end

# ============================================================================
# Quick Performance Check
# ============================================================================

function quick_performance_check()
    println("\n" * "="^80)
    println("QUICK PERFORMANCE CHECK")
    println("="^80 * "\n")

    n = 15
    values = rand(n) .* 0.5 .+ 0.3

    # Benchmark CPU
    print("CPU (n=$n): ")
    cpu_times = Float64[]
    for _ in 1:5
        t = @elapsed inclusion_exclusion_cpu(values)
        push!(cpu_times, t)
    end
    cpu_time = minimum(cpu_times)
    println("$(cpu_time*1000) ms")

    # Benchmark hybrid (should use GPU)
    print("Hybrid/GPU (n=$n): ")
    hybrid_times = Float64[]
    for _ in 1:5
        t = @elapsed inclusion_exclusion(values, use_gpu=true, gpu_threshold=13)
        push!(hybrid_times, t)
    end
    hybrid_time = minimum(hybrid_times)
    println("$(hybrid_time*1000) ms")

    speedup = cpu_time / hybrid_time
    println("\nSpeedup: $(round(speedup, digits=2))x")

    println("="^80 * "\n")
end

# ============================================================================
# Run Tests
# ============================================================================

println("\n" * "="^80)
println("TESTING HYBRID CPU/GPU DISPATCH IMPLEMENTATION")
println("="^80)

correctness_passed = test_hybrid_dispatch()

if correctness_passed && CUDA.functional()
    quick_performance_check()
end

println("\n✓ Testing complete!")
