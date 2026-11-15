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
.PARAMETER AgeKeyFile
  The file with the PRIVATE age key that stage 13 made for this run (its public half was given to the install as BACKUP_AGE_RECIPIENT). Used to decrypt the
  install's own backup and restore it into a scratch database. It is a throwaway key made in the job, never a real one.
#>
[CmdletBinding()]
param(
    [string]$Root = 'C:\Accucut',
    [int]$Port = 3000,
    [Parameter(Mandatory)][string]$ValuesFile,
    [Parameter(Mandatory)][string]$ExpectedRelease,
    [Parameter(Mandatory)][string]$AgeKeyFile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
# The trust block of update.ps1 (byte for byte the one in install.ps1), to check the REAL install with the REAL rules. Dot-sourcing binds the parameters of
# update.ps1 too, which would put $Root back to its default, so it is restored.
$requestedRoot = $Root
. (Join-Path $PSScriptRoot '..\update.ps1')
$Root = $requestedRoot
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
foreach ($folder in $paths.Releases, $paths.Config, $paths.Services, $paths.Logs) {
    $folderAcl = Get-AclSids -Path $folder
    Assert-That ($folderAcl.Owner -eq $adminSid) "$folder is owned by Administrators"
}

# ADR-015 Amendment 2.1: EXACTLY these entries, each as SID, access mask, inherited, inheritance flags (1 container + 2 object = 3).
function Get-AceList {
    param([string]$Path)
    $security = Get-Item -LiteralPath $Path -Force | ForEach-Object { $_.GetAccessControl() }
    $rules = $security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
    return @($rules | ForEach-Object { '{0}|0x{1:X}|{2}|{3}|{4}' -f $_.IdentityReference.Value, [int]$_.FileSystemRights, $_.IsInherited, [int]$_.InheritanceFlags, $_.AccessControlType } | Sort-Object)
}
$systemSid = 'S-1-5-18'
# The backup account (ADR-015 Amendment 3): the fifth entry of the root is read and execute for it.
$backupUser = Get-LocalUser -Name 'AccucutBackup' -ErrorAction SilentlyContinue
Assert-That ($null -ne $backupUser) 'the local user AccucutBackup exists'
$backupSid = $backupUser.SID.Value
$rootExpected = @(
    "$adminSid|0x1F01FF|False|3|Allow", "$systemSid|0x1F01FF|False|3|Allow", "$appSid|0x1200A9|False|3|Allow", "$workerSid|0x1200A9|False|3|Allow", "$backupSid|0x1200A9|False|3|Allow"
) | Sort-Object
$rootActual = Get-AceList -Path $paths.Root
Assert-That (($rootActual -join "`n") -eq ($rootExpected -join "`n")) "the install folder holds exactly five entries: Administrators and SYSTEM full control, and the two service accounts and AccucutBackup read and execute (found: $($rootActual -join '; '))"
$logsExpected = @(
    "$adminSid|0x1F01FF|True|3|Allow", "$systemSid|0x1F01FF|True|3|Allow", "$appSid|0x1200A9|True|3|Allow", "$workerSid|0x1200A9|True|3|Allow", "$backupSid|0x1200A9|True|3|Allow",
    "$appSid|0x1301BF|False|3|Allow", "$workerSid|0x1301BF|False|3|Allow"
) | Sort-Object
$logsActual = Get-AceList -Path $paths.Logs
Assert-That (($logsActual -join "`n") -eq ($logsExpected -join "`n")) "the logs folder holds exactly those five inherited entries plus Modify for the two service accounts (found: $($logsActual -join '; '))"
$bannedSids = @('S-1-5-19', 'S-1-5-20', 'S-1-5-11', 'S-1-5-32-545', 'S-1-1-0')
$currentRelease = Get-AccucutCurrentRelease -Paths $paths
$checkedFolders = @($paths.Root, $paths.Releases, (Join-Path $paths.Releases $currentRelease), $paths.Config, $paths.Services, $paths.Logs, $paths.Backups)
foreach ($folder in $checkedFolders) {
    $present = (Get-AclSids -Path $folder).Sids | Where-Object { $bannedSids -contains $_ }
    Assert-That (@($present).Count -eq 0) "$folder grants nothing to LOCAL SERVICE, NETWORK SERVICE, Authenticated Users, Users or Everyone (found: $(@($present) -join ', '))"
}

# ADR-015 Amendment 2: the real trust rules, on the real install. Every folder and file that update.ps1 loads, runs or writes to must pass (owner,
# no link, no write for any other account), and so must the programs that the services run.
function Assert-Trusted {
    param([Parameter(Mandatory)][scriptblock]$Check, [Parameter(Mandatory)][string]$Message)
    try { & $Check } catch { throw "ASSERTION FAILED: $Message ($($_.Exception.Message))" }
    Write-Host "PASS  $Message"
}
$release = Get-AccucutTrustedCurrent -Root $paths.Root
$logWriters = @($services | ForEach-Object { Get-AccucutUpdateServiceSid -Name $_ })
Assert-Trusted { Assert-AccucutTrustedPath -Path $paths.Root -Root $paths.Root -ProtectedRoot } 'the install folder passes the trust check (owner, protected list, no other writer)'
Assert-Trusted { Assert-AccucutTrustedPath -Path $release -Root $paths.Root -ProtectedRoot } 'the current release folder passes the trust check'
Assert-Trusted { Assert-AccucutTrustedPath -Path (Join-Path $release 'AccucutOps.psm1') -Root $paths.Root -ProtectedRoot } 'the module passes the trust check'
Assert-Trusted { Assert-AccucutTrustedPath -Path (Join-Path $release 'update.ps1') -Root $paths.Root -ProtectedRoot } 'update.ps1 passes the trust check'
foreach ($folder in $paths.Config, $paths.Services) {
    Assert-Trusted { Assert-AccucutTrustedPath -Path $folder -Root $paths.Root -ProtectedRoot } "$folder passes the trust check"
}
Assert-Trusted { Assert-AccucutTrustedPath -Path $paths.Logs -Root $paths.Root -ProtectedRoot -Writer $logWriters } "$($paths.Logs) passes the trust check (the two service accounts may write there, nobody else)"
Assert-Trusted { Assert-AccucutTrustedNoLinks -Path $release } 'the current release holds no link'
foreach ($name in $services) {
    Assert-Trusted { [void](Resolve-AccucutTrustedExecutable -Path (Join-Path $paths.Services "$name.exe")) } "the WinSW program of $name passes the trust check"
}
$installedState = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
Assert-Trusted { [void](Resolve-AccucutTrustedExecutable -Path ([string]$installedState.nodeExe)) } "node.exe ($($installedState.nodeExe)) and its folder pass the trust check"
# The install folder holds nothing but what the install makes, and the scratch folder of the unpacking is empty.
$unexpected = @(Get-ChildItem -LiteralPath $paths.Root -Force | Where-Object { @('releases', 'current', 'config', 'services', 'logs', 'backups', '.in') -notcontains $_.Name } | ForEach-Object { $_.Name })
Assert-That ($unexpected.Count -eq 0) "the install folder holds only what the install makes (unexpected: $($unexpected -join ', '))"
$scratch = Join-Path $paths.Root '.in'
Assert-That ((-not (Test-Path -LiteralPath $scratch)) -or @(Get-ChildItem -LiteralPath $scratch -Force).Count -eq 0) 'the scratch folder .in is empty'

# ADR-015 Amendment 3: the backups folder and the two files of the backup account. Each is protected, owned by Administrators, with EXACTLY these entries.
$backupFolder = Get-AclSids -Path $paths.Backups
Assert-That ($backupFolder.Protected -and $backupFolder.Owner -eq $adminSid) 'the backups folder is protected (no inheritance) and owned by Administrators'
$backupsExpected = @("$adminSid|0x1F01FF|False|3|Allow", "$systemSid|0x1F01FF|False|3|Allow", "$backupSid|0x1301BF|False|3|Allow") | Sort-Object
$backupsActual = Get-AceList -Path $paths.Backups
Assert-That (($backupsActual -join "`n") -eq ($backupsExpected -join "`n")) "the backups folder holds exactly: Administrators and SYSTEM full control and AccucutBackup Modify, and no entry for the services (found: $($backupsActual -join '; '))"
foreach ($file in $paths.BackupPgpass, $paths.BackupSettings) {
    $fileAcl = Get-AclSids -Path $file
    Assert-That ($fileAcl.Protected -and $fileAcl.Owner -eq $adminSid) "$file is protected and owned by Administrators"
    $expectedFile = @("$adminSid|0x1F01FF|False|0|Allow", "$systemSid|0x1F01FF|False|0|Allow", "$backupSid|0x120089|False|0|Allow") | Sort-Object
    $actualFile = Get-AceList -Path $file
    Assert-That (($actualFile -join "`n") -eq ($expectedFile -join "`n")) "$file holds exactly: Administrators and SYSTEM full control and AccucutBackup read (found: $($actualFile -join '; '))"
}
foreach ($file in $paths.EnvFile, $paths.MigrateEnvFile) {
    Assert-That ((Get-AclSids -Path $file).Sids -notcontains $backupSid) "$file does not name AccucutBackup"
}
$anywhere = @(Get-ChildItem -LiteralPath $paths.Root -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike (Join-Path $paths.Releases '*') -and $_.FullName -notlike (Join-Path $paths.Current '*') -and $_.FullName -notlike (Join-Path $paths.Root '.in*') } | ForEach-Object {
        $rules = $_.GetAccessControl().GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
        foreach ($rule in $rules) { if ($bannedSids -contains $rule.IdentityReference.Value) { "$($_.FullName) -> $($rule.IdentityReference.Value)" } }
    })
