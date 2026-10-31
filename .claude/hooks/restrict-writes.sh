#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# restrict-writes.sh — PreToolUse guard for Write/Edit tool calls.
#
# Usage (from agent frontmatter):
#   bash "$CLAUDE_PROJECT_DIR/.claude/hooks/restrict-writes.sh" <allowed-prefix> [...]
#
# Each <allowed-prefix> is a path relative to the project root. A prefix ending in
# "/" allows anything under that directory; otherwise it must match the file exactly.
# Claude Code passes the tool call as JSON on stdin; exit code 2 blocks the call and
# the stderr message is shown to the agent so it can correct itself.
#
# Requires: jq (preferred) or python3. Fails CLOSED if neither is available.
# -----------------------------------------------------------------------------
set -u

INPUT="$(cat)"

extract_path() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty'
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -c 'import sys,json; t=json.load(sys.stdin).get("tool_input",{}); print(t.get("file_path") or t.get("path") or "")'
  else
    echo "__NO_PARSER__"
  fi
}

FILE_PATH="$(extract_path)"

if [ "$FILE_PATH" = "__NO_PARSER__" ]; then
  echo "Write guard: neither jq nor python3 is installed, so this write cannot be verified and is blocked. Install jq (recommended) and retry." >&2
  exit 2
fi

# Nothing to check (tool call without a path) — allow.
[ -z "$FILE_PATH" ] && exit 0

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Normalise to a project-relative path; resolve "..", "." and symlinked parents where possible.
normalise() {
  local p="$1"
  case "$p" in /*) ;; *) p="$PROJECT_ROOT/$p" ;; esac
  if command -v realpath >/dev/null 2>&1; then
    realpath -m "$p" 2>/dev/null || printf '%s' "$p"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$p"
  else
    printf '%s' "$p"
  fi
}

ABS_FILE="$(normalise "$FILE_PATH")"
ABS_ROOT="$(normalise "$PROJECT_ROOT")"

case "$ABS_FILE" in
  "$ABS_ROOT"/*) REL="${ABS_FILE#"$ABS_ROOT"/}" ;;
  *)
    echo "Write guard: '$FILE_PATH' is outside the project. Your role may only write to: $*" >&2
    exit 2
    ;;
esac

for allowed in "$@"; do
  case "$allowed" in
    */) case "$REL" in "$allowed"*) exit 0 ;; esac ;;
    *)  [ "$REL" = "$allowed" ] && exit 0 ;;
  esac
done

echo "Write guard: your role is not permitted to write '$REL'. Allowed locations: $*. If another role's artefact needs changing, report it under 'Issues for other roles' in your hand-off instead." >&2
exit 2
