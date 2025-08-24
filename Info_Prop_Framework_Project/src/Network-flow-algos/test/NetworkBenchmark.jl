"""
Network Algorithm Benchmarking Suite
Provides consistent benchmarking for all components of the IPA framework
"""

using Statistics

"""
Generic benchmark function with timing and memory measurement
"""
function benchmark_function(func, args...; n_runs=3, description="Function")
    times = Float64[]
    memories = Int[]
    results = []
    
    println("🔬 Benchmarking $description...")
    
    for i in 1:n_runs
        println("   Run $i/$n_runs...")
        
        # Force garbage collection before measurement
        GC.gc()
        
        # Time and memory measurement
        start_time = time_ns()
        memory_used = @allocated begin
            result = func(args...)
        end
        end_time = time_ns()
        
        push!(times, (end_time - start_time) / 1e9)  # Convert to seconds
        push!(memories, memory_used)
        push!(results, result)
        
        println("      Time: $(times[end]) seconds")
        println("      Memory: $(memories[end] / 1e6) MB")
    end
    
    # Calculate statistics
    stats = (
        mean_time = mean(times),
        std_time = std(times),
        min_time = minimum(times),
        max_time = maximum(times),
        mean_memory = mean(memories),
        std_memory = std(memories),
        min_memory = minimum(memories),
        max_memory = maximum(memories),
        all_times = times,
        all_memories = memories,
        results = results
    )
    
    # Print summary
    println("📊 $description Results:")
    println("   Time: $(stats.mean_time) ± $(stats.std_time) seconds ($(stats.min_time) - $(stats.max_time))")
    println("   Memory: $(stats.mean_memory / 1e6) ± $(stats.std_memory / 1e6) MB ($(stats.min_memory / 1e6) - $(stats.max_memory / 1e6))")
    println()
    
    return stats
end

"""
Benchmark diamond identification (root diamonds)
"""
function benchmark_root_diamonds(join_nodes, incoming_index, ancestors, descendants, 
                                source_nodes, fork_nodes, edgelist, node_priors, iteration_sets; 
                                n_runs=3)
    return benchmark_function(
        identify_and_group_diamonds,
        join_nodes, incoming_index, ancestors, descendants, source_nodes, 
        fork_nodes, edgelist, node_priors, iteration_sets;
        n_runs=n_runs,
        description="Root Diamond Identification"
    )
end

"""
Benchmark unique diamond storage building
"""
function benchmark_unique_diamonds(root_diamonds, node_priors, ancestors, descendants, iteration_sets; 
                                  n_runs=3)
    return benchmark_function(
        build_unique_diamond_storage_depth_first_parallel,
        root_diamonds, node_priors, ancestors, descendants, iteration_sets;
        n_runs=n_runs,
        description="Unique Diamond Storage"
    )
end

"""
Benchmark the main IPA algorithm
"""
function benchmark_ipa_algorithm(edgelist, iteration_sets, outgoing_index, incoming_index, 
                                source_nodes, node_priors, edge_probabilities, descendants, 
                                ancestors, root_diamonds, join_nodes, fork_nodes, unique_diamonds; 
                                n_runs=3)
    return benchmark_function(
        IPAFramework.update_beliefs_iterative,
        edgelist, iteration_sets, outgoing_index, incoming_index, source_nodes, 
        node_priors, edge_probabilities, descendants, ancestors, root_diamonds, 
        join_nodes, fork_nodes, unique_diamonds;
        n_runs=n_runs,
        description="IPA Algorithm"
    )
end

"""
Benchmark exact computation (path enumeration)
"""
function benchmark_exact_computation(outgoing_index, incoming_index, source_nodes, 
                                    node_priors, edge_probabilities, all_paths=true; 
                                    n_runs=3)
    return benchmark_function(
        path_enumeration_result,
        outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities, all_paths;
        n_runs=n_runs,
        description="Exact Computation (Path Enumeration)"
    )
end

"""
Benchmark Monte Carlo simulation
"""
function benchmark_monte_carlo(edgelist, outgoing_index, incoming_index, source_nodes, 
                              node_priors, edge_probabilities, n_simulations; n_runs=3)
    return benchmark_function(
        MC_result_optimized,
        edgelist, outgoing_index, incoming_index, source_nodes, 
        node_priors, edge_probabilities, n_simulations;
        n_runs=n_runs,
        description="Monte Carlo Simulation ($n_simulations runs)"
    )
end

