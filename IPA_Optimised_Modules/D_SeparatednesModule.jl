module D_SeparatednesModule
    import Cairo, Fontconfig 
    using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

    function is_reachable(
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        x::Set{Int64},
        a::Set{Int64},
        z::Set{Int64}
        )::Set{Int64}
        #=  
            """Modified Bayes-Ball algorithm for finding d-connected nodes.

            Find all nodes in `a` that are d-connected to those in `x` by
            those in `z`. This is an implementation of the function
            `REACHABLE` in [1]_ (which is itself a modification of the
            Bayes-Ball algorithm [2]_) when restricted to DAGs.

            Parameters
            ----------
            G : nx.DiGraph
                A NetworkX DAG.
            x : node | set
                A node in the DAG, or a set of nodes.
            a : node | set
                A (set of) node(s) in the DAG containing the ancestors of `x`.
            z : node | set
                The node or set of nodes conditioned on when checking d-connectedness.

            Returns
            -------
            w : set
                The closure of `x` in `a` with respect to d-connectedness
                given `z`.
        =#

        function _pass(e::Bool, v::Int64, f::Bool, n::Int64)
            #= 
                """Whether a ball entering node `v` along edge `e` passes to `n` along `f`.

                Boolean function defined on page 6 of [1]_.

                Parameters
                ----------
                e : bool
                    Directed edge by which the ball got to node `v`; `True` iff directed into `v`.
                v : node
                    Node where the ball is.
                f : bool
                    Directed edge connecting nodes `v` and `n`; `True` iff directed `n`.
                n : node
                    Checking whether the ball passes to this node.

                Returns
                -------
                b : bool
                    Whether the ball passes or not.

                References
                ----------
                .. [1] van der Zander, Benito, and Maciej Liśkiewicz. "Finding
                minimal d-separators in linear time and applications." In
                Uncertainty in Artificial Intelligence, pp. 637-647. PMLR, 2020.
                """
            =#
            is_element_of_A = n in a
            collider_if_in_Z = v ∉ z || (e && !f)
            return is_element_of_A && collider_if_in_Z
        end

        queue = Queue{Tuple{Bool,Int64}}()
        for node in x
            if !isempty(get(incoming_index, node, Set{Int64}()))
                enqueue!(queue, (true, node))
            end
            if !isempty(get(outgoing_index, node, Set{Int64}()))
                enqueue!(queue, (false, node))
            end
        end
        processed = Set(collect(queue))

        while !isempty(queue)
            e, v = dequeue!(queue)
            preds = ((false, n) for n in get(incoming_index, v, Set{Int64}()))
            succs = ((true, n) for n in get(outgoing_index, v, Set{Int64}()))
            f_n_pairs = Iterators.flatten((preds, succs))
            for (f, n) in f_n_pairs
                if (f, n) ∉ processed && _pass(e, v, f, n)
                    enqueue!(queue, (f, n))
                    push!(processed, (f, n))
                end
            end
        end

        return Set(w for (_, w) in processed)

    end

    function is_d_separator(
        nodelist::Set{Int64},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        x::Union{Int64, Set{Int64}},
        y::Union{Int64, Set{Int64}},
        z::Union{Int64, Set{Int64}}
        )::Bool

        #=  """Return whether node sets `x` and `y` are d-separated by `z`.

            Parameters
            ----------
            G : nx.DiGraph
                A NetworkX DAG.

            x : node or set of nodes
                First node or set of nodes in `G`.

            y : node or set of nodes
                Second node or set of nodes in `G`.

            z : node or set of nodes
                Potential separator (set of conditioning nodes in `G`). Can be empty set.

            Returns
            -------
            b : bool
                A boolean that is true if `x` is d-separated from `y` given `z` in `G`.

            Raises an error if the following conditions are met
            ------
                -if the node sets are not disjoint 
                or 
                -if the input graph is not a DAG.
                or 
                -if any of the input nodes are not found in the graph

            Notes
            -----
            A d-separating set in a DAG is a set of nodes that
            blocks all paths between the two sets. Nodes in `z`
            block a path if they are part of the path and are not a collider,
            or a descendant of a collider. Also colliders that are not in `z`
            block a path. A collider structure along a path
            is ``... -> c <- ...`` where ``c`` is the collider node.

        """ =#
        # Convert single nodes to sets if necessary
        x_set = isa(x, Int64) ? Set([x]) : x
        y_set = isa(y, Int64) ? Set([y]) : y
        z_set = isa(z, Int64) ? Set([z]) : z
    
        # Check for disjointness
        intersection = intersect(x_set, y_set, z_set)
        if !isempty(intersection)
            error("The sets are not disjoint, with intersection $intersection")
        end
    
        # Check if all nodes are in the graph
        set_v = union(x_set, y_set, z_set)
        if !issubset(set_v, nodelist)
            error("Some nodes are not found in the graph")
        end
    
        # Initialize queues
        forward_queue = Queue{Int64}()
        forward_visited = Set{Int64}()
        backward_queue = Queue{Int64}()
        enqueue!.(Ref(backward_queue), collect(x_set))
        backward_visited = Set{Int64}()
    
        # Compute ancestors_or_z
        ancestors_or_z = union(z_set, x_set, [ancestors[node] for node in x_set]...)
    
        while !isempty(forward_queue) || !isempty(backward_queue)
            if !isempty(backward_queue)
                node = dequeue!(backward_queue)
                push!(backward_visited, node)
                if node in y_set
                    return false
                end
                if node in z_set
                    continue
                end
    
                # Add <- edges to backward queue
                for pred in get(incoming_index, node, Set{Int64}())
                    if pred ∉ backward_visited
                        enqueue!(backward_queue, pred)
                    end
                end
                # Add -> edges to forward queue
                for succ in get(outgoing_index, node, Set{Int64}())
                    if succ ∉ forward_visited
                        enqueue!(forward_queue, succ)
                    end
                end
            end
    
            if !isempty(forward_queue)
                node = dequeue!(forward_queue)
                push!(forward_visited, node)
                if node in y_set
                    return false
                end
    
                # Consider if -> node <- is opened due to ancestor of node in z
                if node in ancestors_or_z
                    # Add <- edges to backward queue
                    for pred in get(incoming_index, node, Set{Int64}())
                        if pred ∉ backward_visited
                            enqueue!(backward_queue, pred)
                        end
                    end
                end
                if node ∉ z_set
                    # Add -> edges to forward queue
                    for succ in get(outgoing_index, node, Set{Int64}())
                        if succ ∉ forward_visited
                            enqueue!(forward_queue, succ)
                        end
                    end
                end
            end
        end
    
        return true
    end

    function is_minimal_d_separator(
        edgelist::Vector{Tuple{Int64,Int64}},
        nodelist::Set{Int64},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        x::Union{Int64, Set{Int64}},
        y::Union{Int64, Set{Int64}},
        z::Union{Int64, Set{Int64}};
        included::Union{Int64, Set{Int64}, Nothing} = nothing,
        restricted::Union{Int64, Set{Int64}, Nothing} = nothing
        )::Bool

        #= 
            is_minimal_d_separator(edgelist, nodelist, outgoing_index, incoming_index, ancestors, descendants, x, y, z; included=nothing, restricted=nothing)

            Determine if `z` is a minimal d-separator for `x` and `y`.

            A d-separator, `z`, in a DAG is a set of nodes that blocks all paths from nodes in set `x` to nodes in set `y`.
            A minimal d-separator is a d-separator `z` such that removing any subset of nodes makes it no longer a d-separator.

            Note: This function checks whether `z` is a d-separator AND is minimal. One can use the function `is_d_separator` to only check if
            `z` is a d-separator.

            # Arguments
            - `edgelist::Vector{Tuple{Int64,Int64}}`: The edges of the DAG.
            - `nodelist::Set{Int64}`: The set of all nodes in the DAG.
            - `outgoing_index::Dict{Int64,Set{Int64}}`: A dictionary mapping each node to its outgoing neighbors.
            - `incoming_index::Dict{Int64,Set{Int64}}`: A dictionary mapping each node to its incoming neighbors.
            - `ancestors::Dict{Int64, Set{Int64}}`: A dictionary mapping each node to its ancestors.
            - `descendants::Dict{Int64, Set{Int64}}`: A dictionary mapping each node to its descendants.
            - `x::Union{Int64, Set{Int64}}`: A node or set of nodes in the graph.
            - `y::Union{Int64, Set{Int64}}`: A node or set of nodes in the graph.
            - `z::Union{Int64, Set{Int64}}`: The node or set of nodes to check if it is a minimal d-separating set.
            - `included::Union{Int64, Set{Int64}, Nothing}=nothing`: A node or set of nodes which must be included in the found separating set. Default is `nothing`, which means the empty set.
            - `restricted::Union{Int64, Set{Int64}, Nothing}=nothing`: Restricted node or set of nodes to consider. Only these nodes can be in the found separating set. Default is `nothing`, meaning all nodes in the graph.

            # Returns
            - `Bool`: Whether or not the set `z` is a minimal d-separator subject to `restricted` nodes and `included` node constraints.

            # Examples
            ```julia
            G = DiGraph(4)
            add_edge!(G, 1, 2)
            add_edge!(G, 2, 3)
            add_edge!(G, 3, 4)
            add_vertex!(G)
            is_minimal_d_separator(G, 1, 3, Set([2]))  # should return true
            is_minimal_d_separator(G, 1, 3, Set([2, 4, 5]))  # should return false
            is_d_separator(G, 1, 3, Set([2, 4, 5]))  # should return true
        =#

        # Convert single nodes to sets if necessary
        x_set = isa(x, Int64) ? Set([x]) : x
        y_set = isa(y, Int64) ? Set([y]) : y
        z_set = isa(z, Int64) ? Set([z]) : z
    
        included_set = isnothing(included) ? Set{Int64}() : (isa(included, Int64) ? Set([included]) : included)
        restricted_set = isnothing(restricted) ? nodelist : (isa(restricted, Int64) ? Set([restricted]) : restricted)
    
        # Check for disjointness and proper inclusion
        if !isempty(intersect(x_set, y_set)) || !isempty(intersect(x_set, z_set)) || !isempty(intersect(y_set, z_set))
            error("The sets x, y, and z are not disjoint")
        end
        if !issubset(included_set, z_set)
            error("Included nodes must be in proposed separating set z")
        end
        if !issubset(z_set, restricted_set)
            error("Separating set must be contained in restricted set")
        end
    
        # Check if all nodes are in the graph
        all_nodes = union(x_set, y_set, z_set, included_set, restricted_set)
        if !issubset(all_nodes, nodelist)
            error("Some nodes are not found in the graph")
        end
    
        # Compute ancestors of x, y, and included
        nodeset = union(x_set, y_set, included_set)
        ancestors_x_y_included = union(nodeset, [ancestors[n] for n in nodeset]...)
    
        # Criterion (a) - check that z is actually a separator
        x_closure = is_reachable(outgoing_index, incoming_index, x_set, ancestors_x_y_included, z_set)
        if !isempty(intersect(x_closure, y_set))
            return false
        end
    
        # Criterion (b) - basic constraint
        if !issubset(z_set, ancestors_x_y_included)
            return false
        end
    
        # Criterion (c) - check that z is minimal
        y_closure = is_reachable( outgoing_index, descendants, y_set, ancestors_x_y_included, z_set)
        if !issubset(setdiff(z_set, included_set), intersect(x_closure, y_closure))
            return false
        end
    
        return true
    end

    function find_minimal_d_separator(
        edgelist::Vector{Tuple{Int64,Int64}},
        nodelist::Set{Int64},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        x::Union{Int64, Set{Int64}},
        y::Union{Int64, Set{Int64}};
        included::Union{Int64, Set{Int64}, Nothing} = nothing,
        restricted::Union{Int64, Set{Int64}, Nothing} = nothing
     )::Union{Set{Int64}, Nothing}
    
        #= 
            """
                find_minimal_d_separator(edgelist, nodelist, outgoing_index, incoming_index, ancestors, descendants, x, y; included=nothing, restricted=nothing)

            Returns a minimal d-separating set between `x` and `y` if possible.

            A d-separating set in a DAG is a set of nodes that blocks all paths between the two sets of nodes, `x` and `y`. 
            This function constructs a d-separating set that is "minimal", meaning no nodes can be removed without it losing 
            the d-separating property for `x` and `y`. If no d-separating sets exist for `x` and `y`, this returns `nothing`.

            In a DAG there may be more than one minimal d-separator between two sets of nodes. Minimal d-separators are not 
            always unique. This function returns one minimal d-separator, or `nothing` if no d-separator exists.

            Uses the algorithm presented in [1]. The complexity of the algorithm is O(m), where m stands for the number of 
            edges in the subgraph of G consisting of only the ancestors of `x` and `y`. For full details, see [1].

            # Arguments
            - `edgelist::Vector{Tuple{Int64,Int64}}`: The edges of the DAG.
            - `nodelist::Set{Int64}`: The set of all nodes in the DAG.
            - `outgoing_index::Dict{Int64,Set{Int64}}`: A dictionary mapping each node to its outgoing neighbors.
            - `incoming_index::Dict{Int64,Set{Int64}}`: A dictionary mapping each node to its incoming neighbors.
            - `ancestors::Dict{Int64, Set{Int64}}`: A dictionary mapping each node to its ancestors.
            - `descendants::Dict{Int64, Set{Int64}}`: A dictionary mapping each node to its descendants.
            - `x::Union{Int64, Set{Int64}}`: A node or set of nodes in the graph.
            - `y::Union{Int64, Set{Int64}}`: A node or set of nodes in the graph.
            - `included::Union{Int64, Set{Int64}, Nothing}=nothing`: A node or set of nodes which must be included in the found separating set. Default is `nothing`, which means the empty set.
            - `restricted::Union{Int64, Set{Int64}, Nothing}=nothing`: Restricted node or set of nodes to consider. Only these nodes can be in the found separating set. Default is `nothing`, meaning all nodes in the graph.

            # Returns
            - `Union{Set{Int64}, Nothing}`: The minimal d-separating set, if at least one d-separating set exists, otherwise `nothing`.

            # Raises
            - `ErrorException`: If the node sets `x`, `y`, and `included` are not disjoint, or if any of the input nodes are not found in the graph.

            # References
            [1] van der Zander, Benito, and Maciej Liśkiewicz. "Finding minimal d-separators in linear time and applications." 
                In Uncertainty in Artificial Intelligence, pp. 637-647. PMLR, 2020.
            """
        =#
        
        # Convert single nodes to sets if necessary
        x_set = isa(x, Int64) ? Set([x]) : x
        y_set = isa(y, Int64) ? Set([y]) : y
    
        included_set = isnothing(included) ? Set{Int64}() : (isa(included, Int64) ? Set([included]) : included)
        restricted_set = isnothing(restricted) ? nodelist : (isa(restricted, Int64) ? Set([restricted]) : restricted)
    
        # Check for proper inclusion
        if !issubset(included_set, restricted_set)
            error("Included nodes must be in restricted nodes")
        end
    
        # Check for disjointness
        intersection = intersect(x_set, y_set, included_set)
        if !isempty(intersection)
            error("The sets x, y, included are not disjoint. Overlap: $intersection")
        end
    
        # Check if all nodes are in the graph
        all_nodes = union(x_set, y_set, included_set, restricted_set)
        if !issubset(all_nodes, nodelist)
            error("Some nodes are not found in the graph")
        end
    
        nodeset = union(x_set, y_set, included_set)
        ancestors_x_y_included = union(nodeset, [ancestors[node] for node in nodeset]...)
    
        z_init = intersect(restricted_set, setdiff(ancestors_x_y_included, union(x_set, y_set)))
    
        x_closure = is_reachable( outgoing_index, incoming_index,  x_set, ancestors_x_y_included, z_init)
        if !isempty(intersect(x_closure, y_set))
            return nothing
        end
    
        z_updated = intersect(z_init, union(x_closure, included_set))
        y_closure = is_reachable( outgoing_index, incoming_index,  y_set, ancestors_x_y_included, z_updated)
        return intersect(z_updated, union(y_closure, included_set))
    end
end