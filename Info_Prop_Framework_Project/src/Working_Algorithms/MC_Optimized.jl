function MC_result_optimized(
        edgelist::Vector{Tuple{Int64,Int64}},
        outgoing_index::Dict{Int64,Set{Int64}},
        incoming_index::Dict{Int64,Set{Int64}},
        source_nodes::Set{Int64},
        node_priors::Dict{Int64, Float64},
        edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
        N::Int=100000
    )
    # Get all nodes
    all_nodes = reduce(union, values(incoming_index), init=keys(incoming_index))
    active_count = Dict{Int64, Float64}()
    for node in all_nodes
        active_count[node] = 0.0
    end

    for _ in 1:N
        # Sample node states
        node_active = Dict(
            node => rand() < node_priors[node]
            for node in all_nodes
        )

        # Only sample edges where both endpoints are active
        active_edges = Set{Tuple{Int64,Int64}}()
        for edge in edgelist
            src, dst = edge
            if node_active[src] && node_active[dst] && rand() < edge_probabilities[edge]
                push!(active_edges, edge)
            end
        end

        # Create subgraph with only active edges
        sub_outgoing = Dict{Int64, Set{Int64}}()
        for (src, dst) in active_edges
            if !haskey(sub_outgoing, src)
                sub_outgoing[src] = Set{Int64}()
            end
            push!(sub_outgoing[src], dst)
        end

        # Find all reachable nodes in a single traversal
        reachable_nodes = find_all_reachable(sub_outgoing, source_nodes)

        # Count active nodes
        for node in all_nodes
            if node in source_nodes
                if node_active[node]
                    active_count[node] += 1
                end
            else
                if node in reachable_nodes
                    active_count[node] += 1
                end
            end
        end
    end

    # Convert counts to probabilities
    for node in keys(active_count)
        active_count[node] /= N
    end

    return active_count
end

# Optimized function to find all reachable nodes from multiple sources
function find_all_reachable(graph::Dict{Int64, Set{Int64}}, sources::Set{Int64})
    reachable = Set{Int64}()
    queue = Int64[]
    
    # Start BFS from all active source nodes
    for source in sources
        if !in(source, reachable)
            push!(reachable, source)
            push!(queue, source)
        end
    end
    
    while !isempty(queue)
        node = popfirst!(queue)
        
        if haskey(graph, node)
            for neighbor in graph[node]
                if neighbor ∉ reachable
                    push!(reachable, neighbor)
                    push!(queue, neighbor)
                end
            end
        end
    end
    
    return reachable
end


mc_results = MC_result_optimized(
        edgelist,
        outgoing_index,
        incoming_index,
        source_nodes,
        node_priors,
        edge_probabilities,
        10_000_000
    )


    
# Sort outputs
sorted_algo = OrderedDict(sort(collect(output)));
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
#= 
using CSV

# Sort the DataFrame by the Diff column in descending order
sorted_df = sort(df, :Diff, rev=true)

# Save the sorted DataFrame as a CSV file
CSV.write("sorted_mumin_result.csv", sorted_df)
 =#