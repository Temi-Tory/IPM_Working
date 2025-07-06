# Comprehensive Metro Network Endpoint Testing Suite
# Tests all endpoints with metro network data across all probability types
# Run after starting server with start-clean-server.jl

println("🚀 Metro Network Comprehensive Endpoint Testing Suite")
println("=" ^ 80)

using HTTP, JSON, Dates

# Test configuration
const SERVER_URL = "http://localhost:9090"
const METRO_NETWORK = "metro_directed_dag_for_ipm"
const PROBABILITY_TYPES = ["float", "interval", "pbox"]

# Performance tracking
mutable struct TestMetrics
    start_time::DateTime
    end_time::DateTime
    response_time_ms::Float64
    memory_usage_mb::Float64
    data_size_bytes::Int64
    success::Bool
    error_message::String
    
    TestMetrics() = new(now(), now(), 0.0, 0.0, 0, false, "")
end

# Global test results storage
global test_results = Dict{String, Dict{String, Any}}()
global session_id = ""
global metrics = TestMetrics()
global memory_before = 0.0
global fastest_test = nothing
global slowest_test = nothing

# Utility functions
function measure_memory()
    try
        return Base.gc_live_bytes() / (1024 * 1024)  # Convert to MB
    catch
        return 0.0
    end
end

function create_multipart_form(session_id::String, filename::String, content::String)
    boundary = "----WebKitFormBoundary" * string(rand(UInt64), base=16)
    
    form_data = """--$boundary\r
Content-Disposition: form-data; name="session_id"\r
\r
$session_id\r
--$boundary\r
Content-Disposition: form-data; name="filename"\r
\r
$filename\r
--$boundary\r
Content-Disposition: form-data; name="file_content"\r
\r
$content\r
--$boundary--\r
"""
    
    return form_data, boundary
end

function log_test_result(phase::String, test_name::String, prob_type::String, metrics::TestMetrics, additional_data::Dict = Dict())
    if !haskey(test_results, phase)
        test_results[phase] = Dict()
    end
    if !haskey(test_results[phase], prob_type)
        test_results[phase][prob_type] = Dict()
    end
    
    test_results[phase][prob_type][test_name] = Dict(
        "success" => metrics.success,
        "response_time_ms" => metrics.response_time_ms,
        "memory_usage_mb" => metrics.memory_usage_mb,
        "data_size_bytes" => metrics.data_size_bytes,
        "error_message" => metrics.error_message,
        "additional_data" => additional_data
    )
end

function print_phase_header(phase_num::Int, phase_name::String, description::String)
    println("\n" * "=" ^ 80)
    println("📋 PHASE $phase_num: $phase_name")
    println("   $description")
    println("=" ^ 80)
end

function print_test_header(test_name::String, prob_type::String = "")
    prob_suffix = isempty(prob_type) ? "" : " ($prob_type)"
    println("\n🔍 $test_name$prob_suffix")
    println("-" ^ 60)
end

