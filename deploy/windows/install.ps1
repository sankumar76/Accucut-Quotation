<#
.SYNOPSIS
  Installs the Accucut Quotation Portal on a Windows Server (STORY-10.04; ADR-015; architecture section 9.9).

.DESCRIPTION
  Run once, as an administrator, from the unpacked release zip. Needs Node.js 22 (22.12 or later) and PostgreSQL 17, both installed from
  the vendors' installers. Windows PowerShell 5.1 (built into Windows Server).

  What it does, in this order, and stops at the first problem:
    1.  Checks the SHA-256 of the zip, before anything else. A changed zip is refused and nothing is touched.
    2.  Unblocks the scripts of the package, then checks the Node.js and PostgreSQL versions.
    3.  Refuses to go on if the portal is already installed here (use update.ps1) or the database already exists (it never touches existing data).
    4.  Asks for the few values it cannot invent (or reads them from -ValuesFile), invents the rest, and writes
          C:\Accucut\config\.env         the settings of the app and the worker. Administrators and the two service accounts can read it.
          C:\Accucut\config\migrate.env  the owner database role's connection string and the first Admin. Administrators only.
        The files are locked down BEFORE a value is written into them.
    5.  Creates the database, the two roles (deploy\db\create-roles.psql, the same SQL as the development database), runs the migrations as the
        owner role and creates the first Admin.
    6.  Registers the services AccucutApp and AccucutWorker with WinSW 2.12.0: Automatic (Delayed Start), after PostgreSQL, restart after 10 s,
        30 s and 60 s, each as its own virtual account (NT SERVICE\<name>), never LocalSystem. Logs roll daily under C:\Accucut\logs, 30 days kept.
    7.  Offers to exclude the PostgreSQL data folder from Windows Defender real-time scanning, and says so.
    8.  Starts the services and waits for /api/health to answer 200.

  Secrets: none is ever put on a command line, in a log, or in a committed file. Passwords reach psql and Node through the environment of
  that one child process. The log, C:\Accucut\logs\install-<time>.log, blanks every secret value.

  If a step fails after the database was created by this run, the database and roles that this run created are dropped again (they are new and
  empty), so the install can be run again. Nothing that existed before the run is ever dropped.

.PARAMETER ZipPath
  The release zip you unpacked (required). Its SHA-256 is checked against -Sha256 or the file <zip>.sha256 next to it.
.PARAMETER Sha256
  The expected SHA-256 of the zip, if there is no .sha256 file.
.PARAMETER ValuesFile
  A file of NAME=value lines with the answers (see values.example.txt), for an install with no one present. Delete it afterwards.
.PARAMETER NonInteractive
  Never ask a question. A missing value that cannot be invented is an error.
.PARAMETER Root
  The install folder. Default C:\Accucut.
.PARAMETER Port
  The port of the web app. Default 3000.
.PARAMETER ListenAddress
  The address the app listens on. Default 0.0.0.0, or 127.0.0.1 with -WithProxy.
.PARAMETER WithProxy
  A TLS proxy (Caddy, or IIS that you already run) will stand in front: the app listens on 127.0.0.1 only, and inbound TCP 80 and 443 are opened
  in Windows Firewall. The proxy itself is not installed by this script.
.PARAMETER PgHost
  PostgreSQL's address. Default 127.0.0.1.
.PARAMETER PgPort
  PostgreSQL's port. Default 5432.
.PARAMETER PgSuperuser
  PostgreSQL's administrator role. Default postgres. Its password is asked for, or read from PG_SUPERUSER_PASSWORD in -ValuesFile.
.PARAMETER DefenderExclusion
  Ask (default), Yes or No: whether to exclude the PostgreSQL data folder from Windows Defender real-time scanning. With -NonInteractive, Ask means No.
.PARAMETER HealthTimeoutSeconds
  How long to wait for /api/health. Default 180.
.PARAMETER PackageRoot
  The unpacked package (default: the folder of this script). For tests.
#>
[CmdletBinding()]
param(
    [string]$ZipPath,
    [string]$Sha256,
    [string]$ValuesFile,
    [switch]$NonInteractive,
    [string]$Root = 'C:\Accucut',
    [ValidateRange(1, 65535)][int]$Port = 3000,
    [string]$ListenAddress,
    [switch]$WithProxy,
    [string]$PgHost = '127.0.0.1',
    [ValidateRange(1, 65535)][int]$PgPort = 5432,
    [string]$PgSuperuser = 'postgres',
    [string]$PgBinDirectory,
    [string]$PgDataDirectory,
    [ValidateSet('Ask', 'Yes', 'No')][string]$DefenderExclusion = 'Ask',
    [ValidateRange(10, 1800)][int]$HealthTimeoutSeconds = 180,
    [string]$PackageRoot
)

Set-StrictMode -Version 2.0

$script:ScriptRoot = $PSScriptRoot
$script:DatabaseName = 'accucut'