"""
Run complete benchmark suite on a network
"""
function benchmark_complete_network(network_data; n_runs=3, include_exact=true, mc_simulations=[10_000, 100_000, 1_000_000])
    println("🚀 RUNNING COMPLETE NETWORK BENCHMARK")
    println("="^70)
    println("Network: $(network_data[:name])")
    println("Nodes: $(length(network_data[:node_priors]))")
    println("Edges: $(length(network_data[:edgelist]))")
    println("Benchmark runs: $n_runs")
    println()
    
    results = Dict()
    
    # 1. Root Diamonds
    results[:root_diamonds] = benchmark_root_diamonds(
        network_data[:join_nodes], network_data[:incoming_index], 
        network_data[:ancestors], network_data[:descendants], 
        network_data[:source_nodes], network_data[:fork_nodes], 
        network_data[:edgelist], network_data[:node_priors], 
        network_data[:iteration_sets]; n_runs=n_runs
    )
    
    # Use first result for subsequent benchmarks
    root_diamonds = results[:root_diamonds].results[1]
    
    # 2. Unique Diamonds
    results[:unique_diamonds] = benchmark_unique_diamonds(
        root_diamonds, network_data[:node_priors], 
        network_data[:ancestors], network_data[:descendants], 
        network_data[:iteration_sets]; n_runs=n_runs
    )
    
    unique_diamonds = results[:unique_diamonds].results[1]
    
    # 3. IPA Algorithm
    results[:ipa_algorithm] = benchmark_ipa_algorithm(
        network_data[:edgelist], network_data[:iteration_sets], 
        network_data[:outgoing_index], network_data[:incoming_index], 
        network_data[:source_nodes], network_data[:node_priors], 
        network_data[:edge_probabilities], network_data[:descendants], 
        network_data[:ancestors], root_diamonds, 
        network_data[:join_nodes], network_data[:fork_nodes], 
        unique_diamonds; n_runs=n_runs
    )
    
    # 4. Monte Carlo (multiple simulation counts)
    results[:monte_carlo] = Dict()
    for sim_count in mc_simulations
        results[:monte_carlo][sim_count] = benchmark_monte_carlo(
            network_data[:edgelist], network_data[:outgoing_index], 
            network_data[:incoming_index], network_data[:source_nodes], 
            network_data[:node_priors], network_data[:edge_probabilities], 
            sim_count; n_runs=n_runs
        )
    end
    
    # 5. Exact Computation (optional - may be too slow)
    if include_exact
        try
            results[:exact_computation] = benchmark_exact_computation(
                network_data[:outgoing_index], network_data[:incoming_index], 
                network_data[:source_nodes], network_data[:node_priors], 
                network_data[:edge_probabilities]; n_runs=n_runs
            )
        catch e
            println("⚠️  Exact computation skipped (too slow or memory intensive): $e")
            results[:exact_computation] = nothing
        end
    end
    
    # Summary
    println("📋 BENCHMARK SUMMARY")
    println("="^50)
    println("Root Diamonds: $(results[:root_diamonds].mean_time) ± $(results[:root_diamonds].std_time) seconds")
    println("Unique Diamonds: $(results[:unique_diamonds].mean_time) ± $(results[:unique_diamonds].std_time) seconds")
    println("IPA Algorithm: $(results[:ipa_algorithm].mean_time) ± $(results[:ipa_algorithm].std_time) seconds")
    
    # Print Monte Carlo results for all simulation counts
    for sim_count in mc_simulations
        mc_result = results[:monte_carlo][sim_count]
        println("Monte Carlo ($sim_count): $(mc_result.mean_time) ± $(mc_result.std_time) seconds")
    end
    if include_exact && results[:exact_computation] !== nothing
        println("Exact Computation: $(results[:exact_computation].mean_time) ± $(results[:exact_computation].std_time) seconds")
    end
    
    return results
end

"""
Create network data structure for benchmarking from individual components
"""
function create_network_data(name, edgelist, outgoing_index, incoming_index, source_nodes, 
                           node_priors, edge_probabilities, descendants, ancestors, 
                           join_nodes, fork_nodes, iteration_sets)
    return Dict(
        :name => name,
        :edgelist => edgelist,
        :outgoing_index => outgoing_index,
        :incoming_index => incoming_index,
        :source_nodes => source_nodes,
        :node_priors => node_priors,
        :edge_probabilities => edge_probabilities,
        :descendants => descendants,
        :ancestors => ancestors,
        :join_nodes => join_nodes,
        :fork_nodes => fork_nodes,
        :iteration_sets => iteration_sets
    )
end

