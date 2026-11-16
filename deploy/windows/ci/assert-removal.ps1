<#
.SYNOPSIS
  CI only (stage 13): removes the backup account the way the README's "Start over" section does, and proves that the policy is exactly as it was before the install
  (STORY-10.05; ADR-015 Amendment 3.2). Throws at the first thing that is wrong. Not part of the release package, and never run on a server.
.DESCRIPTION
  Calls Remove-AccucutBackupAccount (the task, then the right "Log on as a batch job", then the user), then exports the user rights again with secedit (read-only) and
  compares them with the export taken before the install: the batch holders are exactly the earlier ones, every other right is unchanged, the new SID is held by
  no right, and the user and the task are gone.
.PARAMETER RightsBefore
  The secedit /export of the user rights that stage 13 took before the install.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$RightsBefore,
    [string]$Root = 'C:\Accucut'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
Import-Module (Join-Path $PSScriptRoot '..\AccucutOps.psm1') -Force -DisableNameChecking

function Assert-That {
    param([Parameter(Mandatory)][bool]$Condition, [Parameter(Mandatory)][string]$Message)
    if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
    Write-Host "PASS  $Message"
}

function Get-RightMap {
    param([Parameter(Mandatory)][string]$Path)
    $map = @{}
    $inSection = $false
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\[(.+)\]\s*$') { $inSection = ($Matches[1] -eq 'Privilege Rights'); continue }
        if (-not $inSection) { continue }
        if ($line -match '^\s*(Se\w+)\s*=\s*(.*)$') {
            $name = $Matches[1]
            $sids = @()
            foreach ($token in ($Matches[2] -split ',')) {
                $text = $token.Trim()
                if ($text.Length -eq 0) { continue }
                if ($text.StartsWith('*')) { $sids += $text.Substring(1) }
                else {
                    try { $sids += ([System.Security.Principal.NTAccount]$text).Translate([System.Security.Principal.SecurityIdentifier]).Value } catch { $sids += "unresolved:$text" }
                }
            }
            $map[$name] = @($sids | Sort-Object -Unique)
        }
    }
    return $map
}

$backupSid = (Get-LocalUser -Name 'AccucutBackup' -ErrorAction Stop).SID.Value
Assert-That ($null -ne (Get-ScheduledTask -TaskName 'Accucut weekly backup' -ErrorAction SilentlyContinue)) 'the weekly task exists before the removal'

Remove-AccucutBackupAccount

Assert-That ($null -eq (Get-LocalUser -Name 'AccucutBackup' -ErrorAction SilentlyContinue)) 'the user AccucutBackup is gone'
Assert-That ($null -eq (Get-ScheduledTask -TaskName 'Accucut weekly backup' -ErrorAction SilentlyContinue)) 'the weekly task is gone'

$rightsAfterFile = Join-Path $env:RUNNER_TEMP ('rights-removed-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.inf')
& "$env:SystemRoot\System32\secedit.exe" /export /areas USER_RIGHTS /cfg $rightsAfterFile | Out-Null
Assert-That ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $rightsAfterFile)) 'the user rights were exported again (secedit, read-only)'
$before = Get-RightMap -Path $RightsBefore
$after = Get-RightMap -Path $rightsAfterFile
Assert-That ((@($after['SeBatchLogonRight']) -join ';') -eq (@($before['SeBatchLogonRight']) -join ';')) "Log on as a batch job is held by exactly the holders it had before the install (before: $(@($before['SeBatchLogonRight']) -join ', '); now: $(@($after['SeBatchLogonRight']) -join ', '))"
$changed = @(($before.Keys + $after.Keys) | Sort-Object -Unique | Where-Object { (@($before[$_]) -join ';') -ne (@($after[$_]) -join ';') })
Assert-That ($changed.Count -eq 0) "every user right is exactly as it was before the install (changed: $($changed -join ', '))"
$bare = @($after.Keys | Where-Object { @($after[$_]) -contains $backupSid })
Assert-That ($bare.Count -eq 0) "no bare SID of the removed account is left in the policy (found under: $($bare -join ', '))"
Write-Host 'The backup account is removed and the policy is as it was before the install.'
$global:LASTEXITCODE = 0
