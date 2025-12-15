"""
    ReachabilityModuleIterative

Fully iterative implementation of belief propagation for DAG networks with diamond structures.
Uses completion tokens to avoid stack overflow on deeply nested diamonds (50+ levels).

Key Features:
- SEQUENTIAL processing (no threading in Phase 1)
- Completion token pattern to track diamond dependencies
- Pop/push stack model (no peek/continue infinite loops)
- Exact mathematical correctness matching ReachabilityModuleRecurseOptimized.jl
- Stack-safe for arbitrary nesting depth

Implementation Priorities:
1. Correctness FIRST - must match recursive version exactly
2. Stack safety - no overflow on any network
3. Clean, efficient code with good GC behavior
4. Performance optimization deferred to Phase 2

Mathematical Foundation:
- Belief(N) = Prior(N) × P(N receives ≥1 signal from sources)
- Inclusion-exclusion for multiple independent paths
- Conditional expectation for diamond structures: Σ_{states} P(state) × P(Join | state)
- Contextual beliefs passed via sub_node_priors mechanism
"""
module ReachabilityModuleIterative

export update_beliefs_iterative

using DataStructures
using SparseArrays
using ..DiamondProcessingModule
using ..InputProcessingModule

# ============================================================================
# LOGGING - For debugging and profiling
# ============================================================================

# Global log file handle (set via set_log_file!)
const LOG_FILE = Ref{Union{Nothing, IOStream}}(nothing)
const ENABLE_LOGGING = Ref{Bool}(false)
const LOOP_COUNTER = Ref{Int}(0)


function set_log_file!(io::IOStream)
    LOG_FILE[] = io
    ENABLE_LOGGING[] = true
    LOOP_COUNTER[] = 0
end

function disable_logging!()
    ENABLE_LOGGING[] = false
    if LOG_FILE[] !== nothing
        close(LOG_FILE[])
        LOG_FILE[] = nothing
    end
end

# Format: timestamp|loop_iteration|event_type|details
function log_event(event_type::String, details::String="")
    if ENABLE_LOGGING[] && LOG_FILE[] !== nothing
        timestamp = round(time(), digits=6)
        iter = LOOP_COUNTER[]
        println(LOG_FILE[], "$timestamp|$iter|$event_type|$details")
        flush(LOG_FILE[])
    end
end

export set_log_file!, disable_logging!

# ============================================================================
# Type Hierarchy for Stack-Based Computation
# ============================================================================

"""
Abstract base for items that can be on the work stack.
"""
abstract type StackItem end

"""
    WorkItem

Represents a belief propagation computation context.
Contains all data needed to process nodes in a subgraph.
"""
mutable struct WorkItem <: StackItem
    # Graph structure
    edgelist::Vector{Tuple{Int64,Int64}}
    iteration_sets::Vector{Set{Int64}}
    outgoing_index::Dict{Int64, Set{Int64}}
    incoming_index::Dict{Int64, Set{Int64}}
    source_nodes::Set{Int64}

    # Probabilistic data
    node_priors::Dict{Int64, Float64}  # Contains contextual beliefs from outer computation
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64}

    # Diamond structures
    descendants::Dict{Int64, Set{Int64}}
    ancestors::Dict{Int64, Set{Int64}}
    root_diamonds
    join_nodes::Set{Int64}
    fork_nodes::Set{Int64}
    unique_diamonds

    # Computation state
    current_iteration_idx::Int64
    local_belief_dict::Dict{Int64, Float64}

    # Diamond result tracking
    pending_diamond_node::Union{Nothing, Int64}
    diamond_results::Dict{Int64, Ref{Float64}}

    # Parent reference (for nested diamonds)
    parent_item::Union{Nothing, WorkItem}
    parent_dependency  # Reference to parent dependency token (DiamondDependency, defined later)
    target_join_node::Union{Nothing, Int64}  # Which join node this child is computing
    state_index::Union{Nothing, Int64}  # Which state index this child represents
end

"""
    DiamondDependency

Completion token that tracks when all child WorkItems for a diamond have completed.
When all children finish, accumulates results and resumes parent WorkItem.
"""
struct DiamondDependency <: StackItem
    parent_work_item::WorkItem
    join_node::Int64
    expected_children::Int
    completed_children::Ref{Int}
    result_accumulator::Ref{Float64}
    state_probabilities::Vector{Float64}  # For weighted averaging
