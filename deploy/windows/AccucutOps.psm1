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

  What this module may NOT do (ADR-015 Amendment 2): check trust, create the install root, hash, copy or unpack a release package, import a module,
  dot-source or run a script, look a program up through PATH, or do anything at import beyond defining functions and constants. All of that is the
  trust block that install.ps1 and update.ps1 carry inline, because this module is loaded only AFTER that block has checked it. It runs native
  programs only by the full paths it is given, and every name it exports is Verb-Accucut<Noun>, never a name of the trust block.
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

# The open log files of this process, by full path (see Write-AccucutLog). Filled while the process runs; nothing is opened when the module is loaded.
$script:OpenLogWriters = @{}

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
        BackupPgpass   = Join-Path $config 'backup.pgpass'
        BackupSettings = Join-Path $config 'backup-settings.json'
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

function New-AccucutLogFileName {
    <# A fresh, unpredictable log file name: <prefix>-<yyyyMMdd-HHmmss>-<8 random hex>.log (ADR-015 Amendment 2 (d): a log in a folder that the services can write is never a name that someone could guess). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9_-]{1,32}$')][string]$Prefix)

    return "$Prefix-$((Get-Date).ToString('yyyyMMdd-HHmmss'))-$([guid]::NewGuid().ToString('N').Substring(0, 8)).log"
}

function Close-AccucutLog {
    <# Closes the log files that Write-AccucutLog has open (all of them, or the one named). Needed before a log file or its folder is copied, moved or deleted. #>
    [CmdletBinding()]
    param([string]$LogFile)

    $keys = @($script:OpenLogWriters.Keys)
    if ($LogFile) { $keys = @([System.IO.Path]::GetFullPath($LogFile)) }
    foreach ($key in $keys) {
        if ($script:OpenLogWriters.ContainsKey($key)) {
            try { $script:OpenLogWriters[$key].Dispose() } finally { $script:OpenLogWriters.Remove($key) }
        }
    }
}

function Write-AccucutLog {
    <#
    Writes one line to the console and, if -LogFile is given, to that file. The text passes through Hide-AccucutSecrets first.
    A log file is created with FileMode.CreateNew and kept open (FileShare.Read: no one can delete, rename or replace it while it is open) for the rest of
    the process, and an existing file is refused, never appended to (ADR-015 Amendment 2 (d): the folder is writable by the services, so a file there could
    have been pre-created or swapped by them). Use New-AccucutLogFileName for the name, and Close-AccucutLog before the file is moved or deleted.
    #>
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
        $full = [System.IO.Path]::GetFullPath($LogFile)
        if (-not $script:OpenLogWriters.ContainsKey($full)) {
            $directory = [System.IO.Path]::GetDirectoryName($full)
            if ($directory -and -not [System.IO.Directory]::Exists($directory)) { [void][System.IO.Directory]::CreateDirectory($directory) }
            if ([System.IO.File]::Exists($full)) { throw "The log file '$full' already exists. A log file is always new and is never appended to; use New-AccucutLogFileName for its name." }
            $stream = [System.IO.FileStream]::new($full, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
            $writer = [System.IO.StreamWriter]::new($stream, [System.Text.UTF8Encoding]::new($false))
            $writer.AutoFlush = $true
            $script:OpenLogWriters[$full] = $writer
        }
        $script:OpenLogWriters[$full].WriteLine($line)
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
        # A placeholder anywhere in the value (a connection string holds it after the user name), as src/lib/env.ts also refuses it.
        if ($value.Contains($script:PlaceholderPrefix)) { $missing.Add($entry.Name); continue }
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

function Grant-AccucutInstallFolderAccess {
    <#
    The access of the two service accounts to the install folder, and no one else's (ADR-015 Amendment 2.1). On the root (inherited by everything under it):
    read and execute (0x1200A9) for each service SID, next to the Administrators and SYSTEM entries that the root was made with. On the logs folder: Modify
    (0x1301BF) for each, which is the one place the services write. No other account (not the shared service accounts, not Users) gets anything, and there is no timed
    task: the worker prunes the logs itself.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string[]]$ServiceSid
    )

    foreach ($account in $ServiceSid) { Grant-AccucutFolderAccess -Path $Paths.Root -Account $account -Rights ReadAndExecute }
    foreach ($account in $ServiceSid) { Grant-AccucutFolderAccess -Path $Paths.Logs -Account $account -Rights Modify }
}

#endregion

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

#region Backups (STORY-10.05; ADR-015 Amendment 3; architecture section 9.9)

# The local user the weekly task runs as, the task, and the database role that backup.ps1 and clear-copies.ps1 use (never the owner or the app role).
$script:BackupAccountName = 'AccucutBackup'
$script:BackupTaskName = 'Accucut weekly backup'
$script:BackupDatabaseRole = 'accucut_backup'

# 20 % of the volume is always kept free (architecture 9.5, A-36's neighbour): a copy is refused when making it would take the volume below that share.
$script:BackupKeepFreeFraction = 0.20

# The planned size of the next copy is the size of the last good one plus this share. With no earlier copy, the size of the database is used.
$script:BackupGrowthMargin = 0.10

# Pruning and clearing never touch the newest N copies (A-36, about a month), and the weekly rule removes only copies older than this many calendar years.
$script:BackupKeepNewest = 4
$script:BackupRetentionYears = 2

# The only names this module ever creates or deletes in the backups folder (ADR-015 Amendment 3 point 4).
$script:BackupCopyPattern = '^accucut-(\d{8})-(\d{6})-(weekly|release)\.age$'
$script:BackupPartPattern = '^accucut-\d{8}-\d{6}-(weekly|release)\.age\.part$'
$script:BackupStampFormat = 'yyyyMMdd-HHmmss'

# What every age file starts with (the v1 format).
$script:AgeHeader = 'age-encryption.org/v1'

# The Windows Application event log source of the backup scripts (ADR-015 Amendment 3.1 point 5): the install registers it, backup.ps1 writes one event per run.
$script:EventSource = 'Accucut'

# An age public key (X25519), which is all that the server ever holds.
$script:AgeRecipientPattern = '^age1[0-9a-z]{58}$'

# The Task Scheduler result of a logon that the account may not make (0x80070569): the account lacks "Log on as a batch job".
$script:LogonTypeFailure = [uint32]2147943785

# What Task Scheduler reports for a task that has never run (0x41303, 267011). On Stage 13 this was how a missing "Log on as a batch job" showed (ADR-015 Amendment 3.2).
$script:TaskNotStarted = [uint32]267011

# The P/Invoke type of the seven advapi32 calls, made in memory on first use by Get-AccucutLsaNative (nothing is made when the module is loaded).
$script:AccucutLsaNative = $null

function Get-AccucutBackupAccountSid {
    <# The SID of the local user AccucutBackup, looked up by name. Throws a plain message when the account does not exist. #>
    [CmdletBinding()]
    param()

    try {
        $account = [System.Security.Principal.NTAccount]::new([string]$env:COMPUTERNAME, $script:BackupAccountName)
        return $account.Translate([System.Security.Principal.SecurityIdentifier]).Value
    }
    catch {
        throw "The local account '$($script:BackupAccountName)' does not exist on this server, so the backup cannot be checked or run. Call your IT person."
    }
}

function Test-AccucutEventSource {
    <# True when the event source of the backup scripts is registered. A function of its own so that Pester can mock it. #>
    [CmdletBinding()]
    param()

    return [System.Diagnostics.EventLog]::SourceExists($script:EventSource)
}

function New-AccucutEventSource {
    <# Registers the event source in the Application log. Needs an administrator. A function of its own so that Pester can mock it. #>
    [CmdletBinding()]
    param()

    [System.Diagnostics.EventLog]::CreateEventSource($script:EventSource, 'Application')
}

function Register-AccucutEventSource {
    <# The install registers the source 'Accucut' once, as an administrator, so that AccucutBackup (a standard user, which may write to a source that exists) can write its event. Returns $true when it made it. #>
    [CmdletBinding()]
    param()

    if (Test-AccucutEventSource) { return $false }
    New-AccucutEventSource
    return $true
}

function Get-AccucutRandomNumber {
    <# A uniformly random integer from 0 up to, not including, -Maximum, from the operating system's generator (rejection sampling, so every value is equally likely). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][ValidateRange(1, 65536)][int]$Maximum)

    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $buffer = New-Object byte[] 4
        $limit = [int64]([math]::Floor(4294967296 / $Maximum) * $Maximum)
        do {
            $generator.GetBytes($buffer)
            $number = [int64][System.BitConverter]::ToUInt32($buffer, 0)
        } while ($number -ge $limit)
        return [int]($number % $Maximum)
    }
    finally {
        $generator.Dispose()
    }
}

function New-AccucutComplexPassword {
    <# A random password that meets Windows' complexity rule: at least one upper-case letter, one lower-case letter, one digit and one symbol. #>
    [CmdletBinding()]
    param([ValidateRange(16, 128)][int]$Length = 32)

    $sets = @('ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!#$%&*+-=?@^_')
    $all = $sets -join ''
    $chars = New-Object System.Collections.Generic.List[char]
    foreach ($set in $sets) { $chars.Add($set[(Get-AccucutRandomNumber -Maximum $set.Length)]) }
    while ($chars.Count -lt $Length) { $chars.Add($all[(Get-AccucutRandomNumber -Maximum $all.Length)]) }
    # Fisher-Yates, so that the first four characters are not always one of each kind.
    for ($i = $chars.Count - 1; $i -gt 0; $i--) {
        $j = Get-AccucutRandomNumber -Maximum ($i + 1)
        $swap = $chars[$i]; $chars[$i] = $chars[$j]; $chars[$j] = $swap
    }
    return (-join $chars)
}

