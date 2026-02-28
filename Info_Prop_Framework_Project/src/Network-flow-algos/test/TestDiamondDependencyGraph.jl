"""
Test Diamond Dependency Graph

Builds unique diamond storage and analyzes dependency metadata WITHOUT running BP.
Tests the new dependency tracking fields in DiamondComputationData.
"""

# Check if this is the first run of the script for this julia repl session
if !@isdefined(script_initialized_dep_test)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates, Statistics

    # Include ONLY the optimized module
    println("Loading optimized IPAFrameworkOptimized...")
    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    # Mark as initialized
    global script_initialized_dep_test = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end


# ============================================================================
# Network Selection
# ============================================================================

#= Available networks:
dag_ntwrk_files\drone-network-balanced-k3
dag_ntwrk_files\drone-network-cost-optimal
dag_ntwrk_files\drone-network-geographic-knn
dag_ntwrk_files\drone-network-resilience-optimal-k5
dag_ntwrk_files\drone-network-time-optimal-k2 =#

network_name = "pareto-point-1-high-resilience-fw"

# ============================================================================
# Dependency Analysis Functions
# ============================================================================

"""
Analyze dependency metadata from unique diamonds storage
"""
function analyze_diamond_dependencies(unique_diamonds::Dict{UInt64, <:Any})
    println("\n" * "="^80)
    println("DIAMOND DEPENDENCY GRAPH ANALYSIS")
    println("="^80 * "\n")

    # Basic statistics
    total_diamonds = length(unique_diamonds)
    println("📊 Total unique diamonds: $total_diamonds")

    # Depth distribution
    depths = [d.depth_level for d in values(unique_diamonds)]
    max_depth = maximum(depths)
    min_depth = minimum(depths)
    mean_depth = mean(depths)
    median_depth = median(depths)

    println("\n🌳 Depth Statistics:")
    println("   Min depth: $min_depth (leaf diamonds)")
    println("   Max depth: $max_depth (deepest nesting)")
    println("   Mean depth: $(round(mean_depth, digits=2))")
    println("   Median depth: $median_depth")

    # Depth distribution histogram
    depth_counts = Dict{Int64, Int64}()
    for d in depths
        depth_counts[d] = get(depth_counts, d, 0) + 1
    end

    println("\n📊 Depth Distribution:")
    for depth in sort(collect(keys(depth_counts)))
        count = depth_counts[depth]
        percentage = round(100 * count / total_diamonds, digits=1)
        bar = "█" ^ max(1, div(count * 50, total_diamonds))
        println("   Depth $depth: $count diamonds ($percentage%) $bar")
    end

    # Conditioning nodes distribution (determines 2^n cost)
    conditioning_counts = [d.num_conditioning_nodes for d in values(unique_diamonds)]
    max_conditioning = maximum(conditioning_counts)
    mean_conditioning = mean(conditioning_counts)

    println("\n🔢 Conditioning Nodes Distribution:")
    println("   Max conditioning nodes: $max_conditioning (2^$max_conditioning = $(2^max_conditioning) states)")
    println("   Mean conditioning nodes: $(round(mean_conditioning, digits=2))")

    conditioning_histogram = Dict{Int64, Int64}()
    for n in conditioning_counts
        conditioning_histogram[n] = get(conditioning_histogram, n, 0) + 1
    end

    for n in sort(collect(keys(conditioning_histogram)))
        count = conditioning_histogram[n]
        cost = 2^n
        percentage = round(100 * count / total_diamonds, digits=1)
        println("   $n nodes (2^$n = $cost states): $count diamonds ($percentage%)")
    end

    # Children distribution
    child_counts = [length(d.child_diamond_hashes) for d in values(unique_diamonds)]
    leaf_count = count(c -> c == 0, child_counts)
    max_children = maximum(child_counts)
    mean_children = mean(child_counts)

    println("\n🌿 Children Distribution:")
    println("   Leaf diamonds (0 children): $leaf_count ($(round(100*leaf_count/total_diamonds, digits=1))%)")
    println("   Max children: $max_children")
    println("   Mean children: $(round(mean_children, digits=2))")

    # Build parent-child relationships for topology analysis
    child_to_parents = Dict{UInt64, Set{UInt64}}()
    for (parent_hash, comp_data) in unique_diamonds
        for child_hash in comp_data.child_diamond_hashes
            if !haskey(child_to_parents, child_hash)
                child_to_parents[child_hash] = Set{UInt64}()
            end
            push!(child_to_parents[child_hash], parent_hash)
        end
    end

    # Find root diamonds (no parents in dependency graph)
    # A diamond is a "root" if no other diamond contains it as a sub-diamond
    root_diamonds = Set{UInt64}()
    for (hash, comp_data) in unique_diamonds
        if !haskey(child_to_parents, hash) || isempty(child_to_parents[hash])
            push!(root_diamonds, hash)
        end
    end

    # Also count how many are marked as is_rootDiamond (network-level roots)
    network_level_roots = count(d -> d.is_rootDiamond, values(unique_diamonds))

    println("\n🌲 Topology Statistics:")
    println("   Dependency graph roots: $(length(root_diamonds)) (diamonds not nested in others)")
    println("   Network-level roots: $network_level_roots (diamonds from identify_and_group_diamonds)")
    println("   Leaf diamonds: $leaf_count (diamonds with no children)")
    println("   Internal diamonds: $(total_diamonds - length(root_diamonds) - leaf_count)")

    # Complexity analysis (depth * conditioning nodes)
    complexities = Float64[]
    for comp_data in values(unique_diamonds)
        # Simple heuristic: depth * 2^conditioning_nodes
        complexity = Float64(comp_data.depth_level) * Float64(2^comp_data.num_conditioning_nodes)
        push!(complexities, complexity)
    end

    println("\n⚡ Complexity Analysis (depth × 2^conditioning):")
    println("   Min complexity: $(round(minimum(complexities), digits=2))")
    println("   Mean complexity: $(round(mean(complexities), digits=2))")
    println("   Median complexity: $(round(median(complexities), digits=2))")
    println("   Max complexity: $(round(maximum(complexities), digits=2))")
    println("   90th percentile: $(round(quantile(complexities, 0.9), digits=2))")

    # Find critical path diamonds (top 10% most complex)
    complexity_threshold = quantile(complexities, 0.9)
    critical_diamonds = 0
    for comp_data in values(unique_diamonds)
        complexity = Float64(comp_data.depth_level) * Float64(2^comp_data.num_conditioning_nodes)
        if complexity >= complexity_threshold
            critical_diamonds += 1
        end
    end

    println("   Critical path diamonds (top 10%): $critical_diamonds")

    # Parallelization potential (diamonds at same depth can run in parallel)
    println("\n🔀 Parallelization Potential:")
    for depth in sort(collect(keys(depth_counts)))
        count = depth_counts[depth]
        if count > 1
            println("   Depth $depth: $count diamonds (can be parallelized)")
        end
    end

    # Build processing order (bottom-up: leaves to roots)
    processing_order = Vector{UInt64}()
    for depth in 0:max_depth
        level_diamonds = [hash for (hash, d) in unique_diamonds if d.depth_level == depth]
        append!(processing_order, level_diamonds)
    end

    println("\n📋 Bottom-Up Processing Order:")
    println("   Total processing steps: $(length(processing_order))")
    println("   Order: depth 0 (leaves) → depth $max_depth (roots)")

    # Sample dependency chain (trace from root to leaf)
    if !isempty(root_diamonds)
        sample_root = first(root_diamonds)
        println("\n🔍 Sample Dependency Chain (root to leaves):")
        trace_dependency_chain(sample_root, unique_diamonds, 0)
    end

    println("\n" * "="^80 * "\n")

    return (
        total_diamonds = total_diamonds,
        max_depth = max_depth,
        root_count = length(root_diamonds),
        leaf_count = leaf_count,
        processing_order = processing_order,
        critical_diamonds = critical_diamonds
    )
