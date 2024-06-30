module InputProcessingModule
    import Cairo, Fontconfig 
    using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

    function read_graph_to_dict(filename::String)::Tuple{Vector{Tuple{Int64,Int64}}, Dict{Int64,Vector{Int64}}, Dict{Int64,Vector{Int64}}, Set{Int64}}
        edgelist = Vector{Tuple{Int64,Int64}}()
        outgoing_index = Dict{Int64,Vector{Int64}}()
        incoming_index = Dict{Int64,Vector{Int64}}()
        all_nodes = Set{Int64}()
        
        open(filename, "r") do file
            for (source, line) in enumerate(eachline(file))
                push!(all_nodes, source)
                targets = findall(!iszero, parse.(Int, split(line, ',')))
                if !isempty(targets)
                    append!(edgelist, ((source, target) for target in targets))
                    outgoing_index[source] = targets
                    union!(all_nodes, targets)
                    for target in targets
                        push!(get!(()->Int64[], incoming_index, target), source)
                    end
                end
            end
        end
        
        source_nodes = setdiff(all_nodes, keys(incoming_index))
        return edgelist, outgoing_index, incoming_index, source_nodes
    end

    function identify_fork_and_join_nodes(
        outgoing_index::Dict{Int64,Vector{Int64}},
        incoming_index::Dict{Int64,Vector{Int64}}
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
        edgelist::Vector{Tuple{Int64,Int64}},
        outgoing_index::Dict{Int64,Vector{Int64}},
        incoming_index::Dict{Int64,Vector{Int64}},
        fork_nodes::Set{Int64},
        join_nodes::Set{Int64},
        source_nodes::Set{Int64},
        )::Tuple{Vector{Set{Int64}}, Dict{Int64, Set{Int64}}, Dict{Int64, Set{Int64}}, Dict{Int64, Set{Int64}}}
        
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
        common_ancestors_dict = Dict{Int64, Set{Int64}}()

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
                            common_ancestors = pre_process_maximamal_diamond_subgraph(parents, ancestors, source_nodes, fork_nodes)
                            if !isempty(common_ancestors)
                                common_ancestors_dict[node] = common_ancestors
                            end
                        end
                    end
                end

                push!(current_set, node)
                
                # Process outgoing edges
                for target in get(outgoing_index, node, Int64[])
                    # Update ancestors efficiently
                    if !issubset(ancestors[node], ancestors[target])
                        union!(ancestors[target], ancestors[node])
                    end
                    
                    # Update descendants efficiently
                    new_descendants = setdiff(descendants[target], descendants[node])
                    if !isempty(new_descendants)
                        union!(descendants[node], new_descendants, [target])
                        # Propagate new descendants to all ancestors of the current node
                        for ancestor in ancestors[node]
                            if ancestor != node
                                union!(descendants[ancestor], new_descendants, [target])
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
        
        return (iteration_sets, ancestors, descendants, common_ancestors_dict)
    end

    function pre_process_maximamal_diamond_subgraph(
        parents::Vector{Int64},
        ancestors::Dict{Int64, Set{Int64}},
        source_nodes::Set{Int64},
        fork_nodes::Set{Int64}
        )::Set{Int64}
        # Get fork ancestors for each parent
        parent_fork_ancestors = [intersect(setdiff(ancestors[parent], source_nodes), fork_nodes) for parent in parents]
        
        # Find common ancestors shared by at least two parents
        common_ancestors = Set{Int64}()
        for i in 1:length(parents)-1
            for j in i+1:length(parents)
                union!(common_ancestors, intersect(parent_fork_ancestors[i], parent_fork_ancestors[j]))
            end
        end

        return common_ancestors
    end
end