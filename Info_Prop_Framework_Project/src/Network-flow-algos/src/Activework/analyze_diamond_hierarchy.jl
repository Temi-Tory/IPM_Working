#!/usr/bin/env julia

"""
Diamond Hierarchy Analysis Script
=================================
Analyzes the hierarchical diamond structures from diamond_structure_tracking.log
Extracts GLOBAL and SUB-DIAMOND structures and their relationships.
"""

using Printf
using Dates

# Data structures to hold parsed information
struct DiamondStructure
    processing_id::Int
    depth::Int
    timestamp::String
    call_type::String  # "GLOBAL" or "SUB-DIAMOND"
    join_node::Union{Int, Nothing}
    conditioning_state::Union{String, Nothing}
    nodes_with_diamonds::Vector{Int}
    total_structures::Int
    diamond_details::Dict{Int, Vector{Dict{String, Any}}}
end

struct HierarchyRelationship
    parent_processing_id::Int
    child_processing_id::Int
    parent_depth::Int
    child_depth::Int
    join_node::Int
    conditioning_state::String
end

# Global collections
diamond_structures = DiamondStructure[]
hierarchy_relationships = HierarchyRelationship[]
unique_diamond_patterns = Dict{String, Int}()  # pattern -> count
global_diamond_patterns = Set{String}()

function parse_diamond_log(filename::String)
    """Parse the diamond structure tracking log file"""
    
    println("🔍 Parsing diamond structure log: $filename")
    
    if !isfile(filename)
        error("Log file not found: $filename")
    end
    
    lines = readlines(filename)
    total_lines = length(lines)
    println("📄 Total lines to process: $total_lines")
    
    i = 1
    processing_stack = Int[]  # Stack to track parent-child relationships
    
    while i <= length(lines)
        line = strip(lines[i])
        
        # Skip empty lines and headers
        if isempty(line) || startswith(line, "===") || startswith(line, "Generated:") || 
           startswith(line, "Purpose:") || startswith(line, "Finalized:")
            i += 1
            continue
        end
        
        # Parse GLOBAL diamond processing
        if occursin(r"\[GLOBAL\] Diamond Processing #(\d+) \(Depth: (\d+)\)", line)
            m = match(r"\[GLOBAL\] Diamond Processing #(\d+) \(Depth: (\d+)\)", line)
            processing_id = parse(Int, m.captures[1])
            depth = parse(Int, m.captures[2])
            
            # Clear stack for new global processing
            empty!(processing_stack)
            push!(processing_stack, processing_id)
            
            i, diamond_struct = parse_diamond_structure(lines, i, processing_id, depth, "GLOBAL")
            push!(diamond_structures, diamond_struct)
            
            # Add global patterns to set
            add_patterns_to_global_set(diamond_struct)
            
        # Parse SUB-DIAMOND processing
        elseif occursin(r"\[SUB-DIAMOND\] Diamond Processing #(\d+) \(Depth: (\d+)\)", line)
            m = match(r"\[SUB-DIAMOND\] Diamond Processing #(\d+) \(Depth: (\d+)\)", line)
            processing_id = parse(Int, m.captures[1])
            depth = parse(Int, m.captures[2])
            
            # Find parent processing ID from stack
            parent_id = length(processing_stack) > 0 ? processing_stack[end] : nothing
            
            # Look backwards for conditioning information
            join_node, conditioning_state = find_conditioning_info(lines, i)
            
            i, diamond_struct = parse_diamond_structure(lines, i, processing_id, depth, "SUB-DIAMOND", join_node, conditioning_state)
            push!(diamond_structures, diamond_struct)
            
            # Record hierarchy relationship
            if parent_id !== nothing
                parent_struct = find_structure_by_id(parent_id)
                if parent_struct !== nothing
                    relationship = HierarchyRelationship(
                        parent_id, processing_id, parent_struct.depth, depth,
                        join_node !== nothing ? join_node : 0, conditioning_state !== nothing ? conditioning_state : ""
                    )
                    push!(hierarchy_relationships, relationship)
                end
            end
            
            # Update processing stack
            while length(processing_stack) > 0 && find_structure_by_id(processing_stack[end]).depth >= depth
                pop!(processing_stack)
            end
            push!(processing_stack, processing_id)
            
        else
            i += 1
        end
    end
    
    println("✅ Parsing complete!")
    println("📊 Parsed $(length(diamond_structures)) diamond processing entries")
    println("🔗 Found $(length(hierarchy_relationships)) hierarchy relationships")
