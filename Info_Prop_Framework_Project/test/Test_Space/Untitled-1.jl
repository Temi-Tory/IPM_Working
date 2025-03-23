using Fontconfig: Fontconfig
using DataFrames, DelimitedFiles, Distributions,
	DataStructures, SparseArrays, BenchmarkTools,
	Combinatorics


# Import framework
using .IPAFramework



"""
	pretty_print_diamonds(diamond_structures::Dict{Int64, IPAFramework.GroupedDiamondStructure})
	Prints diamond structures in a readable format.
"""
function pretty_print_diamonds(diamond_structures::Dict{Int64, GroupedDiamondStructure})
	println("\nDiamond Patterns Analysis")
	println("="^50)

	for (join_node, structure) in diamond_structures
		println("\nJoin Node: $join_node")
		println("-"^30)

		# Print diamond patterns
		for group in structure.diamond
			ancestors_str = join(collect(group.ancestors), ", ")
			parents_str = join(collect(group.influenced_parents), ", ")
			highest_str = join(collect(group.highest_nodes), ", ")

			println("  Common Ancestors: [$ancestors_str]")
			println("  ├─ Highest Nodes: [$highest_str]")
			println("  └─ Influences Parents: [$parents_str]")
			println()
		end

		# Print non-diamond parents if any exist
		if !isempty(structure.non_diamond_parents)
			non_diamond_str = join(collect(structure.non_diamond_parents), ", ")
			println("  Non-Diamond Parents: [$non_diamond_str]")
			println()
		end
	end
end

"""
	pretty_print_diamond(structure::GroupedDiamondStructure)
	Prints a single diamond structure in a readable format.
"""
function pretty_print_diamond(structure::GroupedDiamondStructure)
	println("\nDiamond Pattern at Join Node: $(structure.join_node)")
	println("-"^40)

	# Print diamond patterns
	for group in structure.diamond
		ancestors_str = join(collect(group.ancestors), ", ")
		parents_str = join(collect(group.influenced_parents), ", ")
		highest_str = join(collect(group.highest_nodes), ", ")

		println("  Common Ancestors: [$ancestors_str]")
		println("  ├─ Highest Nodes: [$highest_str]")
		println("  └─ Influences Parents: [$parents_str]")
		println()
	end

	# Print non-diamond parents if any exist
	if !isempty(structure.non_diamond_parents)
		non_diamond_str = join(collect(structure.non_diamond_parents), ", ")
		println("  Non-Diamond Parents: [$non_diamond_str]")
		println()
	end
end

function print_graph_details(
	edgelist,
	outgoing_index,
	incoming_index,
	source_nodes,
	fork_nodes,
	join_nodes,
	iteration_sets,
	ancestors,
	descendants,
	diamond_structures,
)
	println("Graph Details:")

	# Print edge list
	println("Edgelist:")
	for edge in edgelist
		println("  $edge")
	end

	# Print outgoing and incoming index
	println("\nOutgoing Index:")
	for (node, neighbors) in outgoing_index
		println("  Node $node -> Outgoing Neighbors: $(collect(neighbors))")
	end

	println("\nIncoming Index:")
	for (node, neighbors) in incoming_index
		println("  Node $node -> Incoming Neighbors: $(collect(neighbors))")
	end

	# Print source, fork, and join nodes
	println("\nSource Nodes: $(collect(source_nodes))")
	println("Fork Nodes: $(collect(fork_nodes))")
	println("Join Nodes: $(collect(join_nodes))")

	# Print iteration sets
	println("\nIteration Sets:")
	for (i, iteration_set) in enumerate(iteration_sets)
		println("  Iteration $i: $(collect(iteration_set))")
	end

	# Print ancestors and descendants
	println("\nAncestors:")
	for (node, ancestor_set) in ancestors
		println("  Node $node -> Ancestors: $(collect(ancestor_set))")
	end

	println("\nDescendants:")
	for (node, descendant_set) in descendants
		println("  Node $node -> Descendants: $(collect(descendant_set))")
	end

	# Print common ancestors dictionary with DiamondStructure details
	pretty_print_diamonds(diamond_structures)
