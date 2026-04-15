# MinCutUtilitiesModule — clear working notes

## What this module is

`MinCutUtilitiesModule` is the exact **post-processing layer** for the baseline max-flow solve.

It does **not** run a new max-flow algorithm. Instead, it takes the already-solved `flow_result` from `FlowModule` and extracts more detailed information about the minimum-cut structure of the network.

So, in simple terms:

- `FlowModule` answers **how much can get through**.
- `MinCutUtilitiesModule` answers **what exactly is limiting that throughput** and **how many equivalent bottleneck cut configurations exist**.

## Why engineers may not be satisfied with one solved minimum cut

For many engineering decisions, a single reported minimum cut is not enough. Knowing that one bottleneck partition exists does identify a valid constraint on throughput, but it does not yet tell the analyst whether that bottleneck is **structurally unique**, whether there are **alternative cut sets with the same limiting capacity**, or whether the same criticality is concentrated in a few components or spread across several interchangeable ones.

That distinction matters in practice. If the cut is unique, then reinforcement can be targeted quite directly because the same small set of components governs throughput in every equivalent optimal view of the network. If the cut is non-unique, then the system may admit several different but equally limiting bottleneck configurations. In that situation, strengthening one edge may simply shift the active bottleneck elsewhere rather than meaningfully improving the overall service level.

This is the engineering motivation for treating min-cut analysis as a separate module rather than stopping at the baseline `FlowModule` output. The extra question is no longer just **what is the current bottleneck?** but also **how rigid or interchangeable is the bottleneck structure under the same capacity state?**

---

## Network model and notation

Let the network be a capacitated directed graph

```text
G = (V, E)
```

with edge-capacity function

```text
c : E -> R_{>=0}
```

and source and sink sets

```text
S ⊆ V,   T ⊆ V.
```

After the flow solve, we already have:

- an optimal flow `f*`
- the maximum flow value `F*`
- one solved representative minimum cut `(S*, T*)`

where:

- `S*` is the source-side cut set from the residual graph
- `T*` is the sink-side cut set
- `cap(S*,T*) = F*` by the max-flow/min-cut theorem.

This module works entirely from that solved state.

---

## What the module takes in

The main public entry point is:

```julia
analyze_min_cuts(
    edgelist,
    outgoing_index,
    incoming_index,
    capacities,
    source_nodes,
    sink_nodes,
    flow_result;
    cut_limit=1000,
    tol=1e-10,
)
```

### Required inputs

- `edgelist`: the original directed edges `(u,v)`
- `outgoing_index`, `incoming_index`: adjacency lookups
- `capacities`: edge capacities
- `flow_result`: the already-computed exact result from `FlowModule`

### Optional controls

- `cut_limit`: upper bound on how many minimum cuts to enumerate
- `tol`: numerical tolerance for saturation and equality checks

### Important implementation note

Although `source_nodes` and `sink_nodes` appear in the signature, the aggregate min-cut analysis mostly uses `flow_result` directly. They are kept mainly for **API consistency** with the rest of the toolkit.

---

## What it returns

The key return type is `MinCutAnalysis`, which contains:

- `representative_cut`: one valid solved minimum cut
- `edges_in_some_cut`: edges that appear in **at least one** minimum cut
- `edges_in_every_cut`: edges that appear in **every** minimum cut
- `enumeration`: bounded list/summary of all enumerated minimum cuts
- `max_flow`: copied from the baseline solve
- `min_cut_capacity`: copied from the baseline solve

The supporting result types are:

- `MinCut`: one cut with node partition, crossing edges, and capacity
- `MinCutEnumeration`: the collection of cuts plus `total_cuts`, `is_complete`, and `free_zone_size`

## Representative cut versus the full minimum-cut family

This distinction is one of the main reasons the module exists.

The baseline flow solve returns **one representative minimum cut**. That is sufficient to certify the max-flow value and to exhibit one valid bottleneck partition. However, it does **not** by itself tell us whether that cut is the only one, nor whether different edges can substitute for one another while preserving the same minimum-cut capacity.

