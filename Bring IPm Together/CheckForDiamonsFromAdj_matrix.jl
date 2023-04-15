using DelimitedFiles

# Function to identify diamond subgraphs
function find_diamond_subgraphs(adj_matrix)
    n = size(adj_matrix, 1)
    diamond_subgraphs = []
    for i in 1:n
        incoming_i = findall(adj_matrix[:, i] .!= 0)
        outgoing_i = findall(adj_matrix[i, :] .!= 0)
        for j in incoming_i
            for k in outgoing_i
                if adj_matrix[j, k] != 0
                    common_neighbors = intersect(findall(adj_matrix[:, j] .!= 0), findall(adj_matrix[k, :] .!= 0))
                    for l in common_neighbors
                        if l != i && adj_matrix[l, j] != 0 && adj_matrix[k, l] != 0
                            diamond_subgraph = [j, i, k, l]
                            push!(diamond_subgraphs, diamond_subgraph)
                        end
                    end
                end
            end
        end
    end
    unique(diamond_subgraphs)
end


function mainCheck()
    # Load adjacency matrix from CSV file
    system_data = readdlm("16 NodeNetwork Adjacency matrix.csv",  ',', header= false, Int);
    system_matrix = Matrix(DataFrame(system_data, :auto));

    # Find diamond subgraphs
    diamond_subgraphs = find_diamond_subgraphs(system_matrix)

    # Print results
    println("Diamond subgraphs:")
    for subgraph in diamond_subgraphs
        println(subgraph)
    end

end

mainCheck()

test = [
    0 1 0 0 0 1 0 0;
    1 0 0 0 0 0 0 0;
    0 0 0 0 0 0 0 1;
    0 0 0 0 0 0 1 0;
    0 0 0 0 0 0 0 1;
    1 0 0 0 0 0 1 0;
    0 0 0 1 0 1 0 0;
    0 0 1 0 1 0 0 0
]

# Find diamond subgraphs
diamond_subgraphs = find_diamond_subgraphs(test)

# Print results
println("Diamond subgraphs:")
for subgraph in diamond_subgraphs
    println(subgraph)
end