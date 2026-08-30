# Warm-runtime timing for the psplib-j301_1 passes reported in
# dag_ntwrk_files/psplib-j301_1/RESULTS.md — same "call once to pay first-call
# JIT compilation, discard it, time the second call" convention already used
# in validation/cpm_v2/case_studies.jl's own "Warm runtimes" section, called
# directly against CriticalPathV2Module (no HTTP — the server's own request
# parsing/JSON envelope isn't what these numbers are meant to measure).
#
# Usage: julia --project=InfoPropFrmwrk time_psplib_modes.jl

using JSON

const REPO_ROOT = dirname(@__FILE__)
const NET = joinpath(REPO_ROOT, "dag_ntwrk_files", "psplib-j301_1")

include(joinpath(REPO_ROOT, "InfoPropFrmwrk", "src", "Algorithms", "InfoPropFramework.jl"))
using .InfoPropFramework
const CPV2 = InfoPropFramework.CriticalPathV2Module
using .InfoPropFramework: read_graph_to_dict, find_iteration_sets

edgelist, outgoing_index, incoming_index, source_nodes =
    read_graph_to_dict(joinpath(NET, "j301_1.EDGES"))
iteration_sets, _, _ = find_iteration_sets(edgelist, outgoing_index, incoming_index)

function load_float(cpm_relpath)
    ta = JSON.parsefile(joinpath(NET, cpm_relpath))["time_analysis"]
    nv = Dict{Int64,Float64}(parse(Int64, k) => Float64(v) for (k, v) in ta["node_durations"])
    ev = Dict{Tuple{Int64,Int64},Float64}()
    for (k, v) in get(ta, "edge_delays", Dict())
        m = match(r"\((\d+),\s*(\d+)\)", k)
        ev[(parse(Int64, m[1]), parse(Int64, m[2]))] = Float64(v)
    end
    (nv, ev)
end

function load_interval(cpm_relpath)
    ta = JSON.parsefile(joinpath(NET, cpm_relpath))["time_analysis"]
    to_iv(v) = v isa AbstractDict ?
        CPV2.ValueInterval(min(Float64(v["lower"]), Float64(v["upper"])), max(Float64(v["lower"]), Float64(v["upper"]))) :
        (x = Float64(v); CPV2.ValueInterval(x, x))
    nv = Dict{Int64,CPV2.ValueInterval}(parse(Int64, k) => to_iv(v) for (k, v) in ta["node_durations"])
    ev = Dict{Tuple{Int64,Int64},CPV2.ValueInterval}()
    for (k, v) in get(ta, "edge_delays", Dict())
        m = match(r"\((\d+),\s*(\d+)\)", k)
        ev[(parse(Int64, m[1]), parse(Int64, m[2]))] = to_iv(v)
    end
    (nv, ev)
end

nv_f, ev_f = load_float("float/j301_1-cpm-inputs.json")
nv_i, ev_i = load_interval("interval/j301_1-cpm-inputs.json")

# warm up once (discarded), time the second call — not an average over many
# reps, matching the "two runs, report the second" convention as literally
# as the single-shot passes being timed allow.
function warm_time(f)
    r1 = f()
    t = @elapsed (r2 = f())
    (r2, t)
end

println("=== float / LongestPath ===")
r, t = warm_time(() -> CPV2.analyze(iteration_sets, outgoing_index, incoming_index, source_nodes,
                                     nv_f, ev_f; mode=CPV2.LONGEST_PATH, initial=0.0, atol=1e-6))
println("project_value=$(r.project_value)  time=$(round(t; digits=5))s")

println("=== float / ShortestPath ===")
r, t = warm_time(() -> CPV2.analyze(iteration_sets, outgoing_index, incoming_index, source_nodes,
                                     nv_f, ev_f; mode=CPV2.SHORTEST_PATH, initial=0.0, atol=1e-6))
println("project_value=$(r.project_value)  time=$(round(t; digits=5))s")

println("=== float / Accumulation ===")
r, t = warm_time(() -> CPV2.accumulation_analysis(iteration_sets, outgoing_index, incoming_index,
                                                   source_nodes, nv_f, ev_f; initial=0.0))
println("total=$(r.total)  time=$(round(t; digits=5))s")

println("=== interval / LongestPath (domination split) ===")
r, t = warm_time(() -> CPV2.interval_analyze_split(iteration_sets, outgoing_index, incoming_index,
                                                    source_nodes, nv_i, ev_i; mode=CPV2.LONGEST_PATH,
                                                    atol=1e-6, max_runs=2_000_000))
println("method=$(r.method)  corner_count=$(r.corner_count)  time=$(round(t; digits=5))s")
