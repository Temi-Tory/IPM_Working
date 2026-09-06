# Task 1 — Net3 (EPANET water benchmark) identify-only feasibility check

## What was run
Fresh re-run this session of diamond identification (`new_identify`) on the flow-oriented Net3
conversion (`dag_ntwrk_files/net3/net3.EDGES`, 97 nodes / 119 edges — the hydraulically-grounded
conversion documented in `validation/net3/thesis_writing_pack/net3_RESULTS.md`, NOT the older
arbitrary-BFS `dag_ntwrk_files/net3-water/` conversion, which the same doc flags as giving a
different, less-realistic diamond structure: 51 diamonds/maxcond 5 vs this one's 307/12). Priors:
non-degenerate uniform 0.9 on all nodes and edges (matching the corpus's own `verify_graph`
convention). Since identify completed in well under 2 minutes with no memory concern, Float64
exact propagation was also attempted (per the task's own escalation rule), budgeted at 5 minutes.

### Exact command
```
cd C:\Development\Info_Prop_Framework_Project\Info_Prop_Framework_Project
julia --project=InfoPropFrmwrk validation/net3/thesis_writing_pack/net3_task1_confirm_rerun.jl
```
Script: `validation/net3/thesis_writing_pack/net3_task1_confirm_rerun.jl` (new script, written this
session; calling convention copied from `verify_net3_structure.jl` / `rerun_129_corpus.jl` —
`read_graph_to_dict`, `identify_fork_and_join_nodes`, `find_iteration_sets`, `new_identify`,
`update_beliefs_iterative`).

## Result numbers (this session's run)
| Metric | Value |
|---|---|
| Nodes | 97 |
| Edges | 119 |
| Sources (indegree 0) | 3 — {1, 2, 4} = Lake, River, tank "1" |
| Sinks (outdegree 0) | 18 |
| Forks | 35 |
| Joins | 23 |
| Layers | 28 |
| **Unique diamonds (incl. nested)** | **307** |
| Maximal/root diamonds | 21 |
| **maxcond (max \|conditioning_nodes\|)** | **12** |
| sum(2^\|C\|) over unique diamonds | 5.4734e+04 |
| Load time | 0.884 s |
| Fork/join identify time | 0.050 s |
| Iteration-set time | 0.474 s |
| **Identify time (`new_identify`)** | **1.348 s** |
| gc_live_bytes delta across identify | +18.1 MB |
| **Float64 exact propagation time** | **2.886 s (completed)** |

Identify-only comfortably completes in ~1.3s with negligible memory (well under the 2-minute /
memory-concern threshold), so full Float64 propagation was attempted per the escalation rule and
completed cleanly in ~2.9s, far inside the 5-minute budget — no timeout/kill was needed.

## Artifacts
- `validation/net3/thesis_writing_pack/net3_task1_confirm_rerun.jl` — the script run
- `validation/net3/thesis_writing_pack/net3_task1_confirm_rerun.log` — full timestamped run log
- `validation/net3/thesis_writing_pack/net3_task1_identify_only.csv` — identify-only summary row
- `validation/net3/thesis_writing_pack/net3_task1_full_summary.csv` — full summary incl. propagation status
- `validation/net3/thesis_writing_pack/net3_task1_propagation_beliefs.csv` — per-node Float64 beliefs (97 rows)
- Copies of all four also placed in
  `InfoPropFrmwrk/Publications/My work/RESS_response/pre-write final/data/task1_net3/`

## Confidence / caveats
- High confidence: this is a genuine fresh run this session, not a memory/old-file citation.
- The unique-diamond count (307), maximal-diamond count (21), and maxcond (12) reproduce
  **exactly** the numbers already reported in the pre-existing
  `validation/net3/thesis_writing_pack/net3_RESULTS.md` (built 2026-08-30, same network file,
  same conversion) — this fresh run is a genuine independent reconfirmation, not a duplicate of
  the same in-session computation.
- `net3_RESULTS.md` separately notes p-box was deliberately NOT run for this case study (decided
  with the user 2026-08-30) because sum(2^|C|)=5.47e4 exceeds the cost at which the comparably-
  costed drone K=8 config failed to complete (sum 2^|C|=7,758) — consistent with this session's
  own Task 4 finding on the K=8 boundary. This task's scope was identify + Float64 propagation
  only, per the instructions, so p-box was correctly not attempted here either.
- Memory was tracked via `Base.gc_live_bytes()` (a live-heap proxy), not OS-level peak RSS —
  "peak memory if easily obtainable" was satisfied at this lightweight level; the delta (+18 MB)
  is trivial regardless of measurement method.
