# Schedule (CPM)

The Schedule toolkit runs critical-path analysis over a network of activities and precedence edges. It needs a CPM inputs file for at least one scenario. Unlike Reliability and Flow, a CPM input file is genuinely generic over what it measures — the framework has no built-in notion of "time" or "cost" as special quantities.

## Time is mandatory, cost is optional — same file, two passes

A CPM inputs file always declares a `time_analysis` section (node durations + edge delays); it may also declare an optional `cost_analysis` section in the same file. These are two independent **passes** over the same network, not two scenarios — the **Cost** tab only appears when the loaded file actually has a `cost_analysis` section. If you want to analyse a third quantity entirely (say, risk exposure), it needs its own scenario folder — the file format itself only ever carries these two named slots.

## Modes

Both the time and the cost pass pick a **mode**, chosen at run time (an "Advanced — pass modes" control lets you override each independently), defaulting to whatever the file's own `combination_function`/`propagation_function` imply, or **LongestPath** if the file states neither:

| Mode | What it computes |
|---|---|
| **LongestPath** | The classical critical path — the longest chain through the network (max/+) |
| **ShortestPath** | The shortest complete chain (min/+) |
| **MaxScaling** | The best end-to-end multiplicative factor (max/×) — e.g. a chain of success probabilities or yield factors |
| **Accumulation** | The total reaching the target, summed over every route, with each activity's sensitivity and contribution to that total |

## The four tabs

- **Time** — the mandatory pass. Every activity's forward value, its best complete path, its margin against the project value, and (for the additive path modes) the classical schedule quantities: early start, late start, late finish, and slack (total float). The critical structure — the set of activities with zero slack — is called by the mode's own name (**Critical path** for LongestPath, **Optimal chain** for ShortestPath, **Best route** for MaxScaling) to avoid implying "critical path" for a mode that isn't computing one.
- **Cost** — the same, for the optional cost pass, when the file declares one.
- **Visualisation** — the network drawn by layer, with the critical (or possibly-critical) structure of either pass ringed on it.
- **Compare** — every scenario side by side, run the ones that haven't been run yet, chained.

## Deterministic vs. interval, honestly

Under deterministic durations, a node is either on the critical structure or it isn't. Under interval durations the framework distinguishes two honest categories rather than picking one number: **necessarily critical** (critical under every possible corner of the duration uncertainty — a certain finding) and **possibly critical** (critical under at least one corner — informative, but not certain). Exact interval enumeration is genuinely NP-hard on a reconvergent network, so on some real instances the framework falls back to a sound **conservative enclosure** rather than either refusing to answer or returning something unsound — and says so explicitly when it does, rather than presenting the fallback silently as if it were the exact answer.

## Accumulation is a different shape

Accumulation mode reports a different table entirely: each activity's accumulated total, how many distinct routes reach it (its **multiplicity**, numerically equal to its sensitivity), its share of the grand total (**contribution**), and — if you supplied a budget — its **allowance**, the remaining headroom against that budget divided by multiplicity. There is no "critical path" concept here; the questions Accumulation mode answers are about aggregate load and sensitivity, not slack.
