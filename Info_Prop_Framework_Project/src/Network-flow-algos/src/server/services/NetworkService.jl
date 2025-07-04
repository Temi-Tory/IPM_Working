"""
NetworkService.jl

Core network analysis service that orchestrates IPAFramework operations.
Handles network structure analysis, diamond processing, and belief propagation.
"""
module NetworkService

# Import IPAFramework - assuming it's available in the parent scope
using DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, Combinatorics

export NetworkAnalysisResult, perform_network_analysis, perform_diamond_analysis,
       perform_reachability_analysis, perform_monte_carlo_analysis, perform_path_enumeration,
       DiamondAnalysisResult, ReachabilityResult, MonteCarloResult, PathEnumerationResult

# Strict type definitions for network analysis results
struct NetworkAnalysisResult
    edgelist::Vector{Tuple{Int64,Int64}}
    outgoing_index::Dict{Int64,Set{Int64}}
    incoming_index::Dict{Int64,Set{Int64}}
    source_nodes::Set{Int64}
    node_priors::Dict{Int64, Float64}
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64}
    fork_nodes::Set{Int64}
    join_nodes::Set{Int64}
    iteration_sets::Vector{Set{Int64}}
    ancestors::Dict{Int64, Set{Int64}}
    descendants::Dict{Int64, Set{Int64}}
    diamond_structures::Dict
end

struct DiamondAnalysisResult
    diamond_structures::Dict
    diamond_classifications::Union{Vector, Nothing}
end

struct ReachabilityResult
    node_probabilities::Dict{Int64, Float64}
    analysis_metadata::Dict{String, Any}
end

struct MonteCarloResult
    monte_carlo_probabilities::Dict{Int64, Float64}
    comparison_results::Vector{Dict{String, Any}}
    iterations::Int
end

struct PathEnumerationResult
    paths::Vector{Vector{Int64}}
    path_probabilities::Vector{Float64}
    total_paths::Int
end

"""
    perform_network_analysis(csv_content, include_framework = true) -> NetworkAnalysisResult

Perform complete network structure analysis including IPAFramework processing.
"""
function perform_network_analysis(
    csv_content::String, 
    include_framework::Bool = true
)::NetworkAnalysisResult
    
    println("🔄 Starting network analysis...")
    
    # Create temporary file for CSV processing
    temp_file = tempname() * ".csv"
    write(temp_file, csv_content)
    
    try
        # Use IPAFramework to read and process the network
        # Note: This assumes IPAFramework is included in the calling scope
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = 
            Main.IPAFramework.read_graph_to_dict(temp_file)
        
        println("📊 Network loaded: $(length(union(keys(outgoing_index), keys(incoming_index)))) nodes, $(length(edgelist)) edges")
        
        # Identify network structure
        fork_nodes, join_nodes = Main.IPAFramework.identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = Main.IPAFramework.find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        println("🔍 Structure identified: $(length(fork_nodes)) forks, $(length(join_nodes)) joins, $(length(iteration_sets)) iteration sets")
        
        # Initialize diamond structures
        diamond_structures = Dict()
        
        if include_framework
            # Identify diamond structures
            diamond_structures = Main.IPAFramework.identify_and_group_diamonds(
                join_nodes, ancestors, incoming_index, source_nodes,
                fork_nodes, iteration_sets, edgelist, descendants, node_priors
            )
            
            println("💎 Diamond analysis: $(length(diamond_structures)) diamond structures found")
        end
        
        return NetworkAnalysisResult(
            edgelist, outgoing_index, incoming_index, source_nodes,
            node_priors, edge_probabilities, fork_nodes, join_nodes,
            iteration_sets, ancestors, descendants, diamond_structures
        )
        
    finally
        # Clean up temporary file
        rm(temp_file, force=true)
    end
end

"""
    perform_diamond_analysis(network_result, include_classification = true) -> DiamondAnalysisResult

Perform detailed diamond structure analysis and classification.
"""
function perform_diamond_analysis(
    network_result::NetworkAnalysisResult,
    include_classification::Bool = true
)::DiamondAnalysisResult
    
    println("🔄 Starting diamond analysis...")
    
    diamond_classifications = nothing
    
    if include_classification && !isempty(network_result.diamond_structures)
        println("🔍 Running diamond classification...")
        
        diamond_classifications = Vector{Dict{String, Any}}()
        
        for (join_node, diamonds_at_node) in network_result.diamond_structures
            for (i, diamond) in enumerate(diamonds_at_node.diamond)
                try
                    classification = Main.IPAFramework.classify_diamond_exhaustive(
                        diamond, join_node,
                        network_result.edgelist, network_result.outgoing_index, 
                        network_result.incoming_index, network_result.source_nodes,
                        network_result.fork_nodes, network_result.join_nodes, 
                        network_result.iteration_sets, network_result.ancestors, 
                        network_result.descendants
                    )
                    
                    classification_dict = Dict{String, Any}(
                        "joinNode" => join_node,
                        "diamondIndex" => i,
                        "forkStructure" => string(classification.fork_structure),
                        "internalStructure" => string(classification.internal_structure),
                        "pathTopology" => string(classification.path_topology),
                        "joinStructure" => string(classification.join_structure),
                        "externalConnectivity" => string(classification.external_connectivity),
                        "degeneracy" => string(classification.degeneracy),
                        "forkCount" => classification.fork_count,
                        "subgraphSize" => classification.subgraph_size,
                        "internalForks" => classification.internal_forks,
                        "internalJoins" => classification.internal_joins,
                        "pathCount" => classification.path_count,
                        "complexityScore" => classification.complexity_score,
                        "optimizationPotential" => classification.optimization_potential,
                        "bottleneckRisk" => classification.bottleneck_risk
                    )
                    
                    push!(diamond_classifications, classification_dict)
                    println("💎 Classified diamond at join $join_node: $(classification.internal_structure)")
                    
                catch e
                    println("⚠️ Warning: Failed to classify diamond at join $join_node: $e")
                end
            end
        end
        
        println("✅ Diamond classification complete: $(length(diamond_classifications)) diamonds classified")
    end
    
    return DiamondAnalysisResult(network_result.diamond_structures, diamond_classifications)
