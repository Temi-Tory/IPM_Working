# Task 2 — p-box steps-scaling curve, bug fix + re-run

## The bug, precisely
`validation/timing_imprecise.jl`'s original problem: it built p-box inputs (via `PBA.uniform`)
ONCE per graph and only called `PBA.setSteps()` between legs. `PBA.uniform()` bakes the CURRENT
global step count into the returned p-box's discretization at construction time, so reusing
inputs built before a `setSteps` call meant every leg after the first silently kept measuring the
FIRST leg's resolution, not the resolution the column name claimed. (Note: `timing_imprecise.jl`
was already patched in-place for this in a prior session — its own header carries a "BUGFIX
(2026-08-17)" note and it now rebuilds inputs fresh after every `setSteps()` call — but that
script measures on `random_n20`/`random_n25`, not the 15-node reference network, and its own
steps-scaling curve section doesn't sweep the specific {25,50,100,200} combination this task
calls for.)

The script that actually FIRST produced the faithful 1.23/5.98/39.2/275.7s figures (steps
25/50/100/200 on `counterexample-n15`, the "15-node reference network") is
`validation/fresh_20260816/pbox_steps_probe.jl` — confirmed this session by grepping its own two
log files (`pbox_steps_probe.log`: steps=50 -> 5.98s, steps=200 -> 275.69s;
`pbox_steps_curve_25_100.log`: steps=25 -> 1.23s, steps=100 -> 39.16s). That script was already
correct (fresh `np`/`lp` built inside `run_steps(s)` for every steps value called, no reuse
bug) — it just ran as two separate half-sweeps across two different nights. Per the task's own
instruction to prefer reusing/adapting an existing correct script over re-deriving the fix from
scratch, this session's re-run adapts `pbox_steps_probe.jl` verbatim (same `tri_pbox` construction,
same `PBOX_COND_BLEND[]=:positive` setting, same network/seed) into ONE process covering all four
steps values in sequence.

## What was run
### Exact command
```
cd C:\Development\Info_Prop_Framework_Project\Info_Prop_Framework_Project
julia --project=InfoPropFrmwrk validation/probability/task2_pbox_steps_confirm.jl
```
Script (new, written this session): `validation/probability/task2_pbox_steps_confirm.jl`.
Network: `dag_ntwrk_files/counterexample-n15/counterexample-n15.EDGES` (15 nodes, 23 edges — the
"15-node reference network"). Each steps value run twice after a steps=20 warmup (JIT discard);
minimum of the two reported, matching the original probe's own convention.

Run in the background (~12.5 minutes wall-clock total for the whole sweep — over the single-call
budget window) and monitored to completion; the Julia process (PID 15816) was confirmed alive and
actively consuming CPU throughout via `Get-Process`, not hung.

## Result numbers (this session's fresh run)
| steps | run 1 | run 2 | min (reported) | prior faithful reference | ratio (new/old) |
|---|---|---|---|---|---|
| 25 | 1.75s | 1.36s | **1.36s** | 1.23s | 1.10x |
| 50 | 6.97s | 7.31s | **6.97s** | 5.98s | 1.17x |
| 100 | 45.75s | 47.40s | **45.75s** | 39.20s | 1.17x |
| 200 | 320.58s | 300.75s | **300.75s** | 275.70s | 1.09x |

## Interpretation
This is a genuine, honest **reconfirmation, not identical reproduction**: every steps value comes
in 9-17% higher than the prior faithful figures, consistently in the same direction (this session's
run is uniformly slower, never faster) — most plausibly ordinary machine/environment variance
(background load, thermal/frequency scaling, or a minor framework change since 2026-08-17) rather
than a methodological difference, since the same fixed script, network, and seed were used. The
shape of the curve is what matters for the paper's claim, and it reproduces cleanly: fitting the
super-linear growth confirms the prior finding that the true scaling is markedly worse than the
manuscript's/older notes' stated "quadratic in steps" — several other files in the repo
(`validation/certified_bound_threshold_sweep_steps200.jl`, `validation/rc_pbox_cvx.jl`,
`validation/probability/notes/PBOX_DILEMMA_SUMMARY.md`) still assert O(steps^2) or cite the stale
2.7/8.3/110s@{50,200,800} figures — this session's numbers, like the 2026-08-17 faithful
measurement, are inconsistent with a quadratic model and support the ~O(steps^2.8) characterization
instead (200/25 = 8x the steps, but ~221x the time; a pure quadratic would predict 64x).
steps=800 was deliberately NOT attempted, per the task's explicit instruction (documented
~4h extrapolated / impractical).

## Artifacts
- `validation/probability/task2_pbox_steps_confirm.jl` — the script run
- `validation/probability/task2_pbox_steps_confirm.log` — full timestamped run log
- `validation/probability/task2_pbox_steps_confirm_results.csv` — the timing table above
- Copies of both also placed in
  `InfoPropFrmwrk/Publications/My work/RESS_response/pre-write final/data/task2_pbox_steps/`

## Confidence / caveats
- High confidence this is a genuine fresh run this session (background PID confirmed alive and
  CPU-active throughout via `Get-Process`, not a stalled/dead process misread as running).
- The reported numbers are ~9-17% higher than the prior faithful reference, not bit-identical —
  reported plainly rather than forced into agreement, per the task's own instruction.
- This confirms the ORIGINAL bug diagnosis and fix approach are sound (inputs rebuilt fresh per
  steps value); it does not re-verify that the separately-already-patched `timing_imprecise.jl`
  itself now produces correct numbers on ITS OWN graphs (random_n20/random_n25) — that was out of
  this task's stated scope (the 15-node reference network specifically).
- Flag for the manuscript team (not actioned here, out of scope): the "quadratic in discretisation
  level" claim appears in at least 3 other files in the repo (see Interpretation above) and looks
  stale relative to both the 2026-08-17 finding and this session's reconfirmation.
