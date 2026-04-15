# ParametricThresholdModule — clear working notes

## What this module is

`ParametricThresholdModule` is the toolkit component that studies **how much capacity loss or capacity increase can be tolerated before a target throughput level is crossed**.

It is not just a generic sensitivity ranking. It solves a more specific engineering question:

- how far can a given edge degrade before the network no longer meets the required flow level?
- how much extra capacity must be added to a given edge before the network first reaches a required flow target?

So, if `FailureImpactModule` asks **what happens under a chosen perturbation**, this module asks **where the exact threshold lies**.

---

## Why engineers need this module

In practice, design and resilience decisions are often framed around margins and targets rather than only around raw failure outcomes. Engineers do not just want to know that a component is important; they want to know the size of the safety margin.

Typical questions are:

- How much degradation can this corridor absorb before service falls below demand?
- Which edge has the smallest tolerance margin and is therefore most vulnerable?
- If we can afford only one upgrade, how much extra capacity would be required on that edge to reach the target throughput?
- Is improving this edge even capable of achieving the desired network-level gain, or is the true bottleneck elsewhere?

This is exactly the type of decision support `ParametricThresholdModule` is meant to provide.

---

## Network model and notation

Let the baseline network be

```text
G = (V, E)
```

with capacity function

```text
c : E -> R_{>=0}
```

and baseline optimal max-flow value

```text
F*.
```

Fix a target edge `e ∈ E` and a required target throughput

```text
tau > 0.
```

The module studies the max-flow value as the capacity of that one edge varies while all other capacities remain fixed.

For a modified capacity value `x` on the target edge, define

```text
F_e(x) = max-flow value of the network when c(e) = x.
```

The task is then to locate threshold values of `x` such that `F_e(x)` first drops below or first reaches the required throughput level `tau`.

---

## What the module takes in

The main public functions are:

```julia
find_degradation_threshold(..., target_edge, target_flow; ...)
find_upgrade_threshold(..., target_edge, target_flow; ...)
find_all_degradation_thresholds(..., target_flow; ...)
analyze_parametric_thresholds(..., flow_result; target_flow=..., ...)
```

### Core inputs

- `edgelist`: original directed edges
- `outgoing_index`, `incoming_index`: adjacency maps
- `capacities`: baseline edge capacities
- `source_nodes`, `sink_nodes`: terminal sets
- `target_edge`: the edge whose capacity is being varied
- `target_flow`: the required throughput level to preserve or attain

### Optional controls

- `algorithm`: exact max-flow solver used for reruns
- `tol`: numerical tolerance
- `max_depth`: recursion bound for locating partition changes
- `candidate_edges`: optional subset of edges to analyse in bulk

### Aggregate entry point

`analyze_parametric_thresholds(...)` consumes the existing `flow_result` and, if `target_flow` is omitted, defaults to

```text
0.9 * baseline max flow,
```

which corresponds to a 10% degradation tolerance.

---

## What it returns

The key output types are:

### `DegradationThreshold`
Contains:
- the target edge
- original capacity
- threshold capacity
- degradation margin
- target flow and baseline flow
- flags stating whether the target is achievable and whether it is still reachable even at zero capacity
- number of solver calls used

### `UpgradeThreshold`
Contains:
- the target edge
- original capacity
- required capacity
- required increase
- target flow and baseline flow
- flags for `already_sufficient` and `upgrade_ineffective`
- number of solver calls used

### `ParametricThresholdResult`
Contains:
- all degradation thresholds for the analysed edge set
- the selected `target_flow`
- the baseline flow

So the outputs are not just rankings: they are explicit threshold statements with engineering interpretation.

---

## What analyses it performs

### 1. Degradation threshold for one edge

`find_degradation_threshold(...)` finds the **minimum remaining capacity** of a chosen edge such that the network can still maintain the target throughput.

### 2. Upgrade threshold for one edge

`find_upgrade_threshold(...)` finds the **minimum upgraded capacity** required on a chosen edge for the network to achieve the target throughput.

### 3. Batch degradation analysis over many edges

`find_all_degradation_thresholds(...)` applies the one-edge degradation threshold analysis across a candidate edge set and sorts the results by vulnerability.

### 4. Aggregate threshold analysis

`analyze_parametric_thresholds(...)` packages the multi-edge degradation-threshold results into one typed output for use in the overall toolkit pipeline.

---

## Mathematical basis

### 1. Degradation threshold definition

For a target edge `e`, let `c_e` be its original capacity. The degradation threshold is the smallest value `x ∈ [0, c_e]` such that

```text
F_e(x) >= tau.
```

Equivalently, this gives the maximum capacity loss that can be tolerated while still meeting the required throughput. The reported degradation margin is

```text
c_e - x.
```

### 2. Upgrade threshold definition

The upgrade threshold is the smallest value `x >= c_e` such that

```text
F_e(x) >= tau.
```

The required increase is then

```text
x - c_e.
```

