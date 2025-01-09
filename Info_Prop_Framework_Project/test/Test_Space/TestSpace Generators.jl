using .IPAFramework
using Graphs, GraphViz

#= # Read and convert graph, save output
g, orig_matrix, orig_edges, dag_edges, metrics = process_graph_from_csv(
    "csvfiles/metro_undirected.csv", 
    output_dir="csvfiles"
)

# Analyze and visualize
analysis_results = analyze_generated_dag(g, orig_matrix, metrics)
dot_str = visualize_graph(g)
graph = GraphViz.load(IOBuffer(dot_str)) =#


#= # Read and convert graph only - don't save matrix 
g, orig_matrix, orig_edges, dag_edges, metrics = process_graph_from_csv("csvfiles/metro_undirected.csv")

# Same analysis and visualization
analysis_results = analyze_generated_dag(g, orig_matrix, metrics)
dot_str = visualize_graph(g)
graph = GraphViz.load(IOBuffer(dot_str))=#



# Test infrastructure DAG generation
props = InfraProperties(
    500,    # min_nodes
    600,    # max_nodes
    15,     # min_ranks
    20,     # max_ranks
    0.06,   # source_ratio
    0.06,   # sink_ratio
    0.15,   # edge_density
    6,      # skip_distance
    0.3,    # fork_prob
    0.3,    # join_prob
    0.4     # redundancy
);


props = InfraProperties(
    12,    # min_nodes
    20,    # max_nodes
    2,     # min_ranks
    4,     # max_ranks
    0.1,   # source_ratio
    0.1,   # sink_ratio
    0.5,   # edge_density ↑
    2,     # skip_distance ↓
    0.6,   # fork_prob ↑
    0.6,   # join_prob ↑
    0.6    # redundancy ↑
);


props = InfraProperties(
    20,     # min_nodes (↑ increased for more complexity)
    30,     # max_nodes (↑ increased)
    3,      # min_ranks (↑ increased for more layers)
    5,      # max_ranks (↑ increased)
    0.15,   # source_ratio (↑ slightly increased)
    0.15,   # sink_ratio (↑ slightly increased)
    0.6,    # edge_density (↑ increased for more connections)
    3,      # skip_distance (↑ increased to allow more complex paths)
    0.8,    # fork_prob (↑ increased for more diamond starts)
    0.8,    # join_prob (↑ increased for more diamond ends)
    0.7;    # redundancy (↑ increased)
    min_branches = 2,    # min branches in forks/joins
    max_branches = 5,    # max branches (↑ increased)
    fork_density = 0.5,  # ↑ increased chance of forks
    join_density = 0.5,  # ↑ increased chance of joins
    redundancy_min = 2,  # ↑ increased min redundant edges
    redundancy_max = 4   # ↑ increased max redundant edges
)
## Generate graph with both matrix and probabilities
g, rank_labels, nodes_per_rank= generate_infra_dag(
    props,
    save_csv=true,
    save_probs=true,
    output_dir="Info_Prop_Framework_Project/test/GeneratedDatasets/Datasets",
    max_slices=5,
    uniform_slices=false
)


# Analyze generated DAG
analyze_ranked_dag(g, rank_labels, nodes_per_rank)

# Visualize
dot_str = visualize_graph(g,  rank_labels)
graph = GraphViz.load(IOBuffer(dot_str))
