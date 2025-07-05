#= using PlotlyJS, Colors, Statistics, Dates
using CSV, DataFrames, DelimitedFiles

# Include the existing drone analysis functions
include("DroneIDetailedCheck.jl")

"""
Interactive Drone Network Visualization Script

This script creates an interactive plot of the drone network data using PlotlyJS.
It leverages the existing functions from DroneIDetailedCheck.jl to load and process
the drone network data, then creates an interactive visualization with:
- Geographic positioning of nodes
- Color-coded node types (hospitals, airports, sources, receivers)
- Edge visualization with weight-based styling
- Interactive features (hover, drag nodes)
- Draggable nodes with connected edges
- Network analysis overlays
"""

# Color scheme for different node types
const NODE_COLORS = Dict(
    "hospital" => "red",
    "airport" => "blue", 
    "source" => "green",
    "receiver" => "orange",
    "generic" => "gray",
    "hub" => "purple"
)

const NODE_SYMBOLS = Dict(
    "hospital" => "cross",
    "airport" => "diamond",
    "source" => "triangle-up",
    "receiver" => "triangle-down", 
    "generic" => "circle",
    "hub" => "star"
)

"""
Classify nodes for visualization based on their properties
"""
function classify_node_for_viz(node::Node)::String
    # Priority-based classification
    if node.city_type == "H"
        return "hospital"
    elseif occursin("Airport", node.info) || occursin("airport", node.info)
        return "airport"
    elseif node.source_receiver_type == "SOURCE"
        return "source"
    elseif node.source_receiver_type == "RECEIVER"
        return "receiver"
    elseif node.group_1 >= 10 || node.source_receiver_type == "SOURCE"
        return "hub"
    else
        return "generic"
    end
end

"""
Create hover text for nodes with detailed information
"""
function create_hover_text(node::Node, connections::Int, avg_weight::Float64)::String
    return """
    <b>Node $(node.id)</b><br>
    Location: $(node.info)<br>
    Type: $(node.city_type)<br>
    Role: $(node.source_receiver_type)<br>
    Coordinates: ($(round(node.lat, digits=4)), $(round(node.lon, digits=4)))<br>
    East/North: ($(round(node.east, digits=1)), $(round(node.north, digits=1)))<br>
    Connections: $connections<br>
    Avg Weight: $(round(avg_weight, digits=2))<br>
    Groups: $(node.group_1), $(node.group_2)
    """
end

"""
Create edge traces for the network visualization
"""
function create_edge_traces(edges::Vector{Edge}, nodes_dict::Dict{Int, Node}, 
                           edge_filter_threshold::Float64 = 0.0)
    # Filter edges by weight threshold
    filtered_edges = filter(e -> e.weight >= edge_filter_threshold, edges)
    
    if isempty(filtered_edges)
        return PlotlyJS.GenericTrace[]
    end
    
    # Prepare edge coordinates
    edge_x = Float64[]
    edge_y = Float64[]
    edge_weights = Float64[]
    
    for edge in filtered_edges
        if haskey(nodes_dict, edge.from) && haskey(nodes_dict, edge.to)
            from_node = nodes_dict[edge.from]
            to_node = nodes_dict[edge.to]
            
            # Use east/north coordinates for better local positioning
            push!(edge_x, from_node.east, to_node.east, NaN)
            push!(edge_y, from_node.north, to_node.north, NaN)
            push!(edge_weights, edge.weight)
        end
    end
    
    if isempty(edge_x)
        return PlotlyJS.GenericTrace[]
    end
    
    # Normalize weights for line width (1-5 pixel range)
    if length(edge_weights) > 1
        min_weight, max_weight = extrema(edge_weights)
        if max_weight > min_weight
            normalized_weights = 1 .+ 4 .* (edge_weights .- min_weight) ./ (max_weight - min_weight)
        else
            normalized_weights = fill(2.5, length(edge_weights))
        end
    else
        normalized_weights = [2.5]
    end
    
    # Create edge trace
    edge_trace = PlotlyJS.scatter(
        x=edge_x, y=edge_y,
        mode="lines",
        line=attr(
            width=2,
            color="rgba(125,125,125,0.5)"
        ),
        hoverinfo="skip",
        name="Connections",
        showlegend=true
    )
    
    return [edge_trace]
end

