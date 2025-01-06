#=
# First, activate the project environment
using Pkg
Pkg.activate(".")

# Add the required packages
Pkg.add([
    "Graphs",
    "Random",
    "DataStructures",
    "Distributions",
    "StatsBase",
    "Statistics",
    "GraphViz"
])

# To ensure the packages persist, we should instantiate the project
Pkg.instantiate()
  =#



using Graphs
using GraphViz
using Random

function generate_ranked_dag(
    min_per_rank::Int=1,
    max_per_rank::Int=5,
    min_ranks::Int=3,
    max_ranks::Int=5,
    edge_probability::Int=30
)
    # Input validation
    if min_per_rank > max_per_rank || min_ranks > max_ranks
        throw(ArgumentError("Min values must be less than or equal to max values"))
    end
    if edge_probability < 0 || edge_probability > 100
        throw(ArgumentError("Edge probability must be between 0 and 100"))
    end

    g = SimpleDiGraph()
    nodes_per_rank = Vector{Vector{Int}}()  # Store nodes for each rank
    rank_labels = Dict{Int, Int}()          # Map node to rank
    current_node = 1

    # Determine number of ranks
    num_ranks = rand(min_ranks:max_ranks)

    # Generate nodes for each rank
    for rank in 1:num_ranks
        # Generate new nodes for this rank
        new_nodes = rand(min_per_rank:max_per_rank)
        rank_nodes = Int[]

        # Add vertices for this rank
        for _ in 1:new_nodes
            add_vertex!(g)
            push!(rank_nodes, current_node)
            rank_labels[current_node] = rank
            current_node += 1
        end

        push!(nodes_per_rank, rank_nodes)

        # Add edges from all previous ranks to this rank
        if rank > 1
            for prev_rank in 1:rank-1
                for prev_node in nodes_per_rank[prev_rank]
                    for current_node in rank_nodes
                        if rand(1:100) <= edge_probability
                            add_edge!(g, prev_node, current_node)
                        end
                    end
                end
            end
        end
    end

    # Ensure at least one incoming edge for each node (except first rank)
    for rank in 2:num_ranks
        current_nodes = nodes_per_rank[rank]
        prev_nodes = nodes_per_rank[rank-1]
        
        for node in current_nodes
            if isempty(inneighbors(g, node))
                # Connect to random node from previous rank
                prev_node = rand(prev_nodes)
                add_edge!(g, prev_node, node)
            end
        end
    end

    return g, rank_labels, nodes_per_rank
end

function to_dot_ranked(g::SimpleDiGraph, rank_labels::Dict{Int,Int})
    dot = "digraph {\n"
    dot *= "  rankdir=TB;\n"  # Top to bottom direction

    # Group nodes by rank
    max_rank = maximum(values(rank_labels))
    for rank in 1:max_rank
        dot *= "  { rank = same; "
        nodes_in_rank = sort([v for (v, r) in rank_labels if r == rank])
        for node in nodes_in_rank
            dot *= "\"$node\" "
        end
        dot *= "}\n"
    end

    # Add nodes with rank labels
    for v in vertices(g)
        dot *= "  \"$v\" [label=\"$v (R$(rank_labels[v]))\"];\n"
    end

    # Add edges
    for e in edges(g)
        dot *= "  \"$(src(e))\" -> \"$(dst(e))\";\n"
    end

    dot *= "}"
    return dot
end

function analyze_ranked_dag(g::SimpleDiGraph, rank_labels::Dict{Int,Int}, nodes_per_rank::Vector{Vector{Int}})
    println("Ranked DAG Analysis:")
    println("Total vertices: ", nv(g))
    println("Total edges: ", ne(g))
    
    # Validate basic DAG properties
    println("\nValidation:")
    
    # Check if it's a DAG (no cycles)
    has_cycles = false
    try
        topological_sort_by_dfs(g)
    catch e
        has_cycles = true
    end
    println("Is valid DAG: ", !has_cycles)
    
    # Check for fragmentation using weakly connected components
    components = weakly_connected_components(g)
    println("Number of components: ", length(components))
    if length(components) > 1
        println("WARNING: Graph is fragmented!")
        println("Fragments:")
        for (i, component) in enumerate(components)
            println("  Fragment $i: nodes $component")
        end
    else
        println("Graph is not fragmented (good)")
    end

    # Rank analysis
    println("\nRank Analysis:")
    for (rank, nodes) in enumerate(nodes_per_rank)
        println("Rank $rank: $(length(nodes)) nodes $nodes")
    end

    # Path analysis
    sources = sort([v for v in vertices(g) if isempty(inneighbors(g, v))])
    sinks = sort([v for v in vertices(g) if isempty(outneighbors(g, v))])
    
    println("\nPath Analysis:")
    println("Source nodes: $sources")
    println("Sink nodes: $sinks")
    
    # Find longest path
    max_length = 0
    longest_path = Int[]
    
    for source in sources
        for sink in sinks
            path = enumerate_paths(dijkstra_shortest_paths(g, source), sink)
            if length(path) > max_length
                max_length = length(path)
                longest_path = path
            end
        end
    end
    
    if !isempty(longest_path)
        println("\nLongest path:")
        println("Length: ", length(longest_path))
        println("Nodes: ", longest_path)
        println("Ranks: ", [rank_labels[n] for n in longest_path])
        
        println("\nPath transitions:")
        for i in 1:length(longest_path)-1
            from = longest_path[i]
            to = longest_path[i+1]
            println("  R$(rank_labels[from]): $from → R$(rank_labels[to]): $to")
        end
    else
        println("No paths found!")
    end
end

function generate_dot_string(g::SimpleDiGraph, rank_labels::Dict{Int,Int})
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
        dot *= "    \"$(src(e))\" -> \"$(dst(e))\" [color=\"#000000\", penwidth=0.1, arrowsize=0.3];\n"  # Thinner, more transparent arrows
    end
    
    dot *= "}"
    return dot
end

# Helper function to convert number to hex
hex(n::Integer, pad::Integer) = uppercase(string(n, base=16, pad=pad))

function visualize_dag(g::SimpleDiGraph, rank_labels::Dict{Int,Int}, filename::String)
    # Generate DOT string
    dot_str = generate_dot_string(g, rank_labels)
    
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
    
    # Return the DOT string for inspection
    return dot_str
end

# Example usage:


# Generate a DAG
g, rank_labels, nodes_per_rank = generate_ranked_dag(3, 8, 6, 10, 35)

# Create visualization
dot_str = visualize_dag(g, rank_labels, "complex_dag")


# View in Jupyter/Pluto
using GraphViz
GraphViz.load(IOBuffer(dot_str))