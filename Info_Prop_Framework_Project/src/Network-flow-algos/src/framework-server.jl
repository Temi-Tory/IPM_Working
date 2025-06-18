# Pure API Server - No static files, no globals, just clean API endpoints
using HTTP, JSON

# Ensure UTF-8 encoding
if Sys.iswindows()
    try
        run(`chcp 65001`)
    catch
        println("Note: Could not set UTF-8 console encoding on Windows")
    end
end

# Add framework imports
using DataFrames, DelimitedFiles, Distributions, 
    DataStructures, SparseArrays, BenchmarkTools, 
    Combinatorics, Random

# Include IPAFramework
include("IPAFramework.jl")
using .IPAFramework
using .IPAFramework: generate_graph_dot_string
using Graphs

println("✅ IPAFramework loaded for pure API server!")

# CORS headers for API responses only
const CORS_HEADERS = [
    "Access-Control-Allow-Origin" => "*",
    "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers" => "Content-Type"
]

const JSON_HEADERS = [
    "Content-Type" => "application/json; charset=utf-8",
    "Access-Control-Allow-Origin" => "*"
]

# Enhanced parameter application function
function apply_individual_parameter_overrides!(node_priors, edge_probabilities, individual_overrides)
    """
    Apply individual parameter overrides to node priors and edge probabilities.
    """
    if !haskey(individual_overrides, "useIndividualOverrides") || !individual_overrides["useIndividualOverrides"]
        return 0, 0
    end
    
    nodes_modified = 0
    edges_modified = 0
    
    # Apply individual node prior overrides
    if haskey(individual_overrides, "individualNodePriors")
        for (node_key, new_value) in individual_overrides["individualNodePriors"]
            try
                node_id = parse(Int64, string(node_key))
                if haskey(node_priors, node_id)
                    old_value = node_priors[node_id]
                    node_priors[node_id] = Float64(new_value)
                    nodes_modified += 1
                    println("🎛️ Override node $node_id prior: $old_value → $new_value")
                else
                    println("⚠️ Warning: Node $node_id not found in original priors")
                end
            catch e
                println("⚠️ Warning: Failed to parse node ID '$node_key': $e")
            end
        end
    end
    
    # Apply individual edge probability overrides
    if haskey(individual_overrides, "individualEdgeProbabilities")
        for (edge_key, new_value) in individual_overrides["individualEdgeProbabilities"]
            try
                edge_str = string(edge_key)
                if startswith(edge_str, "(") && endswith(edge_str, ")")
                    inner = edge_str[2:end-1]
                    parts = split(inner, ",")
                    if length(parts) == 2
                        from_node = parse(Int64, strip(parts[1]))
                        to_node = parse(Int64, strip(parts[2]))
                        edge_tuple = (from_node, to_node)
                        
                        if haskey(edge_probabilities, edge_tuple)
                            old_value = edge_probabilities[edge_tuple]
                            edge_probabilities[edge_tuple] = Float64(new_value)
                            edges_modified += 1
                            println("🎛️ Override edge $edge_tuple probability: $old_value → $new_value")
                        else
                            println("⚠️ Warning: Edge $edge_tuple not found in original probabilities")
                        end
                    end
                end
            catch e
                println("⚠️ Warning: Failed to parse edge key '$edge_key': $e")
            end
        end
    end
    
    if nodes_modified > 0 || edges_modified > 0
        println("✅ Applied individual parameter overrides: $nodes_modified nodes, $edges_modified edges")
    end
    
    return nodes_modified, edges_modified
end

# Monte Carlo validation function
function MC_result_optimized(
    edgelist::Vector{Tuple{Int64,Int64}},
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    N::Int=100000
)
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

function find_all_reachable(graph::Dict{Int64, Set{Int64}}, sources::Set{Int64})
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

# API ENDPOINTS ONLY - No static file serving

