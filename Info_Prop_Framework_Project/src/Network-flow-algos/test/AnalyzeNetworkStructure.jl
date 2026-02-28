"""
Network Structure Analysis for Case Study Selection
Computes meaningful DAG and diamond metrics that correlate with BP complexity
"""

if !@isdefined(script_initialized)
    println("First run - initializing...")
    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, Statistics, Printf
    include("../src/IPAFramework.jl")
    using .IPAFramework
    global script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

all_networks = [
    "pareto-point-1-high-resilience-fw",
    "pareto-point-2-high-resilience-vtol",
    "pareto-point-3-medium-resilience-sparse",
    "pareto-point-4-low-resilience-minimal",
    "pareto-point-5-medium-resilience-fw",
    "pareto-point-6-balanced",
    "drone-network-balanced-k3",
    "drone-network-cost-optimal",
    "drone-network-time-optimal-k2"
]

"""
Compute max nesting depth via BFS from root diamonds
"""
function compute_max_nesting_depth(unique_diamonds)
    max_depth = 0
    for (hash, diamond_data) in unique_diamonds
        if diamond_data.is_rootDiamond
            # BFS from this root
            queue = [(hash, 1)]
            while !isempty(queue)
                curr_hash, curr_depth = popfirst!(queue)
                max_depth = max(max_depth, curr_depth)
                if haskey(unique_diamonds, curr_hash)
                    for (_, sub_d) in unique_diamonds[curr_hash].sub_diamond_structures
                        sub_hash = create_diamond_hash_key(sub_d.diamond)
                        push!(queue, (sub_hash, curr_depth + 1))
                    end
                end
            end
        end
    end
    return max_depth
end

