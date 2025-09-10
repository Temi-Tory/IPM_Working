Write-Output "=== COMPREHENSIVE ENDPOINT TESTING ==="
Write-Output "Testing Float, Interval, and Pbox types for both Reachability and Diamond Analysis endpoints"
Write-Output ""

# Test 1: Float Type - Reachability Analysis
Write-Output "1. Testing Float Type - Reachability Analysis"
Write-Output "================================================"
$body = Get-Content 'test_float_reachability.json' -Raw
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8080/reachability-analysis' -Method POST -ContentType 'application/json' -Body $body
    Write-Output "✅ SUCCESS: Float Reachability"
    Write-Output "   - Success: $($response.success)"
    Write-Output "   - Reachable nodes: $($response.reachability_analysis.reachable_nodes_count)"
} catch {
    Write-Output "❌ FAILED: Float Reachability - $($_.Exception.Message)"
}
Write-Output ""

# Test 2: Float Type - Diamond Analysis
Write-Output "2. Testing Float Type - Diamond Analysis"
Write-Output "========================================"
$body = Get-Content 'test_float_diamond.json' -Raw
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8080/diamond-analysis' -Method POST -ContentType 'application/json' -Body $body
    Write-Output "✅ SUCCESS: Float Diamond"
    Write-Output "   - Success: $($response.success)"
    Write-Output "   - Diamond efficiency: $($response.diamond_analysis.diamond_efficiency)"
    Write-Output "   - Unique diamonds: $($response.diamond_analysis.unique_diamonds_count)"
} catch {
    Write-Output "❌ FAILED: Float Diamond - $($_.Exception.Message)"
}
Write-Output ""

# Test 3: Interval Type - Reachability Analysis
Write-Output "3. Testing Interval Type - Reachability Analysis"
Write-Output "==============================================="
$body = Get-Content 'test_interval_reachability.json' -Raw
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8080/reachability-analysis' -Method POST -ContentType 'application/json' -Body $body
    Write-Output "✅ SUCCESS: Interval Reachability"
    Write-Output "   - Success: $($response.success)"
    Write-Output "   - Reachable nodes: $($response.reachability_analysis.reachable_nodes_count)"
} catch {
    Write-Output "❌ FAILED: Interval Reachability - $($_.Exception.Message)"
}
Write-Output ""

# Test 4: Interval Type - Diamond Analysis
Write-Output "4. Testing Interval Type - Diamond Analysis"
Write-Output "=========================================="
$body = Get-Content 'test_interval_diamond.json' -Raw
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8080/diamond-analysis' -Method POST -ContentType 'application/json' -Body $body
    Write-Output "✅ SUCCESS: Interval Diamond"
    Write-Output "   - Success: $($response.success)"
    Write-Output "   - Diamond efficiency: $($response.diamond_analysis.diamond_efficiency)"
    Write-Output "   - Unique diamonds: $($response.diamond_analysis.unique_diamonds_count)"
} catch {
    Write-Output "❌ FAILED: Interval Diamond - $($_.Exception.Message)"
}
Write-Output ""

# Test 5: Pbox Type - Reachability Analysis
Write-Output "5. Testing Pbox Type - Reachability Analysis"
Write-Output "==========================================="
$body = Get-Content 'test_pbox_reachability.json' -Raw
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8080/reachability-analysis' -Method POST -ContentType 'application/json' -Body $body
    Write-Output "✅ SUCCESS: Pbox Reachability"
    Write-Output "   - Success: $($response.success)"
    Write-Output "   - Reachable nodes: $($response.reachability_analysis.reachable_nodes_count)"
} catch {
    Write-Output "❌ FAILED: Pbox Reachability - $($_.Exception.Message)"
}
Write-Output ""

# Test 6: Pbox Type - Diamond Analysis (Degraded scenario)
Write-Output "6. Testing Pbox Type - Diamond Analysis (Degraded)"
Write-Output "================================================="
$body = Get-Content 'test_diamond_request.json' -Raw
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8080/diamond-analysis' -Method POST -ContentType 'application/json' -Body $body
    Write-Output "✅ SUCCESS: Pbox Diamond (Degraded)"
    Write-Output "   - Success: $($response.success)"
    Write-Output "   - Diamond efficiency: $($response.diamond_analysis.diamond_efficiency)"
    Write-Output "   - Unique diamonds: $($response.diamond_analysis.unique_diamonds_count)"
} catch {
    Write-Output "❌ FAILED: Pbox Diamond (Degraded) - $($_.Exception.Message)"
}
Write-Output ""

# Test 7: Pbox Type - Diamond Analysis (Major Degraded scenario)
Write-Output "7. Testing Pbox Type - Diamond Analysis (Major Degraded)"
Write-Output "======================================================="
$body = Get-Content 'test_major_degraded.json' -Raw
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8080/diamond-analysis' -Method POST -ContentType 'application/json' -Body $body
    Write-Output "✅ SUCCESS: Pbox Diamond (Major Degraded)"
    Write-Output "   - Success: $($response.success)"
    Write-Output "   - Diamond efficiency: $($response.diamond_analysis.diamond_efficiency)"
    Write-Output "   - Unique diamonds: $($response.diamond_analysis.unique_diamonds_count)"
} catch {
    Write-Output "❌ FAILED: Pbox Diamond (Major Degraded) - $($_.Exception.Message)"
}
Write-Output ""

Write-Output "=== TESTING COMPLETE ==="