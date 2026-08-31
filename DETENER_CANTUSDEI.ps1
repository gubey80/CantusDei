$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogsPath = Join-Path $Root "logs"
$PidFiles = @(
  (Join-Path $LogsPath "watchdog.pid"),
  (Join-Path $LogsPath "frontend.pid"),
  (Join-Path $LogsPath "backend.pid")
)

foreach ($PidFile in $PidFiles) {
  if (-not (Test-Path -LiteralPath $PidFile)) { continue }
  $PidValue = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $PidValue) { continue }
  $Process = Get-Process -Id ([int]$PidValue) -ErrorAction SilentlyContinue
  if ($Process) {
    Stop-Process -Id $Process.Id -Force
    Write-Output "Proceso detenido: $($Process.Id)"
  }
}

Write-Output "CantusDei detenido."
