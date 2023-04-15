module  Network_Manager
using Random, Graphs, GraphMakie, CairoMakie, MetaGraphs,Distributions
using GraphMakie.NetworkLayout 
function Set_Up(Network_Graph,Sources)     
 
    f, ax, p = graphplot(Network_Graph, layout=SquareGrid(),
                        arrow_size=[25 for i in 1:ne(Network_Graph)],
                        nlabels= repr.(1:nv(Network_Graph)),    
                                                                     
                        node_color=[if i in Sources "blue" else "pink"  end for i in 1:nv(Network_Graph)  ], #Use colours to identify sink vs source nodes                                      
                        node_size=[20 for i in 1:nv(Network_Graph) ])
    ax.yreversed = true 
    hidedecorations!(ax)  # hides ticks, grid and lables 
    hidespines!(ax)  # hide the frame 
    return f, ax # Returns the figure and Axis for manipulating the generateed figure 
end 

function PrPm_Set_Up(Network_Graph, Original_Network_Graph,Sources)      
    
    f, ax, p = graphplot(Network_Graph, layout=SquareGrid(),
                        
                        arrow_size=[25 for i in 1:ne(Network_Graph)],                           
                        nlabels=[if i in Sources repr.(i)  elseif isempty(all_neighbors(Network_Graph, i))  "" else repr.(i) end  for i in 1:nv(Network_Graph) ],  #show node number if node has an edge                                         
                        node_color=[if i in Sources "blue" elseif isempty(all_neighbors(Network_Graph, i)) "white" else "pink" end for i in 1:nv(Network_Graph)  ], #Use colours to identify sink vs source nodes                                      
                        node_size=[20 for i in 1:nv(Network_Graph) ])
    hidedecorations!(ax)  # hides ticks, grid and lables 
    hidespines!(ax)  # hide the frame              
    ax.yreversed = true  
    
         

    return f # Returns the figure and Axis for manipulating the generateed figure 
end 

function Node_Type_Set_Up(Network_Graph, Original_Network_Graph,Sources)      
    f = Figure(); f[1,1] = ax = Axis(f)
    f[1,2] = original_ax = Axis(f)
    #set up figure 
     p = graphplot!(ax,Network_Graph; layout=SquareGrid(),
                        arrow_size=[25 for i in 1:ne(Network_Graph)],                           
                        nlabels=[if isempty(all_neighbors(Network_Graph, i))  "" elseif  all_neighbors(Network_Graph, i)==all_neighbors(Original_Network_Graph, i) "A" elseif inneighbors(Network_Graph, i)==inneighbors(Original_Network_Graph, i)  "B"   else "C" end  for i in 1:nv(Network_Graph) ],  #show node number if node has an edge                                         
                        node_color=[if i in Sources "blue" elseif isempty(all_neighbors(Network_Graph, i)) "white" else "pink" end for i in 1:nv(Network_Graph)  ], #Use colours to identify sink vs source nodes                                      
                        node_size=[20 for i in 1:nv(Network_Graph) ])
    hidedecorations!(ax)  # hides ticks, grid and lables 
    hidespines!(ax)  # hide the frame              
    ax.yreversed = true  
    
        
     original_p = graphplot!(original_ax,Original_Network_Graph; layout=SquareGrid(),
                        arrow_size=[25 for i in 1:ne(Original_Network_Graph)],
                        nlabels=repr.(1:nv(Original_Network_Graph)),    
                        node_color=[if i in Sources "blue" else "pink"  end for i in 1:nv(Original_Network_Graph)  ], #Use colours to identify sink vs source nodes                                      
                        node_size=[20 for i in 1:nv(Original_Network_Graph) ])
    hidedecorations!(original_ax)  # hides ticks, grid and lables 
    hidespines!(original_ax)  # hide the frame              
    original_ax.yreversed = true    

    return f # Returns the figure and Axis for manipulating the generateed figure 
end 

function MonteCarlo_Result(matrix,Sourses)    
    Original_Network_Graph= DiGraph(matrix)
    edge_pairs=Tuple.(edges(Original_Network_Graph))
    active_count=Vector{Union{Missing, Float64}}(missing, nv(Original_Network_Graph)); fill!(active_count,0.0)

    for i in 1:100000
        MC_mat= zero(matrix);
        MonteCarlo_Network_Graph= DiGraph(MC_mat)
        
        for edge in eachindex(edge_pairs)            
            if rand(Bernoulli(0.9))
            add_edge!(MonteCarlo_Network_Graph,edge_pairs[edge][1],edge_pairs[edge][2])
            end
        end
        
        for node in 1:nv(MonteCarlo_Network_Graph)        
            if node in Sourses 
            active_count[node]= missing
            else
            path_to_source=[has_path(MonteCarlo_Network_Graph,i,node) for i in Sourses]
            
                if any(path_to_source)
                    active_count[node]= active_count[node] + 1      
                      
                end 
            end
        end
    end
    return active_count ./ 100000
end 

