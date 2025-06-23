#=
# First, activate the project environment
using Pkg
Pkg.activate(".")

# Add the required packages
Pkg.add([
    "Graphs",
    "Random",
    "DataStructures",
    "Distributions",
    "StatsBase",
    "Statistics",
    "GraphViz"
])

# To ensure the packages persist, we should instantiate the project
Pkg.instantiate()
  =#


using Graphs
using Random
using DataStructures
using Distributions
using StatsBase
using Statistics


#=
INFRASTRUCTURE DAG GENERATOR

Complete implementation of infrastructure network generator with:
- Hierarchical layer structure
- Source/sink node management
- Critical path identification
- Reliability and performance metrics
- Redundancy management
- Comprehensive analysis tools
=#

# Helper function to validate network configuration
function validate_network_config(
    n_nodes::Int,
    n_layers::Int,
    n_source_nodes::Int,
    n_sink_nodes::Int,
    min_edges::Int,
    critical_nodes_per_layer::Vector{Int},
    redundancy_factor::Float64,
    reliability_threshold::Float64
)
    # Basic size validations
    @assert n_nodes > 0 "Number of nodes must be positive"
    @assert n_layers > 0 "Number of layers must be positive"
    @assert length(critical_nodes_per_layer) == n_layers "Must specify critical nodes for each layer"
    
    # Source/sink validations
    @assert n_source_nodes > 0 "Must have at least one source node"
    @assert n_sink_nodes > 0 "Must have at least one sink node"
    @assert n_source_nodes < n_nodes ÷ 10 "Too many source nodes (> 10% of total nodes)"
    @assert n_sink_nodes < n_nodes ÷ 10 "Too many sink nodes (> 10% of total nodes)"
    
    # Critical node validations
    @assert all(x -> x ≥ 0, critical_nodes_per_layer) "Number of critical nodes must be non-negative"
    @assert sum(critical_nodes_per_layer) ≤ n_nodes "Total critical nodes cannot exceed total nodes"
    
    # Edge and connectivity validations
    @assert min_edges ≥ n_nodes "Minimum edges must be ≥ number of nodes"
    @assert 0 ≤ redundancy_factor ≤ 1 "Redundancy factor must be between 0 and 1"
    @assert 0 ≤ reliability_threshold ≤ 1 "Reliability threshold must be between 0 and 1"
end

# Helper function to initialize node properties
function initialize_node_properties(n_nodes::Int)
    properties = Dict{Int, Dict{Symbol, Any}}()
    for node in 1:n_nodes
        properties[node] = Dict{Symbol, Any}(
            :reliability => rand(0.95:0.001:0.999),    # Operational reliability
            :capacity => rand(0.6:0.001:1.0),          # Processing capacity
            :recovery_time => rand(1:24),              # Recovery hours
            :criticality_score => 0.0,                 # Impact score
            :bottleneck_factor => 0.0,                 # Congestion potential
            :redundancy_level => 0,                    # Path redundancy
            :node_type => :normal                      # Default type
        )
    end
    return properties
end

# Function to create edge properties
function create_edge_properties(source_props::Dict{Symbol,Any}, target_props::Dict{Symbol,Any})
    return Dict{Symbol, Any}(
        :reliability => min(source_props[:reliability], target_props[:reliability]),
        :capacity => min(source_props[:capacity], target_props[:capacity]),
        :latency => rand(1:100),               # Transmission delay (ms)
        :bandwidth => rand(100:1000),          # Data/flow rate (Mbps)
        :congestion_factor => rand(0.1:0.01:1.0) # Current load level
    )
end