# Tier 1: Structure-only analysis
function handle_parse_structure(req::HTTP.Request)
    try
        data = JSON.parse(String(req.body))
        csv_content = data["csvContent"]
        
        temp_file = tempname() * ".csv"
        write(temp_file, csv_content)
        
        println("🔄 Tier 1: Structure-only analysis...")
        
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(temp_file)
        
        # Basic structural elements only
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Network statistics
        all_nodes = union(keys(outgoing_index), keys(incoming_index))
        sink_nodes = [node for node in all_nodes if !haskey(outgoing_index, node) || isempty(outgoing_index[node])]
        isolated_nodes = [node for node in all_nodes if 
            (!haskey(outgoing_index, node) || isempty(outgoing_index[node])) &&
            (!haskey(incoming_index, node) || isempty(incoming_index[node]))]
            
        high_indegree_nodes = []
        high_outdegree_nodes = []
        for node in all_nodes
            indegree = haskey(incoming_index, node) ? length(incoming_index[node]) : 0
            outdegree = haskey(outgoing_index, node) ? length(outgoing_index[node]) : 0
            
            if indegree >= 3
                push!(high_indegree_nodes, Dict("node" => node, "degree" => indegree))
            end
            if outdegree >= 3
                push!(high_outdegree_nodes, Dict("node" => node, "degree" => outdegree))
            end
        end
        
        sort!(high_indegree_nodes, by = x -> x["degree"], rev = true)
        sort!(high_outdegree_nodes, by = x -> x["degree"], rev = true)
        
        max_possible_edges = length(all_nodes) * (length(all_nodes) - 1)
        graph_density = max_possible_edges > 0 ? length(edgelist) / max_possible_edges : 0.0
        max_iteration_depth = length(iteration_sets)
        
        node_type_counts = Dict(
            "source" => length(source_nodes),
            "sink" => length(sink_nodes),
            "fork" => length(fork_nodes),
            "join" => length(join_nodes),
            "isolated" => length(isolated_nodes),
            "regular" => length(all_nodes) - length(source_nodes) - length(sink_nodes) - 
                        length(fork_nodes) - length(join_nodes) - length(isolated_nodes)
        )
        
        network_data = Dict(
            "nodes" => collect(all_nodes),
            "edges" => [(edge[1], edge[2]) for edge in edgelist],
            "sourceNodes" => collect(source_nodes),
            "sinkNodes" => sink_nodes,
            "forkNodes" => collect(fork_nodes),
            "joinNodes" => collect(join_nodes),
            "iterationSets" => iteration_sets,
            "ancestors" => ancestors,
            "descendants" => descendants,
            "nodeCount" => length(all_nodes),
            "edgeCount" => length(edgelist),
            "maxIterationDepth" => max_iteration_depth,
            "graphDensity" => graph_density,
            "nodeTypeDistribution" => node_type_counts
        )
        
        original_data = Dict(
            "nodePriors" => node_priors,
            "edgeProbabilities" => edge_probabilities
        )
        
        statistics = Dict(
            "basic" => Dict(
                "nodes" => length(all_nodes),
                "edges" => length(edgelist),
                "density" => round(graph_density, digits=4),
                "maxDepth" => max_iteration_depth
            ),
            "nodeTypes" => node_type_counts,
            "structural" => Dict(
                "isolatedNodes" => length(isolated_nodes),
                "highDegreeNodes" => length(high_indegree_nodes) + length(high_outdegree_nodes),
                "iterationSets" => length(iteration_sets)
            ),
            "connectivity" => Dict(
                "stronglyConnectedComponents" => 1,
                "avgPathLength" => max_iteration_depth > 0 ? max_iteration_depth / 2.0 : 0.0,
                "hasIsolatedNodes" => length(isolated_nodes) > 0
            )
        )
        
        response_data = Dict(
            "success" => true,
            "mode" => "structure-only",
            "analysisType" => "Tier 1: Structure Analysis",
            "networkData" => network_data,
            "diamondData" => nothing,
            "originalData" => original_data,
            "statistics" => statistics,
            "summary" => Dict(
                "analysisType" => "Structure Analysis (Tier 1)",
                "nodes" => length(all_nodes),
                "edges" => length(edgelist),
                "density" => round(graph_density, digits=4),
                "maxDepth" => max_iteration_depth,
                "hasDiamonds" => false,
                "hasResults" => false
            )
        )
        
        rm(temp_file)
        println("✅ Tier 1: Structure analysis complete!")
        
        return HTTP.Response(200, JSON_HEADERS, JSON.json(response_data))
        
    catch e
        println("❌ Structure analysis error: $e")
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, JSON_HEADERS, JSON.json(error_response))
    end
end

