# Algorithms Overview

This folder contains the algorithmic modules exposed through the framework facade in [InfoPropFramework.jl](InfoPropFramework.jl).

## Architecture

- `Shared/`
  - Input parsing, graph indexing, uncertainty helper operations, and shared graph-validation utilities used across modules.
- `DiamondDecomposition/`
  - Structural detection and precomputation of diamond subgraphs.
- `ProbabilityPropagation/`
  - Exact belief propagation over DAGs, including nested diamond handling.
- `CriticalPath/`
  - Configurable critical-path style analysis for time/cost/value propagation.
- `MonteCarlo/`
  - Monte Carlo baseline/sanity-check estimators for probabilistic propagation.
- `FlowCapacity/`
  - Capacity-focused max-flow and reliability toolkit (`CapacityAnalysisKit`).

## Framework Include Order

`InfoPropFramework.jl` includes modules in dependency order:

1. `InputProcessingModule`
2. `GraphValidationModule`
3. `DiamondDecompositionModule`
4. `CriticalPathModule`
5. `ProbabilityPropagationModule`
6. `MonteCarloOptimizedModule`
7. `CapacityAnalysisKit`

This ordering is intentional and should be preserved when adding new modules.

## Public API Surface

Consumers should import from `InfoPropFramework` first. The facade provides:

- Module-level access, e.g. `InfoPropFramework.CapacityAnalysisKit`
- Selected top-level exports for common entry points

For package-quality changes, keep algorithm logic untouched and treat this folder as a stable execution surface.

## Ongoing Refactor Roadmap

- See `NON_FLOW_MODULE_REFACTOR_PLAN.md` for staged decomposition of non-flow modules into typed/internal abstractions.
