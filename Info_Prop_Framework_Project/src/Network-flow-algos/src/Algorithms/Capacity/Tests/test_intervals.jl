# Tests/test_intervals.jl
# Unit tests for exact interval capacity analysis

using Test
using IntervalArithmetic: interval

push!(LOAD_PATH, joinpath(@__DIR__, "../../../"))
using IPAFrameworkOptimized:
    NetworkTopology, BasicCapacityProblem, UncertainCapacityProblem,
    CapacityAnalysisOptions, analyze_capacity,
    analyze_capacity_uncertain, analyze_capacity_uncertain_validated,
    validate_capacity_result

function _build_linear_topology()
    iteration_sets = [Set([1]), Set([2]), Set([3])]
    outgoing_index = Dict(
        1 => Set([2]),
        2 => Set([3])
    )
    incoming_index = Dict(
        2 => Set([1]),
        3 => Set([2])
    )
    source_nodes = Set([1])

    return NetworkTopology(
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes
    )
end

@testset "Interval Capacity Analysis Tests" begin

    @testset "Exact Lower/Upper Bounds" begin
        topology = _build_linear_topology()

        node_capacities = Dict(
            1 => interval(100.0, 100.0),
            2 => interval(100.0, 100.0),
            3 => interval(100.0, 100.0)
        )
        edge_capacities = Dict(
            (1, 2) => interval(60.0, 60.0),
            (2, 3) => interval(25.0, 35.0)
        )
        source_rates = Dict(1 => interval(50.0, 50.0))
        target_nodes = Set([3])

        result = analyze_capacity_uncertain(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes
        )

        @test result.guaranteed_min_flow ≈ 25.0 atol=1e-6
        @test result.possible_max_flow ≈ 35.0 atol=1e-6
        @test result.uncertainty_range ≈ 10.0 atol=1e-6
        @test result.guaranteed_min_flow <= result.expected_flow <= result.possible_max_flow
        @test (2, 3) in result.robust_bottlenecks
        @test (2, 3) in result.potential_bottlenecks
    end

    @testset "Degenerate Intervals Match Deterministic" begin
        topology = _build_linear_topology()

        deterministic_node = Dict(1 => 100.0, 2 => 100.0, 3 => 100.0)
        deterministic_edge = Dict((1, 2) => 50.0, (2, 3) => 30.0)
        deterministic_source = Dict(1 => 50.0)
        target_nodes = Set([3])

        deterministic_result = analyze_capacity(
            topology,
            node_capacities = deterministic_node,
            edge_capacities = deterministic_edge,
            source_rates = deterministic_source,
            target_nodes = target_nodes
        )

        interval_result = analyze_capacity_uncertain(
            topology,
            node_capacities = Dict(k => interval(v, v) for (k, v) in deterministic_node),
            edge_capacities = Dict(k => interval(v, v) for (k, v) in deterministic_edge),
            source_rates = Dict(k => interval(v, v) for (k, v) in deterministic_source),
            target_nodes = target_nodes
        )

        @test interval_result.guaranteed_min_flow ≈ deterministic_result.total_max_flow atol=1e-6
        @test interval_result.possible_max_flow ≈ deterministic_result.total_max_flow atol=1e-6
        @test interval_result.uncertainty_range ≈ 0.0 atol=1e-6
    end

    @testset "Interval Validation Report" begin
        topology = _build_linear_topology()

        uncertain_problem = UncertainCapacityProblem(
            topology,
            Dict(
                1 => interval(90.0, 110.0),
                2 => interval(40.0, 60.0),
                3 => interval(90.0, 110.0)
            ),
            Dict(
                (1, 2) => interval(30.0, 70.0),
                (2, 3) => interval(35.0, 55.0)
            ),
            Dict(1 => interval(35.0, 65.0)),
            Set([3])
        )

        result = analyze_capacity_uncertain(uncertain_problem, CapacityAnalysisOptions())
        validation = validate_capacity_result(result, uncertain_problem)

        @test validation.all_checks_passed
        @test validation.bounds_consistent
        @test validation.worst_case_validation.all_checks_passed
        @test validation.best_case_validation.all_checks_passed
        @test result.guaranteed_min_flow <= result.possible_max_flow
    end

    @testset "Validated Uncertain API Wrapper" begin
        topology = _build_linear_topology()

        result, validation = analyze_capacity_uncertain_validated(
            topology,
            node_capacities = Dict(
                1 => interval(90.0, 100.0),
                2 => interval(45.0, 55.0),
                3 => interval(90.0, 100.0)
            ),
            edge_capacities = Dict(
                (1, 2) => interval(40.0, 60.0),
                (2, 3) => interval(35.0, 50.0)
            ),
            source_rates = Dict(1 => interval(30.0, 65.0)),
            target_nodes = Set([3])
        )

        @test validation.bounds_consistent
        @test !isnothing(validation.worst_case_validation)
        @test !isnothing(validation.best_case_validation)
        @test result.guaranteed_min_flow <= result.possible_max_flow
    end

    @testset "Monotonicity Under Widened Bounds" begin
        topology = _build_linear_topology()
        target_nodes = Set([3])

        narrow = analyze_capacity_uncertain(
            topology,
            node_capacities = Dict(
                1 => interval(95.0, 100.0),
                2 => interval(48.0, 52.0),
                3 => interval(95.0, 100.0)
            ),
            edge_capacities = Dict(
                (1, 2) => interval(45.0, 50.0),
                (2, 3) => interval(42.0, 46.0)
            ),
            source_rates = Dict(1 => interval(44.0, 48.0)),
            target_nodes = target_nodes
        )

        wide = analyze_capacity_uncertain(
            topology,
            node_capacities = Dict(
                1 => interval(90.0, 105.0),
                2 => interval(45.0, 55.0),
                3 => interval(90.0, 105.0)
            ),
            edge_capacities = Dict(
                (1, 2) => interval(40.0, 55.0),
                (2, 3) => interval(38.0, 50.0)
            ),
            source_rates = Dict(1 => interval(40.0, 52.0)),
            target_nodes = target_nodes
        )

        @test wide.guaranteed_min_flow <= narrow.guaranteed_min_flow + 1e-6
        @test wide.possible_max_flow >= narrow.possible_max_flow - 1e-6
    end
end

println("\n✅ All interval capacity analysis tests completed successfully!")
