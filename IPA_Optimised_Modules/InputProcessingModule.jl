module InputProcessingModule
    import Cairo, Fontconfig 
    using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics
    
    #The ancestor structure inherently captures the conditions that must be satisfied for a node to be reachable,
    # which makes it straightforward to incorporate conditional probability evaluations as part of the reachability logic.
    struct AncestorGroup
        ancestor_ids::Vector{Set{Int64}}  # Ordered set of sets
        parent_ids::Vector{Int64}
    end
    
    struct NodeCommonAncestors
        node_id::Int64
        ancestor_groups::Vector{AncestorGroup}
    end
    

    function read_graph_to_dict(filename::String)::Tuple{Vector{Tuple{Int64,Int64}}, Dict{Int64,Set{Int64}}, Dict{Int64,Set{Int64}}, Set{Int64}, Set{Int64}}
        edgelist = Vector{Tuple{Int64,Int64}}()
        outgoing_index = Dict{Int64,Set{Int64}}()
        incoming_index = Dict{Int64,Set{Int64}}()
        all_nodes = Set{Int64}()
        
        open(filename, "r") do file
            for (source, line) in enumerate(eachline(file))
                push!(all_nodes, source)
                targets = Set(findall(!iszero, parse.(Int, split(line, ','))))
                if !isempty(targets)
                    append!(edgelist, ((source, target) for target in targets))
                    outgoing_index[source] = targets
                    union!(all_nodes, targets)
                    for target in targets
                        if !haskey(incoming_index, target)
                            incoming_index[target] = Set{Int64}()
                        end
                        push!(incoming_index[target], source)
                    end
                end
            end
        end
        
        source_nodes = setdiff(all_nodes, keys(incoming_index))
        return edgelist, outgoing_index, incoming_index, source_nodes, all_nodes
    end

    function identify_fork_and_join_nodes(
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}}
        )::Tuple{Set{Int64},Set{Int64}}
        
        fork_nodes = Set{Int64}()
        join_nodes = Set{Int64}()
    
        # Identify fork nodes
        for (node, children) in outgoing_index
            if length(children) > 1
                push!(fork_nodes, node)
            end
        end
    
        # Identify join nodes
        for (node, parents) in incoming_index
            if length(parents) > 1
                push!(join_nodes, node)
            end
        end
    
        return fork_nodes, join_nodes
    end
    
    function find_iteration_sets(
        edgelist::Vector{Tuple{Int64, Int64}},
        outgoing_index::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        fork_nodes::Set{Int64},
        join_nodes::Set{Int64},
        source_nodes::Set{Int64},
        )::Tuple{Vector{Set{Int64}}, Dict{Int64, Set{Int64}}, Dict{Int64, Set{Int64}}, Vector{NodeCommonAncestors}}
    
        # Find the maximum node id
        n = maximum(max(first(edge), last(edge)) for edge in edgelist)
        
        in_degree = zeros(Int, n)
        all_nodes = Set{Int64}()
        
        # Calculate initial in-degrees and collect all nodes
        for (source, target) in edgelist
            in_degree[target] += 1
            push!(all_nodes, source, target)
        end
        
        ancestors = Dict(node => Set{Int64}([node]) for node in all_nodes)
        descendants = Dict(node => Set{Int64}() for node in all_nodes)
        common_ancestors_list = Vector{NodeCommonAncestors}()
    
        queue = Queue{Int64}()
        for node in all_nodes
            if !haskey(incoming_index, node) || isempty(incoming_index[node])
                enqueue!(queue, node)
            end
        end
        
        iteration_sets = Vector{Set{Int64}}()
        
        while !isempty(queue)
            current_set = Set{Int64}()
            
            # Process all nodes in the current level
            level_size = length(queue)
            for _ in 1:level_size
                node = dequeue!(queue)
    
                if node in join_nodes
                    if haskey(incoming_index, node)
                        parents = incoming_index[node]
                        if length(parents) > 1
                            node_common_ancestors = pre_process_maximamal_diamond_subgraph(
                                node, parents, ancestors, source_nodes, fork_nodes, iteration_sets
                            )
                            if !isempty(node_common_ancestors.ancestor_groups)
                                push!(common_ancestors_list, node_common_ancestors)
                            end
                        end
                    end
                end
            
                push!(current_set, node)
                
                # Process outgoing edges
                for target in get(outgoing_index, node, Set{Int64}())
                    # Update ancestors efficiently
                    if !issubset(ancestors[node], ancestors[target])
                        union!(ancestors[target], ancestors[node])
                    end
                    
                    # Update descendants efficiently
                    new_descendants = setdiff(descendants[target], descendants[node])
                    if !isempty(new_descendants)
                        union!(descendants[node], new_descendants, Set([target]))
                        # Propagate new descendants to all ancestors of the current node
                        for ancestor in ancestors[node]
                            if ancestor != node
                                union!(descendants[ancestor], new_descendants, Set([target]))
                            end
                        end
                    elseif !(target in descendants[node])
                        push!(descendants[node], target)
                        # Propagate new descendant to all ancestors of the current node
                        for ancestor in ancestors[node]
                            if ancestor != node
                                push!(descendants[ancestor], target)
                            end
                        end
                    end
                    
                    in_degree[target] -= 1
                    if in_degree[target] == 0
                        enqueue!(queue, target)
                    end
                end
            end
            
            push!(iteration_sets, current_set)
        end
        
        return (iteration_sets, ancestors, descendants, common_ancestors_list)
    end
    
    
    function pre_process_maximamal_diamond_subgraph(
    node_id::Int64,
    parents::Set{Int64},
    ancestors::Dict{Int64, Set{Int64}},
    source_nodes::Set{Int64},
    fork_nodes::Set{Int64},
    iteration_sets::Vector{Set{Int64}}
    )::NodeCommonAncestors
        # Create a mapping from each parent to its fork ancestors
        parent_to_fork_ancestors = Dict{Int64, Set{Int64}}()
        for parent in parents
            fork_ancestors = intersect(setdiff(ancestors[parent], source_nodes), fork_nodes)
            parent_to_fork_ancestors[parent] = fork_ancestors
        end

        # Create a mapping from parent sets to ordered ancestor sets
        parent_sets_to_ancestors = Dict{Set{Int64}, Vector{Set{Int64}}}()

        # Create a mapping from nodes to their iteration index
        node_to_iteration = Dict{Int64, Int64}()
        for (i, iteration_set) in enumerate(iteration_sets)
            for node in iteration_set
                node_to_iteration[node] = i
            end
        end

        # For each fork ancestor, record the parent set that shares it
        for (parent, fork_ancestors) in parent_to_fork_ancestors
            for fork_ancestor in fork_ancestors
                # For each fork ancestor, find the set of parents that share it
                parent_set = Set{Int64}()
                for (other_parent, other_ancestors) in parent_to_fork_ancestors
                    if fork_ancestor in other_ancestors
                        push!(parent_set, other_parent)
                    end
                end
                if length(parent_set) >= 2
                    if !haskey(parent_sets_to_ancestors, parent_set)
                        parent_sets_to_ancestors[parent_set] = [Set{Int64}() for _ in 1:length(iteration_sets)]
                    end
                    iteration_index = node_to_iteration[fork_ancestor]
                    push!(parent_sets_to_ancestors[parent_set][iteration_index], fork_ancestor)
                end
            end
        end

        # Build the ancestor_groups vector
        ancestor_groups = Vector{AncestorGroup}()
        for (parent_set, ancestor_sets) in parent_sets_to_ancestors
            # Remove empty sets and convert to Vector{Set{Int64}}
            non_empty_ancestor_sets = Vector{Set{Int64}}(filter(!isempty, ancestor_sets))
            push!(ancestor_groups, AncestorGroup(non_empty_ancestor_sets, collect(parent_set)))
        end

        # Return a NodeCommonAncestors instance
        return NodeCommonAncestors(node_id, ancestor_groups)
    end
end