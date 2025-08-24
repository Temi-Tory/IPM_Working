"""
TestSDPBeliefPropagation.jl - Standalone Test of SDP Belief Propagation

Tests the core SDP belief propagation logic without full module dependencies.
"""

using DataStructures, Combinatorics

# Simplified SDP belief propagation structures for testing
struct BeliefPath{T}
    source_nodes::Set{Int64}
    intermediate_nodes::Vector{Int64}
    target_node::Int64
    path_edges::Vector{Tuple{Int64,Int64}}
    path_probability::T
end

struct BeliefTerm{T}
    source_combination::Set{Int64}
    complement_combination::Set{Int64}
    paths_included::Vector{BeliefPath{T}}
    coefficient::T
end

# Core SDP belief computation functions
function find_minimal_belief_paths(
    conditioning_nodes::Set{Int64},
    join_node::Int64,
    diamond_edges::Vector{Tuple{Int64,Int64}},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64}
)
    minimal_paths = Vector{BeliefPath{Float64}}()

    # Build adjacency representation
    adjacency = Dict{Int64, Vector{Int64}}()
    for (src, dst) in diamond_edges
        if !haskey(adjacency, src)
            adjacency[src] = Int64[]
        end
        push!(adjacency[src], dst)
    end

    # Find paths from each conditioning node to join node
    for conditioning_node in conditioning_nodes
        paths_from_node = find_paths_dfs(
            conditioning_node, join_node, adjacency, edge_probabilities
        )
        
        for (nodes_in_path, edges_in_path, path_prob) in paths_from_node
            belief_path = BeliefPath{Float64}(
                Set([conditioning_node]),
                nodes_in_path[2:end-1],
                join_node,
                edges_in_path,
                path_prob
            )
            push!(minimal_paths, belief_path)
        end
    end

    return minimal_paths
end

function find_paths_dfs(
    source::Int64,
    target::Int64,
    adjacency::Dict{Int64, Vector{Int64}},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64}
)
    all_paths = Vector{Tuple{Vector{Int64}, Vector{Tuple{Int64,Int64}}, Float64}}()
    
    function dfs(current::Int64, path::Vector{Int64}, edges::Vector{Tuple{Int64,Int64}}, prob::Float64, visited::Set{Int64})
        if current == target
            push!(all_paths, (copy(path), copy(edges), prob))
            return
        end
        
        if haskey(adjacency, current)
            for neighbor in adjacency[current]
                if neighbor ∉ visited
                    edge = (current, neighbor)
                    edge_prob = get(edge_probabilities, edge, 1.0)
                    
                    push!(visited, neighbor)
                    push!(path, neighbor)
                    push!(edges, edge)
                    
                    dfs(neighbor, path, edges, prob * edge_prob, visited)
                    
                    pop!(path)
                    pop!(edges)
                    delete!(visited, neighbor)
                end
            end
        end
    end
    
    visited = Set([source])
    path = [source]
    edges = Tuple{Int64,Int64}[]
    dfs(source, path, edges, 1.0, visited)
    
    return all_paths
end

function convert_paths_to_sdp_terms(
    minimal_paths::Vector{BeliefPath{Float64}},
    conditioning_nodes::Set{Int64}
)
    sdp_terms = Vector{BeliefTerm{Float64}}()
    conditioning_list = collect(conditioning_nodes)
    
    # For belief propagation, we want P(join receives signal from any path)
    # This is different from network reliability - we need conditional probabilities
    
    # Generate all possible states of conditioning nodes
    for state_idx in 0:(2^length(conditioning_list) - 1)
        active_nodes = Set{Int64}()
        inactive_nodes = Set{Int64}()
        
        # Determine which nodes are active in this state
        for (i, node) in enumerate(conditioning_list)
            if (state_idx & (1 << (i-1))) != 0
                push!(active_nodes, node)
            else
                push!(inactive_nodes, node)
            end
        end
        
        # Skip the all-inactive state (no signal possible)
        if isempty(active_nodes)
            continue
        end
        
        # Find paths that can contribute in this state
        relevant_paths = BeliefPath{Float64}[]
        for path in minimal_paths
            # Path contributes if its source node is active
            if !isempty(intersect(path.source_nodes, active_nodes))
                push!(relevant_paths, path)
            end
        end
        
        if !isempty(relevant_paths)
            term = BeliefTerm{Float64}(
                active_nodes,
                inactive_nodes,
                relevant_paths,
                1.0  # Coefficient is 1.0 for state-based enumeration
            )
            
            push!(sdp_terms, term)
        end
    end

    return sdp_terms
end

function compute_diamond_belief_sdp(
    sdp_terms::Vector{BeliefTerm{Float64}},
    current_beliefs::Dict{Int64, Float64}
)
    total_belief = 0.0

    for term in sdp_terms
        # Start with coefficient for inclusion-exclusion
        term_probability = term.coefficient

        # Active conditioning nodes (these are "on" in this term)
        for node in term.source_combination
            if haskey(current_beliefs, node)
                term_probability *= current_beliefs[node]
            end
        end

        # Inactive conditioning nodes (these are "off" in this term)
        for node in term.complement_combination
            if haskey(current_beliefs, node)
                term_probability *= (1.0 - current_beliefs[node])
            end
        end

        # For belief propagation, we need probability that signal reaches join node
        # given this combination of conditioning nodes is active
        if !isempty(term.paths_included)
            # Calculate union probability of all paths in this term
            paths_signal_prob = compute_paths_union_probability(term.paths_included)
            term_probability *= paths_signal_prob
        end

        total_belief += term_probability
    end

    return total_belief
