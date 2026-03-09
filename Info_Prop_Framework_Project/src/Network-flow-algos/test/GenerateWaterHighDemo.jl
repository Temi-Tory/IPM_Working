"""
GenerateWaterHighDemo.jl

Topology-aware scenario generator for high-value WATER demos.
- Uses InputProcessing outputs (incoming/outgoing, ancestors/descendants, iteration sets)
- Produces backend-compatible JSONs for reachability, capacity, and CPM
- Writes a new pack under dag_ntwrk_files/water-highvdemo (same .EDGES topology as water)
"""

using JSON
using Dates

include("../src/IPAFrameworkOptimized.jl")
using .IPAFrameworkOptimized

const PROJECT_ROOT = normpath(joinpath(@__DIR__, "..", "..", ".."))
const SOURCE_NETWORK_DIR = joinpath(PROJECT_ROOT, "dag_ntwrk_files", "water")
const TARGET_NETWORK_DIR = joinpath(PROJECT_ROOT, "dag_ntwrk_files", "water-highvdemo")
const SOURCE_EDGES_FILE = joinpath(SOURCE_NETWORK_DIR, "water.EDGES")
const TARGET_EDGES_FILE = joinpath(TARGET_NETWORK_DIR, "water-highvdemo.EDGES")

struct TopologyProfile
    edgelist::Vector{Tuple{Int64, Int64}}
    outgoing::Dict{Int64, Set{Int64}}
    incoming::Dict{Int64, Set{Int64}}
    source_nodes::Set{Int64}
    sink_nodes::Set{Int64}
    iteration_sets::Vector{Set{Int64}}
    ancestors::Dict{Int64, Set{Int64}}
    descendants::Dict{Int64, Set{Int64}}
    node_level::Dict{Int64, Int64}
    indegree::Dict{Int64, Int64}
    outdegree::Dict{Int64, Int64}
    influence::Dict{Int64, Float64}
    hubs::Vector{Int64}
    primary_hub::Int64
    secondary_hub::Int64
    bottleneck_edges::Vector{Tuple{Int64, Int64}}
end

role_base_prior(role::Symbol)::Float64 =
    role == :source ? 0.84 :
    role == :sink ? 0.80 :
    role == :hub ? 0.77 :
    role == :merge ? 0.75 :
    role == :split ? 0.76 : 0.74

role_base_capacity(role::Symbol)::Float64 =
    role == :source ? 72.0 :
    role == :sink ? 88.0 :
    role == :hub ? 82.0 :
    role == :merge ? 78.0 :
    role == :split ? 76.0 : 74.0

role_base_duration(role::Symbol)::Float64 =
    role == :source ? 1.8 :
    role == :sink ? 1.5 :
    role == :hub ? 3.8 :
    role == :merge ? 3.2 :
    role == :split ? 2.4 : 2.7

role_base_cost(role::Symbol)::Float64 =
    role == :source ? 140.0 :
    role == :sink ? 120.0 :
    role == :hub ? 300.0 :
    role == :merge ? 250.0 :
    role == :split ? 210.0 : 220.0

clamp01(x::Float64) = max(0.01, min(0.99, x))
clamp_pos(x::Float64) = max(0.01, x)
round4(x::Real) = round(Float64(x), digits=4)

interval_value(lower::Real, upper::Real) = Dict(
    "type" => "interval",
    "lower" => round4(min(lower, upper)),
    "upper" => round4(max(lower, upper))
)

edge_key(e::Tuple{Int64, Int64}) = "($(e[1]),$(e[2]))"

function classify_role(node::Int64, topo::TopologyProfile)::Symbol
    if node in topo.source_nodes
        return :source
    elseif node in topo.sink_nodes
        return :sink
    elseif node == topo.primary_hub || node == topo.secondary_hub
        return :hub
    elseif topo.indegree[node] >= 3
        return :merge
    elseif topo.outdegree[node] >= 3
        return :split
    else
        return :process
    end
end

