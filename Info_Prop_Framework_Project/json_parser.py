#!/usr/bin/env python3
"""Parse concatenated JSON from EXPECTED_OUTPUTS.json"""

import json

output_file = "EXPECTED_OUTPUTS.json"

print("\n" + "="*80)
print("|" + " "*20 + "EXPECTED OUTPUTS ANALYZER" + " "*35 + "|")
print("="*80)

try:
    with open(output_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"\n[LOAD] File size: {len(content):,} characters")
    
    # Try to extract complete JSON objects by finding balanced braces
    objects = []
    i = 0
    brace_count = 0
    current_obj = ""
    in_string = False
    escape_next = False
    
    for char in content:
        if escape_next:
            current_obj += char
            escape_next = False
            continue
        
        if char == '\\':
            current_obj += char
            escape_next = True
            continue
        
        if char == '"' and not escape_next:
            in_string = not in_string
        
        if not in_string:
            if char == '{':
                #brace_count += 1
                if brace_count == 0:
                    current_obj = ""
                current_obj += char
                brace_count += 1
            elif char == '}':
                current_obj += char
                brace_count -= 1
                if brace_count == 0 and current_obj.strip():
                    try:
                        obj = json.loads(current_obj)
                        objects.append(obj)
                    except:
                        pass
                    current_obj = ""
            elif brace_count > 0:
                current_obj += char
        else:
            current_obj += char
    
    print(f"[PARSE] Found {len(objects)} valid JSON objects")
    
    if objects:
        print(f"\n[FIRST OBJECT] Analysis:")
        print("-"*80)
        
        data = objects[0]
        
        # Show keys
        keys = list(data.keys())
        print(f"Top-level keys ({len(keys)} total):")
        for key in keys[:15]:
            print(f"  * {key}")
        if len(keys) > 15:
            print(f"  ... and {len(keys)-15} more")
        
        # Key statistics
        if 'computation_time_ms' in data:
            print(f"\nComputation Time: {data['computation_time_ms']:.2f} ms")
        
        if 'network_utilization' in data:
            util_pct = data['network_utilization'] * 100
            print(f"Network Utilization: {util_pct:.2f}%")
        
        if 'edge_flows' in data and isinstance(data['edge_flows'], dict):
            flows = data['edge_flows']
            active_count = sum(1 for v in flows.values() if v > 0)
            total_flow = sum(flows.values())
            print(f"\nEdge Flows:")
            print(f"  Total edges: {len(flows)}")
            print(f"  Active edges (> 0): {active_count}")
            print(f"  Total flow: {total_flow:.4f} units")
           
            # Top flows
            top_flows = sorted([(k, v) for k, v in flows.items() if v > 0], key=lambda x: x[1], reverse=True)[:10]
            if top_flows:
                print(f"\n  Top 10 edges:")
                for edge, flow in top_flows:
                    print(f"    {edge}: {flow:.4f} units")
        
        if 'edge_utilization' in data and isinstance(data['edge_utilization'], dict):
            utils = data['edge_utilization']
            valid_utils = [u['utilization'] for u in utils.values() if u.get('capacity', 0) > 0]
            
            if valid_utils:
                print(f"\nEdge Utilization:")
                print(f"  Min: {min(valid_utils)*100:.2f}%")
                print(f"  Max: {max(valid_utils)*100:.2f}%")
                avg = sum(valid_utils) / len(valid_utils)
                print(f"  Avg: {avg*100:.2f}%")
                
                high = sum(1 for u in valid_utils if u >= 0.9)
                med = sum(1 for u in valid_utils if 0.5 <= u < 0.9)
                low = sum(1 for u in valid_utils if u > 0)
                
                print(f"\n  Distribution:")
                print(f"    HIGH (>=90%): {high} edges")
                print(f"    MED  (50-90%): {med} edges")
                print(f"    LOW  (<50%): {low} edges")
    
    print("\n" + "="*80)
    print("SUCCESS")
    print("="*80 + "\n")

except Exception as e:
    import traceback
    print(f"\n[ERROR] {type(e).__name__}: {e}")
    traceback.print_exc()
