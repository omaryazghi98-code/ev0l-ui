$ErrorActionPreference = 'SilentlyContinue'

$root = 'C:\ev0l_stream\genspark-preview'

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '           EV0L STARTUP' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# ------------------------------------------------------------
# Start EV0L API
# ------------------------------------------------------------

if (Test-Path "$root\server.mjs") {
    Write-Host '[1/3] Starting EV0L API...' -ForegroundColor Green
    Start-Process powershell.exe `
        -ArgumentList "-NoExit","-Command","cd '$root'; node server.mjs" `
        -WindowStyle Minimized
}

# ------------------------------------------------------------
# Start Power server
# ------------------------------------------------------------

if (Test-Path "$root\power-server.mjs") {
    Write-Host '[2/3] Starting EV0L Power server...' -ForegroundColor Green
    Start-Process powershell.exe `
        -ArgumentList "-NoExit","-Command","cd '$root'; node power-server.mjs" `
        -WindowStyle Minimized
}

# ------------------------------------------------------------
# Start Vite
# ------------------------------------------------------------

Write-Host '[3/3] Starting EV0L UI...' -ForegroundColor Green

Start-Process powershell.exe `
    -ArgumentList "-NoExit","-Command","cd '$root'; npm run dev -- --host 0.0.0.0" `
    -WindowStyle Minimized

# ------------------------------------------------------------
# Wait for Vite
# ------------------------------------------------------------

Write-Host ''
Write-Host 'Waiting for EV0L UI...' -ForegroundColor Cyan

$ready = $false

for ($i = 0; $i -lt 30; $i++) {

    Start-Sleep -Milliseconds 500

    try {
        $response = Invoke-WebRequest `
            -Uri 'http://127.0.0.1:5173/' `
            -UseBasicParsing `
            -TimeoutSec 1

        if ($response.StatusCode -ge 200) {
            $ready = $true
            break
        }
    }
    catch {}
}

Write-Host ''

if ($ready) {
    Write-Host 'EV0L is ready.' -ForegroundColor Green

    Start-Process 'http://127.0.0.1:5173/'
}
else {
    Write-Host 'Vite did not respond on port 5173 yet.' -ForegroundColor Yellow
    Write-Host 'Check the EV0L terminal windows.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'EV0L startup complete.' -ForegroundColor Green
Write-Host ''
