<#
.SYNOPSIS
  Shared functions of the Windows install and update scripts (STORY-10.04; ADR-015; architecture section 9.9).

.DESCRIPTION
  Windows PowerShell 5.1 only: nothing here uses a PowerShell 7 feature, so it runs on every Windows Server with nothing extra installed.

  The surface is deliberately small. STORY-10.05 (backup) and STORY-10.11 (restore) import this module and add their own functions
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
        RestorePgpass  = Join-Path $config 'restore.pgpass'
        RestoreLog     = Join-Path (Join-Path $Root 'logs') 'restore.log'
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

function Clear-AccucutPgEnvironment {
    <#
    Removes every PostgreSQL client setting (PGPASSWORD, PGHOST, PGUSER, PGSERVICE, PGOPTIONS and all the others that start with PG) from the environment a child will get.
    A machine or user setting such as PGPASSWORD wins over the password file, so a backup that relied on the file would sign in with the wrong password
    (stage 13: the runner image sets PGPASSWORD for its own PostgreSQL). The caller sets the few it needs afterwards. Takes the EnvironmentVariables of a ProcessStartInfo.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)]$EnvironmentVariables)

    foreach ($name in @($EnvironmentVariables.Keys)) {
        if ([string]$name -like 'PG*') { $EnvironmentVariables.Remove([string]$name) }
    }
}

function Invoke-AccucutNative {
    <#
    Runs a program and returns its exit code and its output, with registered secrets blanked.
    A secret goes in -Environment (set for the child only) or -StdIn, never in -ArgumentList.
    -ClearPgEnvironment drops every inherited PG* variable first, so that only what -Environment names reaches the child.
    Without -AllowFailure a non-zero exit code is an error that names the program and the code and shows the blanked output.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [hashtable]$Environment = @{},
        [string]$StdIn,
        [string]$WorkingDirectory,
        [switch]$ClearPgEnvironment,
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
    if ($ClearPgEnvironment) { Clear-AccucutPgEnvironment -EnvironmentVariables $info.EnvironmentVariables }
    foreach ($name in $Environment.Keys) { $info.EnvironmentVariables[[string]$name] = [string]$Environment[$name] }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    # Windows PowerShell 5.1 writes the console input encoding's preamble to a redirected standard input: in a UTF-8 console that is a byte order mark (EF BB BF), which psql
    # would read as the start of the first line (#516, SQR-04). The encoding is switched for the moment the process starts, as the key and dump pipes do.
    $console = $null
    if ($PSBoundParameters.ContainsKey('StdIn')) { $console = Set-AccucutConsoleInputNoPreamble }
    try { [void]$process.Start() } finally { Restore-AccucutConsoleInput -Encoding $console }
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
    if ($unknown.Count -gt 0) { throw "The template uses a name that has no value: $(($unknown | Microsoft.PowerShell.Utility\Select-Object -Unique) -join ', ')." }
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

function Assert-AccucutProxyOrigin {
    <# With a proxy in front, people reach the portal over https and the session cookie is Secure-only, so APP_ORIGIN must be the https address the proxy serves (architecture section 8 P1, #576). Throws, and nothing has been changed yet, when it is not. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Origin)

    if ($Origin -notmatch '^https://[^/\s?#]+$') {
        throw "With -WithProxy, APP_ORIGIN must be the https address the proxy serves, such as https://portal.example.test (a scheme and a host, no path); it is '$Origin'. The proxy ends TLS and the session cookie is Secure-only: over plain http nobody could sign in. Nothing was changed."
    }
}

function Get-AccucutHttpResponse {
    <#
    One GET that never follows a redirect, for the proxy checks: the status (0 when nothing answered), every header (names in lower case, each with its values) and the reason when nothing answered.
    A certificate that Windows does not trust counts as nothing answering, which is what check C1 asks for.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Url,
        [hashtable]$RequestHeaders = @{},
        [int]$TimeoutSeconds = 15
    )

    $result = @{ Status = 0; Headers = @{}; Error = '' }
    $response = $null
    try {
        $request = [System.Net.HttpWebRequest]::Create($Url)
        $request.Method = 'GET'
        $request.Timeout = $TimeoutSeconds * 1000
        $request.AllowAutoRedirect = $false
        $request.UserAgent = 'AccucutInstallCheck'
        foreach ($name in $RequestHeaders.Keys) { $request.Headers[[string]$name] = [string]$RequestHeaders[$name] }
        $response = $request.GetResponse()
    }
    catch [System.Net.WebException] {
        $response = $_.Exception.Response
        if ($null -eq $response) {
            $result.Error = $_.Exception.Message
            return $result
        }
    }
    try {
        $result.Status = [int]$response.StatusCode
        foreach ($key in $response.Headers.AllKeys) { $result.Headers[$key.ToLowerInvariant()] = @($response.Headers.GetValues($key)) }
    }
    finally { $response.Close() }
    return $result
}

function Test-AccucutProxyRedirect {
    <# Check C2 (P1): plain http goes to the https address. Returns the problems; none means it passes. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][int]$Status,
        [AllowEmptyString()][string]$Location = '',
        [Parameter(Mandatory)][string]$Origin
    )

    $problems = [System.Collections.Generic.List[string]]::new()
    $expected = "$Origin/sign-in"
    if ($Status -ne 301 -and $Status -ne 308) { $problems.Add("plain http answered $Status, not a redirect (301 or 308) to https") }
    elseif ($Location -ne $expected) { $problems.Add("plain http was sent to '$Location', not to '$expected'") }
    return @($problems)
}

function Test-AccucutProxyHeaders {
    <#
    Check C3 (P3): the headers of the sign-in page through the proxy. -Headers maps a lower-case name to its values. HSTS exactly once with the one-year value, the portal's own
    Content-Security-Policy with frame-ancestors 'none', nosniff, a Referrer-Policy and a Permissions-Policy passed through, and no Server and no X-Powered-By.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$Headers)

    $problems = [System.Collections.Generic.List[string]]::new()
    $hsts = @()
    if ($Headers.ContainsKey('strict-transport-security')) { $hsts = @($Headers['strict-transport-security']) }
    if ($hsts.Count -ne 1 -or [string]$hsts[0] -ne 'max-age=31536000') { $problems.Add('Strict-Transport-Security must be there once, as max-age=31536000') }
    $policy = ''
    if ($Headers.ContainsKey('content-security-policy')) { $policy = (@($Headers['content-security-policy']) -join ',') }
    if ($policy -notmatch "frame-ancestors 'none'") { $problems.Add("the portal's Content-Security-Policy with frame-ancestors 'none' did not come through") }
    if (-not $Headers.ContainsKey('x-content-type-options') -or (@($Headers['x-content-type-options']) -join ',') -ne 'nosniff') { $problems.Add('X-Content-Type-Options: nosniff did not come through') }
    if (-not $Headers.ContainsKey('referrer-policy')) { $problems.Add('Referrer-Policy did not come through') }
    if (-not $Headers.ContainsKey('permissions-policy')) { $problems.Add('Permissions-Policy did not come through') }
    if ($Headers.ContainsKey('server')) { $problems.Add('a Server header is still sent: the proxy must remove it') }
    if ($Headers.ContainsKey('x-powered-by')) { $problems.Add('an X-Powered-By header is still sent: the proxy must remove it') }
    return @($problems)
}

function Test-AccucutClientAddressSeen {
    <# Check C5 (P2): the address the portal worked out (X-Client-Address-Seen of /api/health) must be a real address, not the one this request pretended to forward. #>
    [CmdletBinding()]
    param(
        [AllowEmptyString()][string]$Seen = '',
        [Parameter(Mandatory)][string]$Sent
    )

    $problems = [System.Collections.Generic.List[string]]::new()
    $parsed = $null
    if ([string]::IsNullOrEmpty($Seen)) { $problems.Add('the health page sent no X-Client-Address-Seen header') }
    elseif ($Seen -eq 'none') { $problems.Add('the portal found no usable address: the proxy must write the connecting address as the last entry of X-Forwarded-For') }
    elseif ($Seen -eq $Sent) { $problems.Add("the portal took the address this request pretended to forward ($Sent): the proxy passes on an address a browser sent, so the sign-in limits can be dodged") }
    elseif ($Seen -match '^\d+\.\d+\.\d+\.\d+:\d+$' -or -not [System.Net.IPAddress]::TryParse($Seen, [ref]$parsed)) { $problems.Add("the portal worked out '$Seen', which is not an address without a port: the proxy must not add a port to X-Forwarded-For") }
    return @($problems)
}

function Write-AccucutProxyCheckResult {
    <# Logs one proxy check: passed, or each problem as a warning. Returns true when it passed. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][string]$Title,
        [string[]]$Problems = @(),
        [string]$LogFile
    )

    if (@($Problems).Count -eq 0) {
        Write-AccucutLog -Message "Proxy check $Id ($Title): passed." -LogFile $LogFile
        return $true
    }
    foreach ($problem in $Problems) { Write-AccucutLog -Message "Proxy check $Id ($Title): FAILED, $problem." -Level Warning -LogFile $LogFile }
    return $false
}

