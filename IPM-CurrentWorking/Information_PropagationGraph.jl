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
                        else  append!(edgepairs,[(node,child) for child in children]) 
                        end
                end
        end   
   
    end    
    return belief_dict,edgepairs
end

function update_graph(new_system_graph,edgepairs)
    for edge in edgepairs        
        
        caused, diamondedgepairs = causes_diamond(graph_to_adj_list(new_system_graph),edge)
        if caused
            println("Diamond detected. Edge: $(edge) forms the path $(diamondedgepairs)")
        end
        add_edge!(new_system_graph,edge)
    end
end

function reliability_propagation(system_matrix,sources,link_reliability,node_Priors)
    original_system_graph= DiGraph(system_matrix)
    new_system_graph = DiGraph(zero(system_matrix));
    belief_dict=Dict(); edgepairs=[]; terminating_nodes=[]; #f = Figure(); structure_count=0;

    while new_system_graph != original_system_graph
        belief_dict,edgepairs = update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs)
        update_graph(new_system_graph,edgepairs)
        #structure_count = structure_count + 1;
        #intermediate_structure_update(new_system_graph,f,structure_count)
    end

   #= terminating_nodes = [if isempty(outneighbors(new_system_graph,node)) node end for node in 1:nv(new_system_graph)] #identify terminating nodes #
    for t_node in terminating_nodes
        belief_dict[t_node] = update_node_belief(belief_dict, link_reliability,new_system_graph, t_node);
    end
    =#
    
    belief_dict[nv(new_system_graph)] = 1-prod([ 1- (belief_dict[parent]*link_reliability) for parent in inneighbors(new_system_graph, nv(new_system_graph))]);

    Node_Reliability=sort(collect(pairs(belief_dict)), by=x->x[1]);

    return new_system_graph,Node_Reliability        

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

function Visualize_System(Network_Graph,sources,layout=0)
    if layout==0
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

    else
        f, ax, p= graphplot(Network_Graph, layout=layout,
                arrow_size=[25 for i in 1:ne(Network_Graph)],
                arrowcolor  = "pink",
                nlabels= repr.(1:nv(Network_Graph)),
                edge_width = [3 for i in 1:ne(Network_Graph)],
                node_color=[if i in sources "blue" else "pink"  end for i in 1:nv(Network_Graph)  ], #Use colours to identify sink vs source nodes                                      
                node_size=[20 for i in 1:nv(Network_Graph) ])
                ax.yreversed = true 
                hidedecorations!(ax)  # hides ticks, grid and lables 
                hidespines!(ax)  # hide the frame 
    end
    return f, ax, p
end

function moral_graph(G)
    H = Graph(G)    #Convert directed Graphs to undirected 
    for node in 1:nv(G)
        predecessors_combinations = subsets(inneighbors(G,node), Val{2}())
        for preds in predecessors_combinations
            add_edge!(H,preds) #Add edge between any two parents that have a common child
        end
    end
    return H    
end




function graph_to_adj_list(graph::DiGraph)
    adj_list = Dict{Int64, Vector{Int64}}()
    for node in 1:nv(graph)
        adj_list[node] = outneighbors(graph, node)
    end
    adj_list
end

function causes_diamond(original_graph::Dict{Int64, Vector{Int64}}, edge::Tuple{Int64, Int64})
    # Add the edge to the adjacency list
    if haskey(original_graph, edge[1])
        push!(original_graph[edge[1]], edge[2])
    else
        original_graph[edge[1]] = [edge[2]]
    end 

    # Run the has_diamond_subgraph function to check for diamonds
    has_diamond, diamond_paths = has_diamond_subgraph(original_graph)

    # If a diamond is found, return true and the diamond subgraph
    if has_diamond
        return true, diamond_paths
    else
        return false, nothing
    end
end
function is_fork(node::Int64, original_graph::Dict{Int64, Vector{Int64}})
    return number_of_outgoing_edges(node, original_graph) > 1 && number_of_incoming_edges(node, original_graph) > 0
end

function is_join(node::Int64, original_graph::Dict{Int64, Vector{Int64}})
    return number_of_incoming_edges(node, original_graph) > 1
end

function number_of_incoming_edges(node::Int64, original_graph::Dict{Int64, Vector{Int64}})
    return count(node in values(original_graph[i]) for i in keys(original_graph))
end

function number_of_outgoing_edges(node::Int64, original_graph::Dict{Int64, Vector{Int64}})
    return length(get(original_graph, node, Int64[]))
end

function get_children(node::Int64, original_graph::Dict{Int64, Vector{Int64}})
    return filter(x -> x != 0, get(original_graph, node, Int64[]))
end

function has_diamond_subgraph(original_graph::Dict{Int64, Vector{Int64}})
    
    all_diamond_paths = Vector{Vector{Tuple{Int64, Int64}}}()

    for node in keys(original_graph)
        if is_fork(node, original_graph)
            visited_nodes = Vector{Int64}()
            diamond_paths = find_diamond_path(node, visited_nodes, original_graph)
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

function find_diamond_path(node::Int64, visited_nodes::Vector{Int64}, original_graph::Dict{Int64, Vector{Int64}})
    diamond_edgepaths = Vector{Vector{Tuple{Int64, Int64}}}()
    if node in visited_nodes
        return diamond_edgepaths
    end

    push!(visited_nodes, node)

    for child_node in get_children(node, original_graph)
        if is_join(child_node, original_graph)
            # Found the join node; add it to the path and return
            push!(diamond_edgepaths, [(node, child_node)])
        else
            # Recurse on child nodes
            child_paths = find_diamond_path(child_node, visited_nodes, original_graph)
            for path in child_paths
                if path[1][1] == node
                    # Add current edge to existing path
                    push!(path, (node, child_node))
                    push!(diamond_edgepaths, path)
                else
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
end #end module

