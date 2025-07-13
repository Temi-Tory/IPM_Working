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
    network_name::String,
    node_priors::Dict{Int64, T},
    link_probabilities::Dict{Tuple{Int64, Int64}, T},
    data_type_name::String,
    output_dir::String = "dag_ntwrk_files"
) where T <: Union{Float64, Interval, pbox}
    
    # Create network-specific folder structure
    network_dir = joinpath(output_dir, network_name)
    data_type_dir = joinpath(network_dir, data_type_name)
    mkpath(data_type_dir)
    
    nodepriors_file = joinpath(data_type_dir, network_name * "-nodepriors.json")
    linkprobs_file = joinpath(data_type_dir, network_name * "-linkprobabilities.json")
    
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

"""
    write_edgelist_to_file(edgelist::Vector{Tuple{Int64,Int64}}, network_name::String)

Takes an edge list and writes it to a .EDGES file with source,destination header.
"""
function write_edgelist_to_file(edgelist::Vector{Tuple{Int64,Int64}}, network_name::String, output_dir::String = "dag_ntwrk_files")
    network_dir = joinpath(output_dir, network_name)
    mkpath(network_dir)
    
    edge_filename = joinpath(network_dir, network_name * ".EDGES")
    
    open(edge_filename, "w") do file
        println(file, "source,destination")
        for (source, dest) in edgelist
            println(file, "$source,$dest")
        end
    end
    
    println("Edge list written to: $edge_filename")
    return edge_filename
end

function process_single_network_all_types(filepath::String, probability_value::Float64 = 0.9)
    println("Processing: $filepath")
    
    if !isfile(filepath)
        println("File not found: $filepath")
        return nothing
    end
    
    try
        # Read the original graph - FIXED: only unpack 4 values as returned by read_graph_to_dict
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath)
        
        # Create node priors and edge probabilities from the graph structure
        node_priors_orig = Dict{Int64, Float64}()
        edge_probabilities_orig = Dict{Tuple{Int64, Int64}, Float64}()
        
        # Initialize all nodes with probability_value
        all_nodes = Set(union(keys(outgoing_index), keys(incoming_index)))
        for node in all_nodes
            node_priors_orig[node] = probability_value
        end
        
        # Initialize all edges with probability_value
        for edge in edgelist
            edge_probabilities_orig[edge] = probability_value
        end
        
        base_filename = basename(filepath)
        network_name = replace(base_filename, ".csv" => "")
        println("  Network: $(length(node_priors_orig)) nodes, $(length(edge_probabilities_orig)) edges")
        
        # 1. FLOAT64 VERSION
        println("  Creating Float64 version...")
        node_priors_float = copy(node_priors_orig)
        edge_probabilities_float = copy(edge_probabilities_orig)
        
        float_nodepriors, float_linkprobs = write_network_probabilities_to_json_compact(
            network_name, node_priors_float, edge_probabilities_float, "float"
        )
        
        # 2. INTERVAL VERSION
        println("  Creating Interval version...")
        node_priors_interval = Dict(k => IPAFramework.Interval(probability_value) for (k, v) in node_priors_orig)
        edge_probabilities_interval = Dict(k => IPAFramework.Interval(probability_value) for (k, v) in edge_probabilities_orig)
        
        interval_nodepriors, interval_linkprobs = write_network_probabilities_to_json_compact(
            network_name, node_priors_interval, edge_probabilities_interval, "interval"
        )
        
        # 3. PBOX VERSION
        println("  Creating pbox version...")
        node_priors_for_pbox = copy(node_priors_orig)
        edge_probabilities_for_pbox = copy(edge_probabilities_orig)
        
        # Convert to pbox - assuming convert_to_pbox_data function exists
        # If not, create simple pbox objects
        node_priors_pbox = Dict(k => pbox(v) for (k, v) in node_priors_for_pbox)
        edge_probabilities_pbox = Dict(k => pbox(v) for (k, v) in edge_probabilities_for_pbox)
        
        pbox_nodepriors, pbox_linkprobs = write_network_probabilities_to_json_compact(
            network_name, node_priors_pbox, edge_probabilities_pbox, "pbox"
        )
        
        # Create edge file
        write_edgelist_to_file(edgelist, network_name)

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
    #=     "csvfiles/layereddiamond_3.csv",
        "csvfiles/KarlNetwork.csv", 
        "csvfiles/real_drone_network_integrated_adjacency.csv",
        "csvfiles/16 NodeNetwork Adjacency matrix.csv",
        "csvfiles/Power Distribution Network.csv",
        "csvfiles/metro_directed_dag_for_ipm.csv", =#
        "csvfiles/munin/munin-dag.csv"
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