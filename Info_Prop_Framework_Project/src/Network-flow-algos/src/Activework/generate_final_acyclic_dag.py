#!/usr/bin/env python3
"""
Generate FINAL ACYCLIC Ergo Proxy DAG Network CSV
Ensuring NO self-loops and strict forward-only connections
"""

import csv
import numpy as np
import random

def create_final_acyclic_dag():
    """Create properly acyclic DAG with no self-loops"""
    
    # Initialize 800x801 matrix
    dag_matrix = np.zeros((800, 801))
    
    # Set prior probabilities (first column)
    source_nodes = [0, 350, 400, 550, 650, 700]  # 0-indexed
    for node in source_nodes:
        dag_matrix[node, 0] = 1.0
    
    # Set other priors
    for i in range(800):
        if dag_matrix[i, 0] == 0:  # Not a source node
            if i < 50:
                dag_matrix[i, 0] = 0.8 - (i * 0.01)
            elif i < 150:
                dag_matrix[i, 0] = 0.6 - ((i-50) * 0.005)
            elif i < 200:
                dag_matrix[i, 0] = 0.4 - ((i-150) * 0.005)
            elif i < 230:
                dag_matrix[i, 0] = 0.8 - ((i-200) * 0.025)
            elif i < 260:
                dag_matrix[i, 0] = 0.9 - ((i-230) * 0.025)
            elif i < 280:
                dag_matrix[i, 0] = 0.9 - ((i-260) * 0.04)
            elif i < 350:
                dag_matrix[i, 0] = 0.7 - ((i-280) * 0.008)
            elif i < 400:
                dag_matrix[i, 0] = 0.8 - ((i-350) * 0.01)
            elif i < 500:
                dag_matrix[i, 0] = 0.7 - ((i-400) * 0.005)
            elif i < 530:
                dag_matrix[i, 0] = 0.6 - ((i-500) * 0.015)
            elif i < 550:
                dag_matrix[i, 0] = 0.5 - ((i-530) * 0.02)
            elif i < 650:
                dag_matrix[i, 0] = 0.6 - ((i-550) * 0.004)
            elif i < 700:
                dag_matrix[i, 0] = 0.8 - ((i-650) * 0.01)
            elif i < 730:
                dag_matrix[i, 0] = 0.7 - ((i-700) * 0.02)
            elif i < 750:
                dag_matrix[i, 0] = 0.3 - ((i-730) * 0.01)
            else:
                dag_matrix[i, 0] = 0.2 - ((i-750) * 0.002)
    
    # Ensure all priors are positive
    dag_matrix[:, 0] = np.maximum(dag_matrix[:, 0], 0.1)
    
    # Create connections with STRICT rules:
    # 1. NO self-loops (i cannot connect to i)
    # 2. Only forward connections (i can only connect to j where j > i)
    
    def add_forward_connections(source_idx, target_range, num_connections, prob_range):
        """Add forward connections from source to targets"""
        valid_targets = [t for t in target_range if t > source_idx and t < 800]
        if valid_targets and num_connections > 0:
            selected = random.sample(valid_targets, min(num_connections, len(valid_targets)))
            for target in selected:
                # target is 0-indexed, but matrix column is 1-indexed (column 0 is priors)
                dag_matrix[source_idx, target + 1] = random.uniform(prob_range[0], prob_range[1])
    
    # SOURCE NODE CONNECTIONS
    
    # Global Ecological Disaster (Node 700) -> Future nodes only
    add_forward_connections(700, list(range(701, 800)), 30, (0.6, 0.9))
    
    # Pulse of Awakening (Node 0) -> Forward connections
    pulse_targets = list(range(1, 50)) + list(range(200, 220)) + list(range(260, 280)) + \
                   list(range(500, 530)) + list(range(650, 670)) + list(range(750, 770))
    add_forward_connections(0, pulse_targets, 50, (0.4, 0.9))
    
    # Romdeau Foundation (Node 350) -> Forward connections
    romdeau_targets = list(range(351, 400)) + list(range(500, 530)) + list(range(650, 670))
    add_forward_connections(350, romdeau_targets, 25, (0.5, 0.8))
    
    # Proxy Project (Node 400) -> Forward connections
    proxy_targets = list(range(401, 500)) + list(range(750, 780))
    add_forward_connections(400, proxy_targets, 30, (0.5, 0.8))
    
    # Existential Crisis (Node 550) -> Forward connections
    existential_targets = list(range(551, 600)) + list(range(750, 780))
    add_forward_connections(550, existential_targets, 20, (0.4, 0.7))
    
    # Present Narrative (Node 650) -> Forward connections
    narrative_targets = list(range(651, 700)) + list(range(750, 780))
    add_forward_connections(650, narrative_targets, 25, (0.5, 0.8))
    
    # DENSE FORWARD CONNECTIONS FOR ALL NODES
    
    # Plot events (1-199) connect forward
    for i in range(1, 200):
        if i not in source_nodes:
            # Connect to later plot events
            plot_targets = list(range(i+1, 200))
            add_forward_connections(i, plot_targets, 2, (0.3, 0.6))
            
            # Connect to character states
            char_targets = list(range(200, 350))
            add_forward_connections(i, char_targets, 3, (0.2, 0.5))
            
            # Connect to systems
            system_targets = list(range(350, 550))
            add_forward_connections(i, system_targets, 2, (0.2, 0.4))
            
            # Connect to revelations
            rev_targets = list(range(750, 800))
            add_forward_connections(i, rev_targets, 1, (0.3, 0.6))
    
    # Character states (200-349) connect forward
    for i in range(200, 350):
        if i not in source_nodes:
            # Sequential character progression
            if i < 215:  # Vincent arc
                add_forward_connections(i, list(range(i+1, 216)), 2, (0.7, 0.9))
            elif i < 245:  # Re-l arc
                add_forward_connections(i, list(range(i+1, 246)), 2, (0.7, 0.9))
            elif i < 275:  # Pino arc
                add_forward_connections(i, list(range(i+1, 276)), 2, (0.7, 0.9))
            
            # Connect to later characters
            later_chars = list(range(i+1, 350))
            add_forward_connections(i, later_chars, 2, (0.3, 0.6))
            
            # Connect to systems
            system_targets = list(range(350, 550))
            add_forward_connections(i, system_targets, 3, (0.2, 0.5))
            
            # Connect to temporal
            temp_targets = list(range(650, 750))
            add_forward_connections(i, temp_targets, 2, (0.3, 0.6))
            
            # Connect to revelations
            rev_targets = list(range(750, 800))
            add_forward_connections(i, rev_targets, 2, (0.4, 0.7))
    
    # System components (350-549) connect forward
    for i in range(350, 550):
        if i not in source_nodes:
            # Connect to later systems
            later_systems = list(range(i+1, 550))
            add_forward_connections(i, later_systems, 3, (0.3, 0.6))
            
            # Connect to thematic concepts
            theme_targets = list(range(550, 650))
            add_forward_connections(i, theme_targets, 2, (0.2, 0.5))
            
            # Connect to temporal
            temp_targets = list(range(650, 750))
            add_forward_connections(i, temp_targets, 2, (0.3, 0.6))
            
            # Connect to revelations
            rev_targets = list(range(750, 800))
            add_forward_connections(i, rev_targets, 3, (0.4, 0.7))
    
    # Thematic concepts (550-649) connect forward
    for i in range(550, 650):
        if i not in source_nodes:
            # Connect to later themes
            later_themes = list(range(i+1, 650))
            add_forward_connections(i, later_themes, 2, (0.3, 0.5))
            
            # Connect to temporal
            temp_targets = list(range(650, 750))
            add_forward_connections(i, temp_targets, 2, (0.3, 0.6))
            
            # Connect to revelations
            rev_targets = list(range(750, 800))
            add_forward_connections(i, rev_targets, 3, (0.4, 0.7))
    
    # Temporal elements (650-749) connect forward
    for i in range(650, 750):
        if i not in source_nodes:
            # Connect to later temporal
            later_temp = list(range(i+1, 750))
            add_forward_connections(i, later_temp, 2, (0.4, 0.7))
            
            # Connect to revelations
            rev_targets = list(range(750, 800))
            add_forward_connections(i, rev_targets, 4, (0.5, 0.8))
    
    # Revelation nodes (750-799) connect forward only
    for i in range(750, 799):
        later_revs = list(range(i+1, 800))
        add_forward_connections(i, later_revs, 2, (0.6, 0.9))
    
    return dag_matrix

