# CapacityModuleTests.jl - Comprehensive tests for capacity analysis modules
# Tests both deterministic and uncertainty-aware capacity analysis

# Check if this is the first run of the script for this julia repl session
if !@isdefined(capacity_test_initialized)
    println("Initializing Capacity Module Tests...")

    using DataFrames, DelimitedFiles, BenchmarkTools, Test
    
    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework
    
    global capacity_test_initialized = true
    println("Capacity test initialization complete!")
else
    println("Capacity tests already initialized - running tests...")
end

# Test utility functions
"""
Create a simple linear network: 1 -> 2 -> 3
Expected behavior: Flow is limited by minimum capacity in chain
"""
function create_linear_network()
    # Simple linear DAG: 1 -> 2 -> 3
    edgelist = [(1, 2), (2, 3)]
    
    # Build indices
    outgoing_index = Dict(
        1 => Set([2]),
        2 => Set([3]),
        3 => Set{Int64}()
    )
    
    incoming_index = Dict(
        1 => Set{Int64}(),
        2 => Set([1]),
        3 => Set([2])
    )
    
    source_nodes = Set([1])
    
    # Create iteration sets (topological order)
    iteration_sets = [Set([1]), Set([2]), Set([3])]
    
    return edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets
end

"""
Create a diamond network: 1 -> {2,3} -> 4
Expected behavior: Flows from 2 and 3 combine at node 4
"""
function create_diamond_network()
    # Diamond DAG: 1 -> 2 -> 4, 1 -> 3 -> 4
    edgelist = [(1, 2), (1, 3), (2, 4), (3, 4)]
    
    outgoing_index = Dict(
        1 => Set([2, 3]),
        2 => Set([4]),
        3 => Set([4]),
        4 => Set{Int64}()
    )
    
    incoming_index = Dict(
        1 => Set{Int64}(),
        2 => Set([1]),
        3 => Set([1]),
        4 => Set([2, 3])
    )
    
    source_nodes = Set([1])
    iteration_sets = [Set([1]), Set([2, 3]), Set([4])]
    
    return edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets
end

"""
Create a multi-source network: {1,2} -> 3 -> 4
Expected behavior: Flows from sources 1 and 2 combine
"""
function create_multi_source_network()
    # Multi-source DAG: 1 -> 3 -> 4, 2 -> 3 -> 4  
    edgelist = [(1, 3), (2, 3), (3, 4)]
    
    outgoing_index = Dict(
        1 => Set([3]),
        2 => Set([3]),
        3 => Set([4]),
        4 => Set{Int64}()
    )
    
    incoming_index = Dict(
        1 => Set{Int64}(),
        2 => Set{Int64}(),
        3 => Set([1, 2]),
        4 => Set([3])
    )
    
    source_nodes = Set([1, 2])
    iteration_sets = [Set([1, 2]), Set([3]), Set([4])]
    
    return edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets
end

# Test 1: Linear Network - Deterministic Analysis
println("\n=== TEST 1: Linear Network (Float64) ===")
edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets = create_linear_network()

# Capacities: Source=10, Node2=8, Node3=12, Edge1->2=6, Edge2->3=15
node_capacities = Dict(1 => 15.0, 2 => 8.0, 3 => 12.0)
edge_capacities = Dict((1,2) => 6.0, (2,3) => 15.0)
source_rates = Dict(1 => 10.0)
targets = Set([3])

params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)

println("Network: 1 -> 2 -> 3")
println("Source rate: 10, Node caps: [15,8,12], Edge caps: [6,15]")
println("Expected bottleneck: Edge 1->2 (capacity 6)")
println("Expected flow at node 3: 6.0")

result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, params)

println("Actual flow at node 3: $(result.node_max_flows[3])")
println("Network utilization: $(result.network_utilization)")

@test result.node_max_flows[3] ≈ 6.0
@test result.node_max_flows[2] ≈ 6.0  
@test result.node_max_flows[1] ≈ 10.0  # Source produces at its source rate
@test result.network_utilization ≈ 0.6  # 6/10 = 0.6

println("✅ Linear network test passed!")

# Test 2: Diamond Network - Deterministic Analysis
println("\n=== TEST 2: Diamond Network (Float64) ===")
edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets = create_diamond_network()

