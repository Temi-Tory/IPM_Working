"""
Conditioning Patterns Analysis Script
=====================================

This script analyzes the recursive flow of updateDiamondJoin and state conditioning patterns
for caching optimization by parsing diamond_structure_tracking.log.

Key Analysis Areas:
1. Diamond structure identification and conditioning node patterns
2. Recursive call chains and state combinations (2^n analysis)
3. Cache reuse opportunities for unweighted values
4. Frequency analysis of identical diamond+conditioning combinations
"""

using Printf
using DataStructures
using Dates

# Data structures for analysis
mutable struct DiamondStructure
    join_node::Int
    fork_nodes::Set{Int}
    edges::Int
    nodes::Int
    edgelist::Vector{Tuple{Int,Int}}  # Will be populated if available
end

mutable struct ConditioningCall
    depth::Int
    join_node::Int
    conditioning_state::String
    diamond_structures::Vector{DiamondStructure}
    timestamp::String
    processing_id::Int
end

mutable struct CacheOpportunity
    diamond_signature::String
    conditioning_nodes::Set{Int}
    frequency::Int
    depths::Set{Int}
    states::Set{String}
    potential_savings::Int
end

# Global analysis containers
conditioning_calls = Vector{ConditioningCall}()
diamond_cache_map = Dict{String, Vector{ConditioningCall}}()
conditioning_patterns = Dict{Tuple{String, Set{Int}}, Int}()
recursive_chains = Dict{Int, Vector{Int}}()  # parent_id -> child_ids
state_combinations = Dict{String, Set{String}}()

function parse_diamond_structure_log(filename::String)
    """Parse the diamond structure tracking log and extract conditioning patterns."""
    
    println("🔍 Parsing diamond structure tracking log: $filename")
    
    if !isfile(filename)
        error("Log file not found: $filename")
    end
    
    lines = readlines(filename)
    current_call = nothing
    current_diamonds = Vector{DiamondStructure}()
    processing_id = 0
    
    for (line_num, line) in enumerate(lines)
        line = strip(line)
        
        # Skip empty lines and headers
        if isempty(line) || startswith(line, "===") || startswith(line, "Generated:") || startswith(line, "Purpose:")
            continue
        end
        
        # Detect new diamond processing block
        if contains(line, "Diamond Processing #")
            processing_id += 1
            depth_match = match(r"Depth: (\d+)", line)
            depth = depth_match !== nothing ? parse(Int, depth_match.captures[1]) : 1
            
            # Save previous call if exists
            if current_call !== nothing
                current_call.diamond_structures = copy(current_diamonds)
                push!(conditioning_calls, current_call)
            end
            
            current_call = ConditioningCall(depth, 0, "", Vector{DiamondStructure}(), "", processing_id)
            current_diamonds = Vector{DiamondStructure}()
            
        # Extract timestamp
        elseif startswith(line, "Timestamp:")
            if current_call !== nothing
                current_call.timestamp = strip(split(line, ":")[2:end] |> x -> join(x, ":"))
            end
            
        # Extract conditioning information
        elseif contains(line, "Processing diamond for join node:")
            join_match = match(r"join node: (\d+)", line)
            if join_match !== nothing && current_call !== nothing
                current_call.join_node = parse(Int, join_match.captures[1])
            end
            
        elseif contains(line, "Conditioning state:")
            state_match = match(r"Conditioning state: (.+)", line)
            if state_match !== nothing && current_call !== nothing
                current_call.conditioning_state = strip(state_match.captures[1])
            end
            
        # Parse diamond structures
        elseif contains(line, "Node ") && contains(line, ": ") && contains(line, "diamond groups")
            node_match = match(r"Node (\d+):", line)
            if node_match !== nothing
                join_node = parse(Int, node_match.captures[1])
                # Look ahead for fork nodes and structure info
                if line_num < length(lines)
                    next_line = strip(lines[line_num + 1])
                    fork_match = match(r"Fork nodes Set\(\[([^\]]+)\]\)", next_line)
                    if fork_match !== nothing
                        fork_nodes_str = fork_match.captures[1]
                        fork_nodes = Set(parse(Int, strip(x)) for x in split(fork_nodes_str, ","))
                        
                        # Get edges and nodes count
                        edges, nodes = 0, 0
                        if line_num + 1 < length(lines)
                            structure_line = strip(lines[line_num + 2])
                            structure_match = match(r"(\d+) edges, (\d+) nodes", structure_line)
                            if structure_match !== nothing
                                edges = parse(Int, structure_match.captures[1])
                                nodes = parse(Int, structure_match.captures[2])
                            end
                        end
                        
                        diamond = DiamondStructure(join_node, fork_nodes, edges, nodes, Vector{Tuple{Int,Int}}())
                        push!(current_diamonds, diamond)
                    end
                end
            end
        end
    end
    
    # Save final call
    if current_call !== nothing
        current_call.diamond_structures = copy(current_diamonds)
        push!(conditioning_calls, current_call)
    end
    
    println("✅ Parsed $(length(conditioning_calls)) conditioning calls")
    return conditioning_calls
