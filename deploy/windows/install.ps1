<#
.SYNOPSIS
  Installs the Accucut Quotation Portal on a Windows Server (STORY-10.04; ADR-015 and its Amendment 2; architecture section 9.9).

.DESCRIPTION
  Run once, as an administrator, from the unpacked release zip: powershell -ExecutionPolicy Bypass -File .\install.ps1 -ZipPath <the zip> [-Sha256 <hash>].
  Needs Node.js 22 (22.12 or later, in C:\Program Files\nodejs) and PostgreSQL 17, both installed from the vendors' installers. Windows PowerShell 5.1.

  The install is in two halves, so that code is never loaded or run before it has been checked:

  First half (this script, as you started it. It is the trust anchor: no script can check itself, so start it from a folder that only administrators
  can write, and compare the zip's SHA-256 with the release page before you unpack it):
    1.  Checks that you are an administrator, the shape of -Root (exactly one folder below a fixed NTFS drive, such as C:\Accucut) and the zip's SHA-256.
        A wrong zip is refused and NOTHING has been created.
    2.  The root must not exist. Not even an empty folder is used. It is created with its permissions in one call (owner Administrators, no
        inheritance, Administrators and SYSTEM only) and then checked exactly.
    3.  Copies the zip into the locked root, checks the SHA-256 of the COPY, unpacks the copy to C:\Accucut\releases\<tag>\ and refuses any link in it.
    4.  Checks the release folder and starts the copy of this script that is in it, in a child powershell.exe. Nothing is imported or loaded here.

  Second half (the copy in the release folder, started by the first half):
    5.  Refuses to run unless it is C:\Accucut\releases\<tag>\install.ps1. Checks the root, releases, the release and the module file, and only then loads
        the shared module AccucutOps.psm1 (the only place it is loaded). Node.js, psql and PowerShell are checked and used by their full path, never
        through PATH.
    6.  Asks for the few values it cannot invent (or reads them from -ValuesFile), invents the rest, and writes
          C:\Accucut\config\.env         the settings of the app and the worker. Administrators and the two service accounts can read it.
          C:\Accucut\config\migrate.env  the owner database role's connection string and the first Admin. Administrators only.
    7.  Creates the database, the two roles (deploy\db\create-roles.psql, the same SQL as the development database), runs the migrations as the
        owner role and creates the first Admin.
    8.  Registers the services AccucutApp and AccucutWorker with WinSW 2.12.0: Automatic (Delayed Start), after PostgreSQL, restart after 10 s,
        30 s and 60 s, each as its own virtual account (NT SERVICE\<name>), never LocalSystem. Logs roll daily under C:\Accucut\logs, 30 days kept.
    9.  Offers to exclude the PostgreSQL data folder from Windows Defender real-time scanning, and says so.
    10. Starts the services and waits for /api/health to answer 200.

  Secrets: none is ever put on a command line, in a log, or in a committed file. Passwords reach psql and Node through the environment of
  that one child process. The log, C:\Accucut\logs\install-<time>.log, blanks every secret value.

  If a step fails before the services are registered, the database and roles that this run created are dropped again, the log is copied to your
  temp folder and the whole install folder that this run made is removed, so the install can be run again.

.PARAMETER ZipPath
  The release zip (required). Its SHA-256 is checked against -Sha256 or the file <zip>.sha256 next to it.
.PARAMETER Sha256
  The expected SHA-256 of the zip, if there is no .sha256 file. Type it from the release page: it is the check that cannot be faked by replacing both files.
.PARAMETER ValuesFile
  A file of NAME=value lines with the answers (see values.example.txt), for an install with no one present. Delete it afterwards.
.PARAMETER NonInteractive
  Never ask a question. A missing value that cannot be invented is an error.
.PARAMETER Root
  The install folder, exactly one folder below a drive. Default C:\Accucut. It must not exist.
.PARAMETER Port
  The port of the web app. Default 3000.
.PARAMETER ListenAddress
  The address the app listens on. Default 0.0.0.0, or 127.0.0.1 with -WithProxy.
.PARAMETER WithProxy
  A TLS proxy (Caddy, or IIS that you already run) will stand in front: the app listens on 127.0.0.1 only, and inbound TCP 80 and 443 are opened
  in Windows Firewall. The proxy itself is not installed by this script.
.PARAMETER NodeExe
  The full path of node.exe. Default C:\Program Files\nodejs\node.exe. It and its folder must be writable by administrators only.
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
  Used by the script itself, never by you: the release folder under C:\Accucut\releases that the second half runs from.
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
    [string]$NodeExe,
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
$ErrorActionPreference = 'Stop'

$script:DatabaseName = 'accucut'

# >>> ACCUCUT TRUST BLOCK v1
# One self-contained block, byte for byte the same in install.ps1 and update.ps1 (ADR-015 Amendment 2; tests/unit/windows-deploy-files.test.ts and
# deploy/windows/tests keep the copies equal). It uses .NET calls and PowerShell language features only, never a cmdlet that a module could shadow;
# the two exceptions are the module-qualified Microsoft.PowerShell.Core\Import-Module and Microsoft.PowerShell.Management\Get-Item, and the child
# powershell.exe. The shared module AccucutOps.psm1 holds NO trust function: code is never loaded or run before it has been checked here, and code is
# never checked with functions from the code being checked.
#
# Rule A, for the drive root and every folder above the root: not a link; the owner is Administrators, SYSTEM or TrustedInstaller; and no other
# account may hold DeleteChild, Delete, WriteDAC or WriteOwner (0xD0040) through an effective entry. Entries that are inherit-only are ignored (they reach
# only children, and each child is checked on its own). The drive root is held to 0xC0040 only, because Delete on a volume root can delete nothing:
# the Windows default (users may create folders and files on the root itself, Modify or Full for inherit-only) passes, GENERIC_ALL, DeleteChild,
# WriteDAC and WriteOwner do not.
# Rule B, for the root and everything checked below it, and for a program and its own folder: not a link; the owner is trusted; and every entry of
# any other account, inherit-only ones included, may hold only read and execute (0x1200A9), with one exception: an inherit-only CREATOR OWNER entry
# (no untrusted account can create a child, so CREATOR OWNER can only ever name a trusted creator; Program Files carries such an entry). CREATOR OWNER
# and OWNER RIGHTS count as ordinary accounts. The install root must also have a protected list. Generic rights are mapped before any test.
$script:AccucutTrustLog = [System.Collections.Generic.List[string]]::new()
$script:AccucutTrustedSids = @('S-1-5-32-544', 'S-1-5-18', 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
$script:AccucutRuleBAllowed = [int64]0x1200A9
$script:AccucutRuleAForbidden = [int64]0xD0040
$script:AccucutRuleAForbiddenDriveRoot = [int64]0xC0040
$script:AccucutLogsAllowed = [int64]0x1301BF
$script:AccucutTagPattern = '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'

function ConvertTo-AccucutTrustMask {
    # The access mask as a positive number with the generic rights replaced by the specific rights they stand for, and the generic bits cleared.
    [CmdletBinding()]
    param([Parameter(Mandatory)][int]$AccessMask)

    $mask = [int64][System.BitConverter]::ToUInt32([System.BitConverter]::GetBytes($AccessMask), 0)
    if (($mask -band [int64]268435456) -ne 0) { $mask = $mask -bor [int64]0x1F01FF }
    if (($mask -band [int64]1073741824) -ne 0) { $mask = $mask -bor [int64]0x120116 }
    if (($mask -band [int64]2147483648) -ne 0) { $mask = $mask -bor [int64]0x120089 }
    if (($mask -band [int64]536870912) -ne 0) { $mask = $mask -bor [int64]0x1200A0 }
    return ($mask -band [int64]0x0FFFFFFF)
}

function Get-AccucutTrustSecurity {
    # The only reader of file and folder security (and the Pester mock point). The attributes come from File.GetAttributes, which does not follow a link.
    # A null list and any entry that is not a plain allow or deny entry (an object, callback or compound entry) are refused.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $attributes = [System.IO.File]::GetAttributes($Path)
    $isDirectory = (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0)
    $sections = [System.Security.AccessControl.AccessControlSections]::Owner -bor [System.Security.AccessControl.AccessControlSections]::Access
    if ($isDirectory) { $security = [System.IO.Directory]::GetAccessControl($Path, $sections) } else { $security = [System.IO.File]::GetAccessControl($Path, $sections) }
    $descriptor = [System.Security.AccessControl.RawSecurityDescriptor]::new($security.GetSecurityDescriptorBinaryForm(), 0)
    return (ConvertFrom-AccucutTrustDescriptor -Descriptor $descriptor -Path $Path -Attributes $attributes)
}

function ConvertFrom-AccucutTrustDescriptor {
    # A security descriptor as plain data (owner, protected flag, link flag, and every entry with its mask after generic mapping). Split from the reader
    # so that a test can feed it a descriptor built from SDDL, including a null list and entries of the kinds that are refused.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][System.Security.AccessControl.RawSecurityDescriptor]$Descriptor,
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][System.IO.FileAttributes]$Attributes
    )

    $descriptor = $Descriptor
    $attributes = $Attributes
    $isDirectory = (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0)
    if ($null -eq $descriptor.Owner) { throw "'$Path' has no owner. Refusing to use it." }
    if ($null -eq $descriptor.DiscretionaryAcl) { throw "'$Path' has no access list, so everyone has full access. Refusing to use it." }
    $aces = [System.Collections.Generic.List[object]]::new()
    foreach ($ace in $descriptor.DiscretionaryAcl) {
        $common = $ace -as [System.Security.AccessControl.CommonAce]
        if ($null -eq $common -or $common.IsCallback) { throw "'$Path' has an access entry of a kind that is not understood (object, callback or compound). Refusing to use it." }
        $allow = ($common.AceQualifier -eq [System.Security.AccessControl.AceQualifier]::AccessAllowed)
        $deny = ($common.AceQualifier -eq [System.Security.AccessControl.AceQualifier]::AccessDenied)
        if (-not ($allow -or $deny)) { throw "'$Path' has an access entry of a kind that is not understood. Refusing to use it." }
        $aces.Add([pscustomobject]@{
                Sid         = $common.SecurityIdentifier.Value
                Allow       = $allow
                Mask        = (ConvertTo-AccucutTrustMask -AccessMask $common.AccessMask)
                InheritOnly = ((([int]$common.AceFlags) -band 8) -ne 0)
                Inherited   = ((([int]$common.AceFlags) -band 16) -ne 0)
                Flags       = [int]$common.AceFlags
            })
    }
    return [pscustomobject]@{
        Path        = $Path
        Owner       = $descriptor.Owner.Value
        Protected   = ((([int]$descriptor.ControlFlags) -band 4096) -ne 0)
        Reparse     = (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
        IsDirectory = $isDirectory
        Aces        = $aces.ToArray()
    }
}

function Get-AccucutTrustComponent {
    # Every part of a full local path, from the drive root down to the path itself.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    if ($Path.StartsWith('\\') -or $Path.StartsWith('\\?\') -or -not [System.IO.Path]::IsPathRooted($Path) -or (@($Path.Split([char[]]@('/', '\'))) -contains '..')) { throw "'$Path' is not a full local path. Refusing to use it." }
    $full = [System.IO.Path]::GetFullPath($Path)
    $driveRoot = [System.IO.Path]::GetPathRoot($full)
    if ($driveRoot.Length -ne 3 -or $driveRoot[1] -ne [char]':') { throw "'$Path' is not on a local drive. Refusing to use it." }
    $parts = [System.Collections.Generic.List[string]]::new()
    $parts.Add($driveRoot)
    $current = $driveRoot
    foreach ($segment in $full.Substring($driveRoot.Length).Split([char]'\')) {
        if ($segment.Length -eq 0) { continue }
        $current = [System.IO.Path]::Combine($current, $segment)
        $parts.Add($current)
    }
    return $parts.ToArray()
}

function Assert-AccucutTrustedAbove {
    # Rule A for one folder above the root (or the drive root).
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [switch]$DriveRoot
    )

    $security = Get-AccucutTrustSecurity -Path $Path
    if ($security.Reparse) { throw "'$Path' is a link, not a real folder, so what is under it could lead somewhere else. Refusing to use it." }
    if ($script:AccucutTrustedSids -notcontains $security.Owner) { throw "'$Path' is owned by $($security.Owner), not by Administrators, SYSTEM or TrustedInstaller, so someone else controls it. Refusing to use it." }
    $forbidden = $script:AccucutRuleAForbidden
    if ($DriveRoot) { $forbidden = $script:AccucutRuleAForbiddenDriveRoot }
    foreach ($ace in $security.Aces) {
        if (-not $ace.Allow -or $ace.InheritOnly -or ($script:AccucutTrustedSids -contains $ace.Sid)) { continue }
        if (($ace.Mask -band $forbidden) -ne 0) {
            throw "'$Path' can be deleted, replaced or taken over by $($ace.Sid) (mask 0x$('{0:X}' -f $ace.Mask), inherited: $($ace.Inherited)), who is not an administrator. Refusing to use it."
        }
    }
}

function Assert-AccucutTrustedBelow {
    # Rule B for one folder or file at or below the root.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [switch]$ProtectedRoot,
        [string[]]$Writer = @()
    )

    $security = Get-AccucutTrustSecurity -Path $Path
    if ($security.Reparse) { throw "'$Path' is a link, not a real file or folder, so it could lead somewhere else. Refusing to use it." }
    if ($script:AccucutTrustedSids -notcontains $security.Owner) { throw "'$Path' is owned by $($security.Owner), not by Administrators, SYSTEM or TrustedInstaller, so someone else controls it. Refusing to use it." }
    if ($ProtectedRoot -and -not $security.Protected) { throw "'$Path' inherits its permissions from the folder above it. Refusing to use it." }
    foreach ($ace in $security.Aces) {
        if (-not $ace.Allow -or ($script:AccucutTrustedSids -contains $ace.Sid)) { continue }
        if ($ace.InheritOnly -and $ace.Sid -eq 'S-1-3-0') { continue }
        $allowed = $script:AccucutRuleBAllowed
        if ($Writer -contains $ace.Sid) { $allowed = $script:AccucutLogsAllowed }
        if (($ace.Mask -band (-bnot $allowed)) -ne 0) {
            throw "'$Path' can be changed by $($ace.Sid) (mask 0x$('{0:X}' -f $ace.Mask), inherited: $($ace.Inherited), inherit-only: $($ace.InheritOnly)), who is not an administrator. Refusing to use it."
        }
    }
}