function build_topology_profile(edges_file::String)::TopologyProfile
    edgelist, outgoing, incoming, source_nodes = read_graph_to_dict(edges_file)
    iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing, incoming)

    all_nodes = Set{Int64}(keys(incoming))
    sink_nodes = Set(filter(n -> !haskey(outgoing, n) || isempty(outgoing[n]), collect(all_nodes)))

    node_level = Dict{Int64, Int64}()
    for (level_idx, level_set) in enumerate(iteration_sets)
        for node in level_set
            node_level[node] = level_idx
        end
    end

    indegree = Dict{Int64, Int64}(n => length(get(incoming, n, Set{Int64}())) for n in all_nodes)
    outdegree = Dict{Int64, Int64}(n => length(get(outgoing, n, Set{Int64}())) for n in all_nodes)

    influence = Dict{Int64, Float64}()
    for node in all_nodes
        influence[node] = (
            1.5 * indegree[node] +
            1.0 * outdegree[node] +
            0.25 * length(get(ancestors, node, Set{Int64}())) +
            0.25 * length(get(descendants, node, Set{Int64}()))
        )
    end

    candidates = [n for n in all_nodes if !(n in source_nodes) && !(n in sink_nodes)]
    sorted_hubs = sort(candidates, by = n -> (-influence[n], -indegree[n], -outdegree[n], n))
    primary_hub = sorted_hubs[1]
    secondary_hub = sorted_hubs[min(2, length(sorted_hubs))]

    primary_out = sort(collect(get(outgoing, primary_hub, Set{Int64}())), by = n -> -influence[n])
    bottleneck_edges = Tuple{Int64, Int64}[]
    for dst in Iterators.take(primary_out, 2)
        push!(bottleneck_edges, (primary_hub, dst))
    end

    if isempty(bottleneck_edges)
        for edge in edgelist
            if edge[1] == primary_hub
                push!(bottleneck_edges, edge)
                break
            end
        end
    end

    return TopologyProfile(
        edgelist,
        outgoing,
        incoming,
        source_nodes,
        sink_nodes,
        iteration_sets,
        ancestors,
        descendants,
        node_level,
        indegree,
        outdegree,
        influence,
        sorted_hubs,
        primary_hub,
        secondary_hub,
        bottleneck_edges
    )
end

function generate_float_reachability(topo::TopologyProfile; prior_shift::Float64=0.0, edge_shift::Float64=0.0,
    degrade_nodes::Dict{Int64, Float64}=Dict{Int64, Float64}(), degrade_edges::Dict{Tuple{Int64,Int64}, Float64}=Dict{Tuple{Int64,Int64}, Float64}())

    max_level = maximum(values(topo.node_level))
    priors = Dict{String, Float64}()
    links = Dict{String, Float64}()

    for node in sort(collect(keys(topo.node_level)))
        role = classify_role(node, topo)
        lvl = topo.node_level[node]
        level_factor = (max_level - lvl) * 0.01
        centrality_boost = min(0.05, topo.influence[node] * 0.002)
        p = role_base_prior(role) + level_factor + centrality_boost + prior_shift
        p += get(degrade_nodes, node, 0.0)
        priors[string(node)] = round4(clamp01(p))
    end

    for edge in topo.edgelist
        src, dst = edge
        src_role = classify_role(src, topo)
        base = src_role == :hub ? 0.90 : src_role == :source ? 0.91 : 0.88
        merge_bonus = topo.indegree[dst] >= 3 ? -0.01 : 0.0
        p = base + edge_shift + merge_bonus
        p += get(degrade_edges, edge, 0.0)
        links[edge_key(edge)] = round4(clamp01(p))
    end

    return priors, links
end