end

"""
    perform_reachability_analysis(network_result) -> ReachabilityResult

Perform reachability analysis using IPAFramework belief propagation.
"""
function perform_reachability_analysis(network_result::NetworkAnalysisResult)::ReachabilityResult
    
    println("🔄 Starting reachability analysis...")
    
    # Run belief propagation using IPAFramework
    node_probabilities = Main.IPAFramework.update_beliefs_iterative(
        network_result.edgelist,
        network_result.iteration_sets,
        network_result.outgoing_index,
        network_result.incoming_index,
        network_result.source_nodes,
        network_result.node_priors,
        network_result.edge_probabilities,
        network_result.descendants,
        network_result.ancestors,
        network_result.diamond_structures,
        network_result.join_nodes,
        network_result.fork_nodes
    )
    
    println("✅ Reachability analysis complete: $(length(node_probabilities)) node probabilities calculated")
    
    # Create analysis metadata
    metadata = Dict{String, Any}(
        "analysisType" => "reachability",
        "nodesAnalyzed" => length(node_probabilities),
        "diamondsProcessed" => length(network_result.diamond_structures),
        "iterationSets" => length(network_result.iteration_sets)
    )
    
    return ReachabilityResult(node_probabilities, metadata)
end

"""
    perform_monte_carlo_analysis(network_result, algorithm_results, iterations = 1_000_000) -> MonteCarloResult

Perform Monte Carlo validation analysis.
"""
function perform_monte_carlo_analysis(
    network_result::NetworkAnalysisResult,
    algorithm_results::Dict{Int64, Float64},
    iterations::Int = 1_000_000
)::MonteCarloResult
    
    println("🔄 Starting Monte Carlo analysis with $iterations iterations...")
    
    # Use the optimized Monte Carlo function from the original server
    monte_carlo_probabilities = monte_carlo_simulation(
        network_result.edgelist,
        network_result.outgoing_index,
        network_result.incoming_index,
        network_result.source_nodes,
        network_result.node_priors,
        network_result.edge_probabilities,
        iterations
    )
    
    # Create comparison results
    comparison_results = Vector{Dict{String, Any}}()
    for (node, algo_prob) in algorithm_results
        mc_prob = get(monte_carlo_probabilities, node, 0.0)
        push!(comparison_results, Dict{String, Any}(
            "node" => node,
            "algorithmValue" => algo_prob,
            "monteCarloValue" => mc_prob,
            "difference" => abs(algo_prob - mc_prob),
            "relativeError" => algo_prob > 0 ? abs(algo_prob - mc_prob) / algo_prob : 0.0
        ))
    end
    
    # Sort by difference (largest discrepancies first)
    sort!(comparison_results, by = x -> x["difference"], rev = true)
    
    println("✅ Monte Carlo analysis complete: $(length(comparison_results)) comparisons made")
    
    return MonteCarloResult(monte_carlo_probabilities, comparison_results, iterations)
end

"""
    perform_path_enumeration(network_result, source_node, target_node) -> PathEnumerationResult

Perform path enumeration analysis between source and target nodes.
"""
function perform_path_enumeration(
    network_result::NetworkAnalysisResult,
    source_node::Union{Int64, Nothing} = nothing,
    target_node::Union{Int64, Nothing} = nothing
)::PathEnumerationResult
    
    println("🔄 Starting path enumeration analysis...")
    
    # Use ComparisonModules for path enumeration
    # If no specific source/target provided, use all source nodes to all other nodes
    if source_node === nothing || target_node === nothing
        # Enumerate paths from all sources to all reachable nodes
        all_paths = Vector{Vector{Int64}}()
        path_probabilities = Vector{Float64}()
        
        for src in network_result.source_nodes
            paths_from_src = enumerate_paths_from_source(
                network_result.outgoing_index, src, 10  # Limit to 10 hops to prevent explosion
            )
            append!(all_paths, paths_from_src)
            
            # Calculate path probabilities
            for path in paths_from_src
                prob = calculate_path_probability(path, network_result.node_priors, network_result.edge_probabilities)
                push!(path_probabilities, prob)
            end
        end
    else
        # Enumerate paths between specific nodes
        all_paths = enumerate_paths_between_nodes(
            network_result.outgoing_index, source_node, target_node, 10
        )
        
        path_probabilities = [
            calculate_path_probability(path, network_result.node_priors, network_result.edge_probabilities)
            for path in all_paths
        ]
    end
    
    println("✅ Path enumeration complete: $(length(all_paths)) paths found")
    
    return PathEnumerationResult(all_paths, path_probabilities, length(all_paths))
