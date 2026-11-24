#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of restore.ps1 and of the restore functions of the module (STORY-10.11 AC-1 to AC-6 and AC-9; ADR-015 Amendments 2, 2.1, 3 and 3.1; architecture section 9.5).
  Run by CI stage 13 on windows-latest. Every prompt is answered by a mock. The age part is REAL: the tests make a throwaway key pair with age-keygen, encrypt a small
  invented "dump" with the real age, and restore it through the real pipe, so the key really travels on standard input and the bytes really come out the other side.
  pg_restore is a tiny program that the test compiles (it keeps what it was given); the database and the services are mocks. The last group runs the whole restore on the
  real install of stage 13 (real services, real PostgreSQL, real pg_restore, real migrations), with only the two prompts answered by mocks. Every value is invented.
  Nothing here is ever a real key: the key of each test is made for that test and held in memory, and the file age-keygen wrote is deleted at once.
#>

BeforeDiscovery {
    $principal = New-Object System.Security.Principal.WindowsPrincipal([System.Security.Principal.WindowsIdentity]::GetCurrent())
    $script:IsAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
    # age (and age-keygen) come from the zip that stage 13 downloaded and checked (ACCUCUT_TOOLS). On a developer's PC there is none: those tests are skipped there, and only there.
    $script:ToolsZip = $null
    if ($env:ACCUCUT_TOOLS) {
        $toolsFile = (Import-PowerShellDataFile -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'tools.psd1')).Age.File
        $candidate = Join-Path $env:ACCUCUT_TOOLS $toolsFile
        if (Test-Path -LiteralPath $candidate) { $script:ToolsZip = $candidate }
    }
    $script:HaveAge = ($null -ne $script:ToolsZip)
    # In CI the tools must be there: a missing age is a failure of the job, never a silent skip.
    $script:CiExpectsAge = ($env:CI -eq 'true' -and $env:GITHUB_ACTIONS -eq 'true')
    $script:RealInstall = ((Test-Path -LiteralPath 'C:\Accucut\config\restore.pgpass') -and $env:ACCUCUT_AGE_KEY -and (Test-Path -LiteralPath $env:ACCUCUT_AGE_KEY) -and $script:IsAdmin)
}

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    # Dot-sourcing defines the functions (the trust block and the helpers) and does not run the script.
    . (Join-Path $script:WindowsDirectory 'restore.ps1')
    # The real Write-AccucutRestoreEvent, taken before a test mocks it: the restore tests route the mock through it, so that the text of each event is the real one (ADR-015 Amendment 3.4).
    $script:RealWriteRestoreEvent = Get-Command -Name Write-AccucutRestoreEvent -Module AccucutOps

    $script:BackupSid = 'S-1-5-21-1111111111-2222222222-3333333333-1005'
    $script:EndpointSid = 'S-1-5-21-1111111111-2222222222-3333333333-1010'

    # ---- age, for real ---------------------------------------------------------------------------------------------------------------
    $script:AgeExe = $null
    $script:AgeKeygenExe = $null
    $script:AgeFolder = $null
    if ($env:ACCUCUT_TOOLS) {
        $toolsFile = (Import-PowerShellDataFile -LiteralPath (Join-Path $script:WindowsDirectory 'tools.psd1')).Age.File
        $zip = Join-Path $env:ACCUCUT_TOOLS $toolsFile
        if (Test-Path -LiteralPath $zip) {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $folder = Join-Path ([System.IO.Path]::GetTempPath()) ('accucut-restore-tests-age-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
            [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $folder)
            $script:AgeExe = (Get-ChildItem -LiteralPath $folder -Recurse -Filter 'age.exe' | Select-Object -First 1).FullName
            $script:AgeKeygenExe = (Get-ChildItem -LiteralPath $folder -Recurse -Filter 'age-keygen.exe' | Select-Object -First 1).FullName
            $script:AgeFolder = $folder
        }
    }

    # A key pair for one test: returns the PUBLIC key and the SECRET key text. The file that age-keygen writes is deleted at once; the secret exists only in memory.
    function New-TestKeyPair {
        $file = Join-Path $TestDrive ('keygen-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.txt')
        $previous = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try { & $script:AgeKeygenExe -o $file 2>$null } finally { $ErrorActionPreference = $previous }
        if ($LASTEXITCODE -ne 0) { throw 'age-keygen failed.' }
        $lines = @(Get-Content -LiteralPath $file)
        Remove-Item -LiteralPath $file -Force
        $public = (($lines | Where-Object { $_ -like '# public key: *' } | Select-Object -First 1) -replace '^# public key: ', '').Trim()
        $secret = ($lines | Where-Object { $_ -like 'AGE-SECRET-*' } | Select-Object -First 1).Trim()
        return [pscustomobject]@{ Public = $public; Secret = $secret }
    }

    # A small invented dump: PGDMP and then bytes of every value, including 0x1A, CR LF and NUL (a text pipe would damage them).
    function New-TestDump {
        param([int]$Kilobytes = 300)
        $bytes = New-Object byte[] ($Kilobytes * 1024 + 5)
        [System.Array]::Copy([System.Text.Encoding]::ASCII.GetBytes('PGDMP'), $bytes, 5)
        for ($i = 5; $i -lt $bytes.Length; $i++) { $bytes[$i] = [byte](($i * 7 + 13) % 256) }
        return , $bytes
    }

    # One backup copy and its manifest in a backups folder, made the way backup.ps1 makes them (real age), named by the UTC time.
    function New-TestCopy {
        param([string]$Directory, [datetime]$CreatedUtc, [string]$Recipient, [byte[]]$Plain, [string]$Reason = 'weekly', [string]$PostgresVersion = '17.2', [switch]$NoManifest)
        $stamp = $CreatedUtc.ToString('yyyyMMdd-HHmmss', [System.Globalization.CultureInfo]::InvariantCulture)
        $name = "accucut-$stamp-$Reason.age"
        $plainFile = Join-Path $TestDrive ('plain-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
        [System.IO.File]::WriteAllBytes($plainFile, $Plain)
        & $script:AgeExe -r $Recipient -o (Join-Path $Directory $name) $plainFile
        if ($LASTEXITCODE -ne 0) { throw 'age could not encrypt the test dump.' }
        Remove-Item -LiteralPath $plainFile -Force
        $path = Join-Path $Directory $name
        if (-not $NoManifest) {
            $manifest = [ordered]@{
                file = $name; reason = $Reason; createdAtUtc = $CreatedUtc.ToString('o', [System.Globalization.CultureInfo]::InvariantCulture)
                sizeBytes = ([System.IO.FileInfo]::new($path)).Length; sha256 = (Get-AccucutFileSha256 -Path $path); postgresVersion = $PostgresVersion
                dumpFormat = 'pg_dump custom (-Fc)'; encryption = 'age'; release = 'test'
            }
            [System.IO.File]::WriteAllText((Join-Path $Directory "accucut-$stamp-$Reason.manifest.json"), (($manifest | ConvertTo-Json) + "`r`n"))
        }
        return $path
    }

    # Every file under -Root (and -Extra roots) that holds -Text, as bytes or as text: the test of "the key is on no disk" (AC-5, AC-9).
    function Find-TextInFiles {
        param([string]$Text, [string[]]$Root)
        $latin = [System.Text.Encoding]::GetEncoding(28591)
        $needles = @($latin.GetBytes($Text), [System.Text.Encoding]::Unicode.GetBytes($Text))
        $found = New-Object System.Collections.Generic.List[string]
        foreach ($folder in $Root) {
            if (-not (Test-Path -LiteralPath $folder)) { continue }
            foreach ($file in (Get-ChildItem -LiteralPath $folder -Recurse -Force -File -ErrorAction SilentlyContinue)) {
                if ($file.Length -gt 60MB) { continue }
                try { $content = [System.IO.File]::ReadAllBytes($file.FullName) } catch { continue }
                $haystack = $latin.GetString($content)
                foreach ($needle in $needles) {
                    if ($haystack.Contains($latin.GetString($needle))) { $found.Add($file.FullName); break }
                }
            }
        }
        return , @($found)
    }

    # pg_restore stand-in: keeps the bytes of its standard input in FAKE_RESTORE_OUT, notes its arguments and PostgreSQL environment in FAKE_RESTORE_LOG, exits with FAKE_RESTORE_EXIT.
    $fakeSource = @'
using System; using System.IO;
class P {
  static int Main(string[] args) {
    var o = Environment.GetEnvironmentVariable("FAKE_RESTORE_OUT");
    var log = Environment.GetEnvironmentVariable("FAKE_RESTORE_LOG");
    if (!string.IsNullOrEmpty(log)) File.WriteAllText(log, string.Join("|", args) + "\nPGPASSFILE=" + Environment.GetEnvironmentVariable("PGPASSFILE") + "\nPGPASSWORD=" + Environment.GetEnvironmentVariable("PGPASSWORD"));
    var input = Console.OpenStandardInput();
    using (var sink = string.IsNullOrEmpty(o) ? Stream.Null : (Stream)File.Create(o)) { input.CopyTo(sink); }
    var code = Environment.GetEnvironmentVariable("FAKE_RESTORE_EXIT");
    if (!string.IsNullOrEmpty(code)) { Console.Error.WriteLine("pg_restore: error: fake failure"); return int.Parse(code); }
    return 0;
  }
}
'@
    $csc = Join-Path ([System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
    $script:FakeFolder = Join-Path ([System.IO.Path]::GetTempPath()) ('accucut-restore-tests-fake-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Path $script:FakeFolder | Out-Null
    $source = Join-Path $script:FakeFolder 'pg_restore.cs'
    [System.IO.File]::WriteAllText($source, $fakeSource)
    & $csc /nologo "/out:$(Join-Path $script:FakeFolder 'pg_restore.exe')" $source | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'The fake pg_restore could not be compiled.' }
    $script:FakePgRestore = Join-Path $script:FakeFolder 'pg_restore.exe'
}

AfterAll {
    foreach ($folder in $script:FakeFolder, $script:AgeFolder) { if ($folder -and (Test-Path -LiteralPath $folder)) { Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue } }
}

Describe 'the tools of the restore tests are there (stage 13)' {
    It 'finds age and age-keygen from the zip that stage 13 downloaded and checked (a job without them fails; only a developer''s PC skips the rest)' -Skip:(-not $script:CiExpectsAge) {
        $script:AgeExe | Should -Not -BeNullOrEmpty
        $script:AgeKeygenExe | Should -Not -BeNullOrEmpty
        & $script:AgeExe --version | Should -Not -BeNullOrEmpty
    }
}

Describe 'restore.ps1 runs only from the installed release (ADR-015 Amendment 3, AC-1)' {
    It 'works out the root from ROOT\current\restore.ps1 and from ROOT\releases\TAG\restore.ps1 (<Path>)' -ForEach @(
        @{ Path = 'C:\Accucut\current\restore.ps1'; Root = 'C:\Accucut' }
        @{ Path = 'D:\Acc-ucut_1\releases\1.2.3-abcdef0\restore.ps1'; Root = 'D:\Acc-ucut_1' }
    ) {
        Get-AccucutScriptInstallRoot -ScriptPath $Path -Name 'restore.ps1' | Should -Be $Root
    }

    It 'refuses a script from anywhere else (<Path>)' -ForEach @(
        @{ Path = 'C:\Program Files\accucut-pkg\restore.ps1' }
        @{ Path = 'C:\Accucut\restore.ps1' }
        @{ Path = 'C:\Accucut\current\clear-copies.ps1' }
        @{ Path = '\\server\share\Accucut\current\restore.ps1' }
    ) {
        { Get-AccucutScriptInstallRoot -ScriptPath $Path -Name 'restore.ps1' } | Should -Throw '*Run the installed restore.ps1 only*'
    }

    It 'takes no argument at all, so nothing on the command line can change what it replaces' {
        $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $script:WindowsDirectory 'restore.ps1'), [ref]$null, [ref]$null)
        @($ast.ParamBlock.Parameters).Count | Should -Be 0
    }

    It 'does not depend on the Admin endpoint: it names no endpoint, no session and no virtual account, so the same script runs as a full administrator (AC-8 fallback)' {
        $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'restore.ps1') -Raw
        $code = [regex]::Replace($text, '(?m)^\s*#.*$', '')
        $code | Should -Not -Match 'PSSession|Enter-PSSession|JEA|VirtualAccount|AccucutAdmin\b'
    }
}

