#= The diamond detection automatically identifies:

Common failure points (convergent subsystems)
Natural organizational boundaries
Places where delays propagate through multiple paths =#
module DiamondDecompositionModule

    using ..InputProcessingModule 
    import ProbabilityBoundsAnalysis
    
    # Create aliases to avoid ambiguity
    const PBA = ProbabilityBoundsAnalysis
    # Type aliases for convenience
    const PBAInterval = ProbabilityBoundsAnalysis.Interval
    const pbox = ProbabilityBoundsAnalysis.pbox
    const Interval = InputProcessingModule.Interval

    # Export all public functions and types
    export DiamondsAtNode, Diamond, DiamondComputationData
    export create_diamond_hash_key
    export new_identify   # correct-by-construction identification (factorized); the ONLY producer now.
    # RETIRED (buggy hybrid-reuse + completeness loop): identify_and_group_diamonds,
    # build_unique_diamond_storage[_depth_first_parallel] from Pipeline*.jl. Replaced by new_identify,
    # which emits root_diamonds + unique_diamonds together. See ROADMAP.md / PIPELINE_REWRITE_STATUS.md.

    include(joinpath(@__DIR__, "Internal", "TypesAndCache.jl"))
    include(joinpath(@__DIR__, "Internal", "UtilityFunctions.jl"))
    include(joinpath(@__DIR__, "Internal", "NewIdentify.jl"))

end
