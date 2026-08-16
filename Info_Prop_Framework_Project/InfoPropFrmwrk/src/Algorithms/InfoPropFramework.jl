module InfoPropFramework

include(joinpath(@__DIR__, "Shared", "InputProcessingModule.jl"))
using .InputProcessingModule

include(joinpath(@__DIR__, "Shared", "GraphValidationModule.jl"))
using .GraphValidationModule

include(joinpath(@__DIR__, "Shared", "GraphTraversalModule.jl"))
using .GraphTraversalModule

include(joinpath(@__DIR__, "DiamondDecomposition", "DiamondDecompositionModule.jl"))
using .DiamondDecompositionModule

include(joinpath(@__DIR__, "CriticalPath", "CriticalPathModule.jl"))
using .CriticalPathModule

include(joinpath(@__DIR__, "ProbabilityPropagation", "ProbabilityPropagationModule.jl"))
using .ProbabilityPropagationModule


include(joinpath(@__DIR__, "FlowCapacity", "CapacityAnalysisKit.jl"))
using .CapacityAnalysisKit

export
    # Input processing
    InputProcessingModule,
    Interval,
    pbox,
    PBA,
    read_graph_to_dict,
    read_edge_capacities_from_json,
    read_node_capacities_from_json,
    read_capacities_input,
    read_node_priors_from_json,
    read_edge_probabilities_from_json,
    read_node_priors_from_json_pbox,
    read_edge_probabilities_from_json_pbox,
    read_node_priors_from_json_interval,
    read_edge_probabilities_from_json_interval,
    read_node_priors_from_json_float64,
    read_edge_probabilities_from_json_float64,
    identify_fork_and_join_nodes,
    find_iteration_sets,
    read_complete_network,
    # Diamond decomposition toolkit
    DiamondDecompositionModule,
    Diamond,
    DiamondsAtNode,
    DiamondComputationData,
    new_identify,
    create_diamond_hash_key,
    # Critical path toolkit
    CriticalPathModule,
    CriticalPathParameters,
    CriticalPathResult,
    ExtendedCriticalPathResult,
    critical_path_analysis,
    backward_pass_analysis,
    # Probability propagation toolkit
    ProbabilityPropagationModule,
    update_beliefs_iterative,
    validate_network_data,
    calculate_regular_belief,
    inclusion_exclusion,
    updateDiamondJoin,
    calculate_diamond_groups_belief,
    DiamondCacheEntry,
    CacheKey,
    make_cache_key,
    # Flow-capacity toolkit
    CapacityAnalysisKit,
    CapacityAnalysisKitResult,
    analyze_all,
    solve_max_flow_dinic,
    solve_max_flow_edmonds_karp,
    solve_max_flow_push_relabel

end # module InfoPropFramework
