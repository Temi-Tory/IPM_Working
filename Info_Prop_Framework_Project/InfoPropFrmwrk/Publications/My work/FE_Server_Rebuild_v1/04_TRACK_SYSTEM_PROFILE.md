# Track 4: System Profile — cross-scenario comparison

You own `libs/feature/system-profile/` and this track's route(s) in the shell app only. Read
`00_FOUNDATION_HANDOVER.md` in full first. Then `FRAMEWORK_SYNTHESIS.md`, and §6 of `FE_AUDIT.md`
specifically (the System Profile section) — read that section in full before starting, it's the
most detailed write-up in the audit and this whole track is built from it.

## What you're building

A view that compares scenarios already run on a network — it does not run any analysis itself,
it reads and juxtaposes results the user already produced via the Reliability, Flow, and Schedule
tracks. This matches the Front-End thesis chapter's own stated ambition (setting scenarios of one
network side by side without exporting to a spreadsheet) — the concept is sound. Two specific
things are wrong with the current implementation, both need fixing, neither means rebuilding the
concept from zero.

## Problem 1: no visible gate

The current page's own service (`SystemProfileService.generateSystemProfile`) is explicit in its
own doc-comment that it never makes its own analysis calls — it reads whatever is already cached
from scenarios run elsewhere in the session. If nothing has been run yet, the current page's only
content is a bare error string: "No analysis results available. Run analyses first, then return
here."

Fix: build a real empty-state, not an error. If no scenarios are cached, the page should say
plainly what this view is for, and link or point the user to the Reliability, Flow, or Schedule
views to go produce something to compare. The dependency (this view reads other views' results,
it doesn't create its own) should be obvious from the page itself, not discovered by hitting a
dead end.

## Problem 2: fabricated judgements

The current page computes engineering recommendations and scores that exist nowhere in the Julia
package:

- `buildCapacityRecommendation`: a hand-written if/else ladder over hardcoded thresholds (e.g.
  utilization over 90% and upgrade-pressure at or above 3 triggers a specific recommendation
  string).
- `capacityOptimizations`: a client-computed weighted score
  (`utilization/100 * 0.35 + efficiencyLoss * 0.3 + ...`) with weights invented in the FE, not
  produced by `CapacityAnalysisKit.jl` or any other module.

Both violate the framework's own delivery commitment: the interface is a window onto validated
computation, not a second, unvalidated implementation layered on top of it. **Remove both.** If a
cross-scenario summary genuinely needs some form of ranking or flagging, it has to be computed by
the actual Julia package and exposed through a real endpoint, not invented at the UI layer. That's
out of scope for this track to build (it would need a new analysis capability, which is a
different kind of change than a front-end rebuild) — for now, present the raw comparison data
plainly and let the user draw their own conclusion, rather than presenting an invented
conclusion as if it were a validated one.

## What to keep

- **The metrics heatmap concept** (`MetricsHeatmapComponent`): a comparison across every cached
  scenario. This is genuinely just displaying already-computed numbers side by side — keep it.
- **The "Network Lens" concept** (`NetworkLensComponent`): re-rendering the network graph with
  nodes/edges highlighted by a selected analysis's output (capacity bottlenecks, CPM critical
  nodes, low-belief reachability nodes, diamond conditioning nodes). This is a legitimate
  visualisation of results that already exist, not an invented judgement — keep it, reskinned.
- **Hotspot alerts**, if and only if what counts as a "hotspot" is a value or threshold the
  underlying analysis itself already flags (e.g. the algorithm's own output marks a node as a
  bottleneck), not a client-invented threshold. Check this per alert type before porting it; some
  may fall under Problem 2 above even if they don't look like a "recommendation" on the surface.

## Data contract you build against

This track has no server endpoint of its own beyond the existing `/network-structure` call for
basic network facts. Everything else comes from `shared/data-access`'s cached scenario state —
whatever Reliability, Flow, and Schedule have written there from their own live or mocked runs.
Coordinate with those tracks on the exact shape of what gets cached (this is likely worth a short
addition to `00_FOUNDATION_HANDOVER.md`'s data contract once the other three tracks have settled
their own response shapes — flag this back rather than assuming a shape).

## Boundaries

- You do not touch `libs/feature/reliability`, `feature/flow`, `feature/schedule`, or anything
  under `shared/*` except by reading it.
- Do not add any new client-side scoring, ranking, or recommendation logic, even a simplified
  version of what's being removed. That's the exact mistake being corrected.

## Definition of done

- A real empty-state exists and is reachable/understandable before any scenario has been run.
- `buildCapacityRecommendation` and `capacityOptimizations` (and anything with the same shape) do
  not exist anywhere in this track's code.
- The heatmap and network-lens views work against real cached scenario data.
- Zero emoji, zero ad-hoc colour, Fluent components and Fluent System Icons throughout.
