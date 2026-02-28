# Flexible Multi-Scenario Backend Server for Network Analysis
# Supports user-specified input paths for each analysis scenario
# Based on expected raw results structure and Julia algorithm requirements

using HTTP, JSON
using Dates, UUIDs
using ProbabilityBoundsAnalysis

# Include the IPAFramework module
include("src/IPAFramework.jl")
using .IPAFramework

# Import types for type checking
const pbox = ProbabilityBoundsAnalysis.pbox
const Interval = IPAFramework.Interval

const UPLOAD_DIR = "temp_uploads"
const PORT = 8080

function normalize_path_separators(path::String)
    """Normalize path separators to forward slashes and remove duplicate separators"""
    try
        if isempty(path)
            return path
        end
        
        # Replace all backslashes with forward slashes
        normalized = replace(path, "\\" => "/")
        
        # Remove duplicate forward slashes (but preserve leading // for UNC paths if needed)
        normalized = replace(normalized, r"/+" => "/")
        
        # Remove leading slash if it exists (for relative paths)
        if startswith(normalized, "/") && !startswith(normalized, "//")
            normalized = normalized[2:end]
        end
        
        return normalized
    catch e
        println("ERROR in normalize_path_separators:")
        println("  path: '$path'")
        println("  error: $e")
        rethrow(e)
    end
end

function safe_joinpath(base_path::String, relative_path::String)
    """Safely join paths with proper separator normalization"""
    try
        normalized_base = normalize_path_separators(base_path)
        normalized_relative = normalize_path_separators(relative_path)
        
        # Use Julia's joinpath with normalized paths
        result = joinpath(normalized_base, normalized_relative)
        
        # Ensure consistent forward slashes in the result
        return replace(result, "\\" => "/")
    catch e
        println("ERROR in safe_joinpath:")
        println("  base_path: '$base_path'")
        println("  relative_path: '$relative_path'")
        println("  error: $e")
        rethrow(e)
    end
end

function safe_joinpath_with_dedup(base_path::String, relative_path::String)
    """Safely join paths with duplicate segment detection - ONLY for reachability analysis"""
    normalized_base = normalize_path_separators(base_path)
    normalized_relative = normalize_path_separators(relative_path)
    
    # Check for duplicate path segments
    # If base ends with a segment that relative starts with, remove the duplicate
    if !isempty(normalized_base) && !isempty(normalized_relative)
        base_parts = split(normalized_base, "/")
        relative_parts = split(normalized_relative, "/")
        
        # Check if the last part of base matches the first part of relative
        if !isempty(base_parts) && !isempty(relative_parts) &&
           base_parts[end] == relative_parts[1]
            # Remove the duplicate segment from relative path
            normalized_relative = join(relative_parts[2:end], "/")
        end
    end
    
    # Use Julia's joinpath with normalized paths
    result = joinpath(normalized_base, normalized_relative)
    
    # Ensure consistent forward slashes in the result
    return replace(result, "\\" => "/")
end

function pbox_to_dict(pbox::ProbabilityBoundsAnalysis.pbox)
    """Convert a Pbox object to a JSON-serializable dictionary with reduced discretization"""
    # Only include summary statistics, not full discretization arrays
    return Dict(
        "type" => "pbox",
        "mean_lower" => pbox.ml,
        "mean_upper" => pbox.mh,
        "var_lower" => pbox.vl,
        "var_upper" => pbox.vh,
        "shape" => string(pbox.shape),
        "name" => pbox.name,
        "bounded" => pbox.bounded,
        "discretization_size" => pbox.n,
        # Only include first, last, and quartile points instead of full arrays
        "bounds_summary" => Dict(
            "left_min" => length(pbox.u) > 0 ? pbox.u[1] : 0.0,
            "left_max" => length(pbox.u) > 0 ? pbox.u[end] : 0.0,
            "right_min" => length(pbox.d) > 0 ? pbox.d[1] : 0.0,
            "right_max" => length(pbox.d) > 0 ? pbox.d[end] : 0.0
        )
    )
end

function convert_pbox_values(obj)
    """Recursively convert any Pbox objects in a data structure to dictionaries"""
    if isa(obj, ProbabilityBoundsAnalysis.pbox)
        return pbox_to_dict(obj)
    elseif isa(obj, Dict)
        return Dict(k => convert_pbox_values(v) for (k, v) in obj)
    elseif isa(obj, Array)
        return [convert_pbox_values(item) for item in obj]
    else
        return obj
    end
end

function setup_server()
    # Create upload directory if it doesn't exist
    if !isdir(UPLOAD_DIR)
        mkdir(UPLOAD_DIR)
    end
    println("Flexible Multi-Scenario Backend Server starting on port $PORT...")
    println("Upload directory: $UPLOAD_DIR")
end

function validate_network_file(edges_file_path::String)
    # Simple validation - just check if .EDGES file exists
    if !isfile(edges_file_path)
        return false, "Missing .EDGES file: $edges_file_path"
    end
    return true, "Valid .EDGES file"
end

function create_default_node_priors(allnodes::Vector{Int64})
    """Create default node priors (all 1.0) for diamond-only analysis"""
    return Dict{Int64, Float64}(node => 1.0 for node in allnodes)
end

