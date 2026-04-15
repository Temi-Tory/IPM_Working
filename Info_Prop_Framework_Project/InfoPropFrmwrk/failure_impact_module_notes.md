# FailureImpactModule — clear working notes

## What this module is

`FailureImpactModule` is the part of the toolkit that measures **what happens to throughput when components fail or capacities degrade**.

Unlike `MinCutUtilitiesModule`, this module does perform additional exact max-flow solves. It takes the baseline solved network, perturbs the capacities according to specified failure or degradation scenarios, reruns exact flow analysis, and records the resulting loss of service.

In simple terms:

- `FlowModule` gives the baseline throughput.
- `MinCutUtilitiesModule` identifies the bottleneck family.
- `FailureImpactModule` asks **how much throughput is lost when those critical components are removed or degraded**.

---

## Why engineers need this module

Knowing where a bottleneck sits is useful, but engineers also need to know **the consequence of losing it**. In reliability and resilience studies, the practical question is often not just whether an edge is critical in a cut-theoretic sense, but how much operational performance is lost if that edge fails.

This matters because two edges can both be bottleneck-relevant while producing very different service consequences under failure. One may reduce throughput only slightly, while another may collapse the entire delivered flow. Similarly, a set of edges that look individually manageable may become highly damaging when they fail together.

So the engineering role of this module is to move from **structural importance** to **performance consequence**.

---

## Network model and notation

Let the baseline network be

```text
G = (V, E)
```

with edge capacities

```text
c : E -> R_{>=0}
```

and baseline optimal max-flow value

```text
F*.
```

Now suppose the capacities are perturbed to a new set `c~`. The module resolves the max-flow problem under the perturbed capacities and obtains a new optimal value

```text
F~*.
```

The main performance quantity reported is the throughput drop

```text
Delta = F* - F~*.
```

If `Delta > 0`, the perturbation harmed network performance. If `Delta = 0`, the system absorbed the perturbation without reducing maximum throughput.

---

## What this module takes in

The main aggregate entry point is:

```julia
analyze_failure_impact(
    edgelist,
    outgoing_index,
    incoming_index,
    capacities,
    source_nodes,
    sink_nodes,
    flow_result;
    k=2,
    scenarios=nothing,
    algorithm=:dinic,
    tol=1e-10,
    combination_limit=10_000,
)
```

### Core inputs

- `edgelist`: the original directed edges
- `outgoing_index`, `incoming_index`: adjacency maps
- `capacities`: baseline capacities
- `source_nodes`, `sink_nodes`: terminal sets
- `flow_result`: the baseline exact max-flow result

### Optional controls

- `k`: size of simultaneous edge-failure combinations to test
- `scenarios`: capacity degradation scenarios to evaluate
- `algorithm`: solver used for the reruns
- `tol`: numerical tolerance
- `combination_limit`: safety bound on `k`-edge combinatorial testing

---

## What it returns

The aggregate output type is `FailureImpactResult`, containing:

- `min_cut_edges`: one representative minimum-cut edge set from the baseline solve
- `single_edge_failures`: exact one-edge removal results
- `k_edge_failures`: exact simultaneous `k`-edge removal results
- `degradation_results`: exact rerun results for general capacity degradation scenarios

This means the module reports not just whether failures matter, but **how much** they matter and under what scenario.

---

## What analyses it performs

### 1. Representative minimum-cut extraction

`extract_min_cut_sets(...)` returns the solved cut-crossing edges from the baseline partition `(S*, T*)`.

### 2. Single-edge failure analysis

`analyze_single_edge_failures(...)` removes one candidate edge at a time by setting its capacity to zero and reruns exact max flow.

### 3. k-edge failure analysis

`analyze_k_edge_failures(...)` removes all edges in each tested combination and reruns exact max flow for every combination.

### 4. Capacity degradation analysis

`analyze_capacity_degradation(...)` reruns exact max flow for user-supplied capacity scenarios, either as explicit per-edge overrides or as a uniform scaling factor.

---

## Mathematical basis

### 1. Failure perturbation model

For an edge-failure scenario affecting a set `K ⊆ E`, the perturbed capacity function is

```text
c~(e) = 0,     if e in K,
c~(e) = c(e),  otherwise.
```

For a degradation scenario with scale factor `alpha >= 0`, the code applies

```text
c~(e) = alpha * c(e)
```

for each finite-capacity edge.

### 2. Performance loss measure

After resolving max flow under the perturbed capacities, the module records

```text
Delta(K) = F* - F~*(K)
```

for a failure set `K`, or more generally `Delta = F* - F~*` for a degradation scenario.

This is the key engineering response variable.

### 3. Candidate restriction based on min-cut logic

For single-edge and `k`-edge failure analyses, the module restricts testing to the exact candidate set of edges that lie in **some** minimum cut. This is a major design choice.

