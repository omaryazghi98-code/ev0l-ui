$ErrorActionPreference = 'Stop'

$Root = 'C:\ev0l_stream\genspark-preview'
$NodePath = (Get-Command node.exe -ErrorAction Stop).Source
$NpmPath = (Get-Command npm.cmd -ErrorAction Stop).Source

$Services = @{
    API = @{ Port = 8090; Script = 'server.mjs'; Url = 'http://127.0.0.1:8090/api/health'; Kind = 'api' }
    Power = @{ Port = 8091; Script = 'power-server.mjs'; Url = 'http://127.0.0.1:8091/api/system/ghost-sentry'; Kind = 'power' }
    UI = @{ Port = 5173; Script = $null; Url = 'http://127.0.0.1:5173/'; Kind = 'ui' }
}

function Write-MenuLine {
    param(
        [string]$Text,
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )
    Write-Host $Text -ForegroundColor $Color
}

function Assert-Root {
    if (-not (Test-Path (Join-Path $Root 'package.json'))) {
        throw "EV0L project not found at $Root"
    }
}

function Get-PortOwner {
    param([int]$Port)

    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if (-not $connection) { return $null }
        return $connection.OwningProcess
    }
    catch {
        return $null
    }
}

function Get-ProcessInfoById {
    param([int]$Id)

    try {
        Get-CimInstance Win32_Process -Filter "ProcessId = $Id" -ErrorAction Stop
    }
    catch {
        $null
    }
}

function Get-EvolProcesses {
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            ($_.CommandLine -like "*$Root*server.mjs*" -or
             $_.CommandLine -like "*$Root*power-server.mjs*" -or
             $_.CommandLine -like "*$Root*vite*bin*vite.js*" )
        }
}

function Test-EvolProcess {
    param(
        [ValidateSet('API','Power','UI')]
        [string]$Name,
        [string]$CommandLine
    )

    if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $false }

    switch ($Name) {
        'API'   { return $CommandLine -like "*$Root*server.mjs*" -and $CommandLine -notlike "*$Root*power-server.mjs*" }
        'Power' { return $CommandLine -like "*$Root*power-server.mjs*" }
        'UI'    {
            return (
                $CommandLine -like "*$Root*vite*bin*vite.js*" -and
                $CommandLine -like '*--host 0.0.0.0*'
            )
        }
    }

    return $false
}

function Start-EvolService {
    param(
        [ValidateSet('API','Power','UI')]
        [string]$Name
    )

    Assert-Root
    $service = $Services[$Name]
    $owner = Get-PortOwner $service.Port

    if ($owner) {
        $proc = Get-ProcessInfoById $owner
        Write-MenuLine "[$Name] Already listening on $($service.Port) (PID $owner)" Yellow
        if ($proc) {
            Write-MenuLine "      $($proc.CommandLine)" DarkGray
        }
        return
    }

    if ($Name -eq 'UI') {
        Write-MenuLine '[UI] Starting Vite on 5173...' Green
        Start-Process powershell.exe -ArgumentList @(
            '-NoExit',
            '-Command',
            "Set-Location -LiteralPath '$Root'; & '$NpmPath' run dev -- --host 0.0.0.0"
        )
        return
    }

    $script = $service.Script
    $scriptPath = Join-Path $Root $script
    if (-not (Test-Path $scriptPath)) {
        throw "Missing $scriptPath"
    }

    Write-MenuLine "[$Name] Starting $script on $($service.Port)..." Green
    Start-Process powershell.exe -ArgumentList @(
        '-NoExit',
        '-Command',
        "Set-Location -LiteralPath '$Root'; & '$NodePath' '$scriptPath'"
    )
}

function Stop-EvolService {
    param(
        [ValidateSet('API','Power','UI')]
        [string]$Name
    )

    $service = $Services[$Name]
    $owner = Get-PortOwner $service.Port
    if (-not $owner) {
        Write-MenuLine "[$Name] Nothing listening on $($service.Port)." DarkGray
        return
    }

    $proc = Get-ProcessInfoById $owner
    if (-not $proc) {
        Write-MenuLine "[$Name] PID $owner could not be inspected; refusing to kill blindly." Red
        return
    }

    if (-not (Test-EvolProcess -Name $Name -CommandLine $proc.CommandLine)) {
        Write-MenuLine "[$Name] Refusing to stop PID $owner because it is not an EV0L process:" Red
        Write-MenuLine "      $($proc.CommandLine)" Yellow
        return
    }

    Write-MenuLine "[$Name] Stopping PID $owner..." Yellow
    Stop-Process -Id $owner -Force
    Start-Sleep -Milliseconds 250
    Write-MenuLine "[$Name] Stopped." Green
}

function Restart-EvolService {
    param([ValidateSet('API','Power','UI')][string]$Name)
    Stop-EvolService $Name
    Start-EvolService $Name
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [int]$Attempts = 20
    )

    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {}
        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Invoke-HealthCheck {
    Write-MenuLine ''
    Write-MenuLine 'EV0L HEALTH CHECKS' Cyan
    Write-MenuLine '------------------' Cyan

    foreach ($name in @('API','Power','UI')) {
        $service = $Services[$name]
        try {
            $response = Invoke-WebRequest -Uri $service.Url -UseBasicParsing -TimeoutSec 4
            Write-MenuLine "[PASS] $Name $($service.Port) -> HTTP $($response.StatusCode)" Green
            if ($name -eq 'API') {
                Write-MenuLine "       $($response.Content)" DarkGray
            }
        }
        catch {
            Write-MenuLine "[FAIL] $Name $($service.Port) -> $($_.Exception.Message)" Red
        }
    }
}