function Test-InstallerIsAdministrator {
    <# True when this process runs elevated. A function of its own, so that Pester can mock it. #>
    [CmdletBinding()]
    param()

    $principal = New-Object System.Security.Principal.WindowsPrincipal([System.Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Initialize-AccucutPackage {
    <# Checks the zip's SHA-256 (before any change), unblocks the package's scripts and programs, and loads the shared module. #>
    [CmdletBinding()]
    param(
        [string]$ZipPath,
        [string]$Sha256,
        [Parameter(Mandatory)][string]$PackageRoot
    )

    if ([string]::IsNullOrWhiteSpace($ZipPath)) { throw 'Give the release zip: install.ps1 -ZipPath <the zip you unpacked>. Its SHA-256 is checked first.' }
    if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) { throw "The zip '$ZipPath' was not found." }
    $expected = $Sha256
    if ([string]::IsNullOrWhiteSpace($expected)) {
        $checksumFile = "$ZipPath.sha256"
        if (-not (Test-Path -LiteralPath $checksumFile -PathType Leaf)) { throw "No SHA-256 given: pass -Sha256, or keep '$(Split-Path -Leaf $checksumFile)' next to the zip." }
        $first = (Get-Content -LiteralPath $checksumFile -TotalCount 1)
        $expected = ($first.Trim() -split '\s+')[0]
    }
    if ($expected -notmatch '^[0-9A-Fa-f]{64}$') { throw 'The expected SHA-256 is not 64 hexadecimal characters.' }
    $actual = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected.ToLowerInvariant()) {
        throw "The SHA-256 of the zip does not match (expected $($expected.ToLowerInvariant()), the file is $actual). Nothing was changed. Download the release again."
    }
    Write-Host "SHA-256 of $(Split-Path -Leaf $ZipPath) matches."

    # The scripts and the two programs only: Node does not look at the downloaded-file mark, and node_modules holds thousands of files.
    $toUnblock = @(Get-ChildItem -LiteralPath $PackageRoot -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.ps1', '.psm1' })
    $binFolder = Join-Path $PackageRoot 'bin'
    if (Test-Path -LiteralPath $binFolder) { $toUnblock += @(Get-ChildItem -LiteralPath $binFolder -File -ErrorAction SilentlyContinue) }
    foreach ($file in $toUnblock) { Unblock-File -LiteralPath $file.FullName -ErrorAction SilentlyContinue }
    Import-Module (Join-Path $PackageRoot 'AccucutOps.psm1') -Force -DisableNameChecking
}

function Get-AccucutPostgresInstall {
    <# Finds PostgreSQL 17's programs and data folder from its service, unless they are given. Returns BinDirectory and DataDirectory. #>
    [CmdletBinding()]
    param(
        [string]$BinDirectory,
        [string]$DataDirectory
    )

    $serviceName = Get-AccucutPostgresServiceName
    $service = Get-CimInstance -ClassName Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
    if ($null -eq $service) { throw "The PostgreSQL 17 service '$serviceName' was not found. Install PostgreSQL 17 from postgresql.org (the Windows installer), then run this again." }
    $bin = $BinDirectory
    $data = $DataDirectory
    $path = [string]$service.PathName
    if ([string]::IsNullOrWhiteSpace($bin) -and $path -match '^"?([^"]+?)\\pg_ctl\.exe') { $bin = $Matches[1] }
    if ([string]::IsNullOrWhiteSpace($data) -and $path -match '-D\s+"([^"]+)"') { $data = $Matches[1] }
    if ([string]::IsNullOrWhiteSpace($bin) -or -not (Test-Path -LiteralPath (Join-Path $bin 'psql.exe'))) { throw 'psql.exe was not found. Pass -PgBinDirectory (the bin folder of PostgreSQL 17).' }
    return [pscustomobject]@{ BinDirectory = $bin; DataDirectory = $data; ServiceStatus = [string]$service.State }
}

function Invoke-AccucutPsql {
    <#
    Runs psql as the PostgreSQL administrator. The password is in the child's environment (PGPASSWORD) and never on the command line.
    -w: never ask for a password (a prompt would hang an unattended run). -X: ignore any psqlrc. Returns the output of -t -A.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][hashtable]$Connection,
        [Parameter(Mandatory)][string]$Database,
        [string]$Command,
        [string]$File,
        [hashtable]$ExtraEnvironment = @{}
    )

    $environment = @{
        PGHOST            = $Connection.Host
        PGPORT            = [string]$Connection.Port
        PGUSER            = $Connection.User
        PGPASSWORD        = $Connection.Password
        PGCONNECT_TIMEOUT = '15'
    }
    foreach ($key in $ExtraEnvironment.Keys) { $environment[$key] = $ExtraEnvironment[$key] }
    $arguments = @('-X', '-w', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '--dbname', $Database)
    if ($Command) { $arguments += @('--command', $Command) }
    if ($File) { $arguments += @('--file', $File) }
    $result = Invoke-AccucutNative -FilePath $PsqlPath -ArgumentList $arguments -Environment $environment
    return $result.Output.Trim()
}

