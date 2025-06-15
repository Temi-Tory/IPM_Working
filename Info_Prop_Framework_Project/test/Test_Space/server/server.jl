# This script sets up a simple HTTP server to serve the IPAFramework and handle analysis requests.
using HTTP, JSON

# Add the same imports as TestSpace IPA.jl
using DataFrames, DelimitedFiles, Distributions, 
    DataStructures, SparseArrays, BenchmarkTools, 
    Combinatorics

# Include IPAFramework (path from server folder to src folder)
include("../../../src/IPAFramework.jl")

# Import framework exactly like TestSpace IPA.jl does
using .IPAFramework
using .IPAFramework: generate_graph_dot_string
using Graphs

println("✅ IPAFramework loaded!")

# Change to the script's directory
script_dir = dirname(@__FILE__)
cd(script_dir)
println("Changed to script directory: ", pwd())

println("\nFiles in current directory:")
for file in readdir(".")
    println("  📄 ", file)
end

# Try to find the HTML files
html_files = ["index.html", "style.css", "script.js"]
for file in html_files
    if isfile(file)
        println("✅ Found: $file")
    else
        println("❌ Missing: $file")
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

# CORS headers constants (following HTTP.jl examples pattern)
const CORS_HEADERS = [
    "Access-Control-Allow-Origin" => "*",
    "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers" => "Content-Type"
]

const CSS_HEADERS = [
    "Content-Type" => "text/css",
    "Access-Control-Allow-Origin" => "*"
]

const JS_HEADERS = [
    "Content-Type" => "application/javascript", 
    "Access-Control-Allow-Origin" => "*"
]

const JSON_HEADERS = [
    "Content-Type" => "application/json",
    "Access-Control-Allow-Origin" => "*"
]

# Routes
function route_handler(req::HTTP.Request)
    if req.method == "OPTIONS"
        return HTTP.Response(200, CORS_HEADERS)
    end
    
    if req.method == "GET"
        if req.target == "/" || req.target == "/index.html"
            # Try multiple possible paths
            possible_paths = [
                "index.html",
                "./index.html", 
                joinpath(dirname(@__FILE__), "index.html")
            ]
            
            for path in possible_paths
                if isfile(path)
                    println("📂 Serving index.html from: $path")
                    return HTTP.Response(200, CORS_HEADERS, read(path, String))
                end
            end
            
            println("❌ Could not find index.html in any of these paths:")
            for path in possible_paths
                println("   - $path")
            end
            return HTTP.Response(404, CORS_HEADERS, "index.html not found")
            
        elseif req.target == "/style.css"
            css_path = joinpath(dirname(@__FILE__), "style.css")
            if isfile(css_path)
                return HTTP.Response(200, CSS_HEADERS, read(css_path, String))
            else
                return HTTP.Response(404, CORS_HEADERS, "style.css not found")
            end
            
        elseif req.target == "/script.js"
            js_path = joinpath(dirname(@__FILE__), "script.js")
            if isfile(js_path)
                return HTTP.Response(200, JS_HEADERS, read(js_path, String))
            else
                return HTTP.Response(404, CORS_HEADERS, "script.js not found")
            end
        end
    end
    
    if req.method == "POST" && req.target == "/api/analyze"
        return handle_analysis(req)
    elseif req.method == "POST" && req.target == "/api/export-dot"
        return handle_dot_export(req)
    end
    
    return HTTP.Response(404, CORS_HEADERS, "Not Found")
end

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
        
        println("🔄 Running analysis...")
        println("📊 Override settings - Node Prior: $override_node_prior, Edge Prob: $override_edge_prob")
        
        # Read graph data from CSV file (always get original values from file)
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(temp_file)
        
        # Store original values for the frontend
        original_node_priors = copy(node_priors)
        original_edge_probabilities = copy(edge_probabilities)
        
        # Conditionally override based on checkbox settings
        if override_node_prior
            println("🔄 Overriding all node priors with: $node_prior")
            map!(x -> node_prior, values(node_priors))
        else
            println("📄 Using node priors from CSV file")
        end
        
        if override_edge_prob
            println("🔄 Overriding all edge probabilities with: $edge_prob")
            map!(x -> edge_prob, values(edge_probabilities))
        else
            println("📄 Using edge probabilities from CSV file")
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
        
        # Determine what values were actually used for summary
        actual_node_prior = override_node_prior ? node_prior : "From CSV"
        actual_edge_prob = override_edge_prob ? edge_prob : "From CSV"
        
        # Identify sink nodes (nodes with no outgoing edges)
        all_nodes = union(keys(outgoing_index), keys(incoming_index))
        sink_nodes = [node for node in all_nodes if !haskey(outgoing_index, node) || isempty(outgoing_index[node])]
        
        # Prepare network structure data for visualization
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
        
        # Prepare original data for frontend comparison
        original_data = Dict(
            "nodePriors" => original_node_priors,
            "edgeProbabilities" => original_edge_probabilities
        )
        
        response_data = Dict(
            "success" => true,
            "results" => results,
            "networkData" => network_data,
            "originalData" => original_data,  # Add original data for comparison
            "summary" => Dict(
                "nodes" => length(union(keys(outgoing_index), keys(incoming_index))),
                "edges" => length(edgelist),
                "diamonds" => length(diamond_structures),
                "nodePrior" => actual_node_prior,
                "edgeProbability" => actual_edge_prob
            )
        )
        
        println("✅ Analysis complete!")
        
        return HTTP.Response(200, JSON_HEADERS, JSON.json(response_data))
        
    catch e
        println("❌ Error: $e")
        error_response = Dict("success" => false, "error" => string(e))
        return HTTP.Response(500, JSON_HEADERS, JSON.json(error_response))
    end
end

println("🚀 Server running on: http://localhost:8080")
# Start server
HTTP.serve(route_handler, "127.0.0.1", 8080)#(only localhost):
#HTTP.serve(route_handler, "0.0.0.0", 8080)(all interfaces)