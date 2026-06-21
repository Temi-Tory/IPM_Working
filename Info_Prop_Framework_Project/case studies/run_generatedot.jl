using Printf

"""
generate_dot_files.jl

Mirrors the front-end top-down hierarchical layout:
  - Longest-path layering: node layer = max(parent layers) + 1
  - Degree-proportional node sizing
  - nodesep / ranksep / font scale automatically with network size
  - splines=curved (smooth edge routing matching front-end)
  - Source=green, sink=red, regular=blue  (same as front-end legend)

Usage:
  julia generate_dot_files.jl           # all networks
  julia generate_dot_files.jl <name>    # single network
"""

# ============================================================================
# Networks
# ============================================================================

const NETWORKS = [
    "munin-dag",
    "metro_directed_dag_for_ipm",
    "pareto-point-1-high-resilience-fw",
    "pareto-point-2-high-resilience-vtol",
    "pareto-point-3-medium-resilience-sparse",
    "pareto-point-4-low-resilience-minimal",
    "pareto-point-5-medium-resilience-fw",
    "pareto-point-6-balanced",
]

# ============================================================================
# Edge reading
# ============================================================================

function read_edges(path::String)
    edges    = Tuple{Int,Int}[]
    outgoing = Dict{Int,Vector{Int}}()
    incoming = Dict{Int,Vector{Int}}()
    all_nodes = Set{Int}()

    open(path) do f
        for line in eachline(f)
            line = strip(line)
            isempty(line) && continue
            isdigit(line[1]) || continue          # skip header
            parts = split(line, ',')
            length(parts) == 2 || continue
            s = parse(Int, strip(parts[1]))
            d = parse(Int, strip(parts[2]))
            push!(edges, (s, d))
            push!(all_nodes, s); push!(all_nodes, d)
            push!(get!(outgoing, s, Int[]), d)
            push!(get!(incoming, d, Int[]), s)
        end
    end
    return edges, all_nodes, outgoing, incoming
end

# ============================================================================
# Longest-path layering  (matches front-end: layer = max(parent layers) + 1)
# ============================================================================

function assign_layers(all_nodes, outgoing, incoming)
    layers = Dict{Int,Int}()

    # Sources at layer 0
    for n in all_nodes
        (!haskey(incoming, n) || isempty(incoming[n])) && (layers[n] = 0)
    end

    # Relax until stable — longest path from any source
    changed = true
    while changed
        changed = false
        for n in all_nodes
            preds = get(incoming, n, Int[])
            isempty(preds) && continue
            all(haskey(layers, p) for p in preds) || continue
            new_layer = maximum(layers[p] for p in preds) + 1
            if get(layers, n, -1) != new_layer
                layers[n] = new_layer
                changed = true
            end
        end
    end

    # Fallback for any disconnected nodes
    for n in all_nodes
        haskey(layers, n) || (layers[n] = 0)
    end

    return layers
end

# ============================================================================
# Per-node degree → width mapping  (mirrors front-end degree-sized circles)
# ============================================================================

function node_widths(all_nodes, outgoing, incoming, base_width::Float64)
    degrees = Dict{Int,Int}()
    for n in all_nodes
        degrees[n] = length(get(outgoing, n, Int[])) +
                     length(get(incoming, n, Int[]))
    end
    max_deg = max(1, maximum(values(degrees)))

    widths = Dict{Int,Float64}()
    for n in all_nodes
        # Scale: base_width for degree-0/1 nodes, up to 2.5× for max-degree
        ratio = degrees[n] / max_deg
        widths[n] = base_width * (1.0 + 1.5 * ratio)
    end
    return widths, degrees
end

# ============================================================================
# Layout parameter scaling  (keeps the graph readable at any size)
# ============================================================================

