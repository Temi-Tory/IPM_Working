# Developer Reference

This section is for developers who want to extend the framework, add new analysis types, or integrate with the backend API.

---

## Architecture

```
Frontend (Angular 20)
  |  HTTP / JSON
Backend Server (Julia HTTP.jl)
  |  Function calls
Algorithm Modules (IPAFrameworkOptimized)
```

---

## Backend API Endpoints

All endpoints accept and return JSON. CORS is enabled for all origins.

### `GET /health`

Returns `{"status": "healthy"}`.

### `POST /upload`

Multipart form upload. Returns `network_path`, `upload_id`, `uploaded_files[]`, `edges_files[]`.

### `GET /files/{network_path}/{file_path}`

Serves a previously uploaded JSON file.

### `POST /network-structure`

**Body**: `{ "networkPath": "...", "edgesFilePath": "..." }`

Returns full graph topology: nodes, edges, source/sink/fork/join nodes, iteration sets, ancestors, descendants, outgoing/incoming indices.

### `POST /diamond-analysis`

**Body**: `{ "networkPath": "...", "edgesFilePath": "...", "nodepriorsPath": "..." }`

Returns root and unique diamond structures, computation times, efficiency metric.

### `POST /diamond-subgraph-analysis`

**Body**: `{ "networkPath": "...", "diamondHash": "...", "analyses": ["reachability", "capacity", "cpm"], ... }`

Runs specified analyses on a single diamond subgraph. Supports `sourceOverrides` for each analysis type.

### `POST /reachability-analysis`

**Body**: `{ "networkPath": "...", "nodepriorsPath": "...", "linkprobsPath": "...", "includeExactInference": true, "includeDiamondAnalysis": false }`

Runs belief propagation. Returns per-node beliefs, priors, statistics (mean/min/max), computation time.

### `POST /capacity-analysis`

**Body**: `{ "networkPath": "...", "capacitiesPath": "..." }`

Returns node max flows, bottlenecks, edge utilisation, network utilisation, comparative analysis (capacity gaps, upgrade priorities, strategic recommendations).

### `POST /cpm-analysis`

**Body**: `{ "networkPath": "...", "cpmPath": "..." }`

Returns time and cost results: critical value, critical nodes, node values (EF), early start, late start, late finish, total slack, and input data.

---

## Julia Algorithm Modules

### IPAFrameworkOptimized.jl

The main framework module. Includes and re-exports all sub-modules:

| Module | File | Purpose |
|--------|------|---------|
| InputProcessingModule | InputProcessingModule.jl | Read graphs (CSV/EDGES), node priors (JSON), edge probabilities (JSON) |
| DiamondProcessingModule | DiamondProcessingModule.jl | Identify diamonds at join nodes, build pre-computed diamond storage |
| ReachabilityModuleRecurseOptimized | ReachabilityModuleRecurseOptimized.jl | Belief propagation with bit-masking inclusion-exclusion (Float64 only) |
| CapacityAnalysisModule | CapacityAnalysisModule.jl | Maximum flow, bottleneck, widest-path, comparative, multi-commodity |
| GeneralizedCriticalPathModule | GeneralizedCriticalPathModule.jl | Generalised CPM with customisable combination/propagation functions |
| DiamondClassificationModule | DiamondClassificationModule.jl | Classify diamonds by structure, topology, connectivity |
| ComparisonModules | ComparisonModules.jl | Monte Carlo and path-enumeration verification |

### Key Data Structures

