import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, MetaGraphs, IterTools, IncrementalInference,SimpleWeightedGraphs
using GraphMakie.NetworkLayout 
#using  .InformationPropagation
CairoMakie.activate!()

function has_diamond_subgraph(adj_matrix)
    all_diamond_paths = Vector{Vector{Tuple{Int64, Int64}}}()

    for node in 1:size(adj_matrix, 1)
        if is_fork(node, adj_matrix)
            visited_nodes = Vector{Int64}()
            diamond_paths = find_diamond_path(node, visited_nodes, adj_matrix)
            if !isempty(diamond_paths)
                diamond_group = reduce(vcat, diamond_paths)
                push!(all_diamond_paths, diamond_group)
            end
        end
    end

    if !isempty(all_diamond_paths)
        return true, all_diamond_paths
    else
        return false, nothing
    end
end

function is_fork(node, adj_matrix)
    return number_of_outgoing_edges(node, adj_matrix) > 1
end

function find_diamond_path(node, visited_nodes, adj_matrix)
    diamond_edgepaths = Vector{Vector{Tuple{Int64, Int64}}}()
    if node in visited_nodes
        return diamond_edgepaths
    end

    push!(visited_nodes, node)

    for child_node in get_children(node, adj_matrix)
        if is_join(child_node, adj_matrix)
            # Found the join node; add it to the path and return
            push!(diamond_edgepaths, [(node, child_node)])
        else
            # Recurse on child nodes
            child_paths = find_diamond_path(child_node, visited_nodes, adj_matrix)
            for path in child_paths
                if path[1][1] == node
                    # Add current edge to existing path
                    push!(path, (node, child_node))
                    push!(diamond_edgepaths, path)
                else
                    # Create new path
                    new_path = [(node, child_node)]
                    append!(new_path, path)
                    push!(diamond_edgepaths, new_path)
                end
            end
        end
    end

    # Remove the current node from visited_nodes before returning to allow other paths to be explored
    filter!(visited_node -> visited_node != node, visited_nodes)

    return diamond_edgepaths
end

function is_join(node, adj_matrix)
    return number_of_incoming_edges(node, adj_matrix) > 1
end

function get_children(node, adj_matrix)
    return findall(x -> x != 0, adj_matrix[node, :])
end

function causes_diamond(adj_matrix, edge)
    # Add the edge to the adjacency matrix
    adj_matrix[edge[1], edge[2]] = 1

    # Run the has_diamond_subgraph function to check for diamonds
    has_diamond, diamond_paths = has_diamond_subgraph(adj_matrix)

    # If a diamond is found, return true and the diamond subgraph
    if has_diamond
        return true, diamond_paths
    else
        return false, nothing
    end
end

function edges_to_nodes(edge_paths)
    if isempty(edge_paths)
        return Vector{Vector{Int64}}()
    end
    
    node_paths = Vector{Vector{Int64}}()

    for path in edge_paths
        node_path = Vector{Int64}()
        for (i, edge) in enumerate(path)
            if i == 1
                push!(node_path, edge[1])
            end
            push!(node_path, edge[2])
        end
        sort!(node_path)
        if !any(isequal(node_path), node_paths)
            push!(node_paths, node_path)
        end
    end

    return node_paths
end

function nodes_to_edges(nodes::Vector{Vector{Int64}}, adj_matrix::Matrix{Int64})::Vector{Vector{Tuple{Int64, Int64}}}
    edges = Vector{Vector{Tuple{Int64, Int64}}}(undef, length(nodes))
    for i in 1:length(nodes)
        edge_list = Tuple{Int64, Int64}[]
        for j in 1:length(nodes[i])
            for k in 1:j-1
                if adj_matrix[nodes[i][j], nodes[i][k]] == 1
                    push!(edge_list, (nodes[i][j], nodes[i][k]))
                elseif adj_matrix[nodes[i][k], nodes[i][j]] == 1
                    push!(edge_list, (nodes[i][k], nodes[i][j]))
                end
            end
        end
        edges[i] = edge_list
    end
    return edges
end

function create_adjacency_matrix(adj_matrix::Matrix{Int64}, path::Vector{Vector{Tuple{Int64, Int64}}})
    for edges in path
        for edge in edges
            src, dest = edge
            adj_matrix[src, dest] = 1
        end
    end
    return adj_matrix
end

function number_of_outgoing_edges(node, adj_matrix)
    return count(x -> x != 0, adj_matrix[node, :])
end

function number_of_incoming_edges(node, adj_matrix)
    return count(x -> x != 0, adj_matrix[:, node])
end