end

function analyze_conditioning_patterns()
    """Analyze conditioning patterns and identify cache opportunities."""
    
    println("\n🔬 Analyzing conditioning patterns...")
    
    # Build diamond signature -> calls mapping
    for call in conditioning_calls
        for diamond in call.diamond_structures
            # Create diamond signature
            fork_str = join(sort(collect(diamond.fork_nodes)), ",")
            signature = "$(diamond.join_node):$(fork_str):$(diamond.edges)e$(diamond.nodes)n"
            
            if !haskey(diamond_cache_map, signature)
                diamond_cache_map[signature] = Vector{ConditioningCall}()
            end
            push!(diamond_cache_map[signature], call)
            
            # Track conditioning patterns
            conditioning_nodes = diamond.fork_nodes
            pattern_key = (signature, conditioning_nodes)
            conditioning_patterns[pattern_key] = get(conditioning_patterns, pattern_key, 0) + 1
            
            # Track state combinations for this diamond
            if !haskey(state_combinations, signature)
                state_combinations[signature] = Set{String}()
            end
            if !isempty(call.conditioning_state)
                push!(state_combinations[signature], call.conditioning_state)
            end
        end
    end
    
    # Build recursive chains
    for call in conditioning_calls
        if call.depth > 1
            # Find parent call (previous depth)
            parent_calls = filter(c -> c.depth == call.depth - 1 && c.processing_id < call.processing_id, conditioning_calls)
            if !isempty(parent_calls)
                parent = last(parent_calls)  # Most recent parent
                if !haskey(recursive_chains, parent.processing_id)
                    recursive_chains[parent.processing_id] = Vector{Int}()
                end
                push!(recursive_chains[parent.processing_id], call.processing_id)
            end
        end
    end
    
    println("✅ Found $(length(diamond_cache_map)) unique diamond signatures")
    println("✅ Identified $(length(conditioning_patterns)) conditioning patterns")
    println("✅ Built $(length(recursive_chains)) recursive chains")
end

function identify_cache_opportunities()
    """Identify specific cache opportunities for unweighted values."""
    
    println("\n💰 Identifying cache opportunities...")
    
    cache_opportunities = Vector{CacheOpportunity}()
    
    for (signature, calls) in diamond_cache_map
        if length(calls) > 1  # Multiple uses of same diamond structure
            # Extract conditioning nodes from all calls
            all_conditioning_nodes = Set{Int}()
            depths = Set{Int}()
            states = Set{String}()
            
            for call in calls
                for diamond in call.diamond_structures
                    if contains(signature, "$(diamond.join_node):")
                        union!(all_conditioning_nodes, diamond.fork_nodes)
                        push!(depths, call.depth)
                        if !isempty(call.conditioning_state)
                            push!(states, call.conditioning_state)
                        end
                        break
                    end
                end
            end
            
            # Calculate potential savings (number of redundant computations)
            potential_savings = length(calls) - 1
            
            opportunity = CacheOpportunity(
                signature,
                all_conditioning_nodes,
                length(calls),
                depths,
                states,
                potential_savings
            )
            push!(cache_opportunities, opportunity)
        end
    end
    
    # Sort by potential savings (highest first)
    sort!(cache_opportunities, by = x -> x.potential_savings, rev = true)
    
    println("✅ Identified $(length(cache_opportunities)) cache opportunities")
    return cache_opportunities
end

