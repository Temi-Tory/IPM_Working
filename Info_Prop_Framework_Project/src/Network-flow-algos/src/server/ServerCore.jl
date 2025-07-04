"""
ServerCore.jl

Core HTTP server configuration and setup for the Information Propagation Analysis Framework.
Handles CORS, UTF-8 encoding, and basic server infrastructure.
"""
module ServerCore

using HTTP, JSON, Dates

export start_server, CORS_HEADERS, JSON_HEADERS, log_request, health_check_handler, options_handler, not_found_handler, server_error_handler

# CORS headers for API responses
const CORS_HEADERS = [
    "Access-Control-Allow-Origin" => "*",
    "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers" => "Content-Type, Authorization"
]

# JSON headers with UTF-8 encoding
const JSON_HEADERS = [
    "Content-Type" => "application/json; charset=utf-8",
    "Access-Control-Allow-Origin" => "*"
]

"""
    setup_utf8_encoding()

Setup UTF-8 encoding for Windows systems.
"""
function setup_utf8_encoding()
    if Sys.iswindows()
        try
            run(`chcp 65001`)
            println("✅ UTF-8 encoding enabled for Windows")
        catch
            println("⚠️ Note: Could not set UTF-8 console encoding on Windows")
        end
    end
end

"""
    health_check_handler(req::HTTP.Request) -> HTTP.Response

Handle health check requests for server monitoring.
"""
function health_check_handler(req::HTTP.Request)::HTTP.Response
    health_data = Dict{String, Any}(
        "status" => "healthy",
        "service" => "Information Propagation Analysis Framework",
        "version" => "2.0.0",
        "timestamp" => string(now()),
        "endpoints" => [
            "/api/processinput",
            "/api/diamondprocessing", 
            "/api/diamondclassification",
            "/api/reachabilitymodule",
            "/api/pathenum",
            "/api/montecarlo"
        ],
        "features" => [
            "Network Structure Analysis",
            "Diamond Processing & Classification",
            "Reachability Analysis with Belief Propagation",
            "Path Enumeration",
            "Monte Carlo Validation",
            "Parameter Override System",
            "TypeScript-Compatible JSON Responses"
        ]
    )
    
    return HTTP.Response(200, JSON_HEADERS, JSON.json(health_data))
end

"""
    options_handler(req::HTTP.Request) -> HTTP.Response

Handle CORS preflight OPTIONS requests.
"""
function options_handler(req::HTTP.Request)::HTTP.Response
    return HTTP.Response(200, CORS_HEADERS)
end

"""
    not_found_handler(req::HTTP.Request) -> HTTP.Response

Handle 404 Not Found responses.
"""
function not_found_handler(req::HTTP.Request)::HTTP.Response
    error_data = Dict{String, Any}(
        "success" => false,
        "error" => Dict{String, Any}(
            "message" => "API endpoint not found: $(req.target)",
            "code" => 404,
            "availableEndpoints" => [
                "GET  / - Health check",
                "POST /api/processinput - Process CSV input and return network structure",
                "POST /api/diamondprocessing - Identify diamond structures",
                "POST /api/diamondclassification - Classify diamond structures",
                "POST /api/reachabilitymodule - Perform reachability analysis",
                "POST /api/pathenum - Enumerate paths between nodes",
                "POST /api/montecarlo - Monte Carlo validation analysis"
            ]
        ),
        "timestamp" => string(now())
    )
    
    return HTTP.Response(404, JSON_HEADERS, JSON.json(error_data))
end

"""
    server_error_handler(error_message::String, status_code::Int = 500) -> HTTP.Response

Handle server errors with consistent formatting.
"""
function server_error_handler(error_message::String, status_code::Int = 500)::HTTP.Response
    error_data = Dict{String, Any}(
        "success" => false,
        "error" => Dict{String, Any}(
            "message" => error_message,
            "code" => status_code,
            "timestamp" => string(now())
        )
    )
    
    return HTTP.Response(status_code, JSON_HEADERS, JSON.json(error_data))
end

"""
    log_request(req::HTTP.Request)

Log incoming HTTP requests for monitoring and debugging.
"""
function log_request(req::HTTP.Request)
    timestamp = now()
    method = req.method
    target = req.target
    user_agent = get(Dict(req.headers), "User-Agent", "Unknown")
    
    println("📡 [$timestamp] $method $target - $user_agent")
end

"""
    start_server(host::String = "127.0.0.1", port::Int = 8080)

Start the HTTP server with the specified host and port.
"""
function start_server(host::String = "127.0.0.1", port::Int = 9090)
    # Setup UTF-8 encoding
    setup_utf8_encoding()
    
    # Import the router (include at top level, use here)
    include(joinpath(@__DIR__, "EndpointRouter.jl"))
    # Note: EndpointRouter module will be available after include
    
    println("🚀 Starting Information Propagation Analysis Framework Server")
    println("📍 Host: $host")
    println("🔌 Port: $port")
    println("🌐 URL: http://$host:$port")
    println("")
    println("🏗️ Features:")
    println("   • Clean Modular Architecture")
    println("   • 6 Specialized Analysis Endpoints")
    println("   • TypeScript-Compatible JSON Responses")
    println("   • Comprehensive Parameter Override System")
    println("   • Strict Input Validation")
    println("   • Monte Carlo Validation")
    println("   • Path Enumeration Analysis")
    println("   • Diamond Structure Classification")
    println("")
    println("📊 Available Endpoints:")
    println("   • POST /api/processinput        - Network structure processing")
    println("   • POST /api/diamondprocessing   - Diamond structure identification")
    println("   • POST /api/diamondclassification - Diamond classification analysis")
    println("   • POST /api/reachabilitymodule  - Reachability analysis with belief propagation")
    println("   • POST /api/pathenum            - Path enumeration between nodes")
    println("   • POST /api/montecarlo          - Monte Carlo validation analysis")
    println("   • GET  /                        - Health check and API documentation")
    println("")
    println("🔧 Technical Details:")
    println("   • UTF-8 encoding enabled")
    println("   • CORS headers configured")
    println("   • JSON responses with camelCase keys")
    println("   • Comprehensive error handling")
    println("   • Request logging enabled")
    println("")
    
    try
        # Start the HTTP server
        HTTP.serve(EndpointRouter.route_handler, host, port)
    catch e
        println("❌ Server startup failed: $e")
        rethrow(e)
    end
end

end # module ServerCore