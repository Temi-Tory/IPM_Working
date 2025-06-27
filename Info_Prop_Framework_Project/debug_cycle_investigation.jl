"""
Debug script to investigate cycle issues in drone DAG files
This script will systematically check for cycles and diagnose the root cause
"""

using CSV, DataFrames

# Include the cycle detection functions
include("cycle_detection_validation.jl")

"""
Enhanced cycle detection with detailed logging
"""
function investigate_cycle_sources()
    println("🔍 COMPREHENSIVE CYCLE INVESTIGATION")
    println("="^60)
    
    # List of files to check
    files_to_check = [
        "real_drone_dag_results/real_drone_network_integrated_adjacency.csv",
        "real_drone_dag_results/real_drone_network_Drone_1__High_Capability__Emergency_Response_adjacency.csv",
        "real_drone_dag_results/real_drone_network_Drone_1__High_Capability__Supply_Distribution_adjacency.csv",
        "real_drone_dag_results/real_drone_network_Drone_2__Low_Capability__Emergency_Response_adjacency.csv"
    ]
    
    results = Dict()
    
    for file_path in files_to_check
        println("\n" * "="^60)
        println("📁 ANALYZING: $file_path")
        println("="^60)
        
        if !isfile(file_path)
            println("❌ File not found: $file_path")
            continue
        end
        
        try
            # Load and analyze the matrix
            df = CSV.read(file_path, DataFrame)
            adj_matrix = Matrix{Int}(df)
            
            println("📊 Matrix dimensions: $(size(adj_matrix))")
            
            # Basic structure analysis
            total_edges = sum(adj_matrix)
            is_symmetric = adj_matrix == adj_matrix'
            diagonal_sum = sum(adj_matrix[i, i] for i in 1:size(adj_matrix, 1))
            
            println("📈 Total edges: $total_edges")
            println("🔄 Is symmetric (undirected): $is_symmetric")
            println("🔁 Self-loops: $diagonal_sum")
            
            # Detailed cycle detection
            has_cycles = has_cycles_dfs(adj_matrix)
            println("🌀 Has cycles (DFS): $has_cycles")
            
            if has_cycles
                # Find specific cycles
                cycles = find_cycles(adj_matrix)
                println("🎯 Number of cycles found: $(length(cycles))")
                
                # Show first few cycles with details
                for (i, cycle) in enumerate(cycles[1:min(3, length(cycles))])
                    println("   Cycle $i: $(join(cycle, " → "))")
                    
                    # Check if it's a simple bidirectional edge
                    if length(cycle) == 3 && cycle[1] == cycle[3]
                        node1, node2 = cycle[1], cycle[2]
                        if adj_matrix[node1, node2] == 1 && adj_matrix[node2, node1] == 1
                            println("     ⚠️  This is a bidirectional edge: $node1 ↔ $node2")
                        end
                    end
                end
                
                # Check for bidirectional edges specifically
                bidirectional_edges = find_bidirectional_edges(adj_matrix)
                println("↔️  Bidirectional edges found: $(length(bidirectional_edges))")
                
                if length(bidirectional_edges) > 0
                    println("   First 5 bidirectional edges:")
                    for (i, (u, v)) in enumerate(bidirectional_edges[1:min(5, length(bidirectional_edges))])
                        println("     $u ↔ $v")
                    end
                end
            end
            
            # Store results
            results[file_path] = Dict(
                "has_cycles" => has_cycles,
                "is_symmetric" => is_symmetric,
                "total_edges" => total_edges,
                "self_loops" => diagonal_sum,
                "cycle_count" => has_cycles ? length(find_cycles(adj_matrix)) : 0,
                "bidirectional_count" => length(find_bidirectional_edges(adj_matrix))
            )
            
        catch e
            println("❌ Error analyzing $file_path: $e")
            results[file_path] = Dict("error" => string(e))
        end
    end
    
    # Summary analysis
    println("\n" * "="^60)
    println("📋 SUMMARY ANALYSIS")
    println("="^60)
    
    files_with_cycles = 0
    files_symmetric = 0
    total_files = 0
    
    for (file, result) in results
        if haskey(result, "error")
            continue
        end
        
        total_files += 1
        if result["has_cycles"]
            files_with_cycles += 1
        end
        if result["is_symmetric"]
            files_symmetric += 1
        end
        
        println("📄 $(basename(file)):")
        println("   Cycles: $(result["has_cycles"]) | Symmetric: $(result["is_symmetric"]) | Bidirectional: $(result["bidirectional_count"])")
    end
    
    println("\n🔍 ROOT CAUSE ANALYSIS:")
    if files_symmetric == total_files
        println("❌ ISSUE: All matrices are symmetric (undirected graphs)")
        println("   This means the DAG conversion process is not working properly.")
        println("   Undirected graphs inherently contain cycles in any connected component.")
    end
    
    if files_with_cycles == total_files
        println("❌ ISSUE: All files contain cycles")
        println("   The DAG conversion algorithm is failing to remove cycles.")
    end
    
    println("\n💡 RECOMMENDED FIXES:")
    println("1. Check the DAG conversion algorithm in DroneNetworkDagModule")
    println("2. Verify that edges are being properly directed (not bidirectional)")
    println("3. Ensure cycle removal logic is actually executing")
    println("4. Validate the hierarchy-based edge direction assignment")
    
    return results
end

# Run the investigation
println("Starting comprehensive cycle investigation...")
results = investigate_cycle_sources()

println("\n🎉 Investigation complete!")