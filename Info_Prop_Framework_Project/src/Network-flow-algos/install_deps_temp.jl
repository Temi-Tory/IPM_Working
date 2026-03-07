using Pkg

# Activate the current project
Pkg.activate(".")

# Add missing dependencies to Project.toml
Pkg.add("Combinatorics")
Pkg.add("ProbabilityBoundsAnalysis")
Pkg.add("Graphs")
Pkg.add("GraphViz")

# Now instantiate to ensure all dependencies are correctly installed
Pkg.instantiate()

# Resolve any version conflicts
Pkg.resolve()

println("✅ All dependencies installed successfully!")