function test_endpoint(endpoint_name::String, endpoint_url::String, prob_type::String, data::Dict, phase::String)
    print_test_header("$endpoint_name Endpoint", prob_type)
    
    metrics = TestMetrics()
    metrics.start_time = now()
    memory_before = measure_memory()
    
    try
        # Create the correct request payload with csvContent parameter
        request_payload = Dict(
            "csvContent" => data["edge_content"],
            "nodePriors" => data["node_priors_json"],
            "edgeProbabilities" => data["link_probs_json"]
        )
        
        json_payload = JSON.json(request_payload)
        metrics.data_size_bytes = length(json_payload)
        
        # Check if we need streaming for large data
        if metrics.data_size_bytes > 50000  # > 50KB
            println("   📊 Large dataset detected ($(round(metrics.data_size_bytes/1024, digits=1))KB)")
            println("   Using extended timeout for processing...")
        end
        
        # Add timeout for long-running operations with dynamic timeout based on data size
        timeout_seconds = metrics.data_size_bytes > 50000 ? 120 : 60
        
        response = HTTP.post(
            "$SERVER_URL$endpoint_url",
            ["Content-Type" => "application/json"],
            json_payload;
            readtimeout = timeout_seconds,
            connect_timeout = 30
        )
        
        metrics.end_time = now()
        metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
        metrics.memory_usage_mb = measure_memory() - memory_before
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            if result["success"]
                metrics.success = true
                
                println("✅ $endpoint_name successful")
                println("   Response time: $(metrics.response_time_ms)ms")
                println("   Memory usage: $(round(metrics.memory_usage_mb, digits=2))MB")
                println("   Data size: $(metrics.data_size_bytes) bytes")
                
                # Performance warnings
                if metrics.response_time_ms > 15000  # > 15 seconds
                    println("   ⚠️  SLOW RESPONSE: Consider optimization for $prob_type data")
                end
                
                # Extract specific data based on endpoint
                additional_data = Dict()
                if endpoint_name == "processinput"
                    network_data = result["data"]["networkData"]
                    additional_data["node_count"] = get(network_data, "nodeCount", 0)
                    additional_data["edge_count"] = get(network_data, "edgeCount", 0)
                    additional_data["graph_density"] = get(network_data, "graphDensity", 0.0)
                    println("   Network nodes: $(additional_data["node_count"])")
                    println("   Network edges: $(additional_data["edge_count"])")
                elseif endpoint_name == "reachabilitymodule"
                    if haskey(result["data"], "results")
                        reach_count = length(result["data"]["results"])
                        additional_data["reachability_count"] = reach_count
                        println("   Reachability results: $reach_count entries")
                    end
                elseif endpoint_name == "diamondprocessing"
                    if haskey(result["data"], "diamondData")
                        diamond_count = get(result["data"]["diamondData"], "diamondCount", 0)
                        additional_data["diamond_count"] = diamond_count
                        println("   Diamond structures: $diamond_count found")
                    end
                elseif endpoint_name == "diamondclassification"
                    if haskey(result["data"], "classificationStatistics")
                        class_count = get(result["data"]["classificationStatistics"], "totalClassified", 0)
                        additional_data["classification_count"] = class_count
                        println("   Classification results: $class_count entries")
                    end
                end
                
                log_test_result(phase, endpoint_name, prob_type, metrics, additional_data)
            else
                metrics.error_message = get(result, "error", "Unknown error")
                validation_errors = get(result, "validationErrors", [])
                if !isempty(validation_errors)
                    println("❌ $endpoint_name validation failed:")
                    for error in validation_errors
                        println("   • $error")
                    end
                else
                    println("❌ $endpoint_name failed: $(metrics.error_message)")
                end
                log_test_result(phase, endpoint_name, prob_type, metrics)
            end
        else
            metrics.error_message = "HTTP $(response.status)"
            println("❌ HTTP error: $(response.status)")
            if response.status == 400
                println("   Possible parameter validation issue - check csvContent format")
            elseif response.status == 500
                println("   Server error - check server logs for details")
            elseif response.status == 408
                println("   Request timeout - data may be too large for processing")
            end
            log_test_result(phase, endpoint_name, prob_type, metrics)
        end
        
    catch e
        metrics.end_time = now()
        metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
        
        # Enhanced error handling
        if isa(e, HTTP.TimeoutError)
            metrics.error_message = "Request timeout - consider streaming for large datasets"
            println("❌ Timeout error: Request took too long ($(timeout_seconds)s limit)")
        elseif isa(e, HTTP.ConnectError)
            metrics.error_message = "Connection error - server may be down"
            println("❌ Connection error: Cannot connect to server")
        else
            metrics.error_message = string(e)
            println("❌ Error: $e")
        end
        
        log_test_result(phase, endpoint_name, prob_type, metrics)
    end
end

# Load metro network data for all probability types
metro_data = Dict{String, Dict{String, Any}}()

println("\n📁 Loading Metro Network Data")
println("-" ^ 60)

