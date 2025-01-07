module VisualizeGraphsModule
    using Graphs, GraphViz

    export generate_graph_dot_string, visualize_graph, visualize_dag
    
    function generate_graph_dot_string(g::SimpleDiGraph)
        dot = """
        digraph {
            rankdir=TB;
            node [style=filled, shape=circle, width=0.15, height=0.15, fixedsize=true, fillcolor="#1f77b4", fontcolor=white];
            graph [nodesep=0.2, ranksep=0.3, splines=line];
        """
        
        # Add nodes with just numbers
        for v in vertices(g)
            dot *= "    \"$v\" [label=\"$v\", fontsize=6]\n"
        end
        
        # Add edges with thinner arrows
        for e in edges(g)
            dot *= "    \"$(src(e))\" -> \"$(dst(e))\" [color=\"#000000\", penwidth=0.1, arrowsize=0.3];\n"
        end
        
        dot *= "}"
        return dot
    end
    function generate_graph_dot_string(g::SimpleGraph)
        dot = """
        graph {
            node [style=filled, shape=circle, width=0.15, height=0.15, fixedsize=true, fillcolor="#1f77b4", fontcolor=white];
            graph [nodesep=0.2, ranksep=0.3, splines=line];
        """
        
        # Add nodes with just numbers
        for v in vertices(g)
            dot *= "    \"$v\" [label=\"$v\", fontsize=6]\n"
        end
        
        # Add edges with thinner lines
        for e in edges(g)
            dot *= "    \"$(src(e))\" -- \"$(dst(e))\" [color=\"#000000\", penwidth=0.1];\n"
        end
        
        dot *= "}"
        return dot
    end      
    function generate_graph_dot_string(g::SimpleDiGraph, rank_labels::Dict{Int,Int})
        # Color scheme for ranks
        colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"]
        
        dot = """
        digraph {
            rankdir=TB;
            node [style=filled, shape=circle, width=0.15, height=0.15, fixedsize=true];  # Halved node size
            graph [nodesep=0.2, ranksep=0.3, splines=line];  # Tighter spacing, straight lines
        """
        
        # Group nodes by rank
        max_rank = maximum(values(rank_labels))
        for rank in 1:max_rank
            dot *= "    { rank=same; "
            nodes_in_rank = sort([v for (v, r) in rank_labels if r == rank])
            
            # Add nodes with just the number label
            color = colors[mod1(rank, length(colors))]
            for node in nodes_in_rank
                dot *= "\"$node\" [label=\"$node\", fillcolor=\"$color\", fontcolor=white, fontsize=6] "  # Smaller font
            end
            dot *= "}\n"
        end
        
        # Add edges with thinner arrows
        for e in edges(g)
            dot *= "    \"$(src(e))\" -> \"$(dst(e))\" [color=\"#000000\", penwidth=0.1, arrowsize=0.3];\n"
        end
        
        dot *= "}"
        return dot
    end

    function visualize_graph(g::SimpleDiGraph)
        # Generate DOT string
        dot_str = generate_graph_dot_string(g)
        
        # Return the DOT string for inspection
        return dot_str
    end
    function visualize_graph(g::SimpleGraph)
        # Generate DOT string
        dot_str = generate_graph_dot_string(g)
        
        # Return the DOT string for inspection
        return dot_str
    end
    function visualize_graph(g::SimpleDiGraph, rank_labels::Dict{Int,Int})
        # Generate DOT string
        dot_str = generate_graph_dot_string(g, rank_labels)
     #=    
        # Create temporary DOT file
        dot_file = "$filename.dot"
        open(dot_file, "w") do f
            write(f, dot_str)
        end
        
        # Use GraphViz command line tools to generate the output
        try
            run(`dot -Tpdf $dot_file -o $filename.pdf`)
            run(`dot -Tpng $dot_file -o $filename.png`)
            println("Saved visualizations as '$filename.pdf' and '$filename.png'")
        catch e
            println("Error generating visualization: ", e)
            println("Make sure GraphViz command line tools are installed.")
        finally
            rm(dot_file)
        end
         =#
        # Return the DOT string for inspection
        return dot_str
    end
end
