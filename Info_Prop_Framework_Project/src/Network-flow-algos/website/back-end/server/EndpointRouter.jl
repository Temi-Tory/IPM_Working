"""
EndpointRouter.jl

HTTP request routing for the Information Propagation Analysis Framework.
Routes requests to appropriate endpoint handlers with error handling and logging.
"""
module EndpointRouter

using HTTP, JSON, Dates

# Import shared services first to ensure single instances
include(joinpath(@__DIR__, "services", "SessionManager.jl"))
include(joinpath(@__DIR__, "services", "ResponseFormatter.jl"))
include(joinpath(@__DIR__, "services", "InputProcessingIntegration.jl"))
include(joinpath(@__DIR__, "services", "NetworkService.jl"))

using .SessionManager
using .ResponseFormatter
using .InputProcessingIntegration
using .NetworkService

# Import all endpoint handlers
include(joinpath(@__DIR__, "endpoints", "ProcessInputEndpoint.jl"))
include(joinpath(@__DIR__, "endpoints", "DiamondProcessingEndpoint.jl"))
include(joinpath(@__DIR__, "endpoints", "DiamondClassificationEndpoint.jl"))
include(joinpath(@__DIR__, "endpoints", "ReachabilityEndpoint.jl"))
include(joinpath(@__DIR__, "endpoints", "PathEnumEndpoint.jl"))
include(joinpath(@__DIR__, "endpoints", "MonteCarloEndpoint.jl"))
include(joinpath(@__DIR__, "endpoints", "FileUploadEndpoints.jl"))
include(joinpath(@__DIR__, "endpoints", "CompleteNetworkEndpoint.jl"))

using .ProcessInputEndpoint
using .DiamondProcessingEndpoint
using .DiamondClassificationEndpoint
using .ReachabilityEndpoint
using .PathEnumEndpoint
using .MonteCarloEndpoint
using .FileUploadEndpoints
using .CompleteNetworkEndpoint

# Import server core utilities
include("ServerCore.jl")
using .ServerCore

export route_handler

"""
    route_handler(req::HTTP.Request) -> HTTP.Response

Main request router that dispatches requests to appropriate endpoint handlers.
Includes comprehensive error handling, logging, and CORS support.
"""
function route_handler(req::HTTP.Request)::HTTP.Response
    try
        # Log the incoming request
        log_request(req)
        
        # Handle CORS preflight requests
        if req.method == "OPTIONS"
            return options_handler(req)
        end
        
        # Route GET requests
        if req.method == "GET"
            if req.target == "/" || req.target == "/health"
                return health_check_handler(req)
            elseif startswith(req.target, "/api/upload/session-status")
                return handle_session_status(req)
            end
        end
        
        # Route POST requests to API endpoints
        if req.method == "POST"
            return route_post_request(req)
        end
        
        # Handle unsupported methods
        if req.method ∉ ["GET", "POST", "OPTIONS"]
            return server_error_handler("Method $(req.method) not allowed", 405)
        end
        
        # Default 404 for unmatched routes
        return not_found_handler(req)
        
    catch e
        # Global error handler
        println("❌ Unhandled server error: $e")
        println("   Request: $(req.method) $(req.target)")
        
        # Print stack trace for debugging
        for (exc, bt) in Base.catch_stack()
            showerror(stdout, exc, bt)
            println()
        end
        
        return server_error_handler("Internal server error: $(string(e))", 500)
    end
end

