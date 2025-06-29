"""
    Debug Cutset Validity Issues

    Investigate why some cutsets are showing as invalid in the grid graph analysis.
    We'll manually trace through the diamond structures and verify the cutset logic.
"""

include("Algorithms/InputProcessingModule.jl")
include("Algorithms/NetworkDecompositionModule.jl")
include("Algorithms/DiamondCutsetModule.jl")

using .DiamondCutsetModule
using .NetworkDecompositionModule

# Grid graph data
edgelist = [
    (1, 2), (1, 5), (2, 6), (3, 2), (3, 4), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 4), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), 
    (13, 9), (13, 14), (14, 15), (15, 16)
]

# Diamond structure for node 16 (the failing one)
diamond_16_edges = [
    (2, 6), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (13, 9), (13, 14), (14, 15), (15, 16)
]

function debug_diamond_16()
    println("=== Debugging Diamond at Node 16 ===")
    println("Diamond edges: $diamond_16_edges")
    
    # Find cutset
    cutset = find_diamond_breaking_cutset(diamond_16_edges, 16)
    println("Found cutset: $cutset")
    
    # Manual verification
    println("\nManual Diamond Pattern Analysis:")
    
    # Build indices for diamond subgraph
    outgoing = Dict{Int64, Set{Int64}}()
    incoming = Dict{Int64, Set{Int64}}()
    
    for (i, j) in diamond_16_edges
        push!(get!(outgoing, i, Set{Int64}()), j)
        push!(get!(incoming, j, Set{Int64}()), i)
    end
    
    # Find sources in diamond
    all_nodes = Set{Int64}()
    for (i, j) in diamond_16_edges
        push!(all_nodes, i)
        push!(all_nodes, j)
    end
    
    sources = Set{Int64}()
    for node in all_nodes
        if !haskey(incoming, node) || isempty(incoming[node])
            push!(sources, node)
        end
    end
    
    println("Diamond nodes: $all_nodes")
    println("Diamond sources: $sources")
    println("Diamond sink: 16")
    
    # Find fork nodes (nodes with multiple outgoing edges)
    forks = Set{Int64}()
    for (node, targets) in outgoing
        if length(targets) > 1
            push!(forks, node)
        end
    end
    
    println("Fork nodes in diamond: $forks")
    
    # Find join nodes (nodes with multiple incoming edges)
    joins = Set{Int64}()
    for (node, sources_to_node) in incoming
        if length(sources_to_node) > 1
            push!(joins, node)
        end
    end
    
    println("Join nodes in diamond: $joins")
    
    # Check specific diamond patterns
    println("\nDiamond Pattern Detection:")
    for fork in forks
        fork_children = outgoing[fork]
        println("Fork $fork has children: $fork_children")
        
        for join in joins
            if fork != join
                # Check if multiple children of fork can reach join
                reachable_count = 0
                for child in fork_children
                    if can_reach(child, join, outgoing)
                        reachable_count += 1
                        println("  Child $child of fork $fork can reach join $join")
                    end
                end
                
                if reachable_count >= 2
                    println("  *** DIAMOND PATTERN: Fork $fork → Join $join (via $reachable_count paths)")
                end
            end
        end
    end
    
    # Test cutset validity manually
    println("\nCutset Validity Check:")
    println("Cutset: $cutset")
    
    # Remove cutset nodes and check if diamonds remain
    filtered_edges = filter(e -> e[1] ∉ cutset && e[2] ∉ cutset, diamond_16_edges)
    println("Edges after removing cutset: $filtered_edges")
    
    if isempty(filtered_edges)
        println("No edges remain - cutset is valid")
        return
    end
    
    # Build filtered graph
    filtered_outgoing = Dict{Int64, Set{Int64}}()
    filtered_incoming = Dict{Int64, Set{Int64}}()
    
    for (i, j) in filtered_edges
        push!(get!(filtered_outgoing, i, Set{Int64}()), j)
        push!(get!(filtered_incoming, j, Set{Int64}()), i)
    end
    
    # Check for remaining diamonds
    remaining_forks = Set{Int64}()
    for (node, targets) in filtered_outgoing
        if length(targets) > 1
            push!(remaining_forks, node)
        end
    end
    
    remaining_joins = Set{Int64}()
    for (node, sources_to_node) in filtered_incoming
        if length(sources_to_node) > 1
            push!(remaining_joins, node)
        end
    end
    
    println("Remaining forks after cutset: $remaining_forks")
    println("Remaining joins after cutset: $remaining_joins")
    
    # Check for remaining diamond patterns
    diamonds_remain = false
    for fork in remaining_forks
        fork_children = filtered_outgoing[fork]
        for join in remaining_joins
            if fork != join
                reachable_count = 0
                for child in fork_children
                    if can_reach(child, join, filtered_outgoing)
                        reachable_count += 1
                    end
                end
                
                if reachable_count >= 2
                    println("  *** REMAINING DIAMOND: Fork $fork → Join $join")
                    diamonds_remain = true
                end
            end
        end
    end
    
    if diamonds_remain
        println("CUTSET INVALID: Diamonds still exist after removing cutset")
    else
        println("CUTSET VALID: No diamonds remain after removing cutset")
    end
