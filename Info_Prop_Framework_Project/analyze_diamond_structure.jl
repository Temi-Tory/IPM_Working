# Diamond Structure Analysis for BDD Optimization
# This script analyzes diamond structures to determine BDD feasibility

# Check if this is the first run of the script for this julia repl session
if !@isdefined(script_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    # Ensure we're running from the project root directory
    current_dir = pwd()
    # Include the IPAFramework module
    include("src/Network-flow-algos/src/IPAFramework.jl")
    using .IPAFramework

    # Mark as initialized
    global script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

network_name = "drone-network-full"
data_type = "float"

# Construct file paths
base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
json_network_name = network_name
filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")

# Verify files exist
if !isfile(filepath_graph)
    error("Graph file not found: $filepath_graph")
end
if !isfile(filepath_node_json)
    error("Node priors file not found: $filepath_node_json")
end
if !isfile(filepath_edge_json)
    error("Edge probabilities file not found: $filepath_edge_json")
end

println("="^80)
println("ANALYZING NETWORK: $network_name")
println("="^80)

# Read the graph
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)

allnodes = collect(keys(incoming_index))
sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)

node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

# Basic network statistics
println("\n📊 NETWORK STATISTICS")
println("-"^80)
println("Total nodes: ", length(allnodes))
println("Total edges: ", length(edgelist))
println("Source nodes: ", length(source_nodes))
println("Sink nodes: ", length(sink_nodes))

# Identify network structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

println("Fork nodes: ", length(fork_nodes))
println("Join nodes: ", length(join_nodes))
println("Iteration levels: ", length(iteration_sets))

println("\n🔍 FINDING ROOT DIAMONDS...")
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
println("Found $l_root_diamonds root diamonds")

println("\n🔨 BUILDING UNIQUE DIAMOND STORAGE...")
unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
    root_diamonds,
    node_priors,
    ancestors,
    descendants,
    iteration_sets
)
l_unique_diamonds = length(unique_diamonds)
println("Found $l_unique_diamonds unique diamonds (including sub-diamonds)")

# ============================================================================
# DETAILED DIAMOND ANALYSIS FOR BDD OPTIMIZATION
# ============================================================================

println("\n" * "="^80)
println("💎 DETAILED DIAMOND ANALYSIS FOR BDD OPTIMIZATION")
println("="^80)

# Collect statistics
conditioning_node_counts = Int[]
intermediate_node_counts = Int[]
edge_counts = Int[]
relevant_node_counts = Int[]
state_space_sizes = BigInt[]

for (hash_key, comp_data) in unique_diamonds
    diamond = comp_data.diamond

    num_conditioning = length(diamond.conditioning_nodes)
    num_edges = length(diamond.edgelist)
    num_relevant = length(diamond.relevant_nodes)

    # Calculate intermediate nodes
    sources_in_diamond = Set{Int64}()
    targets_in_diamond = Set{Int64}()
    for (src, dst) in diamond.edgelist
        push!(sources_in_diamond, src)
        push!(targets_in_diamond, dst)
    end
    sink_in_diamond = setdiff(targets_in_diamond, sources_in_diamond)
    num_intermediate = num_relevant - num_conditioning - length(sink_in_diamond)

    # State space size
    state_space = BigInt(2)^num_conditioning

    push!(conditioning_node_counts, num_conditioning)
    push!(intermediate_node_counts, num_intermediate)
    push!(edge_counts, num_edges)
    push!(relevant_node_counts, num_relevant)
    push!(state_space_sizes, state_space)
end

# Statistics
println("\n📈 CONDITIONING NODES DISTRIBUTION")
println("-"^80)
println("Min conditioning nodes: ", minimum(conditioning_node_counts))
println("Max conditioning nodes: ", maximum(conditioning_node_counts))
println("Mean conditioning nodes: ", round(sum(conditioning_node_counts) / length(conditioning_node_counts), digits=2))
println("Median conditioning nodes: ", sort(conditioning_node_counts)[div(length(conditioning_node_counts), 2)])

# Histogram of conditioning node counts
println("\nHistogram of conditioning node counts:")
hist_data = countmap(conditioning_node_counts)
for (count, freq) in sort(collect(hist_data))
    bar = "█"^min(freq, 50)
    println("  $count nodes: $bar ($freq diamonds)")
end

println("\n📊 INTERMEDIATE NODES DISTRIBUTION")
println("-"^80)
println("Min intermediate nodes: ", minimum(intermediate_node_counts))
println("Max intermediate nodes: ", maximum(intermediate_node_counts))
println("Mean intermediate nodes: ", round(sum(intermediate_node_counts) / length(intermediate_node_counts), digits=2))