"""
Compute comprehensive structural metrics for a network
"""
function analyze_network_structure(network_name, data_type="float")
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

    # Check files exist
    for (path, _) in [(filepath_graph, "graph"), (filepath_node_json, "priors"), (filepath_edge_json, "edges")]
        if !isfile(path)
            return nothing  # Skip missing networks
        end
    end

    # Load network
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
    node_priors = read_node_priors_from_json(filepath_node_json)

    allnodes = collect(keys(incoming_index))
    sink_nodes = Set(filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes))

    # Basic DAG metrics
    n_nodes = length(node_priors)
    n_edges = length(edgelist)
    n_sources = length(source_nodes)
    n_sinks = length(sink_nodes)

    # Build structure
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

    n_forks = length(fork_nodes)
    n_joins = length(join_nodes)
    depth = length(iteration_sets)

    # Density and branching metrics
    density = n_edges / (n_nodes * (n_nodes - 1) / 2)  # Edge density

    # Max fan-in/fan-out (critical for complexity)
    fan_in_values = [length(get(incoming_index, n, Set{Int64}())) for n in allnodes]
    fan_out_values = [length(get(outgoing_index, n, Set{Int64}())) for n in allnodes]
    max_fan_in = maximum(fan_in_values)
    max_fan_out = maximum(fan_out_values)

    # Fan-in distribution analysis - count nodes at each fan-in level
    nodes_fan_in_ge_5 = count(x -> x >= 5, fan_in_values)
    nodes_fan_in_ge_10 = count(x -> x >= 10, fan_in_values)
    nodes_fan_in_ge_15 = count(x -> x >= 15, fan_in_values)
    nodes_fan_in_ge_20 = count(x -> x >= 20, fan_in_values)

    # Sum of squared fan-ins (measure of "fan-in concentration")
    sum_sq_fan_in = sum(x -> x^2, fan_in_values)

    # Width metrics (nodes per layer)
    layer_widths = [length(s) for s in iteration_sets]
    max_width = maximum(layer_widths)
    avg_width = mean(layer_widths)

    # Diamond analysis
    t_diamond = @elapsed begin
        root_diamonds = identify_and_group_diamonds(
            join_nodes, incoming_index, ancestors, descendants,
            source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
        )
    end

    n_root_diamonds = length(root_diamonds)

    # Diamond size distribution
    if n_root_diamonds > 0
        diamond_sizes = [length(d.diamond.relevant_nodes) for d in values(root_diamonds)]
        diamond_cond_sizes = [length(d.diamond.conditioning_nodes) for d in values(root_diamonds)]

        max_diamond_size = maximum(diamond_sizes)
        avg_diamond_size = mean(diamond_sizes)
        max_conditioning = maximum(diamond_cond_sizes)
        avg_conditioning = mean(diamond_cond_sizes)
    else
        max_diamond_size = 0
        avg_diamond_size = 0.0
        max_conditioning = 0
        avg_conditioning = 0.0
    end

    # Build unique diamond storage for nesting analysis
    t_storage = @elapsed begin
        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds, node_priors, ancestors, descendants, iteration_sets
        )
    end

    n_unique_diamonds = length(unique_diamonds)

    # Nesting depth analysis
    if n_unique_diamonds > 0
        # Count diamonds with sub-diamonds (explicit loop to avoid closure issues)
        diamonds_with_subs = 0
        max_sub_diamonds = 0
        for d in values(unique_diamonds)
            if !isempty(d.sub_diamond_structures)
                diamonds_with_subs += 1
            end
            sub_count = length(d.sub_diamond_structures)
            if sub_count > max_sub_diamonds
                max_sub_diamonds = sub_count
            end
        end

        max_nesting_depth = compute_max_nesting_depth(unique_diamonds)
    else
        diamonds_with_subs = 0
        max_sub_diamonds = 0
        max_nesting_depth = 0
    end

    # Complexity indicators
    # 2^(max_conditioning) is worst-case enumeration per diamond
    worst_case_enum = n_root_diamonds > 0 ? 2^max_conditioning : 1

    # Join coverage: what fraction of joins have diamonds
    join_coverage = n_joins > 0 ? n_root_diamonds / n_joins : 0.0

    return Dict(
        # Basic DAG
        :network => network_name,
        :nodes => n_nodes,
        :edges => n_edges,
        :sources => n_sources,
        :sinks => n_sinks,
        :depth => depth,

        # Topology
        :forks => n_forks,
        :joins => n_joins,
        :max_fan_in => max_fan_in,
        :max_fan_out => max_fan_out,
        :max_width => max_width,
        :avg_width => round(avg_width, digits=1),
        :density => round(density, digits=4),

        # Fan-in distribution (bottleneck analysis)
        :nodes_fan_in_ge_5 => nodes_fan_in_ge_5,
        :nodes_fan_in_ge_10 => nodes_fan_in_ge_10,
        :nodes_fan_in_ge_15 => nodes_fan_in_ge_15,
        :nodes_fan_in_ge_20 => nodes_fan_in_ge_20,
        :sum_sq_fan_in => sum_sq_fan_in,

        # Diamond structure
        :root_diamonds => n_root_diamonds,
        :unique_diamonds => n_unique_diamonds,
        :max_diamond_size => max_diamond_size,
        :avg_diamond_size => round(avg_diamond_size, digits=1),
        :max_conditioning => max_conditioning,
        :avg_conditioning => round(avg_conditioning, digits=1),

        # Nesting
        :max_nesting_depth => max_nesting_depth,
        :diamonds_with_subs => diamonds_with_subs,
        :max_sub_diamonds => max_sub_diamonds,

        # Complexity indicators
        :join_coverage => round(join_coverage, digits=2),
        :worst_case_enum => worst_case_enum,

        # Timing
        :t_diamond_id => round(t_diamond, digits=3),
        :t_storage => round(t_storage, digits=3)
    )
end

