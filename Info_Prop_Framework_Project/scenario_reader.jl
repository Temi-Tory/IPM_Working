"""
    ScenarioReader: Parse and display capacity demo scenarios from markdown
    
Extracts and presents all demo scenarios in a clean, structured format.
"""

module ScenarioReader

export read_scenarios, display_scenario_summary, display_all_scenarios

using Printf

"""
Scenario structure to hold parsed information
"""
mutable struct Scenario
    number::Int
    name::String
    source_rates::String
    critical_components::Vector{String}
    expected_max_flow::String
    bottleneck_type::String
    key_metrics::Vector{String}
    key_limitations::Vector{String}
    recommendations::Vector{String}
end

function read_scenarios(filepath::String)
    """Parse markdown file and extract scenarios"""
    
    scenarios = Scenario[]
    
    try
        content = read(filepath, String)
        
        # Split by scenario headings
        scenario_blocks = split(content, r"## Scenario \d+")
        
        for (idx, block) in enumerate(scenario_blocks[2:end])  # Skip header
            scenario_num = idx
            
            # Extract scenario name
            name_match = match(r"(.*?)\n", block)
            name = name_match !== nothing ? strip(name_match.captures[1]) : "Unknown"
            
            # Extract source rates
            source_match = match(r"\*\*Source rates?\*\*:\s*(.*?)\n", block)
            source_rates = source_match !== nothing ? strip(source_match.captures[1]) : "N/A"
            
            # Extract max flow expectation
            max_flow_match = match(r"\"total_max_flow\"\s*:\s*(.*?)[,\n}]", block)
            expected_max_flow = max_flow_match !== nothing ? strip(max_flow_match.captures[1]) : "N/A"
            
            # Extract bottleneck type
            type_match = match(r"\"bottleneck_type\"\s*:\s*\"(.*?)\"", block)
            bottleneck_type = type_match !== nothing ? strip(type_match.captures[1]) : "N/A"
            
            # Extract critical components
            critical_components = String[]
            if contains(block, "saturated_edges")
                edges_match = match(r"\"saturated_edges\"\s*:\s*\[(.*?)\]", block)
                if edges_match !== nothing
                    edges_str = edges_match.captures[1]
                    push!(critical_components, "Saturated Edges: " * edges_str[1:min(80, length(edges_str))] * "...")
                end
            end
            if contains(block, "saturated_nodes")
                nodes_match = match(r"\"saturated_nodes\"\s*:\s*\[(.*?)\]", block)
                if nodes_match !== nothing
                    nodes_str = nodes_match.captures[1]
                    push!(critical_components, "Saturated Nodes: [" * nodes_str * "]")
                end
            end
            
            # Extract metrics from configuration
            key_metrics = String[]
            
            # Get Node 11 info if available
            node11_match = match(r"Node 11[^:]*:\s*\*\*(.*?)\*\*", block)
            if node11_match !== nothing
                push!(key_metrics, "Node 11 Capacity: " * strip(node11_match.captures[1]))
            end
            
            # Get Node 19 info if available
            node19_match = match(r"Node 19[^:]*:\s*\*\*(.*?)\*\*", block)
            if node19_match !== nothing
                push!(key_metrics, "Node 19 Capacity: " * strip(node19_match.captures[1]))
            end
            
            # Extract marginal values and priorities
            marginal_match = match(r"\"marginal_value\"\s*:\s*(.*?)[,\n}]", block)
            if marginal_match !== nothing
                push!(key_metrics, "Marginal Value: " * strip(marginal_match.captures[1]))
            end
            
            # Extract key limitations
            key_limitations = String[]
            
            if contains(block, "single_points_of_failure")
                push!(key_limitations, "CRITICAL: Single Point of Failure at Node 11")
            elseif bottleneck_type == "transmission"
                push!(key_limitations, "Network limited by edge transmission capacities")
            elseif bottleneck_type == "node_processing"
                push!(key_limitations, "Network limited by node processing capacities")
            elseif bottleneck_type == "mixed"
                push!(key_limitations, "Network limited by mixed node and edge constraints")
            elseif bottleneck_type == "source_limited"
                push!(key_limitations, "Network has excess capacity; limited by sources")
            end
            
            # Extract recommendations
            recommendations = String[]
            
            # Look for rationale
            rationale_match = match(r"\"rationale\"\s*:\s*\"(.*?)\"", block)
            if rationale_match !== nothing
                push!(recommendations, strip(rationale_match.captures[1]))
            end
            
            # Look for strategic recommendations in text
            if contains(block, "Recommendation")
                rec_match = match(r"Recommendation.*?:\s*\"(.*?)\"", block)
                if rec_match !== nothing
                    push!(recommendations, strip(rec_match.captures[1]))
                end
            end
            
            scenario = Scenario(
                scenario_num,
                name,
                source_rates,
                critical_components,
                expected_max_flow,
                bottleneck_type,
                key_metrics,
                key_limitations,
                recommendations
            )
            
            push!(scenarios, scenario)
        end
        
    catch e
        println("Error reading file: $e")
        return Scenario[]
    end
    
    return scenarios
end

