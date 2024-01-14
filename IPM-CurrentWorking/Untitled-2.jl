
import Cairo,Fontconfig 
using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, MetaGraphs, IterTools, SimpleWeightedGraphs
using GraphMakie.NetworkLayout 
GLMakie.activate!()

Random.seed!(2409);


function update_node_belief(belief_dict, link_reliability, new_system_graph, node, nodePrior)
    # Calculate combined reliability from each parent (series configuration)
    combined_reliability_from_parents = [belief_dict[parent] * link_reliability[(parent, node)] for parent in inneighbors(new_system_graph, node)]
    #combined_reliability_from_parents = [belief_dict[parent] * link_reliability for parent in inneighbors(new_system_graph, node)]
    # Calculate overall reliability from parents (parallel configuration)
    reliability_from_parents = 1 - prod(1 .- combined_reliability_from_parents)

    # Combine child's initial probability with reliability from parents
    if (nodePrior == 1.0)
        updated_belief = 1 - (1 - reliability_from_parents)

        return updated_belief
    end
    updated_belief = 1 - (1 - nodePrior) * (1 - reliability_from_parents)

    return updated_belief
end


   function update_belief(new_system_graph, original_system_graph, link_reliability, node_Priors, sources, belief_dict, edgepairs)
    for node in 1:nv(new_system_graph) #for every node in graph       
        if inneighbors(new_system_graph, node) == inneighbors(original_system_graph, node) && 
           (outneighbors(new_system_graph, node) != outneighbors(original_system_graph, node) || isempty(outneighbors(original_system_graph, node)))
            # Check if the node is in the sources list
            belief_dict[node] = (node in sources ? node_Priors[node] : update_node_belief(belief_dict, link_reliability, new_system_graph, node,node_Priors[node]))

            children = [c for c in outneighbors(original_system_graph, node)]
            for child in children
                if inneighbors(new_system_graph, child) == inneighbors(original_system_graph, child) && isempty(outneighbors(original_system_graph, child))
                    belief_dict[child] = update_node_belief(belief_dict, link_reliability, new_system_graph, child, node_Priors[child])
                else
                    append!(edgepairs, [(node, child) for child in children])
                end
            end
        end
    end    
    return belief_dict, edgepairs
end

    function update_graph(new_system_graph,edgepairs)
        for edge in edgepairs 
           
            add_edge!(new_system_graph,edge)
        end
        empty!(edgepairs) # Clear the edgepairs list after updating the graph
    end

    function reliability_propagation(system_matrix,sources,link_reliability,node_Priors=[])

        
        original_system_graph= DiGraph(system_matrix)
        new_system_graph = DiGraph(zero(system_matrix));
        belief_dict=Dict(); edgepairs=[]; terminating_nodes=[]; #f = Figure(); structure_count=0;

        if (node_Priors == [])
            node_Priors = fill(1.0, nv(new_system_graph));
        end
        while new_system_graph != original_system_graph
            belief_dict,edgepairs = update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs)
            update_graph(new_system_graph,edgepairs);
            #=
            plotinteraction(new_system_graph, sources);
            has_diamond_subgraph(adjacency_matrix(new_system_graph))
            =#
            
            #structure_count = structure_count + 1;
            #intermediate_structure_update(new_system_graph,f,structure_count)
        end

        #= terminating_nodes = [if isempty(outneighbors(new_system_graph,node)) node end for node in 1:nv(new_system_graph)] #identify terminating nodes #
        for t_node in terminating_nodes
            belief_dict[t_node] = update_node_belief(belief_dict, link_reliability,new_system_graph, t_node);
        end
        =#

        belief_dict,edgepairs = update_belief(new_system_graph,original_system_graph,link_reliability,node_Priors,sources,belief_dict,edgepairs)
       # belief_dict[nv(new_system_graph)] = 1-prod([ 1- (belief_dict[parent]*link_reliability) for parent in inneighbors(new_system_graph, nv(new_system_graph))]);

        Node_Reliability=sort(collect(pairs(belief_dict)), by=x->x[1]);

        return new_system_graph,Node_Reliability        

    end

    diamondadj_matrix = Matrix([
        0  0  0  1  0  0;
        0  0  1  0  0  1;
        0  0  0  1  0  0;
        0  0  0  0  1  0;
        0  0  0  0  0  0;
        0  0  0  0  1  0;
    ]);
    
    diamondlinkreliability = Dict{Tuple{Int64, Int64}, Float64}(
        (4, 5) => 0.9,
        (6, 5) => 0.9,
        (3, 4) => 0.9,
        (1, 4) => 0.9,
        (2, 3) => 0.9,
        (2, 6) => 0.9
    );

    node_Priors = [0.9, 1.0, 1.0, 1.0, 1.0, 1.0]    
    a,b = reliability_propagation(diamondadj_matrix, [1,2], 0.9,node_Priors) 
    beleifJoinSuccessFork = b[5][2]


    node_Priors = [0.9, 0.0, 1.0, 1.0, 1.0, 1.0]    
    a,b = reliability_propagation(diamondadj_matrix, [1,2], 0.9,node_Priors)
    beleifJoinFailureFork = b[5][2]

    beleifJoiNode = (beleifJoinSuccessFork * 0.9) + (beleifJoinFailureFork * (1-0.9))