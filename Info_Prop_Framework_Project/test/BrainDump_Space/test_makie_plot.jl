# Test script for InteractiveDronePlotMakie.jl
# This script tests the Makie-based interactive plotting functionality

println("🧪 Testing Interactive Drone Network Plotting with Makie.jl")
println("="^60)

# Check if required packages are available
required_packages = ["GLMakie", "GraphMakie", "Graphs", "Colors", "Statistics", "CSV", "DataFrames", "DelimitedFiles", "Dates"]
missing_packages = String[]

for pkg in required_packages
    try
        eval(Meta.parse("using $pkg"))
        println("✅ $pkg - Available")
    catch e
        println("❌ $pkg - Missing")
        push!(missing_packages, pkg)
    end
end

if !isempty(missing_packages)
    println("\n⚠️  Missing packages detected!")
    println("Please install the following packages:")
    for pkg in missing_packages
        println("   using Pkg; Pkg.add(\"$pkg\")")
    end
    println("\nOr install all at once:")
    pkg_list = join(["\"$pkg\"" for pkg in missing_packages], ", ")
    println("   using Pkg; Pkg.add([$pkg_list])")
    exit(1)
end

# Test data file existence
println("\n📁 Checking data files...")
data_files = [
    "src/Network-flow-algos/test/drone network/nodes.csv",
    "src/Network-flow-algos/test/drone network/feasible_drone_1.csv", 
    "src/Network-flow-algos/test/drone network/feasible_drone_2.csv"
]

all_files_exist = true
for file in data_files
    if isfile(file)
        println("✅ $file - Found")
    else
        println("❌ $file - Missing")
        all_files_exist = false
    end
end

if !all_files_exist
    println("\n⚠️  Some data files are missing!")
    println("Please ensure the drone network data files are in the correct location.")
    exit(1)
end

# Test the DroneIDetailedCheck.jl inclusion
println("\n🔗 Testing DroneIDetailedCheck.jl inclusion...")
try
    include("DroneIDetailedCheck.jl")
    println("✅ DroneIDetailedCheck.jl - Successfully included")
catch e
    println("❌ DroneIDetailedCheck.jl - Failed to include: $e")
    exit(1)
end

# Test the InteractiveDronePlotMakie.jl inclusion
println("\n🎨 Testing InteractiveDronePlotMakie.jl inclusion...")
try
    include("InteractiveDronePlotMakie.jl")
    println("✅ InteractiveDronePlotMakie.jl - Successfully included")
catch e
    println("❌ InteractiveDronePlotMakie.jl - Failed to include: $e")
    println("Error details: $e")
    exit(1)
end

# Test basic functionality
println("\n🚀 Testing Makie plotting functionality...")
try
    println("Creating interactive Makie plots...")
    
    # This will run the full analysis and create interactive plots
    fig1, fig2, analysis_results = create_drone_network_makie_plots()
    
    println("✅ Interactive Makie plots created successfully!")
    println("📊 Analysis completed!")
    
    println("\n🎯 Instructions:")
    println("   1. Two interactive windows should have opened")
    println("   2. Click and drag any node to move it around")
    println("   3. Watch how edges automatically follow the nodes")
    println("   4. Use mouse wheel to zoom in/out")
    println("   5. Right-click and drag to pan the view")
    println("   6. Close the windows when you're done exploring")
    
    println("\n📈 Network Analysis Results:")
    println("   - Nodes analyzed: $(length(analysis_results["nodes_dict"]))")
    println("   - Drone 1 edges: $(length([e for (_, neighbors) in analysis_results["drone1_adj"] for (_, _) in neighbors]))")
    println("   - Drone 2 edges: $(length([e for (_, neighbors) in analysis_results["drone2_adj"] for (_, _) in neighbors]))")
    
catch e
    println("❌ Makie plotting test failed: $e")
    println("\n🔧 Debugging information:")
    println("   Error type: $(typeof(e))")
    if isa(e, LoadError)
        println("   Load error in file: $(e.file)")
        println("   At line: $(e.line)")
    end
    rethrow(e)
end

println("\n🎉 All Makie tests completed successfully!")
println("The interactive plots should be displayed in separate windows.")
println("You can now drag nodes around and see the edges follow them in real-time!")