end

# Helper functions for Monte Carlo simulation
function monte_carlo_simulation(
    edgelist::Vector{Tuple{Int64,Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    N::Int
)::Dict{Int64, Float64}
    
    all_nodes = reduce(union, values(incoming_index), init=keys(incoming_index))
    active_count = Dict{Int64, Float64}()
    for node in all_nodes
        active_count[node] = 0.0
    end

    for _ in 1:N
        node_active = Dict(
            node => rand() < node_priors[node]
            for node in all_nodes
        )

        active_edges = Set{Tuple{Int64,Int64}}()
        for edge in edgelist
            src, dst = edge
            if node_active[src] && node_active[dst] && rand() < edge_probabilities[edge]
                push!(active_edges, edge)
            end
        end

        sub_outgoing = Dict{Int64, Set{Int64}}()
        for (src, dst) in active_edges
            if !haskey(sub_outgoing, src)
                sub_outgoing[src] = Set{Int64}()
            end
            push!(sub_outgoing[src], dst)
        end

        reachable_nodes = find_all_reachable(sub_outgoing, source_nodes)

        for node in all_nodes
            if node in source_nodes
                if node_active[node]
                    active_count[node] += 1
                end
            else
                if node in reachable_nodes
                    active_count[node] += 1
                end
            end
        end
    end

    for node in keys(active_count)
        active_count[node] /= N
    end

    return active_count
end

function find_all_reachable(graph::Dict{Int64, Set{Int64}}, sources::Set{Int64})::Set{Int64}
    reachable = Set{Int64}()
    queue = Int64[]
    
    for source in sources
        if !in(source, reachable)
            push!(reachable, source)
            push!(queue, source)
        end
    end
    
    while !isempty(queue)
        node = popfirst!(queue)
        
        if haskey(graph, node)
            for neighbor in graph[node]
                if neighbor ∉ reachable
                    push!(reachable, neighbor)
                    push!(queue, neighbor)
                end
            end
        end
    end
    
    return reachable
end

# Helper functions for path enumeration
function enumerate_paths_from_source(
    outgoing_index::Dict{Int64,Set{Int64}}, 
    source::Int64, 
    max_depth::Int
)::Vector{Vector{Int64}}
    
    paths = Vector{Vector{Int64}}()
    
    function dfs(current_path::Vector{Int64}, visited::Set{Int64}, depth::Int)
        if depth >= max_depth
            return
        end
        
        current_node = current_path[end]
        if haskey(outgoing_index, current_node)
            for neighbor in outgoing_index[current_node]
                if neighbor ∉ visited
                    new_path = vcat(current_path, [neighbor])
                    push!(paths, copy(new_path))
                    
                    new_visited = copy(visited)
                    push!(new_visited, neighbor)
                    dfs(new_path, new_visited, depth + 1)
                end
            end
        end
    end
    
    dfs([source], Set([source]), 0)
    return paths
end

function enumerate_paths_between_nodes(
    outgoing_index::Dict{Int64,Set{Int64}}, 
    source::Int64, 
    target::Int64, 
    max_depth::Int
)::Vector{Vector{Int64}}
    
    paths = Vector{Vector{Int64}}()
    
    function dfs(current_path::Vector{Int64}, visited::Set{Int64}, depth::Int)
        if depth >= max_depth
            return
        end
        
        current_node = current_path[end]
        if current_node == target
            push!(paths, copy(current_path))
            return
        end
        
        if haskey(outgoing_index, current_node)
            for neighbor in outgoing_index[current_node]
                if neighbor ∉ visited
                    new_path = vcat(current_path, [neighbor])
                    new_visited = copy(visited)
                    push!(new_visited, neighbor)
                    dfs(new_path, new_visited, depth + 1)
                end
            end
        end
    end
    
    dfs([source], Set([source]), 0)
    return paths
end

function calculate_path_probability(
    path::Vector{Int64}, 
    node_priors::Dict{Int64, Float64}, 
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64}
)::Float64
    
    if length(path) < 2
        return length(path) == 1 ? get(node_priors, path[1], 0.0) : 0.0
    end
    
    # Start with first node probability
    prob = get(node_priors, path[1], 0.0)
    
    # Multiply by edge probabilities and subsequent node probabilities
    for i in 2:length(path)
        edge = (path[i-1], path[i])
        edge_prob = get(edge_probabilities, edge, 0.0)
        node_prob = get(node_priors, path[i], 0.0)
        prob *= edge_prob * node_prob
    end
    
    return prob
end

end # module NetworkService