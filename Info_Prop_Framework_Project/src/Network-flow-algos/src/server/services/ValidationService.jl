"""
ValidationService.jl

Input validation service for HTTP requests and data integrity checks.
Ensures data quality and prevents errors before processing.
"""
module ValidationService

using JSON

export validate_csv_content, validate_request_data, ValidationResult, ValidationError

# Strict type definitions for validation results
struct ValidationError
    field::String
    message::String
    error_code::String
end

struct ValidationResult
    is_valid::Bool
    errors::Vector{ValidationError}
    warnings::Vector{String}
end

"""
    validate_csv_content(csv_content) -> ValidationResult

Validate CSV content for network adjacency matrix format.
"""
function validate_csv_content(csv_content::String)::ValidationResult
    errors = Vector{ValidationError}()
    warnings = Vector{String}()
    
    try
        if isempty(strip(csv_content))
            push!(errors, ValidationError("csvContent", "CSV content cannot be empty", "EMPTY_CSV"))
            return ValidationResult(false, errors, warnings)
        end
        
        # Parse CSV content to validate format
        lines = split(strip(csv_content), '\n')
        if length(lines) < 2
            push!(errors, ValidationError("csvContent", "CSV must have at least 2 rows", "INSUFFICIENT_ROWS"))
            return ValidationResult(false, errors, warnings)
        end
        
        # Check if it's a square matrix
        n_rows = length(lines)
        n_cols = 0
        
        for (i, line) in enumerate(lines)
            values = split(strip(line), ',')
            if i == 1
                n_cols = length(values)
            elseif length(values) != n_cols
                push!(errors, ValidationError("csvContent", "All rows must have the same number of columns", "INCONSISTENT_COLUMNS"))
                return ValidationResult(false, errors, warnings)
            end
            
            # Validate that values are numeric (0 or 1 for adjacency matrix)
            for (j, val) in enumerate(values)
                val_trimmed = strip(val)
                try
                    parsed_val = parse(Int, val_trimmed)
                    if parsed_val != 0 && parsed_val != 1
                        push!(warnings, "Non-binary value at row $i, col $j: $parsed_val (expected 0 or 1)")
                    end
                catch
                    push!(errors, ValidationError("csvContent", "Invalid numeric value at row $i, col $j: '$val_trimmed'", "INVALID_NUMERIC"))
                end
            end
        end
        
        # Check if matrix is square
        if n_rows != n_cols
            push!(errors, ValidationError("csvContent", "Adjacency matrix must be square ($n_rows x $n_cols)", "NON_SQUARE_MATRIX"))
        end
        
        # Minimum size check
        if n_rows < 2
            push!(errors, ValidationError("csvContent", "Network must have at least 2 nodes", "INSUFFICIENT_NODES"))
        end
        
        # Maximum size check (prevent memory issues)
        if n_rows > 1000
            push!(warnings, "Large network detected ($n_rows nodes). Processing may be slow.")
        end
        
        println("📊 CSV validation: $n_rows x $n_cols matrix, $(length(errors)) errors, $(length(warnings)) warnings")
        
    catch e
        push!(errors, ValidationError("csvContent", "Failed to parse CSV: $(string(e))", "PARSE_ERROR"))
    end
    
    return ValidationResult(isempty(errors), errors, warnings)
end

"""
    validate_request_data(request_data, endpoint_type) -> ValidationResult

Validate HTTP request data based on endpoint type.
"""
function validate_request_data(request_data::Dict, endpoint_type::String)::ValidationResult
    errors = Vector{ValidationError}()
    warnings = Vector{String}()
    
    try
        # Common validations for all endpoints
        if !haskey(request_data, "csvContent")
            push!(errors, ValidationError("csvContent", "CSV content is required", "MISSING_CSV"))
        else
            # Validate CSV content
            csv_validation = validate_csv_content(request_data["csvContent"])
            append!(errors, csv_validation.errors)
            append!(warnings, csv_validation.warnings)
        end
        
        # Endpoint-specific validations
        if endpoint_type == "processinput"
            # Basic input processing - no additional parameters required
            
        elseif endpoint_type == "diamondprocessing"
            # Diamond processing - no additional parameters required
            
        elseif endpoint_type == "diamondclassification"
            # Diamond classification - no additional parameters required
            
        elseif endpoint_type == "reachabilitymodule"
            # Reachability analysis - validate parameter overrides if present
            param_validation = validate_parameter_overrides(request_data)
            append!(errors, param_validation.errors)
            append!(warnings, param_validation.warnings)
            
        elseif endpoint_type == "pathenum"
            # Path enumeration - validate optional source/target nodes
            if haskey(request_data, "sourceNode")
                if !validate_node_id(request_data["sourceNode"])
                    push!(errors, ValidationError("sourceNode", "Invalid source node ID", "INVALID_NODE_ID"))
                end
            end
            
            if haskey(request_data, "targetNode")
                if !validate_node_id(request_data["targetNode"])
                    push!(errors, ValidationError("targetNode", "Invalid target node ID", "INVALID_NODE_ID"))
                end
            end
            
        elseif endpoint_type == "montecarlo"
            # Monte Carlo analysis - validate iterations parameter
            if haskey(request_data, "iterations")
                iterations = request_data["iterations"]
                if !isa(iterations, Number) || iterations < 1000 || iterations > 10_000_000
                    push!(errors, ValidationError("iterations", "Iterations must be between 1,000 and 10,000,000", "INVALID_ITERATIONS"))
                end
            end
            
            # Validate parameter overrides
            param_validation = validate_parameter_overrides(request_data)
            append!(errors, param_validation.errors)
            append!(warnings, param_validation.warnings)
        end
        
    catch e
        push!(errors, ValidationError("general", "Request validation error: $(string(e))", "VALIDATION_ERROR"))
    end
    
    return ValidationResult(isempty(errors), errors, warnings)