"""
Export benchmark results to CSV for analysis
"""
function export_benchmark_results(results, filename)
    # Create DataFrame with results
    df_data = []
    
    for (component, stats) in results
        if stats !== nothing
            if component == :monte_carlo
                # Handle nested Monte Carlo results
                for (sim_count, mc_stats) in stats
                    for (i, time) in enumerate(mc_stats.all_times)
                        push!(df_data, (
                            component = "monte_carlo_$(sim_count)",
                            run = i,
                            time_seconds = time,
                            memory_mb = mc_stats.all_memories[i] / 1e6
                        ))
                    end
                end
            else
                for (i, time) in enumerate(stats.all_times)
                    push!(df_data, (
                        component = string(component),
                        run = i,
                        time_seconds = time,
                        memory_mb = stats.all_memories[i] / 1e6
                    ))
                end
            end
        end
    end
    
    df = DataFrame(df_data)
    CSV.write(filename, df)
    println("📁 Benchmark results exported to: $filename")
end

"""
Export detailed node-by-node comparison results to CSV
"""
function export_node_comparison_results(ipa_results, mc_results, filename)
    # Create DataFrame with node comparison data
    df_data = []
    
    # Assuming ipa_results is a dictionary of node_id => belief value
    # and mc_results contains dictionaries for different simulation counts
    for (node_id, ipa_value) in ipa_results
        row_data = Dict("node_id" => node_id, "ipa_result" => ipa_value)
        
        # Add Monte Carlo results and errors
        for (sim_count, mc_dict) in mc_results
            if haskey(mc_dict, node_id)
                mc_value = mc_dict[node_id]
                abs_error = abs(ipa_value - mc_value)
                
                if sim_count == 10_000
                    row_data["mc_10k"] = mc_value
                    row_data["abs_error_10k"] = abs_error
                elseif sim_count == 100_000
                    row_data["mc_100k"] = mc_value
                    row_data["abs_error_100k"] = abs_error
                elseif sim_count == 1_000_000
                    row_data["mc_1m"] = mc_value
                    row_data["abs_error_1m"] = abs_error
                end
            end
        end
        
        push!(df_data, row_data)
    end
    
    df = DataFrame(df_data)
    # Sort by node_id for consistent output
    sort!(df, :node_id)
    CSV.write(filename, df)
    println("📁 Node comparison results exported to: $filename")
end

"""
Export benchmark summary to markdown format
"""
function export_markdown_summary(results, network_name, sink_result=nothing, filename="benchmark_results.md")
    open(filename, "w") do f
        # Header
        println(f, "# $(network_name) - Benchmark Results")
        println(f, "")
        println(f, "## Algorithm Performance Summary")
        println(f, "")
        println(f, "| Algorithm | Time | Memory | Accuracy |")
        println(f, "|-----------|------|--------|----------|")
        
        # Root diamonds
        if haskey(results, :root_diamonds) && results[:root_diamonds] !== nothing
            stats = results[:root_diamonds]
            time_str = "$(round(stats.mean_time * 1000, digits=0)) ± $(round(stats.std_time * 1000, digits=0)) ms"
            memory_str = "$(round(stats.mean_memory / 1024^2, digits=1)) MiB"
            println(f, "| Root Diamonds (layer 1) | $time_str | $memory_str | Exact |")
        end
        
        # Unique diamonds
        if haskey(results, :unique_diamonds) && results[:unique_diamonds] !== nothing
            stats = results[:unique_diamonds]
            time_str = "$(round(stats.mean_time * 1000, digits=0)) ± $(round(stats.std_time * 1000, digits=0)) ms"
            memory_str = "$(round(stats.mean_memory / 1024^2, digits=1)) MiB"
            println(f, "| Unique Diamonds (layer 2) | $time_str | $memory_str | Exact |")
        end
        
        # IPA Algorithm
        if haskey(results, :ipa_algorithm) && results[:ipa_algorithm] !== nothing
            stats = results[:ipa_algorithm]
            time_str = "$(round(stats.mean_time * 1000, digits=0)) ms"
            memory_str = "$(round(stats.mean_memory / 1024^2, digits=1)) MiB"
            println(f, "| Reachability (layer 3) | $time_str | $memory_str | Exact |")
        end
        
        # Exact computation
        if haskey(results, :exact_computation)
            if results[:exact_computation] === nothing
                println(f, "| Exact Computation | --- intractable --- | | |")
                println(f, "| Exact Computation Sinkonly | --- intractable --- | | |")
            else
                stats = results[:exact_computation]
                time_str = "$(round(stats.mean_time * 1000, digits=0)) ± $(round(stats.std_time * 1000, digits=0)) ms"
                memory_str = "$(round(stats.mean_memory / 1024^2, digits=1)) MiB"
                println(f, "| Exact Computation | $time_str | $memory_str | Exact |")
            end
        end
        
        # Monte Carlo results
        if haskey(results, :monte_carlo)
            for sim_count in [10_000, 100_000, 1_000_000]
                if haskey(results[:monte_carlo], sim_count)
                    stats = results[:monte_carlo][sim_count]
                    time_str = "$(round(stats.mean_time, digits=0)) ± $(round(stats.std_time, digits=0)) ms"
                    memory_str = "$(round(stats.mean_memory / 1024^2, digits=1)) MiB"
                    sim_label = sim_count == 10_000 ? "10k" : sim_count == 100_000 ? "100k" : "1M"
                    println(f, "| Monte Carlo (N=$(sim_label)) | $time_str | $memory_str | Approximate |")
                end
            end
        end
        
        println(f, "")
        
        # Sink-only result (if provided)
        if sink_result !== nothing
            println(f, "## Exact Computation Sinkonly Result")
            println(f, "node_id|ipa_result|exact_so|abs_error_exact_so|mc_10k|abs_error_10k|mc_100k|abs_error_100k|mc_1m|abs_error_1m")
            if sink_result == :intractable
                println(f, "sink_node| --- intractable --- |")
            else
                println(f, sink_result)
            end
        end
    end
    
    println("📁 Markdown summary exported to: $filename")
