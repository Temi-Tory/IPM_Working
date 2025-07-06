"""
Session Upload Debug Test
Focused test for debugging the session management and file upload issues in Tests 1-6
"""

using HTTP, JSON

# Server configuration
const SERVER_URL = "http://localhost:9090"
const TEST_NETWORK = "KarlNetwork"
const TEST_PROB_TYPE = "float"

println("🔍 Session Upload Debug Test")
println("=" ^ 60)

# Global variable to store session ID
session_id = ""

println("\n📋 Test 1: Create Upload Session")
println("-" ^ 40)

try
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
        println("❌ HTTP Error: $(response.status)")
    end
catch e
    println("❌ Error creating session: $e")
end

println("\n📋 Test 2: Upload Network Structure File (.EDGE)")
println("-" ^ 40)

if !isempty(session_id)
    try
        # Read the edge file
        edge_file_path = "dag_ntwrk_files/$TEST_NETWORK/$TEST_NETWORK.EDGE"
        println("📁 Loading edge file: $edge_file_path")
        
        if isfile(edge_file_path)
            edge_content = read(edge_file_path, String)
            println("   Content length: $(length(edge_content)) characters")
            println("   Session ID being sent: $session_id")
            
            # Create multipart form data
            boundary = "----WebKitFormBoundary" * string(rand(UInt64), base=16)
            
            # Build multipart body
            body_parts = String[]
            
            # Add session_id field
            push!(body_parts, "--$boundary")
            push!(body_parts, "Content-Disposition: form-data; name=\"session_id\"")
            push!(body_parts, "")
            push!(body_parts, session_id)
            
            # Add filename field
            push!(body_parts, "--$boundary")
            push!(body_parts, "Content-Disposition: form-data; name=\"filename\"")
            push!(body_parts, "")
            push!(body_parts, "$TEST_NETWORK.EDGE")
            
            # Add file_content field
            push!(body_parts, "--$boundary")
            push!(body_parts, "Content-Disposition: form-data; name=\"file_content\"")
            push!(body_parts, "")
            push!(body_parts, edge_content)
            push!(body_parts, "--$boundary--")
            
            body = join(body_parts, "\r\n")
            
            println("   Multipart body length: $(length(body)) characters")
            println("   Boundary: $boundary")
            
            response = HTTP.post(
                "$SERVER_URL/api/upload/network-structure",
                ["Content-Type" => "multipart/form-data; boundary=$boundary"],
                body
            )
            
            println("   Response status: $(response.status)")
            
            if response.status == 200
                result = JSON.parse(String(response.body))
                if result["success"]
                    println("✅ Network structure uploaded successfully")
                    println("   Message: $(result["message"])")
                else
                    println("❌ Upload failed: $(result["error"])")
                end
            else
                result = JSON.parse(String(response.body))
                println("❌ Upload failed: $result")
            end
        else
            println("❌ Edge file not found: $edge_file_path")
        end
    catch e
        println("❌ Error uploading network structure: $e")
    end
else
    println("❌ No session ID available")
end

println("\n📋 Test 3: Upload Node Priors File (.json)")
println("-" ^ 40)

if !isempty(session_id)
    try
        # Read the node priors file
        node_priors_file = "dag_ntwrk_files/$TEST_NETWORK/$TEST_PROB_TYPE/$TEST_NETWORK-nodepriors.json"
        println("📁 Loading node priors file: $node_priors_file")
        
        if isfile(node_priors_file)
            node_priors_content = read(node_priors_file, String)
            println("   Content length: $(length(node_priors_content)) characters")
            println("   Session ID being sent: $session_id")
            
            # Create multipart form data
            boundary = "----WebKitFormBoundary" * string(rand(UInt64), base=16)
            
            # Build multipart body
            body_parts = String[]
            
            # Add session_id field
            push!(body_parts, "--$boundary")
            push!(body_parts, "Content-Disposition: form-data; name=\"session_id\"")
            push!(body_parts, "")
            push!(body_parts, session_id)
            
            # Add filename field
            push!(body_parts, "--$boundary")
            push!(body_parts, "Content-Disposition: form-data; name=\"filename\"")
            push!(body_parts, "")
            push!(body_parts, "$TEST_NETWORK-nodepriors.json")
            
            # Add file_content field
            push!(body_parts, "--$boundary")
            push!(body_parts, "Content-Disposition: form-data; name=\"file_content\"")
            push!(body_parts, "")
            push!(body_parts, node_priors_content)
            push!(body_parts, "--$boundary--")
            
            body = join(body_parts, "\r\n")
            
            println("   Multipart body length: $(length(body)) characters")
            
            response = HTTP.post(
                "$SERVER_URL/api/upload/node-priors",
                ["Content-Type" => "multipart/form-data; boundary=$boundary"],
                body
            )
            
            println("   Response status: $(response.status)")
            
            if response.status == 200
                result = JSON.parse(String(response.body))
                if result["success"]
                    println("✅ Node priors uploaded successfully")
                    println("   Message: $(result["message"])")
                else
                    println("❌ Upload failed: $(result["error"])")
                end
            else
                result = JSON.parse(String(response.body))
                println("❌ Upload failed: $result")
            end
        else
            println("❌ Node priors file not found: $node_priors_file")
        end
    catch e
        println("❌ Error uploading node priors: $e")
    end
else
    println("❌ No session ID available")
end

println("\n📋 Test 4: Check Session Status")
println("-" ^ 40)

if !isempty(session_id)
    try
        println("   Checking status for session: $session_id")
        
        response = HTTP.get("$SERVER_URL/api/upload/session-status?session_id=$session_id")
        
        println("   Response status: $(response.status)")
        
        if response.status == 200
            result = JSON.parse(String(response.body))
            if result["success"]
                println("✅ Session status retrieved successfully")
                println("   Status: $(result["status"])")
            else
                println("❌ Status check failed: $(result["error"])")
            end
        else
            result = JSON.parse(String(response.body))
            println("❌ Status check failed: $result")
        end
    catch e
        println("❌ Error checking session status: $e")
    end
else
    println("❌ No session ID available")
end

println("\n🔍 Debug Complete!")
println("Session ID used throughout: '$session_id'")