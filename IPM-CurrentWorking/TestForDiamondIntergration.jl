import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions



# Assign an empty vector to Node_Priors
Node_Priors = Float64[]#if empty, then all nodes will have an initial reliabilty of 1.0 otherwise this should be a vector of size (number of vertices in graph) where each index  x corresponds to initial relibaility of  node x 


# Create a dictionary to hold the reliability values
link_reliability = Dict{Information_Propagation.EdgePair, Float64}()

# Read system data and create the graph
system_data = readdlm("csvfiles/Shelby county gas.csv", ',', header= false, Int)
original_system_matrix = Matrix(DataFrame(system_data, :auto))
original_system_graph = DiGraph(original_system_matrix)

# Iterate through each edge in the graph and set reliability
for e in edges(original_system_graph)
    link_reliability[Information_Propagation.EdgePair(src(e), dst(e))] = 0.9
    reliability = link_reliability[Information_Propagation.EdgePair(src(e), dst(e))]
end

graph,ouptput_dictionary=Information_Propagation.reliability_propagation(original_system_matrix,link_reliability,Node_Priors)
#output_dictionary returned a dictionary where key is node number and value is propagated reliability