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
    diamond::Diamond
    non_diamond_parents::Set{Int64}
    join_node::Int64
end

"""
Implements the complete clean single-pass diamond detection algorithm.

# Algorithm Steps:
1. For each join node: Get all parents from incoming_index
2. Collect ALL shared ancestors across all parents (union of all ancestor sets)
3a. Filter out nodes that are not in fork_nodes
3b. Filter out irrelevant sources from shared ancestors
4. Extract complete distinct edge list of paths from remaining shared ancestors to join node for diamond
5. From edgelist identify sources (nodes with no incoming edges in the extracted edge list)
6. Find highest nodes (nodes both in filtered shared ancestor and in the sources)
7. Identify intermediate nodes: relevant_nodes that are NOT (sources OR highest_nodes OR join_node)
8. For each intermediate node: Ensure ALL its incoming edges are included in the diamond's edge list
9. Build single Diamond with: edgelist, highest_nodes, relevant_nodes

# Arguments
- join_nodes::Set{Int64}: Set of join nodes to process
- incoming_index::Dict{Int64, Set{Int64}}: Maps each node to its direct parents
- ancestors::Dict{Int64, Set{Int64}}: Maps each node to all its ancestors
- descendants::Dict{Int64, Set{Int64}}: Maps each node to all its descendants
- source_nodes::Set{Int64}: Set of source nodes to filter out
- fork_nodes::Set{Int64}: Set of fork nodes - only these can be diamond tops
- edgelist::Vector{Tuple{Int64, Int64}}: Complete edge list of the graph
- node_priors::Union{Dict{Int64,Float64}, Dict{Int64,pbox}, Dict{Int64,Interval}}: Node prior values

# Returns
- Dict{Int64, DiamondsAtNode}: Maps join nodes to their diamond structures
"""
function identify_and_group_diamonds(
    join_nodes::Set{Int64},
    incoming_index::Dict{Int64, Set{Int64}},
    ancestors::Dict{Int64, Set{Int64}},
    descendants::Dict{Int64, Set{Int64}},  
    source_nodes::Set{Int64},
    fork_nodes::Set{Int64},  # CRITICAL - Added parameter
    edgelist::Vector{Tuple{Int64, Int64}},      
    node_priors::Union{Dict{Int64,Float64}, Dict{Int64,pbox}, Dict{Int64,Interval}}
)::Dict{Int64, DiamondsAtNode}
    
    result = Dict{Int64, DiamondsAtNode}()
    
    for join_node in join_nodes
        # Step 1: Get Parents (FIXED)
        parents = get(incoming_index, join_node, Set{Int64}())
        
        # Step 2: Union ALL Ancestor Sets
        shared_ancestors = Set{Int64}()
        for parent in parents
            union!(shared_ancestors, get(ancestors, parent, Set{Int64}()))
            push!(shared_ancestors, parent)  # Include parent itself
        end
        
        # Step 3a: Filter for Fork Nodes (NEW REQUIREMENT)
        fork_shared_ancestors = intersect(shared_ancestors, fork_nodes)
        

        # Step 3b: Filter Out Irrelevant Sources
        # Find source nodes that are irrelevant (prior = 0 or 1) for diamond structure analysis
        first_key = first(keys(node_priors))
        
        irrelevant_sources = Set{Int64}()
        if isa(node_priors[first_key], pbox)
            for node in source_nodes
                prior = node_priors[node]
                # Check if mean bounds are exactly 0 or exactly 1
                if (prior.ml == 0.0 && prior.mh == 0.0) || (prior.ml == 1.0 && prior.mh == 1.0)
                    push!(irrelevant_sources, node)
                end
            end
        elseif isa(node_priors[first_key], Interval)
            irrelevant_sources = Set{Int64}()
            for node in source_nodes
                prior = node_priors[node]
                # Check if interval bounds are exactly [0,0] or exactly [1,1]
                if (prior.lower == 0.0 && prior.upper == 0.0) || (prior.lower == 1.0 && prior.upper == 1.0)
                    push!(irrelevant_sources, node)
                end
            end
        else
            # Float64 case
            irrelevant_sources = Set(node for node in source_nodes if node_priors[node] == 0.0 || node_priors[node] == 1.0)
        end
        valid_shared_ancestors = setdiff(fork_shared_ancestors, irrelevant_sources)
        
        # Early termination if no valid shared ancestors
        if isempty(valid_shared_ancestors)
            continue
        end
        
        # Step 4: Build Relevant Nodes (SPACE EFFICIENT)
        relevant_nodes = copy(valid_shared_ancestors)
        push!(relevant_nodes, join_node)
        
        # Add nodes that are descendants of valid shared ancestors AND ancestors of join_node
        join_ancestors = get(ancestors, join_node, Set{Int64}())
        for shared_ancestor in valid_shared_ancestors
            shared_descendants = get(descendants, shared_ancestor, Set{Int64}())
            # Intersection: descendants of shared ancestor AND ancestors of join node
            relevant_intermediate = intersect(shared_descendants, join_ancestors)
            union!(relevant_nodes, relevant_intermediate)
        end
        
        # Step 5: Extract Diamond Edges (EFFICIENT)
        diamond_edges = Set{Tuple{Int64, Int64}}()
        for edge in edgelist
            source, target = edge
            if source in relevant_nodes && target in relevant_nodes
                push!(diamond_edges, edge)
            end
        end
        
        # Step 6: Find Sources in Diamond Subgraph
        targets_in_diamond = Set{Int64}()
        for (_, target) in diamond_edges
            push!(targets_in_diamond, target)
        end
        sources_in_diamond = setdiff(relevant_nodes, targets_in_diamond)
        
        # Step 7: Find Highest Nodes
        highest_nodes = intersect(valid_shared_ancestors, sources_in_diamond)
        
        # Step 8: Add Completeness Edges for Intermediate Nodes
        intermediate_nodes = setdiff(relevant_nodes, union(sources_in_diamond, Set([join_node])))
        
        for intermediate_node in intermediate_nodes
            incoming_edges = get(incoming_index, intermediate_node, Set{Int64}())
            for source_node in incoming_edges
                edge = (source_node, intermediate_node)
                push!(diamond_edges, edge)
                push!(relevant_nodes, source_node)  # Add source to relevant nodes
            end
        end
        
        # Step 9: Build Final Diamond Structure
        # Update relevant_nodes to include all nodes in final edgelist
        final_relevant_nodes = Set{Int64}()
        for (source, target) in diamond_edges
            push!(final_relevant_nodes, source)
            push!(final_relevant_nodes, target)
        end
        
        diamond = Diamond(final_relevant_nodes, highest_nodes, collect(diamond_edges))
        non_diamond_parents = setdiff(parents, final_relevant_nodes)
        
        # Only add to result if there's a valid diamond (non-empty highest_nodes)
        if !isempty(highest_nodes)
            result[join_node] = DiamondsAtNode(diamond, non_diamond_parents, join_node)
        end
    end
    
    return result
end

end # module DiamondProcessingModule