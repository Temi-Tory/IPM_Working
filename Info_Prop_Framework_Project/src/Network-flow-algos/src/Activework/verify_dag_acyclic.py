#!/usr/bin/env python3
"""
Verify that the Ergo Proxy DAG network is actually acyclic
"""

import csv
import numpy as np
from collections import defaultdict, deque

def load_dag_matrix(filename):
    """Load the DAG matrix from CSV"""
    data = []
    with open(filename, 'r') as f:
        reader = csv.reader(f)
        for row in reader:
            data.append([float(x) for x in row])
    return np.array(data)

def matrix_to_adjacency_list(matrix):
    """Convert matrix to adjacency list representation"""
    n = matrix.shape[0]
    adj_list = defaultdict(list)
    
    for i in range(n):
        for j in range(1, matrix.shape[1]):  # Skip first column (priors)
            if matrix[i, j] > 0:  # There's an edge
                adj_list[i].append(j-1)  # j-1 because column 1 = node 0
    
    return adj_list

def has_cycle_dfs(adj_list, n):
    """Check for cycles using DFS with three colors"""
    # 0 = white (unvisited), 1 = gray (visiting), 2 = black (visited)
    color = [0] * n
    
    def dfs(node):
        if color[node] == 1:  # Gray node = back edge = cycle
            return True
        if color[node] == 2:  # Already processed
            return False
        
        color[node] = 1  # Mark as visiting
        
        for neighbor in adj_list[node]:
            if neighbor < n and dfs(neighbor):
                return True
        
        color[node] = 2  # Mark as visited
        return False
    
    for i in range(n):
        if color[i] == 0:
            if dfs(i):
                return True
    return False

def topological_sort_kahn(adj_list, n):
    """Attempt topological sort using Kahn's algorithm"""
    # Calculate in-degrees
    in_degree = [0] * n
    for node in adj_list:
        for neighbor in adj_list[node]:
            if neighbor < n:
                in_degree[neighbor] += 1
    
    # Queue for nodes with no incoming edges
    queue = deque([i for i in range(n) if in_degree[i] == 0])
    topo_order = []
    
    while queue:
        node = queue.popleft()
        topo_order.append(node)
        
        for neighbor in adj_list[node]:
            if neighbor < n:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
    
    return topo_order, len(topo_order) == n

def analyze_dag_structure(matrix):
    """Comprehensive DAG analysis"""
    n = matrix.shape[0]
    adj_list = matrix_to_adjacency_list(matrix)
    
    print(f"=== DAG STRUCTURE ANALYSIS ===")
    print(f"Nodes: {n}")
    print(f"Total possible edges: {n * (n-1)}")
    
    # Count actual edges
    total_edges = 0
    for i in range(n):
        for j in range(1, matrix.shape[1]):
            if matrix[i, j] > 0:
                total_edges += 1
    
    print(f"Actual edges: {total_edges}")
    print(f"Density: {total_edges / (n * (n-1)):.6f}")
    
    # Check for self-loops
    self_loops = 0
    for i in range(n):
        if i+1 < matrix.shape[1] and matrix[i, i+1] > 0:  # i+1 because column 0 is priors
            self_loops += 1
    
    print(f"Self-loops: {self_loops}")
    
    # Source nodes (no incoming edges)
    in_degree = [0] * n
    for node in adj_list:
        for neighbor in adj_list[node]:
            if neighbor < n:
                in_degree[neighbor] += 1
    
    sources = [i for i in range(n) if in_degree[i] == 0]
    sinks = [i for i in range(n) if len(adj_list[i]) == 0]
    
    print(f"Source nodes (no incoming): {len(sources)} - {sources[:10]}{'...' if len(sources) > 10 else ''}")
    print(f"Sink nodes (no outgoing): {len(sinks)}")
    
    # Check for cycles
    print(f"\n=== CYCLE DETECTION ===")
    has_cycle = has_cycle_dfs(adj_list, n)
    print(f"Has cycles (DFS): {has_cycle}")
    
    # Topological sort
    topo_order, is_dag = topological_sort_kahn(adj_list, n)
    print(f"Topological sort possible: {is_dag}")
    print(f"Nodes in topological order: {len(topo_order)}")
    
    if not is_dag:
        print("❌ NETWORK IS NOT A DAG - CONTAINS CYCLES!")
        return False
    else:
        print("✅ NETWORK IS A VALID DAG - NO CYCLES DETECTED!")
        return True

def verify_node_ordering(matrix):
    """Verify that our node ordering respects DAG constraints"""
    print(f"\n=== NODE ORDERING VERIFICATION ===")
    
    violations = []
    n = matrix.shape[0]
    
    for i in range(n):
        for j in range(1, matrix.shape[1]):
            if matrix[i, j] > 0:  # Edge from i to j-1
                target = j - 1
                if target <= i:  # Edge goes backwards or to self
                    violations.append((i, target, matrix[i, j]))
    
    print(f"Ordering violations (edges going backwards): {len(violations)}")
    if violations:
        print("First 10 violations:")
        for i, (source, target, weight) in enumerate(violations[:10]):
            print(f"  {source} -> {target} (weight: {weight})")
        return False
    else:
        print("✅ All edges respect forward ordering!")
        return True

if __name__ == "__main__":
    print("Loading Ergo Proxy DAG network...")
    matrix = load_dag_matrix("ergo_proxy_dag_network.csv")
    
    print(f"Matrix shape: {matrix.shape}")
    
    # Analyze structure
    is_valid_dag = analyze_dag_structure(matrix)
    
    # Check ordering
    ordering_valid = verify_node_ordering(matrix)
    
    print(f"\n=== FINAL VERIFICATION ===")
    if is_valid_dag and ordering_valid:
        print("🎉 NETWORK IS A VALID DAG!")
        print("✅ No cycles detected")
        print("✅ Proper node ordering")
        print("✅ Ready for DAG algorithms")
    else:
        print("❌ NETWORK HAS ISSUES:")
        if not is_valid_dag:
            print("  - Contains cycles")
        if not ordering_valid:
            print("  - Improper node ordering")
        print("🔧 Network needs fixing!")