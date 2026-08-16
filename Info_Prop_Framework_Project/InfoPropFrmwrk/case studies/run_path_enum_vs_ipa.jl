if !isdefined(Main, :InfoPropFramework)
    include(joinpath(@__DIR__, "..", "InfoPropFrmwrk", "src", "Algorithms", "InfoPropFramework.jl"))
    using .InfoPropFramework
end
using Printf, Dates, Statistics

if !isdefined(Main, :TeeStream)
    struct TeeStream <: IO
        console::IO
        file::IO
    end
    Base.write(t::TeeStream, b::UInt8)         = (write(t.console, b); write(t.file, b); 1)
    Base.write(t::TeeStream, b::Vector{UInt8}) = (write(t.console, b); write(t.file, b); length(b))
    Base.flush(t::TeeStream)                   = (flush(t.console); flush(t.file))
end

const PE_DIR = @__DIR__

# Max paths before inclusion-exclusion becomes infeasible (2^MAX_PATHS subsets)
const MAX_PATHS = 20    # 2^20 = ~1M subsets, manageable per node

const PE_NETWORKS = [
    "metro_directed_dag_for_ipm",
    "munin-dag", 
]

# ============================================================================
# Path enumeration code (copied from ComparisonModules.jl)
# ============================================================================

function pe_find_all_paths(graph::Dict{Int64,Set{Int64}}, start::Int64, target::Int64)
    paths   = Vector{Vector{Int64}}()
    visited = Set{Int64}()
    current = Int64[]

    function dfs(node)
        push!(visited, node)
        push!(current, node)
        if node == target
            push!(paths, copy(current))
        else
            if haskey(graph, node)
                for nb in graph[node]
                    nb ∉ visited && dfs(nb)
                end
            end
        end
        pop!(current)
        delete!(visited, node)
    end

    dfs(start)
    return paths
end

function pe_union_of_edge_sets(edge_sets::Vector{Vector{Tuple{Int64,Int64}}})
    u = Set{Tuple{Int64,Int64}}()
    for es in edge_sets, e in es
        push!(u, e)
    end
    return collect(u)
end

function pe_inclusion_exclusion(
    path_edge_sets::Vector{Vector{Tuple{Int64,Int64}}},
    edge_probs::Dict{Tuple{Int64,Int64}, Float64},
    node_priors::Dict{Int64, Float64},
    source_nodes::Set{Int64},
)
    n = length(path_edge_sets)
    n == 0 && return 0.0

    # Node sets per path (all nodes except final target)
    path_node_sets = Vector{Set{Int64}}()
    for path_edges in path_edge_sets
        nodes = Set{Int64}()
        for (src, dst) in path_edges
            push!(nodes, src)
            dst != path_edges[end][2] && push!(nodes, dst)
        end
        push!(path_node_sets, nodes)
    end

    total = 0.0
    for mask in 1:(2^n - 1)
        sub_edges = Vector{Vector{Tuple{Int64,Int64}}}()
        sub_nodes = Vector{Set{Int64}}()
        for i in 0:(n-1)
            if (mask & (1 << i)) != 0
                push!(sub_edges, path_edge_sets[i+1])
                push!(sub_nodes, path_node_sets[i+1])
            end
        end
        union_edges = pe_union_of_edge_sets(sub_edges)
        union_nodes = reduce(union, sub_nodes)

        p = 1.0
        for node in union_nodes
            p *= node_priors[node]
        end
        for edge in union_edges
            p *= edge_probs[edge]
        end

        sign = iseven(count_ones(mask)) ? -1 : 1
        total += sign * p
    end
    return total
end

function path_enumeration_sinks(
    outgoing_index::Dict{Int64,Set{Int64}},
    incoming_index::Dict{Int64,Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64, Float64},
    edge_probs::Dict{Tuple{Int64,Int64}, Float64},
    max_paths::Int,
)
    all_nodes = sort!(collect(union(Set(keys(outgoing_index)), Set(keys(incoming_index)),
                                    reduce(union, values(incoming_index), init=Set{Int64}()),
                                    reduce(union, values(outgoing_index), init=Set{Int64}()))))
    sink_nodes = [n for n in all_nodes
                  if !haskey(outgoing_index, n) || isempty(outgoing_index[n])]

    results   = Dict{Int64, Float64}()
    skipped   = Dict{Int64, Int}()   # node => n_paths (why skipped)

    for node in sink_nodes
        all_paths = Vector{Vector{Int64}}()
        for src in source_nodes
            append!(all_paths, pe_find_all_paths(outgoing_index, src, node))
        end

        if isempty(all_paths)
            results[node] = 0.0
            continue
        end

        if length(all_paths) > max_paths
            skipped[node] = length(all_paths)
            continue
        end

        path_edge_sets = [[( p[i], p[i+1] ) for i in 1:length(p)-1] for p in all_paths]

        p_path = pe_inclusion_exclusion(path_edge_sets, edge_probs, node_priors, source_nodes)
        results[node] = node_priors[node] * p_path
    end

    return results, skipped, sink_nodes
end

# ============================================================================
# IPA runner (same as other scripts)
# ============================================================================

