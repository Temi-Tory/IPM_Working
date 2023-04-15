import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, BenchmarkTools, SparseArrays, MetaGraphs
using GraphMakie.NetworkLayout 



####This section implkemnets topoplogical sorting to find_diamond_subgraphs_topo that takes an adjacency matrix as input and returns an array of arrays representing the nodes in each diamond subgraph:
####This implementation uses the toposort function from the LightGraphs.jl package to compute the topological sorting of the graph. If you prefer not to use a package
#=
function find_diamond_subgraphs_topo(adj::Matrix{Bool})
    # Compute the topological sorting of the graph
    n = size(adj, 1)
    sorted = toposort(adj)

    # Keep track of the visited nodes and their ancestors
    visited = falses(n)
    ancestors = fill(-1, n)

    subgraphs = []

    # Check for adjacent nodes that share a common ancestor
    # and have two or more paths leading to a common descendant
    for i in 2:length(sorted)
        v = sorted[i]
        visited[v] = true
        for j in 1:i-1
            u = sorted[j]
            if adj[u,v]
                if ancestors[u] != -1 && ancestors[u] != v
                    diamond_subgraph = [ancestors[u], u, v]
                    for k in i+1:n
                        w = sorted[k]
                        if adj[v,w] && adj[u,w]
                            push!(diamond_subgraph, w)
                        end
                    end
                    push!(subgraphs, diamond_subgraph)
                end
            end
        end
        for w in findall(adj[v,:])
            if !visited[w]
                ancestors[w] = v
            end
        end
    end

    return subgraphs
end

gg = DiGraph(4) #gg = DiGraph(8)
add_edge!(gg, 1, 2);
add_edge!(gg, 1, 3);
add_edge!(gg, 2, 4);
add_edge!(gg, 3, 4);
#=
add_edge!(gg, 4, 5);
add_edge!(gg, 5, 6);
add_edge!(gg, 5, 7);
add_edge!(gg, 6, 8);
add_edge!(gg, 7, 8);
=#

subgraphsArr = find_diamond_subgraphs(gg);
if length(subgraphsArr) == 0
    println("No diamond subgraphs found.")
else
    println("Diamond subgraphs:")
    for subgraph in subgraphsArr
        println(subgraph)
    end
end
=#
################################################

####This section of functionworks by implementing a dfs algorithm to find all the diamond subgraphs in the graph. taking an adjacency matrix  as an input and returning an array of diamond subgraphs.
#=
function find_diamond_subgraphs(adj::Matrix{Bool})
    subgraphs = []
    n = size(adj, 1)

    # Keep track of the visited nodes and their ancestors
    visited = falses(n)
    ancestors = fill(-1, n)

    # Depth-first search of the graph
    function dfs(v)
        visited[v] = true
        for w in findall(adj[v, :])
            if !visited[w]
                ancestors[w] = v
                dfs(w)
            else
                # Found a diamond subgraph
                if ancestors[v] != -1 && ancestors[v] != w && ancestors[w] != -1 && ancestors[w] != v
                    diamond_subgraph = [ancestors[v], v, ancestors[w], w]
                    push!(subgraphs, diamond_subgraph)
                end
            end
        end
    end

    # Iterate over all nodes and start DFS if not visited
    for i in 1:n
        if !visited[i]
            dfs(i)
        end
    end

    return subgraphs
end


gg = DiGraph(4) #gg = DiGraph(8)
add_edge!(gg, 1, 2);
add_edge!(gg, 1, 3);
add_edge!(gg, 2, 4);
add_edge!(gg, 3, 4);
#=
add_edge!(gg, 4, 5);
add_edge!(gg, 5, 6);
add_edge!(gg, 5, 7);
add_edge!(gg, 6, 8);
add_edge!(gg, 7, 8);
=#

subgraphsArr = find_diamond_subgraphs(gg);
if length(subgraphsArr) == 0
    println("No diamond subgraphs found.")
else
    println("Diamond subgraphs:")
    for subgraph in subgraphsArr
        println(subgraph)
    end
end
=#
################################################

####This section of functionworks by implementing a dfs algorithm to find all the diamond subgraphs in the graph. taking a graph as an input and returning an array of diamond subgraphs.
#=

function find_diamond_subgraphs(g::DiGraph)
    subgraphs = []
    n = nv(g)

    # Keep track of the visited nodes and their ancestors
    visited = falses(n)
    ancestors = fill(-1, n)

    # Depth-first search of the graph
    function dfs(v)
        visited[v] = true
        for w in neighbors(g, v)
            if !visited[w]
                ancestors[w] = v
                dfs(w)
            else
                # Found a diamond subgraph
                if ancestors[v] != -1 && ancestors[v] != w && ancestors[w] != -1 && ancestors[w] != v
                    diamond_subgraph = [ancestors[v], v, ancestors[w], w]
                    push!(subgraphs, diamond_subgraph)
                end
            end
        end
    end

    # Iterate over all nodes and start DFS if not visited
    for i in 1:n
        if !visited[i]
            dfs(i)
        end
    end

 return subgraphs
