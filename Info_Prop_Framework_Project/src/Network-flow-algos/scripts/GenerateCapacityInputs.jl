# GenerateCapacityInputs.jl - Convert reachability data to capacity inputs for all DAG networks
# This script processes all networks in dag_ntwrk_files and creates capacity input folders

using JSON, Dates

# Include framework for data reading
include("../src/IPAFramework.jl")
using .IPAFramework

"""
Conversion formulas from reachability probabilities to capacity values
"""
struct CapacityConversionFormulas
    # Node capacity = base_capacity * (1 + reliability_bonus * node_prior)  
    base_node_capacity::Float64
    reliability_bonus::Float64
    
    # Edge capacity = base_capacity * edge_probability * capacity_multiplier
    base_edge_capacity::Float64
    edge_multiplier::Float64
    
    # Source rate = base_rate * node_prior (higher reliability = higher source rate)
    base_source_rate::Float64
    
    function CapacityConversionFormulas(;
        base_node_capacity::Float64 = 10.0,
        reliability_bonus::Float64 = 0.5,
        base_edge_capacity::Float64 = 8.0, 
        edge_multiplier::Float64 = 1.2,
        base_source_rate::Float64 = 12.0
    )
        new(base_node_capacity, reliability_bonus, base_edge_capacity, edge_multiplier, base_source_rate)
    end
end

"""
Convert reachability node priors to node capacities
"""
function convert_node_priors_to_capacities(node_priors::Dict, formulas::CapacityConversionFormulas)
    node_capacities = Dict{String, Float64}()
    
    for (node_str, prior_value) in node_priors
        # Convert different types to Float64
        prior_float = if isa(prior_value, Real)
            Float64(prior_value)
        elseif isa(prior_value, Dict) && haskey(prior_value, "lower") && haskey(prior_value, "upper")
            # For intervals, use midpoint
            (prior_value["lower"] + prior_value["upper"]) / 2.0
        else
            0.5  # Default fallback
        end
        
        # Apply conversion formula
        capacity = formulas.base_node_capacity * (1.0 + formulas.reliability_bonus * prior_float)
        node_capacities[node_str] = capacity
    end
    
    return node_capacities
end

"""
Convert edge probabilities to edge capacities  
"""
function convert_edge_probs_to_capacities(edge_probs::Dict, formulas::CapacityConversionFormulas)
    edge_capacities = Dict{String, Float64}()
    
    for (edge_str, prob_value) in edge_probs
        # Convert different types to Float64
        prob_float = if isa(prob_value, Real)
            Float64(prob_value)
        elseif isa(prob_value, Dict) && haskey(prob_value, "lower") && haskey(prob_value, "upper")
            # For intervals, use midpoint
            (prob_value["lower"] + prob_value["upper"]) / 2.0
        else
            0.5  # Default fallback
        end
        
        # Apply conversion formula
        capacity = formulas.base_edge_capacity * prob_float * formulas.edge_multiplier
        edge_capacities[edge_str] = capacity
    end
    
    return edge_capacities
end

"""
Identify source nodes and generate source rates
"""
function generate_source_rates(edgelist_file::String, node_priors::Dict, formulas::CapacityConversionFormulas)
    # Read network structure
    if !isfile(edgelist_file)
        return Dict{String, Float64}()
    end
    
    try
        _, _, _, source_nodes = read_graph_to_dict(edgelist_file)
        
        source_rates = Dict{String, Float64}()
        
        for source_node in source_nodes
            node_str = string(source_node)
            if haskey(node_priors, node_str)
                prior_val = node_priors[node_str]
                
                # Convert to Float64
                prior_float = if isa(prior_val, Real)
                    Float64(prior_val)
                elseif isa(prior_val, Dict) && haskey(prior_val, "lower") && haskey(prior_val, "upper")
                    (prior_val["lower"] + prior_val["upper"]) / 2.0
                else
                    0.7  # Default for sources
                end
                
                # Higher reliability sources have higher rates
                rate = formulas.base_source_rate * prior_float
                source_rates[node_str] = rate
            end
        end
        
        return source_rates
    catch e
        println("⚠️ Error processing $edgelist_file: $e")
        return Dict{String, Float64}()
    end
end

"""
Create capacity JSON file from reachability data
"""
function create_capacity_json(
    network_name::String,
    node_priors::Dict,
    edge_probs::Dict,
    edgelist_file::String,
    formulas::CapacityConversionFormulas
)
    # Convert data
    node_capacities = convert_node_priors_to_capacities(node_priors, formulas)
    edge_capacities = convert_edge_probs_to_capacities(edge_probs, formulas)
    source_rates = generate_source_rates(edgelist_file, node_priors, formulas)
    
    # Create capacity JSON structure
    capacity_data = Dict(
        "data_type" => "Float64",
        "description" => "Capacity analysis inputs generated from reachability data for $network_name",
        "network_type" => "capacity_flow",
        "conversion_formulas" => Dict(
            "base_node_capacity" => formulas.base_node_capacity,
            "reliability_bonus" => formulas.reliability_bonus,
            "base_edge_capacity" => formulas.base_edge_capacity,
            "edge_multiplier" => formulas.edge_multiplier,
            "base_source_rate" => formulas.base_source_rate
        ),
        "capacities" => Dict(
            "nodes" => node_capacities,
            "edges" => edge_capacities,
            "source_rates" => source_rates
        ),
        "generation_info" => Dict(
            "generated_from" => "reachability_data",
            "timestamp" => string(now()),
            "source_nodes_count" => length(source_rates),
            "total_nodes" => length(node_capacities),
            "total_edges" => length(edge_capacities)
        )
    )
    
    return capacity_data
