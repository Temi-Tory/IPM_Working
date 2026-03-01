# Glossary

## A

### Ancestor
A node **A** is an ancestor of node **B** if there exists a directed path from A to B. In the framework, ancestors are pre-computed for every node and stored as sets.

---

## B

### Backward Pass
The second phase of CPM that computes Late Start (LS) and Late Finish (LF) by processing nodes in reverse topological order. Starting from sinks with LF = project duration, it propagates backwards: LF[n] = min(LS[successor] - edge_delay) for all successors.

### Belief
The computed probability that a node receives at least one signal from any source node. Defined as: `belief(n) = prior(n) * P(n receives >= 1 signal)`. The belief is the primary output of the exact inference algorithm.

### Bottleneck
An element (node or edge) operating at or near its maximum capacity. In capacity analysis, a bottleneck limits the flow through the network. Formally: `utilisation >= threshold` (typically 80-100%).

---

## C

### Capacity
The maximum throughput a node or edge can handle. Node capacity limits processing; edge capacity limits transmission.

### Conditioning Node
A fork node shared by multiple paths to a join node, which creates correlation. During diamond conditioning, these nodes are fixed to each possible state (active/inactive) to compute the correct joint probability.

### Comparative Analysis
An extended capacity analysis that provides capacity gaps, processing limitations, upgrade priorities, efficiency metrics, and strategic recommendations.

### Critical Path
The longest path through a network in CPM. Tasks on the critical path have zero slack -- any delay to these tasks delays the entire project.

### Critical Value
The maximum value computed across all nodes in CPM. For time analysis, this is the project duration. For cost analysis, this is the maximum accumulated cost.

---

## D

### DAG (Directed Acyclic Graph)
A graph with directed edges and no cycles. The fundamental data structure for the IPA Framework.

### Descendant
A node **B** is a descendant of node **A** if there exists a directed path from A to B.

### Diamond
A substructure in a DAG where multiple paths from shared fork ancestors converge at a join node. Diamonds represent correlated paths that require special handling during belief propagation.

### Diamond Efficiency
The ratio of unique diamonds to total raw diamonds: `unique_count / raw_count`. Low efficiency means many diamonds share the same structure (good for caching).

### Diamond Hash
A unique identifier for a diamond, computed from its edge list and conditioning nodes. Diamonds with identical hashes share pre-computed subgraph data.

---

## E

### Early Finish (EF)
The earliest time a task can be completed. Computed during the forward pass: `EF[n] = ES[n] + duration[n]`.

### Early Start (ES)
The earliest time a task can begin. For source nodes: `ES = 0`. For others: `ES[n] = max(EF[parent] + delay[parent -> n])` over all parents.

### Edge Probability
The probability that a signal successfully traverses a directed edge. Also called "link probability" or "transmission probability". Range: [0, 1].

### Edge Utilisation
The ratio of actual flow through an edge to its capacity: `utilisation = flow / capacity`.

---

## F

### Fork Node
A node with more than one outgoing edge. Fork nodes split information flow to multiple downstream paths.

### Forward Pass
The first phase of CPM that computes Early Start (ES) and Early Finish (EF) by processing nodes in topological order.

---

## G

### Gantt Bar
A visual representation of a task's position in the project timeline. The bar's left edge corresponds to ES, its width to duration, and its colour to slack (red = critical, green = flexible).

---

## I

### Inclusion-Exclusion Principle
A combinatorial formula for computing the probability of a union of events. For events A1, A2, ..., An: `P(A1 or A2 or ... or An) = sum of singles - sum of pairs + sum of triples - ...`. Used to combine independent path contributions at join nodes.

### Interval
An imprecise probability represented as `[lower, upper]`. Arithmetic follows interval rules where results bound all possible outcomes.

### Iteration Set
A group of nodes at the same topological depth (layer). Nodes in the same iteration set can be processed independently because none depends on another in the same set.

---

## J

### Join Node
A node with more than one incoming edge. Join nodes are where paths converge and where diamonds can form.

---

## L

### Late Finish (LF)
The latest time a task can be completed without delaying the project. Computed during the backward pass: `LF[sink] = critical_value`. For others: `LF[n] = min(LS[child] - delay[n -> child])`.

### Late Start (LS)
The latest time a task can begin without delaying the project: `LS[n] = LF[n] - duration[n]`.

### Link Probability
See *Edge Probability*.

---

## M

### Maximum Flow
The total throughput from sources to sinks given capacity constraints. Computed by the forward-pass capacity analysis algorithm.

### Monte Carlo Simulation
A verification method that samples the network many times (typically 100,000) and estimates node beliefs from the empirical activation frequency.

---

## N

### Network Utilisation
The ratio of total output at sinks to total input at sources: `utilisation = total_sink_flow / total_source_input`. A value of 1.0 means all source flow reaches sinks (no losses).

### Node Prior
The intrinsic probability that a node is active, independent of incoming signals. Range: [0, 1]. A prior of 1.0 means the node is always active.

---

## P

### P-Box (Probability Box)
A generalised uncertainty representation combining aleatory (random) and epistemic (knowledge) uncertainty. Encodes a family of possible CDFs bounded by lower and upper distribution functions.

### Path Enumeration
A verification method that finds all simple paths from sources to each node and computes exact probabilities using inclusion-exclusion on path sets.

### Prior
See *Node Prior*.

---

## S

### Scenario
A set of input files (e.g., node priors + link probabilities) representing a particular network condition. Multiple scenarios can be analysed and compared side-by-side.

### Sink Node
A node with no outgoing edges. In capacity analysis, sinks are where output is measured. In CPM, sinks determine the project completion time.

### Slack
The scheduling flexibility of a task: `slack = LS - ES = LF - EF`. Tasks with slack = 0 are on the critical path.

### Source Node
A node with no incoming edges. Sources are where information or resources originate.

### Spare Capacity
The unused capacity of an element: `spare = capacity - flow`. High spare capacity means the element could handle more load.

---

## T

### Topological Order
An ordering of nodes such that for every directed edge (u, v), node u comes before node v. The IPA Framework uses topological order (via iteration sets) to ensure all parents are processed before their children.

### Throughput
The rate of flow through a node or the entire network.

---

## U

### Upgrade Priority
A ranked recommendation from comparative analysis indicating which network element's upgrade would have the greatest impact on overall throughput.

### Utilisation
See *Edge Utilisation* or *Network Utilisation*.
