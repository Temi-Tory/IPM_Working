# Scheduling (CPM)

## Purpose

The Critical Path Method (CPM) analyses a network as a project schedule or cost accumulation model. Each node represents a task with a duration and/or cost; each edge represents a dependency with an associated delay or transfer cost.

The framework computes:
- **Forward pass**: Earliest possible start and finish times for every task
- **Backward pass**: Latest allowable start and finish times without delaying the project
- **Slack (float)**: How much scheduling flexibility each task has
- **Critical path**: The sequence of tasks with zero slack -- any delay on these delays the entire project

Both **time** and **cost** analyses are supported from the same CPM input data.

---

## Required Inputs

A CPM inputs JSON file with up to two sections:

| Section | Contents |
|---------|----------|
| `time_analysis` | `node_durations` (per-task duration), `edge_delays` (dependency delays) |
| `cost_analysis` | `node_costs` (per-task cost), `edge_costs` (transfer/communication costs) |

Either section can be provided independently or both together.

---

## Time Analysis

### The Forward Pass

Processes tasks in topological order (dependencies before dependents):

- **Source tasks**: ES = 0, EF = duration
- **Downstream tasks**: ES = max(EF of all predecessors + edge delays), EF = ES + duration
- **Project duration**: Maximum EF across all tasks

### The Backward Pass

Processes tasks in reverse topological order (from sinks back to sources):

- **Sink tasks**: LF = project duration
- **Upstream tasks**: LF = min(LS of all successors - edge delays), LS = LF - duration

### Slack

```
Total Slack = LS - ES  (equivalently: LF - EF)
```

| Slack Value | Interpretation |
|-------------|---------------|
| **0** | **Critical** -- This task is on the critical path. Any delay propagates to the project deadline. |
| **Small** (< 5% of project duration) | **Near-critical** -- At risk of becoming critical under slight changes. |
| **Large** | **Flexible** -- Task can be rescheduled within its slack window without affecting the deadline. |

### Results Table Columns

| Column | Source | Description |
|--------|--------|------------|
| **Duration** | Input data | The task's own duration |
| **Early Start (ES)** | Forward pass | Earliest this task can begin |
| **Early Finish (EF)** | Forward pass | Earliest this task can complete |
| **Late Start (LS)** | Backward pass | Latest this task can begin without delaying the project |
| **Late Finish (LF)** | Backward pass | Latest this task can complete without delaying the project |
| **Slack** | LS - ES | Scheduling flexibility |
| **Critical** | Slack = 0 | Whether this task is on the critical path |

### Gantt Visualisation

Each row includes a proportional bar showing the task's position in the project timeline:
- Bar left edge = ES, bar width = duration
- **Red**: Critical path task (slack = 0)
- **Orange**: Near-critical (slack < 5% of project duration)
- **Green**: Has slack

### Slack Distribution

A histogram showing how tasks are distributed across slack values -- useful for assessing overall schedule risk.

---

## Cost Analysis

### Cost Forward Pass

Same algorithm as time, but using cost values:

- **Source tasks**: Accumulated cost = node cost
- **Downstream tasks**: Accumulated cost = node cost + max(predecessor accumulated cost + edge cost)
- **Critical cost**: Maximum accumulated cost at any task

### Results Table Columns

| Column | Description |
|--------|------------|
| **Node Cost** | The task's own cost (input data) |
| **Accumulated Cost** | Total cost along the most expensive path to this task |
| **Budget Share** | Node cost as a percentage of total budget |
| **Cost Slack** | How much the cost could increase before this becomes the most expensive path |
| **Critical** | Whether this task is on the cost-critical path |

---

## Time vs Cost Comparison

When both time and cost analyses are available, the framework shows how the critical paths differ:

```
Time-critical path:  1 -> 3 -> 7 -> 11 -> 12 -> 16
Cost-critical path:  1 -> 3 -> 7 -> 11 -> 15 -> 16
Common nodes:        1, 3, 7, 11, 16
Divergence:          Node 12 (time) vs Node 15 (cost)
```

This reveals where time optimisation and cost optimisation conflict, helping inform resource allocation decisions.

---

## Generalised CPM

The underlying framework supports customisable combination and propagation functions:

| Standard CPM | Combination | Propagation | Use Case |
|-------------|-------------|-------------|----------|
| Time | max | additive | Longest path = project duration |
| Cost | max | additive | Most expensive path |
| Reliability | min | multiplicative | Least reliable path |
| Bottleneck | min | min | Weakest link analysis |

---

## Multi-Scenario Comparison

Upload multiple CPM scenarios (e.g. "Normal Schedule", "Delayed Dependencies") to compare:

- How the critical path shifts under different conditions
- Which tasks gain or lose slack
- Whether time-critical and cost-critical paths diverge differently per scenario

---

## Graceful Degradation

If backward pass data is not available from the backend (older server version):

| Field | Fallback |
|-------|----------|
| ES | Computed as EF - duration |
| LS, LF | Hidden (columns not shown) |
| Slack | Displayed as "Float to End" (critical_value - EF), not true CPM slack |
| Gantt bars | Still render correctly using ES/EF |

The UI automatically detects whether backward pass fields are present and adjusts the display.