Describe 'the checks of restore.ps1 come before the module, the questions and the restore (AC-1; ADR-015 Amendment 2)' {
    BeforeEach {
        $script:Trace = [System.Collections.Generic.List[string]]::new()
        $script:Settings = [pscustomobject]@{ AgeRecipient = ('age1' + ('q' * 58)); PgHost = '127.0.0.1'; PgPort = 5432; Database = 'accucut'; PgBinDirectory = 'C:\Program Files\PostgreSQL\17\bin' }
        Mock Assert-AccucutTrustedRootShape { $script:Trace.Add("shape:$Root") }
        Mock Get-AccucutTrustedCurrent { $script:Trace.Add('current'); return 'C:\Accucut\releases\t1' }
        Mock Assert-AccucutTrustedPath { $script:Trace.Add("path:$Path") }
        Mock Import-AccucutTrustedModule { $script:Trace.Add('import') }
        Mock Assert-AccucutAdminGroupEmpty { $script:Trace.Add('group-empty') }
        Mock Assert-AccucutRestorePassFileTrusted { $script:Trace.Add("pgpass:$Path|$GroupSid") }
        Mock Get-AccucutBackupAccountSid { $script:Trace.Add('sid'); return $script:BackupSid }
        Mock Get-AccucutAdminGroupSid { $script:Trace.Add('group'); return $script:EndpointSid }
        Mock Read-AccucutBackupSettings { $script:Trace.Add("settings:$Path"); return $script:Settings }
        Mock Read-AccucutInstallState { $script:Trace.Add("state:$Path"); return [pscustomobject]@{ Port = 3000; NodeExe = 'C:\Program Files\nodejs\node.exe' } }
        Mock Assert-AccucutBackupFolderTrusted { $script:Trace.Add("folder:$Directory|$BackupSid|$EndpointSid") }
        Mock Resolve-AccucutTrustedExecutable { $script:Trace.Add("program:$Path"); return $Path }
        Mock Invoke-AccucutRestore { $script:Trace.Add("restore:$HealthUrl|$($Program.Node)|$($Program.PgRestore)"); return [pscustomobject]@{ Restored = $true } }
    }

    It 'checks the root, the release and the script, loads the module, then checks the settings files, the state, the backups folder (the Admin group may write there too) and every program, and only then asks the Admin anything' {
        Invoke-AccucutRestoreScript -ScriptPath 'C:\Accucut\current\restore.ps1'
        $expected = @(
            'shape:C:\Accucut', 'current', 'path:C:\Accucut\releases\t1', 'path:C:\Accucut\releases\t1\restore.ps1', 'import', 'group-empty', 'sid',
            'path:C:\Accucut\config\backup-settings.json', 'path:C:\Accucut\config\restore.pgpass', 'path:C:\Accucut\config\install-state.json',
            'group', "pgpass:C:\Accucut\config\restore.pgpass|$($script:EndpointSid)",
            'settings:C:\Accucut\config\backup-settings.json', 'state:C:\Accucut\config\install-state.json', 'group',
            "folder:C:\Accucut\backups|$($script:BackupSid)|$($script:EndpointSid)",
            'program:C:\Accucut\releases\t1\bin\age.exe', 'program:C:\Program Files\PostgreSQL\17\bin\pg_dump.exe', 'program:C:\Program Files\PostgreSQL\17\bin\pg_restore.exe',
            'program:C:\Program Files\PostgreSQL\17\bin\psql.exe', 'program:C:\Program Files\nodejs\node.exe',
            'restore:http://127.0.0.1:3000/api/health|C:\Program Files\nodejs\node.exe|C:\Program Files\PostgreSQL\17\bin\pg_restore.exe'
        )
        (@($script:Trace) -join "`n") | Should -Be ($expected -join "`n")
    }

    It 'stops before the module, the questions and the restore, naming the reason, when a check fails: <Case>' -ForEach @(
        @{ Case = 'the script is not the running release'; Message = '*not the restore.ps1 of the running release*'; Imported = 0 }
        @{ Case = 'the release folder fails the trust check'; Message = '*can be changed by S-1-5-32-545*'; Imported = 0 }
        @{ Case = 'the backups folder has an extra writer'; Message = '*backups*can be changed*'; Imported = 1 }
        @{ Case = 'pg_restore fails the trust check'; Message = '*pg_restore.exe*can be changed*'; Imported = 1 }
        @{ Case = 'restore.pgpass fails the trust check'; Message = '*restore.pgpass*can be changed*'; Imported = 1 }
    ) {
        $scriptPath = 'C:\Accucut\current\restore.ps1'
        switch ($Case) {
            'the script is not the running release' { $scriptPath = 'C:\Accucut\releases\other\restore.ps1' }
            'the release folder fails the trust check' { Mock Assert-AccucutTrustedPath { throw "'$Path' can be changed by S-1-5-32-545" } }
            'the backups folder has an extra writer' { Mock Assert-AccucutBackupFolderTrusted { throw "'$Directory' can be changed by S-1-5-32-545" } }
            'pg_restore fails the trust check' { Mock Resolve-AccucutTrustedExecutable { if ($Path -like '*pg_restore.exe') { throw "'$Path' can be changed by S-1-5-32-545" }; return $Path } }
            'restore.pgpass fails the trust check' { Mock Assert-AccucutTrustedPath { if ($Path -like '*restore.pgpass') { throw "'$Path' can be changed by S-1-5-32-545" } } }
        }
        { Invoke-AccucutRestoreScript -ScriptPath $scriptPath } | Should -Throw $Message
        Should -Invoke Invoke-AccucutRestore -Times 0 -Exactly
        Should -Invoke Import-AccucutTrustedModule -Times $Imported -Exactly
    }
}

