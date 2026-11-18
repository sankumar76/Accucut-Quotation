<#
.SYNOPSIS
  The Admin's guided command that clears the oldest backup copies (STORY-10.05 AC-6; ADR-015 Amendments 2, 2.1 and 3; architecture section 9.5).

.DESCRIPTION
  Run it when Settings says "Disk nearly full" (or the IT person asks you to), from the installed folder:
      cd C:\Accucut\current
      .\clear-copies.ps1
  Windows PowerShell 5.1. It takes no arguments.

  What it does:
    1.  Checks (the trust block below, never the module) where it is running from, the install folder chain, this script, the module, the settings files,
        the backups folder and psql. It stops before doing anything if any check fails.
    2.  Lists the copies oldest first, with date, kind and size, and the free space now. The newest 4 copies are ALWAYS kept.
    3.  Asks you to TYPE the date (YYYY-MM-DD) of the newest copy to remove. Every older copy goes too, oldest first. If the date is not the date of a copy that
        may be removed, nothing is removed.
    4.  Shows how many copies go and how much space that frees, and asks you to type YES.
    5.  Removes each copy with its manifest, and nothing else, and writes one job_runs row (job 'backup-clear'): how many, which dates, the free space after.
        No figure from inside any copy is recorded.

  A copy that is removed cannot be restored. It deletes only files that it can prove are the backup's own copies: the exact file name, a regular file directly in
  the backups folder (no link, nothing deeper), and a manifest that agrees with it. Anything else in the folder is left alone.
  If the disk is still too full when only the 4 newest copies are left, the disk is too small for the data: call your IT person.
#>
[CmdletBinding()]
param()

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

function Get-AccucutTrustAttributes {
    # The attributes of a file or folder, read without following a link (File.GetAttributes). A function of its own so that a test can make a second read differ.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    return [System.IO.File]::GetAttributes($Path)
}

function Get-AccucutTrustSecurity {
    # The only reader of file and folder security (and the Pester mock point). The attributes are read (without following a link), then the security
    # descriptor (which is read by name, and does follow a link), then the attributes again: if the two reads differ, the path was changed while it was
    # being read and is refused. A link shows as Reparse, which the callers refuse. A null list and any entry that is not a plain allow or deny entry
    # (an object, callback or compound entry) are refused. (A swap that is undone before the second read is the accepted residual R-T5.)
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $attributes = Get-AccucutTrustAttributes -Path $Path
    $isDirectory = (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0)
    $sections = [System.Security.AccessControl.AccessControlSections]::Owner -bor [System.Security.AccessControl.AccessControlSections]::Access
    if ($isDirectory) { $security = [System.IO.Directory]::GetAccessControl($Path, $sections) } else { $security = [System.IO.File]::GetAccessControl($Path, $sections) }
    $descriptor = [System.Security.AccessControl.RawSecurityDescriptor]::new($security.GetSecurityDescriptorBinaryForm(), 0)
    $after = Get-AccucutTrustAttributes -Path $Path
    if ([int]$after -ne [int]$attributes) { throw "'$Path' changed while its permissions were being read (its attributes were $([int]$attributes), then $([int]$after)). Refusing to use it." }
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
# ---- Outside the trust block. Nothing below loads or runs code except through Import-AccucutTrustedModule and Resolve-AccucutTrustedExecutable.

function Get-AccucutScriptInstallRoot {
    # The install root, worked out from where this script is: <Root>\current\<name> or <Root>\releases\<tag>\<name>. Nothing on the command line can change it.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ScriptPath,
        [Parameter(Mandatory)][string]$Name
    )

    $full = [System.IO.Path]::GetFullPath($ScriptPath)
    $pattern = '^(?<root>[A-Za-z]:\\[A-Za-z0-9_-]{1,32})\\(current|releases\\[A-Za-z0-9][A-Za-z0-9._-]{0,63})\\' + [regex]::Escape($Name) + '$'
    if ($full -notmatch $pattern) { throw "This script is '$full'. Run the installed $Name only, from <install folder>\current (the scheduled task and update.ps1 do). Nothing was done." }
    return $Matches['root']
}