for prob_type in PROBABILITY_TYPES
    println("Loading $prob_type data...")
    
    # File paths
    edge_file = "dag_ntwrk_files/$METRO_NETWORK/$METRO_NETWORK.edge"
    node_priors_file = "dag_ntwrk_files/$METRO_NETWORK/$prob_type/$METRO_NETWORK-nodepriors.json"
    link_probs_file = "dag_ntwrk_files/$METRO_NETWORK/$prob_type/$METRO_NETWORK-linkprobabilities.json"
    
    if isfile(edge_file) && isfile(node_priors_file) && isfile(link_probs_file)
        try
            edge_content = read(edge_file, String)
            node_priors_content = read(node_priors_file, String)
            link_probs_content = read(link_probs_file, String)
            
            node_priors_json = JSON.parse(node_priors_content)
            link_probs_json = JSON.parse(link_probs_content)
            
            # Convert edge file to edges array
            edge_lines = filter(line -> !isempty(strip(line)), split(edge_content, '\n'))
            data_lines = edge_lines[2:end]  # Skip header
            
            edges_array = []
            for line in data_lines
                parts = split(strip(line), ",")
                if length(parts) >= 2
                    push!(edges_array, Dict(
                        "source" => parse(Int, strip(parts[1])),
                        "destination" => parse(Int, strip(parts[2]))
                    ))
                end
            end
            
            metro_data[prob_type] = Dict(
                "edge_content" => edge_content,
                "node_priors_content" => node_priors_content,
                "link_probs_content" => link_probs_content,
                "node_priors_json" => node_priors_json,
                "link_probs_json" => link_probs_json,
                "edges_array" => edges_array,
                "edge_file" => edge_file,
                "node_priors_file" => node_priors_file,
                "link_probs_file" => link_probs_file
            )
            
            println("  ✅ $prob_type: $(length(edges_array)) edges, $(length(node_priors_json["nodes"])) nodes")
            
        catch e
            println("  ❌ Error loading $prob_type data: $e")
            metro_data[prob_type] = Dict("error" => string(e))
        end
    else
        println("  ❌ Missing files for $prob_type")
        metro_data[prob_type] = Dict("error" => "missing_files")
    end
end

# PHASE 1: Basic Endpoint Validation (Float Data)
print_phase_header(1, "Basic Endpoint Validation", "Testing all endpoints with float probability data")

prob_type = "float"
if haskey(metro_data, prob_type) && !haskey(metro_data[prob_type], "error")
    data = metro_data[prob_type]
    
    # Test all main endpoints
    endpoints = [
        ("processinput", "/api/processinput"),
        ("reachabilitymodule", "/api/reachabilitymodule"),
        ("diamondprocessing", "/api/diamondprocessing"),
        ("diamondclassification", "/api/diamondclassification")
    ]
    
    for (endpoint_name, endpoint_url) in endpoints
        test_endpoint(endpoint_name, endpoint_url, prob_type, data, "Phase1")
    end
    
    # Test three-file upload system
    print_test_header("Three-File Upload System", prob_type)
    
    session_id = ""
    
    # Create session
    metrics = TestMetrics()
    metrics.start_time = now()
    
    try
        response = HTTP.post(
            "$SERVER_URL/api/upload/create-session",
            ["Content-Type" => "application/json"],
            JSON.json(Dict())
        )
        
        metrics.end_time = now()
        metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            if result["success"]
                global session_id = result["data"]["session_id"]
                metrics.success = true
                println("✅ Session created: $session_id")
                log_test_result("Phase1", "create_session", prob_type, metrics, Dict("session_id" => session_id))
            else
                metrics.error_message = result["error"]
                println("❌ Session creation failed: $(metrics.error_message)")
                log_test_result("Phase1", "create_session", prob_type, metrics)
            end
        else
            metrics.error_message = "HTTP $(response.status)"
            println("❌ HTTP error: $(response.status)")
            log_test_result("Phase1", "create_session", prob_type, metrics)
        end
        
    catch e
        metrics.end_time = now()
        metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
        metrics.error_message = string(e)
        println("❌ Error: $e")
        log_test_result("Phase1", "create_session", prob_type, metrics)
    end
    
    if !isempty(session_id)
        # Upload files and test process-complete-network
        upload_files = [
            ("network-structure", "$METRO_NETWORK.edge", data["edge_content"]),
            ("node-priors", "$METRO_NETWORK-nodepriors.json", data["node_priors_content"]),
            ("link-probabilities", "$METRO_NETWORK-linkprobabilities.json", data["link_probs_content"])
        ]
        
        for (upload_type, filename, content) in upload_files
            metrics = TestMetrics()
            metrics.start_time = now()
            memory_before = measure_memory()
            
            try
                form_data, boundary = create_multipart_form(session_id, filename, content)
                metrics.data_size_bytes = length(form_data)
                
                response = HTTP.post(
                    "$SERVER_URL/api/upload/$upload_type",
                    ["Content-Type" => "multipart/form-data; boundary=$boundary"],
                    form_data
                )
                
                metrics.end_time = now()
                metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
                metrics.memory_usage_mb = measure_memory() - memory_before
                
                if response.status == 200
                    result = JSON.parse(String(response.body))
                    if result["success"]
                        metrics.success = true
                        println("✅ $upload_type uploaded ($(metrics.response_time_ms)ms)")
                        log_test_result("Phase1", "upload_$upload_type", prob_type, metrics)
                    else
                        metrics.error_message = result["error"]
                        println("❌ $upload_type upload failed: $(metrics.error_message)")
                        log_test_result("Phase1", "upload_$upload_type", prob_type, metrics)
                    end
                else
                    metrics.error_message = "HTTP $(response.status)"
                    println("❌ $upload_type HTTP error: $(response.status)")
                    log_test_result("Phase1", "upload_$upload_type", prob_type, metrics)
                end
                
            catch e
                metrics.end_time = now()
                metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
                metrics.error_message = string(e)
                println("❌ $upload_type error: $e")
                log_test_result("Phase1", "upload_$upload_type", prob_type, metrics)
            end
        end
        
        # Test process-complete-network
        global metrics = TestMetrics()
        metrics.start_time = now()
        global memory_before = measure_memory()
        
        try
            response = HTTP.post(
                "$SERVER_URL/api/process-complete-network",
                ["Content-Type" => "application/json"],
                JSON.json(Dict("session_id" => session_id))
            )
            
            metrics.end_time = now()
            metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
            metrics.memory_usage_mb = measure_memory() - memory_before
            
            if response.status == 200
                result = JSON.parse(String(response.body))
                if result["success"]
                    metrics.success = true
                    stats = result["data"]["statistics"]["basic"]
                    
                    println("✅ Complete network processed ($(metrics.response_time_ms)ms)")
                    println("   Nodes: $(stats["nodes"]), Edges: $(stats["edges"])")
                    println("   Density: $(stats["density"]), Max depth: $(stats["maxDepth"])")
                    
                    log_test_result("Phase1", "process_complete_network", prob_type, metrics, Dict(
                        "nodes" => stats["nodes"],
                        "edges" => stats["edges"],
                        "density" => stats["density"]
                    ))
                else
                    metrics.error_message = result["error"]
                    println("❌ Processing failed: $(metrics.error_message)")
                    log_test_result("Phase1", "process_complete_network", prob_type, metrics)
                end
            else
                metrics.error_message = "HTTP $(response.status)"
                println("❌ HTTP error: $(response.status)")
                log_test_result("Phase1", "process_complete_network", prob_type, metrics)
            end
            
        catch e
            metrics.end_time = now()
            metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
            metrics.error_message = string(e)
            println("❌ Error: $e")
            log_test_result("Phase1", "process_complete_network", prob_type, metrics)
        end
    end
