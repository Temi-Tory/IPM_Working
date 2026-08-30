# Reliability

The Reliability toolkit computes the **belief** of every node — the probability that it operates and is actually reached from a source — by exact conditional enumeration over the network's diamond structure, not by simulation. It needs a node-priors file and a link-probabilities file for at least one scenario; see [Preparing Your Data](/docs/data-formats) for their exact shape.

## Value forms, kept honest

Every input — and every result — can be one of three forms, and the interface never collapses one form into another to make a table tidier:

- **Deterministic** (`float64`) — a single number.
- **Interval** — a `[lower, upper]` bound.
- **Probability box** (`pbox`) — a bounded family of distributions, summarised by its bounding curves and moments.

A belief under an interval scenario is shown as a range everywhere it appears, not as its midpoint — with one deliberate exception: a few clearly-labelled *aggregate statistic* tiles (mean, worst-node) use a midpoint (interval) or mean-midpoint (p-box) so a single summary number is possible at all. That flattening never happens for a per-node value.

## The four tabs

- **Belief** — the per-node belief table for the selected scenario, plus summary statistics: nodes analysed, **conditioning width** (the largest conditioning set the network forced — see [Diamond Patterns](/docs/diamond-analysis)), mean belief, mean belief at sinks (if the network has any), the worst- and best-believed node, mean and max **band width** (how wide the uncertainty is, node by node), and computation time.
- **Diamonds** — the reconvergence structure identified for this scenario: every maximal diamond, filterable by conditioning-set size and by whether it has nested sub-diamonds, each opening into a detail view. The same structure is browsable on its own, across scenarios, from the standalone **Diamonds** page in the left nav — useful when you want to see reconvergence before committing to a full belief run.
- **Visualisation** — the network drawn by layer, with the scenario's full conditioning set (every fixed node, across every diamond the decomposition posed — maximal and nested) highlighted.
- **Compare** — pick any subset of the network's scenarios, run the ones that haven't been run yet (chained, one at a time — nothing assumes the server can safely handle two analyses in flight together), and see them side by side in one table, with a baseline scenario selectable for deltas.

## Isolating and promoting a diamond

Opening a diamond's detail view lets you run an analysis on that diamond *alone*, treated as a standalone network, with its local source nodes' values overridable — useful for investigating a reconvergence that dominates the network's overall uncertainty without the rest of the network diluting the picture. From there you can also **promote** the diamond: upload it as a new, independent network of its own, which switches the interface over to it.

## Diamond identification, cached

Diamond decomposition is genuinely the expensive step in this toolkit — it's computed once per network + input combination and cached, keyed by the content of the structure and prior files, so editing one input invalidates only the diamond store that depends on it. A propagation request that follows a decomposition, or a second scenario run under the same diamond structure, reuses the cache rather than recomputing it.