end

function parse_diamond_structure(lines, start_idx, processing_id, depth, call_type, join_node=nothing, conditioning_state=nothing)
    """Parse a single diamond structure block"""
    
    i = start_idx + 1
    timestamp = ""
    nodes_with_diamonds = Int[]
    total_structures = 0
    diamond_details = Dict{Int, Vector{Dict{String, Any}}}()
    
    # Parse timestamp
    if i <= length(lines) && occursin("Timestamp:", lines[i])
        timestamp = strip(split(lines[i], "Timestamp:")[2])
        i += 1
    end
    
    # Parse nodes with diamonds
    if i <= length(lines) && occursin("Nodes with diamonds:", lines[i])
        nodes_str = strip(split(lines[i], "Nodes with diamonds:")[2])
        nodes_str = replace(nodes_str, r"[\[\]]" => "")
        if !isempty(nodes_str)
            nodes_with_diamonds = [parse(Int, strip(x)) for x in split(nodes_str, ",")]
        end
        i += 1
    end
    
    # Parse total structures
    if i <= length(lines) && occursin("Total diamond structures:", lines[i])
        total_structures = parse(Int, strip(split(lines[i], "Total diamond structures:")[2]))
        i += 1
    end
    
    # Parse diamond details for each node
    while i <= length(lines)
        line = strip(lines[i])
        
        # Stop if we hit another processing block or end markers
        if occursin(r"\[(GLOBAL|SUB-DIAMOND)\] Diamond Processing", line) || 
           occursin("---", line) || occursin("===", line) ||
           occursin("[SUB-DIAMOND] Recursive call", line)
            break
        end
        
        # Parse node diamond details
        if occursin(r"Node (\d+): (\d+) diamond groups", line)
            m = match(r"Node (\d+): (\d+) diamond groups", line)
            node_id = parse(Int, m.captures[1])
            num_groups = parse(Int, m.captures[2])
            
            diamond_details[node_id] = []
            i += 1
            
            # Parse groups for this node
            for group_idx in 1:num_groups
                group_info = Dict{String, Any}()
                
                # Parse fork and join info
                if i <= length(lines) && occursin("Fork nodes", lines[i])
                    fork_match = match(r"Fork nodes Set\(\[([^\]]+)\]\) → Join node (\d+)", lines[i])
                    if fork_match !== nothing
                        fork_nodes_str = fork_match.captures[1]
                        fork_nodes = [parse(Int, strip(x)) for x in split(fork_nodes_str, ",")]
                        join_node_parsed = parse(Int, fork_match.captures[2])
                        
                        group_info["fork_nodes"] = fork_nodes
                        group_info["join_node"] = join_node_parsed
                    end
                    i += 1
                end
                
                # Parse edge and node counts
                if i <= length(lines) && occursin("edges,", lines[i])
                    counts_match = match(r"(\d+) edges, (\d+) nodes", lines[i])
                    if counts_match !== nothing
                        group_info["edge_count"] = parse(Int, counts_match.captures[1])
                        group_info["node_count"] = parse(Int, counts_match.captures[2])
                    end
                    i += 1
                end
                
                push!(diamond_details[node_id], group_info)
                
                # Create pattern string for uniqueness analysis
                if haskey(group_info, "fork_nodes") && haskey(group_info, "join_node")
                    pattern = create_pattern_string(group_info["fork_nodes"], group_info["join_node"], 
                                                  group_info["edge_count"], group_info["node_count"])
                    unique_diamond_patterns[pattern] = get(unique_diamond_patterns, pattern, 0) + 1
                end
            end
        else
            i += 1
        end
    end
    
    diamond_struct = DiamondStructure(
        processing_id, depth, timestamp, call_type, join_node, conditioning_state,
        nodes_with_diamonds, total_structures, diamond_details
    )
    
    return i, diamond_struct