function serialize_root_diamonds_for_json(root_diamonds_dict)
    """Helper function to serialize root diamond structures (DiamondsAtNode) for JSON response"""
    serialized = Dict()
    for (join_node, diamonds_at_node) in root_diamonds_dict
        # diamonds_at_node is of type DiamondsAtNode
        serialized[string(join_node)] = Dict(
            "join_node" => diamonds_at_node.join_node,
            "diamond" => Dict(
                "conditioning_nodes" => collect(diamonds_at_node.diamond.conditioning_nodes),
                "relevant_nodes" => collect(diamonds_at_node.diamond.relevant_nodes),
                "edgelist" => collect(diamonds_at_node.diamond.edgelist),
                "edge_count" => length(diamonds_at_node.diamond.edgelist),
                "node_count" => length(diamonds_at_node.diamond.relevant_nodes)
            ),
            "non_diamond_parents" => collect(diamonds_at_node.non_diamond_parents)
        )
    end
    return serialized
end

function serialize_unique_diamonds_for_json(unique_diamonds_dict)
    """Helper function to serialize unique diamond structures (DiamondComputationData) for JSON response"""
    serialized = Dict()
    
    for (diamond_hash, diamond_data) in unique_diamonds_dict
        # diamond_data is of type DiamondComputationData{T}
        # Use the is_rootDiamond field from the struct directly!
        
        # Serialize sub_diamond_structures (Dict{Int64, DiamondsAtNode})
        sub_diamond_structures_serialized = Dict()
        for (join_node, diamonds_at_node) in diamond_data.sub_diamond_structures
            # Calculate the sub-diamond hash using DiamondProcessingModule's function
            sub_diamond_hash = IPAFramework.create_diamond_hash_key(diamonds_at_node.diamond)
            
            sub_diamond_structures_serialized[string(join_node)] = Dict(
                "join_node" => diamonds_at_node.join_node,
                "sub_diamond_hash" => string(sub_diamond_hash),  # NEW: Include the hash
                "diamond" => Dict(
                    "conditioning_nodes" => collect(diamonds_at_node.diamond.conditioning_nodes),
                    "relevant_nodes" => collect(diamonds_at_node.diamond.relevant_nodes),
                    "edgelist" => collect(diamonds_at_node.diamond.edgelist),
                    "edge_count" => length(diamonds_at_node.diamond.edgelist),
                    "node_count" => length(diamonds_at_node.diamond.relevant_nodes)
                ),
                "non_diamond_parents" => collect(diamonds_at_node.non_diamond_parents)
            )
        end
        
        serialized[string(diamond_hash)] = Dict(
            "diamond_hash" => string(diamond_hash),
            "is_root_diamond" => diamond_data.is_rootDiamond,  # <-- USE STRUCT FIELD
            "sub_outgoing_index" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_outgoing_index),
            "sub_incoming_index" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_incoming_index),
            "sub_sources" => collect(diamond_data.sub_sources),
            "sub_fork_nodes" => collect(diamond_data.sub_fork_nodes),
            "sub_join_nodes" => collect(diamond_data.sub_join_nodes),
            "sub_ancestors" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_ancestors),
            "sub_descendants" => Dict(string(k) => collect(v) for (k, v) in diamond_data.sub_descendants),
            "sub_iteration_sets" => [collect(s) for s in diamond_data.sub_iteration_sets],
            "sub_iteration_sets_count" => length(diamond_data.sub_iteration_sets),
            "sub_node_priors" => Dict(string(k) => convert_pbox_values(v) for (k, v) in diamond_data.sub_node_priors),
            "node_count" => length(diamond_data.sub_node_priors),
            # NEW: Include missing fields from DiamondComputationData struct
            "sub_diamond_structures" => sub_diamond_structures_serialized,
            "diamond" => Dict(
                "conditioning_nodes" => collect(diamond_data.diamond.conditioning_nodes),
                "relevant_nodes" => collect(diamond_data.diamond.relevant_nodes),
                "edgelist" => collect(diamond_data.diamond.edgelist),
                "edge_count" => length(diamond_data.diamond.edgelist),
                "node_count" => length(diamond_data.diamond.relevant_nodes)
            )
        )
    end
  
    # **FIXED: Add sub-diamonds as separate top-level entries using their actual DiamondComputationData**
    for (diamond_hash, diamond_data) in unique_diamonds_dict
        for (join_node, diamonds_at_node) in diamond_data.sub_diamond_structures
            sub_diamond_hash = IPAFramework.create_diamond_hash_key(diamonds_at_node.diamond)
            
            # **CRITICAL: Look up the actual DiamondComputationData for this sub-diamond**
            if haskey(unique_diamonds_dict, sub_diamond_hash)
                # Use the complete DiamondComputationData for the sub-diamond
                sub_diamond_data = unique_diamonds_dict[sub_diamond_hash]
                
                # Serialize sub_diamond_structures for this sub-diamond
                sub_diamond_sub_structures_serialized = Dict()
                for (sub_join_node, sub_diamonds_at_node) in sub_diamond_data.sub_diamond_structures
                    nested_sub_diamond_hash = IPAFramework.create_diamond_hash_key(sub_diamonds_at_node.diamond)
                    
                    sub_diamond_sub_structures_serialized[string(sub_join_node)] = Dict(
                        "join_node" => sub_diamonds_at_node.join_node,
                        "sub_diamond_hash" => string(nested_sub_diamond_hash),
                        "diamond" => Dict(
                            "conditioning_nodes" => collect(sub_diamonds_at_node.diamond.conditioning_nodes),
                            "relevant_nodes" => collect(sub_diamonds_at_node.diamond.relevant_nodes),
                            "edgelist" => collect(sub_diamonds_at_node.diamond.edgelist),
                            "edge_count" => length(sub_diamonds_at_node.diamond.edgelist),
                            "node_count" => length(sub_diamonds_at_node.diamond.relevant_nodes)
                        ),
                        "non_diamond_parents" => collect(sub_diamonds_at_node.non_diamond_parents)
                    )
                end
                
                # Create complete entry for sub-diamond with all its data
                serialized[string(sub_diamond_hash)] = Dict(
                    "diamond_hash" => string(sub_diamond_hash),
                    "is_root_diamond" => sub_diamond_data.is_rootDiamond,
                    "sub_outgoing_index" => Dict(string(k) => collect(v) for (k, v) in sub_diamond_data.sub_outgoing_index),
                    "sub_incoming_index" => Dict(string(k) => collect(v) for (k, v) in sub_diamond_data.sub_incoming_index),
                    "sub_sources" => collect(sub_diamond_data.sub_sources),
                    "sub_fork_nodes" => collect(sub_diamond_data.sub_fork_nodes),
                    "sub_join_nodes" => collect(sub_diamond_data.sub_join_nodes),
                    "sub_ancestors" => Dict(string(k) => collect(v) for (k, v) in sub_diamond_data.sub_ancestors),
                    "sub_descendants" => Dict(string(k) => collect(v) for (k, v) in sub_diamond_data.sub_descendants),
                    "sub_iteration_sets" => [collect(s) for s in sub_diamond_data.sub_iteration_sets],
                    "sub_iteration_sets_count" => length(sub_diamond_data.sub_iteration_sets),
                    "sub_node_priors" => Dict(string(k) => convert_pbox_values(v) for (k, v) in sub_diamond_data.sub_node_priors),
                    "node_count" => length(sub_diamond_data.sub_node_priors),
                    "sub_diamond_structures" => sub_diamond_sub_structures_serialized,  # **FIXED: Include nested sub-diamonds**
                    "diamond" => Dict(
                        "conditioning_nodes" => collect(sub_diamond_data.diamond.conditioning_nodes),
                        "relevant_nodes" => collect(sub_diamond_data.diamond.relevant_nodes),
                        "edgelist" => collect(sub_diamond_data.diamond.edgelist),
                        "edge_count" => length(sub_diamond_data.diamond.edgelist),
                        "node_count" => length(sub_diamond_data.diamond.relevant_nodes)
                    ),
                    "join_node" => diamonds_at_node.join_node,
                    "non_diamond_parents" => collect(diamonds_at_node.non_diamond_parents)
                )
            end
        end
    end

    return serialized
