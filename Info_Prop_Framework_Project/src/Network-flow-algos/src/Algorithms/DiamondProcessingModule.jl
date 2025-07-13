module DiamondProcessingModule

    import ProbabilityBoundsAnalysis
        # Create aliases to avoid ambiguity
        const PBA = ProbabilityBoundsAnalysis
        # Type aliases for convenience
        const PBAInterval = ProbabilityBoundsAnalysis.Interval
        const pbox = ProbabilityBoundsAnalysis.pbox

        
        using ..InputProcessingModule 
    
        const Interval = InputProcessingModule.Interval

    export DiamondsAtNode, Diamond 

"""
Represents a diamond structure in the network.
"""
struct Diamond
    relevant_nodes::Set{Int64}
    highest_nodes::Set{Int64}
    edgelist::Vector{Tuple{Int64, Int64}}
end

"""
Represents diamonds and non-diamond parents at a specific join node.
"""
struct DiamondsAtNode
    diamond::Vector{Diamond}
    non_diamond_parents::Set{Int64}
    join_node::Int64
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

function identify_and_group_diamonds(
    join_nodes::Set{Int64},
    incoming_index::Dict{Int64, Set{Int64}},
    ancestors::Dict{Int64, Set{Int64}},
    descendants::Dict{Int64, Set{Int64}},
    source_nodes::Set{Int64},
    fork_nodes::Set{Int64},
    edgelist::Vector{Tuple{Int64, Int64}},
    node_priors::Union{Dict{Int64,Float64}, Dict{Int64,pbox}, Dict{Int64,Interval}},
    iteration_sets::Vector{Set{Int64}}
)::Dict{Int64, DiamondsAtNode}
    
    result = Dict{Int64, DiamondsAtNode}()
    
    # Step 0: Filter global sources (irrelevant sources with prior 0.0 or 1.0)
    first_key = first(keys(node_priors))
    irrelevant_sources = Set{Int64}()
    
    if isa(node_priors[first_key], pbox)
        for node in source_nodes
            prior = node_priors[node]
            if (prior.ml == 0.0 && prior.mh == 0.0) || (prior.ml == 1.0 && prior.mh == 1.0)
                push!(irrelevant_sources, node)
            end
        end
    elseif isa(node_priors[first_key], Interval)
        for node in source_nodes
            prior = node_priors[node]
            if (prior.lower == 0.0 && prior.upper == 0.0) || (prior.lower == 1.0 && prior.upper == 1.0)
                push!(irrelevant_sources, node)
            end
        end
    else
        # Float64 case
        irrelevant_sources = Set(node for node in source_nodes if node_priors[node] == 0.0 || node_priors[node] == 1.0)
    end
    
    for join_node in join_nodes
        # Step 1: Get all parents from incoming_index
        parents = get(incoming_index, join_node, Set{Int64}())
        length(parents) < 2 && continue
        
        # Step 2: Enhanced ancestor identification using iteration sets
        # First, get fork ancestors for each parent (excluding irrelevant sources)
        parent_fork_ancestors = Dict{Int64, Set{Int64}}()
        for parent in parents
            parent_ancestors = get(ancestors, parent, Set{Int64}())
            # Filter out irrelevant sources and keep only fork nodes
            fork_ancestors = intersect(setdiff(parent_ancestors, irrelevant_sources), fork_nodes)
            parent_fork_ancestors[parent] = fork_ancestors
        end
        
        # Find fork ancestors shared by multiple parents
        ancestor_to_parents = Dict{Int64, Set{Int64}}()
        for (parent, fork_ancs) in parent_fork_ancestors
            for ancestor in fork_ancs
                if !haskey(ancestor_to_parents, ancestor)
                    ancestor_to_parents[ancestor] = Set{Int64}()
                end
                push!(ancestor_to_parents[ancestor], parent)
            end
        end
        
        # Collect all shared fork ancestors (shared by 2+ parents)
        all_shared_ancestors = Set{Int64}()
        for (ancestor, influenced_parents) in ancestor_to_parents
            if length(influenced_parents) >= 2
                push!(all_shared_ancestors, ancestor)
            end
        end
        
        # Use iteration sets to find the topologically highest ancestors
        shared_fork_ancestors = find_highest_iteration_nodes(all_shared_ancestors, iteration_sets)
        diamond_parents = Set{Int64}()
        for (ancestor, influenced_parents) in ancestor_to_parents
            if length(influenced_parents) >= 2
                push!(shared_fork_ancestors, ancestor)
                union!(diamond_parents, influenced_parents)
            end
        end
        
        # Skip if no shared fork ancestors
        isempty(shared_fork_ancestors) && continue
        
        # Step 4: Extract complete distinct edge list of paths from shared all fork ancestors to join node for diamond edgelist induced
        # Build relevant nodes for induced subgraph: shared fork ancestors + their descendants that are ancestors of join_node + join_node
        relevant_nodes_for_induced = copy(shared_fork_ancestors)
        push!(relevant_nodes_for_induced, join_node)
        
        join_ancestors = get(ancestors, join_node, Set{Int64}())
        for shared_ancestor in shared_fork_ancestors
            shared_descendants = get(descendants, shared_ancestor, Set{Int64}())
            # Add descendants of shared ancestor that are also ancestors of join node
            intermediates = intersect(shared_descendants, join_ancestors)
            union!(relevant_nodes_for_induced, intermediates)
        end
        
        # Extract induced edgelist
        induced_edgelist = Vector{Tuple{Int64, Int64}}()
        for edge in edgelist
            source, target = edge
            if source in relevant_nodes_for_induced && target in relevant_nodes_for_induced
                push!(induced_edgelist, edge)
            end
        end
        
        # Step 5: From induced edgelist identify diamond_sourcenodes (nodes with no incoming edges in the extracted induced edge list)
        targets_in_induced = Set{Int64}()
        for (_, target) in induced_edgelist
            push!(targets_in_induced, target)
        end
        diamond_sourcenodes = setdiff(relevant_nodes_for_induced, targets_in_induced)
        
        # Step 5b: From induced edgelist identify relevant_nodes (all nodes involved in the paths)
        relevant_nodes = Set{Int64}()
        for (source, target) in induced_edgelist
            push!(relevant_nodes, source)
            push!(relevant_nodes, target)
        end
        
        # Step 6: Find highest nodes (nodes both in shared fork ancestor and in the diamond_sourcenodes)
        highest_nodes = intersect(shared_fork_ancestors, diamond_sourcenodes)
        
        # Step 7: Identify intermediate nodes: relevant_nodes that are NOT (diamond_sourcenodes OR highest_nodes OR join_node)
        intermediate_nodes = setdiff(relevant_nodes, union(diamond_sourcenodes, highest_nodes, Set([join_node])))
        
        # Step 8: For each intermediate node: Ensure ALL its incoming edges are included in the diamond's induced edge list
        final_edgelist = copy(induced_edgelist)
        final_relevant_nodes_for_induced = copy(relevant_nodes_for_induced)
        final_shared_fork_ancestors = copy(shared_fork_ancestors)
        
        # Track nodes added in this step for recursive processing
        nodes_added_in_step8 = Set{Int64}()
        
        for intermediate_node in intermediate_nodes
            incoming_edges = get(incoming_index, intermediate_node, Set{Int64}())
            for source_node in incoming_edges
                edge = (source_node, intermediate_node)
                if edge ∉ final_edgelist
                    push!(final_edgelist, edge)
                    # Only add to nodes_added_in_step8 if it wasn't in original relevant_nodes_for_induced
                    if source_node ∉ relevant_nodes_for_induced
                        push!(nodes_added_in_step8, source_node)
                    end
                    push!(final_relevant_nodes_for_induced, source_node)
                end
            end
        end
        
        # Step 8b: Recursive diamond completeness
        recursion_depth = 0
        max_recursion_depth = 1000
        
        # First, update all data structures with current state
        # Re-identify diamond structure components with current edge list
        targets_in_final = Set{Int64}()
        for (_, target) in final_edgelist
            push!(targets_in_final, target)
        end
        final_diamond_sourcenodes = setdiff(final_relevant_nodes_for_induced, targets_in_final)
        final_highest_nodes = intersect(final_shared_fork_ancestors, final_diamond_sourcenodes)
        
        previous_shared_fork_ancestors = copy(final_shared_fork_ancestors)
        
        while recursion_depth < max_recursion_depth
            recursion_depth += 1
            
            # Check if ALL current diamond source nodes share fork ancestors
            diamond_source_fork_ancestors = Dict{Int64, Set{Int64}}()
            for node in final_diamond_sourcenodes
                node_ancestors = get(ancestors, node, Set{Int64}())
                # Filter out irrelevant sources and keep only fork nodes
                fork_ancestors = intersect(setdiff(node_ancestors, irrelevant_sources), fork_nodes)
                diamond_source_fork_ancestors[node] = fork_ancestors
            end
            
            # Find fork ancestors shared by multiple diamond source nodes
            source_ancestor_to_nodes = Dict{Int64, Set{Int64}}()
            for (node, fork_ancs) in diamond_source_fork_ancestors
                for ancestor in fork_ancs
                    if !haskey(source_ancestor_to_nodes, ancestor)
                        source_ancestor_to_nodes[ancestor] = Set{Int64}()
                    end
                    push!(source_ancestor_to_nodes[ancestor], node)
                end
            end
            
            # Keep only ancestors shared by 2+ diamond source nodes
            new_shared_fork_ancestors = Set{Int64}()
            for (ancestor, influenced_nodes) in source_ancestor_to_nodes
                if length(influenced_nodes) >= 2
                    push!(new_shared_fork_ancestors, ancestor)
                end
            end
            
            # Remove ancestors we already have
            new_shared_fork_ancestors = setdiff(new_shared_fork_ancestors, final_shared_fork_ancestors)
            
            # Skip if no new shared fork ancestors found
            isempty(new_shared_fork_ancestors) && break
            
            # Update shared fork ancestors
            union!(final_shared_fork_ancestors, new_shared_fork_ancestors)
            
            # Extract paths from new shared ancestors to diamond source nodes
            for shared_ancestor in new_shared_fork_ancestors
                push!(final_relevant_nodes_for_induced, shared_ancestor)
                shared_descendants = get(descendants, shared_ancestor, Set{Int64}())
                
                # For each diamond source node that this ancestor influences
                for source_node in final_diamond_sourcenodes
                    if shared_ancestor in get(ancestors, source_node, Set{Int64}())
                        # Add intermediate nodes on path from shared_ancestor to source_node
                        path_intermediates = intersect(shared_descendants, get(ancestors, source_node, Set{Int64}()))
                        union!(final_relevant_nodes_for_induced, path_intermediates)
                    end
                end
            end
            
            # Extract new induced edges
            for edge in edgelist
                source, target = edge
                if source in final_relevant_nodes_for_induced && target in final_relevant_nodes_for_induced
                    if edge ∉ final_edgelist
                        push!(final_edgelist, edge)
                    end
                end
            end
            
            # Re-identify diamond structure components with expanded edge list
            targets_in_final = Set{Int64}()
            for (_, target) in final_edgelist
                push!(targets_in_final, target)
            end
            final_diamond_sourcenodes = setdiff(final_relevant_nodes_for_induced, targets_in_final)
            
            # Update highest nodes with expanded shared fork ancestors
            final_highest_nodes = intersect(final_shared_fork_ancestors, final_diamond_sourcenodes)
            
            # Identify new intermediate nodes from expanded structure
            final_relevant_nodes = Set{Int64}()
            for (source, target) in final_edgelist
                push!(final_relevant_nodes, source)
                push!(final_relevant_nodes, target)
            end
            
            new_intermediate_nodes = setdiff(final_relevant_nodes, union(final_diamond_sourcenodes, final_highest_nodes, Set([join_node])))
            
            # For new intermediate nodes, ensure ALL their incoming edges are included
            for intermediate_node in new_intermediate_nodes
                # Process ALL new intermediate nodes to ensure complete diamond structure
                incoming_edges = get(incoming_index, intermediate_node, Set{Int64}())
                for source_node in incoming_edges
                    edge = (source_node, intermediate_node)
                    if edge ∉ final_edgelist
                        push!(final_edgelist, edge)
                        push!(final_relevant_nodes_for_induced, source_node)
                    end
                end
            end
        end
        
        # Check recursion depth limit
        if recursion_depth >= max_recursion_depth
            error("Recursion depth limit ($max_recursion_depth) reached for join node $join_node")
        end
        
        # Final diamond structure assembly
        final_relevant_nodes = Set{Int64}()
        for (source, target) in final_edgelist
            push!(final_relevant_nodes, source)
            push!(final_relevant_nodes, target)
        end
        
        # Final identification of diamond components
        targets_in_final = Set{Int64}()
        for (_, target) in final_edgelist
            push!(targets_in_final, target)
        end
        final_diamond_sourcenodes = setdiff(final_relevant_nodes_for_induced, targets_in_final)
        final_highest_nodes = intersect(final_shared_fork_ancestors, final_diamond_sourcenodes)
        
        # Step 9: Build single Diamond with: edgelist, highest_nodes, relevant_nodes
        # Classify non-diamond parents
        non_diamond_parents = setdiff(parents, diamond_parents)
        
        diamond = Diamond(final_relevant_nodes, final_highest_nodes, final_edgelist)
        result[join_node] = DiamondsAtNode([diamond], non_diamond_parents, join_node)
    end
    
    return result
end

end # module DiamondProcessingModule