function Get-AccucutLsaNative {
    <#
    The seven advapi32 calls that the batch-logon right needs (ADR-015 Amendment 3.2), defined in memory with Reflection.Emit the first time they are asked for and kept in
    $script:AccucutLsaNative. There is no compiler and no file here: the usual compiler cmdlet would write and load a DLL from a temporary folder that the trust block never
    checked. Nothing runs when the module is loaded. 64-bit only, because the structure offsets used by the callers assume it. Every method returns an NTSTATUS as uint32.
    #>
    [CmdletBinding()]
    param()

    if ($null -ne $script:AccucutLsaNative) { return $script:AccucutLsaNative }
    if (-not [System.Environment]::Is64BitProcess) { throw 'The batch-logon right can only be set from a 64-bit PowerShell.' }
    $assemblyName = New-Object System.Reflection.AssemblyName('AccucutLsa')
    $assembly = [System.AppDomain]::CurrentDomain.DefineDynamicAssembly($assemblyName, [System.Reflection.Emit.AssemblyBuilderAccess]::Run)
    $module = $assembly.DefineDynamicModule('AccucutLsa')
    $type = $module.DefineType('AccucutLsa.Native', [System.Reflection.TypeAttributes]'Public, Sealed, Abstract')
    $pointer = [System.IntPtr]
    $bytes = [byte[]]
    $number = [uint32]
    $methods = @(
        @{ Name = 'LsaOpenPolicy'; Types = @($pointer, $bytes, $number, $pointer.MakeByRefType()); OutIndex = @(3) },
        @{ Name = 'LsaAddAccountRights'; Types = @($pointer, $bytes, $pointer, $number); OutIndex = @() },
        @{ Name = 'LsaRemoveAccountRights'; Types = @($pointer, $bytes, [byte], $pointer, $number); OutIndex = @() },
        @{ Name = 'LsaEnumerateAccountsWithUserRight'; Types = @($pointer, $pointer, $pointer.MakeByRefType(), $number.MakeByRefType()); OutIndex = @(2, 3) },
        @{ Name = 'LsaFreeMemory'; Types = @($pointer); OutIndex = @() },
        @{ Name = 'LsaClose'; Types = @($pointer); OutIndex = @() },
        @{ Name = 'LsaNtStatusToWinError'; Types = @($number); OutIndex = @() }
    )
    foreach ($method in $methods) {
        $builder = $type.DefinePInvokeMethod($method.Name, 'advapi32.dll', [System.Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [System.Reflection.CallingConventions]::Standard, $number, [System.Type[]]$method.Types, [System.Runtime.InteropServices.CallingConvention]::Winapi, [System.Runtime.InteropServices.CharSet]::Unicode)
        $builder.SetImplementationFlags([System.Reflection.MethodImplAttributes]::PreserveSig)
        for ($index = 0; $index -lt $method.Types.Count; $index++) {
            $attribute = [System.Reflection.ParameterAttributes]::None
            if ($method.OutIndex -contains $index) { $attribute = [System.Reflection.ParameterAttributes]::Out }
            [void]$builder.DefineParameter($index + 1, $attribute, "p$index")
        }
    }
    $script:AccucutLsaNative = $type.CreateType()
    return $script:AccucutLsaNative
}

function New-AccucutLsaString {
    <# An LSA_UNICODE_STRING (16 bytes on x64) in unmanaged memory: Length at 0, MaximumLength at 2, the buffer pointer at 8. Free it with Remove-AccucutLsaString. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Value)

    $buffer = [System.Runtime.InteropServices.Marshal]::StringToHGlobalUni($Value)
    $structure = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(16)
    $length = [int16](2 * $Value.Length)
    [System.Runtime.InteropServices.Marshal]::WriteInt16($structure, 0, $length)
    [System.Runtime.InteropServices.Marshal]::WriteInt16($structure, 2, [int16]($length + 2))
    [System.Runtime.InteropServices.Marshal]::WriteInt32($structure, 4, 0)
    [System.Runtime.InteropServices.Marshal]::WriteIntPtr($structure, 8, $buffer)
    return [pscustomobject]@{ Structure = $structure; Buffer = $buffer }
}

function Remove-AccucutLsaString {
    <# Frees what New-AccucutLsaString allocated. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$LsaString)

    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($LsaString.Buffer)
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($LsaString.Structure)
}

function Assert-AccucutLsaStatus {
    <# Throws a plain error naming the operation when an LSA call did not return 0. -Allowed lists the NTSTATUS values that are not errors for that call. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][uint32]$Status,
        [Parameter(Mandatory)][string]$Operation,
        [uint32[]]$Allowed = @()
    )

    if ($Status -eq 0 -or $Allowed -contains $Status) { return }
    $native = Get-AccucutLsaNative
    $winError = [int]$native::LsaNtStatusToWinError($Status)
    $reason = (New-Object System.ComponentModel.Win32Exception($winError)).Message
    throw "The local security policy refused $Operation (status 0x$('{0:X8}' -f $Status): $reason)."
}

function Open-AccucutLsaPolicy {
    <# Opens the local policy with the three rights that are needed (view local information, create account, look up names: 0x811), never all access. Close it with Close-AccucutLsaPolicy. #>
    [CmdletBinding()]
    param()

    $native = Get-AccucutLsaNative
    $attributes = New-Object byte[] 48
    $attributes[0] = 48
    $handle = [System.IntPtr]::Zero
    $status = $native::LsaOpenPolicy([System.IntPtr]::Zero, $attributes, [uint32]0x811, [ref]$handle)
    Assert-AccucutLsaStatus -Status $status -Operation 'opening the policy'
    return $handle
}

function Close-AccucutLsaPolicy {
    <# Closes the handle that Open-AccucutLsaPolicy returned. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][System.IntPtr]$Handle)

    $native = Get-AccucutLsaNative
    [void]$native::LsaClose($Handle)
}

function Get-AccucutSidBytes {
    <# The binary form of a SID given as text. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Sid)

    $object = [System.Security.Principal.SecurityIdentifier]::new($Sid)
    $bytes = New-Object byte[] $object.BinaryLength
    $object.GetBinaryForm($bytes, 0)
    return , $bytes
}

function Get-AccucutLsaHolder {
    <# The SIDs that hold one right, as text, sorted (LsaEnumerateAccountsWithUserRight). Read-only. No holder (STATUS_NO_MORE_ENTRIES, 0x8000001A) is an empty list. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Right)

    $native = Get-AccucutLsaNative
    $handle = Open-AccucutLsaPolicy
    $name = New-AccucutLsaString -Value $Right
    $buffer = [System.IntPtr]::Zero
    [uint32]$count = 0
    try {
        $status = $native::LsaEnumerateAccountsWithUserRight($handle, $name.Structure, [ref]$buffer, [ref]$count)
        Assert-AccucutLsaStatus -Status $status -Operation "listing the holders of $Right" -Allowed @([uint32]2147483674)
        $holders = New-Object System.Collections.Generic.List[string]
        if ($status -eq 0) {
            for ($index = 0; $index -lt $count; $index++) {
                $sidPointer = [System.Runtime.InteropServices.Marshal]::ReadIntPtr($buffer, $index * 8)
                $holders.Add(([System.Security.Principal.SecurityIdentifier]::new($sidPointer)).Value)
            }
        }
        return @($holders | Sort-Object)
    }
    finally {
        if ($buffer -ne [System.IntPtr]::Zero) { [void]$native::LsaFreeMemory($buffer) }
        Remove-AccucutLsaString -LsaString $name
        Close-AccucutLsaPolicy -Handle $handle
    }
}

function Add-AccucutLsaHolder {
    <# LsaAddAccountRights for one SID and one right. Only Grant-AccucutBatchLogonRight calls it. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Sid,
        [Parameter(Mandatory)][string]$Right
    )

    $native = Get-AccucutLsaNative
    $handle = Open-AccucutLsaPolicy
    $name = New-AccucutLsaString -Value $Right
    try {
        $status = $native::LsaAddAccountRights($handle, (Get-AccucutSidBytes -Sid $Sid), $name.Structure, [uint32]1)
        Assert-AccucutLsaStatus -Status $status -Operation "giving $Right"
    }
    finally {
        Remove-AccucutLsaString -LsaString $name
        Close-AccucutLsaPolicy -Handle $handle
    }
}

function Remove-AccucutLsaHolder {
    <# LsaRemoveAccountRights for one SID and one right, with allRights ALWAYS 0 (never every right of the account). STATUS_OBJECT_NAME_NOT_FOUND (0xC0000034) means it was already gone. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Sid,
        [Parameter(Mandatory)][string]$Right
    )

    $native = Get-AccucutLsaNative
    $handle = Open-AccucutLsaPolicy
    $name = New-AccucutLsaString -Value $Right
    try {
        $status = $native::LsaRemoveAccountRights($handle, (Get-AccucutSidBytes -Sid $Sid), [byte]0, $name.Structure, [uint32]1)
        Assert-AccucutLsaStatus -Status $status -Operation "taking away $Right" -Allowed @([uint32]3221225524)
    }
    finally {
        Remove-AccucutLsaString -LsaString $name
        Close-AccucutLsaPolicy -Handle $handle
    }
}

function Get-AccucutRightHolder {
    <# The SIDs that hold "Log on as a batch job" or "Deny log on as a batch job", sorted. Read-only (ADR-015 Amendment 3.2). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][ValidateSet('SeBatchLogonRight', 'SeDenyBatchLogonRight')][string]$Right)

    return @(Get-AccucutLsaHolder -Right $Right)
}

