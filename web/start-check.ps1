$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location "C:\Users\lenovo\Desktop\python_learning\campus-trade\web"

$proc = Start-Process -FilePath "C:\Program Files\nodejs\node.exe" `
    -ArgumentList "node_modules/vite/bin/vite.js", "--port", "5173", "--host" `
    -NoNewWindow -PassThru `
    -RedirectStandardOutput "vite-run.log" `
    -RedirectStandardError "vite-err.log"

Start-Sleep -Seconds 15

Write-Output "PID: $($proc.Id) Exited: $($proc.HasExited)"
Write-Output "=== PORT CHECK ==="
$portCheck = netstat -ano | Select-String ":5173"
if ($portCheck) { Write-Output "Port 5173: LISTENING"; $portCheck }
else { Write-Output "Port 5173: NOT LISTENING" }

Write-Output "=== LOG ==="
if (Test-Path "vite-run.log") { Get-Content "vite-run.log" -ErrorAction SilentlyContinue }
Write-Output "=== ERR ==="
if (Test-Path "vite-err.log") { Get-Content "vite-err.log" -ErrorAction SilentlyContinue }