#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of the trust block (ADR-015 Amendment 2: code is never loaded or run before it has been checked, and never checked with functions from
  the code being checked). The block lives byte for byte in install.ps1 and update.ps1. Run by CI stage 13 on windows-latest.
  Security descriptors are built from invented entries (a fake tree of paths that need not exist), so each rule is tested without changing a real folder.
  Where a real folder is needed (links, unpacking, the hash) it is under TestDrive. All values are invented.
#>

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    # Dot-sourcing defines the functions (and the trust block's variables) and does not run the install (it runs only when the script is started, not sourced).
    . (Join-Path $script:WindowsDirectory 'install.ps1')
    $script:InstallText = [System.IO.File]::ReadAllText((Join-Path $script:WindowsDirectory 'install.ps1'))
    $script:UpdateText = [System.IO.File]::ReadAllText((Join-Path $script:WindowsDirectory 'update.ps1'))

    $script:Admins = 'S-1-5-32-544'
    $script:System = 'S-1-5-18'
    $script:TrustedInstaller = 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'
    $script:Users = 'S-1-5-32-545'
    $script:AuthUsers = 'S-1-5-11'
    $script:Everyone = 'S-1-1-0'
    $script:CreatorOwner = 'S-1-3-0'
    $script:OtherUser = 'S-1-5-21-1111111111-2222222222-3333333333-1001'
    $script:Fake = @{}
    $script:FakeDefaultTrusted = $false

    function New-FakeAce {
        param([string]$Sid, [int]$Mask, [switch]$Inherit, [switch]$InheritOnly, [switch]$Inherited, [switch]$Deny)
        return [pscustomobject]@{ Sid = $Sid; Mask = $Mask; Inherit = $Inherit.IsPresent; InheritOnly = $InheritOnly.IsPresent; Inherited = $Inherited.IsPresent; Deny = $Deny.IsPresent }
    }

    # A security descriptor from invented entries, run through the real ConvertFrom-AccucutTrustDescriptor.
    function New-FakeSecurity {
        param(
            [Parameter(Mandatory)][string]$Path,
            [string]$Owner = 'S-1-5-32-544',
            [object[]]$Ace = @(),
            [switch]$NotProtected,
            [switch]$Link,
            [switch]$File,
            [switch]$NullAcl
        )
        $ownerSid = [System.Security.Principal.SecurityIdentifier]::new($Owner)
        $acl = $null
        $flags = [System.Security.AccessControl.ControlFlags]::None
        if (-not $NullAcl) {
            $acl = [System.Security.AccessControl.RawAcl]::new(2, 0)
            $position = 0
            foreach ($entry in $Ace) {
                $aceFlags = 0
                if ($entry.Inherit) { $aceFlags += 3 }
                if ($entry.InheritOnly) { $aceFlags += 8 }
                if ($entry.Inherited) { $aceFlags += 16 }
                $qualifier = [System.Security.AccessControl.AceQualifier]::AccessAllowed
                if ($entry.Deny) { $qualifier = [System.Security.AccessControl.AceQualifier]::AccessDenied }
                $common = [System.Security.AccessControl.CommonAce]::new([System.Security.AccessControl.AceFlags]$aceFlags, $qualifier, [int]$entry.Mask, [System.Security.Principal.SecurityIdentifier]::new($entry.Sid), $false, $null)
                $acl.InsertAce($position, $common)
                $position++
            }
            $flags = [System.Security.AccessControl.ControlFlags]'DiscretionaryAclPresent'
            if (-not $NotProtected) { $flags = [System.Security.AccessControl.ControlFlags]'DiscretionaryAclPresent, DiscretionaryAclProtected' }
        }
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

    # A tree like the real one: the Windows default drive root, then C:\Accucut and everything under it locked to Administrators and SYSTEM.
    function Initialize-FakeTree {
        $script:Fake = @{}
        $script:FakeDefaultTrusted = $false
        $rootAces = @(
            (New-FakeAce -Sid $script:Admins -Mask 0x1F01FF -Inherit), (New-FakeAce -Sid $script:System -Mask 0x1F01FF -Inherit),
            (New-FakeAce -Sid $script:Users -Mask 0x1200A9 -Inherit), (New-FakeAce -Sid $script:AuthUsers -Mask 0x100006),
            (New-FakeAce -Sid $script:AuthUsers -Mask 0x1301BF -Inherit -InheritOnly)
        )
        Set-FakeSecurity 'C:\' (New-FakeSecurity -Path 'C:\' -Owner $script:System -Ace $rootAces -NotProtected)
        Set-FakeSecurity 'C:\Accucut' (New-FakeSecurity -Path 'C:\Accucut' -Ace (New-FullControl))
        foreach ($path in 'C:\Accucut\releases', 'C:\Accucut\releases\t1', 'C:\Accucut\config', 'C:\Accucut\services', 'C:\Accucut\logs') {
            Set-FakeSecurity $path (New-FakeSecurity -Path $path -Ace (New-FullControl) -NotProtected)
        }
        foreach ($path in 'C:\Accucut\releases\t1\AccucutOps.psm1', 'C:\Accucut\releases\t1\install.ps1') {
            Set-FakeSecurity $path (New-FakeSecurity -Path $path -Ace (New-FullControl) -NotProtected -File)
        }
    }

    $script:ModulePath = 'C:\Accucut\releases\t1\AccucutOps.psm1'
}

Describe 'the trust block is one copy, in both scripts (required test 1)' {
    It 'is byte for byte the same in install.ps1 and update.ps1, and each script has exactly one pair of markers' {
        $pattern = '(?s)# >>> ACCUCUT TRUST BLOCK v1\r?\n.*?# <<< ACCUCUT TRUST BLOCK v1'
        ([regex]::Matches($script:InstallText, '# >>> ACCUCUT TRUST BLOCK v1')).Count | Should -Be 1
        ([regex]::Matches($script:UpdateText, '# >>> ACCUCUT TRUST BLOCK v1')).Count | Should -Be 1
        ([regex]::Matches($script:InstallText, '# <<< ACCUCUT TRUST BLOCK v1')).Count | Should -Be 1
        ([regex]::Matches($script:UpdateText, '# <<< ACCUCUT TRUST BLOCK v1')).Count | Should -Be 1
        $install = [regex]::Match($script:InstallText, $pattern).Value
        $update = [regex]::Match($script:UpdateText, $pattern).Value
        $install.Length | Should -BeGreaterThan 10000
        $install | Should -BeExactly $update
    }
}