end


filepathcsv = "csvfiles/metro_directed_dag_for_ipm.csv";

edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities = read_graph_to_dict(filepathcsv);
# Identify structure
fork_nodes, join_nodes = identify_fork_and_join_nodes(outgoing_index, incoming_index);
iteration_sets, ancestors, descendants = find_iteration_sets(edgelist, outgoing_index, incoming_index);

# Analyze diamond structures
diamond_structures = identify_and_group_diamonds(
	join_nodes,
	ancestors,
	incoming_index,
	source_nodes,
	fork_nodes,
	iteration_sets,
	edgelist,
	descendants,
);


print_graph_details(
    edgelist, 
    outgoing_index, 
    incoming_index, 
    source_nodes, 
    fork_nodes, 
    join_nodes, 
    iteration_sets, 
    ancestors, 
    descendants, 
    diamond_structures
);
diamond_structures[193]


source_node = 18;# for metro


# We already have these variables from read_graph_to_dict:
# edgelist, outgoing_index, incoming_index, source_nodes, node_priors, edge_probabilities

# Note: source_node is in source_nodes (which is a Set)
source_node = 18  # The only source node

# Find sink nodes (nodes with no outgoing edges)
sink_nodes = Set{Int64}()
all_nodes = Set(keys(incoming_index))
union!(all_nodes, keys(outgoing_index))

for node in all_nodes
	if !haskey(outgoing_index, node) || isempty(outgoing_index[node])
		push!(sink_nodes, node)
	end
end

# Helper function to determine node type
function get_node_type(node)
	if node == source_node
		return 0  # Source node
	elseif node in sink_nodes
		return 4  # Sink node
	else
		outgoing_count = haskey(outgoing_index, node) ? length(outgoing_index[node]) : 0
		if outgoing_count > 4
			return 3  # Hub node
		elseif outgoing_count > 2
			return 2  # Intermediate node
		else
			return 1  # Basic node
		end
	end
end

# Count nodes in each category
type_counts = Dict{Int, Int}()
for node in all_nodes
	node_type = get_node_type(node)
	type_counts[node_type] = get(type_counts, node_type, 0) + 1
end

println("Node Type Counts:")
println("Type 0 (Source): $(get(type_counts, 0, 0))")
println("Type 1 (Basic): $(get(type_counts, 1, 0))")
println("Type 2 (Intermediate): $(get(type_counts, 2, 0))")
println("Type 3 (Hub): $(get(type_counts, 3, 0))")
println("Type 4 (Sink): $(get(type_counts, 4, 0))")
println("Total: $(sum(values(type_counts)))")


# Count edge types based on source and destination node types
edge_type_counts = Dict{String, Int}()

# Function to get edge type key
function get_edge_type_key(from_type, to_type)
	if from_type == 0
		return "Type 0 (Central) → Any"
	elseif to_type == 4
		if from_type == 3
			return "Type 3 (Hub) → Type 4 (Terminal)"
		else
			return "Non-Hub → Type 4 (Terminal)"
		end
	elseif from_type == 3
		if to_type == 3
			return "Type 3 (Hub) → Type 3 (Hub)"
		elseif to_type == 2
			return "Type 3 (Hub) → Type 2 (Transfer)"
		else
			return "Type 3 (Hub) → Type 1 (Standard)"
		end
	elseif from_type == 2
		return "Type 2 (Transfer) → Any"
	else # from_type == 1
		return "Type 1 (Standard) → Any"
	end
end

# Count edges by type
for (from_node, to_node) in edgelist
	from_type = get_node_type(from_node)
	to_type = get_node_type(to_node)

	edge_type = get_edge_type_key(from_type, to_type)
	edge_type_counts[edge_type] = get(edge_type_counts, edge_type, 0) + 1
