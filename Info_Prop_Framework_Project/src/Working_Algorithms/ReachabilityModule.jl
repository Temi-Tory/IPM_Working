module ReachabilityModule

using Combinatorics
using ..NetworkDecompositionModule
using ..InputProcessingModule  


function validate_network_data(
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64, Set{Int64}},
    incoming_index::Dict{Int64, Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64, Float64},
    link_probability::Dict{Tuple{Int64, Int64}, Float64},
)
    # Collect all nodes from iteration sets
    all_nodes = reduce(union, iteration_sets, init = Set{Int64}())

    # 1. Validate all nodes have priors
    nodes_without_priors = setdiff(all_nodes, keys(node_priors))
    if !isempty(nodes_without_priors)
        throw(ErrorException("The following nodes are missing priors: $nodes_without_priors"))
    end

    # 2. Validate all non-source nodes have incoming edges
    non_source_nodes = setdiff(all_nodes, source_nodes)
    for node in non_source_nodes
        if !haskey(incoming_index, node) || isempty(incoming_index[node])
            throw(ErrorException("Non-source node $node has no incoming edges"))
        end
    end

    # 3. Validate source nodes have no incoming edges
    for source in source_nodes
        if haskey(incoming_index, source) && !isempty(incoming_index[source])
            throw(ErrorException("Source node $source has incoming edges: $(incoming_index[source])"))
        end
    end

    # 4. Validate all edges have probability values
    edges = Set{Tuple{Int64, Int64}}()
    for (node, targets) in outgoing_index
        for target in targets
            push!(edges, (node, target))
        end
    end
    edges_without_probability = setdiff(edges, keys(link_probability))
    if !isempty(edges_without_probability)
        throw(ErrorException("The following edges are missing probability values: $edges_without_probability"))
    end

    # 5. Validate consistency between incoming and outgoing indices
    for (node, targets) in outgoing_index
        for target in targets
            if !haskey(incoming_index, target) || !(node in incoming_index[target])
                throw(ErrorException("Inconsistency found: edge ($node, $target) exists in outgoing_index but not in incoming_index"))
            end
        end
    end
    for (node, sources) in incoming_index
        for source in sources
            if !haskey(outgoing_index, source) || !(node in outgoing_index[source])
                throw(ErrorException("Inconsistency found: edge ($source, $node) exists in incoming_index but not in outgoing_index"))
            end
        end
    end

    # 6. Validate all prior probabilities are between 0 and 1
    invalid_priors = [(node, prior) for (node, prior) in node_priors if prior < 0 || prior > 1]
    if !isempty(invalid_priors)
        throw(ErrorException("The following nodes have invalid prior probabilities (must be between 0 and 1): $invalid_priors"))
    end

    # 7. Validate all probability values are between 0 and 1
    invalid_probabilities = [(edge, rel) for (edge, rel) in link_probability if rel < 0 || rel > 1]
    if !isempty(invalid_probabilities)
        throw(ErrorException("The following edges have invalid probability values (must be between 0 and 1): $invalid_probabilities"))
    end

    # 8. Validate iteration sets contain all nodes exactly once
    nodes_seen = Set{Int64}()
    for set in iteration_sets
        intersection = intersect(nodes_seen, set)
        if !isempty(intersection)
            throw(ErrorException("Nodes $intersection appear in multiple iteration sets"))
        end
        union!(nodes_seen, set)
    end
    if nodes_seen != all_nodes
        missing_nodes = setdiff(all_nodes, nodes_seen)
        extra_nodes = setdiff(nodes_seen, all_nodes)
        error_msg = ""
        if !isempty(missing_nodes)
            error_msg *= "Nodes missing from iteration sets: $missing_nodes. "
        end
        if !isempty(extra_nodes)
            error_msg *= "Extra nodes in iteration sets: $extra_nodes."
        end
        throw(ErrorException(error_msg))
    end
end

