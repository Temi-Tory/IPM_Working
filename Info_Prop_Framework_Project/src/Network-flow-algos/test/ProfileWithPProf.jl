"""
Profile HB01 using PProf for better visualization and filtering
Install: using Pkg; Pkg.add("PProf")
Run from terminal: julia --project --threads=8 test/ProfileWithPProf.jl
"""

using Profile, PProf
using DataFrames, DelimitedFiles, Distributions,
    DataStructures, SparseArrays,
    Combinatorics, Dates

include("../src/IPAFrameworkOptimized.jl")
using .IPAFrameworkOptimized

# Load network
network_name = "HB0_local_1"
data_type = "float"

println("\n" * "="^80)
println("PROFILING WITH PPROF: $network_name")
println("Threads: $(Threads.nthreads())")
println("="^80)

base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

# Load data
println("\nLoading network...")
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

root_diamonds = identify_and_group_diamonds(
    join_nodes, incoming_index, ancestors, descendants,
    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
)

unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
    root_diamonds, node_priors, ancestors, descendants, iteration_sets
)

println("✓ Network loaded")

# Warm up
println("\nWarming up (compiling)...")
beliefs = update_beliefs_iterative(
    edgelist, iteration_sets, outgoing_index, incoming_index,
    source_nodes, node_priors, edge_probabilities,
    descendants, ancestors, root_diamonds,
    join_nodes, fork_nodes, unique_diamonds
)
println("✓ Warmup complete")

# CPU Profile
println("\nProfiling CPU usage (running 2 iterations)...")
Profile.clear()
@profile begin
    for i in 1:2
        beliefs = update_beliefs_iterative(
            edgelist, iteration_sets, outgoing_index, incoming_index,
            source_nodes, node_priors, edge_probabilities,
            descendants, ancestors, root_diamonds,
            join_nodes, fork_nodes, unique_diamonds
        )
    end
end

println("\n" * "="^80)
println("GENERATING PPROF REPORTS")
println("="^80)

# Generate CPU profile - opens in browser
println("\n1. CPU Profile (opening in browser)...")
println("   Focus on functions in ReachabilityModuleRecurseOptimized.jl")
println("   Look for: updateDiamondJoin, copy, merge, lock operations")
pprof(;web=true)

println("\n2. Saving profile data...")
# Save to file for later analysis
pprof(out="hb01_cpu_profile.pb.gz", web=false)
println("   ✓ Saved to: hb01_cpu_profile.pb.gz")
println("   View later with: pprof(\"hb01_cpu_profile.pb.gz\")")

# Allocation Profile
println("\n" * "="^80)
println("PROFILING ALLOCATIONS")
println("="^80)

Profile.clear_malloc_data()
println("\nRunning with allocation tracking...")
beliefs = update_beliefs_iterative(
    edgelist, iteration_sets, outgoing_index, incoming_index,
    source_nodes, node_priors, edge_probabilities,
    descendants, ancestors, root_diamonds,
    join_nodes, fork_nodes, unique_diamonds
)

println("\n" * "="^80)
println("✅ Profiling complete!")
println("="^80)
println("""
PProf browser should be open. In the interface:

1. Click "View" → "Flame Graph" for visual representation
2. Use "Sample" dropdown to focus on specific samples
3. Search for "ReachabilityModuleRecurseOptimized" to filter
4. Click on wide bars to see which functions take most time
5. Look for:
   - copy() calls
   - lock operations
   - updateDiamondJoin and callees
   - Dict allocations

Common issues to look for:
- Wide bars in copy() → too many dict copies
- Lock contention → thread synchronization overhead
- Recursive calls → depth and frequency
""")
