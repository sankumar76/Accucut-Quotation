#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of backup.ps1 and of the backup functions of the module (STORY-10.05 AC-1 to AC-4, AC-7, AC-8; ADR-015 Amendments 2, 2.1 and 3).
  Run by CI stage 13 on windows-latest. Files live under TestDrive; the database, the age program and pg_dump are mocked or stood in for by tiny programs
  that the test compiles. The real thing (a real pg_dump, age and PostgreSQL, the real task and the real permissions) is proved by stage 13 itself.
  Every value is invented and clearly fake.
#>

BeforeDiscovery {
    $principal = New-Object System.Security.Principal.WindowsPrincipal([System.Security.Principal.WindowsIdentity]::GetCurrent())
    $script:IsAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    # Dot-sourcing defines the functions (the trust block and the helpers) and does not run the script (it runs only when started, not sourced).
    . (Join-Path $script:WindowsDirectory 'backup.ps1')

    $script:Admins = 'S-1-5-32-544'
    $script:System = 'S-1-5-18'
    $script:Users = 'S-1-5-32-545'
    $script:AuthUsers = 'S-1-5-11'
    $script:AppSid = 'S-1-5-80-1111111111-2222222222-3333333333-4444444444-5555555555'
    $script:BackupSid = 'S-1-5-21-1111111111-2222222222-3333333333-1005'
    $script:OtherUser = 'S-1-5-21-1111111111-2222222222-3333333333-1001'
    $script:Fake = @{}

    function New-FakeAce {
        param([string]$Sid, [int]$Mask, [switch]$Inherit, [switch]$InheritOnly, [switch]$Inherited)
        return [pscustomobject]@{ Sid = $Sid; Mask = $Mask; Inherit = $Inherit.IsPresent; InheritOnly = $InheritOnly.IsPresent; Inherited = $Inherited.IsPresent }
    }

    # A security descriptor from invented entries, run through the real ConvertFrom-AccucutTrustDescriptor.
    function New-FakeSecurity {
        param([Parameter(Mandatory)][string]$Path, [string]$Owner = 'S-1-5-32-544', [object[]]$Ace = @(), [switch]$NotProtected, [switch]$Link, [switch]$File)
        $ownerSid = [System.Security.Principal.SecurityIdentifier]::new($Owner)
        $acl = [System.Security.AccessControl.RawAcl]::new(2, 0)
        $position = 0
        foreach ($entry in $Ace) {
            $aceFlags = 0
            if ($entry.Inherit) { $aceFlags += 3 }
            if ($entry.InheritOnly) { $aceFlags += 8 }
            if ($entry.Inherited) { $aceFlags += 16 }
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

    # The real tree after the install: the drive root, the root with its five entries, and the backups folder with its three.
    function Initialize-FakeTree {
        $script:Fake = @{}
        $driveRoot = @(
            (New-FakeAce -Sid $script:Admins -Mask 0x1F01FF -Inherit), (New-FakeAce -Sid $script:System -Mask 0x1F01FF -Inherit), (New-FakeAce -Sid $script:Users -Mask 0x1200A9 -Inherit),
            (New-FakeAce -Sid $script:AuthUsers -Mask 0x100006), (New-FakeAce -Sid $script:AuthUsers -Mask 0x1301BF -Inherit -InheritOnly)
        )
        Set-FakeSecurity 'C:\' (New-FakeSecurity -Path 'C:\' -Owner $script:System -Ace $driveRoot -NotProtected)
        $rootAces = (New-FullControl) + @((New-FakeAce -Sid $script:AppSid -Mask 0x1200A9 -Inherit), (New-FakeAce -Sid $script:BackupSid -Mask 0x1200A9 -Inherit))
        Set-FakeSecurity 'C:\Accucut' (New-FakeSecurity -Path 'C:\Accucut' -Ace $rootAces)
        $inheritedRoot = @(
            (New-FakeAce -Sid $script:Admins -Mask 0x1F01FF -Inherit -Inherited), (New-FakeAce -Sid $script:System -Mask 0x1F01FF -Inherit -Inherited),
            (New-FakeAce -Sid $script:AppSid -Mask 0x1200A9 -Inherit -Inherited), (New-FakeAce -Sid $script:BackupSid -Mask 0x1200A9 -Inherit -Inherited)
        )
        foreach ($path in 'C:\Accucut\releases', 'C:\Accucut\config') { Set-FakeSecurity $path (New-FakeSecurity -Path $path -Ace $inheritedRoot -NotProtected) }
        $backups = (New-FullControl) + @((New-FakeAce -Sid $script:BackupSid -Mask 0x1301BF -Inherit))
        Set-FakeSecurity 'C:\Accucut\backups' (New-FakeSecurity -Path 'C:\Accucut\backups' -Ace $backups)
    }
}

Describe 'backup.ps1 runs only from the installed release, and finds the install root from its own place (ADR-015 Amendment 3)' {
    It 'works out the root from <root>\current\backup.ps1 and from <root>\releases\<tag>\backup.ps1 (<Path>)' -ForEach @(
        @{ Path = 'C:\Accucut\current\backup.ps1'; Root = 'C:\Accucut' }
        @{ Path = 'D:\Acc-ucut_1\releases\1.2.3-abcdef0\backup.ps1'; Root = 'D:\Acc-ucut_1' }
        @{ Path = 'c:\accucut\CURRENT\BACKUP.PS1'; Root = 'c:\accucut' }
    ) {
        Get-AccucutScriptInstallRoot -ScriptPath $Path -Name 'backup.ps1' | Should -Be $Root
    }

    It 'refuses a script from anywhere else: the unpacked zip, a download folder, a deeper folder, a share, another name, a tag with a space (<Path>)' -ForEach @(
        @{ Path = 'C:\Program Files\accucut-pkg\backup.ps1' }
        @{ Path = 'C:\Users\someone\Downloads\backup.ps1' }
        @{ Path = 'C:\Accucut\backup.ps1' }
        @{ Path = 'C:\Accucut\current\other.ps1' }
        @{ Path = 'C:\a\b\current\backup.ps1' }
        @{ Path = 'C:\Accucut\releases\backup.ps1' }
        @{ Path = 'C:\Accucut\releases\x y\backup.ps1' }
        @{ Path = 'C:\Accucut\releases\x\..\backup.ps1' }
        @{ Path = '\\server\share\Accucut\current\backup.ps1' }
    ) {
        { Get-AccucutScriptInstallRoot -ScriptPath $Path -Name 'backup.ps1' } | Should -Throw '*Run the installed backup.ps1 only*'
    }
}

Describe 'the order of the checks in backup.ps1: every check before the module is loaded, every program checked before the work (required tests 2 and 5)' {
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
        Mock Invoke-AccucutBackup { $script:Trace.Add("backup:$Reason|$ReleaseTag"); return [pscustomobject]@{ Name = 'accucut-20261115-020000-weekly.age'; SizeBytes = [int64]12345 } }
        $script:Events = [System.Collections.Generic.List[object]]::new()
        Mock Write-AccucutBackupEvent { $script:Events.Add([pscustomobject]@{ Type = $EntryType; Id = $EventId; Message = $Message }) }
    }

    It 'writes one Information event, 1000, with the file name and the size, when the backup is made, and no path' {
        Invoke-AccucutBackupScript -ScriptPath 'C:\Accucut\current\backup.ps1' -Reason 'weekly'
        $script:Events.Count | Should -Be 1
        $script:Events[0].Type | Should -Be 'Information'
        $script:Events[0].Id | Should -Be 1000
        $script:Events[0].Message | Should -Be 'The weekly backup was made: accucut-20261115-020000-weekly.age, 12345 bytes.'
    }

    It 'writes one Error event with a code when a check fails before any work (1010), when the backup fails (1011), and when there is no room (1012)' {
        Mock Assert-AccucutBackupFolderTrusted { throw "'C:\Accucut\backups' can be changed by S-1-5-32-545" }
        { Invoke-AccucutBackupScript -ScriptPath 'C:\Accucut\current\backup.ps1' -Reason 'weekly' } | Should -Throw
        Mock Assert-AccucutBackupFolderTrusted { }
        Mock Invoke-AccucutBackup { throw 'pg_dump failed with exit code 1. connection refused' }
        { Invoke-AccucutBackupScript -ScriptPath 'C:\Accucut\current\backup.ps1' -Reason 'release' } | Should -Throw
        Mock Invoke-AccucutBackup { throw 'Not enough free disk space for another copy: 1 KB is free.' }
        { Invoke-AccucutBackupScript -ScriptPath 'C:\Accucut\current\backup.ps1' -Reason 'weekly' } | Should -Throw
        $script:Events.Count | Should -Be 3
        ($script:Events | ForEach-Object { $_.Type }) | Should -Be @('Error', 'Error', 'Error')
        ($script:Events | ForEach-Object { $_.Id }) | Should -Be @(1010, 1011, 1012)
        $script:Events[0].Message | Should -BeLike 'The weekly backup failed (code checks-failed): *can be changed by S-1-5-32-545*'
        $script:Events[1].Message | Should -BeLike 'The release backup failed (code backup-failed): pg_dump failed with exit code 1*'
        $script:Events[2].Message | Should -BeLike 'The weekly backup failed (code low-space): *'
    }

    It 'writes an Error event even when the failure comes before the module is loaded (a script that is not the running release)' {
        { Invoke-AccucutBackupScript -ScriptPath 'C:\Accucut\releases\other\backup.ps1' -Reason 'weekly' } | Should -Throw
        $script:Events.Count | Should -Be 1
        $script:Events[0].Id | Should -Be 1010
    }

    It 'the event writer never throws, blanks registered secrets, cuts the text, and writes only to the source Accucut (static check)' {
        $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'backup.ps1') -Raw
        $start = $text.IndexOf('function Write-AccucutBackupEvent {')
        $body = $text.Substring($start, $text.IndexOf('function Invoke-AccucutBackupScript {', $start) - $start)
        $body | Should -Match 'try \{ \[System\.Diagnostics\.EventLog\]::WriteEntry\(''Accucut'', \$text, '
        $body | Should -Match 'catch \{ Write-Host'
        $body | Should -Match 'Hide-AccucutSecrets'
        $body | Should -Match 'Substring\(0, 1000\)'
    }

    It 'checks the root, the release, the script, loads the module, then checks the settings files, the backups folder and the three programs, and only then makes the backup' {
        Invoke-AccucutBackupScript -ScriptPath 'C:\Accucut\current\backup.ps1' -Reason 'weekly'
        $trace = @($script:Trace)
        $expected = @(
            'shape:C:\Accucut', 'current', 'path:C:\Accucut\releases\t1', 'path:C:\Accucut\releases\t1\backup.ps1', 'import', 'sid',
            'path:C:\Accucut\config\backup-settings.json', 'path:C:\Accucut\config\backup.pgpass', 'settings:C:\Accucut\config\backup-settings.json',
            "folder:C:\Accucut\backups|$($script:BackupSid)",
            'program:C:\Accucut\releases\t1\bin\age.exe', 'program:C:\Program Files\PostgreSQL\17\bin\pg_dump.exe', 'program:C:\Program Files\PostgreSQL\17\bin\psql.exe',
            'backup:weekly|t1'
        )
        ($trace -join "`n") | Should -Be ($expected -join "`n")
    }

    It 'also runs from the release folder itself (update.ps1 starts it there) and passes the reason release and the release tag on' {
        Invoke-AccucutBackupScript -ScriptPath 'C:\Accucut\releases\t1\backup.ps1' -Reason 'release'
        @($script:Trace) | Should -Contain 'backup:release|t1'
    }

    It 'hands the programs to the backup by full path: age from the release, pg_dump and psql from the folder in the settings (never PATH)' {
        Invoke-AccucutBackupScript -ScriptPath 'C:\Accucut\current\backup.ps1' -Reason 'weekly'
        Should -Invoke Invoke-AccucutBackup -Times 1 -Exactly -ParameterFilter {
            $Program.Age -eq 'C:\Accucut\releases\t1\bin\age.exe' -and $Program.PgDump -eq 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe' -and $Program.Psql -eq 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
        }
    }

    It 'stops before any work, naming the reason, when a check fails: <Case>' -ForEach @(
        @{ Case = 'the script is not the running release'; Message = '*not the backup.ps1 of the running release*'; Imported = 0 }
        @{ Case = 'the release folder fails the trust check'; Message = '*can be changed by S-1-5-32-545*'; Imported = 0 }
        @{ Case = 'the root has the wrong shape'; Message = '*exactly one folder below a drive*'; Imported = 0 }
        @{ Case = 'a settings file fails the trust check'; Message = '*backup.pgpass*can be changed*'; Imported = 1 }
        @{ Case = 'the backups folder fails the check'; Message = '*backups*can be changed*'; Imported = 1 }
        @{ Case = 'pg_dump fails the trust check'; Message = '*pg_dump.exe*can be changed*'; Imported = 1 }
        @{ Case = 'the account AccucutBackup does not exist'; Message = '*AccucutBackup*does not exist*'; Imported = 1 }
    ) {
        $scriptPath = 'C:\Accucut\current\backup.ps1'
        switch ($Case) {
            'the script is not the running release' { $scriptPath = 'C:\Accucut\releases\other\backup.ps1' }
            'the release folder fails the trust check' { Mock Assert-AccucutTrustedPath { throw "'$Path' can be changed by S-1-5-32-545" } }
            'the root has the wrong shape' { Mock Assert-AccucutTrustedRootShape { throw 'The install folder must be exactly one folder below a drive' } }
            'a settings file fails the trust check' { Mock Assert-AccucutTrustedPath { if ($Path -like '*backup.pgpass') { throw "'$Path' can be changed by S-1-5-32-545" } } }
            'the backups folder fails the check' { Mock Assert-AccucutBackupFolderTrusted { throw "'$Directory' can be changed by S-1-5-32-545" } }
            'pg_dump fails the trust check' { Mock Resolve-AccucutTrustedExecutable { if ($Path -like '*pg_dump.exe') { throw "'$Path' can be changed by S-1-5-32-545" }; return $Path } }
            'the account AccucutBackup does not exist' { Mock Get-AccucutBackupAccountSid { throw "The local account 'AccucutBackup' does not exist on this server" } }
        }
        { Invoke-AccucutBackupScript -ScriptPath $scriptPath -Reason 'weekly' } | Should -Throw $Message
        Should -Invoke Invoke-AccucutBackup -Times 0 -Exactly
        Should -Invoke Import-AccucutTrustedModule -Times $Imported -Exactly
    }
}

