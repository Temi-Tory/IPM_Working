# ReachabilityModule: Mathematical Documentation

## Overview

The `ReachabilityModule` implements a sophisticated probabilistic belief propagation algorithm for computing node reachability probabilities in directed acyclic graphs (DAGs). The module handles complex dependency structures that arise when multiple paths converge at nodes, using advanced probabilistic reasoning techniques to avoid double-counting and maintain mathematical correctness.

## Mathematical Framework

### 1. Probabilistic Network Model

The algorithm operates on a directed graph G = (V, E) with the following probabilistic structure:

- **Node Priors**: Each node i ∈ V has a prior probability P₀(i) ∈ [0,1] representing its baseline activation probability
- **Edge Probabilities**: Each edge (i,j) ∈ E has a transmission probability P(j|i) ∈ [0,1] representing the probability that node j activates given that node i is active
- **Source Nodes**: A subset S ⊆ V of nodes with no incoming edges, whose activation probabilities are fixed to their priors

### 2. Belief Propagation Objective

For each node i ∈ V, we compute the posterior belief B(i), which represents the probability that node i becomes activated through the network propagation process. This combines:

- **Prior probability**: The node's intrinsic activation likelihood
- **Evidence from parents**: Probabilistic influence from upstream nodes

The mathematical relationship is:
```
B(i) = P₀(i) × Evidence(i)
```

where Evidence(i) is the combined probabilistic influence from all paths reaching node i.

### 3. Inclusion-Exclusion Principle for Independent Paths

For nodes with multiple parent nodes, naive probability summation leads to overcounting. Instead, we apply the inclusion-exclusion principle assuming independence between different activation paths.

For a node i with parents {p₁, p₂, ..., pₙ}, the evidence is computed as:

```
Evidence(i) = Σⱼ P(activation via pⱼ) 
            - Σⱼ<ₖ P(activation via pⱼ AND pₖ)
            + Σⱼ<ₖ<ₗ P(activation via pⱼ AND pₖ AND pₗ)
            - ...
            + (-1)ⁿ⁺¹ P(activation via p₁ AND p₂ AND ... AND pₙ)
```

where:
```
P(activation via pⱼ) = B(pⱼ) × P(i|pⱼ)
P(activation via pⱼ AND pₖ) = B(pⱼ) × P(i|pⱼ) × B(pₖ) × P(i|pₖ)
```

This assumes that the activation events from different parents are independent.

### 4. Diamond Structures and Dependency Resolution

#### 4.1 Diamond Structure Definition

A **diamond structure** occurs when multiple paths from a common ancestor converge at a node, violating the independence assumption required for inclusion-exclusion. Formally, this happens when:

- There exists a fork node f that has multiple outgoing paths
- These paths reconverge at a join node j
- The paths share common probabilistic dependencies through f

#### 4.2 Mathematical Problem with Simple Inclusion-Exclusion

In diamond structures, the standard inclusion-exclusion formula fails because:
```
P(path₁ AND path₂) ≠ P(path₁) × P(path₂)
```

The paths are conditionally dependent given the state of the fork node.

#### 4.3 Conditioning Solution

For diamond structures, we use **total probability conditioning** over the states of fork nodes. Let F = {f₁, f₂, ..., fₖ} be the set of conditioning nodes (typically fork nodes). We compute:

```
P(target activated) = Σₛ P(target activated | state s) × P(state s)
```

where the sum is over all 2ᵏ possible binary states s = (s₁, s₂, ..., sₖ) ∈ {0,1}ᵏ of the conditioning nodes.

For each state s:
- **State probability**: P(state s) = ∏ᵢ [sᵢ × B(fᵢ) + (1-sᵢ) × (1-B(fᵢ))]
- **Conditional probability**: P(target|state s) is computed by running belief propagation with conditioning nodes fixed to their values in s

### 5. Algorithm Flow

#### 5.1 Topological Processing

Nodes are processed in topologically sorted order (via `iteration_sets`) to ensure that when computing beliefs for node i, all of its ancestors have already been processed.

#### 5.2 Node Classification

The algorithm distinguishes between:
- **Source nodes**: B(i) = P₀(i) (fixed activation probabilities)
- **Regular nodes**: Use inclusion-exclusion for independent parents
- **Join nodes in diamond structures**: Use conditioning approach
- **Fork nodes**: Standard processing, but may serve as conditioning variables for downstream diamonds

#### 5.3 Recursive Diamond Resolution

For complex networks with nested diamond structures, the algorithm recursively applies conditioning:

1. Identify diamond structures at each join node
2. For each diamond, recursively solve sub-problems with appropriate conditioning
3. Combine results using the conditioning formula

### 6. Mathematical Guarantees

#### 6.1 Probability Conservation

All computed beliefs B(i) ∈ [0,1] are valid probabilities, ensured by:
- Input validation of priors and edge probabilities
- Mathematical properties of inclusion-exclusion and conditioning

#### 6.2 Conditional Independence Assumptions

The algorithm assumes:
- **Conditional independence**: Given the state of fork nodes, different paths are independent
- **Memoryless propagation**: Node activation depends only on immediate parents, not on the history of activation

#### 6.3 Exact Computation

For DAGs satisfying the conditional independence assumptions, the algorithm computes exact posterior probabilities. The conditioning approach for diamond structures ensures mathematical correctness even in complex dependency scenarios.

## Key Functions

### `inclusion_exclusion(belief_values::Vector{Float64})`
Implements the mathematical inclusion-exclusion principle for combining independent probability sources.

### `updateDiamondJoin(...)`
Handles diamond structures using total probability conditioning over fork node states.

### `update_beliefs_iterative(...)`
Main belief propagation algorithm that orchestrates the mathematical computation across the entire network.

## Applications

This mathematical framework is applicable to:
- **Network reliability analysis**: Computing failure/success propagation probabilities
- **Information diffusion**: Modeling probability of information reaching nodes
- **Epidemiological modeling**: Disease spread through contact networks
- **Causal inference**: Probabilistic reasoning in causal DAGs
- **Fault tree analysis**: Computing system failure probabilities

## Computational Complexity

- **Regular nodes**: O(2ⁿ) where n is the number of parents (inclusion-exclusion)
- **Diamond structures**: O(2ᵏ) where k is the number of conditioning nodes
- **Overall**: Depends on network structure, but exponential in the width of diamond structures