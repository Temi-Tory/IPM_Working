module JunctionTreeModule
using DataStructures, Graphs, Test, SimpleWeightedGraphs, Combinatorics

using Main.GraphChordaliltyModule

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

function moral_graph(incoming::Dict{Int, Set{Int}}, outgoing::Dict{Int, Set{Int}})::Dict{Int, Set{Int}}
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

function create_clique_graph(cliques::Channel{Set{Int}})
    G = Dict{Set{Int}, Dict{Set{Int}, Float64}}()
    clique_list = collect(cliques)

    # Create nodes for each clique
    for clique in clique_list
        G[clique] = Dict{Set{Int}, Float64}()
    end

    # Iterate through pairs of cliques to create weighted edges
    for i in 1:length(clique_list)
        for j in (i+1):length(clique_list)
            intersection_size = length(intersect(clique_list[i], clique_list[j]))
            if intersection_size > 0
                G[clique_list[i]][clique_list[j]] = Float64(intersection_size)
                G[clique_list[j]][clique_list[i]] = Float64(intersection_size)
            end
        end
    end

    return G
end

function maximum_spanning_tree(clique_graph::Dict{Set{Int}, Dict{Set{Int}, Float64}}, algorithm::Symbol)
    # Create a mapping from Set{Int} to Int for graph nodes
    node_map = Dict{Set{Int}, Int}()
    reverse_map = Dict{Int, Set{Int}}()
    for (i, clique) in enumerate(keys(clique_graph))
        node_map[clique] = i
        reverse_map[i] = clique
    end

    # Create a SimpleWeightedGraph
    num_nodes = length(clique_graph)
    g = SimpleWeightedGraph(num_nodes)

    # Add edges to the graph with weights
    for (clique, neighbors) in clique_graph
        for (neighbor, weight) in neighbors
            u, v = node_map[clique], node_map[neighbor]
            if !has_edge(g, u, v)  # Ensure we add only one undirected edge
                add_edge!(g, u, v, weight)
            end
        end
    end

    # Select the algorithm for the maximum spanning tree
    mst_edges = if algorithm == :boruvka
        first(boruvka_mst(g, minimize=false))
    elseif algorithm == :kruskal
        kruskal_mst(g, minimize=false)
    else
        throw(ArgumentError("Unsupported algorithm. Use :boruvka or :kruskal."))
    end

    # Convert the MST back to our clique representation
    mst = Dict{Set{Int}, Set{Set{Int}}}()
    for edge in mst_edges
        u_clique, v_clique = reverse_map[src(edge)], reverse_map[dst(edge)]
        push!(get!(mst, u_clique, Set{Set{Int}}()), v_clique)
        push!(get!(mst, v_clique, Set{Set{Int}}()), u_clique)
    end

    return mst
end

function junction_tree(incoming::Dict{Int, Set{Int}}, outgoing::Dict{Int, Set{Int}}, algorithm::Symbol)
    # Step 1: Moralize the graph
    G = moral_graph(incoming, outgoing)
    
    # Step 2: Triangulate the graph if not already chordal
    if !is_chordal_graph(G)
        chordal_graph, _ = complete_to_chordal_graph(G)
    else
        chordal_graph = G
    end
    
    # Step 3: Find maximal cliques
    cliques = [Tuple(sort(collect(i))) for i in chordal_graph_cliques(chordal_graph)]
    
    # Step 4: Create clique graph
    clique_graph = SimpleWeightedGraph(length(cliques))
    
    for (i, j) in combinations(1:length(cliques), 2)
        set_edge_0 = Set(cliques[i])
        set_edge_1 = Set(cliques[j])
        if !isdisjoint(set_edge_0, set_edge_1)
            sepset = Tuple(sort(collect(intersect(set_edge_0, set_edge_1))))
            add_edge!(clique_graph, i, j, length(sepset))
        end
    end
    
    # Step 5: Find maximum spanning tree
    mst = if algorithm == :boruvka
        first(boruvka_mst(clique_graph, minimize=false))
    elseif algorithm == :kruskal
        kruskal_mst(clique_graph, minimize=false)
    else
        throw(ArgumentError("Unsupported algorithm. Use :boruvka or :kruskal."))
    end
    
    # Step 6: Add sepsets to create the final junction tree
    junction_tree = add_sepsets(mst, cliques, clique_graph)
    
    return junction_tree
end

function add_sepsets(mst, cliques, clique_graph)
    junction_tree = SimpleGraph(nv(clique_graph))
    
    for edge in mst
        u, v = src(edge), dst(edge)
        add_edge!(junction_tree, u, v)
    end
    
    # Add sepset nodes
    for edge in edges(junction_tree)
        u, v = src(edge), dst(edge)
        set_edge_0 = Set(cliques[u])
        set_edge_1 = Set(cliques[v])
        sepset = Tuple(sort(collect(intersect(set_edge_0, set_edge_1))))
        
        # Add sepset as a new node
        add_vertex!(junction_tree)
        sepset_node = nv(junction_tree)
        
        # Connect sepset to its cliques
        add_edge!(junction_tree, u, sepset_node)
        add_edge!(junction_tree, v, sepset_node)
        
        # Remove direct edge between cliques
        rem_edge!(junction_tree, u, v)
    end
    
    return junction_tree, cliques
