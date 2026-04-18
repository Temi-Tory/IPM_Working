# MonteCarloOptimizedModule

This folder contains the optimized Monte Carlo baseline implementation used to estimate activation/reachability probabilities over sampled graph realizations.

## Public API

- `MC_result_optimized`
- `find_all_reachable`

## Files

- `MC_Optimized.jl`: implementation
- `MonteCarloOptimizedModule.jl`: module wrapper and exports

## Dependencies

- No algorithmic cross-module dependency by default.
- Intended as a validation/benchmark companion to deterministic propagation algorithms.

## Packaging Guidance

- Keep this module isolated so Monte Carlo logic can evolve independently.
- If new random strategies are added, keep the top-level API stable for reproducibility scripts.
