# Trace conditioning nodes during diamond building
# This adds instrumentation to see what's happening

if !@isdefined(script_initialized)
    println("First run - initializing...")

    import Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, Dates

    current_dir = pwd()
    include("src/Network-flow-algos/src/IPAFramework.jl")
    using .IPAFramework

    global script_initialized = true
    println("Initialization complete!")
else
    println("Subsequent run - skipping initialization")
end

network_name = "drone-network-full"
data_type = "float"

base_path = joinpath("dag_ntwrk_files", network_name)
filepath_graph = joinpath(base_path, network_name * ".EDGES")
json_network_name = network_name
filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")

println("="^80)
println("TRACING CONDITIONING NODES: $network_name")
println("="^80)

# Read network
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
node_priors = read_node_priors_from_json(filepath_node_json)
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)

fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

println("\n🔍 Finding root diamonds...")
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

println("Found $(length(root_diamonds)) root diamonds")

# Analyze root diamonds
println("\n📊 ROOT DIAMOND CONDITIONING NODES:")
for (join_node, diamond_at_node) in root_diamonds
    num_cond = length(diamond_at_node.diamond.conditioning_nodes)
    if num_cond > 1
        println("  Join node $join_node: $num_cond conditioning nodes")
    end
end

# Now let's manually check what sub-diamonds would look like for ONE root diamond
println("\n🔬 DETAILED ANALYSIS OF ONE ROOT DIAMOND:")
println("="^80)

# Pick a root diamond with 2 conditioning nodes
target_diamond = nothing
target_join = nothing
for (join_node, diamond_at_node) in root_diamonds
    if length(diamond_at_node.diamond.conditioning_nodes) == 2
        target_diamond = diamond_at_node
        target_join = join_node
        break
    end
end

if target_diamond !== nothing
    diamond = target_diamond.diamond

    println("Selected join node: $target_join")
    println("Conditioning nodes: ", sort(collect(diamond.conditioning_nodes)))
    println("Relevant nodes: ", length(diamond.relevant_nodes))
    println("Edges: ", length(diamond.edgelist))

    # Build subgraph structure for this diamond
    println("\n🔨 Building subgraph structure...")

    # Manually compute what sub-diamonds would be
    sub_outgoing_index = Dict{Int64, Set{Int64}}()
    sub_incoming_index = Dict{Int64, Set{Int64}}()

    for (i, j) in diamond.edgelist
        if !haskey(sub_outgoing_index, i)
            sub_outgoing_index[i] = Set{Int64}()
        end
        push!(sub_outgoing_index[i], j)

        if !haskey(sub_incoming_index, j)
            sub_incoming_index[j] = Set{Int64}()
        end
        push!(sub_incoming_index[j], i)
    end

    # Find sub-sources
    sub_sources = Set{Int64}()
    for node in keys(sub_outgoing_index)
        if !haskey(sub_incoming_index, node) || isempty(sub_incoming_index[node])
            push!(sub_sources, node)
        end
    end

    # Find sub-fork and sub-join nodes
    sub_fork_nodes = Set{Int64}()
    for (node, targets) in sub_outgoing_index
        if length(targets) > 1
            push!(sub_fork_nodes, node)
        end
    end

    sub_join_nodes = Set{Int64}()
    for (node, sources) in sub_incoming_index
        if length(sources) > 1
            push!(sub_join_nodes, node)
        end
    end

    println("\nSub-diamond structure:")
    println("  Sub-sources: ", length(sub_sources))
    println("  Sub-fork nodes: ", length(sub_fork_nodes))
    println("  Sub-join nodes: ", length(sub_join_nodes))

    # Filter ancestors and descendants
    sub_ancestors = Dict{Int64, Set{Int64}}()
    sub_descendants = Dict{Int64, Set{Int64}}()
    for node in diamond.relevant_nodes
        sub_ancestors[node] = Set{Int64}(intersect(ancestors[node], diamond.relevant_nodes))
        sub_descendants[node] = Set{Int64}(intersect(descendants[node], diamond.relevant_nodes))
    end

    # Create sub_node_priors with conditioning nodes set to 1
    sub_node_priors = Dict{Int64, Float64}()
    for node in diamond.relevant_nodes
        if node ∉ sub_sources
            sub_node_priors[node] = node_priors[node]
        elseif node ∉ diamond.conditioning_nodes
            sub_node_priors[node] = 0.9  # placeholder
        else
            sub_node_priors[node] = 1.0  # conditioning node
        end
    end

    # Filter iteration sets
    sub_iteration_sets = Vector{Set{Int64}}()
    for iter_set in iteration_sets
        filtered_set = Set{Int64}(intersect(iter_set, diamond.relevant_nodes))
        if !isempty(filtered_set)
            push!(sub_iteration_sets, filtered_set)
        end
    end

    println("\nSub-iteration sets: ", length(sub_iteration_sets))

    # NOW identify sub-diamonds (this is what happens inside the diamond)
    println("\n🔍 Finding SUB-DIAMONDS within this diamond...")

    # Set current_excluded_nodes = conditioning nodes from parent
    current_excluded_nodes = copy(diamond.conditioning_nodes)

    @time sub_diamonds_dict = identify_and_group_diamonds(
        sub_join_nodes,
        sub_incoming_index,
        sub_ancestors,
        sub_descendants,
        sub_sources,
        sub_fork_nodes,
        diamond.edgelist,
        sub_node_priors,
        sub_iteration_sets,
        current_excluded_nodes  # Pass excluded nodes
    )

    println("\nFound $(length(sub_diamonds_dict)) sub-diamonds")

    if !isempty(sub_diamonds_dict)
        println("\n📊 SUB-DIAMOND CONDITIONING NODE COUNTS:")
        for (sub_join, sub_diamond_at_node) in sub_diamonds_dict
            num_cond = length(sub_diamond_at_node.diamond.conditioning_nodes)
            println("  Sub-join $sub_join: $num_cond conditioning nodes → 2^$num_cond = $(2^num_cond) states")
            if num_cond > 2
                println("    ⚠️  Conditioning nodes: ", sort(collect(sub_diamond_at_node.diamond.conditioning_nodes)))
            end
        end

        # Check for max
        max_sub_cond = maximum(length(sd.diamond.conditioning_nodes) for sd in values(sub_diamonds_dict))
        println("\n🎯 Max sub-diamond conditioning nodes: $max_sub_cond")
        println("   This means: 2^$max_sub_cond = $(2^max_sub_cond) states to enumerate!")
    end
else
    println("No root diamond with 2 conditioning nodes found!")
end

println("\n" * "="^80)
println("Analysis complete!")
println("="^80)
