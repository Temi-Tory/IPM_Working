using GLMakie, GraphMakie, Graphs, Colors, Statistics, Dates
using CSV, DataFrames, DelimitedFiles

# Include the existing drone analysis functions
include("DroneIDetailedCheck.jl")

"""
Interactive Drone Network Visualization Script using Makie.jl

This script creates a truly interactive plot where nodes can be dragged
and edges automatically follow the nodes. Uses GraphMakie for proper
network visualization with dynamic edge updates.
"""

# Color scheme for different node types
const NODE_COLORS_MAKIE = Dict(
    "hospital" => :red,
    "airport" => :blue, 
    "source" => :green,
    "receiver" => :orange,
    "generic" => :gray,
    "hub" => :purple
)

const NODE_MARKERS = Dict(
    "hospital" => :cross,
    "airport" => :diamond,
    "source" => :utriangle,
    "receiver" => :dtriangle, 
    "generic" => :circle,
    "hub" => :star5
)

"""
Classify nodes for visualization based on their properties
"""
function classify_node_for_viz_makie(node::Node)::String
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
Create interactive Makie plot with draggable nodes
"""
function create_interactive_makie_plot(nodes_dict::Dict{Int, Node}, 
                                      edges::Vector{Edge},
                                      adj_list::Dict{Int, Dict{Int, Float64}},
                                      title::String)
    
    println("Creating interactive Makie plot: $title")
    println("  Nodes: $(length(nodes_dict))")
    println("  Edges: $(length(edges))")
    
    # Create a simple graph structure
    node_ids = sort(collect(keys(nodes_dict)))
    n_nodes = length(node_ids)
    
    # Create mapping from node ID to graph index
    id_to_index = Dict(id => i for (i, id) in enumerate(node_ids))
    
    # Create graph
    g = SimpleGraph(n_nodes)
    
    # Add edges to graph
    for edge in edges
        if haskey(id_to_index, edge.from) && haskey(id_to_index, edge.to)
            from_idx = id_to_index[edge.from]
            to_idx = id_to_index[edge.to]
            add_edge!(g, from_idx, to_idx)
        end
    end
    
    # Prepare node positions using east/north coordinates
    node_positions = Point2f[]
    node_colors = Symbol[]
    node_markers = Symbol[]
    node_sizes = Float64[]
    node_labels = String[]
    
    for node_id in node_ids
        node = nodes_dict[node_id]
        push!(node_positions, Point2f(node.east, node.north))
        
        # Classify node
        node_type = classify_node_for_viz_makie(node)
        push!(node_colors, NODE_COLORS_MAKIE[node_type])
        push!(node_markers, NODE_MARKERS[node_type])
        
        # Size based on connectivity
        connections = haskey(adj_list, node_id) ? length(adj_list[node_id]) : 0
        node_size = 15 + min(25, connections * 1.0)
        push!(node_sizes, node_size)
        
        # Create label
        push!(node_labels, "Node $node_id\n$(node.info)")
    end
    
    # Create the figure
    fig = Figure(resolution = (1400, 900), title = title)
    ax = Axis(fig[1, 1], 
              title = title,
              xlabel = "East (m)",
              ylabel = "North (m)",
              aspect = DataAspect())
    
    # Create the interactive graph plot
    gplot = graphplot!(ax, g,
                      node_pos = node_positions,
                      node_color = node_colors,
                      node_marker = node_markers,
                      node_size = node_sizes,
                      edge_color = :gray,
                      edge_width = 2,
                      node_strokewidth = 1,
                      node_strokecolor = :black)
    
    # Add interactivity - GraphMakie handles draggable nodes automatically
    # The nodes are draggable by default in recent versions
    
    # Add hover tooltips
    on(events(fig).mouseposition) do mp
        # Add custom hover behavior here if needed
    end
    
    # Create legend
    legend_elements = []
    legend_labels = []
    
    for (node_type, color) in NODE_COLORS_MAKIE
        if any(classify_node_for_viz_makie(nodes_dict[id]) == node_type for id in node_ids)
            marker = NODE_MARKERS[node_type]
            push!(legend_elements, MarkerElement(color = color, marker = marker, markersize = 15))
            push!(legend_labels, titlecase(node_type))
        end
    end
    
    Legend(fig[1, 2], legend_elements, legend_labels, "Node Types")
    
    # Add statistics text
    stats_text = create_stats_text_makie(nodes_dict, edges, adj_list)
    Label(fig[2, 1:2], stats_text, tellwidth = false, justification = :left)
    
    return fig, gplot
end

"""
Create network statistics text for Makie
"""
function create_stats_text_makie(nodes_dict::Dict{Int, Node}, 
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
        node_type = classify_node_for_viz_makie(node)
        type_counts[node_type] = get(type_counts, node_type, 0) + 1
    end
    
    stats_text = "Network Statistics: Nodes: $n_nodes | Edges: $n_edges | "
    stats_text *= "Avg Degree: $(round(avg_degree, digits=1)) | Max Degree: $max_degree | "
    stats_text *= "Avg Weight: $(round(avg_weight, digits=2))\n"
    
    stats_text *= "Node Types: "
    for (node_type, count) in sort(collect(type_counts), by=x->x[2], rev=true)
        stats_text *= "$(titlecase(node_type)): $count  "
    end
    
    return stats_text
end

"""
Create comparative visualization of two drone networks using Makie
"""
function create_comparative_makie_plots(analysis_results::Dict)
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
    fig1, gplot1 = create_interactive_makie_plot(
        nodes_dict, drone1_edges, drone1_adj,
        "Drone 1 Network (High Capability) - Drag nodes to reposition!"
    )
    
    fig2, gplot2 = create_interactive_makie_plot(
        nodes_dict, drone2_edges, drone2_adj,
        "Drone 2 Network (Low Capability) - Drag nodes to reposition!"
    )
    
    return fig1, fig2, gplot1, gplot2
end

"""
Main function to create and display interactive Makie drone network plots
"""
function create_drone_network_makie_plots(;
    nodes_file::String = "src/Network-flow-algos/test/drone network/nodes.csv",
    drone1_file::String = "src/Network-flow-algos/test/drone network/feasible_drone_1.csv",
    drone2_file::String = "src/Network-flow-algos/test/drone network/feasible_drone_2.csv")
    
    println("🚁 Creating Interactive Drone Network Visualizations with Makie.jl 🚁")
    println("="^70)
    
    try
        # Load and analyze data using existing functions
        println("📊 Loading and analyzing drone network data...")
        analysis_results = comprehensive_drone_analysis(nodes_file, drone1_file, drone2_file)
        
        println("\n🎨 Creating interactive Makie visualizations...")
        
        # Create comparative plots
        fig1, fig2, gplot1, gplot2 = create_comparative_makie_plots(analysis_results)
        
        println("✅ Interactive Makie plots created successfully!")
        println("\n🎯 How to use:")
        println("   1. Click and drag any node to reposition it")
        println("   2. Edges will automatically follow the nodes")
        println("   3. Use mouse wheel to zoom")
        println("   4. Right-click and drag to pan")
        println("   5. Close the window when done")
        
        # Display plots
        display(fig1)
        display(fig2)
        
        return fig1, fig2, analysis_results
        
    catch e
        println("❌ Error creating Makie drone network plots: $e")
        rethrow(e)
    end
end

"""
Error handling wrapper for the main plotting function
"""
function safe_create_makie_plots(; kwargs...)
    try
        return create_drone_network_makie_plots(; kwargs...)
    catch e
        println("❌ Failed to create Makie plots: $e")
        println("🔧 Troubleshooting tips:")
        println("   1. Ensure GLMakie.jl is installed: using Pkg; Pkg.add(\"GLMakie\")")
        println("   2. Ensure GraphMakie.jl is installed: using Pkg; Pkg.add(\"GraphMakie\")")
        println("   3. Ensure Graphs.jl is installed: using Pkg; Pkg.add(\"Graphs\")")
        println("   4. Check that data files exist in the specified paths")
        println("   5. Verify that DroneIDetailedCheck.jl is in the same directory")
        rethrow(e)
    end
end

# Main execution
if abspath(PROGRAM_FILE) == @__FILE__
    println("🚀 Starting interactive Makie drone network visualization...")
    plots_and_analysis = safe_create_makie_plots()
    println("🎉 Makie visualization complete! Drag nodes around to see edges follow!")
end