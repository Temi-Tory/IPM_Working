using Printf

# Pretty printing functions for diamond structures

"""
Pretty print a Diamond structure
"""
function Base.show(io::IO, d::Diamond)
    println(io, "Diamond:")
    println(io, "  relevant_nodes: $(sort(collect(d.relevant_nodes)))")
    println(io, "  conditioning_nodes: $(sort(collect(d.conditioning_nodes)))")
    println(io, "  edgelist: $(length(d.edgelist)) edges")
    if length(d.edgelist) <= 10
        for edge in d.edgelist
            println(io, "    $(edge[1]) → $(edge[2])")
        end
    else
        for edge in d.edgelist[1:5]
            println(io, "    $(edge[1]) → $(edge[2])")
        end
        println(io, "    ... $(length(d.edgelist) - 5) more edges")
    end
end

"""
Pretty print a DiamondsAtNode structure
"""
function Base.show(io::IO, dan::DiamondsAtNode)
    println(io, "DiamondsAtNode at join node $(dan.join_node):")
    println(io, "  non_diamond_parents: $(sort(collect(dan.non_diamond_parents)))")
    println(io, "  diamond:")
    # Indent the diamond output
    diamond_str = sprint(show, dan.diamond)
    for line in split(diamond_str, '\n')[1:end-1]  # Remove empty last line
        println(io, "    $line")
    end
end

"""
Pretty print a DiamondComputationData structure
"""
function Base.show(io::IO, ::MIME"text/plain", dcd::DiamondComputationData{T}) where T
    println(io, "DiamondComputationData{$T}:")
    
    # Main diamond
    println(io, "\n📍 Main Diamond:")
    diamond_str = sprint(show, dcd.diamond)
    for line in split(diamond_str, '\n')[1:end-1]
        println(io, "  $line")
    end
    
    # Subgraph structure summary
    println(io, "\n🔍 Subgraph Structure:")
    println(io, "  Sources: $(sort(collect(dcd.sub_sources)))")
    println(io, "  Fork nodes: $(sort(collect(dcd.sub_fork_nodes)))")
    println(io, "  Join nodes: $(sort(collect(dcd.sub_join_nodes)))")
    println(io, "  Iteration sets: $(length(dcd.sub_iteration_sets)) sets")
    
    # Network topology summary
    println(io, "\n🌐 Network Topology:")
    println(io, "  Nodes with outgoing edges: $(length(dcd.sub_outgoing_index))")
    println(io, "  Nodes with incoming edges: $(length(dcd.sub_incoming_index))")
    println(io, "  Nodes with priors: $(length(dcd.sub_node_priors))")
    
    # Sub-diamonds summary
    println(io, "\n💎 Sub-diamond Structures: $(length(dcd.sub_diamond_structures))")
    if length(dcd.sub_diamond_structures) > 0
        for node_id in sort(collect(keys(dcd.sub_diamond_structures)))
            sub_dan = dcd.sub_diamond_structures[node_id]
            println(io, "  Node $node_id: $(length(sub_dan.diamond.relevant_nodes)) relevant nodes, $(length(sub_dan.non_diamond_parents)) non-diamond parents")
        end
    end
end

"""
Compact view for DiamondComputationData
"""
function Base.show(io::IO, dcd::DiamondComputationData{T}) where T
    print(io, "DiamondComputationData{$T}(")
    print(io, "$(length(dcd.diamond.relevant_nodes)) nodes, ")
    print(io, "$(length(dcd.sub_diamond_structures)) sub-diamonds)")
end

"""
Pretty print iteration sets with better formatting
"""
function pretty_print_iteration_sets(io::IO, iteration_sets::Vector{Set{Int64}})
    println(io, "Iteration Sets ($(length(iteration_sets)) total):")
    for (i, iset) in enumerate(iteration_sets)
        nodes = sort(collect(iset))
        if length(nodes) <= 8
            println(io, "  Set $i: $nodes")
        else
            println(io, "  Set $i: [$(nodes[1:4]...), ..., $(nodes[end-1:end]...)] ($(length(nodes)) nodes)")
        end
    end
