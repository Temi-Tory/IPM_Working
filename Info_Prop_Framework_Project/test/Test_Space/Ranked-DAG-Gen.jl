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

 #=  The code uses a Layer-by-Layer (RND) approach as evidenced by:

Nodes are generated rank-by-rank (for rank in 1:num_ranks)
Edges are primarily created between adjacent ranks
Limited skip connections are allowed but heavily controlled
Multiple guaranteed sequential paths between consecutive ranks
Edge creation focuses on local rank-to-rank connections
 =#
 #=  The code uses a Layer-by-Layer (RND) approach as evidenced by:

Nodes are generated rank-by-rank (for rank in 1:num_ranks)
Edges are primarily created between adjacent ranks
Limited skip connections are allowed but heavily controlled
Multiple guaranteed sequential paths between consecutive ranks
Edge creation focuses on local rank-to-rank connections
 =#

  using Graphs
  using GraphViz
  using Random
  
  function generate_ranked_dag(
    min_per_rank::Int=20,    # Keep same size
    max_per_rank::Int=25,
    min_ranks::Int=15,
    max_ranks::Int=20,
    edge_probability::Int=15  # Keep low to avoid shortcuts
    )
      # Input validation
      if min_per_rank > max_per_rank || min_ranks > max_ranks
          throw(ArgumentError("Min values must be less than or equal to max values"))
      end
      if edge_probability < 0 || edge_probability > 100
          throw(ArgumentError("Edge probability must be between 0 and 100"))
      end
  
      g = SimpleDiGraph()
    nodes_per_rank = Vector{Vector{Int}}()  
    rank_labels = Dict{Int, Int}()          
  using Graphs
  using GraphViz
  using Random
  
  function generate_ranked_dag(
    min_per_rank::Int=20,    # Keep same size
    max_per_rank::Int=25,
    min_ranks::Int=15,
    max_ranks::Int=20,
    edge_probability::Int=15  # Keep low to avoid shortcuts
    )
      # Input validation
      if min_per_rank > max_per_rank || min_ranks > max_ranks
          throw(ArgumentError("Min values must be less than or equal to max values"))
      end
      if edge_probability < 0 || edge_probability > 100
          throw(ArgumentError("Edge probability must be between 0 and 100"))
      end
  
      g = SimpleDiGraph()
    nodes_per_rank = Vector{Vector{Int}}()  
    rank_labels = Dict{Int, Int}()          
    current_node = 1

    # Node generation same as before
    # Node generation same as before
    num_ranks = rand(min_ranks:max_ranks)
    for rank in 1:num_ranks
        new_nodes = rand(min_per_rank:max_per_rank)
        rank_nodes = Int[]

        for _ in 1:new_nodes
            add_vertex!(g)
            push!(rank_nodes, current_node)
            rank_labels[current_node] = rank
            current_node += 1
        end

        push!(nodes_per_rank, rank_nodes)

        # Modified edge creation logic
        # Modified edge creation logic
        if rank > 1
            prev_nodes = nodes_per_rank[rank-1]
            
            # Create multiple guaranteed sequential paths
            num_paths = min(5, length(prev_nodes) ÷ 4)  # Increased from 3 to 5 paths
            path_starts = shuffle(prev_nodes)[1:num_paths]
            path_ends = shuffle(rank_nodes)[1:num_paths]
            for i in 1:num_paths
                add_edge!(g, path_starts[i], path_ends[i])
            end
            
            # Connect to previous rank with controlled probability
            for current_node in rank_nodes
                edges_added = 0
                min_edges = max(2, length(prev_nodes) ÷ 5)  # Ensure minimum connections
                
                for prev_node in shuffle(prev_nodes)
                    # Higher probability for nodes with few outgoing edges
                    local_prob = edge_probability ÷ (1 + length(outneighbors(g, prev_node)))
                    if edges_added < min_edges || rand(1:100) <= local_prob
                        add_edge!(g, prev_node, current_node)
                        edges_added += 1
                    end
                end
            end

            # Very limited skip connections only for nodes with few edges
            if rank > 2
                skip_back = 2  # Only look 2 ranks back
                far_nodes = nodes_per_rank[rank-skip_back]
                skip_prob = edge_probability ÷ 8  # Very low probability
                
                for current_node in rank_nodes
                    if length(inneighbors(g, current_node)) < 3
                        shuffled_far = shuffle(far_nodes)[1:min(2, length(far_nodes))]
                        for far_node in shuffled_far
                            if rand(1:100) <= skip_prob
                                add_edge!(g, far_node, current_node)
                            end
            prev_nodes = nodes_per_rank[rank-1]
            
            # Create multiple guaranteed sequential paths
            num_paths = min(5, length(prev_nodes) ÷ 4)  # Increased from 3 to 5 paths
            path_starts = shuffle(prev_nodes)[1:num_paths]
            path_ends = shuffle(rank_nodes)[1:num_paths]
            for i in 1:num_paths
                add_edge!(g, path_starts[i], path_ends[i])
            end
            
            # Connect to previous rank with controlled probability
            for current_node in rank_nodes
                edges_added = 0
                min_edges = max(2, length(prev_nodes) ÷ 5)  # Ensure minimum connections
                
                for prev_node in shuffle(prev_nodes)
                    # Higher probability for nodes with few outgoing edges
                    local_prob = edge_probability ÷ (1 + length(outneighbors(g, prev_node)))
                    if edges_added < min_edges || rand(1:100) <= local_prob
                        add_edge!(g, prev_node, current_node)
                        edges_added += 1
                    end
                end
            end

            # Very limited skip connections only for nodes with few edges
            if rank > 2
                skip_back = 2  # Only look 2 ranks back
                far_nodes = nodes_per_rank[rank-skip_back]
                skip_prob = edge_probability ÷ 8  # Very low probability
                
                for current_node in rank_nodes
                    if length(inneighbors(g, current_node)) < 3
                        shuffled_far = shuffle(far_nodes)[1:min(2, length(far_nodes))]
                        for far_node in shuffled_far
                            if rand(1:100) <= skip_prob
                                add_edge!(g, far_node, current_node)
                            end
                        end
                    end
                end
            end
        end
    end

    # Ensure connectivity but prefer closer ranks
    # Ensure connectivity but prefer closer ranks
    for rank in 2:num_ranks
        current_nodes = nodes_per_rank[rank]
        
        for node in current_nodes
            if isempty(inneighbors(g, node))
                # Try to connect to immediate previous rank first
                prev_nodes = nodes_per_rank[rank-1]
                # Try to connect to immediate previous rank first
                prev_nodes = nodes_per_rank[rank-1]
                prev_node = rand(prev_nodes)
                add_edge!(g, prev_node, node)
            end
        end
    end

    return g, rank_labels, nodes_per_rank