function Test-AccucutSameSidSet {
    <# True when two lists of SIDs hold the same SIDs (as sets, upper case). #>
    [CmdletBinding()]
    param(
        [AllowEmptyCollection()][string[]]$Left = @(),
        [AllowEmptyCollection()][string[]]$Right = @()
    )

    $a = @($Left | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object -Unique)
    $b = @($Right | ForEach-Object { $_.ToUpperInvariant() } | Sort-Object -Unique)
    return (($a -join ';') -eq ($b -join ';'))
}

function Grant-AccucutBatchLogonRight {
    <#
    Gives "Log on as a batch job" to one SID and to nothing else (ADR-015 Amendment 3.2). There is no -Right parameter: this module can grant this one right and no other.
    It reads the holders first and refuses if the SID is among them already; it adds the SID with LsaAddAccountRights; it reads the holders again and requires them to be
    exactly the holders before plus the SID. Anything else throws.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Sid,
        [string]$LogFile
    )

    $right = 'SeBatchLogonRight'
    $before = @(Get-AccucutRightHolder -Right $right)
    if ($before -contains $Sid) { throw "$Sid already holds 'Log on as a batch job'. A new account cannot, so this is not the account that was just made. Nothing was changed." }
    Add-AccucutLsaHolder -Sid $Sid -Right $right
    $after = @(Get-AccucutRightHolder -Right $right)
    if (-not (Test-AccucutSameSidSet -Left $after -Right (@($before) + @($Sid)))) {
        throw "Log on as a batch job did not take the expected holders (before: $($before -join ', '); after: $($after -join ', '))."
    }
    Write-AccucutLog -Message "Gave $($script:BackupAccountName) ($Sid) the right 'Log on as a batch job'; no other account or right was changed." -LogFile $LogFile
}

function Revoke-AccucutBatchLogonRight {
    <# Takes "Log on as a batch job" away from one SID, and from no one else, never all rights of the account. The holders afterwards must be the holders before minus the SID. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Sid,
        [string]$LogFile
    )

    $right = 'SeBatchLogonRight'
    $before = @(Get-AccucutRightHolder -Right $right)
    if ($before -notcontains $Sid) { return }
    Remove-AccucutLsaHolder -Sid $Sid -Right $right
    $after = @(Get-AccucutRightHolder -Right $right)
    if (-not (Test-AccucutSameSidSet -Left $after -Right @($before | Where-Object { $_ -ne $Sid }))) {
        throw "Taking away 'Log on as a batch job' did not leave the expected holders (before: $($before -join ', '); after: $($after -join ', '))."
    }
    Write-AccucutLog -Message "Took the right 'Log on as a batch job' away from $Sid; no other holder was changed." -LogFile $LogFile
}

function Get-AccucutComputerSystem {
    <# Whether the server is in a domain, and its name. A function of its own so that Pester can mock it. #>
    [CmdletBinding()]
    param()

    return (Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop)
}

function Get-AccucutRsopBatchRight {
    <# The Group Policy result for "Log on as a batch job" with precedence 1, if any domain policy sets it. A function of its own so that Pester can mock it. Throws when the result cannot be read. #>
    [CmdletBinding()]
    param()

    return @(Get-CimInstance -Namespace 'root\rsop\computer' -ClassName RSOP_UserPrivilegeRight -Filter "UserRight='SeBatchLogonRight' AND precedence=1" -ErrorAction Stop)
}

function Get-AccucutRsopPolicyName {
    <# The display name of the Group Policy object with this id (RSOP_GPO), or the id itself. A function of its own so that Pester can mock it. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$PolicyId)

    try {
        $escaped = $PolicyId.Replace("'", "''")
        $policy = @(Get-CimInstance -Namespace 'root\rsop\computer' -ClassName RSOP_GPO -Filter "id='$escaped'" -ErrorAction Stop)
        if ($policy.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$policy[0].name)) { return [string]$policy[0].name }
    }
    catch { Write-Verbose "The policy name could not be read: $($_.Exception.Message)" }
    return $PolicyId
}

function Test-AccucutBatchRightPolicy {
    <#
    The read-only check that comes before anything is changed (ADR-015 Amendment 3.2, mechanism step 7). Throws, with nothing changed, when:
      - "Deny log on as a batch job" holds Everyone, Authenticated Users, Local account or Users (the groups in the token of a new local user), because deny wins over grant;
      - the server is in a domain and a Group Policy sets "Log on as a batch job" without AccucutBackup, because the policy would remove a local grant at its next refresh;
      - the server is in a domain and the policy result cannot be read, unless -PolicyConfirmed says that IT has checked by hand (that skips only this read).
    #>
    [CmdletBinding()]
    param(
        [switch]$PolicyConfirmed,
        [string]$LogFile
    )

    $groups = @('S-1-1-0', 'S-1-5-11', 'S-1-5-113', 'S-1-5-32-545')
    $denied = @(@(Get-AccucutRightHolder -Right 'SeDenyBatchLogonRight') | Where-Object { $groups -contains $_ })
    if ($denied.Count -gt 0) {
        throw "'Deny log on as a batch job' lists $($denied -join ', '), which every new local account belongs to, and a deny wins over a grant. The weekly backup could never log on. Ask your IT person or the domain administrator to take those entries out of 'Deny log on as a batch job', then run the install again. Nothing was changed."
    }
    $computer = Get-AccucutComputerSystem
    if (-not [bool]$computer.PartOfDomain) { return }
    if ($PolicyConfirmed) {
        Write-AccucutLog -Message "-BatchRightPolicyConfirmed was given: the Group Policy result for 'Log on as a batch job' was NOT read; you have confirmed that no policy sets the right, or that it lists $($env:COMPUTERNAME)\$($script:BackupAccountName)." -Level Warning -LogFile $LogFile
        return
    }
    try { $rights = @(Get-AccucutRsopBatchRight) }
    catch { throw "This server is in a domain and its Group Policy results cannot be read ($($_.Exception.Message)), so it is not known whether a policy sets 'Log on as a batch job'. Check by hand that no policy sets it, or that it lists $($env:COMPUTERNAME)\$($script:BackupAccountName), and run the install again with -BatchRightPolicyConfirmed. Nothing was changed." }
    if ($rights.Count -eq 0) { return }
    $listed = @($rights | ForEach-Object { @($_.AccountList) } | ForEach-Object { [string]$_ })
    if ($listed -contains $script:BackupAccountName -or $listed -contains "$($env:COMPUTERNAME)\$($script:BackupAccountName)") { return }
    $policyName = Get-AccucutRsopPolicyName -PolicyId ([string]$rights[0].GPOID)
    throw "This server is in a domain and the Group Policy '$policyName' sets 'Log on as a batch job'. A right given here would be removed at the next policy refresh, and the weekly backup would stop. Ask the domain administrator to add $($env:COMPUTERNAME)\$($script:BackupAccountName) to that setting in that policy, keeping the accounts already there, or to take this server out of that setting. Then run 'gpupdate /target:computer /force' on this server and run the install again. Nothing was changed."
}

function Register-AccucutBackupTask {
    <#
    Makes the local user AccucutBackup and the weekly task that runs backup.ps1 as that user (ADR-015 Amendment 3 point 2).
    The password is made here, in memory: 32 random characters with upper case, lower case, a digit and a symbol. It is registered for redaction, given as a
    SecureString to the cmdlet that makes the user and as an in-process string to the cmdlet that registers the task, and then cleared. It is never on a command line, in a file or in a
    log, and Task Scheduler (LSA) is the only place that keeps it. The account is a member of no group and has no password expiry, and it is for the task only.
    Returns the account's SID. If the task cannot be registered, the account made here is removed again.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string]$PowerShellPath,
        [string]$LogFile
    )

    # The program of the task action is given by the caller, which has checked it (Resolve-AccucutTrustedExecutable): it is never looked up here.
    if (-not [System.IO.Path]::IsPathRooted($PowerShellPath) -or $PowerShellPath.StartsWith('\\') -or -not [System.IO.File]::Exists($PowerShellPath)) { throw "'$PowerShellPath' is not the full path of a program that exists." }
    $password = New-AccucutComplexPassword -Length 32
    Register-AccucutSecret -Value $password
    $secure = [System.Security.SecureString]::new()
    foreach ($char in $password.ToCharArray()) { $secure.AppendChar($char) }
    $secure.MakeReadOnly()
    $created = $false
    try {
        $user = New-LocalUser -Name $script:BackupAccountName -Password $secure -PasswordNeverExpires -UserMayNotChangePassword -AccountNeverExpires -Description 'Accucut weekly backup (no interactive use)' -ErrorAction Stop
        $created = $true
        # A new local user has no right to log on as a batch job, and Task Scheduler does not give it one when it stores the password: the right is given here to this SID alone,
        # and checked, before the task is made (ADR-015 Amendment 3.2). If it fails, the catch below removes the user again and no task exists.
        Grant-AccucutBatchLogonRight -Sid $user.SID.Value -LogFile $LogFile
        $scriptPath = [System.IO.Path]::Combine($Paths.Current, 'backup.ps1')
        $action = New-ScheduledTaskAction -Execute $PowerShellPath -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $scriptPath + '" -Reason weekly')
        # Sunday 02:00 on the server's clock: the server is expected to keep India Standard Time (the caller warns when it does not).
        $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '02:00'
        $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 6)
        [void](Register-ScheduledTask -TaskName $script:BackupTaskName -Action $action -Trigger $trigger -Settings $settings -User "$($env:COMPUTERNAME)\$($script:BackupAccountName)" -Password $password -RunLevel Limited -Description 'Weekly encrypted backup of the Accucut database (STORY-10.05).' -ErrorAction Stop)
        return $user.SID.Value
    }
    catch {
        if ($created) { Remove-AccucutBackupAccount }
        throw
    }
    finally {
        $password = $null
        $secure.Dispose()
    }
}

