 """
    1. Calculate node metrics & importance scores
    2. Initial edge assignment based on importance
    - Direct edges from higher to lower importance nodes
    3. Cycle detection and removal
    - Uses DFS to find cycles
    - Removes cycles by reversing least important edges
    4. Validation and analysis
 """
module UndirectedToDagModule
    using Graphs, LinearAlgebra, Statistics, DataStructures, DelimitedFiles

    export improved_undirected_to_dag

    """
    Detects cycles in a directed graph using DFS.
    Returns (has_cycle, cycle_nodes) where cycle_nodes contains the nodes in a cycle if found.
    """
    function detect_cycle(adj_matrix::Matrix{Int})
        n = size(adj_matrix, 1)
        visited = falses(n)
        rec_stack = falses(n)
        cycle_nodes = Int[]
        
        function dfs_cycle(v::Int, parent::Int)
            visited[v] = true
            rec_stack[v] = true
            
            for u in 1:n
                if adj_matrix[v, u] == 1
                    if !visited[u]
                        if dfs_cycle(u, v)
                            if !isempty(cycle_nodes)
                                push!(cycle_nodes, v)
                            end
                            return true
                        end
                    elseif rec_stack[u]
                        # Cycle found
                        push!(cycle_nodes, u)
                        push!(cycle_nodes, v)
                        return true
                    end
                end
            end
            
            rec_stack[v] = false
            return false
        end
        
        for v in 1:n
            if !visited[v]
                if dfs_cycle(v, -1)
                    return true, reverse(cycle_nodes)
                end
            end
        end
        
        return false, Int[]
    end

    """
    Calculate node importance metrics for better edge direction decisions
    """
    function calculate_node_metrics(adj_matrix::Matrix{Int})
        n = size(adj_matrix, 1)
        
        # Degree centrality
        degrees = vec(sum(adj_matrix, dims=2))
        
        # Approximate eigenvector centrality (using power iteration)
        centrality = ones(n)
        for _ in 1:10  # Number of iterations
            centrality = adj_matrix * centrality
            centrality = centrality / norm(centrality)
        end
        
        # Clustering coefficients
        clustering = zeros(n)
        for i in 1:n
            neighbors = findall(x -> x == 1, adj_matrix[i, :])
            if length(neighbors) > 1
                possible_connections = binomial(length(neighbors), 2)
                actual_connections = 0
                for j in neighbors, k in neighbors
                    if j < k && adj_matrix[j, k] == 1
                        actual_connections += 1
                    end
                end
                clustering[i] = actual_connections / possible_connections
            end
        end
        
        return degrees, centrality, clustering
    end

    """
    Remove a cycle from the graph by reversing the edge with lowest importance score
    """
    function remove_cycle!(dag::Matrix{Int}, cycle_nodes::Vector{Int}, node_importance::Vector{Float64})
        min_importance = Inf
        edge_to_reverse = (0, 0)
        
        for i in 1:length(cycle_nodes)
            u = cycle_nodes[i]
            v = cycle_nodes[i % length(cycle_nodes) + 1]
            if dag[u, v] == 1
                importance = node_importance[u] + node_importance[v]
                if importance < min_importance
                    min_importance = importance
                    edge_to_reverse = (u, v)
                end
            end
        end
        
        if edge_to_reverse != (0, 0)
            u, v = edge_to_reverse
            dag[u, v] = 0
            dag[v, u] = 1
        end
    end

    """
    Convert an undirected graph to a DAG using multiple metrics for edge direction decisions
    """
    function improved_undirected_to_dag(adj_matrix::Matrix{Int})
        n = size(adj_matrix, 1)
        dag = zeros(Int, n, n)
        
        # Count original edges (excluding self-loops)
        orig_edges = sum(adj_matrix[i,j] for i in 1:n for j in i+1:n 
                        if (adj_matrix[i,j] == 1 || adj_matrix[j,i] == 1))
        
        # Calculate node metrics
        degrees, centrality, clustering = calculate_node_metrics(adj_matrix)
        
        # Combine metrics into importance score
        importance = zeros(n)
        for i in 1:n
            importance[i] = 0.5 * degrees[i] / maximum(degrees) +
                          0.3 * centrality[i] / maximum(centrality) +
                          0.2 * clustering[i]
        end
        
        # Initial edge assignment based on node importance
        for i in 1:n
            for j in i+1:n
                if adj_matrix[i,j] == 1 || adj_matrix[j,i] == 1
                    if importance[i] > importance[j]
                        dag[i,j] = 1
                    else
                        dag[j,i] = 1
                    end
                end
            end
        end
        
        # Detect and remove cycles
        cycle_count = 0
        max_iterations = n * orig_edges  # Prevent infinite loops
        
        while cycle_count < max_iterations
            has_cycle, cycle_nodes = detect_cycle(dag)
            if !has_cycle
                break
            end
            
            remove_cycle!(dag, cycle_nodes, importance)
            cycle_count += 1
        end
        
        if cycle_count == max_iterations
            @warn "Maximum cycle removal iterations reached. Graph may still contain cycles."
        end
        
        return dag, orig_edges, Dict(
            "degrees" => degrees,
            "centrality" => centrality,
            "clustering" => clustering,
            "importance" => importance,
            "cycles_removed" => cycle_count
        )
    end

    """
    Validate the resulting DAG
    """
    function validate_dag(dag::Matrix{Int})
        has_cycle, cycle_nodes = detect_cycle(dag)
        if has_cycle
            @warn "Validation failed: Graph contains cycles"
            return false, cycle_nodes
        end
        
        # Check for self-loops
        n = size(dag, 1)
        for i in 1:n
            if dag[i,i] == 1
                @warn "Validation failed: Graph contains self-loops"
                return false, [i]
            end
        end
        
        return true, Int[]
    end

    """
        Process a graph from CSV using the improved converter and generate three different output formats
    """
    function process_graph_from_csv(input_path::String; output_dir::String="")
        # Read the original matrix
        matrix = readdlm(input_path, ',', Int)
        
        # Use improved converter
        dag_matrix, orig_edges, metrics = improved_undirected_to_dag(matrix)
        
        # Create probability matrices
        n = size(dag_matrix, 1)
        
        # Format 1: Regular adjacency matrix (0s and 1s)
        reg_output = copy(dag_matrix)
        
        # Format 2: High probability matrix (0s and 0.95s)
        high_prob_matrix = zeros(Float64, n, n+1)
        # Set all node probabilities to 1.0 in first column
        high_prob_matrix[:,1] .= 1.0
        # Set edge probabilities to 0.95 where edges exist
        for i in 1:n, j in 1:n
            high_prob_matrix[i,j+1] = dag_matrix[i,j] == 1 ? 0.95 : 0.0
        end
        
        # Format 3: Low probability matrix (0s and 0.15s)
        low_prob_matrix = zeros(Float64, n, n+1)
        # Set all node probabilities to 1.0 in first column
        low_prob_matrix[:,1] .= 1.0
        # Set edge probabilities to 0.15 where edges exist
        for i in 1:n, j in 1:n
            low_prob_matrix[i,j+1] = dag_matrix[i,j] == 1 ? 0.15 : 0.0
        end
        
        if !isempty(output_dir)
            mkpath(output_dir)
            orig_filename = basename(input_path)
            base_name = replace(orig_filename, ".csv" => "")
            
            # Save regular adjacency matrix
            reg_output_path = joinpath(output_dir, "$(base_name)_ImprovedDAG.csv")
            writedlm(reg_output_path, reg_output, ',')
            println("Saved regular DAG to: $reg_output_path")
            
            # Save high probability matrix
            high_prob_path = joinpath(output_dir, "$(base_name)_ImprovedDAG_HighProb.csv")
            writedlm(high_prob_path, high_prob_matrix, ',')
            println("Saved high probability DAG to: $high_prob_path")
            
            # Save low probability matrix
            low_prob_path = joinpath(output_dir, "$(base_name)_ImprovedDAG_LowProb.csv")
            writedlm(low_prob_path, low_prob_matrix, ',')
            println("Saved low probability DAG to: $low_prob_path")
            
            # Save metrics as before
            metrics_filename = "$(base_name)_metrics.txt"
            metrics_path = joinpath(output_dir, metrics_filename)
            open(metrics_path, "w") do io
                println(io, "Conversion Metrics:")
                println(io, "Original edges: $orig_edges")
                println(io, "DAG edges: $(sum(dag_matrix))")
                println(io, "Cycles removed: $(metrics["cycles_removed"])")
                println(io, "\nNode Metrics:")
                for i in 1:length(metrics["importance"])
                    println(io, "Node $i:")
                    println(io, "  Degree: $(metrics["degrees"][i])")
                    println(io, "  Centrality: $(round(metrics["centrality"][i], digits=3))")
                    println(io, "  Clustering: $(round(metrics["clustering"][i], digits=3))")
                    println(io, "  Importance: $(round(metrics["importance"][i], digits=3))")
                end
            end
            println("Saved metrics to: $metrics_path")
        end
        
        return SimpleDiGraph(dag_matrix), matrix, orig_edges, sum(dag_matrix), metrics
    end

    """
        Enhanced analysis function that includes the new metrics
    """
    function analyze_generated_dag(g::SimpleDiGraph, orig_matrix, metrics::Dict)
        # Original analysis parts
        n = size(orig_matrix, 1)  # Get matrix dimensions
        orig_edges = sum(orig_matrix[i,j] for i in 1:n for j in i+1:n 
                        if orig_matrix[i,j] == 1 || orig_matrix[j,i] == 1)
        dag_edges = ne(g)
        retention = round(dag_edges/orig_edges * 100, digits=2)
    
        println("\n=== Improved DAG Analysis ===")
        println("\nBasic Statistics:")
        println("Total vertices: ", nv(g))
        println("Total edges: ", ne(g))
        println("Original edges: $orig_edges")
        println("DAG edges: $dag_edges")
        println("Edge retention: $retention%")
        println("Cycles removed during conversion: $(metrics["cycles_removed"])")
        
        # Node importance analysis
        println("\nNode Importance Analysis:")
        sorted_nodes = sortperm(metrics["importance"], rev=true)
        println("Top 5 most important nodes:")
        for i in 1:min(5, length(sorted_nodes))
            node = sorted_nodes[i]
            println("Node $node:")
            println("  Importance: $(round(metrics["importance"][node], digits=3))")
            println("  Degree: $(metrics["degrees"][node])")
            println("  Centrality: $(round(metrics["centrality"][node], digits=3))")
            println("  Clustering: $(round(metrics["clustering"][node], digits=3))")
        end
        
        # Leaf analysis
        undirected_leaves = [sum(orig_matrix[i,:]) == 1 for i in 1:n]
        num_undirected_leaves = sum(undirected_leaves)
        
        sources = sort([v for v in vertices(g) if isempty(inneighbors(g, v))])
        sinks = sort([v for v in vertices(g) if isempty(outneighbors(g, v))])
        
        println("\nLeaf Node Analysis:")
        println("Undirected leaves: $num_undirected_leaves")
        println("DAG sources: $(length(sources))")
        println("DAG sinks: $(length(sinks))")
        println("Source/sink ratio: $(round(length(sources)/length(sinks), digits=2))")
        println("Directed/undirected leaf ratio: $(round((length(sources) + length(sinks))/num_undirected_leaves, digits=2))")
        
        # Validation
        println("\nValidation:")
        has_cycles = false
        try
            topological_sort_by_dfs(g)
        catch e
            has_cycles = true
        end
        println("Is valid DAG: ", !has_cycles)
        
        # Component analysis
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
        
        # Path analysis
        println("\nPath Analysis:")
        println("Source nodes: $sources")
        println("Sink nodes: $sinks")
        
        return Dict(
            "orig_edges" => orig_edges,
            "dag_edges" => dag_edges,
            "retention" => retention,
            "sources" => sources,
            "sinks" => sinks,
            "components" => components,
            "has_cycles" => has_cycles,
            "metrics" => metrics
        )
    end
end