function generate_float_capacity(
    topo::TopologyProfile,
    priors::Dict{String, Float64},
    links::Dict{String, Float64};
    source_rate_multiplier::Float64,
    node_capacity_multiplier::Float64,
    edge_capacity_multiplier::Float64,
    force_node_caps::Dict{Int64, Float64}=Dict{Int64, Float64}(),
    force_edge_caps::Dict{Tuple{Int64,Int64}, Float64}=Dict{Tuple{Int64,Int64}, Float64}()
)
    node_caps = Dict{String, Float64}()
    edge_caps = Dict{String, Float64}()
    source_rates = Dict{String, Float64}()

    for node in sort(collect(keys(topo.node_level)))
        role = classify_role(node, topo)
        prior = priors[string(node)]
        cap = role_base_capacity(role) * node_capacity_multiplier * (0.78 + 0.5 * prior)
        if haskey(force_node_caps, node)
            cap = force_node_caps[node]
        end
        node_caps[string(node)] = round4(clamp_pos(cap))
    end

    for edge in topo.edgelist
        p = links[edge_key(edge)]
        src, _ = edge
        src_role = classify_role(src, topo)
        edge_base = src_role == :hub ? 62.0 : src_role == :source ? 58.0 : 54.0
        cap = edge_base * edge_capacity_multiplier * (0.70 + 0.55 * p)
        if haskey(force_edge_caps, edge)
            cap = force_edge_caps[edge]
        end
        edge_caps[edge_key(edge)] = round4(clamp_pos(cap))
    end

    for source in sort(collect(topo.source_nodes))
        prior = priors[string(source)]
        rate = 24.0 * source_rate_multiplier * (0.70 + 0.55 * prior)
        source_rates[string(source)] = round4(clamp_pos(rate))
    end

    return node_caps, edge_caps, source_rates
end

function generate_float_cpm(
    topo::TopologyProfile,
    priors::Dict{String, Float64},
    links::Dict{String, Float64};
    time_multiplier::Float64,
    cost_multiplier::Float64,
    duration_node_factor::Dict{Int64, Float64}=Dict{Int64, Float64}(),
    delay_edge_factor::Dict{Tuple{Int64,Int64}, Float64}=Dict{Tuple{Int64,Int64}, Float64}(),
    cost_node_factor::Dict{Int64, Float64}=Dict{Int64, Float64}(),
    cost_edge_factor::Dict{Tuple{Int64,Int64}, Float64}=Dict{Tuple{Int64,Int64}, Float64}()
)
    node_durations = Dict{String, Float64}()
    edge_delays = Dict{String, Float64}()
    node_costs = Dict{String, Float64}()
    edge_costs = Dict{String, Float64}()

    for node in sort(collect(keys(topo.node_level)))
        role = classify_role(node, topo)
        prior = priors[string(node)]

        d = role_base_duration(role) * time_multiplier * (1.20 - 0.45 * prior)
        d *= get(duration_node_factor, node, 1.0)
        node_durations[string(node)] = round4(clamp_pos(d))

        c = role_base_cost(role) * cost_multiplier * (1.28 - 0.30 * prior)
        c *= get(cost_node_factor, node, 1.0)
        node_costs[string(node)] = round4(clamp_pos(c))
    end

    for edge in topo.edgelist
        p = links[edge_key(edge)]
        delay = 1.6 * time_multiplier * (1.30 - 0.60 * p)
        delay *= get(delay_edge_factor, edge, 1.0)
        edge_delays[edge_key(edge)] = round4(clamp_pos(delay))

        ecost = 68.0 * cost_multiplier * (1.35 - 0.50 * p)
        ecost *= get(cost_edge_factor, edge, 1.0)
        edge_costs[edge_key(edge)] = round4(clamp_pos(ecost))
    end

    return node_durations, edge_delays, node_costs, edge_costs
end

function to_interval_map_float(base_map::Dict{String, Float64}; low_factor::Float64, high_factor::Float64)
    out = Dict{String, Dict{String, Any}}()
    for (k, v) in base_map
        out[k] = interval_value(v * low_factor, v * high_factor)
    end
    return out
end

function to_interval_map_edges(base_map::Dict{String, Float64}; low_factor::Float64, high_factor::Float64)
    out = Dict{String, Dict{String, Any}}()
    for (k, v) in base_map
        out[k] = interval_value(v * low_factor, v * high_factor)
    end
    return out
end

