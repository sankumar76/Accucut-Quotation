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
        $logFile = Join-Path $TestDrive "logs\$(New-AccucutLogFileName -Prefix 'secret')"
        try { Write-AccucutLog -Message "connecting with $($script:FakeSecret) now" -LogFile $logFile 6>$null } finally { Close-AccucutLog }
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

    It 'drops every inherited PG* variable for the child when asked, and keeps the ones it is given (a PGPASSWORD set on the machine must not beat the password file)' {
        $cmd = Join-Path $env:SystemRoot 'System32\cmd.exe'
        $env:PGPASSWORD = 'stale-machine-value'
        $env:PGHOST = 'stale-host'
        try {
            $kept = Invoke-AccucutNative -FilePath $cmd -ArgumentList @('/c', 'echo', '[%PGPASSWORD%][%PGHOST%]')
            $kept.Output | Should -Be '[stale-machine-value][stale-host]' -Because 'without the switch the child inherits them (the premise of this test)'
            $cleared = Invoke-AccucutNative -FilePath $cmd -ArgumentList @('/c', 'echo', '[%PGPASSWORD%][%PGHOST%][%PGPASSFILE%]') -Environment @{ PGPASSFILE = 'C:\x\backup.pgpass' } -ClearPgEnvironment
            $cleared.Output | Should -Be '[%PGPASSWORD%][%PGHOST%][C:\x\backup.pgpass]'
        }
        finally { Remove-Item Env:\PGPASSWORD, Env:\PGHOST -ErrorAction SilentlyContinue }
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

Describe 'install and update logs are new files that nobody else can swap (ADR-015 Amendment 2 (d), review SQR-03)' {
    AfterEach { Close-AccucutLog }

    It 'gives every log a fresh, unpredictable name: prefix, time and 8 random hex characters' {
        $first = New-AccucutLogFileName -Prefix 'update'
        $second = New-AccucutLogFileName -Prefix 'update'
        $first | Should -Match '^update-\d{8}-\d{6}-[0-9a-f]{8}\.log$'
        $first | Should -Not -Be $second
        { New-AccucutLogFileName -Prefix '..\evil' } | Should -Throw
    }

    It 'creates the file with CreateNew, writes every line to the same open file, and keeps it open so that it cannot be deleted, renamed or replaced meanwhile' {
        $logFile = Join-Path $TestDrive "logs\$(New-AccucutLogFileName -Prefix 'open')"
        Write-AccucutLog -Message 'first line' -LogFile $logFile 6>$null
        Write-AccucutLog -Message 'second line' -LogFile $logFile -Level Warning 6>$null
        { [System.IO.File]::Delete($logFile) } | Should -Throw
        { [System.IO.File]::Move($logFile, "$logFile.moved") } | Should -Throw
        { [System.IO.File]::WriteAllText($logFile, 'replaced') } | Should -Throw
        Close-AccucutLog
        $lines = @(Get-Content -LiteralPath $logFile)
        $lines.Count | Should -Be 2
        $lines[0] | Should -BeLike '* INFO    first line'
        $lines[1] | Should -BeLike '* WARNING second line'
    }

    It 'refuses a log file that already exists (pre-created or left over), and never appends to it' {
        $logFile = Join-Path $TestDrive "logs\$(New-AccucutLogFileName -Prefix 'exists')"
        New-Item -ItemType Directory -Path (Split-Path -Parent $logFile) -Force | Out-Null
        [System.IO.File]::WriteAllText($logFile, 'planted by someone else')
        { Write-AccucutLog -Message 'x' -LogFile $logFile 6>$null } | Should -Throw '*already exists*never appended to*'
        (Get-Content -LiteralPath $logFile -Raw) | Should -Be 'planted by someone else'
    }

    It 'a log file can be moved and deleted once it is closed, and a closed name is refused when written again' {
        $logFile = Join-Path $TestDrive "logs\$(New-AccucutLogFileName -Prefix 'closed')"
        Write-AccucutLog -Message 'line' -LogFile $logFile 6>$null
        Close-AccucutLog -LogFile $logFile
        { Write-AccucutLog -Message 'again' -LogFile $logFile 6>$null } | Should -Throw '*already exists*'
        [System.IO.File]::Delete($logFile)
        Test-Path -LiteralPath $logFile | Should -BeFalse
    }

    It 'does not use Add-Content or Out-File for a log (static check on the module)' {
        $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Raw
        $text | Should -Not -Match 'Add-Content|Out-File'
    }
}

Describe 'the access of the service accounts, on a real folder (ADR-015 Amendment 2.1: exact entries, no LOCAL SERVICE, no task)' {
    # Needs an elevated process: the test locks a folder to Administrators and SYSTEM, as the install does. CI stage 13 runs elevated; a plain user skips it.
    It 'gives the two service accounts read and execute on the root and Modify on logs, exactly, and no other account anything' -Skip:(-not $script:IsAdmin) {
        $root = Join-Path $TestDrive ('acl-root-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        $paths = Get-AccucutPaths -Root $root
        $adminSid = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)
        $systemSid = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
        $security = [System.Security.AccessControl.DirectorySecurity]::new()
        $security.SetAccessRuleProtection($true, $false)
        $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
        foreach ($sid in @($adminSid, $systemSid)) {
            $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, [System.Security.AccessControl.FileSystemRights]::FullControl, $inherit, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow))
        }
        [void][System.IO.Directory]::CreateDirectory($root, $security)
        foreach ($folder in $paths.Releases, $paths.Config, $paths.Services, $paths.Logs) { [void][System.IO.Directory]::CreateDirectory($folder) }
        $appSid = Get-AccucutServiceSid -Name 'AccucutApp'
        $workerSid = Get-AccucutServiceSid -Name 'AccucutWorker'

        Grant-AccucutInstallFolderAccess -Paths $paths -ServiceSid @($appSid, $workerSid)

        $list = {
            param([string]$Path)
            $rules = ([System.IO.Directory]::GetAccessControl($Path)).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
            return @($rules | ForEach-Object { '{0}|0x{1:X}|{2}|{3}|{4}' -f $_.IdentityReference.Value, [int]$_.FileSystemRights, $_.IsInherited, [int]$_.InheritanceFlags, $_.AccessControlType } | Sort-Object)
        }
        $admin = 'S-1-5-32-544'; $system = 'S-1-5-18'
        $rootExpected = @("$admin|0x1F01FF|False|3|Allow", "$system|0x1F01FF|False|3|Allow", "$appSid|0x1200A9|False|3|Allow", "$workerSid|0x1200A9|False|3|Allow") | Sort-Object
        (& $list $paths.Root) -join "`n" | Should -Be ($rootExpected -join "`n")
        $logsExpected = @(
            "$admin|0x1F01FF|True|3|Allow", "$system|0x1F01FF|True|3|Allow", "$appSid|0x1200A9|True|3|Allow", "$workerSid|0x1200A9|True|3|Allow",
            "$appSid|0x1301BF|False|3|Allow", "$workerSid|0x1301BF|False|3|Allow"
        ) | Sort-Object
        (& $list $paths.Logs) -join "`n" | Should -Be ($logsExpected -join "`n")
        # releases, config and services only inherit the root's four entries: read and execute for the services, nothing to write.
        foreach ($folder in $paths.Releases, $paths.Config, $paths.Services) {
            $inherited = @("$admin|0x1F01FF|True|3|Allow", "$system|0x1F01FF|True|3|Allow", "$appSid|0x1200A9|True|3|Allow", "$workerSid|0x1200A9|True|3|Allow") | Sort-Object
            (& $list $folder) -join "`n" | Should -Be ($inherited -join "`n")
        }
        # Nobody else appears anywhere: not LOCAL SERVICE, NETWORK SERVICE, Authenticated Users, Users or Everyone.
        foreach ($folder in $paths.Root, $paths.Releases, $paths.Config, $paths.Services, $paths.Logs) {
            $text = (& $list $folder) -join "`n"
            foreach ($banned in 'S-1-5-19', 'S-1-5-20', 'S-1-5-11', 'S-1-5-32-545', 'S-1-1-0') { $text | Should -Not -BeLike "*$banned|*" }
        }
    }

    It 'has no LOCAL SERVICE grant anywhere, no scheduled task in the install or the update, and in the module one task only: the weekly backup (the worker prunes the logs)' {
        foreach ($file in 'install.ps1', 'update.ps1', 'AccucutOps.psm1') {
            $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory $file) -Raw
            $text | Should -Not -Match 'S-1-5-19|LOCAL SERVICE|S-1-5-20|NETWORK SERVICE'
            if ($file -ne 'AccucutOps.psm1') { $text | Should -Not -Match 'Register-ScheduledTask|New-ScheduledTask' }
        }
        $module = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Raw
        ([regex]::Matches($module, 'Register-ScheduledTask')).Count | Should -Be 1
        Test-Path -LiteralPath (Join-Path $script:WindowsDirectory 'clean-logs.ps1') | Should -BeFalse
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
        Initialize-AccucutServiceFiles -Paths $script:ServicePaths -ReleaseDirectory $script:Release -NodeExe 'C:\Program Files\nodejs\node.exe' -Port 8080 -ListenAddress '127.0.0.1' | Should -Be 'AccucutApp'
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

