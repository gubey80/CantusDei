$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendPath = Join-Path $Root "backend"
$FrontendPath = Join-Path $Root "frontend"
$LogsPath = Join-Path $Root "logs"
$WatchdogScript = Join-Path $Root "WATCHDOG_CANTUSDEI.ps1"
$WatchdogPidFile = Join-Path $LogsPath "watchdog.pid"

New-Item -ItemType Directory -Force -Path $LogsPath | Out-Null

function Test-HttpOk {
  param([string]$Url)
  try {
    $Response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Test-PortOwner {
  param([int]$Port)
  $Line = netstat -ano -p tcp | Select-String ":$Port\s+.*LISTENING" | Select-Object -First 1
  if (-not $Line) { return $null }
  $PidValue = [int](($Line.ToString() -split "\s+")[-1])
  return Get-Process -Id $PidValue -ErrorAction SilentlyContinue
}

function Start-Watchdog {
  $ExistingPid = if (Test-Path -LiteralPath $WatchdogPidFile) { Get-Content -LiteralPath $WatchdogPidFile -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
  if ($ExistingPid) {
    $Existing = Get-Process -Id ([int]$ExistingPid) -ErrorAction SilentlyContinue
    if ($Existing) { return $Existing.Id }
  }

  $PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
  $Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScript`""
  $Process = Start-Process -FilePath $PowerShell -ArgumentList $Arguments -WorkingDirectory $Root -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $WatchdogPidFile -Value $Process.Id
  return $Process.Id
}

$BackendOwner = Test-PortOwner -Port 4710
if ($BackendOwner -and -not (Test-HttpOk "http://127.0.0.1:4710/health")) {
  throw "El puerto 4710 esta ocupado por el proceso $($BackendOwner.Id), pero no responde como CantusDei."
}

$FrontendOwner = Test-PortOwner -Port 4711
if ($FrontendOwner -and -not (Test-HttpOk "http://127.0.0.1:4711/")) {
  throw "El puerto 4711 esta ocupado por el proceso $($FrontendOwner.Id), pero no responde como CantusDei."
}

$WatchdogPid = Start-Watchdog

$BackendReady = $false
$FrontendReady = $false
for ($Attempt = 0; $Attempt -lt 30; $Attempt++) {
  $BackendReady = Test-HttpOk "http://127.0.0.1:4710/health"
  $FrontendReady = Test-HttpOk "http://127.0.0.1:4711/"
  if ($BackendReady -and $FrontendReady) { break }
  Start-Sleep -Seconds 1
}

if (-not $BackendReady) { throw "CantusDei backend no inicio en http://127.0.0.1:4710" }
if (-not $FrontendReady) { throw "CantusDei frontend no inicio en http://127.0.0.1:4711" }

Write-Output "CantusDei levantado"
Write-Output "Frontend: http://127.0.0.1:4711/"
Write-Output "Backend:  http://127.0.0.1:4710"
Write-Output "Watchdog PID: $WatchdogPid"
