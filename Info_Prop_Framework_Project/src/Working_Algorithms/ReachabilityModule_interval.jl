module ReachabilityModule_I
    using Combinatorics
    
    # Define an Interval type
    struct Interval
        lower::Float64
        upper::Float64
        
        function Interval(lower::Float64, upper::Float64)
            if lower > upper
                throw(ArgumentError("Lower bound must be ≤ upper bound"))
            end
            if lower < 0.0 || upper > 1.0
                throw(ArgumentError("Probability intervals must be in [0,1]"))
            end
            new(lower, upper)
        end
    end

    # Interval arithmetic operations
    function *(a::Interval, b::Interval)
        lower = a.lower * b.lower
        upper = a.upper * b.upper
        Interval(lower, upper)
    end

    function +(a::Interval, b::Interval)
        lower = min(a.lower + b.lower, 1.0)  # Ensure we don't exceed 1.0
        upper = min(a.upper + b.upper, 1.0)
        Interval(lower, upper)
    end

    # Modified validation function
    function validate_network_data(
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64, Set{Int64}},
        incoming_index::Dict{Int64, Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, Interval},
        link_probability::Dict{Tuple{Int64, Int64}, Interval},
    )
        # Similar validation logic but adapted for intervals
        all_nodes = reduce(union, iteration_sets, init = Set{Int64}())

        # Validate all nodes have interval priors
        nodes_without_priors = setdiff(all_nodes, keys(node_priors))
        if !isempty(nodes_without_priors)
            throw(ErrorException("The following nodes are missing priors: $nodes_without_priors"))
        end

        # Rest of validation remains similar...
    end

    # Modified belief calculation for regular paths
    function calculate_regular_belief(
        parents::Set{Int64},
        node::Int64,
        belief_dict::Dict{Int64, Interval},
        link_probability::Dict{Tuple{Int64, Int64}, Interval},
    )
        combined_probability_from_parents = Interval[]
        for parent in parents
            if !haskey(belief_dict, parent)
                throw(ErrorException("Parent node $parent of node $node has no belief value"))
            end
            parent_belief = belief_dict[parent]

            if !haskey(link_probability, (parent, node))
                throw(ErrorException("No probability defined for edge ($parent, $node)"))
            end
            link_rel = link_probability[(parent, node)]

            # Interval multiplication
            push!(combined_probability_from_parents, parent_belief * link_rel)
        end

        return combined_probability_from_parents
    end

    # Modified inclusion-exclusion for intervals
    function inclusion_exclusion(belief_values::Vector{Interval})
        if isempty(belief_values)
            return Interval(0.0, 0.0)
        end
        
        # Initialize with first interval
        combined_belief = belief_values[1]
        
        # Handle remaining intervals
        for i in 2:length(belief_values)
            # For intervals, we need to consider the worst and best cases
            new_interval = belief_values[i]
            
            # Lower bound: assume maximum overlap
            lower = max(combined_belief.lower + new_interval.lower - 1.0, 0.0)
            
            # Upper bound: assume minimum overlap
            upper = min(combined_belief.upper + new_interval.upper, 1.0)
            
            combined_belief = Interval(lower, upper)
        end
        
        return combined_belief
    end

    # Modified Monte Carlo simulation
    function MC_result(
        edgelist::Vector{Tuple{Int64,Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, Interval},
        edge_probabilities::Dict{Tuple{Int64,Int64}, Interval},
        N::Int=100000
    )
        all_nodes = reduce(union, values(incoming_index), init=keys(incoming_index))
        active_count_lower = Dict{Int64, Float64}()
        active_count_upper = Dict{Int64, Float64}()
        
        for node in all_nodes
            active_count_lower[node] = 0.0
            active_count_upper[node] = 0.0
        end

        # Run two simulations: one with lower bounds, one with upper bounds
        for bounds in [:lower, :upper]
            for _ in 1:N
                node_active = Dict(
                    node => rand() < (bounds == :lower ? prior.lower : prior.upper)
                    for (node, prior) in node_priors
                )

                active_edges = Dict{Tuple{Int64,Int64}, Bool}()
                for edge in edgelist
                    prob = edge_probabilities[edge]
                    threshold = bounds == :lower ? prob.lower : prob.upper
                    active_edges[edge] = rand() < threshold
                end

                # Rest of MC simulation logic...
                # Update appropriate counter (lower or upper) based on reachability
            end
        end

        # Return interval results
        return Dict(
            node => Interval(
                active_count_lower[node] / N,
                active_count_upper[node] / N
            )
            for node in all_nodes
        )
    end
end