# ADR-015 Amendment 2, required test 4: the module is loaded only after the trust block has checked it, so it may not check trust, create the root, hash or unpack
# a package, load or run code, look a program up through PATH, or do anything at import beyond defining functions and constants.
Describe 'module hygiene (ADR-015 Amendment 2, test 4)' {
    BeforeAll {
        $path = Join-Path $script:WindowsDirectory 'AccucutOps.psm1'
        $tokens = $null
        $errors = $null
        $script:ModuleAst = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
        $script:BlockNames = @(
            'ConvertTo-AccucutTrustMask', 'Get-AccucutTrustAttributes', 'Get-AccucutTrustSecurity', 'ConvertFrom-AccucutTrustDescriptor', 'Get-AccucutTrustComponent', 'Assert-AccucutTrustedAbove',
            'Assert-AccucutTrustedBelow', 'Assert-AccucutTrustedPath', 'Assert-AccucutTrustedRootShape', 'New-AccucutTrustedRoot', 'Get-AccucutTrustedSha256',
            'Remove-AccucutTrustedTree', 'Assert-AccucutTrustedNoLinks', 'Expand-AccucutTrustedPackage', 'Get-AccucutTrustedCurrent', 'Resolve-AccucutTrustedExecutable',
            'Import-AccucutTrustedModule', 'ConvertTo-AccucutTrustedArgument', 'Invoke-AccucutTrustedScript'
        )
    }

    It 'exports only names of the form Verb-Accucut<Noun>, none of the trust block, and no alias' {
        $exported = @((Get-Module -Name AccucutOps).ExportedFunctions.Keys)
        $exported.Count | Should -BeGreaterThan 20
        foreach ($name in $exported) {
            $name | Should -Match '^[A-Z][A-Za-z]+-Accucut[A-Za-z0-9]+$'
            $script:BlockNames | Should -Not -Contain $name
        }
        @((Get-Module -Name AccucutOps).ExportedAliases.Keys).Count | Should -Be 0
        @((Get-Module -Name AccucutOps).ExportedCmdlets.Keys).Count | Should -Be 0
    }

    It 'defines none of the functions of the trust block, and none of the old trust functions' {
        $defined = @($script:ModuleAst.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true) | ForEach-Object { $_.Name })
        foreach ($name in $script:BlockNames + @('Assert-AccucutPathTrusted', 'Get-AccucutPathSecurity', 'Assert-AccucutFreshRoot', 'Assert-AccucutLockedInstallRoot', 'Assert-AccucutInstallTrusted', 'Expand-AccucutZip', 'Assert-AccucutSha256', 'Set-AccucutDirectoryAcl')) {
            $defined | Should -Not -Contain $name
        }
    }

    It 'has only functions, constants, Set-StrictMode and Export-ModuleMember at its top level' {
        foreach ($statement in $script:ModuleAst.EndBlock.Statements) {
            $text = $statement.Extent.Text
            $ok = ($statement -is [System.Management.Automation.Language.FunctionDefinitionAst]) -or
                ($statement -is [System.Management.Automation.Language.AssignmentStatementAst] -and $text -match '^\$script:\w+\s*=') -or
                ($statement -is [System.Management.Automation.Language.PipelineAst] -and $text -match '^(Set-StrictMode|Export-ModuleMember)\b')
            $ok | Should -BeTrue -Because "the top level of the module may not run anything: $($text.Substring(0, [math]::Min(60, $text.Length)))"
        }
    }

    It 'has no load or run site: no Import-Module, using module, dot-sourcing, call operator, Start-Process, or powershell.exe; and no PATH lookup' {
        $commands = $script:ModuleAst.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true)
        foreach ($command in $commands) {
            $name = [string]$command.GetCommandName()
            $name | Should -Not -BeIn @('Import-Module', 'Start-Process', 'Invoke-Expression', 'Get-Command', 'Invoke-Item', 'Add-Type')
            [string]$command.InvocationOperator | Should -Be 'Unknown'
        }
        $script:ModuleAst.FindAll({ param($node) $node -is [System.Management.Automation.Language.UsingStatementAst] }, $true).Count | Should -Be 0
        (Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Raw) | Should -Not -Match '(?i)powershell\.exe'
    }
}

