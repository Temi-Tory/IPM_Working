# FlowDecompositionModule — clear working notes

## What this module is

`FlowDecompositionModule` takes the solved baseline max-flow and expresses it as a collection of explicit source-to-sink path-flow components.

It does not solve a new optimisation problem. Instead, it post-processes the already-solved `flow_result` and decomposes the total flow into paths that actually carry positive flow.

In simple terms:

- `FlowModule` tells us the total amount of flow delivered.
- `FlowDecompositionModule` tells us **how that total flow is routed across actual source-to-sink paths**.

---

## Why engineers need this module

A single total max-flow value is useful but often too aggregated for interpretation. Engineers may want to know whether the delivered throughput is spread over many moderate routes or concentrated in a small number of dominant corridors.

This matters because two networks can have the same total max flow but very different path-level service structure. One may distribute flow broadly across several routes, while another may rely heavily on only one or two high-flow paths.

So this module provides a more interpretable path-level picture of the solved flow pattern.

---

## Network model and notation

Let

```text
G = (V, E)
```

be the capacitated DAG and let `f*` be the solved optimal flow from the baseline `FlowModule` stage.

The flow decomposition theorem states that any feasible flow can be written as a sum of path flows (and cycle flows in the fully general directed case). In this DAG setting there are no directed cycles to manage, so the decomposition reduces naturally to a sum of source-to-sink path components.

Thus the module seeks a representation of the form

```text
f* = sum_j phi_j * 1_{P_j},
```

where each `P_j` is a source-to-sink path and each `phi_j > 0` is the flow carried by that path component.

---

## What this module takes in

The main public function is:

```julia
decompose_flow(edgelist, source_nodes, sink_nodes, flow_result; tol=1e-10)
```

### Core inputs

- `edgelist`: original directed edges
- `source_nodes`: source set
- `sink_nodes`: sink set
- `flow_result`: solved baseline flow result

### Optional control

- `tol`: numerical tolerance for positive-flow and equality checks

---

## What it returns

The main result type is `FlowDecomposition`, containing:

- `components`: a list of `FlowPathComponent` records
- `total_flow`: sum of the component flow values
- `is_unique`: whether the decomposition is unique

Each `FlowPathComponent` contains:

- `path`: the explicit node sequence
- `flow_value`: the amount of flow carried by that component
- `bottleneck_edge`: the bottleneck edge on that path component

The current implementation returns one **valid deterministic decomposition**. It does not claim uniqueness in general.

---

## What the module actually does

The module takes the solved edge-flow dictionary and repeatedly extracts one positive-flow source-to-sink path at a time from a mutable working copy of the flow.

For each extracted path:

1. find a source that still has positive outgoing flow,
2. follow positive-flow edges until a sink is reached,
3. compute the path bottleneck as the minimum flow on that path,
4. record that as one `FlowPathComponent`,
5. subtract that path flow from the working flow,
6. repeat until no source has any positive outflow left.

This produces a path-based decomposition whose component totals add up exactly to the solved max-flow value.

---

## Mathematical basis

### 1. Flow decomposition theorem

The theoretical basis is the standard flow decomposition result: a feasible flow can be decomposed into path components whose sum reconstructs the original flow exactly.

In a DAG, this becomes especially clean because there are no directed cycles to strip out separately.

### 2. Path bottleneck value

For a component path

```text
P = (v1, v2, ..., vk),
```

the component flow value is

```text
phi(P) = min { f*(vi, vi+1) : i = 1, ..., k-1 }.
```

This is the largest amount that can be subtracted from that path while preserving nonnegative residual flow on every edge of the path.

### 3. Exactness checks

A valid decomposition must satisfy two conditions:

```text
sum_j phi_j = F*
```

and, for every edge `e ∈ E`,

```text
sum_{j : e in P_j} phi_j = f*(e).
```

The module explicitly validates both of these conditions.

---

## How the algorithm works

### A. Build a working flow copy

The code copies the solved edge-flow dictionary into a mutable `working_flow` structure and clips tiny negative numerical noise to zero.

### B. Select a source with remaining positive outflow

Sources are sorted deterministically, and the first source that still has positive outgoing flow is chosen.

### C. Extract one positive-flow path

The algorithm follows the lexicographically earliest outgoing edge with positive remaining flow until a sink is reached.

### D. Form the path component

The component flow value is the minimum remaining flow along that path, and the bottleneck edge is the lexicographically smallest path edge attaining that minimum.

### E. Subtract the component

That amount is subtracted from every edge of the path in the working-flow copy.

### F. Repeat until exhausted

The process continues until all source outflows are exhausted.

### G. Validate the decomposition

Before returning, the module verifies:

- total component flow equals the solved max flow,
- per-edge accounting matches the original solved flow,
- all component paths are valid,
- and integer-flow cases remain integral within tolerance.

---

## Implementation and optimisation decisions

### 1. Deterministic canonical extraction

The decomposition is not unique in general, so the code uses a deterministic rule: it repeatedly extracts the lexicographically earliest positive-flow path. This makes the returned decomposition reproducible.

### 2. No new solver calls

The entire module is graph/flow post-processing only. No additional optimisation solve is needed.

### 3. Explicit validation step

A dedicated `validate_decomposition(...)` routine checks both global and per-edge exactness before the result is accepted. This is an important correctness design choice.

### 4. Integer-flow consistency check

If the solved edge flows are effectively integral, the module checks that the component flow values are integral as well, consistent with the integrality theorem.

### 5. DAG-friendly interpretation

Because the framework focuses on DAG models, the decomposition can be interpreted directly as explicit service corridors rather than having to separate path flow from circulation cycles.

---

## What insights this module brings

This module helps answer questions such as:

- Which source-to-sink routes actually carry the delivered flow?
- Is throughput spread broadly or concentrated in only a few corridors?
- Which path bottlenecks dominate the realised routing pattern?

So it adds interpretability to the baseline max-flow value by revealing the actual routed path structure behind it.

---

## Relationship to the other modules

`FlowDecompositionModule` sits immediately downstream of the baseline solve and complements the structural and bottleneck analyses.

- `FlowModule` gives the total throughput.
- `StructuralModule` enumerates topological paths and bottlenecks.
- `FlowDecompositionModule` then identifies only the paths that actually carry positive solved flow.

So it is the toolkit’s **path-level interpretation layer** for the solved network state.

---

## One-sentence summary

`FlowDecompositionModule` converts the solved max-flow result into a deterministic exact sum of positive source-to-sink path components, making the routed structure of the delivered flow directly interpretable.