#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of update.ps1 (STORY-10.04 AC-3 and AC-4; ADR-015 Amendment 2), with services, programs, health and the zip mocked. The trust block has its own
  tests (Trust.Tests.ps1). The real update and the real rollback are proved by CI stage 13 on a Windows runner. All values here are invented and clearly fake.
#>

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    # Dot-sourcing defines the functions and does not run the update (the script runs it only when it is started, not sourced).
    . (Join-Path $script:WindowsDirectory 'update.ps1')
    $script:Trace = [System.Collections.Generic.List[string]]::new()
}

Describe 'the update checks before it loads anything, and runs only from the installed release (required test 17)' {
    BeforeEach {
        $script:Trace.Clear()
        Mock Test-AccucutScriptAdministrator { $true }
        Mock Assert-AccucutTrustedRootShape { $script:Trace.Add('shape') }
        Mock Get-AccucutTrustedCurrent { $script:Trace.Add('current'); return 'C:\Accucut\releases\old1' }
        Mock Assert-AccucutTrustedPath { $script:Trace.Add("path:$Path") }
        Mock Assert-AccucutTrustedNoLinks { $script:Trace.Add('nolinks') }
        Mock Import-AccucutTrustedModule { $script:Trace.Add('import') }
    }

    It 'checks the root shape, the current junction, the running release, its script and module, config, services and logs and the links, and only then loads the module' {
        $release = Import-AccucutUpdateEnvironment -Root 'C:\Accucut' -ScriptPath 'C:\Accucut\current\update.ps1'
        $release | Should -Be 'C:\Accucut\releases\old1'
        ($script:Trace -join '|') | Should -Be ('shape|current|path:C:\Accucut\releases\old1|path:C:\Accucut\releases\old1\update.ps1|path:C:\Accucut\releases\old1\AccucutOps.psm1|' +
            'path:C:\Accucut\config|path:C:\Accucut\services|path:C:\Accucut\logs|nolinks|import')
        Should -Invoke Import-AccucutTrustedModule -Times 1 -Exactly -ParameterFilter { $Root -eq 'C:\Accucut' -and $Release -eq 'C:\Accucut\releases\old1' }
        # Every check is made with a protected root; the logs folder lets the two service accounts write, and nobody else.
        Should -Invoke Assert-AccucutTrustedPath -Times 6 -Exactly -ParameterFilter { $Root -eq 'C:\Accucut' -and $ProtectedRoot }
        Should -Invoke Assert-AccucutTrustedPath -Times 1 -Exactly -ParameterFilter { $Path -eq 'C:\Accucut\logs' -and @($Writer).Count -eq 2 }
    }

    It 'also accepts the script as it is inside the running release folder' {
        { Import-AccucutUpdateEnvironment -Root 'C:\Accucut' -ScriptPath 'C:\Accucut\releases\old1\update.ps1' } | Should -Not -Throw
        Should -Invoke Import-AccucutTrustedModule -Times 1 -Exactly
    }

    It 'run from anywhere else (a download folder, the new release, the scratch folder, a copy) stops before anything is checked or loaded (<Where>)' -ForEach @(
        @{ Where = 'a download folder'; ScriptFile = 'C:\Users\someone\Downloads\update.ps1' }
        @{ Where = 'the new release'; ScriptFile = 'C:\Accucut\releases\new2\update.ps1' }
        @{ Where = 'the scratch folder'; ScriptFile = 'C:\Accucut\.in\abc\x\update.ps1' }
        @{ Where = 'the install folder itself'; ScriptFile = 'C:\Accucut\update.ps1' }
    ) {
        { Import-AccucutUpdateEnvironment -Root 'C:\Accucut' -ScriptPath $ScriptFile } | Should -Throw '*Run the installed update.ps1*Nothing was changed*'
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
        Should -Invoke Assert-AccucutTrustedPath -Times 0 -Exactly
    }

    It 'stops when it is not run as an administrator, before anything is checked' {
        Mock Test-AccucutScriptAdministrator { $false }
        { Import-AccucutUpdateEnvironment -Root 'C:\Accucut' -ScriptPath 'C:\Accucut\current\update.ps1' } | Should -Throw '*as an administrator*'
        $script:Trace.Count | Should -Be 0
    }

    It 'stops, and loads nothing, when current is not a junction into releases (links are refused)' {
        Mock Get-AccucutTrustedCurrent { throw "'C:\Accucut\current' is not a junction. Refusing to use the install." }
        { Import-AccucutUpdateEnvironment -Root 'C:\Accucut' -ScriptPath 'C:\Accucut\current\update.ps1' } | Should -Throw '*is not a junction*'
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
    }

    It 'does not load the module when a check of the module, the release folder or a folder above it fails (<Part>)' -ForEach @(
        @{ Part = 'the module'; Match = '*AccucutOps.psm1' }
        @{ Part = 'the release folder'; Match = 'C:\Accucut\releases\old1' }
        @{ Part = 'the script'; Match = '*\update.ps1' }
        @{ Part = 'config'; Match = '*\config' }
        @{ Part = 'logs'; Match = '*\logs' }
    ) {
        $script:FailLike = $Match
        Mock Assert-AccucutTrustedPath { if ($Path -like $script:FailLike) { throw "'$Path' can be changed by S-1-5-32-545, who is not an administrator." } }
        { Import-AccucutUpdateEnvironment -Root 'C:\Accucut' -ScriptPath 'C:\Accucut\current\update.ps1' } | Should -Throw '*can be changed by*'
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
    }

    It 'does not load the module when the running release holds a link' {
        Mock Assert-AccucutTrustedNoLinks { throw "'C:\Accucut\releases\old1\app' is a link." }
        { Import-AccucutUpdateEnvironment -Root 'C:\Accucut' -ScriptPath 'C:\Accucut\current\update.ps1' } | Should -Throw '*is a link*'
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
    }
}

