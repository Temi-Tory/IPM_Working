"""
Verify Root Diamonds vs Unique Diamonds
========================================
Check the difference between:
1. root_diamonds from identify_and_group_diamonds (STEP 3)
2. unique_diamonds from build_unique_diamond_storage_depth_first_parallel (STEP 4)

Prove that the 3 "root" diamonds with empty conditioning are actually sub-diamonds.
"""

# First run from test directory
using DataFrames, DelimitedFiles, Distributions,
    DataStructures, SparseArrays, BenchmarkTools,
    Combinatorics, Dates

include("../src/IPAFramework.jl")
using .IPAFramework

network_name = "drone-network-balanced-k3"
data_type = "float"

println("="^80)
println("VERIFYING ROOT DIAMONDS VS UNIQUE DIAMONDS")
println("="^80)

# Load network
base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

println("\n📊 STEP 1-3: Loading and identifying root diamonds...")
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

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

println("✓ Root diamonds from STEP 3: $(length(root_diamonds))")

# Check for empty conditioning in root_diamonds
println("\n🔍 Checking root_diamonds for empty conditioning nodes...")
global empty_cond_in_roots = 0
for (join_node, diamonds_at_node) in root_diamonds
    if isempty(diamonds_at_node.diamond.conditioning_nodes)
        global empty_cond_in_roots += 1
        println("\n❌ Found empty conditioning at join node $join_node")
        println("   Relevant nodes: $(sort(collect(diamonds_at_node.diamond.relevant_nodes)))")
        println("   Non-diamond parents: $(sort(collect(diamonds_at_node.non_diamond_parents)))")

        # Compute what sources should be
        targets = Set{Int64}()
        for (_, tgt) in diamonds_at_node.diamond.edgelist
            push!(targets, tgt)
        end
        computed_sources = setdiff(diamonds_at_node.diamond.relevant_nodes, targets)
        println("   Computed sources from edgelist: $(sort(collect(computed_sources)))")
    end
end

if empty_cond_in_roots == 0
    println("✅ All root diamonds have valid (non-empty) conditioning nodes!")
else
    println("\n❌ Found $empty_cond_in_roots root diamonds with EMPTY conditioning")
end

println("\n" * "="^80)
println("📊 STEP 4: Building unique diamond storage...")

unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
    root_diamonds,
    node_priors,
    ancestors,
    descendants,
    iteration_sets
);

println("✓ Unique diamonds from STEP 4: $(length(unique_diamonds))")

# Check unique_diamonds for empty conditioning
println("\n🔍 Checking unique_diamonds for empty conditioning nodes...")
global empty_cond_in_unique = 0
global empty_root_marked_in_unique = 0
global empty_sub_diamonds = 0

for (hash, comp_data) in unique_diamonds
    if isempty(comp_data.diamond.conditioning_nodes)
        global empty_cond_in_unique += 1

        if comp_data.is_rootDiamond
            global empty_root_marked_in_unique += 1
            println("\n❌ ROOT Diamond Hash: $hash")
            println("   Marked as is_rootDiamond: $(comp_data.is_rootDiamond)")
            println("   Relevant nodes ($(length(comp_data.diamond.relevant_nodes))): $(sort(collect(comp_data.diamond.relevant_nodes)))")
            println("   Conditioning nodes: EMPTY")

            # Check if this hash exists in root_diamonds
            found_in_roots = false
            for (join_node, dan) in root_diamonds
                # Compute hash of root diamond
                root_hash = create_diamond_hash_key(dan.diamond)
                if root_hash == hash
                    found_in_roots = true
                    println("   ✓ This diamond EXISTS in root_diamonds at join node $join_node")
                    println("     Root diamond conditioning: $(sort(collect(dan.diamond.conditioning_nodes)))")
                    break
                end
            end

            if !found_in_roots
                println("   ⚠️  This diamond NOT FOUND in root_diamonds")
                println("      This is a SUB-DIAMOND incorrectly marked as is_rootDiamond=true")
            end
        else
            # This is a sub-diamond (NOT marked as root) with empty conditioning
            global empty_sub_diamonds += 1
            println("\n❌ SUB-Diamond Hash: $hash")
            println("   Marked as is_rootDiamond: false")
            println("   Relevant nodes ($(length(comp_data.diamond.relevant_nodes))): $(sort(collect(comp_data.diamond.relevant_nodes)))")
            println("   Conditioning nodes: EMPTY")
            println("   Sub-Join Nodes (in DiamondComputationData): $(sort(collect(comp_data.sub_join_nodes)))")
        end
    end
end

println("\n" * "="^80)
println("SUMMARY")
println("="^80)
println("Root diamonds (STEP 3) with empty conditioning: $empty_cond_in_roots")
println("Unique diamonds (STEP 4) with empty conditioning: $empty_cond_in_unique")
println("  - Of which marked as is_rootDiamond: $empty_root_marked_in_unique")
println("  - Of which are sub-diamonds (is_rootDiamond=false): $empty_sub_diamonds")
println("\nConclusion:")
if empty_cond_in_roots > 0
    println("❌ BUG #4 FIX FAILED: Root diamonds from STEP 3 have empty conditioning!")
    println("   Join nodes with empty conditioning: 104, 223, 198")
    println("   The state reversion logic in perform_recursive_diamond_completeness is not working")
    println("   These 3 root diamonds propagate to STEP 4 as is_rootDiamond=true")
end
if empty_sub_diamonds > 0
    println("❌ BUG #5 FIX FAILED: Sub-diamond processing creates empty conditioning!")
    println("   $empty_sub_diamonds sub-diamonds have empty conditioning")
    println("   The subsource validation in perform_subsource_analysis may have edge cases")
end

println("\n" * "="^80)
