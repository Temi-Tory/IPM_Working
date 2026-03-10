# Capacity/CapacityAnalysisModule.jl
# Main module for network capacity analysis
# Phase 1: Deterministic capacity analysis with exact algorithms

module CapacityAnalysisModule

using Dates
using IntervalArithmetic

# Include core types (no module wrapper needed)
include("Core/Types.jl")

# Include algorithms (no module wrapper)
include("Algorithms/MaxFlow.jl")
include("Algorithms/MinCut.jl")
include("Algorithms/Paths.jl")

# Include analysis modules (Phase 3)
include("Analysis/Bottlenecks.jl")
include("Analysis/Sensitivity.jl")
include("Analysis/Recommendations.jl")
include("Analysis/Comparative.jl")

# Include core analysis
include("Core/DeterministicCore.jl")

# Include interval extension
include("Extensions/IntervalExtension.jl")

# Include validation
include("Core/Validation.jl")

# Export core types
export NetworkTopology, CapacityAnalysisOptions,
    BasicCapacityProblem, UncertainCapacityProblem,
    CapacityAnalysisResult, IntervalCapacityResult

# Export core analysis functions
export analyze_capacity_deterministic, validate_capacity_result, 
    quick_validate, print_validation_report

"""
High-level API: Analyze network capacity (deterministic)

# Arguments
- `topology`: NetworkTopology structure (from DiamondProcessingModule)
- `node_capacities`: Processing capacity for each node
- `edge_capacities`: Transmission capacity for each edge  
- `source_rates`: Input rate from each source node
- `target_nodes`: Set of target/sink nodes
- `options`: CapacityAnalysisOptions (optional configuration)

# Returns
- CapacityAnalysisResult with complete analysis

# Example
```julia
result = analyze_capacity(
    topology,
    node_capacities = Dict(1 => 100.0, 2 => 150.0),
    edge_capacities = Dict((1,2) => 80.0),
    source_rates = Dict(1 => 50.0),
    target_nodes = Set([5])
)

# Validate results
validation = validate_capacity_result(result, problem)
if validation.all_checks_passed
    println("Max flow: \$(result.total_max_flow)")
    println("Bottleneck: \$(result.bottlenecks.bottleneck_type)")
end
```
"""
function analyze_capacity(
    topology::NetworkTopology;
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64},
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)
    # Build problem
    problem = BasicCapacityProblem(
        topology,
        node_capacities,
        edge_capacities,
        source_rates,
        target_nodes
    )
    
    # Run analysis
    result = analyze_capacity_deterministic(problem, options)
    
    return result
end

"""
Analyze capacity and return result with validation report

# Returns
- `(result, validation)` tuple
"""
function analyze_capacity_validated(
    topology::NetworkTopology;
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64},
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)
    # Build problem
    problem = BasicCapacityProblem(
        topology,
        node_capacities,
        edge_capacities,
        source_rates,
        target_nodes
    )
    
    # Run analysis
    result = analyze_capacity_deterministic(problem, options)
    
    # Validate
    validation = validate_capacity_result(result, problem)
    
    return result, validation
end

"""
Analyze network capacity with interval uncertainty (exact bounds)

# Arguments
- `topology`: NetworkTopology structure (from DiamondProcessingModule)
- `node_capacities`: Interval processing capacity for each node
- `edge_capacities`: Interval transmission capacity for each edge
- `source_rates`: Interval source rates for each source node
- `target_nodes`: Set of target/sink nodes
- `options`: CapacityAnalysisOptions (optional configuration)

# Returns
- IntervalCapacityResult with guaranteed min/max throughput bounds
"""
function analyze_capacity_uncertain(
    topology::NetworkTopology;
    node_capacities::Dict{Int64, Interval{Float64}},
    edge_capacities::Dict{Tuple{Int64,Int64}, Interval{Float64}},
    source_rates::Dict{Int64, Interval{Float64}},
    target_nodes::Set{Int64},
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)
    problem = UncertainCapacityProblem(
        topology,
        node_capacities,
        edge_capacities,
        source_rates,
        target_nodes
    )

    return analyze_capacity_uncertain(problem, options)
end

"""
Analyze uncertain capacity and return interval result with validation report

# Returns
- `(result, validation)` tuple
"""
function analyze_capacity_uncertain_validated(
    topology::NetworkTopology;
    node_capacities::Dict{Int64, Interval{Float64}},
    edge_capacities::Dict{Tuple{Int64,Int64}, Interval{Float64}},
    source_rates::Dict{Int64, Interval{Float64}},
    target_nodes::Set{Int64},
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)
    problem = UncertainCapacityProblem(
        topology,
        node_capacities,
        edge_capacities,
        source_rates,
        target_nodes
    )

    result = analyze_capacity_uncertain(problem, options)
    validation = validate_capacity_result(result, problem)

    return result, validation
end

"""
Quick capacity check - returns only essential metrics

# Returns
- Named tuple: (max_flow, bottleneck_type, utilization, validation_passed)
"""
function quick_capacity_check(
    topology::NetworkTopology;
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64}
)
    # Build problem with minimal options
    problem = BasicCapacityProblem(
        topology,
        node_capacities,
        edge_capacities,
        source_rates,
        target_nodes
    )
    
    options = CapacityAnalysisOptions(
        enumerate_critical_paths = false,
        compute_upgrade_priorities = false,
        include_classical_comparison = false,
        verbosity = :minimal
    )
    
    # Run analysis
    result = analyze_capacity_deterministic(problem, options)
    
    # Quick validation
    validation_passed = quick_validate(result, problem)
    
    return (
        max_flow = result.total_max_flow,
        bottleneck_type = result.bottlenecks.bottleneck_type,
        utilization = result.network_utilization,
        validation_passed = validation_passed
    )
end

# Export main API functions
export analyze_capacity, analyze_capacity_validated,
       analyze_capacity_uncertain, analyze_capacity_uncertain_validated,
       quick_capacity_check

end # module CapacityAnalysisModule
