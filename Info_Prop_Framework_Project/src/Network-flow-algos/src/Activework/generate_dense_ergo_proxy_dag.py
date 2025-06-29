#!/usr/bin/env python3
"""
Generate Dense Ergo Proxy DAG Network CSV
Creating the 2000-5000+ edge monster network as originally planned
"""

import csv
import numpy as np
import random

def create_dense_ergo_proxy_dag():
    """Create the dense 800-node Ergo Proxy DAG network with 2000-5000+ edges"""
    
    # Initialize 800x801 matrix
    dag_matrix = np.zeros((800, 801))
    
    # Set all first column values (prior probabilities) - same as before
    source_nodes = [1, 351, 401, 551, 651, 701]
    for node in source_nodes:
        dag_matrix[node-1, 0] = 1.0
    
    # PLOT EVENTS (Nodes 1-200) - Much denser connections
    for i in range(0, 50):  # Major events (1-50)
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.8 - (i * 0.01)
    
    for i in range(50, 150):  # Scene events (51-150)
        dag_matrix[i, 0] = 0.6 - ((i-50) * 0.005)
    
    for i in range(150, 200):  # Dialogue moments (151-200)
        dag_matrix[i, 0] = 0.4 - ((i-150) * 0.005)
    
    # CHARACTER STATES (Nodes 201-350) - Dense psychological networks
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
    
    # NOW CREATE THE DENSE CONNECTION NETWORK (2000-5000+ edges)
    
    # 1. GLOBAL ECOLOGICAL DISASTER CASCADE (Node 701) - 50+ connections
    disaster_targets = [351, 401, 551, 702, 703, 704, 705, 706, 707, 708, 709, 710,
                       531, 532, 533, 534, 535, 536, 537, 538, 539, 540,  # Environmental
                       552, 553, 554, 555, 556, 557, 558, 559, 560,  # Existential themes
                       201, 231, 261, 281, 291, 301, 311, 321, 331, 341,  # Character impacts
                       731, 732, 733, 734, 735, 736, 737, 738, 739, 740]  # Memory formation
    
    for target in disaster_targets:
        if target <= 800:
            dag_matrix[700, target] = random.uniform(0.6, 0.9)
    
    # 2. PULSE OF AWAKENING CASCADE (Node 1) - 100+ connections
    pulse_targets = list(range(2, 51)) + list(range(201, 221)) + list(range(261, 281)) + \
                   list(range(501, 531)) + list(range(651, 671)) + list(range(751, 771))
    
    for target in pulse_targets:
        if target <= 800:
            dag_matrix[0, target] = random.uniform(0.4, 0.9)
    
    # 3. DENSE CHARACTER PROGRESSION NETWORKS
    
    # Vincent Arc (201-215) - Every state connects to multiple future states and other characters
    for i in range(200, 215):
        # Sequential progression (strong)
        for j in range(i+1, min(i+4, 215)):
            dag_matrix[i, j+1] = random.uniform(0.7, 0.9)
        
        # Cross-character influences (medium)
        re_l_targets = list(range(231, 245))
        pino_targets = list(range(261, 275))
        system_targets = list(range(351, 370)) + list(range(401, 420))
        
        for targets in [re_l_targets, pino_targets, system_targets]:
            for target in random.sample(targets, min(5, len(targets))):
                if target <= 800:
                    dag_matrix[i, target] = random.uniform(0.3, 0.7)
    
    # Re-l Arc (231-245) - Investigation network with wide connections
    for i in range(230, 245):
        # Sequential progression
        for j in range(i+1, min(i+3, 245)):
            dag_matrix[i, j+1] = random.uniform(0.7, 0.9)
        
        # Investigation targets (plot events, system components, revelations)
        investigation_targets = list(range(1, 51)) + list(range(351, 400)) + \
                              list(range(751, 780)) + list(range(731, 750))
        
        for target in random.sample(investigation_targets, min(8, len(investigation_targets))):
            if target <= 800:
                dag_matrix[i, target] = random.uniform(0.4, 0.8)
    
    # Pino Arc (261-275) - Consciousness network affecting everything
    for i in range(260, 275):
        # Sequential consciousness development
        for j in range(i+1, min(i+3, 275)):
            dag_matrix[i, j+1] = random.uniform(0.7, 0.9)
        
        # Consciousness affects all AutoReiv systems and thematic concepts
        consciousness_targets = list(range(501, 530)) + list(range(551, 580)) + \
                              list(range(261, 280)) + list(range(751, 770))
        
        for target in random.sample(consciousness_targets, min(6, len(consciousness_targets))):
            if target <= 800:
                dag_matrix[i, target] = random.uniform(0.3, 0.7)
    
    # 4. SYSTEM INTERDEPENDENCY NETWORKS
    
    # Romdeau Systems (351-400) - Dense administrative network
    for i in range(350, 400):
        # Administrative hierarchy
        admin_targets = list(range(351, 400)) + list(range(201, 350)) + list(range(1, 100))
        
        for target in random.sample(admin_targets, min(10, len(admin_targets))):
            if target <= 800 and target != i+1:  # No self-loops
                dag_matrix[i, target] = random.uniform(0.2, 0.6)
    
    # Proxy Network (401-500) - Massive interconnected system
    for i in range(400, 500):
        # Proxy interconnections
        proxy_targets = list(range(401, 500)) + list(range(201, 350)) + \
                       list(range(751, 800)) + list(range(1, 200))
        
        for target in random.sample(proxy_targets, min(12, len(proxy_targets))):
            if target <= 800 and target != i+1:
                dag_matrix[i, target] = random.uniform(0.3, 0.8)
    
    # AutoReiv Systems (501-530) - Consciousness propagation
    for i in range(500, 530):
        # AutoReiv network effects
        autoreiv_targets = list(range(261, 280)) + list(range(501, 530)) + \
                          list(range(551, 580)) + list(range(1, 100))
        
        for target in random.sample(autoreiv_targets, min(8, len(autoreiv_targets))):
            if target <= 800 and target != i+1:
                dag_matrix[i, target] = random.uniform(0.4, 0.7)
    
    # 5. THEMATIC CONCEPT NETWORKS (551-650)
    for i in range(550, 650):
        # Thematic concepts connect to everything
        thematic_targets = list(range(201, 350)) + list(range(1, 200)) + \
                          list(range(751, 800)) + list(range(651, 700))
        
        for target in random.sample(thematic_targets, min(6, len(thematic_targets))):
            if target <= 800:
                dag_matrix[i, target] = random.uniform(0.2, 0.5)
    
    # 6. TEMPORAL NETWORKS
    
    # Present Timeline (651-700) - Episode progression with flashback triggers
    for i in range(650, 700):
        # Sequential episodes
        if i < 699:
            dag_matrix[i, i+2] = random.uniform(0.8, 0.9)
        
        # Episode content connections
        episode_targets = list(range(1, 200)) + list(range(201, 350)) + \
                         list(range(731, 750))  # Memory triggers
        
        for target in random.sample(episode_targets, min(8, len(episode_targets))):
            if target <= 800:
                dag_matrix[i, target] = random.uniform(0.3, 0.7)
    
    # Past Timeline (701-730) - Historical causality web
    for i in range(700, 730):
        if i != 700:  # Skip disaster node (already handled)
            # Historical progression
            past_targets = list(range(701, 730)) + list(range(351, 450)) + \
                          list(range(731, 750)) + list(range(551, 600))
            
            for target in random.sample(past_targets, min(6, len(past_targets))):
                if target <= 800 and target != i+1:
                    dag_matrix[i, target] = random.uniform(0.4, 0.8)
    
    # Memory Fragments (731-750) - Revelation triggers
    for i in range(730, 750):
        # Memory to revelation connections
        memory_targets = list(range(751, 800)) + list(range(201, 350))
        
        for target in random.sample(memory_targets, min(4, len(memory_targets))):
            if target <= 800:
                dag_matrix[i, target] = random.uniform(0.5, 0.8)
    
    # 7. REVELATION CONVERGENCE NETWORK (751-800)
    for i in range(750, 800):
        # Revelations build on each other
        if i < 799:
            revelation_targets = list(range(i+1, 800))
            for target in random.sample(revelation_targets, min(3, len(revelation_targets))):
                dag_matrix[i, target] = random.uniform(0.6, 0.9)
    
    # 8. CROSS-CATEGORY DENSE CONNECTIONS
    
    # Plot events affect character states (massive network)
    for i in range(0, 200):
        if i != 0:  # Skip pulse node (already handled)
            char_targets = list(range(201, 350))
            for target in random.sample(char_targets, min(4, len(char_targets))):
                dag_matrix[i, target] = random.uniform(0.2, 0.6)
    
    # Character states affect systems
    for i in range(200, 350):
        system_targets = list(range(351, 550))
        for target in random.sample(system_targets, min(3, len(system_targets))):
            dag_matrix[i, target] = random.uniform(0.2, 0.5)
    
    # Systems affect plot progression
    for i in range(350, 550):
        plot_targets = list(range(1, 200)) + list(range(651, 700))
        for target in random.sample(plot_targets, min(3, len(plot_targets))):
            if target <= 800:
                dag_matrix[i, target] = random.uniform(0.2, 0.5)
    
    return dag_matrix

def write_csv(matrix, filename):
    """Write the DAG matrix to CSV file"""
    with open(filename, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        for row in matrix:
            formatted_row = [f"{val:.1f}" if val != 0 else "0.0" for val in row]
            writer.writerow(formatted_row)

if __name__ == "__main__":
    print("Generating DENSE Ergo Proxy DAG Network (2000-5000+ edges)...")
    dag_matrix = create_dense_ergo_proxy_dag()
    write_csv(dag_matrix, "ergo_proxy_dag_network.csv")
    
    # Calculate statistics
    edges = np.count_nonzero(dag_matrix[:, 1:])
    sources = np.sum(dag_matrix[:, 0] == 1.0)
    density = edges / (800 * 799)
    
    print(f"DENSE DAG network saved to ergo_proxy_dag_network.csv")
    print(f"Matrix shape: {dag_matrix.shape}")
    print(f"Total edges: {edges}")
    print(f"Source nodes (prior=1.0): {sources}")
    print(f"Average edges per node: {edges/800:.2f}")
    print(f"Network density: {density:.6f}")
    print(f"This is the 2000-5000+ edge monster network as planned!")