function Invoke-AccucutProxyChecks {
    <#
    The end of an install with -WithProxy: checks C2, C3 and C5 of the install guide ("Reverse proxy") against -Origin, as the portal's own server sees it. Returns the ids of the checks that
    did not pass (none when all passed). It never throws for a failed check: the portal is installed and running, and the proxy may not have been installed yet, so the install says what is missing and the IT person runs the
    checklist again after installing the proxy. C1 (a trusted certificate) is in all three, since a certificate Windows does not trust answers nothing.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Origin,
        [string]$LogFile
    )

    $failed = [System.Collections.Generic.List[string]]::new()
    $address = [System.Uri]$Origin
    $forged = '203.0.113.7'

    if ($address.IsDefaultPort) {
        $plain = Get-AccucutHttpResponse -Url "http://$($address.Host)/sign-in"
        $location = ''
        if ($plain.Headers.ContainsKey('location')) { $location = [string](@($plain.Headers['location'])[0]) }
        $problems = @(Test-AccucutProxyRedirect -Status $plain.Status -Location $location -Origin $Origin)
        if ($plain.Status -eq 0) { $problems = @("nothing answered on plain http at $($address.Host) ($($plain.Error))") }
        if (-not (Write-AccucutProxyCheckResult -Id 'C2' -Title 'http goes to https' -Problems $problems -LogFile $LogFile)) { $failed.Add('C2') }
    }
    else {
        Write-AccucutLog -Message "Proxy check C2 (http goes to https): skipped, because $Origin has a port. Check it by hand (README, Reverse proxy)." -Level Warning -LogFile $LogFile
    }

    $page = Get-AccucutHttpResponse -Url "$Origin/sign-in"
    if ($page.Status -eq 0) { $problems = @("nothing answered at $Origin/sign-in ($($page.Error))") }
    elseif ($page.Status -ne 200) { $problems = @("the sign-in page answered $($page.Status), not 200") }
    else { $problems = @(Test-AccucutProxyHeaders -Headers $page.Headers) }
    if (-not (Write-AccucutProxyCheckResult -Id 'C3' -Title 'the headers' -Problems $problems -LogFile $LogFile)) { $failed.Add('C3') }

    $health = Get-AccucutHttpResponse -Url "$Origin/api/health" -RequestHeaders @{ 'X-Forwarded-For' = $forged }
    if ($health.Status -eq 0) { $problems = @("nothing answered at $Origin/api/health ($($health.Error))") }
    else {
        $seen = ''
        if ($health.Headers.ContainsKey('x-client-address-seen')) { $seen = [string](@($health.Headers['x-client-address-seen'])[0]) }
        $problems = @(Test-AccucutClientAddressSeen -Seen $seen -Sent $forged)
    }
    if (-not (Write-AccucutProxyCheckResult -Id 'C5' -Title 'the real address, last' -Problems $problems -LogFile $LogFile)) { $failed.Add('C5') }

    return @($failed)
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
    $name = $null
    $buffer = [System.IntPtr]::Zero
    [uint32]$count = 0
    try {
        $name = New-AccucutLsaString -Value $Right
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
        if ($null -ne $name) { Remove-AccucutLsaString -LsaString $name }
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
    $name = $null
    try {
        $name = New-AccucutLsaString -Value $Right
        $status = $native::LsaAddAccountRights($handle, (Get-AccucutSidBytes -Sid $Sid), $name.Structure, [uint32]1)
        Assert-AccucutLsaStatus -Status $status -Operation "giving $Right"
    }
    finally {
        if ($null -ne $name) { Remove-AccucutLsaString -LsaString $name }
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
    $name = $null
    try {
        $name = New-AccucutLsaString -Value $Right
        $status = $native::LsaRemoveAccountRights($handle, (Get-AccucutSidBytes -Sid $Sid), [byte]0, $name.Structure, [uint32]1)
        Assert-AccucutLsaStatus -Status $status -Operation "taking away $Right" -Allowed @([uint32]3221225524)
    }
    finally {
        if ($null -ne $name) { Remove-AccucutLsaString -LsaString $name }
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

function Test-AccucutModuleLogging {
    <#
    True when a policy switches PowerShell module logging on for this server (HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ModuleLogging, EnableModuleLogging = 1).
    Module logging records the values given to commands (event 4103 in Microsoft-Windows-PowerShell/Operational), which would include the passwords the install gives to the backup
    account and the backup role. Read-only; an unreadable key counts as off (nothing is recorded by a key that is not there).
    #>
    [CmdletBinding()]
    param()

    try {
        $value = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ModuleLogging' -Name 'EnableModuleLogging' -ErrorAction Stop
        return ([int]$value.EnableModuleLogging -eq 1)
    }
    catch { return $false }
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
        if ($created) { Remove-AccucutBackupAccount -LogFile $LogFile }
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
    # Read back what Windows holds, before any secret is written: protected, owner Administrators, and exactly the three entries (nothing inherited).
    $actual = [System.IO.File]::GetAccessControl($Path)
    $owner = $actual.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
    $entries = @($actual.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object { "$($_.IdentityReference.Value)|$($_.AccessControlType)|$($_.IsInherited)" } | Sort-Object)
    $wanted = @($administrators.Value, $system.Value, [System.Security.Principal.SecurityIdentifier]::new($BackupSid).Value | ForEach-Object { "$_|Allow|False" } | Sort-Object)
    if (-not $actual.AreAccessRulesProtected -or $owner -ne $administrators.Value -or ($entries -join ';') -ne ($wanted -join ';')) {
        throw "The permissions of '$Path' are not what was set (owner $owner, entries: $($entries -join ', ')). Nothing was written to it."
    }
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
        'ageRecipient' { return ($Value -is [string] -and $Value -cmatch $script:AgeRecipientPattern) }
        'pgHost' { return ($Value -is [string] -and $Value -match '^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$') }
        'pgPort' { return (($Value -is [int] -or $Value -is [long]) -and $Value -ge 1 -and $Value -le 65535) }
        'database' { return ($Value -is [string] -and $Value -cmatch '^[a-z_][a-z0-9_]{0,62}$') }
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
    # One line, ended by a single line feed, no byte order mark: libpq reads the file as bytes and a carriage return would become part of the password.
    Write-AccucutBackupFile -Path $Paths.BackupPgpass -Content ($line + "`n") -BackupSid $BackupSid
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

    $newest = @($Copy | Sort-Object -Property @{ Expression = { if ($null -eq $_.CreatedUtc) { [datetime]::MinValue } else { $_.CreatedUtc } } }, Name -Descending | Microsoft.PowerShell.Utility\Select-Object -First $Count)
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
        [Parameter(Mandatory)][string]$OutputPath,
        [string]$DatabaseRole = $script:BackupDatabaseRole
    )

    if ($Recipient -cnotmatch $script:AgeRecipientPattern) { throw 'The age recipient is not a public key (age1...).' }
    $dumpInfo = New-Object System.Diagnostics.ProcessStartInfo
    $dumpInfo.FileName = $PgDumpPath
    $dumpInfo.Arguments = ConvertTo-AccucutArgumentString -ArgumentList @('--format=custom', '--no-password', '--host', $DbHost, '--port', [string]$Port, '--username', $DatabaseRole, '--dbname', $Database)
    # Only the password file reaches pg_dump: a PGPASSWORD (or PGHOST, PGUSER, PGSERVICE) set on the machine or for the account must not.
    Clear-AccucutPgEnvironment -EnvironmentVariables $dumpInfo.EnvironmentVariables
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
    $magicError = $null
    $dumpMagic = [System.Text.Encoding]::ASCII.GetBytes('PGDMP')
    # Windows PowerShell 5.1 builds age's standard input as a text writer in the console's input encoding and flushes it when the process starts. When the console is UTF-8
    # (an administrator's console often is) that flush writes a byte order mark (EF BB BF) in front of the dump, and the copy no longer restores. The task's console is not UTF-8,
    # which is why only an administrator's release backup was damaged. The console's input encoding is therefore switched to one with no preamble (OEM US, code page 437) for the
    # moment age is started, and put back at once. The dump itself only ever goes through the stream, never through the writer.
    $consoleInput = $null
    try {
        $consoleInput = [System.Console]::InputEncoding
        if ($consoleInput.GetPreamble().Length -gt 0) { [System.Console]::InputEncoding = [System.Text.Encoding]::GetEncoding(437) }
        else { $consoleInput = $null }
    }
    catch {
        # No console (a service, a task without one): there is no console encoding to write a preamble from.
        Write-Verbose "The console input encoding could not be read or changed: $($_.Exception.Message)"
        $consoleInput = $null
    }
    try {
        try { [void]$age.Start() }
        finally {
            if ($null -ne $consoleInput) {
                try { [System.Console]::InputEncoding = $consoleInput } catch { Write-Verbose "The console input encoding could not be put back: $($_.Exception.Message)" }
            }
        }
        $ageStarted = $true
        [void]$dump.Start()
        $dumpStarted = $true
        $dumpErrorTask = $dump.StandardError.ReadToEndAsync()
        $ageErrorTask = $age.StandardError.ReadToEndAsync()
        $outputTask = $age.StandardOutput.BaseStream.CopyToAsync($output)
        $source = $dump.StandardOutput.BaseStream
        $sink = $age.StandardInput.BaseStream
        try {
            # The first bytes of a custom-format archive are PGDMP. Anything else is not a dump (an error text, a plain-text dump, a damaged stream): it is never encrypted and kept.
            $head = New-Object byte[] $dumpMagic.Length
            $got = 0
            while ($got -lt $head.Length) {
                $read = $source.Read($head, $got, $head.Length - $got)
                if ($read -le 0) { break }
                $got += $read
            }
            $isArchive = ($got -eq $head.Length)
            if ($isArchive) { for ($i = 0; $i -lt $head.Length; $i++) { if ($head[$i] -ne $dumpMagic[$i]) { $isArchive = $false } } }
            if ($isArchive) {
                $sink.Write($head, 0, $head.Length)
                $source.CopyTo($sink)
                $sink.Flush()
            }
            else {
                $magicError = 'pg_dump did not write a custom-format archive (its output must start with PGDMP; first bytes: ' + $(if ($got -gt 0) { [System.BitConverter]::ToString($head, 0, $got).Replace('-', ' ') } else { 'none' }) + ').'
                try { $dump.Kill() } catch { Write-Verbose "pg_dump had already ended: $($_.Exception.Message)" }
            }
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
    if ($null -ne $magicError) { throw "$magicError $(ConvertTo-AccucutShortMessage -Text $dumpMessage)".Trim() }
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
        [Parameter(Mandatory)][ValidatePattern('^[a-z][a-z-]{1,31}$', Options = 'None')][string]$Job,
        [Parameter(Mandatory)][datetime]$StartedUtc,
        [Parameter(Mandatory)][datetime]$FinishedUtc,
        [Parameter(Mandatory)][hashtable]$Result,
        [string]$DatabaseRole = $script:BackupDatabaseRole
    )

    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $json = $Result | ConvertTo-Json -Compress -Depth 4
    $sql = "INSERT INTO job_runs (job, started_at, finished_at, result) VALUES (:'job', :'started'::timestamptz, :'finished'::timestamptz, :'result'::jsonb);"
    $arguments = @(
        '-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1',
        '-v', "job=$Job", '-v', "started=$($StartedUtc.ToUniversalTime().ToString('o', $inv))", '-v', "finished=$($FinishedUtc.ToUniversalTime().ToString('o', $inv))", '-v', "result=$json",
        '--host', $DbHost, '--port', [string]$Port, '--username', $DatabaseRole, '--dbname', $Database, '--file', '-'
    )
    [void](Invoke-AccucutNative -FilePath $PsqlPath -ArgumentList $arguments -Environment @{ PGPASSFILE = $PassFile; PGCONNECT_TIMEOUT = '15' } -ClearPgEnvironment -StdIn $sql)
}

function Get-AccucutDatabaseInfo {
    <# The PostgreSQL server version text and the size of the database in bytes, read as the accucut_backup role. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][string]$PassFile,
        [Parameter(Mandatory)][string]$DbHost,
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][string]$Database,
        [string]$DatabaseRole = $script:BackupDatabaseRole
    )

    $arguments = @('-X', '-w', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '--host', $DbHost, '--port', [string]$Port, '--username', $DatabaseRole, '--dbname', $Database,
        '--command', "SELECT concat(current_setting('server_version'), '|', pg_database_size(current_database()))")
    $answer = (Invoke-AccucutNative -FilePath $PsqlPath -ArgumentList $arguments -Environment @{ PGPASSFILE = $PassFile; PGCONNECT_TIMEOUT = '15' } -ClearPgEnvironment).Output.Trim()
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
    -SkipPrune makes the copy and prunes nothing. The safety copy of a restore uses it: that copy is one more among the newest, so a pruning run after it could delete
    the very copy the Admin chose (a copy just past 2 years, pushed out of the newest 4 by the safety copy itself) before it is read. The next weekly backup prunes.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][object]$Settings,
        [Parameter(Mandatory)][hashtable]$Program,
        [Parameter(Mandatory)][ValidateSet('weekly', 'release')][string]$Reason,
        [string]$ReleaseTag = '',
        [string]$LogFile,
        [string]$PassFile,
        [string]$DatabaseRole = $script:BackupDatabaseRole,
        [switch]$SkipPrune
    )

    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $started = [datetime]::UtcNow
    $directory = $Paths.Backups
    $stamp = $started.ToString($script:BackupStampFormat, $inv)
    $base = "accucut-$stamp-$Reason"
    $final = [System.IO.Path]::Combine($directory, "$base.age")
    $part = [System.IO.Path]::Combine($directory, "$base.age.part")
    $manifestPath = [System.IO.Path]::Combine($directory, "$base.manifest.json")
    if ([string]::IsNullOrEmpty($PassFile)) { $PassFile = $Paths.BackupPgpass }
    $row = @{ DbHost = $Settings.PgHost; Port = $Settings.PgPort; Database = $Settings.Database; PsqlPath = $Program.Psql; PassFile = $PassFile; DatabaseRole = $DatabaseRole }
    $space = $null
    try {
        $info = Get-AccucutDatabaseInfo -PsqlPath $Program.Psql -PassFile $PassFile -DatabaseRole $DatabaseRole -DbHost $Settings.PgHost -Port $Settings.PgPort -Database $Settings.Database
        $existing = @(Get-AccucutBackupCopy -Directory $directory)
        $last = @($existing | Where-Object { $_.Verified } | Microsoft.PowerShell.Utility\Select-Object -Last 1)
        $lastBytes = 0
        if ($last.Count -eq 1) { $lastBytes = $last[0].SizeBytes }
        $space = Get-AccucutVolumeSpace -Path $directory
        $room = Test-AccucutBackupRoom -FreeBytes $space.FreeBytes -TotalBytes $space.TotalBytes -LastCopyBytes $lastBytes -DatabaseBytes $info.SizeBytes
        if (-not $room.Ok) {
            $failure = @{ status = 'failed'; code = 'low-space'; reason = $Reason; message = 'Not enough free disk space for another copy; none was made.'; freeBytes = $space.FreeBytes; totalBytes = $space.TotalBytes; plannedBytes = $room.PlannedBytes }
            Add-AccucutJobRun @row -Job 'backup' -StartedUtc $started -FinishedUtc ([datetime]::UtcNow) -Result $failure
            # The code travels in the exception, so that no caller has to read the wording of the message (backup.ps1 picks event 1012 from it).
            $lowSpace = [System.InvalidOperationException]::new($room.Message)
            $lowSpace.Data['accucutCode'] = 'low-space'
            throw $lowSpace
        }
        if ([System.IO.File]::Exists($final) -or [System.IO.File]::Exists($manifestPath)) { throw "A copy named '$base' already exists (two backups started in the same second). Nothing was changed." }

        $size = Invoke-AccucutBackupPipe -PgDumpPath $Program.PgDump -AgePath $Program.Age -Recipient $Settings.AgeRecipient -DbHost $Settings.PgHost -Port $Settings.PgPort -Database $Settings.Database -PassFile $PassFile -OutputPath $part -DatabaseRole $DatabaseRole
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
        if (-not $SkipPrune) {
            try { $pruned = @(Invoke-AccucutBackupPrune -Directory $directory) }
            catch { Write-AccucutLog -Message "Pruning old copies stopped: $($_.Exception.Message)" -Level Warning -LogFile $LogFile }
        }
        $after = Get-AccucutVolumeSpace -Path $directory
        $ok = @{ status = 'ok'; reason = $Reason; sizeBytes = $size; freeBytes = $after.FreeBytes; totalBytes = $after.TotalBytes; pruned = $pruned.Count }
        Add-AccucutJobRun @row -Job 'backup' -StartedUtc $started -FinishedUtc ([datetime]::UtcNow) -Result $ok
        Write-AccucutLog -Message "Backup made: $base.age, $(Format-AccucutSize -Bytes $size). Free space now $(Format-AccucutSize -Bytes $after.FreeBytes) of $(Format-AccucutSize -Bytes $after.TotalBytes). Old copies removed: $($pruned.Count)." -LogFile $LogFile
        return [pscustomobject]@{ Name = "$base.age"; SizeBytes = $size; Sha256 = $sha; FreeBytes = $after.FreeBytes; TotalBytes = $after.TotalBytes; Pruned = $pruned.Count }
    }
    catch {
        $message = $_.Exception.Message
        $errorCode = $_.Exception.Data['accucutCode']
        try { if ([System.IO.File]::Exists($part)) { [System.IO.File]::Delete($part) } } catch { Write-Verbose "The temporary copy could not be deleted: $($_.Exception.Message)" }
        if ($errorCode -ne 'low-space') {
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

function Invoke-AccucutClearCopies {
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

#region Restore (STORY-10.11; architecture sections 9.5 and 9.9; ADR-015 Amendment 3 point 4 and the forward note for 10.11)

# The database role of the guided restore (deploy/db/create-restore-role.psql), the role the data belongs to, and the names of the databases a restore makes.
# A restore makes accucut_new_<time>, fills it from the copy, then swaps names: the live database becomes accucut_old_<time> and the new one takes its name.
$script:RestoreDatabaseRole = 'accucut_restore'
$script:RestoreDatabasePattern = '^accucut_(new|old|failed)_\d{14}$'
$script:RestoreStampFormat = 'yyyyMMddHHmmss'

# What the Admin's key looks like (age's secret key: the text AGE, SECRET, KEY and 1 joined by dashes, then 58 upper-case letters and digits; written in two pieces so that this file never holds a key-shaped text) and what a decrypted custom-format dump starts with.
$script:AgeSecretKeyPattern = '^AGE-SECRET-' + 'KEY-1[0-9A-Z]{58}$'
$script:DumpMagicText = 'PGDMP'

# The Windows Application event ids of the restore (source Accucut, like the backup's 1000 and 1010 to 1012): 1100 done; 1101 stopped by the Admin;
# 1110 a check failed, nothing was done; 1111 it failed and the portal runs on the old database; 1112 it failed after the swap and was put back.
$script:RestoreEventDone = 1100
$script:RestoreEventCancelled = 1101
$script:RestoreEventChecksFailed = 1110
$script:RestoreEventFailed = 1111
$script:RestoreEventFailedAfterSwap = 1112

function New-AccucutRestoreStop {
    <# An error that carries a code (accucutCode), so that no caller has to read the wording of a message. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Code,
        [Parameter(Mandatory)][string]$Message
    )

    $exception = [System.InvalidOperationException]::new($Message)
    $exception.Data['accucutCode'] = $Code
    return $exception
}

function Read-AccucutKeyInput {
    <# The backup key, typed or pasted without echo, as a SecureString (a function of its own so that Pester can mock it). Nothing is ever shown or written. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Prompt)

    return (Read-Host -Prompt $Prompt -AsSecureString)
}

function ConvertFrom-AccucutSecureString {
    <# A SecureString as text, for the moment it takes to check it and write it to a program's standard input. The unmanaged copy is cleared at once. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][System.Security.SecureString]$Secure)

    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Read-AccucutPgpassPassword {
    <# The password of -Role in a PGPASSFILE (host:port:database:user:password; a backslash escapes the next character). The caller has trust-checked the file. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Role
    )

    if (([System.IO.FileInfo]::new($Path)).Length -gt 4096) { throw "The password file '$Path' is too large." }
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        $fields = New-Object System.Collections.Generic.List[string]
        $field = New-Object System.Text.StringBuilder
        for ($i = 0; $i -lt $line.Length; $i++) {
            $c = $line[$i]
            if ($c -eq '\' -and $i + 1 -lt $line.Length) { $i++; [void]$field.Append($line[$i]); continue }
            if ($c -eq ':' -and $fields.Count -lt 4) { $fields.Add($field.ToString()); [void]$field.Clear(); continue }
            [void]$field.Append($c)
        }
        $fields.Add($field.ToString())
        if ($fields.Count -eq 5 -and $fields[3] -eq $Role -and $fields[4].Length -gt 0) {
            Register-AccucutSecret -Value $fields[4]
            return $fields[4]
        }
    }
    throw "The password file '$Path' holds no password for the role '$Role'."
}

function Read-AccucutInstallState {
    <# What the install wrote to config\install-state.json that a restore needs: the port of the portal and the full path of node.exe. Nothing else is trusted from it. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    if (([System.IO.FileInfo]::new($Path)).Length -gt 16384) { throw 'The install state file is too large.' }
    $state = [System.IO.File]::ReadAllText($Path) | ConvertFrom-Json
    $names = @($state.PSObject.Properties.Name)
    foreach ($required in 'port', 'nodeExe') { if ($names -notcontains $required) { throw "The install state file has no '$required'." } }
    $port = 0
    if (-not [int]::TryParse([string]$state.port, [ref]$port) -or $port -lt 1 -or $port -gt 65535) { throw "The install state file has a port that is not allowed." }
    if ([string]$state.nodeExe -notmatch '^[A-Za-z]:\\[^"&|<>^%\r\n]{1,240}\.exe$' -or [string]$state.nodeExe -match '\.\.') { throw 'The install state file has a node.exe path that is not allowed.' }
    return [pscustomobject]@{ Port = $port; NodeExe = [string]$state.nodeExe }
}

function Test-AccucutRestoreVersion {
    <# The manifest's PostgreSQL version against the server's (architecture 9.5: restore into the same or a newer PostgreSQL, never an older one). Compares the major number. #>
    [CmdletBinding()]
    param(
        [AllowNull()][AllowEmptyString()][string]$ManifestVersion,
        [AllowNull()][AllowEmptyString()][string]$ServerVersion
    )

    $copy = ConvertTo-AccucutVersion -Text $ManifestVersion
    $server = ConvertTo-AccucutVersion -Text $ServerVersion
    if ($null -eq $copy) { return [pscustomobject]@{ Ok = $false; Message = 'The manifest of this copy does not say which PostgreSQL version made it, so it cannot be checked against this server.' } }
    if ($null -eq $server) { return [pscustomobject]@{ Ok = $false; Message = 'The version of this server''s PostgreSQL could not be read.' } }
    if ($copy.Major -gt $server.Major) {
        return [pscustomobject]@{ Ok = $false; Message = "This copy was made by PostgreSQL $($copy.Major), and this server runs PostgreSQL $($server.Major). A copy can be restored only into the same or a newer PostgreSQL." }
    }
    return [pscustomobject]@{ Ok = $true; Message = "PostgreSQL $($copy.Major) copy, PostgreSQL $($server.Major) server." }
}

function Test-AccucutRestoreRoom {
    <#
    The free-space check that comes before anything is touched (AC-1). A restore needs room for the safety copy of the database as it is now (the last copy plus 10 %, as the
    backup plans it, or the database's size when there is no copy) and for the new database (the larger of the database's size now and twice the chosen copy: a copy is
    compressed, the database is not, so this is an estimate), and 20 % of the volume must still be free afterwards. It deletes nothing.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][int64]$FreeBytes,
        [Parameter(Mandatory)][int64]$TotalBytes,
        [Parameter(Mandatory)][int64]$LastCopyBytes,
        [Parameter(Mandatory)][int64]$DatabaseBytes,
        [Parameter(Mandatory)][int64]$CopyBytes
    )

    $basis = $LastCopyBytes
    if ($basis -le 0) { $basis = $DatabaseBytes }
    $safety = [int64][math]::Ceiling($basis * (1 + $script:BackupGrowthMargin))
    $restored = [int64][math]::Max($DatabaseBytes, 2 * $CopyBytes)
    $needed = $safety + $restored
    $minimum = [int64][math]::Ceiling($TotalBytes * $script:BackupKeepFreeFraction)
    $ok = ($TotalBytes -gt 0 -and ($FreeBytes - $needed) -ge $minimum)
    $message = ''
    if (-not $ok) {
        $message = "There is not enough free disk space for a restore: $(Format-AccucutSize -Bytes $FreeBytes) is free, a restore needs about $(Format-AccucutSize -Bytes $needed) (a safety copy and the restored database), and 20 % of the disk ($(Format-AccucutSize -Bytes $minimum)) must stay free. Clear old copies with Clear-AccucutCopies, or ask your IT person for a bigger disk."
    }
    return [pscustomobject]@{ Ok = $ok; FreeBytes = $FreeBytes; TotalBytes = $TotalBytes; NeededBytes = $needed; MinimumFreeBytes = $minimum; Message = $message }
}

