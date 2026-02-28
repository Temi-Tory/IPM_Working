"""
Debug Test - Identify Diamonds and Build Unique Storage (Steps 1-4)
Tests diamond identification and unique diamond building with dependency analysis
"""

# Check if this is the first run of the script for this julia repl session
if !@isdefined(script_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Mark as initialized
    global script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end


# ============================================================================
# Network Selection
# ============================================================================

network_name ="pareto-point-1-high-resilience-fw"
# network_name ="pareto-point-2-high-resilience-vtol"
# network_name ="pareto-point-3-medium-resilience-sparse"
# network_name ="pareto-point-4-low-resilience-minimal"
# network_name ="pareto-point-5-medium-resilience-fw"
# network_name ="pareto-point-6-balanced"
data_type = "float"

# ============================================================================
# Main Test Function - STEPS 1-4
# ============================================================================

function run_debug_full_diamond_processing(network_name, data_type="float")
    println("\n" * "="^80)
    println("DEBUG TEST: Full Diamond Processing with Dependency Analysis")
    println("Testing Network: $network_name")
    println("Data Type: $data_type")
    println("="^80 * "\n")

    # Construct file paths
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

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

    # ========================================================================
    # STEP 1: Load Network Data
    # ========================================================================
    println("📊 STEP 1: Loading network data...")
    t_load = @elapsed begin
        edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        node_priors = read_node_priors_from_json(filepath_node_json)
        edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
    end

    # Find sink nodes
    allnodes = collect(keys(incoming_index))
    sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes)

    println("   ✓ Loaded in $(round(t_load, digits=3))s")
    println("   Nodes: $(length(node_priors))")
    println("   Edges: $(length(edgelist))")
    println("   Sources: $(length(source_nodes))")
    println("   Sinks: $(length(sink_nodes))")

    # ========================================================================
    # STEP 2: Build Network Structure
    # ========================================================================
    println("\n🔧 STEP 2: Building network structure...")
    t_structure = @elapsed begin
        fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
    end

    println("   ✓ Built in $(round(t_structure, digits=3))s")
    println("   Forks: $(length(fork_nodes))")
    println("   Joins: $(length(join_nodes))")
    println("   Iteration layers: $(length(iteration_sets))")

    # ========================================================================
    # STEP 3: Identify Diamond Structures
    # ========================================================================
    println("\n💎 STEP 3: Identifying diamonds...")
    t_diamonds = @elapsed begin
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
    end

    println("   ✓ Identified in $(round(t_diamonds, digits=3))s")
    println("   Root diamonds: $(length(root_diamonds))")

    # Check root_diamonds for empty conditioning nodes
    println("\n🔍 Checking root_diamonds (Step 3 output) for empty conditioning...")
    empty_root_count = 0
    for (join_node, diamond_at_node) in root_diamonds
        if isempty(diamond_at_node.diamond.conditioning_nodes)
            empty_root_count += 1
            println("  ❌ EMPTY CONDITIONING in root_diamonds!")
            println("     Join Node: ", join_node)
            println("     Relevant Nodes: ", sort(collect(diamond_at_node.diamond.relevant_nodes)))
        end
    end
    if empty_root_count == 0
        println("   ✅ All root_diamonds have non-empty conditioning nodes")
    else
        println("   ❌ Found $empty_root_count root_diamonds with empty conditioning!")
    end

    # ========================================================================
    # STEP 4: Build Unique Diamond Storage
    # ========================================================================
    println("\n🔨 STEP 4: Building unique diamond storage...")

    t_storage = @elapsed begin
        unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds,
            node_priors,
            ancestors,
            descendants,
            iteration_sets
        )
    end

    println("   ✓ Built in $(round(t_storage, digits=3))s")
    println("   Unique diamonds: $(length(unique_diamonds))")

    # ========================================================================
    # Results Summary
    # ========================================================================
    println("\n" * "="^80)
    println("RESULTS SUMMARY")
    println("="^80)
    println("\n⏱️  TIMING BREAKDOWN:")
    println("   Load network:       $(round(t_load, digits=3))s")
    println("   Build structure:    $(round(t_structure, digits=3))s")
    println("   Identify diamonds:  $(round(t_diamonds, digits=3))s")
    println("   Build storage:      $(round(t_storage, digits=3))s")
    println("   " * "-"^50)
    total_time = t_load + t_structure + t_diamonds + t_storage
    println("   TOTAL TIME:         $(round(total_time, digits=3))s")

    println("\n📋 Root Diamonds Summary:")
    for join_node in sort(collect(keys(root_diamonds)))
        diamond_at_node = root_diamonds[join_node]
        println("  Join Node $join_node:")
        println("    Conditioning Nodes: ", sort(collect(diamond_at_node.diamond.conditioning_nodes)))
        println("    Relevant Nodes: ", sort(collect(diamond_at_node.diamond.relevant_nodes)))
        println("    Edges: ", length(diamond_at_node.diamond.edgelist))
        println("    Non-Diamond Parents: ", sort(collect(diamond_at_node.non_diamond_parents)))
    end

    # ========================================================================
    # STEP 5: Dependency Analysis
    # ========================================================================
    println("\n" * "="^80)
    println("DEPENDENCY ANALYSIS")
    println("="^80)

    # Build dependency graph from unique diamonds
    println("\n🔍 Building dependency graph...")

    dep_graph = Dict{UInt64, Set{UInt64}}()  # hash -> set of sub-diamond hashes
    hash_to_diamond = Dict{UInt64, Any}()  # hash -> diamond computation data

    for (diamond_hash, diamond_comp_data) in unique_diamonds
        hash_to_diamond[diamond_hash] = diamond_comp_data

        # Get sub-diamond hashes
        sub_hashes = Set{UInt64}()
        for (sub_join_node, sub_diamond_at_node) in diamond_comp_data.sub_diamond_structures
            # Create hash for each sub-diamond
            sub_hash = create_diamond_hash_key(sub_diamond_at_node.diamond)
            push!(sub_hashes, sub_hash)
        end
        dep_graph[diamond_hash] = sub_hashes
    end

    println("   Dependency graph nodes: ", length(dep_graph))
    println("   Total edges: ", sum(length(v) for v in values(dep_graph)))

    # Check for self-referencing diamonds
    println("\n🔍 Checking for self-referencing diamonds...")
    self_ref_count = 0
    for (hash, sub_hashes) in dep_graph
        if hash in sub_hashes
            self_ref_count += 1
            diamond_comp_data = hash_to_diamond[hash]
            println("  ❌ SELF-REFERENCE FOUND!")
            println("     Diamond Hash: ", hash)
            println("     Is Root: ", diamond_comp_data.is_rootDiamond)
            println("     Conditioning Nodes: ", sort(collect(diamond_comp_data.diamond.conditioning_nodes)))
            println("     Relevant Nodes: ", sort(collect(diamond_comp_data.diamond.relevant_nodes)))
        end
    end

    if self_ref_count == 0
        println("   ✅ No self-referencing diamonds found")
    else
        println("   ❌ Found $self_ref_count self-referencing diamonds!")
    end

    # Check for circular dependencies (cycles)
    println("\n🔍 Checking for circular dependencies...")

    function has_cycle_dfs(node, graph, visited, rec_stack)
        visited[node] = true
        rec_stack[node] = true

        if haskey(graph, node)
            for neighbor in graph[node]
                if !get(visited, neighbor, false)
                    if has_cycle_dfs(neighbor, graph, visited, rec_stack)
                        return true
                    end
                elseif get(rec_stack, neighbor, false)
                    return true
                end
            end
        end

        rec_stack[node] = false
        return false
    end

    visited = Dict{UInt64, Bool}()
    cycles_found = false

    for node in keys(dep_graph)
        if !get(visited, node, false)
            rec_stack = Dict{UInt64, Bool}()
            if has_cycle_dfs(node, dep_graph, visited, rec_stack)
                cycles_found = true
                break
            end
        end
    end

    if cycles_found
        println("   ❌ CIRCULAR DEPENDENCIES DETECTED!")
    else
        println("   ✅ No circular dependencies found (DAG structure maintained)")
    end

    # Check for empty conditioning nodes in unique diamonds
    println("\n🔍 Checking unique diamonds for empty conditioning nodes...")
    empty_cond_count = 0
    for (diamond_hash, diamond_comp_data) in unique_diamonds
        if isempty(diamond_comp_data.diamond.conditioning_nodes)
            empty_cond_count += 1
            println("  ❌ EMPTY CONDITIONING!")
            println("     Diamond Hash: ", diamond_hash)
            println("     Is Root: ", diamond_comp_data.is_rootDiamond)
            println("     Relevant Nodes: ", sort(collect(diamond_comp_data.diamond.relevant_nodes)))
        end
    end

    if empty_cond_count == 0
        println("   ✅ All unique diamonds have non-empty conditioning nodes")
    else
        println("   ❌ Found $empty_cond_count unique diamonds with empty conditioning!")
    end

    println("\n" * "="^80)

    return root_diamonds, unique_diamonds
