Continental Medical Network DAG

  Overview

  The Continental Medical Network DAG is a directed acyclic graph     
  representing emergency medical transport connections across Scotland
   and Northern England. This network models feasible helicopter/VTOL 
  routes between healthcare facilities, airports, and strategic
  waypoints for critical patient transport and medical supply
  delivery.

  Network Composition

  Node Types (244 total)

  - H Nodes (215): Healthcare facilities including:
    - Major trauma centers (e.g., Queen Elizabeth University Hospital,     
   Aberdeen Royal Infirmary)
    - Regional hospitals (e.g., University Hospital Crosshouse,
  Borders General Hospital)
    - Specialty facilities (e.g., Raigmore Hospital, Western Isles
  Hospital)
    - Community hospitals and clinics
  - A Nodes (18): Established airports providing aviation
  infrastructure:
    - International airports (Glasgow International, Edinburgh,
  Aberdeen Dyce)
    - Regional airports (Inverness, Stornoway, Kirkwall)
    - Smaller airfields (Campbeltown, Islay, Tiree)
  - New Nodes (11): Strategic network enhancements:
    - Proposed facilities (nodes 41, 44, 47, 49, 53, 77, 83)
    - Additional airport coverage (Fair Isle Airport, Arbroath
  Airport, North Ronaldsay Airport)
    - Routing waypoints to improve connectivity

  Geographic Coverage

  - Latitude Range: 54.83° to 60.15° N (Southern Scotland to Shetland      
  Islands)
  - Longitude Range: -7.50° to -1.15° W (Western Isles to North Sea        
  coast)
  - Coverage Area: Complete Scotland, Northern England, offshore
  islands

  Connectivity Properties

  - Total Edges: 366 directed connections
  - Edge Density: Based on VTOL helicopter feasibility analysis
  - Connection Type: Unidirectional paths representing optimal routing     
  - Derived From: Real-world distance matrices with 12,054 feasible        
  routes (20.2% of all possible connections)

  Network Architecture

  Hub Structure

  - Major Hubs (nodes 1-50): High out-degree nodes serving as primary      
  distribution points
  - Regional Centers (nodes 51-150): Medium connectivity serving
  specific geographic areas
  - Terminal Facilities (nodes 151-244): Lower connectivity endpoints      
  providing final delivery

  Information Flow Pattern

  The DAG follows a hierarchical structure where:
  1. Information/resources originate at major medical centers and
  airports
  2. Flow through regional hubs and strategic waypoints
  3. Terminate at community hospitals and remote facilities

  Use Case Applications

  Reliability Algorithm Testing

  This DAG provides an excellent test case for reliability algorithms      
  due to:
  - Real-world basis: Actual healthcare infrastructure with genuine        
  operational constraints
  - Geographic correlation: Node failures follow realistic geographic      
  patterns
  - Multi-modal transport: Integration of medical facilities and
  aviation infrastructure
  - Critical infrastructure: Life-safety applications where
  reliability is paramount

  Failure Scenarios

  - Natural disasters: Regional outages due to storms, floods, or
  severe weather
  - Capacity constraints: Hospital overload during emergencies
  - Transport disruption: Airport closures, aircraft maintenance, crew     
   availability
  - Cascading failures: How single-point failures propagate through        
  the network

  Network Analysis Opportunities

  - Coverage optimization: Identifying gaps in medical transport
  accessibility
  - Redundancy evaluation: Alternative routing when primary paths fail     
  - Investment prioritization: Which "new" nodes provide maximum
  reliability improvement
  - Emergency response: Optimal resource allocation during crisis
  scenarios

  Data Sources

  - Base Network: Scottish healthcare facilities and airports with
  geographic coordinates
  - Connectivity Matrix: VTOL helicopter feasibility analysis
  (drone1.csv)
  - Distance Calculations: Real-world routing with operational
  constraints
  - Node Metadata: Facility types, capacity indicators, and geographic     
   groupings

  Technical Specifications

  - Format: CSV edge list (source, destination)
  - Node IDs: Integer identifiers (1-244) corresponding to facilities      
  - Validation: Confirmed DAG structure with no cycles
  - Scale: Medium-sized network suitable for algorithm development and     
   testing

  This DAG represents a comprehensive, realistic network for studying      
  reliability, routing optimization, and emergency response in
  critical healthcare infrastructure.