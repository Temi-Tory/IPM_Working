🚀 Starting comprehensive analysis...
🚁🚁🚁 COMPREHENSIVE DRONE NETWORK ANALYSIS 🚁🚁🚁
================================================================================
Loading drone 1 data...
Reading nodes from: src/Network-flow-algos/test/drone network/nodes.csv
Loaded 244 rows with columns: ["numberID", "east", "nort", "lat", "lon", "uprn", "city_type", "source_receiver_type", "info", "CS_type", "DP_type", "group_1", "group_2"]
Loaded 244 nodes

=== Data Consistency Check ===
Number of nodes: 244
Matrix dimensions: 244 × 244
Node IDs: min=1, max=289
Unique node IDs: 244
✓ All node IDs are unique
✓ Matrix size (244 × 244) matches node count (244)

Reading weight matrix from: src/Network-flow-algos/test/drone network/feasible_drone_1.csv
Matrix file dimensions: 245 × 244 (including header)
Data matrix size: 244 × 244
Found 12054 valid edges
Mapped 12054 edges to node IDs

=== Matrix-Node Mapping Check ===
Nodes in node list: 244
Unique node IDs referenced in edges: 244
✓ All edge nodes exist in node list
✓ All nodes are referenced in edges

Matrix index → Node ID mapping (first 10):
   Matrix index 1 → Node ID 1
   Matrix index 2 → Node ID 2
   Matrix index 3 → Node ID 6
   Matrix index 4 → Node ID 10
   Matrix index 5 → Node ID 15
   Matrix index 6 → Node ID 16
   Matrix index 7 → Node ID 18
   Matrix index 8 → Node ID 20
   Matrix index 9 → Node ID 21
   Matrix index 10 → Node ID 22
   ...
   Matrix index 242 → Node ID 287
   Matrix index 243 → Node ID 288
   Matrix index 244 → Node ID 289

Loading drone 2 data...
Reading nodes from: src/Network-flow-algos/test/drone network/nodes.csv
Loaded 244 rows with columns: ["numberID", "east", "nort", "lat", "lon", "uprn", "city_type", "source_receiver_type", "info", "CS_type", "DP_type", "group_1", "group_2"]
Loaded 244 nodes

=== Data Consistency Check ===
Number of nodes: 244
Matrix dimensions: 244 × 244
Node IDs: min=1, max=289
Unique node IDs: 244
✓ All node IDs are unique
✓ Matrix size (244 × 244) matches node count (244)

Reading weight matrix from: src/Network-flow-algos/test/drone network/feasible_drone_2.csv
Matrix file dimensions: 245 × 244 (including header)
Data matrix size: 244 × 244
Found 300 valid edges
Mapped 300 edges to node IDs

=== Matrix-Node Mapping Check ===
Nodes in node list: 244
Unique node IDs referenced in edges: 18
✓ All edge nodes exist in node list
⚠️  Nodes never referenced in edges (226 nodes):
   First 10 unreferenced node IDs: [110, 220, 6, 234, 215, 219, 73, 272, 182, 164]

Matrix index → Node ID mapping (first 10):
   Matrix index 1 → Node ID 1
   Matrix index 2 → Node ID 2
   Matrix index 3 → Node ID 6
   Matrix index 4 → Node ID 10
   Matrix index 5 → Node ID 15
   Matrix index 6 → Node ID 16
   Matrix index 7 → Node ID 18
   Matrix index 8 → Node ID 20
   Matrix index 9 → Node ID 21
   Matrix index 10 → Node ID 22
   ...
   Matrix index 242 → Node ID 287
   Matrix index 243 → Node ID 288
   Matrix index 244 → Node ID 289

================================================================================
📍 NODE ROLE CLASSIFICATION
==============================
  POTENTIAL_HUBS: 99
  RECEIVERS: 193
  HOSPITALS: 215
  AIRPORTS: 21
  SOURCES: 0
  GENERIC_LOCATIONS: 36

============================================================
🚁 COMPARATIVE DRONE NETWORK ANALYSIS 🚁
============================================================
=== DRONE 1 (High Capability) CONNECTIVITY ANALYSIS ===
  Nodes: 244
  edges: 12054
  Density: 0.2033
  Isolated nodes: 0
  Highly connected nodes (>90th percentile): 25
  Average weight: 1197.8
  Weight range: 1.76 - 2191.29
  Weight std dev: 630.47
  Hospital Analysis:
    Total hospitals: 215
    Connected hospitals: 215
    Hospital coverage: 100.0%

