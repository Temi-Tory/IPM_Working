# Overview

The Information Propagation Framework analyses a network's reliability, flow capacity, and schedule under uncertainty — without you writing any code. You upload a network and its inputs as plain files; the interface runs the analyses and shows you the results, with every uncertain value kept exactly as uncertain as it was given.

## What it computes

The framework is a Julia analysis engine behind three toolkits:

- **Reliability** — the probability that a signal or influence reaches each node, computed exactly by conditioning on the network's diamond structure rather than approximated by Monte Carlo. Accepts deterministic, interval, or probability-box inputs, and returns the same form back.
- **Flow** — maximum throughput, bottlenecks, minimum cuts, and structural connectivity, under deterministic (Float64) capacities.
- **Schedule (CPM)** — critical-path time and cost analysis, with a choice of propagation modes (longest path, shortest path, max-scaling, accumulation).

Underneath Reliability's exact computation is **diamond decomposition** — the framework's way of finding every point in the network where independent paths reconverge, so the analysis can condition on exactly the nodes that make those paths dependent, instead of either assuming independence (wrong) or enumerating every path (too slow). The [Diamond Patterns](/docs/diamond-analysis) topic covers this on its own, because it's useful independently of running a full belief-propagation pass.

## How the interface is organised

This is a **local client and a local server**: a Julia process on your machine exposes the analyses over HTTP, and the browser interface you're looking at drives it. Nothing leaves your computer — no account, no telemetry, no remote service in the path. Every session — the network you uploaded, the results you've computed — lives as ordinary files on disk that you own.

The interface follows the same order this documentation does:

1. **Upload** a network (structure + one or more scenarios of inputs).
2. **Network** — see the structure the framework derived: node roles, layers, connectivity — before running anything.
3. **Diamonds** — see the reconvergence structure on its own, decomposition without belief propagation.
4. The three toolkits — **Reliability**, **Flow**, **Schedule** — each with its own tabs for running a scenario, viewing results, and comparing several scenarios side by side.
5. **Cross-Scenario Profile** — every scenario you've run, across all three toolkits, set side by side.

A toolkit is reachable once its inputs exist on the loaded network — Reliability needs node priors and link probabilities, Flow needs a capacities file, Schedule needs a CPM inputs file. The interface doesn't hide a toolkit you haven't unlocked yet; it shows why, so it's never a mystery why a page is disabled.

## What the interface does not do

The interface is a window onto the framework, not a second implementation of it. It computes no score, ranking, or recommendation of its own — a "bottleneck" or "single point of failure" shown here is exactly what the corresponding analysis returned, not a threshold this interface invented. Where a value is uncertain (an interval or a probability-box), it stays an interval or a probability-box everywhere it's shown; nothing here silently collapses it to a single number to make a table tidier.
