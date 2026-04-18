# Package Deployment Readiness

This document tracks non-logic readiness items for publishing the framework as a Julia package.

## Completed (This Pass)

- Algorithms reorganized into domain folders:
  - `src/Algorithms/DiamondDecomposition/`
  - `src/Algorithms/ProbabilityPropagation/`
  - `src/Algorithms/CriticalPath/`
  - `src/Algorithms/MonteCarlo/`
- Added module wrapper for Monte Carlo exports:
  - `src/Algorithms/MonteCarlo/MonteCarloOptimizedModule.jl`
- Integrated modules into the unified facade:
  - `src/Algorithms/InfoPropFramework.jl`
- Added module READMEs:
  - `src/Algorithms/README.md`
  - `src/Algorithms/DiamondDecomposition/README.md`
  - `src/Algorithms/ProbabilityPropagation/README.md`
  - `src/Algorithms/CriticalPath/README.md`
  - `src/Algorithms/MonteCarlo/README.md`

## Blocking Items Before Real Package Publish

1. `Project.toml` metadata
   - Add `name`
   - Add `uuid`
   - Add `version`

2. Package entrypoint module file
   - Add `src/<PackageName>.jl` as canonical package root module
   - Include and re-export `src/Algorithms/InfoPropFramework.jl` from that root

3. Top-level package README
   - Add usage examples for deterministic and uncertainty-aware workflows
   - Document environment setup and minimal end-to-end example

4. Test and CI hardening
   - Ensure test suite covers all newly surfaced modules from facade exports
   - Add CI matrix for supported Julia versions

## External Dependency Note

Current environment reports warnings/errors from `ProbabilityBoundsAnalysis` precompilation due method overwrite behavior in Julia 1.12. This is external to this repository logic but should be documented in release notes/environment compatibility guidance.
