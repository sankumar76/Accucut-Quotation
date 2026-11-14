<#
.SYNOPSIS
  Shared functions of the Windows install and update scripts (STORY-10.04; ADR-015; architecture section 9.9).

.DESCRIPTION
  Windows PowerShell 5.1 only: nothing here uses a PowerShell 7 feature, so it runs on every Windows Server with nothing extra installed.

  The surface is deliberately small. STORY-10.05 (backup) and STORY-10.11 (restore, JEA) import this module and add their own functions
  here when they need them (the `job_runs` write, the backup manifest, the free-space reading, the byte pipe `pg_dump | age`). What is
  exported today is listed, with one line each, in deploy/windows/README.md ("The shared module").

  Rules that every function follows:
    - A secret is never put on a command line. It reaches a child process through that process's environment or its standard input.
    - A secret is never written to a log. Log lines pass through Hide-AccucutSecrets, which blanks every value that was registered with
      Register-AccucutSecret.
    - A prompt is a small function (Read-AccucutHostInput, Read-AccucutSecretInput), so that Pester can mock it.
#>

Set-StrictMode -Version 2.0

# The names the services are registered under, in start order (architecture section 9.9).
$script:ServiceNames = @('AccucutApp', 'AccucutWorker')

# The PostgreSQL service the two services depend on (ADR-015: PostgreSQL 17 from the vendor's installer).
$script:PostgresServiceName = 'postgresql-x64-17'

# Values that must never reach a log line. Filled by Register-AccucutSecret.
$script:RegisteredSecrets = New-Object System.Collections.Generic.List[string]

# A value shorter than this is not registered as a secret: blanking a one-letter value would mangle every log line.
$script:MinimumSecretLength = 4

# A .env value made only of these characters is written as it is; anything else is quoted.
$script:PlainEnvValuePattern = '^[A-Za-z0-9_@:/.+,=?&%~!\-]*$'

# Variables that are not written to the runtime .env, and why (see Split-AccucutEnvValues).
# The owner role's connection string and the first Admin's e-mail and password are for the install and update steps only: the app and the
# worker must never hold the owner password (.env.example, architecture section 5.1), so they go to migrate.env, which only Administrators read.
$script:MigrateOnlyNames = @('MIGRATE_DATABASE_URL', 'ADMIN_EMAIL', 'ADMIN_INITIAL_PASSWORD')

# Development-only variables of .env.example: read by compose.dev.yml, never by the application. Not written on a server.
$script:DevelopmentOnlyNames = @('DB_OWNER_PASSWORD', 'DB_APP_PASSWORD')

# The prefix that marks a template value that must be replaced (src/lib/env.ts, PLACEHOLDER_PREFIX).
$script:PlaceholderPrefix = 'CHANGE_ME'

#region Layout, files, hashes

function Get-AccucutPaths {
    <# The host layout of architecture section 9.9. Every path is configurable through -Root; nothing else is hard-coded. #>
    [CmdletBinding()]
    param([string]$Root = 'C:\Accucut')

    $Root = $Root.TrimEnd('\')
    $config = Join-Path $Root 'config'
    [pscustomobject]@{
        Root           = $Root
        Releases       = Join-Path $Root 'releases'
        Current        = Join-Path $Root 'current'
        Config         = $config
        Services       = Join-Path $Root 'services'
        Backups        = Join-Path $Root 'backups'
        Logs           = Join-Path $Root 'logs'
        EnvFile        = Join-Path $config '.env'
        MigrateEnvFile = Join-Path $config 'migrate.env'
        StateFile      = Join-Path $config 'install-state.json'
    }
}

function Get-AccucutFileSha256 {
    <# The SHA-256 of a file as 64 lower-case hex characters. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            $bytes = $sha.ComputeHash($stream)
        }
        finally {
            $sha.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
    return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Read-AccucutSha256File {
    <# Reads the expected hash from a `.sha256` file: either `<hash>  <name>` (sha256sum) or the bare hash. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $first = (Get-Content -LiteralPath $Path -TotalCount 1)
    if ($null -eq $first) { throw "The checksum file '$Path' is empty." }
    $token = ($first.Trim() -split '\s+')[0]
    if ($token -notmatch '^[0-9A-Fa-f]{64}$') { throw "The checksum file '$Path' does not start with a SHA-256 (64 hexadecimal characters)." }
    return $token.ToLowerInvariant()
}

function Assert-AccucutSha256 {
    <# Stops with an error unless the file's SHA-256 equals the expected one. Run this before anything is changed. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Expected
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "The file '$Path' was not found." }
    if ($Expected -notmatch '^[0-9A-Fa-f]{64}$') { throw 'The expected SHA-256 is not 64 hexadecimal characters.' }
    $actual = Get-AccucutFileSha256 -Path $Path
    if ($actual -ne $Expected.ToLowerInvariant()) {
        throw "The SHA-256 of '$(Split-Path -Leaf $Path)' does not match. Expected $($Expected.ToLowerInvariant()) but the file is $actual. Nothing was changed. Download the release again."
    }
}

function Read-AccucutReleaseInfo {
    <# Reads release.json from an unpacked package. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$PackageRoot)

    $file = Join-Path $PackageRoot 'release.json'
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "'$PackageRoot' has no release.json: it is not an Accucut release package." }
    $info = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    if (-not ($info.PSObject.Properties.Name -contains 'tag') -or [string]$info.tag -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$') {
        throw "release.json in '$PackageRoot' has no valid tag (letters, digits, dot, dash and underscore only)."
    }
    return $info
}

