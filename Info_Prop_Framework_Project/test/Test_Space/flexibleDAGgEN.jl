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


using Random
using Graphs
using GraphViz
using StatsBase: sample
using Distributions: Poisson
# Core properties for infrastructure modeling
struct InfraProperties
    min_nodes::Int          # Minimum total nodes
    max_nodes::Int          # Maximum total nodes
    min_ranks::Int          # Minimum rank levels
    max_ranks::Int          # Maximum rank levels
    source_ratio::Float64   # Target ratio of source nodes (0-1)
    sink_ratio::Float64     # Target ratio of sink nodes (0-1)
    edge_density::Float64   # Base edge density (0-1)
    skip_distance::Int      # Maximum rank skip allowed
    fork_prob::Float64      # Probability of fork patterns
    join_prob::Float64      # Probability of join patterns
    redundancy::Float64     # Path redundancy factor (0-1)
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
    
    # Check for fragmentation
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
    
    # Find multiple longest paths
    paths = Vector{Vector{Int}}()
    path_lengths = Vector{Int}()
    
    for source in sources
        for sink in sinks
            path = enumerate_paths(dijkstra_shortest_paths(g, source), sink)
            if !isempty(path)  # Only add valid paths
                push!(paths, path)
                push!(path_lengths, length(path))
            end
        end
    end
    
    # Sort and get top 5 shortest paths
    if !isempty(paths)
        sorted_indices = shortest(path_lengths, rev=false)
        num_paths = min(5, length(paths))
        
        println("\nTop $num_paths shortest Paths:")
        for i in 1:num_paths
            path = paths[sorted_indices[i]]
            println("\nPath $i:")
            println("Length: ", length(path))
            println("Nodes: ", path)
            path_ranks = [rank_labels[n] for n in path]
            println("Ranks: ", path_ranks)
            
            println("Path transitions:")
            for j in 1:length(path)-1
                from = path[j]
                to = path[j+1]
                println("  R$(rank_labels[from]): $from → R$(rank_labels[to]): $to")
            end
            
            # Calculate rank coverage
            unique_ranks = length(unique(path_ranks))
            total_ranks = length(nodes_per_rank)
            println("Rank coverage: $unique_ranks/$total_ranks ($(round(100*unique_ranks/total_ranks, digits=1))%)")
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
          dot *= "    \"$(src(e))\" -> \"$(dst(e))\" [color=\"#000000\", penwidth=0.1, arrowsize=0.3];\n"
      end
      
      dot *= "}"
      return dot
  end
  
  function visualize_dag(g::SimpleDiGraph, rank_labels::Dict{Int,Int}, filename::String)
      # Generate DOT string
      dot_str = generate_dot_string(g, rank_labels)
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

# Generator for infrastructure DAGs
function generate_infra_dag(props::InfraProperties)
    # Initialize graph
    num_nodes = rand(props.min_nodes:props.max_nodes)
    num_ranks = rand(props.min_ranks:props.max_ranks)
    g = SimpleDiGraph(num_nodes)
    
    # Assign ranks with infrastructure patterns
    rank_labels = assign_infra_ranks(num_nodes, num_ranks, props)
    nodes_per_rank = group_by_rank(rank_labels)
    
    # Create core paths first
    create_critical_paths!(g, nodes_per_rank, props)
    
    # Add redundant paths
    add_redundant_paths!(g, nodes_per_rank, props)
    
    # Insert fork-join patterns
    add_infrastructure_patterns!(g, nodes_per_rank, props)
    
    # Ensure connectivity
    ensure_connectivity!(g, nodes_per_rank)
    
    return g, rank_labels, nodes_per_rank
end

function assign_infra_ranks(num_nodes::Int, num_ranks::Int, props::InfraProperties)
    rank_labels = Dict{Int,Int}()
    
    # Reserve nodes for sources and sinks
    num_sources = ceil(Int, num_nodes * props.source_ratio)
    num_sinks = ceil(Int, num_nodes * props.sink_ratio)
    
    # Assign sources to rank 1
    for node in 1:num_sources
        rank_labels[node] = 1
    end
    
    # Assign sinks to last rank
    for node in (num_nodes-num_sinks+1):num_nodes
        rank_labels[node] = num_ranks
    end
    
    # Distribute remaining nodes with infrastructure-like patterns
    remaining = collect((num_sources+1):(num_nodes-num_sinks))
    shuffle!(remaining)
    
    # More nodes in middle ranks for complex infrastructure
    weights = [1.0 + sin(π * i / num_ranks) for i in 2:(num_ranks-1)]
    weights = weights ./ sum(weights)
    
    node_idx = 1
    for rank in 2:(num_ranks-1)
        num_in_rank = ceil(Int, length(remaining) * weights[rank-1])
        for _ in 1:num_in_rank
            if node_idx <= length(remaining)
                rank_labels[remaining[node_idx]] = rank
                node_idx += 1
            end
        end
    end
    
    return rank_labels