### 3. Piecewise-linear structure

The important mathematical observation behind the implementation is that as one edge capacity varies, the network max-flow value changes in a piecewise-linear way, with changes in slope occurring when the active minimum-cut partition changes.

That is why the code tracks min-cut partitions during the threshold search rather than using a naive brute-force scan over many trial capacities.

### 4. Closed-form step on a fixed partition segment

When the min-cut partition is unchanged between two tested capacities, the module uses a closed-form linear interpolation step to solve for the threshold on that interval rather than continuing to subdivide unnecessarily.

This is one of the main mathematical efficiency ideas in the implementation.

---

## How the algorithms work

### A. `find_degradation_threshold(...)`

1. Validate the target edge and confirm its original capacity is finite.
2. Solve the network with that edge reduced to zero capacity.
3. Solve the network again at the original capacity.
4. If the target flow is still met even when the edge is reduced to zero, return a full degradation margin.
5. If the target flow is not even achievable at the original capacity, return a sentinel result marking it unachievable.
6. Otherwise, recursively search the interval between zero and the original capacity.
7. At each recursion step, test the midpoint capacity and compare both the flow value and the active min-cut partition.
8. If the partition has stabilised across an interval, compute the threshold in closed form.
9. Return the exact threshold capacity and degradation margin.

### B. `find_upgrade_threshold(...)`

1. Validate the target edge and solve the baseline network.
2. If the network already meets the target flow, report that no upgrade is needed.
3. Otherwise, expand the tested capacity upward using a doubling search until the target flow is reached or until the edge is judged ineffective.
4. Once an interval bracketing the threshold is found, recursively refine it using the same partition-aware logic.
5. Return the minimum required upgraded capacity.

### C. `find_all_degradation_thresholds(...)`

1. Choose a candidate edge set.
2. Run `find_degradation_threshold(...)` on each candidate.
3. Sort the results by ascending degradation margin.

This means the most vulnerable edges appear first.

### D. `analyze_parametric_thresholds(...)`

1. Read the baseline max-flow value from `flow_result`.
2. Select the target flow, using `0.9 * baseline` if none is specified.
3. Run the degradation-threshold analysis over the chosen edge set.
4. Return the aggregated typed result.

---

## Implementation and optimisation decisions

### 1. Use exact reruns, not heuristic sensitivity proxies

The module computes thresholds by repeatedly solving the exact max-flow problem under modified edge capacities. This makes the returned threshold values exact with respect to the chosen deterministic flow model.

### 2. Exploit partition information

The strongest design idea in the code is that the recursion does not just compare flow values. It also checks whether the min-cut partition has changed. If the partition is unchanged, the threshold on that interval can be solved analytically in closed form.

This is much more efficient and much more principled than scanning many arbitrary trial capacities.

### 3. Use recursion bounds for robustness

The `max_depth` guard exists to stop pathological recursion if the partition boundaries become numerically delicate or highly fragmented.

### 4. Restrict to finite-capacity target edges

The code explicitly requires the analysed target edge to have a finite original capacity. This avoids meaningless threshold questions on non-binding infinite-capacity connector edges.

### 5. Use sentinels to signal engineering meaning

The implementation deliberately returns sentinel values such as `Inf` together with Boolean flags like:

- `target_achievable = false`
- `target_reachable_at_zero = true`
- `already_sufficient = true`
- `upgrade_ineffective = true`

These flags matter because they distinguish different engineering interpretations that would otherwise all collapse into a single numeric value.

### 6. Report solver call counts

Each threshold result stores the number of exact solver calls used. This is a useful transparency feature because it shows the computational effort behind each threshold estimate.

---

## What insights this module brings

This module maps directly to chapter objectives such as:

- **What degradation threshold is required to maintain a target demand level?**
- **How much spare capacity margin exists on each critical edge?**
- **Which edge upgrades are actually capable of improving delivered throughput?**

Its outputs let the analyst distinguish between:

- edges with large tolerance margins,
- edges that are immediately vulnerable to small degradation,
- edges that are already sufficient,
- and edges whose upgrade is ineffective because the governing bottleneck lies elsewhere.

This makes the module especially useful for intervention planning and resilience-margin reporting.

---

## Relationship to the other modules

`ParametricThresholdModule` sits downstream of the baseline flow solve and complements both `FailureImpactModule` and `SensitivityModule`.

- `FlowModule` gives the baseline operating point.
- `MinCutUtilitiesModule` identifies the relevant bottleneck structure.
- `FailureImpactModule` studies explicit perturbation scenarios.
- `ParametricThresholdModule` then asks for the exact threshold at which the service level changes.

So this is the toolkit’s **capacity-margin and intervention-threshold layer**.

---

## One-sentence summary

`ParametricThresholdModule` varies the capacity of a chosen edge, reruns exact max-flow analysis in a partition-aware way, and returns the exact degradation or upgrade threshold needed to preserve or attain a specified throughput target.