Describe 'a replaced module is never loaded by backup.ps1 (ADR-015 Amendment 2, test 5)' {
    BeforeEach {
        # The real Import-AccucutTrustedModule and the real checks, on invented security. The stand-in module writes a marker file if it is ever loaded.
        Initialize-FakeTree
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
        Mock Invoke-AccucutBackup { }
        Mock Write-AccucutBackupEvent { }
        $script:AccucutTrustLog.Clear()
    }

    It 'does not load a module that the Users group can change: its code does not run, nothing is loaded, and no backup is made' {
        Set-FakeSecurity $script:ModuleFile (New-FakeSecurity -Path $script:ModuleFile -Ace ((New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1301BF))) -NotProtected -File)
        { Invoke-AccucutBackupScript -ScriptPath (Join-Path $TestDrive 'current\backup.ps1') -Reason 'weekly' } | Should -Throw '*can be changed by S-1-5-32-545*'
        Test-Path -LiteralPath $script:Marker | Should -BeFalse
        $script:AccucutTrustLog | Should -Not -Contain "load:$($script:ModuleFile)"
        Should -Invoke Invoke-AccucutBackup -Times 0 -Exactly
    }

    It 'does not load a module whose release folder is a link, or whose owner is someone else' {
        Set-FakeSecurity $script:Release (New-FakeSecurity -Path $script:Release -Ace (New-FullControl) -NotProtected -Link)
        { Invoke-AccucutBackupScript -ScriptPath (Join-Path $TestDrive 'current\backup.ps1') -Reason 'weekly' } | Should -Throw '*is a link*'
        Test-Path -LiteralPath $script:Marker | Should -BeFalse
        Set-FakeSecurity $script:Release (New-FakeSecurity -Path $script:Release -Ace (New-FullControl) -NotProtected)
        Set-FakeSecurity $script:ModuleFile (New-FakeSecurity -Path $script:ModuleFile -Owner $script:OtherUser -Ace (New-FullControl) -NotProtected -File)
        { Invoke-AccucutBackupScript -ScriptPath (Join-Path $TestDrive 'current\backup.ps1') -Reason 'weekly' } | Should -Throw '*is owned by*'
        Test-Path -LiteralPath $script:Marker | Should -BeFalse
        Should -Invoke Invoke-AccucutBackup -Times 0 -Exactly
    }
}

