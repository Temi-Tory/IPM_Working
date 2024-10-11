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

function reliability_propagation(system_matrix,  link_reliability, node_Priors=[])
    original_system_graph = DiGraph(system_matrix)
    new_system_graph = DiGraph(zero(system_matrix))
    belief_dict = Dict{Int64, Float64}()
    edgepairs = []
    decomposedsystem_matrix = copy(system_matrix)
    ancestors_dict = Dict{Int, Set{Int}}()  # Dictionary to track ancestors
    all_paths_dict = Dict{Tuple{Int, Int}, Vector{Vector{Tuple{Int, Int}}}}()  # Updated to store edge paths

    if isempty(node_Priors)
        node_Priors = fill(1.0, nv(new_system_graph))
    end
    sources = findSources(system_matrix);

    while new_system_graph != original_system_graph
        belief_dict, edgepairs, ancestors_dict, all_paths_dict = update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs, ancestors_dict, all_paths_dict,decomposedsystem_matrix)
        update_graph(new_system_graph, edgepairs)
    end

    belief_dict, edgepairs, ancestors_dict, all_paths_dict = update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs, ancestors_dict, all_paths_dict,decomposedsystem_matrix)
   
    Node_Reliability = sort(collect(pairs(belief_dict)), by=x->x[1])

    return new_system_graph, Node_Reliability, ancestors_dict, all_paths_dict
end

function modify_adj_matrix(fork::Int, join::Int, adj_matrix::Array{Int, 2}, edge_paths::Vector{Vector{Tuple{Int, Int}}}, link_reliability::Dict{Tuple{Int64, Int64}, Float64}, newLinkReliability::Float64)
    # Remove edges in the edge paths from the adjacency matrix
    for edge_path in edge_paths
        for (u, v) in edge_path
            adj_matrix[u, v] = 0
        end
    end
    

    return adj_matrix
end

function find_incoming_nodes(node::Int, adj_matrix::Matrix{Int})
    num_nodes = size(adj_matrix, 1)
    incoming_nodes = Int[]

    for i in 1:num_nodes
        if adj_matrix[i, node] == 1
            push!(incoming_nodes, i)
        end
    end

    return incoming_nodes
end

function find_diamond_paths_iterative(fork::Int, join::Int, adj_matrix::Array{Int, 2}, 
    ancestors::Set{Int})::Vector{Vector{Tuple{Int, Int}}}

    # Create a copy of the ancestors set and include the join node itself
    ancestorsInclusive = copy(ancestors)
    if join ∉ ancestorsInclusive
     push!(ancestorsInclusive, join)
    end

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

        # Extract nodes from each edge in the combined edge path
        nodes_in_path = [node for edge in combined_edge_path for node in edge]

        # Get the unique list of nodes
        uniquelistofnodes = unique(nodes_in_path)
        for node in uniquelistofnodes
            if node != fork
                for incommingNeighbour in findall(adj_matrix[:, node] .== 1)
                    if (incommingNeighbour, node) ∉ combined_edge_path
                        push!(combined_edge_path, (incommingNeighbour, node))
                    end
                end        
            end
        end

        return [combined_edge_path]

    else
        # Return an empty vector if there is only one distinct path
        return Vector{Vector{Tuple{Int, Int}}}()
    end
end

function convert_paths_to_adj_matrix_with_reliability(fork::Int64, join::Int64, edge_paths::Vector{Vector{Tuple{Int, Int}}}, link_reliability::Dict{Tuple{Int64, Int64}, Float64}, node_priors::Vector{Float64})
    nodes = Set{Int}()
    new_edges = Set{Tuple{Int, Int}}()
    new_link_reliability = Dict{Tuple{Int64, Int64}, Float64}()

    # Extract unique nodes and edges
    for path in edge_paths
        for edge in path
            push!(nodes, edge[1])
            push!(nodes, edge[2])
            push!(new_edges, edge)
        end
    end

    # Create node mapping
    sorted_nodes = sort(collect(nodes))
    node_mapping = Dict{Int, Int}(original => new for (new, original) in enumerate(sorted_nodes))

    # Check if fork and join nodes are present and different
    if !(fork in nodes && join in nodes && fork != join)
        error("Fork and/or join node not found in the unique nodes, or they are the same")
    end

    # Create a new adjacency matrix and node priors vector
    num_nodes = length(nodes)
    adj_matrix = zeros(Int, num_nodes, num_nodes)
    new_node_priors = fill(1.0, num_nodes)  # Default priors

    # Populate the adjacency matrix, map reliabilities and node priors
    for (original_u, original_v) in new_edges
        u, v = node_mapping[original_u], node_mapping[original_v]
        adj_matrix[u, v] = 1
        if haskey(link_reliability, (original_u, original_v))
            new_link_reliability[(u, v)] = link_reliability[(original_u, original_v)]
        end
        if original_u in keys(node_priors)
            new_node_priors[u] = node_priors[original_u]
        end
        if original_v in keys(node_priors)
            new_node_priors[v] = node_priors[original_v]
        end
    end

    # Get new indices for fork and join
    new_fork_index = node_mapping[fork]
    new_join_index = node_mapping[join]
    reverse_node_mapping = Dict{Int, Int}(new => original for (original, new) in node_mapping)

    return adj_matrix, new_link_reliability, new_node_priors, new_fork_index, new_join_index, reverse_node_mapping, node_mapping
