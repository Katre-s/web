$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location "C:\Users\lenovo\Desktop\python_learning\campus-trade\web"
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
Write-Output "=== START BUILD ==="
& "C:\Program Files\nodejs\node.exe" "node_modules/vite/bin/vite.js" build 2>&1
Write-Output "=== EXIT: $LASTEXITCODE ==="
if (Test-Path "dist") {
    Write-Output "=== dist files count ==="
    (Get-ChildItem "dist" -Recurse).Count
}