Assert-That ($anywhere.Count -eq 0) "no entry for LOCAL SERVICE, NETWORK SERVICE, Authenticated Users, Users or Everyone anywhere in config, services, logs or backups (found: $($anywhere -join '; '))"

# The account: enabled, password never expires, may not change it, an explicit member of no local group.
Assert-That ($backupUser.Enabled) 'AccucutBackup is enabled'
Assert-That ($null -eq $backupUser.PasswordExpires) 'the password of AccucutBackup never expires'
Assert-That (-not $backupUser.UserMayChangePassword) 'AccucutBackup may not change its password'
$memberOf = @()
foreach ($group in Get-LocalGroup) {
    try { if (@(Get-LocalGroupMember -Group $group.Name -ErrorAction Stop | Where-Object { $_.SID.Value -eq $backupSid }).Count -gt 0) { $memberOf += $group.Name } } catch { Write-Host "note: the members of '$($group.Name)' could not be listed ($($_.Exception.Message))" }
}
Assert-That ($memberOf.Count -eq 0) "AccucutBackup is an explicit member of no local group (found: $($memberOf -join ', '))"

# The task: its principal, logon type, trigger and action, exactly.
$task = Get-ScheduledTask -TaskName 'Accucut weekly backup' -ErrorAction SilentlyContinue
Assert-That ($null -ne $task) "the task 'Accucut weekly backup' exists"
Assert-That ($task.Principal.UserId -like '*\AccucutBackup' -and [string]$task.Principal.LogonType -eq 'Password' -and [string]$task.Principal.RunLevel -eq 'Limited') "the task runs as AccucutBackup with a stored password and the limited run level (found: $($task.Principal.UserId), $($task.Principal.LogonType), $($task.Principal.RunLevel))"
Assert-That (@($task.Triggers).Count -eq 1 -and $task.Triggers[0].CimClass.CimClassName -eq 'MSFT_TaskWeeklyTrigger' -and [int]$task.Triggers[0].DaysOfWeek -eq 1 -and [int]$task.Triggers[0].WeeksInterval -eq 1 -and [string]$task.Triggers[0].StartBoundary -match 'T02:00:00') 'the task has one weekly trigger, on Sunday at 02:00'
$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$expectedArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + (Join-Path $paths.Current 'backup.ps1') + '" -Reason weekly'
Assert-That (@($task.Actions).Count -eq 1 -and $task.Actions[0].Execute -ieq $powershellExe -and $task.Actions[0].Arguments -ceq $expectedArguments) "the task has one action: $powershellExe $expectedArguments"

