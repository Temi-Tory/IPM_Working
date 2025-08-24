"""
Graph Structure Benchmarking for SDP Development
Compares different graph representations for path enumeration and SDP processing
Based on FullTestAllFiles.jl structure
"""

using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics, Dates, CSV, Graphs

# Include the IPAFramework module for comparison
include("../src/IPAFramework.jl")
using .IPAFramework

# Define different graph representation structures
struct GraphRepresentations{T}
    # Current approach (your existing)
    current_outgoing::Dict{Int64,Set{Int64}}
    current_incoming::Dict{Int64,Set{Int64}}
    current_edgelist::Vector{Tuple{Int64,Int64}}
    
    # Graphs.jl representation
    graphs_jl_graph::SimpleDiGraph
    
    # Sparse matrix representation
    sparse_adjacency::SparseMatrixCSC{Bool, Int64}
    
    # Raw array representation
    adjacency_list::Vector{Vector{Int64}}
    reverse_adjacency_list::Vector{Vector{Int64}}
    
    # Additional data
    node_priors::Dict{Int64,T}
    edge_probabilities::Dict{Tuple{Int64,Int64},T}
    source_nodes::Set{Int64}
    num_nodes::Int64
end

"""
Convert from current representation to all other graph representations
"""
function build_all_representations(network_name::String, data_type::String="float")
    println("Building all graph representations for: $network_name")
    
    # Load using current approach
    base_path = joinpath("dag_ntwrk_files", network_name)
    filepath_graph = joinpath(base_path, network_name * ".EDGES")
    json_network_name = replace(network_name, "_" => "-")
    filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json")
    filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json")
    
    # Current approach (your existing)
    current_edgelist, current_outgoing, current_incoming, source_nodes = read_graph_to_dict(filepath_graph)
    node_priors = read_node_priors_from_json(filepath_node_json)
    edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)
    
    # Get all nodes
    all_nodes = collect(keys(node_priors))
    num_nodes = length(all_nodes)
    println("  Nodes: $num_nodes, Edges: $(length(current_edgelist))")
    
    # Build node mapping (assuming nodes are 1-indexed and consecutive)
    max_node = maximum(all_nodes)
    node_mapping = Dict(node => i for (i, node) in enumerate(sort(all_nodes)))
    reverse_mapping = Dict(i => node for (node, i) in node_mapping)
    
    # 1. Graphs.jl representation
    println("  Building Graphs.jl SimpleDiGraph...")
    graphs_jl_graph = SimpleDiGraph(max_node)
    for (src, dst) in current_edgelist
        add_edge!(graphs_jl_graph, src, dst)
    end
    
    # 2. Sparse matrix representation  
    println("  Building sparse adjacency matrix...")
    I_indices = [src for (src, dst) in current_edgelist]
    J_indices = [dst for (src, dst) in current_edgelist]
    V_values = ones(Bool, length(current_edgelist))
    sparse_adjacency = sparse(I_indices, J_indices, V_values, max_node, max_node)
    
    # 3. Raw array representation (adjacency lists)
    println("  Building adjacency lists...")
    adjacency_list = Vector{Vector{Int64}}(undef, max_node)
    reverse_adjacency_list = Vector{Vector{Int64}}(undef, max_node)
    
    for i in 1:max_node
        adjacency_list[i] = Int64[]
        reverse_adjacency_list[i] = Int64[]
    end
    
    for (src, dst) in current_edgelist
        push!(adjacency_list[src], dst)
        push!(reverse_adjacency_list[dst], src)
    end
    
    # Sort for consistent access patterns
    for i in 1:max_node
        sort!(adjacency_list[i])
        sort!(reverse_adjacency_list[i])
    end
    
    println("  Graph representations built successfully!")
    
    return GraphRepresentations(
        current_outgoing,
        current_incoming, 
        current_edgelist,
        graphs_jl_graph,
        sparse_adjacency,
        adjacency_list,
        reverse_adjacency_list,
        node_priors,
        edge_probabilities,
        source_nodes,
        max_node
    )
end

"""
Helper functions for path enumeration benchmarking
"""
function paths_current_approach(graph_reps::GraphRepresentations, target_node::Int64)
    paths = Vector{Vector{Int64}}()
    for source in graph_reps.source_nodes
        source_paths = find_all_paths_current(graph_reps.current_outgoing, source, target_node)
        append!(paths, source_paths)
    end
    return paths
