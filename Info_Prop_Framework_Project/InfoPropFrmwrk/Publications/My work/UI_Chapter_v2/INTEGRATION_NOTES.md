# Integrating this chapter into the thesis (when you choose to)

Standalone build: 9 pages, 0 errors, 0 undefined references, 0 overfull boxes (pdflatex + biber).
The chapter follows the thesis convention (`\ifdefined\maindoc` scaffold, starts at `\section`).

1. **Place the files**: copy `Front_End_Chapter.tex` and `figures/` to
   `thesis/Chapters/Front End/` (or your preferred folder name).
2. **main.tex**: add the `\include`, extend `\graphicspath` with the chapter's figures path, and
   give the chapter `\label{ch:front-end}`. The chapter cross-references `ch:input-module` (4),
   `ch:diamond-module` (5), `ch:probability-toolkit` (6), `ch:capacity-toolkit` (7),
   `ch:critical-path` (8), `ch:julia-package` (9), and `ch:integrated-case-study` (11) by label,
   with standalone-only fallbacks carrying those numbers per the agreed thesis flow. The Julia
   package and Integrated Case Study chapters do not exist yet; their labels must be added to
   main.tex when those chapters land (or the two sentences referencing them adjusted).
3. **Bibliography**: the 10 entries here are carried over from the ESREL paper's verified
   References.bib (opencossan2018 and gray2021pbajulia keys renamed for consistency; fields
   preserved). Already appended to the repo-root `MERGE_INTO_THESIS_BIB.bib` (2026-08-19) — that
   file now holds 52 entries, no duplicate keys, and its contents ARE the thesis-root
   references.bib for Overleaf integration.
4. The `\screenshotplaceholder` macro renders framed placeholders for the two screenshot
   figures; it is defined in the chapter file and safe under `\maindoc`.

## Perspective this chapter is written from (your instruction, 2026-08-19)

The chapter describes the interface in present tense as the REBUILT front end will be at
submission, grounded only in capabilities that are real and trusted today: the server's contract
principles and the FE features verified to exist in code. It deliberately avoids UI minutiae
that the rebuild may change (layouts, page names) and it claims no analytical capability beyond
the validated modules ("the interface is a window, not a second implementation"). The ESREL
paper's stale content (the old single-pass capacity equation, the alternating-sum union, the
"optimization recommendations" panel) is not carried over.

## Figures

- fig01 (architecture) and fig02 (guided pipeline) are dot sources, FINAL, regenerate via
  `dot -Tpdf` from a short path.
- fig03 and fig04 are placeholders for final interface captures, to be taken AFTER the FE/BE
  rebuild:
  - fig03: the network view (layered layout, node roles coloured) beside the structure
    dashboard, on the loaded network.
  - fig04: propagated beliefs under an interval scenario beside the deterministic scenario,
    plus the cross-scenario comparison view.
  Swap each `\screenshotplaceholder` for an `\includegraphics` when the captures exist.

## What the chapter's claims rest on (verified against code, 2026-08-19 inventory)

