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
    # ADD MISSING: NonNegativeTime * NonNegativeTime multiplication
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
    # Add missing isapprox method for mixed types
    Base.isapprox(a::NonNegativeTime, b::NonNegativeTime) = a.hours ≈ b.hours
    Base.isapprox(a::NonNegativeTime, b::Real) = a.hours ≈ b
    Base.isapprox(a::Real, b::NonNegativeTime) = a ≈ b.hours
    
    # Min/Max operations
    Base.max(a::NonNegativeTime, b::NonNegativeTime) = NonNegativeTime(max(a.hours, b.hours))
    Base.min(a::NonNegativeTime, b::NonNegativeTime) = NonNegativeTime(min(a.hours, b.hours))
    Base.maximum(times::Vector{NonNegativeTime}) = NonNegativeTime(Base.maximum(t.hours for t in times))
    Base.minimum(times::Vector{NonNegativeTime}) = NonNegativeTime(Base.minimum(t.hours for t in times))
    # REMOVED: This override was causing infinite recursion
    # Base.maximum(times::Base.ValueIterator) = NonNegativeTime(maximum(t.hours for t in times))
    
    # Dictionary access - FIXED: This was causing Float64 to be treated as NonNegativeTime
    # Remove this problematic override that conflicts with standard Dict operations
    # Base.get(dict::Dict, key, default::NonNegativeTime) = get(dict, key, default.hours)
    
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
        :hours       => 1.0,           # Base unit
        :days        => 24.0,
        :weeks       => 24.0 * 7       # 168 hours
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
        task_durations::Dict{Int64, TimeUnit}              # Hours
        dependency_delays::Dict{Tuple{Int64,Int64}, TimeUnit}  # Hours
        project_start_time::TimeUnit                       # Hours
    end
    
    # Constructor with mixed unit support
    function TimeFlowParameters(
        task_durations_raw::Dict{Int64, Tuple{Float64, Symbol}},     # (value, unit)
        dependency_delays_raw::Dict{Tuple{Int64,Int64}, Tuple{Float64, Symbol}};
        project_start::Tuple{Float64, Symbol} = (0.0, :hours)
    )
        # Convert all inputs to hours internally - automatically validates non-negative
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
        # Convert to TimeUnit and validate non-negative
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

    #
    # CONFIGURABLE PARAMETERS
    #
    
    """
    Parameters for generalized critical path analysis
    T: Type of values being propagated (Float64, TimeUnit, Cost, etc.)
    """
    struct CriticalPathParameters{T}
        # Node values (task durations, costs, etc.)
        node_values::Dict{Int64, T}
        
        # Edge values (delays, costs, scaling factors, etc.)  
        edge_values::Dict{Tuple{Int64,Int64}, T}
        
        # Initial value for source nodes
        initial_value::T
        
        # How to combine multiple parent values at joins
        combination_function::Function  # (Vector{T}) -> T
        
        # How to propagate through edges
        propagation_function::Function  # (parent_value::T, edge_value::T) -> T
        
        # How to incorporate node processing
        node_function::Function         # (combined_input::T, node_value::T) -> T
        
        function CriticalPathParameters(
            node_values::Dict{Int64, T},
            edge_values::Dict{Tuple{Int64,Int64}, T},
            initial_value::T,
            combination_function::Function = max_combination,
            propagation_function::Function = additive_propagation, 
            node_function::Function = additive_propagation
        ) where T
            new{T}(node_values, edge_values, initial_value, 
                   combination_function, propagation_function, node_function)
        end
    end

    """
    Results from critical path analysis
    """
    struct CriticalPathResult{T}
        node_values::Dict{Int64, T}
        critical_value::T
        critical_nodes::Vector{Int64}
        
        function CriticalPathResult(node_values::Dict{Int64, T}) where T
            # Use Base.maximum explicitly to avoid recursion issues
            values_collection = collect(values(node_values))
            critical_val = Base.maximum(values_collection)
            critical_nodes = [node for (node, val) in node_values if val == critical_val]
            new{T}(node_values, critical_val, critical_nodes)
        end
    end

    """
    Extended results from critical path analysis including backward pass data.
    Contains Early Start/Finish, Late Start/Finish, and Total Slack per node.
    """
    struct ExtendedCriticalPathResult{T}
        node_values::Dict{Int64, T}         # EF (early finish) from forward pass
        early_start::Dict{Int64, T}         # ES = EF - node_duration
        late_finish::Dict{Int64, T}         # LF from backward pass
        late_start::Dict{Int64, T}          # LS = LF - node_duration
        total_slack::Dict{Int64, T}         # LS - ES (or equivalently LF - EF)
        critical_value::T
        critical_nodes::Vector{Int64}
    end

    #
    # STANDARD INVERSE FUNCTIONS
    #
    
    """Inverse of additive node function: input = output - node_value"""
    function additive_inverse(output::T, node_value::T) where T
        return output - node_value
    end
    
    """Inverse of multiplicative node function: input = output / node_value"""
    function multiplicative_inverse(output::T, node_value::T) where T
        if node_value == zero(T)
            throw(DivideError())
        end
        return output / node_value
    end
    
    """
    Inverse of max node function: mathematically exact handling
    For max(input, node_value) = output:
    - If output > node_value: input = output (unique solution)
    - If output = node_value: input can be any value ≤ node_value (indeterminate)
    - If output < node_value: no solution exists (error condition)
    """
    function max_inverse(output::T, node_value::T) where T
        if output > node_value
            return output
        elseif output == node_value
            throw(ArgumentError("max_inverse is indeterminate: output ($output) equals node_value ($node_value). Multiple solutions exist."))
        else
            throw(ArgumentError("max_inverse has no solution: output ($output) < node_value ($node_value). This violates max function properties."))
        end
    end

    # 
    # STANDARD COMBINATION FUNCTIONS
    # 
    
    """Maximum combination (standard critical path)"""
    function max_combination(values::Vector{T}) where T
        isempty(values) ? zero(T) : maximum(values)
    end
    
    """Minimum combination (bottleneck analysis)"""  
    function min_combination(values::Vector{T}) where T
        isempty(values) ? typemax(T) : minimum(values)
    end
    
    """Sum combination (additive effects)"""
    function sum_combination(values::Vector{T}) where T
        isempty(values) ? zero(T) : sum(values)
    end
    
    """Average combination"""
    function avg_combination(values::Vector{T}) where T
        if isempty(values)
            return zero(T)
        end
        # length(values) is guaranteed > 0 here, so no division by zero
        return sum(values) / length(values)
    end
    
    """Weighted combination"""
    function weighted_combination(weights::Vector{Float64})
        return function(values::Vector{T}) where T
            if isempty(values)
                return zero(T)
            end
            if length(weights) != length(values)
                throw(ArgumentError("Weights and values must have same length"))
            end
            return sum(w * v for (w, v) in zip(weights, values))
        end
    end

    # 
    # STANDARD PROPAGATION FUNCTIONS  
    # 
    
    """Additive propagation (parent + edge)"""
    function additive_propagation(parent_value::T, edge_value::T) where T
        return parent_value + edge_value
    end
    
    """Multiplicative propagation (parent * edge)"""
    function multiplicative_propagation(parent_value::T, edge_value::T) where T
        return parent_value * edge_value
    end
    
    """Maximum propagation (max(parent, edge))"""
    function max_propagation(parent_value::T, edge_value::T) where T
        return max(parent_value, edge_value)
    end
    
    """Minimum propagation (min(parent, edge))"""
    function min_propagation(parent_value::T, edge_value::T) where T
        return min(parent_value, edge_value)
    end
    
    """Custom power propagation"""
    function power_propagation(exponent::Float64)
        return function(parent_value::T, edge_value::T) where T
            # Handle exact mathematical cases
            if edge_value == zero(T) && exponent < 0
                throw(DomainError(edge_value, "Cannot raise zero to negative power"))
            end
            if edge_value < zero(T) && !isinteger(exponent)
                throw(DomainError(edge_value, "Cannot raise negative number to non-integer power"))
            end
            return parent_value + edge_value^exponent
        end
    end

