include(raw"c:\Users\ohian\OneDrive - University of Strathclyde\Documents\Programmming Files\Julia Files\InformationPropagation\Info_Prop_Framework_Project\src\Network-flow-algos\src\Algorithms\Capacity\CapacityAnalysis-v2\FailureImpactModule.jl")
using .FailureImpactModule

edgelist = Tuple{Int64,Int64}[
    (1, 2),
    (1, 3),
    (2, 4),
    (3, 4),
]

outgoing_index = Dict{Int64,Set{Int64}}(
    1 => Set{Int64}([2, 3]),
    2 => Set{Int64}([4]),
    3 => Set{Int64}([4]),
)

incoming_index = Dict{Int64,Set{Int64}}(
    2 => Set{Int64}([1]),
    3 => Set{Int64}([1]),
    4 => Set{Int64}([2, 3]),
)

capacities = Dict{Tuple{Int64,Int64},Float64}(
    (1, 2) => 1.0,
    (1, 3) => 1.0,
    (2, 4) => 1.0,
    (3, 4) => 1.0,
)

source_nodes = Int64[1]
sink_nodes = Int64[4]

flow_result = FailureImpactModule.FlowModule.solve_max_flow_dinic(
    edgelist,
    outgoing_index,
    incoming_index,
    capacities,
    source_nodes,
    sink_nodes;
    tol=1e-10,
    validate=true
)

result = analyze_failure_impact(
    edgelist,
    outgoing_index,
    incoming_index,
    capacities,
    source_nodes,
    sink_nodes,
    flow_result;
    k=2,
    scenarios=nothing,
    algorithm=:dinic,
    tol=1e-10,
    combination_limit=10_000
)

@assert !isempty(result.k_edge_failures)
@assert result.k_edge_failures[1].edges isa Vector{Tuple{Int64,Int64}}
@assert all(e -> e isa Tuple{Int64,Int64}, result.k_edge_failures[1].edges)

println("FailureImpactModule smoke passed")
