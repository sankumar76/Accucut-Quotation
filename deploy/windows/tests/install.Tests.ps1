#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of install.ps1 (STORY-10.04), with every prompt, program and Windows service call mocked. The real install is proved by CI
  stage 13 on a Windows runner. All values here are invented and clearly fake.
#>

BeforeDiscovery {
    $principal = New-Object System.Security.Principal.WindowsPrincipal([System.Security.Principal.WindowsIdentity]::GetCurrent())
    $script:IsAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    # Dot-sourcing defines the functions and does not run the install (the script runs it only when it is started, not sourced).
    . (Join-Path $script:WindowsDirectory 'install.ps1')

    $script:FakeOwnerPassword = 'FAKEownerPassword0001'
    $script:FakeAppPassword = 'FAKEappPassword00002'
    $script:FakeAdminPassword = 'Fake-first-pass-3!'
    $script:FakePgPassword = 'FAKE-pg-admin-pass-4'
    $script:Template = Read-AccucutEnvTemplate -Path (Join-Path $script:WindowsDirectory '..\..\.env.example')

    function Write-FakeValuesFile {
        param([string]$Name = 'values.txt', [string[]]$Extra = @())
        $file = Join-Path $TestDrive $Name
        $lines = @(
            'APP_ORIGIN=http://server.example.test:3000'
            'ADMIN_EMAIL=first.admin@example.test'
            "ADMIN_INITIAL_PASSWORD=$($script:FakeAdminPassword)"
            "PG_SUPERUSER_PASSWORD=$($script:FakePgPassword)"
            "DB_OWNER_PASSWORD=$($script:FakeOwnerPassword)"
            "DB_APP_PASSWORD=$($script:FakeAppPassword)"
        ) + $Extra
        [System.IO.File]::WriteAllText($file, ($lines -join "`n"))
        return $file
    }
}

Describe 'install.ps1 refuses before it changes anything (AC-1, AC-5)' {
    It 'stops when it is not run as an administrator' {
        Mock Test-InstallerIsAdministrator { $false }
        { Start-AccucutInstall -ZipPath 'x.zip' -Root (Join-Path $TestDrive 'a1') } | Should -Throw '*as an administrator*'
        Test-Path -LiteralPath (Join-Path $TestDrive 'a1') | Should -BeFalse
    }

    It 'stops when no zip is given, or its SHA-256 is missing or wrong, and creates nothing' {
        Mock Test-InstallerIsAdministrator { $true }
        $root = Join-Path $TestDrive 'a2'
        { Start-AccucutInstall -Root $root } | Should -Throw '*Give the release zip*'
        $zip = Join-Path $TestDrive 'pkg.zip'
        [System.IO.File]::WriteAllText($zip, 'a stand-in for a zip')
        { Start-AccucutInstall -ZipPath $zip -Root $root } | Should -Throw '*No SHA-256 given*'
        { Start-AccucutInstall -ZipPath $zip -Sha256 ('0' * 64) -Root $root } | Should -Throw '*does not match*Nothing was changed*'
        Test-Path -LiteralPath $root | Should -BeFalse
    }
}