# Function to add redundant connections
function add_redundant_connections!(
    dag::SimpleDiGraph,
    node::Int,
    node_layers::Dict{Int,Int},
    node_properties::Dict{Int,Dict{Symbol,Any}},
    edge_properties::Dict{Tuple{Int,Int},Dict{Symbol,Any}},
    source_nodes::Set{Int},
    sink_nodes::Set{Int},
    redundancy_factor::Float64
)
    layer = node_layers[node]
    max_layer = maximum(values(node_layers))
    
    # Skip if source or sink
    is_source = node ∈ source_nodes
    is_sink = node ∈ sink_nodes
    
    if !is_source && layer > 1
        # Add connections to previous layer
        prev_layer_nodes = [k for (k,v) in node_layers if v == layer-1]
        n_connections = max(2, round(Int, length(prev_layer_nodes) * redundancy_factor))
        for prev_node in sample(prev_layer_nodes, min(n_connections, length(prev_layer_nodes)), replace=false)
            if !has_path(dag, node, prev_node)  # Maintain DAG property
                add_edge!(dag, prev_node, node)
                edge_properties[(prev_node, node)] = create_edge_properties(
                    node_properties[prev_node], node_properties[node]
                )
            end
        end
    end
    
    if !is_sink && layer < max_layer
        # Add connections to next layer
        next_layer_nodes = [k for (k,v) in node_layers if v == layer+1]
        n_connections = max(2, round(Int, length(next_layer_nodes) * redundancy_factor))
        for next_node in sample(next_layer_nodes, min(n_connections, length(next_layer_nodes)), replace=false)
            if !has_path(dag, next_node, node)  # Maintain DAG property
                add_edge!(dag, node, next_node)
                edge_properties[(node, next_node)] = create_edge_properties(
                    node_properties[node], node_properties[next_node]
                )
            end
        end
        
        # Add skip-layer connections if redundancy is high
        if redundancy_factor > 0.3 && layer < max_layer - 1
            skip_layer_nodes = [k for (k,v) in node_layers if v == layer+2]
            n_skip_connections = round(Int, length(skip_layer_nodes) * redundancy_factor * 0.5)
            if n_skip_connections > 0
                for skip_node in sample(skip_layer_nodes, min(n_skip_connections, length(skip_layer_nodes)), replace=false)
                    if !has_path(dag, skip_node, node)
                        add_edge!(dag, node, skip_node)
                        edge_properties[(node, skip_node)] = create_edge_properties(
                            node_properties[node], node_properties[skip_node]
                        )
                    end
                end
            end
        end
    end
end

# Function to ensure minimum edge count
function ensure_min_edges!(
    dag::SimpleDiGraph,
    min_edges::Int,
    node_layers::Dict{Int,Int},
    node_properties::Dict{Int,Dict{Symbol,Any}},
    edge_properties::Dict{Tuple{Int,Int},Dict{Symbol,Any}},
    source_nodes::Set{Int},
    sink_nodes::Set{Int}
)
    current_edges = ne(dag)
    max_layer = maximum(values(node_layers))
    
    while current_edges < min_edges
        for layer in 1:(max_layer-1)
            layer_nodes = [k for (k,v) in node_layers if v == layer]
            next_layers_nodes = [k for (k,v) in node_layers if layer < v ≤ min(layer+2, max_layer)]
            
            for source in layer_nodes
                if source ∉ sink_nodes
                    for target in next_layers_nodes
                        if target ∉ source_nodes && !has_edge(dag, source, target) && 
                           !has_path(dag, target, source)
                            add_edge!(dag, source, target)
                            edge_properties[(source, target)] = create_edge_properties(
                                node_properties[source], node_properties[target]
                            )
                            current_edges += 1
                            current_edges ≥ min_edges && return
                        end
                    end
                end
            end
        end
        
        # Break if we can't add more edges
        if current_edges == ne(dag)
            @warn "Could not reach minimum edge count while maintaining DAG property"
            break
        end
    end
end

# Function to find critical paths
function find_critical_paths(
    dag::SimpleDiGraph,
    source_nodes::Set{Int},
    sink_nodes::Set{Int},
    edge_properties::Dict{Tuple{Int,Int},Dict{Symbol,Any}}
)
    critical_paths = Vector{Vector{Int}}()
    n = nv(dag)
    
    # Create weight matrix based on reliability
    weights = fill(Inf, n, n)
    for edge in edges(dag)
        # Convert reliability to weight (higher reliability = lower weight)
        weights[edge.src, edge.dst] = 1 - edge_properties[(edge.src, edge.dst)][:reliability]
    end
    
    # Find paths from each source to each sink
    for source in source_nodes
        for sink in sink_nodes
            # Use Dijkstra's algorithm to find shortest path
            dijkstra_result = dijkstra_shortest_paths(dag, source, weights)
            
            # Reconstruct path if one exists
            if dijkstra_result.dists[sink] < Inf
                path = Int[]
                current = sink
                while current != source
                    pushfirst!(path, current)
                    current = dijkstra_result.parents[current]
                end
                pushfirst!(path, source)
                push!(critical_paths, path)
            end
        end
    end
    
    return critical_paths
end