# The install's own run of the task: result 0, a copy with its manifest, a job_runs row, and the copy decrypts with this run's key and restores.
$taskInfo = Get-ScheduledTaskInfo -TaskName 'Accucut weekly backup'
Assert-That ([uint32]$taskInfo.LastTaskResult -eq 0) "the install's run of the weekly task ended with result 0 (found 0x$('{0:X8}' -f [uint32]$taskInfo.LastTaskResult))"
$copies = @(Get-AccucutBackupCopy -Directory $paths.Backups)
Assert-That ($copies.Count -ge 1 -and @($copies | Where-Object { -not $_.Verified }).Count -eq 0) "the backups folder holds at least one copy, and each has a manifest that agrees with it (found $($copies.Count))"
$first = @($copies | Where-Object { $_.Reason -eq 'weekly' })[0]
Assert-That ($first.Reason -eq 'weekly' -and $first.Name -match '^accucut-\d{8}-\d{6}-weekly\.age$') "the first copy is named $($first.Name)"
$manifest = Get-Content -LiteralPath $first.ManifestPath -Raw | ConvertFrom-Json
Assert-That ($manifest.sha256 -eq (Get-AccucutFileSha256 -Path $first.Path) -and [int64]$manifest.sizeBytes -eq $first.SizeBytes -and $manifest.reason -eq 'weekly' -and [string]$manifest.postgresVersion -match '^17') 'the manifest holds the SHA-256, size, reason and PostgreSQL version of the copy'
$pgBin = [string]$installedState.pgBinDirectory
$psqlExe = Join-Path $pgBin 'psql.exe'
$suppliedValues = Read-AccucutValuesFile -Path $ValuesFile
$superuserPassword = [string]$suppliedValues['PG_SUPERUSER_PASSWORD']
function Invoke-SuperPsql {
    param([string]$Database, [string]$Sql)
    $ErrorActionPreference = 'Continue'
    $env:PGPASSWORD = $superuserPassword
    try { $output = & $psqlExe --no-psqlrc --no-password --tuples-only --no-align --quiet --set ON_ERROR_STOP=1 --host 127.0.0.1 --port ([string]$installedState.pgPort) --username postgres --dbname $Database --command $Sql 2>&1 | Out-String } finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $output" }
    return $output.Trim()
}
$okRows = Invoke-SuperPsql -Database 'accucut' -Sql "SELECT count(*) FROM job_runs WHERE job = 'backup' AND result->>'status' = 'ok' AND (result->>'sizeBytes')::bigint > 0 AND (result->>'freeBytes')::bigint > 0 AND (result->>'totalBytes')::bigint > 0"
Assert-That ([int]$okRows -ge 1) "job_runs has a 'backup' row with status ok, sizeBytes, freeBytes and totalBytes (found $okRows)"
# Decrypt with the run's own key and restore into a scratch database (the file is deleted at once; nothing here is a real key).
$ageExe = Join-Path $paths.Current 'bin\age.exe'
$scratchFile = Join-Path $env:RUNNER_TEMP ('accucut-restore-check-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.dump')
$scratchDb = 'accucut_restore_check'
try {
    & $ageExe -d -i $AgeKeyFile -o $scratchFile $first.Path
    Assert-That ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $scratchFile)) 'the first copy decrypts with the key of this run'
    [void](Invoke-SuperPsql -Database 'postgres' -Sql "CREATE DATABASE $scratchDb")
    $env:PGPASSWORD = $superuserPassword
    try { & (Join-Path $pgBin 'pg_restore.exe') --no-password --exit-on-error --no-owner --host 127.0.0.1 --port ([string]$installedState.pgPort) --username postgres --dbname $scratchDb $scratchFile } finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
    Assert-That ($LASTEXITCODE -eq 0) 'the decrypted copy restores into a scratch database'
    $migrations = Invoke-SuperPsql -Database $scratchDb -Sql 'SELECT count(*) FROM _prisma_migrations'
    Assert-That ([int]$migrations -ge 1) "the restored database holds the migration history ($migrations rows)"
}
finally {
    if (Test-Path -LiteralPath $scratchFile) { Remove-Item -LiteralPath $scratchFile -Force }
    try { [void](Invoke-SuperPsql -Database 'postgres' -Sql "DROP DATABASE IF EXISTS $scratchDb WITH (FORCE)") } catch { Write-Host "note: the scratch database could not be dropped: $($_.Exception.Message)" }
}

