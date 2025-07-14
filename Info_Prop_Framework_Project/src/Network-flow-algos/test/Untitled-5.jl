import ProbabilityBoundsAnalysis
# Create aliases to avoid ambiguity
const PBA = ProbabilityBoundsAnalysis
# Type aliases for convenience
const PBAInterval = ProbabilityBoundsAnalysis.Interval
const pbox = ProbabilityBoundsAnalysis.pbox

"""
Iterative Diamond Hierarchy Builder with Normalized Storage
Processes diamonds level-by-level to avoid recursion and stack overflow
Returns both hierarchical structure and normalized unique diamond storage
"""

# Simple cache for diamond structures based on their signature
const DIAMOND_STRUCTURE_CACHE = Dict{String, DiamondStructure}()

# Alternating cycle detection - tracks relevant_nodes -> conditioning_nodes to detect alternating patterns
const ALTERNATING_CYCLE_CACHE = Dict{Set{Int64}, Set{Int64}}()

# Helper functions for type-specific operations
# Zero and one values for different types
zero_value(::Type{Float64}) = 0.0
one_value(::Type{Float64}) = 1.0    
non_fixed_value(::Type{Float64}) = 0.9
zero_value(::Type{Interval}) = Interval(0.0, 0.0)
one_value(::Type{Interval}) = Interval(1.0, 1.0)    
non_fixed_value(::Type{Interval}) = Interval(0.9, 0.9)  
zero_value(::Type{pbox}) = PBA.makepbox(PBA.interval(0.0, 0.0))
one_value(::Type{pbox}) = PBA.makepbox(PBA.interval(1.0, 1.0))   
non_fixed_value(::Type{pbox}) = PBA.makepbox(PBA.interval(0.9, 0.9)) 


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
            println("Detected alternating cycle: relevant_nodes=$(relevant_nodes), merging conditioning nodes")
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

"""
Process a single diamond without recursion - builds its structure and finds immediate sub-diamonds
"""
function process_single_diamond(
    diamond_at_node::DiamondsAtNode,
    node_priors::Dict{Int64,T},
    ancestors::Dict{Int64, Set{Int64}},
    descendants::Dict{Int64, Set{Int64}},
    iteration_sets::Vector{Set{Int64}}
) where {T <: Union{Float64, pbox, Interval}}
    
    diamond = diamond_at_node.diamond
    join_node = diamond_at_node.join_node
    
    # CYCLE DETECTION 1: Check for alternating cycles first
    merged_conditioning = detect_alternating_cycle(diamond)
    if merged_conditioning !== nothing
        println("Resolving alternating cycle for join_node $join_node")
        # Create merged diamond to resolve alternating cycle
        merged_diamond = Diamond(diamond.relevant_nodes, merged_conditioning, diamond.edgelist)
        
        # Create simplified structure with no inner diamonds (cycle resolved)
        return DiamondStructure(
            DiamondsAtNodeRef(create_diamond_key(merged_diamond), diamond_at_node.non_diamond_parents, join_node),
            Dict{Int64, Set{Int64}}(),                # incoming_index
            Dict{Int64, Set{Int64}}(),                # outgoing_index  
            Set{Int64}(),                             # sources
            Set{Int64}(),                             # join_nodes
            Set{Int64}(),                             # fork_nodes
            Dict{Int64, Set{Int64}}(),                # ancestors
            Dict{Int64, Set{Int64}}(),                # descendants
            Vector{Set{Int64}}(),                     # iteration_sets
            Dict{Int64, T}(),                         # node_priors
            Vector{DiamondStructure}()                # inner_diamonds (empty - cycle resolved)
        )
    end
    
    # CYCLE DETECTION 2: Check cache for same diamond structure
    signature = create_diamond_signature(diamond)
    if haskey(DIAMOND_STRUCTURE_CACHE, signature)
        return DIAMOND_STRUCTURE_CACHE[signature]
    end
    
    # Build diamond subgraph (your existing logic from getDiamondHierarchy)
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

    # Find immediate sub-diamonds (don't recurse!)
    sub_diamonds_dict = identify_and_group_diamonds(
        sub_join_nodes,
        sub_incoming_index,
        sub_ancestors,
        sub_descendants,
        sub_sources,
        sub_fork_nodes,
        diamond.edgelist,
        sub_node_priors
    )

    # Convert to vector and filter out self-references - STRICT TYPING
    immediate_sub_diamonds = Vector{DiamondStructure}()
    
    for (sub_join_node, sub_diamond_at_node) in sub_diamonds_dict
        sub_diamond = sub_diamond_at_node.diamond
        
        # CYCLE DETECTION 3: Skip if this is the same diamond structure (same cycle)
        if (sub_diamond.relevant_nodes == diamond.relevant_nodes && 
            Set(sub_diamond.edgelist) == Set(diamond.edgelist))
            println("Skipping same diamond cycle for join_node $sub_join_node")
            continue
        end
        
        # Create placeholder sub-diamond structure (will be filled later) - POSITIONAL ARGS
        sub_structure = DiamondStructure(
            DiamondsAtNodeRef(create_diamond_key(sub_diamond), sub_diamond_at_node.non_diamond_parents, sub_join_node),
            Dict{Int64, Set{Int64}}(),                # incoming_index  
            Dict{Int64, Set{Int64}}(),                # outgoing_index
            Set{Int64}(),                             # sources
            Set{Int64}(),                             # join_nodes
            Set{Int64}(),                             # fork_nodes
            Dict{Int64, Set{Int64}}(),                # ancestors
            Dict{Int64, Set{Int64}}(),                # descendants
            Vector{Set{Int64}}(),                     # iteration_sets
            Dict{Int64, T}(),                         # node_priors
            Vector{DiamondStructure}()                # inner_diamonds - will be filled iteratively
        )
        
        push!(immediate_sub_diamonds, sub_structure)
    end

    # Build the complete diamond structure - POSITIONAL ARGS with DiamondsAtNodeRef
    diamond_structure = DiamondStructure(
        DiamondsAtNodeRef(create_diamond_key(diamond), diamond_at_node.non_diamond_parents, join_node),
        sub_incoming_index,                          # incoming_index
        sub_outgoing_index,                          # outgoing_index
        sub_sources,                                 # sources
        sub_join_nodes,                              # join_nodes
        sub_fork_nodes,                              # fork_nodes
        sub_ancestors,                               # ancestors
        sub_descendants,                             # descendants
        sub_iteration_sets,                          # iteration_sets
        sub_node_priors,                             # node_priors
        immediate_sub_diamonds                       # inner_diamonds
    )

    # Cache the result
    DIAMOND_STRUCTURE_CACHE[signature] = diamond_structure
    
    return diamond_structure
