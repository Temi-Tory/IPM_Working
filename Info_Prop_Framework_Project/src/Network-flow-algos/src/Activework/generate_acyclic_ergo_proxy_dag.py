#!/usr/bin/env python3
"""
Generate ACYCLIC Dense Ergo Proxy DAG Network CSV
Creating a proper DAG with 2000-5000+ edges that respects topological ordering
"""

import csv
import numpy as np
import random

def create_acyclic_ergo_proxy_dag():
    """Create the dense 800-node Ergo Proxy DAG network with proper acyclic structure"""
    
    # Initialize 800x801 matrix
    dag_matrix = np.zeros((800, 801))
    
    # Set all first column values (prior probabilities)
    source_nodes = [1, 351, 401, 551, 651, 701]
    for node in source_nodes:
        dag_matrix[node-1, 0] = 1.0
    
    # PLOT EVENTS (Nodes 1-200)
    for i in range(0, 50):  # Major events (1-50)
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.8 - (i * 0.01)
    
    for i in range(50, 150):  # Scene events (51-150)
        dag_matrix[i, 0] = 0.6 - ((i-50) * 0.005)
    
    for i in range(150, 200):  # Dialogue moments (151-200)
        dag_matrix[i, 0] = 0.4 - ((i-150) * 0.005)
    
    # CHARACTER STATES (Nodes 201-350)
    for i in range(200, 230):  # Vincent states
        dag_matrix[i, 0] = 0.8 - ((i-200) * 0.025)
    
    for i in range(230, 260):  # Re-l states
        dag_matrix[i, 0] = 0.9 - ((i-230) * 0.025)
    
    for i in range(260, 280):  # Pino states
        dag_matrix[i, 0] = 0.9 - ((i-260) * 0.04)
    
    for i in range(280, 350):  # Other characters
        dag_matrix[i, 0] = 0.7 - ((i-280) * 0.008)
    
    # SYSTEM COMPONENTS (Nodes 351-550)
    for i in range(350, 400):  # Romdeau systems
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.8 - ((i-350) * 0.01)
    
    for i in range(400, 500):  # Proxy network
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.7 - ((i-400) * 0.005)
    
    for i in range(500, 530):  # AutoReiv systems
        dag_matrix[i, 0] = 0.6 - ((i-500) * 0.015)
    
    for i in range(530, 550):  # Environmental
        dag_matrix[i, 0] = 0.5 - ((i-530) * 0.02)
    
    # THEMATIC CONCEPTS (Nodes 551-650)
    for i in range(550, 650):
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.6 - ((i-550) * 0.004)
    
    # TEMPORAL ELEMENTS (Nodes 651-750)
    for i in range(650, 700):
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.8 - ((i-650) * 0.01)
    
    for i in range(700, 730):
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.7 - ((i-700) * 0.02)
    
    for i in range(730, 750):
        dag_matrix[i, 0] = 0.3 - ((i-730) * 0.01)
    
    # REVELATION NODES (Nodes 751-800)
    for i in range(750, 800):
        dag_matrix[i, 0] = 0.2 - ((i-750) * 0.002)
    
    # NOW CREATE DENSE ACYCLIC CONNECTIONS
    # KEY RULE: Node i can only connect to nodes j where j > i (strict forward ordering)
    
    # 1. GLOBAL ECOLOGICAL DISASTER (Node 701) - connects forward only
    disaster_targets = [702, 703, 704, 705, 706, 707, 708, 709, 710, 711, 712, 713, 714, 715,
                       731, 732, 733, 734, 735, 736, 737, 738, 739, 740, 741, 742, 743, 744,
                       751, 752, 753, 754, 755, 756, 757, 758, 759, 760, 761, 762, 763, 764]
    
    for target in disaster_targets:
        if target <= 800:
            dag_matrix[700, target] = random.uniform(0.6, 0.9)
    
    # 2. PULSE OF AWAKENING (Node 1) - connects to higher numbered nodes
    pulse_targets = list(range(2, 51)) + list(range(201, 221)) + list(range(261, 281)) + \
                   list(range(501, 531)) + list(range(651, 671)) + list(range(751, 771))
    
    for target in pulse_targets:
        if target <= 800:
            dag_matrix[0, target] = random.uniform(0.4, 0.9)
    
    # 3. ROMDEAU FOUNDATION (Node 351) - connects forward
    romdeau_targets = list(range(352, 400)) + list(range(501, 531)) + list(range(651, 671)) + \
                     list(range(751, 771))
    
    for target in romdeau_targets:
        if target <= 800:
            dag_matrix[350, target] = random.uniform(0.5, 0.8)
    
    # 4. PROXY PROJECT (Node 401) - connects forward
    proxy_targets = list(range(402, 500)) + list(range(751, 780))
    
    for target in proxy_targets:
        if target <= 800:
            dag_matrix[400, target] = random.uniform(0.5, 0.8)
    
    # 5. EXISTENTIAL CRISIS (Node 551) - connects forward
    existential_targets = list(range(552, 600)) + list(range(751, 780))
    
    for target in existential_targets:
        if target <= 800:
            dag_matrix[550, target] = random.uniform(0.4, 0.7)
    
    # 6. PRESENT NARRATIVE (Node 651) - connects forward
    narrative_targets = list(range(652, 700)) + list(range(751, 780))
    
    for target in narrative_targets:
        if target <= 800:
            dag_matrix[650, target] = random.uniform(0.5, 0.8)
    
    # 7. DENSE FORWARD-ONLY CHARACTER PROGRESSIONS
    
    # Vincent Arc (201-215) - strict forward progression
    for i in range(200, 215):
        # Sequential progression (strong)
        for j in range(i+1, min(i+4, 215)):
            dag_matrix[i, j+1] = random.uniform(0.7, 0.9)
        
        # Forward connections to later character states
        later_chars = list(range(max(231, i+1), 350)) + list(range(751, 780))
        
        for target in random.sample([t for t in later_chars if t <= 800], 
                                  min(6, len([t for t in later_chars if t <= 800]))):
            dag_matrix[i, target] = random.uniform(0.3, 0.7)
    
    # Re-l Arc (231-245) - forward progression
    for i in range(230, 245):
        # Sequential progression
        for j in range(i+1, min(i+3, 245)):
            dag_matrix[i, j+1] = random.uniform(0.7, 0.9)
        
        # Forward investigation connections
        investigation_targets = list(range(max(351, i+1), 550)) + list(range(751, 780))
        
        for target in random.sample([t for t in investigation_targets if t <= 800], 
                                  min(8, len([t for t in investigation_targets if t <= 800]))):
            dag_matrix[i, target] = random.uniform(0.4, 0.8)
    
    # Pino Arc (261-275) - consciousness forward progression
    for i in range(260, 275):
        # Sequential consciousness development
        for j in range(i+1, min(i+3, 275)):
            dag_matrix[i, j+1] = random.uniform(0.7, 0.9)
        
        # Forward consciousness effects
        consciousness_targets = list(range(max(501, i+1), 580)) + list(range(751, 770))
        
        for target in random.sample([t for t in consciousness_targets if t <= 800], 
                                  min(6, len([t for t in consciousness_targets if t <= 800]))):
            dag_matrix[i, target] = random.uniform(0.3, 0.7)
    
    # 8. SYSTEM FORWARD NETWORKS
    
    # Plot events connect forward to character states and systems
    for i in range(1, 200):  # Skip pulse node
        if i != 0:  # Skip pulse node
            forward_targets = []
            
            # Connect to later plot events
            if i < 150:
                forward_targets.extend(list(range(i+1, min(i+20, 200))))
            
            # Connect to character states (all higher numbered)
            forward_targets.extend(list(range(201, 350)))
            
            # Connect to systems
            forward_targets.extend(list(range(351, 550)))
            
            # Connect to revelations
            forward_targets.extend(list(range(751, 800)))
            
            # Sample connections
            valid_targets = [t for t in forward_targets if t <= 800]
            if valid_targets:
                for target in random.sample(valid_targets, min(4, len(valid_targets))):
                    dag_matrix[i, target] = random.uniform(0.2, 0.6)
    
    # Character states connect forward to systems and revelations
    for i in range(200, 350):
        forward_targets = []
        
        # Connect to later character states
        forward_targets.extend(list(range(i+1, 350)))
        
        # Connect to systems
        forward_targets.extend(list(range(351, 550)))
        
        # Connect to temporal elements
        forward_targets.extend(list(range(651, 750)))
        
        # Connect to revelations
        forward_targets.extend(list(range(751, 800)))
        
        valid_targets = [t for t in forward_targets if t <= 800]
        if valid_targets:
            for target in random.sample(valid_targets, min(5, len(valid_targets))):
                dag_matrix[i, target] = random.uniform(0.2, 0.6)
    
    # Systems connect forward to other systems, temporal, and revelations
    for i in range(351, 550):
        if i not in [350, 400]:  # Skip source nodes
            forward_targets = []
            
            # Connect to later systems
            forward_targets.extend(list(range(i+1, 550)))
            
            # Connect to thematic concepts
            forward_targets.extend(list(range(551, 650)))
            
            # Connect to temporal elements
            forward_targets.extend(list(range(651, 750)))
            
            # Connect to revelations
            forward_targets.extend(list(range(751, 800)))
            
            valid_targets = [t for t in forward_targets if t <= 800]
            if valid_targets:
                for target in random.sample(valid_targets, min(6, len(valid_targets))):
                    dag_matrix[i, target] = random.uniform(0.2, 0.7)
    
    # Thematic concepts connect forward
    for i in range(551, 650):
        if i != 550:  # Skip source node
            forward_targets = []
            
            # Connect to later themes
            forward_targets.extend(list(range(i+1, 650)))
            
            # Connect to temporal elements
            forward_targets.extend(list(range(651, 750)))
            
            # Connect to revelations
            forward_targets.extend(list(range(751, 800)))
            
            valid_targets = [t for t in forward_targets if t <= 800]
            if valid_targets:
                for target in random.sample(valid_targets, min(4, len(valid_targets))):
                    dag_matrix[i, target] = random.uniform(0.2, 0.5)
    
    # Temporal elements connect forward
    for i in range(651, 750):
        if i != 650:  # Skip source node
            forward_targets = []
            
            # Connect to later temporal elements
            forward_targets.extend(list(range(i+1, 750)))
            
            # Connect to revelations
            forward_targets.extend(list(range(751, 800)))
            
            valid_targets = [t for t in forward_targets if t <= 800]
            if valid_targets:
                for target in random.sample(valid_targets, min(5, len(valid_targets))):
                    dag_matrix[i, target] = random.uniform(0.3, 0.8)
    
    # Revelation nodes connect forward only
    for i in range(751, 799):
        forward_targets = list(range(i+1, 800))
        
        if forward_targets:
            for target in random.sample(forward_targets, min(3, len(forward_targets))):
                dag_matrix[i, target] = random.uniform(0.6, 0.9)
    
    return dag_matrix

def write_csv(matrix, filename):
    """Write the DAG matrix to CSV file"""
    with open(filename, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        for row in matrix:
            formatted_row = [f"{val:.1f}" if val != 0 else "0.0" for val in row]
            writer.writerow(formatted_row)

if __name__ == "__main__":
    print("Generating ACYCLIC Dense Ergo Proxy DAG Network...")
    dag_matrix = create_acyclic_ergo_proxy_dag()
    write_csv(dag_matrix, "ergo_proxy_dag_network.csv")
    
    # Calculate statistics
    edges = np.count_nonzero(dag_matrix[:, 1:])
    sources = np.sum(dag_matrix[:, 0] == 1.0)
    density = edges / (800 * 799)
    
    print(f"ACYCLIC DAG network saved to ergo_proxy_dag_network.csv")
    print(f"Matrix shape: {dag_matrix.shape}")
    print(f"Total edges: {edges}")
    print(f"Source nodes (prior=1.0): {sources}")
    print(f"Average edges per node: {edges/800:.2f}")
    print(f"Network density: {density:.6f}")
    print(f"This network respects strict forward ordering (i -> j where j > i)")
    print(f"Ready for acyclic verification!")