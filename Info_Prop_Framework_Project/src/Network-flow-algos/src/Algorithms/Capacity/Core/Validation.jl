# Core/Validation.jl
# Mathematical correctness verification for capacity analysis results
# Validates flow conservation, capacity constraints, and optimality

if !isdefined(@__MODULE__, :NetworkTopology)
    include("Types.jl")
end

"""
Validate capacity analysis results for mathematical correctness

# Arguments
- `result`: CapacityAnalysisResult to validate
- `problem`: BasicCapacityProblem with input constraints

# Returns
- ValidationReport with detailed verification results
"""
function validate_capacity_result(
    result::CapacityAnalysisResult{Float64},
    problem::BasicCapacityProblem
)
    warnings = String[]
    errors = String[]
    
    # Extract data
    topology = problem.topology
    node_flows = result.node_flows
    edge_flows = result.edge_flows
    node_capacities = problem.node_capacities
    edge_capacities = problem.edge_capacities
    source_rates = problem.source_rates
    target_nodes = problem.target_nodes
    
    tolerance = 1e-10
    
    # === 1. FLOW CONSERVATION CHECK ===
    conservation_violations = Tuple{Int64, Float64}[]
    max_conservation_error = 0.0
    
    # Get all nodes
    all_nodes = Set{Int64}()
    for iteration_set in topology.iteration_sets
        union!(all_nodes, iteration_set)
    end
    
    for node in all_nodes
        # Skip sources and targets for conservation
        if node in topology.source_nodes || node in target_nodes
            continue
        end
        
        # Calculate incoming flow
        incoming = 0.0
        if haskey(topology.incoming_index, node)
            for source_node in topology.incoming_index[node]
                edge = (source_node, node)
                incoming += get(edge_flows, edge, 0.0)
            end
        end
        
        # Calculate outgoing flow
        outgoing = 0.0
        if haskey(topology.outgoing_index, node)
            for target_node in topology.outgoing_index[node]
                edge = (node, target_node)
                outgoing += get(edge_flows, edge, 0.0)
            end
        end
        
        # Check conservation
        violation = abs(incoming - outgoing)
        if violation > tolerance
            push!(conservation_violations, (node, violation))
            max_conservation_error = max(max_conservation_error, violation)
            push!(errors, "Flow conservation violated at node $node: |incoming - outgoing| = $violation")
        else
            max_conservation_error = max(max_conservation_error, violation)
        end
    end
    
    flow_conservation_satisfied = isempty(conservation_violations)
    
    # === 2. CAPACITY CONSTRAINTS CHECK ===
    capacity_violations = Tuple{Union{Int64, Tuple{Int64,Int64}}, Float64}[]
    
    # Check edge capacities
    for (edge, flow) in edge_flows
        capacity = get(edge_capacities, edge, Inf)
        if !isinf(capacity)
            violation = max(0.0, flow - capacity)
            if violation > tolerance
                push!(capacity_violations, (edge, violation))
                push!(errors, "Edge capacity violated at $(edge): flow $flow > capacity $capacity")
            end
        end
    end
    
    # Check node capacities
    for (node, flow) in node_flows
        capacity = get(node_capacities, node, Inf)
        if !isinf(capacity)
            violation = max(0.0, flow - capacity)
            if violation > tolerance
                push!(capacity_violations, (node, violation))
                push!(errors, "Node capacity violated at node $node: flow $flow > capacity $capacity")
            end
        end
    end
    
    capacity_constraints_satisfied = isempty(capacity_violations)
    
    # === 3. CONSISTENCY CHECKS ===
    total_source_rate = sum(values(source_rates))
    total_target_flow = sum(get(node_flows, target, 0.0) for target in target_nodes)
    
    # Flow can't exceed source rate
    if total_target_flow > total_source_rate + tolerance
        push!(warnings, "Target flow ($total_target_flow) exceeds source rate ($total_source_rate)")
    end
    
    flow_balance_satisfied = abs(total_target_flow - result.total_max_flow) < tolerance
    if !flow_balance_satisfied
        push!(errors, "Flow balance check failed: target flows sum to $total_target_flow but total_max_flow is $(result.total_max_flow)")
    end
    
    # === 4. OPTIMALITY VERIFICATION ===
    # Max-Flow Min-Cut Theorem: max_flow should equal min_cut_capacity
    min_cut_capacity = result.bottlenecks.min_cut_capacity
    max_flow_value = result.total_max_flow
    
    optimality_verified = abs(max_flow_value - min_cut_capacity) < tolerance
    if !optimality_verified
        push!(warnings, "Optimality check: max_flow ($max_flow_value) ≠ min_cut ($min_cut_capacity)")
        push!(warnings, "Difference: $(abs(max_flow_value - min_cut_capacity))")
    end
    
    # === SUMMARY ===
    all_checks_passed = (
        flow_conservation_satisfied &&
        capacity_constraints_satisfied &&
        flow_balance_satisfied &&
        optimality_verified
    )
    
    if all_checks_passed
        push!(warnings, "All validation checks passed ✓")
    else
        push!(errors, "Validation failed: $(length(errors)) errors found")
    end
    
    # Build report
    return ValidationReport(
        all_checks_passed,
        flow_conservation_satisfied,
        conservation_violations,
        max_conservation_error,
        capacity_constraints_satisfied,
        capacity_violations,
        total_source_rate,
        total_target_flow,
        flow_balance_satisfied,
        optimality_verified,
        min_cut_capacity,
        max_flow_value,
        warnings,
        errors
    )
