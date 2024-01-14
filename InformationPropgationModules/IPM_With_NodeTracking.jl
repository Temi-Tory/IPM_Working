module Information_Propagation

import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, MetaGraphs, IterTools, SimpleWeightedGraphs
using GraphMakie.NetworkLayout 
CairoMakie.activate!()

Random.seed!(2409);

function reliability_propagation(system_matrix, sources, link_reliability, node_Priors=[])
    original_system_graph = DiGraph(system_matrix)
    new_system_graph = DiGraph(zero(system_matrix))
    belief_dict = Dict()
    edgepairs = []
    ancestors_dict = Dict{Int, Set{Int}}()  # Dictionary to track ancestors
    all_paths_dict = Dict{Tuple{Int, Int}, Vector{Vector{Int}}}()

    if isempty(node_Priors)
        node_Priors = fill(1.0, nv(new_system_graph))
    end

    while new_system_graph != original_system_graph
        belief_dict, edgepairs, ancestors_dict, all_paths_dict = update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs, ancestors_dict, all_paths_dict)
        update_graph(new_system_graph, edgepairs)
    end

    belief_dict, edgepairs, ancestors_dict, all_paths_dict = update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs, ancestors_dict, all_paths_dict)

    Node_Reliability = sort(collect(pairs(belief_dict)), by=x->x[1])

    return new_system_graph, Node_Reliability, ancestors_dict, all_paths_dict
end

function find_all_paths_iterative(fork::Int, join::Int, adj_matrix::Array{Int, 2}, ancestors::Set{Int})::Vector{Vector{Int}}
    # Create a copy of the ancestors set and include the join node itself
    ancestorsInclusive = copy(ancestors)
    push!(ancestorsInclusive, join)

    # Initialize an empty vector to store all paths and a queue for BFS
    all_paths = Vector{Vector{Int}}()
    queue = [(fork, [fork])]

    # Iterate until the queue is empty
    while !isempty(queue)
        current, path = popfirst!(queue)

        # If the current node is the join node, add the path to all_paths
        if current == join
            push!(all_paths, path)
            continue
        end

        # Explore all next nodes from the current node
        for next_node in findall(adj_matrix[current, :] .== 1)
            # Add the next node to the path if it's not already in the path and is an ancestor
            if next_node ∉ path && next_node in ancestorsInclusive
                new_path = [path; next_node]
                push!(queue, (next_node, new_path))
            end
        end
    end

    return all_paths
end

function combine_and_expand_paths(paths::Vector{Vector{Int}}, adj_matrix::Array{Int, 2}, fork_node::Int)::Vector{Int}
    # Combine all paths into a single set of unique nodes
    combined_path = unique(vcat(paths...))

    # Include nodes that have direct edges to any node in the combined path, excluding the fork node
    for node in combined_path
        if node != fork_node
            for connected_node in findall(adj_matrix[:, node] .== 1)
                if connected_node ∉ combined_path
                    push!(combined_path, connected_node)
                end
            end
        end
    end

    return combined_path
end

function update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs, ancestors_dict, all_paths_dict)
    for node in 1:nv(new_system_graph)
        if inneighbors(new_system_graph, node) == inneighbors(original_system_graph, node) && 
            (outneighbors(new_system_graph, node) != outneighbors(original_system_graph, node) || isempty(outneighbors(original_system_graph, node)))
             # Check if the node is in the sources list
             belief_dict[node] = (node in sources ? node_Priors[node] : update_node_belief(belief_dict, link_reliability, new_system_graph, node))
     
             children = [c for c in outneighbors(original_system_graph, node)]
             for child in children
                 if inneighbors(new_system_graph, child) == inneighbors(original_system_graph, child) && isempty(outneighbors(original_system_graph, child))
                     belief_dict[child] = update_node_belief(belief_dict, link_reliability, new_system_graph, child)
                 else
                     append!(edgepairs, [(node, child) for child in children])
                 end
             end

            # Update ancestors
            for parent in inneighbors(original_system_graph, node)
                if !haskey(ancestors_dict, node)
                    ancestors_dict[node] = Set{Int}()
                end
                push!(ancestors_dict[node], parent)
                if haskey(ancestors_dict, parent)
                    ancestors_dict[node] = union(ancestors_dict[node], ancestors_dict[parent])
                end
            end

             # Check if the node is a join node
            if indegree(original_system_graph, node) > 1
                fork_ancestors = filter(x -> x ∉ sources && outdegree(original_system_graph, x) > 1, ancestors_dict[node])
                for fork in fork_ancestors
                    paths = find_all_paths_iterative(fork, node, Matrix(adjacency_matrix(original_system_graph)), ancestors_dict[node])
                    # Combine and expand paths if more than one path is found
                    if length(paths) > 1
                        combined_path = combine_and_expand_paths(paths, Matrix(adjacency_matrix(original_system_graph)), fork)
                        all_paths_dict[(fork, node)] = [combined_path]  # Wrap combined_path in another vector
                    end
                end
            end
        end

    end
    return belief_dict, edgepairs, ancestors_dict, all_paths_dict
end

function update_node_belief(belief_dict, link_reliability,new_system_graph, node)
    messages_from_parents = [ 1 - (belief_dict[parent]* link_reliability) for parent in inneighbors(new_system_graph, node)] #message is failure probability of parent
    updated_belief =  1 - prod(messages_from_parents)
    return updated_belief
end

function update_graph(new_system_graph,edgepairs)
    for edge in edgepairs 
       
        add_edge!(new_system_graph,edge)
    end
    empty!(edgepairs) # Clear the edgepairs list after updating the graph
end










function MC_result(original_system_graph,system_matrix,link_reliability,sources,N=100000)
    edge_pairs=Tuple.(edges(original_system_graph));
    active_count=zeros(nv(original_system_graph));
    
    for i in 1:N
        MC_mat= zero(system_matrix);
        MonteCarlo_Network_Graph= DiGraph(MC_mat)
        
        for edge in 1:length(edge_pairs)            
            if rand(Bernoulli(link_reliability))
            add_edge!(MonteCarlo_Network_Graph,edge_pairs[edge][1],edge_pairs[edge][2])
            end
        end
   
        for node in 1:nv(MonteCarlo_Network_Graph)        
            if node in sources 
                active_count[node]= 1.0
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
   return  active_count ./ N
end
end #end module

import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions

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



# Read system data and create the graph
#system_data = readdlm("csvfiles/KarlNetwork.csv", ',', header= false, Int)
#system_data = readdlm("csvfiles/Shelby county gas.csv", ',', header= false, Int)
system_data = readdlm("csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv", ',', header= false, Int)
system_matrix = Matrix(DataFrame(system_data, :auto))
system_graph = DiGraph(system_matrix)

w,x,y,z = Information_Propagation.reliability_propagation(system_matrix, findSources(system_matrix), 0.9);

using JSON


# Open a file for writing
output_file = open("output.json", "w")

# Create a pretty-printed JSON string with indentation and newlines
json_string = JSON.json(z, 4)  # Use the second argument to specify the indentation level

# Write the pretty-printed JSON string to the file
write(output_file, json_string)

# Close the file
close(output_file)