# The database role, checked as accucut_backup through its own password file: a member of pg_read_all_data; INSERT on job_runs works; UPDATE and DELETE on it,
# INSERT into any other table and CREATE TABLE are refused.
function Invoke-BackupRolePsql {
    param([string]$Sql)
    $ErrorActionPreference = 'Continue'
    $env:PGPASSFILE = $paths.BackupPgpass
    try { $output = & $psqlExe --no-psqlrc --no-password --tuples-only --no-align --quiet --host 127.0.0.1 --port ([string]$installedState.pgPort) --username accucut_backup --dbname accucut --command $Sql 2>&1 | Out-String } finally { Remove-Item Env:\PGPASSFILE -ErrorAction SilentlyContinue }
    return [pscustomobject]@{ Code = $LASTEXITCODE; Output = $output.Trim() }
}
$member = Invoke-BackupRolePsql -Sql "SELECT pg_has_role('accucut_backup', 'pg_read_all_data', 'member')"
Assert-That ($member.Code -eq 0 -and $member.Output -eq 't') 'accucut_backup is a member of pg_read_all_data'
$insert = Invoke-BackupRolePsql -Sql "INSERT INTO job_runs (job, started_at, finished_at, result) VALUES ('ci-role-check', now(), now(), '{}'::jsonb)"
Assert-That ($insert.Code -eq 0) 'accucut_backup can INSERT into job_runs'
[void](Invoke-SuperPsql -Database 'accucut' -Sql "DELETE FROM job_runs WHERE job = 'ci-role-check'")
foreach ($refused in @(
        @{ Sql = "UPDATE job_runs SET job = 'x' WHERE false"; Text = 'UPDATE on job_runs' },
        @{ Sql = "DELETE FROM job_runs WHERE false"; Text = 'DELETE on job_runs' },
        @{ Sql = 'INSERT INTO _prisma_migrations DEFAULT VALUES'; Text = 'INSERT into another table' },
        @{ Sql = 'CREATE TABLE ci_role_probe (a int)'; Text = 'CREATE TABLE' }
    )) {
    $attempt = Invoke-BackupRolePsql -Sql $refused.Sql
    Assert-That ($attempt.Code -ne 0 -and $attempt.Output -match 'permission denied') "accucut_backup is refused $($refused.Text)"
}

