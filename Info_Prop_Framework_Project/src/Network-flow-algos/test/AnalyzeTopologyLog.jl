"""
Network Topology Log Analyzer
==============================
Queries and validates the topology log file created by LogNetworkTopologyAndDiamonds.jl
Supports:
- Topology queries (ancestors, descendants, edges)
- Diamond validation
- Diamond hierarchy tracing
- Consistency checking
"""

using DataStructures

# ============================================================================
# Data Structures
# ============================================================================

mutable struct NetworkTopology
    nodes::Set{Int64}
    edges::Vector{Tuple{Int64, Int64}}
    outgoing_index::Dict{Int64, Set{Int64}}
    incoming_index::Dict{Int64, Set{Int64}}
    ancestors::Dict{Int64, Set{Int64}}
    descendants::Dict{Int64, Set{Int64}}
    fork_nodes::Set{Int64}
    join_nodes::Set{Int64}
    source_nodes::Set{Int64}
    sink_nodes::Set{Int64}
end

struct DiamondInfo
    hash::UInt64
    is_root::Bool
    relevant_nodes::Set{Int64}
    conditioning_nodes::Set{Int64}
    edgelist::Vector{Tuple{Int64, Int64}}
    sub_join_nodes::Set{Int64}
    sub_diamond_joins::Set{Int64}  # Join nodes that have sub-diamonds
end

# ============================================================================
# Log File Parser
# ============================================================================

