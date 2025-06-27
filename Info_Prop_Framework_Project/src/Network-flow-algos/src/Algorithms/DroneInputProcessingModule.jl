"""
DroneInputProcessingModule.jl

Dedicated input processing module for drone networks that can save and load 
DAG conversion results in a structured format. Handles complex nested dictionary 
structures from drone network DAG conversion results.

Key Features:
- Save DAG conversion results as CSV (adjacency matrices) and JSON (metadata)
- Load saved results and reconstruct data structures for IPA Framework analysis
- Handle drone-specific metadata (node types, operational modes, transfer points)
- Preserve all conversion metrics and validation data
- Integration with existing IPA Framework patterns
"""
module DroneInputProcessingModule
    using CSV, DataFrames, JSON, LinearAlgebra, SparseArrays, Dates
    using ..DroneNetworkDagModule: NodeType, OperationalMode,
                                   HOSPITAL, AIRPORT, REGIONAL_HUB, LOCAL_HUB, GENERIC,
                                   SUPPLY_DISTRIBUTION, EMERGENCY_RESPONSE, RESILIENCE_ANALYSIS

    export DroneNetworkData, save_drone_dag_results, load_drone_dag_results,
           convert_to_ipa_format, validate_drone_data_integrity,
           create_drone_metadata, extract_dag_matrices, save_real_drone_results

    """
    Structure to hold complete drone network data for IPA Framework integration
    """
    struct DroneNetworkData
        # Core DAG data
        adjacency_matrices::Dict{String, Matrix{Int}}
        node_types::Vector{NodeType}
        node_coordinates::Matrix{Float64}
        
        # IPA Framework compatible data
        edgelist::Vector{Tuple{Int, Int}}
        outgoing_index::Dict{Int, Vector{Int}}
        incoming_index::Dict{Int, Vector{Int}}
        source_nodes::Vector{Int}
        fork_nodes::Vector{Int}
        join_nodes::Vector{Int}
        iteration_sets::Vector{Vector{Int}}
        ancestors::Dict{Int, Set{Int}}
        descendants::Dict{Int, Set{Int}}
        
        # Drone-specific metadata
        operational_modes::Vector{OperationalMode}
        drone_types::Vector{String}
        conversion_results::Dict{String, Any}
        validation_data::Dict{String, Any}
        transfer_nodes::Vector{Int}
        
        # Additional metadata
        metadata::Dict{String, Any}
    end

    """
    Save drone DAG conversion results to structured files
    Takes the exact results structure from TestSpace DroneDAG_RealData.jl
    """
    function save_drone_dag_results(results::Dict,
                                   transfer_nodes::Vector{Int},
                                   integrated_dag::Matrix{Int},
                                   output_dir::String;
                                   base_filename::String = "drone_network",
                                   node_types::Union{Vector{NodeType}, Nothing} = nothing,
                                   node_coordinates::Union{Matrix{Float64}, Nothing} = nothing)
        
        # Create output directory if it doesn't exist
        if !isdir(output_dir)
            mkpath(output_dir)
        end
        
        println("💾 Saving drone DAG results to: $output_dir")
        
        # Extract and organize data
        saved_files = String[]
        
        # 1. Save adjacency matrices as CSV files
        println("  📊 Saving adjacency matrices...")
        dag_matrices = Dict{String, Matrix{Int}}()
        
        for (drone_name, drone_results) in results
            for (mode_name, mode_data) in drone_results
                # Clean filename
                clean_drone = replace(drone_name, r"[^\w\-_]" => "_")
                clean_mode = replace(mode_name, r"[^\w\-_]" => "_")
                filename = "$(base_filename)_$(clean_drone)_$(clean_mode)_adjacency.csv"
                filepath = joinpath(output_dir, filename)
                
                # Save adjacency matrix
                dag_matrix = mode_data["dag"]
                dag_matrices["$(drone_name)_$(mode_name)"] = dag_matrix
                CSV.write(filepath, DataFrame(dag_matrix, :auto))
                push!(saved_files, filename)
                
                println("    ✓ Saved: $filename ($(size(dag_matrix, 1))×$(size(dag_matrix, 2)))")
            end
        end
        
        # 2. Save integrated DAG
        integrated_filename = "$(base_filename)_integrated_adjacency.csv"
        integrated_filepath = joinpath(output_dir, integrated_filename)
        CSV.write(integrated_filepath, DataFrame(integrated_dag, :auto))
        push!(saved_files, integrated_filename)
        println("    ✓ Saved: $integrated_filename ($(size(integrated_dag, 1))×$(size(integrated_dag, 2)))")
        
        # 3. Create comprehensive metadata
        println("  📋 Creating metadata...")
        metadata = create_drone_metadata(results, transfer_nodes, integrated_dag)
        
        # 4. Save metadata as JSON
        metadata_filename = "$(base_filename)_metadata.json"
        metadata_filepath = joinpath(output_dir, metadata_filename)
        
        # Convert matrices to arrays for JSON serialization
        json_metadata = prepare_metadata_for_json(metadata)
        
        open(metadata_filepath, "w") do f
            JSON.print(f, json_metadata, 2)  # Pretty print with 2-space indentation
        end
        push!(saved_files, metadata_filename)
        println("    ✓ Saved: $metadata_filename")
        
        # 5. Create summary report
        summary_filename = "$(base_filename)_summary.txt"
        summary_filepath = joinpath(output_dir, summary_filename)
        create_summary_report(results, transfer_nodes, integrated_dag, summary_filepath)
        push!(saved_files, summary_filename)
        println("    ✓ Saved: $summary_filename")
        
        println("✅ Successfully saved $(length(saved_files)) files")
        return saved_files, metadata
    end

    """
    Save results directly from TestSpace DroneDAG_RealData.jl execution
    This function is designed to be called directly from the test file
    """
    function save_real_drone_results(results::Dict,
                                    transfer_nodes::Vector{Int},
                                    integrated_dag::Matrix{Int},
                                    node_types::Vector{NodeType},
                                    node_coordinates::Matrix{Float64},
                                    output_dir::String = "drone_dag_results";
                                    base_filename::String = "real_drone_network")
        
        println("💾 Saving REAL drone DAG results from TestSpace DroneDAG_RealData.jl")
        println("📊 Results structure:")
        println("  - Drone types: $(length(keys(results)))")
        println("  - Network size: $(size(integrated_dag, 1)) nodes")
        println("  - Transfer nodes: $(length(transfer_nodes))")
        
        # Use the enhanced save function with real data
        saved_files, metadata = save_drone_dag_results(
            results, transfer_nodes, integrated_dag, output_dir,
            base_filename=base_filename,
            node_types=node_types,
            node_coordinates=node_coordinates
        )
        
        # Add real data specific metadata
        metadata["data_source"] = "TestSpace DroneDAG_RealData.jl"
        metadata["real_drone_files"] = [
            "src/Network-flow-algos/test/drone network/nodes.csv",
            "src/Network-flow-algos/test/drone network/feasible_drone_1.csv",
            "src/Network-flow-algos/test/drone network/feasible_drone_2.csv"
        ]
        
        # Save enhanced metadata
        metadata_filepath = joinpath(output_dir, "$(base_filename)_metadata.json")
        json_metadata = prepare_metadata_for_json(metadata)
        open(metadata_filepath, "w") do f
            JSON.print(f, json_metadata, 2)
        end
        
        println("✅ Real drone data saved successfully!")
        return saved_files, metadata
    end

    """
    Create comprehensive metadata from drone DAG results
    """
    function create_drone_metadata(results::Dict,
                                  transfer_nodes::Vector{Int},
                                  integrated_dag::Matrix{Int},
                                  node_types::Union{Vector{NodeType}, Nothing} = nothing,
                                  node_coordinates::Union{Matrix{Float64}, Nothing} = nothing)
        
        metadata = Dict{String, Any}()
        
        # Basic information
        metadata["timestamp"] = string(now())
        metadata["framework_version"] = "IPA Framework v2.0"
        metadata["module_version"] = "DroneInputProcessingModule v1.0"
        
        # Network structure
        n_nodes = size(integrated_dag, 1)
        metadata["network_size"] = n_nodes
        metadata["total_edges_integrated"] = sum(integrated_dag)
        
        # Transfer nodes
        metadata["transfer_nodes"] = transfer_nodes
        metadata["num_transfer_nodes"] = length(transfer_nodes)
        
        # Drone and mode information
        drone_names = collect(keys(results))
        metadata["drone_types"] = drone_names
        metadata["num_drone_types"] = length(drone_names)
        
        # Extract operational modes
        operational_modes = Set{String}()
        for (_, drone_results) in results
            for mode_name in keys(drone_results)
                push!(operational_modes, mode_name)
            end
        end
        metadata["operational_modes"] = collect(operational_modes)
        metadata["num_operational_modes"] = length(operational_modes)
        
        # Detailed results for each drone-mode combination
        metadata["conversion_results"] = Dict{String, Any}()
        metadata["validation_results"] = Dict{String, Any}()
        
        for (drone_name, drone_results) in results
            metadata["conversion_results"][drone_name] = Dict{String, Any}()
            metadata["validation_results"][drone_name] = Dict{String, Any}()
            
            for (mode_name, mode_data) in drone_results
                # Store conversion metrics
                conversion_data = mode_data["conversion_results"]
                metadata["conversion_results"][drone_name][mode_name] = Dict(
                    "cycles_removed" => conversion_data["cycles_removed"],
                    "hierarchy_levels" => conversion_data["hierarchy_levels"],
                    "importance_scores" => conversion_data["importance_scores"]
                )
                
                # Store validation results
                validation_data = mode_data["validation"]
                metadata["validation_results"][drone_name][mode_name] = validation_data
            end
        end
        
        # IPA Framework integration data
        metadata["ipa_integration"] = Dict(
            "ready_for_analysis" => true,
            "supported_modules" => [
                "ReachabilityModule",
                "DiamondClassificationModule", 
                "GeneralizedCriticalPathModule",
                "CapacityAnalysisModule"
            ]
        )
        
        return metadata
    end

    """
    Prepare metadata for JSON serialization by converting matrices to arrays
    """
    function prepare_metadata_for_json(metadata::Dict{String, Any})
        json_metadata = deepcopy(metadata)
        
        # Convert any matrices or complex types to JSON-serializable formats
        function convert_for_json(obj)
            if isa(obj, Matrix)
                return [obj[i, :] for i in 1:size(obj, 1)]
            elseif isa(obj, Dict)
                return Dict(string(k) => convert_for_json(v) for (k, v) in obj)
            elseif isa(obj, Vector) && !isempty(obj) && isa(obj[1], Matrix)
                return [convert_for_json(item) for item in obj]
            else
                return obj
            end
        end
        
        return convert_for_json(json_metadata)
    end

    """
    Load drone DAG results from saved files
    """
    function load_drone_dag_results(input_dir::String;
                                   base_filename::String = "drone_network")
        
        println("📂 Loading drone DAG results from: $input_dir")
        
        # 1. Load metadata
        metadata_filepath = joinpath(input_dir, "$(base_filename)_metadata.json")
        if !isfile(metadata_filepath)
            error("Metadata file not found: $metadata_filepath")
        end
        
        metadata = JSON.parsefile(metadata_filepath)
        println("  ✓ Loaded metadata")
        
        # 2. Load adjacency matrices
        println("  📊 Loading adjacency matrices...")
        adjacency_matrices = Dict{String, Matrix{Int}}()
        
        # Load individual drone-mode matrices
        for drone_name in metadata["drone_types"]
            for mode_name in metadata["operational_modes"]
                clean_drone = replace(drone_name, r"[^\w\-_]" => "_")
                clean_mode = replace(mode_name, r"[^\w\-_]" => "_")
                filename = "$(base_filename)_$(clean_drone)_$(clean_mode)_adjacency.csv"
                filepath = joinpath(input_dir, filename)
                
                if isfile(filepath)
                    df = CSV.read(filepath, DataFrame)
                    matrix = Matrix{Int}(df)
                    adjacency_matrices["$(drone_name)_$(mode_name)"] = matrix
                    println("    ✓ Loaded: $filename ($(size(matrix, 1))×$(size(matrix, 2)))")
                end
            end
        end
        
        # Load integrated matrix
        integrated_filename = "$(base_filename)_integrated_adjacency.csv"
        integrated_filepath = joinpath(input_dir, integrated_filename)
        integrated_dag = nothing
        if isfile(integrated_filepath)
            df = CSV.read(integrated_filepath, DataFrame)
            integrated_dag = Matrix{Int}(df)
            adjacency_matrices["integrated"] = integrated_dag
            println("    ✓ Loaded: $integrated_filename ($(size(integrated_dag, 1))×$(size(integrated_dag, 2)))")
        end
        
        println("✅ Successfully loaded $(length(adjacency_matrices)) adjacency matrices")
        
        return adjacency_matrices, metadata, integrated_dag
    end

    """
    Convert loaded drone data to IPA Framework compatible format
    """
    function convert_to_ipa_format(adjacency_matrices::Dict{String, Matrix{Int}},
                                  metadata::Dict{String, Any};
                                  selected_matrix::String = "integrated")
        
        println("🔄 Converting to IPA Framework format...")
        
        # Select the DAG matrix to use
        if !haskey(adjacency_matrices, selected_matrix)
            available_keys = collect(keys(adjacency_matrices))
            error("Selected matrix '$selected_matrix' not found. Available: $available_keys")
        end
        
        dag_matrix = adjacency_matrices[selected_matrix]
        n = size(dag_matrix, 1)
        
        # 1. Create edge list
        edgelist = Tuple{Int, Int}[]
        for i in 1:n
            for j in 1:n
                if dag_matrix[i, j] == 1
                    push!(edgelist, (i, j))
                end
            end
        end
        
        # 2. Create outgoing and incoming indices
        outgoing_index = Dict{Int, Vector{Int}}()
        incoming_index = Dict{Int, Vector{Int}}()
        
        for i in 1:n
            outgoing_index[i] = [j for j in 1:n if dag_matrix[i, j] == 1]
            incoming_index[i] = [j for j in 1:n if dag_matrix[j, i] == 1]
        end
        
        # 3. Identify source nodes (no incoming edges)
        source_nodes = [i for i in 1:n if isempty(incoming_index[i])]
        
        # 4. Identify fork and join nodes
        fork_nodes = [i for i in 1:n if length(outgoing_index[i]) > 1]
        join_nodes = [i for i in 1:n if length(incoming_index[i]) > 1]
        
        # 5. Create iteration sets (topological ordering)
        iteration_sets = create_iteration_sets(dag_matrix, source_nodes)
        
        # 6. Calculate ancestors and descendants
        ancestors, descendants = calculate_ancestors_descendants(dag_matrix)
        
        # 7. Extract transfer nodes
        transfer_nodes = haskey(metadata, "transfer_nodes") ? 
                        Vector{Int}(metadata["transfer_nodes"]) : Int[]
        
        println("  ✓ Edge list: $(length(edgelist)) edges")
        println("  ✓ Source nodes: $(length(source_nodes))")
        println("  ✓ Fork nodes: $(length(fork_nodes))")
        println("  ✓ Join nodes: $(length(join_nodes))")
        println("  ✓ Iteration sets: $(length(iteration_sets))")
        println("  ✓ Transfer nodes: $(length(transfer_nodes))")
        
        return Dict(
            "edgelist" => edgelist,
            "outgoing_index" => outgoing_index,
            "incoming_index" => incoming_index,
            "source_nodes" => source_nodes,
            "fork_nodes" => fork_nodes,
            "join_nodes" => join_nodes,
            "iteration_sets" => iteration_sets,
            "ancestors" => ancestors,
            "descendants" => descendants,
            "transfer_nodes" => transfer_nodes,
            "adjacency_matrix" => dag_matrix
        )
    end

    """
    Create iteration sets using topological sorting
    """
    function create_iteration_sets(dag_matrix::Matrix{Int}, source_nodes::Vector{Int})
        n = size(dag_matrix, 1)
        iteration_sets = Vector{Vector{Int}}()
        processed = Set{Int}()
        
        # Start with source nodes
        current_set = copy(source_nodes)
        
        while !isempty(current_set)
            push!(iteration_sets, copy(current_set))
            union!(processed, current_set)
            
            # Find next set of nodes (all predecessors processed)
            next_set = Int[]
            for i in 1:n
                if i ∉ processed
                    # Check if all predecessors are processed
                    predecessors = [j for j in 1:n if dag_matrix[j, i] == 1]
                    if all(pred ∈ processed for pred in predecessors)
                        push!(next_set, i)
                    end
                end
            end
            
            current_set = next_set
        end
        
        return iteration_sets
    end

    """
    Calculate ancestors and descendants for each node
    """
    function calculate_ancestors_descendants(dag_matrix::Matrix{Int})
        n = size(dag_matrix, 1)
        ancestors = Dict{Int, Set{Int}}()
        descendants = Dict{Int, Set{Int}}()
        
        # Initialize
        for i in 1:n
            ancestors[i] = Set{Int}()
            descendants[i] = Set{Int}()
        end
        
        # DFS to find all descendants
        function find_descendants(node::Int, visited::Set{Int})
            if node ∈ visited
                return Set{Int}()
            end
            push!(visited, node)
            
            desc = Set{Int}()
            for j in 1:n
                if dag_matrix[node, j] == 1
                    push!(desc, j)
                    union!(desc, find_descendants(j, visited))
                end
            end
            return desc
        end
        
        # Calculate descendants for each node
        for i in 1:n
            descendants[i] = find_descendants(i, Set{Int}())
        end
        
        # Calculate ancestors (reverse of descendants)
        for i in 1:n
            for j in 1:n
                if i ∈ descendants[j]
                    push!(ancestors[i], j)
                end
            end
        end
        
        return ancestors, descendants
    end

    """
    Validate data integrity after loading
    """
    function validate_drone_data_integrity(adjacency_matrices::Dict{String, Matrix{Int}},
                                          metadata::Dict{String, Any})
        
        println("🔍 Validating data integrity...")
        validation_results = Dict{String, Any}()
        
        # 1. Check matrix dimensions consistency
        matrix_sizes = Dict{String, Tuple{Int, Int}}()
        for (name, matrix) in adjacency_matrices
            matrix_sizes[name] = size(matrix)
        end
        
        # All matrices should have same dimensions
        unique_sizes = unique(values(matrix_sizes))
        validation_results["consistent_dimensions"] = length(unique_sizes) == 1
        validation_results["matrix_sizes"] = matrix_sizes
        
        # 2. Check for cycles in each matrix
        validation_results["acyclic_matrices"] = Dict{String, Bool}()
        for (name, matrix) in adjacency_matrices
            validation_results["acyclic_matrices"][name] = is_acyclic(matrix)
        end
        
        # 3. Validate metadata consistency
        expected_matrices = length(metadata["drone_types"]) * length(metadata["operational_modes"]) + 1  # +1 for integrated
        actual_matrices = length(adjacency_matrices)
        validation_results["expected_matrices"] = expected_matrices
        validation_results["actual_matrices"] = actual_matrices
        validation_results["matrix_count_match"] = expected_matrices == actual_matrices
        
        # 4. Check transfer nodes validity
        if haskey(metadata, "transfer_nodes") && haskey(adjacency_matrices, "integrated")
            n = size(adjacency_matrices["integrated"], 1)
            transfer_nodes = metadata["transfer_nodes"]
            valid_transfer_nodes = all(1 <= node <= n for node in transfer_nodes)
            validation_results["valid_transfer_nodes"] = valid_transfer_nodes
        end
        
        # Summary
        all_valid = all([
            validation_results["consistent_dimensions"],
            all(values(validation_results["acyclic_matrices"])),
            validation_results["matrix_count_match"],
            get(validation_results, "valid_transfer_nodes", true)
        ])
        
        validation_results["overall_valid"] = all_valid
        
        if all_valid
            println("  ✅ All validation checks passed")
        else
            println("  ⚠️  Some validation issues found")
            for (key, value) in validation_results
                if isa(value, Bool) && !value
                    println("    ❌ $key: $value")
                end
            end
        end
        
        return validation_results
    end

    """
    Check if a matrix represents an acyclic graph
    """
    function is_acyclic(matrix::Matrix{Int})
        n = size(matrix, 1)
        visited = falses(n)
        rec_stack = falses(n)
        
        function has_cycle_dfs(v::Int)
            visited[v] = true
            rec_stack[v] = true
            
            for u in 1:n
                if matrix[v, u] == 1
                    if !visited[u]
                        if has_cycle_dfs(u)
                            return true
                        end
                    elseif rec_stack[u]
                        return true
                    end
                end
            end
            
            rec_stack[v] = false
            return false
        end
        
        for v in 1:n
            if !visited[v] && has_cycle_dfs(v)
                return false
            end
        end
        
        return true
    end

    """
    Extract DAG matrices from loaded drone data or conversion results
    
    This function provides a unified interface to extract adjacency matrices
    from either loaded drone data or direct conversion results.
    
    # Arguments
    - `data`: Either a Dict from conversion results or loaded adjacency matrices
    - `format`: :loaded (from load_drone_dag_results) or :conversion (from direct results)
    
    # Returns
    - `Dict{String, Matrix{Int}}`: Dictionary of adjacency matrices keyed by name
    """
    function extract_dag_matrices(data::Dict; format::Symbol = :loaded)
        if format == :loaded
            # Data is from load_drone_dag_results - already contains adjacency matrices
            if haskey(data, "integrated")
                return data  # Already in correct format
            else
                error("Loaded data does not contain expected adjacency matrices")
            end
        elseif format == :conversion
            # Data is from direct conversion results - extract matrices
            dag_matrices = Dict{String, Matrix{Int}}()
            
            for (drone_name, drone_results) in data
                for (mode_name, mode_data) in drone_results
                    if haskey(mode_data, "dag")
                        key = "$(drone_name)_$(mode_name)"
                        dag_matrices[key] = mode_data["dag"]
                    end
                end
            end
            
            return dag_matrices
        else
            error("Invalid format specified. Use :loaded or :conversion")
        end
    end

    """
    Extract DAG matrices from loaded drone data (adjacency_matrices from load_drone_dag_results)
    
    # Arguments
    - `adjacency_matrices`: Dict returned from load_drone_dag_results
    
    # Returns
    - `Dict{String, Matrix{Int}}`: The same dictionary (for consistency with interface)
    """
    function extract_dag_matrices(adjacency_matrices::Dict{String, Matrix{Int}})
        return adjacency_matrices
    end

    """
    Create a summary report of the saved data
    """
    function create_summary_report(results::Dict,
                                  transfer_nodes::Vector{Int},
                                  integrated_dag::Matrix{Int},
                                  filepath::String)
        
        open(filepath, "w") do f
            println(f, "="^80)
            println(f, "DRONE NETWORK DAG CONVERSION RESULTS SUMMARY")
            println(f, "="^80)
            println(f, "Generated: $(now())")
            println(f, "Framework: IPA Framework v2.0")
            println(f, "Module: DroneInputProcessingModule v1.0")
            println(f)
            
            # Network overview
            println(f, "NETWORK OVERVIEW")
            println(f, "-"^40)
            println(f, "Network Size: $(size(integrated_dag, 1)) nodes")
            println(f, "Integrated DAG Edges: $(sum(integrated_dag))")
            println(f, "Transfer Nodes: $(length(transfer_nodes))")
            println(f)
            
            # Drone types and modes
            drone_names = collect(keys(results))
            println(f, "DRONE TYPES ($(length(drone_names)))")
            println(f, "-"^40)
            for drone_name in drone_names
                println(f, "  • $drone_name")
            end
            println(f)
            
            # Operational modes
            operational_modes = Set{String}()
            for (_, drone_results) in results
                for mode_name in keys(drone_results)
                    push!(operational_modes, mode_name)
                end
            end
            
            println(f, "OPERATIONAL MODES ($(length(operational_modes)))")
            println(f, "-"^40)
            for mode in operational_modes
                println(f, "  • $mode")
            end
            println(f)
            
            # Performance metrics
            println(f, "PERFORMANCE METRICS")
            println(f, "-"^40)
            println(f, "Drone Type                | Mode                  | Edge Retention | Cycles Removed")
            println(f, "-"^90)
            
            for (drone_name, drone_results) in results
                for (mode_name, mode_data) in drone_results
                    validation = mode_data["validation"]
                    conversion = mode_data["conversion_results"]
                    retention = round(validation["edge_retention_rate"] * 100, digits=1)
                    cycles = conversion["cycles_removed"]
                    
                    drone_short = length(drone_name) > 24 ? drone_name[1:21] * "..." : drone_name
                    mode_short = length(mode_name) > 20 ? mode_name[1:17] * "..." : mode_name
                    
                    println(f, "$(rpad(drone_short, 25)) | $(rpad(mode_short, 21)) | $(rpad(retention, 14))% | $cycles")
                end
            end
            println(f)
            
            # IPA Framework integration
            println(f, "IPA FRAMEWORK INTEGRATION")
            println(f, "-"^40)
            println(f, "✓ Ready for ReachabilityModule analysis")
            println(f, "✓ Ready for DiamondClassificationModule analysis")
            println(f, "✓ Ready for GeneralizedCriticalPathModule analysis")
            println(f, "✓ Ready for CapacityAnalysisModule analysis")
            println(f)
            
            println(f, "FILES GENERATED")
            println(f, "-"^40)
            println(f, "• Adjacency matrices (CSV format)")
            println(f, "• Comprehensive metadata (JSON format)")
            println(f, "• Summary report (TXT format)")
            println(f)
            
            println(f, "="^80)
        end
    end

end