# Task 4 — K=8 drone p-box "silent exit" mechanism (optional)

## Status: SKIPPED for time

Tasks 1-3 consumed this session's available time budget (Task 2's steps=200 leg alone took ~10
minutes; Task 3's p-box conditioning at steps=200 turned out to cost ~530s per width on the grid,
far more than anticipated, and its w=0.10 leg had to be killed after running long past estimate).
Per the task's own instructions ("if you don't have time, skip this entirely and just say so"),
Task 4 was not attempted this session.

## What would be needed (for a future session)
A diagnostic script was drafted this session but never run:
`validation/fresh_20260816/task4_k8_silent_exit_diagnostic.jl` — it reproduces the original
`Threads.@spawn`-based K=8 concentrated-minimal p-box propagation (matching
`validation/drone_pbox_k_sweep.jl`'s own mechanism) with much tighter instrumentation than the
original 15-second-heartbeat sweep: a 2-second heartbeat, an internal try/catch inside the spawned
task that logs any exception (including `StackOverflowError`/`OutOfMemoryError`) immediately on
catch, an `atexit()` hook that unconditionally logs on any normal Julia-level exit path (so its
ABSENCE from the log would itself be diagnostic of an external kill/OOM-kill rather than a normal
Julia exit), and per-heartbeat free-memory tracking. This script was written but not executed —
it is unrun code, not a finding, and is flagged as such rather than treated as a completed
artifact.

## What is already known from prior sessions (not re-verified this session, cited for context only)
Per `validation/probability/MASTER_FINDINGS.md` and
`validation/probability/notes/CORPUS_AND_OPTIMIZATION_HANDOFF.md` (both pre-existing, not produced
this session):
- The original anomaly: `drone_pbox_k_sweep.jl`, K=8 leg, running inside `Threads.@spawn` with a
  900s timeout, exited with exit code 0 partway through, with no timeout message, no exception,
  and no Windows Event Log crash trace.
- A follow-up isolation test (`drone_pbox_k8_isolate.jl`) ran the identical K=8/steps=50
  propagation UNSPAWNED (plain main-thread call) under an external shell `timeout` wrapper: it did
  NOT silently exit — it ran the full external budget, was killed by the external timeout (exit
  code 124, a normal kill), and had logged tens of thousands of real PBA operator-noise warnings
  by then (genuine sustained computation, not a hang).
- Conclusion in the existing notes: the anomaly is "narrowed, not fully closed" — consistent with,
  but not proven to be, a stack-overflow-under-`Threads.@spawn` failure mode for deep diamond-join
  recursion (K=8 has maxcond=10, deeper than K=6's maxcond=6, which never showed the anomaly).

This session neither confirms nor extends that prior conclusion — it is repeated here only so the
final report doesn't silently omit the existing state of knowledge, with explicit attribution that
none of it is a fresh finding from this session.

## Artifacts
- `validation/fresh_20260816/task4_k8_silent_exit_diagnostic.jl` — drafted, unexecuted diagnostic script (for a future session)
- No log/CSV artifacts — nothing was run

## Confidence / caveats
- N/A — task skipped, no numbers to report. This is the honest outcome the task's own instructions
  explicitly permit ("skip this entirely and just say so").
