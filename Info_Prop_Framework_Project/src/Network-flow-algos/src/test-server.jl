# Quick test script to check if the server starts without errors
println("Testing server startup...")

try
    include("framework-server-v2.jl")
    println("✅ Server files loaded successfully!")
    println("You can now start the server with: julia framework-server-v2.jl")
catch e
    println("❌ Error loading server: $e")
    for (exc, bt) in Base.catch_stack()
        showerror(stdout, exc, bt)
        println()
    end
end