function Get-AccucutRunningAccount {
    <#
    The Windows account that is running this script (DOMAIN\user or COMPUTER\user), for the restore's record (ADR-015 Amendment 3.4 decision 3): the Admin and the IT person are both
    administrators, so the record itself must say who ran a restore. Never throws; the text 'unknown account' stands in when Windows cannot say. -Source is a seam for Pester.
    #>
    [CmdletBinding()]
    param([scriptblock]$Source = { [System.Security.Principal.WindowsIdentity]::GetCurrent().Name })

    try {
        # .Invoke(), not the call operator: the module has no load site (a test of the trust block checks that on its syntax tree).
        $name = [string]($Source.Invoke())
        if ([string]::IsNullOrWhiteSpace($name)) { return 'unknown account' }
        return $name
    }
    catch { return 'unknown account' }
}

function Write-AccucutApplicationEvent {
    <# The one call that writes to the Application log (a function of its own so that Pester can see the text). Never throws: a missing source must not turn a good restore into a failure. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][string]$EntryType,
        [Parameter(Mandatory)][int]$EventId
    )

    try { [System.Diagnostics.EventLog]::WriteEntry($script:EventSource, $Text, [System.Diagnostics.EventLogEntryType]$EntryType, $EventId) }
    catch { Write-Host "The event could not be written to the Application log: $($_.Exception.Message)" -ForegroundColor Yellow }
}

