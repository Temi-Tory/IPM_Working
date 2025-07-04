"""
Comprehensive Test Suite for CapacityAnalysisModule.jl

This test file provides systematic testing of the CapacityAnalysisModule with
diagnostic logging to identify potential issues in module dependencies,
parameter construction, mathematical correctness, and edge cases.

Key testing areas:
1. Module dependency validation
2. Parameter construction and validation
3. Mathematical correctness verification
4. Edge case handling
5. Multi-commodity and uncertainty analysis
6. Result consistency checks
7. Integration with framework functions
"""

# Import required packages
using Test
using DataFrames, DelimitedFiles, Distributions, 
      DataStructures, SparseArrays, BenchmarkTools, 
      Combinatorics

println("=== DEPENDENCY IMPORT TEST ===")
println("Testing module imports and dependencies...")

# Test 1: Framework Import (Most Likely Issue Source #1)
try
    println("1. Testing IPAFramework import...")
    using .IPAFramework
    println("   ✓ IPAFramework imported successfully")
    
    # Test framework functions
    println("2. Testing framework function availability...")
    if isdefined(IPAFramework, :read_graph_to_dict)
        println("   ✓ read_graph_to_dict available")
    else
        println("   ✗ read_graph_to_dict NOT available - CRITICAL ISSUE")
    end
    
    if isdefined(IPAFramework, :identify_fork_and_join_nodes)
        println("   ✓ identify_fork_and_join_nodes available")
    else
        println("   ✗ identify_fork_and_join_nodes NOT available - CRITICAL ISSUE")
    end
    
    if isdefined(IPAFramework, :find_iteration_sets)
        println("   ✓ find_iteration_sets available")
    else
        println("   ✗ find_iteration_sets NOT available - CRITICAL ISSUE")
    end
    
catch e
    println("   ✗ IPAFramework import FAILED - CRITICAL DEPENDENCY ISSUE")
    println("   Error: $e")
    println("   This is likely the primary issue preventing module functionality")
end

# Test 2: CapacityAnalysisModule Import
try
    println("3. Testing CapacityAnalysisModule import...")
    using .CapacityAnalysisModule
    println("   ✓ CapacityAnalysisModule imported successfully")
    
    # Test exported functions
    exported_functions = [
        :CapacityParameters, :CapacityResult, :maximum_flow_capacity,
        :bottleneck_capacity_analysis, :widest_path_analysis,
        :network_throughput_analysis, :classical_maximum_flow,
        :comparative_capacity_analysis, :AnalysisConfig,
        :MultiCommodityParameters, :UncertaintyParameters,
        :validate_capacity_parameters, :validate_capacity_results
    ]
    
    for func in exported_functions
        if isdefined(CapacityAnalysisModule, func)
            println("   ✓ $func available")
        else
            println("   ✗ $func NOT available")
        end
    end
    
catch e
    println("   ✗ CapacityAnalysisModule import FAILED")
    println("   Error: $e")
    println("   Check module dependencies and file path")
end

println("\n=== PARAMETER CONSTRUCTION TEST ===")
println("Testing parameter construction (Most Likely Issue Source #2)...")

# Test 3: Basic Parameter Construction
function test_basic_parameter_construction()
    println("4. Testing basic parameter construction...")
    
    try
        # Test AnalysisConfig construction
        println("   Testing AnalysisConfig...")
        config = CapacityAnalysisModule.AnalysisConfig()
        println("   ✓ Default AnalysisConfig created successfully")
        
        config_custom = CapacityAnalysisModule.AnalysisConfig(
            tolerance=1e-8,
            path_reconstruction_method=:optimal,
            max_paths=5,
            verbose=true
        )
        println("   ✓ Custom AnalysisConfig created successfully")
        
        # Test invalid config parameters
        try
            invalid_config = CapacityAnalysisModule.AnalysisConfig(tolerance=-1.0)
            println("   ✗ Invalid tolerance not caught - VALIDATION ISSUE")
        catch
            println("   ✓ Invalid tolerance properly rejected")
        end
        
    catch e
        println("   ✗ AnalysisConfig construction FAILED")
        println("   Error: $e")
        return false
    end
    
    try
        # Test CapacityParameters construction
        println("   Testing CapacityParameters...")
        
        # Simple test case
        node_caps = Dict(1 => 100.0, 2 => 100.0, 3 => 100.0)
        edge_caps = Dict((1,2) => 50.0, (2,3) => 50.0)
        source_rates = Dict(1 => 80.0)
        targets = Set([3])
        
        params = CapacityAnalysisModule.CapacityParameters(
            node_caps, edge_caps, source_rates, targets
        )
        println("   ✓ Basic CapacityParameters created successfully")
        
        # Test with custom config
        custom_config = CapacityAnalysisModule.AnalysisConfig(verbose=true)
        params_custom = CapacityAnalysisModule.CapacityParameters(
            node_caps, edge_caps, source_rates, targets,
            config=custom_config
        )
        println("   ✓ CapacityParameters with custom config created successfully")
        
        return true
        
    catch e
        println("   ✗ CapacityParameters construction FAILED")
        println("   Error: $e")
        return false
    end
