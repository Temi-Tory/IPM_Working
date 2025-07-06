#!/usr/bin/env julia

"""
Start the Clean Modular Server on Port 9090

This script starts the new modular Information Propagation Analysis Framework Server
on port 9090 (different from the old server which uses 8080).

Usage:
    julia start-clean-server.jl              # Start on default port 9090
    julia start-clean-server.jl 8080         # Start on custom port 8080
    julia start-clean-server.jl 8080 0.0.0.0 # Start on custom port and host
"""

println("🚀 Starting Clean Modular Server (Port 9090)")
println("📦 This is the NEW modular architecture server")
println("🔄 Old server runs on port 8080, this runs on port 9090")
println("")

# Include and start the new server
include("framework-server-v2.jl")

 start_server()   