<#
.SYNOPSIS
  Installs a new release of the Accucut Quotation Portal, and rolls back by itself if the new release is not healthy
  (STORY-10.04; architecture sections 9.7 and 9.9).

.DESCRIPTION
  Run as an administrator: .\update.ps1 <the new release zip>. Windows PowerShell 5.1.

  In this order, stopping at the first problem:
    1.  Checks the SHA-256 of the zip, before anything is changed.
    2.  Takes a release backup (backup.ps1 -Reason release, STORY-10.05). No backup, no update, unless you pass -NoBackup knowingly.
    3.  Unpacks the zip to C:\Accucut\releases\<tag>\ (nothing running is touched yet).
    4.  Stops AccucutWorker and AccucutApp, runs the migrations as the owner role, moves the `current` junction to the new release,
        starts both and waits for /api/health to answer 200.
    5.  If the migrations fail, the junction is not moved and the previous release is started again.
    6.  If the health check fails, the junction moves back, the previous release starts, and the script says "Call your IT person".
        Migrations only ever add (expand-then-contract, architecture section 9.7), so the previous release still runs on the migrated database.
    7.  Keeps the current and the previous release only; older ones are deleted.

  A rollback to an older release is this script given that release's zip.

.PARAMETER ZipPath
  The new release zip (required).
.PARAMETER Sha256
  The expected SHA-256 of the zip, if there is no <zip>.sha256 file next to it.
.PARAMETER Root
  The install folder. Default C:\Accucut.
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

$script:ScriptRoot = $PSScriptRoot

# The shared module is loaded only after this script and the module have been checked with the one trust rule below, so that code that someone else
# could have put in the folder is never loaded. The rule is in this file too (word for word the same as in AccucutOps.psm1) because the module cannot be
# used before it is checked.

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


function Import-AccucutVerifiedModule {
    <#
    Resolves the folder this script runs from (normally C:\Accucut\current, a link: it is followed once, to the real release folder, so that what is
    checked is the path that is used), checks the script and the module there with Assert-AccucutPathTrusted, and only then loads the module from that
    real path. Returns the real folder.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ScriptRoot,
        [Parameter(Mandatory)][string]$ScriptPath
    )

    $real = [System.IO.Path]::GetFullPath($ScriptRoot).TrimEnd('\')
    $item = Get-Item -LiteralPath $real -Force
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        $target = @($item.Target)[0]
        if ([string]::IsNullOrWhiteSpace($target)) { throw "'$real' is a link that points nowhere. Refusing to run from it." }
        $real = [System.IO.Path]::GetFullPath($target).TrimEnd('\')
    }
    Assert-AccucutPathTrusted -Path $real
    Assert-AccucutPathTrusted -Path (Join-Path $real (Split-Path -Leaf $ScriptPath))
    $module = Join-Path $real 'AccucutOps.psm1'
    Assert-AccucutPathTrusted -Path $module
    Import-Module $module -Force -DisableNameChecking
    return $real
}

