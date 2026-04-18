# Non-Flow Module Refactor Plan

This plan targets non-flow-capacity modules only and is constrained to structural refactors with no algorithm behavior changes.

## Current Monolith Hotspots

- Diamond decomposition: `DiamondDecompositionModule.jl` (largest file)
- Critical path: `CriticalPathModule.jl`
- Probability propagation: now split into internal includes

## Refactor Standard

Each module should follow the same internal pattern:

- `ModuleName.jl`: wrapper with imports/exports/includes only
- `Internal/Types.jl`: all structs and type aliases
- `Internal/Validation.jl`: input and contract checks
- `Internal/Core.jl`: primary algorithm pass
- `Internal/Helpers.jl`: reusable local utilities

## Shared Abstraction Targets

1. Graph traversal helpers
- Promote generic BFS/DFS/reachability helpers from module-local code to `Shared/` where safe.

2. Validation utilities
- Normalize repeated index/edge consistency checks in one shared validator utility.

3. Cache-key patterns
- Standardize hash-key and lock patterns used by recursive/parallel modules.

## Phased Delivery

1. Completed
- Probability propagation split into internal files without API changes.

2. Next
- Diamond decomposition split into internal files:
  - types and cache context
  - detection pipeline
  - precomputation builders
  - utility operations

Status update:
- Completed: `types and cache context`, `utility operations`, `detection pipeline`, and `precomputation builders` extraction into `DiamondDecomposition/Internal/`.

3. Then
- Critical path split into:
  - time-unit types/operators
  - parameter/result types
  - combination/propagation function library
  - forward/backward pass core

Status update:
- Completed: CriticalPath split into internal files (`TypesAndOperators`, `AlgorithmsAndUtilities`) with wrapper include wiring.

4. Final
- Introduce shared abstractions in `Shared/` and remove module-local duplicates incrementally.

Shared helper progress:
- Completed: Diamond typed default value helpers now delegate to `InputProcessingModule` shared helpers, with a preserved module-specific pbox `one_value` override.
- Completed: graph topology/edge consistency checks extracted to `Shared/GraphValidationModule.jl` and integrated into `ProbabilityPropagation` validation.
- Completed: edgelist-based edge-value validation extracted to shared helper and integrated into `CriticalPath.validate_time_parameters`.
- Completed: BFS reachability traversal extracted to `Shared/GraphTraversalModule.jl` and integrated into Monte Carlo via delegation.

CriticalPath internal abstraction progress:
- Completed: validation and diagnostics functions extracted from `Internal/AlgorithmsAndUtilities.jl` into `Internal/ValidationAndDiagnostics.jl`.
- Completed: deep split of both remaining monolithic internals:
  - `TypesAndOperators.jl` converted to include wrapper over `TimeTypes`, `MathOperators`, and `ModelTypes`.
  - `AlgorithmsAndUtilities.jl` converted to include wrapper over `CoreAlgorithms`, `SpecializedAnalyses`, `PathAndSlackUtilities`, and `Guidelines`.

## Guardrails

- Keep public exports stable.
- Do not change numeric semantics.
- Keep existing tests green after each phase.
- Run package load checks after each split.
