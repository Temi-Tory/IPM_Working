# Track 5: Server fixes — Julia side, independent of the front-end rebuild

This track is Julia, not Angular, and does not depend on any of the four FE tracks or on the new
Nx workspace existing. It can start immediately, in parallel with everything else. Read
`FE_AUDIT.md` §§1-3 in full before starting — every fix below is a specific finding from there,
not a general cleanup pass.

Working area: `InfoPropFrmwrk\src\Server\` and `InfoPropFrmwrk\src\Algorithms\`. This track edits
the actual server and algorithm-wiring code — unlike the other four tracks, this one is not
scoped by an Nx lib boundary, so be precise about touching only the files named below.

## Fix 1: diamond-identification wiring (breaks 4 of 11 live endpoints)

`AnalysisCommon.jl` (`find_or_build_diamond`) calls `identify_and_group_diamonds` and
`build_unique_diamond_storage_depth_first_parallel`. `DiamondDecompositionModule.jl`'s own export
list and comments mark both RETIRED, and its `include()` list only loads `TypesAndCache.jl`,
`UtilityFunctions.jl`, `NewIdentify.jl` — not the `Internal/Pipeline*.jl` files those two
functions actually live in. Confirmed directly: those two functions are not loaded into the
running server at all, and every call to `find_or_build_diamond` throws `UndefVarError`.

- Change `AnalysisCommon.jl` to call `new_identify` (the module's own current, exported,
  "correct-by-construction" producer) instead of the two retired functions.
- **This is not a drop-in rename.** `new_identify`'s output shape is a factorised structure that
  can produce more than one diamond per join (`Dict{Int64, Vector{DiamondsAtNode}}`), not the old
  one-per-join shape (`Dict{Int64, DiamondsAtNode}`) the current serialisers assume. Update
  `AnalysisCommon.jl`'s `serialize_root_diamonds` and `serialize_unique_diamonds`, and
  `DiamondHandlers.jl`'s `/diamond-subgraph-analysis` handler (which passes
  `diamond_data.sub_diamond_structures` straight into `update_beliefs_iterative`), to the array-
  per-join shape. Check this against `CorePropagation.jl`'s own `update_beliefs_iterative`
  signature directly — that's the ground truth for what shape the consumer actually expects, not
  this document.
- This fix, done correctly, unblocks `/diamond-analysis`, `/diamond-subgraph-analysis`,
  `/probability-propagation`, and `/reachability-analysis` (the latter two call the identical
  underlying code under two route names).

## Fix 2: CPM wiring (2 endpoints run, but against the superseded module)

`InfoPropFramework.jl` includes `CriticalPath/CriticalPathModule.jl` (v1) only.
`CriticalPathV2/CriticalPathV2Module.jl` exists as its own module but is never included, so it is
not loaded by the server. `CriticalPathHandlers.jl`'s `/critical-path-analysis` and
`/cpm-analysis` (and the CPM branch of `/diamond-subgraph-analysis`) call the v1 module's
functions directly (`max_combination`, `critical_path_analysis`, `backward_pass_analysis`). Per
this project's own validation record, v1's interval and sum-slack outputs are flagged buggy and
should not be exposed.

- Add `CriticalPathV2Module.jl` to `InfoPropFramework.jl`'s include list.
- Rewire `CriticalPathHandlers.jl` to call the v2 module's equivalent functions. Read
  `CriticalPathV2Module.jl`'s own exports to find the correct v2 function names — do not assume
  they match v1's names, and do not assume the response shape matches v1's either (the Schedule FE
  track needs this confirmed shape; treat producing it clearly as part of this fix, not an
  afterthought).

## Fix 3: dead and broken endpoints

- `/docs-list` and `/docs/*` (`DocsHandlers.jl`) read from `src/Server/docs`, which does not exist
  on disk. Either create that directory with real documentation content, or remove these routes
  and `DocsHandlers.jl` entirely — the FE's own `/docs` page already serves static markdown
  directly from the FE's own assets and does not depend on this server endpoint, so removing it
  server-side breaks nothing on the FE side (confirmed in the audit).
- `/analyze` is called by `network-backend.service.ts` but registered nowhere in `server.jl`, and
  is confirmed unreachable from any actual page in the current app (no component calls the
  service method that would trigger it). Since no FE track is porting `network-backend.service.ts`,
  there is nothing to keep this endpoint for. Do not implement it; it's dead code being retired,
  not a gap to fill.
- `/capacity-analysis/upgrade-scenario` and `/capacity-analysis/validate-upgrades` are called only
  by the `/capacity-analysis-v2` page family, which is being discarded entirely (Track 2). Same
  treatment: do not implement, this capability (interval/p-box-aware upgrade scenarios) does not
  exist in `CapacityAnalysisKit.jl` and inventing server support for it would recreate the exact
  problem the FE rebuild is removing.

## Fix 4 (lower priority, flag for a decision rather than fixing silently): network binding

`start_server(host::AbstractString="0.0.0.0", port::Integer=ServerCommon.PORT)`, called with no
arguments, binds to all network interfaces by default, and `handle_cors` sets
`"Access-Control-Allow-Origin" => "*"`. This is a real gap against the Front-End chapter's own
"local, no-code, runs on the user's own machine" commitment — as configured, the server is
reachable from other machines on the same network and from any origin's browser script, not just
the local browser tab. This is a configuration change (default host, CORS origin), not a
capability question, so it's lower-risk than Fixes 1-3, but changing default network exposure is
worth a deliberate decision rather than a silent patch — flag it back before changing the default,
in case there's a reason (e.g. a specific deployment context) the current default was chosen.

## Boundaries

- This track does not touch anything under `InfoPropFrmwrk\src\UI\` or any Nx workspace, old or
  new.
- Do not add new analysis capabilities (interval/p-box flow, p-box schedule) while in here fixing
  wiring. If a fix reveals that some capability would be easy to add, that's a separate decision,
  not part of this track's scope.

## Definition of done

- All four diamond-dependent endpoints return correct results (verified against a known test
  network, not just "doesn't throw") using `new_identify` and the corrected array-per-join
  serialisation shape.
- `/critical-path-analysis` and `/cpm-analysis` return results from `CriticalPathV2Module`,
  confirmed against that module's own validated test cases, not v1's.
- The three dead/nonexistent endpoints are either implemented for real or formally removed from
  the OpenAPI contract, not left as silent 404s.
- The network-binding question has been raised and answered, not silently left at its current
  default.