function Get-AccucutInstallValue {
    <# One setting: from the values file, else by a question (never in -NonInteractive), else the default. A required one that stays empty is an error. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Prompt,
        [Parameter(Mandatory)][System.Collections.IDictionary]$Supplied,
        [string]$Default = '',
        [switch]$Secret,
        [switch]$Required,
        [switch]$NonInteractive
    )

    $value = $null
    if ($Supplied.Contains($Name)) { $value = [string]$Supplied[$Name] }
    if ([string]::IsNullOrEmpty($value) -and -not $NonInteractive) {
        if ($Secret) { $value = Read-AccucutSecretInput -Prompt $Prompt } else { $value = Read-AccucutHostInput -Prompt $Prompt -Default $Default }
    }
    if ([string]::IsNullOrEmpty($value)) { $value = $Default }
    if ($Required -and [string]::IsNullOrEmpty($value)) {
        throw "A value for $Name is needed. Put '$Name=...' in the values file, or run without -NonInteractive to be asked."
    }
    if ($Secret) { Register-AccucutSecret -Value $value }
    return $value
}

function Get-AccucutInstallSettings {
    <#
    Collects every value of the new .env. Values without a default that only a person can know are asked for or read from -ValuesFile.
    The secrets that nobody needs to know (the session secret and the two database passwords) are invented here.
    Returns Values (the .env settings) and PgSuperuserPassword (used by this script only, never written anywhere).
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object[]]$Template,
        [string]$ValuesFile,
        [switch]$NonInteractive,
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][string]$PgHost,
        [Parameter(Mandatory)][int]$PgPort,
        [Parameter(Mandatory)][string]$DatabaseName
    )

    $supplied = [ordered]@{}
    if ($ValuesFile) { $supplied = Read-AccucutValuesFile -Path $ValuesFile }
    $ni = $NonInteractive.IsPresent
    $defaults = @{}
    foreach ($entry in $Template) { $defaults[$entry.Name] = $entry.Default }

    $values = [ordered]@{}
    $ownerPassword = $null
    $appPassword = $null
    if ($supplied.Contains('DB_OWNER_PASSWORD')) { $ownerPassword = [string]$supplied['DB_OWNER_PASSWORD'] }
    if ($supplied.Contains('DB_APP_PASSWORD')) { $appPassword = [string]$supplied['DB_APP_PASSWORD'] }
    if ([string]::IsNullOrEmpty($ownerPassword)) { $ownerPassword = New-AccucutSecret -Length 32 }
    if ([string]::IsNullOrEmpty($appPassword)) { $appPassword = New-AccucutSecret -Length 32 }
    if ($ownerPassword -notmatch '^[A-Za-z0-9]+$' -or $appPassword -notmatch '^[A-Za-z0-9]+$') { throw 'DB_OWNER_PASSWORD and DB_APP_PASSWORD may hold letters and digits only (they go into connection URLs).' }
    Register-AccucutSecret -Value $ownerPassword
    Register-AccucutSecret -Value $appPassword

    $authSecret = ''
    if ($supplied.Contains('AUTH_SECRET')) { $authSecret = [string]$supplied['AUTH_SECRET'] }
    if ([string]::IsNullOrEmpty($authSecret)) { $authSecret = New-AccucutSecret -Length 48 }
    if ($authSecret.Length -lt 32) { throw 'AUTH_SECRET must be at least 32 characters.' }
    Register-AccucutSecret -Value $authSecret

    $hostName = [System.Net.Dns]::GetHostName().ToLowerInvariant()
    $values['APP_ORIGIN'] = Get-AccucutInstallValue -Name 'APP_ORIGIN' -Prompt 'The address people will type to open the portal, for example https://quotes.example.com' -Supplied $supplied -Default "http://${hostName}:$Port" -NonInteractive:$ni
    if ($values['APP_ORIGIN'] -notmatch '^https?://[^/\s?#]+$') { throw 'APP_ORIGIN must look like https://quotes.example.com or http://server:3000: a scheme and a host, no path.' }
    $values['ADMIN_EMAIL'] = Get-AccucutInstallValue -Name 'ADMIN_EMAIL' -Prompt 'E-mail address of the first Admin' -Supplied $supplied -Required -NonInteractive:$ni
    if ($values['ADMIN_EMAIL'] -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'ADMIN_EMAIL is not an e-mail address.' }
    $adminPassword = Get-AccucutInstallValue -Name 'ADMIN_INITIAL_PASSWORD' -Prompt 'A first password for the Admin (10 to 128 characters, with a digit and a symbol; they change it at first sign-in)' -Supplied $supplied -Secret -Required -NonInteractive:$ni
    if ($adminPassword.Length -lt 10 -or $adminPassword.Length -gt 128 -or $adminPassword -notmatch '\d' -or $adminPassword -notmatch '[^A-Za-z0-9]') {
        throw 'ADMIN_INITIAL_PASSWORD must be 10 to 128 characters and hold a digit and a symbol.'
    }
    $values['ADMIN_INITIAL_PASSWORD'] = $adminPassword

    $mode = Get-AccucutInstallValue -Name 'SMTP_AUTH_MODE' -Prompt 'Mail sign-in mode (none, password or oauth2-client-credentials)' -Supplied $supplied -Default 'none' -NonInteractive:$ni
    if (@('none', 'password', 'oauth2-client-credentials') -notcontains $mode) { throw "SMTP_AUTH_MODE '$mode' is not one of none, password, oauth2-client-credentials." }
    $values['SMTP_AUTH_MODE'] = $mode
    # Mode none needs a host and a port only because the settings check wants them; the template's own answers stand unless the values file has others.
    $mailQuestions = $ni
    if ($mode -eq 'none') { $mailQuestions = $true }
    $values['SMTP_HOST'] = Get-AccucutInstallValue -Name 'SMTP_HOST' -Prompt 'Mail server name' -Supplied $supplied -Default $defaults['SMTP_HOST'] -NonInteractive:$mailQuestions
    $values['SMTP_PORT'] = Get-AccucutInstallValue -Name 'SMTP_PORT' -Prompt 'Mail server port' -Supplied $supplied -Default $defaults['SMTP_PORT'] -NonInteractive:$mailQuestions
    if ($mode -ne 'none') {
        $values['SMTP_USER'] = Get-AccucutInstallValue -Name 'SMTP_USER' -Prompt 'Mailbox user name' -Supplied $supplied -Required -NonInteractive:$ni
    }
    if ($mode -eq 'password') {
        $values['SMTP_PASSWORD'] = Get-AccucutInstallValue -Name 'SMTP_PASSWORD' -Prompt 'Mailbox password' -Supplied $supplied -Secret -Required -NonInteractive:$ni
    }
    if ($mode -eq 'oauth2-client-credentials') {
        $values['SMTP_OAUTH_TENANT_ID'] = Get-AccucutInstallValue -Name 'SMTP_OAUTH_TENANT_ID' -Prompt 'Microsoft 365 tenant ID' -Supplied $supplied -Required -NonInteractive:$ni
        $values['SMTP_OAUTH_CLIENT_ID'] = Get-AccucutInstallValue -Name 'SMTP_OAUTH_CLIENT_ID' -Prompt 'Microsoft 365 client ID' -Supplied $supplied -Required -NonInteractive:$ni
        $values['SMTP_OAUTH_CLIENT_SECRET'] = Get-AccucutInstallValue -Name 'SMTP_OAUTH_CLIENT_SECRET' -Prompt 'Microsoft 365 client secret' -Supplied $supplied -Secret -Required -NonInteractive:$ni
    }

    $values['AUTH_SECRET'] = $authSecret
    $values['DATABASE_URL'] = "postgresql://accucut_app:$appPassword@${PgHost}:${PgPort}/$DatabaseName"
    $values['MIGRATE_DATABASE_URL'] = "postgresql://accucut_owner:$ownerPassword@${PgHost}:${PgPort}/$DatabaseName"
    Register-AccucutSecret -Value $values['DATABASE_URL']
    Register-AccucutSecret -Value $values['MIGRATE_DATABASE_URL']

    $superuserPassword = Get-AccucutInstallValue -Name 'PG_SUPERUSER_PASSWORD' -Prompt 'The password of the PostgreSQL administrator (set when PostgreSQL was installed)' -Supplied $supplied -Secret -Required -NonInteractive:$ni
    return [pscustomobject]@{ Values = $values; PgSuperuserPassword = $superuserPassword; OwnerPassword = $ownerPassword; AppPassword = $appPassword }
}