end

"""
Extract all unique diamonds from hierarchy and create normalized storage
Returns (unique_diamonds_dict, hierarchical_diamonds_dict)
"""
function normalize_diamond_storage(
    completed_diamonds::Dict{Int64, DiamondStructure},
    root_diamonds::Dict{Int64, DiamondsAtNode}
)
    unique_diamonds = Dict{Tuple{Set{Int64}, Set{Int64}}, Diamond}()
    
    # Function to recursively extract diamonds from hierarchy
    function extract_diamonds_recursive(diamond_structure::DiamondStructure)
        # Get the diamond key and find original diamond from root_diamonds
        diamond_key = diamond_structure.diamond.diamond_key
        join_node = diamond_structure.diamond.join_node
        
        # Find the original diamond from root_diamonds by matching key
        for (root_join_node, root_diamond_at_node) in root_diamonds
            root_key = create_diamond_key(root_diamond_at_node.diamond)
            if root_key == diamond_key
                unique_diamonds[diamond_key] = root_diamond_at_node.diamond
                break
            end
        end
        
        # Recursively extract from inner diamonds
        for inner_diamond in diamond_structure.inner_diamonds
            extract_diamonds_recursive(inner_diamond)
        end
    end
    
    # Extract from all completed diamonds
    for (join_node, diamond_structure) in completed_diamonds
        extract_diamonds_recursive(diamond_structure)
    end
    
    return unique_diamonds, completed_diamonds
end

"""
Validate that all diamonds are unique based on (relevant_nodes, conditioning_nodes)
"""
function validate_diamond_uniqueness(unique_diamonds::Dict{Tuple{Set{Int64}, Set{Int64}}, Diamond})
    println("Validating diamond uniqueness...")
    
    # Check for any duplicate keys (shouldn't happen with our key design)
    if length(unique_diamonds) != length(Set(keys(unique_diamonds)))
        error("Found duplicate diamond keys! This indicates a bug in key generation.")
    end
    
    # Check that each diamond's key matches its actual relevant_nodes and conditioning_nodes
    for (key, diamond) in unique_diamonds
        expected_key = create_diamond_key(diamond)
        if key != expected_key
            error("Diamond key mismatch! Stored key: $key, Expected key: $expected_key")
        end
    end
    
    println("✓ All $(length(unique_diamonds)) diamonds are unique and valid")