| Chapter claim | Ground truth on disk |
|---|---|
| Julia service, HTTP on localhost, endpoint per analysis class | `InfoPropFrmwrk/src/Server/` (HTTP.jl, port 8080): /network-structure, /diamond-analysis, /diamond-subgraph-analysis, /probability-propagation, /flow-analysis, /critical-path-analysis (+legacy aliases), /upload, /sessions, /files, /docs |
| Machine-readable contract | `src/Server/API_CONTRACT_OPENAPI.yaml` (OpenAPI 3.0.3, v2.0.0) — authoritative and in sync with handlers |
| Requests name files; wire format = ch4's input contracts; data_type dispatch | handlers take `networkPath`/`*Path` fields; `read_node_priors_from_json` / `read_edge_probabilities_from_json` dispatch on `data_type` |
| Edge-list reconstruction without a structure file | `ServerCommon.resolve_edges_file_path` synthesises `.inferred/…EDGES` from analysis-input edge keys |
| Typed uncertainty serialisation (interval pair; p-box summary) | `AnalysisCommon.convert_values` |
| Sessions = folder + plain JSON; delete = remove folder | `temp_uploads/<uuid>/session.json`; DELETE /sessions/* does `rm -r` |
| Diamond store cached in memory + persisted per session, content-keyed | `DIAMOND_ANALYSIS_CACHE` + Serialization to `diamond_cache/<sha1>.bin`, key incl. file mtimes |
| Flow options: 3 solvers, kFailure, limits, targetFlow, degradation scenarios; Float64-only | `CapacityHandlers` `analysisOptions`; hard-rejects non-Float64 `data_type` |
| Angular + Material + signals FE; d3 drawing; layered layout from iteration sets | `src/UI/inf-prop-ui/` (Angular ~20.1, signals services, d3 v7, `buildLayeredPrimitiveGraph` from `iteration_sets`) |
| Guided pipeline with data gates; view-state preservation | `NavigationService` requiredData gates; `AnalysisStateService.viewStateCache` |
| Folder upload + scenario categorisation by naming convention (float/interval/pbox) | `file-categorization.service.ts` regexes |
| Per-diamond isolated analysis with source overrides | POST /diamond-subgraph-analysis (`analyses`, `sourceOverrides`) + diamond detail components |
| Interval/p-box display with width statistics, never collapsed | `ExactInferenceComponent` width stats; `BeliefValue = number | IntervalData | PboxData` in sync with server |
| Multi-scenario runs + cross-scenario comparison | per-analysis multi-scenario signals; system-profile components |
| In-app documentation | `apps/info-prop-ui/public/docs/` rendered by marked |

## REBUILD CHECKLIST (the desync the chapter's claims depend on fixing before screenshots)

Server side:
1. `Handlers/AnalysisCommon.jl` still calls the RETIRED `identify_and_group_diamonds` and
   `build_unique_diamond_storage_depth_first_parallel` (lines ~315, ~327). Neither is loaded any
   more (DiamondDecompositionModule exports only `new_identify`), so /diamond-analysis,
   /diamond-subgraph-analysis, /probability-propagation and /reachability-analysis throw at
   first call. Rewire `find_or_build_diamond` to `new_identify`.
2. Serialisers predate independent-diamond factorisation: `serialize_root_diamonds` expects
   `Dict{Int64, DiamondsAtNode}` (now `Vector{DiamondsAtNode}` per join), and
   `serialize_unique_diamonds` treats `sub_diamond_structures` values as singular. Update both,
   and the `update_beliefs_iterative` call site, to the plural shapes.
3. `CriticalPathV2Module` is not wired into `Algorithms/InfoPropFramework.jl` (V1 only). Wire V2
   per the CPM chapter's validated rebuild before CPM screenshots.
4. /docs points at `src/Server/docs`, which does not exist (the markdown lives in the FE's
   public/docs). Either create it or drop the endpoint; the in-app docs don't use it.
5. Optional hardening: the error envelope leaks up to 25 stack frames to the client.

Front-end side:
6. Delete dead calls: `network-backend.service.ts` (POST /analyze does not exist, service still
   injected into AnalysisStateService), `capacity-upgrade.service.ts` (both upgrade endpoints
   do not exist; the v2 upgrades page depends on it), `app/documentation/documentation.component.ts`
   (unrouted, targets the broken /docs file).
7. Retire the adapter shims once shapes settle: `normalizeCpmResponse` (fabricates count fields
   the server never sends), `normalizeCapacityResponse` (hard-codes utilisation 0 and empty
   maps), and the model fields the server never returns (`available_data_files`,
   `diamond_efficiency`, response-level `network_name`, `analysis_config` on upload).
8. Collapse the three capacity generations (legacy/v2/v3) to the v3 workbench; the v2
   uncertainty page cannot be fed real interval capacities (server is Float64-only by contract).
9. Centralise the base URL (`http://localhost:8080` is hard-coded in 11 services).
10. Duplicate stale trees to remove: `src/Network-flow-algos/front-end/inf-prop-ui/` and the
    orphan `apps/info-prop-ui/` at repo root. Repo-root `API_DOCUMENTATION.md` documents the
    retired batch server (port 8000, inline schemas) and should be superseded by the OpenAPI file.
11. No automated tests exist for server or FE (empty `InfoPropFrmwrk/test/`, no FE test target);
    the PowerShell smoke scripts at repo root partly target the retired /analyze route.

The chapter makes NO claim that depends on items 5, 9, 10 or 11; they are hygiene. Items 1-3 are
the ones the chapter's propagation/diamond/CPM screenshots require.
