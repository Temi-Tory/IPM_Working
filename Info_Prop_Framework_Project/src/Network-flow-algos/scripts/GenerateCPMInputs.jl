# GenerateCPMInputs.jl - Convert reachability data to Critical Path Module inputs for all DAG networks
# This script processes all networks in dag_ntwrk_files and creates CPM input folders

using JSON, Dates

# Include framework for data reading
include("../src/IPAFramework.jl")
using .IPAFramework

"""
Conversion formulas from reachability probabilities to critical path values
"""
struct CPMConversionFormulas
    # Node durations = base_duration / (1 + reliability_bonus * node_prior)
    # Higher reliability = faster processing (lower duration)
    base_node_duration::Float64
    reliability_bonus::Float64
    
    # Edge delays = base_delay * (1 + delay_penalty * (1 - edge_probability))
    # Lower edge probability = higher delays
    base_edge_delay::Float64
    delay_penalty::Float64
    
    # Node costs = base_cost * (1 + cost_factor * (1 - node_prior))
    # Lower reliability = higher costs (in pounds £)
    base_node_cost::Float64
    cost_factor::Float64
    
    # Edge costs = base_cost * (1 + cost_penalty * (1 - edge_probability))
    base_edge_cost::Float64
    edge_cost_penalty::Float64
    
    function CPMConversionFormulas(;
        base_node_duration::Float64 = 2.0,
        reliability_bonus::Float64 = 1.5,
        base_edge_delay::Float64 = 0.5,
        delay_penalty::Float64 = 2.0,
        base_node_cost::Float64 = 80.0,  # £80 base processing cost
        cost_factor::Float64 = 0.8,
        base_edge_cost::Float64 = 40.0,  # £40 base edge cost
        edge_cost_penalty::Float64 = 1.2
    )
        new(base_node_duration, reliability_bonus, base_edge_delay, delay_penalty,
            base_node_cost, cost_factor, base_edge_cost, edge_cost_penalty)
    end
end

"""
Convert reachability node priors to task durations (time analysis)
"""
function convert_node_priors_to_durations(node_priors::Dict, formulas::CPMConversionFormulas)
    node_durations = Dict{String, Float64}()
    
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
        
        # Apply conversion formula: higher reliability = lower duration
        duration = formulas.base_node_duration / (1.0 + formulas.reliability_bonus * prior_float)
        node_durations[node_str] = duration
    end
    
    return node_durations
end

"""
Convert edge probabilities to edge delays (time analysis)
"""
function convert_edge_probs_to_delays(edge_probs::Dict, formulas::CPMConversionFormulas)
    edge_delays = Dict{String, Float64}()
    
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
        
        # Apply conversion formula: lower probability = higher delays
        delay = formulas.base_edge_delay * (1.0 + formulas.delay_penalty * (1.0 - prob_float))
        edge_delays[edge_str] = delay
    end
    
    return edge_delays
end

"""
Convert reachability node priors to processing costs (cost analysis)
"""
function convert_node_priors_to_costs(node_priors::Dict, formulas::CPMConversionFormulas)
    node_costs = Dict{String, Float64}()
    
    for (node_str, prior_value) in node_priors
        # Convert different types to Float64
        prior_float = if isa(prior_value, Real)
            Float64(prior_value)
        elseif isa(prior_value, Dict) && haskey(prior_value, "lower") && haskey(prior_value, "upper")
            (prior_value["lower"] + prior_value["upper"]) / 2.0
        else
            0.5  # Default fallback
        end
        
        # Apply conversion formula: lower reliability = higher costs
        cost = formulas.base_node_cost * (1.0 + formulas.cost_factor * (1.0 - prior_float))
        node_costs[node_str] = cost
    end
    
    return node_costs
end

"""
Convert edge probabilities to edge costs (cost analysis)
"""
function convert_edge_probs_to_edge_costs(edge_probs::Dict, formulas::CPMConversionFormulas)
    edge_costs = Dict{String, Float64}()
    
    for (edge_str, prob_value) in edge_probs
        # Convert different types to Float64
        prob_float = if isa(prob_value, Real)
            Float64(prob_value)
        elseif isa(prob_value, Dict) && haskey(prob_value, "lower") && haskey(prob_value, "upper")
            (prob_value["lower"] + prob_value["upper"]) / 2.0
        else
            0.5  # Default fallback
        end
        
        # Apply conversion formula: lower probability = higher costs
        cost = formulas.base_edge_cost * (1.0 + formulas.edge_cost_penalty * (1.0 - prob_float))
        edge_costs[edge_str] = cost
    end
    
    return edge_costs
end