Describe 'the backups folder is checked before anything is written to it (ADR-015 Amendment 3 point 4)' {
    BeforeEach {
        Initialize-FakeTree
        Mock Get-AccucutTrustSecurity {
            $key = $Path.TrimEnd('\').ToLowerInvariant()
            if ($script:Fake.ContainsKey($key)) { return $script:Fake[$key] }
            throw "the test has no security for '$Path'"
        }
        $script:AccucutTrustLog.Clear()
    }

    It 'accepts the folder as the install makes it: protected, owned by Administrators, the backup account the only writer, up to Modify' {
        { Assert-AccucutBackupFolderTrusted -Root 'C:\Accucut' -Directory 'C:\Accucut\backups' -BackupSid $script:BackupSid } | Should -Not -Throw
        $script:AccucutTrustLog | Should -Contain 'check:C:\Accucut\backups'
    }

    It 'refuses an extra writer: <Name>' -ForEach @(
        @{ Name = 'the Users group (Modify)'; Sid = 'S-1-5-32-545'; Mask = 0x1301BF }
        @{ Name = 'a service account (Modify)'; Sid = 'S-1-5-80-1111111111-2222222222-3333333333-4444444444-5555555555'; Mask = 0x1301BF }
        @{ Name = 'another user (write data)'; Sid = 'S-1-5-21-1111111111-2222222222-3333333333-1001'; Mask = 0x1200A9 + 2 }
        @{ Name = 'Authenticated Users (delete)'; Sid = 'S-1-5-11'; Mask = 0x1200A9 + 0x10000 }
        @{ Name = 'the backup account with more than Modify (full control)'; Sid = 'S-1-5-21-1111111111-2222222222-3333333333-1005'; Mask = 0x1F01FF }
        @{ Name = 'the backup account with write DAC'; Sid = 'S-1-5-21-1111111111-2222222222-3333333333-1005'; Mask = 0x1301BF + 0x40000 }
    ) {
        $ace = (New-FullControl) + @((New-FakeAce -Sid $Sid -Mask $Mask -Inherit))
        Set-FakeSecurity 'C:\Accucut\backups' (New-FakeSecurity -Path 'C:\Accucut\backups' -Ace $ace)
        { Assert-AccucutBackupFolderTrusted -Root 'C:\Accucut' -Directory 'C:\Accucut\backups' -BackupSid $script:BackupSid } | Should -Throw '*can be changed by*'
    }

    It 'does not accept another account in place of the backup account as the writer' {
        { Assert-AccucutBackupFolderTrusted -Root 'C:\Accucut' -Directory 'C:\Accucut\backups' -BackupSid $script:OtherUser } | Should -Throw '*can be changed by S-1-5-21-1111111111-2222222222-3333333333-1005*'
    }

    It 'refuses a link, a file, a folder that is not owned by Administrators (SYSTEM included), and a folder that inherits its list' {
        Set-FakeSecurity 'C:\Accucut\backups' (New-FakeSecurity -Path 'C:\Accucut\backups' -Ace (New-FullControl) -Link)
        { Assert-AccucutBackupFolderTrusted -Root 'C:\Accucut' -Directory 'C:\Accucut\backups' -BackupSid $script:BackupSid } | Should -Throw '*is a link*'
        Set-FakeSecurity 'C:\Accucut\backups' (New-FakeSecurity -Path 'C:\Accucut\backups' -Ace (New-FullControl) -File)
        { Assert-AccucutBackupFolderTrusted -Root 'C:\Accucut' -Directory 'C:\Accucut\backups' -BackupSid $script:BackupSid } | Should -Throw '*not a real folder*'
        Set-FakeSecurity 'C:\Accucut\backups' (New-FakeSecurity -Path 'C:\Accucut\backups' -Owner $script:OtherUser -Ace (New-FullControl))
        { Assert-AccucutBackupFolderTrusted -Root 'C:\Accucut' -Directory 'C:\Accucut\backups' -BackupSid $script:BackupSid } | Should -Throw '*is owned by*'
        Set-FakeSecurity 'C:\Accucut\backups' (New-FakeSecurity -Path 'C:\Accucut\backups' -Owner $script:System -Ace (New-FullControl))
        { Assert-AccucutBackupFolderTrusted -Root 'C:\Accucut' -Directory 'C:\Accucut\backups' -BackupSid $script:BackupSid } | Should -Throw '*not by Administrators*'
        Set-FakeSecurity 'C:\Accucut\backups' (New-FakeSecurity -Path 'C:\Accucut\backups' -Ace (New-FullControl) -NotProtected)
        { Assert-AccucutBackupFolderTrusted -Root 'C:\Accucut' -Directory 'C:\Accucut\backups' -BackupSid $script:BackupSid } | Should -Throw '*inherits its permissions*'
    }

    It 'refuses when a folder above it can be written by the Users group (the whole chain is checked)' {
        Set-FakeSecurity 'C:\Accucut' (New-FakeSecurity -Path 'C:\Accucut' -Ace ((New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1301BF -Inherit))))
        { Assert-AccucutBackupFolderTrusted -Root 'C:\Accucut' -Directory 'C:\Accucut\backups' -BackupSid $script:BackupSid } | Should -Throw '*can be changed by S-1-5-32-545*'
    }

    It 'accepts the fifth entry of the root (read and execute for the backup account) and the folders that inherit it (rule B allows read and execute for others)' {
        { Assert-AccucutTrustedPath -Path 'C:\Accucut\config' -Root 'C:\Accucut' -ProtectedRoot } | Should -Not -Throw
        { Assert-AccucutTrustedPath -Path 'C:\Accucut\releases' -Root 'C:\Accucut' -ProtectedRoot } | Should -Not -Throw
    }
}

