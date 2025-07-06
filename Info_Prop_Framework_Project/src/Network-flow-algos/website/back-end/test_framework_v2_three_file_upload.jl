#before running script, first load the server by running start-clean-server.jl and wait until server

# Comprehensive Test Suite for Framework V2 Three-File Upload System
# Tests individual file uploads, session management, and complete network processing

println("🚀 Framework V2 Three-File Upload System Test Suite")
println("=" ^ 60)



using HTTP, JSON

# Test configuration
const SERVER_URL = "http://localhost:9090"
const TEST_NETWORK = "KarlNetwork"  # Use KarlNetwork for testing
const TEST_PROB_TYPE = "float"

println("\n📋 Test 1: Create Upload Session")
println("-" ^ 60)

global session_id = ""
try
    # Create session
    response = HTTP.post(
        "$SERVER_URL/api/upload/create-session",
        ["Content-Type" => "application/json"],
        JSON.json(Dict())
    )
    
    if response.status == 200
        result = JSON.parse(String(response.body))
        if result["success"]
            global session_id = result["data"]["session_id"]
            println("✅ Session created successfully: $session_id")
            println("   Status: $(result["data"]["session_status"])")
        else
            println("❌ Session creation failed: $(result["error"])")
        end
    else
        println("❌ HTTP error: $(response.status)")
    end
    
catch e
    println("❌ Error creating session: $e")
end

if isempty(session_id)
    println("❌ Cannot continue without session ID")
    exit(1)
end

println("\n📋 Test 2: Upload Network Structure File (.EDGE)")
println("-" ^ 60)

try
    # Read the .EDGE file
    edge_file_path = "dag_ntwrk_files/$TEST_NETWORK/$TEST_NETWORK.EDGE"
    if !isfile(edge_file_path)
        println("❌ Edge file not found: $edge_file_path")
    else
        edge_content = read(edge_file_path, String)
        println("📁 Loading edge file: $edge_file_path")
        println("   Content length: $(length(edge_content)) characters")
        
        # Create multipart form data manually (updated format)
        boundary = "----WebKitFormBoundary" * string(rand(UInt64), base=16)
        
        form_data = """--$boundary\r
Content-Disposition: form-data; name="session_id"\r
\r
$session_id\r
--$boundary\r
Content-Disposition: form-data; name="filename"\r
\r
$TEST_NETWORK.EDGE\r
--$boundary\r
Content-Disposition: form-data; name="file_content"\r
\r
$edge_content\r
--$boundary--\r
"""
        
        response = HTTP.post(
            "$SERVER_URL/api/upload/network-structure",
            ["Content-Type" => "multipart/form-data; boundary=$boundary"],
            form_data
        )
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            if result["success"]
                println("✅ Network structure uploaded successfully")
                println("   Filename: $(result["data"]["filename"])")
                println("   Session status: $(result["data"]["session_status"])")
            else
                println("❌ Upload failed: $(result["error"])")
            end
        else
            println("❌ HTTP error: $(response.status)")
            println("   Response: $(String(response.body))")
        end
    end
    
catch e
    println("❌ Error uploading network structure: $e")
end

println("\n📋 Test 3: Upload Node Priors File (.json)")
println("-" ^ 60)

try
    # Read the node priors JSON file
    node_priors_file = "dag_ntwrk_files/$TEST_NETWORK/$TEST_PROB_TYPE/$TEST_NETWORK-nodepriors.json"
    if !isfile(node_priors_file)
        println("❌ Node priors file not found: $node_priors_file")
    else
        node_priors_content = read(node_priors_file, String)
        println("📁 Loading node priors file: $node_priors_file")
        println("   Content length: $(length(node_priors_content)) characters")
        
        # Create multipart form data (updated format)
        boundary = "----WebKitFormBoundary" * string(rand(UInt64), base=16)
        
        form_data = """--$boundary\r
Content-Disposition: form-data; name="session_id"\r
\r
$session_id\r
--$boundary\r
Content-Disposition: form-data; name="filename"\r
\r
$TEST_NETWORK-nodepriors.json\r
--$boundary\r
Content-Disposition: form-data; name="file_content"\r
\r
$node_priors_content\r
--$boundary--\r
"""
        
        response = HTTP.post(
            "$SERVER_URL/api/upload/node-priors",
            ["Content-Type" => "multipart/form-data; boundary=$boundary"],
            form_data
        )
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            if result["success"]
                println("✅ Node priors uploaded successfully")
                println("   Filename: $(result["data"]["filename"])")
                println("   Probability type detected: $(result["data"]["probability_type"])")
                println("   Session status: $(result["data"]["session_status"])")
            else
                println("❌ Upload failed: $(result["error"])")
            end
        else
            println("❌ HTTP error: $(response.status)")
            println("   Response: $(String(response.body))")
        end
    end
    
