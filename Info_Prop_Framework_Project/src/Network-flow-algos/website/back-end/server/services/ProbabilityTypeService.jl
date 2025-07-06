"""
ProbabilityTypeService.jl

Service for handling different probability types (Float64, Interval, pbox).
Provides conversion, validation, and serialization utilities.
"""
module ProbabilityTypeService

using JSON

# Import InputProcessingModule for Interval and pbox types
include(joinpath(@__DIR__, "..", "..", "..", "..", "src", "Algorithms", "InputProcessingModule.jl"))
using .InputProcessingModule

# Import ProbabilityBoundsAnalysis for pbox
import ProbabilityBoundsAnalysis
const PBA = ProbabilityBoundsAnalysis
const pbox = ProbabilityBoundsAnalysis.pbox

export ProbabilityValue, serialize_probability_value, deserialize_probability_value,
       validate_probability_value, convert_probability_value, get_probability_bounds,
       create_float64_value, create_interval_value, create_pbox_value,
       ProbabilityTypeInfo, get_supported_types

# Union type for all supported probability values
const ProbabilityValue = Union{Float64, Interval, PBA.pbox}

# Information about supported probability types
struct ProbabilityTypeInfo
    name::String
    description::String
    example_json::String
    supports_uncertainty::Bool
end

"""
    get_supported_types() -> Dict{String, ProbabilityTypeInfo}

Get information about all supported probability types.
"""
function get_supported_types()::Dict{String, ProbabilityTypeInfo}
    return Dict{String, ProbabilityTypeInfo}(
        "float64" => ProbabilityTypeInfo(
            "Float64",
            "Standard floating-point probability values (0.0 to 1.0)",
            "0.75",
            false
        ),
        "interval" => ProbabilityTypeInfo(
            "Interval",
            "Interval-valued probabilities with lower and upper bounds",
            "{\"lower\": 0.6, \"upper\": 0.8}",
            true
        ),
        "pbox" => ProbabilityTypeInfo(
            "P-box",
            "Probability boxes with cumulative distribution bounds",
            "{\"left\": [0.0, 0.5, 1.0], \"right\": [0.0, 0.7, 1.0]}",
            true
        )
    )
end

"""
    serialize_probability_value(value::ProbabilityValue) -> Any

Serialize a probability value to JSON-compatible format.
"""
function serialize_probability_value(value::ProbabilityValue)::Any
    if isa(value, Float64)
        return value
    elseif isa(value, Interval)
        return Dict{String, Any}(
            "type" => "interval",
            "lower" => value.lower,
            "upper" => value.upper
        )
    elseif isa(value, PBA.pbox)
        return Dict{String, Any}(
            "type" => "pbox",
            "left" => value.left,
            "right" => value.right,
            "steps" => length(value.left)
        )
    else
        throw(ArgumentError("Unsupported probability value type: $(typeof(value))"))
    end
end

"""
    deserialize_probability_value(data::Any, target_type::String) -> ProbabilityValue

Deserialize JSON data to a probability value of the specified type.
"""
function deserialize_probability_value(data::Any, target_type::String)::ProbabilityValue
    if target_type == "float64"
        return create_float64_value(data)
    elseif target_type == "interval"
        return create_interval_value(data)
    elseif target_type == "pbox"
        return create_pbox_value(data)
    else
        throw(ArgumentError("Unsupported target type: $target_type"))
    end
end

"""
    create_float64_value(data::Any) -> Float64

Create a Float64 probability value from various input formats.
"""
function create_float64_value(data::Any)::Float64
    if isa(data, Number)
        value = Float64(data)
        validate_probability_range(value)
        return value
    elseif isa(data, Dict)
        # Handle interval by taking midpoint
        if haskey(data, "lower") && haskey(data, "upper")
            lower = Float64(data["lower"])
            upper = Float64(data["upper"])
            value = (lower + upper) / 2.0
            validate_probability_range(value)
            return value
        elseif haskey(data, "value")
            value = Float64(data["value"])
            validate_probability_range(value)
            return value
        end
    end
    
    throw(ArgumentError("Cannot create Float64 value from: $data"))
end

"""
    create_interval_value(data::Any) -> Interval

Create an Interval probability value from various input formats.
"""
function create_interval_value(data::Any)::Interval
    if isa(data, Number)
        # Single value becomes point interval
        value = Float64(data)
        validate_probability_range(value)
        return Interval(value, value)
    elseif isa(data, Dict)
        if haskey(data, "lower") && haskey(data, "upper")
            lower = Float64(data["lower"])
            upper = Float64(data["upper"])
            validate_probability_range(lower)
            validate_probability_range(upper)
            if lower > upper
                throw(ArgumentError("Lower bound ($lower) cannot be greater than upper bound ($upper)"))
            end
            return Interval(lower, upper)
        elseif haskey(data, "value")
            value = Float64(data["value"])
            validate_probability_range(value)
            return Interval(value, value)
        end
    end
    
    throw(ArgumentError("Cannot create Interval value from: $data"))
end

