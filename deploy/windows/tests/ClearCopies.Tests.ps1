#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of clear-copies.ps1 and Clear-AccucutCopies (STORY-10.05 AC-6, AC-8; ADR-015 Amendments 2, 2.1 and 3; architecture section 9.5). Run by CI stage 13
  on windows-latest. Every prompt is answered by a mock; the copies are small files under TestDrive; the job_runs write is a mock. The real script on the real
  install (answers on standard input) is exercised by stage 13 (deploy/windows/ci/exercise-backup.ps1). Every value is invented.
#>

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    # Dot-sourcing defines the functions (the trust block and the helpers) and does not run the script.
    . (Join-Path $script:WindowsDirectory 'clear-copies.ps1')

    $script:Admins = 'S-1-5-32-544'
    $script:System = 'S-1-5-18'
    $script:Users = 'S-1-5-32-545'
    $script:OtherUser = 'S-1-5-21-1111111111-2222222222-3333333333-1001'
    $script:BackupSid = 'S-1-5-21-1111111111-2222222222-3333333333-1005'
    $script:Fake = @{}

    function New-FakeAce {
        param([string]$Sid, [int]$Mask, [switch]$Inherit)
        return [pscustomobject]@{ Sid = $Sid; Mask = $Mask; Inherit = $Inherit.IsPresent }
    }
    function New-FakeSecurity {
        param([Parameter(Mandatory)][string]$Path, [string]$Owner = 'S-1-5-32-544', [object[]]$Ace = @(), [switch]$NotProtected, [switch]$Link, [switch]$File)
        $ownerSid = [System.Security.Principal.SecurityIdentifier]::new($Owner)
        $acl = [System.Security.AccessControl.RawAcl]::new(2, 0)
        $position = 0
        foreach ($entry in $Ace) {
            $aceFlags = 0
            if ($entry.Inherit) { $aceFlags += 3 }
            $common = [System.Security.AccessControl.CommonAce]::new([System.Security.AccessControl.AceFlags]$aceFlags, [System.Security.AccessControl.AceQualifier]::AccessAllowed, [int]$entry.Mask, [System.Security.Principal.SecurityIdentifier]::new($entry.Sid), $false, $null)
            $acl.InsertAce($position, $common)
            $position++
        }
        $flags = [System.Security.AccessControl.ControlFlags]'DiscretionaryAclPresent, DiscretionaryAclProtected'
        if ($NotProtected) { $flags = [System.Security.AccessControl.ControlFlags]'DiscretionaryAclPresent' }
        $descriptor = [System.Security.AccessControl.RawSecurityDescriptor]::new($flags, $ownerSid, $ownerSid, $null, $acl)
        $attributes = [int][System.IO.FileAttributes]::Directory
        if ($File) { $attributes = [int][System.IO.FileAttributes]::Archive }
        if ($Link) { $attributes = $attributes + [int][System.IO.FileAttributes]::ReparsePoint }
        return (ConvertFrom-AccucutTrustDescriptor -Descriptor $descriptor -Path $Path -Attributes ([System.IO.FileAttributes]$attributes))
    }
    function Set-FakeSecurity {
        param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][object]$Security)
        $script:Fake[$Path.TrimEnd('\').ToLowerInvariant()] = $Security
    }
    function New-FullControl { return @((New-FakeAce -Sid $script:Admins -Mask 0x1F01FF -Inherit), (New-FakeAce -Sid $script:System -Mask 0x1F01FF -Inherit)) }
}

Describe 'clear-copies.ps1 runs only from the installed release (ADR-015 Amendment 3)' {
    It 'works out the root from <root>\current\clear-copies.ps1 and from <root>\releases\<tag>\clear-copies.ps1 (<Path>)' -ForEach @(
        @{ Path = 'C:\Accucut\current\clear-copies.ps1'; Root = 'C:\Accucut' }
        @{ Path = 'D:\Acc-ucut_1\releases\1.2.3-abcdef0\clear-copies.ps1'; Root = 'D:\Acc-ucut_1' }
    ) {
        Get-AccucutScriptInstallRoot -ScriptPath $Path -Name 'clear-copies.ps1' | Should -Be $Root
    }

    It 'refuses a script from anywhere else (<Path>)' -ForEach @(
        @{ Path = 'C:\Program Files\accucut-pkg\clear-copies.ps1' }
        @{ Path = 'C:\Accucut\clear-copies.ps1' }
        @{ Path = 'C:\Accucut\current\backup.ps1' }
        @{ Path = 'C:\a\b\current\clear-copies.ps1' }
        @{ Path = '\\server\share\Accucut\current\clear-copies.ps1' }
    ) {
        { Get-AccucutScriptInstallRoot -ScriptPath $Path -Name 'clear-copies.ps1' } | Should -Throw '*Run the installed clear-copies.ps1 only*'
    }

    It 'takes no argument at all, so nothing on the command line can change what it deletes' {
        $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $script:WindowsDirectory 'clear-copies.ps1'), [ref]$null, [ref]$null)
        @($ast.ParamBlock.Parameters).Count | Should -Be 0
    }
}

