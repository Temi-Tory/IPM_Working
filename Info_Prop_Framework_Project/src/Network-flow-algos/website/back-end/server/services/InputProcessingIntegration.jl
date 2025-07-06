"""
InputProcessingIntegration.jl

Integration service that bridges the V2 server with InputProcessingModule.
Handles CSV adjacency matrix processing and supports all probability types.
"""
module InputProcessingIntegration

using JSON, DataFrames, DelimitedFiles

# Import InputProcessingModule
include(joinpath(@__DIR__, "..", "..", "..", "..", "src", "Algorithms", "InputProcessingModule.jl"))
using .InputProcessingModule

export process_csv_adjacency_matrix, process_network_with_probabilities,
       NetworkProcessingResult, ProbabilityType, convert_to_probability_type,
       read_adjacency_matrix_from_csv_string, validate_probability_data,
       perform_complete_network_analysis, perform_file_based_analysis

# Supported probability types
@enum ProbabilityType begin
    FLOAT64_TYPE
    INTERVAL_TYPE
    PBOX_TYPE
end

# Result structure for network processing
struct NetworkProcessingResult
    success::Bool
    edgelist::Union{Vector{Tuple{Int64,Int64}}, Nothing}
    outgoing_index::Union{Dict{Int64,Set{Int64}}, Nothing}
    incoming_index::Union{Dict{Int64,Set{Int64}}, Nothing}
    source_nodes::Union{Set{Int64}, Nothing}
    node_priors::Union{Dict, Nothing}
    edge_probabilities::Union{Dict, Nothing}
    fork_nodes::Union{Set{Int64}, Nothing}
    join_nodes::Union{Set{Int64}, Nothing}
    iteration_sets::Union{Vector{Set{Int64}}, Nothing}
    ancestors::Union{Dict{Int64, Set{Int64}}, Nothing}
    descendants::Union{Dict{Int64, Set{Int64}}, Nothing}
    error_message::Union{String, Nothing}
    probability_type::Union{ProbabilityType, Nothing}
end

"""
    process_csv_adjacency_matrix(csv_content::String) -> NetworkProcessingResult

Process CSV adjacency matrix content and return network structure using InputProcessingModule.
"""
function process_csv_adjacency_matrix(csv_content::String)::NetworkProcessingResult
    try
        println("🔄 Processing CSV adjacency matrix with InputProcessingModule...")
        
        # Create temporary file for InputProcessingModule
        temp_file = tempname() * ".csv"
        
        try
            # Write CSV content to temporary file
            write(temp_file, csv_content)
            
            # Use InputProcessingModule to read the graph
            edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(temp_file)
            
            println("✅ Successfully processed adjacency matrix:")
            println("   - Edges: $(length(edgelist))")
            println("   - Nodes: $(length(union(Set([e[1] for e in edgelist]), Set([e[2] for e in edgelist]))))")
            println("   - Source nodes: $(length(source_nodes))")
            
            # Generate default probabilities (Float64 type)
            node_priors = generate_default_node_priors(edgelist, outgoing_index, incoming_index)
            edge_probabilities = generate_default_edge_probabilities(edgelist)
            
            # Identify fork and join nodes
            fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
            
            # Find iteration sets - function returns (iteration_sets, ancestors, descendants)
            iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
            
            return NetworkProcessingResult(
                true,
                edgelist,
                outgoing_index,
                incoming_index,
                source_nodes,
                node_priors,
                edge_probabilities,
                fork_nodes,
                join_nodes,
                iteration_sets,
                ancestors,
                descendants,
                nothing,
                FLOAT64_TYPE
            )
            
        finally
            # Clean up temporary file
            if isfile(temp_file)
                rm(temp_file)
            end
        end
        
    catch e
        println("❌ Error processing CSV adjacency matrix: $e")
        return NetworkProcessingResult(
            false, nothing, nothing, nothing, nothing, nothing, nothing,
            nothing, nothing, nothing, nothing, nothing, string(e), nothing
        )
    end
end

