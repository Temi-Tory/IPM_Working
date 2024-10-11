
import Cairo, Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

using Main.InputProcessingModule
#using Main.D_SeparatednesModule

function MC_result(
    original_system_graph::DiGraph, 
    link_probability::Dict{Tuple{Int64, Int64}, Distribution} , 
    node_probability::Dict{Int, Distribution},
    sources::Vector{Int}, 
    N::Int=100000
    )
    nv_original = nv(original_system_graph)
    edge_pairs = Tuple.(edges(original_system_graph))
    active_count = zeros(nv_original)
    
    for i in 1:N
        # Initialize a copy of the graph structure to simulate on
        MonteCarlo_Network_Graph = deepcopy(original_system_graph)
        
        # Sample probability for nodes and determine their active status
        node_active = Dict(node => rand(node_probability[node])  for node in vertices(MonteCarlo_Network_Graph))
        
        # Sample probability for edges based on node activity and apply directly
        for (src, dst) in edge_pairs
            if node_active[src] && node_active[dst]  # Ensure both nodes are active to consider the edge
                if rand(link_probability[(src, dst)]) == 1
                    add_edge!(MonteCarlo_Network_Graph, src, dst)
                else
                    rem_edge!(MonteCarlo_Network_Graph, src, dst)
                end
            else
                rem_edge!(MonteCarlo_Network_Graph, src, dst)  # Remove edge if either node is not active
            end
        end
        
        # Evaluate active nodes based on path reachability from sources
        for node in 1:nv(MonteCarlo_Network_Graph)        
            if node in sources 
                if node_active[node]
                    active_count[node] += 1
                end                    
            else
                #path_to_source=[has_path(original_Pwr_dist_graph,i,node) for i in sources]
                mc_path_to_source=[has_path(MonteCarlo_Network_Graph,i,node) for i in sources]
               # check=mc_path_to_source==path_to_source; 
                if any(mc_path_to_source)
                active_count[node]= active_count[node] + 1  
                end
               #= if path_to_source==mc_path_to_source
                   
                end =#
            end
        end
    end
    
    return active_count / N
end

link_probability = Dict{Tuple{Int64, Int64}, Distribution}()




#filepath = "csvfiles/KarlNetwork.csv"
filepath = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv"
#filepath = "csvfiles/16 NodeNetwork Adjacency matrix.csv"

edgelist, outgoing_index, incoming_index, source_nodes, all_nodes = InputProcessingModule.read_graph_to_dict(filepath)

fork_nodes, join_nodes = InputProcessingModule.identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants, common_ancestors_list = InputProcessingModule.find_iteration_sets(edgelist, outgoing_index, incoming_index, fork_nodes, join_nodes, source_nodes);

system_data = readdlm(filepath, ',', header= false, Int)
original_system_matrix = Matrix(DataFrame(system_data, :auto))
original_system_graph = DiGraph(original_system_matrix)

# Assign an empty vector to Node_Priors
Node_Priors = Dict{Int, Distribution}()
for e in edges(original_system_graph)
    link_probability[(src(e), dst(e))] = Bernoulli(0.9)
end

for n in vertices(original_system_graph)
    Node_Priors[n] = Bernoulli(1.0)
end
x = MC_result(original_system_graph,link_probability, Node_Priors,[1,7,18], 1500000)