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
    BeforeEach {
        $script:Trace.Clear()
        Mock Test-AccucutScriptAdministrator { $true }
        Mock Assert-AccucutTrustedPath { $script:Trace.Add("path:$Path") }
        Mock Assert-AccucutTrustedNoLinks { $script:Trace.Add('nolinks') }
        Mock Import-AccucutTrustedModule { $script:Trace.Add('import') }
        Mock Invoke-AccucutInstall { $script:Trace.Add('install') }
    }

    It 'checks where it is, then the release folder and its links, then loads the module, then installs: in that order' {
        Invoke-AccucutInstallSecondHalf -Root 'C:\Accucut' -VerifiedRelease 'C:\Accucut\releases\t1' -ScriptPath 'C:\Accucut\releases\t1\install.ps1' -InstallParameter @{ Port = 3002 }
        ($script:Trace -join ',') | Should -Be 'path:C:\Accucut\releases\t1,nolinks,import,install'
        Should -Invoke Import-AccucutTrustedModule -Times 1 -Exactly -ParameterFilter { $Root -eq 'C:\Accucut' -and $Release -eq 'C:\Accucut\releases\t1' }
        Should -Invoke Invoke-AccucutInstall -Times 1 -Exactly -ParameterFilter { $Release -eq 'C:\Accucut\releases\t1' -and $Root -eq 'C:\Accucut' -and $Port -eq 3002 }
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
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -like 'DROP ROLE IF EXISTS accucut_app; DROP ROLE IF EXISTS accucut_owner;' }
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