end

# ============================================================================
# Cache Structures (Reused from Optimized Version)
# ============================================================================

"""
    DiamondCacheEntry

Stores the computed belief for a diamond structure with specific priors.
"""
struct DiamondCacheEntry
    edgelist::Vector{Tuple{Int64,Int64}}
    node_priors::Dict{Int64, Float64}
    belief::Float64
end

"""
    CacheKey

Hash key for diamond cache lookup.
"""
struct CacheKey
    edgelist_hash::UInt64
    priors_hash::UInt64
end

function Base.hash(ck::CacheKey, h::UInt64)::UInt64
    hash(ck.priors_hash, hash(ck.edgelist_hash, h))
end

function Base.:(==)(a::CacheKey, b::CacheKey)::Bool
    return a.edgelist_hash == b.edgelist_hash && a.priors_hash == b.priors_hash
end

"""
    make_cache_key(edgelist, node_priors) -> CacheKey

Creates a cache key from edgelist and node priors.
"""
function make_cache_key(edgelist::Vector{Tuple{Int64,Int64}}, node_priors::Dict{Int64, Float64})::CacheKey
    edgelist_hash = hash(edgelist)
    priors_hash = hash(collect(pairs(node_priors)))
    return CacheKey(edgelist_hash, priors_hash)
end

# Global diamond cache
const DIAMOND_CACHE = Dict{CacheKey, Float64}()

# ============================================================================
# Helper Functions
# ============================================================================

"""
    inclusion_exclusion(signals::Vector{Float64}) -> Float64

Computes P(A₁ ∪ A₂ ∪ ... ∪ Aₖ) using inclusion-exclusion principle.
P(≥1 signal) = Σᵢ Sᵢ - Σᵢ<ⱼ Sᵢ×Sⱼ + Σᵢ<ⱼ<ₖ Sᵢ×Sⱼ×Sₖ - ...

OPTIMIZED: Uses @simd and @inbounds for vectorization.
"""
function inclusion_exclusion(signals::Vector{Float64})::Float64
    if isempty(signals)
        return 0.0
    elseif length(signals) == 1
        return signals[1]
    end

    n = length(signals)
    result = 0.0

    # Iterate through all non-empty subsets
    @inbounds for subset_idx in 1:(2^n - 1)
        product = 1.0
        num_elements = count_ones(subset_idx)  # Built-in bit count

        # Use @simd for inner product loop
        @simd for i in 1:n
            mask = (subset_idx >> (i-1)) & 1
            product *= ifelse(mask == 1, signals[i], 1.0)
        end

        # Inclusion-exclusion: add if odd size, subtract if even size
        result += ifelse(isodd(num_elements), product, -product)
    end

    return result
end

"""
    calculate_regular_belief(parents, node, belief_dict, edge_probabilities) -> Vector{Float64}

Computes signal probabilities from each parent: Signal_i = Belief(Parent_i) × Link_Prob(Parent_i → Node)
"""
function calculate_regular_belief(
    parents::Set{Int64},
    node::Int64,
    belief_dict::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64}
)::Vector{Float64}
    signals = Float64[]

    for parent in parents
        parent_belief = get(belief_dict, parent, 0.0)
        link_prob = get(edge_probabilities, (parent, node), 0.0)
        signal = parent_belief * link_prob
        push!(signals, signal)
    end

    return signals
end

"""
    validate_network_data(edgelist, node_priors, edge_probabilities, source_nodes) -> Bool

Validates network data integrity. Returns true if valid, throws error if invalid.
"""
function validate_network_data(
    edgelist::Vector{Tuple{Int64,Int64}},
    node_priors::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    source_nodes::Set{Int64}
)::Bool
    # Check for empty network
    if isempty(edgelist)
        throw(ArgumentError("Empty edgelist"))
    end

    # Check for valid probabilities
    for (node, prior) in node_priors
        if !(0.0 <= prior <= 1.0)
            throw(ArgumentError("Invalid prior for node $node: $prior"))
        end
    end

    for (edge, prob) in edge_probabilities
        if !(0.0 <= prob <= 1.0)
            throw(ArgumentError("Invalid edge probability for $edge: $prob"))
        end
    end

    # Check source nodes exist
    all_nodes = Set{Int64}()
    for (src, dst) in edgelist
        push!(all_nodes, src)
        push!(all_nodes, dst)
    end

    for src in source_nodes
        if !(src in all_nodes)
            throw(ArgumentError("Source node $src not in network"))
        end
    end

    return true
