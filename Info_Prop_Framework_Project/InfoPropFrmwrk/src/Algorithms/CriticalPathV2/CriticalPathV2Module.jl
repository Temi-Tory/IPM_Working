#
# CriticalPathV2 — mode-based rebuild of the critical path toolkit.
#
# Design: validation/CPM_REBUILD_DESIGN.md. Every shipped mode carries forward AND
# backward semantics; the sum family's backward object is the adjoint pass. Value
# types are generic; interval results are computed by scheme (corner runs), not by
# operator overloading — see Internal/IntervalScheme.jl once the interval phase lands.
#

module CriticalPathV2Module

export AnalysisMode, LONGEST_PATH, SHORTEST_PATH, MAX_SCALING,
       PathResult, AccumulationResult,
       analyze, accumulation_analysis,
       forward_fold, reverse_fold,
       ValueInterval, IntervalPathResult, interval_analyze, interval_analyze_exact,
       interval_analyze_split,
       width, is_degenerate

include(joinpath(@__DIR__, "Internal", "Modes.jl"))
include(joinpath(@__DIR__, "Internal", "Results.jl"))
include(joinpath(@__DIR__, "Internal", "Kernels.jl"))
include(joinpath(@__DIR__, "Internal", "IntervalScheme.jl"))
include(joinpath(@__DIR__, "Internal", "DominationSplit.jl"))

end # module