end

function find_conditioning_info(lines, current_idx)
    """Look backwards to find conditioning information for SUB-DIAMOND"""
    
    join_node = nothing
    conditioning_state = nothing
    
    # Look backwards up to 10 lines
    start_search = max(1, current_idx - 10)
    
    for i in current_idx-1:-1:start_search
        line = strip(lines[i])
        
        if occursin("Processing diamond for join node:", line)
            m = match(r"Processing diamond for join node: (\d+)", line)
            if m !== nothing
                join_node = parse(Int, m.captures[1])
            end
        end
        
        if occursin("Conditioning state:", line)
            m = match(r"Conditioning state: (.+)", line)
            if m !== nothing
                conditioning_state = m.captures[1]
            end
        end
        
        # Stop if we found both or hit another processing block
        if (join_node !== nothing && conditioning_state !== nothing) ||
           occursin("Diamond Processing #", line)
            break
        end
    end
    
    return join_node, conditioning_state
end

function find_structure_by_id(processing_id)
    """Find diamond structure by processing ID"""
    for diamond_struct in diamond_structures
        if diamond_struct.processing_id == processing_id
            return diamond_struct
        end
    end
    return nothing
end

function create_pattern_string(fork_nodes, join_node, edge_count, node_count)
    """Create a unique pattern string for diamond structure"""
    sorted_forks = sort(fork_nodes)
    return "F$(sorted_forks)→J$(join_node)_E$(edge_count)_N$(node_count)"
end

function add_patterns_to_global_set(diamond_struct)
    """Add patterns from global diamond structure to global set"""
    for (node_id, groups) in diamond_struct.diamond_details
        for group in groups
            if haskey(group, "fork_nodes") && haskey(group, "join_node")
                pattern = create_pattern_string(group["fork_nodes"], group["join_node"], 
                                              group["edge_count"], group["node_count"])
                push!(global_diamond_patterns, pattern)
            end
        end
    end
end

