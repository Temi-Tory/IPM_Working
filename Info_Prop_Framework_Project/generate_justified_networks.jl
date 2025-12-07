"""
Generate Justified Network Topologies for Belief Propagation Case Studies

Standalone script to generate 5 justified network topologies based on the paper:
"Conceptual design of a medical drone logistics network for Scotland"

All networks have 244 nodes but different edge topologies optimized for:
1. Cost (minimal infrastructure)
2. Time (fast delivery with K=2 redundancy)
3. Balance (K=3 redundancy)
4. Resilience (K=5 maximum redundancy)
5. Geographic proximity (natural topology)

Usage:
    julia generate_justified_networks.jl
"""

include("drone_network_to_dag.jl")

# Run the generation
generate_all_justified_networks()
