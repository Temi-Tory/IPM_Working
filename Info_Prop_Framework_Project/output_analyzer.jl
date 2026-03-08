"""
    OutputAnalyzer: Parse and display expected network flow outputs
    
Analyzes computed flow data from backend responses.
"""

module OutputAnalyzer

export analyze_outputs, summarize_flows, display_network_health

using JSON, Printf, Statistics

"""Analyze edge flows and utilization"""
function analyze_outputs(filepath::String)
    
    try
        data = JSON.parsefile(filepath)
        
        println("\n" * "█"^80)
        println("█" * " "^20 * "NETWORK FLOW OUTPUT ANALYSIS" * " "^32 * "█")
        println("█"^80)
        
        # ===== COMPUTATION METRICS =====
        println("\n⏱️  COMPUTATION METRICS")
        println("─" * "─"^79)
        @printf "  Computation Time: %.2f ms\n" data["computation_time_ms"]
        
        # ===== NETWORK UTILIZATION =====
        println("\n📊 NETWORK UTILIZATION")
        println("─" * "─"^79)
        @printf "  Overall Network Utilization: %.2f%%\n" (data["network_utilization"] * 100)
        
        # ===== EDGE FLOWS =====
        println("\n🔄 EDGE FLOWS")
        println("─" * "─"^79)
        
        edge_flows = data["edge_flows"]
        
        # Filter flows with non-zero values
        active_edges = filter(e -> e[2] > 0, collect(edge_flows))
        sort!(active_edges, by = e -> e[2], rev = true)
        
        @printf "  Total Edges: %d\n" length(edge_flows)
        @printf "  Active Edges (non-zero flow): %d\n" length(active_edges)
        
        if !isempty(active_edges)
            total_flow = sum([f[2] for f in active_edges])
            @printf "  Total Active Flow: %.4f units\n" total_flow
            
            println("\n  📈 Top 20 Edges by Flow:")
            println("  " * "─"^77)
            @printf "  %-12s %-12s %-15s %-15s\n" "Edge" "Flow" "Utilization" "Spare"
            println("  " * "─"^77)
            
            for (i, (edge, flow)) in enumerate(active_edges[1:min(20, end)])
                if haskey(data["edge_utilization"], edge)
                    util = data["edge_utilization"][edge]
                    @printf "  %-12s %-12.4f %-14.1f%% %-15.4f\n" edge flow (util["utilization"] * 100) util["spare"]
                else
                    @printf "  %-12s %-12.4f %-14s %-15s\n" edge flow "N/A" "N/A"
                end
                if i >= 20
                    break
                end
            end
        end
        
        # ===== EDGE UTILIZATION ANALYSIS =====
        println("\n\n⚡ EDGE UTILIZATION ANALYSIS")
        println("─" * "─"^79)
        
        edge_util = data["edge_utilization"]
        utilizations = [u["utilization"] for (k, u) in edge_util if u["capacity"] > 0]
        
        if !isempty(utilizations)
            @printf "  Min Utilization: %.2f%%\n" (minimum(utilizations) * 100)
            @printf "  Max Utilization: %.2f%%\n" (maximum(utilizations) * 100)
            @printf "  Mean Utilization: %.2f%%\n" (mean(utilizations) * 100)
            @printf "  Median Utilization: %.2f%%\n" (median(utilizations) * 100)
            
            # Count by utilization ranges
            high_util = sum(1 for u in utilizations if u >= 0.9)
            med_util = sum(1 for u in utilizations if 0.5 <= u < 0.9)
            low_util = sum(1 for u in utilizations if 0.1 <= u < 0.5)
            very_low = sum(1 for u in utilizations if u < 0.1)
            
            println("\n  Utilization Distribution:")
            @printf "    🔴 Very High (≥90%%): %d edges\n" high_util
            @printf "    🟠 High (50-90%%): %d edges\n" med_util
            @printf "    🟡 Medium (10-50%%): %d edges\n" low_util
            @printf "    🟢 Low (<10%%): %d edges\n" very_low
        end
        
        # ===== BOTTLENECK IDENTIFICATION =====
        println("\n\n🚨 BOTTLENECK IDENTIFICATION")
        println("─" * "─"^79)
        
        saturated = filter((k, v) -> v["utilization"] >= 0.95 && v["capacity"] > 0, edge_util)
        near_sat = filter((k, v) -> 0.85 <= v["utilization"] < 0.95 && v["capacity"] > 0, edge_util)
        
        if !isempty(saturated)
            println("  Saturated Edges (≥95% utilization):")
            for (edge, util) in sort(collect(saturated), by = p -> p[2]["utilization"], rev = true)
                @printf "    • %s: %.1f%% (flow: %.4f / capacity: %.4f)\n" edge (util["utilization"]*100) util["flow"] util["capacity"]
            end
        else
            println("  ✓ No saturated edges found")
        end
        
        if !isempty(near_sat) && isempty(saturated)
            println("\n  Near-Saturated Edges (85-95% utilization):")
            for (edge, util) in sort(collect(near_sat), by = p -> p[2]["utilization"], rev = true)[1:min(10, end)]
                @printf "    • %s: %.1f%% (flow: %.4f / capacity: %.4f)\n" edge (util["utilization"]*100) util["flow"] util["capacity"]
            end
        end
        
        # ===== NODE ANALYSIS =====
        println("\n\n🔹 NODE FLOW ANALYSIS")
        println("─" * "─"^79)
        
        # Extract node inflows and outflows
        node_inflow = Dict()
        node_outflow = Dict()
        
        for (edge, flow) in edge_flows
            if flow > 0
                parts = match(r"\((\d+),(\d+)\)", edge)
                if parts !== nothing
                    from_node = parse(Int, parts.captures[1])
                    to_node = parse(Int, parts.captures[2])
                    
                    outflow = get(node_outflow, from_node, 0.0)
                    inflow = get(node_inflow, to_node, 0.0)
                    
                    node_outflow[from_node] = outflow + flow
                    node_inflow[to_node] = inflow + flow
                end
            end
        end
        
        # Find hub nodes (high degree)
        all_nodes = sort(unique(vcat(keys(node_inflow), keys(node_outflow))))
        
        hub_nodes = sort(all_nodes, by = n -> get(node_inflow, n, 0.0) + get(node_outflow, n, 0.0), rev = true)[1:min(5, end)]
        
        println("  Top Hub Nodes by Total Flow:")
        for node in hub_nodes
            inflow = get(node_inflow, node, 0.0)
            outflow = get(node_outflow, node, 0.0)
            @printf "    Node %d: In: %.4f | Out: %.4f | Total: %.4f\n" node inflow outflow (inflow + outflow)
        end
        
        # ===== NETWORK STATISTICS =====
        println("\n\n📋 NETWORK STATISTICS")
        println("─" * "─"^79)
        @printf "  Nodes with Activity: %d\n" length(all_nodes)
        @printf "  Total Network Flow (sum of all edge flows): %.4f units\n" sum(values(edge_flows))
        
        # Check for sources and sinks
        sources = filter(n -> !haskey(node_inflow, n) && haskey(node_outflow, n), all_nodes)
        sinks = filter(n -> haskey(node_inflow, n) && !haskey(node_outflow, n), all_nodes)
        
        @printf "  Sources (outflow only): %d\n" length(sources)
        @printf "  Sinks (inflow only): %d\n" length(sinks)
        
        if !isempty(sources)
            println("\n  Source Nodes:")
            for src in sort(sources, by = s -> get(node_outflow, s, 0.0), rev = true)
                @printf "    Node %d → %.4f units\n" src get(node_outflow, src, 0.0)
            end
        end
        
        if !isempty(sinks)
            println("\n  Sink Nodes:")
            for sink in sort(sinks, by = s -> get(node_inflow, s, 0.0), rev = true)
                @printf "    Node %d ← %.4f units\n" sink get(node_inflow, sink, 0.0)
            end
        end
        
        println("\n" * "█"^80)
        println("✅ Flow analysis complete!")
        println("█"^80 * "\n")
        
    catch e
        println("❌ Error: $e")
    end
end

function main()
    filepath = "EXPECTED_OUTPUTS.json"
    
    if !isfile(filepath)
        println("⚠️  File not found: $filepath")
        println("Please ensure EXPECTED_OUTPUTS.json exists in the current directory")
        return
    end
    
    analyze_outputs(filepath)
end

end  # module OutputAnalyzer

if abspath(PROGRAM_FILE) == @__FILE__
    OutputAnalyzer.main()
end
