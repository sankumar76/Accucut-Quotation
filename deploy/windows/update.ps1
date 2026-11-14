<#
.SYNOPSIS
  Installs a new release of the Accucut Quotation Portal, and rolls back by itself if the new release is not healthy
  (STORY-10.04; ADR-015 Amendment 2; architecture sections 9.7 and 9.9).

.DESCRIPTION
  Run as an administrator, from the INSTALLED release only: cd C:\Accucut\current; powershell -ExecutionPolicy Bypass -File .\update.ps1 <the new release zip>.
  Windows PowerShell 5.1. One phase, run by the installed release. The new release's scripts are never run during an update (they first run at the next one).

  In this order, stopping at the first problem, and never loading or running code before it has been checked:
    1.  Checks that you are an administrator, that this script is C:\Accucut\current\update.ps1, and that the install folder, the running release, its
        script and module, config, services and logs are real folders owned by Administrators or SYSTEM that no one else can change (nothing is a link).
    2.  Only then loads the shared module from the running release.
    3.  Checks the SHA-256 of the zip, before anything is changed. Takes a release backup (backup.ps1 -Reason release, STORY-10.05). No backup, no
        update, unless you pass -NoBackup knowingly.
    4.  Copies the zip into the install folder, checks the SHA-256 of the COPY, unpacks the copy to C:\Accucut\releases\<tag>\ (an existing folder of that
        tag is deleted and unpacked again, never reused) and refuses any link in it.
    5.  Stops AccucutWorker and AccucutApp, checks the new release again, runs the migrations as the owner role, moves the `current` junction to the new
        release, starts both and waits for /api/health to answer 200.
    6.  If the migrations fail, the junction is not moved and the previous release is started again.
    7.  If the health check fails, the junction moves back, the previous release starts, and the script says "Call your IT person".
        Migrations only ever add (expand-then-contract, architecture section 9.7), so the previous release still runs on the migrated database.
    8.  Keeps the current and the previous release only; older ones are deleted.

  A rollback to an older release is this script given that release's zip.

.PARAMETER ZipPath
  The new release zip (required).
.PARAMETER Sha256
  The expected SHA-256 of the zip, if there is no <zip>.sha256 file next to it. Type it from the release page.
.PARAMETER Root
  The install folder, exactly one folder below a drive. Default C:\Accucut.
.PARAMETER NoBackup
  Go on without the release backup. Say so on purpose: if the update goes wrong and the migrations changed the data, there is nothing to restore from.
.PARAMETER HealthTimeoutSeconds
  How long to wait for /api/health after each start. Default 180.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$ZipPath,
    [string]$Sha256,
    [string]$Root = 'C:\Accucut',
    [switch]$NoBackup,
    [ValidateRange(10, 1800)][int]$HealthTimeoutSeconds = 180
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

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
    # The hash the zip must have: -Sha256, or the first token of <zip>.sha256 next to it (a hint against corruption only).
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

function Get-AccucutUpdateServiceSid {
    # The SID of NT SERVICE\<name>: S-1-5-80 plus five parts of the SHA-1 of the upper-case name (needed before the module is loaded, for the logs folder).
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Name)

    $sha = [System.Security.Cryptography.SHA1]::Create()
    try { $hash = $sha.ComputeHash([System.Text.Encoding]::Unicode.GetBytes($Name.ToUpperInvariant())) } finally { $sha.Dispose() }
    $parts = foreach ($index in 0..4) { [System.BitConverter]::ToUInt32($hash, 4 * $index) }
    return 'S-1-5-80-' + ($parts -join '-')
}

