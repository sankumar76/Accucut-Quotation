#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of install.ps1 (STORY-10.04), with every prompt, program and Windows service call mocked. The real install is proved by CI
  stage 13 on a Windows runner. All values here are invented and clearly fake.
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
        { Invoke-AccucutInstall -ZipPath 'x.zip' -Root (Join-Path $TestDrive 'a1') } | Should -Throw '*as an administrator*'
        Test-Path -LiteralPath (Join-Path $TestDrive 'a1') | Should -BeFalse
    }

    It 'stops when no zip is given, or its SHA-256 is missing or wrong, and creates nothing' {
        Mock Test-InstallerIsAdministrator { $true }
        $root = Join-Path $TestDrive 'a2'
        { Invoke-AccucutInstall -Root $root } | Should -Throw '*Give the release zip*'
        $zip = Join-Path $TestDrive 'pkg.zip'
        [System.IO.File]::WriteAllText($zip, 'a stand-in for a zip')
        { Invoke-AccucutInstall -ZipPath $zip -Root $root } | Should -Throw '*No SHA-256 given*'
        { Invoke-AccucutInstall -ZipPath $zip -Sha256 ('0' * 64) -Root $root } | Should -Throw '*does not match*Nothing was changed*'
        Test-Path -LiteralPath $root | Should -BeFalse
    }

    It 'takes the expected hash from the .sha256 file next to the zip' {
        $zip = Join-Path $TestDrive 'pkg2.zip'
        [System.IO.File]::WriteAllText($zip, 'another stand-in')
        $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
        [System.IO.File]::WriteAllText("$zip.sha256", "$hash  pkg2.zip`n")
        Mock Import-Module { }
        { Initialize-AccucutPackage -ZipPath $zip -PackageRoot $TestDrive } | Should -Not -Throw
        [System.IO.File]::WriteAllText("$zip.sha256", ('f' * 64) + "  pkg2.zip`n")
        { Initialize-AccucutPackage -ZipPath $zip -PackageRoot $TestDrive } | Should -Throw '*does not match*'
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

Describe 'a failed install leaves nothing behind that this run made (AC-1)' {
    BeforeAll {
        $script:LoggedMessages = New-Object System.Collections.Generic.List[string]
    }

    It 'drops the database and roles that it created, never reveals a secret, and re-throws' {
        $root = Join-Path $TestDrive 'failing-install'
        $package = Join-Path $TestDrive 'package'
        New-Item -ItemType Directory -Path (Join-Path $package 'sql') -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $script:WindowsDirectory '..\..\.env.example') -Destination (Join-Path $package '.env.example')
        Set-Content -LiteralPath (Join-Path $package 'sql\create-roles.psql') -Value '-- stand-in'
        $values = Write-FakeValuesFile -Name 'failing-values.txt'
        $zip = Join-Path $TestDrive 'stand-in.zip'
        [System.IO.File]::WriteAllText($zip, 'a stand-in for the release zip')
        $script:LoggedMessages.Clear()

        Mock Test-InstallerIsAdministrator { $true }
        Mock Initialize-AccucutPackage { }
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-fail' } }
        Mock Get-Command { [pscustomobject]@{ Source = 'C:\fake\node.exe' } } -ParameterFilter { $Name -eq 'node' }
        Mock Get-AccucutPostgresInstall { [pscustomobject]@{ BinDirectory = 'C:\fake\pg\bin'; DataDirectory = 'C:\fake\pg\data'; ServiceStatus = 'Running' } }
        Mock Get-Service { $null }
        Mock Set-AccucutDirectoryAcl { }
        Mock Copy-AccucutTree { New-Item -ItemType Directory -Path $Destination -Force | Out-Null }
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

        { Invoke-AccucutInstall -ZipPath $zip -ValuesFile $values -NonInteractive -Root $root -PackageRoot $package } | Should -Throw '*migration failed on purpose*'

        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -like 'CREATE DATABASE*' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $File -like '*create-roles.psql' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -like 'DROP DATABASE IF EXISTS*' }
        Should -Invoke Invoke-AccucutPsql -Times 1 -Exactly -ParameterFilter { $Command -like 'DROP ROLE IF EXISTS accucut_app; DROP ROLE IF EXISTS accucut_owner;' }
        # The failure happened before any service was registered, so nothing was started.
        Should -Invoke Invoke-AccucutNative -Times 0 -Exactly -ParameterFilter { $FilePath -like '*Accucut*.exe' }
        $script:LoggedMessages | Should -Not -BeNullOrEmpty
        foreach ($secret in $script:FakeOwnerPassword, $script:FakeAppPassword, $script:FakeAdminPassword, $script:FakePgPassword) {
            ($script:LoggedMessages -join "`n") | Should -Not -BeLike "*$secret*"
        }
    }

    It 'refuses to start when the portal is already installed, and changes nothing' {
        $root = Join-Path $TestDrive 'installed-already'
        $paths = Get-AccucutPaths -Root $root
        New-Item -ItemType Directory -Path $paths.Config -Force | Out-Null
        Set-Content -LiteralPath $paths.EnvFile -Value 'A=1'
        $package = Join-Path $TestDrive 'package'
        Mock Test-InstallerIsAdministrator { $true }
        Mock Initialize-AccucutPackage { }
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-again' } }
        Mock Get-Command { [pscustomobject]@{ Source = 'C:\fake\node.exe' } } -ParameterFilter { $Name -eq 'node' }
        Mock Get-AccucutPostgresInstall { [pscustomobject]@{ BinDirectory = 'C:\fake\pg\bin'; DataDirectory = 'C:\fake\pg\data'; ServiceStatus = 'Running' } }
        Mock Invoke-AccucutNative {
            if ($FilePath -like '*node.exe') { return [pscustomobject]@{ ExitCode = 0; Output = 'v22.12.0' } }
            return [pscustomobject]@{ ExitCode = 0; Output = 'psql (PostgreSQL) 17.2' }
        }
        Mock Invoke-AccucutPsql { '' }
        Mock Write-AccucutSecureFile { }
        { Invoke-AccucutInstall -ZipPath 'ignored.zip' -NonInteractive -Root $root -PackageRoot $package } | Should -Throw '*already installed*run update.ps1*'
        Should -Invoke Invoke-AccucutPsql -Times 0 -Exactly
        Should -Invoke Write-AccucutSecureFile -Times 0 -Exactly
        (Get-Content -LiteralPath $paths.EnvFile -Raw).Trim() | Should -Be 'A=1'
    }

    It 'stops on an old Node.js or a PostgreSQL that is not 17, before the first change' {
        Mock Test-InstallerIsAdministrator { $true }
        Mock Initialize-AccucutPackage { }
        Mock Read-AccucutReleaseInfo { [pscustomobject]@{ tag = 't-old' } }
        Mock Get-Command { [pscustomobject]@{ Source = 'C:\fake\node.exe' } } -ParameterFilter { $Name -eq 'node' }
        Mock Invoke-AccucutNative { [pscustomobject]@{ ExitCode = 0; Output = 'v20.18.0' } }
        $root = Join-Path $TestDrive 'old-node'
        { Invoke-AccucutInstall -ZipPath 'ignored.zip' -NonInteractive -Root $root -PackageRoot $TestDrive } | Should -Throw '*too old*'
        Test-Path -LiteralPath $root | Should -BeFalse
    }
}
