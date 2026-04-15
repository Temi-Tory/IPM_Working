# SensitivityModule — clear working notes

## What this module is

`SensitivityModule` studies how strongly the solved network throughput depends on individual edge capacities.

It is a post-baseline analysis module: it starts from the exact `flow_result` already computed by `FlowModule`, then applies controlled one-edge perturbations and reruns exact max-flow solves to measure how much the network response changes.

In simple terms:

- `FailureImpactModule` asks what happens when an edge is removed or degraded under specific failure scenarios.
- `SensitivityModule` asks which edges are **most influential** on the delivered flow and how much extra throughput they could unlock if strengthened.

---

## Why engineers need this module

In design and reinforcement studies, not all bottleneck edges are equally worth attention. Some edges may be saturated but have little practical improvement value; others may be the best targets for strengthening because a small capacity increase produces a meaningful gain in system throughput.

This module therefore helps answer questions such as:

- Which edges are most critical to current performance?
- If one edge fails, which removal causes the greatest drop in throughput?
- If one edge is strengthened slightly, which one gives the largest marginal improvement?
- Which edges have the largest Birnbaum-style importance in the deterministic flow setting?

So the purpose here is not just to locate bottlenecks, but to **rank intervention priorities**.

---

## Network model and notation

Let the baseline capacitated DAG be

```text
G = (V, E)
```

with edge-capacity function

```text
c : E -> R_{>=0}
```

and solved baseline maximum flow value

```text
F*.
```

For a chosen edge `e ∈ E`, the module studies the change in the solved max-flow value under simple single-edge perturbations.

---

## What this module takes in

The main public entry point is:

```julia
analyze_sensitivity(
    edgelist,
    outgoing_index,
    incoming_index,
    capacities,
    source_nodes,
    sink_nodes,
    flow_result;
    algorithm=:dinic,
    tol=1e-10,
    delta=1.0,
)
```

### Core inputs

- `edgelist`: original directed edges
- `outgoing_index`, `incoming_index`: adjacency maps
- `capacities`: baseline capacities
- `source_nodes`, `sink_nodes`: source and sink sets
- `flow_result`: exact solved baseline flow result

### Optional controls

- `algorithm`: exact max-flow algorithm used for reruns
- `tol`: numerical tolerance
- `delta`: capacity increment used in marginal-value calculations

---

## What it returns

The result type is `SensitivityResult`, containing:

- `critical_edges`: ranking of edges by the drop in max flow if the edge is zeroed out
- `marginal_capacity`: per-edge marginal gain from a `+delta` capacity increase
- `birnbaum`: per-edge Birnbaum-style importance values

So the output is a set of edge-level importance measures, each with a different engineering meaning.

---

## What analyses it performs

### 1. Critical edge ranking

`critical_edge_ranking(...)` ranks candidate edges by the exact drop in max flow when that edge capacity is set to zero.

### 2. Marginal capacity values

`marginal_capacity_values(...)` measures how much the network max-flow value increases when a saturated edge capacity is increased by a small amount `delta`.

### 3. Birnbaum importance

`birnbaum_importance(...)` computes a deterministic flow analogue of Birnbaum importance using the difference

```text
I(e) = maxflow(c_e = Inf) - maxflow(c_e = 0).
```

### 4. Aggregate sensitivity analysis

`analyze_sensitivity(...)` runs all three analyses and returns them together in one typed result.

---

## Mathematical basis

### 1. Critical drop measure

For an edge `e`, set its capacity to zero and resolve the max-flow problem. If the resulting flow is `F*_e=0`, then the exact drop is

```text
Delta_e = F* - F*_e=0.
```

Large values indicate edges whose removal strongly damages throughput.

### 2. Marginal capacity value

For a positive increment `delta`, define the marginal value of edge `e` as

```text
M(e) = (F*_e= c(e)+delta - F*) / delta.
```

This measures the local improvement in deliverable flow per unit added capacity.

### 3. Birnbaum-style importance

The module uses the deterministic flow analogue

```text
I(e) = F*_e=Inf - F*_e=0.
```

This asks how much throughput range is controlled by the edge when comparing a fully removed state against an unconstraining state.

### 4. Theorem-guided pruning

The code does not evaluate every edge equally in every measure. It prunes candidates using flow and cut logic:

- only **saturated** edges are tested for critical-drop ranking and marginal upgrades,
- only edges in **some minimum cut** are evaluated for Birnbaum importance,
- all other edges receive `0` by construction in the pruned metrics.

This is an important mathematical and computational choice.

---

## How the algorithms work

### A. `critical_edge_ranking(...)`

1. Start from the solved baseline `flow_result`.
2. Take the set of saturated edges.
3. For each one, set its capacity to zero.
4. Rerun exact max flow.
5. Compute the throughput drop relative to baseline.
6. Sort the edges by descending drop.

### B. `marginal_capacity_values(...)`

1. Start from the same saturated edge set.
2. Increase one edge at a time by `delta`.
3. Rerun exact max flow.
4. Compute the flow gain per unit increase.
5. Assign `0` to unsaturated edges.

### C. `birnbaum_importance(...)`

1. Build the set of edges that lie in **some** minimum cut.
2. Reuse zero-capacity reruns where possible.
3. For each candidate edge, also rerun with `c_e = Inf`.
4. Compute the difference between the unconstrained and failed states.

### D. `analyze_sensitivity(...)`

This function orchestrates the three measures and packages them into one `SensitivityResult`.

---

## Implementation and optimisation decisions

### 1. Reuse cached zero-capacity reruns

The module caches exact reruns where capacities are set to zero so that multiple sensitivity measures can reuse the same results instead of solving the same perturbed network repeatedly.

### 2. Prune by theorem-relevant edge families

This is the main optimisation decision. The code focuses on saturated edges and edges in some minimum cut, because those are the edges most likely to matter to the throughput objective.

### 3. Keep the analysis exact

All rankings are based on exact rerun solves, not on heuristics or local approximations alone.

### 4. Preserve deterministic output ordering

Rankings are sorted deterministically so the most important edges appear first and repeated runs are reproducible.

### 5. Carry defensive unboundedness handling

The Birnbaum calculation explicitly checks the `c_e=0` and `c_e=Inf` reruns for pathological unbounded cases, even though bounded infrastructure networks should normally avoid them.

---

## What insights this module brings

This module maps most directly to chapter questions such as:

- **Which components matter most to performance?**
- **Which one-unit upgrade gives the biggest throughput benefit?**
- **Which bottleneck edge is the strongest intervention target?**

The value of the module is that it turns bottleneck logic into a ranked intervention picture. Instead of simply identifying critical edges, it quantifies how much they matter under removal or strengthening.

---

## Relationship to the other modules

`SensitivityModule` sits downstream of `FlowModule` and overlaps naturally with `FailureImpactModule` and `ParametricThresholdModule`.

- `FailureImpactModule` looks at explicit failure consequences.
- `SensitivityModule` ranks edges by marginal and extreme importance.
- `ParametricThresholdModule` then asks for the exact threshold needed to preserve or attain a chosen target.

So this module is best viewed as the toolkit’s **importance-ranking and upgrade-priority layer**.

---

## One-sentence summary

`SensitivityModule` uses exact one-edge perturbation reruns, combined with theorem-guided pruning, to rank how strongly each edge influences the network’s deliverable throughput.