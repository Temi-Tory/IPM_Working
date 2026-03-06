# Core/Types.jl
# Type definitions for Capacity Analysis Module
# All structs used throughout the capacity analysis system

using Dates

"""
Network topology structure - represents DAG structure
"""
struct NetworkTopology
    iteration_sets::Vector{Set{Int64}}
    outgoing_index::Dict{Int64, Set{Int64}}
    incoming_index::Dict{Int64, Set{Int64}}
    source_nodes::Set{Int64}
end

"""
Basic capacity problem definition - minimum required inputs
"""
struct BasicCapacityProblem
    topology::NetworkTopology
    node_capacities::Dict{Int64, Float64}
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64}
    source_rates::Dict{Int64, Float64}
    target_nodes::Set{Int64}
end

"""
Configuration options for capacity analysis
"""
struct CapacityAnalysisOptions
    # Algorithm selection
    algorithm::Symbol  # :ford_fulkerson_dag, :edmonds_karp, :dinic
    
    # Analysis scope
    compute_all_min_cuts::Bool
    enumerate_critical_paths::Bool
    max_paths_to_return::Int
    compute_upgrade_priorities::Bool
    
    # Comparative analysis
    include_classical_comparison::Bool
    
    # Optional demand targets
    target_demands::Union{Dict{Int64, Float64}, Nothing}
    
    # Optional cost weights
    edge_costs::Union{Dict{Tuple{Int64,Int64}, Float64}, Nothing}
    target_values::Union{Dict{Int64, Float64}, Nothing}
    
    # Performance tuning
    tolerance::Float64
    max_iterations::Int
    
    # Output control
    verbosity::Symbol  # :minimal, :standard, :verbose
    
    # Default constructor
    function CapacityAnalysisOptions(;
        algorithm::Symbol = :ford_fulkerson_dag,
        compute_all_min_cuts::Bool = false,
        enumerate_critical_paths::Bool = true,
        max_paths_to_return::Int = 10,
        compute_upgrade_priorities::Bool = true,
        include_classical_comparison::Bool = true,
        target_demands::Union{Dict{Int64, Float64}, Nothing} = nothing,
        edge_costs::Union{Dict{Tuple{Int64,Int64}, Float64}, Nothing} = nothing,
        target_values::Union{Dict{Int64, Float64}, Nothing} = nothing,
        tolerance::Float64 = 1e-10,
        max_iterations::Int = 100000,
        verbosity::Symbol = :standard
    )
        new(algorithm, compute_all_min_cuts, enumerate_critical_paths,
            max_paths_to_return, compute_upgrade_priorities,
            include_classical_comparison, target_demands, edge_costs,
            target_values, tolerance, max_iterations, verbosity)
    end
end

"""
Bottleneck report - detailed analysis of network constraints
"""
struct BottleneckReport{T}
    # Minimum cut identification
    min_cut_capacity::T
    min_cut_edges::Set{Tuple{Int64,Int64}}
    min_cut_nodes::Set{Int64}
    
    # Bottleneck classification
    bottleneck_type::Symbol  # :edge_capacity, :node_processing, :source_limited, :mixed
    capacity_gap::T
    
    # Saturated components
    saturated_edges::Vector{Tuple{Int64,Int64}}
    saturated_nodes::Vector{Int64}
    near_saturated_edges::Vector{Tuple{Tuple{Int64,Int64}, Float64}}
    near_saturated_nodes::Vector{Tuple{Int64, Float64}}
    
    # Spare capacity
    total_spare_edge_capacity::T
    total_spare_node_capacity::T
    
    # Detailed utilization
    utilization_by_component::Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}
end

"""
Edge upgrade recommendation
"""
struct EdgeUpgradeRecommendation{T}
    edge::Tuple{Int64,Int64}
    current_capacity::T
    current_flow::T
    current_utilization::Float64
    
    # Sensitivity analysis
    marginal_value::Float64  # ∂(max_flow)/∂(edge_capacity)
    
    # Recommended upgrade
    recommended_capacity::T
    expected_flow_increase::T
    
    # Priority
    priority_score::Float64  # 0.0 to 1.0
    rationale::String
end

