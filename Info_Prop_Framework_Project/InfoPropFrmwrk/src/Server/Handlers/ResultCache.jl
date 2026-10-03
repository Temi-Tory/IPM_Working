module ResultCache

# Saved analysis results. An analysis request inside an uploaded session is answered from
# <session>/result_cache/ when the same request has been computed before against the same
# input files; otherwise the handler runs and its JSON body is saved. The key covers the
# endpoint, every request option, and the path + mtime + size of every input file the request
# names, so editing or re-uploading an input can never be answered with an old result.
# Stored as plain JSON (never Serialization) and returned as-is. `"forceRecompute": true`
# skips the lookup and overwrites the saved result. Requests outside a session (scripted runs
# pointing networkPath at a corpus folder) are never cached.
#
# Every response gets a leading field
#   "result_cache": {"hit": true|false, "computed_at": "<UTC ISO time>"}
# spliced into the JSON text, so large bodies are not re-parsed.

using HTTP
using JSON
using SHA
using Dates
using ..ServerCommon

export cached

const KEY_EXCLUDE = ("forceRecompute",)

_canon(x::AbstractDict) =
    "{" * join(["$(JSON.json(string(k))):$(_canon(x[k]))" for k in sort!(collect(keys(x)); by=string)], ",") * "}"
_canon(x::AbstractVector) = "[" * join([_canon(v) for v in x], ",") * "]"
_canon(x) = JSON.json(x)

function _session_dir(network_path::AbstractString)
    segments = filter(!isempty, split(ServerCommon.normalize_path_separators(network_path), '/'))
    for i in 1:(length(segments) - 1)
        lowercase(segments[i]) == lowercase(ServerCommon.UPLOAD_DIR) || continue
        id = String(segments[i + 1])
        occursin(r"^[A-Za-z0-9_-]+$", id) || return nothing
        dir = joinpath(ServerCommon.UPLOAD_DIR, id)
        return isdir(dir) ? dir : nothing
    end
    return nothing
end

function _file_token(path::AbstractString)
    isempty(path) && return "none"
    isfile(path) || return "missing"
    st = stat(path)
    return "$(st.mtime):$(st.size)"
end

_str(data, key) = (v = get(data, key, ""); v isa AbstractString ? String(v) : "")

function _cache_path(endpoint::AbstractString, data::AbstractDict)
    network_path = _str(data, "networkPath")
    isempty(network_path) && return nothing
    dir = _session_dir(network_path)
    dir === nothing && return nothing

    edges = ServerCommon.resolve_edges_file_path(
        network_path, _str(data, "edgesFilePath");
        capacities_path=_str(data, "capacitiesPath"),
        linkprobs_path=_str(data, "linkprobsPath"),
        cpm_path=_str(data, "cpmPath"),
    )
    tokens = ["edges=$(edges)@$(_file_token(edges))"]
    for k in sort!(collect(keys(data)); by=string)
        ks = string(k)
        (endswith(ks, "Path") && !(ks in ("networkPath", "edgesFilePath"))) || continue
        v = _str(data, ks)
        isempty(v) && continue
        p = ServerCommon.resolve_network_file_path(network_path, v)
        push!(tokens, "$(ks)=$(p)@$(_file_token(p))")
    end

    key_data = Dict(string(k) => v for (k, v) in data if !(string(k) in KEY_EXCLUDE))
    digest = bytes2hex(sha256(join([String(endpoint), _canon(key_data), tokens...], "\n")))
    return joinpath(dir, "result_cache", "$(endpoint)-$(digest[1:32]).json")
end

function _with_info(body::AbstractString, info)
    rest = body[2:end]   # body starts with '{', a single byte
    sep = startswith(lstrip(rest), "}") ? "" : ","
    return "{\"result_cache\":" * JSON.json(info) * sep * rest
end

_iso_utc(t::DateTime) = Dates.format(t, dateformat"yyyy-mm-ddTHH:MM:SS") * "Z"

"""
    cached(handler, endpoint) -> request handler

Wrap an analysis handler with the saved-result lookup described at the top of this module.
"""
function cached(handler, endpoint::AbstractString)
    return function (req::HTTP.Request)
        data = try
            JSON.parse(String(copy(req.body)))
        catch
            nothing
        end
        data isa AbstractDict || return handler(req)

        # Any failure to build a key (bad or disallowed path) falls through to the handler,
        # which reports it properly.
        path = try
            _cache_path(endpoint, data)
        catch
            nothing
        end
        path === nothing && return handler(req)

        force = get(data, "forceRecompute", false) === true
        if !force && isfile(path)
            body = try
                read(path, String)
            catch
                ""
            end
            if startswith(body, "{")
                info = Dict("hit" => true, "computed_at" => _iso_utc(Dates.unix2datetime(mtime(path))))
                headers = ServerCommon.cors_headers_json(; methods="GET, POST, OPTIONS")
                return HTTP.Response(200, headers, _with_info(body, info))
            end
        end

        resp = handler(req)
        resp.status == 200 || return resp
        body = String(copy(resp.body))
        startswith(body, "{") || return resp
        try
            mkpath(dirname(path))
            tmp = path * ".tmp"
            write(tmp, body)
            mv(tmp, path; force=true)
        catch e
            println(stderr, "[result-cache] could not save $(path): $(e)")
        end
        info = Dict("hit" => false, "computed_at" => _iso_utc(Dates.now(Dates.UTC)))
        return HTTP.Response(200, resp.headers, _with_info(body, info))
    end
end

end # module ResultCache