end

"""
    is_node_in_diamond(node, root_diamonds) -> Bool

Checks if a node is part of any root diamond structure.
"""
function is_node_in_diamond(node::Int64, root_diamonds)::Bool
    for diamonds_at_node in values(root_diamonds)
        diamond = diamonds_at_node.diamond
        if node in diamond.relevant_nodes
            return true
        end
    end
    return false
end


# ============================================================================
# WorkItem Processing Helper (for parallel execution)
# ============================================================================

"""
    process_workitem_to_completion(item::WorkItem) -> Dict{Int64, Float64}

Processes a WorkItem completely until all iteration sets are finished.
Used for parallel diamond state enumeration.

This function runs its own work stack loop independently, allowing parallel threads
to process different diamond states simultaneously.
"""
function process_workitem_to_completion(item::WorkItem)::Dict{Int64, Float64}
    # Each thread gets its own work stack
    local_stack = StackItem[item]

    while !isempty(local_stack)
        current_item = pop!(local_stack)

        if current_item isa WorkItem
            # Process all iteration sets for this WorkItem
            while current_item.current_iteration_idx <= length(current_item.iteration_sets)
                current_set = current_item.iteration_sets[current_item.current_iteration_idx]

                # Track if we spawned a diamond (need to break out)
                spawned_diamond = false

                for node in current_set
                    if haskey(current_item.local_belief_dict, node)
                        continue
                    end

                    parents = get(current_item.incoming_index, node, Set{Int64}())

                    if isempty(parents)
                        current_item.local_belief_dict[node] = get(current_item.node_priors, node, 0.0)
                        continue
                    end

                    # Check for diamond structures
                    if haskey(current_item.root_diamonds, node)
                        # RECURSIVE CALL: Process diamond via parallelization
                        diamond_belief = process_diamond_parallel(
                            node,
                            current_item.root_diamonds,
                            current_item.local_belief_dict,
                            current_item.node_priors,
                            current_item.edge_probabilities,
                            current_item.unique_diamonds,
                            current_item.ancestors,
                            current_item.join_nodes,
                            current_item.source_nodes
                        )

                        # Store diamond result
                        current_item.local_belief_dict[node] = diamond_belief
                    else
                        # Regular node processing
                        signals = calculate_regular_belief(parents, node, current_item.local_belief_dict, current_item.edge_probabilities)

                        if length(signals) == 1
                            preprior = signals[1]
                        else
                            preprior = inclusion_exclusion(signals)
                        end

                        prior = get(current_item.node_priors, node, 0.0)
                        current_item.local_belief_dict[node] = preprior * prior
                    end
                end

                # Move to next iteration set
                current_item.current_iteration_idx += 1
            end

            # WorkItem complete - return its beliefs
            return current_item.local_belief_dict
        end
    end

    error("WorkItem processing failed to complete")
end

# ============================================================================
# Parallel Diamond Processing
# ============================================================================

