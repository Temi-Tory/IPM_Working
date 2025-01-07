module GenerateGraphModule
    using Random, Graphs, GraphViz, StatsBase, Distributions, DelimitedFiles

    export InfraProperties, generate_infra_dag, analyze_ranked_dag

    struct InfraProperties
        min_nodes::Int          
        max_nodes::Int          
        min_ranks::Int          
        max_ranks::Int          
        source_ratio::Float64   
        sink_ratio::Float64     
        edge_density::Float64   
        skip_distance::Int      
        fork_prob::Float64      
        join_prob::Float64      
        redundancy::Float64     
        min_skip::Int
        max_skip::Int
        skip_prob::Float64
        min_branches::Int
        max_branches::Int
        fork_density::Float64
        join_density::Float64
        redundancy_min::Int    # Min redundant edges per node
        redundancy_max::Int    # Max redundant edges
        function InfraProperties(
            min_nodes, max_nodes, min_ranks, max_ranks,
            source_ratio, sink_ratio, edge_density, skip_distance,
            fork_prob, join_prob, redundancy;
            min_skip=1, max_skip=3, skip_prob=0.3,
            min_branches=2, max_branches=4,
            fork_density=0.3, join_density=0.3,
            redundancy_min=1, redundancy_max=3
        )
            new(min_nodes, max_nodes, min_ranks, max_ranks,
                source_ratio, sink_ratio, edge_density, skip_distance,
                fork_prob, join_prob, redundancy,
                min_skip, max_skip, skip_prob,
                min_branches, max_branches, fork_density, join_density,
                redundancy_min, redundancy_max)
        end
    end

    function generate_infra_dag(props::InfraProperties; save_csv::Bool=false, output_dir::String="")
        # Generate the graph
        g = SimpleDiGraph(rand(props.min_nodes:props.max_nodes))
        rank_labels = assign_infra_ranks(nv(g), rand(props.min_ranks:props.max_ranks), props)
        nodes_per_rank = group_by_rank(rank_labels)
        
        # Create the graph structure
        create_critical_paths!(g, nodes_per_rank, props)
        add_redundant_paths!(g, nodes_per_rank, props)
        add_infrastructure_patterns!(g, nodes_per_rank, props)
        ensure_connectivity!(g, nodes_per_rank)
    
        if save_csv && !isempty(output_dir)
            # Create the directory path if it doesn't exist
            mkpath(output_dir)
            
            # Generate matrix and filename
            adj_matrix = Matrix(adjacency_matrix(g))
            filename = "Generated_DAG_Vert$(nv(g))xEdge$(ne(g)).csv"
            filepath = joinpath(output_dir, filename)
            
            # Save the matrix
            writedlm(filepath, adj_matrix, ',')
            println("Saved DAG to: $filepath")
        end
        
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

    function add_redundant_paths!(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}}, props::InfraProperties)
        num_ranks = length(nodes_per_rank)
        current_density = ne(g) / (nv(g) * (nv(g) - 1) / 2)
        
        for rank in 1:(num_ranks-1)
            # Only add redundant paths if below target density
            if current_density < props.edge_density
                for node in nodes_per_rank[rank]
                    num_edges = rand(props.redundancy_min:props.redundancy_max)
                    for _ in 1:num_edges
                        skip = rand(1:min(props.skip_distance, num_ranks-rank))
                        if rank + skip <= num_ranks
                            target = rand(nodes_per_rank[rank+skip])
                            add_edge!(g, node, target)
                        end
                    end
                end
                current_density = ne(g) / (nv(g) * (nv(g) - 1) / 2)
            end
        end
    end

    function create_critical_paths!(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}}, props::InfraProperties)
        num_ranks = length(nodes_per_rank)
        num_paths = max(3, ceil(Int, sqrt(nv(g)) / 2))
        
        for _ in 1:num_paths
            current = rand(nodes_per_rank[1])
            current_rank = 1
            
            while current_rank < num_ranks
                if rand() < props.skip_prob
                    skip = rand(props.min_skip:props.max_skip)
                    next_rank = min(current_rank + skip, num_ranks)
                else
                    next_rank = current_rank + 1
                end
                next = rand(nodes_per_rank[next_rank])
                add_edge!(g, current, next)
                current = next
                current_rank = next_rank
            end
        end
    end
    
    function add_infrastructure_patterns!(g::SimpleDiGraph, nodes_per_rank::Vector{Vector{Int}}, props::InfraProperties)
        num_ranks = length(nodes_per_rank)
        
        for rank in 1:(num_ranks-2)
            if rand() < props.fork_density
                source = rand(nodes_per_rank[rank])
                num_branches = rand(props.min_branches:props.max_branches)
                targets = sample(nodes_per_rank[rank+1], min(num_branches, length(nodes_per_rank[rank+1])))
                for target in targets
                    add_edge!(g, source, target)
                end
            end
            
            if rand() < props.join_density
                target = rand(nodes_per_rank[rank+2])
                num_sources = rand(props.min_branches:props.max_branches)
                sources = sample(nodes_per_rank[rank+1], min(num_sources, length(nodes_per_rank[rank+1])))
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
            sorted_indices = sortperm(path_lengths)  # Changed from shortest to sortperm
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
end