function update_beliefs_iterative(
    edgelist::Vector{Tuple{Int64,Int64}},  
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64,Float64},
    link_probability::Dict{Tuple{Int64,Int64},Float64},
    descendants::Dict{Int64, Set{Int64}}, 
    ancestors::Dict{Int64, Set{Int64}},
    diamond_structures::Dict{Int64, GroupedDiamondStructure},
    join_nodes::Set{Int64},
    fork_nodes::Set{Int64}
)
    validate_network_data(iteration_sets, outgoing_index, incoming_index, source_nodes, node_priors, link_probability)
    belief_dict = Dict{Int64, Float64}()

    for node_set in iteration_sets
        for node in node_set
            if node in source_nodes
                belief_dict[node] = node_priors[node]
                continue
            end

            # Collect all sources of belief for this node
            all_beliefs = Float64[]
            
            # Process diamond structures if they exist
            if haskey(diamond_structures, node)
                structure = diamond_structures[node]
                
                # Calculate beliefs from diamond groups
                group_beliefs = calculate_diamond_groups_belief(
                    structure,
                    belief_dict,
                    link_probability,
                    node_priors,
                    descendants,
                    ancestors,
                    incoming_index,
                    outgoing_index,
                    iteration_sets,
                    edgelist,
                    join_nodes,
                    fork_nodes
                )
                
                # Use inclusion-exclusion for diamond groups
                if !isempty(group_beliefs)
                    diamond_belief = inclusion_exclusion(group_beliefs)
                    push!(all_beliefs, diamond_belief)
                end
                
                # Handle non-diamond parents within the structure
                if !isempty(structure.non_diamond_parents)
                    non_diamond_beliefs = calculate_regular_belief(
                        structure.non_diamond_parents,
                        node,
                        belief_dict,
                        link_probability
                    )
                    
                    # For simple tree paths, just take the sum
                    if !(node in join_nodes) || length(intersect(ancestors[node], source_nodes)) <= 1
                        push!(all_beliefs, sum(non_diamond_beliefs))
                    else
                        # For join nodes with multiple paths, use inclusion-exclusion
                        append!(all_beliefs, non_diamond_beliefs)
                    end
                end
            else
                # No diamond structures - handle regular parents
                parents = incoming_index[node]
                probability_from_parents = calculate_regular_belief(
                    parents,
                    node,
                    belief_dict,
                    link_probability
                )
                
                # Check if this is a join node with multiple paths from sources
                if node in join_nodes || length(intersect(ancestors[node], source_nodes)) > 1
                    # Use inclusion-exclusion for multiple paths
                    append!(all_beliefs, probability_from_parents)
                else
                    # For simple tree paths, just take the sum
                    push!(all_beliefs, sum(probability_from_parents))
                end
            end
            
            # Final combination of all belief sources
            if length(all_beliefs) == 1
                belief_dict[node] = all_beliefs[1]
            else
                belief_dict[node] = inclusion_exclusion(all_beliefs)
            end
        end
    end

    return belief_dict
end

function calculate_regular_belief(
    parents::Set{Int64},
    node::Int64,
    belief_dict::Dict{Int64, Float64},
    link_probability::Dict{Tuple{Int64, Int64}, Float64},
)
    combined_probability_from_parents = Float64[]
    for parent in parents
        if !haskey(belief_dict, parent)
            throw(ErrorException("Parent node $parent of node $node has no belief value. This indicates a processing order error."))
        end
        parent_belief = belief_dict[parent]

        if !haskey(link_probability, (parent, node))
            throw(ErrorException("No probability defined for edge ($parent, $node)"))
        end
        link_rel = link_probability[(parent, node)]

        push!(combined_probability_from_parents, parent_belief * link_rel)
    end

    return combined_probability_from_parents
end

