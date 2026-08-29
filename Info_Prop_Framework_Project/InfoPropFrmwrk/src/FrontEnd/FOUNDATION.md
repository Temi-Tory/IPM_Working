# Foundation — built and frozen

New Nx workspace for the Information Propagation Framework front end. Built by the
foundation pass; **the contracts below are frozen** — track agents read `shared/*`
and write only inside their own `libs/feature/*` lib plus their route registration
in `apps/info-prop-ui/src/app/app.routes.ts`.

## STATUS — rebuild complete (2026-08-29)

All 5 tracks landed + terminology passes against each toolkit's thesis chapter.
`nx run-many -t build lint test` → **8/8 projects green** (~90 tests, 2 lint
warnings, 0 errors). Live end-to-end smoke test against the Julia server
(KarlNetwork): `/upload`, `/network-structure`, `/probability-propagation`
(Float64 + Interval), `/flow-analysis` (max-flow 45 = validated), CPM V2
(project_value 53.5 = validated), `/diamond-analysis` (18 maximal / 145 unique,
array-per-join confirmed), `/diamond-subgraph-analysis` — all working, and the
built FE serves.

**Known limitation (pre-existing, not the rebuild): p-box propagation is
intractable on diamond-heavy networks.** KarlNetwork (18 maximal diamonds) ran
17 min CPU without finishing and blocked the single-threaded server. p-box
conditioning explodes with diamond count. Float64 / Interval return in ms. The
reliability page offers p-box (the toolkit supports it), but expect it to hang on
anything but small / low-reconvergence networks — a server-side timeout guard
and/or a "this may take a long time" warning on the p-box path would help.

Full background: `../Publications/My work/FE_Server_Rebuild_v1/` —
`FRAMEWORK_SYNTHESIS.md`, `FE_AUDIT.md`, `00_FOUNDATION_HANDOVER.md`, then your
track's `0N_TRACK_*.md`.

## Environment gotchas (read before running anything)

1. **`NX_WORKSPACE_ROOT_PATH` is set in the shell profile** to an *old, abandoned*
   FE tree. Every `nx` command must run with it unset:
   `unset NX_WORKSPACE_ROOT_PATH && npx nx ...` (bash) — otherwise nx operates on
   the wrong workspace and reports phantom projects.
2. **`nx serve` is unstable in this OneDrive path.** `nx build`, `nx test`,
   `nx lint` all work. The dev server compiles and binds its port, then esbuild's
   persistent watch service dies with `spawn ... esbuild.exe ENOENT` (OneDrive
   filesystem-filter interaction on a deep path with spaces). Workaround pending a
   user decision (exclude `node_modules` from OneDrive / Defender, or relocate the
   workspace). Do your work against `nx build` + `nx test`; don't block on serve.

## Stack

