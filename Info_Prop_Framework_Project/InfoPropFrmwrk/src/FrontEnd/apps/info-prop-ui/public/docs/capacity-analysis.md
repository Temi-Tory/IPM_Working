# Flow

The Flow toolkit computes maximum throughput, bottlenecks, and structural connectivity from a network's edge (and optionally node) capacities. It needs a capacities file for at least one scenario, and unlike Reliability it works on deterministic (`Float64`) capacities only — the underlying algorithms hard-reject any other value form.

## Configure

Pick a scenario and a max-flow **solver**:

| Solver | Best for |
|---|---|
| **Dinic** | The default for most layered DAGs |
| **Edmonds–Karp** | Smaller networks and debugging |
| **Push–Relabel** | Dense or high fan-out networks |

Alongside the solver, you can set the numerical tolerance, the failure-combination size (`k`) for the k-edge failure sweep, enumeration limits for cuts and paths, an optional target throughput for the parametric threshold search, and optional degradation multipliers to sweep several reduced-capacity scenarios in one run.

## Summary

The headline numbers for a run: maximum throughput, minimum-cut capacity, baseline throughput at the input capacities, the number of source-to-sink paths, how many edges are saturated (running at exactly their capacity), the cut's "free-zone size" (how many equally-minimal cuts exist — a degeneracy measure), the count of structural single points of failure, and how many distinct minimum cuts were found.

## Bottlenecks

Where the network's throughput is actually constrained:

- **edges in every minimum cut** — remove any one and the network's max flow necessarily drops; these are unconditional bottlenecks
- **edges in at least one minimum cut** — bottlenecks under *some* optimal cut, not necessarily all
- **structural SPOF nodes** — single points of failure: nodes whose removal disconnects some source from some sink, independent of capacity
- **edge redundancy** — a per-edge score naming how much spare alternate capacity exists around it, ascending, so the most fragile edges surface first
- **edge connectivity λ** and **node connectivity κ** — the network's global structural connectivity: the minimum number of edges, or nodes, whose removal disconnects some source from some sink

None of this is a threshold the interface invented — every figure here is exactly what the solved flow returned; the table only reports it.

## Visualization

The network drawn by layer, edges and nodes coloured by the solved flow state — saturated edges, edges in every minimum cut, and structural SPOF nodes each get their own colour, with a legend.

## Compare

Pick any subset of the network's flow scenarios, run the ones that haven't been run yet — chained, one at a time — and see them side by side in one table, with a baseline scenario selectable for deltas.