# Tier 2: Diamond analysis
function handle_diamond_analysis(req::HTTP.Request)
    try
        data = JSON.parse(String(req.body))
        csv_content = data["csvContent"]
        
        temp_file = tempname() * ".csv"
        write(temp_file, csv_content)
        
        println("🔄 Tier 2: Diamond analysis...")
        
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(temp_file)
        
        # Basic structural elements
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Diamond structure identification
        diamond_structures = identify_and_group_diamonds(
            join_nodes, ancestors, incoming_index, source_nodes,
            fork_nodes, iteration_sets, edgelist, descendants, node_priors
        )
        
        # Network statistics (same as Tier 1)
        all_nodes = union(keys(outgoing_index), keys(incoming_index))
        sink_nodes = [node for node in all_nodes if !haskey(outgoing_index, node) || isempty(outgoing_index[node])]
        
        # Network data
        network_data = Dict(
            "nodes" => collect(all_nodes),
            "edges" => [(edge[1], edge[2]) for edge in edgelist],
            "sourceNodes" => collect(source_nodes),
            "sinkNodes" => sink_nodes,
            "forkNodes" => collect(fork_nodes),
            "joinNodes" => collect(join_nodes),
            "iterationSets" => iteration_sets,
            "ancestors" => ancestors,
            "descendants" => descendants,
            "nodeCount" => length(all_nodes),
            "edgeCount" => length(edgelist)
        )
        
        original_data = Dict(
            "nodePriors" => node_priors,
            "edgeProbabilities" => edge_probabilities
        )
        
        # Diamond classification
        diamond_data = nothing
        if !isempty(diamond_structures)
            println("🔍 Running diamond classification...")
            
            diamond_classifications = []
            for (join_node, diamonds_at_node) in diamond_structures
                for (i, diamond) in enumerate(diamonds_at_node.diamond)
                    try
                        classification = classify_diamond_exhaustive(
                            diamond, join_node,
                            edgelist, outgoing_index, incoming_index, source_nodes,
                            fork_nodes, join_nodes, iteration_sets, ancestors, descendants
                        )
                        
                        classification_dict = Dict(
                            "join_node" => join_node,
                            "diamond_index" => i,
                            "fork_structure" => string(classification.fork_structure),
                            "internal_structure" => string(classification.internal_structure),
                            "path_topology" => string(classification.path_topology),
                            "join_structure" => string(classification.join_structure),
                            "external_connectivity" => string(classification.external_connectivity),
                            "degeneracy" => string(classification.degeneracy),
                            "fork_count" => classification.fork_count,
                            "subgraph_size" => classification.subgraph_size,
                            "internal_forks" => classification.internal_forks,
                            "internal_joins" => classification.internal_joins,
                            "path_count" => classification.path_count,
                            "complexity_score" => classification.complexity_score,
                            "optimization_potential" => classification.optimization_potential,
                            "bottleneck_risk" => classification.bottleneck_risk
                        )
                        
                        push!(diamond_classifications, classification_dict)
                        println("💎 Classified diamond at join $join_node: $(classification.internal_structure)")
                        
                    catch e
                        println("⚠️ Warning: Failed to classify diamond at join $join_node: $e")
                    end
                end
            end
            
            # Convert diamond structures to serializable format
            serializable_structures = Dict()
            for (join_node, structure) in diamond_structures
                serializable_structures[string(join_node)] = Dict(
                    "join_node" => join_node,
                    "non_diamond_parents" => collect(structure.non_diamond_parents),
                    "diamond" => [
                        Dict(
                            "relevant_nodes" => collect(diamond.relevant_nodes),
                            "highest_nodes" => collect(diamond.highest_nodes),
                            "edgelist" => diamond.edgelist
                        ) for diamond in structure.diamond
                    ]
                )
            end
            
            diamond_data = Dict(
                "diamondClassifications" => diamond_classifications,
                "diamondStructures" => serializable_structures
            )
            
            println("✅ Diamond classification complete!")
        end
        
        response_data = Dict(
            "success" => true,
            "mode" => "diamond-analysis",
            "analysisType" => "Tier 2: Diamond Analysis",
            "networkData" => network_data,
            "diamondData" => diamond_data,
            "originalData" => original_data,
            "summary" => Dict(
                "analysisType" => "Diamond Analysis (Tier 2)",
                "nodes" => length(all_nodes),
                "edges" => length(edgelist),
                "diamonds" => length(diamond_structures),
                "hasDiamonds" => !isempty(diamond_structures),
                "hasResults" => false
            )
        )
        
        rm(temp_file)
        println("✅ Tier 2: Diamond analysis complete!")
        
        return HTTP.Response(200, JSON_HEADERS, JSON.json(response_data))
        
    catch e
        println("❌ Diamond analysis error: $e")
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, JSON_HEADERS, JSON.json(error_response))
    end