Describe 'the checks of clear-copies.ps1 come before the module, the questions and the deletes' {
    BeforeEach {
        $script:Trace = [System.Collections.Generic.List[string]]::new()
        $script:Settings = [pscustomobject]@{ AgeRecipient = ('age1' + ('q' * 58)); PgHost = '127.0.0.1'; PgPort = 5432; Database = 'accucut'; PgBinDirectory = 'C:\Program Files\PostgreSQL\17\bin' }
        Mock Assert-AccucutTrustedRootShape { $script:Trace.Add("shape:$Root") }
        Mock Get-AccucutTrustedCurrent { $script:Trace.Add('current'); return 'C:\Accucut\releases\t1' }
        Mock Assert-AccucutTrustedPath { $script:Trace.Add("path:$Path") }
        Mock Import-AccucutTrustedModule { $script:Trace.Add('import') }
        Mock Get-AccucutBackupAccountSid { $script:Trace.Add('sid'); return $script:BackupSid }
        Mock Read-AccucutBackupSettings { $script:Trace.Add("settings:$Path"); return $script:Settings }
        Mock Assert-AccucutBackupFolderTrusted { $script:Trace.Add("folder:$Directory|$BackupSid") }
        Mock Resolve-AccucutTrustedExecutable { $script:Trace.Add("program:$Path"); return $Path }
        Mock Clear-AccucutCopies { $script:Trace.Add("clear:$PsqlPath") }
    }

    It 'checks the root, the release and the script, loads the module, then checks the settings files, the backups folder and psql, and only then asks the Admin anything' {
        Invoke-AccucutClearScript -ScriptPath 'C:\Accucut\current\clear-copies.ps1'
        $expected = @(
            'shape:C:\Accucut', 'current', 'path:C:\Accucut\releases\t1', 'path:C:\Accucut\releases\t1\clear-copies.ps1', 'import', 'sid',
            'path:C:\Accucut\config\backup-settings.json', 'path:C:\Accucut\config\backup.pgpass', 'settings:C:\Accucut\config\backup-settings.json',
            "folder:C:\Accucut\backups|$($script:BackupSid)", 'program:C:\Program Files\PostgreSQL\17\bin\psql.exe', 'clear:C:\Program Files\PostgreSQL\17\bin\psql.exe'
        )
        (@($script:Trace) -join "`n") | Should -Be ($expected -join "`n")
    }

    It 'stops before the module, the questions and the deletes, naming the reason, when a check fails: <Case>' -ForEach @(
        @{ Case = 'the script is not the running release'; Message = '*not the clear-copies.ps1 of the running release*'; Imported = 0 }
        @{ Case = 'the release folder fails the trust check'; Message = '*can be changed by S-1-5-32-545*'; Imported = 0 }
        @{ Case = 'the backups folder has an extra writer'; Message = '*backups*can be changed*'; Imported = 1 }
        @{ Case = 'psql fails the trust check'; Message = '*psql.exe*can be changed*'; Imported = 1 }
        @{ Case = 'a settings file fails the trust check'; Message = '*backup-settings.json*can be changed*'; Imported = 1 }
    ) {
        $scriptPath = 'C:\Accucut\current\clear-copies.ps1'
        switch ($Case) {
            'the script is not the running release' { $scriptPath = 'C:\Accucut\releases\other\clear-copies.ps1' }
            'the release folder fails the trust check' { Mock Assert-AccucutTrustedPath { throw "'$Path' can be changed by S-1-5-32-545" } }
            'the backups folder has an extra writer' { Mock Assert-AccucutBackupFolderTrusted { throw "'$Directory' can be changed by S-1-5-32-545" } }
            'psql fails the trust check' { Mock Resolve-AccucutTrustedExecutable { throw "'$Path' can be changed by S-1-5-32-545" } }
            'a settings file fails the trust check' { Mock Assert-AccucutTrustedPath { if ($Path -like '*backup-settings.json') { throw "'$Path' can be changed by S-1-5-32-545" } } }
        }
        { Invoke-AccucutClearScript -ScriptPath $scriptPath } | Should -Throw $Message
        Should -Invoke Clear-AccucutCopies -Times 0 -Exactly
        Should -Invoke Import-AccucutTrustedModule -Times $Imported -Exactly
    }
}