catch e
    println("❌ Error uploading node priors: $e")
end

println("\n📋 Test 4: Upload Link Probabilities File (.json)")
println("-" ^ 60)

try
    # Read the link probabilities JSON file
    link_probs_file = "dag_ntwrk_files/$TEST_NETWORK/$TEST_PROB_TYPE/$TEST_NETWORK-linkprobabilities.json"
    if !isfile(link_probs_file)
        println("❌ Link probabilities file not found: $link_probs_file")
    else
        link_probs_content = read(link_probs_file, String)
        println("📁 Loading link probabilities file: $link_probs_file")
        println("   Content length: $(length(link_probs_content)) characters")
        
        # Create multipart form data (updated format)
        boundary = "----WebKitFormBoundary" * string(rand(UInt64), base=16)
        
        form_data = """--$boundary\r
Content-Disposition: form-data; name="session_id"\r
\r
$session_id\r
--$boundary\r
Content-Disposition: form-data; name="filename"\r
\r
$TEST_NETWORK-linkprobabilities.json\r
--$boundary\r
Content-Disposition: form-data; name="file_content"\r
\r
$link_probs_content\r
--$boundary--\r
"""
        
        response = HTTP.post(
            "$SERVER_URL/api/upload/link-probabilities",
            ["Content-Type" => "multipart/form-data; boundary=$boundary"],
            form_data
        )
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            if result["success"]
                println("✅ Link probabilities uploaded successfully")
                println("   Filename: $(result["data"]["filename"])")
                println("   Session status: $(result["data"]["session_status"])")
                
                # Check if session is complete
                if result["data"]["session_status"]["complete"]
                    println("🎉 All three files uploaded! Session is complete.")
                else
                    println("⚠️ Session not yet complete")
                end
            else
                println("❌ Upload failed: $(result["error"])")
            end
        else
            println("❌ HTTP error: $(response.status)")
            println("   Response: $(String(response.body))")
        end
    end
    
catch e
    println("❌ Error uploading link probabilities: $e")
end

println("\n📋 Test 5: Check Session Status")
println("-" ^ 60)

try
    response = HTTP.get("$SERVER_URL/api/upload/session-status?session_id=$session_id")
    
    if response.status == 200
        result = JSON.parse(String(response.body))
        if result["success"]
            println("✅ Session status retrieved successfully")
            println("   Session ID: $(result["data"]["session_id"])")
            println("   Probability type: $(result["data"]["probability_type"])")
            println("   Status: $(result["data"]["session_status"])")
            println("   Created: $(result["data"]["created_at"])")
            println("   Last updated: $(result["data"]["last_updated"])")
        else
            println("❌ Status check failed: $(result["error"])")
        end
    else
        println("❌ HTTP error: $(response.status)")
    end
    
catch e
    println("❌ Error checking session status: $e")
end

println("\n📋 Test 6: Process Complete Network")
println("-" ^ 60)

try
    # Process the complete network
    response = HTTP.post(
        "$SERVER_URL/api/process-complete-network",
        ["Content-Type" => "application/json"],
        JSON.json(Dict("session_id" => session_id))
    )
    
    if response.status == 200
        result = JSON.parse(String(response.body))
        if result["success"]
            println("✅ Complete network processed successfully!")
            
            # Display network statistics
            stats = result["data"]["statistics"]["basic"]
            println("   📊 Network Statistics:")
            println("      - Nodes: $(stats["nodes"])")
            println("      - Edges: $(stats["edges"])")
            println("      - Density: $(stats["density"])")
            println("      - Max depth: $(stats["maxDepth"])")
            
            # Display node types
            node_types = result["data"]["statistics"]["nodeTypes"]
            println("   🔗 Node Types:")
            println("      - Source: $(node_types["source"])")
            println("      - Sink: $(node_types["sink"])")
            println("      - Fork: $(node_types["fork"])")
            println("      - Join: $(node_types["join"])")
            println("      - Regular: $(node_types["regular"])")
            
            # Display processing info
            proc_info = result["data"]["processingInfo"]
            println("   ⚙️ Processing Info:")
            println("      - Probability type: $(proc_info["probability_type"])")
            println("      - Files processed:")
            for (file_type, filename) in proc_info["files_processed"]
                println("        * $file_type: $filename")
            end
            
        else
            println("❌ Processing failed: $(result["error"])")
        end
    else
        println("❌ HTTP error: $(response.status)")
        println("   Response: $(String(response.body))")
    end
    