end

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

function  updateDiamondJoin(fork::Int64, join::Int64, diamondPath::Vector{Vector{Tuple{Int, Int}}}, link_reliability::Dict{Tuple{Int64, Int64}, Float64}, node_priors::Vector{Float64} ,originalBelifDict::Dict{Int64,Float64})

    diamondadj_matrix,diamondlinkrelibaility,diamond_node_priors,forkIndex,joinIndex,newtooldMapping,oldtonewmapping=convert_paths_to_adj_matrix_with_reliability(fork,join,diamondPath,link_reliability,node_priors);

    #For success 
    belief_fork_diamond = originalBelifDict[fork]; # in this case will be originalbeleifDict[fork]
    diamond_node_priors[forkIndex]=1.0 
    diamondSources = findSources(diamondadj_matrix);
    for source in diamondSources
        if source != forkIndex
            
            diamond_node_priors[source] = originalBelifDict[newtooldMapping[source]]
        end
    end
    
    a,b = reliability_propagation(diamondadj_matrix,diamondlinkrelibaility,diamond_node_priors) ###include node priros in this when pligged back into algo 
    successbeilf = b[joinIndex][2] 
    
    
    #For failure 
    diamond_node_priors[forkIndex]=0.0 
    c,d = reliability_propagation(diamondadj_matrix,diamondlinkrelibaility,diamond_node_priors)  ###include node priros in this when pligged back into algo 
    failurebeilf = d[joinIndex][2] 
    
    actualbeliftobeupdatedofjoinode = (successbeilf * belief_fork_diamond) + (failurebeilf * (1-belief_fork_diamond))
    return actualbeliftobeupdatedofjoinode
end

function update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs, ancestors_dict, all_paths_dict, decomposedsystem_matrix)
    for node in 1:nv(new_system_graph)
        if inneighbors(new_system_graph, node) == inneighbors(original_system_graph, node) && 
            (outneighbors(new_system_graph, node) != outneighbors(original_system_graph, node) || isempty(outneighbors(original_system_graph, node)))
             # Check if the node is in the sources list
            if node in sources
                belief_dict[node] = node_Priors[node]
            else
                decomposedsystem_matrix, belief_dict[node] = update_node_belief(belief_dict, link_reliability, new_system_graph, node, node_Priors,original_system_graph,ancestors_dict,decomposedsystem_matrix,sources,all_paths_dict)
            end

             children = [c for c in outneighbors(original_system_graph, node)]
             for child in children
                 if inneighbors(new_system_graph, child) == inneighbors(original_system_graph, child) && isempty(outneighbors(original_system_graph, child))
                    decomposedsystem_matrix,  belief_dict[child] = update_node_belief(belief_dict, link_reliability, new_system_graph, child, node_Priors,original_system_graph,ancestors_dict,decomposedsystem_matrix,sources,all_paths_dict)
                 else
                     append!(edgepairs, [(node, child) for child in children])
                 end
             end

            

        end
    end
    return belief_dict, edgepairs, ancestors_dict, all_paths_dict, decomposedsystem_matrix
end

function update_node_belief(belief_dict, link_reliability, new_system_graph, node, node_Priors, 
    original_system_graph, ancestors_dict, decomposedsystem_matrix, sources, all_paths_dict)
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

    if indegree(original_system_graph, node) > 1
        fork_ancestors = filter(x -> x ∉ sources && outdegree(original_system_graph, x) > 1, ancestors_dict[node])
        for fork in fork_ancestors
            edge_paths = find_diamond_paths_iterative(fork, node, decomposedsystem_matrix, ancestors_dict[node])
            if !isempty(edge_paths)
                all_paths_dict[(fork, node)] = edge_paths
                belief_dict_node = updateDiamondJoin(fork, node, all_paths_dict[(fork, node)], link_reliability, node_Priors, belief_dict)
                decomposedsystem_matrix = modify_adj_matrix(fork, node, decomposedsystem_matrix, edge_paths, link_reliability, belief_dict_node)
                new_system_graph= DiGraph(decomposedsystem_matrix);
                ne(new_system_graph);#todo: remove this line 
                return decomposedsystem_matrix, belief_dict_node
            end
        end
    end

    # Regular belief update for non-diamond join nodes
    combined_reliability_from_parents = [belief_dict[parent] * link_reliability[(parent, node)] for parent in inneighbors(new_system_graph, node)]
    reliability_from_parents = 1 - prod(1 .- combined_reliability_from_parents)
    nodePrior = node_Priors[node]
    updated_belief = (nodePrior == 1.0) ? 1 - (1 - reliability_from_parents) : 1 - (1 - nodePrior) * (1 - reliability_from_parents)
    
    # Return unmodified decomposedsystem_matrix along with updated belief
    return decomposedsystem_matrix, updated_belief
end

function update_graph(new_system_graph,edgepairs)
    for edge in edgepairs 
       
        add_edge!(new_system_graph,edge)
    end
    empty!(edgepairs) # Clear the edgepairs list after updating the graph
end










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

end #end module