function parse_topology_log(filepath::String)
    println("📖 Parsing topology log: $filepath")

    topo = NetworkTopology(
        Set{Int64}(),
        Vector{Tuple{Int64, Int64}}(),
        Dict{Int64, Set{Int64}}(),
        Dict{Int64, Set{Int64}}(),
        Dict{Int64, Set{Int64}}(),
        Dict{Int64, Set{Int64}}(),
        Set{Int64}(),
        Set{Int64}(),
        Set{Int64}(),
        Set{Int64}()
    )

    diamonds = Dict{UInt64, DiamondInfo}()

    open(filepath, "r") do io
        section = :none
        current_diamond_hash = UInt64(0)
        current_diamond_is_root = false
        current_diamond_relevant = Set{Int64}()
        current_diamond_conditioning = Set{Int64}()
        current_diamond_edges = Vector{Tuple{Int64, Int64}}()
        current_diamond_sub_joins = Set{Int64}()
        current_diamond_sub_diamond_joins = Set{Int64}()

        for line in eachline(io)
            line = strip(line)

            # Section detection
            if contains(line, "1.1 Edge List")
                section = :edgelist
                continue
            elseif contains(line, "2.1 Fork Nodes")
                section = :fork_nodes
                continue
            elseif contains(line, "2.2 Join Nodes")
                section = :join_nodes
                continue
            elseif contains(line, "1.6 Source Nodes")
                section = :source_nodes
                continue
            elseif contains(line, "1.7 Sink Nodes")
                section = :sink_nodes
                continue
            elseif contains(line, "2.4 Ancestors for Each Node")
                section = :ancestors
                continue
            elseif contains(line, "2.5 Descendants for Each Node")
                section = :descendants
                continue
            elseif contains(line, "1.4 Outgoing Index")
                section = :outgoing
                continue
            elseif contains(line, "1.5 Incoming Index")
                section = :incoming
                continue
            elseif startswith(line, "Diamond #") && contains(line, "(Hash:")
                # Save previous diamond if it exists
                if current_diamond_hash != 0
                    diamonds[current_diamond_hash] = DiamondInfo(
                        current_diamond_hash,
                        current_diamond_is_root,
                        current_diamond_relevant,
                        current_diamond_conditioning,
                        current_diamond_edges,
                        current_diamond_sub_joins,
                        current_diamond_sub_diamond_joins
                    )
                end

                # Start new diamond
                section = :diamond_header
                # Extract hash
                hash_match = match(r"Hash:\s*(\d+)", line)
                if hash_match !== nothing
                    current_diamond_hash = parse(UInt64, hash_match.captures[1])
                else
                    current_diamond_hash = 0
                end
                # Reset current diamond data
                current_diamond_relevant = Set{Int64}()
                current_diamond_conditioning = Set{Int64}()
                current_diamond_edges = Vector{Tuple{Int64, Int64}}()
                current_diamond_sub_joins = Set{Int64}()
                current_diamond_sub_diamond_joins = Set{Int64}()
                current_diamond_is_root = false
                continue
            elseif contains(line, "Is Root Diamond:")
                current_diamond_is_root = contains(line, "true")
                continue
            elseif contains(line, "Main Diamond Structure:")
                section = :diamond_structure
                continue
            elseif contains(line, "Sub-Join Nodes:")
                section = :sub_joins
                continue
            elseif contains(line, "Sub-Diamond Structures (Inner Diamonds):")
                section = :sub_diamonds
                continue
            elseif startswith(line, "SUMMARY")
                # Save final diamond if exists
                if current_diamond_hash != 0
                    diamonds[current_diamond_hash] = DiamondInfo(
                        current_diamond_hash,
                        current_diamond_is_root,
                        current_diamond_relevant,
                        current_diamond_conditioning,
                        current_diamond_edges,
                        current_diamond_sub_joins,
                        current_diamond_sub_diamond_joins
                    )
                end
                section = :none
                continue
            end

            # Parse based on section
            if section == :edgelist
                edge_match = match(r"\((\d+),\s*(\d+)\)", line)
                if edge_match !== nothing
                    src = parse(Int64, edge_match.captures[1])
                    tgt = parse(Int64, edge_match.captures[2])
                    push!(topo.edges, (src, tgt))
                    push!(topo.nodes, src, tgt)

                    # Build indices
                    if !haskey(topo.outgoing_index, src)
                        topo.outgoing_index[src] = Set{Int64}()
                    end
                    push!(topo.outgoing_index[src], tgt)

                    if !haskey(topo.incoming_index, tgt)
                        topo.incoming_index[tgt] = Set{Int64}()
                    end
                    push!(topo.incoming_index[tgt], src)
                end

            elseif section == :fork_nodes || section == :join_nodes || section == :source_nodes || section == :sink_nodes
                nodes_match = match(r"\[(.+)\]", line)
                if nodes_match !== nothing
                    nodes_str = nodes_match.captures[1]
                    if !isempty(strip(nodes_str))
                        node_ids = [parse(Int64, s) for s in split(nodes_str, ",")]
                        if section == :fork_nodes
                            union!(topo.fork_nodes, node_ids)
                        elseif section == :join_nodes
                            union!(topo.join_nodes, node_ids)
                        elseif section == :source_nodes
                            union!(topo.source_nodes, node_ids)
                        elseif section == :sink_nodes
                            union!(topo.sink_nodes, node_ids)
                        end
                    end
                end

            elseif section == :ancestors || section == :descendants
                node_match = match(r"Node\s+(\d+):\s*\[(.+)\]", line)
                if node_match !== nothing
                    node = parse(Int64, node_match.captures[1])
                    anc_str = node_match.captures[2]
                    anc_list = Set([parse(Int64, s) for s in split(anc_str, ",")])

                    if section == :ancestors
                        topo.ancestors[node] = anc_list
                    else
                        topo.descendants[node] = anc_list
                    end
                end

            elseif section == :diamond_structure
                # Parse Relevant Nodes
                if contains(line, "Relevant Nodes:")
                    nodes_match = match(r"Relevant Nodes:\s*\[(.+)\]", line)
                    if nodes_match !== nothing
                        nodes_str = nodes_match.captures[1]
                        current_diamond_relevant = Set([parse(Int64, s) for s in split(nodes_str, ",")])
                    end
                # Parse Conditioning Nodes
                elseif contains(line, "Conditioning Nodes:")
                    nodes_match = match(r"Conditioning Nodes:\s*\[(.+)\]", line)
                    if nodes_match !== nothing
                        nodes_str = nodes_match.captures[1]
                        current_diamond_conditioning = Set([parse(Int64, s) for s in split(nodes_str, ",")])
                    end
                # Parse edge list
                else
                    edge_match = match(r"\((\d+),\s*(\d+)\)", line)
                    if edge_match !== nothing
                        src = parse(Int64, edge_match.captures[1])
                        tgt = parse(Int64, edge_match.captures[2])
                        push!(current_diamond_edges, (src, tgt))
                    end
                end

            elseif section == :sub_joins
                nodes_match = match(r"Sub-Join Nodes:\s*\[(.+)\]", line)
                if nodes_match !== nothing
                    nodes_str = nodes_match.captures[1]
                    if !isempty(strip(nodes_str))
                        current_diamond_sub_joins = Set([parse(Int64, s) for s in split(nodes_str, ",")])
                    end
                end

            elseif section == :sub_diamonds
                # Detect sub-diamond join nodes
                sub_join_match = match(r"Sub-Diamond at Join Node\s+(\d+):", line)
                if sub_join_match !== nothing
                    sub_join = parse(Int64, sub_join_match.captures[1])
                    push!(current_diamond_sub_diamond_joins, sub_join)
                end
            end
        end

        # Save last diamond if exists
        if current_diamond_hash != 0
            diamonds[current_diamond_hash] = DiamondInfo(
                current_diamond_hash,
                current_diamond_is_root,
                current_diamond_relevant,
                current_diamond_conditioning,
                current_diamond_edges,
                current_diamond_sub_joins,
                current_diamond_sub_diamond_joins
            )
        end
    end

    println("✓ Parsed: $(length(topo.nodes)) nodes, $(length(topo.edges)) edges, $(length(diamonds)) diamonds")
    return topo, diamonds