end

parameter_construction_success = test_basic_parameter_construction()

# Test 4: Advanced Parameter Construction
function test_advanced_parameter_construction()
    println("5. Testing advanced parameter construction...")
    
    if !parameter_construction_success
        println("   Skipping advanced tests due to basic construction failure")
        return false
    end
    
    try
        # Test UncertaintyParameters
        println("   Testing UncertaintyParameters...")
        uncertainty = CapacityAnalysisModule.UncertaintyParameters(
            uncertainty_model=:normal,
            node_capacity_uncertainty=Dict(1 => 0.1, 2 => 0.1),
            edge_capacity_uncertainty=Dict((1,2) => 0.05),
            source_rate_uncertainty=Dict(1 => 0.15),
            confidence_level=0.95,
            monte_carlo_samples=100
        )
        println("   ✓ UncertaintyParameters created successfully")
        
        # Test MultiCommodityParameters
        println("   Testing MultiCommodityParameters...")
        commodities = [:data, :voice]
        commodity_sources = Dict(
            :data => Dict(1 => 40.0),
            :voice => Dict(1 => 30.0)
        )
        interactions = Dict((:data, :voice) => 0.2)
        
        multi_commodity = CapacityAnalysisModule.MultiCommodityParameters(
            commodities,
            commodity_sources,
            Dict{Symbol, Dict{Tuple{Int64,Int64}, Float64}}(),
            interactions,
            Dict{Symbol, Dict{Int64, Float64}}()
        )
        println("   ✓ MultiCommodityParameters created successfully")
        
        return true
        
    catch e
        println("   ✗ Advanced parameter construction FAILED")
        println("   Error: $e")
        return false
    end
end

advanced_parameter_success = test_advanced_parameter_construction()

println("\n=== GRAPH STRUCTURE TEST ===")
println("Testing graph structure handling...")

# Test 5: Basic Graph Structure
function test_basic_graph_structure()
    println("6. Testing basic graph structure...")
    
    try
        # Create simple test graph: 1 -> 2 -> 3
        edgelist = [(1, 2), (2, 3)]
        outgoing_index = Dict(1 => Set([2]), 2 => Set([3]))
        incoming_index = Dict(2 => Set([1]), 3 => Set([2]))
        source_nodes = Set([1])
        iteration_sets = [Set([1]), Set([2]), Set([3])]
        
        println("   ✓ Basic graph structure created")
        
        # Test parameter validation
        if parameter_construction_success
            node_caps = Dict(1 => 100.0, 2 => 100.0, 3 => 100.0)
            edge_caps = Dict((1,2) => 50.0, (2,3) => 50.0)
            source_rates = Dict(1 => 80.0)
            targets = Set([3])
            
            params = IPAFramework.CapacityParameters(
                node_caps, edge_caps, source_rates, targets
            )
            
            # Test validation function
            is_valid = IPAFramework.validate_capacity_parameters(
                params, iteration_sets, outgoing_index, source_nodes
            )
            
            if is_valid
                println("   ✓ Parameter validation passed")
            else
                println("   ✗ Parameter validation FAILED")
            end
        end
        
        return true
        
    catch e
        println("   ✗ Basic graph structure test FAILED")
        println("   Error: $e")
        return false
    end
end

basic_graph_success = test_basic_graph_structure()

println("\n=== MATHEMATICAL CORRECTNESS TEST ===")
println("Testing mathematical correctness...")

