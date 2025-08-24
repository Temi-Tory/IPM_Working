# Test script for the backend server

include("backend_server.jl")

# Test with existing network data
function test_server_locally()
    println("Testing server functions locally...")
    
    # Test with KarlNetwork
    network_path = joinpath(@__DIR__, "..", "..", "dag_ntwrk_files", "KarlNetwork")
    
    println("Testing network analysis...")
    results = process_network_analysis(network_path, "float")
    
    if results["success"]
        println("✅ Analysis successful!")
        println("Network: $(results["network_name"])")
        
        if haskey(results["results"], "network_structure")
            ns = results["results"]["network_structure"]
            println("  • Nodes: $(ns["total_nodes"]), Edges: $(ns["total_edges"])")
        end
        
        if haskey(results["results"], "reachability")
            r = results["results"]["reachability"]
            println("  • Reachability analysis completed in $(round(r["execution_time"], digits=3))s")
        end
        
        if haskey(results["results"], "capacity")
            c = results["results"]["capacity"]
            println("  • Capacity analysis completed in $(round(c["execution_time"], digits=3))s")
            println("  • Network utilization: $(round(c["network_utilization"], digits=3))")
        end
        
        if haskey(results["results"], "critical_path")
            cp = results["results"]["critical_path"]
            println("  • Critical path analysis completed in $(round(cp["execution_time"], digits=3))s")
            println("  • Critical duration: $(round(cp["time_analysis"]["critical_duration"], digits=2))h")
            println("  • Total cost: £$(round(cp["cost_analysis"]["total_cost"], digits=2))")
        end
        
    else
        println("❌ Analysis failed: $(results["error"])")
    end
    
    return results
end

# Run local test
if abspath(PROGRAM_FILE) == @__FILE__
    test_server_locally()
end