function Assert-AccucutTrustedPath {
    # Walks every part of Path from the drive root: Rule A above Root, Rule B from Root down. Path must be Root or below it. -Writer (SIDs) is for the
    # logs folder only. The checked path is written to the trust log, so a test can see that every load and run was checked first.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Root,
        [string[]]$Writer = @(),
        [switch]$ProtectedRoot
    )

    $rootParts = @(Get-AccucutTrustComponent -Path $Root)
    $parts = @(Get-AccucutTrustComponent -Path $Path)
    $rootFull = $rootParts[$rootParts.Count - 1]
    $full = $parts[$parts.Count - 1]
    if (-not ($full.Equals($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($rootFull.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase))) {
        throw "'$full' is not inside '$rootFull'. Refusing to use it."
    }
    $rootIndex = $rootParts.Count - 1
    for ($index = 0; $index -lt $parts.Count; $index++) {
        $part = $parts[$index]
        if ($index -lt $rootIndex) {
            Assert-AccucutTrustedAbove -Path $part -DriveRoot:($index -eq 0)
        }
        else {
            $writers = @()
            if ($index -eq $parts.Count - 1) { $writers = $Writer }
            Assert-AccucutTrustedBelow -Path $part -ProtectedRoot:($ProtectedRoot -and $index -eq $rootIndex) -Writer $writers
        }
    }
    $script:AccucutTrustLog.Add("check:$full")
}