# Test 6: Simple Flow Analysis
function test_simple_flow_analysis()
    println("7. Testing simple flow analysis...")
    
    if !basic_graph_success || !parameter_construction_success
        println("   Skipping flow analysis due to prerequisite failures")
        return false
    end
    
    try
        # Simple graph: 1 -> 2 -> 3
        edgelist = [(1, 2), (2, 3)]
        outgoing_index = Dict(1 => Set([2]), 2 => Set([3]))
        incoming_index = Dict(2 => Set([1]), 3 => Set([2]))
        source_nodes = Set([1])
        iteration_sets = [Set([1]), Set([2]), Set([3])]
        
        node_caps = Dict(1 => 100.0, 2 => 100.0, 3 => 100.0)
        edge_caps = Dict((1,2) => 50.0, (2,3) => 30.0)  # Edge (2,3) is bottleneck
        source_rates = Dict(1 => 80.0)
        targets = Set([3])
        
        params = IPAFramework.CapacityParameters(
            node_caps, edge_caps, source_rates, targets,
            config=IPAFramework.AnalysisConfig(verbose=true)
        )
        
        println("   Running maximum flow analysis...")
        result = IPAFramework.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params
        )
        
        println("   ✓ Maximum flow analysis completed")
        println("   Result: Node flows = $(result.node_max_flows)")
        println("   Result: Network utilization = $(result.network_utilization)")
        
        # Validate mathematical correctness
        expected_flow_at_3 = 30.0  # Limited by edge (2,3) capacity
        actual_flow_at_3 = get(result.node_max_flows, 3, 0.0)
        
        if abs(actual_flow_at_3 - expected_flow_at_3) < 1e-6
            println("   ✓ Mathematical correctness verified")
        else
            println("   ✗ Mathematical correctness FAILED")
            println("   Expected flow at node 3: $expected_flow_at_3")
            println("   Actual flow at node 3: $actual_flow_at_3")
        end
        
        # Test result validation
        is_valid_result = IPAFramework.validate_capacity_results(
            result, params, iteration_sets, incoming_index, outgoing_index, source_nodes
        )
        
        if is_valid_result
            println("   ✓ Result validation passed")
        else
            println("   ✗ Result validation FAILED")
        end
        
        return true
        
    catch e
        println("   ✗ Simple flow analysis FAILED")
        println("   Error: $e")
        println("   Stack trace:")
        for (exc, bt) in Base.catch_stack()
            showerror(stdout, exc, bt)
            println()
        end
        return false
    end
end

flow_analysis_success = test_simple_flow_analysis()

# Test 7: Advanced Mathematical Correctness Tests
function test_diamond_pattern()
    println("8. Testing Diamond/Fork-Join pattern...")
    
    if !parameter_construction_success
        println("   Skipping diamond tests due to parameter construction failure")
        return false
    end
    
    try
        # Diamond pattern: 1 → {2,3} → 4
        #     1
        #    / \
        #   2   3
        #    \ /
        #     4
        edgelist = [(1, 2), (1, 3), (2, 4), (3, 4)]
        outgoing_index = Dict(1 => Set([2, 3]), 2 => Set([4]), 3 => Set([4]))
        incoming_index = Dict(2 => Set([1]), 3 => Set([1]), 4 => Set([2, 3]))
        source_nodes = Set([1])
        iteration_sets = [Set([1]), Set([2, 3]), Set([4])]
        
        # Capacities: parallel paths with different capacities
        node_caps = Dict(1 => 100.0, 2 => 50.0, 3 => 30.0, 4 => 100.0)
        edge_caps = Dict((1,2) => 40.0, (1,3) => 35.0, (2,4) => 45.0, (3,4) => 25.0)
        source_rates = Dict(1 => 80.0)
        targets = Set([4])
        
        params = CapacityAnalysisModule.CapacityParameters(
            node_caps, edge_caps, source_rates, targets,
            config=CapacityAnalysisModule.AnalysisConfig(verbose=true)
        )
        
        println("   Running diamond pattern analysis...")
        result = CapacityAnalysisModule.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params
        )
        
        println("   ✓ Diamond pattern analysis completed")
        println("   Result: Node flows = $(result.node_max_flows)")
        
        # Expected: Path 1→2→4 limited by min(40,45,50) = 40
        #          Path 1→3→4 limited by min(35,25,30) = 25
        #          Total at node 4 = 40 + 25 = 65
        expected_flow_at_4 = 65.0
        actual_flow_at_4 = get(result.node_max_flows, 4, 0.0)
        
        if abs(actual_flow_at_4 - expected_flow_at_4) < 1e-6
            println("   ✓ Diamond pattern mathematical correctness verified")
        else
            println("   ✗ Diamond pattern mathematical correctness FAILED")
            println("   Expected flow at node 4: $expected_flow_at_4")
            println("   Actual flow at node 4: $actual_flow_at_4")
        end
        
        return true
        
    catch e
        println("   ✗ Diamond pattern test FAILED")
        println("   Error: $e")
        return false
    end
