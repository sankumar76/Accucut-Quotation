#!/usr/bin/env bash
# CI stage 12a: the system packages and the browser for the E2E tests (DEF-015, AQP-206; AQP-216; test strategy 10.6).
#
# `playwright install --with-deps` ran apt-get against the runner's Ubuntu mirror on every run, with no bound, and a
# slow mirror stretched the required job by up to ten minutes. This script instead:
#
#   - on a cache HIT, installs the cached .deb files with `dpkg -i` and uses no network;
#   - on a MISS, or when the cached install fails, reads the package list from Playwright's dry run
#     (scripts/ci/playwright-deps-packages.sh) and DOWNLOADS the packages under `timeout`, then installs them offline and
#     copies the .deb files into the cache directory, which the cache action saves when the job succeeds. A bad cache
#     therefore costs time and never fails the run.
#
# The bound is on the download, not on the connection: `Acquire::http::Timeout` stops a dead connection but not a slow
# stream that is still alive. Each of up to three tries runs `apt-get update` (45 s) and then
# `apt-get install --download-only` (90 s) under `timeout`. A download-only run changes no installed package, so it is
# safe to stop, and a part-done download resumes. If the update fails or hits its limit, the try ends at once and the
# download is not attempted from a mirror that has just failed. Tries 2 and 3 switch the Ubuntu sources to
# archive.ubuntu.com (apt still checks the signed Release files). After three failed tries the step fails and names the
# mirrors. The step itself has `timeout-minutes: 8` as the last bound (three tries take about 6.75 minutes at worst).
#
# If the dry run holds no install command and no report, the script warns and takes the bounded AQP-206 path instead
# (`playwright install-deps chromium` with a 20 s stall timeout); it does not fail.
#
# A cache key is immutable and a hit is never saved again, so a bad entry is not replaced by a later run. The fallback
# warning therefore names the key and the command that deletes it; see README, "Playwright install cache".
#
# Then it installs the browser itself, which has its own cache and needs no system packages.
#
# Usage:   PLAYWRIGHT_DEBS_CACHE_HIT=true|false PLAYWRIGHT_DEBS_CACHE_KEY=<key> \
#            bash scripts/ci/playwright-system-deps.sh <cache-directory>
# Testable settings (tests/unit/playwright-system-deps.test.ts); the defaults are the runner's real values:
#   APT_BOUNDS_FILE         where the apt settings are written   (/etc/apt/apt.conf.d/99-ci-bounds)
#   APT_ARCHIVES_DIR        where apt keeps downloaded packages   (/var/cache/apt/archives)
#   APT_SOURCES_DIR         where apt keeps its sources           (/etc/apt)
#   APT_UPDATE_TIMEOUT      seconds allowed for `apt-get update`  (45)
#   APT_DOWNLOAD_TIMEOUT    seconds allowed for the download      (90)
set -euo pipefail

cache_dir="${1:?usage: playwright-system-deps.sh <cache-directory>}"
cache_hit="${PLAYWRIGHT_DEBS_CACHE_HIT:-false}"
cache_key="${PLAYWRIGHT_DEBS_CACHE_KEY:-unknown}"
bounds_file="${APT_BOUNDS_FILE:-/etc/apt/apt.conf.d/99-ci-bounds}"
archives_dir="${APT_ARCHIVES_DIR:-/var/cache/apt/archives}"
sources_dir="${APT_SOURCES_DIR:-/etc/apt}"
update_timeout="${APT_UPDATE_TIMEOUT:-45}"
download_timeout="${APT_DOWNLOAD_TIMEOUT:-90}"
fallback_mirror="archive.ubuntu.com"
max_tries=3
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The list of packages present before the install. Removed on every exit, including a failed install (STD-04).
before=""
trap 'rm -f -- "${before}"' EXIT

mkdir -p "${cache_dir}"

