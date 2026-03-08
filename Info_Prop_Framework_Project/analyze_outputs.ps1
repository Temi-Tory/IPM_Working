$jsonText = Get-Content EXPECTED_OUTPUTS.json -Raw
$jsonText = $jsonText.TrimStart([char]0xFEFF) # Remove BOM if present
$json = $jsonText | ConvertFrom-Json

Write-Host "`n" -ForegroundColor Green
Write-Host "████████████████████████████████████████████████████████████████████████████████" -ForegroundColor Cyan
Write-Host "█                    EXPECTED OUTPUTS ANALYSIS                                 █" -ForegroundColor Cyan
Write-Host "████████████████████████████████████████████████████████████████████████████████" -ForegroundColor Cyan

Write-Host "`n[INFO] JSON STRUCTURE" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "Top-level Keys:" -ForegroundColor White
$json.PSObject.Properties | Select-Object -ExpandProperty Name | ForEach-Object {
    Write-Host "  * $_" -ForegroundColor Green
}

Write-Host "`n[TIME] COMPUTATION METRICS" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "  Computation Time: $($json.computation_time_ms) ms" -ForegroundColor White
$netUtil = [math]::Round($json.network_utilization * 100, 2)
Write-Host "  Network Utilization: $netUtil %" -ForegroundColor White

Write-Host "`n[DATA] EDGE FLOW DATA" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────────────────────" -ForegroundColor Gray
$edgeCount = $json.edge_flows.PSObject.Properties.Count
$nonZeroFlows = @($json.edge_flows.PSObject.Properties | Where-Object { $_.Value -gt 0 }).Count
$totalFlow = ($json.edge_flows.PSObject.Properties | ForEach-Object { $_.Value } | Measure-Object -Sum).Sum
Write-Host "  Total Edges: $edgeCount" -ForegroundColor Cyan
Write-Host "  Active Edges (flow > 0): $nonZeroFlows" -ForegroundColor Cyan
Write-Host "  Total Flow: $([math]::Round($totalFlow, 4)) units" -ForegroundColor Cyan

Write-Host "`n[TOP] TOP 10 EDGES BY FLOW" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────────────────────" -ForegroundColor Gray
@($json.edge_flows.PSObject.Properties | Where-Object { $_.Value -gt 0 } | Sort-Object -Property Value -Descending | Select-Object -First 10) | ForEach-Object {
    $flow = [math]::Round($_.Value, 4)
    Write-Host "  $($_.Name): $flow units" -ForegroundColor Cyan
}

Write-Host "`n[UTIL] EDGE UTILIZATION STATS" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────────────────────" -ForegroundColor Gray
$utilizations = @($json.edge_utilization.PSObject.Properties | Where-Object { $_.Value.capacity -gt 0 } | ForEach-Object { $_.Value.utilization })

if ($utilizations.Count -gt 0) {
    $minUtil = [math]::Round(($utilizations | Measure-Object -Minimum).Minimum * 100, 2)
    $maxUtil = [math]::Round(($utilizations | Measure-Object -Maximum).Maximum * 100, 2)
    $avgUtil = [math]::Round(($utilizations | Measure-Object -Average).Average * 100, 2)
    
    Write-Host "  Min Utilization: $minUtil %" -ForegroundColor Green
    Write-Host "  Max Utilization: $maxUtil %" -ForegroundColor Red
    Write-Host "  Average Utilization: $avgUtil %" -ForegroundColor Yellow
    
    $highUtil = @($utilizations | Where-Object { $_ -ge 0.9 }).Count
    $medUtil = @($utilizations | Where-Object { $_ -ge 0.5 -and $_ -lt 0.9 }).Count
    $lowUtil = @($utilizations | Where-Object { $_ -gt 0 -and $_ -lt 0.5 }).Count
    
    Write-Host "`n  Utilization Distribution:" -ForegroundColor White
    Write-Host "    [HIGH] Very High (90%+): $highUtil edges" -ForegroundColor Red
    Write-Host "    [MED]  Medium (50-90%): $medUtil edges" -ForegroundColor Yellow
    Write-Host "    [LOW]  Low (<50%): $lowUtil edges" -ForegroundColor Green
}

Write-Host "`n[BOTTLENECK] CRITICAL EDGES (95%+ utilization)" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────────────────────" -ForegroundColor Gray
$bottlenecks = @($json.edge_utilization.PSObject.Properties | Where-Object { $_.Value.utilization -ge 0.95 -and $_.Value.capacity -gt 0 } | Sort-Object -Property {$_.Value.utilization} -Descending)

if ($bottlenecks.Count -gt 0) {
    @($bottlenecks | Select-Object -First 10) | ForEach-Object {
        $edge = $_.Name
        $util = [math]::Round($_.Value.utilization * 100, 1)
        $flow = [math]::Round($_.Value.flow, 4)
        $cap = [math]::Round($_.Value.capacity, 4)
        Write-Host "  $edge --> $util% (flow: $flow / capacity: $cap)" -ForegroundColor Red
    }
} else {
    Write-Host "  [OK] No critical bottlenecks found" -ForegroundColor Green
}

Write-Host "`n[INFO] ADDITIONAL DATA" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────────────────────" -ForegroundColor Gray
if ($json.PSObject.Properties.Name -contains "node_utilization") {
    Write-Host "  [OK] Node utilization data available" -ForegroundColor Green
}
if ($json.PSObject.Properties.Name -contains "paths_data") {
    $pathCount = @($json.paths_data).Count
    Write-Host "  [OK] Paths data available ($pathCount paths)" -ForegroundColor Green
}
if ($json.PSObject.Properties.Name -contains "comparative_analysis") {
    Write-Host "  [OK] Comparative analysis available" -ForegroundColor Green
}

Write-Host "`n████████████████████████████████████████████████████████████████████████████████" -ForegroundColor Cyan
Write-Host "SUCCESS: Analysis Complete" -ForegroundColor Green
Write-Host "████████████████████████████████████████████████████████████████████████████████`n" -ForegroundColor Cyan