function message_update(edge_pairs,m_x_g,n_g,Rₗ,S,Rₙ,matrix)
    MC_mat= matrix;
    for pair in  edge_pairs 
        α = pair[1]; β = pair[2];  
        γ= [ i for i in 1:nv(m_x_g) ];
        R_αβ = Rₗ;
            
        if inneighbors(m_x_g,α)==inneighbors(n_g,α) #if type B node 
        #=
          if length(all_neighbors(m_x_g,β))==0
          
            Pr_α = (if α in S Rₙ elseif  length(all_neighbors(m_x_g,α))>0 get_prop(m_x_g,α, :Pr_node) else Rₙ end); #set Pr(α)= Node reliability or updated marginal node reliability as applicable 
            #=
            Pr_γ = [if i in S Rₙ elseif length(all_neighbors(m_x_g,i))==0 missing else get_prop(m_x_g, i,:Pr_node) end for i in γ];
            Pr_γ = [if i in S || length(all_neighbors(m_x_g,i))==0  Rₙ else get_prop(m_x_g,i, :Pr_node) end for i in γ];    
            
            Pr_αγ=[if i in [α,β] missing elseif has_edge(m_x_g,α,i) get_prop(m_x_g,α,i,:Pr_edge) else Pr_α*Pr_γ[i] end for i in γ];
            =#

            updated_Pr_β = updated_Pr_αβ = Pr_α * R_αβ
              set_prop!(m_x_g,β,:Pr_node, updated_Pr_β)
              set_prop!(m_x_g,Edge(α,β),:Pr_edge, updated_Pr_αβ)
            #updated_Pr_γβ = Pr_αγ .* R_αβ
                #set_prop!(m_x_g,Edge(α,β),:Pr_other_nodes, updated_Pr_γβ)

            add_edge!(m_x_g,α,β)

          elseif length(all_neighbors(m_x_g,β))>0

            #=
            X₁ = [ max((Pr_αγ[i] + Pr_βγ[i] - Pr_γ[i]), (Pr_αβ + Pr_βγ[i] - Pr_β), (Pr_αγ[i] + Pr_αβ - Pr_α)) for i in γ]
            X₂ = [ min(Pr_αβ, Pr_βγ[i], Pr_αγ[i], (1 - Pr_α - Pr_β - Pr_γ[i] + Pr_αβ + Pr_βγ[i] + Pr_αγ[i])) for i in γ]
            X₃ = [ max((Pr_αβ * Pr_γ[i]), (Pr_αγ[i] * Pr_β), (Pr_βγ[i] * Pr_α)) for i in γ ]   
            X₄ = 
            =#

            Pr_α = (if α in S Rₙ elseif  length(all_neighbors(m_x_g,α))>0 get_prop(m_x_g,α, :Pr_node) else Rₙ end); #set Pr(α)= Node reliability or updated marginal node reliability as applicable 
            Pr_β = get_prop(m_x_g,β,:Pr_node);
              #=
            Pr_γ = [if i in S Rₙ elseif length(all_neighbors(m_x_g,i))==0 missing else get_prop(m_x_g, i,:Pr_node) end for i in γ];
            Pr_γ = [if i in S || length(all_neighbors(m_x_g,i))==0  Rₙ else get_prop(m_x_g,i, :Pr_node) end for i in γ];    
            
            Pr_αγ=[if i in [α,β] missing elseif has_edge(m_x_g,α,i) get_prop(m_x_g,α,i,:Pr_edge) else Pr_α*Pr_γ[i] end for i in γ];
            Pr_βγ=[if i in [α,β] missing elseif has_edge(m_x_g,β,i) get_prop(m_x_g,β,i,:Pr_edge) else Pr_β*Pr_γ[i] end for i in γ];
            =#
            Pr_αβ = Pr_α * Pr_β;
            
            updated_Pr_β =  Pr_β + ((Pr_α-Pr_αβ) * R_αβ)
              set_prop!(m_x_g,β,:Pr_node, updated_Pr_β)
            updated_Pr_αβ = Pr_αβ + ((Pr_α-Pr_αβ) * R_αβ)
              set_prop!(m_x_g,Edge(α,β),:Pr_edge, updated_Pr_αβ)
            #updated_Pr_βγ = Pr_βγ + ((Pr_αγ-X) .* R_αβ)
                #set_prop!(m_x_g,Edge(α,β),:Pr_other_nodes, updated_Pr_γβ)

              add_edge!(m_x_g,α,β)
          end 
          =#
          MC_mat[α,β]=1
        end     
        
    end
    return MC_mat
end



function test(matrix,Sourses)
    
    Original_Network_Graph= DiGraph(matrix)
    edge_pairs=Tuple.(edges(Original_Network_Graph))
    active_count=Vector{Union{Missing, Float64}}(missing, size(matrix,1)); fill!(active_count,0.0)

    
    for i in 1:5
        MC_mat= matrix;
        for edge in edge_pairs           
            if !(rand(Bernoulli(0.9)))
                MC_mat[edge[1],edge[2]]=0
            end
        end
        
        MonteCarlo_Network_Graph= DiGraph(MC_mat)

        for node in 1:size(matrix,1)       
            if node in Sourses 
            active_count[node]= missing
            else
            path_to_source=[has_path(MonteCarlo_Network_Graph,i,node) for i in Sourses]
            
                if any(path_to_source)
                    active_count[node]= active_count[node] + 1      
                      
                end 
            end
        end
    end
    return active_count 
end




end