catch e
    println("❌ Error processing complete network: $e")
end

println("\n📋 Test 7: Test All Networks and Probability Types")
println("=" ^ 60)

# Test all available networks
network_types = [
    "ergo_proxy_dag_network",
    "grid_graph_dag", 
    "KarlNetwork",
    "layereddiamond_3",
    "metro_directed_dag_for_ipm",
    "power-network",
    "real_drone_network"
]

probability_types = ["float", "interval", "pbox"]

test_results = Dict{String, Dict{String, Any}}()

for network_name in network_types
    println("\n🔍 Testing Network: $network_name")
    println("-" ^ 40)
    
    test_results[network_name] = Dict{String, Any}()
    
    # Check for edge file
    edge_file_path = ""
    edge_file_upper = "dag_ntwrk_files/$network_name/$network_name.EDGE"
    edge_file_lower = "dag_ntwrk_files/$network_name/$network_name.edge"
    edge_file_special = "dag_ntwrk_files/$network_name/$(replace(network_name, "_dag" => "")).EDGE"
    
    if isfile(edge_file_upper)
        edge_file_path = edge_file_upper
    elseif isfile(edge_file_lower)
        edge_file_path = edge_file_lower
    elseif isfile(edge_file_special)
        edge_file_path = edge_file_special
    else
        println("❌ No edge file found for $network_name")
        test_results[network_name]["status"] = "missing_edge_file"
        continue
    end
    
    println("✅ Edge file found: $edge_file_path")
    
    # Test each probability type
    for prob_type in probability_types
        println("  🔸 Testing probability type: $prob_type")
        
        prob_dir = "dag_ntwrk_files/$network_name/$prob_type"
        if !isdir(prob_dir)
            println("    ❌ Probability directory not found: $prob_dir")
            test_results[network_name][prob_type] = "directory_missing"
            continue
        end
        
        # Check for required JSON files
        base_name = network_name == "grid_graph_dag" ? "grid-graph" : network_name
        node_priors_file = "$prob_dir/$base_name-nodepriors.json"
        link_probs_file = "$prob_dir/$base_name-linkprobabilities.json"
        
        if isfile(node_priors_file) && isfile(link_probs_file)
            try
                # Test file loading
                edge_content = read(edge_file_path, String)
                node_priors_content = read(node_priors_file, String)
                link_probs_content = read(link_probs_file, String)
                
                # Parse JSON files
                node_priors_json = JSON.parse(node_priors_content)
                link_probs_json = JSON.parse(link_probs_content)
                
                # Count edges and nodes
                edge_lines = filter(line -> !isempty(strip(line)), split(edge_content, '\n'))
                
                # Skip header line if present
                data_lines = edge_lines
                if length(edge_lines) > 0 && (contains(edge_lines[1], "source") || contains(edge_lines[1], "destination"))
                    data_lines = edge_lines[2:end]
                end
                
                num_edges = length(data_lines)
                
                # Extract unique nodes from edge list (handle both CSV and space-separated formats)
                nodes = Set{String}()
                for line in data_lines
                    # Try comma-separated first, then space-separated
                    parts = if contains(line, ",")
                        split(strip(line), ",")
                    else
                        split(strip(line))
                    end
                    
                    if length(parts) >= 2
                        push!(nodes, strip(parts[1]))
                        push!(nodes, strip(parts[2]))
                    end
                end
                num_nodes = length(nodes)
                
                println("    ✅ Network validated:")
                println("      - Nodes: $num_nodes")
                println("      - Edges: $num_edges")
                println("      - Node priors entries: $(length(node_priors_json))")
                println("      - Link probabilities entries: $(length(link_probs_json))")
                
                test_results[network_name][prob_type] = Dict(
                    "status" => "success",
                    "nodes" => num_nodes,
                    "edges" => num_edges,
                    "node_priors_count" => length(node_priors_json),
                    "link_probs_count" => length(link_probs_json),
                    "probability_type" => prob_type
                )
                
            catch file_error
                println("    ❌ File processing failed: $file_error")
                test_results[network_name][prob_type] = Dict(
                    "status" => "file_error",
                    "error" => string(file_error)
                )
            end
        else
            println("    ❌ Missing JSON files:")
            println("      - Node priors: $(isfile(node_priors_file) ? "✅" : "❌") $node_priors_file")
            println("      - Link probabilities: $(isfile(link_probs_file) ? "✅" : "❌") $link_probs_file")
            test_results[network_name][prob_type] = "missing_json_files"
        end
    end