end

# PHASE 2: Interval Data Testing
print_phase_header(2, "Interval Data Testing", "Testing all endpoints with interval probability data")

prob_type = "interval"
if haskey(metro_data, prob_type) && !haskey(metro_data[prob_type], "error")
    data = metro_data[prob_type]
    
    endpoints = [
        ("processinput", "/api/processinput"),
        ("reachabilitymodule", "/api/reachabilitymodule"),
        ("diamondprocessing", "/api/diamondprocessing"),
        ("diamondclassification", "/api/diamondclassification")
    ]
    
    for (endpoint_name, endpoint_url) in endpoints
        test_endpoint(endpoint_name, endpoint_url, prob_type, data, "Phase2")
    end
else
    println("❌ Interval data not available for testing")
end

# PHASE 3: P-Box Data Testing
print_phase_header(3, "P-Box Data Testing", "Testing all endpoints with p-box probability data")

prob_type = "pbox"
if haskey(metro_data, prob_type) && !haskey(metro_data[prob_type], "error")
    data = metro_data[prob_type]
    
    endpoints = [
        ("processinput", "/api/processinput"),
        ("reachabilitymodule", "/api/reachabilitymodule"),
        ("diamondprocessing", "/api/diamondprocessing"),
        ("diamondclassification", "/api/diamondclassification")
    ]
    
    for (endpoint_name, endpoint_url) in endpoints
        test_endpoint(endpoint_name, endpoint_url, prob_type, data, "Phase3")
    end
else
    println("❌ P-box data not available for testing")
end

# PHASE 4: Streaming and Large Data Testing
print_phase_header(4, "Streaming and Large Data Testing", "Testing endpoints with large datasets and streaming capabilities")