end

# New helper function for correct path union probability
function compute_paths_union_probability(paths::Vector{BeliefPath{Float64}})
    if isempty(paths)
        return 0.0
    end
    
    if length(paths) == 1
        return paths[1].path_probability
    end
    
    # For independent paths, use inclusion-exclusion
    # P(A ∪ B) = P(A) + P(B) - P(A ∩ B)
    # P(A ∩ B) = P(A) × P(B) for independent paths
    
    total_prob = 0.0
    num_paths = length(paths)
    
    for k in 1:num_paths
        for combination in combinations(1:num_paths, k)
            # Compute intersection probability
            intersection_prob = 1.0
            for path_idx in combination
                intersection_prob *= paths[path_idx].path_probability
            end
            
            # Add with inclusion-exclusion sign
            sign = (-1)^(k-1)
            total_prob += sign * intersection_prob
        end
    end
    
    return total_prob
end

# Main test function
function test_simple_diamond_sdp()
    println("="^60)
    println("TESTING SDP BELIEF PROPAGATION - Simple Diamond")
    println("="^60)
    
    # Simple diamond: C1 → D1 → J, C2 → D2 → J
    diamond_edges = [
        (1, 3),  # C1 → D1
        (2, 4),  # C2 → D2  
        (3, 5),  # D1 → J
        (4, 5)   # D2 → J
    ]
    
    conditioning_nodes = Set([1, 2])
    join_node = 5
    
    current_beliefs = Dict{Int64, Float64}(
        1 => 0.8,  # C1: 80%
        2 => 0.6   # C2: 60%
    )
    
    edge_probabilities = Dict{Tuple{Int64,Int64}, Float64}(
        (1, 3) => 0.9,  # C1 → D1: 90%
        (2, 4) => 0.7,  # C2 → D2: 70%  
        (3, 5) => 0.8,  # D1 → J: 80%
        (4, 5) => 0.8   # D2 → J: 80%
    )
    
    node_priors = Dict{Int64, Float64}(5 => 0.4)  # J prior: 40%
    
    println("Testing diamond with $(length(conditioning_nodes)) conditioning nodes")
    
    try
        # Step 1: Find minimal paths
        println("\nStep 1: Finding minimal belief paths...")
        minimal_paths = find_minimal_belief_paths(
            conditioning_nodes, join_node, diamond_edges, edge_probabilities
        )
        
        println("Found $(length(minimal_paths)) minimal paths:")
        for (i, path) in enumerate(minimal_paths)
            println("  Path $i: $(first(path.source_nodes)) → $(path.target_node), prob = $(path.path_probability)")
        end
        
        # Step 2: Convert to SDP terms
        println("\nStep 2: Converting to SDP terms...")
        sdp_terms = convert_paths_to_sdp_terms(minimal_paths, conditioning_nodes)
        
        println("Generated $(length(sdp_terms)) SDP terms:")
        for (i, term) in enumerate(sdp_terms)
            println("  Term $i: sources=$(term.source_combination), coeff=$(term.coefficient)")
        end
        
        # Step 3: Compute belief
        println("\nStep 3: Computing belief using SDP...")
        sdp_result = compute_diamond_belief_sdp(sdp_terms, current_beliefs)
        
        # Apply node prior
        final_result = sdp_result * node_priors[join_node]
        
        println("SDP computation result: $sdp_result")
        println("After applying node prior ($(node_priors[join_node])): $final_result")
        
        # Manual verification
        println("\nStep 4: Manual verification...")
        # P(J gets signal) = P(C1→D1→J) + P(C2→D2→J) - P(both)
        path1_prob = current_beliefs[1] * edge_probabilities[(1,3)] * edge_probabilities[(3,5)]
        path2_prob = current_beliefs[2] * edge_probabilities[(2,4)] * edge_probabilities[(4,5)]
        both_paths_prob = path1_prob * path2_prob  # Independent
        
        manual_signal_prob = path1_prob + path2_prob - both_paths_prob
        manual_result = manual_signal_prob * node_priors[join_node]
        
        println("Manual calculation:")
        println("  Path 1 probability: $path1_prob")
        println("  Path 2 probability: $path2_prob") 
        println("  Both paths probability: $both_paths_prob")
        println("  Signal probability: $manual_signal_prob")
        println("  Final result: $manual_result")
        
        println("\nComparison:")
        println("  SDP result:    $final_result")
        println("  Manual result: $manual_result")
        println("  Difference:    $(abs(final_result - manual_result))")
        
        if abs(final_result - manual_result) < 1e-6
            println("✅ SDP matches manual calculation!")
            return true
        else
            println("❌ SDP differs from manual calculation")
            return false
        end
        
    catch e
        println("ERROR: $e")
        println("Stack trace:")
        for (exc, bt) in Base.catch_stack()
            showerror(stdout, exc, bt)
            println()
        end
        return false
    end
end

# Run the test
println("Starting SDP belief propagation test...")
success = test_simple_diamond_sdp()
println("\nTest result: $(success ? "PASSED" : "FAILED")")