function Write-AccucutRestoreEvent {
    <#
    One event in the Application log (source Accucut), outside the database, so that a rollback cannot erase it. It ends with " Run by <account>." (ADR-015 Amendment 3.4 decision 3);
    the message is cut to fit 1000 characters before that ending, never after it. Never throws: a missing source must not turn a good restore into a failure.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][ValidateSet('Information', 'Error')][string]$EntryType,
        [Parameter(Mandatory)][int]$EventId,
        [Parameter(Mandatory)][string]$Message
    )

    $tail = (Hide-AccucutSecrets -Text " Run by $(Get-AccucutRunningAccount).") -replace '[\x00-\x08\x0B-\x1F]', ' '
    $text = (Hide-AccucutSecrets -Text $Message) -replace '[\x00-\x08\x0B-\x1F]', ' '
    if ($text.Length + $tail.Length -gt 1000) { $text = $text.Substring(0, [Math]::Max(0, 1000 - $tail.Length)) }
    Write-AccucutApplicationEvent -Text ($text + $tail) -EntryType $EntryType -EventId $EventId
}

function Set-AccucutLockedFileAcl {
    <# A log file that only Administrators, SYSTEM and (optionally) one group may touch: protected, owner Administrators, no inherited entry. The group gets Modify. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$ModifySid
    )

    $administrators = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid, $null)
    $system = [System.Security.Principal.SecurityIdentifier]::new([System.Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
    $security = [System.Security.AccessControl.FileSecurity]::new()
    $security.SetOwner($administrators)
    $security.SetAccessRuleProtection($true, $false)
    $allow = [System.Security.AccessControl.AccessControlType]::Allow
    foreach ($sid in @($administrators, $system)) {
        $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, [System.Security.AccessControl.FileSystemRights]::FullControl, $allow))
    }
    if (-not [string]::IsNullOrEmpty($ModifySid)) {
        $security.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($ModifySid), [System.Security.AccessControl.FileSystemRights]::Modify, $allow))
    }
    [System.IO.File]::SetAccessControl($Path, $security)
}

function Test-AccucutRestoreLogFile {
    <#
    True when an existing restore.log can be appended to: a regular file (not a link), owned by Administrators or SYSTEM, with a protected list that names only Administrators, SYSTEM
    and the endpoint's group. The two service accounts can write in the logs folder, so they could swap the file for one of their own, or for a link: such a file is never written to.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $attributes = [System.IO.File]::GetAttributes($Path)
    if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or ($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) { return $false }
    $security = [System.IO.File]::GetAccessControl($Path)
    $owner = $security.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
    if (@('S-1-5-32-544', 'S-1-5-18') -notcontains $owner -or -not $security.AreAccessRulesProtected) { return $false }
    $allowed = @('S-1-5-32-544', 'S-1-5-18')
    $groupSid = Get-AccucutAdminGroupSid
    if (-not [string]::IsNullOrEmpty($groupSid)) { $allowed += $groupSid }
    foreach ($rule in $security.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) {
        if ($allowed -notcontains $rule.IdentityReference.Value) { return $false }
    }
    return $true
}

