# Test multi-type analysis
$uri = 'http://localhost:8080/upload'

try {
    Write-Output "Testing multi-type analysis..."
    
    # Use Invoke-RestMethod with proper form data handling
    $form = @{
        'networkName' = 'power-network-multi'
        'edges' = Get-Item 'dag_ntwrk_files/power-network/power-network.EDGES'
        'nodepriors' = Get-Item 'dag_ntwrk_files/power-network/float/power-network-nodepriors.json'
        'linkprobabilities' = Get-Item 'dag_ntwrk_files/power-network/float/power-network-linkprobabilities.json'
        'nodepriors_pbox' = Get-Item 'dag_ntwrk_files/power-network/pbox/power-network-nodepriors.json'
        'linkprobabilities_pbox' = Get-Item 'dag_ntwrk_files/power-network/pbox/power-network-linkprobabilities.json'
        'nodepriors_interval' = Get-Item 'dag_ntwrk_files/power-network/interval/power-network-nodepriors.json'
        'linkprobabilities_interval' = Get-Item 'dag_ntwrk_files/power-network/interval/power-network-linkprobabilities.json'
        'capacities' = Get-Item 'dag_ntwrk_files/power-network/capacity/power-network-capacities.json'
        'cpmInputs' = Get-Item 'dag_ntwrk_files/power-network/cpm/power-network-cpm-inputs.json'
        'selectedInferenceTypes' = '["float","pbox","interval"]'
        'compareResults' = 'true'
        'exactInference' = 'true'
        'flowAnalysis' = 'true'
        'criticalPathAnalysis' = 'true'
        'diamondAnalysis' = 'true'
        'basicStructure' = 'true'
    }
    
    $response = Invoke-RestMethod -Uri $uri -Method Post -Form $form -TimeoutSec 180
    
    Write-Output "Multi-type analysis completed!"
    Write-Output "Success: $($response.success)"
    
    if ($response.success) {
        Write-Output "Available results:"
        $response.PSObject.Properties | Where-Object { $_.Name -ne 'success' -and $_.Name -ne 'timestamp' } | ForEach-Object {
            Write-Output "  - $($_.Name)"
        }
        
        # Check for multi-type specific structure
        if ($response.multi_type_inference) {
            Write-Output "Multi-type inference found with types:"
            $response.multi_type_inference.PSObject.Properties | ForEach-Object {
                Write-Output "    - $($_.Name)"
            }
        }
    } else {
        Write-Output "Analysis failed: $($response.error)"
    }
    
    # Save response
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath "multi_type_response_ps.json" -Encoding UTF8
    Write-Output "Response saved to multi_type_response_ps.json"
    
} catch {
    Write-Output "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Output "HTTP Status: $($_.Exception.Response.StatusCode)"
        $errorContent = $_.Exception.Response.GetResponseStream()
        if ($errorContent) {
            $reader = New-Object System.IO.StreamReader($errorContent)
            Write-Output "Error Response: $($reader.ReadToEnd())"
        }
    }
}