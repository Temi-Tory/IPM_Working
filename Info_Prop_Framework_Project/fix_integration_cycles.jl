"""
Fix for the cycle issue in drone DAG integration
This script provides a corrected integration algorithm that maintains DAG properties
"""

using CSV, DataFrames

"""
Fixed integration algorithm that preserves DAG properties
"""
function fix_dag_integration(drone1_dag::Matrix{Int}, drone2_dag::Matrix{Int})
    println("🔧 FIXING DAG INTEGRATION ALGORITHM")
    println("="^50)
    
    n = size(drone1_dag, 1)
    
    # Start with the union of edges
    integrated_dag = max.(drone1_dag, drone2_dag)
    
    println("📊 Initial integration:")
    println("   Drone 1 edges: $(sum(drone1_dag))")
    println("   Drone 2 edges: $(sum(drone2_dag))")
    println("   Naive union edges: $(sum(integrated_dag))")
    
    # Find bidirectional edges
    bidirectional_edges = []
    for i in 1:n
        for j in (i+1):n
            if integrated_dag[i, j] == 1 && integrated_dag[j, i] == 1
                push!(bidirectional_edges, (i, j))
            end
        end
    end
    
    println("⚠️  Found $(length(bidirectional_edges)) bidirectional edges:")
    for (i, j) in bidirectional_edges
        println("   $i ↔ $j")
    end
    
    # Fix bidirectional edges using hierarchy-based resolution
    fixed_dag = copy(integrated_dag)
    edges_removed = 0
    
    for (i, j) in bidirectional_edges
        # Priority resolution strategy:
        # 1. If one drone has the edge and the other doesn't, keep that direction
        # 2. If both have conflicting directions, use node index priority (lower index → higher index)
        
        drone1_has_ij = drone1_dag[i, j] == 1
        drone1_has_ji = drone1_dag[j, i] == 1
        drone2_has_ij = drone2_dag[i, j] == 1
        drone2_has_ji = drone2_dag[j, i] == 1
        
        # Case 1: Only one drone has this edge pair
        if (drone1_has_ij || drone1_has_ji) && !(drone2_has_ij || drone2_has_ji)
            # Keep drone1's direction
            if drone1_has_ij
                fixed_dag[j, i] = 0  # Remove reverse direction
                println("   Fixed $i ↔ $j → $i → $j (drone1 priority)")
            else
                fixed_dag[i, j] = 0  # Remove reverse direction
                println("   Fixed $i ↔ $j → $j → $i (drone1 priority)")
            end
            edges_removed += 1
        elseif (drone2_has_ij || drone2_has_ji) && !(drone1_has_ij || drone1_has_ji)
            # Keep drone2's direction
            if drone2_has_ij
                fixed_dag[j, i] = 0  # Remove reverse direction
                println("   Fixed $i ↔ $j → $i → $j (drone2 priority)")
            else
                fixed_dag[i, j] = 0  # Remove reverse direction
                println("   Fixed $i ↔ $j → $j → $i (drone2 priority)")
            end
            edges_removed += 1
        else
            # Case 2: Both drones have conflicting directions - use node index priority
            if i < j
                fixed_dag[j, i] = 0  # Keep i → j direction
                println("   Fixed $i ↔ $j → $i → $j (index priority)")
            else
                fixed_dag[i, j] = 0  # Keep j → i direction
                println("   Fixed $i ↔ $j → $j → $i (index priority)")
            end
            edges_removed += 1
        end
    end
    
    println("✅ Fixed $(length(bidirectional_edges)) bidirectional edges")
    println("📉 Removed $edges_removed edges to maintain DAG property")
    println("📊 Final integrated DAG edges: $(sum(fixed_dag))")
    
    return fixed_dag
end

"""
Verify the fix works by testing on the problematic file
"""
function test_integration_fix()
    println("\n🧪 TESTING INTEGRATION FIX")
    println("="^50)
    
    # Load the individual DAG files
    drone1_file = "real_drone_dag_results/real_drone_network_Drone_1__High_Capability__Supply_Distribution_adjacency.csv"
    drone2_file = "real_drone_dag_results/real_drone_network_Drone_2__Low_Capability__Supply_Distribution_adjacency.csv"
    
    if !isfile(drone1_file) || !isfile(drone2_file)
        println("❌ Required DAG files not found")
        return
    end
    
    # Load matrices
    drone1_dag = Matrix{Int}(CSV.read(drone1_file, DataFrame))
    drone2_dag = Matrix{Int}(CSV.read(drone2_file, DataFrame))
    
    println("📁 Loaded individual DAG files")
    
    # Apply the fix
    fixed_integrated_dag = fix_dag_integration(drone1_dag, drone2_dag)
    
    # Verify the result is acyclic
    include("cycle_detection_validation.jl")
    has_cycles = has_cycles_dfs(fixed_integrated_dag)
    
    println("\n🔍 VERIFICATION:")
    println("   Has cycles: $has_cycles")
    
    if !has_cycles
        println("✅ SUCCESS: Fixed integrated DAG is acyclic!")
        
        # Save the corrected file
        output_file = "real_drone_dag_results/real_drone_network_integrated_adjacency_FIXED.csv"
        CSV.write(output_file, DataFrame(fixed_integrated_dag, :auto))
        println("💾 Saved corrected file: $output_file")
    else
        println("❌ FAILURE: Fixed DAG still contains cycles")
        cycles = find_cycles(fixed_integrated_dag)
        println("   Remaining cycles: $(length(cycles))")
    end
    
    return fixed_integrated_dag
end

# Run the test
println("Testing integration fix...")
fixed_dag = test_integration_fix()