# Calculate node criticality scores
function calculate_node_criticality!(
    dag::SimpleDiGraph,
    node_properties::Dict{Int,Dict{Symbol,Any}},
    node_layers::Dict{Int,Int},
    critical_paths::Vector{Vector{Int}}
)
    n_nodes = nv(dag)
    max_layer = maximum(values(node_layers))
    
    for node in vertices(dag)
        # Based on connectivity
        centrality = length(all_neighbors(dag, node)) / n_nodes
        
        # Based on layer position
        layer_position = node_layers[node] / max_layer
        
        # Based on critical path involvement
        path_involvement = count(path -> node ∈ path, critical_paths) / length(critical_paths)
        
        # Calculate final score
        node_properties[node][:criticality_score] = 
            0.3 * centrality + 
            0.2 * layer_position + 
            0.3 * node_properties[node][:reliability] +
            0.2 * path_involvement
        
        # Calculate redundancy level
        node_properties[node][:redundancy_level] = 
            count(p -> node ∈ p, critical_paths)
    end
end

# Main generator function
function generate_enhanced_infrastructure_dag(;
    n_nodes::Int=350,                     # Total nodes
    n_layers::Int=8,                      # Hierarchy levels
    n_source_nodes::Int=5,                # Source nodes
    n_sink_nodes::Int=8,                  # Sink nodes
    min_edges::Int=800,                   # Minimum connections
    critical_nodes_per_layer::Vector{Int}, # Critical nodes distribution
    redundancy_factor::Float64=0.6,       # Path redundancy control
    connection_types::Vector{Symbol},      # Edge types
    reliability_threshold::Float64=0.98    # Reliability requirement
)
    # Validate configuration
    validate_network_config(n_nodes, n_layers, n_source_nodes, n_sink_nodes,
                          min_edges, critical_nodes_per_layer, redundancy_factor,
                          reliability_threshold)
    
    # Initialize structures
    dag = SimpleDiGraph(n_nodes)
    node_properties = initialize_node_properties(n_nodes)
    edge_properties = Dict{Tuple{Int,Int}, Dict{Symbol, Any}}()
    node_layers = Dict{Int,Int}()
    node_types = Dict{Int,Symbol}()
    edge_types = Dict{Tuple{Int,Int},Symbol}()
    source_nodes = Set{Int}()
    sink_nodes = Set{Int}()
    
    # Distribute nodes across layers
    nodes_per_layer = div(n_nodes, n_layers)
    remaining_nodes = n_nodes % n_layers
    current_node = 1
    
    for layer in 1:n_layers
        layer_size = nodes_per_layer + (layer ≤ remaining_nodes ? 1 : 0)
        critical_count = critical_nodes_per_layer[layer]
        
        for node_idx in 1:layer_size
            node_layers[current_node] = layer
            node_types[current_node] = node_idx ≤ critical_count ? :critical : :normal
            current_node += 1
        end
    end
    
    # Designate source and sink nodes
    layer1_nodes = [k for (k,v) in node_layers if v == 1]
    source_candidates = layer1_nodes[1:min(length(layer1_nodes), n_source_nodes)]
    for node in source_candidates
        push!(source_nodes, node)
        node_properties[node][:node_type] = :source
    end
    
    last_layer_nodes = [k for (k,v) in node_layers if v == n_layers]
    sink_candidates = last_layer_nodes[1:min(length(last_layer_nodes), n_sink_nodes)]
    for node in sink_candidates
        push!(sink_nodes, node)
        node_properties[node][:node_type] = :sink
    end
    
    # Add basic connectivity with redundancy
    for node in vertices(dag)
        add_redundant_connections!(dag, node, node_layers, node_properties,
                                 edge_properties, source_nodes, sink_nodes,
                                 redundancy_factor)
    end
    
    # Ensure minimum edge count
    ensure_min_edges!(dag, min_edges, node_layers, node_properties,
                     edge_properties, source_nodes, sink_nodes)
    
    # Find critical paths
    critical_paths = find_critical_paths(dag, source_nodes, sink_nodes, edge_properties)
    
    # Calculate node criticality
    calculate_node_criticality!(dag, node_properties, node_layers, critical_paths)
    
    # Assign edge types
    for edge in edges(dag)
        edge_types[(edge.src, edge.dst)] = rand(connection_types)
    end
    
    return (
        graph=dag,
        node_layers=node_layers,
        node_types=node_types,
        edge_types=edge_types,
        node_properties=node_properties,
        edge_properties=edge_properties,
        source_nodes=source_nodes,
        sink_nodes=sink_nodes,
        critical_paths=critical_paths,
        metrics=Dict{Symbol,Any}(
            :avg_reliability => mean([p[:reliability] for p in values(node_properties)]),
            :total_capacity => sum([p[:capacity] for p in values(node_properties)]),
            :critical_path_count => length(critical_paths),
            :avg_node_criticality => mean([p[:criticality_score] for p in values(node_properties)]),
            :network_density => ne(dag)/nv(dag),
            :source_sink_ratio => length(source_nodes)/length(sink_nodes),
            :redundancy_level => mean([p[:redundancy_level] for p in values(node_properties)])
        )
    )
