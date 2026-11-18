# AC-8: do the guided prompts work inside a JEA session? (manual check, about 15 minutes)

**Story:** STORY-10.11 (AQP-312), AC-8. **Who runs it:** the delivery lead, or Accucut IT. **Where:** a Windows Server **test** machine (Server 2022 recommended), never the live server.

## Why this check exists

The Admin's restore asks plain questions (a number, a date) and asks for the backup key at a **secure prompt** (`Read-Host -AsSecureString`, so nothing is shown). The Admin is meant to
run it inside a **JEA session** (a limited PowerShell window that can run two commands only). Nobody has proved yet that those prompts work there, with a pasted value, on a real Windows Server.
The automated tests (Pester, on a GitHub Windows runner) cannot type into a prompt. This check does it once, by hand, with a **made-up value**. It never uses the real backup key and never touches the Accucut install.

**If it fails, stop and report.** Do not try to fix it. The fallback is the full-administrator path (the scripts stay as they are; the JEA wrapper is dropped; assumption A-35 is then not met and
RISK-018 applies in full). That decision is the delivery lead's.

## What it changes, and what it removes

It makes: the folder `C:\Ac8Check`, one local group `Ac8CheckGroup` (no members), and one endpoint `Ac8Check`. At the end (`-Phase Finish`, or `-Phase Cleanup` if you stop half way) it removes all three.
It starts or stops no service, makes no scheduled task and no event source, changes no Windows setting and touches no database. It shapes the endpoint like the real one: a restricted session, a virtual account
in one group (never an administrator), one command that runs a script file, which imports a module by its path, asks a question, asks for a secure paste, and writes a result file.

## Before you start

- A Windows Server **test** machine, signed in as an **administrator**.
- **Windows PowerShell 5.1** (the blue one: `powershell.exe`, not PowerShell 7).
- **Windows Remote Management is running** (it is by default on Windows Server). If the script says it is not, run `Enable-PSRemoting -Force` in the same administrator window and start again.

## Steps

1. Make a folder `C:\Temp`, and save the script at the end of this page as **`C:\Temp\AC8-check.ps1`** (copy the whole code block, paste it into Notepad, save as that name; the type is "All files").
2. Open **Windows PowerShell as administrator**. Run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Temp\AC8-check.ps1 -Phase Prepare
   ```

   It prints a **made-up paste value** that starts with `FAKE-KEY-`, and what to type next. Leave the window open.
3. In the **same window** run:

   ```powershell
   Enter-PSSession -ComputerName localhost -ConfigurationName Ac8Check
   ```

   The prompt changes to `[localhost]: PS>`.
4. Type **`Test-Ac8Prompt`** and press Enter.
   - It asks **Type the word PINEAPPLE and press Enter**: type `PINEAPPLE`, Enter.
   - It asks **Paste the FAKE value ... (nothing is shown)**: **right-click** to paste the `FAKE-KEY-...` value from step 2, then Enter. **Nothing appears on the screen while you paste: that is the normal behaviour of a secure prompt.**
   - It prints `Done.`
5. Type **`Exit-PSSession`** and press Enter. The prompt is back to `PS C:\...>`.
6. Run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Temp\AC8-check.ps1 -Phase Finish
   ```

   It prints one line per check, then **`AC-8 RESULT: PASS`** or **`AC-8 RESULT: FAIL`**, and removes everything it made.

If something goes wrong half way (an error, a closed window), run `-Phase Cleanup` and start again from step 2.

## Expected result

Six lines, all `PASS`, then `AC-8 RESULT: PASS`:

```
PASS  the session opened and the command ran its script file
PASS  the script imported a module by its path inside the session
PASS  the typed answer (a question with Read-Host) reached the script
PASS  the pasted value (Read-Host -AsSecureString) reached the script intact (74 characters)
PASS  the session ran as a virtual account in the check group, and not as an administrator
PASS  the transcript of the session exists and does not contain the pasted value
AC-8 RESULT: PASS
```

