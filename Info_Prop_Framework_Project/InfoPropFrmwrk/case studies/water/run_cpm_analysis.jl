if !isdefined(Main, :InfoPropFramework)
    include(joinpath(@__DIR__, "..", "..", "InfoPropFrmwrk", "src", "Algorithms", "InfoPropFramework.jl"))
    using .InfoPropFramework
end
using JSON

const EDGES_FILE = joinpath(@__DIR__, "water.EDGES")
const CPM_FILE   = joinpath(@__DIR__, "water-cpm-inputs.json")

function parse_edge_key(s::String)
    s = replace(replace(s, "(" => ""), ")" => "")
    parts = split(s, ",")
    return (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
end

function parse_node_values(raw::AbstractDict)
    return Dict{Int64, Float64}(parse(Int64, k) => Float64(v) for (k, v) in raw)
end

function parse_edge_values(raw::AbstractDict)
    return Dict{Tuple{Int64,Int64}, Float64}(parse_edge_key(k) => Float64(v) for (k, v) in raw)
end

function run_and_print(label, question, iteration_sets, outgoing_index, incoming_index,
                       source_nodes, node_values, edge_values,
                       combination_fn, propagation_fn, node_fn, initial_val)

    println("\n" * "=" ^ 60)
    println("Run: $label")
    println("Question: $question")
    println("Combination: $(nameof(combination_fn))   Propagation: $(nameof(propagation_fn))")
    println("=" ^ 60)

    params = CriticalPathParameters(
        node_values, edge_values, initial_val,
        combination_fn, propagation_fn, node_fn,
    )

    elapsed  = @elapsed begin
        forward  = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, params)
        extended = backward_pass_analysis(forward, iteration_sets, outgoing_index, params)
    end
    elapsed_us = round(elapsed * 1e6, digits=1)

    println("Critical value : $(round(forward.critical_value, digits=4)) units")
    println("Computation    : $(elapsed_us) μs")

    critical = sort!([n for (n, s) in extended.total_slack if s == 0.0])
    println("\nCritical path nodes (slack = 0):")
    for n in critical
        ef = round(get(forward.node_values, n, 0.0), digits=4)
        println("  Node $(lpad(n,2))   EF = $ef")
    end

    println("\nAll nodes (EF, slack):")
    println("  $(rpad("Node",6)) $(rpad("EF",12)) $(rpad("Slack",12)) Status")
    println("  " * "-"^46)
    for n in sort!(collect(keys(extended.total_slack)))
        ef     = round(get(forward.node_values, n, 0.0), digits=4)
        slack  = round(get(extended.total_slack, n, 0.0), digits=4)
        status = slack == 0.0 ? "CRITICAL" : (slack < 5.0 ? "near-critical" : "")
        println("  $(rpad(string(n),6)) $(rpad(string(ef),12)) $(rpad(string(slack),12)) $status")
    end

    sink_nodes = sort!([n for n in keys(forward.node_values)
                        if !haskey(outgoing_index, n) || isempty(outgoing_index[n])])
    println("\nSink nodes:")
    for n in sink_nodes
        ef    = round(get(forward.node_values, n, 0.0), digits=4)
        slack = round(get(extended.total_slack, n, 0.0), digits=4)
        println("  Node $(lpad(n,2))   EF = $ef   slack = $slack")
    end
end

println("=" ^ 60)
println("Water Network: Operator Agnosticity Demonstration")
println("Same network · same values · two operator configurations")
println("=" ^ 60)

edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(EDGES_FILE)
iteration_sets, _, _ = find_iteration_sets(edgelist, outgoing_index, incoming_index)

cpm_data    = JSON.parsefile(CPM_FILE)
node_values = parse_node_values(cpm_data["time_analysis"]["node_durations"])
edge_values = parse_edge_values(cpm_data["time_analysis"]["edge_delays"])

run_and_print(
    "1: max + additive",
    "What is the longest accumulating path? (dominant sequence, cannot slip)",
    iteration_sets, outgoing_index, incoming_index, source_nodes,
    node_values, edge_values,
    CriticalPathModule.max_combination,
    CriticalPathModule.additive_propagation,
    CriticalPathModule.additive_propagation,
    0.0
)

run_and_print(
    "2: sum + additive",
    "What is the total accumulated load? (aggregate effect across all paths)",
    iteration_sets, outgoing_index, incoming_index, source_nodes,
    node_values, edge_values,
    CriticalPathModule.sum_combination,
    CriticalPathModule.additive_propagation,
    CriticalPathModule.additive_propagation,
    0.0
)