function run_ipa(paths)
    edgelist, outgoing_index, incoming_index, source_nodes_vec =
        read_graph_to_dict(paths.edges)
    node_priors        = read_node_priors_from_json(paths.priors)
    link_probabilities = read_edge_probabilities_from_json(paths.links)
    source_nodes = Set(source_nodes_vec)

    fork_nodes, join_nodes =
        identify_fork_and_join_nodes(outgoing_index, incoming_index)
    iteration_sets, ancestors, descendants =
        find_iteration_sets(edgelist, outgoing_index, incoming_index)
    root_diamonds, unique_diamonds = new_identify(
        edgelist, node_priors, link_probabilities,
        Set{Int64}(source_nodes), Set{Int64}(fork_nodes), Set{Int64}(join_nodes),
        ancestors, descendants, iteration_sets
    )
    beliefs = update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, link_probabilities,
        descendants, ancestors,
        root_diamonds, join_nodes, fork_nodes,
        unique_diamonds
    )

    return beliefs, edgelist, outgoing_index, incoming_index,
           source_nodes, node_priors, link_probabilities
end

function net_paths(name)
    d         = joinpath(PE_DIR, name)
    json_stem = replace(name, "_" => "-")
    return (
        edges  = joinpath(d, name * ".EDGES"),
        priors = joinpath(d, "float", json_stem * "-nodepriors.json"),
        links  = joinpath(d, "float", json_stem * "-linkprobabilities.json"),
    )
end

# ============================================================================
# Main
# ============================================================================

function main_pe()
    log_path = joinpath(PE_DIR,
        "path_enum_vs_ipa_$(Dates.format(Dates.now(), "yyyymmdd_HHMMSS")).log")

    log_file = open(log_path, "w")
    io = TeeStream(stdout, log_file)

    println(io, "Path Enumeration vs IPA — Sanity Check")
    println(io, "Generated : $(Dates.format(Dates.now(), "yyyy-mm-dd HH:MM:SS"))")
    println(io, "Max paths for inclusion-exclusion: $MAX_PATHS  (2^$MAX_PATHS = $(2^MAX_PATHS) subsets)")

    for name in PE_NETWORKS
        println(io, "\n" * "=" ^ 80)
        println(io, "Network : $name")
        println(io, "=" ^ 80)

        p = net_paths(name)

        # --- IPA ---
        println(io, "\nRunning IPA...")
        t_ipa = @elapsed begin
            ipa_beliefs, edgelist, outgoing_index, incoming_index,
            source_nodes, node_priors, link_probabilities = run_ipa(p)
        end
        println(io, "IPA done: $(round(t_ipa, digits=3)) s")

        # --- Path Enumeration ---
        println(io, "Running path enumeration (sink nodes only, max_paths=$MAX_PATHS)...")
        t_pe = @elapsed begin
            pe_beliefs, skipped, sink_nodes =
                path_enumeration_sinks(outgoing_index, incoming_index,
                                       source_nodes, node_priors, link_probabilities,
                                       MAX_PATHS)
        end
        println(io, "Path enumeration done: $(round(t_pe, digits=3)) s")

        n_computed = length(pe_beliefs)
        n_skipped  = length(skipped)
        n_sinks    = length(sink_nodes)
        println(io, "Sinks computed: $n_computed / $n_sinks  (skipped: $n_skipped, too many paths)")

        # --- Comparison ---
        errors = Float64[]
        for (node, pe_val) in pe_beliefs
            ipa_val = get(ipa_beliefs, node, NaN)
            isnan(ipa_val) && continue
            push!(errors, abs(ipa_val - pe_val))
        end

        if !isempty(errors)
            println(io, "\nIPA vs Path Enumeration (computed nodes):")
            @printf(io, "  Max |Δ|  = %.8f\n", maximum(errors))
            @printf(io, "  Mean |Δ| = %.8f\n", mean(errors))
            @printf(io, "  Nodes within 1e-6: %d / %d\n",
                    count(e -> e < 1e-6, errors), length(errors))
            @printf(io, "  Nodes within 1e-4: %d / %d\n",
                    count(e -> e < 1e-4, errors), length(errors))
        end

        # Full per-sink table
        println(io, "\nPer-sink comparison:")
        @printf(io, "  %-6s  %-12s  %-12s  %-10s  %s\n",
                "Node", "IPA", "PathEnum", "|Δ|", "Status")
        println(io, "  " * "-"^60)
        for node in sort(sink_nodes)
            ipa_val = get(ipa_beliefs, node, NaN)
            if haskey(pe_beliefs, node)
                pe_val = pe_beliefs[node]
                err    = abs(ipa_val - pe_val)
                flag   = err > 1e-4 ? " ← MISMATCH" : ""
                @printf(io, "  %-6d  %-12.8f  %-12.8f  %-10.2e  computed%s\n",
                        node, ipa_val, pe_val, err, flag)
            elseif haskey(skipped, node)
                @printf(io, "  %-6d  %-12.8f  %-12s  %-10s  SKIPPED (%d paths > %d)\n",
                        node, ipa_val, "—", "—", skipped[node], MAX_PATHS)
            else
                @printf(io, "  %-6d  %-12.8f  %-12s  %-10s  no paths\n",
                        node, ipa_val, "0.0", "—")
            end
        end

        # Skipped node summary
        if !isempty(skipped)
            println(io, "\nSkipped nodes (path count > $MAX_PATHS):")
            for (node, n_paths) in sort(collect(skipped), by=x->-x[2])
                ipa_val = get(ipa_beliefs, node, NaN)
                @printf(io, "  Node %-6d  IPA=%.6f  n_paths=%d\n", node, ipa_val, n_paths)
            end
        end
    end

    close(log_file)
    println("\nDone. Log: $log_path")
end

main_pe()
