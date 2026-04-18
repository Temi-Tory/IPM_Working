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
- `GraphValidationModule`

## Internal Layout

- `CriticalPathModule.jl`
	- Public module wrapper, exports, and include wiring.
- `Internal/TypesAndOperators.jl`
	- Include wrapper for focused type/operator internals.
- `Internal/TimeTypes.jl`
	- `NonNegativeTime`, time-unit conversions, and `TimeFlowParameters`.
- `Internal/MathOperators.jl`
	- Inverse, combination, and propagation operators.
- `Internal/ModelTypes.jl`
	- `CriticalPathParameters`, `CriticalPathResult`, `ExtendedCriticalPathResult`.
- `Internal/ValidationAndDiagnostics.jl`
	- Input checks and result-consistency validation/diagnostic helpers.
- `Internal/AlgorithmsAndUtilities.jl`
	- Include wrapper for focused algorithm internals.
- `Internal/CoreAlgorithms.jl`
	- Forward and backward critical path core algorithms.
- `Internal/SpecializedAnalyses.jl`
	- Time, cost, and severity specialized analyses.
- `Internal/PathAndSlackUtilities.jl`
	- Path backtracking, slack, and time-output utility functions.

## Packaging Guidance

- `NonNegativeTime` guards are part of correctness contracts and should remain strict.
- Keep time-unit conversion constants centralized in this module.

#
# MATHEMATICAL LIMITATIONS AND GUIDELINES
#

"""
Guidelines for choosing appropriate functions based on mathematical properties:

TIME-BASED SYSTEMS (using NonNegativeTime for exact calculations):
- Use time_critical_path() for exact time-based critical path analysis
- Supports multiple input formats (Float64 or NonNegativeTime)
- Automatic conversion and validation of non-negative time values
- Use project_duration() to get total project duration
- Use critical_path_nodes() to find nodes on critical path
- Use format_time_results() to convert results to different time units
- Mathematical exactness guaranteed by NonNegativeTime type system

ADDITIVE SYSTEMS (time, cost accumulation):
- combination_function: max_combination (critical path)
- propagation_function: additive_propagation
- node_function: additive_propagation
- slack: Use calculate_slack_additive
- backtracking: Use find_critical_path_nodes_additive

MULTIPLICATIVE SYSTEMS (reliability, scaling factors):
- combination_function: max_combination or multiplicative custom
- propagation_function: multiplicative_propagation
- node_function: multiplicative_propagation
- slack: Use calculate_slack_multiplicative
- backtracking: Use find_critical_path_nodes_general with multiplicative_inverse

CUSTOM SYSTEMS:
- Define our own combination, propagation, and node functions
- Provide corresponding inverse functions for backtracking
- Define appropriate slack calculation
- Validate mathematical properties (monotonicity, etc.)

TIME UNIT CONVERSIONS:
- Base unit: hours (optimal balance of precision and scale)
- Supported units: :microseconds, :milliseconds, :seconds, :minutes, :hours, :days, :weeks
- Use to_hours() to convert from other units to NonNegativeTime
- Use from_hours() to convert NonNegativeTime to other units
- All conversions maintain mathematical exactness
"""