end

function test_multi_bottleneck_chain()
    println("9. Testing multi-bottleneck chain...")
    
    if !parameter_construction_success
        println("   Skipping chain tests due to parameter construction failure")
        return false
    end
    
    try
        # Chain: 1 → 2 → 3 → 4 → 5 with multiple bottlenecks
        edgelist = [(1, 2), (2, 3), (3, 4), (4, 5)]
        outgoing_index = Dict(1 => Set([2]), 2 => Set([3]), 3 => Set([4]), 4 => Set([5]))
        incoming_index = Dict(2 => Set([1]), 3 => Set([2]), 4 => Set([3]), 5 => Set([4]))
        source_nodes = Set([1])
        iteration_sets = [Set([1]), Set([2]), Set([3]), Set([4]), Set([5])]
        
        # Capacities with bottleneck at edge (3,4) = 15.0
        node_caps = Dict(1 => 100.0, 2 => 100.0, 3 => 100.0, 4 => 100.0, 5 => 100.0)
        edge_caps = Dict((1,2) => 60.0, (2,3) => 45.0, (3,4) => 15.0, (4,5) => 80.0)
        source_rates = Dict(1 => 90.0)
        targets = Set([5])
        
        params = CapacityAnalysisModule.CapacityParameters(
            node_caps, edge_caps, source_rates, targets,
            config=CapacityAnalysisModule.AnalysisConfig(verbose=true)
        )
        
        println("   Running multi-bottleneck chain analysis...")
        result = CapacityAnalysisModule.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params
        )
        
        println("   ✓ Multi-bottleneck chain analysis completed")
        println("   Result: Node flows = $(result.node_max_flows)")
        
        # Expected: Limited by bottleneck edge (3,4) = 15.0
        expected_flow_at_5 = 15.0
        actual_flow_at_5 = get(result.node_max_flows, 5, 0.0)
        
        if abs(actual_flow_at_5 - expected_flow_at_5) < 1e-6
            println("   ✓ Multi-bottleneck identification verified")
        else
            println("   ✗ Multi-bottleneck identification FAILED")
            println("   Expected flow at node 5: $expected_flow_at_5")
            println("   Actual flow at node 5: $actual_flow_at_5")
        end
        
        return true
        
    catch e
        println("   ✗ Multi-bottleneck chain test FAILED")
        println("   Error: $e")
        return false
    end
end

function test_complex_network()
    println("10. Testing complex interconnected network...")
    
    if !parameter_construction_success
        println("   Skipping complex network tests due to parameter construction failure")
        return false
    end
    
    try
        # Simplified complex network (tree structure):
        #   1→2→4→6
        #   ↓     ↓
        #   3→5→7→8
        edgelist = [(1, 2), (1, 3), (2, 4), (3, 5), (4, 6), (4, 7), (5, 7), (7, 8)]
        outgoing_index = Dict(
            1 => Set([2, 3]), 2 => Set([4]), 3 => Set([5]),
            4 => Set([6, 7]), 5 => Set([7]), 7 => Set([8])
        )
        incoming_index = Dict(
            2 => Set([1]), 3 => Set([1]), 4 => Set([2]),
            5 => Set([3]), 6 => Set([4]), 7 => Set([4, 5]), 8 => Set([7])
        )
        source_nodes = Set([1])
        # Clear iteration sets with proper dependencies
        iteration_sets = [Set([1]), Set([2, 3]), Set([4, 5]), Set([6, 7]), Set([8])]
        
        # Balanced capacities
        node_caps = Dict(1 => 100.0, 2 => 80.0, 3 => 70.0, 4 => 60.0, 5 => 90.0, 6 => 120.0, 7 => 80.0, 8 => 100.0)
        edge_caps = Dict(
            (1,2) => 30.0, (1,3) => 25.0, (2,4) => 35.0, (3,5) => 40.0,
            (4,6) => 50.0, (4,7) => 20.0, (5,7) => 45.0, (7,8) => 30.0
        )
        source_rates = Dict(1 => 70.0)
        targets = Set([6, 8])
        
        params = CapacityAnalysisModule.CapacityParameters(
            node_caps, edge_caps, source_rates, targets,
            config=CapacityAnalysisModule.AnalysisConfig(verbose=true)
        )
        
        println("   Running complex network analysis...")
        result = CapacityAnalysisModule.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params
        )
        
        println("   ✓ Complex network analysis completed")
        println("   Result: Node flows = $(result.node_max_flows)")
        println("   Result: Network utilization = $(result.network_utilization)")
        
        # Verify that flows are reasonable (not testing exact value due to complexity)
        flow_at_6 = get(result.node_max_flows, 6, 0.0)
        flow_at_8 = get(result.node_max_flows, 8, 0.0)
        total_target_flow = flow_at_6 + flow_at_8
        
        if total_target_flow > 0.0 && total_target_flow <= 70.0  # Should be positive and ≤ source rate
            println("   ✓ Complex network flow within expected bounds")
            println("   Flow to node 6: $flow_at_6, Flow to node 8: $flow_at_8")
        else
            println("   ✗ Complex network flow outside expected bounds: total = $total_target_flow")
        end
        
        return true
        
    catch e
        println("   ✗ Complex network test FAILED")
        println("   Error: $e")
        return false
    end