## What to report back

Add a comment on **AQP-312** with:

1. `AC-8 RESULT: PASS` or `FAIL`, and the whole table of lines above it.
2. The server: run `(Get-CimInstance Win32_OperatingSystem).Caption` and `$PSVersionTable.PSVersion` and paste both.
3. For a FAIL: the **complete text** that the script printed (every line, including the red ones), and which step you were at. Do not change anything and try again: report it, as the story says.
4. Who ran it, and on what date.

(Nothing the script prints is secret: the paste value is made up for this check and is deleted with everything else. Do not paste your real backup key anywhere in this check.)

## The script (save as C:\Temp\AC8-check.ps1)

```powershell
<#
  AC-8 check of STORY-10.11 (AQP-312): do the prompts, including a secure-string paste, work inside a JEA session?
  Run on a Windows Server TEST machine, in Windows PowerShell 5.1 as administrator. Phases: Prepare, then the interactive steps in AC-8-jea-prompt-check.md, then Finish.
  It makes C:\Ac8Check, the local group Ac8CheckGroup and the endpoint Ac8Check, and removes them in Finish (or Cleanup). It uses a made-up value, never the real backup key.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Prepare', 'Finish', 'Cleanup')][string]$Phase,
    [ValidatePattern('^[A-Za-z]:\\[A-Za-z0-9 _.\\-]{1,200}$')][string]$Root = 'C:\Ac8Check'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$EndpointName = 'Ac8Check'
$GroupName = 'Ac8CheckGroup'

function Test-Elevated {
    $principal = New-Object System.Security.Principal.WindowsPrincipal([System.Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-Sha256Hex {
    param([string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return (($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text)) | ForEach-Object { $_.ToString('x2') }) -join '') } finally { $sha.Dispose() }
}

function Remove-Ac8Check {
    # Each removal on its own, so that one that fails does not stop the others.
    try { if (Get-PSSessionConfiguration -Name $EndpointName -ErrorAction SilentlyContinue) { Unregister-PSSessionConfiguration -Name $EndpointName -Force } } catch { Write-Warning "The endpoint could not be removed: $($_.Exception.Message)" }
    try { if (Get-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue) { Remove-LocalGroup -Name $GroupName } } catch { Write-Warning "The group could not be removed: $($_.Exception.Message)" }
    try { if (Test-Path -LiteralPath $Root) { Remove-Item -LiteralPath $Root -Recurse -Force } } catch { Write-Warning "The folder $Root could not be removed: $($_.Exception.Message)" }
}

function Add-Ac8Modify {
    param([string]$Path, [string]$Sid)
    $acl = Get-Acl -LiteralPath $Path
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule((New-Object System.Security.Principal.SecurityIdentifier($Sid)), 'Modify', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $Path -AclObject $acl
}

if ($Phase -eq 'Cleanup') { Remove-Ac8Check; Write-Host 'Cleaned up.'; return }

if ($Phase -eq 'Prepare') {
    if (-not (Test-Elevated)) { throw 'Run this in Windows PowerShell as administrator.' }
    $winrm = Get-Service -Name WinRM
    if ($winrm.Status -ne 'Running') { throw 'Windows Remote Management (WinRM) is not running. Run Enable-PSRemoting -Force in this window, then start again.' }
    if (Test-Path -LiteralPath $Root) { throw "$Root already exists. Run -Phase Cleanup first." }
    $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    foreach ($folder in 'current', 'out', 'config', 'transcripts') { New-Item -ItemType Directory -Path (Join-Path $Root $folder) -Force | Out-Null }
    $groupSid = (New-LocalGroup -Name $GroupName -Description 'AC-8 check of the Accucut Admin endpoint (throwaway, no members)').SID.Value
    Add-Ac8Modify -Path (Join-Path $Root 'out') -Sid $groupSid
    Add-Ac8Modify -Path (Join-Path $Root 'transcripts') -Sid $groupSid

    # A made-up value to paste: 74 characters, like a real key, but nothing else. Only its hash is stored.
    $characters = (48..57) + (65..90)
    $fake = 'FAKE-KEY-' + (-join (1..65 | ForEach-Object { [char](Get-Random -InputObject $characters) }))
    [System.IO.File]::WriteAllText((Join-Path $Root 'config\expected.txt'), (Get-Sha256Hex -Text $fake))

    [System.IO.File]::WriteAllText((Join-Path $Root 'Ac8Module.psm1'), "function Get-Ac8Word { 'ac8-module-ok' }`r`nExport-ModuleMember -Function Get-Ac8Word`r`n")

    # The script that the endpoint's command runs: the same shape as restore.ps1 (a script file, a module imported by path, a question, a secure paste).
    $script = @'
$ErrorActionPreference = 'Stop'
$root = '__ROOT__'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$groups = @()
foreach ($group in $identity.Groups) { try { $groups += $group.Translate([System.Security.Principal.NTAccount]).Value } catch { $groups += $group.Value } }
$result = [ordered]@{ ran = $true; identity = $identity.Name; groups = $groups; import = $false; text = $false; secure = $false; secureLength = 0; errors = @() }
try {
    Microsoft.PowerShell.Core\Import-Module -Name (Join-Path $root 'Ac8Module.psm1') -Force -DisableNameChecking
    $result.import = ((Get-Ac8Word) -eq 'ac8-module-ok')
}
catch { $result.errors += "import: $($_.Exception.Message)" }
try {
    $typed = Read-Host -Prompt 'Type the word PINEAPPLE and press Enter'
    $result.text = ($typed.Trim().ToUpperInvariant() -eq 'PINEAPPLE')
}
catch { $result.errors += "text prompt: $($_.Exception.Message)" }
try {
    $secure = Read-Host -Prompt 'Paste the FAKE value that Prepare printed (nothing is shown) and press Enter' -AsSecureString
    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = (($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($plain)) | ForEach-Object { $_.ToString('x2') }) -join '') } finally { $sha.Dispose() }
    $result.secure = ($hash -eq (Get-Content -LiteralPath (Join-Path $root 'config\expected.txt') -TotalCount 1).Trim())
    $result.secureLength = $plain.Length
}
catch { $result.errors += "secure prompt: $($_.Exception.Message)" }
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $root 'out\result.json')
'Done. Now type Exit-PSSession and press Enter.'
'@
    [System.IO.File]::WriteAllText((Join-Path $Root 'current\ac8.ps1'), $script.Replace('__ROOT__', $Root))

    $role = "@{`r`n    GUID = '3f1d9a52-6b0e-4c7a-8d21-5e9c0a7b4f13'`r`n    ModulesToImport = @('Microsoft.PowerShell.Utility', 'Microsoft.PowerShell.Management')`r`n    VisibleFunctions = @('Test-Ac8Prompt')`r`n    FunctionDefinitions = @(@{ Name = 'Test-Ac8Prompt'; ScriptBlock = { & '$Root\current\ac8.ps1' } })`r`n}`r`n"
    [System.IO.File]::WriteAllText((Join-Path $Root 'config\Ac8.psrc'), $role)
    $session = "@{`r`n    SchemaVersion = '2.0.0.0'`r`n    GUID = '9a4c2e17-0d63-4b85-a1f7-6c3e8b2d5a90'`r`n    SessionType = 'RestrictedRemoteServer'`r`n    RunAsVirtualAccount = `$true`r`n    RunAsVirtualAccountGroups = @('$GroupName')`r`n    TranscriptDirectory = '$Root\transcripts'`r`n    ExecutionPolicy = 'Bypass'`r`n    RoleDefinitions = @{ '$me' = @{ RoleCapabilityFiles = '$Root\config\Ac8.psrc' } }`r`n}`r`n"
    [System.IO.File]::WriteAllText((Join-Path $Root 'config\Ac8.pssc'), $session)

    if (-not (Test-PSSessionConfigurationFile -Path (Join-Path $Root 'config\Ac8.pssc'))) { throw 'The session configuration file is not valid.' }
    Register-PSSessionConfiguration -Name $EndpointName -Path (Join-Path $Root 'config\Ac8.pssc') -Force | Out-Null

    Write-Host ''
    Write-Host 'Prepared. Next, in THIS window:' -ForegroundColor Cyan
    Write-Host '  1. Run:   Enter-PSSession -ComputerName localhost -ConfigurationName Ac8Check'
    Write-Host '  2. Type:  Test-Ac8Prompt        (answer PINEAPPLE, then paste the value below; nothing is shown while you paste)'
    Write-Host '  3. Type:  Exit-PSSession'
    Write-Host '  4. Run:   powershell -NoProfile -ExecutionPolicy Bypass -File <this script> -Phase Finish'
    Write-Host ''
    Write-Host 'The made-up value to paste (select it, copy it, then right-click in the session to paste):' -ForegroundColor Cyan
    Write-Host $fake
    return
}

