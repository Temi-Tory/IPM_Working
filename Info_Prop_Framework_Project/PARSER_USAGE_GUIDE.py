#!/usr/bin/env python3
"""
USAGE GUIDE: How to Parse EXPECTED_OUTPUTS.json

This file demonstrates all the different ways to analyze the test scenarios.
"""

print("""
================================================================================
PARSER USAGE GUIDE - EXPECTED_OUTPUTS.json
================================================================================

You have 3 main parser scripts available:

1. scenario_reader.jl (Julia)
   - Read markdown scenario definitions
   - Usage: julia scenario_reader.jl
   - Output: Formatted scenario summaries with config, metrics, recommendations

2. json_parser.py (Python)
   - Parse first JSON object from concatenated JSON file
   - Usage: python json_parser.py
   - Output: Basic analysis of first scenario

3. analyze_all_scenarios.py (Python) *** RECOMMENDED ***
   - Parse ALL 7 scenarios with comprehensive analysis
   - Usage: python analyze_all_scenarios.py
   - Output: Full breakdown of each scenario with metrics, bottlenecks, upgrades

================================================================================
QUICK START
================================================================================

Option A: Simple One-Liner to Check File
  python -c "import json; content = open('EXPECTED_OUTPUTS.json').read(); objs = []; 
             for line in content.strip().split('\\n'): 
               try: objs.append(json.loads(line))
               except: pass
             print(f'Found {len(objs)} JSON objects')"

Option B: Run Full Analysis
  python analyze_all_scenarios.py

Option C: Save Results to File
  python analyze_all_scenarios.py > scenario_results.txt

================================================================================
WHAT EACH PARSER SHOWS
================================================================================

scenario_reader.jl (Julia):
  - Reads: dag_ntwrk_files/water/capacity_v2_demo_pack/EXPECTED_UI_OUTPUTS.md
  - Shows: Scenario definitions, expected outputs, UI requirements
  - Best for: Understanding what SHOULD happen

analyze_all_scenarios.py (Python):
  - Reads: EXPECTED_OUTPUTS.json (all 7 scenarios)
  - Shows:
    * Max Flow & Network Utilization
    * Computation Time
    * Edge/Node Bottlenecks
    * Saturated Components
    * Utilization Ranges
    * Upgrade Priorities
    * Efficiency Loss
    * Validation Status
  - Best for: Understanding what ACTUALLY happened

json_parser.py (Python):
  - Reads: EXPECTED_OUTPUTS.json (first scenario only)
  - Shows: Summary statistics of first test case
  - Best for: Quick verification

================================================================================
DETAILED USAGE EXAMPLES
================================================================================

EXAMPLE 1: Run Full Scenario Analysis
  cd "c:\\Users\\ohian\\OneDrive - University of Strathclyde\\Documents\\Programmming Files\\Julia Files\\InformationPropagation\\Info_Prop_Framework_Project"
  python analyze_all_scenarios.py

EXAMPLE 2: View Results Interactively (PowerShell)
  python analyze_all_scenarios.py | more

EXAMPLE 3: Save to Output File
  python analyze_all_scenarios.py > analysis.txt
  Get-Content analysis.txt

EXAMPLE 4: Filter Specific Scenario (Python One-Liner)
  python -c "
  import json
  content = open('EXPECTED_OUTPUTS.json').read()
  objs = []
  for line in content.strip().split('\n'):
      try:
          obj = json.loads(line)
          if isinstance(obj, dict):
              objs.append(obj)
      except:
          pass
  
  if objs:
      s = objs[0]  # First scenario
      print(f\"Scenario 1: Max Flow = {s.get('total_max_flow')} units\")
      print(f\"Network Util = {s.get('network_utilization')*100:.2f}%\")
      print(f\"Bottleneck Type: {s.get('bottlenecks', {}).get('bottleneck_type')}\")
  "

EXAMPLE 5: Extract Specific Data (Node 11 Properties)
  python -c "
  import json
  content = open('EXPECTED_OUTPUTS.json').read()
  objs = []
  for line in content.strip().split('\n'):
      try:
          obj = json.loads(line)
          if isinstance(obj, dict):
              objs.append(obj)
      except:
          pass
  
  for i, s in enumerate(objs[:4], 1):
      if 'bottlenecks' in s and 'saturated_nodes' in s['bottlenecks']:
          sat = s['bottlenecks']['saturated_nodes']
          if 11 in sat:
              print(f\"Scenario {i}: Node 11 is SATURATED\")
  "

================================================================================
INTERPRETING THE OUTPUT
================================================================================

Key Metrics Explained:

Max Flow:
  - Maximum throughput the network can support
  - When < sum of sources: bottleneck exists

Network Utilization:
  - Percentage of total network capacity being used
  - Low (<10%): excess capacity
  - High (>70%): congestion likely

Bottleneck Type:
  - transmission: Edge capacity limited
  - node_processing: Node capacity limited  
  - mixed: Both edges and nodes constrained
  - source_limited: Sources inadequate

Saturated Nodes/Edges:
  - Components at 100% utilization
  - These limit max flow

Utilization Range:
  - (min% to max%): Shows tightness of constraints
  - Narrow range: Balanced design
  - Wide range: Some components tight, others loose

Efficiency Loss:
  - % difference between realistic and classical flow
  - Shows impact of practical constraints

Validation:
  - Checks passed / total checks
  - 11/14 = baseline passing

================================================================================
CUSTOM ANALYSIS SCRIPT TEMPLATE
================================================================================

If you want custom analysis, create a file like this:

import json

content = open('EXPECTED_OUTPUTS.json').read()
objects = []

# Extract all JSON objects
for line in content.strip().split('\\n'):
    try:
        obj = json.loads(line)
        if isinstance(obj, dict):
            objects.append(obj)
    except:
        pass

# Analyze each scenario
for i, scenario in enumerate(objects, 1):
    print(f\"\\nScenario {i}:\")
    
    # YOUR CUSTOM CODE HERE
    # Example: Extract bottleneck information
    if 'bottlenecks' in scenario:
        bn = scenario['bottlenecks']
        print(f\"  Type: {bn.get('bottleneck_type')}\")
        print(f\"  Saturated Nodes: {bn.get('saturated_nodes')}\")
        print(f\"  Saturated Edges: {len(bn.get('saturated_edges', []))} total\")

================================================================================
TROUBLESHOOTING
================================================================================

Q: Script exits with no output
  A: Try redirecting to file: python analyze_all_scenarios.py > out.txt

Q: "JSON parse error"
  A: File contains concatenated JSON objects (not NDJSON)
  B: Use analyze_all_scenarios.py which handles this format

Q: Want only certain scenarios
  A: In analyze_all_scenarios.py, modify loop:
     for i, scenario in enumerate(objects[start:end], start=start):

Q: Want to export as CSV
  A: Create custom script with csv.DictWriter(...)

================================================================================
RECOMMENDED WORKFLOW
================================================================================

1. First Run:
   python analyze_all_scenarios.py
   (Get overview of all 7 scenarios)

2. Then Run:
   julia scenario_reader.jl
   (Understand expected behavior)

3. Compare:
   Spot differences between expected vs actual

4. Deep Dive:
   Create custom Python script for specific analysis

================================================================================
""")
