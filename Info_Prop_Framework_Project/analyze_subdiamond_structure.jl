# Detailed Sub-Diamond Analysis
# This analyzes BOTH root and sub-diamonds to find the real bottleneck

if !@isdefined(script_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    current_dir = pwd()
    include("src/Network-flow-algos/src/IPAFramework.jl")
    using .IPAFramework

    global script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

# Use a smaller network for analysis
network_name = "HB0_local_3"
data_type = "float"

base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
json_network_name = network_name
filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")

println("="^80)
println("DETAILED SUB-DIAMOND ANALYSIS: $network_name")
println("="^80)

# Read network
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
allnodes = collect(keys(incoming_index))

node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

println("\n📊 NETWORK STATISTICS")
println("-"^80)
println("Total nodes: ", length(allnodes))
println("Total edges: ", length(edgelist))
println("Source nodes: ", length(source_nodes))
println("Fork nodes: ", length(fork_nodes))
println("Join nodes: ", length(join_nodes))

println("\n🔍 FINDING ROOT DIAMONDS...")
@time root_diamonds = identify_and_group_diamonds(
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

println("Found $(length(root_diamonds)) root diamonds")

println("\n🔨 BUILDING UNIQUE DIAMOND STORAGE (Including Sub-Diamonds)...")
println("This will take a few minutes...")
@time unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
    root_diamonds,
    node_priors,
    ancestors,
    descendants,
    iteration_sets
)

println("\nFound $(length(unique_diamonds)) total unique diamonds (root + sub)")

# ============================================================================
# DETAILED ANALYSIS OF ALL DIAMONDS
# ============================================================================

println("\n" * "="^80)
println("💎 COMPLETE DIAMOND ANALYSIS (Root + Sub-Diamonds)")
println("="^80)

root_cond_counts = Int[]
sub_cond_counts = Int[]
all_cond_counts = Int[]

root_state_spaces = BigInt[]
sub_state_spaces = BigInt[]

root_diamonds_data = []
sub_diamonds_data = []

for (hash_key, comp_data) in unique_diamonds
    diamond = comp_data.diamond
    num_cond = length(diamond.conditioning_nodes)
    state_space = BigInt(2)^num_cond

    push!(all_cond_counts, num_cond)

    if comp_data.is_rootDiamond
        push!(root_cond_counts, num_cond)
        push!(root_state_spaces, state_space)
        push!(root_diamonds_data, (num_cond, state_space, diamond))
    else
        push!(sub_cond_counts, num_cond)
        push!(sub_state_spaces, state_space)
        push!(sub_diamonds_data, (num_cond, state_space, diamond))
    end
end

println("\n📊 ROOT vs SUB-DIAMOND COMPARISON")
println("-"^80)
println("Root diamonds: ", length(root_cond_counts))
println("Sub-diamonds: ", length(sub_cond_counts))
println("Total: ", length(all_cond_counts))

println("\n🔴 ROOT DIAMONDS:")
if !isempty(root_cond_counts)
    println("  Min conditioning nodes: ", minimum(root_cond_counts))
    println("  Max conditioning nodes: ", maximum(root_cond_counts))
    println("  Mean conditioning nodes: ", round(sum(root_cond_counts) / length(root_cond_counts), digits=2))
    println("  Total states: ", sum(root_state_spaces))
end

println("\n🔵 SUB-DIAMONDS:")
if !isempty(sub_cond_counts)
    println("  Min conditioning nodes: ", minimum(sub_cond_counts))
    println("  Max conditioning nodes: ", maximum(sub_cond_counts))
    println("  Mean conditioning nodes: ", round(sum(sub_cond_counts) / length(sub_cond_counts), digits=2))
    println("  Total states: ", sum(sub_state_spaces))
end

println("\n🟢 OVERALL:")
println("  Min conditioning nodes: ", minimum(all_cond_counts))
println("  Max conditioning nodes: ", maximum(all_cond_counts))
println("  Mean conditioning nodes: ", round(sum(all_cond_counts) / length(all_cond_counts), digits=2))
println("  Median conditioning nodes: ", sort(all_cond_counts)[div(length(all_cond_counts), 2)])

# Histogram for ALL diamonds
println("\n📊 Histogram of ALL conditioning node counts:")
hist_data = Dict{Int, Int}()
for count in all_cond_counts
    hist_data[count] = get(hist_data, count, 0) + 1
end

for count in sort(collect(keys(hist_data)))
    freq = hist_data[count]
    bar = "█"^min(freq, 50)
    states = 2^count
    println("  $count cond nodes (2^$count=$states states): $bar ($freq diamonds)")
end

# Find worst offenders
println("\n💥 TOP 10 WORST DIAMONDS (by conditioning nodes)")
println("-"^80)

all_diamonds_sorted = sort(vcat(root_diamonds_data, sub_diamonds_data), by=x->x[1], rev=true)

for (rank, (num_cond, state_space, diamond)) in enumerate(all_diamonds_sorted[1:min(10, length(all_diamonds_sorted))])
    diamond_type = any(x -> x[3] === diamond, root_diamonds_data) ? "ROOT" : "SUB"

    println("\n#$rank: $diamond_type Diamond")
    println("  Conditioning nodes: $num_cond")
    println("  State space: $state_space states")
    println("  Conditioning node IDs: ", sort(collect(diamond.conditioning_nodes)))
    println("  Total relevant nodes: ", length(diamond.relevant_nodes))
    println("  Edges: ", length(diamond.edgelist))
end

# BDD Impact Analysis
println("\n" * "="^80)
println("🎯 BDD IMPACT ANALYSIS")
println("="^80)

max_cond = maximum(all_cond_counts)
problematic_count = count(x -> x > 10, all_cond_counts)
very_problematic_count = count(x -> x > 15, all_cond_counts)

println("\nWorst Case Diamond:")
println("  Conditioning nodes: $max_cond")
println("  State space: $(2^max_cond) states")
println("  This diamond alone requires $(2^max_cond) evaluations!")

println("\nProblematic Diamonds:")
println("  >10 conditioning nodes: $problematic_count diamonds")
println("  >15 conditioning nodes: $very_problematic_count diamonds")

total_states = sum(BigInt(2)^c for c in all_cond_counts)
println("\nTotal State Space:")
println("  All diamonds combined: $total_states state evaluations")

# Calculate BDD savings
estimated_bdd_cost = sum(c * 10 for c in all_cond_counts)  # Rough: O(n × avg_intermediate)
println("\nEstimated BDD Cost:")
println("  Approximate evaluations: ~$estimated_bdd_cost")
println("  Potential speedup: $(round(Float64(total_states) / estimated_bdd_cost, digits=1))x")

# Recommendation
println("\n" * "="^80)
println("📋 FINAL RECOMMENDATION")
println("="^80)

if max_cond <= 10
    println("⚠️  BDD would provide moderate speedup (max $max_cond conditioning nodes)")
    println("   Priority: MEDIUM")
elseif max_cond <= 15
    println("🔥 BDD is HIGHLY RECOMMENDED (max $max_cond conditioning nodes)")
    println("   Priority: HIGH")
    println("   $problematic_count diamonds are creating bottlenecks")
else
    println("💥 BDD is CRITICAL (max $max_cond conditioning nodes)")
    println("   Priority: URGENT")
    println("   Current approach is likely infeasible for this network size")
end

println("\nKey Insight:")
if !isempty(sub_cond_counts) && !isempty(root_cond_counts)
    if maximum(sub_cond_counts) > maximum(root_cond_counts)
        println("  ⚠️  SUB-DIAMONDS are LARGER than root diamonds!")
        println("     Max sub-diamond: $(maximum(sub_cond_counts)) cond nodes")
        println("     Max root diamond: $(maximum(root_cond_counts)) cond nodes")
        println("     → Recursive diamond structure creates exponential nesting!")
    else
        println("  ✓ Root diamonds are the bottleneck")
    end
end

println("\n" * "="^80)
println("Analysis complete!")
println("="^80)