end

"""
Recursively trace a dependency chain from a diamond to its children
"""
function trace_dependency_chain(diamond_hash::UInt64, unique_diamonds::Dict{UInt64, <:Any}, indent::Int)
    if !haskey(unique_diamonds, diamond_hash)
        return
    end

    comp_data = unique_diamonds[diamond_hash]
    prefix = "  " ^ indent

    # Print this diamond
    println("$(prefix)├─ Diamond (depth=$(comp_data.depth_level), " *
            "conditioning=$(comp_data.num_conditioning_nodes), " *
            "children=$(length(comp_data.child_diamond_hashes)))")

    # Recursively trace children (only show first 3 to avoid spam)
    child_list = collect(comp_data.child_diamond_hashes)
    for (i, child_hash) in enumerate(child_list)
        if i <= 3  # Limit to 3 children to keep output manageable
            trace_dependency_chain(child_hash, unique_diamonds, indent + 1)
        elseif i == 4
            println("$(prefix)  └─ ... ($(length(child_list) - 3) more children)")
            break
        end
    end
end

# ============================================================================
# Main Test Function
# ============================================================================

function test_diamond_dependency_graph(network_name, data_type="float")
    println("\n" * "="^80)
    println("TESTING DIAMOND DEPENDENCY GRAPH")
    println("Network: $network_name")
    println("="^80 * "\n")

    # Construct file paths
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

    # ========================================================================
    # STEP 1: Load Network Data
    # ========================================================================
    println("📊 Loading network data...")
    t_load = @elapsed begin
        edgelist, outgoing_index, incoming_index, source_nodes = IPAFrameworkOptimized.read_graph_to_dict(filepath_graph)
        node_priors = IPAFrameworkOptimized.read_node_priors_from_json(filepath_node_json)
        edge_probabilities = IPAFrameworkOptimized.read_edge_probabilities_from_json(filepath_edge_json)
    end

    println("   ✓ Loaded in $(round(t_load, digits=3))s")
    println("   • Nodes: $(length(node_priors))")
    println("   • Edges: $(length(edgelist))")
    println("   • Sources: $(length(source_nodes))")

    # ========================================================================
    # STEP 2: Build Network Structure
    # ========================================================================
    println("\n🔧 Building network structure...")
    t_structure = @elapsed begin
        fork_nodes, join_nodes = IPAFrameworkOptimized.identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = IPAFrameworkOptimized.find_iteration_sets(edgelist, outgoing_index, incoming_index)
    end

    println("   ✓ Built in $(round(t_structure, digits=3))s")
    println("   • Fork nodes: $(length(fork_nodes))")
    println("   • Join nodes: $(length(join_nodes))")
    println("   • Iteration sets: $(length(iteration_sets))")

    # ========================================================================
    # STEP 3: Identify Diamond Structures
    # ========================================================================
    println("\n💎 Identifying diamonds...")
    t_diamonds = @elapsed begin
        root_diamonds = IPAFrameworkOptimized.identify_and_group_diamonds(
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
    end

    println("   ✓ Identified in $(round(t_diamonds, digits=3))s")
    println("   • Root diamonds: $(length(root_diamonds))")

    # ========================================================================
    # STEP 4: Build Unique Diamond Storage (WITH DEPENDENCY METADATA)
    # ========================================================================
    println("\n🔨 Building unique diamond storage with dependency tracking...")
    t_storage = @elapsed begin
        unique_diamonds = IPAFrameworkOptimized.build_unique_diamond_storage_depth_first_parallel(
            root_diamonds,
            node_priors,
            ancestors,
            descendants,
            iteration_sets
        );
    end

    println("   ✓ Built in $(round(t_storage, digits=3))s")
    println("   • Unique diamonds: $(length(unique_diamonds))")

    # ========================================================================
    # STEP 5: Analyze Dependency Graph (NEW!)
    # ========================================================================
    dep_stats = analyze_diamond_dependencies(unique_diamonds)

    # ========================================================================
    # Summary
    # ========================================================================
    println("\n" * "="^80)
    println("SUMMARY")
    println("="^80)
    println("Total time: $(round(t_load + t_structure + t_diamonds + t_storage, digits=3))s")
    println("  • Load: $(round(t_load, digits=3))s")
    println("  • Structure: $(round(t_structure, digits=3))s")
    println("  • Diamonds: $(round(t_diamonds, digits=3))s")
    println("  • Storage: $(round(t_storage, digits=3))s")
    println("\nDependency Graph:")
    println("  • Total diamonds: $(dep_stats.total_diamonds)")
    println("  • Max depth: $(dep_stats.max_depth)")
    println("  • Root diamonds: $(dep_stats.root_count)")
    println("  • Leaf diamonds: $(dep_stats.leaf_count)")
    println("  • Critical path diamonds: $(dep_stats.critical_diamonds)")
    println("="^80 * "\n")

    return unique_diamonds, dep_stats
end

# ============================================================================
# Run the test!
# ============================================================================

unique_diamonds, dep_stats = test_diamond_dependency_graph(network_name);
