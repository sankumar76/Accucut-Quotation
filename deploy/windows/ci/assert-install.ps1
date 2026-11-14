<#
.SYNOPSIS
  CI only (stage 13): checks a finished install against the acceptance criteria of STORY-10.04. Throws at the first thing that is wrong.
  Not part of the release package, and never run on a server. Reads the secrets to look for from the values file and the settings files,
  so none of them is on a command line.
.PARAMETER Root
  The install folder. Default C:\Accucut.
.PARAMETER Port
  The web app's port. Default 3000.
.PARAMETER ValuesFile
  The values file the install was run with.
.PARAMETER ExpectedRelease
  The tag the `current` junction must point at.
#>
[CmdletBinding()]
param(
    [string]$Root = 'C:\Accucut',
    [int]$Port = 3000,
    [Parameter(Mandatory)][string]$ValuesFile,
    [Parameter(Mandatory)][string]$ExpectedRelease
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
$services = Get-AccucutServiceNames

# AC-1, AC-2: both services run, as their own virtual accounts, Automatic (Delayed Start), after PostgreSQL, restarting after 10, 30 and 60 seconds.
foreach ($name in $services) {
    $service = Get-Service -Name $name
    Assert-That ($service.Status -eq 'Running') "$name is Running"
    $cim = Get-CimInstance -ClassName Win32_Service -Filter "Name='$name'"
    Assert-That ($cim.StartName -ieq "NT SERVICE\$name") "$name runs as NT SERVICE\$name, not LocalSystem (found '$($cim.StartName)')"
    Assert-That ($cim.StartMode -eq 'Auto' -and [bool]$cim.DelayedAutoStart) "$name starts Automatic (Delayed Start)"
    $config = & "$env:SystemRoot\System32\sc.exe" qc $name | Out-String
    Assert-That ($config -match 'postgresql-x64-17') "$name depends on postgresql-x64-17"
    $failure = & "$env:SystemRoot\System32\sc.exe" qfailure $name | Out-String
    Assert-That ($failure -match 'Delay = 10000' -and $failure -match 'Delay = 30000' -and $failure -match 'Delay = 60000') "$name restarts after 10 s, 30 s and 60 s"
}

# The portal answers.
$health = Get-AccucutHttpStatus -Url "http://127.0.0.1:$Port/api/health"
Assert-That ($health -eq 200) "/api/health answers 200 (got $health)"
$signIn = Get-AccucutHttpStatus -Url "http://127.0.0.1:$Port/sign-in"
Assert-That ($signIn -eq 200) "the sign-in page answers 200 (got $signIn)"
$body = (Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing).Content
Assert-That ($body -match '"status"\s*:\s*"ok"' -and $body.Length -lt 64) 'the health check says ok and nothing else'

# The release.
$current = Get-AccucutCurrentRelease -Paths $paths
Assert-That ($current -eq $ExpectedRelease) "current points at release $ExpectedRelease (found '$current')"

# AC-1, AC-5: who can read what.
function Get-AclSids {
    # By SID: the name NT SERVICE\<name> is not always resolvable, the SID always is.
    param([string]$Path)
    $security = Get-Item -LiteralPath $Path -Force | ForEach-Object { $_.GetAccessControl() }
    $rules = $security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
    return [pscustomobject]@{
        Protected = $security.AreAccessRulesProtected
        Owner     = $security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
        Sids      = @($rules | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique)
    }
}
$adminSid = 'S-1-5-32-544'
$appSid = Get-AccucutServiceSid -Name 'AccucutApp'
$workerSid = Get-AccucutServiceSid -Name 'AccucutWorker'
$envAcl = Get-AclSids -Path $paths.EnvFile
Assert-That $envAcl.Protected '.env does not inherit permissions'
$expectedEnv = @($adminSid, $appSid, $workerSid) | Sort-Object
Assert-That (($envAcl.Sids -join ';') -eq ($expectedEnv -join ';')) ".env can be read by Administrators and the two service accounts only (found: $($envAcl.Sids -join ', '))"
$migrateAcl = Get-AclSids -Path $paths.MigrateEnvFile
Assert-That ($migrateAcl.Protected -and (($migrateAcl.Sids -join ';') -eq $adminSid)) "migrate.env can be read by Administrators only (found: $($migrateAcl.Sids -join ', '))"
$rootAcl = Get-AclSids -Path $paths.Root
Assert-That ($rootAcl.Protected -and ($rootAcl.Owner -eq $adminSid)) 'the install folder is owned by Administrators and does not inherit permissions'
$unexpectedRoot = @($rootAcl.Sids | Where-Object { @($adminSid, 'S-1-5-18', $appSid, $workerSid) -notcontains $_ })
Assert-That ($unexpectedRoot.Count -eq 0) "the install folder is closed to ordinary users (found: $($rootAcl.Sids -join ', '))"
foreach ($folder in $paths.Releases, $paths.Config, $paths.Services, $paths.Logs) {
    $folderAcl = Get-AclSids -Path $folder
    Assert-That ($folderAcl.Owner -eq $adminSid) "$folder is owned by Administrators"
}
Assert-AccucutInstallTrusted -Paths $paths
Write-Host 'PASS  every folder that update.ps1 writes to is trusted (owner and permissions)'

# The settings: the runtime file holds no owner role and no first-Admin password; the owner file holds no first-Admin password once it was used.
$runtime = Read-AccucutEnvFile -Path $paths.EnvFile
$migrate = Read-AccucutEnvFile -Path $paths.MigrateEnvFile
Assert-That (-not $runtime.Contains('MIGRATE_DATABASE_URL') -and -not $runtime.Contains('ADMIN_INITIAL_PASSWORD')) 'the services never see the owner role or the first Admin password'
Assert-That ($migrate.Contains('MIGRATE_DATABASE_URL') -and -not $migrate.Contains('ADMIN_INITIAL_PASSWORD')) 'the first Admin password was removed after its one use'

# AC-5: no secret in any log.
$secrets = New-Object System.Collections.Generic.List[string]
$values = Read-AccucutValuesFile -Path $ValuesFile
foreach ($name in 'ADMIN_INITIAL_PASSWORD', 'PG_SUPERUSER_PASSWORD') { if ($values.Contains($name)) { $secrets.Add([string]$values[$name]) } }
foreach ($table in $runtime, $migrate) {
    foreach ($name in 'DATABASE_URL', 'MIGRATE_DATABASE_URL') {
        if ($table.Contains($name) -and ([string]$table[$name] -match '://[^:]+:([^@]+)@')) { $secrets.Add($Matches[1]) }
    }
}
if ($runtime.Contains('AUTH_SECRET')) { $secrets.Add([string]$runtime['AUTH_SECRET']) }
Assert-That ($secrets.Count -ge 5) 'five secrets were found to look for'
$logFiles = @(Get-ChildItem -LiteralPath $paths.Logs -File -Force)
Assert-That ($logFiles.Count -gt 0) "logs exist under $($paths.Logs): $((($logFiles | ForEach-Object { $_.Name }) -join ', '))"
foreach ($file in $logFiles) {
    $text = Get-Content -LiteralPath $file.FullName -Raw
    if ([string]::IsNullOrEmpty($text)) { continue }
    foreach ($secret in $secrets) {
        if ($text.Contains($secret)) { throw "ASSERTION FAILED: a secret value is in the log '$($file.Name)'." }
    }
}
Write-Host "PASS  no secret is in any of the $($logFiles.Count) log files"
$state = Get-Content -LiteralPath $paths.StateFile -Raw
foreach ($secret in $secrets) { if ($state.Contains($secret)) { throw 'ASSERTION FAILED: a secret value is in install-state.json.' } }
Write-Host 'PASS  no secret is in install-state.json'

# AC-6, AC-7 and the helpers around them.
Assert-That ($null -ne (Get-ScheduledTask -TaskName 'Accucut log cleanup' -ErrorAction SilentlyContinue)) 'the log cleanup task is registered'
$info = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
if ($null -ne (Get-Command -Name Get-MpPreference -ErrorAction SilentlyContinue)) {
    $excluded = @((Get-MpPreference).ExclusionPath)
    Assert-That ($excluded -contains [string]$info.pgDataDirectory) "the PostgreSQL data folder '$($info.pgDataDirectory)' is excluded from Defender real-time scanning"
}
else {
    Write-Host 'SKIP  Defender commands are not available on this machine'
}
Write-Host 'All install assertions passed.'
