$uri = 'http://localhost:8080/analyze'
$form = @{
    'networkFiles' = Get-Item 'dag_ntwrk_files/power-network/power-network.EDGES'
    'linkProbabilities' = Get-Item 'dag_ntwrk_files/power-network/float/power-network-linkprobabilities.json'
    'nodePriors' = Get-Item 'dag_ntwrk_files/power-network/float/power-network-nodepriors.json'
    'capacities' = Get-Item 'dag_ntwrk_files/power-network/capacity/power-network-capacities.json'
    'cpmInputs' = Get-Item 'dag_ntwrk_files/power-network/cpm/power-network-cpm-inputs.json'
    'inferenceDataType' = 'float'
    'exactInference' = 'true'
    'flowAnalysis' = 'true'
    'criticalPath' = 'true'
    'diamondAnalysis' = 'true'
    'networkStructure' = 'true'
}

try {
    Write-Output "Sending single-type analysis request..."
    $response = Invoke-WebRequest -Uri $uri -Method Post -Form $form -TimeoutSec 60
    Write-Output "Status Code: $($response.StatusCode)"
    Write-Output "Content Length: $($response.Content.Length)"
    
    # Parse JSON response
    $jsonResponse = $response.Content | ConvertFrom-Json
    Write-Output "Success: $($jsonResponse.success)"
    
    if ($jsonResponse.success) {
        Write-Output "Analysis completed successfully!"
        Write-Output "Available results:"
        $jsonResponse.PSObject.Properties | Where-Object { $_.Name -ne 'success' -and $_.Name -ne 'timestamp' } | ForEach-Object {
            Write-Output "  - $($_.Name)"
        }
    } else {
        Write-Output "Analysis failed: $($jsonResponse.error)"
    }
    
    # Save full response to file for detailed analysis
    $response.Content | Out-File -FilePath "single_type_response.json" -Encoding UTF8
    Write-Output "Full response saved to single_type_response.json"
    
} catch {
    Write-Output "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Output "HTTP Status: $($_.Exception.Response.StatusCode)"
    }
}