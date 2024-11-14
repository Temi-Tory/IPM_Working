module ReachabilityModule
using Combinatorics
using Main.NetworkDecomposition
using Main.InputProcessingModule

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
    diamond_structures::Dict{Int64, NetworkDecomposition.GroupedDiamondStructure},
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

            if haskey(diamond_structures, node)
                structure = diamond_structures[node]
                all_beliefs = Float64[]

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
               
                append!(all_beliefs, group_beliefs...)
                if !isempty(structure.non_diamond_parents)
                    non_diamond_belief = calculate_regular_belief(
                        structure.non_diamond_parents,
                        node,
                        belief_dict,
                        link_probability
                    )
                    push!(all_beliefs, non_diamond_belief...)
                end
                

                belief_dict[node] = inclusion_exclusion(all_beliefs)
            else
                parents = incoming_index[node]
                probability_from_parents = calculate_regular_belief(
                    parents,
                    node,
                    belief_dict,
                    link_probability
                )


                belief_dict[node] = inclusion_exclusion(probability_from_parents)
            end
        end
    end

    return belief_dict
end

function updateDiamondJoin(
    fork_node::Int64,
    join_node::Int64, 
    ancestor_group::NetworkDecomposition.AncestorGroup,
    link_probability::Dict{Tuple{Int64,Int64},Float64},
    node_priors::Dict{Int64,Float64},
    belief_dict::Dict{Int64,Float64},
    descendants::Dict{Int64,Set{Int64}}, 
    ancestors::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    iteration_sets::Vector{Set{Int64}},
    edgelist::Vector{Tuple{Int64,Int64}},
    join_nodes::Set{Int64},
    fork_nodes::Set{Int64}
)
    sub_sources = Set{Int64}()
    push!(sub_sources, fork_node)

    # Base nodes
    relevant_nodes = union(
        Set([fork_node]),
        ancestor_group.influenced_parents, 
        Set([join_node])
    )

    # Add intermediate nodes
    for parent in ancestor_group.influenced_parents
        parent_intermediates = intersect(
            descendants[fork_node],
            ancestors[parent]
        )
        relevant_nodes = union(relevant_nodes, parent_intermediates)
    end

    # Create sub_edgelist and sub_link_probability
    sub_edgelist = Vector{Tuple{Int64, Int64}}()
    sub_link_probability = Dict{Tuple{Int64, Int64}, Float64}()
    for edge in edgelist
        if edge[1] in relevant_nodes && edge[2] in relevant_nodes && edge[2] != fork_node 
            push!(sub_edgelist, edge)
            sub_link_probability[edge] = link_probability[edge]
        end
    end

    additional_nodes = Set{Int64}()
    # Add nodes that have an incoming edge to the relevant_nodes
    for node in relevant_nodes
        if node != fork_node && node != join_node
            incoming_nodes = incoming_index[node]
            new_incoming_nodes = setdiff(incoming_nodes, relevant_nodes)
            
            if !isempty(new_incoming_nodes)
                push!(additional_nodes, new_incoming_nodes...)
                push!(sub_sources, new_incoming_nodes...)
                
                # Update sub_edgelist and sub_link_probability
                for new_node in new_incoming_nodes
                    edge = (new_node, node)
                    push!(sub_edgelist, edge)
                    sub_link_probability[edge] = link_probability[edge]
                end
            end
        end
    end

    if !isempty(additional_nodes)
        push!(relevant_nodes, additional_nodes...)
    end

    # Filter iteration sets for relevant nodes
    sub_iteration_sets = [intersect(set, relevant_nodes) for set in iteration_sets]
    filter!(!isempty, sub_iteration_sets)

    # Create subgraph indices
    sub_outgoing = Dict{Int64,Set{Int64}}()
    sub_incoming = Dict{Int64,Set{Int64}}()

    for (source, dest) in sub_edgelist
        if !haskey(sub_outgoing, source)
            sub_outgoing[source] = Set{Int64}()
        end
        push!(sub_outgoing[source], dest)

        if !haskey(sub_incoming, dest)
            sub_incoming[dest] = Set{Int64}()
        end
        push!(sub_incoming[dest], source)
    end

  
    # Create sub_node_priors - copy original priors except for soruce nodes within subgraph 
    sub_node_priors = Dict{Int64, Float64}()
    for node in relevant_nodes
        if node ∉ sub_sources            
            sub_node_priors[node] = node_priors[node]
      
        else
            if node != fork_node            
                sub_node_priors[node] = belief_dict[node]
            end
        end
        
    end

    # Store original fork belief for final calculation
    original_fork_belief = belief_dict[fork_node]

    # Create sub_descendants and sub_ancestors
    sub_descendants = Dict{Int64, Set{Int64}}()
    sub_ancestors = Dict{Int64, Set{Int64}}()

    for (source, dest) in sub_edgelist
        if !haskey(sub_descendants, source)
            sub_descendants[source] = Set{Int64}()
        end
        push!(sub_descendants[source], dest)
    
        if !haskey(sub_ancestors, dest)
            sub_ancestors[dest] = Set{Int64}()
        end
        push!(sub_ancestors[dest], source)
    end

    # Create the subgraph's diamond structures
    sub_fork_nodes, sub_join_nodes = identify_fork_and_join_nodes(sub_outgoing, sub_incoming)
    sub_diamond_structures = NetworkDecomposition.identify_and_group_diamonds(
        sub_join_nodes,
        sub_ancestors,
        sub_incoming,
        sub_sources,
        sub_fork_nodes,
        sub_iteration_sets,
    )

    # Success case (fork = 1)
    sub_node_priors[fork_node] = 1.0
    success_belief = update_beliefs_iterative(
        sub_edgelist,          
        sub_iteration_sets,
        sub_outgoing,
        sub_incoming,
        sub_sources,
        sub_node_priors,
        sub_link_probability,
        sub_descendants,
        sub_ancestors,
        sub_diamond_structures,
        sub_join_nodes,     
        sub_fork_nodes      
    )[join_node]

    # Failure case (fork = 0)
    sub_node_priors[fork_node] = 0.0
    failure_belief = update_beliefs_iterative(
        sub_edgelist,          
        sub_iteration_sets,
        sub_outgoing,
        sub_incoming,
        sub_sources,
        sub_node_priors,
        sub_link_probability,
        sub_descendants,
        sub_ancestors,
        sub_diamond_structures,
        sub_join_nodes,     
        sub_fork_nodes      
    )[join_node]

    updated_belief_dict = copy(belief_dict)
    updated_belief_dict[fork_node] = original_fork_belief
    updated_belief_dict[join_node] = (success_belief * original_fork_belief) + (failure_belief * (1 - original_fork_belief))
    return updated_belief_dict
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

function calculate_diamond_groups_belief(
    diamond_structure::NetworkDecomposition.GroupedDiamondStructure,
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
            belief_dict,
            descendants,
            ancestors,
            incoming_index,
            outgoing_index,
            iteration_sets,
            edgelist,
            join_nodes,
            fork_nodes
        )
        push!(group_combined_beliefs, updated_belief_dict[join_node])
    end

    return group_combined_beliefs
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
end
