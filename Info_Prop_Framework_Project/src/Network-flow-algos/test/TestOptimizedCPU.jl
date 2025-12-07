"""
Test Optimized CPU Implementation
Verifies correctness and measures speedup from eliminating Combinatorics.jl iterator
"""

# Check if this is the first run
if !@isdefined(optimized_cpu_test_initialized)
    println("First run - initializing...")

    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Import functions
    import .IPAFramework.ReachabilityModule: inclusion_exclusion_cpu

    global optimized_cpu_test_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# Reference Implementation (Old Combinatorics.jl version)
# ============================================================================

"""
Reference implementation using Combinatorics.jl for correctness comparison.
This is the OLD version before optimization.
"""
function inclusion_exclusion_reference(belief_values::Vector{Float64})
    combined_belief = 0.0
    num_beliefs = length(belief_values)

    for i in 1:num_beliefs
        for combination in combinations(belief_values, i)
            intersection_probability = prod(combination)
            if isodd(i)
                combined_belief += intersection_probability
            else
                combined_belief -= intersection_probability
            end
        end
    end
    return combined_belief
end

# ============================================================================
# Test Correctness
# ============================================================================

function test_correctness()
    println("\n" * "="^80)
    println("OPTIMIZED CPU CORRECTNESS TEST")
    println("="^80 * "\n")

    all_pass = true

    # Test case 1: Small n=2
    println("Test 1: n=2 (trivial case)")
    beliefs1 = [0.4, 0.6]
    ref1 = inclusion_exclusion_reference(beliefs1)
    opt1 = inclusion_exclusion_cpu(beliefs1)
    error1 = abs(ref1 - opt1) / max(abs(ref1), 1e-10)
    passed1 = error1 < 1e-13
    println("  Reference: $ref1")
    println("  Optimized: $opt1")
    println("  $(passed1 ? "✓ PASS" : "✗ FAIL") (error: $error1)\n")
    all_pass &= passed1

    # Test case 2: Medium n=10
    println("Test 2: n=10 (common case)")
    beliefs2 = rand(10) .* 0.5 .+ 0.3
    ref2 = inclusion_exclusion_reference(beliefs2)
    opt2 = inclusion_exclusion_cpu(beliefs2)
    error2 = abs(ref2 - opt2) / max(abs(ref2), 1e-10)
    passed2 = error2 < 1e-13
    println("  Reference: $ref2")
    println("  Optimized: $opt2")
    println("  $(passed2 ? "✓ PASS" : "✗ FAIL") (error: $error2)\n")
    all_pass &= passed2

    # Test case 3: Large n=13
    println("Test 3: n=13 (GPU threshold)")
    beliefs3 = rand(13) .* 0.5 .+ 0.3
    ref3 = inclusion_exclusion_reference(beliefs3)
    opt3 = inclusion_exclusion_cpu(beliefs3)
    error3 = abs(ref3 - opt3) / max(abs(ref3), 1e-10)
    passed3 = error3 < 1e-13
    println("  Reference: $ref3")
    println("  Optimized: $opt3")
    println("  $(passed3 ? "✓ PASS" : "✗ FAIL") (error: $error3)\n")
    all_pass &= passed3

    # Test case 4: Very large n=15
    println("Test 4: n=15 (large case)")
    beliefs4 = rand(15) .* 0.5 .+ 0.3
    ref4 = inclusion_exclusion_reference(beliefs4)
    opt4 = inclusion_exclusion_cpu(beliefs4)
    error4 = abs(ref4 - opt4) / max(abs(ref4), 1e-10)
    passed4 = error4 < 1e-10  # Relaxed tolerance for large n due to FP accumulation
    println("  Reference: $ref4")
    println("  Optimized: $opt4")
    println("  $(passed4 ? "✓ PASS" : "✗ FAIL") (error: $error4)\n")
    all_pass &= passed4

    # Test case 5: Multiple random tests
    println("Test 5: 100 random tests (n=5-12)")
    random_pass = true
    max_error = 0.0
    for _ in 1:100
        n = rand(5:12)
        beliefs = rand(n) .* 0.5 .+ 0.3
        ref = inclusion_exclusion_reference(beliefs)
        opt = inclusion_exclusion_cpu(beliefs)
        error = abs(ref - opt) / max(abs(ref), 1e-10)
        max_error = max(max_error, error)
        if error >= 1e-10  # Relaxed tolerance for FP differences
            random_pass = false
            println("  FAIL at n=$n: error=$error")
        end
    end
    println("  $(random_pass ? "✓ PASS" : "✗ FAIL"): Max error across 100 tests: $max_error\n")
    all_pass &= random_pass

    println("="^80)
    if all_pass
        println("✓ ALL CORRECTNESS TESTS PASSED!")
    else
        println("✗ SOME TESTS FAILED")
    end
    println("="^80 * "\n")

    return all_pass
end

# ============================================================================
# Benchmark Performance
# ============================================================================

function benchmark_cpu_optimization()
    println("\n" * "="^80)
    println("CPU OPTIMIZATION SPEEDUP BENCHMARK")
    println("="^80 * "\n")

    # Test at different n values to see where speedup occurs
    n_values = [2, 5, 10, 12, 13, 15]

    for n in n_values
        println("Benchmarking n=$n:")
        test_beliefs = rand(n) .* 0.5 .+ 0.3

        # Warm-up
        inclusion_exclusion_reference(test_beliefs)
        inclusion_exclusion_cpu(test_beliefs)

        # Benchmark reference (Combinatorics.jl version)
        println("  Reference (Combinatorics.jl)...")
        ref_times = Float64[]
        for _ in 1:5
            t = @elapsed begin
                for _ in 1:1000
                    inclusion_exclusion_reference(test_beliefs)
                end
            end
            push!(ref_times, t)
        end
        ref_time = minimum(ref_times)

        # Benchmark optimized (binary enumeration version)
        println("  Optimized (binary enumeration)...")
        opt_times = Float64[]
        for _ in 1:5
            t = @elapsed begin
                for _ in 1:1000
                    inclusion_exclusion_cpu(test_beliefs)
                end
            end
            push!(opt_times, t)
        end
        opt_time = minimum(opt_times)

        speedup = ref_time / opt_time
        println("  Reference: $(round(ref_time*1000, digits=3))ms (1000 calls)")
        println("  Optimized: $(round(opt_time*1000, digits=3))ms (1000 calls)")
        println("  Speedup: $(round(speedup, digits=2))x\n")
    end

    println("="^80 * "\n")
end

# ============================================================================
# Run Tests
# ============================================================================

println("\n" * "="^80)
println("OPTIMIZED CPU IMPLEMENTATION TEST")
println("="^80)

# Run correctness tests
correctness_passed = test_correctness()

if correctness_passed
    # Run performance benchmark
    benchmark_cpu_optimization()

    println("\n✓ Testing complete!")
else
    println("\n✗ Correctness tests failed - skipping benchmarks")
end