function display_scenario_summary(scenario::Scenario)
    """Display a clean summary of a single scenario"""
    
    println("\n" * "="^80)
    @printf "SCENARIO %d: %s\n" scenario.number scenario.name
    println("="^80)
    
    println("\n📊 CONFIGURATION")
    println("─" * "─"^79)
    println("  Source Rates: $(scenario.source_rates)")
    
    println("\n🎯 CORE METRICS")
    println("─" * "─"^79)
    println("  Expected Max Flow: $(scenario.expected_max_flow)")
    println("  Bottleneck Type: $(scenario.bottleneck_type)")
    
    if !isempty(scenario.key_metrics)
        println("\n📈 KEY METRICS")
        println("─" * "─"^79)
        for metric in scenario.key_metrics
            println("  • $metric")
        end
    end
    
    if !isempty(scenario.critical_components)
        println("\n⚠️  CRITICAL COMPONENTS")
        println("─" * "─"^79)
        for component in scenario.critical_components
            println("  • $component")
        end
    end
    
    if !isempty(scenario.key_limitations)
        println("\n🔴 KEY LIMITATIONS")
        println("─" * "─"^79)
        for limitation in scenario.key_limitations
            println("  • $limitation")
        end
    end
    
    if !isempty(scenario.recommendations)
        println("\n💡 RECOMMENDATIONS")
        println("─" * "─"^79)
        for (i, rec) in enumerate(scenario.recommendations)
            println("  $i. $rec")
        end
    end
end

function display_all_scenarios(scenarios::Vector{Scenario})
    """Display comprehensive overview of all scenarios"""
    
    println("\n" * "█"^80)
    println("█" * " "^78 * "█")
    println("█" * " "^20 * "CAPACITY DEMO SCENARIOS - COMPREHENSIVE READER" * " "^14 * "█")
    println("█" * " "^78 * "█")
    println("█"^80)
    
    println("\n📋 QUICK OVERVIEW TABLE")
    println("─" * "─"^79)
    @printf "%-4s %-25s %-20s %-15s %-15s\n" "ID" "Scenario" "Source Rates" "Max Flow" "Type"
    println("─" * "─"^79)
    
    for scenario in scenarios
        src_rates = length(scenario.source_rates) > 19 ? scenario.source_rates[1:16] * "..." : scenario.source_rates
        max_flow = length(scenario.expected_max_flow) > 14 ? scenario.expected_max_flow[1:11] * "..." : scenario.expected_max_flow
        @printf "%-4d %-25s %-20s %-15s %-15s\n" scenario.number scenario.name src_rates max_flow scenario.bottleneck_type
    end
    
    println("\n" * "─"^80)
    
    # Display detailed summaries
    for scenario in scenarios
        if scenario.number <= 5  # Main scenarios
            display_scenario_summary(scenario)
        end
    end
    
    # Interval scenarios summary
    if length(scenarios) >= 6
        println("\n" * "="^80)
        println("SCENARIOS 6-7: INTERVAL SCENARIOS")
        println("="^80)
        println("\n📊 CONFIGURATION")
        println("─" * "─"^79)
        println("  Mode: Uncertainty handling with interval arithmetic")
        println("  Guaranteed Min Flow: 12-15 units")
        println("  Possible Max Flow: 22-28 units")
        println("\n💡 DISPLAY CHARACTERISTICS")
        println("─" * "─"^79)
        println("  • Range visualization showing best/worst case scenarios")
        println("  • Uncertainty bars on all metrics")
        println("  • Side-by-side worst-case vs best-case comparison")
        println("  • Confidence intervals for all bottleneck predictions")
    end
    
    println("\n" * "="^80)
    println("SUMMARY STATISTICS")
    println("="^80)
    println("  Total Scenarios: $(length(scenarios))")
    println("  Bottleneck Types: $(unique([s.bottleneck_type for s in scenarios[1:5]]))")
    println("  Source Rate Range: ~12 to ~90 units")
    println("  Expected Flow Range: ~12 to ~84 units")
    
    println("\n🎯 KEY TESTING POINTS FOR BACKEND")
    println("─" * "─"^79)
    println("  1. Total max flow significantly less than source rates")
    println("  2. Saturated edges/nodes arrays match expected values")
    println("  3. Bottleneck type matches scenario intent")
    println("  4. Marginal values > 0 for tight components (except source-limited)")
    println("  5. Utilization showing 90-100% for critical components")
    
    println("\n" * "█"^80)
end

function main()
    """Main entry point"""
    
    # Construct file path
    root_dir = dirname(@__FILE__)
    filepath = joinpath(root_dir, "dag_ntwrk_files/water/capacity_v2_demo_pack/EXPECTED_UI_OUTPUTS.md")
    
    println("ℹ️  Scenario Reader - Information Propagation Capacity Analysis")
    println("Reading scenarios from: $filepath\n")
    
    scenarios = read_scenarios(filepath)
    
    if isempty(scenarios)
        println("⚠️  No scenarios found. Please verify file path.")
        return
    end
    
    display_all_scenarios(scenarios)
    
    println("\n✅ Scenario parsing complete!")
    println("   Found $(length(scenarios)) scenarios with full configuration data")
end

end  # module ScenarioReader

# Run if executed directly
if abspath(PROGRAM_FILE) == @__FILE__
    ScenarioReader.main()
end
