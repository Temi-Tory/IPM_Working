# Scottish Medical Drone Network - DAG Conversion Documentation

## Source Data

### Original Network 
- **Network**: 244 nodes across Scotland (hospitals, airports, intermediate stations)
- **Coverage**: 14 health board regions, including remote islands

### Network Files Used
- `nodes.csv`: 244 network locations with coordinates, types, and infrastructure
- `drone1.csv`: 244×244 distance/time matrix for VTOL drones (70km range)
- `drone2.csv`: 244×244 distance/time matrix for fixed-wing drones (700km range)

### Multiplex Network Structure
The generated DAGs use a **multiplex (multi-layer) network** approach:
- **VTOL Layer**: 6,027 edges with 70km effective range (local connectivity)
- **Fixed-Wing Layer**: 139 edges with 700km effective range (long-distance/island connectivity)
- **Total Edges**: 6,166 unique edges combining both layers
- **Edge Probability**: For overlapping connections, the maximum probability is used (best connection wins)

## DAG Conversion Methodology

### 1. Network Structure Creation

#### Node Types (from original data)
- **SOURCE-RECEIVER**: Major hospital hubs (can send/receive)
- **RECEIVER**: Standard hospitals (receive only in original context)
- **GENERIC**: Airports and intermediate infrastructure

#### DAG Edge Creation (Multiplex Approach)
- **Input**: Distance/time matrices from BOTH drone types (VTOL + fixed-wing)
- **Constraint**: DAG ordering imposed by latitude (North → South)
- **Layer 1 - VTOL**: Connections within 70km range (local/regional)
- **Layer 2 - Fixed-Wing**: Connections within 700km range (long-distance/islands)
- **Edge Merging**: When both drone types can make a connection, use maximum probability
- **Edge Direction**: Based on geographic ordering to ensure acyclic property

### 2. Node Prior Probability Assignment

#### DAG Source Identification
```julia
# True DAG sources = nodes with NO incoming edges
sources = nodes_that_never_appear_as_destinations
```

#### Prior Probability Rules
1. **DAG Sources**: `prior = 1.0` (signal originators)
2. **All Other Nodes**: Based on infrastructure reliability model:

```julia
base_prior = {
    SOURCE-RECEIVER: 0.9  # Major hospital hubs
    RECEIVER: 0.8         # Standard hospitals
    GENERIC: 0.6          # Infrastructure nodes
}

infrastructure_bonus = CS_type * 0.02 + DP_type * 0.02
final_prior = clamp(base_prior + infrastructure_bonus, 0.5, 0.95)
```

### 3. Edge Probability Assignment

#### Distance-to-Probability Conversion (Per Layer)
```julia
# Exponential decay model based on drone reliability (applied per layer)
# VTOL layer
probability_vtol = exp(-distance / 70000.0)

# Fixed-wing layer
probability_fixed_wing = exp(-distance / 700000.0)

# Final probability for merged edge
probability_final = clamp(max(prob_vtol, prob_fixed_wing), 0.01, 0.99)
```

- **Distance**: Flight time in seconds from drone matrices
- **VTOL Max Range**: 70,000 seconds equivalent (short-range, high reliability)
- **Fixed-Wing Max Range**: 700,000 seconds equivalent (long-range, lower reliability per distance)
- **Merging Rule**: Take maximum probability when both layers provide connection
- **Rationale**: Longer flights have higher failure probability; best available connection determines edge reliability

## Generated Network Types

### 1. Full Network (`drone-network-full`)
- **Nodes**: 244 (all locations)
- **Edges**: 6,166 (6,027 VTOL + 139 fixed-wing)
- **DAG Sources**: 5 nodes (northernmost locations with no incoming edges)
- **Structure**: Full multiplex network with both local and long-distance connectivity
- **Purpose**: Complete network topology for large-scale algorithm testing

### 2. Local Health Board Missions (`HB0_local_*`)
- **Pattern**: Hub → local hospital within same health board
- **Nodes**: 17-34
- **Edges**: 135-560 (multiplex: VTOL-dominated, some fixed-wing connections)
- **DAG Sources**: 1 (the hub)
- **Connectivity**: Primarily VTOL layer due to local distances
- **Examples**:
  - `HB0_local_1`: Queen Margaret Hospital → Arran War Memorial Hospital (17 nodes, 135 edges)
  - `HB0_local_2`: Queen Margaret Hospital → Ayrshire Central Hospital (34 nodes, 560 edges)

### 3. Regional Missions (`central_scotland_*`, `glasgow_area`, `edinburgh_area`)
- **Pattern**: Hub → nearby hub in connected region
- **Nodes**: 48-79
- **Edges**: 1,099-2,624 (multiplex: VTOL + fixed-wing for longer spans)
- **DAG Sources**: 1 (originating hub)
- **Connectivity**: Both layers active, fixed-wing provides long-distance shortcuts
- **Examples**:
  - `central_scotland_1`: Queen Margaret Hospital → Glasgow Royal Infirmary (48 nodes, 1,099 edges)
  - `central_scotland_2`: Glasgow Royal Infirmary → Gartnavel Royal Hospital (73 nodes, 2,470 edges)
  - `glasgow_area`: Queen Elizabeth University Hospital → Royal Alexandra Hospital (72 nodes, 2,356 edges)

