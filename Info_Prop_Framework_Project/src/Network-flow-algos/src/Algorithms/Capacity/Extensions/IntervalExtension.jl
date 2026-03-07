# Extensions/IntervalExtension.jl
# Exact interval extension for capacity analysis
# Computes guaranteed bounds via deterministic lower/upper scenarios

using IntervalArithmetic

if !isdefined(@__MODULE__, :UncertainCapacityProblem)
    include("../Core/Types.jl")
end
if !isdefined(@__MODULE__, :analyze_capacity_deterministic)
    include("../Core/DeterministicCore.jl")
end

"""
Convert interval-valued dictionary to lower-bound Float64 dictionary
"""
function _interval_dict_lower(dict::Dict{K, Interval{Float64}}) where {K}
    return Dict{K, Float64}(key => inf(value) for (key, value) in dict)
end

"""
Convert interval-valued dictionary to upper-bound Float64 dictionary
"""
function _interval_dict_upper(dict::Dict{K, Interval{Float64}}) where {K}
    return Dict{K, Float64}(key => sup(value) for (key, value) in dict)
end

"""
Collect bottleneck components (nodes and edges) for robust/potential set comparisons
"""
function _collect_bottleneck_components(result::CapacityAnalysisResult{Float64})
    components = Set{Union{Int64, Tuple{Int64,Int64}}}()
    union!(components, result.bottlenecks.min_cut_edges)
    union!(components, result.bottlenecks.min_cut_nodes)
    return components
end

"""
Rank uncertain components by interval width (larger width first)
"""
function _rank_uncertain_components(
    node_capacities::Dict{Int64, Interval{Float64}},
    edge_capacities::Dict{Tuple{Int64,Int64}, Interval{Float64}}
)
    ranked = Tuple{Union{Int64, Tuple{Int64,Int64}}, Float64}[]

    for (node, capacity) in node_capacities
        push!(ranked, (node, sup(capacity) - inf(capacity)))
    end

    for (edge, capacity) in edge_capacities
        push!(ranked, (edge, sup(capacity) - inf(capacity)))
    end

    sort!(ranked, by = item -> item[2], rev = true)
    return ranked
end

"""
Analyze uncertain capacity problem with exact interval bounds.

Exactness guarantee is obtained via monotonicity of max-flow in capacities:
- lower scenario: all capacities/sources at lower bounds
- upper scenario: all capacities/sources at upper bounds
"""
function analyze_capacity_uncertain(
    problem::UncertainCapacityProblem,
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)
    topology = problem.topology

    # Worst-case scenario (guaranteed lower bound)
    worst_problem = BasicCapacityProblem(
        topology,
        _interval_dict_lower(problem.node_capacities),
        _interval_dict_lower(problem.edge_capacities),
        _interval_dict_lower(problem.source_rates),
        problem.target_nodes
    )

    # Best-case scenario (possible upper bound)
    best_problem = BasicCapacityProblem(
        topology,
        _interval_dict_upper(problem.node_capacities),
        _interval_dict_upper(problem.edge_capacities),
        _interval_dict_upper(problem.source_rates),
        problem.target_nodes
    )

    worst_result = analyze_capacity_deterministic(worst_problem, options)
    best_result = analyze_capacity_deterministic(best_problem, options)

    guaranteed_min_flow = worst_result.total_max_flow
    possible_max_flow = best_result.total_max_flow
    expected_flow = (guaranteed_min_flow + possible_max_flow) / 2.0
    uncertainty_range = possible_max_flow - guaranteed_min_flow

    worst_components = _collect_bottleneck_components(worst_result)
    best_components = _collect_bottleneck_components(best_result)

    robust_bottlenecks = intersect(worst_components, best_components)
    potential_bottlenecks = union(worst_components, best_components)

    components_most_uncertain = _rank_uncertain_components(
        problem.node_capacities,
        problem.edge_capacities
    )

    return IntervalCapacityResult(
        guaranteed_min_flow,
        possible_max_flow,
        expected_flow,
        uncertainty_range,
        robust_bottlenecks,
        potential_bottlenecks,
        worst_result,
        best_result,
        components_most_uncertain
    )
end

export analyze_capacity_uncertain