end

# Tier 3: Full enhanced analysis
function handle_enhanced_analysis(req::HTTP.Request)
    try
        data = JSON.parse(String(req.body))
        csv_content = data["csvContent"]
        node_prior = Float64(data["nodePrior"])
        edge_prob = Float64(data["edgeProb"])
        override_node_prior = get(data, "overrideNodePrior", false)
        override_edge_prob = get(data, "overrideEdgeProb", false)
        include_classification = get(data, "includeClassification", true)
        enable_monte_carlo = get(data, "enableMonteCarlo", false)
        use_individual_overrides = get(data, "useIndividualOverrides", false)
        
        temp_file = tempname() * ".csv"
        write(temp_file, csv_content)
        
        println("🔄 Tier 3: Enhanced analysis...")
        println("📊 Classification: $include_classification, Monte Carlo: $enable_monte_carlo")
        println("🎛️ Individual overrides: $use_individual_overrides")
        
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(temp_file)
        
        # Store original values
        original_node_priors = copy(node_priors)
        original_edge_probabilities = copy(edge_probabilities)
        
        # Apply individual parameter overrides FIRST
        nodes_individually_modified = 0
        edges_individually_modified = 0
        if use_individual_overrides
            println("🎛️ Applying individual parameter overrides...")
            nodes_individually_modified, edges_individually_modified = apply_individual_parameter_overrides!(
                node_priors, edge_probabilities, data
            )
        end
        
        # Apply global overrides AFTER individual overrides
        nodes_globally_modified = 0
        edges_globally_modified = 0
        
        if override_node_prior
            println("🔄 Overriding remaining node priors with global value: $node_prior")
            for (node_id, current_value) in node_priors
                if current_value != node_prior
                    nodes_globally_modified += 1
                end
                node_priors[node_id] = node_prior
            end
        end
        
        if override_edge_prob
            println("🔄 Overriding remaining edge probabilities with global value: $edge_prob")
            for (edge_key, current_value) in edge_probabilities
                if current_value != edge_prob
                    edges_globally_modified += 1
                end
                edge_probabilities[edge_key] = edge_prob
            end
        end
        
        total_nodes_modified = nodes_individually_modified + nodes_globally_modified
        total_edges_modified = edges_individually_modified + edges_globally_modified
        
        if total_nodes_modified > 0 || total_edges_modified > 0
            println("📊 Parameter modifications: $total_nodes_modified nodes, $total_edges_modified edges")
        end
        
        # Analysis
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        diamond_structures = identify_and_group_diamonds(
            join_nodes, ancestors, incoming_index, source_nodes,
            fork_nodes, iteration_sets, edgelist, descendants, node_priors
        )
        
        # Run belief propagation
        output = update_beliefs_iterative(
            edgelist, iteration_sets, outgoing_index, incoming_index,
            source_nodes, node_priors, edge_probabilities,
            descendants, ancestors, diamond_structures, join_nodes, fork_nodes
        )
        
        sorted_results = sort(collect(output))
        results = [Dict("node" => r[1], "probability" => r[2]) for r in sorted_results]
        
        # Network data
        all_nodes = union(keys(outgoing_index), keys(incoming_index))
        sink_nodes = [node for node in all_nodes if !haskey(outgoing_index, node) || isempty(outgoing_index[node])]
        
        network_data = Dict(
            "nodes" => collect(all_nodes),
            "edges" => [(edge[1], edge[2]) for edge in edgelist],
            "sourceNodes" => collect(source_nodes),
            "sinkNodes" => sink_nodes,
            "forkNodes" => collect(fork_nodes),
            "joinNodes" => collect(join_nodes),
            "iterationSets" => iteration_sets,
            "nodeCount" => length(all_nodes),
            "edgeCount" => length(edgelist),
            "ancestors" => ancestors,
            "descendants" => descendants
        )
        
        # Diamond classification (if enabled)
        diamond_data = nothing
        if include_classification && !isempty(diamond_structures)
            println("🔍 Running diamond classification...")
            
            diamond_classifications = []
            for (join_node, diamonds_at_node) in diamond_structures
                for (i, diamond) in enumerate(diamonds_at_node.diamond)
                    try
                        classification = classify_diamond_exhaustive(
                            diamond, join_node,
                            edgelist, outgoing_index, incoming_index, source_nodes,
                            fork_nodes, join_nodes, iteration_sets, ancestors, descendants
                        )
                        
                        classification_dict = Dict(
                            "join_node" => join_node,
                            "diamond_index" => i,
                            "fork_structure" => string(classification.fork_structure),
                            "internal_structure" => string(classification.internal_structure),
                            "path_topology" => string(classification.path_topology),
                            "join_structure" => string(classification.join_structure),
                            "external_connectivity" => string(classification.external_connectivity),
                            "degeneracy" => string(classification.degeneracy),
                            "fork_count" => classification.fork_count,
                            "subgraph_size" => classification.subgraph_size,
                            "internal_forks" => classification.internal_forks,
                            "internal_joins" => classification.internal_joins,
                            "path_count" => classification.path_count,
                            "complexity_score" => classification.complexity_score,
                            "optimization_potential" => classification.optimization_potential,
                            "bottleneck_risk" => classification.bottleneck_risk
                        )
                        
                        push!(diamond_classifications, classification_dict)
                        println("💎 Classified diamond at join $join_node: $(classification.internal_structure)")
                        
                    catch e
                        println("⚠️ Warning: Failed to classify diamond at join $join_node: $e")
                    end
                end
            end
            
            # Convert diamond structures to serializable format
            serializable_structures = Dict()
            for (join_node, structure) in diamond_structures
                serializable_structures[string(join_node)] = Dict(
                    "join_node" => join_node,
                    "non_diamond_parents" => collect(structure.non_diamond_parents),
                    "diamond" => [
                        Dict(
                            "relevant_nodes" => collect(diamond.relevant_nodes),
                            "highest_nodes" => collect(diamond.highest_nodes),
                            "edgelist" => diamond.edgelist
                        ) for diamond in structure.diamond
                    ]
                )
            end
            
            diamond_data = Dict(
                "diamondClassifications" => diamond_classifications,
                "diamondStructures" => serializable_structures
            )
            
            println("✅ Diamond classification complete!")
        end
        
        # Monte Carlo validation (if enabled)
        monte_carlo_results = nothing
        if enable_monte_carlo
            println("🎲 Running Monte Carlo validation...")
            mc_iterations = 1_000_000
            
            mc_output = MC_result_optimized(
                edgelist, outgoing_index, incoming_index, source_nodes,
                node_priors, edge_probabilities, mc_iterations
            )
            
            monte_carlo_results = []
            for (node, algo_prob) in output
                mc_prob = get(mc_output, node, 0.0)
                push!(monte_carlo_results, Dict(
                    "node" => node,
                    "algorithmValue" => algo_prob,
                    "monteCarloValue" => mc_prob,
                    "difference" => abs(algo_prob - mc_prob)
                ))
            end
            
            sort!(monte_carlo_results, by = x -> x["difference"], rev = true)
            println("✅ Monte Carlo validation complete!")
        end
        
        rm(temp_file)
        
        # Determine summary values
        actual_node_prior = override_node_prior ? node_prior : "Mixed (individual + CSV)"
        actual_edge_prob = override_edge_prob ? edge_prob : "Mixed (individual + CSV)"
        
        if use_individual_overrides && !override_node_prior && !override_edge_prob
            actual_node_prior = "Individual overrides only"
            actual_edge_prob = "Individual overrides only"
        elseif use_individual_overrides
            actual_node_prior = override_node_prior ? "$node_prior (global)" : "Mixed (individual + CSV)"
            actual_edge_prob = override_edge_prob ? "$edge_prob (global)" : "Mixed (individual + CSV)"
        end
        
        original_data = Dict(
            "nodePriors" => original_node_priors,
            "edgeProbabilities" => original_edge_probabilities
        )
        
        response_data = Dict(
            "success" => true,
            "mode" => "full-analysis",
            "results" => results,
            "networkData" => network_data,
            "diamondData" => diamond_data,
            "monteCarloResults" => monte_carlo_results,
            "originalData" => original_data,
            "parameterModifications" => Dict(
                "nodesIndividuallyModified" => nodes_individually_modified,
                "edgesIndividuallyModified" => edges_individually_modified,
                "nodesGloballyModified" => nodes_globally_modified,
                "edgesGloballyModified" => edges_globally_modified,
                "totalNodesModified" => total_nodes_modified,
                "totalEdgesModified" => total_edges_modified,
                "useIndividualOverrides" => use_individual_overrides
            ),
            "summary" => Dict(
                "nodes" => length(all_nodes),
                "edges" => length(edgelist),
                "diamonds" => length(diamond_structures),
                "nodePrior" => actual_node_prior,
                "edgeProbability" => actual_edge_prob
            )
        )
        
        println("✅ Tier 3: Enhanced analysis complete!")
        
        return HTTP.Response(200, JSON_HEADERS, JSON.json(response_data))
        
    catch e
        println("❌ Enhanced analysis error: $e")
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, JSON_HEADERS, JSON.json(error_response))
    end
