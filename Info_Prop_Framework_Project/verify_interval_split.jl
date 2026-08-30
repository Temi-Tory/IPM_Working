# Diagnostic: check whether CriticalPathV2Module.interval_analyze_split can
# actually solve a given interval CPM instance, independent of the HTTP
# handler's own routing/fallback logic and its (sometimes misleading)
# messages — see dag_ntwrk_files/psplib-j301_1/RESULTS.md for the finding
# this script produced on that instance.
#
# Usage: julia --project=InfoPropFrmwrk verify_interval_split.jl <network-dir> <cpm-relative-path>
#   e.g.  julia --project=InfoPropFrmwrk verify_interval_split.jl \
#           dag_ntwrk_files/psplib-j301_1 interval/j301_1-cpm-inputs.json
#
# Reports, independently of the server:
#   - the split's own cost model (max/mean bypass-set size, total run count)
#   - whether that cost is under max_runs (so a "too expensive" explanation
#     can be ruled in or out before blaming the fallback on it)
#   - the real outcome of calling interval_analyze_split directly, and if it
#     throws, which node(s) trigger it and by how much

using JSON

const REPO_ROOT = dirname(@__FILE__)

include(joinpath(REPO_ROOT, "InfoPropFrmwrk", "src", "Algorithms", "InfoPropFramework.jl"))
using .InfoPropFramework
const CPV2 = InfoPropFramework.CriticalPathV2Module
using .InfoPropFramework: read_graph_to_dict, find_iteration_sets

function main(net_dir::String, cpm_relpath::String; max_runs::Int = 2_000_000)
    net = joinpath(REPO_ROOT, net_dir)
    edges_path = only(filter(f -> endswith(lowercase(f), ".edges"), readdir(net; join=true)))
    cpm_path = joinpath(net, cpm_relpath)

    edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(edges_path)
    iteration_sets, _, _ = find_iteration_sets(edgelist, outgoing_index, incoming_index)

    cpm = JSON.parsefile(cpm_path)
    ta = cpm["time_analysis"]
    to_interval(v) = v isa AbstractDict ?
        CPV2.ValueInterval(min(Float64(v["lower"]), Float64(v["upper"])), max(Float64(v["lower"]), Float64(v["upper"]))) :
        (x = Float64(v); CPV2.ValueInterval(x, x))
    node_values = Dict{Int64,CPV2.ValueInterval}(parse(Int64, k) => to_interval(v) for (k, v) in ta["node_durations"])
    edge_values = Dict{Tuple{Int64,Int64},CPV2.ValueInterval}()
    for (k, v) in get(ta, "edge_delays", Dict())
        m = match(r"\((\d+),\s*(\d+)\)", k)
        edge_values[(parse(Int64, m[1]), parse(Int64, m[2]))] = to_interval(v)
    end

    kvar = count(!CPV2.is_degenerate, values(node_values)) + count(!CPV2.is_degenerate, values(edge_values))
    nodes = sort!(collect(Set(n for layer in iteration_sets for n in layer)))
    varn = sort!([k for (k, v) in node_values if !CPV2.is_degenerate(v)])
    anc, desc = CPV2._closure_sets(iteration_sets, incoming_index, outgoing_index)

    Hsizes = Int[]; total = 0
    for v in nodes
        S, T = CPV2._bypass_sets(v, nodes, outgoing_index, incoming_index)
        H = Int64[]
        for u in varn
            dominated = u == v || (u in anc[v] && !(u in S)) || (u in desc[v] && !(u in T))
            incomparable = !dominated && !(u in anc[v]) && !(u in desc[v])
            (dominated || incomparable) || push!(H, u)
        end
        push!(Hsizes, length(H)); total += 2 * (1 << length(H))
    end

    println("kvar = $kvar   max|H_v| = $(maximum(Hsizes))   mean|H_v| = $(sum(Hsizes)/length(Hsizes))")
    println("split total run count = $total   (max_runs = $max_runs)   fits budget? $(total <= max_runs)")

    run_it() = CPV2.interval_analyze_split(iteration_sets, outgoing_index, incoming_index, source_nodes,
                                            node_values, edge_values; mode=CPV2.LONGEST_PATH, atol=1e-6,
                                            max_runs=max_runs)
    try
        run_it()  # warm-up: pays first-call JIT compilation, discarded
        t = @elapsed (res = run_it())  # second, warm call — the one that's reported
        println("SUCCEEDED (warm, 2nd call) — method=$(res.method) corner_count=$(res.corner_count) time=$(round(t; digits=4))s")
        println("necessarily_critical = $(res.necessarily_critical)")
        println("possibly_critical = $(res.possibly_critical)")
        return res
    catch e
        println("THREW $(typeof(e)): $(sprint(showerror, e))")
        e isa ArgumentError || rethrow()

        # narrow down which node(s) actually misbehave, rather than stopping
        # at the first one interval_analyze_split's own loop hits
        mode = CPV2.LONGEST_PATH; atol = 1e-6
        plans = Dict{Int64,Tuple{Vector{Int64},Dict{Int64,Symbol}}}()
        for v in nodes
            S, T = CPV2._bypass_sets(v, nodes, outgoing_index, incoming_index)
            H = Int64[]; rule = Dict{Int64,Symbol}()
            for u in varn
                if u == v || (u in anc[v] && !(u in S)) || (u in desc[v] && !(u in T))
                    rule[u] = :dominated
                elseif !(u in anc[v]) && !(u in desc[v])
                    rule[u] = :incomparable
                else
                    push!(H, u)
                end
            end
            plans[v] = (H, rule)
        end
        w0 = Dict{Tuple{Int64,Int64},Float64}(e2 => v.lo for (e2, v) in edge_values)
        d = Dict{Int64,Float64}(kk => vv.lo for (kk, vv) in node_values)
        println("nodes where fminus > fplus (the ValueInterval that throws):")
        for v in nodes
            H, rule = plans[v]
            fplus = -Inf; fminus = Inf
            for (target_hi, store) in ((true, :plus), (false, :minus))
                for u in varn
                    r = get(rule, u, :H)
                    if r == :incomparable
                        d[u] = target_hi ? node_values[u].hi : node_values[u].lo
                    elseif r == :dominated
                        d[u] = target_hi ? node_values[u].lo : node_values[u].hi
                    end
                end
                for mask in 0:(1 << length(H)) - 1
                    for (i, u) in enumerate(H)
                        d[u] = (mask >> (i - 1)) & 1 == 1 ? node_values[u].hi : node_values[u].lo
                    end
                    r = CPV2.analyze(iteration_sets, outgoing_index, incoming_index, source_nodes, d, w0;
                                      mode = mode, atol = atol)
                    store == :plus ? (fplus = max(fplus, r.margin[v])) : (fminus = min(fminus, r.margin[v]))
                end
            end
            fminus > fplus && println("  node $v: fminus=$fminus fplus=$fplus gap=$(fminus - fplus)")
        end
        return nothing
    end
end

if abspath(PROGRAM_FILE) == @__FILE__
    length(ARGS) >= 2 || error("usage: julia verify_interval_split.jl <network-dir> <cpm-relative-path>")
    main(ARGS[1], ARGS[2])
end
