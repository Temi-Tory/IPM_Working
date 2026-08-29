# Track 1: Reliability — probability propagation, diamond drill-down, diamond promotion

You own `libs/feature/reliability/` and this track's route(s) in the shell app only. Read
`00_FOUNDATION_HANDOVER.md` in full first — the Nx layout, Fluent setup, and API contract rules
there are not optional per-track choices. Then read `FRAMEWORK_SYNTHESIS.md` for how reliability
and decomposition actually relate (this matters more here than in any other track), and the
`/probability-propagation` and `/diamonds` rows of `FE_AUDIT.md` for what currently exists.

## What you're building

One page for reliability/reachability analysis (belief per node, given the network and its
component reliabilities), with diamond structure surfaced as part of that analysis, not as a
separate top-level destination, plus a new capability: promoting a specific diamond to its own
standalone network.

## What to port versus rebuild, per the audit

- **The core probability-propagation view** (currently `ExactInferenceComponent`) is conceptually
  sound: it already types belief values as `number | IntervalData | PboxData` and never flattens
  an interval or a p-box down to a point for display. Reskin this in Fluent; don't redesign the
  underlying data model.
- **The diamond page** (currently `/diamonds`, `DiamondAnalysisComponent`) is where the real
  change is. Its current framing — a nav-level peer of the other toolkits, titled "System-Wide DAG
  Infrastructure Analysis Dashboard," reachable with no reliability analysis run or requested —
  does not match the framework's own account of decomposition as a pre-processing step built for
  and consumed by reliability specifically. Do not keep it as an independent nav destination.
  Surface diamond structure as part of viewing reliability results on a given network: which join
  nodes have diamonds, and for each, the identification/drill-down detail the current page already
  has (the per-diamond dialog, source overrides). That capability is genuinely grounded in the
  framework's own self-similarity claim (a diamond is itself a valid sub-network) — keep it, just
  relocate its entry point.

## The diamond-promotion feature (new — this is the piece that doesn't exist yet)

Confirmed with the thesis author directly: a user should be able to take a specific identified
diamond and treat it as a brand-new, independent network — not just inspect it in place. Once
promoted, that new network is a first-class upload, and the user can run **any** of the three
toolkits against it (reliability again at finer grain, flow, or schedule), not only reliability.

Implementation, per the foundation doc's contract: this needs **no new server endpoint**.
1. From the diamond drill-down, offer "Analyse as new network" (or equivalent) on a selected
   diamond.
2. Serialise that diamond's subgraph (its nodes, edges, and their existing attributes) into the
   same input format `/upload` already accepts. Read the current upload parser
   (`shared/data-access`, ported from the existing `UploadHandlers.jl` contract) to match the
   format exactly rather than inventing a variant of it.
3. Feed the serialised subgraph through the existing upload flow, exactly as if the user had
   uploaded a file. The user lands in a new session with the diamond as its own network.
4. From there, the existing shell routing (upload → any toolkit) handles the rest; you are not
   building new analysis pages for the promoted network, you're making sure a diamond can enter
   the upload flow as data, not asking the user to save a file and re-upload it manually.

Get this working for the common case (a diamond with no external overrides) first; source overrides
(the existing dialog lets a user substitute a source node's value) are a real but secondary
refinement, don't block on them.

## Data contract you build against

```
Belief value: number | IntervalData | PboxData   // per node, keyed by node id
Diamond structures: Record<number, DiamondsAtNode[]>   // ARRAY per join — this is the current,
    // correct shape (a join can carry more than one independent diamond from different forks).
    // The server-fixes track is responsible for making the live endpoint actually return this
    // shape; until that's confirmed live, build and test against a mocked response in this shape,
    // not the old one-per-join shape the current (broken) serialisers still assume.
```

Reliability is the one toolkit that spans all three value types (Float64, Interval,
probability-box) — the value-type selector on this page should offer all three, unlike Flow or
Schedule.

## Boundaries

- You do not touch `libs/feature/flow`, `feature/schedule`, `feature/system-profile`, or anything
  under `shared/*` except by reading it.
- You do not fix the server-side diamond-identification bug (`AnalysisCommon.jl` calling retired
  functions) — that's the server-fixes track. Build and test against the mocked contract above;
  swap in the real call once that track confirms it's live.
- Don't add a capability the algorithm doesn't have. If a display choice isn't clear from the data
  the API returns, ask rather than inventing a client-side interpretation of it (this is exactly
  what went wrong with System-Profile's recommendation scoring in the old app — don't repeat it
  here).

## Definition of done

- Reliability results render correctly for all three value types against the mocked contract.
- Diamond structure is visible from within a reliability result, not from a separate nav entry.
- A diamond can be promoted to a new network and land the user in a working upload session for it.
- Zero emoji, zero ad-hoc colour, Fluent components and Fluent System Icons throughout.