end

"""
Pretty print node connections (ancestors/descendants)
"""
function pretty_print_node_connections(io::IO, connections::Dict{Int64, Set{Int64}}, label::String)
    println(io, "$label:")
    if length(connections) <= 10
        for node in sort(collect(keys(connections)))
            connected = connections[node]
            connected_list = sort(collect(connected))
            if length(connected_list) <= 5
                println(io, "  Node $node: $connected_list")
            else
                println(io, "  Node $node: [$(connected_list[1:3]...), ...] ($(length(connected_list)) total)")
            end
        end
    else
        println(io, "  $(length(connections)) nodes with connections (showing first 5):")
        for node in sort(collect(keys(connections)))[1:5]
            connected = connections[node]
            connected_list = sort(collect(connected))
            if length(connected_list) <= 5
                println(io, "    Node $node: $connected_list")
            else
                println(io, "    Node $node: [$(connected_list[1:3]...), ...] ($(length(connected_list)) total)")
            end
        end
        println(io, "    ... $(length(connections) - 5) more nodes")
    end
end

"""
Detailed inspection function for DiamondComputationData
"""
function inspect_diamond(dcd::DiamondComputationData{T}; show_details=false) where T
    println("🔍 DETAILED DIAMOND INSPECTION")
    println("=" ^ 50)
    
    # Basic info
    println("\n📊 Basic Statistics:")
    println("  Type: DiamondComputationData{$T}")
    println("  Main diamond nodes: $(length(dcd.diamond.relevant_nodes))")
    println("  Main diamond edges: $(length(dcd.diamond.edgelist))")
    println("  Sub-diamonds: $(length(dcd.sub_diamond_structures))")
    
    if show_details
        println("\n🌐 Network Structure:")
        pretty_print_node_connections(stdout, dcd.sub_ancestors, "Ancestors")
        println()
        pretty_print_node_connections(stdout, dcd.sub_descendants, "Descendants")
        
        println("\n🔄 Iteration Structure:")
        pretty_print_iteration_sets(stdout, dcd.sub_iteration_sets)
        
        println("\n💎 Sub-diamond Details:")
        for node_id in sort(collect(keys(dcd.sub_diamond_structures)))
            sub_dan = dcd.sub_diamond_structures[node_id]
            println("  " * "─" ^ 40)
            println("  Sub-diamond at node $node_id:")
            sub_dan_str = sprint(show, sub_dan)
            for line in split(sub_dan_str, '\n')[1:end-1]
                println("    $line")
            end
        end
    end
    
    println("\n" * "=" ^ 50)
end

# Usage examples and convenience functions

"""
Quick summary of a diamond hash collection
"""
function summarize_diamond_collection(unique_diamonds::Dict)
    println("Diamond Collection Summary:")
    println("  Total unique diamonds: $(length(unique_diamonds))")
    
    if length(unique_diamonds) > 0
        node_counts = [length(dcd.diamond.relevant_nodes) for dcd in values(unique_diamonds)]
        sub_diamond_counts = [length(dcd.sub_diamond_structures) for dcd in values(unique_diamonds)]
        
        println("  Node count range: $(minimum(node_counts)) - $(maximum(node_counts))")
        println("  Sub-diamond count range: $(minimum(sub_diamond_counts)) - $(maximum(sub_diamond_counts))")
        
        println("\nTop 5 largest diamonds by node count:")
        # Create a vector of (hash, size, dcd) tuples for sorting
        diamond_info = [(hash, length(dcd.diamond.relevant_nodes), dcd) for (hash, dcd) in unique_diamonds]
        sorted_info = sort(diamond_info, by=x->x[2], rev=true)  # Sort by size (x[2])
        
        for (i, (hash, size, dcd)) in enumerate(sorted_info[1:min(5, length(sorted_info))])
            println("  $i. Hash: $(hash[1:8])... | $size nodes | $(length(dcd.sub_diamond_structures)) sub-diamonds")
        end
    end
end