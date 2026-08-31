$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendPath = Join-Path $Root "backend"
$FrontendPath = Join-Path $Root "frontend"
$LogsPath = Join-Path $Root "logs"
$BackendPidFile = Join-Path $LogsPath "backend.pid"
$FrontendPidFile = Join-Path $LogsPath "frontend.pid"
$WatchdogPidFile = Join-Path $LogsPath "watchdog.pid"
$WatchdogLog = Join-Path $LogsPath "watchdog.log"

New-Item -ItemType Directory -Force -Path $LogsPath | Out-Null
Set-Content -LiteralPath $WatchdogPidFile -Value $PID

function Write-WatchdogLog {
  param([string]$Message)
  $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $WatchdogLog -Value "[$Timestamp] $Message"
}

function Test-HttpOk {
  param([string]$Url)
  try {
    $Response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Get-PortPid {
  param([int]$Port)
  $Line = netstat -ano -p tcp | Select-String ":$Port\s+.*LISTENING" | Select-Object -First 1
  if (-not $Line) { return $null }
  return [int](($Line.ToString() -split "\s+")[-1])
}

function Start-NodeApp {
  param(
    [string]$WorkingDirectory,
    [string]$Arguments,
    [string]$PidFile,
    [string]$Name
  )
  $NodePath = (Get-Command node.exe -ErrorAction Stop).Source
  $ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
  $ProcessInfo.FileName = $NodePath
  $ProcessInfo.Arguments = $Arguments
  $ProcessInfo.WorkingDirectory = $WorkingDirectory
  $ProcessInfo.UseShellExecute = $false
  $ProcessInfo.CreateNoWindow = $true
  $Process = New-Object System.Diagnostics.Process
  $Process.StartInfo = $ProcessInfo
  [void]$Process.Start()
  Set-Content -LiteralPath $PidFile -Value $Process.Id
  Write-WatchdogLog "$Name iniciado. PID=$($Process.Id)"
}

function Ensure-FrontendBuild {
  $IndexPath = Join-Path $FrontendPath "dist\index.html"
  if (Test-Path -LiteralPath $IndexPath) { return }
  Write-WatchdogLog "Compilando frontend porque falta dist/index.html"
  $NpmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
  $ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
  $ProcessInfo.FileName = $NpmPath
  $ProcessInfo.Arguments = "run build"
  $ProcessInfo.WorkingDirectory = $FrontendPath
  $ProcessInfo.UseShellExecute = $false
  $ProcessInfo.CreateNoWindow = $true
  $Process = New-Object System.Diagnostics.Process
  $Process.StartInfo = $ProcessInfo
  [void]$Process.Start()
  $Process.WaitForExit()
  Write-WatchdogLog "Compilacion frontend finalizada con codigo $($Process.ExitCode)"
}

Write-WatchdogLog "Watchdog CantusDei activo. Backend=4710 Frontend=4711"

while ($true) {
  if (-not (Test-HttpOk "http://127.0.0.1:4710/health")) {
    $PortPid = Get-PortPid -Port 4710
    if ($PortPid) {
      Write-WatchdogLog "Puerto 4710 ocupado por PID=$PortPid pero CantusDei no responde. No se pisa otro proceso."
    } else {
      Start-NodeApp -WorkingDirectory $BackendPath -Arguments "src/server.js" -PidFile $BackendPidFile -Name "Backend"
    }
  }

  if (-not (Test-HttpOk "http://127.0.0.1:4711/")) {
    $PortPid = Get-PortPid -Port 4711
    if ($PortPid) {
      Write-WatchdogLog "Puerto 4711 ocupado por PID=$PortPid pero CantusDei no responde. No se pisa otro proceso."
    } else {
      Ensure-FrontendBuild
      Start-NodeApp -WorkingDirectory $FrontendPath -Arguments "server.js" -PidFile $FrontendPidFile -Name "Frontend"
    }
  }

  Start-Sleep -Seconds 5
}