end

# Print edge type counts
println("\nEdge Type Counts:")
for (edge_type, count) in sort(collect(edge_type_counts))
	println("$edge_type: $count")
end

# Calculate total edges
total_edges = sum(values(edge_type_counts))
println("Total edges: $total_edges")



# Define reliability values for standard operations
std_reliability = Dict(
	0 => 1.0,    # Source node: 100%
	1 => 0.90,   # Basic nodes: 90%
	2 => 0.92,   # Intermediate nodes: 92%
	3 => 0.95,   # Hub nodes: 95%
	4 => 0.93,    # Sink nodes: 93%
)

# Update node_priors with standard reliability values
for node in all_nodes
	node_type = get_node_type(node)
	node_priors[node] = 1.0#std_reliability[node_type]
end

# Update edge_probabilities based on source and destination types
for (from_node, to_node) in edgelist
	from_type = get_node_type(from_node)
	to_type = get_node_type(to_node)

	# Set edge reliability based on connection type
	if from_type == 0  # From source node
		edge_probabilities[(from_node, to_node)] = 0.98
	elseif to_type == 4  # To sink node
		if from_type == 3  # Hub to Sink
			edge_probabilities[(from_node, to_node)] = 0.94
		else  # Non-hub to Sink
			edge_probabilities[(from_node, to_node)] = 0.96
		end
	elseif from_type == 3  # From Hub
		if to_type == 3  # Hub to Hub
			edge_probabilities[(from_node, to_node)] = 0.90
		elseif to_type == 2  # Hub to Intermediate
			edge_probabilities[(from_node, to_node)] = 0.91
		else  # Hub to Basic
			edge_probabilities[(from_node, to_node)] = 0.92
		end
	elseif from_type == 2  # From Intermediate
		edge_probabilities[(from_node, to_node)] = 0.93
	else  # From Basic
		edge_probabilities[(from_node, to_node)] = 0.95
	end
end

# Function to create disruption scenario values
function create_disruption_scenario!(node_priors_disrupted, edge_probabilities_disrupted)
	# Define reliability values for disruption scenario
	disruption_reliability = Dict(
		0 => 0.75,   # Source node: 75%
		1 => 0.60,   # Basic nodes: 60%
		2 => 0.65,   # Intermediate nodes: 65%
		3 => 0.70,   # Hub nodes: 70%
		4 => 0.63,    # Sink nodes: 63%
	)

	# Copy the dictionaries
	for node in all_nodes
		node_type = get_node_type(node)
		node_priors_disrupted[node] = 1.0 #disruption_reliability[node_type]
	end

	# Update edge probabilities (simplified for disruption - could be more complex)
	for (edge, _) in edge_probabilities
		from_node, to_node = edge
		from_type = get_node_type(from_node)

		# Reduced values for all edges in disruption scenario
		if from_type == 0  # From source
			edge_probabilities_disrupted[edge] = 0.90
		elseif from_type == 3  # From hub
			edge_probabilities_disrupted[edge] = 0.80
		elseif from_type == 2  # From intermediate
			edge_probabilities_disrupted[edge] = 0.85
		else  # From basic
			edge_probabilities_disrupted[edge] = 0.88
		end
	end

	return node_priors_disrupted, edge_probabilities_disrupted
end

# Create disruption scenario 
node_priors_disrupted = Dict{Int, Float64}()
edge_probabilities_disrupted = Dict{Tuple{Int, Int}, Float64}()
create_disruption_scenario!(node_priors_disrupted, edge_probabilities_disrupted)

println("\nScenario 1 (Standard Operations):")
println("Node reliability examples:")
for node_type in 0:4
	nodes = [n for n in all_nodes if get_node_type(n) == node_type]
	if !isempty(nodes)
		sample_node = first(nodes)
		println("Type $node_type node $sample_node: $(node_priors[sample_node])")
	end