end

# Basic analysis (legacy endpoint)
function handle_analysis(req::HTTP.Request)
    try
        data = JSON.parse(String(req.body))
        csv_content = data["csvContent"]
        node_prior = Float64(data["nodePrior"])
        edge_prob = Float64(data["edgeProb"])
        override_node_prior = get(data, "overrideNodePrior", false)
        override_edge_prob = get(data, "overrideEdgeProb", false)
        
        temp_file = tempname() * ".csv"
        write(temp_file, csv_content)
        
        println("🔄 Running basic analysis...")
        
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(temp_file)
        
        original_node_priors = copy(node_priors)
        original_edge_probabilities = copy(edge_probabilities)
        
        if override_node_prior
            map!(x -> node_prior, values(node_priors))
        end
        
        if override_edge_prob
            map!(x -> edge_prob, values(edge_probabilities))
        end
        
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        diamond_structures = identify_and_group_diamonds(
            join_nodes, ancestors, incoming_index, source_nodes,
            fork_nodes, iteration_sets, edgelist, descendants, node_priors
        )
        
        output = update_beliefs_iterative(
            edgelist, iteration_sets, outgoing_index, incoming_index,
            source_nodes, node_priors, edge_probabilities,
            descendants, ancestors, diamond_structures, join_nodes, fork_nodes
        )
        
        rm(temp_file)
        
        sorted_results = sort(collect(output))
        results = [Dict("node" => r[1], "probability" => r[2]) for r in sorted_results]
        
        all_nodes = union(keys(outgoing_index), keys(incoming_index))
        sink_nodes = [node for node in all_nodes if !haskey(outgoing_index, node) || isempty(outgoing_index[node])]
        
        network_data = Dict(
            "nodes" => collect(all_nodes),
            "edges" => [(edge[1], edge[2]) for edge in edgelist],
            "sourceNodes" => collect(source_nodes),
            "sinkNodes" => sink_nodes,
            "forkNodes" => collect(fork_nodes),
            "joinNodes" => collect(join_nodes),
            "iterationSets" => iteration_sets,
            "nodeCount" => length(all_nodes),
            "edgeCount" => length(edgelist),
            "ancestors" => ancestors,
            "descendants" => descendants
        )
        
        actual_node_prior = override_node_prior ? node_prior : "From CSV"
        actual_edge_prob = override_edge_prob ? edge_prob : "From CSV"
        
        original_data = Dict(
            "nodePriors" => original_node_priors,
            "edgeProbabilities" => original_edge_probabilities
        )
        
        response_data = Dict(
            "success" => true,
            "results" => results,
            "networkData" => network_data,
            "originalData" => original_data,
            "summary" => Dict(
                "nodes" => length(all_nodes),
                "edges" => length(edgelist),
                "diamonds" => length(diamond_structures),
                "nodePrior" => actual_node_prior,
                "edgeProbability" => actual_edge_prob
            )
        )
        
        println("✅ Basic analysis complete!")
        return HTTP.Response(200, JSON_HEADERS, JSON.json(response_data))
        
    catch e
        println("❌ Basic analysis error: $e")
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, JSON_HEADERS, JSON.json(error_response))
    end
