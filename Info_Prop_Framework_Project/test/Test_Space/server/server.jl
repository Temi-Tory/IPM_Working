using HTTP, JSON

# Add the same imports as TestSpace IPA.jl
using DataFrames, DelimitedFiles, Distributions, 
      DataStructures, SparseArrays, BenchmarkTools, 
      Combinatorics

# Include IPAFramework (path from server folder to src folder)
include("../../../src/IPAFramework.jl")

# Import framework exactly like TestSpace IPA.jl does
using .IPAFramework

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
    end
    
    return HTTP.Response(404, CORS_HEADERS, "Not Found")
end

function handle_analysis(req::HTTP.Request)
    try
        data = JSON.parse(String(req.body))
        csv_content = data["csvContent"]
        node_prior = Float64(data["nodePrior"])
        edge_prob = Float64(data["edgeProb"])
        
        temp_file = tempname() * ".csv"
        write(temp_file, csv_content)
        
        println("🔄 Running analysis...")
        
        # Exact same code as TestSpace IPA.jl
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(temp_file)
        
        map!(x -> node_prior, values(node_priors))
        map!(x -> edge_prob, values(edge_probabilities))
        
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
        
        response_data = Dict(
            "success" => true,
            "results" => results,
            "summary" => Dict(
                "nodes" => length(union(keys(outgoing_index), keys(incoming_index))),
                "edges" => length(edgelist),
                "diamonds" => length(diamond_structures),
                "nodePrior" => node_prior,
                "edgeProbability" => edge_prob
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
HTTP.serve(route_handler, "127.0.0.1", 8080)