function Assert-AccucutTrustedRootShape {
    # Exactly X:\Name (one level below a drive root, letters, digits, underscore and dash) on a fixed NTFS drive.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Root)

    if ($Root -notmatch '^[A-Za-z]:\\[A-Za-z0-9_-]{1,32}$') { throw "The install folder '$Root' must be exactly one folder below a drive, such as C:\Accucut (letters, digits, underscore and dash, at most 32). Nothing was changed." }
    $drive = [System.IO.DriveInfo]::new($Root.Substring(0, 3))
    if (-not $drive.IsReady -or $drive.DriveType -ne [System.IO.DriveType]::Fixed -or $drive.DriveFormat -ne 'NTFS') {
        throw "The drive of '$Root' must be a fixed NTFS drive. Nothing was changed."
    }
}

function New-AccucutTrustedRoot {
    # The install root must not exist. It is created with its security in one call (owner Administrators, protected list, Administrators and SYSTEM
    # with full control and nothing else), and then checked exactly. If someone made the folder first, CreateDirectory returns theirs, the check
    # refuses it, and nothing of theirs is removed.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Root)

    Assert-AccucutTrustedRootShape -Root $Root
    $driveRoot = [System.IO.Path]::GetPathRoot($Root)
    Assert-AccucutTrustedAbove -Path $driveRoot -DriveRoot
    $exists = $true
    try { [void][System.IO.File]::GetAttributes($Root) } catch [System.IO.FileNotFoundException] { $exists = $false } catch [System.IO.DirectoryNotFoundException] { $exists = $false }
    if ($exists) { throw "'$Root' already exists. The install only makes a folder of its own, and never uses an existing one, empty or not. Nothing was changed. If it is an earlier install, use update.ps1; otherwise rename or delete it, or choose another -Root." }

    $administrators = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)
    $system = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
    $security = [System.Security.AccessControl.DirectorySecurity]::new()
    $security.SetOwner($administrators)
    $security.SetAccessRuleProtection($true, $false)
    $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    foreach ($sid in @($administrators, $system)) {
        $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, [System.Security.AccessControl.FileSystemRights]::FullControl, $inherit, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow))
    }
    [void][System.IO.Directory]::CreateDirectory($Root, $security)

    $actual = Get-AccucutTrustSecurity -Path $Root
    $sids = [System.Collections.Generic.List[string]]::new()
    foreach ($ace in $actual.Aces) { $sids.Add($ace.Sid) }
    $sids.Sort([System.StringComparer]::Ordinal)
    $exact =(-not $actual.Reparse) -and $actual.IsDirectory -and $actual.Protected -and ($actual.Owner -eq 'S-1-5-32-544') -and ($actual.Aces.Count -eq 2) -and (($sids -join ';') -eq 'S-1-5-18;S-1-5-32-544')
    foreach ($ace in $actual.Aces) { if (-not $ace.Allow -or $ace.InheritOnly -or $ace.Inherited -or $ace.Mask -ne [int64]0x1F01FF) { $exact = $false } }
    if (-not $exact) { throw "'$Root' was not created as expected (owner, protection and the two entries are checked exactly). It is not used, and nothing in it was removed. Someone may have made it first." }
    if ([System.IO.Directory]::GetFileSystemEntries($Root).Length -ne 0) { throw "'$Root' is not empty. It is not used, and nothing in it was removed." }
    $script:AccucutTrustLog.Add("check:$Root")
}

