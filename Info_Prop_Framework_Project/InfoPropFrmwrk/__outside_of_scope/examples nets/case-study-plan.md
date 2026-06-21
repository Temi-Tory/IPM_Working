The goal is to **demonstrate the full toolkit richly and non-trivially**. The best flagship benchmark is:

# **A staged multi-source, multi-sink infrastructure DAG with redundant corridors, shared bottlenecks, multiple minimum cuts, and node-capacity constraints**

This should be treated as a **representative benchmark infrastructure network** for the `CapacityAnalysisKit` chapter — not as a toy graph. The network should be deliberately engineered so that **every major module** has something meaningful to reveal.

---

## 1. Recommended size — revised upward for richness

To ensure the benchmark is genuinely demonstrative, aim slightly larger than the original outline:

- **40–80 nodes** total  
  - ideal first flagship instance: **45–65 nodes**
- **90–180 directed edges**
- **4–6 source nodes**
- **6–10 sink nodes**
- **6–8 topological layers**
- **3–5 explicitly node-capacitated hubs**
- **3 major macro-corridors** plus **1–2 backup/bypass corridors**

This size is still readable in a thesis chapter, but now rich enough to support:

- multiple candidate cuts,
- nontrivial flow decomposition,
- meaningful single-edge and multi-edge failures,
- node-capacitated effects,
- threshold and upgrade analyses.

---

## 2. Recommended layered structure

### Default blueprint

```text
Layer 1: origin depots / supply nodes    (4–6 true source nodes)
Layer 2: primary regional hubs           (8–10 nodes)
Layer 3: processing / transfer centres   (6–8 nodes)
Layer 4: trunk distribution hubs         (8–10 nodes)
Layer 5: secondary distribution hubs     (6–8 nodes)
Layer 6: demand nodes / sinks            (6–10 true sink nodes)
```

This keeps the case study a **clean DAG** while still supporting many overlapping source-to-sink paths.

> **Important framework-driven rule:** the stored benchmark should remain **unreduced**.  
> The toolkit’s `FlowModule` already performs the multi-source / multi-sink reduction internally by adding a super-source and super-sink in `_build_augmented_network(...)`. So the benchmark itself should contain **real source nodes and real sink nodes**, not pre-baked super terminals.

### Concrete design intent

- **Layer 1 → Layer 2** should create multiple entry corridors from each source.
- **Layers 2–4** should contain the most important shared infrastructure and therefore the most interesting bottlenecks.
- **Layers 4–6** should fan out again, creating competing delivery corridors and backup options.
- A small number of **cross-links** should be included between adjacent hubs to create redundancy without destroying the staged DAG structure.

---

## 3. Mandatory structural motifs the network must contain

To demonstrate the full toolkit, the benchmark should intentionally include the following motifs.

### ✅ Redundancy
- multiple parallel routes from sources to sinks
- at least **three distinct macro-corridors** carrying nonzero baseline flow

### ✅ Shared bottlenecks
- some edges and hubs should sit on many source-to-sink paths
- at least one mid-layer region should act as a shared choke structure

### ✅ Node-capacity effects
- at least **3–5 relay/processing nodes** should have finite node capacities
- at least one of those node capacities should be **binding** in the node-capacitated solve

### ✅ Uneven capacities
- high-capacity trunk edges
- medium-capacity transfer links
- low-capacity fragile connectors and bypass links

### ✅ Multiple critical regions
- not just one obvious bottleneck
- at least **two distinct vulnerable substructures** should compete to limit throughput

### ✅ Near-tie bottlenecks
- some alternative cuts should have nearly equal total capacity
- this helps sensitivity, threshold, and upgrade results become informative

### ✅ Failure interactions
- some failures should be individually mild but jointly severe
- the `k=2` or `k=3` failure analysis should reveal combinations far worse than the top single-edge failure alone

### ✅ Multiple minimum cuts
- the benchmark should be engineered so that there is **more than one minimum cut**
- ideally, `edges_in_every_cut` is nonempty but **strictly smaller** than `edges_in_some_cut`
- in lattice terms, the construction should encourage a nonempty free zone `F = S** \ S*`

---

## 4. Capacity design principles

The capacities should be chosen so the network is **not** trivial.

### General guidance
- keep capacities **integer-valued** where possible for interpretability and integrality-theorem discussion
- avoid making one edge overwhelmingly smaller than all others, unless it is intentionally used as a SPOF example
- do **not** assign all capacities uniformly; that often makes the benchmark less interesting

### Suggested edge-capacity ranges
- **sources to primary hubs:** high, e.g. `12–25`
- **primary to processing/trunk nodes:** medium-high, e.g. `8–18`
- **mid-network trunk links:** medium, e.g. `6–14`
- **trunk to secondary hubs:** medium, e.g. `6–12`
- **secondary hubs to sinks:** lower feeder capacities, e.g. `3–9`
- **backup/bypass edges:** deliberately lower, e.g. `2–6`

### Suggested node capacities
- assign finite node capacities to **processing / transfer centres** and a few high-traffic hubs
- choose these so at least one hub becomes saturated and reduces throughput relative to the edge-only baseline
- use node capacities that are **lower than the sum of incident incoming/outgoing capacities**, otherwise the node-capacitated result may be uninformative

### Specific design goal
Choose capacities so the **baseline max flow is limited by several plausible cut regions**, not only one single obvious edge. This is what makes:

- cut enumeration,
- importance analysis,
- degradation thresholds,
- and upgrade thresholds

worth demonstrating.

---

## 5. Framework-driven constraints from the actual code

Reading the framework code imposes several **non-negotiable design rules** on the benchmark.