end


function parse_multipart_data(body_str::String, boundary::String, upload_path::String)
    """Parse multipart/form-data and save files to upload directory"""
    uploaded_files = String[]
    
    # Split by boundary
    parts = split(body_str, "--" * boundary)
    
    for part in parts
        part = strip(part)
        if isempty(part) || part == "--" continue end
        
        # Split headers from content
        header_end = findfirst("\r\n\r\n", part)
        if header_end === nothing
            header_end = findfirst("\n\n", part)
            if header_end === nothing continue end
        end
        
        headers = part[1:header_end[1]-1]
        content = part[header_end[end]+1:end]
        
        # Extract filename from Content-Disposition header
        filename_pattern = r"filename=\"([^\"]+)\""
        filename_match = match(filename_pattern, headers)
        if filename_match === nothing continue end
        
        filename = filename_match.captures[1]
        
        # Skip empty files
        if isempty(strip(content)) continue end
        
        # Clean up content (remove trailing boundary markers)
        content = rstrip(content, ['\r', '\n', '-'])
        
        # Save file to upload directory - use Julia's built-in joinpath with normalization
        # Normalize both paths to use forward slashes before joining
        normalized_upload_path = replace(upload_path, "\\" => "/")
        normalized_filename = replace(filename, "\\" => "/")
        file_path = joinpath(normalized_upload_path, normalized_filename)
        # Ensure result uses forward slashes
        file_path = replace(file_path, "\\" => "/")
        
        # Create subdirectories if needed
        file_dir = dirname(file_path)
        if file_dir != upload_path
            mkpath(file_dir)
        end
        
        # Write file
        open(file_path, "w") do io
            write(io, content)
        end
        
        push!(uploaded_files, filename)
        println("Saved uploaded file: $filename ($(length(content)) bytes)")
    end
    
    return uploaded_files
end

# Removed organize_uploaded_files, determine_file_location, and scan_available_data_files
# Backend now saves files with original paths without organization

# File serving endpoint for frontend to fetch JSON files directly
function handle_file_request(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        # Extract file path from URL
        uri = HTTP.URI(req.target)
        path_parts = split(uri.path, "/")
        
        if length(path_parts) < 4 || path_parts[2] != "files"
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid file path format. Expected: /files/network_path/relative_file_path"
            )))
        end
        
        # Reconstruct network path and file path
        network_path = path_parts[3]
        file_path = join(path_parts[4:end], "/")
        
        # Construct full file path - use Julia's built-in joinpath with normalization
        normalized_network_path = replace(network_path, "\\" => "/")
        normalized_file_path = replace(file_path, "\\" => "/")
        full_file_path = joinpath(normalized_network_path, normalized_file_path)
        full_file_path = replace(full_file_path, "\\" => "/")
        
        if !isfile(full_file_path)
            return HTTP.Response(404, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "File not found: $full_file_path"
            )))
        end
        
        # Read and return file content
        file_content = JSON.parsefile(full_file_path)
        return HTTP.Response(200, cors_headers, JSON.json(file_content))
        
    catch e
        println("File request error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Failed to serve file"
        )))
    end