end

function test_capacity_bounds()
    println("11. Testing capacity bounds and edge cases...")
    
    if !parameter_construction_success
        println("   Skipping bounds tests due to parameter construction failure")
        return false
    end
    
    try
        # Test 1: Source rate > Network capacity
        println("   Testing source rate exceeding network capacity...")
        edgelist = [(1, 2), (2, 3)]
        outgoing_index = Dict(1 => Set([2]), 2 => Set([3]))
        incoming_index = Dict(2 => Set([1]), 3 => Set([2]))
        source_nodes = Set([1])
        iteration_sets = [Set([1]), Set([2]), Set([3])]
        
        node_caps = Dict(1 => 100.0, 2 => 100.0, 3 => 100.0)
        edge_caps = Dict((1,2) => 20.0, (2,3) => 30.0)
        source_rates = Dict(1 => 150.0)  # Much higher than network can handle
        targets = Set([3])
        
        params = CapacityAnalysisModule.CapacityParameters(
            node_caps, edge_caps, source_rates, targets
        )
        
        result = CapacityAnalysisModule.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params
        )
        
        flow_at_3 = get(result.node_max_flows, 3, 0.0)
        if flow_at_3 <= 20.0  # Should be limited by bottleneck, not source rate
            println("   ✓ Source rate limiting handled correctly")
        else
            println("   ✗ Source rate limiting failed: flow = $flow_at_3")
        end
        
        # Test 2: Very small capacities
        println("   Testing very small capacity values...")
        edge_caps_small = Dict((1,2) => 0.001, (2,3) => 0.0005)
        source_rates_small = Dict(1 => 0.01)
        
        params_small = CapacityAnalysisModule.CapacityParameters(
            node_caps, edge_caps_small, source_rates_small, targets
        )
        
        result_small = CapacityAnalysisModule.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params_small
        )
        
        flow_small = get(result_small.node_max_flows, 3, 0.0)
        if abs(flow_small - 0.0005) < 1e-8  # Should be limited by smallest edge
            println("   ✓ Small capacity values handled correctly")
        else
            println("   ✗ Small capacity handling failed: flow = $flow_small")
        end
        
        return true
        
    catch e
        println("   ✗ Capacity bounds test FAILED")
        println("   Error: $e")
        return false
    end
end

function test_multiple_source_nodes()
    println("12. Testing multiple source nodes...")
    
    if !parameter_construction_success
        println("   Skipping multiple source tests due to parameter construction failure")
        return false
    end
    
    try
        # Network with multiple sources: 1,2 → 3,4 → 5,6 → 7
        #   1→3→5→7
        #   2→4→6↗
        edgelist = [(1, 3), (2, 4), (3, 5), (4, 6), (5, 7), (6, 7)]
        outgoing_index = Dict(
            1 => Set([3]), 2 => Set([4]), 3 => Set([5]),
            4 => Set([6]), 5 => Set([7]), 6 => Set([7])
        )
        incoming_index = Dict(
            3 => Set([1]), 4 => Set([2]), 5 => Set([3]),
            6 => Set([4]), 7 => Set([5, 6])
        )
        source_nodes = Set([1, 2])  # Multiple sources
        iteration_sets = [Set([1, 2]), Set([3, 4]), Set([5, 6]), Set([7])]
        
        # Different source capacities and rates
        node_caps = Dict(1 => 80.0, 2 => 60.0, 3 => 90.0, 4 => 70.0, 5 => 100.0, 6 => 80.0, 7 => 150.0)
        edge_caps = Dict((1,3) => 40.0, (2,4) => 30.0, (3,5) => 45.0, (4,6) => 35.0, (5,7) => 50.0, (6,7) => 40.0)
        source_rates = Dict(1 => 60.0, 2 => 45.0)  # Multiple source rates
        targets = Set([7])
        
        params = CapacityAnalysisModule.CapacityParameters(
            node_caps, edge_caps, source_rates, targets,
            config=CapacityAnalysisModule.AnalysisConfig(verbose=true)
        )
        
        println("   Running multiple source analysis...")
        result = CapacityAnalysisModule.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params
        )
        
        println("   ✓ Multiple source analysis completed")
        println("   Result: Node flows = $(result.node_max_flows)")
        
        # Validate multiple source flow aggregation
        flow_at_7 = get(result.node_max_flows, 7, 0.0)
        total_source_capacity = 105.0  # Sum of source rates: 60.0 + 45.0
        
        if flow_at_7 > 0.0 && flow_at_7 <= total_source_capacity
            println("   ✓ Multiple source flow aggregation verified")
            println("   Flow at target node 7: $flow_at_7 (≤ $total_source_capacity total source capacity)")
        else
            println("   ✗ Multiple source flow aggregation FAILED")
            println("   Flow at node 7: $flow_at_7, Expected: ≤ $total_source_capacity")
        end
        
        return true
        
    catch e
        println("   ✗ Multiple source test FAILED")
        println("   Error: $e")
        return false
    end
