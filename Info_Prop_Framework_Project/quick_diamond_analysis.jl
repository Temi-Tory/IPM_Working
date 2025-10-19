# Quick Diamond Analysis - Just Root Diamonds
# Fast analysis without building full diamond storage

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

network_name = "drone-network-full"
data_type = "float"

base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
json_network_name = network_name
filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")

println("="^80)
println("QUICK DIAMOND ANALYSIS: $network_name")
println("="^80)

# Read network
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
allnodes = collect(keys(incoming_index))
sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)

node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

# Basic stats
println("\n📊 NETWORK STATISTICS")
println("-"^80)
println("Total nodes: ", length(allnodes))
println("Total edges: ", length(edgelist))
println("Source nodes: ", length(source_nodes))
println("Sink nodes: ", length(sink_nodes))

fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

println("Fork nodes: ", length(fork_nodes))
println("Join nodes: ", length(join_nodes))
println("Iteration levels: ", length(iteration_sets))

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

l_root_diamonds = length(root_diamonds)
println("\nFound $l_root_diamonds root diamonds")

# ============================================================================
# ANALYZE ROOT DIAMONDS ONLY (FAST)
# ============================================================================

println("\n" * "="^80)
println("💎 ROOT DIAMOND ANALYSIS (Fast - No Sub-Diamond Building)")
println("="^80)

conditioning_node_counts = Int[]
intermediate_node_counts = Int[]
edge_counts = Int[]
relevant_node_counts = Int[]
state_space_sizes = BigInt[]
join_node_ids = Int[]

for (join_node, diamond_at_node) in root_diamonds
    diamond = diamond_at_node.diamond

    num_conditioning = length(diamond.conditioning_nodes)
    num_edges = length(diamond.edgelist)
    num_relevant = length(diamond.relevant_nodes)

    # Calculate sinks
    sources_in_diamond = Set{Int64}()
    targets_in_diamond = Set{Int64}()
    for (src, dst) in diamond.edgelist
        push!(sources_in_diamond, src)
        push!(targets_in_diamond, dst)
    end
    sink_in_diamond = setdiff(targets_in_diamond, sources_in_diamond)
    num_intermediate = num_relevant - num_conditioning - length(sink_in_diamond)

    state_space = BigInt(2)^num_conditioning

    push!(conditioning_node_counts, num_conditioning)
    push!(intermediate_node_counts, num_intermediate)
    push!(edge_counts, num_edges)
    push!(relevant_node_counts, num_relevant)
    push!(state_space_sizes, state_space)
    push!(join_node_ids, join_node)
end

# Statistics
println("\n📈 CONDITIONING NODES DISTRIBUTION")
println("-"^80)
println("Min conditioning nodes: ", minimum(conditioning_node_counts))
println("Max conditioning nodes: ", maximum(conditioning_node_counts))
println("Mean conditioning nodes: ", round(sum(conditioning_node_counts) / length(conditioning_node_counts), digits=2))
println("Median conditioning nodes: ", sort(conditioning_node_counts)[div(length(conditioning_node_counts), 2)])

# Histogram
println("\nHistogram of conditioning node counts:")
hist_data = Dict{Int, Int}()
for count in conditioning_node_counts
    hist_data[count] = get(hist_data, count, 0) + 1
end

for count in sort(collect(keys(hist_data)))
    freq = hist_data[count]
    bar = "█"^min(freq, 50)
    println("  $count nodes: $bar ($freq diamonds)")
end

println("\n📊 INTERMEDIATE NODES DISTRIBUTION")
println("-"^80)
println("Min intermediate nodes: ", minimum(intermediate_node_counts))
println("Max intermediate nodes: ", maximum(intermediate_node_counts))
println("Mean intermediate nodes: ", round(sum(intermediate_node_counts) / length(intermediate_node_counts), digits=2))

println("\n🔢 STATE SPACE ANALYSIS (ROOT DIAMONDS ONLY)")
println("-"^80)
total_states = sum(state_space_sizes)
println("Total states to evaluate (root only): ", total_states)
println("Largest single diamond state space: ", maximum(state_space_sizes))

