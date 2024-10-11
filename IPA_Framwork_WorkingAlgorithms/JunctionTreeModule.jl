module JunctionTreeModule
using DataStructures, Graphs
   function convert_to_moral_graph(outgoing_index::Dict{Int64,Set{Int64}}, 
      incoming_index::Dict{Int64,Set{Int64}}
    )
        moral_graph = Dict{Int64, Vector{Int64}}()

        # Initialize the moral graph with all nodes
        for node in union(keys(outgoing_index), keys(incoming_index))
            moral_graph[node] = Vector{Int64}()
        end

        # Add all original edges as undirected
        for (source, targets) in outgoing_index
            for target in targets
                push!(moral_graph[source], target)
                push!(moral_graph[target], source)
            end
        end

        # Add edges between parents of common children
        for (child, parents) in incoming_index
            if length(parents) > 1
                for parent1 in parents
                    for parent2 in parents
                        if parent1 != parent2
                            push!(moral_graph[parent1], parent2)
                            push!(moral_graph[parent2], parent1)
                        end
                    end
                end
            end
        end

        # Remove duplicates and sort the neighbor lists
        for (node, neighbors) in moral_graph
            moral_graph[node] = sort(unique(neighbors))
        end

        return moral_graph
    end
end