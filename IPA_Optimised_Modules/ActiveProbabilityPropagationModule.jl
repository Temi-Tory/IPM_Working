module ActiveProbabilityPropagationModule

    import Cairo, Fontconfig 
    using Random, Graphs, GraphMakie, GLMakie, CairoMakie, DataFrames, DelimitedFiles, Distributions, DataStructures, SparseArrays, BenchmarkTools, Combinatorics

    using Main.InputProcessingModule
    using Main.PathAnalysisModule

    function update_node_belief(
        belief_dict::Dict{Int64,Float64}, 
        link_probability::Dict{Tuple{Int64, Int64}, Distribution}, 
        node_index::Int64,
        node_Prior:: Distribution,
        parents::Set{Int64}
        )

        messages_from_parents = [1 - (belief_dict[parent] * sampleInputDistribution(link_probability[parent, node_index])) for parent in parents]
        updated_belief = 1 - prod(messages_from_parents)

        node_prior_sampled = sampleInputDistribution(node_Prior)
        updated_belief = node_prior_sampled * updated_belief

        return updated_belief # returns updated belief of the node 
    end

    function sampleInputDistribution(distribution::Distribution, epsilon::Float64=0.0000001)
        if isa(distribution, DiscreteUnivariateDistribution)
            # Directly return the probability of success for discrete distributions
            return pdf(distribution, 1)  # This will return the PMF at 1
        elseif isa(distribution, ContinuousUnivariateDistribution)
            # For continuous distributions, use numerical integration to estimate the density near 1
            lower_bound = 1 - epsilon
            upper_bound = 1 + epsilon
            
            # Integrate the PDF over this small interval around 1
            probability, error = quadgk(x -> pdf(distribution, x), lower_bound, upper_bound)
            return probability
        else
            # For non-standard or unsupported distributions, return an error or a warning
            return nothing  # todo: return an error message indicating unsupported distribution type
        end
    end      

    function set_node_priors(iteration_sets::Vector{Set{Int64}})
        Node_Priors = Dict{Int, Distribution}()

        # Create a union of all sets in iteration_sets
        distinct_nodes = union(iteration_sets...)

        # Iterate over the distinct nodes
        for node in distinct_nodes
            Node_Priors[node] = Bernoulli(1.0)
        end

        return Node_Priors
    end

    function set_edge_probabilities(edgelist::Vector{Tuple{Int64,Int64}})
        link_probability = Dict{Tuple{Int64, Int64}, Distribution}()
        for e in edgelist
            link_probability[e] = Bernoulli(0.9)
        end

        return link_probability
    end

    function run_informationpropagation(filepath)
        edgelist, outgoing_index, incoming_index, source_nodes = InputProcessingModule.read_graph_to_dict(filepath)
        
        link_probability = set_edge_probabilities(edgelist)
        
        fork_nodes, join_nodes = InputProcessingModule.identify_fork_and_join_nodes(outgoing_index, incoming_index)
        iteration_sets, ancestors, descendants, common_ancestors_dict = InputProcessingModule.find_iteration_sets(edgelist, outgoing_index, incoming_index, fork_nodes, join_nodes, source_nodes)
        
        node_priors = set_node_priors(iteration_sets)
        
        belief_dict = Dict{Int64,Float64}()
        # Initialize belief_dict with prior probabilities
        for node in keys(node_priors)
            belief_dict[node] = sampleInputDistribution(node_priors[node])
        end

        for iteration_set in iteration_sets
            Threads.@threads  for node_index in collect(iteration_set)     
                if  node_index ∉ source_nodes
                    parents = incoming_index[node_index]
                    belief_dict[node_index] = update_node_belief(belief_dict, link_probability, node_index, node_priors[node_index], parents)    
                end       
            
            end   
        end

        return belief_dict
    end
end