function Add-AccucutRestoreLogLine {
    <#
    Appends one line to C:\Accucut\logs\restore.log (AC-6): a record outside the database, so that restoring an older copy cannot erase it. The file is made once, locked
    (Test-AccucutRestoreLogFile says what it must look like). A file that fails that check is not written to; the line goes to a new file named restore-<time>-<random>.log
    instead, which is made the same way and never appended to by a second run.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Line
    )

    $target = $Path
    $groupSid = Get-AccucutAdminGroupSid
    $directory = [System.IO.Path]::GetDirectoryName($Path)
    if (-not [System.IO.Directory]::Exists($directory)) { [void][System.IO.Directory]::CreateDirectory($directory) }
    if ([System.IO.File]::Exists($Path) -and -not (Test-AccucutRestoreLogFile -Path $Path)) {
        $target = [System.IO.Path]::Combine($directory, ('restore-{0}-{1}.log' -f (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss'), [guid]::NewGuid().ToString('N').Substring(0, 8)))
    }
    if (-not [System.IO.File]::Exists($target)) {
        $stream = [System.IO.FileStream]::new($target, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $stream.Dispose()
        Set-AccucutLockedFileAcl -Path $target -ModifySid $groupSid
    }
    $writer = [System.IO.FileStream]::new($target, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
    try {
        $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($Line + "`r`n")
        $writer.Write($bytes, 0, $bytes.Length)
    }
    finally { $writer.Dispose() }
}

function Write-AccucutRestoreRecord {
    <# One line to the screen and to restore.log, with every registered secret blanked. A log that cannot be written is said on the screen and never stops the restore. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet('Info', 'Warning', 'Error')][string]$Level = 'Info'
    )

    Write-AccucutLog -Message $Message -Level $Level
    $clean = Hide-AccucutSecrets -Text $Message
    $line = '{0}Z {1} {2}' -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss'), $Level.ToUpperInvariant().PadRight(7), $clean
    try { Add-AccucutRestoreLogLine -Path $Paths.RestoreLog -Line $line }
    catch { Write-Host "restore.log could not be written: $(Hide-AccucutSecrets -Text $_.Exception.Message)" -ForegroundColor Yellow }
}

function Invoke-AccucutRestoreSql {
    <# SQL on standard input to psql as the restore role, with only PGPASSFILE of the PostgreSQL settings. The first line is a comment, so that nothing at the start of the input can be taken for SQL. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][object]$Settings,
        [Parameter(Mandatory)][string]$PassFile,
        [Parameter(Mandatory)][string]$Database,
        [Parameter(Mandatory)][string]$Sql
    )

    $arguments = @('-X', '-w', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '--host', $Settings.PgHost, '--port', [string]$Settings.PgPort, '--username', $script:RestoreDatabaseRole, '--dbname', $Database, '--file', '-')
    $result = Invoke-AccucutNative -FilePath $PsqlPath -ArgumentList $arguments -Environment @{ PGPASSFILE = $PassFile; PGCONNECT_TIMEOUT = '15' } -ClearPgEnvironment -StdIn ("-- accucut restore`n" + $Sql)
    return $result.Output
}

function Assert-AccucutRestoreDatabaseName {
    <# A database name that this module made (accucut_new_, accucut_old_ or accucut_failed_ and 14 digits): the only kind it ever renames to, drops or interpolates into SQL. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Name)

    if ($Name -cnotmatch $script:RestoreDatabasePattern) { throw "'$Name' is not the name of a database that a restore made. Nothing was done." }
}

function New-AccucutRestoreDatabase {
    <# The new, empty database of a restore: owned by accucut_owner, the way the install made the live one (no access for PUBLIC; connect for the owner, the app and the backup role). #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][object]$Settings,
        [Parameter(Mandatory)][string]$PassFile,
        [Parameter(Mandatory)][string]$Name
    )

    Assert-AccucutRestoreDatabaseName -Name $Name
    $sql = "SET ROLE NONE;`nCREATE DATABASE `"$Name`" TEMPLATE template0 ENCODING 'UTF8' OWNER accucut_owner;`nREVOKE ALL ON DATABASE `"$Name`" FROM PUBLIC;`nGRANT CONNECT ON DATABASE `"$Name`" TO accucut_owner, accucut_app, accucut_backup;`n"
    [void](Invoke-AccucutRestoreSql -PsqlPath $PsqlPath -Settings $Settings -PassFile $PassFile -Database 'postgres' -Sql $sql)
}

function Switch-AccucutRestoreDatabase {
    <#
    The swap: the last connections to the two databases are ended, then, in one transaction, the live database is renamed -Previous and -Replacement takes the live name. Both
    renames happen or neither does. Used the other way round to put the old database back (live -> accucut_failed_..., accucut_old_... -> live).
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][object]$Settings,
        [Parameter(Mandatory)][string]$PassFile,
        [Parameter(Mandatory)][string]$Replacement,
        [Parameter(Mandatory)][string]$Previous
    )

    $live = [string]$Settings.Database
    if (-not (Test-AccucutBackupSetting -Name 'database' -Value $live)) { throw 'The live database name is not allowed.' }
    Assert-AccucutRestoreDatabaseName -Name $Replacement
    Assert-AccucutRestoreDatabaseName -Name $Previous
    $sql = "SET ROLE NONE;`nSELECT count(*) FROM (SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('$live', '$Replacement') AND pid <> pg_backend_pid()) AS ended;`n" +
        "BEGIN;`nALTER DATABASE `"$live`" RENAME TO `"$Previous`";`nALTER DATABASE `"$Replacement`" RENAME TO `"$live`";`nCOMMIT;`n"
    [void](Invoke-AccucutRestoreSql -PsqlPath $PsqlPath -Settings $Settings -PassFile $PassFile -Database 'postgres' -Sql $sql)
}

function Remove-AccucutRestoreDatabase {
    <# Drops a database that a restore made (never the live one: the name must match the pattern). Open connections are ended first (WITH FORCE). #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][object]$Settings,
        [Parameter(Mandatory)][string]$PassFile,
        [Parameter(Mandatory)][string]$Name
    )

    Assert-AccucutRestoreDatabaseName -Name $Name
    [void](Invoke-AccucutRestoreSql -PsqlPath $PsqlPath -Settings $Settings -PassFile $PassFile -Database 'postgres' -Sql "SET ROLE NONE;`nDROP DATABASE IF EXISTS `"$Name`" WITH (FORCE);`n")
}

function Set-AccucutConsoleInputNoPreamble {
    <#
    Windows PowerShell 5.1 builds the standard input of a started process as a text writer in the console's input encoding, and writes that encoding's preamble when the
    process starts. In a UTF-8 console that is a byte order mark (EF BB BF), which would be put in front of the key and the dump. The encoding is switched to one with no
    preamble (OEM US, code page 437) for the moment a process is started. Returns the encoding to put back, or $null when nothing was changed (no console, or no preamble).
    #>
    [CmdletBinding()]
    param()

    try {
        $original = [System.Console]::InputEncoding
        if ($original.GetPreamble().Length -gt 0) { [System.Console]::InputEncoding = [System.Text.Encoding]::GetEncoding(437); return $original }
    }
    catch { Write-Verbose "The console input encoding could not be read or changed: $($_.Exception.Message)" }
    return $null
}

function Restore-AccucutConsoleInput {
    [CmdletBinding()]
    param([AllowNull()]$Encoding)

    if ($null -eq $Encoding) { return }
    try { [System.Console]::InputEncoding = $Encoding } catch { Write-Verbose "The console input encoding could not be put back: $($_.Exception.Message)" }
}

function Test-AccucutBackupKey {
    <#
    Does this key open this copy? Starts age as `age -d -i - <copy>`, gives it the key on standard input and reads the first 5 bytes it decrypts: a custom-format dump starts
    with PGDMP. Nothing is written anywhere, and age is stopped as soon as it has answered. -KeyBytes holds the key and a line end; the caller clears it.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$AgePath,
        [Parameter(Mandatory)][string]$CopyPath,
        [Parameter(Mandatory)][byte[]]$KeyBytes
    )

    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $AgePath
    $info.Arguments = ConvertTo-AccucutArgumentString -ArgumentList @('-d', '-i', '-', $CopyPath)
    $info.UseShellExecute = $false
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.CreateNoWindow = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    $started = $false
    $head = New-Object byte[] ($script:DumpMagicText.Length)
    $got = 0
    try {
        $console = Set-AccucutConsoleInputNoPreamble
        try { [void]$process.Start(); $started = $true } finally { Restore-AccucutConsoleInput -Encoding $console }
        $errorTask = $process.StandardError.ReadToEndAsync()
        $sink = $process.StandardInput.BaseStream
        try { $sink.Write($KeyBytes, 0, $KeyBytes.Length); $sink.Flush() } catch { Write-Verbose "age closed its input early: $($_.Exception.Message)" }
        try { $process.StandardInput.Close() } catch { Write-Verbose "age's input was already closed: $($_.Exception.Message)" }
        $source = $process.StandardOutput.BaseStream
        $deadline = (Get-Date).AddSeconds(60)
        while ($got -lt $head.Length -and (Get-Date) -lt $deadline) {
            $read = $source.ReadAsync($head, $got, $head.Length - $got)
            if (-not $read.Wait(30000)) { break }
            if ($read.Result -le 0) { break }
            $got += $read.Result
        }
        if ($got -lt $head.Length -and -not $process.HasExited) { try { [void]$process.WaitForExit(5000) } catch { Write-Verbose "age did not end: $($_.Exception.Message)" } }
        $message = ''
        if ($process.HasExited -and $got -lt $head.Length) { $message = ConvertTo-AccucutShortMessage -Text $errorTask.Result }
    }
    finally {
        if ($started -and -not $process.HasExited) { try { $process.Kill() } catch { Write-Verbose "age could not be stopped: $($_.Exception.Message)" } }
        $process.Dispose()
    }
    $ok = ($got -eq $head.Length -and [System.Text.Encoding]::ASCII.GetString($head) -eq $script:DumpMagicText)
    return [pscustomobject]@{ Ok = $ok; Message = $message }
}

