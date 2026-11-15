<#
.SYNOPSIS
  CI only (stage 13), on failure: shows why the backup role could not sign in to PostgreSQL. Prints no password: only shapes (lengths, field values other than the password, a yes or no).
  Not part of the release package, and never run on a server.
.PARAMETER ValuesFile
  The values file the install was run with (for the PostgreSQL administrator's password).
#>
[CmdletBinding()]
param(
    [string]$Root = 'C:\Accucut',
    [Parameter(Mandatory)][string]$ValuesFile
)

$ErrorActionPreference = 'Continue'
Import-Module (Join-Path $PSScriptRoot '..\AccucutOps.psm1') -Force -DisableNameChecking

$paths = Get-AccucutPaths -Root $Root
$state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
$psql = Join-Path ([string]$state.pgBinDirectory) 'psql.exe'
$superuserPassword = [string](Read-AccucutValuesFile -Path $ValuesFile)['PG_SUPERUSER_PASSWORD']

function Invoke-Psql {
    param([Parameter(Mandatory)][string]$User, [string]$Password = '', [string]$PassFile, [Parameter(Mandatory)][string]$Sql)
    if ($Password) { $env:PGPASSWORD = $Password } else { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
    if ($PassFile) { $env:PGPASSFILE = $PassFile } else { Remove-Item Env:\PGPASSFILE -ErrorAction SilentlyContinue }
    try { return (& $psql --no-psqlrc -w --tuples-only --no-align --quiet --host 127.0.0.1 --port ([string]$state.pgPort) --username $User --dbname accucut --command $Sql 2>&1 | Out-String).Trim() }
    finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue; Remove-Item Env:\PGPASSFILE -ErrorAction SilentlyContinue }
}

Write-Host '--- PostgreSQL client variables set in this process or on the machine (names only, never values)'
$names = @(Get-ChildItem Env: | Where-Object { $_.Name -like 'PG*' } | ForEach-Object { 'process:' + $_.Name })
foreach ($scope in 'Machine', 'User') { $names += @([System.Environment]::GetEnvironmentVariables($scope).Keys | Where-Object { $_ -like 'PG*' } | ForEach-Object { "$($scope.ToLower()):$_" }) }
Write-Host ($(if ($names.Count) { $names -join ', ' } else { 'none' }))

Write-Host '--- the role, as the administrator sees it'
Write-Host (Invoke-Psql -User postgres -Password $superuserPassword -Sql "SELECT rolname, rolcanlogin, rolpassword IS NOT NULL AS has_password, left(rolpassword, 14) AS kind FROM pg_authid WHERE rolname = 'accucut_backup'")

Write-Host '--- the shape of backup.pgpass (the password is never printed)'
$file = $paths.BackupPgpass
$bytes = [System.IO.File]::ReadAllBytes($file)
Write-Host "bytes=$($bytes.Length) first3=$(($bytes[0..2] | ForEach-Object { '{0:X2}' -f $_ }) -join ' ') cr=$(@($bytes | Where-Object { $_ -eq 13 }).Count) lf=$(@($bytes | Where-Object { $_ -eq 10 }).Count) zeros=$(@($bytes | Where-Object { $_ -eq 0 }).Count)"
$text = [System.Text.Encoding]::UTF8.GetString($bytes).TrimEnd("`r", "`n")
$fields = $text -split '(?<!\\):', 5
Write-Host "fields=$($fields.Count) host=$($fields[0]) port=$($fields[1]) database=$($fields[2]) user=$($fields[3]) passwordLength=$(if ($fields.Count -ge 5) { $fields[4].Length } else { 'none' }) passwordIsLettersAndDigits=$(if ($fields.Count -ge 5) { $fields[4] -match '^[A-Za-z0-9]+$' } else { 'none' })"

if ($fields.Count -ge 5) {
    Write-Host '--- sign in as accucut_backup with the password from the file (PGPASSWORD, run by the administrator)'
    Write-Host (Invoke-Psql -User 'accucut_backup' -Password $fields[4] -Sql 'SELECT current_user')
    Write-Host '--- sign in as accucut_backup through the file (PGPASSFILE, run by the administrator)'
    Write-Host (Invoke-Psql -User 'accucut_backup' -PassFile $file -Sql 'SELECT current_user')
}
$global:LASTEXITCODE = 0