end

# ============================================================================
# Query Functions
# ============================================================================

function query_node_ancestors(topo::NetworkTopology, node::Int64)
    if !haskey(topo.ancestors, node)
        println("⚠️  Node $node not found in topology")
        return nothing
    end

    anc = sort(collect(topo.ancestors[node]))
    println("\n🔍 Ancestors of Node $node:")
    println("   Count: $(length(anc))")
    println("   List: $anc")
    return anc
end

function query_node_descendants(topo::NetworkTopology, node::Int64)
    if !haskey(topo.descendants, node)
        println("⚠️  Node $node not found in topology")
        return nothing
    end

    desc = sort(collect(topo.descendants[node]))
    println("\n🔍 Descendants of Node $node:")
    println("   Count: $(length(desc))")
    println("   List: $desc")
    return desc
end

function query_ancestral_edgelist(topo::NetworkTopology, node::Int64)
    if !haskey(topo.ancestors, node)
        println("⚠️  Node $node not found in topology")
        return nothing
    end

    # Get all ancestors including the node itself
    anc_set = union(topo.ancestors[node], Set([node]))

    # Filter edges that are within the ancestral subgraph
    ancestral_edges = filter(e -> e[1] in anc_set && e[2] in anc_set, topo.edges)
    sorted_edges = sort(ancestral_edges)

    println("\n🔍 Ancestral Edge List for Node $node:")
    println("   Ancestors: $(sort(collect(topo.ancestors[node])))")
    println("   Total Edges: $(length(sorted_edges))")
    println("   Edges:")
    for (src, tgt) in sorted_edges
        println("     ($src, $tgt)")
    end

    return sorted_edges
end

