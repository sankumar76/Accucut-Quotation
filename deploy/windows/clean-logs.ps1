<#
.SYNOPSIS
  Deletes the service logs older than 30 days (NFR-024). Run daily by the scheduled task "Accucut log cleanup" that install.ps1 registers.
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
Import-Module (Join-Path $PSScriptRoot 'AccucutOps.psm1') -Force -DisableNameChecking
$removed = Remove-AccucutOldLogs -Path $LogDirectory -KeepDays $KeepDays
Write-Output "Removed $(@($removed).Count) log file(s) older than $KeepDays days from $LogDirectory."