end

# Diamond subset analysis
function handle_diamond_subset_analysis(req::HTTP.Request)
    try
        data = JSON.parse(String(req.body))
        diamond_data = data["diamondData"]
        override_node_prior = get(data, "overrideNodePrior", false)
        override_edge_prob = get(data, "overrideEdgeProb", false)
        node_prior = get(data, "nodePrior", 1.0)
        edge_prob = get(data, "edgeProb", 0.9)
        use_individual_overrides = get(data, "useIndividualOverrides", false)
        
        println("🔍 Diamond subset analysis for join node: $(diamond_data["joinNode"])")
        if use_individual_overrides
            println("🎛️ Using individual parameter overrides for diamond subset")
        end
        
        # Extract diamond structure data
        structure = diamond_data["structure"]
        join_node = diamond_data["joinNode"]
        
        # Collect all nodes in the diamond
        diamond_nodes = Set{Int64}()
        push!(diamond_nodes, parse(Int64, join_node))
        
        for group in structure["diamond"]
            if haskey(group, "relevant_nodes") && group["relevant_nodes"] !== nothing
                for node in group["relevant_nodes"]
                    push!(diamond_nodes, Int64(node))
                end
            end
            if haskey(group, "highest_nodes") && group["highest_nodes"] !== nothing
                for node in group["highest_nodes"]
                    push!(diamond_nodes, Int64(node))
                end
            end
        end
        
        if haskey(structure, "non_diamond_parents") && structure["non_diamond_parents"] !== nothing
            for node in structure["non_diamond_parents"]
                push!(diamond_nodes, Int64(node))
            end
        end
        
        # Collect edges
        diamond_edges = Vector{Tuple{Int64,Int64}}()
        for group in structure["diamond"]
            if haskey(group, "edgelist") && group["edgelist"] !== nothing
                for edge in group["edgelist"]
                    if length(edge) == 2
                        push!(diamond_edges, (Int64(edge[1]), Int64(edge[2])))
                    end
                end
            end
        end
        
        # Create subset network structures
        subset_outgoing = Dict{Int64,Set{Int64}}()
        subset_incoming = Dict{Int64,Set{Int64}}()
        
        for (src, dst) in diamond_edges
            if !haskey(subset_outgoing, src)
                subset_outgoing[src] = Set{Int64}()
            end
            push!(subset_outgoing[src], dst)
            
            if !haskey(subset_incoming, dst)
                subset_incoming[dst] = Set{Int64}()
            end
            push!(subset_incoming[dst], src)
        end
        
        # Identify subset source nodes
        subset_sources = Set{Int64}()
        for node in diamond_nodes
            if !haskey(subset_incoming, node) || isempty(subset_incoming[node])
                push!(subset_sources, node)
            end
        end
        
        # Create parameters for subset
        subset_node_priors = Dict{Int64,Float64}()
        for node in diamond_nodes
            subset_node_priors[node] = 1.0
        end
        
        subset_edge_probs = Dict{Tuple{Int64,Int64},Float64}()
        for edge in diamond_edges
            subset_edge_probs[edge] = 0.9
        end
        
        # Apply individual parameter overrides FIRST
        if use_individual_overrides
            println("🎛️ Applying diamond individual parameter overrides...")
            apply_individual_parameter_overrides!(subset_node_priors, subset_edge_probs, data)
        end
        
        # Apply global overrides AFTER individual overrides
        if override_node_prior
            println("🔄 Overriding diamond node priors with: $node_prior")
            for node in keys(subset_node_priors)
                subset_node_priors[node] = Float64(node_prior)
            end
        end
        
        if override_edge_prob
            println("🔄 Overriding diamond edge probabilities with: $edge_prob")
            for edge in keys(subset_edge_probs)
                subset_edge_probs[edge] = Float64(edge_prob)
            end
        end
        
        # Analysis on subset
        subset_iteration_sets, subset_ancestors, subset_descendants = find_iteration_sets(
            diamond_edges, subset_outgoing, subset_incoming
        )
        
        subset_fork_nodes, subset_join_nodes = identify_fork_and_join_nodes(
            subset_outgoing, subset_incoming
        )
        
        subset_diamond_structures = identify_and_group_diamonds(
            subset_join_nodes, subset_ancestors, subset_incoming, subset_sources,
            subset_fork_nodes, subset_iteration_sets, diamond_edges, subset_descendants,
            subset_node_priors
        )
        
        # Run belief propagation on subset
        subset_output = update_beliefs_iterative(
            diamond_edges, subset_iteration_sets, subset_outgoing, subset_incoming,
            subset_sources, subset_node_priors, subset_edge_probs,
            subset_descendants, subset_ancestors, subset_diamond_structures,
            subset_join_nodes, subset_fork_nodes
        )
        
        sorted_results = sort(collect(subset_output))
        results = [Dict("node" => r[1], "probability" => r[2]) for r in sorted_results]
        
        response_data = Dict(
            "success" => true,
            "results" => results,
            "summary" => Dict(
                "nodes" => length(diamond_nodes),
                "edges" => length(diamond_edges),
                "sources" => length(subset_sources),
                "joinNode" => join_node,
                "usedIndividualOverrides" => use_individual_overrides
            )
        )
        
        println("✅ Diamond subset analysis complete for join node $(join_node)!")
        return HTTP.Response(200, JSON_HEADERS, JSON.json(response_data))
        
    catch e
        println("❌ Diamond subset analysis error: $e")
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, JSON_HEADERS, JSON.json(error_response))
    end
