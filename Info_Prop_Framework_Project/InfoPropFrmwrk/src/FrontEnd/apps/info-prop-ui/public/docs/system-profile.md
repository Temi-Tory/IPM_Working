# Cross-Scenario Profile

The **Profile** page sets every scenario you've run — across Reliability, Flow, and Schedule alike — side by side on one network. It computes nothing of its own; every number and every highlighted node here came straight from a run you already did in one of the three toolkits.

## Scenario roster

A table of every distinct scenario **name** found on this network, and which of the three toolkits has actually run it. A network's scenario folder often carries inputs for more than one toolkit at once — the same `Degraded/` folder might hold both a capacities file and a nodepriors/link-probabilities pair — so this is the one place that shows coverage across all three at a glance, rather than reading three separate toolkit tables to piece it together.

## Scenarios side by side, per toolkit

Each toolkit's own metrics, compared within that toolkit — a table per toolkit, since the units genuinely differ (a mean belief and a maximum throughput aren't comparable numbers, and the interface never invents a way to make them so). Pick a baseline scenario within a table to see every other scenario's delta against it.

## Result sets on the network

Every analysis that identifies a node or edge set — bottlenecks, single points of failure, critical-path activities, a diamond's conditioning set — writes that set back as a labelled **result set**. This section draws one on the network, and optionally a second one **compared alongside it**:

- nodes/edges in only the first result set are drawn in one colour
- nodes/edges in only the second (the "compare with" set) in a second colour
- nodes/edges in **both** in a third colour, with a count — this is usually the most informative reading: a node both Flow flags as a bottleneck and Reliability's decomposition names as a conditioning node is a genuinely compounding structural concern, and the drawing makes that visible directly rather than requiring you to cross-reference two separate screenshots.

Click any node in the drawing to see whether it belongs to either result set, and its value there if the result set carries one (e.g. a diamond's conditioning-node reliability, or a bottleneck edge's saturation).

## What this page deliberately doesn't do

No score, ranking, or recommendation is computed anywhere on this page. A "bottleneck" here is exactly the set Flow's own solved minimum cut returned; a "conditioning set" is exactly what Reliability's diamond decomposition found. If you want a genuine cross-toolkit ranking of scenarios, that has to come from a real analysis endpoint — this page is a window onto results that already exist, not a second implementation that judges them.
