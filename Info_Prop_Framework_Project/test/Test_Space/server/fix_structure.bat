# PowerShell script to move files to correct locations
# Run this from the server directory

Write-Host "=== Checking current file locations ===" -ForegroundColor Cyan

# Check what files exist in server root
Write-Host "`nFiles in server root:" -ForegroundColor Yellow
Get-ChildItem *.js, *.css | ForEach-Object { Write-Host "  $($_.Name)" -ForegroundColor White }

# Check public directory structure
Write-Host "`nCurrent public directory contents:" -ForegroundColor Yellow
if (Test-Path "public") {
    Get-ChildItem -Recurse public | ForEach-Object { 
        $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
        if ($_.PSIsContainer) {
            Write-Host "  📁 $relativePath" -ForegroundColor Blue
        } else {
            Write-Host "  📄 $relativePath" -ForegroundColor White
        }
    }
} else {
    Write-Host "  ❌ public directory does not exist!" -ForegroundColor Red
}

Write-Host "`n=== Moving files to correct locations ===" -ForegroundColor Cyan

# Ensure directories exist
$directories = @(
    "public",
    "public\css", 
    "public\js",
    "public\js\managers",
    "public\js\utils"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force
        Write-Host "✅ Created directory: $dir" -ForegroundColor Green
    } else {
        Write-Host "📁 Directory exists: $dir" -ForegroundColor Blue
    }
}

# Move CSS file
if (Test-Path "style.css") {
    Move-Item "style.css" "public\css\" -Force
    Write-Host "✅ Moved style.css to public\css\" -ForegroundColor Green
} else {
    Write-Host "⚠️  style.css not found in server root" -ForegroundColor Yellow
    # Check if it's already in the right place
    if (Test-Path "public\css\style.css") {
        Write-Host "✅ style.css already in public\css\" -ForegroundColor Green
    } else {
        Write-Host "❌ style.css not found anywhere!" -ForegroundColor Red
    }
}

# Move main.js
if (Test-Path "main.js") {
    Move-Item "main.js" "public\js\" -Force
    Write-Host "✅ Moved main.js to public\js\" -ForegroundColor Green
} else {
    Write-Host "⚠️  main.js not found in server root" -ForegroundColor Yellow
    if (Test-Path "public\js\main.js") {
        Write-Host "✅ main.js already in public\js\" -ForegroundColor Green
    } else {
        Write-Host "❌ main.js not found anywhere!" -ForegroundColor Red
    }
}

# Move utility file
if (Test-Path "ui-utils.js") {
    Move-Item "ui-utils.js" "public\js\utils\" -Force
    Write-Host "✅ Moved ui-utils.js to public\js\utils\" -ForegroundColor Green
} else {
    Write-Host "⚠️  ui-utils.js not found in server root" -ForegroundColor Yellow
    if (Test-Path "public\js\utils\ui-utils.js") {
        Write-Host "✅ ui-utils.js already in public\js\utils\" -ForegroundColor Green
    } else {
        Write-Host "❌ ui-utils.js not found anywhere!" -ForegroundColor Red
    }
}

# Move manager files
$managerFiles = @(
    "analysis-manager.js",
    "diamond-manager.js", 
    "dom-manager.js",
    "export-manager.js",
    "file-manager.js",
    "state-manager.js",
    "tab-manager.js",
    "visualization-manager.js"
)

Write-Host "`nMoving manager files:" -ForegroundColor Cyan
foreach ($file in $managerFiles) {
    if (Test-Path $file) {
        Move-Item $file "public\js\managers\" -Force
        Write-Host "✅ Moved $file to public\js\managers\" -ForegroundColor Green
    } else {
        Write-Host "⚠️  $file not found in server root" -ForegroundColor Yellow
        if (Test-Path "public\js\managers\$file") {
            Write-Host "✅ $file already in public\js\managers\" -ForegroundColor Green
        } else {
            Write-Host "❌ $file not found anywhere!" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== Final verification ===" -ForegroundColor Cyan
Write-Host "Final public directory structure:" -ForegroundColor Yellow
Get-ChildItem -Recurse public | ForEach-Object { 
    $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
    if ($_.PSIsContainer) {
        Write-Host "  📁 $relativePath" -ForegroundColor Blue
    } else {
        Write-Host "  📄 $relativePath" -ForegroundColor White
    }
}

Write-Host "`n✅ File organization complete!" -ForegroundColor Green
Write-Host "Now restart your Julia server with: julia server.jl" -ForegroundColor Yellow