function Set-AccucutDirectoryAcl {
    <# Cuts inheritance on a folder and sets exactly: full control for Administrators and SYSTEM, plus the given accounts at the given rights. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$ReadAndExecute = @(),
        [string[]]$Modify = @()
    )

    $security = New-Object System.Security.AccessControl.DirectorySecurity
    $security.SetAccessRuleProtection($true, $false)
    $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    $none = [System.Security.AccessControl.PropagationFlags]::None
    $allow = [System.Security.AccessControl.AccessControlType]::Allow
    $administrators = New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)
    $system = New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
    foreach ($sid in @($administrators, $system)) {
        $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', $inherit, $none, $allow)))
    }
    foreach ($account in $ReadAndExecute) {
        $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule((New-Object System.Security.Principal.NTAccount($account)), 'ReadAndExecute', $inherit, $none, $allow)))
    }
    foreach ($account in $Modify) {
        $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule((New-Object System.Security.Principal.NTAccount($account)), 'Modify', $inherit, $none, $allow)))
    }
    [System.IO.Directory]::SetAccessControl($Path, $security)
}

function Grant-AccucutFolderAccess {
    <# Adds one allow rule (ReadAndExecute or Modify, inherited by what the folder holds) to a folder's existing list. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Account,
        [Parameter(Mandatory)][ValidateSet('ReadAndExecute', 'Modify')][string]$Rights
    )

    $security = [System.IO.Directory]::GetAccessControl($Path)
    $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule((New-Object System.Security.Principal.NTAccount($Account)), $Rights, $inherit, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow)
    $security.AddAccessRule($rule)
    [System.IO.Directory]::SetAccessControl($Path, $security)
}