function Test-AccucutAdministrator {
    <# True when the current process runs elevated as an administrator. #>
    [CmdletBinding()]
    param()

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

#endregion

#region Versions

function ConvertTo-AccucutVersion {
    <# Finds the first `major.minor[.patch]` in a text such as `v22.12.0` or `psql (PostgreSQL) 17.2`. Returns a [version] or $null. #>
    [CmdletBinding()]
    param([AllowNull()][AllowEmptyString()][string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    $match = [regex]::Match($Text, '(\d+)\.(\d+)(?:\.(\d+))?')
    if (-not $match.Success) { return $null }
    $patch = 0
    if ($match.Groups[3].Success) { $patch = [int]$match.Groups[3].Value }
    return New-Object System.Version([int]$match.Groups[1].Value, [int]$match.Groups[2].Value, $patch)
}

function Test-AccucutNodeVersion {
    <# Node 22.12 or later (package.json engines; ADR-015). Returns an object with Ok and a Message that names no secret. #>
    [CmdletBinding()]
    param([AllowNull()][AllowEmptyString()][string]$VersionText)

    $version = ConvertTo-AccucutVersion -Text $VersionText
    if ($null -eq $version) { return [pscustomobject]@{ Ok = $false; Version = $null; Message = 'Node.js was not found or its version could not be read. Install Node.js 22 LTS (22.12 or later) from nodejs.org.' } }
    if ($version -lt (New-Object System.Version(22, 12, 0))) {
        return [pscustomobject]@{ Ok = $false; Version = $version; Message = "Node.js $version is too old. Install Node.js 22 LTS (22.12 or later) from nodejs.org." }
    }
    $note = "Node.js $version"
    if ($version.Major -gt 22) { $note = "Node.js $version (the portal is tested on Node 22 LTS)" }
    return [pscustomobject]@{ Ok = $true; Version = $version; Message = $note }
}

function Test-AccucutPostgresVersion {
    <# PostgreSQL 17 (architecture section 9.9). Takes the text of `psql --version` or the `server_version_num` number. #>
    [CmdletBinding()]
    param([AllowNull()][AllowEmptyString()][string]$VersionText)

    if ([string]::IsNullOrWhiteSpace($VersionText)) { return [pscustomobject]@{ Ok = $false; Major = 0; Message = 'PostgreSQL was not found. Install PostgreSQL 17 from postgresql.org (the Windows installer).' } }
    $major = 0
    $trimmed = $VersionText.Trim()
    if ($trimmed -match '^\d{6}$') {
        $major = [int][math]::Floor([int]$trimmed / 10000)
    }
    else {
        $version = ConvertTo-AccucutVersion -Text $trimmed
        if ($null -ne $version) { $major = $version.Major }
    }
    if ($major -ne 17) {
        return [pscustomobject]@{ Ok = $false; Major = $major; Message = "PostgreSQL 17 is required (found major version $major). Install PostgreSQL 17 from postgresql.org." }
    }
    return [pscustomobject]@{ Ok = $true; Major = $major; Message = 'PostgreSQL 17' }
}

#endregion

#region Prompts (small, so that Pester can mock them)

function Read-AccucutHostInput {
    <# One question, one answer. An empty answer returns the default. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Prompt,
        [string]$Default = ''
    )

    $suffix = ''
    if ($Default -ne '') { $suffix = " [$Default]" }
    $answer = Read-Host -Prompt "$Prompt$suffix"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    return $answer.Trim()
}

function Read-AccucutSecretInput {
    <# One secret, typed without echo. Returned as text so that the caller can register it for redaction and pass it through the environment. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Prompt)

    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

#endregion

#region Secrets, logs and child processes

function New-AccucutSecret {
    <# A random value of letters and digits from the operating system's random number generator. Letters and digits only, so it is safe in a URL. #>
    [CmdletBinding()]
    param([ValidateRange(16, 128)][int]$Length = 32)

    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $chars = New-Object char[] $Length
        $buffer = New-Object byte[] 4
        for ($i = 0; $i -lt $Length; $i++) {
            # Rejection sampling, so that every letter is equally likely.
            $limit = [uint32]([math]::Floor(4294967296 / $alphabet.Length) * $alphabet.Length)
            do {
                $generator.GetBytes($buffer)
                $number = [System.BitConverter]::ToUInt32($buffer, 0)
            } while ($number -ge $limit)
            $chars[$i] = $alphabet[[int]($number % $alphabet.Length)]
        }
        return -join $chars
    }
    finally {
        $generator.Dispose()
    }
}

function Register-AccucutSecret {
    <# Remembers a value so that Hide-AccucutSecrets blanks it in every log line and every captured output. #>
    [CmdletBinding()]
    param([AllowNull()][AllowEmptyString()][string]$Value)

    if ([string]::IsNullOrEmpty($Value) -or $Value.Length -lt $script:MinimumSecretLength) { return }
    if (-not $script:RegisteredSecrets.Contains($Value)) { $script:RegisteredSecrets.Add($Value) }
}

function Hide-AccucutSecrets {
    <# Replaces every registered secret in a text with three asterisks, longest first. #>
    [CmdletBinding()]
    param([AllowNull()][AllowEmptyString()][string]$Text)

    if ([string]::IsNullOrEmpty($Text)) { return $Text }
    $result = $Text
    foreach ($secret in ($script:RegisteredSecrets | Sort-Object -Property Length -Descending)) {
        $result = $result.Replace($secret, '***')
    }
    return $result
}

function Write-AccucutLog {
    <# Writes one line to the console and, if -LogFile is given, to that file. The text passes through Hide-AccucutSecrets first. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string]$Message,
        [string]$LogFile,
        [ValidateSet('Info', 'Warning', 'Error')][string]$Level = 'Info'
    )

    $clean = Hide-AccucutSecrets -Text $Message
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $line = "$stamp $($Level.ToUpperInvariant().PadRight(7)) $clean"
    switch ($Level) {
        'Error' { Write-Host $line -ForegroundColor Red }
        'Warning' { Write-Host $line -ForegroundColor Yellow }
        default { Write-Host $line }
    }
    if ($LogFile) {
        $directory = Split-Path -Parent $LogFile
        if ($directory -and -not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
        Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
    }
}

function ConvertTo-AccucutArgumentString {
    <# Joins arguments into one command-line string, quoting those with spaces or quotes (the rules of CommandLineToArgvW). #>
    [CmdletBinding()]
    param([string[]]$ArgumentList = @())

    $parts = foreach ($argument in $ArgumentList) {
        if ($argument -eq '') { '""'; continue }
        if ($argument -notmatch '[\s"]') { $argument; continue }
        $escaped = [regex]::Replace($argument, '(\\*)"', '$1$1\"')
        $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
        '"' + $escaped + '"'
    }
    return ($parts -join ' ')
}

function Invoke-AccucutNative {
    <#
    Runs a program and returns its exit code and its output, with registered secrets blanked.
    A secret goes in -Environment (set for the child only) or -StdIn, never in -ArgumentList.
    Without -AllowFailure a non-zero exit code is an error that names the program and the code and shows the blanked output.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [hashtable]$Environment = @{},
        [string]$StdIn,
        [string]$WorkingDirectory,
        [switch]$AllowFailure
    )

    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $FilePath
    $info.Arguments = ConvertTo-AccucutArgumentString -ArgumentList $ArgumentList
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.RedirectStandardInput = ($PSBoundParameters.ContainsKey('StdIn'))
    $info.CreateNoWindow = $true
    if ($WorkingDirectory) { $info.WorkingDirectory = $WorkingDirectory }
    foreach ($name in $Environment.Keys) { $info.EnvironmentVariables[[string]$name] = [string]$Environment[$name] }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    [void]$process.Start()
    if ($PSBoundParameters.ContainsKey('StdIn')) {
        $process.StandardInput.Write($StdIn)
        $process.StandardInput.Close()
    }
    # Both streams are read to the end before waiting, so a full pipe cannot stall the child.
    $errorTask = $process.StandardError.ReadToEndAsync()
    $output = $process.StandardOutput.ReadToEnd()
    $process.WaitForExit()
    $errorText = $errorTask.Result
    $code = $process.ExitCode
    $process.Dispose()

    $combined = Hide-AccucutSecrets -Text (($output + $errorText).TrimEnd())
    $result = [pscustomobject]@{ ExitCode = $code; Output = $combined }
    if ($code -ne 0 -and -not $AllowFailure) {
        throw "'$([System.IO.Path]::GetFileName($FilePath))' failed with exit code $code.`n$combined"
    }
    return $result
}

#endregion

#region .env files

function Read-AccucutValuesFile {
    <# Reads a values file: `NAME=value` lines, `#` comments, blank lines. Returns an ordered hashtable. A value may be wrapped in one pair of quotes. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "The values file '$Path' was not found." }
    $values = [ordered]@{}
    $number = 0
    foreach ($line in (Get-Content -LiteralPath $Path)) {
        $number++
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
        if ($trimmed -notmatch '^([A-Za-z][A-Za-z0-9_]*)=(.*)$') { throw "Line $number of the values file is not NAME=value." }
        $value = $Matches[2]
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$Matches[1]] = $value
    }
    return $values
}

