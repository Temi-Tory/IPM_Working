# Future possibilities for this module:
    # - Earliest Start Times (for scheduling)
    # - Latest Start Times (for slack analysis) 
    # - Resource-Constrained Critical Path
    # - Parallel vs Sequential timing
    # This module does Time analysis via critical path analysis (maximum time)

    # This module's Base time unit is in HOURS because:
    # - Balances precision and scale better than seconds
    # - Easy to convert to any other unit without precision loss
    # - Handles everything from millisecond-level tasks to week-long projects
    # - No huge numbers for long projects (weeks = 168 hours vs 604,800 seconds)
    # - Intuitive for scheduling and project management
    # - Standard in project management tools

    # Conversion methods available to convert from other units excluding months and years due to number of days/leap year ambiguity

module TimeAnalysisModule
    using ..NetworkDecompositionModule
    using ..InputProcessingModule

    export TimeUnit;

    # Non-negative time wrapper type
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
    
    # Arithmetic operations
    Base.:(+)(a::NonNegativeTime, b::NonNegativeTime) = NonNegativeTime(a.hours + b.hours)
    Base.:(+)(a::NonNegativeTime, b::Real) = NonNegativeTime(a.hours + b)
    Base.:(+)(a::Real, b::NonNegativeTime) = NonNegativeTime(a + b.hours)
    Base.:(-)(a::NonNegativeTime, b::NonNegativeTime) = NonNegativeTime(max(0.0, a.hours - b.hours))
    Base.:(*)(a::NonNegativeTime, b::Real) = NonNegativeTime(a.hours * abs(b))
    Base.:(*)(a::Real, b::NonNegativeTime) = NonNegativeTime(abs(a) * b.hours)
    Base.:(/)(a::NonNegativeTime, b::Real) = NonNegativeTime(a.hours / abs(b))
    
    # Comparison operations
    Base.:(==)(a::NonNegativeTime, b::NonNegativeTime) = a.hours == b.hours
    Base.:(<)(a::NonNegativeTime, b::NonNegativeTime) = a.hours < b.hours
    Base.:(<=)(a::NonNegativeTime, b::NonNegativeTime) = a.hours <= b.hours
    Base.:(>)(a::NonNegativeTime, b::NonNegativeTime) = a.hours > b.hours
    Base.:(>=)(a::NonNegativeTime, b::NonNegativeTime) = a.hours >= b.hours
    Base.:(≈)(a::NonNegativeTime, b::NonNegativeTime) = a.hours ≈ b.hours
    
    # Min/Max operations
    Base.max(a::NonNegativeTime, b::NonNegativeTime) = NonNegativeTime(max(a.hours, b.hours))
    Base.min(a::NonNegativeTime, b::NonNegativeTime) = NonNegativeTime(min(a.hours, b.hours))
    Base.maximum(times::Vector{NonNegativeTime}) = NonNegativeTime(maximum(t.hours for t in times))
    Base.minimum(times::Vector{NonNegativeTime}) = NonNegativeTime(minimum(t.hours for t in times))
    Base.maximum(times::Base.ValueIterator) = NonNegativeTime(maximum(t.hours for t in times))
    
    # Dictionary access
    Base.get(dict::Dict, key, default::NonNegativeTime) = get(dict, key, default.hours)
    
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
        return time_hours.hours / TIME_CONVERSIONS[to_unit]
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

    # Time combination functions (sequential operations)
    function add_durations(a::TimeUnit, b::TimeUnit)
        return a + b  # Series: sequential execution
    end

    # Time combination functions (parallel operations)
    function max_durations(durations::Vector{TimeUnit})
        return maximum(durations)  # Parallel: critical path (longest duration)
    end

    # Main time flow analysis function 
    function time_update_beliefs_iterative(
        edgelist::Vector{Tuple{Int64,Int64}},  
        iteration_sets::Vector{Set{Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        time_params::TimeFlowParameters
    )
        completion_times = Dict{Int64, TimeUnit}()

        for node_set in iteration_sets
            for node in node_set
                if node in source_nodes
                    # Source nodes start at project start time and complete after task duration
                    completion_times[node] = time_params.project_start_time + 
                                           time_params.task_durations[node]
                else
                    # Calculate latest prerequisite completion time
                    latest_prerequisite = time_params.project_start_time
                    
                    for parent in incoming_index[node]
                        if !haskey(completion_times, parent)
                            throw(ErrorException("Parent node $parent of node $node has no completion time. Processing order error."))
                        end
                        
                        parent_completion = completion_times[parent]
                        edge_delay = get(time_params.dependency_delays, (parent, node), NonNegativeTime(0.0))
                        
                        # Critical path: take maximum of all predecessor paths
                        latest_prerequisite = max(latest_prerequisite, parent_completion + edge_delay)
                    end
                    
                    # Node completes after waiting for prerequisites plus its own duration
                    completion_times[node] = latest_prerequisite + time_params.task_durations[node]
                end
            end
        end

        return completion_times
    end

    # Utility functions for analysis results

    # Get total project duration
    function get_project_duration(completion_times::Dict{Int64, TimeUnit})
        return maximum(values(completion_times))
    end
    
    # Find nodes on critical path (nodes that complete at project end time)
    function get_critical_path_nodes(completion_times::Dict{Int64, TimeUnit})
        max_time = maximum(values(completion_times))
        return [node for (node, time) in completion_times if time ≈ max_time]
    end
    
    # Format results in different time units
    function format_results(completion_times::Dict{Int64, TimeUnit}, output_unit::Symbol = :hours)
        return Dict(
            node => from_hours(time, output_unit)
            for (node, time) in completion_times
        )
    end

    # Validation function for time parameters - SIMPLIFIED since type system enforces non-negative
    function validate_time_parameters(
        task_durations::Dict{Int64, TimeUnit},
        dependency_delays::Dict{Tuple{Int64,Int64}, TimeUnit},
        edgelist::Vector{Tuple{Int64,Int64}}
    )
        # No need to check for negative durations/delays - type system prevents them!
        
        # Check that all edges have delay values 
        missing_delays = [edge for edge in edgelist if !haskey(dependency_delays, edge)]
        if !isempty(missing_delays)
            @warn "Missing delay values for edges: $missing_delays. Defaulting to 0.0 hours."
        end
        
        return true
    end

end # module TimeAnalysisModule