import Fontconfig
using DataFrames, DelimitedFiles, Distributions,
      DataStructures, SparseArrays, BenchmarkTools,
      Combinatorics


using Pkg
Pkg.activate("C:/Users/ohian/OneDrive - University of Strathclyde/Documents/Programmming Files/Julia Files/InformationPropagation/Info_Prop_Framework_Project")

# Import framework - corrected path
include("IPAFramework.jl")
using .IPAFramework



#user input from ui for eg 

#filepathcsv = "csvfiles/layereddiamond_3.csv";
filepathcsv = "csvfiles/KarlNetwork.csv";
#filepathcsv = "csvfiles/real_drone_network_integrated_adjacency.csv";
#filepathcsv = "csvfiles/16 NodeNetwork Adjacency matrix.csv"; # 4 by 4 grid
#filepathcsv = "csvfiles/Power Distribution Network.csv"; 
#filepathcsv = "csvfiles/metro_directed_dag_for_ipm.csv";
#filepathcsv = "csvfiles/ergo_proxy_dag_network.csv";



#THIS FILE IS GLOBAL TO THE ENTIRE USER SESSION UNLESS THEY UPLAD ANOTHER FILE 
# THE STRUCTURAL DETAIL TAB SHOWS THE STRUCTURE OF THE GRAPH
#THE vISUALIZATION tAB  SHOWS RAPH IN DOT FORMAT INTERCTIVE 
#fork_nodes, join_nodes , edgelist, outgoing_index, incoming_index, source_nodes, iteration_sets, ancestors, descendant
edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);

#CAN USE USER PORVIDE OR TWEAK MASS  OR TWEAK INDICUDLA AFTER EITHER OF THE THE WORK 
map!(x -> 1.0, values(node_priors));
map!(x -> 0.9, values(edge_probabilities));

# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);


#DIAMOND VISAULIZTAION WITHD IFFGERNET DIRLL DOWNS

diamond_structures= identify_and_group_diamonds(
    join_nodes,
    incoming_index,
    ancestors,
    descendants,
    source_nodes,
    fork_nodes,
    edgelist,
    node_priors
);

#= # Exhaustive classification for each diamond
for (join_node, diamonds_at_node) in diamond_structures
    for (i, diamond) in enumerate(diamonds_at_node.diamond)
        classification = classify_diamond_exhaustive(
            diamond, join_node,
            edgelist, outgoing_index, incoming_index, source_nodes,
            fork_nodes, join_nodes, iteration_sets, ancestors, descendants
        )
        
        println("Join Node $join_node, Diamond $i:")
        println("  Fork Structure: $(classification.fork_structure)")
        println("  Internal Structure: $(classification.internal_structure)")
        println("  Path Topology: $(classification.path_topology)")
        println("  Join Structure: $(classification.join_structure)")
        println("  External Connectivity: $(classification.external_connectivity)")
        println("  Forks: $(classification.fork_count), Size: $(classification.subgraph_size)")
        println("  Optimization: $(classification.optimization_potential)")
        println()
    end
end =#

 
#rEACHABILITY ANALSYSIS TAB
(
output =  update_beliefs_iterative(
    edgelist,
    iteration_sets, 
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors, 
    edge_probabilities,
    descendants,
    ancestors, 
    diamond_structures,
    join_nodes,
    fork_nodes
));
sorted_algo = OrderedDict(sort(collect(output)))
#output[205]

#= exact_results = ( path_enumeration_result(
            outgoing_index,
            incoming_index,
            source_nodes,
            node_priors,
            edge_probabilities
        ));

    sorted_exact = OrderedDict(sort(collect(exact_results)));

    # Create base DataFrame using the float values directly
   df = DataFrame(
    Node = collect(keys(sorted_algo)),
    AlgoValue = collect(values(sorted_algo)),
    ExactValue = collect(values(sorted_exact))
)

# Add absolute difference
df.AbsDiff = abs.(df.AlgoValue .- df.ExactValue)

# Add percentage error: (|algo - exact| / exact) * 100
df.PercError = (df.AbsDiff ./ abs.(df.ExactValue)) .* 100

    # Display sorted result (if you want to sort by the difference)
    show(sort(df, :AbsDiff, rev=true), allrows=true) =#

    
mc_results = (MC_result(
    edgelist,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    5_00_000,
));


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
