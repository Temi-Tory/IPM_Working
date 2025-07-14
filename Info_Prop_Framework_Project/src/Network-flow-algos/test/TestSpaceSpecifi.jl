import Fontconfig 
using DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics
import ProbabilityBoundsAnalysis

# Create aliases to avoid ambiguity
const PBA = ProbabilityBoundsAnalysis
const pbox = ProbabilityBoundsAnalysis.pbox

current_dir = pwd()

# Include the IPAFramework module
include("../src/IPAFramework.jl")
using .IPAFramework

#network_name = "KarlNetwork";
network_name = "real_drone_network";
data_type = "float";
base_path = joinpath("dag_ntwrk_files", network_name);
filepath_graph = joinpath(base_path, network_name * ".EDGES");
json_network_name = replace(network_name, "_" => "-") ; # Convert underscores to hyphens for JSON files
filepath_node_json = joinpath(base_path, data_type, json_network_name * "-nodepriors.json");
filepath_edge_json = joinpath(base_path, data_type, json_network_name * "-linkprobabilities.json");
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph);
node_priors = read_node_priors_from_json(filepath_node_json);
edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json);
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);

#map!(x -> 1.0, values(node_priors));

diamond_structures = identify_and_group_diamonds(
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


#= struct Diamond
        relevant_nodes::Set{Int64}
        highest_nodes::Set{Int64}
        edgelist::Vector{Tuple{Int64, Int64}}
    end

    """
    Represents diamonds and non-diamond parents at a specific join node.
    """
    struct DiamondsAtNode
        diamond::Vector{Diamond}
        non_diamond_parents::Set{Int64}
        join_node::Int64
    end 
=#
one_value(::Type{Float64}) = 1.0
function getInnerDiamonds(
        conditioning_nodes::Set{Int64},
        join_node::Int64,
        diamond::Diamond,
        node_priors::Dict{Int64,T},
        ancestors::Dict{Int64, Set{Int64}},
        descendants::Dict{Int64, Set{Int64}},
        iteration_sets::Vector{Set{Int64}}
    ) where {T <: Union{Float64, pbox, Interval}}

              
        # Create fresh outgoing and incoming indices for the diamond
        sub_outgoing_index = Dict{Int64, Set{Int64}}()
        sub_incoming_index = Dict{Int64, Set{Int64}}()

        for (i, j) in diamond.edgelist
            push!(get!(sub_outgoing_index, i, Set{Int64}()), j)
            push!(get!(sub_incoming_index, j, Set{Int64}()), i)
        end

        fresh_sources = Set{Int64}()
        for node in keys(sub_outgoing_index)
            if !haskey(sub_incoming_index, node) || isempty(sub_incoming_index[node])
                push!(fresh_sources, node)
            end
        end
        
        #sub_fork_nodes = Set{Int64}() => nodes with more than one outgoing edge
        sub_fork_nodes = Set{Int64}()
        for (node, targets) in sub_outgoing_index
            if length(targets) > 1
                push!(sub_fork_nodes, node)
            end
        end
        #sub_join_nodes = Set{Int64}() => nodes with more than one incoming edge
        sub_join_nodes = Set{Int64}()
        for (node, sources) in sub_incoming_index
            if length(sources) > 1
                push!(sub_join_nodes, node)
            end
        end

        #create sub_ancestors and sub_descendants by filtering the original ancestors and descendants by relevnat nodes 
        sub_ancestors = Dict{Int64, Set{Int64}}()
        sub_descendants = Dict{Int64, Set{Int64}}()
        for node in diamond.relevant_nodes            
            # Filter ancestors and descendants to only include relevant nodes
            sub_ancestors[node] = Set{Int64}(intersect(ancestors[node], diamond.relevant_nodes))
            sub_descendants[node] = Set{Int64}(intersect(descendants[node], diamond.relevant_nodes))
        end

        #get fresh sub_iteration_sets by filtering the original iteration sets by relevant nodes and removing emty iter sets
        sub_iteration_sets = Vector{Set{Int64}}()
        for iter_set in iteration_sets
            filtered_set = Set{Int64}(intersect(iter_set, diamond.relevant_nodes))
            if !isempty(filtered_set)
                push!(sub_iteration_sets, filtered_set)
            end
        end


        # Create sub_node_priors for the diamond nodes
        sub_node_priors = Dict{Int64, T}()
        for node in diamond.relevant_nodes
            if node ∉ fresh_sources
                sub_node_priors[node] = node_priors[node]
                if node == join_node
                    # If the node is the join node, set its prior to 1.0
                    sub_node_priors[node] =  one_value(T)
                end
            elseif node ∉ conditioning_nodes
                sub_node_priors[node] = 0.9 #using fixed non  1 or 0 float vlaues here for testing will  Use the actual here belief_dict for fresh sources that aret conditioning nodes
            elseif node ∈ conditioning_nodes
                sub_node_priors[node] = one_value(T)    ## Set conditioning nodes to 1.0 so that diamonds identifcation works
            end
        end

        return identify_and_group_diamonds(
            sub_join_nodes,
            sub_incoming_index,
            sub_ancestors,
            sub_descendants,
            fresh_sources,
            sub_fork_nodes,
            diamond.edgelist,
            sub_node_priors,
            sub_iteration_sets
        )
end
#= # For each diamond structure in the dictionary, print inner diamonds
for (join_node, ds) in diamond_structures
    println("Diamond structure for join node $join_node:")
    for diamond in ds.diamond
        inner_diamonds = getInnerDiamonds(
            Set{Int64}(),
            ds.join_node,
            diamond,
            node_priors,
            ancestors,
            descendants,
            iteration_sets
        )
        println("Inner diamonds for join node $(ds.join_node):")
        for inner_diamond in inner_diamonds
            println(inner_diamond)
        end
    end
end =#


# Vertex cut analysis functions
function find_diamond_vertex_cut(
    diamond_join_node::Int64,
    diamond_parents::Set{Int64},
    source_nodes::Set{Int64},
    ancestors::Dict{Int64, Set{Int64}},
    descendants::Dict{Int64, Set{Int64}}
)
    # Find all intermediate nodes between sources and diamond parents
    intermediate_nodes = Set{Int64}()
    
    for parent in diamond_parents
        for source in source_nodes
            # All nodes that are descendants of source AND ancestors of parent
            path_nodes = intersect(descendants[source], ancestors[parent])
            union!(intermediate_nodes, path_nodes)
        end
    end
    
    # Remove sources, parents, and join node from intermediate nodes
    setdiff!(intermediate_nodes, source_nodes)
    setdiff!(intermediate_nodes, diamond_parents)
    setdiff!(intermediate_nodes, Set([diamond_join_node]))
    
    # Greedy vertex cut selection
    cut_candidates = copy(intermediate_nodes)
    minimum_cut = Set{Int64}()
    
    # Build remaining paths to cut
    remaining_paths = Set{Tuple{Int64, Int64}}()
    for parent in diamond_parents
        for source in source_nodes
            push!(remaining_paths, (source, parent))
        end
    end
    
    while !isempty(remaining_paths)
        best_node = nothing
        best_cut_count = 0
        
        for candidate in cut_candidates
            if candidate in minimum_cut
                continue
            end
            
            cut_count = 0
            for (source, parent) in remaining_paths
                if candidate in ancestors[parent] && candidate in descendants[source]
                    cut_count += 1
                end
            end
            
            if cut_count > best_cut_count
                best_cut_count = cut_count
                best_node = candidate
            end
        end
        
        if best_node === nothing || best_cut_count == 0
            break
        end
        
        push!(minimum_cut, best_node)
        
        # Remove paths that this node cuts
        paths_to_remove = Set{Tuple{Int64, Int64}}()
        for (source, parent) in remaining_paths
            if best_node in ancestors[parent] && best_node in descendants[source]
                push!(paths_to_remove, (source, parent))
            end
        end
        setdiff!(remaining_paths, paths_to_remove)
    end
    
    return minimum_cut, intermediate_nodes
end

function test_cut_effectiveness(
    diamond::Diamond,
    cut_set::Set{Int64},
    ancestors::Dict{Int64, Set{Int64}},
    descendants::Dict{Int64, Set{Int64}},
    iteration_sets::Vector{Set{Int64}}
)
    # Build diamond subgraph structures (same as your getInnerDiamonds)
    sub_outgoing_index = Dict{Int64, Set{Int64}}()
    sub_incoming_index = Dict{Int64, Set{Int64}}()
    
    for (i, j) in diamond.edgelist
        push!(get!(sub_outgoing_index, i, Set{Int64}()), j)
        push!(get!(sub_incoming_index, j, Set{Int64}()), i)
    end
    
    fresh_sources = Set{Int64}()
    for node in keys(sub_outgoing_index)
        if !haskey(sub_incoming_index, node) || isempty(sub_incoming_index[node])
            push!(fresh_sources, node)
        end
    end
    
    sub_fork_nodes = Set{Int64}()
    for (node, targets) in sub_outgoing_index
        if length(targets) > 1
            push!(sub_fork_nodes, node)
        end
    end
    
    sub_join_nodes = Set{Int64}()
    for (node, sources) in sub_incoming_index
        if length(sources) > 1
            push!(sub_join_nodes, node)
        end
    end
    
    sub_ancestors = Dict{Int64, Set{Int64}}()
    sub_descendants = Dict{Int64, Set{Int64}}()
    for node in diamond.relevant_nodes
        sub_ancestors[node] = intersect(ancestors[node], diamond.relevant_nodes)
        sub_descendants[node] = intersect(descendants[node], diamond.relevant_nodes)
    end
    
    sub_iteration_sets = Vector{Set{Int64}}()
    for iter_set in iteration_sets
        filtered_set = intersect(iter_set, diamond.relevant_nodes)
        if !isempty(filtered_set)
            push!(sub_iteration_sets, filtered_set)
        end
    end
    
    # Test with cut set conditioning
    sub_node_priors = Dict{Int64, Float64}()
    for node in diamond.relevant_nodes
        if node in cut_set
            sub_node_priors[node] = 1.0  # Cut set nodes conditioned to true
        else
            sub_node_priors[node] = 0.5  # Others get dummy values
        end
    end
    
    # Call identify_and_group_diamonds with cut set
    cut_result = identify_and_group_diamonds(
        sub_join_nodes,
        sub_incoming_index,
        sub_ancestors,
        sub_descendants,
        fresh_sources,
        sub_fork_nodes,
        diamond.edgelist,
        sub_node_priors,
        sub_iteration_sets
    )
    
    return isempty(cut_result)  # True if no diamonds found (success!)
end

# Main analysis replacing your inner diamonds loop
println("=== VERTEX CUT ANALYSIS FOR ALL DIAMONDS ===\n")

total_diamonds = 0
successful_cuts = 0
total_original_conditioning = 0
total_cut_conditioning = 0

for (join_node, ds) in diamond_structures
    println("Join Node $join_node:")
    println("  Number of diamonds: $(length(ds.diamond))")
    
    for (diamond_idx, diamond) in enumerate(ds.diamond)
        total_diamonds += 1
        
        println("\n  Diamond $diamond_idx:")
        println("    Relevant nodes: $(length(diamond.relevant_nodes)) nodes")
        println("    Original conditioning: $(length(diamond.highest_nodes)) nodes: $(diamond.highest_nodes)")
        total_original_conditioning += length(diamond.highest_nodes)
        
        # Find parents of join node within this diamond
        diamond_parents = Set{Int64}()
        if haskey(incoming_index, join_node)
            diamond_parents = intersect(incoming_index[join_node], diamond.relevant_nodes)
        end
        println("    Diamond parents: $diamond_parents")
        
        # Find vertex cut
        cut_set, intermediate_nodes = find_diamond_vertex_cut(
            join_node,
            diamond_parents,
            source_nodes,
            ancestors,
            descendants
        )
        
        println("    Intermediate nodes: $(length(intermediate_nodes))")
        println("    Vertex cut: $(length(cut_set)) nodes: $cut_set")
        
        # Build diamond subgraph structures for testing
        sub_outgoing_index = Dict{Int64, Set{Int64}}()
        sub_incoming_index = Dict{Int64, Set{Int64}}()
        
        for (i, j) in diamond.edgelist
            push!(get!(sub_outgoing_index, i, Set{Int64}()), j)
            push!(get!(sub_incoming_index, j, Set{Int64}()), i)
        end
        
        fresh_sources = Set{Int64}()
        for node in keys(sub_outgoing_index)
            if !haskey(sub_incoming_index, node) || isempty(sub_incoming_index[node])
                push!(fresh_sources, node)
            end
        end
        
        sub_fork_nodes = Set{Int64}()
        for (node, targets) in sub_outgoing_index
            if length(targets) > 1
                push!(sub_fork_nodes, node)
            end
        end
        
        sub_join_nodes = Set{Int64}()
        for (node, sources) in sub_incoming_index
            if length(sources) > 1
                push!(sub_join_nodes, node)
            end
        end
        
        sub_ancestors = Dict{Int64, Set{Int64}}()
        sub_descendants = Dict{Int64, Set{Int64}}()
        for node in diamond.relevant_nodes
            sub_ancestors[node] = intersect(ancestors[node], diamond.relevant_nodes)
            sub_descendants[node] = intersect(descendants[node], diamond.relevant_nodes)
        end
        
        sub_iteration_sets = Vector{Set{Int64}}()
        for iter_set in iteration_sets
            filtered_set = intersect(iter_set, diamond.relevant_nodes)
            if !isempty(filtered_set)
                push!(sub_iteration_sets, filtered_set)
            end
        end
        
        # Test with cut set conditioning
        sub_node_priors = Dict{Int64, Float64}()
        for node in diamond.relevant_nodes
            if node in cut_set
                sub_node_priors[node] = 1.0  # Cut set nodes conditioned to true
            else
                sub_node_priors[node] = 0.5  # Others get dummy values
            end
        end
        
        # Test if the cut actually works
        cut_result = identify_and_group_diamonds(
            sub_join_nodes,
            sub_incoming_index,
            sub_ancestors,
            sub_descendants,
            fresh_sources,
            sub_fork_nodes,
            diamond.edgelist,
            sub_node_priors,
            sub_iteration_sets
        )
        
        cut_success = isempty(cut_result)
        
        if cut_success
            successful_cuts += 1
            total_cut_conditioning += length(cut_set)
            
            original_complexity = 2^length(diamond.highest_nodes)
            cut_complexity = 2^length(cut_set)
            improvement = original_complexity / cut_complexity
            
            println("    ✓ CUT SUCCESS: $(length(diamond.highest_nodes)) → $(length(cut_set)) conditioning nodes")
            println("    ✓ Complexity: $original_complexity → $cut_complexity ($(improvement)x improvement)")
            println("    ✓ identify_and_group_diamonds returned EMPTY with cut set!")
        else
            total_cut_conditioning += length(diamond.highest_nodes)  # Use original
            println("    ✗ CUT FAILED: identify_and_group_diamonds still found diamonds")
            
            # Analyze the remaining structure
            total_remaining_diamonds = sum(length(ds.diamond) for (_, ds) in cut_result)
            remaining_relevant_nodes = sum(sum(length(d.relevant_nodes) for d in ds.diamond) for (_, ds) in cut_result)
            
            println("    ✗ Original: 1 diamond with $(length(diamond.relevant_nodes)) relevant nodes")
            println("    ✗ After cut: $total_remaining_diamonds diamonds with $remaining_relevant_nodes total relevant nodes")
            
            if total_remaining_diamonds > 1
                avg_diamond_size = remaining_relevant_nodes / total_remaining_diamonds
                println("    ⚠️  POTENTIAL BENEFIT: Split into $total_remaining_diamonds smaller diamonds (avg $(round(avg_diamond_size, digits=1)) nodes each)")
                
                # Check if this reduces complexity
                original_recursive_complexity = length(diamond.relevant_nodes)  # Nodes that would be recursively processed
                cut_recursive_complexity = remaining_relevant_nodes  # Total nodes in all remaining diamonds
                
                if cut_recursive_complexity < original_recursive_complexity
                    reduction = original_recursive_complexity - cut_recursive_complexity
                    println("    ✓ RECURSION REDUCTION: $(original_recursive_complexity) → $(cut_recursive_complexity) nodes (-$reduction nodes)")
                else
                    println("    ✗ No recursion reduction")
                end
            end
            
            println("    ✗ Remaining diamonds after cut:")
            for (remaining_join, remaining_ds) in cut_result
                println("      Join $remaining_join: $(length(remaining_ds.diamond)) diamonds")
                for (i, remaining_diamond) in enumerate(remaining_ds.diamond)
                    println("        Diamond $i: $(length(remaining_diamond.relevant_nodes)) nodes, conditioning=$(remaining_diamond.highest_nodes)")
                end
            end
            println("    ✗ Using original conditioning")
        end
    end
    println()
end

# Summary
println("=== OVERALL RESULTS ===")
println("Total diamonds analyzed: $total_diamonds")
println("Successful vertex cuts: $successful_cuts / $total_diamonds")
println("Success rate: $(round(successful_cuts/total_diamonds*100, digits=1))%")
println()
println("Conditioning nodes:")
println("  Original total: $total_original_conditioning")
println("  Cut-based total: $total_cut_conditioning")

if total_cut_conditioning < total_original_conditioning
    node_reduction = total_original_conditioning - total_cut_conditioning
    println("  Node reduction: $node_reduction")
    println("  Complexity improvement: 2^$total_original_conditioning → 2^$total_cut_conditioning")
    println("✓ VERTEX CUTS PROVIDE OVERALL IMPROVEMENT!")
else
    println("✗ No overall improvement from vertex cuts")
end