end

println("\nScenario 2 (Disruption):")
println("Node reliability examples:")
for node_type in 0:4
	nodes = [n for n in all_nodes if get_node_type(n) == node_type]
	if !isempty(nodes)
		sample_node = first(nodes)
		println("Type $node_type node $sample_node: $(node_priors_disrupted[sample_node])")
	end
end

# Save the dictionaries for both scenarios
# Standard scenario is already in node_priors and edge_probabilities
# Disruption scenario is in node_priors_disrupted and edge_probabilities_disrupted
#= 
#collect and show diaomd strutures in diamond_structures have more than one highest nodes
function collect_multiple_highest(
    diamond_structures::Dict{Int64, GroupedDiamondStructure}
)
    multi_highest = Dict{Int64, Vector{AncestorGroup}}()
    for (join, grouped_struct) in diamond_structures
        for group in grouped_struct.diamond
            if length(group.highest_nodes) > 1
                if !haskey(multi_highest, join)
                    multi_highest[join] = Vector{AncestorGroup}()
                end
                push!(multi_highest[join], group)
            end
        end
    end
    return multi_highest
end

# Example of using the function:
multi = collect_multiple_highest(diamond_structures)
for (join, groups) in multi
    println("Join node: ", join)
    for group in groups
        println("  AncestorGroup with highest_nodes: ", group.highest_nodes)
    end
end =#



#pretty_print_diamonds(diamond_structures)
#= 
print_graph_details(
	edgelist, 
	outgoing_index, 
	incoming_index, 
	source_nodes, 
	fork_nodes, 
	join_nodes, 
	iteration_sets, 
	ancestors, 
	descendants, 
	diamond_structures
) 
	=#

function generate_diamond_table(diamonds::Dict{Int64, GroupedDiamondStructure},
	all_ancestors::Dict{Int64, Set{Int64}},
	all_descendants::Dict{Int64, Set{Int64}})
	# Open file for writing
	open("diamond_structures_table.tex", "w") do io
		# Write the table header
		write(io, "\\begin{table*}[!ht]\n")
		write(io, "\\centering\n")
		write(io, "\\caption{Diamond Structures Identified in the Berlin Metro Network}\n")
		write(io, "\\label{tab:diamond_structures}\n")
		write(io, "\\resizebox{\\textwidth}{!}{\n")
		write(io, "\\begin{tabular}{cclcl}\n")
		write(io, "\\hline\n")
		write(io, "\\textbf{Join Node} & \\textbf{Highest Fork Ancestor} & \\textbf{Other Fork Ancestors} & \\textbf{Influenced Parents} & \\textbf{Diamond Type} \\\\\n")
		write(io, "\\hline\n")

		# Sort diamonds by join node for consistent output
		sorted_keys = sort(collect(keys(diamonds)))

		# Track when to add a horizontal line (every 5 rows)
		row_count = 0

		for key in sorted_keys
			diamond = diamonds[key]
			join_node = diamond.join_node

			# Process each ancestor group in the diamond
			for group in diamond.diamond
				# Extract the highest fork ancestor
				highest_fork_ancestor = first(group.highest_nodes)

				# Extract other fork ancestors
				other_ancestors = join(collect(group.ancestors), ", ")

				# Extract influenced parents
				influenced_parents = join(collect(group.influenced_parents), ", ")

				# Determine diamond type
				diamond_type = determine_diamond_type(group, diamond, all_ancestors, all_descendants, diamonds)

				# Write row to table
				write(io, "$join_node & $highest_fork_ancestor & [$other_ancestors] & \\{$influenced_parents\\} & $diamond_type \\\\\n")

				row_count += 1
				if row_count % 5 == 0 && row_count < length(sorted_keys)
					write(io, "\\hline\n")
				end
			end
		end

		# Complete the table
		write(io, "\\hline\n")
		write(io, "\\end{tabular}%\n")
		write(io, "}\n")
		write(io, "\\end{table*}\n")
	end

	println("Table generated successfully: diamond_structures_table.tex")
