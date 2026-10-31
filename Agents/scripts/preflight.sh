#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# preflight.sh — verify everything the agent team needs before an unattended run.
# Exits non-zero with a clear message on the first blocking problem.
# -----------------------------------------------------------------------------
set -uo pipefail
fail() { echo "✗ $*" >&2; exit 1; }
ok()   { echo "✓ $*"; }
warn() { echo "! $*"; }

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || fail "Run inside a git repository."

command -v claude >/dev/null || fail "Claude Code CLI not found (install: https://code.claude.com/docs)."
ok "Claude Code: $(claude --version 2>/dev/null | head -1)"

command -v jq >/dev/null || command -v python3 >/dev/null || fail "Install jq (needed by the write guards)."
ok "JSON parser available"

[ -n "${GITHUB_PAT:-}" ] || fail "GITHUB_PAT is not set (fine-grained token: contents, pull requests, issues = read/write; metadata = read)."
ok "GITHUB_PAT set"

git remote get-url origin >/dev/null 2>&1 || fail "No 'origin' remote configured."
ok "origin: $(git remote get-url origin)"

[ -z "$(git status --porcelain)" ] || warn "Working tree has uncommitted changes — agents will branch from the base branch; commit or stash first."

grep -q '<<' CLAUDE.md && warn "CLAUDE.md still contains <<placeholders>> — autopilot will stop and list them."

[ -x .claude/hooks/restrict-writes.sh ] || chmod +x .claude/hooks/*.sh 2>/dev/null
ok "Hooks executable"

if claude mcp list >/tmp/.mcp_list 2>&1; then
  grep -qi atlassian /tmp/.mcp_list && ok "Atlassian MCP configured" || fail "Atlassian MCP missing — check .mcp.json."
  grep -qi github /tmp/.mcp_list && ok "GitHub MCP configured" || fail "GitHub MCP missing — check .mcp.json."
  grep -i atlassian /tmp/.mcp_list | grep -qiE 'needs auth|not authenticated|failed' && \
    fail "Atlassian MCP needs authentication: run 'claude', then '/mcp' → atlassian → Authenticate (once per machine)."
else
  warn "Could not list MCP servers; continuing."
fi
rm -f /tmp/.mcp_list
echo "Preflight passed."