function Read-AccucutEnvTemplate {
    <# The variables of .env.example, in order, with their default text. Comments and blank lines are not returned. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $entries = New-Object System.Collections.Generic.List[object]
    foreach ($line in (Get-Content -LiteralPath $Path)) {
        if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
            $entries.Add([pscustomobject]@{ Name = $Matches[1]; Default = $Matches[2] })
        }
    }
    if ($entries.Count -eq 0) { throw "'$Path' holds no NAME=value line: it is not an environment template." }
    return , $entries.ToArray()
}

function Format-AccucutEnvValue {
    <# Quotes a value for a .env line when it holds anything but plain characters. Node's --env-file reads the file. #>
    [CmdletBinding()]
    param([AllowEmptyString()][string]$Value)

    if ($Value -match "[\r\n]") { throw 'A setting value may not contain a line break.' }
    if ($Value -match $script:PlainEnvValuePattern) { return $Value }
    if (-not $Value.Contains("'")) { return "'" + $Value + "'" }
    if (-not $Value.Contains('"')) { return '"' + $Value + '"' }
    throw 'A setting value may not contain both a single and a double quote.'
}

function Split-AccucutEnvValues {
    <#
    Turns the template and the chosen values into the two files' lines.
      Runtime: every variable the app and the worker read.
      Migrate: the owner role's URL and the first Admin (migrate.env, Administrators only).
    A variable of the template that has no value and a CHANGE_ME default is an error that names it. No value is ever named.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object[]]$Template,
        [Parameter(Mandatory)][System.Collections.IDictionary]$Values
    )

    $runtime = New-Object System.Collections.Generic.List[string]
    $migrate = New-Object System.Collections.Generic.List[string]
    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($entry in $Template) {
        if ($script:DevelopmentOnlyNames -contains $entry.Name) { continue }
        $value = $entry.Default
        if ($Values.Contains($entry.Name)) { $value = [string]$Values[$entry.Name] }
        if ($value.StartsWith($script:PlaceholderPrefix)) { $missing.Add($entry.Name); continue }
        $line = "$($entry.Name)=$(Format-AccucutEnvValue -Value $value)"
        if ($script:MigrateOnlyNames -contains $entry.Name) { $migrate.Add($line) } else { $runtime.Add($line) }
    }
    if ($missing.Count -gt 0) { throw "No value was given for: $($missing -join ', ')." }
    return [pscustomobject]@{ Runtime = $runtime.ToArray(); Migrate = $migrate.ToArray() }
}

function Read-AccucutEnvFile {
    <# Reads a .env file into an ordered hashtable (NAME to value). Quotes are removed. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $values = [ordered]@{}
    foreach ($line in (Get-Content -LiteralPath $Path)) {
        if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
            $value = $Matches[2]
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $values[$Matches[1]] = $value
        }
    }
    return $values
}

function Get-AccucutServiceSid {
    <#
    The SID of a Windows service's own account (NT SERVICE\<name>), worked out from the name: S-1-5-80 plus the five 32-bit parts of the SHA-1 of the
    upper-case name in UTF-16. Windows does the same, so it needs no look-up, and it works before the service is registered. A look-up by the name
    NT SERVICE\<name> failed on the build runner, so permissions are always set by this SID.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Name)

    $sha = [System.Security.Cryptography.SHA1]::Create()
    try { $hash = $sha.ComputeHash([System.Text.Encoding]::Unicode.GetBytes($Name.ToUpperInvariant())) } finally { $sha.Dispose() }
    $parts = foreach ($index in 0..4) { [System.BitConverter]::ToUInt32($hash, 4 * $index) }
    return 'S-1-5-80-' + ($parts -join '-')
}

function ConvertTo-AccucutIdentity {
    <# An account name or a SID in text, as the object that a permission rule needs. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Account)

    if ($Account -match '^S-1-\d+(-\d+)+$') { return (New-Object System.Security.Principal.SecurityIdentifier($Account)) }
    return (New-Object System.Security.Principal.NTAccount($Account))
}

function Set-AccucutFileAcl {
    <#
    Makes a file readable by Administrators and the named accounts only: inheritance is cut and no other entry is kept.
    Administrators get full control; each -ReadAccount gets read. The file may be empty when this runs, so the content is never exposed.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$ReadAccount = @()
    )

    $security = New-Object System.Security.AccessControl.FileSecurity
    $security.SetAccessRuleProtection($true, $false)
    $administrators = New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)
    $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($administrators, 'FullControl', 'Allow')))
    foreach ($account in $ReadAccount) {
        $identity = ConvertTo-AccucutIdentity -Account $account
        $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'Read', 'Allow')))
    }
    [System.IO.File]::SetAccessControl($Path, $security)
}