"""
Node upgrade recommendation
"""
struct NodeUpgradeRecommendation{T}
    node::Int64
    current_capacity::T
    current_flow::T
    current_utilization::Float64
    
    marginal_value::Float64
    recommended_capacity::T
    expected_flow_increase::T
    priority_score::Float64
    rationale::String
end

"""
Upgrade analysis - prioritized recommendations
"""
struct UpgradeAnalysis{T}
    edge_priorities::Vector{EdgeUpgradeRecommendation{T}}
    node_priorities::Vector{NodeUpgradeRecommendation{T}}
    
    primary_bottleneck::String
    recommended_action::String
    investment_efficiency::Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}
end

"""
Flow path through network
"""
struct FlowPath{T}
    path::Vector{Int64}
    capacity::T
    flow::T
    is_saturated::Bool
    spare_capacity::T
    length::Int
    bottleneck_location::Union{Int64, Tuple{Int64,Int64}}
end

"""
Path analysis - critical paths and redundancy
"""
struct PathAnalysis{T}
    critical_paths::Vector{FlowPath{T}}
    path_redundancy::Dict{Tuple{Int64,Int64}, Int}
    single_points_of_failure::Vector{Union{Int64, Tuple{Int64,Int64}}}
    path_flow_distribution::Vector{Tuple{Vector{Int64}, T}}
end

"""
Comparative analysis - realistic vs classical
"""
struct ComparativeAnalysis
    # Realistic (considers node + edge capacities)
    realistic_max_flow::Float64
    realistic_bottleneck_type::Symbol
    
    # Classical (only edge capacities)
    classical_max_flow::Float64
    classical_min_cut::Set{Tuple{Int64,Int64}}
    
    # Gap analysis
    efficiency_loss::Float64
    capacity_gap::Float64
    
    # Interpretation
    primary_limitation::Symbol  # :transmission or :processing
    strategic_recommendation::String
    
    # Detailed breakdown
    transmission_bottlenecks::Vector{Tuple{Int64,Int64}}
    processing_bottlenecks::Vector{Int64}
    capacity_gaps_by_component::Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}
end

"""
Primary capacity analysis result
"""
struct CapacityAnalysisResult{T}
    # Maximum throughput
    total_max_flow::T
    target_flows::Dict{Int64, T}
    
    # System efficiency
    network_utilization::Float64
    
    # Component-level flows
    node_flows::Dict{Int64, T}
    edge_flows::Dict{Tuple{Int64,Int64}, T}
    
    # Bottleneck identification
    bottlenecks::BottleneckReport{T}
    
    # Optional detailed analyses
    upgrade_priorities::Union{UpgradeAnalysis{T}, Nothing}
    critical_paths::Union{PathAnalysis{T}, Nothing}
    comparative_analysis::Union{ComparativeAnalysis, Nothing}
    
    # Metadata
    analysis_timestamp::DateTime
    computation_time_ms::Float64
    algorithm_used::Symbol
    convergence_achieved::Bool
    exactness_guaranteed::Bool
end

"""
Validation report - mathematical correctness verification
"""
struct ValidationReport
    all_checks_passed::Bool
    
    # Flow conservation
    flow_conservation_satisfied::Bool
    conservation_violations::Vector{Tuple{Int64, Float64}}
    max_conservation_error::Float64
    
    # Capacity constraints
    capacity_constraints_satisfied::Bool
    capacity_violations::Vector{Tuple{Union{Int64, Tuple{Int64,Int64}}, Float64}}
    
    # Consistency checks
    total_source_rate::Float64
    total_target_flow::Float64
    flow_balance_satisfied::Bool
    
    # Optimality verification
    optimality_verified::Bool
    min_cut_capacity::Float64
    max_flow_value::Float64
    
    # Diagnostics
    warnings::Vector{String}
    errors::Vector{String}
end

# Export all types
export NetworkTopology, BasicCapacityProblem, CapacityAnalysisOptions,
       BottleneckReport, EdgeUpgradeRecommendation, NodeUpgradeRecommendation,
       UpgradeAnalysis, FlowPath, PathAnalysis, ComparativeAnalysis,
       CapacityAnalysisResult, ValidationReport