function Remove-AccucutBackupAccount {
    <#
    Removes the weekly task, the right "Log on as a batch job" that was given to the account, and the local user AccucutBackup, in that order, when they exist (ADR-015
    Amendment 3.2). The right goes BEFORE the user: deleting the user first would leave a bare SID in the policy. A failure to take the right away is logged as an error and
    the user is still removed; the message tells IT to remove the bare SID in Local Security Policy.
    #>
    [CmdletBinding()]
    param([string]$LogFile)

    try { Unregister-ScheduledTask -TaskName $script:BackupTaskName -Confirm:$false -ErrorAction Stop } catch { Write-Verbose "No weekly backup task to remove: $($_.Exception.Message)" }
    $sid = $null
    try { $sid = Get-AccucutBackupAccountSid } catch { Write-Verbose "No backup account, so no right to take away: $($_.Exception.Message)" }
    if ($null -ne $sid) {
        try { Revoke-AccucutBatchLogonRight -Sid $sid -LogFile $LogFile }
        catch { Write-AccucutLog -Message "The right 'Log on as a batch job' could not be taken away from $($script:BackupAccountName) ($sid): $($_.Exception.Message) The user is removed anyway; remove the bare SID $sid in Local Security Policy, User Rights Assignment, Log on as a batch job." -Level Error -LogFile $LogFile }
    }
    try { Remove-LocalUser -Name $script:BackupAccountName -ErrorAction Stop } catch { Write-Verbose "No backup account to remove: $($_.Exception.Message)" }
}

function Wait-AccucutBackupTask {
    <#
    Starts the weekly task once and waits for it to finish (the install's proof that the account can log on and that the first backup works).
    Returns the task's LastTaskResult as an unsigned number (0 is success), or throws when it has not finished in -TimeoutSeconds. A task that is still Ready with an unchanged
    LastRunTime after -NotStartedAfterSeconds has not started: that returns 0x41303 (267011), which the caller treats as a refused logon (ADR-015 Amendment 3.2).
    #>
    [CmdletBinding()]
    param(
        [ValidateRange(5, 1800)][int]$TimeoutSeconds = 300,
        [ValidateRange(1, 30)][int]$IntervalSeconds = 3,
        [ValidateRange(5, 600)][int]$NotStartedAfterSeconds = 60
    )

    $before = (Get-Date).AddSeconds(-2)
    $startedAt = Get-Date
    Start-ScheduledTask -TaskName $script:BackupTaskName -ErrorAction Stop
    $deadline = $startedAt.AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $IntervalSeconds
        $info = Get-ScheduledTaskInfo -TaskName $script:BackupTaskName -ErrorAction Stop
        $task = Get-ScheduledTask -TaskName $script:BackupTaskName -ErrorAction Stop
        if ($info.LastRunTime -ge $before -and [string]$task.State -ne 'Running') { return [uint32]$info.LastTaskResult }
        if ($info.LastRunTime -lt $before -and [string]$task.State -eq 'Ready' -and ((Get-Date) - $startedAt).TotalSeconds -ge $NotStartedAfterSeconds) { return $script:TaskNotStarted }
    }
    throw "The weekly backup task did not finish within $TimeoutSeconds seconds."
}

function Test-AccucutLogonTypeFailure {
    <# True when a task result says the account could not log on: 0x80070569 (refused logon type), or 0x41303 (the task never started, which is how the same refusal showed on the runner). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][uint32]$TaskResult)

    return ($TaskResult -eq $script:LogonTypeFailure -or $TaskResult -eq $script:TaskNotStarted)
}

function Grant-AccucutBackupRootAccess {
    <# Read and execute (0x1200A9, inherited) for the backup account on the install root, so that the trust checks in backup.ps1 can read the descriptor of every folder down to the script, the module and the programs (Amendment 3 point 2). The fifth entry of the root. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string]$BackupSid
    )

    Grant-AccucutFolderAccess -Path $Paths.Root -Account $BackupSid -Rights ReadAndExecute
}

function New-AccucutBackupFolder {
    <#
    Creates the backups folder with its security in one call (ADR-015 Amendment 3 point 4): owner Administrators, no inheritance, exactly Administrators and SYSTEM
    with full control (0x1F01FF) and the backup account with Modify (0x1301BF), all inherited by what the folder holds. No entry for the services. The folder must
    not exist. The result is read back and compared exactly; a folder that differs is refused and left as it is.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$BackupSid
    )

    if ([System.IO.Directory]::Exists($Path) -or [System.IO.File]::Exists($Path)) { throw "'$Path' already exists. The backups folder is only ever made by the install." }
    $administrators = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)
    $system = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
    $backup = [System.Security.Principal.SecurityIdentifier]::new($BackupSid)
    $security = [System.Security.AccessControl.DirectorySecurity]::new()
    $security.SetOwner($administrators)
    $security.SetAccessRuleProtection($true, $false)
    $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    $none = [System.Security.AccessControl.PropagationFlags]::None
    $allow = [System.Security.AccessControl.AccessControlType]::Allow
    foreach ($sid in @($administrators, $system)) {
        $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, [System.Security.AccessControl.FileSystemRights]::FullControl, $inherit, $none, $allow))
    }
    $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($backup, [System.Security.AccessControl.FileSystemRights]::Modify, $inherit, $none, $allow))
    [void][System.IO.Directory]::CreateDirectory($Path, $security)

    $actual = [System.IO.Directory]::GetAccessControl($Path)
    $rules = @($actual.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { '{0}|0x{1:X}|{2}|{3}' -f $_.IdentityReference.Value, [int]$_.FileSystemRights, $_.IsInherited, [int]$_.InheritanceFlags } | Sort-Object)
    $expected = @("S-1-5-32-544|0x1F01FF|False|3", "S-1-5-18|0x1F01FF|False|3", "$BackupSid|0x1301BF|False|3") | Sort-Object
    $owner = $actual.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
    if (-not $actual.AreAccessRulesProtected -or $owner -ne 'S-1-5-32-544' -or ($rules -join "`n") -ne ($expected -join "`n")) {
        throw "'$Path' was not created as expected (owner, protection and the three entries are checked exactly). It is not used."
    }
}

function Set-AccucutBackupFileAcl {
    <# A file readable by the backup account and no one else except Administrators and SYSTEM (full control): protected, owner Administrators, exactly three entries (Amendment 3 points 3 and 5). #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$BackupSid
    )

    $administrators = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)
    $system = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
    $security = [System.Security.AccessControl.FileSecurity]::new()
    $security.SetOwner($administrators)
    $security.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($administrators, $system)) {
        $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, [System.Security.AccessControl.FileSystemRights]::FullControl, [System.Security.AccessControl.AccessControlType]::Allow))
    }
    $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($BackupSid), [System.Security.AccessControl.FileSystemRights]::Read, [System.Security.AccessControl.AccessControlType]::Allow))
    [System.IO.File]::SetAccessControl($Path, $security)
}

function Write-AccucutBackupFile {
    <# Creates a file with FileMode.CreateNew (never over an existing one), locks it with Set-AccucutBackupFileAcl while it is still empty, and only then writes the content. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Content,
        [Parameter(Mandatory)][string]$BackupSid
    )

    $stream = [System.IO.FileStream]::new($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $stream.Dispose()
    Set-AccucutBackupFileAcl -Path $Path -BackupSid $BackupSid
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Test-AccucutBackupSetting {
    <# Checks one backup setting against the pattern it must have. Anything else is refused: the values end up on a command line and in a file. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string]$Name,
        [AllowNull()]$Value
    )

    switch ($Name) {
        'ageRecipient' { return ($Value -is [string] -and $Value -match $script:AgeRecipientPattern) }
        'pgHost' { return ($Value -is [string] -and $Value -match '^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$') }
        'pgPort' { return (($Value -is [int] -or $Value -is [long]) -and $Value -ge 1 -and $Value -le 65535) }
        'database' { return ($Value -is [string] -and $Value -match '^[a-z_][a-z0-9_]{0,62}$') }
        'pgBinDirectory' { return ($Value -is [string] -and $Value -match '^[A-Za-z]:\\[^"&|<>^%\r\n]{1,240}$' -and $Value -notmatch '\.\.') }
        default { return $false }
    }
}

function Read-AccucutBackupSettings {
    <# Reads backup-settings.json (ageRecipient, pgHost, pgPort, database, pgBinDirectory) and refuses a file with a missing, extra or malformed field. The file has been trust-checked by the caller. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $length = ([System.IO.FileInfo]::new($Path)).Length
    if ($length -gt 16384) { throw "The backup settings file is too large ($length bytes)." }
    $json = [System.IO.File]::ReadAllText($Path) | ConvertFrom-Json
    $names = @('ageRecipient', 'pgHost', 'pgPort', 'database', 'pgBinDirectory')
    $present = @($json.PSObject.Properties.Name)
    foreach ($name in $names) {
        if ($present -notcontains $name) { throw "The backup settings file has no '$name'." }
        if (-not (Test-AccucutBackupSetting -Name $name -Value $json.$name)) { throw "The backup settings file has a value for '$name' that is not allowed." }
    }
    foreach ($name in $present) { if ($names -notcontains $name) { throw "The backup settings file has a field '$name' that is not known." } }
    return [pscustomobject]@{ AgeRecipient = [string]$json.ageRecipient; PgHost = [string]$json.pgHost; PgPort = [int]$json.pgPort; Database = [string]$json.database; PgBinDirectory = [string]$json.pgBinDirectory }
}