Describe 'the guided restore, with real age and a stand-in pg_restore (AC-1 to AC-6, AC-9)' -Skip:(-not $script:HaveAge -and -not $script:CiExpectsAge) {
    BeforeEach {
        $script:Trace = [System.Collections.Generic.List[string]]::new()
        $script:Events = [System.Collections.Generic.List[string]]::new()
        $script:LogLines = [System.Collections.Generic.List[string]]::new()
        $script:Screen = [System.Collections.Generic.List[string]]::new()
        $script:Prompts = [System.Collections.Generic.List[string]]::new()
        $script:Answers = [System.Collections.Queue]::new()
        $script:ServerVersion = '17.2'
        $script:Healthy = $true
        $script:SafetySkipPrune = $false
        $script:FreeBytes = [int64]60GB
        $script:Keys = New-TestKeyPair
        $script:Plain = New-TestDump
        $script:Root = Join-Path $TestDrive ('root-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        $script:Paths = Get-AccucutPaths -Root $script:Root
        foreach ($folder in $script:Paths.Config, $script:Paths.Backups, $script:Paths.Logs) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
        $script:PgPassword = 'FAKEpassword' + [guid]::NewGuid().ToString('N').Substring(0, 12)
        [System.IO.File]::WriteAllText($script:Paths.RestorePgpass, "127.0.0.1:5432:*:accucut_restore:$($script:PgPassword)`n")
        $script:Settings = [pscustomobject]@{ AgeRecipient = $script:Keys.Public; PgHost = '127.0.0.1'; PgPort = 5432; Database = 'accucut'; PgBinDirectory = 'C:\fake\pg\bin' }
        $script:Program = @{ Age = $script:AgeExe; PgDump = 'C:\fake\pg\bin\pg_dump.exe'; PgRestore = $script:FakePgRestore; Psql = 'C:\fake\pg\bin\psql.exe'; Node = 'C:\fake\node.exe' }
        # Three copies, the middle one is the one the tests restore unless they say otherwise (so that "newest first" is visible in the list).
        $script:Old = New-TestCopy -Directory $script:Paths.Backups -CreatedUtc ([datetime]::new(2026, 11, 1, 2, 0, 0, [System.DateTimeKind]::Utc)) -Recipient $script:Keys.Public -Plain $script:Plain
        $script:Mid = New-TestCopy -Directory $script:Paths.Backups -CreatedUtc ([datetime]::new(2026, 11, 8, 2, 0, 0, [System.DateTimeKind]::Utc)) -Recipient $script:Keys.Public -Plain $script:Plain
        $script:New = New-TestCopy -Directory $script:Paths.Backups -CreatedUtc ([datetime]::new(2026, 11, 15, 2, 0, 0, [System.DateTimeKind]::Utc)) -Recipient $script:Keys.Public -Plain $script:Plain
        $script:KeySecure = ConvertTo-SecureString -String $script:Keys.Secret -AsPlainText -Force
        $env:FAKE_RESTORE_OUT = Join-Path $TestDrive ('restored-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.bin')
        $env:FAKE_RESTORE_LOG = Join-Path $TestDrive ('restore-log-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.txt')
        Remove-Item Env:\FAKE_RESTORE_EXIT -ErrorAction SilentlyContinue

        Mock Get-AccucutDatabaseInfo -ModuleName AccucutOps { $script:Trace.Add("info:$DatabaseRole"); [pscustomobject]@{ ServerVersion = $script:ServerVersion; SizeBytes = [int64]1MB } }
        Mock Get-AccucutVolumeSpace -ModuleName AccucutOps { [pscustomobject]@{ TotalBytes = [int64]100GB; FreeBytes = $script:FreeBytes } }
        Mock Stop-AccucutServices -ModuleName AccucutOps { $script:Trace.Add('stop') }
        Mock Start-AccucutServices -ModuleName AccucutOps { $script:Trace.Add('start') }
        Mock Wait-AccucutHealth -ModuleName AccucutOps { $script:Trace.Add("health:$Url"); return $script:Healthy }
        Mock Invoke-AccucutBackup -ModuleName AccucutOps { $script:SafetySkipPrune = [bool]$SkipPrune; $script:Trace.Add("safety:$Reason|$ReleaseTag|$DatabaseRole|$([System.IO.Path]::GetFileName($PassFile))"); return [pscustomobject]@{ Name = 'accucut-20261118-020000-release.age' } }
        Mock New-AccucutRestoreDatabase -ModuleName AccucutOps { $script:Trace.Add("new:$Name") }
        Mock Switch-AccucutRestoreDatabase -ModuleName AccucutOps { $script:Trace.Add("swap:$Replacement>$Previous") }
        Mock Remove-AccucutRestoreDatabase -ModuleName AccucutOps { $script:Trace.Add("drop:$Name") }
        Mock Invoke-AccucutMigration -ModuleName AccucutOps { $script:Trace.Add('migrate'); $script:MigrationUrl = $MigrateDatabaseUrl; $script:MigrationNode = $NodeExe }
        # The events go through the real Write-AccucutRestoreEvent (so that the account ending is the real one); only the call that writes to the Application log is replaced.
        Mock Get-AccucutRunningAccount -ModuleName AccucutOps { 'TESTSRV\admin.test' }
        Mock Write-AccucutApplicationEvent -ModuleName AccucutOps { $script:Events.Add("$EntryType|$EventId|$Text") }
        Mock Write-AccucutRestoreEvent -ModuleName AccucutOps { & $script:RealWriteRestoreEvent -EntryType $EntryType -EventId $EventId -Message $Message }
        Mock Add-AccucutRestoreLogLine -ModuleName AccucutOps { $script:LogLines.Add($Line) }
        Mock Write-AccucutLog -ModuleName AccucutOps { $script:Screen.Add($Message) }
        Mock Write-Host -ModuleName AccucutOps { $script:Screen.Add(($Object -join ' ')) }
        Mock Read-AccucutHostInput -ModuleName AccucutOps { $script:Prompts.Add($Prompt); return [string]$script:Answers.Dequeue() }
        Mock Read-AccucutKeyInput -ModuleName AccucutOps { $script:Prompts.Add($Prompt); return $script:KeySecure }
        # The installed release's migrations (R3): the copy under test has applied exactly these two, which are the release's own.
        foreach ($migration in '20260101000000_first', '20260102000000_second') { New-Item -ItemType Directory -Path (Join-Path $script:Root "releases\t1\migrate\prisma\migrations\$migration") -Force | Out-Null }
        $script:Applied = "20260101000000_first`n20260102000000_second`n"
        Mock Invoke-AccucutRestoreSql -ModuleName AccucutOps { return $script:Applied }
    }

    AfterEach {
        foreach ($name in 'FAKE_RESTORE_OUT', 'FAKE_RESTORE_LOG', 'FAKE_RESTORE_EXIT') { Remove-Item "Env:\$name" -ErrorAction SilentlyContinue }
    }

    BeforeAll {
        function Invoke-TestRestore {
            return (Invoke-AccucutRestore -Paths $script:Paths -Settings $script:Settings -Program $script:Program -ReleaseDirectory (Join-Path $script:Root 'releases\t1') -HealthUrl 'http://127.0.0.1:3000/api/health' -HealthTimeoutSeconds 5)
        }
        function Get-StopCode {
            param([scriptblock]$Run)
            try { & $Run } catch { return [pscustomobject]@{ Code = [string]$_.Exception.Data['accucutCode']; Message = $_.Exception.Message } }
            return $null
        }
    }

    Context 'a good restore' {
        It 'AC-1, AC-3, AC-9: lists the copies newest first, restores the one chosen from the key of this run, and does the steps of the table in order' {
            $script:Answers.Enqueue('2'); $script:Answers.Enqueue('2026-11-08')
            $result = Invoke-TestRestore
            $result.Restored | Should -BeTrue
            $result.Copy | Should -Be (Split-Path -Leaf $script:Mid)
            # newest first
            $listing = @($script:Screen | Where-Object { $_ -match '^\s+\d+\s+2026-11-\d\d' })
            $listing.Count | Should -Be 3
            $listing[0] | Should -Match '2026-11-15'
            $listing[2] | Should -Match '2026-11-01'
            # the order of the architecture 9.5 step table: checks, stop, safety copy, new database, restore, migrate, swap, start, health, drop the old one
            $steps = (@($script:Trace) -join ' ') -replace 'accucut_(new|old)_\d{14}', 'accucut_$1_T'
            $steps | Should -Be 'info:accucut_restore stop safety:release|before-restore|accucut_restore|restore.pgpass new:accucut_new_T migrate swap:accucut_new_T>accucut_old_T start health:http://127.0.0.1:3000/api/health drop:accucut_old_T'
            # SQR-01: the safety copy does not prune, so it can never delete the copy that is being restored (a copy just past 2 years, pushed out of the newest 4 by the safety copy itself)
            $script:SafetySkipPrune | Should -BeTrue
            # the bytes that pg_restore received are exactly the dump that was encrypted (age decrypted them with the key, which only travelled on standard input)
            [System.BitConverter]::ToString([System.IO.File]::ReadAllBytes($env:FAKE_RESTORE_OUT)) | Should -BeExactly ([System.BitConverter]::ToString($script:Plain))
            $log = Get-Content -LiteralPath $env:FAKE_RESTORE_LOG
            $log[0] | Should -Match '^--no-password\|--exit-on-error\|--single-transaction\|--host\|127\.0\.0\.1\|--port\|5432\|--username\|accucut_restore\|--dbname\|accucut_new_\d{14}$'
            $log[1] | Should -Be "PGPASSFILE=$($script:Paths.RestorePgpass)"
            $log[2] | Should -Be 'PGPASSWORD='
            # the forward migration runs on the NEW database, as the restore role
            $script:MigrationUrl | Should -Match "^postgresql://accucut_restore:$([regex]::Escape($script:PgPassword))@127\.0\.0\.1:5432/accucut_new_\d{14}$"
            $script:MigrationNode | Should -Be 'C:\fake\node.exe'
        }

        It 'AC-2: says what is lost (everything entered since the copy, the audit rows too), asks for the date, and goes on only after it was typed exactly' {
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            [void](Invoke-TestRestore)
            $text = $script:Screen -join "`n"
            $text | Should -Match 'LOSES everything entered since then'
            $text | Should -Match 'audit rows too'
            $text | Should -Match '2026-11-15 UTC'
            @($script:Prompts | Where-Object { $_ -like 'To go on, type the date of the copy exactly as shown (2026-11-15)*' }).Count | Should -Be 1
            # the order of the questions: which copy, the date, then the key
            $script:Prompts[0] | Should -BeLike 'Type the number of the copy*'
            $script:Prompts[1] | Should -BeLike 'To go on, type the date*'
            $script:Prompts[2] | Should -BeLike 'Paste the backup key*'
        }

        It 'AC-6: records the restore in restore.log and as one Application event, and the record names the copy and holds no key' {
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            [void](Invoke-TestRestore)
            @($script:Events | Where-Object { $_ -like 'Information|1100|*' }).Count | Should -Be 1
            $script:Events[0] | Should -Match 'Restore finished: the portal runs on the copy of 2026-11-15 UTC'
            ($script:LogLines -join "`n") | Should -Match 'Restore started for the copy accucut-20261115-020000-weekly\.age'
            ($script:LogLines -join "`n") | Should -Match 'Restore finished'
            foreach ($text in @($script:LogLines) + @($script:Events) + @($script:Screen)) { $text | Should -Not -Match 'AGE-SECRET' }
        }

        It 'AC-5, AC-9: the key is in no file under the test folder, the temp folder or the install folder of the test after the run, and not on any screen line or in any log line' {
            $script:Answers.Enqueue('3'); $script:Answers.Enqueue('2026-11-01')
            [void](Invoke-TestRestore)
            $secret = $script:Keys.Secret
            $roots = @($TestDrive, $script:FakeFolder, $script:Root)
            $hits = Find-TextInFiles -Text $secret -Root $roots
            @($hits | Where-Object { $_ -notlike "$($script:AgeFolder)*" }).Count | Should -Be 0 -Because "found in: $($hits -join ', ')"
            foreach ($line in @($script:Screen) + @($script:LogLines) + @($script:Events)) { $line | Should -Not -Match ([regex]::Escape($secret)) }
        }

        It 'AC-5: the key goes to age on standard input only: never on a command line (the arguments are fixed), never in the environment of either program' {
            $pipe = (Get-Command Invoke-AccucutRestorePipe -Module AccucutOps).ScriptBlock.ToString()
            $pipe | Should -Match "'-d', '-i', '-', \`$CopyPath"
            $pipe | Should -Not -Match 'KeyBytes\b[^\n]*(Arguments|EnvironmentVariables)'
            $pipe | Should -Match '\$age\.StandardInput\.BaseStream'
            $check = (Get-Command Test-AccucutBackupKey -Module AccucutOps).ScriptBlock.ToString()
            $check | Should -Match "'-d', '-i', '-', \`$CopyPath"
            # And the environment that pg_restore saw holds no key and no password.
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            [void](Invoke-TestRestore)
            (Get-Content -LiteralPath $env:FAKE_RESTORE_LOG -Raw) | Should -Not -Match 'AGE-SECRET'
        }
    }

    Context 'ADR-015 Amendment 3.4: the restore names the Windows account that ran it' {
        It 'a good run: the first line of restore.log, before the copy list, is "Restore run by the account." and the event of the run ends with " Run by the account."' {
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            [void](Invoke-TestRestore)
            $script:LogLines.Count | Should -BeGreaterThan 1
            $script:LogLines[0] | Should -Match 'INFO\s+Restore run by TESTSRV\\admin\.test\.$'
            $script:LogLines[1] | Should -Match 'Restore started for the copy'
            $done = @($script:Events | Where-Object { $_ -like 'Information|1100|*' })
            $done.Count | Should -Be 1
            $done[0].EndsWith(' Run by TESTSRV\admin.test.') | Should -BeTrue -Because $done[0]
        }

        It 'a stop by the Admin at the copy list: the last two lines of restore.log are the account and the stop, and the event 1101 ends with the account' {
            $script:Answers.Enqueue('')
            $result = Invoke-TestRestore
            $result.Cancelled | Should -BeTrue
            $lines = @($script:LogLines)
            $lines.Count | Should -Be 2
            $lines[0] | Should -Match 'Restore run by TESTSRV\\admin\.test\.$'
            $lines[1] | Should -Match 'Stopped by the Admin before a copy was chosen'
            $stopped = @($script:Events | Where-Object { $_ -like 'Information|1101|*' })
            $stopped.Count | Should -Be 1
            $stopped[0].EndsWith(' Run by TESTSRV\admin.test.') | Should -BeTrue -Because $stopped[0]
        }

        It 'a check failure (a changed copy): the event 1110 ends with the account' {
            $bytes = [System.IO.File]::ReadAllBytes($script:New)
            $bytes[$bytes.Length - 1] = [byte](($bytes[$bytes.Length - 1] + 1) % 256)
            [System.IO.File]::WriteAllBytes($script:New, $bytes)
            $script:Answers.Enqueue('1')
            { Invoke-TestRestore } | Should -Throw
            $failed = @($script:Events | Where-Object { $_ -like 'Error|1110|*' })
            $failed.Count | Should -Be 1
            $failed[0].EndsWith(' Run by TESTSRV\admin.test.') | Should -BeTrue -Because $failed[0]
            $script:LogLines[0] | Should -Match 'Restore run by TESTSRV\\admin\.test\.$'
        }
    }

    Context 'AC-4: the four failures that stop it before anything is touched' {
        It 'a changed SHA-256 (one byte of the copy is different, the size is the same): stops, says so, and leaves the old database serving' {
            $bytes = [System.IO.File]::ReadAllBytes($script:New)
            $bytes[$bytes.Length - 1] = [byte](($bytes[$bytes.Length - 1] + 1) % 256)
            [System.IO.File]::WriteAllBytes($script:New, $bytes)
            $script:Answers.Enqueue('1')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'checksum'
            $stop.Message | Should -Match 'does not match the checksum in its manifest'
            $stop.Message | Should -Match 'still running on its old database'
            $stop.Message | Should -Match 'Call your IT person\.'
        }

        It 'a newer PostgreSQL in the manifest than the server''s: stops' {
            Remove-Item -LiteralPath $script:New, ($script:New -replace '\.age$', '.manifest.json') -Force
            $null = New-TestCopy -Directory $script:Paths.Backups -CreatedUtc ([datetime]::new(2026, 11, 15, 2, 0, 0, [System.DateTimeKind]::Utc)) -Recipient $script:Keys.Public -Plain $script:Plain -PostgresVersion '18.1'
            $script:Answers.Enqueue('1')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'postgres-version'
            $stop.Message | Should -Match 'PostgreSQL 18.*PostgreSQL 17'
            $stop.Message | Should -Match 'Call your IT person\.'
        }

        It 'a wrong key (a real key of another pair): stops after the date, before the portal is stopped' {
            $other = New-TestKeyPair
            $script:KeySecure = ConvertTo-SecureString -String $other.Secret -AsPlainText -Force
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'wrong-key'
            $stop.Message | Should -Match 'does not open the copy'
            $stop.Message | Should -Match 'Call your IT person\.'
            $stop.Message | Should -Not -Match ([regex]::Escape($other.Secret))
        }

        It 'a typed date that does not match: stops, and nothing was asked after it (not even the key)' {
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-14')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'date-mismatch'
            $stop.Message | Should -Match 'not the date of the copy \(2026-11-15\)'
            $stop.Message | Should -Match 'Call your IT person\.'
            @($script:Prompts | Where-Object { $_ -like 'Paste the backup key*' }).Count | Should -Be 0
        }

        It 'each of them changes nothing: no service stopped, no safety copy, no database made, swapped or dropped, and the failure is one Error event (1110) outside the database' -ForEach @(
            @{ Case = 'checksum' }, @{ Case = 'version' }, @{ Case = 'key' }, @{ Case = 'date' }
        ) {
            switch ($Case) {
                'checksum' { $bytes = [System.IO.File]::ReadAllBytes($script:New); $bytes[$bytes.Length - 1] = [byte](($bytes[$bytes.Length - 1] + 1) % 256); [System.IO.File]::WriteAllBytes($script:New, $bytes); $script:Answers.Enqueue('1') }
                'version' { $script:ServerVersion = '16.4'; $script:Answers.Enqueue('1') }
                'key' { $script:KeySecure = ConvertTo-SecureString -String (New-TestKeyPair).Secret -AsPlainText -Force; $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15') }
                'date' { $script:Answers.Enqueue('1'); $script:Answers.Enqueue('15 November') }
            }
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop | Should -Not -BeNullOrEmpty
            $touched = @($script:Trace | Where-Object { $_ -match '^(stop|start|safety|new|swap|drop|migrate)' })
            $touched.Count | Should -Be 0 -Because "touched: $($touched -join ', ')"
            @($script:Events | Where-Object { $_ -like 'Error|1110|*' }).Count | Should -Be 1
            @($script:Events | Where-Object { $_ -like 'Information|1100|*' }).Count | Should -Be 0
            Test-Path -LiteralPath $env:FAKE_RESTORE_OUT | Should -BeFalse -Because 'pg_restore was never started'
        }

        It 'not enough free space (the restore needs a safety copy and the new database, with 20 % of the disk still free): stops' {
            $script:FreeBytes = [int64]20GB + 1KB
            $script:Answers.Enqueue('1')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'low-space'
            $stop.Message | Should -Match 'not enough free disk space for a restore'
        }

        It 'a copy that has no manifest is listed and cannot be chosen; Enter at the first question stops with nothing changed (and an Information event)' {
            $orphan = New-TestCopy -Directory $script:Paths.Backups -CreatedUtc ([datetime]::new(2026, 11, 16, 2, 0, 0, [System.DateTimeKind]::Utc)) -Recipient $script:Keys.Public -Plain $script:Plain -NoManifest
            $script:Answers.Enqueue('1')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'bad-choice'
            ($script:Screen -join "`n") | Should -Match 'CANNOT BE USED \(it has no manifest\)'
            $script:Answers.Clear(); $script:Answers.Enqueue('')
            $result = Invoke-TestRestore
            $result.Cancelled | Should -BeTrue
            @($script:Events | Where-Object { $_ -like 'Information|1101|*' }).Count | Should -Be 1
            @($script:Trace | Where-Object { $_ -match '^(stop|safety|new|swap)' }).Count | Should -Be 0
            Remove-Item -LiteralPath $orphan -Force
        }

        It 'what is pasted is not a key: stops, and the paste is never echoed' {
            $script:KeySecure = ConvertTo-SecureString -String 'this is not a key but it is long' -AsPlainText -Force
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'bad-key-format'
            $stop.Message | Should -Not -Match 'this is not a key'
        }
    }

    Context 'AC-3, AC-4: a failure after the portal was stopped puts the old database back in service' {
        It 'R3: a copy from a NEWER release (it has applied a migration that the installed release lacks) stops with newer-release before the swap: the new database is dropped, the services start again, and the message says what to do' {
            $script:Applied = "20260101000000_first`n20260102000000_second`n20991231000000_from_a_newer_release`n"
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'restore-failed'
            $stop.Message | Should -Match 'made by a newer release of the portal than the one installed'
            $stop.Message | Should -Match 'Ask your IT person to install that release, then run the restore again'
            $stop.Message | Should -Match 'Call your IT person\.'
            $steps = (@($script:Trace) -join ' ') -replace 'accucut_(new|old|failed)_\d{14}', 'accucut_$1_T'
            $steps | Should -Be 'info:accucut_restore stop safety:release|before-restore|accucut_restore|restore.pgpass new:accucut_new_T stop drop:accucut_new_T start'
            @($script:Trace | Where-Object { $_ -like 'swap:*' -or $_ -eq 'migrate' }).Count | Should -Be 0
            @($script:Events | Where-Object { $_ -like 'Error|1111|*' }).Count | Should -Be 1
        }

        It 'R3: an older copy (it has applied fewer migrations than the release has) is accepted and migrated forward; the check reads only finished, not rolled back, migrations of the new database' {
            $script:Applied = "20260101000000_first`n"
            $script:Sql = [System.Collections.Generic.List[string]]::new()
            Mock Invoke-AccucutRestoreSql -ModuleName AccucutOps { $script:Sql.Add("$Database|$Sql"); return $script:Applied }
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            $result = Invoke-TestRestore
            $result.Restored | Should -BeTrue
            @($script:Trace | Where-Object { $_ -eq 'migrate' }).Count | Should -Be 1
            $query = @($script:Sql | Where-Object { $_ -like '*_prisma_migrations*' })
            $query.Count | Should -Be 1
            $query[0] | Should -Match '^accucut_new_\d{14}\|'
            $query[0] | Should -Match 'WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
        }

        It 'pg_restore fails: the new database is dropped, the names are never swapped, the services start again, and it says Call your IT person (Error 1111)' {
            $env:FAKE_RESTORE_EXIT = '1'
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'restore-failed'
            $stop.Message | Should -Match 'pg_restore failed with exit code 1'
            $stop.Message | Should -Match 'The portal is running on the old database'
            $stop.Message | Should -Match 'Call your IT person\.'
            $steps = (@($script:Trace) -join ' ') -replace 'accucut_(new|old)_\d{14}', 'accucut_$1_T'
            $steps | Should -Be 'info:accucut_restore stop safety:release|before-restore|accucut_restore|restore.pgpass new:accucut_new_T stop drop:accucut_new_T start'
            @($script:Trace | Where-Object { $_ -like 'swap:*' }).Count | Should -Be 0
            @($script:Events | Where-Object { $_ -like 'Error|1111|*' }).Count | Should -Be 1
            ($script:LogLines -join "`n") | Should -Match 'The portal was started again on the old database'
        }

        It 'the safety copy fails: nothing else is made, the services start again' {
            Mock Invoke-AccucutBackup -ModuleName AccucutOps { $script:Trace.Add('safety'); throw 'Not enough free disk space for another copy.' }
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'restore-failed'
            $stop.Message | Should -Match 'Not enough free disk space for another copy'
            $steps = (@($script:Trace) -join ' ') -replace 'accucut_(new|old)_\d{14}', 'accucut_$1_T'
            $steps | Should -Be 'info:accucut_restore stop safety stop drop:accucut_new_T start'
            @($script:Trace | Where-Object { $_ -match '^(new|swap):' }).Count | Should -Be 0
        }

        It 'the portal is not healthy after the swap: the swap is made back (the failed restore is kept as accucut_failed_...), the services are stopped and started again, Call your IT person' {
            $script:Healthy = $false
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'restore-failed'
            $stop.Message | Should -Match 'did not answer 200'
            $stop.Message | Should -Match 'Call your IT person\.'
            $steps = (@($script:Trace) -join ' ') -replace 'accucut_(new|old|failed)_\d{14}', 'accucut_$1_T'
            $steps | Should -Be 'info:accucut_restore stop safety:release|before-restore|accucut_restore|restore.pgpass new:accucut_new_T migrate swap:accucut_new_T>accucut_old_T start health:http://127.0.0.1:3000/api/health stop swap:accucut_old_T>accucut_failed_T start'
            @($script:Trace | Where-Object { $_ -like 'drop:*' }).Count | Should -Be 0
            @($script:Events | Where-Object { $_ -like 'Error|1111|*' }).Count | Should -Be 1
        }

        It 'if putting the old database back fails too, it says the portal may not be running and records Error 1112' {
            $script:Healthy = $false
            Mock Switch-AccucutRestoreDatabase -ModuleName AccucutOps { $script:Trace.Add("swap:$Replacement>$Previous"); if ($Previous -like 'accucut_failed_*') { throw 'database is being accessed by other users' } }
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            $stop = Get-StopCode { Invoke-TestRestore }
            $stop.Code | Should -Be 'roll-back-failed'
            $stop.Message | Should -Match 'old database could not be put back'
            $stop.Message | Should -Match 'may not be running'
            $stop.Message | Should -Match 'Call your IT person\.'
            @($script:Events | Where-Object { $_ -like 'Error|1112|*' }).Count | Should -Be 1
        }

        It 'a failed restore leaves no key on any disk and none on any screen or log line' {
            $env:FAKE_RESTORE_EXIT = '1'
            $script:Answers.Enqueue('1'); $script:Answers.Enqueue('2026-11-15')
            $null = Get-StopCode { Invoke-TestRestore }
            $hits = Find-TextInFiles -Text $script:Keys.Secret -Root @($TestDrive, $script:FakeFolder, $script:Root)
            @($hits | Where-Object { $_ -notlike "$($script:AgeFolder)*" }).Count | Should -Be 0 -Because "found in: $($hits -join ', ')"
            foreach ($line in @($script:Screen) + @($script:LogLines) + @($script:Events)) { $line | Should -Not -Match ([regex]::Escape($script:Keys.Secret)) }
        }
    }
}

Describe 'the small parts of the restore (AC-1, AC-3, AC-4, AC-5, AC-6)' {
    It 'the version check refuses a copy from a newer PostgreSQL, accepts the same or an older one, and refuses a version it cannot read (<Copy> into <Server>)' -ForEach @(
        @{ Copy = '17.2'; Server = '17.4'; Ok = $true }
        @{ Copy = '16.9'; Server = '17.0'; Ok = $true }
        @{ Copy = '18.0'; Server = '17.9'; Ok = $false }
        @{ Copy = ''; Server = '17.0'; Ok = $false }
        @{ Copy = '17.2'; Server = 'unknown'; Ok = $false }
    ) {
        (Test-AccucutRestoreVersion -ManifestVersion $Copy -ServerVersion $Server).Ok | Should -Be $Ok
    }

    It 'the room check needs a safety copy and the new database, and 20 % of the disk free afterwards' {
        # database 10 GB, last copy 4 GB, chosen copy 4 GB: safety 4.4 GB, restored 10 GB, needs 14.4 GB, plus 20 GB kept free on a 100 GB disk
        (Test-AccucutRestoreRoom -FreeBytes 40GB -TotalBytes 100GB -LastCopyBytes 4GB -DatabaseBytes 10GB -CopyBytes 4GB).Ok | Should -BeTrue
        (Test-AccucutRestoreRoom -FreeBytes 34GB -TotalBytes 100GB -LastCopyBytes 4GB -DatabaseBytes 10GB -CopyBytes 4GB).Ok | Should -BeFalse
        (Test-AccucutRestoreRoom -FreeBytes 34GB -TotalBytes 100GB -LastCopyBytes 4GB -DatabaseBytes 10GB -CopyBytes 4GB).Message | Should -Match 'Clear old copies'
        (Test-AccucutRestoreRoom -FreeBytes 50GB -TotalBytes 0 -LastCopyBytes 0 -DatabaseBytes 1GB -CopyBytes 1GB).Ok | Should -BeFalse
    }

    It 'reads the password of the restore role from the password file, with an escaped colon and backslash, and refuses a file that has none' {
        $file = Join-Path $TestDrive 'pgpass-test'
        [System.IO.File]::WriteAllText($file, "other:5432:*:someone:nope`n127.0.0.1:5432:*:accucut_restore:ab\:cd\\ef`n")
        Read-AccucutPgpassPassword -Path $file -Role 'accucut_restore' | Should -Be 'ab:cd\ef'
        { Read-AccucutPgpassPassword -Path $file -Role 'accucut_nobody' } | Should -Throw '*holds no password for the role*'
    }

    It 'reads only the port and node.exe from the install state, and refuses a path that goes up or a port that is not one' {
        $good = Join-Path $TestDrive 'state-good.json'
        [System.IO.File]::WriteAllText($good, '{ "tag": "t1", "port": 3000, "nodeExe": "C:\\Program Files\\nodejs\\node.exe", "pgBinDirectory": "C:\\x" }')
        $state = Read-AccucutInstallState -Path $good
        $state.Port | Should -Be 3000
        $state.NodeExe | Should -Be 'C:\Program Files\nodejs\node.exe'
        foreach ($bad in '{ "port": 70000, "nodeExe": "C:\\n\\node.exe" }', '{ "port": 3000, "nodeExe": "C:\\..\\evil.exe" }', '{ "port": 3000, "nodeExe": "node.exe" }', '{ "port": 3000 }') {
            $file = Join-Path $TestDrive ('state-bad-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.json')
            [System.IO.File]::WriteAllText($file, $bad)
            { Read-AccucutInstallState -Path $file } | Should -Throw
        }
    }

    It 'a key that the real age-keygen makes has exactly the shape that the restore accepts, and a public key or a lower-case paste does not' -Skip:(-not $script:HaveAge -and -not $script:CiExpectsAge) {
        $pair = New-TestKeyPair
        $pattern = '^AGE-SECRET-' + 'KEY-1[0-9A-Z]{58}$'
        $pair.Secret | Should -MatchExactly $pattern
        $pair.Public | Should -Not -MatchExactly $pattern
        $pair.Secret.ToLowerInvariant() | Should -Not -MatchExactly $pattern
        ($pair.Secret + ' ') | Should -Not -MatchExactly $pattern
    }

    It 'only names that a restore made are ever renamed, dropped or put into SQL (the live name and an injection are refused)' -ForEach @(
        @{ Name = 'accucut' }, @{ Name = 'postgres' }, @{ Name = 'accucut_new_2026' }, @{ Name = 'accucut_new_20261118020000"; DROP DATABASE accucut; --' }, @{ Name = 'accucut_old_20261118020000x' }
    ) {
        { Assert-AccucutRestoreDatabaseName -Name $Name } | Should -Throw '*not the name of a database that a restore made*'
    }

    It 'builds the new database owned by accucut_owner with no access for PUBLIC, the swap as two renames in one transaction, and a drop that forces the last connections away' {
        $script:Sql = [System.Collections.Generic.List[string]]::new()
        Mock Invoke-AccucutRestoreSql -ModuleName AccucutOps { $script:Sql.Add($Sql + '|db=' + $Database); return '' }
        $settings = [pscustomobject]@{ PgHost = '127.0.0.1'; PgPort = 5432; Database = 'accucut' }
        New-AccucutRestoreDatabase -PsqlPath 'psql' -Settings $settings -PassFile 'x' -Name 'accucut_new_20261118020000'
        Switch-AccucutRestoreDatabase -PsqlPath 'psql' -Settings $settings -PassFile 'x' -Replacement 'accucut_new_20261118020000' -Previous 'accucut_old_20261118020000'
        Remove-AccucutRestoreDatabase -PsqlPath 'psql' -Settings $settings -PassFile 'x' -Name 'accucut_old_20261118020000'
        $script:Sql[0] | Should -Match 'SET ROLE NONE;'
        $script:Sql[0] | Should -Match 'CREATE DATABASE "accucut_new_20261118020000" TEMPLATE template0 ENCODING ''UTF8'' OWNER accucut_owner;'
        $script:Sql[0] | Should -Match 'REVOKE ALL ON DATABASE "accucut_new_20261118020000" FROM PUBLIC;'
        $script:Sql[0] | Should -Match 'GRANT CONNECT ON DATABASE "accucut_new_20261118020000" TO accucut_owner, accucut_app, accucut_backup;'
        $script:Sql[1] | Should -Match 'pg_terminate_backend'
        $script:Sql[1] | Should -Match "BEGIN;\s+ALTER DATABASE ""accucut"" RENAME TO ""accucut_old_20261118020000"";\s+ALTER DATABASE ""accucut_new_20261118020000"" RENAME TO ""accucut"";\s+COMMIT;"
        $script:Sql[2] | Should -Match 'DROP DATABASE IF EXISTS "accucut_old_20261118020000" WITH \(FORCE\);'
        foreach ($entry in $script:Sql) { $entry | Should -Match '\|db=postgres$' }
    }

    It 'every SQL of the restore goes to psql on standard input as the restore role with only PGPASSFILE of the PostgreSQL settings, after a comment line' {
        $script:Captured = $null
        Mock Invoke-AccucutNative -ModuleName AccucutOps { $script:Captured = @{ File = $FilePath; Arguments = $ArgumentList; Environment = $Environment; StdIn = $StdIn; Clear = $ClearPgEnvironment.IsPresent }; return [pscustomobject]@{ ExitCode = 0; Output = '' } }
        $settings = [pscustomobject]@{ PgHost = '127.0.0.1'; PgPort = 5432; Database = 'accucut' }
        [void](Invoke-AccucutRestoreSql -PsqlPath 'C:\pg\psql.exe' -Settings $settings -PassFile 'C:\Accucut\config\restore.pgpass' -Database 'postgres' -Sql "SELECT 1;`n")
        $script:Captured.Arguments | Should -Contain 'accucut_restore'
        $script:Captured.Arguments | Should -Contain '--file'
        ($script:Captured.Arguments -join ' ') | Should -Not -Match 'password|PGPASSWORD'
        @($script:Captured.Environment.Keys | Sort-Object) | Should -Be @('PGCONNECT_TIMEOUT', 'PGPASSFILE') -Because 'only the password file and a timeout'
        $script:Captured.Clear | Should -BeTrue
        $script:Captured.StdIn | Should -BeLike '-- accucut restore*'
    }
}

Describe 'restore.log (AC-6)' {
    It 'is made once, locked to Administrators and SYSTEM (and the endpoint group), and every restore adds its lines to it, newest last' -Skip:(-not $script:IsAdmin) {
        $log = Join-Path $TestDrive 'logs-a\restore.log'
        Add-AccucutRestoreLogLine -Path $log -Line 'first'
        Add-AccucutRestoreLogLine -Path $log -Line 'second'
        (Get-Content -LiteralPath $log) | Should -Be @('first', 'second')
        Test-AccucutRestoreLogFile -Path $log | Should -BeTrue
        $security = [System.IO.File]::GetAccessControl($log)
        $security.AreAccessRulesProtected | Should -BeTrue
        $security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value | Should -Be 'S-1-5-32-544'
        # The endpoint group (when the install made one) may also hold an entry on the file: it is the one extra SID that is allowed.
        $allowed = @('S-1-5-18', 'S-1-5-32-544'); $groupSid = Get-AccucutAdminGroupSid; if (-not [string]::IsNullOrEmpty($groupSid)) { $allowed += $groupSid }
        @($security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { $_.IdentityReference.Value } | Sort-Object) | Should -Be @($allowed | Sort-Object)
    }

    It 'is never written to when it was swapped for a file that is not the restore log''s own (a file of someone else): the line goes to a new restore-DATE-RANDOM.log file, and the other file is left as it was' -Skip:(-not $script:IsAdmin) {
        $folder = Join-Path $TestDrive 'logs-b'
        New-Item -ItemType Directory -Path $folder | Out-Null
        $log = Join-Path $folder 'restore.log'
        # an ordinary file that inherits the folder's list (not protected): what a service account could have put there
        [System.IO.File]::WriteAllText($log, 'planted')
        Test-AccucutRestoreLogFile -Path $log | Should -BeFalse
        Add-AccucutRestoreLogLine -Path $log -Line 'the real line'
        (Get-Content -LiteralPath $log -Raw).Trim() | Should -Be 'planted'
        $other = @(Get-ChildItem -LiteralPath $folder -Filter 'restore-*.log')
        $other.Count | Should -Be 1
        (Get-Content -LiteralPath $other[0].FullName) | Should -Be @('the real line')
    }

    It 'a link in place of the log is refused and not followed' -Skip:(-not $script:IsAdmin) {
        $folder = Join-Path $TestDrive 'logs-c'
        New-Item -ItemType Directory -Path $folder | Out-Null
        $target = Join-Path $TestDrive 'victim.txt'
        [System.IO.File]::WriteAllText($target, 'victim')
        $log = Join-Path $folder 'restore.log'
        $made = $true
        try { New-Item -ItemType SymbolicLink -Path $log -Target $target -ErrorAction Stop | Out-Null } catch { $made = $false }
        if (-not $made) { Set-ItResult -Skipped -Because 'this host cannot make a symbolic link'; return }
        Test-AccucutRestoreLogFile -Path $log | Should -BeFalse
        Add-AccucutRestoreLogLine -Path $log -Line 'must not reach the victim'
        (Get-Content -LiteralPath $target -Raw).Trim() | Should -Be 'victim'
    }
}

Describe 'R1: restore.ps1 and clear-copies.ps1 refuse to start when the Admin endpoint group has a member, or its members cannot be read (ADR-015 Amendment 3.3)' {
    It 'passes when there is no group (no endpoint was set up) and when the group is empty' {
        Mock Get-AccucutAdminGroupMemberList { return $null }
        { Assert-AccucutAdminGroupEmpty } | Should -Not -Throw
        Mock Get-AccucutAdminGroupMemberList { return , @() }
        { Assert-AccucutAdminGroupEmpty } | Should -Not -Throw
    }

    It 'stops with the exact message, and says nothing was changed, when the group has a member' {
        Mock Get-AccucutAdminGroupMemberList { return , @('SOMEONE') }
        { Assert-AccucutAdminGroupEmpty } | Should -Throw 'The group AccucutAdminRunAs has members. It must have none: a member could read the restore''s database password. Ask your IT person to remove them. Nothing was changed.'
    }

    It 'stops when the members cannot be read: an unreadable list is never taken for an empty one' {
        Mock Get-AccucutAdminGroupMemberList { throw 'Access is denied.' }
        { Assert-AccucutAdminGroupEmpty } | Should -Throw '*members of the group AccucutAdminRunAs could not be read (Access is denied.)*Nothing was changed.'
    }

    It 'is called after the module is loaded and before the first prompt, in both scripts, and the helper that reads the group is the same text in both' {
        foreach ($name in 'restore.ps1', 'clear-copies.ps1') {
            $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $script:WindowsDirectory $name), [ref]$null, [ref]$null)
            $calls = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true) | ForEach-Object { [pscustomobject]@{ Name = [string]$_.GetCommandName(); Offset = $_.Extent.StartOffset } })
            $import = @($calls | Where-Object { $_.Name -eq 'Import-AccucutTrustedModule' })[0].Offset
            $check = @($calls | Where-Object { $_.Name -eq 'Assert-AccucutAdminGroupEmpty' })[0].Offset
            $prompt = @($calls | Where-Object { $_.Name -in 'Invoke-AccucutRestore', 'Invoke-AccucutClearCopies' })[0].Offset
            $check | Should -BeGreaterThan $import -Because $name
            $check | Should -BeLessThan $prompt -Because $name
        }
    }
}

