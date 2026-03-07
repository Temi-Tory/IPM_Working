# Capacity Analysis Module - Complete Refactor Plan

**Version**: 1.0  
**Date**: March 6, 2026  
**Purpose**: Comprehensive redesign of capacity analysis for exact, mathematically rigorous network flow analysis

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Domain Expert Mental Model](#domain-expert-mental-model)
3. [Input Specifications](#input-specifications)
4. [Output Specifications](#output-specifications)
5. [API Design](#api-design)
6. [Module Architecture](#module-architecture)
7. [Backend Server Integration](#backend-server-integration)
8. [Frontend Integration](#frontend-integration)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Mathematical Foundations](#mathematical-foundations)
11. [Testing & Validation Strategy](#testing--validation-strategy)

---

## Executive Summary

### Current Problems
- ❌ Interval/P-box handling is broken (missing helper functions)
- ❌ Uncertainty module uses Monte Carlo (not exact)
- ❌ Multi-commodity complexity (unnecessary)
- ❌ Code organization is messy (2000+ lines in one file)
- ❌ Mathematical exactness not guaranteed

### Solution Approach
- ✅ **Drop P-boxes** - Use exact interval arithmetic only
- ✅ **Clean deterministic core** - Provably exact algorithms
- ✅ **Exact interval extension** - Guaranteed bounds using IntervalArithmetic.jl
- ✅ **Modular architecture** - Separate concerns, testable components
- ✅ **Domain-expert focused** - Outputs match civil engineering/ESREL context

### Key Principles
1. **Mathematical Exactness** - All results provably correct
2. **DAG Optimization** - Exploit topological structure for efficiency
3. **User-Centric Design** - Outputs answer domain expert questions
4. **Incremental Complexity** - Start simple, add features systematically

---

## Domain Expert Mental Model

### Who Are Our Users?
- Civil engineers analyzing infrastructure networks
- Network analysts at ESREL conferences
- Researchers studying system reliability
- Domain experts doing performance analysis

### What Questions Do They Ask?

#### Phase 1: Basic Questions
1. **"How much can my network handle?"** → Maximum throughput
2. **"Where are my choke points?"** → Bottleneck locations
3. **"Am I using my infrastructure efficiently?"** → Utilization rates
4. **"Is the network balanced or are some parts overloaded?"** → Load distribution

#### Phase 2: Planning Questions
5. **"What should I upgrade first?"** → Investment priorities
6. **"How much improvement would upgrading edge X give me?"** → Sensitivity analysis
7. **"What's my weakest link?"** → Critical component identification
8. **"Do I have redundancy if something fails?"** → Alternative paths

#### Phase 3: Uncertainty/Risk Questions
9. **"What if capacities degrade?"** → Robustness analysis
10. **"What's my worst-case throughput?"** → Conservative bounds
11. **"What's my best-case if everything works optimally?"** → Optimistic bounds
12. **"How reliable is my network?"** → Risk assessment

---

## Input Specifications

### Tier 1: REQUIRED INPUTS (Minimum Viable Analysis)

```julia
"""
Basic network capacity problem definition
This is the MINIMUM information needed for any capacity analysis
"""
struct BasicCapacityProblem
    # === NETWORK STRUCTURE ===
    # (Already computed by DiamondProcessingModule)
    topology::NetworkTopology
        # Contains:
        # - iteration_sets::Vector{Set{Int64}}
        # - outgoing_index::Dict{Int64, Set{Int64}}
        # - incoming_index::Dict{Int64, Set{Int64}}
        # - source_nodes::Set{Int64}
    
    # === CAPACITY CONSTRAINTS ===
    node_capacities::Dict{Int64, Float64}
        # Key: node ID
        # Value: maximum processing rate (units/time)
        # Example: Dict(1 => 100.0, 2 => 150.0)
        # Interpretation: "Node 1 can process 100 units/sec"
    
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64}
        # Key: (source_node, target_node)
        # Value: maximum transmission rate
        # Example: Dict((1,2) => 80.0, (1,3) => 120.0)
        # Interpretation: "Edge 1→2 can carry 80 units/sec"
    
    # === SOURCES AND SINKS ===
    source_rates::Dict{Int64, Float64}
        # Key: source node ID
        # Value: input rate (units/time)
        # Example: Dict(1 => 50.0, 2 => 30.0)
        # Interpretation: "Node 1 injects 50 units/sec into network"
    
    target_nodes::Set{Int64}
        # Which nodes are "sinks" where we measure delivered flow
        # Example: Set([10, 11, 12])
        # Interpretation: "We care about flow reaching nodes 10, 11, 12"
end
```

**With this minimum input, we can compute:**
- Maximum flow
- Bottlenecks (min-cut)
- Basic utilization metrics

---

### Tier 2: UNCERTAINTY INPUTS (For Robust Analysis)

```julia
"""
Extended problem with uncertainty bounds
Use when capacities aren't precisely known
"""
struct UncertainCapacityProblem
    # Same network structure
    topology::NetworkTopology
    
    # === INTERVAL-VALUED CAPACITIES ===
    node_capacities::Dict{Int64, Interval}
        # Example: Dict(1 => Interval(90.0, 110.0))
        # Interpretation: "Node 1 capacity is between 90-110 units/sec"
    
    edge_capacities::Dict{Tuple{Int64,Int64}, Interval}
        # Example: Dict((1,2) => Interval(75.0, 85.0))
        # Interpretation: "Edge 1→2 capacity is between 75-85 units/sec"
    
    source_rates::Dict{Int64, Interval}
        # Example: Dict(1 => Interval(45.0, 55.0))
        # Interpretation: "Source varies between 45-55 units/sec"
    
    target_nodes::Set{Int64}
end
```

**With interval inputs, we can compute:**
- Guaranteed minimum flow (worst case)
- Maximum possible flow (best case)
- Robust bottleneck identification
- Risk-aware upgrade recommendations

---

### Tier 3: OPTIONAL CONFIGURATION (Advanced Analysis)

```julia
"""
Configuration for detailed analysis
All fields optional with sensible defaults
"""
struct CapacityAnalysisOptions
    # === ALGORITHM SELECTION ===
    algorithm::Symbol = :ford_fulkerson_dag
        # Options:
        # - :ford_fulkerson_dag  (best for DAGs, exact, O(VE))
        # - :edmonds_karp        (BFS-based, O(VE²))
        # - :dinic               (level graphs, O(V²E))
    
    # === ANALYSIS SCOPE ===
    compute_all_min_cuts::Bool = false
        # true:  Find ALL minimal cuts (expensive, exponential worst case)
        # false: Find one minimal cut (fast, sufficient for most cases)
    
    enumerate_critical_paths::Bool = true
        # true:  Find all paths operating at capacity
        # false: Skip path enumeration (faster)
    
    max_paths_to_return::Int = 10
        # Limit for large networks to avoid overwhelming output
    
    compute_upgrade_priorities::Bool = true
        # true:  Rank edges/nodes by improvement potential (sensitivity)
        # false: Skip sensitivity analysis
    
    # === COMPARATIVE ANALYSIS ===
    include_classical_comparison::Bool = true
        # true:  Compare realistic vs. classical max-flow
        # Classical = ignoring node processing limits
        # Helps identify if bottleneck is transmission vs. processing
    
    # === DEMAND TARGETS (OPTIONAL) ===
    target_demands::Union{Dict{Int64, Float64}, Nothing} = nothing
        # Optional: Specify required flow to each target
        # Example: Dict(10 => 80.0, 11 => 60.0)
        # Algorithm checks if demands are satisfiable
    
    # === COST WEIGHTING (OPTIONAL) ===
    edge_costs::Union{Dict{Tuple{Int64,Int64}, Float64}, Nothing} = nothing
        # Optional: Cost per unit flow on each edge
        # Enables cost-optimal flow (minimize cost while meeting demand)
    
    target_values::Union{Dict{Int64, Float64}, Nothing} = nothing
        # Optional: Value of delivering flow to each target
        # Enables value-optimal flow (maximize total value)
    
    # === PERFORMANCE TUNING ===
    tolerance::Float64 = 1e-10
        # Flow conservation tolerance for validation
    
    max_iterations::Int = 100000
        # Safety limit for iterative algorithms
    
    # === OUTPUT CONTROL ===
    verbosity::Symbol = :standard
        # :minimal  - Just max flow and bottlenecks
        # :standard - Include utilization and critical paths
        # :verbose  - Full diagnostic information
end
```

---

## Output Specifications

### Tier 1: PRIMARY RESULTS (Always Computed)

```julia
"""
Core capacity analysis results
Answers: "How much can flow through my network?"
"""
struct CapacityAnalysisResult{T <: Union{Float64, Interval}}
    # === MAXIMUM THROUGHPUT ===
    total_max_flow::T
        # Single number: "What's the maximum flow?"
        # For intervals: Interval(guaranteed_min, possible_max)
    
    target_flows::Dict{Int64, T}
        # Flow delivered to each target node
        # Example: Dict(10 => 80.0, 11 => 60.0)
        # Interpretation: "Target 10 receives 80 units/sec"
    
    # === SYSTEM EFFICIENCY ===
    network_utilization::Float64
        # Overall efficiency: 0.0 to 1.0
        # Example: 0.75 = "network is 75% utilized"
    
    # === COMPONENT-LEVEL FLOWS ===
    node_flows::Dict{Int64, T}
        # Flow through each node
        # Tells you: "Is this node processing at full capacity?"
    
    edge_flows::Dict{Tuple{Int64,Int64}, T}
        # Flow through each edge
        # Tells you: "Is this connection saturated?"
    
    # === BOTTLENECK IDENTIFICATION ===
    bottlenecks::BottleneckReport{T}
        # Detailed analysis of network constraints
    
    # === METADATA ===
    analysis_timestamp::DateTime
    computation_time_ms::Float64
    algorithm_used::Symbol
    convergence_achieved::Bool
    exactness_guaranteed::Bool  # Always true for deterministic & interval
end
```

---

### Tier 2: BOTTLENECK REPORT (Critical for Planning)

```julia
"""
Comprehensive bottleneck identification
Answers: "Where are my choke points and what should I do?"
"""
struct BottleneckReport{T}
    # === MINIMUM CUT IDENTIFICATION ===
    min_cut_capacity::T
        # Capacity of weakest cut separating sources from targets
        # This is THE fundamental bottleneck
    
    min_cut_edges::Set{Tuple{Int64,Int64}}
        # Which edges form the minimum cut
        # Example: Set([(3,7), (4,8)])
        # "These edges are the critical bottleneck"
    
    min_cut_nodes::Set{Int64}
        # Which nodes form the minimum cut (if node capacities constrain)
    
    # === BOTTLENECK SEVERITY ===
    bottleneck_type::Symbol
        # :edge_capacity     - Transmission is the constraint
        # :node_processing   - Processing power is the constraint
        # :source_limited    - Not enough input flow
        # :mixed             - Multiple types of bottlenecks
    
    capacity_gap::T
        # Additional capacity needed at bottleneck to increase flow
        # Example: 20.0 = "adding 20 units/sec capacity would help"
    
    # === SATURATED COMPONENTS ===
    saturated_edges::Vector{Tuple{Int64,Int64}}
        # Edges operating at 100% capacity
        # Immediate upgrade candidates
    
    saturated_nodes::Vector{Int64}
        # Nodes processing at full capacity
    
    near_saturated_edges::Vector{Tuple{Tuple{Int64,Int64}, Float64}}
        # Edges close to capacity: (edge, utilization %)
        # Example: [((1,2), 0.95), ((3,4), 0.92)]
        # "Edge 1→2 is 95% utilized"
    
    near_saturated_nodes::Vector{Tuple{Int64, Float64}}
        # Nodes close to capacity
    
    # === SPARE CAPACITY ===
    total_spare_edge_capacity::T
        # Sum of unused edge capacity
        # Indicates transmission "slack"
    
    total_spare_node_capacity::T
        # Sum of unused processing capacity
    
    # === ACTIONABLE METRICS ===
    utilization_by_component::Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}
        # Detailed utilization for every component
        # Example: Dict((1,2) => 0.95, 5 => 0.80)
        # "Edge 1→2: 95% utilized, Node 5: 80% utilized"
end
```

---

### Tier 3: UPGRADE RECOMMENDATIONS (Investment Planning)

```julia
"""
Prioritized recommendations for network improvements
Answers: "What should I upgrade and why?"
"""
struct UpgradeAnalysis{T}
    # === EDGE UPGRADE PRIORITIES ===
    edge_priorities::Vector{EdgeUpgradeRecommendation{T}}
        # Sorted by priority (highest impact first)
    
    # === NODE UPGRADE PRIORITIES ===
    node_priorities::Vector{NodeUpgradeRecommendation{T}}
    
    # === STRATEGIC INSIGHTS ===
    primary_bottleneck::String
        # Plain language
        # "The primary bottleneck is edge (3,7) with capacity 80 units/sec"
    
    recommended_action::String
        # Plain language
        # "Upgrading edge (3,7) from 80 to 100 units/sec would increase 
        #  max flow by 25%"
    
    investment_efficiency::Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}
        # ROI metric: flow increase per unit capacity added
        # Example: Dict((1,2) => 0.8)
        # "Adding capacity to edge 1→2 gives 0.8 units flow per 1 unit capacity"
end

struct EdgeUpgradeRecommendation{T}
    edge::Tuple{Int64,Int64}
    current_capacity::T
    current_flow::T
    current_utilization::Float64
    
    # === SENSITIVITY ANALYSIS ===
    marginal_value::Float64
        # ∂(max_flow)/∂(edge_capacity)
        # "If I add 1 unit capacity here, max flow increases by X"
    
    # === RECOMMENDED UPGRADE ===
    recommended_capacity::T
        # Suggested new capacity level
    
    expected_flow_increase::T
        # How much additional throughput this upgrade provides
    
    # === PRIORITY RANKING ===
    priority_score::Float64  # 0.0 to 1.0
        # 1.0 = highest priority (critical bottleneck)
        # 0.0 = no benefit (already has excess capacity)
    
    rationale::String
        # Plain language explanation
        # "This edge is at 98% capacity and is part of the minimum cut. 
        #  Upgrading would directly increase max flow."
end

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
```

---

### Tier 4: CRITICAL PATH ANALYSIS (Redundancy Assessment)

```julia
"""
Analysis of flow paths through the network
Answers: "What routes does flow take? Do I have redundancy?"
"""
struct PathAnalysis{T}
    # === CRITICAL PATHS ===
    critical_paths::Vector<FlowPath{T}>
        # Paths operating at full capacity (saturated)
        # These are vulnerable to disruption
    
    # === REDUNDANCY ASSESSMENT ===
    path_redundancy::Dict{Tuple{Int64,Int64}, Int}
        # For each source-target pair: number of independent paths
        # Example: Dict((1,10) => 3)
        # "3 independent paths from source 1 to target 10"
    
    single_points_of_failure::Vector{Union{Int64, Tuple{Int64,Int64}}}
        # Components whose failure would disconnect sources from targets
        # Critical vulnerability list
    
    # === LOAD DISTRIBUTION ===
    path_flow_distribution::Vector{Tuple{Vector{Int64}, T}}
        # How flow is distributed across paths
        # Example: [(path1, 50.0), (path2, 30.0), (path3, 20.0)]
end

struct FlowPath{T}
    path::Vector{Int64}
        # Sequence of nodes: [source, intermediate, ..., target]
        # Example: [1, 3, 5, 7, 10]
    
    capacity::T
        # Bottleneck capacity along this path (minimum along path)
    
    flow::T
        # Actual flow carried by this path
    
    is_saturated::Bool
        # true if flow == capacity (path is maxed out)
    
    spare_capacity::T
        # capacity - flow
    
    length::Int
        # Number of hops
    
    bottleneck_location::Union{Int64, Tuple{Int64,Int64}}
        # Which component limits this path
        # Example: (3,5) = edge 3→5 is the constraint
end
```

---

### Tier 5: COMPARATIVE ANALYSIS (Special Feature)

```julia
"""
Comparison of realistic vs. classical max-flow
Answers: "Am I constrained by transmission or processing?"
"""
struct ComparativeAnalysis
    # === REALISTIC ANALYSIS ===
    # (Considers both edge capacities AND node processing limits)
    realistic_max_flow::Float64
    realistic_bottleneck_type::Symbol  # :edge, :node, or :mixed
    
    # === CLASSICAL ANALYSIS ===
    # (Traditional max-flow: ignores node processing, only edge capacities)
    classical_max_flow::Float64
    classical_min_cut::Set{Tuple{Int64,Int64}}
    
    # === GAP ANALYSIS ===
    efficiency_loss::Float64
        # (classical - realistic) / classical
        # Example: 0.25 = "25% capacity loss due to node processing limits"
    
    capacity_gap::Float64
        # Absolute difference: classical - realistic
    
    # === INTERPRETATION ===
    primary_limitation::Symbol
        # :transmission if realistic ≈ classical (edges bottleneck)
        # :processing if realistic << classical (nodes bottleneck)
    
    strategic_recommendation::String
        # Plain language guidance
        # "Network is primarily limited by node processing capacity. 
        #  Focus investments on upgrading nodes 5, 7, and 9."
    
    # === DETAILED BREAKDOWN ===
    transmission_bottlenecks::Vector{Tuple{Int64,Int64}}
        # Edges limiting flow
    
    processing_bottlenecks::Vector{Int64}
        # Nodes limiting flow
    
    capacity_gaps_by_component::Dict{Union{Int64, Tuple{Int64,Int64}}, Float64}
        # How much each component needs to increase to reach classical limit
end
```

---

### Tier 6: INTERVAL ANALYSIS RESULTS

```julia
"""
Results when capacities are uncertain (intervals)
Answers: "What's the range of possible throughputs?"
"""
struct IntervalCapacityResult
    # === GUARANTEED BOUNDS ===
    guaranteed_min_flow::Float64
        # Worst-case throughput (all capacities at lower bound)
        # "We can GUARANTEE at least this much flow"
    
    possible_max_flow::Float64
        # Best-case throughput (all capacities at upper bound)
        # "We could potentially achieve this much flow"
    
    expected_flow::Float64
        # Midpoint estimate: (min + max) / 2
    
    uncertainty_range::Float64
        # max - min
        # "Flow uncertainty is ±X units"
    
    # === ROBUST BOTTLENECK ANALYSIS ===
    robust_bottlenecks::Set{Union{Int64, Tuple{Int64,Int64}}}
        # Components that are bottlenecks in ALL scenarios
        # "Definite upgrade priorities regardless of uncertainty"
    
    potential_bottlenecks::Set{Union{Int64, Tuple{Int64,Int64}}}
        # Components that MIGHT be bottlenecks
    
    # === SCENARIO ANALYSIS ===
    worst_case_scenario::CapacityAnalysisResult{Float64}
        # Full analysis assuming all capacities at minimum
    
    best_case_scenario::CapacityAnalysisResult{Float64}
        # Full analysis assuming all capacities at maximum
    
    # === SENSITIVITY TO UNCERTAINTY ===
    components_most_uncertain::Vector{Tuple{Union{Int64, Tuple{Int64,Int64}}, Float64}}
        # Which capacity uncertainties matter most
        # Sorted by impact on max flow uncertainty
end
```

---

### Tier 7: VALIDATION REPORT

```julia
"""
Mathematical correctness verification
"""
struct ValidationReport
    all_checks_passed::Bool
    
    # === FLOW CONSERVATION ===
    flow_conservation_satisfied::Bool
    conservation_violations::Vector{Tuple{Int64, Float64}}  # (node, violation)
    max_conservation_error::Float64
    
    # === CAPACITY CONSTRAINTS ===
    capacity_constraints_satisfied::Bool
    capacity_violations::Vector{Tuple{Union{Int64, Tuple{Int64,Int64}}, Float64}}
    
    # === CONSISTENCY CHECKS ===
    total_source_rate::Float64
    total_target_flow::Float64
    flow_balance_satisfied::Bool
    
    # === OPTIMALITY VERIFICATION ===
    optimality_verified::Bool  # max-flow = min-cut
    min_cut_capacity::Float64
    max_flow_value::Float64
    
    # === DIAGNOSTICS ===
    warnings::Vector{String}
    errors::Vector{String}
end
```

---

## API Design

### High-Level User-Facing API

```julia
# ============================================
# BASIC ANALYSIS (Deterministic)
# ============================================

"""
Analyze network capacity with exact values

# Example
```julia
result = analyze_capacity(
    topology,
    node_capacities = Dict(1 => 100.0, 2 => 150.0),
    edge_capacities = Dict((1,2) => 80.0),
    source_rates = Dict(1 => 50.0),
    target_nodes = Set([10])
)

println("Max flow: \$(result.total_max_flow)")
println("Bottleneck: \$(result.bottlenecks.primary_bottleneck)")
```
"""
function analyze_capacity(
    topology::NetworkTopology;
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64},
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)::CapacityAnalysisResult{Float64}
    # Implementation in DeterministicCore
end

# ============================================
# UNCERTAINTY ANALYSIS (Interval)
# ============================================

"""
Analyze network capacity with uncertain values (intervals)

# Example
```julia
result = analyze_capacity_uncertain(
    topology,
    node_capacities = Dict(1 => Interval(90.0, 110.0)),
    edge_capacities = Dict((1,2) => Interval(75.0, 85.0)),
    source_rates = Dict(1 => Interval(45.0, 55.0)),
    target_nodes = Set([10])
)

println("Guaranteed min: \$(result.guaranteed_min_flow)")
println("Possible max: \$(result.possible_max_flow)")
```
"""
function analyze_capacity_uncertain(
    topology::NetworkTopology;
    node_capacities::Dict{Int64, Interval},
    edge_capacities::Dict{Tuple{Int64,Int64}, Interval},
    source_rates::Dict{Int64, Interval},
    target_nodes::Set{Int64},
    options::CapacityAnalysisOptions = CapacityAnalysisOptions()
)::IntervalCapacityResult
    # Implementation in IntervalExtensions
end

# ============================================
# COMPARATIVE ANALYSIS
# ============================================

"""
Compare realistic vs. classical max-flow
Shows impact of node processing limits on network capacity
"""
function analyze_capacity_comparative(
    topology::NetworkTopology;
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64}
)::ComparativeAnalysis
    # Implementation in Analysis/Comparative.jl
end

# ============================================
# SCENARIO COMPARISON
# ============================================

"""
Compare multiple capacity scenarios

# Example
```julia
scenarios = [
    CapacityScenario("Current", current_capacities...),
    CapacityScenario("After Upgrade A", upgraded_capacities...)
]
comparison = compare_scenarios(topology, scenarios)
```
"""
function compare_scenarios(
    topology::NetworkTopology,
    scenarios::Vector{CapacityScenario}
)::ScenarioComparisonReport
    # Implementation in Analysis/Scenarios.jl
end

struct CapacityScenario
    name::String
    node_capacities::Dict{Int64, Float64}
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64}
    source_rates::Dict{Int64, Float64}
    target_nodes::Set{Int64}
end

# ============================================
# QUICK ANALYSIS (Minimal Output)
# ============================================

"""
Quick capacity check - just the essentials
Use when you only need max flow and primary bottleneck
"""
function quick_capacity_check(
    topology::NetworkTopology,
    node_capacities::Dict{Int64, Float64},
    edge_capacities::Dict{Tuple{Int64,Int64}, Float64},
    source_rates::Dict{Int64, Float64},
    target_nodes::Set{Int64}
)::NamedTuple{(:max_flow, :bottleneck, :utilization)}
    # Fast minimal computation
end

# ============================================
# VALIDATION
# ============================================

"""
Validate capacity analysis results for mathematical correctness
"""
function validate_capacity_result(
    result::CapacityAnalysisResult,
    problem::Union{BasicCapacityProblem, UncertainCapacityProblem}
)::ValidationReport
    # Comprehensive validation
end
```

---

## Module Architecture

### Recommended File Structure

```
src/Capacity/
├── CapacityAnalysisModule.jl      # Main module (clean, high-level only)
│
├── Core/
│   ├── Types.jl                   # All struct definitions
│   ├── DeterministicCore.jl       # Exact deterministic algorithms
│   ├── Validation.jl              # Mathematical verification
│   └── Utils.jl                   # Helper functions
│
├── Extensions/
│   ├── IntervalExtension.jl       # Exact interval arithmetic
│   └── README.md                  # Future: PBoxExtension.jl if needed
│
├── Algorithms/
│   ├── MaxFlow.jl                 # Ford-Fulkerson, Edmonds-Karp for DAGs
│   ├── MinCut.jl                  # Min-cut identification
│   ├── Paths.jl                   # Critical path enumeration
│   └── TopologicalUtils.jl        # DAG-specific optimizations
│
├── Analysis/
│   ├── Bottlenecks.jl            # Bottleneck identification
│   ├── Sensitivity.jl            # Importance ranking
│   ├── Comparative.jl            # Realistic vs classical
│   ├── Recommendations.jl        # Upgrade priorities
│   └── Scenarios.jl              # Multi-scenario comparison
│
└── Tests/
    ├── test_deterministic.jl     # Core algorithm tests
    ├── test_intervals.jl         # Interval arithmetic tests
    ├── test_validation.jl        # Correctness verification
    └── benchmark_problems.jl     # Known solutions for testing
```

### Module Dependencies

```
CapacityAnalysisModule
├── Core/Types                    # No dependencies
├── Core/DeterministicCore        # Depends on: Types, Algorithms/MaxFlow
├── Core/Validation              # Depends on: Types
├── Extensions/IntervalExtension # Depends on: Types, DeterministicCore, IntervalArithmetic.jl
├── Algorithms/MaxFlow           # Depends on: Types
├── Algorithms/MinCut            # Depends on: Types, MaxFlow
├── Algorithms/Paths             # Depends on: Types
├── Analysis/Bottlenecks         # Depends on: Types, MinCut
├── Analysis/Sensitivity         # Depends on: Types, MaxFlow
├── Analysis/Comparative         # Depends on: Types, DeterministicCore
└── Analysis/Recommendations     # Depends on: Types, Sensitivity, Bottlenecks
```

---

## Backend Server Integration

### Endpoint Design

```julia
# In backend_server.jl

"""
POST /api/capacity-analysis
Comprehensive capacity analysis endpoint
"""
function handle_capacity_analysis(req::HTTP.Request)
    try
        # Parse request body
        data = JSON.parse(String(req.body))
        
        # Load network topology (already computed by diamond processing)
        topology = load_network_topology(
            data["edges_file"],
            data["diamond_data"]  # Contains iteration_sets, indices, etc.
        )
        
        # Determine analysis mode
        uncertainty_mode = get(data, "uncertainty_mode", "deterministic")
        
        if uncertainty_mode == "deterministic"
            result = handle_deterministic_capacity_analysis(data, topology)
        elseif uncertainty_mode == "interval"
            result = handle_interval_capacity_analysis(data, topology)
        else
            return HTTP.Response(400, JSON.json(Dict(
                "error" => "Invalid uncertainty_mode: $uncertainty_mode"
            )))
        end
        
        # Return successful response
        return HTTP.Response(200, JSON.json(Dict(
            "status" => "success",
            "result" => serialize_capacity_result(result),
            "validation" => serialize_validation(result.validation)
        )))
        
    catch e
        return HTTP.Response(500, JSON.json(Dict(
            "error" => "Capacity analysis failed: $(sprint(showerror, e))"
        )))
    end
end

function handle_deterministic_capacity_analysis(data, topology)
    # Parse capacities
    node_capacities = parse_node_capacities(data["node_capacities"])
    edge_capacities = parse_edge_capacities(data["edge_capacities"])
    source_rates = parse_source_rates(data["source_rates"])
    target_nodes = Set(data["target_nodes"])
    
    # Parse options (use defaults if not provided)
    options = parse_analysis_options(get(data, "options", Dict()))
    
    # Run analysis
    result = analyze_capacity(
        topology,
        node_capacities = node_capacities,
        edge_capacities = edge_capacities,
        source_rates = source_rates,
        target_nodes = target_nodes,
        options = options
    )
    
    # Validate results
    validation = validate_capacity_result(result, BasicCapacityProblem(...))
    
    return (result = result, validation = validation)
end

function handle_interval_capacity_analysis(data, topology)
    # Parse interval capacities
    node_capacities = parse_interval_node_capacities(data["node_capacities"])
    edge_capacities = parse_interval_edge_capacities(data["edge_capacities"])
    source_rates = parse_interval_source_rates(data["source_rates"])
    target_nodes = Set(data["target_nodes"])
    
    # Parse options
    options = parse_analysis_options(get(data, "options", Dict()))
    
    # Run interval analysis
    result = analyze_capacity_uncertain(
        topology,
        node_capacities = node_capacities,
        edge_capacities = edge_capacities,
        source_rates = source_rates,
        target_nodes = target_nodes,
        options = options
    )
    
    # Validate both worst and best case
    validation_worst = validate_capacity_result(
        result.worst_case_scenario, 
        UncertainCapacityProblem(...)
    )
    validation_best = validate_capacity_result(
        result.best_case_scenario,
        UncertainCapacityProblem(...)
    )
    
    return (result = result, validation = (worst = validation_worst, best = validation_best))
end

# Helper parsers
function parse_node_capacities(data::Dict)::Dict{Int64, Float64}
    Dict{Int64, Float64}(
        parse(Int64, string(k)) => Float64(v) 
        for (k, v) in data
    )
end

function parse_interval_node_capacities(data::Dict)::Dict{Int64, Interval}
    Dict{Int64, Interval}(
        parse(Int64, string(k)) => Interval(v["min"], v["max"])
        for (k, v) in data
    )
end

# Similar for edges and sources...

function serialize_capacity_result(result_tuple)
    result = result_tuple.result
    validation = result_tuple.validation
    
    Dict(
        "total_max_flow" => serialize_value(result.total_max_flow),
        "target_flows" => serialize_dict(result.target_flows),
        "network_utilization" => result.network_utilization,
        "node_flows" => serialize_dict(result.node_flows),
        "edge_flows" => serialize_dict(result.edge_flows),
        "bottlenecks" => serialize_bottleneck_report(result.bottlenecks),
        "upgrade_priorities" => serialize_upgrade_analysis(result.upgrade_priorities),
        "critical_paths" => serialize_path_analysis(result.critical_paths),
        "comparative_analysis" => serialize_comparative(result.comparative_analysis),
        "metadata" => Dict(
            "timestamp" => result.analysis_timestamp,
            "computation_time_ms" => result.computation_time_ms,
            "algorithm_used" => string(result.algorithm_used),
            "exactness_guaranteed" => result.exactness_guaranteed
        ),
        "validation" => serialize_validation(validation)
    )
end
```

### Request/Response Schema

#### Request Schema (Deterministic)
```json
{
  "edges_file": "path/to/network.edges",
  "diamond_data": {
    "iteration_sets": [[1, 2], [3, 4], [5]],
    "outgoing_index": {...},
    "incoming_index": {...},
    "source_nodes": [1, 2]
  },
  "uncertainty_mode": "deterministic",
  "node_capacities": {
    "1": 100.0,
    "2": 150.0,
    "3": 200.0
  },
  "edge_capacities": {
    "1-2": 80.0,
    "2-3": 120.0
  },
  "source_rates": {
    "1": 50.0,
    "2": 30.0
  },
  "target_nodes": [5, 6],
  "options": {
    "compute_all_min_cuts": false,
    "enumerate_critical_paths": true,
    "compute_upgrade_priorities": true,
    "include_classical_comparison": true,
    "verbosity": "standard"
  }
}
```

#### Request Schema (Interval)
```json
{
  "edges_file": "path/to/network.edges",
  "diamond_data": {...},
  "uncertainty_mode": "interval",
  "node_capacities": {
    "1": {"min": 90.0, "max": 110.0},
    "2": {"min": 140.0, "max": 160.0}
  },
  "edge_capacities": {
    "1-2": {"min": 75.0, "max": 85.0}
  },
  "source_rates": {
    "1": {"min": 45.0, "max": 55.0}
  },
  "target_nodes": [5, 6],
  "options": {...}
}
```

#### Response Schema
```json
{
  "status": "success",
  "result": {
    "total_max_flow": 95.5,
    "target_flows": {
      "5": 60.0,
      "6": 35.5
    },
    "network_utilization": 0.78,
    "bottlenecks": {
      "min_cut_capacity": 95.5,
      "min_cut_edges": [[2, 4], [3, 5]],
      "bottleneck_type": "edge_capacity",
      "saturated_edges": [[2, 4]],
      "utilization_by_component": {
        "1": 0.50,
        "2": 0.85,
        "1-2": 0.95
      }
    },
    "upgrade_priorities": {
      "edge_priorities": [
        {
          "edge": [2, 4],
          "current_capacity": 80.0,
          "current_utilization": 1.0,
          "marginal_value": 0.85,
          "priority_score": 1.0,
          "rationale": "This edge is at full capacity and is part of the minimum cut."
        }
      ]
    },
    "comparative_analysis": {
      "realistic_max_flow": 95.5,
      "classical_max_flow": 110.0,
      "efficiency_loss": 0.13,
      "primary_limitation": "processing"
    },
    "metadata": {
      "timestamp": "2026-03-06T10:30:00Z",
      "computation_time_ms": 45.2,
      "algorithm_used": "ford_fulkerson_dag",
      "exactness_guaranteed": true
    }
  },
  "validation": {
    "all_checks_passed": true,
    "flow_conservation_satisfied": true,
    "capacity_constraints_satisfied": true,
    "optimality_verified": true,
    "warnings": [],
    "errors": []
  }
}
```

---

## Frontend Integration

### Input Component Design

```typescript
// src/app/analysis/capacity-analysis/capacity-input.component.ts

interface CapacityAnalysisInputs {
  // Network selection
  edgesFile: string;
  networkId: string;
  
  // Uncertainty mode
  uncertaintyMode: 'deterministic' | 'interval';
  
  // Deterministic capacities
  nodeCapacities?: Map<number, number>;
  edgeCapacities?: Map<string, number>;  // key: "node1-node2"
  sourceRates?: Map<number, number>;
  
  // Interval capacities
  nodeCapacitiesInterval?: Map<number, [number, number]>;
  edgeCapacitiesInterval?: Map<string, [number, number]>;
  sourceRatesInterval?: Map<number, [number, number]>;
  
  // Targets
  targetNodes: number[];
  
  // Analysis options
  options: CapacityAnalysisOptions;
}

interface CapacityAnalysisOptions {
  computeAllMinCuts: boolean;
  enumerateCriticalPaths: boolean;
  computeUpgradePriorities: boolean;
  includeClassicalComparison: boolean;
  maxPathsToReturn: number;
  verbosity: 'minimal' | 'standard' | 'verbose';
}
```

### Results Display Component Design

```typescript
// src/app/analysis/capacity-analysis/capacity-results.component.ts

interface CapacityAnalysisResults {
  // Primary results
  totalMaxFlow: number | IntervalValue;
  targetFlows: Map<number, number | IntervalValue>;
  networkUtilization: number;
  
  // Node/edge flows
  nodeFlows: Map<number, number | IntervalValue>;
  edgeFlows: Map<string, number | IntervalValue>;
  
  // Bottleneck report
  bottlenecks: BottleneckReport;
  
  // Upgrade recommendations
  upgradePriorities?: UpgradeAnalysis;
  
  // Critical paths
  criticalPaths?: PathAnalysis;
  
  // Comparative analysis
  comparativeAnalysis?: ComparativeAnalysis;
  
  // Metadata
  metadata: {
    timestamp: Date;
    computationTimeMs: number;
    algorithmUsed: string;
    exactnessGuaranteed: boolean;
  };
  
  // Validation
  validation: ValidationReport;
}

interface IntervalValue {
  min: number;
  max: number;
  expected: number;
}
```

### UI Layout Structure

```
Capacity Analysis View
├── Input Panel (Left Sidebar)
│   ├── Network Selection
│   │   └── Dropdown: Select network file
│   ├── Uncertainty Mode
│   │   └── Toggle: Deterministic / Interval
│   ├── Capacity Configuration
│   │   ├── Node Capacities (table with inline editing)
│   │   ├── Edge Capacities (table with inline editing)
│   │   └── Source Rates (table with inline editing)
│   ├── Target Selection
│   │   └── Multi-select: Target nodes
│   ├── Analysis Options
│   │   ├── Checkbox: Compute all min-cuts
│   │   ├── Checkbox: Enumerate critical paths
│   │   ├── Checkbox: Compute upgrade priorities
│   │   ├── Checkbox: Include classical comparison
│   │   └── Dropdown: Verbosity level
│   └── Action Button: "Run Analysis"
│
├── Results Panel (Main Area)
│   ├── Summary Card (Top)
│   │   ├── Max Flow (Large number)
│   │   ├── Network Utilization (Progress bar)
│   │   └── Computation Time
│   │
│   ├── Bottleneck Analysis (Prominent Section)
│   │   ├── Min-Cut Capacity
│   │   ├── Bottleneck Type (badge)
│   │   ├── Critical Components (highlighted list)
│   │   └── Visualization: Network with bottlenecks highlighted
│   │
│   ├── Tabbed Detail Sections
│   │   ├── Tab: "Flow Distribution"
│   │   │   ├── Node Flows Table (sortable)
│   │   │   └── Edge Flows Table (sortable)
│   │   ├── Tab: "Upgrade Priorities"
│   │   │   ├── Edge Recommendations (ranked list with scores)
│   │   │   ├── Node Recommendations (ranked list)
│   │   │   └── Strategic Summary (text)
│   │   ├── Tab: "Critical Paths"
│   │   │   ├── Path List (with capacity and flow)
│   │   │   └── Redundancy Analysis
│   │   ├── Tab: "Comparative Analysis"
│   │   │   ├── Realistic vs Classical (comparison chart)
│   │   │   ├── Efficiency Loss (metric)
│   │   │   └── Strategic Recommendation (text)
│   │   └── Tab: "Validation"
│   │       ├── Flow Conservation Check
│   │       ├── Capacity Constraints Check
│   │       ├── Optimality Verification
│   │       └── Warnings/Errors
│   │
│   └── Export Options
│       ├── Button: Export to JSON
│       ├── Button: Export to CSV
│       └── Button: Generate PDF Report
│
└── Visualization Panel (Right Sidebar or Modal)
    ├── Network Graph
    │   ├── Nodes (sized by capacity, colored by utilization)
    │   ├── Edges (thickness by flow, color by utilization)
    │   ├── Highlighted: Bottlenecks (red)
    │   └── Highlighted: Critical paths (blue)
    └── Interactive Controls
        ├── Zoom/Pan
        ├── Toggle: Show/hide labels
        └── Highlight Mode: Bottlenecks / Saturated / All
```

### Key UI Components

```typescript
// Capacity input table component
@Component({
  selector: 'app-capacity-table',
  template: `
    <table class="capacity-table">
      <thead>
        <tr>
          <th>Component</th>
          <th *ngIf="uncertaintyMode === 'deterministic'">Capacity</th>
          <th *ngIf="uncertaintyMode === 'interval'">Min Capacity</th>
          <th *ngIf="uncertaintyMode === 'interval'">Max Capacity</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let item of capacityItems">
          <td>{{ item.label }}</td>
          <td *ngIf="uncertaintyMode === 'deterministic'">
            <input type="number" [(ngModel)]="item.capacity" />
          </td>
          <td *ngIf="uncertaintyMode === 'interval'">
            <input type="number" [(ngModel)]="item.minCapacity" />
          </td>
          <td *ngIf="uncertaintyMode === 'interval'">
            <input type="number" [(ngModel)]="item.maxCapacity" />
          </td>
          <td>
            <button (click)="removeItem(item)">Remove</button>
          </td>
        </tr>
      </tbody>
    </table>
    <button (click)="addItem()">Add Component</button>
  `
})
export class CapacityTableComponent { ... }

// Bottleneck visualization component
@Component({
  selector: 'app-bottleneck-viz',
  template: `
    <div class="bottleneck-summary">
      <h3>Bottleneck Analysis</h3>
      <div class="metric-card">
        <span class="label">Min-Cut Capacity:</span>
        <span class="value">{{ bottlenecks.minCutCapacity }}</span>
      </div>
      <div class="metric-card">
        <span class="label">Bottleneck Type:</span>
        <span class="badge" [class]="bottlenecks.bottleneckType">
          {{ formatBottleneckType(bottlenecks.bottleneckType) }}
        </span>
      </div>
      <div class="critical-components">
        <h4>Critical Components</h4>
        <ul>
          <li *ngFor="let edge of bottlenecks.saturatedEdges">
            Edge {{ edge[0] }} → {{ edge[1] }} (100% utilized)
          </li>
          <li *ngFor="let node of bottlenecks.saturatedNodes">
            Node {{ node }} (100% utilized)
          </li>
        </ul>
      </div>
    </div>
  `
})
export class BottleneckVizComponent { ... }

// Upgrade recommendations component
@Component({
  selector: 'app-upgrade-recommendations',
  template: `
    <div class="recommendations">
      <div class="summary-card">
        <h3>Primary Bottleneck</h3>
        <p>{{ upgradePriorities.primaryBottleneck }}</p>
        <h3>Recommended Action</h3>
        <p>{{ upgradePriorities.recommendedAction }}</p>
      </div>
      
      <h3>Edge Upgrade Priorities</h3>
      <table class="priorities-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Edge</th>
            <th>Current Capacity</th>
            <th>Utilization</th>
            <th>Priority Score</th>
            <th>Expected Improvement</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let rec of upgradePriorities.edgePriorities; let i = index">
            <td>{{ i + 1 }}</td>
            <td>{{ rec.edge[0] }} → {{ rec.edge[1] }}</td>
            <td>{{ rec.currentCapacity }}</td>
            <td>
              <div class="utilization-bar" [style.width.%]="rec.currentUtilization * 100">
                {{ (rec.currentUtilization * 100).toFixed(1) }}%
              </div>
            </td>
            <td>{{ rec.priorityScore.toFixed(2) }}</td>
            <td>{{ rec.expectedFlowIncrease }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `
})
export class UpgradeRecommendationsComponent { ... }
```

---

## Implementation Roadmap

### Phase 1: Core Refactor (Week 1-2)
**Goal**: Clean, exact deterministic capacity analysis

#### Tasks:
1. ✅ Create new file structure
   - Set up directories: Core/, Algorithms/, Analysis/
   - Create stub files for all modules

2. ✅ Define all types (Core/Types.jl)
   - BasicCapacityProblem
   - CapacityAnalysisResult
   - BottleneckReport
   - All supporting structs

3. ✅ Implement DeterministicCore
   - Extract working code from current CapacityAnalysisModule.jl
   - Clean up flow conservation logic
   - Remove all uncertainty branches
   - Add comprehensive comments

4. ✅ Implement MaxFlow algorithm (Algorithms/MaxFlow.jl)
   - Ford-Fulkerson for DAGs (topological order)
   - Flow conservation validation
   - Performance optimization

5. ✅ Implement MinCut identification (Algorithms/MinCut.jl)
   - Find minimum cut from residual graph
   - Identify saturated components

6. ✅ Implement Validation (Core/Validation.jl)
   - Flow conservation check
   - Capacity constraint check
   - Optimality verification (max-flow = min-cut)

7. ✅ Basic API (CapacityAnalysisModule.jl)
   - analyze_capacity() function
   - validate_capacity_result() function

8. ✅ Test suite
   - Unit tests for all core functions
   - Integration tests with known solutions
   - Benchmark against current implementation

**Deliverable**: Working deterministic capacity analysis with validation

#### Phase 1 Completion Note (March 6, 2026)

**Status**: ✅ Complete

**Summary**:
- Deterministic refactor is complete and validated against dedicated deterministic tests.
- Test entrypoint was standardized to a canonical suite runner for repeatable execution.
- Legacy capacity tests were preserved as opt-in and updated for compatibility with current behavior.

**Files touched (Phase 1 closeout + verification):**
- `src/Network-flow-algos/src/Algorithms/Capacity/CapacityAnalysisModule.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Core/Types.jl`
- `src/Network-flow-algos/test/runtests.jl`
- `src/Network-flow-algos/test/RunCapacityTests.jl`
- `src/Network-flow-algos/test/CapacityModuleTests.jl`
- `src/Network-flow-algos/test/CapacityValidationTests.jl`

**Verification summary:**
- Refactored deterministic suite: **19 / 19 passed** (`src/Network-flow-algos/src/Algorithms/Capacity/Tests/test_deterministic.jl`)
- Canonical capacity suite (default mode): passed (`src/Network-flow-algos/test/runtests.jl`)
- Canonical capacity suite (legacy opt-in): **45 / 45 passed** with `RUN_LEGACY_CAPACITY_TESTS=1`

---

### Phase 2: Interval Extension (Week 3)
**Goal**: Exact interval arithmetic for uncertainty

#### Tasks:
1. ✅ Set up IntervalArithmetic.jl dependency
   - Add to Project.toml
   - Test basic interval operations

2. ✅ Implement IntervalExtension (Extensions/IntervalExtension.jl)
   - Adapt deterministic core for intervals
   - Lower bound computation (pessimistic)
   - Upper bound computation (optimistic)
   - DAG-specific bound tightening

3. ✅ Interval result types
   - IntervalCapacityResult struct
   - Scenario comparison (worst/best case)

4. ✅ API extension
   - analyze_capacity_uncertain() function
   - Validation for interval results

5. ✅ Test suite
   - Verify bounds contain true values
   - Check bound tightness
   - Edge cases (degenerate intervals)

**Deliverable**: Exact interval capacity analysis

#### Phase 2 Completion Note (March 7, 2026)

**Status**: ✅ Complete

**Summary**:
- Exact interval extension is fully integrated with the refactored deterministic core (no Monte Carlo path introduced).
- Uncertain-analysis API now supports both direct and validated workflows.
- Interval validation dispatch is implemented and checks worst/best scenario consistency and bound sanity.
- Canonical test entrypoint remains default; legacy tests remain opt-in by environment flag.

**Files touched (Phase 2 implementation + verification):**
- `src/Network-flow-algos/src/Algorithms/Capacity/CapacityAnalysisModule.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Core/Types.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Core/Validation.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Extensions/IntervalExtension.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Tests/test_intervals.jl`
- `src/Network-flow-algos/src/IPAFrameworkOptimized.jl`
- `src/Network-flow-algos/test/runtests.jl`

**Verification summary:**
- Deterministic suite unchanged: **19 / 19 passed** (`src/Network-flow-algos/src/Algorithms/Capacity/Tests/test_deterministic.jl`)
- Interval suite: **20 / 20 passed** (`src/Network-flow-algos/src/Algorithms/Capacity/Tests/test_intervals.jl`)
- Canonical capacity suite (default mode): **39 / 39 passed** (`src/Network-flow-algos/test/runtests.jl`)
- Canonical capacity suite (legacy opt-in): **60 / 60 passed** with `RUN_LEGACY_CAPACITY_TESTS=1`

**Mathematical correctness checks covered:**
- Lower/upper interval bound consistency (guaranteed min ≤ possible max)
- Degenerate interval equivalence to deterministic result
- Monotonicity under widened bounds (wider uncertainty does not tighten feasible max-flow envelope)
- Scenario-level deterministic validation for worst/best cases (flow conservation, capacity constraints, flow balance, optimality checks reported)

---

### Phase 3: Advanced Analysis (Week 4)
**Goal**: Bottleneck analysis, upgrade recommendations, critical paths

#### Tasks:
1. ✅ Bottleneck identification (Analysis/Bottlenecks.jl)
   - Saturated component detection
   - Bottleneck type classification
   - Utilization metrics

2. ✅ Sensitivity analysis (Analysis/Sensitivity.jl)
   - Edge importance (marginal values)
   - Node importance
   - Investment efficiency metrics

3. ✅ Upgrade recommendations (Analysis/Recommendations.jl)
   - Priority scoring
   - Expected improvements
   - Plain language rationales

4. ✅ Critical paths (Algorithms/Paths.jl)
   - Enumerate saturated paths
   - Redundancy analysis
   - Single points of failure

5. ✅ Comparative analysis (Analysis/Comparative.jl)
   - Realistic vs classical max-flow
   - Gap analysis
   - Strategic recommendations

**Deliverable**: Comprehensive analysis suite

#### Phase 3 Completion Note (March 7, 2026)

**Status**: ✅ Complete

**Summary**:
- All Phase 3 advanced analysis modules implemented and integrated with refactored deterministic core
- Enhanced bottleneck analysis with improved classification logic (edge_capacity, node_processing, source_limited, mixed)
- Sensitivity analysis computes marginal values for capacity upgrades at each component
- Upgrade recommendations generate prioritized, actionable suggestions with plain-language rationales
- Critical path enumeration leverages DAG structure for efficient path analysis and SPOF detection
- Comparative analysis quantifies impact of node processing limits vs transmission capacity
- All Phase 3 outputs are mathematically consistent and actionable for domain experts
- Integration maintains exactness guarantees from Phase 1/2

**Files created (Phase 3):**
- `src/Network-flow-algos/src/Algorithms/Capacity/Analysis/Bottlenecks.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Analysis/Sensitivity.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Analysis/Recommendations.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Analysis/Comparative.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Algorithms/Paths.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Tests/test_phase3.jl`

**Files modified (Phase 3 integration):**
- `src/Network-flow-algos/src/Algorithms/Capacity/CapacityAnalysisModule.jl`
- `src/Network-flow-algos/src/Algorithms/Capacity/Core/DeterministicCore.jl`
- `src/Network-flow-algos/test/runtests.jl`

**Verification summary:**
- Deterministic suite unchanged: **19 / 19 passed**
- Interval suite unchanged: **20 / 20 passed**
- **NEW** Phase 3 suite: **65 / 65 passed**
- Canonical capacity suite (default mode): **104 / 104 passed**
- Canonical capacity suite (legacy opt-in): available via `RUN_LEGACY_CAPACITY_TESTS=1`

**Phase 3 Features Verified:**
- ✅ Enhanced bottleneck classification correctly identifies edge vs node constraints
- ✅ Sensitivity analysis computes meaningful marginal values for upgrade prioritization
- ✅ Upgrade recommendations provide actionable priority scores and rationales
- ✅ Critical path enumeration works efficiently on DAG topology
- ✅ SPOF detection identifies components whose failure disconnects network
- ✅ Comparative analysis quantifies realistic vs classical max-flow gap
- ✅ All Phase 3 modules properly integrated via conditional includes (no duplicate warnings)
- ✅ All Phase 3 types and functions exported via IPAFrameworkOptimized module

---

### Phase 4: Backend Integration (Week 5)
**Goal**: Update backend_server.jl to use new module

#### Tasks:
1. ✅ New endpoint handler
   - handle_capacity_analysis() function
   - Request parsing (deterministic/interval)
   - Response serialization

2. ✅ Input parsers
   - parse_node_capacities()
   - parse_edge_capacities()
   - parse_interval_capacities()
   - parse_analysis_options()

3. ✅ Output serializers
   - serialize_capacity_result()
   - serialize_bottleneck_report()
   - serialize_upgrade_analysis()
   - serialize_validation()

4. ✅ Error handling
   - Validation errors
   - Computation errors
   - Meaningful error messages

5. ✅ Integration testing
   - Test with real network files
   - Verify JSON serialization
   - Performance benchmarking

**Deliverable**: Updated backend with new capacity module

---

### Phase 5: Frontend Implementation (Week 6-7)
**Goal**: New Angular component for capacity analysis

#### Tasks:
1. ✅ Create component structure
   - capacity-analysis.component.ts
   - capacity-input.component.ts
   - capacity-results.component.ts
   - capacity-viz.component.ts

2. ✅ Input panel
   - Network selection dropdown
   - Uncertainty mode toggle
   - Capacity tables (editable)
   - Target selection
   - Options panel

3. ✅ Results display
   - Summary cards
   - Bottleneck visualization
   - Tabbed detail sections
   - Validation feedback

4. ✅ Network visualization
   - D3.js graph rendering
   - Highlight bottlenecks
   - Interactive tooltips
   - Zoom/pan controls

5. ✅ Export functionality
   - JSON export
   - CSV export
   - PDF report generation

6. ✅ Styling & UX
   - Consistent with existing UI
   - Responsive layout
   - Loading states
   - Error handling

**Deliverable**: Complete frontend for capacity analysis

---

### Phase 6: Testing & Documentation (Week 8)
**Goal**: Comprehensive testing and user documentation

#### Tasks:
1. ✅ End-to-end testing
   - Full workflow tests
   - Edge cases
   - Performance testing

2. ✅ User documentation
   - How-to guide
   - Example workflows
   - Interpretation guide for results

3. ✅ API documentation
   - Function docstrings
   - Type documentation
   - Example code

4. ✅ Mathematical documentation
   - Algorithm descriptions
   - Correctness proofs
   - Complexity analysis

**Deliverable**: Production-ready capacity analysis system

---

## Mathematical Foundations

### Max-Flow Min-Cut Theorem

**Theorem** (Ford-Fulkerson, 1956): In any network, the maximum flow from source to sink equals the minimum capacity of cuts separating source from sink.

**Formal Statement**:
```
max_flow(s, t) = min_cut(s, t)
```

**Implications for our module**:
1. Max-flow computation gives us the bottleneck capacity
2. Min-cut identification shows us WHERE the bottleneck is
3. Optimality verification: if max_flow ≠ min_cut, algorithm failed

### DAG-Specific Properties

**Property 1**: DAGs have topological ordering
- No cycles → can process nodes in order
- Single-pass flow computation possible
- Time complexity: O(V + E)

**Property 2**: Path enumeration is tractable in DAGs
- Unlike general graphs (exponential paths)
- Dynamic programming on topological sort
- Efficient critical path identification

**Property 3**: Flow decomposition is simple
- All flow is sum of path flows (no cyclic components)
- Clear interpretation for domain experts

### Interval Arithmetic Correctness

**Property 4**: Interval operations guarantee inclusion
- If x ∈ [x_min, x_max] and y ∈ [y_min, y_max]
- Then (x + y) ∈ [x_min + y_min, x_max + y_max]
- Our computed interval CONTAINS true value

**Property 5**: Max-flow is monotone
- If all capacities increase, max-flow doesn't decrease
- Allows vertex method for exact bounds
- Lower bound: all capacities at minimum
- Upper bound: all capacities at maximum

### Complexity Analysis

| Operation | Deterministic | Interval |
|-----------|--------------|----------|
| Max-flow (DAG) | O(VE) | O(VE) |
| Min-cut | O(V + E) | O(V + E) |
| All min-cuts | O(V + E + k) where k = # cuts | Same |
| Critical paths | O(V + E + p) where p = # paths | Same |
| Sensitivity | O(E × MaxFlow) | O(E × MaxFlow) |

**Note**: Interval analysis runs deterministic twice (min/max scenarios), so 2× cost but still polynomial.

---

## Testing & Validation Strategy

### Unit Tests

```julia
# test_deterministic.jl

@testset "Deterministic Max-Flow" begin
    # Simple linear network
    @testset "Linear Network" begin
        topology = create_linear_dag([1, 2, 3, 4])
        capacities = Dict(
            (1,2) => 10.0,
            (2,3) => 8.0,  # Bottleneck
            (3,4) => 12.0
        )
        result = analyze_capacity(...)
        @test result.total_max_flow == 8.0  # Limited by edge (2,3)
        @test (2,3) in result.bottlenecks.min_cut_edges
    end
    
    # Parallel paths (redundancy)
    @testset "Parallel Paths" begin
        topology = create_parallel_dag()
        # Path 1: 1→2→4 (capacity 10)
        # Path 2: 1→3→4 (capacity 15)
        result = analyze_capacity(...)
        @test result.total_max_flow == 25.0  # Sum of paths
        @test length(result.critical_paths.critical_paths) == 2
    end
    
    # Diamond structure
    @testset "Diamond Network" begin
        # Standard diamond bottleneck test
    end
end

@testset "Flow Conservation" begin
    # For every non-source, non-sink node:
    # incoming_flow == outgoing_flow
    
    topology = create_complex_dag()
    result = analyze_capacity(...)
    validation = validate_capacity_result(result, problem)
    
    @test validation.flow_conservation_satisfied
    @test validation.max_conservation_error < 1e-10
end

@testset "Capacity Constraints" begin
    # No edge or node should exceed its capacity
    
    result = analyze_capacity(...)
    
    for (edge, flow) in result.edge_flows
        capacity = problem.edge_capacities[edge]
        @test flow <= capacity + 1e-10  # Tolerance for floating point
    end
    
    for (node, flow) in result.node_flows
        capacity = problem.node_capacities[node]
        @test flow <= capacity + 1e-10
    end
end
```

### Integration Tests

```julia
# test_integration.jl

@testset "Full Analysis Pipeline" begin
    # Load real network file
    edges_file = "test/data/drone_network.edges"
    topology = load_network_topology(edges_file)
    
    # Define capacities
    node_capacities = Dict(...)
    edge_capacities = Dict(...)
    source_rates = Dict(...)
    target_nodes = Set([...])
    
    # Run full analysis
    result = analyze_capacity(
        topology,
        node_capacities = node_capacities,
        edge_capacities = edge_capacities,
        source_rates = source_rates,
        target_nodes = target_nodes,
        options = CapacityAnalysisOptions(
            compute_all_min_cuts = true,
            enumerate_critical_paths = true,
            compute_upgrade_priorities = true,
            include_classical_comparison = true
        )
    )
    
    # Validate all components present
    @test !isnothing(result.bottlenecks)
    @test !isnothing(result.upgrade_priorities)
    @test !isnothing(result.critical_paths)
    @test !isnothing(result.comparative_analysis)
    
    # Validate correctness
    validation = validate_capacity_result(result, problem)
    @test validation.all_checks_passed
end
```

### Benchmark Problems

```julia
# benchmark_problems.jl

# Known solutions for verification
BENCHMARK_NETWORKS = [
    (
        name = "Simple Linear",
        topology = ...,
        capacities = ...,
        expected_max_flow = 8.0,
        expected_min_cut = Set([(2,3)])
    ),
    (
        name = "Ford-Fulkerson Example",
        # Classic textbook example
        expected_max_flow = 23.0
    ),
    # Add more benchmark cases
]

@testset "Benchmark Problems" begin
    for benchmark in BENCHMARK_NETWORKS
        result = analyze_capacity(...)
        @test isapprox(result.total_max_flow, benchmark.expected_max_flow)
        @test result.bottlenecks.min_cut_edges == benchmark.expected_min_cut
    end
end
```

### Property-Based Testing

```julia
using PropertyBasedTesting

@testset "Property: Max-Flow = Min-Cut" begin
    # For any valid network, max-flow should equal min-cut capacity
    @check function maxflow_equals_mincut(network)
        result = analyze_capacity(network)
        validation = validate_capacity_result(result, network)
        return validation.optimality_verified
    end
end

@testset "Property: Flow Conservation" begin
    @check function flow_is_conserved(network)
        result = analyze_capacity(network)
        validation = validate_capacity_result(result, network)
        return validation.flow_conservation_satisfied
    end
end

@testset "Property: Monotonicity (Intervals)" begin
    # Increasing capacities should not decrease max-flow
    @check function capacity_monotonicity(network)
        result1 = analyze_capacity(network, capacities1)
        result2 = analyze_capacity(network, capacities2)  # capacities2 ≥ capacities1
        return result2.total_max_flow >= result1.total_max_flow
    end
end
```

---

## Success Criteria

### Module Refactor Success
- ✅ All tests pass
- ✅ Validation reports no errors on test cases
- ✅ Performance comparable or better than current implementation
- ✅ Code organization clear and modular
- ✅ Mathematical exactness guaranteed

### Backend Integration Success
- ✅ Endpoint handles deterministic requests correctly
- ✅ Endpoint handles interval requests correctly
- ✅ JSON serialization works for all result types
- ✅ Error handling is robust
- ✅ Performance acceptable (< 1 second for typical networks)

### Frontend Implementation Success
- ✅ UI intuitive for domain experts
- ✅ All analysis results displayed clearly
- ✅ Visualizations are informative
- ✅ Export functionality works
- ✅ Responsive and performant

### Overall System Success
- ✅ End-to-end workflow: upload network → run analysis → view results → export
- ✅ Results interpretable by civil engineers/network analysts
- ✅ Correctness validated on benchmark problems
- ✅ Ready for ESREL publication/presentation

---

## Future Extensions (Post-Initial Release)

### Potential Additions
1. **P-box support** (if needed for research)
   - Requires robust p-box arithmetic library
   - Conservative bounds on flow distributions

2. **Multi-commodity flow**
   - Different flow types sharing network
   - More complex, NP-hard in general

3. **Temporal dynamics**
   - Time-varying capacities
   - Scheduling optimization

4. **Stochastic analysis**
   - Monte Carlo wrapper around deterministic core
   - Probability distributions for max-flow

5. **Failure scenario analysis**
   - "What if component X fails?"
   - Cascading failure simulation

6. **Cost optimization**
   - Minimize cost subject to flow constraints
   - Linear programming formulation

7. **Network design optimization**
   - Where to add capacity for max improvement?
   - Budget-constrained optimization

---

## Contact & Maintenance

**Primary Developer**: [Your Name]  
**Project**: Information Propagation Framework  
**Institution**: University of Strathclyde  
**Target Conference**: ESREL 2026

**Documentation Updates**: Update this plan as requirements evolve  
**Version Control**: Track changes in git with meaningful commits  
**Code Reviews**: Review all major changes before merging

---

## Appendix: Key Decisions Made

1. **Dropped P-boxes**: Too complex, intervals sufficient for exact analysis
2. **Dropped multi-commodity**: Not needed for current research scope
3. **Focus on DAGs**: Exploit topological structure for efficiency
4. **Exact over approximate**: Mathematical rigor is priority
5. **Domain-expert outputs**: Plain language recommendations, not just numbers
6. **Modular architecture**: Separate concerns for maintainability
7. **Comprehensive testing**: Property-based and benchmark validation
8. **Interval arithmetic**: Use proven library (IntervalArithmetic.jl)

---

**End of Capacity Analysis Refactor Plan**