function query_node_info(topo::NetworkTopology, node::Int64)
    println("\n" * "="^80)
    println("NODE $node - COMPLETE INFO")
    println("="^80)

    if node ∉ topo.nodes
        println("⚠️  Node $node not found in topology")
        return
    end

    println("\n📊 Node Type:")
    if node in topo.source_nodes
        println("   ✓ Source Node")
    end
    if node in topo.sink_nodes
        println("   ✓ Sink Node")
    end
    if node in topo.fork_nodes
        println("   ✓ Fork Node (multiple children)")
    end
    if node in topo.join_nodes
        println("   ✓ Join Node (multiple parents)")
    end

    println("\n📥 Incoming Edges:")
    if haskey(topo.incoming_index, node)
        parents = sort(collect(topo.incoming_index[node]))
        println("   Parents: $parents")
        for p in parents
            println("     ($p, $node)")
        end
    else
        println("   (None)")
    end

    println("\n📤 Outgoing Edges:")
    if haskey(topo.outgoing_index, node)
        children = sort(collect(topo.outgoing_index[node]))
        println("   Children: $children")
        for c in children
            println("     ($node, $c)")
        end
    else
        println("   (None)")
    end

    println("\n🌳 Ancestors:")
    if haskey(topo.ancestors, node)
        anc = sort(collect(topo.ancestors[node]))
        println("   Count: $(length(anc))")
        println("   List: $anc")
    end

    println("\n🌳 Descendants:")
    if haskey(topo.descendants, node)
        desc = sort(collect(topo.descendants[node]))
        println("   Count: $(length(desc))")
        println("   List: $desc")
    end

    println("\n" * "="^80)
end

# ============================================================================
# Diamond Validation Functions
# ============================================================================

function validate_diamond_structure(topo::NetworkTopology, diamond::DiamondInfo)
    println("\n" * "="^80)
    println("VALIDATING DIAMOND (Hash: $(diamond.hash))")
    println("="^80)

    issues = []

    # 1. Check that all relevant nodes exist in topology
    println("\n✓ Checking relevant nodes exist in topology...")
    for node in diamond.relevant_nodes
        if node ∉ topo.nodes
            push!(issues, "Node $node in relevant_nodes not found in topology")
        end
    end

    # 2. Check that all edges in diamond exist in topology
    println("✓ Checking diamond edges exist in topology...")
    for edge in diamond.edgelist
        if edge ∉ topo.edges
            push!(issues, "Edge $edge in diamond not found in topology")
        end
    end

    # 3. Check that all edges connect relevant nodes
    println("✓ Checking edges connect relevant nodes...")
    for (src, tgt) in diamond.edgelist
        if src ∉ diamond.relevant_nodes
            push!(issues, "Edge ($src, $tgt): source $src not in relevant_nodes")
        end
        if tgt ∉ diamond.relevant_nodes
            push!(issues, "Edge ($src, $tgt): target $tgt not in relevant_nodes")
        end
    end

    # 4. Check conditioning nodes are subset of relevant nodes
    println("✓ Checking conditioning nodes are sources in diamond...")
    if !issubset(diamond.conditioning_nodes, diamond.relevant_nodes)
        push!(issues, "Conditioning nodes not subset of relevant nodes")
    end

    # 5. Build diamond subgraph and check conditioning nodes are sources
    diamond_targets = Set{Int64}()
    for (_, tgt) in diamond.edgelist
        push!(diamond_targets, tgt)
    end
    diamond_sources = setdiff(diamond.relevant_nodes, diamond_targets)

    if diamond_sources != diamond.conditioning_nodes
        push!(issues, "Conditioning nodes mismatch: Expected $diamond_sources, Got $(diamond.conditioning_nodes)")
    end

    # 6. Check for fork/join structure
    println("✓ Checking fork/join structure...")
    diamond_outgoing = Dict{Int64, Set{Int64}}()
    diamond_incoming = Dict{Int64, Set{Int64}}()

    for (src, tgt) in diamond.edgelist
        if !haskey(diamond_outgoing, src)
            diamond_outgoing[src] = Set{Int64}()
        end
        push!(diamond_outgoing[src], tgt)

        if !haskey(diamond_incoming, tgt)
            diamond_incoming[tgt] = Set{Int64}()
        end
        push!(diamond_incoming[tgt], src)
    end

    has_fork = any(length(children) > 1 for (node, children) in diamond_outgoing)
    has_join = any(length(parents) > 1 for (node, parents) in diamond_incoming)

    println("   Fork nodes in diamond: $(has_fork)")
    println("   Join nodes in diamond: $(has_join)")

    # 7. Report
    println("\n" * "-"^80)
    if isempty(issues)
        println("✅ DIAMOND STRUCTURE VALID")
    else
        println("❌ DIAMOND STRUCTURE INVALID - $(length(issues)) issues found:")
        for issue in issues
            println("   - $issue")
        end
    end
    println("-"^80)

    return isempty(issues)
