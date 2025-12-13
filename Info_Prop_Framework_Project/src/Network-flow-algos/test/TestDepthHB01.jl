"""
Test Depth Computation on HB0_local_1

Quick test to verify depth metadata is computed correctly.
Expected: With 14 roots and 132 unique diamonds, we should see actual nesting depth > 1
"""

if !@isdefined(script_initialized_depth_test)
    println("First run - initializing...")

    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    global script_initialized_depth_test = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

network_name = "drone-network-balanced-k3"
data_type = "float"


println("DEPTH COMPUTATION TEST: $network_name")
println("="^80 * "\n")

base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

# Load
println("📊 Loading network...")
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
println("   ✓ Loaded $(length(node_priors)) nodes, $(length(edgelist)) edges")

# Build structure
println("\n🔧 Building structure...")
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
println("   ✓ Built: $(length(fork_nodes)) forks, $(length(join_nodes)) joins")

# Identify diamonds
println("\n💎 Identifying diamonds...")
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
println("   ✓ Found $(length(root_diamonds)) root diamonds")

# Build unique storage with depth computation
println("\n🔨 Building unique diamond storage...")
unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
    root_diamonds,
    node_priors,
    ancestors,
    descendants,
    iteration_sets
)

println("   ✓ Built $(length(unique_diamonds)) unique diamonds")

# Analyze depths

println("DEPTH ANALYSIS")


depth_histogram = Dict{Int64, Int64}()
for (hash, comp_data) in unique_diamonds
    depth = comp_data.depth_level
    depth_histogram[depth] = get(depth_histogram, depth, 0) + 1
end

max_depth = maximum(keys(depth_histogram))
println("\nMax nesting depth: $max_depth")
println("\nDepth distribution:")
for depth in 0:max_depth
    count = get(depth_histogram, depth, 0)
    println("   Depth $depth: $count diamonds")
end

# Find examples at each depth

println("EXAMPLE DIAMONDS BY DEPTH")


for depth in 0:max_depth
    println("\nDepth $depth examples:")
    count = 0
    for (hash, comp_data) in unique_diamonds
        if comp_data.depth_level == depth && count < 3
            println("   Hash: $hash")
            println("     • Conditioning nodes: $(length(comp_data.diamond.conditioning_nodes))")
            println("     • Children: $(length(comp_data.child_diamond_hashes))")
            println("     • Is root: $(comp_data.is_rootDiamond)")
            count += 1
        end
        if count >= 3
            break
        end
    end
end


println("✅ DEPTH TEST COMPLETE")

