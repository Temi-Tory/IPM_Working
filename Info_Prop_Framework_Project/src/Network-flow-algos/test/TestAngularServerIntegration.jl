"""
TestAngularServerIntegration.jl

Test script to validate Angular app → Julia server integration.
This demonstrates the correct JSON format the Angular app should send.
"""

using HTTP, JSON

"""
    test_angular_server_integration()

Test the Angular app → Julia server data flow with the correct JSON format.
"""
function test_angular_server_integration()
    println("🧪 TESTING ANGULAR → JULIA SERVER INTEGRATION")
    println("=" ^ 60)
    
    # Simulate the exact JSON format the Angular app sends
    angular_payload = Dict(
        "edges" => [
            Dict("source" => 1, "destination" => 2),
            Dict("source" => 1, "destination" => 5),
            Dict("source" => 2, "destination" => 6),
            Dict("source" => 3, "destination" => 2),
            Dict("source" => 3, "destination" => 4)
        ],
        "nodePriors" => Dict(
            "nodes" => Dict(
                "1" => 0.9,
                "2" => 0.9,
                "3" => 0.9,
                "4" => 0.9,
                "5" => 0.9,
                "6" => 0.9
            ),
            "data_type" => "Float64"
        ),
        "edgeProbabilities" => Dict(
            "links" => Dict(
                "(1,2)" => 0.8,
                "(1,5)" => 0.8,
                "(2,6)" => 0.8,
                "(3,2)" => 0.8,
                "(3,4)" => 0.8
            ),
            "data_type" => "Float64"
        )
    )
    
    println("📤 Angular payload created:")
    println("  - Edges: $(length(angular_payload["edges"]))")
    println("  - Node priors: $(length(angular_payload["nodePriors"]["nodes"]))")
    println("  - Edge probabilities: $(length(angular_payload["edgeProbabilities"]["links"]))")
    
    return angular_payload
end

export test_angular_server_integration