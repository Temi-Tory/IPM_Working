import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, BenchmarkTools, SparseArrays, MetaGraphs
using GraphMakie.NetworkLayout 

GLMakie.activate!()

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





g = DiGraph(6)
add_edge!(g, 1, 2);
add_edge!(g, 1, 3);
add_edge!(g, 2, 4);
add_edge!(g, 3, 4);
add_edge!(g, 6, 1);
add_edge!(g, 4, 5);


plotinteraction(g, [1])

using .Information_Propagation
sources=[6]; link_reliability=0.9; node_Priors=1; #if no node failure considered therefore node reliability = 1
original_system_graph= g;
system_matrix = adjacency_matrix(g);
new_system_graph = DiGraph(zero(system_matrix));
belief_dict=Dict(); edgepairs=[]; #terminating_nodes=[]; #f = Figure(); structure_count=0;



belief_dict,edgepairs = Information_Propagation.update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs);
Information_Propagation.update_graph(new_system_graph,edgepairs);
f, ax, p = Information_Propagation.Visualize_System(new_system_graph,sources);
plotinteraction(new_system_graph, sources)    
Matrix(adjacency_matrix(new_system_graph))

belief_dict[nv(new_system_graph)] = 1-prod([ 1- (belief_dict[parent]*link_reliability) for parent in inneighbors(new_system_graph, nv(new_system_graph))]);
Node_Reliability=sort(collect(pairs(belief_dict)), by=x->x[1]);

f, ax, p = Information_Propagation.Visualize_System(new_system_graph,sources); 
plotinteraction(new_system_graph, sources)  

#Information_Propagation.reliability_propagation(adjacency_matrix(g),[1],0.9,1.0)
Information_Propagation.reliability_propagation(Matrix(system_matrix),sources,link_reliability,node_Priors)


plotinteraction(original_system_graph, [1])  
xtest=Information_Propagation.MC_result(original_system_graph,system_matrix,link_reliability,sources,1000000)
    test_dict = Dict{Int64,Float64}();
    for i in eachindex(xtest)
        test_dict[i]=xtest[i]; 
    end
sort(collect(test_dict), by = x->x[1])


g = DiGraph(7)

add_edge!(g, 1, 2)
add_edge!(g, 2, 3)
add_edge!(g, 2, 4)
add_edge!(g, 3, 5)
add_edge!(g, 4, 5)
add_edge!(g, 5, 6)
add_edge!(g, 4, 7)
add_edge!(g, 7, 6)

#Grid Network
system_data = readdlm("KarlNetwork.csv",  ',', header= false, Int);
system_matrix = Matrix(DataFrame(system_data, :auto));
original_system_graph= DiGraph(system_matrix)
sources=[1,3,13]; link_reliability=0.9; node_Priors=1; #if no node failure considered therefore node reliability = 1

plotinteraction(original_system_graph, sources)  


system_matrix = adjacency_matrix(original_system_graph);
new_system_graph = DiGraph(zero(system_matrix));
belief_dict=Dict(); edgepairs=[]; #terminating_nodes=[]; #f = Figure(); structure_count=0;



belief_dict,edgepairs = Information_Propagation.update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs);
Information_Propagation.update_graph(new_system_graph,edgepairs);
f, ax, p = Information_Propagation.Visualize_System(new_system_graph,sources);
plotinteraction(new_system_graph, sources)    
Matrix(adjacency_matrix(new_system_graph))

x=maxsimplecycles(Graph(original_system_graph))
[1, 2, 13, 12] in x 