function inclusion_exclusion(belief_values::Vector{Float64})
    combined_belief = 0.0
    num_beliefs = length(belief_values)
    

    for i in 1:num_beliefs
        # Iterate through all possible combinations of belief values
        for combination in combinations(belief_values, i)
            # Calculate the intersection probability of the current combination
            intersection_probability = prod(combination)

            # Add or subtract the intersection probability based on the number of beliefs in the combination
            if isodd(i)
                combined_belief += intersection_probability
            else
                combined_belief -= intersection_probability
            end
        end
    end
    return combined_belief
end

function updateDiamondJoin(
    fork_node::Int64,
    join_node::Int64, 
    ancestor_group::AncestorGroup,
    link_probability::Dict{Tuple{Int64,Int64},Float64},
    node_priors::Dict{Int64,Float64},
    belief_dict::Dict{Int64,Float64}
)

    # Get the precomputed subgraph
    subgraph = ancestor_group.subgraph
    
    # Create sub_link_probability just for the subgraph edges
    sub_link_probability = Dict{Tuple{Int64, Int64}, Float64}()
    for edge in subgraph.edgelist
        sub_link_probability[edge] = link_probability[edge]
    end

    # Create sub_node_priors for the subgraph nodes
    sub_node_priors = Dict{Int64, Float64}()
    for node in subgraph.relevant_nodes
        if node ∉ subgraph.sources
            sub_node_priors[node] = node_priors[node]
        elseif node != fork_node
            sub_node_priors[node] = belief_dict[node]
        end
    end

    # Store original fork belief for final calculation
    original_fork_belief = belief_dict[fork_node]


    # Create fresh outgoing and incoming indices for the subgraph
    sub_outgoing_index = Dict{Int64, Set{Int64}}()
    sub_incoming_index = Dict{Int64, Set{Int64}}()

    for (i, j) in subgraph.edgelist
        push!(get!(sub_outgoing_index, i, Set{Int64}()), j)
        push!(get!(sub_incoming_index, j, Set{Int64}()), i)
    end

    fresh_sources = Set{Int64}()
    for node in keys(sub_outgoing_index)
        if !haskey(sub_incoming_index, node) || isempty(sub_incoming_index[node])
            push!(fresh_sources, node)
        end
    end
    # Calculate fresh iteration sets, ancestors, and descendants
    sub_iteration_sets, sub_ancestors, sub_descendants = InputProcessingModule.find_iteration_sets(
        subgraph.edgelist, 
        sub_outgoing_index, 
        sub_incoming_index
    )

    # Identify fork and join nodes using the fresh indices
    sub_fork_nodes, sub_join_nodes = InputProcessingModule.identify_fork_and_join_nodes(
        sub_outgoing_index, 
        sub_incoming_index
    )


    # Use the fresh data structures for diamond identification
    sub_diamond_structures = NetworkDecompositionModule.identify_and_group_diamonds(
        sub_join_nodes,
        sub_ancestors,
        sub_incoming_index,
        subgraph.sources,
        sub_fork_nodes,
        sub_iteration_sets,
        subgraph.edgelist,
        sub_descendants
    )
 
    # Success case (fork = 1)
    sub_node_priors[fork_node] = 1.0
    success_belief = update_beliefs_iterative(
        subgraph.edgelist,          
        sub_iteration_sets,  # Use fresh iteration sets
        sub_outgoing_index,  # Use fresh outgoing index
        sub_incoming_index,  # Use fresh incoming index
        fresh_sources,
        sub_node_priors,
        sub_link_probability,
        sub_descendants,     # Use fresh descendants
        sub_ancestors,       # Use fresh ancestors
        sub_diamond_structures,
        sub_join_nodes,      # Use fresh join nodes
        sub_fork_nodes       # Use fresh fork nodes
    )[join_node]

    # Failure case (fork = 0)
    sub_node_priors[fork_node] = 0.0
    failure_belief = update_beliefs_iterative(
        subgraph.edgelist,          
        sub_iteration_sets,  # Use fresh iteration sets
        sub_outgoing_index,  # Use fresh outgoing index
        sub_incoming_index,  # Use fresh incoming index
        fresh_sources,
        sub_node_priors,
        sub_link_probability,
        sub_descendants,     # Use fresh descendants
        sub_ancestors,       # Use fresh ancestors
        sub_diamond_structures,
        sub_join_nodes,      # Use fresh join nodes
        sub_fork_nodes       # Use fresh fork nodes
    )[join_node]

    updated_belief_dict = copy(belief_dict)
    updated_belief_dict[fork_node] = original_fork_belief
    updated_belief_dict[join_node] = (success_belief * original_fork_belief) + 
                                    (failure_belief * (1 - original_fork_belief))
    return updated_belief_dict
