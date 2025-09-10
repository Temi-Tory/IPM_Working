$body = Get-Content 'test_diamond_request.json' -Raw
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8080/diamond-analysis' -Method POST -ContentType 'application/json' -Body $body
    Write-Output "Success:"
    Write-Output $response
} catch {
    Write-Output "Error:"
    Write-Output $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Output "Response body:"
        Write-Output $responseBody
    }
}