function Write-AccucutBackupConfig {
    <#
    Writes the two files that only the backup account (and Administrators) can read (ADR-015 Amendment 3 points 3 and 5):
      config\backup.pgpass          the accucut_backup role's connection line, PGPASSFILE format. The one place its password is kept.
      config\backup-settings.json   the age PUBLIC key, the database address and the folder of pg_dump. No secret.
    Each has a protected list: owner Administrators, exactly Administrators and SYSTEM full control and the backup account read.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string]$BackupSid,
        [Parameter(Mandatory)][string]$BackupPassword,
        [Parameter(Mandatory)][string]$AgeRecipient,
        [Parameter(Mandatory)][string]$PgHost,
        [Parameter(Mandatory)][int]$PgPort,
        [Parameter(Mandatory)][string]$Database,
        [Parameter(Mandatory)][string]$PgBinDirectory
    )

    foreach ($pair in @(@('ageRecipient', $AgeRecipient), @('pgHost', $PgHost), @('pgPort', $PgPort), @('database', $Database), @('pgBinDirectory', $PgBinDirectory))) {
        if (-not (Test-AccucutBackupSetting -Name $pair[0] -Value $pair[1])) { throw "The value for '$($pair[0])' is not allowed in the backup settings." }
    }
    Register-AccucutSecret -Value $BackupPassword
    # PGPASSFILE format: host:port:database:user:password, with a backslash or a colon in the password escaped by a backslash.
    $escaped = $BackupPassword.Replace('\', '\\').Replace(':', '\:')
    $line = '{0}:{1}:{2}:{3}:{4}' -f $PgHost, $PgPort, $Database, $script:BackupDatabaseRole, $escaped
    Write-AccucutBackupFile -Path $Paths.BackupPgpass -Content ($line + "`r`n") -BackupSid $BackupSid
    $settings = [ordered]@{ ageRecipient = $AgeRecipient; pgHost = $PgHost; pgPort = $PgPort; database = $Database; pgBinDirectory = $PgBinDirectory }
    Write-AccucutBackupFile -Path $Paths.BackupSettings -Content (($settings | ConvertTo-Json) + "`r`n") -BackupSid $BackupSid
}

function Get-AccucutVolumeRoot {
    <# The drive root of a full local path as X:/ (a forward slash, as .env needs), or $null when the path is not a full local drive path. #>
    [CmdletBinding()]
    param([AllowNull()][AllowEmptyString()][string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path) -or $Path -notmatch '^[A-Za-z]:\\') { return $null }
    return $Path.Substring(0, 2) + '/'
}

function Get-AccucutVolumeSpace {
    <# Total and free bytes of the volume that holds -Path (the free space available to the caller). A function of its own so that Pester can mock it. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $drive = [System.IO.DriveInfo]::new([System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($Path)))
    return [pscustomobject]@{ TotalBytes = [int64]$drive.TotalSize; FreeBytes = [int64]$drive.AvailableFreeSpace }
}

function Format-AccucutSize {
    <# A size in bytes in words an Admin reads: 12.3 GB, 456 MB, 7 KB. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][int64]$Bytes)

    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    if ($Bytes -ge 1GB) { return ([math]::Round($Bytes / 1GB, 2)).ToString('0.00', $inv) + ' GB' }
    if ($Bytes -ge 1MB) { return ([math]::Round($Bytes / 1MB, 1)).ToString('0.0', $inv) + ' MB' }
    return ([math]::Ceiling($Bytes / 1KB)).ToString($inv) + ' KB'
}

function Test-AccucutBackupRoom {
    <#
    The free-space check that comes first (AC-2): a copy is made only if, after it, at least 20 % of the volume is still free. The planned size is the last good
    copy plus a margin of 10 %, or the size of the database when there is no copy yet. Returns Ok, the numbers and a plain message. It never deletes anything.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][int64]$FreeBytes,
        [Parameter(Mandatory)][int64]$TotalBytes,
        [Parameter(Mandatory)][int64]$LastCopyBytes,
        [Parameter(Mandatory)][int64]$DatabaseBytes
    )

    $basis = $LastCopyBytes
    if ($basis -le 0) { $basis = $DatabaseBytes }
    $planned = [int64][math]::Ceiling($basis * (1 + $script:BackupGrowthMargin))
    $after = $FreeBytes - $planned
    $minimum = [int64][math]::Ceiling($TotalBytes * $script:BackupKeepFreeFraction)
    $ok = ($TotalBytes -gt 0 -and $after -ge $minimum)
    $message = ''
    if (-not $ok) {
        $message = "Not enough free disk space for another copy: $(Format-AccucutSize -Bytes $FreeBytes) is free, the copy needs about $(Format-AccucutSize -Bytes $planned), and 20 % of the disk ($(Format-AccucutSize -Bytes $minimum)) must stay free. No copy was made and nothing was deleted. Clear old copies with Clear-AccucutCopies, or ask your IT person for a bigger disk."
    }
    return [pscustomobject]@{ Ok = $ok; FreeBytes = $FreeBytes; TotalBytes = $TotalBytes; PlannedBytes = $planned; MinimumFreeBytes = $minimum; Message = $message }
}

function ConvertFrom-AccucutBackupStamp {
    <# The UTC time in a copy's name (yyyyMMdd-HHmmss), or $null when the text is not one. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Text)

    $parsed = [datetime]::MinValue
    if ([datetime]::TryParseExact($Text, $script:BackupStampFormat, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal, [ref]$parsed)) { return $parsed }
    return $null
}

function Get-AccucutBackupCopy {
    <#
    The copies in the backups folder, oldest first. Looks only at the files directly in the folder (no recursion) and never follows a link. A copy is
    a regular file named accucut-<yyyyMMdd-HHmmss>-<weekly|release>.age, and it is Verified only when its manifest (accucut-<stamp>-<reason>.manifest.json)
    is a regular file whose file name, reason, time and size match, and whose SHA-256 is well formed. Only a Verified copy is ever deleted.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Directory)

    $copies = New-Object System.Collections.Generic.List[object]
    if (-not [System.IO.Directory]::Exists($Directory)) { return @() }
    foreach ($file in [System.IO.Directory]::GetFiles($Directory)) {
        $name = [System.IO.Path]::GetFileName($file)
        if ($name -notmatch $script:BackupCopyPattern) { continue }
        $stamp = "$($Matches[1])-$($Matches[2])"
        $reason = $Matches[3]
        $created = ConvertFrom-AccucutBackupStamp -Text $stamp
        $attributes = [System.IO.File]::GetAttributes($file)
        if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or ($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) { continue }
        $size = ([System.IO.FileInfo]::new($file)).Length
        $manifestPath = [System.IO.Path]::Combine($Directory, "accucut-$stamp-$reason.manifest.json")
        $problem = $null
        if ($null -eq $created) { $problem = 'the time in the name is not valid' }
        elseif (-not [System.IO.File]::Exists($manifestPath)) { $problem = 'it has no manifest' }
        else {
            $manifestAttributes = [System.IO.File]::GetAttributes($manifestPath)
            if (($manifestAttributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { $problem = 'its manifest is a link' }
            elseif (([System.IO.FileInfo]::new($manifestPath)).Length -gt 16384) { $problem = 'its manifest is too large' }
            else {
                try {
                    $manifest = [System.IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
                    $names = @($manifest.PSObject.Properties.Name)
                    foreach ($required in 'file', 'reason', 'createdAtUtc', 'sizeBytes', 'sha256') { if ($names -notcontains $required) { throw "no $required" } }
                    $manifestStamp = ([datetime]::Parse([string]$manifest.createdAtUtc, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)).ToString($script:BackupStampFormat, [System.Globalization.CultureInfo]::InvariantCulture)
                    if ([string]$manifest.file -ne $name) { $problem = 'its manifest names another file' }
                    elseif ([string]$manifest.reason -ne $reason) { $problem = 'its manifest has another reason' }
                    elseif ($manifestStamp -ne $stamp) { $problem = 'its manifest has another time' }
                    elseif ([int64]$manifest.sizeBytes -ne $size) { $problem = 'its size is not the size in its manifest' }
                    elseif ([string]$manifest.sha256 -notmatch '^[0-9a-f]{64}$') { $problem = 'its manifest has no valid SHA-256' }
                }
                catch { $problem = 'its manifest cannot be read' }
            }
        }
        $copies.Add([pscustomobject]@{
                Name         = $name
                Path         = $file
                ManifestPath = $manifestPath
                CreatedUtc   = $created
                Reason       = $reason
                SizeBytes    = [int64]$size
                Verified     = ($null -eq $problem)
                Problem      = $problem
            })
    }
    return @($copies | Sort-Object -Property @{ Expression = { if ($null -eq $_.CreatedUtc) { [datetime]::MinValue } else { $_.CreatedUtc } } }, Name)
}

function Get-AccucutBackupKeepSet {
    <# The newest copies that are never removed (A-36): the names of the newest -Count of all copies in the folder, verified or not. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][object[]]$Copy,
        [int]$Count = 4
    )

    $newest = @($Copy | Sort-Object -Property @{ Expression = { if ($null -eq $_.CreatedUtc) { [datetime]::MinValue } else { $_.CreatedUtc } } }, Name -Descending | Select-Object -First $Count)
    return @($newest | ForEach-Object { $_.Name })
}

function Get-AccucutBackupPruneCandidate {
    <# The copies the weekly rule may remove: Verified, older than 2 calendar years, and not one of the newest 4. Oldest first. A newer copy is never a candidate. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][object[]]$Copy,
        [datetime]$NowUtc = [datetime]::UtcNow
    )

    $keep = Get-AccucutBackupKeepSet -Copy $Copy -Count $script:BackupKeepNewest
    $limit = $NowUtc.ToUniversalTime().AddYears(-$script:BackupRetentionYears)
    return @($Copy | Where-Object { $_.Verified -and ($keep -notcontains $_.Name) -and $_.CreatedUtc -lt $limit })
}

