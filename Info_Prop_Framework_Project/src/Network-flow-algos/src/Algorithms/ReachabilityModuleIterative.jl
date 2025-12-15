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

export update_beliefs_iterative_sequential

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
    for subset_idx in 1:(2^n - 1)
        product = 1.0
        num_elements = 0

        for i in 1:n
            if (subset_idx & (1 << (i-1))) != 0
                product *= signals[i]
                num_elements += 1
            end
        end

        # Inclusion-exclusion: add if odd size, subtract if even size
        if num_elements % 2 == 1
            result += product
        else
            result -= product
        end
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
# Diamond Child Spawning
# ============================================================================

"""
    spawn_diamond_children!(work_stack, parent_item, node, root_diamonds, diamond_cache)

Creates child WorkItems for diamond conditional enumeration.
Pushes DiamondDependency token and child WorkItems onto stack.

SEQUENTIAL VERSION: No threading, processes states one at a time via stack.
"""
function spawn_diamond_children!(
    work_stack::Vector{StackItem},
    parent_item::WorkItem,
    node::Int64,
    root_diamonds
)
    log_event("SPAWN_START", "node=$node, current_stack_size=$(length(work_stack))")

    # Array to collect children before pushing (to control push order)
    children_to_spawn = WorkItem[]

    # Find the diamond containing this node - root_diamonds is Dict{Int64, DiamondsAtNode}
    if !haskey(root_diamonds, node)
        error("Node $node marked as diamond join but not in root_diamonds")
    end

    diamonds_at_node = root_diamonds[node]
    diamond = diamonds_at_node.diamond

    # Get computation data from unique_diamonds
    # Compute hash manually to avoid module namespace type issues
    # (Diamond objects may come from IPAFrameworkOptimized but we're in IPAFrameworkIterative)
    sorted_edgelist = sort(diamond.edgelist)
    sorted_conditioning = sort(collect(diamond.conditioning_nodes))
    diamond_hash = hash((sorted_edgelist, sorted_conditioning))

    log_event("DIAMOND_INFO", "node=$node, conditioning_nodes=$(collect(diamond.conditioning_nodes)), diamond_edges=$(length(diamond.edgelist))")

    if !haskey(parent_item.unique_diamonds, diamond_hash)
        error("Diamond hash $diamond_hash not found in unique_diamonds for node $node")
    end

    computation_data = parent_item.unique_diamonds[diamond_hash]
    conditioning_nodes_list = collect(diamond.conditioning_nodes)
    num_states = 2^length(conditioning_nodes_list)

    log_event("SPAWN_STATES", "node=$node, num_conditioning_nodes=$(length(conditioning_nodes_list)), num_states=$num_states")

    # Create DiamondDependency token
    dependency = DiamondDependency(
        parent_item,
        node,
        num_states,
        Ref(0),
        Ref(0.0),
        Float64[]
    )

    # Push dependency token first (will be under all children)
    push!(work_stack, dependency)

    # Create child WorkItem for each state (SEQUENTIAL - no @spawn)
    for state_idx in 0:(num_states - 1)
        # Calculate P(state)
        state_probability = 1.0
        for (i, cond_node) in enumerate(conditioning_nodes_list)
            cond_belief = get(parent_item.local_belief_dict, cond_node, 0.0)
            if (state_idx & (1 << (i-1))) != 0
                state_probability *= cond_belief
            else
                state_probability *= (1.0 - cond_belief)
            end
        end

        push!(dependency.state_probabilities, state_probability)

        # Create contextual beliefs for this state
        sub_node_priors = Dict{Int64, Float64}()

        # Build sub_node_priors similar to recursive version
        for sub_node in diamond.relevant_nodes
            if sub_node ∉ computation_data.sub_sources
                # Non-source node - use original prior
                sub_node_priors[sub_node] = get(parent_item.node_priors, sub_node, 0.0)
                if sub_node == node
                    sub_node_priors[sub_node] = 1.0  # Join node prior set to 1.0
                end
            elseif sub_node ∉ diamond.conditioning_nodes
                # Fresh source but not conditioning - use contextual belief
                sub_node_priors[sub_node] = get(parent_item.local_belief_dict, sub_node, 0.0)
            else
                # Conditioning node - will be set based on state
                sub_node_priors[sub_node] = 1.0  # Temporary, overwritten below
            end
        end

        # Set conditioning nodes based on state
        for (i, cond_node) in enumerate(conditioning_nodes_list)
            if (state_idx & (1 << (i-1))) != 0
                sub_node_priors[cond_node] = 1.0  # Condition on active
            else
                sub_node_priors[cond_node] = 0.0  # Condition on inactive
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
            parent_item.edge_probabilities,
            computation_data.sub_descendants,
            computation_data.sub_ancestors,
            computation_data.sub_diamond_structures,
            computation_data.sub_join_nodes,
            computation_data.sub_fork_nodes,
            parent_item.unique_diamonds,
            1,  # Start at first iteration set
            Dict{Int64, Float64}(),
            nothing,
            Dict{Int64, Ref{Float64}}(),
            parent_item,  # Parent reference
            dependency,   # Parent dependency token
            node,         # Target join node
            state_idx     # State index
        )

        # Initialize source node beliefs
        for src in computation_data.sub_sources
            child_item.local_belief_dict[src] = get(sub_node_priors, src, 0.0)
        end

        # Store child for later (don't push yet)
        push!(children_to_spawn, child_item)
        log_event("CREATE_CHILD", "parent_node=$node, state_idx=$state_idx, child_target=$node")
    end

    # CRITICAL FIX: Push dependency FIRST, then children
    # LIFO stack means last-in-first-out, so:
    # - Push dependency first (goes to bottom)
    # - Push children on top
    # - Children are popped first, complete, update dependency
    # - Then dependency is popped when all children done
    push!(work_stack, dependency)
    log_event("PUSH_DEP", "node=$node, expected_children=$num_states, stack_size=$(length(work_stack))")

    # Now push children on top of dependency
    for child_item in children_to_spawn
        push!(work_stack, child_item)
        log_event("PUSH_CHILD", "parent_node=$node, child_target=$node, new_stack_size=$(length(work_stack))")
    end
