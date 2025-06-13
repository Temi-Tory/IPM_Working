    using Fontconfig: Fontconfig
    using DataFrames, DelimitedFiles, Distributions,
        DataStructures, SparseArrays, BenchmarkTools,
        Combinatorics, IntervalArithmetic, ProbabilityBoundsAnalysis

    # Import framework
    using .IPAFramework

    #filepathcsv = "csvfiles/layereddiamond_3.csv";
    #filepathcsv = "csvfiles/16 NodeNetwork Adjacency matrix.csv";
    #filepathcsv = "csvfiles/Pacific Gas and Electric (Ostrom 2004) simplified Power Distribution Network.csv";
    #filepathcsv = "csvfiles/metro_directed_dag_for_ipm.csv";
    #filepathcsv = "csvfiles/munin/munin_dag.csv";

    #show(edgelist)
    edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);
    # Identify structure
    fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);

  
    # Function to categorize nodes based on outgoing edge count using YOUR data structures
    function categorize_nodes_by_degree(outgoing_index, incoming_index)
        node_types = Dict{Int, Int}()
        
        # Get ALL nodes from incoming_index (captures everyone)
        for (node, incoming_edges) in incoming_index
            # Get outgoing degree (0 if not in outgoing_index - these are terminals)
            out_degree = haskey(outgoing_index, node) ? length(outgoing_index[node]) : 0
            
            if node == 18
                node_types[node] = 0  # Starting Station
            elseif out_degree == 0
                node_types[node] = 4  # Terminal Station
            elseif out_degree <= 2  
                node_types[node] = 1  # Standard Station
            elseif out_degree <= 4
                node_types[node] = 2  # Transfer Station
            else
                node_types[node] = 3  # Major Interchange
            end
        end
        
        return node_types
    end

    # Function to assign node reliabilities (same as before - this one was correct)
    function assign_node_reliabilities!(node_priors, node_types, scenario="standard")
        node_reliability = if scenario == "standard"
            Dict(
                0 => 1.00,  # Starting Station (Source node)
                1 => 0.98,  # Standard Stations (Out. ≤ 2)  
                2 => 0.95,  # Transfer Stations (2 < Out. ≤ 4)
                3 => 0.90,  # Major Interchanges (Out. > 4)
                4 => 0.99   # Terminal Stations (No outgoing)
            )
        else  # disrupted scenario
            Dict(
                0 => 0.95,  # Starting Station (Source node)
                1 => 0.85,  # Standard Stations (Out. ≤ 2)
                2 => 0.80,  # Transfer Stations (2 < Out. ≤ 4) 
                3 => 0.70,  # Major Interchanges (Out. > 4)
                4 => 0.90   # Terminal Stations (No outgoing)
            )
        end
        
        # Assign reliabilities based on node types
        for (node_id, node_type) in node_types
            if haskey(node_priors, node_id)
                node_priors[node_id] = node_reliability[node_type]
            end
        end
    end

    function assign_edge_probabilities!(edge_probabilities, edgelist, node_types, scenario="standard")
        """
        Assign transmission probabilities to edges based on source and destination node types.
        
        Parameters:
        - edge_probabilities: Dictionary to store edge probabilities (will be modified)
        - edgelist: 350-element Vector{Tuple{Int64, Int64}} of (from_node, to_node) pairs
        - node_types: Dictionary mapping node_id to node_type (0-4)
        - scenario: "standard" or "disrupted"
        """
        
        # Define transmission probabilities based on scenario
        if scenario == "standard"
            # Standard scenario probabilities
            prob_type0_any = 0.98      # Starting Station → Any
            prob_type3_type2 = 0.91    # Major Interchange → Transfer
            prob_type3_type1 = 0.92    # Major Interchange → Standard  
            prob_type2_any = 0.93      # Transfer Station → Any
            prob_type1_any = 0.95      # Standard Station → Any
            prob_any_type4 = 0.96      # Any → Terminal Station
        else  # disrupted scenario
            prob_type0_any = 0.90      # Starting Station → Any
            prob_type3_type2 = 0.80    # Major Interchange → Transfer
            prob_type3_type1 = 0.80    # Major Interchange → Standard
            prob_type2_any = 0.85      # Transfer Station → Any
            prob_type1_any = 0.88      # Standard Station → Any
            prob_any_type4 = 0.88      # Any → Terminal Station
        end
        
        # Process each edge in the edgelist
        for (from_node, to_node) in edgelist
            # Get node types
            from_type = node_types[from_node]
            to_type = node_types[to_node]
            
            # Assign probability based on priority rules
            prob = if from_type == 0
                # Rule 1: Starting Station (Type 0) → Any station (highest priority)
                prob_type0_any
            elseif to_type == 4
                # Rule 2: Any type → Terminal Station (Type 4)
                prob_any_type4
            elseif from_type == 3 && to_type == 2
                # Rule 3: Major Interchange (Type 3) → Transfer Station (Type 2)
                prob_type3_type2
            elseif from_type == 3 && to_type == 1
                # Rule 4: Major Interchange (Type 3) → Standard Station (Type 1)
                prob_type3_type1
            elseif from_type == 2
                # Rule 5: Transfer Station (Type 2) → Any station
                prob_type2_any
            elseif from_type == 1
                # Rule 6: Standard Station (Type 1) → Any station
                prob_type1_any
            else
                # Fallback case (shouldn't occur if all node types are 0-4)
                error("Unhandled node type combination: from_type=$from_type, to_type=$to_type")
            end
            
            # Store the probability (indexed by edge tuple)
            edge_probabilities[(from_node, to_node)] = prob
        end
        
        return edge_probabilities
    end

    function setup_metro_reliability!(node_priors, edge_probabilities, edgelist, outgoing_index, scenario="standard")
        # Step 1: Categorize nodes based on their degree using YOUR outgoing_index
        node_types = categorize_nodes_by_degree(outgoing_index, incoming_index)
        
        # Step 2: Assign node reliabilities based on types and scenario
        assign_node_reliabilities!(node_priors, node_types, scenario)
        
        # Step 3: Assign edge transmission probabilities using YOUR edgelist
        assign_edge_probabilities!(edge_probabilities, edgelist, node_types, scenario)
        
        return node_types
    end

    # Print summary function
    function print_reliability_summary(node_priors, edge_probabilities, node_types)
        println("Node Reliability Summary:")
        for type_id in 0:4
            nodes_of_type = [n for (n, t) in node_types if t == type_id]
            if !isempty(nodes_of_type)
                avg_reliability = mean([node_priors[n] for n in nodes_of_type if haskey(node_priors, n)])
                println("  Type $type_id: $(length(nodes_of_type)) nodes, avg reliability = $(round(avg_reliability, digits=3))")
            end
        end
        
        println("\nEdge Transmission Summary:")
        if !isempty(edge_probabilities)
            # Overall stats
            println("  Average transmission probability: $(round(mean(values(edge_probabilities)), digits=3))")
            println("  Min: $(round(minimum(values(edge_probabilities)), digits=3))")  
            println("  Max: $(round(maximum(values(edge_probabilities)), digits=3))")
            println("  Total edges: $(length(edge_probabilities))")
            
            # Breakdown by probability value (base Julia way)
            println("\nEdge breakdown by transmission probability:")
            prob_counts = Dict{Float64, Int}()
            for prob in values(edge_probabilities)
                prob_counts[prob] = get(prob_counts, prob, 0) + 1
            end
            
            for prob in sort(collect(keys(prob_counts)))
                count = prob_counts[prob]
                println("  $(prob): $(count) edges")
            end
            
        end
    end

    # Usage example:
    #node_types = setup_metro_reliability!(node_priors, edge_probabilities, edgelist, outgoing_index, "standard")

    #print_reliability_summary(node_priors, edge_probabilities, node_types)
    # For disrupted conditions scenario  
    # node_types = setup_metro_reliability!(node_priors, edge_probabilities, edgelist, outgoing_index, "disrupted")
    #print_reliability_summary(node_priors, edge_probabilities, node_types)

   #=   #map!(x -> 0.9999, values(node_priors));
    map!(x -> 0.9, values(node_priors));
    map!(x -> 0.9, values(edge_probabilities));
    #map!(x -> 0.9999, values(edge_probabilities)); =#


    # Analyze diamond structures
    diamond_structures= #= @run  =# identify_and_group_diamonds(
        join_nodes,
        ancestors,
        incoming_index,
        source_nodes,
        fork_nodes,
        iteration_sets,
        edgelist,
        descendants,
        node_priors
    );
    #show(diamond_structures)
    #show(diamond_structures[7].diamond[1].subgraph.relevant_nodes)
    #show(diamond_structures[7].non_diamond_parents[1].subgraph.edgelist)
    #
    #@run
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

    sorted_algo = OrderedDict(sort(collect(output)));

  #=   sorted_algo_rounded = OrderedDict(k => round(v, digits=5, RoundNearestTiesUp) for (k,v) in sorted_algo)
    show(sorted_algo_rounded) =#
    #show(sorted_algo)
    #output[16]
    #exact_results[16]

    exact_results = ( path_enumeration_result(
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
    show(sort(df, :AbsDiff, rev=true), allrows=true)




#= 
    using Printf

    # Sort by absolute difference (descending)
    df_sorted = sort(df, :Node, rev=false)

    # Print LaTeX table header
    println("\\begin{longtable}{c c c c c}")
    println("\\caption{IPA Results for Disrupted Berlin Metro Network} \\\\")
    println("\\toprule")
    println("\\textbf{Node} & \\textbf{IPA Value} & \\textbf{Exact Value} & \\textbf{Abs. Error} & \\textbf{Error (\\%)} \\\\")
    println("\\midrule")
    println("\\endfirsthead")
    println("\\multicolumn{5}{c}{\\tablename\\ \\thetable{} -- continued from previous page} \\\\")
    println("\\toprule")
    println("\\textbf{Node} & \\textbf{IPA Value} & \\textbf{Exact Value} & \\textbf{Abs. Error} & \\textbf{Error (\\%)} \\\\")
    println("\\midrule")
    println("\\endhead")

    # Print data rows from DataFrame
    row_count = 0
    for row in eachrow(df_sorted)
        global row_count += 1
        
        node = row.Node
        algo_val = row.AlgoValue
        exact_val = row.ExactValue
        diff = row.AbsDiff
        perc_diff = row.PercError
        
        if diff == 0.0
            diff_str = "0.00"
            perc_str = "0.00000"
        else
            diff_str = @sprintf("\\num{%.2e}", diff)
            perc_str = @sprintf("%.5f", perc_diff)
        end
        
        println("$node & $algo_val & $exact_val & $diff_str & $perc_str \\\\")
    end

    println("\\bottomrule")
    println("\\end{longtable}")
    println("Total rows printed: ", row_count)
=#