function Remove-AccucutBackupCopy {
    <#
    Deletes one copy and its manifest, only after proving again, just before, that they are its own: the name matches the pattern, both are regular files
    directly in -Directory (no link), and the manifest agrees with the copy. The copy goes first, then the manifest, so a stop in between leaves a manifest
    without a copy (harmless) and never a copy without a manifest. Returns the bytes freed.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Directory,
        [Parameter(Mandatory)][string]$Name
    )

    if ($Name -notmatch $script:BackupCopyPattern) { throw "'$Name' is not the name of a copy made by the backup. Nothing was deleted." }
    $current = @(Get-AccucutBackupCopy -Directory $Directory | Where-Object { $_.Name -eq $Name })
    if ($current.Count -ne 1 -or -not $current[0].Verified) {
        $why = 'it is not a regular file here'
        if ($current.Count -eq 1) { $why = $current[0].Problem }
        throw "'$Name' was not deleted: $why."
    }
    $copy = $current[0]
    $freed = $copy.SizeBytes + ([System.IO.FileInfo]::new($copy.ManifestPath)).Length
    [System.IO.File]::Delete($copy.Path)
    [System.IO.File]::Delete($copy.ManifestPath)
    return [int64]$freed
}

function Remove-AccucutStaleBackupPart {
    <# Deletes unfinished temporary copies (accucut-...age.part, regular files, directly in the folder) that no run has touched for -OlderThanHours. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Directory,
        [datetime]$NowUtc = [datetime]::UtcNow,
        [int]$OlderThanHours = 24
    )

    if (-not [System.IO.Directory]::Exists($Directory)) { return 0 }
    $removed = 0
    foreach ($file in [System.IO.Directory]::GetFiles($Directory)) {
        if ([System.IO.Path]::GetFileName($file) -notmatch $script:BackupPartPattern) { continue }
        $attributes = [System.IO.File]::GetAttributes($file)
        if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or ($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) { continue }
        if ([System.IO.File]::GetLastWriteTimeUtc($file) -lt $NowUtc.AddHours(-$OlderThanHours)) {
            [System.IO.File]::Delete($file)
            $removed++
        }
    }
    return $removed
}

function ConvertTo-AccucutShortMessage {
    <# A program's message on one line: control characters become spaces, and it is cut at 300 characters. Registered secrets are blanked first. #>
    [CmdletBinding()]
    param([AllowNull()][AllowEmptyString()][string]$Text)

    if ([string]::IsNullOrEmpty($Text)) { return '' }
    $clean = ((Hide-AccucutSecrets -Text $Text) -replace '[\x00-\x1F]', ' ').Trim()
    if ($clean.Length -gt 300) { $clean = $clean.Substring(0, 300) }
    return $clean
}

function Invoke-AccucutBackupPipe {
    <#
    pg_dump -Fc | age -r <recipient> > <OutputPath>, as bytes. Nothing goes through a PowerShell pipeline (which would turn the bytes into text) and nothing through
    cmd.exe: both programs are started here with redirected streams, the dump is copied to age's standard input, and age's standard output is copied to a file made
    with FileMode.CreateNew. Both exit codes are checked (a pipe in cmd.exe reports only the last program's code, so a failed pg_dump would look like a good copy).
    The password reaches pg_dump through PGPASSFILE in that child's environment only; the recipient is a public key and may be on the command line.
    Returns the size of the file written. On any failure the output file is left for the caller to delete, and the message carries the programs' blanked messages.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PgDumpPath,
        [Parameter(Mandatory)][string]$AgePath,
        [Parameter(Mandatory)][string]$Recipient,
        [Parameter(Mandatory)][string]$DbHost,
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][string]$Database,
        [Parameter(Mandatory)][string]$PassFile,
        [Parameter(Mandatory)][string]$OutputPath
    )

    if ($Recipient -notmatch $script:AgeRecipientPattern) { throw 'The age recipient is not a public key (age1...).' }
    $dumpInfo = New-Object System.Diagnostics.ProcessStartInfo
    $dumpInfo.FileName = $PgDumpPath
    $dumpInfo.Arguments = ConvertTo-AccucutArgumentString -ArgumentList @('--format=custom', '--no-password', '--host', $DbHost, '--port', [string]$Port, '--username', $script:BackupDatabaseRole, '--dbname', $Database)
    $dumpInfo.EnvironmentVariables['PGPASSFILE'] = $PassFile
    $dumpInfo.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '15'
    $ageInfo = New-Object System.Diagnostics.ProcessStartInfo
    $ageInfo.FileName = $AgePath
    $ageInfo.Arguments = ConvertTo-AccucutArgumentString -ArgumentList @('-r', $Recipient)
    foreach ($info in $dumpInfo, $ageInfo) {
        $info.UseShellExecute = $false
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $info.CreateNoWindow = $true
    }
    $ageInfo.RedirectStandardInput = $true

    $output = [System.IO.FileStream]::new($OutputPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $dump = New-Object System.Diagnostics.Process
    $dump.StartInfo = $dumpInfo
    $age = New-Object System.Diagnostics.Process
    $age.StartInfo = $ageInfo
    $dumpStarted = $false
    $ageStarted = $false
    $copyError = $null
    try {
        [void]$age.Start()
        $ageStarted = $true
        [void]$dump.Start()
        $dumpStarted = $true
        $dumpErrorTask = $dump.StandardError.ReadToEndAsync()
        $ageErrorTask = $age.StandardError.ReadToEndAsync()
        $outputTask = $age.StandardOutput.BaseStream.CopyToAsync($output)
        $source = $dump.StandardOutput.BaseStream
        $sink = $age.StandardInput.BaseStream
        try {
            $source.CopyTo($sink)
            $sink.Flush()
        }
        catch {
            $copyError = $_.Exception.Message
            try { $dump.Kill() } catch { Write-Verbose "pg_dump had already ended: $($_.Exception.Message)" }
        }
        finally {
            try { $age.StandardInput.Close() } catch { Write-Verbose "age's input was already closed: $($_.Exception.Message)" }
        }
        $dump.WaitForExit()
        $age.WaitForExit()
        $outputTask.Wait()
        $output.Flush()
        $dumpMessage = Hide-AccucutSecrets -Text $dumpErrorTask.Result
        $ageMessage = Hide-AccucutSecrets -Text $ageErrorTask.Result
        $dumpCode = $dump.ExitCode
        $ageCode = $age.ExitCode
    }
    finally {
        if ($dumpStarted -and -not $dump.HasExited) { try { $dump.Kill() } catch { Write-Verbose "pg_dump could not be stopped: $($_.Exception.Message)" } }
        if ($ageStarted -and -not $age.HasExited) { try { $age.Kill() } catch { Write-Verbose "age could not be stopped: $($_.Exception.Message)" } }
        $output.Dispose()
        $dump.Dispose()
        $age.Dispose()
    }
    if ($dumpCode -ne 0) { throw "pg_dump failed with exit code $dumpCode. $(ConvertTo-AccucutShortMessage -Text $dumpMessage)" }
    if ($ageCode -ne 0) { throw "age failed with exit code $ageCode. $(ConvertTo-AccucutShortMessage -Text $ageMessage)" }
    if ($null -ne $copyError) { throw "The dump could not be passed to age: $copyError" }
    $size = ([System.IO.FileInfo]::new($OutputPath)).Length
    if ($size -le 0) { throw 'The encrypted copy is empty.' }
    # A good copy starts with the age header (ADR-015 Amendment 3.1 point 1); anything else is not an age file and is never kept.
    $expectedHeader = [System.Text.Encoding]::ASCII.GetBytes($script:AgeHeader)
    $found = New-Object byte[] $expectedHeader.Length
    $reader = [System.IO.File]::OpenRead($OutputPath)
    try { $count = $reader.Read($found, 0, $found.Length) } finally { $reader.Dispose() }
    if ($count -ne $expectedHeader.Length -or [System.Text.Encoding]::ASCII.GetString($found) -ne $script:AgeHeader) { throw 'The encrypted copy does not start with the age header, so it is not used.' }
    return [int64]$size
}

function Add-AccucutJobRun {
    <#
    Writes one job_runs row as the accucut_backup role (INSERT is the only right it has on that table). The values reach psql as variables and are quoted by
    psql itself (:'name'), so nothing in them can change the statement; the SQL comes in on standard input. The password comes from PGPASSFILE in the child's
    environment. -Result holds no secret and no path (status, sizes, free space, a short reason).
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][string]$PassFile,
        [Parameter(Mandatory)][string]$DbHost,
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][string]$Database,
        [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z-]{1,31}$')][string]$Job,
        [Parameter(Mandatory)][datetime]$StartedUtc,
        [Parameter(Mandatory)][datetime]$FinishedUtc,
        [Parameter(Mandatory)][hashtable]$Result
    )

    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $json = $Result | ConvertTo-Json -Compress -Depth 4
    $sql = "INSERT INTO job_runs (job, started_at, finished_at, result) VALUES (:'job', :'started'::timestamptz, :'finished'::timestamptz, :'result'::jsonb);"
    $arguments = @(
        '-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1',
        '-v', "job=$Job", '-v', "started=$($StartedUtc.ToUniversalTime().ToString('o', $inv))", '-v', "finished=$($FinishedUtc.ToUniversalTime().ToString('o', $inv))", '-v', "result=$json",
        '--host', $DbHost, '--port', [string]$Port, '--username', $script:BackupDatabaseRole, '--dbname', $Database, '--file', '-'
    )
    [void](Invoke-AccucutNative -FilePath $PsqlPath -ArgumentList $arguments -Environment @{ PGPASSFILE = $PassFile; PGCONNECT_TIMEOUT = '15' } -StdIn $sql)
}