end

network_data =  create_network_data(network_name, edgelist, outgoing_index, incoming_index, source_nodes, 
                           node_priors, edge_probabilities, descendants, ancestors, 
                           join_nodes, fork_nodes, iteration_sets);

results =
  benchmark_complete_network(network_data;
  n_runs=3)
  
#=   results =
  benchmark_complete_network(network_data;
  n_runs=3, false) =#

  # Access specific MC results
  mc_10k = results[:monte_carlo][10_000]
  mc_100k = results[:monte_carlo][100_000]
  mc_1m = results[:monte_carlo][1_000_000]

  using CSV
 
  # Export timing benchmark results (original CSV format)
  export_benchmark_results(results, "network_benchmark.csv")
  
  # Extract IPA and Monte Carlo results for node comparison
  # Note: You'll need to modify this based on your actual result structure
  ipa_results = results[:ipa_algorithm].results[1]  # Assuming first result contains node beliefs
  mc_results = Dict()
  
  for sim_count in [10_000, 100_000, 1_000_000]
      if haskey(results[:monte_carlo], sim_count)
          mc_results[sim_count] = results[:monte_carlo][sim_count].results[1]  # Node beliefs
      end
  end
  
  # Generate network-specific filenames
  base_name = replace(network_name, " " => "_", "-" => "_")
  csv_filename = "$(base_name)_combined_results.csv"
  md_filename = "$(base_name)_results.md"
  
  # Export node comparison CSV
  export_node_comparison_results(ipa_results, mc_results, csv_filename)
  
  # Extract sink node result (assuming sink node is the highest numbered node)
  sink_node_id = maximum(keys(ipa_results))  # Or specify 115 directly if known
  sink_result = nothing
  
  if haskey(ipa_results, sink_node_id)
      ipa_val = ipa_results[sink_node_id]
      mc_10k_val = haskey(mc_results, 10_000) && haskey(mc_results[10_000], sink_node_id) ? mc_results[10_000][sink_node_id] : "N/A"
      mc_100k_val = haskey(mc_results, 100_000) && haskey(mc_results[100_000], sink_node_id) ? mc_results[100_000][sink_node_id] : "N/A"
      mc_1m_val = haskey(mc_results, 1_000_000) && haskey(mc_results[1_000_000], sink_node_id) ? mc_results[1_000_000][sink_node_id] : "N/A"
      
      # Calculate errors
      err_10k = mc_10k_val != "N/A" ? abs(ipa_val - mc_10k_val) : "N/A"
      err_100k = mc_100k_val != "N/A" ? abs(ipa_val - mc_100k_val) : "N/A" 
      err_1m = mc_1m_val != "N/A" ? abs(ipa_val - mc_1m_val) : "N/A"
      
      sink_result = "$(sink_node_id)|$(ipa_val)|N/A|N/A|$(mc_10k_val)|$(err_10k)|$(mc_100k_val)|$(err_100k)|$(mc_1m_val)|$(err_1m)"
  else
      sink_result = :intractable
  end
  
  # Export markdown summary with sink-only result
  export_markdown_summary(results, network_name, sink_result, md_filename)