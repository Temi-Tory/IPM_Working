import Cairo, Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

using Main.InputProcessingModule
#using Main.D_SeparatednesModule

#filepath = "csvfiles/KarlNetwork.csv"
filepath = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv"
#filepath = "csvfiles/16 NodeNetwork Adjacency matrix.csv"

edgelist, outgoing_index, incoming_index, source_nodes, all_nodes = InputProcessingModule.read_graph_to_dict(filepath)

fork_nodes, join_nodes = InputProcessingModule.identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants, common_ancestors_list = InputProcessingModule.find_iteration_sets(edgelist, outgoing_index, incoming_index, fork_nodes, join_nodes, source_nodes);

parents_dict = Dict{Int, Set{Int}}()
for (node, parents) in incoming_index
    parents_dict[node] = parents
end
edge_prob = Dict{Tuple{Int, Int}, Float64}()
for (src, dst) in edgelist
    edge_prob[(src, dst)] = 0.9  # Example probability; adjust as needed
end

#= for node_common_ancestors in common_ancestors_list
    println("Node ID: $(node_common_ancestors.node_id)")
    for group in node_common_ancestors.ancestor_groups
        println("  Common Ancestor IDs: $(group.ancestor_ids)")
        println("    Parents sharing these ancestors: $(group.parent_ids)")
    end
end =#


# Function to find the common ancestor entry for a node
function find_node_common_ancestors(node_id, common_ancestors_list)
    for node_common_ancestors in common_ancestors_list
        if node_common_ancestors.node_id == node_id
            return node_common_ancestors
        end
    end
    return nothing  # Return nothing if no entry exists for the node
end

# Updated reachability computation with shared ancestors
function compute_reachability_with_shared_ancestors(nodes, source_nodes, parents_dict, edge_prob, iteration_sets, common_ancestors_list)
    # Initialize reachability probabilities
    p_reach = Dict{Int, Float64}()
    
    # Initialize reachability for source nodes
    for v in source_nodes
        p_reach[v] = 1.0  # Source nodes are always reachable
    end

    # Initialize reachability for non-source nodes
    for v in setdiff(nodes, source_nodes)
        p_reach[v] = 0.0  # Non-source nodes initially not reachable
    end

    # Process nodes in topological order
    for node_set in iteration_sets
        for v in node_set
            if v ∉ source_nodes
                # Get the parents of the current node
                parent_nodes = parents_dict[v]

                # Handle shared ancestors
                node_common_ancestors = find_node_common_ancestors(v, common_ancestors_list)
                
                # Independent and shared parent contributions
                p_reach_independent = 1.0
                p_reach_shared = 1.0

                # Calculate contribution from shared ancestors
                if node_common_ancestors !== nothing
                    for group in node_common_ancestors.ancestor_groups
                        shared_parents = group.parent_ids
                        shared_ancestor = group.ancestor_ids
                        
                        # Probability of reachability through the shared ancestor
                        shared_ancestor_reach = prod([p_reach[ancestor] for ancestor in shared_ancestor])

                        # Conditional probability: reachability given that the shared ancestor is reachable
                        shared_reach = 1 - prod([1 - edge_prob[(u, v)] * p_reach[u] for u in shared_parents])

                        # Weight the shared reachability by the ancestor's reachability
                        p_reach_shared *= shared_ancestor_reach * shared_reach
                    end
                end

                # Calculate contribution from independent parents
                independent_parents = parent_nodes
                if node_common_ancestors !== nothing
                    independent_parents = setdiff(parent_nodes, [p for group in node_common_ancestors.ancestor_groups for p in group.parent_ids])
                end

                if !isempty(independent_parents)
                    p_reach_independent = 1 - prod([1 - edge_prob[(u, v)] * p_reach[u] for u in independent_parents])
                end

                # Combine shared and independent contributions carefully
                if isempty(independent_parents)
                    p_reach[v] = p_reach_shared
                elseif node_common_ancestors === nothing
                    p_reach[v] = p_reach_independent
                else
                    # We combine them carefully considering that both contribute partially
                    p_reach[v] = 1 - (1 - p_reach_independent) * (1 - p_reach_shared)
                end
            end
        end
    end

    return p_reach
end


# Test the reachability function
reachability_result = compute_reachability_with_shared_ancestors(all_nodes, source_nodes, parents_dict, edge_prob, iteration_sets, common_ancestors_list)

# Print the reachability results ordered by node ID
for node in sort(collect(keys(reachability_result)))
    prob = reachability_result[node]
    println("Node $node has a reachability probability of $prob")
end
