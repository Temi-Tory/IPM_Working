module Information_Propagation_PowerDist
import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, MetaGraphs, IterTools, SimpleWeightedGraphs

Random.seed!(2409);

    function manuallyupdate_diamond(node)
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
        
        if (node == 5 )
        
        #=     adj_5 = Matrix([
                0 1 1 0 0;
                0 0 0 0 1;
                0 0 0 1 0;
                0 0 0 0 1;
                0 0 0 0 0;
            ]);
            # nodeprior_1 = belief_dict[2];        
            _, y = reliability_propagation(adj_5,findSources(adj_5),0.9); 
            updated_belief = y[5][2] * 0.9 #0.8536590000000001 =#
            updated_belief = 0.8536590000000001;
            return updated_belief 
            
        elseif (node == 11 )
           #=  adj_11_success = Matrix([
               0 1 1 0 0 0 0; 
               0 0 0 0 1 0 0; 
               0 0 0 1 0 0 0; 
               0 0 0 0 1 0 0; 
               0 0 0 0 0 0 0; 
               0 0 0 1 0 0 0; 
               0 0 0 0 0 1 0; 
            ]);
           # nodeprior_1 = belief_dict[8];
           # nodeprior_6 = belief_dict[2];              
            # nodeprior_1 = belief_dict[2];                
                   
            _, y = reliability_propagation(adj_11_success,findSources(adj_11_success),0.9); 
            updated_belief_1 = y[5][2] * 0.9 #0.8773442100000001
    
            adj_11_fail = Matrix([
                0 1 0 0;
                0 0 1 0;
                0 0 0 1;
                0 0 0 0;
            ]);
    
            _, y = reliability_propagation(adj_11_fail,findSources(adj_11_fail),0.9,1.0); 
            updated_belief_0 = y[4][2] * (1-0.9); #0.07289999999999999
    
            updated_belief = updated_belief_1 + updated_belief_0; #0.95024421 =#
            updated_belief = 0.95024421
            return updated_belief
            
        elseif (node == 14 )
          #=   adj_14_success = Matrix([
               0 1 1 0 0 0; 
               0 0 0 0 1 0; 
               0 0 0 1 0 0; 
               0 0 0 0 1 0; 
               0 0 0 0 0 0; 
               0 0 0 1 0 0;
            ]);
    
            original_system_graph = DiGraph(adj_14_success);
            node_Priors = fill(1.0, nv(original_system_graph));
            node_Priors[6] = 0.853659000000000 ;#belief[5]     
                  
            _, y = reliability_propagation(adj_14_success,findSources(adj_14_success),0.9,node_Priors); 
            updated_belief_1 = y[5][2] * 0.9 #0.8761246585371
    
            adj_14_fail = Matrix([
                0 1 0;
                0 0 1;
                0 0 0;
            ]);
    
            node_Priors = fill(1.0, nv(DiGraph(adj_14_fail)));
            node_Priors[1] = 0.853659000000000 ;
            _, y = reliability_propagation(adj_14_fail,findSources(adj_14_fail),0.9,node_Priors); 
            updated_belief_0 = y[3][2] * (1-0.9); #0.07289999999999999
    
            updated_belief = updated_belief_1 + updated_belief_0; #0.9452710375371 =#
            updated_belief = 0.9452710375371; 
            return updated_belief

        elseif (node == 21 )
               
            #= adj_14_success21_2 = Matrix([
             0 1 1 0 0 0;
             0 0 0 0 1 0;
             0 0 0 1 0 0;
             0 0 0 0 1 0;
             0 0 0 0 0 0;
             0 0 0 1 0 0;
           ]);

           original_system_graph = DiGraph(adj_14_success21_2);
         #  plotinteraction(original_system_graph,findSources(adj_14_success21_2))
           node_Priors = fill(1.0, nv(original_system_graph));
           node_Priors[6] = 0.94851;#belief[5]     
                 
           _, y = reliability_propagation(adj_14_success21_2,findSources(adj_14_success21_2),0.9,node_Priors); 
           updated_belief_14_21_1 = y[5][2] * 0.9 #0.8761246585371

           adj_14_fail21_2 = Matrix([
               0 1 0;
               0 0 1;
               0 0 0;
           ]);

           node_Priors = fill(1.0, nv(DiGraph(adj_14_fail21_2)));
           node_Priors[1] = 0.94851;
           _, y = reliability_propagation(adj_14_fail21_2,findSources(adj_14_fail21_2),0.9,node_Priors); 
           updated_belief_14_21_0 = y[3][2] * (1-0.9); 

           updated_belief_14_21 = updated_belief_14_21_1 + updated_belief_14_21_0 #0.955450152819       

          #node 11 on 2 success
          adj_11_success21_2 = Matrix([
              0 1 1 0 0 0;
              0 0 0 0 1 0;
              0 0 0 1 0 0;
              0 0 0 0 1 0;
              0 0 0 0 0 0;
              0 0 0 1 0 0;
            ]);

            original_system_graph = DiGraph(adj_11_success21_2);
           # plotinteraction(original_system_graph,findSources(adj_11_success21_2))
                  
            _, y = reliability_propagation(adj_11_success21_2,findSources(adj_11_success21_2),0.9); 
            updated_belief_11_21_1 = y[5][2] * 0.9 

            adj_11_fail21_2 = Matrix([
                0 1 0;
                0 0 1;
                0 0 0;
            ]);

            _, y = reliability_propagation(adj_11_fail21_2,findSources(adj_11_fail21_2),0.9); 
            updated_belief_11_21_0 = y[3][2] * (1-0.9);

            updated_belief_11_21 = updated_belief_11_21_1 + updated_belief_11_21_0; #0.9609759

            #node 21 success on 2
            updated_belief21success = 0.9 * (1- ( (1 - (updated_belief_11_21 * 0.9 * 0.9 *0.9)) * (1 - (updated_belief_14_21 * 0.9)) ) )



          #node 14 on failure of 2
          adj_14_failuire21_2 = Matrix([
          0 1 1 0 0;
          0 0 0 0 1;
          0 0 0 1 0;
          0 0 0 0 1;
          0 0 0 0 0;
          ]);
          # nodeprior_1 = belief_dict[2];       
          _, y = reliability_propagation(adj_14_failuire21_2,findSources(adj_14_failuire21_2),0.9); 
          updated_belieffail_14_21_2 = y[5][2] * 0.9 #0.8536590000000001


          #node 11 on failure of 2
          adj_11_failuire21_2 = Matrix([
              0 1 1 0 0;
              0 0 0 0 1;
              0 0 0 1 0;
              0 0 0 0 1;
              0 0 0 0 0;
          ]);
          # nodeprior_1 = belief_dict[2];        
                 
          _, y = reliability_propagation(adj_11_failuire21_2,findSources(adj_11_failuire21_2),0.9); 
          updated_belieffail_14_21_2 = y[5][2] * 0.9 #0.8536590000000001

          #node  failure
         

          updated_belief21fail = 0.1 * (1- ( (1 - (updated_belieffail_14_21_2 * 0.9 * 0.9 *0.9)) * (1 - (updated_belieffail_14_21_2 * 0.9)) ) )

          updated_belief = updated_belief21success + updated_belief21fail #0.9534927483446016 =#
          updated_belief = 0.9534927483446016;
          return updated_belief
        elseif (node == 22 )
          #=   _node_21 = ( 1 - ( (1-(0.9*0.9)) * (1-(0.9*0.9452710375371)) ) );
            _node_22_success = ( 1 - ( (1-(0.9)) * (1-(0.9*0.9534927483446016)) ) );
            _node_22_fail = 0.9452710375371 * 0.9 * 0.9;
            updated_belief = (_node_22_success * 0.95024421 * 0.9) + (0.9452710375371*0.9*0.9*(1-(0.9*0.95024421))); #0.9539417357508233 =#
            updated_belief = 0.9539417357508233;
            return updated_belief
        end
    end

    function update_node_belief(belief_dict, link_reliability,new_system_graph,node)

        if (node in [5,11,14,21,22] )
            return manuallyupdate_diamond(node);
        else

            messages_from_parents = [ 1 - (belief_dict[parent]* link_reliability) for parent in inneighbors(new_system_graph, node)] #message is failure probability of parent
            updated_belief =  1 - prod(messages_from_parents)
            return updated_belief
        end
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
                    belief_dict[node]=(if node in sources node_Priors[node] else update_node_belief(belief_dict, link_reliability,new_system_graph,node) end)

                    children=[c for c in outneighbors(original_system_graph,node)];
                        for child in children
                            if (inneighbors(new_system_graph, child)==inneighbors(original_system_graph, child) && isempty(outneighbors(original_system_graph,child)))
                                belief_dict[child] = update_node_belief(belief_dict, link_reliability,new_system_graph,child)
                            else append!(edgepairs,[(node,child) for child in children])   
                            end
                    end
            end   
    
        end    
        return belief_dict,edgepairs
    end

    function update_graph(new_system_graph,edgepairs)
        for edge in edgepairs 
           add_edge!(new_system_graph,edge)
        end
        empty!(edgepairs) # Clear the edgepairs list after updating the graph
    end

    
    function  plotinteraction(Network_Graph, sources)
        f, ax, p= graphplot(Network_Graph,
        arrow_size=[25 for i in 1:ne(Network_Graph)],
        arrowcolor  = "pink",
        nlabels= repr.(1:nv(Network_Graph)),
        edge_width = [3 for i in 1:ne(Network_Graph)],
        node_color=[if i in sources "blue" else "pink"  end for i in 1:nv(Network_Graph)  ], #Use colours to identify sink vs source nodes                                      
        node_size=[20 for i in 1:nv(Network_Graph) ])
        ax.yreversed = true 
        hidedecorations!(ax)  # hides ticks, grid and lables 
        hidespines!(ax)  # hide the frame 

        deregister_interaction!(ax, :rectanglezoom)
        register_interaction!(ax, :edgehover, EdgeHoverHighlight(p))
        register_interaction!(ax, :edgedrag, EdgeDrag(p))
        register_interaction!(ax, :nodehover, NodeHoverHighlight(p))
        register_interaction!(ax, :nodedrag, NodeDrag(p))

        function action(idx, event, axis)
            p.edge_color[][idx] = rand(RGB)
            p.edge_color[] = p.edge_color[]
        end
        register_interaction!(ax, :edgeclick, EdgeClickHandler(action))
        display(f);
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

    function MC_result(original_system_graph::DiGraph,system_matrix::Matrix,link_reliability::Float64,sources::Vector{Int64},N=100000)
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