function Get-AccucutDatabaseInfo {
    <# The PostgreSQL server version text and the size of the database in bytes, read as the accucut_backup role. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][string]$PassFile,
        [Parameter(Mandatory)][string]$DbHost,
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][string]$Database
    )

    $arguments = @('-X', '-w', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '--host', $DbHost, '--port', [string]$Port, '--username', $script:BackupDatabaseRole, '--dbname', $Database,
        '--command', "SELECT concat(current_setting('server_version'), '|', pg_database_size(current_database()))")
    $answer = (Invoke-AccucutNative -FilePath $PsqlPath -ArgumentList $arguments -Environment @{ PGPASSFILE = $PassFile; PGCONNECT_TIMEOUT = '15' }).Output.Trim()
    if ($answer -notmatch '^([0-9][0-9A-Za-z .()_-]{0,40})\|(\d{1,18})$') { throw 'The database did not answer with its version and size.' }
    return [pscustomobject]@{ ServerVersion = $Matches[1]; SizeBytes = [int64]$Matches[2] }
}

function Invoke-AccucutBackup {
    <#
    The weekly or release backup (AC-1 to AC-4, AC-7): free-space check first; pg_dump -Fc encrypted with age to a temporary name in the backups folder; the
    manifest (SHA-256, size, PostgreSQL version, time, reason, release); the copy renamed to its final name only after the manifest is written; pruning of
    copies past 2 calendar years (never the newest 4, never a newer copy to make room); one job_runs row. On any failure a failed row is written (when the
    database answers), the temporary file is removed and the error is thrown, so the caller exits non-zero.
    -Program holds the full paths already checked by the caller: PgDump, Psql, Age.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][object]$Settings,
        [Parameter(Mandatory)][hashtable]$Program,
        [Parameter(Mandatory)][ValidateSet('weekly', 'release')][string]$Reason,
        [string]$ReleaseTag = '',
        [string]$LogFile
    )

    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $started = [datetime]::UtcNow
    $directory = $Paths.Backups
    $stamp = $started.ToString($script:BackupStampFormat, $inv)
    $base = "accucut-$stamp-$Reason"
    $final = [System.IO.Path]::Combine($directory, "$base.age")
    $part = [System.IO.Path]::Combine($directory, "$base.age.part")
    $manifestPath = [System.IO.Path]::Combine($directory, "$base.manifest.json")
    $row = @{ DbHost = $Settings.PgHost; Port = $Settings.PgPort; Database = $Settings.Database; PsqlPath = $Program.Psql; PassFile = $Paths.BackupPgpass }
    $space = $null
    try {
        $info = Get-AccucutDatabaseInfo -PsqlPath $Program.Psql -PassFile $Paths.BackupPgpass -DbHost $Settings.PgHost -Port $Settings.PgPort -Database $Settings.Database
        $existing = @(Get-AccucutBackupCopy -Directory $directory)
        $last = @($existing | Where-Object { $_.Verified } | Select-Object -Last 1)
        $lastBytes = 0
        if ($last.Count -eq 1) { $lastBytes = $last[0].SizeBytes }
        $space = Get-AccucutVolumeSpace -Path $directory
        $room = Test-AccucutBackupRoom -FreeBytes $space.FreeBytes -TotalBytes $space.TotalBytes -LastCopyBytes $lastBytes -DatabaseBytes $info.SizeBytes
        if (-not $room.Ok) {
            $failure = @{ status = 'failed'; code = 'low-space'; reason = $Reason; message = 'Not enough free disk space for another copy; none was made.'; freeBytes = $space.FreeBytes; totalBytes = $space.TotalBytes; plannedBytes = $room.PlannedBytes }
            Add-AccucutJobRun @row -Job 'backup' -StartedUtc $started -FinishedUtc ([datetime]::UtcNow) -Result $failure
            throw $room.Message
        }
        if ([System.IO.File]::Exists($final) -or [System.IO.File]::Exists($manifestPath)) { throw "A copy named '$base' already exists (two backups started in the same second). Nothing was changed." }

        $size = Invoke-AccucutBackupPipe -PgDumpPath $Program.PgDump -AgePath $Program.Age -Recipient $Settings.AgeRecipient -DbHost $Settings.PgHost -Port $Settings.PgPort -Database $Settings.Database -PassFile $Paths.BackupPgpass -OutputPath $part
        $sha = Get-AccucutFileSha256 -Path $part
        $manifest = [ordered]@{
            file              = "$base.age"
            reason            = $Reason
            createdAtUtc      = $started.ToString('o', $inv)
            sizeBytes         = $size
            sha256            = $sha
            postgresVersion   = $info.ServerVersion
            dumpFormat        = 'pg_dump custom (-Fc)'
            encryption        = 'age'
            release           = $ReleaseTag
        }
        Write-AccucutBackupManifest -Path $manifestPath -Manifest $manifest
        try { [System.IO.File]::Move($part, $final) }
        catch { [System.IO.File]::Delete($manifestPath); throw }

        $pruned = @()
        try { $pruned = @(Invoke-AccucutBackupPrune -Directory $directory) }
        catch { Write-AccucutLog -Message "Pruning old copies stopped: $($_.Exception.Message)" -Level Warning -LogFile $LogFile }
        $after = Get-AccucutVolumeSpace -Path $directory
        $ok = @{ status = 'ok'; reason = $Reason; sizeBytes = $size; freeBytes = $after.FreeBytes; totalBytes = $after.TotalBytes; pruned = $pruned.Count }
        Add-AccucutJobRun @row -Job 'backup' -StartedUtc $started -FinishedUtc ([datetime]::UtcNow) -Result $ok
        Write-AccucutLog -Message "Backup made: $base.age, $(Format-AccucutSize -Bytes $size). Free space now $(Format-AccucutSize -Bytes $after.FreeBytes) of $(Format-AccucutSize -Bytes $after.TotalBytes). Old copies removed: $($pruned.Count)." -LogFile $LogFile
        return [pscustomobject]@{ Name = "$base.age"; SizeBytes = $size; Sha256 = $sha; FreeBytes = $after.FreeBytes; TotalBytes = $after.TotalBytes; Pruned = $pruned.Count }
    }
    catch {
        $message = $_.Exception.Message
        try { if ([System.IO.File]::Exists($part)) { [System.IO.File]::Delete($part) } } catch { Write-Verbose "The temporary copy could not be deleted: $($_.Exception.Message)" }
        if ($message -notlike 'Not enough free disk space*') {
            $failure = @{ status = 'failed'; code = 'error'; reason = $Reason; message = (ConvertTo-AccucutShortMessage -Text $message) }
            if ($null -ne $space) { $failure.freeBytes = $space.FreeBytes; $failure.totalBytes = $space.TotalBytes }
            try { Add-AccucutJobRun @row -Job 'backup' -StartedUtc $started -FinishedUtc ([datetime]::UtcNow) -Result $failure }
            catch { Write-AccucutLog -Message "The failed run could not be recorded in job_runs: $($_.Exception.Message)" -Level Warning -LogFile $LogFile }
        }
        throw
    }
}

function Write-AccucutBackupManifest {
    <# The manifest beside a copy: JSON, created with FileMode.CreateNew (never over an existing file). #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][System.Collections.IDictionary]$Manifest
    )

    $text = ($Manifest | ConvertTo-Json) + "`r`n"
    $stream = [System.IO.FileStream]::new($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {
        $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($text)
        $stream.Write($bytes, 0, $bytes.Length)
    }
    finally { $stream.Dispose() }
}

function Invoke-AccucutBackupPrune {
    <# The weekly pruning rule (AC-3): removes the copies that Get-AccucutBackupPruneCandidate names, oldest first, and stale temporary files. Returns the names removed. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Directory,
        [datetime]$NowUtc = [datetime]::UtcNow
    )

    [void](Remove-AccucutStaleBackupPart -Directory $Directory -NowUtc $NowUtc)
    $removed = New-Object System.Collections.Generic.List[string]
    foreach ($copy in @(Get-AccucutBackupPruneCandidate -Copy @(Get-AccucutBackupCopy -Directory $Directory) -NowUtc $NowUtc)) {
        [void](Remove-AccucutBackupCopy -Directory $Directory -Name $copy.Name)
        $removed.Add($copy.Name)
    }
    return $removed.ToArray()
}