end

function create_critical_paths!(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}}, props::InfraProperties)
    num_ranks = length(nodes_per_rank)
    
    # Create several end-to-end critical paths
    num_paths = max(3, ceil(Int, sqrt(nv(g)) / 2))
    
    for _ in 1:num_paths
        current = rand(nodes_per_rank[1])  # Start from a source
        current_rank = 1
        
        while current_rank < num_ranks
            next_rank = min(current_rank + rand(1:props.skip_distance), num_ranks)
            next = rand(nodes_per_rank[next_rank])
            add_edge!(g, current, next)
            current = next
            current_rank = next_rank
        end
    end
end

function add_redundant_paths!(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}}, props::InfraProperties)
    num_ranks = length(nodes_per_rank)
    
    for rank in 1:(num_ranks-1)
        for node in nodes_per_rank[rank]
            # Add redundant connections based on redundancy factor
            num_edges = rand(Poisson(props.redundancy * 2))
            
            for _ in 1:num_edges
                skip = rand(1:min(props.skip_distance, num_ranks-rank))
                if rank + skip <= num_ranks
                    target = rand(nodes_per_rank[rank+skip])
                    add_edge!(g, node, target)
                end
            end
        end
    end
end

function add_infrastructure_patterns!(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}}, props::InfraProperties)
    num_ranks = length(nodes_per_rank)
    
    for rank in 1:(num_ranks-2)
        # Add fork patterns
        if rand() < props.fork_prob
            source = rand(nodes_per_rank[rank])
            num_branches = rand(2:4)
            targets = sample(nodes_per_rank[rank+1], num_branches)
            for target in targets
                add_edge!(g, source, target)
            end
        end
        
        # Add join patterns
        if rand() < props.join_prob
            target = rand(nodes_per_rank[rank+2])
            num_sources = rand(2:4)
            sources = sample(nodes_per_rank[rank+1], num_sources)
            for source in sources
                if !has_edge(g, source, target)
                    add_edge!(g, source, target)
                end
            end
        end
    end
end

function ensure_connectivity!(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}})
    for rank in 2:length(nodes_per_rank)
        for node in nodes_per_rank[rank]
            if isempty(inneighbors(g, node))
                # Connect to random node from previous rank
                prev = rand(nodes_per_rank[rank-1])
                add_edge!(g, prev, node)
            end
        end
    end
    
    # Ensure all nodes have at least one path to a sink
    for rank in 1:(length(nodes_per_rank)-1)
        for node in nodes_per_rank[rank]
            if isempty(outneighbors(g, node))
                next = rand(nodes_per_rank[rank+1])
                add_edge!(g, node, next)
            end
        end
    end
end
# Utility functions for infrastructure DAG generation
function group_by_rank(rank_labels::Dict{Int,Int})
    max_rank = maximum(values(rank_labels))
    nodes_per_rank = [Int[] for _ in 1:max_rank]
    for (node, rank) in rank_labels
        push!(nodes_per_rank[rank], node)
    end
    return nodes_per_rank
end



# Example usage
props = InfraProperties(
    500,    # min_nodes
    600,    # max_nodes
    15,     # min_ranks
    20,     # max_ranks
    0.06,   # source_ratio
    0.06,   # sink_ratio
    0.15,   # edge_density
    6,      # skip_distance
    0.3,    # fork_prob
    0.3,    # join_prob
    0.4     # redundancy
)

g, labels, ranks = generate_infra_dag(props)
analyze_ranked_dag(g, labels, ranks)

dot_str = visualize_dag(g, labels, "full_hybrid")
graph = GraphViz.load(IOBuffer(dot_str))

using DelimitedFiles

# Get adjacency matrix
# Set target directory for output
output_dir = "Info_Prop_Framework_Project/test/GeneratedDatasets"
mkpath(output_dir)  # Create directory if it doesn't exist

# Save matrix
adj_matrix = Matrix(adjacency_matrix(g))
n_vert = nv(g)
n_edges = ne(g)
filepath = joinpath(output_dir, "graph_matrix_" * string(n_vert) * "x" * string(n_edges) * ".csv")
writedlm(filepath, adj_matrix, ',')