=== DRONE 2 (Low Capability) CONNECTIVITY ANALYSIS ===
  Nodes: 244
  edges: 300
  Density: 0.0051
  Isolated nodes: 226
  Highly connected nodes (>90th percentile): 18
  Average weight: 3753.11
  Weight range: 306.08 - 9977.01
  Weight std dev: 2017.15
  Hospital Analysis:
    Total hospitals: 215
    Connected hospitals: 0
    Hospital coverage: 0.0%
    Isolated hospitals: 215

=== COMPARATIVE INSIGHTS ===
  Edge ratio (Drone1:Drone2): 40.18:1
  Hospital coverage:
    Drone 1 can reach: 215 hospitals
    Drone 2 can reach: 0 hospitals
    Drone 1 only accessible: 215 hospitals
    Drone 2 only accessible: 0 hospitals
    Both can reach: 0 hospitals
  Average flight costs:
    Drone 1: 1197.8
    Drone 2: 3753.11

=== TRANSFER NODE ANALYSIS ===
  Potential transfer nodes: 18
  Top 10 transfer candidates:
    1. Node 62: Edinburgh Airport ✈️
       Drone1 connections: 117, Drone2: 17
    2. Node 21: Glasgow International Airport ✈️
       Drone1 connections: 79, Drone2: 17
    3. Node 87: Perth Airport ✈️
       Drone1 connections: 73, Drone2: 17
    4. Node 2: Glasgow Prestwick Airport ✈️
       Drone1 connections: 72, Drone2: 17
    5. Node 16: Dundee Airport ✈️
       Drone1 connections: 70, Drone2: 17
    6. Node 23: Aberdeen Dyce Airport ✈️
       Drone1 connections: 23, Drone2: 17
    7. Node 32: Campbeltown Airport ✈️
       Drone1 connections: 16, Drone2: 17
    8. Node 29: Inverness Airport ✈️
       Drone1 connections: 14, Drone2: 17
    9. Node 34: Oban  Airport ✈️
       Drone1 connections: 11, Drone2: 17
    10. Node 64: Kirkwall Airport ✈️
       Drone1 connections: 6, Drone2: 17

================================================================================
📋 SUMMARY & RECOMMENDATIONS
================================================================================
  Overall Network Performance:
    Total hospitals: 215
    Drone 1 reachable: 215 (100.0%)
    Drone 2 reachable: 0 (0.0%)

  Network Design Recommendations:
    1. Use Drone 1 for comprehensive coverage (12054 connections)
    2. Use Drone 2 for specialized missions (300 connections)
    3. Implement 18 transfer nodes for mode switching
    4. Focus on 99 hub candidates for logistics
    5. Drone 1 critical for 215 exclusive hospital connections
       - Cleland Hospital
       - Migdale Hospital
       - St Michael's Hospital

✅ Analysis completed successfully!
Dict{String, Any} with 7 entries:
  "drone1_adj"        => Dict(220=>Dict(136=>1357.69, 117=>1896.31, 234=>591.017, 145=>967.367, 219=>236.235, 233=>124.758, 251=>865.199, 164=>585.864, 153=>687.044, 253=>481.413…), 215=>Dict(47=>1012.89, 29=>1334.83, 20…  "transfer_analysis" => Dict{Any, Any}(16=>Dict{String, Any}("is_airport"=>true, "node_info"=>Node(16, 56.4525, -3.02583, 3.36778e5, 7.29387e5, 0, "Dundee Airport", "A", "GENERIC", 5, 1, 15, 13), "transfer_value"=>87, "…  "comparison"        => Dict{String, Any}("drone1_stats"=>Dict{String, Any}("isolated_nodes"=>Int64[], "hospital_connectivity"=>Dict{Any, Any}(220=>84, 215=>10, 251=>103, 115=>24, 112=>21, 185=>15, 168=>73, 207=>7, 263=…  "drone2_adj"        => Dict(220=>Dict(), 215=>Dict(), 73=>Dict(), 251=>Dict(), 115=>Dict(), 112=>Dict(), 185=>Dict(), 86=>Dict(), 168=>Dict(), 207=>Dict()…)
  "role_analysis"     => Dict("potential_hubs"=>[30, 6, 73, 272, 64, 251, 253, 267, 86, 263  …  53, 271, 47, 286, 80, 274, 246, 15, 65, 284], "receivers"=>[110, 220, 234, 215, 219, 272, 182, 164, 115, 153  …  96, 274, 14…  "nodes_dict"        => Dict{Int64, Node}(110=>Node(110, 55.8712, -2.08941, 394406.0, 664226.0, 0, "Eyemouth Day Hospital", "H", "RECEIVER", 2, 1, 2, 0), 220=>Node(220, 55.8038, -3.90594, 280549.0, 658367.0, 0, "Cleland…  "transfer_nodes"    => [23, 82, 33, 16, 31, 29, 80, 30, 64, 69, 2, 81, 32, 62, 34, 87, 21, 65]
