module ReachabilityModule_IS
    using Combinatorics

    # Define a ProbabilitySlices type to represent multiple sub-intervals
    struct ProbabilitySlices
        slices::Vector{Float64}  # Sorted breakpoints including 0.0 and 1.0
        weights::Vector{Float64}  # Weights/probabilities for each slice
        
        function ProbabilitySlices(slices::Vector{Float64}, weights::Vector{Float64})
            # Validate inputs
            if length(slices) < 2
                throw(ArgumentError("Need at least two slice points"))
            end
            if slices[1] != 0.0 || slices[end] != 1.0
                throw(ArgumentError("Slices must start at 0.0 and end at 1.0"))
            end
            if !issorted(slices)
                throw(ArgumentError("Slices must be sorted"))
            end
            if length(slices) != length(weights) + 1
                throw(ArgumentError("Number of weights must be one less than number of slices"))
            end
            if !all(x -> x >= 0.0, weights)
                throw(ArgumentError("All weights must be non-negative"))
            end
            
            # Normalize weights to sum to 1
            normalized_weights = weights ./ sum(weights)
            new(slices, normalized_weights)
        end
    end

    # Helper function to multiply two slice distributions
    function *(a::ProbabilitySlices, b::ProbabilitySlices)
        # Create combined breakpoints
        combined_points = sort(unique([
            x * y 
            for x in a.slices 
            for y in b.slices
        ]))
        
        # Calculate weights for new slices
        new_weights = Float64[]
        for i in 1:(length(combined_points)-1)
            left = combined_points[i]
            right = combined_points[i+1]
            
            # Calculate weight for this slice by integrating over all contributing pairs
            weight = 0.0
            for (ai, aw) in zip(1:length(a.weights), a.weights)
                for (bi, bw) in zip(1:length(b.weights), b.weights)
                    # Calculate overlap of this pair with current slice
                    a_left = a.slices[ai]
                    a_right = a.slices[ai+1]
                    b_left = b.slices[bi]
                    b_right = b.slices[bi+1]
                    
                    overlap = calculate_overlap(
                        (a_left, a_right), 
                        (b_left, b_right), 
                        (left, right)
                    )
                    
                    weight += overlap * aw * bw
                end
            end
            push!(new_weights, weight)
        end
        
        return ProbabilitySlices(combined_points, new_weights)
    end

    # Helper function to calculate overlap between intervals
    function calculate_overlap(
        interval1::Tuple{Float64,Float64}, 
        interval2::Tuple{Float64,Float64}, 
        target::Tuple{Float64,Float64}
    )
        # Calculate what fraction of the product of interval1 and interval2
        # falls within the target interval
        a_left, a_right = interval1
        b_left, b_right = interval2
        t_left, t_right = target
        
        # Calculate intersection of the product ranges
        prod_left = max(t_left, a_left * b_left)
        prod_right = min(t_right, a_right * b_right)
        
        if prod_right <= prod_left
            return 0.0
        end
        
        return (prod_right - prod_left) / ((a_right - a_left) * (b_right - b_left))
    end

    # Modified inclusion-exclusion for slice distributions
    function inclusion_exclusion(belief_values::Vector{ProbabilitySlices})
        if isempty(belief_values)
            return ProbabilitySlices([0.0, 1.0], [1.0])
        end
        
        # Start with first distribution
        result = belief_values[1]
        
        # Process each additional distribution
        for i in 2:length(belief_values)
            # Create combined breakpoints
            points = sort(unique([
                x + y - (x * y)  # Inclusion-exclusion formula
                for x in result.slices 
                for y in belief_values[i].slices
            ]))
            
            # Calculate weights for new slices
            weights = Float64[]
            for j in 1:(length(points)-1)
                left = points[j]
                right = points[j+1]
                
                # Calculate weight using inclusion-exclusion principle
                weight = calculate_ie_weight(
                    result, 
                    belief_values[i], 
                    (left, right)
                )
                push!(weights, weight)
            end
            
            result = ProbabilitySlices(points, weights)
        end
        
        return result
    end

    # Helper function to calculate inclusion-exclusion weights
    function calculate_ie_weight(
        dist1::ProbabilitySlices, 
        dist2::ProbabilitySlices, 
        target::Tuple{Float64,Float64}
    )
        weight = 0.0
        for (i1, w1) in zip(1:length(dist1.weights), dist1.weights)
            for (i2, w2) in zip(1:length(dist2.weights), dist2.weights)
                # Calculate contribution using inclusion-exclusion principle
                interval1 = (dist1.slices[i1], dist1.slices[i1+1])
                interval2 = (dist2.slices[i2], dist2.slices[i2+1])
                
                contribution = calculate_ie_overlap(interval1, interval2, target)
                weight += contribution * w1 * w2
            end
        end
        return weight
    end

    # Helper function for inclusion-exclusion overlap calculation
    function calculate_ie_overlap(
        interval1::Tuple{Float64,Float64},
        interval2::Tuple{Float64,Float64},
        target::Tuple{Float64,Float64}
    )
        # Calculate overlap for inclusion-exclusion formula
        a_left, a_right = interval1
        b_left, b_right = interval2
        t_left, t_right = target
        
        # Use inclusion-exclusion formula: P(A ∪ B) = P(A) + P(B) - P(A ∩ B)
        union_left = a_left + b_left - (a_left * b_left)
        union_right = a_right + b_right - (a_right * b_right)
        
        overlap_left = max(t_left, union_left)
        overlap_right = min(t_right, union_right)
        
        if overlap_right <= overlap_left
            return 0.0
        end
        
        return (overlap_right - overlap_left) / (union_right - union_left)
    end
end