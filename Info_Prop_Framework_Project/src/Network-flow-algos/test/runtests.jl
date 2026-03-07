# test/runtests.jl
# Canonical test entrypoint for the refactored Capacity module.

using Test

println("🚀 Running refactored Capacity test suite")
println(repeat("=", 60))

const RUN_LEGACY_CAPACITY_TESTS = get(ENV, "RUN_LEGACY_CAPACITY_TESTS", "0") == "1"

@testset "Capacity Refactor Suite" begin
    @testset "Deterministic Capacity Tests" begin
        include(joinpath(@__DIR__, "../src/Algorithms/Capacity/Tests/test_deterministic.jl"))
    end

    @testset "Interval Capacity Tests" begin
        include(joinpath(@__DIR__, "../src/Algorithms/Capacity/Tests/test_intervals.jl"))
    end

    @testset "Phase 3: Advanced Analysis Tests" begin
        include(joinpath(@__DIR__, "../src/Algorithms/Capacity/Tests/test_phase3.jl"))
    end

    if RUN_LEGACY_CAPACITY_TESTS
        @testset "Legacy Capacity Tests (opt-in)" begin
            include(joinpath(@__DIR__, "CapacityModuleTests.jl"))
            include(joinpath(@__DIR__, "CapacityValidationTests.jl"))
        end
    else
        println("ℹ️  Skipping legacy capacity tests. Set RUN_LEGACY_CAPACITY_TESTS=1 to run them.")
    end
end

println(repeat("=", 60))
println("✅ Capacity refactor suite completed")
