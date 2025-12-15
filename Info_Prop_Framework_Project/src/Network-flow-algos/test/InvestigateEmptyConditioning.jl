"""
Investigate Empty Conditioning Nodes Issue
==========================================
Deep dive into the 13 diamonds with empty conditioning nodes
Check specific join nodes mentioned in BUGFIX_HISTORY.md: 18, 253, 140, 138, 252, 254, 257
"""

using DataStructures

# Load the analyzer
include("AnalyzeTopologyLog.jl")

# ============================================================================
# Focused Investigation Functions
# ============================================================================

function investigate_specific_join_node(topo::NetworkTopology, diamonds::Dict{UInt64, DiamondInfo}, join_node::Int64)
    println("\n" * "="^80)
    println("INVESTIGATING JOIN NODE: $join_node")
    println("="^80)

    # Find all diamonds containing this join node
    containing_diamonds = []
    for (hash, diamond) in diamonds
        if join_node in diamond.relevant_nodes
            push!(containing_diamonds, (hash, diamond))
        end
    end

    println("\nDiamonds containing join node $join_node: $(length(containing_diamonds))")

    # Check if this join node has any root diamonds
    root_diamonds_at_join = filter(d -> d[2].is_root, containing_diamonds)
    sub_diamonds_at_join = filter(d -> !d[2].is_root, containing_diamonds)

    println("  Root diamonds: $(length(root_diamonds_at_join))")
    println("  Sub-diamonds: $(length(sub_diamonds_at_join))")

    # Check for empty conditioning in any
    empty_cond = filter(d -> isempty(d[2].conditioning_nodes), containing_diamonds)

    if !isempty(empty_cond)
        println("\n❌ Found $(length(empty_cond)) diamonds with EMPTY conditioning at join $join_node!")

        for (hash, diamond) in empty_cond
            println("\n  Diamond Hash: $hash")
            println("    Is Root: $(diamond.is_root)")
            println("    Relevant Nodes: $(sort(collect(diamond.relevant_nodes)))")
            println("    Conditioning Nodes: EMPTY")
            println("    Edge Count: $(length(diamond.edgelist))")

            # Analyze structure
            diamond_targets = Set{Int64}()
            diamond_outgoing = Dict{Int64, Set{Int64}}()

            for (src, tgt) in diamond.edgelist
                push!(diamond_targets, tgt)
                if !haskey(diamond_outgoing, src)
                    diamond_outgoing[src] = Set{Int64}()
                end
                push!(diamond_outgoing[src], tgt)
            end

            computed_sources = setdiff(diamond.relevant_nodes, diamond_targets)

            println("\n    Analysis:")
            println("      Computed sources: $(sort(collect(computed_sources)))")
            println("      Fork nodes in diamond:")
            for (node, targets) in diamond_outgoing
                if length(targets) >= 2
                    println("        Node $node -> $(sort(collect(targets)))")
                end
            end

            # Check if any sources are global sources
            global_sources_in_diamond = intersect(computed_sources, topo.source_nodes)
            if !isempty(global_sources_in_diamond)
                println("      Global sources in diamond: $(sort(collect(global_sources_in_diamond)))")
            end

            # Try to reconstruct what conditioning SHOULD be
            println("\n    Expected Behavior:")
            println("      According to Bug #4/#5 fixes:")
            println("        - Conditioning = shared_fork_ancestors ∩ diamond_sources")
            println("        - If empty intersection, should have REVERTED to previous state")
            println("        - This diamond SHOULD NOT EXIST with empty conditioning")
        end
    else
        println("\n✅ All diamonds at join $join_node have valid conditioning nodes")
    end

    # Show one valid diamond for comparison
    valid_diamonds = filter(d -> !isempty(d[2].conditioning_nodes), containing_diamonds)
    if !isempty(valid_diamonds)
        println("\n📊 Example of VALID diamond at join $join_node:")
        hash, diamond = first(valid_diamonds)
        println("  Hash: $hash")
        println("  Is Root: $(diamond.is_root)")
        println("  Relevant Nodes: $(sort(collect(diamond.relevant_nodes)))")
        println("  Conditioning Nodes: $(sort(collect(diamond.conditioning_nodes)))")
        println("  Sub-Join Nodes: $(sort(collect(diamond.sub_join_nodes)))")
        println("  Sub-Diamond Joins: $(sort(collect(diamond.sub_diamond_joins)))")
    end

    println("\n" * "="^80)
end

function compare_root_vs_unique_diamonds(topo::NetworkTopology, diamonds::Dict{UInt64, DiamondInfo})
    """
    Compare root diamonds from Step 3 vs unique diamonds from Step 4
    to identify discrepancies
    """
    println("\n" * "="^80)
    println("COMPARING ROOT VS UNIQUE DIAMONDS")
    println("="^80)

    root_diamonds = filter(d -> d[2].is_root, collect(diamonds))
    unique_diamonds = collect(diamonds)

    println("\nTotal unique diamonds: $(length(unique_diamonds))")
    println("Root diamonds (is_root=true): $(length(root_diamonds))")

    # Check which root diamonds have empty conditioning
    root_empty_cond = filter(d -> isempty(d[2].conditioning_nodes), root_diamonds)

    println("\n❌ Root diamonds with EMPTY conditioning: $(length(root_empty_cond))")

    if !isempty(root_empty_cond)
        println("\nDetails of root diamonds with empty conditioning:")
        for (hash, diamond) in root_empty_cond
            println("\n  Hash: $hash")
            println("    Relevant Nodes ($(length(diamond.relevant_nodes))): $(sort(collect(diamond.relevant_nodes)))")
            println("    Edge Count: $(length(diamond.edgelist))")

            # Find which join nodes this root diamond covers
            join_nodes_in_diamond = intersect(diamond.relevant_nodes, topo.join_nodes)
            println("    Join nodes in this diamond: $(sort(collect(join_nodes_in_diamond)))")

            # Compute what sources should be
            targets = Set{Int64}()
            for (_, tgt) in diamond.edgelist
                push!(targets, tgt)
            end
            computed_sources = setdiff(diamond.relevant_nodes, targets)
            println("    Computed sources: $(sort(collect(computed_sources)))")
        end
    end

    println("\n" * "="^80)