end

function find_diamonds_containing_node(diamonds::Dict{UInt64, DiamondInfo}, node::Int64)
    matching = []

    for (hash, diamond) in diamonds
        if node in diamond.relevant_nodes
            push!(matching, (hash, diamond))
        end
    end

    println("\n🔍 Diamonds containing Node $node:")
    println("   Found: $(length(matching)) diamonds")

    for (hash, diamond) in matching
        println("\n   Diamond Hash: $hash")
        println("     Is Root: $(diamond.is_root)")
        println("     Relevant Nodes: $(sort(collect(diamond.relevant_nodes)))")
        println("     Conditioning Nodes: $(sort(collect(diamond.conditioning_nodes)))")
    end

    return matching
end

function trace_diamond_hierarchy(diamonds::Dict{UInt64, DiamondInfo}, root_diamond_hash::UInt64)
    if !haskey(diamonds, root_diamond_hash)
        println("⚠️  Diamond with hash $root_diamond_hash not found")
        return
    end

    root = diamonds[root_diamond_hash]

    println("\n" * "="^80)
    println("DIAMOND HIERARCHY TRACE")
    println("="^80)
    println("\nRoot Diamond Hash: $root_diamond_hash")
    println("Is Root: $(root.is_root)")
    println("Relevant Nodes: $(sort(collect(root.relevant_nodes)))")
    println("Conditioning Nodes: $(sort(collect(root.conditioning_nodes)))")
    println("Sub-Join Nodes: $(sort(collect(root.sub_join_nodes)))")
    println("Sub-Diamond Join Nodes: $(sort(collect(root.sub_diamond_joins)))")

    # Track visited diamonds to prevent infinite recursion
    visited_hashes = Set{UInt64}()
    max_depth = 50  # Safety limit

    # Recursively find sub-diamonds
    function trace_level(diamond_hash, level)
        # Check if already visited (circular reference detection)
        if diamond_hash in visited_hashes
            indent = "  " ^ level
            println("\n$(indent)⚠️  Diamond $diamond_hash already visited - CIRCULAR REFERENCE detected!")
            return
        end

        # Check depth limit
        if level > max_depth
            indent = "  " ^ level
            println("\n$(indent)⚠️  Max depth ($max_depth) reached - stopping traversal")
            return
        end

        push!(visited_hashes, diamond_hash)

        diamond = diamonds[diamond_hash]
        indent = "  " ^ level

        println("\n$(indent)📊 Diamond at Level $level (Hash: $diamond_hash)")
        println("$(indent)   Relevant Nodes: $(sort(collect(diamond.relevant_nodes)))")
        println("$(indent)   Conditioning Nodes: $(sort(collect(diamond.conditioning_nodes)))")
        println("$(indent)   Edge Count: $(length(diamond.edgelist))")
        println("$(indent)   Sub-Joins: $(sort(collect(diamond.sub_join_nodes)))")
        println("$(indent)   Sub-Diamonds at: $(sort(collect(diamond.sub_diamond_joins)))")

        # Find which diamonds have relevant nodes that are subsets
        for (sub_hash, sub_diamond) in diamonds
            if sub_hash != diamond_hash && issubset(sub_diamond.relevant_nodes, diamond.relevant_nodes)
                # Check if any sub-diamond join matches
                if !isempty(intersect(sub_diamond.relevant_nodes, diamond.sub_diamond_joins))
                    trace_level(sub_hash, level + 1)
                end
            end
        end
    end

    trace_level(root_diamond_hash, 0)

    # Report if circular references were found
    if length(visited_hashes) < length(diamonds)
        println("\n⚠️  Note: Only traced $(length(visited_hashes)) diamonds out of $(length(diamonds)) total")
    end

    println("\n" * "="^80)
