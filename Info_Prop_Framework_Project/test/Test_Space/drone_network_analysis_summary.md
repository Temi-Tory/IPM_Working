# Drone Network Analysis Summary

## Overview
This analysis examines two drone network configurations for emergency medical supply delivery.

## Network Statistics

### Drone 1 (High Capability)
- **Total Connections**: 12054
- **Hospital Coverage**: 215 hospitals
- **Isolated Nodes**: 0

### Drone 2 (Low Capability)  
- **Total Connections**: 300
- **Hospital Coverage**: 0 hospitals
- **Isolated Nodes**: 226

## Node Classifications
- **Potential Hubs**: 99
- **Receivers**: 193
- **Hospitals**: 215
- **Airports**: 21
- **Sources**: 0
- **Generic Locations**: 36

## Key Insights

### Coverage Analysis
- **Drone 1 Exclusive Access**: 215 hospitals
- **Drone 2 Exclusive Access**: 0 hospitals  
- **Both Can Reach**: 0 hospitals

### Transfer Opportunities
- **Potential Transfer Nodes**: 18
- These nodes can serve both drone types for multi-modal routing

## Recommendations

1. **Primary Network**: Use Drone 1 for comprehensive coverage
2. **Specialized Missions**: Deploy Drone 2 for specific high-priority routes
3. **Transfer Hubs**: Implement 18 strategic transfer points
4. **Critical Nodes**: Focus on 99 identified hub locations

## Interactive Visualizations

The following interactive HTML files have been generated:
- `drone1_network_interactive.html` - Drone 1 network visualization
- `drone2_network_interactive.html` - Drone 2 network visualization

### Visualization Features
- **Node Colors**: Different colors represent node types (hospitals=red, airports=blue, etc.)
- **Node Sizes**: Size indicates connectivity (larger = more connections)
- **Edge Thickness**: Represents connection weights/costs
- **Hover Information**: Detailed node and connection data
- **Interactive Controls**: Drag nodes to reposition them, edges follow automatically
- **Draggable Nodes**: Click and drag any node to reposition it within the network

### Legend
- 🏥 **Red Cross**: Hospitals
- ✈️ **Blue Diamond**: Airports  
- 🔺 **Green Triangle Up**: Source nodes
- 🔻 **Orange Triangle Down**: Receiver nodes
- ⭐ **Purple Star**: Hub nodes
- ⚫ **Gray Circle**: Generic locations

Generated on 2025-06-26T22:55:04.758