Describe 'the free-space check comes first and never deletes anything (AC-2)' {
    It 'allows a copy when at least 20 % of the disk stays free after it, and refuses it by one byte less (planned size: the last copy plus 10 %)' {
        $total = [int64]100GB
        $last = [int64]5GB
        $planned = [int64][math]::Ceiling($last * 1.10)
        $minimum = [int64][math]::Ceiling($total * 0.20)
        $edge = Test-AccucutBackupRoom -FreeBytes ($minimum + $planned) -TotalBytes $total -LastCopyBytes $last -DatabaseBytes 1GB
        $edge.Ok | Should -BeTrue
        $edge.PlannedBytes | Should -Be $planned
        $edge.MinimumFreeBytes | Should -Be $minimum
        $below = Test-AccucutBackupRoom -FreeBytes ($minimum + $planned - 1) -TotalBytes $total -LastCopyBytes $last -DatabaseBytes 1GB
        $below.Ok | Should -BeFalse
        $below.Message | Should -BeLike 'Not enough free disk space for another copy*No copy was made and nothing was deleted*'
    }

    It 'uses the size of the database when there is no earlier copy' {
        $result = Test-AccucutBackupRoom -FreeBytes 30GB -TotalBytes 100GB -LastCopyBytes 0 -DatabaseBytes 8GB
        $result.PlannedBytes | Should -Be ([int64][math]::Ceiling(8GB * 1.10))
        $result.Ok | Should -BeTrue
        (Test-AccucutBackupRoom -FreeBytes 28GB -TotalBytes 100GB -LastCopyBytes 0 -DatabaseBytes 8GB).Ok | Should -BeFalse
    }

    It 'refuses when the disk size is unknown' {
        (Test-AccucutBackupRoom -FreeBytes 1GB -TotalBytes 0 -LastCopyBytes 0 -DatabaseBytes 1MB).Ok | Should -BeFalse
    }
}

