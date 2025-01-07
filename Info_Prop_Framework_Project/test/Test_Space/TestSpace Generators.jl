using .IPAFramework
using Graphs, GraphViz

#= # Read and convert graph, save output
g, orig_matrix, orig_edges, dag_edges = process_graph_from_csv("csvfiles/metro_undirected.csv", output_dir="csvfiles")
# Analyze and visualize
analyze_generated_dag(g, orig_matrix)
dot_str = visualize_graph(g)
graph = GraphViz.load(IOBuffer(dot_str)) =#


#= # Read and convert graph only - dont save matrix 
g, orig_matrix, orig_edges, dag_edges = process_graph_from_csv("csvfiles/metro_undirected.csv")

# Same analysis and visualization
analyze_generated_dag(g, orig_matrix)
dot_str = visualize_graph(g)
graph = GraphViz.load(IOBuffer(dot_str)) =#



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
)

# Generate DAG and save
#g, labels, ranks = generate_infra_dag(props, save_csv=true, output_dir="Info_Prop_Framework_Project/test/GeneratedDatasets/Datasets")

# Generate DAG and dont save
g, labels, ranks = generate_infra_dag(props)

# Analyze generated DAG
analyze_ranked_dag(g, labels, ranks)

# Visualize
dot_str = visualize_graph(g,  labels)
graph = GraphViz.load(IOBuffer(dot_str))