end

# ============================================================================
# Anomaly Detection Functions
# ============================================================================

function detect_empty_conditioning_nodes(diamonds::Dict{UInt64, DiamondInfo})
    println("\n" * "="^80)
    println("DETECTING EMPTY CONDITIONING NODES")
    println("="^80)

    empty_cond_diamonds = []

    for (hash, diamond) in diamonds
        if isempty(diamond.conditioning_nodes)
            push!(empty_cond_diamonds, (hash, diamond))
        end
    end

    if isempty(empty_cond_diamonds)
        println("\n✅ No diamonds with empty conditioning nodes found")
    else
        println("\n❌ Found $(length(empty_cond_diamonds)) diamonds with EMPTY conditioning nodes:")

        for (hash, diamond) in empty_cond_diamonds
            println("\n  Diamond Hash: $hash")
            println("    Is Root: $(diamond.is_root)")
            println("    Relevant Nodes: $(sort(collect(diamond.relevant_nodes)))")
            println("    Conditioning Nodes: $(diamond.conditioning_nodes) [EMPTY!]")
            println("    Edge Count: $(length(diamond.edgelist))")

            # Analyze why conditioning nodes might be empty
            diamond_targets = Set{Int64}()
            for (_, tgt) in diamond.edgelist
                push!(diamond_targets, tgt)
            end
            diamond_sources = setdiff(diamond.relevant_nodes, diamond_targets)

            println("    Computed Sources (nodes with no incoming edges in diamond): $diamond_sources")

            if isempty(diamond_sources)
                println("    ⚠️  ISSUE: Diamond has no source nodes - possible circular dependency!")
            end
        end
    end

    println("\n" * "="^80)
    return empty_cond_diamonds
end

function detect_circular_dependencies(topo::NetworkTopology, diamonds::Dict{UInt64, DiamondInfo})
    println("\n" * "="^80)
    println("DETECTING CIRCULAR DEPENDENCIES IN DIAMONDS")
    println("="^80)

    circular_diamonds = []

    for (hash, diamond) in diamonds
        # Build subgraph from diamond edges
        sub_outgoing = Dict{Int64, Set{Int64}}()

        for (src, tgt) in diamond.edgelist
            if !haskey(sub_outgoing, src)
                sub_outgoing[src] = Set{Int64}()
            end
            push!(sub_outgoing[src], tgt)
        end

        # Check for cycles using DFS
        function has_cycle_dfs(graph)
            visited = Set{Int64}()
            temp_visited = Set{Int64}()

            function dfs(node)
                if node in temp_visited
                    return true  # Cycle detected
                end
                if node in visited
                    return false
                end
                push!(temp_visited, node)

                if haskey(graph, node)
                    for neighbor in graph[node]
                        if dfs(neighbor)
                            return true
                        end
                    end
                end

                delete!(temp_visited, node)
                push!(visited, node)
                return false
            end

            for node in keys(graph)
                if dfs(node)
                    return true
                end
            end
            return false
        end

        if has_cycle_dfs(sub_outgoing)
            push!(circular_diamonds, (hash, diamond))
        end
    end

    if isempty(circular_diamonds)
        println("\n✅ No circular dependencies found in diamonds")
    else
        println("\n❌ Found $(length(circular_diamonds)) diamonds with CIRCULAR DEPENDENCIES:")

        for (hash, diamond) in circular_diamonds
            println("\n  Diamond Hash: $hash")
            println("    Is Root: $(diamond.is_root)")
            println("    Relevant Nodes: $(sort(collect(diamond.relevant_nodes)))")
            println("    Conditioning Nodes: $(sort(collect(diamond.conditioning_nodes)))")
            println("    Edges in Diamond:")
            for edge in sort(diamond.edgelist)
                println("      $edge")
            end

            # Try to find the cycle
            println("    ⚠️  This diamond contains a cycle - INVALID DAG structure!")
        end
    end

    println("\n" * "="^80)
    return circular_diamonds
