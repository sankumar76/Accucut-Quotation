<#
.SYNOPSIS
  Installs the Accucut Quotation Portal on a Windows Server (STORY-10.04; ADR-015; architecture section 9.9).

.DESCRIPTION
  Run once, as an administrator, from the unpacked release zip. Needs Node.js 22 (22.12 or later) and PostgreSQL 17, both installed from
  the vendors' installers. Windows PowerShell 5.1 (built into Windows Server).

  What it does, in this order, and stops at the first problem:
    1.  Checks the SHA-256 of the zip, before anything else. A changed zip is refused and nothing is touched.
    2.  Makes the install folder: it must not exist, or be an EMPTY folder owned by Administrators or SYSTEM (a folder that someone else made, or
        filled, could be kept under their control, so it is refused). It is owned by Administrators and locked to Administrators and SYSTEM at once.
    3.  Copies the zip into that locked folder, checks the SHA-256 of the COPY, and unpacks the copy to C:\Accucut\releases\<tag>\. From here on every
        file it reads or runs (this script itself, the shared module, .env.example, the SQL, WinSW, Node's programs) comes from that folder, never from
        the folder you unpacked into, which anyone could have changed after the check. It then starts the copy of this script from there.
    4.  Checks the Node.js and PostgreSQL versions. Refuses to go on if the portal is already installed here (use update.ps1) or the database already
        exists (it never touches existing data).
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
.PARAMETER VerifiedRelease
  Used by the script itself, never by you: the verified release folder under C:\Accucut\releases that the second half of the install runs from.
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
    [string]$VerifiedRelease
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

# ---- First half: nothing here uses the shared module or any other file of the unpacked folder. The unpacked folder is not trusted: anyone
# ---- who could write to it could change a file after the zip was checked. These functions use PowerShell's own commands only.

# BEGIN shared path trust (install.ps1, update.ps1 and AccucutOps.psm1 hold this block word for word; tests/unit/windows-deploy-files.test.ts fails if they differ)
function Get-AccucutPathSecurity {
    <# The owner and the allow rules of a file or folder as plain data (SIDs and numbers). A function of its own, so that Pester can mock it. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $item = Get-Item -LiteralPath $Path -Force
    $security = $item.GetAccessControl()
    $rules = New-Object System.Collections.Generic.List[object]
    foreach ($rule in $security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { continue }
        $rules.Add([pscustomobject]@{
                Sid         = $rule.IdentityReference.Value
                Rights      = [int]$rule.FileSystemRights
                InheritOnly = [bool]($rule.PropagationFlags -band [System.Security.AccessControl.PropagationFlags]::InheritOnly)
                Inherited   = [bool]$rule.IsInherited
            })
    }
    return [pscustomobject]@{ Owner = $security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value; Rules = $rules.ToArray() }
}

function Assert-AccucutPathTrusted {
    <#
    THE rule for trusting a path, used everywhere a path is trusted: the install folder, releases, a release, config, logs, and the scripts and the module
    before they are run or loaded. It walks every part of the path, from the drive root down to the target, and stops with an error for the first part that
    is not safe. For every part:
      - it must not be a link (a junction or symbolic link could send the path somewhere else). One exception, asked for with -AllowLinkAtLeaf: the last
        part may be a link, for `current`; the caller then checks where it points;
      - its owner must be Administrators (S-1-5-32-544), SYSTEM (S-1-5-18) or TrustedInstaller (the owner of system folders such as Program Files);
      - nobody else may be able to replace or remove it, or change who controls it: no allow rule for another principal may carry Delete,
        DeleteSubdirectoriesAndFiles (delete a child), ChangePermissions or TakeOwnership.
    The last part (the target) gets the stricter rule, because what is inside it is run: nobody else may carry WriteData (create files), AppendData (create
    folders), WriteExtendedAttributes or WriteAttributes either, and the rules that only reach what is inside it (inherit only) count too.

    What is allowed on the drive root and on any other part above the target, and why. Windows gives every user "create folders" and "create files" on
    the drive root (for example `Authenticated Users: create folders / append data` and `create files`, on that folder only) and `Modify` on what is
    inside it (inherit-only). Those do not let a user delete, replace or take over an existing folder that an administrator owns, so they must not make
    every install fail: a part above the target is refused only for Delete, DeleteSubdirectoriesAndFiles, ChangePermissions or TakeOwnership, and rules
    marked inherit-only (they reach the children of that part, not the part itself) are not counted. The target and everything made inside it are
    protected by the target's own rule above, which is the strict one.

    -AllowedWriter names SIDs (never account names) that may also write to the target, for example the two service accounts for the logs folder.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$AllowedWriter = @(),
        [switch]$AllowLinkAtLeaf
    )

    if ($Path.StartsWith('\\') -or -not [System.IO.Path]::IsPathRooted($Path)) { throw "'$Path' is not a full local path. Refusing to use it." }
    $full = [System.IO.Path]::GetFullPath($Path)
    if ($full.Length -gt 3) { $full = $full.TrimEnd('\') }
    $driveRoot = [System.IO.Path]::GetPathRoot($full)
    $trustedSids = @('S-1-5-32-544', 'S-1-5-18', 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
    $rights = [System.Security.AccessControl.FileSystemRights]
    $replaceMask = [int]($rights::DeleteSubdirectoriesAndFiles -bor $rights::Delete -bor $rights::ChangePermissions -bor $rights::TakeOwnership)
    $writeMask = [int]($rights::DeleteSubdirectoriesAndFiles -bor $rights::Delete -bor $rights::ChangePermissions -bor $rights::TakeOwnership -bor $rights::WriteData -bor $rights::AppendData -bor $rights::WriteExtendedAttributes -bor $rights::WriteAttributes)

    $chain = New-Object System.Collections.Generic.List[string]
    $chain.Add($driveRoot)
    $current = $driveRoot
    foreach ($segment in ($full.Substring($driveRoot.Length) -split '\\')) {
        if ($segment -eq '') { continue }
        $current = Join-Path $current $segment
        $chain.Add($current)
    }

    for ($index = 0; $index -lt $chain.Count; $index++) {
        $part = $chain[$index]
        $isTarget = ($index -eq $chain.Count - 1)
        if (-not (Test-Path -LiteralPath $part)) { throw "'$part' does not exist. Refusing to use '$full'." }
        $item = Get-Item -LiteralPath $part -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            if ($isTarget -and $AllowLinkAtLeaf) { continue }
            throw "'$part' is a link, not a real folder, so '$full' could lead somewhere else. Refusing to use it."
        }
        $security = Get-AccucutPathSecurity -Path $part
        if ($trustedSids -notcontains $security.Owner) {
            throw "'$part' is owned by $($security.Owner), not by Administrators, SYSTEM or TrustedInstaller, so someone else controls it. Refusing to use '$full'."
        }
        $mask = $replaceMask
        if ($isTarget) { $mask = $writeMask }
        foreach ($rule in $security.Rules) {
            if ($rule.InheritOnly -and -not $isTarget) { continue }
            if ($trustedSids -contains $rule.Sid) { continue }
            if ($isTarget -and ($AllowedWriter -contains $rule.Sid)) { continue }
            if (($rule.Rights -band $mask) -ne 0) {
                $inherited = $false
                if ($rule.PSObject.Properties.Name -contains 'Inherited') { $inherited = [bool]$rule.Inherited }
                $named = ([System.Security.AccessControl.FileSystemRights]$rule.Rights).ToString()
                throw "'$part' can be changed by $($rule.Sid) (rights: $named; inherited: $inherited), who is not an administrator, so '$full' could be replaced or changed. Refusing to use it."
            }
        }
    }
}
# END shared path trust

function Assert-AccucutFreshRoot {
    <#
    The install folder must not exist, or must be an EMPTY real folder owned by Administrators or SYSTEM. Anything else could be under the control
    of a user who is not an administrator (they could have made the folder, or put a file or a link in it, and kept their rights), and the install
    would then run programs from it as a service. Returns 'New' or 'Empty'. (Whether an existing empty folder may be used also depends on who can
    write to it and to the folders above it: Assert-AccucutPathTrusted, run by the caller.)
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Root)

    if ($Root.StartsWith('\\') -or -not [System.IO.Path]::IsPathRooted($Root)) { throw "The install folder '$Root' must be a full local path such as C:\Accucut." }
    $full = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    if ($full.Length -le 3) { throw 'The install folder cannot be the root of a drive.' }
    if (-not (Test-Path -LiteralPath $full)) { return 'New' }
    $item = Get-Item -LiteralPath $full -Force
    if (-not $item.PSIsContainer) { throw "'$full' exists and is a file. Nothing was changed." }
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw "'$full' is a link, not a real folder. Nothing was changed." }
    $owner = (Get-AccucutPathSecurity -Path $full).Owner
    if (@('S-1-5-32-544', 'S-1-5-18') -notcontains $owner) {
        throw "'$full' already exists and is owned by $owner, not by Administrators or SYSTEM. A folder made by someone else is not trusted. Nothing was changed. Rename or delete it, or choose another -Root."
    }
    if (@(Get-ChildItem -LiteralPath $full -Force).Count -gt 0) {
        throw "'$full' already exists and is not empty. The install only uses a folder it makes itself, or an empty one owned by Administrators. Nothing was changed. If it is an earlier install, use update.ps1."
    }
    return 'Empty'
}