end

gg = DiGraph(8)
add_edge!(gg, 1, 2);
add_edge!(gg, 1, 3);
add_edge!(gg, 2, 4);
add_edge!(gg, 3, 4);
add_edge!(gg, 4, 5);
add_edge!(gg, 5, 6);
add_edge!(gg, 5, 7);
add_edge!(gg, 6, 8);
add_edge!(gg, 7, 8);

gg = DiGraph(8)
add_edge!(gg, 1, 2);
add_edge!(gg, 1, 3);
add_edge!(gg, 2, 4);
add_edge!(gg, 3, 4);
add_edge!(gg, 4, 5);
add_edge!(gg, 5, 6);
add_edge!(gg, 5, 7);
add_edge!(gg, 6, 8);
add_edge!(gg, 7, 8);


subgraphsArr = find_diamond_subgraphs(gg);
if length(subgraphsArr) == 0
    println("No diamond subgraphs found.")
else
    println("Diamond subgraphs:")
    for subgraph in subgraphsArr
        println(subgraph)
    end
end


system_data = readdlm("16 NodeNetwork Adjacency matrix.csv",  ',', header= false, Int);
system_matrix = Matrix(DataFrame(system_data, :auto));
original_system_graph= DiGraph(system_matrix)
sources=[1,3,13]; link_reliability=0.9; node_Priors=1;

system_data = readdlm("Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv",  ',', header= false, Int);
system_matrix = Matrix(DataFrame(system_data, :auto));
original_system_graph= DiGraph(system_matrix)
sources=[1,3,13]; link_reliability=0.9; node_Priors=1;

original_system_subgraphsArr = find_diamond_subgraphs(original_system_graph);
if length(original_system_subgraphsArr) == 0
    println("No diamond subgraphs found.")
else
    println("Diamond subgraphs:")
    for subgraph in original_system_subgraphsArr
        println(subgraph)
    end
end
=#
########################################

#=
######Here is one way to implement topological sorting in the find_diamond_subgraphs function using the Kahn's algorithm:
function find_diamond_subgraphs(adj_matrix::Matrix{Int})
    n = size(adj_matrix, 1)

    # Calculate the in-degree of each node
    in_degree = zeros(n)
    for i in 1:n
        for j in 1:n
            if adj_matrix[i, j] == 1
                in_degree[j] += 1
            end
        end
    end

    # Initialize the queue with all nodes with in-degree 0
    queue = findall(in_degree .== 0)

    subgraphs = []

    # Process the queue until all nodes have been visited
    while !isempty(queue)
        v = pop!(queue)
        for w in 1:n
            if adj_matrix[v, w] == 1
                in_degree[w] -= 1
                if in_degree[w] == 0
                    push!(queue, w)
                end
            end
        end

        # Check for diamond subgraph
        for w in 1:n
            if adj_matrix[v, w] == 1
                for u in 1:n
                    if adj_matrix[u, w] == 1 && adj_matrix[u, v] == 1
                        diamond_subgraph = [u, v, w]
                        push!(subgraphs, diamond_subgraph)
                    end
                end
            end
        end
    end

    subgraphs
end

gg = DiGraph(4) #gg = DiGraph(8)
add_edge!(gg, 1, 2);
add_edge!(gg, 1, 3);
add_edge!(gg, 2, 4);
add_edge!(gg, 3, 4);
#=
add_edge!(gg, 4, 5);
add_edge!(gg, 5, 6);
add_edge!(gg, 5, 7);
add_edge!(gg, 6, 8);
add_edge!(gg, 7, 8);
=#

subgraphsArr = find_diamond_subgraphs(gg);
if length(subgraphsArr) == 0
    println("No diamond subgraphs found.")
else
    println("Diamond subgraphs:")
    for subgraph in subgraphsArr
        println(subgraph)
    end
end

Example3= DiGraph(6);
add_edge!(Example3, 1, 2);
add_edge!(Example3, 1, 3);
add_edge!(Example3, 2, 6);
add_edge!(Example3, 3, 6);
add_edge!(Example3, 3, 4);
add_edge!(Example3, 4, 5);
add_edge!(Example3, 5, 6);

GLMakie.activate!(); # activate GLMakie backend

function  plotinteraction(f,ax,p)
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
end


sources=[1]; link_reliability=0.9; node_Priors=1;
f, ax, p = Information_Propagation.Visualize_System(Example3,sources,SquareGrid());
plotinteraction(f,ax,p);    display(f)

###Todo: generate a function that checks if a matrix is a Directed acyclcic graph (DAG) or not.
#generate a function that checks if a matrix is a Directed acyclcic graph (DAG) or not.