Describe 'R2: the rules of the restore.pgpass check, on invented descriptors (ADR-015 Amendment 3.3)' {
    BeforeAll {
        $script:Group = 'S-1-5-21-1111111111-2222222222-3333333333-1010'
        function New-Descriptor {
            param([string]$Owner = 'S-1-5-32-544', [bool]$Protected = $true, [bool]$Reparse = $false, [object[]]$Ace)
            return [pscustomobject]@{ Path = 'x'; Owner = $Owner; Protected = $Protected; Reparse = $Reparse; IsDirectory = $false; Aces = $Ace }
        }
        function New-Entry { param([string]$Sid, [int64]$Mask, [bool]$Allow = $true) return [pscustomobject]@{ Sid = $Sid; Allow = $Allow; Mask = $Mask; InheritOnly = $false; Inherited = $false; Flags = 0 } }
    }

    It 'accepts Administrators, SYSTEM and the group with Read, and nothing else' {
        Mock Get-AccucutTrustSecurity { New-Descriptor -Ace @((New-Entry 'S-1-5-32-544' 0x1F01FF), (New-Entry 'S-1-5-18' 0x1F01FF), (New-Entry $script:Group 0x120089)) }
        { Assert-AccucutRestorePassFileTrusted -Path 'C:\Accucut\config\restore.pgpass' -GroupSid $script:Group } | Should -Not -Throw
        { Assert-AccucutRestorePassFileTrusted -Path 'C:\Accucut\config\restore.pgpass' } | Should -Throw "*can be read by $($script:Group)*"
    }

    It 'refuses: <Case>' -ForEach @(
        @{ Case = 'a Users entry'; Owner = 'S-1-5-32-544'; Protected = $true; Extra = @{ Sid = 'S-1-5-32-545'; Mask = 0x120089; Allow = $true }; Message = '*can be read by S-1-5-32-545*' }
        @{ Case = 'the group with more than Read'; Owner = 'S-1-5-32-544'; Protected = $true; Extra = @{ Sid = 'GROUP'; Mask = 0x1301BF; Allow = $true }; Message = '*can be read by*' }
        @{ Case = 'AccucutBackup, App or Worker (any other SID)'; Owner = 'S-1-5-32-544'; Protected = $true; Extra = @{ Sid = 'S-1-5-80-1-2-3-4-5'; Mask = 0x120089; Allow = $true }; Message = '*can be read by S-1-5-80*' }
        @{ Case = 'a deny entry'; Owner = 'S-1-5-32-544'; Protected = $true; Extra = @{ Sid = 'S-1-5-32-545'; Mask = 0x120089; Allow = $false }; Message = '*deny entry*' }
        @{ Case = 'an owner that is not Administrators'; Owner = 'S-1-5-21-1-2-3-1001'; Protected = $true; Extra = $null; Message = '*is owned by S-1-5-21-1-2-3-1001*' }
        @{ Case = 'an inherited list'; Owner = 'S-1-5-32-544'; Protected = $false; Extra = $null; Message = '*inherits its permissions*' }
    ) {
        $entries = @((New-Entry 'S-1-5-32-544' 0x1F01FF), (New-Entry 'S-1-5-18' 0x1F01FF))
        if ($null -ne $Extra) {
            $sid = $Extra.Sid
            if ($sid -eq 'GROUP') { $sid = $script:Group }
            $entries += (New-Entry $sid ([int64]$Extra.Mask) ([bool]$Extra.Allow))
        }
        $script:Case = New-Descriptor -Owner $Owner -Protected $Protected -Ace $entries
        Mock Get-AccucutTrustSecurity { $script:Case }
        { Assert-AccucutRestorePassFileTrusted -Path 'C:\Accucut\config\restore.pgpass' -GroupSid $script:Group } | Should -Throw $Message
    }

    It 'refuses a link and a folder' {
        Mock Get-AccucutTrustSecurity { New-Descriptor -Reparse $true -Ace @() }
        { Assert-AccucutRestorePassFileTrusted -Path 'x' } | Should -Throw '*not a real file*'
    }
}

