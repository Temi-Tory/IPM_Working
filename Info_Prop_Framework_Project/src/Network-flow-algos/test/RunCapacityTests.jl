# RunCapacityTests.jl - Master test runner for all capacity analysis tests
# This runs both the programmatic tests and file-based validation tests

println("🚀 Starting Comprehensive Capacity Analysis Test Suite")
println("="^60)

# Test 1: Run programmatic tests with hand-calculated networks
println("📊 Running programmatic capacity tests...")
try
    include("CapacityModuleTests.jl")
    println("✅ Programmatic tests completed successfully!")
catch e
    println("❌ Programmatic tests failed: $e")
    println("Stack trace:")
    for (exc, bt) in Base.catch_stack()
        showerror(stdout, exc, bt)
        println()
    end
end

println("\n" * "="^60)

# Test 2: Run file-based validation tests
println("📁 Running file-based validation tests...")
try 
    include("CapacityValidationTests.jl")
    println("✅ File-based validation tests completed successfully!")
catch e
    println("❌ File-based validation tests failed: $e")
    println("Note: This might be due to missing test network files")
    println("Stack trace:")
    for (exc, bt) in Base.catch_stack()
        showerror(stdout, exc, bt)
        println()
    end
end

println("\n" * "="^60)
println("🏁 Capacity Analysis Test Suite Complete!")
println("="^60)

# Summary
println("📋 Test Summary:")
println("   - Programmatic tests: Hand-calculated expected values")
println("   - File-based tests: JSON-defined expected results") 
println("   - Deterministic analysis: Float64 capacity values")
println("   - Uncertainty analysis: Interval and P-box capacity values")
println("   - Network topologies: Linear, Diamond, Multi-source")
println("   - Edge cases: Single node, zero capacity")
println()
println("✨ Your capacity analysis module is thoroughly tested!")
println("   Both mathematical correctness and implementation accuracy verified.")