function layout_params(n_nodes::Int, n_layers::Int, max_layer_width::Int)
    # nodesep: shrink as the widest layer grows
    nodesep = clamp(3.0 / max_layer_width, 0.08, 0.7)

    # ranksep: shrink as the number of layers grows
    ranksep = clamp(4.0 / n_layers, 0.25, 1.2)

    # Base node width: shrink for very large graphs
    base_width = if n_nodes > 500;  0.18
                 elseif n_nodes > 200; 0.25
                 elseif n_nodes > 80;  0.35
                 else               0.45
                 end

    # Font size scales with node size
    fontsize = if base_width < 0.22; 7
               elseif base_width < 0.30; 9
               elseif base_width < 0.40; 10
               else 11
               end

    # Arrow / pen scale with node size
    arrowsize = clamp(base_width * 5.0, 0.5, 2.0)
    penwidth  = clamp(base_width * 5.0, 0.8, 2.2)

    return (nodesep=nodesep, ranksep=ranksep, base_width=base_width,
            fontsize=fontsize, arrowsize=arrowsize, penwidth=penwidth)
end

# Munin-specific overrides — manually tuned to match desired output
const MUNIN_PARAMS = (
    base_width = 0.89,
    fontsize   = 12,
    arrowsize  = 2.9,
    penwidth   = 3.89,
)

# ============================================================================
# DOT writer
# ============================================================================

function write_dot(name::String, dot_path::String,
                   edges, all_nodes, outgoing, incoming, layers;
                   use_rank_groups::Bool = true,
                   forced_size::Union{String,Nothing} = nothing,
                   munin_overrides::Bool = false)

    # Layer groups
    layer_groups = Dict{Int,Vector{Int}}()
    for n in all_nodes
        push!(get!(layer_groups, layers[n], Int[]), n)
    end
    n_layers       = length(layer_groups)
    max_layer_width = maximum(length(v) for v in values(layer_groups))
    n_nodes        = length(all_nodes)

    p = layout_params(n_nodes, n_layers, max_layer_width)
    if munin_overrides
        p = (nodesep    = p.nodesep,
             ranksep    = p.ranksep,
             base_width = MUNIN_PARAMS.base_width,
             fontsize   = MUNIN_PARAMS.fontsize,
             arrowsize  = MUNIN_PARAMS.arrowsize,
             penwidth   = MUNIN_PARAMS.penwidth)
    end
    widths, degrees = node_widths(all_nodes, outgoing, incoming, p.base_width)

    source_set = Set(n for n in all_nodes if !haskey(incoming, n) || isempty(incoming[n]))

    open(dot_path, "w") do f
        println(f, "digraph \"$(name)\" {")

        # ── Layout ───────────────────────────────────────────────────
        println(f, "    // Layout")
        println(f, "    rankdir    = TB;")
        println(f, "    splines    = line;")
        @printf(f, "    nodesep    = %.2f;\n", p.nodesep)
        @printf(f, "    ranksep    = %.2f;\n", p.ranksep)
        if forced_size !== nothing
            println(f, "    size        = \"$(forced_size)\";")
            println(f, "    ratio       = fill;")   # stretch to fill the box
            println(f, "    concentrate = true;")   # merge parallel edges
        end
        println(f)

        # ── Default node style ────────────────────────────────────────
        println(f, "    // Default node style")
        println(f, "    node [")
        println(f, "        shape     = circle,")
        println(f, "        style     = filled,")
        println(f, "        fillcolor = \"#aaaaaa\",")   # neutral grey default
        println(f, "        fontcolor = \"#ffffff\",")
        println(f, "        fontname  = \"Helvetica-Bold\",")
        println(f, "        fontsize  = $(p.fontsize),")
        @printf(f, "        width     = %.2f,\n", p.base_width)
        @printf(f, "        height    = %.2f,\n", p.base_width)
        println(f, "        fixedsize = false")          # allow degree scaling
        println(f, "    ];")
        println(f)

        # ── Default edge style ────────────────────────────────────────
        println(f, "    // Default edge style")
        println(f, "    edge [")
        @printf(f, "        arrowsize = %.1f,\n", p.arrowsize)
        @printf(f, "        penwidth  = %.1f\n",  p.penwidth)
        println(f, "    ];")
        println(f)

        # ── Per-node declarations ─────────────────────────────────────
        # Colouring:
        #   source (in-degree = 0)  → green  #859900
        #   join   (in-degree ≥ 2)  → blue   #268bd2
        #   all others              → grey   #aaaaaa
        println(f, "    // Node declarations (colour + degree-proportional size)")
        for n in sort(collect(all_nodes))
            w      = widths[n]
            in_deg = length(get(incoming, n, Int[]))
            color  = if n in source_set; "#859900"   # green — source
                     elseif in_deg >= 2; "#268bd2"   # blue  — join node
                     else               "#aaaaaa"    # grey  — regular/sink
                     end
            @printf(f, "    %d [fillcolor=\"%s\", width=%.2f, height=%.2f];\n",
                    n, color, w, w)
        end
        println(f)

        # ── Rank groups ───────────────────────────────────────────────
        if use_rank_groups
            println(f, "    // Layer rank groups (longest-path layering)")
            for layer in sort(collect(keys(layer_groups)))
                ids = join(string.(sort(layer_groups[layer])), "; ")
                println(f, "    { rank=same; $ids }")
            end
            println(f)
        end

        # ── Edges ─────────────────────────────────────────────────────
        println(f, "    // Edges")
        for (s, d) in sort(edges)
            println(f, "    $s -> $d;")
        end

        println(f, "}")
    end
