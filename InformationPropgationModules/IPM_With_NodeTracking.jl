module Information_Propagation

import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, MetaGraphs, IterTools, SimpleWeightedGraphs
using GraphMakie.NetworkLayout 
CairoMakie.activate!()

struct EdgePair
    from::Int
    to::Int
end

Random.seed!(2409);

function reliability_propagation(system_matrix, sources, link_reliability, node_Priors=[])
    original_system_graph = DiGraph(system_matrix)
    new_system_graph = DiGraph(zero(system_matrix))
    belief_dict = Dict()
    edgepairs = []
    decomposedsystem_matrix = copy(system_matrix)
    ancestors_dict = Dict{Int, Set{Int}}()  # Dictionary to track ancestors
    all_paths_dict = Dict{Tuple{Int, Int}, Vector{Vector{Tuple{Int, Int}}}}()  # Updated to store edge paths

    if isempty(node_Priors)
        node_Priors = fill(1.0, nv(new_system_graph))
    end

    while new_system_graph != original_system_graph
        belief_dict, edgepairs, ancestors_dict, all_paths_dict = update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs, ancestors_dict, all_paths_dict,decomposedsystem_matrix)
        update_graph(new_system_graph, edgepairs)
    end

    belief_dict, edgepairs, ancestors_dict, all_paths_dict = update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs, ancestors_dict, all_paths_dict,decomposedsystem_matrix)

    Node_Reliability = sort(collect(pairs(belief_dict)), by=x->x[1])

    return new_system_graph, Node_Reliability, ancestors_dict, all_paths_dict
end

function modify_adj_matrix(fork::Int, join::Int, adj_matrix::Array{Int, 2}, edge_paths::Vector{Vector{Tuple{Int, Int}}})
    # Remove edges in the edge paths from the adjacency matrix
    for edge_path in edge_paths
        for (u, v) in edge_path
            adj_matrix[u, v] = 0
        end
    end

    # Add an edge from the fork node to the join node
    adj_matrix[fork, join] = 1

    return adj_matrix
end

function find_diamond_paths_iterative(fork::Int, join::Int, adj_matrix::Array{Int, 2}, ancestors::Set{Int})::Vector{Vector{Tuple{Int, Int}}}
   # Create a copy of the ancestors set and include the join node itself
    ancestorsInclusive = copy(ancestors)
    push!(ancestorsInclusive, join)

    # Initialize an empty vector to store all paths and a queue for BFS
    all_edge_paths = Vector{Vector{Tuple{Int, Int}}}()
    queue = [(fork, [])]  # Start with an empty edge path

    # Iterate until the queue is empty
    while !isempty(queue)
        current, edge_path = popfirst!(queue)

        # If the current node is the join node, add the edge path to all_edge_paths
        if current == join
           push!(all_edge_paths, edge_path)
            continue
        end

        # Explore all next nodes from the current node
        for next_node in findall(adj_matrix[current, :] .== 1)
            # Add the edge to the path if the next node is an ancestor
            if next_node in ancestorsInclusive && (adj_matrix[current, next_node] == 1) && (current, next_node) ∉ edge_path
                new_edge_path = [edge_path; (current, next_node)]
                push!(queue, (next_node, new_edge_path))
            end
        end
    end
    
    # Check if there are more than one distinct paths
    if length(all_edge_paths) > 1
        # Combine all distinct edge paths into one edge path
        combined_edge_path = unique(vcat(all_edge_paths...))

        # Include additional incoming edges to non-fork nodes in the combined path
        for node in unique([edge[2] for edge in combined_edge_path if edge[1] != fork])
            for in_node in findall(adj_matrix[:, node] .== 1)
                if in_node != fork && (in_node, node) ∉ combined_edge_path && adj_matrix[in_node, node] == 1
                  push!(combined_edge_path, (in_node, node))
                end
            end
        end
        return [combined_edge_path]

    else
        # Return an empty vector if there is only one distinct path
        return Vector{Vector{Tuple{Int, Int}}}()
    end
end

function update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs, ancestors_dict, all_paths_dict, decomposedsystem_matrix)
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
                    # Use decomposedsystem_matrix instead of original_system_graph
                    edge_paths = find_diamond_paths_iterative(fork, node, decomposedsystem_matrix, ancestors_dict[node])
                    # Store the edge paths if any are found
                    if !isempty(edge_paths)
                        all_paths_dict[(fork, node)] = edge_paths
                        # Update the decomposed adjacency matrix
                        decomposedsystem_matrix = modify_adj_matrix(fork, node, decomposedsystem_matrix, edge_paths)
                    end
                end
            end
        end
    end
    return belief_dict, edgepairs, ancestors_dict, all_paths_dict, decomposedsystem_matrix
end

function update_node_belief(belief_dict, link_reliability,new_system_graph, node)
    messages_from_parents = [ 1 - (belief_dict[parent]* link_reliability[EdgePair(parent, node)]) for parent in inneighbors(new_system_graph, node)] #message is failure probability of parent
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
