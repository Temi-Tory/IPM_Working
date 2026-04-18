module MonteCarloOptimizedModule

include(joinpath(@__DIR__, "MC_Optimized.jl"))

export MC_result_optimized,
       find_all_reachable

end # module MonteCarloOptimizedModule