function analyze_state_space()
    """Analyze the 2^n state space patterns."""
    
    println("\n🎯 Analyzing state space patterns...")
    
    state_analysis = Dict{String, Dict{String, Any}}()
    
    for (signature, states) in state_combinations
        n_conditioning_nodes = 0
        
        # Extract number of conditioning nodes from signature
        if haskey(diamond_cache_map, signature) && !isempty(diamond_cache_map[signature])
            first_call = diamond_cache_map[signature][1]
            for diamond in first_call.diamond_structures
                if contains(signature, "$(diamond.join_node):")
                    n_conditioning_nodes = length(diamond.fork_nodes)
                    break
                end
            end
        end
        
        theoretical_states = 2^n_conditioning_nodes
        observed_states = length(states)
        coverage = observed_states / max(theoretical_states, 1)
        
        state_analysis[signature] = Dict(
            "conditioning_nodes" => n_conditioning_nodes,
            "theoretical_states" => theoretical_states,
            "observed_states" => observed_states,
            "coverage" => coverage,
            "states" => collect(states)
        )
    end
    
    println("✅ Analyzed state space for $(length(state_analysis)) diamond signatures")
    return state_analysis
end

function generate_conditioning_report(cache_opportunities, state_analysis)
    """Generate comprehensive conditioning analysis report."""
    
    println("\n📊 Generating conditioning cache analysis report...")
    
    report_filename = "conditioning_cache_analysis.txt"
    
    open(report_filename, "w") do f
        write(f, "CONDITIONING PATTERNS & CACHE ANALYSIS REPORT\n")
        write(f, "=" ^ 50 * "\n")
        write(f, "Generated: $(now())\n")
        write(f, "Total conditioning calls analyzed: $(length(conditioning_calls))\n")
        write(f, "Unique diamond signatures: $(length(diamond_cache_map))\n")
        write(f, "Cache opportunities identified: $(length(cache_opportunities))\n\n")
        
        # Summary statistics
        write(f, "SUMMARY STATISTICS\n")
        write(f, "-" ^ 20 * "\n")
        total_calls = length(conditioning_calls)
        total_potential_savings = sum(opp.potential_savings for opp in cache_opportunities)
        cache_hit_ratio = total_potential_savings / max(total_calls, 1) * 100
        
        write(f, "Total conditioning calls: $total_calls\n")
        write(f, "Potential redundant computations: $total_potential_savings\n")
        write(f, "Potential cache hit ratio: $(round(cache_hit_ratio, digits=2))%\n")
        write(f, "Average depth: $(round(sum(c.depth for c in conditioning_calls) / total_calls, digits=2))\n")
        write(f, "Max depth observed: $(maximum(c.depth for c in conditioning_calls))\n\n")
        
        # Top cache opportunities
        write(f, "TOP CACHE OPPORTUNITIES\n")
        write(f, "-" ^ 25 * "\n")
        for (i, opp) in enumerate(cache_opportunities[1:min(10, length(cache_opportunities))])
            write(f, "$i. Diamond Signature: $(opp.diamond_signature)\n")
            write(f, "   Frequency: $(opp.frequency) calls\n")
            write(f, "   Conditioning nodes: $(length(opp.conditioning_nodes)) nodes $(collect(opp.conditioning_nodes))\n")
            write(f, "   Depths: $(collect(opp.depths))\n")
            write(f, "   States: $(collect(opp.states))\n")
            write(f, "   Potential savings: $(opp.potential_savings) redundant computations\n\n")
        end
        
        # State space analysis
        write(f, "STATE SPACE ANALYSIS\n")
        write(f, "-" ^ 20 * "\n")
        expensive_patterns = sort(collect(state_analysis), by = x -> x[2]["theoretical_states"], rev = true)
        
        for (i, (signature, analysis)) in enumerate(expensive_patterns[1:min(15, length(expensive_patterns))])
            write(f, "$i. Diamond: $signature\n")
            write(f, "   Conditioning nodes: $(analysis["conditioning_nodes"])\n")
            write(f, "   Theoretical states (2^n): $(analysis["theoretical_states"])\n")
            write(f, "   Observed states: $(analysis["observed_states"])\n")
            write(f, "   Coverage: $(round(analysis["coverage"] * 100, digits=1))%\n")
            write(f, "   States seen: $(join(analysis["states"], ", "))\n\n")
        end
        
        # Recursive flow analysis
        write(f, "RECURSIVE FLOW PATTERNS\n")
        write(f, "-" ^ 25 * "\n")
        write(f, "Recursive chains identified: $(length(recursive_chains))\n")
        for (parent_id, children) in recursive_chains
            parent_call = findfirst(c -> c.processing_id == parent_id, conditioning_calls)
            if parent_call !== nothing
                parent = conditioning_calls[parent_call]
                write(f, "Chain starting at depth $(parent.depth) (ID: $parent_id):\n")
                write(f, "  └─ Children: $(join(children, ", "))\n")
                write(f, "  └─ Join node: $(parent.join_node), State: $(parent.conditioning_state)\n\n")
            end
        end
        
        # Detailed conditioning patterns
        write(f, "DETAILED CONDITIONING PATTERNS\n")
        write(f, "-" ^ 30 * "\n")
        sorted_patterns = sort(collect(conditioning_patterns), by = x -> x[2], rev = true)
        
        for (i, ((signature, conditioning_nodes), frequency)) in enumerate(sorted_patterns[1:min(20, length(sorted_patterns))])
            write(f, "$i. Pattern (frequency: $frequency):\n")
            write(f, "   Diamond: $signature\n")
            write(f, "   Conditioning nodes: $(collect(conditioning_nodes))\n")
            
            # Find example calls
            example_calls = filter(conditioning_calls) do call
                any(d -> contains(signature, "$(d.join_node):") && d.fork_nodes == conditioning_nodes, call.diamond_structures)
            end
            
            if !isempty(example_calls)
                write(f, "   Example states: $(unique([c.conditioning_state for c in example_calls if !isempty(c.conditioning_state)]))\n")
                write(f, "   Depths seen: $(unique([c.depth for c in example_calls]))\n")
            end
            write(f, "\n")
        end
    end
    
    println("✅ Report generated: $report_filename")
