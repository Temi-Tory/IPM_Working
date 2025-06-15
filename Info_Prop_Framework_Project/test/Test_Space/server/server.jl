# Enhanced server with diamond classification and Monte Carlo validation
using HTTP, JSON

# Ensure UTF-8 encoding for proper emoji/icon display
if Sys.iswindows()
    # Try to set UTF-8 console output on Windows
    try
        run(`chcp 65001`)
    catch
        println("Note: Could not set UTF-8 console encoding on Windows")
    end
end

# Add the same imports as TestSpace IPA.jl
using DataFrames, DelimitedFiles, Distributions, 
    DataStructures, SparseArrays, BenchmarkTools, 
    Combinatorics, Random

# Include IPAFramework - FIXED PATH
# From test/Test_Space/server/ to Info_Prop_Framework_Project/src/
include("../../../src/IPAFramework.jl")

# Import framework exactly like TestSpace IPA.jl does
using .IPAFramework
using .IPAFramework: generate_graph_dot_string
using Graphs

println("✅ Enhanced IPAFramework loaded!")

# Get the server directory and change to it
const SERVER_DIR = dirname(@__FILE__)
cd(SERVER_DIR)
println("Changed to script directory: ", pwd())

# Debug: Print file structure
println("🔍 Debug - Checking file structure:")
println("Server directory: ", SERVER_DIR)
println("Current working directory: ", pwd())

# Check if critical files exist
critical_paths = [
    joinpath(SERVER_DIR, "index.html"),
    joinpath(SERVER_DIR, "public"),
    joinpath(SERVER_DIR, "public", "css"),
    joinpath(SERVER_DIR, "public", "css", "style.css"),
    joinpath(SERVER_DIR, "public", "js"),
    joinpath(SERVER_DIR, "public", "js", "main.js"),
    joinpath(SERVER_DIR, "public", "js", "managers"),
    joinpath(SERVER_DIR, "public", "js", "utils")
]

for path in critical_paths
    if isfile(path) || isdir(path)
        println("✅ Found: ", path)
    else
        println("❌ Missing: ", path)
    end
end

# CORS headers constants
const CORS_HEADERS = [
    "Access-Control-Allow-Origin" => "*",
    "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers" => "Content-Type"
]

const HTML_HEADERS = [
    "Content-Type" => "text/html; charset=utf-8",
    "Access-Control-Allow-Origin" => "*"
]

const CSS_HEADERS = [
    "Content-Type" => "text/css; charset=utf-8",
    "Access-Control-Allow-Origin" => "*"
]

const JS_HEADERS = [
    "Content-Type" => "application/javascript; charset=utf-8", 
    "Access-Control-Allow-Origin" => "*"
]

const JSON_HEADERS = [
    "Content-Type" => "application/json; charset=utf-8",
    "Access-Control-Allow-Origin" => "*"
]