Describe 'the backup account and the weekly task (STORY-10.05, ADR-015 Amendment 3 point 2)' {
    BeforeAll {
        $script:FakeBackupSid = 'S-1-5-21-1111111111-2222222222-3333333333-1005'
        $script:FakePowerShell = Join-Path $TestDrive 'fake-powershell.exe'
        [System.IO.File]::WriteAllBytes($script:FakePowerShell, [byte[]](1, 2, 3))
        function ConvertFrom-FakeSecureString {
            param([System.Security.SecureString]$Secure)
            $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
            try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        }
    }

    BeforeEach {
        $script:UserCall = $null
        $script:ActionCall = $null
        $script:TriggerCall = $null
        $script:RegisterCall = $null
        $script:Order = [System.Collections.Generic.List[string]]::new()
        $script:Logged = [System.Collections.Generic.List[string]]::new()
        Mock New-LocalUser -ModuleName AccucutOps {
            $script:Order.Add('user')
            $script:UserCall = @{ Name = $Name; Password = $Password; PasswordNeverExpires = $PasswordNeverExpires.IsPresent; UserMayNotChangePassword = $UserMayNotChangePassword.IsPresent; AccountNeverExpires = $AccountNeverExpires.IsPresent; Description = $Description }
            return [pscustomobject]@{ SID = [pscustomobject]@{ Value = $script:FakeBackupSid } }
        }
        Mock New-ScheduledTaskAction -ModuleName AccucutOps { $script:ActionCall = @{ Execute = $Execute; Argument = $Argument }; return 'action' }
        Mock New-ScheduledTaskTrigger -ModuleName AccucutOps { $script:TriggerCall = @{ Weekly = $Weekly.IsPresent; DaysOfWeek = [string]$DaysOfWeek; At = $At }; return 'trigger' }
        Mock New-ScheduledTaskSettingsSet -ModuleName AccucutOps { return 'settings' }
        Mock Register-ScheduledTask -ModuleName AccucutOps { $script:Order.Add('task'); $script:RegisterCall = @{ TaskName = $TaskName; User = $User; Password = $Password; RunLevel = [string]$RunLevel } }
        Mock Remove-LocalUser -ModuleName AccucutOps { }
        Mock Unregister-ScheduledTask -ModuleName AccucutOps { }
        # The real policy of this machine is never touched by these tests: the grant, the revoke and the account look-up are mocks.
        Mock Grant-AccucutBatchLogonRight -ModuleName AccucutOps { $script:Order.Add("grant:$Sid") }
        Mock Revoke-AccucutBatchLogonRight -ModuleName AccucutOps { $script:Order.Add("revoke:$Sid") }
        Mock Get-AccucutBackupAccountSid -ModuleName AccucutOps { $script:FakeBackupSid }
        Mock Invoke-AccucutNative -ModuleName AccucutOps { throw 'a password must never reach a native program' }
        Mock Write-AccucutLog -ModuleName AccucutOps { $script:Logged.Add($Message) }
    }

    It 'makes a 32-character password with upper case, lower case, a digit and a symbol, and gives it to New-LocalUser as a SecureString and to Register-ScheduledTask in process, and to nothing else' {
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        $sid = Register-AccucutBackupTask -Paths $paths -PowerShellPath $script:FakePowerShell
        $sid | Should -Be $script:FakeBackupSid
        $script:UserCall.Password | Should -BeOfType [System.Security.SecureString]
        $plain = ConvertFrom-FakeSecureString -Secure $script:UserCall.Password
        $plain.Length | Should -Be 32
        $plain | Should -MatchExactly '[A-Z]'
        $plain | Should -MatchExactly '[a-z]'
        $plain | Should -Match '\d'
        $plain | Should -Match '[^A-Za-z0-9]'
        $script:RegisterCall.Password | Should -BeExactly $plain
        # It is registered for redaction, so it can never reach a log, and it was passed to no native program.
        (Hide-AccucutSecrets -Text "x $plain y") | Should -Be 'x *** y'
        Should -Invoke Invoke-AccucutNative -ModuleName AccucutOps -Times 0 -Exactly
        ($script:Logged -join "`n") | Should -Not -BeLike "*$plain*"
    }

    It 'makes a local user that is for the task only: no password expiry, no password change, no account expiry, and no group is touched' {
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        [void](Register-AccucutBackupTask -Paths $paths -PowerShellPath $script:FakePowerShell)
        $script:UserCall.Name | Should -Be 'AccucutBackup'
        $script:UserCall.PasswordNeverExpires | Should -BeTrue
        $script:UserCall.UserMayNotChangePassword | Should -BeTrue
        $script:UserCall.AccountNeverExpires | Should -BeTrue
        $script:UserCall.Description | Should -Be 'Accucut weekly backup (no interactive use)'
        (Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Raw) | Should -Not -Match 'Add-LocalGroupMember'
    }

    It 'registers one weekly task for Sunday at 02:00, as AccucutBackup with a stored password and the limited run level, running backup.ps1 through current with exactly these arguments' {
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        [void](Register-AccucutBackupTask -Paths $paths -PowerShellPath $script:FakePowerShell)
        $script:TriggerCall.Weekly | Should -BeTrue
        $script:TriggerCall.DaysOfWeek | Should -Be 'Sunday'
        ([datetime]@($script:TriggerCall.At)[0]).ToString('HH:mm') | Should -Be '02:00'
        $script:ActionCall.Execute | Should -Be $script:FakePowerShell
        $script:ActionCall.Argument | Should -BeExactly '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\Accucut\current\backup.ps1" -Reason weekly'
        $script:RegisterCall.TaskName | Should -Be 'Accucut weekly backup'
        $script:RegisterCall.User | Should -Be "$($env:COMPUTERNAME)\AccucutBackup"
        $script:RegisterCall.RunLevel | Should -Be 'Limited'
        Should -Invoke Register-ScheduledTask -ModuleName AccucutOps -Times 1 -Exactly
    }

    It 'takes the program of the action from the caller, which has checked it, and refuses one that is not the full path of an existing file' {
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        foreach ($bad in 'powershell.exe', '\\server\share\powershell.exe', (Join-Path $TestDrive 'does-not-exist.exe')) {
            { Register-AccucutBackupTask -Paths $paths -PowerShellPath $bad } | Should -Throw '*is not the full path of a program that exists*'
        }
        Should -Invoke New-LocalUser -ModuleName AccucutOps -Times 0 -Exactly
    }

    It 'removes the account that it made, and the task, when the task cannot be registered, and re-throws without the password' {
        Mock Register-ScheduledTask -ModuleName AccucutOps { throw 'the task could not be registered' }
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        { Register-AccucutBackupTask -Paths $paths -PowerShellPath $script:FakePowerShell } | Should -Throw '*the task could not be registered*'
        Should -Invoke Remove-LocalUser -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter { $Name -eq 'AccucutBackup' }
        Should -Invoke Unregister-ScheduledTask -ModuleName AccucutOps -Times 1 -Exactly
    }

    It 'never removes an account that it did not make (New-LocalUser itself failed)' {
        Mock New-LocalUser -ModuleName AccucutOps { throw 'The user account already exists.' }
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        { Register-AccucutBackupTask -Paths $paths -PowerShellPath $script:FakePowerShell } | Should -Throw '*already exists*'
        Should -Invoke Remove-LocalUser -ModuleName AccucutOps -Times 0 -Exactly
        Should -Invoke Register-ScheduledTask -ModuleName AccucutOps -Times 0 -Exactly
    }

    It 'makes a different password every time' {
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        [void](Register-AccucutBackupTask -Paths $paths -PowerShellPath $script:FakePowerShell)
        $first = $script:RegisterCall.Password
        [void](Register-AccucutBackupTask -Paths $paths -PowerShellPath $script:FakePowerShell)
        $script:RegisterCall.Password | Should -Not -Be $first
    }

    It 'knows the logon failure of a task without the batch-logon right (0x80070569), and no other result' {
        Test-AccucutLogonTypeFailure -TaskResult ([uint32]2147943785) | Should -BeTrue
        Test-AccucutLogonTypeFailure -TaskResult ([uint32]267011) | Should -BeTrue -Because 'a task that never started is how the same refusal showed on the runner'
        Test-AccucutLogonTypeFailure -TaskResult ([uint32]0) | Should -BeFalse
        Test-AccucutLogonTypeFailure -TaskResult ([uint32]1) | Should -BeFalse
        Test-AccucutLogonTypeFailure -TaskResult ([uint32]267009) | Should -BeFalse
    }

    It 'removes the task and the account when asked, and is quiet when they are not there' {
        Mock Unregister-ScheduledTask -ModuleName AccucutOps { throw 'no such task' }
        Mock Remove-LocalUser -ModuleName AccucutOps { throw 'no such user' }
        Mock Get-AccucutBackupAccountSid -ModuleName AccucutOps { throw 'no such account' }
        { Remove-AccucutBackupAccount } | Should -Not -Throw
        Should -Invoke Revoke-AccucutBatchLogonRight -ModuleName AccucutOps -Times 0 -Exactly
    }

    It 'gives the right to the new SID after the user is made and before the task is registered, and the account never has a task without it (Amendment 3.2)' {
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        [void](Register-AccucutBackupTask -Paths $paths -PowerShellPath $script:FakePowerShell)
        ($script:Order -join '|') | Should -Be "user|grant:$($script:FakeBackupSid)|task"
        Should -Invoke Grant-AccucutBatchLogonRight -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter { $Sid -eq $script:FakeBackupSid }
    }

    It 'a failed grant removes the user that was made, registers no task, and takes the right away before the user is deleted' {
        Mock Grant-AccucutBatchLogonRight -ModuleName AccucutOps { $script:Order.Add('grant-failed'); throw 'Log on as a batch job did not take the expected holders' }
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        { Register-AccucutBackupTask -Paths $paths -PowerShellPath $script:FakePowerShell } | Should -Throw '*did not take the expected holders*'
        Should -Invoke Register-ScheduledTask -ModuleName AccucutOps -Times 0 -Exactly
        Should -Invoke Remove-LocalUser -ModuleName AccucutOps -Times 1 -Exactly
        $script:Order[$script:Order.Count - 1] | Should -Be "revoke:$($script:FakeBackupSid)"
    }

    It 'removal: the task goes first, then the right, then the user (never the user before the right: that would leave a bare SID in the policy)' {
        $script:Order.Clear()
        Mock Unregister-ScheduledTask -ModuleName AccucutOps { $script:Order.Add('unregister') }
        Mock Remove-LocalUser -ModuleName AccucutOps { $script:Order.Add('remove-user') }
        Remove-AccucutBackupAccount
        ($script:Order -join '|') | Should -Be "unregister|revoke:$($script:FakeBackupSid)|remove-user"
    }

    It 'removal: a revoke that fails is logged as an error with the bare SID to remove by hand, and the user is still removed' {
        $script:Order.Clear()
        Mock Revoke-AccucutBatchLogonRight -ModuleName AccucutOps { throw 'the policy is locked' }
        Mock Remove-LocalUser -ModuleName AccucutOps { $script:Order.Add('remove-user') }
        Remove-AccucutBackupAccount
        $script:Order | Should -Contain 'remove-user'
        ($script:Logged | Where-Object { $_ -like "*could not be taken away*$($script:FakeBackupSid)*Local Security Policy*" }).Count | Should -Be 1
    }
}