function Assert-AccucutBackupFolderTrusted {
    # The backups folder before anything is written to it or deleted from it (ADR-015 Amendment 3 point 4): the chain to it passes Rule B with the backup account as
    # the only writer (up to Modify), or one of two when the install made the Admin endpoint (-EndpointSid, the local group of its virtual account: STORY-10.11, ADR-015 Amendment 3
    # point 4); it is a real folder (no link), its owner is Administrators, and its list is protected.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Directory,
        [Parameter(Mandatory)][string]$BackupSid,
        [string]$EndpointSid
    )

    $writers = @($BackupSid)
    if (-not [string]::IsNullOrEmpty($EndpointSid)) { $writers += $EndpointSid }
    Assert-AccucutTrustedPath -Path $Directory -Root $Root -ProtectedRoot -Writer $writers
    $security = Get-AccucutTrustSecurity -Path $Directory
    if ($security.Reparse -or -not $security.IsDirectory) { throw "'$Directory' is not a real folder. Refusing to use it." }
    if ($security.Owner -ne 'S-1-5-32-544') { throw "'$Directory' is owned by $($security.Owner), not by Administrators. Refusing to use it." }
    if (-not $security.Protected) { throw "'$Directory' inherits its permissions from the folder above it. Refusing to use it." }
}

function Invoke-AccucutClearScript {
    # Steps 1 to 5 of the description. Everything before Import-AccucutTrustedModule is the trust block and the two functions above, and nothing is loaded
    # or run until its path has been checked.
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$ScriptPath)

    $root = Get-AccucutScriptInstallRoot -ScriptPath $ScriptPath -Name 'clear-copies.ps1'
    Assert-AccucutTrustedRootShape -Root $root
    $release = Get-AccucutTrustedCurrent -Root $root
    $here = [System.IO.Path]::GetFullPath($ScriptPath)
    $fromCurrent = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, 'current\clear-copies.ps1'))
    $fromRelease = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($release, 'clear-copies.ps1'))
    if (-not ($here.Equals($fromCurrent, [System.StringComparison]::OrdinalIgnoreCase) -or $here.Equals($fromRelease, [System.StringComparison]::OrdinalIgnoreCase))) {
        throw "This script is '$here', not the clear-copies.ps1 of the running release. Run it from '$([System.IO.Path]::Combine($root, 'current'))'. Nothing was done."
    }
    Assert-AccucutTrustedPath -Path $release -Root $root -ProtectedRoot
    Assert-AccucutTrustedPath -Path $fromRelease -Root $root -ProtectedRoot
    Import-AccucutTrustedModule -Root $root -Release $release

    $paths = Get-AccucutPaths -Root $root
    $backupSid = Get-AccucutBackupAccountSid
    foreach ($file in $paths.BackupSettings, $paths.BackupPgpass) { Assert-AccucutTrustedPath -Path $file -Root $root -ProtectedRoot }
    $settings = Read-AccucutBackupSettings -Path $paths.BackupSettings
    Assert-AccucutBackupFolderTrusted -Root $root -Directory $paths.Backups -BackupSid $backupSid -EndpointSid (Get-AccucutAdminGroupSid)
    $psql = Resolve-AccucutTrustedExecutable -Path ([System.IO.Path]::Combine($settings.PgBinDirectory, 'psql.exe'))
    [void](Invoke-AccucutClearCopies -Paths $paths -Settings $settings -PsqlPath $psql)
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        Invoke-AccucutClearScript -ScriptPath $PSCommandPath
        exit 0
    }
    catch {
        $message = $_.Exception.Message
        if (Get-Command -Name Hide-AccucutSecrets -ErrorAction SilentlyContinue) { $message = Hide-AccucutSecrets -Text $message }
        Write-Host "Clearing copies stopped: $message" -ForegroundColor Red
        exit 1
    }
}