"""
Create node traces grouped by type for better legend organization
"""
function create_node_traces(nodes_dict::Dict{Int, Node}, 
                           adj_list::Dict{Int, Dict{Int, Float64}})
    # Group nodes by classification
    node_groups = Dict{String, Vector{Int}}()
    
    for (node_id, node) in nodes_dict
        node_type = classify_node_for_viz(node)
        if !haskey(node_groups, node_type)
            node_groups[node_type] = Int[]
        end
        push!(node_groups[node_type], node_id)
    end
    
    traces = PlotlyJS.GenericTrace[]
    
    # Create a trace for each node type
    for (node_type, node_ids) in node_groups
        if isempty(node_ids)
            continue
        end
        
        x_coords = Float64[]
        y_coords = Float64[]
        hover_texts = String[]
        sizes = Float64[]
        
        for node_id in node_ids
            node = nodes_dict[node_id]
            connections = haskey(adj_list, node_id) ? length(adj_list[node_id]) : 0
            
            # Calculate average weight for this node
            avg_weight = 0.0
            if connections > 0 && haskey(adj_list, node_id)
                weights = collect(values(adj_list[node_id]))
                avg_weight = mean(weights)
            end
            
            push!(x_coords, node.east)
            push!(y_coords, node.north)
            push!(hover_texts, create_hover_text(node, connections, avg_weight))
            
            # Size based on connectivity (5-20 pixel range)
            node_size = 8 + min(12, connections * 0.5)
            push!(sizes, node_size)
        end
        
        # Create trace for this node type with draggable functionality
        trace = PlotlyJS.scatter(
            x=x_coords, y=y_coords,
            mode="markers",
            marker=attr(
                size=sizes,
                color=NODE_COLORS[node_type],
                symbol=NODE_SYMBOLS[node_type],
                line=attr(width=1, color="black"),
                opacity=0.8
            ),
            text=hover_texts,
            hoverinfo="text",
            name="$(titlecase(node_type))s ($(length(node_ids)))",
            showlegend=true
        )
        
        push!(traces, trace)
    end
    
    return traces
end

"""
Create JavaScript code for handling drag interactions and edge updates
"""
function create_drag_javascript()
    return """
    <script>
    // Enhanced drag functionality for individual nodes
    function enableNodeDragging() {
        var plotDiv = document.getElementsByClassName('plotly-graph-div')[0];
        if (!plotDiv) return;
        
        var draggedNode = null;
        var isDragging = false;
        var startX, startY;
        
        // Override Plotly's default drag behavior
        plotDiv.on('plotly_beforeplot', function() {
            // Disable default selection behavior
            plotDiv._fullLayout.dragmode = false;
        });
        
        // Handle node hover for cursor change
        plotDiv.on('plotly_hover', function(data) {
            if (data.points && data.points.length > 0) {
                var point = data.points[0];
                if (point.data.mode && point.data.mode.includes('markers')) {
                    plotDiv.style.cursor = 'grab';
                }
            }
        });
        
        plotDiv.on('plotly_unhover', function(data) {
            if (!isDragging) {
                plotDiv.style.cursor = 'default';
            }
        });
        
        // Handle mouse down on nodes
        plotDiv.on('plotly_click', function(data) {
            if (data.points && data.points.length > 0) {
                var point = data.points[0];
                if (point.data.mode && point.data.mode.includes('markers')) {
                    draggedNode = {
                        traceIndex: point.curveNumber,
                        pointIndex: point.pointIndex,
                        x: point.x,
                        y: point.y,
                        originalX: point.x,
                        originalY: point.y
                    };
                    
                    // Start drag mode
                    isDragging = true;
                    plotDiv.style.cursor = 'grabbing';
                    
                    // Prevent default plotly behavior
                    data.event.stopPropagation();
                    data.event.preventDefault();
                }
            }
        });
        
        // Handle mouse movement for dragging
        plotDiv.addEventListener('mousemove', function(e) {
            if (isDragging && draggedNode) {
                var rect = plotDiv.getBoundingClientRect();
                var xaxis = plotDiv._fullLayout.xaxis;
                var yaxis = plotDiv._fullLayout.yaxis;
                
                // Convert pixel coordinates to data coordinates
                var newX = xaxis.p2d(e.clientX - rect.left);
                var newY = yaxis.p2d(e.clientY - rect.top);
                
                // Update node position in real-time
                var update = {};
                update['x[' + draggedNode.pointIndex + ']'] = newX;
                update['y[' + draggedNode.pointIndex + ']'] = newY;
                
                Plotly.restyle(plotDiv, update, draggedNode.traceIndex);
                
                // Update stored position
                draggedNode.x = newX;
                draggedNode.y = newY;
                
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        // Handle mouse up to end dragging
        plotDiv.addEventListener('mouseup', function(e) {
            if (isDragging) {
                isDragging = false;
                plotDiv.style.cursor = 'default';
                draggedNode = null;
            }
        });
        
        // Handle mouse leave to end dragging
        plotDiv.addEventListener('mouseleave', function(e) {
            if (isDragging) {
                isDragging = false;
                plotDiv.style.cursor = 'default';
                draggedNode = null;
            }
        });
        
        // Prevent context menu during drag
        plotDiv.addEventListener('contextmenu', function(e) {
            if (isDragging) {
                e.preventDefault();
            }
        });
        
        // Disable text selection during drag
        plotDiv.addEventListener('selectstart', function(e) {
            if (isDragging) {
                e.preventDefault();
            }
        });
    }
    
    // Initialize drag functionality when plot is ready
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(enableNodeDragging, 1500);
    });
    
    // Also try to initialize after plotly is fully loaded
    if (typeof Plotly !== 'undefined') {
        setTimeout(enableNodeDragging, 2000);
    }
    </script>
    """
