#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of the shared module (STORY-10.04). Run by CI stage 13 on windows-latest: Invoke-Pester deploy/windows/tests.
  Nothing here touches C:\Accucut, a service, PostgreSQL or Windows Defender: files live under TestDrive, and every value is an invented,
  clearly fake one held in a named variable.
#>

BeforeDiscovery {
    $principal = New-Object System.Security.Principal.WindowsPrincipal([System.Security.Principal.WindowsIdentity]::GetCurrent())
    $script:IsAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    $script:FakeSecret = 'FAKE-secret-value-for-tests-1'
}

Describe 'hashes (AC-1, AC-3: the zip is checked before anything changes)' {
    It 'computes the SHA-256 of a file as lower-case hex' {
        $file = Join-Path $TestDrive 'abc.txt'
        [System.IO.File]::WriteAllText($file, 'abc')
        Get-AccucutFileSha256 -Path $file | Should -Be 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    }

    It 'accepts a matching hash in either case' {
        $file = Join-Path $TestDrive 'ok.txt'
        [System.IO.File]::WriteAllText($file, 'abc')
        { Assert-AccucutSha256 -Path $file -Expected 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD' } | Should -Not -Throw
    }

    It 'refuses a changed file and says nothing was changed' {
        $file = Join-Path $TestDrive 'changed.txt'
        [System.IO.File]::WriteAllText($file, 'abd')
        { Assert-AccucutSha256 -Path $file -Expected 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' } | Should -Throw '*does not match*Nothing was changed*'
    }

    It 'refuses a hash that is not 64 hexadecimal characters' {
        $file = Join-Path $TestDrive 'short.txt'
        [System.IO.File]::WriteAllText($file, 'abc')
        { Assert-AccucutSha256 -Path $file -Expected 'abc123' } | Should -Throw '*64 hexadecimal*'
    }

    It 'reads the expected hash from a sha256sum style file' {
        $checksum = Join-Path $TestDrive 'pkg.zip.sha256'
        [System.IO.File]::WriteAllText($checksum, "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD  pkg.zip`n")
        Read-AccucutSha256File -Path $checksum | Should -Be 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    }
}

Describe 'versions (AC-1)' {
    It 'accepts Node 22.12 and later, and says why for older ones' {
        (Test-AccucutNodeVersion -VersionText 'v22.12.0').Ok | Should -BeTrue
        (Test-AccucutNodeVersion -VersionText 'v22.23.5').Ok | Should -BeTrue
        (Test-AccucutNodeVersion -VersionText 'v22.11.9').Ok | Should -BeFalse
        (Test-AccucutNodeVersion -VersionText 'v20.18.0').Message | Should -BeLike '*too old*'
        (Test-AccucutNodeVersion -VersionText '').Message | Should -BeLike '*not found*'
    }

    It 'requires PostgreSQL 17, from psql --version or server_version_num' {
        (Test-AccucutPostgresVersion -VersionText 'psql (PostgreSQL) 17.2').Ok | Should -BeTrue
        (Test-AccucutPostgresVersion -VersionText '170011').Ok | Should -BeTrue
        (Test-AccucutPostgresVersion -VersionText 'psql (PostgreSQL) 16.4').Ok | Should -BeFalse
        (Test-AccucutPostgresVersion -VersionText '180000').Ok | Should -BeFalse
    }
}

Describe 'secrets never reach a log (AC-5)' {
    It 'blanks a registered secret in a log line, on screen and in the file' {
        Register-AccucutSecret -Value $script:FakeSecret
        $logFile = Join-Path $TestDrive 'logs\run.log'
        Write-AccucutLog -Message "connecting with $($script:FakeSecret) now" -LogFile $logFile 6>$null
        $text = Get-Content -LiteralPath $logFile -Raw
        $text | Should -Not -BeLike "*$($script:FakeSecret)*"
        $text | Should -BeLike '*connecting with *** now*'
    }

    It 'blanks a secret inside the output of a child program, and passes it to the child through the environment only' {
        Register-AccucutSecret -Value $script:FakeSecret
        $cmd = Join-Path $env:SystemRoot 'System32\cmd.exe'
        $result = Invoke-AccucutNative -FilePath $cmd -ArgumentList @('/c', 'echo', '%ACCUCUT_TEST_VALUE%') -Environment @{ ACCUCUT_TEST_VALUE = $script:FakeSecret }
        $result.ExitCode | Should -Be 0
        $result.Output | Should -Be '***'
    }

    It 'quotes arguments the way a command line needs, so no argument is split or merged' {
        ConvertTo-AccucutArgumentString -ArgumentList @('a b', 'c', '', 'd"e') | Should -Be '"a b" c "" "d\"e"'
    }

    It 'stops with the exit code and the blanked output when a program fails' {
        Register-AccucutSecret -Value $script:FakeSecret
        $cmd = Join-Path $env:SystemRoot 'System32\cmd.exe'
        { Invoke-AccucutNative -FilePath $cmd -ArgumentList @('/c', "echo $($script:FakeSecret) & exit 3") } | Should -Throw '*exit code 3*'
        try { Invoke-AccucutNative -FilePath $cmd -ArgumentList @('/c', "echo $($script:FakeSecret) & exit 3") } catch { $_.Exception.Message | Should -Not -BeLike "*$($script:FakeSecret)*" }
    }

    It 'invents long random values of letters and digits, different each time' {
        $first = New-AccucutSecret -Length 40
        $second = New-AccucutSecret -Length 40
        $first.Length | Should -Be 40
        $first | Should -Match '^[A-Za-z0-9]+$'
        $first | Should -Not -Be $second
    }
}

Describe 'the settings files (AC-1, AC-5)' {
    BeforeAll {
        $script:Template = @(
            [pscustomobject]@{ Name = 'DATABASE_URL'; Default = 'postgresql://accucut_app:CHANGE_ME_APP_PASSWORD@localhost:55432/accucut' }
            [pscustomobject]@{ Name = 'MIGRATE_DATABASE_URL'; Default = 'postgresql://accucut_owner:CHANGE_ME_OWNER_PASSWORD@localhost:55432/accucut' }
            [pscustomobject]@{ Name = 'DB_OWNER_PASSWORD'; Default = 'CHANGE_ME_OWNER_PASSWORD' }
            [pscustomobject]@{ Name = 'DB_APP_PASSWORD'; Default = 'CHANGE_ME_APP_PASSWORD' }
            [pscustomobject]@{ Name = 'AUTH_SECRET'; Default = 'CHANGE_ME_AUTH_SECRET_AT_LEAST_32_CHARACTERS' }
            [pscustomobject]@{ Name = 'APP_ORIGIN'; Default = 'http://localhost:3000' }
            [pscustomobject]@{ Name = 'SMTP_USER'; Default = '' }
            [pscustomobject]@{ Name = 'ADMIN_EMAIL'; Default = 'admin@example.test' }
            [pscustomobject]@{ Name = 'ADMIN_INITIAL_PASSWORD'; Default = 'CHANGE_ME_ADMIN_PASSWORD' }
        )
        $script:FakeOwnerUrl = 'postgresql://accucut_owner:FAKEownerPassword1@127.0.0.1:5432/accucut'
        $script:FakeAppUrl = 'postgresql://accucut_app:FAKEappPassword2@127.0.0.1:5432/accucut'
        $script:Values = [ordered]@{
            DATABASE_URL = $script:FakeAppUrl; MIGRATE_DATABASE_URL = $script:FakeOwnerUrl
            AUTH_SECRET = 'FAKE-auth-secret-0123456789-0123456789-ab'; ADMIN_INITIAL_PASSWORD = 'Fake first pass 1#'
        }
    }

    It 'keeps the owner role and the first Admin out of the file that the services read' {
        $split = Split-AccucutEnvValues -Template $script:Template -Values $script:Values
        $runtimeNames = $split.Runtime | ForEach-Object { ($_ -split '=', 2)[0] }
        $migrateNames = $split.Migrate | ForEach-Object { ($_ -split '=', 2)[0] }
        $runtimeNames | Should -Contain 'DATABASE_URL'
        $runtimeNames | Should -Contain 'AUTH_SECRET'
        $runtimeNames | Should -Not -Contain 'MIGRATE_DATABASE_URL'
        $runtimeNames | Should -Not -Contain 'ADMIN_INITIAL_PASSWORD'
        $migrateNames | Should -Be @('MIGRATE_DATABASE_URL', 'ADMIN_EMAIL', 'ADMIN_INITIAL_PASSWORD')
        ($split.Runtime -join "`n") | Should -Not -BeLike '*accucut_owner*'
    }

    It 'leaves out the development-only passwords of the template' {
        $split = Split-AccucutEnvValues -Template $script:Template -Values $script:Values
        (($split.Runtime + $split.Migrate) -join "`n") | Should -Not -Match 'DB_OWNER_PASSWORD|DB_APP_PASSWORD'
    }

    It 'names a setting that still has no value, and never shows a value' {
        $partial = [ordered]@{ DATABASE_URL = $script:FakeAppUrl }
        { Split-AccucutEnvValues -Template $script:Template -Values $partial } | Should -Throw '*No value was given for: MIGRATE_DATABASE_URL, AUTH_SECRET, ADMIN_INITIAL_PASSWORD*'
        try { Split-AccucutEnvValues -Template $script:Template -Values $partial } catch { $_.Exception.Message | Should -Not -BeLike '*FAKEappPassword2*' }
    }

    It 'quotes a value that holds a space or a hash, and refuses a line break' {
        Format-AccucutEnvValue -Value 'plain-value_1' | Should -Be 'plain-value_1'
        Format-AccucutEnvValue -Value 'has space #1' | Should -Be "'has space #1'"
        Format-AccucutEnvValue -Value "it's #1" | Should -Be '"it''s #1"'
        { Format-AccucutEnvValue -Value "a`nb" } | Should -Throw '*line break*'
    }

    It 'reads a values file, skipping comments and removing one pair of quotes' {
        $file = Join-Path $TestDrive 'values.txt'
        [System.IO.File]::WriteAllText($file, "# comment`nAPP_ORIGIN=http://server:3000`n`nADMIN_EMAIL='a@example.test'`n")
        $values = Read-AccucutValuesFile -Path $file
        $values['APP_ORIGIN'] | Should -Be 'http://server:3000'
        $values['ADMIN_EMAIL'] | Should -Be 'a@example.test'
        { $bad = Join-Path $TestDrive 'bad.txt'; [System.IO.File]::WriteAllText($bad, 'not a pair'); Read-AccucutValuesFile -Path $bad } | Should -Throw '*not NAME=value*'
    }

    It 'fills a service template, escapes what XML needs, and refuses a name it does not know' {
        Expand-AccucutTemplate -Text '<a>{{X}}</a>' -Token @{ X = 'C:\Program Files\a&b' } | Should -Be '<a>C:\Program Files\a&amp;b</a>'
        { Expand-AccucutTemplate -Text '{{TYPO}}' -Token @{ X = '1' } } | Should -Throw '*TYPO*'
    }

    It 'a file is created locked to Administrators and the named account only, before its content is written (ACL)' -Skip:(-not $script:IsAdmin) {
        $file = Join-Path $TestDrive 'secure.env'
        Write-AccucutSecureFile -Path $file -Line @('A=1', 'B=2') -ReadAccount @('NT AUTHORITY\SYSTEM')
        $acl = Get-Acl -LiteralPath $file
        $acl.AreAccessRulesProtected | Should -BeTrue
        $identities = $acl.Access | ForEach-Object { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value }
        $identities | Sort-Object | Should -Be @('S-1-5-18', 'S-1-5-32-544')
        ($acl.Access | Where-Object { $_.IdentityReference.Value -like '*Administrators' }).FileSystemRights | Should -Be 'FullControl'
        ($acl.Access | Where-Object { $_.IdentityReference.Value -like '*SYSTEM' }).FileSystemRights.ToString() | Should -Match 'Read'
        (Get-Content -LiteralPath $file -Raw) | Should -Be "A=1`r`nB=2`r`n"
        # No byte order mark: Node's --env-file would read it as part of the first name.
        [System.IO.File]::ReadAllBytes($file)[0] | Should -Be ([byte][char]'A')
    }
}

Describe 'releases and the current junction (AC-3, AC-4)' {
    BeforeEach {
        $script:Paths = Get-AccucutPaths -Root (Join-Path $TestDrive ('accucut-' + [guid]::NewGuid().ToString('N').Substring(0, 6)))
        foreach ($tag in 'r1', 'r2', 'r3') {
            New-Item -ItemType Directory -Path (Join-Path $script:Paths.Releases $tag) -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $script:Paths.Releases "$tag\marker.txt") -Value $tag
        }
    }

    It 'points current at a release and reads the tag back' {
        Get-AccucutCurrentRelease -Paths $script:Paths | Should -BeNullOrEmpty
        Set-AccucutCurrentRelease -Paths $script:Paths -Tag 'r1'
        Get-AccucutCurrentRelease -Paths $script:Paths | Should -Be 'r1'
        Get-Content -LiteralPath (Join-Path $script:Paths.Current 'marker.txt') | Should -Be 'r1'
    }

    It 'moves the junction and back, and never deletes the files of the release it left (rollback)' {
        Set-AccucutCurrentRelease -Paths $script:Paths -Tag 'r1'
        Set-AccucutCurrentRelease -Paths $script:Paths -Tag 'r2'
        Get-AccucutCurrentRelease -Paths $script:Paths | Should -Be 'r2'
        Test-Path -LiteralPath (Join-Path $script:Paths.Releases 'r1\marker.txt') | Should -BeTrue
        Set-AccucutCurrentRelease -Paths $script:Paths -Tag 'r1'
        Get-AccucutCurrentRelease -Paths $script:Paths | Should -Be 'r1'
        Test-Path -LiteralPath (Join-Path $script:Paths.Releases 'r2\marker.txt') | Should -BeTrue
    }

    It 'refuses to replace a real folder named current, and a release that does not exist' {
        New-Item -ItemType Directory -Path $script:Paths.Current -Force | Out-Null
        { Set-AccucutCurrentRelease -Paths $script:Paths -Tag 'r1' } | Should -Throw '*not a junction*'
        Remove-Item -LiteralPath $script:Paths.Current
        { Set-AccucutCurrentRelease -Paths $script:Paths -Tag 'nope' } | Should -Throw '*does not exist*'
    }

    It 'keeps the current and the previous release only (AC-3)' {
        Set-AccucutCurrentRelease -Paths $script:Paths -Tag 'r3'
        $removed = Remove-AccucutOldReleases -Paths $script:Paths -Keep @('r3', 'r2')
        $removed | Should -Be @('r1')
        (Get-ChildItem -LiteralPath $script:Paths.Releases -Directory | Select-Object -ExpandProperty Name | Sort-Object) | Should -Be @('r2', 'r3')
    }

    It 'never deletes the release that current points at, even if it is not in the keep list' {
        Set-AccucutCurrentRelease -Paths $script:Paths -Tag 'r1'
        Remove-AccucutOldReleases -Paths $script:Paths -Keep @('r3') | Out-Null
        Test-Path -LiteralPath (Join-Path $script:Paths.Releases 'r1\marker.txt') | Should -BeTrue
    }

    It 'refuses to delete a folder outside the one it is given' {
        $outside = Join-Path $TestDrive 'elsewhere'
        New-Item -ItemType Directory -Path $outside -Force | Out-Null
        { Remove-AccucutDirectory -Path $outside -Within $script:Paths.Releases } | Should -Throw '*not inside*'
        { Remove-AccucutDirectory -Path $script:Paths.Releases -Within $script:Paths.Releases } | Should -Throw '*not inside*'
        Test-Path -LiteralPath $outside | Should -BeTrue
    }
}

Describe 'logs: 30 days kept (AC-6, NFR-024)' {
    It 'deletes log files older than 30 days and keeps the rest' {
        $folder = Join-Path $TestDrive 'logs-30'
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        $old = Join-Path $folder 'AccucutApp.20250101.out.log'
        $edge = Join-Path $folder 'AccucutApp.20251001.out.log'
        $new = Join-Path $folder 'AccucutApp.20251101.out.log'
        $other = Join-Path $folder 'notes.txt'
        foreach ($file in $old, $edge, $new, $other) { Set-Content -LiteralPath $file -Value 'x' }
        (Get-Item -LiteralPath $old).LastWriteTime = (Get-Date).AddDays(-31)
        (Get-Item -LiteralPath $edge).LastWriteTime = (Get-Date).AddDays(-29)
        (Get-Item -LiteralPath $other).LastWriteTime = (Get-Date).AddDays(-90)
        $removed = Remove-AccucutOldLogs -Path $folder -KeepDays 30
        $removed | Should -Be @('AccucutApp.20250101.out.log')
        Test-Path -LiteralPath $edge | Should -BeTrue
        Test-Path -LiteralPath $new | Should -BeTrue
        Test-Path -LiteralPath $other | Should -BeTrue
    }

    It 'does nothing when the folder does not exist' {
        @(Remove-AccucutOldLogs -Path (Join-Path $TestDrive 'no-such-folder')).Count | Should -Be 0
    }
}

Describe 'the service files (AC-1, AC-6)' {
    BeforeAll {
        $script:Release = Join-Path $TestDrive 'release'
        New-Item -ItemType Directory -Path (Join-Path $script:Release 'bin') -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $script:WindowsDirectory 'services') -Destination (Join-Path $script:Release 'services') -Recurse
        [System.IO.File]::WriteAllText((Join-Path $script:Release 'bin\winsw.exe'), 'not a real program, a stand-in for the test')
        $script:ServicePaths = Get-AccucutPaths -Root (Join-Path $TestDrive 'svc-root')
        $script:Changed = Initialize-AccucutServiceFiles -Paths $script:ServicePaths -ReleaseDirectory $script:Release -NodeExe 'C:\Program Files\nodejs\node.exe' -Port 3000 -ListenAddress '0.0.0.0'
    }

    It 'writes both service files and reports them as new, then as unchanged' {
        $script:Changed | Should -Be @('AccucutApp', 'AccucutWorker')
        Initialize-AccucutServiceFiles -Paths $script:ServicePaths -ReleaseDirectory $script:Release -NodeExe 'C:\Program Files\nodejs\node.exe' -Port 3000 -ListenAddress '0.0.0.0' | Should -BeNullOrEmpty
        Initialize-AccucutServiceFiles -Paths $script:ServicePaths -ReleaseDirectory $script:Release -NodeExe 'C:\Program Files\nodejs\node.exe' -Port 8080 -ListenAddress '127.0.0.1' | Should -Be @('AccucutApp', 'AccucutWorker')
    }

    It 'registers each service after PostgreSQL, Automatic (Delayed Start), restarting after 10, 30 and 60 seconds, with logs that roll daily' -ForEach @(@{ Name = 'AccucutApp' }, @{ Name = 'AccucutWorker' }) {
        $xml = New-Object System.Xml.XmlDocument
        $xml.Load((Join-Path $script:ServicePaths.Services "$Name.xml"))
        $service = $xml.service
        $service.id | Should -Be $Name
        $service.depend | Should -Be 'postgresql-x64-17'
        $service.startmode | Should -Be 'Automatic'
        $service.delayedAutoStart | Should -Be 'true'
        ($service.onfailure | ForEach-Object { "$($_.action):$($_.delay)" }) | Should -Be @('restart:10 sec', 'restart:30 sec', 'restart:60 sec')
        $service.log.mode | Should -Be 'roll-by-time'
        $service.log.pattern | Should -Be 'yyyyMMdd'
        $service.logpath | Should -Be $script:ServicePaths.Logs
    }

    It 'holds no secret, no password and no account: the service account is set by sc.exe, never LocalSystem' {
        foreach ($name in 'AccucutApp', 'AccucutWorker') {
            $xml = New-Object System.Xml.XmlDocument
            $xml.Load((Join-Path $script:ServicePaths.Services "$name.xml"))
            # The root element only: the comment above it explains the rule in words.
            $text = $xml.service.OuterXml
            $text | Should -Not -Match '(?i)password|serviceaccount|localsystem|DATABASE_URL|AUTH_SECRET'
            $text | Should -BeLike "*--env-file=`"$($script:ServicePaths.EnvFile)`"*"
        }
    }

    It 'refuses a service that runs as LocalSystem' {
        Mock -ModuleName AccucutOps Get-CimInstance { [pscustomobject]@{ Name = 'AccucutApp'; StartName = 'LocalSystem'; StartMode = 'Auto'; DelayedAutoStart = $true } }
        { Assert-AccucutServiceIdentity -Name 'AccucutApp' } | Should -Throw '*never run as LocalSystem*'
    }

    It 'accepts the virtual account with Automatic (Delayed Start), and refuses it without Delayed Start' {
        Mock -ModuleName AccucutOps Get-CimInstance { [pscustomobject]@{ Name = 'AccucutApp'; StartName = 'NT SERVICE\AccucutApp'; StartMode = 'Auto'; DelayedAutoStart = $true } }
        { Assert-AccucutServiceIdentity -Name 'AccucutApp' } | Should -Not -Throw
        Mock -ModuleName AccucutOps Get-CimInstance { [pscustomobject]@{ Name = 'AccucutApp'; StartName = 'NT SERVICE\AccucutApp'; StartMode = 'Auto'; DelayedAutoStart = $false } }
        { Assert-AccucutServiceIdentity -Name 'AccucutApp' } | Should -Throw '*Delayed Start*'
    }
}

Describe 'the migrate step (AC-1, AC-5)' {
    It 'passes the owner role''s connection string in the environment of the child, never in its arguments, and runs both programs' {
        Mock -ModuleName AccucutOps Invoke-AccucutNative { [pscustomobject]@{ ExitCode = 0; Output = 'ok' } }
        Invoke-AccucutMigration -ReleaseDirectory 'C:\Accucut\releases\t1' -NodeExe 'C:\node\node.exe' -MigrateDatabaseUrl 'postgresql://accucut_owner:FAKEownerPassword1@127.0.0.1:5432/accucut' | Out-Null
        Should -Invoke Invoke-AccucutNative -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter {
            ($ArgumentList -join ' ') -like '*prisma*migrate deploy*prisma.config.mjs' -and
            $Environment['MIGRATE_DATABASE_URL'] -eq 'postgresql://accucut_owner:FAKEownerPassword1@127.0.0.1:5432/accucut' -and
            $Environment['PRISMA_SCHEMA_ENGINE_BINARY'] -like '*schema-engine-windows.exe'
        }
        Should -Invoke Invoke-AccucutNative -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter {
            ($ArgumentList -join ' ') -like '*ensure-seed-version.mjs' -and $Environment['MIGRATE_DATABASE_URL'] -like '*accucut_owner*'
        }
        Should -Invoke Invoke-AccucutNative -ModuleName AccucutOps -Times 0 -Exactly -ParameterFilter { ($ArgumentList -join ' ') -like '*FAKEownerPassword1*' }
    }
}

Describe 'service accounts by SID' {
    It 'works out the SID of a service account from its name, as Windows does' {
        # The well-known SID of NT SERVICE\TrustedInstaller is the published example of this rule.
        Get-AccucutServiceSid -Name 'TrustedInstaller' | Should -Be 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'
        Get-AccucutServiceSid -Name 'trustedinstaller' | Should -Be (Get-AccucutServiceSid -Name 'TrustedInstaller')
        Get-AccucutServiceSid -Name 'AccucutApp' | Should -Match '^S-1-5-80(-\d+){5}$'
        Get-AccucutServiceSid -Name 'AccucutApp' | Should -Not -Be (Get-AccucutServiceSid -Name 'AccucutWorker')
    }

    It 'turns a SID in text into a SID and a name into an account' {
        (ConvertTo-AccucutIdentity -Account 'S-1-5-32-544') | Should -BeOfType ([System.Security.Principal.SecurityIdentifier])
        (ConvertTo-AccucutIdentity -Account 'NT AUTHORITY\SYSTEM') | Should -BeOfType ([System.Security.Principal.NTAccount])
    }
}

# The permissions of a part of a path are mocked (Get-AccucutPathSecurity returns an owner and a list of allow rules), so that every refusal can be
# shown on any machine. Links are real: the tests make junctions. The right numbers are those of FileSystemRights.
#   Delete 65536, DeleteSubdirectoriesAndFiles 64, ChangePermissions 262144, TakeOwnership 524288, WriteData 2, AppendData 4,
#   ReadAndExecute 1179817, Modify 1245631.
Describe 'one rule for path trust: Assert-AccucutPathTrusted (security review)' {
    BeforeEach {
        $script:Base = Join-Path $TestDrive ('trust-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        $script:Leaf = Join-Path $script:Base 'anc\mid\leaf'
        New-Item -ItemType Directory -Path $script:Leaf -Force | Out-Null
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity { [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @() } }
    }

    It 'accepts a path whose every part is owned by Administrators, SYSTEM or TrustedInstaller and carries no foreign rule' {
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Not -Throw
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity { [pscustomobject]@{ Owner = 'S-1-5-18'; Rules = @() } }
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Not -Throw
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity { [pscustomobject]@{ Owner = 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'; Rules = @() } }
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Not -Throw
    }

    It 'refuses a link (a junction) at an ancestor, so the path cannot lead somewhere else' {
        $real = Join-Path $script:Base 'real'
        New-Item -ItemType Directory -Path (Join-Path $real 'mid\leaf') -Force | Out-Null
        $link = Join-Path $script:Base 'lnk'
        New-Item -ItemType Junction -Path $link -Target $real | Out-Null
        { Assert-AccucutPathTrusted -Path (Join-Path $link 'mid\leaf') } | Should -Throw "*lnk' is a link*could lead somewhere else*"
    }

    It 'refuses a link at the target, unless the caller says the target is a link on purpose (current)' {
        $real = Join-Path $script:Base 'real-release'
        New-Item -ItemType Directory -Path $real | Out-Null
        $current = Join-Path $script:Base 'current'
        New-Item -ItemType Junction -Path $current -Target $real | Out-Null
        { Assert-AccucutPathTrusted -Path $current } | Should -Throw '*is a link*'
        { Assert-AccucutPathTrusted -Path $current -AllowLinkAtLeaf } | Should -Not -Throw
    }

    It 'refuses an ancestor that someone else owns' {
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity {
            param($Path)
            if ($Path -like '*\mid') { return [pscustomobject]@{ Owner = 'S-1-5-21-1111111111-2222222222-3333333333-1001'; Rules = @() } }
            [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @() }
        }
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Throw "*mid' is owned by S-1-5-21-1111111111-2222222222-3333333333-1001*"
    }

    It 'refuses an ancestor on which another user has <Name>' -ForEach @(
        @{ Name = 'Delete'; Rights = 65536 }
        @{ Name = 'DeleteSubdirectoriesAndFiles'; Rights = 64 }
        @{ Name = 'ChangePermissions'; Rights = 262144 }
        @{ Name = 'TakeOwnership'; Rights = 524288 }
        @{ Name = 'Modify (it includes Delete)'; Rights = 1245631 }
    ) {
        $mock = [scriptblock]::Create("param(`$Path) if (`$Path -like '*\anc') { return [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @([pscustomobject]@{ Sid = 'S-1-5-32-545'; Rights = $Rights; InheritOnly = `$false }) } } [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @() }")
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity $mock
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Throw "*anc' can be changed by S-1-5-32-545*"
    }

    It 'the drive root rule: users may make folders and files in the drive root, and have Modify on what is inside it, and that is allowed; delete-child there is not' {
        # What a default Windows C:\ holds, owned by SYSTEM: create folders (this folder), create files (this folder), Modify on what is inside (inherit only),
        # read for Users. None of it lets a user delete, replace or take over an existing folder that an administrator owns.
        $defaults = "@([pscustomobject]@{ Sid = 'S-1-5-11'; Rights = 4; InheritOnly = `$false }, [pscustomobject]@{ Sid = 'S-1-5-11'; Rights = 2; InheritOnly = `$false }, [pscustomobject]@{ Sid = 'S-1-5-11'; Rights = 1245631; InheritOnly = `$true }, [pscustomobject]@{ Sid = 'S-1-5-32-545'; Rights = 1179817; InheritOnly = `$false })"
        $make = { param($extra) [scriptblock]::Create("param(`$Path) if (`$Path -match '^[A-Za-z]:\\?`$') { return [pscustomobject]@{ Owner = 'S-1-5-18'; Rules = @($defaults) + @($extra) } } [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @() }") }
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity (& $make '')
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Not -Throw

        # The same user with delete-child on the drive root itself is refused, whatever the folder is called.
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity (& $make "[pscustomobject]@{ Sid = 'S-1-5-11'; Rights = 64; InheritOnly = `$false }")
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Throw "*can be changed by S-1-5-11*"

        # The same right marked inherit-only reaches only what is inside the drive root, not the drive root, so it is not counted there.
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity (& $make "[pscustomobject]@{ Sid = 'S-1-5-11'; Rights = 64; InheritOnly = `$true }")
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Not -Throw
    }

    It 'the target is held to the stricter rule: no other user may write, make folders or write attributes, and inherit-only rules count' {
        $mock = [scriptblock]::Create("param(`$Path) if (`$Path -like '*\leaf') { return [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @([pscustomobject]@{ Sid = 'S-1-5-32-545'; Rights = 2; InheritOnly = `$false }) } } [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @() }")
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity $mock
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Throw "*leaf' can be changed by S-1-5-32-545*"
        $inheritOnly = [scriptblock]::Create("param(`$Path) if (`$Path -like '*\leaf') { return [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @([pscustomobject]@{ Sid = 'S-1-5-32-545'; Rights = 1245631; InheritOnly = `$true }) } } [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @() }")
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity $inheritOnly
        { Assert-AccucutPathTrusted -Path $script:Leaf } | Should -Throw "*leaf' can be changed by S-1-5-32-545*"
        # A named account (the service accounts, for logs) may write to the target, and only to the target.
        { Assert-AccucutPathTrusted -Path $script:Leaf -AllowedWriter @('S-1-5-32-545') } | Should -Not -Throw
        $ancestor = [scriptblock]::Create("param(`$Path) if (`$Path -like '*\anc') { return [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @([pscustomobject]@{ Sid = 'S-1-5-32-545'; Rights = 65536; InheritOnly = `$false }) } } [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @() }")
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity $ancestor
        { Assert-AccucutPathTrusted -Path $script:Leaf -AllowedWriter @('S-1-5-32-545') } | Should -Throw "*anc' can be changed by*"
    }

    It 'checks a file the same way (a script or the module), and refuses a path that is not full and local or does not exist' {
        $file = Join-Path $script:Leaf 'AccucutOps.psm1'
        Set-Content -LiteralPath $file -Value '# module'
        { Assert-AccucutPathTrusted -Path $file } | Should -Not -Throw
        $mock = [scriptblock]::Create("param(`$Path) if (`$Path -like '*.psm1') { return [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @([pscustomobject]@{ Sid = 'S-1-5-32-545'; Rights = 4; InheritOnly = `$false }) } } [pscustomobject]@{ Owner = 'S-1-5-32-544'; Rules = @() }")
        Mock -ModuleName AccucutOps Get-AccucutPathSecurity $mock
        { Assert-AccucutPathTrusted -Path $file } | Should -Throw "*psm1' can be changed by S-1-5-32-545*"
        { Assert-AccucutPathTrusted -Path 'relative\path' } | Should -Throw '*not a full local path*'
        { Assert-AccucutPathTrusted -Path '\\server\share\x' } | Should -Throw '*not a full local path*'
        { Assert-AccucutPathTrusted -Path (Join-Path $script:Leaf 'missing') } | Should -Throw '*does not exist*'
    }

    It 'reads the real owner and rules of a real folder as plain data' {
        $security = Get-AccucutPathSecurity -Path $script:Leaf
        $security.Owner | Should -Match '^S-1-\d+(-\d+)+$'
        $security.Rules.Count | Should -BeGreaterThan 0
        $security.Rules[0].PSObject.Properties.Name | Should -Be @('Sid', 'Rights', 'InheritOnly')
    }
}