# Diamond: 1 splits to 2&3, then combines at 4
node_capacities = Dict(1 => 20.0, 2 => 8.0, 3 => 6.0, 4 => 20.0)
edge_capacities = Dict((1,2) => 10.0, (1,3) => 10.0, (2,4) => 8.0, (3,4) => 6.0)  
source_rates = Dict(1 => 15.0)
targets = Set([4])

params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)

println("Network: 1 -> {2,3} -> 4")
println("Source rate: 15, Split flows: path1=min(10,8)=8, path2=min(10,6)=6")
println("Expected flow at node 4: 8 + 6 = 14")

result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, params)

println("Actual flow at node 4: $(result.node_max_flows[4])")
println("Flow at node 2: $(result.node_max_flows[2])")
println("Flow at node 3: $(result.node_max_flows[3])")

@test result.node_max_flows[4] ≈ 14.0  # 8 + 6 = 14
@test result.node_max_flows[2] ≈ 8.0   # Limited by node 2 capacity
@test result.node_max_flows[3] ≈ 6.0   # Limited by node 3 capacity
@test result.network_utilization ≈ 14.0/15.0  # Total output / total input

println("✅ Diamond network test passed!")

# Test 3: Multi-Source Network
println("\n=== TEST 3: Multi-Source Network (Float64) ===")
edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets = create_multi_source_network()

node_capacities = Dict(1 => 10.0, 2 => 8.0, 3 => 12.0, 4 => 20.0)
edge_capacities = Dict((1,3) => 7.0, (2,3) => 5.0, (3,4) => 15.0)
source_rates = Dict(1 => 6.0, 2 => 4.0)  # Total input = 10
targets = Set([4])

params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)

println("Network: {1,2} -> 3 -> 4")  
println("Source rates: [6,4], Edge limits: [7,5], Node 3 limit: 12")
println("Expected flow at 3: min(6,7) + min(4,5) = 6 + 4 = 10")
println("Expected flow at 4: min(10,12,15) = 10")

result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, params)

println("Actual flow at node 4: $(result.node_max_flows[4])")
println("Flow at node 3: $(result.node_max_flows[3])")

@test result.node_max_flows[4] ≈ 10.0
@test result.node_max_flows[3] ≈ 10.0  
@test result.network_utilization ≈ 1.0  # 10/10 = 1.0 (100% utilization)

println("✅ Multi-source network test passed!")

# Test 4: Interval Uncertainty Analysis
println("\n=== TEST 4: Linear Network with Interval Uncertainty ===")
edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets = create_linear_network()

# Same network but with interval uncertainties
node_capacities = Dict(
    1 => Interval(14.0, 16.0), 
    2 => Interval(7.0, 9.0),    # Bottleneck node
    3 => Interval(11.0, 13.0)
)
edge_capacities = Dict(
    (1,2) => Interval(5.0, 7.0), # Bottleneck edge  
    (2,3) => Interval(14.0, 16.0)
)
source_rates = Dict(1 => Interval(9.0, 11.0))
targets = Set([3])

params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)

println("Network with intervals:")
println("Source: [9,11], Edge 1->2: [5,7], Node 2: [7,9]")
println("Expected bottleneck: Edge 1->2")  
println("Expected flow bounds at node 3: [5,7]")

result = maximum_flow_capacity_uncertain(iteration_sets, outgoing_index, incoming_index, source_nodes, params)

println("Actual flow bounds at node 3: [$(result.node_max_flows[3].lower), $(result.node_max_flows[3].upper)]")
println("Network utilization bounds: [$(result.network_utilization.lower), $(result.network_utilization.upper)]")

@test result.node_max_flows[3].lower ≈ 5.0
@test result.node_max_flows[3].upper ≈ 7.0
@test result.network_utilization.lower ≈ 5.0/11.0  # min_output/max_input
@test result.network_utilization.upper ≈ 7.0/9.0   # max_output/min_input

println("✅ Interval uncertainty test passed!")

# Test 5: P-box Uncertainty Analysis  
println("\n=== TEST 5: Diamond Network with P-box Uncertainty ===")
edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets = create_diamond_network()

