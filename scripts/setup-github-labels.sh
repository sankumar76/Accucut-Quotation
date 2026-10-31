#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# setup-github-labels.sh — create the labels the agent team uses (idempotent).
# Requires the GitHub CLI (gh) authenticated with access to the repository.
#   scripts/setup-github-labels.sh                # current repo
#   scripts/setup-github-labels.sh owner/repo
# -----------------------------------------------------------------------------
set -euo pipefail
REPO_ARG=()
[ -n "${1:-}" ] && REPO_ARG=(--repo "$1")

label() { gh label create "$1" --color "$2" --description "$3" --force "${REPO_ARG[@]}" >/dev/null && echo "✓ $1"; }

label "ai-delivery"                         "5319e7" "Created or managed by the AI delivery team"
label "feature"                             "1d76db" "Story implementation PR"
label "documentation"                       "0075ca" "Docs-only change"
label "bug"                                 "d73a4a" "Defect found by QA"
label "sev-1"                               "b60205" "Severity 1 – critical"
label "sev-2"                               "d93f0b" "Severity 2 – major"
label "sev-3"                               "fbca04" "Severity 3 – moderate"
label "sev-4"                               "c2e0c6" "Severity 4 – minor"
label "tech-debt"                           "a2eeef" "Deferred improvement"
label "follow-up"                           "bfdadc" "Out-of-scope improvement noticed during a story"
label "architecture"                        "0e8a16" "Architecture risk or decision follow-up"
label "review:standards-changes-requested"  "e99695" "Standards reviewer requests changes"
label "review:standards-approved"           "c5def5" "Standards reviewer approves"
label "review:quality-changes-requested"    "e99695" "Quality reviewer requests changes"
label "review:quality-approved"             "c5def5" "Quality reviewer approves"
label "review:performance-changes-requested" "e99695" "Performance reviewer requests changes"
label "review:performance-approved"         "c5def5" "Performance reviewer approves"
label "gate:g6-pass"                        "0e8a16" "Peer review gate passed"
label "gate:g6-changes"                     "d93f0b" "Peer review gate: changes required"
label "gate:g7-pass"                        "0e8a16" "QA gate passed"
label "gate:g7-rejected"                    "d93f0b" "QA gate: rejected"
label "awaiting-human-merge"                "fef2c0" "Approved by the AI team; human merge required"
echo "Labels ready."