"""
Create CPM JSON file from reachability data
"""
function create_cpm_json(
    network_name::String,
    node_priors::Dict,
    edge_probs::Dict,
    formulas::CPMConversionFormulas
)
    # Convert data for time analysis
    node_durations = convert_node_priors_to_durations(node_priors, formulas)
    edge_delays = convert_edge_probs_to_delays(edge_probs, formulas)
    
    # Convert data for cost analysis
    node_costs = convert_node_priors_to_costs(node_priors, formulas)
    edge_costs = convert_edge_probs_to_edge_costs(edge_probs, formulas)
    
    # Create CPM JSON structure
    cpm_data = Dict(
        "data_type" => "Float64",
        "description" => "Critical Path Module inputs generated from reachability data for $network_name",
        "network_type" => "critical_path",
        "conversion_formulas" => Dict(
            "base_node_duration" => formulas.base_node_duration,
            "reliability_bonus" => formulas.reliability_bonus,
            "base_edge_delay" => formulas.base_edge_delay,
            "delay_penalty" => formulas.delay_penalty,
            "base_node_cost" => formulas.base_node_cost,
            "cost_factor" => formulas.cost_factor,
            "base_edge_cost" => formulas.base_edge_cost,
            "edge_cost_penalty" => formulas.edge_cost_penalty
        ),
        "time_analysis" => Dict(
            "node_durations" => node_durations,
            "edge_delays" => edge_delays,
            "initial_time" => 0.0,
            "analysis_type" => "longest_path_time",
            "combination_function" => "max_combination",
            "propagation_function" => "additive_propagation"
        ),
        "cost_analysis" => Dict(
            "node_costs" => node_costs,
            "edge_costs" => edge_costs,
            "initial_cost" => 0.0,
            "analysis_type" => "total_project_cost",
            "combination_function" => "max_combination", 
            "propagation_function" => "additive_propagation"
        ),
        "generation_info" => Dict(
            "generated_from" => "reachability_data",
            "timestamp" => string(now()),
            "total_nodes" => length(node_durations),
            "total_edges" => length(edge_delays)
        )
    )
    
    return cpm_data
end

"""
Process a single network directory
"""
function process_network_directory(network_path::String, formulas::CPMConversionFormulas)
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
            
            # Generate CPM data
            cpm_json = create_cpm_json(network_name, node_priors, edge_probs, formulas)
            
            # Create CPM folder
            cpm_folder = joinpath(network_path, "cpm")
            if !isdir(cpm_folder)
                mkdir(cpm_folder)
            end
            
            # Save CPM file
            cpm_filename = replace(network_name, "_" => "-") * "-cpm-inputs.json"
            cpm_filepath = joinpath(cpm_folder, cpm_filename)
            
            open(cpm_filepath, "w") do f
                JSON.print(f, cpm_json, 2)  # Pretty print with 2-space indent
            end
            
            println("    ✅ Generated: $cpm_filename")
            
        catch e
            println("    ❌ Error processing $data_type data: $e")
        end
    end
end

"""
Main function to process all networks
"""
function generate_all_cpm_inputs(dag_networks_base::String; formulas::CPMConversionFormulas = CPMConversionFormulas())
    println("🚀 Generating CPM inputs for all DAG networks...")
    println("📂 Base directory: $dag_networks_base")
    println()
    println("🔧 Conversion formulas:")
    println("   • Node duration = $(formulas.base_node_duration) ÷ (1 + $(formulas.reliability_bonus) × node_prior)")
    println("   • Edge delay = $(formulas.base_edge_delay) × (1 + $(formulas.delay_penalty) × (1 - edge_probability))")
    println("   • Node cost = $(formulas.base_node_cost) × (1 + $(formulas.cost_factor) × (1 - node_prior))")
    println("   • Edge cost = $(formulas.base_edge_cost) × (1 + $(formulas.edge_cost_penalty) × (1 - edge_probability))")
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
    println("📊 CPM INPUT GENERATION COMPLETE!")
    println("="^60)
    println("Networks processed: $networks_processed")
    println("Networks successful: $networks_successful") 
    println("Success rate: $(round(networks_successful/networks_processed*100, digits=1))%")
    println()
    println("✨ CPM input files saved in each network's 'cpm/' folder")
    println("📁 Each file contains time analysis (durations/delays) and cost analysis data")
    println("🔗 Ready for critical path analysis using GeneralizedCriticalPathModule!")
end

# Run the generation
dag_networks_base = "C:\\Users\\ohian\\OneDrive - University of Strathclyde\\Documents\\Programmming Files\\Julia Files\\InformationPropagation\\Info_Prop_Framework_Project\\dag_ntwrk_files"

# Customize the conversion formulas here
custom_formulas = CPMConversionFormulas(
    base_node_duration = 3.0,       # Base processing time (hours)
    reliability_bonus = 2.0,        # Higher reliability = faster processing
    base_edge_delay = 1.0,          # Base edge transmission delay (hours)  
    delay_penalty = 3.0,            # Penalty for unreliable edges
    base_node_cost = 120.0,         # Base processing cost (£)
    cost_factor = 1.0,              # Cost increase for unreliable nodes
    base_edge_cost = 60.0,          # Base edge cost (£)
    edge_cost_penalty = 1.5         # Cost penalty for unreliable edges
)

generate_all_cpm_inputs(dag_networks_base, formulas = custom_formulas)