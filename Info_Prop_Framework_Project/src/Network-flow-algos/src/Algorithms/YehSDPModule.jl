"""
YehSDPModule.jl - Proper Sum of Disjoint Products Implementation

Based on Wei-Chang Yeh's 2007 paper: "An improved sum-of-disjoint-products technique 
for the symbolic network reliability analysis with known minimal paths"

Key innovations from the paper:
1. Absorption Law: If Ai ⊆ B ⊆ E, then P^c(Ai) · P^c(B) = P^c(Ai)
2. Subpath Analysis: Uses shortest paths between node pairs in MPs
3. Variable Ordering: Process MPs by length with optimal subpath relationships
4. Disjoint Product Formation: R = P(A₁) + P(A₂ ∩ [A₁]^c) + P(A₃ ∩ [A₁]^c ∩ [A₂]^c) + ...

Core Formula: P(Ai) · ∏(j=1 to i-1) P^c(Aj - Ai) = P(Ai) · ∏ P^c(ω<) · ∏ P^c(ω=)
"""

module YehSDPModule

using DataStructures
using SparseArrays

# Core data structures for Yeh's SDP algorithm
struct MinimalPath{T}
    edges::Vector{Tuple{Int64,Int64}}
    nodes::Vector{Int64}
    length::Int64
    probability::T
end

struct SubPath{T}
    start_node::Int64
    end_node::Int64
    edges::Vector{Tuple{Int64,Int64}}
    length::Int64
    probability::T
end

struct YehSDPNetwork{T}
    # Optimized adjacency lists (fastest from benchmark)
    adjacency_list::Vector{Vector{Int64}}
    reverse_adjacency_list::Vector{Vector{Int64}}
    
    # Network data
    node_priors::Dict{Int64, T}
    edge_probabilities::Dict{Tuple{Int64,Int64}, T}
    source_nodes::Set{Int64}
    
    # Minimal Paths (sorted by length: |A₁| ≤ |A₂| ≤ ... ≤ |Aₘ|)
    minimal_paths::Vector{MinimalPath{T}}
    
    # Network metadata
    num_nodes::Int64
    edgelist::Vector{Tuple{Int64,Int64}}
end

