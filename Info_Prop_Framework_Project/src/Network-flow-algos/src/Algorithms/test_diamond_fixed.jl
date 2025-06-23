# Simple test to verify the diamond asymmetric flow fix

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

println("=== Testing Diamond Asymmetric Flow (Fixed) ===")

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

# Asymmetric edge capacities
node_caps = Dict(1 => 100.0, 2 => 50.0, 3 => 50.0, 4 => 100.0)
edge_caps = Dict((1,2) => 45.0, (1,3) => 15.0, (2,4) => 40.0, (3,4) => 40.0)
source_rates = Dict(1 => 80.0)

println("Network Setup:")
println("  Edge capacities: $edge_caps")
println("  Expected Node 4 flow: 55.0 (40.0 from path 1->2->4 + 15.0 from path 1->3->4)")

params = CapacityParameters(node_caps, edge_caps, source_rates, target_nodes)
result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, params)

println("\nActual Results:")
for node in [1, 2, 3, 4]
    actual_flow = get(result.node_max_flows, node, 0.0)
    println("  Node $node: $actual_flow")
end

# Test the corrected expectation
expected_flows = Dict(1 => 80.0, 2 => 45.0, 3 => 15.0, 4 => 55.0)

println("\nTest Results:")
all_passed = true
for (node, expected_flow) in expected_flows
    actual_flow = get(result.node_max_flows, node, 0.0)
    if abs(actual_flow - expected_flow) <= 1e-10
        println("  ✓ Node $node: Expected $expected_flow, Got $actual_flow - PASSED")
    else
        println("  ✗ Node $node: Expected $expected_flow, Got $actual_flow - FAILED")
        all_passed = false
    end
end

if all_passed
    println("\n✅ Diamond asymmetric flow test PASSED - Algorithm is mathematically correct!")
else
    println("\n❌ Diamond asymmetric flow test FAILED")
end