# Hit path. Fails (so the caller falls back) when the directory holds no package or dpkg refuses one.
install_from_cache() {
  compgen -G "${cache_dir}/*.deb" > /dev/null || return 1
  sudo dpkg -i "${cache_dir}"/*.deb
}

# The apt source files: the classic list and the deb822 files.
source_files() {
  compgen -G "${sources_dir}/sources.list" || true
  compgen -G "${sources_dir}/sources.list.d/*.sources" || true
  compgen -G "${sources_dir}/sources.list.d/*.list" || true
}

# The host of the Ubuntu mirror the runner uses now, for the message that names the mirrors.
first_mirror() {
  local host=""
  while IFS= read -r file; do
    host="$(grep -hoE 'https?://[^/ ]*ubuntu\.com/ubuntu/?' "${file}" 2> /dev/null | head -n 1 | sed -E 's#https?://([^/]+)/.*#\1#' || true)"
    [ -n "${host}" ] && break
  done < <(source_files)
  echo "${host:-the mirror of the runner image}"
}

# Tries 2 and 3: point every Ubuntu source (an *ubuntu.com address that ends in /ubuntu, or the runner's mirror list) at
# archive.ubuntu.com. Other repositories on the runner (Microsoft, GitHub, PPAs) are left alone.
use_fallback_mirror() {
  local file
  while IFS= read -r file; do
    sudo sed -i -E \
      -e "s#https?://[^/ ]*ubuntu\\.com/ubuntu/?#http://${fallback_mirror}/ubuntu/#g" \
      -e "s#mirror\\+file:[^ ]+#http://${fallback_mirror}/ubuntu/#g" \
      "${file}"
  done < <(source_files)
}

# Runs the dry run and parses it. Prints the package names; fails when the output holds neither an install command nor a
# report. The dry run exits non-zero when packages are missing, so its status is not used.
list_packages() {
  local dry_run
  dry_run="$(npx playwright install-deps --dry-run chromium 2>&1 || true)"
  printf '%s\n' "${dry_run}" | bash "${script_dir}/playwright-deps-packages.sh"
}

# One try: update, then download. Either step failing or reaching its limit ends the try; the download is not started
# after a failed update.
try_download() {
  local started="${SECONDS}" status=0 what
  sudo timeout "${update_timeout}" apt-get update || status=$?
  if [ "${status}" -ne 0 ]; then
    what="failed with status ${status}"
    [ "${status}" -eq 124 ] && what="reached its ${update_timeout} s limit"
    echo "apt-get update ${what} after $((SECONDS - started)) s; ending this try."
    return 1
  fi
  echo "apt-get update took $((SECONDS - started)) s."
  started="${SECONDS}"
  sudo timeout "${download_timeout}" apt-get install --download-only -y --no-install-recommends "$@" || status=$?
  if [ "${status}" -ne 0 ]; then
    what="failed with status ${status}"
    [ "${status}" -eq 124 ] && what="reached its ${download_timeout} s limit"
    echo "The download ${what} after $((SECONDS - started)) s; ending this try."
    return 1
  fi
  echo "The download took $((SECONDS - started)) s."
}

# Miss path, normal case: up to three bounded tries, then an offline install of what was downloaded.
download_and_install() {
  local try mirror mirrors=""
  mirror="$(first_mirror)"
  for try in $(seq 1 "${max_tries}"); do
    if [ "${try}" -gt 1 ]; then
      mirror="${fallback_mirror}"
      use_fallback_mirror
    fi
    mirrors="${mirrors:+${mirrors}, }${mirror}"
    echo "Try ${try} of ${max_tries}, mirror ${mirror}."
    if try_download "$@"; then
      sudo apt-get install -y --no-download --no-install-recommends "$@"
      return 0
    fi
  done
  echo "::error::The system packages could not be downloaded in ${max_tries} tries (mirrors tried: ${mirrors}). Nothing was installed. Re-run the job; if it fails again, check the status of those mirrors."
  return 1
}

# Miss path, fallback: the bounded install of AQP-206, used when the dry run cannot be read.
bounded_install_deps() {
  npx playwright install-deps chromium
}

# Miss path: bound apt, install the packages, then keep what was downloaded.
install_and_cache() {
  local packages
  # A failed `dpkg -i` can leave packages half-installed; settle them before apt runs. Offline, and allowed to fail.
  sudo dpkg --configure -a || true
  printf 'Acquire::http::Timeout "20";\nAcquire::Retries "3";\n' | sudo tee "${bounds_file}" > /dev/null
  # apt stamps a package with the mirror's date, so "new" is decided by name, not by file time.
  before="$(mktemp)"
  find "${archives_dir}" -maxdepth 1 -name '*.deb' -printf '%f\n' | sort > "${before}"
  if packages="$(list_packages)"; then
    if [ -z "${packages}" ]; then
      echo "Playwright reports no missing system package; nothing to download."
    else
      local names=()
      mapfile -t names <<< "${packages}"
      echo "Missing system packages (${#names[@]}): ${names[*]}"
      download_and_install "${names[@]}"
    fi
  else
    echo "::warning::The output of 'playwright install-deps --dry-run' holds no install command and no dependency report; taking the bounded install of the system packages instead (the Playwright update may have changed the output)."
    bounded_install_deps
  fi
  # Only packages this run downloaded: the image may hold others in the apt cache.
  find "${archives_dir}" -maxdepth 1 -name '*.deb' -printf '%f\n' | sort | comm -13 "${before}" - |
    while IFS= read -r name; do cp -- "${archives_dir}/${name}" "${cache_dir}/"; done
  echo "Cached $(find "${cache_dir}" -maxdepth 1 -name '*.deb' | wc -l) system packages."
}

if [ "${cache_hit}" = "true" ]; then
  if install_from_cache; then
    echo "System packages installed from the cache, with no download."
  else
    echo "::warning::The cached system packages could not be installed (cache key ${cache_key}); falling back to the normal install. The entry stays until it is deleted: a maintainer runs 'gh cache delete ${cache_key}', or raises CACHE_EPOCH in ci.yml."
    rm -f "${cache_dir}"/*.deb
    install_and_cache
  fi
else
  install_and_cache
fi

npx playwright install chromium
