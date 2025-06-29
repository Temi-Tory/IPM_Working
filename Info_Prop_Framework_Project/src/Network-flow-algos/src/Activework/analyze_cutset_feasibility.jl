"""
    Analyze Cutset Feasibility

    Investigate why the cutset algorithm is failing to find complete solutions
    and understand the diamond pattern coverage problem.
"""

include("Algorithms/InputProcessingModule.jl")
include("Algorithms/NetworkDecompositionModule.jl")
include("Algorithms/DiamondCutsetModule.jl")

using .DiamondCutsetModule
using .NetworkDecompositionModule

# Diamond structure for node 16 (the complex one)
diamond_16_edges = [
    (2, 6), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (13, 9), (13, 14), (14, 15), (15, 16)
]

function analyze_diamond_16_feasibility()
    println("=== Analyzing Diamond 16 Cutset Feasibility ===")
    
    # Build graph structure
    graph_data = DiamondCutsetModule.build_graph_structure(diamond_16_edges, 16)
    
    println("Graph structure:")
    println("  Sources: $(graph_data.source_nodes)")
    println("  Sink: $(graph_data.sink_node)")
    println("  All nodes: $(Set(vcat([e[1] for e in diamond_16_edges], [e[2] for e in diamond_16_edges])))")
    
    # Find all diamond patterns
    diamond_patterns = DiamondCutsetModule.find_all_diamond_patterns(graph_data)
    println("\nDiamond patterns found: $(length(diamond_patterns))")
    for (i, (fork, join)) in enumerate(diamond_patterns)
        println("  $i. Fork $fork → Join $join")
    end
    
    # Identify candidate nodes (excluding sources and sink)
    all_nodes = Set{Int64}()
    for (i, j) in diamond_16_edges
        push!(all_nodes, i)
        push!(all_nodes, j)
    end
    
    excluded_nodes = union(graph_data.source_nodes, Set([graph_data.sink_node]))
    candidate_nodes = setdiff(all_nodes, excluded_nodes)
    
    println("\nCutset candidates (excluding sources and sink):")
    println("  Excluded: $excluded_nodes")
    println("  Candidates: $candidate_nodes")
    
    # Build coverage map manually
    println("\nCoverage analysis:")
    coverage_map = Dict{Int64, Set{Tuple{Int64, Int64}}}()
    
    for node in candidate_nodes
        covered_patterns = Set{Tuple{Int64, Int64}}()
        
        for (fork, join) in diamond_patterns
            if DiamondCutsetModule.breaks_diamond_pattern(node, fork, join, graph_data)
                push!(covered_patterns, (fork, join))
            end
        end
        
        if !isempty(covered_patterns)
            coverage_map[node] = covered_patterns
            println("  Node $node covers $(length(covered_patterns)) patterns: $covered_patterns")
        else
            println("  Node $node covers 0 patterns")
        end
    end
    
    # Check if all patterns can be covered
    all_covered_patterns = Set{Tuple{Int64, Int64}}()
    for patterns in values(coverage_map)
        union!(all_covered_patterns, patterns)
    end
    
    uncoverable_patterns = setdiff(diamond_patterns, all_covered_patterns)
    
    println("\nFeasibility analysis:")
    println("  Total patterns: $(length(diamond_patterns))")
    println("  Coverable patterns: $(length(all_covered_patterns))")
    println("  Uncoverable patterns: $(length(uncoverable_patterns))")
    
    if !isempty(uncoverable_patterns)
        println("  PROBLEM: These patterns cannot be covered by any candidate node:")
        for (fork, join) in uncoverable_patterns
            println("    Fork $fork → Join $join")
            
            # Analyze why this pattern is uncoverable
            println("      Analysis:")
            for node in candidate_nodes
                can_break = DiamondCutsetModule.breaks_diamond_pattern(node, fork, join, graph_data)
                node_ancestors = get(graph_data.ancestors, node, Set{Int64}())
                node_descendants = get(graph_data.descendants, node, Set{Int64}())
                is_between = (fork in node_ancestors || fork == node) && 
                           (join in node_descendants || join == node)
                can_reach_without = DiamondCutsetModule.can_reach_without_node(fork, join, node, graph_data)
                
                println("        Node $node: between=$is_between, can_reach_without=$can_reach_without, breaks=$can_break")
            end
        end
    else
        println("  All patterns are coverable - set cover should find solution")
    end
    
    # Try manual greedy set cover
    println("\nManual greedy set cover:")
    remaining_patterns = copy(diamond_patterns)
    cutset = Set{Int64}()
    iteration = 0
    
    while !isempty(remaining_patterns) && iteration < 10
        iteration += 1
        println("  Iteration $iteration:")
        println("    Remaining patterns: $(length(remaining_patterns))")
        
        # Find best node
        best_node = nothing
        max_coverage = 0
        
        for (node, patterns) in coverage_map
            coverage_count = length(intersect(patterns, remaining_patterns))
            if coverage_count > max_coverage
                max_coverage = coverage_count
                best_node = node
            end
        end
        
        if best_node === nothing || max_coverage == 0
            println("    STUCK: No node can cover remaining patterns")
            break
        end
        
        push!(cutset, best_node)
        covered = coverage_map[best_node]
        setdiff!(remaining_patterns, covered)
        delete!(coverage_map, best_node)
        
        println("    Selected node $best_node (covers $max_coverage patterns)")
        println("    Current cutset: $cutset")
    end
    
    if isempty(remaining_patterns)
        println("  SUCCESS: Found complete cutset: $cutset")
        println("  Cutset size: $(length(cutset))")
        println("  Complexity: 2^$(length(cutset)) = $(2^length(cutset)) states")
    else
        println("  FAILURE: Could not cover all patterns")
        println("  Remaining uncovered: $remaining_patterns")
    end
end

function run_feasibility_analysis()
    println("Cutset Feasibility Analysis")
    println("=" ^ 50)
    
    analyze_diamond_16_feasibility()
    
    println("\n" * "=" ^ 50)
    println("Analysis complete!")
end

# Run analysis
if abspath(PROGRAM_FILE) == @__FILE__
    run_feasibility_analysis()
end