Describe 'the trust block is self-contained, and nothing is loaded or run unchecked (required tests 2 and 5)' {
    BeforeAll {
        function Get-ScriptAst {
            param([string]$Text)
            return [System.Management.Automation.Language.Parser]::ParseInput($Text, [ref]$null, [ref]$null)
        }
        function Get-CommandNames {
            # The command names of all the command calls inside one node (a function's body, say), with the offset of each.
            param($Node)
            $found = $Node.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true)
            return @($found | ForEach-Object { [pscustomobject]@{ Name = [string]$_.GetCommandName(); Offset = $_.Extent.StartOffset; Operator = [string]$_.InvocationOperator } })
        }
        function Get-FunctionAst {
            param($Ast, [string]$Name)
            return $Ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $Name }, $true)
        }
        $script:BlockFunctionNames = @(
            'ConvertTo-AccucutTrustMask', 'Get-AccucutTrustSecurity', 'ConvertFrom-AccucutTrustDescriptor', 'Get-AccucutTrustComponent', 'Assert-AccucutTrustedAbove',
            'Assert-AccucutTrustedBelow', 'Assert-AccucutTrustedPath', 'Assert-AccucutTrustedRootShape', 'New-AccucutTrustedRoot', 'Get-AccucutTrustedSha256',
            'Remove-AccucutTrustedTree', 'Assert-AccucutTrustedNoLinks', 'Expand-AccucutTrustedPackage', 'Get-AccucutTrustedCurrent', 'Resolve-AccucutTrustedExecutable',
            'Import-AccucutTrustedModule', 'ConvertTo-AccucutTrustedArgument', 'Invoke-AccucutTrustedScript'
        )
        $script:Asts = @{ 'install.ps1' = (Get-ScriptAst -Text $script:InstallText); 'update.ps1' = (Get-ScriptAst -Text $script:UpdateText) }
        $script:Texts = @{ 'install.ps1' = $script:InstallText; 'update.ps1' = $script:UpdateText }
    }

    It 'the block defines exactly its 18 functions, and calls only them, plus module-qualified Import-Module and Get-Item (<File>)' -ForEach @(@{ File = 'install.ps1' }, @{ File = 'update.ps1' }) {
        $text = $script:Texts[$File]
        $start = $text.IndexOf('# >>> ACCUCUT TRUST BLOCK v1')
        $end = $text.IndexOf('# <<< ACCUCUT TRUST BLOCK v1')
        $block = $text.Substring($start, $end - $start)
        $blockAst = Get-ScriptAst -Text $block
        $defined = @($blockAst.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $false) | ForEach-Object { $_.Name })
        ($defined | Sort-Object) | Should -Be ($script:BlockFunctionNames | Sort-Object)
        $allowed = $script:BlockFunctionNames + @('Microsoft.PowerShell.Core\Import-Module', 'Microsoft.PowerShell.Management\Get-Item')
        foreach ($call in (Get-CommandNames -Node $blockAst)) {
            $call.Name | Should -BeIn $allowed -Because 'the block may not call a cmdlet that a module could shadow'
            $call.Operator | Should -Be 'Unknown' -Because 'no call operator and no dot-sourcing'
        }
    }

    It 'neither script dot-sources, uses the call operator, Start-Process, Invoke-Expression, or a using-module statement (<File>)' -ForEach @(@{ File = 'install.ps1' }, @{ File = 'update.ps1' }) {
        $ast = $script:Asts[$File]
        foreach ($call in (Get-CommandNames -Node $ast)) {
            $call.Operator | Should -Be 'Unknown'
            $call.Name | Should -Not -BeIn @('Start-Process', 'Invoke-Expression', 'Invoke-Item', 'Add-Type', 'Invoke-Command')
        }
        $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.UsingStatementAst] }, $true).Count | Should -Be 0
    }

    It 'Import-Module is called in one place only, Import-AccucutTrustedModule, and Import-AccucutTrustedModule in one place only (<File>)' -ForEach @(@{ File = 'install.ps1'; Caller = 'Invoke-AccucutInstallSecondHalf' }, @{ File = 'update.ps1'; Caller = 'Import-AccucutUpdateEnvironment' }) {
        $ast = $script:Asts[$File]
        $imports = @(Get-CommandNames -Node $ast | Where-Object { $_.Name -like '*Import-Module' })
        $imports.Count | Should -Be 1
        (Get-FunctionAst -Ast $ast -Name 'Import-AccucutTrustedModule').Extent.StartOffset | Should -BeLessThan $imports[0].Offset
        (Get-FunctionAst -Ast $ast -Name 'Import-AccucutTrustedModule').Extent.EndOffset | Should -BeGreaterThan $imports[0].Offset
        $loads = @(Get-CommandNames -Node $ast | Where-Object { $_.Name -eq 'Import-AccucutTrustedModule' })
        $loads.Count | Should -Be 1
        $function = Get-FunctionAst -Ast $ast -Name $Caller
        $loads[0].Offset | Should -BeGreaterThan $function.Extent.StartOffset
        $loads[0].Offset | Should -BeLessThan $function.Extent.EndOffset
    }

    It 'a child powershell.exe is started in one place only, Invoke-AccucutTrustedScript, and no other process is started except cmd.exe for rd (<File>)' -ForEach @(@{ File = 'install.ps1' }, @{ File = 'update.ps1' }) {
        $ast = $script:Asts[$File]
        $starts = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and [string]$n.Member.Value -eq 'Start' -and $n.Expression.Extent.Text -like '*Diagnostics.Process*' }, $true))
        $starts.Count | Should -Be 2
        $inRun = Get-FunctionAst -Ast $ast -Name 'Invoke-AccucutTrustedScript'
        $inRemove = Get-FunctionAst -Ast $ast -Name 'Remove-AccucutTrustedTree'
        foreach ($start in $starts) {
            $offset = $start.Extent.StartOffset
            $inside = (($offset -gt $inRun.Extent.StartOffset -and $offset -lt $inRun.Extent.EndOffset) -or ($offset -gt $inRemove.Extent.StartOffset -and $offset -lt $inRemove.Extent.EndOffset))
            $inside | Should -BeTrue
        }
    }

    It 'Invoke-AccucutTrustedScript runs a script only after the program and the script have been checked, and logs the run after the check (required test 5)' {
        $ast = $script:Asts['install.ps1']
        $function = Get-FunctionAst -Ast $ast -Name 'Invoke-AccucutTrustedScript'
        $calls = @(Get-CommandNames -Node $function)
        $offsetOf = { param($name) ($calls | Where-Object { $_.Name -eq $name } | Select-Object -First 1).Offset }
        (& $offsetOf 'Resolve-AccucutTrustedExecutable') | Should -BeLessThan (& $offsetOf 'Assert-AccucutTrustedPath')
        $startOffset = $function.Extent.Text.IndexOf('Process]::Start')
        $startOffset | Should -BeGreaterThan 0
        ($function.Extent.StartOffset + $startOffset) | Should -BeGreaterThan (& $offsetOf 'Assert-AccucutTrustedPath')
    }

    It 'in the first half of the install, only the trust block and a few plain functions are called: the module is not loaded and none of its functions is used (required test 2)' {
        $ast = $script:Asts['install.ps1']
        $allowed = $script:BlockFunctionNames + @('Test-AccucutScriptAdministrator', 'Get-AccucutExpectedSha256', 'Write-Host')
        foreach ($name in 'Invoke-AccucutInstallFirstHalf', 'Test-AccucutScriptAdministrator', 'Get-AccucutExpectedSha256', 'Assert-AccucutSecondHalfLocation') {
            foreach ($call in (Get-CommandNames -Node (Get-FunctionAst -Ast $ast -Name $name))) {
                $call.Name | Should -BeIn $allowed -Because "$name runs before anything has been checked"
            }
        }
    }

    It 'before the module is loaded, only the trust block and a few plain functions are called, in the second half of the install and in the update (required test 2)' -ForEach @(
        @{ File = 'install.ps1'; Name = 'Invoke-AccucutInstallSecondHalf' }
        @{ File = 'update.ps1'; Name = 'Import-AccucutUpdateEnvironment' }
    ) {
        $ast = $script:Asts[$File]
        $function = Get-FunctionAst -Ast $ast -Name $Name
        $allowed = $script:BlockFunctionNames + @('Test-AccucutScriptAdministrator', 'Assert-AccucutSecondHalfLocation', 'Get-AccucutUpdateServiceSid')
        $load = @(Get-CommandNames -Node $function | Where-Object { $_.Name -eq 'Import-AccucutTrustedModule' })[0]
        foreach ($call in (Get-CommandNames -Node $function | Where-Object { $_.Offset -lt $load.Offset })) {
            $call.Name | Should -BeIn $allowed -Because 'a function of the module may not run before the module has been checked and loaded'
        }
        # The checks come first: a trust check of the module file is among the calls before the load.
        @(Get-CommandNames -Node $function | Where-Object { $_.Offset -lt $load.Offset -and $_.Name -eq 'Assert-AccucutTrustedPath' }).Count | Should -BeGreaterThan 0
    }

    It 'the module is never dot-sourced or imported by a script before the entry guard, and nothing runs at the top level except parameters, strict mode, variables and functions (<File>)' -ForEach @(@{ File = 'install.ps1' }, @{ File = 'update.ps1' }) {
        $ast = $script:Asts[$File]
        foreach ($statement in $ast.EndBlock.Statements) {
            $text = $statement.Extent.Text
            $ok = ($statement -is [System.Management.Automation.Language.FunctionDefinitionAst]) -or
                ($statement -is [System.Management.Automation.Language.AssignmentStatementAst]) -or
                ($statement -is [System.Management.Automation.Language.IfStatementAst] -and $text -like '*$MyInvocation.InvocationName -ne ''.''*') -or
                ($statement -is [System.Management.Automation.Language.PipelineAst] -and $text -match '^Set-StrictMode\b')
            $ok | Should -BeTrue -Because "the top level of $File may not run anything: $($text.Substring(0, [math]::Min(60, $text.Length)))"
        }
    }
}