"""
    route_post_request(req::HTTP.Request) -> HTTP.Response

Route POST requests to specific endpoint handlers based on the target path.
Handles both JSON and multipart/form-data requests.
"""
function route_post_request(req::HTTP.Request)::HTTP.Response
    target = req.target
    
    # Check if this is a file upload endpoint (multipart/form-data)
    content_type = ""
    for (name, value) in req.headers
        if lowercase(name) == "content-type"
            content_type = value
            break
        end
    end
    
    # Handle file upload endpoints (multipart/form-data)
    if startswith(content_type, "multipart/form-data")
        if target == "/api/upload/network-structure"
            return handle_upload_network_structure(req)
        elseif target == "/api/upload/node-priors"
            return handle_upload_node_priors(req)
        elseif target == "/api/upload/link-probabilities"
            return handle_upload_link_probabilities(req)
        else
            return server_error_handler("Unknown file upload endpoint: $target", 404)
        end
    end
    
    # Handle JSON endpoints
    local parsed_json
    try
        body_str = String(req.body)
        if isempty(strip(body_str))
            return server_error_handler("POST request body cannot be empty", 400)
        end
        parsed_json = JSON.parse(body_str)
    catch e
        return server_error_handler("Invalid JSON in request body: $(string(e))", 400)
    end
    
    # Create request with parsed JSON body
    modified_req = HTTP.Request(req.method, req.target, req.headers, JSON.json(parsed_json))
    
    # Route to specific JSON endpoints
    if target == "/api/processinput"
        return handle_process_input(modified_req)
        
    elseif target == "/api/diamondprocessing"
        return handle_diamond_processing(modified_req)
        
    elseif target == "/api/diamondclassification"
        return handle_diamond_classification(modified_req)
        
    elseif target == "/api/reachabilitymodule"
        return handle_reachability_analysis(modified_req)
        
    elseif target == "/api/pathenum"
        return handle_path_enumeration(modified_req)
        
    elseif target == "/api/montecarlo"
        return handle_monte_carlo_analysis(modified_req)
        
    # New three-file network endpoints
    elseif target == "/api/upload/create-session"
        return handle_create_session(modified_req)
        
    elseif target == "/api/process-complete-network"
        return handle_process_complete_network(modified_req)
        
    else
        return not_found_handler(req)
    end
end

"""
    validate_endpoint_requirements(req::HTTP.Request, endpoint_name::String) -> Union{HTTP.Response, Nothing}

Validate common requirements for API endpoints.
Returns HTTP.Response if validation fails, nothing if validation passes.
"""
function validate_endpoint_requirements(req::HTTP.Request, endpoint_name::String)::Union{HTTP.Response, Nothing}
    try
        # Parse and validate JSON
        request_data = JSON.parse(String(req.body))
        
        # Check for required csvContent field
        if !haskey(request_data, "csvContent")
            error_response = Dict{String, Any}(
                "success" => false,
                "error" => Dict{String, Any}(
                    "message" => "Missing required field: csvContent",
                    "code" => 400,
                    "endpoint" => endpoint_name
                ),
                "timestamp" => string(now())
            )
            return HTTP.Response(400, JSON_HEADERS, JSON.json(error_response))
        end
        
        # Validate csvContent is not empty
        csv_content = request_data["csvContent"]
        if !isa(csv_content, String) || isempty(strip(csv_content))
            error_response = Dict{String, Any}(
                "success" => false,
                "error" => Dict{String, Any}(
                    "message" => "csvContent must be a non-empty string",
                    "code" => 400,
                    "endpoint" => endpoint_name
                ),
                "timestamp" => string(now())
            )
            return HTTP.Response(400, JSON_HEADERS, JSON.json(error_response))
        end
        
        return nothing  # Validation passed
        
    catch e
        error_response = Dict{String, Any}(
            "success" => false,
            "error" => Dict{String, Any}(
                "message" => "Request validation failed: $(string(e))",
                "code" => 400,
                "endpoint" => endpoint_name
            ),
            "timestamp" => string(now())
        )
        return HTTP.Response(400, JSON_HEADERS, JSON.json(error_response))
    end
end