end

function can_reach(start, target, outgoing_index)
    """Simple reachability check using DFS"""
    if start == target
        return true
    end
    
    if !haskey(outgoing_index, start)
        return false
    end
    
    visited = Set{Int64}()
    stack = [start]
    
    while !isempty(stack)
        current = pop!(stack)
        if current in visited
            continue
        end
        push!(visited, current)
        
        if current == target
            return true
        end
        
        if haskey(outgoing_index, current)
            for neighbor in outgoing_index[current]
                if neighbor ∉ visited
                    push!(stack, neighbor)
                end
            end
        end
    end
    
    return false
end

function debug_full_graph()
    println("\n=== Debugging Full Graph Cutset ===")
    
    cutset = find_diamond_breaking_cutset(edgelist, 16)
    println("Full graph cutset: $cutset")
    
    # Check validity
    is_valid = verify_cutset_breaks_diamonds(cutset, edgelist, 16)
    println("Validity check result: $is_valid")
    
    # Manual check - what diamonds exist in full graph?
    println("\nFull graph diamond analysis:")
    
    # Build full graph indices
    outgoing = Dict{Int64, Set{Int64}}()
    incoming = Dict{Int64, Set{Int64}}()
    
    for (i, j) in edgelist
        push!(get!(outgoing, i, Set{Int64}()), j)
        push!(get!(incoming, j, Set{Int64}()), i)
    end
    
    # Find all fork-join pairs that create diamonds
    forks = Set{Int64}()
    for (node, targets) in outgoing
        if length(targets) > 1
            push!(forks, node)
        end
    end
    
    joins = Set{Int64}()
    for (node, sources_to_node) in incoming
        if length(sources_to_node) > 1
            push!(joins, node)
        end
    end
    
    println("All forks: $forks")
    println("All joins: $joins")
    
    diamond_patterns = []
    for fork in forks
        fork_children = outgoing[fork]
        for join in joins
            if fork != join
                reachable_count = 0
                for child in fork_children
                    if can_reach(child, join, outgoing)
                        reachable_count += 1
                    end
                end
                
                if reachable_count >= 2
                    push!(diamond_patterns, (fork, join))
                    println("Diamond pattern: Fork $fork → Join $join")
                end
            end
        end
    end
    
    println("Total diamond patterns found: $(length(diamond_patterns))")
end

function run_debug()
    println("Cutset Validity Debug Analysis")
    println("=" ^ 50)
    
    debug_diamond_16()
    debug_full_graph()
    
    println("\n" * "=" ^ 50)
    println("Debug analysis complete!")
end

# Run debug analysis
if abspath(PROGRAM_FILE) == @__FILE__
    run_debug()
end