Describe 'rule B: the root and everything below it' {
    BeforeEach {
        Initialize-FakeTree
        Mock Get-AccucutTrustSecurity {
            $key = $Path.TrimEnd('\').ToLowerInvariant()
            if ($script:Fake.ContainsKey($key)) { return $script:Fake[$key] }
            throw "the test has no security for '$Path'"
        }
        $script:AccucutTrustLog.Clear()
    }

    It 'accepts the locked tree, and writes the checked path to the trust log' {
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Not -Throw
        $script:AccucutTrustLog | Should -Contain "check:$($script:ModulePath)"
    }

    It 'refuses a link at every part of the path, from the drive root to the file (required test 7: <Name>)' -ForEach @(
        @{ Name = 'the drive root'; Component = 'C:\' }
        @{ Name = 'the install root'; Component = 'C:\Accucut' }
        @{ Name = 'releases'; Component = 'C:\Accucut\releases' }
        @{ Name = 'the release folder'; Component = 'C:\Accucut\releases\t1' }
        @{ Name = 'the module file'; Component = 'C:\Accucut\releases\t1\AccucutOps.psm1' }
    ) {
        $good = $script:Fake[$Component.TrimEnd('\').ToLowerInvariant()]
        $isFile = -not $good.IsDirectory
        $ace = @($good.Aces | ForEach-Object { New-FakeAce -Sid $_.Sid -Mask ([int]$_.Mask) })
        Set-FakeSecurity $Component (New-FakeSecurity -Path $Component -Owner $good.Owner -Ace $ace -Link -File:$isFile -NotProtected:(-not $good.Protected))
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Throw '*is a link*'
    }

    It 'refuses a part that is owned by someone else, a user or Everyone (required test 8: <Owner>)' -ForEach @(
        @{ Owner = 'S-1-5-32-545' }
        @{ Owner = 'S-1-5-21-1111111111-2222222222-3333333333-1001' }
        @{ Owner = 'S-1-1-0' }
    ) {
        Set-FakeSecurity 'C:\Accucut\releases' (New-FakeSecurity -Path 'C:\Accucut\releases' -Owner $Owner -Ace (New-FullControl) -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Throw '*is owned by*'
    }

    It 'accepts SYSTEM and TrustedInstaller as owners' {
        Set-FakeSecurity 'C:\Accucut\releases' (New-FakeSecurity -Path 'C:\Accucut\releases' -Owner $script:System -Ace (New-FullControl) -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Not -Throw
        Set-FakeSecurity 'C:\Accucut\releases' (New-FakeSecurity -Path 'C:\Accucut\releases' -Owner $script:TrustedInstaller -Ace (New-FullControl) -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Not -Throw
    }

    It 'refuses a root that inherits its permissions, when a protected root is required' {
        Set-FakeSecurity 'C:\Accucut' (New-FakeSecurity -Path 'C:\Accucut' -Ace (New-FullControl) -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Throw '*inherits its permissions*'
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' } | Should -Not -Throw
    }

    It 'refuses write, modify, full, append, delete and take-ownership rights for an ordinary account, whether the entry is inherited or not (<Name>)' -ForEach @(
        @{ Name = 'Users: modify'; Sid = 'S-1-5-32-545'; Mask = 0x1301BF }
        @{ Name = 'Users: write data'; Sid = 'S-1-5-32-545'; Mask = 0x1200A9 + 2 }
        @{ Name = 'Users: append data'; Sid = 'S-1-5-32-545'; Mask = 0x1200A9 + 4 }
        @{ Name = 'Authenticated Users: full'; Sid = 'S-1-5-11'; Mask = 0x1F01FF }
        @{ Name = 'Everyone: delete'; Sid = 'S-1-1-0'; Mask = 0x1200A9 + 0x10000 }
        @{ Name = 'a user: delete child'; Sid = 'S-1-5-21-1111111111-2222222222-3333333333-1001'; Mask = 0x1200A9 + 0x40 }
        @{ Name = 'a user: write DAC'; Sid = 'S-1-5-21-1111111111-2222222222-3333333333-1001'; Mask = 0x1200A9 + 0x40000 }
        @{ Name = 'a user: write owner'; Sid = 'S-1-5-21-1111111111-2222222222-3333333333-1001'; Mask = 0x1200A9 + 0x80000 }
    ) {
        $ace = (New-FullControl) + @((New-FakeAce -Sid $Sid -Mask $Mask -Inherited))
        Set-FakeSecurity 'C:\Accucut\releases\t1' (New-FakeSecurity -Path 'C:\Accucut\releases\t1' -Ace $ace -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Throw '*can be changed by*'
    }

    It 'maps the generic rights before any test: GENERIC_ALL, GENERIC_WRITE, and GENERIC_READ plus GENERIC_EXECUTE (required test 9: <Name>)' -ForEach @(
        @{ Name = 'GENERIC_ALL'; Mask = 0x10000000; Refused = $true }
        @{ Name = 'GENERIC_WRITE'; Mask = 0x40000000; Refused = $true }
        @{ Name = 'GENERIC_READ'; Mask = -2147483648; Refused = $false }
        @{ Name = 'GENERIC_EXECUTE'; Mask = 0x20000000; Refused = $false }
        @{ Name = 'GENERIC_READ and EXECUTE'; Mask = (-2147483648 + 0x20000000); Refused = $false }
    ) {
        $ace = (New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask $Mask))
        Set-FakeSecurity 'C:\Accucut\releases\t1' (New-FakeSecurity -Path 'C:\Accucut\releases\t1' -Ace $ace -NotProtected)
        if ($Refused) { { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Throw '*can be changed by*' }
        else { { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Not -Throw }
    }

    It 'turns the generic bits into the specific rights they stand for' {
        ConvertTo-AccucutTrustMask -AccessMask 0x10000000 | Should -Be 0x1F01FF
        ConvertTo-AccucutTrustMask -AccessMask 0x40000000 | Should -Be 0x120116
        ConvertTo-AccucutTrustMask -AccessMask -2147483648 | Should -Be 0x120089
        ConvertTo-AccucutTrustMask -AccessMask 0x20000000 | Should -Be 0x1200A0
        ConvertTo-AccucutTrustMask -AccessMask 0x1200A9 | Should -Be 0x1200A9
    }

    It 'counts CREATOR OWNER and OWNER RIGHTS as ordinary accounts: an entry that is not inherit-only is refused; an inherit-only CREATOR OWNER entry is the one exception (required test 10)' {
        $creator = (New-FullControl) + @((New-FakeAce -Sid $script:CreatorOwner -Mask 0x1F01FF -Inherit))
        Set-FakeSecurity 'C:\Accucut\releases\t1' (New-FakeSecurity -Path 'C:\Accucut\releases\t1' -Ace $creator -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Throw '*S-1-3-0*'
        $creatorOnly = (New-FullControl) + @((New-FakeAce -Sid $script:CreatorOwner -Mask 0x1F01FF -Inherit -InheritOnly))
        Set-FakeSecurity 'C:\Accucut\releases\t1' (New-FakeSecurity -Path 'C:\Accucut\releases\t1' -Ace $creatorOnly -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Not -Throw
        $ownerRights = (New-FullControl) + @((New-FakeAce -Sid 'S-1-3-4' -Mask 0x1F01FF -Inherit -InheritOnly))
        Set-FakeSecurity 'C:\Accucut\releases\t1' (New-FakeSecurity -Path 'C:\Accucut\releases\t1' -Ace $ownerRights -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Throw '*S-1-3-4*'
    }

    It 'checks an inherit-only entry of any other account below the root: it would reach the children (required test 11)' {
        $inheritOnly = (New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1301BF -Inherit -InheritOnly))
        Set-FakeSecurity 'C:\Accucut\releases' (New-FakeSecurity -Path 'C:\Accucut\releases' -Ace $inheritOnly -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Throw '*inherit-only: True*'
    }

    It 'ignores a deny entry, which can only take rights away' {
        $deny = (New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1F01FF -Deny))
        Set-FakeSecurity 'C:\Accucut\releases\t1' (New-FakeSecurity -Path 'C:\Accucut\releases\t1' -Ace $deny -NotProtected)
        { Assert-AccucutTrustedPath -Path $script:ModulePath -Root 'C:\Accucut' -ProtectedRoot } | Should -Not -Throw
    }

    It 'allows another writer only on the logs folder, and only the listed account (-Writer)' {
        $logAce = (New-FullControl) + @((New-FakeAce -Sid $script:OtherUser -Mask 0x1301BF -Inherit))
        Set-FakeSecurity 'C:\Accucut\logs' (New-FakeSecurity -Path 'C:\Accucut\logs' -Ace $logAce -NotProtected)
        { Assert-AccucutTrustedPath -Path 'C:\Accucut\logs' -Root 'C:\Accucut' -ProtectedRoot } | Should -Throw '*can be changed by*'
        { Assert-AccucutTrustedPath -Path 'C:\Accucut\logs' -Root 'C:\Accucut' -ProtectedRoot -Writer @($script:OtherUser) } | Should -Not -Throw
        { Assert-AccucutTrustedPath -Path 'C:\Accucut\logs' -Root 'C:\Accucut' -ProtectedRoot -Writer @('S-1-5-21-9-9-9-1') } | Should -Throw '*can be changed by*'
        # ... but not full control, and not on the way down to a deeper path.
        $full = (New-FullControl) + @((New-FakeAce -Sid $script:OtherUser -Mask 0x1F01FF -Inherit))
        Set-FakeSecurity 'C:\Accucut\logs' (New-FakeSecurity -Path 'C:\Accucut\logs' -Ace $full -NotProtected)
        { Assert-AccucutTrustedPath -Path 'C:\Accucut\logs' -Root 'C:\Accucut' -ProtectedRoot -Writer @($script:OtherUser) } | Should -Throw '*can be changed by*'
    }

    It 'refuses a path that is not inside the root, a path with .., and a path that is not a full local path' {
        { Assert-AccucutTrustedPath -Path 'C:\Other\file.ps1' -Root 'C:\Accucut' } | Should -Throw '*not inside*'
        { Assert-AccucutTrustedPath -Path 'C:\Accucut2\file.ps1' -Root 'C:\Accucut' } | Should -Throw '*not inside*'
        { Assert-AccucutTrustedPath -Path 'C:\Accucut\releases\..\..\x.ps1' -Root 'C:\Accucut' } | Should -Throw '*not a full local path*'
        { Assert-AccucutTrustedPath -Path '\\server\share\x.ps1' -Root 'C:\Accucut' } | Should -Throw '*not a full local path*'
        { Assert-AccucutTrustedPath -Path 'releases\x.ps1' -Root 'C:\Accucut' } | Should -Throw '*not a full local path*'
    }
}

Describe 'rule A: the drive root and the folders above the root (required test 13)' {
    BeforeEach {
        Initialize-FakeTree
        Mock Get-AccucutTrustSecurity {
            $key = $Path.TrimEnd('\').ToLowerInvariant()
            if ($script:Fake.ContainsKey($key)) { return $script:Fake[$key] }
            throw "the test has no security for '$Path'"
        }
        foreach ($path in 'C:\Program Files', 'C:\Program Files\nodejs') { Set-FakeSecurity $path (New-FakeSecurity -Path $path -Owner $script:TrustedInstaller -Ace (New-FullControl) -NotProtected) }
        Set-FakeSecurity 'C:\Program Files\nodejs\node.exe' (New-FakeSecurity -Path 'C:\Program Files\nodejs\node.exe' -Owner $script:TrustedInstaller -Ace (New-FullControl) -NotProtected -File)
    }

    It 'accepts the Windows default drive root: Users read and execute, Authenticated Users may create folders, and a Modify entry that is inherit-only' {
        { Assert-AccucutTrustedAbove -Path 'C:\' -DriveRoot } | Should -Not -Throw
        { Assert-AccucutTrustedPath -Path 'C:\Accucut\releases' -Root 'C:\Accucut' } | Should -Not -Throw
    }

    It 'refuses on the drive root: full control, GENERIC_ALL, delete child, write DAC and write owner for an ordinary account (<Name>)' -ForEach @(
        @{ Name = 'full control'; Mask = 0x1F01FF }
        @{ Name = 'GENERIC_ALL'; Mask = 0x10000000 }
        @{ Name = 'delete child'; Mask = 0x1200A9 + 0x40 }
        @{ Name = 'write DAC'; Mask = 0x1200A9 + 0x40000 }
        @{ Name = 'write owner'; Mask = 0x1200A9 + 0x80000 }
    ) {
        $ace = @((New-FakeAce -Sid $script:Admins -Mask 0x1F01FF -Inherit), (New-FakeAce -Sid $script:Users -Mask $Mask))
        Set-FakeSecurity 'C:\' (New-FakeSecurity -Path 'C:\' -Owner $script:System -Ace $ace -NotProtected)
        { Assert-AccucutTrustedAbove -Path 'C:\' -DriveRoot } | Should -Throw '*can be deleted, replaced or taken over*'
    }

    It 'ignores an inherit-only entry above the root (it reaches the children only, and each child is checked on its own)' {
        $ace = @((New-FakeAce -Sid $script:Admins -Mask 0x1F01FF -Inherit), (New-FakeAce -Sid $script:Users -Mask 0x1F01FF -Inherit -InheritOnly))
        Set-FakeSecurity 'C:\Program Files' (New-FakeSecurity -Path 'C:\Program Files' -Owner $script:TrustedInstaller -Ace $ace -NotProtected)
        { Assert-AccucutTrustedAbove -Path 'C:\Program Files' } | Should -Not -Throw
    }

    It 'refuses a folder above the root that an ordinary account can delete, replace or take over: Delete is refused here, though not on the drive root (<Name>)' -ForEach @(
        @{ Name = 'delete'; Mask = 0x1200A9 + 0x10000 }
        @{ Name = 'delete child'; Mask = 0x1200A9 + 0x40 }
        @{ Name = 'write DAC'; Mask = 0x1200A9 + 0x40000 }
        @{ Name = 'write owner'; Mask = 0x1200A9 + 0x80000 }
        @{ Name = 'full control'; Mask = 0x1F01FF }
    ) {
        $ace = (New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask $Mask))
        Set-FakeSecurity 'C:\Program Files' (New-FakeSecurity -Path 'C:\Program Files' -Owner $script:TrustedInstaller -Ace $ace -NotProtected)
        { Assert-AccucutTrustedAbove -Path 'C:\Program Files' } | Should -Throw '*can be deleted, replaced or taken over*'
    }

    It 'allows an ordinary account to write into a folder above the root (it cannot delete or replace the folder)' {
        $ace = (New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1200A9 + 2 + 4))
        Set-FakeSecurity 'C:\Program Files' (New-FakeSecurity -Path 'C:\Program Files' -Owner $script:TrustedInstaller -Ace $ace -NotProtected)
        { Assert-AccucutTrustedAbove -Path 'C:\Program Files' } | Should -Not -Throw
    }

    It 'refuses a folder above the root that is owned by an ordinary account, or is a link' {
        Set-FakeSecurity 'C:\Program Files' (New-FakeSecurity -Path 'C:\Program Files' -Owner $script:Users -Ace (New-FullControl) -NotProtected)
        { Assert-AccucutTrustedAbove -Path 'C:\Program Files' } | Should -Throw '*is owned by*'
        Set-FakeSecurity 'C:\Program Files' (New-FakeSecurity -Path 'C:\Program Files' -Owner $script:TrustedInstaller -Ace (New-FullControl) -NotProtected -Link)
        { Assert-AccucutTrustedAbove -Path 'C:\Program Files' } | Should -Throw '*is a link*'
    }

    It 'refuses a drive root that is a link or is owned by an ordinary account' {
        Set-FakeSecurity 'C:\' (New-FakeSecurity -Path 'C:\' -Owner $script:System -Ace (New-FullControl) -NotProtected -Link)
        { Assert-AccucutTrustedAbove -Path 'C:\' -DriveRoot } | Should -Throw '*is a link*'
        Set-FakeSecurity 'C:\' (New-FakeSecurity -Path 'C:\' -Owner $script:Users -Ace (New-FullControl) -NotProtected)
        { Assert-AccucutTrustedAbove -Path 'C:\' -DriveRoot } | Should -Throw '*is owned by*'
    }
}

Describe 'unknown entries are refused, not skipped (required test 14)' {
    It 'refuses an object entry, a callback entry and a descriptor without a list' {
        $sid = [System.Security.Principal.SecurityIdentifier]::new($script:Users)
        $owner = [System.Security.Principal.SecurityIdentifier]::new($script:Admins)
        $flags = [System.Security.AccessControl.ControlFlags]'DiscretionaryAclPresent'
        $directory = [System.IO.FileAttributes]::Directory

        $objectAcl = [System.Security.AccessControl.RawAcl]::new(2, 0)
        $objectAce = [System.Security.AccessControl.ObjectAce]::new([System.Security.AccessControl.AceFlags]::None, [System.Security.AccessControl.AceQualifier]::AccessAllowed, 0x1F01FF, $sid, [System.Security.AccessControl.ObjectAceFlags]::ObjectAceTypePresent, [guid]::NewGuid(), [guid]::Empty, $false, $null)
        $objectAcl.InsertAce(0, $objectAce)
        $withObject = [System.Security.AccessControl.RawSecurityDescriptor]::new($flags, $owner, $owner, $null, $objectAcl)
        { ConvertFrom-AccucutTrustDescriptor -Descriptor $withObject -Path 'C:\x' -Attributes $directory } | Should -Throw '*kind that is not understood*'

        $callbackAcl = [System.Security.AccessControl.RawAcl]::new(2, 0)
        $callbackAce = [System.Security.AccessControl.CommonAce]::new([System.Security.AccessControl.AceFlags]::None, [System.Security.AccessControl.AceQualifier]::AccessAllowed, 0x1F01FF, $sid, $true, [byte[]]@(1, 2, 3, 4))
        $callbackAcl.InsertAce(0, $callbackAce)
        $withCallback = [System.Security.AccessControl.RawSecurityDescriptor]::new($flags, $owner, $owner, $null, $callbackAcl)
        { ConvertFrom-AccucutTrustDescriptor -Descriptor $withCallback -Path 'C:\x' -Attributes $directory } | Should -Throw '*kind that is not understood*'

        $withoutList = [System.Security.AccessControl.RawSecurityDescriptor]::new([System.Security.AccessControl.ControlFlags]::None, $owner, $owner, $null, $null)
        { ConvertFrom-AccucutTrustDescriptor -Descriptor $withoutList -Path 'C:\x' -Attributes $directory } | Should -Throw '*no access list*'
    }

    It 'refuses an audit or alarm entry in the access list' {
        $sid = [System.Security.Principal.SecurityIdentifier]::new($script:Users)
        $owner = [System.Security.Principal.SecurityIdentifier]::new($script:Admins)
        $acl = [System.Security.AccessControl.RawAcl]::new(2, 0)
        $acl.InsertAce(0, [System.Security.AccessControl.CommonAce]::new([System.Security.AccessControl.AceFlags]::None, [System.Security.AccessControl.AceQualifier]::SystemAudit, 0x1F01FF, $sid, $false, $null))
        $descriptor = [System.Security.AccessControl.RawSecurityDescriptor]::new([System.Security.AccessControl.ControlFlags]'DiscretionaryAclPresent', $owner, $owner, $null, $acl)
        { ConvertFrom-AccucutTrustDescriptor -Descriptor $descriptor -Path 'C:\x' -Attributes ([System.IO.FileAttributes]::Directory) } | Should -Throw '*not understood*'
    }
}

Describe 'programs are resolved by their full path, checked, and never looked up through PATH (required test 15)' {
    BeforeEach {
        Initialize-FakeTree
        $script:Program = Join-Path $TestDrive 'tools\tool.exe'
        New-Item -ItemType Directory -Path (Split-Path -Parent $script:Program) -Force | Out-Null
        [System.IO.File]::WriteAllText($script:Program, 'stand-in')
        Mock Get-AccucutTrustSecurity {
            $key = $Path.TrimEnd('\').ToLowerInvariant()
            if ($script:Fake.ContainsKey($key)) { return $script:Fake[$key] }
            return (New-FakeSecurity -Path $Path -Ace (New-FullControl))
        }
    }

    It 'returns the full path of a program whose folder and file are trusted' {
        Resolve-AccucutTrustedExecutable -Path $script:Program | Should -Be $script:Program
    }

    It 'refuses a bare name (PATH), a relative path, a UNC path and a missing file' {
        { Resolve-AccucutTrustedExecutable -Path 'node.exe' } | Should -Throw '*never looked up through PATH*'
        { Resolve-AccucutTrustedExecutable -Path '.\tool.exe' } | Should -Throw '*never looked up through PATH*'
        { Resolve-AccucutTrustedExecutable -Path '\\server\share\tool.exe' } | Should -Throw '*never looked up through PATH*'
        { Resolve-AccucutTrustedExecutable -Path (Join-Path $TestDrive 'tools\missing.exe') } | Should -Throw '*was not found*'
    }

    It 'refuses a program that an ordinary account can write, and one in a folder that an ordinary account can write (DLLs are looked for there first)' {
        $folder = Split-Path -Parent $script:Program
        Set-FakeSecurity $folder (New-FakeSecurity -Path $folder -Ace ((New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1301BF -Inherit))) -NotProtected)
        { Resolve-AccucutTrustedExecutable -Path $script:Program } | Should -Throw '*can be changed by*'
        Initialize-FakeTree
        Set-FakeSecurity $script:Program (New-FakeSecurity -Path $script:Program -Ace ((New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1301BF -Inherited))) -NotProtected -File)
        { Resolve-AccucutTrustedExecutable -Path $script:Program } | Should -Throw '*can be changed by*'
    }

    It 'refuses a program that is a link' {
        Set-FakeSecurity $script:Program (New-FakeSecurity -Path $script:Program -Ace (New-FullControl) -NotProtected -File -Link)
        { Resolve-AccucutTrustedExecutable -Path $script:Program } | Should -Throw '*is a link*'
    }
}

Describe 'loading the module and running a script come after the check (required tests 4 and 5)' {
    BeforeEach {
        Initialize-FakeTree
        $script:Release = Join-Path $TestDrive ('rel-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path $script:Release -Force | Out-Null
        $script:Marker = Join-Path $TestDrive ('marker-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.txt')
        $script:ModuleFile = Join-Path $script:Release 'AccucutOps.psm1'
        # A stand-in for the module that records, when it is loaded, that its code ran: the marker.
        [System.IO.File]::WriteAllText($script:ModuleFile, "[System.IO.File]::WriteAllText('$($script:Marker)', 'loaded')`nfunction Get-TestOnlyMarker { 'marker' }`nExport-ModuleMember -Function Get-TestOnlyMarker`n")
        $script:Script = Join-Path $script:Release 'child.ps1'
        [System.IO.File]::WriteAllText($script:Script, "[System.IO.File]::WriteAllText('$($script:Marker)', 'ran')`nexit 0`n")
        Mock Get-AccucutTrustSecurity {
            $key = $Path.TrimEnd('\').ToLowerInvariant()
            if ($script:Fake.ContainsKey($key)) { return $script:Fake[$key] }
            return (New-FakeSecurity -Path $Path -Ace (New-FullControl))
        }
        $script:AccucutTrustLog.Clear()
    }

    AfterEach { Remove-Module -Name AccucutOps -Force -ErrorAction SilentlyContinue }

    It 'loads the module only after its path has been checked: the log shows check before load, and the code ran only then' {
        Import-AccucutTrustedModule -Root $TestDrive -Release $script:Release
        $log = @($script:AccucutTrustLog)
        $checkAt = [array]::IndexOf($log, "check:$($script:ModuleFile)")
        $loadAt = [array]::IndexOf($log, "load:$($script:ModuleFile)")
        $checkAt | Should -BeGreaterOrEqual 0
        $loadAt | Should -BeGreaterThan $checkAt
        Test-Path -LiteralPath $script:Marker | Should -BeTrue
    }

    It 'does not load a module that fails the check: its code never runs and it is not in the session' {
        Set-FakeSecurity $script:ModuleFile (New-FakeSecurity -Path $script:ModuleFile -Ace ((New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1301BF))) -NotProtected -File)
        { Import-AccucutTrustedModule -Root $TestDrive -Release $script:Release } | Should -Throw '*can be changed by*'
        Test-Path -LiteralPath $script:Marker | Should -BeFalse
        Get-Module -Name AccucutOps | Should -BeNullOrEmpty
        $script:AccucutTrustLog | Should -Not -Contain "load:$($script:ModuleFile)"
    }

    It 'does not load a module from a release folder that is a link' {
        Set-FakeSecurity $script:Release (New-FakeSecurity -Path $script:Release -Ace (New-FullControl) -NotProtected -Link)
        { Import-AccucutTrustedModule -Root $TestDrive -Release $script:Release } | Should -Throw '*is a link*'
        Test-Path -LiteralPath $script:Marker | Should -BeFalse
    }

    It 'runs a script in a child powershell.exe only after the program and the script have been checked, in that order in the log' {
        $code = Invoke-AccucutTrustedScript -Root $TestDrive -Path $script:Script
        $code | Should -Be 0
        (Get-Content -LiteralPath $script:Marker -Raw) | Should -Be 'ran'
        $log = @($script:AccucutTrustLog)
        $powershellCheck = @($log | Where-Object { $_ -like 'check:*powershell.exe' }).Count
        $powershellCheck | Should -BeGreaterThan 0
        [array]::IndexOf($log, "check:$($script:Script)") | Should -BeGreaterOrEqual 0
        [array]::IndexOf($log, "run:$($script:Script)") | Should -BeGreaterThan ([array]::IndexOf($log, "check:$($script:Script)"))
    }

    It 'does not run a script that fails the check: no child is started and the marker is not written' {
        Set-FakeSecurity $script:Script (New-FakeSecurity -Path $script:Script -Ace ((New-FullControl) + @((New-FakeAce -Sid $script:Users -Mask 0x1301BF))) -NotProtected -File)
        { Invoke-AccucutTrustedScript -Root $TestDrive -Path $script:Script } | Should -Throw '*can be changed by*'
        Test-Path -LiteralPath $script:Marker | Should -BeFalse
        @($script:AccucutTrustLog | Where-Object { $_ -like 'run:*' }).Count | Should -Be 0
    }

    It 'passes arguments with spaces and quotes through unchanged, and returns the exit code of the child' {
        $argumentScript = Join-Path $script:Release 'args.ps1'
        [System.IO.File]::WriteAllText($argumentScript, "param([string]`$First, [string]`$Second)`n[System.IO.File]::WriteAllText('$($script:Marker)', `"`$First|`$Second`")`nexit 7`n")
        $code = Invoke-AccucutTrustedScript -Root $TestDrive -Path $argumentScript -ArgumentList @('-First', 'a b "c" d\', '-Second', 'x')
        $code | Should -Be 7
        (Get-Content -LiteralPath $script:Marker -Raw) | Should -Be 'a b "c" d\|x'
    }
}

Describe 'the arguments of a child process' {
    It 'quotes only what needs it, doubles the backslashes before a quote and at the end, and keeps an empty value' {
        ConvertTo-AccucutTrustedArgument -Value 'plain' | Should -Be 'plain'
        ConvertTo-AccucutTrustedArgument -Value 'with space' | Should -Be '"with space"'
        ConvertTo-AccucutTrustedArgument -Value '' | Should -Be '""'
        ConvertTo-AccucutTrustedArgument -Value 'C:\Program Files\x\' | Should -Be '"C:\Program Files\x\\"'
        ConvertTo-AccucutTrustedArgument -Value 'say "hi"' | Should -Be '"say \"hi\""'
    }
}

Describe 'the shape of the install root, and the root that must not exist (required tests 12 and 13)' {
    It 'accepts exactly one folder below a fixed NTFS drive, and refuses everything else (<Root>)' -ForEach @(
        @{ Root = 'C:\Accucut\sub' }
        @{ Root = 'C:\' }
        @{ Root = 'C:' }
        @{ Root = 'Accucut' }
        @{ Root = '.\Accucut' }
        @{ Root = '\\server\share\Accucut' }
        @{ Root = 'C:\Accu cut' }
        @{ Root = 'C:\Accucut\' }
        @{ Root = 'C:\..\Accucut' }
        @{ Root = 'C:\Accucut.d' }
        @{ Root = 'C:\ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' }
    ) {
        { Assert-AccucutTrustedRootShape -Root $Root } | Should -Throw '*Nothing was changed*'
    }

    It 'accepts the system drive with a plain folder name' {
        { Assert-AccucutTrustedRootShape -Root "$($env:SystemDrive)\Accucut" } | Should -Not -Throw
        { Assert-AccucutTrustedRootShape -Root "$($env:SystemDrive)\Accucut_test-1" } | Should -Not -Throw
    }

    It 'refuses a root that already exists, empty or not, and removes and changes nothing (existing folder)' {
        Initialize-FakeTree
        Mock Get-AccucutTrustSecurity {
            $key = $Path.TrimEnd('\').ToLowerInvariant()
            if ($script:Fake.ContainsKey($key)) { return $script:Fake[$key] }
            throw "the test has no security for '$Path'"
        }
        $existing = "$($env:SystemDrive)\Windows"
        Set-FakeSecurity "$($env:SystemDrive)\" (New-FakeSecurity -Path "$($env:SystemDrive)\" -Owner $script:System -Ace (New-FullControl) -NotProtected)
        $before = @([System.IO.Directory]::GetFileSystemEntries($existing)).Count
        { New-AccucutTrustedRoot -Root $existing } | Should -Throw '*already exists*never uses an existing one, empty or not*'
        @([System.IO.Directory]::GetFileSystemEntries($existing)).Count | Should -Be $before
    }

    It 'checks the drive root with rule A before it creates anything' {
        Initialize-FakeTree
        Mock Get-AccucutTrustSecurity {
            $key = $Path.TrimEnd('\').ToLowerInvariant()
            if ($script:Fake.ContainsKey($key)) { return $script:Fake[$key] }
            throw "the test has no security for '$Path'"
        }
        Set-FakeSecurity "$($env:SystemDrive)\" (New-FakeSecurity -Path "$($env:SystemDrive)\" -Owner $script:System -Ace @((New-FakeAce -Sid $script:Admins -Mask 0x1F01FF), (New-FakeAce -Sid $script:Users -Mask 0x1F01FF)) -NotProtected)
        { New-AccucutTrustedRoot -Root "$($env:SystemDrive)\AccucutNeverCreated" } | Should -Throw '*can be deleted, replaced or taken over*'
        Test-Path -LiteralPath "$($env:SystemDrive)\AccucutNeverCreated" | Should -BeFalse
    }
}

Describe 'links are refused where they would lead somewhere else (required test 7)' {
    BeforeEach {
        $script:LinkBase = Join-Path $TestDrive ('links-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path (Join-Path $script:LinkBase 'real\inner') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $script:LinkBase 'elsewhere') -Force | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $script:LinkBase 'real\inner\file.txt'), 'x')
    }

    It 'finds a junction anywhere in a tree, at the top or deep inside, and a clean tree passes' {
        { Assert-AccucutTrustedNoLinks -Path (Join-Path $script:LinkBase 'real') } | Should -Not -Throw
        $junction = Join-Path $script:LinkBase 'real\inner\jump'
        New-Item -ItemType Junction -Path $junction -Target (Join-Path $script:LinkBase 'elsewhere') | Out-Null
        try { { Assert-AccucutTrustedNoLinks -Path (Join-Path $script:LinkBase 'real') } | Should -Throw '*is a link*' }
        finally { [System.IO.Directory]::Delete($junction, $false) }
        $top = Join-Path $script:LinkBase 'topjump'
        New-Item -ItemType Junction -Path $top -Target (Join-Path $script:LinkBase 'real') | Out-Null
        try { { Assert-AccucutTrustedNoLinks -Path $top } | Should -Throw '*is a link*' }
        finally { [System.IO.Directory]::Delete($top, $false) }
    }

    It 'accepts <Root>\current only as a junction that points directly into <Root>\releases' {
        $root = Join-Path $script:LinkBase 'install'
        New-Item -ItemType Directory -Path (Join-Path $root 'releases\t1'), (Join-Path $root 'releases\t2') -Force | Out-Null
        $current = Join-Path $root 'current'
        New-Item -ItemType Junction -Path $current -Target (Join-Path $root 'releases\t1') | Out-Null
        try {
            Get-AccucutTrustedCurrent -Root $root | Should -Be (Join-Path $root 'releases\t1')
        }
        finally { [System.IO.Directory]::Delete($current, $false) }

        New-Item -ItemType Junction -Path $current -Target (Join-Path $script:LinkBase 'elsewhere') | Out-Null
        try { { Get-AccucutTrustedCurrent -Root $root } | Should -Throw '*not a release folder directly inside*' }
        finally { [System.IO.Directory]::Delete($current, $false) }

        New-Item -ItemType Directory -Path $current | Out-Null
        { Get-AccucutTrustedCurrent -Root $root } | Should -Throw '*is not a junction*'
        [System.IO.Directory]::Delete($current, $false)
    }
}

Describe 'the zip is copied into the locked root, checked as a copy, and unpacked from the copy (required tests 4 and 6)' {
    BeforeAll {
        Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
        function New-ReleaseZip {
            param([string]$Name, [string]$Tag, [string]$ModuleText = '# the real module, from the zip', [string[]]$ExtraEntry = @())
            $path = Join-Path $TestDrive "$Name.zip"
            $stream = [System.IO.FileStream]::new($path, [System.IO.FileMode]::Create)
            $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
            try {
                $entries = [ordered]@{ 'release.json' = "{ `"tag`": `"$Tag`" }"; 'install.ps1' = '# the real script, from the zip'; 'AccucutOps.psm1' = $ModuleText; 'sql/create-roles.psql' = '-- the real SQL' }
                foreach ($extra in $ExtraEntry) { $entries[$extra] = 'x' }
                foreach ($key in $entries.Keys) {
                    $entry = $archive.CreateEntry($key)
                    $writer = [System.IO.StreamWriter]::new($entry.Open())
                    try { $writer.Write($entries[$key]) } finally { $writer.Dispose() }
                }
            }
            finally { $archive.Dispose(); $stream.Dispose() }
            return $path
        }
    }

    BeforeEach {
        Initialize-FakeTree
        $script:Install = Join-Path $TestDrive ('inst-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path $script:Install | Out-Null
        Mock Get-AccucutTrustSecurity { return (New-FakeSecurity -Path $Path -Ace (New-FullControl)) }
    }

    It 'unpacks from the zip only: a tampered unpacked folder that sits next to the true zip is never read (required test 4)' {
        $zip = New-ReleaseZip -Name 'next-to' -Tag 't-next'
        $tampered = Join-Path (Split-Path -Parent $zip) 'next-to'
        New-Item -ItemType Directory -Path $tampered | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $tampered 'AccucutOps.psm1'), '# TAMPERED: this must never be loaded')
        [System.IO.File]::WriteAllText((Join-Path $tampered 'release.json'), '{ "tag": "t-next" }')
        $release = Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $zip -Sha256 (Get-AccucutTrustedSha256 -Path $zip)
        (Get-Content -LiteralPath (Join-Path $release 'AccucutOps.psm1') -Raw) | Should -Not -BeLike '*TAMPERED*'
        (Get-Content -LiteralPath (Join-Path $release 'AccucutOps.psm1') -Raw) | Should -Be '# the real module, from the zip'
    }

    It 'a zip that is replaced after its first check is caught by the check of the copy; nothing is unpacked into releases' {
        $zip = New-ReleaseZip -Name 'swapped' -Tag 't-swap'
        $firstHash = Get-AccucutTrustedSha256 -Path $zip
        $other = New-ReleaseZip -Name 'swapped-other' -Tag 't-swap' -ModuleText '# a different module'
        Copy-Item -LiteralPath $other -Destination $zip -Force
        { Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $zip -Sha256 $firstHash } | Should -Throw '*of the copy of the zip does not match*'
        Test-Path -LiteralPath (Join-Path $script:Install 'releases') | Should -BeFalse
        @([System.IO.Directory]::GetFileSystemEntries((Join-Path $script:Install '.in'))).Count | Should -Be 0
    }

    It 'refuses an entry that climbs out of the folder or is rooted, and leaves nothing behind (<Entry>)' -ForEach @(
        @{ Entry = '../evil.txt' }
        @{ Entry = 'sub/../../evil.txt' }
        @{ Entry = '/evil.txt' }
        @{ Entry = 'C:/evil.txt' }
    ) {
        $zip = New-ReleaseZip -Name ('evil-' + [guid]::NewGuid().ToString('N').Substring(0, 4)) -Tag 't-evil' -ExtraEntry @($Entry)
        { Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $zip -Sha256 (Get-AccucutTrustedSha256 -Path $zip) } | Should -Throw '*Refusing to unpack*'
        Test-Path -LiteralPath (Join-Path $script:Install 'evil.txt') | Should -BeFalse
        Test-Path -LiteralPath (Join-Path $script:Install 'releases') | Should -BeFalse
        @([System.IO.Directory]::GetFileSystemEntries((Join-Path $script:Install '.in'))).Count | Should -Be 0
    }

    It 'accepts an entry whose name only contains dots (Next.js route folders such as [...nextauth]), with / or \ as the separator' {
        $zip = New-ReleaseZip -Name 'dots' -Tag 't-dots' -ExtraEntry @('app/.next/server/[...nextauth]/route.js', 'app\.next\server\[...slug]\page.js', 'dir/a..b/file.txt')
        $release = Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $zip -Sha256 (Get-AccucutTrustedSha256 -Path $zip)
        Test-Path -LiteralPath (Join-Path $release 'app\.next\server\[...nextauth]\route.js') | Should -BeTrue
        Test-Path -LiteralPath (Join-Path $release 'app\.next\server\[...slug]\page.js') | Should -BeTrue
        Test-Path -LiteralPath (Join-Path $release 'dir\a..b\file.txt') | Should -BeTrue
    }

    It 'refuses a zip with no release.json, and a release.json with a tag that is not plain' {
        $noInfo = Join-Path $TestDrive 'noinfo.zip'
        $stream = [System.IO.FileStream]::new($noInfo, [System.IO.FileMode]::Create)
        $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
        try { $writer = [System.IO.StreamWriter]::new($archive.CreateEntry('x.txt').Open()); $writer.Write('x'); $writer.Dispose() } finally { $archive.Dispose(); $stream.Dispose() }
        { Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $noInfo -Sha256 (Get-AccucutTrustedSha256 -Path $noInfo) } | Should -Throw '*has no release.json*'
        $badTag = New-ReleaseZip -Name 'badtag' -Tag '..\..\x'
        { Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $badTag -Sha256 (Get-AccucutTrustedSha256 -Path $badTag) } | Should -Throw '*no valid tag*'
        @([System.IO.Directory]::GetFileSystemEntries((Join-Path $script:Install '.in'))).Count | Should -Be 0
    }

    It 'never reuses an existing release folder: it refuses, or with -ReplaceExisting deletes and unpacks again; and it refuses the running release' {
        $zip = New-ReleaseZip -Name 'again' -Tag 't-again'
        $hash = Get-AccucutTrustedSha256 -Path $zip
        $existing = Join-Path $script:Install 'releases\t-again'
        New-Item -ItemType Directory -Path $existing -Force | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $existing 'left-over.txt'), 'old')
        { Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $zip -Sha256 $hash } | Should -Throw '*already exists*'
        Test-Path -LiteralPath (Join-Path $existing 'left-over.txt') | Should -BeTrue
        $release = Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $zip -Sha256 $hash -ReplaceExisting
        Test-Path -LiteralPath (Join-Path $release 'left-over.txt') | Should -BeFalse
        Test-Path -LiteralPath (Join-Path $release 'AccucutOps.psm1') | Should -BeTrue
        { Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $zip -Sha256 $hash -RefuseTag 't-again' -ReplaceExisting } | Should -Throw '*already the running release*'
    }

    It 'checks the copy of the zip with rule B before its hash is read' {
        $zip = New-ReleaseZip -Name 'checked' -Tag 't-chk'
        $script:AccucutTrustLog.Clear()
        [void](Expand-AccucutTrustedPackage -Root $script:Install -ZipPath $zip -Sha256 (Get-AccucutTrustedSha256 -Path $zip))
        @($script:AccucutTrustLog | Where-Object { $_ -like 'check:*package.zip' }).Count | Should -Be 1
    }
}

Describe 'the hash is read from a stream that no writer can change' {
    It 'computes the SHA-256 as lower-case hex, and the file cannot be written while it is read' {
        $file = Join-Path $TestDrive 'abc.txt'
        [System.IO.File]::WriteAllText($file, 'abc')
        Get-AccucutTrustedSha256 -Path $file | Should -Be 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        $text = $script:InstallText
        $text | Should -BeLike '*FileShare]::Read*'
    }
}

Describe 'Remove-AccucutTrustedTree only deletes inside its boundary' {
    It 'refuses a path outside the boundary, the boundary itself (unless asked), and a sibling with the same prefix' {
        $base = Join-Path $TestDrive 'boundary'
        New-Item -ItemType Directory -Path (Join-Path $base 'inside'), (Join-Path $TestDrive 'boundary2') -Force | Out-Null
        { Remove-AccucutTrustedTree -Path (Join-Path $TestDrive 'boundary2') -Within $base } | Should -Throw '*not inside*'
        { Remove-AccucutTrustedTree -Path $base -Within $base } | Should -Throw '*not inside*'
        { Remove-AccucutTrustedTree -Path (Join-Path $base 'inside\..\..') -Within $base } | Should -Throw '*not inside*'
        Test-Path -LiteralPath (Join-Path $TestDrive 'boundary2') | Should -BeTrue
        Remove-AccucutTrustedTree -Path (Join-Path $base 'inside') -Within $base
        Test-Path -LiteralPath (Join-Path $base 'inside') | Should -BeFalse
        Remove-AccucutTrustedTree -Path $base -Within $base -IncludeWithin
        Test-Path -LiteralPath $base | Should -BeFalse
    }
}