end

# ============================================================================
# NEW: Analyze Diamond Structure for Parallelization Strategy
# ============================================================================

"""
Analyze diamond structure to understand:
1. Nesting depth distribution
2. Conditioning nodes per diamond
3. Non-conditioning sources per diamond (causes cache misses)
4. Total state space per diamond
5. Potential benefit of expanding conditioning set
"""
function analyze_diamond_structure_for_parallelization(
    root_diamonds,
    unique_diamonds,
    log_file::String
)
    open(log_file, "w") do io
        println(io, "="^80)
        println(io, "DIAMOND STRUCTURE ANALYSIS FOR PARALLELIZATION")
        println(io, "="^80)
        println(io, "Generated: $(Dates.now())")
        println(io, "")

        # Collect metrics
        cond_counts = Int[]
        non_cond_source_counts = Int[]
        total_source_counts = Int[]
        relevant_node_counts = Int[]
        edge_counts = Int[]
        nested_diamond_counts = Int[]

        # Analyze each unique diamond
        println(io, "\n" * "-"^80)
        println(io, "PER-DIAMOND ANALYSIS")
        println(io, "-"^80)

        for (diamond_hash, diamond_comp_data) in unique_diamonds
            diamond = diamond_comp_data.diamond
            cond_nodes = diamond.conditioning_nodes
            relevant_nodes = diamond.relevant_nodes
            fresh_sources = diamond_comp_data.sub_sources

            # Non-conditioning sources = fresh_sources that are NOT in conditioning_nodes
            non_cond_sources = setdiff(fresh_sources, cond_nodes)

            # Count nested diamonds
            nested_count = length(diamond_comp_data.sub_diamond_structures)

            # State space sizes
            cond_states = 2^length(cond_nodes)
            expanded_states = 2^(length(cond_nodes) + length(non_cond_sources))

            push!(cond_counts, length(cond_nodes))
            push!(non_cond_source_counts, length(non_cond_sources))
            push!(total_source_counts, length(fresh_sources))
            push!(relevant_node_counts, length(relevant_nodes))
            push!(edge_counts, length(diamond.edgelist))
            push!(nested_diamond_counts, nested_count)

            # Log details for diamonds with non-conditioning sources
            if length(non_cond_sources) > 0
                println(io, "\nDiamond $(diamond_hash):")
                println(io, "  Is Root: $(diamond_comp_data.is_rootDiamond)")
                println(io, "  Conditioning nodes: $(length(cond_nodes)) -> $(sort(collect(cond_nodes)))")
                println(io, "  Non-cond sources:   $(length(non_cond_sources)) -> $(sort(collect(non_cond_sources)))")
                println(io, "  Total fresh sources: $(length(fresh_sources))")
                println(io, "  Relevant nodes: $(length(relevant_nodes))")
                println(io, "  Edges: $(length(diamond.edgelist))")
                println(io, "  Nested diamonds: $nested_count")
                println(io, "  Current state space: $cond_states")
                println(io, "  Expanded state space: $expanded_states ($(expanded_states/cond_states)x increase)")
            end
        end

        # Summary statistics
        println(io, "\n" * "="^80)
        println(io, "SUMMARY STATISTICS")
        println(io, "="^80)

        println(io, "\nTotal unique diamonds: $(length(unique_diamonds))")
        println(io, "Total root diamonds: $(length(root_diamonds))")

        println(io, "\nConditioning nodes per diamond:")
        println(io, "  Min: $(minimum(cond_counts))")
        println(io, "  Max: $(maximum(cond_counts))")
        println(io, "  Mean: $(round(sum(cond_counts)/length(cond_counts), digits=2))")
        println(io, "  Distribution: $(sort(collect(countmap(cond_counts))))")

        println(io, "\nNon-conditioning sources per diamond (CACHE BUSTERS):")
        println(io, "  Min: $(minimum(non_cond_source_counts))")
        println(io, "  Max: $(maximum(non_cond_source_counts))")
        println(io, "  Mean: $(round(sum(non_cond_source_counts)/length(non_cond_source_counts), digits=2))")
        println(io, "  Distribution: $(sort(collect(countmap(non_cond_source_counts))))")
        println(io, "  Diamonds with 0 non-cond sources (fully cacheable): $(count(x -> x == 0, non_cond_source_counts))")
        println(io, "  Diamonds with >0 non-cond sources (cache miss prone): $(count(x -> x > 0, non_cond_source_counts))")

        println(io, "\nNested diamonds per diamond:")
        println(io, "  Min: $(minimum(nested_diamond_counts))")
        println(io, "  Max: $(maximum(nested_diamond_counts))")
        println(io, "  Mean: $(round(sum(nested_diamond_counts)/length(nested_diamond_counts), digits=2))")
        println(io, "  Diamonds with nested diamonds: $(count(x -> x > 0, nested_diamond_counts))")

        # Calculate nesting depth via BFS
        println(io, "\n" * "-"^80)
        println(io, "NESTING DEPTH ANALYSIS")
        println(io, "-"^80)

        # Build reverse lookup: hash -> which diamonds contain it
        contained_in = Dict{UInt64, Set{UInt64}}()
        for (diamond_hash, diamond_comp_data) in unique_diamonds
            for (_, sub_diamond_at_node) in diamond_comp_data.sub_diamond_structures
                sub_hash = create_diamond_hash_key(sub_diamond_at_node.diamond)
                if !haskey(contained_in, sub_hash)
                    contained_in[sub_hash] = Set{UInt64}()
                end
                push!(contained_in[sub_hash], diamond_hash)
            end
        end

        # Find leaf diamonds (no nested diamonds)
        leaf_hashes = Set{UInt64}()
        for (diamond_hash, diamond_comp_data) in unique_diamonds
            if isempty(diamond_comp_data.sub_diamond_structures)
                push!(leaf_hashes, diamond_hash)
            end
        end

        # Calculate depth for each diamond (depth = longest path to a leaf)
        depths = Dict{UInt64, Int}()

        function calculate_depth(hash)
            if haskey(depths, hash)
                return depths[hash]
            end
            if !haskey(unique_diamonds, hash)
                return 0
            end
            diamond_comp_data = unique_diamonds[hash]
            if isempty(diamond_comp_data.sub_diamond_structures)
                depths[hash] = 0
                return 0
            end
            max_sub_depth = 0
            for (_, sub_diamond_at_node) in diamond_comp_data.sub_diamond_structures
                sub_hash = create_diamond_hash_key(sub_diamond_at_node.diamond)
                sub_depth = calculate_depth(sub_hash)
                max_sub_depth = max(max_sub_depth, sub_depth)
            end
            depths[hash] = max_sub_depth + 1
            return depths[hash]
        end

        for hash in keys(unique_diamonds)
            calculate_depth(hash)
        end

        depth_values = collect(values(depths))
        if !isempty(depth_values)
            println(io, "  Max nesting depth: $(maximum(depth_values))")
            println(io, "  Depth distribution: $(sort(collect(countmap(depth_values))))")
        end

        # Parallelization strategy recommendations
        println(io, "\n" * "="^80)
        println(io, "PARALLELIZATION STRATEGY RECOMMENDATIONS")
        println(io, "="^80)

        # Calculate total state space
        total_current_states = sum(2^c for c in cond_counts)
        total_expanded_states = sum(2^(c + nc) for (c, nc) in zip(cond_counts, non_cond_source_counts))

        println(io, "\nState space analysis:")
        println(io, "  Total current states (sum across all diamonds): $total_current_states")
        println(io, "  Total expanded states (if all non-cond sources added): $total_expanded_states")
        println(io, "  Expansion factor: $(round(total_expanded_states/total_current_states, digits=2))x")

        # Identify diamonds where expanding would help
        good_candidates = []
        for (diamond_hash, diamond_comp_data) in unique_diamonds
            diamond = diamond_comp_data.diamond
            cond_nodes = diamond.conditioning_nodes
            fresh_sources = diamond_comp_data.sub_sources
            non_cond_sources = setdiff(fresh_sources, cond_nodes)

            # Good candidate: few non-cond sources (1-3) and nested diamonds
            nested_count = length(diamond_comp_data.sub_diamond_structures)
            if 1 <= length(non_cond_sources) <= 3 && nested_count > 0
                push!(good_candidates, (
                    hash=diamond_hash,
                    cond=length(cond_nodes),
                    non_cond=length(non_cond_sources),
                    nested=nested_count,
                    current_states=2^length(cond_nodes),
                    expanded_states=2^(length(cond_nodes) + length(non_cond_sources))
                ))
            end
        end

        println(io, "\nGood candidates for conditioning set expansion:")
        println(io, "  (Diamonds with 1-3 non-cond sources AND nested diamonds)")
        println(io, "  Found: $(length(good_candidates)) candidates")
        for cand in good_candidates[1:min(10, length(good_candidates))]
            println(io, "    Hash $(cand.hash): $(cand.cond) cond + $(cand.non_cond) non-cond = $(cand.expanded_states) states, $(cand.nested) nested")
        end
        if length(good_candidates) > 10
            println(io, "    ... and $(length(good_candidates) - 10) more")
        end

        println(io, "\n" * "="^80)
        println(io, "END OF ANALYSIS")
        println(io, "="^80)
    end

    println("Analysis written to: $log_file")
