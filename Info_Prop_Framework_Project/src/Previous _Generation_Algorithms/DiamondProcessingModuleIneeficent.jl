module DiamondProcessingModule

    using ..InputProcessingModule 
    import ProbabilityBoundsAnalysis
    
    # Create aliases to avoid ambiguity
    const PBA = ProbabilityBoundsAnalysis
    # Type aliases for convenience
    const PBAInterval = ProbabilityBoundsAnalysis.Interval
    const pbox = ProbabilityBoundsAnalysis.pbox
    const Interval = InputProcessingModule.Interval

    # Export all public functions and types
    export DiamondsAtNode, Diamond, DiamondComputationData
    export identify_and_group_diamonds
    export create_diamond_hash_key, create_diamond_key, build_unique_diamond_storage

    # 
    # STRUCT DEFINITIONS
    # 

    """
    Represents a diamond structure in the network.
    """
    struct Diamond
        relevant_nodes::Set{Int64}
        conditioning_nodes::Set{Int64}
        edgelist::Vector{Tuple{Int64, Int64}}
    end

    """
    Represents diamonds and non-diamond parents at a specific join node.
    """
    struct DiamondsAtNode
        diamond::Diamond
        non_diamond_parents::Set{Int64}
        join_node::Int64
    end

    """
    Computation-ready data for a diamond - contains all pre-computed subgraph structure
    """
    struct DiamondComputationData{T}
        # All pre-computed subgraph structure (replaces expensive building in updateDiamondJoin)
        sub_outgoing_index::Dict{Int64, Set{Int64}}
        sub_incoming_index::Dict{Int64, Set{Int64}}
        sub_sources::Set{Int64}
        sub_fork_nodes::Set{Int64}
        sub_join_nodes::Set{Int64}
        sub_ancestors::Dict{Int64, Set{Int64}}
        sub_descendants::Dict{Int64, Set{Int64}}
        sub_iteration_sets::Vector{Set{Int64}}
        sub_node_priors::Dict{Int64, T}
        
        # Ready-to-use inner diamonds for recursive calls
        sub_diamond_structures::Dict{Int64, DiamondsAtNode}
        diamond::Diamond
    end

    #
    # CONSTANTS AND CACHES
    #

    # Alternating cycle detection - tracks relevant_nodes -> conditioning_nodes to detect alternating patterns
    const ALTERNATING_CYCLE_CACHE = Dict{Set{Int64}, Set{Int64}}()

    # Cache for processed diamonds to avoid recomputation
    const PROCESSED_DIAMONDS_CACHE = Dict{UInt64, Bool}()

    # 
    # HELPER FUNCTIONS
    # 

    # Helper functions for type-specific operations
    # Zero and one values for different types
    zero_value(::Type{Float64}) = 0.0
    one_value(::Type{Float64}) = 1.0    
    non_fixed_value(::Type{Float64}) = 0.9
    zero_value(::Type{Interval}) = Interval(0.0, 0.0)
    one_value(::Type{Interval}) = Interval(1.0, 1.0)    
    non_fixed_value(::Type{Interval}) = Interval(0.9, 0.9)  
    zero_value(::Type{pbox}) = PBA.makepbox(PBA.interval(0.0, 0.0))
    one_value(::Type{pbox}) = PBA.makepbox(PBA.interval(1.0, 1.1))   
    non_fixed_value(::Type{pbox}) = PBA.makepbox(PBA.interval(0.9, 0.9))



     """
    Implements the complete diamond detection algorithm following the exact steps.

    # Algorithm Steps:
    0. Filter global sources
    1. For each join node: Get all parents from incoming_index
    2. Collect shared fork ancestors (that aren't irrelevant source nodes) that are shared between more than one parents
    4. Extract complete distinct edge list of paths from shared all fork ancestors to join node for diamond edgelist induced
    5. From induced edgelist identify diamond_sourcenodes (nodes with no incoming edges in the extracted induced edge list)
    5b. From induced edgelist identify relevant_nodes (all nodes involved in the paths incl shared fork anc and join node ofc)
    6. Find highest nodes (nodes both in shared fork ancestor and in the diamond_sourcenodes)
    7. Identify intermediate nodes: relevant_nodes that are NOT (diamond_sourcenodes OR conditioning_nodes OR join_node)
    8. To get full final diamond edges For each intermediate node: Ensure ALL its incoming edges are included in the diamond's induced edge list (it doesn't matter if its from a global source or wherever .. if its an intermediate node all of its incoming edges is part of diamond even if not part of induced edge list)
    8b. Recursive diamond completeness: For additional incoming nodes from step 8, check if they share fork ancestors. If so, recursively detect diamonds among these nodes, merge results, and repeat until stable. Updates shared_fork_ancestors and re-identifies diamond structure components at each iteration. Recursion depth limited to 1000 per join node.
    9. Build single Diamond with: edgelist, conditioning_nodes, relevant_nodes
    """
    function identify_and_group_diamonds(
        join_nodes::Set{Int64},
        incoming_index::Dict{Int64, Set{Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},  
        source_nodes::Set{Int64},
        fork_nodes::Set{Int64},
        edgelist::Vector{Tuple{Int64, Int64}},      
        node_priors::Union{Dict{Int64,Float64}, Dict{Int64,pbox}, Dict{Int64,Interval}},
        iteration_sets::Vector{Set{Int64}},
        exluded_nodes::Set{Int64} = Set{Int64}()
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
        
        # add conditioning nodes to irrelevant sources
        union!(irrelevant_sources, exluded_nodes)
        
        for join_node in join_nodes
            # Step 1: Get all parents from incoming_index
            parents = get(incoming_index, join_node, Set{Int64}())
            length(parents) < 2 && continue
            
            # Step 2: Collect shared fork ancestors that are shared between more than one parents
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
            
            # Keep only ancestors shared by 2+ parents
            shared_fork_ancestors = Set{Int64}()
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
            diamond_sourcenodes = setdiff(setdiff(relevant_nodes_for_induced, targets_in_induced), exluded_nodes)
            
            # Step 5b: From induced edgelist identify relevant_nodes (all nodes involved in the paths)
            relevant_nodes = Set{Int64}()
            for (source, target) in induced_edgelist
                push!(relevant_nodes, source)
                push!(relevant_nodes, target)
            end
            
            # Step 6: Find highest nodes (nodes both in shared fork ancestor and in the diamond_sourcenodes)
            # IMPORTANT: Exclude nodes that are already conditioned in parent context
            conditioning_nodes = setdiff(intersect(shared_fork_ancestors, diamond_sourcenodes), exluded_nodes)
            
            # VALIDITY CHECK: Skip diamonds that would have no conditioning nodes after exclusion
            # This prevents circular dependencies where excluded nodes were the only conditioning nodes
            if isempty(conditioning_nodes)
                continue  # Skip this diamond - it's not valid without conditioning nodes
            end
            
            # Step 7: Identify intermediate nodes: relevant_nodes that are NOT (diamond_sourcenodes OR conditioning_nodes OR join_node)
            intermediate_nodes = setdiff(relevant_nodes, union(diamond_sourcenodes, conditioning_nodes, Set([join_node])))
            
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
            final_diamond_sourcenodes = setdiff(setdiff(final_relevant_nodes_for_induced, targets_in_final), exluded_nodes)
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
                final_diamond_sourcenodes = setdiff(setdiff(final_relevant_nodes_for_induced, targets_in_final), exluded_nodes)
                
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
            final_diamond_sourcenodes = setdiff(setdiff(final_relevant_nodes_for_induced, targets_in_final), exluded_nodes)
            final_highest_nodes = intersect(final_shared_fork_ancestors, final_diamond_sourcenodes)
            
            
            # Step 9: Build single Diamond with: edgelist, conditioning_nodes, relevant_nodes
            # Classify non-diamond parents
            non_diamond_parents = setdiff(parents, diamond_parents)
            
            diamond = Diamond(final_relevant_nodes, final_highest_nodes, final_edgelist)
            result[join_node] = DiamondsAtNode(diamond, non_diamond_parents, join_node)
        end
        
        return result
    end









    """
    Create a unique hash key for a diamond based on relevant_nodes and conditioning_nodes
    Much faster than using the full Sets as keys, especially for large diamonds
    """
    function create_diamond_hash_key(diamond::Diamond)::UInt64
        return hash((diamond.relevant_nodes, diamond.conditioning_nodes))
    end

    """
    Create a unique key for a diamond based on relevant_nodes and conditioning_nodes
    """
    function create_diamond_key(diamond::Diamond)::Tuple{Set{Int64}, Set{Int64}}
        return (diamond.relevant_nodes, diamond.conditioning_nodes)
    end

    """
    Create a unique signature for a diamond based on its structure (for caching)
    """
    function create_diamond_signature(diamond::Diamond)::String
        # Sort everything for consistent signatures
        sorted_edges = sort(collect(diamond.edgelist))
        sorted_nodes = sort(collect(diamond.relevant_nodes))
        sorted_conditioning = sort(collect(diamond.conditioning_nodes))
        
        return string(hash((sorted_edges, sorted_nodes, sorted_conditioning)))
    end

    """
    Detect alternating cycles: same relevant_nodes but different conditioning_nodes
    Returns merged conditioning nodes if alternating cycle detected, nothing otherwise
    """
    function detect_alternating_cycle(diamond::Diamond)::Union{Set{Int64}, Nothing}
        relevant_nodes = diamond.relevant_nodes
        conditioning_nodes = diamond.conditioning_nodes
        
        if haskey(ALTERNATING_CYCLE_CACHE, relevant_nodes)
            previous_conditioning = ALTERNATING_CYCLE_CACHE[relevant_nodes]
            if previous_conditioning != conditioning_nodes
                # Alternating cycle detected - merge conditioning nodes
                merged_conditioning = union(previous_conditioning, conditioning_nodes)
                return merged_conditioning
            end
        else
            # First time seeing these relevant_nodes - store conditioning nodes
            ALTERNATING_CYCLE_CACHE[relevant_nodes] = conditioning_nodes
        end
        
        return nothing
    end

    """
    Get the topological level (iteration set index) for a join node
    """
    function get_iteration_level(join_node::Int64, iteration_sets::Vector{Set{Int64}})::Int
        for (level, nodes) in enumerate(iteration_sets)
            if join_node in nodes
                return level
            end
        end
        return length(iteration_sets) + 1  # If not found, put at end
    end

    """
    Group diamonds by their iteration levels and sort for backwards processing
    """
    function group_diamonds_by_level(
        diamonds::Dict{Int64, DiamondsAtNode},
        iteration_sets::Vector{Set{Int64}}
    )::Vector{Vector{Tuple{Int64, DiamondsAtNode}}}
        
        # Group by iteration level
        level_groups = Dict{Int, Vector{Tuple{Int64, DiamondsAtNode}}}()
        
        for (join_node, diamond_at_node) in diamonds
            level = get_iteration_level(join_node, iteration_sets)
            if !haskey(level_groups, level)
                level_groups[level] = Vector{Tuple{Int64, DiamondsAtNode}}()
            end
            push!(level_groups[level], (join_node, diamond_at_node))
        end
        
        # Sort levels in descending order (highest iteration level first)
        sorted_levels = sort(collect(keys(level_groups)), rev=true)
        
        return [level_groups[level] for level in sorted_levels]
    end

    #
    # NEW ITERATIVE DIAMOND PROCESSING FUNCTIONS
    #

    """
    Compute subgraph structure for a diamond - builds all the sub_* fields needed for DiamondComputationData
    """
    function compute_diamond_subgraph_structure(
        diamond::Diamond,
        join_node::Int64,
        node_priors::Dict{Int64,T},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        iteration_sets::Vector{Set{Int64}}
    ) where {T <: Union{Float64, pbox, Interval}}
        
        # Build diamond subgraph indices
        sub_outgoing_index = Dict{Int64, Set{Int64}}()
        sub_incoming_index = Dict{Int64, Set{Int64}}()

        for (i, j) in diamond.edgelist
            push!(get!(sub_outgoing_index, i, Set{Int64}()), j)
            push!(get!(sub_incoming_index, j, Set{Int64}()), i)
        end

        # Find sources
        sub_sources = Set{Int64}()
        for node in keys(sub_outgoing_index)
            if !haskey(sub_incoming_index, node) || isempty(sub_incoming_index[node])
                push!(sub_sources, node)
            end
        end
        
        # Find fork and join nodes
        sub_fork_nodes = Set{Int64}()
        for (node, targets) in sub_outgoing_index
            if length(targets) > 1
                push!(sub_fork_nodes, node)
            end
        end
        
        sub_join_nodes = Set{Int64}()
        for (node, sources) in sub_incoming_index
            if length(sources) > 1
                push!(sub_join_nodes, node)
            end
        end

        # Filter ancestors and descendants to relevant nodes
        sub_ancestors = Dict{Int64, Set{Int64}}()
        sub_descendants = Dict{Int64, Set{Int64}}()
        for node in diamond.relevant_nodes
            sub_ancestors[node] = Set{Int64}(intersect(ancestors[node], diamond.relevant_nodes))
            sub_descendants[node] = Set{Int64}(intersect(descendants[node], diamond.relevant_nodes))
        end

        # Filter iteration sets
        sub_iteration_sets = Vector{Set{Int64}}()
        for iter_set in iteration_sets
            filtered_set = Set{Int64}(intersect(iter_set, diamond.relevant_nodes))
            if !isempty(filtered_set)
                push!(sub_iteration_sets, filtered_set)
            end
        end

        # Create sub_node_priors
        sub_node_priors = Dict{Int64, T}()
        for node in diamond.relevant_nodes
            if node ∉ sub_sources
                sub_node_priors[node] = node_priors[node]
                if node == join_node
                    sub_node_priors[node] = one_value(T)
                end
            elseif node ∉ diamond.conditioning_nodes
                sub_node_priors[node] = non_fixed_value(T)  # Will be replaced with belief_dict in actual usage
            elseif node ∈ diamond.conditioning_nodes
                sub_node_priors[node] = one_value(T)
            end
        end

        return (sub_outgoing_index, sub_incoming_index, sub_sources, sub_fork_nodes,
                sub_join_nodes, sub_ancestors, sub_descendants, sub_iteration_sets, sub_node_priors)
    end

    """
    Build unique diamond storage with depth-first recursive processing to match recursive version
    Returns unique_diamonds::Dict{UInt64, DiamondComputationData{T}}
    """
    function build_unique_diamond_storage(
        root_diamonds::Dict{Int64, DiamondsAtNode},
        node_priors::Dict{Int64,T},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        iteration_sets::Vector{Set{Int64}}
    ) where {T <: Union{Float64, pbox, Interval}}
       
        
        # Clear caches for fresh start
        empty!(ALTERNATING_CYCLE_CACHE)
        empty!(PROCESSED_DIAMONDS_CACHE)
        
        # Final result: unique diamonds with hash-based lookup
        unique_diamonds = Dict{UInt64, DiamondComputationData{T}}()
        
        # Track processed diamonds to prevent infinite recursion
        processed_diamond_hashes = Set{UInt64}()
        
        # Recursive function to process diamonds depth-first like the recursive version
        function process_diamond_recursive(current_diamond::Diamond, join_node::Int64, non_diamond_parents::Set{Int64}, accumulated_excluded_nodes::Set{Int64} = Set{Int64}())
            # Create hash key for this diamond
            diamond_hash = create_diamond_hash_key(current_diamond)
            
            # Check if we've already processed this diamond to prevent infinite recursion
            if diamond_hash in processed_diamond_hashes
                return  # Already processed, skip to avoid infinite recursion
            end
            
            # Mark this diamond as being processed
            push!(processed_diamond_hashes, diamond_hash)
            
            # Accumulate excluded nodes: all conditioning nodes from current level + all parent levels
            current_excluded_nodes = union(accumulated_excluded_nodes, current_diamond.conditioning_nodes)
           
            # Compute subgraph structure for this diamond
            sub_outgoing_index, sub_incoming_index, sub_sources, sub_fork_nodes,
            sub_join_nodes, sub_ancestors, sub_descendants, sub_iteration_sets, sub_node_priors =
                compute_diamond_subgraph_structure(current_diamond, join_node, node_priors, ancestors, descendants, iteration_sets)
            
            # Find inner diamonds when this diamond's conditioning nodes are processed
            # Pass ALL accumulated excluded nodes from the hierarchy to properly filter sub-diamonds
            sub_diamonds_dict = identify_and_group_diamonds(
                sub_join_nodes,
                sub_incoming_index,
                sub_ancestors,
                sub_descendants,
                sub_sources,
                sub_fork_nodes,
                current_diamond.edgelist,
                sub_node_priors,
                current_excluded_nodes  # Pass ALL accumulated excluded nodes from hierarchy
            )
            
             # Process each sub-diamond recursively
            filtered_sub_diamonds = Dict{Int64, DiamondsAtNode}()
            for (sub_join_node, sub_diamond_at_node) in sub_diamonds_dict
                sub_diamond = sub_diamond_at_node.diamond
                
                # Process sub-diamond recursively (it becomes Level 0 for its own processing)
                # Pass accumulated excluded nodes to maintain hierarchy
                process_diamond_recursive(sub_diamond, sub_join_node, sub_diamond_at_node.non_diamond_parents, current_excluded_nodes)
                
                filtered_sub_diamonds[sub_join_node] = sub_diamond_at_node
            end
            
             # Store THIS diamond with its immediate sub-diamonds
            # Create DiamondComputationData with all precomputed structure
            computation_data = DiamondComputationData{T}(
                sub_outgoing_index,      # sub_outgoing_index
                sub_incoming_index,      # sub_incoming_index
                sub_sources,             # sub_sources
                sub_fork_nodes,          # sub_fork_nodes
                sub_join_nodes,          # sub_join_nodes
                sub_ancestors,           # sub_ancestors
                sub_descendants,         # sub_descendants
                sub_iteration_sets,      # sub_iteration_sets
                sub_node_priors,         # sub_node_priors
                filtered_sub_diamonds,   # sub_diamond_structures
                current_diamond          # diamond
            )
            
            # Store in unique diamonds dictionary only if not already present
            if !haskey(unique_diamonds, diamond_hash)
                unique_diamonds[diamond_hash] = computation_data
           
            end
        end
        
        # Process root diamonds depth-first recursively
        for (join_node, diamond_at_node) in root_diamonds
            process_diamond_recursive(diamond_at_node.diamond, join_node, diamond_at_node.non_diamond_parents)
        end
        
   
        
        # NO CYCLE DETECTION: Keep original root diamonds as-is
        updated_root_diamonds = root_diamonds
        
        return unique_diamonds, updated_root_diamonds
    end

end