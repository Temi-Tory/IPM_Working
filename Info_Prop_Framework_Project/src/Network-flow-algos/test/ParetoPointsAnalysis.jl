"""
Pareto Points DAG Structure Analysis
Clean summary table for case study documentation
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

# Only the 6 pareto points
pareto_networks = [
    "pareto-point-1-high-resilience-fw",
    "pareto-point-2-high-resilience-vtol",
    "pareto-point-3-medium-resilience-sparse",
    "pareto-point-4-low-resilience-minimal",
    "pareto-point-5-medium-resilience-fw",
    "pareto-point-6-balanced"
]

"""
Compute nesting depths for all diamonds via BFS from root diamonds
Returns (max_depth, avg_depth, all_depths)
"""
function compute_nesting_depths(unique_diamonds)
    if isempty(unique_diamonds)
        return (0, 0.0, Int[])
    end

    all_depths = Int[]

    for (hash, diamond_data) in unique_diamonds
        if diamond_data.is_rootDiamond
            # BFS from this root
            queue = [(hash, 1)]
            while !isempty(queue)
                curr_hash, curr_depth = popfirst!(queue)
                push!(all_depths, curr_depth)

                if haskey(unique_diamonds, curr_hash)
                    for (_, sub_d) in unique_diamonds[curr_hash].sub_diamond_structures
                        sub_hash = create_diamond_hash_key(sub_d.diamond)
                        push!(queue, (sub_hash, curr_depth + 1))
                    end
                end
            end
        end
    end

    if isempty(all_depths)
        return (0, 0.0, Int[])
    end

    return (maximum(all_depths), mean(all_depths), all_depths)
end

# Short names for cleaner table
short_names = Dict(
    "pareto-point-1-high-resilience-fw" => "PP1-HighRes-FW",
    "pareto-point-2-high-resilience-vtol" => "PP2-HighRes-VTOL",
    "pareto-point-3-medium-resilience-sparse" => "PP3-MedRes-Sparse",
    "pareto-point-4-low-resilience-minimal" => "PP4-LowRes-Min",
    "pareto-point-5-medium-resilience-fw" => "PP5-MedRes-FW",
    "pareto-point-6-balanced" => "PP6-Balanced"
)

# BP timing data (seconds) - from user's benchmarks
bp_timing = Dict(
    "pareto-point-1-high-resilience-fw" => ">600",      # Still running after 10+ min
    "pareto-point-2-high-resilience-vtol" => "0.31",
    "pareto-point-3-medium-resilience-sparse" => "281",
    "pareto-point-4-low-resilience-minimal" => "0.02",
    "pareto-point-5-medium-resilience-fw" => "256",
    "pareto-point-6-balanced" => "0.02"
)

"""
Analyze a single network and return clean metrics
"""
function analyze_pareto_point(network_name, data_type="float")
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")

    # Load network
    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
    node_priors = read_node_priors_from_json(filepath_node_json)

    allnodes = collect(keys(incoming_index))
    sink_nodes = Set(filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes))

    # Basic counts
    n_nodes = length(node_priors)
    n_edges = length(edgelist)
    n_sources = length(source_nodes)
    n_sinks = length(sink_nodes)

    # Topology
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

    n_forks = length(fork_nodes)
    n_joins = length(join_nodes)

    # Fan-in analysis (key complexity indicator)
    fan_in_values = [length(get(incoming_index, n, Set{Int64}())) for n in allnodes]
    max_fan_in = maximum(fan_in_values)

    # Diamond analysis
    root_diamonds = identify_and_group_diamonds(
        join_nodes, incoming_index, ancestors, descendants,
        source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
    )

    n_root_diamonds = length(root_diamonds)  # Joins that form diamonds

    # Build unique diamond storage
    unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
        root_diamonds, node_priors, ancestors, descendants, iteration_sets
    )

    n_unique_diamonds = length(unique_diamonds)

    # Compute nesting depths
    max_nest_depth, avg_nest_depth, _ = compute_nesting_depths(unique_diamonds)

    # Collect ALL unique conditioning nodes across ALL diamonds
    all_conditioning_nodes = Set{Int64}()
    for (_, diamond_data) in unique_diamonds
        union!(all_conditioning_nodes, diamond_data.diamond.conditioning_nodes)
    end
    n_unique_conditioning = length(all_conditioning_nodes)

    # Conditioning node distribution (how many diamonds does each conditioning node appear in)
    conditioning_frequency = Dict{Int64, Int}()
    for (_, diamond_data) in unique_diamonds
        for cond_node in diamond_data.diamond.conditioning_nodes
            conditioning_frequency[cond_node] = get(conditioning_frequency, cond_node, 0) + 1
        end
    end

    # Stats on conditioning node reuse
    if !isempty(conditioning_frequency)
        freq_values = collect(values(conditioning_frequency))
        max_cond_reuse = maximum(freq_values)
        avg_cond_reuse = mean(freq_values)
    else
        max_cond_reuse = 0
        avg_cond_reuse = 0.0
    end

    # Fraction of forks that participate in diamonds
    forks_in_diamonds = length(intersect(all_conditioning_nodes, fork_nodes))
    fork_diamond_ratio = n_forks > 0 ? forks_in_diamonds / n_forks : 0.0

    return Dict(
        :network => network_name,
        :short_name => short_names[network_name],
        :nodes => n_nodes,
        :edges => n_edges,
        :sources => n_sources,
        :sinks => n_sinks,
        :forks => n_forks,
        :joins => n_joins,
        :max_fan_in => max_fan_in,
        :joins_with_diamonds => n_root_diamonds,
        :unique_diamonds => n_unique_diamonds,
        :max_nest_depth => max_nest_depth,
        :avg_nest_depth => round(avg_nest_depth, digits=1),
        :unique_conditioning => n_unique_conditioning,
        :forks_in_diamonds => forks_in_diamonds,
        :fork_diamond_ratio => round(fork_diamond_ratio, digits=2),
        :max_cond_reuse => max_cond_reuse,
        :avg_cond_reuse => round(avg_cond_reuse, digits=1),
        :bp_time => bp_timing[network_name]
    )
end

"""
Run analysis and print clean table
"""
function run_pareto_analysis()
    println("\n" * "="^120)
    println("PARETO POINTS - DAG STRUCTURE SUMMARY")
    println("="^120)

    results = []
    for network_name in pareto_networks
        print("Analyzing: $(short_names[network_name]) ... ")
        metrics = analyze_pareto_point(network_name)
        push!(results, metrics)
        println("done")
    end

    # Main summary table
    println("\n" * "="^120)
    println("NETWORK STRUCTURE OVERVIEW")
    println("="^120)
    println()

    @printf("%-20s | %5s | %5s | %5s | %5s | %5s | %5s | %7s | %8s | %8s | %7s | %7s | %8s | %8s\n",
            "Network", "Nodes", "Edges", "Src", "Sink", "Forks", "Joins", "MaxFanI", "DiamJoin", "UniqDiam", "MaxNest", "AvgNest", "UniqCond", "BP Time")
    println("-"^160)

    for r in results
        @printf("%-20s | %5d | %5d | %5d | %5d | %5d | %5d | %7d | %8d | %8d | %7d | %7.1f | %8d | %8s\n",
                r[:short_name], r[:nodes], r[:edges], r[:sources], r[:sinks],
                r[:forks], r[:joins], r[:max_fan_in], r[:joins_with_diamonds],
                r[:unique_diamonds], r[:max_nest_depth], r[:avg_nest_depth],
                r[:unique_conditioning], r[:bp_time])
    end

    # Diamond participation analysis
    println("\n" * "="^120)
    println("DIAMOND PARTICIPATION ANALYSIS")
    println("="^120)
    println()

    println("Columns:")
    println("  DiamJoin    = Number of join nodes that have diamond structures (root diamonds)")
    println("  UniqDiam    = Total unique diamonds (including nested sub-diamonds)")
    println("  UniqCond    = Unique conditioning nodes (forks that form diamond 'roofs')")
    println("  ForksInDiam = How many forks participate in at least one diamond")
    println("  ForkRatio   = Fraction of all forks that participate in diamonds")
    println("  MaxReuse    = Max times a single conditioning node appears across diamonds")
    println("  AvgReuse    = Average reuse of conditioning nodes")
    println()

    @printf("%-20s | %8s | %8s | %8s | %10s | %9s | %8s | %8s\n",
            "Network", "DiamJoin", "UniqDiam", "UniqCond", "ForksInDiam", "ForkRatio", "MaxReuse", "AvgReuse")
    println("-"^120)

    for r in results
        @printf("%-20s | %8d | %8d | %8d | %10d | %9.2f | %8d | %8.1f\n",
                r[:short_name], r[:joins_with_diamonds], r[:unique_diamonds],
                r[:unique_conditioning], r[:forks_in_diamonds],
                r[:fork_diamond_ratio], r[:max_cond_reuse], r[:avg_cond_reuse])
    end

    # Ratios table
    println("\n" * "="^120)
    println("KEY RATIOS")
    println("="^120)
    println()

    @printf("%-20s | %12s | %12s | %12s\n",
            "Network", "Joins/Nodes", "DiamJoin/Join", "Diam/Join")
    println("-"^70)

    for r in results
        join_node_ratio = r[:joins] / r[:nodes]
        diamond_join_ratio = r[:joins] > 0 ? r[:joins_with_diamonds] / r[:joins] : 0.0
        diam_per_join = r[:joins] > 0 ? r[:unique_diamonds] / r[:joins] : 0.0

        @printf("%-20s | %12.2f | %12.2f | %12.1f\n",
                r[:short_name], join_node_ratio, diamond_join_ratio, diam_per_join)
    end

    # Observations
    println("\n" * "="^120)
    println("OBSERVATIONS")
    println("="^120)
    println()

    # Find extremes
    no_diamonds = filter(r -> r[:unique_diamonds] == 0, results)
    most_diamonds = sort(results, by=r->r[:unique_diamonds], rev=true)[1]
    most_conditioning = sort(results, by=r->r[:unique_conditioning], rev=true)[1]

    if !isempty(no_diamonds)
        println("Networks with NO diamonds (pure trees):")
        for r in no_diamonds
            println("  - $(r[:short_name]): $(r[:joins]) joins but all have single-path dependencies")
        end
    end

    println("\nMost diamond-dense network:")
    println("  - $(most_diamonds[:short_name]): $(most_diamonds[:unique_diamonds]) unique diamonds from $(most_diamonds[:joins_with_diamonds]) diamond-joins")

    println("\nMost conditioning nodes:")
    println("  - $(most_conditioning[:short_name]): $(most_conditioning[:unique_conditioning]) unique forks form diamond roofs")

    return results
end

# Run and log to file
log_filepath = "pareto_points_analysis.txt"
open(log_filepath, "w") do log_file
    redirect_stdout(log_file) do
        global results = run_pareto_analysis()
    end
end
println("Analysis written to: $log_filepath")

# Also print to console
results = run_pareto_analysis()