end

println("\n📊 Test Results Summary")
println("=" ^ 60)

successful_tests = 0
total_tests = 0

for (network_name, network_results) in test_results
    println("🔍 $network_name:")
    for (prob_type, result) in network_results
        global total_tests += 1
        if isa(result, Dict) && get(result, "status", "") == "success"
            global successful_tests += 1
            println("  ✅ $prob_type: $(result["nodes"]) nodes, $(result["edges"]) edges")
        else
            println("  ❌ $prob_type: $result")
        end
    end
end

println("\n🎯 Overall Results:")
println("   - Successful tests: $successful_tests / $total_tests")
println("   - Success rate: $(round(successful_tests / total_tests * 100, digits=1))%")

if successful_tests == total_tests
    println("🎉 All tests passed! Three-file upload system is working correctly.")
else
    println("⚠️ Some tests failed. Check the results above for details.")
end

println("\n📋 Test 8: Call Process Input Endpoint with Uploaded Data")
println("=" ^ 60)

# Only run this test if we have a valid session with uploaded files
if !isempty(session_id)
    try
        println("🔄 Converting uploaded files to process-input format...")
        
        # Read the uploaded files again to convert to process-input format
        edge_file_path = "dag_ntwrk_files/$TEST_NETWORK/$TEST_NETWORK.EDGE"
        node_priors_file = "dag_ntwrk_files/$TEST_NETWORK/$TEST_PROB_TYPE/$TEST_NETWORK-nodepriors.json"
        link_probs_file = "dag_ntwrk_files/$TEST_NETWORK/$TEST_PROB_TYPE/$TEST_NETWORK-linkprobabilities.json"
        
        if isfile(edge_file_path) && isfile(node_priors_file) && isfile(link_probs_file)
            # Read and parse files
            edge_content = read(edge_file_path, String)
            node_priors_content = read(node_priors_file, String)
            link_probs_content = read(link_probs_file, String)
            
            node_priors_json = JSON.parse(node_priors_content)
            link_probs_json = JSON.parse(link_probs_content)
            
            # Convert edge file to edges array format
            edge_lines = filter(line -> !isempty(strip(line)), split(edge_content, '\n'))
            
            # Skip header line if present
            data_lines = edge_lines
            if length(edge_lines) > 0 && (contains(edge_lines[1], "source") || contains(edge_lines[1], "destination"))
                data_lines = edge_lines[2:end]
            end
            
            # Convert to edges array format expected by process-input
            edges_array = []
            for line in data_lines
                # Handle both CSV and space-separated formats
                parts = if contains(line, ",")
                    split(strip(line), ",")
                else
                    split(strip(line))
                end
                
                if length(parts) >= 2
                    push!(edges_array, Dict(
                        "source" => parse(Int, strip(parts[1])),
                        "destination" => parse(Int, strip(parts[2]))
                    ))
                end
            end
            
            println("📊 Converted data:")
            println("   - Edges: $(length(edges_array)) edge objects")
            println("   - Node priors: $(length(node_priors_json)) entries")
            println("   - Edge probabilities: $(length(link_probs_json)) entries")
            
            # Create request payload for process-input endpoint
            request_payload = Dict(
                "edges" => edges_array,
                "nodePriors" => node_priors_json,
                "edgeProbabilities" => link_probs_json
            )
            
            println("\n🔄 Calling /api/processinput endpoint...")
            
            # Call the processinput endpoint
            response = HTTP.post(
                "$SERVER_URL/api/processinput",
                ["Content-Type" => "application/json"],
                JSON.json(request_payload)
            )
            
            if response.status == 200
                result = JSON.parse(String(response.body))
                if result["success"]
                    println("✅ Process-input completed successfully!")
                    
                    # Get the actual network data structure
                    data = result["data"]
                    network_data = data["networkData"]
                    
                    println("\n📊 Complete Graph Structures Returned:")
                    println("-" ^ 50)
                    
                    # Basic network info
                    println("🔗 Basic Network Structure:")
                    if haskey(network_data, "edgelist") && !isnothing(network_data["edgelist"])
                        println("   - Edgelist: $(length(network_data["edgelist"])) edges")
                        if length(network_data["edgelist"]) > 0
                            println("     Sample: $(network_data["edgelist"][1:min(3, length(network_data["edgelist"]))])")
                        end
                    end
                    
                    # Index structures
                    println("\n🗂️ Index Structures:")
                    if haskey(network_data, "nodeCount") && !isnothing(network_data["nodeCount"])
                        println("   - Total nodes: $(network_data["nodeCount"])")
                    end
                    if haskey(network_data, "edgeCount") && !isnothing(network_data["edgeCount"])
                        println("   - Total edges: $(network_data["edgeCount"])")
                    end
                    if haskey(network_data, "graphDensity") && !isnothing(network_data["graphDensity"])
                        println("   - Graph density: $(network_data["graphDensity"])")
                    end
                    if haskey(network_data, "maxIterationDepth") && !isnothing(network_data["maxIterationDepth"])
                        println("   - Max iteration depth: $(network_data["maxIterationDepth"])")
                    end
                    
                    # Node classifications
                    println("\n🎯 Node Classifications:")
                    if haskey(network_data, "sourceNodes") && !isnothing(network_data["sourceNodes"])
                        println("   - Source nodes: $(length(network_data["sourceNodes"])) nodes")
                        if length(network_data["sourceNodes"]) > 0
                            println("     List: $(network_data["sourceNodes"])")
                        end
                    end
                    if haskey(network_data, "forkNodes") && !isnothing(network_data["forkNodes"])
                        println("   - Fork nodes: $(length(network_data["forkNodes"])) nodes")
                        if length(network_data["forkNodes"]) > 0
                            println("     List: $(network_data["forkNodes"])")
                        end
                    end
                    if haskey(network_data, "joinNodes") && !isnothing(network_data["joinNodes"])
                        println("   - Join nodes: $(length(network_data["joinNodes"])) nodes")
                        if length(network_data["joinNodes"]) > 0
                            println("     List: $(network_data["joinNodes"])")
                        end
                    end
                    if haskey(network_data, "sinkNodes") && !isnothing(network_data["sinkNodes"])
                        println("   - Sink nodes: $(length(network_data["sinkNodes"])) nodes")
                        if length(network_data["sinkNodes"]) > 0
                            println("     List: $(network_data["sinkNodes"])")
                        end
                    end
                    
                    # Probability data
                    println("\n📈 Probability Data:")
                    if haskey(network_data, "nodePriors") && !isnothing(network_data["nodePriors"])
                        println("   - Node priors: $(length(network_data["nodePriors"])) entries")
                        # Show first few entries
                        node_keys = collect(keys(network_data["nodePriors"]))[1:min(3, length(network_data["nodePriors"]))]
                        for key in node_keys
                            println("     $key: $(network_data["nodePriors"][key])")
                        end
                    end
                    if haskey(network_data, "edgeProbabilities") && !isnothing(network_data["edgeProbabilities"])
                        println("   - Edge probabilities: $(length(network_data["edgeProbabilities"])) entries")
                        # Show first few entries
                        edge_keys = collect(keys(network_data["edgeProbabilities"]))[1:min(3, length(network_data["edgeProbabilities"]))]
                        for key in edge_keys
                            println("     $key: $(network_data["edgeProbabilities"][key])")
                        end
                    end
                    
                    # Analysis structures
                    println("\n🔍 Analysis Structures:")
                    if haskey(network_data, "iterationSets") && !isnothing(network_data["iterationSets"])
                        println("   - Iteration sets: $(length(network_data["iterationSets"])) sets")
                        for (i, set) in enumerate(network_data["iterationSets"])
                            if i <= 3  # Show first 3 sets
                                println("     Set $i: $(length(set)) nodes - $set")
                            end
                        end
                    end
                    if haskey(network_data, "ancestors") && !isnothing(network_data["ancestors"])
                        println("   - Ancestors: $(length(network_data["ancestors"])) entries")
                    end
                    if haskey(network_data, "descendants") && !isnothing(network_data["descendants"])
                        println("   - Descendants: $(length(network_data["descendants"])) entries")
                    end
                    
                    println("\n🎉 Complete end-to-end test successful!")
                    println("   Three-file upload → Process-input → Full graph structures ✅")
                    
                else
                    println("❌ Process-input failed: $(result["error"])")
                end
            else
                println("❌ HTTP error: $(response.status)")
                println("   Response: $(String(response.body))")
            end
            
        else
            println("❌ Cannot find uploaded files for process-input test")
            println("   Edge file: $(isfile(edge_file_path) ? "✅" : "❌") $edge_file_path")
            println("   Node priors: $(isfile(node_priors_file) ? "✅" : "❌") $node_priors_file")
            println("   Link probs: $(isfile(link_probs_file) ? "✅" : "❌") $link_probs_file")
        end
        
    catch e
        println("❌ Error in process-input test: $e")
    end
else
    println("❌ Skipping process-input test - no valid session ID")
end

println("\n✅ Three-file upload system test complete!")