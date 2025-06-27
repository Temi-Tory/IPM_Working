"""
Cycle Detection Validation Script for Drone DAG
This script implements multiple cycle detection algorithms to validate 
whether the generated drone DAG actually contains cycles.
"""

using CSV, DataFrames

"""
Depth-First Search based cycle detection for directed graphs
Returns true if cycles are found, false otherwise
"""
function has_cycles_dfs(adj_matrix::Matrix{Int})
    n = size(adj_matrix, 1)
    
    # 0 = unvisited, 1 = visiting, 2 = visited
    state = zeros(Int, n)
    
    function dfs(node::Int)
        if state[node] == 1  # Currently visiting - cycle detected
            return true
        end
        if state[node] == 2  # Already visited
            return false
        end
        
        state[node] = 1  # Mark as visiting
        
        # Check all neighbors
        for neighbor in 1:n
            if adj_matrix[node, neighbor] == 1
                if dfs(neighbor)
                    return true
                end
            end
        end
        
        state[node] = 2  # Mark as visited
        return false
    end
    
    # Check each unvisited node
    for i in 1:n
        if state[i] == 0
            if dfs(i)
                return true
            end
        end
    end
    
    return false
end

"""
Find all cycles in the graph and return specific cycle paths
"""
function find_cycles(adj_matrix::Matrix{Int})
    n = size(adj_matrix, 1)
    cycles = Vector{Vector{Int}}()
    
    # 0 = unvisited, 1 = visiting, 2 = visited
    state = zeros(Int, n)
    path = Int[]
    
    function dfs(node::Int)
        if state[node] == 1  # Cycle detected
            # Find the cycle in the current path
            cycle_start = findfirst(x -> x == node, path)
            if cycle_start !== nothing
                cycle = path[cycle_start:end]
                push!(cycle, node)  # Complete the cycle
                push!(cycles, copy(cycle))
            end
            return
        end
        if state[node] == 2  # Already visited
            return
        end
        
        state[node] = 1  # Mark as visiting
        push!(path, node)
        
        # Check all neighbors
        for neighbor in 1:n
            if adj_matrix[node, neighbor] == 1
                dfs(neighbor)
            end
        end
        
        pop!(path)
        state[node] = 2  # Mark as visited
    end
    
    # Check each unvisited node
    for i in 1:n
        if state[i] == 0
            dfs(i)
        end
    end
    
    return cycles
end

"""
Check for bidirectional edges (which create 2-cycles in directed graphs)
"""
function find_bidirectional_edges(adj_matrix::Matrix{Int})
    n = size(adj_matrix, 1)
    bidirectional_edges = Vector{Tuple{Int, Int}}()
    
    for i in 1:n
        for j in (i+1):n  # Only check upper triangle to avoid duplicates
            if adj_matrix[i, j] == 1 && adj_matrix[j, i] == 1
                push!(bidirectional_edges, (i, j))
            end
        end
    end
    
    return bidirectional_edges
end

"""
Analyze the adjacency matrix structure
"""
function analyze_matrix_structure(adj_matrix::Matrix{Int})
    n = size(adj_matrix, 1)
    total_edges = sum(adj_matrix)
    
    # Check if matrix is symmetric (undirected graph)
    is_symmetric = adj_matrix == adj_matrix'
    
    # Count self-loops
    self_loops = sum(adj_matrix[i, i] for i in 1:n)
    
    # Count bidirectional edges
    bidirectional_count = length(find_bidirectional_edges(adj_matrix))
    
    return (
        total_edges = total_edges,
        is_symmetric = is_symmetric,
        self_loops = self_loops,
        bidirectional_edges = bidirectional_count
    )
end