def write_csv(matrix, filename):
    """Write the DAG matrix to CSV file"""
    with open(filename, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        for row in matrix:
            formatted_row = [f"{val:.1f}" if val != 0 else "0.0" for val in row]
            writer.writerow(formatted_row)

def verify_no_self_loops(matrix):
    """Verify no self-loops exist"""
    self_loops = 0
    for i in range(matrix.shape[0]):
        if i+1 < matrix.shape[1] and matrix[i, i+1] > 0:  # i+1 because column 0 is priors
            self_loops += 1
    return self_loops

def verify_forward_only(matrix):
    """Verify all connections are forward-only"""
    violations = 0
    for i in range(matrix.shape[0]):
        for j in range(1, matrix.shape[1]):  # Skip column 0 (priors)
            if matrix[i, j] > 0:
                target = j - 1  # Convert back to 0-indexed
                if target <= i:  # Backward or self connection
                    violations += 1
    return violations

if __name__ == "__main__":
    print("Generating FINAL ACYCLIC Ergo Proxy DAG Network...")
    dag_matrix = create_final_acyclic_dag()
    
    # Verify structure before saving
    self_loops = verify_no_self_loops(dag_matrix)
    violations = verify_forward_only(dag_matrix)
    
    print(f"Self-loops detected: {self_loops}")
    print(f"Forward-only violations: {violations}")
    
    if self_loops == 0 and violations == 0:
        write_csv(dag_matrix, "ergo_proxy_dag_network.csv")
        
        # Calculate statistics
        edges = np.count_nonzero(dag_matrix[:, 1:])
        sources = np.sum(dag_matrix[:, 0] == 1.0)
        density = edges / (800 * 799)
        
        print(f"✅ VALID ACYCLIC DAG network saved!")
        print(f"Matrix shape: {dag_matrix.shape}")
        print(f"Total edges: {edges}")
        print(f"Source nodes: {sources}")
        print(f"Average edges per node: {edges/800:.2f}")
        print(f"Network density: {density:.6f}")
        print(f"Ready for final verification!")
    else:
        print(f"❌ Network still has issues - not saving")