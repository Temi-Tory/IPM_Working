#!/usr/bin/env python3
"""
Quick JSON analyzer for EXPECTED_OUTPUTS.json
"""

import json
import statistics
from pathlib import Path

output_file = Path("EXPECTED_OUTPUTS.json")

print("\n" + "="*80)
print("|" + " "*20 + "EXPECTED OUTPUTS ANALYSIS" + " "*35 + "|")
print("="*80)

try:
    with open(output_file, 'r') as f:
        content = f.read()
    
    # Try to parse as single JSON first
    try:
        data = json.loads(content)
        is_ndjson = False
    except json.JSONDecodeError:
        # Try as NDJSON (multiple JSON objects)
        print("\n[INFO] File contains multiple JSON objects (NDJSON format)")
        lines = content.strip().split('\n')
        objects = []
        for line in lines:
            if line.strip():
                try:
                    objects.append(json.loads(line))
                except:
                    pass
        
        if objects:
            data = objects[0]  # Analyze first object
            is_ndjson = True
            print(f"[INFO] Found {len(objects)} JSON objects, analyzing first one\n")
        else:
            print("[ERROR] Could not parse JSON")
            exit(1)
    
    print("\n[KEY] JSON TOP-LEVEL STRUCTURE")
    print("─"*80)
    for key in data.keys():
        print(f"  * {key}")
    
    # Computation metrics
    print("\n[TIME] COMPUTATION METRICS")
    print("─"*80)
    print(f"  Computation Time: {data['computation_time_ms']:.2f} ms")
    print(f"  Network Utilization: {data['network_utilization']*100:.2f}%")
    
    # Edge flows
    print("\n[DATA] EDGE FLOW DATA")
    print("─"*80)
    edge_flows = data['edge_flows']
    total_edges = len(edge_flows)
    active_edges = {k: v for k, v in edge_flows.items() if v > 0}
    total_flow = sum(edge_flows.values())
    
    print(f"  Total Edges: {total_edges}")
    print(f"  Active Edges (flow > 0): {len(active_edges)}")
    print(f"  Total Flow: {total_flow:.4f} units")
    
    # Top edges by flow
    print("\n[TOP] TOP 15 EDGES BY FLOW")
    print("─"*80)
    sorted_edges = sorted(active_edges.items(), key=lambda x: x[1], reverse=True)
    for i, (edge, flow) in enumerate(sorted_edges[:15]):
        print(f"  {edge}: {flow:.4f} units")
    
    # Utilization statistics
    print("\n[UTIL] EDGE UTILIZATION STATISTICS")
    print("─"*80)
    edge_util = data['edge_utilization']
    utils = [u['utilization'] for u in edge_util.values() if u['capacity'] > 0]
    
    if utils:
        print(f"  Min Utilization: {min(utils)*100:.2f}%")
        print(f"  Max Utilization: {max(utils)*100:.2f}%")
        print(f"  Mean Utilization: {statistics.mean(utils)*100:.2f}%")
        print(f"  Median Utilization: {statistics.median(utils)*100:.2f}%")
        
        # Categorize
        high = sum(1 for u in utils if u >= 0.9)
        med = sum(1 for u in utils if 0.5 <= u < 0.9)
        low = sum(1 for u in utils if 0 < u < 0.5)
        
        print(f"\n  Utilization Distribution:")
        print(f"    [HIGH] >= 90%: {high} edges")
        print(f"    [MED]  50-90%: {med} edges")
        print(f"    [LOW]  < 50%: {low} edges")
    
    # Bottlenecks
    print("\n[BOTTLENECK] CRITICAL EDGES (>95% utilization)")
    print("─"*80)
    bottlenecks = {k: v for k, v in edge_util.items() if v['utilization'] >= 0.95 and v['capacity'] > 0}
    
    if bottlenecks:
        sorted_bn = sorted(bottlenecks.items(), key=lambda x: x[1]['utilization'], reverse=True)
        for i, (edge, util_data) in enumerate(sorted_bn[:15]):
            util_pct = util_data['utilization'] * 100
            print(f"  {edge} --> {util_pct:.1f}% (flow: {util_data['flow']:.4f} / cap: {util_data['capacity']:.4f})")
    else:
        print("  [OK] No critical bottlenecks found")
    
    # Additional data keys
    print("\n[INFO] ADDITIONAL DATASET INFORMATION")
    print("─"*80)
    if 'node_utilization' in data:
        print("  [OK] Node utilization data available")
    if 'paths_data' in data:
        print(f"  [OK] Paths data available ({len(data.get('paths_data', []))} paths)")
    if 'comparative_analysis' in data:
        print("  [OK] Comparative analysis available")
    
    print("\n" + "="*80)
    print("SUCCESS: Analysis Complete")
    print("="*80 + "\n")

except FileNotFoundError:
    print(f"\n[ERROR] File not found: {output_file}")
except json.JSONDecodeError as e:
    print(f"\n[ERROR] Invalid JSON: {e}")
except Exception as e:
    print(f"\n[ERROR] {type(e).__name__}: {e}")
