#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of the Admin's JEA endpoint (STORY-10.11 AC-7 and AC-9; architecture section 9.9 "The Admin's account"; ADR-015 Amendment 3 forward note for 10.11).
  Run by CI stage 13 on windows-latest. The first groups read the two template files and the module's endpoint functions (files under TestDrive, side effects mocked) and need no
  rights. The last group registers a REAL endpoint on the runner (named AccucutAdminTest, with stand-in scripts, a test group and a test folder under C:\), opens a session to it as
  the runner's own account, lists what the session offers, and runs the two commands, which are stand-ins that report what the scripts of the release need from the session. It is
  skipped on a PC that is not elevated; in CI it runs, and a failure to open the session is a failure of the job. The interactive proof (pasting the key into the prompt
  inside a real JEA session) is by hand (AC-8: deploy/windows/manual/AC-8-jea-prompt-check.md). Every value here is invented.
#>

BeforeDiscovery {
    $principal = New-Object System.Security.Principal.WindowsPrincipal([System.Security.Principal.WindowsIdentity]::GetCurrent())
    $script:IsAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
    $script:IsCi = ($env:GITHUB_ACTIONS -eq 'true')
}

BeforeAll {
    $script:WindowsDirectory = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:WindowsDirectory 'AccucutOps.psm1') -Force -DisableNameChecking
    $script:TemplateDirectory = Join-Path $script:WindowsDirectory 'jea'
    # Dot-sourcing defines the trust block and the helpers of restore.ps1 (it does not run the script): the real-install group below uses them on the real permissions.
    . (Join-Path $script:WindowsDirectory 'restore.ps1')

    # A hashtable literal of a data file that may hold script blocks (a role capability file does), read from the syntax tree: Import-PowerShellDataFile refuses script blocks.
    function Get-TemplateTable {
        param([string]$Path)
        $ast = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$null, [ref]$null)
        $table = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.HashtableAst] }, $false)
        $result = [ordered]@{}
        foreach ($pair in $table.KeyValuePairs) { $result[[string]$pair.Item1.Value] = $pair.Item2 }
        return $result
    }
    function Get-StringsOf {
        param($Ast)
        return @($Ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.StringConstantExpressionAst] }, $true) | ForEach-Object { [string]$_.Value })
    }
}

Describe 'the role capability file: exactly two commands, each a script that takes no parameter (AC-7)' {
    BeforeAll { $script:Role = Get-TemplateTable -Path (Join-Path $script:TemplateDirectory 'AccucutAdmin.psrc') }

    It 'makes visible Restore-AccucutBackup and Clear-AccucutCopies and nothing else' {
        (Get-StringsOf -Ast $script:Role['VisibleFunctions']) | Should -Be @('Restore-AccucutBackup', 'Clear-AccucutCopies')
        foreach ($key in 'VisibleCmdlets', 'VisibleExternalCommands', 'VisibleAliases', 'VisibleProviders', 'AliasDefinitions', 'VariableDefinitions', 'EnvironmentVariables', 'ScriptsToProcess', 'TypesToProcess', 'FormatsToProcess', 'AssembliesToLoad', 'VisibleAssemblies') {
            $script:Role.Keys | Should -Not -Contain $key -Because "$key would show or run something that is not one of the two commands"
        }
    }

    It 'defines the two functions with no parameter and a body that runs the installed script of that name and nothing else' {
        $definitions = @($script:Role['FunctionDefinitions'].FindAll({ param($n) $n -is [System.Management.Automation.Language.HashtableAst] }, $true))
        $definitions.Count | Should -Be 2
        $byName = @{}
        foreach ($definition in $definitions) {
            $name = @(Get-StringsOf -Ast ($definition.KeyValuePairs | Where-Object { $_.Item1.Value -eq 'Name' } | Select-Object -First 1).Item2)[0]
            $body = ($definition.KeyValuePairs | Where-Object { $_.Item1.Value -eq 'ScriptBlock' } | Select-Object -First 1).Item2
            $byName[$name] = $body
        }
        $byName.Keys | Sort-Object | Should -Be @('Clear-AccucutCopies', 'Restore-AccucutBackup')
        $byName['Restore-AccucutBackup'].Extent.Text | Should -Be "{ & '{{ROOT}}\current\restore.ps1' }"
        $byName['Clear-AccucutCopies'].Extent.Text | Should -Be "{ & '{{ROOT}}\current\clear-copies.ps1' }"
        foreach ($body in $byName.Values) { $body.Find({ param($n) $n -is [System.Management.Automation.Language.ParamBlockAst] }, $true) | Should -BeNullOrEmpty }
    }

    It 'imports only the two modules that hold the commands the scripts use (hidden from the user: only the two functions are visible)' {
        (Get-StringsOf -Ast $script:Role['ModulesToImport']) | Should -Be @('Microsoft.PowerShell.Utility', 'Microsoft.PowerShell.Management')
    }

    It 'uses one token, the install folder, and nothing is typed into a script from outside' {
        $text = Get-Content -LiteralPath (Join-Path $script:TemplateDirectory 'AccucutAdmin.psrc') -Raw
        $tokens = [regex]::Matches($text, '\{\{[A-Z_]+\}\}') | ForEach-Object { $_.Value } | Sort-Object -Unique
        $tokens | Should -Be @('{{ROOT}}')
    }
}