function Invoke-AccucutRestorePipe {
    <#
    age -d -i - <copy> | pg_restore ... , as bytes (ADR-015 Amendment 3.1: no PowerShell pipeline, no cmd.exe). Both programs are started here with redirected streams: the key goes to
    age's standard input (never on a command line, never in a file), age's standard output is copied to pg_restore's standard input, and BOTH exit codes are checked. The decrypted
    dump is never written to disk. pg_restore runs in one transaction and stops at the first error, so a database that is not whole is never left as a result of a half-finished run.
    The password reaches pg_restore through PGPASSFILE in that child's environment only. -KeyBytes holds the key and a line end; the caller clears it.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$AgePath,
        [Parameter(Mandatory)][string]$PgRestorePath,
        [Parameter(Mandatory)][string]$CopyPath,
        [Parameter(Mandatory)][byte[]]$KeyBytes,
        [Parameter(Mandatory)][string]$DbHost,
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][string]$Database,
        [Parameter(Mandatory)][string]$PassFile
    )

    $ageInfo = New-Object System.Diagnostics.ProcessStartInfo
    $ageInfo.FileName = $AgePath
    $ageInfo.Arguments = ConvertTo-AccucutArgumentString -ArgumentList @('-d', '-i', '-', $CopyPath)
    $restoreInfo = New-Object System.Diagnostics.ProcessStartInfo
    $restoreInfo.FileName = $PgRestorePath
    $restoreInfo.Arguments = ConvertTo-AccucutArgumentString -ArgumentList @('--no-password', '--exit-on-error', '--single-transaction', '--host', $DbHost, '--port', [string]$Port, '--username', $script:RestoreDatabaseRole, '--dbname', $Database)
    Clear-AccucutPgEnvironment -EnvironmentVariables $restoreInfo.EnvironmentVariables
    $restoreInfo.EnvironmentVariables['PGPASSFILE'] = $PassFile
    $restoreInfo.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '15'
    foreach ($info in $ageInfo, $restoreInfo) {
        $info.UseShellExecute = $false
        $info.RedirectStandardInput = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $info.CreateNoWindow = $true
    }
    $age = New-Object System.Diagnostics.Process
    $age.StartInfo = $ageInfo
    $restore = New-Object System.Diagnostics.Process
    $restore.StartInfo = $restoreInfo
    $ageStarted = $false
    $restoreStarted = $false
    $copyError = $null
    try {
        $console = Set-AccucutConsoleInputNoPreamble
        try {
            [void]$age.Start(); $ageStarted = $true
            [void]$restore.Start(); $restoreStarted = $true
        }
        finally { Restore-AccucutConsoleInput -Encoding $console }
        $ageErrorTask = $age.StandardError.ReadToEndAsync()
        $restoreErrorTask = $restore.StandardError.ReadToEndAsync()
        $restoreOutputTask = $restore.StandardOutput.ReadToEndAsync()
        try {
            $keySink = $age.StandardInput.BaseStream
            $keySink.Write($KeyBytes, 0, $KeyBytes.Length)
            $keySink.Flush()
        }
        catch { $copyError = $_.Exception.Message }
        try { $age.StandardInput.Close() } catch { Write-Verbose "age's input was already closed: $($_.Exception.Message)" }
        try {
            $age.StandardOutput.BaseStream.CopyTo($restore.StandardInput.BaseStream)
            $restore.StandardInput.BaseStream.Flush()
        }
        catch {
            $copyError = $_.Exception.Message
            try { $age.Kill() } catch { Write-Verbose "age had already ended: $($_.Exception.Message)" }
        }
        finally {
            try { $restore.StandardInput.Close() } catch { Write-Verbose "pg_restore's input was already closed: $($_.Exception.Message)" }
        }
        $age.WaitForExit()
        $restore.WaitForExit()
        $restoreOutputTask.Wait()
        $ageMessage = ConvertTo-AccucutShortMessage -Text $ageErrorTask.Result
        $restoreMessage = ConvertTo-AccucutShortMessage -Text $restoreErrorTask.Result
        $ageCode = $age.ExitCode
        $restoreCode = $restore.ExitCode
    }
    finally {
        if ($ageStarted -and -not $age.HasExited) { try { $age.Kill() } catch { Write-Verbose "age could not be stopped: $($_.Exception.Message)" } }
        if ($restoreStarted -and -not $restore.HasExited) { try { $restore.Kill() } catch { Write-Verbose "pg_restore could not be stopped: $($_.Exception.Message)" } }
        $age.Dispose()
        $restore.Dispose()
    }
    if ($ageCode -ne 0) { throw (New-AccucutRestoreStop -Code 'age-failed' -Message "age could not decrypt the copy (exit code $ageCode). $ageMessage") }
    if ($restoreCode -ne 0) { throw (New-AccucutRestoreStop -Code 'pg-restore-failed' -Message "pg_restore failed with exit code $restoreCode. $restoreMessage") }
    if ($null -ne $copyError) { throw (New-AccucutRestoreStop -Code 'pipe-failed' -Message "The decrypted copy could not be passed to pg_restore: $copyError") }
}

function Assert-AccucutRestoreNotNewer {
    <#
    A copy from a NEWER release is refused (ADR-015 Amendment 3.3 R3), an older one is migrated forward. Reads the migrations that the restored database has applied (finished, not rolled back)
    and stops with the code newer-release if any is not a folder of the installed release's prisma migrations (<release>\migrate\prisma\migrations): the installed release could not run on it.
    Run on the NEW database, before the forward migration and before the swap, so the failure path puts the old database back in service.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PsqlPath,
        [Parameter(Mandatory)][object]$Settings,
        [Parameter(Mandatory)][string]$PassFile,
        [Parameter(Mandatory)][string]$Database,
        [Parameter(Mandatory)][string]$ReleaseDirectory
    )

    Assert-AccucutRestoreDatabaseName -Name $Database
    $folder = [System.IO.Path]::Combine($ReleaseDirectory, 'migrate\prisma\migrations')
    if (-not [System.IO.Directory]::Exists($folder)) { throw (New-AccucutRestoreStop -Code 'release-migrations-missing' -Message "The installed release has no migrations folder ('$folder'), so the copy cannot be compared with it.") }
    $known = @([System.IO.Directory]::GetDirectories($folder) | ForEach-Object { [System.IO.Path]::GetFileName($_) })
    $answer = Invoke-AccucutRestoreSql -PsqlPath $PsqlPath -Settings $Settings -PassFile $PassFile -Database $Database -Sql "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1;`n"
    $applied = @(([string]$answer -split "`r?`n") | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 })
    $newer = @($applied | Where-Object { $known -notcontains $_ })
    if ($newer.Count -gt 0) {
        throw (New-AccucutRestoreStop -Code 'newer-release' -Message 'This copy was made by a newer release of the portal than the one installed. Nothing was changed. Ask your IT person to install that release, then run the restore again.')
    }
}

function Get-AccucutRestoreChoice {
    <# The copies a restore offers, newest first, numbered from 1. A copy that has no matching manifest is listed but cannot be chosen. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Directory)

    $copies = @(Get-AccucutBackupCopy -Directory $Directory)
    [array]::Reverse($copies)
    $number = 0
    return @($copies | ForEach-Object { $number++; [pscustomobject]@{ Number = $number; Copy = $_ } })
}

