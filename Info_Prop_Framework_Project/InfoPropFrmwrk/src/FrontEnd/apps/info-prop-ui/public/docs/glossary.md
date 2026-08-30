# Glossary

## Network structure

**Source** — a node with no incoming edges.
**Sink** — a node with no outgoing edges.
**Fork** — a node with more than one outgoing edge.
**Join** — a node with more than one incoming edge.
**Layer / iteration set** — a topological rank: every node one layer contains has had all of its parents processed in an earlier layer.
**Reconvergence** — where two paths that share a common fork meet again at a join, making the paths dependent on each other.

## Diamond decomposition

**Diamond** — a reconvergence, isolated as its own subgraph.
**Maximal diamond** — the full reconvergence structure at one join; every diamond join carries exactly one.
**Sub-diamond** — a diamond found *inside* another diamond, once you condition on the enclosing diamond's own fixed nodes. Its own conditioning set can differ from its parent's.
**Unique diamond** — any distinct diamond the decomposition found, at any nesting level, stored once. Every unique diamond is either a maximal diamond or a sub-diamond of one.
**Induced diamond** — a diamond with no sub-diamond of its own; the smallest a diamond can be.
**Conditioning set** (also: fixed nodes, the set *C*) — the smallest set of nodes a diamond must be fixed on to make its parents' signals independent. The propagation enumerates every state of this set.
**Conditioning width** — the size of the *largest* conditioning set the network forces, across every diamond (maximal and nested). The parameter that governs how expensive an exact analysis is.

## Value forms

**Deterministic** (`float64`) — a single known number.
**Interval** — a value known only to lie within `[lower, upper]`.
**Probability box** (`pbox`) — a bounded family of probability distributions, summarised by bounding curves and moments at a stated discretisation.
**Band width** — how wide a per-node uncertain value's own bound is (upper − lower for an interval; the same on the mean bound for a p-box).

## Reliability

**Belief** — the probability a node operates and is reached from a source.
**Exact inference** — computing belief exactly, by conditioning on diamond structure, rather than approximating it by simulation.

## Flow

**Max flow** — the greatest throughput the network can carry from its sources to its sinks under the given capacities.
**Minimum cut** — a smallest-capacity set of edges whose removal disconnects every source from every sink; its capacity equals the max flow.
**Saturated edge** — an edge carrying flow exactly equal to its capacity.
**Structural SPOF** (single point of failure) — a node whose removal disconnects some source from some sink, regardless of capacity.
**Edge / node connectivity (λ / κ)** — the minimum number of edges, or nodes, whose removal disconnects some source from some sink — a structural property, independent of the specific capacities.
**Edge redundancy** — a per-edge score of how much alternate capacity exists around it.

## Schedule (CPM)

**Critical path** — under LongestPath mode, the longest chain of activities through the network; its length is the shortest possible project duration.
**Slack (total float)** — how much an activity's start can shift without delaying the project; zero slack means the activity is on the critical structure.
**Necessarily critical** — critical under *every* possible corner of an interval scenario's duration uncertainty — a certain finding.
**Possibly critical** — critical under *at least one* corner — informative, but not certain.
**Conservative enclosure** — a sound but not necessarily tight interval bound, returned when exact interval enumeration is intractable (NP-hard) for a given network.
**Mode** — which quantity a CPM pass computes: LongestPath (classical CPM), ShortestPath, MaxScaling (a multiplicative chain), or Accumulation (a summed total with per-activity sensitivity).

## Interface / session

**Scenario** — a named operating case of a network: a self-contained bundle of any subset of the analysis input types.
**Toolkit** — one of Reliability, Flow, or Schedule.
**Session** — the uploaded network plus everything computed on it so far, held as ordinary files on disk.
**Result set** — the node/edge set an analysis itself identified (a bottleneck set, a conditioning set, a critical structure) — shown, never invented, by the Cross-Scenario Profile view.