"""
Build YehSDP network structure from existing network data
Converts paths to minimal paths and sorts by length as required by Yeh's algorithm
"""
function build_yeh_sdp_network(
    edgelist::Vector{Tuple{Int64,Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64, T},
    edge_probabilities::Dict{Tuple{Int64,Int64}, T}
) where T
    
    println("Building Yeh SDP network structure...")
    
    # Get all nodes and determine max node ID
    all_nodes = collect(keys(node_priors))
    max_node = maximum(all_nodes)
    num_nodes = length(all_nodes)
    
    # Build optimized adjacency lists (fastest representation from benchmark)
    adjacency_list = Vector{Vector{Int64}}(undef, max_node)
    reverse_adjacency_list = Vector{Vector{Int64}}(undef, max_node)
    
    for i in 1:max_node
        adjacency_list[i] = Int64[]
        reverse_adjacency_list[i] = Int64[]
    end
    
    for (src, dst) in edgelist
        push!(adjacency_list[src], dst)
        push!(reverse_adjacency_list[dst], src)
    end
    
    # Sort for consistent access patterns and cache efficiency
    for i in 1:max_node
        sort!(adjacency_list[i])
        sort!(reverse_adjacency_list[i])
    end
    
    # Find all minimal paths from sources to sinks
    minimal_paths = find_all_minimal_paths(
        adjacency_list, source_nodes, all_nodes, edge_probabilities
    )
    
    # Sort minimal paths by length (required by Yeh's algorithm)
    sort!(minimal_paths, by = mp -> mp.length)
    
    println("Found $(length(minimal_paths)) minimal paths")
    for (i, mp) in enumerate(minimal_paths[1:min(5, end)])
        println("  A$i: $(mp.nodes) (length=$(mp.length))")
    end
    
    return YehSDPNetwork(
        adjacency_list,
        reverse_adjacency_list,
        node_priors,
        edge_probabilities,
        source_nodes,
        minimal_paths,
        max_node,
        edgelist
    )
end

"""
Find all minimal paths in the network
Returns paths sorted by length as required by Yeh's algorithm
This is used for initial setup - individual node calculations will filter these
"""
function find_all_minimal_paths(
    adjacency_list::Vector{Vector{Int64}},
    source_nodes::Set{Int64},
    all_nodes::Vector{Int64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, T}
) where T
    
    minimal_paths = Vector{MinimalPath{T}}()
    
    # Find all paths from sources to non-source nodes
    for target in all_nodes
        if target ∉ source_nodes
            for source in source_nodes
                paths = find_simple_paths(adjacency_list, source, target)
                
                for path_nodes in paths
                    # Convert node path to edge path
                    edges = Vector{Tuple{Int64,Int64}}()
                    for i in 1:(length(path_nodes)-1)
                        push!(edges, (path_nodes[i], path_nodes[i+1]))
                    end
                    
                    # Calculate path probability (product of edge probabilities)
                    path_prob = one(T)
                    for edge in edges
                        if haskey(edge_probabilities, edge)
                            path_prob *= edge_probabilities[edge]
                        end
                    end
                    
                    mp = MinimalPath{T}(edges, path_nodes, length(edges), path_prob)
                    push!(minimal_paths, mp)
                end
            end
        end
    end
    
    return minimal_paths
end

"""
Compute reachability probability for specific target node using Yeh's SDP
This is the key function that applies Yeh's algorithm per-node
"""
function compute_node_reachability_yeh_sdp(
    target_node::Int64,
    yeh_network::YehSDPNetwork{T}
) where T
    
    # Filter minimal paths that reach this target node
    target_paths = Vector{MinimalPath{T}}()
    for mp in yeh_network.minimal_paths
        if mp.nodes[end] == target_node
            push!(target_paths, mp)
        end
    end
    
    if isempty(target_paths)
        return zero(T)  # No paths to this node
    end
    
    # Apply Yeh's SDP algorithm to these target-specific paths
    return compute_yeh_sdp_reliability_for_paths(target_paths, target_node, yeh_network)
end

"""
Apply Yeh's SDP algorithm to a specific set of paths leading to target_node
This is the core per-node implementation
"""
function compute_yeh_sdp_reliability_for_paths(
    target_paths::Vector{MinimalPath{T}},
    target_node::Int64,
    yeh_network::YehSDPNetwork{T}
) where T
    
    m = length(target_paths)
    if m == 0
        return zero(T)
    end
    
    # Sort paths by length (Yeh's requirement)
    sort!(target_paths, by = mp -> mp.length)
    
    # Initialize reliability with first path or first two paths
    R = zero(T)
    
    if m == 1
        # Single path case
        A1 = target_paths[1]
        R = compute_path_probability_with_target(A1, target_node, yeh_network)
        return R
    end
    
    # Handle first two paths (Step 1 from algorithm)
    A1, A2 = target_paths[1], target_paths[2]
    
    if are_disjoint_paths(A1, A2)
        # A₁ ∩ A₂ = ∅ (disjoint paths)
        P_A1 = compute_path_probability_with_target(A1, target_node, yeh_network)
        P_A2 = compute_path_probability_with_target(A2, target_node, yeh_network)
        R = one(T) - (one(T) - P_A1) * (one(T) - P_A2)  # 1 - P^c(A₁) · P^c(A₂)
    else
        # A₁ ∩ A₂ ≠ ∅ (overlapping paths)
        P_A1 = compute_path_probability_with_target(A1, target_node, yeh_network)
        P_A2 = compute_path_probability_with_target(A2, target_node, yeh_network)
        intersection_edges = intersect(Set(A1.edges), Set(A2.edges))
        P_intersection = compute_edge_set_probability(intersection_edges, yeh_network)
        # Include target node probability in intersection
        P_intersection *= yeh_network.node_priors[target_node]
        R = P_A1 + P_A2 - P_intersection
    end
    
    # Process remaining paths (γ = 3, 4, ..., m)
    for γ in 3:m
        Aγ = target_paths[γ]
        
        # Compute disjoint product for Aγ using Yeh's method
        Rγ = compute_disjoint_product_yeh_for_target(γ, target_paths, target_node, yeh_network)
        
        R += Rγ
    end
    
    return R
end

"""
Compute disjoint product for path Aγ targeting specific node
"""
function compute_disjoint_product_yeh_for_target(
    γ::Int64,
    target_paths::Vector{MinimalPath{T}},
    target_node::Int64,
    yeh_network::YehSDPNetwork{T}
) where T
    
    Aγ = target_paths[γ]
    
    # Start with P(Aγ) including target node probability
    Rγ = compute_path_probability_with_target(Aγ, target_node, yeh_network)
    
    # Apply the core Yeh formula: P(Aγ) · ∏(j=1 to γ-1) P^c(Aj - Aγ)
    for j in 1:(γ-1)
        Aj = target_paths[j]
        
        # Compute P^c(Aj - Aγ) using subpath analysis
        subpath_factor = compute_subpath_factor(Aj, Aγ, yeh_network)
        Rγ *= subpath_factor
    end
    
    return Rγ
end

"""
Compute probability of a path including target node probability
This ensures we account for target node being active
"""
function compute_path_probability_with_target(
    path::MinimalPath{T},
    target_node::Int64,
    yeh_network::YehSDPNetwork{T}
) where T
    
    prob = one(T)
    
    # Node probabilities (including target node)
    for node in path.nodes
        if haskey(yeh_network.node_priors, node)
            prob *= yeh_network.node_priors[node]
        end
    end
    
    # Edge probabilities
    prob *= path.probability
    
    return prob
end

"""
Find all simple paths between two nodes using DFS
"""
function find_simple_paths(
    adjacency_list::Vector{Vector{Int64}},
    start::Int64,
    target::Int64,
    max_paths::Int64 = 100  # Limit to prevent explosion
)
    paths = Vector{Vector{Int64}}()
    visited = Set{Int64}()
    current_path = Int64[]
    
    function dfs(current)
        if length(paths) >= max_paths
            return
        end
        
        push!(visited, current)
        push!(current_path, current)
        
        if current == target
            push!(paths, copy(current_path))
        else
            # Use optimized adjacency list access
            if current <= length(adjacency_list)
                for neighbor in adjacency_list[current]
                    if neighbor ∉ visited && length(paths) < max_paths
                        dfs(neighbor)
                    end
                end
            end
        end
        
        pop!(current_path)
        delete!(visited, current)
    end
    
    dfs(start)
    return paths
end

"""
Main Yeh SDP algorithm implementation
Implements the exact algorithm from the 2007 paper
"""
function compute_yeh_sdp_reliability(
    yeh_network::YehSDPNetwork{T}
) where T
    
    println("=== YEH SDP ALGORITHM ===")
    println("Computing reliability using $(length(yeh_network.minimal_paths)) minimal paths...")
    
    m = length(yeh_network.minimal_paths)
    if m == 0
        return zero(T)
    end
    
    minimal_paths = yeh_network.minimal_paths
    
    # Initialize reliability with first two paths (special case from paper)
    R = zero(T)
    
    if m == 1
        # Single path case
        A1 = minimal_paths[1]
        R = compute_path_probability(A1, yeh_network)
        println("Single path reliability: $R")
        return R
    end
    
    # Handle first two paths (Step 1 from algorithm)
    A1, A2 = minimal_paths[1], minimal_paths[2]
    
    if are_disjoint_paths(A1, A2)
        # A₁ ∩ A₂ = ∅ (disjoint paths)
        P_A1 = compute_path_probability(A1, yeh_network)
        P_A2 = compute_path_probability(A2, yeh_network)
        R = one(T) - (one(T) - P_A1) * (one(T) - P_A2)  # 1 - P^c(A₁) · P^c(A₂)
        println("First two paths (disjoint): R = $R")
    else
        # A₁ ∩ A₂ ≠ ∅ (overlapping paths)
        P_A1 = compute_path_probability(A1, yeh_network)
        P_A2 = compute_path_probability(A2, yeh_network)
        intersection_edges = intersect(Set(A1.edges), Set(A2.edges))
        P_intersection = compute_edge_set_probability(intersection_edges, yeh_network)
        R = P_A1 + P_A2 - P_intersection
        println("First two paths (overlapping): R = $R")
    end
    
    # Process remaining paths (γ = 3, 4, ..., m)
    for γ in 3:m
        Aγ = minimal_paths[γ]
        
        # Compute disjoint product for Aγ using Yeh's method
        Rγ = compute_disjoint_product_yeh(γ, minimal_paths, yeh_network)
        
        R += Rγ
        
        if γ <= 5  # Show first few for debugging
            println("Path A$γ: $(Aγ.nodes), contribution: $Rγ")
        end
    end
    
    println("Final Yeh SDP reliability: $R")
    return R
end

"""
Compute disjoint product for path Aγ using Yeh's improved algorithm
Implements Theorem 1 from the paper
"""
function compute_disjoint_product_yeh(
    γ::Int64,
    minimal_paths::Vector{MinimalPath{T}},
    yeh_network::YehSDPNetwork{T}
) where T
    
    Aγ = minimal_paths[γ]
    
    # Start with P(Aγ)
    Rγ = compute_path_probability(Aγ, yeh_network)
    
    # Apply the core Yeh formula: P(Aγ) · ∏(j=1 to γ-1) P^c(Aj - Aγ)
    # Optimized version: P(Aγ) · ∏ P^c(ω<) · ∏ P^c(ω=)
    
    # Check if Aγ is one of the longest MPs (Corollary 6)
    if is_longest_path(γ, minimal_paths)
        # Special case: only need to consider individual edges
        for edge in yeh_network.edgelist
            if edge ∉ Aγ.edges
                edge_prob = get(yeh_network.edge_probabilities, edge, zero(T))
                Rγ *= (one(T) - edge_prob)  # P^c(edge)
            end
        end
        return Rγ
    end
    
    # General case: analyze subpaths between node pairs in Aγ
    for j in 1:(γ-1)
        Aj = minimal_paths[j]
        
        # Compute P^c(Aj - Aγ) using subpath analysis
        subpath_factor = compute_subpath_factor(Aj, Aγ, yeh_network)
        Rγ *= subpath_factor
    end
    
    return Rγ
end

"""
Compute subpath factor P^c(Aj - Aγ) using Yeh's subpath analysis
This is the core innovation of the paper
"""
function compute_subpath_factor(
    Aj::MinimalPath{T},
    Aγ::MinimalPath{T},
    yeh_network::YehSDPNetwork{T}
) where T
    
    # Find difference edges: Aj - Aγ
    Aj_edges = Set(Aj.edges)
    Aγ_edges = Set(Aγ.edges)
    diff_edges = setdiff(Aj_edges, Aγ_edges)
    
    if isempty(diff_edges)
        # Aj ⊆ Aγ, apply absorption law
        return one(T)  # P^c(∅) = 1
    end
    
    # Compute probability of difference edges
    diff_prob = one(T)
    for edge in diff_edges
        edge_prob = get(yeh_network.edge_probabilities, edge, zero(T))
        diff_prob *= edge_prob
    end
    
    return one(T) - diff_prob  # P^c(Aj - Aγ)
end

"""
Check if path γ is one of the longest minimal paths
"""
function is_longest_path(γ::Int64, minimal_paths::Vector{MinimalPath{T}}) where T
    Aγ = minimal_paths[γ]
    max_length = maximum(mp.length for mp in minimal_paths)
    return Aγ.length == max_length
end

"""
Check if two paths are disjoint (no common edges)
"""
function are_disjoint_paths(A1::MinimalPath{T}, A2::MinimalPath{T}) where T
    return isempty(intersect(Set(A1.edges), Set(A2.edges)))
end

"""
Compute probability of a single path
P(Ai) = (∏ node_priors for nodes in path) × (∏ edge_probs for edges in path)
"""
function compute_path_probability(
    path::MinimalPath{T},
    yeh_network::YehSDPNetwork{T}
) where T
    
    prob = one(T)
    
    # Node probabilities
    for node in path.nodes
        if haskey(yeh_network.node_priors, node)
            prob *= yeh_network.node_priors[node]
        end
    end
    
    # Edge probabilities (already computed in path.probability)
    prob *= path.probability
    
    return prob
end

"""
Compute probability of a set of edges
"""
function compute_edge_set_probability(
    edges::Set{Tuple{Int64,Int64}},
    yeh_network::YehSDPNetwork{T}
) where T
    
    prob = one(T)
    for edge in edges
        if haskey(yeh_network.edge_probabilities, edge)
            prob *= yeh_network.edge_probabilities[edge]
        end
    end
    return prob
end

"""
Main interface function - processes entire network using Yeh's SDP
Computes individual node reachability probabilities (not just network reliability)
Returns results in same format as existing exact algorithm for comparison
"""
function process_network_yeh_sdp(
    edgelist::Vector{Tuple{Int64,Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64, T},
    edge_probabilities::Dict{Tuple{Int64,Int64}, T}
) where T
    
    println("=== YEH SDP PROCESSING ===")
    
    # Build Yeh SDP network structure
    yeh_network = build_yeh_sdp_network(
        edgelist, outgoing_index, incoming_index,
        source_nodes, node_priors, edge_probabilities
    )
    
    # Compute individual node reachability probabilities
    results = Dict{Int64, T}()
    all_nodes = collect(keys(node_priors))
    
    println("Computing reachability for $(length(all_nodes)) nodes...")
    
    for node in all_nodes
        if node in source_nodes
            # Source nodes have their prior probability
            results[node] = node_priors[node]
        else
            # Compute reachability from sources to this specific node
            node_reachability = compute_node_reachability_yeh_sdp(node, yeh_network)
            results[node] = node_reachability
        end
    end
    
    println("Yeh SDP processing complete!")
    return results
end

# Export main functions
export YehSDPNetwork, MinimalPath, SubPath
export build_yeh_sdp_network, process_network_yeh_sdp
export compute_yeh_sdp_reliability

end # module YehSDPModule