module InfoPropServer

using HTTP
using JSON

include(joinpath(@__DIR__, "..", "Algorithms", "InfoPropFramework.jl"))
using .InfoPropFramework

include(joinpath(@__DIR__, "Core", "Common.jl"))
using .ServerCommon

include(joinpath(@__DIR__, "Handlers", "UploadHandlers.jl"))
using .UploadHandlers

include(joinpath(@__DIR__, "Handlers", "StructureHandlers.jl"))
using .StructureHandlers

include(joinpath(@__DIR__, "Handlers", "CapacityHandlers.jl"))
using .CapacityHandlers

function handle_cors(req::HTTP.Request)
    headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
    ]

    if req.method == "OPTIONS"
        return HTTP.Response(200, headers)
    end

    return nothing
end

function register_routes!(router::HTTP.Router)
    HTTP.register!(router, "OPTIONS", "/*", handle_cors)
    HTTP.register!(router, "OPTIONS", "/upload", handle_cors)
    HTTP.register!(router, "OPTIONS", "/sessions", handle_cors)
    HTTP.register!(router, "OPTIONS", "/sessions/*", handle_cors)
    HTTP.register!(router, "OPTIONS", "/files/*", handle_cors)
    HTTP.register!(router, "OPTIONS", "/network-structure", handle_cors)
    HTTP.register!(router, "OPTIONS", "/capacity-analysis", handle_cors)
    HTTP.register!(router, "OPTIONS", "/health", handle_cors)

    UploadHandlers.register!(router)
    StructureHandlers.register!(router)
    CapacityHandlers.register!(router)

    HTTP.register!(router, "GET", "/health", req -> HTTP.Response(200, ServerCommon.cors_headers_json(), JSON.json(Dict("status" => "healthy", "server" => "InfoPropServer"))))
end

function start_server(host::AbstractString="0.0.0.0", port::Integer=ServerCommon.PORT)
    ServerCommon.setup_server()

    router = HTTP.Router()
    register_routes!(router)

    println("Starting modular InfoProp server on $(host):$(port)")
    HTTP.serve(router, String(host), Int(port))
end

export start_server, register_routes!

end # module InfoPropServer
