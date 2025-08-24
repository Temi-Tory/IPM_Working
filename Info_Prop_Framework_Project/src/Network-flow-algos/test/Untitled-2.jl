function benchmark_root_manual(args...; n_runs=3)
    times = Float64[]
    memories = Int[]
    results = []
    
    for i in 1:n_runs
        println("MC Run $i/$n_runs...")
        
        # Time and memory measurement
        start_time = time_ns()
        memory_used = @allocated begin
            result = identify_and_group_diamonds(args...)
        end
        end_time = time_ns()
        
        push!(times, (end_time - start_time) / 1e9)  # Convert to seconds
        push!(memories, memory_used)
        push!(results, result)
    end
    
    return (
        mean_time = mean(times),
        std_time = std(times),
        mean_memory = mean(memories),
        times = times,
        memories = memories,
        results = results
    )
end

function benchmark_unique_manual(args...; n_runs=3)
    times = Float64[]
    memories = Int[]
    results = []
    
    for i in 1:n_runs
        println("MC Run $i/$n_runs...")
        
        # Time and memory measurement
        start_time = time_ns()
        memory_used = @allocated begin
            result = build_unique_diamond_storage_depth_first_parallel(args...)
        end
        end_time = time_ns()
        
        push!(times, (end_time - start_time) / 1e9)  # Convert to seconds
        push!(memories, memory_used)
        push!(results, result)
    end
    
    return (
        mean_time = mean(times),
        std_time = std(times),
        mean_memory = mean(memories),
        times = times,
        memories = memories,
        results = results
    )
end

function benchmark_algo_manual(args...; n_runs=3)
    times = Float64[]
    memories = Int[]
    results = []
    
    for i in 1:n_runs
        println("MC Run $i/$n_runs...")
        
        # Time and memory measurement
        start_time = time_ns()
        memory_used = @allocated begin
            result = IPAFramework.update_beliefs_iterative(args...)
        end
        end_time = time_ns()
        
        push!(times, (end_time - start_time) / 1e9)  # Convert to seconds
        push!(memories, memory_used)
        push!(results, result)
    end
    
    return (
        mean_time = mean(times),
        std_time = std(times),
        mean_memory = mean(memories),
        times = times,
        memories = memories,
        results = results
    )
end

function benchmark_exact_manual(args...; n_runs=3)
    times = Float64[]
    memories = Int[]
    results = []
    
    for i in 1:n_runs
        println("MC Run $i/$n_runs...")
        
        # Time and memory measurement
        start_time = time_ns()
        memory_used = @allocated begin
            result = path_enumeration_result(args...)
        end
        end_time = time_ns()
        
        push!(times, (end_time - start_time) / 1e9)  # Convert to seconds
        push!(memories, memory_used)
        push!(results, result)
    end
    
    return (
        mean_time = mean(times),
        std_time = std(times),
        mean_memory = mean(memories),
        times = times,
        memories = memories,
        results = results
    )
end

    
function benchmark_mc_manual(args...; n_runs=3)
    times = Float64[]
    memories = Int[]
    results = []
    
    for i in 1:n_runs
        println("MC Run $i/$n_runs...")
        
        # Time and memory measurement
        start_time = time_ns()
        memory_used = @allocated begin
            result = MC_result_optimized(args...)
        end
        end_time = time_ns()
        
        push!(times, (end_time - start_time) / 1e9)  # Convert to seconds
        push!(memories, memory_used)
        push!(results, result)
    end
    
    return (
        mean_time = mean(times),
        std_time = std(times),
        mean_memory = mean(memories),
        times = times,
        memories = memories,
        results = results
    )
end

# Usage:
mc_stats = benchmark_mc_manual(
    edgelist, outgoing_index, incoming_index, 
    source_nodes, node_priors, edge_probabilities, 1_0_000
)

println("Mean time: $(mc_stats.mean_time) ± $(mc_stats.std_time) seconds")
println("Mean memory: $(mc_stats.mean_memory / 1e9) GB")

root_diamonds_stats = benchmark_root_manual(
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

unique_diamonds_stats = benchmark_unique_manual(
    root_diamonds,
    node_priors,
    ancestors,
    descendants,
    iteration_sets
);

output_stats = benchmark_algo_manual(
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

exact_stats = benchmark_exact_manual(
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    true
);