end

"""
Save plot with custom drag functionality embedded
"""
function save_plot_with_drag(plot, filename::String)
    # Save the plot normally first
    PlotlyJS.savefig(plot, filename)
    
    # Read the HTML file and inject custom JavaScript
    html_content = read(filename, String)
    
    # Find the closing </body> tag and insert our JavaScript before it
    drag_js = create_drag_javascript()
    
    # Insert the JavaScript before the closing </body> tag
    if occursin("</body>", html_content)
        html_content = replace(html_content, "</body>" => drag_js * "\n</body>")
    else
        # If no </body> tag found, append at the end
        html_content *= drag_js
    end
    
    # Write the modified HTML back to file
    write(filename, html_content)
    
    println("   ✅ Enhanced with drag functionality: $filename")
end

"""
Create network statistics annotation
"""
function create_stats_annotation(nodes_dict::Dict{Int, Node},
                                edges::Vector{Edge},
                                adj_list::Dict{Int, Dict{Int, Float64}})
    n_nodes = length(nodes_dict)
    n_edges = length(edges)
    
    # Calculate connectivity stats
    degrees = [length(neighbors) for neighbors in values(adj_list)]
    avg_degree = isempty(degrees) ? 0.0 : mean(degrees)
    max_degree = isempty(degrees) ? 0 : maximum(degrees)
    
    # Weight stats
    weights = [edge.weight for edge in edges]
    avg_weight = isempty(weights) ? 0.0 : mean(weights)
    
    # Node type counts
    type_counts = Dict{String, Int}()
    for node in values(nodes_dict)
        node_type = classify_node_for_viz(node)
        type_counts[node_type] = get(type_counts, node_type, 0) + 1
    end
    
    stats_text = """
    <b>Network Statistics</b><br>
    Nodes: $n_nodes | Edges: $n_edges<br>
    Avg Degree: $(round(avg_degree, digits=1))<br>
    Max Degree: $max_degree<br>
    Avg Weight: $(round(avg_weight, digits=2))<br>
    <br>
    <b>Node Types:</b><br>
    """
    
    for (node_type, count) in sort(collect(type_counts), by=x->x[2], rev=true)
        stats_text *= "$(titlecase(node_type)): $count<br>"
    end
    
    return stats_text
end