end

# Individual Analysis Endpoint Handlers

function handle_network_structure(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        
        if isempty(network_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path required"
            )))
        end
        
        # If edges file path not provided, try to find it
        if isempty(edges_file_path)
            # Look for .EDGES files in the network path
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    # Use Julia's built-in joinpath with normalization
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        # Network Structure Analysis Only
        start_time = time()
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        
        # Identify network structure
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        computation_time = time() - start_time
        
        network_structure = Dict(
            "computation_time" => computation_time,
            "total_nodes" => length(allnodes),
            "total_edges" => length(edgelist),
            "nodes" => allnodes,
            "edges" => [(e[1], e[2]) for e in edgelist],
            "source_nodes" => collect(source_nodes),
            "sink_nodes" => collect(sink_nodes),
            "fork_nodes" => collect(fork_nodes),
            "join_nodes" => collect(join_nodes),
            "iteration_sets" => [collect(s) for s in iteration_sets],
            "iteration_sets_count" => length(iteration_sets),
            "ancestors" => Dict(string(k) => collect(v) for (k, v) in ancestors),
            "descendants" => Dict(string(k) => collect(v) for (k, v) in descendants),
            "outgoing_index" => Dict(string(k) => collect(v) for (k, v) in outgoing_index),
            "incoming_index" => Dict(string(k) => collect(v) for (k, v) in incoming_index)
        )
        
        result = Dict(
            "success" => true,
            "message" => "Network structure analysis completed",
            "edges_file_path" => edges_file_path,
            "timestamp" => Dates.now(),
            "network_structure" => network_structure
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Network structure analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Network structure analysis failed"
        )))
    end
end

function handle_diamond_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        nodepriors_path = get(request_data, "nodepriorsPath", "")  # Optional
        
        if isempty(network_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path required"
            )))
        end
        
        # Determine edges file path
        if isempty(edges_file_path)
            # Look for .EDGES files in the network path
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    # Use Julia's built-in joinpath with normalization
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        # Load network structure
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Diamond Analysis
        start_time = time()
        
        # Load node priors if specified, otherwise use defaults
        node_priors = if !isempty(nodepriors_path)
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_nodepriors_path = replace(nodepriors_path, "\\" => "/")
            full_path = joinpath(normalized_network_path, normalized_nodepriors_path)
            full_path = replace(full_path, "\\" => "/")
            
            if isfile(full_path)
                try
                    println("🔍 Loading node priors from: $full_path")
                    priors = read_node_priors_from_json(full_path)
                    println("🔍 Node priors type: $(typeof(priors))")
                    if !isempty(priors)
                        first_val = first(values(priors))
                        println("🔍 First node prior type: $(typeof(first_val))")
                        if isa(first_val, pbox)
                            println("🔍 Pbox properties: ml=$(first_val.ml), mh=$(first_val.mh)")
                        end
                    end
                    priors
                catch e
                    println("❌ Error loading node priors: $e")
                    println("🔄 Falling back to default node priors")
                    create_default_node_priors(allnodes)
                end
            else
                create_default_node_priors(allnodes)
            end
        else
            create_default_node_priors(allnodes)
        end
        
        # Root diamonds with comprehensive error handling
        root_diamonds = try
            println("🔍 Starting identify_and_group_diamonds with:")
            println("  - Join nodes: $(length(join_nodes))")
            println("  - Source nodes: $(length(source_nodes))")
            println("  - Fork nodes: $(length(fork_nodes))")
            println("  - Node priors type: $(typeof(node_priors))")
            if !isempty(node_priors)
                first_key = first(keys(node_priors))
                first_val = node_priors[first_key]
                println("  - First node prior ($first_key): $(typeof(first_val))")
                if isa(first_val, pbox)
                    println("    - Pbox ml: $(first_val.ml), mh: $(first_val.mh)")
                end
            end
            
            result = identify_and_group_diamonds(
                join_nodes, incoming_index, ancestors, descendants,
                source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
            )
            
            println("✅ identify_and_group_diamonds completed successfully")
            result
        catch e
            println("❌ Error in identify_and_group_diamonds: $e")
            println("❌ Error type: $(typeof(e))")
            if isa(e, MethodError)
                println("❌ MethodError details:")
                println("  - Function: $(e.f)")
                println("  - Arguments types: $(typeof.(e.args))")
                println("  - Arguments values: $(e.args)")
            end
            
            # Print stack trace for debugging
            println("❌ Stack trace:")
            for (i, frame) in enumerate(stacktrace(catch_backtrace()))
                println("  $i: $frame")
                if i > 15  # Show more stack trace for debugging
                    break
                end
            end
            
            rethrow(e)
        end
        root_computation_time = time() - start_time
        
        # Unique diamonds with comprehensive error handling
        unique_start_time = time()
        unique_diamonds = try
            println("🔍 Starting build_unique_diamond_storage_depth_first_parallel with:")
            println("  - Root diamonds count: $(length(root_diamonds))")
            println("  - Node priors type: $(typeof(node_priors))")
            
            result = build_unique_diamond_storage_depth_first_parallel(
                root_diamonds, node_priors, ancestors, descendants, iteration_sets
            )
            
            println("✅ build_unique_diamond_storage_depth_first_parallel completed successfully")
            result
        catch e
            println("❌ Error in build_unique_diamond_storage_depth_first_parallel: $e")
            println("❌ Error type: $(typeof(e))")
            if isa(e, MethodError)
                println("❌ MethodError details:")
                println("  - Function: $(e.f)")
                println("  - Arguments types: $(typeof.(e.args))")
                println("  - Arguments values: $(e.args)")
            end
            
            # Print stack trace for debugging
            println("❌ Stack trace:")
            for (i, frame) in enumerate(stacktrace(catch_backtrace()))
                println("  $i: $frame")
                if i > 15  # Show more stack trace for debugging
                    break
                end
            end
            
            rethrow(e)
        end
        unique_computation_time = time() - unique_start_time
        
        diamond_analysis = Dict(
            "root_diamonds_count" => length(root_diamonds),
            "unique_diamonds_count" => length(unique_diamonds),
            "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
            "root_computation_time" => root_computation_time,
            "unique_computation_time" => unique_computation_time,
            "total_computation_time" => root_computation_time + unique_computation_time,
            "diamond_efficiency" => length(unique_diamonds) / max(1, length(root_diamonds)),
            "raw_root_diamonds" => serialize_root_diamonds_for_json(root_diamonds),
            "raw_unique_diamonds" => serialize_unique_diamonds_for_json(unique_diamonds)
        )
        
        result = Dict(
            "success" => true,
            "message" => "Diamond analysis completed",
            "edges_file_path" => edges_file_path,
            "nodepriors_path" => nodepriors_path,
            "timestamp" => Dates.now(),
            "diamond_analysis" => diamond_analysis
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Diamond analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Diamond analysis failed"
        )))
    end