end

"""
    validate_parameter_overrides(request_data) -> ValidationResult

Validate parameter override data in request.
"""
function validate_parameter_overrides(request_data::Dict)::ValidationResult
    errors = Vector{ValidationError}()
    warnings = Vector{String}()
    
    try
        # Validate global parameter overrides
        if haskey(request_data, "nodePrior")
            node_prior = request_data["nodePrior"]
            if !isa(node_prior, Number) || node_prior < 0 || node_prior > 1
                push!(errors, ValidationError("nodePrior", "Node prior must be between 0 and 1", "INVALID_NODE_PRIOR"))
            end
        end
        
        if haskey(request_data, "edgeProb")
            edge_prob = request_data["edgeProb"]
            if !isa(edge_prob, Number) || edge_prob < 0 || edge_prob > 1
                push!(errors, ValidationError("edgeProb", "Edge probability must be between 0 and 1", "INVALID_EDGE_PROB"))
            end
        end
        
        # Validate individual parameter overrides
        if get(request_data, "useIndividualOverrides", false)
            if haskey(request_data, "individualNodePriors")
                node_priors = request_data["individualNodePriors"]
                if !isa(node_priors, Dict)
                    push!(errors, ValidationError("individualNodePriors", "Must be a dictionary", "INVALID_TYPE"))
                else
                    for (node_key, value) in node_priors
                        if !validate_node_id(node_key)
                            push!(errors, ValidationError("individualNodePriors", "Invalid node ID: $node_key", "INVALID_NODE_ID"))
                        end
                        if !isa(value, Number) || value < 0 || value > 1
                            push!(errors, ValidationError("individualNodePriors", "Invalid prior value for node $node_key: $value", "INVALID_PRIOR_VALUE"))
                        end
                    end
                end
            end
            
            if haskey(request_data, "individualEdgeProbabilities")
                edge_probs = request_data["individualEdgeProbabilities"]
                if !isa(edge_probs, Dict)
                    push!(errors, ValidationError("individualEdgeProbabilities", "Must be a dictionary", "INVALID_TYPE"))
                else
                    for (edge_key, value) in edge_probs
                        if !validate_edge_key(edge_key)
                            push!(errors, ValidationError("individualEdgeProbabilities", "Invalid edge key: $edge_key", "INVALID_EDGE_KEY"))
                        end
                        if !isa(value, Number) || value < 0 || value > 1
                            push!(errors, ValidationError("individualEdgeProbabilities", "Invalid probability value for edge $edge_key: $value", "INVALID_PROB_VALUE"))
                        end
                    end
                end
            end
        end
        
    catch e
        push!(errors, ValidationError("parameterOverrides", "Parameter validation error: $(string(e))", "PARAM_VALIDATION_ERROR"))
    end
    
    return ValidationResult(isempty(errors), errors, warnings)
end

"""
    validate_node_id(node_id) -> Bool

Validate that a node ID is a valid integer.
"""
function validate_node_id(node_id::Any)::Bool
    try
        if isa(node_id, Number)
            return node_id > 0 && node_id == floor(node_id)  # Positive integer
        elseif isa(node_id, String)
            parsed = parse(Int, node_id)
            return parsed > 0
        end
        return false
    catch
        return false
    end
end

"""
    validate_edge_key(edge_key) -> Bool

Validate that an edge key is in the correct format "(src,dst)".
"""
function validate_edge_key(edge_key::Any)::Bool
    try
        edge_str = string(edge_key)
        if startswith(edge_str, "(") && endswith(edge_str, ")")
            inner = edge_str[2:end-1]
            parts = split(inner, ",")
            if length(parts) == 2
                src = parse(Int, strip(parts[1]))
                dst = parse(Int, strip(parts[2]))
                return src > 0 && dst > 0
            end
        end
        return false
    catch
        return false
    end
end

"""
    validate_json_structure(json_str, required_fields) -> ValidationResult

Validate JSON structure contains required fields.
"""
function validate_json_structure(json_str::String, required_fields::Vector{String})::ValidationResult
    errors = Vector{ValidationError}()
    warnings = Vector{String}()
    
    try
        data = JSON.parse(json_str)
        
        if !isa(data, Dict)
            push!(errors, ValidationError("json", "JSON must be an object", "INVALID_JSON_TYPE"))
            return ValidationResult(false, errors, warnings)
        end
        
        for field in required_fields
            if !haskey(data, field)
                push!(errors, ValidationError(field, "Required field missing: $field", "MISSING_FIELD"))
            end
        end
        
    catch e
        push!(errors, ValidationError("json", "Invalid JSON format: $(string(e))", "INVALID_JSON"))
    end
    
    return ValidationResult(isempty(errors), errors, warnings)
end

"""
    format_validation_errors(validation_result) -> Dict

Format validation errors for HTTP response.
"""
function format_validation_errors(validation_result::ValidationResult)::Dict{String, Any}
    return Dict{String, Any}(
        "isValid" => validation_result.is_valid,
        "errors" => [
            Dict{String, Any}(
                "field" => error.field,
                "message" => error.message,
                "code" => error.error_code
            ) for error in validation_result.errors
        ],
        "warnings" => validation_result.warnings,
        "errorCount" => length(validation_result.errors),
        "warningCount" => length(validation_result.warnings)
    )
end

end # module ValidationService