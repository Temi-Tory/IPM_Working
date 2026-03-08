#!/usr/bin/env python3
"""Extract and display interval scenario data (Scenarios 5-6)"""

import json

content = open('EXPECTED_OUTPUTS.json').read()
objs = []
brace_count = 0
current = ''

for char in content:
    if char == '{':
        if brace_count == 0:
            current = ''
        current += char
        brace_count += 1
    elif char == '}':
        current += char
        brace_count -= 1
        if brace_count == 0:
            try:
                obj = json.loads(current)
                objs.append(obj)
            except:
                pass
            current = ''
    elif brace_count > 0:
        current += char

print("\n" + "="*80)
print("INTERVAL SCENARIOS (5-6) - DETAILED VIEW")
print("="*80)

# Scenario 5
print("\n=== SCENARIO 5 (Interval Conservative) ===")
s5 = objs[4]
print(f"Type: Interval (worst-case pessimistic)")
print(f"Guaranteed Min Flow: {s5.get('guaranteed_min_flow')} units")
print(f"Possible Max Flow: {s5.get('possible_max_flow')} units")
print(f"Expected Flow: {s5.get('expected_flow')} units")
print(f"Computation Time: {s5.get('computation_time_ms')} ms")
print(f"All keys: {list(s5.keys())}")

# Scenario 6  
print("\n=== SCENARIO 6 (Interval Optimistic) ===")
s6 = objs[5]
print(f"Type: Interval (best-case optimistic)")
print(f"Guaranteed Min Flow: {s6.get('guaranteed_min_flow')} units")
print(f"Possible Max Flow: {s6.get('possible_max_flow')} units")
print(f"Expected Flow: {s6.get('expected_flow')} units")
print(f"Computation Time: {s6.get('computation_time_ms')} ms")
print(f"All keys: {list(s6.keys())}")

print("\n" + "="*80)
print("COMPARISON")
print("="*80)
scenarios_data = [
    ("Scenario 1 (Source Limited)", objs[0].get('total_max_flow'), 24.0),
    ("Scenario 2 (Edge Demo)", objs[1].get('total_max_flow'), 52.45),
    ("Scenario 3 (Node Demo)", objs[2].get('total_max_flow'), 68.16),
    ("Scenario 4 (Mixed High)", objs[3].get('total_max_flow'), 77.82),
    ("Scenario 5 (Min Bound)", s5.get('guaranteed_min_flow'), None),
    ("Scenario 5 (Max Bound)", s5.get('possible_max_flow'), None),
    ("Scenario 6 (Min Bound)", s6.get('guaranteed_min_flow'), None),
    ("Scenario 6 (Max Bound)", s6.get('possible_max_flow'), None),
    ("Scenario 7 (Interval Worst)", objs[6].get('total_max_flow'), 84.0),
]

print("\nFlow Progression:")
for name, actual, exp in scenarios_data:
    if exp:
        match = "✓" if abs(actual - exp) < 0.1 else "✗"
        print(f"  {match} {name}: {actual:.2f} (expected {exp})")
    else:
        print(f"  ? {name}: {actual:.2f}")
