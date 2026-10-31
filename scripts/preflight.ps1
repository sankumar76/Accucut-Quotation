<#
  preflight.ps1 - Windows PowerShell version of preflight.sh.
  Verifies everything the agent team needs before a run. Stops with a clear
  message on the first blocking problem.

  Usage (from the repository folder, in PowerShell):
    .\scripts\preflight.ps1
#>
$ErrorActionPreference = 'Continue'

function Fail([string]$msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; exit 1 }
function Ok([string]$msg)   { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

# 1. Inside a git repository
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "Git is not installed. Install Git for Windows: https://git-scm.com/downloads/win" }
$root = git rev-parse --show-toplevel 2>$null
if (-not $root) { Fail "Run this inside your project's git repository folder." }
Set-Location $root

# 2. Git Bash (Claude Code uses it on Windows to run the kit's guard hooks)
$bashCandidates = @()
if ($env:CLAUDE_CODE_GIT_BASH_PATH) { $bashCandidates += $env:CLAUDE_CODE_GIT_BASH_PATH }
if ($env:ProgramFiles) { $bashCandidates += (Join-Path $env:ProgramFiles 'Git\bin\bash.exe') }
if (${env:ProgramFiles(x86)}) { $bashCandidates += (Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe') }
if ($env:LOCALAPPDATA) { $bashCandidates += (Join-Path $env:LOCALAPPDATA 'Programs\Git\bin\bash.exe') }
$gitBash = $bashCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($IsLinux -or $IsMacOS) { Ok "Not Windows - Git Bash check skipped" }
elseif ($gitBash) { Ok "Git Bash found: $gitBash" }
else { Fail "Git Bash not found. Install Git for Windows (https://git-scm.com/downloads/win). The kit's safety hooks need it." }

# 3. Claude Code
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Fail "Claude Code not found. Install it with:  irm https://claude.ai/install.ps1 | iex" }
$ver = (claude --version 2>$null | Select-Object -First 1)
Ok "Claude Code: $ver"

# 4. JSON parser for the guard hooks
if ((Get-Command jq -ErrorAction SilentlyContinue) -or (Get-Command python3 -ErrorAction SilentlyContinue)) { Ok "JSON parser available" }
else { Fail "Install jq (needed by the safety hooks):  winget install jqlang.jq   - then open a new PowerShell window." }

# 5. GitHub token
if (-not $env:GITHUB_PAT) { Fail "GITHUB_PAT is not set. Run:  setx GITHUB_PAT `"your-token`"  then open a new PowerShell window." }
Ok "GITHUB_PAT set"

# 6. GitHub remote
$origin = git remote get-url origin 2>$null
if (-not $origin) { Fail "No 'origin' remote configured for this repository." }
Ok "origin: $origin"

# 7. Clean working tree / placeholders
if (git status --porcelain) { Warn "You have uncommitted changes - commit or stash them first; agents branch from the main branch." }
if (Select-String -Path 'CLAUDE.md' -SimpleMatch '<<' -Quiet -ErrorAction SilentlyContinue) {
  Warn "CLAUDE.md still contains <<placeholders>> - autopilot will stop and list them."
}

# 8. MCP connections
$mcp = (claude mcp list 2>&1 | Out-String)
if ($LASTEXITCODE -eq 0 -and $mcp) {
  if ($mcp -match '(?i)atlassian') { Ok "Atlassian MCP configured" } else { Fail "Atlassian MCP missing - check .mcp.json." }
  if ($mcp -match '(?i)github')    { Ok "GitHub MCP configured" }    else { Fail "GitHub MCP missing - check .mcp.json." }
  $atl = ($mcp -split "`n" | Where-Object { $_ -match '(?i)atlassian' }) -join ' '
  if ($atl -match '(?i)needs auth|not authenticated|failed') {
    Fail "Atlassian MCP needs authentication: run 'claude', type /mcp, choose atlassian, then Authenticate."
  }
} else {
  Warn "Could not list MCP servers; continuing."
}

Write-Host "Preflight passed." -ForegroundColor Green
exit 0