"""
    get_endpoint_documentation() -> Dict

Get comprehensive API documentation for all endpoints.
"""
function get_endpoint_documentation()::Dict{String, Any}
    return Dict{String, Any}(
        "apiVersion" => "2.0.0",
        "title" => "Information Propagation Analysis Framework API",
        "description" => "Clean, modular API for network analysis with diamond processing, reachability analysis, and Monte Carlo validation",
        "baseUrl" => "http://localhost:9090",
        "endpoints" => Dict{String, Any}(
            "processinput" => Dict{String, Any}(
                "method" => "POST",
                "path" => "/api/processinput",
                "description" => "Process CSV input and return complete network structure data",
                "returns" => ["edgelist", "outgoing_index", "incoming_index", "source_nodes", "node_priors", "edge_probabilities", "fork_nodes", "join_nodes", "iteration_sets", "ancestors", "descendants"],
                "requiredFields" => ["csvContent"],
                "optionalFields" => []
            ),
            "diamondprocessing" => Dict{String, Any}(
                "method" => "POST",
                "path" => "/api/diamondprocessing",
                "description" => "Identify and return diamond structures in the network",
                "returns" => ["diamond_structures", "diamond_statistics"],
                "requiredFields" => ["csvContent"],
                "optionalFields" => []
            ),
            "diamondclassification" => Dict{String, Any}(
                "method" => "POST",
                "path" => "/api/diamondclassification",
                "description" => "Classify diamond structures with detailed analysis",
                "returns" => ["diamond_classifications", "classification_statistics"],
                "requiredFields" => ["csvContent"],
                "optionalFields" => []
            ),
            "reachabilitymodule" => Dict{String, Any}(
                "method" => "POST",
                "path" => "/api/reachabilitymodule",
                "description" => "Perform reachability analysis using belief propagation",
                "returns" => ["node_probabilities", "analysis_metadata"],
                "requiredFields" => ["csvContent"],
                "optionalFields" => ["nodePrior", "edgeProb", "overrideNodePrior", "overrideEdgeProb", "useIndividualOverrides", "individualNodePriors", "individualEdgeProbabilities"]
            ),
            "pathenum" => Dict{String, Any}(
                "method" => "POST",
                "path" => "/api/pathenum",
                "description" => "Enumerate paths between nodes with probability analysis",
                "returns" => ["paths", "path_probabilities", "path_statistics"],
                "requiredFields" => ["csvContent"],
                "optionalFields" => ["sourceNode", "targetNode", "maxPaths", "maxDepth"]
            ),
            "montecarlo" => Dict{String, Any}(
                "method" => "POST",
                "path" => "/api/montecarlo",
                "description" => "Monte Carlo validation analysis with algorithm comparison",
                "returns" => ["monte_carlo_results", "validation_statistics"],
                "requiredFields" => ["csvContent"],
                "optionalFields" => ["iterations", "includeAlgorithmComparison", "nodePrior", "edgeProb", "overrideNodePrior", "overrideEdgeProb", "useIndividualOverrides"]
            )
        ),
        "commonParameters" => Dict{String, Any}(
            "csvContent" => "String - CSV adjacency matrix content (required for all endpoints)",
            "nodePrior" => "Float - Global node prior probability (0.0-1.0)",
            "edgeProb" => "Float - Global edge probability (0.0-1.0)",
            "overrideNodePrior" => "Boolean - Whether to override all node priors with global value",
            "overrideEdgeProb" => "Boolean - Whether to override all edge probabilities with global value",
            "useIndividualOverrides" => "Boolean - Whether to apply individual parameter overrides",
            "individualNodePriors" => "Object - Individual node prior overrides {nodeId: probability}",
            "individualEdgeProbabilities" => "Object - Individual edge probability overrides {\"(src,dst)\": probability}"
        ),
        "responseFormat" => Dict{String, Any}(
            "success" => "Boolean - Whether the request was successful",
            "timestamp" => "String - ISO timestamp of the response",
            "endpointType" => "String - The endpoint that generated the response",
            "data" => "Object - The actual response data (varies by endpoint)",
            "error" => "Object - Error information (only present if success=false)"
        ),
        "examples" => Dict{String, Any}(
            "basicRequest" => Dict{String, Any}(
                "csvContent" => "0,1,0\n1,0,1\n0,1,0"
            ),
            "withParameterOverrides" => Dict{String, Any}(
                "csvContent" => "0,1,0\n1,0,1\n0,1,0",
                "nodePrior" => 0.8,
                "edgeProb" => 0.9,
                "overrideNodePrior" => true,
                "overrideEdgeProb" => true
            ),
            "withIndividualOverrides" => Dict{String, Any}(
                "csvContent" => "0,1,0\n1,0,1\n0,1,0",
                "useIndividualOverrides" => true,
                "individualNodePriors" => Dict("1" => 0.9, "2" => 0.7),
                "individualEdgeProbabilities" => Dict("(1,2)" => 0.95, "(2,3)" => 0.85)
            )
        )
    )
end

end # module EndpointRouter