function Invoke-AccucutRestore {
    <#
    The guided restore (AC-1 to AC-6; architecture 9.5 step table). It follows the table exactly:
      1. Lists the copies, newest first, by date and size (no file name to type). The Admin types the number of one.
      2. Checks before it touches anything: the SHA-256 of the file against its manifest, the manifest's PostgreSQL version against the server's, and the free space.
      3. Says what is lost (everything entered since the copy, the audit rows too), and asks the Admin to TYPE the copy's date. Anything but an exact match stops it.
      4. Asks for the backup key at a secure prompt, passes it to age on standard input only, and checks that it opens this copy, before anything is stopped.
      5. Stops AccucutApp and AccucutWorker; takes a safety copy of the database as it stands (an ordinary release copy, named before-restore); makes a NEW database and
         restores into it; runs the forward migrations on it; swaps the names only if all of that worked; starts the services and checks /api/health.
      6. If anything after the stop fails, the swap is not made (or is made back), the services are started again on the old database, and it says "Call your IT person".
    Every line goes to the screen and to restore.log, and one event goes to the Application log (source Accucut): outside the database, so restoring an older copy cannot erase
    the record. Every question goes through Read-AccucutHostInput or Read-AccucutKeyInput, so that Pester can answer it. Returns what it did, or throws an error with a code.
    -Program holds the full paths already checked by the caller: Age, Psql, PgRestore, PgDump, Node.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][object]$Settings,
        [Parameter(Mandatory)][hashtable]$Program,
        [Parameter(Mandatory)][string]$ReleaseDirectory,
        [Parameter(Mandatory)][string]$HealthUrl,
        [ValidateRange(5, 1800)][int]$HealthTimeoutSeconds = 180
    )

    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $stage = 'checks'
    $keyBytes = $null
    $stoppedServices = $false
    $newName = $null
    $oldName = $null
    $swapped = $false
    $passFile = $Paths.RestorePgpass
    $copyName = ''
    try {
        Write-Host ''
        Write-Host 'Restore a backup. This replaces everything in the portal with what was in the copy you choose.'
        # The first line of every run names the Windows account that ran it (ADR-015 Amendment 3.4 decision 3).
        Write-AccucutRestoreRecord -Paths $Paths -Message "Restore run by $(Get-AccucutRunningAccount)."
        $choices = @(Get-AccucutRestoreChoice -Directory $Paths.Backups)
        if ($choices.Count -eq 0) { throw (New-AccucutRestoreStop -Code 'no-copies' -Message 'There are no backup copies on this server, so there is nothing to restore.') }
        Write-Host 'Backup copies on this server, newest first (dates are UTC):'
        foreach ($choice in $choices) {
            $copy = $choice.Copy
            $date = 'unknown date   '
            if ($null -ne $copy.CreatedUtc) { $date = $copy.CreatedUtc.ToString('yyyy-MM-dd HH:mm', $inv) }
            $note = ''
            if (-not $copy.Verified) { $note = "  CANNOT BE USED ($($copy.Problem))" }
            Write-Host ('  {0,3}  {1}  {2,-8} {3,10}{4}' -f $choice.Number, $date, $copy.Reason, (Format-AccucutSize -Bytes $copy.SizeBytes), $note)
        }
        $answer = Read-AccucutHostInput -Prompt 'Type the number of the copy to restore, or press Enter to stop'
        if ([string]::IsNullOrWhiteSpace($answer)) {
            Write-AccucutRestoreRecord -Paths $Paths -Message 'Stopped by the Admin before a copy was chosen. Nothing was changed.'
            Write-AccucutRestoreEvent -EntryType Information -EventId $script:RestoreEventCancelled -Message 'A restore was started and stopped by the Admin before a copy was chosen. Nothing was changed.'
            return [pscustomobject]@{ Restored = $false; Cancelled = $true; Copy = ''; SafetyCopy = '' }
        }
        $picked = @($choices | Where-Object { [string]$_.Number -eq $answer.Trim() })
        if ($picked.Count -ne 1 -or -not $picked[0].Copy.Verified) {
            throw (New-AccucutRestoreStop -Code 'bad-choice' -Message "'$($answer.Trim())' is not the number of a copy that can be used.")
        }
        $copy = $picked[0].Copy
        $copyName = $copy.Name
        $dateText = $copy.CreatedUtc.ToString('yyyy-MM-dd', $inv)
        Write-AccucutRestoreRecord -Paths $Paths -Message "Restore started for the copy $copyName ($dateText UTC). Checking it before anything is touched."

        # ---- Checks, before anything is touched (AC-1) -------------------------------------------------------------------------------------
        $manifest = [System.IO.File]::ReadAllText($copy.ManifestPath) | ConvertFrom-Json
        $actualSha = Get-AccucutFileSha256 -Path $copy.Path
        if ($actualSha -ne ([string]$manifest.sha256).ToLowerInvariant()) {
            throw (New-AccucutRestoreStop -Code 'checksum' -Message "The copy $copyName does not match the checksum in its manifest: it has been changed or damaged since it was made. It is not used.")
        }
        $info = Get-AccucutDatabaseInfo -PsqlPath $Program.Psql -PassFile $passFile -DatabaseRole $script:RestoreDatabaseRole -DbHost $Settings.PgHost -Port $Settings.PgPort -Database $Settings.Database
        $manifestVersion = ''
        if (@($manifest.PSObject.Properties.Name) -contains 'postgresVersion') { $manifestVersion = [string]$manifest.postgresVersion }
        $version = Test-AccucutRestoreVersion -ManifestVersion $manifestVersion -ServerVersion $info.ServerVersion
        if (-not $version.Ok) { throw (New-AccucutRestoreStop -Code 'postgres-version' -Message $version.Message) }
        $space = Get-AccucutVolumeSpace -Path $Paths.Backups
        $verified = @(Get-AccucutBackupCopy -Directory $Paths.Backups | Where-Object { $_.Verified } | Microsoft.PowerShell.Utility\Select-Object -Last 1)
        $lastBytes = 0
        if ($verified.Count -eq 1) { $lastBytes = $verified[0].SizeBytes }
        $room = Test-AccucutRestoreRoom -FreeBytes $space.FreeBytes -TotalBytes $space.TotalBytes -LastCopyBytes $lastBytes -DatabaseBytes $info.SizeBytes -CopyBytes $copy.SizeBytes
        if (-not $room.Ok) { throw (New-AccucutRestoreStop -Code 'low-space' -Message $room.Message) }
        Write-Host "Checks passed: the copy matches its manifest, $($version.Message) There is enough free space."

        # ---- What will be lost, and the typed date (AC-2) ----------------------------------------------------------------------------------
        Write-Host ''
        Write-Host "You chose the copy of $dateText UTC ($($copy.Reason), $(Format-AccucutSize -Bytes $copy.SizeBytes))."
        Write-Host "Restoring it LOSES everything entered since then: every estimate, approval and master value, and the audit rows too. The portal will be stopped for a few minutes."
        Write-Host 'A safety copy of the portal as it is now is made first, so that a wrong restore can be put back.'
        $typed = Read-AccucutHostInput -Prompt "To go on, type the date of the copy exactly as shown ($dateText), or press Enter to stop"
        if ($typed -cne $dateText) {
            throw (New-AccucutRestoreStop -Code 'date-mismatch' -Message "What you typed is not the date of the copy ($dateText), so nothing is restored.")
        }

        # ---- The key (AC-5): a secure prompt, standard input only, checked against this copy before anything is stopped -----------------------
        $secure = Read-AccucutKeyInput -Prompt 'Paste the backup key (the line that starts with AGE-SECRET-) and press Enter. Nothing is shown'
        $keyText = (ConvertFrom-AccucutSecureString -Secure $secure).Trim()
        $secure.Dispose()
        Register-AccucutSecret -Value $keyText
        if ($keyText -cnotmatch $script:AgeSecretKeyPattern) {
            $keyText = $null
            throw (New-AccucutRestoreStop -Code 'bad-key-format' -Message 'What was pasted is not a backup key (it must be the one line that starts with AGE-SECRET-).')
        }
        $keyBytes = [System.Text.Encoding]::ASCII.GetBytes($keyText + "`n")
        $keyText = $null
        $keyCheck = Test-AccucutBackupKey -AgePath $Program.Age -CopyPath $copy.Path -KeyBytes $keyBytes
        if (-not $keyCheck.Ok) {
            throw (New-AccucutRestoreStop -Code 'wrong-key' -Message "This key does not open the copy $copyName (age says: $($keyCheck.Message)). Check that you pasted the key that belongs to this server's backups.")
        }
        Write-AccucutRestoreRecord -Paths $Paths -Message 'The key opens the copy. Starting the restore: the portal is stopped from now on.'

        # ---- The restore (AC-3). From here the portal is stopped, and every failure puts the old database back in service -----------------------
        $stage = 'run'
        $stamp = ([datetime]::UtcNow).ToString($script:RestoreStampFormat, $inv)
        $newName = "accucut_new_$stamp"
        $oldName = "accucut_old_$stamp"
        $failedName = "accucut_failed_$stamp"
        $safetyName = ''
        try {
            Stop-AccucutServices
            $stoppedServices = $true
            Write-AccucutRestoreRecord -Paths $Paths -Message 'AccucutApp and AccucutWorker are stopped. Taking a safety copy of the database as it is now.'
            $safety = Invoke-AccucutBackup -Paths $Paths -Settings $Settings -Program @{ PgDump = $Program.PgDump; Psql = $Program.Psql; Age = $Program.Age } -Reason release -ReleaseTag 'before-restore' -PassFile $passFile -DatabaseRole $script:RestoreDatabaseRole -SkipPrune
            $safetyName = $safety.Name
            Write-AccucutRestoreRecord -Paths $Paths -Message "Safety copy made: $safetyName. Restoring $copyName into a new database ($newName)."
            New-AccucutRestoreDatabase -PsqlPath $Program.Psql -Settings $Settings -PassFile $passFile -Name $newName
            Invoke-AccucutRestorePipe -AgePath $Program.Age -PgRestorePath $Program.PgRestore -CopyPath $copy.Path -KeyBytes $keyBytes -DbHost $Settings.PgHost -Port $Settings.PgPort -Database $newName -PassFile $passFile
            Assert-AccucutRestoreNotNewer -PsqlPath $Program.Psql -Settings $Settings -PassFile $passFile -Database $newName -ReleaseDirectory $ReleaseDirectory
            Write-AccucutRestoreRecord -Paths $Paths -Message 'The copy is restored into the new database. Running the migrations on it, so that it matches this release.'
            $password = Read-AccucutPgpassPassword -Path $passFile -Role $script:RestoreDatabaseRole
            $url = "postgresql://$($script:RestoreDatabaseRole):$([uri]::EscapeDataString($password))@$($Settings.PgHost):$($Settings.PgPort)/$newName"
            [void](Invoke-AccucutMigration -ReleaseDirectory $ReleaseDirectory -NodeExe $Program.Node -MigrateDatabaseUrl $url)
            Switch-AccucutRestoreDatabase -PsqlPath $Program.Psql -Settings $Settings -PassFile $passFile -Replacement $newName -Previous $oldName
            $swapped = $true
            Write-AccucutRestoreRecord -Paths $Paths -Message "The restored database is now the live one. The database as it was is kept for the moment as $oldName. Starting the portal."
            Start-AccucutServices
            if (-not (Wait-AccucutHealth -Url $HealthUrl -TimeoutSeconds $HealthTimeoutSeconds)) {
                throw (New-AccucutRestoreStop -Code 'health' -Message "The portal did not answer 200 at $HealthUrl within $HealthTimeoutSeconds seconds after the restore.")
            }
        }
        catch {
            $failure = $_.Exception
            $code = [string]$failure.Data['accucutCode']
            if ([string]::IsNullOrEmpty($code)) { $code = 'restore-failed' }
            $detail = ConvertTo-AccucutShortMessage -Text $failure.Message
            Write-AccucutRestoreRecord -Paths $Paths -Level Error -Message "The restore failed ($code): $detail"
            $problems = New-Object System.Collections.Generic.List[string]
            try { Stop-AccucutServices } catch { $problems.Add("the services could not be stopped for the roll back: $($_.Exception.Message)") }
            if ($swapped) {
                try {
                    Switch-AccucutRestoreDatabase -PsqlPath $Program.Psql -Settings $Settings -PassFile $passFile -Replacement $oldName -Previous $failedName
                    $swapped = $false
                    Write-AccucutRestoreRecord -Paths $Paths -Level Warning -Message "The old database is the live one again (the failed restore is kept as $failedName for your IT person)."
                }
                catch { $problems.Add("the old database could not be put back: $($_.Exception.Message)") }
            }
            elseif ($null -ne $newName) {
                try { Remove-AccucutRestoreDatabase -PsqlPath $Program.Psql -Settings $Settings -PassFile $passFile -Name $newName }
                catch { Write-AccucutRestoreRecord -Paths $Paths -Level Warning -Message "The unfinished database $newName could not be removed: $($_.Exception.Message). Your IT person can drop it." }
            }
            if (-not $swapped) {
                try { Start-AccucutServices; Write-AccucutRestoreRecord -Paths $Paths -Level Warning -Message 'The portal was started again on the old database.' }
                catch { $problems.Add("the portal could not be started again: $($_.Exception.Message)") }
            }
            $summary = "The restore of $copyName failed: $detail"
            if ($problems.Count -gt 0) { $summary += ' Also: ' + ($problems -join ' ') }
            $eventCode = 'restore-failed'
            if ($problems.Count -gt 0) { $eventCode = 'roll-back-failed' }
            $state = 'The portal is running on the old database. Nothing was lost, and a safety copy of it was made.'
            if ($problems.Count -gt 0) { $state = 'The portal may not be running: look at the services first.' }
            throw (New-AccucutRestoreStop -Code $eventCode -Message "$summary $state Call your IT person.")
        }

        # ---- Done (AC-6) -------------------------------------------------------------------------------------------------------------------
        $removedOld = $false
        try { Remove-AccucutRestoreDatabase -PsqlPath $Program.Psql -Settings $Settings -PassFile $passFile -Name $oldName; $removedOld = $true }
        catch { Write-AccucutRestoreRecord -Paths $Paths -Level Warning -Message "The old database $oldName could not be removed: $($_.Exception.Message). It holds the data as it was before the restore; your IT person can drop it. The safety copy $safetyName is in the backups folder." }
        $done = "Restore finished: the portal runs on the copy of $dateText UTC ($copyName). The portal as it was before is kept as the safety copy $safetyName."
        Write-AccucutRestoreRecord -Paths $Paths -Message $done
        Write-AccucutRestoreEvent -EntryType Information -EventId $script:RestoreEventDone -Message $done
        Write-Host 'Open the portal and check that what you expect is there.'
        return [pscustomobject]@{ Restored = $true; Cancelled = $false; Copy = $copyName; SafetyCopy = $safetyName; OldDatabaseRemoved = $removedOld }
    }
    catch {
        $failure = $_.Exception
        $code = [string]$failure.Data['accucutCode']
        $eventId = $script:RestoreEventChecksFailed
        $suffix = ' Nothing was changed, and the portal is still running on its old database. Call your IT person.'
        if ($stage -eq 'run') {
            $eventId = $script:RestoreEventFailed
            $suffix = ''
            if ($code -eq 'roll-back-failed') { $eventId = $script:RestoreEventFailedAfterSwap }
        }
        $message = (Hide-AccucutSecrets -Text $failure.Message)
        if ($stage -ne 'run') { Write-AccucutRestoreRecord -Paths $Paths -Level Error -Message "The restore stopped ($code): $message$suffix" }
        Write-AccucutRestoreEvent -EntryType Error -EventId $eventId -Message "The restore of '$copyName' stopped (code $code): $message$suffix"
        $stop = New-AccucutRestoreStop -Code $code -Message ($message + $suffix)
        throw $stop
    }
    finally {
        if ($null -ne $keyBytes) { [array]::Clear($keyBytes, 0, $keyBytes.Length) }
    }
}