function Import-AccucutUpdateEnvironment {
    # Steps 1 and 2: everything that is checked before the module is loaded, then the load. Returns the running release folder.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$ScriptPath
    )

    if (-not (Test-AccucutScriptAdministrator)) { throw 'Run this script as an administrator: right-click Windows PowerShell, choose Run as administrator, and start it again.' }
    Assert-AccucutTrustedRootShape -Root $Root
    $old = Get-AccucutTrustedCurrent -Root $Root
    $fromCurrent = [System.IO.Path]::Combine($Root, 'current\update.ps1')
    $fromRelease = [System.IO.Path]::Combine($old, 'update.ps1')
    $here = [System.IO.Path]::GetFullPath($ScriptPath)
    if (-not ($here.Equals([System.IO.Path]::GetFullPath($fromCurrent), [System.StringComparison]::OrdinalIgnoreCase) -or $here.Equals([System.IO.Path]::GetFullPath($fromRelease), [System.StringComparison]::OrdinalIgnoreCase))) {
        throw "Run the installed update.ps1: cd $([System.IO.Path]::Combine($Root, 'current')); then start .\update.ps1 <the new zip>. This script is '$ScriptPath'. Nothing was changed."
    }
    Assert-AccucutTrustedPath -Path $old -Root $Root -ProtectedRoot
    Assert-AccucutTrustedPath -Path $fromRelease -Root $Root -ProtectedRoot
    Assert-AccucutTrustedPath -Path ([System.IO.Path]::Combine($old, 'AccucutOps.psm1')) -Root $Root -ProtectedRoot
    Assert-AccucutTrustedPath -Path ([System.IO.Path]::Combine($Root, 'config')) -Root $Root -ProtectedRoot
    Assert-AccucutTrustedPath -Path ([System.IO.Path]::Combine($Root, 'services')) -Root $Root -ProtectedRoot
    Assert-AccucutTrustedPath -Path ([System.IO.Path]::Combine($Root, 'logs')) -Root $Root -ProtectedRoot -Writer @((Get-AccucutUpdateServiceSid -Name 'AccucutApp'), (Get-AccucutUpdateServiceSid -Name 'AccucutWorker'))
    Assert-AccucutTrustedNoLinks -Path $old
    Import-AccucutTrustedModule -Root $Root -Release $old
    return $old
}

function Invoke-AccucutReleaseBackup {
    # Runs backup.ps1 -Reason release from the running release (STORY-10.05), through the checked wrapper. Returns $true if it ran, $false if there is none.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$OldRelease
    )

    $script = [System.IO.Path]::Combine($OldRelease, 'backup.ps1')
    if (-not [System.IO.File]::Exists($script)) { return $false }
    if ((Invoke-AccucutTrustedScript -Root $Root -Path $script -ArgumentList @('-Reason', 'release')) -ne 0) { throw 'backup.ps1 failed, so the update was stopped before anything was changed.' }
    return $true
}

function Start-AccucutServicesAndCheck {
    # Starts both services and waits for the health check. A service that cannot start counts as unhealthy, not as a reason to stop the script:
    # the caller must always get to its rollback. Returns $true only when /api/health answered 200.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$HealthUrl,
        [Parameter(Mandatory)][int]$TimeoutSeconds,
        [string]$LogFile
    )

    try {
        Start-AccucutServices
    }
    catch {
        Write-AccucutLog -Message "A service did not start: $($_.Exception.Message)" -Level Warning -LogFile $LogFile
        return $false
    }
    return (Wait-AccucutHealth -Url $HealthUrl -TimeoutSeconds $TimeoutSeconds)
}

function Update-AccucutServiceProgram {
    # Checks each WinSW program (and its folder) before it is used, then refreshes it from its XML and sets its account again.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string[]]$Name
    )

    foreach ($serviceName in $Name) {
        $winsw = Resolve-AccucutTrustedExecutable -Path ([System.IO.Path]::Combine($Paths.Services, "$serviceName.exe"))
        [void](Invoke-AccucutNative -FilePath $winsw -ArgumentList @('refresh'))
        Set-AccucutServiceIdentity -Name $serviceName
    }
}

function Restore-AccucutServiceFiles {
    # Writes back the service XML files as they were before the update, and refreshes WinSW so that a rolled-back service runs as before.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][hashtable]$Snapshot
    )

    foreach ($name in $Snapshot.Keys) {
        $xml = [System.IO.Path]::Combine($Paths.Services, "$name.xml")
        $current = $null
        if ([System.IO.File]::Exists($xml)) { $current = [System.IO.File]::ReadAllText($xml) }
        if ($current -ne $Snapshot[$name]) {
            [System.IO.File]::WriteAllText($xml, $Snapshot[$name], [System.Text.UTF8Encoding]::new($false))
            Update-AccucutServiceProgram -Paths $Paths -Name @($name)
        }
    }
}

