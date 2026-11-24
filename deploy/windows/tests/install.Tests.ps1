#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of install.ps1 (STORY-10.04; ADR-015 Amendment 2), with every prompt, program and Windows service call mocked. The trust block has its own
  tests (Trust.Tests.ps1). The real install, from a real zip with a locked root, is proved by CI stage 13 on a Windows runner. All values here are invented
  and clearly fake.
#>

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    # Dot-sourcing defines the functions and does not run the install (the script runs it only when it is started, not sourced).
    . (Join-Path $script:WindowsDirectory 'install.ps1')

    $script:FakeOwnerPassword = 'FAKEownerPassword0001'
    $script:FakeAppPassword = 'FAKEappPassword00002'
    $script:FakeAdminPassword = 'Fake-first-pass-3!'
    $script:FakePgPassword = 'FAKE-pg-admin-pass-4'
    # An age PUBLIC key has this shape (age1 and 58 characters). It is a fake: no private key belongs to it.
    $script:FakeAgeRecipient = 'age1' + ('q' * 58)
    $script:Template = Read-AccucutEnvTemplate -Path (Join-Path $script:WindowsDirectory '..\..\.env.example')
    $script:Trace = [System.Collections.Generic.List[string]]::new()

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
            "BACKUP_AGE_RECIPIENT=$($script:FakeAgeRecipient)"
        ) + $Extra
        [System.IO.File]::WriteAllText($file, ($lines -join "`n"))
        return $file
    }
}

Describe 'the expected hash of the zip (AC-1)' {
    It 'takes -Sha256 first, and lower-cases it' {
        Get-AccucutExpectedSha256 -ZipPath (Join-Path $TestDrive 'x.zip') -Sha256 ('AB' * 32) | Should -Be ('ab' * 32)
    }

    It 'takes the first token of the .sha256 file next to the zip when no hash is given' {
        $zip = Join-Path $TestDrive 'withfile.zip'
        [System.IO.File]::WriteAllText("$zip.sha256", ('cd' * 32) + "  withfile.zip`n")
        Get-AccucutExpectedSha256 -ZipPath $zip | Should -Be ('cd' * 32)
    }

    It 'refuses a missing hash and a hash that is not 64 hexadecimal characters' {
        { Get-AccucutExpectedSha256 -ZipPath (Join-Path $TestDrive 'none.zip') } | Should -Throw '*No SHA-256 given*'
        { Get-AccucutExpectedSha256 -ZipPath (Join-Path $TestDrive 'none.zip') -Sha256 'abc' } | Should -Throw '*not 64 hexadecimal characters*'
        { Get-AccucutExpectedSha256 -ZipPath (Join-Path $TestDrive 'none.zip') -Sha256 ('zz' * 32) } | Should -Throw '*not 64 hexadecimal characters*'
    }
}

Describe 'the first half: only the trust block runs, in this order (AC-1, AC-5, ADR-015 Amendment 2)' {
    BeforeEach {
        $script:Trace.Clear()
        $script:ZipFile = Join-Path $TestDrive ('pkg-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.zip')
        [System.IO.File]::WriteAllText($script:ZipFile, 'a stand-in for the release zip')
        $script:ZipHash = Get-AccucutTrustedSha256 -Path $script:ZipFile
        Mock Test-AccucutScriptAdministrator { $true }
        Mock Assert-AccucutTrustedRootShape { $script:Trace.Add('shape') }
        Mock New-AccucutTrustedRoot { $script:Trace.Add('root') }
        Mock Expand-AccucutTrustedPackage { $script:Trace.Add('expand'); return 'C:\Accucut\releases\t1' }
        Mock Invoke-AccucutTrustedScript { $script:Trace.Add('run'); return 0 }
        Mock Remove-AccucutTrustedTree { $script:Trace.Add('remove') }
        Mock Write-Host { }
    }

    It 'checks the shape and the zip, makes the locked root, unpacks the checked copy, and runs the release copy of install.ps1 with -VerifiedRelease: in that order' {
        Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Sha256 $script:ZipHash -Root 'C:\Accucut' -ChildArgument @('-Port', '3001')
        ($script:Trace -join ',') | Should -Be 'shape,root,expand,run'
        Should -Invoke Expand-AccucutTrustedPackage -Times 1 -Exactly -ParameterFilter { $Sha256 -eq $script:ZipHash -and $ZipPath -eq $script:ZipFile -and $Root -eq 'C:\Accucut' }
        Should -Invoke Invoke-AccucutTrustedScript -Times 1 -Exactly -ParameterFilter {
            $Path -eq 'C:\Accucut\releases\t1\install.ps1' -and $Root -eq 'C:\Accucut' -and (($ArgumentList -join ' ') -eq '-VerifiedRelease C:\Accucut\releases\t1 -Port 3001')
        }
        Should -Invoke Remove-AccucutTrustedTree -Times 0 -Exactly
    }

    It 'stops when it is not run as an administrator, before anything else' {
        Mock Test-AccucutScriptAdministrator { $false }
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Sha256 $script:ZipHash -Root 'C:\Accucut' } | Should -Throw '*as an administrator*'
        $script:Trace.Count | Should -Be 0
    }

    It 'stops when no zip is given, the zip is missing, or its SHA-256 is missing or wrong, and creates nothing (AC-5)' {
        { Invoke-AccucutInstallFirstHalf -Root 'C:\Accucut' } | Should -Throw '*Give the release zip*'
        { Invoke-AccucutInstallFirstHalf -ZipPath (Join-Path $TestDrive 'nothing.zip') -Sha256 $script:ZipHash -Root 'C:\Accucut' } | Should -Throw '*was not found*'
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Root 'C:\Accucut' } | Should -Throw '*No SHA-256 given*'
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Sha256 ('0' * 64) -Root 'C:\Accucut' } | Should -Throw '*does not match*Nothing was created*'
        Should -Invoke New-AccucutTrustedRoot -Times 0 -Exactly
        Should -Invoke Expand-AccucutTrustedPackage -Times 0 -Exactly
        Should -Invoke Invoke-AccucutTrustedScript -Times 0 -Exactly
    }

    It 'takes the expected hash from the .sha256 file next to the zip' {
        [System.IO.File]::WriteAllText("$($script:ZipFile).sha256", "$($script:ZipHash)  pkg.zip`n")
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Root 'C:\Accucut' } | Should -Not -Throw
        [System.IO.File]::WriteAllText("$($script:ZipFile).sha256", ('f' * 64) + "  pkg.zip`n")
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Root 'C:\Accucut' } | Should -Throw '*does not match*'
    }

    It 'stops on a root of the wrong shape before the zip is even read' {
        Mock Assert-AccucutTrustedRootShape { throw 'The install folder must be exactly one folder below a drive' }
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Sha256 $script:ZipHash -Root 'C:\a\b' } | Should -Throw '*exactly one folder below a drive*'
        Should -Invoke New-AccucutTrustedRoot -Times 0 -Exactly
    }

    It 'does not create or remove anything when the root already exists (New-AccucutTrustedRoot refuses it), and unpacks nothing' {
        Mock New-AccucutTrustedRoot { throw "'C:\Accucut' already exists. Nothing was changed." }
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Sha256 $script:ZipHash -Root 'C:\Accucut' } | Should -Throw '*already exists*'
        Should -Invoke Expand-AccucutTrustedPackage -Times 0 -Exactly
        Should -Invoke Remove-AccucutTrustedTree -Times 0 -Exactly
    }

    It 'removes the root that this run made, and runs nothing, when the unpacking fails' {
        Mock Expand-AccucutTrustedPackage { throw 'The SHA-256 of the copy of the zip does not match' }
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Sha256 $script:ZipHash -Root 'C:\Accucut' } | Should -Throw '*of the copy of the zip does not match*'
        Should -Invoke Remove-AccucutTrustedTree -Times 1 -Exactly -ParameterFilter { $Path -eq 'C:\Accucut' -and $Within -eq 'C:\Accucut' -and $IncludeWithin }
        Should -Invoke Invoke-AccucutTrustedScript -Times 0 -Exactly
    }

    It 'fails when the second half does not finish, and leaves the clean-up to it (it removes the root it made before any service exists, or leaves it for IT to look at after)' {
        Mock Invoke-AccucutTrustedScript { 1 }
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Sha256 $script:ZipHash -Root 'C:\Accucut' } | Should -Throw '*did not finish*'
        Should -Invoke Remove-AccucutTrustedTree -Times 0 -Exactly
    }

    It 'removes the root that this run made when the check that refuses the release script stops the run before the second half starts' {
        Mock Invoke-AccucutTrustedScript { throw "'C:\Accucut\releases\t1\install.ps1' can be changed by S-1-5-32-545" }
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Sha256 $script:ZipHash -Root 'C:\Accucut' } | Should -Throw '*can be changed by*'
        Should -Invoke Remove-AccucutTrustedTree -Times 1 -Exactly -ParameterFilter { $Path -eq 'C:\Accucut' -and $Within -eq 'C:\Accucut' -and $IncludeWithin }
    }

    It 'keeps going with a warning, and still re-throws the real error, when the root cannot be removed' {
        Mock Invoke-AccucutTrustedScript { throw "'C:\Accucut\releases\t1\install.ps1' can be changed by S-1-5-32-545" }
        Mock Remove-AccucutTrustedTree { throw 'in use' }
        { Invoke-AccucutInstallFirstHalf -ZipPath $script:ZipFile -Sha256 $script:ZipHash -Root 'C:\Accucut' } | Should -Throw '*can be changed by*'
        Should -Invoke Write-Host -ParameterFilter { $Object -like '*could not be removed*Delete it by hand*' }
    }
}