function Write-AccucutSecureFile {
    <# Creates the file empty, restricts it, and only then writes the content, so the content is never readable by anyone else. UTF-8 without a byte order mark. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$Line,
        [string[]]$ReadAccount = @()
    )

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
    [System.IO.File]::WriteAllBytes($Path, (New-Object byte[] 0))
    Set-AccucutFileAcl -Path $Path -ReadAccount $ReadAccount
    $text = ($Line -join "`r`n") + "`r`n"
    [System.IO.File]::WriteAllText($Path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function Expand-AccucutTemplate {
    <# Replaces {{NAME}} in a text with the XML-escaped value of NAME. An unknown name is an error, so a typo cannot reach a service file. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][hashtable]$Token
    )

    $pattern = '\{\{([A-Z][A-Z0-9_]*)\}\}'
    $unknown = New-Object System.Collections.Generic.List[string]
    $result = [regex]::Replace($Text, $pattern, {
            param($match)
            $name = $match.Groups[1].Value
            if ($Token.ContainsKey($name)) { return [System.Security.SecurityElement]::Escape([string]$Token[$name]) }
            $unknown.Add($name)
            return $match.Value
        })
    if ($unknown.Count -gt 0) { throw "The template uses a name that has no value: $(($unknown | Select-Object -Unique) -join ', ')." }
    return $result
}

#endregion

#region Releases and the current junction

