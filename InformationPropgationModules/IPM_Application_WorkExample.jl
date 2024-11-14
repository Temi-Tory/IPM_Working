
using Random, Graphs, DataFrames, DelimitedFiles, Distributions



# Assign an empty vector to Node_Priors
#= Node_Priors = Float64[]#if empty, then all nodes will have an initial reliabilty of 1.0 otherwise this should be a vector of size (number of vertices in graph) where each index  x corresponds to initial relibaility of  node x 
 =#

# Create a dictionary to hold the reliability values
link_reliability = Dict{InformationPropagation.EdgePair, Distribution}()
Node_Priors = Dict{Int, Distribution}() #Assign an empty vector to Node_Priors

# Read system data and create the graph
#system_data = readdlm("csvfiles/KarlNetwork.csv", ',', header= false, Int)
#system_data = readdlm("csvfiles/Shelby county gas.csv", ',', header= false, Int)
#system_data = readdlm("csvfiles/16 NodeNetwork Adjacency matrix.csv", ',', header= false, Int)
system_data = readdlm("csvfiles/16_node_old.csv", ',', header= false, Int)


original_system_matrix = Matrix(DataFrame(system_data, :auto))
original_system_graph = DiGraph(original_system_matrix)

#= gg = DiGraph(5);  add_edge!(gg, 1,2);   add_edge!(gg, 2,3);  add_edge!(gg, 2,4);  add_edge!(gg, 4,5);  add_edge!(gg, 3,5)
original_system_matrix = Matrix(adjacency_matrix(gg))
original_system_graph = gg =#

# Iterate through each edge in the graph and set reliability
for e in edges(original_system_graph)
    link_reliability[InformationPropagation.EdgePair(src(e), dst(e))] = Bernoulli(0.9)
    reliability = link_reliability[InformationPropagation.EdgePair(src(e), dst(e))]
end

for node in vertices(original_system_graph)
    Node_Priors[node] = Bernoulli(1.0)
end

graph,ouptput_dictionary=InformationPropagation.reliability_propagation(original_system_matrix,link_reliability,Node_Priors); 
ouptput_dictionary
#output_dictionary returned a dictionary where key is node number and value is propagated reliability

#= function findSources(adj_matrix::Matrix{Int64})
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


mc = InformationPropagation.MC_result(original_system_graph,link_reliability,Node_Priors,findSources(original_system_matrix),8000000)
md= Dict()
for i in eachindex(mc)
    md[i] = mc[i]
end
md
using OrderedCollections

mc_results = OrderedDict(sort(md))

# Convert to DataFrame
df = DataFrame(Node = collect(keys(mc_results)), AlgoResults = [pair.second for pair in ouptput_dictionary], McResults = collect(values(mc_results)))
#println(collect(edges(original_system_graph)))
# Display the DataFrame
println(df)
#=ancestorDict
diamondsFoundbtweenForkJoin =#
 =#