function Get-AccucutTrustedSha256 {
    # SHA-256 over a stream opened with FileShare.Read, so no writer can change the file while it is read.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $stream = [System.IO.FileStream]::new($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $bytes = $sha.ComputeHash($stream) } finally { $sha.Dispose() }
    }
    finally { $stream.Dispose() }
    return ([System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant())
}

function Remove-AccucutTrustedTree {
    # Deletes one folder tree with `rd /s /q` on a \\?\ path (node_modules is deeper than 260 characters). Only a folder strictly inside -Within, or -Within
    # itself when -IncludeWithin is given (the install root that this run made).
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Within,
        [switch]$IncludeWithin
    )

    $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
    $base = [System.IO.Path]::GetFullPath($Within).TrimEnd('\')
    $isBase = $full.Equals($base, [System.StringComparison]::OrdinalIgnoreCase)
    if (-not ($full.StartsWith($base + '\', [System.StringComparison]::OrdinalIgnoreCase) -or ($isBase -and $IncludeWithin))) { throw "Refusing to delete '$full': it is not inside '$base'." }
    try { [void][System.IO.File]::GetAttributes($full) } catch { return }
    $info = [System.Diagnostics.ProcessStartInfo]::new([System.IO.Path]::Combine($env:SystemRoot, 'System32\cmd.exe'), '/c rd /s /q "\\?\' + $full + '"')
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $process = [System.Diagnostics.Process]::Start($info)
    $process.WaitForExit()
    $code = $process.ExitCode
    $process.Dispose()
    if ($code -ne 0) { throw "'$full' could not be deleted (exit code $code)." }
}

function Assert-AccucutTrustedNoLinks {
    # Refuses any link (reparse point) in a tree. Walks by hand, so it never follows one.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $pending = [System.Collections.Generic.Stack[string]]::new()
    $pending.Push($Path)
    while ($pending.Count -gt 0) {
        $folder = $pending.Pop()
        if (([System.IO.File]::GetAttributes($folder) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "'$folder' is a link. Refusing to use '$Path'." }
        foreach ($entry in [System.IO.Directory]::GetFileSystemEntries($folder)) {
            $attributes = [System.IO.File]::GetAttributes($entry)
            if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "'$entry' is a link. Refusing to use '$Path'." }
            if (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) { $pending.Push($entry) }
        }
    }
}

function Expand-AccucutTrustedPackage {
    # Steps of the install and the update that turn a zip into a release folder: copy the zip into the locked root (CreateNew), check the COPY with Rule B and
    # its SHA-256, unpack from that copy, refuse any entry that leaves the folder, move the result to releases\<tag>, refuse any link in it, and delete the
    # scratch folder. With -ReplaceExisting an existing release folder of that tag is deleted and unpacked again (it is never reused).
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$ZipPath,
        [Parameter(Mandatory)][string]$Sha256,
        [string]$RefuseTag,
        [switch]$ReplaceExisting
    )

    $expected = $Sha256.ToLowerInvariant()
    $scratch = [System.IO.Path]::Combine($Root, '.in')
    $work = [System.IO.Path]::Combine($scratch, [System.Guid]::NewGuid().ToString('N'))
    [void][System.IO.Directory]::CreateDirectory($scratch)
    [void][System.IO.Directory]::CreateDirectory($work)
    try {
    $copy = [System.IO.Path]::Combine($work, 'package.zip')
    $source = [System.IO.FileStream]::new($ZipPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    try {
        $target = [System.IO.FileStream]::new($copy, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try { $source.CopyTo($target) } finally { $target.Dispose() }
    }
    finally { $source.Dispose() }
    Assert-AccucutTrustedPath -Path $copy -Root $Root -ProtectedRoot
    $actual = Get-AccucutTrustedSha256 -Path $copy
    if ($actual -ne $expected) { throw "The SHA-256 of the copy of the zip does not match (expected $expected, the copy is $actual). The file changed while it was being copied. Nothing was installed." }

    [void][System.Reflection.Assembly]::Load('System.IO.Compression.FileSystem, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089')
    $unpacked = [System.IO.Path]::Combine($work, 'x')
    [void][System.IO.Directory]::CreateDirectory($unpacked)
    $unpackedPrefix = [System.IO.Path]::GetFullPath($unpacked).TrimEnd('\') + '\'
    $archive = [System.IO.Compression.ZipFile]::OpenRead($copy)
    try {
        foreach ($entry in $archive.Entries) {
            $name = $entry.FullName
            if ($name.StartsWith('/') -or $name.StartsWith('\') -or $name.Contains(':') -or (@($name.Split([char[]]@('/', '\'))) -contains '..')) { throw "The zip holds an entry that is not a plain relative path ('$name'). Refusing to unpack it." }
            $destination = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($unpacked, $name.Replace('/', '\')))
            if (-not $destination.StartsWith($unpackedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw "The zip holds an entry outside its folder ('$name'). Refusing to unpack it." }
            if ($name.EndsWith('/') -or $name.EndsWith('\')) { [void][System.IO.Directory]::CreateDirectory($destination); continue }
            [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination))
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $false)
        }
    }
    finally { $archive.Dispose() }

    $infoFile = [System.IO.Path]::Combine($unpacked, 'release.json')
    if (-not [System.IO.File]::Exists($infoFile)) { throw 'The zip has no release.json: it is not an Accucut release package.' }
    $match = [regex]::Match([System.IO.File]::ReadAllText($infoFile), '"tag"\s*:\s*"([^"]+)"')
    if (-not $match.Success -or $match.Groups[1].Value -notmatch $script:AccucutTagPattern) { throw 'release.json has no valid tag (letters, digits, dot, dash and underscore only).' }
    $tag = $match.Groups[1].Value
    if ($RefuseTag -and $tag -eq $RefuseTag) { throw "Release $tag is already the running release. Nothing was changed." }
    $releases = [System.IO.Path]::Combine($Root, 'releases')
    [void][System.IO.Directory]::CreateDirectory($releases)
    $release = [System.IO.Path]::Combine($releases, $tag)
    $exists = $true
    try { [void][System.IO.File]::GetAttributes($release) } catch { $exists = $false }
    if ($exists) {
        if (-not $ReplaceExisting) { throw "A release folder named '$tag' already exists. Nothing was changed." }
        Remove-AccucutTrustedTree -Path $release -Within $releases
    }
    [System.IO.Directory]::Move($unpacked, $release)
    Assert-AccucutTrustedNoLinks -Path $release
    Remove-AccucutTrustedTree -Path $work -Within $scratch
    return $release
    }
    catch {
        try { Remove-AccucutTrustedTree -Path $work -Within $scratch } catch { $null = $_ }
        throw
    }
}

function Get-AccucutTrustedCurrent {
    # <Root>\current must be a junction whose target is exactly <Root>\releases\<tag>. This is the only place a link is accepted.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Root)

    $current = [System.IO.Path]::Combine($Root, 'current')
    $item = Microsoft.PowerShell.Management\Get-Item -LiteralPath $current -Force
    if ($item.LinkType -ne 'Junction') { throw "'$current' is not a junction. Refusing to use the install." }
    $target = [System.IO.Path]::GetFullPath(@($item.Target)[0]).TrimEnd('\')
    $releases = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, 'releases')).TrimEnd('\')
    $tag = [System.IO.Path]::GetFileName($target)
    if ($tag -notmatch $script:AccucutTagPattern -or -not [System.IO.Path]::Combine($releases, $tag).Equals($target, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "'$current' points at '$target', which is not a release folder directly inside '$releases'. Refusing to use the install."
    }
    return $target
}

function Resolve-AccucutTrustedExecutable {
    # A native program by its full path, never through PATH. The program and its own folder get Rule B (Windows looks in that folder first for DLLs),
    # and every folder above it gets Rule A.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    if (-not [System.IO.Path]::IsPathRooted($Path) -or $Path.StartsWith('\\')) { throw "'$Path' is not a full path. A program is never looked up through PATH." }
    $full = [System.IO.Path]::GetFullPath($Path)
    if (-not [System.IO.File]::Exists($full)) { throw "The program '$full' was not found." }
    Assert-AccucutTrustedPath -Path $full -Root ([System.IO.Path]::GetDirectoryName($full))
    return $full
}

function Import-AccucutTrustedModule {
    # The only place the shared module is loaded: after the module file, the release folder, releases and the root have been checked.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Release
    )

    $module = [System.IO.Path]::Combine($Release, 'AccucutOps.psm1')
    Assert-AccucutTrustedPath -Path $module -Root $Root -ProtectedRoot
    $script:AccucutTrustLog.Add("load:$([System.IO.Path]::GetFullPath($module))")
    Microsoft.PowerShell.Core\Import-Module -Name $module -Force -DisableNameChecking
}

function ConvertTo-AccucutTrustedArgument {
    [CmdletBinding()]
    param([AllowEmptyString()][string]$Value)

    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') { return $Value }
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function Invoke-AccucutTrustedScript {
    # Runs a script of the release in a child powershell.exe, after the program and the script have been checked. Returns the exit code.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Path,
        [string[]]$ArgumentList = @()
    )

    $powershell = Resolve-AccucutTrustedExecutable -Path ([System.IO.Path]::Combine($env:SystemRoot, 'System32\WindowsPowerShell\v1.0\powershell.exe'))
    Assert-AccucutTrustedPath -Path $Path -Root $Root -ProtectedRoot
    $script:AccucutTrustLog.Add("run:$([System.IO.Path]::GetFullPath($Path))")
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File ' + (ConvertTo-AccucutTrustedArgument -Value $Path)
    foreach ($argument in $ArgumentList) { $arguments += ' ' + (ConvertTo-AccucutTrustedArgument -Value $argument) }
    $info = [System.Diagnostics.ProcessStartInfo]::new($powershell, $arguments)
    $info.UseShellExecute = $false
    $process = [System.Diagnostics.Process]::Start($info)
    $process.WaitForExit()
    $code = $process.ExitCode
    $process.Dispose()
    return $code
}
# <<< ACCUCUT TRUST BLOCK v1

# ---- Outside the trust block. Nothing below loads or runs code except through Import-AccucutTrustedModule and Invoke-AccucutTrustedScript.

function Test-AccucutScriptAdministrator {
    # True when this process runs elevated. A function of its own, so that Pester can mock it.
    [CmdletBinding()]
    param()

    $principal = [System.Security.Principal.WindowsPrincipal]::new([System.Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-AccucutExpectedSha256 {
    # The hash the zip must have: -Sha256, or the first token of <zip>.sha256 next to it (a hint against corruption only; a hash typed from the
    # release page is what stops someone who can replace both files).
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ZipPath,
        [string]$Sha256
    )

    $expected = $Sha256
    if ([string]::IsNullOrWhiteSpace($expected)) {
        $checksumFile = "$ZipPath.sha256"
        if (-not [System.IO.File]::Exists($checksumFile)) { throw "No SHA-256 given: pass -Sha256, or keep '$([System.IO.Path]::GetFileName($checksumFile))' next to the zip." }
        $first = @([System.IO.File]::ReadAllLines($checksumFile))[0]
        $expected = ($first.Trim() -split '\s+')[0]
    }
    if ($expected -notmatch '^[0-9A-Fa-f]{64}$') { throw 'The expected SHA-256 is not 64 hexadecimal characters.' }
    return $expected.ToLowerInvariant()
}

function Assert-AccucutSecondHalfLocation {
    # The second half runs only as <Root>\releases\<tag>\install.ps1, with -VerifiedRelease <Root>\releases\<tag>. A start by hand from anywhere else
    # stops here, before anything is loaded.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$VerifiedRelease,
        [Parameter(Mandatory)][string]$ScriptPath
    )

    $releases = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, 'releases')).TrimEnd('\')
    $release = [System.IO.Path]::GetFullPath($VerifiedRelease).TrimEnd('\')
    $tag = [System.IO.Path]::GetFileName($release)
    if ($tag -notmatch $script:AccucutTagPattern -or -not [System.IO.Path]::Combine($releases, $tag).Equals($release, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "'$VerifiedRelease' is not a release folder directly inside '$releases'. The second half of the install is started by the first half only. Nothing was changed."
    }
    $expectedScript = [System.IO.Path]::Combine($release, 'install.ps1')
    if (-not [System.IO.Path]::GetFullPath($ScriptPath).Equals($expectedScript, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "This script is '$ScriptPath', not '$expectedScript'. The second half of the install runs from the release folder only. Nothing was changed."
    }
}

function Invoke-AccucutInstallFirstHalf {
    # Steps 1 to 4 of the description: only the trust block and this script's own code run.
    [CmdletBinding()]
    param(
        [string]$ZipPath,
        [string]$Sha256,
        [Parameter(Mandatory)][string]$Root,
        [string[]]$ChildArgument = @()
    )

    if (-not (Test-AccucutScriptAdministrator)) { throw 'Run this script as an administrator: right-click Windows PowerShell, choose Run as administrator, and start it again.' }
    if ([string]::IsNullOrWhiteSpace($ZipPath)) { throw 'Give the release zip: install.ps1 -ZipPath <the release zip>. Its SHA-256 is checked first.' }
    Assert-AccucutTrustedRootShape -Root $Root
    if (-not [System.IO.File]::Exists($ZipPath)) { throw "The zip '$ZipPath' was not found." }
    $expected = Get-AccucutExpectedSha256 -ZipPath $ZipPath -Sha256 $Sha256
    $actual = Get-AccucutTrustedSha256 -Path $ZipPath
    if ($actual -ne $expected) { throw "The SHA-256 of the zip does not match (expected $expected, the file is $actual). Nothing was created. Download the release again." }
    Write-Host "SHA-256 of $([System.IO.Path]::GetFileName($ZipPath)) matches."

    New-AccucutTrustedRoot -Root $Root
    try {
        $release = Expand-AccucutTrustedPackage -Root $Root -ZipPath $ZipPath -Sha256 $expected
        $code = Invoke-AccucutTrustedScript -Root $Root -Path ([System.IO.Path]::Combine($release, 'install.ps1')) -ArgumentList (@('-VerifiedRelease', $release) + $ChildArgument)
    }
    catch {
        # Nothing was installed yet, and the root is the one this run made: remove it so that the install can be run again.
        try { Remove-AccucutTrustedTree -Path $Root -Within $Root -IncludeWithin } catch { Write-Host "The install folder '$Root' could not be removed: $($_.Exception.Message). Delete it by hand before running the install again." -ForegroundColor Yellow }
        throw
    }
    if ($code -ne 0) { throw 'The install did not finish (see the message above).' }
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
    # The second half (steps 6 to 10), after the trust checks and the module load. -Release is <Root>\releases\<tag>, checked by the caller.
    [CmdletBinding()]
    param(
        [string]$ValuesFile,
        [switch]$NonInteractive,
        [Parameter(Mandatory)][string]$Root,
        [ValidateRange(1, 65535)][int]$Port = 3000,
        [string]$ListenAddress,
        [switch]$WithProxy,
        [string]$NodeExe,
        [string]$PgHost = '127.0.0.1',
        [ValidateRange(1, 65535)][int]$PgPort = 5432,
        [string]$PgSuperuser = 'postgres',
        [string]$PgBinDirectory,
        [string]$PgDataDirectory,
        [ValidateSet('Ask', 'Yes', 'No')][string]$DefenderExclusion = 'Ask',
        [ValidateRange(10, 1800)][int]$HealthTimeoutSeconds = 180,
        [Parameter(Mandatory)][string]$Release
    )

    $paths = Get-AccucutPaths -Root $Root
    $releaseInfo = Read-AccucutReleaseInfo -PackageRoot $Release
    $tag = [string]$releaseInfo.tag
    $logFile = [System.IO.Path]::Combine($paths.Logs, "install-$((Get-Date).ToString('yyyyMMdd-HHmmss')).log")
    $connection = $null
    $psql = $null
    $created = @{ Database = $false; Roles = $false }
    try {
        # Programs by their full path, checked before they are run (never through PATH).
        if ([string]::IsNullOrWhiteSpace($NodeExe)) { $NodeExe = [System.IO.Path]::Combine($env:ProgramFiles, 'nodejs\node.exe') }
        $nodeExe = Resolve-AccucutTrustedExecutable -Path $NodeExe
        $nodeCheck = Test-AccucutNodeVersion -VersionText (Invoke-AccucutNative -FilePath $nodeExe -ArgumentList @('--version') -AllowFailure).Output
        if (-not $nodeCheck.Ok) { throw $nodeCheck.Message }
        $postgres = Get-AccucutPostgresInstall -BinDirectory $PgBinDirectory -DataDirectory $PgDataDirectory
        $psql = Resolve-AccucutTrustedExecutable -Path ([System.IO.Path]::Combine($postgres.BinDirectory, 'psql.exe'))
        $psqlCheck = Test-AccucutPostgresVersion -VersionText (Invoke-AccucutNative -FilePath $psql -ArgumentList @('--version')).Output
        if (-not $psqlCheck.Ok) { throw $psqlCheck.Message }
        if ($null -ne (Get-Service -Name (Get-AccucutServiceNames) -ErrorAction SilentlyContinue)) {
            throw 'The services of an Accucut install already exist on this server. To install a new release, run update.ps1. Nothing was changed.'
        }

        # The values. Asked for before anything is created, so a typing slip costs nothing.
        $template = Read-AccucutEnvTemplate -Path ([System.IO.Path]::Combine($Release, '.env.example'))
        $settings = Get-AccucutInstallSettings -Template $template -ValuesFile $ValuesFile -NonInteractive:$NonInteractive -Port $Port -PgHost $PgHost -PgPort $PgPort -DatabaseName $script:DatabaseName
        Register-AccucutSecret -Value $settings.PgSuperuserPassword
        $envLines = Split-AccucutEnvValues -Template $template -Values $settings.Values
        $effectiveListen = $ListenAddress
        if ([string]::IsNullOrWhiteSpace($effectiveListen)) { if ($WithProxy) { $effectiveListen = '127.0.0.1' } else { $effectiveListen = '0.0.0.0' } }

        # The folders made here inherit the locked root: no entry for anyone else. The service accounts are added when the services exist.
        foreach ($directory in @($paths.Config, $paths.Services, $paths.Logs)) { [void][System.IO.Directory]::CreateDirectory($directory) }
        Write-AccucutLog -Message "Installing Accucut release $tag under '$($paths.Root)'. $($nodeCheck.Message). $($psqlCheck.Message)." -LogFile $logFile
        $connection = @{ Host = $PgHost; Port = $PgPort; User = $PgSuperuser; Password = $settings.PgSuperuserPassword }

        Set-AccucutCurrentRelease -Paths $paths -Tag $tag
        Write-AccucutLog -Message "Release folder: $Release (current -> $tag)." -LogFile $logFile

        # The settings files. Created empty, locked, then filled.
        Write-AccucutSecureFile -Path $paths.MigrateEnvFile -Line $envLines.Migrate
        Write-AccucutSecureFile -Path $paths.EnvFile -Line $envLines.Runtime
        Write-AccucutLog -Message "Settings written: $($paths.EnvFile) and $($paths.MigrateEnvFile) (no value is shown here)." -LogFile $logFile

        # The database: refuse an existing one, create it and the two roles.
        $existing = Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database 'postgres' -Command "SELECT count(*) FROM pg_database WHERE datname = '$($script:DatabaseName)'"
        if ($existing -ne '0') { throw "A database named '$($script:DatabaseName)' already exists in this PostgreSQL. This script never touches existing data. If it is an empty leftover of an earlier try, drop it and the roles accucut_app and accucut_owner, then run this again." }
        $roleCount = Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database 'postgres' -Command "SELECT count(*) FROM pg_roles WHERE rolname IN ('accucut_app', 'accucut_owner')"
        if ($roleCount -ne '0') { throw 'The database roles accucut_app or accucut_owner already exist in this PostgreSQL. This script never touches existing roles. Remove them if they are leftovers, then run this again.' }
        $serverCheck = Test-AccucutPostgresVersion -VersionText (Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database 'postgres' -Command 'SHOW server_version_num')
        if (-not $serverCheck.Ok) { throw "The PostgreSQL server is not version 17. $($serverCheck.Message)" }
        [void](Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database 'postgres' -Command "CREATE DATABASE `"$($script:DatabaseName)`" ENCODING 'UTF8' TEMPLATE template0")
        $created.Database = $true
        $created.Roles = $true
        [void](Invoke-AccucutPsql -PsqlPath $psql -Connection $connection -Database $script:DatabaseName -File ([System.IO.Path]::Combine($Release, 'sql\create-roles.psql')) -ExtraEnvironment @{
                DB_OWNER_PASSWORD = $settings.OwnerPassword
                DB_APP_PASSWORD   = $settings.AppPassword
                POSTGRES_DB       = $script:DatabaseName
            })
        Write-AccucutLog -Message "Database '$($script:DatabaseName)' and the roles accucut_owner and accucut_app created." -LogFile $logFile

        # Migrations as the owner role, ensure-seed-version, then the first Admin as the runtime role.
        $migration = Invoke-AccucutMigration -ReleaseDirectory $Release -NodeExe $nodeExe -MigrateDatabaseUrl $settings.Values['MIGRATE_DATABASE_URL']
        Write-AccucutLog -Message "Migrations: $($migration.Deploy)" -LogFile $logFile
        Write-AccucutLog -Message "Seed: $($migration.Seed)" -LogFile $logFile
        $adminResult = Invoke-AccucutNative -FilePath $nodeExe -WorkingDirectory ([System.IO.Path]::Combine($Release, 'app')) -ArgumentList @('bootstrap-admin.mjs') -Environment @{
            DATABASE_URL           = $settings.Values['DATABASE_URL']
            ADMIN_EMAIL            = $settings.Values['ADMIN_EMAIL']
            ADMIN_INITIAL_PASSWORD = $settings.Values['ADMIN_INITIAL_PASSWORD']
            NODE_ENV               = 'production'
        }
        Write-AccucutLog -Message $adminResult.Output -LogFile $logFile
        # The first Admin's password is read once. It is removed from migrate.env now.
        Write-AccucutSecureFile -Path $paths.MigrateEnvFile -Line @($envLines.Migrate | Where-Object { $_ -notmatch '^ADMIN_INITIAL_PASSWORD=' })

        # The services (WinSW), each as its own virtual account. Each program is checked before it is run, and never started before the account is set.
        [void](Initialize-AccucutServiceFiles -Paths $paths -ReleaseDirectory $Release -NodeExe $nodeExe -Port $Port -ListenAddress $effectiveListen)
        foreach ($name in (Get-AccucutServiceNames)) {
            $winsw = Resolve-AccucutTrustedExecutable -Path ([System.IO.Path]::Combine($paths.Services, "$name.exe"))
            [void](Invoke-AccucutNative -FilePath $winsw -ArgumentList @('install'))
            Set-AccucutServiceIdentity -Name $name
        }
        Write-AccucutLog -Message "Services registered: $((Get-AccucutServiceNames) -join ', ') (Automatic, Delayed Start, own virtual account, after $(Get-AccucutPostgresServiceName))." -LogFile $logFile

        # Access for the service accounts, now that they exist (by SID computed from the service name). Read and execute on the root, Modify on logs.
        $accounts = @(Get-AccucutServiceNames | ForEach-Object { Get-AccucutServiceSid -Name $_ })
        foreach ($account in $accounts) { Grant-AccucutFolderAccess -Path $paths.Root -Account $account -Rights ReadAndExecute }
        foreach ($account in $accounts) { Grant-AccucutFolderAccess -Path $paths.Logs -Account $account -Rights Modify }
        Set-AccucutFileAcl -Path $paths.EnvFile -ReadAccount $accounts

        # Logs: 30 days kept; Defender; firewall; the backup task (STORY-10.05 adds its script).
        [void](Remove-AccucutOldLogs -Path $paths.Logs -KeepDays 30)
        Register-AccucutLogCleanupTask -Paths $paths
        [void](Set-AccucutDefenderExclusion -Path $postgres.DataDirectory -Decision $DefenderExclusion -NonInteractive:$NonInteractive -LogFile $logFile)
        if ($WithProxy) {
            if ($null -eq (Get-NetFirewallRule -DisplayName 'Accucut web (80, 443)' -ErrorAction SilentlyContinue)) {
                New-NetFirewallRule -DisplayName 'Accucut web (80, 443)' -Direction Inbound -Protocol TCP -LocalPort 80, 443 -Action Allow | Out-Null
            }
            Write-AccucutLog -Message 'Firewall: inbound TCP 80 and 443 are open for the proxy. The app itself listens on 127.0.0.1 only. The proxy is yours to install.' -LogFile $logFile
        }
        $backupTask = [System.IO.Path]::Combine($Release, 'register-backup-task.ps1')
        if ([System.IO.File]::Exists($backupTask)) {
            if ((Invoke-AccucutTrustedScript -Root $Root -Path $backupTask -ArgumentList @('-Root', $Root)) -ne 0) { throw 'register-backup-task.ps1 failed.' }
        }
        else { Write-AccucutLog -Message 'The weekly backup task is added by the backup release (STORY-10.05); this release has none yet.' -Level Warning -LogFile $logFile }

        # Start, and wait for the health check.
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
        [System.IO.File]::WriteAllText($paths.StateFile, ($state | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
    }
    catch {
        Write-AccucutLog -Message "INSTALL FAILED: $($_.Exception.Message)" -Level Error -LogFile $logFile
        # Only while the services are not registered: after that the database is in use and the folders are left for IT to look at.
        if ($null -eq (Get-Service -Name (Get-AccucutServiceNames) -ErrorAction SilentlyContinue)) {
            if ($created.Database -or $created.Roles) {
                Undo-AccucutInstallDatabase -PsqlPath $psql -Connection $connection -Created $created -DatabaseName $script:DatabaseName -LogFile $logFile
            }
            Remove-AccucutInstallRoot -Root $Root -LogFile $logFile
        }
        throw
    }
    Write-AccucutLog -Message "Done. Open $($settings.Values['APP_ORIGIN']) and sign in as $($settings.Values['ADMIN_EMAIL']) with the first password; you will be asked to choose a new one." -LogFile $logFile
    Write-AccucutLog -Message "Install log: $logFile. If you used a values file, delete it now: it holds the first password." -LogFile $logFile
}

function Remove-AccucutInstallRoot {
    # After a failed install, before any service exists: copies the log to the temp folder of the person who ran the script, and removes the whole
    # install folder that this run made, so that the install can be run again (an existing root is always refused).
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [string]$LogFile
    )

    try {
        if ($LogFile -and [System.IO.File]::Exists($LogFile)) {
            $kept = [System.IO.Path]::Combine($env:TEMP, 'accucut-failed-' + [System.IO.Path]::GetFileName($LogFile))
            [System.IO.File]::Copy($LogFile, $kept, $true)
            Write-Host "The install log was kept: $kept"
        }
        $current = [System.IO.Path]::Combine($Root, 'current')
        if ([System.IO.Directory]::Exists($current) -and (([System.IO.File]::GetAttributes($current) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { [System.IO.Directory]::Delete($current, $false) }
        Remove-AccucutTrustedTree -Path $Root -Within $Root -IncludeWithin
    }
    catch {
        Write-Host "The install folder '$Root' could not be removed ($($_.Exception.Message)). Delete it by hand before running the install again." -ForegroundColor Yellow
    }
}

function Invoke-AccucutInstallSecondHalf {
    # Steps 5 to 10. Before the module is loaded: where this script is, the folder chain and the module file. Only then the module, and the install.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$VerifiedRelease,
        [Parameter(Mandatory)][string]$ScriptPath,
        [Parameter(Mandatory)][hashtable]$InstallParameter
    )

    if (-not (Test-AccucutScriptAdministrator)) { throw 'Run this script as an administrator: right-click Windows PowerShell, choose Run as administrator, and start it again.' }
    Assert-AccucutSecondHalfLocation -Root $Root -VerifiedRelease $VerifiedRelease -ScriptPath $ScriptPath
    $release = [System.IO.Path]::GetFullPath($VerifiedRelease).TrimEnd('\')
    Assert-AccucutTrustedPath -Path $release -Root $Root -ProtectedRoot
    Assert-AccucutTrustedNoLinks -Path $release
    Import-AccucutTrustedModule -Root $Root -Release $release
    Invoke-AccucutInstall -Root $Root -Release $release @InstallParameter
}

function Get-AccucutInstallChildArgument {
    # The arguments the first half passes on to the second half (never a secret: a values file is a path).
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$Bound)

    $arguments = [System.Collections.Generic.List[string]]::new()
    foreach ($name in 'Root', 'Port', 'ListenAddress', 'NodeExe', 'PgHost', 'PgPort', 'PgSuperuser', 'PgBinDirectory', 'PgDataDirectory', 'DefenderExclusion', 'HealthTimeoutSeconds', 'ValuesFile') {
        if ($Bound.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace([string]$Bound[$name])) { $arguments.Add("-$name"); $arguments.Add([string]$Bound[$name]) }
    }
    foreach ($name in 'NonInteractive', 'WithProxy') { if ($Bound.ContainsKey($name) -and [bool]$Bound[$name]) { $arguments.Add("-$name") } }
    return $arguments.ToArray()
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        if (-not [string]::IsNullOrWhiteSpace($VerifiedRelease)) {
            $installParameter = @{ NonInteractive = $NonInteractive; WithProxy = $WithProxy; Port = $Port; PgHost = $PgHost; PgPort = $PgPort; PgSuperuser = $PgSuperuser; DefenderExclusion = $DefenderExclusion; HealthTimeoutSeconds = $HealthTimeoutSeconds }
            foreach ($pair in @{ ValuesFile = $ValuesFile; ListenAddress = $ListenAddress; NodeExe = $NodeExe; PgBinDirectory = $PgBinDirectory; PgDataDirectory = $PgDataDirectory }.GetEnumerator()) {
                if (-not [string]::IsNullOrWhiteSpace([string]$pair.Value)) { $installParameter[$pair.Key] = $pair.Value }
            }
            Invoke-AccucutInstallSecondHalf -Root $Root -VerifiedRelease $VerifiedRelease -ScriptPath $PSCommandPath -InstallParameter $installParameter
        }
        else {
            $bound = @{}
            foreach ($key in $PSBoundParameters.Keys) { $bound[$key] = $PSBoundParameters[$key] }
            Invoke-AccucutInstallFirstHalf -ZipPath $ZipPath -Sha256 $Sha256 -Root $Root -ChildArgument (Get-AccucutInstallChildArgument -Bound $bound)
        }
        exit 0
    }
    catch {
        $message = $_.Exception.Message
        if (Get-Command -Name Hide-AccucutSecrets -ErrorAction SilentlyContinue) { $message = Hide-AccucutSecrets -Text $message }
        Write-Host "The install stopped: $message" -ForegroundColor Red
        exit 1
    }
}