function Get-AccucutCurrentRelease {
    <# The tag of the release that the `current` junction points at, or $null when there is none. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$Paths)

    if (-not (Test-Path -LiteralPath $Paths.Current)) { return $null }
    $item = Get-Item -LiteralPath $Paths.Current -Force
    $target = $null
    if ($item.PSObject.Properties.Name -contains 'Target') { $target = $item.Target }
    if ($null -eq $target) { return $null }
    $first = @($target)[0]
    if ([string]::IsNullOrWhiteSpace($first)) { return $null }
    return (Split-Path -Leaf ($first.TrimEnd('\')))
}

function Set-AccucutCurrentRelease {
    <# Points the `current` junction at releases\<Tag>. Only the link is removed or made: never the files it points at. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string]$Tag
    )

    $target = Join-Path $Paths.Releases $Tag
    if (-not (Test-Path -LiteralPath $target -PathType Container)) { throw "The release folder '$target' does not exist." }
    if (Test-Path -LiteralPath $Paths.Current) {
        $existing = Get-Item -LiteralPath $Paths.Current -Force
        if (-not ($existing.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
            throw "'$($Paths.Current)' exists and is a real folder, not a junction. It was not touched."
        }
        # Directory.Delete with recurse = $false on a junction removes the link and nothing it points at.
        [System.IO.Directory]::Delete($Paths.Current, $false)
    }
    New-Item -ItemType Junction -Path $Paths.Current -Target $target | Out-Null
}

function Remove-AccucutOldReleases {
    <# Deletes release folders that are not in -Keep. Refuses any folder outside the releases folder, and the folder `current` points at. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string[]]$Keep
    )

    $removed = New-Object System.Collections.Generic.List[string]
    if (-not (Test-Path -LiteralPath $Paths.Releases)) { return $removed.ToArray() }
    $current = Get-AccucutCurrentRelease -Paths $Paths
    $releasesFull = [System.IO.Path]::GetFullPath($Paths.Releases).TrimEnd('\') + '\'
    foreach ($folder in (Get-ChildItem -LiteralPath $Paths.Releases -Directory -Force)) {
        if ($Keep -contains $folder.Name -or $folder.Name -eq $current) { continue }
        if ($folder.Name.StartsWith('.')) { continue }
        $full = [System.IO.Path]::GetFullPath($folder.FullName)
        if (-not $full.StartsWith($releasesFull, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to delete '$full': it is outside the releases folder." }
        if ($folder.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw "Refusing to delete '$full': it is a link." }
        Remove-AccucutDirectory -Path $full -Within $Paths.Releases
        $removed.Add($folder.Name)
    }
    return $removed.ToArray()
}

function Remove-AccucutDirectory {
    <# Deletes one folder tree with `rd /s /q` on a \\?\ path, which has no 260-character limit (node_modules is deep). Refuses a folder outside -Within. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Within
    )

    $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
    $root = [System.IO.Path]::GetFullPath($Within).TrimEnd('\') + '\'
    if (-not ($full + '\').StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or ($full + '\') -eq $root) {
        throw "Refusing to delete '$full': it is not inside '$Within'."
    }
    if (-not (Test-Path -LiteralPath $full)) { return }
    $result = Invoke-AccucutNative -FilePath "$env:SystemRoot\System32\cmd.exe" -ArgumentList @('/c', 'rd', '/s', '/q', "\\?\$full") -AllowFailure
    if ($result.ExitCode -ne 0) { throw "The folder '$full' could not be deleted. $($result.Output)" }
}

function Copy-AccucutTree {
    <# Copies a folder tree with robocopy (no 260-character limit). Robocopy exit codes below 8 are success. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination
    )

    $arguments = @($Source, $Destination, '/E', '/COPY:DAT', '/DCOPY:DAT', '/R:2', '/W:2', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
    $result = Invoke-AccucutNative -FilePath "$env:SystemRoot\System32\robocopy.exe" -ArgumentList $arguments -AllowFailure
    if ($result.ExitCode -ge 8) { throw "Copying '$Source' to '$Destination' failed (robocopy exit code $($result.ExitCode)). $($result.Output)" }
}

function Remove-AccucutOldLogs {
    <# Deletes the .log files in a folder that were last written more than -KeepDays days ago (NFR-024: 30 days). Returns the names removed. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [ValidateRange(1, 3650)][int]$KeepDays = 30
    )

    $removed = New-Object System.Collections.Generic.List[string]
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return $removed.ToArray() }
    $limit = (Get-Date).AddDays(-$KeepDays)
    foreach ($file in (Get-ChildItem -LiteralPath $Path -File -Filter '*.log' -Force)) {
        if ($file.LastWriteTime -lt $limit) {
            Remove-Item -LiteralPath $file.FullName -Force
            $removed.Add($file.Name)
        }
    }
    return $removed.ToArray()
}

#endregion

#region Services and health

function Get-AccucutServiceNames {
    <# The two service names, in start order. #>
    [CmdletBinding()]
    param()

    return $script:ServiceNames
}

function Get-AccucutPostgresServiceName {
    <# The PostgreSQL service the two services depend on. #>
    [CmdletBinding()]
    param()

    return $script:PostgresServiceName
}

function Stop-AccucutServices {
    <# Stops the app and the worker (worker first) and waits until they are stopped. A service that is not installed is skipped. #>
    [CmdletBinding()]
    param([ValidateRange(5, 600)][int]$TimeoutSeconds = 60)

    $names = @($script:ServiceNames)
    [array]::Reverse($names)
    foreach ($name in $names) {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($null -eq $service) { continue }
        if ($service.Status -ne 'Stopped') {
            Stop-Service -Name $name -Force -ErrorAction Stop
            $service.WaitForStatus('Stopped', (New-TimeSpan -Seconds $TimeoutSeconds))
        }
    }
}

function Start-AccucutServices {
    <# Starts the app and the worker. #>
    [CmdletBinding()]
    param([ValidateRange(5, 600)][int]$TimeoutSeconds = 60)

    foreach ($name in $script:ServiceNames) {
        $service = Get-Service -Name $name -ErrorAction Stop
        if ($service.Status -ne 'Running') {
            Start-Service -Name $name -ErrorAction Stop
            $service.WaitForStatus('Running', (New-TimeSpan -Seconds $TimeoutSeconds))
        }
    }
}

function Get-AccucutHttpStatus {
    <# The HTTP status code of a GET, or 0 when nothing answered. Never follows a redirect, so a sign-in redirect is reported as it is. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Url,
        [int]$TimeoutSeconds = 5
    )

    try {
        $request = [System.Net.HttpWebRequest]::Create($Url)
        $request.Method = 'GET'
        $request.Timeout = $TimeoutSeconds * 1000
        $request.AllowAutoRedirect = $false
        $response = $request.GetResponse()
        try { return [int]$response.StatusCode } finally { $response.Close() }
    }
    catch [System.Net.WebException] {
        if ($null -ne $_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            $_.Exception.Response.Close()
            return $code
        }
        return 0
    }
    catch {
        return 0
    }
}

function Wait-AccucutHealth {
    <# Polls the health address until it answers 200, or the time is up. Returns $true or $false. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Url,
        [ValidateRange(5, 1800)][int]$TimeoutSeconds = 120,
        [ValidateRange(1, 60)][int]$IntervalSeconds = 3
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ($true) {
        if ((Get-AccucutHttpStatus -Url $Url) -eq 200) { return $true }
        if ((Get-Date) -ge $deadline) { return $false }
        Start-Sleep -Seconds $IntervalSeconds
    }
}

function Assert-AccucutFreeSpace {
    <# Stops with an error when the volume that holds -Path has less than -MinimumBytes free. Run before unpacking a release. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][long]$MinimumBytes
    )

    $root = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($Path))
    $drive = New-Object System.IO.DriveInfo($root)
    if ($drive.AvailableFreeSpace -lt $MinimumBytes) {
        $needed = [math]::Ceiling($MinimumBytes / 1MB)
        $free = [math]::Floor($drive.AvailableFreeSpace / 1MB)
        throw "Not enough free disk space on $root : $free MB free, at least $needed MB needed. Nothing was changed."
    }
}

function Assert-AccucutServiceIdentity {
    <# Stops with an error unless the service runs as its own virtual account, NT SERVICE\<name>, and starts Automatic (Delayed Start). Never LocalSystem. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Name)

    $service = Get-CimInstance -ClassName Win32_Service -Filter "Name='$Name'"
    if ($null -eq $service) { throw "The service '$Name' is not registered." }
    $expected = "NT SERVICE\$Name"
    if ($service.StartName -ine $expected) {
        throw "The service '$Name' runs as '$($service.StartName)', not as '$expected'. It must never run as LocalSystem. Refusing to go on."
    }
    $delayed = $false
    if ($service.PSObject.Properties.Name -contains 'DelayedAutoStart') { $delayed = [bool]$service.DelayedAutoStart }
    if ($service.StartMode -ne 'Auto' -or -not $delayed) {
        throw "The service '$Name' does not start as Automatic (Delayed Start) (start mode '$($service.StartMode)')."
    }
}

function Set-AccucutServiceIdentity {
    <# Gives a registered service its own virtual account (no password) and Automatic (Delayed Start), then checks both. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Name)

    $sc = "$env:SystemRoot\System32\sc.exe"
    [void](Invoke-AccucutNative -FilePath $sc -ArgumentList @('config', $Name, 'obj=', "NT SERVICE\$Name"))
    [void](Invoke-AccucutNative -FilePath $sc -ArgumentList @('config', $Name, 'start=', 'delayed-auto'))
    Assert-AccucutServiceIdentity -Name $Name
}

function Initialize-AccucutServiceFiles {
    <#
    Writes C:\Accucut\services\<name>.exe (the pinned WinSW from the release) and <name>.xml (the release's template, filled in) for both services.
    Returns the names whose XML is new or changed, so the caller can register or refresh them. Holds paths and ports only, no secret.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string]$ReleaseDirectory,
        [Parameter(Mandatory)][string]$NodeExe,
        [Parameter(Mandatory)][ValidateRange(1, 65535)][int]$Port,
        [Parameter(Mandatory)][string]$ListenAddress
    )

    if (-not (Test-Path -LiteralPath $Paths.Services)) { New-Item -ItemType Directory -Path $Paths.Services -Force | Out-Null }
    $winsw = Join-Path $ReleaseDirectory 'bin\winsw.exe'
    if (-not (Test-Path -LiteralPath $winsw -PathType Leaf)) { throw "The release has no bin\winsw.exe: '$winsw'." }
    $tokens = @{
        NODE_EXE       = $NodeExe
        ENV_FILE       = $Paths.EnvFile
        CURRENT_DIR    = $Paths.Current
        LOG_DIR        = $Paths.Logs
        PORT           = [string]$Port
        LISTEN_ADDRESS = $ListenAddress
    }
    $changed = New-Object System.Collections.Generic.List[string]
    foreach ($name in $script:ServiceNames) {
        $exe = Join-Path $Paths.Services "$name.exe"
        if (-not (Test-Path -LiteralPath $exe) -or (Get-AccucutFileSha256 -Path $exe) -ne (Get-AccucutFileSha256 -Path $winsw)) {
            Copy-Item -LiteralPath $winsw -Destination $exe -Force
        }
        $template = Get-Content -LiteralPath (Join-Path $ReleaseDirectory "services\$name.xml") -Raw
        $text = Expand-AccucutTemplate -Text $template -Token $tokens
        $xmlPath = Join-Path $Paths.Services "$name.xml"
        $existing = $null
        if (Test-Path -LiteralPath $xmlPath) { $existing = Get-Content -LiteralPath $xmlPath -Raw }
        if ($existing -ne $text) {
            [System.IO.File]::WriteAllText($xmlPath, $text, (New-Object System.Text.UTF8Encoding($false)))
            $changed.Add($name)
        }
    }
    return $changed.ToArray()
}