function write_scenario_files(
    scenario_dir::String,
    network_name::String,
    scenario_name::String,
    scenario_intent::String,
    data_type::String,
    node_priors,
    link_probs,
    node_caps,
    edge_caps,
    source_rates,
    node_durations,
    edge_delays,
    node_costs,
    edge_costs,
    targets::Vector{Int64}
)
    mkpath(scenario_dir)

    reachability_json = Dict(
        "nodes" => node_priors,
        "data_type" => data_type,
        "serialization" => "compact",
        "scenario_intent" => scenario_intent,
        "description" => "Reachability inputs for $network_name - $scenario_name"
    )

    links_json = Dict(
        "links" => link_probs,
        "data_type" => data_type,
        "serialization" => "compact",
        "scenario_intent" => scenario_intent,
        "description" => "Link probabilities for $network_name - $scenario_name"
    )

    capacities_json = Dict(
        "network_type" => "capacity_flow",
        "data_type" => data_type,
        "capacities" => Dict(
            "nodes" => node_caps,
            "source_rates" => source_rates,
            "edges" => edge_caps
        ),
        "target_nodes" => targets,
        "scenario_intent" => scenario_intent,
        "description" => "Capacity inputs for $network_name - $scenario_name",
        "generation_info" => Dict(
            "generator" => "GenerateWaterHighDemo.jl",
            "timestamp" => string(now()),
            "total_nodes" => length(node_priors),
            "total_edges" => length(link_probs)
        )
    )

    cpm_json = Dict(
        "network_type" => "critical_path",
        "data_type" => data_type,
        "time_analysis" => Dict(
            "edge_delays" => edge_delays,
            "combination_function" => "max_combination",
            "initial_time" => data_type == "Interval" ? interval_value(0.0, 0.0) : 0.0,
            "analysis_type" => "longest_path_time",
            "propagation_function" => "additive_propagation",
            "node_durations" => node_durations
        ),
        "cost_analysis" => Dict(
            "initial_cost" => data_type == "Interval" ? interval_value(0.0, 0.0) : 0.0,
            "combination_function" => "max_combination",
            "node_costs" => node_costs,
            "analysis_type" => "total_project_cost",
            "propagation_function" => "additive_propagation",
            "edge_costs" => edge_costs
        ),
        "scenario_intent" => scenario_intent,
        "description" => "CPM inputs for $network_name - $scenario_name",
        "generation_info" => Dict(
            "generator" => "GenerateWaterHighDemo.jl",
            "timestamp" => string(now()),
            "total_nodes" => length(node_priors),
            "total_edges" => length(link_probs)
        )
    )

    open(joinpath(scenario_dir, "$(network_name)-nodepriors.json"), "w") do io
        JSON.print(io, reachability_json, 2)
    end
    open(joinpath(scenario_dir, "$(network_name)-linkprobabilities.json"), "w") do io
        JSON.print(io, links_json, 2)
    end
    open(joinpath(scenario_dir, "$(network_name)-capacities.json"), "w") do io
        JSON.print(io, capacities_json, 2)
    end
    open(joinpath(scenario_dir, "$(network_name)-cpm-inputs.json"), "w") do io
        JSON.print(io, cpm_json, 2)
    end
end

function ensure_target_network(topo::TopologyProfile)
    mkpath(TARGET_NETWORK_DIR)

    if !isfile(TARGET_EDGES_FILE)
        content = read(SOURCE_EDGES_FILE, String)
        open(TARGET_EDGES_FILE, "w") do io
            write(io, content)
        end
    end

    topology_summary = Dict(
        "network" => "water-highvdemo",
        "derived_from" => SOURCE_EDGES_FILE,
        "primary_hub" => topo.primary_hub,
        "secondary_hub" => topo.secondary_hub,
        "bottleneck_edges" => [edge_key(e) for e in topo.bottleneck_edges],
        "source_nodes" => sort(collect(topo.source_nodes)),
        "sink_nodes" => sort(collect(topo.sink_nodes)),
        "iteration_levels" => [sort(collect(s)) for s in topo.iteration_sets],
        "timestamp" => string(now())
    )

    open(joinpath(TARGET_NETWORK_DIR, "topology-summary.json"), "w") do io
        JSON.print(io, topology_summary, 2)
    end
end