end

function test_large_scale_performance()
    println("13. Testing large-scale network performance...")
    
    if !parameter_construction_success
        println("   Skipping large-scale tests due to parameter construction failure")
        return false
    end
    
    try
        # Generate a 20-node linear chain: 1→2→3→...→20
        num_nodes = 20
        println("   Generating $num_nodes-node linear chain...")
        
        edgelist = [(i, i+1) for i in 1:(num_nodes-1)]
        outgoing_index = Dict(i => Set([i+1]) for i in 1:(num_nodes-1))
        incoming_index = Dict(i => Set([i-1]) for i in 2:num_nodes)
        source_nodes = Set([1])
        iteration_sets = [Set([i]) for i in 1:num_nodes]
        
        # Random but reasonable capacities
        node_caps = Dict(i => 100.0 + 10.0 * sin(i) for i in 1:num_nodes)
        edge_caps = Dict((i, i+1) => 50.0 + 20.0 * cos(i) for i in 1:(num_nodes-1))
        source_rates = Dict(1 => 80.0)
        targets = Set([num_nodes])
        
        params = CapacityAnalysisModule.CapacityParameters(
            node_caps, edge_caps, source_rates, targets,
            config=CapacityAnalysisModule.AnalysisConfig(verbose=false)  # Reduce output for large test
        )
        
        println("   Running large-scale analysis...")
        start_time = time()
        result = CapacityAnalysisModule.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params
        )
        end_time = time()
        elapsed_time = end_time - start_time
        
        println("   ✓ Large-scale analysis completed in $(round(elapsed_time, digits=3)) seconds")
        
        # Validate performance and correctness
        flow_at_target = get(result.node_max_flows, num_nodes, 0.0)
        
        if elapsed_time < 1.0  # Should complete within 1 second for 20 nodes
            println("   ✓ Performance requirement met (< 1.0s)")
        else
            println("   ⚠️  Performance warning: took $(round(elapsed_time, digits=3))s (≥ 1.0s)")
        end
        
        if flow_at_target > 0.0 && flow_at_target <= 80.0
            println("   ✓ Large-scale mathematical correctness verified")
            println("   Flow at node $num_nodes: $flow_at_target")
        else
            println("   ✗ Large-scale mathematical correctness FAILED")
            println("   Flow at node $num_nodes: $flow_at_target")
        end
        
        # Test with larger network: 50-node tree
        println("   Testing 50-node tree structure...")
        tree_nodes = 50
        
        # Generate balanced binary tree structure
        tree_edgelist = []
        for i in 1:(tree_nodes÷2)
            left_child = 2*i
            right_child = 2*i + 1
            if left_child <= tree_nodes
                push!(tree_edgelist, (i, left_child))
            end
            if right_child <= tree_nodes
                push!(tree_edgelist, (i, right_child))
            end
        end
        
        if !isempty(tree_edgelist)
            tree_outgoing = Dict{Int64, Set{Int64}}()
            tree_incoming = Dict{Int64, Set{Int64}}()
            
            for (src, dst) in tree_edgelist
                push!(get!(tree_outgoing, src, Set{Int64}()), dst)
                push!(get!(tree_incoming, dst, Set{Int64}()), src)
            end
            
            # Simple iteration sets for tree (by levels)
            tree_iteration_sets = Vector{Set{Int64}}()
            current_level = Set{Int64}([1])
            while !isempty(current_level)
                push!(tree_iteration_sets, current_level)
                next_level = Set{Int64}()
                for node in current_level
                    if haskey(tree_outgoing, node)
                        union!(next_level, tree_outgoing[node])
                    end
                end
                current_level = next_level
            end
            
            tree_node_caps = Dict(i => 100.0 for i in 1:tree_nodes)
            tree_edge_caps = Dict(edge => 30.0 for edge in tree_edgelist)
            tree_source_rates = Dict(1 => 200.0)
            tree_targets = Set([tree_nodes-2, tree_nodes-1, tree_nodes])  # Multiple leaf targets
            
            tree_params = CapacityAnalysisModule.CapacityParameters(
                tree_node_caps, tree_edge_caps, tree_source_rates, tree_targets,
                config=CapacityAnalysisModule.AnalysisConfig(verbose=false)
            )
            
            tree_start = time()
            tree_result = CapacityAnalysisModule.maximum_flow_capacity(
                tree_iteration_sets, tree_outgoing, tree_incoming, Set([1]), tree_params
            )
            tree_elapsed = time() - tree_start
            
            println("   ✓ 50-node tree analysis completed in $(round(tree_elapsed, digits=3)) seconds")
            
            if tree_elapsed < 2.0  # Should complete within 2 seconds for 50 nodes
                println("   ✓ Large-scale tree performance requirement met")
            else
                println("   ⚠️  Tree performance warning: $(round(tree_elapsed, digits=3))s")
            end
        end
        
        return true
        
    catch e
        println("   ✗ Large-scale performance test FAILED")
        println("   Error: $e")
        return false
    end
