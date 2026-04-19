# Overview

## What is the IPA Framework?

The **Information Propagation Analysis (IPA) Framework** is a computational toolkit for analysing how information, signals, and resources propagate through directed acyclic graph (DAG) networks. It integrates probabilistic inference, network flow analysis, and project scheduling (CPM) into a unified platform.

The framework is designed for researchers and engineers working with network reliability, supply chain analysis, communication systems, or any domain where understanding signal reachability, capacity constraints, and critical path scheduling through a directed network is needed.

---

## Core Capabilities

| Analysis | Question Answered | Key Outputs |
|----------|-------------------|-------------|
| **Exact Inference** | What is the probability each node receives a signal? | Per-node beliefs, inference method, sensitivity |
| **Diamond Analysis** | Where do correlated paths exist in the network? | Diamond structures, conditioning nodes, complexity classification |
| **Capacity Analysis** | What is the maximum throughput and where are bottlenecks? | Node/edge flows, utilisation, bottleneck ranking, upgrade priorities |
| **Time Analysis (CPM)** | What is the critical path and which tasks have slack? | Early/late start/finish, total slack, Gantt visualisation |
| **Cost Analysis (CPM)** | Where is the budget concentrated and what is the cost-critical path? | Accumulated costs, budget share, cost slack |

---

## Architecture

The system has three layers:

```
Algorithm Modules (Julia)
  Reachability | Capacity | CPM | Diamond Identification
        |
  Backend Server (Julia HTTP)
  Stateless REST API  |  File management  |  JSON serialisation
        |
  Frontend Application (Angular)
  Interactive analysis views  |  Multi-scenario comparison  |  D3 visualisation
```

Each layer communicates through well-defined JSON contracts. The algorithms are independent of the server; the server is independent of the UI.

---

## Key Design Principles

### Exact inference

The belief propagation algorithm computes **exact probabilities** using inclusion-exclusion and conditional expectation over diamond structures. No Monte Carlo sampling, no approximations.

### Uncertainty quantification

Beyond scalar Float64 probabilities, the framework supports:
- **Interval arithmetic** -- bounds `[lower, upper]` for imprecise probabilities
- **Probability boxes (p-boxes)** -- combining aleatory and epistemic uncertainty

### Multi-scenario comparison

Upload multiple scenario folders (e.g. "Normal", "Degraded", "Breakdown 214") and compare results across all analyses simultaneously. Each scenario gets its own computation tab with independent results.

### Dynamic documentation

This documentation is served as static markdown files. To update it, edit the `.md` files in the `docs/` directory -- no application rebuild required.

---

## Required Input Data

| File Type | Format | Used By |
|-----------|--------|---------|
| Network topology | `.EDGES` (edge list CSV) | All analyses |
| Node priors | `*-nodepriors.json` | Exact Inference, Diamond Analysis |
| Link probabilities | `*-linkprobabilities.json` | Exact Inference |
| Capacities | `*-capacities.json` | Capacity Analysis |
| CPM inputs | `*-cpm-inputs.json` | Time Analysis, Cost Analysis |

See [Preparing Your Data](#data-formats) for detailed format specifications.