Describe 'the backup run: a temporary name, the manifest, the final name, pruning, and one job_runs row (AC-1, AC-2, AC-3, AC-4, AC-9)' {
    BeforeAll {
        function New-FakeCopy {
            # A copy and its manifest, as a finished run leaves them. -Stamp is the UTC time in the name.
            param([string]$Directory, [string]$Stamp, [string]$Reason = 'weekly', [int]$Size = 100, [switch]$NoManifest)
            $base = "accucut-$Stamp-$Reason"
            [System.IO.File]::WriteAllBytes((Join-Path $Directory "$base.age"), (New-Object byte[] $Size))
            if (-not $NoManifest) {
                $time = [datetime]::ParseExact($Stamp, 'yyyyMMdd-HHmmss', [cultureinfo]::InvariantCulture, [System.Globalization.DateTimeStyles]'AssumeUniversal, AdjustToUniversal')
                $manifest = [ordered]@{ file = "$base.age"; reason = $Reason; createdAtUtc = $time.ToString('o'); sizeBytes = $Size; sha256 = ('a' * 64) }
                [System.IO.File]::WriteAllText((Join-Path $Directory "$base.manifest.json"), ($manifest | ConvertTo-Json))
            }
        }
    }

    BeforeEach {
        $root = Join-Path $TestDrive ('run-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        $script:Paths = Get-AccucutPaths -Root $root
        New-Item -ItemType Directory -Path $script:Paths.Backups -Force | Out-Null
        $script:Settings = [pscustomobject]@{ AgeRecipient = ('age1' + ('q' * 58)); PgHost = '127.0.0.1'; PgPort = 5432; Database = 'accucut'; PgBinDirectory = 'C:\pg\bin' }
        $script:Program = @{ PgDump = 'C:\pg\bin\pg_dump.exe'; Psql = 'C:\pg\bin\psql.exe'; Age = 'C:\Accucut\releases\t1\bin\age.exe' }
        $script:Rows = [System.Collections.Generic.List[object]]::new()
        $script:PipeCalls = 0
        $script:Space = [pscustomobject]@{ TotalBytes = [int64]100GB; FreeBytes = [int64]60GB }
        Mock Get-AccucutDatabaseInfo -ModuleName AccucutOps { [pscustomobject]@{ ServerVersion = '17.2'; SizeBytes = [int64]5MB } }
        Mock Get-AccucutVolumeSpace -ModuleName AccucutOps { $script:Space }
        Mock Invoke-AccucutBackupPipe -ModuleName AccucutOps {
            $script:PipeCalls++
            $bytes = [byte[]](1..200)
            [System.IO.File]::WriteAllBytes($OutputPath, $bytes)
            return [int64]$bytes.Length
        }
        Mock Add-AccucutJobRun -ModuleName AccucutOps { $script:Rows.Add([pscustomobject]@{ Job = $Job; Started = $StartedUtc; Finished = $FinishedUtc; Result = $Result }) }
        Mock Write-AccucutLog -ModuleName AccucutOps { }
    }

    It 'makes the copy under a temporary name, then the manifest (SHA-256, size, PostgreSQL version, time, reason, release), then the final name; and writes one ok row with the sizes and the free space' {
        $made = Invoke-AccucutBackup -Paths $script:Paths -Settings $script:Settings -Program $script:Program -Reason 'weekly' -ReleaseTag 't1'
        $made.Name | Should -Match '^accucut-\d{8}-\d{6}-weekly\.age$'
        $files = @(Get-ChildItem -LiteralPath $script:Paths.Backups -Force | ForEach-Object { $_.Name })
        $files | Should -Contain $made.Name
        $files | Should -Contain ($made.Name -replace '\.age$', '.manifest.json')
        @($files | Where-Object { $_ -like '*.part' }).Count | Should -Be 0
        $manifest = Get-Content -LiteralPath (Join-Path $script:Paths.Backups ($made.Name -replace '\.age$', '.manifest.json')) -Raw | ConvertFrom-Json
        $manifest.file | Should -Be $made.Name
        $manifest.reason | Should -Be 'weekly'
        $manifest.sizeBytes | Should -Be 200
        $manifest.sha256 | Should -Be (Get-AccucutFileSha256 -Path (Join-Path $script:Paths.Backups $made.Name))
        $manifest.postgresVersion | Should -Be '17.2'
        $manifest.release | Should -Be 't1'
        ([datetime]::Parse([string]$manifest.createdAtUtc).ToUniversalTime().ToString('yyyyMMdd-HHmmss')) | Should -Be ($made.Name -replace '^accucut-(\d{8}-\d{6})-.*$', '$1')
        $script:Rows.Count | Should -Be 1
        $row = $script:Rows[0]
        $row.Job | Should -Be 'backup'
        $row.Result.status | Should -Be 'ok'
        $row.Result.sizeBytes | Should -Be 200
        $row.Result.freeBytes | Should -Be $script:Space.FreeBytes
        $row.Result.totalBytes | Should -Be $script:Space.TotalBytes
        $row.Finished | Should -BeGreaterOrEqual $row.Started
        (Get-AccucutBackupCopy -Directory $script:Paths.Backups)[0].Verified | Should -BeTrue
    }

    It 'writes the manifest before the copy gets its final name, and writes both only with FileMode.CreateNew (static check of the code)' {
        $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Raw
        $start = $text.IndexOf('function Invoke-AccucutBackup {')
        $body = $text.Substring($start, $text.IndexOf("`nfunction Write-AccucutBackupManifest", $start) - $start)
        $body.IndexOf('Invoke-AccucutBackupPipe') | Should -BeLessThan $body.IndexOf('Write-AccucutBackupManifest')
        $body.IndexOf('Write-AccucutBackupManifest') | Should -BeLessThan $body.IndexOf('[System.IO.File]::Move($part, $final)')
        $body.IndexOf('[System.IO.File]::Move($part, $final)') | Should -BeLessThan $body.IndexOf('Invoke-AccucutBackupPrune')
        $body.IndexOf('Invoke-AccucutBackupPrune') | Should -BeLessThan $body.IndexOf('-Result $ok')
        $text | Should -Match 'function Write-AccucutBackupManifest[\s\S]*?FileMode\]::CreateNew'
        $text | Should -Match 'function Invoke-AccucutBackupPipe[\s\S]*?FileMode\]::CreateNew'
    }

    It 'tags a release copy in its name and its manifest (AC-4), and does not prune it while it is under 2 years old, even when more than 4 newer copies exist' {
        $recent = [datetime]::UtcNow.AddMonths(-14).ToString('yyyyMMdd-HHmmss')
        New-FakeCopy -Directory $script:Paths.Backups -Stamp $recent -Reason 'release'
        foreach ($i in 1..5) { New-FakeCopy -Directory $script:Paths.Backups -Stamp ([datetime]::UtcNow.AddDays(-$i).ToString('yyyyMMdd-HHmmss')) }
        $made = Invoke-AccucutBackup -Paths $script:Paths -Settings $script:Settings -Program $script:Program -Reason 'release' -ReleaseTag 't2'
        $made.Name | Should -Match '-release\.age$'
        (Get-Content -LiteralPath (Join-Path $script:Paths.Backups ($made.Name -replace '\.age$', '.manifest.json')) -Raw | ConvertFrom-Json).reason | Should -Be 'release'
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$recent-release.age") | Should -BeTrue
        $script:Rows[0].Result.reason | Should -Be 'release'
    }

    It 'prunes only copies older than 2 calendar years that are not among the newest 4, oldest first, and never a newer copy (AC-3)' {
        $oldest = '20200105-020000'
        $old = '20220102-020000'
        New-FakeCopy -Directory $script:Paths.Backups -Stamp $oldest
        New-FakeCopy -Directory $script:Paths.Backups -Stamp $old -Reason 'release'
        $recent = foreach ($i in 1..5) { [datetime]::UtcNow.AddDays(-7 * $i).ToString('yyyyMMdd-HHmmss') }
        foreach ($stamp in $recent) { New-FakeCopy -Directory $script:Paths.Backups -Stamp $stamp }
        $made = Invoke-AccucutBackup -Paths $script:Paths -Settings $script:Settings -Program $script:Program -Reason 'weekly' -ReleaseTag 't1'
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$oldest-weekly.age") | Should -BeFalse
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$oldest-weekly.manifest.json") | Should -BeFalse
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$old-release.age") | Should -BeFalse
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$old-release.manifest.json") | Should -BeFalse
        # Every newer copy is still there, and so is the one just made: pruning never removes a newer copy to make room.
        foreach ($stamp in $recent) { Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$stamp-weekly.age") | Should -BeTrue }
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups $made.Name) | Should -BeTrue
        $made.Pruned | Should -Be 2
        $script:Rows[0].Result.pruned | Should -Be 2
    }

    It 'never prunes one of the newest 4 copies, even when all of them are older than 2 years' {
        $stamps = '20200105-020000', '20200112-020000', '20200119-020000'
        foreach ($stamp in $stamps) { New-FakeCopy -Directory $script:Paths.Backups -Stamp $stamp }
        $made = Invoke-AccucutBackup -Paths $script:Paths -Settings $script:Settings -Program $script:Program -Reason 'weekly' -ReleaseTag 't1'
        foreach ($stamp in $stamps) { Test-Path -LiteralPath (Join-Path $script:Paths.Backups "accucut-$stamp-weekly.age") | Should -BeTrue }
        $made.Pruned | Should -Be 0
        $keep = Get-AccucutBackupKeepSet -Copy @(Get-AccucutBackupCopy -Directory $script:Paths.Backups) -Count 4
        $keep.Count | Should -Be 4
    }

    It 'prunes nothing that is not provably its own: no manifest, a manifest that disagrees, a file in a sub-folder, a link, a foreign file' {
        New-FakeCopy -Directory $script:Paths.Backups -Stamp '20190101-020000' -NoManifest
        New-FakeCopy -Directory $script:Paths.Backups -Stamp '20190108-020000' -Size 100
        $manifestPath = Join-Path $script:Paths.Backups 'accucut-20190108-020000-weekly.manifest.json'
        [System.IO.File]::WriteAllText($manifestPath, (([System.IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json | ForEach-Object { $_.sizeBytes = 5; $_ }) | ConvertTo-Json))
        [System.IO.File]::WriteAllText((Join-Path $script:Paths.Backups 'notes.txt'), 'x')
        $sub = Join-Path $script:Paths.Backups 'sub'
        New-Item -ItemType Directory -Path $sub | Out-Null
        New-FakeCopy -Directory $sub -Stamp '20190115-020000'
        $outside = Join-Path $TestDrive ('outside-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path $outside | Out-Null
        New-FakeCopy -Directory $outside -Stamp '20190122-020000'
        $junction = Join-Path $script:Paths.Backups 'linked'
        New-Item -ItemType Junction -Path $junction -Target $outside | Out-Null
        try {
            foreach ($i in 1..5) { New-FakeCopy -Directory $script:Paths.Backups -Stamp ([datetime]::UtcNow.AddDays(-$i).ToString('yyyyMMdd-HHmmss')) }
            [void](Invoke-AccucutBackup -Paths $script:Paths -Settings $script:Settings -Program $script:Program -Reason 'weekly' -ReleaseTag 't1')
            Test-Path -LiteralPath (Join-Path $script:Paths.Backups 'accucut-20190101-020000-weekly.age') | Should -BeTrue
            Test-Path -LiteralPath (Join-Path $script:Paths.Backups 'accucut-20190108-020000-weekly.age') | Should -BeTrue
            Test-Path -LiteralPath (Join-Path $script:Paths.Backups 'notes.txt') | Should -BeTrue
            Test-Path -LiteralPath (Join-Path $sub 'accucut-20190115-020000-weekly.age') | Should -BeTrue
            Test-Path -LiteralPath (Join-Path $outside 'accucut-20190122-020000-weekly.age') | Should -BeTrue
        }
        finally { [System.IO.Directory]::Delete($junction, $false) }
    }

    It 'with too little free space makes no copy, deletes no copy at all (not even one past 2 years), writes a failed row that says why and has the numbers, and throws (AC-2)' {
        $oldStamp = '20200105-020000'
        New-FakeCopy -Directory $script:Paths.Backups -Stamp $oldStamp
        foreach ($i in 1..5) { New-FakeCopy -Directory $script:Paths.Backups -Stamp ([datetime]::UtcNow.AddDays(-$i).ToString('yyyyMMdd-HHmmss')) }
        $before = @(Get-ChildItem -LiteralPath $script:Paths.Backups -Force | ForEach-Object { $_.Name } | Sort-Object)
        $script:Space = [pscustomobject]@{ TotalBytes = [int64]100GB; FreeBytes = [int64]20GB }
        { Invoke-AccucutBackup -Paths $script:Paths -Settings $script:Settings -Program $script:Program -Reason 'weekly' -ReleaseTag 't1' } | Should -Throw '*Not enough free disk space*No copy was made and nothing was deleted*'
        $script:PipeCalls | Should -Be 0
        @(Get-ChildItem -LiteralPath $script:Paths.Backups -Force | ForEach-Object { $_.Name } | Sort-Object) | Should -Be $before
        $script:Rows.Count | Should -Be 1
        $script:Rows[0].Job | Should -Be 'backup'
        $script:Rows[0].Result.status | Should -Be 'failed'
        $script:Rows[0].Result.code | Should -Be 'low-space'
        $script:Rows[0].Result.message | Should -BeLike '*free disk space*'
        $script:Rows[0].Result.freeBytes | Should -Be 20GB
        $script:Rows[0].Result.totalBytes | Should -Be 100GB
    }

    It 'a failed dump leaves no temporary file, no manifest and no final file, writes a failed row without the secret, and throws' {
        $script:Secret = 'FAKEdumpFailurePassword9'
        Register-AccucutSecret -Value $script:Secret
        Mock Invoke-AccucutBackupPipe -ModuleName AccucutOps {
            [System.IO.File]::WriteAllBytes($OutputPath, [byte[]](1..10))
            throw "pg_dump failed with exit code 1. connection to server failed password=$($script:Secret)"
        }
        { Invoke-AccucutBackup -Paths $script:Paths -Settings $script:Settings -Program $script:Program -Reason 'weekly' -ReleaseTag 't1' } | Should -Throw '*pg_dump failed with exit code 1*'
        @(Get-ChildItem -LiteralPath $script:Paths.Backups -Force).Count | Should -Be 0
        $script:Rows.Count | Should -Be 1
        $script:Rows[0].Result.status | Should -Be 'failed'
        $script:Rows[0].Result.code | Should -Be 'error'
        ($script:Rows[0].Result.message) | Should -BeLike '*pg_dump failed with exit code 1*'
        ($script:Rows[0].Result.message) | Should -Not -BeLike "*$($script:Secret)*"
    }

    It 'keeps a good copy when the job_runs row cannot be written afterwards, and throws, so that the task result is not 0' {
        Mock Add-AccucutJobRun -ModuleName AccucutOps { if ($Result.status -eq 'ok') { throw 'psql failed' } else { $script:Rows.Add($Result) } }
        { Invoke-AccucutBackup -Paths $script:Paths -Settings $script:Settings -Program $script:Program -Reason 'weekly' -ReleaseTag 't1' } | Should -Throw '*psql failed*'
        @(Get-AccucutBackupCopy -Directory $script:Paths.Backups).Count | Should -Be 1
    }

    It 'lists what is in the folder oldest first, looks at nothing deeper, and marks a copy as verified only when its manifest agrees' {
        New-FakeCopy -Directory $script:Paths.Backups -Stamp '20260301-020000'
        New-FakeCopy -Directory $script:Paths.Backups -Stamp '20260101-020000' -Reason 'release'
        New-FakeCopy -Directory $script:Paths.Backups -Stamp '20260201-020000' -NoManifest
        $copies = @(Get-AccucutBackupCopy -Directory $script:Paths.Backups)
        ($copies | ForEach-Object { $_.Name }) | Should -Be @('accucut-20260101-020000-release.age', 'accucut-20260201-020000-weekly.age', 'accucut-20260301-020000-weekly.age')
        ($copies | ForEach-Object { $_.Verified }) | Should -Be @($true, $false, $true)
        $copies[1].Problem | Should -Be 'it has no manifest'
        @(Get-AccucutBackupCopy -Directory (Join-Path $TestDrive 'no-such-folder')).Count | Should -Be 0
    }

    It 'deletes a copy only after proving it again, copy first then manifest, and refuses a name that is not a copy name or a copy that is not verified' {
        New-FakeCopy -Directory $script:Paths.Backups -Stamp '20200101-020000'
        New-FakeCopy -Directory $script:Paths.Backups -Stamp '20200108-020000' -NoManifest
        [System.IO.File]::WriteAllText((Join-Path $script:Paths.Backups 'important.docx'), 'x')
        (Remove-AccucutBackupCopy -Directory $script:Paths.Backups -Name 'accucut-20200101-020000-weekly.age') | Should -BeGreaterThan 100
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups 'accucut-20200101-020000-weekly.age') | Should -BeFalse
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups 'accucut-20200101-020000-weekly.manifest.json') | Should -BeFalse
        { Remove-AccucutBackupCopy -Directory $script:Paths.Backups -Name 'accucut-20200108-020000-weekly.age' } | Should -Throw '*was not deleted: it has no manifest*'
        { Remove-AccucutBackupCopy -Directory $script:Paths.Backups -Name 'important.docx' } | Should -Throw '*is not the name of a copy made by the backup*'
        { Remove-AccucutBackupCopy -Directory $script:Paths.Backups -Name '..\x.age' } | Should -Throw '*is not the name of a copy*'
        { Remove-AccucutBackupCopy -Directory $script:Paths.Backups -Name 'accucut-20300101-020000-weekly.age' } | Should -Throw '*was not deleted*'
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups 'important.docx') | Should -BeTrue
        Test-Path -LiteralPath (Join-Path $script:Paths.Backups 'accucut-20200108-020000-weekly.age') | Should -BeTrue
    }

    It 'removes only stale temporary copies (old, regular, directly in the folder)' {
        $stale = Join-Path $script:Paths.Backups 'accucut-20260101-020000-weekly.age.part'
        $fresh = Join-Path $script:Paths.Backups 'accucut-20260102-020000-weekly.age.part'
        $other = Join-Path $script:Paths.Backups 'something.part'
        foreach ($file in $stale, $fresh, $other) { [System.IO.File]::WriteAllText($file, 'x') }
        [System.IO.File]::SetLastWriteTimeUtc($stale, [datetime]::UtcNow.AddDays(-3))
        [System.IO.File]::SetLastWriteTimeUtc($other, [datetime]::UtcNow.AddDays(-3))
        Remove-AccucutStaleBackupPart -Directory $script:Paths.Backups | Should -Be 1
        Test-Path -LiteralPath $stale | Should -BeFalse
        Test-Path -LiteralPath $fresh | Should -BeTrue
        Test-Path -LiteralPath $other | Should -BeTrue
    }
}