Describe 'R2: who may read restore.pgpass is checked before it is used (ADR-015 Amendment 3.3)' -Skip:(-not $script:IsAdmin) {
    BeforeAll {
        $script:StandInGroup = 'S-1-5-32-547'   # Power Users: a stand-in for the endpoint group, a SID that exists on every machine
        function Add-TestFileReadAccess {
            # One more Read entry on a file whose list is protected (a stand-in for the endpoint group of the earlier design; the module no longer has a function that does this).
            param([string]$Path, [string]$Sid)
            $security = [System.IO.File]::GetAccessControl($Path)
            $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($Sid), [System.Security.AccessControl.FileSystemRights]::Read, [System.Security.AccessControl.AccessControlType]::Allow))
            [System.IO.File]::SetAccessControl($Path, $security)
        }
        function New-PassFile {
            param([switch]$GroupRead, [switch]$UsersRead, [switch]$GroupModify, [switch]$Deny, [switch]$Unprotected)
            $path = Join-Path $TestDrive ('pgpass-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
            [System.IO.File]::WriteAllText($path, '127.0.0.1:5432:*:accucut_restore:FAKEpassword12345')
            if (-not $Unprotected) {
                Set-AccucutLockedFileAcl -Path $path
                if ($GroupRead) { Add-TestFileReadAccess -Path $path -Sid $script:StandInGroup }
                if ($UsersRead) { Add-TestFileReadAccess -Path $path -Sid 'S-1-5-32-545' }
                if ($GroupModify -or $Deny) {
                    $security = [System.IO.File]::GetAccessControl($path)
                    if ($GroupModify) { $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($script:StandInGroup), [System.Security.AccessControl.FileSystemRights]::Modify, [System.Security.AccessControl.AccessControlType]::Allow)) }
                    if ($Deny) { $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-545'), [System.Security.AccessControl.FileSystemRights]::Read, [System.Security.AccessControl.AccessControlType]::Deny)) }
                    [System.IO.File]::SetAccessControl($path, $security)
                }
            }
            return $path
        }
    }

    It 'accepts a file that only Administrators and SYSTEM can read, and one that the endpoint group may also read (Read, no more)' {
        { Assert-AccucutRestorePassFileTrusted -Path (New-PassFile) } | Should -Not -Throw
        { Assert-AccucutRestorePassFileTrusted -Path (New-PassFile -GroupRead) -GroupSid $script:StandInGroup } | Should -Not -Throw
    }

    It 'refuses a file that the Users group can read (a real Read entry), whoever the group is' {
        $file = New-PassFile -UsersRead
        { Assert-AccucutRestorePassFileTrusted -Path $file } | Should -Throw '*can be read by S-1-5-32-545*would not be secret*'
        { Assert-AccucutRestorePassFileTrusted -Path $file -GroupSid $script:StandInGroup } | Should -Throw '*can be read by S-1-5-32-545*'
    }

    It 'refuses the endpoint group when no group is named (no endpoint), and refuses it with more than Read' {
        { Assert-AccucutRestorePassFileTrusted -Path (New-PassFile -GroupRead) } | Should -Throw '*can be read by S-1-5-32-547*'
        { Assert-AccucutRestorePassFileTrusted -Path (New-PassFile -GroupModify) -GroupSid $script:StandInGroup } | Should -Throw '*can be read by S-1-5-32-547*'
    }

    It 'refuses a list that is inherited, and a deny entry' {
        { Assert-AccucutRestorePassFileTrusted -Path (New-PassFile -Unprotected) } | Should -Throw '*inherits its permissions*'
        { Assert-AccucutRestorePassFileTrusted -Path (New-PassFile -Deny) } | Should -Throw '*deny entry*'
    }
}