end

"""
Print a structured view of the DAG and its properties
"""
function print_dag_structure(dag_result)
    println("\n=== DAG Structure Analysis ===")
    
    # Basic Graph Info
    println("\nGraph Statistics:")
    println("---------------")
    println("Total Nodes: ", nv(dag_result.graph))
    println("Total Edges: ", ne(dag_result.graph))
    
    # Layer Distribution
    println("\nLayer Distribution:")
    println("-----------------")
    layer_counts = counter(values(dag_result.node_layers))
    for (layer, count) in sort(collect(layer_counts))
        # Count node types in this layer
        nodes_in_layer = [n for (n,l) in dag_result.node_layers if l == layer]
        type_counts = counter([dag_result.node_types[n] for n in nodes_in_layer])
        type_str = join(["$t:$c" for (t,c) in type_counts], ", ")
        println("Layer $layer: $count nodes ($type_str)")
    end
    
    # Source/Sink Information
    println("\nNetwork Endpoints:")
    println("----------------")
    println("Source Nodes ($(length(dag_result.source_nodes))): ", 
            sort(collect(dag_result.source_nodes)))
    println("Sink Nodes ($(length(dag_result.sink_nodes))): ", 
            sort(collect(dag_result.sink_nodes)))
    
    # Connection Analysis
    println("\nConnectivity Analysis:")
    println("-------------------")
    avg_out_degree = mean(outdegree(dag_result.graph))
    avg_in_degree = mean(indegree(dag_result.graph))
    println("Average Out-degree: ", round(avg_out_degree, digits=2))
    println("Average In-degree: ", round(avg_in_degree, digits=2))
    
    # Edge Type Distribution
    if haskey(dag_result, :edge_types)
        println("\nEdge Type Distribution:")
        println("--------------------")
        type_counts = counter(values(dag_result.edge_types))
        total_edges = sum(values(type_counts))
        for (type, count) in sort(collect(type_counts))
            percentage = round(count/total_edges * 100, digits=1)
            println("$type: $count edges ($percentage%)")
        end
    end
end

# Example usage
dag = generate_enhanced_infrastructure_dag(
    n_nodes=350,
    n_layers=8,
    n_source_nodes=5,
    n_sink_nodes=8,
    critical_nodes_per_layer=[25,30,35,40,35,30,25,20],
    redundancy_factor=0.6,
    connection_types=[:physical, :logical, :dependency, :backup, :monitoring, :control],
    reliability_threshold=0.98,
    min_edges=800
)

# Print the structure
print_dag_structure(dag)



# Generate the DAG
dag = generate_enhanced_infrastructure_dag(
    n_nodes=350,
    n_layers=8,
    n_source_nodes=5,
    n_sink_nodes=8,
    critical_nodes_per_layer=[25,30,35,40,35,30,25,20],
    redundancy_factor=0.6,
    connection_types=[:physical, :logical, :dependency, :backup, :monitoring, :control],
    reliability_threshold=0.98,
    min_edges=800
)

# Compute node degrees and capacities
node_degrees = [length(all_neighbors(dag.graph, n)) for n in vertices(dag.graph)]
#node_capacities = [node_properties[n][:capacity] for n in vertices(dag.graph)]

# Normalize capacities for color mapping
#= min_capacity = minimum(node_capacities)
max_capacity = maximum(node_capacities)
=#
#normalized_capacities = (node_capacities .- min_capacity) ./ (max_capacity - min_capacity)




# Print some additional information
println("\nNetwork Analysis:")
println("Total Nodes: ", nv(dag.graph))
println("Total Edges: ", ne(dag.graph))
println("\nNode Degree Statistics:")
println("Min Degree: ", minimum(node_degrees))
println("Max Degree: ", maximum(node_degrees))
println("Mean Degree: ", mean(node_degrees))

println("\nEdge Type Distribution:")
type_counts = counter(values(dag.edge_types))
total_edges = sum(values(type_counts))
for (type, count) in sort(collect(type_counts))
    percentage = round(count/total_edges * 100, digits=1)
    println("$type: $count edges ($percentage%)")
end

is_cyclic(    dag.graph)