# Create p-box uncertainties
node_capacities = Dict(
    1 => PBA.makepbox(PBA.interval(18.0, 22.0)),
    2 => PBA.makepbox(PBA.interval(7.0, 9.0)),
    3 => PBA.makepbox(PBA.interval(5.0, 7.0)), 
    4 => PBA.makepbox(PBA.interval(18.0, 22.0))
)
edge_capacities = Dict(
    (1,2) => PBA.makepbox(PBA.interval(9.0, 11.0)),
    (1,3) => PBA.makepbox(PBA.interval(9.0, 11.0)),
    (2,4) => PBA.makepbox(PBA.interval(7.0, 9.0)),
    (3,4) => PBA.makepbox(PBA.interval(5.0, 7.0))
)
source_rates = Dict(1 => PBA.makepbox(PBA.interval(14.0, 16.0)))
targets = Set([4])

params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)

println("Diamond network with p-box uncertainties:")
println("Expected: Path1 flow ∈ [7,9], Path2 flow ∈ [5,7]")
println("Expected: Total flow at 4 ∈ [12,16]")

result = maximum_flow_capacity_uncertain(iteration_sets, outgoing_index, incoming_index, source_nodes, params)

# Extract bounds from p-box results
node4_min = PBA.minimum(result.node_max_flows[4])
node4_max = PBA.maximum(result.node_max_flows[4])

# Handle the case where min/max might return intervals
node4_lower = isa(node4_min, PBA.Interval) ? node4_min.lo : node4_min
node4_upper = isa(node4_max, PBA.Interval) ? node4_max.hi : node4_max

println("Actual flow bounds at node 4: [$node4_lower, $node4_upper]")

@test node4_lower >= 12.0 - 0.1  # Allow small numerical tolerance
@test node4_upper <= 16.0 + 0.1

println("✅ P-box uncertainty test passed!")

# Performance comparison test
println("\n=== TEST 6: Performance Comparison ===")
edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets = create_diamond_network()

# Float64 version
node_caps_f64 = Dict(1 => 20.0, 2 => 8.0, 3 => 6.0, 4 => 20.0)
edge_caps_f64 = Dict((1,2) => 10.0, (1,3) => 10.0, (2,4) => 8.0, (3,4) => 6.0)
source_rates_f64 = Dict(1 => 15.0)
params_f64 = CapacityParameters(node_caps_f64, edge_caps_f64, source_rates_f64, targets)

# Interval version  
node_caps_int = Dict(1 => Interval(20.0, 20.0), 2 => Interval(8.0, 8.0), 
                     3 => Interval(6.0, 6.0), 4 => Interval(20.0, 20.0))
edge_caps_int = Dict((1,2) => Interval(10.0, 10.0), (1,3) => Interval(10.0, 10.0), 
                     (2,4) => Interval(8.0, 8.0), (3,4) => Interval(6.0, 6.0))
source_rates_int = Dict(1 => Interval(15.0, 15.0))
params_int = CapacityParameters(node_caps_int, edge_caps_int, source_rates_int, targets)

println("Benchmarking Float64 vs Interval analysis:")
time_f64 = @elapsed result_f64 = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, params_f64)
time_int = @elapsed result_int = maximum_flow_capacity_uncertain(iteration_sets, outgoing_index, incoming_index, source_nodes, params_int)

println("Float64 analysis time: $(round(time_f64*1000, digits=3)) ms")
println("Interval analysis time: $(round(time_int*1000, digits=3)) ms")
println("Overhead factor: $(round(time_int/time_f64, digits=2))x")

# Verify results are equivalent (deterministic intervals = Float64)
@test result_int.node_max_flows[4].lower ≈ result_f64.node_max_flows[4]
@test result_int.node_max_flows[4].upper ≈ result_f64.node_max_flows[4]

println("✅ Performance comparison completed!")

println("\n" * "="^50)
println("🎉 ALL CAPACITY MODULE TESTS PASSED! 🎉")
println("="^50)
println("Summary:")
println("- ✅ Deterministic capacity analysis works correctly")
println("- ✅ Interval uncertainty analysis provides exact bounds") 
println("- ✅ P-box uncertainty analysis handles distributions")
println("- ✅ Multiple network topologies supported")
println("- ✅ Performance is reasonable for uncertainty analysis")
println("- ✅ Mathematical correctness verified by hand calculations")