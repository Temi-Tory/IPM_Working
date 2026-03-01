# Diamond Patterns

## Definition

A **diamond** is a substructure in a DAG where multiple paths from one or more shared fork ancestors converge at a join node. Diamonds represent **correlated paths** -- paths whose activation probabilities are not independent because they share a common source of randomness.

The simplest diamond:

```
    F (fork)
   / \
  A   B
   \ /
    J (join)
```

Paths F->A->J and F->B->J are correlated through F. If F is inactive, neither path can transmit a signal.

---

## Why Diamonds Matter

In probabilistic inference, treating correlated paths as independent leads to **overestimation** of reachability. For the diamond above:

- **Incorrect** (assumes independence): P(J) = 1 - (1 - P(A->J))(1 - P(B->J))
- **Correct** (conditional expectation): P(J) = P(F) * P(J | F active) + (1 - P(F)) * P(J | F inactive)

The framework automatically identifies all diamonds in the network and uses the correct conditional expectation approach.

---

## Diamond Identification

The framework uses a **9-step algorithm** at each join node:

1. Find all parent nodes of the join
2. Identify fork ancestors shared by two or more parents
3. Extract the induced subgraph (all edges on paths from shared forks to join)
4. Determine conditioning nodes (the shared fork ancestors)
5. Include all intermediate nodes and their incoming edges
6. Recursively check for nested diamonds among intermediate nodes
7. Build pre-computed subgraph data for efficient computation

---

## Reading the Results

### Summary Metrics

| Metric | Description |
|--------|------------|
| **Root diamond count** | Number of join nodes with diamond structures |
| **Unique diamond count** | Number of structurally distinct diamonds (de-duplicated by hash) |
| **Diamond efficiency** | unique / total ratio. Low efficiency = many shared patterns (good for caching) |
| **Computation time** | Time for identification + pre-computation |

### Per-Diamond Details

| Field | Description |
|-------|------------|
| **Join node** | The convergence point |
| **Conditioning nodes** | Shared fork ancestors creating the correlation |
| **Node count / Edge count** | Size of the diamond subgraph |
| **Is root** | Top-level diamond vs nested sub-diamond |
| **Non-diamond parents** | Parents of the join node not involved in any diamond (treated as independent) |

---

## Diamond Classification

The framework classifies each diamond along multiple dimensions:

### Fork Structure
- **Single fork**: One conditioning node
- **Multi-fork**: Multiple conditioning nodes (2^k state enumeration)
- **Chained fork**: Internal nodes act as both fork and join

### Internal Structure
- **Simple**: No internal forks/joins
- **Nested**: Contains sub-diamonds requiring recursive computation
- **Sequential**: Chain pattern (fork->join->fork->join)
- **Interconnected**: Cross-connected paths between branches

### Path Topology
- **Parallel**: Independent paths within the diamond
- **Converging**: Paths merge before reaching the join
- **Cross-connected**: Paths exchange signals internally

### Complexity Implications

| Conditioning Nodes | States to Enumerate | Approximate Cost |
|-------------------|---------------------|-----------------|
| 1 | 2 | Minimal |
| 2 | 4 | Low |
| 4 | 16 | Moderate |
| 8 | 256 | High |
| 12+ | 4096+ | Very high (parallelised across threads) |

---

## Diamond Sub-Analysis

From the diamond detail view, you can run targeted analyses on individual diamonds:

- **Reachability**: Compute beliefs within the diamond subgraph with custom source overrides
- **Capacity**: Analyse flow bottlenecks localised to this substructure
- **CPM**: Determine the critical path through just this diamond's tasks

This is valuable for isolating the behaviour of complex network regions.

---

## Multi-Scenario Comparison

Diamond structures can vary between scenarios because node priors affect which sources are deemed relevant. Comparing scenarios reveals:

- Structural stability (do the same diamonds persist?)
- Complexity changes under different conditions
- Which diamonds are most sensitive to scenario parameters
