<#
.SYNOPSIS
  CI only (stage 13): exercises the backup scripts on the real install (STORY-10.05 AC-1, AC-3, AC-4, AC-6, AC-7; ADR-015 Amendments 2 and 3). Throws at the first thing
  that is wrong. Not part of the release package, and never run on a server.
.DESCRIPTION
  1. A release backup as an administrator (backup.ps1 -Reason release, the call update.ps1 makes): a copy, its manifest tagged release, a job_runs row.
  2. Four more copies, so that there are more than the 4 that are always kept.
  3. Things that look like copies but are not the backup's own (a copy with no manifest, a file in a sub-folder, a note, a link to a folder that holds a copy) are
     planted. clear-copies.ps1 with a wrong date removes nothing; with the right date it removes the oldest copies, keeps the newest 4, leaves everything that is
     not provably its own, and writes a job_runs row. The answers come in on standard input, as an Admin would type them.
  4. A module that has been replaced (a marker-writing module, and a write permission for the Users group) is never loaded by backup.ps1 or by clear-copies.ps1: each
     exits 1 naming the permission, and the marker is absent. The module and its permissions are put back afterwards.
.PARAMETER Root
  The install folder. Default C:\Accucut.
.PARAMETER ValuesFile
  The values file the install was run with (for the PostgreSQL administrator's password, to read job_runs).
.PARAMETER MarkerFile
  A path in the runner's temp folder where the tampered module would write, if it were ever loaded.
#>
[CmdletBinding()]
param(
    [string]$Root = 'C:\Accucut',
    [Parameter(Mandatory)][string]$ValuesFile,
    [Parameter(Mandatory)][string]$MarkerFile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
Import-Module (Join-Path $PSScriptRoot '..\AccucutOps.psm1') -Force -DisableNameChecking

function Assert-That {
    param([Parameter(Mandatory)][bool]$Condition, [Parameter(Mandatory)][string]$Message)
    if (-not $Condition) { throw "ASSERTION FAILED: $Message" }
    Write-Host "PASS  $Message"
}

$paths = Get-AccucutPaths -Root $Root
$state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
$psqlExe = Join-Path ([string]$state.pgBinDirectory) 'psql.exe'
$superuserPassword = [string](Read-AccucutValuesFile -Path $ValuesFile)['PG_SUPERUSER_PASSWORD']
$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

function Invoke-Sql {
    param([Parameter(Mandatory)][string]$Sql)
    $ErrorActionPreference = 'Continue'
    $env:PGPASSWORD = $superuserPassword
    try { $output = & $psqlExe --no-psqlrc --no-password --tuples-only --no-align --quiet --set ON_ERROR_STOP=1 --host 127.0.0.1 --port ([string]$state.pgPort) --username postgres --dbname accucut --command $Sql 2>&1 | Out-String }
    finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $output" }
    return $output.Trim()
}

function Invoke-Script {
    # Runs one of the release's scripts as a child powershell.exe, as the task, update.ps1 or an Admin would, with the given lines on standard input.
    param([Parameter(Mandatory)][string]$Name, [string[]]$Argument = @(), [string[]]$Answer = @())
    $ErrorActionPreference = 'Continue'
    $script = Join-Path $paths.Current $Name
    if ($Answer.Count -gt 0) { $output = $Answer | & $powershellExe -NoProfile -ExecutionPolicy Bypass -File $script @Argument 2>&1 | Out-String }
    else { $output = & $powershellExe -NoProfile -ExecutionPolicy Bypass -File $script @Argument 2>&1 | Out-String }
    return [pscustomobject]@{ Code = $LASTEXITCODE; Output = $output }
}

function Get-Copies { return @(Get-AccucutBackupCopy -Directory $paths.Backups) }

# ---- 1. A release backup (AC-1, AC-4, AC-7) ---------------------------------------------------------------------------------------------------
$beforeCopies = @(Get-Copies)
$beforeRows = [int](Invoke-Sql -Sql "SELECT count(*) FROM job_runs WHERE job = 'backup' AND result->>'status' = 'ok'")
$run = Invoke-Script -Name 'backup.ps1' -Argument @('-Reason', 'release')
Write-Host $run.Output
Assert-That ($run.Code -eq 0) 'backup.ps1 -Reason release, run by an administrator, exits 0'
$afterCopies = @(Get-Copies)
Assert-That ($afterCopies.Count -eq $beforeCopies.Count + 1) 'one new copy was made'
$release = $afterCopies[$afterCopies.Count - 1]
Assert-That ($release.Reason -eq 'release' -and $release.Verified) "the new copy is tagged release and its manifest agrees with it ($($release.Name))"
$manifest = Get-Content -LiteralPath $release.ManifestPath -Raw | ConvertFrom-Json
Assert-That ($manifest.reason -eq 'release' -and $manifest.sha256 -eq (Get-AccucutFileSha256 -Path $release.Path) -and [string]$manifest.release -ne '') 'the manifest says release, holds the SHA-256 of the copy and names the release'
Assert-That ([int](Invoke-Sql -Sql "SELECT count(*) FROM job_runs WHERE job = 'backup' AND result->>'status' = 'ok'") -eq $beforeRows + 1) 'one more job_runs row with job backup and status ok was written'
Assert-That (@(Get-ChildItem -LiteralPath $paths.Backups -Force -Filter '*.part').Count -eq 0) 'no temporary file is left in the backups folder'
$secret = (@(Get-Content -LiteralPath $paths.BackupPgpass)[0] -split ':', 5)[4]
Assert-That (-not $run.Output.Contains($secret)) 'the password of the backup role is not in the output of the run'

# ---- 2. More copies (the copy names have a resolution of one second) -----------------------------------------------------------------------------
foreach ($i in 1..4) {
    Start-Sleep -Seconds 2
    $more = Invoke-Script -Name 'backup.ps1' -Argument @('-Reason', 'release')
    if ($more.Code -ne 0) { Write-Host $more.Output; throw "the extra backup $i failed" }
}
$all = @(Get-Copies)
Assert-That ($all.Count -eq $beforeCopies.Count + 5) "there are now $($all.Count) copies"

# ---- 3. clear-copies.ps1 (AC-6) ---------------------------------------------------------------------------------------------------------------
# Planted things that are NOT the backup's own: a copy-shaped file with no manifest (older than all, so it is not one of the newest 4), a note, a file in a
# sub-folder with a perfect name, and a link to a folder that holds a perfect copy. None may be touched.
$planted = Join-Path $paths.Backups 'accucut-20200101-000000-weekly.age'
[System.IO.File]::WriteAllBytes($planted, [byte[]](1..64))
$note = Join-Path $paths.Backups 'notes.txt'
[System.IO.File]::WriteAllText($note, 'not a copy')
$sub = Join-Path $paths.Backups 'sub'
New-Item -ItemType Directory -Path $sub | Out-Null
$deep = Join-Path $sub $release.Name
Copy-Item -LiteralPath $release.Path -Destination $deep
Copy-Item -LiteralPath $release.ManifestPath -Destination (Join-Path $sub (Split-Path -Leaf $release.ManifestPath))
$outside = Join-Path $env:RUNNER_TEMP ('accucut-link-target-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $outside | Out-Null
Copy-Item -LiteralPath $release.Path -Destination (Join-Path $outside $release.Name)
Copy-Item -LiteralPath $release.ManifestPath -Destination (Join-Path $outside (Split-Path -Leaf $release.ManifestPath))
$link = Join-Path $paths.Backups 'linked'
cmd.exe /c mklink /J "$link" "$outside" | Out-Null
try {
    $verifiedBefore = @(Get-Copies | Where-Object { $_.Verified })
    $newest4 = @($verifiedBefore | Sort-Object -Property CreatedUtc, Name | Select-Object -Last 4 | ForEach-Object { $_.Name })
    # The date of the newest copy that may be removed (not one of the newest 4), as an Admin would type it from the list.
    $removable = @($verifiedBefore | Sort-Object -Property CreatedUtc, Name | Select-Object -First ($verifiedBefore.Count - 4))
    $today = $removable[$removable.Count - 1].CreatedUtc.ToString('yyyy-MM-dd')

    $wrong = Invoke-Script -Name 'clear-copies.ps1' -Answer @('1999-01-01')
    Write-Host $wrong.Output
    Assert-That ($wrong.Code -eq 0 -and $wrong.Output -match 'nothing was removed') 'a date that is not the date of a removable copy removes nothing'
    $notDate = Invoke-Script -Name 'clear-copies.ps1' -Answer @('yesterday')
    Assert-That ($notDate.Code -eq 0 -and $notDate.Output -match 'nothing was removed') 'text that is not a date removes nothing'
    $declined = Invoke-Script -Name 'clear-copies.ps1' -Answer @($today, 'no')
    Assert-That ($declined.Code -eq 0 -and $declined.Output -match 'Nothing was removed') 'the right date without YES removes nothing'
    Assert-That (@(Get-Copies | Where-Object { $_.Verified }).Count -eq $verifiedBefore.Count) 'no copy was removed by the three refused attempts'

    $beforeClearRows = [int](Invoke-Sql -Sql "SELECT count(*) FROM job_runs WHERE job = 'backup-clear'")
    $clear = Invoke-Script -Name 'clear-copies.ps1' -Answer @($today, 'YES')
    Write-Host $clear.Output
    Assert-That ($clear.Code -eq 0) 'clear-copies.ps1 with the right date and YES exits 0'
    $remaining = @(Get-Copies | Where-Object { $_.Verified })
    Assert-That ($remaining.Count -eq 4 -and (($remaining | ForEach-Object { $_.Name } | Sort-Object) -join ';') -eq (($newest4 | Sort-Object) -join ';')) 'exactly the newest 4 copies are left, and they are the newest 4'
    Assert-That ($clear.Output -match 'frees about' -and $clear.Output -match 'KEEP') 'the confirmation shows how much space is freed, and the list marks the copies that are kept'
    Assert-That ((Test-Path -LiteralPath $planted) -and (Test-Path -LiteralPath $note) -and (Test-Path -LiteralPath $deep) -and (Test-Path -LiteralPath (Join-Path $outside $release.Name))) 'a copy with no manifest, a note, a file in a sub-folder and a file behind a link were all left alone'
    Assert-That ([int](Invoke-Sql -Sql "SELECT count(*) FROM job_runs WHERE job = 'backup-clear' AND result->>'status' = 'ok'") -eq $beforeClearRows + 1) 'one job_runs row with job backup-clear was written'
}
finally {
    # Remove the planted things (the junction first, without following it).
    if (Test-Path -LiteralPath $link) { cmd.exe /c rmdir "$link" | Out-Null }
    foreach ($item in $planted, $note) { if (Test-Path -LiteralPath $item) { Remove-Item -LiteralPath $item -Force } }
    if (Test-Path -LiteralPath $sub) { Remove-Item -LiteralPath $sub -Recurse -Force }
    if (Test-Path -LiteralPath $outside) { Remove-Item -LiteralPath $outside -Recurse -Force }
}

# ---- 4. A replaced module is never loaded (ADR-015 Amendment 2, test 5; Amendment 3) ----------------------------------------------------------------
$releaseFolder = Get-AccucutCurrentRelease -Paths $paths
$module = Join-Path (Join-Path $paths.Releases $releaseFolder) 'AccucutOps.psm1'
$originalBytes = [System.IO.File]::ReadAllBytes($module)
$originalHash = Get-AccucutFileSha256 -Path $module
$originalSddl = (Get-Acl -LiteralPath $module).Sddl
if (Test-Path -LiteralPath $MarkerFile) { Remove-Item -LiteralPath $MarkerFile -Force }
$tampered = "[System.IO.File]::WriteAllText('$MarkerFile', 'the tampered module was loaded')`r`nthrow 'the tampered module was loaded'`r`n"
try {
    & "$env:SystemRoot\System32\icacls.exe" $module /grant '*S-1-5-32-545:(W)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not add the test permission.' }
    [System.IO.File]::WriteAllText($module, $tampered)
    foreach ($case in @(@{ Name = 'backup.ps1'; Argument = @('-Reason', 'release'); Answer = @() }, @{ Name = 'clear-copies.ps1'; Argument = @(); Answer = @('1999-01-01') })) {
        $attempt = Invoke-Script -Name $case.Name -Argument $case.Argument -Answer $case.Answer
        Write-Host $attempt.Output
        Assert-That ($attempt.Code -eq 1) "$($case.Name) exits with code 1 when the module can be changed by the Users group"
        Assert-That ($attempt.Output -match 'can be changed by S-1-5-32-545') "$($case.Name) names the Users group as the reason"
        Assert-That (-not (Test-Path -LiteralPath $MarkerFile)) "the tampered module was never loaded by $($case.Name) (no marker file)"
    }
}
finally {
    [System.IO.File]::WriteAllBytes($module, $originalBytes)
    & "$env:SystemRoot\System32\icacls.exe" $module /remove:g '*S-1-5-32-545' | Out-Null
}
Assert-That ((Get-AccucutFileSha256 -Path $module) -eq $originalHash) 'the module was put back byte for byte'
Assert-That ((Get-Acl -LiteralPath $module).Sddl -eq $originalSddl) 'the permissions of the module were put back'
Write-Host 'All backup exercises passed.'
# The last native program may have left a non-zero exit code behind; the assertions above throw on any real failure, so reaching here means success.
$global:LASTEXITCODE = 0
