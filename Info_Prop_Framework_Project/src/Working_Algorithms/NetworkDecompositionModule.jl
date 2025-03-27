module NetworkDecompositionModule
    export AncestorGroup, GroupedDiamondStructure, DiamondSubgraph
    
    struct DiamondSubgraph
        relevant_nodes::Set{Int64}
        sources::Set{Int64}
        edgelist::Vector{Tuple{Int64, Int64}}
        iteration_sets::Vector{Set{Int64}}
        outgoing::Dict{Int64, Set{Int64}}
        incoming::Dict{Int64, Set{Int64}}
        descendants::Dict{Int64, Set{Int64}}
        ancestors::Dict{Int64, Set{Int64}}
    end

    # Represents a single ancestor group pattern within a diamond
    mutable struct AncestorGroup
        # All ancestors in this group
        ancestors::Set{Int64}
        # Parents influenced by this ancestor group
        influenced_parents::Set{Int64}
        # Nodes from this group in the highest iteration set
        highest_nodes::Set{Int64}

        subgraph:: DiamondSubgraph
    end

    struct GroupedDiamondStructure
        # Diamond pattern groups
        diamond::Vector{AncestorGroup}
        # Parents that aren't part of any diamond pattern
        non_diamond_parents::Set{Int64}
        # The join node where paths converge
        join_node::Int64
    end

    

    function extract_and_filter_ancestor_groups!(
        ancestor_groups::Vector{AncestorGroup},
        join_node::Int64,
        edgelist::Vector{Tuple{Int64, Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        iteration_sets::Vector{Set{Int64}},
        source_nodes::Set{Int64} 
    )
        isempty(ancestor_groups) && return
    
        # Create a new vector to store the expanded groups
        expanded_groups = Vector{AncestorGroup}()
        
        # For each original group, create separate groups for each highest node
        for group in ancestor_groups
            for fork_node in group.highest_nodes
                # Create a single-node highest_nodes set for this fork node
                single_highest = Set{Int64}([fork_node])
                
                # Create a temporary ancestor group with just this highest node
                temp_group = AncestorGroup(
                    group.ancestors,
                    group.influenced_parents,
                    single_highest,
                    DiamondSubgraph(  # Empty/default subgraph
                        Set{Int64}(), Set{Int64}(), Vector{Tuple{Int64, Int64}}(),
                        Vector{Set{Int64}}(), Dict{Int64,Set{Int64}}(),
                        Dict{Int64,Set{Int64}}(), Dict{Int64,Set{Int64}}(),
                        Dict{Int64,Set{Int64}}()
                    )
                )
                
                # Extract subgraphs for this specific fork node - now returns vector of results
                result_tuples = extract_diamondsubgraph(
                    temp_group,
                    fork_node,
                    join_node,
                    edgelist,
                    ancestors,
                    descendants,
                    incoming_index,
                    iteration_sets,
                    source_nodes
                )
                
                # For each returned result tuple, create a new AncestorGroup
                for (new_ancestors, new_influenced_parents, new_highest_nodes, new_subgraph) in result_tuples
                    new_group = AncestorGroup(
                        new_ancestors,
                        new_influenced_parents,
                        new_highest_nodes,
                        new_subgraph
                    )
                    
                    push!(expanded_groups, new_group)
                end
            end
        end
        
        # Replace original groups with the expanded set
        empty!(ancestor_groups)
        append!(ancestor_groups, expanded_groups)
        
        # Filter out redundant groups
        groups_to_remove = Set{AncestorGroup}()
        for (i, group1) in enumerate(ancestor_groups)
            for (j, group2) in enumerate(ancestor_groups)
                i >= j && continue  # Skip self-comparison and duplicates
                
                edges1 = Set(group1.subgraph.edgelist)
                edges2 = Set(group2.subgraph.edgelist)
                
                if issubset(edges1, edges2)
                    push!(groups_to_remove, group1)
                elseif issubset(edges2, edges1)
                    push!(groups_to_remove, group2)
                end
            end
        end
        
        # Remove redundant groups
        filter!(g -> g ∉ groups_to_remove, ancestor_groups)
        
        # Safety check - we should always have at least one group left
        if isempty(ancestor_groups)
            error("Invalid state: All ancestor groups were filtered out for join node $join_node")
        end
    end
    
    function identify_and_group_diamonds(
        join_nodes::Set{Int64},
        ancestors::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        source_nodes::Set{Int64},
        fork_nodes::Set{Int64},
        iteration_sets::Vector{Set{Int64}},
        edgelist::Vector{Tuple{Int64, Int64}},
        descendants::Dict{Int64, Set{Int64}}
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
                
                non_diamond_parents = Set(parents)
                filtered_parents = filter(parent -> parent ∉ source_nodes, parents)
                
                parent_fork_ancestors = Dict(
                    parent => intersect(setdiff(ancestors[parent], source_nodes), fork_nodes)
                    for parent in filtered_parents
                )
                
                ancestor_groups = Vector{AncestorGroup}()
                
                ancestor_to_parents = Dict{Int64, Set{Int64}}()
                for (parent, ancs) in parent_fork_ancestors
                    for ancestor in ancs
                        if !haskey(ancestor_to_parents, ancestor)
                            ancestor_to_parents[ancestor] = Set{Int64}()
                        end
                        push!(ancestor_to_parents[ancestor], parent)
                    end
                end
                
                parents_to_ancestors = Dict{Set{Int64}, Set{Int64}}()
                for (ancestor, influenced_parents) in ancestor_to_parents
                    length(influenced_parents) < 2 && continue
                    
                    parent_set = influenced_parents
                    if !haskey(parents_to_ancestors, parent_set)
                        parents_to_ancestors[parent_set] = Set{Int64}()
                    end
                    push!(parents_to_ancestors[parent_set], ancestor)
                    setdiff!(non_diamond_parents, parent_set)
                end
    
                for (parent_set, ancestor_set) in parents_to_ancestors
                    highest_nodes = find_highest_iteration_nodes(ancestor_set, iteration_sets)
                    
                    # Create the initial group without subgraph
                    group = AncestorGroup(
                        ancestor_set,     
                        parent_set,       
                        highest_nodes,     
                        DiamondSubgraph(  # Empty/default subgraph that will be replaced
                            Set{Int64}(), Set{Int64}(), Vector{Tuple{Int64, Int64}}(),
                            Vector{Set{Int64}}(), Dict{Int64,Set{Int64}}(),
                            Dict{Int64,Set{Int64}}(), Dict{Int64,Set{Int64}}(),
                            Dict{Int64,Set{Int64}}()
                        )
                    )
                    push!(ancestor_groups, group)
                end
                
                if !isempty(ancestor_groups)
                    # Extract subgraphs and filter redundant groups
                    extract_and_filter_ancestor_groups!(
                        ancestor_groups,
                        join_node,
                        edgelist,
                        ancestors,
                        descendants,
                        incoming_index,
                        iteration_sets,
                        source_nodes
                    )
                    
                    # After filtering, create the final structure
                    grouped_structures[join_node] = GroupedDiamondStructure(
                        ancestor_groups,
                        non_diamond_parents,
                        join_node
                    )
                end
            end
        end
        
        return grouped_structures
    end   
    
    function collect_base_nodes(fork_node::Int64, join_node::Int64, ancestor_group)::Set{Int64}
        return union(
            Set([fork_node]),
            ancestor_group.influenced_parents,
            Set([join_node])
        )
    end
    
    function add_intermediate_nodes!(relevant_nodes::Set{Int64}, 
                                   fork_node::Int64,
                                   ancestor_group,
                                   descendants::Dict{Int64, Set{Int64}},
                                   ancestors::Dict{Int64, Set{Int64}})
        for parent in ancestor_group.influenced_parents
            parent_intermediates = intersect(
                descendants[fork_node],
                ancestors[parent]
            )
            union!(relevant_nodes, parent_intermediates)
        end
    end
    
    function extract_edges(relevant_nodes::Set{Int64}, 
                          fork_node::Int64,
                          edgelist::Vector{Tuple{Int64, Int64}})
        sub_edgelist = Vector{Tuple{Int64, Int64}}()
        
        for edge in edgelist
            if edge[1] in relevant_nodes && edge[2] in relevant_nodes && edge[2] != fork_node
                push!(sub_edgelist, edge)
            end
        end
        
        return sub_edgelist
    end
    
    function handle_additional_nodes!(relevant_nodes::Set{Int64},
                                    sub_sources::Set{Int64},
                                    fork_node::Int64,
                                    join_node::Int64,
                                    incoming_index::Dict{Int64, Set{Int64}})
        sub_edgelist = Vector{Tuple{Int64, Int64}}()
        
        additional_nodes = Set{Int64}()
        for node in relevant_nodes
            if node != fork_node && node != join_node
                incoming_nodes = incoming_index[node]
                new_incoming_nodes = setdiff(incoming_nodes, relevant_nodes)
                
                if !isempty(new_incoming_nodes)
                    union!(additional_nodes, new_incoming_nodes)
                    union!(sub_sources, new_incoming_nodes)
                    
                    for new_node in new_incoming_nodes
                        push!(sub_edgelist, (new_node, node))
                    end
                end
            end
        end
        
        if !isempty(additional_nodes)
            union!(relevant_nodes, additional_nodes)
        end
        
        return sub_edgelist
    end
    
    function build_graph_indices(sub_edgelist::Vector{Tuple{Int64, Int64}})
        sub_outgoing = Dict{Int64, Set{Int64}}()
        sub_incoming = Dict{Int64, Set{Int64}}()
        
        for (source, dest) in sub_edgelist
            if !haskey(sub_outgoing, source)
                sub_outgoing[source] = Set{Int64}()
            end
            push!(sub_outgoing[source], dest)
    
            if !haskey(sub_incoming, dest)
                sub_incoming[dest] = Set{Int64}()
            end
            push!(sub_incoming[dest], source)
        end
        
        return sub_outgoing, sub_incoming
    end
    
    function calculate_ancestry(sub_edgelist::Vector{Tuple{Int64, Int64}})
        sub_descendants = Dict{Int64, Set{Int64}}()
        sub_ancestors = Dict{Int64, Set{Int64}}()
    
        for (source, dest) in sub_edgelist
            if !haskey(sub_descendants, source)
                sub_descendants[source] = Set{Int64}()
            end
            push!(sub_descendants[source], dest)
        
            if !haskey(sub_ancestors, dest)
                sub_ancestors[dest] = Set{Int64}()
            end
            push!(sub_ancestors[dest], source)
        end
        
        return sub_descendants, sub_ancestors
    end
    
    function extract_diamondsubgraph(
        ancestor_group::AncestorGroup, 
        fork_node::Int64,
        join_node::Int64,
        edgelist::Vector{Tuple{Int64, Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        iteration_sets::Vector{Set{Int64}},
        source_nodes::Set{Int64}
    )::Vector{Tuple{Set{Int64}, Set{Int64}, Set{Int64}, DiamondSubgraph}}
        # Vector to store results
        results = Vector{Tuple{Set{Int64}, Set{Int64}, Set{Int64}, DiamondSubgraph}}()
        
        # Initialize sources and collect base nodes
        sub_sources = Set{Int64}([fork_node])
        relevant_nodes = collect_base_nodes(fork_node, join_node, ancestor_group)
        
        # Build subgraph step by step
        add_intermediate_nodes!(relevant_nodes, fork_node, ancestor_group, descendants, ancestors)
        
        sub_edgelist = extract_edges(relevant_nodes, fork_node, edgelist)
        
        additional_edgelist = handle_additional_nodes!(
            relevant_nodes, sub_sources, fork_node, join_node, incoming_index
        )
        append!(sub_edgelist, additional_edgelist)
    
        # Collect all additional sources but exclude original sources
        additional_sources = Set{Int64}([edge[1] for edge in additional_edgelist if edge[1] != fork_node && edge[1] ∉ source_nodes])
        
        # Check for common ancestors between additional sources and the ancestor group
        if !isempty(additional_sources)
            # Gather all potential common ancestors
            common_ancestors = Set{Int64}()
            
            for source in additional_sources
                # Check if source is directly in ancestors
                if source in ancestor_group.ancestors
                    push!(common_ancestors, source)
                end
                
                # Check for shared ancestors
                if haskey(ancestors, source)
                    shared = intersect(ancestors[source], ancestor_group.ancestors)
                    union!(common_ancestors, shared)
                end
            end
            
            # Filter out original source nodes (node 18)
            common_ancestors = setdiff(common_ancestors, source_nodes)
            
            if !isempty(common_ancestors)
                # Find the earliest iteration
                earliest_iter = typemax(Int)
                earliest_ancestors = Set{Int64}()
                
                for node in common_ancestors
                    node_iter = find_iteration_index(node, iteration_sets)
                    if node_iter !== nothing
                        if node_iter < earliest_iter
                            earliest_iter = node_iter
                            earliest_ancestors = Set{Int64}([node])
                        elseif node_iter == earliest_iter
                            push!(earliest_ancestors, node)
                        end
                    end
                end
                
                # Create separate diamonds for each common ancestor in the earliest iteration
                if !isempty(earliest_ancestors)
                    for common_ancestor in earliest_ancestors
                        # Create a copy of the ancestor group for this specific ancestor
                        new_ancestors = copy(ancestor_group.ancestors)
                        new_influenced_parents = copy(ancestor_group.influenced_parents)
                        
                        # Set the new fork_node
                        current_fork = common_ancestor
                        current_highest = Set{Int64}([current_fork])
                        current_sources = Set{Int64}([current_fork])
                        
                        # Rebuild diamond subgraph for this specific ancestor
                        current_nodes = collect_base_nodes(current_fork, join_node, ancestor_group)
                        add_intermediate_nodes!(current_nodes, current_fork, ancestor_group, descendants, ancestors)
                        current_edgelist = extract_edges(current_nodes, current_fork, edgelist)
                        
                        current_additional = handle_additional_nodes!(
                            current_nodes, current_sources, current_fork, join_node, incoming_index
                        )
                        current_edgelist = union(current_edgelist, current_additional)
                        
                        # Create filtered iteration sets
                        current_iter_sets = [intersect(set, current_nodes) for set in iteration_sets]
                        filter!(!isempty, current_iter_sets)
                        
                        # Build graph structures
                        current_outgoing, current_incoming = build_graph_indices(current_edgelist)
                        current_descendants, current_ancestors = calculate_ancestry(current_edgelist)
                        
                        # Create the diamond for this specific ancestor
                        current_diamond = DiamondSubgraph(
                            current_nodes,
                            current_sources,
                            current_edgelist,
                            current_iter_sets,
                            current_outgoing,
                            current_incoming,
                            current_descendants,
                            current_ancestors
                        )
                        
                        # Add this result to the vector
                        push!(results, (new_ancestors, new_influenced_parents, current_highest, current_diamond))
                    end
                    
                    # Return all the results if we created new diamonds
                    if !isempty(results)
                        return results
                    end
                end
            end
        end
    
        # If no common ancestors found, create the original diamond
        sub_iteration_sets = [intersect(set, relevant_nodes) for set in iteration_sets]
        filter!(!isempty, sub_iteration_sets)
        
        # Build graph structures
        sub_outgoing, sub_incoming = build_graph_indices(sub_edgelist)
        sub_descendants, sub_ancestors = calculate_ancestry(sub_edgelist)
        
        # Create the original diamond
        original_diamond = DiamondSubgraph(
            relevant_nodes,
            sub_sources,
            sub_edgelist,
            sub_iteration_sets,
            sub_outgoing,
            sub_incoming,
            sub_descendants,
            sub_ancestors
        )
        
        # Add the original result
        push!(results, (ancestor_group.ancestors, ancestor_group.influenced_parents, Set{Int64}([fork_node]), original_diamond))
        
        return results
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
    function find_iteration_index(node::Int64, iteration_sets::Vector{Set{Int64}})
        for (i, iter_set) in enumerate(iteration_sets)
            if node in iter_set
                return i
            end
        end
        return nothing
    end
    
end