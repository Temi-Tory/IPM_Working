using Combinatorics

function create_cpt(node::Int, parents::Set{Int}, network_probs::NetworkProbabilities, dag::Dict{Int, Set{Int}})
    variables = vcat(node, collect(parents))
    table = Dict{Tuple{Bool}, Float64}()
    
    node_prob = network_probs.node_probs[node]
    
    for state in Iterators.product(fill([false, true], length(variables))...)
        node_state = state[1]
        parent_states = state[2:end]
        
        if node_state  # Node is reachable
            if any(parent_states)  # At least one parent is reachable
                reachable_parents = [p for (i, p) in enumerate(parents) if parent_states[i]]
                prob_reachable = calculate_reachability_probability(node, reachable_parents, network_probs, dag)
                table[state] = node_prob * prob_reachable
            else  # No parent is reachable
                table[state] = node_prob * 0.01  # Small chance of being reachable if isolated
            end
        else  # Node is not reachable
            table[state] = 1 - table[tuple(!node_state, parent_states...)]
        end
    end
    
    return CPT(variables, table)
end

function calculate_reachability_probability(node::Int, parents::Vector{Int}, network_probs::NetworkProbabilities, dag::Dict{Int, Set{Int}})
    prob = 0.0
    for k in 1:length(parents)
        for combination in combinations(parents, k)
            term_prob = inclusion_exclusion_term(node, Set(combination), network_probs, dag)
            prob += (k % 2 == 1 ? 1 : -1) * term_prob
        end
    end
    return prob
end

function inclusion_exclusion_term(node::Int, parent_set::Set{Int}, network_probs::NetworkProbabilities, dag::Dict{Int, Set{Int}})
    # Find common ancestors
    ancestors = Set{Int}()
    for parent in parent_set
        ancestors = union(ancestors, find_ancestors(parent, dag))
    end
    
    # Calculate joint probability considering common ancestors
    joint_prob = 1.0
    for ancestor in ancestors
        joint_prob *= network_probs.node_probs[ancestor]
    end
    
    for parent in parent_set
        path_prob = network_probs.edge_probs[(parent, node)]
        for ancestor in ancestors
            if ancestor != parent && has_path(dag, ancestor, parent)
                path_prob *= network_probs.edge_probs[(ancestor, parent)]
            end
        end
        joint_prob *= path_prob
    end
    
    return joint_prob
end

function find_ancestors(node::Int, dag::Dict{Int, Set{Int}})
    ancestors = Set{Int}()
    queue = collect(dag[node])
    while !isempty(queue)
        current = pop!(queue)
        push!(ancestors, current)
        append!(queue, collect(dag[current]))
    end
    return ancestors
end

function has_path(dag::Dict{Int, Set{Int}}, start::Int, end_::Int)
    visited = Set{Int}()
    queue = [start]
    while !isempty(queue)
        current = popfirst!(queue)
        if current == end_
            return true
        end
        for neighbor in dag[current]
            if neighbor ∉ visited
                push!(visited, neighbor)
                push!(queue, neighbor)
            end
        end
    end
    return false
end