function Assert-AccucutLockedInstallRoot {
    <#
    The trust check of the install, run again and again between the steps (after the folder is locked, before the verified script is started, and before
    the second half loads anything from it), so that a swap at any moment is caught. It applies Assert-AccucutPathTrusted, the one rule, to the install
    folder (and so to every folder above it), to releases and, when -VerifiedRelease is given, to the release folder and to the two files that are run
    from it: install.ps1 and AccucutOps.psm1. The release must be directly inside releases.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [string]$VerifiedRelease,
        [switch]$RootOnly
    )

    $full = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    Assert-AccucutPathTrusted -Path $full
    if ($RootOnly) { return }
    $releases = Join-Path $full 'releases'
    Assert-AccucutPathTrusted -Path $releases
    if (-not [string]::IsNullOrWhiteSpace($VerifiedRelease)) {
        $release = [System.IO.Path]::GetFullPath($VerifiedRelease).TrimEnd('\')
        if ((Split-Path -Parent $release) -ine $releases) { throw "'$release' is not directly inside '$releases'. Refusing to use it." }
        Assert-AccucutPathTrusted -Path $release
        foreach ($file in 'install.ps1', 'AccucutOps.psm1') { Assert-AccucutPathTrusted -Path (Join-Path $release $file) }
    }
}