end

# DOT export
function handle_dot_export(req::HTTP.Request)
    try
        data = JSON.parse(String(req.body))
        network_data = data["networkData"]
        
        nodes = network_data["nodes"]
        edges = network_data["edges"]
        
        g = SimpleDiGraph(length(nodes))
        node_to_index = Dict(node => i for (i, node) in enumerate(nodes))
        
        for edge in edges
            from_idx = node_to_index[edge[1]]
            to_idx = node_to_index[edge[2]]
            add_edge!(g, from_idx, to_idx)
        end
        
        dot_string = generate_graph_dot_string(g)
        
        for (node, idx) in node_to_index
            dot_string = replace(dot_string, "\"$idx\"" => "\"$node\"")
        end
        
        response_data = Dict(
            "success" => true,
            "dotString" => dot_string
        )
        
        println("✅ DOT export complete!")
        return HTTP.Response(200, JSON_HEADERS, JSON.json(response_data))
        
    catch e
        println("❌ DOT export error: $e")
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, JSON_HEADERS, JSON.json(error_response))
    end
end

# Pure API route handler - NO static file serving
function api_route_handler(req::HTTP.Request)
    println("🔍 API Request: $(req.method) $(req.target)")
    
    if req.method == "OPTIONS"
        return HTTP.Response(200, CORS_HEADERS)
    end
    
    if req.method == "POST"
        if req.target == "/api/analyze"
            return handle_analysis(req)
        elseif req.target == "/api/analyze-enhanced"
            return handle_enhanced_analysis(req)
        elseif req.target == "/api/parse-structure"
            return handle_parse_structure(req)
        elseif req.target == "/api/analyze-diamond"
            return handle_diamond_analysis(req)
        elseif req.target == "/api/analyze-diamond-subset"
            return handle_diamond_subset_analysis(req)
        elseif req.target == "/api/export-dot"
            return handle_dot_export(req)
        end
    end
    
    # Simple health check for root
    if req.method == "GET" && req.target == "/"
        return HTTP.Response(200, JSON_HEADERS, JSON.json(Dict(
            "status" => "Pure API Server Running",
            "version" => "1.0",
            "endpoints" => [
                "/api/parse-structure",
                "/api/analyze-diamond", 
                "/api/analyze-enhanced",
                "/api/analyze",
                "/api/analyze-diamond-subset",
                "/api/export-dot"
            ]
        )))
    end
    
    return HTTP.Response(404, CORS_HEADERS, JSON.json(Dict(
        "error" => "API endpoint not found: $(req.target)"
    )))
end

println("🚀 PURE API SERVER running on: http://localhost:8080")
println("📊 Features: Three-Tier Analysis System, Diamond Classification, Monte Carlo Validation")
println("🎛️ Individual Parameter Control - modify specific node priors and edge probabilities")
println("🔧 UTF-8 encoding enabled")
println("✨ NO static file serving - Pure API only!")
println("📁 Angular handles all frontend - this is backend API only")
println("")
println("🏗️ Available API Endpoints:")
println("   • POST /api/parse-structure     - Tier 1: Structure-only analysis")
println("   • POST /api/analyze-diamond     - Tier 2: Diamond analysis") 
println("   • POST /api/analyze-enhanced    - Tier 3: Full analysis with parameters")
println("   • POST /api/analyze             - Legacy: Basic analysis")
println("   • POST /api/analyze-diamond-subset - Diamond subset analysis")
println("   • POST /api/export-dot          - Export DOT format")
println("   • GET  /                        - Health check")

# Start pure API server
HTTP.serve(api_route_handler, "127.0.0.1", 8080) #(only localhost):
#HTTP.serve(route_handler, "0.0.0.0", 8080) #(all interfaces)