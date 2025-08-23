"""
Combine Results Analysis
Combines MC and IPA results to calculate absolute errors for network analysis
"""

using DataFrames, CSV, Statistics

function load_result_dict(filepath)
    """Load result dictionary from file - handles both Dict format and raw values"""
    content = read(filepath, String)
    
    # Parse the Dict format
    try
        # Remove "Dict(" and final ")"
        dict_content = strip(content)
        if startswith(dict_content, "Dict(") && endswith(dict_content, ")")
            dict_content = dict_content[6:end-1]  # Remove "Dict(" and ")"
            
            # Parse key-value pairs
            result_dict = Dict{Int64, Float64}()
            
            # Split by commas, but be careful with decimals
            pairs = split(dict_content, ", ")
            
            for pair in pairs
                parts = split(strip(pair), " => ")
                if length(parts) == 2
                    node_id = parse(Int64, strip(parts[1]))
                    value = parse(Float64, strip(parts[2]))
                    result_dict[node_id] = value
                end
            end
            
            return result_dict
        else
            error("Invalid dictionary format in file: $filepath")
        end
    catch e
        println("Error parsing file $filepath: $e")
        return Dict{Int64, Float64}()
    end
end

function combine_all_results(network_name="hierarchical_drone_medical")
    """Combine all result files into a comprehensive comparison DataFrame"""
    
    println("📊 Combining results for network: $network_name")
    
    # Load all result dictionaries
    println("Loading IPA algorithm result...")
    ipa_result = load_result_dict("output_herichal.txt")
    
    println("Loading Monte Carlo results...")
    mc_10k = load_result_dict("mc_10_000.txt")
    mc_100k = load_result_dict("mc_100_000.txt") 
    mc_1m = load_result_dict("mc1mill.txt")
    
    # Get all unique node IDs
    all_nodes = Set{Int64}()
    for dict in [ipa_result, mc_10k, mc_100k, mc_1m]
        union!(all_nodes, keys(dict))
    end
    all_nodes = sort(collect(all_nodes))
    
    println("Found $(length(all_nodes)) nodes across all results")
    
    # Create DataFrame
    df_data = []
    
    for node in all_nodes
        # Get values (use 0.0 if node not present in a result)
        ipa_val = get(ipa_result, node, 0.0)
        mc_10k_val = get(mc_10k, node, 0.0)
        mc_100k_val = get(mc_100k, node, 0.0)
        mc_1m_val = get(mc_1m, node, 0.0)
        
        # Calculate absolute errors compared to IPA algorithm
        abs_error_10k = abs(ipa_val - mc_10k_val)
        abs_error_100k = abs(ipa_val - mc_100k_val)
        abs_error_1m = abs(ipa_val - mc_1m_val)
        
        # Calculate relative errors (percentage)
        rel_error_10k = ipa_val != 0.0 ? (abs_error_10k / ipa_val) * 100 : 0.0
        rel_error_100k = ipa_val != 0.0 ? (abs_error_100k / ipa_val) * 100 : 0.0
        rel_error_1m = ipa_val != 0.0 ? (abs_error_1m / ipa_val) * 100 : 0.0
        
        push!(df_data, (
            network = network_name,
            node_id = node,
            ipa_result = ipa_val,
            mc_10k = mc_10k_val,
            mc_100k = mc_100k_val,
            mc_1m = mc_1m_val,
            abs_error_10k = abs_error_10k,
            abs_error_100k = abs_error_100k,
            abs_error_1m = abs_error_1m,
            rel_error_10k = rel_error_10k,
            rel_error_100k = rel_error_100k,
            rel_error_1m = rel_error_1m
        ))
    end
    
    # Convert to DataFrame
    results_df = DataFrame(df_data)
    
    # Calculate summary statistics
    println("\n📈 SUMMARY STATISTICS")
    println("="^50)
    
    println("Absolute Error Statistics:")
    println("  MC 10K   - Mean: $(round(mean(results_df.abs_error_10k), digits=6)), Max: $(round(maximum(results_df.abs_error_10k), digits=6))")
    println("  MC 100K  - Mean: $(round(mean(results_df.abs_error_100k), digits=6)), Max: $(round(maximum(results_df.abs_error_100k), digits=6))")
    println("  MC 1M    - Mean: $(round(mean(results_df.abs_error_1m), digits=6)), Max: $(round(maximum(results_df.abs_error_1m), digits=6))")
    
    println("\nRelative Error Statistics (%):")
    println("  MC 10K   - Mean: $(round(mean(results_df.rel_error_10k), digits=3))%, Max: $(round(maximum(results_df.rel_error_10k), digits=3))%")
    println("  MC 100K  - Mean: $(round(mean(results_df.rel_error_100k), digits=3))%, Max: $(round(maximum(results_df.rel_error_100k), digits=3))%")
    println("  MC 1M    - Mean: $(round(mean(results_df.rel_error_1m), digits=3))%, Max: $(round(maximum(results_df.rel_error_1m), digits=3))%")
    
    # Find nodes with highest errors
    println("\nNodes with Highest Absolute Errors:")
    sorted_by_error_1m = sort(results_df, :abs_error_1m, rev=true)
    for i in 1:min(5, nrow(sorted_by_error_1m))
        row = sorted_by_error_1m[i, :]
        println("  Node $(row.node_id): IPA=$(round(row.ipa_result, digits=4)), MC_1M=$(round(row.mc_1m, digits=4)), Error=$(round(row.abs_error_1m, digits=6))")
    end
    
    # Export to CSV
    output_filename = "$(network_name)_combined_results.csv"
    CSV.write(output_filename, results_df)
    println("\n📁 Results exported to: $output_filename")
    
    return results_df
end

function create_error_convergence_analysis(results_df)
    """Create analysis of how Monte Carlo errors improve with more simulations"""
    
    println("\n🔬 MONTE CARLO CONVERGENCE ANALYSIS")
    println("="^50)
    
    # Calculate how much error reduces from 10K → 100K → 1M
    improvement_10k_to_100k = mean(results_df.abs_error_10k .- results_df.abs_error_100k)
    improvement_100k_to_1m = mean(results_df.abs_error_100k .- results_df.abs_error_1m)
    
    println("Average Error Reduction:")
    println("  10K → 100K simulations: $(round(improvement_10k_to_100k, digits=6))")
    println("  100K → 1M simulations: $(round(improvement_100k_to_1m, digits=6))")
    
    # Find diminishing returns pattern
    total_improvement = improvement_10k_to_100k + improvement_100k_to_1m
    if total_improvement > 0
        pct_improvement_first_jump = (improvement_10k_to_100k / total_improvement) * 100
        pct_improvement_second_jump = (improvement_100k_to_1m / total_improvement) * 100
        
        println("\nDiminishing Returns Analysis:")
        println("  First 10x increase (10K→100K): $(round(pct_improvement_first_jump, digits=1))% of total improvement")
        println("  Second 10x increase (100K→1M): $(round(pct_improvement_second_jump, digits=1))% of total improvement")
        
        if pct_improvement_first_jump > 70
            println("  🔍 Strong diminishing returns - 100K may be optimal simulation count")
        elseif pct_improvement_second_jump > 50
            println("  📈 Continued improvement - 1M simulations provide significant benefit")
        else
            println("  ⚖️  Balanced improvement across simulation increases")
        end
    end
    
    return nothing
end

# Execute the analysis
println("🚀 STARTING COMBINED RESULTS ANALYSIS")
println("="^60)

results_df = combine_all_results("hierarchical_drone_medical")
create_error_convergence_analysis(results_df)

println("\n✅ Analysis complete! Check the CSV file for detailed results.")