function Show-Status {
    Write-MenuLine ''
    Write-MenuLine 'EV0L SERVICE STATUS' Cyan
    Write-MenuLine '-------------------' Cyan

    foreach ($name in @('API','Power','UI')) {
        $service = $Services[$name]
        $owner = Get-PortOwner $service.Port
        if (-not $owner) {
            Write-MenuLine "[OFF]  $Name   :$($service.Port)" Red
            continue
        }

        $proc = Get-ProcessInfoById $owner
        Write-MenuLine "[ON]   $Name   :$($service.Port)  PID=$owner" Green
        if ($proc) {
            Write-MenuLine "       $($proc.CommandLine)" DarkGray
        }
    }
}

function Start-All {
    foreach ($name in @('API','Power','UI')) {
        Start-EvolService $name
    }
    Write-MenuLine 'Waiting for services...' Cyan
    Start-Sleep -Seconds 1
    Show-Status
}

function Stop-All {
    foreach ($name in @('UI','Power','API')) {
        Stop-EvolService $name
    }
}

function Restart-All {
    Stop-All
    Start-All
}

function Open-Evol {
    Start-Process 'http://127.0.0.1:5173/'
}

function Open-Settings {
    Start-Process 'http://127.0.0.1:5173/settings'
}

function Run-Build {
    Assert-Root
    Write-MenuLine 'Running TypeScript check + production build...' Cyan
    Push-Location $Root
    try {
        & $NpmPath run build
        if ($LASTEXITCODE -eq 0) {
            Write-MenuLine 'Build PASS.' Green
        }
        else {
            Write-MenuLine "Build FAILED (exit $LASTEXITCODE)." Red
        }
    }
    finally {
        Pop-Location
    }
}

function Show-ProcessDetails {
    Write-MenuLine ''
    Write-MenuLine 'EV0L PROCESS DETAILS' Cyan
    Write-MenuLine '--------------------' Cyan

    $processes = Get-EvolProcesses
    if (-not $processes) {
        Write-MenuLine 'No EV0L Node processes found.' Yellow
        return
    }

    $processes |
        Select-Object ProcessId, ParentProcessId, ExecutablePath, CommandLine |
        Format-List
}

function Show-SystemPowerHint {
    Write-MenuLine ''
    Write-MenuLine 'SYSTEM POWER' Cyan
    Write-MenuLine '------------' Cyan
    Write-MenuLine 'Actual sleep/restart/shutdown remains protected by the EV0L Power Server PIN.' Yellow
    Write-MenuLine 'Use the EV0L GUI Power controls or Settings → Ghost Sentry.' Gray
}

function Draw-Menu {
    Clear-Host
    Write-MenuLine '============================================' Cyan
    Write-MenuLine '              EV0L DEV MENU' Cyan
    Write-MenuLine '============================================' Cyan
    Write-MenuLine "Project : $Root" Gray
    Write-MenuLine ''
    Write-MenuLine ' 1  Start all services' White
    Write-MenuLine ' 2  Stop all services' White
    Write-MenuLine ' 3  Restart all services' White
    Write-MenuLine ' 4  Start API (8090)' White
    Write-MenuLine ' 5  Start Power Server (8091)' White
    Write-MenuLine ' 6  Start Vite UI (5173)' White
    Write-MenuLine ' 7  Restart API' White
    Write-MenuLine ' 8  Restart Power Server' White
    Write-MenuLine ' 9  Restart Vite UI' White
    Write-MenuLine '10  Status / PIDs' White
    Write-MenuLine '11  Health checks' White
    Write-MenuLine '12  Build + TypeScript check' White
    Write-MenuLine '13  Open EV0L' White
    Write-MenuLine '14  Open Settings' White
    Write-MenuLine '15  Process details' White
    Write-MenuLine '16  System-power guidance' White
    Write-MenuLine ' Q  Quit' White
    Write-MenuLine ''
}

Assert-Root

while ($true) {
    Draw-Menu
    $choice = Read-Host 'Select'

    try {
        switch ($choice.ToUpperInvariant()) {
            '1'  { Start-All }
            '2'  { Stop-All }
            '3'  { Restart-All }
            '4'  { Start-EvolService 'API' }
            '5'  { Start-EvolService 'Power' }
            '6'  { Start-EvolService 'UI' }
            '7'  { Restart-EvolService 'API' }
            '8'  { Restart-EvolService 'Power' }
            '9'  { Restart-EvolService 'UI' }
            '10' { Show-Status }
            '11' { Invoke-HealthCheck }
            '12' { Run-Build }
            '13' { Open-Evol }
            '14' { Open-Settings }
            '15' { Show-ProcessDetails }
            '16' { Show-SystemPowerHint }
            'Q'  { break }
            default { Write-MenuLine 'Unknown option.' Yellow }
        }
    }
    catch {
        Write-MenuLine "ERROR: $($_.Exception.Message)" Red
    }

    if ($choice.ToUpperInvariant() -ne 'Q') {
        Write-MenuLine ''
        [void](Read-Host 'Press Enter to continue')
    }
}
