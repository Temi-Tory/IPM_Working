# Interactive Drone Network Visualization with Draggable Nodes

This directory contains two different approaches for creating interactive drone network visualizations with draggable nodes where edges automatically follow the nodes as they move.

## 🎯 **The Problem with PlotlyJS**

The original [`InteractiveDronePlot.jl`](InteractiveDronePlot.jl) using PlotlyJS had a fundamental limitation:
- **Nodes could be moved** but **edges remained static**
- This defeats the purpose of interactive network manipulation
- PlotlyJS is designed for statistical plots, not dynamic network graphs

## ✅ **The Solution: Makie.jl + GraphMakie.jl**

The new [`InteractiveDronePlotMakie.jl`](InteractiveDronePlotMakie.jl) provides true interactive network visualization:
- **Nodes can be dragged** and **edges automatically follow**
- Built specifically for network/graph visualization
- Real-time updates with smooth interactions
- Better performance for network manipulation

## 📁 **Files Overview**

### **Main Scripts**
- [`InteractiveDronePlot.jl`](InteractiveDronePlot.jl) - Original PlotlyJS version (static edges)
- [`InteractiveDronePlotMakie.jl`](InteractiveDronePlotMakie.jl) - **New Makie version (dynamic edges)** ⭐

### **Test Scripts**
- [`test_interactive_plot.jl`](test_interactive_plot.jl) - Tests PlotlyJS version
- [`test_makie_plot.jl`](test_makie_plot.jl) - **Tests Makie version** ⭐

### **Dependencies**
- [`DroneIDetailedCheck.jl`](DroneIDetailedCheck.jl) - Core analysis functions (shared by both)

## 🚀 **Quick Start with Makie (Recommended)**

### **1. Install Required Packages**
```julia
using Pkg
Pkg.add(["GLMakie", "GraphMakie", "Graphs", "Colors", "Statistics", "CSV", "DataFrames", "DelimitedFiles", "Dates"])
```

### **2. Run the Test Script**
```julia
# In your Julia REPL, navigate to the directory
cd("src/Network-flow-algos/test/Test_Space")

# Run the Makie test
include("test_makie_plot.jl")
```

### **3. Or Run Directly**
```julia
# Include and run the Makie version directly
include("InteractiveDronePlotMakie.jl")
fig1, fig2, analysis = create_drone_network_makie_plots()
```

## 🎮 **How to Use the Interactive Plots**

### **Makie Version (Recommended)**
1. **Drag Nodes**: Click and drag any node to reposition it
2. **Edges Follow**: Watch edges automatically update as nodes move
3. **Zoom**: Use mouse wheel to zoom in/out
4. **Pan**: Right-click and drag to pan the view
5. **Legend**: Different colors/shapes represent different node types

### **PlotlyJS Version (Limited)**
1. **Static Visualization**: Good for viewing but limited interactivity
2. **Hover Information**: Detailed node information on hover
3. **Export**: Can save as HTML files for sharing

## 🔍 **Feature Comparison**

| Feature | PlotlyJS Version | Makie Version |
|---------|------------------|---------------|
| **Draggable Nodes** | ❌ Limited | ✅ Full Support |
| **Dynamic Edges** | ❌ Static | ✅ Follow Nodes |
| **Real-time Updates** | ❌ No | ✅ Smooth |
| **Network Manipulation** | ❌ Poor | ✅ Excellent |
| **Export to HTML** | ✅ Yes | ❌ No |
| **Performance** | ⚠️ Moderate | ✅ Fast |
| **Ease of Use** | ✅ Simple | ✅ Intuitive |

## 🎨 **Visualization Features**

Both versions include:
- **Color-coded node types**: Hospitals (red), Airports (blue), Sources (green), etc.
- **Node sizing**: Based on connectivity (more connections = larger nodes)
- **Network statistics**: Node counts, edge counts, connectivity metrics
- **Hover information**: Detailed node data and connections
- **Legend**: Clear identification of node types

## 🔧 **Troubleshooting**

### **Common Issues**
1. **Missing Packages**: Run the test scripts first to check dependencies
2. **Data Files Not Found**: Ensure drone network CSV files are in correct location
3. **Display Issues**: Makie plots open in separate windows - check if they're behind other windows

### **Package Installation**
```julia
# Install all required packages at once
using Pkg
Pkg.add([
    "GLMakie", "GraphMakie", "Graphs", 
    "PlotlyJS", "Colors", "Statistics", 
    "CSV", "DataFrames", "DelimitedFiles", "Dates"
])
```

## 📊 **Data Requirements**

The scripts expect these data files:
- `src/Network-flow-algos/test/drone network/nodes.csv` - Node information
- `src/Network-flow-algos/test/drone network/feasible_drone_1.csv` - Drone 1 connections
- `src/Network-flow-algos/test/drone network/feasible_drone_2.csv` - Drone 2 connections

## 🎯 **Recommendation**

**Use the Makie version** ([`InteractiveDronePlotMakie.jl`](InteractiveDronePlotMakie.jl)) for:
- ✅ True interactive network manipulation
- ✅ Draggable nodes with dynamic edges
- ✅ Better performance and user experience
- ✅ Real-time network exploration

**Use the PlotlyJS version** ([`InteractiveDronePlot.jl`](InteractiveDronePlot.jl)) only for:
- 📄 Static HTML export requirements
- 🌐 Web-based sharing needs
- 📊 Simple visualization without interaction

---

**Created**: $(Dates.now())  
**Purpose**: Interactive drone network analysis and visualization  
**Recommendation**: Use Makie version for best interactive experience