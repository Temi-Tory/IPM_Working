module DiamondCheckModuleMatrix
    # Define a function to find diamond-shaped paths in a graph
    function find_diamond_path(node, visited_nodes, adj_matrix)
        # Initialize an empty array to store the diamond edge paths
        diamond_edgepaths = Set{Vector{Tuple{Int64, Int64}}}()
        
        # If the node is already visited, return an empty array
        if node in visited_nodes
            return diamond_edgepaths
        end

        # Add the current node to the visited_nodes list
        push!(visited_nodes, node)

        # Iterate through the children of the current node
        for child_node in get_children(node, adj_matrix)
            # If the child_node is a join node, add it to the path and return
            if is_join(child_node, adj_matrix)
                push!(diamond_edgepaths, [(node, child_node)])
            else
                # Recursively call the function for the child_node
                child_paths = find_diamond_path(child_node, visited_nodes, adj_matrix)
                for path in child_paths
                    if path[1][1] == node
                        # Add the current edge to the existing path
                        push!(path, (node, child_node))
                        push!(diamond_edgepaths, path)
                    elseif isempty(path) || path[end][2] != child_node
                        # Create a new path with the current edge
                        new_path = [(node, child_node)]
                        append!(new_path, path)
                        push!(diamond_edgepaths, new_path)
                    end
                end
            end
        end

        # Remove the current node from visited_nodes to explore other paths
        filter!(visited_node -> visited_node != node, visited_nodes)

        # Return the list of diamond edge paths
        return diamond_edgepaths
    end

    # Define a function to remove invalid paths from the list of diamond edge paths
    function remove_invalid_paths(diamond_edgepaths)
        # Initialize an empty array to store valid paths
        valid_paths = Set{Vector{Tuple{Int64, Int64}}}()

        # Iterate through the diamond edge paths
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

    # Define a function to check if a node is a join node (has more than 1 incoming edge)
    function is_join(node, adj_matrix)
        return number_of_incoming_edges(node, adj_matrix) > 1
    end

    # Define a function to get the children of a node from the adjacency matrix
    function get_children(node, adj_matrix)
        return findall(x -> x != 0, adj_matrix[node, :])
    end

    # Define a function to check if adding an edge to the adjacency matrix causes a diamond subgraph
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

    # Define a function to check if the adjacency matrix has a diamond subgraph
    function has_diamond_subgraph(adj_matrix)
        all_diamond_paths = Set{Vector{Tuple{Int64, Int64}}}()

        # Iterate through all nodes in the adjacency matrix
        for node in 1:size(adj_matrix, 1)
            # If the node is a fork node, find diamond paths
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

        # If diamond paths are found, return true and the paths, otherwise return false and nothing
        if !isempty(all_diamond_paths)
            return true, all_diamond_paths
        else
            return false, nothing
        end
    end

    # Define a function to check if a node is a fork node (has more than 1 outgoing edge and at least 1 incoming edge)
    function is_fork(node, adj_matrix)
        return number_of_outgoing_edges(node, adj_matrix) > 1 && number_of_incoming_edges(node, adj_matrix) > 0
    end

    # Define a function to count the number of incoming edges for a node in the adjacency matrix
    function number_of_incoming_edges(node, adj_matrix)
        return count(x -> x != 0, adj_matrix[:, node])
    end

    # Define a function to count the number of outgoing edges for a node in the adjacency matrix
    function number_of_outgoing_edges(node, adj_matrix)
        return count(x -> x != 0, adj_matrix[node, :])
    end

end # DiamondCheckModule end



nodi = sparse([
    0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  1  0  0  1  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  1  0  0  1  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  1  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
    0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
]);
DiamondCheckModuleMatrix.has_diamond_subgraph(nodi)

plotinteraction(DiGraph(Matrix(nodi)), [1,3,13])


Test_Matrix=  sparse([
0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  1  0  0  1  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  1  0  0  1  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  1  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  1  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0;
]);


DiamondCheckModuleMatrix.has_diamond_subgraph(Test_Matrix)