function Clear-AccucutCopies {
    <#
    The Admin's guided clear (AC-6; architecture 9.5). Lists the copies oldest first with date and size, always keeps the newest 4, asks the Admin to TYPE the date
    of the newest copy to remove, removes nothing if that date is not the date of a copy that may be removed, shows how much space the removal frees, asks once more,
    removes oldest first up to that date, and writes one job_runs row (job 'backup-clear'). It deletes only what Remove-AccucutBackupCopy proves is its own.
    Every question goes through Read-AccucutHostInput, so that Pester can answer it. Returns what it did.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][object]$Settings,
        [Parameter(Mandatory)][string]$PsqlPath,
        [datetime]$NowUtc = [datetime]::UtcNow,
        [string]$LogFile
    )

    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $started = [datetime]::UtcNow
    $directory = $Paths.Backups
    $copies = @(Get-AccucutBackupCopy -Directory $directory)
    $space = Get-AccucutVolumeSpace -Path $directory
    $percent = 0
    if ($space.TotalBytes -gt 0) { $percent = [math]::Round(100 * $space.FreeBytes / $space.TotalBytes) }
    Write-Host ''
    Write-Host 'Backup copies on this server, oldest first (dates are UTC):'
    if ($copies.Count -eq 0) { Write-Host '  There are none.' }
    $keep = Get-AccucutBackupKeepSet -Copy $copies -Count $script:BackupKeepNewest
    $number = 0
    foreach ($copy in $copies) {
        $number++
        $note = ''
        if ($keep -contains $copy.Name) { $note = '  KEEP (one of the newest 4, always kept)' }
        elseif (-not $copy.Verified) { $note = "  KEEP (not removable: $($copy.Problem))" }
        $date = 'unknown date   '
        if ($null -ne $copy.CreatedUtc) { $date = $copy.CreatedUtc.ToString('yyyy-MM-dd HH:mm', $inv) }
        Write-Host ('  {0,3}  {1}  {2,-8} {3,10}{4}' -f $number, $date, $copy.Reason, (Format-AccucutSize -Bytes $copy.SizeBytes), $note)
    }
    Write-Host "Free space now: $(Format-AccucutSize -Bytes $space.FreeBytes) of $(Format-AccucutSize -Bytes $space.TotalBytes) ($percent %)."

    $eligible = @($copies | Where-Object { $_.Verified -and ($keep -notcontains $_.Name) })
    if ($eligible.Count -gt 0 -and $space.TotalBytes -gt 0) {
        # A hint only (architecture 9.5): how many of the oldest copies bring the free space back above 30 %.
        $hint = 0
        $gained = [int64]0
        foreach ($copy in $eligible) {
            if (($space.FreeBytes + $gained) / $space.TotalBytes -ge 0.30) { break }
            $gained += $copy.SizeBytes
            $hint++
        }
        if ($hint -gt 0) { Write-Host "To get back above 30 % free, about $hint of the oldest copies would have to go." }
    }
    if ($eligible.Count -eq 0) {
        Write-Host 'Nothing can be removed: only the newest 4 copies are left, and they are always kept. If the disk is still too full, call your IT person: the disk is too small for the data.'
        return [pscustomobject]@{ Removed = 0; FreedBytes = [int64]0; Cancelled = $false }
    }
    $answer = Read-AccucutHostInput -Prompt 'Type the date (YYYY-MM-DD) of the NEWEST copy to remove. Every older copy goes too. Press Enter to stop'
    $cutoff = [datetime]::MinValue
    if ([string]::IsNullOrWhiteSpace($answer) -or -not [datetime]::TryParseExact($answer.Trim(), 'yyyy-MM-dd', $inv, [System.Globalization.DateTimeStyles]::None, [ref]$cutoff)) {
        Write-Host 'That is not a date in the form YYYY-MM-DD, so nothing was removed.'
        return [pscustomobject]@{ Removed = 0; FreedBytes = [int64]0; Cancelled = $true }
    }
    if (@($eligible | Where-Object { $_.CreatedUtc.Date -eq $cutoff.Date }).Count -eq 0) {
        Write-Host "No copy that may be removed has the date $($cutoff.ToString('yyyy-MM-dd', $inv)), so nothing was removed. Copy the date exactly as it is listed."
        return [pscustomobject]@{ Removed = 0; FreedBytes = [int64]0; Cancelled = $true }
    }
    $selected = @($eligible | Where-Object { $_.CreatedUtc.Date -le $cutoff.Date })
    $bytes = [int64]0
    foreach ($copy in $selected) { $bytes += $copy.SizeBytes }
    $noun = 'copies'
    if ($selected.Count -eq 1) { $noun = 'copy' }
    Write-Host "This removes $($selected.Count) $noun, from $($selected[0].CreatedUtc.ToString('yyyy-MM-dd', $inv)) to $($selected[$selected.Count - 1].CreatedUtc.ToString('yyyy-MM-dd', $inv)), and frees about $(Format-AccucutSize -Bytes $bytes). A copy that is removed cannot be restored."
    $confirm = Read-AccucutHostInput -Prompt 'Type YES to remove them, anything else to stop'
    if ($confirm -cne 'YES') {
        Write-Host 'Stopped. Nothing was removed.'
        return [pscustomobject]@{ Removed = 0; FreedBytes = [int64]0; Cancelled = $true }
    }

    $removedNames = New-Object System.Collections.Generic.List[string]
    $freed = [int64]0
    $failure = $null
    foreach ($copy in $selected) {
        try {
            $freed += Remove-AccucutBackupCopy -Directory $directory -Name $copy.Name
            $removedNames.Add($copy.CreatedUtc.ToString('yyyy-MM-dd', $inv))
        }
        catch {
            $failure = $_.Exception.Message
            break
        }
    }
    $after = Get-AccucutVolumeSpace -Path $directory
    $status = 'ok'
    if ($null -ne $failure) { $status = 'failed' }
    $result = @{ status = $status; removed = $removedNames.Count; sizeBytes = $freed; freeBytes = $after.FreeBytes; totalBytes = $after.TotalBytes; dates = @($removedNames.ToArray()) }
    if ($null -ne $failure) { $result.message = (ConvertTo-AccucutShortMessage -Text $failure) }
    Add-AccucutJobRun -PsqlPath $PsqlPath -PassFile $Paths.BackupPgpass -DbHost $Settings.PgHost -Port $Settings.PgPort -Database $Settings.Database -Job 'backup-clear' -StartedUtc $started -FinishedUtc ([datetime]::UtcNow) -Result $result
    Write-AccucutLog -Message "Removed $($removedNames.Count) of the copies, freed $(Format-AccucutSize -Bytes $freed). Free space now $(Format-AccucutSize -Bytes $after.FreeBytes) of $(Format-AccucutSize -Bytes $after.TotalBytes)." -LogFile $LogFile
    if ($null -ne $failure) { throw "The clear stopped part way: $failure" }
    return [pscustomobject]@{ Removed = $removedNames.Count; FreedBytes = $freed; Cancelled = $false }
}

#endregion

Export-ModuleMember -Function @(
    'Get-AccucutPaths',
    'Get-AccucutFileSha256', 'Read-AccucutSha256File', 'Read-AccucutReleaseInfo', 'Test-AccucutAdministrator',
    'ConvertTo-AccucutVersion', 'Test-AccucutNodeVersion', 'Test-AccucutPostgresVersion',
    'Read-AccucutHostInput', 'Read-AccucutSecretInput',
    'New-AccucutSecret', 'Register-AccucutSecret', 'Hide-AccucutSecrets', 'Write-AccucutLog', 'New-AccucutLogFileName', 'Close-AccucutLog','ConvertTo-AccucutArgumentString', 'Invoke-AccucutNative',
    'Read-AccucutValuesFile', 'Read-AccucutEnvTemplate', 'Format-AccucutEnvValue', 'Split-AccucutEnvValues', 'Read-AccucutEnvFile',
    'Get-AccucutServiceSid', 'ConvertTo-AccucutIdentity', 'Set-AccucutFileAcl', 'Write-AccucutSecureFile', 'Expand-AccucutTemplate',
    'Get-AccucutCurrentRelease', 'Set-AccucutCurrentRelease', 'Remove-AccucutOldReleases', 'Remove-AccucutDirectory', 'Copy-AccucutTree', 'Remove-AccucutOldLogs',
    'Get-AccucutServiceNames', 'Get-AccucutPostgresServiceName', 'Stop-AccucutServices', 'Start-AccucutServices', 'Get-AccucutHttpStatus', 'Wait-AccucutHealth',
    'Grant-AccucutFolderAccess', 'Grant-AccucutInstallFolderAccess',
    'Assert-AccucutFreeSpace', 'Assert-AccucutServiceIdentity', 'Set-AccucutServiceIdentity', 'Initialize-AccucutServiceFiles', 'Invoke-AccucutMigration',
    'Get-AccucutBackupAccountSid', 'Get-AccucutRightHolder', 'Grant-AccucutBatchLogonRight', 'Revoke-AccucutBatchLogonRight', 'Test-AccucutBatchRightPolicy', 'Test-AccucutEventSource', 'New-AccucutEventSource', 'Register-AccucutEventSource', 'Get-AccucutRandomNumber', 'New-AccucutComplexPassword', 'Register-AccucutBackupTask', 'Remove-AccucutBackupAccount', 'Wait-AccucutBackupTask', 'Test-AccucutLogonTypeFailure',
    'Grant-AccucutBackupRootAccess', 'New-AccucutBackupFolder', 'Set-AccucutBackupFileAcl', 'Write-AccucutBackupFile', 'Test-AccucutBackupSetting', 'Read-AccucutBackupSettings', 'Write-AccucutBackupConfig',
    'Get-AccucutVolumeRoot', 'Get-AccucutVolumeSpace', 'Format-AccucutSize', 'Test-AccucutBackupRoom', 'ConvertFrom-AccucutBackupStamp', 'Get-AccucutBackupCopy', 'Get-AccucutBackupKeepSet', 'Get-AccucutBackupPruneCandidate',
    'Remove-AccucutBackupCopy', 'Remove-AccucutStaleBackupPart', 'ConvertTo-AccucutShortMessage', 'Invoke-AccucutBackupPipe', 'Add-AccucutJobRun', 'Get-AccucutDatabaseInfo', 'Write-AccucutBackupManifest', 'Invoke-AccucutBackupPrune',
    'Invoke-AccucutBackup', 'Clear-AccucutCopies'
)
