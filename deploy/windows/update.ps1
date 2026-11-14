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
Import-Module (Join-Path $script:ScriptRoot 'AccucutOps.psm1') -Force -DisableNameChecking

function Expand-AccucutZip {
    <# Unpacks a zip into an empty folder, refusing any entry that would land outside it. #>
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
    $incoming = Join-Path $paths.Releases ".in-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
    $newTag = $null
    try {
        Expand-AccucutZip -ZipPath $ZipPath -Destination $incoming
        $info = Read-AccucutReleaseInfo -PackageRoot $incoming
        $newTag = [string]$info.tag
        $target = Join-Path $paths.Releases $newTag
        if (Test-Path -LiteralPath $target) {
            $recorded = Join-Path $target '.zip-sha256'
            $same = (Test-Path -LiteralPath $recorded) -and ((Get-Content -LiteralPath $recorded -TotalCount 1).Trim() -eq $zipHash)
            if (-not $same) { throw "A release folder named '$newTag' already exists and was made from a different zip. Nothing was changed." }
            Remove-AccucutDirectory -Path $incoming -Within $paths.Releases
            Write-AccucutLog -Message "Release $newTag is already unpacked from this same zip; reusing it." -LogFile $logFile
        }
        else {
            [System.IO.Directory]::Move($incoming, $target)
            Set-Content -LiteralPath (Join-Path $target '.zip-sha256') -Value $zipHash -Encoding ASCII
        }
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
        Invoke-AccucutUpdate @PSBoundParameters
        exit 0
    }
    catch {
        Write-Host "The update stopped: $(Hide-AccucutSecrets -Text $_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}
