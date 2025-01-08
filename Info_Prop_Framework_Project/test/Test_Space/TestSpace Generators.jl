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
    50,    # min_nodes
    60,    # max_nodes
    5,     # min_ranks
    10,     # max_ranks
    0.06,   # source_ratio
    0.06,   # sink_ratio
    0.15,   # edge_density
    6,      # skip_distance
    0.3,    # fork_prob
    0.3,    # join_prob
    0.4     # redundancy
);

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
