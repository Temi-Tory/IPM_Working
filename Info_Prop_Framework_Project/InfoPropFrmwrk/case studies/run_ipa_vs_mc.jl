if !isdefined(Main, :InfoPropFramework)
    include(joinpath(@__DIR__, "..", "InfoPropFrmwrk", "src", "Algorithms", "InfoPropFramework.jl"))
    using .InfoPropFramework
end
using Statistics, Printf, Dates

if !isdefined(Main, :MC_result_optimized)
    include(joinpath(@__DIR__, "..", "src", "Network-flow-algos", "src", "Algorithms", "MC_Optimized.jl"))
end

if !isdefined(Main, :TeeStream)
    struct TeeStream <: IO
        console::IO
        file::IO
    end
    Base.write(t::TeeStream, b::UInt8)         = (write(t.console, b); write(t.file, b); 1)
    Base.write(t::TeeStream, b::Vector{UInt8}) = (write(t.console, b); write(t.file, b); length(b))
    Base.flush(t::TeeStream)                   = (flush(t.console); flush(t.file))
end

# ============================================================================
# Network list — (name, base_directory)
# Post-fix timings: PP1 ~13s, PP3 ~9s, PP5 ~10s
# ============================================================================

const CASE_STUDY_DIR_V = @__DIR__

const MC_SAMPLE_SIZES = [10_000, 100_000, 1_000_000]

const PARETO_NETWORKS = [
    ("munin-dag",                               CASE_STUDY_DIR_V),
    ("metro_directed_dag_for_ipm",              CASE_STUDY_DIR_V),
    ("pareto-point-1-high-resilience-fw",       CASE_STUDY_DIR_V),
    ("pareto-point-2-high-resilience-vtol",     CASE_STUDY_DIR_V),
    ("pareto-point-3-medium-resilience-sparse", CASE_STUDY_DIR_V),
    ("pareto-point-4-low-resilience-minimal",   CASE_STUDY_DIR_V),
    ("pareto-point-5-medium-resilience-fw",     CASE_STUDY_DIR_V),
    ("pareto-point-6-balanced",                 CASE_STUDY_DIR_V),
]

function pareto_paths(name, base)
    d         = joinpath(base, name)
    json_stem = replace(name, "_" => "-")
    return (
        edges  = joinpath(d, name * ".EDGES"),
        priors = joinpath(d, "float", json_stem * "-nodepriors.json"),
        links  = joinpath(d, "float", json_stem * "-linkprobabilities.json"),
    )
end

# ============================================================================
# Phase 1 — load network and run IPA once, cache everything
# ============================================================================

struct NetworkCache
    name               :: String
    ipa_beliefs        :: Dict
    edgelist           :: Vector
    outgoing_index     :: Dict
    incoming_index     :: Dict
    source_nodes       :: Set
    node_priors        :: Dict
    link_probabilities :: Dict
    all_nodes          :: Vector
    sink_nodes         :: Set
    t_ipa              :: Float64
end

function load_and_run_ipa(name, base)
    paths = pareto_paths(name, base)

    edgelist, outgoing_index, incoming_index, source_nodes_vec =
        read_graph_to_dict(paths.edges)
    node_priors        = read_node_priors_from_json(paths.priors)
    link_probabilities = read_edge_probabilities_from_json(paths.links)

    source_nodes = Set(source_nodes_vec)
    all_nodes    = sort!(collect(union(Set(first.(edgelist)), Set(last.(edgelist)))))
    sink_nodes   = Set(n for n in all_nodes
                       if !haskey(outgoing_index, n) || isempty(outgoing_index[n]))

    t_ipa = @elapsed begin
        fork_nodes, join_nodes =
            identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants =
            find_iteration_sets(edgelist, outgoing_index, incoming_index)
        root_diamonds, unique_diamonds = new_identify(
            edgelist, node_priors, link_probabilities,
            Set{Int64}(source_nodes), Set{Int64}(fork_nodes), Set{Int64}(join_nodes),
            ancestors, descendants, iteration_sets
        )
        ipa_beliefs = update_beliefs_iterative(
            edgelist, iteration_sets, outgoing_index, incoming_index,
            source_nodes, node_priors, link_probabilities,
            descendants, ancestors,
            root_diamonds, join_nodes, fork_nodes,
            unique_diamonds
        )
    end

    return NetworkCache(name, ipa_beliefs, edgelist, outgoing_index, incoming_index,
                        source_nodes, node_priors, link_probabilities,
                        all_nodes, sink_nodes, t_ipa)
end

# ============================================================================
# Phase 2 — run MC only against cached IPA beliefs, log one network section
# ============================================================================

