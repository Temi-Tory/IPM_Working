# Interactive Drone Network Visualization

This directory contains scripts for creating interactive visualizations of drone network data using PlotlyJS.jl.

## Files Overview

- **`InteractiveDronePlot.jl`** - Main interactive plotting script
- **`DroneIDetailedCheck.jl`** - Data loading and analysis functions (dependency)
- **`test_interactive_plot.jl`** - Test script to verify functionality
- **`README_InteractivePlot.md`** - This documentation file

## Features

### 🎨 Interactive Visualizations
- **Geographic Positioning**: Nodes positioned using east/north coordinates
- **Color-Coded Node Types**: 
  - 🏥 Red Cross: Hospitals
  - ✈️ Blue Diamond: Airports
  - 🔺 Green Triangle Up: Source nodes
  - 🔻 Orange Triangle Down: Receiver nodes
  - ⭐ Purple Star: Hub nodes
  - ⚫ Gray Circle: Generic locations
- **Edge Visualization**: Connection weights shown through line opacity
- **Interactive Features**: Hover information, zoom, pan, legend

### 📊 Network Analysis Overlays
- **Node Sizing**: Based on connectivity (more connections = larger nodes)
- **Network Statistics**: Real-time display of network metrics
- **Comparative Analysis**: Side-by-side drone network comparison
- **Critical Path Highlighting**: Identification of important nodes and connections

## Prerequisites

### Required Julia Packages
```julia
using Pkg
Pkg.add(["PlotlyJS", "Colors", "Statistics", "CSV", "DataFrames", "DelimitedFiles"])
```

### Required Data Files
The following files must be present in `src/Network-flow-algos/test/drone network/`:
- `nodes.csv` - Node information with coordinates and classifications
- `feasible_drone_1.csv` - High-capability drone connection matrix
- `feasible_drone_2.csv` - Low-capability drone connection matrix

## Quick Start

### 1. Test Installation
```julia
# Run the test script to verify everything is set up correctly
include("test_interactive_plot.jl")
```

### 2. Create Interactive Plots
```julia
# Include the plotting script
include("InteractiveDronePlot.jl")

# Create plots with default settings
plots_and_analysis = create_drone_network_plots()
```

### 3. View Results
The script generates:
- `drone1_network_interactive.html` - Drone 1 visualization
- `drone2_network_interactive.html` - Drone 2 visualization  
- `drone_network_analysis_summary.md` - Analysis report

## Advanced Usage

### Custom Parameters
```julia
# Create plots with custom settings
plots_and_analysis = create_drone_network_plots(
    nodes_file = "path/to/nodes.csv",
    drone1_file = "path/to/drone1_matrix.csv", 
    drone2_file = "path/to/drone2_matrix.csv",
    output_dir = "custom/output/directory/",
    edge_filter_threshold = 10.0  # Only show edges with weight >= 10
)
```

### Individual Network Analysis
```julia
# Analyze just one drone network
nodes_file = "src/Network-flow-algos/test/drone network/nodes.csv"
drone1_file = "src/Network-flow-algos/test/drone network/feasible_drone_1.csv"

# Load data
nodes, edges = read_graph_data(nodes_file, drone1_file)
adj_list = create_adjacency_list(nodes, edges)
nodes_dict = create_nodes_dict(nodes)

# Create single plot
plot = create_interactive_plot(
    nodes_dict, edges, convert_adjacency_format(adj_list),
    "Custom Drone Network Analysis"
)

# Save plot
PlotlyJS.savefig(plot, "custom_drone_plot.html")
```

## Understanding the Visualizations

### Node Information
Hover over any node to see:
- **Node ID**: Unique identifier
- **Location**: Descriptive location name
- **Type**: Node classification (hospital, airport, etc.)
- **Role**: Source, receiver, or generic
- **Coordinates**: Latitude/longitude and east/north
- **Connections**: Number of outgoing connections
- **Average Weight**: Mean connection cost/distance

### Network Statistics Panel
The right panel shows:
- **Total Nodes/Edges**: Network size metrics
- **Average Degree**: Mean connections per node
- **Maximum Degree**: Highest connected node
- **Average Weight**: Mean connection cost
- **Node Type Breakdown**: Count by classification

### Interactive Controls
- **Zoom**: Mouse wheel or zoom controls
- **Pan**: Click and drag to move around
- **Legend**: Click items to show/hide node types
- **Hover**: Mouse over elements for detailed information

## Troubleshooting

### Common Issues

1. **Missing Packages**
   ```julia
   # Install missing packages
   using Pkg
   Pkg.add("PlotlyJS")  # Replace with missing package name
   ```

2. **Data File Not Found**
   - Verify file paths are correct
   - Check that CSV files exist in the specified directory
   - Ensure proper file permissions

3. **Memory Issues with Large Networks**
   ```julia
   # Use edge filtering to reduce complexity
   create_drone_network_plots(edge_filter_threshold = 50.0)
   ```

4. **Plot Not Displaying**
   - Plots are saved as HTML files regardless of display issues
   - Open the generated HTML files directly in a web browser
   - Check that PlotlyJS backend is properly configured

### Performance Tips

- **Large Networks**: Use `edge_filter_threshold` to show only important connections
- **Memory Usage**: Close other Julia processes before running large analyses
- **File Size**: Generated HTML files can be large; consider hosting on a web server for sharing

## Output Files

### Interactive HTML Files
- **Self-contained**: No external dependencies required
- **Web Browser Compatible**: Works in any modern browser
- **Responsive**: Adapts to different screen sizes
- **Shareable**: Can be easily distributed or hosted online

### Analysis Summary
The generated Markdown summary includes:
- Network statistics comparison
- Node classification breakdown
- Coverage analysis
- Strategic recommendations
- Visualization guide

## Integration with Existing Workflow

This visualization tool is designed to work seamlessly with the existing drone network analysis pipeline:

1. **Data Loading**: Uses existing `read_nodes()` and `read_weight_matrix()` functions
2. **Analysis**: Leverages `comprehensive_drone_analysis()` for insights
3. **Compatibility**: Works with the same CSV format as other analysis tools
4. **Extensibility**: Easy to modify for additional network types or metrics

## Customization

### Adding New Node Types
```julia
# Modify the NODE_COLORS and NODE_SYMBOLS dictionaries
const NODE_COLORS = Dict(
    "hospital" => "red",
    "airport" => "blue",
    "your_new_type" => "purple",  # Add new type
    # ... existing types
)
```

### Custom Color Schemes
```julia
# Define your own color palette
custom_colors = Dict(
    "hospital" => "#FF6B6B",    # Custom red
    "airport" => "#4ECDC4",     # Custom teal
    # ... other colors
)
```

### Additional Metrics
The plotting functions can be extended to include:
- Centrality measures
- Community detection results
- Temporal analysis
- Risk assessments
- Cost optimization results

## Support

For issues or questions:
1. Check this README for common solutions
2. Run `test_interactive_plot.jl` to diagnose problems
3. Verify all dependencies are properly installed
4. Check that data files are in the correct format and location

## Version History

- **v1.0**: Initial release with basic interactive plotting
- Features: Node classification, edge visualization, hover information
- Outputs: HTML files and analysis summary

---

*Generated as part of the Information Propagation Framework Project*