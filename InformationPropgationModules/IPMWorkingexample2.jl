

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

#graph,ouptput_dictionary,x,y=Information_Propagation.reliability_propagation(original_system_matrix,link_reliability,Node_Priors); 
#output_dictionary returned a dictionary where key is node number and value is propagated reliability

mc = Information_Propagation.MC_result(original_system_graph,original_system_matrix,0.9,[11],4000000)
md= Dict()
for i in eachindex(mc)
    md[i] = mc[i]
end
md
using OrderedCollections

sorted_md = OrderedDict(sort(md))
