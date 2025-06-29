#!/usr/bin/env python3
"""
Generate Ergo Proxy DAG Network CSV
Based on the comprehensive architecture design
"""

import csv
import numpy as np

def create_ergo_proxy_dag():
    """Create the complete 800-node Ergo Proxy DAG network"""
    
    # Initialize 800x801 matrix (800 nodes + 1 for prior probabilities)
    # First column: prior probabilities
    # Remaining 800 columns: edge probabilities to each node
    dag_matrix = np.zeros((800, 801))
    
    # Set all first column values (prior probabilities)
    # Source nodes get 1.0, others get decreasing probabilities based on type
    
    # SOURCE NODES (Prior = 1.0)
    source_nodes = [1, 351, 401, 551, 651, 701]  # Convert to 0-indexed
    for node in source_nodes:
        dag_matrix[node-1, 0] = 1.0
    
    # PLOT EVENTS (Nodes 1-200)
    # Major events: higher priors, minor events: lower priors
    for i in range(0, 50):  # Major events (1-50)
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.8 - (i * 0.01)  # Decreasing from 0.8
    
    for i in range(50, 150):  # Scene events (51-150)
        dag_matrix[i, 0] = 0.6 - ((i-50) * 0.005)  # Decreasing from 0.6
    
    for i in range(150, 200):  # Dialogue moments (151-200)
        dag_matrix[i, 0] = 0.4 - ((i-150) * 0.005)  # Decreasing from 0.4
    
    # CHARACTER STATES (Nodes 201-350)
    # Vincent states (201-230): Decreasing psychological progression
    for i in range(200, 230):
        dag_matrix[i, 0] = 0.8 - ((i-200) * 0.025)  # 0.8 down to 0.1
    
    # Re-l states (231-260): Similar progression
    for i in range(230, 260):
        dag_matrix[i, 0] = 0.9 - ((i-230) * 0.025)  # 0.9 down to 0.2
    
    # Pino states (261-280): Consciousness development
    for i in range(260, 280):
        dag_matrix[i, 0] = 0.9 - ((i-260) * 0.04)  # 0.9 down to 0.1
    
    # Other characters (281-350)
    for i in range(280, 350):
        dag_matrix[i, 0] = 0.7 - ((i-280) * 0.008)  # 0.7 down to 0.14
    
    # SYSTEM COMPONENTS (Nodes 351-550)
    # Romdeau systems (351-400)
    for i in range(350, 400):
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.8 - ((i-350) * 0.01)  # 0.8 down to 0.3
    
    # Proxy network (401-500)
    for i in range(400, 500):
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.7 - ((i-400) * 0.005)  # 0.7 down to 0.2
    
    # AutoReiv systems (501-530)
    for i in range(500, 530):
        dag_matrix[i, 0] = 0.6 - ((i-500) * 0.015)  # 0.6 down to 0.15
    
    # Environmental (531-550)
    for i in range(530, 550):
        dag_matrix[i, 0] = 0.5 - ((i-530) * 0.02)  # 0.5 down to 0.1
    
    # THEMATIC CONCEPTS (Nodes 551-650)
    for i in range(550, 650):
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.6 - ((i-550) * 0.004)  # 0.6 down to 0.2
    
    # TEMPORAL ELEMENTS (Nodes 651-750)
    # Present timeline (651-700)
    for i in range(650, 700):
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.8 - ((i-650) * 0.01)  # 0.8 down to 0.3
    
    # Past timeline (701-730) - includes source node 701
    for i in range(700, 730):
        if i+1 not in source_nodes:
            dag_matrix[i, 0] = 0.7 - ((i-700) * 0.02)  # 0.7 down to 0.1
    
    # Memory fragments (731-750)
    for i in range(730, 750):
        dag_matrix[i, 0] = 0.3 - ((i-730) * 0.01)  # 0.3 down to 0.1
    
    # REVELATION NODES (Nodes 751-800)
    for i in range(750, 800):
        dag_matrix[i, 0] = 0.2 - ((i-750) * 0.002)  # 0.2 down to 0.1
    
    # Now set up the key connections based on the architecture
    
    # GLOBAL ECOLOGICAL DISASTER (Node 701) connections
    dag_matrix[700, 351] = 0.9  # To Romdeau Foundation
    dag_matrix[700, 401] = 0.9  # To Proxy Project
    dag_matrix[700, 551] = 0.8  # To Existential Crisis
    dag_matrix[700, 702] = 0.8  # To Environmental Collapse
    
    # PULSE OF AWAKENING (Node 1) connections
    dag_matrix[0, 2] = 0.9   # To AutoReiv Awakening
    dag_matrix[0, 3] = 0.8   # To Proxy Activation
    dag_matrix[0, 4] = 0.7   # To System Destabilization
    dag_matrix[0, 51] = 0.8  # To Pino Awakening
    dag_matrix[0, 201] = 0.9 # To Vincent Initial State
    
    # ROMDEAU FOUNDATION (Node 351) connections
    dag_matrix[350, 1] = 0.8   # To Pulse of Awakening
    dag_matrix[350, 352] = 0.9 # To Dome Civilization
    dag_matrix[350, 353] = 0.8 # To System Infrastructure
    dag_matrix[350, 201] = 0.6 # To Vincent Initial State
    
    # PROXY PROJECT (Node 401) connections
    dag_matrix[400, 1] = 0.7   # To Pulse of Awakening
    dag_matrix[400, 402] = 0.9 # To Proxy Network
    dag_matrix[400, 410] = 0.8 # To Network Hub
    dag_matrix[400, 751] = 0.4 # To Identity Revelation
    
    # VINCENT CHARACTER ARC (Nodes 201-215)
    # Sequential progression with decreasing probabilities
    for i in range(200, 214):
        dag_matrix[i, i+2] = 0.9  # Strong progression to next state
        if i < 213:
            dag_matrix[i, i+3] = 0.6  # Weaker connection to state after next
    
    # Vincent interactions with other characters
    dag_matrix[200, 231] = 0.3  # Vincent -> Re-l suspicion
    dag_matrix[200, 261] = 0.2  # Vincent -> Pino interaction
    dag_matrix[204, 235] = 0.7  # Vincent fear -> Re-l suspicion
    dag_matrix[209, 268] = 0.6  # Vincent transformation -> Pino love
    dag_matrix[214, 245] = 0.9  # Vincent integration -> Re-l understanding
    
    # RE-L CHARACTER ARC (Nodes 231-245)
    # Sequential progression
    for i in range(230, 244):
        dag_matrix[i, i+2] = 0.8  # Progression to next state
    
    # Re-l interactions
    dag_matrix[234, 235] = 0.8  # Investigation -> Suspicion
    dag_matrix[235, 236] = 0.7  # Suspicion -> Personal investment
    dag_matrix[239, 240] = 0.9  # Truth pursuit -> Exile
    dag_matrix[242, 243] = 0.8  # Relationship growth -> Identity evolution
    
    # PINO CHARACTER ARC (Nodes 261-275)
    # Consciousness development
    for i in range(260, 274):
        dag_matrix[i, i+2] = 0.8  # Sequential development
    
    # Pino interactions
    dag_matrix[261, 262] = 0.7  # Standard -> Cogito infection
    dag_matrix[265, 266] = 0.6  # Curiosity -> Attachment
    dag_matrix[268, 269] = 0.8  # Love -> Moral awareness
    dag_matrix[272, 273] = 0.9  # Sacrifice -> Humanity achievement
    
    # SYSTEM CASCADES
    # AutoReiv awakening cascade
    dag_matrix[1, 261] = 0.8   # Pulse -> Pino awakening
    dag_matrix[1, 501] = 0.7   # Pulse -> AutoReiv systems
    dag_matrix[261, 502] = 0.6 # Pino -> Other AutoReiv effects
    
    # Proxy network cascade
    dag_matrix[2, 402] = 0.9   # Proxy activation -> Network response
    dag_matrix[402, 403] = 0.8 # Network -> Individual proxies
    dag_matrix[403, 404] = 0.7 # Proxy connections
    
    # REVELATION CONVERGENCE (Nodes 751-800)
    # Character revelations feed into system revelations
    dag_matrix[214, 751] = 0.6 # Vincent integration -> Identity revelation
    dag_matrix[244, 751] = 0.5 # Re-l understanding -> Identity revelation
    dag_matrix[274, 751] = 0.4 # Pino maturity -> Identity revelation
    
    # System revelations
    dag_matrix[750, 791] = 0.8 # Identity -> System truth
    dag_matrix[790, 799] = 0.9 # System truth -> Final convergence
    
    # TEMPORAL CONNECTIONS
    # Present timeline progression
    for i in range(650, 699):
        if i < 698:
            dag_matrix[i, i+2] = 0.9  # Sequential episode progression
    
    # Past timeline to present understanding
    dag_matrix[701, 731] = 0.6 # Historical event -> Memory fragment
    dag_matrix[702, 732] = 0.5 # Environmental collapse -> Memory
    dag_matrix[730, 751] = 0.7 # Memory fragments -> Revelations
    
    # CROSS-SYSTEM DEPENDENCIES
    # Technology affects characters
    dag_matrix[351, 201] = 0.6 # Romdeau system -> Vincent
    dag_matrix[401, 201] = 0.5 # Proxy project -> Vincent
    dag_matrix[501, 261] = 0.8 # AutoReiv system -> Pino
    
    # Characters affect systems
    dag_matrix[214, 352] = 0.4 # Vincent integration -> System change
    dag_matrix[244, 353] = 0.3 # Re-l understanding -> System change
    
    # THEMATIC CONNECTIONS
    # Existential themes connect to character development
    dag_matrix[551, 201] = 0.5 # Existential crisis -> Vincent
    dag_matrix[552, 231] = 0.4 # Identity theme -> Re-l
    dag_matrix[553, 261] = 0.6 # Reality theme -> Pino
    
    return dag_matrix

def write_csv(matrix, filename):
    """Write the DAG matrix to CSV file"""
    with open(filename, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        for row in matrix:
            # Format numbers to avoid scientific notation
            formatted_row = [f"{val:.1f}" if val != 0 else "0.0" for val in row]
            writer.writerow(formatted_row)

if __name__ == "__main__":
    print("Generating Ergo Proxy DAG Network...")
    dag_matrix = create_ergo_proxy_dag()
    write_csv(dag_matrix, "ergo_proxy_dag_network.csv")
    print("DAG network saved to ergo_proxy_dag_network.csv")
    print(f"Matrix shape: {dag_matrix.shape}")
    print(f"Non-zero connections: {np.count_nonzero(dag_matrix[:, 1:])}")
    print(f"Source nodes (prior=1.0): {np.sum(dag_matrix[:, 0] == 1.0)}")