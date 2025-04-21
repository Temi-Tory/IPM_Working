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
                    fork_nodes,
                    source_nodes
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
    belief_dict::Dict{Int64,Float64},
    source_nodes::Set{Int64} 
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

    # NEW: Find all sources that are also fork nodes to condition on
    conditioning_nodes = Set{Int64}([fork_node])
    for source in fresh_sources
        if source in sub_fork_nodes && source != fork_node && source ∉ source_nodes
            push!(conditioning_nodes, source)
        end
    end
    
       
     join_node_parents = Set{Int64}()
    for (i, j) in subgraph.edgelist
        push!(get!(sub_outgoing_index, i, Set{Int64}()), j)
        push!(get!(sub_incoming_index, j, Set{Int64}()), i)
        
        if j == join_node
            push!(join_node_parents, i)  
        end
    end

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

    # Process sub_diamond_structures before updating beliefs
    for (join_node, grouped_structure) in sub_diamond_structures
        # Skip if there's only one diamond group
        if length(grouped_structure.diamond) <= 1
            continue
        end
        
        # Check for shared direct edges to join node
        edge_to_diamond_map = Dict{Tuple{Int64, Int64}, Set{Int}}()
        
        # Map each edge to the diamonds containing it
        for (idx, ancestor_group) in enumerate(grouped_structure.diamond)
            for edge in ancestor_group.subgraph.edgelist
                # Check if this edge leads directly to the join node
                if edge[2] == join_node
                    if !haskey(edge_to_diamond_map, edge)
                        edge_to_diamond_map[edge] = Set{Int}()
                    end
                    push!(edge_to_diamond_map[edge], idx)
                end
            end
        end
        
        # Find diamonds that share direct edges to join node
        shared_edge_diamonds = Set{Int}()
        
        # Find edges shared by multiple diamonds
        for (edge, diamond_indices) in edge_to_diamond_map
            if length(diamond_indices) > 1
                # This edge is shared by multiple diamonds and goes to join node
                union!(shared_edge_diamonds, diamond_indices)
            end
        end
        
        # If we found diamonds to drop
        if !isempty(shared_edge_diamonds)
            # Create a new list without the problematic diamonds
            new_diamond_groups = AncestorGroup[]
            
            for i in 1:length(grouped_structure.diamond)
                if i ∉ shared_edge_diamonds
                    push!(new_diamond_groups, grouped_structure.diamond[i])
                end
            end
            
            # Replace the original diamond groups with filtered ones
            grouped_structure.diamond = new_diamond_groups
            
            # If all diamonds were filtered out, remove this join node from sub_diamond_structures
            if isempty(new_diamond_groups)
                delete!(sub_diamond_structures, join_node)
            end
        end
    end
 
   

     # NEW: Use multi-conditioning approach
     conditioning_nodes_list = collect(conditioning_nodes)
    
     # Generate all possible states of conditioning nodes (0 or 1)
     final_belief = 0.0
     
     # Use binary representation for efficiency
     for state_idx in 0:(2^length(conditioning_nodes_list) - 1)
         # Calculate state probability
         state_probability = 1.0
         conditioning_state = Dict{Int64, Float64}()
         
         for (i, node) in enumerate(conditioning_nodes_list)
             # Store original belief for this node
             original_belief = belief_dict[node]
             
             # Check if the i-th bit is set
             if (state_idx & (1 << (i-1))) != 0
                 conditioning_state[node] = 1.0
                 state_probability *= original_belief
             else
                 conditioning_state[node] = 0.0
                 state_probability *= (1.0 - original_belief)
             end
         end
         
         # Make a copy of sub_node_priors for this iteration
         current_priors = copy(sub_node_priors)
         
         # Set conditioning nodes to their current state
         for (node, value) in conditioning_state
             current_priors[node] = value
         end
         
         # Run belief propagation with these nodes fixed
         state_beliefs = update_beliefs_iterative(
             subgraph.edgelist,
             sub_iteration_sets,
             sub_outgoing_index,
             sub_incoming_index,
             fresh_sources,
             current_priors,
             sub_link_probability,
             sub_descendants,
             sub_ancestors,
             sub_diamond_structures,
             sub_join_nodes,
             sub_fork_nodes
         )
         
         # Weight the result by the probability of this state
         join_belief = state_beliefs[join_node]
         final_belief += join_belief * state_probability
     end
     
     # Update belief dictionary with combined result
     updated_belief_dict = copy(belief_dict)
     updated_belief_dict[join_node] = final_belief
     
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
    fork_nodes::Set{Int64},
    source_nodes::Set{Int64} 
)
    join_node = diamond_structure.join_node
    group_combined_beliefs = Float64[]

    # Find shared nodes between diamond groups
    shared_nodes = Dict{Int64, Set{Int}}()
    
    for (i, group) in enumerate(diamond_structure.diamond)
        for node in group.subgraph.relevant_nodes
            if node != join_node
                if !haskey(shared_nodes, node)
                    shared_nodes[node] = Set{Int}()
                end
                push!(shared_nodes[node], i)
            end
        end
    end
    
    # Keep only nodes shared between multiple groups
    multi_group_nodes = filter(pair -> length(pair.second) > 1, shared_nodes)
    
    # If no shared nodes, use original algorithm
    if isempty(multi_group_nodes)
        for group in diamond_structure.diamond
            fork_node = first(group.highest_nodes)
            updated_belief_dict = updateDiamondJoin(
                fork_node,
                join_node,
                group,
                link_probability,
                node_priors,
                belief_dict,
                source_nodes
            )
            push!(group_combined_beliefs, updated_belief_dict[join_node])
        end
    else
        # Determine which groups need to be combined
        group_connections = Dict{Int, Set{Int}}()
        for (_, group_indices) in multi_group_nodes
            for i in group_indices
                if !haskey(group_connections, i)
                    group_connections[i] = Set{Int}()
                end
                union!(group_connections[i], group_indices)
            end
        end
        
        # Find connected components
        visited = Set{Int}()
        components = Vector{Set{Int}}()
        
        for i in 1:length(diamond_structure.diamond)
            if i in visited
                continue
            end
            
            # Start a new component
            component = Set{Int}()
            queue = [i]
            
            while !isempty(queue)
                current = popfirst!(queue)
                if current in visited
                    continue
                end
                
                push!(visited, current)
                push!(component, current)
                
                if haskey(group_connections, current)
                    for neighbor in group_connections[current]
                        if neighbor ∉ visited
                            push!(queue, neighbor)
                        end
                    end
                end
            end
            
            push!(components, component)
        end
        
        # Process each component
        for component in components
            if length(component) == 1
                # Single group - use original algorithm
                group_idx = first(component)
                group = diamond_structure.diamond[group_idx]
                fork_node = first(group.highest_nodes)
                updated_belief_dict = updateDiamondJoin(
                    fork_node,
                    join_node,
                    group,
                    link_probability,
                    node_priors,
                    belief_dict,
                    source_nodes
                )
                push!(group_combined_beliefs, updated_belief_dict[join_node])
            else
                # Multiple connected groups - use combinatorial approach
                # Collect all fork nodes from the component
                component_fork_nodes = Set{Int64}()
                for idx in component
                    union!(component_fork_nodes, diamond_structure.diamond[idx].highest_nodes)
                end
                
                # Convert to list for indexing
                fork_nodes_list = collect(component_fork_nodes)
                
                # Create combined subgraph
                combined_nodes = Set{Int64}()
                combined_edges = Vector{Tuple{Int64, Int64}}()
                
                for idx in component
                    group = diamond_structure.diamond[idx]
                    union!(combined_nodes, group.subgraph.relevant_nodes)
                    append!(combined_edges, group.subgraph.edgelist)
                end
                
                # Make sure join node is included
                push!(combined_nodes, join_node)
                
                # Generate indices for combined subgraph
                combined_outgoing = Dict{Int64, Set{Int64}}()
                combined_incoming = Dict{Int64, Set{Int64}}()
                
                for (i, j) in combined_edges
                    push!(get!(combined_outgoing, i, Set{Int64}()), j)
                    push!(get!(combined_incoming, j, Set{Int64}()), i)
                end
                
                # Identify true source nodes in the combined subgraph
                # Sources are nodes with no incoming edges in the combined subgraph
                combined_sources = Set{Int64}()
                for node in combined_nodes
                    if !haskey(combined_incoming, node) || isempty(combined_incoming[node])
                        push!(combined_sources, node)
                    end
                end
                
                # Generate all possible states of fork nodes (0 or 1)
                combined_belief = 0.0
                
                # Use binary representation for efficiency
                for state_idx in 0:(2^length(fork_nodes_list) - 1)
                    # Calculate fork state probability
                    state_probability = 1.0
                    fork_state_dict = Dict{Int64, Float64}()
                    
                    for (i, node) in enumerate(fork_nodes_list)
                        # Check if the i-th bit is set
                        if (state_idx & (1 << (i-1))) != 0
                            fork_state_dict[node] = 1.0
                            state_probability *= belief_dict[node]
                        else
                            fork_state_dict[node] = 0.0
                            state_probability *= (1.0 - belief_dict[node])
                        end
                    end
                    
                    # We need to handle the case where fork nodes aren't sources
                    # Create a temporary belief propagation network with fixed fork states
                    
                    # First, calculate iteration sets and other network properties
                    sub_iteration_sets, sub_ancestors, sub_descendants = InputProcessingModule.find_iteration_sets(
                        combined_edges,
                        combined_outgoing,
                        combined_incoming
                    )
                    
                    # Make a copy of node_priors and create a temporary belief dictionary
                    temp_belief = Dict{Int64, Float64}()
                    
                    # Assign fixed values to fork nodes
                    for (node, state) in fork_state_dict
                        temp_belief[node] = state
                    end
                    
                    # Assign values to source nodes
                    for node in combined_sources
                        if !haskey(temp_belief, node)  # Don't override fork nodes
                            temp_belief[node] = node_priors[node]
                        end
                    end
                    
                    # Propagate beliefs through the network
                    for node_set in sub_iteration_sets
                        for node in node_set
                            # Skip nodes we've already assigned
                            if haskey(temp_belief, node)
                                continue
                            end
                            
                            # Get parents
                            if !haskey(combined_incoming, node)
                                continue  # No parents
                            end
                            
                            parents = combined_incoming[node]
                            parent_beliefs = Float64[]
                            
                            for parent in parents
                                if !haskey(temp_belief, parent)
                                    # This shouldn't happen with proper iteration sets
                                    continue
                                end
                                
                                parent_belief = temp_belief[parent]
                                
                                if haskey(link_probability, (parent, node))
                                    edge_prob = link_probability[(parent, node)]
                                    push!(parent_beliefs, parent_belief * edge_prob)
                                end
                            end
                            
                            # Combine parent beliefs
                            if isempty(parent_beliefs)
                                temp_belief[node] = 0.0
                            elseif length(parent_beliefs) == 1
                                temp_belief[node] = parent_beliefs[1]
                            else
                                temp_belief[node] = inclusion_exclusion(parent_beliefs)
                            end
                        end
                    end
                    
                    # Check if join node has a calculated belief
                    if haskey(temp_belief, join_node)
                        join_belief = temp_belief[join_node]
                        # Add to total using law of total probability
                        combined_belief += join_belief * state_probability
                    else
                        # If join node belief wasn't calculated, there's a problem with the subgraph
                        # Use fallback strategy - take the value from original algorithm
                        fallback_group = diamond_structure.diamond[first(component)]
                        fallback_fork = first(fallback_group.highest_nodes)
                        fallback_belief_dict = updateDiamondJoin(
                            fallback_fork,
                            join_node,
                            fallback_group,
                            link_probability,
                            node_priors,
                            belief_dict,
                            source_nodes
                        )
                        combined_belief = fallback_belief_dict[join_node]
                        break  # Exit the loop, use fallback
                    end
                end
                
                push!(group_combined_beliefs, combined_belief)
            end
        end
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
