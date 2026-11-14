<#
.SYNOPSIS
  CI only (stage 13): makes a second release zip from the first one, with another tag, so that update.ps1 has something to update to.
  With -BreakApp the new release is deliberately broken (its web server exits at once), to prove that update.ps1 rolls back.
  Not part of the release package, and never run on a server.
.PARAMETER SourceZip
  The zip built by scripts/package-windows.ps1.
.PARAMETER Tag
  The new release tag.
.PARAMETER OutputDirectory
  Where the new zip and its .sha256 file go.
.PARAMETER BreakApp
  Replace app\server.js with a program that exits at once.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SourceZip,
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')][string]$Tag,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [switch]$BreakApp
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
Add-Type -AssemblyName System.IO.Compression.FileSystem

$output = [System.IO.Path]::GetFullPath($OutputDirectory)
$work = Join-Path $output "derive-$Tag"
if (Test-Path -LiteralPath $work) { cmd.exe /c rd /s /q "\\?\$work" }
New-Item -ItemType Directory -Path $work -Force | Out-Null

[System.IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path -LiteralPath $SourceZip).Path, $work)

$releaseFile = Join-Path $work 'release.json'
$release = Get-Content -LiteralPath $releaseFile -Raw | ConvertFrom-Json
$release.tag = $Tag
[System.IO.File]::WriteAllText($releaseFile, ($release | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))

if ($BreakApp) {
    $server = Join-Path $work 'app\server.js'
    if (-not (Test-Path -LiteralPath $server)) { throw "No app\server.js in the source zip." }
    [System.IO.File]::WriteAllText($server, "// Stage 13 test release: broken on purpose, so that the update has to roll back.`nprocess.exit(1);`n", (New-Object System.Text.UTF8Encoding($false)))
}

$zipName = "accucut-$Tag-win-x64.zip"
$zipPath = Join-Path $output $zipName
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($work, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText("$zipPath.sha256", "$hash  $zipName`n", (New-Object System.Text.ASCIIEncoding))
cmd.exe /c rd /s /q "\\?\$work"
Write-Output $zipPath