"""
    process_network_with_probabilities(csv_content::String, node_priors_json::Union{String, Nothing}, 
                                     edge_probabilities_json::Union{String, Nothing}, 
                                     probability_type::ProbabilityType) -> NetworkProcessingResult

Process network with custom probability data and specified probability type.
"""
function process_network_with_probabilities(
    csv_content::String,
    node_priors_json::Union{String, Nothing},
    edge_probabilities_json::Union{String, Nothing},
    probability_type::ProbabilityType
)::NetworkProcessingResult
    try
        println("🔄 Processing network with custom probabilities ($(probability_type))...")
        
        # First process the basic network structure
        base_result = process_csv_adjacency_matrix(csv_content)
        if !base_result.success
            return base_result
        end
        
        # Process custom probabilities if provided
        node_priors = base_result.node_priors
        edge_probabilities = base_result.edge_probabilities
        
        if node_priors_json !== nothing
            node_priors = process_node_priors_json(node_priors_json, probability_type)
        end
        
        if edge_probabilities_json !== nothing
            edge_probabilities = process_edge_probabilities_json(edge_probabilities_json, probability_type)
        end
        
        return NetworkProcessingResult(
            true,
            base_result.edgelist,
            base_result.outgoing_index,
            base_result.incoming_index,
            base_result.source_nodes,
            node_priors,
            edge_probabilities,
            base_result.fork_nodes,
            base_result.join_nodes,
            base_result.iteration_sets,
            base_result.ancestors,
            base_result.descendants,
            nothing,
            probability_type
        )
        
    catch e
        println("❌ Error processing network with probabilities: $e")
        return NetworkProcessingResult(
            false, nothing, nothing, nothing, nothing, nothing, nothing,
            nothing, nothing, nothing, nothing, nothing, string(e), nothing
        )
    end
end

"""
    process_node_priors_json(json_content::String, prob_type::ProbabilityType) -> Dict

Process node priors JSON content and convert to specified probability type.
"""
function process_node_priors_json(json_content::String, prob_type::ProbabilityType)::Dict
    try
        # Create temporary file for InputProcessingModule
        temp_file = tempname() * ".json"
        
        try
            write(temp_file, json_content)
            
            if prob_type == FLOAT64_TYPE
                return read_node_priors_from_json_float64(temp_file)
            elseif prob_type == INTERVAL_TYPE
                return read_node_priors_from_json_interval(temp_file)
            elseif prob_type == PBOX_TYPE
                return read_node_priors_from_json_pbox(temp_file)
            else
                throw(ArgumentError("Unsupported probability type: $prob_type"))
            end
            
        finally
            if isfile(temp_file)
                rm(temp_file)
            end
        end
        
    catch e
        println("❌ Error processing node priors JSON: $e")
        throw(e)
    end
end

"""
    process_edge_probabilities_json(json_content::String, prob_type::ProbabilityType) -> Dict

Process edge probabilities JSON content and convert to specified probability type.
"""
function process_edge_probabilities_json(json_content::String, prob_type::ProbabilityType)::Dict
    try
        # Create temporary file for InputProcessingModule
        temp_file = tempname() * ".json"
        
        try
            write(temp_file, json_content)
            
            if prob_type == FLOAT64_TYPE
                return read_edge_probabilities_from_json_float64(temp_file)
            elseif prob_type == INTERVAL_TYPE
                return read_edge_probabilities_from_json_interval(temp_file)
            elseif prob_type == PBOX_TYPE
                return read_edge_probabilities_from_json_pbox(temp_file)
            else
                throw(ArgumentError("Unsupported probability type: $prob_type"))
            end
            
        finally
            if isfile(temp_file)
                rm(temp_file)
            end
        end
        
    catch e
        println("❌ Error processing edge probabilities JSON: $e")
        throw(e)
    end
end

"""
    generate_default_node_priors(edgelist, outgoing_index, incoming_index) -> Dict{Int64, Float64}

Generate default node prior probabilities.
"""
function generate_default_node_priors(edgelist, outgoing_index, incoming_index)::Dict{Int64, Float64}
    all_nodes = union(Set([e[1] for e in edgelist]), Set([e[2] for e in edgelist]))
    return Dict{Int64, Float64}(node => 0.5 for node in all_nodes)
end

"""
    generate_default_edge_probabilities(edgelist) -> Dict{Tuple{Int64,Int64}, Float64}

Generate default edge probabilities.
"""
function generate_default_edge_probabilities(edgelist)::Dict{Tuple{Int64,Int64}, Float64}
    return Dict{Tuple{Int64,Int64}, Float64}(edge => 0.8 for edge in edgelist)
end

# Note: ancestors and descendants are now calculated by find_iteration_sets function
# from InputProcessingModule, so we don't need a separate implementation

"""
    convert_to_probability_type(value, target_type::ProbabilityType)

Convert a probability value to the specified type.
"""
function convert_to_probability_type(value, target_type::ProbabilityType)
    if target_type == FLOAT64_TYPE
        return Float64(value)
    elseif target_type == INTERVAL_TYPE
        if isa(value, Dict) && haskey(value, "lower") && haskey(value, "upper")
            return Interval(Float64(value["lower"]), Float64(value["upper"]))
        else
            # Convert single value to interval
            val = Float64(value)
            return Interval(val, val)
        end
    elseif target_type == PBOX_TYPE
        if isa(value, Dict)
            # Handle pbox construction from dictionary
            if haskey(value, "left") && haskey(value, "right")
                return pbox(value["left"], value["right"])
            elseif haskey(value, "lower") && haskey(value, "upper")
                return pbox([Float64(value["lower"])], [Float64(value["upper"])])
            end
        else
            # Convert single value to pbox
            val = Float64(value)
            return pbox([val], [val])
        end
    end
    
    throw(ArgumentError("Cannot convert value to probability type: $target_type"))