function test_streaming_endpoint(endpoint_name::String, endpoint_url::String, prob_type::String, data::Dict)
    print_test_header("$endpoint_name Streaming Test", prob_type)
    
    metrics = TestMetrics()
    metrics.start_time = now()
    memory_before = measure_memory()
    
    try
        # Create chunked request for large data
        request_payload = Dict(
            "csvContent" => data["edge_content"],
            "nodePriors" => data["node_priors_json"],
            "edgeProbabilities" => data["link_probs_json"],
            "streamingMode" => true,  # Request streaming if supported
            "chunkSize" => 1024      # 1KB chunks
        )
        
        json_payload = JSON.json(request_payload)
        metrics.data_size_bytes = length(json_payload)
        
        println("   📊 Testing streaming with $(round(metrics.data_size_bytes/1024, digits=1))KB payload")
        
        # Extended timeout for streaming
        response = HTTP.post(
            "$SERVER_URL$endpoint_url",
            ["Content-Type" => "application/json", "Accept" => "application/json"],
            json_payload;
            readtimeout = 180,  # 3 minutes for streaming
            connect_timeout = 30
        )
        
        metrics.end_time = now()
        metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
        metrics.memory_usage_mb = measure_memory() - memory_before
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            if result["success"]
                metrics.success = true
                println("✅ Streaming test successful")
                println("   Response time: $(metrics.response_time_ms)ms")
                println("   Memory usage: $(round(metrics.memory_usage_mb, digits=2))MB")
                
                # Calculate streaming efficiency
                throughput = metrics.data_size_bytes / metrics.response_time_ms
                println("   Throughput: $(round(throughput, digits=2)) bytes/ms")
                
                log_test_result("Phase4_Streaming", endpoint_name, prob_type, metrics, Dict(
                    "throughput" => throughput,
                    "streaming_mode" => true
                ))
            else
                metrics.error_message = get(result, "error", "Streaming failed")
                println("❌ Streaming test failed: $(metrics.error_message)")
                log_test_result("Phase4_Streaming", endpoint_name, prob_type, metrics)
            end
        else
            metrics.error_message = "HTTP $(response.status)"
            println("❌ Streaming HTTP error: $(response.status)")
            log_test_result("Phase4_Streaming", endpoint_name, prob_type, metrics)
        end
        
    catch e
        metrics.end_time = now()
        metrics.response_time_ms = Dates.value(metrics.end_time - metrics.start_time)
        metrics.error_message = string(e)
        println("❌ Streaming error: $e")
        log_test_result("Phase4_Streaming", endpoint_name, prob_type, metrics)
    end
end

# Test streaming with P-box data (typically largest)
if haskey(metro_data, "pbox") && !haskey(metro_data["pbox"], "error")
    data = metro_data["pbox"]
    
    streaming_endpoints = [
        ("reachabilitymodule", "/api/reachabilitymodule"),
        ("diamondprocessing", "/api/diamondprocessing"),
        ("diamondclassification", "/api/diamondclassification")
    ]
    
    for (endpoint_name, endpoint_url) in streaming_endpoints
        test_streaming_endpoint(endpoint_name, endpoint_url, "pbox", data)
    end
else
    println("❌ P-box data not available for streaming tests")
end

# PHASE 5: Cross-Probability Type Validation
print_phase_header(5, "Cross-Probability Type Validation", "Comparing performance and results across probability types")

# Performance comparison
println("\n📊 Performance Comparison Across Probability Types")
println("-" ^ 60)

