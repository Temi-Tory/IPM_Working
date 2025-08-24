# ComprehensiveNetworkAnalysisTest.jl
# Comprehensive test that runs reachability, capacity, and critical path analysis
# Following the patterns from CleanTest.jl and FullTestAllFiles.jl

# Check if this is the first run of the script for this julia repl session
if !@isdefined(comprehensive_initialized)
    println("First run - initializing comprehensive network analysis test...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates, JSON

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    global comprehensive_initialized = true
    println("Comprehensive network analysis test initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

function run_comprehensive_analysis(network_name::String, data_type::String="float")
    println("="^70)
    println("COMPREHENSIVE ANALYSIS: $network_name")
    println("="^70)
    
    # Construct file paths - handle both command line and IDE execution contexts
    script_dir = @__DIR__
    project_root = dirname(dirname(dirname(script_dir)))  # Go up from test -> src -> Network-flow-algos -> Info_Prop_Framework_Project
    base_path = joinpath(project_root, "dag_ntwrk_files", network_name)
    
    # Graph structure file
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    
    # Reachability input files
    json_network_name = replace(network_name, "_" => "-")
    filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")
    
    # Capacity input file
    filepath_capacity_json = joinpath(base_path, "capacity", json_network_name * "-capacities.json")
    
    # CPM input file
    filepath_cpm_json = joinpath(base_path, "cpm", json_network_name * "-cpm-inputs.json")
    
    # Validate files exist
    if !isfile(filepath_graph)
        error("Graph file not found: $filepath_graph")
    end
    if !isfile(filepath_node_json)
        error("Node priors file not found: $filepath_node_json")
    end
    if !isfile(filepath_edge_json)
        error("Edge probabilities file not found: $filepath_edge_json")
    end
    if !isfile(filepath_capacity_json)
        error("Capacity file not found: $filepath_capacity_json")
    end
    if !isfile(filepath_cpm_json)
        error("CPM file not found: $filepath_cpm_json")
    end
    
    println("📂 Input files:")
    println("  • Graph: $(basename(filepath_graph))")
    println("  • Node priors: $(basename(filepath_node_json))")
    println("  • Edge probabilities: $(basename(filepath_edge_json))")
    println("  • Capacity data: $(basename(filepath_capacity_json))")
    println("  • CPM data: $(basename(filepath_cpm_json))")
    println()
    
    # STEP 1: Read graph structure (following CleanTest.jl pattern)
    println(" STEP 1: Reading network structure...")
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
    
    allnodes = collect(keys(incoming_index))
    sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)
    
    println("  • Total nodes: $(length(allnodes))")
    println("  • Total edges: $(length(edgelist))")
    println("  • Source nodes: $(collect(source_nodes))")
    println("  • Sink nodes: $(collect(sink_nodes))")
    println()
    
    # STEP 2: Load reachability inputs
    println(" STEP 2: Loading reachability inputs...")
    node_priors = read_node_priors_from_json(filepath_node_json)
    edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
    
    println("  • Node priors loaded: $(length(node_priors))")
    println("  • Edge probabilities loaded: $(length(edge_probabilities))")
    println()
    
    # STEP 3: Network structure analysis (following CleanTest.jl pattern)
    println(" STEP 3: Analyzing network structure...")
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
    
    println("  • Fork nodes: $(collect(fork_nodes))")
    println("  • Join nodes: $(collect(join_nodes))")
    println("  • Iteration sets: $(length(iteration_sets))")
    
    # Diamond identification (following CleanTest.jl pattern)
    println("  • Finding root diamonds...")
    root_diamonds = identify_and_group_diamonds(
        join_nodes,
        incoming_index,
        ancestors,
        descendants,
        source_nodes,
        fork_nodes,
        edgelist,
        node_priors,
        iteration_sets
    )
    l_root_diamonds = length(root_diamonds)
    
    println("  • Found $l_root_diamonds root diamonds")
    println("  • Building unique diamond storage...")
    
    unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
        root_diamonds,
        node_priors,
        ancestors,
        descendants,
        iteration_sets
    )
    l_unique_diamonds = length(unique_diamonds)
    println("  • Found $l_unique_diamonds unique diamonds")
    println()
    
    # STEP 4: Run reachability analysis (following CleanTest.jl pattern)
    println(" STEP 4: Running reachability analysis...")
    reachability_start_time = time()
    
    reachability_output = IPAFramework.update_beliefs_iterative(
        edgelist,
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities,
        descendants,
        ancestors,
        root_diamonds,
        join_nodes,
        fork_nodes,
        unique_diamonds
    )
    
    reachability_time = time() - reachability_start_time
    println("  • Reachability analysis complete!")
    println("  • Computation time: $(round(reachability_time, digits=4)) seconds")
    
    # Show top reachability results
    sorted_reachability = sort(collect(reachability_output), by=x->x[2], rev=true)
    println("  • Top 5 most reachable nodes:")
    for i in 1:min(5, length(sorted_reachability))
        node, belief = sorted_reachability[i]
        println("    Node $node: $(round(belief, digits=6))")
    end
    println()
    
    # STEP 5: Load capacity inputs and run capacity analysis
    println("⚡ STEP 5: Running capacity analysis...")
    capacity_start_time = time()
    
    # Load capacity data
    capacity_data = JSON.parsefile(filepath_capacity_json)
    node_caps_raw = capacity_data["capacities"]["nodes"]
    edge_caps_raw = capacity_data["capacities"]["edges"]
    source_rates_raw = capacity_data["capacities"]["source_rates"]
    
    # Convert to proper types (following capacity test patterns)
    node_capacities = Dict{Int64, Float64}()
    for (k, v) in node_caps_raw
        node_capacities[parse(Int64, k)] = Float64(v)
    end
    
    edge_capacities = Dict{Tuple{Int64,Int64}, Float64}()
    for (k, v) in edge_caps_raw
        # Handle edge keys like "(1,2)" or "1,2"
        cleaned_key = replace(k, "(" => "", ")" => "")
        parts = split(cleaned_key, ",")
        edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
        edge_capacities[edge_key] = Float64(v)
    end
    
    source_rates = Dict{Int64, Float64}()
    for (k, v) in source_rates_raw
        rate = Float64(v)
        if rate > 0.0  # Only include active sources
            source_rates[parse(Int64, k)] = rate
        end
    end
    
    # Target nodes are sink nodes
    targets = Set{Int64}(sink_nodes)
    
    println("  • Node capacities: $(length(node_capacities))")
    println("  • Edge capacities: $(length(edge_capacities))")
    println("  • Active sources: $(collect(keys(source_rates)))")
    println("  • Target nodes: $(collect(targets))")
    
    # Run capacity analysis
    capacity_params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)
    capacity_result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, capacity_params)
    
    capacity_time = time() - capacity_start_time
    println("  • Capacity analysis complete!")
    println("  • Computation time: $(round(capacity_time, digits=4)) seconds")
    println("  • Network utilization: $(round(capacity_result.network_utilization, digits=4))")
    
    # Show capacity results for target nodes
    println("  • Target node flows:")
    for target in targets
        flow = capacity_result.node_max_flows[target]
        println("    Node $target: $(round(flow, digits=2)) units/time")
    end
    println()
    
    # STEP 6: Run Critical Path Analysis
    println("⏱️ STEP 6: Running Critical Path Analysis...")
    cpm_start_time = time()
    
    # Load CPM data
    cpm_data = JSON.parsefile(filepath_cpm_json)
    time_analysis = cpm_data["time_analysis"]
    cost_analysis = cpm_data["cost_analysis"]
    
    # Convert time analysis data
    node_durations_raw = time_analysis["node_durations"]
    edge_delays_raw = time_analysis["edge_delays"]
    
    node_durations = Dict{Int64, Float64}()
    for (k, v) in node_durations_raw
        node_durations[parse(Int64, k)] = Float64(v)
    end
    
    edge_delays = Dict{Tuple{Int64,Int64}, Float64}()
    for (k, v) in edge_delays_raw
        cleaned_key = replace(k, "(" => "", ")" => "")
        parts = split(cleaned_key, ",")
        edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
        edge_delays[edge_key] = Float64(v)
    end
    
    # Run time-based critical path analysis
    time_params = CriticalPathParameters(
        node_durations,
        edge_delays,
        0.0,  # initial_value
        max_combination,
        additive_propagation,
        additive_propagation
    )
    
    time_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, time_params)
    
    # Convert cost analysis data  
    node_costs_raw = cost_analysis["node_costs"]
    edge_costs_raw = cost_analysis["edge_costs"]
    
    node_costs = Dict{Int64, Float64}()
    for (k, v) in node_costs_raw
        node_costs[parse(Int64, k)] = Float64(v)
    end
    
    edge_costs = Dict{Tuple{Int64,Int64}, Float64}()
    for (k, v) in edge_costs_raw
        cleaned_key = replace(k, "(" => "", ")" => "")
        parts = split(cleaned_key, ",")
        edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
        edge_costs[edge_key] = Float64(v)
    end
    
    # Run cost-based critical path analysis
    cost_params = CriticalPathParameters(
        node_costs,
        edge_costs,
        0.0,  # initial_value
        max_combination,
        additive_propagation,
        additive_propagation
    )
    
    cost_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, cost_params)
    
    cpm_time = time() - cpm_start_time
    println("  • Critical path analysis complete!")
    println("  • Computation time: $(round(cpm_time, digits=4)) seconds")
    println("  • Critical path duration: $(round(time_result.critical_value, digits=2)) hours")
    println("  • Critical path cost: £$(round(cost_result.critical_value, digits=2))")
    println("  • Critical nodes (time): $(time_result.critical_nodes)")
    println("  • Critical nodes (cost): $(cost_result.critical_nodes)")
    println()
    
    # STEP 7: Comprehensive comparison
    println("📊 STEP 7: Comprehensive Comparison")
    println("-"^50)
    
    println("PERFORMANCE:")
    println("  • Reachability time: $(round(reachability_time, digits=4)) seconds")
    println("  • Capacity time: $(round(capacity_time, digits=4)) seconds")
    println("  • Critical Path time: $(round(cpm_time, digits=4)) seconds")
    println("  • Total time: $(round(reachability_time + capacity_time + cpm_time, digits=4)) seconds")
    println()
    
    println("NETWORK INSIGHTS:")
    total_source_input = sum(values(source_rates))
    total_target_output = sum(capacity_result.node_max_flows[t] for t in targets)
    
    println("  • Total source input: $(round(total_source_input, digits=2)) units/time")
    println("  • Total target output: $(round(total_target_output, digits=2)) units/time")  
    println("  • Network efficiency: $(round(total_target_output/total_source_input * 100, digits=2))%")
    println("  • Critical path duration: $(round(time_result.critical_value, digits=2)) hours")
    println("  • Total project cost: £$(round(cost_result.critical_value, digits=2))")
    println()
    
    # Multi-analysis correlation
    println("MULTI-ANALYSIS CORRELATION:")
    println("  • Reachability: Probabilistic analysis of information propagation")
    println("  • Capacity: Deterministic flow throughput analysis")  
    println("  • Critical Path: Time/cost optimization analysis")
    println("  • All three identify different aspects of network bottlenecks")
    
    # Show specific correlations for sink nodes
    println("  • Sink node comparison:")
    for target in targets
        if haskey(reachability_output, target)
            reachability_val = reachability_output[target]
            capacity_val = capacity_result.node_max_flows[target]
            time_val = haskey(time_result.node_values, target) ? time_result.node_values[target] : 0.0
            cost_val = haskey(cost_result.node_values, target) ? cost_result.node_values[target] : 0.0
            println("    Node $target: Reach=$(round(reachability_val, digits=3)), Flow=$(round(capacity_val, digits=1)), Time=$(round(time_val, digits=1))h, Cost=£$(round(cost_val, digits=0))")
        end
    end
    println()
    
    println("✅ COMPREHENSIVE NETWORK ANALYSIS COMPLETE!")
    println("="^70)
    
    return reachability_output, capacity_result, time_result, cost_result, reachability_time, capacity_time, cpm_time
end

# Run comprehensive analysis
println("Starting comprehensive network analysis (reachability + capacity + critical path)...")
reachability_results, capacity_results, time_results, cost_results, reach_time, cap_time, cpm_time = run_comprehensive_analysis("single-mission-drone-network")