end

# ============================================================================
# Main Sequential Iterative Loop
# ============================================================================

"""
    update_beliefs_iterative_sequential(
        edgelist, iteration_sets, outgoing_index, incoming_index,
        source_nodes, node_priors, edge_probabilities,
        descendants, ancestors, root_diamonds,
        join_nodes, fork_nodes, unique_diamonds
    ) -> Dict{Int64, Float64}

Fully iterative belief propagation using completion tokens.
SEQUENTIAL VERSION: No threading, processes work items one at a time.

Returns: belief_dict mapping node_id -> belief probability
"""
function update_beliefs_iterative_sequential(
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
    log_event("START", "update_beliefs_iterative_sequential")
    log_event("NETWORK_SIZE", "nodes=$(length(union(Set(e[1] for e in edgelist), Set(e[2] for e in edgelist)))),edges=$(length(edgelist)),sources=$(length(source_nodes))")
    log_event("DIAMONDS", "root=$(length(root_diamonds)),unique=$(length(unique_diamonds))")

    # Validate input data
    validate_network_data(edgelist, node_priors, edge_probabilities, source_nodes)

    # Initialize work stack with root computation
    work_stack = StackItem[]
    log_event("INIT_STACK", "work_stack initialized")

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

    push!(work_stack, root_item)
    log_event("PUSH_ROOT", "WorkItem pushed, stack_size=1")

    # Main sequential loop - POP not PEEK
    while !isempty(work_stack)
        LOOP_COUNTER[] += 1
        stack_size = length(work_stack)
        item = pop!(work_stack)

        log_event("POP", "stack_size=$stack_size, item_type=$(typeof(item))")

        if item isa DiamondDependency
            log_event("PROCESS_DEP", "join_node=$(item.join_node), completed=$(item.completed_children[]), expected=$(item.expected_children)")

            # Check if all children completed
            if item.completed_children[] == item.expected_children
                log_event("DEP_COMPLETE", "join_node=$(item.join_node), result=$(item.result_accumulator[])")
                # All children done - compute weighted average (diamond belief only)
                diamond_belief = item.result_accumulator[]

                # Now handle non-diamond parents (matching optimized version logic)
                parent = item.parent_work_item
                all_beliefs = Float64[diamond_belief]

                # Get the DiamondsAtNode structure for this join node
                if haskey(parent.root_diamonds, item.join_node)
                    diamonds_at_node = parent.root_diamonds[item.join_node]

                    # Handle non-diamond parents
                    if !isempty(diamonds_at_node.non_diamond_parents)
                        non_diamond_beliefs = calculate_regular_belief(
                            diamonds_at_node.non_diamond_parents,
                            item.join_node,
                            parent.local_belief_dict,
                            parent.edge_probabilities
                        )

                        # For simple tree paths, just take the sum
                        if !(item.join_node in parent.join_nodes) ||
                           length(intersect(parent.ancestors[item.join_node], parent.source_nodes)) <= 1
                            push!(all_beliefs, sum(non_diamond_beliefs))
                        else
                            # For join nodes with multiple paths, use inclusion-exclusion
                            append!(all_beliefs, non_diamond_beliefs)
                        end
                    end
                end

                # Combine all beliefs (diamond + non-diamond parents)
                if length(all_beliefs) == 1
                    preprior = all_beliefs[1]
                else
                    preprior = inclusion_exclusion(all_beliefs)
                end

                # Final belief = preprior × prior
                prior = get(parent.node_priors, item.join_node, 0.0)
                parent.local_belief_dict[item.join_node] = preprior * prior

                # Clear pending flag - diamond is now complete
                parent.pending_diamond_node = nothing

                # Resume parent computation ONLY if parent is not already complete
                # (A child WorkItem may have finished but still have pending diamonds)
                if parent.current_iteration_idx <= length(parent.iteration_sets)
                    push!(work_stack, parent)
                    log_event("RESUME_PARENT", "parent resumed after diamond complete")
                else
                    log_event("SKIP_RESUME", "parent already complete, not resuming")
                end
            else
                # Not all children done yet - push back to wait
                push!(work_stack, item)
            end

        elseif item isa WorkItem
            # Process WorkItem computation
            is_child = (item.parent_item !== nothing)
            context_info = is_child ? "child(target=$(item.target_join_node),state=$(item.state_index))" : "root"
            log_event("PROCESS_WORK", "context=$context_info, iter_idx=$(item.current_iteration_idx)/$(length(item.iteration_sets)), computed=$(length(item.local_belief_dict)) nodes")

            # Check if we've processed all iteration sets
            if item.current_iteration_idx > length(item.iteration_sets)
                # This WorkItem is complete
                log_event("WORK_COMPLETE", "context=$context_info, total_computed=$(length(item.local_belief_dict))")

                if item.parent_item !== nothing
                    # This is a child WorkItem for a diamond state
                    # Get the join node belief
                    join_belief = get(item.local_belief_dict, item.target_join_node, 0.0)

                    log_event("CHILD_RESULT", "target=$(item.target_join_node), state=$(item.state_index), join_belief=$join_belief")

                    # Update parent dependency directly (we have reference)
                    dep = item.parent_dependency
                    state_prob = dep.state_probabilities[item.state_index + 1]  # +1 because state_idx is 0-based

                    # Accumulate weighted result
                    dep.result_accumulator[] += state_prob * join_belief
                    dep.completed_children[] += 1

                    log_event("DEP_UPDATE", "join_node=$(dep.join_node), completed=$(dep.completed_children[]),  expected=$(dep.expected_children), accumulator=$(dep.result_accumulator[])")
                else
                    # Root WorkItem complete - we're done!
                    log_event("ROOT_COMPLETE", "total_beliefs=$(length(item.local_belief_dict))")
                    return item.local_belief_dict
                end

                continue  # Don't push back, this item is done
            end

            # Process current iteration set
            current_set = item.iteration_sets[item.current_iteration_idx]
            log_event("PROCESS_SET", "context=$context_info, iter_idx=$(item.current_iteration_idx), set_size=$(length(current_set))")

            for node in current_set
                log_event("PROCESS_NODE", "context=$context_info, node=$node")
                # Skip if already computed (shouldn't happen, but safety check)
                if haskey(item.local_belief_dict, node)
                    continue
                end

                # Get parents
                parents = get(item.incoming_index, node, Set{Int64}())

                if isempty(parents)
                    # Isolated node or source (should already be initialized)
                    item.local_belief_dict[node] = get(item.node_priors, node, 0.0)
                    continue
                end

                # Check if node has diamond structures
                if haskey(item.root_diamonds, node)
                    # This node has diamonds - need to spawn children and handle non-diamond parents
                    # Set pending flag and spawn
                    item.pending_diamond_node = node
                    spawn_diamond_children!(work_stack, item, node, item.root_diamonds)

                    # DON'T push parent back - the DiamondDependency completion handler will do it
                    # The parent WorkItem is stored in the dependency, and will be pushed back when complete
                    # Don't process any more nodes in this iteration set
                    break
                else
                    # No diamond structures - handle all parents as regular
                    signals = calculate_regular_belief(parents, node, item.local_belief_dict, item.edge_probabilities)

                    if length(signals) == 1
                        preprior = signals[1]
                    else
                        preprior = inclusion_exclusion(signals)
                    end

                    # Final belief = preprior × prior
                    prior = get(item.node_priors, node, 0.0)
                    item.local_belief_dict[node] = preprior * prior
                end
            end

            # If we completed the iteration set (no diamond spawn), advance to next set
            if item.pending_diamond_node === nothing
                item.current_iteration_idx += 1
                push!(work_stack, item)  # Push back for next iteration
            else
                # Diamond spawned - clear pending flag for when we resume
                item.pending_diamond_node = nothing
                # Don't push back yet - will be resumed by DiamondDependency
            end
        end
    end

    # Should never reach here
    error("Work stack empty but root computation not complete")
end

end # module ReachabilityModuleIterative