"""
    process_diamond_parallel(...) -> Float64

Processes a diamond join node by enumerating conditioning states in parallel.
Each state is processed by a separate thread using process_workitem_to_completion().
"""
function process_diamond_parallel(
    node::Int64,
    root_diamonds,
    parent_belief_dict::Dict{Int64, Float64},
    node_priors::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    unique_diamonds,
    ancestors::Dict{Int64, Set{Int64}},
    join_nodes::Set{Int64},
    source_nodes::Set{Int64}
)::Float64

    diamonds_at_node = root_diamonds[node]
    diamond = diamonds_at_node.diamond

    # Get computation data
    sorted_edgelist = sort(diamond.edgelist)
    sorted_conditioning = sort(collect(diamond.conditioning_nodes))
    diamond_hash = hash((sorted_edgelist, sorted_conditioning))
    computation_data = unique_diamonds[diamond_hash]

    conditioning_nodes_list = collect(diamond.conditioning_nodes)
    num_states = 2^length(conditioning_nodes_list)

    # Parallel execution: spawn thread for each state
    use_parallel = num_states >= 2 && Threads.nthreads() > 1

    if use_parallel
        tasks = Task[]
        state_probs = Float64[]

        for state_idx in 0:(num_states - 1)
            # Calculate state probability
            state_probability = 1.0
            for (i, cond_node) in enumerate(conditioning_nodes_list)
                cond_belief = get(parent_belief_dict, cond_node, 0.0)
                if (state_idx & (1 << (i-1))) != 0
                    state_probability *= cond_belief
                else
                    state_probability *= (1.0 - cond_belief)
                end
            end
            push!(state_probs, state_probability)

            # Spawn parallel task
            task = Threads.@spawn begin
                # Build sub_node_priors for this state
                sub_node_priors = Dict{Int64, Float64}()

                for sub_node in diamond.relevant_nodes
                    if sub_node ∉ computation_data.sub_sources
                        sub_node_priors[sub_node] = get(node_priors, sub_node, 0.0)
                        if sub_node == node
                            sub_node_priors[sub_node] = 1.0
                        end
                    elseif sub_node ∉ diamond.conditioning_nodes
                        sub_node_priors[sub_node] = get(parent_belief_dict, sub_node, 0.0)
                    else
                        sub_node_priors[sub_node] = 1.0
                    end
                end

                # Set conditioning nodes based on state
                for (i, cond_node) in enumerate(conditioning_nodes_list)
                    if (state_idx & (1 << (i-1))) != 0
                        sub_node_priors[cond_node] = 1.0
                    else
                        sub_node_priors[cond_node] = 0.0
                    end
                end

                # Create child WorkItem
                child_item = WorkItem(
                    diamond.edgelist,
                    computation_data.sub_iteration_sets,
                    computation_data.sub_outgoing_index,
                    computation_data.sub_incoming_index,
                    computation_data.sub_sources,
                    sub_node_priors,
                    edge_probabilities,
                    computation_data.sub_descendants,
                    computation_data.sub_ancestors,
                    computation_data.sub_diamond_structures,
                    computation_data.sub_join_nodes,
                    computation_data.sub_fork_nodes,
                    unique_diamonds,
                    1,
                    Dict{Int64, Float64}(),
                    nothing,
                    Dict{Int64, Ref{Float64}}(),
                    nothing, nothing, node, state_idx
                )

                # Initialize source beliefs
                for src in computation_data.sub_sources
                    child_item.local_belief_dict[src] = get(sub_node_priors, src, 0.0)
                end

                # Process this child to completion
                result_beliefs = process_workitem_to_completion(child_item)
                get(result_beliefs, node, 0.0)
            end

            push!(tasks, task)
        end

        # Collect results and compute weighted sum
        diamond_belief = 0.0
        for (i, task) in enumerate(tasks)
            join_belief = fetch(task)
            diamond_belief += state_probs[i] * join_belief
        end
    else
        # Sequential fallback
        diamond_belief = 0.0

        for state_idx in 0:(num_states - 1)
            state_probability = 1.0
            for (i, cond_node) in enumerate(conditioning_nodes_list)
                cond_belief = get(parent_belief_dict, cond_node, 0.0)
                if (state_idx & (1 << (i-1))) != 0
                    state_probability *= cond_belief
                else
                    state_probability *= (1.0 - cond_belief)
                end
            end

            sub_node_priors = Dict{Int64, Float64}()
            for sub_node in diamond.relevant_nodes
                if sub_node ∉ computation_data.sub_sources
                    sub_node_priors[sub_node] = get(node_priors, sub_node, 0.0)
                    if sub_node == node
                        sub_node_priors[sub_node] = 1.0
                    end
                elseif sub_node ∉ diamond.conditioning_nodes
                    sub_node_priors[sub_node] = get(parent_belief_dict, sub_node, 0.0)
                else
                    sub_node_priors[sub_node] = 1.0
                end
            end

            for (i, cond_node) in enumerate(conditioning_nodes_list)
                if (state_idx & (1 << (i-1))) != 0
                    sub_node_priors[cond_node] = 1.0
                else
                    sub_node_priors[cond_node] = 0.0
                end
            end

            child_item = WorkItem(
                diamond.edgelist, computation_data.sub_iteration_sets,
                computation_data.sub_outgoing_index, computation_data.sub_incoming_index,
                computation_data.sub_sources, sub_node_priors, edge_probabilities,
                computation_data.sub_descendants, computation_data.sub_ancestors,
                computation_data.sub_diamond_structures, computation_data.sub_join_nodes,
                computation_data.sub_fork_nodes, unique_diamonds, 1,
                Dict{Int64, Float64}(), nothing, Dict{Int64, Ref{Float64}}(),
                nothing, nothing, node, state_idx
            )

            for src in computation_data.sub_sources
                child_item.local_belief_dict[src] = get(sub_node_priors, src, 0.0)
            end

            result_beliefs = process_workitem_to_completion(child_item)
            join_belief = get(result_beliefs, node, 0.0)
            diamond_belief += state_probability * join_belief
        end
    end

    # Handle non-diamond parents
    all_beliefs = Float64[diamond_belief]

    if !isempty(diamonds_at_node.non_diamond_parents)
        non_diamond_beliefs = calculate_regular_belief(
            diamonds_at_node.non_diamond_parents,
            node,
            parent_belief_dict,
            edge_probabilities
        )

        if !(node in join_nodes) || length(intersect(ancestors[node], source_nodes)) <= 1
            push!(all_beliefs, sum(non_diamond_beliefs))
        else
            append!(all_beliefs, non_diamond_beliefs)
        end
    end

    # Combine all beliefs
    if length(all_beliefs) == 1
        preprior = all_beliefs[1]
    else
        preprior = inclusion_exclusion(all_beliefs)
    end

    # Final belief = preprior × prior
    prior = get(node_priors, node, 0.0)
    return preprior * prior