Describe 'the service SID before the module is loaded' {
    It 'is the same as the module computes, for both services (the copy in update.ps1 may never drift)' {
        foreach ($name in 'AccucutApp', 'AccucutWorker') {
            Get-AccucutUpdateServiceSid -Name $name | Should -Be (Get-AccucutServiceSid -Name $name)
        }
        Get-AccucutUpdateServiceSid -Name 'TrustedInstaller' | Should -Be 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'
    }
}

Describe 'the release backup (AC-3)' {
    BeforeEach {
        Mock Invoke-AccucutTrustedScript { 0 }
    }

    It 'runs backup.ps1 of the running release through the checked wrapper, with -Reason release' {
        $release = Join-Path $TestDrive ('old-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path $release | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $release 'backup.ps1'), '# stand-in')
        $script:BackupRelease = $release
        Invoke-AccucutReleaseBackup -Root $TestDrive -OldRelease $release | Should -BeTrue
        Should -Invoke Invoke-AccucutTrustedScript -Times 1 -Exactly -ParameterFilter { $Path -eq (Join-Path $script:BackupRelease 'backup.ps1') -and (($ArgumentList -join ' ') -eq '-Reason release') }
    }

    It 'says there is none when the running release has no backup.ps1, and runs nothing' {
        Invoke-AccucutReleaseBackup -Root $TestDrive -OldRelease (Join-Path $TestDrive 'no-backup-here') | Should -BeFalse
        Should -Invoke Invoke-AccucutTrustedScript -Times 0 -Exactly
    }

    It 'stops the update when the backup fails' {
        $release = Join-Path $TestDrive ('old-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path $release | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $release 'backup.ps1'), '# stand-in')
        Mock Invoke-AccucutTrustedScript { 3 }
        { Invoke-AccucutReleaseBackup -Root $TestDrive -OldRelease $release } | Should -Throw '*backup.ps1 failed*'
    }
}

Describe 'Invoke-AccucutUpdate (AC-3, AC-4)' {
    BeforeEach {
        $script:Root = Join-Path $TestDrive ('u-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
        $script:Paths = Get-AccucutPaths -Root $script:Root
        $script:OldRelease = Join-Path $script:Paths.Releases 'old1'
        foreach ($directory in $script:Paths.Config, $script:Paths.Services, $script:Paths.Logs, $script:OldRelease) {
            New-Item -ItemType Directory -Path $directory -Force | Out-Null
        }
        [System.IO.File]::WriteAllText($script:Paths.StateFile, '{ "tag": "old1", "nodeExe": "C:\\fake\\node.exe", "port": 3000, "listenAddress": "0.0.0.0" }')
        foreach ($name in 'AccucutApp', 'AccucutWorker') { [System.IO.File]::WriteAllText((Join-Path $script:Paths.Services "$name.xml"), "<service>old $name</service>") }
        $script:Zip = Join-Path $TestDrive ('new-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.zip')
        [System.IO.File]::WriteAllText($script:Zip, 'a stand-in for the new release zip')
        $script:ZipHash = Get-AccucutTrustedSha256 -Path $script:Zip
        [System.IO.File]::WriteAllText("$($script:Zip).sha256", "$($script:ZipHash)  $(Split-Path -Leaf $script:Zip)`n")
        $script:Waits = 0
        $script:Logged = New-Object System.Collections.Generic.List[string]
        $script:Trace.Clear()

        Mock Assert-AccucutFreeSpace { }
        Mock Invoke-AccucutReleaseBackup { $script:Trace.Add('backup'); return $true }
        Mock Expand-AccucutTrustedPackage { $script:Trace.Add('expand'); return (Join-Path $script:Paths.Releases 'new2') }
        Mock Stop-AccucutServices { $script:Trace.Add('stop') }
        Mock Assert-AccucutTrustedPath { $script:Trace.Add("path:$(Split-Path -Leaf $Path)") }
        Mock Assert-AccucutTrustedNoLinks { $script:Trace.Add('nolinks') }
        Mock Resolve-AccucutTrustedExecutable { $Path }
        Mock Read-AccucutEnvFile { [ordered]@{ MIGRATE_DATABASE_URL = 'postgresql://accucut_owner:FAKEownerPassword1@127.0.0.1:5432/accucut' } }
        Mock Invoke-AccucutMigration { $script:Trace.Add('migrate'); return [pscustomobject]@{ Deploy = 'migrations applied'; Seed = 'seed ok' } }
        Mock Set-AccucutCurrentRelease { $script:Trace.Add("switch:$Tag") }
        Mock Initialize-AccucutServiceFiles { , @() }
        Mock Update-AccucutServiceProgram { }
        Mock Restore-AccucutServiceFiles { $script:Trace.Add('restore') }
        Mock Start-AccucutServices { $script:Trace.Add('start') }
        Mock Wait-AccucutHealth { $true }
        Mock Get-AccucutHttpStatus { 200 }
        Mock Remove-AccucutOldReleases { , @('older0') }
        Mock Remove-AccucutOldLogs { , @() }
        Mock Write-AccucutLog { $script:Logged.Add($Message) }
    }

    It 'AC-3: checks the zip, takes the release backup, unpacks the checked copy, stops, checks the new release, migrates, switches, starts, checks health, and keeps the current and the previous release only' {
        Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -HealthTimeoutSeconds 10
        ($script:Trace -join '|') | Should -Be 'backup|expand|stop|path:new2|nolinks|migrate|switch:new2|start'
        Should -Invoke Expand-AccucutTrustedPackage -Times 1 -Exactly -ParameterFilter { $Root -eq $script:Root -and $ZipPath -eq $script:Zip -and $Sha256 -eq $script:ZipHash -and $RefuseTag -eq 'old1' -and $ReplaceExisting }
        Should -Invoke Invoke-AccucutMigration -Times 1 -Exactly -ParameterFilter { $ReleaseDirectory -like '*\releases\new2' -and $MigrateDatabaseUrl -like '*accucut_owner*' }
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly -ParameterFilter { $Tag -eq 'old1' }
        Should -Invoke Wait-AccucutHealth -Times 1 -Exactly -ParameterFilter { $Url -eq 'http://127.0.0.1:3000/api/health' }
        Should -Invoke Remove-AccucutOldReleases -Times 1 -Exactly -ParameterFilter { $Keep -contains 'new2' -and $Keep -contains 'old1' -and $Keep.Count -eq 2 }
        (Get-Content -LiteralPath $script:Paths.StateFile -Raw | ConvertFrom-Json).tag | Should -Be 'new2'
        ($script:Logged -join "`n") | Should -BeLike '*Updated to new2 (previous: old1)*'
    }

    It 'resolves node and every WinSW program by full path before they are used, and refreshes only the services whose XML changed' {
        Mock Initialize-AccucutServiceFiles { , @('AccucutApp') }
        Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -HealthTimeoutSeconds 10
        Should -Invoke Resolve-AccucutTrustedExecutable -Times 1 -Exactly -ParameterFilter { $Path -eq 'C:\fake\node.exe' }
        Should -Invoke Resolve-AccucutTrustedExecutable -Times 1 -Exactly -ParameterFilter { $Path -eq (Join-Path $script:Paths.Services 'AccucutApp.exe') }
        Should -Invoke Resolve-AccucutTrustedExecutable -Times 1 -Exactly -ParameterFilter { $Path -eq (Join-Path $script:Paths.Services 'AccucutWorker.exe') }
        Should -Invoke Update-AccucutServiceProgram -Times 1 -Exactly -ParameterFilter { @($Name) -contains 'AccucutApp' -and @($Name).Count -eq 1 }
    }

    It 'AC-3: a changed zip is refused before the backup, before anything is unpacked and before a service stops' {
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Sha256 ('0' * 64) -Root $script:Root -OldRelease $script:OldRelease } | Should -Throw '*does not match*Nothing was changed*'
        $script:Trace.Count | Should -Be 0
    }

    It 'AC-3: stops before changing anything when the release backup cannot be taken' {
        Mock Invoke-AccucutReleaseBackup { throw 'backup failed on purpose' }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease } | Should -Throw '*backup failed on purpose*'
        Should -Invoke Expand-AccucutTrustedPackage -Times 0 -Exactly
        Should -Invoke Stop-AccucutServices -Times 0 -Exactly
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly
    }

    It 'AC-3: no backup script, no update, unless -NoBackup is given on purpose, and then it says so' {
        Mock Invoke-AccucutReleaseBackup { $false }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease } | Should -Throw '*no backup script*Nothing was changed*'
        Should -Invoke Stop-AccucutServices -Times 0 -Exactly
        Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -NoBackup
        Should -Invoke Invoke-AccucutReleaseBackup -Times 1 -Exactly
        Should -Invoke Set-AccucutCurrentRelease -Times 1 -Exactly -ParameterFilter { $Tag -eq 'new2' }
        ($script:Logged -join "`n") | Should -BeLike '*NO BACKUP WAS TAKEN*'
    }

    It 'never reuses an existing release folder: the unpacking is asked to replace it, and refuses the running release' {
        Mock Expand-AccucutTrustedPackage { throw 'Release old1 is already the running release. Nothing was changed.' }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -NoBackup } | Should -Throw '*already the running release*'
        Should -Invoke Stop-AccucutServices -Times 0 -Exactly
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly
    }

    It 'a copy of the zip that does not match (the zip was swapped after the first check) stops the update before a service stops' {
        Mock Expand-AccucutTrustedPackage { throw 'The SHA-256 of the copy of the zip does not match. Nothing was installed.' }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -NoBackup } | Should -Throw '*of the copy of the zip does not match*'
        Should -Invoke Stop-AccucutServices -Times 0 -Exactly
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly
    }

    It 'AC-4: when health fails, the junction moves back, the previous release starts, and it says "Call your IT person"' {
        Mock Wait-AccucutHealth { $script:Waits++; $script:Waits -ge 2 }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -HealthTimeoutSeconds 10 } | Should -Throw '*rolled back to old1*Call your IT person*'
        Should -Invoke Set-AccucutCurrentRelease -Times 1 -Exactly -ParameterFilter { $Tag -eq 'new2' }
        Should -Invoke Set-AccucutCurrentRelease -Times 1 -Exactly -ParameterFilter { $Tag -eq 'old1' }
        Should -Invoke Stop-AccucutServices -Times 2 -Exactly
        Should -Invoke Start-AccucutServices -Times 2 -Exactly
        Should -Invoke Restore-AccucutServiceFiles -Times 1 -Exactly
        Should -Invoke Remove-AccucutOldReleases -Times 0 -Exactly
        ($script:Logged -join "`n") | Should -BeLike '*Rolling back to old1*'
        ($script:Logged -join "`n") | Should -BeLike '*Release old1 is running again*'
        $script:Logged | Should -Contain 'Call your IT person.'
        (Get-Content -LiteralPath $script:Paths.StateFile -Raw | ConvertFrom-Json).tag | Should -Be 'old1'
    }

    It 'AC-4: a new release whose service cannot even start is rolled back the same way' {
        $script:Starts = 0
        Mock Start-AccucutServices { $script:Starts++; if ($script:Starts -eq 1) { throw 'the service did not respond in a timely fashion' } }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -HealthTimeoutSeconds 10 } | Should -Throw '*rolled back to old1*Call your IT person*'
        Should -Invoke Set-AccucutCurrentRelease -Times 1 -Exactly -ParameterFilter { $Tag -eq 'old1' }
        Should -Invoke Start-AccucutServices -Times 2 -Exactly
        Should -Invoke Wait-AccucutHealth -Times 1 -Exactly
        ($script:Logged -join "`n") | Should -BeLike '*A service did not start*'
    }

    It 'AC-4: says so loudly when the previous release does not answer either' {
        Mock Wait-AccucutHealth { $false }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -HealthTimeoutSeconds 10 } | Should -Throw '*Call your IT person*'
        ($script:Logged -join "`n") | Should -BeLike '*did not answer either. The portal is DOWN*'
    }

    It 'AC-4: when the migrations fail, the junction is not moved and the previous release is started again' {
        Mock Invoke-AccucutMigration { throw 'migration failed on purpose' }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -HealthTimeoutSeconds 10 } | Should -Throw '*stopped before the switch*old1 is running again*Call your IT person*'
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly
        Should -Invoke Stop-AccucutServices -Times 1 -Exactly
        Should -Invoke Start-AccucutServices -Times 1 -Exactly
        Should -Invoke Remove-AccucutOldReleases -Times 0 -Exactly
    }

    It 'checks the new release again after it is unpacked and the services are stopped: a link or a changed permission stops the update, with no migration and the old release running again' {
        Mock Assert-AccucutTrustedNoLinks { throw "'C:\Accucut\releases\new2\app' is a link." }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -HealthTimeoutSeconds 10 } | Should -Throw '*stopped before the switch*Call your IT person*'
        Should -Invoke Invoke-AccucutMigration -Times 0 -Exactly
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly
        Should -Invoke Start-AccucutServices -Times 1 -Exactly
        Mock Assert-AccucutTrustedPath { throw "'C:\Accucut\releases\new2' can be changed by S-1-5-32-545" }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -HealthTimeoutSeconds 10 } | Should -Throw '*stopped before the switch*'
        Should -Invoke Invoke-AccucutMigration -Times 0 -Exactly
    }

    It 'refuses a node.exe that fails the trust check, with no migration and the old release running again' {
        Mock Resolve-AccucutTrustedExecutable { throw "'C:\fake\node.exe' can be changed by S-1-5-32-545" }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease -HealthTimeoutSeconds 10 } | Should -Throw '*stopped before the switch*'
        Should -Invoke Invoke-AccucutMigration -Times 0 -Exactly
        Should -Invoke Start-AccucutServices -Times 1 -Exactly
    }

    It 'stops when nothing is installed, and when no zip is given' {
        { Invoke-AccucutUpdate -Root $script:Root -OldRelease $script:OldRelease } | Should -Throw '*Give the new release zip*'
        Remove-Item -LiteralPath $script:Paths.StateFile
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -OldRelease $script:OldRelease } | Should -Throw '*Run install.ps1 first*'
    }
}

