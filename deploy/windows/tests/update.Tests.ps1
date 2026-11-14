#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of update.ps1 (STORY-10.04 AC-3 and AC-4), with services, programs, health and the zip mocked. The real update and the real
  rollback are proved by CI stage 13 on a Windows runner. All values here are invented and clearly fake.
#>

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    # Dot-sourcing defines the functions and does not run the update (the script runs it only when it is started, not sourced).
    . (Join-Path $script:WindowsDirectory 'update.ps1')
    $script:RealExpand = (Get-Command -Name Expand-AccucutZip -CommandType Function).ScriptBlock
}

Describe 'update.ps1' {
    BeforeEach {
        $script:Root = Join-Path $TestDrive ('u-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
        $script:Paths = Get-AccucutPaths -Root $script:Root
        foreach ($directory in $script:Paths.Config, $script:Paths.Services, $script:Paths.Logs, (Join-Path $script:Paths.Releases 'old1')) {
            New-Item -ItemType Directory -Path $directory -Force | Out-Null
        }
        [System.IO.File]::WriteAllText($script:Paths.StateFile, '{ "tag": "old1", "nodeExe": "C:\\fake\\node.exe", "port": 3000, "listenAddress": "0.0.0.0" }')
        foreach ($name in 'AccucutApp', 'AccucutWorker') { [System.IO.File]::WriteAllText((Join-Path $script:Paths.Services "$name.xml"), "<service>old $name</service>") }
        $script:Zip = Join-Path $TestDrive ('new-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.zip')
        [System.IO.File]::WriteAllText($script:Zip, 'a stand-in for the new release zip')
        $script:ZipHash = (Get-FileHash -LiteralPath $script:Zip -Algorithm SHA256).Hash.ToLowerInvariant()
        [System.IO.File]::WriteAllText("$($script:Zip).sha256", "$($script:ZipHash)  $(Split-Path -Leaf $script:Zip)`n")
        $script:Waits = 0
        $script:Logged = New-Object System.Collections.Generic.List[string]

        Mock Test-AccucutAdministrator { $true }
        Mock Get-AccucutCurrentRelease { 'old1' }
        Mock Assert-AccucutFreeSpace { }
        Mock Expand-AccucutZip {
            New-Item -ItemType Directory -Path $Destination -Force | Out-Null
            [System.IO.File]::WriteAllText((Join-Path $Destination 'release.json'), '{ "tag": "new2" }')
        }
        Mock Invoke-AccucutReleaseBackup { $true }
        Mock Stop-AccucutServices { }
        Mock Start-AccucutServices { }
        Mock Read-AccucutEnvFile { [ordered]@{ MIGRATE_DATABASE_URL = 'postgresql://accucut_owner:FAKEownerPassword1@127.0.0.1:5432/accucut' } }
        Mock Invoke-AccucutMigration { [pscustomobject]@{ Deploy = 'migrations applied'; Seed = 'seed ok' } }
        Mock Set-AccucutCurrentRelease { }
        Mock Initialize-AccucutServiceFiles { , @() }
        Mock Restore-AccucutServiceFiles { }
        Mock Wait-AccucutHealth { $true }
        Mock Get-AccucutHttpStatus { 200 }
        Mock Remove-AccucutOldReleases { , @('older0') }
        Mock Remove-AccucutOldLogs { , @() }
        Mock Remove-AccucutDirectory { }
        Mock Unblock-File { }
        Mock Write-AccucutLog { $script:Logged.Add($Message) }
    }

    It 'AC-3: checks the zip, takes the release backup, unpacks, stops, migrates, moves the junction, starts, checks health, and keeps the current and the previous release only' {
        Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -HealthTimeoutSeconds 10
        Should -Invoke Invoke-AccucutReleaseBackup -Times 1 -Exactly
        Should -Invoke Expand-AccucutZip -Times 1 -Exactly
        Should -Invoke Stop-AccucutServices -Times 1 -Exactly
        Should -Invoke Invoke-AccucutMigration -Times 1 -Exactly -ParameterFilter { $ReleaseDirectory -like '*\releases\new2' -and $MigrateDatabaseUrl -like '*accucut_owner*' }
        Should -Invoke Set-AccucutCurrentRelease -Times 1 -Exactly -ParameterFilter { $Tag -eq 'new2' }
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly -ParameterFilter { $Tag -eq 'old1' }
        Should -Invoke Start-AccucutServices -Times 1 -Exactly
        Should -Invoke Wait-AccucutHealth -Times 1 -Exactly -ParameterFilter { $Url -eq 'http://127.0.0.1:3000/api/health' }
        Should -Invoke Remove-AccucutOldReleases -Times 1 -Exactly -ParameterFilter { $Keep -contains 'new2' -and $Keep -contains 'old1' -and $Keep.Count -eq 2 }
        (Get-Content -LiteralPath $script:Paths.StateFile -Raw | ConvertFrom-Json).tag | Should -Be 'new2'
        Test-Path -LiteralPath (Join-Path $script:Paths.Releases 'new2\.zip-sha256') | Should -BeTrue
        ($script:Logged -join "`n") | Should -BeLike '*Updated to new2 (previous: old1)*'
    }

    It 'AC-3: a changed zip is refused before the backup, before anything is unpacked and before a service stops' {
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Sha256 ('0' * 64) -Root $script:Root } | Should -Throw '*does not match*Nothing was changed*'
        Should -Invoke Invoke-AccucutReleaseBackup -Times 0 -Exactly
        Should -Invoke Expand-AccucutZip -Times 0 -Exactly
        Should -Invoke Stop-AccucutServices -Times 0 -Exactly
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly
    }

    It 'AC-3: stops before changing anything when the release backup cannot be taken' {
        Mock Invoke-AccucutReleaseBackup { throw 'backup failed on purpose' }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root } | Should -Throw '*backup failed on purpose*'
        Should -Invoke Expand-AccucutZip -Times 0 -Exactly
        Should -Invoke Stop-AccucutServices -Times 0 -Exactly
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly
    }

    It 'AC-3: no backup script, no update, unless -NoBackup is given on purpose, and then it says so' {
        Mock Invoke-AccucutReleaseBackup { $false }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root } | Should -Throw '*no backup script*Nothing was changed*'
        Should -Invoke Stop-AccucutServices -Times 0 -Exactly
        Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -NoBackup
        Should -Invoke Invoke-AccucutReleaseBackup -Times 1 -Exactly
        Should -Invoke Set-AccucutCurrentRelease -Times 1 -Exactly -ParameterFilter { $Tag -eq 'new2' }
        ($script:Logged -join "`n") | Should -BeLike '*NO BACKUP WAS TAKEN*'
    }

    It 'AC-4: when health fails, the junction moves back, the previous release starts, and it says "Call your IT person"' {
        Mock Wait-AccucutHealth { $script:Waits++; $script:Waits -ge 2 }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -HealthTimeoutSeconds 10 } | Should -Throw '*rolled back to old1*Call your IT person*'
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
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -HealthTimeoutSeconds 10 } | Should -Throw '*rolled back to old1*Call your IT person*'
        Should -Invoke Set-AccucutCurrentRelease -Times 1 -Exactly -ParameterFilter { $Tag -eq 'old1' }
        Should -Invoke Start-AccucutServices -Times 2 -Exactly
        Should -Invoke Wait-AccucutHealth -Times 1 -Exactly
        ($script:Logged -join "`n") | Should -BeLike '*A service did not start*'
    }

    It 'AC-4: says so loudly when the previous release does not answer either' {
        Mock Wait-AccucutHealth { $false }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -HealthTimeoutSeconds 10 } | Should -Throw '*Call your IT person*'
        ($script:Logged -join "`n") | Should -BeLike '*did not answer either. The portal is DOWN*'
    }

    It 'AC-4: when the migrations fail, the junction is not moved and the previous release is started again' {
        Mock Invoke-AccucutMigration { throw 'migration failed on purpose' }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root -HealthTimeoutSeconds 10 } | Should -Throw '*stopped at the migrations*old1 is running again*Call your IT person*'
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly
        Should -Invoke Stop-AccucutServices -Times 1 -Exactly
        Should -Invoke Start-AccucutServices -Times 1 -Exactly
        Should -Invoke Remove-AccucutOldReleases -Times 0 -Exactly
    }

    It 'does nothing when the zip is the release that is already running' {
        New-Item -ItemType Directory -Path (Join-Path $script:Paths.Releases 'new2') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $script:Paths.Releases 'new2\.zip-sha256') -Value $script:ZipHash
        Mock Get-AccucutCurrentRelease { 'new2' }
        Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root
        Should -Invoke Stop-AccucutServices -Times 0 -Exactly
        Should -Invoke Set-AccucutCurrentRelease -Times 0 -Exactly
        ($script:Logged -join "`n") | Should -BeLike '*already the running release*'
    }

    It 'refuses a release folder of the same name that was made from a different zip' {
        New-Item -ItemType Directory -Path (Join-Path $script:Paths.Releases 'new2') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $script:Paths.Releases 'new2\.zip-sha256') -Value ('a' * 64)
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root } | Should -Throw '*made from a different zip*'
        Should -Invoke Stop-AccucutServices -Times 0 -Exactly
    }

    It 'stops when nothing is installed, and when it is not run as an administrator' {
        Remove-Item -LiteralPath $script:Paths.StateFile
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root } | Should -Throw '*Run install.ps1 first*'
        Mock Test-AccucutAdministrator { $false }
        { Invoke-AccucutUpdate -ZipPath $script:Zip -Root $script:Root } | Should -Throw '*as an administrator*'
    }

    It 'unpacks a zip safely: an entry that climbs out of the folder is refused' {
        Add-Type -AssemblyName System.IO.Compression
        $evil = Join-Path $TestDrive 'evil.zip'
        $stream = [System.IO.File]::Create($evil)
        $archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
        $entry = $archive.CreateEntry('..\escaped.txt')
        $writer = New-Object System.IO.StreamWriter($entry.Open())
        $writer.Write('x')
        $writer.Dispose()
        $archive.Dispose()
        $stream.Dispose()
        # Expand-AccucutZip is mocked in BeforeEach for the other tests; the real one was kept in BeforeAll.
        { & $script:RealExpand -ZipPath $evil -Destination (Join-Path $TestDrive 'unpacked') } | Should -Throw '*outside its folder*'
        Test-Path -LiteralPath (Join-Path $TestDrive 'escaped.txt') | Should -BeFalse
    }
}