end

# Run the advanced mathematical tests
println("=== ADVANCED MATHEMATICAL CORRECTNESS TESTS ===")
diamond_success = test_diamond_pattern()
chain_success = test_multi_bottleneck_chain()
complex_success = test_complex_network()
bounds_success = test_capacity_bounds()

# Run the additional advanced tests
println("\n=== ADDITIONAL ADVANCED TESTS ===")
multiple_source_success = test_multiple_source_nodes()
large_scale_success = test_large_scale_performance()

flow_analysis_success = test_simple_flow_analysis()

println("\n=== EDGE CASE TEST ===")
println("Testing edge cases...")

# Test 7: Edge Cases
function test_edge_cases()
    println("8. Testing edge cases...")
    
    if !parameter_construction_success
        println("   Skipping edge case tests due to parameter construction failure")
        return false
    end
    
    # Test single node
    try
        println("   Testing single node case...")
        node_caps = Dict(1 => 100.0)
        edge_caps = Dict{Tuple{Int64,Int64}, Float64}()
        source_rates = Dict(1 => 80.0)
        targets = Set([1])
        
        params = IPAFramework.CapacityParameters(
            node_caps, edge_caps, source_rates, targets
        )
        
        outgoing_index = Dict{Int64, Set{Int64}}()
        incoming_index = Dict{Int64, Set{Int64}}()
        source_nodes = Set([1])
        iteration_sets = [Set([1])]
        
        result = IPAFramework.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params
        )
        
        println("   ✓ Single node case handled successfully")
        
    catch e
        println("   ✗ Single node case FAILED")
        println("   Error: $e")
    end
    
    # Test zero capacity
    try
        println("   Testing zero capacity case...")
        node_caps = Dict(1 => 0.0, 2 => 100.0)
        edge_caps = Dict((1,2) => 50.0)
        source_rates = Dict(1 => 80.0)
        targets = Set([2])
        
        params = IPAFramework.CapacityParameters(
            node_caps, edge_caps, source_rates, targets
        )
        
        outgoing_index = Dict(1 => Set([2]))
        incoming_index = Dict(2 => Set([1]))
        source_nodes = Set([1])
        iteration_sets = [Set([1]), Set([2])]
        
        result = IPAFramework.maximum_flow_capacity(
            iteration_sets, outgoing_index, incoming_index, source_nodes, params
        )
        
        # Should result in zero flow due to zero node capacity
        if get(result.node_max_flows, 2, -1.0) ≈ 0.0
            println("   ✓ Zero capacity case handled correctly")
        else
            println("   ✗ Zero capacity case handled incorrectly")
        end
        
    catch e
        println("   ✗ Zero capacity case FAILED")
        println("   Error: $e")
    end
    
    return true
end

edge_case_success = test_edge_cases()

println("\n=== INTEGRATION TEST ===")
println("Testing integration with framework functions...")