Describe 'the arguments the first half passes to the second (AC-5)' {
    It 'passes the choices as arguments, never a secret, and a values file only as a path' {
        $bound = @{ Root = 'C:\Accucut'; Port = 3001; NonInteractive = [System.Management.Automation.SwitchParameter]::new($true); WithProxy = [System.Management.Automation.SwitchParameter]::new($false); ValuesFile = 'C:\temp\values.txt'; PgHost = '127.0.0.1'; ZipPath = 'C:\x.zip'; Sha256 = ('a' * 64) }
        $arguments = @(Get-AccucutInstallChildArgument -Bound $bound)
        ($arguments -join ' ') | Should -BeLike '*-Root C:\Accucut*'
        ($arguments -join ' ') | Should -BeLike '*-Port 3001*'
        ($arguments -join ' ') | Should -BeLike '*-ValuesFile C:\temp\values.txt*'
        $arguments | Should -Contain '-NonInteractive'
        $arguments | Should -Not -Contain '-WithProxy'
        $arguments | Should -Not -Contain '-ZipPath'
        $arguments | Should -Not -Contain '-Sha256'
        ($arguments -join ' ') | Should -Not -BeLike '*aaaaaaaa*'
    }
}

Describe 'the second half starts only from the verified release folder (ADR-015 Amendment 2, required test 16)' {
    BeforeAll {
        # The real function, taken before any test mocks it.
        $script:RealPresent = (Get-Command -Name Test-AccucutInstallPresent -CommandType Function).ScriptBlock
    }

    BeforeEach {
        $script:Trace.Clear()
        Mock Test-AccucutScriptAdministrator { $true }
        Mock Assert-AccucutTrustedRootShape { $script:Trace.Add('shape') }
        Mock Test-AccucutInstallPresent { $script:Trace.Add('present?'); return $false }
        Mock Assert-AccucutTrustedPath { $script:Trace.Add("path:$Path") }
        Mock Assert-AccucutTrustedNoLinks { $script:Trace.Add('nolinks') }
        Mock Import-AccucutTrustedModule { $script:Trace.Add('import') }
        Mock Invoke-AccucutInstall { $script:Trace.Add('install') }
        Mock Remove-AccucutTrustedTree { $script:Trace.Add('remove') }
    }

    It 'checks where it is, the root shape, that no install is there yet, the release folder and its links, then loads the module, then installs: in that order' {
        Invoke-AccucutInstallSecondHalf -Root 'C:\Accucut' -VerifiedRelease 'C:\Accucut\releases\t1' -ScriptPath 'C:\Accucut\releases\t1\install.ps1' -InstallParameter @{ Port = 3002 }
        ($script:Trace -join ',') | Should -Be 'shape,present?,path:C:\Accucut\releases\t1,nolinks,import,install'
        Should -Invoke Import-AccucutTrustedModule -Times 1 -Exactly -ParameterFilter { $Root -eq 'C:\Accucut' -and $Release -eq 'C:\Accucut\releases\t1' }
        Should -Invoke Invoke-AccucutInstall -Times 1 -Exactly -ParameterFilter { $Release -eq 'C:\Accucut\releases\t1' -and $Root -eq 'C:\Accucut' -and $Port -eq 3002 }
    }

    It 'run by hand on an existing install (review SQR-05) refuses before anything is loaded, created or removed, and never removes that install' {
        Mock Test-AccucutInstallPresent { $script:Trace.Add('present?'); return $true }
        { Invoke-AccucutInstallSecondHalf -Root 'C:\Accucut' -VerifiedRelease 'C:\Accucut\releases\t1' -ScriptPath 'C:\Accucut\releases\t1\install.ps1' -InstallParameter @{} } | Should -Throw '*already holds an install*Nothing was changed*'
        ($script:Trace -join ',') | Should -Be 'shape,present?'
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
        Should -Invoke Invoke-AccucutInstall -Times 0 -Exactly
        Should -Invoke Remove-AccucutTrustedTree -Times 0 -Exactly
    }

    It 'checks the root shape before anything else is looked at (a root that is not exactly one folder below a drive stops it)' {
        Mock Assert-AccucutTrustedRootShape { throw 'The install folder must be exactly one folder below a drive' }
        { Invoke-AccucutInstallSecondHalf -Root 'C:\a\b' -VerifiedRelease 'C:\a\b\releases\t1' -ScriptPath 'C:\a\b\releases\t1\install.ps1' -InstallParameter @{} } | Should -Throw '*exactly one folder below a drive*'
        Should -Invoke Test-AccucutInstallPresent -Times 0 -Exactly
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
    }

    It 'sees an existing install by its config folder or its state file' {
        $root = Join-Path $TestDrive ('present-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path $root | Out-Null
        $real = $script:RealPresent
        (& $real -Root $root) | Should -BeFalse
        New-Item -ItemType Directory -Path (Join-Path $root 'releases') | Out-Null
        (& $real -Root $root) | Should -BeFalse
        New-Item -ItemType Directory -Path (Join-Path $root 'config') | Out-Null
        (& $real -Root $root) | Should -BeTrue
    }

    It 'run by hand from anywhere else (the zip, a download folder, the unpacked folder) stops before anything is checked or loaded (<Where>)' -ForEach @(
        @{ Where = 'a download folder'; ScriptFile = 'C:\Users\someone\Downloads\install.ps1'; Release = 'C:\Accucut\releases\t1' }
        @{ Where = 'the current junction'; ScriptFile = 'C:\Accucut\current\install.ps1'; Release = 'C:\Accucut\releases\t1' }
        @{ Where = 'another release'; ScriptFile = 'C:\Accucut\releases\t2\install.ps1'; Release = 'C:\Accucut\releases\t1' }
        @{ Where = 'the scratch folder'; ScriptFile = 'C:\Accucut\.in\abc\x\install.ps1'; Release = 'C:\Accucut\releases\t1' }
    ) {
        { Invoke-AccucutInstallSecondHalf -Root 'C:\Accucut' -VerifiedRelease $Release -ScriptPath $ScriptFile -InstallParameter @{} } | Should -Throw '*runs from the release folder only*'
        $script:Trace.Count | Should -Be 0
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
        Should -Invoke Invoke-AccucutInstall -Times 0 -Exactly
    }

    It 'refuses a -VerifiedRelease that is not a release folder directly inside the releases folder (<Release>)' -ForEach @(
        @{ Release = 'C:\Windows\Temp\evil' }
        @{ Release = 'C:\Accucut\releases' }
        @{ Release = 'C:\Accucut' }
        @{ Release = 'C:\Accucut\releases\t1\deeper' }
        @{ Release = 'D:\Accucut\releases\t1' }
        @{ Release = 'C:\Accucut\releases\a b' }
        @{ Release = 'C:\Accucut\releases\..\evil' }
    ) {
        { Invoke-AccucutInstallSecondHalf -Root 'C:\Accucut' -VerifiedRelease $Release -ScriptPath (Join-Path $Release 'install.ps1') -InstallParameter @{} } | Should -Throw '*is not a release folder directly inside*'
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
        Should -Invoke Invoke-AccucutInstall -Times 0 -Exactly
    }

    It 'does not load the module when a check of the release folder fails' {
        Mock Assert-AccucutTrustedPath { throw "'C:\Accucut\releases\t1' can be changed by S-1-5-32-545" }
        { Invoke-AccucutInstallSecondHalf -Root 'C:\Accucut' -VerifiedRelease 'C:\Accucut\releases\t1' -ScriptPath 'C:\Accucut\releases\t1\install.ps1' -InstallParameter @{} } | Should -Throw '*can be changed by*'
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
        Should -Invoke Invoke-AccucutInstall -Times 0 -Exactly
    }

    It 'does not load the module when the release holds a link' {
        Mock Assert-AccucutTrustedNoLinks { throw "'C:\Accucut\releases\t1\app' is a link." }
        { Invoke-AccucutInstallSecondHalf -Root 'C:\Accucut' -VerifiedRelease 'C:\Accucut\releases\t1' -ScriptPath 'C:\Accucut\releases\t1\install.ps1' -InstallParameter @{} } | Should -Throw '*is a link*'
        Should -Invoke Import-AccucutTrustedModule -Times 0 -Exactly
    }

    It 'stops when it is not run as an administrator, before anything is checked' {
        Mock Test-AccucutScriptAdministrator { $false }
        { Invoke-AccucutInstallSecondHalf -Root 'C:\Accucut' -VerifiedRelease 'C:\Accucut\releases\t1' -ScriptPath 'C:\Accucut\releases\t1\install.ps1' -InstallParameter @{} } | Should -Throw '*as an administrator*'
        $script:Trace.Count | Should -Be 0
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
        [System.IO.File]::WriteAllText($file, "ADMIN_EMAIL=a@example.test`nADMIN_INITIAL_PASSWORD=$($script:FakeAdminPassword)`nPG_SUPERUSER_PASSWORD=$($script:FakePgPassword)`nBACKUP_AGE_RECIPIENT=$($script:FakeAgeRecipient)`n")
        $settings = Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut'
        $settings.OwnerPassword.Length | Should -Be 32
        $settings.AppPassword.Length | Should -Be 32
        $settings.OwnerPassword | Should -Not -Be $settings.AppPassword
        # The backup role's password is invented as well (STORY-10.05): 32 letters and digits, a third value, and never part of the .env settings.
        $settings.BackupPassword.Length | Should -Be 32
        $settings.BackupPassword | Should -Not -BeIn @($settings.OwnerPassword, $settings.AppPassword)
        ($settings.Values.Keys -join ',') | Should -Not -BeLike '*BACKUP*'
        ($settings.Values.Values -join ',') | Should -Not -BeLike "*$($settings.BackupPassword)*"
    }

    It 'names what is missing in an unattended run, and never prints a value' {
        $file = Join-Path $TestDrive 'nomail.txt'
        [System.IO.File]::WriteAllText($file, "ADMIN_INITIAL_PASSWORD=$($script:FakeAdminPassword)`nPG_SUPERUSER_PASSWORD=$($script:FakePgPassword)`n")
        { Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' } | Should -Throw '*ADMIN_EMAIL*'
        try { Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' } catch { $_.Exception.Message | Should -Not -BeLike "*$($script:FakeAdminPassword)*" }
    }

    It 'asks the questions (prompts are small functions) and blanks the secret answers in later logs' {
        Mock Read-AccucutHostInput {
            param($Prompt, $Default)
            if ($Prompt -like '*first Admin*') { 'asked.admin@example.test' }
            elseif ($Prompt -like '*age PUBLIC key*') { $script:FakeAgeRecipient }
            else { $Default }
        }
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
        $sql | Should -BeLike '*\getenv backup_password DB_BACKUP_PASSWORD*'
        $sql | Should -Not -Match "PASSWORD\s+'[^']+'"
    }

    It 'the backup role can read the data and nothing else: NOSUPERUSER NOCREATEDB NOCREATEROLE, CONNECT, USAGE on public and pg_read_all_data, and no other grant (Amendment 3 point 3)' {
        $sql = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory '..\db\create-roles.psql') -Raw
        $sql | Should -Match 'CREATE ROLE accucut_backup LOGIN PASSWORD :''backup_password'' NOSUPERUSER NOCREATEDB NOCREATEROLE;'
        $sql | Should -Match 'CREATE ROLE accucut_backup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;'
        $sql | Should -Match 'GRANT CONNECT ON DATABASE :"dbname" TO accucut_owner, accucut_app, accucut_backup;'
        $sql | Should -Match 'GRANT USAGE ON SCHEMA public TO accucut_app, accucut_backup;'
        $sql | Should -Match 'GRANT pg_read_all_data TO accucut_backup;'
        # The role gets no default privilege and no write right here: the one INSERT (job_runs) comes from a migration.
        ([regex]::Matches($sql, 'accucut_backup')).Count | Should -BeGreaterThan 4
        $sql | Should -Not -Match 'DEFAULT PRIVILEGES[^;]*accucut_backup'
        $sql | Should -Not -Match 'GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*accucut_backup'
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

Describe 'the install itself reads only from the verified release folder, uses programs by full path, and a failed install leaves nothing behind (AC-1, ADR-015 Amendment 2)' {
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
        Mock Resolve-AccucutTrustedExecutable { $Path }
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
        Mock Test-AccucutBatchRightPolicy { }
        Mock Write-AccucutLog { $script:LoggedMessages.Add($Message) }
        $script:LoggedMessages.Clear()
    }

    It 'every file it reads or runs comes from the release folder, never from the folder IT unpacked into; the programs are resolved by full path' {
        $folders = New-VerifiedReleaseFolder -Name 'reads-install' -Tag 't-fail'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-fail' } }
        $values = Write-FakeValuesFile -Name 'reads-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*migration failed on purpose*'
        # (A ? in a pattern stands for the path separator, so the filters hold no backslash.)
        Should -Invoke Read-AccucutReleaseInfo -Times 1 -Exactly -ParameterFilter { $PackageRoot -like '*reads-install?releases?t-fail' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $File -like '*reads-install?releases?t-fail?sql?create-roles.psql' }
        Should -Invoke Invoke-AccucutMigration -Times 1 -Exactly -ParameterFilter { $ReleaseDirectory -like '*reads-install?releases?t-fail' }
        # Node and psql are resolved (and trust-checked) by full path; none is looked up on PATH.
        Should -Invoke Resolve-AccucutTrustedExecutable -Times 1 -Exactly -ParameterFilter { $Path -eq 'C:\fake\node.exe' }
        Should -Invoke Resolve-AccucutTrustedExecutable -Times 1 -Exactly -ParameterFilter { $Path -eq 'C:\fake\pg\bin\psql.exe' }
        Should -Invoke Invoke-AccucutNative -Times 0 -Exactly -ParameterFilter { $FilePath -notlike 'C:\fake\*' }
        # The unverified folder was never named: no call mentions it.
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly -ParameterFilter { "$File $Command" -like '*unverified-unpacked*' }
        Should -Invoke Invoke-AccucutMigration -Times 0 -Exactly -ParameterFilter { $ReleaseDirectory -like '*unverified-unpacked*' }
        # Its .env.example (evil.example) was not the template: no setting came from it.
        Should -Invoke Write-AccucutSecureFile -Times 2 -Exactly -ParameterFilter { ($Line -join "`n") -notlike '*evil.example*' }
    }

    It 'takes node.exe from Program Files when none is given, by full path' {
        $folders = New-VerifiedReleaseFolder -Name 'default-node' -Tag 't-node'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-node' } }
        Mock Invoke-AccucutNative { [pscustomobject]@{ ExitCode = 0; Output = 'v20.18.0' } }
        { Invoke-AccucutInstall -NonInteractive -Root $folders.Root -Release $folders.Release } | Should -Throw '*too old*'
        $expected = [System.IO.Path]::Combine($env:ProgramFiles, 'nodejs\node.exe')
        Should -Invoke Resolve-AccucutTrustedExecutable -Times 1 -Exactly -ParameterFilter { $Path -eq $expected }
    }

    It 'checks each program with the trust check BEFORE it is run: every run is preceded by a check of the same path (review SQR-06)' {
        $folders = New-VerifiedReleaseFolder -Name 'order-install' -Tag 't-order'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-order' } }
        $script:Trace.Clear()
        Mock Resolve-AccucutTrustedExecutable { $script:Trace.Add("check:$Path"); return $Path }
        Mock Invoke-AccucutNative {
            $script:Trace.Add("run:$FilePath")
            if ($FilePath -like '*node.exe') { return [pscustomobject]@{ ExitCode = 0; Output = 'v22.12.0' } }
            return [pscustomobject]@{ ExitCode = 0; Output = 'psql (PostgreSQL) 17.2' }
        }
        $values = Write-FakeValuesFile -Name 'order-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*migration failed on purpose*'
        $trace = @($script:Trace)
        $runs = @($trace | Where-Object { $_ -like 'run:*' })
        $runs.Count | Should -Be 2
        foreach ($run in $runs) {
            $program = $run.Substring(4)
            [array]::IndexOf($trace, "check:$program") | Should -BeGreaterOrEqual 0
            [array]::IndexOf($trace, "check:$program") | Should -BeLessThan ([array]::IndexOf($trace, $run))
        }
    }

    It 'refuses a program that fails the trust check, and changes nothing' {
        $folders = New-VerifiedReleaseFolder -Name 'bad-node' -Tag 't-bad'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-bad' } }
        Mock Resolve-AccucutTrustedExecutable { throw "'C:\fake\node.exe' can be changed by S-1-5-32-545" }
        { Invoke-AccucutInstall -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*can be changed by*'
        Should -Invoke Invoke-AccucutNative -Times 0 -Exactly
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly
        Should -Invoke Write-AccucutSecureFile -Times 0 -Exactly
    }

    It 'drops the database and roles that it created, removes the install folder it made, never reveals a secret, and re-throws' {
        $folders = New-VerifiedReleaseFolder -Name 'failing-install' -Tag 't-fail'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-fail' } }
        $values = Write-FakeValuesFile -Name 'failing-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*migration failed on purpose*'

        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -like 'CREATE DATABASE*' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -like 'DROP DATABASE IF EXISTS*' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -eq 'DROP ROLE IF EXISTS accucut_restore; DROP ROLE IF EXISTS accucut_backup; DROP ROLE IF EXISTS accucut_app; DROP ROLE IF EXISTS accucut_owner;' }
        # The failure happened before any service was registered, so nothing was started, and the install folder is gone again (so the install can be run again).
        Should -Invoke Invoke-AccucutNative -Times 0 -Exactly -ParameterFilter { $FilePath -like '*Accucut*.exe' }
        Test-Path -LiteralPath $folders.Root | Should -BeFalse
        $script:LoggedMessages | Should -Not -BeNullOrEmpty
        foreach ($secret in $script:FakeOwnerPassword, $script:FakeAppPassword, $script:FakeAdminPassword, $script:FakePgPassword) {
            ($script:LoggedMessages -join "`n") | Should -Not -BeLike "*$secret*"
        }
    }

    It 'refuses to start when the services of an install already exist, and removes nothing' {
        $folders = New-VerifiedReleaseFolder -Name 'installed-already' -Tag 't-again'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-again' } }
        Mock Get-Service { [pscustomobject]@{ Name = 'AccucutApp' } }
        Mock Invoke-AccucutPsql { '' }
        { Invoke-AccucutInstall -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*already exist*update.ps1*'
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly
        Should -Invoke Write-AccucutSecureFile -Times 0 -Exactly
        Test-Path -LiteralPath $folders.Release | Should -BeTrue
    }

    It 'stops on an old Node.js before any change, and removes the install folder so that the install can be run again' {
        $folders = New-VerifiedReleaseFolder -Name 'old-node' -Tag 't-old'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-old' } }
        Mock Invoke-AccucutNative { [pscustomobject]@{ ExitCode = 0; Output = 'v20.18.0' } }
        { Invoke-AccucutInstall -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*too old*'
        Test-Path -LiteralPath $folders.Root | Should -BeFalse
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly
    }
}

Describe 'a failed install removes the root even though its log is open (review SQR-03 with the removal of the root)' {
    It 'closes the log, keeps a copy of it in the temp folder, and removes the whole install folder' {
        $root = Join-Path $TestDrive ('rm-root-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path (Join-Path $root 'logs') | Out-Null
        $logFile = Join-Path $root ("logs\" + (New-AccucutLogFileName -Prefix 'install'))
        Write-AccucutLog -Message 'before the failure' -LogFile $logFile 6>$null
        Mock Write-Host { }
        Remove-AccucutInstallRoot -Root $root -LogFile $logFile
        Test-Path -LiteralPath $root | Should -BeFalse
        $kept = Join-Path $env:TEMP ("accucut-failed-" + (Split-Path -Leaf $logFile))
        try {
            Test-Path -LiteralPath $kept | Should -BeTrue
            (Get-Content -LiteralPath $kept -Raw) | Should -BeLike "*before the failure*"
        }
        finally { Remove-Item -LiteralPath $kept -Force -ErrorAction SilentlyContinue }
    }
}

Describe 'the weekly backup in the install (STORY-10.05, ADR-015 Amendment 3)' {
    BeforeAll {
        $script:BackupSid = 'S-1-5-21-1111111111-2222222222-3333333333-1005'
        $script:LogonFailure = [uint32]2147943785
        function New-BackupInstallFolder {
            param([string]$Name, [string]$Tag)
            $root = Join-Path $TestDrive $Name
            $release = Join-Path $root "releases\$Tag"
            New-Item -ItemType Directory -Path (Join-Path $release 'sql') -Force | Out-Null
            Copy-Item -LiteralPath (Join-Path $script:WindowsDirectory '..\..\.env.example') -Destination (Join-Path $release '.env.example')
            Set-Content -LiteralPath (Join-Path $release 'sql\create-roles.psql') -Value '-- the verified SQL'
            return [pscustomobject]@{ Root = $root; Release = $release }
        }
    }

    BeforeEach {
        $script:Trace = [System.Collections.Generic.List[string]]::new()
        $script:Logged = [System.Collections.Generic.List[string]]::new()
        $script:NativeArguments = [System.Collections.Generic.List[string]]::new()
        $script:ServicesRegistered = $false
        $script:SeenBackupPassword = $null
        $script:SeenRecipient = $null
        $script:SeenRestorePassword = $null
        $script:RestoreConfigWritten = $false
        $script:JobRows = '1'
        Mock Resolve-AccucutTrustedExecutable { $script:Trace.Add("check:$Path"); return $Path }
        Mock Get-AccucutPostgresInstall { [pscustomobject]@{ BinDirectory = 'C:\fake\pg\bin'; DataDirectory = 'D:\fake\pg\data'; ServiceStatus = 'Running' } }
        Mock Get-Service { if ($script:ServicesRegistered) { return [pscustomobject]@{ Name = 'AccucutApp' } } return $null }
        Mock Set-AccucutCurrentRelease { }
        Mock Write-AccucutSecureFile { }
        Mock Invoke-AccucutNative {
            $environmentText = ''
            if ($null -ne $Environment) { $environmentText = (($Environment.Values | ForEach-Object { [string]$_ }) -join ' ') }
            $script:NativeArguments.Add((($ArgumentList -join ' ') + ' ' + $environmentText))
            if ($ArgumentList -contains 'install') { $script:ServicesRegistered = $true }
            if ($FilePath -like '*node.exe' -and $ArgumentList -contains '--version') { return [pscustomobject]@{ ExitCode = 0; Output = 'v22.12.0' } }
            if ($FilePath -like '*psql.exe') { return [pscustomobject]@{ ExitCode = 0; Output = 'psql (PostgreSQL) 17.2' } }
            return [pscustomobject]@{ ExitCode = 0; Output = 'ok' }
        }
        Mock Invoke-AccucutPsql {
            if ($Command -like '*FROM job_runs*') { return $script:JobRows }
            if ($Command -like 'SELECT count(*)*') { return '0' }
            if ($Command -like 'SHOW server_version_num') { return '170002' }
            return ''
        }
        Mock Invoke-AccucutMigration { [pscustomobject]@{ Deploy = 'migrated'; Seed = 'seeded' } }
        Mock Write-AccucutLog { $script:Logged.Add($Message) }
        Mock Initialize-AccucutServiceFiles { @() }
        Mock Set-AccucutServiceIdentity { }
        Mock Grant-AccucutInstallFolderAccess { $script:Trace.Add('grant:services') }
        Mock Set-AccucutFileAcl { }
        Mock Remove-AccucutOldLogs { 0 }
        Mock Set-AccucutDefenderExclusion { $false }
        Mock Start-AccucutServices { $script:Trace.Add('start-services') }
        Mock Wait-AccucutHealth { $true }
        Mock Get-AccucutHttpStatus { 200 }
        Mock Test-AccucutBatchRightPolicy { $script:Trace.Add("policy:$($PolicyConfirmed.IsPresent)") }
        Mock Test-AccucutModuleLogging { $false }
        Mock Register-AccucutEventSource { $script:Trace.Add('event-source'); return $true }
        Mock Register-AccucutBackupTask { $script:Trace.Add('task'); return $script:BackupSid }
        Mock Grant-AccucutBackupRootAccess { $script:Trace.Add('grant:backup') }
        Mock New-AccucutBackupFolder { $script:Trace.Add('folder') }
        Mock Write-AccucutBackupConfig { $script:Trace.Add('config'); $script:SeenBackupPassword = $BackupPassword; $script:SeenRecipient = $AgeRecipient }
        Mock Write-AccucutRestoreConfig { $script:SeenRestorePassword = $RestorePassword; $script:RestoreConfigWritten = $true }
        Mock Wait-AccucutBackupTask { $script:Trace.Add('first-backup'); return [uint32]0 }
        Mock Remove-AccucutBackupAccount { $script:Trace.Add('remove-account') }
        Mock Remove-AccucutTrustedTree { $script:Trace.Add('remove-root') }
        Mock Write-Host { }
    }

    It 'makes the account and the task first, then the entries that name it, then the services; and runs the task once after the health check (the first backup)' {
        $folders = New-BackupInstallFolder -Name 'backup-order' -Tag 't-ok'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-ok' } }
        $values = Write-FakeValuesFile -Name 'backup-order-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Not -Throw
        $trace = @($script:Trace)
        $order = @('policy:False', 'event-source', 'task', 'grant:backup', 'folder', 'config', 'grant:services', 'start-services', 'first-backup')
        for ($i = 1; $i -lt $order.Count; $i++) {
            [array]::IndexOf($trace, $order[$i]) | Should -BeGreaterThan ([array]::IndexOf($trace, $order[$i - 1])) -Because "$($order[$i]) comes after $($order[$i - 1])"
        }
        [array]::IndexOf($trace, 'task') | Should -BeGreaterThan -1
        # The program the task starts is trust-checked by its full path, before the task is registered.
        $expected = "check:$([System.IO.Path]::Combine($env:SystemRoot, 'System32\WindowsPowerShell\v1.0\powershell.exe'))"
        [array]::IndexOf($trace, $expected) | Should -BeGreaterThan -1
        [array]::IndexOf($trace, $expected) | Should -BeLessThan ([array]::IndexOf($trace, 'task'))
        Should -Invoke Register-AccucutBackupTask -Times 1 -Exactly
        Should -Invoke Wait-AccucutBackupTask -Times 1 -Exactly -ParameterFilter { $TimeoutSeconds -eq 300 }
        Should -Invoke Remove-AccucutBackupAccount -Times 0 -Exactly
        $script:Logged | Should -Contain 'The first backup was made.'
    }

    It 'gives the new account its entries by SID, and the role SQL its password through the environment only; the password is never in a log or on a command line' {
        $folders = New-BackupInstallFolder -Name 'backup-secret' -Tag 't-secret'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-secret' } }
        $values = Write-FakeValuesFile -Name 'backup-secret-values.txt'
        Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe'
        $script:SeenBackupPassword.Length | Should -Be 32
        $script:SeenRecipient | Should -Be $script:FakeAgeRecipient
        Should -Invoke Grant-AccucutBackupRootAccess -Times 1 -Exactly -ParameterFilter { $BackupSid -eq $script:BackupSid }
        Should -Invoke New-AccucutBackupFolder -Times 1 -Exactly -ParameterFilter { $BackupSid -eq $script:BackupSid -and $Path -like '*\backups' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $null -ne $ExtraEnvironment -and $ExtraEnvironment.ContainsKey('DB_BACKUP_PASSWORD') -and $ExtraEnvironment['DB_BACKUP_PASSWORD'] -eq $script:SeenBackupPassword -and $ExtraEnvironment['DB_BACKUP_PASSWORD'].Length -eq 32 }
        ($script:Logged -join "`n") | Should -Not -BeLike "*$($script:SeenBackupPassword)*"
        ($script:NativeArguments -join "`n") | Should -Not -BeLike "*$($script:SeenBackupPassword)*"
        # The password goes into no .env file, and the two volumes are written there (forward slashes, drive roots).
        Should -Invoke Write-AccucutSecureFile -Times 0 -Exactly -ParameterFilter { ($Line -join "`n") -like "*$($script:SeenBackupPassword)*" }
        $backupVolume = Get-AccucutVolumeRoot -Path (Join-Path $folders.Root 'backups')
        Should -Invoke Write-AccucutSecureFile -Times 1 -Exactly -ParameterFilter { $Path -like '*\.env' -and ($Line -contains "BACKUP_VOLUME=$backupVolume") -and ($Line -contains 'PG_DATA_VOLUME=D:/') }
    }

    It 'stops with the batch-logon message when AccucutBackup may not log on (0x80070569), and leaves the running portal and the install alone' {
        $folders = New-BackupInstallFolder -Name 'backup-logon' -Tag 't-logon'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-logon' } }
        Mock Wait-AccucutBackupTask { $script:Trace.Add('first-backup'); return $script:LogonFailure }
        $values = Write-FakeValuesFile -Name 'backup-logon-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } |
            Should -Throw "*Windows refused the logon of AccucutBackup ('Log on as a batch job'; Security log event 4625, status 0xC000015B)*Group Policy may have removed the right*Start-ScheduledTask 'Accucut weekly backup'*"
        Should -Invoke Remove-AccucutBackupAccount -Times 0 -Exactly
        Should -Invoke Remove-AccucutTrustedTree -Times 0 -Exactly
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly -ParameterFilter { $Command -like 'DROP*' }
        Test-Path -LiteralPath (Join-Path $folders.Root 'config\install-state.json') | Should -BeTrue
    }

    It 'treats a task that never started (0x41303) like the refused logon, and leaves the install alone' {
        $folders = New-BackupInstallFolder -Name 'backup-notstarted' -Tag 't-nostart'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-nostart' } }
        Mock Wait-AccucutBackupTask { return [uint32]267011 }
        $values = Write-FakeValuesFile -Name 'backup-notstarted-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*Windows refused the logon of AccucutBackup*'
        Should -Invoke Remove-AccucutBackupAccount -Times 0 -Exactly
        Should -Invoke Remove-AccucutTrustedTree -Times 0 -Exactly
    }

    It 'reads the policy BEFORE anything is created, and stops with nothing changed when it refuses (a deny entry, or a domain policy)' {
        $folders = New-BackupInstallFolder -Name 'backup-policy' -Tag 't-policy'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-policy' } }
        Mock Test-AccucutBatchRightPolicy { throw "This server is in a domain and the Group Policy 'Servers' sets 'Log on as a batch job'. Nothing was changed." }
        $values = Write-FakeValuesFile -Name 'backup-policy-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw "*Group Policy 'Servers'*Nothing was changed*"
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly -ParameterFilter { $Command -like 'CREATE*' }
        Should -Invoke Write-AccucutSecureFile -Times 0 -Exactly
        Should -Invoke Register-AccucutBackupTask -Times 0 -Exactly
        Should -Invoke Remove-AccucutBackupAccount -Times 0 -Exactly
    }

    It 'warns, and carries on, when PowerShell module logging is on (it would record the passwords given to the backup account and role)' {
        $folders = New-BackupInstallFolder -Name 'backup-modlog' -Tag 't-modlog'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-modlog' } }
        Mock Test-AccucutModuleLogging { $true }
        $values = Write-FakeValuesFile -Name 'backup-modlog-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Not -Throw
        Should -Invoke Register-AccucutBackupTask -Times 1 -Exactly
        @($script:Logged | Where-Object { $_ -like 'PowerShell module logging is switched on*event 4103*' }).Count | Should -Be 1
        $script:Logged | Should -Contain 'The first backup was made.'
    }

    It 'passes -BatchRightPolicyConfirmed on to the policy check, and only to it' {
        $folders = New-BackupInstallFolder -Name 'backup-confirmed' -Tag 't-confirmed'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-confirmed' } }
        $values = Write-FakeValuesFile -Name 'backup-confirmed-values.txt'
        Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' -BatchRightPolicyConfirmed
        $script:Trace | Should -Contain 'policy:True'
        (Get-AccucutInstallChildArgument -Bound @{ BatchRightPolicyConfirmed = [switch]$true; Root = 'C:\Accucut' }) | Should -Contain '-BatchRightPolicyConfirmed'
        (Get-AccucutInstallChildArgument -Bound @{ Root = 'C:\Accucut' }) | Should -Not -Contain '-BatchRightPolicyConfirmed'
    }

    It 'says so, with the code, when the task ends with another result or writes no job_runs row, and leaves the install alone' {
        $folders = New-BackupInstallFolder -Name 'backup-bad' -Tag 't-bad1'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-bad1' } }
        $values = Write-FakeValuesFile -Name 'backup-bad-values.txt'
        Mock Wait-AccucutBackupTask { return [uint32]1 }
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*first backup failed (task result 0x00000001)*'
        $script:ServicesRegistered = $false
        $folders = New-BackupInstallFolder -Name 'backup-norow' -Tag 't-bad2'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-bad2' } }
        Mock Wait-AccucutBackupTask { return [uint32]0 }
        $script:JobRows = '0'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw "*no job_runs row with job 'backup' and status ok*"
        Should -Invoke Remove-AccucutTrustedTree -Times 0 -Exactly
    }

    It 'removes the account and the task, the roles and the install folder, when a step before the services fails' {
        $folders = New-BackupInstallFolder -Name 'backup-undo' -Tag 't-undo'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-undo' } }
        Mock Write-AccucutBackupConfig { throw 'the disk is full' }
        $values = Write-FakeValuesFile -Name 'backup-undo-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*the disk is full*'
        Should -Invoke Remove-AccucutBackupAccount -Times 1 -Exactly
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -eq 'DROP ROLE IF EXISTS accucut_restore; DROP ROLE IF EXISTS accucut_backup; DROP ROLE IF EXISTS accucut_app; DROP ROLE IF EXISTS accucut_owner;' }
        Should -Invoke Remove-AccucutTrustedTree -Times 1 -Exactly
        Should -Invoke Invoke-AccucutNative -Times 0 -Exactly -ParameterFilter { $ArgumentList -contains 'install' }
    }

    It 'does not remove an account that it did not make (the registration itself failed, for example because AccucutBackup already exists)' {
        $folders = New-BackupInstallFolder -Name 'backup-exists' -Tag 't-exists'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-exists' } }
        Mock Register-AccucutBackupTask { throw 'The user account already exists.' }
        $values = Write-FakeValuesFile -Name 'backup-exists-values.txt'
        { Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe' } | Should -Throw '*already exists*'
        Should -Invoke Remove-AccucutBackupAccount -Times 0 -Exactly
    }

    It 'refuses a private key, or anything that is not an age public key, as BACKUP_AGE_RECIPIENT' {
        $notKeys = @(('AGE-SECRET-' + 'KEY-1' + ('Q' * 58)), 'age1short', 'ssh-ed25519 AAAA', ('AGE1' + ('q' * 58)))
        foreach ($bad in $notKeys) {
            $file = Write-FakeValuesFile -Name 'bad-recipient.txt' -Extra @("BACKUP_AGE_RECIPIENT=$bad")
            $message = ''
            try { [void](Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut') } catch { $message = $_.Exception.Message }
            $message | Should -BeLike '*BACKUP_AGE_RECIPIENT must be an age PUBLIC key*'
        }
    }

    It 'names BACKUP_AGE_RECIPIENT in an unattended run when the values file has none' {
        $file = Join-Path $TestDrive 'no-recipient.txt'
        [System.IO.File]::WriteAllText($file, "ADMIN_EMAIL=a@example.test`nADMIN_INITIAL_PASSWORD=$($script:FakeAdminPassword)`nPG_SUPERUSER_PASSWORD=$($script:FakePgPassword)`n")
        { Get-AccucutInstallSettings -Template $script:Template -ValuesFile $file -NonInteractive -Port 3000 -PgHost '127.0.0.1' -PgPort 5432 -DatabaseName 'accucut' } | Should -Throw '*BACKUP_AGE_RECIPIENT*'
    }
}

Describe 'the restore role in the install, and no Admin endpoint (STORY-10.11 AC-3; ADR-015 Amendment 3.4)' {
    BeforeAll {
        function New-RestoreInstallFolder {
            param([string]$Name, [string]$Tag)
            $root = Join-Path $TestDrive $Name
            $release = Join-Path $root "releases\$Tag"
            New-Item -ItemType Directory -Path (Join-Path $release 'sql') -Force | Out-Null
            Copy-Item -LiteralPath (Join-Path $script:WindowsDirectory '..\..\.env.example') -Destination (Join-Path $release '.env.example')
            Set-Content -LiteralPath (Join-Path $release 'sql\create-roles.psql') -Value '-- the verified SQL'
            Set-Content -LiteralPath (Join-Path $release 'sql\create-restore-role.psql') -Value '-- the verified restore role SQL'
            return [pscustomobject]@{ Root = $root; Release = $release }
        }
    }

    BeforeEach {
        $script:Trace = [System.Collections.Generic.List[string]]::new()
        $script:Logged = [System.Collections.Generic.List[string]]::new()
        $script:NativeArguments = [System.Collections.Generic.List[string]]::new()
        $script:ServicesRegistered = $false
        $script:SeenRestorePassword = $null
        Mock Resolve-AccucutTrustedExecutable { $Path }
        Mock Get-AccucutPostgresInstall { [pscustomobject]@{ BinDirectory = 'C:\fake\pg\bin'; DataDirectory = 'D:\fake\pg\data'; ServiceStatus = 'Running' } }
        Mock Get-Service { if ($script:ServicesRegistered) { return [pscustomobject]@{ Name = 'AccucutApp' } } return $null }
        Mock Set-AccucutCurrentRelease { }
        Mock Write-AccucutSecureFile { }
        Mock Invoke-AccucutNative {
            $script:NativeArguments.Add(($ArgumentList -join ' '))
            if ($ArgumentList -contains 'install') { $script:ServicesRegistered = $true }
            if ($FilePath -like '*node.exe' -and $ArgumentList -contains '--version') { return [pscustomobject]@{ ExitCode = 0; Output = 'v22.12.0' } }
            if ($FilePath -like '*psql.exe') { return [pscustomobject]@{ ExitCode = 0; Output = 'psql (PostgreSQL) 17.2' } }
            return [pscustomobject]@{ ExitCode = 0; Output = 'ok' }
        }
        Mock Invoke-AccucutPsql {
            $script:Trace.Add("psql:$([System.IO.Path]::GetFileName($File))$Command")
            if ($Command -like '*FROM job_runs*') { return '1' }
            if ($Command -like 'SELECT count(*)*') { return '0' }
            if ($Command -like 'SHOW server_version_num') { return '170002' }
            return ''
        }
        Mock Invoke-AccucutMigration { [pscustomobject]@{ Deploy = 'migrated'; Seed = 'seeded' } }
        Mock Write-AccucutLog { $script:Logged.Add($Message) }
        Mock Initialize-AccucutServiceFiles { @() }
        Mock Set-AccucutServiceIdentity { }
        Mock Grant-AccucutInstallFolderAccess { }
        Mock Set-AccucutFileAcl { }
        Mock Remove-AccucutOldLogs { 0 }
        Mock Set-AccucutDefenderExclusion { $false }
        Mock Start-AccucutServices { $script:Trace.Add('start-services') }
        Mock Wait-AccucutHealth { $true }
        Mock Get-AccucutHttpStatus { 200 }
        Mock Test-AccucutBatchRightPolicy { }
        Mock Test-AccucutModuleLogging { $false }
        Mock Register-AccucutEventSource { $true }
        Mock Register-AccucutBackupTask { 'S-1-5-21-1111111111-2222222222-3333333333-1005' }
        Mock Grant-AccucutBackupRootAccess { }
        Mock New-AccucutBackupFolder { }
        Mock Write-AccucutBackupConfig { }
        Mock Write-AccucutRestoreConfig { $script:Trace.Add('restore-config'); $script:SeenRestorePassword = $RestorePassword }
        Mock Wait-AccucutBackupTask { $script:Trace.Add('first-backup'); return [uint32]0 }
        Mock Remove-AccucutBackupAccount { }
        Mock Remove-AccucutTrustedTree { $script:Trace.Add('remove-root') }
        Mock Write-Host { }
    }

    It 'AC-3: makes the restore role from the verified release''s SQL after the three roles, gives its password to the SQL through the environment only and to config\restore.pgpass, and never logs or prints it' {
        $folders = New-RestoreInstallFolder -Name 'restore-role' -Tag 't-role'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-role' } }
        $values = Write-FakeValuesFile -Name 'restore-role-values.txt'
        Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe'
        $script:SeenRestorePassword.Length | Should -Be 32
        $trace = @($script:Trace)
        [array]::IndexOf($trace, 'psql:create-restore-role.psql') | Should -BeGreaterThan ([array]::IndexOf($trace, 'psql:create-roles.psql'))
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $File -like '*releases?t-role?sql?create-restore-role.psql' -and $ExtraEnvironment.Count -eq 1 -and $ExtraEnvironment['DB_RESTORE_PASSWORD'] -eq $script:SeenRestorePassword }
        Should -Invoke Write-AccucutRestoreConfig -Times 1 -Exactly
        ($script:Logged -join "`n") | Should -Not -BeLike "*$($script:SeenRestorePassword)*"
        ($script:NativeArguments -join "`n") | Should -Not -BeLike "*$($script:SeenRestorePassword)*"
    }

    It 'ADR-015 Amendment 3.4 (d): a full install makes no endpoint, group or shortcut step, and the functions that made them are gone' {
        $folders = New-RestoreInstallFolder -Name 'restore-plain' -Tag 't-plain'
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-plain' } }
        $values = Write-FakeValuesFile -Name 'restore-plain-values.txt'
        Invoke-AccucutInstall -ValuesFile $values -NonInteractive -Root $folders.Root -Release $folders.Release -NodeExe 'C:\fake\node.exe'
        $trace = @($script:Trace)
        $trace | Should -Contain 'first-backup'
        $trace | Should -Contain 'restore-config'
        @($trace | Where-Object { $_ -match '^(admin-account|endpoint|group|shortcut)' }).Count | Should -Be 0 -Because "the trace is: $($trace -join ' / ')"
        ($script:Logged -join "$([char]10)") | Should -Not -Match 'Accucut Admin|shortcut|endpoint'
        foreach ($name in 'Resolve-AccucutAdminAccount', 'Register-AccucutAdminEndpoint', 'Unregister-AccucutAdminEndpoint', 'New-AccucutAdminShortcut', 'New-AccucutAdminGroup', 'Grant-AccucutAdminEndpointAccess', 'Register-AccucutPSSessionConfiguration') {
            Get-Command -Name $name -ErrorAction SilentlyContinue | Should -BeNullOrEmpty -Because "$name was removed with the JEA wrapper"
        }
    }

    It 'ADR-015 Amendment 3.4 (a): neither the parameter block of install.ps1 nor the one of Invoke-AccucutInstall has a parameter AdminAccount' {
        $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $script:WindowsDirectory 'install.ps1'), [ref]$null, [ref]$null)
        @($ast.ParamBlock.Parameters).Count | Should -BeGreaterThan 10
        @($ast.ParamBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -eq 'AdminAccount' }).Count | Should -Be 0
        $function = $ast.Find({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq 'Invoke-AccucutInstall' }, $true)
        $function | Should -Not -BeNullOrEmpty
        @($function.Body.ParamBlock.Parameters).Count | Should -BeGreaterThan 10
        @($function.Body.ParamBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -eq 'AdminAccount' }).Count | Should -Be 0
        (Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'install.ps1') -Raw) | Should -Not -Match 'AdminAccount'
    }

    It 'ADR-015 Amendment 3.4 (b): an old command line with -AdminAccount passes nothing of it on to the second half' {
        $arguments = @(Get-AccucutInstallChildArgument -Bound @{ AdminAccount = 'X'; Root = 'C:\Accucut' })
        $arguments | Should -Not -Contain '-AdminAccount'
        $arguments | Should -Not -Contain 'X'
        $arguments | Should -Contain '-Root'
        $arguments | Should -Contain 'C:\Accucut'
    }

    It 'ADR-015 Amendment 3.4: an old command line with -AdminAccount stops in PowerShell''s parameter binding, before anything is created' {
        # A child powershell.exe with its two streams in files, so that the text is the program's own and not an error record formatted by this session.
        $powershell = [System.IO.Path]::Combine($env:SystemRoot, 'System32\WindowsPowerShell\v1.0\powershell.exe')
        $standardOutput = Join-Path $TestDrive 'binding-out.txt'
        $standardError = Join-Path $TestDrive 'binding-err.txt'
        $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $script:WindowsDirectory 'install.ps1') + '"'), '-AdminAccount', 'TESTSRV\admin.test')
        $process = Start-Process -FilePath $powershell -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $standardOutput -RedirectStandardError $standardError
        $null = $process.Handle
        if (-not $process.WaitForExit(120000)) { try { $process.Kill() } catch { Write-Verbose 'The child had already ended.' }; throw 'The child powershell.exe did not finish in 120 seconds.' }
        # Windows PowerShell 5.1 gives $null for ExitCode of a Start-Process -PassThru object that was not waited for with its handle open (QLT-681-01), and $null is not 0: a bare
        # "Should -Not -Be 0" passed whatever the child did. Reading the handle before the wait keeps the code, and a value above 0 is the only thing that passes here.
        $process.ExitCode | Should -BeGreaterThan 0 -Because 'a refused parameter ends the child with a non-zero exit code (not $null, not 0)'
        $output = (Get-Content -LiteralPath $standardOutput -Raw) + (Get-Content -LiteralPath $standardError -Raw)
        # powershell.exe wraps its error text at the width of its console, even into a file: compare it with the white space squeezed.
        $squeezed = $output -replace '\s+', ' '
        $squeezed | Should -Match "parameter cannot be found that matches parameter name 'AdminAccount'"
        $output | Should -Not -Match 'The install stopped'
    }

    It 'ADR-015 Amendment 3.4 (c): <File> holds no code that registers a session configuration, makes a local group or a shortcut, or sets the permissions of a service' -ForEach @(
        @{ File = 'install.ps1' }, @{ File = 'AccucutOps.psm1' }
    ) {
        $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory $File) -Raw
        foreach ($term in 'Register-PSSessionConfiguration', 'New-PSSessionConfigurationFile', 'RunAsVirtualAccount', 'New-LocalGroup', 'WScript.Shell', 'CreateShortcut', 'sdset') {
            $text | Should -Not -Match ([regex]::Escape($term)) -Because "$File must not contain $term"
        }
    }
}
