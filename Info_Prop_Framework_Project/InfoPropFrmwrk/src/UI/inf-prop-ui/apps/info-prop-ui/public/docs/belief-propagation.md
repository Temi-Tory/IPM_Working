# Exact Inference

## Purpose

Exact Inference computes the **probability that each node in the network receives at least one signal** from any source node. It accounts for node priors (intrinsic activation probability), edge transmission probabilities, and the structure of the network including correlated paths (diamonds).

Unlike approximate methods such as Monte Carlo simulation or loopy belief propagation, this algorithm produces **exact results** by leveraging the DAG structure, inclusion-exclusion combinatorics, and conditional expectation over diamond subgraphs.

---

## Required Inputs

| Input | Description |
|-------|------------|
| **Network topology** (`.EDGES`) | Directed edges defining the graph |
| **Node priors** (`*-nodepriors.json`) | P(node is active), independent of incoming signals |
| **Link probabilities** (`*-linkprobabilities.json`) | P(signal traverses edge successfully) |

---

## How to Read the Results

### Results Table

| Column | Description |
|--------|------------|
| **Node ID** | Node identifier from the network |
| **Belief** | Computed P(node receives >= 1 signal from any source). This is the primary output. |
| **Prior** | The node's input prior probability |
| **Method** | Computation method used (see below) |
| **Complexity** | Relative computational cost: Source, Simple, Moderate, Complex |
| **Sensitivity** | How sensitive the belief is to changes in the prior |
| **Uncertainty Width** | For interval/p-box data: width of the belief uncertainty interval |

### Computation Methods

| Method | When Used | Meaning |
|--------|-----------|---------|
| **Source Node** | Node has no incoming edges | Belief = Prior |
| **Tree Propagation** | Single parent, no convergence | Direct multiplication along the path |
| **Inclusion-Exclusion** | Multiple independent incoming paths | Correctly combines overlapping probabilities: P(A or B) = P(A) + P(B) - P(A)P(B) |
| **Diamond Enumeration** | Correlated incoming paths (diamond structure) | Conditional expectation over shared ancestors: exact handling of path dependence |

### Statistics Panel

- **Mean belief** -- Average across all nodes
- **Min / Max belief** -- Weakest and strongest nodes
- **Node count by method** -- Distribution of computation complexity

---

## The Algorithm (Conceptual)

1. **Topological processing**: Nodes are processed layer by layer from sources to sinks, ensuring all parents are computed before their children.

2. **Source nodes**: `belief[source] = prior[source]`

3. **Regular join nodes** (independent paths): Each parent contributes `belief[parent] * P(edge)`. These contributions are combined via the **inclusion-exclusion principle**:

   ```
   P(A1 or A2 or ... or An) = sum(Ai) - sum(Ai*Aj) + sum(Ai*Aj*Ak) - ...
   ```

   The implementation uses efficient bit-masking over all 2^n subsets.

4. **Diamond join nodes** (correlated paths): When paths share a common fork ancestor, they are not independent. The framework identifies the **conditioning nodes** (shared fork ancestors) and computes:

   ```
   belief[join] = sum over all states of conditioning nodes:
       P(state) * belief[join | conditioning nodes fixed to state]
   ```

   For k conditioning nodes, this requires 2^k sub-computations, each running a full belief propagation on the diamond subgraph.

5. **Final belief**: `belief[node] = prior[node] * P(node receives >= 1 signal)`

---

## Supported Data Types

| Type | Format | Example | Notes |
|------|--------|---------|-------|
| **Float64** | Scalar | `0.85` | Standard precise probability. Fastest computation. |
| **Interval** | `[lower, upper]` | `[0.75, 0.95]` | Bounds on the true probability. Arithmetic follows interval rules. |
| **P-box** | Distribution family | `normal(0.85, 0.03)` | Generalised uncertainty combining aleatory and epistemic components. |

> **Note**: The optimised computation engine (default) supports Float64 only for belief propagation. Interval and p-box support uses the standard engine.

---

## Multi-Scenario Analysis

Each uploaded scenario (folder containing node priors + link probabilities) appears as a separate tab. All scenarios auto-compute on load.

**Comparison use cases:**
- Impact of degraded link probabilities on downstream reachability
- Sensitivity of specific nodes to different prior distributions
- Identifying nodes that are robust vs fragile across scenarios

---

## Verification

The framework includes two independent verification methods:

- **Monte Carlo simulation**: Samples the network 100,000 times and estimates beliefs empirically
- **Path enumeration**: Finds all simple paths and computes exact probabilities via inclusion-exclusion on path sets

Both should agree with the belief propagation results (Monte Carlo within sampling error).
