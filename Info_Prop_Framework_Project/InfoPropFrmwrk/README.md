# InfoPropFrmwrk

Information propagation and network analysis framework in Julia, with modular algorithms for:

- input/network processing
- diamond decomposition
- probability propagation
- critical path analysis
- Monte Carlo validation
- flow-capacity analysis

## Quickstart (Local Workspace)

```julia
using Pkg
Pkg.activate(".")
Pkg.instantiate()

include("src/InfoPropFrmwrk.jl")
using .InfoPropFrmwrk

# Access the unified algorithms facade module
F = InfoPropFramework
```

## Quickstart (Package Style)

After adding this repository as a package in your environment:

```julia
using InfoPropFrmwrk
F = InfoPropFramework
```

## Minimal Example

```julia
include("src/InfoPropFrmwrk.jl")
using .InfoPropFrmwrk

edgelist, outgoing_index, incoming_index, source_nodes =
    InfoPropFramework.read_graph_to_dict("example-networks/water-highvdemo/water-highvdemo.EDGES")

fork_nodes, join_nodes =
    InfoPropFramework.identify_fork_and_join_nodes(outgoing_index, incoming_index)

iteration_sets, ancestors, descendants =
    InfoPropFramework.find_iteration_sets(edgelist, outgoing_index, incoming_index)
```

## API Organization

Core facade:

- `src/Algorithms/InfoPropFramework.jl`

Root package entrypoint:

- `src/InfoPropFrmwrk.jl`

Algorithm docs:

- `src/Algorithms/README.md`
- `src/Algorithms/ProbabilityPropagation/README.md`
- `src/Algorithms/DiamondDecomposition/README.md`
- `src/Algorithms/CriticalPath/README.md`
- `src/Algorithms/MonteCarlo/README.md`
- `src/Algorithms/FlowCapacity/README.md`

## Notes

- Some environments with Julia 1.12 may surface external precompile warnings from `ProbabilityBoundsAnalysis` dependency behavior.
- This repository keeps algorithm logic stable; structural refactors are focused on packaging and maintainability.
