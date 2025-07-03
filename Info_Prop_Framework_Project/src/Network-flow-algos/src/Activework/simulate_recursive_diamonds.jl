"""
Simulation function to track recursive diamond identification beyond maximal diamonds.
This follows the exact logic from updateDiamondJoin to show how diamond local graph structures are created.
"""


"""
Simulate the recursive diamond identification process following updateDiamondJoin logic exactly.
"""
function simulate_recursive_diamond_identification(
    diamond_structure::DiamondsAtNode,
    link_probability::Dict{Tuple{Int64,Int64},Float64},
    node_priors::Dict{Int64,Float64},
    belief_dict::Dict{Int64,Float64}
)
    println("\n" * "="^80)
    println("SIMULATING RECURSIVE DIAMOND IDENTIFICATION")
    println("Following updateDiamondJoin logic exactly")
    println("="^80)
    
    results = []
    
    # Start with the main diamond - simulate setting highest nodes as conditioning nodes
    conditioning_nodes = diamond_structure.diamond.highest_nodes
    
    simulate_diamond_level(
        conditioning_nodes,
        diamond_structure.join_node,
        diamond_structure.diamond,
        link_probability,
        node_priors,
        belief_dict,
        1,  # level counter
        results,
        "MAIN"
    )
    
    return results
end