Describe 'the session configuration file: a restricted remote server that runs as a virtual account in one group, never an administrator (AC-7)' {
    BeforeAll {
        $script:Session = Get-TemplateTable -Path (Join-Path $script:TemplateDirectory 'AccucutAdmin.pssc')
        $script:SessionText = Get-Content -LiteralPath (Join-Path $script:TemplateDirectory 'AccucutAdmin.pssc') -Raw
    }

    It 'is RestrictedRemoteServer, with a virtual account that is limited to the named group, and no other language mode or session type' {
        (Get-StringsOf -Ast $script:Session['SessionType']) | Should -Be @('RestrictedRemoteServer')
        $script:Session['RunAsVirtualAccount'].Extent.Text | Should -Be '$true'
        (Get-StringsOf -Ast $script:Session['RunAsVirtualAccountGroups']) | Should -Be @('{{ADMIN_GROUP}}')
        $script:Session.Keys | Should -Not -Contain 'LanguageMode'
        $script:Session.Keys | Should -Not -Contain 'RunAsCredential'
        $script:Session.Keys | Should -Not -Contain 'GroupManagedServiceAccount'
        $script:SessionText | Should -Not -Match '(?i)Administrators'
    }

    It 'writes the transcripts to the folder it is given and lets exactly one account in, with the one role file' {
        (Get-StringsOf -Ast $script:Session['TranscriptDirectory']) | Should -Be @('{{TRANSCRIPT_DIRECTORY}}')
        $roles = @($script:Session['RoleDefinitions'].FindAll({ param($n) $n -is [System.Management.Automation.Language.HashtableAst] }, $true))
        $roles.Count | Should -Be 2 -Because 'the outer table of accounts and one inner table of the one account'
        @($roles[0].KeyValuePairs).Count | Should -Be 1
        (Get-StringsOf -Ast $roles[0].KeyValuePairs[0].Item1) | Should -Be @('{{ADMIN_ACCOUNT}}')
        $script:SessionText | Should -Match "RoleCapabilityFiles = '\{\{ROLE_FILE\}\}'"
    }
}

