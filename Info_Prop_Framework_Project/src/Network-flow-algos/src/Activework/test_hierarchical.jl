include("TESTFILE.jl")

println("Results:")
for (node, belief) in sort(collect(output))
    println("Node $node: $belief")
end

println("\nExpected vs Actual comparison:")
expected = Dict(
    1 => 1.00000, 2 => 0.99000, 3 => 1.00000, 4 => 0.98015,
    5 => 0.90000, 6 => 0.99510, 7 => 0.98956, 8 => 0.89060,
    9 => 0.98100, 10 => 0.88290, 11 => 0.97734, 12 => 0.97457,
    13 => 1.00000, 14 => 0.97946, 15 => 0.98498, 16 => 0.98539
)

println("| Node | Expected | Actual   | Match |")
println("|------|----------|----------|-------|")
for node in sort(collect(keys(expected)))
    actual = output[node]
    match = abs(actual - expected[node]) < 1e-4
    println("| $node    | $(expected[node])  | $(round(actual, digits=5)) | $match |")
end