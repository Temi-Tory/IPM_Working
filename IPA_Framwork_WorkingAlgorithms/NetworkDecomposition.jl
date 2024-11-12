module NetworkDecomposition

    # Represents a single ancestor group pattern within a diamond
    struct AncestorGroup
        # All ancestors in this group
        ancestors::Set{Int64}
        # Parents influenced by this ancestor group
        influenced_parents::Set{Int64}
        # Nodes from this group in the highest iteration set
        highest_nodes::Set{Int64}
    end

    struct GroupedDiamondStructure
        # Diamond pattern groups
        diamond::Vector{AncestorGroup}
        # Parents that aren't part of any diamond pattern
        non_diamond_parents::Set{Int64}
        # The join node where paths converge
        join_node::Int64
    end

    function identify_and_group_diamonds(
        join_nodes::Set{Int64},
        ancestors::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        source_nodes::Set{Int64},
        fork_nodes::Set{Int64},
        iteration_sets::Vector{Set{Int64}}
        )::Dict{Int64, GroupedDiamondStructure}
        
        grouped_structures = Dict{Int64, GroupedDiamondStructure}()
        
        nodes_by_layer = Dict{Int64, Set{Int64}}()
        for (layer_idx, nodes) in enumerate(iteration_sets)
            layer_joins = intersect(nodes, join_nodes)
            if !isempty(layer_joins)
                nodes_by_layer[layer_idx] = layer_joins
            end
        end

        for (layer_idx, layer_joins) in nodes_by_layer
            for join_node in layer_joins
                parents = incoming_index[join_node]
                length(parents) < 2 && continue
                
                # Track all parents initially as non-diamond
                non_diamond_parents = Set(parents)
                
                # Filter out source nodes from parents
                filtered_parents = filter(parent -> parent ∉ source_nodes, parents)
                
                # Get fork ancestors for each filtered parent
                parent_fork_ancestors = Dict(
                    parent => intersect(setdiff(ancestors[parent], source_nodes), fork_nodes)
                    for parent in filtered_parents
                )
                
                # Create ancestor groups for this join node
                ancestor_groups = Vector{AncestorGroup}()
                
                # First, build a map of ancestor -> influenced parents
                ancestor_to_parents = Dict{Int64, Set{Int64}}()
                for (parent, ancs) in parent_fork_ancestors
                    for ancestor in ancs
                        if !haskey(ancestor_to_parents, ancestor)
                            ancestor_to_parents[ancestor] = Set{Int64}()
                        end
                        push!(ancestor_to_parents[ancestor], parent)
                    end
                end
                
                # Then group ancestors by their identical parent influence patterns
                parents_to_ancestors = Dict{Set{Int64}, Set{Int64}}()
                for (ancestor, influenced_parents) in ancestor_to_parents
                    # Only consider ancestors that influence multiple parents
                    length(influenced_parents) < 2 && continue
                    
                    parent_set = influenced_parents
                    if !haskey(parents_to_ancestors, parent_set)
                        parents_to_ancestors[parent_set] = Set{Int64}()
                    end
                    push!(parents_to_ancestors[parent_set], ancestor)
                    
                    # Remove these parents from non_diamond_parents as they're part of a diamond
                    setdiff!(non_diamond_parents, parent_set)
                end

                # Convert each pattern into an AncestorGroup
                for (parent_set, ancestor_set) in parents_to_ancestors
                    # Find highest iteration nodes for this ancestor set
                    highest_nodes = find_highest_iteration_nodes(ancestor_set, iteration_sets)
                    
                    # Create and add the ancestor group
                    group = AncestorGroup(
                        ancestor_set,     # all ancestors
                        parent_set,       # influenced parents
                        highest_nodes     # highest iteration nodes
                    )
                    push!(ancestor_groups, group)
                end
                
                # Only create structure if we found valid diamond patterns
                if !isempty(ancestor_groups)
                    grouped_structures[join_node] = GroupedDiamondStructure(
                        ancestor_groups,
                        non_diamond_parents,  # Include any non-diamond parents for completeness
                        join_node
                    )
                end
            end
        end
        
        return grouped_structures
    end

    """
        Find highest iteration set containing any of the given nodes
        Returns all nodes that appear in the highest iteration
    """
    function find_highest_iteration_nodes(nodes::Set{Int64}, iteration_sets::Vector{Set{Int64}})::Set{Int64}
        highest_iter = -1
        highest_nodes = Set{Int64}()
        
        # First find the highest iteration
        for (iter, set) in enumerate(iteration_sets)
            intersect_nodes = intersect(nodes, set)
            if !isempty(intersect_nodes)
                highest_iter = max(highest_iter, iter)
            end
        end
        
        # Then collect all nodes from that iteration
        if highest_iter > 0
            highest_nodes = intersect(nodes, iteration_sets[highest_iter])
        end
        
        return highest_nodes
    end
end