Describe 'the whole restore on the real install of stage 13 (AC-9: real services, PostgreSQL, age, pg_restore and migrations; only the prompts are mocked)' {
    It 'the install made the restore role and its password file (a job on the real install fails here, it never skips)' -Skip:(-not ($env:CI -eq 'true' -and $env:ACCUCUT_VALUES)) {
        Test-Path -LiteralPath 'C:\Accucut\config\restore.pgpass' | Should -BeTrue
        Test-Path -LiteralPath 'C:\Accucut\config\backup-settings.json' | Should -BeTrue
    }

    It 'restores the newest copy of the install with the key of this run, and the portal answers on the restored database' -Skip:(-not $script:RealInstall) {
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        $settings = Read-AccucutBackupSettings -Path $paths.BackupSettings
        $state = Read-AccucutInstallState -Path $paths.StateFile
        $release = [System.IO.Path]::Combine($paths.Releases, (Get-AccucutCurrentRelease -Paths $paths))
        $program = @{
            Age       = [System.IO.Path]::Combine($release, 'bin\age.exe')
            PgDump    = [System.IO.Path]::Combine($settings.PgBinDirectory, 'pg_dump.exe')
            PgRestore = [System.IO.Path]::Combine($settings.PgBinDirectory, 'pg_restore.exe')
            Psql      = [System.IO.Path]::Combine($settings.PgBinDirectory, 'psql.exe')
            Node      = $state.NodeExe
        }
        # The first copy of the list (newest first) that can be chosen: the one the Admin would pick.
        $first = @(Get-AccucutRestoreChoice -Directory $paths.Backups | Where-Object { $_.Copy.Verified } | Select-Object -First 1)
        $first.Count | Should -Be 1
        $newest = $first[0].Copy
        $keyLine = (Get-Content -LiteralPath $env:ACCUCUT_AGE_KEY | Where-Object { $_ -like 'AGE-SECRET-*' } | Select-Object -First 1).Trim()
        $script:RealKey = ConvertTo-SecureString -String $keyLine -AsPlainText -Force
        $script:RealDate = $newest.CreatedUtc.ToString('yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
        $script:RealAnswers = [System.Collections.Queue]::new()
        $script:RealAnswers.Enqueue([string]$first[0].Number); $script:RealAnswers.Enqueue($script:RealDate)
        Mock Read-AccucutHostInput -ModuleName AccucutOps { return [string]$script:RealAnswers.Dequeue() }
        Mock Read-AccucutKeyInput -ModuleName AccucutOps { return $script:RealKey }
        $before = @(Get-AccucutBackupCopy -Directory $paths.Backups).Count

        $result = Invoke-AccucutRestore -Paths $paths -Settings $settings -Program $program -ReleaseDirectory $release -HealthUrl "http://127.0.0.1:$($state.Port)/api/health" -HealthTimeoutSeconds 240

        $result.Restored | Should -BeTrue
        foreach ($name in (Get-AccucutServiceNames)) { (Get-Service -Name $name).Status | Should -Be 'Running' }
        Get-AccucutHttpStatus -Url "http://127.0.0.1:$($state.Port)/api/health" | Should -Be 200
        # the safety copy is an ordinary release copy in the backups folder, with its manifest
        @(Get-AccucutBackupCopy -Directory $paths.Backups).Count | Should -Be ($before + 1)
        $safety = @(Get-AccucutBackupCopy -Directory $paths.Backups | Where-Object { $_.Name -eq $result.SafetyCopy })
        $safety.Count | Should -Be 1
        $safety[0].Verified | Should -BeTrue
        $safety[0].Reason | Should -Be 'release'
        ([System.IO.File]::ReadAllText($safety[0].ManifestPath) | ConvertFrom-Json).release | Should -Be 'before-restore'
        # only the live database is left: the new one took its name, and the old one was dropped
        $names = (Invoke-AccucutRestoreSql -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Database 'postgres' -Sql "SELECT datname FROM pg_database WHERE datname LIKE 'accucut%' ORDER BY 1;") -split "`r?`n" | Where-Object { $_ }
        @($names) | Should -Be @('accucut')
        # the restored database is the owner's, with the migration history and the app role able to read it
        (Invoke-AccucutRestoreSql -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Database 'accucut' -Sql 'SELECT count(*) FROM _prisma_migrations;').Trim() | Should -Not -Be '0'
        (Invoke-AccucutRestoreSql -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Database 'accucut' -Sql "SELECT count(DISTINCT tableowner) || ':' || min(tableowner) FROM pg_tables WHERE schemaname = 'public';").Trim() | Should -Be '1:accucut_owner'
        (Invoke-AccucutRestoreSql -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Database 'accucut' -Sql "SELECT has_table_privilege('accucut_app', 'public.job_runs', 'INSERT');").Trim() | Should -Be 't'
        # the record outside the database: restore.log holds the run, and one Application event of this restore
        $logLines = @(Get-Content -LiteralPath $paths.RestoreLog)
        ($logLines -join "`n") | Should -Match 'Restore finished: the portal runs on the copy of'
        @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Accucut'; Id = 1100 } -ErrorAction SilentlyContinue).Count | Should -BeGreaterThan 0
        # AC-5: the key of this run is in no file under C:\Accucut (the code and its libraries aside) and none in the temp folders, except the one file that stage 13 made for it
        $hits = Find-TextInFiles -Text $keyLine -Root @($paths.Config, $paths.Logs, $paths.Backups, $paths.Services, [System.IO.Path]::GetTempPath(), $env:RUNNER_TEMP)
        $hits = @($hits | Where-Object { $_ -ne $env:ACCUCUT_AGE_KEY -and $_ -notlike "$($script:AgeFolder)*" })
        $hits.Count | Should -Be 0 -Because "found in: $($hits -join ', ')"
    }

    It 'R3: restores a copy that is one migration BEHIND the installed release, and migrates it forward as accucut_restore: afterwards the live _prisma_migrations matches the release' -Skip:(-not $script:RealInstall) {
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        $settings = Read-AccucutBackupSettings -Path $paths.BackupSettings
        $state = Read-AccucutInstallState -Path $paths.StateFile
        $release = [System.IO.Path]::Combine($paths.Releases, (Get-AccucutCurrentRelease -Paths $paths))
        $program = @{
            Age       = [System.IO.Path]::Combine($release, 'bin\age.exe')
            PgDump    = [System.IO.Path]::Combine($settings.PgBinDirectory, 'pg_dump.exe')
            PgRestore = [System.IO.Path]::Combine($settings.PgBinDirectory, 'pg_restore.exe')
            Psql      = [System.IO.Path]::Combine($settings.PgBinDirectory, 'psql.exe')
            Node      = $state.NodeExe
        }
        $releaseMigrations = [System.IO.Path]::Combine($release, 'migrate\prisma\migrations')
        $all = @([System.IO.Directory]::GetDirectories($releaseMigrations) | ForEach-Object { [System.IO.Path]::GetFileName($_) } | Sort-Object)
        $all.Count | Should -BeGreaterThan 1
        $newest = $all[$all.Count - 1]

        # An older release, made from the installed one: the same migrate folder (the Prisma CLI is linked, not copied) with the newest migration left out.
        $old = Join-Path $env:RUNNER_TEMP 'accucut-older-release'
        if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Recurse -Force }
        $oldMigrate = Join-Path $old 'migrate'
        New-Item -ItemType Directory -Path (Join-Path $oldMigrate 'prisma\migrations') -Force | Out-Null
        foreach ($name in $all) { if ($name -ne $newest) { Copy-Item -LiteralPath (Join-Path $releaseMigrations $name) -Destination (Join-Path $oldMigrate "prisma\migrations\$name") -Recurse } }
        foreach ($file in 'prisma\schema.prisma', 'prisma.config.mjs', 'ensure-seed-version.mjs') { Copy-Item -LiteralPath (Join-Path $release "migrate\$file") -Destination (Join-Path $oldMigrate $file) }
        & "$env:SystemRoot\System32\cmd.exe" /c mklink /J "$oldMigrate\node_modules" "$release\migrate\node_modules" | Out-Null
        Test-Path -LiteralPath (Join-Path $oldMigrate 'node_modules\prisma\build\index.js') | Should -BeTrue

        # A scratch database migrated to one migration behind, as accucut_restore, and a copy of it in the backups folder (an ordinary weekly copy, the newest one).
        $scratch = 'accucut_new_20200101000000'
        $password = Read-AccucutPgpassPassword -Path $paths.RestorePgpass -Role 'accucut_restore'
        try {
            New-AccucutRestoreDatabase -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Name $scratch
            [void](Invoke-AccucutMigration -ReleaseDirectory $old -NodeExe $state.NodeExe -MigrateDatabaseUrl "postgresql://accucut_restore:$([uri]::EscapeDataString($password))@$($settings.PgHost):$($settings.PgPort)/$scratch")
            $applied = (Invoke-AccucutRestoreSql -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Database $scratch -Sql 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;').Trim()
            [int]$applied | Should -Be ($all.Count - 1)
            $scratchSettings = [pscustomobject]@{ AgeRecipient = $settings.AgeRecipient; PgHost = $settings.PgHost; PgPort = $settings.PgPort; Database = $scratch; PgBinDirectory = $settings.PgBinDirectory }
            $made = Invoke-AccucutBackup -Paths $paths -Settings $scratchSettings -Program @{ PgDump = $program.PgDump; Psql = $program.Psql; Age = $program.Age } -Reason weekly -ReleaseTag 'one-migration-behind' -PassFile $paths.RestorePgpass -DatabaseRole 'accucut_restore'
        }
        finally {
            try { Remove-AccucutRestoreDatabase -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Name $scratch } catch { Write-Host "The scratch database could not be dropped: $($_.Exception.Message)" }
            if (Test-Path -LiteralPath (Join-Path $oldMigrate 'node_modules')) { [System.IO.Directory]::Delete((Join-Path $oldMigrate 'node_modules'), $false) }
            Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue
        }

        # Restore it: the newest copy of the list is the one just made.
        $first = @(Get-AccucutRestoreChoice -Directory $paths.Backups | Where-Object { $_.Copy.Verified } | Select-Object -First 1)
        $first[0].Copy.Name | Should -Be $made.Name
        $keyLine = (Get-Content -LiteralPath $env:ACCUCUT_AGE_KEY | Where-Object { $_ -like 'AGE-SECRET-*' } | Select-Object -First 1).Trim()
        $script:RealKey = ConvertTo-SecureString -String $keyLine -AsPlainText -Force
        $script:RealAnswers = [System.Collections.Queue]::new()
        $script:RealAnswers.Enqueue('1'); $script:RealAnswers.Enqueue($first[0].Copy.CreatedUtc.ToString('yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture))
        Mock Read-AccucutHostInput -ModuleName AccucutOps { return [string]$script:RealAnswers.Dequeue() }
        Mock Read-AccucutKeyInput -ModuleName AccucutOps { return $script:RealKey }
        $result = Invoke-AccucutRestore -Paths $paths -Settings $settings -Program $program -ReleaseDirectory $release -HealthUrl "http://127.0.0.1:$($state.Port)/api/health" -HealthTimeoutSeconds 240

        $result.Restored | Should -BeTrue
        foreach ($name in (Get-AccucutServiceNames)) { (Get-Service -Name $name).Status | Should -Be 'Running' }
        # The live database now has every migration of the release, applied by the forward migration as accucut_restore, and all its tables belong to the owner.
        $live = @((Invoke-AccucutRestoreSql -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Database 'accucut' -Sql 'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1;') -split "`r?`n" | Where-Object { $_.Trim() } | ForEach-Object { $_.Trim() })
        $live | Should -Be $all
        (Invoke-AccucutRestoreSql -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Database 'accucut' -Sql "SELECT count(DISTINCT tableowner) || ':' || min(tableowner) FROM pg_tables WHERE schemaname = 'public';").Trim() | Should -Be '1:accucut_owner'
        (Invoke-AccucutRestoreSql -PsqlPath $program.Psql -Settings $settings -PassFile $paths.RestorePgpass -Database 'accucut' -Sql "SELECT has_table_privilege('accucut_app', 'public.job_runs', 'INSERT');").Trim() | Should -Be 't'
        Get-AccucutHttpStatus -Url "http://127.0.0.1:$($state.Port)/api/health" | Should -Be 200
    }
}

Describe 'Get-AccucutRunningAccount (ADR-015 Amendment 3.4)' {
    It 'returns the account that Windows says is running this script' {
        $account = Get-AccucutRunningAccount
        $account | Should -Be ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
        $account | Should -Not -BeNullOrEmpty
        $account | Should -Not -Be 'unknown account'
    }

    It 'returns "unknown account" when the identity call throws, and never throws itself' {
        { Get-AccucutRunningAccount -Source { throw 'no identity here' } } | Should -Not -Throw
        Get-AccucutRunningAccount -Source { throw 'no identity here' } | Should -Be 'unknown account'
    }

    It 'returns "unknown account" when Windows gives an empty name' {
        Get-AccucutRunningAccount -Source { '' } | Should -Be 'unknown account'
        Get-AccucutRunningAccount -Source { $null } | Should -Be 'unknown account'
    }
}

Describe 'Write-AccucutRestoreEvent names the account (ADR-015 Amendment 3.4)' {
    BeforeEach {
        $script:Written = [System.Collections.Generic.List[string]]::new()
        Mock Get-AccucutRunningAccount -ModuleName AccucutOps { 'TESTSRV\admin.test' }
        Mock Write-AccucutApplicationEvent -ModuleName AccucutOps { $script:Written.Add("$EntryType|$EventId|$Text") }
    }

    It 'ends the text of the event with " Run by the account." and keeps the type and the number' {
        Write-AccucutRestoreEvent -EntryType Information -EventId 1100 -Message 'Restore finished.'
        $script:Written.Count | Should -Be 1
        $script:Written[0] | Should -Be 'Information|1100|Restore finished. Run by TESTSRV\admin.test.'
    }

    It 'cuts a long message before the ending, so the text is 1000 characters and still ends with the account' {
        Write-AccucutRestoreEvent -EntryType Error -EventId 1111 -Message ('x' * 3000)
        $text = ($script:Written[0] -split '\|', 3)[2]
        $text.Length | Should -Be 1000
        $text.EndsWith(' Run by TESTSRV\admin.test.') | Should -BeTrue
        $text.StartsWith('xxxx') | Should -BeTrue
    }

    It 'says "unknown account" when the account could not be read' {
        Mock Get-AccucutRunningAccount -ModuleName AccucutOps { 'unknown account' }
        Write-AccucutRestoreEvent -EntryType Information -EventId 1101 -Message 'Stopped.'
        $script:Written[0] | Should -Be 'Information|1101|Stopped. Run by unknown account.'
    }
}

Describe 'the JEA wrapper is gone, and the restore keeps its controls (ADR-015 Amendment 3.4)' {
    It 'creates no group, endpoint, shortcut or jea folder: none of their functions, paths or files exist' {
        $names = @((Get-Module AccucutOps).ExportedFunctions.Keys)
        foreach ($name in 'Resolve-AccucutAdminAccount', 'Get-AccucutAdminGroupMember', 'New-AccucutAdminGroup', 'Add-AccucutFileReadAccess', 'New-AccucutAdminFolder', 'Grant-AccucutServiceControl',
            'Grant-AccucutAdminEndpointAccess', 'New-AccucutAdminEndpointFiles', 'Register-AccucutPSSessionConfiguration', 'Register-AccucutAdminEndpoint', 'Unregister-AccucutAdminEndpoint') {
            $names | Should -Not -Contain $name
        }
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        $paths.PSObject.Properties.Name | Should -Not -Contain 'JeaConfig'
        $paths.PSObject.Properties.Name | Should -Not -Contain 'JeaLogs'
        Test-Path -LiteralPath (Join-Path $script:WindowsDirectory 'jea') | Should -BeFalse
        Test-Path -LiteralPath (Join-Path $script:WindowsDirectory 'manual\AC-8-jea-prompt-check.md') | Should -BeFalse
        Test-Path -LiteralPath (Join-Path $script:WindowsDirectory 'tests\Jea.Tests.ps1') | Should -BeFalse
    }

    It 'keeps the inert group look-up, which finds no group on a server where no install made one' {
        $names = @((Get-Module AccucutOps).ExportedFunctions.Keys)
        $names | Should -Contain 'Get-AccucutAdminGroupSid'
        Get-AccucutAdminGroupSid | Should -BeNullOrEmpty
    }

    It 'writes restore.pgpass for Administrators and SYSTEM only (two entries, protected, owned by Administrators)' -Skip:(-not $script:IsAdmin) {
        $root = Join-Path $TestDrive 'pgpass-two'
        $paths = Get-AccucutPaths -Root $root
        New-Item -ItemType Directory -Path $paths.Config -Force | Out-Null
        Write-AccucutRestoreConfig -Paths $paths -RestorePassword 'FAKErestorePassword0001' -PgHost '127.0.0.1' -PgPort 5432
        $security = [System.IO.File]::GetAccessControl($paths.RestorePgpass)
        $security.AreAccessRulesProtected | Should -BeTrue
        $security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value | Should -Be 'S-1-5-32-544'
        $entries = @($security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { '{0}|0x{1:X}|{2}' -f $_.IdentityReference.Value, [int]$_.FileSystemRights, $_.AccessControlType } | Sort-Object)
        ($entries -join ';') | Should -Be ((@('S-1-5-32-544|0x1F01FF|Allow', 'S-1-5-18|0x1F01FF|Allow') | Sort-Object) -join ';')
    }
}

Describe 'SQR-04 (#516): psql never receives a byte order mark in front of the restore''s SQL (ADR-015 Amendment 3.4)' {
    It 'in a console whose input encoding is UTF-8 with a byte order mark, the first bytes that psql reads are the two dashes of "-- accucut restore"' {
        # The probe runs in a child powershell.exe in a console of its own (hidden), so the case never depends on whether this session has a console: setting the input
        # encoding of a console needs one. The stand-in psql is the fake pg_restore of this file, which keeps every byte of its standard input.
        $folder = Join-Path $TestDrive 'sqr04'
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        $probe = Join-Path $folder 'probe.ps1'
        $keptInput = Join-Path $folder 'psql-input.bin'
        $done = Join-Path $folder 'done.txt'
        $module = Join-Path $script:WindowsDirectory 'AccucutOps.psm1'
        $lines = @(
            '$ErrorActionPreference = ''Stop'''
            'try {'
            ('    Import-Module -Name ''' + $module + ''' -Force -DisableNameChecking')
            '    [Console]::InputEncoding = New-Object System.Text.UTF8Encoding($true)'
            '    if (-not ([Console]::InputEncoding.GetPreamble().Length -eq 3)) { throw ''The console input encoding could not be set to UTF-8 with a byte order mark.'' }'
            ('    $env:FAKE_RESTORE_OUT = ''' + $keptInput + '''')
            '    Remove-Item Env:\FAKE_RESTORE_EXIT -ErrorAction SilentlyContinue'
            '    Remove-Item Env:\FAKE_RESTORE_LOG -ErrorAction SilentlyContinue'
            '    $settings = [pscustomobject]@{ PgHost = ''127.0.0.1''; PgPort = 5432 }'
            ('    [void](Invoke-AccucutRestoreSql -PsqlPath ''' + $script:FakePgRestore + ''' -Settings $settings -PassFile ''C:\fake\restore.pgpass'' -Database ''postgres'' -Sql ''SELECT 1;'')')
            ('    [System.IO.File]::WriteAllText(''' + $done + ''', ''done'')')
            '}'
            'catch {'
            ('    [System.IO.File]::WriteAllText(''' + $done + ''', (''failed: '' + $_.Exception.Message))')
            '}'
        )
        [System.IO.File]::WriteAllText($probe, ($lines -join ([string][char]13 + [char]10)))
        $powershell = [System.IO.Path]::Combine($env:SystemRoot, 'System32\WindowsPowerShell\v1.0\powershell.exe')
        $process = Start-Process -FilePath $powershell -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $probe + '"')) -WindowStyle Hidden -PassThru
        if (-not $process.WaitForExit(120000)) { try { $process.Kill() } catch { Write-Verbose 'The probe had already ended.' }; throw 'The SQR-04 probe did not finish in 120 seconds.' }
        (Get-Content -LiteralPath $done -Raw) | Should -Be 'done'
        $bytes = [System.IO.File]::ReadAllBytes($keptInput)
        $bytes.Length | Should -BeGreaterThan 20
        [System.BitConverter]::ToString($bytes, 0, 2) | Should -Be '2D-2D' -Because 'psql must read "--" first, not EF BB BF'
        [System.Text.Encoding]::ASCII.GetString($bytes, 0, 17) | Should -Be '-- accucut restor'
    }

    It 'Invoke-AccucutNative with -StdIn starts the process under the console-input guard, and puts the encoding back' {
        $body = (Get-Command Invoke-AccucutNative -Module AccucutOps).ScriptBlock.ToString()
        $body | Should -Match 'Set-AccucutConsoleInputNoPreamble'
        $body | Should -Match 'Restore-AccucutConsoleInput'
        $body.IndexOf('Set-AccucutConsoleInputNoPreamble') | Should -BeLessThan $body.IndexOf('$process.Start()')
        $body.IndexOf('$process.Start()') | Should -BeLessThan $body.IndexOf('Restore-AccucutConsoleInput')
    }
}
