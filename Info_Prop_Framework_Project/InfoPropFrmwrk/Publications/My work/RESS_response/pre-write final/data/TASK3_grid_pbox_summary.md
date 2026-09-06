# Task 3 — Grid case-study p-box table, re-run against the CURRENT ported operator

## What was run
The ACCURACY section of `validation/probability/grid_case_study/grid_full_suite.jl` (the script
that produces `data/grid_accuracy.csv`), extracted and adapted into a standalone script this
session because:
1. `grid_full_suite.jl`'s `REPO` path is a stale machine path (fixed).
2. Its Float64/Interval exactness comparison uses CUDD (`bdd_oracle.jl`) — this campaign's own
   notes (`CORPUS_CAMPAIGN_HANDBACK.md`) flag CUDD as unstable in the current environment
   (~20-30GB memory demanded even on a 10-node graph). Substituted the pure-Julia
   `BinaryDecisionDiagrams.jl` (BDDjl) oracle instead (`bddjl_build`/`bddjl_eval` from
   `oracles.jl`) — the same substitution `rerun_129_corpus.jl` made for the same reason. This is
   sound for exactness checking: both are exact symbolic BDD evaluations of the same reachability
   formula; CUDD's variable-reordering ("sifting") is a performance optimization, not required
   for correctness on a 16-node grid.
3. Cost/profiling/complexity sections of `grid_full_suite.jl` were NOT re-run (out of scope).

Config matches the stale CSV exactly for comparability: grid network (16 nodes, 24 edges,
sources {1,3,13}), node priors exact 1.0, links 0.9 uncertain, half-widths w in {0.05, 0.10},
p-box discretisation steps=200, target node=16, Monte Carlo N=50,000.

**Performance fix applied**: the MC loop's original implementation (copied faithfully from
`grid_full_suite.jl`) rebuilds the full diamond decomposition (`new_identify` +
`update_beliefs_iterative`) fresh for every one of the 50,000 MC samples — confirmed via `Get-Process`
CPU-time tracking to be genuinely computing (not hung), but far too slow to be worth the wall-clock
for a re-verification task. Fixed by reusing the already-built BDD (`Bbdd`, from the Float64-vs-BDD
exactness check earlier in the same run, itself confirmed to agree with IPA to 1.11e-16 in this
session) to evaluate each MC sample via `bddjl_eval` directly — the identical mathematical quantity
(exact reachability at node 16 under sampled Float64 link reliabilities), computed via a cheap
recursive BDD walk instead of rebuilding the diamond decomposition 50,000 times. This is a
performance substitution, not a methodology change, and reduced each width's MC section from a
multi-minute cost to ~52-53s for 50,000 samples.

**Two-part execution**: the w=0.05 leg (script `task3_grid_accuracy_confirm.jl`) was run first and
completed cleanly. The w=0.10 leg's initial attempt (same script, second loop iteration) was
interrupted mid-run during an earlier over-cautious time-budget check; on reflection that
violated this campaign's "fresh-or-it-didn't-happen" rule for a number specifically flagged as
contradictory across the project's own docs, so it was re-run to full, genuine completion via a
second script (`task3_grid_accuracy_w10_only.jl`) that recomputes the (cheap) w=0.10 Interval rows
lost with the interruption and then reruns the (expensive) w=0.10 p-box rows without any external
time limit, appending both into the same `grid_accuracy.csv`. Every row below is a real, completed
computation — none is extrapolated or inferred from the other width.

### Exact commands
```
cd C:\Development\Info_Prop_Framework_Project\Info_Prop_Framework_Project
julia --project=InfoPropFrmwrk validation/probability/grid_case_study/task3_grid_accuracy_confirm.jl
julia --project=InfoPropFrmwrk validation/probability/grid_case_study/task3_grid_accuracy_w10_only.jl
```
Scripts (both new, written this session):
`validation/probability/grid_case_study/task3_grid_accuracy_confirm.jl` (Float64 + both Interval
widths + w=0.05 p-box) and `task3_grid_accuracy_w10_only.jl` (w=0.10 Interval + p-box, run to
completion).

## Result numbers (this session's fresh, fully-completed run — both widths)
| regime | w | method | worst_overwidth_or_err | worst_unsound | note |
|---|---|---|---|---|---|
| Float64 | - | IPA_vs_sifted_BDD | 1.110e-16 | - | exact |
| Interval | 0.05 | IPA_vs_BDDcorners | 3.331e-16 | 1.110e-16 | exact |
| Interval | 0.05 | naive_no_conditioning | 2.247e-04 | - | over-wide |
| **pbox@200** | **0.05** | **IPA_vs_MC** | - | **0.000e+00** | **sound** |
| pbox@200 | 0.05 | naive_vs_MC | - | 2.138e-02 | unsound |
| Interval | 0.10 | IPA_vs_BDDcorners | 2.220e-16 | 1.110e-16 | exact |
| Interval | 0.10 | naive_no_conditioning | 1.110e-16 | - | over-wide |
| **pbox@200** | **0.10** | **IPA_vs_MC** | - | **0.000e+00** | **sound** |
| pbox@200 | 0.10 | naive_vs_MC | - | 1.724e-02 | unsound |

