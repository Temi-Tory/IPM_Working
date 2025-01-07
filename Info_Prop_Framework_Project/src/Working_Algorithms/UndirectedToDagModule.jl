module UndirectedToDagModule
    using DelimitedFiles, Graphs, GraphViz, DataStructures, Statistics

    export undirected_to_dag, analyze_generated_dag, process_graph_from_csv

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
        # Read the original matrix
        matrix = readdlm(input_path, ',', Int)
        dag_matrix, orig_edges = undirected_to_dag(matrix)
        
        # Get the directory and filename of the input file
        input_dir = dirname(input_path)
        orig_filename = basename(input_path)
        
        # Create new filename by adding "ConvertedToDAG" before the extension
        new_filename = replace(orig_filename, ".csv" => "_ConvertedToDAG.csv")
        
        # Save in the same directory as the input file
        output_path = joinpath(input_dir, new_filename)
        writedlm(output_path, dag_matrix, ',')
        println("Saved DAG to: $output_path")
        
        return SimpleDiGraph(dag_matrix), matrix, orig_edges, sum(dag_matrix)
    end

    function analyze_generated_dag(g::SimpleDiGraph, orig_matrix)

        orig_edges = sum([orig_matrix[i,j] for i in 1:size(orig_matrix,1) for j in i+1:size(orig_matrix,2) if orig_matrix[i,j] == 1 || orig_matrix[j,i] == 1])
        dag_edges = ne(g)
        retention = round(dag_edges/orig_edges * 100, digits=2)

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