# The settings: the runtime file holds no owner role and no first-Admin password; the owner file holds no first-Admin password once it was used.
$runtime = Read-AccucutEnvFile -Path $paths.EnvFile
$migrate = Read-AccucutEnvFile -Path $paths.MigrateEnvFile
Assert-That (-not $runtime.Contains('MIGRATE_DATABASE_URL') -and -not $runtime.Contains('ADMIN_INITIAL_PASSWORD')) 'the services never see the owner role or the first Admin password'
Assert-That ($runtime.Contains('LOG_DIRECTORY') -and ([string]$runtime['LOG_DIRECTORY'] -eq $paths.Logs.Replace('\', '/'))) 'LOG_DIRECTORY in .env is the absolute logs folder (the worker prunes it daily)'
Assert-That ($migrate.Contains('MIGRATE_DATABASE_URL') -and -not $migrate.Contains('ADMIN_INITIAL_PASSWORD')) 'the first Admin password was removed after its one use'

# AC-5: no secret in any log.
$secrets = New-Object System.Collections.Generic.List[string]
$values = Read-AccucutValuesFile -Path $ValuesFile
foreach ($name in 'ADMIN_INITIAL_PASSWORD', 'PG_SUPERUSER_PASSWORD') { if ($values.Contains($name)) { $secrets.Add([string]$values[$name]) } }
# The password of the backup role, from its protected file (the last field of its one line), and the private age key of this run.
$pgpassLine = @(Get-Content -LiteralPath $paths.BackupPgpass)[0]
$backupPassword = ($pgpassLine -split ':', 5)[4]
$secrets.Add($backupPassword)
foreach ($line in Get-Content -LiteralPath $AgeKeyFile) { if ($line -like 'AGE-SECRET-KEY-*') { $secrets.Add($line.Trim()) } }
foreach ($table in $runtime, $migrate) {
    foreach ($name in 'DATABASE_URL', 'MIGRATE_DATABASE_URL') {
        if ($table.Contains($name) -and ([string]$table[$name] -match '://[^:]+:([^@]+)@')) { $secrets.Add($Matches[1]) }
    }
}
if ($runtime.Contains('AUTH_SECRET')) { $secrets.Add([string]$runtime['AUTH_SECRET']) }
Assert-That ($secrets.Count -ge 7) 'seven secrets were found to look for'
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
# ADR-015 Amendment 2.1: the worker says that it scheduled its daily log-prune job (it starts a moment after the app, so give it a few seconds).
$scheduled = $false
for ($attempt = 0; $attempt -lt 15 -and -not $scheduled; $attempt++) {
    foreach ($file in @(Get-ChildItem -LiteralPath $paths.Logs -Filter 'AccucutWorker*.out.log' -File -Force)) {
        $text = Get-Content -LiteralPath $file.FullName -Raw
        if ($text -and $text.Contains('log-prune scheduled daily at 03:30 IST')) { $scheduled = $true }
    }
    if (-not $scheduled) { Start-Sleep -Seconds 2 }
}
Assert-That $scheduled 'the worker scheduled its daily log-prune job (03:30 IST)'
$state = Get-Content -LiteralPath $paths.StateFile -Raw
foreach ($secret in $secrets) { if ($state.Contains($secret)) { throw 'ASSERTION FAILED: a secret value is in install-state.json.' } }
Write-Host 'PASS  no secret is in install-state.json'
# No secret in the backup settings or in any manifest, and no private key anywhere under the install folder.
foreach ($file in @($paths.BackupSettings) + @(Get-ChildItem -LiteralPath $paths.Backups -Filter '*.manifest.json' -File | ForEach-Object { $_.FullName })) {
    $text = Get-Content -LiteralPath $file -Raw
    foreach ($secret in $secrets) { if ($text.Contains($secret)) { throw "ASSERTION FAILED: a secret value is in '$file'." } }
}
Write-Host 'PASS  no secret is in backup-settings.json or in a manifest'
$runtimeEnv = Read-AccucutEnvFile -Path $paths.EnvFile
Assert-That ($runtimeEnv.Contains('BACKUP_VOLUME') -and [string]$runtimeEnv['BACKUP_VOLUME'] -eq ([System.IO.Path]::GetPathRoot($paths.Backups).Replace('\', '/'))) 'BACKUP_VOLUME in .env is the drive root of the backups folder (backup-watch reads its free space)'
Assert-That ($runtimeEnv.Contains('PG_DATA_VOLUME') -and [string]$runtimeEnv['PG_DATA_VOLUME'] -eq ([System.IO.Path]::GetPathRoot([string]$installedState.pgDataDirectory).Replace('\', '/'))) 'PG_DATA_VOLUME in .env is the drive root of the PostgreSQL data folder'

# AC-6, AC-7 and the helpers around them.
Assert-That ($null -eq (Get-ScheduledTask -TaskName 'Accucut log cleanup' -ErrorAction SilentlyContinue)) 'there is no Accucut log cleanup task: the worker prunes the logs itself'
$info = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
if ($null -ne (Get-Command -Name Get-MpPreference -ErrorAction SilentlyContinue)) {
    $excluded = @((Get-MpPreference).ExclusionPath)
    Assert-That ($excluded -contains [string]$info.pgDataDirectory) "the PostgreSQL data folder '$($info.pgDataDirectory)' is excluded from Defender real-time scanning"
}
else {
    Write-Host 'SKIP  Defender commands are not available on this machine'
}
Write-Host 'All install assertions passed.'
