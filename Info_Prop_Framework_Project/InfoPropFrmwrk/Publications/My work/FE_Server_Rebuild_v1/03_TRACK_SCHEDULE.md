# Track 3: Schedule — critical path / time and cost analysis

You own `libs/feature/schedule/` and this track's route(s) in the shell app only. Read
`00_FOUNDATION_HANDOVER.md` in full first. Then `FRAMEWORK_SYNTHESIS.md` for the schedule
toolkit's scope, and the `/time-analysis`, `/cost-analysis`, and CPM rows of `FE_AUDIT.md`.

## What you're building

Two related views (or one view with two tabs, your call on presentation) for schedule analysis:
time (critical path, float/slack per activity) and cost, over an activity network with durations
and costs.

## What to port versus rebuild, per the audit

- **`TimeAnalysisComponent` and `CostAnalysisComponent`** are conceptually sound — they match the
  framework's model directly — but both currently call `/critical-path-analysis` /
  `/cpm-analysis`, which run against `CriticalPathModule` (v1), not `CriticalPathV2Module`. Per
  this project's own validation record, v1's interval and sum-slack outputs are the ones flagged
  as buggy and not to be trusted. Port the page concept and layout; rewire the data call.

## Data contract: unresolved, coordinate before building

Unlike Flow's contract, **the exact response shape of the V2-wired endpoint is not fully pinned
down in this document**, and it would be dishonest to invent one. What's confirmed:

- Schedule supports Float64 and Interval value types, **not** probability-box (verified: zero
  mentions of p-box anywhere in `CPM_Chapter_v1`'s own chapter text). Your value-type selector
  should offer exactly two options, not three.
- The target module is `CriticalPathV2Module`, described in `CPM_Chapter_v1` as a generalised
  critical path method with configurable operator combinations for scheduling and cost analysis.
- The current (v1) handler functions being called are `CriticalPathModule.critical_path_analysis`,
  `.backward_pass_analysis`, `.max_combination`, `.additive_propagation` — the v2 equivalents will
  likely have analogous but not necessarily identical names or response shapes.

**Before writing your data-access layer**, either: (a) check in with the server-fixes track (or
whoever has picked it up) for the confirmed v2 response shape once they've wired it, or (b) if
building ahead of that, read `CriticalPathV2Module.jl` and `CPM_Chapter_v1/Critical_Path_Chapter.tex`
yourself to derive the shape directly from the source rather than guessing from the v1 shape above.
Do not assume the v1 field names carry over unchanged — confirm them.

## Boundaries

- You do not touch `libs/feature/reliability`, `feature/flow`, `feature/system-profile`, or
  anything under `shared/*` except by reading it.
- Do not add a probability-box option to this track's value-type selector.
- Do not fix the server-side module wiring yourself if you're an FE-only track agent — that's the
  server-fixes track's job. If you're doing both (one agent covering schedule end to end), still
  keep the two changes (server wiring, FE rewiring) as clearly separable so the contract stays
  legible to whoever reviews it.

## Definition of done

- Time and cost analysis views render correctly against the confirmed (not assumed)
  `CriticalPathV2Module` response shape.
- The value-type selector offers Float64 and Interval only.
- Zero emoji, zero ad-hoc colour, Fluent components and Fluent System Icons throughout.