Describe 'the weekly task is waited for, and its result read (the first backup of the install)' {
    It 'starts the task, waits until it has run and is not running, and returns the last result as an unsigned number' {
        $script:Calls = 0
        Mock Start-ScheduledTask -ModuleName AccucutOps { }
        Mock Start-Sleep -ModuleName AccucutOps { }
        Mock Get-ScheduledTaskInfo -ModuleName AccucutOps { [pscustomobject]@{ LastRunTime = (Get-Date).AddMinutes(1); LastTaskResult = [uint32]2147943785 } }
        Mock Get-ScheduledTask -ModuleName AccucutOps {
            $script:Calls++
            if ($script:Calls -lt 3) { return [pscustomobject]@{ State = 'Running' } }
            return [pscustomobject]@{ State = 'Ready' }
        }
        $result = Wait-AccucutBackupTask -TimeoutSeconds 30 -IntervalSeconds 1
        $result | Should -BeOfType [uint32]
        $result | Should -Be 2147943785
        $script:Calls | Should -Be 3
        Should -Invoke Start-ScheduledTask -ModuleName AccucutOps -Times 1 -Exactly -ParameterFilter { $TaskName -eq 'Accucut weekly backup' }
    }

    It 'returns 0x41303 (the task never started) when it is still Ready with an unchanged LastRunTime after the not-started time (ADR-015 Amendment 3.2)' {
        Mock Start-ScheduledTask -ModuleName AccucutOps { }
        Mock Start-Sleep -ModuleName AccucutOps { }
        Mock Get-ScheduledTaskInfo -ModuleName AccucutOps { [pscustomobject]@{ LastRunTime = [datetime]'1999-11-30'; LastTaskResult = [uint32]267011 } }
        Mock Get-ScheduledTask -ModuleName AccucutOps { [pscustomobject]@{ State = 'Ready' } }
        $result = Wait-AccucutBackupTask -TimeoutSeconds 60 -IntervalSeconds 1 -NotStartedAfterSeconds 5
        $result | Should -Be 267011
        Test-AccucutLogonTypeFailure -TaskResult $result | Should -BeTrue
    }

    It 'gives up with a plain message when the task has not finished in time' {
        Mock Start-ScheduledTask -ModuleName AccucutOps { }
        Mock Start-Sleep -ModuleName AccucutOps { }
        Mock Get-ScheduledTaskInfo -ModuleName AccucutOps { [pscustomobject]@{ LastRunTime = (Get-Date).AddYears(-1); LastTaskResult = [uint32]0 } }
        Mock Get-ScheduledTask -ModuleName AccucutOps { [pscustomobject]@{ State = 'Ready' } }
        { Wait-AccucutBackupTask -TimeoutSeconds 5 -IntervalSeconds 1 } | Should -Throw '*did not finish within 5 seconds*'
    }
}