"""
Main validation function
"""
function validate_dag_acyclicity(csv_file_path::String)
    println("🔍 CYCLE DETECTION VALIDATION")
    println("="^50)
    
    # Load the adjacency matrix
    println("📁 Loading adjacency matrix from: $csv_file_path")
    
    try
        df = CSV.read(csv_file_path, DataFrame)
        adj_matrix = Matrix{Int}(df)
        
        println("✅ Matrix loaded successfully")
        println("📊 Matrix size: $(size(adj_matrix))")
        
        # Analyze matrix structure
        println("\n🔬 MATRIX STRUCTURE ANALYSIS")
        println("-"^30)
        structure = analyze_matrix_structure(adj_matrix)
        println("Total edges: $(structure.total_edges)")
        println("Is symmetric (undirected): $(structure.is_symmetric)")
        println("Self-loops: $(structure.self_loops)")
        println("Bidirectional edges: $(structure.bidirectional_edges)")
        
        # Check for cycles using DFS
        println("\n🌀 CYCLE DETECTION")
        println("-"^30)
        has_cycles = has_cycles_dfs(adj_matrix)
        println("Has cycles (DFS): $has_cycles")
        
        # Find specific cycles
        if has_cycles
            println("\n🎯 FINDING SPECIFIC CYCLES")
            println("-"^30)
            cycles = find_cycles(adj_matrix)
            println("Number of cycles found: $(length(cycles))")
            
            # Show first few cycles
            for (i, cycle) in enumerate(cycles[1:min(5, length(cycles))])
                println("Cycle $i: $(join(cycle, " → "))")
            end
            
            if length(cycles) > 5
                println("... and $(length(cycles) - 5) more cycles")
            end
        end
        
        # Check for bidirectional edges specifically
        println("\n↔️  BIDIRECTIONAL EDGE ANALYSIS")
        println("-"^30)
        bidirectional_edges = find_bidirectional_edges(adj_matrix)
        println("Number of bidirectional edges: $(length(bidirectional_edges))")
        
        if length(bidirectional_edges) > 0
            println("First 10 bidirectional edges:")
            for (i, (u, v)) in enumerate(bidirectional_edges[1:min(10, length(bidirectional_edges))])
                println("  $u ↔ $v")
            end
            
            if length(bidirectional_edges) > 10
                println("  ... and $(length(bidirectional_edges) - 10) more")
            end
        end
        
        # Final assessment
        println("\n📋 FINAL ASSESSMENT")
        println("-"^30)
        if structure.is_symmetric
            println("❌ ISSUE: Matrix is symmetric (undirected graph)")
            println("   This inherently creates cycles in any connected graph")
        end
        
        if structure.bidirectional_edges > 0
            println("❌ ISSUE: $(structure.bidirectional_edges) bidirectional edges found")
            println("   Each bidirectional edge creates a 2-cycle")
        end
        
        if structure.self_loops > 0
            println("❌ ISSUE: $(structure.self_loops) self-loops found")
            println("   Self-loops are 1-cycles")
        end
        
        if has_cycles
            println("❌ CONCLUSION: Graph contains cycles - NOT a DAG")
        else
            println("✅ CONCLUSION: No cycles detected - Valid DAG")
        end
        
        return (
            has_cycles = has_cycles,
            cycle_count = has_cycles ? length(find_cycles(adj_matrix)) : 0,
            bidirectional_edges = length(bidirectional_edges),
            is_symmetric = structure.is_symmetric
        )
        
    catch e
        println("❌ Error loading or analyzing matrix: $e")
        return nothing
    end
end

# Run the validation
if length(ARGS) > 0
    csv_file = ARGS[1]
else
    csv_file = "real_drone_dag_results/real_drone_network_integrated_adjacency.csv"
end

println("Starting cycle detection validation...")
result = validate_dag_acyclicity(csv_file)

if result !== nothing
    println("\n" * "="^50)
    println("VALIDATION COMPLETE")
    println("Has cycles: $(result.has_cycles)")
    println("Cycle count: $(result.cycle_count)")
    println("Bidirectional edges: $(result.bidirectional_edges)")
    println("Is symmetric: $(result.is_symmetric)")
end