end

# Helper function
function countmap(arr)
    result = Dict{eltype(arr), Int}()
    for x in arr
        result[x] = get(result, x, 0) + 1
    end
    return result
end

# ============================================================================
# Run Analysis on All Slow Networks
# ============================================================================

function analyze_all_slow_networks()
    slow_networks = [
        "pareto-point-1-high-resilience-fw",
        "pareto-point-3-medium-resilience-sparse",
        "pareto-point-5-medium-resilience-fw"
    ]

    fast_networks = [
        "pareto-point-2-high-resilience-vtol",
        "pareto-point-4-low-resilience-minimal",
        "pareto-point-6-balanced"
    ]

    all_networks = vcat(slow_networks, fast_networks)

    for network in all_networks
        println("\n" * "="^80)
        println("ANALYZING: $network")
        println("="^80)

        try
            root_diamonds, unique_diamonds = run_debug_full_diamond_processing(network, "float")

            log_file = "diamond_analysis_$(network).txt"
            analyze_diamond_structure_for_parallelization(
                root_diamonds,
                unique_diamonds,
                log_file
            )
        catch e
            println("ERROR analyzing $network: $e")
        end
    end
end

# Run single network analysis
#result = run_debug_full_diamond_processing(network_name, data_type);

# Uncomment to run analysis on current network:
# base_path = joinpath("dag_ntwrk_files", network_name)
# filepath_graph = joinpath(base_path, network_name * ".EDGES")
# _, _, _, source_nodes = read_graph_to_dict(filepath_graph)
# analyze_diamond_structure_for_parallelization(result[1], result[2], source_nodes, "diamond_analysis_$(network_name).txt")