end

function analyze_diamond_formation_trace(topo::NetworkTopology, diamond::DiamondInfo, join_node::Int64)
    """
    Trace how a diamond at a specific join node should have been formed
    based on the original topology
    """
    println("\n" * "="^80)
    println("DIAMOND FORMATION TRACE")
    println("="^80)
    println("\nJoin Node: $join_node")
    println("Diamond Hash: $(diamond.hash)")

    # Step 1: Get parents of join node
    if !haskey(topo.incoming_index, join_node)
        println("\n⚠️  Join node $join_node has no parents in topology!")
        return
    end

    parents = topo.incoming_index[join_node]
    println("\n📊 Step 1: Parents of Join Node $join_node")
    println("   Parents: $(sort(collect(parents)))")

    if length(parents) < 2
        println("   ⚠️  Join node has < 2 parents - should not form diamond!")
        return
    end

    # Step 2: Find shared fork ancestors
    println("\n📊 Step 2: Finding Shared Fork Ancestors")
    parent_fork_ancestors = Dict{Int64, Set{Int64}}()

    for parent in parents
        fork_ancestors = Set{Int64}()
        for anc in topo.ancestors[parent]
            if anc in topo.fork_nodes
                push!(fork_ancestors, anc)
            end
        end
        parent_fork_ancestors[parent] = fork_ancestors
        println("   Parent $parent fork ancestors: $(sort(collect(fork_ancestors)))")
    end

    # Find shared fork ancestors
    ancestor_to_parents = Dict{Int64, Set{Int64}}()
    for (parent, fork_ancs) in parent_fork_ancestors
        for ancestor in fork_ancs
            if !haskey(ancestor_to_parents, ancestor)
                ancestor_to_parents[ancestor] = Set{Int64}()
            end
            push!(ancestor_to_parents[ancestor], parent)
        end
    end

    shared_fork_ancestors = Set{Int64}()
    for (ancestor, influenced_parents) in ancestor_to_parents
        if length(influenced_parents) >= 2
            push!(shared_fork_ancestors, ancestor)
        end
    end

    println("\n   Shared Fork Ancestors: $(sort(collect(shared_fork_ancestors)))")

    if isempty(shared_fork_ancestors)
        println("   ⚠️  No shared fork ancestors found - diamond should not exist!")
        return
    end

    # Step 3: Expected relevant nodes
    println("\n📊 Step 3: Computing Expected Relevant Nodes")
    expected_relevant = copy(shared_fork_ancestors)
    push!(expected_relevant, join_node)

    join_ancestors = topo.ancestors[join_node]
    for shared_ancestor in shared_fork_ancestors
        shared_descendants = topo.descendants[shared_ancestor]
        intermediates = intersect(shared_descendants, join_ancestors)
        union!(expected_relevant, intermediates)
    end

    println("   Expected Relevant Nodes: $(sort(collect(expected_relevant)))")
    println("   Actual Relevant Nodes: $(sort(collect(diamond.relevant_nodes)))")

    if expected_relevant != diamond.relevant_nodes
        println("   ⚠️  MISMATCH in relevant nodes!")
        println("      Missing: $(sort(collect(setdiff(expected_relevant, diamond.relevant_nodes))))")
        println("      Extra: $(sort(collect(setdiff(diamond.relevant_nodes, expected_relevant))))")
    else
        println("   ✅ Relevant nodes match expected")
    end

    # Step 4: Expected conditioning nodes
    println("\n📊 Step 4: Computing Expected Conditioning Nodes")
    expected_edges = filter(e -> e[1] in expected_relevant && e[2] in expected_relevant, topo.edges)

    expected_targets = Set{Int64}()
    for (_, tgt) in expected_edges
        push!(expected_targets, tgt)
    end
    expected_sources = setdiff(expected_relevant, expected_targets)

    println("   Expected Sources (conditioning): $(sort(collect(expected_sources)))")
    println("   Actual Conditioning Nodes: $(sort(collect(diamond.conditioning_nodes)))")

    if expected_sources != diamond.conditioning_nodes
        println("   ⚠️  MISMATCH in conditioning nodes!")
        println("      Missing: $(sort(collect(setdiff(expected_sources, diamond.conditioning_nodes))))")
        println("      Extra: $(sort(collect(setdiff(diamond.conditioning_nodes, expected_sources))))")
    else
        println("   ✅ Conditioning nodes match expected")
    end

    println("\n" * "="^80)