end

function paths_graphs_jl(graph_reps::GraphRepresentations, target_node::Int64)
    paths = Vector{Vector{Int64}}()
    for source in graph_reps.source_nodes
        source_paths = find_all_simple_paths(graph_reps.graphs_jl_graph, source, target_node)
        for path in source_paths
            push!(paths, path)
        end
    end
    return paths
end

function paths_sparse_matrix(graph_reps::GraphRepresentations, target_node::Int64)
    paths = Vector{Vector{Int64}}()
    for source in graph_reps.source_nodes
        source_paths = find_all_paths_sparse(graph_reps.sparse_adjacency, source, target_node)
        append!(paths, source_paths)
    end
    return paths
end

function paths_adjacency_list(graph_reps::GraphRepresentations, target_node::Int64)
    paths = Vector{Vector{Int64}}()
    for source in graph_reps.source_nodes
        source_paths = find_all_paths_adjacency(graph_reps.adjacency_list, source, target_node)
        append!(paths, source_paths)
    end
    return paths
end

"""
Benchmark path enumeration using different graph representations
"""
function benchmark_path_enumeration(graph_reps::GraphRepresentations, target_node::Int64)
    println("\\nBenchmarking path enumeration to node $target_node:")
    
    # Benchmark each approach
    println("  Current approach (Dict-based):")
    current_time = @benchmark paths_current_approach($graph_reps, $target_node) seconds=10
    current_paths = paths_current_approach(graph_reps, target_node)
    
    println("  Graphs.jl approach:")
    graphs_time = @benchmark paths_graphs_jl($graph_reps, $target_node) seconds=10
    graphs_paths = paths_graphs_jl(graph_reps, target_node)
    
    println("  Sparse matrix approach:")
    sparse_time = @benchmark paths_sparse_matrix($graph_reps, $target_node) seconds=10
    sparse_paths = paths_sparse_matrix(graph_reps, target_node)
    
    println("  Adjacency list approach:")
    adj_time = @benchmark paths_adjacency_list($graph_reps, $target_node) seconds=10
    adj_paths = paths_adjacency_list(graph_reps, target_node)
    
    # Verify all approaches find the same paths
    println("\\n  Verification:")
    println("    Current approach paths: $(length(current_paths))")
    println("    Graphs.jl paths: $(length(graphs_paths))")
    println("    Sparse matrix paths: $(length(sparse_paths))")
    println("    Adjacency list paths: $(length(adj_paths))")
    
    return Dict(
        "current" => (current_time, length(current_paths)),
        "graphs_jl" => (graphs_time, length(graphs_paths)),
        "sparse" => (sparse_time, length(sparse_paths)),
        "adjacency" => (adj_time, length(adj_paths))
    )
end

"""
Path finding implementation for current approach (from your existing code)
"""
function find_all_paths_current(graph::Dict{Int64, Set{Int64}}, start::Int64, target::Int64)
    paths = Vector{Vector{Int64}}()
    visited = Set{Int64}()
    current_path = Int64[]
    
    function dfs(current)
        push!(visited, current)
        push!(current_path, current)
        
        if current == target
            push!(paths, copy(current_path))
        else
            if haskey(graph, current)
                for neighbor in graph[current]
                    if neighbor ∉ visited
                        dfs(neighbor)
                    end
                end
            end
        end
        
        pop!(current_path)
        delete!(visited, current)
    end
    
    dfs(start)
    return paths
end

"""
Path finding implementation using Graphs.jl
"""
function find_all_simple_paths(g::SimpleDiGraph, source::Int64, target::Int64)
    # Use Graphs.jl built-in path enumeration
    # Note: This is a simplified version - Graphs.jl has more sophisticated algorithms
    paths = Vector{Vector{Int64}}()
    
    function dfs_graphs(current, path, visited)
        if current == target
            push!(paths, copy(path))
            return
        end
        
        for neighbor in outneighbors(g, current)
            if neighbor ∉ visited
                push!(path, neighbor)
                push!(visited, neighbor)
                dfs_graphs(neighbor, path, visited)
                pop!(path)
                delete!(visited, neighbor)
            end
        end
    end
    
    visited = Set([source])
    dfs_graphs(source, [source], visited)
    return paths
end

