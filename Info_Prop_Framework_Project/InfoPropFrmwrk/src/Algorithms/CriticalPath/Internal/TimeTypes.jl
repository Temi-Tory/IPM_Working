#
# TIME ANALYSIS TYPES AND OPERATIONS
#

# Non-negative time wrapper type for exact time calculations
struct NonNegativeTime
    hours::Float64

    function NonNegativeTime(hours::Float64)
        hours >= 0.0 || throw(ArgumentError("Time cannot be negative: $hours hours"))
        new(hours)
    end
end

# Make it behave exactly like Float64 for all operations
Base.convert(::Type{Float64}, t::NonNegativeTime) = t.hours
Base.convert(::Type{NonNegativeTime}, x::Real) = NonNegativeTime(Float64(x))
Base.Float64(t::NonNegativeTime) = t.hours
Base.zero(::Type{NonNegativeTime}) = NonNegativeTime(0.0)
Base.one(::Type{NonNegativeTime}) = NonNegativeTime(1.0)

# Arithmetic operations with exact error handling
Base.:(+)(a::NonNegativeTime, b::NonNegativeTime) = NonNegativeTime(a.hours + b.hours)
Base.:(+)(a::NonNegativeTime, b::Real) = NonNegativeTime(a.hours + b)
Base.:(+)(a::Real, b::NonNegativeTime) = NonNegativeTime(a + b.hours)
Base.:(-)(a::NonNegativeTime, b::NonNegativeTime) = begin
    result = a.hours - b.hours
    if result < 0.0
        throw(ArgumentError("NonNegativeTime subtraction would result in negative time: $a - $b = $result hours"))
    end
    NonNegativeTime(result)
end
Base.:(*)(a::NonNegativeTime, b::Real) = begin
    if b < 0
        throw(ArgumentError("Cannot multiply NonNegativeTime by negative value: $b"))
    end
    NonNegativeTime(a.hours * b)
end
Base.:(*)(a::Real, b::NonNegativeTime) = begin
    if a < 0
        throw(ArgumentError("Cannot multiply negative value by NonNegativeTime: $a"))
    end
    NonNegativeTime(a * b.hours)
end
Base.:(*)(a::NonNegativeTime, b::NonNegativeTime) = begin
    NonNegativeTime(a.hours * b.hours)
end
Base.:(/)(a::NonNegativeTime, b::Real) = begin
    if b == 0
        throw(DivideError())
    end
    if b < 0
        throw(ArgumentError("Cannot divide NonNegativeTime by negative value: $b"))
    end
    NonNegativeTime(a.hours / b)
end

# Comparison operations
Base.:(==)(a::NonNegativeTime, b::NonNegativeTime) = a.hours == b.hours
Base.:(<)(a::NonNegativeTime, b::NonNegativeTime) = a.hours < b.hours
Base.:(<=)(a::NonNegativeTime, b::NonNegativeTime) = a.hours <= b.hours
Base.:(>)(a::NonNegativeTime, b::NonNegativeTime) = a.hours > b.hours
Base.:(>=)(a::NonNegativeTime, b::NonNegativeTime) = a.hours >= b.hours
Base.:(≈)(a::NonNegativeTime, b::NonNegativeTime) = a.hours ≈ b.hours
Base.isapprox(a::NonNegativeTime, b::NonNegativeTime) = a.hours ≈ b.hours
Base.isapprox(a::NonNegativeTime, b::Real) = a.hours ≈ b
Base.isapprox(a::Real, b::NonNegativeTime) = a ≈ b.hours

# Min/Max operations
Base.max(a::NonNegativeTime, b::NonNegativeTime) = NonNegativeTime(max(a.hours, b.hours))
Base.min(a::NonNegativeTime, b::NonNegativeTime) = NonNegativeTime(min(a.hours, b.hours))
Base.maximum(times::Vector{NonNegativeTime}) = NonNegativeTime(Base.maximum(t.hours for t in times))
Base.minimum(times::Vector{NonNegativeTime}) = NonNegativeTime(Base.minimum(t.hours for t in times))

# Display
Base.show(io::IO, t::NonNegativeTime) = print(io, t.hours)

# Type alias for clarity - all times internally stored as non-negative hours
const TimeUnit = NonNegativeTime

# Base time unit and conversion factors
const BASE_TIME_UNIT = :hours

const TIME_CONVERSIONS = Dict{Symbol, Float64}(
    :microseconds => 1.0 / 3_600_000_000,
    :milliseconds => 1.0 / 3_600_000,
    :seconds     => 1.0 / 3_600,
    :minutes     => 1.0 / 60,
    :hours       => 1.0,
    :days        => 24.0,
    :weeks       => 24.0 * 7
)

# Time unit conversion functions
function to_hours(time_value::Float64, from_unit::Symbol)
    haskey(TIME_CONVERSIONS, from_unit) ||
        throw(ArgumentError("Unsupported time unit: $from_unit. Supported: $(keys(TIME_CONVERSIONS))"))
    return NonNegativeTime(time_value * TIME_CONVERSIONS[from_unit])
end

function from_hours(time_hours::TimeUnit, to_unit::Symbol)
    haskey(TIME_CONVERSIONS, to_unit) ||
        throw(ArgumentError("Unsupported time unit: $to_unit"))

    conversion_factor = TIME_CONVERSIONS[to_unit]
    if conversion_factor == 0.0
        throw(DivideError())
    end

    return time_hours.hours / conversion_factor
end

# Time flow parameters structure
struct TimeFlowParameters
    task_durations::Dict{Int64, TimeUnit}
    dependency_delays::Dict{Tuple{Int64,Int64}, TimeUnit}
    project_start_time::TimeUnit
end

# Constructor with mixed unit support
function TimeFlowParameters(
    task_durations_raw::Dict{Int64, Tuple{Float64, Symbol}},
    dependency_delays_raw::Dict{Tuple{Int64,Int64}, Tuple{Float64, Symbol}};
    project_start::Tuple{Float64, Symbol} = (0.0, :hours)
)
    task_durations = Dict(
        node => to_hours(duration[1], duration[2])
        for (node, duration) in task_durations_raw
    )

    dependency_delays = Dict(
        edge => to_hours(delay[1], delay[2])
        for (edge, delay) in dependency_delays_raw
    )

    start_time = to_hours(project_start[1], project_start[2])

    return TimeFlowParameters(task_durations, dependency_delays, start_time)
end

# Simple constructor for same-unit inputs
function TimeFlowParameters(
    task_durations::Dict{Int64, Float64},
    dependency_delays::Dict{Tuple{Int64,Int64}, Float64};
    input_unit::Symbol = :hours,
    project_start::Float64 = 0.0
)
    if input_unit == :hours
        validated_durations = Dict(node => NonNegativeTime(dur) for (node, dur) in task_durations)
        validated_delays = Dict(edge => NonNegativeTime(delay) for (edge, delay) in dependency_delays)
        validated_start = NonNegativeTime(project_start)
        return TimeFlowParameters(validated_durations, validated_delays, validated_start)
    else
        converted_durations = Dict(node => to_hours(dur, input_unit) for (node, dur) in task_durations)
        converted_delays = Dict(edge => to_hours(delay, input_unit) for (edge, delay) in dependency_delays)
        converted_start = to_hours(project_start, input_unit)
        return TimeFlowParameters(converted_durations, converted_delays, converted_start)
    end
end
