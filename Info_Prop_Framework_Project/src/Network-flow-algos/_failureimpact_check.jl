include("src/Algorithms/Capacity/CapacityAnalysis-v2/FailureImpactModule.jl")
using .FailureImpactModule
println("loaded")
println(sort!(String.(names(FailureImpactModule))))
