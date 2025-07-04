# Test script for InteractiveDronePlot.jl
# This script tests the interactive plotting functionality

println("🧪 Testing Interactive Drone Network Plotting")
println("="^50)

# Check if required packages are available
required_packages = ["PlotlyJS", "Colors", "Statistics", "CSV", "DataFrames", "DelimitedFiles","Dates"]
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

# Test the InteractiveDronePlot.jl inclusion
println("\n🎨 Testing InteractiveDronePlot.jl inclusion...")
try
    include("InteractiveDronePlot.jl")
    println("✅ InteractiveDronePlot.jl - Successfully included")
catch e
    println("❌ InteractiveDronePlot.jl - Failed to include: $e")
    println("Error details: $e")
    exit(1)
end

# Test basic functionality
println("\n🚀 Testing basic plotting functionality...")
try
    # Test with a small subset first
    println("Creating test plots...")
    
    # This will run the full analysis and create plots
    plots_and_analysis = create_drone_network_plots()
    
    println("✅ Interactive plots created successfully!")
    println("📊 Analysis completed!")
    
    # Check if output files were created
    output_files = [
        "src/Network-flow-algos/test/Test_Space/drone1_network_interactive.html",
        "src/Network-flow-algos/test/Test_Space/drone2_network_interactive.html",
        "src/Network-flow-algos/test/Test_Space/drone_network_analysis_summary.md"
    ]
    
    println("\n📁 Checking output files...")
    for file in output_files
        if isfile(file)
            println("✅ $file - Created")
        else
            println("⚠️  $file - Not found")
        end
    end
    
catch e
    println("❌ Plotting test failed: $e")
    println("\n🔧 Debugging information:")
    println("   Error type: $(typeof(e))")
    if isa(e, LoadError)
        println("   Load error in file: $(e.file)")
        println("   At line: $(e.line)")
    end
    rethrow(e)
end

println("\n🎉 All tests completed successfully!")
println("You can now open the generated HTML files in your web browser to view the interactive plots.")