`MinCutUtilitiesModule` extends that one solved witness into a fuller structural picture:

- one representative cut shows **a** bottleneck,
- `edges_in_every_cut` shows what is **unavoidably** critical,
- `edges_in_some_cut` shows what is **potentially** critical in at least one optimal bottleneck configuration,
- enumeration reveals whether the bottleneck family is unique or non-unique.

In engineering terms, this moves the analysis from a single witness of weakness to a more complete description of bottleneck robustness and interchangeability.

---

## What the module actually does

The module provides five main utilities:

1. **Extract the representative solved minimum cut**
   - `minimum_st_cut_edges(...)`
   - `minimum_st_cut_capacity(...)`
   - `mincut_partition(...)`

2. **Identify edges in some minimum cut**
   - `edges_in_some_mincut(...)`

3. **Identify edges in every minimum cut**
   - `edges_in_every_mincut(...)`

4. **Enumerate all minimum cuts, up to a safe bound**
   - `enumerate_min_cuts(...)`

5. **Bundle all of the above into one result**
   - `analyze_min_cuts(...)`

---

## Residual graph, backward reachability, and the min-cut lattice

The natural starting point is the residual graph induced by the solved optimal flow `f*`. Denote this residual network by `G_R(f*)`. For each original edge `(u,v) in E`, the forward residual capacity is

```text
r_f(u,v) = c(u,v) - f*(u,v)
```

and the reverse residual capacity is

```text
r_f(v,u) = f*(u,v).
```

The forward term records how much additional flow can still be pushed through `(u,v)`, while the reverse term records how much already-assigned flow can be withdrawn and rerouted if a better residual path exists. This residual view is the object from which both the solved minimum cut and the wider minimum-cut family are derived.

From the baseline flow solve we already inherit one exact minimum-cut partition `(S*, T*)`, where `S*` is the source-side set returned by the residual search used inside `FlowModule`. `MinCutUtilitiesModule` then performs the complementary step: a **backward residual search from the sink**. Let `R_t` denote the set of nodes that can still reach the sink through positive residual capacity. Taking the complement of that set, restricted to the original graph nodes, gives the larger lattice boundary `S**`.

This is the key structural step. `S*` gives one solved source-side minimum-cut set, while `S**` gives the largest admissible source-side region consistent with the same optimal cut value. Together they define the interval of feasible minimum-cut source sides and therefore move the analysis from one solved cut to the full bottleneck family.

---

## From the residual lattice to bottleneck edge families

Before characterising the edge sets, one additional definition is needed. In this module, an edge `(u,v)` is treated as **saturated** when its solved flow exhausts its available capacity, i.e.

```text
f*(u,v) = c(u,v)
```

up to the numerical tolerance used in the implementation. Only such edges can participate in a binding minimum cut, because an unsaturated edge still retains spare residual capacity and therefore cannot sit on the active throughput-limiting boundary.

Once `S*` and `S**` are known, the first useful family is the set of edges that appear in **some** minimum cut. An edge `(u,v)` belongs to this family if it is saturated and satisfies

```text
u in S**  and  v not in S*.
```

This is what the note means by “satisfying the lattice condition”. The edge must lie in the admissible region between the smallest solved source-side cut `S*` and the larger residually permitted boundary `S**`. The resulting set is the full candidate bottleneck family: every edge that can occur in at least one valid minimum cut of capacity `F*`.

The stricter family is the set of edges that appear in **every** minimum cut. Here the condition tightens to

```text
u in S*  and  v in T**,
```

where `T**` denotes the corresponding sink-side set induced by the same backward residual reachability calculation. These edges are the unavoidable bottlenecks. No matter which valid minimum-cut representative is chosen, the cut must cross them.

This distinction is important in engineering terms. Edges in **some** minimum cut are potentially critical under at least one optimal bottleneck configuration, whereas edges in **every** minimum cut are unavoidably critical under all of them.

---

## Free zone, non-uniqueness, and bounded enumeration