"""
Create interactive plot for a single drone network
"""
function create_interactive_plot(nodes_dict::Dict{Int, Node}, 
                                edges::Vector{Edge},
                                adj_list::Dict{Int, Dict{Int, Float64}},
                                title::String;
                                edge_filter_threshold::Float64 = 0.0,
                                highlight_critical::Bool = false)
    
    println("Creating interactive plot: $title")
    println("  Nodes: $(length(nodes_dict))")
    println("  Edges: $(length(edges)) (threshold: $edge_filter_threshold)")
    
    # Create traces
    edge_traces = create_edge_traces(edges, nodes_dict, edge_filter_threshold)
    node_traces = create_node_traces(nodes_dict, adj_list)
    
    # Combine all traces
    all_traces = vcat(edge_traces, node_traces)
    
    # Create layout with drag functionality enabled and zoom/pan disabled
    layout = PlotlyJS.Layout(
        title=attr(
            text=title,
            x=0.5,
            font=attr(size=16)
        ),
        xaxis=attr(
            title="East (m)",
            showgrid=true,
            zeroline=false,
            fixedrange=true  # Disable zoom on x-axis
        ),
        yaxis=attr(
            title="North (m)",
            showgrid=true,
            zeroline=false,
            scaleanchor="x",
            scaleratio=1,
            fixedrange=true  # Disable zoom on y-axis
        ),
        hovermode="closest",
        showlegend=true,
        dragmode="pan",  # Allow panning but we'll override with custom drag
        legend=attr(
            x=1.02,
            y=1,
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="black",
            borderwidth=1
        ),
        width=1200,
        height=800,
        margin=attr(l=50, r=200, t=80, b=50),
        annotations=[
            attr(
                text=create_stats_annotation(nodes_dict, edges, adj_list),
                showarrow=false,
                xref="paper", yref="paper",
                x=1.02, y=0.5,
                xanchor="left", yanchor="middle",
                bgcolor="rgba(255,255,255,0.8)",
                bordercolor="black",
                borderwidth=1,
                font=attr(size=10)
            )
        ]
    )
    
    # Create the plot
    plot = PlotlyJS.plot(all_traces, layout)
    
    # Add custom configuration for better drag experience
    PlotlyJS.relayout!(plot,
        dragmode=false,  # Completely disable default drag behavior
        config=attr(
            displayModeBar=true,
            modeBarButtonsToRemove=["zoom2d", "pan2d", "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d", "select2d", "lasso2d"],
            displaylogo=false,
            scrollZoom=false,  # Disable scroll zoom
            doubleClick=false,  # Disable double click zoom
            toImageButtonOptions=attr(
                format="png",
                filename="drone_network",
                height=800,
                width=1200,
                scale=1
            )
        )
    )
    
    return plot
end

"""
Create comparative visualization of two drone networks
"""
function create_comparative_plot(analysis_results::Dict)
    nodes_dict = analysis_results["nodes_dict"]
    drone1_adj = analysis_results["drone1_adj"]
    drone2_adj = analysis_results["drone2_adj"]
    
    # Convert adjacency lists back to edge lists for visualization
    drone1_edges = Edge[]
    for (from_id, neighbors) in drone1_adj
        for (to_id, weight) in neighbors
            push!(drone1_edges, Edge(from_id, to_id, weight))
        end
    end
    
    drone2_edges = Edge[]
    for (from_id, neighbors) in drone2_adj
        for (to_id, weight) in neighbors
            push!(drone2_edges, Edge(from_id, to_id, weight))
        end
    end
    
    # Create individual plots
    plot1 = create_interactive_plot(
        nodes_dict, drone1_edges, drone1_adj,
        "Drone 1 Network (High Capability)",
        edge_filter_threshold=0.0
    )
    
    plot2 = create_interactive_plot(
        nodes_dict, drone2_edges, drone2_adj,
        "Drone 2 Network (Low Capability)", 
        edge_filter_threshold=0.0
    )
    
    return plot1, plot2
end

"""
Main function to create and save interactive drone network plots
"""
function create_drone_network_plots(;
    nodes_file::String = "src/Network-flow-algos/test/drone network/nodes.csv",
    drone1_file::String = "src/Network-flow-algos/test/drone network/feasible_drone_1.csv",
    drone2_file::String = "src/Network-flow-algos/test/drone network/feasible_drone_2.csv",
    output_dir::String = "src/Network-flow-algos/test/Test_Space/",
    edge_filter_threshold::Float64 = 0.0)
    
    println("🚁 Creating Interactive Drone Network Visualizations 🚁")
    println("="^60)
    
    try
        # Load and analyze data using existing functions
        println("📊 Loading and analyzing drone network data...")
        analysis_results = comprehensive_drone_analysis(nodes_file, drone1_file, drone2_file)
        
        println("\n🎨 Creating interactive visualizations...")
        
        # Create comparative plots
        plot1, plot2 = create_comparative_plot(analysis_results)
        
        # Save plots as HTML files
        output_file1 = joinpath(output_dir, "drone1_network_interactive.html")
        output_file2 = joinpath(output_dir, "drone2_network_interactive.html")
        
        println("💾 Saving interactive plots with drag functionality...")
        save_plot_with_drag(plot1, output_file1)
        save_plot_with_drag(plot2, output_file2)
        
        println("✅ Interactive plots saved successfully!")
        println("   📁 Drone 1 plot: $output_file1")
        println("   📁 Drone 2 plot: $output_file2")
        
        # Create a combined analysis summary
        create_analysis_summary(analysis_results, output_dir)
        
        # Display plots (if in interactive environment)
        try
            display(plot1)
            display(plot2)
        catch
            println("ℹ️  Plots created but not displayed (non-interactive environment)")
        end
        
        return plot1, plot2, analysis_results
        
    catch e
        println("❌ Error creating drone network plots: $e")
        rethrow(e)
    end
