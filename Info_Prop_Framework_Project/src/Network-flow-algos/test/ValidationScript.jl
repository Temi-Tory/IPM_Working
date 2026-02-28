"""
Validation Script
1. Validates network structure characteristics for pareto networks + grid
2. Runs optimized BP on grid network (priors=1.0, edge_probs=0.9) for comparison against DPRPM table
"""

if !@isdefined(validation_script_initialized)
    println("First run - initializing...")
    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, Statistics, Printf

    # Load optimized framework for BP
    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    global validation_script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# ============================================================================
# PART 1: Network Structure Analysis (validates table metrics)
# ============================================================================

"""
Compute max nesting depth via BFS from root diamonds
"""
function compute_max_nesting_depth(unique_diamonds)
    max_depth = 0
    for (hash, diamond_data) in unique_diamonds
        if diamond_data.is_rootDiamond
            queue = [(hash, 1)]
            while !isempty(queue)
                curr_hash, curr_depth = popfirst!(queue)
                max_depth = max(max_depth, curr_depth)
                if haskey(unique_diamonds, curr_hash)
                    for (_, sub_d) in unique_diamonds[curr_hash].sub_diamond_structures
                        sub_hash = IPAFrameworkOptimized.create_diamond_hash_key(sub_d.diamond)
                        push!(queue, (sub_hash, curr_depth + 1))
                    end
                end
            end
        end
    end
    return max_depth
end

"""
Analyze network structure - returns metrics dict
"""
function analyze_network_structure(network_name, data_type="float")
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

    # Check files exist
    for path in [filepath_graph, filepath_node_json, filepath_edge_json]
        if !isfile(path)
            println("  Missing: $path")
            return nothing
        end
    end

    # Load network
    edgelist, outgoing_index, incoming_index, source_nodes = IPAFrameworkOptimized.read_graph_to_dict(filepath_graph)
    node_priors = IPAFrameworkOptimized.read_node_priors_from_json(filepath_node_json)

    allnodes = collect(keys(incoming_index))
    sink_nodes = Set(filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes))

    # Basic DAG metrics
    n_nodes = length(node_priors)
    n_edges = length(edgelist)
    n_sources = length(source_nodes)
    n_sinks = length(sink_nodes)

    # Build structure
    fork_nodes, join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = IPAFrameworkOptimized.find_iteration_sets(edgelist, outgoing_index, incoming_index)

    n_forks = length(fork_nodes)
    n_joins = length(join_nodes)
    depth = length(iteration_sets)

    # Fan-in/fan-out
    fan_in_values = [length(get(incoming_index, n, Set{Int64}())) for n in allnodes]
    fan_out_values = [length(get(outgoing_index, n, Set{Int64}())) for n in allnodes]
    max_fan_in = maximum(fan_in_values)
    max_fan_out = maximum(fan_out_values)

    # Width metrics
    layer_widths = [length(s) for s in iteration_sets]
    max_width = maximum(layer_widths)

    # Diamond analysis
    root_diamonds = IPAFrameworkOptimized.identify_and_group_diamonds(
        join_nodes, incoming_index, ancestors, descendants,
        source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
    )
    n_root_diamonds = length(root_diamonds)

    # Diamond metrics
    if n_root_diamonds > 0
        diamond_cond_sizes = [length(d.diamond.conditioning_nodes) for d in values(root_diamonds)]
        max_conditioning = maximum(diamond_cond_sizes)
    else
        max_conditioning = 0
    end

    # Build unique diamond storage
    unique_diamonds = IPAFrameworkOptimized.build_unique_diamond_storage_depth_first_parallel(
        root_diamonds, node_priors, ancestors, descendants, iteration_sets
    )
    n_unique_diamonds = length(unique_diamonds)

    # Nesting depth
    max_nesting_depth = n_unique_diamonds > 0 ? compute_max_nesting_depth(unique_diamonds) : 0

    return Dict(
        :network => network_name,
        :nodes => n_nodes,
        :edges => n_edges,
        :sources => n_sources,
        :sinks => n_sinks,
        :depth => depth,
        :forks => n_forks,
        :joins => n_joins,
        :max_fan_in => max_fan_in,
        :max_fan_out => max_fan_out,
        :max_width => max_width,
        :root_diamonds => n_root_diamonds,
        :unique_diamonds => n_unique_diamonds,
        :max_conditioning => max_conditioning,
        :max_nesting_depth => max_nesting_depth
    )
end

"""
Run structure analysis on all networks
"""
function run_structure_validation()
    println("\n" * "="^100)
    println("NETWORK STRUCTURE VALIDATION")
    println("="^100)

    networks = [
        "pareto-point-1-high-resilience-fw",
        "pareto-point-2-high-resilience-vtol",
        "pareto-point-3-medium-resilience-sparse",
        "pareto-point-4-low-resilience-minimal",
        "pareto-point-5-medium-resilience-fw",
        "pareto-point-6-balanced",
        "grid-graph"
    ]

    results = []
    for network in networks
        print("Analyzing: $network ... ")
        try
            metrics = analyze_network_structure(network)
            if metrics !== nothing
                push!(results, metrics)
                println("done")
            else
                println("SKIPPED")
            end
        catch e
            println("ERROR: $e")
        end
    end

    if isempty(results)
        println("No networks analyzed!")
        return nothing
    end

    # Print table
    println("\n" * "-"^120)
    @printf("%-45s %6s %6s %6s %6s %5s %6s %6s %7s %6s %6s\n",
            "Network", "Nodes", "Edges", "Src", "Sink", "Depth", "Forks", "Joins", "MaxFanI", "RootD", "UniqD")
    println("-"^120)

    for r in results
        @printf("%-45s %6d %6d %6d %6d %5d %6d %6d %7d %6d %6d\n",
                r[:network], r[:nodes], r[:edges], r[:sources], r[:sinks],
                r[:depth], r[:forks], r[:joins], r[:max_fan_in],
                r[:root_diamonds], r[:unique_diamonds])
    end

    println("\n" * "-"^80)
    @printf("%-45s %8s %8s\n", "Network", "MaxCond", "NestDep")
    println("-"^80)

    for r in results
        @printf("%-45s %8d %8d\n", r[:network], r[:max_conditioning], r[:max_nesting_depth])
    end

    return results
