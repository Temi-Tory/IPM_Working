module InputProcessingModule
    import Fontconfig 
    using Random, DataFrames, DelimitedFiles, Distributions, JSON,
        DataStructures, SparseArrays, Combinatorics

    #export ProbabilitySlices, read_graph_to_dict, identify_fork_and_join_nodes, find_iteration_sets, Interval
    export Interval

    # Basic interval type
    struct Interval
        lower::Float64
        upper::Float64
        
        function Interval(lower::Float64, upper::Float64)
            if lower > upper
                throw(ArgumentError("Lower bound must be ≤ upper bound"))
            end
            new(lower, upper)
        end
    end

    # Constructor for creating interval from single value (deterministic case)
    Interval(value::Float64) = Interval(value, value)
    """
        struct ProbabilitySlices

        A structure to hold probability values and their corresponding weights.
        The weights are used to sample from the values.

        Fields:
        - values: Vector of probability values
        - weights: Vector of weights corresponding to the values

        Constructor:
        - ProbabilitySlices(values::Vector{Float64}, weights::Vector{Float64})
    """
    struct ProbabilitySlices
        values::Vector{Float64}
        weights::Vector{Float64}
        
        # Constructor with validation
        function ProbabilitySlices(values::Vector{Float64}, weights::Vector{Float64})
            if length(values) != length(weights)
                throw(ArgumentError("Values and weights must have same length"))
            end
            if !all(0 .<= values .<= 1)
                throw(ArgumentError("Values must be probabilities between 0 and 1"))
            end
            if abs(sum(weights) - 1.0) > 1e-10
                throw(ArgumentError("Weights must sum to 1.0"))
            end
            new(values, weights)
        end
    end
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
    function read_graph_to_dict(filename::String)::Tuple{Vector{Tuple{Int64,Int64}}, Dict{Int64,Set{Int64}}, Dict{Int64,Set{Int64}}, Set{Int64}, Dict{Int64, Float64}, Dict{Tuple{Int64,Int64}, Float64}}
        edgelist = Vector{Tuple{Int64,Int64}}()
        outgoing_index = Dict{Int64,Set{Int64}}()
        incoming_index = Dict{Int64,Set{Int64}}()
        all_nodes = Set{Int64}()
        node_priors = Dict{Int64, Float64}()
        edge_probabilities = Dict{Tuple{Int64,Int64}, Float64}()
        
        isfile(filename) || throw(SystemError("File not found: $filename"))
        open(filename, "r") do file
            for (source, line) in enumerate(eachline(file))
                values = parse.(Float64, split(line, ','))
                
                # Validate number of columns
                length(values) >= 2 || throw(ArgumentError("Line $source: Invalid format - need at least 2 columns"))
                
                # Extract and validate node prior
                prior = values[1]
                if !(0 ≤ prior ≤ 1)
                    throw(ArgumentError("Line $source: Node prior $prior not in range [0,1]"))
                end
                node_priors[source] = prior
                
                # Process edge probabilities (skip first column which is the prior)
                edge_probs = values[2:end]
                push!(all_nodes, source)
                
                for (target, prob) in enumerate(edge_probs)
                    # Validate edge probability
                    if prob != 0 && !(0 < prob ≤ 1)
                        throw(ArgumentError("Line $source: Edge probability $prob to node $target not in range (0,1]"))
                    end
                    
                    if prob > 0
                        # Check for self-loops
                        if source == target
                            throw(ArgumentError("Line $source: Self-loop detected"))
                        end
                        
                        push!(edgelist, (source, target))
                        if !haskey(outgoing_index, source)
                            outgoing_index[source] = Set{Int64}()
                        end
                        push!(outgoing_index[source], target)
                        if !haskey(incoming_index, target)
                            incoming_index[target] = Set{Int64}()
                        end
                        push!(incoming_index[target], source)
                        edge_probabilities[(source, target)] = prob
                        push!(all_nodes, target)
                    end
                end
            end
        end
    
        # Validate DAG property
        function has_cycle(graph::Dict{Int64,Set{Int64}})
            visited = Set{Int64}()
            temp_visited = Set{Int64}()
            
            function dfs(node::Int64)
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
        
        if has_cycle(outgoing_index)
            throw(ArgumentError("Graph contains cycles - must be a DAG"))
        end
    
        source_nodes = setdiff(all_nodes, keys(incoming_index))
        # Add empty set for nodes that have no incoming edges
        for node in source_nodes
            incoming_index[node] = Set{Int64}()
        end
        
        return edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities
    end

    """
        read_graph_to_dict(adj_matrix_file::String, probabilities_file::String)

        Reads a directed graph from:
        - An adjacency matrix file (CSV) defining graph structure
        - A JSON file containing probability slices for nodes and edges

        Returns a tuple containing:
        - edgelist: Vector of (source, target) pairs
        - outgoing_index: Dict mapping nodes to their outgoing neighbors
        - incoming_index: Dict mapping nodes to their incoming neighbors
        - source_nodes: Set of nodes with no incoming edges
        - node_priors: Dict mapping nodes to their ProbabilitySlices
        - edge_probabilities: Dict mapping (source,target) pairs to ProbabilitySlices

        Throws:
            SystemError if files cannot be opened
            ArgumentError if file formats are invalid
    """
    function read_graph_to_dict(adj_matrix_file::String, probabilities_file::String
        )::Union{
        Tuple{Vector{Tuple{Int64,Int64}}, Dict{Int64,Set{Int64}}, Dict{Int64,Set{Int64}}, 
                Set{Int64}, Dict{Int64, ProbabilitySlices}, Dict{Tuple{Int64,Int64}, ProbabilitySlices}},
        Tuple{Vector{Tuple{Int64,Int64}}, Dict{Int64,Set{Int64}}, Dict{Int64,Set{Int64}}, 
                Set{Int64}, Dict{Int64, Interval}, Dict{Tuple{Int64,Int64}, Interval}}
     }
    
        isfile(adj_matrix_file) || throw(SystemError("File not found: $adj_matrix_file"))
        isfile(probabilities_file) || throw(SystemError("File not found: $probabilities_file"))
        
        adj_matrix = readdlm(adj_matrix_file, ',', Int)
        prob_data = JSON.parsefile(probabilities_file)
        
        edgelist = Vector{Tuple{Int64,Int64}}()
        outgoing_index = Dict{Int64,Set{Int64}}()
        incoming_index = Dict{Int64,Set{Int64}}()
        all_nodes = Set{Int64}()
        
        # Detect format from first node
        first_node = first(prob_data["nodes"])
        is_interval = haskey(last(first_node), "lower")
        
        # Initialize based on detected format
        if is_interval
            node_priors = Dict{Int64, Interval}()
            edge_probabilities = Dict{Tuple{Int64,Int64}, Interval}()
            
            for (node_str, node_data) in prob_data["nodes"]
                node = parse(Int, node_str)
                node_priors[node] = Interval(
                    Float64(node_data["lower"]),
                    Float64(node_data["upper"])
                )
                push!(all_nodes, node)
            end
        else
            node_priors = Dict{Int64, ProbabilitySlices}()
            edge_probabilities = Dict{Tuple{Int64,Int64}, ProbabilitySlices}()
            
            for (node_str, node_data) in prob_data["nodes"]
                node = parse(Int, node_str)
                node_priors[node] = ProbabilitySlices(
                    Float64.(node_data["values"]),
                    Float64.(node_data["weights"])
                )
                push!(all_nodes, node)
            end
        end
        
        # Process graph structure
        n_nodes = size(adj_matrix, 1)
        for i in 1:n_nodes, j in 1:n_nodes
            if adj_matrix[i,j] == 1
                push!(edgelist, (i,j))
                push!(get!(outgoing_index, i, Set{Int64}()), j)
                push!(get!(incoming_index, j, Set{Int64}()), i)
        
                edge_key = "($i,$j)"
                if !haskey(prob_data["edges"], edge_key)
                    throw(ArgumentError("Missing probability data for edge $edge_key"))
                end
                
                edge_data = prob_data["edges"][edge_key]
                if is_interval
                    edge_probabilities[(i,j)] = Interval(
                        Float64(edge_data["lower"]),
                        Float64(edge_data["upper"])
                    )
                else
                    edge_probabilities[(i,j)] = ProbabilitySlices(
                        Float64.(edge_data["values"]),
                        Float64.(edge_data["weights"])
                    )
                end
            end
    end
    
    # Validate DAG property
    function has_cycle(graph::Dict{Int64,Set{Int64}})
        visited = Set{Int64}()
        temp_visited = Set{Int64}()
        
        function dfs(node::Int64)
            node in temp_visited && return true
            node in visited && return false
            
            push!(temp_visited, node)
            if haskey(graph, node)
                for neighbor in graph[node]
                    dfs(neighbor) && return true
                end
            end
            delete!(temp_visited, node)
            push!(visited, node)
            return false
        end
        
        return any(dfs(node) for node in keys(graph))
    end
    
    has_cycle(outgoing_index) && throw(ArgumentError("Graph contains cycles - must be a DAG"))
    
    # Handle source nodes
    source_nodes = setdiff(all_nodes, keys(incoming_index))
    for node in source_nodes
        incoming_index[node] = Set{Int64}()
    end
    
    return edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities
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