end
using StatsBase: sample
using StatsBase: sample

function add_nfj_patterns!(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}}, rank_labels::Dict{Int,Int})
    num_ranks = length(nodes_per_rank)
    
    # Add fork-join patterns between ranks
    for rank in 1:(num_ranks-2)
        # Select fork points
        fork_points = sample(nodes_per_rank[rank], min(3, length(nodes_per_rank[rank])), replace=false)
        
        for fork_point in fork_points
            # Create parallel paths
            mid_nodes = sample(nodes_per_rank[rank+1], min(4, length(nodes_per_rank[rank+1])), replace=false)
            join_nodes = sample(nodes_per_rank[rank+2], min(2, length(nodes_per_rank[rank+2])), replace=false)
            
            # Add fork edges
            for mid_node in mid_nodes
                add_edge!(g, fork_point, mid_node)
            end
            
            # Add join edges
            for mid_node in mid_nodes
                for join_node in join_nodes
                    add_edge!(g, mid_node, join_node)
                end
            end
        end
    end
    return g
end

function generate_hybrid_dag(min_per_rank::Int=20, max_per_rank::Int=25, 
                           min_ranks::Int=15, max_ranks::Int=20,
                           edge_probability::Int=15)
    g, rank_labels, nodes_per_rank = generate_ranked_dag(
        min_per_rank, max_per_rank, min_ranks, max_ranks, edge_probability
    )
    add_nfj_patterns!(g, nodes_per_rank, rank_labels)
    return g, rank_labels, nodes_per_rank