Describe 'Restore-AccucutServiceFiles puts the service files back as they were' {
    It 'rewrites a changed XML and refreshes that service, and leaves an unchanged one alone' {
        $root = Join-Path $TestDrive ('r-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        $paths = Get-AccucutPaths -Root $root
        New-Item -ItemType Directory -Path $paths.Services -Force | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $paths.Services 'AccucutApp.xml'), '<service>new</service>')
        [System.IO.File]::WriteAllText((Join-Path $paths.Services 'AccucutWorker.xml'), '<service>same</service>')
        Mock Update-AccucutServiceProgram { }
        Restore-AccucutServiceFiles -Paths $paths -Snapshot @{ AccucutApp = '<service>old</service>'; AccucutWorker = '<service>same</service>' }
        (Get-Content -LiteralPath (Join-Path $paths.Services 'AccucutApp.xml') -Raw) | Should -Be '<service>old</service>'
        Should -Invoke Update-AccucutServiceProgram -Times 1 -Exactly -ParameterFilter { @($Name) -contains 'AccucutApp' }
        Should -Invoke Update-AccucutServiceProgram -Times 0 -Exactly -ParameterFilter { @($Name) -contains 'AccucutWorker' }
    }
}

Describe 'Start-AccucutServicesAndCheck always lets the caller reach its rollback' {
    It 'returns false, and logs a warning, when a service does not start; and the health answer otherwise' {
        Mock Write-AccucutLog { }
        Mock Start-AccucutServices { throw 'the service did not respond in a timely fashion' }
        Start-AccucutServicesAndCheck -HealthUrl 'http://127.0.0.1:3000/api/health' -TimeoutSeconds 10 | Should -BeFalse
        Should -Invoke Write-AccucutLog -Times 1 -Exactly -ParameterFilter { $Level -eq 'Warning' }
        Mock Start-AccucutServices { }
        Mock Wait-AccucutHealth { $true }
        Start-AccucutServicesAndCheck -HealthUrl 'http://127.0.0.1:3000/api/health' -TimeoutSeconds 10 | Should -BeTrue
    }
}
