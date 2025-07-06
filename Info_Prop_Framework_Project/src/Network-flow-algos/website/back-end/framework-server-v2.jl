"""
framework-server-v2.jl

Clean, modular Information Propagation Analysis Framework Server (Version 2.0)
Replaces the monolithic 1075-line framework-server.jl with a clean, maintainable architecture.

Features:
- 6 specialized API endpoints with strict typing
- Clean separation of concerns
- TypeScript-compatible JSON responses
- Comprehensive parameter override system
- Monte Carlo validation
- Path enumeration analysis
- Diamond structure classification
- Modular, testable architecture

Endpoints:
- POST /api/processinput        - Network structure processing
- POST /api/diamondprocessing   - Diamond structure identification  
- POST /api/diamondclassification - Diamond classification analysis
- POST /api/reachabilitymodule  - Reachability analysis with belief propagation
- POST /api/pathenum            - Path enumeration between nodes
- POST /api/montecarlo          - Monte Carlo validation analysis
"""

using HTTP, JSON

# Add framework imports for compatibility
using DataFrames, DelimitedFiles, Distributions, 
    DataStructures, SparseArrays, BenchmarkTools, 
    Combinatorics, Random

# Include IPAFramework
include("../../src/IPAFramework.jl")
using .IPAFramework
using Graphs

println("✅ IPAFramework loaded for modular server v2.0!")

# Include the modular server architecture
include(joinpath(@__DIR__, "server", "ServerCore.jl"))
using .ServerCore

# Export main functions for REPL use
export main, start_server

"""
    main()

Main entry point for the server application.
"""
function main()
    println("🚀 Information Propagation Analysis Framework Server v2.0")
    println("📦 Modular Architecture - Clean Separation of Concerns")
    println("🎯 6 Specialized Endpoints with TypeScript Compatibility")
    println("")
    
    # Default server configuration
    host = "127.0.0.1"  # localhost only for security
    port = 9090
    
    # Check for command line arguments (optional)
    if length(ARGS) >= 1
        try
            port = parse(Int, ARGS[1])
            println("🔧 Using custom port: $port")
        catch
            println("⚠️ Invalid port argument, using default: $port")
        end
    end
    
    if length(ARGS) >= 2
        host = ARGS[2]
        println("🔧 Using custom host: $host")
    end
    
    # Start the server
    try
        start_server(host, port)
    catch e
        println("❌ Server failed to start: $e")
        exit(1)
    end
end

# Auto-start server when script is run directly
if abspath(PROGRAM_FILE) == @__FILE__
    main()
else
    # When included in REPL, provide instructions
    println("📋 Server loaded! To start the server, run:")
    println("   julia> main()                    # Start on default port 9090")
    println("   julia> start_server()            # Start on default port 9090")
    println("   julia> start_server(\"127.0.0.1\", 8080)  # Start on custom port")
    println("")
    println("🚀 Or run directly from command line:")
    println("   julia framework-server-v2.jl")
end