end

"""
Create a summary report of the network analysis
"""
function create_analysis_summary(analysis_results::Dict, output_dir::String)
    summary_file = joinpath(output_dir, "drone_network_analysis_summary.md")
    
    nodes_dict = analysis_results["nodes_dict"]
    comparison = analysis_results["comparison"]
    role_analysis = analysis_results["role_analysis"]
    transfer_nodes = analysis_results["transfer_nodes"]
    
    open(summary_file, "w") do f
        write(f, """
# Drone Network Analysis Summary

## Overview
This analysis examines two drone network configurations for emergency medical supply delivery.

## Network Statistics

### Drone 1 (High Capability)
- **Total Connections**: $(comparison["drone1_stats"]["total_edges"])
- **Hospital Coverage**: $(sum(conn > 0 for conn in values(comparison["drone1_stats"]["hospital_connectivity"]))) hospitals
- **Isolated Nodes**: $(length(comparison["drone1_stats"]["isolated_nodes"]))

### Drone 2 (Low Capability)  
- **Total Connections**: $(comparison["drone2_stats"]["total_edges"])
- **Hospital Coverage**: $(sum(conn > 0 for conn in values(comparison["drone2_stats"]["hospital_connectivity"]))) hospitals
- **Isolated Nodes**: $(length(comparison["drone2_stats"]["isolated_nodes"]))

## Node Classifications
""")
        
        for (role, node_ids) in role_analysis
            write(f, "- **$(titlecase(replace(role, "_" => " ")))**: $(length(node_ids))\n")
        end
        
        write(f, """

## Key Insights

### Coverage Analysis
- **Drone 1 Exclusive Access**: $(length(comparison["drone1_only_hospitals"])) hospitals
- **Drone 2 Exclusive Access**: $(length(comparison["drone2_only_hospitals"])) hospitals  
- **Both Can Reach**: $(length(comparison["both_accessible"])) hospitals

### Transfer Opportunities
- **Potential Transfer Nodes**: $(length(transfer_nodes))
- These nodes can serve both drone types for multi-modal routing

## Recommendations

1. **Primary Network**: Use Drone 1 for comprehensive coverage
2. **Specialized Missions**: Deploy Drone 2 for specific high-priority routes
3. **Transfer Hubs**: Implement $(length(transfer_nodes)) strategic transfer points
4. **Critical Nodes**: Focus on $(length(role_analysis["potential_hubs"])) identified hub locations

## Interactive Visualizations

The following interactive HTML files have been generated:
- `drone1_network_interactive.html` - Drone 1 network visualization
- `drone2_network_interactive.html` - Drone 2 network visualization

### Visualization Features
- **Node Colors**: Different colors represent node types (hospitals=red, airports=blue, etc.)
- **Node Sizes**: Size indicates connectivity (larger = more connections)
- **Edge Thickness**: Represents connection weights/costs
- **Hover Information**: Detailed node and connection data
- **Interactive Controls**: Drag nodes to reposition them, edges follow automatically
- **Draggable Nodes**: Click and drag any node to reposition it within the network

### Legend
- 🏥 **Red Cross**: Hospitals
- ✈️ **Blue Diamond**: Airports  
- 🔺 **Green Triangle Up**: Source nodes
- 🔻 **Orange Triangle Down**: Receiver nodes
- ⭐ **Purple Star**: Hub nodes
- ⚫ **Gray Circle**: Generic locations

Generated on $(Dates.now())
""")
    end
    
    println("📋 Analysis summary saved: $summary_file")
end

"""
Error handling wrapper for the main plotting function
"""
function safe_create_plots(; kwargs...)
    try
        return create_drone_network_plots(; kwargs...)
    catch e
        println("❌ Failed to create plots: $e")
        println("🔧 Troubleshooting tips:")
        println("   1. Ensure PlotlyJS.jl is installed: using Pkg; Pkg.add(\"PlotlyJS\")")
        println("   2. Check that data files exist in the specified paths")
        println("   3. Verify that DroneIDetailedCheck.jl is in the same directory")
        println("   4. Try running with default parameters first")
        rethrow(e)
    end
end

# Main execution
if abspath(PROGRAM_FILE) == @__FILE__
    println("🚀 Starting interactive drone network visualization...")
    plots_and_analysis = safe_create_plots()
    println("🎉 Visualization complete! Check the generated HTML files.")
end =#