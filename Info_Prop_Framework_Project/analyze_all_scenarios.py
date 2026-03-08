#!/usr/bin/env python3
"""Parse and analyze all 7 scenarios from EXPECTED_OUTPUTS.json"""

import json

output_file = "EXPECTED_OUTPUTS.json"

print("\n" + "="*80)
print("|" + " "*22 + "ALL 7 SCENARIOS ANALYSIS" + " "*33 + "|")
print("="*80)

try:
    with open(output_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract complete JSON objects by finding balanced braces
    objects = []
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
    
    print(f"\n[FOUND] {len(objects)} scenario objects\n")
    
    # Summarize each scenario
    for i, scenario in enumerate(objects, 1):
        print(f"\n{'='*80}")
        print(f"SCENARIO {i}")
        print(f"{'='*80}")
        
        # Basic metrics
        if 'total_max_flow' in scenario:
            max_flow = scenario['total_max_flow']
            print(f"  Max Flow: {max_flow} units")
        
        if 'computation_time_ms' in scenario:
            comp_time = scenario['computation_time_ms']
            print(f"  Computation Time: {comp_time:.2f} ms")
        
        if 'network_utilization' in scenario:
            util = scenario['network_utilization'] * 100
            print(f"  Network Utilization: {util:.2f}%")
        
        # Edge flows summary
        if 'edge_flows' in scenario:
            flows = scenario['edge_flows']
            active = sum(1 for v in flows.values() if v > 0)
            total = sum(flows.values())
            print(f"  Total Edges: {len(flows)} | Active: {active} | Total Flow: {total:.2f}")
        
        # Bottleneck analysis
        if 'bottlenecks' in scenario:
            bn = scenario['bottlenecks']
            print(f"\n  Bottleneck Type: {bn.get('bottleneck_type', 'N/A')}")
            
            if 'saturated_nodes' in bn:
                sat_nodes = bn['saturated_nodes']
                print(f"  Saturated Nodes: {sat_nodes if sat_nodes else 'none'}")
            
            if 'saturated_edges' in bn:
                sat_edges = bn['saturated_edges']
                count = len(sat_edges)
                preview = sat_edges[:5] if sat_edges else []
                print(f"  Saturated Edges: {count} total")
                if preview:
                    print(f"    Examples: {preview}")
            
            if 'near_saturated_edges' in bn:
                near = bn['near_saturated_edges']
                if near:
                    print(f"  Near-Saturated Edges: {len(near)} edges (85-95%)")
        
        # Utilization stats
        if 'edge_utilization' in scenario:
            utils = scenario['edge_utilization']
            valid_utils = [u['utilization'] for u in utils.values() if u.get('capacity', 0) > 0]
            
            if valid_utils:
                max_u = max(valid_utils)
                print(f"\n  Utilization Range: {min(valid_utils)*100:.1f}% to {max_u*100:.1f}%")
                
                high = sum(1 for u in valid_utils if u >= 0.9)
                med = sum(1 for u in valid_utils if 0.5 <= u < 0.9)
                low = sum(1 for u in valid_utils if u > 0)
                print(f"  Edge Distribution: HIGH({high}) MED({med}) LOW({low})")
        
        # Critical paths
        if 'critical_paths' in scenario:
            cp = scenario['critical_paths']
            if 'single_points_of_failure' in cp:
                spof = cp['single_points_of_failure']
                if spof:
                    print(f"\n  CRITICAL: Single Points of Failure: {spof}")
            
            if 'path_redundancy' in cp:
                red = cp['path_redundancy']
                if isinstance(red, (int, float)):
                    print(f"  Path Redundancy: {red:.2f}")
                else:
                    print(f"  Path Redundancy: {red}")
        
        # Upgrade analysis
        if 'upgrade_analysis' in scenario:
            ua = scenario['upgrade_analysis']
            
            if 'node_priorities' in ua and ua['node_priorities']:
                print(f"\n  Top Node Upgrades:")
                for node_up in ua['node_priorities'][:3]:
                    node = node_up.get('node', '?')
                    score = node_up.get('priority_score', 0)
                    marginal = node_up.get('marginal_value', 0)
                    score_str = f"{score:.2f}" if isinstance(score, (int, float)) else str(score)
                    marg_str = f"{marginal:.1f}" if isinstance(marginal, (int, float)) else str(marginal)
                    print(f"    Node {node}: score={score_str}, marginal_value={marg_str}")
            
            if 'edge_priorities' in ua and ua['edge_priorities']:
                print(f"\n  Top Edge Upgrades:")
                for edge_up in ua['edge_priorities'][:3]:
                    edge = edge_up.get('edge', '?')
                    score = edge_up.get('priority_score', 0)
                    marginal = edge_up.get('marginal_value', 0)
                    score_str = f"{score:.2f}" if isinstance(score, (int, float)) else str(score)
                    marg_str = f"{marginal:.1f}" if isinstance(marginal, (int, float)) else str(marginal)
                    print(f"    Edge {edge}: score={score_str}, marginal_value={marg_str}")
        
        # Comparative analysis
        if 'comparative_analysis' in scenario:
            ca = scenario['comparative_analysis']
            if 'primary_limitation' in ca:
                print(f"\n  Primary Limitation: {ca['primary_limitation']}")
            
            if 'efficiency_loss' in ca:
                loss = ca['efficiency_loss']
                loss_str = f"{loss:.2f}" if isinstance(loss, (int, float)) else str(loss)
                print(f"  Efficiency Loss: {loss_str}%")
        
        # Validation
        if 'validation' in scenario:
            val = scenario['validation']
            if isinstance(val, dict):
                passed = sum(1 for v in val.values() if v)
                total = len(val)
                print(f"\n  Validation: {passed}/{total} checks passed")

    print("\n" + "="*80)
    print("="*80 + "\n")

except Exception as e:
    import traceback
    print(f"\n[ERROR] {type(e).__name__}: {e}")
    traceback.print_exc()
