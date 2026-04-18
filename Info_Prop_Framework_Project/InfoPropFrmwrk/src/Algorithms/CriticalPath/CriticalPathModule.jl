#= # Time analysis
task_durations::Dict{Int64, TimeUnit}              # Processing time per node
dependency_delays::Dict{Tuple{Int64,Int64}, TimeUnit}  # Edge delays

# Cost analysis  
node_costs::Dict{Int64, Float64}                   # Processing cost per node
edge_costs::Dict{Tuple{Int64,Int64}, Float64}      # Transition costs

# No node_priors needed - that's a probability concept
 =#
module CriticalPathModule
    using ..DiamondDecompositionModule
    using ..InputProcessingModule

    export CriticalPathParameters, CriticalPathResult, ExtendedCriticalPathResult,
           critical_path_analysis, backward_pass_analysis,
           # Standard combination functions
           max_combination, min_combination, sum_combination,
           # Standard propagation functions
           additive_propagation, multiplicative_propagation,
           # Time analysis exports
           NonNegativeTime, TimeUnit, TimeFlowParameters,
           time_critical_path, project_duration, critical_path_nodes,
           to_hours, from_hours, format_time_results


    include(joinpath(@__DIR__, "Internal", "TypesAndOperators.jl"))
    include(joinpath(@__DIR__, "Internal", "AlgorithmsAndUtilities.jl"))

end