end

# ============================================================================
# Main Interactive Interface
# ============================================================================

function interactive_query()
    println("\n" * "="^80)
    println("NETWORK TOPOLOGY LOG ANALYZER")
    println("="^80)

    # Load log file
    log_file = "logs/drone-network-balanced-k3_float_topology_and_diamonds_20251214_151253.log"

    if !isfile(log_file)
        println("❌ Log file not found: $log_file")
        return
    end

    topo, diamonds = parse_topology_log(log_file)

    println("\n📊 Loaded Topology:")
    println("   Nodes: $(length(topo.nodes))")
    println("   Edges: $(length(topo.edges))")
    println("   Sources: $(length(topo.source_nodes))")
    println("   Sinks: $(length(topo.sink_nodes))")
    println("   Forks: $(length(topo.fork_nodes))")
    println("   Joins: $(length(topo.join_nodes))")
    println("   Diamonds: $(length(diamonds))")

    # Example queries
    println("\n" * "="^80)
    println("RUNNING EXAMPLE QUERIES")
    println("="^80)

    # Query 1: Node 181's ancestors
    query_node_ancestors(topo, 181)

    # Query 2: Node 18's ancestral edgelist
    query_ancestral_edgelist(topo, 18)

    # Query 3: Full info for node 18
    query_node_info(topo, 18)

    # Query 4: Find diamonds containing node 18
    find_diamonds_containing_node(diamonds, 18)

    # Query 5: Validate a root diamond
    root_diamonds = filter(d -> d[2].is_root, collect(diamonds))
    if !isempty(root_diamonds)
        first_root_hash = root_diamonds[1][1]
        first_root = root_diamonds[1][2]

        println("\n" * "="^80)
        println("VALIDATING FIRST ROOT DIAMOND")
        println("="^80)
        validate_diamond_structure(topo, first_root)

        # Trace its hierarchy (commented out - can cause deep recursion on large networks)
        # trace_diamond_hierarchy(diamonds, first_root_hash)
    end

    # Query 6: Detect anomalies - empty conditioning nodes
    detect_empty_conditioning_nodes(diamonds)

    # Query 7: Detect circular dependencies
    detect_circular_dependencies(topo, diamonds)

    # Query 8: Analyze diamond formation for a specific join node
    if !isempty(root_diamonds)
        first_root = root_diamonds[1][2]
        # Find a join node in the first root diamond
        if !isempty(first_root.relevant_nodes)
            # Get any join node from the diamond's relevant nodes
            diamond_joins = intersect(first_root.relevant_nodes, topo.join_nodes)
            if !isempty(diamond_joins)
                sample_join = first(diamond_joins)
                analyze_diamond_formation_trace(topo, first_root, sample_join)
            end
        end
    end

    return topo, diamonds
end

# ============================================================================
# Run
# ============================================================================

topo, diamonds = interactive_query()