end

"""
Build diamond hierarchy iteratively with normalized storage
Returns (hierarchical_diamonds, unique_diamonds)
"""
function build_diamond_hierarchy_iterative(
    root_diamonds::Dict{Int64, DiamondsAtNode},
    node_priors::Dict{Int64,T},
    ancestors::Dict{Int64, Set{Int64}},
    descendants::Dict{Int64, Set{Int64}},
    iteration_sets::Vector{Set{Int64}}
) where {T <: Union{Float64, pbox, Interval}}
    
    # Clear caches for fresh start
    empty!(DIAMOND_STRUCTURE_CACHE)
    empty!(ALTERNATING_CYCLE_CACHE)
    
    # Group diamonds by iteration level (highest first)
    level_groups = group_diamonds_by_level(root_diamonds, iteration_sets)
    
    # Storage for completed diamond structures
    completed_diamonds = Dict{Int64, DiamondStructure}()
    
    # Process level by level (backwards from highest iteration sets)
    for (level_index, level_diamonds) in enumerate(level_groups)
        println("Processing level $level_index with $(length(level_diamonds)) diamonds")
        
        # Process all diamonds at this level
        for (join_node, diamond_at_node) in level_diamonds
            
            # Skip if already processed (due to caching)
            if haskey(completed_diamonds, join_node)
                continue
            end
            
            # Process this diamond
            diamond_structure = process_single_diamond(
                diamond_at_node,
                node_priors,
                ancestors,
                descendants,
                iteration_sets
            )
            
            # Store completed diamond
            completed_diamonds[join_node] = diamond_structure
        end
    end
    
    # Second pass: Link sub-diamond references using cache
    for (join_node, diamond_structure) in completed_diamonds
        # Update inner_diamonds with actual cached structures
        updated_inner_diamonds = Vector{DiamondStructure}()
        
        for placeholder_sub in diamond_structure.inner_diamonds
            sub_key = placeholder_sub.diamond.diamond_key
            
            # Find the actual structure by searching for matching diamond_key
            for (other_join_node, other_structure) in completed_diamonds
                if other_structure.diamond.diamond_key == sub_key
                    push!(updated_inner_diamonds, other_structure)
                    break
                end
            end
        end
        
        # Update the diamond structure with linked sub-diamonds
        diamond_structure.inner_diamonds = updated_inner_diamonds
    end
    
    # Create normalized storage
    unique_diamonds, hierarchical_diamonds = normalize_diamond_storage(completed_diamonds, root_diamonds)
    
    # Validate uniqueness
    validate_diamond_uniqueness(unique_diamonds)
    
    println("Completed hierarchy building with $(length(hierarchical_diamonds)) hierarchical diamonds")
    println("Extracted $(length(unique_diamonds)) unique diamonds")
    println("Cache contains $(length(DIAMOND_STRUCTURE_CACHE)) unique structures") 
    println("Detected $(length(ALTERNATING_CYCLE_CACHE)) alternating cycle patterns")
    
    return hierarchical_diamonds, unique_diamonds
end

"""
Clear the diamond structure cache
"""
function clear_diamond_cache!()
    empty!(DIAMOND_STRUCTURE_CACHE)
    empty!(ALTERNATING_CYCLE_CACHE)
end

"""
Print cache statistics
"""
function print_cache_stats()
    println("Diamond cache contains $(length(DIAMOND_STRUCTURE_CACHE)) structures")
    println("Alternating cycle cache contains $(length(ALTERNATING_CYCLE_CACHE)) patterns")
end

# Usage example:
hierarchical_diamonds, unique_diamonds = build_diamond_hierarchy_iterative(
    diamond_structures,  
    node_priors,
    ancestors,
    descendants,
    iteration_sets
)

#= # Get hierarchical structure
diamond_structure = hierarchical_diamonds[7]

# Get actual diamond data using the key
diamond_key = diamond_structure.diamond.diamond_key
actual_diamond = unique_diamonds[diamond_key] =#