function run_mc_for_cached(c::NetworkCache, mc_n::Int, io::IO)
    println(io, "\n" * "=" ^ 72)
    println(io, "Network : $(c.name)")
    println(io, "=" ^ 72)
    println(io, "IPA done  : $(round(c.t_ipa, digits=3)) s  (pre-computed)")

    println(io, "Running MC (N=$mc_n)...")
    t_mc = @elapsed begin
        mc_beliefs = MC_result_optimized(
            c.edgelist, c.outgoing_index, c.incoming_index,
            c.source_nodes, c.node_priors, c.link_probabilities,
            mc_n
        )
    end
    println(io, "MC done   : $(round(t_mc, digits=3)) s")

    errors_all  = Float64[]
    errors_sink = Float64[]
    for n in c.all_nodes
        ipa = get(c.ipa_beliefs, n, NaN)
        mc  = get(mc_beliefs,   n, NaN)
        (isnan(ipa) || isnan(mc)) && continue
        err = abs(ipa - mc)
        push!(errors_all, err)
        n in c.sink_nodes && push!(errors_sink, err)
    end

    max_err_all   = maximum(errors_all)
    mean_err_all  = mean(errors_all)
    max_err_sink  = isempty(errors_sink) ? NaN : maximum(errors_sink)
    mean_err_sink = isempty(errors_sink) ? NaN : mean(errors_sink)

    println(io, "\nAccuracy (all nodes)   — max |Δ| = $(round(max_err_all,  digits=6))   mean |Δ| = $(round(mean_err_all,  digits=6))")
    println(io, "Accuracy (sinks only)  — max |Δ| = $(round(max_err_sink, digits=6))   mean |Δ| = $(round(mean_err_sink, digits=6))")

    println(io, "\nSink nodes — IPA vs MC:")
    println(io, "  $(rpad("Node",6)) $(rpad("IPA",12)) $(rpad("MC",12)) $(rpad("|Δ|",10))")
    println(io, "  " * "-"^44)
    for n in sort(collect(c.sink_nodes))
        ipa = get(c.ipa_beliefs, n, NaN)
        mc  = get(mc_beliefs,   n, NaN)
        err = abs(ipa - mc)
        println(io, "  $(rpad(string(n),6)) $(rpad(string(round(ipa,digits=6)),12)) $(rpad(string(round(mc,digits=6)),12)) $(round(err,digits=6))")
    end

    return (
        name          = c.name,
        n_nodes       = length(c.all_nodes),
        n_sinks       = length(c.sink_nodes),
        t_ipa         = c.t_ipa,
        t_mc          = t_mc,
        max_err_all   = max_err_all,
        mean_err_all  = mean_err_all,
        max_err_sink  = max_err_sink,
        mean_err_sink = mean_err_sink,
    )
end

# ============================================================================
# Summary table
# ============================================================================

function print_mc_summary(results, mc_n::Int, io::IO)
    println(io, "\n\n" * "=" ^ 100)
    println(io, "IPA vs MC VALIDATION SUMMARY  (MC N=$(mc_n))")
    println(io, "=" ^ 100)
    println(io)
    @printf(io, "%-38s | %4s | %4s | %8s | %8s | %10s | %10s | %10s | %10s\n",
            "Network", "V", "Sk", "IPA(s)", "MC(s)", "MaxΔ(all)", "MeanΔ(all)", "MaxΔ(sink)", "MeanΔ(sink)")
    println(io, "-" ^ 100)
    for r in results
        short = length(r.name) > 38 ? r.name[1:35]*"..." : r.name
        @printf(io, "%-38s | %4d | %4d | %8.3f | %8.3f | %10.6f | %10.6f | %10.6f | %10.6f\n",
                short, r.n_nodes, r.n_sinks,
                r.t_ipa, r.t_mc,
                r.max_err_all, r.mean_err_all,
                r.max_err_sink, r.mean_err_sink)
    end
    println(io)
    println(io, "Expected max |Δ| ≈ 1/√N = $(round(1/sqrt(mc_n), digits=5)) (MC sampling noise floor at N=$(mc_n))")
end

# ============================================================================
# Run — IPA once per network, then MC at each sample size in separate logs
# ============================================================================

function main_mc()
    timestamp = Dates.format(Dates.now(), "yyyymmdd_HHMMSS")

    # Phase 1: IPA for all networks (runs once)
    println("\n" * "#" ^ 72)
    println("# Phase 1 — IPA pre-computation (runs once for all networks)")
    println("#" ^ 72)
    caches = NetworkCache[]
    for (name, base) in PARETO_NETWORKS
        print("  IPA: $name ... ")
        c = load_and_run_ipa(name, base)
        push!(caches, c)
        println("$(round(c.t_ipa, digits=3)) s")
    end
    println("# Phase 1 complete.\n")

    # Phase 2: MC at each sample size
    all_results = Dict{Int, Vector}()
    for mc_n in MC_SAMPLE_SIZES
        log_path = joinpath(CASE_STUDY_DIR_V,
                            "ipa_vs_mc_N$(mc_n)_$(timestamp).log")

        println("#" ^ 72)
        println("# Phase 2 — MC N=$mc_n  |  Log: $log_path")
        println("#" ^ 72)

        open(log_path, "w") do log_file
            io = TeeStream(stdout, log_file)

            println(io, "IPA vs Monte Carlo Validation")
            println(io, "Generated : $(Dates.format(Dates.now(), "yyyy-mm-dd HH:MM:SS"))")
            println(io, "MC N      : $mc_n")
            println(io, "Networks  : $(length(caches))")

            results = []
            for c in caches
                push!(results, run_mc_for_cached(c, mc_n, io))
            end

            print_mc_summary(results, mc_n, io)
            all_results[mc_n] = results
        end

        println("Done N=$mc_n — log saved to: $log_path\n")
    end

    return all_results
end

mc_results = main_mc()