### Input and reduction rules (`FlowModule`)
- the input graph should be a **directed edge list** with explicit `source_nodes` and `sink_nodes`
- `source_nodes` and `sink_nodes` must be **non-empty, disjoint, and present in the graph**
- the toolkit itself adds the super-source / super-sink internally, so the benchmark should **not** include them directly
- original edge capacities should be **finite and nonnegative**; avoid using `Inf` on original benchmark edges

### DAG / path-enumeration rules (`StructuralModule`, `FlowDecompositionModule`)
- the flagship benchmark should be a **true DAG**
- it should have **multiple meaningful flow-carrying paths**, but not so many that enumeration explodes
- because `enumerate_paths(...)` is bounded by `path_limit`, the benchmark should be rich while still staying within a manageable path count unless the chapter deliberately raises that limit

### Minimum-cut enumeration rules (`MinCutUtilitiesModule`)
- to showcase lattice-based cut enumeration properly, the benchmark should have **more than one minimum cut**
- however, the free-zone size should stay **moderate**, so the total number of cuts remains small enough to enumerate completely under a practical `cut_limit`
- a good target is a **small but nontrivial free zone** rather than a combinatorial explosion

### Failure-combination tractability (`FailureImpactModule`)
- `k`-edge failure analysis is combinatorial and guarded by `combination_limit`
- therefore, the benchmark should produce a **meaningful but not enormous** set of candidate critical edges
- in practice, this means enough edges in some minimum cut to make the analysis interesting, but not so many that `k=2` / `k=3` scenarios become intractable

### Threshold-analysis rules (`ParametricThresholdModule`)
- degradation and upgrade thresholds require **finite original capacities** on the target edges
- the benchmark should contain several edges where a threshold is informative, i.e. not all edges are either completely irrelevant or trivially dominant

### Connectivity interpretation rules (`GlobalConnectivityModule`)
- in a directed DAG, global edge/node connectivity may be **low or even zero** for some node pairs
- therefore the case study should treat global connectivity as a **complementary structural metric**, not as the primary performance metric
- the main story should still be source-to-sink throughput, cuts, and resilience

---

## 6. What it must be able to showcase for each framework component

### `FlowModule`
- baseline max flow
- source-to-sink throughput
- saturated edges
- agreement across `Dinic`, `Edmonds-Karp`, and `Push-Relabel`

### `StructuralModule`
- path enumeration
- bottleneck ranking
- SPOF edges / SPOF nodes
- topological positioning of nodes
- edge redundancy scores

### `FlowDecompositionModule`
- path-level decomposition of the max flow
- at least **several nonzero path components**, not a single dominant route only
- interpretation of main corridors versus backup corridors

### `FailureImpactModule`
- single-edge failures
- `k=2` or `k=3` failure combinations
- at least one combination that is far more damaging than any single-edge failure

### `NodeCapacitatedFlowModule`
- explicit demonstration that finite node capacities can reduce throughput
- identification of saturated nodes and node-based SPOFs

### `ParametricThresholdModule`
- degradation thresholds for critical components
- target-flow interpretation, e.g. “how much degradation can this edge tolerate before throughput falls below 90% of baseline?”
- upgrade thresholds showing the minimum increase needed to recover or reach a target throughput

### `MinCutUtilitiesModule`
- one representative minimum cut
- **full minimum-cut enumeration**
- `edges_in_every_cut` versus `edges_in_some_cut`
- ideally **more than one minimum cut** for a richer story

### `SensitivityModule`
- Birnbaum importance
- marginal capacity values
- a clear ranking of which edges matter most to performance

### `GlobalConnectivityModule`
- edge connectivity `λ`
- node connectivity `κ`
- interpretation of how global connectivity differs from source-to-sink throughput in a DAG

### Exactness / validation checks
The benchmark should also support a short subsection showing:

- `max_flow == mincut_capacity`
- decomposition totals equal the solved max flow
- node-capacitated max flow is no larger than the baseline
- solver agreement across algorithms

---

## 7. Acceptance criteria before using this as the thesis flagship case study

The network should satisfy **most or all** of the following before it is accepted as the main demonstrator:

- **DAG structure verified**
- the stored network is **unreduced multi-source / multi-sink input**, with super terminals added only internally by the toolkit
- **more than one source-to-sink corridor** carries nonzero flow
- `decompose_flow(...)` returns **multiple meaningful path components**
- path enumeration stays within the chosen `path_limit`, or the thesis explicitly justifies increasing that limit
- at least **one SPOF edge** and preferably **one SPOF node** are identified
- `enumerate_min_cuts(...)` returns **more than one minimum cut**
- min-cut enumeration is **complete** under the chosen `cut_limit`, not silently truncated
- `edges_in_every_cut` is nonempty and a **proper subset** of `edges_in_some_cut`
- node-capacitated throughput is **strictly less** than the baseline throughput
- at least one single-edge failure causes a visible drop in flow
- at least one `k=2` failure combination causes a much larger drop than the worst single-edge failure
- the selected `k`-failure study remains within the chosen `combination_limit`
- at least one edge has an informative degradation threshold and one has an informative upgrade threshold
- global connectivity results are interpretable and not completely redundant with the source-to-sink max-flow result

If these conditions are not met, the network should be enriched further rather than used as the flagship benchmark.

---

## 8. What to avoid

Avoid the following, because they make the case study look too simple or too contrived:

- a pure star or hub-and-spoke graph with one obvious bottleneck only
- a network where nearly all capacities are equal
- a graph so sparse that failure results are trivial
- a graph so dense that every node behaves similarly and no clear structure emerges
- a benchmark with only one source and one sink unless there is very rich internal structure
- a case where min-cut enumeration returns only one trivial cut and no meaningful distinction between “some cut” and “every cut” edges
