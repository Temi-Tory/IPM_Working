using DelimitedFiles, Graphs, GraphViz

using DataStructures, Statistics

function undirected_to_dag(adj_matrix)
    n = size(adj_matrix, 1)
    dag = zeros(Int, n, n)
    
    # Count original undirected edges correctly
    orig_edges = 0
    for i in 1:n
        for j in i+1:n  # Only count upper triangle
            if adj_matrix[i,j] == 1 || adj_matrix[j,i] == 1
                orig_edges += 1
                dag[i,j] = 1  # Keep edge in upper triangle
            end
        end
    end
    
    return dag, orig_edges
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

function generate_dot_string_simple(g::SimpleDiGraph)
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

function visualize_dag(g::SimpleDiGraph)
    # Generate DOT string
    dot_str = generate_dot_string_simple(g)
    
    # Return the DOT string for inspection
    return dot_str
end

matrix = readdlm("csvfiles/metro_undirected.csv", ',', Int)
dag_matrix, orig_edges = undirected_to_dag(matrix)
dag_edges = sum(dag_matrix)
retention = round(dag_edges/orig_edges * 100, digits=2)

writedlm("csvfiles/metro_dag_converted.csv", dag_matrix, ',')


g = SimpleDiGraph(dag_matrix)
analyze_ranked_dag(g, matrix)
dot_str = visualize_dag(g)
graph = GraphViz.load(IOBuffer(dot_str))