Describe 'a replaced module is never loaded by clear-copies.ps1 (ADR-015 Amendment 2, test 5)' {
    BeforeEach {
        $script:Fake = @{}
        $script:Release = Join-Path $TestDrive ('rel-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path $script:Release -Force | Out-Null
        $script:Marker = Join-Path $TestDrive ('marker-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.txt')
        $script:ModuleFile = Join-Path $script:Release 'AccucutOps.psm1'
        [System.IO.File]::WriteAllText($script:ModuleFile, "[System.IO.File]::WriteAllText('$($script:Marker)', 'loaded')`nthrow 'the tampered module was loaded'`n")
        Mock Get-AccucutScriptInstallRoot { $TestDrive }
        Mock Get-AccucutTrustedCurrent { $script:Release }
        Mock Assert-AccucutTrustedRootShape { }
        Mock Get-AccucutTrustSecurity {
            $key = $Path.TrimEnd('\').ToLowerInvariant()
            if ($script:Fake.ContainsKey($key)) { return $script:Fake[$key] }
            return (New-FakeSecurity -Path $Path -Ace (New-FullControl))
        }
        Mock Clear-AccucutCopies { }
        $script:AccucutTrustLog.Clear()
    }

    It 'does not load a module that the Users group can change: its code does not run, nothing is asked and nothing is deleted' {
        Set-FakeSecurity $script:ModuleFile (New-FakeSecurity -Path $script:ModuleFile -Ace ((New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1301BF))) -NotProtected -File)
        { Invoke-AccucutClearScript -ScriptPath (Join-Path $TestDrive 'current\clear-copies.ps1') } | Should -Throw '*can be changed by S-1-5-32-545*'
        Test-Path -LiteralPath $script:Marker | Should -BeFalse
        $script:AccucutTrustLog | Should -Not -Contain "load:$($script:ModuleFile)"
        Should -Invoke Clear-AccucutCopies -Times 0 -Exactly
    }

    It 'does not load a module whose release folder is a link' {
        Set-FakeSecurity $script:Release (New-FakeSecurity -Path $script:Release -Ace (New-FullControl) -NotProtected -Link)
        { Invoke-AccucutClearScript -ScriptPath (Join-Path $TestDrive 'current\clear-copies.ps1') } | Should -Throw '*is a link*'
        Test-Path -LiteralPath $script:Marker | Should -BeFalse
        Should -Invoke Clear-AccucutCopies -Times 0 -Exactly
    }
}

Describe 'the guided clear: it lists, keeps the newest 4, asks for a typed date, shows the space it frees, and removes oldest first (AC-6)' {
    BeforeAll {
        function New-FakeCopy {
            param([string]$Directory, [string]$Stamp, [string]$Reason = 'weekly', [int]$Size = 100, [switch]$NoManifest)
            $base = "accucut-$Stamp-$Reason"
            [System.IO.File]::WriteAllBytes((Join-Path $Directory "$base.age"), (New-Object byte[] $Size))
            if (-not $NoManifest) {
                $time = [datetime]::ParseExact($Stamp, 'yyyyMMdd-HHmmss', [cultureinfo]::InvariantCulture, [System.Globalization.DateTimeStyles]'AssumeUniversal, AdjustToUniversal')
                $manifest = [ordered]@{ file = "$base.age"; reason = $Reason; createdAtUtc = $time.ToString('o'); sizeBytes = $Size; sha256 = ('a' * 64) }
                [System.IO.File]::WriteAllText((Join-Path $Directory "$base.manifest.json"), ($manifest | ConvertTo-Json))
            }
        }
        # Eight copies: the oldest four may go, the newest four are always kept. Sizes 101 to 108 bytes, oldest to newest.
        $script:Stamps = '20260105-020000', '20260112-020000', '20260119-020000', '20260126-020000', '20260202-020000', '20260209-020000', '20260216-020000', '20260223-020000'
    }

    BeforeEach {
        $root = Join-Path $TestDrive ('clear-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        $script:Paths = Get-AccucutPaths -Root $root
        New-Item -ItemType Directory -Path $script:Paths.Backups -Force | Out-Null
        $size = 100
        foreach ($stamp in $script:Stamps) { $size++; New-FakeCopy -Directory $script:Paths.Backups -Stamp $stamp -Size $size }
        $script:Settings = [pscustomobject]@{ AgeRecipient = ('age1' + ('q' * 58)); PgHost = '127.0.0.1'; PgPort = 5432; Database = 'accucut'; PgBinDirectory = 'C:\pg\bin' }
        $script:Rows = [System.Collections.Generic.List[object]]::new()
        $script:Output = [System.Collections.Generic.List[string]]::new()
        $script:Prompts = [System.Collections.Generic.List[string]]::new()
        $script:Answers = [System.Collections.Generic.List[string]]::new()
        $script:Space = [pscustomobject]@{ TotalBytes = [int64]100GB; FreeBytes = [int64]20GB }
        Mock Read-AccucutHostInput -ModuleName AccucutOps {
            $script:Prompts.Add($Prompt)
            if ($script:Answers.Count -eq 0) { throw "an unexpected question was asked: $Prompt" }
            $answer = $script:Answers[0]
            $script:Answers.RemoveAt(0)
            return $answer
        }
        Mock Get-AccucutVolumeSpace -ModuleName AccucutOps { $script:Space }
        Mock Add-AccucutJobRun -ModuleName AccucutOps { $script:Rows.Add([pscustomobject]@{ Job = $Job; Started = $StartedUtc; Finished = $FinishedUtc; Result = $Result; PassFile = $PassFile }) }
        Mock Write-Host -ModuleName AccucutOps { $script:Output.Add([string]$Object) }
        function Invoke-Clear { return (Clear-AccucutCopies -Paths $script:Paths -Settings $script:Settings -PsqlPath 'C:\pg\bin\psql.exe') }
        function Get-Remaining { return @(Get-AccucutBackupCopy -Directory $script:Paths.Backups | ForEach-Object { $_.CreatedUtc.ToString('yyyyMMdd') }) }
    }

    It 'lists the copies oldest first with date, kind and size, marks the newest 4 as always kept, and shows the free space' {
        $script:Answers.Add('')
        [void](Invoke-Clear)
        $text = $script:Output -join "`n"
        $lines = @($script:Output | Where-Object { $_ -match '^\s+\d+\s+2026-' })
        $lines.Count | Should -Be 8
        $lines[0] | Should -BeLike '*2026-01-05 02:00*weekly*'
        $lines[7] | Should -BeLike '*2026-02-23 02:00*weekly*KEEP*'
        @($lines | Where-Object { $_ -like '*KEEP*' }).Count | Should -Be 4
        @($lines | Select-Object -First 4 | Where-Object { $_ -like '*KEEP*' }).Count | Should -Be 0
        $text | Should -BeLike '*Free space now: 20.00 GB of 100.00 GB (20 %)*'
        $text | Should -BeLike '*dates are UTC*'
        $script:Prompts[0] | Should -BeLike 'Type the date (YYYY-MM-DD) of the NEWEST copy to remove*'
    }

    It 'suggests how many of the oldest copies bring the free space above 30 %, as a hint only' {
        $script:Space = [pscustomobject]@{ TotalBytes = [int64]1000; FreeBytes = [int64]250 }
        $script:Answers.Add('')
        [void](Invoke-Clear)
        ($script:Output -join "`n") | Should -BeLike '*To get back above 30 % free, about*of the oldest copies would have to go*'
    }

    It 'removes nothing when the date is not the date of a copy that may be removed (a date in the newest 4, a date with no copy, text, a wrong format, nothing)' {
        foreach ($answer in '2026-02-23', '2026-02-02', '1999-01-01', 'yesterday', '2026-13-45', '26-01-05', '20260105', '') {
            $script:Answers.Clear()
            $script:Output.Clear()
            $script:Answers.Add($answer)
            $result = Invoke-Clear
            $result.Removed | Should -Be 0
            (Get-Remaining).Count | Should -Be 8 -Because "the answer '$answer' removes nothing"
            ($script:Output -join "`n") | Should -BeLike '*nothing was removed*'
        }
        $script:Rows.Count | Should -Be 0
    }

    It 'removes nothing when the date is right but the Admin does not type YES (anything else, including lower case)' {
        foreach ($confirm in 'yes', 'y', 'Yes', 'NO', '', 'YES ') {
            $script:Answers.Clear()
            $script:Answers.Add('2026-01-19')
            $script:Answers.Add($confirm)
            $result = Invoke-Clear
            $result.Removed | Should -Be 0 -Because "the answer '$confirm' is not YES"
            (Get-Remaining).Count | Should -Be 8
        }
        $script:Rows.Count | Should -Be 0
    }

    It 'with the right date and YES, removes every removable copy up to that date, oldest first, with its manifest, keeps the rest, and writes one backup-clear row' {
        $script:Answers.Add('2026-01-19')
        $script:Answers.Add('YES')
        $result = Invoke-Clear
        $result.Removed | Should -Be 3
        $result.FreedBytes | Should -BeGreaterThan 300
        (Get-Remaining) | Should -Be @('20260126', '20260202', '20260209', '20260216', '20260223')
        foreach ($stamp in $script:Stamps[0..2]) {
            Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$stamp-weekly.age") | Should -BeFalse
            Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$stamp-weekly.manifest.json") | Should -BeFalse
        }
        ($script:Output -join "`n") | Should -BeLike '*This removes 3 copies, from 2026-01-05 to 2026-01-19, and frees about*A copy that is removed cannot be restored*'
        $script:Rows.Count | Should -Be 1
        $row = $script:Rows[0]
        $row.Job | Should -Be 'backup-clear'
        $row.PassFile | Should -Be $script:Paths.BackupPgpass
        $row.Result.status | Should -Be 'ok'
        $row.Result.removed | Should -Be 3
        # The figure is what the three copies and their manifests held: more than the three copies alone (101 + 102 + 103 bytes), and the same as the result says.
        $row.Result.sizeBytes | Should -BeGreaterThan 306
        $row.Result.sizeBytes | Should -Be $result.FreedBytes
        $row.Result.dates | Should -Be @('2026-01-05', '2026-01-12', '2026-01-19')
        $row.Result.freeBytes | Should -Be $script:Space.FreeBytes
        $row.Result.totalBytes | Should -Be $script:Space.TotalBytes
        $row.Finished | Should -BeGreaterOrEqual $row.Started
    }

    It 'with the date of the newest removable copy, removes all of them and leaves exactly the newest 4 (the Admin can never remove one of the newest 4)' {
        $script:Answers.Add('2026-01-26')
        $script:Answers.Add('YES')
        $result = Invoke-Clear
        $result.Removed | Should -Be 4
        (Get-Remaining) | Should -Be @('20260202', '20260209', '20260216', '20260223')
        # Asked again with nothing removable left, it says so and asks nothing.
        $script:Prompts.Clear()
        $script:Output.Clear()
        $again = Invoke-Clear
        $again.Removed | Should -Be 0
        $script:Prompts.Count | Should -Be 0
        ($script:Output -join "`n") | Should -BeLike '*Nothing can be removed: only the newest 4 copies are left*call your IT person*'
    }

    It 'removes copies oldest first, and stops at the first one it cannot remove, writing a failed row that says how far it got' {
        $script:Order = [System.Collections.Generic.List[string]]::new()
        Mock Remove-AccucutBackupCopy -ModuleName AccucutOps {
            $script:Order.Add($Name)
            if ($script:Order.Count -eq 3) { throw "'$Name' was not deleted: it is in use." }
            return [int64]1000
        }
        $script:Answers.Add('2026-01-26')
        $script:Answers.Add('YES')
        { Invoke-Clear } | Should -Throw '*The clear stopped part way*in use*'
        $script:Order | Should -Be @('accucut-20260105-020000-weekly.age', 'accucut-20260112-020000-weekly.age', 'accucut-20260119-020000-weekly.age')
        $script:Rows.Count | Should -Be 1
        $script:Rows[0].Result.status | Should -Be 'failed'
        $script:Rows[0].Result.removed | Should -Be 2
        $script:Rows[0].Result.sizeBytes | Should -Be 2000
        $script:Rows[0].Result.message | Should -BeLike '*in use*'
    }

    It 'leaves alone everything that is not provably the backup''s own: a copy with no manifest, a manifest that disagrees, a note, a file in a sub-folder, a file behind a link' {
        $unverifiedOld = '20250101-020000'
        New-FakeCopy -Directory $script:Paths.Backups -Stamp $unverifiedOld -NoManifest
        New-FakeCopy -Directory $script:Paths.Backups -Stamp '20250108-020000' -Size 100
        $badManifest = Join-Path $script:Paths.Backups 'accucut-20250108-020000-weekly.manifest.json'
        [System.IO.File]::WriteAllText($badManifest, (([System.IO.File]::ReadAllText($badManifest) | ConvertFrom-Json | ForEach-Object { $_.sha256 = 'not a hash'; $_ }) | ConvertTo-Json))
        $note = Join-Path $script:Paths.Backups 'notes.txt'
        [System.IO.File]::WriteAllText($note, 'x')
        $sub = Join-Path $script:Paths.Backups 'sub'
        New-Item -ItemType Directory -Path $sub | Out-Null
        New-FakeCopy -Directory $sub -Stamp '20250115-020000'
        $outside = Join-Path $TestDrive ('outside-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path $outside | Out-Null
        New-FakeCopy -Directory $outside -Stamp '20250122-020000'
        $junction = Join-Path $script:Paths.Backups 'linked'
        New-Item -ItemType Junction -Path $junction -Target $outside | Out-Null
        try {
            $script:Answers.Add('2026-01-26')
            $script:Answers.Add('YES')
            $result = Invoke-Clear
            $result.Removed | Should -Be 4
            Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$unverifiedOld-weekly.age") | Should -BeTrue
            Test-Path -LiteralPath (Join-Path $script:Paths.Backups 'accucut-20250108-020000-weekly.age') | Should -BeTrue
            Test-Path -LiteralPath $note | Should -BeTrue
            Test-Path -LiteralPath (Join-Path $sub 'accucut-20250115-020000-weekly.age') | Should -BeTrue
            Test-Path -LiteralPath (Join-Path $outside 'accucut-20250122-020000-weekly.age') | Should -BeTrue
            Test-Path -LiteralPath (Join-Path $outside 'accucut-20250122-020000-weekly.manifest.json') | Should -BeTrue
            # The two copies that cannot be proved are listed as kept, with the reason.
            ($script:Output -join "`n") | Should -BeLike '*KEEP (not removable: it has no manifest)*'
            ($script:Output -join "`n") | Should -BeLike '*KEEP (not removable: its manifest has no valid SHA-256)*'
        }
        finally { [System.IO.Directory]::Delete($junction, $false) }
    }

    It 'says plainly, and asks nothing, when only the newest 4 copies exist (the disk is too small for the data)' {
        foreach ($stamp in $script:Stamps[0..3]) {
            Remove-Item -LiteralPath (Join-Path $script:Paths.Backups "accucut-$stamp-weekly.age") -Force
            Remove-Item -LiteralPath (Join-Path $script:Paths.Backups "accucut-$stamp-weekly.manifest.json") -Force
        }
        $result = Invoke-Clear
        $result.Removed | Should -Be 0
        $script:Prompts.Count | Should -Be 0
        ($script:Output -join "`n") | Should -BeLike '*Nothing can be removed*the disk is too small for the data*'
    }

    It 'writes no path, no file name and no figure from inside a copy into the row: only counts, dates, sizes and the free space' {
        $script:Answers.Add('2026-01-12')
        $script:Answers.Add('YES')
        [void](Invoke-Clear)
        $json = $script:Rows[0].Result | ConvertTo-Json -Depth 4
        $json | Should -Not -BeLike '*accucut-2026*'
        $json | Should -Not -BeLike "*$($script:Paths.Backups.Replace('\', '\\'))*"
        @($script:Rows[0].Result.Keys | Sort-Object) | Should -Be @('dates', 'freeBytes', 'removed', 'sizeBytes', 'status', 'totalBytes')
    }
}

Describe 'the clear deletes only through Remove-AccucutBackupCopy, which proves again before each delete (static checks)' {
    It 'Clear-AccucutCopies has no other delete, no recursion and no wildcard; the only delete in the backup functions is in Remove-AccucutBackupCopy, Remove-AccucutStaleBackupPart and the manifest clean-up of a failed rename' {
        $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Raw
        $start = $text.IndexOf('function Clear-AccucutCopies {')
        $body = $text.Substring($start, $text.IndexOf('#endregion', $start) - $start)
        $body | Should -Not -Match 'Remove-Item|File\]::Delete|Directory\]::Delete|-Recurse|rd /s'
        $body | Should -Match 'Remove-AccucutBackupCopy -Directory \$directory -Name \$copy\.Name'
        $region = $text.Substring($text.IndexOf('#region Backups'))
        ([regex]::Matches($region, '\[System\.IO\.File\]::Delete')).Count | Should -Be 5
        $region | Should -Not -Match 'Remove-Item|Directory\]::Delete|-Recurse|GetFiles\([^)]*,\s*[^)]*SearchOption|EnumerateFiles|Get-ChildItem'
    }
}