function generate_scenarios(topo::TopologyProfile)
    network_name = "water-highvdemo"
    targets = sort(collect(topo.sink_nodes))

    bottleneck_edge_force = Dict{Tuple{Int64,Int64}, Float64}(e => 12.0 for e in topo.bottleneck_edges)

    scenario_specs = [
        (
            "01 Source Limited",
            "Capacity constrained by conservative source injection with healthy downstream redundancy.",
            :float,
            (prior_shift=-0.01, edge_shift=0.02, degrade_nodes=Dict{Int64,Float64}(), degrade_edges=Dict{Tuple{Int64,Int64},Float64}()),
            (source_rate_multiplier=0.50, node_capacity_multiplier=1.15, edge_capacity_multiplier=1.10, force_node_caps=Dict{Int64,Float64}(), force_edge_caps=Dict{Tuple{Int64,Int64},Float64}()),
            (time_multiplier=1.00, cost_multiplier=1.00, duration_node_factor=Dict{Int64,Float64}(), delay_edge_factor=Dict{Tuple{Int64,Int64},Float64}(), cost_node_factor=Dict{Int64,Float64}(), cost_edge_factor=Dict{Tuple{Int64,Int64},Float64}())
        ),
        (
            "02 Edge Bottleneck",
            "Transmission bottleneck at dominant hub outgoing edges under high source pressure.",
            :float,
            (prior_shift=0.00, edge_shift=0.01, degrade_nodes=Dict{Int64,Float64}(), degrade_edges=Dict(e => -0.10 for e in topo.bottleneck_edges)),
            (source_rate_multiplier=1.45, node_capacity_multiplier=1.00, edge_capacity_multiplier=1.00, force_node_caps=Dict{Int64,Float64}(), force_edge_caps=bottleneck_edge_force),
            (time_multiplier=1.03, cost_multiplier=1.04, duration_node_factor=Dict{Int64,Float64}(), delay_edge_factor=Dict(e => 1.40 for e in topo.bottleneck_edges), cost_node_factor=Dict{Int64,Float64}(), cost_edge_factor=Dict(e => 1.35 for e in topo.bottleneck_edges))
        ),
        (
            "03 Node Bottleneck",
            "Processing bottleneck at central merge hubs while link quality remains strong.",
            :float,
            (prior_shift=-0.01, edge_shift=0.02, degrade_nodes=Dict(topo.primary_hub => -0.08, topo.secondary_hub => -0.05), degrade_edges=Dict{Tuple{Int64,Int64},Float64}()),
            (source_rate_multiplier=1.35, node_capacity_multiplier=1.00, edge_capacity_multiplier=1.05, force_node_caps=Dict(topo.primary_hub => 18.0, topo.secondary_hub => 27.0), force_edge_caps=Dict{Tuple{Int64,Int64},Float64}()),
            (time_multiplier=1.08, cost_multiplier=1.12, duration_node_factor=Dict(topo.primary_hub => 1.8, topo.secondary_hub => 1.35), delay_edge_factor=Dict{Tuple{Int64,Int64},Float64}(), cost_node_factor=Dict(topo.primary_hub => 1.7, topo.secondary_hub => 1.3), cost_edge_factor=Dict{Tuple{Int64,Int64},Float64}())
        ),
        (
            "04 Mixed Bottleneck",
            "Concurrent node and edge stress creates mixed bottleneck signature and harder upgrade ordering.",
            :float,
            (prior_shift=-0.02, edge_shift=0.00, degrade_nodes=Dict(topo.primary_hub => -0.06), degrade_edges=Dict(e => -0.08 for e in topo.bottleneck_edges)),
            (source_rate_multiplier=1.50, node_capacity_multiplier=0.96, edge_capacity_multiplier=0.96, force_node_caps=Dict(topo.primary_hub => 22.0), force_edge_caps=Dict(e => 15.0 for e in topo.bottleneck_edges)),
            (time_multiplier=1.15, cost_multiplier=1.18, duration_node_factor=Dict(topo.primary_hub => 1.6), delay_edge_factor=Dict(e => 1.55 for e in topo.bottleneck_edges), cost_node_factor=Dict(topo.primary_hub => 1.55), cost_edge_factor=Dict(e => 1.45 for e in topo.bottleneck_edges))
        ),
        (
            "05 CPM Time-Critical",
            "Schedule and cost criticality amplified around hub and choke arcs while capacity remains feasible.",
            :float,
            (prior_shift=0.00, edge_shift=0.00, degrade_nodes=Dict{Int64,Float64}(), degrade_edges=Dict{Tuple{Int64,Int64},Float64}()),
            (source_rate_multiplier=0.92, node_capacity_multiplier=1.02, edge_capacity_multiplier=1.00, force_node_caps=Dict{Int64,Float64}(), force_edge_caps=Dict{Tuple{Int64,Int64},Float64}()),
            (time_multiplier=1.30, cost_multiplier=1.25, duration_node_factor=Dict(topo.primary_hub => 2.15, topo.secondary_hub => 1.45), delay_edge_factor=Dict(e => 2.20 for e in topo.bottleneck_edges), cost_node_factor=Dict(topo.primary_hub => 1.85), cost_edge_factor=Dict(e => 1.95 for e in topo.bottleneck_edges))
        )
    ]

    for (scenario_name, intent, _, reach_cfg, cap_cfg, cpm_cfg) in scenario_specs
        scenario_dir = joinpath(TARGET_NETWORK_DIR, scenario_name)

        priors, links = generate_float_reachability(
            topo;
            prior_shift=reach_cfg.prior_shift,
            edge_shift=reach_cfg.edge_shift,
            degrade_nodes=reach_cfg.degrade_nodes,
            degrade_edges=reach_cfg.degrade_edges
        )

        node_caps, edge_caps, source_rates = generate_float_capacity(
            topo,
            priors,
            links;
            source_rate_multiplier=cap_cfg.source_rate_multiplier,
            node_capacity_multiplier=cap_cfg.node_capacity_multiplier,
            edge_capacity_multiplier=cap_cfg.edge_capacity_multiplier,
            force_node_caps=cap_cfg.force_node_caps,
            force_edge_caps=cap_cfg.force_edge_caps
        )

        node_durations, edge_delays, node_costs, edge_costs = generate_float_cpm(
            topo,
            priors,
            links;
            time_multiplier=cpm_cfg.time_multiplier,
            cost_multiplier=cpm_cfg.cost_multiplier,
            duration_node_factor=cpm_cfg.duration_node_factor,
            delay_edge_factor=cpm_cfg.delay_edge_factor,
            cost_node_factor=cpm_cfg.cost_node_factor,
            cost_edge_factor=cpm_cfg.cost_edge_factor
        )

        write_scenario_files(
            scenario_dir,
            network_name,
            scenario_name,
            intent,
            "Float64",
            priors,
            links,
            node_caps,
            edge_caps,
            source_rates,
            node_durations,
            edge_delays,
            node_costs,
            edge_costs,
            targets
        )
    end

    # Interval stress scenario derived from mixed bottleneck float baseline
    interval_name = "06 Interval Stress"
    interval_intent = "Wide uncertainty bounds around stressed hub and choke edges for robust worst/best-case analysis."
    interval_dir = joinpath(TARGET_NETWORK_DIR, interval_name)

    priors_f, links_f = generate_float_reachability(
        topo;
        prior_shift=-0.02,
        edge_shift=-0.01,
        degrade_nodes=Dict(topo.primary_hub => -0.07),
        degrade_edges=Dict(e => -0.09 for e in topo.bottleneck_edges)
    )

    node_caps_f, edge_caps_f, source_rates_f = generate_float_capacity(
        topo,
        priors_f,
        links_f;
        source_rate_multiplier=1.20,
        node_capacity_multiplier=0.95,
        edge_capacity_multiplier=0.93,
        force_node_caps=Dict(topo.primary_hub => 24.0, topo.secondary_hub => 29.0),
        force_edge_caps=Dict(e => 16.0 for e in topo.bottleneck_edges)
    )

    node_durations_f, edge_delays_f, node_costs_f, edge_costs_f = generate_float_cpm(
        topo,
        priors_f,
        links_f;
        time_multiplier=1.22,
        cost_multiplier=1.20,
        duration_node_factor=Dict(topo.primary_hub => 1.9),
        delay_edge_factor=Dict(e => 1.9 for e in topo.bottleneck_edges),
        cost_node_factor=Dict(topo.primary_hub => 1.6),
        cost_edge_factor=Dict(e => 1.55 for e in topo.bottleneck_edges)
    )

    node_priors_i = Dict{String, Dict{String, Any}}()
    for (k, v) in priors_f
        width = occursin(string(topo.primary_hub), k) ? 0.18 : 0.12
        node_priors_i[k] = interval_value(clamp01(v - width), clamp01(v + width))
    end

    links_i = Dict{String, Dict{String, Any}}()
    for (k, v) in links_f
        wide = any(k == edge_key(e) for e in topo.bottleneck_edges)
        spread = wide ? 0.20 : 0.12
        links_i[k] = interval_value(clamp01(v - spread), clamp01(v + spread))
    end

    node_caps_i = to_interval_map_float(node_caps_f; low_factor=0.74, high_factor=1.18)
    edge_caps_i = to_interval_map_edges(edge_caps_f; low_factor=0.70, high_factor=1.22)
    source_rates_i = to_interval_map_float(source_rates_f; low_factor=0.70, high_factor=1.20)
    node_durations_i = to_interval_map_float(node_durations_f; low_factor=0.85, high_factor=1.38)
    edge_delays_i = to_interval_map_edges(edge_delays_f; low_factor=0.88, high_factor=1.45)
    node_costs_i = to_interval_map_float(node_costs_f; low_factor=0.92, high_factor=1.42)
    edge_costs_i = to_interval_map_edges(edge_costs_f; low_factor=0.90, high_factor=1.40)

    write_scenario_files(
        interval_dir,
        network_name,
        interval_name,
        interval_intent,
        "Interval",
        node_priors_i,
        links_i,
        node_caps_i,
        edge_caps_i,
        source_rates_i,
        node_durations_i,
        edge_delays_i,
        node_costs_i,
        edge_costs_i,
        targets
    )

    manifest = Dict(
        "network" => network_name,
        "base_edges" => "water.EDGES",
        "generated_at" => string(now()),
        "generator" => "src/Network-flow-algos/test/GenerateWaterHighDemo.jl",
        "scenario_order" => [
            "01 Source Limited",
            "02 Edge Bottleneck",
            "03 Node Bottleneck",
            "04 Mixed Bottleneck",
            "05 CPM Time-Critical",
            "06 Interval Stress"
        ],
        "recommended_demo_order" => [
            "01 Source Limited",
            "02 Edge Bottleneck",
            "03 Node Bottleneck",
            "04 Mixed Bottleneck",
            "05 CPM Time-Critical",
            "06 Interval Stress"
        ],
        "notes" => [
            "Generated from topology metrics (in/out degree, ancestors/descendants, iteration levels)",
            "Inputs are backend-compatible for reachability, capacity and CPM endpoints",
            "Scenario names match increasing analytical complexity"
        ]
    )

    open(joinpath(TARGET_NETWORK_DIR, "SCENARIO_MANIFEST.json"), "w") do io
        JSON.print(io, manifest, 2)
    end
end

function main()
    if !isfile(SOURCE_EDGES_FILE)
        error("Source edges file not found: $SOURCE_EDGES_FILE")
    end

    println("🔧 Building topology profile from: $SOURCE_EDGES_FILE")
    topo = build_topology_profile(SOURCE_EDGES_FILE)

    println("📊 Nodes: $(length(topo.node_level)), Edges: $(length(topo.edgelist))")
    println("📌 Primary hub: $(topo.primary_hub), Secondary hub: $(topo.secondary_hub)")
    println("📌 Bottleneck edges: $(join([edge_key(e) for e in topo.bottleneck_edges], ", "))")

    ensure_target_network(topo)
    generate_scenarios(topo)

    println("✅ Generated high-value demo pack at: $TARGET_NETWORK_DIR")
end

main()
