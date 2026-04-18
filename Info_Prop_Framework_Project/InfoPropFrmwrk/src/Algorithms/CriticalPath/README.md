# CriticalPathModule

`CriticalPathModule` provides generalized critical-path style analysis with configurable combination/propagation functions and exact non-negative time support.

## Main Types

- `NonNegativeTime`
- `TimeUnit`
- `TimeFlowParameters`
- `CriticalPathParameters`
- `CriticalPathResult`
- `ExtendedCriticalPathResult`

## Main Entry Points

- `critical_path_analysis`
- `backward_pass_analysis`
- `time_critical_path`
- `project_duration`
- `critical_path_nodes`

## Utility API

- Combination: `max_combination`, `min_combination`, `sum_combination`
- Propagation: `additive_propagation`, `multiplicative_propagation`
- Time conversion: `to_hours`, `from_hours`, `format_time_results`

## Dependencies

- `InputProcessingModule`
- `DiamondDecompositionModule`

## Internal Layout

- `CriticalPathModule.jl`
	- Public module wrapper, exports, and include wiring.
- `Internal/TypesAndOperators.jl`
	- Time types, parameter/result types, inverses, and standard combination/propagation operators.
- `Internal/AlgorithmsAndUtilities.jl`
	- Main forward/backward analysis plus specialized and utility routines.

## Packaging Guidance

- `NonNegativeTime` guards are part of correctness contracts and should remain strict.
- Keep time-unit conversion constants centralized in this module.
