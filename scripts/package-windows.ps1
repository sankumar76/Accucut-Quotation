<#
.SYNOPSIS
  Builds the Windows release package, accucut-<tag>-win-x64.zip, and its SHA-256 (STORY-10.04; ADR-015; architecture section 9.9; test strategy 10.8).

.DESCRIPTION
  Run by CI stage 13 on windows-latest after `npm ci` and `npm run build`. Windows PowerShell 5.1 or later. The server never runs npm, so everything it
  needs is in the zip:

    app\        the Next.js standalone server (server.js, its node_modules, .next\static, public) and bootstrap-admin.mjs
    worker\     main.mjs, the worker bundled into one file
    migrate\    prisma\ (schema and migrations), prisma.config.mjs, ensure-seed-version.mjs, and node_modules\ holding only the Prisma CLI and what it needs
    sql\        create-roles.psql, the one SQL source of the two database roles
    bin\        winsw.exe (WinSW 2.12.0), age.exe, age-keygen.exe, SHA256SUMS.txt, the licences
    services\   the WinSW service files
    install.ps1, update.ps1, clean-logs.ps1, AccucutOps.psm1, .env.example, values.example.txt, README.md, release.json

  WinSW and age are checked against the SHA-256 pinned in deploy\windows\tools.psd1 before they go in. The script stops if the package would hold a
  .env file or any other settings file.

.PARAMETER Tag
  The release tag, for example 0.1.0-a1b2c3d. Letters, digits, dot, dash and underscore; it names the release folder on the server.
.PARAMETER ToolsDirectory
  A folder that holds WinSW-x64.exe and the age zip named in tools.psd1 (downloaded by the caller).
.PARAMETER OutputDirectory
  Where the zip, its .sha256 file and a staging folder go. Default dist.
.PARAMETER Commit
  The commit the build is from, recorded in release.json.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')][string]$Tag,
    [Parameter(Mandatory)][string]$ToolsDirectory,
    [string]$OutputDirectory = 'dist',
    [string]$Commit = ''
)

Set-StrictMode -Version 2.0

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Copy-PackageFolder {
    <# robocopy (no 260-character limit); exit codes below 8 are success. Never copies a .env file other than .env.example. #>
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [string[]]$ExcludeDirectories = @()
    )

    $arguments = @($Source, $Destination, '/E', '/R:2', '/W:2', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XF', '.env', '.env.local', '.env.production', '.env.development')
    if ($ExcludeDirectories.Count -gt 0) { $arguments += @('/XD') + $ExcludeDirectories }
    & "$env:SystemRoot\System32\robocopy.exe" @arguments | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying '$Source' failed (robocopy exit code $LASTEXITCODE)." }
    $global:LASTEXITCODE = 0
}