end

function calculate_diamond_groups_belief(
    diamond_structure::GroupedDiamondStructure,
    belief_dict::Dict{Int64,Float64},
    link_probability::Dict{Tuple{Int64,Int64},Float64},
    node_priors::Dict{Int64,Float64},
    descendants::Dict{Int64,Set{Int64}}, 
    ancestors::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    iteration_sets::Vector{Set{Int64}},
    edgelist::Vector{Tuple{Int64,Int64}},
    join_nodes::Set{Int64},
    fork_nodes::Set{Int64}
)
    join_node = diamond_structure.join_node
    group_combined_beliefs = Float64[]

    



    for group in diamond_structure.diamond
        fork_node = first(group.highest_nodes)
        updated_belief_dict = updateDiamondJoin(
            fork_node,
            join_node,
            group,
            link_probability,
            node_priors,
            belief_dict
        )
        push!(group_combined_beliefs, updated_belief_dict[join_node])
    end

    return group_combined_beliefs
end






function MC_result(
    edgelist::Vector{Tuple{Int64,Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    N::Int=100000
)
    # Get all nodes
    all_nodes = reduce(union, values(incoming_index), init=keys(incoming_index))
    active_count = Dict{Int64, Float64}()
    for node in all_nodes
        active_count[node] = 0.0
    end

    for _ in 1:N
        # Sample node states
        node_active = Dict(
            node => rand() < node_priors[node]
            for node in all_nodes
        )

        # Sample edge states
        active_edges = Dict{Tuple{Int64,Int64}, Bool}()
        for edge in edgelist
            src, dst = edge
            if node_active[src] && node_active[dst]
                active_edges[edge] = rand() < edge_probabilities[edge]
            else
                active_edges[edge] = false
            end
        end

        # Create subgraph with only active edges
        sub_outgoing = Dict{Int64, Set{Int64}}()
        for (src, dst) in edgelist
            if active_edges[(src, dst)]
                if !haskey(sub_outgoing, src)
                    sub_outgoing[src] = Set{Int64}()
                end
                push!(sub_outgoing[src], dst)
            end
        end

        # Check reachability for each node
        for node in all_nodes
            if node in source_nodes
                if node_active[node]
                    active_count[node] += 1
                end
            else
                # Check if node is reachable from any source
                reachable = false
                for source in source_nodes
                    if has_path(sub_outgoing, source, node)
                        reachable = true
                        break
                    end
                end
                if reachable
                    active_count[node] += 1
                end
            end
        end
    end

    # Convert counts to probabilities
    for node in keys(active_count)
        active_count[node] /= N
    end

    return active_count
end

# Helper function to check if there's a path between two nodes
function has_path(graph::Dict{Int64, Set{Int64}}, start::Int64, target::Int64)
    visited = Set{Int64}()
    queue = [start]
    
    while !isempty(queue)
        node = popfirst!(queue)
        if node == target
            return true
        end
        
        if haskey(graph, node)
            for neighbor in graph[node]
                if neighbor ∉ visited
                    push!(visited, neighbor)
                    push!(queue, neighbor)
                end
            end
        end
    end
    
    return false
end
end
