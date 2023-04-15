module DiamondCheckModuleMatrix
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

end # DiamondCheckModule end
