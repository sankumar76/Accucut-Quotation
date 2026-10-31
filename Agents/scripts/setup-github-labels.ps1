<#
  setup-github-labels.ps1 - Windows PowerShell version of setup-github-labels.sh.
  Creates the labels the agent team uses (safe to run more than once).
  Requires the GitHub CLI (gh), signed in with access to the repository:
    winget install GitHub.cli
    gh auth login

  Usage:
    .\scripts\setup-github-labels.ps1                 # current repository
    .\scripts\setup-github-labels.ps1 owner/repo
#>
param([Parameter(Position = 0)][string]$Repo = "")
$ErrorActionPreference = 'Continue'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "[FAIL] GitHub CLI not found. Install it with: winget install GitHub.cli  then run: gh auth login" -ForegroundColor Red
  exit 1
}

$labels = @(
  @('ai-delivery',                          '5319e7', 'Created or managed by the AI delivery team'),
  @('feature',                              '1d76db', 'Story implementation PR'),
  @('documentation',                        '0075ca', 'Docs-only change'),
  @('bug',                                  'd73a4a', 'Defect found by QA'),
  @('sev-1',                                'b60205', 'Severity 1 - critical'),
  @('sev-2',                                'd93f0b', 'Severity 2 - major'),
  @('sev-3',                                'fbca04', 'Severity 3 - moderate'),
  @('sev-4',                                'c2e0c6', 'Severity 4 - minor'),
  @('tech-debt',                            'a2eeef', 'Deferred improvement'),
  @('follow-up',                            'bfdadc', 'Out-of-scope improvement noticed during a story'),
  @('architecture',                         '0e8a16', 'Architecture risk or decision follow-up'),
  @('review:standards-changes-requested',   'e99695', 'Standards reviewer requests changes'),
  @('review:standards-approved',            'c5def5', 'Standards reviewer approves'),
  @('review:quality-changes-requested',     'e99695', 'Quality reviewer requests changes'),
  @('review:quality-approved',              'c5def5', 'Quality reviewer approves'),
  @('review:performance-changes-requested', 'e99695', 'Performance reviewer requests changes'),
  @('review:performance-approved',          'c5def5', 'Performance reviewer approves'),
  @('gate:g6-pass',                         '0e8a16', 'Peer review gate passed'),
  @('gate:g6-changes',                      'd93f0b', 'Peer review gate: changes required'),
  @('gate:g7-pass',                         '0e8a16', 'QA gate passed'),
  @('gate:g7-rejected',                     'd93f0b', 'QA gate: rejected'),
  @('awaiting-human-merge',                 'fef2c0', 'Approved by the AI team; human merge required')
)

$failed = 0
foreach ($l in $labels) {
  $ghArgs = @('label', 'create', $l[0], '--color', $l[1], '--description', $l[2], '--force')
  if ($Repo) { $ghArgs += @('--repo', $Repo) }
  & gh @ghArgs | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host "[ OK ] $($l[0])" -ForegroundColor Green }
  else { Write-Host "[FAIL] $($l[0])" -ForegroundColor Red; $failed++ }
}
if ($failed -gt 0) { Write-Host "$failed label(s) failed - check 'gh auth status' and the repository name." -ForegroundColor Red; exit 1 }
Write-Host "Labels ready." -ForegroundColor Green
