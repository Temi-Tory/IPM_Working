start_time = time()
# Option 1: Separate calls (gives you more control)
edgelist, outgoing_index, incoming_index, source_nodes = read_graph_to_dict(filepath_graph)
allnodes = collect(keys(incoming_index));# Get all nodes from the outgoing index

sink_nodes = filter(node -> !haskey(outgoing_index, node) || isempty(outgoing_index[node]), allnodes); #nodes with no keys in outgoing_index or with empty outgoing_index


node_priors = read_node_priors_from_json(filepath_node_json)

edge_probabilities = read_edge_probabilities_from_json(filepath_edge_json)


# Identify network structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index)
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index)

# Load capacity data
capacity_data = JSON.parsefile(filepath_capacity_json)
node_caps_raw = capacity_data["capacities"]["nodes"]
edge_caps_raw = capacity_data["capacities"]["edges"]
source_rates_raw = capacity_data["capacities"]["source_rates"]

# Convert to proper types (following capacity test patterns)
node_capacities = Dict{Int64,Float64}()
for (k, v) in node_caps_raw
    node_capacities[parse(Int64, k)] = Float64(v)
end

edge_capacities = Dict{Tuple{Int64,Int64},Float64}()
for (k, v) in edge_caps_raw
    # Handle edge keys like "(1,2)" or "1,2"
    cleaned_key = replace(k, "(" => "", ")" => "")
    parts = split(cleaned_key, ",")
    edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
    edge_capacities[edge_key] = Float64(v)
end

source_rates = Dict{Int64,Float64}()
for (k, v) in source_rates_raw
    rate = Float64(v)
    if rate > 0.0  # Only include active sources
        source_rates[parse(Int64, k)] = rate
    end
end

# Target nodes are sink nodes
targets = Set{Int64}(sink_nodes)


# Load CPM data
cpm_data = JSON.parsefile(filepath_cpm_json)
time_analysis = cpm_data["time_analysis"]
cost_analysis = cpm_data["cost_analysis"]

# Convert time analysis data
node_durations_raw = time_analysis["node_durations"]
edge_delays_raw = time_analysis["edge_delays"]

node_durations = Dict{Int64,Float64}()
for (k, v) in node_durations_raw
    node_durations[parse(Int64, k)] = Float64(v)
end

edge_delays = Dict{Tuple{Int64,Int64},Float64}()
for (k, v) in edge_delays_raw
    cleaned_key = replace(k, "(" => "", ")" => "")
    parts = split(cleaned_key, ",")
    edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
    edge_delays[edge_key] = Float64(v)
end

# Convert cost analysis data  
node_costs_raw = cost_analysis["node_costs"]
edge_costs_raw = cost_analysis["edge_costs"]

node_costs = Dict{Int64,Float64}()
for (k, v) in node_costs_raw
    node_costs[parse(Int64, k)] = Float64(v)
end

edge_costs = Dict{Tuple{Int64,Int64},Float64}()
for (k, v) in edge_costs_raw
    cleaned_key = replace(k, "(" => "", ")" => "")
    parts = split(cleaned_key, ",")
    edge_key = (parse(Int64, strip(parts[1])), parse(Int64, strip(parts[2])))
    edge_costs[edge_key] = Float64(v)
end
computation_time = time() - start_time# =>  time taken fto get network structure


start_time = time()
root_diamonds = identify_and_group_diamonds(
    join_nodes,
    incoming_index,
    ancestors,
    descendants,
    source_nodes,
    fork_nodes,
    edgelist,
    node_priors,
    iteration_sets
);
computation_time = time() - start_time# =>  time taken fto get root diamond
start_time = time()
unique_diamonds = build_unique_diamond_storage_depth_first_parallel(
    root_diamonds,
    node_priors,
    ancestors,
    descendants,
    iteration_sets
);
#note that root_diamonds are also included in unique_diamonds so UI will be able to differnetiate them if both returned raw
computation_time = time() - start_time # =>  time taken fto get unique_diamonds

#for each input type provided, call three different function calls for each at once
start_time = time()
output = IPAFramework.update_beliefs_iterative(
    edgelist,
    iteration_sets,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    descendants,
    ancestors,
    root_diamonds,
    join_nodes,
    fork_nodes,
    unique_diamonds
);
computation_time = time() - start_time # =>  time taken for each  exact inference 

start_time = time()

# Run capacity analysis
capacity_params = CapacityParameters(node_capacities, edge_capacities, source_rates, targets)
capacity_result = maximum_flow_capacity(iteration_sets, outgoing_index, incoming_index, source_nodes, capacity_params)
computation_time = time() - start_time # =>  time taken fto get capacity reuslst 

start_time = time()

# Run time-based critical path analysis
time_params = CriticalPathParameters(
    node_durations,
    edge_delays,
    0.0,  # initial_value
    max_combination,
    additive_propagation,
    additive_propagation
)

time_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, time_params)


computation_time = time() - start_time # =>  time taken fto get time cpm reuslst 


start_time = time()

# Run cost-based critical path analysis
cost_params = CriticalPathParameters(
    node_costs,
    edge_costs,
    0.0,  # initial_value
    max_combination,
    additive_propagation,
    additive_propagation
)

cost_result = critical_path_analysis(iteration_sets, outgoing_index, incoming_index, source_nodes, cost_params)


computation_time = time() - start_time # =>  time taken fto get cost cpm  reuslst 