end

function handle_reachability_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        
        # 🐛 DEBUG: Log the complete request structure
        println("🔍 REACHABILITY REQUEST DEBUG:")
        println("📋 Complete request keys: ", keys(request_data))
        println("📋 Request data: ", request_data)
        
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        nodepriors_path = get(request_data, "nodepriorsPath", "")
        linkprobs_path = get(request_data, "linkprobsPath", "")
        include_exact_inference = get(request_data, "includeExactInference", true)
        include_diamond_analysis = get(request_data, "includeDiamondAnalysis", false)
        
        # 🐛 DEBUG: Log what we extracted
        println("🔍 EXTRACTED VALUES:")
        println("  networkPath: '$network_path'")
        println("  edgesFilePath: '$edges_file_path'")
        println("  nodepriorsPath: '$nodepriors_path'")
        println("  linkprobsPath: '$linkprobs_path'")
        println("  includeExactInference: $include_exact_inference")
        println("  includeDiamondAnalysis: $include_diamond_analysis")
        
        if isempty(network_path) || isempty(nodepriors_path) || isempty(linkprobs_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path, nodepriors path, and linkprobs path required"
            )))
        end
        
        # Determine edges file path
        if isempty(edges_file_path)
            # Look for .EDGES files in the network path
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    # Use Julia's built-in joinpath with normalization
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        # Load network structure
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Load scenario data - use Julia's built-in joinpath with normalization
        normalized_network_path = replace(network_path, "\\" => "/")
        normalized_nodepriors_path = replace(nodepriors_path, "\\" => "/")
        normalized_linkprobs_path = replace(linkprobs_path, "\\" => "/")
        
        full_nodepriors_path = joinpath(normalized_network_path, normalized_nodepriors_path)
        full_nodepriors_path = replace(full_nodepriors_path, "\\" => "/")
        
        full_linkprobs_path = joinpath(normalized_network_path, normalized_linkprobs_path)
        full_linkprobs_path = replace(full_linkprobs_path, "\\" => "/")
        
        if !isfile(full_nodepriors_path) || !isfile(full_linkprobs_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Required input files not found"
            )))
        end
        
        node_priors = read_node_priors_from_json(full_nodepriors_path)
        edge_probabilities = read_edge_probabilities_from_json(full_linkprobs_path)
        
        scenario_start_time = time()
        result_data = Dict()
        
        # Diamond Analysis (if requested)
        if include_diamond_analysis
            diamond_start_time = time()
            root_diamonds = identify_and_group_diamonds(
                join_nodes, incoming_index, ancestors, descendants,
                source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
            )
            
            unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                root_diamonds, node_priors, ancestors, descendants, iteration_sets
            )
            diamond_computation_time = time() - diamond_start_time
            
            result_data["diamond_analysis"] = Dict(
                "root_diamonds_count" => length(root_diamonds),
                "unique_diamonds_count" => length(unique_diamonds),
                "join_nodes_with_diamonds" => collect(keys(root_diamonds)),
                "computation_time" => diamond_computation_time,
                "raw_root_diamonds" => serialize_root_diamonds_for_json(root_diamonds),
                "raw_unique_diamonds" => serialize_unique_diamonds_for_json(unique_diamonds)
            )
        end
        
        # Exact Inference (if requested)
        if include_exact_inference
            inference_start_time = time()
            
            # Get diamonds if not already computed
            if !haskey(result_data, "diamond_analysis")
                root_diamonds = identify_and_group_diamonds(
                    join_nodes, incoming_index, ancestors, descendants,
                    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
                )
                unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
                    root_diamonds, node_priors, ancestors, descendants, iteration_sets
                )
            else
                # TODO: Extract from previous computation
                root_diamonds = Dict()  # Would need to deserialize
                unique_diamonds = Dict()  # Would need to deserialize
            end
            
            output = IPAFramework.update_beliefs_iterative(
                edgelist, iteration_sets, outgoing_index, incoming_index,
                source_nodes, node_priors, edge_probabilities,
                descendants, ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
            )
            
            inference_computation_time = time() - inference_start_time
            
            # Convert beliefs to serializable format
            beliefs_dict = Dict()
            for (node, belief) in output
                beliefs_dict[string(node)] = belief
            end
            
            # Calculate statistics for numeric beliefs only
            numeric_beliefs = []
            for belief in values(output)
                if isa(belief, Float64)
                    push!(numeric_beliefs, belief)
                elseif isa(belief, Real) && !isa(belief, pbox) && !isa(belief, Interval)
                    push!(numeric_beliefs, Float64(belief))
                end
            end
            
            # Include the actual node priors used for this scenario
            node_priors_dict = Dict(string(k) => convert_pbox_values(v) for (k, v) in node_priors)

            result_data["exact_inference"] = Dict(
                "beliefs" => beliefs_dict,
                "node_priors" => node_priors_dict,
                "computation_time" => inference_computation_time,
                "total_nodes_processed" => length(output),
                "belief_statistics" => Dict(
                    "mean" => length(numeric_beliefs) > 0 ? sum(numeric_beliefs) / length(numeric_beliefs) : 0.0,
                    "min" => length(numeric_beliefs) > 0 ? minimum(numeric_beliefs) : 0.0,
                    "max" => length(numeric_beliefs) > 0 ? maximum(numeric_beliefs) : 0.0,
                    "numeric_count" => length(numeric_beliefs),
                    "total_count" => length(output)
                )
            )
        end
        
        total_time = time() - scenario_start_time
        result_data["scenario_computation_time"] = total_time
        result_data["input_files"] = Dict(
            "nodepriors_path" => nodepriors_path,
            "linkprobs_path" => linkprobs_path
        )
        
        # Convert Pbox values
        converted_result = convert_pbox_values(result_data)
        
        result = Dict(
            "success" => true,
            "message" => "Reachability analysis completed",
            "edges_file_path" => edges_file_path,
            "nodepriors_path" => nodepriors_path,
            "linkprobs_path" => linkprobs_path,
            "timestamp" => Dates.now(),
            "reachability_result" => converted_result
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Reachability analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Reachability analysis failed"
        )))
    end