function New-AccucutDirectorySecurity {
    <# The permissions of a locked folder: owned by Administrators, no inheritance, full control for Administrators and SYSTEM, plus the given accounts. #>
    [CmdletBinding()]
    param(
        [string[]]$ReadAndExecute = @(),
        [string[]]$Modify = @()
    )

    $security = New-Object System.Security.AccessControl.DirectorySecurity
    $security.SetOwner((New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)))
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
    return $security
}

function New-AccucutLockedDirectory {
    <#
    Creates a folder WITH its locked permissions in one call (CreateDirectory with a security descriptor), so there is no moment at which it
    exists with the permissions of its parent. If it exists already, nothing is changed and nothing is returned as new: the caller checks the
    owner and the permissions afterwards and refuses a folder that is not its own.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    [void][System.IO.Directory]::CreateDirectory($Path, (New-AccucutDirectorySecurity))
}

function Expand-AccucutBootstrapZip {
    <# Unpacks a zip into a new folder, refusing any entry that would land outside it. (The shared module has the same function; it cannot be used yet.) #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ZipPath,
        [Parameter(Mandatory)][string]$Destination
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    $root = [System.IO.Path]::GetFullPath($Destination).TrimEnd('\') + '\'
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        foreach ($entry in $archive.Entries) {
            $target = [System.IO.Path]::GetFullPath((Join-Path $Destination $entry.FullName))
            if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw "The zip holds an entry outside its folder ('$($entry.FullName)'). Refusing to unpack it." }
            if ($entry.FullName.EndsWith('/') -or $entry.FullName.EndsWith('\')) {
                if (-not (Test-Path -LiteralPath $target)) { New-Item -ItemType Directory -Path $target -Force | Out-Null }
                continue
            }
            $parent = Split-Path -Parent $target
            if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
        }
    }
    finally {
        $archive.Dispose()
    }
}

