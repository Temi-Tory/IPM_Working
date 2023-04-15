module InformationPropagation
 #todo: Can we introdue and exploit parralelisim in julia. For eg: Have optional agruments 
   #todo: can we put in a chck first to check the sparsisty of the graph and then decide if we want to use the sparse matrix or Adjacecy list 
   
    function update_belief(original_graph::Dict{Int64, Vector{Int64}}, new_graph::Dict{Int64, Vector{Int64}}, link_reliability::Float64, node_Priors::Float64, sources::Vector{Int64}, belief_dict::Dict{Int64, Float64})
    
        function get_inneighbors(graph::Dict{Int64, Vector{Int64}}, node::Int64)
            inneighbors = Int64[]
            for (n, outneighbors) in graph
                if node in outneighbors
                    push!(inneighbors, n)
                end
            end
            return inneighbors
        end

        function get_outneighbors(graph::Dict{Int64, Vector{Int64}}, node::Int64)
            return get(graph, node, Int64[])
        end

        for node in keys(original_graph) #for every node in graph
            if !isempty(get_inneighbors(new_graph, node)) || node in sources
                belief_dict[node] = if node in sources node_Priors else update_node_belief(belief_dict, link_reliability, new_graph, node) end
            end
    
            children = get_outneighbors(original_graph, node)
            for child in children
                if !haskey(new_graph, node) || child ∉ new_graph[node]
                    if haskey(new_graph, node)
                        push!(new_graph[node], child)
                    else
                        new_graph[node] = [child]
                    end
                end
            end
        end
        return belief_dict
    end         #end function update_belief
    
    function update_node_belief(belief_dict::Dict{Int64, Float64}, link_reliability::Float64,new_graph::Dict{Int64, Vector{Int64}}, node::Int64)
        function get_inneighbors(graph::Dict{Int64, Vector{Int64}}, node::Int64)
            inneighbors = Int64[]
            for (n, outneighbors) in graph
                if node in outneighbors
                    push!(inneighbors, n)
                end
            end
            return inneighbors
        end
        messages_from_parents = [ 1 - (belief_dict[parent]* link_reliability) for parent in  get_inneighbors(new_graph,node) ] #message is failure probability of parent
        updated_belief =  1 - prod(messages_from_parents)
        return updated_belief
    end

    function reliability_propagation(original_graph::Dict{Int64, Vector{Int64}}, sources::Vector{Int64}, link_reliability::Float64, node_Priors::Float64)
        
        new_graph = Dict{Int64, Vector{Int64}}()
        belief_dict = Dict{Int64, Float64}()
        belief_dict = Dict(node => (node in sources ? node_Priors : 0.0) for node in keys(original_graph))


        graph_changed = true

        while graph_changed
            graph_changed = false
            prev_graph = deepcopy(new_graph)
            belief_dict = update_belief(original_graph, new_graph, link_reliability, node_Priors, sources, belief_dict)

            for node in keys(new_graph)
                if !haskey(prev_graph, node) || sort(new_graph[node]) != sort(prev_graph[node])
                    graph_changed = true
                    break
                end
            end
        end
        return update_belief(original_graph, new_graph, link_reliability, node_Priors, sources, belief_dict)
            
    end   

end #module end