function update_node_belief(belief_dict, link_reliability,new_system_graph, node)
    messages_from_parents = [ 1 - (belief_dict[parent]* link_reliability) for parent in inneighbors(new_system_graph, node)] #message is failure probability of parent
    updated_belief =  1 - prod(messages_from_parents)
    return updated_belief
end

function update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs)
    for node in 1:nv(new_system_graph) #for every node in graph       
        if (
                inneighbors(new_system_graph, node)==inneighbors(original_system_graph, node) 
                && 
                ( 
                    (outneighbors(new_system_graph, node) != outneighbors(original_system_graph, node)) || isempty(outneighbors(original_system_graph,node)) 
                )
            ) 
                belief_dict[node]=(if node in sources node_Priors else update_node_belief(belief_dict, link_reliability,new_system_graph, node) end)

                children=[c for c in outneighbors(original_system_graph,node)];
                    for child in children
                        if (inneighbors(new_system_graph, child)==inneighbors(original_system_graph, child) && isempty(outneighbors(original_system_graph,child)))
                            belief_dict[child] = update_node_belief(belief_dict, link_reliability,new_system_graph, child)
                        else append!(edgepairs,[(node,child) for child in children])   
                        end
                end
        end   
   
    end    
    return belief_dict,edgepairs
end

function update_graph(new_system_graph,edgepairs)
    for edge in edgepairs 
        add_edge!(new_system_graph,edge)
    end
end




original_system_graph= Example3;
new_system_graph = DiGraph(zero(adjacency_matrix(Example3)));
belief_dict=Dict(); edgepairs=[]; terminating_nodes=[]; #f = Figure(); structure_count=0;

belief_dict,edgepairs = update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs);
update_graph(new_system_graph,edgepairs)

sources=[1]; link_reliability=0.9; node_Priors=1;
f, ax, p = Information_Propagation.Visualize_System(new_system_graph,sources,SquareGrid());
plotinteraction(f,ax,p);    display(f)


G= DiGraph(6)
add_edge!(G, 1, 2)
add_edge!(G, 1, 3)
add_edge!(G, 2, 4)
add_edge!(G, 3, 4)
add_edge!(G, 4, 5)
add_edge!(G, 4, 6)
add_edge!(G, 5, 6)
add_edge!(G, 2, 3)

f, ax, p = Information_Propagation.Visualize_System(G,sources,SquareGrid());
plotinteraction(f,ax,p);    display(f)

=#

#########
#we use the transitive closure reduction algorithm to construct the transitive closure of the DAG, regardless of the ratio of edges to vertices.
# The rest of the implementation is the same as before: we find all pairs of vertices that form a diamond subgraph and store them in a dictionary, 
#and then we print out the diamond subgraphs for each pair of ancestors and descendants. 
#This implementation ensures that the time complexity is O(nm) for any DAG.


#=

# Define the DAG as a LightGraphs.DiGraph object
g = DiGraph(4)
add_edge!(g, 1, 2)
add_edge!(g, 1, 3)
add_edge!(g, 2, 4)
add_edge!(g, 3, 4)
add_edge!(g, 2, 3)

# Determine the ratio of edges to vertices
num_edges = ne(g)
num_vertices = nv(g)
edge_to_vertex_ratio = num_edges / num_vertices

# Initialize the set of diamond subgraphs
diamond_subgraphs = Set{Tuple{Int, Int, Int}}()

# Find all pairs of vertices that form a diamond subgraph using the appropriate algorithm
if edge_to_vertex_ratio > 1
    # Use the transitive closure algorithm
    tc = zeros(Int8, nv(g), nv(g))
    for u in vertices(g)
        reach_u = reachable_vertices(g, u)
        for v in reach_u
            tc[u, v] = 1
        end
    end

    for v in vertices(g)
        ancestors = [u for u in parents(g, v) if u != v]
        descendants = [w for w in children(g, v) if w != v]
        for u in ancestors, w in descendants
            if tc[u, w] && !tc[u, v] && !tc[v, w]
                push!(diamond_subgraphs, (u, v, w))
            end
        end
    end
else
    # Use the common descendants algorithm
    for v in vertices(g)
        ancestors = [u for u in parents(g, v) if u != v]
        descendants = [w for w in children(g, v) if w != v]
        for u in ancestors, w in descendants
            common_descendants = intersect(children(g, u), children(g, w))
            for x in common_descendants
                if !has_edge(g, u, x) && !has_edge(g, v, x) && !has_edge(g, w, x)
                    push!(diamond_subgraphs, (u, v, w))
                end
            end
        end
    end
end

# Print the diamond subgraphs
for (u, v, w) in diamond_subgraphs
    println("Diamond subgraph: $u -> $v -> $w")
end
=#


#to Calculate the 

