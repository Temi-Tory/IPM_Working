# Network Concepts

## Directed Acyclic Graphs (DAGs)

The IPA Framework operates on **directed acyclic graphs** (DAGs). A DAG is a graph where:

- Every edge has a direction (from source to destination)
- There are **no cycles** -- you cannot follow edges from a node and return to the same node

DAGs naturally model information flow, project dependencies, supply chains, and communication networks where signals propagate in one direction.

---

## Node Types

The framework classifies every node in the network based on its connectivity:

### Source Nodes

Nodes with **no incoming edges**. These are where information or resources originate.

- In belief propagation: their belief equals their prior probability
- In capacity analysis: these have input rates (how much flow enters the network)
- In CPM: these are project start points (Early Start = 0)

### Sink Nodes

Nodes with **no outgoing edges**. These are terminal nodes where information or resources are consumed.

- In capacity analysis: these are target nodes where output is measured
- In CPM: these determine the project completion time

### Fork Nodes

Nodes with **more than one outgoing edge**. A fork node sends its signal to multiple downstream nodes.

- Critical for diamond identification -- forks that are shared ancestors of a join node create diamonds
- In capacity analysis: flow from a fork is distributed across outgoing edges

### Join Nodes

Nodes with **more than one incoming edge**. A join node receives signals from multiple paths.

- The central challenge of belief propagation: when a join node receives correlated signals (from shared ancestors), naive multiplication overestimates the probability
- Diamonds are identified at join nodes to handle this correlation correctly

### Intermediate Nodes

All other nodes with exactly one incoming and one outgoing edge. These are simple relay nodes.

---

## Graph Structure

### Edge List

The primary way to define a network. Each line specifies a directed edge:

```
source,destination
1,3
1,4
2,4
```

This means: "node 1 sends to node 3", "node 1 sends to node 4", "node 2 sends to node 4".

### Adjacency Indices

Internally, the framework builds two lookup tables:

- **Outgoing index**: For each node, which nodes does it send to?
  ```
  1 -> {3, 4}
  2 -> {4, 5}
  3 -> {6}
  ```

- **Incoming index**: For each node, which nodes send to it?
  ```
  3 -> {1}
  4 -> {1, 2}
  6 -> {3, 4}
  ```

### Topological Layers (Iteration Sets)

The framework organises nodes into **topological layers** using breadth-first search from source nodes:

```
Layer 0: {1, 2}         -- Source nodes
Layer 1: {3, 4, 5}      -- Directly reachable from sources
Layer 2: {6, 7}          -- Reachable from layer 1
Layer 3: {8}             -- Reachable from layer 2
```

Processing nodes layer by layer guarantees that when we compute a node's value, all its parents have already been computed. This is the foundation of every algorithm in the framework.

---

## Ancestors and Descendants

For each node, the framework pre-computes:

- **Ancestors**: All nodes that can reach this node by following edges forward
  ```
  ancestors(8) = {1, 2, 3, 4, 5, 6, 7}
  ```

- **Descendants**: All nodes reachable from this node
  ```
  descendants(1) = {3, 4, 6, 7, 8}
  ```

These relationships are essential for diamond identification. A diamond exists at a join node when two of its parents share a common fork ancestor.

---

## Diamonds

A **diamond** is a substructure where multiple paths from a common ancestor converge at a join node. The simplest diamond:

```
    F
   / \
  A   B
   \ /
    J
```

Here, fork node **F** sends to both **A** and **B**, which both send to join node **J**. The paths F->A->J and F->B->J are **correlated** because they share the source F.

### Why Diamonds Matter

Without diamond handling, belief propagation would treat the two paths as independent:

```
P(J receives signal) = 1 - (1 - P(A->J)) * (1 - P(B->J))
```

But this is **incorrect** because both paths depend on whether F transmitted. The correct approach uses **conditional expectation**:

```
P(J) = P(F active) * P(J | F active) + P(F inactive) * P(J | F inactive)
```

When F is active (probability = belief[F]), both paths can transmit. When F is inactive, neither path from F can transmit. This is the diamond conditioning algorithm.

### Complex Diamonds

Real networks can have:
- **Multiple conditioning nodes** (several shared fork ancestors)
- **Nested diamonds** (diamonds within diamonds)
- **Overlapping diamonds** (a node participates in multiple diamonds)

The framework handles all of these through recursive diamond identification and state enumeration.

---

## Network Properties

| Property | Definition | Significance |
|----------|-----------|--------------|
| **Total nodes** | Count of all nodes | Network size |
| **Total edges** | Count of all directed connections | Network connectivity |
| **Source count** | Nodes with in-degree 0 | Number of information origins |
| **Sink count** | Nodes with out-degree 0 | Number of terminal points |
| **Fork count** | Nodes with out-degree > 1 | Branching complexity |
| **Join count** | Nodes with in-degree > 1 | Convergence complexity |
| **Layer count** | Number of topological layers | Network depth |
| **Diamond count** | Number of unique diamond structures | Correlation complexity |

---

## Probability Semantics

### Node Priors

Each node has a **prior probability** representing its intrinsic reliability or activation chance, independent of incoming signals.

- `prior = 1.0` -- node is always active (deterministic)
- `prior = 0.0` -- node is always inactive (blocked)
- `0 < prior < 1` -- node is probabilistically active

### Edge Probabilities (Link Probabilities)

Each edge has a **transmission probability** representing the chance that a signal successfully traverses that edge.

- `P(edge) = 1.0` -- perfect transmission
- `P(edge) = 0.0` -- edge is broken
- `0 < P(edge) < 1` -- probabilistic transmission

### Belief

The **belief** of a node is the computed probability that it receives at least one signal from any source, accounting for its prior and all incoming paths:

```
belief(node) = prior(node) * P(node receives >= 1 signal from sources)
```