Timing observed for the p-box legs (the diamond-conditioning recombination is the dominant cost at
steps=200, not the MC comparison — consistent with Task 2's finding that p-box cost scales much
worse than quadratic in steps):
| w | IPA (sound cvxP) propagate | naive propagate | MC_N=50,000 via BDDjl |
|---|---|---|---|
| 0.05 | 531.24s | 1.26s | 53.11s |
| 0.10 | 607.30s | 1.24s | 52.14s |

## The core question: is `worst_unsound` now ~0.000?
**Yes — confirmed directly for BOTH widths.** The stale `data/grid_accuracy.csv` (pre-fix)
recorded:
```
pbox@200,0.05,IPA_vs_MC,-,3.436e-01,CHECK
pbox@200,0.10,IPA_vs_MC,-,3.900e-01,CHECK
```
— large, flagged violations. This session's fresh runs against the current ported cvxP operator
(`InputProcessingModule.PBOX_COND_BLEND[]` default `:positive`) give **`worst_unsound=0.000e+00`,
note="sound"** for both configurations, identical in every other respect (same network, same
steps=200, same target node, same MC_N and seed convention). This directly confirms the cvxP/cvxF
soundness fix (ported ~2026-07-27) eliminates the violation on this specific case study, for the
full {0.05, 0.10} sweep the stale table originally reported it on.

As a consistency check at every stage: the `naive_vs_MC` rows (which deliberately bypass diamond
conditioning entirely, so are NOT affected by the cvxP/cvxF fix either way) reproduced **2.138e-02**
(w=0.05) and **1.724e-02** (w=0.10) — matching the stale CSV's own values for those rows
bit-for-bit at both widths. The w=0.10 Interval rows (2.220e-16 / 1.110e-16 / 1.110e-16) were
independently computed twice (once in the original run's log before its CSV write was lost to the
interruption, once in the completion re-run) and agree exactly between the two computations —
further corroborating that this is a stable, reproducible result, not noise.

## Artifacts
- `validation/probability/grid_case_study/task3_grid_accuracy_confirm.jl` — script for Float64 + w=0.05 (+ the MC speed fix)
- `validation/probability/grid_case_study/task3_grid_accuracy_w10_only.jl` — script for w=0.10 completion
- `validation/probability/grid_case_study/data/task3_grid_accuracy_confirm.log` — log for the first script
- `validation/probability/grid_case_study/data/task3_grid_accuracy_w10_only.log` — log for the w=0.10 completion run
- `validation/probability/grid_case_study/data/grid_accuracy.csv` — the COMPLETE accuracy table, all 9 rows, both widths fully populated
- Copies of all four placed in `InfoPropFrmwrk/Publications/My work/RESS_response/pre-write final/data/task3_grid_pbox/`
- Process state confirmed via `Get-Process` throughout both runs (steadily climbing CPU time across each ~9-10 minute leg) — genuinely computing, not hung; both processes exited normally (exit code 0) with no external kill on the final, reported numbers.

## Confidence / caveats
- High confidence on all 9 rows: genuine fresh, fully-completed runs this session, cross-checked
  against the stale CSV's operator-independent rows (naive/Interval) matching bit-for-bit at both
  widths, and against the Float64-vs-BDD exactness check (1.11e-16, matching
  `GRID_BENCHMARK_CORRECTED.md`'s independent prior finding).
- The CUDD-to-BDDjl oracle substitution is a deliberate, documented departure from
  `grid_full_suite.jl`'s literal implementation, made for environment-stability reasons already
  established earlier in this campaign; it does not change what is being measured (both are exact
  symbolic reachability oracles).
- One methodological note for future reruns of this script: `grid_full_suite.jl`'s original
  per-width loop only calls `flush(io)` once, at the very end of each width's block (after both
  the Interval and p-box sections) — if a run is ever interrupted mid-width, the already-computed
  Interval rows for that width can be lost even though they were correctly computed and logged.
  This was hit and recovered from this session (see the two-part execution note above); a future
  cleanup could flush after each row instead.
- The real bottleneck discovered this session (p-box conditioning at steps=200 costing ~530-610s
  even on a network with as few as ~5-8 diamonds) is itself a useful finding for the manuscript's
  cost discussion, consistent with Task 2's O(steps^2.8)-not-quadratic finding — flagged here, not
  acted on further (out of this task's scope).