function Invoke-AccucutUpdate {
    # Steps 3 to 8, with the module loaded from the checked running release.
    [CmdletBinding()]
    param(
        [string]$ZipPath,
        [string]$Sha256,
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$OldRelease,
        [switch]$NoBackup,
        [ValidateRange(10, 1800)][int]$HealthTimeoutSeconds = 180
    )

    if ([string]::IsNullOrWhiteSpace($ZipPath)) { throw 'Give the new release zip: update.ps1 <zip>. Its SHA-256 is checked first.' }
    $paths = Get-AccucutPaths -Root $Root
    if (-not [System.IO.File]::Exists($paths.StateFile)) { throw "No install was found under '$($paths.Root)'. Run install.ps1 first." }
    $state = [System.IO.File]::ReadAllText($paths.StateFile) | ConvertFrom-Json
    $oldTag = [System.IO.Path]::GetFileName($OldRelease)

    # The zip's hash, before anything is changed (a fail-fast; the copy is checked again below).
    if (-not [System.IO.File]::Exists($ZipPath)) { throw "The zip '$ZipPath' was not found." }
    $expected = Get-AccucutExpectedSha256 -ZipPath $ZipPath -Sha256 $Sha256
    $actual = Get-AccucutTrustedSha256 -Path $ZipPath
    if ($actual -ne $expected) { throw "The SHA-256 of the zip does not match (expected $expected, the file is $actual). Nothing was changed. Download the release again." }
    Assert-AccucutFreeSpace -Path $paths.Releases -MinimumBytes ([System.IO.FileInfo]::new($ZipPath).Length * 4 + 512MB)
    $logFile = [System.IO.Path]::Combine($paths.Logs, "update-$((Get-Date).ToString('yyyyMMdd-HHmmss')).log")
    Write-AccucutLog -Message "Update started. Running release: $oldTag. Zip SHA-256 checked." -LogFile $logFile

    # The release backup. No backup, no update (unless -NoBackup was given on purpose).
    if ($NoBackup) {
        Write-AccucutLog -Message 'NO BACKUP WAS TAKEN (-NoBackup). If the migrations change data and something goes wrong, there is nothing to restore from.' -Level Warning -LogFile $logFile
    }
    elseif (Invoke-AccucutReleaseBackup -Root $Root -OldRelease $OldRelease) {
        Write-AccucutLog -Message 'Release backup taken.' -LogFile $logFile
    }
    else {
        throw "There is no backup script in the running release ('$OldRelease\backup.ps1'), so no release backup could be taken. Nothing was changed. Do not skip the backup unless you accept losing data if the update fails: then run the update again with -NoBackup."
    }

    # Unpack beside the running release, from the checked copy. An existing folder of that tag is deleted and unpacked again, never reused.
    $target = Expand-AccucutTrustedPackage -Root $Root -ZipPath $ZipPath -Sha256 $expected -RefuseTag $oldTag -ReplaceExisting
    $newTag = [System.IO.Path]::GetFileName($target)

    # Stop, check the new release again, migrate, switch, start, check.
    Write-AccucutLog -Message "Stopping the services and updating $oldTag -> $newTag." -LogFile $logFile
    Stop-AccucutServices
    $snapshot = @{}
    foreach ($name in (Get-AccucutServiceNames)) { $snapshot[$name] = [System.IO.File]::ReadAllText([System.IO.Path]::Combine($paths.Services, "$name.xml")) }
    $healthUrl = "http://127.0.0.1:$($state.port)/api/health"
    try {
        Assert-AccucutTrustedPath -Path $target -Root $Root -ProtectedRoot
        Assert-AccucutTrustedNoLinks -Path $target
        $nodeExe = Resolve-AccucutTrustedExecutable -Path ([string]$state.nodeExe)
        $migrateUrl = [string](Read-AccucutEnvFile -Path $paths.MigrateEnvFile)['MIGRATE_DATABASE_URL']
        if ([string]::IsNullOrWhiteSpace($migrateUrl)) { throw "MIGRATE_DATABASE_URL is missing from '$($paths.MigrateEnvFile)'." }
        $migration = Invoke-AccucutMigration -ReleaseDirectory $target -NodeExe $nodeExe -MigrateDatabaseUrl $migrateUrl
        Write-AccucutLog -Message "Migrations: $($migration.Deploy)" -LogFile $logFile
    }
    catch {
        Write-AccucutLog -Message "The new release could not be checked or migrated: $($_.Exception.Message)" -Level Error -LogFile $logFile
        Write-AccucutLog -Message "The previous release ($oldTag) is still the current one. Starting it again." -Level Warning -LogFile $logFile
        [void](Start-AccucutServicesAndCheck -HealthUrl $healthUrl -TimeoutSeconds $HealthTimeoutSeconds -LogFile $logFile)
        Write-AccucutLog -Message 'Call your IT person.' -Level Error -LogFile $logFile
        throw "The update stopped before the switch; release $oldTag is running again. Call your IT person."
    }

    Set-AccucutCurrentRelease -Paths $paths -Tag $newTag
    $changed = Initialize-AccucutServiceFiles -Paths $paths -ReleaseDirectory $target -NodeExe $nodeExe -Port ([int]$state.port) -ListenAddress ([string]$state.listenAddress)
    # Every WinSW program is checked before it is used, whether or not its XML changed (the program itself may have been replaced by the new release's).
    foreach ($name in (Get-AccucutServiceNames)) { [void](Resolve-AccucutTrustedExecutable -Path ([System.IO.Path]::Combine($paths.Services, "$name.exe"))) }
    if (@($changed).Count -gt 0) { Update-AccucutServiceProgram -Paths $paths -Name @($changed) }
    $healthy = Start-AccucutServicesAndCheck -HealthUrl $healthUrl -TimeoutSeconds $HealthTimeoutSeconds -LogFile $logFile

    if (-not $healthy) {
        # Roll back: the junction goes back, the previous release starts.
        Write-AccucutLog -Message "Release $newTag did not answer 200 at $healthUrl within $HealthTimeoutSeconds seconds. Rolling back to $oldTag." -Level Error -LogFile $logFile
        Stop-AccucutServices
        Set-AccucutCurrentRelease -Paths $paths -Tag $oldTag
        Restore-AccucutServiceFiles -Paths $paths -Snapshot $snapshot
        $back = Start-AccucutServicesAndCheck -HealthUrl $healthUrl -TimeoutSeconds $HealthTimeoutSeconds -LogFile $logFile
        if ($back) {
            Write-AccucutLog -Message "Release $oldTag is running again. The data was migrated by the update; the old release still works with it (migrations only add)." -Level Warning -LogFile $logFile
        }
        else {
            Write-AccucutLog -Message "Release $oldTag did not answer either. The portal is DOWN." -Level Error -LogFile $logFile
        }
        Write-AccucutLog -Message 'Call your IT person.' -Level Error -LogFile $logFile
        throw "The update to $newTag failed its health check and was rolled back to $oldTag. Call your IT person."
    }

    # Done: keep the current and the previous release only.
    $removed = Remove-AccucutOldReleases -Paths $paths -Keep @($newTag, $oldTag)
    [void](Remove-AccucutOldLogs -Path $paths.Logs -KeepDays 30)
    $state.tag = $newTag
    [System.IO.File]::WriteAllText($paths.StateFile, ($state | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
    $signIn = Get-AccucutHttpStatus -Url "http://127.0.0.1:$($state.port)/sign-in"
    Write-AccucutLog -Message "Updated to $newTag (previous: $oldTag). Health check answered 200; the sign-in page answered $signIn. Removed older releases: $(@($removed).Count)." -LogFile $logFile
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        $oldRelease = Import-AccucutUpdateEnvironment -Root $Root -ScriptPath $PSCommandPath
        Invoke-AccucutUpdate -ZipPath $ZipPath -Sha256 $Sha256 -Root $Root -OldRelease $oldRelease -NoBackup:$NoBackup -HealthTimeoutSeconds $HealthTimeoutSeconds
        exit 0
    }
    catch {
        $message = $_.Exception.Message
        if (Get-Command -Name Hide-AccucutSecrets -ErrorAction SilentlyContinue) { $message = Hide-AccucutSecrets -Text $message }
        Write-Host "The update stopped: $message" -ForegroundColor Red
        exit 1
    }
}