# Monte Carlo validation function (optimized version from MC_Optimized.jl)
function MC_result_optimized(
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

        # Only sample edges where both endpoints are active
        active_edges = Set{Tuple{Int64,Int64}}()
        for edge in edgelist
            src, dst = edge
            if node_active[src] && node_active[dst] && rand() < edge_probabilities[edge]
                push!(active_edges, edge)
            end
        end

        # Create subgraph with only active edges
        sub_outgoing = Dict{Int64, Set{Int64}}()
        for (src, dst) in active_edges
            if !haskey(sub_outgoing, src)
                sub_outgoing[src] = Set{Int64}()
            end
            push!(sub_outgoing[src], dst)
        end

        # Find all reachable nodes in a single traversal
        reachable_nodes = find_all_reachable(sub_outgoing, source_nodes)

        # Count active nodes
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

    # Convert counts to probabilities
    for node in keys(active_count)
        active_count[node] /= N
    end

    return active_count
end

# Optimized function to find all reachable nodes from multiple sources
function find_all_reachable(graph::Dict{Int64, Set{Int64}}, sources::Set{Int64})
    reachable = Set{Int64}()
    queue = Int64[]
    
    # Start BFS from all active source nodes
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

# Enhanced analysis handler with diamond classification and Monte Carlo
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
        
        temp_file = tempname() * ".csv"
        write(temp_file, csv_content)
        
        println("🔄 Running enhanced analysis...")
        println("📊 Classification: $include_classification, Monte Carlo: $enable_monte_carlo")
        
        # Read graph data from CSV file
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(temp_file)
        
        # Store original values
        original_node_priors = copy(node_priors)
        original_edge_probabilities = copy(edge_probabilities)
        
        # Apply overrides
        if override_node_prior
            println("🔄 Overriding all node priors with: $node_prior")
            map!(x -> node_prior, values(node_priors))
        end
        
        if override_edge_prob
            println("🔄 Overriding all edge probabilities with: $edge_prob")
            map!(x -> edge_prob, values(edge_probabilities))
        end
        
        # Basic network analysis
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Diamond structure identification
        diamond_structures = identify_and_group_diamonds(
            join_nodes, ancestors, incoming_index, source_nodes,
            fork_nodes, iteration_sets, edgelist, descendants, node_priors
        )
        
        # Main algorithm analysis
        output = update_beliefs_iterative(
            edgelist, iteration_sets, outgoing_index, incoming_index,
            source_nodes, node_priors, edge_probabilities,
            descendants, ancestors, diamond_structures, join_nodes, fork_nodes
        )
        
        # Prepare results
        sorted_results = sort(collect(output))
        results = [Dict("node" => r[1], "probability" => r[2]) for r in sorted_results]
        
        # Enhanced network data
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
            
            # Run exhaustive classification for each diamond
            diamond_classifications = []
            for (join_node, diamonds_at_node) in diamond_structures
                for (i, diamond) in enumerate(diamonds_at_node.diamond)
                    try
                        classification = classify_diamond_exhaustive(
                            diamond, join_node,
                            edgelist, outgoing_index, incoming_index, source_nodes,
                            fork_nodes, join_nodes, iteration_sets, ancestors, descendants
                        )
                        
                        # Convert to dictionary for JSON serialization
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
            mc_iterations = 1_000_000  # 1M iterations for good accuracy
            
            mc_output = MC_result_optimized(
                edgelist, outgoing_index, incoming_index, source_nodes,
                node_priors, edge_probabilities, mc_iterations
            )
            
            # Compare results
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
            
            # Sort by largest difference
            sort!(monte_carlo_results, by = x -> x["difference"], rev = true)
            
            println("✅ Monte Carlo validation complete!")
        end
        
        rm(temp_file)
        
        # Determine summary values
        actual_node_prior = override_node_prior ? node_prior : "From CSV"
        actual_edge_prob = override_edge_prob ? edge_prob : "From CSV"
        
        # Original data for frontend comparison
        original_data = Dict(
            "nodePriors" => original_node_priors,
            "edgeProbabilities" => original_edge_probabilities
        )
        
        response_data = Dict(
            "success" => true,
            "results" => results,
            "networkData" => network_data,
            "diamondData" => diamond_data,
            "monteCarloResults" => monte_carlo_results,
            "originalData" => original_data,
            "summary" => Dict(
                "nodes" => length(all_nodes),
                "edges" => length(edgelist),
                "diamonds" => length(diamond_structures),
                "nodePrior" => actual_node_prior,
                "edgeProbability" => actual_edge_prob
            )
        )
        
        println("✅ Enhanced analysis complete!")
        
        return HTTP.Response(200, JSON_HEADERS, JSON.json(response_data))
        
    catch e
        println("❌ Error: $e")
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, JSON_HEADERS, JSON.json(error_response))
    end
end

# Original analysis handler (for backward compatibility)
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
        println("❌ Error: $e")
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, JSON_HEADERS, JSON.json(error_response))
    end
end