# Uncomment to run analysis on ALL slow and fast networks:
# analyze_all_slow_networks()

# ============================================================================
# NEW: Analyze Intermediate Memoization Opportunities
# ============================================================================
"""
Analyze whether intermediate computations can be memoized.

The key mathematical insight:

For a diamond with:
  - Conditioning nodes C = {c₁, c₂, ...}
  - Non-conditioning sources N = {n₁, n₂, ...} (these have contextual beliefs)
  - Join node J

Current computation:
  Result = Σ_{s ∈ States(C)} P(s) × Belief(J | s, beliefs_N)

where beliefs_N = {belief_dict[n] for n in N} varies with outer context.

QUESTION: Can we factor out the context dependency?

For a simple diamond (no nested diamonds):
  Belief(J | s, beliefs_N) is a POLYNOMIAL in beliefs_N

  Because the computation is:
  1. Linear propagation through non-join nodes
  2. Inclusion-exclusion at join (products of sums)

For example, with 2 paths through the diamond:
  Belief(J) = p₁ × belief_N₁ + p₂ × belief_N₂ - p₁₂ × belief_N₁ × belief_N₂

Where p₁, p₂, p₁₂ depend ONLY on edge probabilities and conditioning state.

This suggests we could precompute SYMBOLIC coefficients:
  - For each conditioning state s
  - Compute coefficients for each monomial in beliefs_N
  - At runtime: just evaluate polynomial with actual beliefs_N values

COMPLEXITY ANALYSIS:
  - With k non-cond sources: up to 2^k monomials (products of subsets)
  - If k ≤ 10: at most 1024 coefficients per state
  - If k = 20: 1 million coefficients (too many)

This analysis determines if intermediate memoization is viable.
"""
function analyze_memoization_viability(
    unique_diamonds,
    log_file::String
)
    open(log_file, "w") do io
        println(io, "="^80)
        println(io, "INTERMEDIATE MEMOIZATION VIABILITY ANALYSIS")
        println(io, "="^80)
        println(io, "Generated: $(Dates.now())")
        println(io, "")

        println(io, """
Mathematical Background:
========================

For a diamond computation with non-conditioning sources N = {n₁, ..., nₖ},
the join node belief is a MULTILINEAR function in the beliefs of N:

  Belief(J | cond_state) = Σ_{S ⊆ N} coeff_S × ∏_{i ∈ S} belief(nᵢ)

Key insight: The coefficients coeff_S depend ONLY on:
  1. Diamond structure (edges, probabilities)
  2. Conditioning state (which nodes are 0/1)

They do NOT depend on the actual belief values of non-cond sources.

Therefore, we can potentially:
  1. PRECOMPUTE coefficients for each (diamond, cond_state) pair
  2. At runtime: just evaluate polynomial with actual belief values

Viability depends on:
  - Number of non-cond sources k: need 2^k coefficients per state
  - Number of conditioning states: 2^|C| states to precompute
  - Total coefficients: 2^|C| × 2^k per diamond

""")

        # Collect statistics
        viable_leaf = 0      # No nested diamonds, k ≤ 10
        viable_small = 0     # Has nested, but nested are viable
        infeasible = 0       # k > 10 makes coefficient explosion

        leaf_diamonds = []
        small_diamonds = []
        large_diamonds = []

        println(io, "\n" * "-"^80)
        println(io, "PER-DIAMOND MEMOIZATION ANALYSIS")
        println(io, "-"^80)

        for (diamond_hash, diamond_comp_data) in unique_diamonds
            diamond = diamond_comp_data.diamond
            cond_nodes = diamond.conditioning_nodes
            fresh_sources = diamond_comp_data.sub_sources
            non_cond_sources = setdiff(fresh_sources, cond_nodes)
            nested_count = length(diamond_comp_data.sub_diamond_structures)

            k = length(non_cond_sources)  # Number of non-cond sources
            c = length(cond_nodes)         # Number of conditioning nodes

            num_coefficients = 2^k         # Monomials per state
            num_states = 2^c               # Conditioning states
            total_coefficients = num_states * num_coefficients

            # Determine viability
            is_leaf = (nested_count == 0)
            polynomial_feasible = (k <= 10)  # 1024 coefficients max
            total_feasible = (total_coefficients <= 1_000_000)

            status = ""
            if is_leaf && polynomial_feasible
                status = "✓ VIABLE (leaf)"
                viable_leaf += 1
                push!(leaf_diamonds, (hash=diamond_hash, k=k, c=c, total=total_coefficients))
            elseif !is_leaf && polynomial_feasible && total_feasible
                status = "? MAYBE (nested but small)"
                viable_small += 1
                push!(small_diamonds, (hash=diamond_hash, k=k, c=c, nested=nested_count, total=total_coefficients))
            else
                if k > 10
                    status = "✗ INFEASIBLE (k=$k > 10, would need 2^$k = $(2^k) coefficients)"
                else
                    status = "✗ INFEASIBLE (total coeffs = $total_coefficients > 1M)"
                end
                infeasible += 1
                push!(large_diamonds, (hash=diamond_hash, k=k, c=c, nested=nested_count, total=total_coefficients))
            end

            if k > 5 || nested_count > 0
                println(io, "\nDiamond $diamond_hash:")
                println(io, "  Conditioning nodes (|C|): $c")
                println(io, "  Non-cond sources (k): $k")
                println(io, "  Nested diamonds: $nested_count")
                println(io, "  Coefficients per state: $num_coefficients (2^$k)")
                println(io, "  Total states: $num_states (2^$c)")
                println(io, "  Total coefficients: $total_coefficients")
                println(io, "  Status: $status")
            end
        end

        # Summary
        println(io, "\n" * "="^80)
        println(io, "MEMOIZATION VIABILITY SUMMARY")
        println(io, "="^80)

        total = viable_leaf + viable_small + infeasible
        println(io, "\nTotal diamonds analyzed: $total")
        println(io, "  ✓ Viable leaf diamonds (no nesting, k ≤ 10): $viable_leaf ($(round(100*viable_leaf/total, digits=1))%)")
        println(io, "  ? Potentially viable (nested but small): $viable_small ($(round(100*viable_small/total, digits=1))%)")
        println(io, "  ✗ Infeasible (k > 10 or total > 1M): $infeasible ($(round(100*infeasible/total, digits=1))%)")

        # Distribution of k values
        k_values = [length(setdiff(d.sub_sources, d.diamond.conditioning_nodes)) for (_, d) in unique_diamonds]
        println(io, "\nDistribution of non-cond source count (k):")
        println(io, "  $(sort(collect(countmap(k_values))))")

        # For viable leaf diamonds, estimate memory savings
        if !isempty(leaf_diamonds)
            total_leaf_coeffs = sum(d.total for d in leaf_diamonds)
            println(io, "\nLeaf diamond coefficient storage:")
            println(io, "  Total coefficients needed: $total_leaf_coeffs")
            println(io, "  Memory (Float64): $(round(total_leaf_coeffs * 8 / 1024, digits=2)) KB")
        end

        println(io, "\n" * "-"^80)
        println(io, "NESTED DIAMOND COMPLEXITY ANALYSIS")
        println(io, "-"^80)

        println(io, """

For nested diamonds, the situation is more complex:

When diamond D contains nested diamond D':
  - D's join belief depends on D's internal computation
  - D' contributes to some internal node's belief
  - D' itself has its own non-cond sources

The compositional structure means:
  Belief(J_D) = f(Belief(J_D'), edge_probs, cond_states)

If both D and D' have polynomial representations:
  - We can COMPOSE the polynomials
  - Result is still polynomial, but degree can grow

STRATEGY FOR NESTED DIAMONDS:
  Option 1: Bottom-up precomputation
    - Start with deepest (leaf) diamonds
    - Compute their polynomial coefficients
    - Compose into parent diamonds
    - Challenge: exponential coefficient growth

  Option 2: Lazy memoization with polynomial cache
    - At runtime, for each leaf diamond:
      - Compute polynomial coefficients once per (structure, cond_state)
      - Store coefficients instead of scalar results
    - For parents: compose polynomials
    - Challenge: polynomial composition complexity

  Option 3: Hybrid - memoize ONLY leaf diamonds
    - Leaf diamonds: use polynomial coefficients
    - Nested diamonds: use current approach but benefit from fast leaf computation
    - Pragmatic: captures most benefit with manageable complexity
""")

        # Analyze leaf diamond coverage
        leaf_count = count(d -> isempty(d[2].sub_diamond_structures), unique_diamonds)
        println(io, "\nLeaf diamond statistics:")
        println(io, "  Total leaf diamonds: $leaf_count out of $(length(unique_diamonds))")
        println(io, "  Percentage: $(round(100*leaf_count/length(unique_diamonds), digits=1))%")

        # Calculate potential speedup from leaf memoization
        # If we memoize leaf diamonds perfectly, how much of the computation is covered?
        total_states_leaf = sum(2^length(d.diamond.conditioning_nodes) for (_, d) in unique_diamonds if isempty(d.sub_diamond_structures))
        total_states_all = sum(2^length(d.diamond.conditioning_nodes) for (_, d) in unique_diamonds)

        println(io, "\nState space coverage:")
        println(io, "  Leaf diamond states: $total_states_leaf")
        println(io, "  All diamond states: $total_states_all")
        println(io, "  Leaf coverage: $(round(100*total_states_leaf/total_states_all, digits=1))%")

        println(io, "\n" * "="^80)
        println(io, "RECOMMENDATIONS")
        println(io, "="^80)

        if infeasible > total / 2
            println(io, """

⚠️  HIGH INFEASIBILITY RATE

More than half the diamonds have k > 10 non-conditioning sources.
Polynomial coefficient approach is NOT viable for this network.

Alternative strategies to consider:
1. SELECTIVE CONDITIONING: Add the 1-3 smallest non-cond sources to conditioning set
   - Reduces k at cost of more states
   - Works if resulting (k-3) ≤ 10

2. APPROXIMATE METHODS:
   - Monte Carlo sampling instead of exact enumeration
   - Truncated polynomial (keep only low-degree terms)

3. STRUCTURAL CHANGES:
   - Identify subgraphs that cause high k values
   - Consider alternative decompositions
""")
        else
            println(io, """

✓ POLYNOMIAL MEMOIZATION MAY BE VIABLE

Strategy: Hybrid approach
1. For leaf diamonds with k ≤ 10:
   - Precompute polynomial coefficients for each conditioning state
   - At runtime: evaluate polynomial with actual belief values
   - O(2^k) evaluation vs O(expensive recursion)

2. For nested diamonds:
   - Continue using current caching approach
   - Benefit from faster leaf computations

Expected benefits:
- Leaf diamond computation: potentially 10-100x faster
- Reduced recursion depth (leaves terminate immediately)
- Better cache hit rates (structure-only keys for leaves)
""")
        end

        println(io, "\n" * "="^80)
        println(io, "END OF MEMOIZATION ANALYSIS")
        println(io, "="^80)
    end

    println("Memoization analysis written to: $log_file")