"""
Path finding implementation using sparse matrix
"""
function find_all_paths_sparse(adj_matrix::SparseMatrixCSC, start::Int64, target::Int64)
    paths = Vector{Vector{Int64}}()
    visited = Set{Int64}()
    current_path = Int64[]
    
    function dfs(current)
        push!(visited, current)
        push!(current_path, current)
        
        if current == target
            push!(paths, copy(current_path))
        else
            # Get neighbors from sparse matrix
            for neighbor in findnz(adj_matrix[current, :])[1]
                if neighbor ∉ visited
                    dfs(neighbor)
                end
            end
        end
        
        pop!(current_path)
        delete!(visited, current)
    end
    
    dfs(start)
    return paths
end

"""
Path finding implementation using adjacency list
"""
function find_all_paths_adjacency(adj_list::Vector{Vector{Int64}}, start::Int64, target::Int64)
    paths = Vector{Vector{Int64}}()
    visited = Set{Int64}()
    current_path = Int64[]
    
    function dfs(current)
        push!(visited, current)
        push!(current_path, current)
        
        if current == target
            push!(paths, copy(current_path))
        else
            # Get neighbors from adjacency list
            for neighbor in adj_list[current]
                if neighbor ∉ visited
                    dfs(neighbor)
                end
            end
        end
        
        pop!(current_path)
        delete!(visited, current)
    end
    
    dfs(start)
    return paths
end

"""
Run comprehensive benchmark on multiple networks
"""
function run_comprehensive_benchmark()
    # Test networks of different sizes and characteristics
    test_networks = [
        ("grid-graph", "Small structured network"),
        ("metro_directed_dag_for_ipm", "Medium linear network"),
        ("munin-dag", "Large sparse network"),
        # Add more networks as needed
    ]
    
    results = Dict()
    
    for (network_name, description) in test_networks
        println("\\n" * "="^70)
        println("BENCHMARKING: $network_name")
        println("Description: $description")
        println("="^70)
        
        try
            # Build all representations
            graph_reps = build_all_representations(network_name)
            
            # Select a representative target node (not a source)
            non_source_nodes = setdiff(Set(keys(graph_reps.node_priors)), graph_reps.source_nodes)
            if !isempty(non_source_nodes)
                target_node = first(non_source_nodes)
                
                # Benchmark path enumeration
                benchmark_results = benchmark_path_enumeration(graph_reps, target_node)
                results[network_name] = benchmark_results
                
                # Print summary
                println("\\nSUMMARY for $network_name:")
                for (approach, (timing, path_count)) in benchmark_results
                    avg_time = mean(timing.times) / 1e9  # Convert to seconds
                    println("  $approach: $(round(avg_time*1000, digits=2))ms, $path_count paths")
                end
            else
                println("  No suitable target nodes found for benchmarking")
            end
            
        catch e
            println("  Error processing $network_name: $e")
            continue
        end
    end
    
    return results
end

"""
Run quick benchmark on specific network
"""
function quick_benchmark(network_name::String="grid-graph")
    println("Quick benchmark for: $network_name")
    
    graph_reps = build_all_representations(network_name)
    
    # Select target node
    non_source_nodes = setdiff(Set(keys(graph_reps.node_priors)), graph_reps.source_nodes)
    target_node = first(non_source_nodes)
    
    results = benchmark_path_enumeration(graph_reps, target_node)
    
    println("\\nQuick Benchmark Results:")
    for (approach, (timing, path_count)) in results
        avg_time = mean(timing.times) / 1e9
        println("  $approach: $(round(avg_time*1000, digits=2))ms")
    end
    
    return results
end

# Convenience functions for testing
"""
List available networks for benchmarking
"""
function list_benchmark_networks()
    networks = [
        ("grid-graph", "Small structured 4x4 grid"),
        ("metro_directed_dag_for_ipm", "Medium linear metro network"),
        ("munin-dag", "Large sparse medical network"),
        ("power-network", "Power grid network"),
        ("KarlNetwork", "Karl's test network"),
        ("ergo-proxy-dag-network", "Dense problematic network"),
        ("highland_to_lowland_full_network", "Very dense drone network")
    ]
    
    println("Available networks for benchmarking:")
    println("="^50)
    for (name, description) in networks
        println("• $name")
        println("  $description")
        println()
    end
    
    println("Usage:")
    println("quick_benchmark(\"grid-graph\")")
    println("run_comprehensive_benchmark()")
end

# Example usage:
# list_benchmark_networks()
# quick_benchmark("grid-graph") 
# results = run_comprehensive_benchmark()