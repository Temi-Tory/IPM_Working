# Understanding Networks

Every analysis in the framework runs on the same underlying structure — a directed graph the server derives once, from your edge list, the first time it sees a network. The **Network** page shows exactly what that derivation found, before any analysis runs.

## Node roles

Every node is classified by its position in the graph:

| Role | Meaning |
|---|---|
| **Source** | No incoming edges — where a signal, flow, or schedule item originates |
| **Sink** | No outgoing edges — a terminal point |
| **Fork** | More than one outgoing edge — where paths split |
| **Join** | More than one incoming edge — where paths reconverge |
| **Regular** | None of the above — a single incoming, single outgoing pass-through node |

A node can hold more than one role at once (a fork can also be a join). Roles aren't declared in your input files — they're derived purely from the edge list's structure.

## Layers (iteration sets)

The framework processes a network in **topological layers**: source nodes first, then every node whose parents have already been processed, and so on until the sinks. Every drawing in the interface lays nodes out by layer, left to right (or top to bottom, in the compact views), so information visibly flows in the order the algorithms actually process it — not an arbitrary force-directed scatter.

This matters for reading the graph correctly: an edge always points from an earlier layer toward a later one. There are no cycles — the framework works on directed acyclic graphs (DAGs); a network with a cycle fails to load.

## The structure dashboard

Alongside the drawing, the Network page reports:

- total node and edge counts
- how many sources, sinks, forks, and joins the network has
- the number of layers
- ancestor/descendant reachability, used internally by diamond identification

This is worth checking before running anything. If a network you expected to have, say, three sources shows one, the input file almost always has a typo in a node ID or an edge direction reversed.

## Reconvergence and diamonds

A **fork** followed eventually by a **join** that both paths from that fork feed into is a **reconvergence** — the two paths aren't independent of each other, because they share the fork's own state. The framework calls this pattern a **diamond**, and it matters specifically for the Reliability toolkit's exact belief computation: treating the two paths as independent there would overstate the network's reliability, sometimes substantially. The [Diamond Patterns](/docs/diamond-analysis) topic covers how the framework finds and uses these.

## Visualising a large network

Every drawing in the interface is pannable and zoomable — drag or use the scrollbars to move around, scroll the wheel or use the +/− controls to zoom. There is no node-count cutoff: a network with hundreds of nodes draws in full, just not all visible at 100% zoom at once.