#endregion

#region The endpoint group: inert since ADR-015 Amendment 3.4 (no install creates it); removed after G8

# The name of the local group that an earlier design (a JEA endpoint) used. No install creates it any more. The scripts still look for it, and with no group every check
# they make is as strict as before (ADR-015 Amendment 3.4 decision 4).
$script:AdminGroupName = 'AccucutAdminRunAs'

function Get-AccucutAdminGroupSid {
    <# The SID of the local group named AccucutAdminRunAs, or $null when there is no such group (none is made since ADR-015 Amendment 3.4). #>
    [CmdletBinding()]
    param()

    try {
        $account = [System.Security.Principal.NTAccount]::new([string]$env:COMPUTERNAME, $script:AdminGroupName)
        return $account.Translate([System.Security.Principal.SecurityIdentifier]).Value
    }
    catch {
        return $null
    }
}

function Write-AccucutRestoreConfig {
    <#
    Writes config\restore.pgpass: the connection line of the database role accucut_restore (host:port:*:accucut_restore:password; the database field is * because a restore connects to
    the maintenance database and to the new one). The password is invented by the install. The file is made with FileMode.CreateNew, locked to Administrators and SYSTEM while it is
    still empty, and only then filled. Administrators and SYSTEM only (ADR-015 Amendment 3.4).
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][object]$Paths,
        [Parameter(Mandatory)][string]$RestorePassword,
        [Parameter(Mandatory)][string]$PgHost,
        [Parameter(Mandatory)][int]$PgPort
    )

    foreach ($pair in @(@('pgHost', $PgHost), @('pgPort', $PgPort))) {
        if (-not (Test-AccucutBackupSetting -Name $pair[0] -Value $pair[1])) { throw "The value for '$($pair[0])' is not allowed in the restore settings." }
    }
    Register-AccucutSecret -Value $RestorePassword
    $escaped = $RestorePassword.Replace('\', '\\').Replace(':', '\:')
    $line = '{0}:{1}:*:{2}:{3}' -f $PgHost, $PgPort, $script:RestoreDatabaseRole, $escaped
    $stream = [System.IO.FileStream]::new($Paths.RestorePgpass, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $stream.Dispose()
    Set-AccucutLockedFileAcl -Path $Paths.RestorePgpass
    [System.IO.File]::WriteAllText($Paths.RestorePgpass, $line + "`n", [System.Text.UTF8Encoding]::new($false))
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
    'Assert-AccucutProxyOrigin', 'Get-AccucutHttpResponse', 'Test-AccucutProxyRedirect', 'Test-AccucutProxyHeaders', 'Test-AccucutClientAddressSeen', 'Write-AccucutProxyCheckResult', 'Invoke-AccucutProxyChecks',
    'Grant-AccucutFolderAccess', 'Grant-AccucutInstallFolderAccess',
    'Assert-AccucutFreeSpace', 'Assert-AccucutServiceIdentity', 'Set-AccucutServiceIdentity', 'Initialize-AccucutServiceFiles', 'Invoke-AccucutMigration',
    'Get-AccucutBackupAccountSid', 'Get-AccucutRightHolder', 'Grant-AccucutBatchLogonRight', 'Revoke-AccucutBatchLogonRight', 'Test-AccucutBatchRightPolicy', 'Test-AccucutModuleLogging', 'Test-AccucutEventSource', 'New-AccucutEventSource', 'Register-AccucutEventSource', 'Get-AccucutRandomNumber', 'New-AccucutComplexPassword', 'Register-AccucutBackupTask', 'Remove-AccucutBackupAccount', 'Wait-AccucutBackupTask', 'Test-AccucutLogonTypeFailure',
    'Grant-AccucutBackupRootAccess', 'New-AccucutBackupFolder', 'Set-AccucutBackupFileAcl', 'Write-AccucutBackupFile', 'Test-AccucutBackupSetting', 'Read-AccucutBackupSettings', 'Write-AccucutBackupConfig',
    'Get-AccucutVolumeRoot', 'Get-AccucutVolumeSpace', 'Format-AccucutSize', 'Test-AccucutBackupRoom', 'ConvertFrom-AccucutBackupStamp', 'Get-AccucutBackupCopy', 'Get-AccucutBackupKeepSet', 'Get-AccucutBackupPruneCandidate',
    'Remove-AccucutBackupCopy', 'Remove-AccucutStaleBackupPart', 'ConvertTo-AccucutShortMessage', 'Invoke-AccucutBackupPipe', 'Add-AccucutJobRun', 'Get-AccucutDatabaseInfo', 'Write-AccucutBackupManifest', 'Invoke-AccucutBackupPrune',
    'Invoke-AccucutBackup', 'Invoke-AccucutClearCopies',
    'New-AccucutRestoreStop', 'Read-AccucutKeyInput', 'ConvertFrom-AccucutSecureString', 'Read-AccucutPgpassPassword', 'Read-AccucutInstallState', 'Test-AccucutRestoreVersion', 'Test-AccucutRestoreRoom',
    'Write-AccucutRestoreEvent', 'Set-AccucutLockedFileAcl', 'Test-AccucutRestoreLogFile', 'Add-AccucutRestoreLogLine', 'Write-AccucutRestoreRecord', 'Invoke-AccucutRestoreSql', 'Assert-AccucutRestoreDatabaseName',
    'New-AccucutRestoreDatabase', 'Switch-AccucutRestoreDatabase', 'Remove-AccucutRestoreDatabase', 'Set-AccucutConsoleInputNoPreamble', 'Restore-AccucutConsoleInput', 'Test-AccucutBackupKey', 'Invoke-AccucutRestorePipe',
    'Assert-AccucutRestoreNotNewer', 'Get-AccucutRestoreChoice', 'Invoke-AccucutRestore',
    'Get-AccucutAdminGroupSid', 'Write-AccucutRestoreConfig', 'Get-AccucutRunningAccount'
)
