# Foundation handover — new front-end workspace, design system, and shared contracts

Read this document in full before touching any code. This is the **shared foundation** every
parallel track below depends on. It must be built and stable, and its contracts must be treated
as frozen, before any track-specific agent starts feature work — if two tracks each invent their
own button styling or their own shape for "what a network looks like once uploaded," the whole
point of parallelising is lost.

Read alongside this document, in this order, before writing anything:

1. `FRAMEWORK_SYNTHESIS.md` (this folder) — what the framework actually is and does, the model
   every page has to make legible to a user.
2. `FE_AUDIT.md` (this folder) — the current app's page-by-page and endpoint-by-endpoint state:
   what's broken, what's stale, what's fabricated, what's already correct and just needs a new
   skin. Every reuse/adapt/discard call in this document traces back to a specific finding there.

## Why this is being rebuilt, in one paragraph

The current app (`InfoPropFrmwrk\src\UI\inf-prop-ui\`) has four of eleven analysis endpoints
throwing 500s on first request (diamond identification calls retired functions), two more running
against a superseded module (CPM v1, not the validated v2), a whole page family
(`/capacity-analysis-v2`) modelling an interval/probability-box flow capability the algorithm does
not have, and a "System Profile" view that computes its own hardcoded recommendation scores that
exist nowhere in the Julia package. On top of that, the visual design (described as "Claude-like,
emoji-heavy, playground-ish") needs to become a clean, professional, Azure/Entra-style interface,
in both light and dark mode, partly because the thesis's own case-study chapter will use
screenshots of it. Between the amount of code that's actually broken and the amount that would be
rewritten anyway for the new design system, patching the existing app captures little of the
"fix it" benefit while keeping all of its accumulated cruft (dead files, no central API config,
hardcoded `localhost:8080` in eight separate places). A new Nx workspace, built once against a
frozen design system and a frozen data contract, is the better trade.

## Stack decisions (settled, do not relitigate per track)

- **Nx workspace, Angular.** Same monorepo tooling as before; this is a fresh workspace, not a
  fork of the old one. Use current stable Angular + Nx as of whenever this is actually built —
  because it's one Nx workspace, the version is set once for the whole monorepo, not chosen
  per-track, so no track agent needs to make this decision.
- **Fluent UI Web Components** (`@fluentui/web-components`, Fluent 2), not Angular Material and
  not a from-scratch component library. This is the genuine Azure/Entra design system, not an
  approximation of it, and it ships its own light/dark theming and its own icon set, both of which
  we use directly rather than reinventing.
- **Fluent's own design tokens are the design system.** Do not hand-roll a colour/spacing/type
  token set. Import Fluent 2's theme objects (`webLightTheme`, `webDarkTheme` from
  `@fluentui/tokens`) and apply them via `setTheme()`; the only customisation in scope is swapping
  the brand accent colour if a project-specific identity is wanted later, done by overriding the
  brand ramp, not by inventing parallel tokens.
- **Fluent System Icons** (`@fluentui/svg-icons` or the equivalent web-components icon package)
  replace every emoji and ad-hoc icon in the current app, with no exceptions.
- Fluent's components are custom elements, not Angular components. Every Angular component or
  module that uses them needs `CUSTOM_ELEMENTS_SCHEMA` in its schemas array. Register the design
  system once, in the shell app's bootstrap, via `provideFluentDesignSystem()` and the specific
  component registrations needed (button, card, data grid, tabs, dialog, etc.) — do this in one
  place in the shared foundation, not once per track.

## Nx workspace layout

This structure is what makes the parallel-track workflow actually safe: Nx module boundaries mean
one track's agent cannot accidentally import another track's internals, and each track has an
unambiguous set of files it owns.

```
apps/
  info-prop-ui/              # the shell: app bootstrap, routing table, Fluent design-system
                              # registration, theme (light/dark) toggle, top-level nav
libs/
  shared/ui/                 # composed components used by more than one track (page header,
                              # empty-state, loading state, error banner) — built ON Fluent's
                              # primitives, not a replacement for them
  shared/data-access/        # NetworkSessionService, upload flow, the /network-structure client
                              # — the "a network is loaded" state every track reads
  shared/api-client/         # typed request/response interfaces for every server endpoint (see
                              # contracts below), and the single ApiConfigService that replaces
                              # the eight hardcoded localhost:8080 strings the audit found
  feature/reliability/       # Track 1 owns this directory exclusively
  feature/flow/              # Track 2
  feature/schedule/          # Track 3
  feature/system-profile/    # Track 4
```

A track's agent reads and writes only inside its own `feature/*` lib plus its own route
registration in the shell, and reads (never writes) `shared/*`. If a track genuinely needs
something added to `shared/*`, that's a signal to flag back rather than add it unilaterally,
since it changes the contract every other track is building against.

## The network/session data contract (shared/data-access)

This layer is **not being redesigned** — the audit confirmed `/upload`, `/sessions`,
`/network-structure` are live, current, and already match the framework's own model (one upload
becomes the one network every later view reads). Port the existing request/response shapes
directly; the work here is re-skinning the upload flow in Fluent, not changing what it does.

## Per-toolkit API contracts (shared/api-client)

These are the shapes each `feature/*` track builds against, whether or not the corresponding
server-side fix has landed yet. A track agent building against these does not need to wait for the
server-fixes track; mock the response shape and swap the mock for the real call once the server
track confirms it's live.

- **Reliability** (`POST /probability-propagation`): once the diamond-identification fix lands
  (server-fixes track), the response carries per-node belief values typed as
  `number | IntervalData | PboxData` depending on the requested input value type — reliability is
  the one toolkit that spans all three. Diamond structures are keyed
  `Dict<number, DiamondsAtNode[]>` (an array per join, matching the current algorithm's factorised
  output, not the old one-per-join shape the current serialisers still assume).
- **Flow** (`POST /flow-analysis`): Float64 only. Do not add an interval/probability-box branch to
  this contract or the UI that consumes it — that capability does not exist in
  `CapacityAnalysisKit.jl`, and inventing it in the UI is exactly the `/capacity-analysis-v2`
  mistake this rebuild is meant to not repeat.
- **Schedule** (`POST /critical-path-analysis`, once rewired to `CriticalPathV2Module` by the
  server-fixes track): Float64 and Interval, not probability-box.
- **Diamond export / promotion** (new capability, no existing endpoint): exporting a selected
  diamond subgraph as a new, independent network does **not** need a new server endpoint. Serialise
  the diamond's subgraph to the same input format `/upload` already accepts, and feed it back
  through the existing upload flow. This is a client-side transformation in
  `feature/reliability/`, not a new contract — treat it that way rather than inventing a bespoke
  export/import endpoint pair.

## Cross-cutting fixes every track inherits for free by using shared/api-client

- One `ApiConfigService` for the base URL, replacing the eight separate hardcoded
  `http://localhost:8080` strings the audit found.
- No track adds its own base-URL constant. If a track's generated code has one, that's a bug to
  fix before merging, not a style preference.

## What each track is (brief; full detail is each track's own handover document)

1. **Reliability** — probability-propagation page, diamond drill-down, and the diamond-promotion
   feature (§ above). Blocked on the server-fixes track for live data; not blocked for UI work
   against the mocked contract.
2. **Flow** — the existing `/capacity-analysis` (v3 workbench) concept, re-skinned in Fluent;
   drop `/capacity-analysis-v2` and `/capacity-analysis-legacy` entirely rather than porting them.
3. **Schedule** — time-analysis and cost-analysis, rewired to the V2 contract above.
4. **System-Profile** — the cross-scenario comparison view, kept conceptually (it already matches
   the framework's own ambition), rebuilt without the client-side scoring heuristics the audit
   found, and with a real gated empty-state instead of a bare error string when no scenarios have
   been run yet.
5. **Server-fixes** (Julia side, not Angular) — the diamond-identification wiring, the
   `CriticalPathV2Module` wiring, and the `/docs` directory that doesn't exist. Fully independent
   of the four FE tracks; only its output contract (the shapes above) needs to match what they're
   building against.

## Boundaries

- Don't touch the old `src\UI\inf-prop-ui\` or `src\Network-flow-algos\front-end\inf-prop-ui\`
  trees. This is a new workspace; the old ones are reference material for what to port, not code
  to build on top of.
- Don't invent design tokens, icons, or a base-URL pattern outside what's specified here — that's
  exactly the fragmentation this foundation exists to prevent.
- Don't add capabilities the algorithm doesn't have (interval/p-box flow, p-box schedule,
  client-computed recommendations) even if they'd be easy to build. If a page needs a judgement
  call the package doesn't make, say so in the UI rather than inventing the judgement.