The same residual-lattice picture also explains when the minimum cut is unique and when it is not. Define the **free zone** by

```text
F = S** \ S*
```

This is the set of nodes that can move between the source-side and sink-side boundary without changing the minimum-cut capacity. If `F` is empty, then the solved minimum cut is effectively unique in the lattice sense. If `F` is nonempty, then multiple alternative minimum-cut configurations exist.

Every valid minimum-cut source side can then be written in the form

```text
S = S* ∪ R,   where R ⊆ F.
```

This identity is the basis of the enumeration procedure. The module generates minimum cuts by iterating over subsets `R` of the free zone, forming the induced cut, and checking the resulting crossing edges and cut capacity. In that sense, `free_zone_size` is not just a bookkeeping output: it is a compact measure of how rigid or interchangeable the bottleneck structure is.

Its practical interpretation is straightforward:

- `free_zone_size = 0` means the bottleneck is sharply localised and effectively unique,
- `free_zone_size > 0` means alternative but equally limiting cut configurations exist,
- larger free zones indicate a broader region of interchangeable limiting structure.

The cost of full enumeration follows directly from this construction. Since every subset of `F` is a candidate, the number of possible minimum cuts grows as

```text
2^|F|.
```

That is why the module exposes the optional parameter `cut_limit`. Enumeration is deterministic and proceeds in canonical order, but once the number of possible subsets becomes too large the procedure is intentionally truncated. The returned flags `is_complete` and `free_zone_size` then tell the user whether the full family was recovered or whether only the first bounded portion was listed. There is also an overflow guard so that extremely large free zones do not lead the code to claim an unsafe exact count beyond the `Int64` range.

---

## Implementation and design choices

### 1. No extra solver calls
This is the most important design choice.

The module is intentionally built to consume the existing `flow_result` rather than rerun max-flow repeatedly. That keeps it exact **and** cheap.

### 2. Residual-BFS-based logic
The expensive optimisation has already happened in `FlowModule`. Here the heavy lifting is just:

- one residual reachability pass
- edge scans over the original network
- optional bounded subset enumeration

### 3. Deterministic outputs
Cuts are sorted and enumerated in a fixed order. This matters for reproducibility in a thesis or benchmark study.

### 4. Bounded-flow guard
The module refuses to operate on an unbounded flow result, because minimum-cut analysis is only meaningful when the baseline problem has a finite solved capacity.

---

## What this module means in chapter terms

This module maps most directly to the chapter objective:

> **Which cut sets form the binding bottlenecks on throughput?**

More specifically, it gives:

- the actual bottleneck partition from the baseline solve
- the set of edges that are always critical
- the wider family of alternative capacity-limiting cut configurations
- the count of distinct minimum-cut failure modes when enumeration is complete

So this is the point where the methodology moves from **throughput value** to **bottleneck structure**.

---

## Relationship to other modules

`MinCutUtilitiesModule` is a bridge module.

It sits immediately after `FlowModule` and feeds interpretation into later analyses:

- `StructuralModule`: uses cut structure to identify structural bottlenecks and SPOFs, especially when an edge appears in every minimum cut.
- `FailureImpactModule`: focuses on components that lie in some minimum cut, so failure testing is concentrated on components that can actually bind throughput.
- `SensitivityModule`: studies how perturbing bottleneck capacities changes throughput once the candidate limiting edge family has been identified.

So it is not a standalone solver. It is the exact structural interpretation layer built on top of the solved max-flow result, and it helps connect the baseline throughput result to later questions about vulnerability, reinforcement, and failure-mode diversity.

---

## One-sentence summary

`MinCutUtilitiesModule` takes the solved baseline max-flow result and, without rerunning the solver, extracts the exact minimum-cut structure of the network: one representative cut, the edges that appear in some or every minimum cut, and the bounded enumeration of all equivalent bottleneck cut configurations.
Also, I’m developing a Failure Impact Module, which is designed for scenario-based analysis of how throughput is affected by edge failures or degradation. This approach allows me to quantify lost capacity better.