function Expand-AccucutZip {
    <# Unpacks a zip into a new folder, refusing any entry that would land outside it. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ZipPath,
        [Parameter(Mandatory)][string]$Destination
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    $root = [System.IO.Path]::GetFullPath($Destination).TrimEnd('\') + '\'
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        foreach ($entry in $archive.Entries) {
            $target = [System.IO.Path]::GetFullPath((Join-Path $Destination $entry.FullName))
            if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw "The zip holds an entry outside its folder ('$($entry.FullName)'). Refusing to unpack it." }
            if ($entry.FullName.EndsWith('/') -or $entry.FullName.EndsWith('\')) {
                if (-not (Test-Path -LiteralPath $target)) { New-Item -ItemType Directory -Path $target -Force | Out-Null }
                continue
            }
            $parent = Split-Path -Parent $target
            if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
        }
    }
    finally {
        $archive.Dispose()
    }
}

#region Path trust: the one rule (STORY-10.04 security review)

function Get-AccucutPathSecurity {
    <# The owner and the allow rules of a file or folder as plain data (SIDs and numbers). A function of its own, so that Pester can mock it. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $item = Get-Item -LiteralPath $Path -Force
    $security = $item.GetAccessControl()
    $rules = New-Object System.Collections.Generic.List[object]
    foreach ($rule in $security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { continue }
        $rules.Add([pscustomobject]@{
                Sid         = $rule.IdentityReference.Value
                Rights      = [int]$rule.FileSystemRights
                InheritOnly = [bool]($rule.PropagationFlags -band [System.Security.AccessControl.PropagationFlags]::InheritOnly)
                Inherited   = [bool]$rule.IsInherited
            })
    }
    return [pscustomobject]@{ Owner = $security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value; Rules = $rules.ToArray() }
}

function Assert-AccucutPathTrusted {
    <#
    THE rule for trusting a path, and the only copy of it: used for the install folder, releases, a release, config, logs, and the scripts and the module
    (install.ps1 and update.ps1 load this module first, and check with it before they use anything else). It walks every part of the path, from the
    drive root down to the target, and stops with an error for the first part that is not safe. For every part:
      - it must not be a link (a junction or symbolic link could send the path somewhere else). One exception, asked for with -AllowLinkAtLeaf: the last
        part may be a link, for `current`; the caller then checks where it points;
      - its owner must be Administrators (S-1-5-32-544), SYSTEM (S-1-5-18) or TrustedInstaller (the owner of system folders such as Program Files);
      - nobody else may be able to replace or remove it, or change who controls it: no allow rule for another principal may carry Delete,
        DeleteSubdirectoriesAndFiles (delete a child), ChangePermissions or TakeOwnership.
    The last part (the target) gets the stricter rule, because what is inside it is run: nobody else may carry WriteData (create files), AppendData (create
    folders), WriteExtendedAttributes or WriteAttributes either. Rules that only reach what is created inside the target later (inherit-only) count for the
    target, because they decide who controls the files that will be there. This includes CREATOR OWNER (S-1-3-0), which is a placeholder that becomes
    whoever creates a file: it is a writer like any other principal that is not an administrator.

    Generic rights are mapped to the specific rights they stand for before any test, so they cannot pass as "not a writer": GENERIC_ALL (0x10000000) is
    FullControl, and GENERIC_WRITE (0x40000000) is FILE_GENERIC_WRITE (WriteData, AppendData, WriteExtendedAttributes, WriteAttributes, ReadPermissions and
    Synchronize).

    What is allowed on the drive root and on any other part above the target, and why. Windows gives every user "create folders" and "create files" on
    the drive root (for example `Authenticated Users: create folders / append data` and `create files`, on that folder only) and `Modify` or generic rights
    on what is inside it (inherit-only). Those do not let a user delete, replace or take over an existing folder that an administrator owns, so they must
    not make every install fail: a part above the target is refused only for Delete, DeleteSubdirectoriesAndFiles, ChangePermissions or TakeOwnership, and
    rules marked inherit-only are not counted there (they reach what is created inside that part, and each part below is checked on its own permissions
    anyway, inherited rules included).

    -AllowedWriter names SIDs (never account names) that may also write to the target, for example the two service accounts for the logs folder.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$AllowedWriter = @(),
        [switch]$AllowLinkAtLeaf
    )

    if ($Path.StartsWith('\\') -or -not [System.IO.Path]::IsPathRooted($Path)) { throw "'$Path' is not a full local path. Refusing to use it." }
    $full = [System.IO.Path]::GetFullPath($Path)
    if ($full.Length -gt 3) { $full = $full.TrimEnd('\') }
    $driveRoot = [System.IO.Path]::GetPathRoot($full)
    $trustedSids = @('S-1-5-32-544', 'S-1-5-18', 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
    $rights = [System.Security.AccessControl.FileSystemRights]
    $replaceMask = [int64]($rights::DeleteSubdirectoriesAndFiles -bor $rights::Delete -bor $rights::ChangePermissions -bor $rights::TakeOwnership)
    $writeMask = [int64]($rights::DeleteSubdirectoriesAndFiles -bor $rights::Delete -bor $rights::ChangePermissions -bor $rights::TakeOwnership -bor $rights::WriteData -bor $rights::AppendData -bor $rights::WriteExtendedAttributes -bor $rights::WriteAttributes)
    $genericAll = [int64]0x10000000
    $genericWrite = [int64]0x40000000
    $fullControl = [int64]0x1F01FF
    $fileGenericWrite = [int64]0x120116

    $chain = New-Object System.Collections.Generic.List[string]
    $chain.Add($driveRoot)
    $current = $driveRoot
    foreach ($segment in ($full.Substring($driveRoot.Length) -split '\\')) {
        if ($segment -eq '') { continue }
        $current = Join-Path $current $segment
        $chain.Add($current)
    }

    for ($index = 0; $index -lt $chain.Count; $index++) {
        $part = $chain[$index]
        $isTarget = ($index -eq $chain.Count - 1)
        if (-not (Test-Path -LiteralPath $part)) { throw "'$part' does not exist. Refusing to use '$full'." }
        $item = Get-Item -LiteralPath $part -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            if ($isTarget -and $AllowLinkAtLeaf) { continue }
            throw "'$part' is a link, not a real folder, so '$full' could lead somewhere else. Refusing to use it."
        }
        $security = Get-AccucutPathSecurity -Path $part
        if ($trustedSids -notcontains $security.Owner) {
            throw "'$part' is owned by $($security.Owner), not by Administrators, SYSTEM or TrustedInstaller, so someone else controls it. Refusing to use '$full'."
        }
        $mask = $replaceMask
        if ($isTarget) { $mask = $writeMask }
        foreach ($rule in $security.Rules) {
            if ($rule.InheritOnly -and -not $isTarget) { continue }
            if ($trustedSids -contains $rule.Sid) { continue }
            if ($isTarget -and ($AllowedWriter -contains $rule.Sid)) { continue }
            $bits = [int64][System.BitConverter]::ToUInt32([System.BitConverter]::GetBytes([int]$rule.Rights), 0)
            if (($bits -band $genericAll) -ne 0) { $bits = $bits -bor $fullControl }
            if (($bits -band $genericWrite) -ne 0) { $bits = $bits -bor $fileGenericWrite }
            if (($bits -band $mask) -ne 0) {
                $inherited = $false
                if ($rule.PSObject.Properties.Name -contains 'Inherited') { $inherited = [bool]$rule.Inherited }
                $named = ([System.Security.AccessControl.FileSystemRights][int]$rule.Rights).ToString()
                throw "'$part' can be changed by $($rule.Sid) (rights: $named; inherited: $inherited; inherit-only: $($rule.InheritOnly)), who is not an administrator, so '$full' could be replaced or changed. Refusing to use it."
            }
        }
    }
}

function Assert-AccucutFreshRoot {
    <#
    The install folder must not exist, or must be an EMPTY real folder owned by Administrators or SYSTEM. Anything else could be under the control
    of a user who is not an administrator (they could have made the folder, or put a file or a link in it, and kept their rights), and the install
    would then run programs from it as a service. Returns 'New' or 'Empty'. (Whether an existing empty folder may be used also depends on who can
    write to it and to the folders above it: Assert-AccucutPathTrusted, run by the caller.)
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Root)

    if ($Root.StartsWith('\\') -or -not [System.IO.Path]::IsPathRooted($Root)) { throw "The install folder '$Root' must be a full local path such as C:\Accucut." }
    $full = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    if ($full.Length -le 3) { throw 'The install folder cannot be the root of a drive.' }
    if (-not (Test-Path -LiteralPath $full)) { return 'New' }
    $item = Get-Item -LiteralPath $full -Force
    if (-not $item.PSIsContainer) { throw "'$full' exists and is a file. Nothing was changed." }
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw "'$full' is a link, not a real folder. Nothing was changed." }
    $owner = (Get-AccucutPathSecurity -Path $full).Owner
    if (@('S-1-5-32-544', 'S-1-5-18') -notcontains $owner) {
        throw "'$full' already exists and is owned by $owner, not by Administrators or SYSTEM. A folder made by someone else is not trusted. Nothing was changed. Rename or delete it, or choose another -Root."
    }
    if (@(Get-ChildItem -LiteralPath $full -Force).Count -gt 0) {
        throw "'$full' already exists and is not empty. The install only uses a folder it makes itself, or an empty one owned by Administrators. Nothing was changed. If it is an earlier install, use update.ps1."
    }
    return 'Empty'
}