function Set-AccucutDefenderExclusion {
    <# AC-7: excludes the PostgreSQL data folder from real-time scanning, as PostgreSQL advises, and says so. IT may decline. #>
    [CmdletBinding()]
    param(
        [string]$Path,
        [ValidateSet('Ask', 'Yes', 'No')][string]$Decision = 'Ask',
        [switch]$NonInteractive,
        [string]$LogFile
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        Write-AccucutLog -Message 'Windows Defender: the PostgreSQL data folder could not be found, so no exclusion was made.' -Level Warning -LogFile $LogFile
        return $false
    }
    Write-AccucutLog -Message "Windows Defender: PostgreSQL advises excluding its data folder '$Path' from real-time scanning (scanning slows the database and can lock its files)." -LogFile $LogFile
    $answer = $Decision
    if ($answer -eq 'Ask') {
        if ($NonInteractive) { $answer = 'No' } else {
            $reply = Read-AccucutHostInput -Prompt "Exclude '$Path' from Windows Defender real-time scanning? (yes/no)" -Default 'yes'
            if ($reply -match '^(y|yes)$') { $answer = 'Yes' } else { $answer = 'No' }
        }
    }
    if ($answer -ne 'Yes') {
        Write-AccucutLog -Message 'Windows Defender: no exclusion was made (declined). You can add it later: Add-MpPreference -ExclusionPath <the folder>.' -LogFile $LogFile
        return $false
    }
    if ($null -eq (Get-Command -Name Add-MpPreference -ErrorAction SilentlyContinue)) {
        Write-AccucutLog -Message 'Windows Defender: its commands are not available on this server, so no exclusion was made.' -Level Warning -LogFile $LogFile
        return $false
    }
    try {
        Add-MpPreference -ExclusionPath $Path -ErrorAction Stop
    }
    catch {
        Write-AccucutLog -Message "Windows Defender: the exclusion could not be made ($($_.Exception.Message)). Another product may manage Defender here. Continuing." -Level Warning -LogFile $LogFile
        return $false
    }
    Write-AccucutLog -Message "Windows Defender: '$Path' is now excluded from real-time scanning. To undo it: Remove-MpPreference -ExclusionPath '$Path'." -LogFile $LogFile
    return $true
}

function Register-AccucutLogCleanupTask {
    <# A daily task that deletes service logs older than 30 days (NFR-024). Runs as SYSTEM from the install folder, which only Administrators can write. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$Paths)

    $taskName = 'Accucut log cleanup'
    $script = Join-Path $Paths.Current 'clean-logs.ps1'
    $argument = "-NoProfile -NonInteractive -File `"$script`" -LogDirectory `"$($Paths.Logs)`" -KeepDays 30"
    $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $argument
    $trigger = New-ScheduledTaskTrigger -Daily -At '03:30'
    $principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Deletes Accucut service logs older than 30 days.' -Force | Out-Null
}