end

# ============================================================================
# Extended Analysis: Run Both Diamond Structure and Memoization Analysis
# ============================================================================

function analyze_all_networks_full()
    all_networks = [
        "pareto-point-1-high-resilience-fw",
        "pareto-point-2-high-resilience-vtol",
        "pareto-point-3-medium-resilience-sparse",
        "pareto-point-4-low-resilience-minimal",
        "pareto-point-5-medium-resilience-fw",
        "pareto-point-6-balanced"
    ]

    for network in all_networks
        println("\n" * "="^80)
        println("FULL ANALYSIS: $network")
        println("="^80)

        try
            root_diamonds, unique_diamonds = run_debug_full_diamond_processing(network, "float")

            # Structure analysis
            log_file1 = "diamond_analysis_$(network).txt"
            analyze_diamond_structure_for_parallelization(root_diamonds, unique_diamonds, log_file1)

            # Memoization viability analysis
            log_file2 = "memoization_analysis_$(network).txt"
            analyze_memoization_viability(unique_diamonds, log_file2)

        catch e
            println("ERROR analyzing $network: $e")
            println(stacktrace(catch_backtrace()))
        end
    end
end

# Run the full analysis
# analyze_all_networks_full()

# ============================================================================
# NEW: Analyze Entry Point Structure for Non-Cond Sources
# ============================================================================
"""
Analyze how non-conditioning sources connect to diamonds.

Key structural observation:
- Non-cond sources connect via SINGLE EDGE to an intermediate node
- That intermediate node is NOT a conditioning node and NOT the join
- The intermediate node then has paths to the join

This suggests a potential decomposition:
- Group non-cond sources by their entry point (the intermediate node they connect to)
- Each entry point receives a LINEAR combination of non-cond source beliefs
- Entry point contribution = Σᵢ P(edge nᵢ→entry) × belief(nᵢ)

If entry points are few, we might factor:
  Belief(J | cond_state) = g(entry_contributions, cond_state)

Where entry_contributions has dimension = number of entry points (potentially << k)
"""
function analyze_entry_point_structure(
    unique_diamonds,
    log_file::String
)
    open(log_file, "w") do io
        println(io, "="^80)
        println(io, "ENTRY POINT STRUCTURE ANALYSIS")
        println(io, "="^80)
        println(io, "Generated: $(Dates.now())")
        println(io, "")

        println(io, """
Mathematical Motivation:
========================

For a diamond with k non-conditioning sources {n₁, ..., nₖ}:
- Each nᵢ connects to the diamond via exactly ONE edge
- That edge goes to an "entry point" node eᵢ (intermediate node)
- Entry point eᵢ is NOT a conditioning node and NOT the join

Current: We treat each nᵢ as independent → 2^k coefficient complexity

Alternative: Group by entry points!
- Let E = {e₁, ..., eₘ} be the distinct entry points
- Multiple non-cond sources may share the same entry point
- At each entry point eⱼ: contribution = Σ{nᵢ→eⱼ} P(nᵢ→eⱼ) × belief(nᵢ)

If m << k, we could potentially:
1. Compute entry point contributions (linear combination)
2. Use 2^m coefficients instead of 2^k

Question: Is m typically much smaller than k?
""")

        # Collect statistics
        entry_point_counts = Int[]
        noncond_counts = Int[]
        compression_ratios = Float64[]

        diamonds_with_shared_entries = 0
        diamonds_with_all_unique = 0

        println(io, "\n" * "-"^80)
        println(io, "PER-DIAMOND ENTRY POINT ANALYSIS")
        println(io, "-"^80)

        for (diamond_hash, diamond_comp_data) in unique_diamonds
            diamond = diamond_comp_data.diamond
            cond_nodes = diamond.conditioning_nodes
            fresh_sources = diamond_comp_data.sub_sources
            non_cond_sources = setdiff(fresh_sources, cond_nodes)

            k = length(non_cond_sources)
            if k == 0
                continue  # No non-cond sources, skip
            end

            # Find entry points for each non-cond source
            # Entry point = the node that the non-cond source connects TO (child of non-cond source in diamond)
            entry_points = Dict{Int, Set{Int}}()  # entry_node => set of non-cond sources that connect to it
            non_cond_to_entry = Dict{Int, Int}()  # non_cond_source => its entry point

            for edge in diamond.edgelist
                parent = edge[1]
                child = edge[2]
                if parent in non_cond_sources
                    # This edge connects a non-cond source to its entry point
                    non_cond_to_entry[parent] = child
                    if !haskey(entry_points, child)
                        entry_points[child] = Set{Int}()
                    end
                    push!(entry_points[child], parent)
                end
            end

            m = length(entry_points)  # Number of distinct entry points
            push!(entry_point_counts, m)
            push!(noncond_counts, k)

            compression = k > 0 ? m / k : 1.0
            push!(compression_ratios, compression)

            if m < k
                diamonds_with_shared_entries += 1
            else
                diamonds_with_all_unique += 1
            end

            # Log interesting cases
            if k >= 3
                println(io, "\nDiamond $diamond_hash:")
                println(io, "  Non-cond sources (k): $k")
                println(io, "  Distinct entry points (m): $m")
                println(io, "  Compression ratio (m/k): $(round(compression, digits=2))")
                println(io, "  Original coefficients: 2^$k = $(2^k)")
                println(io, "  Entry-based coefficients: 2^$m = $(2^m)")
                println(io, "  Reduction factor: $(round(2^k / 2^m, digits=1))x")

                # Show entry point structure
                println(io, "  Entry point breakdown:")
                for (entry, sources) in entry_points
                    is_cond = entry in cond_nodes
                    node_type = is_cond ? " (COND!)" : ""
                    println(io, "    Node $entry$node_type <- sources: $(sort(collect(sources)))")
                end
            end
        end

        # Summary statistics
        println(io, "\n" * "="^80)
        println(io, "ENTRY POINT SUMMARY STATISTICS")
        println(io, "="^80)

        diamonds_analyzed = length(entry_point_counts)
        println(io, "\nDiamonds with non-cond sources: $diamonds_analyzed")

        if diamonds_analyzed > 0
            println(io, "\nEntry point counts (m):")
            println(io, "  Min: $(minimum(entry_point_counts))")
            println(io, "  Max: $(maximum(entry_point_counts))")
            println(io, "  Mean: $(round(sum(entry_point_counts)/length(entry_point_counts), digits=2))")

            println(io, "\nNon-cond source counts (k):")
            println(io, "  Min: $(minimum(noncond_counts))")
            println(io, "  Max: $(maximum(noncond_counts))")
            println(io, "  Mean: $(round(sum(noncond_counts)/length(noncond_counts), digits=2))")

            println(io, "\nCompression ratios (m/k):")
            println(io, "  Min: $(round(minimum(compression_ratios), digits=3))")
            println(io, "  Max: $(round(maximum(compression_ratios), digits=3))")
            println(io, "  Mean: $(round(sum(compression_ratios)/length(compression_ratios), digits=3))")

            println(io, "\nEntry point sharing:")
            println(io, "  Diamonds with shared entries (m < k): $diamonds_with_shared_entries")
            println(io, "  Diamonds with all unique entries (m = k): $diamonds_with_all_unique")

            # Calculate potential coefficient reduction
            total_original = sum(2^k for k in noncond_counts)
            total_compressed = sum(2^m for m in entry_point_counts)

            println(io, "\nTotal coefficient comparison:")
            println(io, "  Original (Σ 2^k): $total_original")
            println(io, "  Entry-based (Σ 2^m): $total_compressed")
            println(io, "  Overall reduction: $(round(total_original / total_compressed, digits=1))x")
        end

        # Viability assessment
        println(io, "\n" * "="^80)
        println(io, "ENTRY POINT DECOMPOSITION VIABILITY")
        println(io, "="^80)

        feasible_with_entries = count(m -> m <= 10, entry_point_counts)
        infeasible_with_entries = count(m -> m > 10, entry_point_counts)

        println(io, "\nWith entry point grouping:")
        println(io, "  Feasible (m ≤ 10): $feasible_with_entries")
        println(io, "  Infeasible (m > 10): $infeasible_with_entries")

        if diamonds_analyzed > 0
            avg_compression = sum(compression_ratios) / length(compression_ratios)
            if avg_compression < 0.8
                println(io, """

✓ ENTRY POINT GROUPING SHOWS PROMISE

Average compression ratio: $(round(avg_compression, digits=2))
This means entry points are often SHARED among non-cond sources.

Mathematical implication:
- Instead of treating each non-cond source belief as independent variable
- We can compute ENTRY POINT CONTRIBUTIONS first:
    contribution(eⱼ) = Σ{nᵢ→eⱼ} P(nᵢ→eⱼ) × belief(nᵢ)
- Then the diamond join is a function of fewer variables

This is mathematically EXACT (not an approximation)!
The decomposition is:
  Belief(J | cond) = f(contribution(e₁), ..., contribution(eₘ), cond)

Where f still requires 2^m coefficients, but m < k.
""")
            else
                println(io, """

⚠ LIMITED BENEFIT FROM ENTRY POINT GROUPING

Average compression ratio: $(round(avg_compression, digits=2))
Most non-cond sources have unique entry points (m ≈ k).

This means the diamond structure doesn't naturally group
non-cond source contributions at shared intermediate nodes.

The entry point decomposition won't significantly reduce complexity.
""")
            end
        end

        println(io, "\n" * "="^80)
        println(io, "END OF ENTRY POINT ANALYSIS")
        println(io, "="^80)
    end

    println("Entry point analysis written to: $log_file")
end

# ============================================================================
# Run Entry Point Analysis on All Networks
# ============================================================================

function analyze_all_networks_entry_points()
    all_networks = [
        "pareto-point-1-high-resilience-fw",
        "pareto-point-2-high-resilience-vtol",
        "pareto-point-3-medium-resilience-sparse",
        "pareto-point-4-low-resilience-minimal",
        "pareto-point-5-medium-resilience-fw",
        "pareto-point-6-balanced"
    ]

    for network in all_networks
        println("\n" * "="^80)
        println("ENTRY POINT ANALYSIS: $network")
        println("="^80)

        try
            root_diamonds, unique_diamonds = run_debug_full_diamond_processing(network, "float")

            log_file = "entry_point_analysis_$(network).txt"
            analyze_entry_point_structure(unique_diamonds, log_file)

        catch e
            println("ERROR analyzing $network: $e")
            println(stacktrace(catch_backtrace()))
        end
    end
end

# Run entry point analysis
analyze_all_networks_entry_points()