function findSources(adj_matrix::Matrix{Int64})
    num_nodes = size(adj_matrix, 1)
    sources = Vector{Int64}()

    # Iterate over each node in the graph
    for i in 1:num_nodes
        incoming_edges = 0
        # Check if there are any incoming edges to node i
        for j in 1:num_nodes
            incoming_edges += adj_matrix[j, i]
        end

        # If there are no incoming edges to node i, add it to sources
        if incoming_edges == 0
            push!(sources, i)
        end
    end

    return sources
end #findSources function end

function  plotinteraction(Network_Graph, sources)
    f, ax, p= graphplot(Network_Graph,
    arrow_size=[25 for i in 1:ne(Network_Graph)],
    arrowcolor  = "pink",
    nlabels= repr.(1:nv(Network_Graph)),
    edge_width = [3 for i in 1:ne(Network_Graph)],
    node_color=[if i in sources "blue" else "pink"  end for i in 1:nv(Network_Graph)  ], #Use colours to identify sink vs source nodes                                      
    node_size=[20 for i in 1:nv(Network_Graph) ])
    ax.yreversed = true 
    hidedecorations!(ax)  # hides ticks, grid and lables 
    hidespines!(ax)  # hide the frame 

    deregister_interaction!(ax, :rectanglezoom)
    register_interaction!(ax, :edgehover, EdgeHoverHighlight(p))
    register_interaction!(ax, :edgedrag, EdgeDrag(p))
    register_interaction!(ax, :nodehover, NodeHoverHighlight(p))
    register_interaction!(ax, :nodedrag, NodeDrag(p))

    function action(idx, event, axis)
        p.edge_color[][idx] = rand(RGB)
        p.edge_color[] = p.edge_color[]
    end
    register_interaction!(ax, :edgeclick, EdgeClickHandler(action))
    display(f);
end

function adjmatrix_to_adjlist(adj_matrix::Matrix{Int64})
    n = size(adj_matrix, 1)
    adj_list = Dict{Int64, Vector{Int64}}()
    for i in 1:n
        children = Vector{Int64}()
        for j in 1:n
            if adj_matrix[i, j] != 0
                push!(children, j)
            end
        end
        adj_list[i] = children
    end
    return adj_list
end

function adjlist_to_matrix(adj_list::Dict{Int64, Vector{Int64}})
    n = length(adj_list)
    adj_matrix = zeros(Int64, n, n)
    for (src, dests) in adj_list
        for dest in dests
            adj_matrix[src, dest] = 1
        end
    end
    return adj_matrix
end












original_system_graph = DiGraph(adj_matrix);
plotinteraction(original_system_graph, findSources(adj_matrix));
tr, e = causes_diamond(adj_matrix, (4,5))
has_diamond_subgraph(adj_matrix)

m = create_adjacency_matrix(zero(adj_matrix), e);
original_system_graph = DiGraph(m);
plotinteraction(original_system_graph, findSources(m));

t=[0  1  1  0;
0  0  0  1;
0  0  0  1;
0  0  0  0;]
#=

adj_matrix = [
    0 1 0 0 0;
    0 0 1 1 0;
    0 0 0 0 1;
    0 0 0 0 1;
    0 0 0 0 0;
]
adj_matrix = [
    0  1  0  0  0  0  0  0;
    0  0  1  1  0  0  0  0;
    0  0  0  0  1  0  0  0;
    0  0  0  0  1  0  0  0;
    0  0  0  0  0  1  1  0;
    0  0  0  0  0  0  0  1;
    0  0  0  0  0  0  0  1;
    0  0  0  0  0  0  0  0;
]

diamond_exist, diamond_paths = has_diamond_subgraph(adj_matrix);
diamond_matrix = create_adjacency_matrix(zero(adj_matrix), diamond_paths[2])

original_system_graph = DiGraph(diamond_matrix);
plotinteraction(original_system_graph, findSources(diamond_matrix));

g=DiGraph(8)
add_edge!(g, 1, 2);add_edge!(g, 2, 3); add_edge!(g, 2, 4); add_edge!(g, 3, 5); add_edge!(g, 4, 5); add_edge!(g, 5, 6); add_edge!(g, 5, 7); add_edge!(g, 7, 8); add_edge!(g, 6, 8);; 
plotinteraction(g, findSources(Matrix(adjacency_matrix(g))));
=#


CairoMakie.activate!()
system_data = readdlm("16 NodeNetwork Adjacency matrix.csv",  ',', header= false, Int);
original_system_matrix = Matrix(DataFrame(system_data, :auto));
original_system_graph = DiGraph(original_system_matrix);
plotinteraction(original_system_graph, findSources(original_system_matrix));

diamond_exist, diamond_paths = has_diamond_subgraph(original_system_matrix);
#diamond_matrix = create_adjacency_matrix(zero(original_system_matrix), diamond_paths[3])
#original_system_graph = DiGraph(diamond_matrix);
#plotinteraction(original_system_graph, findSources(diamond_matrix));í