end

# ============================================================================
# PART 2: Grid Network BP Validation (compare against DPRPM Table 2)
# ============================================================================

"""
Run optimized BP on grid network with priors=1.0, edge_probs=0.9
Prints results for manual comparison against DPRPM Table 2
"""
function run_grid_bp_validation()
    println("\n" * "="^100)
    println("GRID NETWORK BP VALIDATION")
    println("Compare results against DPRPM Table 2 (Exact column)")
    println("="^100)

    network_name = "grid-graph"
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, "float", network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, "float", network_name * "-linkprobabilities.json")

    # Load network
    println("\nLoading network...")
    edgelist, outgoing_index, incoming_index, source_nodes = IPAFrameworkOptimized.read_graph_to_dict(filepath_graph)
    node_priors = IPAFrameworkOptimized.read_node_priors_from_json(filepath_node_json)
    edge_probabilities = IPAFrameworkOptimized.read_edge_probabilities_from_json(filepath_edge_json)

    # OVERRIDE: Set all node priors to 1.0
    println("Overriding all node priors to 1.0...")
    for key in keys(node_priors)
        node_priors[key] = 1.0
    end

    # OVERRIDE: Set all edge probabilities to 0.9
    println("Overriding all edge probabilities to 0.9...")
    for key in keys(edge_probabilities)
        edge_probabilities[key] = 0.9
    end

    # Build structure
    println("Building network structure...")
    fork_nodes, join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = IPAFrameworkOptimized.find_iteration_sets(edgelist, outgoing_index, incoming_index)

    # Identify diamonds
    println("Identifying diamonds...")
    root_diamonds = IPAFrameworkOptimized.identify_and_group_diamonds(
        join_nodes, incoming_index, ancestors, descendants,
        source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
    )

    # Build unique storage
    println("Building unique diamond storage...")
    unique_diamonds = IPAFrameworkOptimized.build_unique_diamond_storage_depth_first_parallel(
        root_diamonds, node_priors, ancestors, descendants, iteration_sets
    )

    # Run BP
    println("Running belief propagation...")
    t_bp = @elapsed begin
        final_beliefs = IPAFrameworkOptimized.update_beliefs_iterative(
            edgelist, iteration_sets, outgoing_index, incoming_index,
            source_nodes, node_priors, edge_probabilities,
            descendants, ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds
        )
    end

    println("BP completed in $(round(t_bp, digits=4))s")

    # DPRPM Table 2 exact values (for reference)
    exact_values = Dict(
        2 => 0.99000, 4 => 0.98015, 5 => 0.90000, 6 => 0.99510,
        7 => 0.98956, 8 => 0.89060, 9 => 0.98100, 10 => 0.88290,
        11 => 0.97734, 12 => 0.97457, 14 => 0.97946, 15 => 0.98498,
        16 => 0.98539
    )

    # Print results
    println("\n" * "-"^80)
    println("RESULTS COMPARISON (IPA vs DPRPM Table 2 Exact)")
    println("-"^80)
    @printf("%6s %12s %12s %12s\n", "Node", "IPA Result", "DPRPM Exact", "Difference")
    println("-"^80)

    sorted_nodes = sort(collect(keys(final_beliefs)))
    max_diff = 0.0

    for node in sorted_nodes
        ipa_val = final_beliefs[node]
        if haskey(exact_values, node)
            exact_val = exact_values[node]
            diff = abs(ipa_val - exact_val)
            max_diff = max(max_diff, diff)
            @printf("%6d %12.5f %12.5f %12.2e\n", node, ipa_val, exact_val, diff)
        else
            @printf("%6d %12.5f %12s %12s\n", node, ipa_val, "N/A", "-")
        end
    end

    println("-"^80)
    println("Maximum difference: $(round(max_diff, digits=10))")

    if max_diff < 1e-4
        println("✓ VALIDATION PASSED - Results match DPRPM Table 2")
    else
        println("✗ VALIDATION FAILED - Significant differences detected")
    end

    return final_beliefs
end

# ============================================================================
# RUN BOTH VALIDATIONS
# ============================================================================

println("\n" * "="^100)
println("RUNNING FULL VALIDATION")
println("="^100)

# Part 1: Structure validation
structure_results = run_structure_validation()

# Part 2: Grid BP validation
grid_beliefs = run_grid_bp_validation()

println("\n" * "="^100)
println("VALIDATION COMPLETE")
println("="^100)

log_filepath = "validtaionscript.txt"
open(log_filepath, "w") do log_file
    println(log_file, "NETWORK STRUCTURE VALIDATION RESULTS")
    println(log_file, "="^100)
    for r in structure_results
        println(log_file, r)
    end

    println(log_file, "\nGRID NETWORK BP VALIDATION RESULTS")
    println(log_file, "="^100)
    for (node, belief) in sort(collect(grid_beliefs))
        println(log_file, "Node $node: Belief = $belief")
    end
end