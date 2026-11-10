#!/usr/bin/env bash
# CI set-up cut: the integrity check of a restored `node_modules` (AQP-243, STORY-10.19; test strategy 10.5 item 7).
#
# A cache hit skips `npm ci`, so nothing else proves that what the cache action restored is what `npm ci` made. This script
# gives that proof in well under the 5 s the story allows, in two modes:
#
#   record   After a successful `npm ci` (a cache MISS), writes `node_modules/.ci-integrity`: the number of files and links
#            and one SHA-256 over the sorted list of every file and link with its size. The file is part of the cached
#            directory, so it travels with the cache entry and is saved with it.
#   check    After a cache HIT, lists the restored directory the same way and compares. It exits 0 when the list is the same
#            and 1 when it is not, with the reason on standard error. A missing or truncated file, a missing package, a
#            missing record and a listing that takes longer than the limit all fail. It changes nothing.
#
# A failed check is not a failed job: the workflow then deletes `node_modules` and runs `npm ci` with no save (a bad cache
# costs time and never a red run or a stale install). The record is written before anything else touches `node_modules`
# (lint, the type-check and the build write caches there later), and the cache is saved right after it, so the restored list
# is exactly the recorded one. The list holds names and sizes only, no file content and no secret.
#
# The record is part of the cache entry, so its format is part of the cache key: the key in ci.yml starts with `node-modules-v<N>`,
# where N is `NODE_MODULES_CACHE_FORMAT` in the env block of ci.yml. Raise it with any change to what `record` writes (otherwise an
# old entry would fail the new check on every run), or to start a new key when an entry is bad and cannot be deleted.
#
# What the check does not do: it does not read file content, so a changed byte with the same size is not seen. The cache key
# (`package-lock.json`, `package.json`, `.npmrc`, the Node and npm versions) fixes which packages are in the entry, and the
# cache action checks its own archive; this check covers the gap between them, a restore that is incomplete.
#
# Usage:   bash scripts/ci/node-modules-integrity.sh record|check
# Needs:   bash, and GNU find and coreutils (`find -printf`, `timeout`, `sha256sum`): true on ubuntu-latest and in Git Bash.
# Exit:    0 done or intact; 1 failed (also a missing argument; the cause is printed first); 2 unknown mode.
# Testable settings (tests/unit/node-modules-integrity.test.ts); the defaults are the workflow's:
#   NODE_MODULES_DIR     the directory to list     (node_modules)
#   INTEGRITY_TIMEOUT    seconds allowed for the listing in `check`   (5)
set -euo pipefail

mode="${1:?usage: node-modules-integrity.sh record|check}"
dir="${NODE_MODULES_DIR:-node_modules}"
limit="${INTEGRITY_TIMEOUT:-5}"
# Generous, because `record` runs once per cache entry, after `npm ci`, and never on a hit.
record_bound=120
record_name=".ci-integrity"
record_file="${dir}/${record_name}"

# "<count> <sha256>" of the sorted "<path> <size>" list of every file and link in the directory, without the record itself.
# `find` runs under `timeout` in `check`, and `pipefail` turns a stopped listing into a failure.
fingerprint() {
  local bound="$1" list status=0
  # `set -e` does not apply inside a function that is called as an `if` condition, so a stopped listing is returned by hand.
  list="$(cd "${dir}" && timeout "${bound}" find . \( -type f -o -type l \) ! -path "./${record_name}" -printf '%p %s\n' | LC_ALL=C sort)" || status=$?
  if [ "${status}" -eq 124 ]; then
    echo "listing ${dir} stopped after ${bound} s" >&2
    return 1
  fi
  if [ "${status}" -ne 0 ]; then
    echo "listing ${dir} failed (exit ${status})" >&2
    return 1
  fi
  if [ -z "${list}" ]; then
    echo "the directory ${dir} holds no file" >&2
    return 1
  fi
  printf '%s\n' "${list}" | wc -l | tr -d ' ' | tr '\n' ' '
  printf '%s\n' "${list}" | sha256sum | cut -d ' ' -f 1
}

case "${mode}" in
  record)
    [ -d "${dir}" ] || { echo "no directory ${dir} to record" >&2; exit 1; }
    current="$(fingerprint "${record_bound}")" || { echo "node_modules integrity record failed" >&2; exit 1; }
    temporary="$(mktemp "${dir}/.ci-integrity.XXXXXX")"
    printf '%s\n' "${current}" > "${temporary}"
    mv -f "${temporary}" "${record_file}"
    echo "node_modules integrity recorded: ${current%% *} files"
    ;;
  check)
    if [ ! -f "${record_file}" ]; then
      echo "node_modules integrity check failed: no record (${record_name}) in the restored directory" >&2
      exit 1
    fi
    expected="$(tr -d '\r' < "${record_file}")"
    if ! actual="$(fingerprint "${limit}")"; then
      echo "node_modules integrity check failed: the restored directory could not be listed" >&2
      exit 1
    fi
    if [ "${actual}" != "${expected}" ]; then
      echo "node_modules integrity check failed: recorded ${expected%% *} files, found ${actual%% *}, or a file differs in size" >&2
      exit 1
    fi
    echo "node_modules integrity check passed: ${actual%% *} files"
    ;;
  *)
    echo "usage: node-modules-integrity.sh record|check" >&2
    exit 2
    ;;
esac