# Find worst diamonds
problematic_count = count(x -> x > 10, conditioning_node_counts)
very_problematic_count = count(x -> x > 15, conditioning_node_counts)

println("\n⚠️  PROBLEMATIC DIAMONDS SUMMARY")
println("-"^80)
println("Diamonds with >10 conditioning nodes: $problematic_count")
println("Diamonds with >15 conditioning nodes: $very_problematic_count")

if problematic_count > 0
    println("\n💥 WORST CASE DIAMONDS:")
    problematic_indices = findall(x -> x > 10, conditioning_node_counts)

    # Sort by conditioning node count
    sorted_problematic = sort(problematic_indices, by=i->conditioning_node_counts[i], rev=true)

    for (rank, idx) in enumerate(sorted_problematic[1:min(10, length(sorted_problematic))])
        num_cond = conditioning_node_counts[idx]
        num_inter = intermediate_node_counts[idx]
        num_edges = edge_counts[idx]
        join_node = join_node_ids[idx]
        states = state_space_sizes[idx]

        println("\n#$rank: Join Node $join_node")
        println("  Conditioning nodes: $num_cond → State space: $states")
        println("  Intermediate nodes: $num_inter")
        println("  Edges: $num_edges")

        # Show the actual diamond structure
        diamond = root_diamonds[join_node].diamond
        println("  Conditioning node IDs: ", sort(collect(diamond.conditioning_nodes)))
    end
end

# BDD Feasibility Analysis
println("\n" * "="^80)
println("🎯 BDD FEASIBILITY ANALYSIS")
println("="^80)

max_cond = maximum(conditioning_node_counts)
avg_cond = sum(conditioning_node_counts) / length(conditioning_node_counts)
median_cond = sort(conditioning_node_counts)[div(length(conditioning_node_counts), 2)]

println("\nKey Metrics:")
println("  Max conditioning nodes: $max_cond")
println("  Average conditioning nodes: $(round(avg_cond, digits=2))")
println("  Median conditioning nodes: $median_cond")

println("\nCurrent Algorithm Complexity:")
println("  Worst case: 2^$max_cond = $(2^max_cond) state evaluations per diamond")
println("  Total states (all root diamonds): $total_states")

println("\nExpected BDD Complexity:")
avg_intermediate = round(sum(intermediate_node_counts) / length(intermediate_node_counts), digits=2)
estimated_bdd_nodes = max_cond * avg_intermediate * 2  # Rough estimate
println("  Worst case (estimated): ~$estimated_bdd_nodes BDD nodes")
println("  Expected speedup: $(round(2^max_cond / estimated_bdd_nodes, digits=1))x")

# Recommendation
println("\n" * "="^80)
println("📋 RECOMMENDATION")
println("="^80)

if max_cond <= 10
    println("✅ BDD would help, but not critical (max $max_cond conditioning nodes)")
    println("   Estimated speedup: 2-10x")
elseif max_cond <= 15
    println("⚠️  BDD is HIGHLY RECOMMENDED (max $max_cond conditioning nodes)")
    println("   Estimated speedup: 10-100x")
    println("   Current worst case: $(2^max_cond) evaluations")
else
    println("🔥 BDD is ABSOLUTELY NECESSARY (max $max_cond conditioning nodes)")
    println("   Estimated speedup: 100-10000x")
    println("   Current worst case: $(2^max_cond) evaluations - LIKELY INFEASIBLE!")
end

println("\nImplementation Priority:")
if very_problematic_count > 0
    println("  🔴 URGENT - $very_problematic_count diamonds have >15 conditioning nodes")
elseif problematic_count > 0
    println("  🟡 HIGH - $problematic_count diamonds have >10 conditioning nodes")
else
    println("  🟢 LOW - All diamonds manageable with current approach")
end

println("\n" * "="^80)
println("Analysis complete! (Fast mode - root diamonds only)")
println("="^80)
