#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# block-git-writes.sh — PreToolUse guard for Bash in read-only roles
# (reviewers, master, analysts, planners). Blocks commands that change the
# repository history or remote: commit, push, merge, rebase, reset, tag, etc.
# Exit 2 blocks the command and shows the message to the agent.
# -----------------------------------------------------------------------------
set -u
INPUT="$(cat)"
if command -v jq >/dev/null 2>&1; then
  CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
elif command -v python3 >/dev/null 2>&1; then
  CMD="$(printf '%s' "$INPUT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))')"
else
  echo "Git guard: neither jq nor python3 is installed; command blocked. Install jq." >&2
  exit 2
fi

if printf '%s' "$CMD" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+(commit|push|merge|rebase|reset|revert|cherry-pick|tag|am|apply|stash|checkout[[:space:]]+-b|switch[[:space:]]+-c|branch[[:space:]]+-[dDmM])'; then
  echo "Git guard: your role is read-only on the repository. Report the change you need in your hand-off instead of running: $CMD" >&2
  exit 2
fi
exit 0