```julia
# Diamond at a join node
struct DiamondsAtNode
  join_node::Int64
  diamond::Diamond
  non_diamond_parents::Vector{Int64}
end

# Pre-computed diamond subgraph
struct DiamondComputationData{T}
  sub_outgoing_index, sub_incoming_index
  sub_sources, sub_fork_nodes, sub_join_nodes
  sub_ancestors, sub_descendants, sub_iteration_sets
  sub_node_priors::Dict{Int64, T}
  sub_diamond_structures
end

# Capacity parameters
struct CapacityParameters{T}
  node_capacities::Dict{Int64, T}
  edge_capacities::Dict{Tuple{Int64,Int64}, T}
  source_input_rates::Dict{Int64, T}
  target_nodes::Set{Int64}
end

# CPM parameters
struct CriticalPathParameters{T}
  node_values, edge_values, initial_value
  combination_func, propagation_func, node_func
end

# Extended CPM result (with backward pass)
struct ExtendedCriticalPathResult{T}
  node_values, early_start, late_finish, late_start, total_slack
  critical_value::T
  critical_nodes::Vector{Int64}
end
```

### Key Exported Functions

```julia
# Graph I/O
read_graph_to_dict(filename) -> (edgelist, outgoing, incoming, sources)
read_node_priors_from_json(filename) -> Dict{Int64, T}
read_edge_probabilities_from_json(filename) -> Dict{Tuple, T}
find_iteration_sets(edgelist, outgoing, incoming) -> (sets, ancestors, descendants)
identify_fork_and_join_nodes(outgoing, incoming) -> (forks, joins)

# Diamonds
identify_and_group_diamonds(joins, incoming, ancestors, descendants, sources, forks, edges, priors, sets)
build_unique_diamond_storage(diamonds, priors, ancestors, descendants, sets)
build_unique_diamond_storage_depth_first_parallel(...)  # Threaded version

# Belief propagation
update_beliefs_iterative(edges, sets, outgoing, incoming, sources, priors, probs, descendants, ancestors, diamonds, joins, forks, lookup)

# Capacity
maximum_flow_capacity(sets, outgoing, incoming, sources, params)
comparative_capacity_analysis(sets, outgoing, incoming, sources, params)

# CPM
critical_path_analysis(sets, outgoing, incoming, sources, params)
backward_pass_analysis(forward_result, sets, outgoing, incoming, sources, sinks, params)
```

---

## Frontend Architecture

### Technology

- Angular 20.1 (standalone components, signals)
- Angular Material (Material Design 3)
- D3.js v7.9 (network visualisation)
- TypeScript 5.8, SCSS, Nx 21.4

### Key Services

| Service | Purpose |
|---------|---------|
| `AnalysisStateService` | Central state management using Angular signals |
| `FileManagerService` | File upload, categorisation, scenario detection |
| `DiamondAnalysisService` | Diamond API calls, multi-scenario results |
| `CpmAnalysisService` | CPM API calls with response caching |
| `NetworkBackendService` | HTTP communication with backend |

### State Management Pattern

All state uses Angular writable signals:

```typescript
// Writable signal
private networkDataSignal = signal<NetworkStructure | null>(null);

// Read-only computed
readonly networkData = computed(() => this.networkDataSignal());

// Update
this.networkDataSignal.set(newData);
```

### Multi-Scenario Pattern

Each analysis component implements `ScenarioAwareComponent`:

```typescript
interface ScenarioAwareComponent {
  availableScenarios: ScenarioInfo[];
  currentScenario: string | null;
  scenarioResults: Map<string, any>;
  loadScenarios(): void;
  setCurrentScenario(name: string): void;
}
```

### Adding a New Analysis Type

1. Create a Julia module in `src/Algorithms/`
2. Export functions from `IPAFrameworkOptimized.jl`
3. Add an endpoint in `backend_server.jl`
4. Add TypeScript interfaces in `network-analysis.models.ts`
5. Create an Angular service in `shared/services/`
6. Create a component in `analysis/`
7. Add route in `app.routes.ts` and nav link in `app.html`

### Theming

All components use CSS custom properties from `styles.scss`:

```scss
color: var(--text-primary);
background: var(--surface-color);
border: 1px solid var(--border-color);
```

Dark mode is activated by `[data-theme="dark"]` on the root element. Never use `@media (prefers-color-scheme: dark)`.