The reason is that the most relevant throughput-reducing edge failures are concentrated in the cut-relevant family identified by the min-cut lattice logic. This avoids spending computation on obviously irrelevant candidates while keeping the analysis aligned with the bottleneck theory of the baseline flow state.

This also gives the module a clear engineering interpretation: it is not trying to exhaustively simulate every imaginable edge removal in a large network, but rather to concentrate on the subset of failures that are theoretically capable of governing throughput loss at the current operating point.

---

## How the algorithms work

### A. `analyze_single_edge_failures(...)`

1. Read the baseline max-flow value `F*` from `flow_result`.
2. Construct the exact candidate edge set using the “edges in some minimum cut” logic.
3. For each candidate edge `e`, set its capacity to zero.
4. Rerun exact max flow on the perturbed network.
5. Compute the throughput drop `Delta_e = F* - F~*_e`.
6. Record whether the edge caused a positive loss.
7. Sort results by descending drop.

### B. `analyze_k_edge_failures(...)`

1. Build the same candidate edge family.
2. Enumerate all size-`k` combinations of those edges.
3. Stop early with an error if the total count exceeds `combination_limit`.
4. For each combination, set the selected capacities to zero.
5. Rerun exact max flow.
6. Record the resulting drop.
7. Sort the combinations by severity.

### C. `analyze_capacity_degradation(...)`

1. Accept either explicit per-edge capacity overrides or a numeric global scale factor.
2. Build the perturbed capacity dictionary for each scenario.
3. Rerun exact max flow under that scenario.
4. Record the new max-flow value, sink allocation, saturated edges, and throughput drop.
5. Return the scenario results in deterministic order.

### D. `analyze_failure_impact(...)`

This is the bundle function. It orchestrates the representative cut extraction, single-edge failures, `k`-edge failures, and optional degradation scenarios into one typed result.

---

## Implementation and optimisation decisions

### 1. Reuse the baseline solve

The module takes `flow_result` as input so the original exact baseline solve does not need to be repeated unnecessarily.

### 2. Restrict the failure candidate set

Rather than perturb every edge in the graph blindly, the code first narrows attention to edges that lie in **some** minimum cut. This is the main optimisation decision in the module and keeps the rerun workload focused on the bottleneck-relevant edge family.

### 3. Use explicit reruns for correctness

The module does not estimate failure impact heuristically. For every tested perturbation, it resolves the exact max-flow problem under the modified capacities. That makes the returned drop values exact for the chosen scenarios.

### 4. Guard against combinatorial blow-up

The number of `k`-edge combinations can become very large. The `combination_limit` guard exists to stop the analysis before it becomes computationally unreasonable.

### 5. Flexible scenario handling

Capacity scenarios are accepted in two practical forms:

- an explicit dictionary of edge overrides
- a single numeric scale factor applied uniformly to finite capacities

This makes it easy to study both targeted damage and broad system-wide degradation.

### 6. Deterministic ranking and ordering

Single-edge and `k`-edge failure results are sorted deterministically, usually by descending throughput drop and then by edge ordering. This is useful for reproducible engineering reporting.

### 7. Defensive handling of unboundedness

The code carries an `is_unbounded` flag defensively, even though properly bounded infrastructure networks should normally remain finite under these perturbations.

### 8. Severity-first reporting

The single-edge and multi-edge results are sorted so that the most damaging scenarios appear first. This is a small but useful design choice because it lets the analyst immediately read off the worst throughput-loss cases without additional post-processing.

---

## What insights this module brings

This module maps directly to the chapter objectives:

- **Which component failures most reduce deliverable flow?**
- **What happens when multiple critical components fail together?**
- **How sensitive is throughput to capacity degradation?**

The outputs let the analyst distinguish between:

- edges that are structurally important but not catastrophic on their own,
- edges whose loss causes major throughput collapse,
- and combinations of failures that create nonlinear or compounding consequences.

This is often where the resilience story becomes operationally meaningful.

---

## Relationship to the other modules

`FailureImpactModule` consumes the baseline `flow_result` and, in practice, depends strongly on the same cut logic used in `MinCutUtilitiesModule`.

- `FlowModule` provides the baseline throughput state.
- `MinCutUtilitiesModule` provides the candidate bottleneck family.
- `FailureImpactModule` quantifies the consequence of perturbing that family.
- `SensitivityModule` and `ParametricThresholdModule` then study more controlled marginal or threshold-style changes.

So this module is the toolkit’s **explicit perturbation-and-consequence layer**.

---

## One-sentence summary

`FailureImpactModule` takes the solved baseline network, applies exact edge-failure or capacity-degradation perturbations, reruns max flow under those scenarios, and reports the resulting throughput losses in a form that supports reliability and resilience analysis.