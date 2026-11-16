#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }
<#
  Pester 5 tests of the small parser that the stage 13 scripts use to read a secedit export of the user rights (ADR-015 Amendment 3.2). The function is taken
  from the scripts themselves (by its syntax tree), so what is tested is what runs. All values are invented. Also a guard against the mistake that cost a run:
  a variable named like a typed parameter (PowerShell names are not case sensitive) turns the value assigned to it into that parameter's type.
#>

BeforeAll {
    $script:CiDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'ci'
    function Get-CiAst {
        param([string]$Name)
        $errors = $null
        $tokens = $null
        return [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $script:CiDirectory $Name), [ref]$tokens, [ref]$errors)
    }
    function New-Export {
        param([string[]]$Line)
        $path = Join-Path $TestDrive ([guid]::NewGuid().ToString('N') + '.inf')
        [System.IO.File]::WriteAllLines($path, $Line, [System.Text.Encoding]::Unicode)
        return $path
    }
}

Describe 'Get-RightMap (assert-install.ps1 and assert-removal.ps1)' -ForEach @(@{ Script = 'assert-install.ps1' }, @{ Script = 'assert-removal.ps1' }) {
    BeforeAll {
        # Dot-sourced here (not in a helper function), so that the function stays defined for the tests below.
        $definition = (Get-CiAst -Name $Script).Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-RightMap' }, $true)
        if ($null -eq $definition) { throw "Get-RightMap is not defined in $Script." }
        . ([scriptblock]::Create($definition.Extent.Text))
    }

    It 'returns a hashtable of right name to an array of SIDs, for a section with several values' {
        $path = New-Export -Line @('[Unicode]', 'Unicode=yes', '[Privilege Rights]', 'SeBatchLogonRight = *S-1-5-32-544,*S-1-5-32-551,*S-1-5-18', '[Version]', 'signature="$CHICAGO$"')
        $map = Get-RightMap -Path $path
        $map | Should -BeOfType [hashtable]
        $map['SeBatchLogonRight'] | Should -Be @('S-1-5-18', 'S-1-5-32-544', 'S-1-5-32-551')
    }

    It 'returns an array (not a string) for a right with one value, and an empty array for a right with none' {
        $path = New-Export -Line @('[Privilege Rights]', 'SeBatchLogonRight = *S-1-5-32-544', 'SeDenyBatchLogonRight = ', 'SeDenyNetworkLogonRight =')
        $map = Get-RightMap -Path $path
        $map | Should -BeOfType [hashtable]
        $map.ContainsKey('SeBatchLogonRight') | Should -BeTrue
        @($map['SeBatchLogonRight']).Count | Should -Be 1
        $map['SeBatchLogonRight'] -is [array] | Should -BeTrue
        $map.ContainsKey('SeDenyBatchLogonRight') | Should -BeTrue
        @($map['SeDenyBatchLogonRight']).Count | Should -Be 0
        @($map['SeDenyNetworkLogonRight']).Count | Should -Be 0
    }

    It 'reads only the Privilege Rights section, and returns an empty hashtable when there is none' {
        $path = New-Export -Line @('[System Access]', 'MinimumPasswordAge = 0', '[Registry Values]', 'SeFake = *S-1-1-0')
        $map = Get-RightMap -Path $path
        $map | Should -BeOfType [hashtable]
        $map.Count | Should -Be 0
    }

    It 'turns an account name into its SID (the local Administrators group)' {
        $path = New-Export -Line @('[Privilege Rights]', 'SeBatchLogonRight = Administrators')
        (Get-RightMap -Path $path)['SeBatchLogonRight'] | Should -Be @('S-1-5-32-544')
    }
}

Describe 'the stage 13 scripts do not assign a typed parameter by another spelling of its name (the one restore of -Root after update.ps1 is dot-sourced is allowed)' {
    It 'has no local variable with the name of a parameter in <Script>' -ForEach @(@{ Script = 'assert-install.ps1' }, @{ Script = 'assert-removal.ps1' }, @{ Script = 'exercise-backup.ps1' }, @{ Script = 'diagnose-backup-login.ps1' }) {
        $ast = Get-CiAst -Name $Script
        $parameterNames = @($ast.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath.ToLowerInvariant() })
        $assigned = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and $node.Left -is [System.Management.Automation.Language.VariableExpressionAst] -and $node.Right.Extent.Text -ne '$requestedRoot' }, $true) |
                ForEach-Object { $_.Left.VariablePath.UserPath })
        $clash = @($assigned | Where-Object { $parameterNames -contains $_.ToLowerInvariant() })
        $clash | Should -BeNullOrEmpty -Because "an assignment to $($clash -join ', ') would be converted to the parameter's type"
    }
}
