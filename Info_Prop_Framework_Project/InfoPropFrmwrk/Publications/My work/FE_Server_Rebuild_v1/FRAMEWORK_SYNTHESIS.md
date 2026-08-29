# Framework Synthesis (for UI/server design)

Sources read in full, in order: Introduction_Chapter_v1, Background_Chapter_v1,
Model_Chapter_v1 (Complex_Processes_Chapter.tex), Diamond_Chapter_v2, Probability_Chapter_v1,
the Flow/Capacity chapter, CPM_Chapter_v1, UI_Chapter_v2 (Front_End_Chapter.tex).

**Note on the Flow/Capacity chapter.** There is no tex-format chapter for this toolkit under
`Publications\My work\` with the modern `\ifdefined\maindoc` scaffold that every other chapter
here uses. The only candidate found anywhere in the repository is
`Publications\My work\Flow_Toolkit_Chapter.docx`, dated 7 July — before the mid-August
fresh-verification campaign that produced the `_v1`/`_v2` tex chapters for every other toolkit.
It has no `.md` sibling either (unlike the Introduction, Network Model and Critical Path
chapters, which do). I extracted its text (docx XML → plain text) and read it in full; it is
used below as the best available description of the flow toolkit's *intended design*, but it is
stale relative to the other chapters and its capability claims (especially "Float64 only") are
cross-checked directly against `CapacityAnalysisKit.jl` in the FE_AUDIT rather than taken on
faith. If a Flow chapter tex file exists elsewhere and was missed, it was not found by searching
the repository for `.tex` files, for `\ifdefined\maindoc`, or for "Flow"/"Capacity"/"Toolkit" in
directory and file names under `Publications`.

---

## 1. The one shared network model

Every analysis in the framework consumes the same object, defined once in the Model chapter and
built by the Input Module: a finite **directed acyclic graph** `G = (V, E)`. Four roles fall out
of position in the graph, not out of any per-analysis labelling:

- **Source** — a node with no incoming edge (supply enters here: an intake, a generator, a
  project start).
- **Sink** — a node with no outgoing edge (the system delivers here: a demand point, a
  completed handover).
- **Fork** — a node with fan-out ≥ 2 (`F = {v : |Ch(v)| ≥ 2}`). Forks are how systems
  distribute, and, deliberately, how they build in redundancy.
- **Join** — a node with fan-in ≥ 2 (`J = {v : |Pa(v)| ≥ 2}`). Joins are where distributed
  flows, or redundant routes, come back together.

The model is built on four explicit assumptions, stated as limits rather than hidden in an
algorithm: components fail/behave **independently** (no common-cause modelling); under the
probabilistic reading a component is **binary** (operational/failed, no degraded states); the
topology is **static** over the analysis horizon; and the graph is **acyclic** (a modelling
choice defended at length in the Model chapter — true by construction for schedules and process
lines, an orientation-by-dominant-flow snapshot for things like distribution networks).

The same topology supports three "readings," distinguished only by what a node/edge value
*means*:

| Reading | Node value means | Edge value means |
|---|---|---|
| Probabilistic (reliability) | probability the component operates | probability the handover succeeds |
| Capacity (flow) | node throughput limit | edge throughput limit |
| Schedule/cost | activity duration/cost | transfer duration/cost |

"Three readings of one topology are three different analyses, and keeping the topology common
across them is what allows a single system model to answer questions that are usually asked of
three separate models" (Model chapter, §Information on the Network). A second, orthogonal axis
is **how well a value is known**: deterministic (Float64), interval, or probability-box — a
question of epistemic state, independent of what the value represents.

## 2. Diamond decomposition: an internal preprocessing step for one toolkit, not a fourth analysis

This is the single most consequential point for UI design, so it is worth stating plainly and
with its sourcing.

**What it is.** The decomposition module identifies every instance of a fork→join
reconvergence pattern (a "diamond") in the graph and returns them as `unique_subgraphs`,
attached to the same unified graph object the Input Module produced. It is explicitly described
as "a network pre-processing step" (Diamond chapter §Introduction), parallel in kind to input
parsing/validation, not as a fourth kind of analysis alongside reliability/flow/schedule.

**What it is *for*.** The Diamond chapter is unambiguous that this preprocessing exists
because of one downstream consumer: "Since IPF's decomposition module was built with
probabilistic propagation in mind, the eligibility criterion excludes nodes whose prior
probability is deterministic" (§3, `is_det`). The Model chapter's own roadmap states this even
more directly: "for the probabilistic question the reconvergent structure...must be identified
and organised" — diamond identification is grouped with input parsing as one of the two
preprocessing steps run once per system, specifically to serve the reliability computation.
The Probability chapter confirms the tie from the other side: "It is the analysis the
decomposition module was built for, because reconvergent paths are precisely where local
probability calculations stop being valid," and the propagation algorithm's central mechanism
(conditioning on a diamond's fixed nodes, reducing a solved diamond to a "supernode") is only
meaningful for probability propagation.

**The other two toolkits do not use it.** The CPM chapter states outright: "The Critical Path
Toolkit consumes the unified graph object...directly and involves no decomposition...the
Network Decomposition Module...is bypassed entirely." It does have its own, unrelated notion of
reconvergence (the "bypass set" behind the domination split for exact interval floats), but
"neither computation uses the other." The Flow/Capacity docx's reachability layer invokes IPA
(hence indirectly the decomposition, via the reliability toolkit) but the max-flow/min-cut
machinery itself is classical flow theory with no diamond conditioning anywhere in its
description.

**So is a diamond ever its own standalone thing?** Structurally, yes, in one specific sense:
each stored diamond is built as "a unified graph object of its own," self-similar to the whole
network, so "a diamond can be treated as a standalone DAG network for any other type of analysis
through the framework" (Diamond chapter §The Unique Diamond Object). The Front-End chapter's
ambition leans on exactly this self-similarity to justify a diamonds *view* that lists
identified structures and lets a user open one and run an analysis on it in isolation, "which
turns the decomposition from an internal accelerator into an instrument for localised
investigation."

**Design implication.** A diamond is legitimately inspectable and drillable — that part of the
ambition is grounded in real self-similarity, not an old habit of thought. What would misread the
framework is treating diamond decomposition as a peer, general-purpose fourth analysis a user
sets up independently of reliability (e.g., a top-level "Diamond Analysis" workflow with its own
upload/setup, invoked whether or not the user is doing reliability work, and offered as
comparable in status to flow or schedule). The model's own account has exactly one home for it:
a step inside the reliability path (optionally surfaced for inspection, and optionally reusable
as a standalone sub-network the user pushes through *any* toolkit once extracted), never a
required step for flow or schedule, and never itself a fourth "kind of question" the network
answers. This distinction is exactly what to check any "diamond" page or endpoint against in
Part 2.

## 3. The three toolkits, in plain terms, and the value-type asymmetry

### Reliability / Probability Propagation Toolkit
Computes, for every node at once, the **belief** `b(v)` — the probability that the node is
operating *and* reachable from at least one source, given that every node and edge can fail
independently. It is exact message-passing with one twist: wherever paths reconverge (a
diamond), naive independence would over-estimate reliability, so the algorithm conditions on the
diamond's fixed node(s) instead, resolving each reconvergence in `2^|C|` sub-cases (`C` the
conditioning set) rather than one flawed formula. Value types: **Float64, Interval, and
probability-box — all three, with proven exactness guarantees** (exact belief for Float64,
provably exact range for Interval via monotonicity, sound-but-not-fully-proven distributional
bounds for p-box via a Fréchet-Hoeffding-based conditioning operator).

### Flow / Capacity Toolkit
Computes the **maximum deliverable throughput** from a source set to a sink set under edge (and
optionally node) capacity constraints, via classical max-flow (three solver choices: Edmonds-Karp,
Dinic, Push-Relabel), plus a family of diagnostics built on the solved flow state: min-cut
degeneracy/enumeration, structural single-points-of-failure, flow decomposition into contributing
paths, edge sensitivity/marginal-value ranking, single- and k-edge failure-impact, and parametric
degradation/upgrade threshold search. Multi-source/multi-sink networks are reduced automatically
via super-source/super-sink; node capacities are handled via internal node-splitting, invisible
to the user, with all outputs remapped back onto the original graph. Value types: **Float64 only
— confirmed both by the chapter draft (no interval or p-box arithmetic anywhere in its
computational description) and, per the audit task's requirement, directly against
`CapacityAnalysisKit.jl` in Part 2.**

### Schedule / Critical Path (CPM) Toolkit
Computes, for any quantity that accumulates along dependency paths (duration, cost, risk,
load...), the extremal value a complete chain can produce (forward pass) and, wherever the
operator pair supports it, how much room each node has before that extremal value changes
(backward pass). Ships four modes: `LongestPath` (classical CPM: slack), `ShortestPath` (margin
over optimum), `MaxScaling` (multiplicative, e.g. route-reliability-by-success-factor: ratio
slack), `Accumulation` (summed quantities like load: an allowance/headroom reading, not a
slack — a genuinely different kind of "room"). Explicitly bypasses diamond decomposition
entirely (§2 above). Value types: **Float64 and Interval — not probability-box.** Forward
quantities are exact from two corner runs (monotonicity); margins/floats are exact via a
"domination split" (an exponential-in-bypass-set-size but often-cheap enumeration) or a
declared-conservative sound enclosure. Zero mentions of p-box anywhere in the chapter's own
text — confirmed by direct read.

### The asymmetry, stated once, plainly, for the UI

| Toolkit | Float64 | Interval | Probability-box | Uses diamond decomposition |
|---|:---:|:---:|:---:|:---:|
| Reliability | yes | yes (exact) | yes (sound bounds) | yes — built for it |
| Flow/Capacity | yes | **no** | **no** | no |
| Schedule/CPM | yes | yes (exact/sound) | **no** | no — bypassed entirely |

**Direct UI consequence:** a single global "value type" selector that offers probability-box (or
even interval) regardless of which toolkit the user is about to run is a modelling error against
the framework as described. The selector's available options must be a function of which
analysis is about to run, not a global setting applied identically everywhere.

## 4. What "one shared model, several analyses" implies for the user's path through the tool

The Model chapter is explicit that the topology is "fixed once per system" and that an analysis
"attaches values to its nodes and edges whose meaning depends on the question" — i.e., **one
upload, several readings**, not three separate models. Preprocessing (input parsing, and diamond
identification when the reliability toolkit will run) happens once; "everything after them is a
reading of the object this chapter has defined."

The Front-End chapter's ambition follows this exactly: a network is uploaded once (individual
files or a whole folder, sorted by naming convention into the structure file plus one-or-more
analysis-input sets); the same folder convention carries **scenarios** (different value forms or
operating cases of the *same* network), so "one upload supports the whole comparative workflow."
The interface contract reinforces this at the wire level: "The interface invents no second
format, the files a user uploads are byte for byte the files the package reads," and if an
analysis request arrives without an explicit structure file, the server reconstructs the edge
list from the analysis inputs' own edge keys — i.e. the system is designed so a self-consistent
set of analysis files, from one upload, is sufficient to drive any of the three toolkits. The
server further keeps this cheap by content-hashing the network+priors to cache/reuse the diamond
store across requests, so a second propagation, or a request from a different toolkit against
the same network, does not redo preprocessing.

**This is the yardstick for "siloed vs. unified" in Part 2:** does the actual front end let a
user upload a network once and then choose reliability, flow, or schedule against it (matching
the model), or does each toolkit's page require its own independent upload/setup step, implying
three separate networks rather than three readings of one? The same test applies to
decomposition specifically: is it something the reliability flow surfaces/invokes internally
(with an optional inspect-a-diamond-standalone side door, per §2 above), or is it presented as
its own top-level system a user sets up independently of any of the three analyses?

## 5. The stated delivery philosophy (the contract Part 2's audit is checked against)

From the Front-End chapter, stated as design commitments, not aspirations to interpret loosely:

- **No-code**: "a no-code web interface," browser front end (Angular + d3) driving a local
  analysis service over HTTP; "asks the user for files and clicks rather than code."
- **Local-only, no telemetry, no account**: client and server "happen to share a machine";
  all HTTP is bound to localhost; "no traffic leaves the machine"; "There is no account to
  create, no telemetry, and no remote service in the path."
- **File-based, no server-side storage beyond the user's own folder**: "A session is nothing
  more than a folder holding the uploaded files and a plain JSON record of what has been
  computed... deleting one is deleting a folder." Every artefact — uploaded network, analysis
  inputs, computed results, cached decomposition — is "ordinary files in one folder that the
  user can inspect, archive to controlled storage, or destroy, with nothing held anywhere
  else." This is explicitly framed as a requirement for adoption in custody-sensitive
  industries (nuclear decommissioning, defence logistics), not a convenience.
- **Contract-first**: a machine-readable interface contract (one endpoint per analysis class,
  mirroring the module boundaries: structure, decomposition, probability, flow, critical path,
  plus housekeeping) that both sides are built against, "rather than against each other's
  internals" — intended to prevent the client and server drifting apart silently.
- **Value-form honesty at every boundary**: "a value never loses its form in transit" — a
  deterministic belief crosses as a number, an interval as a bound pair, a p-box as a typed
  summary with bounding curves/moments; the interface must never "average, midpoint, or
  otherwise flatten an uncertain result into a false precision."
- **Guided but not gated**: a pipeline where a step "unlocks when the data it needs exists,"
  but "any unlocked step is reachable directly" once unlocked, with view state (filters,
  selections, open tabs) preserved across navigation.
- **The interface is a window, not a second implementation**: "it adds no analytical capability
  of its own," single-user, no collaboration layer — everything shown must be traceable to a
  module in the underlying package, never reimplemented at the UI or server layer.

These eight points are the checklist Part 2 (`FE_AUDIT.md`) applies to every page and endpoint
found in the actual current codebase.