function Assert-AccucutLockedInstallRoot {
    <#
    The trust check of the install, run again and again between the steps (after the folder is locked, before the verified script is started, and before
    the second half loads anything from it), so that a swap at any moment is caught. It applies Assert-AccucutPathTrusted, the one rule, to the install
    folder (and so to every folder above it), to releases and, when -VerifiedRelease is given, to the release folder and to the two files that are run
    from it: install.ps1 and AccucutOps.psm1. The release must be directly inside releases.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [string]$VerifiedRelease,
        [switch]$RootOnly
    )

    $full = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    Assert-AccucutPathTrusted -Path $full
    if ($RootOnly) { return }
    $releases = Join-Path $full 'releases'
    Assert-AccucutPathTrusted -Path $releases
    if (-not [string]::IsNullOrWhiteSpace($VerifiedRelease)) {
        $release = [System.IO.Path]::GetFullPath($VerifiedRelease).TrimEnd('\')
        if ((Split-Path -Parent $release) -ine $releases) { throw "'$release' is not directly inside '$releases'. Refusing to use it." }
        Assert-AccucutPathTrusted -Path $release
        foreach ($file in 'install.ps1', 'AccucutOps.psm1') { Assert-AccucutPathTrusted -Path (Join-Path $release $file) }
    }
}


function New-AccucutDirectorySecurity {
    <# The permissions of a locked folder: owned by Administrators, no inheritance, full control for Administrators and SYSTEM, plus the given accounts. #>
    [CmdletBinding()]
    param(
        [string[]]$ReadAndExecute = @(),
        [string[]]$Modify = @()
    )

    $security = New-Object System.Security.AccessControl.DirectorySecurity
    $security.SetOwner((New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)))
    $security.SetAccessRuleProtection($true, $false)
    $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    $none = [System.Security.AccessControl.PropagationFlags]::None
    $allow = [System.Security.AccessControl.AccessControlType]::Allow
    $administrators = New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)
    $system = New-Object System.Security.Principal.SecurityIdentifier([System.Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
    foreach ($sid in @($administrators, $system)) {
        $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', $inherit, $none, $allow)))
    }
    foreach ($account in $ReadAndExecute) {
        $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule((New-Object System.Security.Principal.NTAccount($account)), 'ReadAndExecute', $inherit, $none, $allow)))
    }
    foreach ($account in $Modify) {
        $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule((New-Object System.Security.Principal.NTAccount($account)), 'Modify', $inherit, $none, $allow)))
    }
    return $security
}

function New-AccucutLockedDirectory {
    <#
    Creates a folder WITH its locked permissions in one call (CreateDirectory with a security descriptor), so there is no moment at which it
    exists with the permissions of its parent. If it exists already, nothing is changed and nothing is returned as new: the caller checks the
    owner and the permissions afterwards and refuses a folder that is not its own.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    [void][System.IO.Directory]::CreateDirectory($Path, (New-AccucutDirectorySecurity))
}

