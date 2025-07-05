"""
EdgeToJsonConverter.jl

Helper functions to convert .edge files + JSON probabilities to the server-expected JSON format.
This solves the format mismatch between your app (.edge files) and server (JSON edge arrays).
"""

using JSON

"""
    convert_edge_file_to_json_payload(edge_file_path, node_priors_path, edge_probs_path) -> Dict

Converts .edge file + JSON probability files to the server-expected JSON payload format.
This is the solution to your HTTP transmission problem!
"""
function convert_edge_file_to_json_payload(
    edge_file_path::String,
    node_priors_path::String, 
    edge_probs_path::String
)::Dict{String, Any}
    
    println("🔄 Converting .edge file to server JSON format...")
    
    # Read .edge file and convert to JSON edge array
    edges_json = []
    open(edge_file_path, "r") do file
        lines = readlines(file)
        header_line = popfirst!(lines)  # Remove header "source,destination"
        
        for line in lines
            if !isempty(strip(line))
                parts = split(strip(line), ',')
                if length(parts) >= 2
                    source = parse(Int, strip(parts[1]))
                    destination = parse(Int, strip(parts[2]))
                    push!(edges_json, Dict("source" => source, "destination" => destination))
                end
            end
        end
    end
    
    # Read JSON probability files
    node_priors = JSON.parsefile(node_priors_path)
    edge_probs = JSON.parsefile(edge_probs_path)
    
    # Create server-expected format
    payload = Dict(
        "edges" => edges_json,
        "nodePriors" => node_priors,
        "edgeProbabilities" => edge_probs
    )
    
    println("✅ Conversion complete:")
    println("  - Edges: $(length(edges_json))")
    println("  - Node priors: $(length(get(node_priors, "nodes", Dict())))")
    println("  - Edge probabilities: $(length(get(edge_probs, "links", Dict())))")
    
    return payload
end

export convert_edge_file_to_json_payload