"""
Run analysis on all networks and produce comparison table
"""
function run_full_analysis()
    println("\n" * "="^100)
    println("NETWORK STRUCTURE ANALYSIS FOR CASE STUDY SELECTION")
    println("="^100 * "\n")

    results = []

    for network_name in all_networks
        print("Analyzing: $network_name ... ")
        try
            metrics = analyze_network_structure(network_name)
            if metrics !== nothing
                push!(results, metrics)
                println("done")
            else
                println("SKIPPED (files missing)")
            end
        catch e
            println("ERROR: $e")
            showerror(stdout, e, catch_backtrace())
            println()
        end
    end

    if isempty(results)
        println("No networks analyzed successfully!")
        return nothing
    end

    # Print summary tables
    println("\n" * "="^100)
    println("BASIC DAG STRUCTURE")
    println("="^100)
    println()

    # Header
    @printf("%-45s %6s %6s %6s %6s %5s\n",
            "Network", "Nodes", "Edges", "Src", "Sink", "Depth")
    println("-"^80)

    for r in results
        @printf("%-45s %6d %6d %6d %6d %5d\n",
                r[:network], r[:nodes], r[:edges], r[:sources], r[:sinks], r[:depth])
    end

    println("\n" * "="^100)
    println("TOPOLOGY METRICS")
    println("="^100)
    println()

    @printf("%-45s %6s %6s %7s %8s %8s %8s\n",
            "Network", "Forks", "Joins", "MaxFanI", "MaxFanO", "MaxWid", "AvgWid")
    println("-"^95)

    for r in results
        @printf("%-45s %6d %6d %7d %8d %8d %8.1f\n",
                r[:network], r[:forks], r[:joins], r[:max_fan_in],
                r[:max_fan_out], r[:max_width], r[:avg_width])
    end

    println("\n" * "="^100)
    println("FAN-IN DISTRIBUTION (Bottleneck Analysis)")
    println("="^100)
    println()

    @printf("%-45s %8s %8s %8s %8s %10s\n",
            "Network", "FanIn≥5", "FanIn≥10", "FanIn≥15", "FanIn≥20", "SumSqFanIn")
    println("-"^95)

    for r in results
        @printf("%-45s %8d %8d %8d %8d %10d\n",
                r[:network], r[:nodes_fan_in_ge_5], r[:nodes_fan_in_ge_10],
                r[:nodes_fan_in_ge_15], r[:nodes_fan_in_ge_20], r[:sum_sq_fan_in])
    end

    println("\n" * "="^100)
    println("DIAMOND STRUCTURE (Key Complexity Indicators)")
    println("="^100)
    println()

    @printf("%-45s %6s %6s %7s %8s %8s %8s\n",
            "Network", "RootD", "UniqD", "MaxSize", "AvgSize", "MaxCond", "AvgCond")
    println("-"^95)

    for r in results
        @printf("%-45s %6d %6d %7d %8.1f %8d %8.1f\n",
                r[:network], r[:root_diamonds], r[:unique_diamonds],
                r[:max_diamond_size], r[:avg_diamond_size],
                r[:max_conditioning], r[:avg_conditioning])
    end

    println("\n" * "="^100)
    println("DIAMOND NESTING & COMPLEXITY")
    println("="^100)
    println()

    @printf("%-45s %8s %10s %10s %10s %12s\n",
            "Network", "NestDep", "DiamWSub", "MaxSubD", "JoinCov", "WorstEnum")
    println("-"^100)

    for r in results
        @printf("%-45s %8d %10d %10d %10.2f %12d\n",
                r[:network], r[:max_nesting_depth], r[:diamonds_with_subs],
                r[:max_sub_diamonds], r[:join_coverage], r[:worst_case_enum])
    end

    println("\n" * "="^100)
    println("PREPROCESSING TIME")
    println("="^100)
    println()

    @printf("%-45s %12s %12s\n", "Network", "DiamondID(s)", "Storage(s)")
    println("-"^70)

    for r in results
        @printf("%-45s %12.3f %12.3f\n",
                r[:network], r[:t_diamond_id], r[:t_storage])
    end

    # Key insights (only if we have enough results)
    if length(results) >= 1
        println("\n" * "="^100)
        println("KEY INSIGHTS FOR CASE STUDY SELECTION")
        println("="^100)
        println()

        # Sort by various complexity measures
        by_conditioning = sort(results, by=r->r[:max_conditioning], rev=true)
        by_diamonds = sort(results, by=r->r[:unique_diamonds], rev=true)
        by_nesting = sort(results, by=r->r[:max_nesting_depth], rev=true)

        println("Most complex by max conditioning nodes (exponential enumeration):")
        for r in by_conditioning[1:min(3, length(by_conditioning))]
            println("  $(r[:network]): $(r[:max_conditioning]) conditioning -> 2^$(r[:max_conditioning]) = $(r[:worst_case_enum]) states")
        end

        println("\nMost complex by unique diamond count:")
        for r in by_diamonds[1:min(3, length(by_diamonds))]
            println("  $(r[:network]): $(r[:unique_diamonds]) unique diamonds")
        end

        println("\nDeepest diamond nesting:")
        for r in by_nesting[1:min(3, length(by_nesting))]
            println("  $(r[:network]): nesting depth $(r[:max_nesting_depth])")
        end

        # Diversity recommendation (only if 3+ results)
        if length(results) >= 3
            println("\n" * "-"^50)
            println("RECOMMENDED CASE STUDY SET (diverse complexity):")
            println("-"^50)

            # Pick: simplest, most complex, and one in middle
            by_total_complexity = sort(results, by=r->r[:unique_diamonds] * r[:max_conditioning] + 1)

            println("  SIMPLE:  $(by_total_complexity[1][:network])")
            mid_idx = max(1, div(length(by_total_complexity) + 1, 2))
            println("  MEDIUM:  $(by_total_complexity[mid_idx][:network])")
            println("  COMPLEX: $(by_total_complexity[end][:network])")
        end
    end

    return results
end

# Run the analysis
results = run_full_analysis()
