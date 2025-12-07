"""
Clean Baseline Test - NO Pre-warming
Tests the original belief propagation with empty cache
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

#network_name = "power-network"      # Simple: 23 nodes, 27 edges
network_name = "HB0_local_1"         # Complex: 17 nodes, 135 edges,14 rooy diamonds, 132 unique diamonds

#network_name = "central_scotland_1"
#network_name = "glasgow_area"
#network_name = "drone-network-full"

# ============================================================================
# Main Test Function
# ============================================================================

function run_load(network_name, data_type="float")
    println("\n" * "="^80)
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
        );
    end

    println("   ✓ Built in $(round(t_storage, digits=3))s")
    println("   Unique diamonds: $(length(unique_diamonds))")


    # ========================================================================
    # STEP 5: Run Belief Propagation (PARALLEL)
    # ========================================================================
    println("\n🧮 STEP 5: Running PARALLEL belief propagation...")
    println("   Threads: $(Threads.nthreads())")
    println("   Parallelization: num_states >= 2, recursive")

    t_bp = @elapsed begin
        final_beliefs = update_beliefs_iterative(
        edgelist,
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities,
        descendants,
        ancestors,
        root_diamonds,
        join_nodes,
        fork_nodes,
        unique_diamonds
    );

    end

    println("   ✓ BP completed in $(round(t_bp, digits=3))s")

    # ========================================================================
    # Results Summary
    # ========================================================================
    println("\n" * "="^80)
    println("RESULTS SUMMARY")
    println("="^80)

  
    println("\n⏱️  TIMING BREAKDOWN:")
    println("   Load network:     $(round(t_load, digits=3))s")
    println("   Build structure:  $(round(t_structure, digits=3))s")
    println("   Identify diamonds: $(round(t_diamonds, digits=3))s")
    println("   Build storage:    $(round(t_storage, digits=3))s")
    println("   Belief propagation: $(round(t_bp, digits=3))s")
    println("   " * "-"^50)
    total_time = t_load + t_structure + t_diamonds + t_storage + t_bp
    println("   TOTAL TIME:       $(round(total_time, digits=3))s")

    println("\n" * "="^80)

    return final_beliefs
end

# ============================================================================
# Run the test
# ============================================================================

data_type = "float"
# data_type = "interval"
# data_type = "pbox"

result = run_load(network_name, data_type)
#= 
mc_results = MC_result_optimized(
        edgelist,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities,
        1_000_000
    )

    
    
# Sort outputs
sorted_algo = OrderedDict(sort(collect(result.beliefs)));
sorted_mc = OrderedDict(sort(collect(mc_results)));

# Create base DataFrame using the float values directly
df = DataFrame(
  Node = collect(keys(sorted_algo)),
  AlgoValue = collect(values(sorted_algo)),
  MCValue = collect(values(sorted_mc))
)

# Add a difference column (if needed)
df.Diff = abs.(df.AlgoValue .- df.MCValue)
# Display sorted result (if you want to sort by the difference)
show(sort(df, :Diff, rev=true), allrows=true)

using Printf

# Compare with full precision
println("\n" * "="^80)
println("FULL PRECISION COMPARISON")
println("="^80)

for node in sort(collect(keys(result.beliefs)))
    opt_val = result.beliefs[node]
    orig_val = mc_results[node]  # or whatever the original result dict is called
    diff = abs(opt_val - orig_val)
    
    @printf("Node %3d: Optimized = %.15f, Original = %.15f, Diff = %.2e\n", 
            node, opt_val, orig_val, diff)
end

=#