Describe 'update.ps1 uses the same rule on every folder it writes to' {
    It 'checks the install folder, releases, config, services and logs (the two service accounts may write to logs only), and the folder that current points at' {
        $paths = Get-AccucutPaths -Root (Join-Path $TestDrive 'trusted-install')
        New-Item -ItemType Directory -Path (Join-Path $paths.Releases 't-cur') -Force | Out-Null
        New-Item -ItemType Junction -Path $paths.Current -Target (Join-Path $paths.Releases 't-cur') | Out-Null
        Mock -ModuleName AccucutOps Assert-AccucutPathTrusted { }
        Assert-AccucutInstallTrusted -Paths $paths
        Should -Invoke Assert-AccucutPathTrusted -ModuleName AccucutOps -Times 7 -Exactly
        Should -Invoke Assert-AccucutPathTrusted -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter { $Path -like '*logs' -and $AllowedWriter.Count -eq 2 -and ($AllowedWriter | Where-Object { $_ -notmatch '^S-1-5-80(-\d+){5}$' }).Count -eq 0 }
        Should -Invoke Assert-AccucutPathTrusted -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter { $Path -like '*current' -and $AllowLinkAtLeaf }
        Should -Invoke Assert-AccucutPathTrusted -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter { $Path -like '*releases?t-cur' }
    }

    It 'refuses a current link that does not point directly inside releases' {
        $paths = Get-AccucutPaths -Root (Join-Path $TestDrive 'current-link-root')
        New-Item -ItemType Directory -Path (Join-Path $paths.Root 'elsewhere\t-x'), $paths.Releases -Force | Out-Null
        New-Item -ItemType Junction -Path $paths.Current -Target (Join-Path $paths.Root 'elsewhere\t-x') | Out-Null
        Mock -ModuleName AccucutOps Assert-AccucutPathTrusted { }
        { Assert-AccucutInstallTrusted -Paths $paths } | Should -Throw '*does not point at a folder directly inside*'
    }
}

