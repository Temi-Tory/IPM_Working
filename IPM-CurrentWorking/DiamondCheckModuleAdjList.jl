module DiamondCheckModuleAdjList
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
end #module end DiamondCheckModuleAdjList
