module NetworkDecompositionModule

    import ProbabilityBoundsAnalysis
        # Create aliases to avoid ambiguity
        const PBA = ProbabilityBoundsAnalysis
        # Type aliases for convenience
        const PBAInterval = ProbabilityBoundsAnalysis.Interval
        const pbox = ProbabilityBoundsAnalysis.pbox

        
        using ..InputProcessingModule 
    
        const Interval = InputProcessingModule.Interval

    export AncestorGroup, GroupedDiamondStructure, DiamondSubgraph
    
    mutable struct DiamondSubgraph
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

    mutable struct GroupedDiamondStructure
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
        
        merge_overlapping_diamonds!(
                ancestor_groups, 
                join_node, 
                iteration_sets,
                edgelist,
                ancestors,
                descendants,
                incoming_index
            )

            #for each group in ancestor_groups, check if any two or more sub_sources share an ancestor
            # NEW: Process shared subsources after merging diamonds
            process_shared_subsources!(
                ancestor_groups,
                join_node,
                ancestors,
                descendants,
                edgelist,
                iteration_sets,
                source_nodes
            )

            # for each ancestor group, get intermediate nodes, these are nodes in group's relevant_nodes that are not:
            #- in the ancestor group's highest nodes
            #- in the ancestor group's source nodes
            #- the join node
            for group in ancestor_groups
                # get the relevant nodes for this group
                intermediate_nodes = setdiff(
                    group.subgraph.relevant_nodes,
                    union(group.highest_nodes, group.subgraph.sources, Set([join_node]))
                )
                
                #check if any intermediate nodes are in the missing incoming edges from main graph compared to the subgraph
                missing_edges = Vector{Tuple{Int64, Int64}}()
                new_nodes = Set{Int64}()
                
                for node in intermediate_nodes
                    if haskey(incoming_index, node)
                        for src in incoming_index[node]
                            edge = (src, node)
                            if edge in edgelist && !(edge in group.subgraph.edgelist)
                                push!(missing_edges, edge)
                                push!(new_nodes, src)
                            end
                        end
                    end
                end
                
                # If found missing edges, update the subgraph
                if !isempty(missing_edges)
                    # Update relevant_nodes to include new source nodes
                    union!(group.subgraph.relevant_nodes, new_nodes)
                    
                    # Update sources with new nodes that have no incoming edges
                    for node in new_nodes
                        if !haskey(incoming_index, node) || isempty(incoming_index[node])
                            push!(group.subgraph.sources, node)
                        end
                    end
                    
                    # Update edgelist with missing edges
                    append!(group.subgraph.edgelist, missing_edges)
                    
                    # Rebuild iteration_sets
                    group.subgraph.iteration_sets = [intersect(set, group.subgraph.relevant_nodes) for set in iteration_sets]
                    filter!(!isempty, group.subgraph.iteration_sets)
                    
                    # Rebuild outgoing and incoming indices
                    group.subgraph.outgoing, group.subgraph.incoming = build_graph_indices(group.subgraph.edgelist)
                    
                    # Rebuild descendants and ancestors
                    group.subgraph.descendants, group.subgraph.ancestors = calculate_ancestry(group.subgraph.edgelist)
                end
            end
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
        descendants::Dict{Int64, Set{Int64}},        
        node_priors::Union{Dict{Int64,Float64}, Dict{Int64,pbox}, Dict{Int64,Interval}} ,
        excludedjoinNode::Int64 = -1,
    )::Dict{Int64, GroupedDiamondStructure}
        grouped_structures = Dict{Int64, GroupedDiamondStructure}()
        if excludedjoinNode != -1

            join_nodes = setdiff(join_nodes, Set([ excludedjoinNode ]))
        end
        
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
               # Find source nodes that are irrelevant (prior = 0 or 1) for diamond structure analysis
                first_key = first(keys(node_priors))
                if isa(node_priors[first_key], pbox)
                    irrelevant_sources = Set{Int64}()
                    for node in source_nodes
                        prior = node_priors[node]
                        # Check if mean bounds are exactly 0 or exactly 1
                        if (prior.ml == 0.0 && prior.mh == 0.0) || (prior.ml == 1.0 && prior.mh == 1.0)
                            push!(irrelevant_sources, node)
                        end
                    end
                    source_nodes = irrelevant_sources
                elseif isa(node_priors[first_key], Interval)
                    irrelevant_sources = Set{Int64}()
                    for node in source_nodes
                        prior = node_priors[node]
                        # Check if interval bounds are exactly [0,0] or exactly [1,1]
                        if (prior.lower == 0.0 && prior.upper == 0.0) || (prior.lower == 1.0 && prior.upper == 1.0)
                            push!(irrelevant_sources, node)
                        end
                    end
                    source_nodes = irrelevant_sources
                else
                    # Float64 case
                    source_nodes = Set(node for node in source_nodes if node_priors[node] == 0.0 || node_priors[node] == 1.0)
                end

                # Exclude irrelevant source nodes from parent consideration
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
                      join_node::Int64,
                      edgelist::Vector{Tuple{Int64, Int64}})
        sub_edgelist = Vector{Tuple{Int64, Int64}}()

      
        for edge in edgelist
            source, target = edge
            
            # Case 1: Outgoing edges from fork node
            if source == fork_node && target in relevant_nodes
                push!(sub_edgelist, edge)
            
            # Case 2: Incoming edges to join node (only if source is relevant)
            elseif target == join_node && source in relevant_nodes
                push!(sub_edgelist, edge)
            
            # Case 3: Incoming edges to intermediate nodes (regardless of source)
            elseif target in relevant_nodes && target != fork_node && target != join_node
                push!(sub_edgelist, edge)
                
            # Case 4: Other edges between relevant nodes
            elseif source in relevant_nodes && target in relevant_nodes
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
    function merge_overlapping_diamonds!(
        ancestor_groups::Vector{AncestorGroup}, 
        join_node::Int64,
        iteration_sets::Vector{Set{Int64}},
        edgelist::Vector{Tuple{Int64, Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}}
    )
        if length(ancestor_groups) <= 1
            return  # No need to merge if there's only one group
        end
        
        # Keep trying to merge until no more merges are possible
        merged_something = true
        while merged_something
            merged_something = false
            
            # Compare each pair of groups
            i = 1
            while i <= length(ancestor_groups)
                j = i + 1
                while j <= length(ancestor_groups)
                    group1 = ancestor_groups[i]
                    group2 = ancestor_groups[j]
                    
                    # Get relevant nodes excluding the join node
                    nodes1 = setdiff(group1.subgraph.relevant_nodes, Set([join_node]))
                    nodes2 = setdiff(group2.subgraph.relevant_nodes, Set([join_node]))
                    
                    # Check if they share any nodes
                    shared_nodes = intersect(nodes1, nodes2)
                    
                    if !isempty(shared_nodes)
                        # Find highest iteration node among shared nodes
                        highest_iter = -1
                        highest_shared_node = nothing
                        
                        for node in shared_nodes
                            node_iter = find_iteration_index(node, iteration_sets)
                            if node_iter !== nothing && node_iter > highest_iter
                                highest_iter = node_iter
                                highest_shared_node = node
                            end
                        end
                        
                        # Merge ancestors and influenced parents
                        merged_ancestors = union(group1.ancestors, group2.ancestors)
                        merged_influenced_parents = union(group1.influenced_parents, group2.influenced_parents)
                        
                        # Use the highest shared node as the new fork node
                        new_fork_node = highest_shared_node
                        if new_fork_node === nothing
                            # If no shared node with iteration found, use first highest node from either group
                            new_fork_node = first(union(group1.highest_nodes, group2.highest_nodes))
                        end
                        
                        # Create a temporary ancestor group structure
                        temp_group = AncestorGroup(
                            merged_ancestors,
                            merged_influenced_parents,
                            Set{Int64}([new_fork_node]),
                            DiamondSubgraph(Set{Int64}(), Set{Int64}(), Vector{Tuple{Int64, Int64}}(),
                                Vector{Set{Int64}}(), Dict{Int64,Set{Int64}}(),
                                Dict{Int64,Set{Int64}}(), Dict{Int64,Set{Int64}}(),
                                Dict{Int64,Set{Int64}}())
                        )
                        
                        # Rebuild the diamond from scratch with the new fork node
                        # Initialize sources and collect base nodes
                        sub_sources = Set{Int64}([new_fork_node])
                        relevant_nodes = collect_base_nodes(new_fork_node, join_node, temp_group)
                        
                        # Build subgraph step by step
                        add_intermediate_nodes!(relevant_nodes, new_fork_node, temp_group, descendants, ancestors)
                        
                        sub_edgelist = extract_edges(relevant_nodes, new_fork_node,join_node, edgelist)
                        
                        additional_edgelist = handle_additional_nodes!(
                            relevant_nodes, sub_sources, new_fork_node, join_node, incoming_index
                        )
                        append!(sub_edgelist, additional_edgelist)
                        
                        # Create filtered iteration sets
                        sub_iteration_sets = [intersect(set, relevant_nodes) for set in iteration_sets]
                        filter!(!isempty, sub_iteration_sets)
                        
                        # Build graph structures
                        sub_outgoing, sub_incoming = build_graph_indices(sub_edgelist)
                        sub_descendants, sub_ancestors_dict = calculate_ancestry(sub_edgelist)
                        
                        # Create the merged diamond
                        merged_diamond = DiamondSubgraph(
                            relevant_nodes,
                            sub_sources,
                            sub_edgelist,
                            sub_iteration_sets,
                            sub_outgoing,
                            sub_incoming,
                            sub_descendants,
                            sub_ancestors_dict
                        )
                        
                        # Replace group1 with merged group
                        ancestor_groups[i] = AncestorGroup(
                            merged_ancestors,
                            merged_influenced_parents,
                            Set{Int64}([new_fork_node]),
                            merged_diamond
                        )
                        
                        # Remove group2
                        deleteat!(ancestor_groups, j)
                        
                        merged_something = true
                        break  # Break inner loop as indices changed
                    else
                        j += 1
                    end
                end
                
                if merged_something
                    break  # Restart outer loop with new groups
                else
                    i += 1
                end
            end
        end
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
        
        sub_edgelist = extract_edges(relevant_nodes, fork_node,join_node, edgelist)
        
        additional_edgelist = handle_additional_nodes!(
            relevant_nodes, sub_sources, fork_node, join_node, incoming_index
        )
        append!(sub_edgelist, additional_edgelist)
        
        # NEW: Keep checking for common ancestors until none are found
        found_common_ancestors = false
        while true 
            # Collect all additional sources but exclude original sources
            additional_sources = Set{Int64}([edge[1] for edge in additional_edgelist if edge[1] != fork_node && edge[1] ∉ source_nodes])
            
            # Check for common ancestors between additional sources and the ancestor group
            if isempty(additional_sources)
                break  # No additional sources to check
            end
            
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
            
            # Filter out original source nodes 
            common_ancestors = setdiff(common_ancestors, source_nodes)
            
            if isempty(common_ancestors)
                break  # No common ancestors found
            end
            
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
            
            if isempty(earliest_ancestors)
                break  # No earliest ancestors found
            end
            
            # Found common ancestors, set the flag
            found_common_ancestors = true
            
            # Process the earliest ancestors (pick the first one for simplicity)
            common_ancestor = first(earliest_ancestors)
            
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
            current_edgelist = extract_edges(current_nodes, current_fork, join_node,edgelist)
            
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
            
            # Break the loop since we've found and processed common ancestors
            break
        end
        
        # If we found common ancestors, return the results
        if found_common_ancestors && !isempty(results)
            return results
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

    function process_shared_subsources!(
        ancestor_groups::Vector{AncestorGroup},
        join_node::Int64,
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        edgelist::Vector{Tuple{Int64, Int64}},
        iteration_sets::Vector{Set{Int64}},
        source_nodes::Set{Int64}
    )
        for group_idx in eachindex(ancestor_groups)
            group = ancestor_groups[group_idx]
            subgraph = group.subgraph
            
            # Keep processing until no more changes
            changed = true
            while changed
                changed = false
                
                # Get sources that aren't already in highest_nodes
                sources_to_check = setdiff(subgraph.sources, group.highest_nodes)
                
                if length(sources_to_check) >= 2
                    # Get ALL ancestors for each source - NOT just those in group.ancestors
                    source_ancestors = Dict{Int64, Set{Int64}}()
                    for source in sources_to_check
                        if haskey(ancestors, source)
                            # Don't filter by group.ancestors - get ALL ancestors
                            valid_ancestors = setdiff(ancestors[source], source_nodes)
                            source_ancestors[source] = valid_ancestors
                        end
                    end
                    
                    # Find shared ancestors between sources
                    shared_ancestors = Set{Int64}()
                    sources_sharing_ancestors = Set{Int64}()
                    
                    sources_array = collect(sources_to_check)
                    for i in eachindex(sources_array)
                        source_i = sources_array[i]
                        haskey(source_ancestors, source_i) || continue
                        
                        for j in (i+1):lastindex(sources_array)
                            source_j = sources_array[j]
                            haskey(source_ancestors, source_j) || continue
                            
                            shared = intersect(source_ancestors[source_i], source_ancestors[source_j])
                            if !isempty(shared)
                                union!(shared_ancestors, shared)
                                push!(sources_sharing_ancestors, source_i)
                                push!(sources_sharing_ancestors, source_j)
                            end
                        end
                    end
                    
                    # Rest of function remains the same...
                    if !isempty(shared_ancestors)
                        # Find earliest iteration shared ancestors
                        earliest_iter = typemax(Int)
                        earliest_shared_ancestors = Set{Int64}()
                        
                        for node in shared_ancestors
                            node_iter = find_iteration_index(node, iteration_sets)
                            if node_iter !== nothing
                                if node_iter < earliest_iter
                                    earliest_iter = node_iter
                                    earliest_shared_ancestors = Set{Int64}([node])
                                elseif node_iter == earliest_iter
                                    push!(earliest_shared_ancestors, node)
                                end
                            end
                        end
                        
                        if !isempty(earliest_shared_ancestors)
                            # Update highest nodes 
                            union!(group.highest_nodes, earliest_shared_ancestors)
                            
                            # Update group.ancestors to include these new shared ancestors
                            union!(group.ancestors, earliest_shared_ancestors)
                            
                            # Update sources: add shared ancestors, remove sources that share them
                            union!(subgraph.sources, earliest_shared_ancestors)
                            setdiff!(subgraph.sources, sources_sharing_ancestors)
                            
                            # Add paths from shared ancestors to join node
                            for ancestor in earliest_shared_ancestors
                                if haskey(descendants, ancestor) && haskey(ancestors, join_node)
                                    # Find nodes on paths from ancestor to join_node
                                    path_nodes = intersect(descendants[ancestor], ancestors[join_node])
                                    push!(path_nodes, ancestor)  # Add the ancestor itself
                                    push!(path_nodes, join_node) # Add join_node itself
                                    
                                    # Add to relevant_nodes
                                    union!(subgraph.relevant_nodes, path_nodes)
                                    
                                    # Add edges between these nodes
                                    for edge in edgelist
                                        src, dst = edge
                                        if src in path_nodes && dst in path_nodes
                                            push!(subgraph.edgelist, edge)
                                        end
                                    end
                                end
                            end
                            
                            # Ensure unique edges
                            unique!(subgraph.edgelist)
                            
                            # Update graph structures
                            subgraph.outgoing, subgraph.incoming = build_graph_indices(subgraph.edgelist)
                            subgraph.descendants, subgraph.ancestors = calculate_ancestry(subgraph.edgelist)
                            
                            # Update iteration sets
                            subgraph.iteration_sets = [intersect(set, subgraph.relevant_nodes) for set in iteration_sets]
                            filter!(!isempty, subgraph.iteration_sets)
                            
                            # Signal that we made changes
                            changed = true
                        end
                    end
                end
            end
        end
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