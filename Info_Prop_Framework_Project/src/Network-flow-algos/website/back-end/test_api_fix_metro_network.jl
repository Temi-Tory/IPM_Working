#!/usr/bin/env julia

"""
Comprehensive test to verify all debugging fixes work with real metro network data
"""

using HTTP, JSON

# Load the actual metro network data
function load_metro_data(prob_type::String)
    # Read edge file
    edge_content = read("dag_ntwrk_files/metro_directed_dag_for_ipm/metro_directed_dag_for_ipm.edge", String)
    
    # Read node priors
    node_priors_content = read("dag_ntwrk_files/metro_directed_dag_for_ipm/$prob_type/metro_directed_dag_for_ipm-nodepriors.json", String)
    node_priors = JSON.parse(node_priors_content)
    
    # Read edge probabilities  
    edge_probs_content = read("dag_ntwrk_files/metro_directed_dag_for_ipm/$prob_type/metro_directed_dag_for_ipm-linkprobabilities.json", String)
    edge_probs = JSON.parse(edge_probs_content)
    
    return Dict(
        "csvContent" => edge_content,
        "nodePriors" => node_priors,
        "edgeProbabilities" => edge_probs
    )
end

function test_endpoint(endpoint::String, data::Dict, prob_type::String)
    println("🧪 Testing $endpoint with $prob_type data...")
    
    try
        response = HTTP.post(
            "http://localhost:9090/api/$endpoint",
            ["Content-Type" => "application/json"],
            JSON.json(data),
            readtimeout=30  # 30 second timeout
        )
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            println("✅ $endpoint ($prob_type) successful!")
            
            # Extract key metrics
            if haskey(result, "data")
                data_section = result["data"]
                if haskey(data_section, "diamondData")
                    diamond_count = get(data_section["diamondData"], "diamondCount", 0)
                    println("   Diamond count: $diamond_count")
                end
                if haskey(data_section, "diamondClassifications")
                    class_count = length(get(data_section, "diamondClassifications", []))
                    println("   Classifications: $class_count")
                end
                if haskey(data_section, "networkData")
                    net_data = data_section["networkData"]
                    println("   Nodes: $(get(net_data, "nodeCount", 0)), Edges: $(get(net_data, "edgeCount", 0))")
                end
            end
            return true
        else
            println("❌ $endpoint ($prob_type) failed with status: $(response.status)")
            println("   Response: $(String(response.body))")
            return false
        end
        
    catch e
        println("❌ Error testing $endpoint ($prob_type): $e")
        return false
    end
end

println("🚀 Comprehensive Fix Testing with Metro Network Data")
println("=" ^ 60)

# Test with different probability types
prob_types = ["float", "interval", "pbox"]
endpoints = ["processinput", "reachabilitymodule", "diamondprocessing", "diamondclassification"]

results = Dict()

for prob_type in prob_types
    println("\n📊 Testing with $prob_type probability data...")
    println("-" ^ 40)
    
    try
        # Load data for this probability type
        test_data = load_metro_data(prob_type)
        results[prob_type] = Dict()
        
        for endpoint in endpoints
            success = test_endpoint(endpoint, test_data, prob_type)
            results[prob_type][endpoint] = success
            sleep(1)  # Small delay between tests
        end
        
    catch e
        println("❌ Failed to load $prob_type data: $e")
        results[prob_type] = Dict(endpoint => false for endpoint in endpoints)
    end
end

# Summary
println("\n📋 TEST RESULTS SUMMARY")
println("=" ^ 60)

for prob_type in prob_types
    println("\n$prob_type Results:")
    if haskey(results, prob_type)
        for endpoint in endpoints
            status = get(results[prob_type], endpoint, false) ? "✅" : "❌"
            println("  $status $endpoint")
        end
    else
        println("  ❌ Data loading failed")
    end
end

# Calculate overall success rate
total_tests = length(prob_types) * length(endpoints)
successful_tests = sum(sum(values(results[pt])) for pt in keys(results) if haskey(results, pt))

println("\n🎯 Overall Success Rate: $successful_tests/$total_tests ($(round(successful_tests/total_tests*100, digits=1))%)")

if successful_tests == total_tests
    println("🎉 All tests passed! Fixes are working correctly.")
else
    println("⚠️  Some tests failed. Check the output above for details.")
end