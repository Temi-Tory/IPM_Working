# Tests/test_deterministic.jl
# Unit tests for deterministic capacity analysis

using Test

# UPDATED: Import via IPAFrameworkOptimized to avoid doc replacement warnings
push!(LOAD_PATH, joinpath(@__DIR__, "../../../"))
using IPAFrameworkOptimized: 
    NetworkTopology, BasicCapacityProblem, CapacityAnalysisOptions,
    CapacityAnalysisResult, BottleneckReport, ValidationReport,
    analyze_capacity, validate_capacity_result, quick_capacity_check

@testset "Deterministic Capacity Analysis Tests" begin
    
    @testset "Simple Linear Network" begin
        # Create simple linear DAG: 1 → 2 → 3
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
        
        topology = NetworkTopology(
            iteration_sets,
            outgoing_index,
            incoming_index,
            source_nodes
        )
        
        # Capacities: bottleneck at edge (2,3)
        node_capacities = Dict(
            1 => 100.0,
            2 => 100.0,
            3 => 100.0
        )
        edge_capacities = Dict(
            (1, 2) => 50.0,  # Can handle 50
            (2, 3) => 30.0   # Bottleneck: only 30
        )
        source_rates = Dict(1 => 50.0)
        target_nodes = Set([3])
        
        # Run analysis
        result = analyze_capacity(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes
        )
        
        # Max flow should be limited by edge (2,3) capacity = 30
        @test result.total_max_flow ≈ 30.0 atol=1e-6
        
        # Bottleneck should be edge capacity
        @test result.bottlenecks.bottleneck_type == :edge_capacity
        
        # Edge (2,3) should be in min-cut
        @test (2, 3) in result.bottlenecks.min_cut_edges
        
        # Validation should pass
        problem = BasicCapacityProblem(
            topology, node_capacities, edge_capacities,
            source_rates, target_nodes
        )
        validation = validate_capacity_result(result, problem)
        @test validation.all_checks_passed
    end
    
    @testset "Parallel Paths Network" begin
        # Create diamond: 1 → 2 → 4
        #                  1 → 3 → 4
        iteration_sets = [Set([1]), Set([2, 3]), Set([4])]
        outgoing_index = Dict(
            1 => Set([2, 3]),
            2 => Set([4]),
            3 => Set([4])
        )
        incoming_index = Dict(
            2 => Set([1]),
            3 => Set([1]),
            4 => Set([2, 3])
        )
        source_nodes = Set([1])
        
        topology = NetworkTopology(
            iteration_sets,
            outgoing_index,
            incoming_index,
             source_nodes
        )
        
        # Two paths with different capacities
        node_capacities = Dict(
            1 => 100.0,
            2 => 100.0,
            3 => 100.0,
            4 => 100.0
        )
        edge_capacities = Dict(
            (1, 2) => 30.0,  # Path 1: limited to 30
            (2, 4) => 50.0,
            (1, 3) => 20.0,  # Path 2: limited to 20
            (3, 4) => 50.0
        )
        source_rates = Dict(1 => 100.0)  # Plenty of source
        target_nodes = Set([4])
        
        # Run analysis
        result = analyze_capacity(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes
        )
        
        # Max flow should be sum of path capacities: 30 + 20 = 50
        @test result.total_max_flow ≈ 50.0 atol=1e-6
        
        # Validation
        problem = BasicCapacityProblem(
            topology, node_capacities, edge_capacities,
            source_rates, target_nodes
        )
        validation = validate_capacity_result(result, problem)
        @test validation.all_checks_passed
        @test validation.flow_conservation_satisfied
    end
    
    @testset "Node Processing Bottleneck" begin
        # Create network where node capacity is the constraint
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
        
        topology = NetworkTopology(
            iteration_sets,
            outgoing_index,
            incoming_index,
            source_nodes
        )
        
        # Node 2 has low processing capacity
        node_capacities = Dict(
            1 => 100.0,
            2 => 25.0,  # Bottleneck: can only process 25
            3 => 100.0
        )
        edge_capacities = Dict(
            (1, 2) => 100.0,  # Plenty of edge capacity
            (2, 3) => 100.0
        )
        source_rates = Dict(1 => 100.0)
        target_nodes = Set([3])
        
        # Run analysis
        result = analyze_capacity(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes
        )
        
        # Max flow limited by node 2 processing = 25
        @test result.total_max_flow ≈ 25.0 atol=1e-6
        
        # Bottleneck should be node processing
        @test result.bottlenecks.bottleneck_type == :node_processing
        
        # Node 2 should be saturated
        @test 2 in result.bottlenecks.saturated_nodes
        
        # Validation
        problem = BasicCapacityProblem(
            topology, node_capacities, edge_capacities,
            source_rates, target_nodes
        )
        validation = validate_capacity_result(result, problem)
        @test validation.all_checks_passed
    end
    
    @testset "Quick Capacity Check" begin
        # Simple test for quick API
        iteration_sets = [Set([1]), Set([2])]
        outgoing_index = Dict(1 => Set([2]))
        incoming_index = Dict(2 => Set([1]))
        source_nodes = Set([1])
        
        topology = NetworkTopology(
            iteration_sets,
            outgoing_index,
            incoming_index,
            source_nodes
        )
        
        result = quick_capacity_check(
            topology,
            node_capacities = Dict(1 => 50.0, 2 => 50.0),
            edge_capacities = Dict((1, 2) => 40.0),
            source_rates = Dict(1 => 50.0),
            target_nodes = Set([2])
        )
        
        @test result.max_flow ≈ 40.0 atol=1e-6
        @test result.validation_passed
        @test result.utilization >= 0.0
        @test result.utilization <= 1.0
    end
    
    @testset "Comparative Analysis" begin
        # Test realistic vs classical comparison
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
        
        topology = NetworkTopology(
            iteration_sets,
            outgoing_index,
            incoming_index,
            source_nodes
        )
        
        # Node bottleneck: node 2 low capacity
        node_capacities = Dict(
            1 => 100.0,
            2 => 30.0,  # Node bottleneck
            3 => 100.0
        )
        edge_capacities = Dict(
            (1, 2) => 100.0,
            (2, 3) => 100.0
        )
        source_rates = Dict(1 => 100.0)
        target_nodes = Set([3])
        
        options = CapacityAnalysisOptions(
            include_classical_comparison = true
        )
        
        result = analyze_capacity(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes,
            options = options
        )
        
        @test !isnothing(result.comparative_analysis)
        comp = result.comparative_analysis
        
        # Realistic should be limited by node (30)
        @test comp.realistic_max_flow ≈ 30.0 atol=1e-6
        
        # Classical should be higher (no node constraint)
        @test comp.classical_max_flow >= comp.realistic_max_flow
        
        # Primary limitation should be processing
        @test comp.primary_limitation == :processing
    end
    
end

println("\n✅ All deterministic capacity analysis tests completed successfully!")
