
# Check if this is the first run of the script for this julia repl session
# This is useful to avoid re-initializing the environment multiple times
if !@isdefined(script_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    # Ensure we're running from the project root directory
    current_dir = pwd()
    # Include the IPAFramework module
    include("../src/IPAFramework.jl")
    using .IPAFramework

    # Mark as initialized
    global script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end




network_name = "power-network"

network_name = "drone-network-full"

#= 
central_scotland_1
central_scotland_2
central_scotland_3
edinburgh_area
glasgow_area
HB0_local_3
HB0_local_2
HB0_local_1 =#

network_name = "glasgow_area"

#HB0_local_1 => 578.106999874115 SECONDS


data_type = "float"
# data_type = "interval"
#data_type = "pbox"



# Construct file paths using new folder structure
base_path = joinpath("dag_ntwrk_files", network_name)

# Option 1: Use edge file (recommended)
filepath_graph = joinpath(base_path, network_name * ".EDGES");
json_network_name = network_name#replace(network_name, "_" => "-")  # Convert underscores to hyphens for JSON files
filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")



if !isfile(filepath_graph)
    error("Graph file not found: $filepath_graph")
end
if !isfile(filepath_node_json)
    error("Node priors file not found: $filepath_node_json")
end
if !isfile(filepath_edge_json)
    error("Edge probabilities file not found: $filepath_edge_json")
end

# Read the graph and node priors

# Option 1: Separate calls (gives you more control)
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)

allnodes = # Get all nodes from the outgoing index
    collect(keys(incoming_index));
sink_nodes = #nodes with no keys in outgoing_index or with empty outgoing_index
    filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes);

node_priors = read_node_priors_from_json(filepath_node_json)

edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)


# Identify network structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)


println(" finding root diamonds");
# Diamond structure analysis (if you have this function)
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
);

l_root_diamonds = length(root_diamonds);

println("Found $l_root_diamonds root_diamonds");

#=    for diamond in values(root_diamonds)
     println("Diamond: ", diamond.join_node)
        println( diamond.diamond.edgelist)
            println("conditioning_nodes: ", diamond.diamond.conditioning_nodes)
    end =#

println("Starting build unique diamond storage");
unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
    root_diamonds,
    node_priors,
    ancestors,
    descendants,
    iteration_sets
);
l_unique_diamonds = length(unique_diamonds)

 
println("Found $l_unique_diamonds unique_diamonds");
#= 
println("Found $l_unique_diamonds unique_diamonds")

# Group diamonds by structure (comparing sets, not ordered lists)
structural_groups = Dict{Tuple{Set{Tuple{Int64, Int64}}, Set{Int64}}, Vector{Any}}()

for value in values(unique_diamonds)
    # Convert edgelist to Set for order-independent comparison
    edge_set = Set(value.diamond.edgelist)
    key = (edge_set, value.diamond.conditioning_nodes)
    
    if !haskey(structural_groups, key)
        structural_groups[key] = []
    end
    push!(structural_groups[key], value)
end

println("Found $(length(structural_groups)) structurally unique diamonds (ignoring order and root/sub context)")

count = 1
for (structure_key, group) in structural_groups
    representative = first(group)
    
    println("=== STRUCTURALLY UNIQUE DIAMOND $count ===")
    println("Edge list: ", representative.diamond.edgelist)
    println("Conditioning nodes: ", representative.diamond.conditioning_nodes)
    
    # Calculate sink nodes
    sources = Set([edge[1] for edge in representative.diamond.edgelist])
    destinations = Set([edge[2] for edge in representative.diamond.edgelist])
    sink_nodes = setdiff(destinations, sources)
    println("Sink node(s): ", sink_nodes)
    println("Duplicate instances: $(length(group))")
    println()
    
    count += 1
end
 =#

println("Starting iterative belief update");
start_time = time()
output = IPAFramework.update_beliefs_iterative(
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

# Calculate computation time
computation_time = time() - start_time

#show(output)