### 4. Network Complexity Scaling
```
Small:    17-34 nodes,     135-560 edges     (Local missions - VTOL-dominated)
Medium:   48-79 nodes,   1,099-2,624 edges   (Regional missions - multiplex)
Large:    244 nodes,       6,166 edges       (Full network - full multiplex)
```

## Mission Selection Rationale

### Geographic Realism
- **Local Missions**: Within-region medical supply (typical operations, primarily VTOL)
- **Regional Missions**: Inter-hub transfers (emergency/specialized supplies, multiplex routing)
- **Full Network**: Complete topology (algorithm stress testing, full connectivity)

### Connectivity Requirements
- Missions include all reachable nodes via EITHER drone type
- DAG structure maintained through geographic ordering
- Realistic flight ranges respected:
  - VTOL: 70km range (local connectivity backbone)
  - Fixed-wing: 700km range (long-distance/island connections)
- Fixed-wing layer critical for island connectivity (e.g., Orkney, Shetland, Hebrides)

## File Format Specification

### Directory Structure
```
dag_ntwrk_files/
├── drone-network-full/
│   ├── drone-network-full.EDGES
│   └── float/
│       ├── drone-network-full-nodepriors.json
│       └── drone-network-full-linkprobabilities.json
├── HB0_local_1/
│   ├── HB0_local_1.EDGES
│   └── float/
│       ├── HB0_local_1-nodepriors.json
│       └── HB0_local_1-linkprobabilities.json
└── [other missions...]
```

### File Formats

#### `.EDGES` File
```csv
source,destination
135,148
135,149
...
```

#### Node Priors JSON
```json
{
  "nodes": {
    "135": 1.0,    // DAG source
    "148": 0.95,   // Hub with incoming edges
    "149": 0.86    // Standard node
  },
  "data_type": "Float64",
  "serialization": "compact",
  "description": "Node prior probabilities for [network] network"
}
```

#### Link Probabilities JSON
```json
{
  "links": {
    "(135,148)": 0.87,  // Max of VTOL/fixed-wing probability
    "(135,149)": 0.92,  // Best available connection
    ...
  },
  "data_type": "Float64",
  "serialization": "compact",
  "description": "Link/edge probabilities for [network] network"
}
```

**Note**: Link probabilities reflect the best available connection between nodes. For edges where both VTOL and fixed-wing drones can connect, the maximum probability (most reliable connection) is used.

## Signal Propagation Interpretation

### Algorithm Context
These DAGs are designed for testing signal propagation algorithms that compute:
```
P(node receives signal) = Prior(node) × P(receives ≥1 signal from sources | network)
```

### Network Semantics
- **Signal Sources**: True DAG sources (geographic edge nodes with no incoming connections)
- **Signal Flow**: Following DAG edges (North → South geographic flow)
- **Node Reception**: Based on infrastructure reliability (priors)
- **Edge Transmission**: Based on best available drone connection (multiplex link probabilities)
- **Multiplex Benefit**: Fixed-wing layer provides alternative long-distance paths that may have higher reliability than multi-hop VTOL routes

## Usage for Algorithm Testing

### Test Cases Available
1. **Scalability Testing**: Small (17 nodes) → Medium (79 nodes) → Large (244 nodes)
2. **Topology Complexity**: Sparse local → Dense regional → Full multiplex network
3. **Source Distribution**: Single source (missions) → Multiple sources (full network: 5 sources)
4. **Real-world Validation**: Based on actual Scottish medical infrastructure network
5. **Multiplex Routing**: VTOL-only paths vs. fixed-wing shortcuts vs. hybrid routes

### Performance Benchmarking
- **Small Networks** (17-34 nodes): Correctness verification, VTOL-dominated connectivity
- **Medium Networks** (48-79 nodes): Performance profiling, multiplex path diversity
- **Large Networks** (244 nodes): Scalability demonstration, full multiplex complexity
- **Multiple Networks**: Consistency testing across mission scenarios
- **Layer Analysis**: Compare signal propagation with/without fixed-wing layer

## Technical Notes

### DAG Property Enforcement
- Geographic ordering ensures acyclicity
- North-to-South edge direction based on latitude
- No cycles possible due to strict ordering constraint

### Probability Bounds
- Node priors: [0.5, 1.0] (sources = 1.0, others < 1.0)
- Edge probabilities: [0.01, 0.99] (avoid numerical issues)

### Coordinate Reference
- Original coordinates in WGS84 (latitude/longitude)
- Scotland geographic bounds: ~55°N-60°N, ~8°W-1°W

### Multiplex Network Design
- **Implementation**: Single merged DAG with combined connectivity from both drone types
- **Not Implemented**: Separate layer files (merged approach used for simplicity)
- **Rationale**: Signal propagation algorithm needs unified topology; best connection wins
- **Paper Comparison**: Original paper uses A* pathfinding to optimize sparse routes (~30-50 edges per mission). Our approach provides FULL network connectivity for signal propagation testing, not optimized delivery routes.

---

*Generated from Scottish medical drone network data for signal propagation algorithm testing.*
*Multiplex network structure (VTOL + fixed-wing) represents complete infrastructure connectivity.*
*For questions about the original network study, refer to the source paper by Jones et al.*