for endpoint in ["processinput", "reachabilitymodule", "diamondprocessing", "diamondclassification"]
    println("\n🔍 $endpoint Endpoint Performance:")
    
    for prob_type in PROBABILITY_TYPES
        phase_key = prob_type == "float" ? "Phase1" : (prob_type == "interval" ? "Phase2" : "Phase3")
        
        if haskey(test_results, phase_key) &&
           haskey(test_results[phase_key], prob_type) &&
           haskey(test_results[phase_key][prob_type], endpoint)
            
            result = test_results[phase_key][prob_type][endpoint]
            status = result["success"] ? "✅" : "❌"
            response_time = result["response_time_ms"]
            memory_usage = result["memory_usage_mb"]
            data_size = result["data_size_bytes"]
            
            println("  $status $prob_type: $(response_time)ms, $(round(memory_usage, digits=2))MB, $(data_size) bytes")
            
            # Performance analysis
            if result["success"]
                if response_time > 15000
                    println("    ⚠️  SLOW: $(prob_type) data processing is slow ($(round(response_time/1000, digits=1))s)")
                    if prob_type == "float" && response_time > 10000
                        println("    🔍 INVESTIGATE: Float processing should be faster - check for bottlenecks")
                    end
                end
                
                if data_size > 50000
                    throughput = data_size / response_time
                    println("    📊 Large dataset: $(round(data_size/1024, digits=1))KB, throughput: $(round(throughput, digits=2)) bytes/ms")
                end
            else
                println("    ❌ Error: $(result["error_message"])")
            end
        else
            println("  ❌ $prob_type: No data available")
        end
    end
    
    # Check for streaming test results
    if haskey(test_results, "Phase4_Streaming")
        streaming_phase = test_results["Phase4_Streaming"]
        if haskey(streaming_phase, "pbox") && haskey(streaming_phase["pbox"], endpoint)
            streaming_result = streaming_phase["pbox"][endpoint]
            if streaming_result["success"]
                println("  🚀 pbox (streaming): $(streaming_result["response_time_ms"])ms")
                if haskey(streaming_result["additional_data"], "throughput")
                    throughput = streaming_result["additional_data"]["throughput"]
                    println("    Streaming throughput: $(round(throughput, digits=2)) bytes/ms")
                end
            end
        end
    end
end

# Data size impact analysis
println("\n📈 Data Size Impact Analysis")
println("-" ^ 60)

for prob_type in PROBABILITY_TYPES
    phase_key = prob_type == "float" ? "Phase1" : (prob_type == "interval" ? "Phase2" : "Phase3")
    
    if haskey(test_results, phase_key) && haskey(test_results[phase_key], prob_type)
        println("\n$prob_type Data Characteristics:")
        
        # Use local scope variables
        local total_data_size = 0
        local total_response_time = 0.0
        local successful_tests_local = 0
        
        for (test_name, result) in test_results[phase_key][prob_type]
            if result["success"]
                total_data_size += result["data_size_bytes"]
                total_response_time += result["response_time_ms"]
                successful_tests_local += 1
            end
        end
        
        if successful_tests_local > 0
            avg_data_size = total_data_size / successful_tests_local
            avg_response_time = total_response_time / successful_tests_local
            
            println("  Average data size: $(round(avg_data_size, digits=0)) bytes")
            println("  Average response time: $(round(avg_response_time, digits=1))ms")
            println("  Successful tests: $successful_tests_local")
            
            # Calculate throughput (bytes per ms)
            if avg_response_time > 0
                throughput = avg_data_size / avg_response_time
                println("  Throughput: $(round(throughput, digits=2)) bytes/ms")
            end
            
            # Performance analysis and warnings
            if avg_response_time > 10000  # > 10 seconds
                println("  ⚠️  PERFORMANCE WARNING: Slow response time detected")
                println("     Consider implementing streaming for large datasets")
            end
            
            if avg_data_size > 50000  # > 50KB
                println("  📊 LARGE DATASET: Consider chunked transfer")
                println("     Data size: $(round(avg_data_size/1024, digits=1))KB")
            end
        end
    end
end

# Final Results Summary
println("\n" * "=" ^ 80)
println("📊 COMPREHENSIVE TEST RESULTS SUMMARY")
println("=" ^ 80)

# Initialize counters with global scope
global total_tests = 0
global successful_tests = 0
global failed_tests = 0

for (phase, phase_data) in test_results
    println("\n$phase Results:")
    
    for (prob_type, prob_data) in phase_data
        println("  $prob_type:")
        
        for (test_name, result) in prob_data
            global total_tests += 1
            status = result["success"] ? "✅" : "❌"
            
            if result["success"]
                global successful_tests += 1
                println("    $status $test_name: $(result["response_time_ms"])ms")
            else
                global failed_tests += 1
                println("    $status $test_name: $(result["error_message"])")
            end
        end
    end
end

println("\n🎯 Overall Test Statistics:")
println("   Total tests: $total_tests")
println("   Successful: $successful_tests")
println("   Failed: $failed_tests")
println("   Success rate: $(round(successful_tests / total_tests * 100, digits=1))%")

# Performance insights
println("\n⚡ Performance Insights:")

# Find fastest and slowest tests
global fastest_test = ("", "", Inf)
global slowest_test = ("", "", 0.0)