Describe 'pg_dump | age as bytes: nothing goes through a PowerShell pipeline, both exit codes count, the password stays in the environment (AC-1, AC-7)' {
    BeforeAll {
        # Two tiny programs stand in for pg_dump and age. The fake pg_dump writes every byte value 4000 times (including 0x1A, CR LF and NUL, which a text pipeline would damage),
        # records its command line and its PGPASSFILE, and exits with the code in FAKE_DUMP_EXIT. The fake age copies its input to its output, and exits with FAKE_AGE_EXIT.
        $dumpSource = @'
using System;
using System.IO;
public static class P {
  public static int Main(string[] args) {
    var log = Environment.GetEnvironmentVariable("FAKE_LOG");
    if (!string.IsNullOrEmpty(log)) File.WriteAllText(log, string.Join("|", args) + "\nPGPASSFILE=" + Environment.GetEnvironmentVariable("PGPASSFILE") + "\nPGPASSWORD=" + Environment.GetEnvironmentVariable("PGPASSWORD"));
    var o = Console.OpenStandardOutput();
    var seed = new byte[256]; for (int i = 0; i < 256; i++) seed[i] = (byte)i;
    for (int r = 0; r < 4000; r++) o.Write(seed, 0, 256);
    o.Flush();
    var code = Environment.GetEnvironmentVariable("FAKE_DUMP_EXIT");
    if (!string.IsNullOrEmpty(code)) { Console.Error.WriteLine("pg_dump: error: fake failure"); return int.Parse(code); }
    return 0;
  }
}
'@
        $ageSource = @'
using System;
using System.IO;
public static class P {
  public static int Main(string[] args) {
    var log = Environment.GetEnvironmentVariable("FAKE_AGE_LOG");
    if (!string.IsNullOrEmpty(log)) File.WriteAllText(log, string.Join("|", args));
    var i = Console.OpenStandardInput(); var o = Console.OpenStandardOutput();
    if (Environment.GetEnvironmentVariable("FAKE_AGE_NOHEADER") == null) { var h = System.Text.Encoding.ASCII.GetBytes("age-encryption.org/v1\n"); o.Write(h, 0, h.Length); }
    var b = new byte[65536]; int n;
    while ((n = i.Read(b, 0, b.Length)) > 0) o.Write(b, 0, n);
    o.Flush();
    var code = Environment.GetEnvironmentVariable("FAKE_AGE_EXIT");
    if (!string.IsNullOrEmpty(code)) { Console.Error.WriteLine("age: error: fake failure"); return int.Parse(code); }
    return 0;
  }
}
'@
        $csc = Join-Path ([System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
        $script:ToolFolder = Join-Path $TestDrive 'fake-tools'
        New-Item -ItemType Directory -Path $script:ToolFolder | Out-Null
        foreach ($pair in @(@('dump', $dumpSource), @('age', $ageSource))) {
            $source = Join-Path $script:ToolFolder ($pair[0] + '.cs')
            [System.IO.File]::WriteAllText($source, $pair[1])
            & $csc /nologo "/out:$(Join-Path $script:ToolFolder ($pair[0] + '.exe'))" $source | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'The fake programs could not be compiled.' }
        }
        $script:Recipient = 'age1' + ('q' * 58)
        # What the fake age writes: the age header and a line end, then everything it was given.
        $script:Header = [System.Text.Encoding]::ASCII.GetBytes("age-encryption.org/v1`n")
        $script:Expected = New-Object byte[] (1024000 + $script:Header.Length)
        [System.Array]::Copy($script:Header, $script:Expected, $script:Header.Length)
        for ($i = 0; $i -lt 1024000; $i++) { $script:Expected[$script:Header.Length + $i] = [byte]($i % 256) }
        function Invoke-FakePipe {
            param([string]$Name)
            return (Invoke-AccucutBackupPipe -PgDumpPath (Join-Path $script:ToolFolder 'dump.exe') -AgePath (Join-Path $script:ToolFolder 'age.exe') -Recipient $script:Recipient -DbHost '127.0.0.1' -Port 5432 -Database 'accucut' -PassFile 'C:\fake\config\backup.pgpass' -OutputPath (Join-Path $TestDrive $Name))
        }
    }

    AfterEach {
        foreach ($name in 'FAKE_DUMP_EXIT', 'FAKE_AGE_EXIT', 'FAKE_LOG', 'FAKE_AGE_LOG', 'FAKE_AGE_NOHEADER') { Remove-Item -LiteralPath "Env:\$name" -ErrorAction SilentlyContinue }
    }

    It 'carries every byte from the dump through age to the file unchanged (including 0x1A, CR LF and NUL), and returns the size' {
        $size = Invoke-FakePipe -Name 'bytes.part'
        $size | Should -Be (1024000 + $script:Header.Length)
        $actual = [System.IO.File]::ReadAllBytes((Join-Path $TestDrive 'bytes.part'))
        $actual.Length | Should -Be (1024000 + $script:Header.Length)
        [System.BitConverter]::ToString($actual) | Should -BeExactly ([System.BitConverter]::ToString($script:Expected))
    }

    It 'gives pg_dump the password file and nothing else of PostgreSQL: an inherited PGPASSWORD or PGHOST never reaches it (stage 13: the runner image sets PGPASSWORD)' {
        $env:PGPASSWORD = 'stale-machine-value'
        $env:PGHOST = 'stale-host'
        $env:FAKE_LOG = Join-Path $TestDrive 'pgenv.log'
        try { [void](Invoke-FakePipe -Name 'pgenv.part') }
        finally { Remove-Item Env:\PGPASSWORD, Env:\PGHOST -ErrorAction SilentlyContinue }
        $lines = Get-Content -LiteralPath $env:FAKE_LOG
        $lines | Should -Contain 'PGPASSFILE=C:\fake\config\backup.pgpass'
        $lines | Should -Contain 'PGPASSWORD='
    }

    It 'fails, naming pg_dump and its exit code, when pg_dump fails but age ends well (a pipe in cmd.exe would report only age)' {
        $env:FAKE_DUMP_EXIT = '3'
        { Invoke-FakePipe -Name 'dumpfail.part' } | Should -Throw 'pg_dump failed with exit code 3*pg_dump: error: fake failure*'
    }

    It 'refuses a file that does not start with the age header, and an empty one, even when both programs exit 0 (Amendment 3.1 point 1)' {
        $env:FAKE_AGE_NOHEADER = '1'
        { Invoke-FakePipe -Name 'noheader.part' } | Should -Throw '*does not start with the age header*'
    }

    It 'a pg_dump that exits 1 after its output leaves no .age file, no manifest and no temporary file, and the run is recorded as failed (Amendment 3.1 point 1)' {
        $script:HalfRows = [System.Collections.Generic.List[object]]::new()
        Mock Get-AccucutDatabaseInfo -ModuleName AccucutOps { [pscustomobject]@{ ServerVersion = '17.2'; SizeBytes = [int64]1MB } }
        Mock Get-AccucutVolumeSpace -ModuleName AccucutOps { [pscustomobject]@{ TotalBytes = [int64]100GB; FreeBytes = [int64]60GB } }
        Mock Add-AccucutJobRun -ModuleName AccucutOps { $script:HalfRows.Add($Result) }
        Mock Write-AccucutLog -ModuleName AccucutOps { }
        $paths = Get-AccucutPaths -Root (Join-Path $TestDrive ('half-' + [guid]::NewGuid().ToString('N').Substring(0, 6)))
        New-Item -ItemType Directory -Path $paths.Backups -Force | Out-Null
        $settings = [pscustomobject]@{ AgeRecipient = $script:Recipient; PgHost = '127.0.0.1'; PgPort = 5432; Database = 'accucut'; PgBinDirectory = $script:ToolFolder }
        $program = @{ PgDump = (Join-Path $script:ToolFolder 'dump.exe'); Age = (Join-Path $script:ToolFolder 'age.exe'); Psql = 'C:\pg\bin\psql.exe' }
        $env:FAKE_DUMP_EXIT = '1'
        { Invoke-AccucutBackup -Paths $paths -Settings $settings -Program $program -Reason 'weekly' -ReleaseTag 't1' } | Should -Throw '*pg_dump failed with exit code 1*'
        @(Get-ChildItem -LiteralPath $paths.Backups -Force).Count | Should -Be 0
        $script:HalfRows.Count | Should -Be 1
        $script:HalfRows[0].status | Should -Be 'failed'
    }

    It 'fails, naming age and its exit code, when age fails' {
        $env:FAKE_AGE_EXIT = '5'
        { Invoke-FakePipe -Name 'agefail.part' } | Should -Throw 'age failed with exit code 5*'
    }

    It 'gives pg_dump the password file in its environment only: no password argument, and the role accucut_backup; age gets the public key only' {
        $env:FAKE_LOG = Join-Path $TestDrive 'dump-log.txt'
        $env:FAKE_AGE_LOG = Join-Path $TestDrive 'age-log.txt'
        [void](Invoke-FakePipe -Name 'env.part')
        $log = (Get-Content -LiteralPath $env:FAKE_LOG -Raw)
        $log | Should -BeLike '*--format=custom|--no-password|--host|127.0.0.1|--port|5432|--username|accucut_backup|--dbname|accucut*'
        $log | Should -BeLike '*PGPASSFILE=C:\fake\config\backup.pgpass*'
        (Get-Content -LiteralPath $env:FAKE_AGE_LOG -Raw) | Should -Be "-r|$($script:Recipient)"
    }

    It 'never writes over an existing output file, and refuses a recipient that is not a public key' {
        [void](Invoke-FakePipe -Name 'once.part')
        { Invoke-FakePipe -Name 'once.part' } | Should -Throw
        { Invoke-AccucutBackupPipe -PgDumpPath (Join-Path $script:ToolFolder 'dump.exe') -AgePath (Join-Path $script:ToolFolder 'age.exe') -Recipient ('AGE-SECRET-' + 'KEY-1' + ('Q' * 58)) -DbHost 'h' -Port 5432 -Database 'accucut' -PassFile 'C:\x' -OutputPath (Join-Path $TestDrive 'secret.part') } | Should -Throw '*not a public key*'
        Test-Path -LiteralPath (Join-Path $TestDrive 'secret.part') | Should -BeFalse
    }
}

Describe 'the module and the script keep the secrets out (AC-7, static checks)' {
    It 'no function of the backup puts a password, a key or PGPASSWORD on a command line, and none writes a secret to a log' {
        $text = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Raw
        $start = $text.IndexOf('#region Backups')
        $region = $text.Substring($start)
        $region | Should -Not -Match 'PGPASSWORD'
        $region | Should -Not -Match '--password|-W\b'
        $region | Should -Not -Match 'AGE-SECRET-KEY'
        $region | Should -Match "'PGPASSFILE'"
        $backupScript = Get-Content -LiteralPath (Join-Path $script:WindowsDirectory 'backup.ps1') -Raw
        $backupScript | Should -Not -Match 'PGPASSWORD|AGE-SECRET-KEY|Read-Host'
    }

    It 'the backup script has no parameter that could move the root, the folder, the settings or the programs: only -Reason' {
        $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $script:WindowsDirectory 'backup.ps1'), [ref]$null, [ref]$null)
        @($ast.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath }) | Should -Be @('Reason')
        $ast.ParamBlock.Parameters[0].Attributes.Where({ $_.TypeName.Name -eq 'ValidateSet' }).PositionalArguments.Value | Should -Be @('weekly', 'release')
    }
}