Describe 'the first half: a locked install folder and a release unpacked from the checked zip (security review)' {
    BeforeAll {
        # A small but real release zip: what the first half reads from it is what the test looks for afterwards.
        function New-TestReleaseZip {
            param([string]$Name, [string]$Tag)
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $source = Join-Path $TestDrive "src-$Name"
            New-Item -ItemType Directory -Path (Join-Path $source 'sql'), (Join-Path $source 'bin') -Force | Out-Null
            [System.IO.File]::WriteAllText((Join-Path $source 'release.json'), "{ `"tag`": `"$Tag`" }")
            [System.IO.File]::WriteAllText((Join-Path $source 'install.ps1'), '# the real script, from the zip')
            [System.IO.File]::WriteAllText((Join-Path $source 'AccucutOps.psm1'), '# the real module, from the zip')
            [System.IO.File]::WriteAllText((Join-Path $source '.env.example'), 'APP_ORIGIN=http://localhost:3000')
            [System.IO.File]::WriteAllText((Join-Path $source 'sql\create-roles.psql'), '-- the real SQL, from the zip')
            $zip = Join-Path $TestDrive "$Name.zip"
            [System.IO.Compression.ZipFile]::CreateFromDirectory($source, $zip)
            return $zip
        }
        $script:Zip = New-TestReleaseZip -Name 'good' -Tag 't-ok'
        $script:ZipHash = (Get-FileHash -LiteralPath $script:Zip -Algorithm SHA256).Hash.ToLowerInvariant()
    }

    BeforeEach {
        Mock Set-AccucutDirectoryAcl { }
        Mock Get-AccucutPathOwner { 'S-1-5-32-544' }
        # The real permission checks read the test machine's own folders; the tests of those checks are further down, on folders that the tests lock themselves.
        Mock Get-AccucutNonAdminWriters { , @() }
        Mock New-AccucutLockedDirectory { New-Item -ItemType Directory -Path $Path | Out-Null }
    }

    It 'makes a new install folder WITH its locked permissions in one call, copies the zip in, checks the copy and unpacks the copy: every file comes from the release folder' {
        $root = Join-Path $TestDrive 'fresh-root'
        $release = Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $root
        $release | Should -Be (Join-Path $root 'releases\t-ok')
        Get-Content -LiteralPath (Join-Path $release 'install.ps1') -Raw | Should -BeLike '*from the zip*'
        (Get-Content -LiteralPath (Join-Path $release '.zip-sha256') -Raw).Trim() | Should -Be $script:ZipHash
        Test-Path -LiteralPath (Join-Path $root '.in') | Should -BeFalse
        # One call makes the folder locked: no separate step sets the permissions afterwards, so there is no window in between.
        Should -Invoke New-AccucutLockedDirectory -Times 1 -Exactly -ParameterFilter { $Path -eq $root }
        Should -Invoke Set-AccucutDirectoryAcl -Times 0 -Exactly
    }

    It 'takes the expected hash from the .sha256 file next to the zip' {
        $zip = Join-Path $TestDrive 'withfile.zip'
        Copy-Item -LiteralPath $script:Zip -Destination $zip
        [System.IO.File]::WriteAllText("$zip.sha256", "$($script:ZipHash)  withfile.zip`n")
        { Initialize-AccucutVerifiedRelease -ZipPath $zip -Root (Join-Path $TestDrive 'root-sha-file') } | Should -Not -Throw
        [System.IO.File]::WriteAllText("$zip.sha256", ('f' * 64) + "  withfile.zip`n")
        { Initialize-AccucutVerifiedRelease -ZipPath $zip -Root (Join-Path $TestDrive 'root-sha-file-2') } | Should -Throw '*does not match*'
        Test-Path -LiteralPath (Join-Path $TestDrive 'root-sha-file-2') | Should -BeFalse
    }

    It 'accepts an existing EMPTY folder owned by Administrators, and locks it (owner and list reset)' {
        $root = Join-Path $TestDrive 'empty-admin-root'
        New-Item -ItemType Directory -Path $root | Out-Null
        Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $root | Should -Be (Join-Path $root 'releases\t-ok')
        Should -Invoke Set-AccucutDirectoryAcl -Times 1 -Exactly -ParameterFilter { $Path -eq $root }
        Should -Invoke New-AccucutLockedDirectory -Times 0 -Exactly
    }

    It 'refuses an existing empty folder whose permissions let another user write or delete, and does not touch it' {
        Mock Get-AccucutNonAdminWriters { , @('S-1-5-32-545') }
        $root = Join-Path $TestDrive 'empty-but-writable-root'
        New-Item -ItemType Directory -Path $root | Out-Null
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $root } | Should -Throw '*can be changed by S-1-5-32-545*'
        Should -Invoke Set-AccucutDirectoryAcl -Times 0 -Exactly
        @(Get-ChildItem -LiteralPath $root -Force).Count | Should -Be 0
    }

    It 'refuses a folder that someone else made after the check (CreateDirectory returns theirs), and removes nothing of theirs' {
        # Simulates the race: the folder exists, owned by another user, when the locked creation runs.
        $root = Join-Path $TestDrive 'raced-root'
        Mock New-AccucutLockedDirectory { New-Item -ItemType Directory -Path $Path | Out-Null; New-Item -ItemType Directory -Path (Join-Path $Path 'releases') | Out-Null }
        Mock Get-AccucutPathOwner { 'S-1-5-21-1111111111-2222222222-3333333333-1001' }
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $root } | Should -Throw '*is owned by S-1-5-21-1111111111-2222222222-3333333333-1001*'
        Test-Path -LiteralPath (Join-Path $root 'releases') | Should -BeTrue
    }

    It 'accepts an empty folder owned by SYSTEM' {
        Mock Get-AccucutPathOwner { 'S-1-5-18' }
        $root = Join-Path $TestDrive 'empty-system-root'
        New-Item -ItemType Directory -Path $root | Out-Null
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $root } | Should -Not -Throw
    }

    It 'refuses a folder that already holds anything, changes nothing in it, and does not lock it' {
        $root = Join-Path $TestDrive 'busy-root'
        New-Item -ItemType Directory -Path (Join-Path $root 'releases') -Force | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $root 'planted.txt'), 'planted by someone else')
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $root } | Should -Throw '*not empty*Nothing was changed*'
        Should -Invoke Set-AccucutDirectoryAcl -Times 0 -Exactly
        Get-Content -LiteralPath (Join-Path $root 'planted.txt') -Raw | Should -Be 'planted by someone else'
        Test-Path -LiteralPath (Join-Path $root 'releases\t-ok') | Should -BeFalse
    }

    It 'refuses an existing folder owned by someone else, even when it is empty' {
        Mock Get-AccucutPathOwner { 'S-1-5-21-1111111111-2222222222-3333333333-1001' }
        $root = Join-Path $TestDrive 'foreign-root'
        New-Item -ItemType Directory -Path $root | Out-Null
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $root } | Should -Throw '*owned by S-1-5-21-1111111111-2222222222-3333333333-1001, not by Administrators or SYSTEM*'
        Should -Invoke Set-AccucutDirectoryAcl -Times 0 -Exactly
        @(Get-ChildItem -LiteralPath $root -Force).Count | Should -Be 0
    }

    It 'refuses a link (a junction) in place of the folder, a file, and a path that is not a full local path' {
        $target = Join-Path $TestDrive 'link-target'
        New-Item -ItemType Directory -Path $target | Out-Null
        $junction = Join-Path $TestDrive 'link-root'
        New-Item -ItemType Junction -Path $junction -Target $target | Out-Null
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $junction } | Should -Throw '*is a link*'
        $file = Join-Path $TestDrive 'a-file-root'
        [System.IO.File]::WriteAllText($file, 'x')
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $file } | Should -Throw '*exists and is a file*'
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root 'relative\accucut' } | Should -Throw '*full local path*'
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root '\\server\share\accucut' } | Should -Throw '*full local path*'
        @(Get-ChildItem -LiteralPath $target -Force).Count | Should -Be 0
        Should -Invoke Set-AccucutDirectoryAcl -Times 0 -Exactly
    }

    It 'does not use a tampered unpacked folder that sits next to a valid zip: only the zip is read' {
        $tampered = Join-Path $TestDrive 'unpacked-and-tampered'
        New-Item -ItemType Directory -Path (Join-Path $tampered 'sql') -Force | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $tampered 'release.json'), '{ "tag": "evil" }')
        [System.IO.File]::WriteAllText((Join-Path $tampered 'install.ps1'), '# EVIL script')
        [System.IO.File]::WriteAllText((Join-Path $tampered 'sql\create-roles.psql'), '-- EVIL SQL')
        $root = Join-Path $TestDrive 'root-with-tampered-neighbour'
        $release = Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $root
        Split-Path -Leaf $release | Should -Be 't-ok'
        Test-Path -LiteralPath (Join-Path $root 'releases\evil') | Should -BeFalse
        Get-Content -LiteralPath (Join-Path $release 'install.ps1') -Raw | Should -Not -BeLike '*EVIL*'
        Get-Content -LiteralPath (Join-Path $release 'sql\create-roles.psql') -Raw | Should -Not -BeLike '*EVIL*'
        Get-Content -LiteralPath (Join-Path $release 'release.json') -Raw | Should -BeLike '*t-ok*'
    }

    It 'a zip that is swapped after its first check is caught by the check of the copy, and what was made is removed again' {
        Mock Copy-Item { [System.IO.File]::WriteAllText($Destination, 'swapped for something else') }
        $root = Join-Path $TestDrive 'root-with-swap'
        { Initialize-AccucutVerifiedRelease -ZipPath $script:Zip -Sha256 $script:ZipHash -Root $root } | Should -Throw '*copy of the zip does not match*'
        Test-Path -LiteralPath $root | Should -BeFalse
    }

    It 'a zip whose entry climbs out of the folder is refused and nothing is left behind' {
        Add-Type -AssemblyName System.IO.Compression
        $evil = Join-Path $TestDrive 'climbing.zip'
        $stream = [System.IO.File]::Create($evil)
        $archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
        $entry = $archive.CreateEntry('..\..\escaped.txt')
        $writer = New-Object System.IO.StreamWriter($entry.Open())
        $writer.Write('x')
        $writer.Dispose()
        $archive.Dispose()
        $stream.Dispose()
        $hash = (Get-FileHash -LiteralPath $evil -Algorithm SHA256).Hash.ToLowerInvariant()
        $root = Join-Path $TestDrive 'root-climbing'
        { Initialize-AccucutVerifiedRelease -ZipPath $evil -Sha256 $hash -Root $root } | Should -Throw '*outside its folder*'
        Test-Path -LiteralPath $root | Should -BeFalse
        Test-Path -LiteralPath (Join-Path $TestDrive 'escaped.txt') | Should -BeFalse
    }

    It 'runs the copy of install.ps1 from the verified release folder, passing it where that is' {
        $verified = Join-Path $TestDrive 'verified-release'
        New-Item -ItemType Directory -Path $verified | Out-Null
        $marker = Join-Path $TestDrive 'second-half-ran.txt'
        [System.IO.File]::WriteAllText((Join-Path $verified 'install.ps1'), "param(`$VerifiedRelease)`n[System.IO.File]::WriteAllText('$marker', `$VerifiedRelease)`nexit 0`n")
        $script:MarkerPath = $marker
        $script:Order = New-Object System.Collections.Generic.List[string]
        Mock Test-InstallerIsAdministrator { $true }
        Mock Initialize-AccucutVerifiedRelease { $verified }
        # The trust check runs right before the verified script is started: when it runs, the script has not run yet.
        Mock Assert-AccucutLockedInstallRoot { $script:Order.Add("assert (script already ran: $(Test-Path -LiteralPath $script:MarkerPath))") }
        Start-AccucutInstall -ZipPath 'ignored.zip' -Root (Join-Path $TestDrive 'any-root')
        Get-Content -LiteralPath $marker -Raw | Should -Be $verified
        $script:Order | Should -Be @('assert (script already ran: False)')
        Should -Invoke Assert-AccucutLockedInstallRoot -Times 1 -Exactly -ParameterFilter { $VerifiedRelease -like '*verified-release' }
    }

    It 'fails when the second half does not finish' {
        $verified = Join-Path $TestDrive 'verified-release-2'
        New-Item -ItemType Directory -Path $verified | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $verified 'install.ps1'), "param(`$VerifiedRelease)`nexit 1`n")
        Mock Test-InstallerIsAdministrator { $true }
        Mock Initialize-AccucutVerifiedRelease { $verified }
        Mock Assert-AccucutLockedInstallRoot { }
        { Start-AccucutInstall -ZipPath 'ignored.zip' -Root (Join-Path $TestDrive 'any-root-2') } | Should -Throw '*did not finish*'
    }

    It 'does not start the verified script when the trust check fails right before it' {
        $verified = Join-Path $TestDrive 'verified-release-3'
        New-Item -ItemType Directory -Path $verified | Out-Null
        $marker = Join-Path $TestDrive 'must-not-run.txt'
        [System.IO.File]::WriteAllText((Join-Path $verified 'install.ps1'), "param(`$VerifiedRelease)`n[System.IO.File]::WriteAllText('$marker', 'ran')`nexit 0`n")
        Mock Test-InstallerIsAdministrator { $true }
        Mock Initialize-AccucutVerifiedRelease { $verified }
        Mock Assert-AccucutLockedInstallRoot { throw "'C:\Accucut\releases' is a link, not a real folder. Refusing to use it." }
        { Start-AccucutInstall -ZipPath 'ignored.zip' -Root (Join-Path $TestDrive 'any-root-3') } | Should -Throw '*is a link*'
        Test-Path -LiteralPath $marker | Should -BeFalse
    }

    It 'the second half runs the trust check BEFORE it loads the module from the folder, and loads nothing if the check fails' {
        $script:Order = New-Object System.Collections.Generic.List[string]
        Mock Assert-AccucutLockedInstallRoot { $script:Order.Add('assert') }
        Mock Import-Module { $script:Order.Add('import') }
        Mock Invoke-AccucutInstall { $script:Order.Add('install') }
        Start-AccucutInstall -Root (Join-Path $TestDrive 'second-root') -VerifiedRelease (Join-Path $TestDrive 'second-root\releases\t-ok')
        ($script:Order -join ',') | Should -Be 'assert,import,install'

        $script:Order.Clear()
        Mock Assert-AccucutLockedInstallRoot { throw 'swapped' }
        { Start-AccucutInstall -Root (Join-Path $TestDrive 'second-root') -VerifiedRelease (Join-Path $TestDrive 'second-root\releases\t-ok') } | Should -Throw '*swapped*'
        $script:Order.Count | Should -Be 0
    }

    It 'a junction at the install folder or at releases is refused by the trust check, and so is a release that is not directly inside releases' {
        $target = Join-Path $TestDrive 'trust-elsewhere'
        New-Item -ItemType Directory -Path (Join-Path $target 'releases\t-ok') -Force | Out-Null
        $junctionRoot = Join-Path $TestDrive 'junction-root'
        New-Item -ItemType Junction -Path $junctionRoot -Target $target | Out-Null
        { Assert-AccucutLockedInstallRoot -Root $junctionRoot -VerifiedRelease (Join-Path $junctionRoot 'releases\t-ok') } | Should -Throw '*is a link*'

        $root = Join-Path $TestDrive 'real-root-junction-releases'
        New-Item -ItemType Directory -Path $root | Out-Null
        New-Item -ItemType Junction -Path (Join-Path $root 'releases') -Target $target | Out-Null
        { Assert-AccucutLockedInstallRoot -Root $root } | Should -Throw '*releases*is a link*'

        $good = Join-Path $TestDrive 'real-root-ok'
        New-Item -ItemType Directory -Path (Join-Path $good 'releases\t-ok'), (Join-Path $good 'elsewhere\t-ok') -Force | Out-Null
        { Assert-AccucutLockedInstallRoot -Root $good -VerifiedRelease (Join-Path $good 'releases\t-ok') } | Should -Not -Throw
        { Assert-AccucutLockedInstallRoot -Root $good -VerifiedRelease (Join-Path $good 'elsewhere\t-ok') } | Should -Throw '*is not directly inside*'
        $releaseLink = Join-Path $good 'releases\t-link'
        New-Item -ItemType Junction -Path $releaseLink -Target (Join-Path $good 'elsewhere\t-ok') | Out-Null
        { Assert-AccucutLockedInstallRoot -Root $good -VerifiedRelease $releaseLink } | Should -Throw '*is a link*'
    }

    It 'the trust check refuses a parent folder in which another user could delete or replace the install folder, and a folder owned or writable by someone else' {
        Mock Get-AccucutNonAdminWriters { param($Path, [switch]$ParentCheck) if ($ParentCheck) { , @('S-1-5-32-545') } else { , @() } }
        $root = Join-Path $TestDrive 'parent-swappable-root'
        New-Item -ItemType Directory -Path (Join-Path $root 'releases') -Force | Out-Null
        { Assert-AccucutLockedInstallRoot -Root $root } | Should -Throw '*could be replaced*'
        Mock Get-AccucutNonAdminWriters { , @('S-1-5-32-545') }
        { Assert-AccucutBootstrapFolder -Path $root } | Should -Throw '*can be changed by S-1-5-32-545*'
        Mock Get-AccucutNonAdminWriters { , @() }
        Mock Get-AccucutPathOwner { 'S-1-5-21-1-2-3-1001' }
        { Assert-AccucutBootstrapFolder -Path $root } | Should -Throw '*is owned by S-1-5-21-1-2-3-1001*'
    }

    It 'a locked folder is made in one call with Administrators as owner, no inheritance and Administrators and SYSTEM only' -Skip:(-not $script:IsAdmin) {
        $folder = Join-Path $TestDrive 'really-locked'
        New-AccucutLockedDirectory -Path $folder
        $security = [System.IO.Directory]::GetAccessControl($folder)
        $security.AreAccessRulesProtected | Should -BeTrue
        $security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value | Should -Be 'S-1-5-32-544'
        @($security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique) | Should -Be @('S-1-5-18', 'S-1-5-32-544')
        (Get-AccucutNonAdminWriters -Path $folder).Count | Should -Be 0
    }

    It 'the second half refuses to run from anywhere but the verified release folder' {
        Mock Test-InstallerIsAdministrator { $true }
        $root = Join-Path $TestDrive 'second-half-root'
        $elsewhere = Join-Path $TestDrive 'unpacked-elsewhere'
        New-Item -ItemType Directory -Path $elsewhere, (Join-Path $root 'releases\t-x') -Force | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $elsewhere 'release.json'), '{ "tag": "t-x" }')
        { Invoke-AccucutInstall -NonInteractive -Root $root -PackageRoot $elsewhere } | Should -Throw '*not the verified release folder*'
    }
}