end


@testset "Moral Graph Tests" begin
    # Create the input graph
    outgoing = Dict(
        1 => Set([2]),
        2 => Set([3, 5]),
        3 => Set([4]),
        4 => Set([3]),
        5 => Set{Int}()
    )
    incoming = Dict(
        1 => Set{Int}(),
        2 => Set([1]),
        3 => Set([2, 4]),
        4 => Set([3]),
        5 => Set([2])
    )

    # Generate the moral graph
    G_moral = moral_graph(incoming, outgoing)

    # Define the expected edges
    expected_edges = Set([
        (1, 2), (2, 1),
        (2, 3), (3, 2),
        (2, 5), (5, 2),
        (2, 4), (4, 2),
        (3, 4), (4, 3)
    ])

    # Test if the moral graph has the correct edges
    @test Set((min(u,v), max(u,v)) for (u, neighbors) in G_moral for v in neighbors) == Set((min(u,v), max(u,v)) for (u,v) in expected_edges)

    # Test if the moral graph has the correct number of nodes
    @test length(G_moral) == 5

    # Test if all edges are bidirectional (undirected)
    for (u, neighbors) in G_moral
        for v in neighbors
            @test u in G_moral[v]
        end
    end
end

@testset "Moral Graph Tests 2" begin
    # Test case 1: Original example
    outgoing = Dict(
        1 => Set([2]),
        2 => Set([3, 5]),
        3 => Set([4]),
        4 => Set([3]),
        5 => Set{Int}()
    )
    incoming = Dict(
        1 => Set{Int}(),
        2 => Set([1]),
        3 => Set([2, 4]),
        4 => Set([3]),
        5 => Set([2])
    )

    # Generate the moral graph
    G_moral = moral_graph(incoming, outgoing)

    # Define the expected edges
    expected_edges = Set([
        (1, 2), (2, 1),
        (2, 3), (3, 2),
        (2, 5), (5, 2),
        (2, 4), (4, 2),
        (3, 4), (4, 3)
    ])

    # Test if the moral graph has the correct edges
    @test Set((min(u,v), max(u,v)) for (u, neighbors) in G_moral for v in neighbors) == Set((min(u,v), max(u,v)) for (u,v) in expected_edges)

    # Test if the moral graph has the correct number of nodes
    @test length(G_moral) == 5

    # Test if all edges are bidirectional (undirected)
    for (u, neighbors) in G_moral
        for v in neighbors
            @test u in G_moral[v]
        end
    end

    # Test case 2: Empty graph
    incoming_empty = Dict{Int, Set{Int}}()
    outgoing_empty = Dict{Int, Set{Int}}()
    G_moral_empty = moral_graph(incoming_empty, outgoing_empty)
    @test length(G_moral_empty) == 0

    # Test case 3: Single node with no edges
    incoming_single = Dict(1 => Set{Int}())
    outgoing_single = Dict(1 => Set{Int}())
    G_moral_single = moral_graph(incoming_single, outgoing_single)
    @test length(G_moral_single) == 1
    @test isempty(G_moral_single[1])

    # Test case 4: Fully connected graph
    incoming_fully = Dict(
        1 => Set([2, 3]),
        2 => Set([1, 3]),
        3 => Set([1, 2])
    )
    outgoing_fully = Dict(
        1 => Set([2, 3]),
        2 => Set([1, 3]),
        3 => Set([1, 2])
    )
    G_moral_fully = moral_graph(incoming_fully, outgoing_fully)
    expected_edges_fully = Set([
        (1, 2), (1, 3), (2, 3)
    ])
    @test Set((min(u,v), max(u,v)) for (u, neighbors) in G_moral_fully for v in neighbors) == expected_edges_fully

    # Test case 5: Graph with multiple parents
    incoming_multiple_parents = Dict(
        3 => Set([1, 2])
    )
    outgoing_multiple_parents = Dict(
        1 => Set([3]),
        2 => Set([3]),
        3 => Set{Int}()
    )
    G_moral_multiple = moral_graph(incoming_multiple_parents, outgoing_multiple_parents)
    expected_edges_multiple = Set([
        (1, 3), (3, 1),
        (2, 3), (3, 2),
        (1, 2), (2, 1)
    ])
    @test Set((min(u,v), max(u,v)) for (u, neighbors) in G_moral_multiple for v in neighbors) == Set((min(u,v), max(u,v)) for (u,v) in expected_edges_multiple)

     # Test case 6: Disconnected components
     incoming_disconnected = Dict(
        1 => Set{Int}(),
        2 => Set([3]),
        4 => Set([5])
    )
    outgoing_disconnected = Dict(
        1 => Set([2]),
        2 => Set{Int}(),
        3 => Set{Int}(),
        4 => Set([5]),
        5 => Set{Int}()
    )
    G_moral_disconnected = moral_graph(incoming_disconnected, outgoing_disconnected)

    # Correct expected edges for the moral graph
    expected_edges_disconnected = Set([
        (1, 2), (2, 1),
        (4, 5), (5, 4)
    ])

    @test Set((min(u,v), max(u,v)) for (u, neighbors) in G_moral_disconnected for v in neighbors) == Set((min(u,v), max(u,v)) for (u,v) in expected_edges_disconnected)

end

end