end

"""
Quick validation check - returns true if all critical checks pass
"""
function quick_validate(
    result::CapacityAnalysisResult{Float64},
    problem::BasicCapacityProblem
)::Bool
    report = validate_capacity_result(result, problem)
    return report.all_checks_passed
end

"""
Print validation report in human-readable format
"""
function print_validation_report(report::ValidationReport)
    println("=" ^ 60)
    println("CAPACITY ANALYSIS VALIDATION REPORT")
    println("=" ^ 60)
    
    status = report.all_checks_passed ? "✓ PASSED" : "✗ FAILED"
    println("Overall Status: $status")
    println()
    
    println("Flow Conservation:")
    if report.flow_conservation_satisfied
        println("  ✓ All nodes satisfy conservation")
        println("  Max error: $(report.max_conservation_error)")
    else
        println("  ✗ $(length(report.conservation_violations)) violations found")
        for (node, violation) in report.conservation_violations
            println("    Node $node: error = $violation")
        end
    end
    println()
    
    println("Capacity Constraints:")
    if report.capacity_constraints_satisfied
        println("  ✓ All flows within capacity limits")
    else
        println("  ✗ $(length(report.capacity_violations)) violations found")
        for (component, violation) in report.capacity_violations
            println("    $component: exceeds capacity by $violation")
        end
    end
    println()
    
    println("Flow Balance:")
    println("  Source rate: $(report.total_source_rate)")
    println("  Target flow: $(report.total_target_flow)")
    if report.flow_balance_satisfied
        println("  ✓ Balanced")
    else
        println("  ✗ Imbalanced")
    end
    println()
    
    println("Optimality (Max-Flow Min-Cut):")
    println("  Max flow: $(report.max_flow_value)")
    println("  Min cut:  $(report.min_cut_capacity)")
    diff = abs(report.max_flow_value - report.min_cut_capacity)
    if report.optimality_verified
        println("  ✓ Verified (diff: $diff)")
    else
        println("  ✗ Not verified (diff: $diff)")
    end
    println()
    
    if !isempty(report.warnings)
        println("Warnings:")
        for warning in report.warnings
            println("  ⚠ $warning")
        end
        println()
    end
    
    if !isempty(report.errors)
        println("Errors:")
        for error in report.errors
            println("  ✗ $error")
        end
        println()
    end
    
    println("=" ^ 60)
end

# Export functions
export validate_capacity_result, quick_validate, print_validation_report