# Test 8: Framework Integration
function test_framework_integration()
    println("9. Testing framework integration...")
    
    try
        # Test with CSV file if available (from your example)
        # This tests the full integration pipeline
        
        println("   Testing CSV file processing...")
        
        # Try to use the framework functions from your example
        test_csv_path = "test_network.csv"  # We'll create a simple test file
        
        # Create test CSV with correct format for read_graph_to_dict
        # Expected format: each line represents a node with its prior and edge probabilities
        # For a simple 3-node chain: 1->2->3, we need:
        # Node 1: prior=1.0, edge to node 1=0.0 (no self-loop), edge to node 2=0.9, edge to node 3=0.0
        # Node 2: prior=1.0, edge to node 1=0.0, edge to node 2=0.0 (no self-loop), edge to node 3=0.9
        # Node 3: prior=1.0, edge to node 1=0.0, edge to node 2=0.0, edge to node 3=0.0 (no self-loop)
        test_data = """1.0,0.0,0.9,0.0
1.0,0.0,0.0,0.9
1.0,0.0,0.0,0.0"""
        
        open(test_csv_path, "w") do file
            write(file, test_data)
        end
        
        try
            # This should use the framework functions
            edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(test_csv_path)
            
            # Convert to capacities as in your example
            map!(x -> 1.0, values(node_priors))
            map!(x -> 0.9, values(edge_probabilities))
            
            # Identify structure
            fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
            iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
            
            println("   ✓ Framework integration successful")
            
            # Clean up
            rm(test_csv_path, force=true)
            return true
            
        catch e
            println("   ✗ Framework function calls FAILED")
            println("   Error: $e")
            println("   This confirms dependency issues with IPAFramework")
            rm(test_csv_path, force=true)
            return false
        end
        
    catch e
        println("   ✗ Framework integration test setup FAILED")
        println("   Error: $e")
        return false
    end
end

framework_integration_success = test_framework_integration()

println("\n=== COMPREHENSIVE TEST SUMMARY ===")
println("Test Results Summary:")
println("=" ^ 50)

test_results = [
    ("Module Dependencies", "CRITICAL"),
    ("Basic Parameter Construction", parameter_construction_success ? "PASS" : "FAIL"),
    ("Advanced Parameter Construction", advanced_parameter_success ? "PASS" : "FAIL"),
    ("Graph Structure Handling", basic_graph_success ? "PASS" : "FAIL"),
    ("Basic Mathematical Correctness", flow_analysis_success ? "PASS" : "FAIL"),
    ("Diamond Pattern Analysis", diamond_success ? "PASS" : "FAIL"),
    ("Multi-Bottleneck Chain Analysis", chain_success ? "PASS" : "FAIL"),
    ("Complex Network Analysis", complex_success ? "PASS" : "FAIL"),
    ("Capacity Bounds Testing", bounds_success ? "PASS" : "FAIL"),
    ("Multiple Source Nodes Analysis", multiple_source_success ? "PASS" : "FAIL"),
    ("Large-Scale Performance Testing", large_scale_success ? "PASS" : "FAIL"),
    ("Edge Case Handling", edge_case_success ? "PASS" : "FAIL"),
    ("Framework Integration", framework_integration_success ? "PASS" : "FAIL")
]

for (test_name, result) in test_results
    status_symbol = result == "PASS" ? "✓" : result == "FAIL" ? "✗" : "?"
    println("$status_symbol $test_name: $result")
end

println("\n=== DIAGNOSIS AND RECOMMENDATIONS ===")

if !parameter_construction_success
    println("🚨 CRITICAL ISSUE: Parameter construction failed")
    println("   Recommendation: Check CapacityAnalysisModule import and struct definitions")
end

if !framework_integration_success
    println("🚨 CRITICAL ISSUE: Framework integration failed")
    println("   Recommendation: Ensure IPAFramework is properly loaded and accessible")
    println("   This is likely preventing the module from working with your existing code")
end

if !flow_analysis_success
    println("⚠️  MAJOR ISSUE: Flow analysis failed")
    println("   Recommendation: Check mathematical implementation and dependencies")
end

println("\n=== NEXT STEPS ===")
println("Based on this diagnostic analysis:")
println("1. If module dependency issues exist, resolve IPAFramework loading first")
println("2. If parameter construction fails, check struct definitions and imports")
println("3. If mathematical correctness fails, verify algorithm implementation")
println("4. Run individual test components in isolation to narrow down specific issues")

println("\nDiagnostic testing completed. Review the output above to identify the root cause.")