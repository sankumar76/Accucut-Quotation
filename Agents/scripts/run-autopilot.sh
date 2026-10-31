#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# run-autopilot.sh — run the AI delivery team unattended.
#
#   scripts/run-autopilot.sh "Customers need a portal to view invoices and raise disputes..."
#   scripts/run-autopilot.sh --file requirements/invoice-portal.md
#   scripts/run-autopilot.sh                # resume (e.g. after a human approval in Jira)
#
# Environment:
#   GITHUB_PAT        GitHub token used by the GitHub MCP server (required)
#   PERMISSION_MODE   Claude Code permission mode for the run (default: auto)
#                     auto     – background classifier approves safe actions (recommended)
#                     dontAsk  – only actions allowed in .claude/settings.json run; others are denied
#   MAX_BUDGET_NOTE   free text logged with the run (e.g. cost centre)
#
# Logs are written to .claude/runs/<timestamp>.log (git-ignored).
# -----------------------------------------------------------------------------
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

REQ=""
if [ "${1:-}" = "--file" ]; then
  [ -f "${2:-}" ] || { echo "File not found: ${2:-}" >&2; exit 1; }
  REQ="the requirement document at ${2}"
elif [ -n "${1:-}" ]; then
  REQ="$1"
fi

bash scripts/preflight.sh

MODE="${PERMISSION_MODE:-auto}"
mkdir -p .claude/runs
LOG=".claude/runs/$(date +%Y%m%d-%H%M%S).log"

echo "▶ Autopilot starting (permission mode: $MODE) — log: $LOG"
echo "  note: ${MAX_BUDGET_NOTE:-none}" | tee -a "$LOG"

claude -p \
  --agent orchestrator \
  --permission-mode "$MODE" \
  "/autopilot ${REQ}" 2>&1 | tee -a "$LOG"

echo "■ Autopilot run finished. Check the Jira Intake issue and the GitHub PRs for results."