end

"""
Process a single network directory
"""
function process_network_directory(network_path::String, formulas::CapacityConversionFormulas)
    network_name = basename(network_path)
    println("📁 Processing network: $network_name")
    
    # Find .EDGES file
    edges_file = ""
    for file in readdir(network_path)
        if endswith(file, ".EDGES")
            edges_file = joinpath(network_path, file)
            break
        end
    end
    
    if edges_file == ""
        println("  ⚠️ No .EDGES file found, skipping...")
        return
    end
    
    # Process each data type folder (float, interval, pbox)
    for data_type in ["float", "interval", "pbox"]
        data_type_path = joinpath(network_path, data_type)
        
        if !isdir(data_type_path)
            continue
        end
        
        println("  📊 Processing $data_type data...")
        
        # Find node priors and edge probabilities files
        node_file = ""
        edge_file = ""
        
        for file in readdir(data_type_path)
            if contains(file, "nodepriors") || contains(file, "node-priors")
                node_file = joinpath(data_type_path, file)
            elseif contains(file, "linkprobabilities") || contains(file, "link-probabilities")
                edge_file = joinpath(data_type_path, file)
            end
        end
        
        if node_file == "" || edge_file == ""
            println("    ⚠️ Missing node priors or edge probabilities file in $data_type, skipping...")
            continue
        end
        
        try
            # Read reachability data
            node_data = JSON.parsefile(node_file)
            edge_data = JSON.parsefile(edge_file)
            
            node_priors = haskey(node_data, "nodes") ? node_data["nodes"] : node_data
            edge_probs = haskey(edge_data, "links") ? edge_data["links"] : edge_data
            
            # Generate capacity data
            capacity_json = create_capacity_json(network_name, node_priors, edge_probs, edges_file, formulas)
            
            # Create capacity folder
            capacity_folder = joinpath(network_path, "capacity")
            if !isdir(capacity_folder)
                mkdir(capacity_folder)
            end
            
            # Save capacity file
            capacity_filename = replace(network_name, "_" => "-") * "-capacities.json"
            capacity_filepath = joinpath(capacity_folder, capacity_filename)
            
            open(capacity_filepath, "w") do f
                JSON.print(f, capacity_json, 2)  # Pretty print with 2-space indent
            end
            
            println("    ✅ Generated: $capacity_filename")
            
        catch e
            println("    ❌ Error processing $data_type data: $e")
        end
    end
end

"""
Main function to process all networks
"""
function generate_all_capacity_inputs(dag_networks_base::String; formulas::CapacityConversionFormulas = CapacityConversionFormulas())
    println("🚀 Generating capacity inputs for all DAG networks...")
    println("📂 Base directory: $dag_networks_base")
    println()
    println("🔧 Conversion formulas:")
    println("   • Node capacity = $(formulas.base_node_capacity) × (1 + $(formulas.reliability_bonus) × node_prior)")
    println("   • Edge capacity = $(formulas.base_edge_capacity) × edge_probability × $(formulas.edge_multiplier)")
    println("   • Source rate = $(formulas.base_source_rate) × node_prior")
    println()
    
    networks_processed = 0
    networks_successful = 0
    
    # Get all network directories
    for network_dir in readdir(dag_networks_base)
        network_path = joinpath(dag_networks_base, network_dir)
        
        # Skip if not a directory or if it starts with '.'
        if !isdir(network_path) || startswith(network_dir, ".")
            continue
        end
        
        networks_processed += 1
        
        try
            process_network_directory(network_path, formulas)
            networks_successful += 1
        catch e
            println("❌ Failed to process $network_dir: $e")
        end
        
        println()
    end
    
    println("="^60)
    println("📊 CAPACITY INPUT GENERATION COMPLETE!")
    println("="^60)
    println("Networks processed: $networks_processed")
    println("Networks successful: $networks_successful") 
    println("Success rate: $(round(networks_successful/networks_processed*100, digits=1))%")
    println()
    println("✨ Capacity input files saved in each network's 'capacity/' folder")
    println("📁 Each file contains node capacities, edge capacities, and source rates")
    println("🔗 Ready for capacity analysis using CapacityAnalysisModule!")
end

# Run the generation
dag_networks_base = "C:\\Users\\ohian\\OneDrive - University of Strathclyde\\Documents\\Programmming Files\\Julia Files\\InformationPropagation\\Info_Prop_Framework_Project\\dag_ntwrk_files"

# You can customize the conversion formulas here
custom_formulas = CapacityConversionFormulas(
    base_node_capacity = 15.0,      # Base processing capacity
    reliability_bonus = 0.8,        # Bonus for high reliability nodes
    base_edge_capacity = 12.0,      # Base transmission capacity  
    edge_multiplier = 1.5,          # Multiplier for edge probabilities
    base_source_rate = 20.0         # Base source input rate
)

generate_all_capacity_inputs(dag_networks_base, formulas = custom_formulas)