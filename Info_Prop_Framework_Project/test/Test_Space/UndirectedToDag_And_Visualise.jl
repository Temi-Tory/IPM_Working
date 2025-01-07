module UndirectedToDagModule
    using DelimitedFiles, Graphs, GraphViz, DataStructures, Statistics

    export undirected_to_dag, analyze_ranked_dag, process_graph_from_csv

    function undirected_to_dag(adj_matrix)
        n = size(adj_matrix, 1)
        dag = zeros(Int, n, n)
        orig_edges = sum([adj_matrix[i,j] for i in 1:n for j in i+1:n if adj_matrix[i,j] == 1 || adj_matrix[j,i] == 1])
        
        for i in 1:n, j in i+1:n
            if adj_matrix[i,j] == 1 || adj_matrix[j,i] == 1
                dag[i,j] = 1
            end
        end
        
        return dag, orig_edges
    end

    function process_graph_from_csv(input_path::String; output_dir::String="")
        matrix = readdlm(input_path, ',', Int)
        dag_matrix, orig_edges = undirected_to_dag(matrix)
        
        if !isempty(output_dir)
            mkpath(output_dir)
            writedlm(joinpath(output_dir, "converted_dag.csv"), dag_matrix, ',')
        end
        
        return SimpleDiGraph(dag_matrix), matrix, orig_edges, sum(dag_matrix)
    end

    function analyze_ranked_dag(g::SimpleDiGraph, orig_matrix)
        println("Ranked DAG Analysis:")
        println("Total vertices: ", nv(g))
        println("Total edges: ", ne(g))
        
        println("Original edges: $orig_edges")
        println("DAG edges: $dag_edges")
        println("Edge retention: $retention%")
    
        # Original undirected leaf analysis
        n = size(orig_matrix, 1)
        undirected_leaves = [sum(orig_matrix[i,:]) == 1 for i in 1:n]
        num_undirected_leaves = sum(undirected_leaves)
        
        # Directed graph analysis
        sources = sort([v for v in vertices(g) if isempty(inneighbors(g, v))])
        sinks = sort([v for v in vertices(g) if isempty(outneighbors(g, v))])
        
        println("\nLeaf Node Analysis:")
        println("Undirected leaves: $num_undirected_leaves")
        println("DAG sources: $(length(sources))")
        println("DAG sinks: $(length(sinks))")
        println("Source/sink ratio: $(round(length(sources)/length(sinks), digits=2))")
        println("Directed/undirected leaf ratio: $(round((length(sources) + length(sinks))/num_undirected_leaves, digits=2))")
    
        println("\nValidation:")
        has_cycles = false
        try
            topological_sort_by_dfs(g)
        catch e
            has_cycles = true
        end
        println("Is valid DAG: ", !has_cycles)
        
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
    
        println("\nPath Analysis:")
        println("Source nodes: $sources")
        println("Sink nodes: $sinks")
        
        paths = Vector{Vector{Int}}()
        path_lengths = Vector{Int}()
        
        for source in sources
            for sink in sinks
                path = enumerate_paths(dijkstra_shortest_paths(g, source), sink)
                if !isempty(path)
                    push!(paths, path)
                    push!(path_lengths, length(path))
                end
            end
        end
    end
end





#= matrix = readdlm("csvfiles/metro_undirected.csv", ',', Int)
dag_matrix, orig_edges = undirected_to_dag(matrix)
dag_edges = sum(dag_matrix)
retention = round(dag_edges/orig_edges * 100, digits=2)

writedlm("csvfiles/metro_dag_converted.csv", dag_matrix, ',')


g = SimpleDiGraph(dag_matrix)
analyze_ranked_dag(g, matrix)
dot_str = visualize_dag(g)
graph = GraphViz.load(IOBuffer(dot_str)) =#


metro_undirected_matrix = readdlm("csvfiles/metro_undirected.csv", ',', Int)
metro_undirected = SimpleGraph(metro_dag_with_probs_matrix)
metro_undirected_dot_str = visualize_dag(metro_dag_with_probs)
metro_undirected_graph = GraphViz.load(IOBuffer(dot_str))

metro_dag_matrix = readdlm("csvfiles/metro_dag_fromundirected.csv", ',', Int)
metro_dag = SimpleGraph(metro_dag_with_probs_matrix)
metro_dag_dot_str = visualize_dag(metro_dag_with_probs)
metro_dag_graph = GraphViz.load(IOBuffer(dot_str))