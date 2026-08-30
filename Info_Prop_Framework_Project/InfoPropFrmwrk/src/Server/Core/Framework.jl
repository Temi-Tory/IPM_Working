# Adapter over the registered algorithm package.
#
# The Server handlers were written against a local `Algorithms/InfoPropFramework.jl`
# facade with a flat export list. That algorithm layer is now the registered package
# `InformationPropagationAnalysis` (v0.2.0+), whose public API is namespaced by toolkit
# (`Input`, `Diamonds`, `Probability`, `CriticalPath`, `Flow`). This module keeps the
# name `InfoPropFramework` and re-flattens exactly the symbols the handlers use, plus
# aliases the two old internal module names they still reference by name
# (`CriticalPathV2Module` → `CriticalPath`, `CapacityAnalysisKit` → `Flow`). Handlers
# are unchanged.
module InfoPropFramework

using InformationPropagationAnalysis
const IPA = InformationPropagationAnalysis

using InformationPropagationAnalysis.Input:
    read_graph_to_dict, read_complete_network,
    find_iteration_sets, identify_fork_and_join_nodes,
    read_node_priors_from_json, read_edge_probabilities_from_json,
    read_node_priors_from_json_pbox, read_edge_probabilities_from_json_pbox,
    read_node_priors_from_json_interval, read_edge_probabilities_from_json_interval,
    read_node_priors_from_json_float64, read_edge_probabilities_from_json_float64,
    read_edge_capacities_from_json, read_node_capacities_from_json, read_capacities_input

using InformationPropagationAnalysis.Diamonds:
    Diamond, DiamondsAtNode, DiamondComputationData, new_identify, create_diamond_hash_key

using InformationPropagationAnalysis.Probability:
    update_beliefs_iterative, validate_network_data,
    calculate_regular_belief, inclusion_exclusion,
    CacheKey, DiamondCacheEntry, make_cache_key

using InformationPropagationAnalysis.Flow:
    analyze_all,
    solve_max_flow_dinic, solve_max_flow_edmonds_karp, solve_max_flow_push_relabel

using InformationPropagationAnalysis: Interval, pbox
const PBA = IPA.PBA

# old internal module names the Server refers to directly
const CriticalPathV2Module = IPA.CriticalPath
const CapacityAnalysisKit = IPA.Flow
const CapacityAnalysisKitResult = IPA.Flow.FlowCapacityResult

export
    read_graph_to_dict, read_complete_network,
    find_iteration_sets, identify_fork_and_join_nodes,
    read_node_priors_from_json, read_edge_probabilities_from_json,
    read_node_priors_from_json_pbox, read_edge_probabilities_from_json_pbox,
    read_node_priors_from_json_interval, read_edge_probabilities_from_json_interval,
    read_node_priors_from_json_float64, read_edge_probabilities_from_json_float64,
    read_edge_capacities_from_json, read_node_capacities_from_json, read_capacities_input,
    Diamond, DiamondsAtNode, DiamondComputationData, new_identify, create_diamond_hash_key,
    update_beliefs_iterative, validate_network_data,
    calculate_regular_belief, inclusion_exclusion,
    CacheKey, DiamondCacheEntry, make_cache_key,
    analyze_all,
    solve_max_flow_dinic, solve_max_flow_edmonds_karp, solve_max_flow_push_relabel,
    Interval, pbox, PBA,
    CriticalPathV2Module, CapacityAnalysisKit, CapacityAnalysisKitResult

end # module InfoPropFramework
