"""
Simple test for iterative sequential implementation
Tests on HB0_local_1 network only
"""

println("Initializing...")

include("../src/IPAFrameworkIterative.jl")
using .IPAFrameworkIterative

println("Module loaded successfully!")

# Load network
network_name = "HB0_local_1"
data_type = "float"

base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
filepath_node_json = joinpath(base_path, data_type, network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, network_name * "-linkprobabilities.json")

println("\nLoading network: $network_name")

edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

println("✓ Basic data loaded")
println("  Nodes: $(length(union(Set(e[1] for e in edgelist), Set(e[2] for e in edgelist))))")
println("  Edges: $(length(edgelist))")
println("  Sources: $(length(source_nodes))")

fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

println("✓ Graph structure computed")
println("  Fork nodes: $(length(fork_nodes))")
println("  Join nodes: $(length(join_nodes))")
println("  Iteration sets: $(length(iteration_sets))")

root_diamonds = identify_and_group_diamonds(
    join_nodes, incoming_index, ancestors, descendants,
    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets
)

println("✓ Diamonds identified")
println("  Root diamonds: $(length(root_diamonds))")

unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
    root_diamonds, node_priors, ancestors, descendants, iteration_sets
)

println("✓ Diamond storage built")
println("  Unique diamonds: $(length(unique_diamonds))")

# Run iterative version
println("\n" * "="^80)
println("RUNNING ITERATIVE SEQUENTIAL VERSION")
println("="^80)

GC.gc()
t_start = time()

beliefs = update_beliefs_iterative_sequential(
    edgelist, iteration_sets, outgoing_index, incoming_index,
    source_nodes, node_priors, edge_probabilities,
    descendants, ancestors, root_diamonds,
    join_nodes, fork_nodes, unique_diamonds
)

t_elapsed = time() - t_start

println("\n✅ SUCCESS!")
println("Time: $(round(t_elapsed, digits=2))s")
println("Computed beliefs for $(length(beliefs)) nodes")
println("\nSample results:")
println("  Node 1: $(get(beliefs, 1, missing))")
println("  Node 10: $(get(beliefs, 10, missing))")
println("  Node 100: $(get(beliefs, 100, missing))")
println("  Node 149: $(get(beliefs, 149, missing))")

println("\n" * "="^80)
println("Test complete!")
println("="^80)