end

# Function to determine the diamond type based on the structure
function determine_diamond_type(group::AncestorGroup, diamond::GroupedDiamondStructure,
	all_ancestors::Dict{Int64, Set{Int64}},
	all_descendants::Dict{Int64, Set{Int64}},
	all_diamonds::Dict{Int64, GroupedDiamondStructure})
	ancestors = group.ancestors
	influenced_parents = group.influenced_parents
	highest_fork_ancestor = first(group.highest_nodes)
	join_node = diamond.join_node

	# Classification based on the paper's original criteria
	# Check if self-influenced (parent is also an ancestor)
	is_self_influenced = any(parent -> parent ∈ ancestors, influenced_parents)

	# Check if it has multiple ancestors
	has_multiple_ancestors = length(ancestors) > 3

	# Check if very complex (many ancestors)
	is_complex = length(ancestors) > 5

	# Check if basic (only one ancestor)
	is_basic = length(ancestors) == 1

	# Get the original classification
	original_type = ""
	if is_self_influenced
		original_type = "Self-influenced Diamond"
	elseif is_complex
		original_type = "Multi-fork Diamond"
	elseif has_multiple_ancestors && 20 ∈ ancestors && 19 ∈ ancestors
		original_type = "Fork-dominated Diamond"
	elseif is_basic
		original_type = "Basic Single-ancestor Diamond"
	elseif length(influenced_parents) > 2
		original_type = "Nested Fork Structure"
	elseif length(ancestors) == 2
		original_type = "Simple Diamond"
	else
		original_type = "Hierarchical Diamond"
	end

	return original_type
end

# If you need to count the frequency of each diamond type
function count_diamond_types(diamonds::Dict{Int64, GroupedDiamondStructure},
	all_ancestors::Dict{Int64, Set{Int64}},
	all_descendants::Dict{Int64, Set{Int64}})
	type_counts = Dict{String, Int}()

	for (key, diamond) in diamonds
		for group in diamond.diamond
			diamond_type = determine_diamond_type(group, diamond, all_ancestors, all_descendants, diamonds)
			type_counts[diamond_type] = get(type_counts, diamond_type, 0) + 1
		end
	end

	println("Diamond Type Counts:")
	for (type, count) in sort(collect(type_counts))
		println("$type: $count")
	end

	return type_counts
end
generate_diamond_table(diamond_structures, ancestors, ancestors);
count_diamond_types(diamond_structures, ancestors, descendants);

#= show(descendants);
show(diamond_structures); =#
#diamond_structures[193].diamond[1]


# Standard scenario is already in node_priors and edge_probabilities
# Disruption scenario is in node_priors_disrupted and edge_probabilities_disrupted

# Run the iterative algorithm
output =  update_beliefs_iterative(
    edgelist,
    iteration_sets, 
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    descendants,
    ancestors, 
    diamond_structures,
    join_nodes,
    fork_nodes
 );

 
output[193]
#@benchmark(

mc_results = MC_result(
    edgelist,
    outgoing_index,
    incoming_index,
    source_nodes,
    node_priors,
    edge_probabilities,
    100000
);

# Sort outputs
sorted_algo = OrderedDict(sort(collect(output)))
sorted_mc = OrderedDict(sort(collect(mc_results)))

# Create base DataFrame using the float values directly
df = DataFrame(
  Node = collect(keys(sorted_algo)),
  AlgoValue = collect(values(sorted_algo)),
  MCValue = collect(values(sorted_mc))
)

# Add a difference column (if needed)
df.Diff = abs.(df.AlgoValue .- df.MCValue)

# Display sorted result (if you want to sort by the difference)
show(sort(df, :Diff, rev=true), allrows=true)