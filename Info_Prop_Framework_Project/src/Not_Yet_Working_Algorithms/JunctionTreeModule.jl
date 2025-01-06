module JunctionTreeModule
using DataStructures, Graphs, Test, SimpleWeightedGraphs, Combinatorics, ChordalGraph, MetaGraphsNext

#= ```
    The junction_tree function encapsulates the entire algorithm.
    It takes a directed graph (represented by incoming and outgoing dictionaries) as input.
    It performs all the steps of the junction tree algorithm:

    Moralizing the graph
    Triangulating the graph
    Finding maximal cliques
    Creating the clique graph
    Finding the maximum spanning tree
    Adding sepsets to create the final junction tree
``` =#

    function moralized_graph(incoming::Dict{Int, Set{Int}}, outgoing::Dict{Int, Set{Int}})::Dict{Int, Set{Int}}
        # Initialize the moral graph
        H = Dict{Int, Set{Int}}()
        
        # Add all nodes to H
        for node in union(keys(incoming), keys(outgoing))
            H[node] = Set{Int}()
        end
        
        # Convert directed edges to undirected
        for (node, neighbors) in outgoing
            union!(H[node], neighbors)
            for neighbor in neighbors
                push!(H[neighbor], node)
            end
        end
        
        # Add edges between parents of common children
        for (child, parents) in incoming
            if length(parents) > 1
                for parent1 in parents
                    for parent2 in parents
                        if parent1 != parent2
                            push!(H[parent1], parent2)
                            push!(H[parent2], parent1)
                        end
                    end
                end
            end
        end
        
        return H
    end

    
    function convert_to_metagraphx(
        mst_edges::Vector{SimpleWeightedEdge{Int64, Float64}},
        index_to_clique::Dict{Int, Vector{UInt16}}
     )
        # Create the MetaGraph with an empty graph
        meta_jt = MetaGraph(
            Graph();  # Start with an empty graph
            label_type=Int,
            vertex_data_type=Vector{UInt16},
            edge_data_type=Float64,
            graph_data="Junction Tree",
            weight_function=identity,
            default_weight=1.0
        )

        # Add vertices with their data (cliques)
        for (i, clique) in index_to_clique
           # add_vertex!(meta_jt, i, clique)
        end

        # Add edges and their weights
        for edge in mst_edges
            add_edge!(meta_jt, edge.src, edge.dst, edge.weight)
        end

        return meta_jt
    end
        
    function build_clique_graph(cliques::Vector{Vector{UInt16}})::Tuple{SimpleWeightedGraph{Int, Float64}, Vector{Tuple{UInt16, Vararg{UInt16}}}, Dict{Int, Vector{UInt16}}}
        # Convert cliques to tuples of sorted UInt16
        cliques_tuples = [Tuple(sort(c)) for c in cliques]
        
        # Create a new SimpleWeightedGraph
        n = length(cliques)
        clique_graph = SimpleWeightedGraph(n)
        
        # Create a mapping from graph indices to original cliques
        index_to_clique = Dict{Int, Vector{UInt16}}(i => cliques[i] for i in 1:n)
        
        # Add edges between cliques with non-empty intersections
        for (i, j) in combinations(1:n, 2)
            set_i = Set(cliques_tuples[i])
            set_j = Set(cliques_tuples[j])
            intersection = intersect(set_i, set_j)
            if !isempty(intersection)
                weight = length(intersection)
                add_edge!(clique_graph, i, j, float(weight))
            end
        end
        
        return clique_graph, cliques_tuples, index_to_clique
    end    

    function junction_tree(incoming::Dict{Int, Set{Int}}, outgoing::Dict{Int, Set{Int}}, mst_algorithm::Symbol, c_algorithm::String)
        # Step 1: Moralize the graph
        G = moralized_graph(incoming, outgoing)
        
        # Create an empty graph with the number of nodes equal to the maximum key in the dictionary
        max_node = maximum(keys(G))
        moral_graph = SimpleGraph(max_node)

        # Add edges to the graph based on the dictionary
        for (node, neighbors) in G
            for neighbor in neighbors
                add_edge!(moral_graph, node, neighbor)
            end
        end

        # Find maximal cliques
        if c_algorithm ∉ ["MF", "MD"]       
            throw(ArgumentError("Unsupported Chordal Graph Extension algorithm. Use MD or MF."))
        end

        cliques, _num_cliques, _size_cliques = chordal_cliques!(moral_graph, method=c_algorithm, minimize=true)

        # Build the clique graph
        clique_graph_, _cliques_tuples, index_to_clique = build_clique_graph(cliques)
        
        # Step 5: Find maximum spanning tree
        mst = if mst_algorithm == :boruvka
            first(boruvka_mst(clique_graph_, minimize=false))
        elseif mst_algorithm == :kruskal
            kruskal_mst(clique_graph_, minimize=false)
        else
            throw(ArgumentError("Unsupported algorithm. Use :boruvka or :kruskal."))
        end

        # Finalize the junction tree by adding sepsets
        meta_mst = convert_to_metagraphx(mst,  index_to_clique)
      return meta_mst, cliques, index_to_clique
    end
end