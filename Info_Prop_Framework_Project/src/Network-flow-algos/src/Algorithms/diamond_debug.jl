"""
Focused debugging script for diamond asymmetric flow issue
This script adds detailed logging to validate the diagnosis
"""

# Setup mock modules first
module MockNetworkDecomposition
    export DiamondsAtNode, Diamond
    
    struct Diamond
        relevant_nodes::Set{Int64}
        highest_nodes::Set{Int64}
        edgelist::Vector{Tuple{Int64, Int64}}
    end
    
    struct DiamondsAtNode
        diamond::Vector{Diamond}
        non_diamond_parents::Set{Int64}
        join_node::Int64
    end
end

module MockInputProcessing
    export Interval
    
    struct Interval
        lower::Float64
        upper::Float64
        
        function Interval(lower::Float64, upper::Float64)
            if lower > upper
                throw(ArgumentError("Lower bound must be ≤ upper bound"))
            end
            new(lower, upper)
        end
    end
    Interval(value::Float64) = Interval(value, value)
end

# Setup mock modules
eval(:(const NetworkDecompositionModule = $MockNetworkDecomposition))
eval(:(const InputProcessingModule = $MockInputProcessing))

# Include the actual module
include("CapacityAnalysisModule.jl")
using .CapacityAnalysisModule

function debug_diamond_asymmetric()
    println("=== DEBUGGING DIAMOND ASYMMETRIC FLOW ISSUE ===")
    
    # Create diamond network: 1 -> {2,3} -> 4
    edgelist = [(1, 2), (1, 3), (2, 4), (3, 4)]
    source_nodes = Set([1])
    target_nodes = Set([4])
    
    # Build network indices
    outgoing_index = Dict{Int64, Set{Int64}}()
    incoming_index = Dict{Int64, Set{Int64}}()
    
    for (src, dst) in edgelist
        push!(get!(outgoing_index, src, Set{Int64}()), dst)
        push!(get!(incoming_index, dst, Set{Int64}()), src)
    end
    
    iteration_sets = [Set([1]), Set([2, 3]), Set([4])]
    
    # Asymmetric edge capacities - this is the failing case
    node_caps = Dict(1 => 100.0, 2 => 50.0, 3 => 50.0, 4 => 100.0)
    edge_caps = Dict((1,2) => 45.0, (1,3) => 15.0, (2,4) => 40.0, (3,4) => 40.0)
    source_rates = Dict(1 => 80.0)
    
    println("\nNetwork Setup:")
    println("  Nodes: 1 -> {2,3} -> 4")
    println("  Node capacities: $node_caps")
    println("  Edge capacities: $edge_caps")
    println("  Source rates: $source_rates")
    
    println("\nExpected Analysis:")
    println("  Node 1: 80.0 (source rate)")
    println("  Node 2: min(45.0 edge, 50.0 node) = 45.0")
    println("  Node 3: min(15.0 edge, 50.0 node) = 15.0")
    println("  Node 4: 45.0 + 15.0 = 60.0 (sum of inputs, < 100.0 node capacity)")
    
    params = CapacityParameters(node_caps, edge_caps, source_rates, target_nodes)
    
    println("\n=== RUNNING ANALYSIS ===")
    result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, params)
    
    println("\nActual Results:")
    for node in [1, 2, 3, 4]
        actual_flow = get(result.node_max_flows, node, 0.0)
        println("  Node $node: $actual_flow")
    end
    
    # Check specific issue
    node4_flow = get(result.node_max_flows, 4, 0.0)
    expected_node4 = 60.0
    
    println("\n=== DIAGNOSIS ===")
    println("Node 4 Expected: $expected_node4")
    println("Node 4 Actual: $node4_flow")
    println("Difference: $(node4_flow - expected_node4)")
    
    if abs(node4_flow - expected_node4) > 1e-10
        println("\n❌ ISSUE CONFIRMED: Node 4 flow is incorrect")
        
        # Analyze possible causes
        node2_flow = get(result.node_max_flows, 2, 0.0)
        node3_flow = get(result.node_max_flows, 3, 0.0)
        
        println("\nDiagnostic Analysis:")
        println("  Node 2 flow: $node2_flow (should be 45.0)")
        println("  Node 3 flow: $node3_flow (should be 15.0)")
        println("  Sum of Node 2 + Node 3: $(node2_flow + node3_flow)")
        println("  Edge capacity (2,4): $(edge_caps[(2,4)])")
        println("  Edge capacity (3,4): $(edge_caps[(3,4)])")
        
        if node4_flow ≈ min(edge_caps[(2,4)], edge_caps[(3,4)])
            println("  🔍 DIAGNOSIS 1: Node 4 flow limited by min(outgoing edge capacities)")
            println("     This suggests flow aggregation is using min() instead of sum()")
        elseif node4_flow ≈ node2_flow + node3_flow - 5.0
            println("  🔍 DIAGNOSIS 2: Node 4 flow has unexplained 5.0 reduction")
            println("     This suggests a systematic error in flow calculation")
        else
            println("  🔍 DIAGNOSIS 3: Unknown flow calculation error")
        end
        
        # Check bottleneck information
        if haskey(result.bottlenecks, 4)
            bottleneck_info = result.bottlenecks[4]
            println("  Bottleneck at Node 4: $bottleneck_info")
        end
        
    else
        println("\n✅ Node 4 flow is correct")
    end
    
    return result
end

# Run the debug
result = debug_diamond_asymmetric()