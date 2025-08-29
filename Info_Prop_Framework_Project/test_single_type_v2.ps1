Add-Type -AssemblyName System.Net.Http

$uri = 'http://localhost:8080/analyze'

try {
    Write-Output "Sending single-type analysis request..."
    
    # Create HttpClient and MultipartFormDataContent
    $httpClient = New-Object System.Net.Http.HttpClient
    $httpClient.Timeout = [TimeSpan]::FromSeconds(60)
    
    $multipartContent = New-Object System.Net.Http.MultipartFormDataContent
    
    # Add files
    $edgesFile = [System.IO.File]::ReadAllBytes("dag_ntwrk_files/power-network/power-network.EDGES")
    $edgesContent = New-Object System.Net.Http.ByteArrayContent($edgesFile)
    $edgesContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
    $multipartContent.Add($edgesContent, "networkFiles", "power-network.EDGES")
    
    $linkProbFile = [System.IO.File]::ReadAllBytes("dag_ntwrk_files/power-network/float/power-network-linkprobabilities.json")
    $linkProbContent = New-Object System.Net.Http.ByteArrayContent($linkProbFile)
    $linkProbContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/json")
    $multipartContent.Add($linkProbContent, "linkProbabilities", "power-network-linkprobabilities.json")
    
    $nodePriorsFile = [System.IO.File]::ReadAllBytes("dag_ntwrk_files/power-network/float/power-network-nodepriors.json")
    $nodePriorsContent = New-Object System.Net.Http.ByteArrayContent($nodePriorsFile)
    $nodePriorsContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/json")
    $multipartContent.Add($nodePriorsContent, "nodePriors", "power-network-nodepriors.json")
    
    $capacitiesFile = [System.IO.File]::ReadAllBytes("dag_ntwrk_files/power-network/capacity/power-network-capacities.json")
    $capacitiesContent = New-Object System.Net.Http.ByteArrayContent($capacitiesFile)
    $capacitiesContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/json")
    $multipartContent.Add($capacitiesContent, "capacities", "power-network-capacities.json")
    
    $cpmFile = [System.IO.File]::ReadAllBytes("dag_ntwrk_files/power-network/cpm/power-network-cpm-inputs.json")
    $cpmContent = New-Object System.Net.Http.ByteArrayContent($cpmFile)
    $cpmContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/json")
    $multipartContent.Add($cpmContent, "cpmInputs", "power-network-cpm-inputs.json")
    
    # Add form fields
    $multipartContent.Add((New-Object System.Net.Http.StringContent("float")), "inferenceDataType")
    $multipartContent.Add((New-Object System.Net.Http.StringContent("true")), "exactInference")
    $multipartContent.Add((New-Object System.Net.Http.StringContent("true")), "flowAnalysis")
    $multipartContent.Add((New-Object System.Net.Http.StringContent("true")), "criticalPath")
    $multipartContent.Add((New-Object System.Net.Http.StringContent("true")), "diamondAnalysis")
    $multipartContent.Add((New-Object System.Net.Http.StringContent("true")), "networkStructure")
    
    # Send request
    $response = $httpClient.PostAsync($uri, $multipartContent).Result
    $responseContent = $response.Content.ReadAsStringAsync().Result
    
    Write-Output "Status Code: $($response.StatusCode)"
    Write-Output "Content Length: $($responseContent.Length)"
    
    if ($response.IsSuccessStatusCode) {
        # Parse JSON response
        $jsonResponse = $responseContent | ConvertFrom-Json
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
        $responseContent | Out-File -FilePath "single_type_response.json" -Encoding UTF8
        Write-Output "Full response saved to single_type_response.json"
    } else {
        Write-Output "HTTP Error: $($response.StatusCode)"
        Write-Output "Response: $responseContent"
    }
    
} catch {
    Write-Output "Error: $($_.Exception.Message)"
    Write-Output "Stack Trace: $($_.Exception.StackTrace)"
} finally {
    if ($httpClient) { $httpClient.Dispose() }
    if ($multipartContent) { $multipartContent.Dispose() }
}