end

function analyze_sub_diamond_relationships(diamonds::Dict{UInt64, DiamondInfo})
    """
    Analyze parent-child relationships between diamonds
    """
    println("\n" * "="^80)
    println("ANALYZING SUB-DIAMOND RELATIONSHIPS")
    println("="^80)

    # Build parent-child map
    parent_child_map = Dict{UInt64, Vector{UInt64}}()

    for (parent_hash, parent_diamond) in diamonds
        children = UInt64[]

        for (child_hash, child_diamond) in diamonds
            if child_hash != parent_hash
                # Check if child's relevant nodes are subset of parent's
                if issubset(child_diamond.relevant_nodes, parent_diamond.relevant_nodes)
                    # Check if child is at a sub-diamond join
                    if !isempty(intersect(child_diamond.relevant_nodes, parent_diamond.sub_diamond_joins))
                        push!(children, child_hash)
                    end
                end
            end
        end

        if !isempty(children)
            parent_child_map[parent_hash] = children
        end
    end

    println("\nDiamonds with sub-diamonds: $(length(parent_child_map))")

    # Check for circular references
    println("\nChecking for circular parent-child references...")
    circular_refs = []

    for (parent_hash, children) in parent_child_map
        if parent_hash in children
            push!(circular_refs, parent_hash)
        end
    end

    if !isempty(circular_refs)
        println("❌ Found $(length(circular_refs)) diamonds with CIRCULAR REFERENCES!")
        for hash in circular_refs
            diamond = diamonds[hash]
            println("  Hash: $hash")
            println("    Relevant Nodes: $(sort(collect(diamond.relevant_nodes)))")
        end
    else
        println("✅ No circular parent-child references detected")
    end

    println("\n" * "="^80)
end

# ============================================================================
# Main Investigation
# ============================================================================

function main_investigation()
    println("\n" * "="^80)
    println("EMPTY CONDITIONING NODES INVESTIGATION")
    println("="^80)

    # Load topology from log
    log_file = "logs/drone-network-balanced-k3_float_topology_and_diamonds_20251214_151253.log"
    println("\n📖 Loading topology from: $log_file")

    topo, diamonds = parse_topology_log(log_file)

    println("✓ Loaded: $(length(topo.nodes)) nodes, $(length(diamonds)) diamonds")

    # 1. Overall statistics
    empty_cond_diamonds = filter(d -> isempty(d[2].conditioning_nodes), collect(diamonds))
    println("\n📊 Overall Statistics:")
    println("   Total diamonds: $(length(diamonds))")
    println("   Diamonds with empty conditioning: $(length(empty_cond_diamonds))")
    println("   Percentage: $(round(100 * length(empty_cond_diamonds) / length(diamonds), digits=2))%")

    # 2. Root vs Unique comparison
    compare_root_vs_unique_diamonds(topo, diamonds)

    # 3. Investigate specific join nodes mentioned in BUGFIX_HISTORY.md
    target_joins = [18, 253, 140, 138, 252, 254, 257]

    println("\n" * "="^80)
    println("INVESTIGATING SPECIFIC JOIN NODES FROM BUGFIX_HISTORY.md")
    println("="^80)
    println("Target joins: $target_joins")

    for join_node in target_joins
        if join_node in topo.join_nodes
            investigate_specific_join_node(topo, diamonds, join_node)
        else
            println("\n⚠️  Node $join_node is not a join node in the topology")
        end
    end

    # 4. Analyze sub-diamond relationships
    analyze_sub_diamond_relationships(diamonds)

    # 5. Summary of findings
    println("\n" * "="^80)
    println("INVESTIGATION SUMMARY")
    println("="^80)

    println("\n🔍 Key Findings:")
    println("   1. Empty conditioning nodes found: $(length(empty_cond_diamonds))")

    root_empty = count(d -> d[2].is_root && isempty(d[2].conditioning_nodes), collect(diamonds))
    println("   2. Root diamonds with empty conditioning: $root_empty")

    sub_empty = count(d -> !d[2].is_root && isempty(d[2].conditioning_nodes), collect(diamonds))
    println("   3. Sub-diamonds with empty conditioning: $sub_empty")

    println("\n📝 Next Steps:")
    println("   - Bug #4 fix (state reversion) may not be working correctly")
    println("   - Bug #5 fix (subsource validation) may have edge cases")
    println("   - Need to trace specific diamond formation for empty cases")
    println("   - Check if build_unique_diamond_storage_depth_first_parallel differs from sequential")

    return topo, diamonds, empty_cond_diamonds
end

# Run investigation
topo, diamonds, empty_cond_diamonds = main_investigation()