end

function handle_capacity_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        capacities_path = get(request_data, "capacitiesPath", "")
        
        if isempty(network_path) || isempty(capacities_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path and capacities path required"
            )))
        end
        
        # Determine edges file path
        if isempty(edges_file_path)
            # Look for .EDGES files in the network path
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    # Use Julia's built-in joinpath with normalization
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Load capacity data - use Julia's built-in joinpath with normalization
        normalized_network_path = replace(network_path, "\\" => "/")
        normalized_capacities_path = replace(capacities_path, "\\" => "/")
        full_capacities_path = joinpath(normalized_network_path, normalized_capacities_path)
        full_capacities_path = replace(full_capacities_path, "\\" => "/")
        if !isfile(full_capacities_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Capacities file not found"
            )))
        end
        
        capacity_data = JSON.parsefile(full_capacities_path)
        node_caps_raw = capacity_data["capacities"]["nodes"]
        edge_caps_raw = capacity_data["capacities"]["edges"]
        source_rates_raw = capacity_data["capacities"]["source_rates"]
        
        # Convert to proper types
        node_capacities = Dict{Int64,Float64}()
        for (k, v) in node_caps_raw
            node_capacities[parse(Int64, k)] = Float64(v)
        end
        
        edge_capacities = Dict{Tuple{Int64,Int64},Float64}()
        for (k, v) in edge_caps_raw
            cleaned_key = replace(k, "(" => "", ")" => "")
            parts = split(cleaned_key, ",")
            edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
            edge_capacities[edge_key] = Float64(v)
        end
        
        source_rates = Dict{Int64,Float64}()
        for (k, v) in source_rates_raw
            rate = Float64(v)
            if rate > 0.0
                source_rates[parse(Int64, k)] = rate
            end
        end
        
        # Target nodes are sink nodes
        targets = Set{Int64}(sink_nodes)
        
        # Run capacity analysis
        capacity_start_time = time()
        capacity_params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)
        capacity_result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, capacity_params)
        capacity_computation_time = time() - capacity_start_time
        
        # Extract flow results
        target_flows = Dict()
        for target in targets
            if haskey(capacity_result.node_max_flows, target)
                target_flows[string(target)] = capacity_result.node_max_flows[target]
            end
        end
        
        result_data = Dict(
            "computation_time" => capacity_computation_time,
            "network_utilization" => capacity_result.network_utilization,
            "total_source_input" => sum(values(source_rates)),
            "total_target_output" => sum(values(target_flows)),
            "target_flows" => target_flows,
            "active_sources" => collect(keys(source_rates)),
            "target_nodes" => collect(targets),
            "node_capacities_count" => length(node_capacities),
            "edge_capacities_count" => length(edge_capacities),
            "input_files" => Dict("capacities_path" => capacities_path),
            "raw_capacity_result" => Dict(
                "node_max_flows" => Dict(string(k) => convert_pbox_values(v) for (k, v) in capacity_result.node_max_flows),
                "node_capacities" => Dict(string(k) => convert_pbox_values(v) for (k, v) in node_capacities),
                "edge_capacities" => Dict(string(k) => convert_pbox_values(v) for (k, v) in edge_capacities),
                "source_rates" => Dict(string(k) => convert_pbox_values(v) for (k, v) in source_rates),
                "bottlenecks" => Dict(string(k) => convert_pbox_values(v) for (k, v) in capacity_result.bottlenecks),
                "critical_paths" => Dict(string(k) => convert_pbox_values(v) for (k, v) in capacity_result.critical_paths),
                "network_utilization" => convert_pbox_values(capacity_result.network_utilization),
                "analysis_type" => string(capacity_result.analysis_type),
                "computation_time" => capacity_result.computation_time,
                "convergence_info" => capacity_result.convergence_info
            )
        )
        
        result = Dict(
            "success" => true,
            "message" => "Capacity analysis completed",
            "edges_file_path" => edges_file_path,
            "capacities_path" => capacities_path,
            "timestamp" => Dates.now(),
            "capacity_result" => result_data
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("Capacity analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Capacity analysis failed"
        )))
    end
