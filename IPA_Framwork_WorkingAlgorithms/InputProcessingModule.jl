module InputProcessingModule
    import  Fontconfig 
    using Random, Graphs,   DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

    

    """
        read_graph_to_dict(filename::String)

        Reads a directed graph from a file where each line represents a node and its outgoing edges.
        Returns a tuple containing:
        - edgelist: Vector of (source, target) pairs
        - outgoing_index: Dict mapping nodes to their outgoing neighbors
        - incoming_index: Dict mapping nodes to their incoming neighbors
        - source_nodes: Set of nodes with no incoming edges

        Throws:
            SystemError if file cannot be opened
            ArgumentError if file format is invalid
    """
    function read_graph_to_dict(filename::String)::Tuple{Vector{Tuple{Int64,Int64}}, Dict{Int64,Set{Int64}}, Dict{Int64,Set{Int64}}, Set{Int64}}
        edgelist = Vector{Tuple{Int64,Int64}}()
        outgoing_index = Dict{Int64,Set{Int64}}()
        incoming_index = Dict{Int64,Set{Int64}}()
        all_nodes = Set{Int64}()
        
        isfile(filename) || throw(SystemError("File not found: $filename"))
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
        # Add empty set for nodes that have no incoming edges
        for node in source_nodes
            incoming_index[node] = Set{Int64}()
        end
        
        return edgelist, outgoing_index, incoming_index, source_nodes
    end

    """
        identify_fork_and_join_nodes(outgoing_index, incoming_index)

        Identifies fork nodes (nodes with multiple outgoing edges) and join nodes (nodes with multiple incoming edges).
        Returns a tuple of (fork_nodes, join_nodes).
    """
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
    
    """
        find_iteration_sets(edgelist, outgoing_index, incoming_index, fork_nodes, join_nodes, source_nodes)

        Performs a topological sort while tracking ancestor-descendant relationships and diamond patterns.
        Returns:
        - iteration_sets: Vector of node sets that can be processed in parallel
        - ancestors: Dict mapping each node to its ancestor set
        - descendants: Dict mapping each node to its descendant set
        - common_ancestors_dict: Dict mapping join nodes to their diamond structures

        Throws:
            ArgumentError if graph contains cycles
    """
    function find_iteration_sets(
        edgelist::Vector{Tuple{Int64,Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}}
        )::Tuple{Vector{Set{Int64}}, Dict{Int64, Set{Int64}}, Dict{Int64, Set{Int64}}}
        
        isempty(edgelist) && return (Vector{Set{Int64}}(), Dict{Int64,Set{Int64}}(), Dict{Int64,Set{Int64}}(), Dict{Int64,DiamondStructure}())
        
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
        
        return (iteration_sets, ancestors, descendants)
    end
        
   
end