"""
Simulate diamond processing at a specific level following updateDiamondJoin exactly.
"""
function simulate_diamond_level(
    conditioning_nodes::Set{Int64},
    join_node::Int64,
    diamond::Diamond,
    link_probability::Dict{Tuple{Int64,Int64},Float64},
    node_priors::Dict{Int64,Float64},
    belief_dict::Dict{Int64,Float64},
    level::Int,
    results::Vector,
    level_name::String
)
    println("\n" * "─"^60)
    println("LEVEL $level: $level_name DIAMOND PROCESSING")
    println("─"^60)
    println("Join Node: $join_node")
    println("Diamond Edges: $(diamond.edgelist)")
    println("Diamond Relevant Nodes: $(diamond.relevant_nodes)")
    println("Diamond Highest Nodes: $(diamond.highest_nodes)")
    println("Conditioning Nodes: $conditioning_nodes")
    
    # Store current level info
    level_info = Dict(
        "level" => level,
        "level_name" => level_name,
        "join_node" => join_node,
        "diamond_edges" => diamond.edgelist,
        "relevant_nodes" => diamond.relevant_nodes,
        "highest_nodes" => diamond.highest_nodes,
        "conditioning_nodes" => conditioning_nodes,
        "inner_diamonds" => []
    )
    
    # STEP 1: Create sub_link_probability just for the diamond edges (from updateDiamondJoin)
    println("\nSTEP 1: Creating sub_link_probability for diamond edges")
    sub_link_probability = Dict{Tuple{Int64, Int64}, Float64}()
    for edge in diamond.edgelist
        sub_link_probability[edge] = link_probability[edge]
    end
    println("  Sub-link probabilities: $sub_link_probability")
    
    # STEP 2: Create fresh outgoing and incoming indices for the diamond (from updateDiamondJoin)
    println("\nSTEP 2: Creating fresh outgoing/incoming indices for diamond")
    sub_outgoing_index = Dict{Int64, Set{Int64}}()
    sub_incoming_index = Dict{Int64, Set{Int64}}()
    
    for (i, j) in diamond.edgelist
        push!(get!(sub_outgoing_index, i, Set{Int64}()), j)
        push!(get!(sub_incoming_index, j, Set{Int64}()), i)
    end
    
    println("  Sub-outgoing index: $sub_outgoing_index")
    println("  Sub-incoming index: $sub_incoming_index")
    
    # STEP 3: Find fresh sources within diamond (from updateDiamondJoin)
    println("\nSTEP 3: Finding fresh sources within diamond")
    fresh_sources = Set{Int64}()
    for node in keys(sub_outgoing_index)
        if !haskey(sub_incoming_index, node) || isempty(sub_incoming_index[node])
            push!(fresh_sources, node)
        end
    end
    println("  Fresh sources: $fresh_sources")
    
    # STEP 4: Calculate fresh iteration sets, ancestors, and descendants (from updateDiamondJoin)
    println("\nSTEP 4: Calculating sub-diamond structure")
    sub_iteration_sets, sub_ancestors, sub_descendants = find_iteration_sets(
        diamond.edgelist, 
        sub_outgoing_index, 
        sub_incoming_index
    )
    
    println("  Sub-iteration sets: $sub_iteration_sets")
    println("  Sub-ancestors: $sub_ancestors")
    println("  Sub-descendants: $sub_descendants")
    
    # STEP 5: Identify fork and join nodes using the fresh indices (from updateDiamondJoin)
    sub_fork_nodes, sub_join_nodes = identify_fork_and_join_nodes(
        sub_outgoing_index, 
        sub_incoming_index
    )
    
    println("  Sub-fork nodes: $sub_fork_nodes")
    println("  Sub-join nodes: $sub_join_nodes")
    
    # STEP 6: Create sub_node_priors for the diamond nodes (from updateDiamondJoin)
    println("\nSTEP 6: Setting up sub-node priors")
    sub_node_priors = Dict{Int64, Float64}()
    for node in diamond.relevant_nodes
        if node ∉ fresh_sources
            sub_node_priors[node] = node_priors[node]
            if node == join_node
                # If the node is the join node, set its prior to 1.0
                sub_node_priors[node] = 1.0                
            end
        elseif node ∉ conditioning_nodes 
            sub_node_priors[node] = belief_dict[node]
        elseif node ∈ conditioning_nodes 
            sub_node_priors[node] = 1.0    ## Set conditioning nodes to 1.0 so that diamonds identification works
        end
    end
    
    println("  Sub-node priors: $sub_node_priors")
    
    # STEP 7: Identify inner diamonds within this diamond (from updateDiamondJoin)
    println("\nSTEP 7: Identifying inner diamonds")
    
    if !isempty(sub_join_nodes)
        sub_diamond_structures = identify_and_group_diamonds(
            sub_join_nodes,
            sub_incoming_index,
            sub_ancestors,
            sub_descendants,
            fresh_sources,
            sub_fork_nodes,
            diamond.edgelist,
            sub_node_priors
        )
        
        if !isempty(sub_diamond_structures)
            println("  ✓ Found $(length(sub_diamond_structures)) inner diamond(s)!")
            
            # Process each inner diamond recursively
            for (inner_join_node, inner_diamond_structure) in sub_diamond_structures
                println("\n  ┌─ INNER DIAMOND at join node $inner_join_node")
                println("  │  Inner diamond edges: $(inner_diamond_structure.diamond.edgelist)")
                println("  │  Inner diamond highest nodes: $(inner_diamond_structure.diamond.highest_nodes)")
                println("  │  Inner diamond relevant nodes: $(inner_diamond_structure.diamond.relevant_nodes)")
                println("  │  Non-diamond parents: $(inner_diamond_structure.non_diamond_parents)")
                
                # Store inner diamond info
                inner_diamond_info = Dict(
                    "inner_join_node" => inner_join_node,
                    "inner_diamond_edges" => inner_diamond_structure.diamond.edgelist,
                    "inner_diamond_highest_nodes" => inner_diamond_structure.diamond.highest_nodes,
                    "inner_diamond_relevant_nodes" => inner_diamond_structure.diamond.relevant_nodes,
                    "inner_non_diamond_parents" => inner_diamond_structure.non_diamond_parents
                )
                push!(level_info["inner_diamonds"], inner_diamond_info)
                
                # RECURSIVE CALL: Process this inner diamond with its highest nodes as conditioning nodes
                inner_conditioning_nodes = inner_diamond_structure.diamond.highest_nodes
                println("  │  Recursing with conditioning nodes: $inner_conditioning_nodes")
                
                simulate_diamond_level(
                    inner_conditioning_nodes,
                    inner_join_node,
                    inner_diamond_structure.diamond,
                    link_probability,
                    node_priors,
                    belief_dict,
                    level + 1,
                    results,
                    "INNER-$inner_join_node"
                )
            end
        else
            println("  ✗ No inner diamonds found at this level")
        end
    else
        println("  ✗ No sub-join nodes found - no inner diamonds possible")
    end
    
    # Store this level's results
    push!(results, level_info)
    
    println("\n" * "─"^60)
    println("COMPLETED LEVEL $level: $level_name")
    println("─"^60)
end

"""
Helper function to add this simulation to your existing diaondTest.jl workflow
"""
function add_recursive_simulation_to_diamond_test(
    diamond_structures::Dict{Int64, DiamondsAtNode},
    link_probability::Dict{Tuple{Int64,Int64},Float64},
    node_priors::Dict{Int64,Float64}
)
    # Create a mock belief_dict for simulation (you can replace with actual beliefs)
    belief_dict = Dict{Int64, Float64}()
    for node in keys(node_priors)
        belief_dict[node] = 0.5  # Mock belief value
    end
    
    println("\n" * "="^100)
    println("RECURSIVE DIAMOND SIMULATION FOR ALL MAXIMAL DIAMONDS")
    println("="^100)
    
    all_results = Dict{Int64, Any}()
    
    for (join_node, diamond_structure) in diamond_structures
        println("\n" * "🔸"^50)
        println("PROCESSING MAXIMAL DIAMOND AT JOIN NODE: $join_node")
        println("🔸"^50)
        
        results = simulate_recursive_diamond_identification(
            diamond_structure,
            link_probability,
            node_priors,
            belief_dict
        )
        
        all_results[join_node] = results
    end
    
    return all_results
end