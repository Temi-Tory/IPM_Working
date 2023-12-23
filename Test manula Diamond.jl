import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions
#using  .Information_Propagation;
#using .Information_Propagation_PowerDist

#=system_data = readdlm("csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv",  ',', header= false, Int);
original_system_matrix = Matrix(DataFrame(system_data, :auto));
original_system_graph = DiGraph(original_system_matrix);

using BenchmarkTools
@btime _,b = Information_Propagation.reliability_propagation(original_system_matrix,[1,7,18],0.9,[],true);
@btime Information_Propagation.MC_result(original_system_graph,original_system_matrix,0.9,[1,3,13],80000000)
=#

#system_data = readdlm("csvfiles/The Bayesian network of the10KV distribution system.csv",  ',', header= false, Int);
system_data = readdlm("csvfiles/Shelby county gas.csv",  ',', header= false, Int)
original_system_matrix = Matrix(DataFrame(system_data, :auto));
original_system_graph = DiGraph(original_system_matrix); 
@btime _,b = Information_Propagation.reliability_propagation(original_system_matrix,[17],0.9)
@btime Information_Propagation.MC_result(original_system_graph,original_system_matrix,0.9,[17],100000)

using BenchmarkTools
#Ipm_VoltSt = @btime _,b = Information_Propagation.reliability_propagation(original_system_matrix,[1,2,3,4,5,6,7,8,9,10],0.9)
Mcmc_VoltSt = @btime Information_Propagation.MC_result(original_system_graph,original_system_matrix,0.9,[1,2,3,4,5,6,7,8,9,10],100000)


using  .DiamondModule;
adjList= [
    0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  1  0  0  1  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  1  0  0  1  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  1  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  1  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
]
DiamondModule.find_diamond_subgraphs(adjList)


shekby_adjMatrix  = [
 0  0  0  1  0  1  0  0  0  1  0  0  0  0  0  0  0;
 0  0  0  0  0  1  0  0  0  0  0  0  0  1  0  0  0;
 0  0  0  0  0  0  0  0  0  0  1  1  0  0  0  0  0;
 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
 0  0  0  0  1  0  0  0  0  0  1  0  0  0  0  0  0;
 0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0;
 0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0;
 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0;
 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
 0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0;
 0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0;
 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
 0  0  0  0  0  0  1  1  0  0  0  0  0  0  1  0  0;
 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
 1  1  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
];
DiamondModule.find_diamond_subgraphs(shekby_adjMatrix)


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



diamonds = DiamondModule.find_diamond_subgraphs(adjList)
first_diamond = diamonds[2]
diamond_adj_matrix = first_diamond[4]
system_graph = DiGraph(diamond_adj_matrix)
plotinteraction(system_graph, [1,7,18])