function Assert-AccucutUpdateRunsFromInstall {
    <# This script and the shared module it loaded must come from the install folder (normally C:\Accucut\current), not from a folder anyone could have changed. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$Paths)

    $here = [System.IO.Path]::GetFullPath($script:ScriptRoot).TrimEnd('\') + '\'
    foreach ($base in $Paths.Current, $Paths.Releases) {
        if ($here.StartsWith(([System.IO.Path]::GetFullPath($base).TrimEnd('\') + '\'), [System.StringComparison]::OrdinalIgnoreCase)) { return }
    }
    throw "Run this script from the install folder, not from the folder you unpacked the new zip into: cd $($Paths.Current); .\update.ps1 <the new zip>. Nothing was changed."
}

function Invoke-AccucutReleaseBackup {
    <# Runs backup.ps1 -Reason release from the current release (STORY-10.05). Returns $true if it ran, $false if there is none. Throws if it fails. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$Paths)

    $script = Join-Path $Paths.Current 'backup.ps1'
    if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { return $false }
    $powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    [void](Invoke-AccucutNative -FilePath $powershell -ArgumentList @('-NoProfile', '-NonInteractive', '-File', $script, '-Reason', 'release'))
    return $true
}

function Start-AccucutServicesAndCheck {
    <#
    Starts both services and waits for the health check. A service that cannot start counts as unhealthy, not as a reason to stop the script:
    the caller must always get to its rollback. Returns $true only when /api/health answered 200.
    #>
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

function Restore-AccucutServiceFiles {
    <# Writes back the service XML files as they were before the update, and refreshes WinSW so that a rolled-back service runs as before. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][hashtable]$Snapshot
    )

    foreach ($name in $Snapshot.Keys) {
        $xml = Join-Path $Paths.Services "$name.xml"
        $current = $null
        if (Test-Path -LiteralPath $xml) { $current = Get-Content -LiteralPath $xml -Raw }
        if ($current -ne $Snapshot[$name]) {
            [System.IO.File]::WriteAllText($xml, $Snapshot[$name], (New-Object System.Text.UTF8Encoding($false)))
            [void](Invoke-AccucutNative -FilePath (Join-Path $Paths.Services "$name.exe") -ArgumentList @('refresh'))
            Set-AccucutServiceIdentity -Name $name
        }
    }
}

function Invoke-AccucutUpdate {
    [CmdletBinding()]
    param(
        [string]$ZipPath,
        [string]$Sha256,
        [string]$Root = 'C:\Accucut',
        [switch]$NoBackup,
        [ValidateRange(10, 1800)][int]$HealthTimeoutSeconds = 180
    )

    $ErrorActionPreference = 'Stop'
    if (-not (Test-AccucutAdministrator)) { throw 'Run this script as an administrator: right-click Windows PowerShell, choose Run as administrator, and start it again.' }
    if ([string]::IsNullOrWhiteSpace($ZipPath)) { throw 'Give the new release zip: update.ps1 <zip>. Its SHA-256 is checked first.' }
    $paths = Get-AccucutPaths -Root $Root
    if (-not (Test-Path -LiteralPath $paths.StateFile)) { throw "No install was found under '$($paths.Root)'. Run install.ps1 first." }
    # Before anything is written: this script comes from the install folder, and every folder it writes to is still owned by Administrators or SYSTEM
    # and writable by no one else (an ordinary user who had gained rights there could otherwise get their files run by a service).
    Assert-AccucutUpdateRunsFromInstall -Paths $paths
    Assert-AccucutInstallTrusted -Paths $paths
    $state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json

    # 1. The zip's hash, before anything is changed.
    $expected = $Sha256
    if ([string]::IsNullOrWhiteSpace($expected)) {
        $checksumFile = "$ZipPath.sha256"
        if (-not (Test-Path -LiteralPath $checksumFile -PathType Leaf)) { throw "No SHA-256 given: pass -Sha256, or keep '$(Split-Path -Leaf $checksumFile)' next to the zip." }
        $expected = Read-AccucutSha256File -Path $checksumFile
    }
    Assert-AccucutSha256 -Path $ZipPath -Expected $expected
    $zipHash = Get-AccucutFileSha256 -Path $ZipPath

    $oldTag = Get-AccucutCurrentRelease -Paths $paths
    if ([string]::IsNullOrWhiteSpace($oldTag)) { throw "'$($paths.Current)' does not point at a release. The install looks damaged; call your IT person." }
    $logFile = Join-Path $paths.Logs "update-$((Get-Date).ToString('yyyyMMdd-HHmmss')).log"
    Write-AccucutLog -Message "Update started. Running release: $oldTag. Zip SHA-256 checked." -LogFile $logFile

    # 2. The release backup. No backup, no update (unless -NoBackup was given on purpose).
    if ($NoBackup) {
        Write-AccucutLog -Message 'NO BACKUP WAS TAKEN (-NoBackup). If the migrations change data and something goes wrong, there is nothing to restore from.' -Level Warning -LogFile $logFile
    }
    elseif (Invoke-AccucutReleaseBackup -Paths $paths) {
        Write-AccucutLog -Message 'Release backup taken.' -LogFile $logFile
    }
    else {
        throw "There is no backup script in the running release ('$($paths.Current)\backup.ps1'), so no release backup could be taken. Nothing was changed. Do not skip the backup unless you accept losing data if the update fails: then run the update again with -NoBackup."
    }

    # 3. Unpack beside the running release.
    Assert-AccucutFreeSpace -Path $paths.Releases -MinimumBytes ((Get-Item -LiteralPath $ZipPath).Length * 4 + 512MB)
    # The zip is copied into the install folder (which only administrators can write) and the COPY is checked again and unpacked, so the file that
    # is unpacked is the file that was checked, even if the original is changed in between.
    $incoming = Join-Path $paths.Releases ".in-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
    $newTag = $null
    try {
        New-Item -ItemType Directory -Path $incoming | Out-Null
        $copy = Join-Path $incoming 'package.zip'
        Copy-Item -LiteralPath $ZipPath -Destination $copy
        Assert-AccucutSha256 -Path $copy -Expected $expected
        $unpacked = Join-Path $incoming 'unpacked'
        Expand-AccucutZip -ZipPath $copy -Destination $unpacked
        $info = Read-AccucutReleaseInfo -PackageRoot $unpacked
        $newTag = [string]$info.tag
        $target = Join-Path $paths.Releases $newTag
        if (Test-Path -LiteralPath $target) {
            $recorded = Join-Path $target '.zip-sha256'
            $same = (Test-Path -LiteralPath $recorded) -and ((Get-Content -LiteralPath $recorded -TotalCount 1).Trim() -eq $zipHash)
            if (-not $same) { throw "A release folder named '$newTag' already exists and was made from a different zip. Nothing was changed." }
            Write-AccucutLog -Message "Release $newTag is already unpacked from this same zip; reusing it." -LogFile $logFile
        }
        else {
            [System.IO.Directory]::Move($unpacked, $target)
            Set-Content -LiteralPath (Join-Path $target '.zip-sha256') -Value $zipHash -Encoding ASCII
        }
        Remove-AccucutDirectory -Path $incoming -Within $paths.Releases
    }
    catch {
        if (Test-Path -LiteralPath $incoming) { Remove-AccucutDirectory -Path $incoming -Within $paths.Releases }
        throw
    }
    $target = Join-Path $paths.Releases $newTag
    if ($newTag -eq $oldTag) {
        Write-AccucutLog -Message "Release $newTag is already the running release. Nothing to do." -LogFile $logFile
        return
    }
    $scripts = @(Get-ChildItem -LiteralPath $target -File | Where-Object { $_.Extension -in '.ps1', '.psm1' })
    $programs = @(Get-ChildItem -LiteralPath (Join-Path $target 'bin') -File -ErrorAction SilentlyContinue)
    foreach ($file in ($scripts + $programs)) { Unblock-File -LiteralPath $file.FullName -ErrorAction SilentlyContinue }

    # 4. Stop, migrate, switch, start, check.
    Write-AccucutLog -Message "Stopping the services and updating $oldTag -> $newTag." -LogFile $logFile
    Stop-AccucutServices
    # The trust check once more, now that the new release is in releases and just before anything of it runs (it could have gone stale during the backup and the unpack).
    Assert-AccucutInstallTrusted -Paths $paths
    $snapshot = @{}
    foreach ($name in (Get-AccucutServiceNames)) { $snapshot[$name] = Get-Content -LiteralPath (Join-Path $paths.Services "$name.xml") -Raw }

    try {
        $migrateUrl = [string](Read-AccucutEnvFile -Path $paths.MigrateEnvFile)['MIGRATE_DATABASE_URL']
        if ([string]::IsNullOrWhiteSpace($migrateUrl)) { throw "MIGRATE_DATABASE_URL is missing from '$($paths.MigrateEnvFile)'." }
        $migration = Invoke-AccucutMigration -ReleaseDirectory $target -NodeExe $state.nodeExe -MigrateDatabaseUrl $migrateUrl
        Write-AccucutLog -Message "Migrations: $($migration.Deploy)" -LogFile $logFile
    }
    catch {
        Write-AccucutLog -Message "The migrations failed: $($_.Exception.Message)" -Level Error -LogFile $logFile
        Write-AccucutLog -Message "The previous release ($oldTag) is still the current one. Starting it again." -Level Warning -LogFile $logFile
        [void](Start-AccucutServicesAndCheck -HealthUrl "http://127.0.0.1:$($state.port)/api/health" -TimeoutSeconds $HealthTimeoutSeconds -LogFile $logFile)
        Write-AccucutLog -Message 'Call your IT person.' -Level Error -LogFile $logFile
        throw "The update stopped at the migrations; release $oldTag is running again. Call your IT person."
    }

    Set-AccucutCurrentRelease -Paths $paths -Tag $newTag
    $changed = Initialize-AccucutServiceFiles -Paths $paths -ReleaseDirectory $target -NodeExe $state.nodeExe -Port ([int]$state.port) -ListenAddress ([string]$state.listenAddress)
    foreach ($name in $changed) {
        [void](Invoke-AccucutNative -FilePath (Join-Path $paths.Services "$name.exe") -ArgumentList @('refresh'))
        Set-AccucutServiceIdentity -Name $name
    }
    $healthUrl = "http://127.0.0.1:$($state.port)/api/health"
    $healthy = Start-AccucutServicesAndCheck -HealthUrl $healthUrl -TimeoutSeconds $HealthTimeoutSeconds -LogFile $logFile

    if (-not $healthy) {
        # 6. Roll back: the junction goes back, the previous release starts.
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

    # 7. Done: keep the current and the previous release only.
    $removed = Remove-AccucutOldReleases -Paths $paths -Keep @($newTag, $oldTag)
    [void](Remove-AccucutOldLogs -Path $paths.Logs -KeepDays 30)
    $state.tag = $newTag
    [System.IO.File]::WriteAllText($paths.StateFile, ($state | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
    $signIn = Get-AccucutHttpStatus -Url "http://127.0.0.1:$($state.port)/sign-in"
    Write-AccucutLog -Message "Updated to $newTag (previous: $oldTag). Health check answered 200; the sign-in page answered $signIn. Removed older releases: $(@($removed).Count)." -LogFile $logFile
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        # First of all, before anything of the install is loaded or run: the script, the module and every folder above them (Assert-AccucutPathTrusted).
        $script:ScriptRoot = Import-AccucutVerifiedModule -ScriptRoot $PSScriptRoot -ScriptPath $PSCommandPath
        Invoke-AccucutUpdate @PSBoundParameters
        exit 0
    }
    catch {
        $message = $_.Exception.Message
        if (Get-Command -Name Hide-AccucutSecrets -ErrorAction SilentlyContinue) { $message = Hide-AccucutSecrets -Text $message }
        Write-Host "The update stopped: $message" -ForegroundColor Red
        exit 1
    }
}