end

# ============================================================================
# Path helpers
# ============================================================================

function edges_path(name::String, base_dir::String = @__DIR__)
    c1 = joinpath(base_dir, name, name * ".EDGES")
    c2 = joinpath(base_dir, replace(name, "-" => "_"),
                  replace(name, "-" => "_") * ".EDGES")
    isfile(c1) && return c1
    isfile(c2) && return c2
    return c1
end

dot_output_path(name, base_dir = @__DIR__) = joinpath(base_dir, name * ".dot")

# ============================================================================
# Per-network entry point
# ============================================================================

function process_network(name::String, base_dir::String = @__DIR__)
    ep = edges_path(name, base_dir)
    if !isfile(ep)
        @warn "EDGES file not found, skipping: $ep"
        return false
    end

    edges, all_nodes, outgoing, incoming = read_edges(ep)
    if isempty(edges)
        @warn "No edges found in $ep, skipping."
        return false
    end

    layers = assign_layers(all_nodes, outgoing, incoming)

    layer_groups    = Dict{Int,Vector{Int}}()
    for n in all_nodes; push!(get!(layer_groups, layers[n], Int[]), n); end
    n_layers        = length(layer_groups)
    max_layer_width = maximum(length(v) for v in values(layer_groups))
    p               = layout_params(length(all_nodes), n_layers, max_layer_width)

    dp = dot_output_path(name, base_dir)
    use_ranks   = (name != "munin-dag")
    force_size  = (name == "munin-dag") ? "60,35!" : nothing
    write_dot(name, dp, edges, all_nodes, outgoing, incoming, layers;
              use_rank_groups = use_ranks,
              forced_size     = force_size,
              munin_overrides = (name == "munin-dag"))

    println("  Written : $(basename(dp))")
    println("  Stats   : $(length(all_nodes)) nodes, $(length(edges)) edges, " *
            "$n_layers layers, widest layer=$max_layer_width")
    println("  Params  : nodesep=$(round(p.nodesep,digits=2)), " *
            "ranksep=$(round(p.ranksep,digits=2)), " *
            "base_width=$(p.base_width), fontsize=$(p.fontsize)")

    # Render PNG
    pp = replace(dp, r"\.dot$" => ".png")
    if Sys.which("dot") !== nothing
        ret = run(ignorestatus(`dot -Tpng $dp -o $pp`))
        ret.exitcode == 0 ? println("  Rendered: $(basename(pp))") :
                            @warn "Graphviz failed (exit $(ret.exitcode))"
    else
        @warn "Graphviz 'dot' not on PATH — skipping PNG for $name"
    end

    return true
end

# ============================================================================
# Main
# ============================================================================

function main()
    base_dir = @__DIR__
    targets  = isempty(ARGS) ? NETWORKS : ARGS

    println("DOT file generator  (longest-path layering + degree-scaled nodes)")
    println("Base directory : $base_dir")
    println("Networks       : $(length(targets))")
    println()

    ok = 0
    for name in targets
        println("[$name]")
        process_network(name, base_dir) && (ok += 1)
        println()
    end

    println("Done — $ok / $(length(targets)) DOT + PNG files written.")
    println()
    println("Other render formats:")
    println("  dot -Tsvg <name>.dot -o <name>.svg")
    println("  dot -Tpdf <name>.dot -o <name>.pdf")
end

main()