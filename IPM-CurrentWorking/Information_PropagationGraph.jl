module Information_Propagation

import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, MetaGraphs, IterTools, SimpleWeightedGraphs
using GraphMakie.NetworkLayout 
CairoMakie.activate!()

Random.seed!(2409);


    function update_node_belief(belief_dict, link_reliability,new_system_graph, node)
        messages_from_parents = [ 1 - (belief_dict[parent]* link_reliability) for parent in inneighbors(new_system_graph, node)] #message is failure probability of parent
        updated_belief =  1 - prod(messages_from_parents)
        return updated_belief
    end

   function update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs)
    for node in 1:nv(new_system_graph) #for every node in graph       
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
        end
    end    
    return belief_dict, edgepairs
end

    function update_graph(new_system_graph,edgepairs)
        for edge in edgepairs 
           
            add_edge!(new_system_graph,edge)
        end
        empty!(edgepairs) # Clear the edgepairs list after updating the graph
    end

    function reliability_propagation(system_matrix,sources,link_reliability,node_Priors=[])

        
        original_system_graph= DiGraph(system_matrix)
        new_system_graph = DiGraph(zero(system_matrix));
        belief_dict=Dict(); edgepairs=[]; terminating_nodes=[]; #f = Figure(); structure_count=0;

        if (node_Priors == [])
            node_Priors = fill(1.0, nv(new_system_graph));
        end
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








    function MC_result(original_system_graph,system_matrix,link_reliability,sources,N=100000)
        edge_pairs=Tuple.(edges(original_system_graph));
        active_count=zeros(nv(original_system_graph));
        
        for i in 1:N
            MC_mat= zero(system_matrix);
            MonteCarlo_Network_Graph= DiGraph(MC_mat)
            
            for edge in eachindex(edge_pairs)            
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

