using JSON
import ProbabilityBoundsAnalysis
const PBA = ProbabilityBoundsAnalysis
const PBAInterval = ProbabilityBoundsAnalysis.Interval
const pbox = ProbabilityBoundsAnalysis.pbox

using .IPAFramework

# Compact serialization for pbox only
function serialize_value_compact(val::Float64)
    return val
end

function serialize_value_compact(val::Interval)
    return Dict(
        "type" => "interval",
        "lower" => val.lower,
        "upper" => val.upper
    )
end

function serialize_value_compact(val::pbox)
    # Simple scalar pbox like pbox(0.9)
    if length(val.u) > 0 && all(val.u .≈ val.u[1]) && all(val.d .≈ val.d[1]) && val.u[1] ≈ val.d[1]
        return Dict(
            "type" => "pbox",
            "construction_type" => "scalar",
            "value" => val.u[1],
            "shape" => val.shape,
            "name" => val.name
        )
    else
        # Store essential parameters only
        return Dict(
            "type" => "pbox",
            "construction_type" => "complex",
            "ml" => val.ml,
            "mh" => val.mh,
            "vl" => val.vl,
            "vh" => val.vh,
            "shape" => val.shape,
            "name" => val.name
        )
    end
end

function write_network_probabilities_to_json_compact(
    csv_filename::String,
    node_priors::Dict{Int64, T},
    link_probabilities::Dict{Tuple{Int64, Int64}, T}
) where T <: Union{Float64, Interval, pbox}
    
    if !endswith(csv_filename, ".csv")
        throw(ArgumentError("Filename must end with .csv extension"))
    end
    
    base_name = csv_filename[1:end-4]
    nodepriors_file = base_name * "-nodepriors.json"
    linkprobs_file = base_name * "-linkprobabilities.json"
    
    # Serialize node priors
    serialized_nodes = Dict{String, Any}()
    for (node_id, prior) in node_priors
        serialized_nodes[string(node_id)] = serialize_value_compact(prior)
    end
    
    nodepriors_data = Dict(
        "data_type" => string(T),
        "serialization" => "compact",
        "description" => "Node prior probabilities for network analysis",
        "nodes" => serialized_nodes
    )
    
    # Serialize link probabilities
    serialized_links = Dict{String, Any}()
    for ((source, target), prob) in link_probabilities
        link_key = "($source,$target)"
        serialized_links[link_key] = serialize_value_compact(prob)
    end
    
    linkprobs_data = Dict(
        "data_type" => string(T),
        "serialization" => "compact",
        "description" => "Link/edge probabilities for network analysis",
        "links" => serialized_links
    )
    
    # Write files
    open(nodepriors_file, "w") do file
        JSON.print(file, nodepriors_data, 2)
    end
    
    open(linkprobs_file, "w") do file
        JSON.print(file, linkprobs_data, 2)
    end
    
    println("Created files:")
    println("- Node priors: $nodepriors_file")
    println("- Link probabilities: $linkprobs_file")
    
    return nodepriors_file, linkprobs_file
end

function process_single_network_all_types(filepath::String, probability_value::Float64 = 0.9)
    println("Processing: $filepath")
    
    if !isfile(filepath)
        println("File not found: $filepath")
        return nothing
    end
    
    try
        # Read the original graph
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors_orig, edge_probabilities_orig = read_graph_to_dict(filepath)
        
        base_filename = basename(filepath)
        println("  Network: $(length(node_priors_orig)) nodes, $(length(edge_probabilities_orig)) edges")
        
        # 1. FLOAT64 VERSION
        println("  Creating Float64 version...")
        node_priors_float = copy(node_priors_orig)
        edge_probabilities_float = copy(edge_probabilities_orig)
        map!(x -> probability_value, values(node_priors_float))
        map!(x -> probability_value, values(edge_probabilities_float))
        
        float_filename = replace(base_filename, ".csv" => "_float.csv")
        float_nodepriors, float_linkprobs = write_network_probabilities_to_json_compact(
            float_filename, node_priors_float, edge_probabilities_float
        )
        
        # 2. INTERVAL VERSION
        println("  Creating Interval version...")
        node_priors_interval = Dict(k => IPAFramework.Interval(probability_value) for (k, v) in node_priors_orig)
        edge_probabilities_interval = Dict(k => IPAFramework.Interval(probability_value) for (k, v) in edge_probabilities_orig)
        
        interval_filename = replace(base_filename, ".csv" => "_interval.csv")
        interval_nodepriors, interval_linkprobs = write_network_probabilities_to_json_compact(
            interval_filename, node_priors_interval, edge_probabilities_interval
        )
        
        # 3. PBOX VERSION
        println("  Creating pbox version...")
        node_priors_for_pbox = copy(node_priors_orig)
        edge_probabilities_for_pbox = copy(edge_probabilities_orig)
        map!(x -> probability_value, values(node_priors_for_pbox))
        map!(x -> probability_value, values(edge_probabilities_for_pbox))
        
        node_priors_pbox, edge_probabilities_pbox = convert_to_pbox_data(node_priors_for_pbox, edge_probabilities_for_pbox)
        
        pbox_filename = replace(base_filename, ".csv" => "_pbox.csv")
        pbox_nodepriors, pbox_linkprobs = write_network_probabilities_to_json_compact(
            pbox_filename, node_priors_pbox, edge_probabilities_pbox
        )
        
        println("  Successfully created all versions for $(base_filename)")
        println()
        
        return (
            float_nodepriors = float_nodepriors,
            float_linkprobs = float_linkprobs,
            interval_nodepriors = interval_nodepriors,
            interval_linkprobs = interval_linkprobs,
            pbox_nodepriors = pbox_nodepriors,
            pbox_linkprobs = pbox_linkprobs
        )
        
    catch e
        println("  Error processing $filepath: $e")
        println()
        return nothing
    end
end

"""
    quick_process_all_types(probability_value::Float64 = 0.9)

Process all files with all types (Float64, Interval, pbox).
Uses compact serialization for pbox to keep files small.
"""
function quick_process_all_types(probability_value::Float64 = 0.9)
    println("=== PROCESSING ALL NETWORKS (ALL TYPES) ===")
    println("Probability value: $probability_value")
    println()
    
    csv_files = [
        "csvfiles/layereddiamond_3.csv",
        "csvfiles/KarlNetwork.csv", 
        "csvfiles/real_drone_network_integrated_adjacency.csv",
        "csvfiles/16 NodeNetwork Adjacency matrix.csv",
        "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv",
        "csvfiles/metro_directed_dag_for_ipm.csv",
        "csvfiles/ergo_proxy_dag_network.csv"
    ]
    
    results = Dict{String, Any}()
    successful_files = []
    failed_files = []
    
    for filepath in csv_files
        result = process_single_network_all_types(filepath, probability_value)
        results[filepath] = result
        
        if result !== nothing
            push!(successful_files, filepath)
        else
            push!(failed_files, filepath)
        end
    end
    
    println("=== SUMMARY ===")
    println("Total files: $(length(csv_files))")
    println("Successfully processed: $(length(successful_files))")
    println("Failed: $(length(failed_files))")
    println("Total JSON files created: $(length(successful_files) * 6)")
    
    if !isempty(successful_files)
        println("\nSuccessfully processed:")
        for file in successful_files
            println("  - $(basename(file))")
        end
    end
    
    if !isempty(failed_files)
        println("\nFailed to process:")
        for file in failed_files
            println("  - $(basename(file))")
        end
    end
    
    println()
    return results
end
# Uncomment to run:
# quick_process_all_types()