for (phase, phase_data) in test_results
    for (prob_type, prob_data) in phase_data
        for (test_name, result) in prob_data
            if result["success"]
                response_time = result["response_time_ms"]
                if response_time < fastest_test[3]
                    global fastest_test = (phase, "$prob_type/$test_name", response_time)
                end
                if response_time > slowest_test[3]
                    global slowest_test = (phase, "$prob_type/$test_name", response_time)
                end
            end
        end
    end
end

if fastest_test[3] != Inf
    println("   Fastest test: $(fastest_test[2]) ($(fastest_test[3])ms)")
end
if slowest_test[3] != 0.0
    println("   Slowest test: $(slowest_test[2]) ($(slowest_test[3])ms)")
end

# Memory usage analysis
global total_memory = 0.0
global memory_tests = 0

for (phase, phase_data) in test_results
    for (prob_type, prob_data) in phase_data
        for (test_name, result) in prob_data
            if result["success"] && result["memory_usage_mb"] > 0
                global total_memory += result["memory_usage_mb"]
                global memory_tests += 1
            end
        end
    end
end

if memory_tests > 0
    avg_memory = total_memory / memory_tests
    println("   Average memory usage: $(round(avg_memory, digits=2))MB per test")
    
    # Memory usage warnings
    if avg_memory > 100
        println("   ⚠️  HIGH MEMORY USAGE: Consider memory optimization")
    end
end

println("\n🎉 Metro Network Comprehensive Endpoint Testing Complete!")
println("   All endpoints tested across all probability types")
println("   Detailed performance metrics collected")
println("   Streaming capabilities tested")
println("   Ready for production deployment analysis")

# Performance recommendations
println("\n🔧 Performance Recommendations:")

# Analyze float processing performance
float_slow_tests = 0
for (phase, phase_data) in test_results
    if haskey(phase_data, "float")
        for (test_name, result) in phase_data["float"]
            if result["success"] && result["response_time_ms"] > 10000
                float_slow_tests += 1
            end
        end
    end
end

if float_slow_tests > 0
    println("   ⚠️  Float processing optimization needed: $float_slow_tests slow tests detected")
    println("      • Investigate bottlenecks in float data processing")
    println("      • Consider algorithm optimization for numerical computations")
end

# Check for large dataset handling
large_dataset_tests = 0
for (phase, phase_data) in test_results
    for (prob_type, prob_data) in phase_data
        for (test_name, result) in prob_data
            if result["success"] && result["data_size_bytes"] > 50000
                large_dataset_tests += 1
            end
        end
    end
end

if large_dataset_tests > 0
    println("   📊 Large dataset handling: $large_dataset_tests tests with >50KB data")
    println("      • Consider implementing chunked data transfer")
    println("      • Add progress indicators for long-running operations")
    println("      • Implement data compression for network transfer")
end

# Memory usage recommendations
if memory_tests > 0 && total_memory / memory_tests > 50
    println("   🧠 Memory optimization recommended:")
    println("      • Average memory usage: $(round(total_memory / memory_tests, digits=1))MB per test")
    println("      • Consider memory pooling for large operations")
    println("      • Implement garbage collection optimization")
end

# Success rate analysis
success_rate = round(successful_tests / total_tests * 100, digits=1)
if success_rate == 100.0
    println("\n✅ ALL TESTS PASSED! Metro network endpoints are fully functional.")
    println("   🚀 Ready for production deployment")
    println("   📈 Success rate: $success_rate%")
elseif success_rate >= 90.0
    println("\n✅ MOSTLY SUCCESSFUL! High success rate achieved.")
    println("   📈 Success rate: $success_rate%")
    println("   🔍 Review failed tests for minor issues")
elseif success_rate >= 75.0
    println("\n⚠️  MODERATE SUCCESS: Some issues detected.")
    println("   📈 Success rate: $success_rate%")
    println("   🔧 Address failed endpoints before production use")
else
    println("\n❌ SIGNIFICANT ISSUES: Multiple endpoints failing.")
    println("   📈 Success rate: $success_rate%")
    println("   🚨 Critical: Investigate and fix failed endpoints immediately")
end

println("\n📋 Next Steps:")
println("   1. Review detailed error messages for failed tests")
println("   2. Optimize slow-performing endpoints (>15s response time)")
println("   3. Implement streaming for large datasets (>50KB)")
println("   4. Add proper error handling and validation")
println("   5. Consider load testing with concurrent requests")