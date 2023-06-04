module Information_Propagation

import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, MetaGraphs, IterTools, IncrementalInference,SimpleWeightedGraphs
using GraphMakie.NetworkLayout 
CairoMakie.activate!()

Random.seed!(2409);


    function update_node_belief(belief_dict, link_reliability,new_system_graph, node)
        messages_from_parents = [ 1 - (belief_dict[parent]* link_reliability) for parent in inneighbors(new_system_graph, node)] #message is failure probability of parent
        updated_belief =  1 - prod(messages_from_parents)
        return updated_belief
    end

    function update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs)
        for node in 1:nv(new_system_graph) #for every node in graph       
            if (
                    inneighbors(new_system_graph, node)==inneighbors(original_system_graph, node) 
                    && 
                    ( 
                        (outneighbors(new_system_graph, node) != outneighbors(original_system_graph, node)) || isempty(outneighbors(original_system_graph,node)) 
                    )
                ) 
                    belief_dict[node]=(if node in sources node_Priors else update_node_belief(belief_dict, link_reliability,new_system_graph, node) end)

                    children=[c for c in outneighbors(original_system_graph,node)];
                        for child in children
                            if (inneighbors(new_system_graph, child)==inneighbors(original_system_graph, child) && isempty(outneighbors(original_system_graph,child)))
                                belief_dict[child] = update_node_belief(belief_dict, link_reliability,new_system_graph, child)
                            else append!(edgepairs,[(node,child) for child in children])   
                            end
                    end
            end   
    
        end    
        return belief_dict,edgepairs
    end

    function update_graph(new_system_graph,edgepairs)
        for edge in edgepairs 
            caused, causedDiamond = causes_diamond(adjacency_matrix(new_system_graph), edge)
            if caused && !(isempty(causedDiamond)) && !has_edge(new_system_graph,edge)
               println("Diamond subgraph detected Edge: $edge forms the diamond: $causedDiamond")
            end
            add_edge!(new_system_graph,edge)
        end
        empty!(edgepairs) # Clear the edgepairs list after updating the graph
    end

    function reliability_propagation(system_matrix,sources,link_reliability,node_Priors)

        
        original_system_graph= DiGraph(system_matrix)
        new_system_graph = DiGraph(zero(system_matrix));
        belief_dict=Dict(); edgepairs=[]; terminating_nodes=[]; #f = Figure(); structure_count=0;

        while new_system_graph != original_system_graph
            belief_dict,edgepairs = update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs)
            update_graph(new_system_graph,edgepairs);
            #=
            plotinteraction(new_system_graph, sources);
            has_diamond_subgraph(adjacency_matrix(new_system_graph))
            =#
            
            #structure_count = structure_count + 1;
            #intermediate_structure_update(new_system_graph,f,structure_count)
        end

        #= terminating_nodes = [if isempty(outneighbors(new_system_graph,node)) node end for node in 1:nv(new_system_graph)] #identify terminating nodes #
        for t_node in terminating_nodes
            belief_dict[t_node] = update_node_belief(belief_dict, link_reliability,new_system_graph, t_node);
        end
        =#

        belief_dict,edgepairs = update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs)
       # belief_dict[nv(new_system_graph)] = 1-prod([ 1- (belief_dict[parent]*link_reliability) for parent in inneighbors(new_system_graph, nv(new_system_graph))]);

        Node_Reliability=sort(collect(pairs(belief_dict)), by=x->x[1]);

        return new_system_graph,Node_Reliability        

    end




    function find_diamond_path(node, visited_nodes, adj_matrix)
        diamond_edgepaths = Vector{Vector{Tuple{Int64, Int64}}}()
        if node in visited_nodes
            return diamond_edgepaths
        end

        push!(visited_nodes, node)

        for child_node in get_children(node, adj_matrix)
            if is_join(child_node, adj_matrix)
                # Found the join node; add it to the path and return
                push!(diamond_edgepaths, [(node, child_node)])
            else
                # Recurse on child nodes
                child_paths = find_diamond_path(child_node, visited_nodes, adj_matrix)
                for path in child_paths
                    if path[1][1] == node
                        # Add current edge to existing path
                        push!(path, (node, child_node))
                        push!(diamond_edgepaths, path)
                    elseif isempty(path) || path[end][2] != child_node
                        # Create new path
                        new_path = [(node, child_node)]
                        append!(new_path, path)
                        push!(diamond_edgepaths, new_path)
                    end
                end
            end
        end

        # Remove the current node from visited_nodes before returning to allow other paths to be explored
        filter!(visited_node -> visited_node != node, visited_nodes)

        return diamond_edgepaths
    end

    function remove_invalid_paths(diamond_edgepaths)
        valid_paths = Vector{Vector{Tuple{Int64, Int64}}}()
        for path in diamond_edgepaths
            valid = true
            if length(path) > 1
                fork_node = path[1][1]
                join_node = path[end][2]
                for i in 1:length(path) - 1
                    edge = path[i]
                    if edge[1] == join_node || edge[2] == fork_node
                        valid = false
                        break
                    end
                end
            else
                valid = false
            end
            if valid
                push!(valid_paths, path)
            end
        end
        return valid_paths
    end

    function is_join(node, adj_matrix)
        return number_of_incoming_edges(node, adj_matrix) > 1
    end

    function get_children(node, adj_matrix)
        return findall(x -> x != 0, adj_matrix[node, :])
    end

    function causes_diamond(adj_matrix, edge)
        # Add the edge to the adjacency matrix
        adj_matrix[edge[1], edge[2]] = 1

        # Run the has_diamond_subgraph function to check for diamonds
        has_diamond, diamond_paths = has_diamond_subgraph(adj_matrix)

        # If a diamond is found, return true and the diamond subgraph
        if has_diamond
            return true, diamond_paths
        else
            return false, nothing
        end
    end

    function has_diamond_subgraph(adj_matrix)
        all_diamond_paths = Vector{Vector{Tuple{Int64, Int64}}}()

        for node in 1:size(adj_matrix, 1)
            if is_fork(node, adj_matrix)
                visited_nodes = Vector{Int64}()
                diamond_paths = find_diamond_path(node, visited_nodes, adj_matrix)
                diamond_paths = remove_invalid_paths(diamond_paths)
                if !isempty(diamond_paths)
                    diamond_group = reduce(vcat, diamond_paths)
                    push!(all_diamond_paths, diamond_group)
                end
            end
        end

        if !isempty(all_diamond_paths)
            return true, all_diamond_paths
        else
            return false, nothing
        end
    end

    function is_fork(node, adj_matrix)
        return number_of_outgoing_edges(node, adj_matrix) > 1 && number_of_incoming_edges(node, adj_matrix) > 0
    end

    function number_of_incoming_edges(node, adj_matrix)
        return count(x -> x != 0, adj_matrix[:, node])
    end

    function number_of_outgoing_edges(node, adj_matrix)
        return count(x -> x != 0, adj_matrix[node, :])
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