println("\n🔢 STATE SPACE ANALYSIS")
println("-"^80)
println("Current algorithm must evaluate:")
total_states = sum(state_space_sizes)
println("  Total states across all diamonds: ", total_states)
println("  Largest single diamond state space: ", maximum(state_space_sizes))

# Find problematic diamonds (>10 conditioning nodes)
problematic_diamonds = filter(x -> x > 10, conditioning_node_counts)
if !isempty(problematic_diamonds)
    println("\n⚠️  PROBLEMATIC DIAMONDS (>10 conditioning nodes):")
    println("-"^80)
    println("  Count: ", length(problematic_diamonds))
    println("  Conditioning nodes: ", sort(problematic_diamonds, rev=true))

    # Calculate potential speedup with BDD
    println("\n💡 POTENTIAL BDD SPEEDUP:")
    for count in unique(sort(problematic_diamonds, rev=true))
        freq = sum(problematic_diamonds .== count)
        current_cost = 2^count
        # Estimated BDD cost: O(count * intermediate_nodes)
        # Assume average 5 intermediate nodes per level
        estimated_bdd_cost = count * 5
        speedup = current_cost / estimated_bdd_cost
        println("  $count conditioning nodes ($freq diamonds): $(2^count) states → ~$estimated_bdd_cost BDD nodes ($(round(speedup, digits=1))x speedup)")
    end
else
    println("\n✅ No problematic diamonds found (all ≤10 conditioning nodes)")
end

# Analyze structural similarity
println("\n🔬 STRUCTURAL SIMILARITY ANALYSIS")
println("-"^80)
structural_groups = Dict{Tuple{Set{Tuple{Int64, Int64}}, Set{Int64}}, Vector{Any}}()

for value in values(unique_diamonds)
    edge_set = Set(value.diamond.edgelist)
    key = (edge_set, value.diamond.conditioning_nodes)

    if !haskey(structural_groups, key)
        structural_groups[key] = []
    end
    push!(structural_groups[key], value)
end

println("Structurally unique diamonds: ", length(structural_groups))
println("Average duplicates per structure: ", round(l_unique_diamonds / length(structural_groups), digits=2))

# Show top 5 largest diamonds by conditioning nodes
println("\n🏆 TOP 5 LARGEST DIAMONDS (by conditioning nodes)")
println("-"^80)

diamond_info = []
for (hash_key, comp_data) in unique_diamonds
    diamond = comp_data.diamond
    num_cond = length(diamond.conditioning_nodes)
    num_edges = length(diamond.edgelist)

    # Calculate sink
    sources_in_diamond = Set{Int64}()
    targets_in_diamond = Set{Int64}()
    for (src, dst) in diamond.edgelist
        push!(sources_in_diamond, src)
        push!(targets_in_diamond, dst)
    end
    sink_in_diamond = setdiff(targets_in_diamond, sources_in_diamond)

    push!(diamond_info, (num_cond, num_edges, diamond.conditioning_nodes, sink_in_diamond, comp_data.is_rootDiamond))
end

sort!(diamond_info, by=x->x[1], rev=true)

for (i, (num_cond, num_edges, cond_nodes, sink_nodes, is_root)) in enumerate(diamond_info[1:min(5, length(diamond_info))])
    println("\n#$i: $(is_root ? "ROOT" : "SUB") Diamond")
    println("  Conditioning nodes: $num_cond → State space: $(2^num_cond) states")
    println("  Edges: $num_edges")
    println("  Conditioning node IDs: ", sort(collect(cond_nodes)))
    println("  Sink node(s): ", sink_nodes)
end

# BDD Recommendation
println("\n" * "="^80)
println("🎯 BDD IMPLEMENTATION RECOMMENDATION")
println("="^80)

max_cond = maximum(conditioning_node_counts)
avg_cond = sum(conditioning_node_counts) / length(conditioning_node_counts)

if max_cond <= 5
    println("✅ Network is SMALL - BDD overhead may not be worth it")
    println("   Current approach is likely fine")
elseif max_cond <= 10
    println("⚠️  Network is MEDIUM - BDD could provide 2-10x speedup")
    println("   Recommend implementing BDD for diamonds with >7 conditioning nodes")
elseif max_cond <= 15
    println("🔥 Network is LARGE - BDD will provide 10-100x speedup")
    println("   HIGHLY RECOMMEND implementing BDD for all diamonds")
else
    println("💥 Network is VERY LARGE - BDD is ESSENTIAL")
    println("   Current approach likely infeasible without BDD")
    println("   Expected speedup: 100-10000x")
end

println("\nEstimated implementation effort: 2-3 days")
println("Expected performance gain: $(round(2^max_cond / (max_cond * 5), digits=1))x for worst-case diamond")

println("\n" * "="^80)
println("Analysis complete!")
println("="^80)
