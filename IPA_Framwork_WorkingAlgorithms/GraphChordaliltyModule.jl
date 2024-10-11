module GraphChordaliltyModule

using Test, DataStructures
#= ```
A chordal graph (also known as a triangulated graph) is a graph in which every cycle of four or more nodes has a chord. A chord is an edge that connects two non-adjacent nodes in the cycle, effectively breaking it into smaller cycles.

In other words, chordal graphs have the following properties:

They do not have long cycles without shortcuts, which means every long cycle (length of 4 or more) must have an edge connecting two non-consecutive vertices in the cycle.
They are characterized by the absence of induced cycles of four or more nodes without chords.
``` =#


struct ConnectedComponentsIterator
    G::Dict{Int, Set{Int}}
end

Base.iterate(iter::ConnectedComponentsIterator) = iterate(iter, Set{Int}())

function Base.iterate(iter::ConnectedComponentsIterator, seen::Set{Int})
    for v in keys(iter.G)
        if !(v in seen)
            component = _plain_bfs(iter.G, v)
            union!(seen, component)
            return (component, seen)
        end
    end
    return nothing
end

Base.IteratorSize(::Type{ConnectedComponentsIterator}) = Base.SizeUnknown()
Base.IteratorEltype(::Type{ConnectedComponentsIterator}) = Base.HasEltype()
Base.eltype(::Type{ConnectedComponentsIterator}) = Set{Int}

function _plain_bfs(G::Dict{Int, Set{Int}}, start::Int)
    seen = Set{Int}([start])
    queue = Queue{Int}()
    enqueue!(queue, start)
    
    while !isempty(queue)
        v = dequeue!(queue)
        for w in G[v]
            if !(w in seen)
                push!(seen, w)
                enqueue!(queue, w)
            end
        end
    end
    
    return seen
end

function connected_components(G::Dict{Int, Set{Int}})
    #= Isolated nodes are be treated as separate components: In graph theory, an isolated node is a 
    connected component by itself, as there is no other node connected to it. =#
    return ConnectedComponentsIterator(G)
end

function is_chordal_graph(G::Dict{Int, Set{Int}})::Bool
    ordering = lexicographic_breadth_first_search(G)
    return is_perfect_elimination_ordering(G, ordering)
end

function lexicographic_breadth_first_search(G::Dict{Int, Set{Int}})::Set{Int}
    n = length(G)
    unnumbered = Set(keys(G))
    ordering = Int[]
    
    while !isempty(unnumbered)
        v = first(unnumbered)
        for u in unnumbered
            if length(intersect(Set(G[u]), Set(ordering))) > length(intersect(Set(G[v]), Set(ordering)))
                v = u
            end
        end
        push!(ordering, v)
        delete!(unnumbered, v)
    end
    
    return reverse(ordering)
end

function is_perfect_elimination_ordering(G::Dict{Int, Set{Int}}, ordering::Set{Int})::Bool
    n = length(G)
    for i in 1:n-1
        v = ordering[i]
        later_neighbors = [u for u in G[v] if findfirst(==(u), ordering) > i]
        if !isempty(later_neighbors)
            w = later_neighbors[argmax([findfirst(==(u), ordering) for u in later_neighbors])]
            if !all(u in G[w] for u in later_neighbors if u != w)
                return false
            end
        end
    end
    return true
end

function complete_to_chordal_graph(G::Dict{Int, Set{Int}})::Tuple{Dict{Int, Set{Int}}, Dict{Int, Int}}
    H = deepcopy(G)
    ordering = lexicographic_breadth_first_search(H)
    n = length(H)
    
    for i in 1:n-1
        v = ordering[i]
        later_neighbors = [u for u in H[v] if findfirst(==(u), ordering) > i]
        if !isempty(later_neighbors)
            w = later_neighbors[argmax([findfirst(==(u), ordering) for u in later_neighbors])]
            for u in later_neighbors
                if u != w
                    if !(u in H[w])
                        push!(H[w], u)
                        push!(H[u], w)
                    end
                end
            end
        end
    end
    
    alpha = Dict(v => i for (i, v) in enumerate(reverse(ordering)))
    return H, alpha
end

function chordal_graph_cliques(G::Dict{Int, Set{Int}})
    Channel() do channel
        for C in connected_components(G)
            if length(C) == 1
                v = first(C)
                if v in G[v]
                    throw(ErrorException("Input graph is not chordal."))
                end
                put!(channel, Set([v]))
            else
                SG = get_subgraph(G, C)
                unnumbered = C
                v = first(unnumbered)
                delete!(unnumbered, v)
                numbered = Set([v])
                clique_wanna_be = Set([v])
                
                while !isempty(unnumbered)
                    v = max_cardinality_node(SG, unnumbered, numbered)
                    delete!(unnumbered, v)
                    push!(numbered, v)
                    new_clique_wanna_be = intersect(Set(SG[v]), numbered)
                    sg = get_subgraph(SG, clique_wanna_be)
                    
                    if is_complete_graph(sg)
                        push!(new_clique_wanna_be, v)
                        if !issubset(clique_wanna_be, new_clique_wanna_be)
                            put!(channel, clique_wanna_be)
                        end
                        clique_wanna_be = new_clique_wanna_be
                    else
                        throw(ErrorException("Input graph is not chordal."))
                    end
                end
                put!(channel, clique_wanna_be)
            end
        end
    end
end

function max_cardinality_node(G::Dict{Int, Set{Int}}, choices::Set{Int}, wanna_connect::Set{Int})::Int
    max_number = -1
    max_node = first(choices)

    for x in choices
        number = count(y -> y in wanna_connect, G[x])
        if number > max_number
            max_number = number
            max_node = x
        end
    end

    return max_node
end

function get_subgraph(G::Dict{Int, Set{Int}}, nodes::Set{Int})::Dict{Int, Set{Int}}
    SG = Dict{Int, Set{Int}}()
    for node in nodes
        if haskey(G, node)
            SG[node] = filter(neighbor -> neighbor in nodes, G[node])
        end
    end
    return SG
end

function is_complete_graph(G::Dict{Int, Set{Int}})::Bool

    for (node, neighbors) in G
        if node in neighbors
            throw(ArgumentError("Self loop found in is_complete_graph()"))
        end
    end

    n = length(G)
    for (_, neighbors) in G
        if length(neighbors) != n - 1
            return false
        end
    end
    return true
end

function find_missing_edge(G::Dict{Int, Set{Int}})::Tuple{Int, Int}
    """Given a non-complete graph G, returns a missing edge."""
    nodes = Set(keys(G))
    for u in keys(G)
        missing = setdiff(nodes, Set(G[u]), Set([u]))
        if !isempty(missing)
            return (u, pop!(missing))
        end
    end
    throw(ErrorException("No missing edge found in a complete graph"))
end

function has_path(G::Dict{Int, Set{Int}}, starting_node::Int, ending_node::Int, allowed_nodes::Set{Int})
    queue = [starting_node]
    visited = Set([starting_node])
    
    while !isempty(queue)
        current = popfirst!(queue)
        if current == ending_node
            return true
        end
        for neighbor in G[current]
            if neighbor in allowed_nodes && neighbor ∉ visited
                push!(visited, neighbor)
                push!(queue, neighbor)
            end
        end
    end
    
    return false
end


@testset "Max Cardinality Node Tests" begin
    # Graph represented as an adjacency list
    G = Dict{Int, Set{Int}}(
        1 => Set([2, 3, 4]),
        2 => Set([1, 5, 6]),
        3 => Set([1, 7, 8]),
        4 => Set([1, 9, 10]),
        5 => Set([2, 11, 12]),
        6 => Set([2, 13]),
        7 => Set([3, 14]),
        8 => Set([3, 15, 16]),
        9 => Set([4, 17]),
        10 => Set([4, 18]),
        11 => Set([5, 19]),
        12 => Set([5, 20]),
        13 => Set([6]),
        14 => Set([7]),
        15 => Set([8]),
        16 => Set([8]),
        17 => Set([9]),
        18 => Set([10]),
        19 => Set([11]),
        20 => Set([12])
    )
    
    # Convert choices and wanna_connect to sets
    choices = Set([1, 2, 3, 4, 5])
    wanna_connect = Set([1, 5, 6, 7])
    
    # Expect node 2 since it has the most connections to nodes in wanna_connect
    result = GraphChordaliltyModule.max_cardinality_node(G, choices, wanna_connect)
    @test result == 2
end

@testset "Connected Components Tests" begin
    # Test case 1: Simple connected graph
    G1 = Dict(
        1 => Set([2, 3]),
        2 => Set([1, 3]),
        3 => Set([1, 2])
    )
    components = connected_components(G1)
    expected = [Set([1, 2, 3])]
    @test [component for component in components] == expected

    # Test case 2: Graph with two components
    G2 = Dict(
        1 => Set([2]),
        2 => Set([1]),
        3 => Set([4]),
        4 => Set([3])
    )
    components = connected_components(G2)
    expected = [Set([1, 2]), Set([3, 4])]
    sorted_components = sort([component for component in components], by = x -> minimum(x))
    @test sorted_components == sort(expected, by = x -> minimum(x))

    # Test case 3: Graph with isolated nodes
    G3 = Dict(
        1 => Set([2, 3]),
        2 => Set([1, 3]),
        3 => Set([1, 2]),
        4 => Set([5]),
        5 => Set([4]),
        6 => Set{Int64}(),  # Isolated node
        7 => Set{Int64}()   # Another isolated node
    )
    components = connected_components(G3)
    expected = [Set([1, 2, 3]), Set([4, 5]), Set([6]), Set([7])]
    sorted_components = sort([component for component in components], by = x -> minimum(x))
    @test sorted_components == sort(expected, by = x -> minimum(x))

    # Test case 4: Complex graph with multiple connected components
    G4 = Dict(
        1 => Set([2]),
        2 => Set([1, 3]),
        3 => Set([2]),
        4 => Set([5]),
        5 => Set([4]),
        6 => Set([7]),
        7 => Set([6, 8]),
        8 => Set([7]),
        9 => Set{Int64}(),    # Isolated node
        10 => Set([11]),
        11 => Set([10, 12]),
        12 => Set([11, 13]),
        13 => Set([12]),
        14 => Set{Int64}()    # Another isolated node
    )
    components = connected_components(G4)
    expected = [Set([1, 2, 3]), Set([4, 5]), Set([6, 7, 8]), Set([9]), Set([10, 11, 12, 13]), Set([14])]
    sorted_components = sort([component for component in components], by = x -> minimum(x))
    @test sorted_components == sort(expected, by = x -> minimum(x))

    # Test case 5: Empty graph
    G5 = Dict{Int, Set{Int64}}()
    components = connected_components(G5)
    expected = Set[]  # No components in an empty graph
    @test [component for component in components] == expected

    # Test case 6: Graph with a single isolated node
    G6 = Dict(1 => Set{Int64}())
    components = connected_components(G6)
    expected = [Set([1])]
    @test [component for component in components] == expected
end

# Test set for chordal_graph_cliques function
@testset "Chordal Graph Cliques Tests" begin
    # Test case 1: Graph with multiple maximal cliques
    G1 = Dict(
        1 => Set([2, 3]),
        2 => Set([1, 3, 4]),
        3 => Set([1, 2, 4, 5, 6]),
        4 => Set([2, 3, 5, 6]),
        5 => Set([3, 4, 6]),
        6 => Set([3, 4, 5]),
        7 => Set([8]),
        8 => Set([7]),
        9 => Set{Int64}() # Isolated node
    )
    
    cliques1 = GraphChordaliltyModule.chordal_graph_cliques(G1)
    expected1 = [
        Set([5, 4, 6, 3]),
        Set([4, 2, 3]),
        Set([2, 3, 1]),
        Set([7, 8]),
        Set([9])
    ]

    # Sort cliques by minimum element to compare
    sorted_cliques1 = sort([clique for clique in cliques1], by=x -> minimum(x))
    sorted_expected1 = sort(expected1, by=x -> minimum(x))
    @test sorted_cliques1 == sorted_expected1

    # Test case 2: Simple complete graph
    G2 = Dict(
        1 => Set([2, 3, 4]),
        2 => Set([1, 3, 4]),
        3 => Set([1, 2, 4]),
        4 => Set([1, 2, 3])
    )
    
    cliques2 = GraphChordaliltyModule.chordal_graph_cliques(G2)
    expected2 = [Set([1, 2, 3, 4])]

    # Sort cliques by minimum element to compare
    sorted_cliques2 = sort([clique for clique in cliques2], by=x -> minimum(x))
    sorted_expected2 = sort(expected2, by=x -> minimum(x))
    @test sorted_cliques2 == sorted_expected2

    # Test case 3: Graph with isolated nodes and two components
    G3 = Dict(
        1 => Set([2]),
        2 => Set([1, 3]),
        3 => Set([2]),
        4 => Set([5]),
        5 => Set([4]),
        6 => Set{Int64}()
    )
    
    cliques3 = GraphChordaliltyModule.chordal_graph_cliques(G3)
    expected3 = [
        Set([1, 2]),
        Set([2, 3]),
        Set([4, 5]),
        Set([6])
    ]

    # Sort cliques by minimum element to compare
    sorted_cliques3 = sort([clique for clique in cliques3], by=x -> minimum(x))
    sorted_expected3 = sort(expected3, by=x -> minimum(x))
    @test sorted_cliques3 == sorted_expected3

    # Test case 4: Empty graph
    G4 = Dict{Int, Set{Int}}()
    
    cliques4 = GraphChordaliltyModule.chordal_graph_cliques(G4)
    expected4 = []

    @test [clique for clique in cliques4] == expected4

    # Test case 5: Graph with a single isolated node
    G5 = Dict(1 => Set{Int64}())
    
    cliques5 = GraphChordaliltyModule.chordal_graph_cliques(G5)
    expected5 = [Set([1])]

    @test [clique for clique in cliques5] == expected5
end

end # Close the module