end

"""
    validate_probability_data(data::Dict, prob_type::ProbabilityType) -> Bool

Validate probability data for the specified type.
"""
function validate_probability_data(data::Dict, prob_type::ProbabilityType)::Bool
    try
        for (key, value) in data
            convert_to_probability_type(value, prob_type)
        end
        return true
    catch e
        println("❌ Probability data validation failed: $e")
        return false
    end
end

"""
    read_adjacency_matrix_from_csv_string(csv_content::String) -> Matrix{Int}

Read adjacency matrix directly from CSV string content.
"""
function read_adjacency_matrix_from_csv_string(csv_content::String)::Matrix{Int}
    try
        # Parse CSV content
        lines = split(strip(csv_content), '\n')
        n = length(lines)
        
        # Initialize matrix
        matrix = zeros(Int, n, n)
        
        for (i, line) in enumerate(lines)
            values = split(strip(line), ',')
            for (j, val) in enumerate(values)
                matrix[i, j] = parse(Int, strip(val))
            end
        end
        
        return matrix
        
    catch e
        println("❌ Error reading adjacency matrix from CSV: $e")
        throw(e)
    end
end

"""
    perform_complete_network_analysis(edge_file::String, node_priors_file::String,
                                     link_probs_file::String, prob_type::String) -> NetworkProcessingResult

Process complete three-file network using InputProcessingModule's read_complete_network function.
"""
function perform_complete_network_analysis(
    edge_file::String,
    node_priors_file::String,
    link_probs_file::String,
    prob_type::String
)::NetworkProcessingResult
    try
        println("🔄 Processing complete network with InputProcessingModule...")
        println("   - Edge file: $edge_file")
        println("   - Node priors: $node_priors_file")
        println("   - Link probabilities: $link_probs_file")
        println("   - Probability type: $prob_type")
        
        # Use InputProcessingModule's read_complete_network function
        edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_complete_network(
            edge_file, node_priors_file, link_probs_file
        )
        
        println("✅ Successfully processed complete network:")
        println("   - Edges: $(length(edgelist))")
        println("   - Nodes: $(length(union(Set([e[1] for e in edgelist]), Set([e[2] for e in edgelist]))))")
        println("   - Source nodes: $(length(source_nodes))")
        
        # Identify fork and join nodes
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        
        # Find iteration sets - function returns (iteration_sets, ancestors, descendants)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Convert probability type enum
        probability_type = if prob_type == "float"
            FLOAT64_TYPE
        elseif prob_type == "interval"
            INTERVAL_TYPE
        elseif prob_type == "pbox"
            PBOX_TYPE
        else
            FLOAT64_TYPE  # Default fallback
        end
        
        return NetworkProcessingResult(
            true,
            edgelist,
            outgoing_index,
            incoming_index,
            source_nodes,
            node_priors,
            edge_probabilities,
            fork_nodes,
            join_nodes,
            iteration_sets,
            ancestors,
            descendants,
            nothing,
            probability_type
        )
        
    catch e
        println("❌ Error processing complete network: $e")
        return NetworkProcessingResult(
            false, nothing, nothing, nothing, nothing, nothing, nothing,
            nothing, nothing, nothing, nothing, nothing, string(e), nothing
        )
    end
end

"""
    perform_file_based_analysis(csv_content::String, node_priors_json::Union{String, Nothing},
                               edge_probs_json::Union{String, Nothing}, prob_type::String) -> NetworkProcessingResult

Process network from CSV content with optional probability files.
"""
function perform_file_based_analysis(
    csv_content::String,
    node_priors_json::Union{String, Nothing},
    edge_probs_json::Union{String, Nothing},
    prob_type::String
)::NetworkProcessingResult
    try
        # Convert probability type string to enum
        probability_type = if prob_type == "float64" || prob_type == "float"
            FLOAT64_TYPE
        elseif prob_type == "interval"
            INTERVAL_TYPE
        elseif prob_type == "pbox"
            PBOX_TYPE
        else
            FLOAT64_TYPE  # Default fallback
        end
        
        # Process with probabilities if provided
        if node_priors_json !== nothing || edge_probs_json !== nothing
            return process_network_with_probabilities(csv_content, node_priors_json, edge_probs_json, probability_type)
        else
            # Simple CSV processing
            return process_csv_adjacency_matrix(csv_content)
        end
        
    catch e
        println("❌ Error in file-based analysis: $e")
        return NetworkProcessingResult(
            false, nothing, nothing, nothing, nothing, nothing, nothing,
            nothing, nothing, nothing, nothing, nothing, string(e), nothing
        )
    end
end

end # module InputProcessingIntegration