"""
    create_pbox_value(data::Any) -> PBA.pbox

Create a pbox probability value from various input formats.
"""
function create_pbox_value(data::Any)::PBA.pbox
    if isa(data, Number)
        # Single value becomes point pbox
        value = Float64(data)
        validate_probability_range(value)
        return pbox([value], [value])
    elseif isa(data, Dict)
        if haskey(data, "left") && haskey(data, "right")
            left = Vector{Float64}(data["left"])
            right = Vector{Float64}(data["right"])
            
            # Validate bounds
            for val in vcat(left, right)
                validate_probability_range(val)
            end
            
            return pbox(left, right)
        elseif haskey(data, "lower") && haskey(data, "upper")
            # Convert interval to pbox
            lower = Float64(data["lower"])
            upper = Float64(data["upper"])
            validate_probability_range(lower)
            validate_probability_range(upper)
            return pbox([lower], [upper])
        elseif haskey(data, "value")
            value = Float64(data["value"])
            validate_probability_range(value)
            return pbox([value], [value])
        end
    end
    
    throw(ArgumentError("Cannot create pbox value from: $data"))
end

"""
    validate_probability_value(value::ProbabilityValue) -> Bool

Validate that a probability value is within valid bounds.
"""
function validate_probability_value(value::ProbabilityValue)::Bool
    try
        if isa(value, Float64)
            validate_probability_range(value)
        elseif isa(value, Interval)
            validate_probability_range(value.lower)
            validate_probability_range(value.upper)
            if value.lower > value.upper
                return false
            end
        elseif isa(value, PBA.pbox)
            for val in vcat(value.left, value.right)
                validate_probability_range(val)
            end
        else
            return false
        end
        return true
    catch
        return false
    end
end

"""
    validate_probability_range(value::Float64)

Validate that a probability value is in [0, 1] range.
"""
function validate_probability_range(value::Float64)
    if value < 0.0 || value > 1.0
        throw(ArgumentError("Probability value must be in range [0, 1], got: $value"))
    end
end

"""
    convert_probability_value(value::ProbabilityValue, target_type::String) -> ProbabilityValue

Convert a probability value to a different type.
"""
function convert_probability_value(value::ProbabilityValue, target_type::String)::ProbabilityValue
    if target_type == "float64"
        return convert_to_float64(value)
    elseif target_type == "interval"
        return convert_to_interval(value)
    elseif target_type == "pbox"
        return convert_to_pbox(value)
    else
        throw(ArgumentError("Unsupported target type: $target_type"))
    end
end

"""
    convert_to_float64(value::ProbabilityValue) -> Float64

Convert any probability value to Float64.
"""
function convert_to_float64(value::ProbabilityValue)::Float64
    if isa(value, Float64)
        return value
    elseif isa(value, Interval)
        # Return midpoint
        return (value.lower + value.upper) / 2.0
    elseif isa(value, PBA.pbox)
        # Return midpoint of the mean bounds
        left_mean = sum(value.left) / length(value.left)
        right_mean = sum(value.right) / length(value.right)
        return (left_mean + right_mean) / 2.0
    else
        throw(ArgumentError("Cannot convert $(typeof(value)) to Float64"))
    end
end

"""
    convert_to_interval(value::ProbabilityValue) -> Interval

Convert any probability value to Interval.
"""
function convert_to_interval(value::ProbabilityValue)::Interval
    if isa(value, Float64)
        return Interval(value, value)
    elseif isa(value, Interval)
        return value
    elseif isa(value, PBA.pbox)
        # Use the bounds of the pbox
        lower = minimum(value.left)
        upper = maximum(value.right)
        return Interval(lower, upper)
    else
        throw(ArgumentError("Cannot convert $(typeof(value)) to Interval"))
    end
end

"""
    convert_to_pbox(value::ProbabilityValue) -> PBA.pbox

Convert any probability value to pbox.
"""
function convert_to_pbox(value::ProbabilityValue)::PBA.pbox
    if isa(value, Float64)
        return pbox([value], [value])
    elseif isa(value, Interval)
        return pbox([value.lower], [value.upper])
    elseif isa(value, PBA.pbox)
        return value
    else
        throw(ArgumentError("Cannot convert $(typeof(value)) to pbox"))
    end
end

"""
    get_probability_bounds(value::ProbabilityValue) -> Tuple{Float64, Float64}

Get the lower and upper bounds of any probability value.
"""
function get_probability_bounds(value::ProbabilityValue)::Tuple{Float64, Float64}
    if isa(value, Float64)
        return (value, value)
    elseif isa(value, Interval)
        return (value.lower, value.upper)
    elseif isa(value, PBA.pbox)
        return (minimum(value.left), maximum(value.right))
    else
        throw(ArgumentError("Cannot get bounds for $(typeof(value))"))
    end
end

"""
    serialize_probability_dict(prob_dict::Dict, include_type_info::Bool = false) -> Dict

Serialize a dictionary of probability values to JSON-compatible format.
"""
function serialize_probability_dict(prob_dict::Dict, include_type_info::Bool = false)::Dict
    result = Dict{String, Any}()
    
    for (key, value) in prob_dict
        serialized_value = serialize_probability_value(value)
        result[string(key)] = serialized_value
    end
    
    if include_type_info
        # Add type information
        sample_value = first(values(prob_dict))
        if isa(sample_value, Float64)
            result["_type_info"] = "float64"
        elseif isa(sample_value, Interval)
            result["_type_info"] = "interval"
        elseif isa(sample_value, PBA.pbox)
            result["_type_info"] = "pbox"
        end
    end
    
    return result
end

"""
    deserialize_probability_dict(data::Dict, target_type::String) -> Dict

Deserialize a dictionary of probability values from JSON format.
"""
function deserialize_probability_dict(data::Dict, target_type::String)::Dict
    result = Dict()
    
    for (key, value) in data
        # Skip metadata fields
        if startswith(string(key), "_")
            continue
        end
        
        prob_value = deserialize_probability_value(value, target_type)
        result[key] = prob_value
    end
    
    return result
end

end # module ProbabilityTypeService