Describe 'the backups folder and the two files of the backup account: exact entries, made in one call (STORY-10.05, Amendment 3 points 3, 4 and 5)' {
    BeforeAll {
        $script:FakeBackupSid = 'S-1-5-21-1111111111-2222222222-3333333333-1005'
        $script:ListAces = {
            param([string]$Path, [bool]$IsFolder)
            if ($IsFolder) { $security = [System.IO.Directory]::GetAccessControl($Path) } else { $security = [System.IO.File]::GetAccessControl($Path) }
            $rules = $security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
            return [pscustomobject]@{
                Protected = $security.AreAccessRulesProtected
                Owner     = $security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
                Aces      = @($rules | ForEach-Object { '{0}|0x{1:X}|{2}|{3}|{4}' -f $_.IdentityReference.Value, [int]$_.FileSystemRights, $_.IsInherited, [int]$_.InheritanceFlags, $_.AccessControlType } | Sort-Object)
            }
        }
    }

    It 'makes the backups folder protected, owned by Administrators, with exactly Administrators and SYSTEM full control and the backup account Modify, none inherited, none for anyone else' -Skip:(-not $script:IsAdmin) {
        $folder = Join-Path $TestDrive ('backups-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-AccucutBackupFolder -Path $folder -BackupSid $script:FakeBackupSid
        $actual = & $script:ListAces $folder $true
        $actual.Protected | Should -BeTrue
        $actual.Owner | Should -Be 'S-1-5-32-544'
        $expected = @('S-1-5-32-544|0x1F01FF|False|3|Allow', 'S-1-5-18|0x1F01FF|False|3|Allow', "$($script:FakeBackupSid)|0x1301BF|False|3|Allow") | Sort-Object
        ($actual.Aces -join "`n") | Should -Be ($expected -join "`n")
    }

    It 'never uses an existing folder or file of that name' {
        $folder = Join-Path $TestDrive 'backups-exists'
        New-Item -ItemType Directory -Path $folder | Out-Null
        { New-AccucutBackupFolder -Path $folder -BackupSid $script:FakeBackupSid } | Should -Throw '*already exists*'
        $file = Join-Path $TestDrive 'backups-file'
        [System.IO.File]::WriteAllText($file, 'x')
        { New-AccucutBackupFolder -Path $file -BackupSid $script:FakeBackupSid } | Should -Throw '*already exists*'
    }

    It 'writes backup.pgpass and backup-settings.json, each protected with exactly Administrators and SYSTEM full control and the backup account read, and the password only in the first' -Skip:(-not $script:IsAdmin) {
        $root = Join-Path $TestDrive ('cfg-root-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        $paths = Get-AccucutPaths -Root $root
        New-Item -ItemType Directory -Path $paths.Config -Force | Out-Null
        $recipient = 'age1' + ('q' * 58)
        $password = 'FAKEbackupPassword0003'
        Write-AccucutBackupConfig -Paths $paths -BackupSid $script:FakeBackupSid -BackupPassword $password -AgeRecipient $recipient -PgHost '127.0.0.1' -PgPort 5432 -Database 'accucut' -PgBinDirectory 'C:\Program Files\PostgreSQL\17\bin'
        foreach ($file in $paths.BackupPgpass, $paths.BackupSettings) {
            $actual = & $script:ListAces $file $false
            $actual.Protected | Should -BeTrue
            $actual.Owner | Should -Be 'S-1-5-32-544'
            $expected = @('S-1-5-32-544|0x1F01FF|False|0|Allow', 'S-1-5-18|0x1F01FF|False|0|Allow', "$($script:FakeBackupSid)|0x120089|False|0|Allow") | Sort-Object
            ($actual.Aces -join "`n") | Should -Be ($expected -join "`n")
        }
        (Get-Content -LiteralPath $paths.BackupPgpass -Raw).Trim() | Should -Be "127.0.0.1:5432:accucut:accucut_backup:$password"
        $settingsText = Get-Content -LiteralPath $paths.BackupSettings -Raw
        $settingsText | Should -Not -BeLike "*$password*"
        $settings = Read-AccucutBackupSettings -Path $paths.BackupSettings
        $settings.AgeRecipient | Should -Be $recipient
        $settings.PgHost | Should -Be '127.0.0.1'
        $settings.PgPort | Should -Be 5432
        $settings.Database | Should -Be 'accucut'
        $settings.PgBinDirectory | Should -Be 'C:\Program Files\PostgreSQL\17\bin'
    }

    It 'escapes a colon and a backslash in the password of the pgpass line, as libpq reads it, and refuses to overwrite an existing file' {
        $root = Join-Path $TestDrive ('cfg-escape-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        $paths = Get-AccucutPaths -Root $root
        New-Item -ItemType Directory -Path $paths.Config -Force | Out-Null
        Mock Set-AccucutBackupFileAcl -ModuleName AccucutOps { }
        $recipient = 'age1' + ('q' * 58)
        Write-AccucutBackupConfig -Paths $paths -BackupSid $script:FakeBackupSid -BackupPassword 'ab:c\d' -AgeRecipient $recipient -PgHost 'localhost' -PgPort 5433 -Database 'accucut' -PgBinDirectory 'D:\pg\bin'
        (Get-Content -LiteralPath $paths.BackupPgpass -Raw).Trim() | Should -BeExactly 'localhost:5433:accucut:accucut_backup:ab\:c\\d'
        # The bytes, as libpq reads them: ASCII, one line ended by a single line feed, no byte order mark and no carriage return.
        $bytes = [System.IO.File]::ReadAllBytes($paths.BackupPgpass)
        $bytes[0] | Should -Be ([byte][char]'l')
        @($bytes | Where-Object { $_ -eq 13 }).Count | Should -Be 0
        @($bytes | Where-Object { $_ -eq 10 }).Count | Should -Be 1
        $bytes[$bytes.Length - 1] | Should -Be 10
        { Write-AccucutBackupConfig -Paths $paths -BackupSid $script:FakeBackupSid -BackupPassword 'x' -AgeRecipient $recipient -PgHost 'localhost' -PgPort 5433 -Database 'accucut' -PgBinDirectory 'D:\pg\bin' } | Should -Throw
    }

    It 'locks each file BEFORE the content is written (create, then the list, then the text)' {
        $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Raw
        $start = $text.IndexOf('function Write-AccucutBackupFile {')
        $body = $text.Substring($start, $text.IndexOf('function ', $start + 10) - $start)
        $body.IndexOf('FileMode]::CreateNew') | Should -BeGreaterThan 0
        $body.IndexOf('Set-AccucutBackupFileAcl') | Should -BeGreaterThan $body.IndexOf('FileMode]::CreateNew')
        $body.IndexOf('WriteAllText') | Should -BeGreaterThan $body.IndexOf('Set-AccucutBackupFileAcl')
    }

    It 'refuses a settings value that could not be a public key, a host, a port, a database name or a folder, before anything is written' {
        $root = Join-Path $TestDrive 'cfg-refuse'
        $paths = Get-AccucutPaths -Root $root
        $good = @{ BackupPassword = 'FAKEbackupPassword0003'; AgeRecipient = ('age1' + ('q' * 58)); PgHost = '127.0.0.1'; PgPort = 5432; Database = 'accucut'; PgBinDirectory = 'C:\pg\bin' }
        foreach ($bad in @(
                @{ AgeRecipient = ('AGE-SECRET-' + 'KEY-1' + ('Q' * 58)) }, @{ AgeRecipient = 'age1short' }, @{ PgHost = '127.0.0.1 & calc' }, @{ PgHost = '-h' }, @{ Database = 'acc"ucut' },
                @{ Database = 'Accucut' }, @{ PgBinDirectory = 'C:\x" & calc & "' }, @{ PgBinDirectory = 'bin' }, @{ PgBinDirectory = 'C:\a\..\b' }, @{ PgBinDirectory = '\\server\share' }
            )) {
            $arguments = $good.Clone()
            foreach ($key in $bad.Keys) { $arguments[$key] = $bad[$key] }
            { Write-AccucutBackupConfig -Paths $paths -BackupSid $script:FakeBackupSid @arguments } | Should -Throw '*is not allowed in the backup settings*'
        }
        Test-Path -LiteralPath $paths.Config | Should -BeFalse
    }

    It 'reads the settings back only when every field is there, none is extra, and every value is allowed' {
        $file = Join-Path $TestDrive 'settings-ok.json'
        $ok = [ordered]@{ ageRecipient = ('age1' + ('q' * 58)); pgHost = 'db.example.test'; pgPort = 5432; database = 'accucut'; pgBinDirectory = 'C:\pg\bin' }
        [System.IO.File]::WriteAllText($file, ($ok | ConvertTo-Json))
        (Read-AccucutBackupSettings -Path $file).PgHost | Should -Be 'db.example.test'
        foreach ($case in @(
                @{ Remove = 'database' }, @{ Remove = 'ageRecipient' }, @{ Add = 'extra' }, @{ Change = 'pgPort'; Value = 70000 }, @{ Change = 'pgPort'; Value = '5432' }, @{ Change = 'pgHost'; Value = 'a b' }
            )) {
            $copy = [ordered]@{}
            foreach ($key in $ok.Keys) { $copy[$key] = $ok[$key] }
            if ($case.ContainsKey('Remove')) { $copy.Remove($case.Remove) }
            if ($case.ContainsKey('Add')) { $copy[$case.Add] = 'x' }
            if ($case.ContainsKey('Change')) { $copy[$case.Change] = $case.Value }
            $bad = Join-Path $TestDrive 'settings-bad.json'
            [System.IO.File]::WriteAllText($bad, ($copy | ConvertTo-Json))
            { Read-AccucutBackupSettings -Path $bad } | Should -Throw
        }
    }
}

Describe 'the job_runs row is written as accucut_backup, through psql, with nothing secret on the command line (AC-7, AC-9)' {
    BeforeEach {
        $script:Call = $null
        Mock Invoke-AccucutNative -ModuleName AccucutOps {
            $script:Call = @{ FilePath = $FilePath; ArgumentList = $ArgumentList; Environment = $Environment; StdIn = $StdIn }
            return [pscustomobject]@{ ExitCode = 0; Output = '' }
        }
    }

    It 'quotes the values in psql (variables), takes the SQL on standard input, and reads the password from PGPASSFILE in the environment of that one process' {
        $started = [datetime]::SpecifyKind([datetime]::new(2026, 11, 15, 2, 0, 0), [System.DateTimeKind]::Utc)
        Add-AccucutJobRun -PsqlPath 'C:\pg\psql.exe' -PassFile 'C:\Accucut\config\backup.pgpass' -DbHost '127.0.0.1' -Port 5432 -Database 'accucut' -Job 'backup' -StartedUtc $started -FinishedUtc $started.AddSeconds(30) `
            -Result @{ status = 'ok'; sizeBytes = [int64]123; freeBytes = [int64]456; totalBytes = [int64]789 }
        $script:Call.FilePath | Should -Be 'C:\pg\psql.exe'
        $script:Call.Environment['PGPASSFILE'] | Should -Be 'C:\Accucut\config\backup.pgpass'
        $script:Call.Environment.Keys | Should -Not -Contain 'PGPASSWORD'
        $arguments = $script:Call.ArgumentList -join ' '
        $arguments | Should -BeLike '*--username accucut_backup*'
        $arguments | Should -BeLike '*-v job=backup*'
        $arguments | Should -BeLike '*-v started=2026-11-15T02:00:00.0000000Z*'
        $arguments | Should -BeLike '*-v finished=2026-11-15T02:00:30.0000000Z*'
        $script:Call.ArgumentList | Should -Contain '--file'
        $result = ($script:Call.ArgumentList | Where-Object { $_ -like 'result=*' })
        ($result.Substring(7) | ConvertFrom-Json).status | Should -Be 'ok'
        ($result.Substring(7) | ConvertFrom-Json).totalBytes | Should -Be 789
        $script:Call.StdIn | Should -Be "INSERT INTO job_runs (job, started_at, finished_at, result) VALUES (:'job', :'started'::timestamptz, :'finished'::timestamptz, :'result'::jsonb);"
    }

    It 'never puts a value into the SQL text: a quote in the result cannot change the statement' {
        $now = [datetime]::UtcNow
        Add-AccucutJobRun -PsqlPath 'C:\pg\psql.exe' -PassFile 'C:\x\p' -DbHost 'localhost' -Port 5432 -Database 'accucut' -Job 'backup' -StartedUtc $now -FinishedUtc $now -Result @{ status = 'failed'; message = "it's a '); DROP TABLE job_runs; --" }
        $script:Call.StdIn | Should -Not -BeLike '*DROP*'
        $script:Call.StdIn | Should -Not -BeLike "*it's*"
    }

    It 'accepts only a job name of lower-case letters and dashes' {
        $now = [datetime]::UtcNow
        foreach ($bad in 'Backup', "backup'; --", 'a', '', 'backup_clear') {
            { Add-AccucutJobRun -PsqlPath 'C:\pg\psql.exe' -PassFile 'C:\x\p' -DbHost 'localhost' -Port 5432 -Database 'accucut' -Job $bad -StartedUtc $now -FinishedUtc $now -Result @{ status = 'ok' } } | Should -Throw
        }
    }
}

Describe 'volumes and sizes' {
    It 'gives the drive root of a path with a forward slash for .env, and nothing for a path that is not a full drive path' {
        Get-AccucutVolumeRoot -Path 'C:\Accucut\backups' | Should -Be 'C:/'
        Get-AccucutVolumeRoot -Path 'd:\pgdata\17' | Should -Be 'd:/'
        Get-AccucutVolumeRoot -Path $null | Should -BeNullOrEmpty
        Get-AccucutVolumeRoot -Path '' | Should -BeNullOrEmpty
        Get-AccucutVolumeRoot -Path 'relative\path' | Should -BeNullOrEmpty
        Get-AccucutVolumeRoot -Path '\\server\share\x' | Should -BeNullOrEmpty
    }

    It 'writes a size in words an Admin reads' {
        Format-AccucutSize -Bytes 0 | Should -Be '0 KB'
        Format-AccucutSize -Bytes 1500 | Should -Be '2 KB'
        Format-AccucutSize -Bytes (5MB + 300KB) | Should -Be '5.3 MB'
        Format-AccucutSize -Bytes (12GB + 345MB) | Should -Be '12.34 GB'
    }
}

Describe 'the event source of the backup scripts (ADR-015 Amendment 3.1 point 5)' {
    It 'registers the source Accucut in the Application log once, and does nothing when it is there' {
        $script:Created = [System.Collections.Generic.List[string]]::new()
        Mock Test-AccucutEventSource -ModuleName AccucutOps { $false }
        Mock New-AccucutEventSource -ModuleName AccucutOps { $script:Created.Add('made') }
        Register-AccucutEventSource | Should -BeTrue
        $script:Created.Count | Should -Be 1
        Mock Test-AccucutEventSource -ModuleName AccucutOps { $true }
        Register-AccucutEventSource | Should -BeFalse
        $script:Created.Count | Should -Be 1
    }

    It 'names the source Accucut and the Application log, and nothing else (static check)' {
        $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Raw
        $text | Should -Match "\`$script:EventSource = 'Accucut'"
        $text | Should -Match "CreateEventSource\(\`$script:EventSource, 'Application'\)"
    }
}

Describe 'the batch-logon right: given to one SID, checked, and taken away again (ADR-015 Amendment 3.2)' {
    BeforeAll {
        $script:NewSid = 'S-1-5-21-1111111111-2222222222-3333333333-1005'
        $script:Admins = 'S-1-5-32-544'
        $script:BackupOps = 'S-1-5-32-551'
    }

    BeforeEach {
        $script:Calls = [System.Collections.Generic.List[string]]::new()
        $script:Reads = 0
        $script:Holders = @(@($script:Admins, $script:BackupOps), @($script:Admins, $script:BackupOps, $script:NewSid))
        Mock Get-AccucutLsaHolder -ModuleName AccucutOps {
            $index = [math]::Min($script:Reads, $script:Holders.Count - 1)
            $script:Reads++
            return , @($script:Holders[$index])
        }
        Mock Add-AccucutLsaHolder -ModuleName AccucutOps { $script:Calls.Add("add:$Sid|$Right") }
        Mock Remove-AccucutLsaHolder -ModuleName AccucutOps { $script:Calls.Add("remove:$Sid|$Right") }
        Mock Write-AccucutLog -ModuleName AccucutOps { $script:Calls.Add("log:$Message") }
    }

    It 'calls LsaAddAccountRights once, for this SID and SeBatchLogonRight only, and logs that no other account or right was changed' {
        Grant-AccucutBatchLogonRight -Sid $script:NewSid
        @($script:Calls | Where-Object { $_ -like 'add:*' }) | Should -Be @("add:$($script:NewSid)|SeBatchLogonRight")
        Should -Invoke Add-AccucutLsaHolder -ModuleName AccucutOps -Times 1 -Exactly
        Should -Invoke Remove-AccucutLsaHolder -ModuleName AccucutOps -Times 0 -Exactly
        ($script:Calls | Where-Object { $_ -like 'log:*' }) | Should -Be @("log:Gave AccucutBackup ($($script:NewSid)) the right 'Log on as a batch job'; no other account or right was changed.")
    }

    It 'reads the holders before and after, and only those two reads' {
        Grant-AccucutBatchLogonRight -Sid $script:NewSid
        Should -Invoke Get-AccucutLsaHolder -ModuleName AccucutOps -Times 2 -Exactly -ParameterFilter { $Right -eq 'SeBatchLogonRight' }
    }

    It 'throws when the holders afterwards lack the SID' {
        $script:Holders = @(@($script:Admins, $script:BackupOps), @($script:Admins, $script:BackupOps))
        { Grant-AccucutBatchLogonRight -Sid $script:NewSid } | Should -Throw '*did not take the expected holders*'
    }

    It 'throws when the holders afterwards differ in any other way: another account gained the right, or one lost it' {
        $script:Holders = @(@($script:Admins, $script:BackupOps), @($script:Admins, $script:BackupOps, $script:NewSid, 'S-1-5-32-545'))
        { Grant-AccucutBatchLogonRight -Sid $script:NewSid } | Should -Throw '*did not take the expected holders*'
        $script:Reads = 0
        $script:Holders = @(@($script:Admins, $script:BackupOps), @($script:Admins, $script:NewSid))
        { Grant-AccucutBatchLogonRight -Sid $script:NewSid } | Should -Throw '*did not take the expected holders*'
    }

    It 'refuses, and changes nothing, when the SID already holds the right (a new account cannot, so it is not the account just made)' {
        $script:Holders = @(@($script:Admins, $script:NewSid))
        { Grant-AccucutBatchLogonRight -Sid $script:NewSid } | Should -Throw '*already holds*Nothing was changed*'
        Should -Invoke Add-AccucutLsaHolder -ModuleName AccucutOps -Times 0 -Exactly
    }

    It 'revoke: removes this SID and no other, and requires the holders afterwards to be the holders before minus the SID' {
        $script:Holders = @(@($script:Admins, $script:BackupOps, $script:NewSid), @($script:Admins, $script:BackupOps))
        Revoke-AccucutBatchLogonRight -Sid $script:NewSid
        @($script:Calls | Where-Object { $_ -like 'remove:*' }) | Should -Be @("remove:$($script:NewSid)|SeBatchLogonRight")
        $script:Reads = 0
        $script:Holders = @(@($script:Admins, $script:BackupOps, $script:NewSid), @($script:BackupOps))
        { Revoke-AccucutBatchLogonRight -Sid $script:NewSid } | Should -Throw '*did not leave the expected holders*'
    }

    It 'revoke: does nothing when the SID does not hold the right' {
        $script:Holders = @(@($script:Admins, $script:BackupOps))
        Revoke-AccucutBatchLogonRight -Sid $script:NewSid
        Should -Invoke Remove-AccucutLsaHolder -ModuleName AccucutOps -Times 0 -Exactly
    }

    It 'compares holders as sets of SIDs, in any order and any letter case' {
        Test-AccucutSameSidSet -Left @('S-1-5-32-544', 'S-1-5-32-551') -Right @('s-1-5-32-551', 'S-1-5-32-544') | Should -BeTrue
        Test-AccucutSameSidSet -Left @() -Right @() | Should -BeTrue
        Test-AccucutSameSidSet -Left @('S-1-5-32-544') -Right @('S-1-5-32-544', 'S-1-5-32-551') | Should -BeFalse
    }

    It 'only the two rights are ever read' {
        { Get-AccucutRightHolder -Right 'SeInteractiveLogonRight' } | Should -Throw
        { Get-AccucutRightHolder -Right 'SeDebugPrivilege' } | Should -Throw
    }
}

Describe 'the check before anything is changed: a deny entry, and a domain Group Policy (ADR-015 Amendment 3.2, mechanism step 7)' {
    BeforeEach {
        $script:Denied = @()
        $script:InDomain = $false
        $script:Rsop = @()
        $script:RsopThrows = $false
        $script:RsopCalls = 0
        $script:Warnings = [System.Collections.Generic.List[string]]::new()
        $script:RealComputerName = $env:COMPUTERNAME
        $env:COMPUTERNAME = 'SERVER01'
        Mock Get-AccucutRightHolder -ModuleName AccucutOps { if ($Right -eq 'SeDenyBatchLogonRight') { return , @($script:Denied) } return , @() }
        Mock Get-AccucutComputerSystem -ModuleName AccucutOps { [pscustomobject]@{ PartOfDomain = $script:InDomain } }
        Mock Get-AccucutRsopBatchRight -ModuleName AccucutOps { $script:RsopCalls++; if ($script:RsopThrows) { throw 'Invalid namespace' } return , @($script:Rsop) }
        Mock Get-AccucutRsopPolicyName -ModuleName AccucutOps { 'Servers baseline' }
        Mock Write-AccucutLog -ModuleName AccucutOps { if ($Level -eq 'Warning') { $script:Warnings.Add($Message) } }
    }

    AfterEach { $env:COMPUTERNAME = $script:RealComputerName }

    It 'passes on a server that is not in a domain, and never asks for a Group Policy result' {
        { Test-AccucutBatchRightPolicy } | Should -Not -Throw
        $script:RsopCalls | Should -Be 0
    }

    It 'stops when "Deny log on as a batch job" holds a group that every new local account belongs to (<Sid>)' -ForEach @(
        @{ Sid = 'S-1-1-0' }, @{ Sid = 'S-1-5-11' }, @{ Sid = 'S-1-5-113' }, @{ Sid = 'S-1-5-32-545' }
    ) {
        $script:Denied = @('S-1-5-32-546', $Sid)
        { Test-AccucutBatchRightPolicy } | Should -Throw "*'Deny log on as a batch job' lists $Sid*Nothing was changed*"
    }

    It 'a deny entry for an account that is not in a new user''s token does not matter' {
        $script:Denied = @('S-1-5-32-546', 'S-1-5-21-1-2-3-500')
        { Test-AccucutBatchRightPolicy } | Should -Not -Throw
    }

    It 'in a domain, with no policy that sets the right, passes' {
        $script:InDomain = $true
        $script:Rsop = @()
        { Test-AccucutBatchRightPolicy } | Should -Not -Throw
        $script:RsopCalls | Should -Be 1
    }

    It 'in a domain, with a policy that lists the account (by name or with the server name), passes' {
        $script:InDomain = $true
        foreach ($entry in 'AccucutBackup', 'SERVER01\AccucutBackup', 'server01\ACCUCUTBACKUP') {
            $script:Rsop = @([pscustomobject]@{ GPOID = '{AAA}'; AccountList = @('BUILTIN\Administrators', $entry) })
            { Test-AccucutBatchRightPolicy } | Should -Not -Throw
        }
    }

    It 'in a domain, with a policy that does not list the account, stops BEFORE the user is made, names the policy and the account to add, and says nothing was changed' {
        $script:InDomain = $true
        $script:Rsop = @([pscustomobject]@{ GPOID = '{AAA}'; AccountList = @('BUILTIN\Administrators', 'NT SERVICE\ALL SERVICES') })
        { Test-AccucutBatchRightPolicy } | Should -Throw "*the Group Policy 'Servers baseline' sets 'Log on as a batch job'*add SERVER01\AccucutBackup to that setting*keeping the accounts already there*gpupdate /target:computer /force*Nothing was changed*"
    }

    It 'in a domain, an unreadable policy result stops the install, and says how to go on' {
        $script:InDomain = $true
        $script:RsopThrows = $true
        { Test-AccucutBatchRightPolicy } | Should -Throw '*cannot be read (Invalid namespace)*-BatchRightPolicyConfirmed*Nothing was changed*'
    }

    It '-PolicyConfirmed skips only the policy read, logs a warning, and never the deny check' {
        $script:InDomain = $true
        $script:RsopThrows = $true
        { Test-AccucutBatchRightPolicy -PolicyConfirmed } | Should -Not -Throw
        $script:RsopCalls | Should -Be 0
        $script:Warnings.Count | Should -Be 1
        $script:Warnings[0] | Should -BeLike '*-BatchRightPolicyConfirmed was given*NOT read*'
        $script:Denied = @('S-1-5-32-545')
        { Test-AccucutBatchRightPolicy -PolicyConfirmed } | Should -Throw "*'Deny log on as a batch job'*"
    }
}

Describe 'the LSA calls are made in memory, from advapi32 only, and never with more than was asked (ADR-015 Amendment 3.2, test 4)' {
    BeforeAll {
        $script:ModulePath = Join-Path $script:WindowsDirectory 'AccucutOps.psm1'
        $script:ModuleAst2 = [System.Management.Automation.Language.Parser]::ParseFile($script:ModulePath, [ref]$null, [ref]$null)
        $script:ModuleText2 = [System.IO.File]::ReadAllText($script:ModulePath)
        function Get-ModuleFunction {
            param([string]$Name)
            return $script:ModuleAst2.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $Name }, $true)
        }
    }

    It 'DefineDynamicAssembly and DefinePInvokeMethod appear in Get-AccucutLsaNative only' {
        foreach ($name in 'DefineDynamicAssembly', 'DefinePInvokeMethod') {
            $calls = @($script:ModuleAst2.FindAll({ param($n) $n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and [string]$n.Member.Value -eq $name }, $true))
            $calls.Count | Should -Be 1
            $function = Get-ModuleFunction -Name 'Get-AccucutLsaNative'
            $calls[0].Extent.StartOffset | Should -BeGreaterThan $function.Extent.StartOffset
            $calls[0].Extent.EndOffset | Should -BeLessThan $function.Extent.EndOffset
        }
    }

    It 'the only DLL named anywhere in the module is advapi32.dll, and no file is written or compiled' {
        @([regex]::Matches($script:ModuleText2, "(?i)[A-Za-z0-9_-]+\.dll") | ForEach-Object { $_.Value.ToLowerInvariant() } | Sort-Object -Unique) | Should -Be @('advapi32.dll')
        $script:ModuleText2 | Should -Not -Match 'Add-Type|OutputAssembly|csc\.exe|CodeDom|Assembly\]::Load'
    }

    It 'defines exactly the seven methods' {
        $function = Get-ModuleFunction -Name 'Get-AccucutLsaNative'
        $names = @([regex]::Matches($function.Extent.Text, "Name = '(Lsa\w+)'") | ForEach-Object { $_.Groups[1].Value })
        $names | Should -Be @('LsaOpenPolicy', 'LsaAddAccountRights', 'LsaRemoveAccountRights', 'LsaEnumerateAccountsWithUserRight', 'LsaFreeMemory', 'LsaClose', 'LsaNtStatusToWinError')
    }

    It 'Grant-AccucutBatchLogonRight has no -Right parameter and names only SeBatchLogonRight; the module can grant this one right and no other' {
        $function = Get-ModuleFunction -Name 'Grant-AccucutBatchLogonRight'
        @($function.Body.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath }) | Should -Be @('Sid', 'LogFile')
        $function.Extent.Text | Should -Match "\`$right = 'SeBatchLogonRight'"
        $calls = @($script:ModuleAst2.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] -and [string]$n.GetCommandName() -eq 'Add-AccucutLsaHolder' }, $true))
        $calls.Count | Should -Be 1
    }

    It 'LsaRemoveAccountRights is called in one place, with allRights 0 (never every right of the account)' {
        $text = (Get-ModuleFunction -Name 'Remove-AccucutLsaHolder').Extent.Text
        $text | Should -Match 'LsaRemoveAccountRights\(\$handle, \(Get-AccucutSidBytes -Sid \$Sid\), \[byte\]0, '
        ([regex]::Matches($script:ModuleText2, 'LsaRemoveAccountRights\(')).Count | Should -Be 1
    }

    It 'the module runs no program for the grant: no secedit, no ntrights, no cmd, no gpupdate' {
        $script:ModuleText2 | Should -Not -Match '(?i)secedit|\bntrights\b|gpupdate\.exe|Start-Process'
    }

    It 'nothing is made when the module is loaded: the type is a null constant until Get-AccucutLsaNative is called' {
        $script:ModuleText2 | Should -Match '\$script:AccucutLsaNative = \$null'
        $topLevel = @($script:ModuleAst2.EndBlock.Statements | Where-Object { $_ -isnot [System.Management.Automation.Language.FunctionDefinitionAst] -and $_.Extent.Text -match 'DefineDynamicAssembly|LsaOpenPolicy' })
        $topLevel.Count | Should -Be 0
    }

    It 'reads the real holders of Log on as a batch job and finds Administrators (read-only; needs an elevated process)' -Skip:(-not $script:IsAdmin) {
        $holders = @(Get-AccucutRightHolder -Right 'SeBatchLogonRight')
        $holders | Should -Contain 'S-1-5-32-544'
        $holders | ForEach-Object { $_ | Should -Match '^S-1-\d+(-\d+)+$' }
        $deny = @(Get-AccucutRightHolder -Right 'SeDenyBatchLogonRight')
        $deny.Count | Should -BeGreaterOrEqual 0
    }
}