# Diamond subset analysis handler
function handle_diamond_subset_analysis(req::HTTP.Request)
    try
        data = JSON.parse(String(req.body))
        diamond_data = data["diamondData"]
        override_node_prior = get(data, "overrideNodePrior", false)
        override_edge_prob = get(data, "overrideEdgeProb", false)
        node_prior = get(data, "nodePrior", 1.0)
        edge_prob = get(data, "edgeProb", 0.9)
        
        println("🔍 Running diamond subset analysis for join node: $(diamond_data["joinNode"])")
        
        # Extract diamond structure data
        structure = diamond_data["structure"]
        join_node = diamond_data["joinNode"]
        
        # Collect all nodes in the diamond
        diamond_nodes = Set{Int64}()
        push!(diamond_nodes, parse(Int64, join_node))
        
        # Add nodes from diamond groups
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
        
        # Add non-diamond parents
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
        
        # Identify subset source nodes (nodes with no incoming edges in subset)
        subset_sources = Set{Int64}()
        for node in diamond_nodes
            if !haskey(subset_incoming, node) || isempty(subset_incoming[node])
                push!(subset_sources, node)
            end
        end
        
        # Create node priors for subset
        subset_node_priors = Dict{Int64,Float64}()
        for node in diamond_nodes
            if override_node_prior
                subset_node_priors[node] = Float64(node_prior)
            else
                # Use original prior if available, otherwise default to 1.0
                subset_node_priors[node] = 1.0  # Simplified for subset analysis
            end
        end
        
        # Create edge probabilities for subset
        subset_edge_probs = Dict{Tuple{Int64,Int64},Float64}()
        for edge in diamond_edges
            if override_edge_prob
                subset_edge_probs[edge] = Float64(edge_prob)
            else
                # Use original probability if available, otherwise default to 0.9
                subset_edge_probs[edge] = 0.9  # Simplified for subset analysis
            end
        end
        
        # Find iteration sets for subset
        subset_iteration_sets, subset_ancestors, subset_descendants = find_iteration_sets(
            diamond_edges, subset_outgoing, subset_incoming
        )
        
        # Identify fork and join nodes in subset
        subset_fork_nodes, subset_join_nodes = identify_fork_and_join_nodes(
            subset_outgoing, subset_incoming
        )
        
        # Identify diamonds in subset (should be simpler or none)
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
        
        # Format results
        sorted_results = sort(collect(subset_output))
        results = [Dict("node" => r[1], "probability" => r[2]) for r in sorted_results]
        
        response_data = Dict(
            "success" => true,
            "results" => results,
            "summary" => Dict(
                "nodes" => length(diamond_nodes),
                "edges" => length(diamond_edges),
                "sources" => length(subset_sources),
                "joinNode" => join_node
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

function handle_dot_export(req::HTTP.Request)
    try
        data = JSON.parse(String(req.body))
        network_data = data["networkData"]
        
        # Create a SimpleDiGraph from the network data
        nodes = network_data["nodes"]
        edges = network_data["edges"]
        
        # Create graph
        g = SimpleDiGraph(length(nodes))
        
        # Create node mapping
        node_to_index = Dict(node => i for (i, node) in enumerate(nodes))
        
        # Add edges
        for edge in edges
            from_idx = node_to_index[edge[1]]
            to_idx = node_to_index[edge[2]]
            add_edge!(g, from_idx, to_idx)
        end
        
        # Generate DOT string
        dot_string = generate_graph_dot_string(g)
        
        # Replace numeric indices with actual node names in DOT string
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

# CORRECTED Main route handler with absolute paths
function route_handler(req::HTTP.Request)
    println("🔍 DEBUG: Request method: $(req.method), target: $(req.target)")
    
    if req.method == "OPTIONS"
        return HTTP.Response(200, CORS_HEADERS)
    end
    
    if req.method == "GET"
        if req.target == "/" || req.target == "/index.html"
            # Serve index.html from server directory
            index_path = joinpath(SERVER_DIR, "index.html")
            if isfile(index_path)
                println("📂 Serving index.html from: $index_path")
                return HTTP.Response(200, HTML_HEADERS, read(index_path, String))
            else
                println("❌ index.html not found at: $index_path")
                return HTTP.Response(404, HTML_HEADERS, "index.html not found at: $index_path")
            end
            
        elseif startswith(req.target, "/css/")
            # Serve CSS files from public/css/
            css_file = req.target[6:end]  # Remove "/css/" - 6 characters: /, c, s, s, /, (space)
            css_path = joinpath(SERVER_DIR, "public", "css", css_file)
            println("🔍 DEBUG CSS: target='$(req.target)', length=$(length(req.target)), css_file='$css_file', css_path='$css_path'")
            if isfile(css_path)
                println("📂 Serving CSS file: $css_path")
                return HTTP.Response(200, CSS_HEADERS, read(css_path, String))
            else
                println("❌ CSS file not found: $css_path")
                return HTTP.Response(404, HTML_HEADERS, "CSS file not found: $css_path")
            end
            
        elseif startswith(req.target, "/js/")
            # Handle main.js specifically
            if req.target == "/js/main.js"
                main_path = joinpath(SERVER_DIR, "public", "js", "main.js")
                if isfile(main_path)
                    println("📂 Serving main.js from: $main_path")
                    return HTTP.Response(200, JS_HEADERS, read(main_path, String))
                else
                    println("❌ main.js not found at: $main_path")
                    return HTTP.Response(404, HTML_HEADERS, "main.js not found at: $main_path")
                end
                
            # Handle manager files
            elseif startswith(req.target, "/js/managers/")
                manager_file = req.target[14:end]  # Remove "/js/managers/" - 14 characters
                manager_path = joinpath(SERVER_DIR, "public", "js", "managers", manager_file)
                println("🔍 DEBUG JS Manager: target='$(req.target)', length=$(length(req.target)), manager_file='$manager_file', manager_path='$manager_path'")
                if isfile(manager_path)
                    println("📂 Serving manager file: $manager_path")
                    return HTTP.Response(200, JS_HEADERS, read(manager_path, String))
                else
                    println("❌ Manager file not found: $manager_path")
                    return HTTP.Response(404, HTML_HEADERS, "Manager file not found: $manager_path")
                end
                
            # Handle utils files
            elseif startswith(req.target, "/js/utils/")
                util_file = req.target[11:end]  # Remove "/js/utils/"
                util_path = joinpath(SERVER_DIR, "public", "js", "utils", util_file)
                if isfile(util_path)
                    println("📂 Serving util file: $util_path")
                    return HTTP.Response(200, JS_HEADERS, read(util_path, String))
                else
                    println("❌ Util file not found: $util_path")
                    return HTTP.Response(404, HTML_HEADERS, "Util file not found: $util_path")
                end
                
            # Handle any other JS files
            else
                js_file = req.target[4:end]  # Remove "/js/"
                js_path = joinpath(SERVER_DIR, "public", "js", js_file)
                if isfile(js_path)
                    println("📂 Serving JS file: $js_path")
                    return HTTP.Response(200, JS_HEADERS, read(js_path, String))
                else
                    println("❌ JS file not found: $js_path")
                    return HTTP.Response(404, HTML_HEADERS, "JS file not found: $js_path")
                end
            end
        end
    end
    
    if req.method == "POST"
        if req.target == "/api/analyze"
            return handle_analysis(req)
        elseif req.target == "/api/analyze-enhanced"
            return handle_enhanced_analysis(req)
        elseif req.target == "/api/analyze-diamond-subset"
            return handle_diamond_subset_analysis(req)
        elseif req.target == "/api/export-dot"
            return handle_dot_export(req)
        end
    end
    
    return HTTP.Response(404, CORS_HEADERS, "Not Found: $(req.target)")
end

println("🚀 Enhanced server running on: http://localhost:8080")
println("📊 Features: Diamond Classification, Monte Carlo Validation, Enhanced Visualization")
println("🔧 UTF-8 encoding enabled for proper icon display")
println("✨ CSS icons used for cross-platform compatibility")
println("💎 Diamond subset analysis now available")
println("📁 Serving static files from public/ directory using SERVER_DIR: $SERVER_DIR")

# Start server
HTTP.serve(route_handler, "127.0.0.1", 8080) #(only localhost):
#HTTP.serve(route_handler, "0.0.0.0", 8080) #(all interfaces)