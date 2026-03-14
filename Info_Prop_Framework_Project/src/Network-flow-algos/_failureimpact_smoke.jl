include("src/Algorithms/Capacity/CapacityAnalysis-v2/FailureImpactModule.jl")
using .FailureImpactModule
using .FailureImpactModule.FlowModule

function build_indexes(edgelist)
    outgoing = Dict{Int64,Set{Int64}}()
    incoming = Dict{Int64,Set{Int64}}()
    for (u,v) in edgelist
        if !haskey(outgoing, u)
            outgoing[u] = Set{Int64}()
        end
        push!(outgoing[u], v)
        if !haskey(incoming, v)
            incoming[v] = Set{Int64}()
        end
        push!(incoming[v], u)
    end
    return outgoing, incoming
end

# Base smoke graph
edgelist = Tuple{Int64,Int64}[(1,2),(1,3),(2,4),(3,4)]
outgoing, incoming = build_indexes(edgelist)
capacities = Dict{Tuple{Int64,Int64},Float64}(
    (1,2)=>5.0, (1,3)=>5.0, (2,4)=>5.0, (3,4)=>5.0
)
sources = Int64[1]
sinks = Int64[4]

baseline = solve_max_flow_dinic(edgelist, outgoing, incoming, capacities, sources, sinks; validate=true)
@assert baseline.max_flow == 10.0

single = analyze_single_edge_failures(edgelist, outgoing, incoming, capacities, sources, sinks, baseline)
@assert !isempty(single)
@assert haskey(single[1], :edge)
@assert haskey(single[1], :baseline_flow)
@assert haskey(single[1], :perturbed_flow)
@assert haskey(single[1], :drop)
@assert haskey(single[1], :is_critical)

known = filter(x -> x.edge == (1,2), single)
@assert length(known) == 1
@assert known[1].drop == 5.0
@assert known[1].is_critical == true

# k-edge failures: candidate-restricted and deterministic sorting
k2 = analyze_k_edge_failures(edgelist, outgoing, incoming, capacities, sources, sinks, baseline; k=2)
@assert !isempty(k2)
@assert haskey(k2[1], :edges)
@assert haskey(k2[1], :baseline_flow)
@assert haskey(k2[1], :perturbed_flow)
@assert haskey(k2[1], :drop)

candidate_edges = Set(x.edge for x in single)
for item in k2
    for e in item.edges
        @assert e in candidate_edges
    end
end
for i in 2:length(k2)
    prev = k2[i-1]
    curr = k2[i]
    @assert (prev.drop > curr.drop) || (prev.drop == curr.drop && prev.edges <= curr.edges)
end

# Degradation smoke (0.5 scaling => flow halves in this graph)
degrade = analyze_capacity_degradation(edgelist, outgoing, incoming, capacities, sources, sinks; scenarios=[0.5])
@assert length(degrade) == 1
@assert haskey(degrade[1], :scenario_id)
@assert haskey(degrade[1], :scenario_capacities)
@assert haskey(degrade[1], :max_flow)
@assert haskey(degrade[1], :sink_flow)
@assert haskey(degrade[1], :saturated_edges)
@assert haskey(degrade[1], :drop_from_baseline)
@assert degrade[1].max_flow == 5.0
@assert degrade[1].drop_from_baseline == 5.0

# Combination limit guard with large mincut-candidate set
n_parallel = 25
big_edges = Tuple{Int64,Int64}[]
big_caps = Dict{Tuple{Int64,Int64},Float64}()
for i in 1:n_parallel
    mid = Int64(2 + i)
    e1 = (1, mid)
    e2 = (mid, 100)
    push!(big_edges, e1)
    push!(big_edges, e2)
    big_caps[e1] = 1.0
    big_caps[e2] = 1.0
end
big_out, big_in = build_indexes(big_edges)
big_sources = Int64[1]
big_sinks = Int64[100]
big_baseline = solve_max_flow_dinic(big_edges, big_out, big_in, big_caps, big_sources, big_sinks; validate=true)

threw = false
msg = ""
try
    analyze_k_edge_failures(big_edges, big_out, big_in, big_caps, big_sources, big_sinks, big_baseline; k=3)
catch err
    if err isa ArgumentError
        threw = true
        msg = sprint(showerror, err)
    else
        rethrow(err)
    end
end
@assert threw
@assert occursin("combinations", msg)
@assert occursin("C(", msg)

# aggregate behavior for scenarios=nothing and k=0
agg = analyze_failure_impact(edgelist, outgoing, incoming, capacities, sources, sinks, baseline; k=0, scenarios=nothing)
@assert isempty(agg.k_edge_failures)
@assert isempty(agg.degradation_results)

println("All FailureImpactModule checks passed")
