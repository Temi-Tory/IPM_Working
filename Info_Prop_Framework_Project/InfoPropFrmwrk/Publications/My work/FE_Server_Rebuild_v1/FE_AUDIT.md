# Front-End / Server Audit

Checked against `FRAMEWORK_SYNTHESIS.md` in this folder. All claims below were checked at the
code itself (file + function named in each row); nothing is inferred from a route name, a
component name, or a comment alone unless explicitly flagged as such.

## 0. Which front end is current, and how that was determined

Two `inf-prop-ui` folders exist:

- `InfoPropFrmwrk\src\UI\inf-prop-ui\`
- `src\Network-flow-algos\front-end\inf-prop-ui\`

**`InfoPropFrmwrk\src\UI\inf-prop-ui\` is current.** Evidence, all directly checked:

1. **`Publications\My work\UI_Chapter_v2\INTEGRATION_NOTES.md`** (dated 2026-08-19, i.e. ten
   days before this audit) states outright: item 10 of its rebuild checklist calls
   `src\Network-flow-algos\front-end\inf-prop-ui\` a "duplicate stale tree to remove," and its
   verification table cites `src/UI/inf-prop-ui/` throughout as the codebase the chapter's
   claims were checked against.
2. **Git history** confirms the direction of travel independently of that note. The
   `src\Network-flow-algos\front-end\inf-prop-ui` tree has 83 commits running 2025-08-24 to
   2026-03-10, then stops. The `InfoPropFrmwrk\src\UI\inf-prop-ui` tree starts 2026-04-19 — five
   weeks *after* the other tree went quiet — with a commit literally titled "ui connected to new
   be" (new backend), and continues to 2026-06-21. Development moved to the new path and the old
   one was abandoned, it was not the other way round.
3. `package.json` is byte-identical between the two (same Angular 20.1/Nx 21.4 toolchain), so the
   move was a copy-then-diverge, not a rewrite from scratch — consistent with a relocation during
   the repo's move into `InfoPropFrmwrk\`.
4. A third, smaller duplicate was also found and ruled out: `.\apps\info-prop-ui\` at the repo
   root is a near-empty orphan (one tracked file, `git ls-files apps | wc -l` = 1), also named for
   removal in the same INTEGRATION_NOTES checklist item.

All of Part 2 below audits `InfoPropFrmwrk\src\UI\inf-prop-ui\apps\info-prop-ui\src\app\`
exclusively.

## 0b. Where the server lives

`InfoPropFrmwrk\src\Server\`. Entry point `server.jl`, started via `start_server.jl`
(`InfoPropServer.start_server()`, no arguments). Julia/HTTP.jl based, one file per concern:
`Core\Common.jl` (shared helpers: session storage, path resolution), `Handlers\*.jl` (one file
per analysis class), `API_CONTRACT_OPENAPI.yaml` (OpenAPI 3.0.3, declared version 2.0.0). This
matches the Front-End chapter's description of a documented, contract-first local service. The
repo-root `API_DOCUMENTATION.md` (a much older document, port 8000, inline schemas, no OpenAPI)
describes a retired, different server and should not be used as a reference for the current one.

One divergence from the chapter's "bound to the local machine" commitment, checked directly:
`start_server(host::AbstractString="0.0.0.0", port::Integer=ServerCommon.PORT)` in `server.jl`,
called with no arguments from `start_server.jl`, so the server listens on `0.0.0.0` (all network
interfaces) by default, not `127.0.0.1`/loopback only. Combined with
`"Access-Control-Allow-Origin" => "*"` in `handle_cors`, the server as configured is reachable
from other machines on the same network and from any origin's browser script, not only from the
local browser tab the design describes. This is a configuration gap against the stated contract,
not a fabricated capability — the analyses themselves are unaffected.

## 1. Endpoint inventory (server side, from `server.jl` + each `Handlers/*.jl`, read in full)

| Method/Path | Handler function | Julia call(s), read directly | Status |
|---|---|---|---|
| GET `/health` | inline in `server.jl` | — | live |
| POST `/upload` | `UploadHandlers.handle_upload` | multipart parse, writes `temp_uploads/<uuid>/session.json` | live |
| GET/PUT/DELETE `/sessions`, `/sessions/*` | `UploadHandlers.handle_sessions_list` / `handle_session_item` | reads/writes the session JSON file, `rm -r` on delete | live |
| GET `/files/*` | `UploadHandlers.handle_file_request` | serves a JSON file from inside a network folder | live |
| GET `/docs-list`, `/docs/*` | `DocsHandlers.handle_docs_list` / `handle_docs_request` | lists/reads `.md` files under `src/Server/docs` | **broken** — that directory does not exist on disk (`ls` confirms), so `/docs-list` always returns `{"files":[]}` and `/docs/*` always 404s |
| POST `/network-structure` | `StructureHandlers.handle_network_structure` | `read_graph_to_dict`, `identify_fork_and_join_nodes`, `find_iteration_sets` (InputProcessing/GraphTraversal, current) | live |
| POST `/diamond-analysis` | `DiamondHandlers.handle_diamond_analysis` | → `AnalysisCommon.find_or_build_diamond` | **broken**, see §2 |
| POST `/diamond-subgraph-analysis` | `DiamondHandlers.handle_diamond_subgraph_analysis` | → `find_or_build_diamond`, then (per requested `analyses`) `update_beliefs_iterative`, `CapacityHandlers.analyze_all`, `CriticalPathModule.critical_path_analysis` | **broken**, see §2 |
| POST `/probability-propagation` | `ProbabilityHandlers.handle_probability_propagation` | → `find_or_build_diamond`, then `update_beliefs_iterative` | **broken**, see §2 |
| POST `/reachability-analysis` | `ProbabilityHandlers.handle_reachability_analysis` | identical body to `/probability-propagation` (same function, different label) | **broken**, see §2 |
| POST `/flow-analysis`, `/capacity-analysis` | `CapacityHandlers.handle_capacity_analysis` (both routes, same handler) | `parse_capacity_input_file` (hard-rejects non-Float64 `data_type`), `analyze_all` in `FlowCapacity/CapacityAnalysisKit.jl` | live, current |
| POST `/critical-path-analysis`, `/cpm-analysis` | `CriticalPathHandlers.handle_critical_path_analysis` / `handle_cpm_analysis` (the latter just relabels the former's response) | `CriticalPathModule.critical_path_analysis`, `.backward_pass_analysis`, `.max_combination`, `.additive_propagation` | **live but stale** — this is `CriticalPathModule` (V1), not `CriticalPathV2Module`, see §2 |

Endpoints the front end calls that **do not exist on the server at all** (not in `server.jl`'s
`register_routes!`, not in the OpenAPI file):

| FE call | Called from | Server reality |
|---|---|---|
| POST `/analyze` | `network-backend.service.ts` (`analyzeNetwork`, `validateNetworkStructure`, `quickStructureAnalysis`) | no such route anywhere in `server.jl`. Traced every caller: `AnalysisStateService.quickStructureAnalysis` (line 462) is the only caller of this service, and nothing in any page component calls that method — so this dead endpoint is currently unreachable from the UI, not merely broken when reached. |
| POST `/capacity-analysis/upgrade-scenario` | `capacity-upgrade.service.ts` | no such route; server only registers the literal path `/capacity-analysis` |
| POST `/capacity-analysis/validate-upgrades` | `capacity-upgrade.service.ts` | same |

## 2. The diamond-identification break, verified independently at the source

`AnalysisCommon.jl` (`find_or_build_diamond`, called by every diamond/probability endpoint)
calls, at lines 315 and 327:

```julia
root_diamonds = identify_and_group_diamonds(join_nodes, incoming_index, ancestors, descendants,
    source_nodes, fork_nodes, edgelist, node_priors, iteration_sets)
unique_diamonds = build_unique_diamond_storage_depth_first_parallel(root_diamonds, node_priors,
    ancestors, descendants, iteration_sets)
```

Checked directly against `InfoPropFrmwrk\src\Algorithms\DiamondDecomposition\DiamondDecompositionModule.jl`:
its own export list and comment read, verbatim:

```julia
export new_identify   # correct-by-construction identification (factorized); the ONLY producer now.
# RETIRED (buggy hybrid-reuse + completeness loop): identify_and_group_diamonds,
# build_unique_diamond_storage[_depth_first_parallel] from Pipeline*.jl. Replaced by new_identify,
```

and its `include()` list loads only `TypesAndCache.jl`, `UtilityFunctions.jl`, `NewIdentify.jl` —
**not** `Internal/Pipeline.jl` or `Internal/Pipeline_Rewrite.jl`, which is where
`identify_and_group_diamonds` and `build_unique_diamond_storage_depth_first_parallel` actually
live (confirmed by `grep` — those two function definitions exist only in those two Pipeline
files). `InfoPropFramework.jl` in turn includes only `DiamondDecompositionModule.jl`. So the
functions `AnalysisCommon.jl` calls are not loaded into the running server at all: the first
request to any of `/diamond-analysis`, `/diamond-subgraph-analysis`, `/probability-propagation`,
or `/reachability-analysis` throws `UndefVarError` inside `find_or_build_diamond`, caught only by
the generic `error_response` handler and returned as a 500. **This is not a hypothetical read of
old notes — it was independently re-derived here from the module's own current source and its own
`include()` list.**

A second, independent problem sits behind the first even if item 1 were patched to call
`new_identify`: `AnalysisCommon.serialize_root_diamonds(root_diamonds::Dict{Int64, DiamondsAtNode})`
and `serialize_unique_diamonds` type their `sub_diamond_structures` entries as one `DiamondsAtNode`
per join. Checked directly against the **current** producer's consumer,
`InfoPropFrmwrk\src\Algorithms\ProbabilityPropagation\Internal\CorePropagation.jl`,
`update_beliefs_iterative`'s own signature types its `diamond_structures` argument as
`Dict{Int64, Vector{DiamondsAtNode}}` — a *vector* per join, i.e. one join can now carry more than
one independent diamond (matching the Diamond chapter's own account of a factorised join, §3.2 of
`Diamond_Decomposition_Chapter.tex`, where join 7 carries two separate diamonds from two
different forks). The server's serialisers and the `/diamond-subgraph-analysis` handler's calls
into `update_beliefs_iterative` (passing `diamond_data.sub_diamond_structures` straight through)
are written to the old singular shape and would still be wrong on the new one.

**Net effect:** four of the eleven live analysis endpoints (diamond analysis, diamond-subgraph
analysis, and both probability-propagation aliases) are currently non-functional against the
present algorithm code, confirmed by reading the calling and called code side by side rather than
by running the server.

## 3. CPM: which module is actually wired

`InfoPropFrmwrk\src\Algorithms\InfoPropFramework.jl` line 15 includes
`CriticalPath\CriticalPathModule.jl` only. `CriticalPathV2\CriticalPathV2Module.jl` exists as its
own directory/module but is not `include`d anywhere in `InfoPropFramework.jl` and is therefore
not loaded by the server at all. `CriticalPathHandlers.jl`'s `/critical-path-analysis` and
`/cpm-analysis` (and `DiamondHandlers.jl`'s CPM branch of `/diamond-subgraph-analysis`) call
`CriticalPathModule.max_combination`, `critical_path_analysis`, `backward_pass_analysis` — the V1
names, read directly from the `using` statements and call sites, not inferred. Per this project's
own CPM validation memory, the V1 module's interval/sum-slack outputs are the ones flagged as
buggy and not to be cited; `CriticalPathV2Module` is the validated rebuild described in
`CPM_Chapter_v1`. So `/critical-path-analysis` and `/cpm-analysis` run without throwing (unlike
§2), but return results from the superseded module. The `time-analysis` and `cost-analysis` pages
that call this endpoint are affected identically.

## 4. Page/route inventory (from `app.routes.ts`, read in full)

19 distinct views (14 top-level routes, one of which — `capacity-analysis` — has 5 child
routes; `exact-inference` is a redirect, not a view).

| Route | Component | Calls (service → endpoint) | Concept: unified model or siloed? | Reuse read |
|---|---|---|---|---|
| `/home` | `HomeComponent` | `NetworkSessionService`, `FileManagerService`; injects `NetworkBackendService` but never calls its dead `/analyze` path | Landing/session picker — neutral | reuse |
| `/upload` | `UploadNetworkComponent` | `FileUploadService` → `/upload`; `NetworkSessionService` | Matches the model: one folder upload becomes the one network every later view reads | reuse |
| `/visualization` | `NetworkVisualizationComponent` | reads cached `AnalysisStateService` network data; own d3 force-directed rendering, layered from `iteration_sets` | The FE chapter describes network-view + structure-dashboard as one combined screen; here they are two separate routes. Not wrong, just split differently than the ambition describes | reuse |
| `/structure` | `NetworkStructureComponent` | `AnalysisStateService`, `NetworkSessionService`; reads `/network-structure` response (layers, fork/join counts, connectivity) | Same network object, a stats reading of it — matches the model | reuse |
| `/diamonds` | `DiamondAnalysisComponent` | `DiamondAnalysisService` → `/diamond-analysis` (**broken**, §2) | See §5 — presented as a standalone top-level system, not an internal step of reliability | adapt |
| `/probability-propagation` (and `/exact-inference` redirect) | `ExactInferenceComponent` | `ReachabilityAnalysisService` → `/probability-propagation` (**broken**, §2) | Matches the model directly: one toolkit reading of the one network, with interval/p-box display ("`BeliefValue = number \| IntervalData \| PboxData`", checked in the component) never flattened to a point | reuse (once §2 is fixed) |
| `/capacity-analysis` → `config`/`summary`/`bottlenecks`/`visualization`/`scenarios` | `FlowWorkbenchShellComponent` + 5 page components (the "v3" workbench) | `flow-workbench.store.ts` → `AnalysisStateService` → `CapacityAnalysisService` → `/flow-analysis`, live and current | Matches the model; correctly Float64-only end to end | reuse |
| `/capacity-analysis-v2` | `CapacityV2SidenavShellComponent` + 11 sub-pages (`overview`, `inputs`, `flows`, `paths`, `bottlenecks`, `uncertainty`, `upgrades`, `comparison`, `performance`, `visualization`, `export`) sharing one `CapacityV2Store` | `capacity-v2.service.ts` → same `/flow-analysis`-family calls, but its store models an `interval`/`pbox`-shaped result (`hasIntervalResult`, `dataType: 'interval'` branches, best-case/worst-case) that the server's own `parse_capacity_input_file` explicitly rejects (throws unless `data_type == "Float64"`) | Directly contradicts the framework's stated Float64-only flow boundary — the FE invents a capability the algorithm does not have | **discard** (or gut to the Float64-only subset already covered by v3) |
| — `upgrades` sub-page specifically | `CapacityV2UpgradesPageComponent` → `CapacityV2Store` → (elsewhere) `capacity-upgrade.service.ts` | calls the two nonexistent endpoints in §1 | discard |
| `/capacity-analysis-legacy` | `CapacityAnalysisComponent` | `CapacityAnalysisService` → `/flow-analysis`, live | An older, single-page precursor to the v3 workbench, functionally overlapping it | discard once v3 is confirmed to cover its ground |
| `/time-analysis` | `TimeAnalysisComponent` | `CpmAnalysisService` → `/critical-path-analysis`, live but stale module (§3) | Matches the model conceptually; blocked by §3 | adapt (rewire to V2 module) |
| `/cost-analysis` | `CostAnalysisComponent` | same service/endpoint, cost fields of the same response | same as above | adapt (rewire to V2 module) |
| `/system-profile` | `SystemProfileComponent` | `SystemProfileService` (own `/network-structure` call for basic info; everything else read from `AnalysisStateService`'s already-cached scenario results — makes no new analysis calls of its own) | See §6 | adapt |
| `/docs` | `DocumentationComponent` (`analysis/documentation/`) | fetches `docs/toc.json`, `docs/<file>` — relative paths served as static FE assets (`apps/info-prop-ui/public/docs/`), **not** the broken server `/docs` endpoint | Self-contained, works regardless of §1's server-side `/docs` bug | reuse |
| *(unrouted)* | `documentation/documentation.component.ts` (top-level, outside `analysis/`) | calls `${apiUrl}/docs/documentation.md` — the broken server endpoint from §1 | Dead file, not reachable from any route in `app.routes.ts` | discard |
| *(unrouted)* | `network-backend.service.ts` | `/analyze` (nonexistent) | injected into `AnalysisStateService` but never invoked by any page (confirmed by repo-wide grep for callers) | discard |
| *(unrouted, no route registered anywhere)* | `.\apps\info-prop-ui\` (repo root) | — | near-empty orphan tree (1 tracked file); not part of the working app | discard |

## 5. `/diamonds` page, concretely

The page's own header, read from `diamond-analysis.component.html`, frames it as: title
"**Convergence Point Analysis**," subtitle "Identify conditioning node dependencies and failure
propagation paths in directed acyclic systems," under an HTML comment
`<!-- System-Wide DAG Infrastructure Analysis Dashboard -->`. It is a four-tab dashboard —
"Diamond Hierarchy," "System Dependencies," "Diamond Patterns" (a sortable Material table of every
pattern found), "System Insights" — reached from its own top-level nav entry, a peer of
`/probability-propagation`, `/capacity-analysis`, `/time-analysis`, with no requirement that a
reliability analysis has been or will be run.

Checked against the Diamond chapter (`FRAMEWORK_SYNTHESIS.md` §2): the framework itself treats
decomposition as "a network pre-processing step," built specifically for and consumed by the
probability toolkit ("It is the analysis the decomposition module was built for" — Probability
chapter), explicitly bypassed by CPM, and never described as a fourth kind of question the network
answers. Presenting it as a standalone, equal-status "System-Wide Infrastructure Analysis" surfaced
before or independent of any reliability run is the toolkit-siloed reading the framework's own
account does not support. The page's per-diamond drill-down (`join-node-diamond-analysis-dialog`,
source overrides feeding `/diamond-subgraph-analysis`) *is* grounded — the Diamond chapter's own
self-similarity claim (§2 of the synthesis) genuinely licenses treating one diamond as an
inspectable standalone sub-network — so the capability itself is not invented, only its framing
as the page's top-level identity. **Assessment: adapt** — keep the identification results and the
per-diamond drill-down (once §2's server bug is fixed), but fold the entry point into the
reliability/probability workflow rather than a nav-level peer of the three toolkits.

## 6. System Profile, concretely (as requested)

`system-profile.component.ts`/`.html`, read in full. Three tabs: **Overview** (a metrics heatmap
across every scenario the user has already run, via `MetricsHeatmapComponent`, plus
`HotspotAlertsComponent`), **Network Lens** (`NetworkLensComponent` — a graph re-render of the
network with nodes/edges highlighted by a selected "graph focus," e.g. capacity bottlenecks,
CPM critical nodes, low-belief reachability nodes, diamond conditioning nodes — one dropdown
switches which analysis's output colours the same graph), **Insights & Recommendations**
(`CrossScenarioInsightsComponent` plus a client-computed "capacity optimisation" ranking).

Its service, `SystemProfileService.generateSystemProfile`, is explicit in its own doc-comment
that it "**never makes its own backend calls for analysis**" — it fetches `/network-structure`
for basic network facts and otherwise reads whatever is already cached in `AnalysisStateService`
from scenarios the user separately ran on `/probability-propagation`, `/flow-analysis`, and
`/critical-path-analysis` in this browser session. If none of those has been run yet, the page's
only content is the error "No analysis results available. Run analyses first, then return here."

Two concrete reasons this reads as confusing, both verified in the code rather than guessed:

1. **It is a comparison-of-what-you've-already-run view, not an analysis view, but nothing in the
   navigation or the page itself makes that dependency obvious up front** — a user arriving here
   before running reliability/flow/schedule elsewhere gets a dead end, not a prompt with a clear
   path back. This is otherwise a reasonable, model-faithful design: it is functionally the
   "cross-scenario profile view" the Front-End chapter's own ambition describes ("sets the
   scenarios of one network side by side... without exporting anything to a spreadsheet"), just
   without that view's prerequisite made legible in the UI.
2. **It computes and displays engineering judgements the underlying package never produced.**
   `buildCapacityRecommendation` (read in full, `system-profile.component.ts` lines 417–437) is a
   hand-written if/else ladder over hardcoded thresholds (e.g. `utilization > 90 && upgradePressure
   >= 3` → "Prioritize bottleneck upgrades first") and `capacityOptimizations` computes its own
   weighted score (`utilization/100 * 0.35 + efficiencyLoss * 0.3 + ...`) that exists nowhere in
   `CapacityAnalysisKit.jl`. This is exactly what the Front-End chapter's own design commitment
   rules out — "the interface is a window, not a second implementation" — because these numbers
   and recommendations are invented at the UI layer, not read from a validated module, and a user
   has no way to tell that apart from the actual `analyze_all` outputs shown elsewhere on the same
   tab.

**Assessment: adapt.** The aggregation/comparison concept is sound and matches the framework
model; the client-side scoring/recommendation logic should be removed or clearly relabelled as
non-validated UI heuristic, and the page needs a visible gate (not just an error string) back to
"run these analyses first."

## 7. Cross-cutting issues found

- **Hardcoded `http://localhost:8080`** repeated as a private field in at least eight services
  (`capacity-analysis`, `capacity-upgrade`, `cpm-analysis`, `diamond-analysis`, `file-upload`,
  `network-session`, `network-structure`, `reachability-analysis`) plus `network-backend.service.ts`'s
  own `apiUrl` and `system-profile.service.ts`'s `baseUrl` — no single point of configuration.
- **No automated tests**: `InfoPropFrmwrk\test\` is empty; no FE test target was found wired into
  `nx.json`'s targets beyond the framework defaults. Nothing in this audit was confirmed by
  running a test suite — only by reading source side by side, which is why this document states
  its confidence level per finding rather than a blanket "tested."
- **Repo-root PowerShell smoke scripts** (not read in full — out of scope for the FE/server pair,
  but their existence was noted) reportedly target the retired `/analyze`-style batch route per
  the same INTEGRATION_NOTES; treat any output from them as pre-rebuild evidence, not current.

## 8. What was read in full vs. sampled

**Read in full:** `server.jl`; all seven files under `Server\Handlers\`; `AnalysisCommon.jl`;
`DiamondDecompositionModule.jl`; `InfoPropFramework.jl`'s include list; `app.routes.ts`; every
`shared/services/*.service.ts` (grepped for endpoint strings, all matches read in context);
`system-profile.component.ts` and `.html`; `diamond-analysis.component.html` (structural read,
header/tabs); `capacity-v2.store.ts`/`.service.ts` (targeted read of the interval/pbox branches);
`network-backend.service.ts`; `CriticalPathHandlers.jl`; `CapacityHandlers.jl`; the
`update_beliefs_iterative` signature in `CorePropagation.jl`; `Core\Common.jl`'s session/path
constants; `API_CONTRACT_OPENAPI.yaml`'s endpoint list; `start_server.jl`.

**Sampled (structure/imports/grep, not full line-by-line read):** the ~30 remaining page
components' `.html` templates beyond their headers/tab labels; the `capacity-v3` and
`capacity-v2` individual page components' internals beyond their service wiring; the dialog
components under `network-structure/` and `diamond-analysis/`; `InputProcessingModule.jl`,
`GraphTraversalModule.jl`, `GraphValidationModule.jl` (their exported function names were
confirmed present and used correctly by `StructureHandlers.jl`, but their internals were not
re-audited here — no reason from this pass to doubt them, and no prior note flags them). No
Angular unit/e2e test files were found to run, so no finding here rests on executing the
application.

**Not found / could not verify:** a Flow/Capacity thesis chapter in tex form (see
`FRAMEWORK_SYNTHESIS.md` header note); a `CriticalPathV2Module` wiring anywhere in the live server
path (confirmed absent, not merely unfound); a working `/docs` server directory (confirmed
absent, not merely unfound).
