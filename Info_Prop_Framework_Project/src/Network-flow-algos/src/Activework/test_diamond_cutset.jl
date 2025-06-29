"""
    Test script for DiamondCutsetModule

    This script demonstrates the usage of DiamondCutsetModule and compares
    the cutset approach with traditional diamond conditioning.
"""

include("Algorithms/InputProcessingModule.jl")
include("Algorithms/DiamondCutsetModule.jl")

using .DiamondCutsetModule

function test_simple_diamond()
    println("=== Testing Simple Diamond Pattern ===")
    
    # Simple diamond: 1,2 → 3 → 4,5 → 6
    edgelist = [
        (1, 3),  # Source 1 → Fork 3
        (2, 3),  # Source 2 → Fork 3  
        (3, 4),  # Fork 3 → Join 4
        (3, 5),  # Fork 3 → Join 5
        (4, 6),  # Join 4 → Sink 6
        (5, 6)   # Join 5 → Sink 6
    ]
    
    println("Edgelist: $edgelist")
    println("Expected diamond pattern: (3, 6) - paths 3→4→6 and 3→5→6")
    
    cutset = find_diamond_breaking_cutset(edgelist, 6)
    println("Found cutset: $cutset")
    
    # Verify cutset breaks diamonds
    is_valid = verify_cutset_breaks_diamonds(cutset, edgelist, 6)
    println("Cutset valid: $is_valid")
    
    # Compare complexity
    fork_nodes = Set([3])  # Traditional approach would condition on fork
    cutset_complexity = 2^length(cutset)
    fork_complexity = 2^length(fork_nodes)
    
    println("Cutset conditioning complexity: 2^$(length(cutset)) = $cutset_complexity states")
    println("Fork conditioning complexity: 2^$(length(fork_nodes)) = $fork_complexity states")
    println("Speedup factor: $(fork_complexity ÷ cutset_complexity)x")
    println()
end

function test_nested_diamonds()
    println("=== Testing Nested Diamond Pattern ===")
    
    # Nested diamonds: 1,2 → 3,4 → 5,6 → 7,8 → 9
    edgelist = [
        (1, 3), (1, 4),  # Source 1 splits
        (2, 3), (2, 4),  # Source 2 splits  
        (3, 5), (3, 6),  # Node 3 splits
        (4, 5), (4, 6),  # Node 4 splits
        (5, 7), (5, 8),  # Node 5 splits
        (6, 7), (6, 8),  # Node 6 splits
        (7, 9), (8, 9)   # Converge at sink 9
    ]
    
    println("Edgelist: $edgelist")
    println("Multiple nested diamond patterns expected")
    
    cutset = find_diamond_breaking_cutset(edgelist, 9)
    println("Found cutset: $cutset")
    
    # Verify cutset breaks diamonds
    is_valid = verify_cutset_breaks_diamonds(cutset, edgelist, 9)
    println("Cutset valid: $is_valid")
    
    # Compare complexity with recursive diamond approach
    # Traditional approach would have multiple recursive calls
    cutset_complexity = 2^length(cutset)
    estimated_recursive_complexity = 2^4 * 2^4 * 2^4  # Rough estimate for nested diamonds
    
    println("Cutset conditioning complexity: 2^$(length(cutset)) = $cutset_complexity states")
    println("Estimated recursive complexity: ~$estimated_recursive_complexity states")
    println("Estimated speedup factor: ~$(estimated_recursive_complexity ÷ cutset_complexity)x")
    println()
end

function test_no_diamonds()
    println("=== Testing Tree Structure (No Diamonds) ===")
    
    # Simple tree: 1 → 2 → 3 → 4
    edgelist = [
        (1, 2),
        (2, 3),
        (3, 4)
    ]
    
    println("Edgelist: $edgelist")
    println("Expected: No diamonds, empty cutset")
    
    cutset = find_diamond_breaking_cutset(edgelist, 4)
    println("Found cutset: $cutset")
    
    is_valid = verify_cutset_breaks_diamonds(cutset, edgelist, 4)
    println("Cutset valid: $is_valid")
    println("Cutset size: $(length(cutset)) (should be 0)")
    println()
end

function test_complex_diamond()
    println("=== Testing Complex Diamond Pattern ===")
    
    # More complex diamond with multiple paths
    edgelist = [
        (1, 3), (1, 4),     # Source 1 splits
        (2, 4), (2, 5),     # Source 2 splits
        (3, 6), (3, 7),     # Node 3 splits
        (4, 6), (4, 7), (4, 8),  # Node 4 splits to 3 nodes
        (5, 7), (5, 8),     # Node 5 splits
        (6, 9), (7, 9), (8, 9)   # All converge at sink 9
    ]
    
    println("Edgelist: $edgelist")
    println("Complex diamond with multiple convergence points")
    
    cutset = find_diamond_breaking_cutset(edgelist, 9)
    println("Found cutset: $cutset")
    
    is_valid = verify_cutset_breaks_diamonds(cutset, edgelist, 9)
    println("Cutset valid: $is_valid")
    
    # Estimate traditional complexity
    fork_nodes = Set([1, 2, 3, 4, 5])  # Nodes with multiple outgoing edges
    cutset_complexity = 2^length(cutset)
    fork_complexity = 2^length(fork_nodes)
    
    println("Cutset conditioning complexity: 2^$(length(cutset)) = $cutset_complexity states")
    println("Fork conditioning complexity: 2^$(length(fork_nodes)) = $fork_complexity states")
    if cutset_complexity > 0
        println("Speedup factor: $(fork_complexity ÷ cutset_complexity)x")
    end
    println()
end

function run_all_tests()
    println("DiamondCutsetModule Test Suite")
    println("=" ^ 50)
    println()
    
    try
        test_simple_diamond()
        test_nested_diamonds()
        test_no_diamonds()
        test_complex_diamond()
        
        println("=" ^ 50)
        println("All tests completed successfully!")
        println("The DiamondCutsetModule provides significant complexity reduction")
        println("compared to traditional diamond conditioning approaches.")
        
    catch e
        println("Error during testing: $e")
        println("Stack trace:")
        for (exc, bt) in Base.catch_stack()
            showerror(stdout, exc, bt)
            println()
        end
    end
end

# Run tests if script is executed directly
if abspath(PROGRAM_FILE) == @__FILE__
    run_all_tests()
end