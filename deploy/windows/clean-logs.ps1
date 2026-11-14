<#
.SYNOPSIS
  Deletes the service logs older than 30 days (NFR-024). Run daily by the scheduled task "Accucut log cleanup" that install.ps1 registers (as SYSTEM).
.DESCRIPTION
  Self-contained on purpose: .NET calls only, no module import and no dot-sourcing, because the task runs as SYSTEM and code is never loaded before it has
  been checked (ADR-015 Amendment 2). It deletes only plain files named *.log directly in the log folder, never a link, and never follows one.
.PARAMETER LogDirectory
  The log folder. Default C:\Accucut\logs.
.PARAMETER KeepDays
  How many days of logs to keep. Default 30.
#>
[CmdletBinding()]
param(
    [string]$LogDirectory = 'C:\Accucut\logs',
    [ValidateRange(1, 3650)][int]$KeepDays = 30
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$limit = [System.DateTime]::UtcNow.AddDays(-$KeepDays)
$removed = 0
if ([System.IO.Directory]::Exists($LogDirectory)) {
    foreach ($file in [System.IO.Directory]::GetFiles($LogDirectory, '*.log')) {
        $attributes = [System.IO.File]::GetAttributes($file)
        if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
        if (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) { continue }
        if ([System.IO.File]::GetLastWriteTimeUtc($file) -lt $limit) {
            try { [System.IO.File]::Delete($file); $removed++ } catch { Write-Output "Could not delete '$file': $($_.Exception.Message)" }
        }
    }
}
Write-Output "Removed $removed log file(s) older than $KeepDays days from $LogDirectory."