end

function handle_cpm_analysis(req::HTTP.Request)
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        request_data = JSON.parse(String(req.body))
        network_path = get(request_data, "networkPath", "")
        edges_file_path = get(request_data, "edgesFilePath", "")
        cpm_path = get(request_data, "cpmPath", "")
        
        if isempty(network_path) || isempty(cpm_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Network path and CPM path required"
            )))
        end
        
        # Determine edges file path
        if isempty(edges_file_path)
            # Look for .EDGES files in the network path
            if isdir(network_path)
                edges_files = filter(f -> endswith(f, ".EDGES"), readdir(network_path))
                if !isempty(edges_files)
                    # Use Julia's built-in joinpath with normalization
                    normalized_network_path = replace(network_path, "\\" => "/")
                    normalized_edges_file = replace(edges_files[1], "\\" => "/")
                    edges_file_path = joinpath(normalized_network_path, normalized_edges_file)
                    edges_file_path = replace(edges_file_path, "\\" => "/")
                end
            end
        else
            # Use Julia's built-in joinpath with normalization
            normalized_network_path = replace(network_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            edges_file_path = joinpath(normalized_network_path, normalized_edges_file_path)
            edges_file_path = replace(edges_file_path, "\\" => "/")
        end
        
        # Validate edges file exists
        is_valid, message = validate_network_file(edges_file_path)
        if !is_valid
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Invalid network file: $message"
            )))
        end
        
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_file_path)
        allnodes = collect(keys(incoming_index))
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
        
        # Load CPM data - use Julia's built-in joinpath with normalization
        normalized_network_path = replace(network_path, "\\" => "/")
        normalized_cpm_path = replace(cpm_path, "\\" => "/")
        full_cpm_path = joinpath(normalized_network_path, normalized_cpm_path)
        full_cpm_path = replace(full_cpm_path, "\\" => "/")
        if !isfile(full_cpm_path)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "CPM file not found"
            )))
        end
        
        cpm_data = JSON.parsefile(full_cpm_path)
        time_analysis = cpm_data["time_analysis"]
        cost_analysis = cpm_data["cost_analysis"]
        
        # Convert time analysis data
        node_durations_raw = time_analysis["node_durations"]
        edge_delays_raw = time_analysis["edge_delays"]
        
        node_durations = Dict{Int64,Float64}()
        for (k, v) in node_durations_raw
            node_durations[parse(Int64, k)] = Float64(v)
        end
        
        edge_delays = Dict{Tuple{Int64,Int64},Float64}()
        for (k, v) in edge_delays_raw
            cleaned_key = replace(k, "(" => "", ")" => "")
            parts = split(cleaned_key, ",")
            edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
            edge_delays[edge_key] = Float64(v)
        end
        
        # Convert cost analysis data
        node_costs_raw = cost_analysis["node_costs"]
        edge_costs_raw = cost_analysis["edge_costs"]
        
        node_costs = Dict{Int64,Float64}()
        for (k, v) in node_costs_raw
            node_costs[parse(Int64, k)] = Float64(v)
        end
        
        edge_costs = Dict{Tuple{Int64,Int64},Float64}()
        for (k, v) in edge_costs_raw
            cleaned_key = replace(k, "(" => "", ")" => "")
            parts = split(cleaned_key, ",")
            edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
            edge_costs[edge_key] = Float64(v)
        end
        
        # Run CPM analysis
        cpm_start_time = time()
        
        # Time-based critical path analysis
        time_params = CriticalPathParameters(
            node_durations, edge_delays, 0.0,
            max_combination, additive_propagation, additive_propagation
        )
        time_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, time_params)
        
        # Cost-based critical path analysis
        cost_params = CriticalPathParameters(
            node_costs, edge_costs, 0.0,
            max_combination, additive_propagation, additive_propagation
        )
        cost_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, cost_params)
        
        cpm_computation_time = time() - cpm_start_time
        
        result_data = Dict(
            "computation_time" => cpm_computation_time,
            "time_result" => Dict(
                "critical_value" => time_result.critical_value,
                "critical_nodes" => collect(time_result.critical_nodes),
                "node_values" => Dict(string(k) => convert_pbox_values(v) for (k, v) in time_result.node_values)
            ),
            "cost_result" => Dict(
                "critical_value" => cost_result.critical_value,
                "critical_nodes" => collect(cost_result.critical_nodes),
                "node_values" => Dict(string(k) => convert_pbox_values(v) for (k, v) in cost_result.node_values)
            ),
            "node_durations_count" => length(node_durations),
            "edge_delays_count" => length(edge_delays),
            "node_costs_count" => length(node_costs),
            "edge_costs_count" => length(edge_costs),
            "input_files" => Dict("cpm_path" => cpm_path)
        )
        
        result = Dict(
            "success" => true,
            "message" => "CPM analysis completed",
            "edges_file_path" => edges_file_path,
            "cpm_path" => cpm_path,
            "timestamp" => Dates.now(),
            "cpm_result" => result_data
        )
        
        return HTTP.Response(200, cors_headers, JSON.json(result))
        
    catch e
        println("CPM analysis error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "CPM analysis failed"
        )))
    end