Describe 'the endpoint files that the install makes from the templates (AC-7)' {
    BeforeEach {
        $script:Out = Join-Path $TestDrive ('jea-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
        New-Item -ItemType Directory -Path $script:Out | Out-Null
    }

    It 'fills in every token with the checked values, leaves no token, and the session file passes Test-PSSessionConfigurationFile' {
        $files = New-AccucutAdminEndpointFiles -TemplateDirectory $script:TemplateDirectory -Root 'C:\Accucut' -AdminAccount 'ACME\admin.user' -GroupName 'AccucutAdminRunAs' -TranscriptDirectory 'C:\Accucut\logs\jea' -OutputDirectory $script:Out
        $session = Get-Content -LiteralPath $files.SessionFile -Raw
        $role = Get-Content -LiteralPath $files.RoleFile -Raw
        ($session + $role) | Should -Not -Match '\{\{'
        $session | Should -Match "RunAsVirtualAccountGroups = @\('AccucutAdminRunAs'\)"
        $session | Should -Match "TranscriptDirectory\s+= 'C:\\Accucut\\logs\\jea'"
        $session | Should -Match "'ACME\\admin\.user' = @\{ RoleCapabilityFiles = '$([regex]::Escape($files.RoleFile))' \}"
        $role | Should -Match "& 'C:\\Accucut\\current\\restore\.ps1'"
        $role | Should -Match "& 'C:\\Accucut\\current\\clear-copies\.ps1'"
        Test-PSSessionConfigurationFile -Path $files.SessionFile | Should -BeTrue
    }

    It 'refuses a value that could change what the file does: <Case>' -ForEach @(
        @{ Case = 'a quote in the account'; Account = "bad'name"; Root = 'C:\Accucut'; Group = 'AccucutAdminRunAs'; Transcripts = 'C:\Accucut\logs\jea' }
        @{ Case = 'a token in the account'; Account = '{{ROOT}}'; Root = 'C:\Accucut'; Group = 'AccucutAdminRunAs'; Transcripts = 'C:\Accucut\logs\jea' }
        @{ Case = 'a semicolon in the account'; Account = 'a;b'; Root = 'C:\Accucut'; Group = 'AccucutAdminRunAs'; Transcripts = 'C:\Accucut\logs\jea' }
        @{ Case = 'a root that is not one folder below a drive'; Account = 'ACME\admin'; Root = 'C:\a\b'; Group = 'AccucutAdminRunAs'; Transcripts = 'C:\Accucut\logs\jea' }
        @{ Case = 'a group with a quote'; Account = 'ACME\admin'; Root = 'C:\Accucut'; Group = "G'"; Transcripts = 'C:\Accucut\logs\jea' }
        @{ Case = 'a transcript folder with a quote'; Account = 'ACME\admin'; Root = 'C:\Accucut'; Group = 'AccucutAdminRunAs'; Transcripts = "C:\Accucut\logs\j'ea" }
    ) {
        { New-AccucutAdminEndpointFiles -TemplateDirectory $script:TemplateDirectory -Root $Root -AdminAccount $Account -GroupName $Group -TranscriptDirectory $Transcripts -OutputDirectory $script:Out } | Should -Throw
        @(Get-ChildItem -LiteralPath $script:Out).Count | Should -Be 0
    }

    It 'refuses a template that still holds a token after the fill-in' {
        $templates = Join-Path $TestDrive 'bad-templates'
        New-Item -ItemType Directory -Path $templates | Out-Null
        Copy-Item -LiteralPath (Join-Path $script:TemplateDirectory 'AccucutAdmin.pssc') -Destination $templates
        [System.IO.File]::WriteAllText((Join-Path $templates 'AccucutAdmin.psrc'), "@{ Description = '{{SURPRISE}}' }")
        { New-AccucutAdminEndpointFiles -TemplateDirectory $templates -Root 'C:\Accucut' -AdminAccount 'ACME\admin' -GroupName 'AccucutAdminRunAs' -TranscriptDirectory 'C:\Accucut\logs\jea' -OutputDirectory $script:Out } | Should -Throw '*holds a token that has no value*'
    }
}

Describe 'the account of the endpoint is checked before anything is made (AC-7)' {
    It 'refuses a name that is not a Windows account name, and an account that Windows does not know' -ForEach @(
        @{ Account = "x'y" }, @{ Account = 'a b;c' }, @{ Account = '' }, @{ Account = 'NO_SUCH_DOMAIN_XYZ\nobody-at-all' }
    ) {
        { Resolve-AccucutAdminAccount -Account $Account } | Should -Throw
    }

    It 'knows the account of the person running the tests, and says whether it is an administrator' {
        $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $result = Resolve-AccucutAdminAccount -Account $me
        $result.Sid | Should -Be ([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
        $result.IsAdministrator | Should -BeOfType [bool]
    }
}

Describe 'what the endpoint group is given, and nothing more (AC-7; ADR-015 Amendment 3 forward note)' {
    BeforeEach {
        $script:Paths = Get-AccucutPaths -Root 'C:\Accucut'
        $script:Granted = [System.Collections.Generic.List[string]]::new()
        Mock Grant-AccucutFolderAccess -ModuleName AccucutOps { $script:Granted.Add("folder:$Path|$Account|$Rights") }
        Mock Add-AccucutFileReadAccess -ModuleName AccucutOps { $script:Granted.Add("read:$Path|$Sid") }
        Mock New-AccucutAdminFolder -ModuleName AccucutOps { $script:Granted.Add("new-folder:$Path|$GroupSid|$GroupRights") }
        Mock Grant-AccucutServiceControl -ModuleName AccucutOps { $script:Granted.Add("service:$Name|$Sid") }
        Mock Set-AccucutLockedFileAcl -ModuleName AccucutOps { $script:Granted.Add("file-acl:$Path|$ModifySid") }
        Mock Write-AccucutLog -ModuleName AccucutOps { }
        $script:CreatedFiles = @()
    }

    It 'gives the group read and execute on the root, Modify on backups, read on three settings files, read and execute on config\jea, Modify on logs\jea and restore.log, and the two services: and nothing on logs, config, .env or migrate.env' {
        $sid = 'S-1-5-21-1111111111-2222222222-3333333333-1010'
        # restore.log is created by the function (CreateNew); point it into TestDrive so that nothing is made on the real C:\
        $root = Join-Path $TestDrive 'granted-root'
        $paths = Get-AccucutPaths -Root $root
        New-Item -ItemType Directory -Path $paths.Logs -Force | Out-Null
        Grant-AccucutAdminEndpointAccess -Paths $paths -GroupSid $sid
        $expected = @(
            "folder:$($paths.Root)|$sid|ReadAndExecute", "folder:$($paths.Backups)|$sid|Modify",
            "read:$($paths.BackupPgpass)|$sid", "read:$($paths.BackupSettings)|$sid", "read:$($paths.RestorePgpass)|$sid",
            "new-folder:$($paths.JeaConfig)|$sid|ReadAndExecute", "new-folder:$($paths.JeaLogs)|$sid|Modify",
            "file-acl:$($paths.RestoreLog)|$sid", "service:AccucutApp|$sid", "service:AccucutWorker|$sid"
        )
        (@($script:Granted) -join "`n") | Should -Be ($expected -join "`n")
        @($script:Granted | Where-Object { $_ -match '\.env|migrate\.env|folder:.*\\logs\||folder:.*\\config\|' }).Count | Should -Be 0
    }

    It 'sets up the endpoint in this order: the account is checked, the group is made, the permissions are given, the files are made, and only then is the endpoint registered' {
        $order = [System.Collections.Generic.List[string]]::new()
        Mock Resolve-AccucutAdminAccount -ModuleName AccucutOps { $order.Add('resolve'); [pscustomobject]@{ Sid = 'S-1-5-21-1-2-3-1001'; IsAdministrator = $false } }
        Mock New-AccucutAdminGroup -ModuleName AccucutOps { $order.Add('group'); return 'S-1-5-21-1-2-3-1010' }
        Mock Grant-AccucutAdminEndpointAccess -ModuleName AccucutOps { $order.Add("grant:$GroupSid") }
        Mock New-AccucutAdminEndpointFiles -ModuleName AccucutOps { $order.Add("files:$AdminAccount|$GroupName"); return [pscustomobject]@{ RoleFile = 'r'; SessionFile = 's' } }
        Mock Register-AccucutPSSessionConfiguration -ModuleName AccucutOps { $order.Add("register:$Name|$SessionFile") }
        $paths = Get-AccucutPaths -Root 'C:\Accucut'
        $result = Register-AccucutAdminEndpoint -Paths $paths -AdminAccount 'ACME\admin.user' -ReleaseDirectory 'C:\Accucut\releases\t1'
        (@($order) -join ' ') | Should -Be 'resolve group grant:S-1-5-21-1-2-3-1010 files:ACME\admin.user|AccucutAdminRunAs register:AccucutAdmin|s'
        $result.GroupSid | Should -Be 'S-1-5-21-1-2-3-1010'
    }

    It 'warns when the account is an administrator (A-35 is not met) and still registers the endpoint' {
        $script:Warnings = [System.Collections.Generic.List[string]]::new()
        Mock Write-AccucutLog -ModuleName AccucutOps { if ((Get-Variable -Name Level -ValueOnly -ErrorAction SilentlyContinue) -eq 'Warning') { $script:Warnings.Add($Message) } }
        Mock Resolve-AccucutAdminAccount -ModuleName AccucutOps { [pscustomobject]@{ Sid = 'S-1-5-21-1-2-3-1001'; IsAdministrator = $true } }
        Mock New-AccucutAdminGroup -ModuleName AccucutOps { 'S-1-5-21-1-2-3-1010' }
        Mock Grant-AccucutAdminEndpointAccess -ModuleName AccucutOps { }
        Mock New-AccucutAdminEndpointFiles -ModuleName AccucutOps { [pscustomobject]@{ RoleFile = 'r'; SessionFile = 's' } }
        Mock Register-AccucutPSSessionConfiguration -ModuleName AccucutOps { }
        [void](Register-AccucutAdminEndpoint -Paths (Get-AccucutPaths -Root 'C:\Accucut') -AdminAccount 'ACME\boss' -ReleaseDirectory 'C:\Accucut\releases\t1')
        $script:Warnings.Count | Should -Be 1
        $script:Warnings[0] | Should -Match 'member of Administrators'
        Should -Invoke Register-AccucutPSSessionConfiguration -ModuleName AccucutOps -Times 1 -Exactly
    }

    It 'adds one entry to a service''s security descriptor (start, stop, query: nothing that changes or deletes it), before the audit part, and a second call changes nothing' {
        $script:Sdset = [System.Collections.Generic.List[string]]::new()
        Mock Invoke-AccucutNative -ModuleName AccucutOps {
            if ($ArgumentList[0] -eq 'sdshow') { return [pscustomobject]@{ ExitCode = 0; Output = "D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)S:(AU;FA;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;WD)`r`n" } }
            $script:Sdset.Add($ArgumentList -join '|')
            return [pscustomobject]@{ ExitCode = 0; Output = '' }
        }
        Grant-AccucutServiceControl -Name 'AccucutApp' -Sid 'S-1-5-21-1-2-3-1010'
        $script:Sdset.Count | Should -Be 1
        $script:Sdset[0] | Should -Be 'sdset|AccucutApp|D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWRPWPDTLORC;;;S-1-5-21-1-2-3-1010)S:(AU;FA;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;WD)'
    }

    It 'a service security descriptor that already names the SID is left as it is' {
        $script:Sdset = [System.Collections.Generic.List[string]]::new()
        Mock Invoke-AccucutNative -ModuleName AccucutOps {
            if ($ArgumentList[0] -eq 'sdshow') { return [pscustomobject]@{ ExitCode = 0; Output = 'D:(A;;CCLCSWRPWPDTLORC;;;S-1-5-21-1-2-3-1010)' } }
            $script:Sdset.Add('changed'); return [pscustomobject]@{ ExitCode = 0; Output = '' }
        }
        Grant-AccucutServiceControl -Name 'AccucutApp' -Sid 'S-1-5-21-1-2-3-1010'
        $script:Sdset.Count | Should -Be 0
    }

    It 'refuses a SID or a service name that is not one' {
        { Grant-AccucutServiceControl -Name 'AccucutApp' -Sid 'not-a-sid' } | Should -Throw
        { Grant-AccucutServiceControl -Name 'Accucut App; sc delete x' -Sid 'S-1-5-21-1-2-3-1010' } | Should -Throw
    }
}

Describe 'the folders and files of the endpoint have exact permissions (AC-7)' {
    It 'makes the transcript folder and the settings folder with a protected list: Administrators and SYSTEM full control, the group Modify or read and execute, all inherited, owner Administrators' -Skip:(-not $script:IsAdmin) {
        $group = 'S-1-5-32-545'   # a stand-in group (Users) that exists on every machine
        $modify = Join-Path $TestDrive 'jea-logs'
        $read = Join-Path $TestDrive 'jea-config'
        New-AccucutAdminFolder -Path $modify -GroupSid $group -GroupRights Modify
        New-AccucutAdminFolder -Path $read -GroupSid $group -GroupRights ReadAndExecute
        foreach ($case in @(@{ Path = $modify; Mask = 0x1301BF }, @{ Path = $read; Mask = 0x1200A9 })) {
            $security = [System.IO.Directory]::GetAccessControl($case.Path)
            $security.AreAccessRulesProtected | Should -BeTrue
            $security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value | Should -Be 'S-1-5-32-544'
            $rules = @($security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { '{0}|0x{1:X}|{2}|{3}' -f $_.IdentityReference.Value, [int]$_.FileSystemRights, $_.IsInherited, [int]$_.InheritanceFlags } | Sort-Object)
            $wanted = @('S-1-5-32-544|0x1F01FF|False|3', 'S-1-5-18|0x1F01FF|False|3', ('{0}|0x{1:X}|False|3' -f $group, $case.Mask)) | Sort-Object
            ($rules -join "`n") | Should -Be ($wanted -join "`n")
        }
    }

    It 'makes restore.pgpass readable by Administrators and SYSTEM only, protected, with the password in it and nowhere else' -Skip:(-not $script:IsAdmin) {
        $root = Join-Path $TestDrive 'pgpass-root'
        $paths = Get-AccucutPaths -Root $root
        New-Item -ItemType Directory -Path $paths.Config -Force | Out-Null
        $password = 'FAKEpass' + [guid]::NewGuid().ToString('N').Substring(0, 10)
        Write-AccucutRestoreConfig -Paths $paths -RestorePassword $password -PgHost '127.0.0.1' -PgPort 5432
        (Get-Content -LiteralPath $paths.RestorePgpass -Raw) | Should -Be "127.0.0.1:5432:*:accucut_restore:$password`n"
        $security = [System.IO.File]::GetAccessControl($paths.RestorePgpass)
        $security.AreAccessRulesProtected | Should -BeTrue
        @($security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { $_.IdentityReference.Value } | Sort-Object) | Should -Be @('S-1-5-18', 'S-1-5-32-544')
        { Write-AccucutRestoreConfig -Paths $paths -RestorePassword $password -PgHost '127.0.0.1' -PgPort 5432 } | Should -Throw -Because 'a file is never written over'
        Add-AccucutFileReadAccess -Path $paths.RestorePgpass -Sid 'S-1-5-32-545'
        @([System.IO.File]::GetAccessControl($paths.RestorePgpass).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { '{0}|0x{1:X}' -f $_.IdentityReference.Value, [int]$_.FileSystemRights } | Sort-Object) | Should -Be @('S-1-5-18|0x1F01FF', 'S-1-5-32-544|0x1F01FF', 'S-1-5-32-545|0x120089')
    }
}

Describe 'the endpoint on the runner: it registers, shows only the two commands, and runs them as a virtual account that is not an administrator (AC-7, AC-9)' -Skip:(-not $script:IsAdmin) {
    BeforeAll {
        $script:Suffix = [guid]::NewGuid().ToString('N').Substring(0, 6)
        $script:TestRoot = 'C:\AccucutJeaTest'
        $script:TestGroup = 'AccucutJeaTest' + $script:Suffix
        $script:EndpointName = 'AccucutAdminTest'
        $script:Registered = $false
        $script:Session = $null
        # A session in NoLanguage mode accepts a command and nothing else (no script block with variables, no $using:), so each command is written out.
        function Invoke-EndpointCommand {
            param([string]$Name)
            if ($Name -eq 'Restore-AccucutBackup') { return @(Invoke-Command -Session $script:Session -ScriptBlock { Restore-AccucutBackup } 2>&1 | ForEach-Object { [string]$_ }) }
            return @(Invoke-Command -Session $script:Session -ScriptBlock { Clear-AccucutCopies } 2>&1 | ForEach-Object { [string]$_ })
        }
        # Windows Remote Management must be on. The runner has it; if it is off, switch it on (the runner is thrown away after the job, and this is the test's own business).
        if ((Get-Service -Name WinRM).Status -ne 'Running' -or -not (Test-WSMan -ErrorAction SilentlyContinue)) {
            Enable-PSRemoting -Force -SkipNetworkProfileCheck | Out-Null
        }
        New-Item -ItemType Directory -Path (Join-Path $script:TestRoot 'current') -Force | Out-Null
        $groupSid = (New-LocalGroup -Name $script:TestGroup -Description 'Pester test of the Accucut Admin endpoint').SID.Value
        New-AccucutAdminFolder -Path (Join-Path $script:TestRoot 'logs\jea') -GroupSid $groupSid -GroupRights Modify
        New-Item -ItemType Directory -Path (Join-Path $script:TestRoot 'config\jea') -Force | Out-Null

        # A module for the stand-in script to import, the way restore.ps1 imports AccucutOps.psm1.
        [System.IO.File]::WriteAllText((Join-Path $script:TestRoot 'current\StubOps.psm1'), "function Get-StubAnswer { 'module-imported' }`r`nExport-ModuleMember -Function Get-StubAnswer`r`n")
        # The stand-in for restore.ps1 and clear-copies.ps1: it reports, line by line, what the real scripts need from the session. Nothing in it changes the machine.
        $stub = @'
$ErrorActionPreference = 'Stop'
function Test-Step { param([string]$Name, [scriptblock]$Run)
    try { $value = & $Run; "STEP|$Name|ok|$value" } catch { "STEP|$Name|FAILED|$($_.Exception.Message -replace '[\r\n|]+', ' ')" } }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
"IDENTITY|$($identity.Name)"
foreach ($group in $identity.Groups) { try { "GROUP|$($group.Translate([System.Security.Principal.NTAccount]).Value)" } catch { "GROUP|$($group.Value)" } }
Test-Step 'Import-Module' { Microsoft.PowerShell.Core\Import-Module -Name 'C:\AccucutJeaTest\current\StubOps.psm1' -Force -DisableNameChecking; Get-StubAnswer }
Test-Step 'Get-Service' { (Get-Service -Name WinRM).Name }
Test-Step 'Get-Item' { (Microsoft.PowerShell.Management\Get-Item -LiteralPath 'C:\AccucutJeaTest').Name }
Test-Step 'Get-Content' { @(Get-Content -LiteralPath 'C:\AccucutJeaTest\current\StubOps.psm1').Count }
Test-Step 'ConvertFrom-Json' { (('{"a":1}' | ConvertFrom-Json).a) }
Test-Step 'Get-Date' { (Get-Date).Year -gt 2000 }
Test-Step 'New-Object' { (New-Object System.Text.StringBuilder).Length }
Test-Step 'pipeline' { (1..4 | Where-Object { $_ -gt 1 } | ForEach-Object { $_ * 2 } | Sort-Object -Descending | Select-Object -First 1) }
Test-Step 'Join-Path' { Join-Path 'C:\a' 'b' }
Test-Step 'Write-Host' { Write-Host 'hello' ; 'written' }
Test-Step 'ReadHost-resolves' { try { Read-Host -Prompt 'x' | Out-Null; 'prompted' } catch { if ($_.Exception.Message -match 'is not recognized') { throw }; 'exists-but-not-interactive' } }
Test-Step 'ReadHost-secure-resolves' { try { Read-Host -Prompt 'x' -AsSecureString | Out-Null; 'prompted' } catch { if ($_.Exception.Message -match 'is not recognized') { throw }; 'exists-but-not-interactive' } }
'DONE'
'@
        [System.IO.File]::WriteAllText((Join-Path $script:TestRoot 'current\restore.ps1'), $stub)
        [System.IO.File]::WriteAllText((Join-Path $script:TestRoot 'current\clear-copies.ps1'), $stub)

        $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $files = New-AccucutAdminEndpointFiles -TemplateDirectory $script:TemplateDirectory -Root $script:TestRoot -AdminAccount $me -GroupName $script:TestGroup -TranscriptDirectory (Join-Path $script:TestRoot 'logs\jea') -OutputDirectory (Join-Path $script:TestRoot 'config\jea')
        Register-AccucutPSSessionConfiguration -Name $script:EndpointName -SessionFile $files.SessionFile
        $script:Registered = $true
        $script:Session = New-PSSession -ComputerName localhost -ConfigurationName $script:EndpointName -ErrorAction Stop
    }

    AfterAll {
        if ($null -ne $script:Session) { Remove-PSSession -Session $script:Session -ErrorAction SilentlyContinue }
        if ($script:Registered) { Unregister-PSSessionConfiguration -Name $script:EndpointName -Force -NoServiceRestart -ErrorAction SilentlyContinue }
        Remove-LocalGroup -Name $script:TestGroup -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $script:TestRoot) { Remove-Item -LiteralPath $script:TestRoot -Recurse -Force -ErrorAction SilentlyContinue }
    }

    It 'registers as an endpoint, and Windows lists it' {
        (Get-PSSessionConfiguration -Name $script:EndpointName).Name | Should -Be $script:EndpointName
    }

    It 'shows exactly Restore-AccucutBackup and Clear-AccucutCopies as functions, and nothing of Windows beyond the seven commands that every restricted session has' {
        $listed = @(Invoke-Command -Session $script:Session -ScriptBlock { Get-Command })
        $functions = @($listed | Where-Object { [string]$_.CommandType -eq 'Function' } | ForEach-Object { $_.Name } | Sort-Object)
        $functions | Should -Be @('Clear-AccucutCopies', 'Restore-AccucutBackup')
        $baseline = @('Clear-Host', 'Exit-PSSession', 'Get-Command', 'Get-FormatData', 'Get-Help', 'Measure-Object', 'Out-Default', 'Select-Object', 'Prompt', 'TabExpansion2')
        $others = @($listed | Where-Object { [string]$_.CommandType -ne 'Function' -or $_.Name -notin @('Clear-AccucutCopies', 'Restore-AccucutBackup') } | Where-Object { $_.Name -notin $baseline } | ForEach-Object { "$($_.Name) ($($_.CommandType))" })
        $others.Count | Should -Be 0 -Because "the session also shows: $($others -join ', ')"
    }

    It 'does not let the user run anything else: Get-Service, a program and a script block are all refused' {
        { Invoke-Command -Session $script:Session -ScriptBlock { Get-Service } -ErrorAction Stop } | Should -Throw
        { Invoke-Command -Session $script:Session -ScriptBlock { whoami } -ErrorAction Stop } | Should -Throw
        { Invoke-Command -Session $script:Session -ScriptBlock { Import-Module Microsoft.PowerShell.Management } -ErrorAction Stop } | Should -Throw
    }

    It 'runs the two commands as a virtual account that is in the named group and in no administrators group (it is never a local administrator)' -ForEach @(@{ Command = 'Restore-AccucutBackup' }, @{ Command = 'Clear-AccucutCopies' }) {
        $lines = @(Invoke-EndpointCommand -Name $Command)
        $lines | Should -Contain 'DONE'
        $identity = ($lines | Where-Object { $_ -like 'IDENTITY|*' } | Select-Object -First 1)
        $identity | Should -Match 'Virtual'
        $groups = @($lines | Where-Object { $_ -like 'GROUP|*' } | ForEach-Object { $_.Substring(6) })
        ($groups | Where-Object { $_ -like "*\$($script:TestGroup)" }).Count | Should -Be 1 -Because "the virtual account joins the group; its groups: $($groups -join '; ')"
        $groups | Should -Not -Contain 'BUILTIN\Administrators'
    }

    It 'lets the scripts do what they need inside the session: import a module by path, run the commands they call, and reach the prompt commands (Read-Host and Read-Host -AsSecureString resolve)' -ForEach @(@{ Command = 'Restore-AccucutBackup' }) {
        $lines = @(Invoke-EndpointCommand -Name $Command)
        $steps = @($lines | Where-Object { $_ -like 'STEP|*' })
        $steps.Count | Should -BeGreaterThan 10
        $failed = @($steps | Where-Object { $_ -notlike 'STEP|*|ok|*' })
        $failed.Count | Should -Be 0 -Because "these steps failed inside the endpoint: $($failed -join ' ;; ')"
        ($steps | Where-Object { $_ -like 'STEP|Import-Module|ok|module-imported' }).Count | Should -Be 1
    }

    It 'writes a transcript of the session to the transcript folder, and the transcript holds no secret' {
        Remove-PSSession -Session $script:Session
        $script:Session = $null
        Start-Sleep -Seconds 2
        $transcripts = @(Get-ChildItem -LiteralPath (Join-Path $script:TestRoot 'logs\jea') -File -Recurse -ErrorAction SilentlyContinue)
        $transcripts.Count | Should -BeGreaterThan 0
        foreach ($file in $transcripts) { (Get-Content -LiteralPath $file.FullName -Raw) | Should -Not -Match 'AGE-SECRET' }
    }
}

Describe 'the Admin endpoint on the real install of stage 13 (AC-7, AC-9): the install step, the exact permissions, and the two commands running as the limited account' -Skip:(-not ($script:IsAdmin -and $script:IsCi)) {
    BeforeAll {
        $script:RealRoot = 'C:\Accucut'
        $script:RealPaths = Get-AccucutPaths -Root $script:RealRoot
        $script:RealReady = (Test-Path -LiteralPath $script:RealPaths.RestorePgpass)
        $script:RealSession = $null
        # The two commands ask questions. A session with no one at the keyboard cannot answer, so each call is bounded: a call that waits for an answer is stopped after 3 minutes and reported.
        function Invoke-RealEndpointCommand {
            param([string]$Name)
            if ($Name -eq 'Restore-AccucutBackup') { $job = Invoke-Command -Session $script:RealSession -ScriptBlock { Restore-AccucutBackup } -AsJob }
            else { $job = Invoke-Command -Session $script:RealSession -ScriptBlock { Clear-AccucutCopies } -AsJob }
            $finished = Wait-Job -Job $job -Timeout 180
            $timedOut = ($null -eq $finished)
            if ($timedOut) { Stop-Job -Job $job }
            $out = @(Receive-Job -Job $job -ErrorAction SilentlyContinue 2>&1 | ForEach-Object { [string]$_ })
            Remove-Job -Job $job -Force
            if ($timedOut) { $out += 'TIMED OUT: the command was waiting for an answer for 3 minutes.' }
            return $out
        }
        $script:RealOutput = @{}
        if ($script:RealReady) {
            $release = [System.IO.Path]::Combine($script:RealPaths.Releases, (Get-AccucutCurrentRelease -Paths $script:RealPaths))
            $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
            # What install.ps1 -AdminAccount does, minus the desktop shortcut: the group, the permissions, the two files, the endpoint.
            $script:RealResult = Register-AccucutAdminEndpoint -Paths $script:RealPaths -AdminAccount $me -ReleaseDirectory $release
            for ($attempt = 1; $attempt -le 6 -and $null -eq $script:RealSession; $attempt++) {
                try { $script:RealSession = New-PSSession -ComputerName localhost -ConfigurationName 'AccucutAdmin' -ErrorAction Stop }
                catch { if ($attempt -eq 6) { throw }; Start-Sleep -Seconds 5 }
            }
        }
    }

    AfterAll {
        if ($null -ne $script:RealSession) { Remove-PSSession -Session $script:RealSession -ErrorAction SilentlyContinue }
        if ($script:RealReady) { try { Unregister-AccucutAdminEndpoint } catch { Write-Host "The endpoint could not be removed: $($_.Exception.Message)" } }
    }

    It 'the stage 13 install has the restore role''s password file (a job on the real install fails here, it never skips)' {
        $script:RealReady | Should -BeTrue
    }

    It 'made the group, and gave it exactly the entries that Grant-AccucutAdminEndpointAccess says: read and execute on the root (a sixth entry), Modify on backups, read on the three settings files, nothing on logs, .env or migrate.env' {
        $sid = Get-AccucutAdminGroupSid
        $sid | Should -Not -BeNullOrEmpty
        $script:RealResult.GroupSid | Should -Be $sid
        $rule = {
            param($Path, $IsDirectory)
            if ($IsDirectory) { $security = [System.IO.Directory]::GetAccessControl($Path) } else { $security = [System.IO.File]::GetAccessControl($Path) }
            return @($security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | Where-Object { $_.IdentityReference.Value -eq $sid } | ForEach-Object { '0x{0:X}|{1}|{2}' -f [int]$_.FileSystemRights, $_.IsInherited, [int]$_.InheritanceFlags })
        }
        (& $rule $script:RealPaths.Root $true) | Should -Be @('0x1200A9|False|3')
        (& $rule $script:RealPaths.Backups $true) | Should -Be @('0x1301BF|False|3')
        foreach ($file in $script:RealPaths.BackupPgpass, $script:RealPaths.BackupSettings, $script:RealPaths.RestorePgpass) { (& $rule $file $false) | Should -Be @('0x120089|False|0') -Because $file }
        (& $rule $script:RealPaths.RestoreLog $false) | Should -Be @('0x1301BF|False|0')
        (& $rule $script:RealPaths.JeaLogs $true) | Should -Be @('0x1301BF|False|3')
        # Nothing for the group on the logs folder, config, .env or migrate.env (an inherited entry from the root is not an entry of its own: logs and config inherit the root's read and execute).
        foreach ($file in $script:RealPaths.EnvFile, $script:RealPaths.MigrateEnvFile) { @(& $rule $file $false).Count | Should -Be 0 -Because $file }
        @((& $rule $script:RealPaths.Logs $true) | Where-Object { $_ -notlike '*|True|*' }).Count | Should -Be 0
        @((& $rule $script:RealPaths.Config $true) | Where-Object { $_ -notlike '*|True|*' }).Count | Should -Be 0
        # The root has six entries now: Administrators, SYSTEM, the two services, the backup account, and the group.
        @([System.IO.Directory]::GetAccessControl($script:RealPaths.Root).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])).Count | Should -Be 6
    }

    It 'put the group on the two services, with the rights to query, start and stop them, and nothing that changes or deletes them' {
        $sid = Get-AccucutAdminGroupSid
        foreach ($name in 'AccucutApp', 'AccucutWorker') {
            $descriptor = (& "$env:SystemRoot\System32\sc.exe" sdshow $name | Out-String).Trim()
            $descriptor | Should -Match "\(A;;CCLCSWRPWPDTLORC;;;$([regex]::Escape($sid))\)" -Because $name
            [regex]::Matches($descriptor, [regex]::Escape($sid)).Count | Should -Be 1
        }
    }

    It 'the trust checks still pass with the group on backups: the backups folder is accepted when the group is named as the second writer, and refused when it is not' {
        $sid = Get-AccucutAdminGroupSid
        $backupSid = @([System.IO.Directory]::GetAccessControl($script:RealPaths.Backups).GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | Where-Object { [int]$_.FileSystemRights -eq 0x1301BF -and $_.IdentityReference.Value -ne $sid } | ForEach-Object { $_.IdentityReference.Value })[0]
        { Assert-AccucutBackupFolderTrusted -Root $script:RealRoot -Directory $script:RealPaths.Backups -BackupSid $backupSid -EndpointSid $sid } | Should -Not -Throw
        { Assert-AccucutBackupFolderTrusted -Root $script:RealRoot -Directory $script:RealPaths.Backups -BackupSid $backupSid } | Should -Throw '*can be changed by*'
        # The script, the module and the settings files are still accepted with the sixth entry of the root (read and execute is within what a trusted path may give).
        $release = [System.IO.Path]::Combine($script:RealPaths.Releases, (Get-AccucutCurrentRelease -Paths $script:RealPaths))
        foreach ($path in $release, (Join-Path $release 'restore.ps1'), (Join-Path $release 'AccucutOps.psm1'), $script:RealPaths.BackupSettings, $script:RealPaths.RestorePgpass) {
            { Assert-AccucutTrustedPath -Path $path -Root $script:RealRoot -ProtectedRoot } | Should -Not -Throw -Because $path
        }
    }

    It 'registered the endpoint, which shows exactly the two commands' {
        (Get-PSSessionConfiguration -Name 'AccucutAdmin').Name | Should -Be 'AccucutAdmin'
        $script:RealSession | Should -Not -BeNullOrEmpty
        $listed = @(Invoke-Command -Session $script:RealSession -ScriptBlock { Get-Command })
        @($listed | Where-Object { [string]$_.CommandType -eq 'Function' } | ForEach-Object { $_.Name } | Sort-Object) | Should -Be @('Clear-AccucutCopies', 'Restore-AccucutBackup')
    }

    It 'Clear-AccucutCopies runs clear-copies.ps1 as the limited account: every trust check passes, the module loads, the copies are listed, and it stops at the first prompt (a session with no one at the keyboard cannot answer it), having changed nothing' {
        $before = @(Get-AccucutBackupCopy -Directory $script:RealPaths.Backups | ForEach-Object { $_.Name })
        $lines = @(Invoke-RealEndpointCommand -Name 'Clear-AccucutCopies')
        $text = $lines -join "`n"
        $text | Should -Match 'Backup copies on this server, oldest first' -Because $text
        $text | Should -Not -Match 'Refusing to use|Access is denied|cannot be changed|not recognized'
        @(Get-AccucutBackupCopy -Directory $script:RealPaths.Backups | ForEach-Object { $_.Name }) | Should -Be $before
    }

    It 'Restore-AccucutBackup runs restore.ps1 as the limited account up to the first question, lists the copies newest first, and changes nothing: the portal is still running' {
        $lines = @(Invoke-RealEndpointCommand -Name 'Restore-AccucutBackup')
        $text = $lines -join "`n"
        $text | Should -Match 'Backup copies on this server, newest first' -Because $text
        $text | Should -Not -Match 'Refusing to use|Access is denied|cannot be changed|not recognized'
        foreach ($name in (Get-AccucutServiceNames)) { (Get-Service -Name $name).Status | Should -Be 'Running' }
        @(Get-ChildItem -LiteralPath $script:RealPaths.Backups -Filter '*.age.part').Count | Should -Be 0
    }

    It 'the transcripts of the two sessions are in logs\jea and hold no key' {
        Remove-PSSession -Session $script:RealSession
        $script:RealSession = $null
        Start-Sleep -Seconds 2
        $transcripts = @(Get-ChildItem -LiteralPath $script:RealPaths.JeaLogs -File -Recurse -ErrorAction SilentlyContinue)
        $transcripts.Count | Should -BeGreaterThan 0
        foreach ($file in $transcripts) { (Get-Content -LiteralPath $file.FullName -Raw) | Should -Not -Match 'AGE-SECRET' }
    }
}
