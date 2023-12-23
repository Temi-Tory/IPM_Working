import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions

Node_Priors = [] #if empty, then all nodes will have an initial reliabilty of 1.0 otherwise this should be a vector of size (number of vertices in graph) where each index  x corresponds to initial relibaility of  node x 

# Define the type for the edge pair
struct EdgePair
    from::Int
    to::Int
end

# Create a dictionary to hold the reliability values
link_reliability = Dict{EdgePair, Float64}()

# Read system data and create the graph
system_data = readdlm("csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv", ',', header= false, Int)
original_system_matrix = Matrix(DataFrame(system_data, :auto))
original_system_graph = DiGraph(original_system_matrix)

# Iterate through each edge in the graph and set reliability
for e in edges(original_system_graph)
    link_reliability[EdgePair(src(e), dst(e))] = 0.9
    reliability = link_reliability[EdgePair(src(e), dst(e))]
end