- Nx 23.1.1, Angular 22.0.6, standalone components, signals, `@angular/build`
  (esbuild) app builder, `vitest` (`vitest-angular`) tests, `ng-packagr` buildable
  libs. Node 22.16 (one patch below Angular 22's stated floor — builds fine).
- **Fluent 2 Web Components** `@fluentui/web-components@3.1.3` +
  `@fluentui/tokens@1.0.0-alpha.24` (+ `@microsoft/fast-element`,
  `@microsoft/focusgroup-polyfill` peers). NOTE: v3 API, not the v2
  `provideFluentDesignSystem()` the handover doc described.
  - Components registered once in `libs/shared/ui/src/lib/fluent/register-fluent.ts`
    (all ~40 `define.js`), loaded lazily by `provideFluent()` at bootstrap.
  - **v3 has no `card` / `data-grid` / `table` component.** Use `<ipf-card>` (in
    shared/ui), a native `<table>` styled with Fluent tokens, or `<fluent-tree>`.
  - Any Angular component using a `<fluent-*>` tag needs
    `CUSTOM_ELEMENTS_SCHEMA` in its `schemas: []`.
  - Theme: `ThemeService` (`@inf-prop/shared/ui`) — light / dark / system, applies
    the real Fluent token set via `setTheme()`, mirrors `<html data-theme>`.
  - Icons: `<ipf-icon name="…" [size]="20">` + `IconName` union. ~48 curated
    Fluent System Icons in `icon-registry.ts`. Add glyphs there, never emoji.

## Nx layout & module boundaries (enforced by lint)

```
apps/info-prop-ui/            scope:app        type:app
libs/shared/api-client/       scope:shared     type:api-client   @inf-prop/shared/api-client
libs/shared/data-access/      scope:shared     type:data-access  @inf-prop/shared/data-access
libs/shared/ui/               scope:shared     type:ui           @inf-prop/shared/ui
libs/feature/reliability/     scope:reliability type:feature     @inf-prop/feature/reliability
libs/feature/flow/            scope:flow        type:feature     @inf-prop/feature/flow
libs/feature/schedule/        scope:schedule    type:feature     @inf-prop/feature/schedule
libs/feature/system-profile/  scope:system-profile type:feature  @inf-prop/feature/system-profile
```

`@nx/enforce-module-boundaries` forbids: feature → feature, feature → app,
ui → data-access, anything → api-client's non-deps. A feature reads shared only.

## `@inf-prop/shared/api-client` — endpoint contracts (FROZEN)

- `ApiClient` — the one HTTP surface. `get/post/put/delete/postForm`, base URL from
  `API_CONFIG` (one token; `provideApiConfig({baseUrl})` to override). Normalises
  errors to `ApiRequestError` (`.message` is user-facing).
- **Value forms** (`value-types.ts`): `IntervalData` `{type:'interval',lower,upper}`,
  `PboxData` `{type:'pbox',mean_lower,mean_upper,var_lower,var_upper,shape,name,
  bounded,discretization_size,bounds_summary}`, `BeliefValue = number | IntervalData
  | PboxData`. `TOOLKIT_VALUE_TYPES`: reliability=all 3, flow=[float64],
  schedule=[float64,interval]. **Never midpoint / flatten** — use `ipf-value`.
- `models/upload.ts`, `models/sessions.ts`, `models/network-structure.ts` — live,
  current, ported as-is.
- `models/diamonds.ts` — **array per join** (`Record<number, DiamondsAtNode[]>`);
  server track confirmed `new_identify` returns this and the live endpoints now
  serialise it. **Terminology:** the wire fields keep legacy names
  (`raw_root_diamonds`, `is_root_diamond`, `conditioning_nodes`) but the UI must
  render the Diamond chapter's vocabulary — "**maximal diamond**" (not "root
  diamond"), "**unique diamond**", "**fixed nodes**" (not "conditioning nodes").
  Read `Publications/My work/Diamond_Chapter_v2/Diamond_Decomposition_Chapter.tex`.
  Every maximal diamond is in `raw_unique_diamonds` with `is_root_diamond:true`
  and a hash key — work off that directly, don't match root→unique by node lists.
- `models/reliability.ts` — `/probability-propagation`. Live (track 05 fixed the
  500). Beliefs keep their form. Response carries a top-level optional
  `value_type: "Float64" | "Interval" | "pbox"` — authoritative run value form
  (fall back to inferring from belief values when absent).
- `models/flow.ts` — `/flow-analysis`. Live, current, Float64 only. Full
  `CapacityResult` shape typed from `serialize_capacity_result`.
- `models/schedule.ts` — `/critical-path-analysis`. **CONFIRMED** `CriticalPathV2`
  shape (`CriticalPathResponse` / `CriticalPathResult` / `SchedulePassResult`
  union: float path / interval path / accumulation). Modes: longest_path,
  shortest_path, max_scaling, accumulation.

## `@inf-prop/shared/data-access` (FROZEN)

- `NetworkSessionService` — `/sessions*` (list/open/update/delete + signals).
- `UploadService` — `/upload` (multipart; also the entry point for diamond
  promotion — serialise a subgraph to `File`s in the same format and call `upload`).
- `NetworkStructureService` — `/network-structure`.
- `NetworkContextService` — **"a network is loaded"**: `context`, `structure`,
  `inputs`, `unlockedToolkits`, `isLoaded`, `loadStructure()`, plus
  `scenarios` (signal) and `scenariosFor(kind)` — the loaded network's scenario
  structure. Every feature reads this.
- `ScenarioCacheService` — **the cross-scenario cache (frozen contract for Track 4)**.
  Tracks 1/2/3 call `record(run: ScenarioRun)` after each successful analysis
  (`metrics` = labelled real outputs, never invented scores; `raw` = untouched
  envelope; optional `overlays` for the Network Lens). Track 4 reads `runs()`.
  `ScenarioRun.scenarioName` is the scenario folder name.
- `file-convention.ts` — **scenario-aware** (updated 2026-08-29). A `Scenario`
  is a named folder (a value-form keyword OR an operating case like
  `"Edge Bottleneck Demo"` / `"Degraded"`) carrying any subset of the analysis
  inputs. `classifyFiles(File[])` / `classifyPaths(networkName, string[])` →
  `ClassifiedUpload { networkName, edges, scenarios: Scenario[], unknown }`.
  Each `Scenario` has `analyses: ScenarioAnalysis[]` — `{ kind, valueType,
  complete, paths: {nodepriors?, linkprobs?, capacities?, cpm?}, files }` where
  `paths` are **network-relative, ready for the server request fields**.
  `scenariosFor(upload, kind)`, `availableInputsFrom`, `detectAvailableInputs`,
  `enrichValueTypes` / `enrichValueTypesWith` (async — reads `data_type` from
  non-keyword folders), `isStandardFolder`. **A track picks a scenario, then
  sends `analysis.paths.*` as `nodepriorsPath` / `capacitiesPath` / `cpmPath`.**
  `analysis.valueType` is a best-effort pre-selection hint; the authoritative
  value type is the `value_type` field the analysis response returns.
  `NetworkContextService.enrichScenarioValueTypes()` (called by the upload and
  home pages after `setUploadFromPaths`) resolves operating-case folders like
  `"Interval Conservative"` via `GET /files/`.
- `NetworkFilesService` — `read(networkPath, networkRelativePath)` →
  `GET /files/…`, one JSON file from an uploaded network folder.

## `@inf-prop/shared/ui` (FROZEN)

`provideFluent()`, `ThemeService`, `IconComponent`/`IconName`, `CardComponent`,
`PageHeaderComponent`, `EmptyStateComponent`, `LoadingStateComponent`,
`ErrorBannerComponent`, `StatTileComponent`, `ValueDisplayComponent` (`ipf-value` —
renders number/interval/pbox honestly), `ValueTypeSelectorComponent`
(`ipf-value-type-selector` — toolkit-aware options, shows disallowed types
disabled with a reason), `formatValueForm` & friends.

## Shell (`apps/info-prop-ui`)

- Routes: `/home`, `/upload`, `/network` (foundation-owned pages), then
  `/reliability`, `/flow`, `/schedule`, `/system-profile` → `loadChildren` into the
  feature libs. `networkLoadedGuard` redirects to `/upload` when no network.
- Nav rail disables (never hides) toolkit links until a network + the right inputs
  exist. Guided but not gated.
- Feature libs currently render a placeholder page (`ipf-page-header` +
  `ipf-empty-state`). Replace it with your track's real views; keep the lib's
  `lib.routes.ts` export name (`feature<Name>Routes`).

## If you need something added to `shared/*`

Flag it back rather than adding it — it changes the contract every other track
builds against. `ScenarioCacheService` and the value-form primitives are the two
most load-bearing pieces; treat changes to them as breaking.
