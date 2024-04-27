

import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions



# Assign an empty vector to Node_Priors
Node_Priors = Float64[]#if empty, then all nodes will have an initial reliabilty of 1.0 otherwise this should be a vector of size (number of vertices in graph) where each index  x corresponds to initial relibaility of  node x 

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

import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions
GLMakie.activate!();
 
include("IPM_With_NodeTracking.jl") 
using .Information_Propagation
#= G= DiGraph(5)


add_edge!(G, 1,2);
add_edge!(G, 2,3);
add_edge!(G, 2,4);
add_edge!(G, 3,5);
add_edge!(G, 4,5);

# Iterate through each edge in the graph and set reliability
link_reliability = Dict{Tuple{Int64, Int64}, Float64}()
for e in edges(G)
    link_reliability[(src(e), dst(e))] = 0.9
    reliability = link_reliability[(src(e), dst(e))]
end

Node_Priors = fill(0.9, 5)
g_matrix = Matrix(adjacency_matrix(G))
graph,algo_results,ancestorDict,diamondsFoundbtweenForkJoin=Information_Propagation.reliability_propagation(g_matrix,link_reliability,Node_Priors)
algo_results#output_dictionary returned a dictionary where key is node number and value is propagated reliability
 =#
 # Create a dictionary to hold the reliability values
link_reliability = Dict{Tuple{Int64, Int64}, Float64}()

# Read system data and create the graph
system_data = readdlm("csvfiles/KarlNetwork.csv", ',', header= false, Int)
#system_data = readdlm("csvfiles/Shelby county gas.csv", ',', header= false, Int)
#system_data = readdlm("csvfiles/16 NodeNetwork Adjacency matrix.csv", ',', header= false, Int)
#system_data = readdlm("csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv", ',', header= false, Int)

original_system_matrix = Matrix(DataFrame(system_data, :auto))
original_system_graph = DiGraph(original_system_matrix)


# Iterate through each edge in the graph and set reliability
for e in edges(original_system_graph)
    link_reliability[(src(e), dst(e))] = 0.9
    reliability = link_reliability[(src(e), dst(e))]
end

graph,algo_results,ancestorDict,diamondsFoundbtweenForkJoin=Information_Propagation.reliability_propagation(original_system_matrix,link_reliability,Node_Priors); 
ancestorDict#output_dictionary returned a dictionary where key is node number and value is propagated reliability
plotinteraction(original_system_graph, findSources(original_system_matrix)) 
#= mc = Information_Propagation.MC_result(original_system_graph,original_system_matrix,0.9,findSources(original_system_matrix),40000000)
md= Dict()
for i in eachindex(mc)
    md[i] = mc[i]
end
md
using OrderedCollections

mc_results = OrderedDict(sort(md))

# Convert to DataFrame
df = DataFrame(Node = collect(keys(mc_results)), AlgoResults = [pair.second for pair in algo_results], McResults = collect(values(mc_results)))
println(collect(edges(original_system_graph)))
# Display the DataFrame
println(df)
ancestorDict
diamondsFoundbtweenForkJoin =#

#=
path_one_true = 0.9*0.9*0.9; path_one_false = 0.9*0.9*0.1; 
path_two_true = 0.9*0.9*0.9;  path_two_false = 0.9*0.9*0.1; 

true_true = 1-((1-path_one_true)*(1-path_two_true));
false_true = 1-((1-path_one_false)*(1-path_two_true));
true_false = 1-((1-path_one_true)*(1-path_two_false));
false_false = 1-((1-path_one_false)*(1-path_two_false));

both_path_child = (true_true*path_one_true*path_two_true) + (false_true*path_one_false*path_two_true) + (true_false*path_one_true*path_two_false) + (false_false*path_one_false*path_two_false)


ggg = DiGraph(5);
add_edge!(ggg, 1,2);
add_edge!(ggg, 2,3);
add_edge!(ggg, 2,4);
add_edge!(ggg, 3,5);
add_edge!(ggg, 4,5);
adj_ggg= Matrix(adjacency_matrix(ggg));

# Iterate through each edge in the graph and set reliability
for e in edges(ggg)
    link_reliability[(src(e), dst(e))] = 0.9
    reliability = link_reliability[(src(e), dst(e))]
end

graph,algo_results,ancestorDict,diamondsFoundbtweenForkJoin=Information_Propagation.reliability_propagation(adj_ggg,link_reliability,Node_Priors); 
algo_results#output_dictionary returned a dictionary where key is node number and value is propagated reliability

mc = Information_Propagation.MC_result(ggg,adj_ggg,0.9,findSources(adj_ggg),4000000)
md= Dict()
for i in eachindex(mc)
    md[i] = mc[i]
end
md
using OrderedCollections

mc_results = OrderedDict(sort(md))

# Convert to DataFrame
df = DataFrame(Node = collect(keys(mc_results)), AlgoResults = [pair.second for pair in algo_results], McResults = collect(values(mc_results)))

# Display the DataFrame
println(df)




path_one_true = 0.81; path_one_false = 1-path_one_true; 
path_two_true = 0.81;  path_two_false = 1 -path_two_true; 

true_true = 0.926559 * 0.81 * 0.81;
false_true = 0.750951 * 0.81 * 0.19;
true_false = 0.750951 * 0.81 * 0.19;
false_false = 0.155439 * 0.19 * 0.19;


oth_path_child = (true_true*path_one_true*path_two_true) + (false_true*path_one_false*path_two_true) + (true_false*path_one_true*path_two_false) + (false_false*path_one_false*path_two_false)


=#






#=
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

GLMakie.activate!();
plotinteraction(original_system_graph, findSources(original_system_matrix))


function findSinks(adj_matrix::Matrix{Int64})
    num_nodes = size(adj_matrix, 1)
    sources = Vector{Int64}()

    # Iterate over each node in the graph
    for i in 1:num_nodes
        incoming_edges = 0
        # Check if there are any incoming edges to node i
        for j in 1:num_nodes
            incoming_edges += adj_matrix[i,j]
        end

        # If there are no incoming edges to node i, add it to sources
        if incoming_edges == 0
            push!(sources, i)
        end
    end

    return sources
end #findSources function end
findSinks(original_system_matrix)=#


ggg = DiGraph(10);
add_edge!(ggg, 1,2);
add_edge!(ggg, 2,3);
add_edge!(ggg, 2,4);
add_edge!(ggg, 3,5);
add_edge!(ggg, 4,5);
add_edge!(ggg, 5,6);
add_edge!(ggg, 6,7);
add_edge!(ggg, 7,10);
add_edge!(ggg, 5,8);
add_edge!(ggg, 8,9);
add_edge!(ggg, 9,10);
adj_ggg= Matrix(adjacency_matrix(ggg));
mc = Information_Propagation.MC_result(ggg,adj_ggg,0.9,findSources(adj_ggg),8000000)

system_data = readdlm("csvfiles/16 NodeNetwork Adjacency matrix.csv", ',', header= false, Int)

original_system_matrix = Matrix(DataFrame(system_data, :auto))
original_system_graph = DiGraph(original_system_matrix)

show(collect(edges(original_system_graph)))