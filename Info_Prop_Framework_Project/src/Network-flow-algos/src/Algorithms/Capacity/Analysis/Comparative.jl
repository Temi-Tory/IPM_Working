# Analysis/Comparative.jl
# Comparative analysis: realistic vs classical max-flow
# Phase 3: Advanced Analysis

# Conditional includes for standalone use
if !isdefined(@__MODULE__, :ComparativeAnalysis)
    include("../Core/Types.jl")
end
if !isdefined(@__MODULE__, :compute_classical_max_flow)
    include("../Algorithms/MaxFlow.jl")
end

"""
Perform comprehensive comparative analysis

Compares:
- Realistic analysis (edges + nodes)
- Classical analysis (edges only)

Shows impact of node processing limits on network capacity
"""
function perform_comparative_analysis(
    topology::NetworkTopology,
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64},
    realistic_max_flow::Float64,
    realistic_bottlenecks::BottleneckReport{Float64};
    compute_classical_flow_function,
    tolerance::Float64 = 1e-10
)
    # Compute classical max-flow (ignore node constraints)
    _, _, classical_max_flow = compute_classical_flow_function(
        topology.iteration_sets,
        topology.outgoing_index,
        topology.incoming_index,
        topology.source_nodes,
        edge_capacities,
        source_rates,
        target_nodes,
        tolerance = tolerance
    )
    
    # Classical min-cut is just edges
    classical_min_cut = realistic_bottlenecks.min_cut_edges
    
    # Gap analysis
    capacity_gap = classical_max_flow - realistic_max_flow
    efficiency_loss = if classical_max_flow > 0.0
        capacity_gap / classical_max_flow
    else
        0.0
    end
    
    # Determine primary limitation
    primary_limitation = determine_primary_limitation(
        efficiency_loss, realistic_bottlenecks.bottleneck_type
    )
    
    # Generate strategic recommendation
    strategic_recommendation = generate_strategic_recommendation(
        primary_limitation, efficiency_loss, capacity_gap
    )
    
    # Identify specific bottlenecks
    transmission_bottlenecks = collect(realistic_bottlenecks.min_cut_edges)
    processing_bottlenecks = collect(realistic_bottlenecks.min_cut_nodes)
    
    # Calculate capacity gaps by component
    capacity_gaps_by_component = calculate_component_capacity_gaps(
        edge_capacities, node_capacities,
        realistic_bottlenecks, classical_max_flow, realistic_max_flow
    )
    
    return ComparativeAnalysis(
        realistic_max_flow,
        realistic_bottlenecks.bottleneck_type,
        classical_max_flow,
        classical_min_cut,
        efficiency_loss,
        capacity_gap,
        primary_limitation,
        strategic_recommendation,
        transmission_bottlenecks,
        processing_bottlenecks,
        capacity_gaps_by_component
    )
end

"""
Determine whether network is primarily transmission or processing limited
"""
function determine_primary_limitation(
    efficiency_loss::Float64,
    bottleneck_type::Symbol
)::Symbol
    if bottleneck_type == :source_limited
        return :transmission  # Not constrained by network at all
    elseif bottleneck_type == :node_processing
        return :processing  # Clearly node-limited
    elseif efficiency_loss > 0.1  # >10% loss
        return :processing  # Significant processing constraint
    else
        return :transmission  # Edges are the main constraint
    end
end

"""
Generate strategic recommendation based on analysis
"""
function generate_strategic_recommendation(
    primary_limitation::Symbol,
    efficiency_loss::Float64,
    capacity_gap::Float64
)::String
    if primary_limitation == :processing
        loss_pct = round(efficiency_loss * 100, digits=1)
        return """Network is primarily limited by node processing capacity ($(loss_pct)% efficiency loss compared to classical max-flow).
        
Strategic focus:
- Upgrade processing capacity at critical nodes
- Consider adding parallel processing nodes
- Optimize node processing algorithms
- Current gap: $(round(capacity_gap, digits=1)) units/time could be gained by removing node constraints"""
    else
        return """Network is primarily limited by transmission capacity (edge capacities).
        
Strategic focus:
- Upgrade edge capacities at bottleneck links
- Consider adding redundant transmission paths
- Optimize routing to balance load
- Node processing capacity is adequate"""
    end
end

"""
Calculate capacity gap for each component

How much would each component need to increase to reach classical max-flow?
"""
function calculate_component_capacity_gaps(
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    node_capacities::Dict{Int64, Float64},
    bottlenecks::BottleneckReport{Float64},
    classical_max_flow::Float64,
    realistic_max_flow::Float64
)::Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}
    gaps = Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}()
    
    total_gap = classical_max_flow - realistic_max_flow
    
    if total_gap <= 0.0
        return gaps  # No gap
    end
    
    # Distribute gap among saturated components
    n_saturated = length(bottlenecks.saturated_edges) + length(bottlenecks.saturated_nodes)
    
    if n_saturated == 0
        return gaps  # No clear saturated components
    end
    
    # Simple heuristic: divide gap among saturated components
    gap_per_component = total_gap / n_saturated
    
    for edge in bottlenecks.saturated_edges
        gaps[edge] = gap_per_component
    end
    
    for node in bottlenecks.saturated_nodes
        gaps[node] = gap_per_component
    end
    
    return gaps
end

"""
Generate detailed comparison report (for text output)
"""
function format_comparative_report(analysis::ComparativeAnalysis)::String
    report = """
========================================
COMPARATIVE ANALYSIS REPORT
========================================

REALISTIC ANALYSIS (Edges + Nodes):
  Max Flow: $(round(analysis.realistic_max_flow, digits=2))
  Bottleneck Type: $(analysis.realistic_bottleneck_type)

CLASSICAL ANALYSIS (Edges Only):
  Max Flow: $(round(analysis.classical_max_flow, digits=2))

GAP ANALYSIS:
  Capacity Gap: $(round(analysis.capacity_gap, digits=2))
  Efficiency Loss: $(round(analysis.efficiency_loss * 100, digits=1))%
  Primary Limitation: $(analysis.primary_limitation)

BOTTLENECK LOCATIONS:
  Transmission bottlenecks: $(length(analysis.transmission_bottlenecks)) edges
  Processing bottlenecks: $(length(analysis.processing_bottlenecks)) nodes

STRATEGIC RECOMMENDATION:
$(analysis.strategic_recommendation)

========================================
"""
    return report
end

# Export functions
export perform_comparative_analysis, determine_primary_limitation,
       generate_strategic_recommendation, calculate_component_capacity_gaps,
       format_comparative_report