function Remove-AccucutBootstrapFolder {
    <# Deletes a folder this run made inside the install folder, with `rd` on a \\?\ path. Refuses a folder that is not directly inside -Within. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Within
    )

    $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
    $parent = [System.IO.Path]::GetFullPath($Within).TrimEnd('\')
    if ((Split-Path -Parent $full) -ne $parent) { throw "Refusing to delete '$full': it is not directly inside '$parent'." }
    if (Test-Path -LiteralPath $full) { & "$env:SystemRoot\System32\cmd.exe" /c rd /s /q "\\?\$full" }
}

function Initialize-AccucutVerifiedRelease {
    <#
    The first half of the install. In this order, changing nothing until the zip's hash matches:
      1. the zip's SHA-256 (the file you gave);
      2. the install folder: new, or empty and owned by Administrators or SYSTEM (Assert-AccucutFreshRoot);
      3. the folder is made (or kept), owned by Administrators and locked to Administrators and SYSTEM, and must still be empty;
      4. the zip is COPIED into the locked folder and the SHA-256 of the COPY is checked (so the file that is unpacked is the file that was checked);
      5. the copy is unpacked to releases\<tag>.
    Returns the verified release folder. If a step fails, what this run made is removed again.
    #>
    [CmdletBinding()]
    param(
        [string]$ZipPath,
        [string]$Sha256,
        [Parameter(Mandatory)][string]$Root
    )

    if ([string]::IsNullOrWhiteSpace($ZipPath)) { throw 'Give the release zip: install.ps1 -ZipPath <the release zip>. Its SHA-256 is checked first.' }
    if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) { throw "The zip '$ZipPath' was not found." }
    $expected = $Sha256
    if ([string]::IsNullOrWhiteSpace($expected)) {
        $checksumFile = "$ZipPath.sha256"
        if (-not (Test-Path -LiteralPath $checksumFile -PathType Leaf)) { throw "No SHA-256 given: pass -Sha256, or keep '$(Split-Path -Leaf $checksumFile)' next to the zip." }
        $first = (Get-Content -LiteralPath $checksumFile -TotalCount 1)
        $expected = ($first.Trim() -split '\s+')[0]
    }
    if ($expected -notmatch '^[0-9A-Fa-f]{64}$') { throw 'The expected SHA-256 is not 64 hexadecimal characters.' }
    $expected = $expected.ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "The SHA-256 of the zip does not match (expected $expected, the file is $actual). Nothing was changed. Download the release again." }
    Write-Host "SHA-256 of $(Split-Path -Leaf $ZipPath) matches."

    $state = Assert-AccucutFreshRoot -Root $Root
    $full = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    $releases = Join-Path $full 'releases'
    $incoming = Join-Path $full '.in'
    $createdRoot = $false
    $rootVerified = $false
    try {
        if ($state -eq 'New') {
            # Made WITH its locked permissions in one call, so there is no moment at which another user could write into it or swap it. If someone made
            # the folder after the check above, CreateDirectory returns theirs unchanged, and the owner check below refuses it.
            New-AccucutLockedDirectory -Path $full
            Assert-AccucutLockedInstallRoot -Root $full -RootOnly
            $createdRoot = $true
        }
        else {
            # An existing empty folder is used only if no one but an administrator can write to it or delete from it; its permissions are then replaced.
            Assert-AccucutPathTrusted -Path $full
            Set-AccucutDirectoryAcl -Path $full
            Assert-AccucutLockedInstallRoot -Root $full -RootOnly
        }
        if (@(Get-ChildItem -LiteralPath $full -Force).Count -gt 0) { throw "Something appeared in '$full' while it was being locked. Nothing was installed." }
        $rootVerified = $true
        New-Item -ItemType Directory -Path $releases | Out-Null
        New-Item -ItemType Directory -Path $incoming | Out-Null

        $copy = Join-Path $incoming 'package.zip'
        Copy-Item -LiteralPath $ZipPath -Destination $copy
        $copyHash = (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($copyHash -ne $expected) { throw "The SHA-256 of the copy of the zip does not match (expected $expected, the copy is $copyHash). The file changed while it was being copied. Nothing was installed." }

        $unpacked = Join-Path $incoming 'unpacked'
        Expand-AccucutBootstrapZip -ZipPath $copy -Destination $unpacked
        $infoFile = Join-Path $unpacked 'release.json'
        if (-not (Test-Path -LiteralPath $infoFile -PathType Leaf)) { throw 'The zip has no release.json: it is not an Accucut release package.' }
        $tag = [string](Get-Content -LiteralPath $infoFile -Raw | ConvertFrom-Json).tag
        if ($tag -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$') { throw 'release.json has no valid tag (letters, digits, dot, dash and underscore only).' }
        $target = Join-Path $releases $tag
        [System.IO.Directory]::Move($unpacked, $target)
        Set-Content -LiteralPath (Join-Path $target '.zip-sha256') -Value $expected -Encoding ASCII
        Remove-AccucutBootstrapFolder -Path $incoming -Within $full
        Assert-AccucutLockedInstallRoot -Root $full -VerifiedRelease $target

        # The scripts and the two programs only: Node does not look at the downloaded-file mark, and node_modules holds thousands of files.
        $toUnblock = @(Get-ChildItem -LiteralPath $target -File | Where-Object { $_.Extension -in '.ps1', '.psm1' })
        $toUnblock += @(Get-ChildItem -LiteralPath (Join-Path $target 'bin') -File -ErrorAction SilentlyContinue)
        foreach ($file in $toUnblock) { Unblock-File -LiteralPath $file.FullName -ErrorAction SilentlyContinue }
        return $target
    }
    catch {
        if ($rootVerified) { foreach ($folder in @($releases, $incoming)) { if (Test-Path -LiteralPath $folder) { Remove-AccucutBootstrapFolder -Path $folder -Within $full } } }
        if ($createdRoot -and (Test-Path -LiteralPath $full) -and @(Get-ChildItem -LiteralPath $full -Force).Count -eq 0) { [System.IO.Directory]::Delete($full, $false) }
        throw
    }
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
    <#
    Makes Administrators the OWNER of a folder, cuts inheritance, and sets exactly: full control for Administrators and SYSTEM, plus the given
    accounts at the given rights. The old list is replaced, not added to, so a right that someone else had given themselves is gone.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$ReadAndExecute = @(),
        [string[]]$Modify = @()
    )

    [System.IO.Directory]::SetAccessControl($Path, (New-AccucutDirectorySecurity -ReadAndExecute $ReadAndExecute -Modify $Modify))
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
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule((ConvertTo-AccucutIdentity -Account $Account), $Rights, $inherit, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow)
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

function Remove-AccucutInstallLeftovers {
    <#
    After a failed install, before any service exists: removes what this run made inside the install folder (the release, config, services and logs
    folders and the `current` junction), so that the folder is empty again and the install can be run again. The install log is first copied to the
    temp folder of the person who ran the script. Never touches anything outside the install folder.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [string]$LogFile
    )

    try {
        if ($LogFile -and (Test-Path -LiteralPath $LogFile)) {
            $kept = Join-Path $env:TEMP ('accucut-failed-' + (Split-Path -Leaf $LogFile))
            Copy-Item -LiteralPath $LogFile -Destination $kept -Force
            Write-Host "The install log was kept: $kept"
        }
        if ((Test-Path -LiteralPath $Paths.Current) -and ((Get-Item -LiteralPath $Paths.Current -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
            [System.IO.Directory]::Delete($Paths.Current, $false)
        }
        foreach ($folder in @($Paths.Releases, $Paths.Config, $Paths.Services, $Paths.Logs)) {
            if (Test-Path -LiteralPath $folder) { Remove-AccucutDirectory -Path $folder -Within $Paths.Root }
        }
    }
    catch {
        Write-Host "The folders of the failed install could not be cleared ($($_.Exception.Message)). Empty '$($Paths.Root)' by hand before running the install again." -ForegroundColor Yellow
    }
}

function Invoke-AccucutInstall {
    <# The second half of the install. It runs from the verified release folder only: -PackageRoot must be C:\Accucut\releases\<tag>, made by the first half. #>
    [CmdletBinding()]
    param(
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
        [Parameter(Mandatory)][string]$PackageRoot
    )

    $ErrorActionPreference = 'Stop'
    if (-not (Test-InstallerIsAdministrator)) {
        throw 'Run this script as an administrator: right-click Windows PowerShell, choose Run as administrator, and start it again.'
    }

    # 1 to 3 were done by the first half. Everything below reads from the verified release folder (its release.json, .env.example, SQL, WinSW, programs),
    # and the install folder itself must still be as the first half left it.
    $paths = Get-AccucutPaths -Root $Root
    $release = Read-AccucutReleaseInfo -PackageRoot $PackageRoot
    $tag = [string]$release.tag
    $releaseDirectory = Join-Path $paths.Releases $tag
    if ([System.IO.Path]::GetFullPath($PackageRoot).TrimEnd('\') -ine [System.IO.Path]::GetFullPath($releaseDirectory).TrimEnd('\')) {
        throw "'$PackageRoot' is not the verified release folder '$releaseDirectory'. The install only runs from the folder that was made from the checked zip."
    }
    # The same check once more, now with the module (which came from the verified folder): root, releases and the release itself, and the parent.
    Assert-AccucutPathTrusted -Path $paths.Root
    Assert-AccucutPathTrusted -Path $paths.Releases
    Assert-AccucutPathTrusted -Path $releaseDirectory
    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $logFile = Join-Path $paths.Logs "install-$stamp.log"

    # Versions, an existing install, and the values: nothing is created yet. If one of them fails, what the first half made is removed again, so
    # that the install folder is empty and the install can be run again.
    try {
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

        if ($null -ne (Get-Service -Name (Get-AccucutServiceNames) -ErrorAction SilentlyContinue)) {
            throw "The services of an Accucut install already exist on this server. To install a new release, run update.ps1. Nothing was changed."
        }

        # The values. Asked for before anything is created, so a typing slip costs nothing.
        $template = Read-AccucutEnvTemplate -Path (Join-Path $PackageRoot '.env.example')
        $settings = Get-AccucutInstallSettings -Template $template -ValuesFile $ValuesFile -NonInteractive:$NonInteractive -Port $Port -PgHost $PgHost -PgPort $PgPort -DatabaseName $script:DatabaseName
        Register-AccucutSecret -Value $settings.PgSuperuserPassword
        $envLines = Split-AccucutEnvValues -Template $template -Values $settings.Values
        $effectiveListen = $ListenAddress
        if ([string]::IsNullOrWhiteSpace($effectiveListen)) { if ($WithProxy) { $effectiveListen = '127.0.0.1' } else { $effectiveListen = '0.0.0.0' } }
    }
    catch {
        Remove-AccucutInstallLeftovers -Paths $paths
        throw
    }

    # The install folder was locked by the first half (owned by Administrators, writable by Administrators and SYSTEM only), so the folders made
    # here inherit that and carry no entry for anyone else. The service accounts are added when the services exist.
    foreach ($directory in @($paths.Config, $paths.Services, $paths.Logs)) { New-Item -ItemType Directory -Path $directory | Out-Null }
    Write-AccucutLog -Message "Installing Accucut release $tag under '$($paths.Root)'. $($nodeCheck.Message). $($psqlCheck.Message)." -LogFile $logFile

    $connection = @{ Host = $PgHost; Port = $PgPort; User = $PgSuperuser; Password = $settings.PgSuperuserPassword }
    $created = @{ Database = $false; Roles = $false }
    try {
        # 5. The `current` junction (the release folder was unpacked from the checked copy of the zip by the first half).
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
        # By SID (computed from the service name): looking up the name NT SERVICE\<name> failed on the build runner.
        $accounts = @(Get-AccucutServiceNames | ForEach-Object { Get-AccucutServiceSid -Name $_ })
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
        # Only while the services are not registered: after that the database is in use and the folders are left for IT to look at.
        if ($null -eq (Get-Service -Name (Get-AccucutServiceNames) -ErrorAction SilentlyContinue)) {
            if ($created.Database -or $created.Roles) {
                Undo-AccucutInstallDatabase -PsqlPath $psql -Connection $connection -Created $created -DatabaseName $script:DatabaseName -LogFile $logFile
            }
            Remove-AccucutInstallLeftovers -Paths $paths -LogFile $logFile
        }
        throw
    }

    Write-AccucutLog -Message "Done. Open $($settings.Values['APP_ORIGIN']) and sign in as $($settings.Values['ADMIN_EMAIL']) with the first password; you will be asked to choose a new one." -LogFile $logFile
    Write-AccucutLog -Message "Install log: $logFile. If you used a values file, delete it now: it holds the first password." -LogFile $logFile
}

function Start-AccucutInstall {
    <#
    The entry point. Without -VerifiedRelease it is the first half: check the zip, make the locked install folder, copy and check the zip again,
    unpack it, and start the copy of this script that is in the unpacked release. With -VerifiedRelease it is the second half, and it loads the
    shared module from that folder only.
    #>
    [CmdletBinding()]
    param(
        [string]$ZipPath,
        [string]$Sha256,
        [string]$ValuesFile,
        [switch]$NonInteractive,
        [string]$Root = 'C:\Accucut',
        [int]$Port = 3000,
        [string]$ListenAddress,
        [switch]$WithProxy,
        [string]$PgHost = '127.0.0.1',
        [int]$PgPort = 5432,
        [string]$PgSuperuser = 'postgres',
        [string]$PgBinDirectory,
        [string]$PgDataDirectory,
        [string]$DefenderExclusion = 'Ask',
        [int]$HealthTimeoutSeconds = 180,
        [string]$VerifiedRelease
    )

    $ErrorActionPreference = 'Stop'
    $secondHalf = @{
        ValuesFile = $ValuesFile; NonInteractive = $NonInteractive; Root = $Root; Port = $Port; ListenAddress = $ListenAddress; WithProxy = $WithProxy
        PgHost = $PgHost; PgPort = $PgPort; PgSuperuser = $PgSuperuser; PgBinDirectory = $PgBinDirectory; PgDataDirectory = $PgDataDirectory
        DefenderExclusion = $DefenderExclusion; HealthTimeoutSeconds = $HealthTimeoutSeconds
    }

    if (-not [string]::IsNullOrWhiteSpace($VerifiedRelease)) {
        # The first thing the second half does, before it loads the module from the folder: the install folder and the release are still the real,
        # locked folders that the first half left (nothing was swapped for a link, nothing is writable by anyone else).
        Assert-AccucutLockedInstallRoot -Root $Root -VerifiedRelease $VerifiedRelease
        Import-Module (Join-Path $VerifiedRelease 'AccucutOps.psm1') -Force -DisableNameChecking
        Invoke-AccucutInstall @secondHalf -PackageRoot $VerifiedRelease
        return
    }

    if (-not (Test-InstallerIsAdministrator)) {
        throw 'Run this script as an administrator: right-click Windows PowerShell, choose Run as administrator, and start it again.'
    }
    $verified = Initialize-AccucutVerifiedRelease -ZipPath $ZipPath -Sha256 $Sha256 -Root $Root
    # Checked again right before the script is started from the folder: the check at the end of the first half could have gone stale.
    Assert-AccucutLockedInstallRoot -Root $Root -VerifiedRelease $verified
    # The second half runs from the verified folder: its own copy of this script, which loads its own copy of the module.
    $verifiedScript = Join-Path $verified 'install.ps1'
    & $verifiedScript @secondHalf -VerifiedRelease $verified
    if ($LASTEXITCODE -ne 0) { throw 'The install did not finish (see the message above).' }
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        Start-AccucutInstall @PSBoundParameters
        exit 0
    }
    catch {
        $message = $_.Exception.Message
        if (Get-Command -Name Hide-AccucutSecrets -ErrorAction SilentlyContinue) { $message = Hide-AccucutSecrets -Text $message }
        Write-Host "The install stopped: $message" -ForegroundColor Red
        exit 1
    }
}