Describe 'the answers (AC-1, AC-5)' {
    It 'reads the answers from a values file and invents the rest, differently each time, with no question asked' {
        Mock Read-AccucutHostInput { throw 'must not ask' }
        Mock Read-AccucutSecretInput { throw 'must not ask' }
        $file = Write-FakeValuesFile
        $first = Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut'
        $first.Values['APP_ORIGIN'] | Should -Be 'http://server.example.test:3000'
        $first.Values['ADMIN_EMAIL'] | Should -Be 'first.admin@example.test'
        $first.PgSuperuserPassword | Should -Be $script:FakePgPassword
        $first.Values['DATABASE_URL'] | Should -Be "postgresql://accucut_app:$($script:FakeAppPassword)@127.0.0.1:5432/accucut"
        $first.Values['MIGRATE_DATABASE_URL'] | Should -Be "postgresql://accucut_owner:$($script:FakeOwnerPassword)@127.0.0.1:5432/accucut"
        $first.Values['AUTH_SECRET'].Length | Should -BeGreaterOrEqual 32
        $second = Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut'
        $second.Values['AUTH_SECRET'] | Should -Not -Be $first.Values['AUTH_SECRET']
    }

    It 'invents both database passwords when the values file has none' {
        $file = Join-Path $TestDrive 'min.txt'
        [System.IO.File]::WriteAllText($file, "ADMIN_EMAIL=a@example.test`nADMIN_INITIAL_PASSWORD=$($script:FakeAdminPassword)`nPG_SUPERUSER_PASSWORD=$($script:FakePgPassword)`n")
        $settings = Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut'
        $settings.OwnerPassword.Length | Should -Be 32
        $settings.AppPassword.Length | Should -Be 32
        $settings.OwnerPassword | Should -Not -Be $settings.AppPassword
    }

    It 'names what is missing in an unattended run, and never prints a value' {
        $file = Join-Path $TestDrive 'nomail.txt'
        [System.IO.File]::WriteAllText($file, "ADMIN_INITIAL_PASSWORD=$($script:FakeAdminPassword)`nPG_SUPERUSER_PASSWORD=$($script:FakePgPassword)`n")
        { Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' } | Should -Throw '*ADMIN_EMAIL*'
        try { Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' } catch { $_.Exception.Message | Should -Not -BeLike "*$($script:FakeAdminPassword)*" }
    }

    It 'asks the questions (prompts are small functions) and blanks the secret answers in later logs' {
        Mock Read-AccucutHostInput { param($Prompt, $Default) if ($Prompt -like '*first Admin*') { 'asked.admin@example.test' } else { $Default } }
        Mock Read-AccucutSecretInput {
            param($Prompt)
            if ($Prompt -like '*first password*') { 'Typed-by-the-person-5!' } else { 'typed-pg-admin-pass-6' }
        }
        $settings = Get-AccucutInstallSettings -Template $script:Template -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut'
        $settings.Values['ADMIN_EMAIL'] | Should -Be 'asked.admin@example.test'
        $settings.Values['ADMIN_INITIAL_PASSWORD'] | Should -Be 'Typed-by-the-person-5!'
        (Hide-AccucutSecrets -Text 'x Typed-by-the-person-5! y typed-pg-admin-pass-6') | Should -Be 'x *** y ***'
    }

    It 'refuses a weak first password, an origin with a path, and a database password that would break a URL' {
        $weak = Write-FakeValuesFile -Name 'weak.txt' -Extra @('ADMIN_INITIAL_PASSWORD=short1!')
        { Get-AccucutInstallSettings -Template $script:Template -ValuesFile $weak -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' } | Should -Throw '*ADMIN_INITIAL_PASSWORD*'
        $path = Write-FakeValuesFile -Name 'path.txt' -Extra @('APP_ORIGIN=http://server.example.test/portal')
        { Get-AccucutInstallSettings -Template $script:Template -ValuesFile $path -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' } | Should -Throw '*APP_ORIGIN*'
        $symbol = Write-FakeValuesFile -Name 'symbol.txt' -Extra @('DB_APP_PASSWORD=has@symbol')
        { Get-AccucutInstallSettings -Template $script:Template -ValuesFile $symbol -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' } | Should -Throw '*letters and digits only*'
    }
}

Describe 'no secret on a command line (AC-5)' {
    It 'passes the PostgreSQL administrator password to psql in the environment, never in the arguments' {
        Mock Invoke-AccucutNative { [pscustomobject]@{ ExitCode = 0; Output = '0' } }
        $connection = @{ Host = '127.0.0.1'; Port = 5432; User = 'postgres'; Password = $script:FakePgPassword }
        Invoke-AccucutPsql -PsqlPath 'C:\pg\psql.exe' -Connection $connection -Database 'postgres' -Command 'SELECT 1' | Out-Null
        Invoke-AccucutPsql -PsqlPath 'C:\pg\psql.exe' -Connection $connection -Database 'accucut' -File 'C:\x\create-roles.psql' `
            -ExtraEnvironment @{ DB_OWNER_PASSWORD = $script:FakeOwnerPassword; DB_APP_PASSWORD = $script:FakeAppPassword; POSTGRES_DB = 'accucut' } | Out-Null
        Should -Invoke Invoke-AccucutNative -Times 2 -Exactly -ParameterFilter { $Environment['PGPASSWORD'] -eq 'FAKE-pg-admin-pass-4' -and ($ArgumentList -join ' ') -notlike '*FAKE*' }
        Should -Invoke Invoke-AccucutNative -Times 1 -Exactly -ParameterFilter {
            $Environment['DB_OWNER_PASSWORD'] -eq 'FAKEownerPassword0001' -and $Environment['DB_APP_PASSWORD'] -eq 'FAKEappPassword00002' -and ($ArgumentList -join ' ') -like '*--file C:\x\create-roles.psql*'
        }
        Should -Invoke Invoke-AccucutNative -Times 2 -Exactly -ParameterFilter { $ArgumentList -contains '-w' -and $ArgumentList -contains 'ON_ERROR_STOP=1' }
    }

    It 'the role SQL reads the passwords from the environment, so they are never in the file or on the command line' {
        $sql = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory '..\db\create-roles.psql') -Raw
        $sql | Should -BeLike '*\getenv owner_password DB_OWNER_PASSWORD*'
        $sql | Should -BeLike '*\getenv app_password DB_APP_PASSWORD*'
        $sql | Should -Not -Match "PASSWORD\s+'[^']+'"
    }
}

Describe 'Windows Defender (AC-7)' {
    BeforeAll {
        # A stand-in for the Defender command, which a build machine may not have, so that the test can watch it being called.
        function Add-MpPreference { param($ExclusionPath, $ErrorAction) }
    }

    It 'excludes the data folder and says so when asked to (Yes)' {
        Mock Add-MpPreference { }
        Mock Write-AccucutLog { }
        Set-AccucutDefenderExclusion -Path 'C:\PostgreSQL\17\data' -Decision Yes | Should -BeTrue
        Should -Invoke Add-MpPreference -Times 1 -Exactly -ParameterFilter { $ExclusionPath -eq 'C:\PostgreSQL\17\data' }
        Should -Invoke Write-AccucutLog -ParameterFilter { $Message -like '*now excluded from real-time scanning*Remove-MpPreference*' }
        Should -Invoke Write-AccucutLog -ParameterFilter { $Message -like '*advises excluding its data folder*' }
    }

    It 'does nothing when declined, and says so (No, and an unattended Ask)' {
        Mock Add-MpPreference { }
        Mock Write-AccucutLog { }
        Set-AccucutDefenderExclusion -Path 'C:\PostgreSQL\17\data' -Decision No | Should -BeFalse
        Set-AccucutDefenderExclusion -Path 'C:\PostgreSQL\17\data' -Decision Ask -NonInteractive | Should -BeFalse
        Should -Invoke Add-MpPreference -Times 0 -Exactly
        Should -Invoke Write-AccucutLog -Times 2 -Exactly -ParameterFilter { $Message -like '*no exclusion was made (declined)*' }
    }

    It 'asks the person when the decision is Ask, and honours the answer' {
        Mock Add-MpPreference { }
        Mock Write-AccucutLog { }
        Mock Read-AccucutHostInput { 'yes' }
        Set-AccucutDefenderExclusion -Path 'C:\PostgreSQL\17\data' -Decision Ask | Should -BeTrue
        Mock Read-AccucutHostInput { 'no' }
        Set-AccucutDefenderExclusion -Path 'C:\PostgreSQL\17\data' -Decision Ask | Should -BeFalse
        Should -Invoke Add-MpPreference -Times 1 -Exactly
    }

    It 'goes on with a warning when Defender refuses (another product may manage it)' {
        Mock Add-MpPreference { throw 'managed by policy' }
        Mock Write-AccucutLog { }
        Set-AccucutDefenderExclusion -Path 'C:\PostgreSQL\17\data' -Decision Yes | Should -BeFalse
        Should -Invoke Write-AccucutLog -ParameterFilter { $Level -eq 'Warning' -and $Message -like '*could not be made*' }
    }
}

Describe 'the second half reads only from the verified release folder, and a failed install leaves nothing behind (AC-1, security review)' {
    BeforeAll {
        $script:LoggedMessages = New-Object System.Collections.Generic.List[string]

        # What the first half leaves: the locked install folder with the unpacked release in releases\<tag>. The content of the folder that IT
        # unpacked the zip into (here, $script:Unverified) is deliberately different and must never be read.
        function New-VerifiedReleaseFolder {
            param([string]$Name, [string]$Tag)
            $root = Join-Path $TestDrive $Name
            $release = Join-Path $root "releases\$Tag"
            New-Item -ItemType Directory -Path (Join-Path $release 'sql') -Force | Out-Null
            Copy-Item -LiteralPath (Join-Path $script:WindowsDirectory '..\..\.env.example') -Destination (Join-Path $release '.env.example')
            Set-Content -LiteralPath (Join-Path $release 'sql\create-roles.psql') -Value '-- the verified SQL'
            return [pscustomobject]@{ Root = $root; Release = $release }
        }
        $script:Unverified = Join-Path $TestDrive 'unverified-unpacked'
        New-Item -ItemType Directory -Path $script:Unverified | Out-Null
        Set-Content -LiteralPath (Join-Path $script:Unverified '.env.example') -Value 'APP_ORIGIN=http://evil.example'
    }

    BeforeEach {
        Mock Test-InstallerIsAdministrator { $true }
        Mock Assert-AccucutFolderTrusted { }
        Mock Assert-AccucutParentNotSwappable { }
        Mock Get-Command { [pscustomobject]@{ Source = 'C:\fake\node.exe' } } -ParameterFilter { $Name -eq 'node' }
        Mock Get-AccucutPostgresInstall { [pscustomobject]@{ BinDirectory = 'C:\fake\pg\bin'; DataDirectory = 'C:\fake\pg\data'; ServiceStatus = 'Running' } }
        Mock Get-Service { $null }
        Mock Set-AccucutCurrentRelease { }
        Mock Write-AccucutSecureFile { }
        Mock Invoke-AccucutNative {
            if ($FilePath -like '*node.exe') { return [pscustomobject]@{ ExitCode = 0; Output = 'v22.12.0' } }
            return [pscustomobject]@{ ExitCode = 0; Output = 'psql (PostgreSQL) 17.2' }
        }
        Mock Invoke-AccucutPsql {
            if ($Command -like 'SELECT count(*)*') { return '0' }
            if ($Command -like 'SHOW server_version_num') { return '170002' }
            return ''
        }
        Mock Invoke-AccucutMigration { throw 'migration failed on purpose' }
        Mock Write-AccucutLog { $script:LoggedMessages.Add($Message) }
        $script:LoggedMessages.Clear()
    }

    It 'every file it reads or runs after the check comes from the release folder, never from the folder IT unpacked into' {
        $folders = New-VerifiedReleaseFolder -Name 'reads-install' -Tag 't-fail'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-fail' } }
        $values = Write-FakeValuesFile -Name 'reads-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -PackageRoot $folders.Release } | Should -Throw '*migration failed on purpose*'
        # (A ? in a pattern stands for the path separator, so the filters hold no backslash.)
        Should -Invoke Read-AccucutReleaseInfo -Times 1 -Exactly -ParameterFilter { $PackageRoot -like '*reads-install?releases?t-fail' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $File -like '*reads-install?releases?t-fail?sql?create-roles.psql' }
        Should -Invoke Invoke-AccucutMigration -Times 1 -Exactly -ParameterFilter { $ReleaseDirectory -like '*reads-install?releases?t-fail' }
        Should -Invoke Assert-AccucutFolderTrusted -Times 1 -Exactly -ParameterFilter { $Path -like '*reads-install' }
        # The unverified folder was never named: no call mentions it.
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly -ParameterFilter { "$File $Command" -like '*unverified-unpacked*' }
        Should -Invoke Invoke-AccucutMigration -Times 0 -Exactly -ParameterFilter { $ReleaseDirectory -like '*unverified-unpacked*' }
        # Its .env.example (evil.example) was not the template: no setting came from it.
        Should -Invoke Write-AccucutSecureFile -Times 2 -Exactly -ParameterFilter { ($Line -join "`n") -notlike '*evil.example*' }
    }

    It 'drops the database and roles that it created, clears the folders it made, never reveals a secret, and re-throws' {
        $folders = New-VerifiedReleaseFolder -Name 'failing-install' -Tag 't-fail'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-fail' } }
        $values = Write-FakeValuesFile -Name 'failing-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -PackageRoot $folders.Release } | Should -Throw '*migration failed on purpose*'

        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -like 'CREATE DATABASE*' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -like 'DROP DATABASE IF EXISTS*' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -like 'DROP ROLE IF EXISTS accucut_app; DROP ROLE IF EXISTS accucut_owner;' }
        # The failure happened before any service was registered, so nothing was started, and the install folder is empty again.
        Should -Invoke Invoke-AccucutNative -Times 0 -Exactly -ParameterFilter { $FilePath -like '*Accucut*.exe' }
        @(Get-ChildItem -LiteralPath $folders.Root -Force).Count | Should -Be 0
        $script:LoggedMessages | Should -Not -BeNullOrEmpty
        foreach ($secret in $script:FakeOwnerPassword, $script:FakeAppPassword, $script:FakeAdminPassword, $script:FakePgPassword) {
            ($script:LoggedMessages -join "`n") | Should -Not -BeLike "*$secret*"
        }
    }

    It 'refuses to start when the services of an install already exist, and clears only what this run made' {
        $folders = New-VerifiedReleaseFolder -Name 'installed-already' -Tag 't-again'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-again' } }
        Mock Get-Service { [pscustomobject]@{ Name = 'AccucutApp' } }
        Mock Invoke-AccucutPsql { '' }
        { Invoke-AccucutInstall -NonInteractive -Root $folders.Root -PackageRoot $folders.Release } | Should -Throw '*already exist*update.ps1*'
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly
        Should -Invoke Write-AccucutSecureFile -Times 0 -Exactly
    }

    It 'stops on an old Node.js before any change, and leaves the install folder empty so that the install can be run again' {
        $folders = New-VerifiedReleaseFolder -Name 'old-node' -Tag 't-old'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-old' } }
        Mock Invoke-AccucutNative { [pscustomobject]@{ ExitCode = 0; Output = 'v20.18.0' } }
        { Invoke-AccucutInstall -NonInteractive -Root $folders.Root -PackageRoot $folders.Release } | Should -Throw '*too old*'
        @(Get-ChildItem -LiteralPath $folders.Root -Force).Count | Should -Be 0
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly
    }

    It 'a folder that the install made is unusable by anyone else afterwards: the install folder is checked as trusted before anything is written' {
        $folders = New-VerifiedReleaseFolder -Name 'untrusted' -Tag 't-bad'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-bad' } }
        Mock Assert-AccucutFolderTrusted { throw 'is owned by S-1-5-21-9-9-9-1001' }
        { Invoke-AccucutInstall -NonInteractive -Root $folders.Root -PackageRoot $folders.Release } | Should -Throw '*owned by*'
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly
        Should -Invoke Write-AccucutSecureFile -Times 0 -Exactly
    }
}