function Undo-AccucutInstallDatabase {
    <# Drops the database and roles that THIS run created (they are new and empty), so a failed install can be run again. Never touches anything else. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][hashtable]$Connection,
        [Parameter(Mandatory)][hashtable]$Created,
        [Parameter(Mandatory)][string]$DatabaseName,
        [string]$LogFile
    )

    try {
        if ($Created.Database) {
            [void](Invoke-AccucutPsql -PsqlPath $PsqlPath -Connection $Connection -Database 'postgres' -Command "DROP DATABASE IF EXISTS `"$DatabaseName`" WITH (FORCE)")
        }
        if ($Created.Roles) {
            [void](Invoke-AccucutPsql -PsqlPath $PsqlPath -Connection $Connection -Database 'postgres' -Command 'DROP ROLE IF EXISTS accucut_app; DROP ROLE IF EXISTS accucut_owner;')
        }
        Write-AccucutLog -Message 'The database and roles that this run created were dropped again, so the install can be run again.' -Level Warning -LogFile $LogFile
    }
    catch {
        Write-AccucutLog -Message "The database and roles that this run created could not be dropped: $($_.Exception.Message). Drop database '$DatabaseName' and roles accucut_app and accucut_owner by hand before running the install again." -Level Error -LogFile $LogFile
    }
}

function Invoke-AccucutInstall {
    [CmdletBinding()]
    param(
        [string]$ZipPath,
        [string]$Sha256,
        [string]$ValuesFile,
        [switch]$NonInteractive,
        [string]$Root = 'C:\Accucut',
        [ValidateRange(1, 65535)][int]$Port = 3000,
        [string]$ListenAddress,
        [switch]$WithProxy,
        [string]$PgHost = '127.0.0.1',
        [ValidateRange(1, 65535)][int]$PgPort = 5432,
        [string]$PgSuperuser = 'postgres',
        [string]$PgBinDirectory,
        [string]$PgDataDirectory,
        [ValidateSet('Ask', 'Yes', 'No')][string]$DefenderExclusion = 'Ask',
        [ValidateRange(10, 1800)][int]$HealthTimeoutSeconds = 180,
        [string]$PackageRoot
    )

    $ErrorActionPreference = 'Stop'
    if ([string]::IsNullOrWhiteSpace($PackageRoot)) { $PackageRoot = $script:ScriptRoot }

    if (-not (Test-InstallerIsAdministrator)) {
        throw 'Run this script as an administrator: right-click Windows PowerShell, choose Run as administrator, and start it again.'
    }

    # 1 and 2. The zip's hash, before any change. Then the scripts are unblocked and the shared module is loaded.
    Initialize-AccucutPackage -ZipPath $ZipPath -Sha256 $Sha256 -PackageRoot $PackageRoot
    $paths = Get-AccucutPaths -Root $Root
    $release = Read-AccucutReleaseInfo -PackageRoot $PackageRoot
    $tag = [string]$release.tag
    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $logFile = Join-Path $paths.Logs "install-$stamp.log"

    # Versions (no change yet).
    $node = Get-Command -Name node -ErrorAction SilentlyContinue
    $nodeExe = $null
    $nodeVersionText = $null
    if ($null -ne $node) {
        $nodeExe = $node.Source
        $nodeVersionText = (Invoke-AccucutNative -FilePath $nodeExe -ArgumentList @('--version') -AllowFailure).Output
    }
    $nodeCheck = Test-AccucutNodeVersion -VersionText $nodeVersionText
    if (-not $nodeCheck.Ok) { throw $nodeCheck.Message }
    $postgres = Get-AccucutPostgresInstall -BinDirectory $PgBinDirectory -DataDirectory $PgDataDirectory
    $psql = Join-Path $postgres.BinDirectory 'psql.exe'
    $psqlVersion = (Invoke-AccucutNative -FilePath $psql -ArgumentList @('--version')).Output
    $psqlCheck = Test-AccucutPostgresVersion -VersionText $psqlVersion
    if (-not $psqlCheck.Ok) { throw $psqlCheck.Message }

    # 3. Refuse to touch an existing install.
    if ((Test-Path -LiteralPath $paths.EnvFile) -or (Test-Path -LiteralPath $paths.StateFile) -or ($null -ne (Get-Service -Name (Get-AccucutServiceNames) -ErrorAction SilentlyContinue))) {
        throw "The portal is already installed under '$($paths.Root)'. To install a new release, run update.ps1. Nothing was changed."
    }

    # 4. The values. Asked for before anything is created, so a typing slip costs nothing.
    $template = Read-AccucutEnvTemplate -Path (Join-Path $PackageRoot '.env.example')
    $settings = Get-AccucutInstallSettings -Template $template -ValuesFile $ValuesFile -NonInteractive:$NonInteractive -Port $Port -PgHost $PgHost -PgPort $PgPort -DatabaseName $script:DatabaseName
    Register-AccucutSecret -Value $settings.PgSuperuserPassword
    $envLines = Split-AccucutEnvValues -Template $template -Values $settings.Values
    $effectiveListen = $ListenAddress
    if ([string]::IsNullOrWhiteSpace($effectiveListen)) { if ($WithProxy) { $effectiveListen = '127.0.0.1' } else { $effectiveListen = '0.0.0.0' } }

    # The install folder is locked to Administrators and SYSTEM at once, before any file with a setting is created in it. The service accounts are
    # added when the services exist. Windows gives Authenticated Users write access to new folders in C:\, which must not reach the program files.
    foreach ($directory in @($paths.Root)) { if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null } }
    Set-AccucutDirectoryAcl -Path $paths.Root
    foreach ($directory in @($paths.Releases, $paths.Config, $paths.Services, $paths.Logs)) { if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null } }
    Write-AccucutLog -Message "Installing Accucut release $tag under '$($paths.Root)'. $($nodeCheck.Message). $($psqlCheck.Message)." -LogFile $logFile

    $connection = @{ Host = $PgHost; Port = $PgPort; User = $PgSuperuser; Password = $settings.PgSuperuserPassword }
    $created = @{ Database = $false; Roles = $false }
    $releaseDirectory = Join-Path $paths.Releases $tag
    try {
        # 5. The release folder and the `current` junction.
        Copy-AccucutTree -Source $PackageRoot -Destination $releaseDirectory
        Set-Content -LiteralPath (Join-Path $releaseDirectory '.zip-sha256') -Value (Get-AccucutFileSha256 -Path $ZipPath) -Encoding ASCII
        Set-AccucutCurrentRelease -Paths $paths -Tag $tag
        Write-AccucutLog -Message "Release folder: $releaseDirectory (current -> $tag)." -LogFile $logFile

        # 6. The settings files. Created empty, locked, then filled.
        Write-AccucutSecureFile -Path $paths.MigrateEnvFile -Line $envLines.Migrate
        Write-AccucutSecureFile -Path $paths.EnvFile -Line $envLines.Runtime
        Write-AccucutLog -Message "Settings written: $($paths.EnvFile) and $($paths.MigrateEnvFile) (no value is shown here)." -LogFile $logFile

        # 7. The database: refuse an existing one, create it and the two roles.
        $existing = Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database 'postgres' -Command "SELECT count(*) FROM pg_database WHERE datname = '$($script:DatabaseName)'"
        if ($existing -ne '0') { throw "A database named '$($script:DatabaseName)' already exists in this PostgreSQL. This script never touches existing data. If it is an empty leftover of an earlier try, drop it and the roles accucut_app and accucut_owner, then run this again." }
        $roleCount = Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database 'postgres' -Command "SELECT count(*) FROM pg_roles WHERE rolname IN ('accucut_app', 'accucut_owner')"
        if ($roleCount -ne '0') { throw 'The database roles accucut_app or accucut_owner already exist in this PostgreSQL. This script never touches existing roles. Remove them if they are leftovers, then run this again.' }
        $serverVersion = Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database 'postgres' -Command 'SHOW server_version_num'
        $serverCheck = Test-AccucutPostgresVersion -VersionText $serverVersion
        if (-not $serverCheck.Ok) { throw "The PostgreSQL server is not version 17 (server_version_num $serverVersion). $($serverCheck.Message)" }

        [void](Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database 'postgres' -Command "CREATE DATABASE `"$($script:DatabaseName)`" ENCODING 'UTF8' TEMPLATE template0")
        $created.Database = $true
        $created.Roles = $true
        $rolesSql = Join-Path $releaseDirectory 'sql\create-roles.psql'
        [void](Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database $script:DatabaseName -File $rolesSql -ExtraEnvironment @{
                DB_OWNER_PASSWORD = $settings.OwnerPassword
                DB_APP_PASSWORD   = $settings.AppPassword
                POSTGRES_DB       = $script:DatabaseName
            })
        Write-AccucutLog -Message "Database '$($script:DatabaseName)' and the roles accucut_owner and accucut_app created." -LogFile $logFile

        # 8. Migrations as the owner role, ensure-seed-version, then the first Admin as the runtime role.
        $migration = Invoke-AccucutMigration -ReleaseDirectory $releaseDirectory -NodeExe $nodeExe -MigrateDatabaseUrl $settings.Values['MIGRATE_DATABASE_URL']
        Write-AccucutLog -Message "Migrations: $($migration.Deploy)" -LogFile $logFile
        Write-AccucutLog -Message "Seed: $($migration.Seed)" -LogFile $logFile
        $adminResult = Invoke-AccucutNative -FilePath $nodeExe -WorkingDirectory (Join-Path $releaseDirectory 'app') -ArgumentList @('bootstrap-admin.mjs') -Environment @{
            DATABASE_URL           = $settings.Values['DATABASE_URL']
            ADMIN_EMAIL            = $settings.Values['ADMIN_EMAIL']
            ADMIN_INITIAL_PASSWORD = $settings.Values['ADMIN_INITIAL_PASSWORD']
            NODE_ENV               = 'production'
        }
        Write-AccucutLog -Message $adminResult.Output -LogFile $logFile
        # The first Admin's password is read once. It is removed from migrate.env now (README: "read once, then remove").
        $remaining = @($envLines.Migrate | Where-Object { $_ -notmatch '^ADMIN_INITIAL_PASSWORD=' })
        Write-AccucutSecureFile -Path $paths.MigrateEnvFile -Line $remaining

        # 9. The services (WinSW), each as its own virtual account. Never started before the account is set.
        $changed = Initialize-AccucutServiceFiles -Paths $paths -ReleaseDirectory $releaseDirectory -NodeExe $nodeExe -Port $Port -ListenAddress $effectiveListen
        foreach ($name in (Get-AccucutServiceNames)) {
            [void](Invoke-AccucutNative -FilePath (Join-Path $paths.Services "$name.exe") -ArgumentList @('install'))
            Set-AccucutServiceIdentity -Name $name
        }
        Write-AccucutLog -Message "Services registered: $((Get-AccucutServiceNames) -join ', ') (Automatic, Delayed Start, own virtual account, after $(Get-AccucutPostgresServiceName))." -LogFile $logFile

        # 10. Access for the service accounts, now that they exist.
        $accounts = @(Get-AccucutServiceNames | ForEach-Object { "NT SERVICE\$_" })
        foreach ($account in $accounts) { Grant-AccucutFolderAccess -Path $paths.Root -Account $account -Rights ReadAndExecute }
        foreach ($account in $accounts) { Grant-AccucutFolderAccess -Path $paths.Logs -Account $account -Rights Modify }
        # The app's settings file: Administrators and the two service accounts only. migrate.env stays Administrators only.
        Set-AccucutFileAcl -Path $paths.EnvFile -ReadAccount $accounts

        # 11. Logs: 30 days kept; Defender; firewall; the backup task (STORY-10.05 adds its script).
        [void](Remove-AccucutOldLogs -Path $paths.Logs -KeepDays 30)
        Register-AccucutLogCleanupTask -Paths $paths
        [void](Set-AccucutDefenderExclusion -Path $postgres.DataDirectory -Decision $DefenderExclusion -NonInteractive:$NonInteractive -LogFile $logFile)
        if ($WithProxy) {
            if ($null -eq (Get-NetFirewallRule -DisplayName 'Accucut web (80, 443)' -ErrorAction SilentlyContinue)) {
                New-NetFirewallRule -DisplayName 'Accucut web (80, 443)' -Direction Inbound -Protocol TCP -LocalPort 80, 443 -Action Allow | Out-Null
            }
            Write-AccucutLog -Message 'Firewall: inbound TCP 80 and 443 are open for the proxy. The app itself listens on 127.0.0.1 only. The proxy is yours to install.' -LogFile $logFile
        }
        $backupTask = Join-Path $releaseDirectory 'register-backup-task.ps1'
        if (Test-Path -LiteralPath $backupTask) { & $backupTask -Root $paths.Root } else { Write-AccucutLog -Message 'The weekly backup task is added by the backup release (STORY-10.05); this release has none yet.' -Level Warning -LogFile $logFile }

        # 12. Start, and wait for the health check.
        Start-AccucutServices
        $healthUrl = "http://127.0.0.1:$Port/api/health"
        if (-not (Wait-AccucutHealth -Url $healthUrl -TimeoutSeconds $HealthTimeoutSeconds)) {
            throw "The portal did not answer 200 at $healthUrl within $HealthTimeoutSeconds seconds. See the logs in '$($paths.Logs)' (AccucutApp.*.err.log). The services were left running for you to look at."
        }
        $signIn = Get-AccucutHttpStatus -Url "http://127.0.0.1:$Port/sign-in"
        Write-AccucutLog -Message "Health check answered 200; the sign-in page answered $signIn." -LogFile $logFile

        $state = [ordered]@{
            tag = $tag; root = $paths.Root; nodeExe = $nodeExe; port = $Port; listenAddress = $effectiveListen; withProxy = [bool]$WithProxy
            pgHost = $PgHost; pgPort = $PgPort; pgBinDirectory = $postgres.BinDirectory; pgDataDirectory = $postgres.DataDirectory
            database = $script:DatabaseName; installedAt = (Get-Date).ToUniversalTime().ToString('o')
        }
        [System.IO.File]::WriteAllText($paths.StateFile, ($state | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
    }
    catch {
        Write-AccucutLog -Message "INSTALL FAILED: $($_.Exception.Message)" -Level Error -LogFile $logFile
        if ($created.Database -or $created.Roles) {
            # Only when the services were not registered yet: after that the database is in use and is left for IT to look at.
            if ($null -eq (Get-Service -Name (Get-AccucutServiceNames) -ErrorAction SilentlyContinue)) {
                Undo-AccucutInstallDatabase -PsqlPath $psql -Connection $connection -Created $created -DatabaseName $script:DatabaseName -LogFile $logFile
            }
        }
        throw
    }

    Write-AccucutLog -Message "Done. Open $($settings.Values['APP_ORIGIN']) and sign in as $($settings.Values['ADMIN_EMAIL']) with the first password; you will be asked to choose a new one." -LogFile $logFile
    Write-AccucutLog -Message "Install log: $logFile. If you used a values file, delete it now: it holds the first password." -LogFile $logFile
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        Invoke-AccucutInstall @PSBoundParameters
        exit 0
    }
    catch {
        $message = $_.Exception.Message
        if (Get-Command -Name Hide-AccucutSecrets -ErrorAction SilentlyContinue) { $message = Hide-AccucutSecrets -Text $message }
        Write-Host "The install stopped: $message" -ForegroundColor Red
        exit 1
    }
}
