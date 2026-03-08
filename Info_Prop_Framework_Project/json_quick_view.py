#!/usr/bin/env python3
"""Quick JSON analyzer for EXPECTED_OUTPUTS.json"""

import json
import sys

output_file = "EXPECTED_OUTPUTS.json"

print("\n" + "="*80)
print("|" + " "*20 + "EXPECTED OUTPUTS ANALYZER" + " "*35 + "|")
print("="*80)

try:
    with open(output_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse as NDJSON (multiple JSON objects)
    lines = content.strip().split('\n')
    print(f"\n[LOAD] File has {len(lines)} lines")
    print(f"[PARSE] Attempting to parse JSON objects...")
    
    data_objects = []
    parse_count = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped and stripped not in ['[', ']', '{', '}', ',']:
            try:
                obj = json.loads(stripped)
                if isinstance(obj, dict):
                    data_objects.append(obj)
                parse_count += 1
            except (json.JSONDecodeError, ValueError):
                pass
    
    print(f"\n[SUCCESS] Loaded {len(data_objects)} JSON objects (parsed {parse_count} parseable lines)")
    
    # Analyze first object
    if data_objects:
        data = data_objects[0]
        
        print(f"\n[ANALYZE] First JSON Object")
        print("-"*80)
        
        # Keys
        print(f"Keys: {', '.join(list(data.keys())[:10])}")
        if len(data.keys()) > 10:
            print(f"      ... and {len(data.keys())-10} more")
        
        # Computation metrics
        if 'computation_time_ms' in data:
            print(f"\nComputation Time: {data['computation_time_ms']:.2f} ms")
        if 'network_utilization' in data:
            print(f"Network Utilization: {data['network_utilization']*100:.2f}%")
        
        # Edge flows
        if 'edge_flows' in data:
            flows = data['edge_flows']
            active = sum(1 for v in flows.values() if v > 0)
            total = sum(flows.values())
            print(f"\nEdge Data:")
            print(f"  Total edges: {len(flows)}")
            print(f"  Active edges: {active}")
            print(f"  Total flow: {total:.4f} units")
        
        # Edge utilization
        if 'edge_utilization' in data:
            utils = [u['utilization'] for u in data['edge_utilization'].values() if 'utilization' in u and u.get('capacity', 0) > 0]
            if utils:
                print(f"\nUtilization Stats:")
                print(f"  Min: {min(utils)*100:.2f}%")
                print(f"  Max: {max(utils)*100:.2f}%")
                print(f"  Avg: {sum(utils)/len(utils)*100:.2f}%")
                
                high = sum(1 for u in utils if u >= 0.9)
                med = sum(1 for u in utils if 0.5 <= u < 0.9)
                low = sum(1 for u in utils if u > 0)
                print(f"\nDistribution: HIGH(90%+)={high} MED(50-90%)={med} LOW(else)={low}")
        
        # Bottlenecks
        if 'edge_utilization' in data:
            bottlenecks = [(k, v) for k, v in data['edge_utilization'].items() 
                          if v.get('utilization', 0) >= 0.95 and v.get('capacity', 0) > 0]
            if bottlenecks:
                print(f"\nCritical Edges (>95% util): {len(bottlenecks)}")
                for edge, util in sorted(bottlenecks, key=lambda x: x[1]['utilization'], reverse=True)[:5]:
                    u = util['utilization']*100
                    f = util['flow']
                    c = util['capacity']
                    print(f"  {edge}: {u:.1f}% (flow: {f:.2f}/{c:.2f})")
    
    print("\n" + "="*80)
    print("ANALYSIS COMPLETE")
    print("="*80 + "\n")

except Exception as e:
    print(f"\n[ERROR] {type(e).__name__}: {e}\n")
    sys.exit(1)
