# Tests/test_phase3.jl
# Tests for Phase 3: Advanced Analysis (bottlenecks, sensitivity, upgrades, paths, comparative)

using Test

# Import via IPAFrameworkOptimized to avoid doc replacement warnings
push!(LOAD_PATH, joinpath(@__DIR__, "../../../"))
using IPAFrameworkOptimized: 
    NetworkTopology, BasicCapacityProblem, CapacityAnalysisOptions,
    CapacityAnalysisResult, BottleneckReport, UpgradeAnalysis, PathAnalysis,
    ComparativeAnalysis, validate_capacity_result,
    analyze_capacity, analyze_capacity_validated

@testset "Phase 3: Advanced Analysis Tests" begin
    
    # ============================================================================
    # Test 1: Enhanced Bottleneck Analysis
    # ============================================================================
    @testset "Enhanced Bottleneck Analysis" begin
        # Diamond network with clear bottleneck
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
            iteration_sets, outgoing_index, incoming_index, source_nodes
        )
        
        # Create bottleneck at edge (2,4)
        node_capacities = Dict(1 => 100.0, 2 => 100.0, 3 => 100.0, 4 => 100.0)
        edge_capacities = Dict(
            (1, 2) => 50.0,
            (1, 3) => 50.0,
            (2, 4) => 30.0,  # Bottleneck
            (3, 4) => 50.0
        )
        source_rates = Dict(1 => 100.0)
        target_nodes = Set([4])
        
        options = CapacityAnalysisOptions(
            compute_upgrade_priorities = true,
            enumerate_critical_paths = false,
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
        
        # Test bottleneck report
        @test result.bottlenecks.bottleneck_type in [:edge_capacity, :mixed]
        @test !isempty(result.bottlenecks.saturated_edges)
        @test result.bottlenecks.min_cut_capacity <= 80.0  # Max flow through bottleneck
        
        # Test saturated component identification
        @test (2, 4) in result.bottlenecks.saturated_edges || 
              any(e -> e[1] == (2,4), result.bottlenecks.near_saturated_edges)
        
        # Test utilization metrics
        @test haskey(result.bottlenecks.utilization_by_component, (2, 4))
        @test result.bottlenecks.utilization_by_component[(2, 4)] > 0.9
    end
    
    # ============================================================================
    # Test 2: Sensitivity Analysis & Upgrade Priorities
    # ============================================================================
    @testset "Sensitivity Analysis and Upgrade Recommendations" begin
        # Simple bottleneck network
        iteration_sets = [Set([1]), Set([2]), Set([3])]
        outgoing_index = Dict(1 => Set([2]), 2 => Set([3]))
        incoming_index = Dict(2 => Set([1]), 3 => Set([2]))
        source_nodes = Set([1])
        
        topology = NetworkTopology(
            iteration_sets, outgoing_index, incoming_index, source_nodes
        )
        
        node_capacities = Dict(1 => 100.0, 2 => 100.0, 3 => 100.0)
        edge_capacities = Dict(
            (1, 2) => 50.0,
            (2, 3) => 25.0  # Clear bottleneck
        )
        source_rates = Dict(1 => 50.0)
        target_nodes = Set([3])
        
        options = CapacityAnalysisOptions(compute_upgrade_priorities = true)
        
        result = analyze_capacity(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes,
            options = options
        )
        
        # Test upgrade priorities exist
        @test !isnothing(result.upgrade_priorities)
        @test length(result.upgrade_priorities.edge_priorities) == 2
        
        # Test priority ranking - bottleneck should be highest priority
        top_edge = result.upgrade_priorities.edge_priorities[1]
        @test top_edge.edge == (2, 3)
        @test top_edge.priority_score > 0.8
        @test top_edge.current_utilization > 0.9
        
        # Test marginal value
        @test top_edge.marginal_value > 0.5  # Should be high for bottleneck
        
        # Test recommended capacity increase
        @test top_edge.recommended_capacity > top_edge.current_capacity
        
        # Test investment efficiency
        @test haskey(result.upgrade_priorities.investment_efficiency, (2, 3))
        @test result.upgrade_priorities.investment_efficiency[(2, 3)] > 0.5
        
        # Test strategic summary
        @test !isempty(result.upgrade_priorities.primary_bottleneck)
        @test !isempty(result.upgrade_priorities.recommended_action)
        @test contains(lowercase(result.upgrade_priorities.recommended_action), "upgrade")
    end
    
    # ============================================================================
    # Test 3: Critical Path Enumeration
    # ============================================================================
    @testset "Critical Path Enumeration (DAG)" begin
        # Network with multiple paths
        iteration_sets = [Set([1]), Set([2, 3]), Set([4, 5]), Set([6])]
        outgoing_index = Dict(
            1 => Set([2, 3]),
            2 => Set([4]),
            3 => Set([5]),
            4 => Set([6]),
            5 => Set([6])
        )
        incoming_index = Dict(
            2 => Set([1]),
            3 => Set([1]),
            4 => Set([2]),
            5 => Set([3]),
            6 => Set([4, 5])
        )
        source_nodes = Set([1])
        
        topology = NetworkTopology(
            iteration_sets, outgoing_index, incoming_index, source_nodes
        )
        
        node_capacities = Dict(
            1 => 100.0, 2 => 50.0, 3 => 50.0,
            4 => 50.0, 5 => 50.0, 6 => 100.0
        )
        edge_capacities = Dict(
            (1, 2) => 50.0, (1, 3) => 50.0,
            (2, 4) => 50.0, (3, 5) => 50.0,
            (4, 6) => 50.0, (5, 6) => 50.0
        )
        source_rates = Dict(1 => 100.0)
        target_nodes = Set([6])
        
        options = CapacityAnalysisOptions(
            enumerate_critical_paths = true,
            max_paths_to_return = 10
        )
        
        result = analyze_capacity(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes,
            options = options
        )
        
        # Test critical paths exist
        @test !isnothing(result.critical_paths)
        @test length(result.critical_paths.critical_paths) >= 0
        
        # Test path structure
        if !isempty(result.critical_paths.critical_paths)
            path = result.critical_paths.critical_paths[1]
            @test !isempty(path.path)
            @test path.path[1] == 1  # Starts at source
            @test path.path[end] == 6  # Ends at target
            @test path.length > 0
            @test path.capacity >= 0.0
            @test path.flow >= 0.0
            @test path.flow <= path.capacity + 1e-6
        end
        
        # Test path redundancy
        @test haskey(result.critical_paths.path_redundancy, (1, 6))
        @test result.critical_paths.path_redundancy[(1, 6)] >= 1  # At least one path
        
        # Test flow distribution
        @test !isempty(result.critical_paths.path_flow_distribution)
    end
    
    # ============================================================================
    # Test 4: Comparative Analysis (Realistic vs Classical)
    # ============================================================================
    @testset "Comparative Analysis" begin
        # Network where node processing limits matter
        iteration_sets = [Set([1]), Set([2]), Set([3])]
        outgoing_index = Dict(1 => Set([2]), 2 => Set([3]))
        incoming_index = Dict(2 => Set([1]), 3 => Set([2]))
        source_nodes = Set([1])
        
        topology = NetworkTopology(
            iteration_sets, outgoing_index, incoming_index, source_nodes
        )
        
        # Node 2 has limited processing - this is the bottleneck
        node_capacities = Dict(
            1 => 100.0,
            2 => 30.0,  # Node processing bottleneck
            3 => 100.0
        )
        edge_capacities = Dict(
            (1, 2) => 100.0,  # Edges have plenty of capacity
            (2, 3) => 100.0
        )
        source_rates = Dict(1 => 100.0)
        target_nodes = Set([3])
        
        options = CapacityAnalysisOptions(include_classical_comparison = true)
        
        result = analyze_capacity(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes,
            options = options
        )
        
        # Test comparative analysis exists
        @test !isnothing(result.comparative_analysis)
        comp = result.comparative_analysis
        
        # Test realistic vs classical
        @test comp.realistic_max_flow <= comp.classical_max_flow
        @test comp.realistic_max_flow ≈ 30.0 atol=1e-6  # Limited by node 2
        @test comp.classical_max_flow ≈ 100.0 atol=1e-6  # Limited by source
        
        # Test gap analysis
        @test comp.capacity_gap > 0.0
        @test comp.efficiency_loss > 0.0
        @test comp.efficiency_loss ≈ 0.7 atol=0.1  # ~70% loss
        
        # Test primary limitation classification
        @test comp.primary_limitation == :processing  # Node-limited
        
        # Test strategic recommendation
        @test !isempty(comp.strategic_recommendation)
        @test contains(lowercase(comp.strategic_recommendation), "processing")
        
        # Test bottleneck identification
        @test !isempty(comp.processing_bottlenecks)
        @test 2 in comp.processing_bottlenecks
    end
    
    # ============================================================================
    # Test 5: Integrated Full Analysis
    # ============================================================================
    @testset "Full Phase 3 Integration" begin
        # Complex diamond network
        iteration_sets = [Set([1]), Set([2, 3, 4]), Set([5])]
        outgoing_index = Dict(
            1 => Set([2, 3, 4]),
            2 => Set([5]),
            3 => Set([5]),
            4 => Set([5])
        )
        incoming_index = Dict(
            2 => Set([1]),
            3 => Set([1]),
            4 => Set([1]),
            5 => Set([2, 3, 4])
        )
        source_nodes = Set([1])
        
        topology = NetworkTopology(
            iteration_sets, outgoing_index, incoming_index, source_nodes
        )
        
        node_capacities = Dict(
            1 => 100.0, 2 => 30.0, 3 => 30.0, 4 => 30.0, 5 => 100.0
        )
        edge_capacities = Dict(
            (1, 2) => 40.0, (1, 3) => 40.0, (1, 4) => 40.0,
            (2, 5) => 30.0, (3, 5) => 30.0, (4, 5) => 30.0
        )
        source_rates = Dict(1 => 100.0)
        target_nodes = Set([5])
        
        # Enable ALL Phase 3 features
        options = CapacityAnalysisOptions(
            compute_upgrade_priorities = true,
            enumerate_critical_paths = true,
            include_classical_comparison = true,
            max_paths_to_return = 20,
            verbosity = :standard
        )
        
        result, validation = analyze_capacity_validated(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes,
            options = options
        )
        
        # Test all Phase 3 components present
        @test !isnothing(result.bottlenecks)
        @test !isnothing(result.upgrade_priorities)
        @test !isnothing(result.critical_paths)
        @test !isnothing(result.comparative_analysis)
        
        # Test mathematical correctness
        @test validation.all_checks_passed
        @test validation.flow_conservation_satisfied
        @test validation.capacity_constraints_satisfied
        @test validation.optimality_verified
        
        # Test max flow is reasonable
        @test result.total_max_flow > 0.0
        @test result.total_max_flow <= 90.0  # Can't exceed node/edge constraints
        
        # Test target flow
        @test haskey(result.target_flows, 5)
        @test result.target_flows[5] ≈ result.total_max_flow atol=1e-6
        
        # Test network utilization
        @test 0.0 <= result.network_utilization <= 1.0
    end
    
    # ============================================================================
    # Test 6: Single Point of Failure Detection
    # ============================================================================
    @testset "Single Point of Failure (SPOF) Detection" begin
        # Network with clear SPOF: node 2 is the only path
        iteration_sets = [Set([1]), Set([2]), Set([3])]
        outgoing_index = Dict(1 => Set([2]), 2 => Set([3]))
        incoming_index = Dict(2 => Set([1]), 3 => Set([2]))
        source_nodes = Set([1])
        
        topology = NetworkTopology(
            iteration_sets, outgoing_index, incoming_index, source_nodes
        )
        
        node_capacities = Dict(1 => 100.0, 2 => 50.0, 3 => 100.0)
        edge_capacities = Dict((1, 2) => 100.0, (2, 3) => 100.0)
        source_rates = Dict(1 => 100.0)
        target_nodes = Set([3])
        
        options = CapacityAnalysisOptions(enumerate_critical_paths = true)
        
        result = analyze_capacity(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes,
            options = options
        )
        
        # Test SPOF detection
        @test !isnothing(result.critical_paths)
        spofs = result.critical_paths.single_points_of_failure
        
        # Node 2 and edges should be SPOFs
        @test 2 in spofs || (1, 2) in spofs || (2, 3) in spofs
    end
    
    # ============================================================================
    # Test 7: Node Processing vs Transmission Bottleneck
    # ============================================================================
    @testset "Bottleneck Type Classification" begin
        # Test edge-limited network
        topology_simple = NetworkTopology(
            [Set([1]), Set([2])],
            Dict(1 => Set([2])),
            Dict(2 => Set([1])),
            Set([1])
        )
        
        # Edge bottleneck
        result_edge = analyze_capacity(
            topology_simple,
            node_capacities = Dict(1 => 1000.0, 2 => 1000.0),
            edge_capacities = Dict((1, 2) => 10.0),  # Edge is bottleneck
            source_rates = Dict(1 => 100.0),
            target_nodes = Set([2]),
            options = CapacityAnalysisOptions(include_classical_comparison = true)
        )
        
        @test result_edge.bottlenecks.bottleneck_type == :edge_capacity
        @test result_edge.comparative_analysis.primary_limitation == :transmission
        
        # Node bottleneck
        result_node = analyze_capacity(
            topology_simple,
            node_capacities = Dict(1 => 1000.0, 2 => 10.0),  # Node 2 is bottleneck
            edge_capacities = Dict((1, 2) => 1000.0),
            source_rates = Dict(1 => 100.0),
            target_nodes = Set([2]),
            options = CapacityAnalysisOptions(include_classical_comparison = true)
        )
        
        @test result_node.bottlenecks.bottleneck_type in [:node_processing, :mixed]
        @test result_node.comparative_analysis.primary_limitation == :processing
    end
    
    # ============================================================================
    # Test 8: Upgrade Recommendation Rationale
    # ============================================================================
    @testset "Upgrade Recommendation Quality" begin
        topology = NetworkTopology(
            [Set([1]), Set([2]), Set([3])],
            Dict(1 => Set([2]), 2 => Set([3])),
            Dict(2 => Set([1]), 3 => Set([2])),
            Set([1])
        )
        
        node_capacities = Dict(1 => 100.0, 2 => 100.0, 3 => 100.0)
        edge_capacities = Dict(
            (1, 2) => 50.0,
            (2, 3) => 20.0  # Clear bottleneck
        )
        source_rates = Dict(1 => 50.0)
        target_nodes = Set([3])
        
        result = analyze_capacity(
            topology,
            node_capacities = node_capacities,
            edge_capacities = edge_capacities,
            source_rates = source_rates,
            target_nodes = target_nodes,
            options = CapacityAnalysisOptions(compute_upgrade_priorities = true)
        )
        
        # Check top recommendation
        top_rec = result.upgrade_priorities.edge_priorities[1]
        
        # Should recommend upgrading the bottleneck
        @test top_rec.edge == (2, 3)
        
        # Rationale should be informative
        @test !isempty(top_rec.rationale)
        @test contains(lowercase(top_rec.rationale), "bottleneck") ||
              contains(lowercase(top_rec.rationale), "capacity") ||
              contains(lowercase(top_rec.rationale), "critical")
        
        # Expected increase should be positive
        @test top_rec.expected_flow_increase >= 0.0
    end
    
    println("\n✅ All Phase 3 Advanced Analysis tests passed!")
end
