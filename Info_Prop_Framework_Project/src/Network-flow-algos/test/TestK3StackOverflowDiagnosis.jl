"""
K3 Stack Overflow Diagnosis - Find WHERE it fails

Tests each phase of the BP algorithm separately to identify exact failure point:
1. Load network
2. Build structure
3. Identify diamonds
4. Build unique storage
5. Run BP (iterative)
"""

if !@isdefined(script_initialized_k3_diagnosis)
    println("First run - initializing...")

    include("../src/IPAFrameworkOptimized.jl")
    using .IPAFrameworkOptimized

    global script_initialized_k3_diagnosis = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

network_name = "drone-network-balanced-k3"
data_type = "float"

println("\n" * "="^80)
println("K3 STACK OVERFLOW DIAGNOSIS")
println("Testing each phase separately to identify failure point")
println("="^80 * "\n")

base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

# ============================================================================
# PHASE 1: Load Network
# ============================================================================
println("📊 PHASE 1: Loading network data...")
try
    t_load = @elapsed begin
        global edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
        global node_priors = read_node_priors_from_json(filepath_node_json)
        global edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
    end

    println("   ✅ PASSED in $(round(t_load, digits=3))s")
    println("   • Nodes: $(length(node_priors))")
    println("   • Edges: $(length(edgelist))")
    println("   • Sources: $(length(source_nodes))")
catch e
    println("   ❌ FAILED!")
    println("   Error: $e")
    exit(1)
end

# ============================================================================
# PHASE 2: Build Network Structure
# ============================================================================
println("\n🔧 PHASE 2: Building network structure...")
try
    t_structure = @elapsed begin
        global fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
        global iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)
    end

    println("   ✅ PASSED in $(round(t_structure, digits=3))s")
    println("   • Forks: $(length(fork_nodes))")
    println("   • Joins: $(length(join_nodes))")
    println("   • Iteration layers: $(length(iteration_sets))")
catch e
    println("   ❌ FAILED!")
    println("   Error: $e")
    println("\n🔍 DIAGNOSIS: Stack overflow in network structure building")
    exit(1)
end

# ============================================================================
# PHASE 3: Identify Diamonds
# ============================================================================
println("\n💎 PHASE 3: Identifying diamonds...")
try
    t_diamonds = @elapsed begin
        global root_diamonds = identify_and_group_diamonds(
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

    println("   ✅ PASSED in $(round(t_diamonds, digits=3))s")
    println("   • Root diamonds: $(length(root_diamonds))")
catch e
    println("   ❌ FAILED!")
    println("   Error: $e")
    println("\n🔍 DIAGNOSIS: Stack overflow in diamond identification")
    println("   This is likely in perform_recursive_diamond_completeness or helper functions")
    exit(1)
end

# ============================================================================
# PHASE 4: Build Unique Diamond Storage
# ============================================================================
println("\n🔨 PHASE 4: Building unique diamond storage...")
try
    t_storage = @elapsed begin
        global unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
            root_diamonds,
            node_priors,
            ancestors,
            descendants,
            iteration_sets
        )
    end

    println("   ✅ PASSED in $(round(t_storage, digits=3))s")
    println("   • Unique diamonds: $(length(unique_diamonds))")

    # Analyze complexity
    if !isempty(unique_diamonds)
        max_depth = maximum(d.depth_level for d in values(unique_diamonds))
        max_conditioning = maximum(d.num_conditioning_nodes for d in values(unique_diamonds))
        println("   • Max nesting depth: $max_depth")
        println("   • Max conditioning nodes: $max_conditioning (2^$max_conditioning = $(2^max_conditioning) states)")
    end
catch e
    println("   ❌ FAILED!")
    println("   Error: $e")
    println("\n🔍 DIAGNOSIS: Stack overflow in unique diamond storage building")
    println("   This is likely in the LIFO stack processing or sub-diamond identification")
    exit(1)
end

# ============================================================================
# PHASE 5: Run Iterative BP
# ============================================================================
println("\n🔄 PHASE 5: Running iterative BP...")
println("   • Threads: $(Threads.nthreads())")

try
    GC.gc()

    t_bp = @elapsed begin
        global beliefs = update_beliefs_iterative_stack(
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
        )
    end

    println("   ✅ PASSED in $(round(t_bp, digits=3))s")
    println("   • Computed beliefs for $(length(beliefs)) nodes")
catch e
    println("   ❌ FAILED!")
    println("   Error: $e")
    println("\n🔍 DIAGNOSIS: Stack overflow in iterative BP execution")
    println("   Even with iterative state enumeration, diamond recursion depth causing issues")
    exit(1)
end

# ============================================================================
# SUCCESS!
# ============================================================================
println("\n" * "="^80)
println("✅ ALL PHASES PASSED!")
println("="^80)
println("\nK3 network completed successfully with iterative BP!")
println("No stack overflow occurred.")