end

function generate_hybrid_components()
    # Generate base components
    g1, labels1, ranks1 = generate_rnd_legacy(300, 0.2, 6)  # Increased density and skip distance
    g2, labels2, ranks2 = generate_ranked_dag(20, 25, 15, 20, 25)  # Higher edge probability
    
    # Ensure rank alignment
    max_rank1 = maximum(values(labels1))
    max_rank2 = maximum(values(labels2))
    scale_factor = max_rank1 / max_rank2
    
    # Adjust g2 ranks to align with g1
    for (k,v) in labels2
        labels2[k] = ceil(Int, v * scale_factor)
    end
    
    return g1, labels1, g2, labels2
end

function generate_diverse_paths(nodes_per_rank, nv_g1)
    max_rank = length(nodes_per_rank)
    paths = Vector{Vector{Int}}()
    
    for _ in 1:5  # Generate 5 diverse paths
        path = Int[]
        current_rank = 1
        used_ranks = Set{Int}()
        
        while current_rank < max_rank
            current_nodes = nodes_per_rank[current_rank]
            g1_nodes = filter(n -> n ≤ nv_g1, current_nodes)
            
            if !isempty(g1_nodes)
                candidates = setdiff(g1_nodes, path)
                if !isempty(candidates)
                    push!(path, rand(candidates))
                    push!(used_ranks, current_rank)
                    # Jump 2-4 ranks ahead
                    current_rank += rand(2:4)
                else
                    current_rank += 1
                end
            else
                current_rank += 1
            end
        end
        
        push!(paths, path)
    end
    
    return paths
end

function merge_components(g1, labels1, g2, labels2)
    g = SimpleDiGraph(nv(g1) + nv(g2))
    rank_labels = Dict{Int,Int}()
    
    # Copy base structure
    for e in edges(g1)
        add_edge!(g, src(e), dst(e))
    end
    for e in edges(g2)
        add_edge!(g, src(e) + nv(g1), dst(e) + nv(g1))
    end
    merge!(rank_labels, labels1)
    for (k,v) in labels2
        rank_labels[k + nv(g1)] = v
    end
    
    # Group by ranks
    max_rank = maximum(values(rank_labels))
    nodes_per_rank = [Int[] for _ in 1:max_rank]
    for (node, rank) in rank_labels
        push!(nodes_per_rank[rank], node)
    end
    
    # Generate and add diverse paths
    paths = generate_diverse_paths(nodes_per_rank, nv(g1))
    for path in paths
        for i in 1:(length(path)-1)
            add_edge!(g, path[i], path[i+1])
        end
    end
    
    # Add cross-rank connections
    for rank in 1:max_rank-1
        g1_nodes = filter(n -> n ≤ nv(g1), nodes_per_rank[rank])
        for src in g1_nodes
            for skip in 1:3
                if rank + skip ≤ max_rank
                    dst_nodes = filter(n -> n > nv(g1), nodes_per_rank[rank+skip])
                    if !isempty(dst_nodes) && rand() < 0.3/skip
                        add_edge!(g, src, rand(dst_nodes))
                    end
                end
            end
        end
    end
    
    return g, rank_labels, nodes_per_rank
end