end

function print_console_summary(cache_opportunities, state_analysis)
    """Print summary to console."""
    
    println("\n" * "=" ^ 60)
    println("CONDITIONING PATTERNS ANALYSIS SUMMARY")
    println("=" ^ 60)
    
    total_calls = length(conditioning_calls)
    total_savings = sum(opp.potential_savings for opp in cache_opportunities)
    
    println("📊 OVERALL METRICS:")
    println("   • Total conditioning calls: $total_calls")
    println("   • Unique diamond signatures: $(length(diamond_cache_map))")
    println("   • Cache opportunities: $(length(cache_opportunities))")
    println("   • Potential cache hit ratio: $(round(total_savings / max(total_calls, 1) * 100, digits=2))%")
    
    println("\n🎯 TOP CACHE OPPORTUNITIES:")
    for (i, opp) in enumerate(cache_opportunities[1:min(5, length(cache_opportunities))])
        println("   $i. $(opp.diamond_signature)")
        println("      └─ $(opp.frequency) calls, $(opp.potential_savings) potential savings")
        println("      └─ $(length(opp.conditioning_nodes)) conditioning nodes: $(collect(opp.conditioning_nodes))")
    end
    
    println("\n🔬 MOST EXPENSIVE STATE SPACES (2^n):")
    expensive = sort(collect(state_analysis), by = x -> x[2]["theoretical_states"], rev = true)
    for (i, (sig, analysis)) in enumerate(expensive[1:min(5, length(expensive))])
        n = analysis["conditioning_nodes"]
        states = analysis["theoretical_states"]
        observed = analysis["observed_states"]
        println("   $i. $n conditioning nodes → 2^$n = $states theoretical states")
        println("      └─ $observed observed states ($(round(analysis["coverage"]*100, digits=1))% coverage)")
    end
    
    println("\n🔄 RECURSIVE PATTERNS:")
    println("   • Recursive chains: $(length(recursive_chains))")
    max_depth = maximum(c.depth for c in conditioning_calls)
    println("   • Maximum recursion depth: $max_depth")
    
    depth_counts = Dict{Int, Int}()
    for call in conditioning_calls
        depth_counts[call.depth] = get(depth_counts, call.depth, 0) + 1
    end
    
    println("   • Calls by depth:")
    for depth in sort(collect(keys(depth_counts)))
        println("     └─ Depth $depth: $(depth_counts[depth]) calls")
    end
    
    println("\n" * "=" ^ 60)
end

# Main execution
function main()
    println("🚀 Starting Conditioning Patterns Analysis")
    println("=" ^ 50)
    
    try
        # Parse the log file
        parse_diamond_structure_log("diamond_structure_tracking.log")
        
        # Analyze patterns
        analyze_conditioning_patterns()
        
        # Identify cache opportunities
        cache_opportunities = identify_cache_opportunities()
        
        # Analyze state space
        state_analysis = analyze_state_space()
        
        # Generate report
        generate_conditioning_report(cache_opportunities, state_analysis)
        
        # Print console summary
        print_console_summary(cache_opportunities, state_analysis)
        
        println("\n✅ Analysis complete! Check 'conditioning_cache_analysis.txt' for detailed results.")
        
    catch e
        println("❌ Error during analysis: $e")
        rethrow(e)
    end
end

# Run the analysis
if abspath(PROGRAM_FILE) == @__FILE__
    main()
end