end

# HTTP request handlers
function handle_upload(req::HTTP.Request)
    # Define CORS headers outside try block for catch access
    cors_headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ]
    
    try
        # Generate unique upload session ID
        upload_id = string(uuid4())
        upload_path_raw = joinpath(UPLOAD_DIR, upload_id)
        # Normalize path separators to prevent mixed separator issues
        upload_path = normalize_path_separators(upload_path_raw)
        
        # Create upload directory using the raw path (mkpath expects OS-native separators)
        mkpath(upload_path_raw)
        
        # Parse multipart form data
        content_type = HTTP.header(req, "Content-Type")
        if !startswith(content_type, "multipart/form-data")
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Expected multipart/form-data"
            )))
        end
        
        # Extract boundary from content-type
        boundary_match = match(r"boundary=([^;]+)", content_type)
        if boundary_match === nothing
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "Missing boundary in multipart data"
            )))
        end
        
        boundary = String(boundary_match.captures[1])
        body_str = String(req.body)
        
        # Parse multipart data
        uploaded_files = parse_multipart_data(body_str, boundary, upload_path)
        
        if isempty(uploaded_files)
            return HTTP.Response(400, cors_headers, JSON.json(Dict(
                "success" => false,
                "message" => "No files uploaded"
            )))
        end
        
        # Find .EDGES files to identify networks
        edges_files = filter(f -> endswith(f, ".EDGES"), uploaded_files)
        
        println("Upload successful: $(length(uploaded_files)) files uploaded to $upload_path")
        println("Found $(length(edges_files)) .EDGES files")
        
        headers = [
            "Access-Control-Allow-Origin" => "*",
            "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" => "Content-Type, Authorization",
            "Content-Type" => "application/json"
        ]
        
        # Find the network directory (where the .EDGES file is located)
        network_path = upload_path
        if !isempty(edges_files)
            # Get the directory containing the first edges file - use Julia's built-in joinpath with normalization
            edges_file_path = edges_files[1]
            normalized_upload_path = replace(upload_path, "\\" => "/")
            normalized_edges_file_path = replace(edges_file_path, "\\" => "/")
            full_edges_path = joinpath(normalized_upload_path, normalized_edges_file_path)
            full_edges_path = replace(full_edges_path, "\\" => "/")
            network_path = dirname(full_edges_path)
        end
        
        response_data = Dict(
            "success" => true,
            "message" => "Files uploaded successfully",
            "network_path" => network_path,
            "upload_id" => upload_id,
            "files_count" => length(uploaded_files),
            "uploaded_files" => uploaded_files,
            "edges_files" => edges_files
        )
        
        println("Returning upload response: ", JSON.json(response_data))
        
        return HTTP.Response(200, headers, JSON.json(response_data))
        
    catch e
        println("Upload error: ", e)
        return HTTP.Response(500, cors_headers, JSON.json(Dict(
            "success" => false,
            "error" => string(e),
            "message" => "Upload failed due to server error"
        )))
    end
end


function handle_cors(req::HTTP.Request)
    headers = [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization"
    ]
    
    if req.method == "OPTIONS"
        return HTTP.Response(200, headers)
    end
    
    return nothing
end

# Main server function
function start_server()
    setup_server()
    
    # Define routes
    router = HTTP.Router()
    
    # Add CORS middleware
    HTTP.register!(router, "OPTIONS", "/*", handle_cors)
    
    # API routes
    HTTP.register!(router, "POST", "/upload", handle_upload)
    # File serving endpoint for frontend data parsing
    HTTP.register!(router, "GET", "/files/*", handle_file_request)
    # Individual Analysis Endpoints
    HTTP.register!(router, "POST", "/network-structure", handle_network_structure)
    HTTP.register!(router, "POST", "/diamond-analysis", handle_diamond_analysis)
    HTTP.register!(router, "POST", "/reachability-analysis", handle_reachability_analysis)
    HTTP.register!(router, "POST", "/capacity-analysis", handle_capacity_analysis)
    HTTP.register!(router, "POST", "/cpm-analysis", handle_cpm_analysis)
    
    # Health check
    HTTP.register!(router, "GET", "/health", req -> HTTP.Response(200, [
        "Access-Control-Allow-Origin" => "*",
        "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers" => "Content-Type, Authorization",
        "Content-Type" => "application/json"
    ], JSON.json(Dict("status" => "healthy"))))
    
    # Start server
    println("Starting flexible multi-scenario backend server...")
    HTTP.serve(router, "0.0.0.0", PORT)
end

# Export main functions
export start_server

# Start server if run directly
 start_server()
 
 