function Set-AccucutDirectoryAcl {
    <#
    Makes Administrators the OWNER of a folder, cuts inheritance, and sets exactly: full control for Administrators and SYSTEM, plus the given
    accounts at the given rights. The old list is replaced, not added to, so a right that someone else had given themselves is gone.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$ReadAndExecute = @(),
        [string[]]$Modify = @()
    )

    [System.IO.Directory]::SetAccessControl($Path, (New-AccucutDirectorySecurity -ReadAndExecute $ReadAndExecute -Modify $Modify))
}

function Grant-AccucutFolderAccess {
    <# Adds one allow rule (ReadAndExecute or Modify, inherited by what the folder holds) to a folder's existing list. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Account,
        [Parameter(Mandatory)][ValidateSet('ReadAndExecute', 'Modify')][string]$Rights
    )

    $security = [System.IO.Directory]::GetAccessControl($Path)
    $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule((ConvertTo-AccucutIdentity -Account $Account), $Rights, $inherit, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow)
    $security.AddAccessRule($rule)
    [System.IO.Directory]::SetAccessControl($Path, $security)
}

#endregion


function Assert-AccucutInstallTrusted {
    <#
    Runs Assert-AccucutPathTrusted on every path that update.ps1 writes to (the install folder, releases, config, services and logs), and checks that
    `current` is a link that points at a folder directly inside releases, and that this folder is trusted as well.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$Paths)

    $serviceAccounts = @($script:ServiceNames | ForEach-Object { Get-AccucutServiceSid -Name $_ })
    foreach ($folder in @($Paths.Root, $Paths.Releases, $Paths.Config, $Paths.Services)) { Assert-AccucutPathTrusted -Path $folder }
    Assert-AccucutPathTrusted -Path $Paths.Logs -AllowedWriter $serviceAccounts
    if (Test-Path -LiteralPath $Paths.Current) {
        Assert-AccucutPathTrusted -Path $Paths.Current -AllowLinkAtLeaf
        $item = Get-Item -LiteralPath $Paths.Current -Force
        $target = $null
        if ($item.PSObject.Properties.Name -contains 'Target') { $target = @($item.Target)[0] }
        if ([string]::IsNullOrWhiteSpace($target) -or (Split-Path -Parent ([System.IO.Path]::GetFullPath($target).TrimEnd('\'))) -ine [System.IO.Path]::GetFullPath($Paths.Releases).TrimEnd('\')) {
            throw "'$($Paths.Current)' does not point at a folder directly inside '$($Paths.Releases)'. Refusing to go on."
        }
        Assert-AccucutPathTrusted -Path $target
    }
}

function Invoke-AccucutMigration {
    <#
    The `migrate` step (architecture sections 5.6 and 9.9): `prisma migrate deploy` as the owner role, then ensure-seed-version.
    The owner's connection string is passed in the child's environment only, never on a command line. Both programs come from the release
    (migrate\), so the server needs no npm and no network.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ReleaseDirectory,
        [Parameter(Mandatory)][string]$NodeExe,
        [Parameter(Mandatory)][string]$MigrateDatabaseUrl
    )

    Register-AccucutSecret -Value $MigrateDatabaseUrl
    $migrate = Join-Path $ReleaseDirectory 'migrate'
    $environment = @{
        MIGRATE_DATABASE_URL        = $MigrateDatabaseUrl
        PRISMA_SCHEMA_ENGINE_BINARY = (Join-Path $migrate 'node_modules\@prisma\engines\schema-engine-windows.exe')
        PRISMA_HIDE_UPDATE_MESSAGE  = '1'
        CHECKPOINT_DISABLE          = '1'
        NODE_ENV                    = 'production'
    }
    $prismaCli = Join-Path $migrate 'node_modules\prisma\build\index.js'
    $deploy = Invoke-AccucutNative -FilePath $NodeExe -WorkingDirectory $migrate -Environment $environment `
        -ArgumentList @($prismaCli, 'migrate', 'deploy', '--config', (Join-Path $migrate 'prisma.config.mjs'))
    $seed = Invoke-AccucutNative -FilePath $NodeExe -WorkingDirectory $migrate -Environment $environment `
        -ArgumentList @((Join-Path $migrate 'ensure-seed-version.mjs'))
    return [pscustomobject]@{ Deploy = $deploy.Output; Seed = $seed.Output }
}

#endregion

Export-ModuleMember -Function @(
    'Get-AccucutPaths',
    'Get-AccucutFileSha256', 'Read-AccucutSha256File', 'Assert-AccucutSha256', 'Read-AccucutReleaseInfo', 'Test-AccucutAdministrator',
    'ConvertTo-AccucutVersion', 'Test-AccucutNodeVersion', 'Test-AccucutPostgresVersion',
    'Read-AccucutHostInput', 'Read-AccucutSecretInput',
    'New-AccucutSecret', 'Register-AccucutSecret', 'Hide-AccucutSecrets', 'Write-AccucutLog', 'ConvertTo-AccucutArgumentString', 'Invoke-AccucutNative',
    'Read-AccucutValuesFile', 'Read-AccucutEnvTemplate', 'Format-AccucutEnvValue', 'Split-AccucutEnvValues', 'Read-AccucutEnvFile',
    'Get-AccucutServiceSid', 'ConvertTo-AccucutIdentity', 'Set-AccucutFileAcl', 'Write-AccucutSecureFile', 'Expand-AccucutTemplate',
    'Get-AccucutCurrentRelease', 'Set-AccucutCurrentRelease', 'Remove-AccucutOldReleases', 'Remove-AccucutDirectory', 'Copy-AccucutTree', 'Remove-AccucutOldLogs',
    'Get-AccucutServiceNames', 'Get-AccucutPostgresServiceName', 'Stop-AccucutServices', 'Start-AccucutServices', 'Get-AccucutHttpStatus', 'Wait-AccucutHealth',
    'Expand-AccucutZip', 'Get-AccucutPathSecurity', 'Assert-AccucutPathTrusted', 'Assert-AccucutInstallTrusted', 'Assert-AccucutFreshRoot', 'Assert-AccucutLockedInstallRoot',
    'New-AccucutDirectorySecurity', 'New-AccucutLockedDirectory', 'Set-AccucutDirectoryAcl', 'Grant-AccucutFolderAccess',
    'Assert-AccucutFreeSpace', 'Assert-AccucutServiceIdentity', 'Set-AccucutServiceIdentity', 'Initialize-AccucutServiceFiles', 'Invoke-AccucutMigration'
)