function Resolve-PackageDirectory {
    <# Finds the folder of dependency $Name for the package in $FromDirectory by Node's rule: its own node_modules, then every parent's. #>
    param(
        [Parameter(Mandatory)][string]$FromDirectory,
        [Parameter(Mandatory)][string]$Name
    )

    $directory = $FromDirectory
    while ($true) {
        $candidate = Join-Path (Join-Path $directory 'node_modules') $Name.Replace('/', '\')
        if (Test-Path -LiteralPath (Join-Path $candidate 'package.json')) { return $candidate }
        $parent = Split-Path -Parent $directory
        if ([string]::IsNullOrEmpty($parent) -or $parent -eq $directory) { return $null }
        $directory = $parent
    }
}

function Copy-PackageClosure {
    <#
    Copies a package and everything it needs at run time (dependencies and the optional ones that are installed), each folder to the same place
    under the destination's node_modules that it has under the repository's. Used for the Prisma CLI, which is a development dependency and so is
    not in the standalone output.
    #>
    param(
        [Parameter(Mandatory)][string]$RepositoryRoot,
        [Parameter(Mandatory)][string[]]$Name,
        [Parameter(Mandatory)][string]$Destination
    )

    $repositoryModules = [System.IO.Path]::GetFullPath((Join-Path $RepositoryRoot 'node_modules')).TrimEnd('\') + '\'
    $visited = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
    $queue = New-Object 'System.Collections.Generic.Queue[string]'
    foreach ($item in $Name) {
        $folder = Resolve-PackageDirectory -FromDirectory $RepositoryRoot -Name $item
        if ($null -eq $folder) { throw "The package '$item' is not installed under '$RepositoryRoot\node_modules'." }
        $queue.Enqueue($folder)
    }
    $count = 0
    while ($queue.Count -gt 0) {
        $folder = [System.IO.Path]::GetFullPath($queue.Dequeue()).TrimEnd('\')
        if (-not $visited.Add($folder)) { continue }
        if (-not ($folder + '\').StartsWith($repositoryModules, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Package folder '$folder' is outside the repository's node_modules." }
        $relative = $folder.Substring($repositoryModules.Length)
        Copy-PackageFolder -Source $folder -Destination (Join-Path (Join-Path $Destination 'node_modules') $relative) -ExcludeDirectories @('node_modules')
        $count++
        $json = Get-Content -LiteralPath (Join-Path $folder 'package.json') -Raw | ConvertFrom-Json
        foreach ($field in 'dependencies', 'optionalDependencies') {
            $property = $json.PSObject.Properties[$field]
            if ($null -eq $property -or $null -eq $property.Value) { continue }
            foreach ($dependency in @($property.Value.PSObject.Properties | ForEach-Object { $_.Name })) {
                $found = Resolve-PackageDirectory -FromDirectory $folder -Name $dependency
                if ($null -ne $found) { $queue.Enqueue($found) }
                elseif ($field -eq 'dependencies') { throw "The dependency '$dependency' of '$($json.name)' is not installed." }
            }
        }
    }
    return $count
}

function New-EsbuildBundle {
    <# One TypeScript entry point to one ES module file. Node's own modules and the named packages stay outside the file. #>
    param(
        [Parameter(Mandatory)][string]$Entry,
        [Parameter(Mandatory)][string]$OutFile,
        [string[]]$External = @()
    )

    $esbuild = Join-Path $script:RepoRoot 'node_modules\esbuild\bin\esbuild'
    # A bundle of CommonJS packages inside an ES module needs `require`: this line gives it one.
    $banner = "import { createRequire as accucutCreateRequire } from 'node:module'; const require = accucutCreateRequire(import.meta.url);"
    $arguments = @($esbuild, $Entry, '--bundle', '--platform=node', '--format=esm', '--target=node22', '--conditions=react-server', "--outfile=$OutFile", "--banner:js=$banner", '--external:pg-native', '--log-level=warning')
    foreach ($package in $External) { $arguments += "--external:$package" }
    & node @arguments
    if ($LASTEXITCODE -ne 0) { throw "esbuild failed for '$Entry' (exit code $LASTEXITCODE)." }
    if (-not (Test-Path -LiteralPath $OutFile)) { throw "esbuild wrote no file for '$Entry'." }
}

function Get-FileSha256 {
    param([Parameter(Mandatory)][string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-PinnedTool {
    <# The downloaded file must have exactly the SHA-256 pinned in tools.psd1. #>
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Expected,
        [Parameter(Mandatory)][string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label was not found at '$Path'." }
    $actual = Get-FileSha256 -Path $Path
    if ($actual -ne $Expected.ToLowerInvariant()) { throw "$Label does not match its pinned SHA-256 (expected $($Expected.ToLowerInvariant()), the file is $actual)." }
}

function New-AccucutPackage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Tag,
        [Parameter(Mandatory)][string]$ToolsDirectory,
        [string]$OutputDirectory = 'dist',
        [string]$Commit = ''
    )

    $ErrorActionPreference = 'Stop'
    $repo = $script:RepoRoot
    $standalone = Join-Path $repo '.next\standalone'
    if (-not (Test-Path -LiteralPath (Join-Path $standalone 'server.js'))) { throw "No standalone build found ('$standalone\server.js'). Run `npm run build` first." }
    if (-not (Test-Path -LiteralPath (Join-Path $repo 'src\generated\prisma'))) { throw "The Prisma client is not generated. Run `npm run build` first." }

    $tools = Import-PowerShellDataFile -LiteralPath (Join-Path $repo 'deploy\windows\tools.psd1')
    $winswSource = Join-Path $ToolsDirectory $tools.WinSw.File
    $ageZip = Join-Path $ToolsDirectory $tools.Age.File
    Assert-PinnedTool -Path $winswSource -Expected $tools.WinSw.Sha256 -Label "WinSW $($tools.WinSw.Version)"
    Assert-PinnedTool -Path $ageZip -Expected $tools.Age.Sha256 -Label "age $($tools.Age.Version)"

    # A relative output folder is relative to the folder the script was started in.
    $output = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $OutputDirectory))
    $stage = Join-Path $output 'stage'
    if (Test-Path -LiteralPath $stage) { cmd.exe /c rd /s /q "\\?\$stage" }
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    $zipName = "accucut-$Tag-win-x64.zip"
    $zipPath = Join-Path $output $zipName

    # app: the standalone server, its static files and the public folder.
    Write-Host 'Package: app'
    $app = Join-Path $stage 'app'
    Copy-PackageFolder -Source $standalone -Destination $app
    Copy-PackageFolder -Source (Join-Path $repo '.next\static') -Destination (Join-Path $app '.next\static')
    if (Test-Path -LiteralPath (Join-Path $repo 'public')) { Copy-PackageFolder -Source (Join-Path $repo 'public') -Destination (Join-Path $app 'public') }
    New-EsbuildBundle -Entry 'scripts/bootstrap-admin.ts' -OutFile (Join-Path $app 'bootstrap-admin.mjs') -External @('@node-rs/argon2')

    # worker
    Write-Host 'Package: worker'
    New-EsbuildBundle -Entry 'src/worker/main.ts' -OutFile (Join-Path $stage 'worker\main.mjs')

    # migrate: the schema and migrations, the Prisma CLI and what it needs, the seed step.
    Write-Host 'Package: migrate'
    $migrate = Join-Path $stage 'migrate'
    Copy-PackageFolder -Source (Join-Path $repo 'prisma\migrations') -Destination (Join-Path $migrate 'prisma\migrations')
    New-Item -ItemType Directory -Path (Join-Path $migrate 'prisma') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo 'prisma\schema.prisma') -Destination (Join-Path $migrate 'prisma\schema.prisma')
    $config = @(
        "import { defineConfig } from 'prisma/config';",
        '',
        '// Written by scripts/package-windows.ps1. The owner role''s connection string comes from the environment of the one process that runs the migrations.',
        'export default defineConfig({',
        "  schema: 'prisma/schema.prisma',",
        "  migrations: { path: 'prisma/migrations' },",
        "  datasource: { url: process.env['MIGRATE_DATABASE_URL'] ?? '' },",
        '});',
        ''
    ) -join "`n"
    [System.IO.File]::WriteAllText((Join-Path $migrate 'prisma.config.mjs'), $config, (New-Object System.Text.UTF8Encoding($false)))
    $closure = Copy-PackageClosure -RepositoryRoot $repo -Name @('prisma') -Destination $migrate
    Write-Host "Package: migrate\node_modules holds $closure packages"
    New-EsbuildBundle -Entry 'scripts/ensure-seed-version.ts' -OutFile (Join-Path $migrate 'ensure-seed-version.mjs')

    # sql
    New-Item -ItemType Directory -Path (Join-Path $stage 'sql') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo 'deploy\db\create-roles.psql') -Destination (Join-Path $stage 'sql\create-roles.psql')

    # bin: WinSW and age, with their checksums and licences.
    Write-Host 'Package: bin'
    $bin = Join-Path $stage 'bin'
    New-Item -ItemType Directory -Path $bin -Force | Out-Null
    Copy-Item -LiteralPath $winswSource -Destination (Join-Path $bin 'winsw.exe')
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ageZip)
    try {
        foreach ($entry in $archive.Entries) {
            $leaf = [System.IO.Path]::GetFileName($entry.FullName)
            if ($leaf -in @('age.exe', 'age-keygen.exe')) { [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $bin $leaf), $true) }
            elseif ($leaf -eq 'LICENSE') { [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $bin 'LICENSE-age.txt'), $true) }
        }
    }
    finally {
        $archive.Dispose()
    }
    foreach ($required in 'age.exe', 'age-keygen.exe') { if (-not (Test-Path -LiteralPath (Join-Path $bin $required))) { throw "The age zip holds no $required." } }
    $sums = foreach ($file in 'winsw.exe', 'age.exe', 'age-keygen.exe') { "$(Get-FileSha256 -Path (Join-Path $bin $file))  $file" }
    [System.IO.File]::WriteAllText((Join-Path $bin 'SHA256SUMS.txt'), (($sums -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding($false)))
    $third = @(
        'Third-party programs in bin\ (ADR-015):',
        "  winsw.exe  WinSW $($tools.WinSw.Version), $($tools.WinSw.Licence) licence, https://github.com/winsw/winsw",
        "  age.exe, age-keygen.exe  age $($tools.Age.Version), $($tools.Age.Licence) licence, see LICENSE-age.txt, https://github.com/FiloSottile/age",
        'Their SHA-256 values are in SHA256SUMS.txt and in deploy\windows\tools.psd1 of the source.',
        ''
    ) -join "`n"
    [System.IO.File]::WriteAllText((Join-Path $bin 'THIRD-PARTY.txt'), $third, (New-Object System.Text.UTF8Encoding($false)))

    # scripts, service files, templates
    Write-Host 'Package: scripts'
    $windows = Join-Path $repo 'deploy\windows'
    foreach ($file in 'install.ps1', 'update.ps1', 'clean-logs.ps1', 'AccucutOps.psm1', 'values.example.txt', 'README.md', 'tools.psd1') {
        Copy-Item -LiteralPath (Join-Path $windows $file) -Destination (Join-Path $stage $file)
    }
    Copy-PackageFolder -Source (Join-Path $windows 'services') -Destination (Join-Path $stage 'services')
    Copy-Item -LiteralPath (Join-Path $repo '.env.example') -Destination (Join-Path $stage '.env.example')

    $info = [ordered]@{
        tag = $Tag; commit = $Commit; builtAt = (Get-Date).ToUniversalTime().ToString('o')
        node = '22.12 or later'; postgres = '17'; winsw = $tools.WinSw.Version; age = $tools.Age.Version
    }
    [System.IO.File]::WriteAllText((Join-Path $stage 'release.json'), ($info | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))

    # The package must hold no settings file. Only .env.example is allowed.
    $settingsFiles = @(Get-ChildItem -LiteralPath $stage -Recurse -Force -File -Filter '.env*' | Where-Object { $_.Name -ne '.env.example' })
    if ($settingsFiles.Count -gt 0) { throw "The package would hold a settings file: $($settingsFiles[0].FullName). Refusing to build it." }

    # zip and checksum
    Write-Host 'Package: zip'
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    $hash = Get-FileSha256 -Path $zipPath
    [System.IO.File]::WriteAllText("$zipPath.sha256", "$hash  $zipName`n", (New-Object System.Text.ASCIIEncoding))
    $megabytes = [math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 1)
    Write-Host "Package: $zipPath ($megabytes MB) SHA-256 $hash"
    return [pscustomobject]@{ Zip = $zipPath; Sha256File = "$zipPath.sha256"; Sha256 = $hash; Stage = $stage }
}

if ($MyInvocation.InvocationName -ne '.') {
    $result = New-AccucutPackage -Tag $Tag -ToolsDirectory $ToolsDirectory -OutputDirectory $OutputDirectory -Commit $Commit
    Write-Output $result.Zip
}
