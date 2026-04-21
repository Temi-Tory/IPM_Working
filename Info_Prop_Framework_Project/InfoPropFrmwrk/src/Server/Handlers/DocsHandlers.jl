module DocsHandlers

using HTTP
using JSON
using ..ServerCommon

function handle_docs_request(req::HTTP.Request)
    headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "text/markdown; charset=utf-8",
    ]

    try
        uri = HTTP.URI(req.target)
        path_parts = split(uri.path, "/")

        if length(path_parts) < 3 || path_parts[2] != "docs"
            return HTTP.Response(400, headers, "Invalid docs path format. Expected: /docs/filename.md")
        end

        filename = join(path_parts[3:end], "/")
        docs_dir = joinpath(@__DIR__, "..", "docs")
        full_path = normpath(joinpath(docs_dir, filename))

        if !startswith(full_path, normpath(docs_dir))
            return HTTP.Response(403, headers, "Access denied: path traversal not allowed")
        end

        if !isfile(full_path)
            return HTTP.Response(404, headers, "Documentation file not found: $(filename)")
        end

        return HTTP.Response(200, headers, read(full_path, String))
    catch e
        return ServerCommon.error_response(req, e, "Failed to serve documentation"; headers=ServerCommon.cors_headers_json(; methods="GET, OPTIONS"))
    end
end

function handle_docs_list(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, OPTIONS")

    try
        docs_dir = joinpath(@__DIR__, "..", "docs")
        if !isdir(docs_dir)
            return HTTP.Response(200, headers, JSON.json(Dict("files" => Any[])))
        end

        files = sort!(filter(f -> endswith(lowercase(f), ".md"), readdir(docs_dir)))
        return HTTP.Response(200, headers, JSON.json(Dict("files" => files)))
    catch e
        return ServerCommon.error_response(req, e, "Failed to list docs"; headers=headers)
    end
end

function register!(router::HTTP.Router)
    HTTP.register!(router, "GET", "/docs-list", handle_docs_list)
    HTTP.register!(router, "GET", "/docs/*", handle_docs_request)
end

end # module DocsHandlers
