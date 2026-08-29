# Track 2: Flow — capacity analysis

You own `libs/feature/flow/` and this track's route(s) in the shell app only. Read
`00_FOUNDATION_HANDOVER.md` in full first. Then `FRAMEWORK_SYNTHESIS.md` for the flow toolkit's
actual scope, and the `/capacity-analysis`, `/capacity-analysis-v2`, and
`/capacity-analysis-legacy` rows of `FE_AUDIT.md`.

## What you're building

One page (with sub-views) for flow/capacity analysis: maximum flow, bottlenecks, sensitivity,
scenarios, over a network's edge capacities. This is, by a clear margin, the least changed track
conceptually — the audit found the current "v3 workbench" already correct end to end.

## What to port versus rebuild, per the audit

- **`/capacity-analysis` (the v3 workbench: config, summary, bottlenecks, visualization,
  scenarios)** matches the framework's model and is correctly Float64-only throughout, live
  against the current server. Port the concept and the sub-page structure; this is a reskin in
  Fluent, not a redesign of what it does or how it's organised.
- **`/capacity-analysis-v2`** (11 sub-pages: overview, inputs, flows, paths, bottlenecks,
  uncertainty, upgrades, comparison, performance, visualization, export) models
  `interval`/`pbox`-shaped flow results and an "upgrade scenario" feature that calls two endpoints
  that don't exist on the server at all. **Do not port this.** The interval/p-box modelling is a
  capability the algorithm does not have (`parse_capacity_input_file` hard-rejects anything but
  `Float64`) — this is exactly the mistake the rebuild exists to not repeat. If any specific
  sub-page's *concept* (e.g. a comparison view, an export view) is worth having for the Float64
  case specifically, that's a legitimate feature to add to the v3-descended workbench — but build
  it against the real Float64-only contract, don't port v2's code or its data model.
- **`/capacity-analysis-legacy`** is an older single-page precursor the v3 workbench already
  supersedes. Don't port it.

## Data contract you build against

```
POST /flow-analysis   // current, live, correct — no server-fixes-track dependency for this one
data_type: "Float64"  // the only accepted value; do not add a selector for Interval or PBox here
```

This is the one track with no blocking dependency on the server-fixes track. You can build and
test against the real live endpoint from the start rather than a mock, since the audit confirmed
it works as documented.

## Design note specific to this track

Because flow is Float64-only while reliability spans all three value types, do not present a
shared "value type" selector control across every toolkit's shell chrome as if it always offers
the same three choices. If the shell has a common value-type control, this track's page should
either hide it or visibly grey out Interval/PBox with a plain explanation, not silently ignore a
selection made elsewhere. Matching what the algorithm actually supports, visibly, is part of the
point of this rebuild.

## Boundaries

- You do not touch `libs/feature/reliability`, `feature/schedule`, `feature/system-profile`, or
  anything under `shared/*` except by reading it.
- Don't add interval or probability-box handling anywhere in this track, even as a "future-proof"
  placeholder. If that changes, it changes the contract in `00_FOUNDATION_HANDOVER.md` first, and
  every track gets told, not just this one.

## Definition of done

- The v3 workbench's five sub-views work against the live, current `/flow-analysis` endpoint,
  reskinned in Fluent.
- `/capacity-analysis-v2` and `/capacity-analysis-legacy` are not present in the new app in any
  form.
- Zero emoji, zero ad-hoc colour, Fluent components and Fluent System Icons throughout.