# ---- Finish: read what the session wrote, report, and remove everything ----
$passed = 0
$failed = 0
function Write-Check {
    param([bool]$Ok, [string]$Text)
    if ($Ok) { Write-Host "PASS  $Text" -ForegroundColor Green; $script:passed++ } else { Write-Host "FAIL  $Text" -ForegroundColor Red; $script:failed++ }
}
$resultFile = Join-Path $Root 'out\result.json'
$result = $null
if (Test-Path -LiteralPath $resultFile) { $result = Get-Content -LiteralPath $resultFile -Raw | ConvertFrom-Json }
Write-Check ($null -ne $result -and [bool]$result.ran) 'the session opened and the command ran its script file'
if ($null -eq $result) {
    Write-Host 'No result file was written: either the session did not open, the command did not run, or the script could not run in the session. Note the step you were at and any red text.' -ForegroundColor Yellow
}
else {
    Write-Check ([bool]$result.import) 'the script imported a module by its path inside the session'
    Write-Check ([bool]$result.text) 'the typed answer (a question with Read-Host) reached the script'
    Write-Check ([bool]$result.secure) "the pasted value (Read-Host -AsSecureString) reached the script intact ($($result.secureLength) characters)"
    $groups = @($result.groups)
    Write-Check (@($groups | Where-Object { $_ -like "*\$GroupName" }).Count -eq 1 -and $groups -notcontains 'BUILTIN\Administrators' -and [string]$result.identity -match 'Virtual') 'the session ran as a virtual account in the check group, and not as an administrator'
    foreach ($line in @($result.errors)) { if ($line) { Write-Host "      the script reported: $line" -ForegroundColor Yellow } }
}
$transcripts = @(Get-ChildItem -LiteralPath (Join-Path $Root 'transcripts') -File -Recurse -ErrorAction SilentlyContinue)
$fakeHash = ''
$leak = $false
if (Test-Path -LiteralPath (Join-Path $Root 'config\expected.txt')) { $fakeHash = (Get-Content -LiteralPath (Join-Path $Root 'config\expected.txt') -TotalCount 1).Trim() }
foreach ($file in $transcripts) {
    $text = Get-Content -LiteralPath $file.FullName -Raw
    foreach ($word in ($text -split '\s+')) { if ($word -like 'FAKE-KEY-*' -and (Get-Sha256Hex -Text $word) -eq $fakeHash) { $leak = $true } }
}
Write-Check ($transcripts.Count -gt 0 -and -not $leak) 'the transcript of the session exists and does not contain the pasted value'
Remove-Ac8Check
Write-Host ''
if ($failed -eq 0 -and $passed -ge 6) { Write-Host 'AC-8 RESULT: PASS' -ForegroundColor Green; exit 0 }
Write-Host 'AC-8 RESULT: FAIL' -ForegroundColor Red
exit 1
```