function generate_full_hybrid_dag()
    # Generate and align components
    g1, labels1, g2, labels2 = generate_hybrid_components()
    
    # Merge with cross-connections
    g, labels, ranks = merge_components(g1, labels1, g2, labels2)
    
    # Add NFJ patterns after merging
    add_nfj_patterns!(g, ranks, labels)
    
    # Ensure long paths with additional skip connections
    for rank in 1:length(ranks)-3
        for src in ranks[rank]
            for dst_rank in (rank+2):(rank+3)
                if dst_rank ≤ length(ranks)
                    dst = rand(ranks[dst_rank])
                    if rand() < 0.15  # 15% chance for skip connection
                        add_edge!(g, src, dst)
                    end
                end
            end
        end
    end
    
    return g, labels, ranks
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
    # Find multiple longest paths
    paths = Vector{Vector{Int}}()
    path_lengths = Vector{Int}()
    
    for source in sources
        for sink in sinks
            path = enumerate_paths(dijkstra_shortest_paths(g, source), sink)
            if !isempty(path)  # Only add valid paths
                push!(paths, path)
                push!(path_lengths, length(path))
            if !isempty(path)  # Only add valid paths
                push!(paths, path)
                push!(path_lengths, length(path))
            end
        end
    end
    
    # Sort and get top 5 longest paths
    if !isempty(paths)
        sorted_indices = sortperm(path_lengths, rev=true)
        num_paths = min(5, length(paths))
        
        println("\nTop $num_paths Longest Paths:")
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
    # Sort and get top 5 longest paths
    if !isempty(paths)
        sorted_indices = sortperm(path_lengths, rev=true)
        num_paths = min(5, length(paths))
        
        println("\nTop $num_paths Longest Paths:")
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

  function analyze_fork_join_patterns(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}})
    patterns = []
    metrics = Dict(
        "total_forks" => 0,
        "total_joins" => 0,
        "avg_fork_width" => 0.0,
        "avg_join_width" => 0.0,
        "max_fork_width" => 0,
        "max_join_width" => 0
    )
    
    for rank in 1:(length(nodes_per_rank)-2)
        for node in nodes_per_rank[rank]
            out_nodes = outneighbors(g, node)
            if length(out_nodes) >= 3
                fork_width = length(out_nodes)
                metrics["total_forks"] += 1
                metrics["avg_fork_width"] += fork_width
                metrics["max_fork_width"] = max(metrics["max_fork_width"], fork_width)
                
                common_targets = Set{Int}()
                for out_node in out_nodes
                    next_nodes = outneighbors(g, out_node)
                    if isempty(common_targets)
                        common_targets = Set(next_nodes)
                    else
                        common_targets = intersect(common_targets, next_nodes)
                    end
                end
                
                for join_node in common_targets
                    join_width = length(filter(n -> has_edge(g, n, join_node), out_nodes))
                    if join_width >= 2
                        push!(patterns, (
                            fork_node = node,
                            fork_rank = rank,
                            mid_nodes = out_nodes,
                            join_node = join_node,
                            join_rank = rank_labels[join_node],
                            fork_width = fork_width,
                            join_width = join_width
                        ))
                        metrics["total_joins"] += 1
                        metrics["avg_join_width"] += join_width
                        metrics["max_join_width"] = max(metrics["max_join_width"], join_width)
                    end
                end
            end
        end
    end
    
    if metrics["total_forks"] > 0
        metrics["avg_fork_width"] /= metrics["total_forks"]
    end
    if metrics["total_joins"] > 0
        metrics["avg_join_width"] /= metrics["total_joins"]
    end
    
    println("\nFork-Join Analysis:")
    println("Total fork points: $(metrics["total_forks"])")
    println("Total join points: $(metrics["total_joins"])")
    println("Average fork width: $(round(metrics["avg_fork_width"], digits=2))")
    println("Average join width: $(round(metrics["avg_join_width"], digits=2))")
    println("Maximum fork width: $(metrics["max_fork_width"])")
    println("Maximum join width: $(metrics["max_join_width"])")
    
    if !isempty(patterns)
        println("\nSample Fork-Join Patterns:")
        num_to_show = min(5, length(patterns))
        for i in 1:num_to_show
            p = patterns[i]
            println("Pattern $i:")
            println("  Fork node $(p.fork_node) (R$(p.fork_rank)) → $(length(p.mid_nodes)) parallel paths →",
                    " Join node $(p.join_node) (R$(p.join_rank))")
        end
    end
    
    return metrics, patterns
  
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

  function analyze_fork_join_patterns(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}})
    patterns = []
    metrics = Dict(
        "total_forks" => 0,
        "total_joins" => 0,
        "avg_fork_width" => 0.0,
        "avg_join_width" => 0.0,
        "max_fork_width" => 0,
        "max_join_width" => 0
    )
    
    for rank in 1:(length(nodes_per_rank)-2)
        for node in nodes_per_rank[rank]
            out_nodes = outneighbors(g, node)
            if length(out_nodes) >= 3
                fork_width = length(out_nodes)
                metrics["total_forks"] += 1
                metrics["avg_fork_width"] += fork_width
                metrics["max_fork_width"] = max(metrics["max_fork_width"], fork_width)
                
                common_targets = Set{Int}()
                for out_node in out_nodes
                    next_nodes = outneighbors(g, out_node)
                    if isempty(common_targets)
                        common_targets = Set(next_nodes)
                    else
                        common_targets = intersect(common_targets, next_nodes)
                    end
                end
                
                for join_node in common_targets
                    join_width = length(filter(n -> has_edge(g, n, join_node), out_nodes))
                    if join_width >= 2
                        push!(patterns, (
                            fork_node = node,
                            fork_rank = rank,
                            mid_nodes = out_nodes,
                            join_node = join_node,
                            join_rank = rank_labels[join_node],
                            fork_width = fork_width,
                            join_width = join_width
                        ))
                        metrics["total_joins"] += 1
                        metrics["avg_join_width"] += join_width
                        metrics["max_join_width"] = max(metrics["max_join_width"], join_width)
                    end
                end
            end
        end
    end
    
    if metrics["total_forks"] > 0
        metrics["avg_fork_width"] /= metrics["total_forks"]
    end
    if metrics["total_joins"] > 0
        metrics["avg_join_width"] /= metrics["total_joins"]
    end
    
    println("\nFork-Join Analysis:")
    println("Total fork points: $(metrics["total_forks"])")
    println("Total join points: $(metrics["total_joins"])")
    println("Average fork width: $(round(metrics["avg_fork_width"], digits=2))")
    println("Average join width: $(round(metrics["avg_join_width"], digits=2))")
    println("Maximum fork width: $(metrics["max_fork_width"])")
    println("Maximum join width: $(metrics["max_join_width"])")
    
    if !isempty(patterns)
        println("\nSample Fork-Join Patterns:")
        num_to_show = min(5, length(patterns))
        for i in 1:num_to_show
            p = patterns[i]
            println("Pattern $i:")
            println("  Fork node $(p.fork_node) (R$(p.fork_rank)) → $(length(p.mid_nodes)) parallel paths →",
                    " Join node $(p.join_node) (R$(p.join_rank))")
        end
    end
    
    return metrics, patterns
end

# Example usage:


# Generate a DAG
#= 
g, rank_labels, nodes_per_rank = generate_ranked_dag(20, 25, 15, 20, 15)
analyze_ranked_dag(g, rank_labels, nodes_per_rank)
dot_str = visualize_dag(g, rank_labels, "complex_dag")
graph = GraphViz.load(IOBuffer(dot_str))


g, rank_labels, nodes_per_rank = generate_hybrid_dag(20, 25, 15, 20, 15)
analyze_ranked_dag(g, rank_labels, nodes_per_rank)
metrics, patterns = analyze_fork_join_patterns(g, nodes_per_rank)
dot_str = visualize_dag(g, rank_labels, "hybrid_dag")
graph = GraphViz.load(IOBuffer(dot_str))

 =#
g, labels, ranks = generate_full_hybrid_dag()
analyze_ranked_dag(g, labels, ranks)
dot_str = visualize_dag(g, labels, "full_hybrid")
graph = GraphViz.load(IOBuffer(dot_str))