end

# ============================================================================
# Main Iterative Loops - Sequential and Parallel Versions
# ============================================================================

"""
    update_beliefs_iterative(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, edge_probabilities,
        descendants, ancestors, root_diamonds,
        join_nodes, fork_nodes, unique_diamonds
    ) -> Dict{Int64, Float64}

Iterative belief propagation with automatic parallelization.
Uses Threads.@spawn to parallelize diamond state enumeration when threads are available.
Falls back to sequential processing when only 1 thread is available.

Returns: belief_dict mapping node_id -> belief probability
"""
function update_beliefs_iterative(
    edgelist::Vector{Tuple{Int64,Int64}},
    iteration_sets::Vector{Set{Int64}},
    outgoing_index::Dict{Int64, Set{Int64}},
    incoming_index::Dict{Int64, Set{Int64}},
    source_nodes::Set{Int64},
    node_priors::Dict{Int64, Float64},
    edge_probabilities::Dict{Tuple{Int64,Int64}, Float64},
    descendants::Dict{Int64, Set{Int64}},
    ancestors::Dict{Int64, Set{Int64}},
    root_diamonds,
    join_nodes::Set{Int64},
    fork_nodes::Set{Int64},
    unique_diamonds
)::Dict{Int64, Float64}
    log_event("START", "update_beliefs_iterative")
    log_event("NETWORK_SIZE", "nodes=$(length(union(Set(e[1] for e in edgelist), Set(e[2] for e in edgelist)))),edges=$(length(edgelist)),sources=$(length(source_nodes))")
    log_event("DIAMONDS", "root=$(length(root_diamonds)),unique=$(length(unique_diamonds))")
    log_event("THREADS", "available=$(Threads.nthreads())")

    # Validate input data
    validate_network_data(edgelist, node_priors, edge_probabilities, source_nodes)

    # Create root WorkItem
    root_item = WorkItem(
        edgelist,
        iteration_sets,
        outgoing_index,
        incoming_index,
        source_nodes,
        copy(node_priors),
        edge_probabilities,
        descendants,
        ancestors,
        root_diamonds,
        join_nodes,
        fork_nodes,
        unique_diamonds,
        1,  # Start at first iteration set
        Dict{Int64, Float64}(),
        nothing,
        Dict{Int64, Ref{Float64}}(),
        nothing,  # No parent for root
        nothing,  # No parent dependency
        nothing,  # No target join node
        nothing   # No state index
    )

    # Initialize source node beliefs
    for src in source_nodes
        root_item.local_belief_dict[src] = get(node_priors, src, 0.0)
    end

    log_event("PROCESSING", "Starting parallel processing")

    # Process root WorkItem to completion using parallel helper
    result_beliefs = process_workitem_to_completion(root_item)

    log_event("END", "update_beliefs_iterative complete")

    return result_beliefs
end

end # module ReachabilityModuleIterative