function analyze_hierarchy()
    """Perform comprehensive hierarchy analysis"""
    
    println("\n" * "="^80)
    println("🔬 DIAMOND HIERARCHY ANALYSIS")
    println("="^80)
    
    # Basic statistics
    global_count = count(s -> s.call_type == "GLOBAL", diamond_structures)
    sub_diamond_count = count(s -> s.call_type == "SUB-DIAMOND", diamond_structures)
    
    println("\n📊 EXECUTIVE SUMMARY")
    println("-"^50)
    println("Total Diamond Processing Entries: $(length(diamond_structures))")
    println("GLOBAL Diamond Structures: $global_count")
    println("SUB-DIAMOND Structures: $sub_diamond_count")
    println("Hierarchy Relationships: $(length(hierarchy_relationships))")
    println("Unique Diamond Patterns: $(length(unique_diamond_patterns))")
    println("Global Diamond Patterns: $(length(global_diamond_patterns))")
    
    # Depth analysis
    max_depth = maximum(s.depth for s in diamond_structures)
    println("Maximum Nesting Depth: $max_depth")
    
    depth_counts = Dict{Int, Int}()
    for diamond_struct in diamond_structures
        depth_counts[diamond_struct.depth] = get(depth_counts, diamond_struct.depth, 0) + 1
    end
    
    println("\n📈 DEPTH DISTRIBUTION")
    println("-"^30)
    for depth in sort(collect(keys(depth_counts)))
        count = depth_counts[depth]
        percentage = round(count / length(diamond_structures) * 100, digits=2)
        println("Depth $depth: $count structures ($percentage%)")
    end
    
    # Unique sub-diamond analysis
    unique_sub_patterns = 0
    repeated_patterns = 0
    
    for (pattern, count) in unique_diamond_patterns
        if pattern ∉ global_diamond_patterns
            unique_sub_patterns += 1
        end
        if count > 1
            repeated_patterns += 1
        end
    end
    
    println("\n🔍 PATTERN ANALYSIS")
    println("-"^40)
    println("Patterns unique to sub-diamonds: $unique_sub_patterns")
    println("Patterns appearing multiple times: $repeated_patterns")
    
    unique_percentage = round(unique_sub_patterns / length(unique_diamond_patterns) * 100, digits=2)
    println("Percentage of unique sub-patterns: $unique_percentage%")
    
    # Most frequent patterns
    println("\n🔥 MOST FREQUENT DIAMOND PATTERNS")
    println("-"^45)
    sorted_patterns = sort(collect(unique_diamond_patterns), by=x->x[2], rev=true)
    
    for (i, (pattern, count)) in enumerate(sorted_patterns[1:min(10, length(sorted_patterns))])
        is_global = pattern ∈ global_diamond_patterns ? " (GLOBAL)" : " (SUB-ONLY)"
        println("$i. $pattern: $count occurrences$is_global")
    end
    
    # Hierarchy depth analysis
    println("\n🌳 HIERARCHICAL COMPLEXITY ANALYSIS")
    println("-"^50)
    
    # Find deepest nesting chains
    deepest_chains = find_deepest_chains()
    println("Deepest nesting chains found: $(length(deepest_chains))")
    
    for (i, chain) in enumerate(deepest_chains[1:min(5, length(deepest_chains))])
        println("Chain $i: Depth $(chain[end].child_depth) - $(length(chain)) levels")
        for rel in chain
            parent_struct = find_structure_by_id(rel.parent_processing_id)
            child_struct = find_structure_by_id(rel.child_processing_id)
            println("  $(parent_struct.call_type) #$(rel.parent_processing_id) (D$(rel.parent_depth)) → $(child_struct.call_type) #$(rel.child_processing_id) (D$(rel.child_depth))")
        end
    end
    
    # Cache opportunity analysis
    println("\n💾 CACHE OPPORTUNITY ANALYSIS")
    println("-"^40)
    
    cache_opportunities = 0
    total_cache_savings = 0
    
    for (pattern, count) in unique_diamond_patterns
        if count > 1
            cache_opportunities += 1
            total_cache_savings += (count - 1)  # First computation + (count-1) cache hits
        end
    end
    
    println("Cacheable patterns: $cache_opportunities")
    println("Total potential cache hits: $total_cache_savings")
    
    cache_efficiency = round(total_cache_savings / length(diamond_structures) * 100, digits=2)
    println("Cache efficiency potential: $cache_efficiency%")
end

function find_deepest_chains()
    """Find the deepest hierarchical chains"""
    
    chains = []
    
    # Build chains from relationships
    for rel in hierarchy_relationships
        # Start a new chain or extend existing ones
        chain = [rel]
        
        # Look for children of this relationship
        current_child = rel.child_processing_id
        while true
            child_rel = nothing
            for r in hierarchy_relationships
                if r.parent_processing_id == current_child
                    child_rel = r
                    break
                end
            end
            
            if child_rel === nothing
                break
            end
            
            push!(chain, child_rel)
            current_child = child_rel.child_processing_id
        end
        
        push!(chains, chain)
    end
    
    # Sort by depth and length
    sort!(chains, by=chain -> (chain[end].child_depth, length(chain)), rev=true)
    
    return chains
end

