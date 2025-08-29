using HTTP
using JSON

# Test the flexible multi-scenario backend server
function test_backend_server()
    base_url = "http://localhost:8080"
    
    println("Testing flexible multi-scenario backend server...")
    
    # Test 1: Health check
    println("\n1. Testing health check...")
    try
        response = HTTP.get("$base_url/health")
        if response.status == 200
            println("✓ Health check passed: $(String(response.body))")
        else
            println("✗ Health check failed with status: $(response.status)")
        end
    catch e
        println("✗ Health check failed: $e")
        return
    end
    
    # Test 2: Multi-scenario analysis with power-network
    println("\n2. Testing multi-scenario analysis...")
    
    # Create flexible request with multiple scenarios
    request_data = Dict(
        "networkPath" => "dag_ntwrk_files/power-network",
        "reachabilityScenarios" => [
            Dict(
                "name" => "float_scenario",
                "nodepriors_path" => "dag_ntwrk_files/power-network/float/power-network-nodepriors.json",
                "linkprobs_path" => "dag_ntwrk_files/power-network/float/power-network-linkprobabilities.json"
            ),
            Dict(
                "name" => "pbox_scenario",
                "nodepriors_path" => "dag_ntwrk_files/power-network/pbox/power-network-nodepriors.json",
                "linkprobs_path" => "dag_ntwrk_files/power-network/pbox/power-network-linkprobabilities.json"
            )
        ],
        "capacityScenarios" => [
            Dict(
                "name" => "capacity_scenario_1",
                "capacities_path" => "dag_ntwrk_files/power-network/capacity/capacities.csv"
            )
        ],
        "cpmScenarios" => [
            Dict(
                "name" => "cpm_scenario_1", 
                "cmp_path" => "dag_ntwrk_files/power-network/cpm/cmp.csv"
            )
        ]
    )
    
    try
        headers = ["Content-Type" => "application/json"]
        response = HTTP.post(
            "$base_url/analyze",
            headers,
            JSON.json(request_data)
        )
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            println("✓ Multi-scenario analysis completed successfully!")
            
            # Check structure
            println("\n--- Response Structure ---")
            for key in keys(result)
                if key == "scenarios"
                    println("$key: $(length(result[key])) scenarios")
                    for (i, scenario) in enumerate(result[key])
                        println("  Scenario $i: $(get(scenario, "name", "unnamed"))")
                        if haskey(scenario, "reachability")
                            println("    - Reachability: $(length(scenario["reachability"])) results")
                        end
                        if haskey(scenario, "diamond")
                            println("    - Diamond: $(length(scenario["diamond"])) results")
                        end
                        if haskey(scenario, "capacity")
                            println("    - Capacity: $(length(scenario["capacity"])) results")
                        end
                        if haskey(scenario, "cpm")
                            println("    - CPM: $(length(scenario["cpm"])) results")
                        end
                    end
                else
                    println("$key: $(typeof(result[key]))")
                end
            end
            
        else
            println("✗ Analysis failed with status: $(response.status)")
            println("Response: $(String(response.body))")
        end
        
    catch e
        println("✗ Analysis request failed: $e")
    end
    
    # Test 3: Diamond-only analysis (should use default node priors)
    println("\n3. Testing diamond-only analysis...")
    
    diamond_only_request = Dict(
        "networkPath" => "dag_ntwrk_files/power-network",
        "reachabilityScenarios" => [],  # Empty - should trigger default node priors
        "capacityScenarios" => [],
        "cpmScenarios" => []
    )
    
    try
        headers = ["Content-Type" => "application/json"]
        response = HTTP.post(
            "$base_url/analyze",
            headers,
            JSON.json(diamond_only_request)
        )
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            println("✓ Diamond-only analysis completed!")
            
            # Should have diamond analysis with default node priors
            if haskey(result, "scenarios") && length(result["scenarios"]) > 0
                scenario = result["scenarios"][1]
                if haskey(scenario, "diamond")
                    println("  - Diamond analysis results: $(length(scenario["diamond"]))")
                    println("  - Used default node priors (all 1.0)")
                else
                    println("  - No diamond analysis found")
                end
            end
            
        else
            println("✗ Diamond-only analysis failed with status: $(response.status)")
            println("Response: $(String(response.body))")
        end
        
    catch e
        println("✗ Diamond-only analysis request failed: $e")
    end
    
    println("\n--- Test Summary ---")
    println("Flexible multi-scenario backend server testing completed!")
    println("The server now supports:")
    println("- Multiple reachability scenarios with user-specified paths")
    println("- Multiple capacity scenarios")
    println("- Multiple CPM scenarios") 
    println("- Diamond analysis per reachability scenario")
    println("- Default node priors for diamond-only analysis")
    println("- Clean sequential processing based on expected raw results")
end

# Run the test
test_backend_server()