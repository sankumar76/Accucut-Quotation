<#
  run-autopilot.ps1 - Windows PowerShell version of run-autopilot.sh.
  Runs the AI delivery team unattended.

  Usage (from the repository folder, in PowerShell):
    .\scripts\run-autopilot.ps1 "Customers need a portal to view invoices and raise disputes..."
    .\scripts\run-autopilot.ps1 -File requirements\invoice-portal.md
    .\scripts\run-autopilot.ps1                  # resume, e.g. after approving in Jira

  Environment variables:
    GITHUB_PAT        GitHub token used by the GitHub MCP server (required)
    PERMISSION_MODE   auto (default) or dontAsk
    MAX_BUDGET_NOTE   free text written to the log (e.g. cost centre)

  Logs are written to .claude\runs\<timestamp>.log (ignored by git).
#>
param(
  [Parameter(Position = 0)][string]$Requirement = "",
  [string]$File = ""
)
$ErrorActionPreference = 'Continue'

$root = git rev-parse --show-toplevel 2>$null
if (-not $root) { Write-Host "[FAIL] Run this inside your project's git repository folder." -ForegroundColor Red; exit 1 }
Set-Location $root

$req = ""
if ($File) {
  if (-not (Test-Path $File)) { Write-Host "[FAIL] File not found: $File" -ForegroundColor Red; exit 1 }
  $req = "the requirement document at " + ($File -replace '\\', '/')
} elseif ($Requirement) {
  $req = $Requirement
}

& (Join-Path $PSScriptRoot 'preflight.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$mode = if ($env:PERMISSION_MODE) { $env:PERMISSION_MODE } else { 'auto' }
$runs = Join-Path '.claude' 'runs'
New-Item -ItemType Directory -Force -Path $runs | Out-Null
$log = Join-Path $runs ((Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$note = if ($env:MAX_BUDGET_NOTE) { $env:MAX_BUDGET_NOTE } else { 'none' }

Write-Host "Autopilot starting (permission mode: $mode) - log: $log"
"note: $note" | Tee-Object -FilePath $log -Append | Out-Host

$prompt = ("/autopilot " + $req).Trim()
& claude -p --agent orchestrator --permission-mode $mode $prompt 2>&1 |
  ForEach-Object { "$_" } |
  Tee-Object -FilePath $log -Append
$code = $LASTEXITCODE

Write-Host "Autopilot run finished. Check the Jira project ticket and the GitHub pull requests for results."
exit $code
