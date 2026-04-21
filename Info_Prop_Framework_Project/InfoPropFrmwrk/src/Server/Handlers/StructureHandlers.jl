module StructureHandlers

using HTTP
using JSON
using Dates
using ..ServerCommon
using ..InfoPropFramework

function handle_network_structure(req::HTTP.Request)
    headers = ServerCommon.cors_headers_json(; methods="GET, POST, OPTIONS")

    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")

        if isempty(network_path)
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Network path required")))
        end

        resolved_edges_path = ServerCommon.resolve_edges_file_path(network_path, edges_file_path)
        is_valid, message = ServerCommon.validate_network_file(resolved_edges_path)
        if !is_valid
            return HTTP.Response(400, headers, JSON.json(Dict("success" => false, "message" => "Invalid network file: $(message)")))
        end

        start_time = time()
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(resolved_edges_path)
        allnodes = sort!(collect(union(Set(first.(edgelist)), Set(last.(edgelist)))))
        sink_nodes = sort!([node for node in allnodes if !haskey(outgoing_index, node) || isempty(outgoing_index[node])])

        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        computation_time = time() - start_time

        network_structure = Dict(
            "computation_time" => computation_time,
            "total_nodes" => length(allnodes),
            "total_edges" => length(edgelist),
            "nodes" => allnodes,
            "edges" => [[e[1], e[2]] for e in edgelist],
            "source_nodes" => sort!(collect(source_nodes)),
            "sink_nodes" => sink_nodes,
            "fork_nodes" => sort!(collect(fork_nodes)),
            "join_nodes" => sort!(collect(join_nodes)),
            "iteration_sets" => [sort!(collect(s)) for s in iteration_sets],
            "iteration_sets_count" => length(iteration_sets),
            "ancestors" => Dict(string(k) => sort!(collect(v)) for (k, v) in ancestors),
            "descendants" => Dict(string(k) => sort!(collect(v)) for (k, v) in descendants),
            "outgoing_index" => Dict(string(k) => sort!(collect(v)) for (k, v) in outgoing_index),
            "incoming_index" => Dict(string(k) => sort!(collect(v)) for (k, v) in incoming_index),
        )

        result = Dict(
            "success" => true,
            "message" => "Network structure analysis completed",
            "edges_file_path" => resolved_edges_path,
            "timestamp" => Dates.now(),
            "network_structure" => network_structure,
        )

        return HTTP.Response(200, headers, JSON.json(result))
    catch e
        return ServerCommon.error_response(req, e, "Network structure analysis failed"; headers=headers)
    end
end

function register!(router::HTTP.Router)
    HTTP.register!(router, "POST", "/network-structure", handle_network_structure)
end

end # module StructureHandlers
