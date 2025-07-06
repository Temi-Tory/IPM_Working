#!/usr/bin/env julia

"""
Comprehensive test to verify all debugging fixes work with real metro network data
"""

using HTTP, JSON

# Load the actual metro network data
function load_metro_data(prob_type::String)
    # Read edge file
    edge_content = read("back-end/dag_ntwrk_files/metro_directed_dag_for_ipm/metro_directed_dag_for_ipm.edge", String)
    
    # Read node priors
    node_priors_content = read("back-end/dag_ntwrk_files/metro_directed_dag_for_ipm/$prob_type/metro_directed_dag_for_ipm-nodepriors.json", String)
    node_priors = JSON.parse(node_priors_content)
    
    # Read edge probabilities
    edge_probs_content = read("back-end/dag_ntwrk_files/metro_directed_dag_for_ipm/$prob_type/metro_directed_dag_for_ipm-linkprobabilities.json", String)
    edge_probs = JSON.parse(edge_probs_content)
    
    println("📁 Loaded data for $prob_type:")
    println("   Edge file size: $(length(edge_content)) characters")
    println("   Node priors keys: $(collect(keys(node_priors)))")
    println("   Edge probabilities keys: $(collect(keys(edge_probs)))")
    
    return Dict(
        "csvContent" => edge_content,
        "nodePriors" => node_priors,
        "edgeProbabilities" => edge_probs
    )
end

function test_endpoint(endpoint::String, data::Dict, prob_type::String)
    println("🧪 Testing $endpoint with $prob_type data...")
    println("   Request URL: http://localhost:9090/api/$endpoint")
    println("   Request data keys: $(collect(keys(data)))")
    
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
            
            # Print full response structure for analysis
            println("📋 Full Response Structure:")
            println("   Top-level keys: $(collect(keys(result)))")
            
            # Extract key metrics
            if haskey(result, "data")
                data_section = result["data"]
                println("   Data section keys: $(collect(keys(data_section)))")
                
                if haskey(data_section, "diamondData")
                    diamond_data = data_section["diamondData"]
                    println("   Diamond data keys: $(collect(keys(diamond_data)))")
                    diamond_count = get(diamond_data, "diamondCount", 0)
                    println("   Diamond count: $diamond_count")
                    
                    # Print detailed diamond structure info
                    if haskey(diamond_data, "diamondStructures") && diamond_count > 0
                        structures = diamond_data["diamondStructures"]
                        println("   Diamond structures type: $(typeof(structures))")
                        if isa(structures, Dict)
                            println("   Diamond structure keys (join nodes): $(collect(keys(structures)))")
                            
                            # Print first few diamonds as examples
                            for (i, join_node_key) in enumerate(collect(keys(structures))[1:min(3, length(structures))])
                                diamond_info = structures[join_node_key]
                                println("\n   === Diamond for Join Node $join_node_key ===")
                                println("   Keys in this diamond: $(collect(keys(diamond_info)))")
                                
                                if haskey(diamond_info, "joinNode")
                                    println("   Join node: $(diamond_info["joinNode"])")
                                end
                                
                                if haskey(diamond_info, "nonDiamondParents")
                                    non_diamond_parents = diamond_info["nonDiamondParents"]
                                    println("   Non-diamond parents: $(non_diamond_parents)")
                                    println("   Non-diamond parents type: $(typeof(non_diamond_parents))")
                                end
                                
                                if haskey(diamond_info, "diamonds")
                                    diamonds = diamond_info["diamonds"]
                                    println("   Diamonds field type: $(typeof(diamonds))")
                                    println("   Number of diamonds: $(length(diamonds))")
                                    
                                    if length(diamonds) > 0
                                        first_diamond = diamonds[1]
                                        println("   First diamond type: $(typeof(first_diamond))")
                                        if isa(first_diamond, Dict)
                                            println("   First diamond keys: $(collect(keys(first_diamond)))")
                                            for key in keys(first_diamond)
                                                value = first_diamond[key]
                                                println("     $key: $(value) (type: $(typeof(value)))")
                                            end
                                        else
                                            println("   First diamond content: $(first_diamond)")
                                        end
                                    end
                                end
                                
                                if i >= 3 break end
                            end
                        end
                    end
                end
                
                if haskey(data_section, "diamondClassifications")
                    classifications = get(data_section, "diamondClassifications", [])
                    class_count = length(classifications)
                    println("   Classifications count: $class_count")
                    if class_count > 0
                        println("   First classification keys: $(collect(keys(classifications[1])))")
                    end
                end
                
                if haskey(data_section, "networkData")
                    net_data = data_section["networkData"]
                    println("   Network data keys: $(collect(keys(net_data)))")
                    println("   Nodes: $(get(net_data, "nodeCount", 0)), Edges: $(get(net_data, "edgeCount", 0))")
                end
                
                if haskey(data_section, "reachabilityResults")
                    reach_data = data_section["reachabilityResults"]
                    println("   Reachability results keys: $(collect(keys(reach_data)))")
                end
            end
            
            if haskey(result, "message")
                println("   Message: $(result["message"])")
            end
            
            if haskey(result, "status")
                println("   Status: $(result["status"])")
            end
            
            return true
        else
            println("❌ $endpoint ($prob_type) failed with status: $(response.status)")
            println("   Response: $(String(response.body))")
            return false
        end
        
    catch e
        println("❌ Error testing $endpoint ($prob_type): $e")
        if isa(e, HTTP.ConnectError)
            println("   💡 Make sure the Julia server is running on localhost:9090")
        end
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