function generate_detailed_report()
    """Generate detailed report file"""
    
    report_filename = "diamond_hierarchy_analysis.txt"
    
    println("\n📝 Generating detailed report: $report_filename")
    
    open(report_filename, "w") do f
        write(f, "DIAMOND HIERARCHY ANALYSIS REPORT\n")
        write(f, "="^50 * "\n")
        write(f, "Generated: $(Dates.now())\n")
        write(f, "Source: diamond_structure_tracking.log\n\n")
        
        # Executive Summary
        write(f, "EXECUTIVE SUMMARY\n")
        write(f, "-"^20 * "\n")
        write(f, "Total Processing Entries: $(length(diamond_structures))\n")
        write(f, "GLOBAL Structures: $(count(s -> s.call_type == "GLOBAL", diamond_structures))\n")
        write(f, "SUB-DIAMOND Structures: $(count(s -> s.call_type == "SUB-DIAMOND", diamond_structures))\n")
        write(f, "Maximum Depth: $(maximum(s.depth for s in diamond_structures))\n")
        write(f, "Unique Patterns: $(length(unique_diamond_patterns))\n\n")
        
        # Network breakdown
        write(f, "DETAILED STRUCTURE BREAKDOWN\n")
        write(f, "-"^30 * "\n")
        
        for diamond_struct in diamond_structures[1:min(20, length(diamond_structures))]  # First 20 for brevity
            write(f, "$(diamond_struct.call_type) Processing #$(diamond_struct.processing_id) (Depth: $(diamond_struct.depth))\n")
            write(f, "  Timestamp: $(diamond_struct.timestamp)\n")
            write(f, "  Nodes: $(diamond_struct.nodes_with_diamonds)\n")
            write(f, "  Total Structures: $(diamond_struct.total_structures)\n")
            
            if diamond_struct.join_node !== nothing
                write(f, "  Join Node: $(diamond_struct.join_node)\n")
            end
            if diamond_struct.conditioning_state !== nothing
                write(f, "  Conditioning: $(diamond_struct.conditioning_state)\n")
            end
            
            write(f, "\n")
        end
        
        # Pattern analysis
        write(f, "UNIQUE PATTERN ANALYSIS\n")
        write(f, "-"^25 * "\n")
        
        unique_to_sub = 0
        for (pattern, count) in unique_diamond_patterns
            if pattern ∉ global_diamond_patterns
                unique_to_sub += 1
                write(f, "SUB-ONLY: $pattern (×$count)\n")
            end
        end
        
        write(f, "\nTotal patterns unique to sub-diamonds: $unique_to_sub\n")
        
        # Hierarchy relationships
        write(f, "\nHIERARCHY RELATIONSHIPS\n")
        write(f, "-"^25 * "\n")
        
        for rel in hierarchy_relationships[1:min(50, length(hierarchy_relationships))]
            write(f, "Parent #$(rel.parent_processing_id) (D$(rel.parent_depth)) → Child #$(rel.child_processing_id) (D$(rel.child_depth))\n")
            write(f, "  Join Node: $(rel.join_node), Conditioning: $(rel.conditioning_state)\n")
        end
    end
    
    println("✅ Report generated successfully!")
end

function main()
    """Main analysis function"""
    
    println("🚀 Starting Diamond Hierarchy Analysis")
    println("="^60)
    
    log_filename = "diamond_structure_tracking.log"
    
    try
        # Parse the log file
        parse_diamond_log(log_filename)
        
        # Perform analysis
        analyze_hierarchy()
        
        # Generate detailed report
        generate_detailed_report()
        
        println("\n" * "="^80)
        println("✅ ANALYSIS COMPLETE!")
        println("="^80)
        println("📊 Key Findings:")
        println("• Processed $(length(diamond_structures)) diamond structures")
        println("• Found $(length(hierarchy_relationships)) hierarchical relationships")
        println("• Identified $(length(unique_diamond_patterns)) unique patterns")
        println("• Maximum nesting depth: $(maximum(s.depth for s in diamond_structures))")
        
        unique_sub_count = count(pattern -> pattern ∉ global_diamond_patterns, keys(unique_diamond_patterns))
        println("• Sub-diamond unique patterns: $unique_sub_count")
        
        println("\n📄 Detailed report saved to: diamond_hierarchy_analysis.txt")
        
    catch e
        println("❌ Error during analysis: $e")
        rethrow(e)
    end
end

# Run the analysis
if abspath(PROGRAM_FILE) == @__FILE__
    main()
end