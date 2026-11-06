#!/usr/bin/env bash
# The package-list parser of CI stage 12a (AQP-216, STORY-10.16; test strategy 10.6).
#
# Reads the output of `npx playwright install-deps --dry-run chromium` on standard input and prints the names of the
# system packages the browser needs, one per line. Two shapes of output are understood:
#
#   1. An install command: `apt-get install -y --no-install-recommends <package> <package> ...`. The names are the
#      words after `--no-install-recommends` (the shape the architect expected, test strategy 10.6).
#   2. The report of Playwright 1.64.1 on Linux (checked in its source, coreBundle.js): the dry run does not print the
#      command; it simulates the install with `apt-get install -s` and prints either
#        Missing system dependencies (N):
#          <package>
#          ...
#      or `All system dependencies are installed.` (an empty list).
#
# Exit status: 0 when the output was recognised (an empty list is a valid answer), 1 when it holds no install command and
# no report, or a name that is not a package name. The caller then warns and takes the bounded install of AQP-206; it does
# not fail the run. A name is checked against the Debian package-name rule, with an optional `:architecture` and
# `=version`, so an option such as `--allow-unauthenticated` can never reach `apt-get`.
#
# Usage:   npx playwright install-deps --dry-run chromium 2>&1 | bash scripts/ci/playwright-deps-packages.sh
set -euo pipefail

name_pattern='^[a-z0-9][a-z0-9+.-]*(:[a-z0-9-]+)?(=[A-Za-z0-9.+~:_-]+)?$'
recognised=no
in_report=no
names=()

add_name() {
  local candidate="$1" existing
  if ! [[ "${candidate}" =~ ${name_pattern} ]]; then
    echo "Not a package name: '${candidate}'" >&2
    exit 1
  fi
  for existing in "${names[@]+"${names[@]}"}"; do
    [ "${existing}" = "${candidate}" ] && return 0
  done
  names+=("${candidate}")
}

while IFS= read -r line || [ -n "${line}" ]; do
  line="${line%$'\r'}"
  if [[ "${line}" == *--no-install-recommends* ]]; then
    recognised=yes
    in_report=no
    read -r -a words <<< "${line#*--no-install-recommends}"
    for word in "${words[@]+"${words[@]}"}"; do add_name "${word}"; done
  elif [[ "${line}" =~ ^Missing\ system\ dependencies\ \([0-9]+\):[[:space:]]*$ ]]; then
    recognised=yes
    in_report=yes
  elif [[ "${line}" =~ ^All\ system\ dependencies\ are\ installed\. ]]; then
    recognised=yes
    in_report=no
  elif [ "${in_report}" = yes ] && [[ "${line}" =~ ^[[:space:]]+([^[:space:]]+)[[:space:]]*$ ]]; then
    add_name "${BASH_REMATCH[1]}"
  else
    in_report=no
  fi
done

if [ "${recognised}" != yes ]; then
  echo "No install command and no dependency report in the dry-run output." >&2
  exit 1
fi

for name in "${names[@]+"${names[@]}"}"; do printf '%s\n' "${name}"; done
