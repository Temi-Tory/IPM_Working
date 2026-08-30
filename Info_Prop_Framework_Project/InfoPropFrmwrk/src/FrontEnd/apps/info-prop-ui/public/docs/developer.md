# Developer Reference

## Running it

```bash
# backend, from InfoPropFrmwrk/ (holds Project.toml)
julia --project=. --threads=auto src/Server/start_server.jl

# frontend, from InfoPropFrmwrk/src/FrontEnd
npx nx serve info-prop-ui
```

The server binds `127.0.0.1:8080` by default (`INFOPROP_HOST` env var to change the host). It's local-only by design — CORS is restricted to the front end's own origin, not opened up generally.

## HTTP endpoints

Every request names files by path; it never embeds the network in the request body. Every endpoint takes a JSON body and returns `{ "success": bool, "message": string, ... }`.

| Endpoint | Purpose |
|---|---|
| `POST /upload` | Multipart form upload — always creates a **new** session; there is no "add to an existing session" endpoint |
| `GET /sessions` | List sessions |
| `GET /sessions/{id}` · `PUT /sessions/{id}` · `DELETE /sessions/{id}` | Open, update, or delete one session |
| `GET /files/{networkPath}/{relativePath}` | Read one uploaded file back (JSON files only — a raw `.EDGES` file 500s here; the front end reconstructs edge lists from `/network-structure` instead of re-reading them) |
| `POST /network-structure` | Derive roles, layers, connectivity from an edge list |
| `POST /probability-propagation` | Reliability: belief propagation, with an `includeExactInference` flag (`false` = decomposition only, the lighter call) and `includeDiamondAnalysis` |
| `POST /diamond-subgraph-analysis` | Run an analysis on one diamond in isolation, by hash, with source overrides |
| `POST /flow-analysis` | Flow: max-flow, cuts, structural connectivity |
| `POST /critical-path-analysis` | Schedule: time and cost passes, `mode`/`costMode` optional overrides |

`networkPath` doesn't have to be inside a session's `temp_uploads/` folder — the server resolves it as a plain directory path (absolute, or relative and checked for the referenced files), so a network can be pointed at directly on disk for scripted analysis without going through `/upload` at all.

## Front-end architecture

An Nx monorepo (`InfoPropFrmwrk/src/FrontEnd`), Angular with signals throughout, no NgModules. Module boundaries are enforced by `@nx/enforce-module-boundaries`, on two axes:

- **Layer** (`type:app` → `type:feature` → `type:ui` / `type:data-access` / `type:api-client`) — `type:ui` may depend only on `type:ui` and `type:api-client`, **not** `type:data-access`, which is why a component that needs to render `ScenarioRun`/`ScenarioMetric` shapes but lives in `shared/ui` defines its own small structural types rather than importing the real ones (they're satisfied structurally, without a cast, at the real call sites).
- **Scope** (`scope:reliability`, `scope:flow`, `scope:schedule`, ..., `scope:shared`) — a feature may depend only on its own scope plus `scope:shared`; no cross-feature-scope imports. A feature that needs another feature's components (the standalone Diamonds page needing Reliability's diamond components, for instance) lives inside that feature's own lib rather than importing across scopes.

```
libs/
  shared/
    api-client/     the HTTP client + every response/request TypeScript shape
    data-access/     ScenarioCacheService, NetworkContextService, file-convention.ts, ...
    ui/              presentational components — cards, tables, the shared network graph
  feature/
    reliability/     Reliability toolkit + the standalone Diamonds page
    flow/
    schedule/
    system-profile/  cross-scenario comparison
    session-inputs/   the missing-inputs editor
apps/
  info-prop-ui/       the shell: routing, nav rail, pages that aren't toolkit-scoped
```

## Server / algorithm layers

`InfoPropFrmwrk/src/Algorithms/` holds the analysis modules themselves — `DiamondDecomposition`, `ProbabilityPropagation`, `CapacityAnalysisKit`, `CriticalPathV2` — each generic and unaware of HTTP. `InfoPropFrmwrk/src/Server/Handlers/` is the thin layer that parses a request's JSON, reads the referenced files, calls the algorithm, and serialises the result back. `AnalysisCommon.jl` holds shared parsing/serialisation used by more than one handler. This split matters for correctness questions: an algorithm's own genericity (e.g. `CriticalPathV2` has no concept of "time" or "cost" anywhere in it) can differ from what one particular HTTP handler chooses to require (`CriticalPathHandlers.jl` is the one place "time"/"cost" exist as a concept, as a JSON-key convention) — verify a claim against the actual layer it's about.

## Value forms on the wire

A value never loses its form crossing the HTTP boundary: a deterministic belief is a number, an interval is `{ "type": "interval", "lower": ..., "upper": ... }`, a probability box a fuller typed object. The front end's `ValueDisplayComponent` (`<ipf-value>`) is the single place that renders any of the three — every result table and detail view goes through it rather than each view inventing its own formatting, which is also what keeps the "never flatten an uncertain value" rule enforceable in one place.
